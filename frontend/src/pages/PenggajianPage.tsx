import React, { useState, useEffect } from 'react';
import { CurrencyInput } from '../components/CurrencyInput';
import {
  Wallet,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  FileText,
  Sparkles,
  Edit2,
  RefreshCw,
  Check,
  Building2,
  Coins,
  Receipt,
  Info,
  ShieldCheck,
  Lock,
  Award,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { subscribeEmployees } from '../services/employeeService';
import { subscribeHolidays, subscribeWorkplaceSchedule } from '../services/settingsService';
import {
  bayarGaji,
  hitungDanSinkronisasiPayrollBulanan,
  setujuiPayroll,
  subscribePayroll,
  updateAdjustmentManual,
  updateBonusManual,
} from '../services/payrollService';
import { Employee, Holiday, PayrollRecord, WorkplaceSchedule } from '../types';
import {
  formatBulanTahun,
  formatRupiah,
  formatTanggal,
  tanggalHariIni,
  bulanSekarang,
} from '../utils/formatters';
import { DEFAULT_SCHEDULE } from '../utils/attendanceCalc';
import { SlipGajiModal } from '../components/SlipGajiModal';
import { UangRajinPage } from './UangRajinPage';

export const PenggajianPage: React.FC = () => {
  const { userProfile, role, loading, currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'SALARY' | 'UANG_RAJIN'>('SALARY');
  const [selectedMonth, setSelectedMonth] = useState<string>(bulanSekarang());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [schedule, setSchedule] = useState<WorkplaceSchedule>(DEFAULT_SCHEDULE);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);

  // Slip Gaji Modal preview
  const [selectedSlip, setSelectedSlip] = useState<PayrollRecord | null>(null);

  // Edit bonus & adjustment modal
  const [editPayrollModal, setEditPayrollModal] = useState<PayrollRecord | null>(null);
  const [bonusInput, setBonusInput] = useState<number | ''>('');
  const [bonusNoteInput, setBonusNoteInput] = useState<string>('');
  const [additionInput, setAdditionInput] = useState<number | ''>('');
  const [additionNoteInput, setAdditionNoteInput] = useState<string>('');
  const [deductionInput, setDeductionInput] = useState<number | ''>('');
  const [deductionNoteInput, setDeductionNoteInput] = useState<string>('');

  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [paySuccess, setPaySuccess] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !currentUser || !userProfile?.active) {
      return;
    }
    const unsubEmp = subscribeEmployees('SHARING', setEmployees);
    const unsubHol = subscribeHolidays(setHolidays);
    const unsubSch = subscribeWorkplaceSchedule(setSchedule);
    const unsubPay = subscribePayroll(selectedMonth, setPayrollRecords);

    return () => {
      unsubEmp();
      unsubHol();
      unsubSch();
      unsubPay();
    };
  }, [loading, currentUser?.uid, userProfile?.role, userProfile?.active, selectedMonth]);

  // Trigger automated calculation on initial load if no records exist yet
  const handleAutoCalculate = async () => {
    if (employees.length === 0) return;
    setIsCalculating(true);
    setPayError(null);
    setPaySuccess(null);
    try {
      await hitungDanSinkronisasiPayrollBulanan(
        selectedMonth,
        employees,
        holidays,
        schedule,
        userProfile?.uid || 'owner',
        userProfile?.name || 'Owner PT.KDRT'
      );
      setPaySuccess(
        `Kalkulasi payroll bulan ${formatBulanTahun(
          selectedMonth
        )} berhasil disinkronisasikan dari absensi & uang rajin.`
      );
    } catch (err: any) {
      setPayError(err.message || 'Gagal melakukan kalkulasi otomatis payroll.');
    } finally {
      setIsCalculating(false);
    }
  };

  // Initial sync check
  useEffect(() => {
    if (employees.length > 0 && payrollRecords.length === 0) {
      handleAutoCalculate();
    }
  }, [employees.length, selectedMonth]);

  const handlePaySalary = async (record: PayrollRecord) => {
    setLoadingAction(`pay_${record.id}`);
    setPayError(null);
    setPaySuccess(null);

    try {
      await bayarGaji(
        record,
        userProfile?.uid || 'owner',
        userProfile?.name || 'Owner PT.KDRT'
      );
      setPaySuccess(
        `Gaji ${record.employeeName} sebesar ${formatRupiah(
          record.totalPay || record.total
        )} berhasil dibayar dan otomatis dicatat ke Arus Kas Keluar (Expense: SALARY).`
      );
    } catch (err: any) {
      setPayError(err.message || 'Gagal memproses pembayaran gaji.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleApproveAll = async () => {
    if (payrollRecords.length === 0) return;
    setLoadingAction('approve_all');
    setPayError(null);
    setPaySuccess(null);
    try {
      await setujuiPayroll(
        selectedMonth,
        payrollRecords,
        userProfile?.uid || 'owner',
        userProfile?.name || 'Owner PT.KDRT'
      );
      setPaySuccess(
        `Seluruh payroll periode ${formatBulanTahun(
          selectedMonth
        )} berhasil disetujui (APPROVED) dan siap dibayarkan.`
      );
    } catch (err: any) {
      setPayError(err.message || 'Gagal menyetujui payroll.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleOpenEditAdjustment = (record: PayrollRecord) => {
    setEditPayrollModal(record);
    setBonusInput(record.bonus || record.bonusAmount || 0);
    setBonusNoteInput(record.bonusNote || '');
    setAdditionInput(record.adjustmentAddition || 0);
    setAdditionNoteInput(record.adjustmentAdditionNote || '');
    setDeductionInput(record.adjustmentDeduction || record.deduction || 0);
    setDeductionNoteInput(record.adjustmentDeductionNote || record.deductionNote || '');
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPayrollModal) return;

    setLoadingAction('save_adjustment');
    try {
      await updateBonusManual(
        editPayrollModal,
        bonusInput,
        bonusNoteInput,
        userProfile?.uid || 'owner',
        userProfile?.name || 'Owner PT.KDRT'
      );

      await updateAdjustmentManual(
        editPayrollModal,
        'ADDITION',
        additionInput,
        additionNoteInput,
        userProfile?.uid || 'owner',
        userProfile?.name || 'Owner PT.KDRT'
      );

      await updateAdjustmentManual(
        editPayrollModal,
        'DEDUCTION',
        deductionInput,
        deductionNoteInput,
        userProfile?.uid || 'owner',
        userProfile?.name || 'Owner PT.KDRT'
      );

      setEditPayrollModal(null);
      setPaySuccess(`Penyesuaian & bonus ${editPayrollModal.employeeName} berhasil disimpan.`);
    } catch (err: any) {
      setPayError(err.message || 'Gagal menyimpan penyesuaian.');
    } finally {
      setLoadingAction(null);
    }
  };

  // Merge loaded employees with payrollRecords so all employees appear even if not yet saved
  const mergedPayrollList: PayrollRecord[] = employees.map((emp) => {
    const existing = payrollRecords.find((p) => p.employeeId === emp.id);
    if (existing) return existing;
    const baseSalary = emp.baseSalary || 0;
    return {
      id: `${emp.id}_${selectedMonth}`,
      payrollId: `payroll_${selectedMonth}`,
      employeeId: emp.id!,
      employeeName: emp.name,
      jobTitle: emp.position,
      month: selectedMonth,
      monthLabel: formatBulanTahun(selectedMonth),
      baseSalary,
      attendanceBonus: 0,
      bonus: 0,
      bonusAmount: 0,
      bonusNote: '',
      adjustmentAddition: 0,
      adjustmentAdditionNote: '',
      adjustmentDeduction: 0,
      adjustmentDeductionNote: '',
      deduction: 0,
      totalPay: baseSalary,
      total: baseSalary,
      status: 'CALCULATED',
      paymentDate: '25',
    };
  });

  const totalPenggajianBulan = mergedPayrollList.reduce(
    (sum, p) => sum + (p.totalPay || p.total || 0),
    0
  );
  const totalGajiSudahDibayar = mergedPayrollList
    .filter((p) => p.status === 'PAID')
    .reduce((sum, p) => sum + (p.totalPay || p.total || 0), 0);
  const totalGajiBelumDibayar = totalPenggajianBulan - totalGajiSudahDibayar;
  const countApproved = mergedPayrollList.filter((p) => p.status === 'APPROVED').length;
  const countPaid = mergedPayrollList.filter((p) => p.status === 'PAID').length;

  // If Investor, restrict viewing individual payroll
  if (role === 'INVESTOR') {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center shadow-2xs space-y-4">
        <Lock className="h-12 w-12 text-zinc-400 mx-auto" />
        <h2 className="text-lg font-bold text-zinc-900">Akses Terbatas</h2>
        <p className="text-xs text-zinc-500 max-w-md mx-auto">
          Investor hanya memiliki akses ke Ringkasan Laporan Laba Rugi dan Neraca Keuangan. Detail data payroll individual karyawan dirahasiakan sesuai kebijakan privasi PT.KDRT.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12" id="penggajian-page-root">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
              <Sparkles className="h-3 w-3" />
              Kategori SHARING
            </span>
            <span className="text-xs text-zinc-400 font-medium">Jatuh Tempo: Setiap Tanggal 25</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 flex items-center gap-2.5 mt-1">
            <Wallet className="h-7 w-7 text-emerald-600" />
            Salary Karyawan
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">
            Sistem Salary resmi PT.KDRT: Gaji Pokok + Total Uang Rajin Mingguan + Bonus Insentif − Penyesuaian.
          </p>
        </div>

        {/* Action Controls & Month Selector (When on Salary Tab) */}
        {activeTab === 'SALARY' && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white rounded-2xl border border-zinc-200 p-2 shadow-2xs">
              <Calendar className="h-4 w-4 text-zinc-400 ml-1" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs font-bold text-zinc-900 focus:outline-none"
              />
            </div>

            {role === 'OWNER' && (
              <>
                <button
                  onClick={handleAutoCalculate}
                  disabled={isCalculating}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-zinc-900 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800 transition-colors shadow-2xs disabled:opacity-50"
                  title="Kalkulasi Ulang dari Absensi & Uang Rajin"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${isCalculating ? 'animate-spin text-emerald-400' : ''}`}
                  />
                  {isCalculating ? 'Menghitung...' : 'Kalkulasi Ulang'}
                </button>

                {countApproved < mergedPayrollList.length && countPaid < mergedPayrollList.length && (
                  <button
                    onClick={handleApproveAll}
                    disabled={loadingAction === 'approve_all'}
                    className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition-colors shadow-2xs disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {loadingAction === 'approve_all' ? 'Memproses...' : 'Setujui Semua (Approve)'}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-zinc-200 pb-3">
        <button
          onClick={() => setActiveTab('SALARY')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'SALARY'
              ? 'bg-zinc-900 text-white shadow-xs'
              : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
          }`}
        >
          <Wallet className="h-4 w-4" />
          Salary Bulanan
        </button>
        <button
          onClick={() => setActiveTab('UANG_RAJIN')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'UANG_RAJIN'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
          }`}
        >
          <Award className="h-4 w-4" />
          Uang Rajin Mingguan
        </button>
      </div>

      {activeTab === 'UANG_RAJIN' ? (
        <UangRajinPage />
      ) : (
        <>
          {/* Rules Notice */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 text-xs text-zinc-700 shadow-2xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-zinc-900 text-sm">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>Prinsip Keamanan & Alur Pembayaran Salary PT.KDRT</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-zinc-600 leading-relaxed pt-1">
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                <span className="font-bold text-zinc-900 block mb-1">1. Alur Status Salary</span>
                <span className="text-[11px]">
                  DRAFT / CALCULATED → APPROVED → PAID. Status wajib disetujui Owner sebelum eksekusi pembayaran.
                </span>
              </div>
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                <span className="font-bold text-zinc-900 block mb-1">2. Perlindungan Gaji Pokok</span>
                <span className="text-[11px]">
                  Gaji pokok <strong>tidak otomatis terpotong</strong> karena terlambat. Potongan keterlambatan hanya mengurangi Uang Rajin mingguan.
                </span>
              </div>
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                <span className="font-bold text-zinc-900 block mb-1">3. Anti-Double Payment & Kas</span>
                <span className="text-[11px]">
                  Draft salary bukan beban kas. Arus kas keluar (Expense) dicatat tepat satu kali saat tombol <strong>[ Bayar Salary ]</strong> ditekan.
                </span>
              </div>
            </div>
          </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Total Beban Payroll
          </span>
          <div className="mt-1">
            <p className="text-2xl font-extrabold text-zinc-900">
              {formatRupiah(totalPenggajianBulan)}
            </p>
            <span className="text-xs text-zinc-500 font-medium">{employees.length} Karyawan Sharing</span>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 shadow-2xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
            Sudah Dibayar (Kas Keluar)
          </span>
          <div className="mt-1">
            <p className="text-2xl font-extrabold text-emerald-900">
              {formatRupiah(totalGajiSudahDibayar)}
            </p>
            <span className="text-xs text-emerald-700 font-medium">
              {countPaid} / {employees.length} Karyawan Selesai
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4 shadow-2xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
            Menunggu Pembayaran
          </span>
          <div className="mt-1">
            <p className="text-2xl font-extrabold text-amber-900">
              {formatRupiah(totalGajiBelumDibayar)}
            </p>
            <span className="text-xs text-amber-700 font-semibold">
              Jatuh Tempo: 25 {formatBulanTahun(selectedMonth)}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Status Persetujuan
          </span>
          <div className="mt-1">
            <p className="text-2xl font-extrabold text-zinc-900">
              {countPaid > 0
                ? `${countPaid} Lunas`
                : countApproved === employees.length
                ? 'Semua Disetujui'
                : `${countApproved} / ${employees.length} Approved`}
            </p>
            <span className="text-xs text-zinc-500 font-medium">Periode {formatBulanTahun(selectedMonth)}</span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {paySuccess && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-bold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{paySuccess}</span>
        </div>
      )}
      {payError && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs font-bold text-rose-900 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{payError}</span>
        </div>
      )}

      {/* Payroll Table */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xs">
        <div className="border-b border-zinc-100 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-zinc-900 text-sm">
              Tabel Payroll Karyawan ({formatBulanTahun(selectedMonth)})
            </h3>
            <p className="text-xs text-zinc-500">
              Gaji pokok otomatis dari Data Karyawan, Uang Rajin terakumulasi dari kehadiran mingguan
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 text-zinc-500 uppercase tracking-wider text-[10px] font-bold border-b border-zinc-100">
              <tr>
                <th className="px-6 py-3.5">Nama & Jabatan</th>
                <th className="px-4 py-3.5">Gaji Pokok</th>
                <th className="px-4 py-3.5">Uang Rajin</th>
                <th className="px-4 py-3.5">Bonus Insentif</th>
                <th className="px-4 py-3.5">Penyesuaian (+ / -)</th>
                <th className="px-4 py-3.5">Total Gaji Bersih</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Slip & Pembayaran</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              {mergedPayrollList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-zinc-400 font-medium">
                    Belum ada data karyawan kategori Sharing.
                  </td>
                </tr>
              ) : (
                mergedPayrollList.map((item) => {
                  const emp = employees.find((e) => e.id === item.employeeId);
                  const isPaid = item.status === 'PAID';
                  const isApproved = item.status === 'APPROVED';
                  const total = item.totalPay || item.total;

                  return (
                    <tr key={item.employeeId} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="px-6 py-4 font-bold text-zinc-900 text-sm">
                        {item.employeeName}
                        <span className="block text-[11px] text-zinc-500 font-medium">
                          {item.jobTitle || emp?.position || 'Staf Sharing'}
                        </span>
                      </td>

                      <td className="px-4 py-4 font-semibold text-zinc-800">
                        {formatRupiah(item.baseSalary)}
                      </td>

                      <td className="px-4 py-4 font-semibold text-emerald-700">
                        +{formatRupiah(item.attendanceBonus)}
                      </td>

                      <td className="px-4 py-4">
                        {(item.bonus || item.bonusAmount || 0) > 0 ? (
                          <div>
                            <span className="font-bold text-emerald-700">
                              +{formatRupiah(item.bonus || item.bonusAmount || 0)}
                            </span>
                            {item.bonusNote && (
                              <span className="block text-[10px] text-zinc-400">
                                {item.bonusNote}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-400 text-[11px]">Rp 0</span>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        {item.adjustmentAddition > 0 || (item.adjustmentDeduction || item.deduction || 0) > 0 ? (
                          <div className="space-y-0.5">
                            {item.adjustmentAddition > 0 && (
                              <span className="block font-semibold text-emerald-700 text-[11px]">
                                +{formatRupiah(item.adjustmentAddition)}
                              </span>
                            )}
                            {(item.adjustmentDeduction || item.deduction || 0) > 0 && (
                              <span className="block font-semibold text-rose-600 text-[11px]">
                                -{formatRupiah(item.adjustmentDeduction || item.deduction || 0)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-400 text-[11px]">Rp 0</span>
                        )}
                      </td>

                      <td className="px-4 py-4 font-extrabold text-sm text-zinc-900">
                        {formatRupiah(total)}
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            isPaid
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                              : isApproved
                              ? 'bg-blue-100 text-blue-900 border border-blue-200'
                              : 'bg-amber-100 text-amber-900 border border-amber-200'
                          }`}
                        >
                          {isPaid ? (
                            <>
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              PAID (Lunas)
                            </>
                          ) : isApproved ? (
                            <>
                              <Check className="h-3 w-3 text-blue-600" />
                              APPROVED
                            </>
                          ) : (
                            'CALCULATED'
                          )}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedSlip(item)}
                            className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 shadow-2xs transition-colors"
                            title="Lihat & Cetak Slip Gaji"
                          >
                            <FileText className="h-3.5 w-3.5 text-zinc-500" />
                            Slip Gaji
                          </button>

                          {role === 'OWNER' && (
                            <>
                              {!isPaid && (
                                <button
                                  onClick={() => handleOpenEditAdjustment(item)}
                                  className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
                                  title="Sesuaikan Bonus & Potongan Manual"
                                >
                                  <Edit2 className="h-3.5 w-3.5 text-zinc-500" />
                                  Edit
                                </button>
                              )}

                              {!isPaid ? (
                                <button
                                  onClick={() => handlePaySalary(item)}
                                  disabled={loadingAction === `pay_${item.id}`}
                                  className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                                >
                                  <DollarSign className="h-3.5 w-3.5" />
                                  {loadingAction === `pay_${item.id}` ? 'Memproses...' : 'Bayar Gaji'}
                                </button>
                              ) : (
                                <span className="text-xs text-zinc-400 font-medium px-2">Lunas</span>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {/* Bonus & Deduction Adjustment Modal */}
      {editPayrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-zinc-100">
              <div>
                <h3 className="text-base font-extrabold text-zinc-900">
                  Sesuaikan Bonus & Potongan
                </h3>
                <p className="text-xs text-zinc-500">{editPayrollModal.employeeName}</p>
              </div>
              <button
                onClick={() => setEditPayrollModal(null)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="space-y-4 text-xs mt-4">
              {/* Base Info */}
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 flex justify-between">
                <div>
                  <span className="text-zinc-400 block text-[10px] uppercase font-bold">Gaji Pokok</span>
                  <span className="font-bold text-zinc-900 text-sm">
                    {formatRupiah(editPayrollModal.baseSalary)}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[10px] uppercase font-bold">Uang Rajin</span>
                  <span className="font-bold text-emerald-700 text-sm">
                    +{formatRupiah(editPayrollModal.attendanceBonus)}
                  </span>
                </div>
              </div>

              {/* Bonus */}
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Bonus Performa / Insentif (Rp)
                </label>
                <CurrencyInput
                  value={bonusInput}
                  onChange={(val) => setBonusInput(val)}
                  className="w-full rounded-xl border border-zinc-300 p-2.5 font-bold text-zinc-900 focus:outline-emerald-600"
                />
                <input
                  type="text"
                  placeholder="Keterangan bonus (e.g. Capai target omset)"
                  value={bonusNoteInput}
                  onChange={(e) => setBonusNoteInput(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 p-2 text-xs mt-1 text-zinc-700"
                />
              </div>

              {/* Penyesuaian Tambahan */}
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Penyesuaian Tambahan (+) (Rp)
                </label>
                <CurrencyInput
                  value={additionInput}
                  onChange={(val) => setAdditionInput(val)}
                  className="w-full rounded-xl border border-zinc-300 p-2.5 font-bold text-emerald-700 focus:outline-emerald-600"
                />
                <input
                  type="text"
                  placeholder="Keterangan penyesuaian tambahan"
                  value={additionNoteInput}
                  onChange={(e) => setAdditionNoteInput(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 p-2 text-xs mt-1 text-zinc-700"
                />
              </div>

              {/* Potongan Manual */}
              <div className="pt-2 border-t border-zinc-100">
                <label className="block font-semibold text-zinc-700 mb-1">
                  Potongan Manual (−) (Rp)
                </label>
                <CurrencyInput
                  value={deductionInput}
                  onChange={(val) => setDeductionInput(val)}
                  className="w-full rounded-xl border border-zinc-300 p-2.5 font-bold text-rose-700 focus:outline-rose-600"
                />
                <input
                  type="text"
                  placeholder="Keterangan potongan (e.g. Kasbon atau cicilan)"
                  value={deductionNoteInput}
                  onChange={(e) => setDeductionNoteInput(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 p-2 text-xs mt-1 text-zinc-700"
                />
              </div>

              {/* Calculation Preview */}
              <div className="rounded-xl bg-zinc-900 p-3 text-white flex justify-between items-center">
                <span className="text-zinc-400 font-bold">Total Gaji Akhir</span>
                <span className="text-base font-extrabold text-emerald-400">
                  {formatRupiah(
                    Math.max(
                      0,
                      editPayrollModal.baseSalary +
                        editPayrollModal.attendanceBonus +
                        bonusInput +
                        additionInput -
                        deductionInput
                    )
                  )}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setEditPayrollModal(null)}
                  className="rounded-xl border border-zinc-200 px-4 py-2 font-semibold text-zinc-600 hover:bg-zinc-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loadingAction === 'save_adjustment'}
                  className="rounded-xl bg-emerald-600 px-5 py-2 font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {loadingAction === 'save_adjustment' ? 'Menyimpan...' : 'Simpan Penyesuaian'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Slip Gaji Modal */}
      <SlipGajiModal payroll={selectedSlip} onClose={() => setSelectedSlip(null)} />
    </div>
  );
};
