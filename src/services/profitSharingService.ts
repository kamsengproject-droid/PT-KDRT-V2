import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  getDoc,
  setDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../firebase';
import {
  ProfitSharingTier,
  DEFAULT_PROFIT_SHARING_TIERS,
  ProfitSharingSettlement,
  SettlementStatus,
  InvestorWithdrawal,
  FinancialTransaction,
} from '../types';
import {
  createFinancialTransaction,
  deleteTransaction,
  checkDuplicateTransaction,
} from './transactionService';
import { catatAuditLog } from './auditService';
import { compressImageFile } from '../utils/imageCompressor';
import { formatBulanTahun, tanggalHariIni } from '../utils/formatters';

export const PROFIT_SHARING_TIERS_COLLECTION = 'profitSharingTiers';
export const PROFIT_SHARING_SETTLEMENTS_COLLECTION = 'profitSharingSettlements';
export const WITHDRAWALS_COLLECTION = 'withdrawals';

// ==========================================
// 1. TIER CONFIGURATIONS
// ==========================================

export function subscribeProfitSharingTiers(
  callback: (tiers: ProfitSharingTier[]) => void
) {
  const q = query(
    collection(db, PROFIT_SHARING_TIERS_COLLECTION),
    orderBy('minIncome', 'asc')
  );

  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        // Return default tiers if none in Firestore
        callback(DEFAULT_PROFIT_SHARING_TIERS);
      } else {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as ProfitSharingTier[];
        callback(list);
      }
    },
    (error) => {
      console.warn('Error subscribing profit sharing tiers:', error);
      callback(DEFAULT_PROFIT_SHARING_TIERS);
    }
  );
}

export async function saveProfitSharingTier(
  tierData: Partial<ProfitSharingTier>,
  userProfile: { uid: string; name: string }
): Promise<void> {
  try {
    const total =
      (Number(tierData.investorPercentage) || 0) +
      (Number(tierData.ownerPercentage) || 0) +
      (Number(tierData.talentPercentage) || 0) +
      (Number(tierData.editorPercentage) || 0) +
      (Number(tierData.companyBudgetPercentage) || 0);

    const dataToSave = {
      name: tierData.name || 'Tier Kustom',
      minIncome: Number(tierData.minIncome) || 0,
      maxIncome:
        tierData.maxIncome !== undefined &&
        tierData.maxIncome !== null &&
        !isNaN(Number(tierData.maxIncome))
          ? Number(tierData.maxIncome)
          : null,
      investorPercentage: Number(tierData.investorPercentage) || 0,
      ownerPercentage: Number(tierData.ownerPercentage) || 0,
      talentPercentage: Number(tierData.talentPercentage) || 0,
      editorPercentage: Number(tierData.editorPercentage) || 0,
      companyBudgetPercentage: Number(tierData.companyBudgetPercentage) || 0,
      description: tierData.description || '',
      isActive: tierData.isActive ?? true,
      updatedAt: serverTimestamp(),
      updatedBy: userProfile.uid,
    };

    if (tierData.id) {
      const docRef = doc(db, PROFIT_SHARING_TIERS_COLLECTION, tierData.id);
      await updateDoc(docRef, dataToSave);
    } else {
      await addDoc(collection(db, PROFIT_SHARING_TIERS_COLLECTION), {
        ...dataToSave,
        createdAt: serverTimestamp(),
      });
    }

    await catatAuditLog(
      userProfile.uid,
      userProfile.name,
      'PROFIT_SHARING_TIER_UPDATED',
      'profitSharingTiers',
      `Menyimpan tier "${tierData.name}" (Total: ${total}%)`,
      null,
      dataToSave
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'profitSharingTiers');
    throw error;
  }
}

export async function resetProfitSharingTiersToDefault(
  userProfile: { uid: string; name: string }
): Promise<void> {
  try {
    // Delete existing custom docs if any
    const snap = await getDocs(collection(db, PROFIT_SHARING_TIERS_COLLECTION));
    for (const d of snap.docs) {
      await updateDoc(doc(db, PROFIT_SHARING_TIERS_COLLECTION, d.id), {
        isActive: false,
      });
    }

    // Insert defaults
    for (const tier of DEFAULT_PROFIT_SHARING_TIERS) {
      await addDoc(collection(db, PROFIT_SHARING_TIERS_COLLECTION), {
        ...tier,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: userProfile.uid,
      });
    }

    await catatAuditLog(
      userProfile.uid,
      userProfile.name,
      'PROFIT_SHARING_TIERS_RESET',
      'profitSharingTiers',
      'Mereset konfigurasi tier profit sharing ke aturan default'
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'profitSharingTiers');
    throw error;
  }
}

