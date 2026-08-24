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
  getDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { DailyPerformance, ScopeType } from '../types';
import { catatAuditLog } from './auditService';
import { TRANSACTIONS_COLLECTION } from './transactionService';

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
      // Sort by date desc
      list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      if (callback) callback(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, 'dailyPerformance');
    }
  );
}

// Deterministic ID generator
export function getPerformanceDocId(accountId: string, date: string): string {
  // PERFORMANCE_ACCOUNTID_YYYY-MM-DD
  return `PERFORMANCE_${accountId}_${date}`;
}

export function getTransactionDocId(performanceId: string): string {
  // COMMISSION_REAL_{performanceId}
  return `COMMISSION_REAL_${performanceId}`;
}

// 1. Check duplicate
export async function checkDuplicatePerformance(accountId: string, date: string): Promise<boolean> {
  const docId = getPerformanceDocId(accountId, date);
  const docRef = doc(db, 'dailyPerformance', docId);
  const snap = await getDoc(docRef);
  return snap.exists();
}

// 2. Save (Atomic create/update for both performance and transaction)
export async function saveKomisiReal(
  entry: Partial<Omit<DailyPerformance, 'id' | 'createdAt' | 'updatedAt'>> & {
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
    const batch = writeBatch(db);
    
    if (!entry.accountId || !entry.date) {
      throw new Error('AccountId dan Date wajib diisi.');
    }

    const perfId = getPerformanceDocId(entry.accountId, entry.date);
    const txId = getTransactionDocId(perfId);

    const perfRef = doc(db, 'dailyPerformance', perfId);
    const txRef = doc(db, TRANSACTIONS_COLLECTION, txId);

    const perfSnap = await getDoc(perfRef);
    const existingPerf = perfSnap.exists() ? perfSnap.data() : null;

    // Check commission value
    let commissionValue: number;
    if (entry.commissionReal !== undefined || entry.realCommission !== undefined) {
      commissionValue = Number(entry.commissionReal) || Number(entry.realCommission) || 0;
    } else {
      commissionValue = Number(existingPerf?.commissionReal) || Number(existingPerf?.realCommission) || 0;
    }

    // Check GMV & Estimated Commission (preserve existing if not provided)
    const gmvValue = entry.gmv !== undefined 
      ? (Number(entry.gmv) || 0) 
      : (Number(existingPerf?.gmv) || 0);

    const estCommValue = entry.estimatedCommission !== undefined 
      ? (Number(entry.estimatedCommission) || 0) 
      : (Number(existingPerf?.estimatedCommission) || 0);

    // Item Sold & Product Impression belong to the "Data GMV" tab. Saving Komisi
    // Real must never clear them, so they are preserved from the existing record
    // unless explicitly provided.
    const itemSoldValue = entry.itemSold !== undefined
      ? (Number(entry.itemSold) || 0)
      : (Number(existingPerf?.itemSold) || 0);

    const productImpressionValue = entry.productImpression !== undefined
      ? (Number(entry.productImpression) || 0)
      : (Number(existingPerf?.productImpression) || 0);

    // Explicit field whitelist — never spread the raw caller payload into Firestore.
    const perfData = {
      date: entry.date,
      accountId: entry.accountId,
      accountName: entry.accountName ?? existingPerf?.accountName ?? '',
      scope: entry.scope ?? existingPerf?.scope ?? 'SHARING',
      notes: existingPerf?.notes ?? '',
      commissionNotes: entry.commissionNotes ?? existingPerf?.commissionNotes ?? '',
      gmv: gmvValue,
      estimatedCommission: estCommValue,
      itemSold: itemSoldValue,
      productImpression: productImpressionValue,
      commissionReal: commissionValue,
      realCommission: commissionValue, // Legacy fallback
      updatedBy: currentUserId,
      updatedAt: serverTimestamp(),
    };

    // Use setDoc with merge for both
    batch.set(perfRef, {
      ...perfData,
      createdBy: existingPerf?.createdBy || currentUserId,
      createdAt: existingPerf?.createdAt || serverTimestamp(),
    }, { merge: true });

    if (commissionValue > 0) {
      batch.set(txRef, {
        type: 'INCOME',
        scope: entry.scope,
        amount: commissionValue,
        date: entry.date,
        category: 'KOMISI TIKTOK',
        sourceType: 'COMMISSION_REAL',
        accountName: entry.accountName,
        accountId: entry.accountId,
        description: `Komisi Real ${entry.accountName || 'Akun'} (${entry.date})`,
        performanceId: perfId,
        referenceId: perfId,
        status: 'ACTIVE',
        updatedBy: currentUserId,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } else if (entry.commissionReal !== undefined || entry.realCommission !== undefined) {
      // If commission is explicitly set to 0, delete the transaction if it exists
      batch.delete(txRef);
    }

    await batch.commit();

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'INPUT_KOMISI_REAL',
      entry.accountName || entry.accountId,
      `Tanggal: ${entry.date}, GMV: Rp ${gmvValue.toLocaleString('id-ID')}, Estimasi Komisi: Rp ${estCommValue.toLocaleString('id-ID')}, Komisi Real: Rp ${commissionValue.toLocaleString('id-ID')}`
    );

    return perfId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'dailyPerformance');
    throw error;
  }
}

