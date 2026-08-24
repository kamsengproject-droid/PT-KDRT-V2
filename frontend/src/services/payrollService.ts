import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  orderBy,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  AttendanceBonusWeek,
  AttendanceRecord,
  Employee,
  Holiday,
  PayrollRecord,
  PayrollStatus,
  WorkplaceSchedule,
} from '../types';
import {
  hitungUangRajinMingguan,
  getMingguDalamBulan,
  DEFAULT_SCHEDULE,
} from '../utils/attendanceCalc';
import { formatTanggal, formatBulanTahun, tanggalHariIni } from '../utils/formatters';
import { catatAuditLog } from './auditService';
import { tambahPengeluaran } from './expenseService';
import { getAttendanceRange } from './attendanceService';

// ==========================================
// 1. UANG RAJIN SERVICES (FIRESTORE: attendanceBonuses)
// ==========================================

export function subscribeAttendanceBonuses(
  weekStart?: string,
  callback?: (bonuses: AttendanceBonusWeek[]) => void
) {
  const colRef = collection(db, 'attendanceBonuses');
  const q = weekStart
    ? query(colRef, where('weekStart', '==', weekStart))
    : query(colRef, orderBy('weekStart', 'desc'));

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as AttendanceBonusWeek[];
      if (callback) callback(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, 'attendanceBonuses');
    }
  );
}

export function subscribeAttendanceBonusesByEmployee(
  employeeId: string,
  callback: (bonuses: AttendanceBonusWeek[]) => void,
  onError?: (err: any) => void
) {
  const colRef = collection(db, 'attendanceBonuses');
  const q = query(
    colRef,
    where('employeeId', '==', employeeId)
  );

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as AttendanceBonusWeek[];
      list.sort((a, b) => (b.weekStart || '').localeCompare(a.weekStart || ''));
      callback(list);
    },
    (err) => {
      console.error('[EMPLOYEE_PAYROLL_ERROR]', {
        type: 'attendanceBonuses',
        code: err?.code,
        message: err?.message,
      });
      handleFirestoreError(err, OperationType.GET, 'attendanceBonuses');
      if (onError) onError(err);
    }
  );
}

export async function hitungDanSimpanBonusMingguan(
  employee: Employee,
  weekStart: string,
  weekEnd: string,
  attendanceRecords: AttendanceRecord[],
  holidays: Holiday[] = [],
  schedule: WorkplaceSchedule = DEFAULT_SCHEDULE
): Promise<AttendanceBonusWeek> {
  const docId = `${employee.id}_${weekStart}`;
  const docRef = doc(db, 'attendanceBonuses', docId);

  // Check if existing document
  const existingSnap = await getDoc(docRef);
  const isPaid = existingSnap.exists() && existingSnap.data().status === 'SUDAH DIBAYAR';

  const baseBonus = schedule.rajinWeeklyBonus !== undefined ? Number(schedule.rajinWeeklyBonus) : 150000;
  const lateDeduction = schedule.lateDeduction !== undefined ? Number(schedule.lateDeduction) : 20000;
  const minBonus = schedule.minRajinBonus !== undefined ? Number(schedule.minRajinBonus) : 0;
  const workDays = schedule.workDays || DEFAULT_SCHEDULE.workDays;

  const calc = hitungUangRajinMingguan(
    attendanceRecords,
    weekStart,
    weekEnd,
    holidays,
    baseBonus,
    lateDeduction,
    workDays,
    minBonus
  );

  const bonusData: AttendanceBonusWeek = {
    id: docId,
    employeeId: employee.id!,
    employeeName: employee.name,
    weekStart,
    weekEnd,
    month: weekStart.substring(0, 7), // YYYY-MM
    label: `${formatTanggal(weekStart)} – ${formatTanggal(weekEnd)}`,
    baseBonus: calc.baseBonus,
    eligibleWorkDays: calc.eligibleWorkDays,
    presentDays: calc.presentDays,
    lateDays: calc.lateDays,
    lateCount: calc.lateCount,
    lateDeduction: calc.lateDeduction,
    deduction: calc.deduction,
    bonusAmount: calc.bonusAmount,
    finalBonus: calc.finalBonus,
    isFullAttendance: calc.isFullAttendance,
    reason: calc.reason,
    status: isPaid ? 'SUDAH DIBAYAR' : 'CALCULATED',
    breakdown: calc.breakdown,
  };

  const payload: any = {
    ...bonusData,
    updatedAt: serverTimestamp(),
  };

  if (!existingSnap.exists()) {
    payload.createdAt = serverTimestamp();
  }

  await setDoc(docRef, payload, { merge: true });
  return bonusData;
}