// ==========================================
// 2. CALCULATION ENGINE (SINGLE SOURCE OF TRUTH)
// ==========================================

export interface ProfitSharingCalculationResult {
  year: number;
  month: string;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  
  // Kas Nyata dari Transactions
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  
  // Tier & Formula
  activeTier: ProfitSharingTier;
  investorPercentage: number;
  ownerPercentage: number;
  talentPercentage: number;
  editorPercentage: number;
  companyBudgetPercentage: number;
  totalPercentage: number;
  isFormulaValid: boolean;
  formulaWarning?: string;
  
  // Nominal (Rupiah)
  investorAmount: number;
  ownerAmount: number;
  talentAmount: number;
  editorAmount: number;
  companyBudgetAmount: number;
}

export async function calculateProfitSharingFromTransactions(
  year: number,
  month: string, // '01' - '12'
  customTiers?: ProfitSharingTier[],
  customOverrides?: {
    investorPercentage?: number;
    ownerPercentage?: number;
    talentPercentage?: number;
    editorPercentage?: number;
    companyBudgetPercentage?: number;
  }
): Promise<ProfitSharingCalculationResult> {
  const monthStr = month.padStart(2, '0');
  const periodPrefix = `${year}-${monthStr}`;
  const periodStart = `${periodPrefix}-01`;
  
  // Get last day of month
  const lastDayNumber = new Date(year, parseInt(monthStr, 10), 0).getDate();
  const periodEnd = `${periodPrefix}-${String(lastDayNumber).padStart(2, '0')}`;
  const periodLabel = formatBulanTahun(periodPrefix);

  // 1. Fetch transactions where scope == 'SHARING' and status == 'ACTIVE'
  const q = query(
    collection(db, 'transactions'),
    where('scope', '==', 'SHARING')
  );
  const snap = await getDocs(q);

  let totalIncome = 0;
  let totalExpense = 0;

  snap.forEach((docSnap) => {
    const data = docSnap.data() as FinancialTransaction;
    // Client-side filter for ACTIVE status to handle legacy documents without status field
    if ((data.status || 'ACTIVE') !== 'ACTIVE') return;
    
    if (data.date && data.date.startsWith(periodPrefix)) {
      if (data.type === 'INCOME') {
        totalIncome += Number(data.amount) || 0;
      } else if (data.type === 'EXPENSE') {
        totalExpense += Number(data.amount) || 0;
      }
    }
  });

  const netProfit = totalIncome - totalExpense;

  // 2. Determine Tier based on totalIncome (Uang Masuk Sharing Nyata)
  const tiers = customTiers && customTiers.length > 0 ? customTiers : DEFAULT_PROFIT_SHARING_TIERS;
  
  // Find matching active tier
  let activeTier = tiers.find(
    (t) =>
      t.isActive !== false &&
      totalIncome >= t.minIncome &&
      (t.maxIncome === null || t.maxIncome === undefined || totalIncome <= t.maxIncome)
  );

  if (!activeTier) {
    // Fallback: match highest minIncome <= totalIncome or first tier
    const sorted = [...tiers].sort((a, b) => b.minIncome - a.minIncome);
    activeTier = sorted.find((t) => totalIncome >= t.minIncome) || tiers[0];
  }

  // 3. Extract or override percentages
  const investorPercentage =
    customOverrides?.investorPercentage !== undefined
      ? Number(customOverrides.investorPercentage)
      : activeTier.investorPercentage;

  const ownerPercentage =
    customOverrides?.ownerPercentage !== undefined
      ? Number(customOverrides.ownerPercentage)
      : activeTier.ownerPercentage;

  const talentPercentage =
    customOverrides?.talentPercentage !== undefined
      ? Number(customOverrides.talentPercentage)
      : activeTier.talentPercentage;

  const editorPercentage =
    customOverrides?.editorPercentage !== undefined
      ? Number(customOverrides.editorPercentage)
      : activeTier.editorPercentage;

  const companyBudgetPercentage =
    customOverrides?.companyBudgetPercentage !== undefined
      ? Number(customOverrides.companyBudgetPercentage)
      : activeTier.companyBudgetPercentage;

  const totalPercentage =
    investorPercentage +
    ownerPercentage +
    talentPercentage +
    editorPercentage +
    companyBudgetPercentage;

  const isFormulaValid = totalPercentage === 100;
  let formulaWarning: string | undefined;

  if (!isFormulaValid) {
    formulaWarning = `Persentase profit sharing tidak sama dengan 100% (${totalPercentage}%). Owner harus menyesuaikan konfigurasi persentase sebelum settlement dapat disetujui (APPROVED).`;
  }

  // 4. Calculate Nominal Amounts from Net Profit / Arus Kas Bersih (NET)
  // Basis pembagian WAJIB Arus Kas Bersih (Net) = totalIncome - totalExpense (Bukan Uang Masuk langsung, bukan GMV/Estimasi)
  let investorAmount = Math.round((Number(netProfit) * investorPercentage) / 100);
  let ownerAmount = Math.round((Number(netProfit) * ownerPercentage) / 100);
  let talentAmount = Math.round((Number(netProfit) * talentPercentage) / 100);
  let editorAmount = Math.round((Number(netProfit) * editorPercentage) / 100);
  let companyBudgetAmount = Math.round((Number(netProfit) * companyBudgetPercentage) / 100);

  // Validasi Total & Penyesuaian Selisih Pembulatan Rupiah secara Deterministic
  // TOTAL ALOKASI HARUS SAMA PERSIS DENGAN PROFIT BERSIH (NET PROFIT)
  if (isFormulaValid) {
    const sumAllocations =
      investorAmount + ownerAmount + talentAmount + editorAmount + companyBudgetAmount;
    const diff = Number(netProfit) - sumAllocations;

    if (diff !== 0) {
      if (companyBudgetPercentage > 0) {
        companyBudgetAmount += diff;
      } else if (ownerPercentage > 0) {
        ownerAmount += diff;
      } else if (investorPercentage > 0) {
        investorAmount += diff;
      }
    }
  }

  return {
    year,
    month: monthStr,
    periodStart,
    periodEnd,
    periodLabel,
    totalIncome,
    totalExpense,
    netProfit,
    activeTier,
    investorPercentage,
    ownerPercentage,
    talentPercentage,
    editorPercentage,
    companyBudgetPercentage,
    totalPercentage,
    isFormulaValid,
    formulaWarning,
    investorAmount,
    ownerAmount,
    talentAmount,
    editorAmount,
    companyBudgetAmount,
  };
}

