import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc, deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../firebase';
import {
  FinancialTransaction,
  FinancialReconciliation,
  ScopeType,
  TransactionType,
  TransactionStatus,
  TransactionSourceType,
} from '../types';
import { compressImageFile } from '../utils/imageCompressor';
import { catatAuditLog } from './auditService';
import { tanggalHariIni } from '../utils/formatters';

export const TRANSACTIONS_COLLECTION = 'transactions';
export const RECONCILIATIONS_COLLECTION = 'reconciliations';

// 1. Upload Bukti Transaksi / Nota / Invoice
export async function uploadTransactionReceipt(
  file: File,
  prefix: string = 'receipt'
): Promise<{
  downloadUrl: string;
  storagePath: string;
}> {
  try {
    const compressed = await compressImageFile(file, 1200, 1200, 0.85);
    const fileName = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
    const storagePath = `transactions/${fileName}`;
    const storageRef = ref(storage, storagePath);

    const snapshot = await uploadBytes(storageRef, compressed.blob, {
      contentType: compressed.mimeType,
      customMetadata: {
        originalName: file.name,
        compressed: 'true',
      },
    });

    const downloadUrl = await getDownloadURL(snapshot.ref);

    return {
      downloadUrl,
      storagePath,
    };
  } catch (error) {
    console.error('Gagal upload bukti transaksi:', error);
    throw new Error('Gagal mengunggah foto bukti transaksi.');
  }
}

// 2. Cek Anti-Double-Entry berdasarkan sourceType & referenceId
export async function checkDuplicateTransaction(
  sourceType: TransactionSourceType,
  referenceId: string
): Promise<{ isDuplicate: boolean; existingTransaction?: FinancialTransaction }> {
  if (!referenceId) return { isDuplicate: false };

  try {
    const q = query(
      collection(db, TRANSACTIONS_COLLECTION),
      where('referenceId', '==', referenceId)
    );
    const snap = await getDocs(q);

    const activeDoc = snap.docs.find((d) => {
      const data = d.data();
      return data.sourceType === sourceType && (data.status || 'ACTIVE') === 'ACTIVE';
    });

    if (activeDoc) {
      return {
        isDuplicate: true,
        existingTransaction: { id: activeDoc.id, ...activeDoc.data() } as FinancialTransaction,
      };
    }
    return { isDuplicate: false };
  } catch (error) {
    console.warn('Error checking duplicate transaction:', error);
    return { isDuplicate: false };
  }
}

// 3. Subscribe Real-time ke Buku Kas Master (Transactions)
export function subscribeTransactions(
  options?: {
    scope?: ScopeType | 'ALL';
    type?: TransactionType | 'ALL';
    status?: TransactionStatus | 'ALL';
    startDate?: string;
    endDate?: string;
    category?: string;
    sourceType?: string;
    accountId?: string;
    employeeId?: string;
  },
  callback?: (transactions: FinancialTransaction[]) => void
) {
  let q: any = collection(db, TRANSACTIONS_COLLECTION);

  if (options?.scope && options.scope !== 'ALL') {
    q = query(
      collection(db, TRANSACTIONS_COLLECTION),
      where('scope', '==', options.scope)
    );
  }

  return onSnapshot(
    q,
    (snapshot) => {
      let list = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        transactionId: docSnap.id,
        ...docSnap.data(),
      })) as FinancialTransaction[];

      list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

      // In-memory filters for advanced conditions
      if (options?.status && options.status !== 'ALL') {
        list = list.filter((tx) => (tx.status || 'ACTIVE') === options.status);
      }

      if (options?.type && options.type !== 'ALL') {
        list = list.filter((tx) => tx.type === options.type);
      }

      if (options?.startDate) {
        list = list.filter((tx) => tx.date >= options.startDate!);
      }

      if (options?.endDate) {
        list = list.filter((tx) => tx.date <= options.endDate!);
      }

      if (options?.category && options.category !== 'SEMUA') {
        list = list.filter((tx) => tx.category === options.category);
      }

      if (options?.sourceType && options.sourceType !== 'SEMUA') {
        list = list.filter((tx) => tx.sourceType === options.sourceType);
      }

      if (options?.accountId && options.accountId !== 'SEMUA') {
        list = list.filter((tx) => tx.accountId === options.accountId);
      }

      if (options?.employeeId && options.employeeId !== 'SEMUA') {
        list = list.filter((tx) => tx.employeeId === options.employeeId);
      }

      if (callback) callback(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, TRANSACTIONS_COLLECTION);
    }
  );
}

