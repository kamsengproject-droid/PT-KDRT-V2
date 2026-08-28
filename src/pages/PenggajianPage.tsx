import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  Calendar,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Plus,
  Edit2,
  Trash2,
  Search,
  Filter,
  Check,
  X,
  Wallet,
  FileText,
  Clock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { subscribeEmployees } from '../services/employeeService';
import {
  subscribePayroll,
  createSalaryManual,
  updateSalaryManual,
  deleteSalaryManual,
  bayarSalaryManual,
  ManualSalaryInput,
} from '../services/payrollService';
import { Employee, PayrollRecord } from '../types';
import { formatBulanTahun, formatRupiah, bulanSekarang, tanggalHariIni, formatTanggal } from '../utils/formatters';
import { CurrencyInput } from '../components/CurrencyInput';
import { SlipGajiModal } from '../components/SlipGajiModal';

// Preset Akun Kas & Bank yang digunakan dalam sistem PT KDRT V3
const KAS_BANK_ACCOUNTS = [
  'BCA',
  'Kas Tunai',
  'Mandiri',
  'SeaBank',
  'BRI',
  'BNI',
  'BSI',
];

export const PenggajianPage: React.FC = () => {
  const { userProfile, currentUser, loading } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState<string>(bulanSekarang());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<PayrollRecord | null>(null);
  const [deleteConfirmRecord, setDeleteConfirmRecord] = useState<PayrollRecord | null>(null);
  const [selectedSlip, setSelectedSlip] = useState<PayrollRecord | null>(null);

  // Modal Bayar Gaji states
  const [payModalRecord, setPayModalRecord] = useState<PayrollRecord | null>(null);
  const [payDate, setPayDate] = useState<string>(tanggalHariIni());
  const [payAccount, setPayAccount] = useState<string>('BCA');
  const [payDescription, setPayDescription] = useState<string>('');
  const [isPaying, setIsPaying] = useState<boolean>(false);

  // Form Fields
  const [formEmployeeId, setFormEmployeeId] = useState<string>('');
  const [formEmployeeName, setFormEmployeeName] = useState<string>('');
  const [formJobTitle, setFormJobTitle] = useState<string>('Staff');
  const [formMonth, setFormMonth] = useState<string>(selectedMonth);
  const [formBaseSalary, setFormBaseSalary] = useState<number>(0);
  const [formBonus, setFormBonus] = useState<number>(0);
  const [formAdjustmentType, setFormAdjustmentType] = useState<'ADDITION' | 'DEDUCTION'>('ADDITION');
  const [formAdjustmentAmount, setFormAdjustmentAmount] = useState<number>(0);
  const [formAdjustmentNote, setFormAdjustmentNote] = useState<string>('');
  const [formStatus, setFormStatus] = useState<'BELUM DIBAYAR' | 'SUDAH DIBAYAR'>('BELUM DIBAYAR');
  const [formNotes, setFormNotes] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [payModalError, setPayModalError] = useState<string | null>(null);

  // Filter karyawan aktif saja
  const activeEmployees = useMemo(() => {
    return employees.filter((emp) => emp.active !== false);
  }, [employees]);

  // Subscribe to employees and payroll
  useEffect(() => {
    if (loading || !currentUser) return;
    const unsubEmp = subscribeEmployees('SHARING', setEmployees);
    const unsubPay = subscribePayroll(selectedMonth, setPayrollRecords);

    return () => {
      unsubEmp();
      unsubPay();
    };
  }, [loading, currentUser?.uid, selectedMonth]);

  // Sync form month when global selected month changes
  useEffect(() => {
    setFormMonth(selectedMonth);
  }, [selectedMonth]);

  // Calculate Net Salary Preview
  const netAdjustment =
    formAdjustmentType === 'ADDITION'
      ? Number(formAdjustmentAmount) || 0
      : -(Number(formAdjustmentAmount) || 0);
  const previewTotalSalary = Math.max(
    0,
    (Number(formBaseSalary) || 0) + (Number(formBonus) || 0) + netAdjustment
  );

  // Handle Employee Selection in Modal Dropdown
  const handleSelectEmployee = (empId: string) => {
    setFormEmployeeId(empId);
    if (!empId) {
      setFormEmployeeName('');
      setFormJobTitle('');
      return;
    }
    const found = activeEmployees.find((e) => e.id === empId) || employees.find((e) => e.id === empId);
    if (found) {
      setFormEmployeeName(found.name);
      setFormJobTitle(found.position || 'Staff');
      // If creating new and base salary is 0, prefill with master employee baseSalary
      if (!editingRecord && found.baseSalary) {
        setFormBaseSalary(Number(found.baseSalary) || 0);
      }
    }
  };

  const openCreateModal = () => {
    setEditingRecord(null);
    setFormEmployeeId('');
    setFormEmployeeName('');
    setFormJobTitle('');
    setFormMonth(selectedMonth);
    setFormBaseSalary(0);
    setFormBonus(0);
    setFormAdjustmentType('ADDITION');
    setFormAdjustmentAmount(0);
    setFormAdjustmentNote('');
    setFormStatus('BELUM DIBAYAR');
    setFormNotes('');
    setModalError(null);
    setIsFormOpen(true);
  };

  const openEditModal = (record: PayrollRecord) => {
    setEditingRecord(record);
    setFormEmployeeId(record.employeeId || '');
    setFormEmployeeName(record.employeeName || '');
    setFormJobTitle(record.jobTitle || 'Staff');
    setFormMonth(record.month || selectedMonth);
    setFormBaseSalary(Number(record.baseSalary) || 0);
    setFormBonus(Number(record.bonus || record.bonusAmount) || 0);

    const addVal = Number(record.adjustmentAddition) || 0;
    const dedVal = Number(record.adjustmentDeduction || record.deduction) || 0;
    if (dedVal > 0) {
      setFormAdjustmentType('DEDUCTION');
      setFormAdjustmentAmount(dedVal);
      setFormAdjustmentNote(record.adjustmentDeductionNote || record.deductionNote || '');
    } else {
      setFormAdjustmentType('ADDITION');
      setFormAdjustmentAmount(addVal);
      setFormAdjustmentNote(record.adjustmentAdditionNote || '');
    }

    const isPaid = record.status === 'PAID' || record.status === 'SUDAH DIBAYAR';
    setFormStatus(isPaid ? 'SUDAH DIBAYAR' : 'BELUM DIBAYAR');
    setFormNotes(record.notes || record.bonusNote || '');
    setModalError(null);
    setIsFormOpen(true);
  };

  // Buka Modal Pembayaran Gaji
  const openPayModal = (record: PayrollRecord) => {
    setPayModalRecord(record);
    setPayDate(tanggalHariIni());
    setPayAccount('BCA');
    const periodLabel = record.monthLabel || formatBulanTahun(record.month);
    setPayDescription(`Gaji ${record.employeeName} - ${periodLabel}`);
    setPayModalError(null);
  };

  // Konfirmasi Pembayaran Gaji (Integrasi Buku Kas & Bank)
  const handleConfirmPayment = async () => {
    if (!payModalRecord || !payModalRecord.id) return;
    setIsPaying(true);
    setPayModalError(null);
    try {
      await bayarSalaryManual({
        payrollRecord: payModalRecord,
        paymentDate: payDate,
        paymentAccount: payAccount,
        description: payDescription,
        currentUserId: userProfile?.uid || currentUser?.uid || 'owner',
        currentUserName: userProfile?.name || 'Owner PT.KDRT',
      });

      const totalNominal =
        payModalRecord.totalPay !== undefined
          ? Number(payModalRecord.totalPay)
          : Number(payModalRecord.total) || 0;

      setFeedback({
        type: 'success',
        message: `Gaji untuk ${payModalRecord.employeeName} (${formatRupiah(totalNominal)}) berhasil dibayar dari akun ${payAccount} dan dicatat ke Buku Kas & Bank.`,
      });
      setPayModalRecord(null);
    } catch (err: any) {
      console.error('Error confirming payment:', err);
      setPayModalError(err.message || 'Gagal memproses pembayaran gaji.');
      setFeedback({
        type: 'error',
        message: err.message || 'Gagal memproses pembayaran gaji.',
      });
    } finally {
      setIsPaying(false);
    }
  };

  const handleSaveSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!formEmployeeId || !formEmployeeName.trim()) {
      setModalError('Silakan pilih karyawan dari daftar karyawan aktif terlebih dahulu.');
      return;
    }
    if (!formMonth) {
      setModalError('Periode bulan wajib dipilih.');
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    const adjustmentSigned =
      formAdjustmentType === 'ADDITION'
        ? Number(formAdjustmentAmount) || 0
        : -(Number(formAdjustmentAmount) || 0);

    const payload: ManualSalaryInput = {
      employeeId: formEmployeeId,
      employeeName: formEmployeeName.trim(),
      jobTitle: formJobTitle.trim() || 'Staff',
      month: formMonth,
      baseSalary: Number(formBaseSalary) || 0,
      bonus: Number(formBonus) || 0,
      adjustment: adjustmentSigned,
      adjustmentNote: formAdjustmentNote.trim(),
      status: formStatus,
      notes: formNotes.trim(),
    };

    try {
      if (editingRecord && editingRecord.id) {
        await updateSalaryManual(
          editingRecord.id,
          payload,
          userProfile?.uid || currentUser?.uid || 'owner',
          userProfile?.name || 'Owner PT.KDRT'
        );
        setFeedback({
          type: 'success',
          message: `Data salary untuk ${payload.employeeName} berhasil diperbarui.`,
        });
      } else {
        await createSalaryManual(
          payload,
          userProfile?.uid || currentUser?.uid || 'owner',
          userProfile?.name || 'Owner PT.KDRT'
        );
        setFeedback({
          type: 'success',
          message: `Data salary baru untuk ${payload.employeeName} berhasil ditambahkan (Status: BELUM DIBAYAR).`,
        });
      }
      setIsFormOpen(false);
    } catch (err: any) {
      console.error('Error saving salary record:', err);
      const errMsg = err.message || 'Terjadi kesalahan saat menyimpan data salary ke sistem.';
      setModalError(errMsg);
      setFeedback({
        type: 'error',
        message: errMsg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSalary = async () => {
    if (!deleteConfirmRecord || !deleteConfirmRecord.id) return;
    setIsSubmitting(true);
    try {
      await deleteSalaryManual(
        deleteConfirmRecord.id,
        deleteConfirmRecord,
        userProfile?.uid || currentUser?.uid || 'owner',
        userProfile?.name || 'Owner PT.KDRT'
      );
      setFeedback({
        type: 'success',
        message: `Data salary ${deleteConfirmRecord.employeeName} berhasil dihapus.`,
      });
      setDeleteConfirmRecord(null);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Gagal menghapus data salary.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered & Rekap Calculations
  const filteredRecords = useMemo(() => {
    return payrollRecords.filter((rec) => {
      const matchSearch =
        rec.employeeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.jobTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.notes?.toLowerCase().includes(searchQuery.toLowerCase());

      const isPaid = rec.status === 'PAID' || rec.status === 'SUDAH DIBAYAR';
      if (statusFilter === 'PAID') return matchSearch && isPaid;
      if (statusFilter === 'UNPAID') return matchSearch && !isPaid;
      return matchSearch;
    });
  }, [payrollRecords, searchQuery, statusFilter]);

  const summary = useMemo(() => {
    let totalBaseSalary = 0;
    let totalBonus = 0;
    let totalAdjustment = 0;
    let totalNetSalary = 0;
    let totalPaidAmount = 0;
    let paidCount = 0;
    let unpaidCount = 0;

    payrollRecords.forEach((rec) => {
      const base = Number(rec.baseSalary) || 0;
      const bon = Number(rec.bonus || rec.bonusAmount) || 0;
      const add = Number(rec.adjustmentAddition) || 0;
      const ded = Number(rec.adjustmentDeduction || rec.deduction) || 0;
      const adj = add - ded;
      const net =
        rec.totalPay !== undefined
          ? Number(rec.totalPay)
          : Number(rec.total) || Math.max(0, base + bon + adj);

      totalBaseSalary += base;
      totalBonus += bon;
      totalAdjustment += adj;
      totalNetSalary += net;

      const isPaid = rec.status === 'PAID' || rec.status === 'SUDAH DIBAYAR';
      if (isPaid) {
        paidCount++;
        totalPaidAmount += net;
      } else {
        unpaidCount++;
      }
    });

    return {
      totalBaseSalary,
      totalBonus,
      totalAdjustment,
      totalNetSalary,
      totalPaidAmount,
      paidCount,
      unpaidCount,
      totalRecords: payrollRecords.length,
    };
  }, [payrollRecords]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 text-slate-100" id="salary-karyawan-root">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111726] border border-[#1E2637] p-5 sm:p-6 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-[#00E5FF] border border-cyan-500/20">
              <DollarSign className="h-3.5 w-3.5" />
              Input Manual Salary
            </span>
            <span className="text-xs text-slate-400">PT KDRT V3</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1.5 flex items-center gap-2.5">
            Salary Karyawan
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Kelola data gaji pokok, bonus, penyesuaian, dan pembayaran gaji terintegrasi Buku Kas & Bank.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Periode Month Filter */}
          <div className="flex items-center gap-2 bg-[#0B0F19] border border-[#1E2637] px-3.5 py-2 rounded-xl">
            <Calendar className="h-4 w-4 text-[#00E5FF]" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
              title="Pilih Periode Bulan"
            />
          </div>

          {/* Tambah Salary Button */}
          <button
            id="btn-tambah-salary"
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-[#00E5FF] hover:bg-[#00cbe3] text-slate-950 font-bold px-4 py-2 rounded-xl text-xs sm:text-sm transition shadow-lg shadow-cyan-500/20 active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            + Input Salary Baru
          </button>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs sm:text-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
              : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Rekap Periode / Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Gaji Pokok */}
        <div className="bg-[#111726] border border-[#1E2637] p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Total Gaji Pokok
          </span>
          <div className="mt-2">
            <span className="text-lg sm:text-xl font-bold text-white">
              {formatRupiah(summary.totalBaseSalary)}
            </span>
          </div>
        </div>

        {/* Total Bonus */}
        <div className="bg-[#111726] border border-[#1E2637] p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Total Bonus
          </span>
          <div className="mt-2">
            <span className="text-lg sm:text-xl font-bold text-emerald-400">
              {formatRupiah(summary.totalBonus)}
            </span>
          </div>
        </div>

        {/* Total Penyesuaian */}
        <div className="bg-[#111726] border border-[#1E2637] p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Total Penyesuaian (+/-)
          </span>
          <div className="mt-2">
            <span
              className={`text-lg sm:text-xl font-bold ${
                summary.totalAdjustment >= 0 ? 'text-cyan-400' : 'text-rose-400'
              }`}
            >
              {summary.totalAdjustment >= 0 ? '+' : ''}
              {formatRupiah(summary.totalAdjustment)}
            </span>
          </div>
        </div>

        {/* Total Gaji Bersih */}
        <div className="bg-[#111726] border border-[#00E5FF]/30 p-4 rounded-xl flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-[#111726] to-[#0d223a]">
          <span className="text-[11px] font-bold text-[#00E5FF] uppercase tracking-wider">
            Total Gaji Bersih
          </span>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {formatRupiah(summary.totalNetSalary)}
            </span>
          </div>
        </div>

        {/* Status Pembayaran */}
        <div className="col-span-2 lg:col-span-1 bg-[#111726] border border-[#1E2637] p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Status Pembayaran
          </span>
          <div className="mt-2 flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-emerald-400">{summary.paidCount} Terbayar</span>
              <p className="text-[10px] text-slate-400">{formatRupiah(summary.totalPaidAmount)}</p>
            </div>
            <div className="text-right">
              <span className="font-bold text-amber-400">{summary.unpaidCount} Belum</span>
              <p className="text-[10px] text-slate-400">{summary.totalRecords} Karyawan</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#111726] border border-[#1E2637] p-3.5 rounded-xl">
        <div className="relative w-full sm:w-80">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama karyawan, jabatan, catatan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0B0F19] border border-[#1E2637] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00E5FF]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#0B0F19] border border-[#1E2637] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#00E5FF] cursor-pointer"
          >
            <option value="ALL">Semua Status</option>
            <option value="PAID">Sudah Dibayar</option>
            <option value="UNPAID">Belum Dibayar</option>
          </select>
          <span className="text-xs text-slate-400 font-medium ml-2">
            Total: {filteredRecords.length} data
          </span>
        </div>
      </div>

      {/* Tabel Data Salary */}
      <div className="bg-[#111726] border border-[#1E2637] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs" id="table-salary-karyawan">
            <thead>
              <tr className="border-b border-[#1E2637] bg-[#0B0F19]/80 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                <th className="py-3.5 px-4">Karyawan</th>
                <th className="py-3.5 px-4">Periode</th>
                <th className="py-3.5 px-4 text-right">Gaji Pokok</th>
                <th className="py-3.5 px-4 text-right">Bonus</th>
                <th className="py-3.5 px-4 text-right">Penyesuaian (+/-)</th>
                <th className="py-3.5 px-4 text-right">Total Gaji Bersih</th>
                <th className="py-3.5 px-4 text-center">Status & Bayar</th>
                <th className="py-3.5 px-4">Catatan</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2637]/70">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <div className="max-w-xs mx-auto space-y-2">
                      <Wallet className="h-10 w-10 text-slate-600 mx-auto" />
                      <p className="font-medium text-slate-400">Belum ada data salary pada periode ini</p>
                      <p className="text-[11px] text-slate-500">
                        Klik tombol <strong>+ Input Salary Baru</strong> di atas untuk memilih karyawan dari Master Data.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                  const isPaid = rec.status === 'PAID' || rec.status === 'SUDAH DIBAYAR';
                  const base = Number(rec.baseSalary) || 0;
                  const bon = Number(rec.bonus || rec.bonusAmount) || 0;
                  const add = Number(rec.adjustmentAddition) || 0;
                  const ded = Number(rec.adjustmentDeduction || rec.deduction) || 0;
                  const adj = add - ded;
                  const net =
                    rec.totalPay !== undefined
                      ? Number(rec.totalPay)
                      : Number(rec.total) || Math.max(0, base + bon + adj);

                  return (
                    <tr
                      key={rec.id}
                      className="hover:bg-[#161f33] transition-colors group text-slate-200"
                    >
                      {/* Karyawan */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-slate-800 border border-[#1E2637] flex items-center justify-center text-[#00E5FF] font-bold text-xs">
                            {rec.employeeName ? rec.employeeName.charAt(0).toUpperCase() : 'K'}
                          </div>
                          <div>
                            <span className="font-semibold text-white block">{rec.employeeName}</span>
                            <span className="text-[11px] text-slate-400">{rec.jobTitle || 'Staff'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Periode */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-300 font-medium">
                        {rec.monthLabel || formatBulanTahun(rec.month)}
                      </td>

                      {/* Gaji Pokok */}
                      <td className="py-3.5 px-4 text-right font-medium text-slate-300">
                        {formatRupiah(base)}
                      </td>

                      {/* Bonus */}
                      <td className="py-3.5 px-4 text-right font-medium text-emerald-400">
                        {bon > 0 ? formatRupiah(bon) : '-'}
                      </td>

                      {/* Penyesuaian */}
                      <td className="py-3.5 px-4 text-right font-medium">
                        {adj !== 0 ? (
                          <div className="flex flex-col items-end">
                            <span className={adj > 0 ? 'text-cyan-400' : 'text-rose-400'}>
                              {adj > 0 ? `+${formatRupiah(adj)}` : `-${formatRupiah(Math.abs(adj))}`}
                            </span>
                            {(rec.adjustmentAdditionNote || rec.adjustmentDeductionNote) && (
                              <span className="text-[10px] text-slate-400 max-w-[120px] truncate">
                                {rec.adjustmentAdditionNote || rec.adjustmentDeductionNote}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>

                      {/* Total Gaji Bersih */}
                      <td className="py-3.5 px-4 text-right font-bold text-white whitespace-nowrap">
                        <span className="bg-[#0B0F19] px-2.5 py-1 rounded-md border border-[#1E2637]">
                          {formatRupiah(net)}
                        </span>
                      </td>

                      {/* Status & Bayar Gaji */}
                      <td className="py-3.5 px-4 text-center">
                        {isPaid ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              <Check className="h-3 w-3 stroke-[3]" />
                              SUDAH DIBAYAR
                            </span>
                            <div className="text-[10px] text-slate-400 flex flex-col items-center leading-tight mt-0.5">
                              <span>{rec.paymentDate ? formatTanggal(rec.paymentDate) : 'Sudah Terbayar'}</span>
                              <span className="text-emerald-400/90 font-medium">via {rec.paymentAccount || 'BCA'}</span>
                              <span className="text-[9px] text-slate-500">✓ Masuk Kas & Bank</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              <Clock className="h-3 w-3" />
                              BELUM DIBAYAR
                            </span>
                            <button
                              id={`btn-bayar-gaji-${rec.id}`}
                              onClick={() => openPayModal(rec)}
                              title="Bayar Gaji Karyawan"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-950 transition active:scale-95 cursor-pointer"
                            >
                              <Wallet className="h-3.5 w-3.5" />
                              BAYAR GAJI
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Catatan */}
                      <td className="py-3.5 px-4 text-slate-400 text-[11px] max-w-[160px] truncate">
                        {rec.notes || '-'}
                      </td>

                      {/* Aksi (EDIT & HAPUS & SLIP) */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Tombol Lihat Slip */}
                          <button
                            onClick={() => setSelectedSlip(rec)}
                            title="Lihat Slip Gaji"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-cyan-950/40 border border-transparent hover:border-cyan-800/40 transition cursor-pointer"
                          >
                            <FileText className="h-4 w-4" />
                          </button>

                          {/* Tombol EDIT */}
                          <button
                            id={`btn-edit-salary-${rec.id}`}
                            onClick={() => openEditModal(rec)}
                            title="Edit Data Salary"
                            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 border border-transparent hover:border-[#1E2637] transition cursor-pointer flex items-center gap-1 text-xs font-semibold px-2"
                          >
                            <Edit2 className="h-3.5 w-3.5 text-amber-400" />
                            <span>Edit</span>
                          </button>

                          {/* Tombol HAPUS */}
                          <button
                            id={`btn-delete-salary-${rec.id}`}
                            onClick={() => setDeleteConfirmRecord(rec)}
                            title="Hapus Data Salary"
                            className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 border border-transparent hover:border-rose-800/40 transition cursor-pointer flex items-center gap-1 text-xs font-semibold px-2"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                            <span>Hapus</span>
                          </button>
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

      {/* MODAL FORM INPUT / EDIT SALARY */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div
            className="bg-[#111726] border border-[#1E2637] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between p-5 border-b border-[#1E2637] bg-[#0B0F19]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-[#00E5FF] border border-cyan-500/20">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingRecord ? 'Edit Data Salary' : 'Input Salary Karyawan'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Sumber karyawan terhubung langsung ke Data Karyawan Aktif
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body Form */}
            <form onSubmit={handleSaveSalary} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Modal Error Banner */}
              {modalError && (
                <div className="p-3.5 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs text-rose-200 flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold text-rose-300">Gagal Menyimpan Data Salary</p>
                    <p className="text-[11px] text-rose-200 mt-0.5 leading-relaxed">{modalError}</p>
                  </div>
                </div>
              )}

              {/* Notification if editing already paid salary */}
              {editingRecord && (editingRecord.status === 'PAID' || editingRecord.status === 'SUDAH DIBAYAR') && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-[11px] text-emerald-300 flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                  <div>
                    <p className="font-bold">Salary ini sudah berstatus SUDAH DIBAYAR</p>
                    <p className="text-slate-400 mt-0.5">
                      Dibayar via {editingRecord.paymentAccount || 'Kas/Bank'} pada{' '}
                      {editingRecord.paymentDate ? formatTanggal(editingRecord.paymentDate) : '-'}.
                      Perubahan nominal di sini tidak akan otomatis mengubah catatan transaksi Buku Kas & Bank yang telah dibayarkan.
                    </p>
                  </div>
                </div>
              )}

              {/* Field: Nama Karyawan (Dropdown Terhubung ke DATA KARYAWAN) */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Nama Karyawan <span className="text-rose-400">*</span>
                </label>
                <select
                  id="select-employee"
                  value={formEmployeeId}
                  onChange={(e) => handleSelectEmployee(e.target.value)}
                  required
                  className="w-full bg-[#0B0F19] border border-[#1E2637] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#00E5FF] cursor-pointer text-xs"
                >
                  <option value="">[ Pilih Karyawan ▼ ]</option>
                  {activeEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.position || 'Staff'})
                    </option>
                  ))}
                </select>
                {activeEmployees.length === 0 && (
                  <p className="text-[11px] text-amber-400 mt-1">
                    ⚠️ Belum ada data karyawan aktif di menu Data Karyawan.
                  </p>
                )}
              </div>

              {/* Periode / Bulan & Jabatan (Jabatan Otomatis & Readonly) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Periode / Bulan <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="month"
                    value={formMonth}
                    onChange={(e) => setFormMonth(e.target.value)}
                    required
                    className="w-full bg-[#0B0F19] border border-[#1E2637] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-[#00E5FF]"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Jabatan / Role <span className="text-[10px] text-slate-500 font-normal">(Otomatis)</span>
                  </label>
                  <input
                    type="text"
                    value={formJobTitle || '-'}
                    readOnly
                    disabled
                    className="w-full bg-[#070b12] border border-[#1E2637] rounded-xl px-3.5 py-2 text-slate-300 font-medium cursor-not-allowed select-none"
                  />
                </div>
              </div>

              {/* Gaji Pokok & Bonus */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Gaji Pokok (Rp)</label>
                  <CurrencyInput
                    value={formBaseSalary}
                    onChange={(val) => setFormBaseSalary(Number(val) || 0)}
                    placeholder="0"
                    className="w-full bg-[#0B0F19] border border-[#1E2637] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-[#00E5FF] font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Bonus (Rp)</label>
                  <CurrencyInput
                    value={formBonus}
                    onChange={(val) => setFormBonus(Number(val) || 0)}
                    placeholder="0"
                    className="w-full bg-[#0B0F19] border border-[#1E2637] rounded-xl px-3.5 py-2 text-emerald-400 focus:outline-none focus:border-[#00E5FF] font-semibold"
                  />
                </div>
              </div>

              {/* Penyesuaian (+ / -) */}
              <div className="p-3.5 rounded-xl bg-[#0B0F19] border border-[#1E2637] space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-semibold">Penyesuaian (+ / -)</label>
                  <div className="flex items-center gap-1 bg-[#111726] p-0.5 rounded-lg border border-[#1E2637]">
                    <button
                      type="button"
                      onClick={() => setFormAdjustmentType('ADDITION')}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition ${
                        formAdjustmentType === 'ADDITION'
                          ? 'bg-cyan-500/20 text-[#00E5FF] border border-cyan-500/40'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      + Tambah
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormAdjustmentType('DEDUCTION')}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition ${
                        formAdjustmentType === 'DEDUCTION'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      - Potong
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <CurrencyInput
                    value={formAdjustmentAmount}
                    onChange={(val) => setFormAdjustmentAmount(Number(val) || 0)}
                    placeholder="Nominal penyesuaian"
                    className={`w-full bg-[#111726] border border-[#1E2637] rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-[#00E5FF] ${
                      formAdjustmentType === 'ADDITION' ? 'text-cyan-400' : 'text-rose-400'
                    }`}
                  />
                  <input
                    type="text"
                    placeholder="Keterangan penyesuaian (cth: lembur, kasbon, denda)"
                    value={formAdjustmentNote}
                    onChange={(e) => setFormAdjustmentNote(e.target.value)}
                    className="w-full bg-[#111726] border border-[#1E2637] rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00E5FF]"
                  />
                </div>
              </div>

              {/* Total Gaji Bersih Live Preview */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#0d223a] to-[#111726] border border-[#00E5FF]/30 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-[#00E5FF] font-semibold block">
                    Total Gaji Bersih (Kalkulasi)
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Gaji Pokok ({formatRupiah(Number(formBaseSalary) || 0)}) + Bonus ({formatRupiah(Number(formBonus) || 0)}) {netAdjustment >= 0 ? '+' : '-'} Penyesuaian ({formatRupiah(Math.abs(netAdjustment))})
                  </span>
                </div>
                <span className="text-lg font-black text-white">
                  {formatRupiah(previewTotalSalary)}
                </span>
              </div>

              {/* Status Info Box for New Salary */}
              {!editingRecord && (
                <div className="p-3 bg-[#0B0F19] border border-[#1E2637] rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-300 font-semibold block">Status Pembayaran:</span>
                    <span className="text-[10px] text-slate-400">
                      Gaji tersimpan sebagai kewajiban (Belum Dibayar). Pembayaran dilakukan via tombol Bayar Gaji di tabel.
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 whitespace-nowrap ml-2">
                    <Clock className="h-3 w-3" />
                    BELUM DIBAYAR
                  </span>
                </div>
              )}

              {/* Catatan */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Catatan Tambahan</label>
                <textarea
                  rows={2}
                  placeholder="Catatan gaji, rincian, atau keterangan lainnya (opsional)"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full bg-[#0B0F19] border border-[#1E2637] rounded-xl p-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00E5FF]"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#1E2637]">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#00E5FF] hover:bg-[#00cbe3] text-slate-950 transition active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : editingRecord ? 'Simpan Perubahan' : 'Tambah Salary'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL BAYAR GAJI */}
      {payModalRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div
            className="bg-[#111726] border border-[#1E2637] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-[#1E2637] bg-[#0B0F19]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">BAYAR GAJI</h3>
                  <p className="text-[11px] text-slate-400">
                    Proses pembayaran gaji & catat otomatis ke Buku Kas & Bank
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPayModalRecord(null)}
                disabled={isPaying}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Summary Box & Inputs */}
            <div className="p-5 space-y-4 text-xs">
              {/* Pay Modal Error */}
              {payModalError && (
                <div className="p-3.5 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs text-rose-200 flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold text-rose-300">Gagal Memproses Pembayaran Gaji</p>
                    <p className="text-[11px] text-rose-200 mt-0.5 leading-relaxed">{payModalError}</p>
                  </div>
                </div>
              )}

              {/* Summary Box */}
              <div className="p-3.5 rounded-xl bg-[#0B0F19] border border-[#1E2637] space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Karyawan:</span>
                  <span className="font-bold text-white">{payModalRecord.employeeName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Jabatan:</span>
                  <span className="text-slate-300 font-medium">{payModalRecord.jobTitle || 'Staff'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Periode:</span>
                  <span className="text-slate-300 font-medium">
                    {payModalRecord.monthLabel || formatBulanTahun(payModalRecord.month)}
                  </span>
                </div>
                <div className="border-t border-[#1E2637] pt-2 flex justify-between items-center">
                  <span className="font-bold text-slate-300">Total Gaji Bersih:</span>
                  <span className="text-base font-black text-[#00E5FF]">
                    {formatRupiah(payModalRecord.totalPay || payModalRecord.total || 0)}
                  </span>
                </div>
              </div>

              {/* Form Inputs */}
              <div className="space-y-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Tanggal Pembayaran <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    required
                    className="w-full bg-[#0B0F19] border border-[#1E2637] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-[#00E5FF]"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Dibayar Dari (Kas / Bank) <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={payAccount}
                    onChange={(e) => setPayAccount(e.target.value)}
                    required
                    className="w-full bg-[#0B0F19] border border-[#1E2637] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#00E5FF] cursor-pointer"
                  >
                    {KAS_BANK_ACCOUNTS.map((acc) => (
                      <option key={acc} value={acc}>
                        {acc}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Keterangan Transaksi
                  </label>
                  <input
                    type="text"
                    value={payDescription}
                    onChange={(e) => setPayDescription(e.target.value)}
                    placeholder="Keterangan transaksi kas"
                    className="w-full bg-[#0B0F19] border border-[#1E2637] rounded-xl px-3.5 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00E5FF]"
                  />
                </div>
              </div>

              {/* Info Notice */}
              <div className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-xl text-[11px] text-cyan-300">
                ℹ️ Konfirmasi pembayaran ini akan otomatis mencatat transaksi <strong>UANG KELUAR</strong> di Buku Kas & Bank pada akun <strong>{payAccount}</strong>.
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#1E2637]">
                <button
                  type="button"
                  onClick={() => setPayModalRecord(null)}
                  disabled={isPaying}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  id="btn-confirm-pay-salary"
                  onClick={handleConfirmPayment}
                  disabled={isPaying}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white transition shadow-lg shadow-emerald-950 active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {isPaying ? 'Memproses...' : 'Konfirmasi Pembayaran'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS */}
      {deleteConfirmRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div
            className="bg-[#111726] border border-rose-900/50 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Hapus Data Salary?</h3>
                <p className="text-xs text-slate-400">Tindakan ini tidak dapat dibatalkan.</p>
              </div>
            </div>

            <div className="p-3.5 bg-[#0B0F19] rounded-xl border border-[#1E2637] space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Karyawan:</span>
                <span className="font-bold text-white">{deleteConfirmRecord.employeeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Periode:</span>
                <span className="text-slate-200">
                  {deleteConfirmRecord.monthLabel || formatBulanTahun(deleteConfirmRecord.month)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Gaji:</span>
                <span className="font-bold text-[#00E5FF]">
                  {formatRupiah(deleteConfirmRecord.totalPay || deleteConfirmRecord.total || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status:</span>
                <span className={deleteConfirmRecord.status === 'PAID' || deleteConfirmRecord.status === 'SUDAH DIBAYAR' ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                  {deleteConfirmRecord.status === 'PAID' || deleteConfirmRecord.status === 'SUDAH DIBAYAR' ? 'SUDAH DIBAYAR' : 'BELUM DIBAYAR'}
                </span>
              </div>
            </div>

            {/* Warning if Paid */}
            {(deleteConfirmRecord.status === 'PAID' || deleteConfirmRecord.status === 'SUDAH DIBAYAR') && (
              <div className="p-3 bg-rose-950/50 border border-rose-800/60 rounded-xl text-rose-300 text-[11px] space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-rose-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                  PERINGATAN: Transaksi Kas Terhubung
                </p>
                <p className="text-rose-200/80">
                  Salary ini sudah <strong>SUDAH DIBAYAR</strong> (Akun: {deleteConfirmRecord.paymentAccount || 'Kas/Bank'}).
                  Menghapus salary ini akan sekaligus membatalkan/menghapus catatan pengeluaran terkait di Buku Kas & Bank agar pembukuan kas tetap seimbang.
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmRecord(null)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteSalary}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Menghapus...' : 'Ya, Hapus Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slip Gaji Modal Viewer */}
      {selectedSlip && (
        <SlipGajiModal
          payroll={selectedSlip}
          onClose={() => setSelectedSlip(null)}
        />
      )}
    </div>
  );
};
