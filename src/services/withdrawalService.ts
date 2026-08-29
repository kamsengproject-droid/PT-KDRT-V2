import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  WithdrawalRecord,
  MedsosWithdrawalStatus,
  FinancialTransaction,
} from '../types';
import { catatAuditLog } from './auditService';

export const WITHDRAWALS_COLLECTION = 'withdrawals';

/**
 * Deterministic Transaction ID untuk menghubungkan Riwayat Penarikan
 * secara 1-to-1 dengan collection `transactions` Buku Kas & Bank.
 */
export function getWithdrawalTxDocId(withdrawalId: string): string {
  return `WITHDRAWAL_${withdrawalId}`;
}

/**
 * Subscribe real-time seluruh riwayat penarikan dana
 */
export function subscribeWithdrawals(
  callback: (withdrawals: WithdrawalRecord[]) => void
) {
  const colRef = collection(db, WITHDRAWALS_COLLECTION);
  const q = query(colRef, orderBy('date', 'desc'));

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as WithdrawalRecord[];

      // In-memory stable sort by date desc then createdAt desc
      list.sort((a, b) => {
        const dateCompare = (b.date || '').localeCompare(a.date || '');
        if (dateCompare !== 0) return dateCompare;
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      });

      callback(list);
    },
    (error) => {
      // Fallback tanpa orderBy jika Firestore index belum siap
      console.warn('Fallback onSnapshot subscribeWithdrawals:', error);
      const fallbackQuery = collection(db, WITHDRAWALS_COLLECTION);
      return onSnapshot(
        fallbackQuery,
        (fallbackSnap) => {
          const list = fallbackSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })) as WithdrawalRecord[];
          list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
          callback(list);
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, WITHDRAWALS_COLLECTION);
        }
      );
    }
  );
}

/**
 * Sinkronisasi status penarikan ke Buku Kas & Bank (`transactions` collection).
 * - Jika status === 'BERHASIL', simpan/update transaksi Uang Masuk ke rekening tujuan.
 * - Jika status !== 'BERHASIL' (DIPROSES, GAGAL, DIBATALKAN), hapus transaksi dari Buku Kas & Bank agar tidak orphan.
 */
export async function syncWithdrawalToTransaction(
  withdrawal: WithdrawalRecord & { id: string },
  currentUserId: string = 'system',
  currentUserName: string = 'Sistem Auto-Sync'
): Promise<string | null> {
  const txId = getWithdrawalTxDocId(withdrawal.id);
  const txRef = doc(db, 'transactions', txId);

  try {
    if (withdrawal.status !== 'BERHASIL') {
      // Hapus transaksi jika status bukan BERHASIL
      const existingSnap = await getDoc(txRef);
      if (existingSnap.exists()) {
        await deleteDoc(txRef);
      }
      return null;
    }

    // Status BERHASIL: Buat / Update transaksi deterministic
    const amountVal = Number(withdrawal.amount) || 0;
    const txPayload: Partial<FinancialTransaction> = {
      type: 'INCOME',
      amount: amountVal,
      date: withdrawal.date,
      category: 'Penarikan TikTok/Medsos',
      scope: 'PRIBADI',
      sourceType: 'WITHDRAWAL',
      referenceId: withdrawal.id,
      accountId: withdrawal.accountId || null,
      accountName: withdrawal.accountName || null,
      sourceAccountName: withdrawal.accountName || null,
      destinationAccountName: withdrawal.destinationAccount || 'BCA',
      description: `Penarikan ${withdrawal.accountName || 'TikTok'} - ${withdrawal.date}`,
      paymentMethod: withdrawal.destinationAccount || 'TRANSFER',
      notes: withdrawal.notes ? `[Ref: ${withdrawal.referenceNumber || '-'}] ${withdrawal.notes}` : `Ref: ${withdrawal.referenceNumber || '-'}`,
      status: 'ACTIVE',
      updatedAt: serverTimestamp(),
      updatedBy: currentUserId,
      updatedByName: currentUserName,
    };

    const existingSnap = await getDoc(txRef);
    if (!existingSnap.exists()) {
      txPayload.createdAt = serverTimestamp();
      txPayload.createdBy = currentUserId;
      txPayload.createdByName = currentUserName;
    }

    await setDoc(txRef, txPayload, { merge: true });
    return txId;
  } catch (error) {
    console.error('Gagal sinkronisasi Penarikan ke Buku Kas & Bank:', error);
    throw error;
  }
}

/**
 * Tambah Catatan Penarikan Baru
 */
