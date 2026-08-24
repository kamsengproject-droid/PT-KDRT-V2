import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  WeeklyCommission,
  EmployeeCommission,
  Employee,
  AttendanceRecord,
  AttendanceStatus,
  CheckoutStatus,
  FinancialTransaction,
} from '../types';
import { catatAuditLog } from './auditService';
import {
  getJadwalHari,
  hitungMenitTerlambat,
  hitungStatusPulang,
  DEFAULT_SCHEDULE,
} from '../utils/attendanceCalc';
import {
  formatTanggal,
  formatRupiah,
  tanggalHariIni,
  formatJamPendek,
} from '../utils/formatters';

// ============================================================================
// 1. KOMISI MINGGUAN (OWNER MANUAL INPUT)
// ============================================================================

export function subscribeWeeklyCommissions(
  callback: (commissions: WeeklyCommission[]) => void
) {
  const colRef = collection(db, 'weeklyCommissions');
  const q = query(colRef, orderBy('date', 'desc'));

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as WeeklyCommission[];
      callback(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, 'weeklyCommissions');
    }
  );
}

export async function saveWeeklyCommission(
  data: Omit<WeeklyCommission, 'createdBy' | 'createdAt' | 'updatedAt'> & { id?: string },
  currentUserId: string,
  currentUserName: string
): Promise<string> {
  try {
    const isNew = !data.id;
    const docId = data.id || `WEEKLY_COMM_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const docRef = doc(db, 'weeklyCommissions', docId);

    const transactionId = data.transactionId || `TX_WCOMM_${docId}`;
    const txRef = doc(db, 'transactions', transactionId);

    const nowTimestamp = serverTimestamp();

    const commissionPayload: any = {
      periodWeek: data.periodWeek.trim(),
      accountName: data.accountName.trim(),
      sellerName: (data.sellerName || data.accountName).trim(),
      amount: Number(data.amount) || 0,
      date: data.date || tanggalHariIni(),
      notes: data.notes || '',
      transactionId,
      updatedAt: nowTimestamp,
      updatedBy: currentUserId,
      updatedByName: currentUserName,
    };

    if (data.accountId) {
      commissionPayload.accountId = data.accountId;
    }

    if (isNew) {
      commissionPayload.createdAt = nowTimestamp;
      commissionPayload.createdBy = currentUserId;
      commissionPayload.createdByName = currentUserName;
    }

    // 1. Save Weekly Commission Doc
    await setDoc(docRef, commissionPayload, { merge: true });

    // 2. Synchronize directly into Master Transactions (Single Source of Truth)
    const transactionPayload: Partial<FinancialTransaction> = {
      type: 'INCOME',
      amount: Number(data.amount) || 0,
      date: data.date || tanggalHariIni(),
      category: 'KOMISI TIKTOK',
      scope: 'SHARING',
      sourceType: 'WEEKLY_COMMISSION',
      referenceId: docId,
      accountName: data.accountName.trim(),
      description: `Komisi Mingguan: ${data.periodWeek.trim()} — ${data.accountName.trim()}${data.notes ? ` (${data.notes.trim()})` : ''}`,
      status: 'ACTIVE',
      updatedAt: nowTimestamp,
    };

    if (data.accountId) {
      transactionPayload.accountId = data.accountId;
    }

    if (isNew) {
      (transactionPayload as any).createdAt = nowTimestamp;
      (transactionPayload as any).createdBy = currentUserId;
      (transactionPayload as any).createdByName = currentUserName;
    }

    await setDoc(txRef, transactionPayload, { merge: true });

    // 3. Audit Log
    await catatAuditLog(
      currentUserId,
      currentUserName,
      isNew ? 'CREATE_WEEKLY_COMMISSION' : 'UPDATE_WEEKLY_COMMISSION',
      `${data.accountName} (${data.periodWeek})`,
      `Komisi Mingguan ${formatRupiah(Number(data.amount) || 0)} tanggal ${data.date}. Catatan: ${data.notes || '-'}`
    );

    return docId;
  } catch (err) {
    console.error('[SAVE_WEEKLY_COMMISSION_ERROR]', err);
    handleFirestoreError(err, OperationType.WRITE, 'weeklyCommissions');
    throw err;
  }
}

export async function deleteWeeklyCommission(
  commissionId: string,
  transactionId?: string,
  currentUserId?: string,
  currentUserName?: string
) {
  try {
    const docRef = doc(db, 'weeklyCommissions', commissionId);
    await deleteDoc(docRef);

    const txId = transactionId || `TX_WCOMM_${commissionId}`;
    const txRef = doc(db, 'transactions', txId);
    const txSnap = await getDoc(txRef);
    if (txSnap.exists()) {
      await deleteDoc(txRef);
    }

    if (currentUserId && currentUserName) {
      await catatAuditLog(
        currentUserId,
        currentUserName,
        'DELETE_WEEKLY_COMMISSION',
        commissionId,
        `Komisi Mingguan ID ${commissionId} dan mutasi buku kas dihapus oleh Owner.`
      );
    }
  } catch (err) {
    console.error('[DELETE_WEEKLY_COMMISSION_ERROR]', err);
    handleFirestoreError(err, OperationType.DELETE, `weeklyCommissions/${commissionId}`);
    throw err;
  }
}

// ============================================================================
// 2. ABSENSI CHECKLIST HARIAN (OWNER MANUAL INPUT)
// Uses existing 'attendance' collection & schema
// ============================================================================

export type ChecklistAttendanceStatus =
  | 'HADIR'
  | 'TERLAMBAT'
  | 'SUDAH PULANG'
  | 'TERLAMBAT (SUDAH PULANG)'
  | 'BELUM ABSEN MASUK'
  | 'BELUM ABSEN';

export function getChecklistStatus(
  hasCheckIn: boolean,
  hasCheckOut: boolean,
  record?: AttendanceRecord | null
): {
  statusLabel: ChecklistAttendanceStatus;
  badgeClass: string;
  dotColor: string;
} {
  if (!hasCheckIn && !hasCheckOut) {
    return {
      statusLabel: 'BELUM ABSEN',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
      dotColor: 'bg-slate-400',
    };
  }

  const isTerlambat =
    record?.status === 'TERLAMBAT' ||
    (typeof record?.menitTerlambat === 'number' && record.menitTerlambat > 0) ||
    (typeof record?.lateMinutes === 'number' && record.lateMinutes > 0);

  if (hasCheckIn && hasCheckOut) {
    if (isTerlambat) {
      return {
        statusLabel: 'TERLAMBAT (SUDAH PULANG)',
        badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
        dotColor: 'bg-amber-500',
      };
    }
    return {
      statusLabel: 'SUDAH PULANG',
      badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
      dotColor: 'bg-blue-500',
    };
  }

  if (hasCheckIn && !hasCheckOut) {
    if (isTerlambat) {
      return {
        statusLabel: 'TERLAMBAT',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
        dotColor: 'bg-rose-500',
      };
    }
    return {
      statusLabel: 'HADIR',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      dotColor: 'bg-emerald-500',
    };
  }

  // !hasCheckIn && hasCheckOut
  return {
    statusLabel: 'BELUM ABSEN MASUK',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    dotColor: 'bg-amber-500',
  };
}

export async function toggleChecklistAttendance(params: {
  employee: Employee;
  date: string; // YYYY-MM-DD
  checkType: 'MASUK' | 'PULANG' | 'FULL_DAY';
  checked: boolean;
  currentUserId: string;
  currentUserName: string;
}): Promise<AttendanceRecord> {
  const { employee, date, checkType, checked, currentUserId, currentUserName } = params;
  const dateFormatted = date.replace(/-/g, '');
  const docId = `${employee.id}_${dateFormatted}`;
  const docRef = doc(db, 'attendance', docId);

  try {
    const existingSnap = await getDoc(docRef);
    const existingData = existingSnap.exists() ? (existingSnap.data() as AttendanceRecord) : null;

    const currentHasMasuk = !!(existingData?.waktuMasuk || existingData?.checkInTime);
    const currentHasPulang = !!(existingData?.waktuPulang || existingData?.checkOutTime);

    let nextHasMasuk = currentHasMasuk;
    let nextHasPulang = currentHasPulang;

    if (checkType === 'FULL_DAY') {
      nextHasMasuk = checked;
      nextHasPulang = checked;
    } else if (checkType === 'MASUK') {
      nextHasMasuk = checked;
    } else {
      nextHasPulang = checked;
    }

    const daySched = getJadwalHari(date, DEFAULT_SCHEDULE);
    const nowTimestamp = serverTimestamp();
    const isToday = date === tanggalHariIni();
    const now = new Date();
    const currentRealTimeStr = formatJamPendek(now);

    let recordPayload: any = {
      userId: employee.userId || employee.id,
      employeeId: employee.id!,
      employeeName: employee.name,
      date,
      tanggal: date,
      jadwalMasuk: daySched.checkInTime || '09:00',
      jadwalPulang: daySched.checkOutTime || '17:00',
      updatedAt: nowTimestamp,
      overrideBy: currentUserId,
      overrideByName: currentUserName,
    };

    if (!existingSnap.exists()) {
      recordPayload.createdAt = nowTimestamp;
      recordPayload.createdBy = currentUserId;
    }

    // Process MASUK
    let inTime: string | null = null;
    let inAt: any = null;
    let inStatus: AttendanceStatus = 'HADIR';
    let menitTerlambat = 0;

    if (nextHasMasuk) {
      if (existingData?.waktuMasuk || existingData?.checkInTime) {
        // PERTAHANKAN TIMESTAMP & STATUS EXISTING
        inTime = existingData.waktuMasuk || existingData.checkInTime || null;
        inAt = existingData.checkInAt || nowTimestamp;
        inStatus = (existingData.status as AttendanceStatus) || 'HADIR';
        menitTerlambat = existingData.menitTerlambat || existingData.lateMinutes || 0;
      } else {
        // BUAT BARU DENGAN MEKANISME TIMESTAMP EXISTING (waktu jadwal atau aktual sistem)
        inTime = isToday ? currentRealTimeStr : daySched.checkInTime;
        inAt = nowTimestamp;
        const calc = hitungMenitTerlambat(inTime, daySched.checkInTime, 0);
        inStatus = calc.status;
        menitTerlambat = calc.menitTerlambat;
      }
    }

    // Process PULANG
    let outTime: string | null = null;
    let outAt: any = null;
    let statusPulang: string | null = null;
    let checkoutStatus: CheckoutStatus = 'BELUM_PULANG';
    let isEarlyCheckout = false;
    let earlyCheckoutMinutes = 0;

    if (nextHasPulang) {
      if (existingData?.waktuPulang || existingData?.checkOutTime) {
        // PERTAHANKAN TIMESTAMP & STATUS EXISTING
        outTime = existingData.waktuPulang || existingData.checkOutTime || null;
        outAt = existingData.checkOutAt || nowTimestamp;
        statusPulang = existingData.statusPulang || 'NORMAL';
        checkoutStatus = existingData.checkoutStatus || 'NORMAL';
        isEarlyCheckout = existingData.isEarlyCheckout || false;
        earlyCheckoutMinutes = existingData.earlyCheckoutMinutes || 0;
      } else {
        // BUAT BARU DENGAN MEKANISME TIMESTAMP EXISTING (waktu jadwal atau aktual sistem)
        outTime = isToday ? currentRealTimeStr : daySched.checkOutTime;
        outAt = nowTimestamp;
        const checkoutCalc = hitungStatusPulang(
          outTime,
          daySched.checkOutTime,
          daySched.earlyCheckoutToleranceMinutes
        );
        statusPulang = checkoutCalc.statusPulang;
        checkoutStatus = checkoutCalc.checkoutStatus;
        isEarlyCheckout = checkoutCalc.isEarlyCheckout;
        earlyCheckoutMinutes = checkoutCalc.earlyCheckoutMinutes;
      }
    }

    // Consolidated Status
    let finalStatus: AttendanceStatus | 'BELUM ABSEN' = 'BELUM ABSEN';
    if (nextHasMasuk && nextHasPulang) {
      finalStatus = inStatus === 'TERLAMBAT' ? 'TERLAMBAT' : 'HADIR';
    } else if (nextHasMasuk) {
      finalStatus = inStatus; // 'HADIR' or 'TERLAMBAT'
    } else if (nextHasPulang) {
      finalStatus = 'BELUM LENGKAP';
    } else {
      finalStatus = 'BELUM ABSEN';
    }

    recordPayload = {
      ...recordPayload,
      waktuMasuk: inTime,
      checkInTime: inTime,
      checkInAt: inAt,
      waktuPulang: outTime,
      checkOutTime: outTime,
      checkOutAt: outAt,
      status: finalStatus,
      statusPulang: nextHasPulang ? statusPulang : 'NORMAL',
      checkoutStatus: nextHasPulang ? checkoutStatus : 'BELUM_PULANG',
      menitTerlambat: nextHasMasuk ? menitTerlambat : 0,
      lateMinutes: nextHasMasuk ? menitTerlambat : 0,
      isEarlyCheckout: nextHasPulang ? isEarlyCheckout : false,
      earlyCheckoutMinutes: nextHasPulang ? earlyCheckoutMinutes : 0,
    };

    await setDoc(docRef, recordPayload, { merge: true });

    const statusObj = getChecklistStatus(nextHasMasuk, nextHasPulang, {
      ...existingData,
      status: finalStatus as any,
      menitTerlambat,
    });

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'CHECKLIST_ABSENSI_UPDATED',
      `${employee.name} (${date})`,
      `Owner checklist absensi ${employee.name} (${date}): ${checkType} -> ${
        checked ? 'Centang' : 'Hapus Centang'
      } (Status: ${statusObj.statusLabel})`
    );

    return { id: docId, ...recordPayload } as AttendanceRecord;
  } catch (err) {
    console.error('[TOGGLE_CHECKLIST_ATTENDANCE_ERROR]', err);
    handleFirestoreError(err, OperationType.WRITE, `attendance/${docId}`);
    throw err;
  }
}

// Bulk mark all employees present or checkout
export async function bulkChecklistAttendance(params: {
  employees: Employee[];
  date: string;
  action: 'ALL_FULL_DAY' | 'ALL_MASUK' | 'ALL_PULANG' | 'RESET_ALL';
  currentUserId: string;
  currentUserName: string;
}) {
  const { employees, date, action, currentUserId, currentUserName } = params;

  for (const emp of employees) {
    if (action === 'ALL_FULL_DAY') {
      await toggleChecklistAttendance({
        employee: emp,
        date,
        checkType: 'FULL_DAY',
        checked: true,
        currentUserId,
        currentUserName,
      });
    } else if (action === 'ALL_MASUK') {
      await toggleChecklistAttendance({
        employee: emp,
        date,
        checkType: 'MASUK',
        checked: true,
        currentUserId,
        currentUserName,
      });
    } else if (action === 'ALL_PULANG') {
      await toggleChecklistAttendance({
        employee: emp,
        date,
        checkType: 'PULANG',
        checked: true,
        currentUserId,
        currentUserName,
      });
    } else if (action === 'RESET_ALL') {
      const dateFormatted = date.replace(/-/g, '');
      const docId = `${emp.id}_${dateFormatted}`;
      const docRef = doc(db, 'attendance', docId);
      await setDoc(
        docRef,
        {
          waktuMasuk: null,
          checkInTime: null,
          checkInAt: null,
          waktuPulang: null,
          checkOutTime: null,
          checkOutAt: null,
          status: 'BELUM ABSEN',
          checkoutStatus: 'BELUM_PULANG',
          menitTerlambat: 0,
          lateMinutes: 0,
          isEarlyCheckout: false,
          earlyCheckoutMinutes: 0,
          updatedAt: serverTimestamp(),
          overrideBy: currentUserId,
        },
        { merge: true }
      );
    }
  }

  await catatAuditLog(
    currentUserId,
    currentUserName,
    'BULK_CHECKLIST_ABSENSI',
    date,
    `Owner melakukan aksi massal checklist absensi (${action}) untuk ${employees.length} karyawan.`
  );
}

// ============================================================================
// 3. KOMISI EMPLOYEE (OWNER MANUAL INPUT)
// ============================================================================

export function subscribeEmployeeCommissions(
  callback: (commissions: EmployeeCommission[]) => void
) {
  const colRef = collection(db, 'employeeCommissions');
  const q = query(colRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as EmployeeCommission[];
      callback(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, 'employeeCommissions');
    }
  );
}

export async function saveEmployeeCommission(
  data: Omit<EmployeeCommission, 'createdBy' | 'createdAt' | 'updatedAt'> & { id?: string },
  currentUserId: string,
  currentUserName: string
): Promise<string> {
  try {
    const isNew = !data.id;
    const docId = data.id || `EMP_COMM_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const docRef = doc(db, 'employeeCommissions', docId);

    const nowTimestamp = serverTimestamp();

    const commissionPayload: any = {
      employeeId: data.employeeId,
      employeeName: data.employeeName.trim(),
      period: data.period.trim(),
      amount: Number(data.amount) || 0,
      basis: data.basis.trim(),
      notes: data.notes || '',
      status: data.status || 'BELUM DIBAYAR',
      updatedAt: nowTimestamp,
      updatedBy: currentUserId,
      updatedByName: currentUserName,
    };

    if (data.paymentDate) {
      commissionPayload.paymentDate = data.paymentDate;
    }

    if (isNew) {
      commissionPayload.createdAt = nowTimestamp;
      commissionPayload.createdBy = currentUserId;
      commissionPayload.createdByName = currentUserName;
    }

    await setDoc(docRef, commissionPayload, { merge: true });

    await catatAuditLog(
      currentUserId,
      currentUserName,
      isNew ? 'CREATE_EMPLOYEE_COMMISSION' : 'UPDATE_EMPLOYEE_COMMISSION',
      `${data.employeeName} (${data.period})`,
      `Komisi Karyawan ${formatRupiah(Number(data.amount) || 0)} - Dasar: ${data.basis}. Status: ${data.status}`
    );

    return docId;
  } catch (err) {
    console.error('[SAVE_EMPLOYEE_COMMISSION_ERROR]', err);
    handleFirestoreError(err, OperationType.WRITE, 'employeeCommissions');
    throw err;
  }
}

