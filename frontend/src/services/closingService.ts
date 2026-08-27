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
  DailyTask,
  ContentCalendarItem,
  ScopeType,
} from '../types';
import { catatAuditLog } from './auditService';

const CLOSINGS_COLLECTION = 'monthlyClosings';
const ADJUSTMENTS_COLLECTION = 'financialAdjustments';

/**
 * Subscribe seluruh closing bulanan.
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
      handleFirestoreError(
        error,
        OperationType.GET,
        CLOSINGS_COLLECTION
      );
    }
  );
}

/**
 * Ambil closing untuk periode + scope tertentu.
 */
export async function getMonthlyClosing(
  period: string,
  scope: ReportScopeFilter
): Promise<MonthlyClosing | null> {
  const closingId = `CLOSING_${period}_${scope}`;

  try {
    const ref = doc(db, CLOSINGS_COLLECTION, closingId);
    const snap = await getDoc(ref);

    if (!snap.exists()) return null;

    return {
      id: snap.id,
      ...snap.data(),
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

/**
 * Hitung snapshot bulanan.
 *
 * PEMISAHAN KEUANGAN:
 *
 * 1. dailyPerformance
 *    = data performa akun
 *    = GMV / estimasi komisi / komisi real
 *
 * 2. transactions
 *    = Kas & Bank aktual
 *    = uang masuk manual
 *    = uang keluar
 *    = Pindah Dana yang sudah masuk rekening
 *
 * Komisi Real TIDAK dihitung sebagai Uang Masuk.
 *
 * Hanya FUND_TRANSFER yang dianggap uang masuk bank,
 * menggunakan netAmount karena admin TikTok sudah dipotong.
 */
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
  let year: number;
  let month: number;
  let scope: ReportScopeFilter;

  if (typeof yearOrPeriod === 'string') {
    const parts = yearOrPeriod.split('-');

    year = parseInt(parts[0], 10) || new Date().getFullYear();
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
    month < 10 ? `0${month}` : `${month}`;

  const period = `${year}-${monthStr}`;
  const startDate = `${period}-01`;

  const lastDay = new Date(
    year,
    month,
    0
  ).getDate();

  const endDate =
    `${period}-${lastDay < 10 ? `0${lastDay}` : lastDay}`;

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

  const filteredTx = allTx.filter((t) => {
    if (!t.date) return false;

    if (
      t.date < startDate ||
      t.date > endDate
    ) {
      return false;
    }

    if (
      scope !== 'GABUNGAN' &&
      t.scope !== scope
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

  filteredTx.forEach((t) => {
    const sourceType =
      t.sourceType || 'LAINNYA';

    /*
     * KOMISI REAL BUKAN UANG BANK.
     *
     * Data lama mungkin masih memiliki transaksi
     * sourceType COMMISSION_REAL / TIKTOK_COMMISSION.
     *
     * Jangan ikutkan ke Kas & Bank.
     */
    if (
      sourceType === 'COMMISSION_REAL' ||
      sourceType === 'TIKTOK_COMMISSION'
    ) {
      return;
    }

    /*
     * Pindah Dana:
     *
     * Komisi bruto - Admin TikTok = uang benar-benar
     * diterima rekening bank.
     *
     * Hanya dihitung sebagai Uang Masuk Kas & Bank.
     */
    if (
      sourceType === 'FUND_TRANSFER' ||
      (t.type === 'TRANSFER' &&
        sourceType === 'FUND_TRANSFER')
    ) {
      const netAmount =
        Number(t.netAmount) ||
        Math.max(
          0,
          Number(t.amount) -
            Number(t.adminFee || 0)
        );

      if (netAmount > 0) {
        uangMasuk += netAmount;

        sourceTypeBreakdown[sourceType] =
          (sourceTypeBreakdown[sourceType] || 0) +
          netAmount;
      }

      return;
    }

    /*
     * Uang Masuk biasa.
     *
     * MANUAL / sumber income lainnya.
     */
    if (t.type === 'INCOME') {
      const amount = Number(t.amount) || 0;

      uangMasuk += amount;

      sourceTypeBreakdown[sourceType] =
        (sourceTypeBreakdown[sourceType] || 0) +
        amount;

      return;
    }

    /*
     * Semua transaksi EXPENSE mengurangi Kas & Bank.
     *
     * Approval payroll sudah ditangani di payrollService.
     * Hanya transaksi yang benar-benar dibuat sebagai
     * financial transaction yang masuk ke sini.
     */
    if (t.type === 'EXPENSE') {
      uangKeluar += Number(t.amount) || 0;
    }
  });

  const saldoBersih =
    uangMasuk - uangKeluar;

  /* ============================================================
     2. DAILY PERFORMANCE
        BUKAN KAS & BANK
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

  filteredPerf.forEach((p) => {
    gmv += Number(p.gmv) || 0;
    estimasiKomisi +=
      Number(p.estimatedCommission) || 0;
    komisiReal +=
      Number(p.realCommission) || 0;
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

  const filteredExp = allExp.filter((e) => {
    if (!e.date) return false;

    if (
      e.date < startDate ||
      e.date > endDate
    ) {
      return false;
    }

    if (
      scope !== 'GABUNGAN' &&
      e.scope !== scope
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

  filteredExp.forEach((e) => {
    const amount = Number(e.amount) || 0;
    const category =
      e.category || 'OPERASIONAL';

    totalExpense += amount;

    expenseCategoryBreakdown[category] =
      (expenseCategoryBreakdown[category] || 0) +
      amount;

    if (category === 'SAMPEL') {
      totalSampleExpense += amount;
    }

    const name =
      e.description ||
      e.category ||
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

  const filteredPay = allPay.filter((p) => {
    if (
      p.month !== period &&
      p.paymentDate &&
      (
        p.paymentDate < startDate ||
        p.paymentDate > endDate
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

  filteredPay.forEach((p) => {
    const net =
      Number(p.totalPay) ||
      Number(p.total) ||
      0;

    totalPayroll += net;
    totalGajiPokok +=
      Number(p.baseSalary) || 0;

    totalUangRajin +=
      Number(p.attendanceBonus) || 0;

    totalBonus +=
      Number(p.bonus) ||
      Number(p.bonusAmount) ||
      0;

    if (p.status === 'PAID') {
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
    allSettlements.filter((s) => {
      const settlementPeriod =
        `${s.year}-${String(s.month).padStart(2, '0')}`;

      return (
        settlementPeriod === period ||
        (
          s.periodStart &&
          s.periodStart.startsWith(period)
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

  filteredSettlements.forEach((s) => {
    totalProfitSharingMasuk +=
      Number(s.totalIncome) || 0;

    hakInvestor +=
      Number(s.investorAmount) || 0;

    hakOwner +=
      Number(s.ownerAmount) || 0;

    hakTalent +=
      Number(s.talentAmount) || 0;

    hakEditor +=
      Number(s.editorAmount) || 0;

    budgetPerusahaan +=
      Number(s.companyBudgetAmount) || 0;

    investorPaid +=
      Number(s.totalPaidToInvestor) || 0;

    investorUnpaid +=
      Number(s.remainingInvestorObligation) || 0;
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
    const contSnap = await getDocs(
      collection(db, 'contentCalendar')
    );

    const allCont = contSnap.docs.map(
      (d) =>
        ({
          id: d.id,
          ...d.data(),
        }) as ContentCalendarItem
    );

    const filteredCont = allCont.filter((c) => {
      if (!c.date) return false;

      if (
        c.date < startDate ||
        c.date > endDate
      ) {
        return false;
      }

      if (
        scope !== 'GABUNGAN' &&
        c.scope !== scope
      ) {
        return false;
      }

      return true;
    });

    totalContentPlanned =
      filteredCont.length;

    totalContentPosted =
      filteredCont.filter(
        (c) => c.status === 'DIPOSTING'
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

    const allTasks = taskSnap.docs.map(
      (d) =>
        ({
          id: d.id,
          ...d.data(),
        }) as DailyTask
    );

    const filteredTasks = allTasks.filter((t) => {
      if (!t.tanggal) return false;

      return (
        t.tanggal >= startDate &&
        t.tanggal <= endDate
      );
    });

    totalTasksCompleted =
      filteredTasks.filter(
        (t) => t.status === 'SELESAI'
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
    const recSnap = await getDocs(
      collection(
        db,
        'cashReconciliations'
      )
    );

    if (!recSnap.empty) {
      const recs = recSnap.docs.map(
        (d) => d.data()
      );

      const monthRecs = recs.filter(
        (r: any) =>
          r.reconcileDate &&
          r.reconcileDate.startsWith(period)
      );

      if (monthRecs.length > 0) {
        const latest =
          monthRecs[monthRecs.length - 1] as any;

        reconciliationSnapshot = {
          saldoBuku:
            Number(latest.saldoBuku) ||
            saldoBersih,

          saldoAktual:
            Number(latest.saldoAktual) ||
            saldoBersih,

          selisih:
            Number(latest.selisih) || 0,

          status:
            latest.status ||
            (
              Number(latest.selisih) === 0
                ? 'SEIMBANG'
                : Number(latest.selisih) > 0
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

  /* ============================================================
     RETURN SNAPSHOT
     ============================================================ */

  return {
    closingId:
      `CLOSING_${period}_${scope}`,

    year,
    month,
    period,
    scope,

    /*
     * KAS & BANK
     */
    uangMasuk,
    uangKeluar,
    saldoBersih,

    /*
     * PERFORMA AKUN
     */
    gmv,
    estimasiKomisi,
    komisiReal,

    /*
     * EXPENSE
     */
    totalExpense,
    totalSampleExpense,

    /*
     * ASSET
     */
    totalInventoryValue,

    /*
     * PAYROLL
     */
    totalPayroll,
    totalGajiPokok,
    totalUangRajin,
    totalBonus,
    totalPayrollPaid,
    totalPayrollUnpaid,

    /*
     * PROFIT SHARING
     */
    totalProfitSharingMasuk,
    hakInvestor,
    hakOwner,
    hakTalent,
    hakEditor,
    budgetPerusahaan,
    investorPaid,
    investorUnpaid,

    /*
     * CONTENT / TASK
     */
    totalContentPlanned,
    totalContentPosted,
    totalTasksCompleted,

    /*
     * BREAKDOWN
     */
    sourceTypeBreakdown,
    expenseCategoryBreakdown,
    topExpenses,

    /*
     * REKONSILIASI
     */
    reconciliationSnapshot,
  };
}

/**
 * Tutup bulan.
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
    month < 10 ? `0${month}` : `${month}`;

  const period =
    `${year}-${monthStr}`;

  const closingId =
    `CLOSING_${period}_${scope}`;

  const computedSnapshot =
    await computeMonthlySnapshot(
      year,
      month,
      scope
    );

  const closingData: MonthlyClosing = {
    ...computedSnapshot,

    status: 'CLOSED',

    notes: notes || '',

    closedAt: serverTimestamp(),

    closedBy:
      userProfile.uid,

    closedByName:
      userProfile.name,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = doc(
    db,
    CLOSINGS_COLLECTION,
    closingId
  );

  await setDoc(
    ref,
    closingData,
    { merge: true }
  );

  await catatAuditLog(
    userProfile.uid,
    userProfile.name,
    'MONTH_CLOSED',
    `monthlyClosing/${closingId}`,
    `Penutupan Buku Bulan ${period} (${scope}). ` +
      `Saldo Kas & Bank: ${computedSnapshot.saldoBersih}, ` +
      `Uang Masuk: ${computedSnapshot.uangMasuk}, ` +
      `Uang Keluar: ${computedSnapshot.uangKeluar}, ` +
      `Komisi Real: ${computedSnapshot.komisiReal} ` +
      `(tidak dihitung sebagai saldo bank)`
  );

  return closingData;
}

/**
 * Buka kembali bulan.
 */
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

  const ref = doc(
    db,
    CLOSINGS_COLLECTION,
    closingId
  );

  await updateDoc(ref, {
    status: 'OPEN',
    reopenedAt: serverTimestamp(),
    reopenedBy: userProfile.uid,
    reopenedByName: userProfile.name,
    reopenReason: reason.trim(),
    updatedAt: serverTimestamp(),
  });

  await catatAuditLog(
    userProfile.uid,
    userProfile.name,
    'MONTH_REOPENED',
    `monthlyClosing/${closingId}`,
    `Buka kembali periode buku: ${closingId}. ` +
      `Alasan: ${reason.trim()}`
  );
}

/**
 * Financial adjustment untuk periode yang sudah ditutup.
 */
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

  if (
    !adjustment.amount ||
    adjustment.amount <= 0
  ) {
    throw new Error(
      'Nominal adjustment harus lebih dari 0.'
    );
  }

  const adjustmentId =
    `ADJ_${Date.now()}`;

  const newAdjustment:
    FinancialAdjustment = {
      ...adjustment,
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
      newAdjustment
    );

  /*
   * Adjustment memang mempengaruhi Kas & Bank.
   *
   * Berbeda dengan Komisi Real:
   * adjustment adalah koreksi accounting
   * yang memang sengaja dimasukkan Owner.
   */
  await addDoc(
    collection(db, 'transactions'),
    {
      transactionId:
        `TX_${adjustmentId}`,

      date:
        adjustment.period
          ? `${adjustment.period}-01`
          : new Date()
              .toISOString()
              .slice(0, 10),

      type:
        adjustment.type ===
        'INCOME_ADJUSTMENT'
          ? 'INCOME'
          : 'EXPENSE',

      scope:
        adjustment.scope,

      category:
        adjustment.category ||
        'OPERASIONAL',

      sourceType:
        adjustment.sourceType ||
        'FINANCIAL_ADJUSTMENT',

      amount:
        Number(adjustment.amount),

      description:
        `[ADJUSTMENT ${adjustment.period}] ` +
        `${adjustment.description}: ` +
        `${adjustment.reason}`,

      createdBy:
        userProfile.uid,

      createdByName:
        userProfile.name,

      createdAt:
        serverTimestamp(),

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
    `Adjustment Keuangan ${adjustment.type} ` +
      `Rp ${Number(
        adjustment.amount
      ).toLocaleString('id-ID')} ` +
      `untuk periode ${adjustment.period} ` +
      `(${adjustment.scope}). ` +
      `Alasan: ${adjustment.reason}`
  );

  return adjustmentRef.id;
}

/**
 * Cek apakah tanggal berada dalam periode yang sudah ditutup.
 */
export async function checkIsDateClosed(
  dateStr: string,
  scope: ScopeType
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

    const gabunganClosing =
      await getMonthlyClosing(
        period,
        'GABUNGAN'
      );

    if (
      gabunganClosing &&
      gabunganClosing.status === 'CLOSED'
    ) {
      return {
        isClosed: true,
        closingInfo: gabunganClosing,
      };
    }

    return {
      isClosed: false,
    };
  } catch {
    return {
      isClosed: false,
    };
  }
}
