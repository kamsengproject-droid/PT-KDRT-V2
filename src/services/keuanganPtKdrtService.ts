import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { PtKdrtTransaction } from '../types';
import { catatAuditLog } from './auditService';
import { updateSaldoRealPtKdrt } from './settingsService';

export const PT_KDRT_TRANSACTIONS_COLLECTION = 'ptKdrtTransactions';

/**
 * Real-time subscription untuk seluruh transaksi Keuangan Rekening PT KDRT.
 * Data di collection ini berdiri sendiri (independen) dan TIDAK memengaruhi Buku Kas & Bank.
 */
export function subscribePtKdrtTransactions(
  callback: (transactions: PtKdrtTransaction[]) => void,
  onError?: (error: any) => void
) {
  const colRef = collection(db, PT_KDRT_TRANSACTIONS_COLLECTION);

  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: PtKdrtTransaction[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          type: data.type || 'INCOME',
          date: data.date || '',
          amount: Number(data.amount) || 0,
          category: data.category || 'Lain-lain',
          accountName: data.accountName || 'BCA PT KDRT',
          description: data.description || '',
          notes: data.notes || '',
          referenceNumber: data.referenceNumber || '',
          createdBy: data.createdBy || '',
          createdByName: data.createdByName || '',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy,
          updatedByName: data.updatedByName,
        };
      });

      // Robust in-memory sorting: date desc, then createdAt or doc id
      list.sort((a, b) => {
        const dateComp = (b.date || '').localeCompare(a.date || '');
        if (dateComp !== 0) return dateComp;
        const aSeconds = a.createdAt?.seconds || (typeof a.createdAt === 'number' ? a.createdAt : 0);
        const bSeconds = b.createdAt?.seconds || (typeof b.createdAt === 'number' ? b.createdAt : 0);
        return bSeconds - aSeconds;
      });

      callback(list);
    },
    (err) => {
      console.error('Error subscribing to ptKdrtTransactions:', err);
      handleFirestoreError(err, OperationType.LIST, PT_KDRT_TRANSACTIONS_COLLECTION);
      if (onError) onError(err);
    }
  );
}

/**
 * Tambah Transaksi Baru Rekening PT KDRT (Input Manual)
 */
export async function createPtKdrtTransaction(
  payload: {
    type: 'INCOME' | 'EXPENSE';
    date: string;
    amount: number;
    category: string;
    accountName: string;
    description: string;
    notes?: string;
    referenceNumber?: string;
  },
  currentUserId: string = 'system',
  currentUserName: string = 'Admin'
): Promise<string> {
  const colRef = collection(db, PT_KDRT_TRANSACTIONS_COLLECTION);

  const cleanPayload = {
    type: payload.type,
    date: payload.date,
    amount: Math.abs(Number(payload.amount)) || 0,
    category: payload.category.trim(),
    accountName: payload.accountName.trim() || 'BCA PT KDRT',
    description: payload.description.trim(),
    notes: payload.notes?.trim() || '',
    referenceNumber: payload.referenceNumber?.trim() || '',
    createdBy: currentUserId,
    createdByName: currentUserName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(colRef, cleanPayload);

    // Catat ke Audit Log
    const jenisText = payload.type === 'INCOME' ? 'Uang Masuk' : 'Uang Keluar';
    await catatAuditLog(
      currentUserId,
      currentUserName,
      'CREATE_PT_KDRT_TRANSACTION',
      `Rekening PT KDRT: ${jenisText} - Rp ${cleanPayload.amount.toLocaleString('id-ID')}`,
      `Input manual transaksi rekening PT KDRT (${cleanPayload.accountName}) Kategori: ${cleanPayload.category}. Ket: ${cleanPayload.description}`
    );

    // Otomatis sinkronkan Saldo Real PT KDRT ke companySettings
    syncSaldoRealPtKdrtAutomatic(currentUserId, currentUserName).catch((e) =>
      console.warn('Auto-sync saldo real pt kdrt after create:', e)
    );

    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, PT_KDRT_TRANSACTIONS_COLLECTION);
    throw error;
  }
}

/**
 * Update Transaksi Rekening PT KDRT
 */