export async function hitungDanSimpanSemuaBonusBulan(
  employees: Employee[],
  month: string, // YYYY-MM
  holidays: Holiday[] = [],
  schedule: WorkplaceSchedule = DEFAULT_SCHEDULE,
  currentUserId: string = 'system',
  currentUserName: string = 'Sistem PT.KDRT'
): Promise<AttendanceBonusWeek[]> {
  const weeks = getMingguDalamBulan(month);
  const sharingEmployees = employees.filter((e) => (e.scope || 'SHARING') === 'SHARING');
  const allCalculated: AttendanceBonusWeek[] = [];

  for (const week of weeks) {
    const records = await getAttendanceRange(week.weekStart, week.weekEnd);
    for (const emp of sharingEmployees) {
      const empRecords = records.filter((r) => r.employeeId === emp.id);
      const res = await hitungDanSimpanBonusMingguan(
        emp,
        week.weekStart,
        week.weekEnd,
        empRecords,
        holidays,
        schedule
      );
      allCalculated.push(res);
    }
  }

  await catatAuditLog(
    currentUserId,
    currentUserName,
    'ATTENDANCE_BONUS_CALCULATED',
    `Bulan ${formatBulanTahun(month)}`,
    `Kalkulasi otomatis Uang Rajin untuk ${sharingEmployees.length} karyawan (${weeks.length} minggu kalender).`
  );

  return allCalculated;
}

export async function bayarUangRajin(
  bonus: AttendanceBonusWeek,
  currentUserId: string,
  currentUserName: string
) {
  if (bonus.status === 'SUDAH DIBAYAR') {
    throw new Error('Uang Rajin ini sudah pernah dibayar.');
  }

  const docId = bonus.id || `${bonus.employeeId}_${bonus.weekStart}`;
  const docRef = doc(db, 'attendanceBonuses', docId);

  // 1. Update status bonus
  await setDoc(
  docRef,
  {
    ...bonus,
    status: 'SUDAH DIBAYAR',
    paidAt: serverTimestamp(),
    paidBy: currentUserId,
    paidByName: currentUserName,
    paymentDate: tanggalHariIni(),
    updatedAt: serverTimestamp(),
  },
  { merge: true }
);

  // 2. Insert expense transaction into expenses collection
  await tambahPengeluaran(
    {
      date: tanggalHariIni(),
      amount: bonus.finalBonus,
      category: 'ATTENDANCE_BONUS',
      scope: 'SHARING',
      employeeId: bonus.employeeId,
      employeeName: bonus.employeeName,
      description: `Uang Rajin ${bonus.employeeName} (${bonus.label}) - ${bonus.reason || 'Bonus Kehadiran'}`,
    },
    currentUserId,
    currentUserName
  );

  // 3. Log Audit
  await catatAuditLog(
    currentUserId,
    currentUserName,
    'BAYAR_UANG_RAJIN',
    bonus.employeeName,
    `Dibayar Rp ${bonus.finalBonus.toLocaleString('id-ID')} untuk periode ${bonus.label}`
  );
}

// ==========================================
// 2. PENGGAJIAN / PAYROLL SERVICES (FIRESTORE: payroll)
// ==========================================

