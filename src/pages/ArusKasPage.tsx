import React, { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  Percent,
  Wallet,
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Landmark,
  FileText,
  X,
  ArrowUpRight,
  RefreshCw,
  Eye,
  Building2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  DailyPerformance,
  FinancialReconciliation,
  Account,
  ScopeType,
} from '../types';
import {
  subscribeDailyPerformance,
  updateDailyPerformanceFull,
  saveOmsetData,
  saveKomisiReal,
  deleteKomisiRealAtomic,
} from '../services/performanceService';
import {
  subscribeReconciliations,
  createReconciliation,
  updateReconciliation,
  deleteReconciliation,
} from '../services/transactionService';
import { subscribeAccounts } from '../services/accountService';
import {
  formatRupiah,
  formatTanggal,
  tanggalHariIni,
  bulanHariIni,
  formatBulanTahun,
} from '../utils/formatters';
import { CurrencyInput } from '../components/CurrencyInput';

export const ArusKasPage: React.FC = () => {
  const { currentUser, userProfile, role } = useAuth();
  const isOwner = role === 'OWNER';
  const isManager = role === 'MANAGER' || isOwner;

  // Selected Month Period: YYYY-MM (e.g. "2026-08")
  const [selectedPeriod, setSelectedPeriod] = useState<string>(bulanHariIni());

  // Data from Firestore
  const [performanceList, setPerformanceList] = useState<DailyPerformance[]>([]);
  const [reconciliationList, setReconciliationList] = useState<FinancialReconciliation[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  // Active view toggle when GMV panel is clicked
  const [showDailyGmvDetail, setShowDailyGmvDetail] = useState(true);
  const [showBankDetail, setShowBankDetail] = useState(true);

  // Scope filter (SEMUA / SHARING / PRIBADI)
  const [scopeFilter, setScopeFilter] = useState<'ALL' | ScopeType>('ALL');

  // Modals state
  const [isPerformanceModalOpen, setIsPerformanceModalOpen] = useState(false);
  const [editingPerformance, setEditingPerformance] = useState<DailyPerformance | null>(null);

  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [editingReconciliation, setEditingReconciliation] = useState<FinancialReconciliation | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    type: 'PERFORMANCE' | 'RECONCILIATION';
    id: string;
    label: string;
    data?: any;
  }>({
    isOpen: false,
    type: 'PERFORMANCE',
    id: '',
    label: '',
  });

  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Performance Form State
  const [perfForm, setPerfForm] = useState({
    date: tanggalHariIni(),
    accountId: '',
    accountName: '',
    scope: 'SHARING' as ScopeType,
    gmv: '' as number | '',
    estimatedCommission: '' as number | '',
    commissionReal: '' as number | '',
    itemSold: '' as number | '',
    productImpression: '' as number | '',
    notes: '',
  });

  // Bank Reconciliation Form State
  const [bankForm, setBankForm] = useState({
    date: tanggalHariIni(),
    accountName: '',
    scope: 'SHARING' as ScopeType,
    actualBalance: '' as number | '',
    notes: '',
  });

  // Auto-dismiss notifications
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Subscriptions to Firestore
  useEffect(() => {
    setLoading(true);
    const unsubPerf = subscribeDailyPerformance(undefined, (data) => {
      setPerformanceList(data);
      setLoading(false);
    });

    const unsubRecon = subscribeReconciliations((data) => {
      setReconciliationList(data);
    });

    const unsubAcc = subscribeAccounts(undefined, (data) => {
      setAccounts(data);
    });

    return () => {
      unsubPerf();
      unsubRecon();
      unsubAcc();
    };
  }, []);

  // Filtered performance records by selected month period & scope
  const filteredPerformance = useMemo(() => {
    return performanceList.filter((item) => {
      if (!item.date || !item.date.startsWith(selectedPeriod)) {
        return false;
      }
      if (scopeFilter !== 'ALL' && item.scope !== scopeFilter) {
        return false;
      }
      return true;
    });
  }, [performanceList, selectedPeriod, scopeFilter]);

  // Filtered reconciliation (Saldo Kas & Bank)
  const filteredReconciliations = useMemo(() => {
    return reconciliationList.filter((item) => {
      if (scopeFilter !== 'ALL' && item.scope !== scopeFilter && item.scope !== 'ALL') {
        return false;
      }
      return true;
    });
  }, [reconciliationList, scopeFilter]);

  // 1. GMV BULAN INI
  const totalGmvBulanIni = useMemo(() => {
    return filteredPerformance.reduce((sum, item) => sum + (Number(item.gmv) || 0), 0);
  }, [filteredPerformance]);

  // 2. TOTAL EST. KOMISI
  const totalEstKomisi = useMemo(() => {
    return filteredPerformance.reduce(
      (sum, item) => sum + (Number(item.estimatedCommission) || 0),
      0
    );
  }, [filteredPerformance]);

  // 3. TOTAL KOMISI REAL
  const totalKomisiReal = useMemo(() => {
    return filteredPerformance.reduce(
      (sum, item) =>
        sum + (Number(item.commissionReal ?? (item as any).realCommission ?? 0) || 0),
      0
    );
  }, [filteredPerformance]);

  // 4. SALDO KAS & BANK (Input Manual: latest recorded balance per account)
  const latestBankBalances = useMemo(() => {
    const map = new Map<string, FinancialReconciliation>();
    // reconciliationList is sorted descending by date
    filteredReconciliations.forEach((item) => {
      const acc = item.accountName?.trim() || 'Kas / Bank';
      if (!map.has(acc)) {
        map.set(acc, item);
      }
    });
    return Array.from(map.values());
  }, [filteredReconciliations]);

  const totalSaldoKasBank = useMemo(() => {
    return latestBankBalances.reduce(
      (sum, item) => sum + (Number(item.actualBalance) || 0),
      0
    );
  }, [latestBankBalances]);

  // Group performance by date for Daily GMV breakdown
  const dailyGmvBreakdown = useMemo(() => {
    const groups: {
      [date: string]: {
        date: string;
        totalGmv: number;
        totalEstComm: number;
        totalRealComm: number;
        records: DailyPerformance[];
      };
    } = {};

    filteredPerformance.forEach((p) => {
      const dateKey = p.date || '';
      if (!groups[dateKey]) {
        groups[dateKey] = {
          date: dateKey,
          totalGmv: 0,
          totalEstComm: 0,
          totalRealComm: 0,
          records: [],
        };
      }
      groups[dateKey].totalGmv += Number(p.gmv) || 0;
      groups[dateKey].totalEstComm += Number(p.estimatedCommission) || 0;
      groups[dateKey].totalRealComm += Number(p.commissionReal ?? (p as any).realCommission ?? 0);
      groups[dateKey].records.push(p);
    });

    return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredPerformance]);

  // Available Month Periods for selector (recent 12 months)
  const availablePeriods = useMemo(() => {
    const set = new Set<string>();
    // include currently selected period
    set.add(selectedPeriod);
    set.add(bulanHariIni());

    // include periods from existing performance data
    performanceList.forEach((p) => {
      if (p.date && p.date.length >= 7) {
        set.add(p.date.substring(0, 7));
      }
    });

    // include last 12 months
    const today = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      set.add(`${yyyy}-${mm}`);
    }

    return Array.from(set).sort().reverse();
  }, [performanceList, selectedPeriod]);

  // Period navigation helpers
  const handlePrevMonth = () => {
    const [y, m] = selectedPeriod.split('-').map(Number);
    const prev = new Date(y, m - 2, 1);
    const yyyy = prev.getFullYear();
    const mm = String(prev.getMonth() + 1).padStart(2, '0');
    setSelectedPeriod(`${yyyy}-${mm}`);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedPeriod.split('-').map(Number);
    const next = new Date(y, m, 1);
    const yyyy = next.getFullYear();
    const mm = String(next.getMonth() + 1).padStart(2, '0');
    setSelectedPeriod(`${yyyy}-${mm}`);
  };

  // Open Performance Modal for Create or Edit
  const handleOpenPerformanceModal = (perf?: DailyPerformance) => {
    if (perf) {
      setEditingPerformance(perf);
      setPerfForm({
        date: perf.date || tanggalHariIni(),
        accountId: perf.accountId || '',
        accountName: perf.accountName || '',
        scope: perf.scope || 'SHARING',
        gmv: perf.gmv ?? '',
        estimatedCommission: perf.estimatedCommission ?? '',
        commissionReal: (perf.commissionReal ?? (perf as any).realCommission) ?? '',
        itemSold: perf.itemSold ?? '',
        productImpression: perf.productImpression ?? '',
        notes: perf.notes || '',
      });
    } else {
      setEditingPerformance(null);
      const defaultAcc = accounts[0];
      setPerfForm({
        date: `${selectedPeriod}-01` <= tanggalHariIni() ? tanggalHariIni() : `${selectedPeriod}-01`,
        accountId: defaultAcc ? defaultAcc.id! : '',
        accountName: defaultAcc ? defaultAcc.accountName : '',
        scope: defaultAcc ? defaultAcc.scope : 'SHARING',
        gmv: '',
        estimatedCommission: '',
        commissionReal: '',
        itemSold: '',
        productImpression: '',
        notes: '',
      });
    }
    setIsPerformanceModalOpen(true);
  };

  // Save Performance Data
  const handleSavePerformance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userProfile) return;

    if (!perfForm.date) {
      setNotification({ type: 'error', message: 'Tanggal wajib diisi.' });
      return;
    }
    if (!perfForm.accountId && !perfForm.accountName) {
      setNotification({ type: 'error', message: 'Akun TikTok / Medsos wajib dipilih.' });
      return;
    }

    try {
      setActionLoading(true);
      const gmvNum = typeof perfForm.gmv === 'number' ? perfForm.gmv : 0;
      const estCommNum = typeof perfForm.estimatedCommission === 'number' ? perfForm.estimatedCommission : 0;
      const realCommNum = typeof perfForm.commissionReal === 'number' ? perfForm.commissionReal : 0;

      if (editingPerformance && editingPerformance.id) {
        // Direct update
        await updateDailyPerformanceFull(
          editingPerformance.id,
          {
            date: perfForm.date,
            accountId: perfForm.accountId,
            accountName: perfForm.accountName,
            scope: perfForm.scope,
            gmv: gmvNum,
            estimatedCommission: estCommNum,
            commissionReal: realCommNum,
            realCommission: realCommNum,
            itemSold: Number(perfForm.itemSold) || 0,
            productImpression: Number(perfForm.productImpression) || 0,
            notes: perfForm.notes.trim(),
          },
          currentUser.uid,
          userProfile.name
        );
        setNotification({
          type: 'success',
          message: 'Data performa GMV dan Komisi berhasil diperbarui.',
        });
      } else {
        // Create new or save
        await saveOmsetData(
          {
            date: perfForm.date,
            accountId: perfForm.accountId,
            accountName: perfForm.accountName,
            scope: perfForm.scope,
            gmv: gmvNum,
            estimatedCommission: estCommNum,
            itemSold: Number(perfForm.itemSold) || 0,
            productImpression: Number(perfForm.productImpression) || 0,
            notes: perfForm.notes.trim(),
          },
          currentUser.uid,
          userProfile.name
        );

        if (realCommNum > 0) {
          await saveKomisiReal(
            {
              date: perfForm.date,
              accountId: perfForm.accountId,
              accountName: perfForm.accountName,
              scope: perfForm.scope,
              commissionReal: realCommNum,
              realCommission: realCommNum,
            },
            currentUser.uid,
            userProfile.name
          );
        }

        setNotification({
          type: 'success',
          message: 'Data performa GMV baru berhasil disimpan.',
        });
      }

      setIsPerformanceModalOpen(false);
      setEditingPerformance(null);
    } catch (err: any) {
      console.error('Error saving performance:', err);
      setNotification({
        type: 'error',
        message: err.message || 'Gagal menyimpan data performa.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Open Bank Modal for Create or Edit
  const handleOpenBankModal = (recon?: FinancialReconciliation) => {
    if (recon) {
      setEditingReconciliation(recon);
      setBankForm({
        date: recon.date || tanggalHariIni(),
        accountName: recon.accountName || '',
        scope: recon.scope === 'ALL' ? 'SHARING' : recon.scope || 'SHARING',
        actualBalance: recon.actualBalance ?? '',
        notes: recon.notes || '',
      });
    } else {
      setEditingReconciliation(null);
      setBankForm({
        date: tanggalHariIni(),
        accountName: 'BCA PT KDRT',
        scope: 'SHARING',
        actualBalance: '',
        notes: '',
      });
    }
    setIsBankModalOpen(true);
  };

  // Save Bank / Cash Balance
  const handleSaveBankBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userProfile) return;

    if (!bankForm.accountName.trim()) {
      setNotification({ type: 'error', message: 'Nama Rekening / Kas wajib diisi.' });
      return;
    }
    if (bankForm.actualBalance === '') {
      setNotification({ type: 'error', message: 'Nominal saldo aktual wajib diisi.' });
      return;
    }

    try {
      setActionLoading(true);
      const balanceNum = typeof bankForm.actualBalance === 'number' ? bankForm.actualBalance : 0;
      const periodLabel = formatBulanTahun(bankForm.date.substring(0, 7));

      if (editingReconciliation && editingReconciliation.id) {
        await updateReconciliation(
          editingReconciliation.id,
          {
            date: bankForm.date,
            periodLabel,
            accountName: bankForm.accountName.trim(),
            scope: bankForm.scope,
            actualBalance: balanceNum,
            systemBalance: editingReconciliation.systemBalance || 0,
            notes: bankForm.notes.trim(),
          },
          currentUser.uid,
          userProfile.name
        );
        setNotification({
          type: 'success',
          message: 'Saldo Kas & Bank berhasil diperbarui.',
        });
      } else {
        await createReconciliation(
          {
            date: bankForm.date,
            periodLabel,
            accountName: bankForm.accountName.trim(),
            scope: bankForm.scope,
            systemBalance: 0,
            actualBalance: balanceNum,
            difference: 0,
            status: 'SEIMBANG',
            notes: bankForm.notes.trim() || 'Input saldo manual kas & bank aktual.',
            createdBy: currentUser.uid,
            createdByName: userProfile.name,
          },
          currentUser.uid,
          userProfile.name
        );
        setNotification({
          type: 'success',
          message: 'Pencatatan Saldo Kas & Bank berhasil disimpan.',
        });
      }

      setIsBankModalOpen(false);
      setEditingReconciliation(null);
    } catch (err: any) {
      console.error('Error saving bank balance:', err);
      setNotification({
        type: 'error',
        message: err.message || 'Gagal menyimpan saldo kas & bank.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Confirm Delete Handler
  const handleExecuteDelete = async () => {
    if (!currentUser || !userProfile || !deleteConfirm.id) return;

    try {
      setActionLoading(true);
      if (deleteConfirm.type === 'PERFORMANCE') {
        await deleteKomisiRealAtomic(
          deleteConfirm.id,
          'Dihapus manual dari dashboard Laporan Keuangan',
          currentUser.uid,
          userProfile.name
        );
        setNotification({
          type: 'success',
          message: 'Data performa harian berhasil dihapus.',
        });
      } else if (deleteConfirm.type === 'RECONCILIATION') {
        await deleteReconciliation(
          deleteConfirm.id,
          deleteConfirm.data,
          currentUser.uid,
          userProfile.name
        );
        setNotification({
          type: 'success',
          message: 'Data saldo kas & bank berhasil dihapus.',
        });
      }
      setDeleteConfirm({ isOpen: false, type: 'PERFORMANCE', id: '', label: '' });
    } catch (err: any) {
      console.error('Error deleting record:', err);
      setNotification({
        type: 'error',
        message: err.message || 'Gagal menghapus data.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ============================================================
          TOP CONTROLS: PERIODE BULAN & QUICK ACTIONS
      ============================================================ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[#1E2637] bg-[#111726] p-4 lg:p-5 shadow-sm">
        {/* Periode Bulan Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 uppercase tracking-wider">
            <Calendar className="h-4 w-4 text-[#00E5FF]" />
            <span>PERIODE:</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              title="Bulan Sebelumnya"
              className="p-1.5 rounded-lg border border-[#1E2637] bg-[#0B0F19] text-zinc-300 hover:text-white hover:bg-[#1E2637] transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="relative">
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="appearance-none rounded-xl border border-[#00E5FF]/40 bg-[#0B0F19] py-2 pl-3.5 pr-8 text-sm font-bold text-[#00E5FF] focus:border-[#00E5FF] focus:outline-none focus:ring-1 focus:ring-[#00E5FF] shadow-inner cursor-pointer"
              >
                {availablePeriods.map((period) => (
                  <option key={period} value={period} className="bg-[#111726] text-white">
                    {formatBulanTahun(period).toUpperCase()}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#00E5FF]" />
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              title="Bulan Berikutnya"
              className="p-1.5 rounded-lg border border-[#1E2637] bg-[#0B0F19] text-zinc-300 hover:text-white hover:bg-[#1E2637] transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Scope Filter Buttons */}
          <div className="ml-2 flex items-center rounded-xl border border-[#1E2637] bg-[#0B0F19] p-1 text-xs">
            <button
              type="button"
              onClick={() => setScopeFilter('ALL')}
              className={`rounded-lg px-2.5 py-1 font-bold transition-colors ${
                scopeFilter === 'ALL'
                  ? 'bg-[#1E2637] text-[#00E5FF]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              SEMUA
            </button>
            <button
              type="button"
              onClick={() => setScopeFilter('SHARING')}
              className={`rounded-lg px-2.5 py-1 font-bold transition-colors ${
                scopeFilter === 'SHARING'
                  ? 'bg-purple-950/70 border border-purple-800/60 text-purple-300'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              SHARING
            </button>
            <button
              type="button"
              onClick={() => setScopeFilter('PRIBADI')}
              className={`rounded-lg px-2.5 py-1 font-bold transition-colors ${
                scopeFilter === 'PRIBADI'
                  ? 'bg-emerald-950/70 border border-emerald-800/60 text-emerald-300'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              PRIBADI
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        {isManager && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenBankModal()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-3.5 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-900/60 transition-all shadow-sm"
            >
              <Plus className="h-3.5 w-3.5 text-emerald-400" />
              <span>Input Saldo Kas & Bank</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenPerformanceModal()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#00E5FF]/40 bg-[#00E5FF]/10 px-3.5 py-2 text-xs font-bold text-[#00E5FF] hover:bg-[#00E5FF]/20 transition-all shadow-sm"
            >
              <Plus className="h-3.5 w-3.5 text-[#00E5FF]" />
              <span>Input GMV / Omset</span>
            </button>
          </div>
        )}
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium ${
            notification.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-950/50 text-emerald-200'
              : 'border-rose-500/30 bg-rose-950/50 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-400" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-zinc-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ============================================================
          1. DASHBOARD KEUANGAN UTAMA (4 PANEL EXACT ORDER)
          1. GMV BULAN INI (Clickable to show daily detail)
          2. TOTAL EST. KOMISI
          3. TOTAL KOMISI REAL
          4. SALDO KAS & BANK (Manual Input)
      ============================================================ */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* PANEL 1: GMV BULAN INI (CLICKABLE) */}
        <div
          onClick={() => setShowDailyGmvDetail((prev) => !prev)}
          className={`group relative overflow-hidden rounded-2xl border p-5 transition-all cursor-pointer select-none ${
            showDailyGmvDetail
              ? 'border-[#00E5FF] bg-gradient-to-b from-[#111726] to-[#0d1627] shadow-[0_0_20px_rgba(0,229,255,0.15)] ring-1 ring-[#00E5FF]/50'
              : 'border-[#1E2637] bg-[#111726] hover:border-[#00E5FF]/60 hover:bg-[#141d30]'
          }`}
        >
          <div className="flex items-center justify-between pb-3">
            <span className="text-xs font-black tracking-wider text-zinc-400 uppercase">
              1. GMV BULAN INI
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00E5FF]/10 text-[#00E5FF] group-hover:scale-110 transition-transform">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-2xl font-black tracking-tight text-white group-hover:text-[#00E5FF] transition-colors">
              {formatRupiah(totalGmvBulanIni)}
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] font-medium text-zinc-400">
                {formatBulanTahun(selectedPeriod)}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#00E5FF] group-hover:underline">
                {showDailyGmvDetail ? 'Tutup Detail ▲' : 'Klik Detail Harian ▼'}
              </span>
            </div>
          </div>

          <div className="mt-3 border-t border-[#1E2637] pt-2.5 flex items-center justify-between text-[11px] text-zinc-400">
            <span>Total Catatan:</span>
            <span className="font-bold text-zinc-200">{filteredPerformance.length} Record</span>
          </div>
        </div>

        {/* PANEL 2: TOTAL EST. KOMISI */}
        <div className="relative overflow-hidden rounded-2xl border border-[#1E2637] bg-[#111726] p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3">
            <span className="text-xs font-black tracking-wider text-zinc-400 uppercase">
              2. TOTAL EST. KOMISI
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
              <Percent className="h-5 w-5" />
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-2xl font-black tracking-tight text-amber-400">
              {formatRupiah(totalEstKomisi)}
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] font-medium text-zinc-400">
                Estimasi Dashboard
              </span>
              <span className="text-[11px] font-bold text-amber-400/80">
                {totalGmvBulanIni > 0
                  ? `${((totalEstKomisi / totalGmvBulanIni) * 100).toFixed(1)}% GMV`
                  : '0% GMV'}
              </span>
            </div>
          </div>

          <div className="mt-3 border-t border-[#1E2637] pt-2.5 flex items-center justify-between text-[11px] text-zinc-400">
            <span>Status:</span>
            <span className="font-bold text-amber-300">Estimasi Masuk</span>
          </div>
        </div>

        {/* PANEL 3: TOTAL KOMISI REAL */}
        <div className="relative overflow-hidden rounded-2xl border border-[#1E2637] bg-[#111726] p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3">
            <span className="text-xs font-black tracking-wider text-zinc-400 uppercase">
              3. TOTAL KOMISI REAL
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-2xl font-black tracking-tight text-emerald-400">
              {formatRupiah(totalKomisiReal)}
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] font-medium text-zinc-400">
                Tercatat di Sistem
              </span>
              <span className="text-[11px] font-bold text-emerald-400/80">
                {totalGmvBulanIni > 0
                  ? `${((totalKomisiReal / totalGmvBulanIni) * 100).toFixed(1)}% GMV`
                  : '0% GMV'}
              </span>
            </div>
          </div>

          <div className="mt-3 border-t border-[#1E2637] pt-2.5 flex items-center justify-between text-[11px] text-zinc-400">
            <span>Status:</span>
            <span className="font-bold text-emerald-300">Komisi Bersih</span>
          </div>
        </div>

        {/* PANEL 4: SALDO KAS & BANK (INPUT MANUAL) */}
        <div className="relative overflow-hidden rounded-2xl border border-[#1E2637] bg-[#111726] p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3">
            <span className="text-xs font-black tracking-wider text-zinc-400 uppercase">
              4. SALDO KAS & BANK
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
              <Wallet className="h-5 w-5" />
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-2xl font-black tracking-tight text-purple-300">
              {formatRupiah(totalSaldoKasBank)}
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] font-medium text-zinc-400">
                Saldo Riil Perusahaan
              </span>
              <span className="rounded bg-purple-950/70 px-1.5 py-0.5 text-[10px] font-bold text-purple-300 border border-purple-800/40">
                Input Manual
              </span>
            </div>
          </div>

          <div className="mt-3 border-t border-[#1E2637] pt-2.5 flex items-center justify-between text-[11px] text-zinc-400">
            <span>Rekening Terdata:</span>
            <span className="font-bold text-purple-200">{latestBankBalances.length} Rekening/Kas</span>
          </div>
        </div>
      </div>

      {/* ============================================================
          2. DETAIL GMV HARIAN PADA BULAN TERPILIH
      ============================================================ */}
      {showDailyGmvDetail && (
        <div className="space-y-4 rounded-2xl border border-[#1E2637] bg-[#111726] p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-[#1E2637] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-[#00E5FF]" />
                <h3 className="text-base font-black text-white">
                  Rincian GMV Harian — {formatBulanTahun(selectedPeriod)}
                </h3>
              </div>
              <p className="mt-0.5 text-xs text-zinc-400">
                Daftar performa GMV, estimasi komisi, dan komisi real per tanggal pada bulan yang dipilih.
              </p>
            </div>

            {isManager && (
              <button
                type="button"
                onClick={() => handleOpenPerformanceModal()}
                className="inline-flex items-center gap-1.5 self-start rounded-xl border border-[#00E5FF]/40 bg-[#00E5FF]/10 px-3 py-1.5 text-xs font-bold text-[#00E5FF] hover:bg-[#00E5FF]/20 transition-all"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ Tambah Data GMV Hari Ini</span>
              </button>
            )}
          </div>

          {dailyGmvBreakdown.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#1E2637] bg-[#0B0F19]/50 py-10 text-center">
              <TrendingUp className="mx-auto h-8 w-8 text-zinc-600 mb-2" />
              <p className="text-sm font-bold text-zinc-300">
                Belum ada data GMV untuk periode {formatBulanTahun(selectedPeriod)}.
              </p>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                Silakan ganti periode bulan di atas atau klik tombol input untuk mencatat data performa baru.
              </p>
              {isManager && (
                <button
                  type="button"
                  onClick={() => handleOpenPerformanceModal()}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#00E5FF] px-4 py-2 text-xs font-black text-black hover:bg-[#00E5FF]/90 transition-all"
                >
                  <Plus className="h-4 w-4" />
                  <span>Input Data GMV</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {dailyGmvBreakdown.map((day) => (
                <div
                  key={day.date}
                  className="overflow-hidden rounded-xl border border-[#1E2637] bg-[#0B0F19]/70 transition-all"
                >
                  {/* Daily Summary Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-[#141d30]/60 px-4 py-3 border-b border-[#1E2637]/60">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#00E5FF]/10 text-xs font-black text-[#00E5FF]">
                        {day.date.split('-')[2]}
                      </span>
                      <div>
                        <div className="text-sm font-black text-white">
                          {formatTanggal(day.date)}
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          {day.records.length} Akun TikTok tercatat
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      <div>
                        <span className="text-zinc-400">Total GMV: </span>
                        <span className="font-black text-[#00E5FF]">{formatRupiah(day.totalGmv)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-400">Est. Komisi: </span>
                        <span className="font-bold text-amber-400">{formatRupiah(day.totalEstComm)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-400">Komisi Real: </span>
                        <span className="font-bold text-emerald-400">{formatRupiah(day.totalRealComm)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Account Rows Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#1E2637]/40 text-zinc-400 font-bold bg-[#0B0F19]/30">
                          <th className="py-2.5 pl-4 pr-3">Akun Medsos</th>
                          <th className="px-3 py-2.5">Scope</th>
                          <th className="px-3 py-2.5 text-right">GMV</th>
                          <th className="px-3 py-2.5 text-right">Est. Komisi</th>
                          <th className="px-3 py-2.5 text-right">Komisi Real</th>
                          <th className="px-3 py-2.5">Catatan</th>
                          {isManager && <th className="py-2.5 pl-3 pr-4 text-right">Aksi</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1E2637]/30 text-zinc-200">
                        {day.records.map((rec) => (
                          <tr key={rec.id || `${rec.accountId}_${rec.date}`} className="hover:bg-[#111726]/80 transition-colors">
                            <td className="py-2.5 pl-4 pr-3 font-bold text-white">
                              {rec.accountName || rec.accountId}
                            </td>
                            <td className="px-3 py-2.5">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                  rec.scope === 'SHARING'
                                    ? 'bg-purple-950/80 text-purple-300 border border-purple-800/50'
                                    : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50'
                                }`}
                              >
                                {rec.scope || 'SHARING'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right font-black text-[#00E5FF]">
                              {formatRupiah(rec.gmv)}
                            </td>
                            <td className="px-3 py-2.5 text-right font-bold text-amber-400">
                              {formatRupiah(rec.estimatedCommission)}
                            </td>
                            <td className="px-3 py-2.5 text-right font-bold text-emerald-400">
                              {formatRupiah(rec.commissionReal ?? (rec as any).realCommission)}
                            </td>
                            <td className="px-3 py-2.5 text-zinc-400 truncate max-w-[150px]">
                              {rec.notes || '-'}
                            </td>
                            {isManager && (
                              <td className="py-2.5 pl-3 pr-4 text-right">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenPerformanceModal(rec)}
                                    title="Edit Record"
                                    className="rounded-lg p-1 text-zinc-400 hover:bg-[#1E2637] hover:text-[#00E5FF] transition-colors"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDeleteConfirm({
                                        isOpen: true,
                                        type: 'PERFORMANCE',
                                        id: rec.id || `PERFORMANCE_${rec.accountId}_${rec.date}`,
                                        label: `${rec.accountName || rec.accountId} (${formatTanggal(rec.date)})`,
                                      })
                                    }
                                    title="Hapus Record"
                                    className="rounded-lg p-1 text-zinc-400 hover:bg-rose-950/50 hover:text-rose-400 transition-colors"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          3. SALDO KAS & BANK (INPUT MANUAL & HISTORI)
      ============================================================ */}
      <div className="space-y-4 rounded-2xl border border-[#1E2637] bg-[#111726] p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-[#1E2637] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-purple-400" />
              <h3 className="text-base font-black text-white">
                Saldo Kas & Bank (Input Manual)
              </h3>
            </div>
            <p className="mt-0.5 text-xs text-zinc-400">
              Pencatatan manual saldo riil rekening bank dan kas tunai perusahaan. Nilai ini tidak otomatis diubah oleh GMV atau komisi.
            </p>
          </div>

          {isManager && (
            <button
              type="button"
              onClick={() => handleOpenBankModal()}
              className="inline-flex items-center gap-1.5 self-start rounded-xl border border-purple-500/40 bg-purple-950/40 px-3.5 py-2 text-xs font-bold text-purple-300 hover:bg-purple-900/60 transition-all shadow-sm"
            >
              <Plus className="h-3.5 w-3.5 text-purple-400" />
              <span>+ Input Saldo Baru</span>
            </button>
          )}
        </div>

        {/* Breakdown of latest balances by account */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {latestBankBalances.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed border-[#1E2637] bg-[#0B0F19]/50 py-8 text-center text-xs text-zinc-400">
              Belum ada pencatatan saldo kas & bank. Silakan input saldo melalui tombol di atas.
            </div>
          ) : (
            latestBankBalances.map((item) => (
              <div
                key={item.id || item.accountName}
                className="flex items-center justify-between rounded-xl border border-[#1E2637] bg-[#0B0F19] p-4"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-purple-400" />
                    <span className="font-bold text-white text-xs">
                      {item.accountName}
                    </span>
                  </div>
                  <div className="mt-1 text-lg font-black text-purple-300">
                    {formatRupiah(item.actualBalance)}
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    Update: {formatTanggal(item.date)}
                  </div>
                </div>

                {isManager && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenBankModal(item)}
                      title="Edit Saldo"
                      className="rounded-lg p-1.5 text-zinc-400 hover:bg-[#1E2637] hover:text-purple-300 transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteConfirm({
                          isOpen: true,
                          type: 'RECONCILIATION',
                          id: item.id!,
                          label: `${item.accountName} (${formatRupiah(item.actualBalance)})`,
                          data: item,
                        })
                      }
                      title="Hapus Saldo"
                      className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-950/50 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Historical List of All Manual Balances */}
        {filteredReconciliations.length > 0 && (
          <div className="mt-4">
            <div className="text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider">
              Histori Pencatatan Saldo Kas & Bank
            </div>
            <div className="overflow-x-auto rounded-xl border border-[#1E2637] bg-[#0B0F19]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#1E2637] text-zinc-400 font-bold bg-[#141d30]/40">
                    <th className="py-2.5 pl-4 pr-3">Tanggal</th>
                    <th className="px-3 py-2.5">Nama Rekening / Kas</th>
                    <th className="px-3 py-2.5">Scope</th>
                    <th className="px-3 py-2.5 text-right">Saldo Aktual</th>
                    <th className="px-3 py-2.5">Catatan</th>
                    {isManager && <th className="py-2.5 pl-3 pr-4 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2637]/40 text-zinc-200">
                  {filteredReconciliations.slice(0, 10).map((recon) => (
                    <tr key={recon.id} className="hover:bg-[#111726]/60 transition-colors">
                      <td className="py-2.5 pl-4 pr-3 font-medium text-zinc-300">
                        {formatTanggal(recon.date)}
                      </td>
                      <td className="px-3 py-2.5 font-bold text-white">
                        {recon.accountName}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            recon.scope === 'PRIBADI'
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50'
                              : 'bg-purple-950/80 text-purple-300 border border-purple-800/50'
                          }`}
                        >
                          {recon.scope || 'SHARING'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-black text-purple-300">
                        {formatRupiah(recon.actualBalance)}
                      </td>
                      <td className="px-3 py-2.5 text-zinc-400 truncate max-w-[200px]">
                        {recon.notes || '-'}
                      </td>
                      {isManager && (
                        <td className="py-2.5 pl-3 pr-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenBankModal(recon)}
                              title="Edit Record"
                              className="rounded-lg p-1 text-zinc-400 hover:bg-[#1E2637] hover:text-purple-300 transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteConfirm({
                                  isOpen: true,
                                  type: 'RECONCILIATION',
                                  id: recon.id!,
                                  label: `${recon.accountName} (${formatTanggal(recon.date)})`,
                                  data: recon,
                                })
                              }
                              title="Hapus Record"
                              className="rounded-lg p-1 text-zinc-400 hover:bg-rose-950/50 hover:text-rose-400 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================
          MODAL: INPUT / EDIT DATA PERFORMA (GMV & KOMISI)
      ============================================================ */}
      {isPerformanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-[#1E2637] bg-[#111726] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1E2637] pb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-[#00E5FF]" />
                <h3 className="text-base font-black text-white">
                  {editingPerformance ? 'Edit Data GMV & Komisi' : 'Input Data GMV & Komisi Baru'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPerformanceModalOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSavePerformance} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tanggal */}
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1.5">
                    Tanggal <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={perfForm.date}
                    onChange={(e) => setPerfForm({ ...perfForm, date: e.target.value })}
                    required
                    className="w-full rounded-xl border border-[#1E2637] bg-[#0B0F19] px-3.5 py-2 text-sm text-white focus:border-[#00E5FF] focus:outline-none"
                  />
                </div>

                {/* Akun */}
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1.5">
                    Akun TikTok / Medsos <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={perfForm.accountId}
                    onChange={(e) => {
                      const accId = e.target.value;
                      const selectedAcc = accounts.find((a) => a.id === accId);
                      setPerfForm({
                        ...perfForm,
                        accountId: accId,
                        accountName: selectedAcc ? selectedAcc.accountName : perfForm.accountName,
                        scope: selectedAcc ? selectedAcc.scope : perfForm.scope,
                      });
                    }}
                    required
                    className="w-full rounded-xl border border-[#1E2637] bg-[#0B0F19] px-3.5 py-2 text-sm text-white focus:border-[#00E5FF] focus:outline-none"
                  >
                    <option value="">-- Pilih Akun --</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.accountName} ({acc.scope})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* GMV (Rp) */}
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5">
                  Total GMV (Rp) <span className="text-rose-400">*</span>
                </label>
                <CurrencyInput
                  value={perfForm.gmv}
                  onChange={(val) => setPerfForm({ ...perfForm, gmv: val })}
                  placeholder="Rp 0"
                  className="w-full rounded-xl border border-[#1E2637] bg-[#0B0F19] px-3.5 py-2 text-sm font-bold text-[#00E5FF] focus:border-[#00E5FF] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Total Est. Komisi */}
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1.5">
                    Total Estimasi Komisi (Rp)
                  </label>
                  <CurrencyInput
                    value={perfForm.estimatedCommission}
                    onChange={(val) => setPerfForm({ ...perfForm, estimatedCommission: val })}
                    placeholder="Rp 0"
                    className="w-full rounded-xl border border-[#1E2637] bg-[#0B0F19] px-3.5 py-2 text-sm font-bold text-amber-400 focus:border-amber-400 focus:outline-none"
                  />
                </div>

                {/* Total Komisi Real */}
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-1.5">
                    Total Komisi Real (Rp)
                  </label>
                  <CurrencyInput
                    value={perfForm.commissionReal}
                    onChange={(val) => setPerfForm({ ...perfForm, commissionReal: val })}
                    placeholder="Rp 0"
                    className="w-full rounded-xl border border-[#1E2637] bg-[#0B0F19] px-3.5 py-2 text-sm font-bold text-emerald-400 focus:border-emerald-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Catatan */}
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5">
                  Catatan (Opsional)
                </label>
                <input
                  type="text"
                  value={perfForm.notes}
                  onChange={(e) => setPerfForm({ ...perfForm, notes: e.target.value })}
                  placeholder="Keterangan tambahan..."
                  className="w-full rounded-xl border border-[#1E2637] bg-[#0B0F19] px-3.5 py-2 text-sm text-white focus:border-[#00E5FF] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1E2637]">
                <button
                  type="button"
                  onClick={() => setIsPerformanceModalOpen(false)}
                  disabled={actionLoading}
                  className="rounded-xl border border-[#1E2637] px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#00E5FF] px-5 py-2 text-xs font-black text-black hover:bg-[#00E5FF]/90 transition-all shadow-md disabled:opacity-50"
                >
                  {actionLoading ? 'Menyimpan...' : 'Simpan Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL: INPUT / EDIT SALDO KAS & BANK (MANUAL)
      ============================================================ */}
      {isBankModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#1E2637] bg-[#111726] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1E2637] pb-4">
              <div className="flex items-center gap-2">
                <Landmark className="h-5 w-5 text-purple-400" />
                <h3 className="text-base font-black text-white">
                  {editingReconciliation ? 'Edit Saldo Kas & Bank' : 'Catat Saldo Kas & Bank'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBankModalOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBankBalance} className="mt-4 space-y-4">
              {/* Tanggal */}
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5">
                  Tanggal Pencatatan <span className="text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  value={bankForm.date}
                  onChange={(e) => setBankForm({ ...bankForm, date: e.target.value })}
                  required
                  className="w-full rounded-xl border border-[#1E2637] bg-[#0B0F19] px-3.5 py-2 text-sm text-white focus:border-purple-400 focus:outline-none"
                />
              </div>

              {/* Nama Rekening / Kas */}
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5">
                  Nama Rekening / Kas <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={bankForm.accountName}
                  onChange={(e) => setBankForm({ ...bankForm, accountName: e.target.value })}
                  placeholder="Contoh: BCA PT KDRT, Bank Mandiri, Kas Tunai Kantor"
                  required
                  className="w-full rounded-xl border border-[#1E2637] bg-[#0B0F19] px-3.5 py-2 text-sm text-white focus:border-purple-400 focus:outline-none font-bold"
                />
              </div>

              {/* Scope */}
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5">
                  Scope Rekening
                </label>
                <select
                  value={bankForm.scope}
                  onChange={(e) => setBankForm({ ...bankForm, scope: e.target.value as ScopeType })}
                  className="w-full rounded-xl border border-[#1E2637] bg-[#0B0F19] px-3.5 py-2 text-sm text-white focus:border-purple-400 focus:outline-none"
                >
                  <option value="SHARING">SHARING</option>
                  <option value="PRIBADI">PRIBADI</option>
                </select>
              </div>

              {/* Saldo Riil Aktual (Rp) */}
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5">
                  Saldo Riil / Fisik Aktual (Rp) <span className="text-rose-400">*</span>
                </label>
                <CurrencyInput
                  value={bankForm.actualBalance}
                  onChange={(val) => setBankForm({ ...bankForm, actualBalance: val })}
                  placeholder="Rp 0"
                  className="w-full rounded-xl border border-[#1E2637] bg-[#0B0F19] px-3.5 py-2 text-sm font-black text-purple-300 focus:border-purple-400 focus:outline-none"
                />
                <span className="text-[11px] text-zinc-500 mt-1 block">
                  Masukkan saldo fisik di rekening saat ini (tidak dihitung dari GMV).
                </span>
              </div>

              {/* Catatan */}
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1.5">
                  Catatan (Opsional)
                </label>
                <input
                  type="text"
                  value={bankForm.notes}
                  onChange={(e) => setBankForm({ ...bankForm, notes: e.target.value })}
                  placeholder="Contoh: Saldo per 28 Agustus 2026 jam 23:00"
                  className="w-full rounded-xl border border-[#1E2637] bg-[#0B0F19] px-3.5 py-2 text-sm text-white focus:border-purple-400 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1E2637]">
                <button
                  type="button"
                  onClick={() => setIsBankModalOpen(false)}
                  disabled={actionLoading}
                  className="rounded-xl border border-[#1E2637] px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-5 py-2 text-xs font-black text-white hover:bg-purple-500 transition-all shadow-md disabled:opacity-50"
                >
                  {actionLoading ? 'Menyimpan...' : 'Simpan Saldo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL: KONFIRMASI HAPUS DATA
      ============================================================ */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-[#1E2637] bg-[#111726] p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-950/60 border border-rose-800/40">
                <Trash2 className="h-5 w-5 text-rose-400" />
              </div>
              <div>
                <h4 className="font-black text-white text-base">Hapus Data</h4>
                <p className="text-xs text-zinc-400">Tindakan ini tidak dapat dibatalkan.</p>
              </div>
            </div>

            <p className="text-sm text-zinc-300 my-4 rounded-xl border border-[#1E2637] bg-[#0B0F19] p-3 font-medium">
              Apakah Anda yakin ingin menghapus record <strong className="text-white">{deleteConfirm.label}</strong>?
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteConfirm({ isOpen: false, type: 'PERFORMANCE', id: '', label: '' })}
                disabled={actionLoading}
                className="rounded-xl border border-[#1E2637] px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                disabled={actionLoading}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-black text-white hover:bg-rose-500 transition-all shadow-md disabled:opacity-50"
              >
                {actionLoading ? 'Menghapus...' : 'Ya, Hapus Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
