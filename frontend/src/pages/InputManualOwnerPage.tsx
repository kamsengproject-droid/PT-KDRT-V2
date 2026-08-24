import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  CalendarCheck,
  Users,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  Search,
  Filter,
  Save,
  X,
  Lock,
  ArrowRight,
  Sparkles,
  TrendingUp,
  CreditCard,
  Building,
  RefreshCw,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  WeeklyCommission,
  EmployeeCommission,
  Employee,
  AttendanceRecord,
  Account,
} from '../types';
import {
  subscribeWeeklyCommissions,
  saveWeeklyCommission,
  deleteWeeklyCommission,
  toggleChecklistAttendance,
  bulkChecklistAttendance,
  getChecklistStatus,
  subscribeEmployeeCommissions,
  saveEmployeeCommission,
  updateEmployeeCommissionPaymentStatus,
  deleteEmployeeCommission,
} from '../services/manualInputService';
import { subscribeEmployees } from '../services/employeeService';
import { subscribeAccounts } from '../services/accountService';
import { subscribeTodayAttendance } from '../services/attendanceService';
import {
  formatRupiah,
  formatTanggal,
  formatBulanTahun,
  tanggalHariIni,
  tanggalKemarin,
} from '../utils/formatters';

interface InputManualOwnerPageProps {
  onBackToPortal?: () => void;
  defaultTab?: 'KOMISI_MINGGUAN' | 'ABSENSI' | 'KOMISI_EMPLOYEE';
}