export function subscribePayroll(
  month?: string, // e.g. '2026-08'
  callback?: (payrolls: PayrollRecord[]) => void
) {
  const colRef = collection(db, 'payroll');
  const q = month
    ? query(colRef, where('month', '==', month))
    : query(colRef, orderBy('month', 'desc'));

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data();
        const baseSalary = Number(data.baseSalary) || 0;
        const attendanceBonus = Number(data.attendanceBonus) || 0;
        const bonus = Number(data.bonus || data.bonusAmount) || 0;
        const adjustmentAddition = Number(data.adjustmentAddition) || 0;
        const adjustmentDeduction = Number(data.adjustmentDeduction || data.deduction) || 0;
        const total = Math.max(0, baseSalary + attendanceBonus + bonus + adjustmentAddition - adjustmentDeduction);

        return {
          id: d.id,
          ...data,
          baseSalary,
          attendanceBonus,
          bonus,
          adjustmentAddition,
          adjustmentDeduction,
          totalPay: total,
          total,
        };
      }) as PayrollRecord[];
      if (callback) callback(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, 'payroll');
    }
  );
}

export function subscribeEmployeePayroll(
  employeeId: string,
  callback: (payrolls: PayrollRecord[]) => void,
  onError?: (err: any) => void
) {
  const q = query(
    collection(db, 'payroll'),
    where('employeeId', '==', employeeId)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data();
        const baseSalary = Number(data.baseSalary) || 0;
        const attendanceBonus = Number(data.attendanceBonus) || 0;
        const bonus = Number(data.bonus || data.bonusAmount) || 0;
        const adjustmentAddition = Number(data.adjustmentAddition) || 0;
        const adjustmentDeduction = Number(data.adjustmentDeduction || data.deduction) || 0;
        const total = Math.max(0, baseSalary + attendanceBonus + bonus + adjustmentAddition - adjustmentDeduction);

        return {
          id: d.id,
          ...data,
          baseSalary,
          attendanceBonus,
          bonus,
          adjustmentAddition,
          adjustmentDeduction,
          totalPay: total,
          total,
        };
      }) as PayrollRecord[];
      list.sort((a, b) => (b.month || '').localeCompare(a.month || ''));
      callback(list);
    },
    (err) => {
      console.error('[EMPLOYEE_PAYROLL_ERROR]', {
        type: 'payroll',
        code: err?.code,
        message: err?.message,
      });
      handleFirestoreError(err, OperationType.GET, 'payroll');
      if (onError) onError(err);
    }
  );
}

