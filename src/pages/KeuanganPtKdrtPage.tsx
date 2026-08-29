import React, { useState, useEffect, useMemo } from 'react';
import {
  Landmark,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Scale,
  PlusCircle,
  MinusCircle,
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  Edit2,
  Edit,
  Trash2,
  X,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  Building,
  CreditCard,
  Receipt,
  RotateCcw,
  Sparkles,
  ArrowLeft,
  RefreshCw,
  Lock,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  PtKdrtTransaction,
  PtKdrtTransactionType,
  PT_KDRT_INCOME_CATEGORIES,
  PT_KDRT_EXPENSE_CATEGORIES,
  PT_KDRT_DEFAULT_ACCOUNTS,
  SaldoRealPtKdrt,
} from '../types';
import {
  subscribePtKdrtTransactions,
  createPtKdrtTransaction,
  updatePtKdrtTransaction,
  deletePtKdrtTransaction,
} from '../services/keuanganPtKdrtService';
import {
  subscribeSaldoRealPtKdrt,
  updateSaldoRealPtKdrt,
} from '../services/settingsService';
import {
  formatRupiah,
  formatTanggal,
  formatBulanTahun,
  tanggalHariIni,
  bulanHariIni,
} from '../utils/formatters';
import { CurrencyInput } from '../components/CurrencyInput';

interface KeuanganPtKdrtPageProps {
  onBackToPortal?: () => void;
}

