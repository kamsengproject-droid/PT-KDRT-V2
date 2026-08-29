import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowDownToLine,
  Plus,
  Search,
  Filter,
  Calendar,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  RefreshCw,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Home,
  X,
  Wallet,
  Building,
  CreditCard,
  Banknote,
  FileSpreadsheet,
  Info,
  Smartphone,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { WithdrawalRecord, MedsosWithdrawalStatus, Account } from '../types';
import {
  subscribeWithdrawals,
  tambahPenarikan,
  updatePenarikan,
  hapusPenarikan,
} from '../services/withdrawalService';
import { subscribeAccounts } from '../services/accountService';
import {
  formatRupiah,
  formatTanggal,
  bulanHariIni,
  formatBulanTahun,
  tanggalHariIni,
} from '../utils/formatters';
import { CurrencyInput } from '../components/CurrencyInput';

interface HistoryPenarikanPageProps {
  onBackToPortal?: () => void;
}

const DESTINATION_OPTIONS = [
  'BCA',
  'Mandiri',
  'Kas Tunai',
  'BRI',
  'BNI',
  'BCA PT KDRT',
  'Rekening Operasional',
];

export const HistoryPenarikanPage: React.FC<HistoryPenarikanPageProps> = ({
  onBackToPortal,
}) => {
  const { currentUser, userProfile, role } = useAuth();
  const isOwnerOrManager = role === 'OWNER' || role === 'MANAGER';

  // 1. Data States
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  // 2. Filter States
  const [selectedMonth, setSelectedMonth] = useState<string>(bulanHariIni());
  const [filterAccount, setFilterAccount] = useState<string>('ALL');
  const [filterDestination, setFilterDestination] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 3. Modal Form State (Tambah & Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Form Fields
  const [formData, setFormData] = useState<{
    date: string;
    accountId: string;
    accountName: string;
    amount: number | '';
    destinationAccount: string;
    status: MedsosWithdrawalStatus;
    referenceNumber: string;
    notes: string;
  }>({
    date: tanggalHariIni(),
    accountId: '',
    accountName: '',
    amount: '',
    destinationAccount: 'BCA',
    status: 'BERHASIL',
    referenceNumber: '',
    notes: '',
  });

  // 4. Modal Konfirmasi Hapus
  const [deleteTarget, setDeleteTarget] = useState<WithdrawalRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 5. Toast Feedback State
  const [toastMessage, setToastMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Helper format timestamp WIB
  const formatTimestampWIB = (ts: any): string => {
    if (!ts) return '-';
    try {
      let d: Date;
      if (ts.toDate && typeof ts.toDate === 'function') {
        d = ts.toDate();
      } else if (ts.seconds) {
        d = new Date(ts.seconds * 1000);
      } else if (typeof ts === 'string' || typeof ts === 'number') {
        d = new Date(ts);
      } else if (ts instanceof Date) {
        d = ts;
      } else {
        return '-';
      }
      if (isNaN(d.getTime())) return '-';
      return (
        d.toLocaleString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Jakarta',
        }) + ' WIB'
      );
    } catch {
      return '-';
    }
  };

  // Subscribe Real-time Penarikan & Accounts
  useEffect(() => {
    setLoading(true);
    const unsubWithdrawals = subscribeWithdrawals((data) => {
      setWithdrawals(data);
      setLoading(false);
    });

    const unsubAccounts = subscribeAccounts(undefined, (accs) => {
      setAccounts(accs);
    });

    return () => {
      unsubWithdrawals();
      unsubAccounts();
    };
  }, []);

  // Filter Navigation (Month shift)
  const handlePrevMonth = () => {
    if (!selectedMonth) {
      setSelectedMonth(bulanHariIni());
      return;
    }
    const [yStr, mStr] = selectedMonth.split('-');
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10) - 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    setSelectedMonth(`${y}-${String(m).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    if (!selectedMonth) {
      setSelectedMonth(bulanHariIni());
      return;
    }
    const [yStr, mStr] = selectedMonth.split('-');
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10) + 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    setSelectedMonth(`${y}-${String(m).padStart(2, '0')}`);
  };

  // Filtered List
  const filteredWithdrawals = useMemo(() => {
    return withdrawals.filter((item) => {
      // 1. Month Filter
      if (selectedMonth) {
        if (!item.date || !item.date.startsWith(selectedMonth)) {
          return false;
        }
      }

      // 2. Account Filter
      if (filterAccount !== 'ALL') {
        if (item.accountId !== filterAccount && item.accountName !== filterAccount) {
          return false;
        }
      }

      // 3. Destination Filter
      if (filterDestination !== 'ALL') {
        if (item.destinationAccount !== filterDestination) {
          return false;
        }
      }

      // 4. Status Filter
      if (filterStatus !== 'ALL') {
        if (item.status !== filterStatus) {
          return false;
        }
      }

      // 5. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const accName = (item.accountName || '').toLowerCase();
        const dateStr = (item.date || '').toLowerCase();
        const refStr = (item.referenceNumber || '').toLowerCase();
        const notesStr = (item.notes || '').toLowerCase();
        const destStr = (item.destinationAccount || '').toLowerCase();

        return (
          accName.includes(query) ||
          dateStr.includes(query) ||
          refStr.includes(query) ||
          notesStr.includes(query) ||
          destStr.includes(query)
        );
      }

      return true;
    });
  }, [
    withdrawals,
    selectedMonth,
    filterAccount,
    filterDestination,
    filterStatus,
    searchQuery,
  ]);

  // Calculations for Top Cards
  const stats = useMemo(() => {
    const currentMonthPrefix = bulanHariIni();

    // 1. Total Penarikan (Semua Penarikan Sukses all-time)
    let totalAllTime = 0;
    let totalMonthSelected = 0;
    let totalThisCurrentMonth = 0;
    let successfulCount = 0;

    // Find the latest successful withdrawal
    let latestWithdrawal: WithdrawalRecord | null = null;

    withdrawals.forEach((w) => {
      const amt = Number(w.amount) || 0;
      if (w.status === 'BERHASIL') {
        totalAllTime += amt;
        successfulCount++;

        if (w.date && w.date.startsWith(currentMonthPrefix)) {
          totalThisCurrentMonth += amt;
        }

        if (selectedMonth && w.date && w.date.startsWith(selectedMonth)) {
          totalMonthSelected += amt;
        }

        if (!latestWithdrawal) {
          latestWithdrawal = w;
        } else if ((w.date || '') > (latestWithdrawal.date || '')) {
          latestWithdrawal = w;
        }
      }
    });

    return {
      totalAllTime,
      totalMonth: selectedMonth ? totalMonthSelected : totalThisCurrentMonth,
      filteredCount: filteredWithdrawals.length,
      successfulCount,
      latestAmount: Number(latestWithdrawal?.amount) || 0,
      latestDate: latestWithdrawal?.date || '-',
      latestAccount: latestWithdrawal?.accountName || '-',
    };
  }, [withdrawals, selectedMonth, filteredWithdrawals]);

  // Open Form Create
  const handleOpenCreateModal = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({
      date: tanggalHariIni(),
      accountId: accounts[0]?.id || '',
      accountName: accounts[0]?.accountName || '',
      amount: '',
      destinationAccount: 'BCA',
      status: 'BERHASIL',
      referenceNumber: '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  // Open Form Edit
  const handleOpenEditModal = (item: WithdrawalRecord) => {
    setIsEditing(true);
    setEditingId(item.id || null);
    setFormData({
      date: item.date || tanggalHariIni(),
      accountId: item.accountId || '',
      accountName: item.accountName || '',
      amount: Number(item.amount) || 0,
      destinationAccount: item.destinationAccount || 'BCA',
      status: item.status || 'BERHASIL',
      referenceNumber: item.referenceNumber || '',
      notes: item.notes || '',
    });
    setIsModalOpen(true);
  };

  // Handle Select Account
  const handleAccountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const accId = e.target.value;
    const selectedAcc = accounts.find((a) => a.id === accId);
    setFormData((prev) => ({
      ...prev,
      accountId: accId,
      accountName: selectedAcc ? selectedAcc.accountName : accId,
    }));
  };

  // Save / Submit Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    const amountNum = Number(formData.amount) || 0;
    if (amountNum <= 0) {
      showToast('Nominal penarikan harus lebih besar dari 0.', 'error');
      return;
    }

    if (!formData.date) {
      showToast('Tanggal penarikan wajib diisi.', 'error');
      return;
    }

    if (!formData.accountName) {
      showToast('Pilih akun TikTok / Medsos terlebih dahulu.', 'error');
      return;
    }

    setFormSubmitting(true);
    try {
      if (isEditing && editingId) {
        await updatePenarikan(
          editingId,
          {
            date: formData.date,
            accountId: formData.accountId,
            accountName: formData.accountName,
            amount: amountNum,
            destinationAccount: formData.destinationAccount,
            status: formData.status,
            referenceNumber: formData.referenceNumber,
            notes: formData.notes,
          },
          currentUser?.uid || 'user',
          userProfile?.name || 'User'
        );
        showToast('Riwayat penarikan berhasil diperbarui.');
      } else {
        await tambahPenarikan(
          {
            date: formData.date,
            accountId: formData.accountId,
            accountName: formData.accountName,
            amount: amountNum,
            destinationAccount: formData.destinationAccount,
            status: formData.status,
            referenceNumber: formData.referenceNumber,
            notes: formData.notes,
          },
          currentUser?.uid || 'user',
          userProfile?.name || 'User'
        );
        showToast('Riwayat penarikan berhasil dicatat dan disinkronkan ke Buku Kas.');
      }

      setIsModalOpen(false);
    } catch (err: any) {
      showToast(
        'Gagal menyimpan data penarikan: ' + (err.message || 'Terjadi kesalahan server'),
        'error'
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deleteTarget || !deleteTarget.id) return;

    setIsDeleting(true);
    try {
      await hapusPenarikan(
        deleteTarget.id,
        currentUser?.uid || 'user',
        userProfile?.name || 'User'
      );
      showToast('Riwayat penarikan dan transaksi terkait berhasil dihapus.');
      setDeleteTarget(null);
    } catch (err: any) {
      showToast(
        'Gagal menghapus penarikan: ' + (err.message || 'Terjadi kesalahan server'),
        'error'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status: MedsosWithdrawalStatus) => {
    switch (status) {
      case 'BERHASIL':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3.5 w-3.5" />
            BERHASIL
          </span>
        );
      case 'DIPROSES':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-400 border border-amber-500/20">
            <Clock className="h-3.5 w-3.5" />
            DIPROSES
          </span>
        );
      case 'GAGAL':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-bold text-rose-400 border border-rose-500/20">
            <XCircle className="h-3.5 w-3.5" />
            GAGAL
          </span>
        );
      case 'DIBATALKAN':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-500/10 px-2.5 py-0.5 text-xs font-bold text-zinc-400 border border-zinc-500/20">
            <AlertCircle className="h-3.5 w-3.5" />
            DIBATALKAN
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-16 animate-fadeIn">
      {/* ============================================================
          TOAST NOTIFICATION
      ============================================================ */}
      {toastMessage && (
        <div
          id="toast-notification-penarikan"
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-2xl border backdrop-blur-md transition-all duration-300 ${
            toastMessage.type === 'success'
              ? 'border-emerald-500/40 bg-zinc-900/95 text-emerald-300'
              : 'border-rose-500/40 bg-zinc-900/95 text-rose-300'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
          )}
          <span className="text-xs font-semibold">{toastMessage.text}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-zinc-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ============================================================
          HEADER & ACTION BAR
      ============================================================ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            {onBackToPortal && (
              <button
                id="btn-back-to-portal-penarikan"
                type="button"
                onClick={onBackToPortal}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-white transition"
                title="Kembali ke Portal"
              >
                <Home className="h-4 w-4" />
              </button>
            )}
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <ArrowDownToLine className="h-5 w-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                History Penarikan
              </h1>
            </div>
          </div>
          <p className="mt-1 text-xs text-zinc-400 max-w-2xl">
            Pencatatan riwayat penarikan dana dari Akun TikTok/Medsos ke Rekening/Kas PT KDRT. Penarikan berstatus <span className="text-emerald-400 font-semibold">BERHASIL</span> otomatis tercatat sebagai Uang Masuk di Buku Kas & Bank.
          </p>
        </div>

        {/* Action Button: Input Penarikan */}
        <div className="flex items-center gap-2.5">
          <button
            id="btn-input-penarikan"
            type="button"
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-cyan-950/40 transition active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>+ Input Penarikan</span>
          </button>
        </div>
      </div>

      {/* ============================================================
          TOP 4 DASHBOARD CARDS (REKAP HISTORY PENARIKAN)
      ============================================================ */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* CARD 1: TOTAL PENARIKAN (ALL-TIME BERHASIL) */}
        <div
          id="card-total-penarikan"
          className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-zinc-900/95 via-zinc-900/70 to-emerald-950/30 p-5 shadow-lg flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Total Penarikan
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Banknote className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-black tracking-tight text-emerald-400">
              {formatRupiah(stats.totalAllTime)}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-zinc-400 border-t border-zinc-800/80 pt-2">
              <span className="text-zinc-300">Akumulasi All-Time</span>
              <span className="text-emerald-400/90 font-semibold text-[11px]">
                {stats.successfulCount} Transaksi Sukses
              </span>
            </div>
          </div>
        </div>

        {/* CARD 2: PENARIKAN BULAN INI / SELECTED MONTH */}
        <div
          id="card-penarikan-bulan-ini"
          className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-zinc-900/95 via-zinc-900/70 to-cyan-950/30 p-5 shadow-lg flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
              Penarikan Bulan Ini
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Calendar className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {formatRupiah(stats.totalMonth)}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-zinc-400 border-t border-zinc-800/80 pt-2">
              <span className="font-semibold text-zinc-300 truncate">
                {selectedMonth ? formatBulanTahun(selectedMonth) : 'Semua Periode'}
              </span>
              <span className="text-cyan-400 text-[11px] font-semibold">
                Buku Kas Sync
              </span>
            </div>
          </div>
        </div>

        {/* CARD 3: JUMLAH TRANSAKSI */}
        <div
          id="card-jumlah-transaksi-penarikan"
          className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-br from-zinc-900/95 via-zinc-900/70 to-purple-950/30 p-5 shadow-lg flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
              Jumlah Transaksi
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <ArrowDownToLine className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-baseline gap-2">
              <span>{stats.filteredCount}</span>
              <span className="text-sm font-semibold text-zinc-400">Penarikan</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-zinc-400 border-t border-zinc-800/80 pt-2">
              <span className="text-zinc-400">Sesuai Filter Aktif</span>
              <span className="text-purple-400 text-[11px] font-semibold">
                {withdrawals.length} Total Data
              </span>
            </div>
          </div>
        </div>

        {/* CARD 4: PENARIKAN TERAKHIR */}
        <div
          id="card-penarikan-terakhir"
          className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-zinc-900/95 via-zinc-900/70 to-amber-950/30 p-5 shadow-lg flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Penarikan Terakhir
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <CreditCard className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-black tracking-tight text-amber-300 truncate">
              {formatRupiah(stats.latestAmount)}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-zinc-400 border-t border-zinc-800/80 pt-2">
              <span className="text-zinc-400 truncate max-w-[130px]" title={stats.latestAccount}>
                {stats.latestAccount !== '-' ? stats.latestAccount : 'Belum ada data'}
              </span>
              <span className="text-zinc-400 text-[11px]">
                {stats.latestDate !== '-' ? formatTanggal(stats.latestDate) : '-'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          FILTER & CONTROLS BAR
      ============================================================ */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 backdrop-blur-md">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: Periode Bulan & Navigator */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-xl border border-zinc-700 bg-zinc-800 p-1">
              <button
                id="btn-penarikan-prev-month"
                type="button"
                onClick={handlePrevMonth}
                title="Bulan Sebelumnya"
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-white transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <input
                id="input-penarikan-month"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent px-2 text-xs font-bold text-white focus:outline-none cursor-pointer"
              />
              <button
                id="btn-penarikan-next-month"
                type="button"
                onClick={handleNextMonth}
                title="Bulan Berikutnya"
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-white transition"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <button
              id="btn-penarikan-all-periods"
              type="button"
              onClick={() => setSelectedMonth(selectedMonth ? '' : bulanHariIni())}
              className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                !selectedMonth
                  ? 'bg-cyan-600 text-white'
                  : 'border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {!selectedMonth ? 'Semua Periode Aktif' : 'Semua Periode'}
            </button>
          </div>

          {/* Right: Dropdown Filters & Search */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Akun */}
            <select
              id="select-filter-account-penarikan"
              value={filterAccount}
              onChange={(e) => setFilterAccount(e.target.value)}
              className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-200 focus:border-cyan-500 focus:outline-none"
            >
              <option value="ALL">Semua Akun Medsos</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id || acc.accountName}>
                  {acc.accountName}
                </option>
              ))}
            </select>

            {/* Filter Tujuan Dana */}
            <select
              id="select-filter-destination-penarikan"
              value={filterDestination}
              onChange={(e) => setFilterDestination(e.target.value)}
              className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-200 focus:border-cyan-500 focus:outline-none"
            >
              <option value="ALL">Semua Tujuan Dana</option>
              {DESTINATION_OPTIONS.map((dest) => (
                <option key={dest} value={dest}>
                  {dest}
                </option>
              ))}
            </select>

            {/* Filter Status */}
            <select
              id="select-filter-status-penarikan"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-200 focus:border-cyan-500 focus:outline-none"
            >
              <option value="ALL">Semua Status</option>
              <option value="BERHASIL">BERHASIL</option>
              <option value="DIPROSES">DIPROSES</option>
              <option value="GAGAL">GAGAL</option>
              <option value="DIBATALKAN">DIBATALKAN</option>
            </select>

            {/* Search Input */}
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                id="input-search-penarikan"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari akun, ref, catatan..."
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 pl-8 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-cyan-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          TABEL RIWAYAT PENARIKAN DANA
      ============================================================ */}
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/90 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">
              Daftar Riwayat Penarikan Dana
            </h3>
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-400">
              {filteredWithdrawals.length} Data
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center gap-3 text-zinc-400">
            <RefreshCw className="h-5 w-5 animate-spin text-cyan-400" />
            <span className="text-xs font-medium">Memuat data riwayat penarikan...</span>
          </div>
        ) : filteredWithdrawals.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800 text-zinc-500">
              <ArrowDownToLine className="h-6 w-6" />
            </div>
            <h4 className="mt-3 text-sm font-bold text-white">
              Tidak Ada Data Riwayat Penarikan
            </h4>
            <p className="mt-1 text-xs text-zinc-400 max-w-sm">
              Belum ada riwayat penarikan yang tercatat sesuai filter aktif. Klik tombol "+ Input Penarikan" untuk menambahkan data baru.
            </p>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="mt-4 flex items-center gap-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-xs font-bold text-white transition active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>Input Penarikan Sekarang</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-800 bg-zinc-950/60 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Akun TikTok / Medsos</th>
                  <th className="py-3 px-4">Nominal</th>
                  <th className="py-3 px-4">Tujuan Dana</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">No. Ref & Catatan</th>
                  <th className="py-3 px-4">Status Buku Kas</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-medium text-zinc-300">
                {filteredWithdrawals.map((item, idx) => (
                  <tr
                    key={item.id || idx}
                    className="hover:bg-zinc-800/40 transition-colors"
                  >
                    {/* 1. Tanggal */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-bold text-white">
                        {formatTanggal(item.date)}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {item.date}
                      </div>
                    </td>

                    {/* 2. Akun TikTok / Medsos */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300 border border-zinc-700">
                          <Smartphone className="h-3.5 w-3.5 text-purple-400" />
                        </div>
                        <div>
                          <div className="font-bold text-white">
                            {item.accountName || '-'}
                          </div>
                          {item.accountId && (
                            <div className="text-[10px] text-zinc-500">
                              ID: {item.accountId}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* 3. Nominal */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="text-sm font-black text-emerald-400">
                        {formatRupiah(Number(item.amount) || 0)}
                      </div>
                    </td>

                    {/* 4. Tujuan Dana */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Building className="h-3.5 w-3.5 text-cyan-400" />
                        <span className="font-semibold text-zinc-200">
                          {item.destinationAccount || 'BCA'}
                        </span>
                      </div>
                    </td>

                    {/* 5. Status */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {renderStatusBadge(item.status)}
                    </td>

                    {/* 6. Ref & Catatan */}
                    <td className="py-3 px-4">
                      <div className="max-w-xs">
                        {item.referenceNumber && (
                          <div className="text-[11px] font-mono text-cyan-300">
                            Ref: {item.referenceNumber}
                          </div>
                        )}
                        {item.notes ? (
                          <div className="text-[11px] text-zinc-400 truncate" title={item.notes}>
                            {item.notes}
                          </div>
                        ) : (
                          <span className="text-zinc-600">-</span>
                        )}
                      </div>
                    </td>

                    {/* 7. Status Buku Kas */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {item.status === 'BERHASIL' ? (
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Masuk Buku Kas</span>
                        </div>
                      ) : (
                        <div className="text-[11px] text-zinc-500">
                          Belum masuk kas
                        </div>
                      )}
                    </td>

                    {/* 8. Aksi */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          id={`btn-edit-penarikan-${item.id}`}
                          type="button"
                          onClick={() => handleOpenEditModal(item)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-cyan-500 hover:text-cyan-400 transition"
                          title="Edit Penarikan"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          id={`btn-hapus-penarikan-${item.id}`}
                          type="button"
                          onClick={() => setDeleteTarget(item)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-rose-500 hover:text-rose-400 transition"
                          title="Hapus Penarikan"
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

      {/* ============================================================
          MODAL: TAMBAH / EDIT PENARIKAN DANA
      ============================================================ */}
      {isModalOpen && (
        <div
          id="modal-penarikan-dana"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fadeIn"
        >
          <div className="relative w-full max-w-lg rounded-2xl border border-cyan-500/40 bg-zinc-900 p-6 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <ArrowDownToLine className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {isEditing ? 'Edit Riwayat Penarikan' : 'Input Riwayat Penarikan Baru'}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Pencatatan penarikan dana dari TikTok/Medsos ke Kas PT KDRT
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={formSubmitting}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitForm} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* 1. Tanggal Penarikan */}
                <div>
                  <label className="block font-bold text-zinc-200 mb-1">
                    Tanggal Penarikan <span className="text-cyan-400">*</span>
                  </label>
                  <input
                    id="input-form-penarikan-date"
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, date: e.target.value }))
                    }
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                {/* 2. Akun TikTok/Medsos */}
                <div>
                  <label className="block font-bold text-zinc-200 mb-1">
                    Akun TikTok / Medsos <span className="text-cyan-400">*</span>
                  </label>
                  <select
                    id="select-form-penarikan-account"
                    required
                    value={formData.accountId}
                    onChange={handleAccountChange}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="" disabled>
                      -- Pilih Akun --
                    </option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.accountName} ({acc.platform || 'TikTok'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3. Nominal Penarikan */}
              <div>
                <label className="block font-bold text-zinc-200 mb-1">
                  Nominal Penarikan (Rp) <span className="text-cyan-400">*</span>
                </label>
                <CurrencyInput
                  value={formData.amount}
                  onChange={(val) =>
                    setFormData((prev) => ({ ...prev, amount: val }))
                  }
                  placeholder="0"
                  required
                  className="w-full rounded-xl border border-emerald-500/50 bg-zinc-800 px-3.5 py-2.5 text-base font-bold text-white placeholder-zinc-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* 4. Tujuan Dana */}
                <div>
                  <label className="block font-bold text-zinc-200 mb-1">
                    Tujuan Dana <span className="text-cyan-400">*</span>
                  </label>
                  <select
                    id="select-form-penarikan-destination"
                    required
                    value={formData.destinationAccount}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        destinationAccount: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  >
                    {DESTINATION_OPTIONS.map((dest) => (
                      <option key={dest} value={dest}>
                        {dest}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 5. Status Penarikan */}
                <div>
                  <label className="block font-bold text-zinc-200 mb-1">
                    Status Penarikan <span className="text-cyan-400">*</span>
                  </label>
                  <select
                    id="select-form-penarikan-status"
                    required
                    value={formData.status}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        status: e.target.value as MedsosWithdrawalStatus,
                      }))
                    }
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="BERHASIL">BERHASIL (Masuk ke Buku Kas)</option>
                    <option value="DIPROSES">DIPROSES (Pending)</option>
                    <option value="GAGAL">GAGAL</option>
                    <option value="DIBATALKAN">DIBATALKAN</option>
                  </select>
                </div>
              </div>

              {/* 6. Nomor Referensi */}
              <div>
                <label className="block font-bold text-zinc-200 mb-1">
                  Nomor Referensi / ID Penarikan (Opsional)
                </label>
                <input
                  id="input-form-penarikan-ref"
                  type="text"
                  value={formData.referenceNumber}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      referenceNumber: e.target.value,
                    }))
                  }
                  placeholder="Contoh: WD-TT-20260828-001"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              {/* 7. Catatan */}
              <div>
                <label className="block font-bold text-zinc-200 mb-1">
                  Catatan (Opsional)
                </label>
                <textarea
                  id="textarea-form-penarikan-notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  rows={2}
                  placeholder="Catatan tambahan penarikan dana..."
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              {/* Info Sinkronisasi */}
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/30 p-3 text-xs text-cyan-200">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-zinc-300">
                    Jika status <span className="text-emerald-400 font-bold">BERHASIL</span>, sistem akan otomatis mencatat uang masuk di <span className="font-bold text-white">Buku Kas & Bank</span> pada akun tujuan ({formData.destinationAccount || 'BCA'}).
                  </p>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2.5 border-t border-zinc-800 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={formSubmitting}
                  className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex items-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-cyan-950/40 transition active:scale-95 disabled:opacity-60"
                >
                  {formSubmitting && <RefreshCw className="h-4 w-4 animate-spin" />}
                  <span>{formSubmitting ? 'Menyimpan...' : 'Simpan Penarikan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL: KONFIRMASI HAPUS PENARIKAN
      ============================================================ */}
      {deleteTarget && (
        <div
          id="modal-konfirmasi-hapus-penarikan"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fadeIn"
        >
          <div className="relative w-full max-w-md rounded-2xl border border-rose-500/40 bg-zinc-900 p-6 shadow-2xl">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Konfirmasi Hapus Penarikan
                </h3>
                <p className="text-xs text-zinc-400">
                  Tindakan ini tidak dapat dibatalkan
                </p>
              </div>
            </div>

            {/* Rincian Target */}
            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-400">Akun:</span>
                <span className="font-bold text-white">
                  {deleteTarget.accountName || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Tanggal:</span>
                <span className="font-bold text-white">
                  {formatTanggal(deleteTarget.date)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Nominal:</span>
                <span className="font-bold text-emerald-400">
                  {formatRupiah(Number(deleteTarget.amount) || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Tujuan Dana:</span>
                <span className="font-bold text-cyan-300">
                  {deleteTarget.destinationAccount || 'BCA'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Status:</span>
                <div>{renderStatusBadge(deleteTarget.status)}</div>
              </div>
            </div>

            {/* Pertanyaan */}
            <p className="mt-4 text-center text-xs font-semibold text-zinc-200">
              Yakin ingin menghapus riwayat penarikan ini?
            </p>
            <p className="mt-1 text-center text-[11px] text-zinc-400">
              Transaksi terkait di Buku Kas & Bank juga akan otomatis dibersihkan secara aman.
            </p>

            {/* Action Buttons */}
            <div className="mt-5 flex items-center justify-end gap-2.5 border-t border-zinc-800 pt-4">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-950/40 transition active:scale-95 disabled:opacity-60"
              >
                {isDeleting && <RefreshCw className="h-4 w-4 animate-spin" />}
                <span>{isDeleting ? 'Menghapus...' : 'Ya, Hapus Penarikan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