// Hitung payroll bulanan untuk seluruh karyawan sharing
export async function hitungDanSinkronisasiPayrollBulanan(
  month: string, // YYYY-MM
  employees: Employee[],
  holidays: Holiday[] = [],
  schedule: WorkplaceSchedule = DEFAULT_SCHEDULE,
  currentUserId: string = 'system',
  currentUserName: string = 'Owner PT.KDRT'
): Promise<PayrollRecord[]> {
  const sharingEmployees = employees.filter((e) => (e.scope || 'SHARING') === 'SHARING');
  if (sharingEmployees.length === 0) return [];

  // 1. Pastikan seluruh Uang Rajin minggu dalam bulan tersebut sudah dikalkulasi
  const weeks = getMingguDalamBulan(month);
  const weekBonusesMap = new Map<string, number>(); // employeeId -> total Uang Rajin

  for (const week of weeks) {
    const records = await getAttendanceRange(week.weekStart, week.weekEnd);
    for (const emp of sharingEmployees) {
      const empRecords = records.filter((r) => r.employeeId === emp.id);
      const bonusRes = await hitungDanSimpanBonusMingguan(
        emp,
        week.weekStart,
        week.weekEnd,
        empRecords,
        holidays,
        schedule
      );
      const prev = weekBonusesMap.get(emp.id!) || 0;
      weekBonusesMap.set(emp.id!, prev + bonusRes.finalBonus);
    }
  }

  const results: PayrollRecord[] = [];

  // 2. Kalkulasi tiap employee
  for (const emp of sharingEmployees) {
    const docId = `${emp.id}_${month}`;
    const docRef = doc(db, 'payroll', docId);
    const existingSnap = await getDoc(docRef);

    const baseSalary = Number(emp.baseSalary) || 0;
    const attBonus = weekBonusesMap.get(emp.id!) || 0;

    let existingData: any = {};
    if (existingSnap.exists()) {
      existingData = existingSnap.data();
    }

    const bonus = Number(existingData.bonus || existingData.bonusAmount) || 0;
    const bonusNote = existingData.bonusNote || '';
    const adjustmentAddition = Number(existingData.adjustmentAddition) || 0;
    const adjustmentAdditionNote = existingData.adjustmentAdditionNote || '';
    const adjustmentDeduction = Number(existingData.adjustmentDeduction || existingData.deduction) || 0;
    const adjustmentDeductionNote = existingData.adjustmentDeductionNote || existingData.deductionNote || '';

    const currentStatus: PayrollStatus =
      existingData.status === 'PAID' || existingData.status === 'SUDAH DIBAYAR'
        ? 'PAID'
        : existingData.status === 'APPROVED'
        ? 'APPROVED'
        : 'CALCULATED';

    const totalPay = Math.max(0, baseSalary + attBonus + bonus + adjustmentAddition - adjustmentDeduction);

    const [yearStr, monthNumStr] = month.split('-');
    const recordPayload: PayrollRecord = {
      id: docId,
      payrollId: `payroll_${month}`,
      employeeId: emp.id!,
      employeeName: emp.name,
      jobTitle: emp.position,
      month,
      monthLabel: formatBulanTahun(month),
      periodMonth: month,
      periodYear: parseInt(yearStr, 10),
      baseSalary,
      attendanceBonus: attBonus,
      bonus,
      bonusAmount: bonus,
      bonusNote,
      adjustmentAddition,
      adjustmentAdditionNote,
      adjustmentDeduction,
      adjustmentDeductionNote,
      deduction: adjustmentDeduction,
      deductionNote: adjustmentDeductionNote,
      totalPay,
      total: totalPay,
      status: currentStatus,
      paymentDate: existingData.paymentDate || '25',
      paidAt: existingData.paidAt || null,
      paidBy: existingData.paidBy || null,
      paidByName: existingData.paidByName || null,
      approvedAt: existingData.approvedAt || null,
      approvedBy: existingData.approvedBy || null,
      approvedByName: existingData.approvedByName || null,
      expenseId: existingData.expenseId || null,
      updatedAt: serverTimestamp(),
      updatedBy: currentUserId,
    };

    if (!existingSnap.exists()) {
      recordPayload.createdAt = serverTimestamp();
      recordPayload.createdBy = currentUserId;
    }

    await setDoc(docRef, recordPayload, { merge: true });
    results.push(recordPayload);
  }

  await catatAuditLog(
    currentUserId,
    currentUserName,
    'PAYROLL_CALCULATED',
    `Payroll ${formatBulanTahun(month)}`,
    `Kalkulasi payroll berhasil untuk ${results.length} karyawan. Total Gaji Pokok: Rp ${results.reduce((s, r) => s + r.baseSalary, 0).toLocaleString('id-ID')}, Total Uang Rajin: Rp ${results.reduce((s, r) => s + r.attendanceBonus, 0).toLocaleString('id-ID')}`
  );

  return results;
}

// Update Manual Bonus oleh Owner
export async function updateBonusManual(
  payroll: PayrollRecord,
  bonusAmount: number,
  bonusNote: string,
  currentUserId: string,
  currentUserName: string
) {
  if (payroll.status === 'PAID') {
    throw new Error('Tidak dapat mengubah bonus pada payroll yang sudah dibayar.');
  }

  const docId = payroll.id || `${payroll.employeeId}_${payroll.month}`;
  const docRef = doc(db, 'payroll', docId);

  const bonus = Number(bonusAmount) || 0;
  const total = Math.max(
    0,
    payroll.baseSalary +
      payroll.attendanceBonus +
      bonus +
      (payroll.adjustmentAddition || 0) -
      (payroll.adjustmentDeduction || 0)
  );

  await updateDoc(docRef, {
    bonus,
    bonusAmount: bonus,
    bonusNote: bonusNote || '',
    totalPay: total,
    total,
    updatedAt: serverTimestamp(),
    updatedBy: currentUserId,
  });

  await catatAuditLog(
    currentUserId,
    currentUserName,
    'BONUS_ADDED',
    `${payroll.employeeName} (${formatBulanTahun(payroll.month)})`,
    `Bonus: Rp ${bonus.toLocaleString('id-ID')}. Catatan: ${bonusNote || '-'}`
  );
}