export async function tambahPenarikan(
  data: Omit<WithdrawalRecord, 'id' | 'createdAt' | 'updatedAt'>,
  currentUserId: string,
  currentUserName: string
): Promise<string> {
  try {
    const colRef = collection(db, WITHDRAWALS_COLLECTION);
    const amountNum = Number(data.amount) || 0;
    const statusVal: MedsosWithdrawalStatus = data.status || 'BERHASIL';

    const payload = {
      date: data.date,
      accountId: data.accountId || '',
      accountName: data.accountName || '',
      amount: amountNum,
      destinationAccount: data.destinationAccount || 'BCA',
      status: statusVal,
      referenceNumber: data.referenceNumber?.trim() || '',
      notes: data.notes?.trim() || '',
      createdAt: serverTimestamp(),
      createdBy: currentUserId,
      createdByName: currentUserName,
      updatedAt: serverTimestamp(),
      updatedBy: currentUserId,
      updatedByName: currentUserName,
    };

    const docRef = await addDoc(colRef, payload);
    const withdrawalId = docRef.id;

    // Sinkronisasi otomatis ke Buku Kas & Bank jika status BERHASIL
    if (statusVal === 'BERHASIL') {
      await syncWithdrawalToTransaction(
        {
          id: withdrawalId,
          ...payload,
        } as WithdrawalRecord & { id: string },
        currentUserId,
        currentUserName
      );

      // Simpan syncedTransactionId
      await updateDoc(doc(db, WITHDRAWALS_COLLECTION, withdrawalId), {
        syncedTransactionId: getWithdrawalTxDocId(withdrawalId),
      });
    }

    // Audit Log
    await catatAuditLog(
      currentUserId,
      currentUserName,
      'TAMBAH_PENARIKAN_DANA',
      `Penarikan ${data.accountName}`,
      `Tanggal: ${data.date}, Nominal: Rp ${amountNum.toLocaleString('id-ID')}, Tujuan: ${data.destinationAccount}, Status: ${statusVal}`,
      null,
      payload
    );

    return withdrawalId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, WITHDRAWALS_COLLECTION);
    throw error;
  }
}

/**
 * Update Riwayat Penarikan Dana
 */
export async function updatePenarikan(
  id: string,
  data: Partial<WithdrawalRecord>,
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  try {
    const docRef = doc(db, WITHDRAWALS_COLLECTION, id);
    const prevSnap = await getDoc(docRef);
    const before = prevSnap.exists() ? (prevSnap.data() as WithdrawalRecord) : null;

    const amountNum = data.amount !== undefined ? Number(data.amount) || 0 : before?.amount || 0;
    const statusVal: MedsosWithdrawalStatus = data.status || before?.status || 'BERHASIL';

    const payload: Partial<WithdrawalRecord> = {
      ...data,
      amount: amountNum,
      status: statusVal,
      referenceNumber: data.referenceNumber !== undefined ? data.referenceNumber.trim() : before?.referenceNumber || '',
      notes: data.notes !== undefined ? data.notes.trim() : before?.notes || '',
      updatedAt: serverTimestamp(),
      updatedBy: currentUserId,
      updatedByName: currentUserName,
    };

    await updateDoc(docRef, payload);

    // Sync ke Buku Kas & Bank
    const mergedRecord: WithdrawalRecord & { id: string } = {
      id,
      date: payload.date || before?.date || '',
      accountId: payload.accountId || before?.accountId || '',
      accountName: payload.accountName || before?.accountName || '',
      amount: amountNum,
      destinationAccount: payload.destinationAccount || before?.destinationAccount || 'BCA',
      status: statusVal,
      referenceNumber: payload.referenceNumber || before?.referenceNumber || '',
      notes: payload.notes || before?.notes || '',
    };

    await syncWithdrawalToTransaction(mergedRecord, currentUserId, currentUserName);

    // Audit Log
    await catatAuditLog(
      currentUserId,
      currentUserName,
      'EDIT_PENARIKAN_DANA',
      `Penarikan ${mergedRecord.accountName}`,
      `Diperbarui menjadi Nominal: Rp ${amountNum.toLocaleString('id-ID')}, Tujuan: ${mergedRecord.destinationAccount}, Status: ${statusVal}`,
      before,
      payload
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${WITHDRAWALS_COLLECTION}/${id}`);
    throw error;
  }
}

/**
 * Hapus Riwayat Penarikan Dana
 * Menghapus dokumen penarikan dan membersihkan transaksi terkait di Buku Kas & Bank.
 */
export async function hapusPenarikan(
  id: string,
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  try {
    const docRef = doc(db, WITHDRAWALS_COLLECTION, id);
    const prevSnap = await getDoc(docRef);
    const before = prevSnap.exists() ? (prevSnap.data() as WithdrawalRecord) : null;

    // 1. Hapus transaksi terkait di Buku Kas & Bank secara aman (anti-orphan)
    const txId = getWithdrawalTxDocId(id);
    const txRef = doc(db, 'transactions', txId);
    const txSnap = await getDoc(txRef);
    if (txSnap.exists()) {
      await deleteDoc(txRef);
    }

    // 2. Hapus dokumen penarikan
    await deleteDoc(docRef);

    // 3. Catat audit log
    await catatAuditLog(
      currentUserId,
      currentUserName,
      'HAPUS_PENARIKAN_DANA',
      `Penarikan ${before?.accountName || id}`,
      `Dihapus data penarikan tanggal ${before?.date || '-'} nominal Rp ${(Number(before?.amount) || 0).toLocaleString('id-ID')} ke ${before?.destinationAccount || '-'}`,
      before,
      null
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${WITHDRAWALS_COLLECTION}/${id}`);
    throw error;
  }
}