export const InputManualOwnerPage: React.FC<InputManualOwnerPageProps> = ({
  onBackToPortal,
  defaultTab = 'KOMISI_MINGGUAN',
}) => {
  const { role, userProfile, currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'KOMISI_MINGGUAN' | 'ABSENSI' | 'KOMISI_EMPLOYEE'>(
    defaultTab
  );

  // Data states
  const [weeklyCommissions, setWeeklyCommissions] = useState<WeeklyCommission[]>([]);
  const [employeeCommissions, setEmployeeCommissions] = useState<EmployeeCommission[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);

  // Form states - Weekly Commission
  const [isWeeklyModalOpen, setIsWeeklyModalOpen] = useState(false);
  const [editingWeekly, setEditingWeekly] = useState<WeeklyCommission | null>(null);
  const [weeklyPeriod, setWeeklyPeriod] = useState<string>('');
  const [weeklyAccountName, setWeeklyAccountName] = useState<string>('');
  const [weeklyAmount, setWeeklyAmount] = useState<string>('');
  const [weeklyDate, setWeeklyDate] = useState<string>(tanggalHariIni());
  const [weeklyNotes, setWeeklyNotes] = useState<string>('');
  const [weeklySearch, setWeeklySearch] = useState<string>('');
  const [isSavingWeekly, setIsSavingWeekly] = useState(false);

  // Form states - Attendance Checklist
  const [selectedAttendanceDate, setSelectedAttendanceDate] = useState<string>(tanggalHariIni());
  const [attendanceSearch, setAttendanceSearch] = useState<string>('');
  const [isUpdatingAttendance, setIsUpdatingAttendance] = useState<string | null>(null);

  // Form states - Employee Commission
  const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
  const [editingEmpComm, setEditingEmpComm] = useState<EmployeeCommission | null>(null);
  const [empSelectedId, setEmpSelectedId] = useState<string>('');
  const [empPeriod, setEmpPeriod] = useState<string>(
    formatBulanTahun(tanggalHariIni().substring(0, 7))
  );
  const [empAmount, setEmpAmount] = useState<string>('');
  const [empBasis, setEmpBasis] = useState<string>('Target VT Tercapai');
  const [empStatus, setEmpStatus] = useState<'BELUM DIBAYAR' | 'SUDAH DIBAYAR'>('BELUM DIBAYAR');
  const [empPaymentDate, setEmpPaymentDate] = useState<string>(tanggalHariIni());
  const [empNotes, setEmpNotes] = useState<string>('');
  const [empSearch, setEmpSearch] = useState<string>('');
  const [isSavingEmpComm, setIsSavingEmpComm] = useState(false);

  // Subscriptions
  useEffect(() => {
    if (role !== 'OWNER') return;

    const unsubWeekly = subscribeWeeklyCommissions((list) => {
      setWeeklyCommissions(list);
    });

    const unsubEmpComm = subscribeEmployeeCommissions((list) => {
      setEmployeeCommissions(list);
    });

    const unsubEmployees = subscribeEmployees(undefined, (list) => {
      setEmployees(list.filter((e) => e.active !== false));
    });

    const unsubAccounts = subscribeAccounts(undefined, (list) => {
      setAccounts(list);
    });

    const unsubAttendance = subscribeTodayAttendance(selectedAttendanceDate, (list) => {
      setAttendanceRecords(list);
    });

    return () => {
      unsubWeekly();
      unsubEmpComm();
      unsubEmployees();
      unsubAccounts();
      unsubAttendance();
    };
  }, [role, selectedAttendanceDate]);

  // Restrict to OWNER
  if (role !== 'OWNER') {
    return (
      <div className="flex h-[70vh] items-center justify-center p-8">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-900 max-w-md shadow-xs">
          <Lock className="mx-auto h-12 w-12 text-rose-600 mb-3" />
          <h3 className="text-lg font-bold text-rose-950">Akses Dibatasi Khusus Owner</h3>
          <p className="text-sm text-rose-700 mt-2 leading-relaxed">
            Halaman <strong>Input Manual</strong> adalah hak istimewa Akun Owner PT.KDRT. Akun
            Investor dan Karyawan tidak memiliki izin untuk melihat atau mengubah data ini.
          </p>
          {onBackToPortal && (
            <button
              onClick={onBackToPortal}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-xl transition"
            >
              Kembali ke Portal
            </button>
          )}
        </div>
      </div>
    );
  }

  // Current User Info for audit
  const currentUserId = currentUser?.uid || userProfile?.uid || 'OWNER_LOCAL';
  const currentUserName = userProfile?.name || 'Owner PT.KDRT';

  // --------------------------------------------------------------------------
  // WEEKLY COMMISSION HANDLERS
  // --------------------------------------------------------------------------
  const handleOpenWeeklyModal = (item?: WeeklyCommission) => {
    if (item) {
      setEditingWeekly(item);
      setWeeklyPeriod(item.periodWeek);
      setWeeklyAccountName(item.accountName);
      setWeeklyAmount(String(item.amount));
      setWeeklyDate(item.date);
      setWeeklyNotes(item.notes || '');
    } else {
      setEditingWeekly(null);
      // Auto suggest current week period
      const today = new Date();
      const monthName = today.toLocaleString('id-ID', { month: 'short' });
      const year = today.getFullYear();
      setWeeklyPeriod(`Minggu 3 (${monthName} ${year})`);
      setWeeklyAccountName(accounts.length > 0 ? accounts[0].accountName || accounts[0].name : '');
      setWeeklyAmount('');
      setWeeklyDate(tanggalHariIni());
      setWeeklyNotes('');
    }
    setIsWeeklyModalOpen(true);
  };

  const handleSaveWeekly = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(weeklyAmount.replace(/[^0-9]/g, ''));
    if (!weeklyPeriod.trim() || !weeklyAccountName.trim() || numAmount <= 0) {
      alert('Mohon isi Periode Minggu, Nama Akun/Seller, dan Nominal Komisi dengan valid.');
      return;
    }

    try {
      setIsSavingWeekly(true);
      const matchedAcc = accounts.find(
        (a) => (a.accountName || a.name).toLowerCase() === weeklyAccountName.toLowerCase()
      );

      await saveWeeklyCommission(
        {
          id: editingWeekly?.id,
          periodWeek: weeklyPeriod.trim(),
          accountName: weeklyAccountName.trim(),
          sellerName: weeklyAccountName.trim(),
          accountId: matchedAcc?.id,
          amount: numAmount,
          date: weeklyDate || tanggalHariIni(),
          notes: weeklyNotes.trim(),
          transactionId: editingWeekly?.transactionId,
        },
        currentUserId,
        currentUserName
      );

      setIsWeeklyModalOpen(false);
      setEditingWeekly(null);
    } catch (err: any) {
      alert('Gagal menyimpan Komisi Mingguan: ' + err.message);
    } finally {
      setIsSavingWeekly(false);
    }
  };

  const handleDeleteWeekly = async (item: WeeklyCommission) => {
    if (
      !window.confirm(
        `Yakin ingin menghapus catatan Komisi Mingguan ${item.accountName} (${formatRupiah(
          item.amount
        )})? Data transaksi buku kas terkait juga akan disinkronkan.`
      )
    ) {
      return;
    }

    try {
      await deleteWeeklyCommission(
        item.id!,
        item.transactionId,
        currentUserId,
        currentUserName
      );
    } catch (err: any) {
      alert('Gagal menghapus: ' + err.message);
    }
  };

  // Filtered Weekly Commissions
  const filteredWeeklyCommissions = useMemo(() => {
    return weeklyCommissions.filter((item) => {
      const matchSearch =
        item.accountName.toLowerCase().includes(weeklySearch.toLowerCase()) ||
        item.periodWeek.toLowerCase().includes(weeklySearch.toLowerCase()) ||
        (item.notes && item.notes.toLowerCase().includes(weeklySearch.toLowerCase()));
      return matchSearch;
    });
  }, [weeklyCommissions, weeklySearch]);

  const totalWeeklyAmount = useMemo(() => {
    return weeklyCommissions.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [weeklyCommissions]);

  // --------------------------------------------------------------------------
  // ATTENDANCE CHECKLIST HANDLERS
  // --------------------------------------------------------------------------
  // Map attendance records for selected date
  const attendanceMapForDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    attendanceRecords.forEach((rec) => {
      const recDate = rec.date || rec.tanggal;
      if (recDate === selectedAttendanceDate) {
        map.set(rec.employeeId, rec);
      }
    });
    return map;
  }, [attendanceRecords, selectedAttendanceDate]);

  const handleToggleAttendance = async (
    employee: Employee,
    checkType: 'FULL_DAY' | 'MASUK' | 'PULANG',
    currentChecked: boolean
  ) => {
    const nextChecked = !currentChecked;
    try {
      setIsUpdatingAttendance(employee.id! + '_' + checkType);
      await toggleChecklistAttendance({
        employee,
        date: selectedAttendanceDate,
        checkType,
        checked: nextChecked,
        currentUserId,
        currentUserName,
      });
    } catch (err: any) {
      alert('Gagal memperbarui absensi: ' + err.message);
    } finally {
      setIsUpdatingAttendance(null);
    }
  };

  const handleBulkAttendance = async (action: 'ALL_FULL_DAY' | 'ALL_MASUK' | 'ALL_PULANG' | 'RESET_ALL') => {
    const actionLabel =
      action === 'ALL_FULL_DAY'
        ? 'Tandai Semua Hadir Penuh (FULL DAY)'
        : action === 'ALL_MASUK'
        ? 'Tandai Semua Hadir Masuk'
        : action === 'ALL_PULANG'
        ? 'Tandai Semua Hadir Pulang'
        : 'Reset Seluruh Absensi Hari Ini';

    if (
      !window.confirm(
        `Apakah Anda yakin ingin melakukan ${actionLabel} untuk seluruh tim (${employees.length} karyawan) pada tanggal ${formatTanggal(
          selectedAttendanceDate
        )}?`
      )
    ) {
      return;
    }

    try {
      setIsUpdatingAttendance('BULK');
      await bulkChecklistAttendance({
        employees,
        date: selectedAttendanceDate,
        action,
        currentUserId,
        currentUserName,
      });
    } catch (err: any) {
      alert('Gagal melakukan aksi massal: ' + err.message);
    } finally {
      setIsUpdatingAttendance(null);
    }
  };

  // Filtered employees for attendance
  const filteredAttendanceEmployees = useMemo(() => {
    return employees.filter((emp) =>
      emp.name.toLowerCase().includes(attendanceSearch.toLowerCase()) ||
      (emp.position && emp.position.toLowerCase().includes(attendanceSearch.toLowerCase()))
    );
  }, [employees, attendanceSearch]);

  // Attendance stats for selected date (HADIR, TERLAMBAT, SUDAH PULANG, BELUM ABSEN)
  const attendanceStats = useMemo(() => {
    let hadir = 0;
    let terlambat = 0;
    let sudahPulang = 0;
    let belumAbsen = 0;

    employees.forEach((emp) => {
      const rec = attendanceMapForDate.get(emp.id!);
      const hasMasuk = !!(rec?.waktuMasuk || rec?.checkInTime);
      const hasPulang = !!(rec?.waktuPulang || rec?.checkOutTime);
      const isLate =
        rec?.status === 'TERLAMBAT' ||
        (typeof rec?.menitTerlambat === 'number' && rec.menitTerlambat > 0) ||
        (typeof rec?.lateMinutes === 'number' && rec.lateMinutes > 0);

      if (!hasMasuk) {
        belumAbsen++;
      } else if (hasPulang) {
        sudahPulang++;
        if (isLate) terlambat++;
      } else if (isLate) {
        terlambat++;
      } else {
        hadir++;
      }
    });

    return {
      total: employees.length,
      hadir,
      terlambat,
      sudahPulang,
      belumAbsen,
    };
  }, [employees, attendanceMapForDate]);

  // --------------------------------------------------------------------------
  // EMPLOYEE COMMISSION HANDLERS
  // --------------------------------------------------------------------------
  const handleOpenEmpModal = (item?: EmployeeCommission) => {
    if (item) {
      setEditingEmpComm(item);
      setEmpSelectedId(item.employeeId);
      setEmpPeriod(item.period);
      setEmpAmount(String(item.amount));
      setEmpBasis(item.basis);
      setEmpStatus(item.status);
      setEmpPaymentDate(item.paymentDate || tanggalHariIni());
      setEmpNotes(item.notes || '');
    } else {
      setEditingEmpComm(null);
      setEmpSelectedId(employees.length > 0 ? employees[0].id! : '');
      setEmpPeriod(formatBulanTahun(tanggalHariIni().substring(0, 7)));
      setEmpAmount('');
      setEmpBasis('Target VT Tercapai');
      setEmpStatus('BELUM DIBAYAR');
      setEmpPaymentDate(tanggalHariIni());
      setEmpNotes('');
    }
    setIsEmpModalOpen(true);
  };

  const handleSaveEmpComm = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(empAmount.replace(/[^0-9]/g, ''));
    const selectedEmp = employees.find((emp) => emp.id === empSelectedId);

    if (!selectedEmp || !empPeriod.trim() || numAmount <= 0 || !empBasis.trim()) {
      alert('Mohon pilih Karyawan, isi Periode, Dasar Komisi, dan Nominal Komisi dengan valid.');
      return;
    }

    try {
      setIsSavingEmpComm(true);
      await saveEmployeeCommission(
        {
          id: editingEmpComm?.id,
          employeeId: selectedEmp.id!,
          employeeName: selectedEmp.name,
          period: empPeriod.trim(),
          amount: numAmount,
          basis: empBasis.trim(),
          notes: empNotes.trim(),
          status: empStatus,
          paymentDate: empStatus === 'SUDAH DIBAYAR' ? empPaymentDate : undefined,
        },
        currentUserId,
        currentUserName
      );

      setIsEmpModalOpen(false);
      setEditingEmpComm(null);
    } catch (err: any) {
      alert('Gagal menyimpan Komisi Karyawan: ' + err.message);
    } finally {
      setIsSavingEmpComm(false);
    }
  };

  const handleToggleEmpCommStatus = async (item: EmployeeCommission) => {
    const nextStatus = item.status === 'SUDAH DIBAYAR' ? 'BELUM DIBAYAR' : 'SUDAH DIBAYAR';
    try {
      await updateEmployeeCommissionPaymentStatus({
        commissionId: item.id!,
        status: nextStatus,
        paymentDate: nextStatus === 'SUDAH DIBAYAR' ? tanggalHariIni() : undefined,
        commission: item,
        currentUserId,
        currentUserName,
      });
    } catch (err: any) {
      alert('Gagal mengubah status: ' + err.message);
    }
  };

  const handleDeleteEmpComm = async (item: EmployeeCommission) => {
    if (
      !window.confirm(
        `Yakin ingin menghapus catatan Komisi Karyawan ${item.employeeName} (${formatRupiah(
          item.amount
        )})?`
      )
    ) {
      return;
    }

    try {
      await deleteEmployeeCommission(item.id!, currentUserId, currentUserName);
    } catch (err: any) {
      alert('Gagal menghapus: ' + err.message);
    }
  };

  const filteredEmpCommissions = useMemo(() => {
    return employeeCommissions.filter((item) => {
      const matchSearch =
        item.employeeName.toLowerCase().includes(empSearch.toLowerCase()) ||
        item.period.toLowerCase().includes(empSearch.toLowerCase()) ||
        item.basis.toLowerCase().includes(empSearch.toLowerCase()) ||
        (item.notes && item.notes.toLowerCase().includes(empSearch.toLowerCase()));
      return matchSearch;
    });
  }, [employeeCommissions, empSearch]);

  const empCommissionStats = useMemo(() => {
    let totalNominal = 0;
    let sudahDibayar = 0;
    let belumDibayar = 0;

    employeeCommissions.forEach((item) => {
      const amt = Number(item.amount) || 0;
      totalNominal += amt;
      if (item.status === 'SUDAH DIBAYAR') sudahDibayar += amt;
      else belumDibayar += amt;
    });

    return { totalNominal, sudahDibayar, belumDibayar };
  }, [employeeCommissions]);

  // --------------------------------------------------------------------------
  // RENDER MAIN VIEW
  // --------------------------------------------------------------------------
  return (
    <div className="space-y-6 pb-16">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center p-2 rounded-xl bg-orange-100 text-orange-700">
                <Edit2 className="h-5 w-5" />
              </span>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                INPUT MANUAL OWNER
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
              Pencatatan data operasional eksklusif Owner: Komisi Mingguan, Absensi Tim, dan Komisi
              Karyawan.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
              <Lock className="h-3.5 w-3.5 text-amber-600" />
              <span>Khusus Owner (WIB Asia/Jakarta)</span>
            </span>
          </div>
        </div>

        {/* Tab Navigation Navigation Buttons */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-slate-100">
          <button
            onClick={() => setActiveTab('KOMISI_MINGGUAN')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition ${
              activeTab === 'KOMISI_MINGGUAN'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <DollarSign className="h-4 w-4" />
            <span>💰 KOMISI MINGGUAN</span>
            <span
              className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === 'KOMISI_MINGGUAN'
                  ? 'bg-slate-700 text-slate-200'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {weeklyCommissions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('ABSENSI')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition ${
              activeTab === 'ABSENSI'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <CalendarCheck className="h-4 w-4" />
            <span>📅 ABSENSI</span>
            <span
              className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === 'ABSENSI'
                  ? 'bg-slate-700 text-slate-200'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {attendanceStats.hadir + attendanceStats.sudahPulang}/{attendanceStats.total}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('KOMISI_EMPLOYEE')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition ${
              activeTab === 'KOMISI_EMPLOYEE'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>👤 KOMISI EMPLOYEE</span>
            <span
              className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === 'KOMISI_EMPLOYEE'
                  ? 'bg-slate-700 text-slate-200'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {employeeCommissions.length}
            </span>
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 1. TAB KOMISI MINGGUAN */}
      {/* ==================================================================== */}
      {activeTab === 'KOMISI_MINGGUAN' && (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
                TOTAL KOMISI MINGGUAN TERCATAT
              </span>
              <div className="text-xl sm:text-2xl font-black text-emerald-900 mt-1">
                {formatRupiah(totalWeeklyAmount)}
              </div>
              <span className="text-[11px] text-emerald-700 font-medium">
                {weeklyCommissions.length} Catatan Periode Komisi
              </span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
                SINKRONISASI BUKU KAS
              </span>
              <div className="text-xl sm:text-2xl font-black text-blue-900 mt-1">
                TERHUBUNG 100%
              </div>
              <span className="text-[11px] text-blue-700 font-medium">
                Otomatis masuk mutasi master transactions
              </span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
                  AKSI CEPAT
                </span>
                <p className="text-xs text-slate-600 mt-0.5">Tambah input komisi baru</p>
              </div>
              <button
                onClick={() => handleOpenWeeklyModal()}
                className="mt-2 inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl transition shadow-xs"
              >
                <Plus className="h-4 w-4" />
                <span>+ Catat Komisi Mingguan</span>
              </button>
            </div>
          </div>

          {/* Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Daftar Catatan Komisi Mingguan
                </h2>
                <p className="text-xs text-slate-500">
                  Data komisi mingguan per akun/seller yang masuk ke arus kas PT.KDRT
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari akun, periode, catatan..."
                    value={weeklySearch}
                    onChange={(e) => setWeeklySearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-orange-500 w-56 sm:w-64"
                  />
                </div>
              </div>
            </div>

            {filteredWeeklyCommissions.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <DollarSign className="mx-auto h-12 w-12 text-slate-300 mb-2" />
                <p className="font-bold text-sm text-slate-700">Belum Ada Data Komisi Mingguan</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Klik tombol <strong>+ Catat Komisi Mingguan</strong> untuk memasukkan komisi
                  mingguan seller / akun TikTok.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Tanggal Input</th>
                      <th className="py-3 px-4">Periode Minggu</th>
                      <th className="py-3 px-4">Nama Akun / Seller</th>
                      <th className="py-3 px-4 text-right">Nominal Komisi</th>
                      <th className="py-3 px-4">Catatan</th>
                      <th className="py-3 px-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredWeeklyCommissions.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {formatTanggal(item.date)}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px] font-semibold">
                            {item.periodWeek}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{item.accountName}</div>
                          {item.sellerName && item.sellerName !== item.accountName && (
                            <div className="text-[10px] text-slate-400">Seller: {item.sellerName}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-emerald-700 text-sm">
                          {formatRupiah(item.amount)}
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                          {item.notes || <span className="text-slate-300 italic">-</span>}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenWeeklyModal(item)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition"
                              title="Edit"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteWeekly(item)}
                              className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500 hover:text-rose-700 transition"
                              title="Hapus"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. TAB ABSENSI (CHECKLIST HARIAN) */}
      {/* ==================================================================== */}
      {activeTab === 'ABSENSI' && (
        <div className="space-y-6">
          {/* Top Control Bar: Date Selector & Quick Filters */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-orange-600" />
                  <span className="text-xs font-bold text-slate-800">Pilih Tanggal:</span>
                </div>
                <input
                  type="date"
                  value={selectedAttendanceDate}
                  onChange={(e) => setSelectedAttendanceDate(e.target.value)}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-orange-500"
                />
                <button
                  onClick={() => setSelectedAttendanceDate(tanggalHariIni())}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition ${
                    selectedAttendanceDate === tanggalHariIni()
                      ? 'bg-orange-600 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  Hari Ini
                </button>
                <button
                  onClick={() => setSelectedAttendanceDate(tanggalKemarin())}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition ${
                    selectedAttendanceDate === tanggalKemarin()
                      ? 'bg-orange-600 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  Kemarin
                </button>
              </div>

              {/* Bulk Action Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleBulkAttendance('ALL_FULL_DAY')}
                  disabled={isUpdatingAttendance !== null}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs transition"
                >
                  <Check className="h-4 w-4 stroke-[3]" />
                  <span>☑️ CENTANG SEMUA FULL DAY</span>
                </button>
                <button
                  onClick={() => handleBulkAttendance('RESET_ALL')}
                  disabled={isUpdatingAttendance !== null}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 text-xs font-bold transition"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* Attendance Status Counter Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-[10px] font-extrabold uppercase text-emerald-800 tracking-wider">
                  FULL DAY (HADIR)
                </span>
                <div className="text-lg font-black text-emerald-950 mt-0.5">
                  {attendanceStats.hadir + attendanceStats.sudahPulang}{' '}
                  <span className="text-xs font-normal text-emerald-700">karyawan</span>
                </div>
              </div>

              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                <span className="text-[10px] font-extrabold uppercase text-rose-800 tracking-wider">
                  TERLAMBAT
                </span>
                <div className="text-lg font-black text-rose-950 mt-0.5">
                  {attendanceStats.terlambat}{' '}
                  <span className="text-xs font-normal text-rose-700">karyawan</span>
                </div>
              </div>

              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                <span className="text-[10px] font-extrabold uppercase text-blue-800 tracking-wider">
                  SUDAH PULANG
                </span>
                <div className="text-lg font-black text-blue-950 mt-0.5">
                  {attendanceStats.sudahPulang}{' '}
                  <span className="text-xs font-normal text-blue-700">karyawan</span>
                </div>
              </div>

              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200">
                <span className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider">
                  BELUM ABSEN
                </span>
                <div className="text-lg font-black text-slate-900 mt-0.5">
                  {attendanceStats.belumAbsen}{' '}
                  <span className="text-xs font-normal text-slate-600">karyawan</span>
                </div>
              </div>
            </div>
          </div>

          {/* Checklist Table of Employees */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Checklist Uang Rajin / Kehadiran Tim — Tanggal {formatTanggal(selectedAttendanceDate)}
                </h2>
                <p className="text-xs text-slate-500">
                  Satu centang Full Day = karyawan hadir penuh pada hari tersebut.
                </p>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama karyawan..."
                  value={attendanceSearch}
                  onChange={(e) => setAttendanceSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-orange-500 w-56 sm:w-64"
                />
              </div>
            </div>

            {filteredAttendanceEmployees.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Users className="mx-auto h-12 w-12 text-slate-300 mb-2" />
                <p className="font-bold text-sm text-slate-700">Tidak Ada Karyawan Ditemukan</p>
                <p className="text-xs text-slate-400 mt-1">
                  Pastikan data master karyawan aktif sudah terdaftar di sistem.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Karyawan</th>
                      <th className="py-3 px-4 text-center">☑️ FULL DAY</th>
                      <th className="py-3 px-4 text-center">Status Kehadiran</th>
                      <th className="py-3 px-4">Waktu Tercatat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAttendanceEmployees.map((emp) => {
                      const rec = attendanceMapForDate.get(emp.id!);
                      const hasMasuk = !!(rec?.waktuMasuk || rec?.checkInTime);
                      const hasPulang = !!(rec?.waktuPulang || rec?.checkOutTime);
                      const isFullDay = hasMasuk;
                      const statusInfo = getChecklistStatus(hasMasuk, hasPulang, rec);
                      const isUpdatingThis =
                        isUpdatingAttendance?.startsWith(emp.id!) ||
                        isUpdatingAttendance === 'BULK';

                      return (
                        <tr key={emp.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-orange-100 text-orange-800 font-black flex items-center justify-center text-xs shrink-0">
                                {emp.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 text-sm">{emp.name}</div>
                                <div className="text-[11px] text-slate-500">
                                  {emp.position || 'Staff'} • {emp.division || 'Operasional'}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Checkbox FULL DAY */}
                          <td className="py-3.5 px-4 text-center">
                            <label className="inline-flex flex-col items-center justify-center cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={isFullDay}
                                disabled={isUpdatingThis}
                                onChange={() => handleToggleAttendance(emp, 'FULL_DAY', isFullDay)}
                                className="sr-only peer"
                              />
                              <div
                                className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${
                                  isFullDay
                                    ? 'bg-emerald-600 border-emerald-700 text-white shadow-xs'
                                    : 'bg-slate-100 border-slate-300 text-transparent hover:border-slate-400'
                                }`}
                              >
                                <Check className="h-5 w-5 stroke-[3]" />
                              </div>
                              <span className="text-[10px] font-bold text-slate-600 mt-1">
                                {isFullDay ? 'Hadir Penuh' : 'Tidak Hadir'}
                              </span>
                            </label>
                          </td>

                          {/* Status Kehadiran Badge */}
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusInfo.badgeClass}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${statusInfo.dotColor}`} />
                              <span>{isFullDay ? 'HADIR (FULL DAY)' : statusInfo.statusLabel}</span>
                            </span>
                          </td>

                          {/* Detail Waktu Tercatat */}
                          <td className="py-3.5 px-4 text-slate-600 text-[11px]">
                            {hasMasuk || hasPulang ? (
                              <div className="space-y-0.5 font-mono">
                                <div>Masuk: {rec?.waktuMasuk || rec?.checkInTime || '-'}</div>
                                <div>Pulang: {rec?.waktuPulang || rec?.checkOutTime || '-'}</div>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Belum ada absensi</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. TAB KOMISI EMPLOYEE */}
      {/* ==================================================================== */}
      {activeTab === 'KOMISI_EMPLOYEE' && (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
                TOTAL KOMISI EMPLOYEE
              </span>
              <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                {formatRupiah(empCommissionStats.totalNominal)}
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                {employeeCommissions.length} Catatan Komisi Karyawan
              </span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase text-emerald-800 tracking-wider">
                SUDAH DIBAYARKAN
              </span>
              <div className="text-xl sm:text-2xl font-black text-emerald-900 mt-1">
                {formatRupiah(empCommissionStats.sudahDibayar)}
              </div>
              <span className="text-[11px] text-emerald-700 font-medium">
                Lunas dibayarkan ke karyawan
              </span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-amber-800 tracking-wider">
                  BELUM DIBAYARKAN
                </span>
                <div className="text-xl sm:text-2xl font-black text-amber-950 mt-1">
                  {formatRupiah(empCommissionStats.belumDibayar)}
                </div>
              </div>
              <button
                onClick={() => handleOpenEmpModal()}
                className="mt-2 inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl transition shadow-xs"
              >
                <Plus className="h-4 w-4" />
                <span>+ Catat Komisi Karyawan</span>
              </button>
            </div>
          </div>

          {/* Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Daftar Catatan Komisi Khusus Karyawan
                </h2>
                <p className="text-xs text-slate-500">
                  Bonus dan komisi karyawan berdasarkan pencapaian target video, live streaming, atau
                  afiliasi.
                </p>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari karyawan, periode, dasar..."
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-orange-500 w-56 sm:w-64"
                />
              </div>
            </div>

            {filteredEmpCommissions.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Users className="mx-auto h-12 w-12 text-slate-300 mb-2" />
                <p className="font-bold text-sm text-slate-700">Belum Ada Data Komisi Karyawan</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Klik tombol <strong>+ Catat Komisi Karyawan</strong> untuk memasukkan bonus target
                  atau komisi performa karyawan.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Karyawan</th>
                      <th className="py-3 px-4">Periode</th>
                      <th className="py-3 px-4 text-right">Nominal Komisi</th>
                      <th className="py-3 px-4">Dasar Perhitungan</th>
                      <th className="py-3 px-4 text-center">Status Pembayaran</th>
                      <th className="py-3 px-4">Catatan</th>
                      <th className="py-3 px-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEmpCommissions.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 text-sm">{item.employeeName}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px] font-semibold">
                            {item.period}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-black text-slate-900 text-sm">
                          {formatRupiah(item.amount)}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-slate-700 bg-orange-50 text-orange-800 px-2 py-0.5 rounded text-[11px] border border-orange-200">
                            {item.basis}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleToggleEmpCommStatus(item)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition ${
                              item.status === 'SUDAH DIBAYAR'
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                                : 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                            }`}
                            title="Klik untuk ubah status pembayaran"
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                item.status === 'SUDAH DIBAYAR' ? 'bg-emerald-500' : 'bg-amber-500'
                              }`}
                            />
                            <span>{item.status}</span>
                          </button>
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                          {item.notes || <span className="text-slate-300 italic">-</span>}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenEmpModal(item)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition"
                              title="Edit"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteEmpComm(item)}
                              className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500 hover:text-rose-700 transition"
                              title="Hapus"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: INPUT KOMISI MINGGUAN */}
      {/* ==================================================================== */}
      {isWeeklyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orange-100 text-orange-700">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {editingWeekly ? 'Edit Komisi Mingguan' : 'Catat Komisi Mingguan Baru'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Data komisi akan otomatis disinkronkan ke buku kas transaksi.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsWeeklyModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveWeekly} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Periode Minggu <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Minggu 3 (17 - 23 Agu 2026)"
                  value={weeklyPeriod}
                  onChange={(e) => setWeeklyPeriod(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-orange-500 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Akun / Seller <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: @kedairt_official atau Seller Afiliasi"
                  value={weeklyAccountName}
                  onChange={(e) => setWeeklyAccountName(e.target.value)}
                  list="account-list"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-orange-500 text-xs font-semibold"
                />
                <datalist id="account-list">
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.accountName || acc.name} />
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Nominal Komisi (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Contoh: 1500000"
                    value={weeklyAmount}
                    onChange={(e) => setWeeklyAmount(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-orange-500 text-xs font-black text-emerald-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tanggal Penerimaan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={weeklyDate}
                    onChange={(e) => setWeeklyDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-orange-500 text-xs font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Catatan Tambahan</label>
                <textarea
                  rows={2}
                  placeholder="Catatan transfer, ID penarikan, atau rincian pencairan..."
                  value={weeklyNotes}
                  onChange={(e) => setWeeklyNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-orange-500 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsWeeklyModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingWeekly}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl transition shadow-xs"
                >
                  <Save className="h-4 w-4" />
                  <span>{isSavingWeekly ? 'Menyimpan...' : 'Simpan Komisi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: INPUT KOMISI EMPLOYEE */}
      {/* ==================================================================== */}
      {isEmpModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-orange-100 text-orange-700">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {editingEmpComm ? 'Edit Komisi Karyawan' : 'Catat Komisi Karyawan Baru'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Input bonus performa khusus untuk staf tim.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEmpModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEmpComm} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Pilih Karyawan <span className="text-rose-500">*</span>
                </label>
                <select
                  value={empSelectedId}
                  onChange={(e) => setEmpSelectedId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-orange-500 text-xs font-semibold bg-white"
                >
                  <option value="">-- Pilih Karyawan --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.position || 'Staff'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Periode <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Agustus 2026"
                    value={empPeriod}
                    onChange={(e) => setEmpPeriod(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-orange-500 text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Nominal Komisi (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Contoh: 500000"
                    value={empAmount}
                    onChange={(e) => setEmpAmount(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-orange-500 text-xs font-black text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Dasar Perhitungan / Alasan Komisi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Target VT 100 Video Tercapai / Bonus Live 50 Jam"
                  value={empBasis}
                  onChange={(e) => setEmpBasis(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-orange-500 text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Status Pembayaran <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={empStatus}
                    onChange={(e) => setEmpStatus(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-orange-500 text-xs font-bold bg-white"
                  >
                    <option value="BELUM DIBAYAR">BELUM DIBAYAR</option>
                    <option value="SUDAH DIBAYAR">SUDAH DIBAYAR</option>
                  </select>
                </div>

                {empStatus === 'SUDAH DIBAYAR' && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Tanggal Pembayaran
                    </label>
                    <input
                      type="date"
                      value={empPaymentDate}
                      onChange={(e) => setEmpPaymentDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-orange-500 text-xs font-semibold"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Catatan Tambahan</label>
                <textarea
                  rows={2}
                  placeholder="Keterangan tambahan..."
                  value={empNotes}
                  onChange={(e) => setEmpNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-orange-500 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEmpModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingEmpComm}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl transition shadow-xs"
                >
                  <Save className="h-4 w-4" />
                  <span>{isSavingEmpComm ? 'Menyimpan...' : 'Simpan Komisi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