export async function updatePtKdrtTransaction(
  id: string,
  payload: {
    type: 'INCOME' | 'EXPENSE';
    date: string;
    amount: number;
    category: string;
    accountName: string;
    description: string;
    notes?: string;
    referenceNumber?: string;
  },
  currentUserId: string = 'system',
  currentUserName: string = 'Admin'
): Promise<void> {
  const docRef = doc(db, PT_KDRT_TRANSACTIONS_COLLECTION, id);

  const cleanPayload = {
    type: payload.type,
    date: payload.date,
    amount: Math.abs(Number(payload.amount)) || 0,
    category: payload.category.trim(),
    accountName: payload.accountName.trim() || 'BCA PT KDRT',
    description: payload.description.trim(),
    notes: payload.notes?.trim() || '',
    referenceNumber: payload.referenceNumber?.trim() || '',
    updatedAt: serverTimestamp(),
    updatedBy: currentUserId,
    updatedByName: currentUserName,
  };

  try {
    await updateDoc(docRef, cleanPayload);

    const jenisText = payload.type === 'INCOME' ? 'Uang Masuk' : 'Uang Keluar';
    await catatAuditLog(
      currentUserId,
      currentUserName,
      'UPDATE_PT_KDRT_TRANSACTION',
      `Edit Rekening PT KDRT: ${id}`,
      `Perubahan transaksi ${jenisText} Rp ${cleanPayload.amount.toLocaleString('id-ID')} (${cleanPayload.accountName})`
    );

    // Otomatis sinkronkan Saldo Real PT KDRT ke companySettings
    syncSaldoRealPtKdrtAutomatic(currentUserId, currentUserName).catch((e) =>
      console.warn('Auto-sync saldo real pt kdrt after update:', e)
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${PT_KDRT_TRANSACTIONS_COLLECTION}/${id}`);
    throw error;
  }
}

/**
 * Hapus Transaksi Rekening PT KDRT
 */
export async function deletePtKdrtTransaction(
  id: string,
  detailInfo?: { description?: string; amount?: number; type?: string },
  currentUserId: string = 'system',
  currentUserName: string = 'Admin'
): Promise<void> {
  const docRef = doc(db, PT_KDRT_TRANSACTIONS_COLLECTION, id);

  try {
    await deleteDoc(docRef);

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'DELETE_PT_KDRT_TRANSACTION',
      `Hapus Rekening PT KDRT: ${id}`,
      `Transaksi ${detailInfo?.type || ''} Rp ${(detailInfo?.amount || 0).toLocaleString('id-ID')} (${detailInfo?.description || '-'}) dihapus dari Keuangan PT KDRT.`
    );

    // Otomatis sinkronkan Saldo Real PT KDRT ke companySettings
    syncSaldoRealPtKdrtAutomatic(currentUserId, currentUserName).catch((e) =>
      console.warn('Auto-sync saldo real pt kdrt after delete:', e)
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${PT_KDRT_TRANSACTIONS_COLLECTION}/${id}`);
    throw error;
  }
}

/**
 * Otomatis menghitung akumulasi total saldo mutasi rekening PT KDRT
 * dan menyimpannya ke companySettings/saldoRealPtKdrt agar tersinkronisasi
 * secara real-time di Buku Kas & Bank (Menu No 4) dan Keuangan PT KDRT.
 */
export async function syncSaldoRealPtKdrtAutomatic(
  currentUserId: string = 'system',
  currentUserName: string = 'Sistem Auto-Sync'
): Promise<number> {
  try {
    const colRef = collection(db, PT_KDRT_TRANSACTIONS_COLLECTION);
    const snapshot = await getDocs(colRef);

    let totalIncome = 0;
    let totalExpense = 0;
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const amount = Number(data.amount) || 0;
      if (data.type === 'EXPENSE') {
        totalExpense += amount;
      } else {
        totalIncome += amount;
      }
    });

    const calculatedSaldo = totalIncome - totalExpense;
    await updateSaldoRealPtKdrt(
      calculatedSaldo,
      `Sinkronisasi otomatis mutasi rekening PT KDRT (${snapshot.size} transaksi)`,
      currentUserId,
      currentUserName
    );

    return calculatedSaldo;
  } catch (err) {
    console.error('Error in syncSaldoRealPtKdrtAutomatic:', err);
    throw err;
  }
}