// 3. Save Data Omset (GMV & Estimasi Komisi only)
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
    if (!entry.accountId || !entry.date) {
      throw new Error('AccountId dan Date wajib diisi.');
    }

    const perfId = getPerformanceDocId(entry.accountId, entry.date);
    const perfRef = doc(db, 'dailyPerformance', perfId);

    const perfSnap = await getDoc(perfRef);
    const existingPerf = perfSnap.exists() ? perfSnap.data() : null;

    const gmvValue = Number(entry.gmv) || 0;
    const estCommValue = Number(entry.estimatedCommission) || 0;
    const existingComm = Number(existingPerf?.commissionReal) || Number(existingPerf?.realCommission) || 0;

    const payload = {
      date: entry.date,
      accountId: entry.accountId,
      accountName: entry.accountName,
      scope: entry.scope,
      gmv: gmvValue,
      estimatedCommission: estCommValue,
      itemSold: entry.itemSold !== undefined
        ? (Number(entry.itemSold) || 0)
        : (Number(existingPerf?.itemSold) || 0),
      productImpression: entry.productImpression !== undefined
        ? (Number(entry.productImpression) || 0)
        : (Number(existingPerf?.productImpression) || 0),
      // Komisi Real is owned by the other tab — carry the stored value forward.
      commissionReal: existingComm,
      realCommission: existingComm,
      notes: entry.notes || existingPerf?.notes || '',
      updatedBy: currentUserId,
      updatedAt: serverTimestamp(),
      createdBy: existingPerf?.createdBy || currentUserId,
      createdAt: existingPerf?.createdAt || serverTimestamp(),
    };

    await setDoc(perfRef, payload, { merge: true });

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'INPUT_DATA_OMSET',
      entry.accountName || entry.accountId,
      `Tanggal: ${entry.date}, GMV: Rp ${gmvValue.toLocaleString('id-ID')}, Estimasi Komisi: Rp ${estCommValue.toLocaleString('id-ID')}, Item Sold: ${payload.itemSold}, Impression: ${payload.productImpression}`
    );

    return perfId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'dailyPerformance');
    throw error;
  }
}

export async function deleteKomisiRealAtomic(
  performanceId: string,
  desc: string,
  currentUserId: string,
  currentUserName: string
) {
  try {
    const batch = writeBatch(db);
    const perfRef = doc(db, 'dailyPerformance', performanceId);
    const txId = getTransactionDocId(performanceId);
    const txRef = doc(db, TRANSACTIONS_COLLECTION, txId);
    
    // Fallback: Delete both the deterministic tx and any transactions matching this performanceId 
    // just in case they were created before deterministic IDs.
    const q = query(collection(db, TRANSACTIONS_COLLECTION), where('performanceId', '==', performanceId));
    const snap = await getDocs(q);
    snap.docs.forEach(d => {
      batch.delete(d.ref);
    });

    batch.delete(perfRef);
    batch.delete(txRef);

    await batch.commit();

    await catatAuditLog(
      currentUserId, 
      currentUserName, 
      'DELETE_KOMISI_REAL', 
      performanceId, 
      `Dihapus beserta transaksinya. Alasan: ${desc}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `dailyPerformance/${performanceId}`);
    throw error;
  }
}

// Fallback legacy method
export async function hapusPerformaHarian(
  id: string,
  desc: string,
  currentUserId: string,
  currentUserName: string
) {
  return deleteKomisiRealAtomic(id, desc, currentUserId, currentUserName);
}
