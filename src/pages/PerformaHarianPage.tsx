import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  TrendingUp,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BarChart3,
  Eye,
  ShoppingCart,
  CalendarDays,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  AlertTriangle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, query, getDocs } from 'firebase/firestore';
import { Account, DailyPerformance, ScopeType } from '../types';
import {
  subscribeDailyPerformance,
  saveOmsetData,
  saveKomisiReal,
  updateDailyPerformanceGmv,
  updateDailyPerformanceKomisi,
  deleteKomisiRealAtomic,
} from '../services/performanceService';
import {
  formatRupiah,
  tanggalHariIni,
  tanggalKemarin,
  formatTanggal,
  bulanHariIni,
  formatBulanTahun,
} from '../utils/formatters';
import { filterAccountsForUser } from '../utils/accountAccess';
import { CurrencyInput } from '../components/CurrencyInput';
import { OrphanTransactionAlert } from '../components/finance/OrphanTransactionAlert';

type OmsetTab = 'GMV' | 'KOMISI';

const numberId = (value?: number | string | null) =>
  value !== undefined && value !== null && value !== ''
    ? Number(value).toLocaleString('id-ID')
    : '0';

// Safe helper to unify reading of real commission without double-counting
const getCommissionReal = (p: DailyPerformance): number => {
  if (p.commissionReal !== undefined && p.commissionReal !== null && (p.commissionReal as any) !== '') {
    return Number(p.commissionReal) || 0;
  }
  if (p.realCommission !== undefined && p.realCommission !== null && (p.realCommission as any) !== '') {
    return Number(p.realCommission) || 0;
  }
  return 0;
};