// 4. Catat Transaksi Keuangan dengan Proteksi Anti-Double-Entry Ketat & Deterministic ID
export async function createFinancialTransaction(
  transactionData: Omit<FinancialTransaction, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
  currentUserId: string,
  currentUserName: string
): Promise<{ success: boolean; id?: string; message: string; isDuplicate?: boolean }> {
  try {
    const amount = Number(transactionData.amount) || 0;
    if (amount <= 0) {
      return {
        success: false,
        message: 'Nominal transaksi harus lebih besar dari Rp 0.',
      };
    }

    let deterministicId: string | null = null;
    if (transactionData.referenceId && transactionData.sourceType) {
      deterministicId = `${transactionData.sourceType}_${transactionData.referenceId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
      
      const docRef = doc(db, TRANSACTIONS_COLLECTION, deterministicId);
      const existingSnap = await getDoc(docRef);

      if (existingSnap.exists()) {
        const existingData = existingSnap.data();
        if (existingData.status === 'ACTIVE') {
          await catatAuditLog(
            currentUserId,
            currentUserName,
            'TRANSACTION_DUPLICATE_PREVENTED',
            `${transactionData.type}: ${transactionData.description}`,
            `Pencatatan ganda dicegah. Sumber ${transactionData.sourceType} dengan Ref ID ${transactionData.referenceId} sudah tercatat di Transaksi ID ${deterministicId}.`
          );

          return {
            success: false,
            isDuplicate: true,
            id: deterministicId,
            message: `Transaksi ini sudah pernah dicatat sebelumnya (Ref ID: ${transactionData.referenceId}).`,
          };
        }
      }
    }

    const payload: any = {
      type: transactionData.type,
      amount: amount,
      date: transactionData.date || tanggalHariIni(),
      category: transactionData.category || (transactionData.type === 'INCOME' ? 'KOMISI TIKTOK' : 'OPERASIONAL'),
      scope: transactionData.scope || 'PRIBADI',
      sourceType: transactionData.sourceType || 'MANUAL',
      referenceId: transactionData.referenceId || null,

      accountId: transactionData.accountId || null,
      accountName: transactionData.accountName || null,
      gmv: Number(transactionData.gmv) || 0,
      estimatedCommission: Number(transactionData.estimatedCommission) || 0,
      realCommission: Number(transactionData.realCommission) || amount,

      employeeId: transactionData.employeeId || null,
      employeeName: transactionData.employeeName || null,

      payrollId: transactionData.payrollId || null,
      sampleId: transactionData.sampleId || null,
      productId: transactionData.productId || null,
      inventoryId: transactionData.inventoryId || null,
      profitSharingSettlementId: transactionData.profitSharingSettlementId || null,

      paymentMethod: transactionData.paymentMethod || 'TRANSFER',
      description: transactionData.description || 'Transaksi Keuangan',
      attachmentUrl: transactionData.attachmentUrl || null,
      attachmentStoragePath: transactionData.attachmentStoragePath || null,
      notes: transactionData.notes || '',

      status: 'ACTIVE',
      createdBy: currentUserId,
      createdByName: currentUserName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    let transactionDocId: string;

    if (deterministicId) {
      const docRef = doc(db, TRANSACTIONS_COLLECTION, deterministicId);
      await setDoc(docRef, { ...payload, id: deterministicId, transactionId: deterministicId });
      transactionDocId = deterministicId;
    } else {
      const docRef = await addDoc(collection(db, TRANSACTIONS_COLLECTION), payload);
      transactionDocId = docRef.id;
    }

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'TRANSACTION_CREATED',
      `[${payload.type}] ${payload.category} - Rp ${amount.toLocaleString('id-ID')}`,
      `Scope: ${payload.scope}, Sumber: ${payload.sourceType}, Tanggal: ${payload.date}, Keterangan: ${payload.description}`
    );

    return {
      success: true,
      id: transactionDocId,
      message: `Transaksi ${payload.type === 'INCOME' ? 'Uang Masuk' : 'Uang Keluar'} sebesar Rp ${amount.toLocaleString('id-ID')} berhasil dicatat.`,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, TRANSACTIONS_COLLECTION);
    throw error;
  }
}

// 5. Catat Uang Masuk Khusus TikTok (GMV & Estimasi Komisi adalah metrik, Komisi Real adalah UANG MASUK)
export async function recordTikTokIncome(
  data: {
    date: string;
    accountId: string;
    accountName: string;
    scope: ScopeType;
    gmv: number;
    estimatedCommission: number;
    realCommission: number;
    notes?: string;
  },
  currentUserId: string,
  currentUserName: string
): Promise<{ success: boolean; id?: string; message: string }> {
  const realComm = Number(data.realCommission) || 0;
  const refId = `tiktok_${data.accountId}_${data.date}`;

  // 1. Simpan Transaksi Uang Masuk ke transactions
  const txResult = await createFinancialTransaction(
    {
      type: 'INCOME',
      amount: realComm, // HANYA KOMISI REAL YANG MASUK KAS
      date: data.date,
      category: 'KOMISI TIKTOK',
      scope: data.scope,
      sourceType: 'TIKTOK_COMMISSION',
      referenceId: refId,
      accountId: data.accountId,
      accountName: data.accountName,
      gmv: Number(data.gmv) || 0,
      estimatedCommission: Number(data.estimatedCommission) || 0,
      realCommission: realComm,
      paymentMethod: 'TRANSFER',
      description: `Komisi Real TikTok: ${data.accountName} (${data.date})`,
      notes: data.notes || `GMV: Rp ${Number(data.gmv).toLocaleString('id-ID')}, Estimasi Komisi: Rp ${Number(data.estimatedCommission).toLocaleString('id-ID')}`,
      createdBy: currentUserId,
      createdByName: currentUserName,
    },
    currentUserId,
    currentUserName
  );

  return txResult;
}

// 6. VOID Transaksi (Koreksi Transaksi Tanpa Menghapus Permanen)
export async function deleteTransaction(
  transactionId: string,
  currentTransaction: FinancialTransaction,
  deleteReason: string,
  currentUserId: string,
  currentUserName: string
): Promise<{ success: boolean; message: string }> {
  try {
    if (!deleteReason || deleteReason.trim().length === 0) {
      throw new Error('Alasan penghapusan wajib diisi untuk audit trail.');
    }

    const docRef = doc(db, TRANSACTIONS_COLLECTION, transactionId);

    // Hard delete
    await deleteDoc(docRef);

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'DELETE_TRANSACTION',
      `[HAPUS] ${currentTransaction.type} - Rp ${currentTransaction.amount.toLocaleString('id-ID')}`,
      `Transaksi ID: ${transactionId}, Kategori: ${currentTransaction.category}, Alasan HAPUS: ${deleteReason.trim()}`,
      currentTransaction, // Before state
      null // After state
    );

    return {
      success: true,
      message: `Transaksi berhasil dihapus dari sistem. Audit log telah dicatat.`,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${TRANSACTIONS_COLLECTION}/${transactionId}`);
    throw error;
  }
}

