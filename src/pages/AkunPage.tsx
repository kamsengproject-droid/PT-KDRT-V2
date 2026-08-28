import React, { useState, useEffect, useMemo } from 'react';
import {
  Smartphone,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Share2,
  Lock,
  ChevronRight,
  Home,
  AlertCircle,
  X,
  Video,
  ShoppingBag,
  Instagram,
  Facebook,
  Youtube,
  Radio,
  Merge,
  ArrowRight,
  Sparkles,
  Layers,
  Database,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  hapusAkun,
  subscribeAccounts,
  tambahAkun,
  updateAkun,
  gabungAkun,
  MergeAccountResult,
} from '../services/accountService';
import { Account, ScopeType } from '../types';
import { tanggalHariIni } from '../utils/formatters';

interface AkunPageProps {
  onBackToPortal?: () => void;
}

// Brand Visual Platform Component
const PlatformBadgeIcon: React.FC<{ platform: string; className?: string }> = ({
  platform,
  className = 'h-5 w-5',
}) => {
  const p = (platform || '').toLowerCase();
  if (p.includes('tiktok')) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black text-white shadow-xs shrink-0" title="TikTok">
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.067-.095a2.893 2.893 0 0 1 2.372-4.542c.404 0 .788.084 1.137.235V9.45a6.338 6.338 0 0 0-1.137-.103A6.337 6.337 0 0 0 3.12 15.684a6.337 6.337 0 0 0 6.337 6.337c3.488 0 6.337-2.849 6.337-6.337V8.583a8.17 8.17 0 0 0 4.795 1.548V6.686h-1z" />
        </svg>
      </div>
    );
  }
  if (p.includes('shopee')) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white shadow-xs shrink-0" title="Shopee">
        <ShoppingBag className={className} />
      </div>
    );
  }
  if (p.includes('instagram') || p.includes('ig')) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 via-pink-600 to-amber-500 text-white shadow-xs shrink-0" title="Instagram">
        <Instagram className={className} />
      </div>
    );
  }
  if (p.includes('facebook') || p.includes('fb')) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs shrink-0" title="Facebook">
        <Facebook className={className} />
      </div>
    );
  }
  if (p.includes('youtube') || p.includes('yt')) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600 text-white shadow-xs shrink-0" title="YouTube">
        <Youtube className={className} />
      </div>
    );
  }
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800 text-white shadow-xs shrink-0" title="Medsos">
      <Video className={className} />
    </div>
  );
};

