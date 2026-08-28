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
 * IMPORTANT:
 * Komisi Real TIDAK dibuat sebagai transaksi Kas & Bank.
 *
 * Komisi Real baru menjadi uang rekening aktual setelah:
 *
 * Komisi Real
 *      ↓
 * Pindah Dana
 *      ↓
 * transactions / Kas & Bank
 *
 * Dengan demikian:
 *
 * Dashboard Akun ≠ Saldo Bank
 *
 * Saldo Bank hanya berasal dari transaksi Kas & Bank aktual.
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
 * Legacy transaction ID.
 *
 * Fungsi ini tetap dipertahankan untuk kompatibilitas
 * dengan data lama dan proses cleanup historical transaction.
 *
 * IMPORTANT:
 * Fungsi ini TIDAK lagi dipakai ketika menyimpan Komisi Real baru.
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
   4. SAVE KOMISI REAL
   ============================================================ */

/**
 * Menyimpan Komisi Real ke dailyPerformance.
 *
 * IMPORTANT:
 * Fungsi ini TIDAK membuat transaksi ke collection
 * `transactions`.
 *
 * Alasannya:
 *
 * Komisi Real = data performa akun.
 *
 * Komisi Real belum tentu berarti uang sudah masuk rekening
 * perusahaan.
 *
 * Uang rekening baru dicatat melalui Pindah Dana.
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

      /**
       * Dua field ini sengaja tetap disimpan.
       *
       * commissionReal = field utama
       * realCommission = legacy compatibility
       */
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
       SIMPAN DAILY PERFORMANCE SAJA
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
      )}`
    );

    /**
     * Return performance document ID.
     *
     * Tidak ada transaction ID karena Komisi Real
     * sekarang bukan transaksi Kas & Bank.
     */
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
       DELETE DETERMINISTIC LEGACY TX
       -------------------------------------------------------- */

    batch.delete(
      txRef
    );

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
      `Dihapus beserta transaksi legacy. Alasan: ${desc}`
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

    // Clean up old doc if ID changed
    if (originalDocId && originalDocId !== targetDocId && oldSnap.exists()) {
      await deleteDoc(oldRef);
    }

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'UPDATE_KOMISI_REAL',
      entry.accountName || entry.accountId,
      `Tanggal: ${entry.date}, Komisi Real: Rp ${commVal.toLocaleString('id-ID')}, Catatan: ${payload.commissionNotes || '-'}`
    );

    return targetDocId;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `dailyPerformance/${originalDocId}`);
    throw error;
  }
}

