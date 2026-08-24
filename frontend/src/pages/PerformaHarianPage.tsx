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
  Lock,
  CalendarDays,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, query, getDocs } from 'firebase/firestore';
import { Account, DailyPerformance, ScopeType } from '../types';
import {
  subscribeDailyPerformance,
  saveOmsetData,
  saveKomisiReal,
} from '../services/performanceService';
import { formatRupiah, tanggalHariIni, formatTanggal } from '../utils/formatters';
import { filterAccountsForUser } from '../utils/accountAccess';
import { CurrencyInput } from '../components/CurrencyInput';
import { OrphanTransactionAlert } from '../components/finance/OrphanTransactionAlert';

type OmsetTab = 'GMV' | 'KOMISI';

const numberId = (value?: number) => (value ? Number(value).toLocaleString('id-ID') : '0');

const StatCard: React.FC<{
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: 'cyan' | 'emerald' | 'violet';
  testId: string;
}> = ({ label, value, icon, accent = 'cyan', testId }) => {
  const ring = {
    cyan: 'text-cyan-300 bg-cyan-400/10 border-cyan-400/20',
    emerald: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20',
    violet: 'text-violet-300 bg-violet-400/10 border-violet-400/20',
  }[accent];

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#111623] p-4" data-testid={testId}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
          {label}
        </span>
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border ${ring}`}>
          {icon}
        </span>
      </div>
      <p className="mt-3 font-display text-lg font-semibold tracking-tight text-white">{value}</p>
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
  const [selectedMonthStr, setSelectedMonthStr] = useState(tanggalHariIni().substring(0, 7));
  const today = tanggalHariIni();

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Tab 1 — Data GMV
  const [gmvForm, setGmvForm] = useState({
    date: tanggalHariIni(),
    accountId: '',
    gmv: '' as number | '',
    estimatedCommission: '' as number | '',
    itemSold: '' as number | '',
    productImpression: '' as number | '',
    notes: '',
  });

  // Tab 2 — Komisi Real
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
    // Match on accountId only — two production accounts can share a display name,
    // so a name fallback would leak or duplicate rows.
    const ids = new Set(accounts.map((a) => a.id));
    return performances.filter((p) => ids.has(p.accountId));
  }, [performances, accounts, role]);

  const monthlyRows = useMemo(
    () =>
      visiblePerformances
        .filter((p) => (p.date || '').startsWith(selectedMonthStr))
        .sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [visiblePerformances, selectedMonthStr]
  );

  const totals = useMemo(() => {
    const acc = {
      gmvBulan: 0,
      estBulan: 0,
      komisiBulan: 0,
      itemSoldBulan: 0,
      impressionBulan: 0,
      gmvHariIni: 0,
      komisiHariIni: 0,
    };
    monthlyRows.forEach((p) => {
      acc.gmvBulan += p.gmv || 0;
      acc.estBulan += p.estimatedCommission || 0;
      acc.komisiBulan += p.commissionReal || p.realCommission || 0;
      acc.itemSoldBulan += p.itemSold || 0;
      acc.impressionBulan += p.productImpression || 0;
    });
    visiblePerformances
      .filter((p) => p.date === today)
      .forEach((p) => {
        acc.gmvHariIni += p.gmv || 0;
        acc.komisiHariIni += p.commissionReal || p.realCommission || 0;
      });
    return acc;
  }, [monthlyRows, visiblePerformances, today]);

  const resetFeedback = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

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
      setSuccessMessage('Data GMV tersimpan. Komisi Real yang sudah ada tetap dipertahankan.');
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
        `Komisi Real ${formatRupiah(Number(komisiForm.realCommission))} tersimpan & tercatat di Arus Kas. GMV dan Estimasi Komisi tidak berubah.`
      );
      setKomisiForm((prev) => ({ ...prev, realCommission: '', notes: '' }));
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan Komisi Real.');
    } finally {
      setSaving(false);
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
      <div className="mb-7 flex flex-col gap-5 border-b border-white/[0.07] pb-6 lg:flex-row lg:items-end lg:justify-between">
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

        <label className="flex shrink-0 items-center gap-2.5 self-start rounded-xl border border-white/10 bg-[#111623] px-3 py-2 lg:self-auto">
          <CalendarDays className="h-4 w-4 text-slate-500" />
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Bulan
          </span>
          <input
            type="month"
            value={selectedMonthStr}
            onChange={(e) => setSelectedMonthStr(e.target.value)}
            className="bg-transparent text-sm font-semibold text-white focus:outline-none"
            data-testid="omset-month-filter"
          />
        </label>
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

      {/* Feedback */}
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

      {/* Metrics */}
      <div className="mt-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {activeTab === 'GMV' ? (
          <>
            <StatCard
              label="GMV Bulan Ini"
              value={formatRupiah(totals.gmvBulan)}
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              testId="stat-gmv-bulan"
            />
            <StatCard
              label="Estimasi Komisi"
              value={formatRupiah(totals.estBulan)}
              icon={<BarChart3 className="h-3.5 w-3.5" />}
              accent="violet"
              testId="stat-estimasi-bulan"
            />
            <StatCard
              label="Item Sold"
              value={numberId(totals.itemSoldBulan)}
              icon={<ShoppingCart className="h-3.5 w-3.5" />}
              accent="violet"
              testId="stat-item-sold"
            />
            <StatCard
              label="Product Impression"
              value={numberId(totals.impressionBulan)}
              icon={<Eye className="h-3.5 w-3.5" />}
              testId="stat-impression"
            />
          </>
        ) : (
          <>
            <StatCard
              label="Komisi Real Bulan Ini"
              value={formatRupiah(totals.komisiBulan)}
              icon={<Wallet className="h-3.5 w-3.5" />}
              accent="emerald"
              testId="stat-komisi-bulan"
            />
            <StatCard
              label="Komisi Real Hari Ini"
              value={formatRupiah(totals.komisiHariIni)}
              icon={<Wallet className="h-3.5 w-3.5" />}
              accent="emerald"
              testId="stat-komisi-hari-ini"
            />
            <StatCard
              label="Estimasi Komisi Bulan Ini"
              value={formatRupiah(totals.estBulan)}
              icon={<BarChart3 className="h-3.5 w-3.5" />}
              accent="violet"
              testId="stat-estimasi-vs-real"
            />
            <StatCard
              label="GMV Bulan Ini"
              value={formatRupiah(totals.gmvBulan)}
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              testId="stat-gmv-ref"
            />
          </>
        )}
      </div>

      {/* Body */}
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
                  <h2 className="font-display text-lg font-semibold text-white">Input Data GMV</h2>
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
                    Komisi yang sudah benar-benar masuk ke saldo akun dan sudah bisa dicairkan.
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
                    placeholder="Keterangan transfer, nomor invoice, dll..."
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
                  Tanpa GMV, Item Sold, maupun Product Impression — nilai tersebut tetap aman dan
                  hanya diubah dari tab Data GMV.
                </p>
              </form>
            )}
          </div>
        )}

        {/* Table column */}
        <div className={`min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111623] ${canInput ? '' : 'xl:col-span-2'}`}>
          <div className="flex flex-col gap-1 border-b border-white/[0.07] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-display text-base font-semibold text-white">
              {activeTab === 'GMV' ? 'Rekap Data GMV' : 'Rekap Komisi Real'}
            </h2>
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              {monthlyRows.length} record · {selectedMonthStr}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
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
                </tr>
              </thead>
              <tbody>
                {monthlyRows.length > 0 ? (
                  monthlyRows.map((p) => (
                    <tr
                      key={p.id}
                      className="border-t border-white/[0.05] transition-colors hover:bg-white/[0.02]"
                      data-testid={`omset-row-${p.id}`}
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-white">
                        {formatTanggal(p.date)}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{p.accountName || '-'}</td>
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
                            {formatRupiah(p.commissionReal || p.realCommission || 0)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              {p.scope}
                            </span>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={activeTab === 'GMV' ? 6 : 5}
                      className="px-4 py-14 text-center"
                      data-testid="omset-empty-state"
                    >
                      <Lock className="mx-auto mb-3 h-7 w-7 text-slate-600" />
                      <p className="text-sm font-medium text-slate-400">
                        Belum ada data untuk bulan ini
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
    </div>
  );
};