// 7. Update Transaksi Keuangan
export async function updateTransaction(
  transactionId: string,
  currentTransaction: FinancialTransaction,
  updates: Partial<FinancialTransaction>,
  currentUserId: string,
  currentUserName: string
): Promise<void> {
  try {
    const docRef = doc(db, TRANSACTIONS_COLLECTION, transactionId);

    const payload: any = {
      ...updates,
      updatedAt: serverTimestamp(),
      updatedBy: currentUserId,
      updatedByName: currentUserName,
    };

    await updateDoc(docRef, payload);

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'TRANSACTION_UPDATED',
      `[${currentTransaction.type}] ${updates.category || currentTransaction.category}`,
      `Update transaksi ID: ${transactionId}, Nominal: Rp ${(updates.amount !== undefined ? updates.amount : currentTransaction.amount).toLocaleString('id-ID')}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${TRANSACTIONS_COLLECTION}/${transactionId}`);
    throw error;
  }
}

// 8. Rekonsiliasi Kas (Buku Kas vs Rekening / Fisik Aktual)
export function subscribeReconciliations(
  callback: (list: FinancialReconciliation[]) => void
) {
  const q = query(collection(db, RECONCILIATIONS_COLLECTION), orderBy('date', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as FinancialReconciliation[];
      callback(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, RECONCILIATIONS_COLLECTION);
    }
  );
}

export async function createReconciliation(
  reconciliationData: Omit<FinancialReconciliation, 'id' | 'createdAt'>,
  currentUserId: string,
  currentUserName: string
): Promise<string> {
  try {
    const sysBal = Number(reconciliationData.systemBalance) || 0;
    const actBal = Number(reconciliationData.actualBalance) || 0;
    const diff = actBal - sysBal;

    let status: 'SEIMBANG' | 'SELISIH_KURANG' | 'SELISIH_LEBIH' = 'SEIMBANG';
    if (diff > 0) status = 'SELISIH_LEBIH';
    else if (diff < 0) status = 'SELISIH_KURANG';

    const payload = {
      ...reconciliationData,
      systemBalance: sysBal,
      actualBalance: actBal,
      difference: diff,
      status,
      date: reconciliationData.date || tanggalHariIni(),
      createdBy: currentUserId,
      createdByName: currentUserName,
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, RECONCILIATIONS_COLLECTION), payload);

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'RECONCILIATION_RECORDED',
      `Rekonsiliasi: ${reconciliationData.accountName}`,
      `Periode: ${reconciliationData.periodLabel}, Saldo Sistem: Rp ${sysBal.toLocaleString('id-ID')}, Saldo Aktual: Rp ${actBal.toLocaleString('id-ID')}, Selisih: Rp ${diff.toLocaleString('id-ID')} (${status})`
    );

    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, RECONCILIATIONS_COLLECTION);
    throw error;
  }
}
