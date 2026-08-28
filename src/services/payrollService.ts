import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  orderBy,
} from 'firebase/firestore';

import {
  db,
  handleFirestoreError,
  OperationType,
} from '../firebase';

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

import {
  formatTanggal,
  formatBulanTahun,
  tanggalHariIni,
} from '../utils/formatters';

import { catatAuditLog } from './auditService';
import { tambahPengeluaran } from './expenseService';
import { getAttendanceRange } from './attendanceService';
import {
  createFinancialTransaction,
} from './transactionService';

/* ============================================================
   UANG RAJIN
============================================================ */

export function subscribeAttendanceBonuses(
  weekStart?: string,
  callback?: (bonuses: AttendanceBonusWeek[]) => void
) {
  const colRef = collection(db, 'attendanceBonuses');

  const q = weekStart
    ? query(
        colRef,
        where('weekStart', '==', weekStart)
      )
    : query(
        colRef,
        orderBy('weekStart', 'desc')
      );

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
      handleFirestoreError(
        err,
        OperationType.GET,
        'attendanceBonuses'
      );
    }
  );
}

export function subscribeAttendanceBonusesByEmployee(
  employeeId: string,
  callback: (bonuses: AttendanceBonusWeek[]) => void,
  onError?: (err: any) => void
) {
  const colRef =
    collection(db, 'attendanceBonuses');

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

      list.sort((a, b) =>
        (b.weekStart || '').localeCompare(
          a.weekStart || ''
        )
      );

      callback(list);
    },
    (err) => {
      console.error(
        '[EMPLOYEE_PAYROLL_ERROR]',
        {
          type: 'attendanceBonuses',
          code: err?.code,
          message: err?.message,
        }
      );

      handleFirestoreError(
        err,
        OperationType.GET,
        'attendanceBonuses'
      );

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
  const docId =
    `${employee.id}_${weekStart}`;

  const docRef =
    doc(
      db,
      'attendanceBonuses',
      docId
    );

  const existingSnap =
    await getDoc(docRef);

  const isPaid =
    existingSnap.exists() &&
    existingSnap.data().status ===
      'SUDAH DIBAYAR';

  const baseBonus =
    schedule.rajinWeeklyBonus !== undefined
      ? Number(schedule.rajinWeeklyBonus)
      : 150000;

  const lateDeduction =
    schedule.lateDeduction !== undefined
      ? Number(schedule.lateDeduction)
      : 20000;

  const minBonus =
    schedule.minRajinBonus !== undefined
      ? Number(schedule.minRajinBonus)
      : 0;

  const workDays =
    schedule.workDays ||
    DEFAULT_SCHEDULE.workDays;

  const calc =
    hitungUangRajinMingguan(
      attendanceRecords,
      weekStart,
      weekEnd,
      holidays,
      baseBonus,
      lateDeduction,
      workDays,
      minBonus
    );

  const bonusData:
    AttendanceBonusWeek = {
      id: docId,
      employeeId: employee.id!,
      employeeName: employee.name,
      weekStart,
      weekEnd,
      month: weekStart.substring(0, 7),
      label:
        `${formatTanggal(
          weekStart
        )} – ${formatTanggal(
          weekEnd
        )}`,
      baseBonus: calc.baseBonus,
      eligibleWorkDays:
        calc.eligibleWorkDays,
      presentDays:
        calc.presentDays,
      lateDays:
        calc.lateDays,
      lateCount:
        calc.lateCount,
      lateDeduction:
        calc.lateDeduction,
      deduction:
        calc.deduction,
      bonusAmount:
        calc.bonusAmount,
      finalBonus:
        calc.finalBonus,
      isFullAttendance:
        calc.isFullAttendance,
      reason:
        calc.reason,
      status:
        isPaid
          ? 'SUDAH DIBAYAR'
          : 'CALCULATED',
      breakdown:
        calc.breakdown,
    };

  const payload: any = {
    ...bonusData,
    updatedAt:
      serverTimestamp(),
  };

  if (!existingSnap.exists()) {
    payload.createdAt =
      serverTimestamp();
  }

  await setDoc(
    docRef,
    payload,
    { merge: true }
  );

  return bonusData;
}

