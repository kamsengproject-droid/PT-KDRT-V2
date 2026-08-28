import React, { useState, useEffect, useMemo } from 'react';
import {
  Award,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Plus,
  Edit2,
  Trash2,
  Search,
  Filter,
  Check,
  X,
  Clock,
  DollarSign,
  User,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { subscribeEmployees } from '../services/employeeService';
import {
  subscribeAttendanceBonuses,
  createUangRajinManual,
  updateUangRajinManual,
  deleteUangRajinManual,
  ManualUangRajinInput,
} from '../services/payrollService';
import { AttendanceBonusWeek, Employee } from '../types';
import { formatBulanTahun, formatRupiah, bulanSekarang, tanggalHariIni } from '../utils/formatters';
import { CurrencyInput } from '../components/CurrencyInput';

export const UangRajinPage: React.FC = () => {
  const { userProfile, currentUser, loading } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState<string>(bulanSekarang());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [bonusRecords, setBonusRecords] = useState<AttendanceBonusWeek[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [employeeFilter, setEmployeeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceBonusWeek | null>(null);
  const [deleteConfirmRecord, setDeleteConfirmRecord] = useState<AttendanceBonusWeek | null>(null);

  // Form Fields
  const [formEmployeeId, setFormEmployeeId] = useState<string>('');
  const [formEmployeeName, setFormEmployeeName] = useState<string>('');
  const [formPeriodLabel, setFormPeriodLabel] = useState<string>('');
  const [formWeekStart, setFormWeekStart] = useState<string>(tanggalHariIni());
  const [formMonth, setFormMonth] = useState<string>(selectedMonth);
  const [formAmount, setFormAmount] = useState<number>(150000);
  const [formStatus, setFormStatus] = useState<'BELUM DIBAYAR' | 'SUDAH DIBAYAR'>('BELUM DIBAYAR');
  const [formNotes, setFormNotes] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Subscribe to employees and attendance bonuses
  useEffect(() => {
    if (loading || !currentUser) return;
    const unsubEmp = subscribeEmployees('SHARING', setEmployees);
    // Subscribe all bonuses or filtered
    const unsubBon = subscribeAttendanceBonuses(undefined, setBonusRecords);

    return () => {
      unsubEmp();
      unsubBon();
    };
  }, [loading, currentUser?.uid]);

  // Handle Employee Selection in Modal
  const handleSelectEmployee = (empId: string) => {
    setFormEmployeeId(empId);
    const found = employees.find((e) => e.id === empId);
    if (found) {
      setFormEmployeeName(found.name);
    }
  };

  const openCreateModal = () => {
    setEditingRecord(null);
    setFormEmployeeId(employees[0]?.id || '');
    setFormEmployeeName(employees[0]?.name || '');
    setFormPeriodLabel(`Minggu (${formatBulanTahun(selectedMonth)})`);
    setFormWeekStart(tanggalHariIni());
    setFormMonth(selectedMonth);
    setFormAmount(150000);
    setFormStatus('BELUM DIBAYAR');
    setFormNotes('');
    setIsFormOpen(true);
  };

  const openEditModal = (record: AttendanceBonusWeek) => {
    setEditingRecord(record);
    setFormEmployeeId(record.employeeId || '');
    setFormEmployeeName(record.employeeName || '');
    setFormPeriodLabel(record.label || '');
    setFormWeekStart(record.weekStart || tanggalHariIni());
    setFormMonth(record.month || (record.weekStart ? record.weekStart.substring(0, 7) : selectedMonth));
    setFormAmount(Number(record.finalBonus || record.bonusAmount || record.baseBonus) || 0);
    const isPaid = record.status === 'SUDAH DIBAYAR' || record.status === 'PAID';
    setFormStatus(isPaid ? 'SUDAH DIBAYAR' : 'BELUM DIBAYAR');
    setFormNotes(record.reason || '');
    setIsFormOpen(true);
  };

  const handleSaveUangRajin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmployeeName.trim()) {
      setFeedback({ type: 'error', message: 'Nama karyawan wajib diisi.' });
      return;
    }
    if (!formPeriodLabel.trim()) {
      setFeedback({ type: 'error', message: 'Minggu / Periode wajib diisi.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    const payload: ManualUangRajinInput = {
      employeeId: formEmployeeId || formEmployeeName.toLowerCase().replace(/\s+/g, '-'),
      employeeName: formEmployeeName.trim(),
      periodLabel: formPeriodLabel.trim(),
      weekStart: formWeekStart,
      month: formMonth || selectedMonth,
      amount: Number(formAmount) || 0,
      status: formStatus,
      notes: formNotes.trim(),
    };

    try {
      if (editingRecord && editingRecord.id) {
        await updateUangRajinManual(
          editingRecord.id,
          payload,
          userProfile?.uid || currentUser?.uid || 'owner',
          userProfile?.name || 'Owner PT.KDRT'
        );
        setFeedback({
          type: 'success',
          message: `Uang rajin ${payload.employeeName} berhasil diperbarui.`,
        });
      } else {
        await createUangRajinManual(
          payload,
          userProfile?.uid || currentUser?.uid || 'owner',
          userProfile?.name || 'Owner PT.KDRT'
        );
        setFeedback({
          type: 'success',
          message: `Uang rajin baru untuk ${payload.employeeName} berhasil ditambahkan.`,
        });
      }
      setIsFormOpen(false);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Terjadi kesalahan saat menyimpan data uang rajin.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUangRajin = async () => {
    if (!deleteConfirmRecord || !deleteConfirmRecord.id) return;
    setIsSubmitting(true);
    try {
      await deleteUangRajinManual(
        deleteConfirmRecord.id,
        deleteConfirmRecord,
        userProfile?.uid || currentUser?.uid || 'owner',
        userProfile?.name || 'Owner PT.KDRT'
      );
      setFeedback({
        type: 'success',
        message: `Data uang rajin ${deleteConfirmRecord.employeeName} (${deleteConfirmRecord.label}) berhasil dihapus.`,
      });
      setDeleteConfirmRecord(null);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Gagal menghapus data uang rajin.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (record: AttendanceBonusWeek) => {
    if (!record.id) return;
    const isPaid = record.status === 'SUDAH DIBAYAR' || record.status === 'PAID';
    const nextStatus = isPaid ? 'BELUM DIBAYAR' : 'SUDAH DIBAYAR';
    try {
      await updateUangRajinManual(
        record.id,
        { status: nextStatus },
        userProfile?.uid || currentUser?.uid || 'owner',
        userProfile?.name || 'Owner PT.KDRT'
      );
      setFeedback({
        type: 'success',
        message: `Status uang rajin ${record.employeeName} diubah menjadi: ${nextStatus}.`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Gagal memperbarui status pembayaran.',
      });
    }
  };

  // Month-filtered & All Records
  const monthRecords = useMemo(() => {
    if (!selectedMonth) return bonusRecords;
    return bonusRecords.filter((rec) => {
      if (rec.month) return rec.month === selectedMonth;
      if (rec.weekStart) return rec.weekStart.startsWith(selectedMonth);
      return true;
    });
  }, [bonusRecords, selectedMonth]);

  // Filtered by Search, Employee, & Status
  const filteredRecords = useMemo(() => {
    return monthRecords.filter((rec) => {
      const matchSearch =
        rec.employeeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.label?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.reason?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchEmployee =
        employeeFilter === 'ALL' ||
        rec.employeeId === employeeFilter ||
        rec.employeeName === employeeFilter;

      const isPaid = rec.status === 'SUDAH DIBAYAR' || rec.status === 'PAID';
      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'PAID' && isPaid) ||
        (statusFilter === 'UNPAID' && !isPaid);

      return matchSearch && matchEmployee && matchStatus;
    });
  }, [monthRecords, searchQuery, employeeFilter, statusFilter]);

  // Summary Metrics
  const summary = useMemo(() => {
    let totalNominal = 0;
    let totalPaid = 0;
    let totalUnpaid = 0;
    let paidCount = 0;
    let unpaidCount = 0;

    filteredRecords.forEach((rec) => {
      const nom = Number(rec.finalBonus || rec.bonusAmount || rec.baseBonus) || 0;
      totalNominal += nom;
      const isPaid = rec.status === 'SUDAH DIBAYAR' || rec.status === 'PAID';
      if (isPaid) {
        paidCount++;
        totalPaid += nom;
      } else {
        unpaidCount++;
        totalUnpaid += nom;
      }
    });

    return {
      totalNominal,
      totalPaid,
      totalUnpaid,
      paidCount,
      unpaidCount,
      totalCount: filteredRecords.length,
    };
  }, [filteredRecords]);

  // Rekap Per Karyawan
  const rekapPerKaryawan = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number; paid: number; unpaid: number }>();
    monthRecords.forEach((rec) => {
      const name = rec.employeeName || 'Karyawan';
      const nom = Number(rec.finalBonus || rec.bonusAmount || rec.baseBonus) || 0;
      const isPaid = rec.status === 'SUDAH DIBAYAR' || rec.status === 'PAID';

      const prev = map.get(name) || { name, total: 0, count: 0, paid: 0, unpaid: 0 };
      prev.total += nom;
      prev.count += 1;
      if (isPaid) prev.paid += nom;
      else prev.unpaid += nom;

      map.set(name, prev);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [monthRecords]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 text-slate-100" id="uang-rajin-root">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111726] border border-[#1E2637] p-5 sm:p-6 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-[#00E5FF] border border-cyan-500/20">
              <Award className="h-3.5 w-3.5" />
              Input Manual Uang Rajin
            </span>
            <span className="text-xs text-slate-400">PT KDRT V3</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1.5 flex items-center gap-2.5">
            Uang Rajin Mingguan
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Pencatatan manual uang rajin mingguan karyawan per periode tanpa kalkulasi otomatis.
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
              title="Filter Periode Bulan"
            />
          </div>

          {/* Tambah Uang Rajin Button */}
          <button
            id="btn-tambah-uang-rajin"
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-[#00E5FF] hover:bg-[#00cbe3] text-slate-950 font-bold px-4 py-2 rounded-xl text-xs sm:text-sm transition shadow-lg shadow-cyan-500/20 active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            + Input Uang Rajin Baru
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

      {/* Rekap Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Uang Rajin */}
        <div className="bg-[#111726] border border-[#00E5FF]/30 p-4 rounded-xl flex flex-col justify-between bg-gradient-to-br from-[#111726] to-[#0d223a]">
          <span className="text-[11px] font-bold text-[#00E5FF] uppercase tracking-wider">
            Total Uang Rajin
          </span>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black text-white">
              {formatRupiah(summary.totalNominal)}
            </span>
          </div>
        </div>

        {/* Sudah Dibayar */}
        <div className="bg-[#111726] border border-[#1E2637] p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Sudah Dibayar ({summary.paidCount})
          </span>
          <div className="mt-2">
            <span className="text-lg sm:text-xl font-bold text-emerald-400">
              {formatRupiah(summary.totalPaid)}
            </span>
          </div>
        </div>

        {/* Belum Dibayar */}
        <div className="bg-[#111726] border border-[#1E2637] p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Belum Dibayar ({summary.unpaidCount})
          </span>
          <div className="mt-2">
            <span className="text-lg sm:text-xl font-bold text-amber-400">
              {formatRupiah(summary.totalUnpaid)}
            </span>
          </div>
        </div>

        {/* Total Data */}
        <div className="bg-[#111726] border border-[#1E2637] p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Total Catatan
          </span>
          <div className="mt-2">
            <span className="text-lg sm:text-xl font-bold text-slate-200">
              {summary.totalCount} Data Mingguan
            </span>
          </div>
        </div>
      </div>

      {/* Rekap Per Karyawan Mini Cards */}
      {rekapPerKaryawan.length > 0 && (
        <div className="bg-[#111726] border border-[#1E2637] p-4 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Users className="h-4 w-4 text-[#00E5FF]" />
              Rekap Uang Rajin Per Karyawan ({formatBulanTahun(selectedMonth)})
            </h3>
            <span className="text-[11px] text-slate-400">{rekapPerKaryawan.length} Karyawan</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rekapPerKaryawan.map((item, idx) => (
              <div
                key={idx}
                onClick={() => setEmployeeFilter(employeeFilter === item.name ? 'ALL' : item.name)}
                className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                  employeeFilter === item.name
                    ? 'bg-cyan-950/40 border-[#00E5FF] shadow-xs'
                    : 'bg-[#0B0F19] border-[#1E2637] hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-slate-800 border border-[#1E2637] flex items-center justify-center text-[#00E5FF] font-bold text-xs">
                    {item.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="font-semibold text-white block text-xs">{item.name}</span>
                    <span className="text-[10px] text-slate-400">{item.count} Periode</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-bold text-[#00E5FF] text-xs block">
                    {formatRupiah(item.total)}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {item.paid > 0 ? `${formatRupiah(item.paid)} terbayar` : 'Belum dibayar'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter & Search Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#111726] border border-[#1E2637] p-3.5 rounded-xl">
        <div className="relative w-full sm:w-72">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama, periode, catatan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0B0F19] border border-[#1E2637] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00E5FF]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          {/* Filter Karyawan */}
          <select
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="bg-[#0B0F19] border border-[#1E2637] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#00E5FF] cursor-pointer"
          >
            <option value="ALL">Semua Karyawan</option>
            {rekapPerKaryawan.map((item, idx) => (
              <option key={idx} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>

          {/* Filter Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#0B0F19] border border-[#1E2637] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#00E5FF] cursor-pointer"
          >
            <option value="ALL">Semua Status</option>
            <option value="PAID">Sudah Dibayar</option>
            <option value="UNPAID">Belum Dibayar</option>
          </select>

          <span className="text-xs text-slate-400 font-medium ml-1">
            ({filteredRecords.length} data)
          </span>
        </div>
      </div>

      {/* Tabel Data Uang Rajin Mingguan */}
      <div className="bg-[#111726] border border-[#1E2637] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs" id="table-uang-rajin">
            <thead>
              <tr className="border-b border-[#1E2637] bg-[#0B0F19]/80 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                <th className="py-3.5 px-4">Karyawan</th>
                <th className="py-3.5 px-4">Minggu / Periode</th>
                <th className="py-3.5 px-4 text-right">Nominal Uang Rajin</th>
                <th className="py-3.5 px-4 text-center">Status Pembayaran</th>
                <th className="py-3.5 px-4">Catatan</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2637]/70">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <div className="max-w-xs mx-auto space-y-2">
                      <Award className="h-10 w-10 text-slate-600 mx-auto" />
                      <p className="font-medium text-slate-400">Belum ada data uang rajin mingguan</p>
                      <p className="text-[11px] text-slate-500">
                        Klik tombol <strong>+ Input Uang Rajin Baru</strong> di atas untuk menambahkan data manual.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                  const isPaid = rec.status === 'SUDAH DIBAYAR' || rec.status === 'PAID';
                  const amount = Number(rec.finalBonus || rec.bonusAmount || rec.baseBonus) || 0;

                  return (
                    <tr
                      key={rec.id}
                      className="hover:bg-[#161f33] transition-colors group text-slate-200"
                    >
                      {/* Nama Karyawan */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-slate-800 border border-[#1E2637] flex items-center justify-center text-[#00E5FF] font-bold text-xs">
                            {rec.employeeName ? rec.employeeName.charAt(0).toUpperCase() : 'K'}
                          </div>
                          <span className="font-semibold text-white">{rec.employeeName}</span>
                        </div>
                      </td>

                      {/* Minggu / Periode */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-300 font-medium">
                        {rec.label || formatBulanTahun(rec.month || '')}
                      </td>

                      {/* Nominal */}
                      <td className="py-3.5 px-4 text-right font-bold text-white whitespace-nowrap">
                        <span className="bg-[#0B0F19] px-2.5 py-1 rounded-md border border-[#1E2637] text-emerald-400">
                          {formatRupiah(amount)}
                        </span>
                      </td>

                      {/* Status Pembayaran */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleToggleStatus(rec)}
                          title="Klik untuk ubah status pembayaran"
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                            isPaid
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                              : 'bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25'
                          }`}
                        >
                          {isPaid ? (
                            <>
                              <Check className="h-3 w-3" />
                              SUDAH DIBAYAR
                            </>
                          ) : (
                            <>
                              <Clock className="h-3 w-3" />
                              BELUM DIBAYAR
                            </>
                          )}
                        </button>
                      </td>

                      {/* Catatan */}
                      <td className="py-3.5 px-4 text-slate-400 text-[11px] max-w-[180px] truncate">
                        {rec.reason || '-'}
                      </td>

                      {/* Aksi (EDIT & HAPUS) */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Tombol EDIT */}
                          <button
                            id={`btn-edit-uangrajin-${rec.id}`}
                            onClick={() => openEditModal(rec)}
                            title="Edit Data Uang Rajin"
                            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 border border-transparent hover:border-[#1E2637] transition cursor-pointer flex items-center gap-1 text-xs font-semibold px-2"
                          >
                            <Edit2 className="h-3.5 w-3.5 text-amber-400" />
                            <span>Edit</span>
                          </button>

                          {/* Tombol HAPUS */}
                          <button
                            id={`btn-delete-uangrajin-${rec.id}`}
                            onClick={() => setDeleteConfirmRecord(rec)}
                            title="Hapus Data Uang Rajin"
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

      {/* MODAL INPUT / EDIT UANG RAJIN */}
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
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingRecord ? 'Edit Uang Rajin' : 'Input Uang Rajin Mingguan'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Masukkan rincian nominal uang rajin manual
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
            <form onSubmit={handleSaveUangRajin} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Pilih Karyawan */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Nama Karyawan <span className="text-rose-400">*</span>
                </label>
                {employees.length > 0 ? (
                  <select
                    value={formEmployeeId}
                    onChange={(e) => handleSelectEmployee(e.target.value)}
                    className="w-full bg-[#0B0F19] border border-[#1E2637] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#00E5FF]"
                  >
                    <option value="">-- Pilih dari Karyawan Terdaftar --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.position || 'Staff'})
                      </option>
                    ))}
                  </select>
                ) : null}
                <div className="mt-2">
                  <input
                    type="text"
                    placeholder="Atau ketik nama karyawan manual"
                    value={formEmployeeName}
                    onChange={(e) => setFormEmployeeName(e.target.value)}
                    required
                    className="w-full bg-[#0B0F19] border border-[#1E2637] rounded-xl px-3.5 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00E5FF]"
                  />
                </div>
              </div>

              {/* Minggu / Periode & Bulan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Minggu / Periode <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Minggu 1 (01-07 Agt) atau 10-15 Agustus"
                    value={formPeriodLabel}
                    onChange={(e) => setFormPeriodLabel(e.target.value)}
                    required
                    className="w-full bg-[#0B0F19] border border-[#1E2637] rounded-xl px-3.5 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00E5FF]"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Bulan / Periode</label>
                  <input
                    type="month"
                    value={formMonth}
                    onChange={(e) => setFormMonth(e.target.value)}
                    className="w-full bg-[#0B0F19] border border-[#1E2637] rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-[#00E5FF]"
                  />
                </div>
              </div>

              {/* Nominal Uang Rajin */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Nominal Uang Rajin (Rp) <span className="text-rose-400">*</span>
                </label>
                <CurrencyInput
                  value={formAmount}
                  onChange={(val) => setFormAmount(Number(val) || 0)}
                  placeholder="0"
                  className="w-full bg-[#0B0F19] border border-[#1E2637] rounded-xl px-3.5 py-2 text-emerald-400 focus:outline-none focus:border-[#00E5FF] font-bold text-sm"
                />
              </div>

              {/* Status Pembayaran */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Status Pembayaran</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormStatus('BELUM DIBAYAR')}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      formStatus === 'BELUM DIBAYAR'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                        : 'bg-[#0B0F19] text-slate-400 border-[#1E2637] hover:text-white'
                    }`}
                  >
                    BELUM DIBAYAR
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormStatus('SUDAH DIBAYAR')}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      formStatus === 'SUDAH DIBAYAR'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                        : 'bg-[#0B0F19] text-slate-400 border-[#1E2637] hover:text-white'
                    }`}
                  >
                    SUDAH DIBAYAR
                  </button>
                </div>
              </div>

              {/* Catatan */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Catatan Tambahan</label>
                <textarea
                  rows={2}
                  placeholder="Catatan kedisiplinan, keterangan transfer, atau catatan lain (opsional)"
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
                  {isSubmitting ? 'Menyimpan...' : editingRecord ? 'Simpan Perubahan' : 'Tambah Uang Rajin'}
                </button>
              </div>
            </form>
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
                <h3 className="font-bold text-white text-base">Hapus Data Uang Rajin?</h3>
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
                <span className="text-slate-200">{deleteConfirmRecord.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Nominal:</span>
                <span className="font-bold text-emerald-400">
                  {formatRupiah(deleteConfirmRecord.finalBonus || deleteConfirmRecord.bonusAmount || deleteConfirmRecord.baseBonus || 0)}
                </span>
              </div>
            </div>

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
                onClick={handleDeleteUangRajin}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Menghapus...' : 'Ya, Hapus Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
