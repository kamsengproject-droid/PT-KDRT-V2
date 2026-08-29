import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
  getDocs,
  setDoc,
  getDoc,
} from 'firebase/firestore';

import { db, handleFirestoreError, OperationType } from '../firebase';
import { DailyPerformance, ScopeType } from '../types';
import { catatAuditLog } from './auditService';

/**
 * ============================================================
 * PERFORMANCE SERVICE
 * ============================================================
 *
 * Prinsip utama:
 *
 * dailyPerformance = SUMBER DATA PERFORMA AKUN
 *
 * Berisi:
 * - GMV
 * - Estimated Commission
 * - Commission Real
 * - Item Sold
 * - Product Impression
 *
 * SINKRONISASI OTOMATIS:
 * Setiap Komisi Real (commissionReal > 0) dianggap sebagai Uang Masuk
 * perusahaan dan secara otomatis disinkronkan ke Buku Kas & Bank
 * (`transactions`) dengan:
 * - Deterministic ID: COMMISSION_REAL_${performanceId}
 * - Akun Tujuan: BCA PT KDRT
 * - Kategori: KOMISI_TIKTOK
 * - Tipe: INCOME (Uang Masuk)
 * - Anti-duplikasi & Idempotent
 */

/* ============================================================
   1. SUBSCRIBE DAILY PERFORMANCE
   ============================================================ */

export function subscribeDailyPerformance(
  scope?: ScopeType,
  callback?: (list: DailyPerformance[]) => void
) {
  const colRef = collection(db, 'dailyPerformance');

  const q = scope
    ? query(colRef, where('scope', '==', scope))
    : colRef;

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as DailyPerformance[];

      // Sort terbaru ke terlama
      list.sort((a, b) =>
        (b.date || '').localeCompare(a.date || '')
      );

      if (callback) {
        callback(list);
      }
    },
    (err) => {
      handleFirestoreError(
        err,
        OperationType.GET,
        'dailyPerformance'
      );
    }
  );
}

/* ============================================================
   2. DETERMINISTIC DOCUMENT ID
   ============================================================ */

/**
 * Satu akun hanya boleh mempunyai satu data performa
 * untuk satu tanggal.
 *
 * PERFORMANCE_ACCOUNTID_YYYY-MM-DD
 */
export function getPerformanceDocId(
  accountId: string,
  date: string
): string {
  return `PERFORMANCE_${accountId}_${date}`;
}

/**
 * Deterministic transaction ID untuk Komisi Real di Buku Kas & Bank.
 */
export function getTransactionDocId(
  performanceId: string
): string {
  return `COMMISSION_REAL_${performanceId}`;
}

/* ============================================================
   3. CHECK DUPLICATE PERFORMANCE
   ============================================================ */

export async function checkDuplicatePerformance(
  accountId: string,
  date: string
): Promise<boolean> {
  const docId = getPerformanceDocId(accountId, date);

  const docRef = doc(
    db,
    'dailyPerformance',
    docId
  );

  const snap = await getDoc(docRef);

  return snap.exists();
}

/* ============================================================
   3B. SINKRONISASI SINGLE KOMISI REAL KE TRANSAKSI BUKU KAS & BANK
   ============================================================ */

export interface SingleSyncResult {
  action: 'CREATED' | 'UPDATED' | 'UNCHANGED' | 'DELETED' | 'NONE';
  txId: string | null;
}

export interface KomisiSyncSummary {
  totalChecked: number;
  totalNew: number;
  totalUpdated: number;
  totalAlreadySynced: number;
  totalSynced: number;
  totalDuplicates: number;
  details: string[];
}