export async function hitungDanSimpanSemuaBonusBulan(
  employees: Employee[],
  month: string,
  holidays: Holiday[] = [],
  schedule: WorkplaceSchedule = DEFAULT_SCHEDULE,
  currentUserId: string = 'system',
  currentUserName: string = 'Sistem PT.KDRT'
): Promise<AttendanceBonusWeek[]> {
  const weeks =
    getMingguDalamBulan(month);

  const sharingEmployees =
    employees.filter(
      (e) =>
        (e.scope || 'SHARING') ===
        'SHARING'
    );

  const allCalculated:
    AttendanceBonusWeek[] = [];

  for (const week of weeks) {
    const records =
      await getAttendanceRange(
        week.weekStart,
        week.weekEnd
      );

    for (
      const emp of sharingEmployees
    ) {
      const empRecords =
        records.filter(
          (r) =>
            r.employeeId === emp.id
        );

      const res =
        await hitungDanSimpanBonusMingguan(
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

/* ============================================================
   BAYAR UANG RAJIN
============================================================ */

export async function bayarUangRajin(
  bonus: AttendanceBonusWeek,
  currentUserId: string,
  currentUserName: string
) {
  if (
    bonus.status ===
    'SUDAH DIBAYAR'
  ) {
    throw new Error(
      'Uang Rajin ini sudah pernah dibayar.'
    );
  }

  const docId =
    bonus.id ||
    `${bonus.employeeId}_${bonus.weekStart}`;

  const docRef =
    doc(
      db,
      'attendanceBonuses',
      docId
    );

  await setDoc(
    docRef,
    {
      ...bonus,
      status:
        'SUDAH DIBAYAR',
      paidAt:
        serverTimestamp(),
      paidBy:
        currentUserId,
      paidByName:
        currentUserName,
      paymentDate:
        tanggalHariIni(),
      updatedAt:
        serverTimestamp(),
    },
    { merge: true }
  );

  const expenseId =
    await tambahPengeluaran(
      {
        date:
          tanggalHariIni(),
        amount:
          bonus.finalBonus,
        category:
          'ATTENDANCE_BONUS',
        scope:
          'SHARING',
        employeeId:
          bonus.employeeId,
        employeeName:
          bonus.employeeName,
        description:
          `Uang Rajin ${bonus.employeeName} (${bonus.label}) - ${bonus.reason || 'Bonus Kehadiran'}`,
      },
      currentUserId,
      currentUserName
    );

  await catatAuditLog(
    currentUserId,
    currentUserName,
    'BAYAR_UANG_RAJIN',
    bonus.employeeName,
    `Dibayar Rp ${bonus.finalBonus.toLocaleString('id-ID')} untuk periode ${bonus.label}`
  );

  return expenseId;
}

/* ============================================================
   PAYROLL
============================================================ */

export function subscribePayroll(
  month?: string,
  callback?: (
    payrolls: PayrollRecord[]
  ) => void
) {
  const colRef =
    collection(db, 'payroll');

  const q = month
    ? query(
        colRef,
        where('month', '==', month)
      )
    : query(
        colRef,
        orderBy(
          'month',
          'desc'
        )
      );

  return onSnapshot(
    q,
    (snap) => {
      const list =
        snap.docs.map((d) => {
          const data = d.data();

          const baseSalary =
            Number(
              data.baseSalary
            ) || 0;

          const attendanceBonus =
            Number(
              data.attendanceBonus
            ) || 0;

          const bonus =
            Number(
              data.bonus ||
                data.bonusAmount
            ) || 0;

          const adjustmentAddition =
            Number(
              data.adjustmentAddition
            ) || 0;

          const adjustmentDeduction =
            Number(
              data.adjustmentDeduction ||
                data.deduction
            ) || 0;

          const total =
            Math.max(
              0,
              baseSalary +
                attendanceBonus +
                bonus +
                adjustmentAddition -
                adjustmentDeduction
            );

          return {
            id: d.id,
            ...data,
            baseSalary,
            attendanceBonus,
            bonus,
            adjustmentAddition,
            adjustmentDeduction,
            totalPay:
              total,
            total,
          };
        }) as PayrollRecord[];

      if (callback)
        callback(list);
    },
    (err) => {
      handleFirestoreError(
        err,
        OperationType.GET,
        'payroll'
      );
    }
  );
}

export function subscribeEmployeePayroll(
  employeeId: string,
  callback: (
    payrolls: PayrollRecord[]
  ) => void,
  onError?: (
    err: any
  ) => void
) {
  const q = query(
    collection(db, 'payroll'),
    where(
      'employeeId',
      '==',
      employeeId
    )
  );

  return onSnapshot(
    q,
    (snap) => {
      const list =
        snap.docs.map((d) => {
          const data =
            d.data();

          const baseSalary =
            Number(
              data.baseSalary
            ) || 0;

          const attendanceBonus =
            Number(
              data.attendanceBonus
            ) || 0;

          const bonus =
            Number(
              data.bonus ||
                data.bonusAmount
            ) || 0;

          const adjustmentAddition =
            Number(
              data.adjustmentAddition
            ) || 0;

          const adjustmentDeduction =
            Number(
              data.adjustmentDeduction ||
                data.deduction
            ) || 0;

          const total =
            Math.max(
              0,
              baseSalary +
                attendanceBonus +
                bonus +
                adjustmentAddition -
                adjustmentDeduction
            );

          return {
            id: d.id,
            ...data,
            baseSalary,
            attendanceBonus,
            bonus,
            adjustmentAddition,
            adjustmentDeduction,
            totalPay:
              total,
            total,
          };
        }) as PayrollRecord[];

      list.sort(
        (a, b) =>
          (b.month || '').localeCompare(
            a.month || ''
          )
      );

      callback(list);
    },
    (err) => {
      console.error(
        '[EMPLOYEE_PAYROLL_ERROR]',
        {
          type: 'payroll',
          code: err?.code,
          message: err?.message,
        }
      );

      handleFirestoreError(
        err,
        OperationType.GET,
        'payroll'
      );

      if (onError)
        onError(err);
    }
  );
}

/* ============================================================
   HITUNG PAYROLL BULANAN
============================================================ */

export async function hitungDanSinkronisasiPayrollBulanan(
  month: string,
  employees: Employee[],
  holidays: Holiday[] = [],
  schedule: WorkplaceSchedule = DEFAULT_SCHEDULE,
  currentUserId: string = 'system',
  currentUserName: string = 'Owner PT.KDRT'
): Promise<PayrollRecord[]> {
  const sharingEmployees =
    employees.filter(
      (e) =>
        (e.scope || 'SHARING') ===
        'SHARING'
    );

  if (
    sharingEmployees.length ===
    0
  ) {
    return [];
  }

  const weeks =
    getMingguDalamBulan(month);

  const weekBonusesMap =
    new Map<
      string,
      number
    >();

  for (const week of weeks) {
    const records =
      await getAttendanceRange(
        week.weekStart,
        week.weekEnd
      );

    for (
      const emp of sharingEmployees
    ) {
      const empRecords =
        records.filter(
          (r) =>
            r.employeeId ===
            emp.id
        );

      const bonusRes =
        await hitungDanSimpanBonusMingguan(
          emp,
          week.weekStart,
          week.weekEnd,
          empRecords,
          holidays,
          schedule
        );

      const prev =
        weekBonusesMap.get(
          emp.id!
        ) || 0;

      weekBonusesMap.set(
        emp.id!,
        prev +
          bonusRes.finalBonus
      );
    }
  }

  const results:
    PayrollRecord[] = [];

  for (
    const emp of sharingEmployees
  ) {
    const docId =
      `${emp.id}_${month}`;

    const docRef =
      doc(
        db,
        'payroll',
        docId
      );

    const existingSnap =
      await getDoc(docRef);

    const baseSalary =
      Number(
        emp.baseSalary
      ) || 0;

    const attBonus =
      weekBonusesMap.get(
        emp.id!
      ) || 0;

    let existingData: any = {};

    if (
      existingSnap.exists()
    ) {
      existingData =
        existingSnap.data();
    }

    const bonus =
      Number(
        existingData.bonus ||
          existingData.bonusAmount
      ) || 0;

    const bonusNote =
      existingData.bonusNote ||
      '';

    const adjustmentAddition =
      Number(
        existingData.adjustmentAddition
      ) || 0;

    const adjustmentAdditionNote =
      existingData.adjustmentAdditionNote ||
      '';

    const adjustmentDeduction =
      Number(
        existingData.adjustmentDeduction ||
          existingData.deduction
      ) || 0;

    const adjustmentDeductionNote =
      existingData.adjustmentDeductionNote ||
      existingData.deductionNote ||
      '';

    const currentStatus:
      PayrollStatus =
      existingData.status ===
        'PAID' ||
      existingData.status ===
        'SUDAH DIBAYAR'
        ? 'PAID'
        : existingData.status ===
            'APPROVED'
          ? 'APPROVED'
          : 'CALCULATED';

    const totalPay =
      Math.max(
        0,
        baseSalary +
          attBonus +
          bonus +
          adjustmentAddition -
          adjustmentDeduction
      );

    const [
      yearStr,
    ] =
      month.split('-');

    const recordPayload:
      PayrollRecord = {
      id: docId,
      payrollId:
        `payroll_${month}`,
      employeeId:
        emp.id!,
      employeeName:
        emp.name,
      jobTitle:
        emp.position,
      month,
      monthLabel:
        formatBulanTahun(
          month
        ),
      periodMonth:
        month,
      periodYear:
        parseInt(
          yearStr,
          10
        ),
      baseSalary,
      attendanceBonus:
        attBonus,
      bonus,
      bonusAmount:
        bonus,
      bonusNote,
      adjustmentAddition,
      adjustmentAdditionNote,
      adjustmentDeduction,
      adjustmentDeductionNote,
      deduction:
        adjustmentDeduction,
      deductionNote:
        adjustmentDeductionNote,
      totalPay,
      total:
        totalPay,
      status:
        currentStatus,
      paymentDate:
        existingData.paymentDate ||
        '25',
      paidAt:
        existingData.paidAt ||
        null,
      paidBy:
        existingData.paidBy ||
        null,
      paidByName:
        existingData.paidByName ||
        null,
      approvedAt:
        existingData.approvedAt ||
        null,
      approvedBy:
        existingData.approvedBy ||
        null,
      approvedByName:
        existingData.approvedByName ||
        null,
      expenseId:
        existingData.expenseId ||
        null,
      updatedAt:
        serverTimestamp(),
      updatedBy:
        currentUserId,
    };

    if (
      !existingSnap.exists()
    ) {
      recordPayload.createdAt =
        serverTimestamp();

      recordPayload.createdBy =
        currentUserId;
    }

    await setDoc(
      docRef,
      recordPayload,
      { merge: true }
    );

    results.push(
      recordPayload
    );
  }

  await catatAuditLog(
    currentUserId,
    currentUserName,
    'PAYROLL_CALCULATED',
    `Payroll ${formatBulanTahun(month)}`,
    `Kalkulasi payroll berhasil untuk ${results.length} karyawan. Total Gaji Pokok: Rp ${results
      .reduce(
        (s, r) =>
          s + r.baseSalary,
        0
      )
      .toLocaleString('id-ID')}, Total Uang Rajin: Rp ${results
      .reduce(
        (s, r) =>
          s +
          r.attendanceBonus,
        0
      )
      .toLocaleString('id-ID')}`
  );

  return results;
}

/* ============================================================
   BONUS MANUAL
============================================================ */

export async function updateBonusManual(
  payroll: PayrollRecord,
  bonusAmount: number,
  bonusNote: string,
  currentUserId: string,
  currentUserName: string
) {
  if (
    payroll.status === 'PAID'
  ) {
    throw new Error(
      'Tidak dapat mengubah bonus pada payroll yang sudah dibayar.'
    );
  }

  const docId =
    payroll.id ||
    `${payroll.employeeId}_${payroll.month}`;

  const docRef =
    doc(
      db,
      'payroll',
      docId
    );

  const bonus =
    Number(bonusAmount) || 0;

  const total =
    Math.max(
      0,
      payroll.baseSalary +
        payroll.attendanceBonus +
        bonus +
        (payroll.adjustmentAddition ||
          0) -
        (payroll.adjustmentDeduction ||
          0)
    );

  await updateDoc(
    docRef,
    {
      bonus,
      bonusAmount:
        bonus,
      bonusNote:
        bonusNote || '',
      totalPay:
        total,
      total,
      updatedAt:
        serverTimestamp(),
      updatedBy:
        currentUserId,
    }
  );

  await catatAuditLog(
    currentUserId,
    currentUserName,
    'BONUS_ADDED',
    `${payroll.employeeName} (${formatBulanTahun(payroll.month)})`,
    `Bonus: Rp ${bonus.toLocaleString('id-ID')}. Catatan: ${bonusNote || '-'}`
  );
}

/* ============================================================
   ADJUSTMENT MANUAL
============================================================ */

export async function updateAdjustmentManual(
  payroll: PayrollRecord,
  type:
    | 'ADDITION'
    | 'DEDUCTION',
  amount: number,
  note: string,
  currentUserId: string,
  currentUserName: string
) {
  if (
    payroll.status === 'PAID'
  ) {
    throw new Error(
      'Tidak dapat mengubah penyesuaian pada payroll yang sudah dibayar.'
    );
  }

  const docId =
    payroll.id ||
    `${payroll.employeeId}_${payroll.month}`;

  const docRef =
    doc(
      db,
      'payroll',
      docId
    );

  const val =
    Math.max(
      0,
      Number(amount) || 0
    );

  let adjAddition =
    payroll.adjustmentAddition ||
    0;

  let adjAdditionNote =
    payroll.adjustmentAdditionNote ||
    '';

  let adjDeduction =
    payroll.adjustmentDeduction ||
    0;

  let adjDeductionNote =
    payroll.adjustmentDeductionNote ||
    '';

  if (
    type === 'ADDITION'
  ) {
    adjAddition = val;
    adjAdditionNote =
      note || '';
  } else {
    adjDeduction = val;
    adjDeductionNote =
      note || '';
  }

  const total =
    Math.max(
      0,
      payroll.baseSalary +
        payroll.attendanceBonus +
        (payroll.bonus || 0) +
        adjAddition -
        adjDeduction
    );

  await updateDoc(
    docRef,
    {
      adjustmentAddition:
        adjAddition,
      adjustmentAdditionNote:
        adjAdditionNote,
      adjustmentDeduction:
        adjDeduction,
      adjustmentDeductionNote:
        adjDeductionNote,
      deduction:
        adjDeduction,
      deductionNote:
        adjDeductionNote,
      totalPay:
        total,
      total,
      updatedAt:
        serverTimestamp(),
      updatedBy:
        currentUserId,
    }
  );

  await catatAuditLog(
    currentUserId,
    currentUserName,
    'ADJUSTMENT_ADDED',
    `${payroll.employeeName} (${formatBulanTahun(payroll.month)})`,
    `Penyesuaian ${type}: Rp ${val.toLocaleString('id-ID')}. Catatan: ${note || '-'}`
  );
}

/* ============================================================
   APPROVE PAYROLL
============================================================ */

export async function setujuiPayroll(
  month: string,
  payrollRecords: PayrollRecord[],
  currentUserId: string,
  currentUserName: string
) {
  for (
    const record of payrollRecords
  ) {
    if (
      record.status !==
      'PAID'
    ) {
      const docId =
        record.id ||
        `${record.employeeId}_${record.month}`;

      const docRef =
        doc(
          db,
          'payroll',
          docId
        );

      await setDoc(
        docRef,
        {
          ...record,
          status:
            'APPROVED',
          approvedAt:
            serverTimestamp(),
          approvedBy:
            currentUserId,
          approvedByName:
            currentUserName,
          updatedAt:
            serverTimestamp(),
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

/* ============================================================
   BAYAR GAJI
============================================================ */

export async function bayarGaji(
  payroll: PayrollRecord,
  currentUserId: string,
  currentUserName: string
) {
  /*
   * WAJIB APPROVED SEBELUM DIBAYAR.
   */

  if (
    payroll.status !==
      'APPROVED' &&
    payroll.status !==
      'PAID'
  ) {
    throw new Error(
      'Gaji belum disetujui. Payroll harus berstatus APPROVED sebelum dibayar.'
    );
  }

  /*
   * Cegah pembayaran kedua kali.
   */

  if (
    payroll.status ===
    'PAID'
  ) {
    throw new Error(
      'Gaji ini sudah pernah dibayar.'
    );
  }

  const docId =
    payroll.id ||
    `${payroll.employeeId}_${payroll.month}`;

  const docRef =
    doc(
      db,
      'payroll',
      docId
    );

  /*
   * Ambil kondisi terbaru dari Firebase.
   */

  const snap =
    await getDoc(docRef);

  if (
    !snap.exists()
  ) {
    throw new Error(
      'Data payroll tidak ditemukan.'
    );
  }

  const latestData =
    snap.data();

  if (
    latestData.status ===
    'PAID'
  ) {
    throw new Error(
      'Gaji ini sudah berstatus PAID.'
    );
  }

  if (
    latestData.status !==
    'APPROVED'
  ) {
    throw new Error(
      'Payroll belum APPROVED.'
    );
  }

  const total =
    Number(
      payroll.totalPay ||
        payroll.total ||
        Math.max(
          0,
          Number(
            payroll.baseSalary
          ) +
            Number(
              payroll.attendanceBonus
            ) +
            Number(
              payroll.bonus ||
                0
            ) +
            Number(
              payroll.adjustmentAddition ||
                0
            ) -
            Number(
              payroll.adjustmentDeduction ||
                payroll.deduction ||
                0
            )
        )
    );

  if (
    total <= 0
  ) {
    throw new Error(
      'Total gaji harus lebih dari Rp 0.'
    );
  }

  /*
   * ============================================================
   * 1. BUAT EXPENSE
   * ============================================================
   */

  const expenseId =
    await tambahPengeluaran(
      {
        date:
          tanggalHariIni(),
        amount:
          total,
        category:
          'SALARY',
        scope:
          'SHARING',
        employeeId:
          payroll.employeeId,
        employeeName:
          payroll.employeeName,
        payrollId:
          docId,
        description:
          `Payroll ${payroll.employeeName} (${formatBulanTahun(payroll.month)}) - Gaji Pokok: Rp${Number(payroll.baseSalary || 0).toLocaleString('id-ID')}, Uang Rajin: Rp${Number(payroll.attendanceBonus || 0).toLocaleString('id-ID')}${Number(payroll.bonus || 0) > 0 ? `, Bonus: Rp${Number(payroll.bonus).toLocaleString('id-ID')}` : ''}${Number(payroll.adjustmentAddition || 0) > 0 ? `, Penyesuaian (+): Rp${Number(payroll.adjustmentAddition).toLocaleString('id-ID')}` : ''}${Number(payroll.adjustmentDeduction || 0) > 0 ? `, Potongan (-): Rp${Number(payroll.adjustmentDeduction).toLocaleString('id-ID')}` : ''}`,
      },
      currentUserId,
      currentUserName
    );

  /*
   * ============================================================
   * 2. BUAT TRANSAKSI KAS & BANK
   * ============================================================
   *
   * Ini yang membuat pembayaran gaji benar-benar
   * mengurangi saldo rekening di ArusKasPage.
   *
   * IMPORTANT:
   * Expense dan transaction memiliki reference payrollId
   * yang sama agar mudah diaudit dan mencegah duplikasi.
   */

  const transactionReference =
    `PAYROLL_${docId}`;

  const existingTransactionQuery =
    await getDoc(
      doc(
        db,
        'transactions',
        transactionReference
      )
    ).catch(
      () => null
    );

  /*
   * Kita menggunakan document ID deterministik.
   *
   * Jika sudah ada transaksi dengan ID tersebut,
   * jangan buat transaksi kedua.
   */

  if (
    !existingTransactionQuery?.exists()
  ) {
    await createFinancialTransaction(
      {
        id:
          transactionReference,
        type:
          'EXPENSE',
        amount:
          total,
        date:
          tanggalHariIni(),
        category:
          'GAJI',
        scope:
          'SHARING',
        sourceType:
          'PAYROLL',
        referenceId:
          transactionReference,
        payrollId:
          docId,
        employeeId:
          payroll.employeeId,
        employeeName:
          payroll.employeeName,
        paymentMethod:
          'TRANSFER',
        description:
          `Pembayaran gaji ${payroll.employeeName} - ${formatBulanTahun(payroll.month)}`,
        notes:
          `Payroll ID: ${docId}. Expense ID: ${expenseId || '-'}`,
        createdBy:
          currentUserId,
        createdByName:
          currentUserName,
      } as any,
      currentUserId,
      currentUserName
    );
  }

  /*
   * ============================================================
   * 3. UPDATE PAYROLL
   * ============================================================
   */

  await updateDoc(
    docRef,
    {
      status:
        'PAID',
      paymentDate:
        tanggalHariIni(),
      paidAt:
        serverTimestamp(),
      paidBy:
        currentUserId,
      paidByName:
        currentUserName,
      totalPay:
        total,
      total,
      expenseId:
        expenseId || null,
      updatedAt:
        serverTimestamp(),
    }
  );

  /*
   * ============================================================
   * 4. AUDIT
   * ============================================================
   */

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
    `Pengeluaran Kas & Bank otomatis dibuat sebesar Rp ${total.toLocaleString('id-ID')} (Transaction: ${transactionReference})`
  );

  return {
    success:
      true,
    expenseId,
    transactionId:
      transactionReference,
  };
}

/* ============================================================
   SIMPAN DRAFT
============================================================ */

export async function simpanDraftPayroll(
  payroll: PayrollRecord,
  currentUserId: string,
  currentUserName: string
) {
  const docId =
    payroll.id ||
    `${payroll.employeeId}_${payroll.month}`;

  const docRef =
    doc(
      db,
      'payroll',
      docId
    );

  const baseSalary =
    Number(
      payroll.baseSalary
    ) || 0;

  const attendanceBonus =
    Number(
      payroll.attendanceBonus
    ) || 0;

  const bonus =
    Number(
      payroll.bonus ||
        payroll.bonusAmount
    ) || 0;

  const adjustmentAddition =
    Number(
      payroll.adjustmentAddition
    ) || 0;

  const adjustmentDeduction =
    Number(
      payroll.adjustmentDeduction ||
        payroll.deduction
    ) || 0;

  const total =
    Math.max(
      0,
      baseSalary +
        attendanceBonus +
        bonus +
        adjustmentAddition -
        adjustmentDeduction
    );

  const payload:
    PayrollRecord = {
    ...payroll,
    baseSalary,
    attendanceBonus,
    bonus,
    bonusAmount:
      bonus,
    adjustmentAddition,
    adjustmentDeduction,
    deduction:
      adjustmentDeduction,
    totalPay:
      total,
    total,
    monthLabel:
      formatBulanTahun(
        payroll.month
      ),
    updatedAt:
      serverTimestamp(),
    updatedBy:
      currentUserId,
  };

  await setDoc(
    docRef,
    payload,
    { merge: true }
  );

  await catatAuditLog(
    currentUserId,
    currentUserName,
    'PAYROLL_CREATED',
    `${payroll.employeeName} (${payroll.month})`,
    `Draft Payroll tersimpan: Rp ${total.toLocaleString('id-ID')}`
  );
}

/* ============================================================
   MANUAL SALARY KARYAWAN (CRUD MANUAL OWNER/ADMIN)
============================================================ */

export interface ManualSalaryInput {
  employeeId?: string;
  employeeName: string;
  jobTitle?: string;
  month: string; // YYYY-MM
  baseSalary: number;
  bonus: number;
  adjustment: number; // (+/-) penyesuaian nominal
  adjustmentNote?: string;
  status: 'BELUM DIBAYAR' | 'SUDAH DIBAYAR' | PayrollStatus;
  notes?: string;
}

export interface BayarSalaryInput {
  payrollRecord: PayrollRecord;
  paymentDate: string; // YYYY-MM-DD
  paymentAccount: string; // e.g. 'BCA', 'Mandiri', etc.
  description?: string;
  currentUserId?: string;
  currentUserName?: string;
}

export async function createSalaryManual(
  input: ManualSalaryInput,
  currentUserId: string = 'owner',
  currentUserName: string = 'Owner PT.KDRT'
): Promise<string> {
  const empId = input.employeeId || input.employeeName.toLowerCase().replace(/\s+/g, '-');
  const docId = `salary_${empId}_${input.month}_${Date.now().toString(36)}`;
  const docRef = doc(db, 'payroll', docId);

  const baseSalary = Number(input.baseSalary) || 0;
  const bonus = Number(input.bonus) || 0;
  const adjustment = Number(input.adjustment) || 0;
  const totalPay = Math.max(0, baseSalary + bonus + adjustment);

  const adjAddition = adjustment > 0 ? adjustment : 0;
  const adjDeduction = adjustment < 0 ? Math.abs(adjustment) : 0;

  const isPaid = input.status === 'SUDAH DIBAYAR';

  let paymentTransactionId: string | null = null;
  let paymentDateVal: string | null = null;

  // Jika dibuat langsung dengan status SUDAH DIBAYAR, buat transaksi Kas & Bank
  if (isPaid && totalPay > 0) {
    paymentDateVal = tanggalHariIni();
    const transactionRefId = `PAYROLL_${docId}`;
    try {
      const txRes = await createFinancialTransaction(
        {
          type: 'EXPENSE',
          amount: totalPay,
          date: paymentDateVal,
          category: 'Gaji & Upah Karyawan',
          scope: 'SHARING',
          sourceType: 'PAYROLL',
          referenceId: transactionRefId,
          payrollId: docId,
          employeeId: empId,
          employeeName: input.employeeName,
          accountName: 'BCA',
          accountId: 'BCA',
          paymentMethod: 'TRANSFER',
          description: `Pembayaran Gaji ${input.employeeName} - ${formatBulanTahun(input.month)}`,
          notes: `Input salary langsung berstatus SUDAH DIBAYAR oleh ${currentUserName}.`,
        } as any,
        currentUserId,
        currentUserName
      );
      paymentTransactionId = txRes.id || transactionRefId;
    } catch (txErr) {
      console.warn('Gagal membuat transaksi kas otomatis saat create salary berstatus PAID:', txErr);
    }
  }

  const payrollPayload: any = {
    id: docId,
    payrollId: `salary_${input.month}`,
    employeeId: empId,
    employeeName: input.employeeName,
    jobTitle: input.jobTitle || 'Staff',
    month: input.month,
    monthLabel: formatBulanTahun(input.month),
    baseSalary,
    attendanceBonus: 0,
    bonus,
    bonusAmount: bonus,
    adjustmentAddition: adjAddition,
    adjustmentAdditionNote: input.adjustmentNote || '',
    adjustmentDeduction: adjDeduction,
    adjustmentDeductionNote: input.adjustmentNote || '',
    deduction: adjDeduction,
    deductionNote: input.adjustmentNote || '',
    totalPay,
    total: totalPay,
    status: isPaid ? 'PAID' : 'DRAFT',
    paymentDate: paymentDateVal,
    paidAt: isPaid ? serverTimestamp() : null,
    paidBy: isPaid ? currentUserId : null,
    paidByName: isPaid ? currentUserName : null,
    paymentAccount: isPaid ? 'BCA' : null,
    paymentTransactionId: paymentTransactionId,
    notes: input.notes || '',
    createdAt: serverTimestamp(),
    createdBy: currentUserId,
    updatedAt: serverTimestamp(),
    updatedBy: currentUserId,
  };

  await setDoc(docRef, payrollPayload);

  await catatAuditLog(
    currentUserId,
    currentUserName,
    'SALARY_MANUAL_CREATED',
    `${input.employeeName} (${formatBulanTahun(input.month)})`,
    `Input salary manual: Gaji Pokok Rp ${baseSalary.toLocaleString('id-ID')}, Bonus Rp ${bonus.toLocaleString('id-ID')}, Penyesuaian Rp ${adjustment.toLocaleString('id-ID')}, Total Rp ${totalPay.toLocaleString('id-ID')} (${isPaid ? 'SUDAH DIBAYAR' : 'BELUM DIBAYAR'})`
  );

  return docId;
}

export async function updateSalaryManual(
  id: string,
  input: Partial<ManualSalaryInput> & { status?: 'BELUM DIBAYAR' | 'SUDAH DIBAYAR' | PayrollStatus },
  currentUserId: string = 'owner',
  currentUserName: string = 'Owner PT.KDRT'
): Promise<void> {
  const docRef = doc(db, 'payroll', id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw new Error('Data salary tidak ditemukan.');
  }

  const existing = snap.data() as PayrollRecord;
  const baseSalary = input.baseSalary !== undefined ? Number(input.baseSalary) : (Number(existing.baseSalary) || 0);
  const bonus = input.bonus !== undefined ? Number(input.bonus) : (Number(existing.bonus || existing.bonusAmount) || 0);
  
  let adjAddition = Number(existing.adjustmentAddition) || 0;
  let adjDeduction = Number(existing.adjustmentDeduction || existing.deduction) || 0;
  let adjustmentNote = input.adjustmentNote !== undefined ? input.adjustmentNote : (existing.adjustmentAdditionNote || existing.adjustmentDeductionNote || '');

  if (input.adjustment !== undefined) {
    const adj = Number(input.adjustment);
    adjAddition = adj > 0 ? adj : 0;
    adjDeduction = adj < 0 ? Math.abs(adj) : 0;
  }

  const totalPay = Math.max(0, baseSalary + bonus + adjAddition - adjDeduction);

  const statusInput = input.status;
  let finalStatus: PayrollStatus = existing.status;
  if (statusInput === 'SUDAH DIBAYAR' || statusInput === 'PAID') {
    finalStatus = 'PAID';
  } else if (statusInput === 'BELUM DIBAYAR' || statusInput === 'DRAFT' || statusInput === 'CALCULATED') {
    finalStatus = 'DRAFT';
  }

  const updates: any = {
    updatedAt: serverTimestamp(),
    updatedBy: currentUserId,
    baseSalary,
    bonus,
    bonusAmount: bonus,
    adjustmentAddition: adjAddition,
    adjustmentAdditionNote: adjustmentNote,
    adjustmentDeduction: adjDeduction,
    adjustmentDeductionNote: adjustmentNote,
    deduction: adjDeduction,
    deductionNote: adjustmentNote,
    totalPay,
    total: totalPay,
    status: finalStatus,
  };

  if (input.employeeName !== undefined) updates.employeeName = input.employeeName;
  if (input.employeeId !== undefined) updates.employeeId = input.employeeId;
  if (input.jobTitle !== undefined) updates.jobTitle = input.jobTitle;
  if (input.month !== undefined) {
    updates.month = input.month;
    updates.monthLabel = formatBulanTahun(input.month);
  }
  if (input.notes !== undefined) updates.notes = input.notes;

  if (finalStatus === 'PAID' && existing.status !== 'PAID' && existing.status !== 'SUDAH DIBAYAR') {
    updates.paymentDate = tanggalHariIni();
    updates.paidAt = serverTimestamp();
    updates.paidBy = currentUserId;
    updates.paidByName = currentUserName;
  } else if (finalStatus === 'DRAFT' && (existing.status === 'PAID' || existing.status === 'SUDAH DIBAYAR')) {
    updates.paymentDate = null;
    updates.paidAt = null;
    updates.paidBy = null;
    updates.paidByName = null;
    updates.paymentAccount = null;
    updates.paymentTransactionId = null;
  }

  await updateDoc(docRef, updates);

  await catatAuditLog(
    currentUserId,
    currentUserName,
    'SALARY_MANUAL_UPDATED',
    `${updates.employeeName || existing.employeeName} (${formatBulanTahun(updates.month || existing.month)})`,
    `Update salary manual: Total Rp ${totalPay.toLocaleString('id-ID')} (${finalStatus === 'PAID' ? 'SUDAH DIBAYAR' : 'BELUM DIBAYAR'})`
  );
}

export async function bayarSalaryManual({
  payrollRecord,
  paymentDate,
  paymentAccount,
  description,
  currentUserId = 'owner',
  currentUserName = 'Owner PT.KDRT',
}: BayarSalaryInput): Promise<{ success: boolean; transactionId: string }> {
  if (!payrollRecord.id) {
    throw new Error('ID record salary tidak valid.');
  }

  // 1. Cek status terbaru dari database (Anti double payment)
  const docRef = doc(db, 'payroll', payrollRecord.id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw new Error('Data salary tidak ditemukan di sistem.');
  }

  const existing = snap.data() as PayrollRecord;
  if (existing.status === 'PAID' || existing.status === 'SUDAH DIBAYAR') {
    throw new Error('Salary ini sudah berstatus SUDAH DIBAYAR.');
  }

  const baseSalary = Number(existing.baseSalary) || 0;
  const bonus = Number(existing.bonus || existing.bonusAmount) || 0;
  const add = Number(existing.adjustmentAddition) || 0;
  const ded = Number(existing.adjustmentDeduction || existing.deduction) || 0;
  const totalPay =
    Number(existing.totalPay) ||
    Number(existing.total) ||
    Math.max(0, baseSalary + bonus + add - ded);

  if (totalPay <= 0) {
    throw new Error('Total gaji harus lebih dari Rp 0 untuk melakukan pembayaran.');
  }

  const transactionRefId = `PAYROLL_${payrollRecord.id}`;
  const finalDesc =
    description?.trim() ||
    `Gaji ${existing.employeeName} - ${existing.monthLabel || formatBulanTahun(existing.month)}`;

  // 2. Buat transaksi UANG KELUAR di Buku Kas & Bank (transactions)
  const txRes = await createFinancialTransaction(
    {
      type: 'EXPENSE',
      amount: totalPay,
      date: paymentDate || tanggalHariIni(),
      category: 'Gaji & Upah Karyawan',
      scope: 'SHARING',
      sourceType: 'PAYROLL',
      referenceId: transactionRefId,
      payrollId: payrollRecord.id,
      employeeId: existing.employeeId,
      employeeName: existing.employeeName,
      accountName: paymentAccount || 'BCA',
      accountId: paymentAccount || 'BCA',
      paymentMethod: 'TRANSFER',
      description: finalDesc,
      notes: `Pembayaran salary karyawan: ${existing.employeeName} (${existing.monthLabel || formatBulanTahun(existing.month)}). Dibayar dari akun ${paymentAccount || 'BCA'}.`,
    } as any,
    currentUserId,
    currentUserName
  );

  const transactionId = txRes.id || transactionRefId;

  // 3. Update status salary: BELUM DIBAYAR -> SUDAH DIBAYAR
  await updateDoc(docRef, {
    status: 'PAID',
    paymentDate: paymentDate || tanggalHariIni(),
    paymentAccount: paymentAccount || 'BCA',
    paymentTransactionId: transactionId,
    paidAt: serverTimestamp(),
    paidBy: currentUserId,
    paidByName: currentUserName,
    updatedAt: serverTimestamp(),
    updatedBy: currentUserId,
  });

  await catatAuditLog(
    currentUserId,
    currentUserName,
    'SALARY_PAID',
    `${existing.employeeName} (${existing.monthLabel || formatBulanTahun(existing.month)})`,
    `Gaji dibayar Rp ${totalPay.toLocaleString('id-ID')} via ${paymentAccount || 'BCA'}. Tercatat di Transaksi Kas ID: ${transactionId}`
  );

  return { success: true, transactionId };
}

export async function deleteSalaryManual(
  id: string,
  record: PayrollRecord,
  currentUserId: string = 'owner',
  currentUserName: string = 'Owner PT.KDRT'
): Promise<void> {
  const docRef = doc(db, 'payroll', id);
  await deleteDoc(docRef);

  // Jika salary sudah berstatus SUDAH DIBAYAR, hapus juga transaksi kas terkait agar tidak ada transaksi yatim
  const isPaid = record.status === 'PAID' || record.status === 'SUDAH DIBAYAR';
  const linkedTxId = record.paymentTransactionId || `PAYROLL_${id}`;
  if (isPaid || record.paymentTransactionId) {
    try {
      const txDocRef = doc(db, 'transactions', linkedTxId);
      const txSnap = await getDoc(txDocRef);
      if (txSnap.exists()) {
        await deleteDoc(txDocRef);
        await catatAuditLog(
          currentUserId,
          currentUserName,
          'PAYROLL_TRANSACTION_CLEANED',
          `Transaksi Kas ${linkedTxId}`,
          `Transaksi kas otomatis dihapus karena record salary ${record.employeeName} (${formatBulanTahun(record.month)}) telah dihapus.`
        );
      }
    } catch (txErr) {
      console.warn('Gagal menghapus transaksi terkait saat hapus salary:', txErr);
    }
  }

  await catatAuditLog(
    currentUserId,
    currentUserName,
    'SALARY_MANUAL_DELETED',
    `${record.employeeName} (${formatBulanTahun(record.month)})`,
    `Hapus data salary manual: Total Rp ${(record.totalPay || record.total || 0).toLocaleString('id-ID')}`
  );
}

/* ============================================================
   MANUAL UANG RAJIN MINGGUAN (CRUD MANUAL OWNER/ADMIN)
============================================================ */

export interface ManualUangRajinInput {
  employeeId?: string;
  employeeName: string;
  periodLabel: string; // e.g. "Minggu 1 (01 - 07 Agustus 2026)" atau "10 – 15 Agustus 2026"
  weekStart?: string;
  month?: string; // YYYY-MM
  amount: number; // Nominal uang rajin
  status: 'BELUM DIBAYAR' | 'SUDAH DIBAYAR';
  notes?: string;
}

export async function createUangRajinManual(
  input: ManualUangRajinInput,
  currentUserId: string = 'owner',
  currentUserName: string = 'Owner PT.KDRT'
): Promise<string> {
  const empId = input.employeeId || input.employeeName.toLowerCase().replace(/\s+/g, '-');
  const month = input.month || input.weekStart?.substring(0, 7) || tanggalHariIni().substring(0, 7);
  const weekStart = input.weekStart || tanggalHariIni();
  const docId = `uangrajin_${empId}_${Date.now().toString(36)}`;
  const docRef = doc(db, 'attendanceBonuses', docId);

  const amount = Number(input.amount) || 0;
  const isPaid = input.status === 'SUDAH DIBAYAR';

  const bonusPayload: AttendanceBonusWeek = {
    id: docId,
    employeeId: empId,
    employeeName: input.employeeName,
    weekStart,
    weekEnd: weekStart,
    month,
    label: input.periodLabel,
    baseBonus: amount,
    eligibleWorkDays: 6,
    presentDays: 6,
    lateDays: 0,
    lateCount: 0,
    lateDeduction: 0,
    deduction: 0,
    bonusAmount: amount,
    finalBonus: amount,
    isFullAttendance: true,
    reason: input.notes || 'Input manual admin',
    status: isPaid ? 'SUDAH DIBAYAR' : 'CALCULATED',
    paymentDate: isPaid ? tanggalHariIni() : undefined,
    paidAt: isPaid ? serverTimestamp() : null,
    paidBy: isPaid ? currentUserId : null,
    paidByName: isPaid ? currentUserName : null,
    breakdown: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(docRef, bonusPayload);

  await catatAuditLog(
    currentUserId,
    currentUserName,
    'UANG_RAJIN_MANUAL_CREATED',
    `${input.employeeName} (${input.periodLabel})`,
    `Input uang rajin manual: Rp ${amount.toLocaleString('id-ID')} (${input.status})`
  );

  return docId;
}

export async function updateUangRajinManual(
  id: string,
  input: Partial<ManualUangRajinInput>,
  currentUserId: string = 'owner',
  currentUserName: string = 'Owner PT.KDRT'
): Promise<void> {
  const docRef = doc(db, 'attendanceBonuses', id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw new Error('Data uang rajin tidak ditemukan.');
  }

  const existing = snap.data() as AttendanceBonusWeek;
  const amount = input.amount !== undefined ? Number(input.amount) : (existing.finalBonus || existing.bonusAmount || 0);

  const updates: any = {
    updatedAt: serverTimestamp(),
    baseBonus: amount,
    finalBonus: amount,
    bonusAmount: amount,
  };

  if (input.employeeName !== undefined) updates.employeeName = input.employeeName;
  if (input.employeeId !== undefined) updates.employeeId = input.employeeId;
  if (input.periodLabel !== undefined) updates.label = input.periodLabel;
  if (input.month !== undefined) updates.month = input.month;
  if (input.weekStart !== undefined) updates.weekStart = input.weekStart;
  if (input.notes !== undefined) updates.reason = input.notes;

  if (input.status !== undefined) {
    const isPaid = input.status === 'SUDAH DIBAYAR';
    updates.status = isPaid ? 'SUDAH DIBAYAR' : 'CALCULATED';
    if (isPaid && existing.status !== 'SUDAH DIBAYAR' && existing.status !== 'PAID') {
      updates.paymentDate = tanggalHariIni();
      updates.paidAt = serverTimestamp();
      updates.paidBy = currentUserId;
      updates.paidByName = currentUserName;
    } else if (!isPaid && (existing.status === 'SUDAH DIBAYAR' || existing.status === 'PAID')) {
      updates.paidAt = null;
      updates.paidBy = null;
      updates.paidByName = null;
    }
  }

  await updateDoc(docRef, updates);

  await catatAuditLog(
    currentUserId,
    currentUserName,
    'UANG_RAJIN_MANUAL_UPDATED',
    `${updates.employeeName || existing.employeeName} (${updates.label || existing.label})`,
    `Update uang rajin manual: Rp ${amount.toLocaleString('id-ID')} (${updates.status || existing.status})`
  );
}

export async function deleteUangRajinManual(
  id: string,
  record: AttendanceBonusWeek,
  currentUserId: string = 'owner',
  currentUserName: string = 'Owner PT.KDRT'
): Promise<void> {
  const docRef = doc(db, 'attendanceBonuses', id);
  await deleteDoc(docRef);

  await catatAuditLog(
    currentUserId,
    currentUserName,
    'UANG_RAJIN_MANUAL_DELETED',
    `${record.employeeName} (${record.label})`,
    `Hapus data uang rajin manual: Rp ${(record.finalBonus || record.bonusAmount || 0).toLocaleString('id-ID')}`
  );
}