// Update Manual Penyesuaian (Addition / Deduction) oleh Owner
export async function updateAdjustmentManual(
  payroll: PayrollRecord,
  type: 'ADDITION' | 'DEDUCTION',
  amount: number,
  note: string,
  currentUserId: string,
  currentUserName: string
) {
  if (payroll.status === 'PAID') {
    throw new Error('Tidak dapat mengubah penyesuaian pada payroll yang sudah dibayar.');
  }

  const docId = payroll.id || `${payroll.employeeId}_${payroll.month}`;
  const docRef = doc(db, 'payroll', docId);

  const val = Math.max(0, Number(amount) || 0);
  let adjAddition = payroll.adjustmentAddition || 0;
  let adjAdditionNote = payroll.adjustmentAdditionNote || '';
  let adjDeduction = payroll.adjustmentDeduction || 0;
  let adjDeductionNote = payroll.adjustmentDeductionNote || '';

  if (type === 'ADDITION') {
    adjAddition = val;
    adjAdditionNote = note || '';
  } else {
    adjDeduction = val;
    adjDeductionNote = note || '';
  }

  const total = Math.max(
    0,
    payroll.baseSalary + payroll.attendanceBonus + (payroll.bonus || 0) + adjAddition - adjDeduction
  );

  await updateDoc(docRef, {
    adjustmentAddition: adjAddition,
    adjustmentAdditionNote: adjAdditionNote,
    adjustmentDeduction: adjDeduction,
    adjustmentDeductionNote: adjDeductionNote,
    deduction: adjDeduction,
    deductionNote: adjDeductionNote,
    totalPay: total,
    total,
    updatedAt: serverTimestamp(),
    updatedBy: currentUserId,
  });

  await catatAuditLog(
    currentUserId,
    currentUserName,
    'ADJUSTMENT_ADDED',
    `${payroll.employeeName} (${formatBulanTahun(payroll.month)})`,
    `Penyesuaian ${type}: Rp ${val.toLocaleString('id-ID')}. Catatan: ${note || '-'}`
  );
}