export const AkunPage: React.FC<AkunPageProps> = ({ onBackToPortal }) => {
  const { userProfile, role, loading, currentUser } = useAuth();
  const isOwner = role === 'OWNER';
  const isInvestor = role === 'INVESTOR';

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState<{
    accountName: string;
    username: string;
    platform: string;
    scope: ScopeType;
    managerName: string;
    active: boolean;
    startDate: string;
  }>({
    accountName: '',
    username: '',
    platform: 'TikTok',
    scope: 'SHARING',
    managerName: 'Melinda',
    active: true,
    startDate: tanggalHariIni(),
  });

  const [saving, setSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // State untuk Fitur Gabung Akun (Merge)
  const [showMergeModal, setShowMergeModal] = useState<boolean>(false);
  const [sourceKey, setSourceKey] = useState<string>('XzInVZv3DZfIJoQqSF7m');
  const [targetKey, setTargetKey] = useState<string>('nisagrosir88');
  const [merging, setMerging] = useState<boolean>(false);
  const [mergeResult, setMergeResult] = useState<MergeAccountResult | null>(null);

  useEffect(() => {
    if (loading || !userProfile?.active) {
      return;
    }
    const unsub = subscribeAccounts(undefined, (allAccs) => {
      let filtered = allAccs;
      if (isInvestor) {
        filtered = allAccs.filter((a) => a.scope === 'SHARING');
      }
      setAccounts(filtered);
    });
    return unsub;
  }, [loading, currentUser?.uid, userProfile?.role, userProfile?.active, isInvestor]);

  // Check if XzInVZv3DZfIJoQqSF7m or multiple nisagrosir88 exist
  const hasXzInAccount = useMemo(() => {
    return accounts.some(
      (a) =>
        a.id === 'XzInVZv3DZfIJoQqSF7m' ||
        (a.username && a.username.includes('XzIn')) ||
        (a.accountName && a.accountName.includes('XzIn'))
    );
  }, [accounts]);

  // Separate Accounts into SHARING and PRIBADI
  const sharingAccounts = useMemo(() => {
    return accounts.filter((a) => a.scope === 'SHARING');
  }, [accounts]);

  const privateAccounts = useMemo(() => {
    return accounts.filter((a) => a.scope === 'PRIBADI' || (a.scope as string) === 'PRIVATE');
  }, [accounts]);

  // Metrics for Sharing Accounts
  const sharingMetrics = useMemo(() => {
    const total = sharingAccounts.length;
    const active = sharingAccounts.filter((a) => a.active).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [sharingAccounts]);

  // Metrics for Private Accounts
  const privateMetrics = useMemo(() => {
    const total = privateAccounts.length;
    const active = privateAccounts.filter((a) => a.active).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [privateAccounts]);

  const handleOpenAdd = (defaultScope: ScopeType = 'SHARING') => {
    setEditingAccount(null);
    setErrorMessage(null);
    setFormData({
      accountName: '',
      username: '',
      platform: 'TikTok',
      scope: isInvestor ? 'SHARING' : defaultScope,
      managerName: 'Melinda',
      active: true,
      startDate: tanggalHariIni(),
    });
    setShowModal(true);
  };

  const handleOpenEdit = (acc: Account) => {
    setEditingAccount(acc);
    setErrorMessage(null);
    setFormData({
      accountName: acc.accountName,
      username: acc.username,
      platform: acc.platform,
      scope: acc.scope,
      managerName: acc.managerName || '',
      active: acc.active,
      startDate: acc.startDate || tanggalHariIni(),
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.accountName.trim() || !formData.username.trim()) {
      setErrorMessage('Nama akun dan username wajib diisi.');
      return;
    }
    setSaving(true);
    setErrorMessage(null);
    try {
      const uid = userProfile?.uid || 'user';
      const name = userProfile?.name || 'User';
      if (editingAccount?.id) {
        await updateAkun(editingAccount.id, formData, uid, name);
      } else {
        await tambahAkun(formData, uid, name);
      }
      setShowModal(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan akun');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus akun "${name}"?`)) {
      await hapusAkun(id, name, userProfile?.uid || 'user', userProfile?.name || 'User');
    }
  };

  const handleExecuteMerge = async (sourceOverride?: string, targetOverride?: string) => {
    const src = sourceOverride || sourceKey;
    const tgt = targetOverride || targetKey;

    if (!src.trim() || !tgt.trim()) {
      setErrorMessage('Akun Asal dan Akun Tujuan wajib ditentukan.');
      return;
    }

    if (src.trim().toLowerCase() === tgt.trim().toLowerCase()) {
      setErrorMessage('Akun Asal dan Akun Tujuan tidak boleh sama.');
      return;
    }

    setMerging(true);
    setErrorMessage(null);
    setMergeResult(null);

    try {
      const uid = userProfile?.uid || currentUser?.uid || 'owner';
      const name = userProfile?.name || 'Owner';
      const result = await gabungAkun(src, tgt, uid, name);
      setMergeResult(result);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menggabungkan akun');
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
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
          <span className="font-bold text-zinc-900">AKUN TIKTOK & MEDSOS</span>
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

      {/* Header & Global Add/Merge Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 flex items-center gap-2.5">
            <Smartphone className="h-7 w-7 text-emerald-600" />
            Akun TikTok & Medsos
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">
            Pengelolaan channel marketing terpisah antara <strong>Akun Sharing (Emerald)</strong> dan <strong>Akun Pribadi (Blue)</strong>.
          </p>
        </div>

        {!isInvestor && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setSourceKey('XzInVZv3DZfIJoQqSF7m');
                setTargetKey('nisagrosir88');
                setMergeResult(null);
                setErrorMessage(null);
                setShowMergeModal(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-purple-300 bg-purple-50 text-purple-800 px-4 py-2.5 text-xs font-black shadow-xs hover:bg-purple-100 transition-all cursor-pointer active:scale-95"
            >
              <Merge className="h-4 w-4 text-purple-600 stroke-[2.5]" />
              Gabungkan Akun (Merge)
            </button>

            <button
              onClick={() => handleOpenAdd('SHARING')}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-md hover:bg-emerald-500 transition-all cursor-pointer active:scale-95"
            >
              <Plus className="h-4 w-4 stroke-[3]" />
              Tambah Akun Sharing
            </button>
            <button
              onClick={() => handleOpenAdd('PRIBADI')}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black text-white shadow-md hover:bg-blue-500 transition-all cursor-pointer active:scale-95"
            >
              <Plus className="h-4 w-4 stroke-[3]" />
              Tambah Akun Pribadi
            </button>
          </div>
        )}
      </div>

      {/* QUICK-ACTION BANNER KHUSUS: PENGGABUNGAN XzInVZv3DZfIJoQqSF7m & nisagrosir88 */}
      {!isInvestor && (
        <div className="rounded-3xl border-2 border-purple-300 bg-gradient-to-r from-purple-50 via-indigo-50/40 to-white p-5 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-600 text-white font-bold shadow-md shadow-purple-600/20 shrink-0">
                <Sparkles className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-black text-zinc-900">
                    Penggabungan Akun: <span className="text-purple-700 font-mono text-xs sm:text-sm">XzInVZv3DZfIJoQqSF7m</span> &amp; <span className="text-emerald-700 font-bold">nisagrosir88</span>
                  </h3>
                  <span className="rounded-full bg-purple-100 text-purple-800 text-[10px] font-black px-2.5 py-0.5 border border-purple-200">
                    1-Click Auto Merge
                  </span>
                </div>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Menyatukan seluruh data <strong>Performa Harian (GMV &amp; Komisi Real)</strong>, <strong>Buku Kas Transaksi</strong>, <strong>Produk</strong>, <strong>Sampel</strong>, <strong>Jadwal Konten</strong>, dan <strong>Penugasan Tim</strong> menjadi 1 akun resmi <strong>NISA GROSIR88 (@nisagrosir88)</strong> tanpa ada data yang hilang.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleExecuteMerge('XzInVZv3DZfIJoQqSF7m', 'nisagrosir88')}
                disabled={merging}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-purple-600 px-5 py-3 text-xs font-black text-white shadow-md hover:bg-purple-500 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {merging ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Sedang Menggabungkan Data...</span>
                  </>
                ) : (
                  <>
                    <Merge className="h-4 w-4 stroke-[3]" />
                    <span>Gabungkan Jadi 1 Sekarang</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Merge Result Feedback Alert */}
          {mergeResult && (
            <div className="mt-4 rounded-2xl border border-emerald-300 bg-emerald-50/90 p-4 text-xs space-y-2">
              <div className="flex items-center gap-2 text-emerald-800 font-black text-sm">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <span>{mergeResult.message}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-200/80 text-zinc-700 font-medium">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase block">Performa Diupdate</span>
                  <strong className="text-xs font-black text-zinc-900">{mergeResult.dailyPerformanceUpdated} data</strong>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase block">Performa Dilebur (Sama Tanggal)</span>
                  <strong className="text-xs font-black text-emerald-700">{mergeResult.dailyPerformanceMerged} data</strong>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase block">Transaksi &amp; Kas</span>
                  <strong className="text-xs font-black text-zinc-900">{mergeResult.transactionsUpdated + mergeResult.expensesUpdated} data</strong>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase block">Produk &amp; Sampel</span>
                  <strong className="text-xs font-black text-zinc-900">{mergeResult.productsUpdated + mergeResult.samplesUpdated} data</strong>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 1: AKUN SHARING (INVESTOR & KANTOR) - EMERALD PALETTE */}
      {/* ========================================================================= */}
      <div className="rounded-3xl border-2 border-emerald-300/80 bg-white p-5 sm:p-7 shadow-sm space-y-5">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/20">
              <Share2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-zinc-900 tracking-tight">
                  AKUN SHARING
                </h2>
                <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 border border-emerald-200">
                  Investor & Kantor
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                Channel affiliate yang dihitung dalam kalkulator profit sharing investor.
              </p>
            </div>
          </div>

          {/* Sharing Summary Metrics */}
          <div className="flex items-center gap-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl px-4 py-2 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-800 block">Total Akun</span>
              <strong className="text-base font-black text-zinc-900">{sharingMetrics.total}</strong>
            </div>
            <div className="h-7 w-px bg-emerald-200" />
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-700 block">Aktif</span>
              <strong className="text-base font-black text-emerald-700">{sharingMetrics.active}</strong>
            </div>
            <div className="h-7 w-px bg-emerald-200" />
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-500 block">Nonaktif</span>
              <strong className="text-base font-black text-zinc-600">{sharingMetrics.inactive}</strong>
            </div>
          </div>
        </div>

        {/* Sharing Accounts Grid */}
        {sharingAccounts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/30 p-8 text-center text-xs text-zinc-400 font-medium">
            Belum ada akun Sharing yang terdaftar.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sharingAccounts.map((acc) => (
              <div
                key={acc.id}
                className="rounded-2xl border border-emerald-200/90 bg-gradient-to-b from-emerald-50/40 to-white p-5 shadow-2xs flex flex-col justify-between hover:border-emerald-400 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <PlatformBadgeIcon platform={acc.platform} />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-black text-sm text-zinc-900 truncate" title={acc.accountName}>
                          {acc.accountName}
                        </h3>
                        <span className="text-xs text-zinc-500 font-medium truncate block">
                          @{acc.username}
                        </span>
                      </div>
                    </div>
                    <span className="rounded-full px-2.5 py-0.5 text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                      SHARING
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-emerald-100/60 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Platform:</span>
                      <span className="font-bold text-zinc-800">{acc.platform || 'TikTok'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Penanggung Jawab (PIC):</span>
                      <span className="font-bold text-zinc-800">{acc.managerName || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">ID Dokumen:</span>
                      <span className="font-mono text-[10px] text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded truncate max-w-[150px]" title={acc.id}>
                        {acc.id}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Status Akun:</span>
                      <span
                        className={`inline-flex items-center gap-1 font-black text-[11px] ${
                          acc.active ? 'text-emerald-700' : 'text-zinc-400'
                        }`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> {acc.active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </div>
                  </div>
                </div>

                {!isInvestor && (
                  <div className="mt-4 pt-3 border-t border-emerald-100/60 flex gap-2">
                    <button
                      onClick={() => handleOpenEdit(acc)}
                      className="flex-1 rounded-xl border border-zinc-200 bg-white py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 shadow-2xs transition-colors"
                    >
                      Edit
                    </button>
                    {isOwner && (
                      <button
                        onClick={() => handleDelete(acc.id!, acc.accountName)}
                        className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors"
                        title="Hapus Akun"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: AKUN PRIBADI (OWNER PT.KDRT ONLY) - BLUE PALETTE */}
      {/* ========================================================================= */}
      {!isInvestor && (
        <div className="rounded-3xl border-2 border-blue-300/80 bg-white p-5 sm:p-7 shadow-sm space-y-5">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-blue-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white font-bold shadow-md shadow-blue-600/20">
                <Lock className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black text-zinc-900 tracking-tight">
                    AKUN PRIBADI
                  </h2>
                  <span className="rounded-full bg-blue-100 text-blue-800 text-[10px] font-black px-2.5 py-0.5 border border-blue-200">
                    Owner PT.KDRT (Private)
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Channel affiliate milik pribadi owner, 100% terisolasi dari profit sharing investor.
                </p>
              </div>
            </div>

            {/* Private Summary Metrics */}
            <div className="flex items-center gap-3 bg-blue-50/70 border border-blue-200 rounded-2xl px-4 py-2 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-blue-800 block">Total Akun</span>
                <strong className="text-base font-black text-zinc-900">{privateMetrics.total}</strong>
              </div>
              <div className="h-7 w-px bg-blue-200" />
              <div>
                <span className="text-[10px] uppercase font-bold text-blue-700 block">Aktif</span>
                <strong className="text-base font-black text-blue-700">{privateMetrics.active}</strong>
              </div>
              <div className="h-7 w-px bg-blue-200" />
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-500 block">Nonaktif</span>
                <strong className="text-base font-black text-zinc-600">{privateMetrics.inactive}</strong>
              </div>
            </div>
          </div>

          {/* Private Accounts Grid */}
          {privateAccounts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/30 p-8 text-center text-xs text-zinc-400 font-medium">
              Belum ada akun Pribadi yang terdaftar.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {privateAccounts.map((acc) => (
                <div
                  key={acc.id}
                  className="rounded-2xl border border-blue-200/90 bg-gradient-to-b from-blue-50/40 to-white p-5 shadow-2xs flex flex-col justify-between hover:border-blue-400 transition-all"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <PlatformBadgeIcon platform={acc.platform} />
                        <div className="min-w-0 flex-1">
                          <h3 className="font-black text-sm text-zinc-900 truncate" title={acc.accountName}>
                            {acc.accountName}
                          </h3>
                          <span className="text-xs text-zinc-500 font-medium truncate block">
                            @{acc.username}
                          </span>
                        </div>
                      </div>
                      <span className="rounded-full px-2.5 py-0.5 text-[9px] font-black bg-blue-100 text-blue-800 border border-blue-200 shrink-0">
                        PRIBADI
                      </span>
                    </div>

                    <div className="mt-4 pt-3 border-t border-blue-100/60 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Platform:</span>
                        <span className="font-bold text-zinc-800">{acc.platform || 'TikTok'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Penanggung Jawab (PIC):</span>
                        <span className="font-bold text-zinc-800">{acc.managerName || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">ID Dokumen:</span>
                        <span className="font-mono text-[10px] text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded truncate max-w-[150px]" title={acc.id}>
                          {acc.id}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Status Akun:</span>
                        <span
                          className={`inline-flex items-center gap-1 font-black text-[11px] ${
                            acc.active ? 'text-blue-700' : 'text-zinc-400'
                          }`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> {acc.active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-blue-100/60 flex gap-2">
                    <button
                      onClick={() => handleOpenEdit(acc)}
                      className="flex-1 rounded-xl border border-zinc-200 bg-white py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 shadow-2xs transition-colors"
                    >
                      Edit
                    </button>
                    {isOwner && (
                      <button
                        onClick={() => handleDelete(acc.id!, acc.accountName)}
                        className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors"
                        title="Hapus Akun"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= MODAL: GABUNGKAN AKUN (MERGE) ================= */}
      {showMergeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-zinc-200 my-8 space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-base sm:text-lg font-black text-zinc-900 flex items-center gap-2">
                <Merge className="h-5 w-5 text-purple-600" />
                Gabungkan Akun (Data Migration)
              </h3>
              <button
                onClick={() => setShowMergeModal(false)}
                className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-600 leading-relaxed">
              Fitur ini akan menyatukan <strong>seluruh data historis</strong> (Performa Harian GMV &amp; Komisi Real, Transaksi Kas, Produk, Sampel, Jadwal Konten, Penugasan Karyawan) dari Akun Asal ke Akun Tujuan Utama.
            </p>

            {errorMessage && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {mergeResult && (
              <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-xs space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 font-black">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <span>{mergeResult.message}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-200/80 text-zinc-700">
                  <div>Performa Diperbarui: <strong>{mergeResult.dailyPerformanceUpdated}</strong></div>
                  <div>Performa Dilebur: <strong>{mergeResult.dailyPerformanceMerged}</strong></div>
                  <div>Transaksi Kas: <strong>{mergeResult.transactionsUpdated}</strong></div>
                  <div>Produk &amp; Sampel: <strong>{mergeResult.productsUpdated + mergeResult.samplesUpdated}</strong></div>
                </div>
              </div>
            )}

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-zinc-700 mb-1">
                  1. Akun Asal (Yang Akan Dilebur/Dihapus) *
                </label>
                <input
                  type="text"
                  value={sourceKey}
                  onChange={(e) => setSourceKey(e.target.value)}
                  placeholder="ID Dokumen atau Username (misal: XzInVZv3DZfIJoQqSF7m)"
                  className="w-full rounded-xl border border-zinc-300 p-2.5 font-mono text-xs font-bold focus:outline-purple-500"
                />
                <span className="text-[10px] text-zinc-400 mt-0.5 block">
                  Bisa berupa ID dokumen Firestore lama (contoh: <code>XzInVZv3DZfIJoQqSF7m</code>) atau username akun duplikat.
                </span>
              </div>

              <div className="flex justify-center my-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-purple-700 font-bold border border-purple-200">
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">
                  2. Akun Tujuan Utama (Yang Dipakai Seterusnya) *
                </label>
                <input
                  type="text"
                  value={targetKey}
                  onChange={(e) => setTargetKey(e.target.value)}
                  placeholder="Username atau Nama Akun Tujuan (misal: nisagrosir88)"
                  className="w-full rounded-xl border border-zinc-300 p-2.5 font-bold focus:outline-emerald-500"
                />
                <span className="text-[10px] text-zinc-400 mt-0.5 block">
                  Semua transaksi dan performa akan dialihkan ke akun ini (contoh: <code>nisagrosir88</code>).
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setShowMergeModal(false)}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => handleExecuteMerge()}
                disabled={merging}
                className="rounded-xl bg-purple-600 hover:bg-purple-500 text-white px-5 py-2 text-xs font-black shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {merging ? (
                  <>
                    <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <Merge className="h-3.5 w-3.5" />
                    <span>Jalankan Penggabungan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: TAMBAH / EDIT AKUN ================= */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-zinc-200 my-8">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
              <h3 className="text-base font-black text-zinc-900 flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-emerald-600" />
                {editingAccount ? 'Edit Data Akun' : 'Tambah Akun Baru'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-zinc-700 mb-1">Nama Tampilan Akun *</label>
                <input
                  type="text"
                  required
                  value={formData.accountName}
                  onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                  placeholder="contoh: NISA GROSIR88"
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm font-bold focus:outline-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Username / Handle *</label>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="nisagrosir88"
                    className="w-full rounded-xl border border-zinc-300 p-2.5 font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Platform</label>
                  <select
                    value={formData.platform}
                    onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 font-bold"
                  >
                    <option value="TikTok">TikTok Shop</option>
                    <option value="Shopee">Shopee Video/Live</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Facebook">Facebook</option>
                    <option value="YouTube">YouTube</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Scope Kepemilikan *</label>
                  <select
                    disabled={isInvestor}
                    value={formData.scope}
                    onChange={(e) => setFormData({ ...formData, scope: e.target.value as ScopeType })}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 font-black text-zinc-900"
                  >
                    <option value="SHARING">SHARING (Investor & Kantor)</option>
                    <option value="PRIBADI">PRIBADI (Owner PT.KDRT)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Penanggung Jawab (PIC)</label>
                  <input
                    type="text"
                    value={formData.managerName}
                    onChange={(e) => setFormData({ ...formData, managerName: e.target.value })}
                    placeholder="Nama PIC"
                    className="w-full rounded-xl border border-zinc-300 p-2.5 font-medium"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="accountActive"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="rounded text-emerald-600 h-4 w-4"
                />
                <label htmlFor="accountActive" className="font-bold text-zinc-800 cursor-pointer">
                  Akun Aktif Beroperasi
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-zinc-200 px-4 py-2 font-bold text-zinc-600 hover:bg-zinc-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 font-black shadow-md cursor-pointer"
                >
                  {saving ? 'Menyimpan...' : 'SIMPAN AKUN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