export async function syncKomisiRealToTransaction(
  perfDoc: {
    id: string;
    date: string;
    accountId: string;
    accountName?: string;
    scope?: ScopeType;
    commissionReal?: number;
    realCommission?: number;
    commissionNotes?: string;
    notes?: string;
  },
  currentUserId: string = 'system',
  currentUserName: string = 'Sistem Auto-Sync'
): Promise<SingleSyncResult> {
  try {
    const commValue = Number(perfDoc.commissionReal ?? perfDoc.realCommission) || 0;
    const txId = getTransactionDocId(perfDoc.id);
    const txRef = doc(db, 'transactions', txId);

    if (commValue <= 0) {
      // Jika nominal 0 atau negatif, hapus transaksi terkait jika ada
      const existingSnap = await getDoc(txRef);
      if (existingSnap.exists()) {
        await deleteDoc(txRef);
        return { action: 'DELETED', txId: null };
      }
      return { action: 'NONE', txId: null };
    }

    const existingSnap = await getDoc(txRef);
    const existingTx = existingSnap.exists() ? existingSnap.data() : null;

    const txPayload: any = {
      id: txId,
      transactionId: txId,
      type: 'INCOME',
      amount: commValue,
      date: perfDoc.date,
      category: 'KOMISI_TIKTOK',
      scope: perfDoc.scope || 'SHARING',
      sourceType: 'COMMISSION_REAL',
      referenceId: perfDoc.id,
      sourcePerformanceId: perfDoc.id,
      performanceId: perfDoc.id,
      sourceAccountId: perfDoc.accountId,
      sourceAccountName: perfDoc.accountName || perfDoc.accountId,
      destinationAccountName: 'BCA PT KDRT',
      accountName: 'BCA PT KDRT',
      accountId: 'BCA PT KDRT',
      paymentMethod: 'TRANSFER',
      description: `Komisi Real ${perfDoc.accountName || perfDoc.accountId} (${perfDoc.date})`,
      notes: perfDoc.commissionNotes || perfDoc.notes || '',
      status: 'ACTIVE',
      updatedAt: serverTimestamp(),
      updatedBy: currentUserId,
      updatedByName: currentUserName,
    };

    if (!existingTx) {
      txPayload.createdAt = serverTimestamp();
      txPayload.createdBy = currentUserId;
      txPayload.createdByName = currentUserName;
      await setDoc(txRef, txPayload);
      return { action: 'CREATED', txId };
    }

    // Check if anything actually changed
    const currentAmount = Number(existingTx.amount) || 0;
    const currentDate = existingTx.date;
    const currentStatus = existingTx.status || 'ACTIVE';

    if (
      currentAmount === commValue &&
      currentDate === perfDoc.date &&
      currentStatus === 'ACTIVE'
    ) {
      return { action: 'UNCHANGED', txId };
    }

    await setDoc(txRef, txPayload, { merge: true });
    return { action: 'UPDATED', txId };
  } catch (error) {
    console.error('Gagal sinkronisasi Komisi Real ke Transaksi:', error);
    throw error;
  }
}

/* ============================================================
   3C. RECONCILIATION / BACKFILL SEMUA KOMISI REAL
   ============================================================ */

/**
 * Menyelaraskan seluruh data Komisi Real di dailyPerformance
 * yang belum ada di transactions (termasuk tanggal 24-28 Agustus).
 * Bersifat IDEMPOTENT dan aman dijalankan berulang kali.
 */
export async function syncAllKomisiRealToTransactions(
  currentUserId: string = 'system',
  currentUserName: string = 'Sistem Auto-Sync'
): Promise<KomisiSyncSummary> {
  try {
    const perfCol = collection(db, 'dailyPerformance');
    const perfSnap = await getDocs(perfCol);

    let totalChecked = 0;
    let totalNew = 0;
    let totalUpdated = 0;
    let totalAlreadySynced = 0;
    const details: string[] = [];

    for (const docSnap of perfSnap.docs) {
      const pData = docSnap.data() as DailyPerformance;
      const comm = Number(pData.commissionReal ?? pData.realCommission ?? 0);
      totalChecked++;

      if (comm > 0) {
        const result = await syncKomisiRealToTransaction(
          {
            id: docSnap.id,
            date: pData.date,
            accountId: pData.accountId,
            accountName: pData.accountName,
            scope: pData.scope,
            commissionReal: comm,
            realCommission: comm,
            commissionNotes: pData.commissionNotes,
            notes: pData.notes,
          },
          currentUserId,
          currentUserName
        );

        if (result.action === 'CREATED') {
          totalNew++;
          details.push(`[BARU] ${pData.accountName || pData.accountId} (${pData.date}) -> Rp ${comm.toLocaleString('id-ID')}`);
        } else if (result.action === 'UPDATED') {
          totalUpdated++;
          details.push(`[UPDATE] ${pData.accountName || pData.accountId} (${pData.date}) -> Rp ${comm.toLocaleString('id-ID')}`);
        } else if (result.action === 'UNCHANGED') {
          totalAlreadySynced++;
        }
      }
    }

    const totalSynced = totalNew + totalUpdated + totalAlreadySynced;

    return {
      totalChecked,
      totalNew,
      totalUpdated,
      totalAlreadySynced,
      totalSynced,
      totalDuplicates: 0,
      details,
    };
  } catch (error) {
    console.error('Error saat rekonsiliasi Komisi Real ke Buku Kas & Bank:', error);
    throw error;
  }
}