// ==========================================
// 3. SETTLEMENT MANAGEMENT
// ==========================================

export function subscribeProfitSharingSettlements(
  callback: (settlements: ProfitSharingSettlement[]) => void
) {
  const q = query(
    collection(db, PROFIT_SHARING_SETTLEMENTS_COLLECTION),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as ProfitSharingSettlement[];
      callback(list);
    },
    (error) => {
      console.warn('Error subscribing settlements:', error);
      callback([]);
    }
  );
}

export async function getActiveSettlementForMonth(
  year: number,
  month: string
): Promise<ProfitSharingSettlement | null> {
  const monthStr = month.padStart(2, '0');
  const settlementKey = `${year}_${monthStr}_SHARING`;

  try {
    const q = query(
      collection(db, PROFIT_SHARING_SETTLEMENTS_COLLECTION),
      where('settlementId', '==', settlementKey)
    );
    const snap = await getDocs(q);

    // Filter out VOID settlements if looking for active one
    const activeDoc = snap.docs.find((d) => {
      const data = d.data() as ProfitSharingSettlement;
      return data.status !== 'VOID';
    });

    if (activeDoc) {
      return { id: activeDoc.id, ...activeDoc.data() } as ProfitSharingSettlement;
    }
    return null;
  } catch (error) {
    console.warn('Error fetching settlement for month:', error);
    return null;
  }
}