// Setujui Payroll (Status -> APPROVED)
export async function setujuiPayroll(
  month: string,
  payrollRecords: PayrollRecord[],
  currentUserId: string,
  currentUserName: string
) {
  for (const record of payrollRecords) {
    if (record.status !== 'PAID') {
      const docId = record.id || `${record.employeeId}_${record.month}`;
      const docRef = doc(db, 'payroll', docId);

      await setDoc(
        docRef,
        {
          ...record,
          status: 'APPROVED',
          approvedAt: serverTimestamp(),
          approvedBy: currentUserId,
          approvedByName: currentUserName,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  }

  await catatAuditLog(
    currentUserId,
    currentUserName,
    'PAYROLL_APPROVED',
    `Payroll ${formatBulanTahun(month)}`,
    `Payroll disetujui untuk ${payrollRecords.length} karyawan.`
  );
}



// Bayar Payroll Karyawan & Integrasi Transaksi Keuangan (Anti Double-Payment)
export async function bayarGaji(
  payroll: PayrollRecord,
  currentUserId: string,
  currentUserName: string
) {
  if (payroll.status === 'PAID') {
    throw new Error('Gaji ini sudah pernah dibayar (SUDAH DIBAYAR).');
  }

  const docId = payroll.id || `${payroll.employeeId}_${payroll.month}`;
  const docRef = doc(db, 'payroll', docId);

  // Verifikasi snapshot aktual untuk mencegah race condition double-payment
  const snap = await getDoc(docRef);
  if (snap.exists() && snap.data().status === 'PAID') {
    throw new Error('Gaji ini sudah berstatus SUDAH DIBAYAR pada sistem.');
  }

  const total =
    payroll.totalPay ||
    payroll.total ||
    Math.max(
      0,
      Number(payroll.baseSalary) +
        Number(payroll.attendanceBonus) +
        Number(payroll.bonus || 0) +
        Number(payroll.adjustmentAddition || 0) -
        Number(payroll.adjustmentDeduction || payroll.deduction || 0)
    );

  // 1. Record single expense transaction into expenses collection
  const expenseId = await tambahPengeluaran(
    {
      date: tanggalHariIni(),
      amount: total,
      category: 'SALARY',
      scope: 'SHARING',
      employeeId: payroll.employeeId,
      employeeName: payroll.employeeName,
      payrollId: docId,
      description: `Payroll ${payroll.employeeName} (${formatBulanTahun(payroll.month)}) - Gaji Pokok: Rp${payroll.baseSalary.toLocaleString('id-ID')}, Uang Rajin: Rp${payroll.attendanceBonus.toLocaleString('id-ID')}${payroll.bonus > 0 ? `, Bonus: Rp${payroll.bonus.toLocaleString('id-ID')}` : ''}${payroll.adjustmentAddition > 0 ? `, Penyesuaian (+): Rp${payroll.adjustmentAddition.toLocaleString('id-ID')}` : ''}${payroll.adjustmentDeduction > 0 ? `, Potongan (-): Rp${payroll.adjustmentDeduction.toLocaleString('id-ID')}` : ''}`,
    },
    currentUserId,
    currentUserName
  );

  // 2. Update status payroll to PAID
  await updateDoc(docRef, {
    status: 'PAID',
    paymentDate: tanggalHariIni(),
    paidAt: serverTimestamp(),
    paidBy: currentUserId,
    paidByName: currentUserName,
    totalPay: total,
    total,
    expenseId: expenseId || null,
    updatedAt: serverTimestamp(),
  });

  // 3. Log Audit
  await catatAuditLog(
    currentUserId,
    currentUserName,
    'PAYROLL_PAID',
    payroll.employeeName,
    `Dibayar Gaji & Uang Rajin Rp ${total.toLocaleString('id-ID')} Periode ${formatBulanTahun(payroll.month)}`
  );

  await catatAuditLog(
    currentUserId,
    currentUserName,
    'PAYROLL_EXPENSE_CREATED',
    payroll.employeeName,
    `Pengeluaran kas otomatis dibuat (Expense ID: ${expenseId}) sebesar Rp ${total.toLocaleString('id-ID')}`
  );
}

// Helper untuk kompatibilitas simpan draft
export async function simpanDraftPayroll(
  payroll: PayrollRecord,
  currentUserId: string,
  currentUserName: string
) {
  const docId = payroll.id || `${payroll.employeeId}_${payroll.month}`;
  const docRef = doc(db, 'payroll', docId);

  const baseSalary = Number(payroll.baseSalary) || 0;
  const attendanceBonus = Number(payroll.attendanceBonus) || 0;
  const bonus = Number(payroll.bonus || payroll.bonusAmount) || 0;
  const adjustmentAddition = Number(payroll.adjustmentAddition) || 0;
  const adjustmentDeduction = Number(payroll.adjustmentDeduction || payroll.deduction) || 0;
  const total = Math.max(0, baseSalary + attendanceBonus + bonus + adjustmentAddition - adjustmentDeduction);

  const payload: PayrollRecord = {
    ...payroll,
    baseSalary,
    attendanceBonus,
    bonus,
    bonusAmount: bonus,
    adjustmentAddition,
    adjustmentDeduction,
    deduction: adjustmentDeduction,
    totalPay: total,
    total,
    monthLabel: formatBulanTahun(payroll.month),
    updatedAt: serverTimestamp(),
    updatedBy: currentUserId,
  };

  await setDoc(docRef, payload, { merge: true });

  await catatAuditLog(
    currentUserId,
    currentUserName,
    'PAYROLL_CREATED',
    `${payroll.employeeName} (${payroll.month})`,
    `Draft Payroll tersimpan: Rp ${total.toLocaleString('id-ID')}`
  );
}