/* ============================================================
   4. SAVE KOMISI REAL
   ============================================================ */

/**
 * Menyimpan Komisi Real ke dailyPerformance DAN otomatis
 * mencatat Uang Masuk ke Buku Kas & Bank (transactions).
 */
export async function saveKomisiReal(
  entry: Partial<
    Omit<
      DailyPerformance,
      'id' | 'createdAt' | 'updatedAt'
    >
  > & {
    accountId: string;
    date: string;
    commissionReal?: number;
    realCommission?: number;
    itemSold?: number;
    productImpression?: number;
    commissionNotes?: string;
  },
  currentUserId: string,
  currentUserName: string
) {
  try {
    /* --------------------------------------------------------
       VALIDASI DASAR
       -------------------------------------------------------- */

    if (!entry.accountId || !entry.date) {
      throw new Error(
        'AccountId dan Date wajib diisi.'
      );
    }

    const perfId = getPerformanceDocId(
      entry.accountId,
      entry.date
    );

    const perfRef = doc(
      db,
      'dailyPerformance',
      perfId
    );

    /* --------------------------------------------------------
       AMBIL DATA LAMA
       -------------------------------------------------------- */

    const perfSnap = await getDoc(perfRef);

    const existingPerf = perfSnap.exists()
      ? perfSnap.data()
      : null;

    /* --------------------------------------------------------
       KOMISI REAL
       -------------------------------------------------------- */

    let commissionValue: number;

    if (
      entry.commissionReal !== undefined ||
      entry.realCommission !== undefined
    ) {
      commissionValue =
        Number(
          entry.commissionReal ??
            entry.realCommission
        ) || 0;
    } else {
      commissionValue =
        Number(existingPerf?.commissionReal) ||
        Number(existingPerf?.realCommission) ||
        0;
    }

    /* --------------------------------------------------------
       GMV
       -------------------------------------------------------- */

    const gmvValue =
      entry.gmv !== undefined
        ? Number(entry.gmv) || 0
        : Number(existingPerf?.gmv) || 0;

    /* --------------------------------------------------------
       ESTIMATED COMMISSION
       -------------------------------------------------------- */

    const estCommValue =
      entry.estimatedCommission !== undefined
        ? Number(entry.estimatedCommission) || 0
        : Number(
            existingPerf?.estimatedCommission
          ) || 0;

    /* --------------------------------------------------------
       ITEM SOLD
       -------------------------------------------------------- */

    const itemSoldValue =
      entry.itemSold !== undefined
        ? Number(entry.itemSold) || 0
        : Number(existingPerf?.itemSold) || 0;

    /* --------------------------------------------------------
       PRODUCT IMPRESSION
       -------------------------------------------------------- */

    const productImpressionValue =
      entry.productImpression !== undefined
        ? Number(entry.productImpression) || 0
        : Number(
            existingPerf?.productImpression
          ) || 0;

    /* --------------------------------------------------------
       WHITELIST PAYLOAD
       -------------------------------------------------------- */

    const perfData = {
      date: entry.date,

      accountId: entry.accountId,

      accountName:
        entry.accountName ??
        existingPerf?.accountName ??
        '',

      scope:
        entry.scope ??
        existingPerf?.scope ??
        'SHARING',

      notes:
        existingPerf?.notes ??
        '',

      commissionNotes:
        entry.commissionNotes ??
        existingPerf?.commissionNotes ??
        '',

      gmv: gmvValue,

      estimatedCommission:
        estCommValue,

      itemSold:
        itemSoldValue,

      productImpression:
        productImpressionValue,

      commissionReal:
        commissionValue,

      realCommission:
        commissionValue,

      updatedBy:
        currentUserId,

      updatedAt:
        serverTimestamp(),
    };

    /* --------------------------------------------------------
       SIMPAN DAILY PERFORMANCE
       -------------------------------------------------------- */

    await setDoc(
      perfRef,
      {
        ...perfData,

        createdBy:
          existingPerf?.createdBy ||
          currentUserId,

        createdAt:
          existingPerf?.createdAt ||
          serverTimestamp(),
      },
      {
        merge: true,
      }
    );

    /* --------------------------------------------------------
       AUTO-SYNC KE BUKU KAS & BANK (TRANSACTIONS)
       -------------------------------------------------------- */
    await syncKomisiRealToTransaction(
      {
        id: perfId,
        date: entry.date,
        accountId: entry.accountId,
        accountName: perfData.accountName,
        scope: perfData.scope as ScopeType,
        commissionReal: commissionValue,
        realCommission: commissionValue,
        commissionNotes: perfData.commissionNotes,
      },
      currentUserId,
      currentUserName
    );

    /* --------------------------------------------------------
       AUDIT LOG
       -------------------------------------------------------- */

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'INPUT_KOMISI_REAL',
      entry.accountName ||
        entry.accountId,
      `Tanggal: ${entry.date}, GMV: Rp ${gmvValue.toLocaleString(
        'id-ID'
      )}, Estimasi Komisi: Rp ${estCommValue.toLocaleString(
        'id-ID'
      )}, Komisi Real: Rp ${commissionValue.toLocaleString(
        'id-ID'
      )} (Tersinkron ke Buku Kas & Bank BCA PT KDRT)`
    );

    return perfId;
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.CREATE,
      'dailyPerformance'
    );

    throw error;
  }
}