export const KeuanganPtKdrtPage: React.FC<KeuanganPtKdrtPageProps> = ({ onBackToPortal }) => {
  const { currentUser, userProfile, role } = useAuth();
  const isManagerOrOwner = role === 'OWNER' || role === 'MANAGER';

  // Master Transactions State
  const [transactions, setTransactions] = useState<PtKdrtTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Saldo Real PT KDRT (Tersinkronisasi dengan Buku Kas & Bank Menu No 4)
  const [saldoRealData, setSaldoRealData] = useState<SaldoRealPtKdrt | null>(null);
  const [isEditSaldoRealModalOpen, setIsEditSaldoRealModalOpen] = useState<boolean>(false);
  const [saldoRealAmountInput, setSaldoRealAmountInput] = useState<number | ''>('');
  const [saldoRealNotesInput, setSaldoRealNotesInput] = useState<string>('');
  const [saldoRealSaving, setSaldoRealSaving] = useState<boolean>(false);

  // Filters State
  const [selectedMonth, setSelectedMonth] = useState<string>(bulanHariIni());
  const [isAllTime, setIsAllTime] = useState<boolean>(false);
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [filterAccount, setFilterAccount] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal State
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [editingTransaction, setEditingTransaction] = useState<PtKdrtTransaction | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<PtKdrtTransaction | null>(null);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form Input State
  const [formType, setFormType] = useState<PtKdrtTransactionType>('INCOME');
  const [formDate, setFormDate] = useState<string>(tanggalHariIni());
  const [formAmount, setFormAmount] = useState<number | ''>('');
  const [formCategory, setFormCategory] = useState<string>('Omset Penjualan / Afiliasi');
  const [formCustomCategory, setFormCustomCategory] = useState<string>('');
  const [formAccount, setFormAccount] = useState<string>('BCA PT KDRT');
  const [formCustomAccount, setFormCustomAccount] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formReferenceNumber, setFormReferenceNumber] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');

  // Show Toast Helper
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
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

  // 1. Subscribe to real-time transactions
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribePtKdrtTransactions(
      (data) => {
        setTransactions(data);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching PT KDRT transactions:', error);
        setLoading(false);
        showToast('Gagal memuat data transaksi rekening PT KDRT', 'error');
      }
    );

    return () => unsubscribe();
  }, []);

  // 1B. Subscribe Saldo Real PT KDRT (Tersinkronisasi dengan Buku Kas & Bank)
  useEffect(() => {
    const unsub = subscribeSaldoRealPtKdrt((data) => {
      setSaldoRealData(data);
    });
    return () => unsub();
  }, []);

  // 2. Extract unique accounts and categories from database
  const availableAccounts = useMemo(() => {
    const set = new Set<string>(PT_KDRT_DEFAULT_ACCOUNTS);
    transactions.forEach((t) => {
      if (t.accountName) set.add(t.accountName);
    });
    return Array.from(set);
  }, [transactions]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    PT_KDRT_INCOME_CATEGORIES.forEach((c) => set.add(c));
    PT_KDRT_EXPENSE_CATEGORIES.forEach((c) => set.add(c));
    transactions.forEach((t) => {
      if (t.category) set.add(t.category);
    });
    return Array.from(set);
  }, [transactions]);

  // 3. Month Navigation
  const handlePrevMonth = () => {
    setIsAllTime(false);
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 2, 1);
    const newYear = date.getFullYear();
    const newMonth = String(date.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${newYear}-${newMonth}`);
  };

  const handleNextMonth = () => {
    setIsAllTime(false);
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month, 1);
    const newYear = date.getFullYear();
    const newMonth = String(date.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${newYear}-${newMonth}`);
  };

  // 4. Calculate All-Time Balances & Account Breakdowns
  const allTimeStats = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    const accountBalances: Record<string, { income: number; expense: number; balance: number }> = {};

    // Sort chronologically ascending to compute balances accurately
    const sortedChronological = [...transactions].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return 0;
    });

    sortedChronological.forEach((t) => {
      const amt = Number(t.amount) || 0;
      const acc = t.accountName || 'BCA PT KDRT';

      if (!accountBalances[acc]) {
        accountBalances[acc] = { income: 0, expense: 0, balance: 0 };
      }

      if (t.type === 'INCOME') {
        totalIncome += amt;
        accountBalances[acc].income += amt;
        accountBalances[acc].balance += amt;
      } else {
        totalExpense += amt;
        accountBalances[acc].expense += amt;
        accountBalances[acc].balance -= amt;
      }
    });

    const totalSaldo = totalIncome - totalExpense;

    return {
      totalIncome,
      totalExpense,
      totalSaldo,
      accountBalances,
    };
  }, [transactions]);

  // 5. Filter Transactions for Table and Period Stats
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // Month Filter
      if (!isAllTime && selectedMonth) {
        if (!t.date.startsWith(selectedMonth)) return false;
      }

      // Type Filter
      if (filterType !== 'ALL' && t.type !== filterType) {
        return false;
      }

      // Account Filter
      if (filterAccount !== 'ALL' && t.accountName !== filterAccount) {
        return false;
      }

      // Category Filter
      if (filterCategory !== 'ALL' && t.category !== filterCategory) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const descMatch = t.description?.toLowerCase().includes(q);
        const catMatch = t.category?.toLowerCase().includes(q);
        const refMatch = t.referenceNumber?.toLowerCase().includes(q);
        const notesMatch = t.notes?.toLowerCase().includes(q);
        const accMatch = t.accountName?.toLowerCase().includes(q);
        if (!descMatch && !catMatch && !refMatch && !notesMatch && !accMatch) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, isAllTime, selectedMonth, filterType, filterAccount, filterCategory, searchQuery]);

  // 6. Period Summary (Filtered by Selected Month or Current Filter View)
  const periodStats = useMemo(() => {
    const list = transactions.filter((t) => {
      if (isAllTime) return true;
      return t.date.startsWith(selectedMonth);
    });

    let periodIncome = 0;
    let periodExpense = 0;

    list.forEach((t) => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'INCOME') {
        periodIncome += amt;
      } else {
        periodExpense += amt;
      }
    });

    const periodNet = periodIncome - periodExpense;

    return {
      income: periodIncome,
      expense: periodExpense,
      net: periodNet,
      count: list.length,
    };
  }, [transactions, isAllTime, selectedMonth]);

  // 7. Calculate Running Balance for each displayed transaction in chronological order
  const transactionsWithRunningBalance = useMemo(() => {
    // We sort all transactions chronologically to get running balance from inception
    const allSorted = [...transactions].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
    });

    let running = 0;
    const balanceMap = new Map<string, number>();

    allSorted.forEach((t) => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'INCOME') {
        running += amt;
      } else {
        running -= amt;
      }
      if (t.id) {
        balanceMap.set(t.id, running);
      }
    });

    // Attach calculated balance to the filtered list
    return filteredTransactions.map((t) => ({
      ...t,
      runningBalance: t.id ? (balanceMap.get(t.id) ?? 0) : 0,
    }));
  }, [transactions, filteredTransactions]);

  // 8. Open Add Modal
  const handleOpenAddModal = (type: PtKdrtTransactionType) => {
    setEditingTransaction(null);
    setFormType(type);
    setFormDate(tanggalHariIni());
    setFormAmount('');
    setFormCategory(
      type === 'INCOME'
        ? PT_KDRT_INCOME_CATEGORIES[0]
        : PT_KDRT_EXPENSE_CATEGORIES[0]
    );
    setFormCustomCategory('');
    setFormAccount('BCA PT KDRT');
    setFormCustomAccount('');
    setFormDescription('');
    setFormReferenceNumber('');
    setFormNotes('');
    setIsFormModalOpen(true);
  };

  // 9. Open Edit Modal
  const handleOpenEditModal = (t: PtKdrtTransaction) => {
    setEditingTransaction(t);
    setFormType(t.type);
    setFormDate(t.date);
    setFormAmount(t.amount);

    const isStdCat =
      t.type === 'INCOME'
        ? (PT_KDRT_INCOME_CATEGORIES as readonly string[]).includes(t.category)
        : (PT_KDRT_EXPENSE_CATEGORIES as readonly string[]).includes(t.category);

    if (isStdCat) {
      setFormCategory(t.category);
      setFormCustomCategory('');
    } else {
      setFormCategory('CUSTOM');
      setFormCustomCategory(t.category);
    }

    const isStdAcc = (PT_KDRT_DEFAULT_ACCOUNTS as readonly string[]).includes(t.accountName);
    if (isStdAcc) {
      setFormAccount(t.accountName);
      setFormCustomAccount('');
    } else {
      setFormAccount('CUSTOM');
      setFormCustomAccount(t.accountName);
    }

    setFormDescription(t.description || '');
    setFormReferenceNumber(t.referenceNumber || '');
    setFormNotes(t.notes || '');
    setIsFormModalOpen(true);
  };

  // 10. Handle Save / Submit Transaction
  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();

    const amt = Number(formAmount);
    if (!amt || amt <= 0) {
      showToast('Harap masukkan nominal transaksi yang valid (lebih dari 0).', 'error');
      return;
    }

    if (!formDescription.trim()) {
      showToast('Keterangan transaksi wajib diisi.', 'error');
      return;
    }

    const finalCategory =
      formCategory === 'CUSTOM'
        ? formCustomCategory.trim() || 'Lain-lain'
        : formCategory;

    const finalAccount =
      formAccount === 'CUSTOM'
        ? formCustomAccount.trim() || 'BCA PT KDRT'
        : formAccount;

    setSubmitting(true);
    const uid = currentUser?.uid || 'system';
    const uname = userProfile?.name || 'Admin';

    try {
      if (editingTransaction && editingTransaction.id) {
        // Update
        await updatePtKdrtTransaction(
          editingTransaction.id,
          {
            type: formType,
            date: formDate,
            amount: amt,
            category: finalCategory,
            accountName: finalAccount,
            description: formDescription,
            referenceNumber: formReferenceNumber,
            notes: formNotes,
          },
          uid,
          uname
        );
        showToast('Transaksi rekening PT KDRT berhasil diperbarui.');
      } else {
        // Create New
        await createPtKdrtTransaction(
          {
            type: formType,
            date: formDate,
            amount: amt,
            category: finalCategory,
            accountName: finalAccount,
            description: formDescription,
            referenceNumber: formReferenceNumber,
            notes: formNotes,
          },
          uid,
          uname
        );
        const txMonth = formDate.substring(0, 7);
        if (!isAllTime && selectedMonth !== txMonth) {
          setSelectedMonth(txMonth);
        }
        showToast(
          formType === 'INCOME'
            ? 'Uang Masuk berhasil dicatat ke rekening PT KDRT.'
            : 'Uang Keluar berhasil dicatat dari rekening PT KDRT.'
        );
      }

      setIsFormModalOpen(false);
    } catch (err: any) {
      console.error('Error saving transaction:', err);
      showToast('Gagal menyimpan transaksi: ' + (err.message || 'Error server'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // 11. Handle Delete Transaction
  const handleDeleteConfirm = async () => {
    if (!deletingTransaction || !deletingTransaction.id) return;

    setSubmitting(true);
    const uid = currentUser?.uid || 'system';
    const uname = userProfile?.name || 'Admin';

    try {
      await deletePtKdrtTransaction(
        deletingTransaction.id,
        {
          description: deletingTransaction.description,
          amount: deletingTransaction.amount,
          type: deletingTransaction.type,
        },
        uid,
        uname
      );
      showToast('Transaksi berhasil dihapus dari Keuangan PT KDRT.');
      setIsDeleteModalOpen(false);
      setDeletingTransaction(null);
    } catch (err: any) {
      console.error('Error deleting transaction:', err);
      showToast('Gagal menghapus transaksi: ' + (err.message || 'Error server'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // 12. Saldo Real PT KDRT Handlers (Sync with Buku Kas & Bank)
  const handleOpenEditSaldoRealModal = () => {
    setSaldoRealAmountInput(saldoRealData?.amount ?? allTimeStats.totalSaldo ?? '');
    setSaldoRealNotesInput(saldoRealData?.notes || '');
    setIsEditSaldoRealModalOpen(true);
  };

  const handleSaveSaldoReal = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalAmount = Number(saldoRealAmountInput) || 0;
    setSaldoRealSaving(true);
    const uid = currentUser?.uid || 'system';
    const uname = userProfile?.name || currentUser?.email || 'Admin';

    try {
      await updateSaldoRealPtKdrt(finalAmount, saldoRealNotesInput, uid, uname);
      showToast('Saldo Real PT KDRT berhasil diperbarui dan tersinkronisasi ke Buku Kas & Bank.');
      setIsEditSaldoRealModalOpen(false);
    } catch (err: any) {
      console.error('Error saving saldo real:', err);
      showToast('Gagal update Saldo Real PT KDRT: ' + (err.message || 'Error server'), 'error');
    } finally {
      setSaldoRealSaving(false);
    }
  };

  const handleSyncWithCalculatedSaldo = async () => {
    const calculatedSaldo = allTimeStats.totalSaldo;
    setSaldoRealSaving(true);
    const uid = currentUser?.uid || 'system';
    const uname = userProfile?.name || currentUser?.email || 'Admin';

    try {
      await updateSaldoRealPtKdrt(
        calculatedSaldo,
        `Sinkronisasi otomatis dari akumulasi mutasi rekening PT KDRT (${transactions.length} transaksi)`,
        uid,
        uname
      );
      showToast(`Saldo Real berhasil disinkronkan ke Rp ${calculatedSaldo.toLocaleString('id-ID')} & tersinkron ke Buku Kas & Bank.`);
    } catch (err: any) {
      console.error('Error syncing saldo real:', err);
      showToast('Gagal sinkronisasi saldo: ' + (err.message || 'Error server'), 'error');
    } finally {
      setSaldoRealSaving(false);
    }
  };

  // 13. Export to CSV helper
  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) {
      showToast('Tidak ada data transaksi untuk diekspor.', 'error');
      return;
    }

    const headers = [
      'ID',
      'Tanggal',
      'Jenis',
      'Kategori',
      'Rekening / Akun',
      'Keterangan',
      'No. Referensi',
      'Uang Masuk (Rp)',
      'Uang Keluar (Rp)',
      'Catatan',
      'Diinput Oleh',
    ];

    const rows = transactionsWithRunningBalance.map((t) => [
      t.id || '',
      t.date,
      t.type === 'INCOME' ? 'Uang Masuk' : 'Uang Keluar',
      `"${(t.category || '').replace(/"/g, '""')}"`,
      `"${(t.accountName || '').replace(/"/g, '""')}"`,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      `"${(t.referenceNumber || '').replace(/"/g, '""')}"`,
      t.type === 'INCOME' ? t.amount : 0,
      t.type === 'EXPENSE' ? t.amount : 0,
      `"${(t.notes || '').replace(/"/g, '""')}"`,
      `"${(t.createdByName || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Keuangan_Rekening_PT_KDRT_${isAllTime ? 'Semua_Periode' : selectedMonth}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('File CSV Keuangan PT KDRT berhasil diunduh.');
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#070B14] text-slate-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-4 ${
            toastMessage.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-950/90 text-emerald-200 shadow-emerald-950/50'
              : 'border-rose-500/40 bg-rose-950/90 text-rose-200 shadow-rose-950/50'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
          )}
          <p className="text-xs font-semibold">{toastMessage.text}</p>
        </div>
      )}

      {/* Main Container */}
      <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* Header Section */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.08] pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {onBackToPortal && (
                <button
                  onClick={onBackToPortal}
                  className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-cyan-300 transition mr-2"
                  title="Kembali ke Portal"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Portal</span>
                </button>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                <Landmark className="h-3 w-3" />
                Rekening Resmi PT KDRT
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                Database Terpisah
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl flex items-center gap-2.5">
              <span>Keuangan PT KDRT</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
              Pencatatan mutasi transaksi keuangan rekening PT KDRT secara manual, transparan, dan terisolasi dari Buku Kas &amp; Bank.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/[0.08] hover:text-white transition active:scale-95"
              title="Unduh data transaksi ke format CSV"
            >
              <Download className="h-4 w-4 text-slate-400" />
              <span>Ekspor CSV</span>
            </button>

            {isManagerOrOwner && (
              <>
                <button
                  type="button"
                  onClick={() => handleOpenAddModal('INCOME')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3.5 py-2.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 hover:text-emerald-200 transition shadow-[0_0_20px_rgba(16,185,129,0.15)] active:scale-95"
                >
                  <PlusCircle className="h-4 w-4 text-emerald-400" />
                  <span>+ Input Uang Masuk</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenAddModal('EXPENSE')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/15 px-3.5 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-500/25 hover:text-rose-200 transition shadow-[0_0_20px_rgba(244,63,94,0.15)] active:scale-95"
                >
                  <MinusCircle className="h-4 w-4 text-rose-400" />
                  <span>+ Input Uang Keluar</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Dashboard 4 Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Total Uang Masuk */}
          <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 via-[#0B1528] to-[#070B14] p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400/90">
                1. Total Uang Masuk
              </span>
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <ArrowDownLeft className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight text-white">
                {formatRupiah(periodStats.income)}
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                <span>{isAllTime ? 'Semua Waktu' : formatBulanTahun(selectedMonth)}</span>
                <span className="text-emerald-400/80 font-medium">
                  Total: {formatRupiah(allTimeStats.totalIncome)}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Total Uang Keluar */}
          <div className="relative overflow-hidden rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-950/40 via-[#0B1528] to-[#070B14] p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400/90">
                2. Total Uang Keluar
              </span>
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-rose-500/15 text-rose-300 border border-rose-500/30">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight text-white">
                {formatRupiah(periodStats.expense)}
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                <span>{isAllTime ? 'Semua Waktu' : formatBulanTahun(selectedMonth)}</span>
                <span className="text-rose-400/80 font-medium">
                  Total: {formatRupiah(allTimeStats.totalExpense)}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Arus Kas Bersih (Net Flow) */}
          <div className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/40 via-[#0B1528] to-[#070B14] p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                3. Arus Kas Bersih
              </span>
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                <Scale className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div
                className={`text-2xl font-bold tracking-tight ${
                  periodStats.net >= 0 ? 'text-cyan-300' : 'text-rose-400'
                }`}
              >
                {periodStats.net >= 0 ? '+' : ''}
                {formatRupiah(periodStats.net)}
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                <span>Selisih Periode Ini</span>
                <span
                  className={`font-semibold ${
                    periodStats.net >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {periodStats.net >= 0 ? 'Surplus' : 'Defisit'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Saldo Real PT KDRT (Tersinkronisasi dengan Buku Kas & Bank) */}
          <div
            id="card-saldo-real-pt-kdrt"
            className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-950/40 via-[#0B1528] to-[#070B14] p-5 shadow-lg flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                  4. Saldo Real PT KDRT
                </span>
                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300 border border-amber-500/30">
                  Sync Kas & Bank
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {isManagerOrOwner ? (
                  <button
                    id="btn-edit-saldo-real-pt-kdrt"
                    type="button"
                    onClick={handleOpenEditSaldoRealModal}
                    title="Edit / Sesuaikan Saldo Real PT KDRT"
                    className="flex h-7 items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-950/60 px-2 text-[11px] font-bold text-amber-300 hover:bg-amber-900 hover:text-white transition active:scale-95 shadow"
                  >
                    <Edit className="h-3 w-3" />
                    <span>Edit</span>
                  </button>
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-slate-500" title="Hanya Owner & Manager yang dapat mengubah">
                    <Lock className="h-3.5 w-3.5" />
                  </div>
                )}
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  <Landmark className="h-3.5 w-3.5" />
                </div>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight text-amber-300">
                {formatRupiah(Number(saldoRealData?.amount ?? allTimeStats.totalSaldo))}
              </div>
              <div className="mt-2 flex flex-col gap-1 border-t border-white/[0.08] pt-2 text-[11px]">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="truncate">
                    {saldoRealData?.updatedAt
                      ? `Update: ${formatTimestampWIB(saldoRealData.updatedAt)}`
                      : 'Akumulasi Mutasi Berjalan'}
                  </span>
                  {saldoRealData?.updatedByName && (
                    <span className="text-[10px] text-amber-400 font-semibold truncate max-w-[100px]">
                      oleh {saldoRealData.updatedByName}
                    </span>
                  )}
                </div>
                {saldoRealData?.notes && (
                  <p className="text-[10px] text-slate-400 truncate italic">
                    "{saldoRealData.notes}"
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Breakdown Saldo per Rekening PT KDRT */}
        {Object.keys(allTimeStats.accountBalances).length > 0 && (
          <div className="rounded-2xl border border-white/[0.07] bg-[#0A101D] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-amber-400" />
                <span>Rincian Saldo Akun Rekening PT KDRT</span>
              </h3>
              <span className="text-[11px] text-slate-500">Saldo Kumulatif Berjalan</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
              {Object.entries(allTimeStats.accountBalances).map(([accName, val]: [string, { income: number; expense: number; balance: number }]) => (
                <button
                  key={accName}
                  onClick={() => setFilterAccount(filterAccount === accName ? 'ALL' : accName)}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    filterAccount === accName
                      ? 'border-cyan-400/50 bg-cyan-950/40 shadow-[0_0_15px_rgba(0,229,255,0.1)]'
                      : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]'
                  }`}
                >
                  <p className="text-[11px] font-bold text-slate-300 truncate" title={accName}>
                    {accName}
                  </p>
                  <p
                    className={`text-xs sm:text-sm font-extrabold mt-1 ${
                      val.balance >= 0 ? 'text-amber-300' : 'text-rose-400'
                    }`}
                  >
                    {formatRupiah(val.balance)}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filter and Control Bar */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0B1322] p-4 sm:p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Month & Period Navigation */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center rounded-xl border border-white/10 bg-white/[0.03] p-1">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  disabled={isAllTime}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition disabled:opacity-30"
                  title="Bulan Sebelumnya"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <div className="flex items-center gap-1.5 px-3">
                  <Calendar className="h-3.5 w-3.5 text-cyan-400" />
                  <span className="text-xs font-bold text-white min-w-[130px] text-center">
                    {isAllTime ? 'Semua Periode' : formatBulanTahun(selectedMonth)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  disabled={isAllTime}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition disabled:opacity-30"
                  title="Bulan Berikutnya"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Toggle Semua Waktu */}
              <button
                type="button"
                onClick={() => setIsAllTime(!isAllTime)}
                className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                  isAllTime
                    ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-300'
                    : 'border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
                }`}
              >
                {isAllTime ? '✓ Semua Waktu Aktif' : 'Tampilkan Semua Waktu'}
              </button>
            </div>

            {/* Segmented Type Filter */}
            <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.02] p-1">
              <button
                type="button"
                onClick={() => setFilterType('ALL')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  filterType === 'ALL'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Semua Transaksi ({periodStats.count})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('INCOME')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  filterType === 'INCOME'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Uang Masuk (Kredit)
              </button>
              <button
                type="button"
                onClick={() => setFilterType('EXPENSE')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  filterType === 'EXPENSE'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Uang Keluar (Debit)
              </button>
            </div>
          </div>

          {/* Secondary Filters: Account, Category, & Search */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-white/[0.06]">
            {/* Search Input */}
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari keterangan, kategori, no referensi..."
                className="w-full rounded-xl border border-white/10 bg-black/40 pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Account Filter Dropdown */}
            <div>
              <select
                value={filterAccount}
                onChange={(e) => setFilterAccount(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-slate-300 focus:border-cyan-400 focus:outline-none"
              >
                <option value="ALL">Semua Akun Rekening</option>
                {availableAccounts.map((acc) => (
                  <option key={acc} value={acc}>
                    {acc}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter Dropdown */}
            <div>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-slate-300 focus:border-cyan-400 focus:outline-none"
              >
                <option value="ALL">Semua Kategori</option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Transactions Table Section */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0A101E] overflow-hidden shadow-xl">
          <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4 bg-white/[0.01]">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-cyan-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Riwayat Transaksi Rekening PT KDRT
              </h2>
              <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-300 border border-cyan-400/20">
                {transactionsWithRunningBalance.length} Transaksi
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
              <p className="mt-3 text-xs font-semibold">Memuat transaksi rekening PT KDRT...</p>
            </div>
          ) : transactionsWithRunningBalance.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/[0.02] text-slate-500 mb-3">
                <Receipt className="h-8 w-8" />
              </div>
              <h3 className="text-sm font-bold text-slate-200">Belum Ada Transaksi Rekening PT KDRT</h3>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                Belum ada catatan mutasi uang masuk atau uang keluar untuk filter yang dipilih. Silakan tambahkan transaksi baru secara manual.
              </p>
              {isManagerOrOwner && (
                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenAddModal('INCOME')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3.5 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    + Uang Masuk
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenAddModal('EXPENSE')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/15 px-3.5 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/25"
                  >
                    <MinusCircle className="h-3.5 w-3.5" />
                    + Uang Keluar
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.02] text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3.5 pl-5 pr-3">Tanggal</th>
                    <th className="py-3.5 px-3">Jenis</th>
                    <th className="py-3.5 px-3">Rekening</th>
                    <th className="py-3.5 px-3">Kategori</th>
                    <th className="py-3.5 px-3 min-w-[220px]">Keterangan &amp; Catatan</th>
                    <th className="py-3.5 px-3 text-right">Uang Masuk</th>
                    <th className="py-3.5 px-3 text-right">Uang Keluar</th>
                    <th className="py-3.5 px-3 text-right">Saldo Berjalan</th>
                    {isManagerOrOwner && <th className="py-3.5 pl-3 pr-5 text-center">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {transactionsWithRunningBalance.map((t, idx) => {
                    const isIncome = t.type === 'INCOME';
                    return (
                      <tr
                        key={t.id || idx}
                        className="hover:bg-white/[0.02] transition-colors group"
                      >
                        {/* Tanggal */}
                        <td className="py-3.5 pl-5 pr-3 font-semibold text-slate-300 whitespace-nowrap">
                          {formatTanggal(t.date)}
                        </td>

                        {/* Jenis Badge */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {isIncome ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                              <ArrowDownLeft className="h-3 w-3" />
                              Uang Masuk
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                              <ArrowUpRight className="h-3 w-3" />
                              Uang Keluar
                            </span>
                          )}
                        </td>

                        {/* Rekening */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] font-semibold text-slate-300">
                            <CreditCard className="h-3 w-3 text-amber-400" />
                            {t.accountName || 'BCA PT KDRT'}
                          </span>
                        </td>

                        {/* Kategori */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-medium text-cyan-300">
                            {t.category || 'Lain-lain'}
                          </span>
                        </td>

                        {/* Keterangan */}
                        <td className="py-3.5 px-3">
                          <div className="space-y-0.5">
                            <div className="font-semibold text-slate-200">{t.description}</div>
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                              {t.referenceNumber && (
                                <span className="rounded bg-white/[0.04] px-1.5 py-0.2 text-[10px] font-mono text-slate-400">
                                  Ref: {t.referenceNumber}
                                </span>
                              )}
                              {t.notes && <span className="italic">{t.notes}</span>}
                            </div>
                          </div>
                        </td>

                        {/* Uang Masuk */}
                        <td className="py-3.5 px-3 text-right font-bold text-emerald-400 whitespace-nowrap font-mono">
                          {isIncome ? formatRupiah(t.amount) : '-'}
                        </td>

                        {/* Uang Keluar */}
                        <td className="py-3.5 px-3 text-right font-bold text-rose-400 whitespace-nowrap font-mono">
                          {!isIncome ? formatRupiah(t.amount) : '-'}
                        </td>

                        {/* Saldo Berjalan */}
                        <td
                          className={`py-3.5 px-3 text-right font-bold whitespace-nowrap font-mono ${
                            t.runningBalance >= 0 ? 'text-amber-300' : 'text-rose-400'
                          }`}
                        >
                          {formatRupiah(t.runningBalance)}
                        </td>

                        {/* Aksi */}
                        {isManagerOrOwner && (
                          <td className="py-3.5 pl-3 pr-5 text-center whitespace-nowrap">
                            <div className="inline-flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(t)}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-cyan-300 transition"
                                title="Edit Transaksi"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDeletingTransaction(t);
                                  setIsDeleteModalOpen(true);
                                }}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 transition"
                                title="Hapus Transaksi"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: INPUT / EDIT TRANSAKSI */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-2xl border border-white/15 bg-[#0D1527] p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-cyan-400" />
                  <span>
                    {editingTransaction
                      ? 'Edit Transaksi Rekening PT KDRT'
                      : formType === 'INCOME'
                      ? 'Input Uang Masuk Rekening PT KDRT'
                      : 'Input Uang Keluar Rekening PT KDRT'}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Transaksi disimpan khusus ke database rekening PT KDRT (tidak tercampur Buku Kas).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveTransaction} className="space-y-4">
              {/* Jenis Transaksi Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Jenis Transaksi
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormType('INCOME');
                      if (formCategory === 'CUSTOM') return;
                      setFormCategory(PT_KDRT_INCOME_CATEGORIES[0]);
                    }}
                    className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold transition ${
                      formType === 'INCOME'
                        ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                        : 'border-white/10 bg-white/[0.02] text-slate-400 hover:bg-white/[0.05]'
                    }`}
                  >
                    <ArrowDownLeft className="h-4 w-4" />
                    <span>Uang Masuk (Kredit)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormType('EXPENSE');
                      if (formCategory === 'CUSTOM') return;
                      setFormCategory(PT_KDRT_EXPENSE_CATEGORIES[0]);
                    }}
                    className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold transition ${
                      formType === 'EXPENSE'
                        ? 'border-rose-500/50 bg-rose-500/20 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
                        : 'border-white/10 bg-white/[0.02] text-slate-400 hover:bg-white/[0.05]'
                    }`}
                  >
                    <ArrowUpRight className="h-4 w-4" />
                    <span>Uang Keluar (Debit)</span>
                  </button>
                </div>
              </div>

              {/* Tanggal & Jumlah (2 Columns) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Tanggal Transaksi *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-xs font-medium text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Nominal Transaksi (Rp) *
                  </label>
                  <CurrencyInput
                    value={formAmount}
                    onChange={(val) => setFormAmount(val)}
                    placeholder="Rp 0"
                    required
                    className="w-full rounded-xl border border-white/10 bg-black/40 pl-9 pr-3.5 py-2.5 text-xs font-bold text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Rekening PT KDRT */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Rekening PT KDRT *
                </label>
                <div className="space-y-2">
                  <select
                    value={formAccount}
                    onChange={(e) => setFormAccount(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-xs font-medium text-white focus:border-cyan-400 focus:outline-none"
                  >
                    {PT_KDRT_DEFAULT_ACCOUNTS.map((acc) => (
                      <option key={acc} value={acc}>
                        {acc}
                      </option>
                    ))}
                    <option value="CUSTOM">+ Tulis Rekening Lainnya...</option>
                  </select>

                  {formAccount === 'CUSTOM' && (
                    <input
                      type="text"
                      required
                      value={formCustomAccount}
                      onChange={(e) => setFormCustomAccount(e.target.value)}
                      placeholder="Masukkan nama rekening / bank resmi PT KDRT"
                      className="w-full rounded-xl border border-cyan-500/40 bg-black/40 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                    />
                  )}
                </div>
              </div>

              {/* Kategori */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Kategori *
                </label>
                <div className="space-y-2">
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-xs font-medium text-white focus:border-cyan-400 focus:outline-none"
                  >
                    {(formType === 'INCOME'
                      ? PT_KDRT_INCOME_CATEGORIES
                      : PT_KDRT_EXPENSE_CATEGORIES
                    ).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="CUSTOM">+ Kategori Kustom / Lainnya...</option>
                  </select>

                  {formCategory === 'CUSTOM' && (
                    <input
                      type="text"
                      required
                      value={formCustomCategory}
                      onChange={(e) => setFormCustomCategory(e.target.value)}
                      placeholder="Tulis nama kategori transaksi"
                      className="w-full rounded-xl border border-cyan-500/40 bg-black/40 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                    />
                  )}
                </div>
              </div>

              {/* Keterangan Transaksi */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Keterangan Transaksi *
                </label>
                <input
                  type="text"
                  required
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder={
                    formType === 'INCOME'
                      ? 'Misal: Omset live TikTok Seller Center Minggu ke-3'
                      : 'Misal: Pembayaran sewa kantor & WiFi bulan Agustus'
                  }
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-xs font-medium text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              {/* No. Referensi & Bukti (Opsional) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  No. Referensi / Bukti Transfer (Opsional)
                </label>
                <input
                  type="text"
                  value={formReferenceNumber}
                  onChange={(e) => setFormReferenceNumber(e.target.value)}
                  placeholder="Misal: TRF-9821414, NO-REF-8921"
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-xs font-medium text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none font-mono"
                />
              </div>

              {/* Catatan Tambahan (Opsional) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Catatan Tambahan (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Catatan detail internal transaksi..."
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-xs font-medium text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  disabled={submitting}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/[0.08] hover:text-white transition disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`rounded-xl px-5 py-2.5 text-xs font-bold transition shadow-lg disabled:opacity-50 ${
                    formType === 'INCOME'
                      ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-950/50'
                      : 'bg-rose-600 text-white hover:bg-rose-500 shadow-rose-950/50'
                  }`}
                >
                  {submitting
                    ? 'Menyimpan...'
                    : editingTransaction
                    ? 'Simpan Perubahan'
                    : formType === 'INCOME'
                    ? 'Simpan Uang Masuk'
                    : 'Simpan Uang Keluar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CONFIRMATION */}
      {isDeleteModalOpen && deletingTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md rounded-2xl border border-rose-500/30 bg-[#0D1527] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-500/15 border border-rose-500/30">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Hapus Transaksi Keuangan PT KDRT?</h3>
                <p className="text-xs text-slate-400">Tindakan ini tidak dapat dibatalkan.</p>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/40 p-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Tanggal:</span>
                <span className="font-semibold text-slate-200">{formatTanggal(deletingTransaction.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Jenis:</span>
                <span
                  className={`font-bold ${
                    deletingTransaction.type === 'INCOME' ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {deletingTransaction.type === 'INCOME' ? 'Uang Masuk' : 'Uang Keluar'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Nominal:</span>
                <span className="font-bold text-white">{formatRupiah(deletingTransaction.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Rekening:</span>
                <span className="text-slate-300">{deletingTransaction.accountName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Keterangan:</span>
                <span className="text-slate-300 truncate max-w-[200px]">{deletingTransaction.description}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeletingTransaction(null);
                }}
                disabled={submitting}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.08] hover:text-white transition disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={submitting}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 transition shadow-lg shadow-rose-950/50 disabled:opacity-50"
              >
                {submitting ? 'Menghapus...' : 'Ya, Hapus Transaksi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL: EDIT SALDO REAL PT KDRT (SYNC WITH BUKU KAS & BANK)
      ============================================================ */}
      {isEditSaldoRealModalOpen && (
        <div
          id="modal-edit-saldo-real-pt-kdrt"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in"
        >
          <div className="relative w-full max-w-md rounded-2xl border border-amber-500/40 bg-[#0D1527] p-6 shadow-2xl space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  <Landmark className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Edit Saldo Real PT KDRT
                  </h3>
                  <p className="text-[11px] text-amber-300/80">
                    Tersinkronisasi otomatis dengan Buku Kas & Bank (Menu 4)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditSaldoRealModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Helper: Calculated from Mutasi */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-3 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[11px]">Total Mutasi Rekening:</span>
                <span className="font-bold text-amber-300">
                  {formatRupiah(allTimeStats.totalSaldo)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSaldoRealAmountInput(allTimeStats.totalSaldo);
                  setSaldoRealNotesInput(
                    `Sinkronisasi otomatis mutasi rekening PT KDRT (${transactions.length} transaksi)`
                  );
                }}
                className="w-full rounded-lg border border-amber-500/30 bg-amber-500/10 py-1.5 text-[11px] font-bold text-amber-300 hover:bg-amber-500/20 transition flex items-center justify-center gap-1.5"
              >
                <Sparkles className="h-3 w-3" />
                <span>Salin Nilai Total Mutasi ke Form</span>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveSaldoReal} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Nominal Saldo Real PT KDRT (Rp) <span className="text-amber-400">*</span>
                </label>
                <CurrencyInput
                  id="input-saldo-real-pt-kdrt"
                  value={saldoRealAmountInput}
                  onChange={(val) => setSaldoRealAmountInput(val)}
                  placeholder="0"
                  className="w-full rounded-xl border border-amber-500/40 bg-black/50 px-3.5 py-2.5 text-base font-extrabold text-amber-300 placeholder-slate-600 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Catatan / Keterangan (Opsional)
                </label>
                <textarea
                  id="input-saldo-real-notes-pt-kdrt"
                  value={saldoRealNotesInput}
                  onChange={(e) => setSaldoRealNotesInput(e.target.value)}
                  rows={2}
                  placeholder="Contoh: Rekening BCA PT KDRT per 28 Agustus 2026"
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-xs font-medium text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditSaldoRealModalOpen(false)}
                  disabled={saldoRealSaving}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-white/[0.08] hover:text-white transition disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saldoRealSaving}
                  className="flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-amber-950/50 transition active:scale-95 disabled:opacity-60"
                >
                  {saldoRealSaving && <RefreshCw className="h-4 w-4 animate-spin" />}
                  <span>{saldoRealSaving ? 'Menyimpan...' : 'Simpan & Sinkronkan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
