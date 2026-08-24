import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  addDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  MonthlyClosing,
  FinancialAdjustment,
  ReportScopeFilter,
  UserProfile,
  Transaction,
  DailyPerformance,
  Expense,
  Payroll,
  ProfitSharingSettlement,
  InventoryItem,
  Sample,
  DailyTask,
  ContentCalendarItem,
  ScopeType,
} from '../types';
import { catatAuditLog } from './auditService';
import { tanggalHariIni } from '../utils/formatters';

const CLOSINGS_COLLECTION = 'monthlyClosings';
const ADJUSTMENTS_COLLECTION = 'financialAdjustments';

/**
 * Subscribe to all monthly closings real-time
 */
export function subscribeMonthlyClosings(
  callback: (closings: MonthlyClosing[]) => void
) {
  const q = query(
    collection(db, CLOSINGS_COLLECTION),
    orderBy('period', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as MonthlyClosing[];
      callback(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, CLOSINGS_COLLECTION);
    }
  );
}

/**
 * Get snapshot/closing for a specific period and scope
 */
export async function getMonthlyClosing(
  period: string,
  scope: ReportScopeFilter
): Promise<MonthlyClosing | null> {
  const closingId = `CLOSING_${period}_${scope}`;
  try {
    const ref = doc(db, CLOSINGS_COLLECTION, closingId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as MonthlyClosing;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, CLOSINGS_COLLECTION);
    return null;
  }
}

/**
 * Helper to compute the closing snapshot from Firestore live data
 */