export async function updateEmployeeCommissionPaymentStatus(params: {
  commissionId: string;
  status: 'BELUM DIBAYAR' | 'SUDAH DIBAYAR';
  paymentDate?: string;
  commission: EmployeeCommission;
  currentUserId: string;
  currentUserName: string;
}) {
  const { commissionId, status, paymentDate, commission, currentUserId, currentUserName } = params;
  const docRef = doc(db, 'employeeCommissions', commissionId);

  try {
    const updatePayload: any = {
      status,
      updatedAt: serverTimestamp(),
      updatedBy: currentUserId,
      updatedByName: currentUserName,
    };

    if (status === 'SUDAH DIBAYAR') {
      const payDate = paymentDate || tanggalHariIni();
      updatePayload.paymentDate = payDate;
      updatePayload.paidAt = serverTimestamp();
      updatePayload.paidBy = currentUserId;
      updatePayload.paidByName = currentUserName;
    } else {
      updatePayload.paymentDate = null;
      updatePayload.paidAt = null;
      updatePayload.paidBy = null;
      updatePayload.paidByName = null;
    }

    await updateDoc(docRef, updatePayload);

    await catatAuditLog(
      currentUserId,
      currentUserName,
      'STATUS_EMPLOYEE_COMMISSION_UPDATED',
      `${commission.employeeName} (${commission.period})`,
      `Status pembayaran komisi diubah menjadi: ${status} (Nominal: ${formatRupiah(commission.amount)})`
    );
  } catch (err) {
    console.error('[UPDATE_EMPLOYEE_COMMISSION_STATUS_ERROR]', err);
    handleFirestoreError(err, OperationType.UPDATE, `employeeCommissions/${commissionId}`);
    throw err;
  }
}

export async function deleteEmployeeCommission(
  commissionId: string,
  currentUserId?: string,
  currentUserName?: string
) {
  try {
    const docRef = doc(db, 'employeeCommissions', commissionId);
    await deleteDoc(docRef);

    if (currentUserId && currentUserName) {
      await catatAuditLog(
        currentUserId,
        currentUserName,
        'DELETE_EMPLOYEE_COMMISSION',
        commissionId,
        `Komisi Karyawan ID ${commissionId} dihapus oleh Owner.`
      );
    }
  } catch (err) {
    console.error('[DELETE_EMPLOYEE_COMMISSION_ERROR]', err);
    handleFirestoreError(err, OperationType.DELETE, `employeeCommissions/${commissionId}`);
    throw err;
  }
}
