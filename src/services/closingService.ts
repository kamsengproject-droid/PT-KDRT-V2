import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  addDoc,
} from 'firebase/firestore';

import {
  db,
  handleFirestoreError,
  OperationType,
} from '../firebase';

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
  DailyTask,
  ContentCalendarItem,
} from '../types';

import { catatAuditLog } from './auditService';

const CLOSINGS_COLLECTION = 'monthlyClosings';
const ADJUSTMENTS_COLLECTION = 'financialAdjustments';

const isCommissionReal = (transaction: any) => {
  const source = String(
    transaction?.sourceType || ''
  ).toUpperCase();

  return (
    source === 'COMMISSION_REAL' ||
    source === 'TIKTOK_COMMISSION' ||
    source === 'TIKTOK COMMISSION'
  );
};

const getFundTransferNet = (
  transaction: any
): number => {
  const explicitNet = Number(
    transaction?.netAmount
  );

  if (explicitNet > 0) {
    return explicitNet;
  }

  return Math.max(
    0,
    Number(transaction?.amount || 0) -
      Number(transaction?.adminFee || 0)
  );
};

const getPeriodRange = (
  yearOrPeriod: number | string,
  monthOrScope: number | ReportScopeFilter,
  maybeScope?: ReportScopeFilter
) => {
  let year: number;
  let month: number;
  let scope: ReportScopeFilter;

  if (typeof yearOrPeriod === 'string') {
    const parts = yearOrPeriod.split('-');

    year =
      parseInt(parts[0], 10) ||
      new Date().getFullYear();

    month =
      parseInt(parts[1], 10) ||
      new Date().getMonth() + 1;

    scope =
      (monthOrScope as ReportScopeFilter) ||
      'GABUNGAN';
  } else {
    year = yearOrPeriod;

    month =
      typeof monthOrScope === 'number'
        ? monthOrScope
        : 1;

    scope = maybeScope || 'GABUNGAN';
  }

  const monthStr =
    month < 10 ? `0${month}` : String(month);

  const period = `${year}-${monthStr}`;
  const startDate = `${period}-01`;

  const lastDay = new Date(
    year,
    month,
    0
  ).getDate();

  const endDate =
    `${period}-${String(lastDay).padStart(2, '0')}`;

  return {
    year,
    month,
    period,
    startDate,
    endDate,
    scope,
  };
};

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
      handleFirestoreError(
        error,
        OperationType.GET,
        CLOSINGS_COLLECTION
      );
    }
  );
}

export async function getMonthlyClosing(
  period: string,
  scope: ReportScopeFilter
): Promise<MonthlyClosing | null> {
  const closingId =
    `CLOSING_${period}_${scope}`;

  try {
    const ref = doc(
      db,
      CLOSINGS_COLLECTION,
      closingId
    );

    const snapshot = await getDoc(ref);

    if (!snapshot.exists()) {
      return null;
    }

    return {
      id: snapshot.id,
      ...snapshot.data(),
    } as MonthlyClosing;
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.GET,
      CLOSINGS_COLLECTION
    );

    return null;
  }
}

export async function computeMonthlySnapshot(
  yearOrPeriod: number | string,
  monthOrScope: number | ReportScopeFilter,
  maybeScope?: ReportScopeFilter
): Promise<
  Omit<
    MonthlyClosing,
    | 'id'
    | 'status'
    | 'closedAt'
    | 'closedBy'
    | 'closedByName'
    | 'createdAt'
    | 'updatedAt'
  >