export async function computeMonthlySnapshot(
  yearOrPeriod: number | string,
  monthOrScope: number | ReportScopeFilter,
  maybeScope?: ReportScopeFilter
): Promise<Omit<MonthlyClosing, 'id' | 'status' | 'closedAt' | 'closedBy' | 'closedByName' | 'createdAt' | 'updatedAt'>> {
  let year: number;
  let month: number;
  let scope: ReportScopeFilter;

  if (typeof yearOrPeriod === 'string') {
    const parts = yearOrPeriod.split('-');
    year = parseInt(parts[0], 10) || new Date().getFullYear();
    month = parseInt(parts[1], 10) || (new Date().getMonth() + 1);
    scope = (monthOrScope as ReportScopeFilter) || 'GABUNGAN';
  } else {
    year = yearOrPeriod;
    month = typeof monthOrScope === 'number' ? monthOrScope : 1;
    scope = maybeScope || 'GABUNGAN';
  }

  const monthStr = month < 10 ? `0${month}` : `${month}`;
  const period = `${year}-${monthStr}`;
  const startDate = `${period}-01`;
  // Last day of month
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${period}-${lastDay < 10 ? '0' + lastDay : lastDay}`;

  // 1. Transactions (Single Source of Truth)
  const txSnap = await getDocs(collection(db, 'transactions'));
  const allTx = txSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction));
  const filteredTx = allTx.filter((t) => {
    if (t.date < startDate || t.date > endDate) return false;
    if (scope !== 'GABUNGAN' && t.scope !== scope) return false;
    return true;
  });

  let uangMasuk = 0;
  let uangKeluar = 0;
  const sourceTypeBreakdown: Record<string, number> = {};

  filteredTx.forEach((t) => {
    if (t.type === 'INCOME') {
      uangMasuk += t.amount || 0;
      const src = t.sourceType || 'LAINNYA';
      sourceTypeBreakdown[src] = (sourceTypeBreakdown[src] || 0) + (t.amount || 0);
    } else if (t.type === 'EXPENSE') {
      uangKeluar += t.amount || 0;
    }
  });

  const saldoBersih = uangMasuk - uangKeluar;

  // 2. Daily Performance (GMV, Estimasi, Komisi Real)
  const perfSnap = await getDocs(collection(db, 'dailyPerformance'));
  const allPerf = perfSnap.docs.map((d) => ({ id: d.id, ...d.data() } as DailyPerformance));
  const filteredPerf = allPerf.filter((p) => {
    if (p.date < startDate || p.date > endDate) return false;
    if (scope !== 'GABUNGAN' && p.scope !== scope) return false;
    return true;
  });

  let gmv = 0;
  let estimasiKomisi = 0;
  let komisiReal = 0;
  filteredPerf.forEach((p) => {
    gmv += p.gmv || 0;
    estimasiKomisi += p.estimatedCommission || 0;
    komisiReal += p.realCommission || 0;
  });

  // 3. Expenses
  const expSnap = await getDocs(collection(db, 'expenses'));
  const allExp = expSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Expense));
  const filteredExp = allExp.filter((e) => {
    if (e.date < startDate || e.date > endDate) return false;
    if (scope !== 'GABUNGAN' && e.scope !== scope) return false;
    return true;
  });

  let totalExpense = 0;
  let totalSampleExpense = 0;
  const expenseCategoryBreakdown: Record<string, number> = {};
  const expenseMapByName: Record<string, { name: string; amount: number; category: string }> = {};

  filteredExp.forEach((e) => {
    const amt = e.amount || 0;
    totalExpense += amt;
    const cat = e.category || 'OPERASIONAL';
    expenseCategoryBreakdown[cat] = (expenseCategoryBreakdown[cat] || 0) + amt;

    if (cat === 'SAMPEL') {
      totalSampleExpense += amt;
    }

    const expName = e.description || e.category || 'Biaya';
    if (!expenseMapByName[expName]) {
      expenseMapByName[expName] = { name: expName, amount: 0, category: cat };
    }
    expenseMapByName[expName].amount += amt;
  });

  const topExpenses = Object.values(expenseMapByName)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  // 4. Payroll
  const paySnap = await getDocs(collection(db, 'payrolls'));
  const allPay = paySnap.docs.map((d) => ({ id: d.id, ...d.data() } as Payroll));
  const filteredPay = allPay.filter((p) => {
    if (p.month !== period && p.paymentDate && (p.paymentDate < startDate || p.paymentDate > endDate)) {
      return false;
    }
    return true;
  });

  let totalPayroll = 0;
  let totalGajiPokok = 0;
  let totalUangRajin = 0;
  let totalBonus = 0;
  let totalPayrollPaid = 0;
  let totalPayrollUnpaid = 0;

  filteredPay.forEach((p) => {
    const net = p.totalPay || p.total || 0;
    totalPayroll += net;
    totalGajiPokok += p.baseSalary || 0;
    totalUangRajin += p.attendanceBonus || 0;
    totalBonus += p.bonus || p.bonusAmount || 0;

    if (p.status === 'PAID') {
      totalPayrollPaid += net;
    } else {
      totalPayrollUnpaid += net;
    }
  });

  // 5. Profit Sharing Settlements
  const setSnap = await getDocs(collection(db, 'profitSharingSettlements'));
  const allSettlements = setSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ProfitSharingSettlement));
  const filteredSettlements = allSettlements.filter((s) => {
    const sPeriod = `${s.year}-${String(s.month).padStart(2, '0')}`;
    return sPeriod === period || (s.periodStart && s.periodStart.startsWith(period));
  });

  let totalProfitSharingMasuk = 0;
  let hakInvestor = 0;
  let hakOwner = 0;
  let hakTalent = 0;
  let hakEditor = 0;
  let budgetPerusahaan = 0;
  let investorPaid = 0;
  let investorUnpaid = 0;

  filteredSettlements.forEach((s) => {
    totalProfitSharingMasuk += s.totalIncome || 0;
    hakInvestor += s.investorAmount || 0;
    hakOwner += s.ownerAmount || 0;
    hakTalent += s.talentAmount || 0;
    hakEditor += s.editorAmount || 0;
    budgetPerusahaan += s.companyBudgetAmount || 0;
    investorPaid += s.totalPaidToInvestor || 0;
    investorUnpaid += s.remainingInvestorObligation || 0;
  });

  // 6. Inventory Value
  const invSnap = await getDocs(collection(db, 'inventory'));
  const allInv = invSnap.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryItem));
  let totalInventoryValue = 0;
  allInv.forEach((item) => {
    totalInventoryValue += item.totalValue || (item.pricePerUnit || 0) * (item.quantity || 1);
  });

  // 7. Content & Tasks
  let totalContentPlanned = 0;
  let totalContentPosted = 0;
  try {
    const contSnap = await getDocs(collection(db, 'contentCalendar'));
    const allCont = contSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ContentCalendarItem));
    const filteredCont = allCont.filter((c) => {
      if (c.date < startDate || c.date > endDate) return false;
      if (scope !== 'GABUNGAN' && c.scope !== scope) return false;
      return true;
    });
    totalContentPlanned = filteredCont.length;
    totalContentPosted = filteredCont.filter((c) => c.status === 'DIPOSTING').length;
  } catch (err) {
    console.warn('Content calendar read in closing compute:', err);
  }

  let totalTasksCompleted = 0;
  try {
    const taskSnap = await getDocs(collection(db, 'dailyTasks'));
    const allTasks = taskSnap.docs.map((d) => ({ id: d.id, ...d.data() } as DailyTask));
    const filteredTasks = allTasks.filter((t) => {
      if (!t.tanggal || t.tanggal < startDate || t.tanggal > endDate) return false;
      return true;
    });
    totalTasksCompleted = filteredTasks.filter((t) => t.status === 'SELESAI').length;
  } catch (err) {
    console.warn('Daily tasks read in closing compute:', err);
  }

  // 8. Pre-Closing Reconciliation Check
  let reconciliationSnapshot: MonthlyClosing['reconciliationSnapshot'] = undefined;
  try {
    const recSnap = await getDocs(collection(db, 'cashReconciliations'));
    if (!recSnap.empty) {
      const recs = recSnap.docs.map((d) => d.data());
      // Pick the latest for this month
      const monthRecs = recs.filter((r) => r.reconcileDate && r.reconcileDate.startsWith(period));
      if (monthRecs.length > 0) {
        const latest = monthRecs[monthRecs.length - 1];
        reconciliationSnapshot = {
          saldoBuku: latest.saldoBuku || saldoBersih,
          saldoAktual: latest.saldoAktual || saldoBersih,
          selisih: latest.selisih || 0,
          status: latest.status || (latest.selisih === 0 ? 'SEIMBANG' : latest.selisih > 0 ? 'SURPLUS FISIK' : 'DEFISIT FISIK'),
          reconciledAt: latest.reconciledAt || null,
          reconciledByName: latest.reconciledByName || 'Sistem',
        };
      }
    }
  } catch (err) {
    console.warn('Reconciliation read in closing compute:', err);
  }

  if (!reconciliationSnapshot) {
    reconciliationSnapshot = {
      saldoBuku: saldoBersih,
      saldoAktual: saldoBersih,
      selisih: 0,
      status: 'SEIMBANG',
      reconciledByName: 'Auto System',
    };
  }

  return {
    closingId: `CLOSING_${period}_${scope}`,
    year,
    month,
    period,
    scope,
    uangMasuk,
    uangKeluar,
    saldoBersih,
    gmv,
    estimasiKomisi,
    komisiReal,
    totalExpense,
    totalSampleExpense,
    totalInventoryValue,
    totalPayroll,
    totalGajiPokok,
    totalUangRajin,
    totalBonus,
    totalPayrollPaid,
    totalPayrollUnpaid,
    totalProfitSharingMasuk,
    hakInvestor,
    hakOwner,
    hakTalent,
    hakEditor,
    budgetPerusahaan,
    investorPaid,
    investorUnpaid,
    totalContentPlanned,
    totalContentPosted,
    totalTasksCompleted,
    sourceTypeBreakdown,
    expenseCategoryBreakdown,
    topExpenses,
    reconciliationSnapshot,
  };
}

/**
 * Execute Close Month (Owner only)
 */
export async function closeMonth(
  yearOrPeriod: number | string,
  monthOrScope: number | ReportScopeFilter,
  scopeOrNotes?: ReportScopeFilter | string,
  userProfileOrNotes?: UserProfile | string,
  maybeNotes?: string
): Promise<MonthlyClosing> {
  let year: number;
  let month: number;
  let scope: ReportScopeFilter;
  let userProfile: UserProfile;
  let notes: string = '';

  if (typeof yearOrPeriod === 'string') {
    const parts = yearOrPeriod.split('-');
    year = parseInt(parts[0], 10) || new Date().getFullYear();
    month = parseInt(parts[1], 10) || (new Date().getMonth() + 1);
    scope = (monthOrScope as ReportScopeFilter) || 'GABUNGAN';
    notes = typeof scopeOrNotes === 'string' ? scopeOrNotes : '';
    userProfile = userProfileOrNotes as UserProfile;
  } else {
    year = yearOrPeriod;
    month = typeof monthOrScope === 'number' ? monthOrScope : 1;
    scope = (scopeOrNotes as ReportScopeFilter) || 'GABUNGAN';
    userProfile = userProfileOrNotes as UserProfile;
    notes = maybeNotes || '';
  }

  const monthStr = month < 10 ? `0${month}` : `${month}`;
  const period = `${year}-${monthStr}`;
  const closingId = `CLOSING_${period}_${scope}`;

  const computedSnapshot = await computeMonthlySnapshot(year, month, scope);

  const closingData: MonthlyClosing = {
    ...computedSnapshot,
    status: 'CLOSED',
    notes: notes || '',
    closedAt: serverTimestamp(),
    closedBy: userProfile.uid,
    closedByName: userProfile.name,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = doc(db, CLOSINGS_COLLECTION, closingId);
  await setDoc(ref, closingData, { merge: true });

  // Record Audit
  await catatAuditLog(
    userProfile.uid,
    userProfile.name,
    'MONTH_CLOSED',
    `monthlyClosing/${closingId}`,
    `Penutupan Buku Bulan ${period} (${scope}). Saldo Bersih: ${computedSnapshot.saldoBersih}, Uang Masuk: ${computedSnapshot.uangMasuk}, Uang Keluar: ${computedSnapshot.uangKeluar}`
  );

  return closingData;
}

/**
 * Reopen Month (Owner only, with mandatory reason)
 */
export async function reopenMonth(
  closingId: string,
  reason: string,
  userProfile: UserProfile
): Promise<void> {
  if (!reason || !reason.trim()) {
    throw new Error('Alasan pembukaan kembali bulan wajib diisi.');
  }

  const ref = doc(db, CLOSINGS_COLLECTION, closingId);
  await updateDoc(ref, {
    status: 'OPEN',
    reopenedAt: serverTimestamp(),
    reopenedBy: userProfile.uid,
    reopenedByName: userProfile.name,
    reopenReason: reason.trim(),
    updatedAt: serverTimestamp(),
  });

  // Record Audit
  await catatAuditLog(
    userProfile.uid,
    userProfile.name,
    'MONTH_REOPENED',
    `monthlyClosing/${closingId}`,
    `Buka kembali periode buku: ${closingId}. Alasan: ${reason.trim()}`
  );
}

/**
 * Create Financial Adjustment for closed periods (Owner only, with mandatory reason)
 */
export async function createFinancialAdjustment(
  adjustment: Omit<FinancialAdjustment, 'id' | 'adjustmentId' | 'createdAt' | 'approvedBy' | 'approvedByName'>,
  userProfile: UserProfile
): Promise<string> {
  if (!adjustment.reason || !adjustment.reason.trim()) {
    throw new Error('Alasan adjustment keuangan wajib diisi.');
  }
  if (!adjustment.amount || adjustment.amount <= 0) {
    throw new Error('Nominal adjustment harus lebih dari 0.');
  }

  const adjustmentId = `ADJ_${Date.now()}`;
  const newAdj: FinancialAdjustment = {
    ...adjustment,
    adjustmentId,
    approvedBy: userProfile.uid,
    approvedByName: userProfile.name,
    createdAt: serverTimestamp(),
  };

  const adjRef = await addDoc(collection(db, ADJUSTMENTS_COLLECTION), newAdj);

  // Synchronize transaction into transactions collection for accounting clarity
  await addDoc(collection(db, 'transactions'), {
    transactionId: `TX_${adjustmentId}`,
    date: tanggalHariIni(),
    type: adjustment.type === 'INCOME_ADJUSTMENT' ? 'INCOME' : 'EXPENSE',
    scope: adjustment.scope,
    category: adjustment.category || 'OPERASIONAL',
    sourceType: adjustment.sourceType || 'LAINNYA',
    amount: adjustment.amount,
    description: `[ADJUSTMENT ${adjustment.period}] ${adjustment.description}: ${adjustment.reason}`,
    createdBy: userProfile.uid,
    createdByName: userProfile.name,
    createdAt: serverTimestamp(),
    isAdjustment: true,
    adjustmentPeriod: adjustment.period,
  });

  // Record Audit
  await catatAuditLog(
    userProfile.uid,
    userProfile.name,
    'FINANCIAL_ADJUSTMENT_CREATED',
    `financialAdjustment/${adjRef.id}`,
    `Adjustment Keuangan ${adjustment.type} Rp ${adjustment.amount} untuk periode ${adjustment.period} (${adjustment.scope}). Alasan: ${adjustment.reason}`
  );

  return adjRef.id;
}

/**
 * Check if a date or period is in a closed month
 */
export async function checkIsDateClosed(
  dateStr: string,
  scope: ScopeType
): Promise<{ isClosed: boolean; closingInfo?: MonthlyClosing }> {
  try {
    const period = dateStr.substring(0, 7); // e.g. "2026-08"
    const closing = await getMonthlyClosing(period, scope);
    if (closing && closing.status === 'CLOSED') {
      return { isClosed: true, closingInfo: closing };
    }
    // Also check GABUNGAN closing if exists
    const gabunganClosing = await getMonthlyClosing(period, 'GABUNGAN');
    if (gabunganClosing && gabunganClosing.status === 'CLOSED') {
      return { isClosed: true, closingInfo: gabunganClosing };
    }
    return { isClosed: false };
  } catch {
    return { isClosed: false };
  }
}
