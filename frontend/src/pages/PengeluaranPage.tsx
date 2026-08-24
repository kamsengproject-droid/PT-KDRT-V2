import React, { useState, useEffect, useMemo } from 'react';
import { CurrencyInput } from '../components/CurrencyInput';
import {
  FileSpreadsheet,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Home,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  hapusExpense,
  subscribeExpenses,
  tambahExpense,
  updateExpense,
} from '../services/expenseService';
import { Expense, ScopeType } from '../types';
import { formatBulanTahun, formatRupiah, formatTanggal, tanggalHariIni, bulanHariIni } from '../utils/formatters';

const CATEGORIES: string[] = [
  'Operasional',
  'Transportasi',
  'Makan/Minum',
  'Sampel',
  'Perlengkapan',
  'Inventory',
  'Jasa',
  'Lainnya',
];

export const PengeluaranPage: React.FC<{ onBackToPortal?: () => void }> = ({ onBackToPortal }) => {
  const { userProfile, role, loading, currentUser } = useAuth();
  const isOwner = role === 'OWNER';
  const isManager = role === 'MANAGER';

  // Permission Check: Deny Employee and Investor
  const hasAccess = isOwner || isManager;

  const [selectedMonth, setSelectedMonth] = useState<string>(bulanHariIni());
  const [selectedScope, setSelectedScope] = useState<ScopeType | 'ALL'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modal States
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<Expense | null>(null);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<boolean>(false);

  // Form Data
  const [formData, setFormData] = useState<{
    date: string;
    category: string;
    scope: ScopeType;
    amount: number | '';
    description: string;
    paymentMethod: string;
    receiptUrl: string;
    notes: string;
  }>({
    date: tanggalHariIni(),
    category: 'Operasional',
    scope: 'SHARING',
    amount: '',
    description: '',
    paymentMethod: 'TRANSFER',
    receiptUrl: '',
    notes: '',
  });

  const [saving, setSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !userProfile?.active || !hasAccess) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const unsub = subscribeExpenses(
      selectedScope === 'ALL' ? undefined : selectedScope,
      (list) => {
        setExpenses(list);
        setIsLoading(false);
      }
    );
    return unsub;
  }, [loading, currentUser?.uid, userProfile?.role, userProfile?.active, selectedScope, hasAccess]);

  const todayDate = tanggalHariIni();

  // Summary Metrics
  const expensesToday = useMemo(() => {
    return expenses.filter((e) => e.date === todayDate);
  }, [expenses, todayDate]);

  const sumTodaySharing = useMemo(() => {
    return expensesToday
      .filter((e) => e.scope === 'SHARING')
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [expensesToday]);

  const sumTodayPribadi = useMemo(() => {
    return expensesToday
      .filter((e) => e.scope === 'PRIBADI')
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [expensesToday]);

  const expensesThisMonth = useMemo(() => {
    return expenses.filter((e) => e.date && e.date.startsWith(selectedMonth));
  }, [expenses, selectedMonth]);

  const sumMonthSharing = useMemo(() => {
    return expensesThisMonth
      .filter((e) => e.scope === 'SHARING')
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [expensesThisMonth]);

  const sumMonthPribadi = useMemo(() => {
    return expensesThisMonth
      .filter((e) => e.scope === 'PRIBADI')
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [expensesThisMonth]);

  // Filtered Expenses for the List Table
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      // Month filter
      if (selectedMonth && !e.date.startsWith(selectedMonth)) {
        return false;
      }
      // Category filter
      if (selectedCategory !== 'ALL' && e.category !== selectedCategory) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDesc = (e.description || '').toLowerCase().includes(q);
        const matchCat = (e.category || '').toLowerCase().includes(q);
        const matchMethod = (e.paymentMethod || '').toLowerCase().includes(q);
        const matchNotes = (e.notes || '').toLowerCase().includes(q);
        if (!matchDesc && !matchCat && !matchMethod && !matchNotes) return false;
      }
      return true;
    });
  }, [expenses, selectedMonth, selectedCategory, searchQuery]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormError(null);
    setSaveSuccessNotice(false);
    setFormData({
      date: tanggalHariIni(),
      category: 'Operasional',
      scope: 'SHARING',
      amount: '',
      description: '',
      paymentMethod: 'TRANSFER',
      receiptUrl: '',
      notes: '',
    });
    setShowModal(true);
  };

  const handleOpenEdit = (item: Expense) => {
    setEditingItem(item);
    setFormError(null);
    setSaveSuccessNotice(false);
    setFormData({
      date: item.date || tanggalHariIni(),
      category: item.category || 'Operasional',
      scope: item.scope === 'PRIBADI' ? 'PRIBADI' : 'SHARING',
      amount: item.amount || '',
      description: item.description || '',
      paymentMethod: (item.paymentMethod as string) || 'TRANSFER',
      receiptUrl: item.receiptUrl || '',
      notes: item.notes || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const nominal = Number(formData.amount);
    if (!nominal || nominal <= 0) {
      setFormError('Nominal pengeluaran harus lebih besar dari Rp 0.');
      return;
    }

    if (!formData.description.trim()) {
      setFormError('Deskripsi pengeluaran wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      const uid = userProfile?.uid || currentUser?.uid || 'user';
      const uname = userProfile?.name || 'User';

      if (editingItem?.id) {
        await updateExpense(
          editingItem.id,
          {
            date: formData.date,
            category: formData.category,
            scope: formData.scope,
            amount: nominal,
            description: formData.description.trim(),
            paymentMethod: formData.paymentMethod,
            receiptUrl: formData.receiptUrl.trim() || undefined,
            notes: formData.notes.trim() || undefined,
          },
          uid,
          uname
        );
        setShowModal(false);
      } else {
        await tambahExpense(
          {
            date: formData.date,
            category: formData.category,
            scope: formData.scope,
            amount: nominal,
            description: formData.description.trim(),
            paymentMethod: formData.paymentMethod,
            receiptUrl: formData.receiptUrl.trim() || undefined,
            notes: formData.notes.trim() || undefined,
            sourceType: 'DAILY_EXPENSE',
          },
          uid,
          uname
        );
        setSaveSuccessNotice(true);
      }
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan pengeluaran.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetForNextInput = () => {
    setSaveSuccessNotice(false);
    setFormData({
      date: tanggalHariIni(),
      category: 'Operasional',
      scope: formData.scope, // keep previous scope
      amount: '',
      description: '',
      paymentMethod: formData.paymentMethod, // keep previous method
      receiptUrl: '',
      notes: '',
    });
  };

  const handleDelete = async (id: string, desc: string) => {
    if (!isOwner) {
      alert('Hanya Owner yang berhak menghapus catatan pengeluaran.');
      return;
    }
    if (window.confirm(`Hapus catatan pengeluaran "${desc}"? Transaksi terkait akan otomatis disinkronkan.`)) {
      try {
        await hapusExpense(
          id,
          desc,
          userProfile?.uid || currentUser?.uid || 'user',
          userProfile?.name || 'Owner',
          'DAILY_EXPENSE'
        );
      } catch (err: any) {
        alert('Gagal menghapus pengeluaran: ' + err.message);
      }
    }
  };

  if (!hasAccess) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-800 space-y-3">
        <AlertTriangle className="h-10 w-10 text-rose-600 mx-auto" />
        <h2 className="text-lg font-black">Akses Dibatasi</h2>
        <p className="text-xs">
          Modul Pengeluaran & Belanja Harian hanya dapat diakses oleh Owner dan Manager PT. KDRT.
        </p>
        {onBackToPortal && (
          <button
            onClick={onBackToPortal}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800"
          >
            Kembali ke Portal
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200 pb-3">
        <nav className="flex items-center space-x-1.5 text-xs text-zinc-500 font-medium">
          <button
            onClick={onBackToPortal}
            className="flex items-center gap-1 hover:text-emerald-600 font-bold transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
            <span>KANTOR PT.KDRT</span>
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
          <span className="font-bold text-zinc-900">PENGELUARAN HARIAN</span>
        </nav>

        {onBackToPortal && (
          <button
            onClick={onBackToPortal}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 shadow-2xs hover:bg-zinc-50 transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
            <span>Kembali ke Portal</span>
          </button>
        )}
      </div>

      {/* Header & Primary Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 flex items-center gap-2.5">
            <FileSpreadsheet className="h-7 w-7 text-emerald-600" />
            Pengeluaran Harian
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">
            Pencatatan biaya operasional, uang belanja harian, dan pengeluaran kantor PT. KDRT.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="btn-tambah-pengeluaran"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black text-white shadow-md hover:bg-emerald-500 transition-all cursor-pointer active:scale-95"
          >
            <Plus className="h-4 w-4 stroke-[3]" />
            TAMBAH PENGELUARAN
          </button>
        </div>
      </div>

      {/* SUMMARY CARDS (BELANJA HARI INI & BELANJA BULAN INI, SEPARATED BY SHARING & PRIBADI) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* TOTAL BELANJA HARI INI */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-emerald-600" />
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-800">
                TOTAL BELANJA HARI INI
              </h3>
            </div>
            <span className="text-[11px] font-bold text-zinc-500">
              {formatTanggal(todayDate)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-emerald-50/60 p-3.5 border border-emerald-200">
              <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider block">
                BELANJA SHARING
              </span>
              <div className="text-lg sm:text-xl font-black text-emerald-700 mt-1">
                {formatRupiah(sumTodaySharing)}
              </div>
              <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block">
                Investor & Kantor
              </span>
            </div>

            <div className="rounded-2xl bg-blue-50/60 p-3.5 border border-blue-200">
              <span className="text-[10px] font-black uppercase text-blue-800 tracking-wider block">
                BELANJA PRIBADI
              </span>
              <div className="text-lg sm:text-xl font-black text-blue-700 mt-1">
                {formatRupiah(sumTodayPribadi)}
              </div>
              <span className="text-[10px] text-blue-600 font-semibold mt-0.5 block">
                Owner PT.KDRT
              </span>
            </div>
          </div>
        </div>

        {/* TOTAL BELANJA BULAN INI */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-800">
                TOTAL BELANJA BULAN INI
              </h3>
            </div>
            <span className="text-[11px] font-bold text-zinc-500">
              {formatBulanTahun(selectedMonth)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-emerald-50/60 p-3.5 border border-emerald-200">
              <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider block">
                BELANJA SHARING
              </span>
              <div className="text-lg sm:text-xl font-black text-emerald-700 mt-1">
                {formatRupiah(sumMonthSharing)}
              </div>
              <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block">
                Investor & Kantor
              </span>
            </div>

            <div className="rounded-2xl bg-blue-50/60 p-3.5 border border-blue-200">
              <span className="text-[10px] font-black uppercase text-blue-800 tracking-wider block">
                BELANJA PRIBADI
              </span>
              <div className="text-lg sm:text-xl font-black text-blue-700 mt-1">
                {formatRupiah(sumMonthPribadi)}
              </div>
              <span className="text-[10px] text-blue-600 font-semibold mt-0.5 block">
                Owner PT.KDRT
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH CONTROLS */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Scope Buttons */}
          <div className="flex items-center gap-1.5 bg-zinc-100 p-1 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => setSelectedScope('ALL')}
              className={`flex-1 sm:flex-none rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                selectedScope === 'ALL'
                  ? 'bg-zinc-900 text-white shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Semua Scope
            </button>
            <button
              onClick={() => setSelectedScope('SHARING')}
              className={`flex-1 sm:flex-none rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                selectedScope === 'SHARING'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-zinc-600 hover:text-emerald-700'
              }`}
            >
              Sharing
            </button>
            <button
              onClick={() => setSelectedScope('PRIBADI')}
              className={`flex-1 sm:flex-none rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                selectedScope === 'PRIBADI'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-zinc-600 hover:text-blue-700'
              }`}
            >
              Pribadi
            </button>
          </div>

          {/* Month, Category & Search */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Month Picker */}
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-xl border border-zinc-300 px-3 py-1.5 text-xs font-bold text-zinc-800 bg-white"
            />

            {/* Category Select */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-xl border border-zinc-300 px-3 py-1.5 text-xs font-bold text-zinc-800 bg-white"
            >
              <option value="ALL">Semua Kategori</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Search Box */}
            <div className="relative flex-1 sm:w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Cari deskripsi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 pl-8 pr-3 py-1.5 text-xs text-zinc-900 focus:outline-emerald-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* LIST PENGELUARAN TABLE */}
      <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 text-zinc-500 uppercase tracking-wider text-[10px] font-black border-b border-zinc-100">
              <tr>
                <th className="px-6 py-3.5">Tanggal</th>
                <th className="px-4 py-3.5">Kategori</th>
                <th className="px-4 py-3.5">Deskripsi / Keterangan</th>
                <th className="px-4 py-3.5">Nominal (Rp)</th>
                <th className="px-4 py-3.5">Scope</th>
                <th className="px-4 py-3.5">Metode</th>
                <th className="px-4 py-3.5 text-center">Bukti</th>
                <th className="px-6 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-zinc-400 font-medium">
                    <RefreshCw className="h-6 w-6 text-emerald-600 animate-spin mx-auto mb-2" />
                    Memuat data pengeluaran...
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-zinc-400 font-medium">
                    Belum ada catatan pengeluaran di periode {formatBulanTahun(selectedMonth)}.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((item) => {
                  const isItemSharing = item.scope === 'SHARING';
                  return (
                    <tr key={item.id} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="px-6 py-3.5 font-black text-zinc-900 whitespace-nowrap">
                        {formatTanggal(item.date)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="rounded-lg bg-zinc-100 px-2.5 py-1 text-[10px] font-extrabold text-zinc-800 border border-zinc-200">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-zinc-800 max-w-xs">
                        <div className="font-bold text-zinc-900">{item.description}</div>
                        {item.notes && (
                          <div className="text-[11px] text-zinc-400 mt-0.5 italic">{item.notes}</div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-black text-rose-600 whitespace-nowrap text-sm">
                        {formatRupiah(item.amount)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[9px] font-black border ${
                            isItemSharing
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : 'bg-blue-100 text-blue-800 border-blue-200'
                          }`}
                        >
                          {isItemSharing ? 'SHARING' : 'PRIBADI'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="text-[11px] font-bold text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded-md">
                          {item.paymentMethod || 'TRANSFER'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        {item.receiptUrl ? (
                          <a
                            href={item.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Bukti
                          </a>
                        ) : (
                          <span className="text-zinc-300 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-right whitespace-nowrap space-x-1">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
                          title="Edit Pengeluaran"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        {isOwner && (
                          <button
                            onClick={() => handleDelete(item.id!, item.description)}
                            className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                            title="Hapus Pengeluaran"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: TAMBAH / EDIT PENGELUARAN */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-zinc-200 my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
              <div>
                <h3 className="text-base sm:text-lg font-black text-zinc-900 flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                  {editingItem ? 'Edit Catatan Pengeluaran' : 'Tambah Pengeluaran / Uang Belanja'}
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Catatan pengeluaran harian akan otomatis tersinkronisasi ke Buku Kas Transaksi.
                </p>
              </div>
            </div>

            {/* Success Notice with "INPUT LAGI" button */}
            {saveSuccessNotice ? (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-md">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-emerald-950">
                    Pengeluaran Berhasil Dicatat!
                  </h4>
                  <p className="text-xs text-emerald-800 mt-1">
                    Data belanja telah tersimpan di sistem operasional dan transaksi master.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 shadow-2xs"
                  >
                    Tutup & Kembali ke List
                  </button>
                  <button
                    type="button"
                    onClick={handleResetForNextInput}
                    className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-black text-white hover:bg-emerald-500 shadow-md inline-flex items-center gap-1.5"
                  >
                    <Plus className="h-4 w-4 stroke-[3]" />
                    + INPUT LAGI
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
                {formError && (
                  <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Tanggal & Scope */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-zinc-700 mb-1">
                      Tanggal <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full rounded-xl border border-zinc-300 p-2.5 font-bold text-zinc-900 focus:outline-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-zinc-700 mb-1">
                      Scope Kepemilikan <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.scope}
                      onChange={(e) => setFormData({ ...formData, scope: e.target.value as ScopeType })}
                      className="w-full rounded-xl border border-zinc-300 p-2.5 font-black text-zinc-900 focus:outline-emerald-500"
                    >
                      <option value="SHARING">SHARING (Investor & Kantor)</option>
                      <option value="PRIBADI">PRIVATE (Owner PT.KDRT)</option>
                    </select>
                  </div>
                </div>

                {/* Kategori & Metode Pembayaran */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-zinc-700 mb-1">
                      Kategori <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full rounded-xl border border-zinc-300 p-2.5 font-bold text-zinc-900 focus:outline-emerald-500"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-zinc-700 mb-1">
                      Metode Pembayaran <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.paymentMethod}
                      onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                      className="w-full rounded-xl border border-zinc-300 p-2.5 font-bold text-zinc-900 focus:outline-emerald-500"
                    >
                      <option value="TRANSFER">TRANSFER BANK</option>
                      <option value="CASH">CASH / TUNAI</option>
                      <option value="QRIS">QRIS / E-WALLET</option>
                    </select>
                  </div>
                </div>

                {/* Deskripsi */}
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">
                    Deskripsi / Keterangan Belanja <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Beli makan siang karyawan, bensin kurir, ATK"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 font-medium text-zinc-900 focus:outline-emerald-500"
                  />
                </div>

                {/* Nominal Input (CurrencyInput) */}
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">
                    Nominal Pengeluaran <span className="text-rose-500">*</span>
                  </label>
                  <CurrencyInput
                    value={formData.amount}
                    onChange={(val) => setFormData({ ...formData, amount: val })}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 font-black text-rose-600 text-base focus:outline-emerald-500"
                    placeholder="Rp 0"
                    required
                  />
                </div>

                {/* Bukti (URL / Tautan Nota) */}
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">
                    Bukti Nota / Tautan Gambar (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={formData.receiptUrl}
                    onChange={(e) => setFormData({ ...formData, receiptUrl: e.target.value })}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 font-medium text-zinc-900 focus:outline-emerald-500"
                  />
                </div>

                {/* Catatan Tambahan */}
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">
                    Catatan Tambahan (Opsional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Catatan detail lain jika diperlukan..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 font-medium text-zinc-900 focus:outline-emerald-500"
                  />
                </div>

                {/* Actions Footer */}
                <div className="flex justify-end items-center gap-2.5 pt-4 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="rounded-xl border border-zinc-200 px-4 py-2.5 font-bold text-zinc-600 hover:bg-zinc-100 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-emerald-600 px-6 py-2.5 font-black text-white hover:bg-emerald-500 shadow-md transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? 'Menyimpan...' : editingItem ? 'Simpan Perubahan' : 'SIMPAN PENGELUARAN'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