> {
  const {
    year,
    month,
    period,
    startDate,
    endDate,
    scope,
  } = getPeriodRange(
    yearOrPeriod,
    monthOrScope,
    maybeScope
  );

  /* ============================================================
     1. TRANSACTIONS = KAS & BANK
     ============================================================ */

  const txSnap = await getDocs(
    collection(db, 'transactions')
  );

  const allTx = txSnap.docs.map(
    (d) =>
      ({
        id: d.id,
        ...d.data(),
      }) as Transaction
  );

  const filteredTx = allTx.filter((tx) => {
    if (!tx.date) return false;

    if (
      tx.date < startDate ||
      tx.date > endDate
    ) {
      return false;
    }

    if (
      scope !== 'GABUNGAN' &&
      tx.scope !== scope
    ) {
      return false;
    }

    return true;
  });

  let uangMasuk = 0;
  let uangKeluar = 0;

  const sourceTypeBreakdown: Record<
    string,
    number
  > = {};

  filteredTx.forEach((tx) => {
    const sourceType =
      String(
        tx.sourceType || 'LAINNYA'
      ).toUpperCase();

    /*
     * KOMISI REAL:
     * hanya performa TikTok.
     * TIDAK menjadi Kas & Bank.
     */
    if (isCommissionReal(tx)) {
      return;
    }

    /*
     * PINDAH DANA:
     * hanya NET AMOUNT yang benar-benar
     * masuk rekening.
     */
    if (sourceType === 'FUND_TRANSFER') {
      const netAmount =
        getFundTransferNet(tx);

      if (netAmount > 0) {
        uangMasuk += netAmount;

        sourceTypeBreakdown[
          'FUND_TRANSFER'
        ] =
          (sourceTypeBreakdown[
            'FUND_TRANSFER'
          ] || 0) + netAmount;
      }

      return;
    }

    /*
     * INCOME BIASA:
     * uang yang memang sudah tercatat
     * sebagai uang masuk.
     */
    if (tx.type === 'INCOME') {
      const amount =
        Number(tx.amount) || 0;

      uangMasuk += amount;

      sourceTypeBreakdown[sourceType] =
        (sourceTypeBreakdown[sourceType] || 0) +
        amount;

      return;
    }

    /*
     * EXPENSE:
     * benar-benar mengurangi Kas & Bank.
     */
    if (tx.type === 'EXPENSE') {
      uangKeluar +=
        Number(tx.amount) || 0;

      return;
    }
  });

  const saldoBersih =
    uangMasuk - uangKeluar;

  /* ============================================================
     2. DAILY PERFORMANCE
     ============================================================ */

  const perfSnap = await getDocs(
    collection(db, 'dailyPerformance')
  );

  const allPerf = perfSnap.docs.map(
    (d) =>
      ({
        id: d.id,
        ...d.data(),
      }) as DailyPerformance
  );

  const filteredPerf = allPerf.filter((p) => {
    if (!p.date) return false;

    if (
      p.date < startDate ||
      p.date > endDate
    ) {
      return false;
    }

    if (
      scope !== 'GABUNGAN' &&
      p.scope !== scope
    ) {
      return false;
    }

    return true;
  });

  let gmv = 0;
  let estimasiKomisi = 0;
  let komisiReal = 0;

  filteredPerf.forEach((performance) => {
    gmv +=
      Number(performance.gmv) || 0;

    estimasiKomisi +=
      Number(
        performance.estimatedCommission
      ) || 0;

    komisiReal +=
      Number(
        performance.realCommission
      ) || 0;
  });

  /* ============================================================
     3. EXPENSE DETAIL
     ============================================================ */

  const expSnap = await getDocs(
    collection(db, 'expenses')
  );

  const allExp = expSnap.docs.map(
    (d) =>
      ({
        id: d.id,
        ...d.data(),
      }) as Expense
  );

  const filteredExp = allExp.filter((expense) => {
    if (!expense.date) return false;

    if (
      expense.date < startDate ||
      expense.date > endDate
    ) {
      return false;
    }

    if (
      scope !== 'GABUNGAN' &&
      expense.scope !== scope
    ) {
      return false;
    }

    return true;
  });

  let totalExpense = 0;
  let totalSampleExpense = 0;

  const expenseCategoryBreakdown: Record<
    string,
    number
  > = {};

  const expenseMapByName: Record<
    string,
    {
      name: string;
      amount: number;
      category: string;
    }
  > = {};

  filteredExp.forEach((expense) => {
    const amount =
      Number(expense.amount) || 0;

    const category =
      expense.category || 'OPERASIONAL';

    totalExpense += amount;

    expenseCategoryBreakdown[category] =
      (expenseCategoryBreakdown[category] || 0) +
      amount;

    if (category === 'SAMPEL') {
      totalSampleExpense += amount;
    }

    const name =
      expense.description ||
      category ||
      'Biaya';

    if (!expenseMapByName[name]) {
      expenseMapByName[name] = {
        name,
        amount: 0,
        category,
      };
    }

    expenseMapByName[name].amount += amount;
  });

  const topExpenses = Object.values(
    expenseMapByName
  )
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  /* ============================================================
     4. PAYROLL
     ============================================================ */

  const paySnap = await getDocs(
    collection(db, 'payrolls')
  );

  const allPay = paySnap.docs.map(
    (d) =>
      ({
        id: d.id,
        ...d.data(),
      }) as Payroll
  );

  const filteredPay = allPay.filter((payroll) => {
    if (
      payroll.month !== period &&
      payroll.paymentDate &&
      (
        payroll.paymentDate < startDate ||
        payroll.paymentDate > endDate
      )
    ) {
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

  filteredPay.forEach((payroll) => {
    const net =
      Number(payroll.totalPay) ||
      Number(payroll.total) ||
      0;

    totalPayroll += net;

    totalGajiPokok +=
      Number(payroll.baseSalary) || 0;

    totalUangRajin +=
      Number(payroll.attendanceBonus) || 0;

    totalBonus +=
      Number(payroll.bonus) ||
      Number(payroll.bonusAmount) ||
      0;

    if (payroll.status === 'PAID') {
      totalPayrollPaid += net;
    } else {
      totalPayrollUnpaid += net;
    }
  });

  /* ============================================================
     5. PROFIT SHARING
     ============================================================ */

  const setSnap = await getDocs(
    collection(
      db,
      'profitSharingSettlements'
    )
  );

  const allSettlements =
    setSnap.docs.map(
      (d) =>
        ({
          id: d.id,
          ...d.data(),
        }) as ProfitSharingSettlement
    );

  const filteredSettlements =
    allSettlements.filter((settlement) => {
      const settlementPeriod =
        `${settlement.year}-${String(
          settlement.month
        ).padStart(2, '0')}`;

      return (
        settlementPeriod === period ||
        (
          settlement.periodStart &&
          settlement.periodStart.startsWith(period)
        )
      );
    });

  let totalProfitSharingMasuk = 0;
  let hakInvestor = 0;
  let hakOwner = 0;
  let hakTalent = 0;
  let hakEditor = 0;
  let budgetPerusahaan = 0;
  let investorPaid = 0;
  let investorUnpaid = 0;

  filteredSettlements.forEach((settlement) => {
    totalProfitSharingMasuk +=
      Number(settlement.totalIncome) || 0;

    hakInvestor +=
      Number(settlement.investorAmount) || 0;

    hakOwner +=
      Number(settlement.ownerAmount) || 0;

    hakTalent +=
      Number(settlement.talentAmount) || 0;

    hakEditor +=
      Number(settlement.editorAmount) || 0;

    budgetPerusahaan +=
      Number(
        settlement.companyBudgetAmount
      ) || 0;

    investorPaid +=
      Number(
        settlement.totalPaidToInvestor
      ) || 0;

    investorUnpaid +=
      Number(
        settlement.remainingInvestorObligation
      ) || 0;
  });

  /* ============================================================
     6. INVENTORY
     ============================================================ */

  const invSnap = await getDocs(
    collection(db, 'inventory')
  );

  const allInv = invSnap.docs.map(
    (d) =>
      ({
        id: d.id,
        ...d.data(),
      }) as InventoryItem
  );

  let totalInventoryValue = 0;

  allInv.forEach((item) => {
    totalInventoryValue +=
      Number(item.totalValue) ||
      (
        Number(item.pricePerUnit) || 0
      ) *
      (
        Number(item.quantity) || 1
      );
  });

  /* ============================================================
     7. CONTENT CALENDAR
     ============================================================ */

  let totalContentPlanned = 0;
  let totalContentPosted = 0;

  try {
    const contentSnap = await getDocs(
      collection(db, 'contentCalendar')
    );

    const content = contentSnap.docs.map(
      (d) =>
        ({
          id: d.id,
          ...d.data(),
        }) as ContentCalendarItem
    );

    const filteredContent = content.filter(
      (item) => {
        if (!item.date) return false;

        if (
          item.date < startDate ||
          item.date > endDate
        ) {
          return false;
        }

        if (
          scope !== 'GABUNGAN' &&
          item.scope !== scope
        ) {
          return false;
        }

        return true;
      }
    );

    totalContentPlanned =
      filteredContent.length;

    totalContentPosted =
      filteredContent.filter(
        (item) =>
          item.status === 'DIPOSTING'
      ).length;
  } catch (error) {
    console.warn(
      'Content calendar read in closing compute:',
      error
    );
  }

  /* ============================================================
     8. DAILY TASK
     ============================================================ */

  let totalTasksCompleted = 0;

  try {
    const taskSnap = await getDocs(
      collection(db, 'dailyTasks')
    );

    const tasks = taskSnap.docs.map(
      (d) =>
        ({
          id: d.id,
          ...d.data(),
        }) as DailyTask
    );

    const filteredTasks = tasks.filter((task) => {
      if (!task.tanggal) return false;

      return (
        task.tanggal >= startDate &&
        task.tanggal <= endDate
      );
    });

    totalTasksCompleted =
      filteredTasks.filter(
        (task) =>
          task.status === 'SELESAI'
      ).length;
  } catch (error) {
    console.warn(
      'Daily tasks read in closing compute:',
      error
    );
  }

  /* ============================================================
     9. REKONSILIASI
     ============================================================ */

  let reconciliationSnapshot:
    MonthlyClosing['reconciliationSnapshot'] =
    undefined;

  try {
    const reconciliationSnap =
      await getDocs(
        collection(
          db,
          'cashReconciliations'
        )
      );

    if (!reconciliationSnap.empty) {
      const records =
        reconciliationSnap.docs.map(
          (d) => d.data()
        );

      const monthRecords = records.filter(
        (record: any) =>
          record.reconcileDate &&
          record.reconcileDate.startsWith(
            period
          )
      );

      if (monthRecords.length > 0) {
        const latest =
          monthRecords[
            monthRecords.length - 1
          ] as any;

        const difference =
          Number(latest.selisih) || 0;

        reconciliationSnapshot = {
          saldoBuku:
            Number(latest.saldoBuku) ||
            saldoBersih,

          saldoAktual:
            Number(latest.saldoAktual) ||
            saldoBersih,

          selisih: difference,

          status:
            latest.status ||
            (
              difference === 0
                ? 'SEIMBANG'
                : difference > 0
                  ? 'SURPLUS FISIK'
                  : 'DEFISIT FISIK'
            ),

          reconciledAt:
            latest.reconciledAt || null,

          reconciledByName:
            latest.reconciledByName ||
            'Sistem',
        };
      }
    }
  } catch (error) {
    console.warn(
      'Reconciliation read in closing compute:',
      error
    );
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
    closingId:
      `CLOSING_${period}_${scope}`,

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
  let notes = '';

  if (typeof yearOrPeriod === 'string') {
    const parts =
      yearOrPeriod.split('-');

    year =
      parseInt(parts[0], 10) ||
      new Date().getFullYear();

    month =
      parseInt(parts[1], 10) ||
      new Date().getMonth() + 1;

    scope =
      (monthOrScope as ReportScopeFilter) ||
      'GABUNGAN';

    notes =
      typeof scopeOrNotes === 'string'
        ? scopeOrNotes
        : '';

    userProfile =
      userProfileOrNotes as UserProfile;
  } else {
    year = yearOrPeriod;

    month =
      typeof monthOrScope === 'number'
        ? monthOrScope
        : 1;

    scope =
      (scopeOrNotes as ReportScopeFilter) ||
      'GABUNGAN';

    userProfile =
      userProfileOrNotes as UserProfile;

    notes = maybeNotes || '';
  }

  if (!userProfile?.uid) {
    throw new Error(
      'User Owner tidak ditemukan.'
    );
  }

  const monthStr =
    month < 10 ? `0${month}` : String(month);

  const period =
    `${year}-${monthStr}`;

  const closingId =
    `CLOSING_${period}_${scope}`;

  const snapshot =
    await computeMonthlySnapshot(
      year,
      month,
      scope
    );

  const closingData: MonthlyClosing = {
    ...snapshot,

    status: 'CLOSED',
    notes: notes || '',

    closedAt: serverTimestamp(),
    closedBy: userProfile.uid,
    closedByName: userProfile.name,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(
    doc(
      db,
      CLOSINGS_COLLECTION,
      closingId
    ),
    closingData,
    { merge: true }
  );

  await catatAuditLog(
    userProfile.uid,
    userProfile.name,
    'MONTH_CLOSED',
    `monthlyClosing/${closingId}`,
    `Penutupan Buku Bulan ${period} (${scope}). ` +
      `Saldo Kas & Bank: ${snapshot.saldoBersih}. ` +
      `Uang Masuk: ${snapshot.uangMasuk}. ` +
      `Uang Keluar: ${snapshot.uangKeluar}. ` +
      `Komisi Real: ${snapshot.komisiReal} ` +
      `(tidak dihitung sebagai saldo bank).`
  );

  return closingData;
}

export async function reopenMonth(
  closingId: string,
  reason: string,
  userProfile: UserProfile
): Promise<void> {
  if (!reason?.trim()) {
    throw new Error(
      'Alasan pembukaan kembali bulan wajib diisi.'
    );
  }

  await updateDoc(
    doc(
      db,
      CLOSINGS_COLLECTION,
      closingId
    ),
    {
      status: 'OPEN',
      reopenedAt: serverTimestamp(),
      reopenedBy: userProfile.uid,
      reopenedByName: userProfile.name,
      reopenReason: reason.trim(),
      updatedAt: serverTimestamp(),
    }
  );

  await catatAuditLog(
    userProfile.uid,
    userProfile.name,
    'MONTH_REOPENED',
    `monthlyClosing/${closingId}`,
    `Buka kembali periode buku: ${closingId}. ` +
      `Alasan: ${reason.trim()}`
  );
}

export async function createFinancialAdjustment(
  adjustment: Omit<
    FinancialAdjustment,
    | 'id'
    | 'adjustmentId'
    | 'createdAt'
    | 'approvedBy'
    | 'approvedByName'
  >,
  userProfile: UserProfile
): Promise<string> {
  if (!adjustment.reason?.trim()) {
    throw new Error(
      'Alasan adjustment keuangan wajib diisi.'
    );
  }

  const amount =
    Number(adjustment.amount) || 0;

  if (amount <= 0) {
    throw new Error(
      'Nominal adjustment harus lebih dari 0.'
    );
  }

  const adjustmentId =
    `ADJ_${Date.now()}`;

  const adjustmentData: FinancialAdjustment = {
    ...adjustment,
    amount,
    adjustmentId,
    approvedBy: userProfile.uid,
    approvedByName: userProfile.name,
    createdAt: serverTimestamp(),
  };

  const adjustmentRef =
    await addDoc(
      collection(
        db,
        ADJUSTMENTS_COLLECTION
      ),
      adjustmentData
    );

  const transactionType =
    adjustment.type ===
    'INCOME_ADJUSTMENT'
      ? 'INCOME'
      : 'EXPENSE';

  await addDoc(
    collection(db, 'transactions'),
    {
      transactionId:
        `TX_${adjustmentId}`,

      date: adjustment.period
        ? `${adjustment.period}-01`
        : new Date()
            .toISOString()
            .slice(0, 10),

      type: transactionType,
      scope: adjustment.scope,

      category:
        adjustment.category ||
        'OPERASIONAL',

      sourceType:
        adjustment.sourceType ||
        'FINANCIAL_ADJUSTMENT',

      amount,

      description:
        `[ADJUSTMENT ${adjustment.period}] ` +
        `${adjustment.description}: ` +
        `${adjustment.reason}`,

      createdBy: userProfile.uid,
      createdByName: userProfile.name,

      createdAt: serverTimestamp(),

      isAdjustment: true,
      adjustmentPeriod:
        adjustment.period,
    }
  );

  await catatAuditLog(
    userProfile.uid,
    userProfile.name,
    'FINANCIAL_ADJUSTMENT_CREATED',
    `financialAdjustment/${adjustmentRef.id}`,
    `Adjustment ${adjustment.type} ` +
      `Rp ${amount.toLocaleString('id-ID')} ` +
      `untuk periode ${adjustment.period} ` +
      `(${adjustment.scope}). ` +
      `Alasan: ${adjustment.reason}`
  );

  return adjustmentRef.id;
}

export async function checkIsDateClosed(
  dateStr: string,
  scope: any
): Promise<{
  isClosed: boolean;
  closingInfo?: MonthlyClosing;
}> {
  try {
    const period =
      dateStr.substring(0, 7);

    const closing =
      await getMonthlyClosing(
        period,
        scope
      );

    if (
      closing &&
      closing.status === 'CLOSED'
    ) {
      return {
        isClosed: true,
        closingInfo: closing,
      };
    }

    const gabungan =
      await getMonthlyClosing(
        period,
        'GABUNGAN'
      );

    if (
      gabungan &&
      gabungan.status === 'CLOSED'
    ) {
      return {
        isClosed: true,
        closingInfo: gabungan,
      };
    }

    return { isClosed: false };
  } catch {
    return { isClosed: false };
  }
}