const StatCard: React.FC<{
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: 'cyan' | 'emerald' | 'violet' | 'amber';
  subtitle?: string;
  testId: string;
}> = ({ label, value, icon, accent = 'cyan', subtitle, testId }) => {
  const ring = {
    cyan: 'text-cyan-300 bg-cyan-400/10 border-cyan-400/20',
    emerald: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20',
    violet: 'text-violet-300 bg-violet-400/10 border-violet-400/20',
    amber: 'text-amber-300 bg-amber-400/10 border-amber-400/20',
  }[accent];

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#111623] p-4 flex flex-col justify-between" data-testid={testId}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
          {label}
        </span>
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border ${ring}`}>
          {icon}
        </span>
      </div>
      <div>
        <p className="mt-3 font-display text-lg font-semibold tracking-tight text-white">{value}</p>
        {subtitle && <p className="mt-1 text-[11px] text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );
};

export const PerformaHarianPage: React.FC<{
  onBackToPortal?: () => void;
  initialTab?: OmsetTab;
}> = ({ onBackToPortal, initialTab = 'GMV' }) => {
  const { role, employeeProfile, currentUser, userProfile } = useAuth();

  const [activeTab, setActiveTab] = useState<OmsetTab>(initialTab);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [performances, setPerformances] = useState<DailyPerformance[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // Filter States
  const [selectedMonthStr, setSelectedMonthStr] = useState<string>(bulanHariIni());
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const today = tanggalHariIni();
  const yesterday = tanggalKemarin();

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Dedicated Edit Modals State
  const [editGmvRecord, setEditGmvRecord] = useState<DailyPerformance | null>(null);
  const [editKomisiRecord, setEditKomisiRecord] = useState<DailyPerformance | null>(null);
  const [editFormState, setEditFormState] = useState({
    date: '',
    accountId: '',
    gmv: '' as number | '',
    estimatedCommission: '' as number | '',
    itemSold: '' as number | '',
    productImpression: '' as number | '',
    commissionReal: '' as number | '',
    notes: '',
  });

  // Delete State
  const [deletingPerformance, setDeletingPerformance] = useState<{
    record: DailyPerformance;
    type: 'GMV' | 'KOMISI';
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Tab 1 — Data GMV Form (New Input)
  const [gmvForm, setGmvForm] = useState({
    date: tanggalHariIni(),
    accountId: '',
    gmv: '' as number | '',
    estimatedCommission: '' as number | '',
    itemSold: '' as number | '',
    productImpression: '' as number | '',
    notes: '',
  });

  // Tab 2 — Komisi Real Form (New Input)
  const [komisiForm, setKomisiForm] = useState({
    date: tanggalHariIni(),
    accountId: '',
    realCommission: '' as number | '',
    notes: '',
  });

  useEffect(() => {
    let mounted = true;
    const fetchAccounts = async () => {
      const snap = await getDocs(query(collection(db, 'accounts')));
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Account));
      const allowed = filterAccountsForUser(all, role, employeeProfile);
      if (!mounted) return;
      setAccounts(allowed);
      if (allowed.length === 1) {
        setGmvForm((prev) => ({ ...prev, accountId: allowed[0].id || '' }));
        setKomisiForm((prev) => ({ ...prev, accountId: allowed[0].id || '' }));
      }
      setLoadingAccounts(false);
    };
    fetchAccounts();

    const unsub = subscribeDailyPerformance(undefined, setPerformances);
    return () => {
      mounted = false;
      unsub();
    };
  }, [role, employeeProfile]);

  const accountById = (id: string) => accounts.find((a) => a.id === id);
  const scopeOf = (id: string): ScopeType => accountById(id)?.scope || 'SHARING';

  // Karyawan hanya melihat performa akun yang menjadi tanggung jawabnya.
  const visiblePerformances = useMemo(() => {
    if (role === 'OWNER' || role === 'MANAGER') return performances;
    const ids = new Set(accounts.map((a) => a.id));
    return performances.filter((p) => ids.has(p.accountId));
  }, [performances, accounts, role]);

  // Filtered rows based on Period, Account, and Search
  const filteredRows = useMemo(() => {
    return visiblePerformances
      .filter((p) => {
        // 1. Month Filter
        if (selectedMonthStr && !(p.date || '').startsWith(selectedMonthStr)) {
          return false;
        }

        // 2. Account Filter
        if (selectedAccountFilter !== 'ALL' && p.accountId !== selectedAccountFilter) {
          return false;
        }

        // 3. Search Filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const accName = (p.accountName || '').toLowerCase();
          const notes = (p.notes || '').toLowerCase();
          const commNotes = (p.commissionNotes || '').toLowerCase();
          const dateStr = (p.date || '').toLowerCase();
          if (
            !accName.includes(q) &&
            !notes.includes(q) &&
            !commNotes.includes(q) &&
            !dateStr.includes(q)
          ) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [visiblePerformances, selectedMonthStr, selectedAccountFilter, searchQuery]);

  // Totals calculations with safe Number() conversion
  const totals = useMemo(() => {
    const acc = {
      gmvBulan: 0,
      estBulan: 0,
      komisiBulan: 0,
      itemSoldBulan: 0,
      impressionBulan: 0,
      gmvHariIni: 0,
      komisiHariIni: 0,
      komisiKemarin: 0,
    };

    // Calculate metrics strictly for the filtered dataset in the selected period
    filteredRows.forEach((p) => {
      acc.gmvBulan += Number(p.gmv) || 0;
      acc.estBulan += Number(p.estimatedCommission) || 0;
      acc.komisiBulan += getCommissionReal(p);
      acc.itemSoldBulan += Number(p.itemSold) || 0;
      acc.impressionBulan += Number(p.productImpression) || 0;
    });

    // Real Komisi Kemarin (berdasarkan data riil yang tersimpan di Firebase)
    visiblePerformances
      .filter((p) => {
        if (p.date !== yesterday) return false;
        if (selectedAccountFilter !== 'ALL' && p.accountId !== selectedAccountFilter) return false;
        return true;
      })
      .forEach((p) => {
        acc.komisiKemarin += getCommissionReal(p);
      });

    // Today's metrics (respecting account filter if active)
    visiblePerformances
      .filter((p) => {
        if (p.date !== today) return false;
        if (selectedAccountFilter !== 'ALL' && p.accountId !== selectedAccountFilter) return false;
        return true;
      })
      .forEach((p) => {
        acc.gmvHariIni += Number(p.gmv) || 0;
        acc.komisiHariIni += getCommissionReal(p);
      });

    return acc;
  }, [filteredRows, visiblePerformances, today, yesterday, selectedAccountFilter]);

  // Chart data: Daily performance time-series for the selected month
  const chartData = useMemo(() => {
    if (!selectedMonthStr) {
      // Group by distinct dates in filtered rows
      const dateMap = new Map<string, { gmv: number; estimatedCommission: number; itemSold: number; productImpression: number }>();
      filteredRows.forEach((p) => {
        const d = p.date || '';
        if (!d) return;
        const current = dateMap.get(d) || { gmv: 0, estimatedCommission: 0, itemSold: 0, productImpression: 0 };
        current.gmv += Number(p.gmv) || 0;
        current.estimatedCommission += Number(p.estimatedCommission) || 0;
        current.itemSold += Number(p.itemSold) || 0;
        current.productImpression += Number(p.productImpression) || 0;
        dateMap.set(d, current);
      });

      return Array.from(dateMap.entries())
        .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
        .map(([date, vals]) => {
          const parts = date.split('-');
          const dayNum = parseInt(parts[2] || '1', 10);
          return {
            date,
            dayNum,
            dayLabel: `${dayNum}`,
            formattedDate: formatTanggal(date),
            ...vals,
          };
        });
    }

    // Build timeline for all days of selectedMonthStr (e.g. 1..31)
    const [yStr, mStr] = selectedMonthStr.split('-');
    const year = parseInt(yStr, 10);
    const month = parseInt(mStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();

    // Map daily aggregation
    const dayMap = new Map<string, { gmv: number; estimatedCommission: number; itemSold: number; productImpression: number }>();
    filteredRows.forEach((p) => {
      if (!p.date) return;
      const current = dayMap.get(p.date) || { gmv: 0, estimatedCommission: 0, itemSold: 0, productImpression: 0 };
      current.gmv += Number(p.gmv) || 0;
      current.estimatedCommission += Number(p.estimatedCommission) || 0;
      current.itemSold += Number(p.itemSold) || 0;
      current.productImpression += Number(p.productImpression) || 0;
      dayMap.set(p.date, current);
    });

    const result = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${selectedMonthStr}-${String(d).padStart(2, '0')}`;
      const vals = dayMap.get(dateStr) || { gmv: 0, estimatedCommission: 0, itemSold: 0, productImpression: 0 };
      result.push({
        date: dateStr,
        dayNum: d,
        dayLabel: String(d),
        formattedDate: formatTanggal(dateStr),
        ...vals,
      });
    }

    return result;
  }, [filteredRows, selectedMonthStr]);

  const resetFeedback = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  // Month navigation helpers
  const handlePrevMonth = () => {
    if (!selectedMonthStr) {
      setSelectedMonthStr(bulanHariIni());
      return;
    }
    const [y, m] = selectedMonthStr.split('-').map(Number);
    const date = new Date(y, m - 2, 1);
    const newY = date.getFullYear();
    const newM = String(date.getMonth() + 1).padStart(2, '0');
    setSelectedMonthStr(`${newY}-${newM}`);
  };

  const handleNextMonth = () => {
    if (!selectedMonthStr) {
      setSelectedMonthStr(bulanHariIni());
      return;
    }
    const [y, m] = selectedMonthStr.split('-').map(Number);
    const date = new Date(y, m, 1);
    const newY = date.getFullYear();
    const newM = String(date.getMonth() + 1).padStart(2, '0');
    setSelectedMonthStr(`${newY}-${newM}`);
  };

  // Open Edit Modal for GMV
  const handleOpenEditGmv = (p: DailyPerformance) => {
    resetFeedback();
    setEditGmvRecord(p);
    setEditFormState({
      date: p.date || tanggalHariIni(),
      accountId: p.accountId || '',
      gmv: p.gmv !== undefined && p.gmv !== null ? Number(p.gmv) : '',
      estimatedCommission:
        p.estimatedCommission !== undefined && p.estimatedCommission !== null
          ? Number(p.estimatedCommission)
          : '',
      itemSold: p.itemSold !== undefined && p.itemSold !== null ? Number(p.itemSold) : '',
      productImpression:
        p.productImpression !== undefined && p.productImpression !== null
          ? Number(p.productImpression)
          : '',
      commissionReal: getCommissionReal(p) || '',
      notes: p.notes || '',
    });
  };

  // Open Edit Modal for Komisi Real
  const handleOpenEditKomisi = (p: DailyPerformance) => {
    resetFeedback();
    setEditKomisiRecord(p);
    setEditFormState({
      date: p.date || tanggalHariIni(),
      accountId: p.accountId || '',
      gmv: p.gmv !== undefined && p.gmv !== null ? Number(p.gmv) : '',
      estimatedCommission:
        p.estimatedCommission !== undefined && p.estimatedCommission !== null
          ? Number(p.estimatedCommission)
          : '',
      itemSold: p.itemSold !== undefined && p.itemSold !== null ? Number(p.itemSold) : '',
      productImpression:
        p.productImpression !== undefined && p.productImpression !== null
          ? Number(p.productImpression)
          : '',
      commissionReal: getCommissionReal(p) || '',
      notes: p.commissionNotes || p.notes || '',
    });
  };

  // Save GMV (New Input)
  const handleSaveGmv = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFeedback();
    if (!gmvForm.accountId || !gmvForm.date) {
      setErrorMessage('Pilih tanggal dan akun medsos terlebih dahulu.');
      return;
    }
    setSaving(true);
    try {
      await saveOmsetData(
        {
          date: gmvForm.date,
          accountId: gmvForm.accountId,
          accountName: accountById(gmvForm.accountId)?.accountName || '',
          scope: scopeOf(gmvForm.accountId),
          gmv: Number(gmvForm.gmv) || 0,
          estimatedCommission: Number(gmvForm.estimatedCommission) || 0,
          itemSold: Number(gmvForm.itemSold) || 0,
          productImpression: Number(gmvForm.productImpression) || 0,
          notes: gmvForm.notes,
        },
        currentUser?.uid || 'system',
        userProfile?.name || 'User'
      );

      setSuccessMessage('Data GMV berhasil disimpan. Komisi Real yang sudah ada tetap dipertahankan.');
      setGmvForm((prev) => ({
        ...prev,
        gmv: '',
        estimatedCommission: '',
        itemSold: '',
        productImpression: '',
        notes: '',
      }));
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan Data GMV.');
    } finally {
      setSaving(false);
    }
  };

  // Save Edit GMV (Modal)
  const handleSaveEditGmv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editGmvRecord || !editGmvRecord.id) return;
    resetFeedback();
    if (!editFormState.accountId || !editFormState.date) {
      setErrorMessage('Pilih tanggal dan akun medsos terlebih dahulu.');
      return;
    }
    setSaving(true);
    try {
      await updateDailyPerformanceGmv(
        editGmvRecord.id,
        {
          date: editFormState.date,
          accountId: editFormState.accountId,
          accountName: accountById(editFormState.accountId)?.accountName || editGmvRecord.accountName || '',
          scope: scopeOf(editFormState.accountId),
          gmv: Number(editFormState.gmv) || 0,
          estimatedCommission: Number(editFormState.estimatedCommission) || 0,
          itemSold: Number(editFormState.itemSold) || 0,
          productImpression: Number(editFormState.productImpression) || 0,
          notes: editFormState.notes,
        },
        currentUser?.uid || 'system',
        userProfile?.name || 'User'
      );

      setSuccessMessage('Data GMV berhasil diperbarui pada Firebase. Statistik dan grafik telah diperbarui.');
      setEditGmvRecord(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memperbarui Data GMV.');
    } finally {
      setSaving(false);
    }
  };

  // Save Komisi Real (New Input)
  const handleSaveKomisi = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFeedback();
    if (!komisiForm.accountId || !komisiForm.date) {
      setErrorMessage('Pilih tanggal dan akun medsos terlebih dahulu.');
      return;
    }
    if (komisiForm.realCommission === '' || Number(komisiForm.realCommission) <= 0) {
      setErrorMessage('Nominal Komisi Real harus lebih besar dari 0.');
      return;
    }
    setSaving(true);
    try {
      await saveKomisiReal(
        {
          date: komisiForm.date,
          accountId: komisiForm.accountId,
          accountName: accountById(komisiForm.accountId)?.accountName || '',
          scope: scopeOf(komisiForm.accountId),
          realCommission: Number(komisiForm.realCommission) || 0,
          commissionReal: Number(komisiForm.realCommission) || 0,
          commissionNotes: komisiForm.notes,
        },
        currentUser?.uid || 'system',
        userProfile?.name || 'User'
      );

      setSuccessMessage(
        `Komisi Real ${formatRupiah(Number(komisiForm.realCommission))} tersimpan. Dana siap dicairkan melalui menu Pindah Dana.`
      );

      setKomisiForm((prev) => ({ ...prev, realCommission: '', notes: '' }));
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan Komisi Real.');
    } finally {
      setSaving(false);
    }
  };

  // Save Edit Komisi Real (Modal)
  const handleSaveEditKomisi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editKomisiRecord || !editKomisiRecord.id) return;
    resetFeedback();
    if (!editFormState.accountId || !editFormState.date) {
      setErrorMessage('Pilih tanggal dan akun medsos terlebih dahulu.');
      return;
    }
    setSaving(true);
    try {
      await updateDailyPerformanceKomisi(
        editKomisiRecord.id,
        {
          date: editFormState.date,
          accountId: editFormState.accountId,
          accountName: accountById(editFormState.accountId)?.accountName || editKomisiRecord.accountName || '',
          scope: scopeOf(editFormState.accountId),
          commissionReal: Number(editFormState.commissionReal) || 0,
          notes: editFormState.notes,
        },
        currentUser?.uid || 'system',
        userProfile?.name || 'User'
      );

      setSuccessMessage('Data Komisi Real berhasil diperbarui pada Firebase. Semua panel telah dihitung ulang.');
      setEditKomisiRecord(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memperbarui Komisi Real.');
    } finally {
      setSaving(false);
    }
  };

  // Confirm and Execute Deletion
  const handleConfirmDelete = async () => {
    if (!deletingPerformance?.record?.id) return;
    setDeleting(true);
    resetFeedback();
    try {
      await deleteKomisiRealAtomic(
        deletingPerformance.record.id,
        `Dihapus manual dari tabel ${deletingPerformance.type === 'GMV' ? 'Data GMV' : 'Komisi Real'}`,
        currentUser?.uid || 'system',
        userProfile?.name || 'User'
      );

      setSuccessMessage(
        `Data ${deletingPerformance.type === 'GMV' ? 'GMV' : 'Komisi Real'} berhasil dihapus permanen dari Firebase.`
      );
      setDeletingPerformance(null);
    } catch (err: any) {
      console.error('Error deleting performance:', err);
      setErrorMessage('Gagal menghapus data: ' + (err.message || 'Error server'));
    } finally {
      setDeleting(false);
    }
  };

  const canInput = role !== 'INVESTOR';
  const labelClass = 'mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400';

  const accountSelect = (value: string, onChange: (v: string) => void, testId: string) => (
    <select
      required
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="kdrt-input"
      data-testid={testId}
    >
      <option value="">-- Pilih Akun --</option>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.accountName} ({a.scope})
        </option>
      ))}
    </select>
  );

  return (
    <div className="mx-auto w-full max-w-[1400px] pb-14" data-testid="data-omset-page">
      {role !== 'EMPLOYEE' && <OrphanTransactionAlert />}

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 border-b border-white/[0.07] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-3">
          {onBackToPortal && (
            <button
              onClick={onBackToPortal}
              className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
              data-testid="omset-back-button"
              aria-label="Kembali ke portal"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-300/80">
              Performa Harian
            </span>
            <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Data Omset
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
              Satu halaman untuk dua fungsi: <strong className="text-slate-200">Data GMV</strong>{' '}
              mencatat performa penjualan &amp; komisi estimasi, sedangkan{' '}
              <strong className="text-slate-200">Komisi Real</strong> mencatat uang yang benar-benar
              masuk ke saldo akun dan siap dicairkan.
            </p>
          </div>
        </div>

        {/* Month Selector Toolbar */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          <div className="flex items-center rounded-xl border border-white/10 bg-[#111623] p-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              title="Bulan Sebelumnya"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 px-3 py-1 text-xs">
              <CalendarDays className="h-4 w-4 text-cyan-400" />
              <span className="font-bold text-white">
                {selectedMonthStr ? formatBulanTahun(selectedMonthStr) : 'Semua Periode'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              title="Bulan Berikutnya"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {selectedMonthStr ? (
            <button
              type="button"
              onClick={() => setSelectedMonthStr('')}
              className="rounded-xl border border-white/10 bg-[#111623] px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5 hover:text-white transition"
            >
              Semua Periode
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSelectedMonthStr(bulanHariIni())}
              className="rounded-xl border border-cyan-500/30 bg-cyan-950/40 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/50 transition"
            >
              Bulan Ini
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div
        className="inline-flex rounded-xl border border-white/10 bg-[#070B14] p-1"
        role="tablist"
        data-testid="omset-tabs"
      >
        {([
          { id: 'GMV' as OmsetTab, label: 'Data GMV', icon: BarChart3 },
          { id: 'KOMISI' as OmsetTab, label: 'Komisi Real', icon: Wallet },
        ]).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setActiveTab(tab.id);
                resetFeedback();
              }}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-semibold transition-colors sm:px-6 ${
                isActive
                  ? 'bg-[#111623] text-cyan-300 shadow-[0_0_18px_rgba(0,229,255,0.12)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              data-testid={tab.id === 'GMV' ? 'tab-data-gmv' : 'tab-komisi-real'}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Feedback Messages */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-6 flex items-start gap-2.5 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300"
            data-testid="omset-success-message"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="leading-relaxed">{successMessage}</span>
          </motion.div>
        )}
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-6 flex items-start gap-2.5 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
            data-testid="omset-error-message"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="leading-relaxed">{errorMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================
          METRIC PANELS (TOP OF EACH TAB)
      ============================================================ */}
      <div className="mt-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {activeTab === 'GMV' ? (
          <>
            {/* Panel 1: GMV BULAN INI */}
            <StatCard
              label={selectedMonthStr ? `GMV (${formatBulanTahun(selectedMonthStr)})` : 'GMV Total'}
              value={formatRupiah(totals.gmvBulan)}
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              accent="cyan"
              testId="stat-gmv-bulan"
            />
            {/* Panel 2: ESTIMASI KOMISI */}
            <StatCard
              label={selectedMonthStr ? `Estimasi Komisi (${formatBulanTahun(selectedMonthStr)})` : 'Estimasi Komisi'}
              value={formatRupiah(totals.estBulan)}
              icon={<BarChart3 className="h-3.5 w-3.5" />}
              accent="violet"
              testId="stat-estimasi-bulan"
            />
            {/* Panel 3: ITEM SOLD */}
            <StatCard
              label="Item Sold"
              value={numberId(totals.itemSoldBulan)}
              icon={<ShoppingCart className="h-3.5 w-3.5" />}
              accent="violet"
              testId="stat-item-sold"
            />
            {/* Panel 4: PRODUCT IMPRESSION */}
            <StatCard
              label="Product Impression"
              value={numberId(totals.impressionBulan)}
              icon={<Eye className="h-3.5 w-3.5" />}
              accent="cyan"
              testId="stat-impression"
            />
          </>
        ) : (
          <>
            {/* URUTAN PANEL TAB KOMISI REAL:
                1. GMV BULAN INI
                2. EST. KOMISI BULAN INI
                3. REAL KOMISI KEMARIN
                4. REAL KOMISI BULAN INI
            */}
            {/* 1. GMV BULAN INI */}
            <StatCard
              label={selectedMonthStr ? `GMV (${formatBulanTahun(selectedMonthStr)})` : 'GMV Total'}
              value={formatRupiah(totals.gmvBulan)}
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              accent="cyan"
              testId="stat-gmv-bulan-komisi"
            />

            {/* 2. EST. KOMISI BULAN INI */}
            <StatCard
              label={selectedMonthStr ? `Est. Komisi (${formatBulanTahun(selectedMonthStr)})` : 'Est. Komisi Total'}
              value={formatRupiah(totals.estBulan)}
              icon={<BarChart3 className="h-3.5 w-3.5" />}
              accent="violet"
              testId="stat-est-komisi-bulan-komisi"
            />

            {/* 3. REAL KOMISI KEMARIN */}
            <StatCard
              label="Real Komisi Kemarin"
              value={formatRupiah(totals.komisiKemarin)}
              icon={<Wallet className="h-3.5 w-3.5" />}
              accent="amber"
              subtitle={formatTanggal(yesterday)}
              testId="stat-real-komisi-kemarin"
            />

            {/* 4. REAL KOMISI BULAN INI */}
            <StatCard
              label={selectedMonthStr ? `Real Komisi (${formatBulanTahun(selectedMonthStr)})` : 'Real Komisi Total'}
              value={formatRupiah(totals.komisiBulan)}
              icon={<Wallet className="h-3.5 w-3.5" />}
              accent="emerald"
              testId="stat-real-komisi-bulan-ini"
            />
          </>
        )}
      </div>

      {/* ============================================================
          PERBAIKAN #4: GRAFIK PERFORMA HARIAN (TAB DATA GMV)
          Kombinasi BAR (GMV) + LINE (Est. Komisi)
      ============================================================ */}
      {activeTab === 'GMV' && (
        <div className="mt-7 rounded-2xl border border-white/[0.08] bg-[#111623] p-5 sm:p-6" data-testid="grafik-performa-harian">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.07] pb-4 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-cyan-400" />
                <h2 className="font-display text-base font-semibold text-white">
                  Grafik Performa Harian
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Kombinasi tren harian GMV (Bar) &amp; Estimasi Komisi (Line) ·{' '}
                <span className="text-cyan-300 font-semibold">
                  {selectedMonthStr ? formatBulanTahun(selectedMonthStr) : 'Semua Data Terpilih'}
                </span>
              </p>
            </div>

            {/* Legend & Summary Badges */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300">
                <span className="h-2.5 w-2.5 rounded-sm bg-cyan-400" />
                <span>GMV Harian: {formatRupiah(totals.gmvBulan)}</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-purple-500/20 bg-purple-500/10 px-3 py-1.5 text-xs font-semibold text-purple-300">
                <span className="h-2.5 w-2.5 rounded-full bg-purple-400" />
                <span>Est. Komisi: {formatRupiah(totals.estBulan)}</span>
              </div>
            </div>
          </div>

          {/* Chart Rendering */}
          <div className="w-full h-[300px] sm:h-[340px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gmvBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06B6D4" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#0891B2" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey="dayLabel"
                    stroke="#64748B"
                    tick={{ fill: '#94A3B8', fontSize: 11 }}
                    tickLine={{ stroke: '#334155' }}
                    axisLine={{ stroke: '#334155' }}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="#64748B"
                    tick={{ fill: '#06B6D4', fontSize: 10 }}
                    tickLine={{ stroke: '#334155' }}
                    axisLine={{ stroke: '#334155' }}
                    tickFormatter={(val) =>
                      val >= 1000000
                        ? `${(val / 1000000).toFixed(val % 1000000 === 0 ? 0 : 1)} jt`
                        : val >= 1000
                        ? `${(val / 1000).toFixed(0)} rb`
                        : `${val}`
                    }
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#64748B"
                    tick={{ fill: '#C084FC', fontSize: 10 }}
                    tickLine={{ stroke: '#334155' }}
                    axisLine={{ stroke: '#334155' }}
                    tickFormatter={(val) =>
                      val >= 1000000
                        ? `${(val / 1000000).toFixed(val % 1000000 === 0 ? 0 : 1)} jt`
                        : val >= 1000
                        ? `${(val / 1000).toFixed(0)} rb`
                        : `${val}`
                    }
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload;
                        return (
                          <div className="rounded-xl border border-white/10 bg-[#070B14]/95 p-3.5 shadow-2xl backdrop-blur-md min-w-[210px]">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 border-b border-white/10 pb-2 mb-2">
                              <CalendarDays className="h-3.5 w-3.5 text-cyan-400" />
                              <span>{item.formattedDate || item.date}</span>
                            </div>
                            <div className="space-y-1.5 text-xs">
                              <div className="flex items-center justify-between gap-4">
                                <span className="flex items-center gap-1.5 text-slate-400">
                                  <span className="h-2.5 w-2.5 rounded-sm bg-cyan-400" />
                                  GMV:
                                </span>
                                <span className="font-bold text-cyan-300">{formatRupiah(item.gmv)}</span>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span className="flex items-center gap-1.5 text-slate-400">
                                  <span className="h-2.5 w-2.5 rounded-full bg-purple-400" />
                                  Est. Komisi:
                                </span>
                                <span className="font-bold text-violet-300">{formatRupiah(item.estimatedCommission)}</span>
                              </div>
                              {item.itemSold > 0 && (
                                <div className="flex items-center justify-between gap-4 pt-1 border-t border-white/5 text-[11px] text-slate-400">
                                  <span>Item Sold:</span>
                                  <span className="font-medium text-slate-200">{item.itemSold.toLocaleString('id-ID')}</span>
                                </div>
                              )}
                              {item.productImpression > 0 && (
                                <div className="flex items-center justify-between gap-4 text-[11px] text-slate-400">
                                  <span>Impression:</span>
                                  <span className="font-medium text-slate-200">{item.productImpression.toLocaleString('id-ID')}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="gmv"
                    name="GMV Harian"
                    fill="url(#gmvBarGradient)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="estimatedCommission"
                    name="Est. Komisi Harian"
                    stroke="#A855F7"
                    strokeWidth={2.5}
                    dot={{ r: 2.5, fill: '#A855F7' }}
                    activeDot={{ r: 6, fill: '#C084FC', stroke: '#ffffff', strokeWidth: 1.5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-slate-500 text-xs">
                <BarChart3 className="h-8 w-8 text-slate-600 mb-2" />
                <span>Belum ada data performa untuk ditampilkan pada grafik</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================
          MAIN BODY: FORM (LEFT) & TABLE (RIGHT)
      ============================================================ */}
      <div className="mt-7 grid min-w-0 gap-6 xl:grid-cols-[420px_1fr]">
        {/* Form column */}
        {canInput && (
          <div className="min-w-0 rounded-2xl border border-white/[0.08] bg-[#111623] p-5 sm:p-6">
            {loadingAccounts ? (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Memuat akun...
              </div>
            ) : accounts.length === 0 ? (
              <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-300">
                Belum ada akun medsos yang menjadi tanggung jawab Anda. Hubungi Owner untuk
                menetapkan akun pada Data Karyawan.
              </div>
            ) : activeTab === 'GMV' ? (
              <form onSubmit={handleSaveGmv} className="space-y-5" data-testid="form-data-gmv">
                <div>
                  <h2 className="font-display text-lg font-semibold text-white">
                    Input Data GMV
                  </h2>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-400">
                    Performa penjualan dan komisi yang masih bersifat estimasi.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Tanggal *</label>
                    <input
                      type="date"
                      required
                      value={gmvForm.date}
                      onChange={(e) => setGmvForm({ ...gmvForm, date: e.target.value })}
                      className="kdrt-input"
                      data-testid="gmv-date-input"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Akun Medsos *</label>
                    {accountSelect(
                      gmvForm.accountId,
                      (v) => setGmvForm({ ...gmvForm, accountId: v }),
                      'gmv-account-select'
                    )}
                  </div>
                </div>

                <div>
                  <label className={labelClass}>GMV (Rp) *</label>
                  <CurrencyInput
                    required
                    value={gmvForm.gmv}
                    onChange={(val) => setGmvForm({ ...gmvForm, gmv: val })}
                    className="kdrt-input font-display text-base font-semibold"
                    placeholder="Rp 0"
                    data-testid="gmv-amount-input"
                  />
                </div>

                <div>
                  <label className={labelClass}>Estimasi Komisi (Rp) *</label>
                  <CurrencyInput
                    required
                    value={gmvForm.estimatedCommission}
                    onChange={(val) => setGmvForm({ ...gmvForm, estimatedCommission: val })}
                    className="kdrt-input font-display text-base font-semibold"
                    placeholder="Rp 0"
                    data-testid="gmv-estimated-commission-input"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Item Sold</label>
                    <input
                      type="number"
                      min="0"
                      value={gmvForm.itemSold}
                      onChange={(e) =>
                        setGmvForm({
                          ...gmvForm,
                          itemSold: e.target.value === '' ? '' : Number(e.target.value),
                        })
                      }
                      placeholder="0"
                      className="kdrt-input"
                      data-testid="gmv-item-sold-input"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Product Impression</label>
                    <input
                      type="number"
                      min="0"
                      value={gmvForm.productImpression}
                      onChange={(e) =>
                        setGmvForm({
                          ...gmvForm,
                          productImpression: e.target.value === '' ? '' : Number(e.target.value),
                        })
                      }
                      placeholder="0"
                      className="kdrt-input"
                      data-testid="gmv-impression-input"
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Catatan (Opsional)</label>
                  <input
                    type="text"
                    value={gmvForm.notes}
                    onChange={(e) => setGmvForm({ ...gmvForm, notes: e.target.value })}
                    placeholder="Keterangan performa harian..."
                    className="kdrt-input"
                    data-testid="gmv-notes-input"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="kdrt-btn-primary flex w-full items-center justify-center gap-2 px-4 py-3 text-sm disabled:opacity-60"
                  data-testid="gmv-submit-button"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                  {saving ? 'Menyimpan...' : 'Simpan Data GMV'}
                </button>

                <p className="text-[11px] leading-relaxed text-slate-500">
                  1 akun + 1 tanggal = 1 record. Menyimpan Data GMV tidak akan menghapus Komisi Real
                  yang sudah tercatat.
                </p>
              </form>
            ) : (
              <form onSubmit={handleSaveKomisi} className="space-y-5" data-testid="form-komisi-real">
                <div>
                  <h2 className="font-display text-lg font-semibold text-white">
                    Input Komisi Real
                  </h2>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-400">
                    Komisi yang sudah benar-benar masuk ke saldo akun dan siap dicairkan.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Tanggal *</label>
                    <input
                      type="date"
                      required
                      value={komisiForm.date}
                      onChange={(e) => setKomisiForm({ ...komisiForm, date: e.target.value })}
                      className="kdrt-input"
                      data-testid="komisi-date-input"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Akun Medsos *</label>
                    {accountSelect(
                      komisiForm.accountId,
                      (v) => setKomisiForm({ ...komisiForm, accountId: v }),
                      'komisi-account-select'
                    )}
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Komisi Real / Uang Masuk (Rp) *</label>
                  <CurrencyInput
                    required
                    value={komisiForm.realCommission}
                    onChange={(val) => setKomisiForm({ ...komisiForm, realCommission: val })}
                    className="kdrt-input font-display text-lg font-semibold text-emerald-300"
                    placeholder="Rp 0"
                    data-testid="komisi-amount-input"
                  />
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Scope otomatis mengikuti akun yang dipilih
                    {komisiForm.accountId ? ` (${scopeOf(komisiForm.accountId)})` : ''}.
                  </p>
                </div>

                <div>
                  <label className={labelClass}>Catatan (Opsional)</label>
                  <input
                    type="text"
                    value={komisiForm.notes}
                    onChange={(e) => setKomisiForm({ ...komisiForm, notes: e.target.value })}
                    placeholder="Keterangan penarikan, batch, nomor invoice..."
                    className="kdrt-input"
                    data-testid="komisi-notes-input"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="kdrt-btn-primary flex w-full items-center justify-center gap-2 px-4 py-3 text-sm disabled:opacity-60"
                  data-testid="komisi-submit-button"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                  {saving ? 'Menyimpan...' : 'Simpan Komisi Real'}
                </button>

                <p className="text-[11px] leading-relaxed text-slate-500">
                  Data GMV, Item Sold, dan Impression tetap aman dan tidak akan terhapus.
                </p>
              </form>
            )}
          </div>
        )}

        {/* Table column */}
        <div
          className={`min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111623] ${
            canInput ? '' : 'xl:col-span-2'
          }`}
        >
          {/* Table Header & Filters */}
          <div className="border-b border-white/[0.07] p-4 sm:p-5 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-base font-semibold text-white">
                  {activeTab === 'GMV' ? 'Rekap Data GMV' : 'Rekap Komisi Real'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedMonthStr ? formatBulanTahun(selectedMonthStr) : 'Semua Periode'} ·{' '}
                  <span className="font-semibold text-cyan-300">{filteredRows.length} record</span>
                </p>
              </div>

              {/* Filters Bar: Account & Search */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Account Filter */}
                <select
                  value={selectedAccountFilter}
                  onChange={(e) => setSelectedAccountFilter(e.target.value)}
                  className="rounded-xl border border-white/10 bg-[#070B14] px-3 py-1.5 text-xs font-semibold text-slate-300 focus:border-cyan-400 focus:outline-none"
                >
                  <option value="ALL">Semua Akun Medsos</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.accountName}
                    </option>
                  ))}
                </select>

                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari akun, catatan..."
                    className="w-36 sm:w-44 rounded-xl border border-white/10 bg-[#070B14] pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Table View */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="bg-[#070B14]">
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Tanggal
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Akun
                  </th>
                  {activeTab === 'GMV' ? (
                    <>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        GMV
                      </th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Estimasi Komisi
                      </th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Item Sold
                      </th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Impression
                      </th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Estimasi Komisi
                      </th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Komisi Real
                      </th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Scope
                      </th>
                    </>
                  )}
                  {canInput && (
                    <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Aksi
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length > 0 ? (
                  filteredRows.map((p) => {
                    const realCommValue = getCommissionReal(p);

                    return (
                      <tr
                        key={p.id}
                        className="border-t border-white/[0.05] transition-colors hover:bg-white/[0.02]"
                        data-testid={`omset-row-${p.id}`}
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-white">
                          {formatTanggal(p.date)}
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          <div className="font-medium text-white">{p.accountName || '-'}</div>
                          {(p.notes || p.commissionNotes) && (
                            <div className="text-[11px] text-slate-500 truncate max-w-[180px]" title={p.notes || p.commissionNotes}>
                              {p.notes || p.commissionNotes}
                            </div>
                          )}
                        </td>
                        {activeTab === 'GMV' ? (
                          <>
                            <td className="px-4 py-3 text-right font-semibold text-white">
                              {p.gmv ? formatRupiah(p.gmv) : '-'}
                            </td>
                            <td className="px-4 py-3 text-right text-violet-300">
                              {p.estimatedCommission ? formatRupiah(p.estimatedCommission) : '-'}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-300">
                              {p.itemSold ? numberId(p.itemSold) : '-'}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-300">
                              {p.productImpression ? numberId(p.productImpression) : '-'}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3 text-right text-violet-300">
                              {p.estimatedCommission ? formatRupiah(p.estimatedCommission) : '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-emerald-300">
                              {realCommValue > 0 ? formatRupiah(realCommValue) : '-'}
                            </td>
                            <td className="px-4 py-3">
                              <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                {p.scope}
                              </span>
                            </td>
                          </>
                        )}
                        {canInput && (
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  if (activeTab === 'GMV') {
                                    handleOpenEditGmv(p);
                                  } else {
                                    handleOpenEditKomisi(p);
                                  }
                                }}
                                title="Edit data"
                                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-slate-300 hover:bg-cyan-500/20 hover:text-cyan-300 transition"
                                data-testid={`btn-edit-${p.id}`}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDeletingPerformance({
                                    record: p,
                                    type: activeTab,
                                  })
                                }
                                title="Hapus data"
                                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-slate-300 hover:bg-rose-500/20 hover:text-rose-300 transition"
                                data-testid={`btn-delete-${p.id}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={activeTab === 'GMV' ? (canInput ? 7 : 6) : canInput ? 6 : 5}
                      className="px-4 py-14 text-center"
                      data-testid="omset-empty-state"
                    >
                      <BarChart3 className="mx-auto mb-3 h-7 w-7 text-slate-600" />
                      <p className="text-sm font-medium text-slate-400">
                        Belum ada data untuk filter atau periode ini
                      </p>
                      <p className="mt-1 text-[12px] text-slate-500">
                        Mulai dengan menyimpan Data GMV atau Komisi Real di form sebelah.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ============================================================
          MODAL: EDIT DATA GMV
      ============================================================ */}
      {editGmvRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#111623] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
                  <Edit2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Edit Data GMV</h3>
                  <p className="text-xs text-slate-400">
                    {editGmvRecord.accountName} · {formatTanggal(editGmvRecord.date)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditGmvRecord(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditGmv} className="mt-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Tanggal *</label>
                  <input
                    type="date"
                    required
                    value={editFormState.date}
                    onChange={(e) => setEditFormState({ ...editFormState, date: e.target.value })}
                    className="kdrt-input text-xs"
                  />
                </div>
                <div>
                  <label className={labelClass}>Akun Medsos *</label>
                  {accountSelect(
                    editFormState.accountId,
                    (v) => setEditFormState({ ...editFormState, accountId: v }),
                    'edit-gmv-account-select'
                  )}
                </div>
              </div>

              <div>
                <label className={labelClass}>GMV (Rp) *</label>
                <CurrencyInput
                  required
                  value={editFormState.gmv}
                  onChange={(val) => setEditFormState({ ...editFormState, gmv: val })}
                  className="kdrt-input font-display text-base font-semibold"
                  placeholder="Rp 0"
                />
              </div>

              <div>
                <label className={labelClass}>Estimasi Komisi (Rp) *</label>
                <CurrencyInput
                  required
                  value={editFormState.estimatedCommission}
                  onChange={(val) => setEditFormState({ ...editFormState, estimatedCommission: val })}
                  className="kdrt-input font-display text-base font-semibold"
                  placeholder="Rp 0"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Item Sold</label>
                  <input
                    type="number"
                    min="0"
                    value={editFormState.itemSold}
                    onChange={(e) =>
                      setEditFormState({
                        ...editFormState,
                        itemSold: e.target.value === '' ? '' : Number(e.target.value),
                      })
                    }
                    placeholder="0"
                    className="kdrt-input text-xs"
                  />
                </div>
                <div>
                  <label className={labelClass}>Product Impression</label>
                  <input
                    type="number"
                    min="0"
                    value={editFormState.productImpression}
                    onChange={(e) =>
                      setEditFormState({
                        ...editFormState,
                        productImpression: e.target.value === '' ? '' : Number(e.target.value),
                      })
                    }
                    placeholder="0"
                    className="kdrt-input text-xs"
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Catatan (Opsional)</label>
                <input
                  type="text"
                  value={editFormState.notes}
                  onChange={(e) => setEditFormState({ ...editFormState, notes: e.target.value })}
                  placeholder="Keterangan performa harian..."
                  className="kdrt-input text-xs"
                />
              </div>

              <div className="rounded-xl border border-white/5 bg-[#070B14] p-3 text-[11px] text-slate-400">
                💡 <span className="text-slate-300 font-medium">Catatan:</span> Menyimpan perubahan Data GMV tidak akan mengubah atau menghapus Komisi Real yang sudah tercatat pada akun ini.
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setEditGmvRecord(null)}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/10 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="kdrt-btn-primary flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <TrendingUp className="h-3.5 w-3.5" />
                      <span>Simpan Perubahan GMV</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL: EDIT KOMISI REAL
      ============================================================ */}
      {editKomisiRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#111623] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                  <Edit2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Edit Komisi Real</h3>
                  <p className="text-xs text-slate-400">
                    {editKomisiRecord.accountName} · {formatTanggal(editKomisiRecord.date)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditKomisiRecord(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditKomisi} className="mt-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Tanggal *</label>
                  <input
                    type="date"
                    required
                    value={editFormState.date}
                    onChange={(e) => setEditFormState({ ...editFormState, date: e.target.value })}
                    className="kdrt-input text-xs"
                  />
                </div>
                <div>
                  <label className={labelClass}>Akun Medsos *</label>
                  {accountSelect(
                    editFormState.accountId,
                    (v) => setEditFormState({ ...editFormState, accountId: v }),
                    'edit-komisi-account-select'
                  )}
                </div>
              </div>

              <div>
                <label className={labelClass}>Komisi Real / Uang Masuk (Rp) *</label>
                <CurrencyInput
                  required
                  value={editFormState.commissionReal}
                  onChange={(val) => setEditFormState({ ...editFormState, commissionReal: val })}
                  className="kdrt-input font-display text-lg font-semibold text-emerald-300"
                  placeholder="Rp 0"
                />
              </div>

              <div>
                <label className={labelClass}>Catatan (Opsional)</label>
                <input
                  type="text"
                  value={editFormState.notes}
                  onChange={(e) => setEditFormState({ ...editFormState, notes: e.target.value })}
                  placeholder="Keterangan penarikan, batch, invoice..."
                  className="kdrt-input text-xs"
                />
              </div>

              <div className="rounded-xl border border-white/5 bg-[#070B14] p-3 text-[11px] text-slate-400">
                🛡️ <span className="text-slate-300 font-medium">Performa Akun:</span> Komisi Real mencatat performa saldo akun dan tidak secara otomatis membuat mutasi Kas &amp; Bank sampai dilakukan Pindah Dana.
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setEditKomisiRecord(null)}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/10 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="kdrt-btn-primary flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Wallet className="h-3.5 w-3.5" />
                      <span>Simpan Perubahan Komisi</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL: KONFIRMASI HAPUS DATA OMSET
      ============================================================ */}
      {deletingPerformance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#111623] p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/15 border border-rose-500/30">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Hapus Data {deletingPerformance.type === 'GMV' ? 'GMV' : 'Komisi Real'}?
                </h3>
                <p className="text-xs text-slate-400">Tindakan ini akan menghapus record dari Firebase.</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-white/5 bg-[#070B14] p-4 text-xs space-y-2 text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">Akun:</span>
                <span className="font-bold text-white">
                  {deletingPerformance.record.accountName || deletingPerformance.record.accountId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tanggal:</span>
                <span className="font-bold text-white">
                  {formatTanggal(deletingPerformance.record.date)}
                </span>
              </div>
              {deletingPerformance.record.gmv ? (
                <div className="flex justify-between">
                  <span className="text-slate-500">GMV:</span>
                  <span className="font-mono font-bold text-cyan-300">
                    {formatRupiah(deletingPerformance.record.gmv)}
                  </span>
                </div>
              ) : null}
              {getCommissionReal(deletingPerformance.record) > 0 ? (
                <div className="flex justify-between">
                  <span className="text-slate-500">Komisi Real:</span>
                  <span className="font-mono font-bold text-emerald-300">
                    {formatRupiah(getCommissionReal(deletingPerformance.record))}
                  </span>
                </div>
              ) : null}
            </div>

            <p className="mt-3 text-[11px] text-slate-500 leading-relaxed">
              Setelah dihapus, semua statistik bulanan dan grafik performa akan otomatis dihitung ulang dari data terbaru.
            </p>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeletingPerformance(null)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 transition"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 transition disabled:opacity-60"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Ya, Hapus Data</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