export async function saveDraftOrReviewSettlement(
  calculation: ProfitSharingCalculationResult,
  extra: {
    status: 'DRAFT' | 'REVIEW';
    statusNotes?: string;
    talentEmployeeId?: string;
    talentEmployeeName?: string;
    editorEmployeeId?: string;
    editorEmployeeName?: string;
  },
  userProfile: { uid: string; name: string }
): Promise<string> {
  try {
    const settlementKey = `${calculation.year}_${calculation.month}_SHARING`;

    // Check if an existing settlement exists for this period
    const existing = await getActiveSettlementForMonth(calculation.year, calculation.month);

    if (existing && existing.status === 'APPROVED') {
      throw new Error(
        `Settlement untuk periode ${calculation.periodLabel} sudah berstatus APPROVED. Harap batalkan (VOID) terlebih dahulu jika ingin membuat settlement baru.`
      );
    }
    if (existing && (existing.status === 'PAID' || existing.status === 'PARTIALLY_PAID')) {
      throw new Error(
        `Settlement untuk periode ${calculation.periodLabel} sudah memiliki riwayat pembayaran investor. Tidak dapat diubah kembali ke DRAFT.`
      );
    }

    const payload: Omit<ProfitSharingSettlement, 'id'> = {
      settlementId: settlementKey,
      periodStart: calculation.periodStart,
      periodEnd: calculation.periodEnd,
      year: calculation.year,
      month: calculation.month,
      periodLabel: calculation.periodLabel,
      scope: 'SHARING',

      totalIncome: calculation.totalIncome,
      totalExpense: calculation.totalExpense,
      netProfit: calculation.netProfit,
      calculationBasis: 'NET_PROFIT',

      activeTierId: calculation.activeTier.tierId || calculation.activeTier.id,
      activeTierName: calculation.activeTier.name,
      investorPercentage: calculation.investorPercentage,
      ownerPercentage: calculation.ownerPercentage,
      talentPercentage: calculation.talentPercentage,
      editorPercentage: calculation.editorPercentage,
      companyBudgetPercentage: calculation.companyBudgetPercentage,
      totalPercentage: calculation.totalPercentage,
      isFormulaValid: calculation.isFormulaValid,
      formulaWarning: calculation.formulaWarning || '',

      investorAmount: calculation.investorAmount,
      ownerAmount: calculation.ownerAmount,
      talentAmount: calculation.talentAmount,
      editorAmount: calculation.editorAmount,
      companyBudgetAmount: calculation.companyBudgetAmount,

      talentEmployeeId: extra.talentEmployeeId || '',
      talentEmployeeName: extra.talentEmployeeName || '',
      editorEmployeeId: extra.editorEmployeeId || '',
      editorEmployeeName: extra.editorEmployeeName || '',

      totalPaidToInvestor: existing?.totalPaidToInvestor || 0,
      remainingInvestorObligation:
        calculation.investorAmount - (existing?.totalPaidToInvestor || 0),
      isAccrued: true,

      status: extra.status,
      statusNotes: extra.statusNotes || '',

      createdBy: existing?.createdBy || userProfile.uid,
      createdByName: existing?.createdByName || userProfile.name,
      createdAt: existing?.createdAt || serverTimestamp(),
      reviewedBy: extra.status === 'REVIEW' ? userProfile.uid : existing?.reviewedBy || null,
      reviewedByName: extra.status === 'REVIEW' ? userProfile.name : existing?.reviewedByName || null,
      reviewedAt: extra.status === 'REVIEW' ? serverTimestamp() : existing?.reviewedAt || null,
      updatedAt: serverTimestamp(),
      updatedBy: userProfile.uid,
      updatedByName: userProfile.name,
    };

    let savedId: string;
    if (existing && existing.id) {
      await updateDoc(doc(db, PROFIT_SHARING_SETTLEMENTS_COLLECTION, existing.id), payload);
      savedId = existing.id;
    } else {
      const docRef = await addDoc(
        collection(db, PROFIT_SHARING_SETTLEMENTS_COLLECTION),
        payload
      );
      savedId = docRef.id;
    }

    await catatAuditLog(
      userProfile.uid,
      userProfile.name,
      extra.status === 'REVIEW' ? 'PROFIT_SHARING_REVIEWED' : 'PROFIT_SHARING_CALCULATED',
      'profitSharingSettlements',
      `Menyimpan settlement ${calculation.periodLabel} (Status: ${extra.status}, Uang Masuk: Rp${calculation.totalIncome.toLocaleString('id-ID')})`,
      existing,
      payload
    );

    return savedId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'profitSharingSettlements');
    throw error;
  }
}