/* ============================================================
   5. SAVE DATA OMSET
   ============================================================ */

/**
 * Menyimpan:
 * - GMV
 * - Estimated Commission
 * - Item Sold
 * - Product Impression
 *
 * Tidak menyentuh Kas & Bank.
 */
export async function saveOmsetData(
  entry: {
    date: string;
    accountId: string;
    accountName: string;
    scope: ScopeType;
    gmv: number;
    estimatedCommission: number;
    itemSold?: number;
    productImpression?: number;
    notes?: string;
  },
  currentUserId: string,
  currentUserName: string
) {
  try {
    /* --------------------------------------------------------
       VALIDASI
       -------------------------------------------------------- */

    if (!entry.accountId || !entry.date) {
      throw new Error(
        'AccountId dan Date wajib diisi.'
      );
    }

    const perfId = getPerformanceDocId(
      entry.accountId,
      entry.date
    );

    const perfRef = doc(
      db,
      'dailyPerformance',
      perfId
    );

    /* --------------------------------------------------------
       DATA LAMA
       -------------------------------------------------------- */

    const perfSnap = await getDoc(perfRef);

    const existingPerf = perfSnap.exists()
      ? perfSnap.data()
      : null;

    /* --------------------------------------------------------
       VALUES
       -------------------------------------------------------- */

    const gmvValue =
      Number(entry.gmv) || 0;

    const estCommValue =
      Number(entry.estimatedCommission) || 0;

    /**
     * Komisi Real adalah milik tab Komisi Real.
     *
     * Jangan pernah dihapus ketika owner/employee
     * mengubah data GMV.
     */
    const existingComm =
      Number(
        existingPerf?.commissionReal
      ) ||
      Number(
        existingPerf?.realCommission
      ) ||
      0;

    /* --------------------------------------------------------
       PAYLOAD
       -------------------------------------------------------- */

    const payload = {
      date:
        entry.date,

      accountId:
        entry.accountId,

      accountName:
        entry.accountName,

      scope:
        entry.scope,

      gmv:
        gmvValue,

      estimatedCommission:
        estCommValue,

      itemSold:
        entry.itemSold !== undefined
          ? Number(entry.itemSold) || 0
          : Number(existingPerf?.itemSold) || 0,

      productImpression:
        entry.productImpression !== undefined
          ? Number(entry.productImpression) || 0
          : Number(
              existingPerf?.productImpression
            ) || 0,

      /**
       * Preserve existing Komisi Real.
       */
      commissionReal:
        existingComm,

      realCommission:
        existingComm,

      notes:
        entry.notes ||
        existingPerf?.notes ||
        '',

      updatedBy:
        currentUserId,

      updatedAt:
        serverTimestamp(),

      createdBy:
        existingPerf?.createdBy ||
        currentUserId,

      createdAt:
        existingPerf?.createdAt ||
        serverTimestamp(),
    };

    /* --------------------------------------------------------
       SAVE
       -------------------------------------------------------- */

    await setDoc(
      perfRef,
      payload,
      {
        merge: true,
      }
    );

    /* --------------------------------------------------------
       AUDIT
       -------------------------------------------------------- */

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'INPUT_DATA_OMSET',
      entry.accountName ||
        entry.accountId,
      `Tanggal: ${entry.date}, GMV: Rp ${gmvValue.toLocaleString(
        'id-ID'
      )}, Estimasi Komisi: Rp ${estCommValue.toLocaleString(
        'id-ID'
      )}, Item Sold: ${payload.itemSold}, Impression: ${payload.productImpression}`
    );

    return perfId;
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.CREATE,
      'dailyPerformance'
    );

    throw error;
  }
}