export async function approveSettlement(
  settlementDocId: string,
  userProfile: { uid: string; name: string }
): Promise<void> {
  try {
    const docRef = doc(db, PROFIT_SHARING_SETTLEMENTS_COLLECTION, settlementDocId);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      throw new Error('Data settlement tidak ditemukan.');
    }

    const data = snap.data() as ProfitSharingSettlement;

    // MANDATORY VALIDATION: Total percentage MUST equal 100%
    if (data.totalPercentage !== 100 || !data.isFormulaValid) {
      throw new Error(
        `Settlement TIDAK DAPAT DISETUJUI karena total persentase formula adalah ${data.totalPercentage}% (tidak sama dengan 100%). Owner harus menyesuaikan konfigurasi terlebih dahulu.`
      );
    }

    const updatePayload = {
      status: 'APPROVED' as SettlementStatus,
      approvedBy: userProfile.uid,
      approvedByName: userProfile.name,
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: userProfile.uid,
      updatedByName: userProfile.name,
    };

    await updateDoc(docRef, updatePayload);

    await catatAuditLog(
      userProfile.uid,
      userProfile.name,
      'PROFIT_SHARING_APPROVED',
      'profitSharingSettlements',
      `Menyetujui (APPROVED) settlement ${data.periodLabel}. Hak Investor: Rp${data.investorAmount.toLocaleString('id-ID')} (Tercatat sebagai Kewajiban/Accrued).`,
      { status: data.status },
      updatePayload
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'profitSharingSettlements');
    throw error;
  }
}

export async function voidSettlement(
  settlementDocId: string,
  voidReason: string,
  userProfile: { uid: string; name: string }
): Promise<void> {
  if (!voidReason || voidReason.trim().length < 5) {
    throw new Error('Alasan pembatalan (VOID) settlement wajib diisi minimal 5 karakter.');
  }

  try {
    const docRef = doc(db, PROFIT_SHARING_SETTLEMENTS_COLLECTION, settlementDocId);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      throw new Error('Data settlement tidak ditemukan.');
    }

    const data = snap.data() as ProfitSharingSettlement;

    if (data.totalPaidToInvestor > 0) {
      throw new Error(
        `Settlement ${data.periodLabel} tidak dapat di-VOID langsung karena telah memiliki riwayat pembayaran investor senilai Rp${data.totalPaidToInvestor.toLocaleString('id-ID')}. Batalkan (VOID) semua penarikan investor terlebih dahulu.`
      );
    }

    const updatePayload = {
      status: 'VOID' as SettlementStatus,
      voidReason,
      updatedAt: serverTimestamp(),
      updatedBy: userProfile.uid,
      updatedByName: userProfile.name,
    };

    await updateDoc(docRef, updatePayload);

    await catatAuditLog(
      userProfile.uid,
      userProfile.name,
      'PROFIT_SHARING_VOIDED',
      'profitSharingSettlements',
      `Membatalkan (VOID) settlement ${data.periodLabel}. Alasan: ${voidReason}`,
      { status: data.status },
      updatePayload
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'profitSharingSettlements');
    throw error;
  }
}

// ==========================================
// 4. WITHDRAWAL & CASHFLOW INTEGRATION (PHASE 3D MASTER)
// ==========================================

export async function uploadWithdrawalReceipt(
  file: File
): Promise<{ downloadUrl: string; storagePath: string }> {
  try {
    const compressed = await compressImageFile(file, 1200, 1200, 0.85);
    const fileName = `withdrawal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
    const storagePath = `withdrawals/${fileName}`;
    const storageRef = ref(storage, storagePath);

    const snapshot = await uploadBytes(storageRef, compressed.blob, {
      contentType: compressed.mimeType,
      customMetadata: {
        originalName: file.name,
        compressed: 'true',
      },
    });

    const downloadUrl = await getDownloadURL(snapshot.ref);
    return { downloadUrl, storagePath };
  } catch (error) {
    console.error('Gagal upload bukti transfer withdrawal:', error);
    throw new Error('Gagal mengunggah foto bukti transfer penarikan investor.');
  }
}

export function subscribeWithdrawals(
  callback: (withdrawals: InvestorWithdrawal[]) => void,
  settlementId?: string
) {
  let q = query(
    collection(db, WITHDRAWALS_COLLECTION),
    orderBy('date', 'desc')
  );

  return onSnapshot(
    q,
    (snap) => {
      let list = snap.docs.map((d) => ({
        id: d.id,
        withdrawalId: d.id,
        ...d.data(),
      })) as InvestorWithdrawal[];

      if (settlementId) {
        list = list.filter((w) => w.settlementId === settlementId);
      }
      callback(list);
    },
    (error) => {
      console.warn('Error subscribing withdrawals:', error);
      callback([]);
    }
  );
}

export async function recordInvestorWithdrawal(
  data: {
    settlementDocId: string;
    investorName: string;
    date: string; // YYYY-MM-DD
    amount: number; // Nominal
    paymentMethod: 'TRANSFER' | 'CASH' | 'EWALLET' | 'LAINNYA';
    bankAccount?: string;
    notes?: string;
    receiptUrl?: string;
    receiptStoragePath?: string;
  },
  userProfile: { uid: string; name: string }
): Promise<string> {
  try {
    if (!data.amount || data.amount <= 0) {
      throw new Error('Nominal penarikan/pembayaran investor harus lebih besar dari 0.');
    }

    // 1. Fetch Settlement
    const settlementRef = doc(db, PROFIT_SHARING_SETTLEMENTS_COLLECTION, data.settlementDocId);
    const setSnap = await getDoc(settlementRef);
    if (!setSnap.exists()) {
      throw new Error('Data settlement bagi hasil tidak ditemukan.');
    }

    const settlement = setSnap.data() as ProfitSharingSettlement;
    if (settlement.status !== 'APPROVED' && settlement.status !== 'PARTIALLY_PAID') {
      throw new Error(
        `Pembayaran hanya dapat diproses untuk settlement yang berstatus APPROVED atau PARTIALLY_PAID (Status saat ini: ${settlement.status}).`
      );
    }

    const remaining = settlement.remainingInvestorObligation ?? settlement.investorAmount;
    if (data.amount > remaining) {
      throw new Error(
        `Nominal penarikan (Rp${data.amount.toLocaleString('id-ID')}) melebihi sisa kewajiban hak investor (Rp${remaining.toLocaleString('id-ID')}).`
      );
    }

    // 2. Generate new Withdrawal Document ID
    const newWithdrawalRef = doc(collection(db, WITHDRAWALS_COLLECTION));
    const withdrawalId = newWithdrawalRef.id;

    // 3. Anti-Double-Payment check in Master Transactions
    const dupCheck = await checkDuplicateTransaction('PROFIT_SHARING', withdrawalId);
    if (dupCheck.isDuplicate) {
      throw new Error('Transaksi pengeluaran untuk pembayaran ini sudah tercatat di Buku Kas Master.');
    }

    // 4. Create Master Cashflow Expense (Transactions Collection - Phase 3D)
    // REAL CASHFLOW INTEGRATION: Money actually leaves cash/bank only now!
    const txResult = await createFinancialTransaction(
      {
        type: 'EXPENSE',
        amount: data.amount,
        date: data.date || tanggalHariIni(),
        category: 'BAGI HASIL',
        scope: 'SHARING',
        sourceType: 'PROFIT_SHARING',
        referenceId: withdrawalId,
        profitSharingSettlementId: data.settlementDocId,
        paymentMethod: data.paymentMethod,
        description: `Bagi Hasil Investor (${data.investorName}) - Periode ${settlement.periodLabel}`,
        notes: data.notes || `Pembayaran hak investor settlement ${settlement.periodLabel}`,
        attachmentUrl: data.receiptUrl,
        attachmentStoragePath: data.receiptStoragePath,
        createdBy: userProfile.uid,
        createdByName: userProfile.name,
      },
      userProfile.uid,
      userProfile.name
    );

    const transactionId = txResult.id || '';

    // 5. Save Withdrawal Document
    const withdrawalDocData: InvestorWithdrawal = {
      id: withdrawalId,
      withdrawalId,
      settlementId: data.settlementDocId,
      periodLabel: settlement.periodLabel,
      scope: 'SHARING',
      investorName: data.investorName || 'Investor PT.KDRT',
      date: data.date,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      bankAccount: data.bankAccount || '',
      notes: data.notes || '',
      receiptUrl: data.receiptUrl || '',
      receiptStoragePath: data.receiptStoragePath || '',
      transactionId,
      isExpenseRecorded: true,
      expenseRecordedAt: serverTimestamp(),
      status: 'PAID',
      createdBy: userProfile.uid,
      createdByName: userProfile.name,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(newWithdrawalRef, withdrawalDocData);

    // 6. Update Settlement Totals and Status
    const newTotalPaid = (settlement.totalPaidToInvestor || 0) + data.amount;
    const newRemaining = settlement.investorAmount - newTotalPaid;
    const newStatus: SettlementStatus = newRemaining <= 0 ? 'PAID' : 'PARTIALLY_PAID';

    await updateDoc(settlementRef, {
      totalPaidToInvestor: newTotalPaid,
      remainingInvestorObligation: Math.max(0, newRemaining),
      status: newStatus,
      paidAt: newStatus === 'PAID' ? serverTimestamp() : settlement.paidAt || null,
      updatedAt: serverTimestamp(),
      updatedBy: userProfile.uid,
      updatedByName: userProfile.name,
    });

    // 7. Audit Log
    await catatAuditLog(
      userProfile.uid,
      userProfile.name,
      'INVESTOR_WITHDRAWAL_PAID',
      'withdrawals',
      `Mencatat pembayaran bagi hasil investor ${data.investorName} senilai Rp${data.amount.toLocaleString('id-ID')} (${settlement.periodLabel}). Transaksi Kas ID: ${transactionId}`,
      null,
      withdrawalDocData
    );

    return withdrawalId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'withdrawals');
    throw error;
  }
}

export async function voidInvestorWithdrawal(
  withdrawalDocId: string,
  voidReason: string,
  userProfile: { uid: string; name: string }
): Promise<void> {
  if (!voidReason || voidReason.trim().length < 5) {
    throw new Error('Alasan pembatalan (VOID) penarikan investor wajib diisi minimal 5 karakter.');
  }

  try {
    const withRef = doc(db, WITHDRAWALS_COLLECTION, withdrawalDocId);
    const snap = await getDoc(withRef);
    if (!snap.exists()) {
      throw new Error('Data penarikan investor tidak ditemukan.');
    }

    const withData = snap.data() as InvestorWithdrawal;
    if (withData.status === 'VOID') {
      throw new Error('Penarikan ini sudah dibatalkan sebelumnya.');
    }

    // 1. VOID the corresponding cash transaction in 'transactions'
    if (withData.transactionId) {
      await deleteTransaction(
        withData.transactionId,
        {
          type: 'EXPENSE',
          amount: withData.amount,
          category: 'BAGI HASIL',
          scope: 'SHARING',
          date: withData.date,
        } as FinancialTransaction,
        `Pembatalan penarikan investor: ${voidReason}`,
        userProfile.uid,
        userProfile.name
      );
    }

    // 2. Mark withdrawal as VOID
    await updateDoc(withRef, {
      status: 'VOID' as any,
      voidReason,
      voidedBy: userProfile.uid,
      voidedByName: userProfile.name,
      voidedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 3. Recalculate Settlement
    if (withData.settlementId) {
      const setRef = doc(db, PROFIT_SHARING_SETTLEMENTS_COLLECTION, withData.settlementId);
      const setSnap = await getDoc(setRef);
      if (setSnap.exists()) {
        const settlement = setSnap.data() as ProfitSharingSettlement;
        const newTotalPaid = Math.max(0, (settlement.totalPaidToInvestor || 0) - withData.amount);
        const newRemaining = settlement.investorAmount - newTotalPaid;
        const newStatus: SettlementStatus =
          newTotalPaid > 0 ? 'PARTIALLY_PAID' : 'APPROVED';

        await updateDoc(setRef, {
          totalPaidToInvestor: newTotalPaid,
          remainingInvestorObligation: newRemaining,
          status: newStatus,
          updatedAt: serverTimestamp(),
          updatedBy: userProfile.uid,
          updatedByName: userProfile.name,
        });
      }
    }

    // 4. Audit Log
    await catatAuditLog(
      userProfile.uid,
      userProfile.name,
      'INVESTOR_WITHDRAWAL_VOIDED',
      'withdrawals',
      `Membatalkan (VOID) penarikan investor Rp${withData.amount.toLocaleString('id-ID')}. Alasan: ${voidReason}`,
      withData,
      { status: 'VOID', voidReason }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'withdrawals');
    throw error;
  }
}