/* ============================================================
   6. DELETE KOMISI REAL + LEGACY TRANSACTIONS
   ============================================================ */

/**
 * Menghapus data performa.
 *
 * Untuk historical data, fungsi ini juga membersihkan
 * transaction lama yang pernah dibuat oleh sistem versi lama.
 *
 * IMPORTANT:
 * Transaksi Komisi Real BARU tidak dibuat lagi.
 */
export async function deleteKomisiRealAtomic(
  performanceId: string,
  desc: string,
  currentUserId: string,
  currentUserName: string
) {
  try {
    const batch =
      writeBatch(db);

    /* --------------------------------------------------------
       PERFORMANCE
       -------------------------------------------------------- */

    const perfRef = doc(
      db,
      'dailyPerformance',
      performanceId
    );

    /* --------------------------------------------------------
       LEGACY DETERMINISTIC TRANSACTION
       -------------------------------------------------------- */

    const txId =
      getTransactionDocId(
        performanceId
      );

    const txRef = doc(
      db,
      'transactions',
      txId
    );

    /* --------------------------------------------------------
       LEGACY TRANSACTION FALLBACK
       --------------------------------------------------------
       
       Cari transaction lama yang menyimpan
       performanceId.
       */

    const q = query(
      collection(
        db,
        'transactions'
      ),
      where(
        'performanceId',
        '==',
        performanceId
      )
    );

    const snap =
      await getDocs(q);

    snap.docs.forEach(
      (transactionDoc) => {
        batch.delete(
          transactionDoc.ref
        );
      }
    );

    /* --------------------------------------------------------
       DELETE PERFORMANCE
       -------------------------------------------------------- */

    batch.delete(
      perfRef
    );

    /* --------------------------------------------------------
       DELETE DETERMINISTIC LEGACY TX & SYNCED TRANSACTIONS
       -------------------------------------------------------- */

    batch.delete(
      txRef
    );

    // Also delete any other linked transactions
    try {
      const qSource = query(
        collection(db, 'transactions'),
        where('sourcePerformanceId', '==', performanceId)
      );
      const snapSource = await getDocs(qSource);
      snapSource.docs.forEach((d) => batch.delete(d.ref));

      const qRef = query(
        collection(db, 'transactions'),
        where('referenceId', '==', performanceId)
      );
      const snapRef = await getDocs(qRef);
      snapRef.docs.forEach((d) => batch.delete(d.ref));
    } catch (qErr) {
      console.warn('Query secondary transactions on delete:', qErr);
    }

    /* --------------------------------------------------------
       COMMIT
       -------------------------------------------------------- */

    await batch.commit();

    /* --------------------------------------------------------
       AUDIT
       -------------------------------------------------------- */

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'DELETE_KOMISI_REAL',
      performanceId,
      `Dihapus beserta transaksi Buku Kas & Bank terkait. Alasan: ${desc}`
    );
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `dailyPerformance/${performanceId}`
    );

    throw error;
  }
}

/* ============================================================
   7. LEGACY ALIAS
   ============================================================ */

/**
 * Dipertahankan agar halaman lama yang masih memanggil
 * hapusPerformaHarian() tetap berjalan.
 */
export async function hapusPerformaHarian(
  id: string,
  desc: string,
  currentUserId: string,
  currentUserName: string
) {
  return deleteKomisiRealAtomic(
    id,
    desc,
    currentUserId,
    currentUserName
  );
}

/**
 * Update full daily performance document directly.
 */
export async function updateDailyPerformanceFull(
  performanceId: string,
  data: Partial<DailyPerformance>,
  currentUserId: string,
  currentUserName: string
) {
  try {
    const perfRef = doc(db, 'dailyPerformance', performanceId);
    const payload: any = {
      ...data,
      updatedBy: currentUserId,
      updatedAt: serverTimestamp(),
    };
    if (data.gmv !== undefined) payload.gmv = Number(data.gmv) || 0;
    if (data.estimatedCommission !== undefined) payload.estimatedCommission = Number(data.estimatedCommission) || 0;
    if (data.commissionReal !== undefined || data.realCommission !== undefined) {
      const comm = Number(data.commissionReal ?? data.realCommission ?? 0);
      payload.commissionReal = comm;
      payload.realCommission = comm;
    }
    if (data.itemSold !== undefined) payload.itemSold = Number(data.itemSold) || 0;
    if (data.productImpression !== undefined) payload.productImpression = Number(data.productImpression) || 0;

    await setDoc(perfRef, payload, { merge: true });

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'UPDATE_DAILY_PERFORMANCE',
      data.accountName || performanceId,
      `Tanggal: ${data.date || '-'}, GMV: Rp ${Number(data.gmv || 0).toLocaleString('id-ID')}, Est Komisi: Rp ${Number(data.estimatedCommission || 0).toLocaleString('id-ID')}, Real Komisi: Rp ${Number(data.commissionReal ?? data.realCommission ?? 0).toLocaleString('id-ID')}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `dailyPerformance/${performanceId}`);
    throw error;
  }
}

/**
 * 8. UPDATE DATA GMV
 * Updates the GMV portions of a performance record while maintaining Komisi Real.
 * If the user changes the account or date, it safely migrates to the new deterministic ID
 * and removes the old doc without creating duplicates or orphaning data.
 */
export async function updateDailyPerformanceGmv(
  originalDocId: string,
  entry: {
    date: string;
    accountId: string;
    accountName: string;
    scope: ScopeType;
    gmv: number;
    estimatedCommission: number;
    itemSold?: number;
    productImpression?: number;
    notes?: string;
  },
  currentUserId: string,
  currentUserName: string
) {
  try {
    if (!entry.accountId || !entry.date) {
      throw new Error('AccountId dan Date wajib diisi.');
    }

    const targetDocId = getPerformanceDocId(entry.accountId, entry.date);
    
    // Read old doc to preserve Komisi Real or creation metadata
    let oldData: any = null;
    const oldRef = doc(db, 'dailyPerformance', originalDocId);
    const oldSnap = await getDoc(oldRef);
    if (oldSnap.exists()) {
      oldData = oldSnap.data();
    }

    // Also read target doc in case it's a different doc
    let targetData: any = null;
    if (originalDocId !== targetDocId) {
      const targetSnap = await getDoc(doc(db, 'dailyPerformance', targetDocId));
      if (targetSnap.exists()) {
        targetData = targetSnap.data();
      }
    }

    const existingComm =
      Number(targetData?.commissionReal ?? targetData?.realCommission) ||
      Number(oldData?.commissionReal ?? oldData?.realCommission) ||
      0;
    
    const existingCommNotes = targetData?.commissionNotes || oldData?.commissionNotes || '';

    const payload = {
      date: entry.date,
      accountId: entry.accountId,
      accountName: entry.accountName,
      scope: entry.scope,
      gmv: Number(entry.gmv) || 0,
      estimatedCommission: Number(entry.estimatedCommission) || 0,
      itemSold: entry.itemSold !== undefined ? Number(entry.itemSold) || 0 : Number(oldData?.itemSold) || 0,
      productImpression: entry.productImpression !== undefined ? Number(entry.productImpression) || 0 : Number(oldData?.productImpression) || 0,
      notes: entry.notes !== undefined ? entry.notes : (oldData?.notes || ''),
      commissionReal: existingComm,
      realCommission: existingComm,
      commissionNotes: existingCommNotes,
      updatedBy: currentUserId,
      updatedAt: serverTimestamp(),
      createdBy: targetData?.createdBy || oldData?.createdBy || currentUserId,
      createdAt: targetData?.createdAt || oldData?.createdAt || serverTimestamp(),
    };

    const targetRef = doc(db, 'dailyPerformance', targetDocId);
    await setDoc(targetRef, payload, { merge: true });

    // Clean up old doc if ID changed
    if (originalDocId && originalDocId !== targetDocId && oldSnap.exists()) {
      await deleteDoc(oldRef);
    }

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'UPDATE_DATA_GMV',
      entry.accountName || entry.accountId,
      `Tanggal: ${entry.date}, GMV: Rp ${(Number(entry.gmv) || 0).toLocaleString('id-ID')}, Est Komisi: Rp ${(Number(entry.estimatedCommission) || 0).toLocaleString('id-ID')}, Item Sold: ${payload.itemSold}, Impression: ${payload.productImpression}`
    );

    return targetDocId;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `dailyPerformance/${originalDocId}`);
    throw error;
  }
}

/**
 * 9. UPDATE KOMISI REAL
 * Updates the Komisi Real portions of a performance record while maintaining GMV data.
 * Does NOT generate financial cash/bank transactions.
 */
export async function updateDailyPerformanceKomisi(
  originalDocId: string,
  entry: {
    date: string;
    accountId: string;
    accountName: string;
    scope: ScopeType;
    commissionReal: number;
    notes?: string;
  },
  currentUserId: string,
  currentUserName: string
) {
  try {
    if (!entry.accountId || !entry.date) {
      throw new Error('AccountId dan Date wajib diisi.');
    }

    const targetDocId = getPerformanceDocId(entry.accountId, entry.date);

    // Read old doc to preserve GMV data
    let oldData: any = null;
    const oldRef = doc(db, 'dailyPerformance', originalDocId);
    const oldSnap = await getDoc(oldRef);
    if (oldSnap.exists()) {
      oldData = oldSnap.data();
    }

    // Also read target doc if different
    let targetData: any = null;
    if (originalDocId !== targetDocId) {
      const targetSnap = await getDoc(doc(db, 'dailyPerformance', targetDocId));
      if (targetSnap.exists()) {
        targetData = targetSnap.data();
      }
    }

    const gmvVal = Number(targetData?.gmv) || Number(oldData?.gmv) || 0;
    const estCommVal = Number(targetData?.estimatedCommission) || Number(oldData?.estimatedCommission) || 0;
    const itemSoldVal = Number(targetData?.itemSold) || Number(oldData?.itemSold) || 0;
    const impressionVal = Number(targetData?.productImpression) || Number(oldData?.productImpression) || 0;
    const gmvNotes = targetData?.notes || oldData?.notes || '';
    const commVal = Number(entry.commissionReal) || 0;

    const payload = {
      date: entry.date,
      accountId: entry.accountId,
      accountName: entry.accountName,
      scope: entry.scope,
      gmv: gmvVal,
      estimatedCommission: estCommVal,
      itemSold: itemSoldVal,
      productImpression: impressionVal,
      notes: gmvNotes,
      commissionReal: commVal,
      realCommission: commVal,
      commissionNotes: entry.notes !== undefined ? entry.notes : (oldData?.commissionNotes || ''),
      updatedBy: currentUserId,
      updatedAt: serverTimestamp(),
      createdBy: targetData?.createdBy || oldData?.createdBy || currentUserId,
      createdAt: targetData?.createdAt || oldData?.createdAt || serverTimestamp(),
    };

    const targetRef = doc(db, 'dailyPerformance', targetDocId);
    await setDoc(targetRef, payload, { merge: true });

    // Clean up old doc & old transaction if ID changed
    if (originalDocId && originalDocId !== targetDocId) {
      if (oldSnap.exists()) {
        await deleteDoc(oldRef);
      }
      try {
        const oldTxRef = doc(db, 'transactions', getTransactionDocId(originalDocId));
        const oldTxSnap = await getDoc(oldTxRef);
        if (oldTxSnap.exists()) {
          await deleteDoc(oldTxRef);
        }
      } catch (txErr) {
        console.warn('Gagal hapus transaksi lama saat update ID performa:', txErr);
      }
    }

    // Auto-sync ke Buku Kas & Bank
    await syncKomisiRealToTransaction(
      {
        id: targetDocId,
        date: entry.date,
        accountId: entry.accountId,
        accountName: entry.accountName,
        scope: entry.scope,
        commissionReal: commVal,
        realCommission: commVal,
        commissionNotes: payload.commissionNotes,
      },
      currentUserId,
      currentUserName
    );

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'UPDATE_KOMISI_REAL',
      entry.accountName || entry.accountId,
      `Tanggal: ${entry.date}, Komisi Real: Rp ${commVal.toLocaleString('id-ID')}, Catatan: ${payload.commissionNotes || '-'} (Tersinkron ke Buku Kas & Bank)`
    );

    return targetDocId;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `dailyPerformance/${originalDocId}`);
    throw error;
  }
}

