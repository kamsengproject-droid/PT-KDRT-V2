import React, { useState, useEffect } from 'react';
import {
  Lock,
  Unlock,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  ShieldCheck,
  Calendar,
  Layers,
  FileSpreadsheet,
  Download,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { UserProfile, MonthlyClosing, ScopeType, FinancialAdjustment } from '../types';
import { formatRupiah, formatTanggal } from '../utils/formatters';
import {
  computeMonthlySnapshot,
  closeMonth,
  getMonthlyClosing,
} from '../services/closingService';
import { ClosingReportModal } from '../components/reports/ClosingReportModal';
import { ReopenMonthModal } from '../components/reports/ReopenMonthModal';
import { FinancialAdjustmentModal } from '../components/reports/FinancialAdjustmentModal';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { exportReportData } from '../services/exportService';
import { useAuth } from '../context/AuthContext';

interface TutupBulanPageProps {
  userProfile?: UserProfile;
}

export const TutupBulanPage: React.FC<TutupBulanPageProps> = ({ userProfile: propUserProfile }) => {
  const { userProfile: authUserProfile, loading: authLoading, currentUser } = useAuth();
  const userProfile = propUserProfile || authUserProfile;
  const isOwner = userProfile?.role === 'OWNER';
  const isInvestor = userProfile?.role === 'INVESTOR';

  // Period Selector (YYYY-MM)
  const defaultPeriod = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = d.getMonth() + 1 < 10 ? `0${d.getMonth() + 1}` : `${d.getMonth() + 1}`;
    return `${year}-${month}`;
  };

  const [selectedPeriod, setSelectedPeriod] = useState(defaultPeriod());
  const [selectedScope, setSelectedScope] = useState<ScopeType>(
    isInvestor ? 'SHARING' : 'GABUNGAN'
  );

  const [closingRecord, setClosingRecord] = useState<MonthlyClosing | null>(null);
  const [livePreview, setLivePreview] = useState<MonthlyClosing | null>(null);
  const [loading, setLoading] = useState(false);
  const [closingLoading, setClosingLoading] = useState(false);
  const [closingHistory, setClosingHistory] = useState<MonthlyClosing[]>([]);
  const [adjustments, setAdjustments] = useState<FinancialAdjustment[]>([]);

  // Modals
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedModalClosing, setSelectedModalClosing] = useState<MonthlyClosing | null>(null);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);

  // Subscribe to all monthly closings history
  useEffect(() => {
    if (authLoading || !currentUser || !userProfile?.active) {
      return;
    }
    const unsub = onSnapshot(
      collection(db, 'monthlyClosings'),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MonthlyClosing));
        list.sort((a, b) => (b.period > a.period ? 1 : -1));
        setClosingHistory(list);
      }
    );

    const unsubAdj = onSnapshot(
      collection(db, 'financialAdjustments'),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as FinancialAdjustment));
        list.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
        setAdjustments(list);
      }
    );

    return () => {
      unsub();
      unsubAdj();
    };
  }, [authLoading, currentUser?.uid, userProfile?.role, userProfile?.active]);

  // Fetch or Compute Closing Data for Selected Period & Scope
  const loadPeriodData = async () => {
    setLoading(true);
    try {
      const existing = await getMonthlyClosing(selectedPeriod, selectedScope);
      setClosingRecord(existing);

      if (!existing || existing.status === 'OPEN') {
        const preview = await computeMonthlySnapshot(selectedPeriod, selectedScope);
        setLivePreview(preview);
      } else {
        setLivePreview(existing);
      }
    } catch (err) {
      console.error('Error loading closing data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPeriodData();
  }, [selectedPeriod, selectedScope]);

  // Handle Close Month Action
  const handleExecuteClose = async () => {
    if (!isOwner) {
      alert('Hanya Owner yang berwenang menutup buku bulanan.');
      return;
    }

    const confirmMsg = `Konfirmasi Penutupan Buku:\nApakah Anda yakin ingin MENUTUP buku periode ${selectedPeriod} (${selectedScope})?\n\nSetelah ditutup, data keuangan periode ini akan dibekukan sebagai Snapshot Resmi.`;
    if (!window.confirm(confirmMsg)) return;

    setClosingLoading(true);
    try {
      await closeMonth(
        selectedPeriod,
        selectedScope,
        `Tutup buku reguler periode ${selectedPeriod} oleh ${userProfile.name}`,
        userProfile
      );
      alert(`Buku bulan ${selectedPeriod} (${selectedScope}) berhasil DITUTUP dan dibekukan.`);
      await loadPeriodData();
    } catch (err: any) {
      console.error('Close month error:', err);
      alert(`Gagal menutup bulan: ${err.message}`);
    } finally {
      setClosingLoading(false);
    }
  };

  const isClosed = closingRecord?.status === 'CLOSED';
  const displayData = isClosed ? closingRecord : livePreview;

  const currentAdjustments = adjustments.filter(
    (a) => a.period === selectedPeriod && (selectedScope === 'GABUNGAN' || a.scope === selectedScope)
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-orange-600 rounded-2xl text-white shadow-md">
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">
              TUTUP BULAN & REKONSILIASI BULANAN
            </h1>
            <p className="text-xs text-slate-300 font-medium">
              Pembekuan Data Arus Kas, Rekonsiliasi, Laporan Resmi, dan Koreksi Financial Adjustment
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300">
            Wewenang Closing: <span className="text-orange-400 font-black">{isOwner ? 'Owner' : 'Read Only'}</span>
          </div>
        </div>
      </div>

      {/* Period & Scope Selector Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                Pilih Periode Bulan
              </label>
              <input
                type="month"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                Scope Bisnis
              </label>
              {isInvestor ? (
                <div className="rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-black text-purple-700">
                  SHARING
                </div>
              ) : (
                <select
                  value={selectedScope}
                  onChange={(e) => setSelectedScope(e.target.value as any)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-100"
                >
                  <option value="GABUNGAN">GABUNGAN (Semua)</option>
                  <option value="PRIBADI">PRIBADI</option>
                  <option value="SHARING">SHARING</option>
                </select>
              )}
            </div>

            <button
              onClick={loadPeriodData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 self-end px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs mt-auto"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Data</span>
            </button>
          </div>

          {/* Status Badge & Actions */}
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider ${
                isClosed
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              {isClosed ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
              <span>{isClosed ? 'STATUS: DITUTUP (CLOSED)' : 'STATUS: TERBUKA (OPEN)'}</span>
            </span>

            {displayData && (
              <button
                onClick={() => {
                  setSelectedModalClosing(displayData);
                  setShowReportModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 text-xs font-black text-white hover:bg-slate-800 transition-colors shadow-2xs"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Lihat Laporan Lengkap</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Snapshot / Preview Data */}
      {loading ? (
        <div className="py-16 text-center space-y-3 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="h-8 w-8 animate-spin text-orange-600 mx-auto" />
          <div className="text-xs font-bold text-slate-500">
            Menghitung snapshot data periode {selectedPeriod}...
          </div>
        </div>
      ) : displayData ? (
        <div className="space-y-6">
          {/* Status Alert Banner */}
          {isClosed ? (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-black text-emerald-950 uppercase tracking-wider">
                    Snapshot Buku Periode {selectedPeriod} Telah Dibekukan
                  </span>
                  <p className="text-emerald-700 font-medium mt-0.5">
                    Ditutup oleh <span className="font-bold">{displayData.closedByName}</span> pada{' '}
                    {displayData.closedAt ? formatTanggal(displayData.closedAt) : '-'}.
                  </p>
                </div>
              </div>

              {isOwner && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAdjustmentModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 text-white font-black text-xs hover:bg-orange-700 transition-colors shadow-2xs"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>Input Financial Adjustment</span>
                  </button>
                  <button
                    onClick={() => setShowReopenModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-100 text-amber-900 font-black text-xs hover:bg-amber-200 transition-colors"
                  >
                    <Unlock className="h-3.5 w-3.5" />
                    <span>Buka Kembali Bulan</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                <div>
                  <span className="font-black text-amber-950 uppercase tracking-wider">
                    Periode {selectedPeriod} Masih Terbuka (Live Preview)
                  </span>
                  <p className="text-amber-800 font-medium mt-0.5">
                    Nilai di bawah ini dihitung langsung secara dinamis dari database. Lakukan penutupan buku untuk membekukan laporan bulanan.
                  </p>
                </div>
              </div>

              {isOwner && (
                <button
                  onClick={handleExecuteClose}
                  disabled={closingLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 text-white font-black text-xs hover:bg-orange-700 transition-colors shadow-md disabled:opacity-50"
                >
                  {closingLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Lock className="h-3.5 w-3.5" />
                  )}
                  <span>TUTUP BULAN INI ({selectedPeriod})</span>
                </button>
              )}
            </div>
          )}

          {/* Metric Cards Grid */}
         <div className="p-5 rounded-2xl border border-rose-200 bg-rose-50/70 shadow-2xs">
  <span className="text-[10px] font-black uppercase tracking-wider text-rose-700">
    KAS & BANK - UANG KELUAR
  </span>

  <div className="text-2xl font-black text-rose-950 font-mono tracking-tight mt-1">
    {formatRupiah(displayData.uangKeluar)}
  </div>

  <div className="mt-1 text-xs text-rose-700 font-medium">
    Pengeluaran yang sudah tercatat sebagai kas/bank
  </div>
</div>

            <div className="p-5 rounded-2xl border border-rose-200 bg-rose-50/70 shadow-2xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-700">
                UANG KELUAR
              </span>
              <div className="text-2xl font-black text-rose-950 font-mono tracking-tight mt-1">
                {formatRupiah(displayData.uangKeluar)}
              </div>
              <div className="mt-1 text-xs text-rose-700 font-medium">Beban & operasional</div>
            </div>

            <div className="p-5 rounded-2xl border border-indigo-200 bg-indigo-50/70 shadow-2xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700">
                SALDO BERSIH
              </span>
              <div className="text-2xl font-black text-indigo-950 font-mono tracking-tight mt-1">
                {formatRupiah(displayData.saldoBersih)}
              </div>
              <div className="mt-1 text-xs text-indigo-700 font-medium">Arus kas bersih akhir periode</div>
            </div>
          </div>

          {/* Secondary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total GMV</div>
              <div className="text-base font-black font-mono text-slate-900 mt-1">{formatRupiah(displayData.gmv)}</div>
            </div>
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Komisi Real</div>
              <div className="text-base font-black font-mono text-emerald-900 mt-1">{formatRupiah(displayData.komisiReal)}</div>
            </div>
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="text-[10px] font-black uppercase tracking-wider text-rose-700">Total Expense</div>
              <div className="text-base font-black font-mono text-rose-900 mt-1">{formatRupiah(displayData.totalExpense)}</div>
            </div>
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="text-[10px] font-black uppercase tracking-wider text-purple-700">Hak Investor</div>
              <div className="text-base font-black font-mono text-purple-900 mt-1">{formatRupiah(displayData.hakInvestor)}</div>
            </div>
          </div>

          {/* Pre-Closing Reconciliation Card */}
          {displayData.reconciliationSnapshot && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Rekonsiliasi Saldo Buku vs Fisik Kas
                </h3>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-black ${
                    displayData.reconciliationSnapshot.status === 'SEIMBANG'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  STATUS: {displayData.reconciliationSnapshot.status}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-400 font-bold">Saldo Buku Sistem</div>
                  <div className="text-base font-black font-mono text-slate-900 mt-0.5">
                    {formatRupiah(displayData.reconciliationSnapshot.saldoBuku)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-400 font-bold">Saldo Fisik Aktual</div>
                  <div className="text-base font-black font-mono text-slate-900 mt-0.5">
                    {formatRupiah(displayData.reconciliationSnapshot.saldoAktual)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-400 font-bold">Selisih Kas</div>
                  <div
                    className={`text-base font-black font-mono mt-0.5 ${
                      displayData.reconciliationSnapshot.selisih === 0 ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {formatRupiah(displayData.reconciliationSnapshot.selisih)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Adjustments Table if any */}
          {currentAdjustments.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Riwayat Financial Adjustment Periode Ini ({currentAdjustments.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 font-black uppercase border-b border-slate-200">
                      <th className="py-2.5 px-4">Tipe</th>
                      <th className="py-2.5 px-4">Deskripsi & Alasan</th>
                      <th className="py-2.5 px-4 text-right">Nominal</th>
                      <th className="py-2.5 px-4">Dibuat Oleh</th>
                      <th className="py-2.5 px-4">Waktu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentAdjustments.map((adj) => (
                      <tr key={adj.id || adj.adjustmentId} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-bold">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black ${
                              adj.type === 'INCOME_ADJUSTMENT'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {adj.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="font-bold text-slate-900">{adj.description}</div>
                          <div className="text-[10px] text-slate-500 italic">"{adj.reason}"</div>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-black text-slate-900">
                          {formatRupiah(adj.amount)}
                        </td>
                        <td className="py-2.5 px-4 text-slate-700">{adj.createdByName}</td>
                        <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px]">
                          {formatTanggal(adj.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Historical Closing Records Table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
            Riwayat Penutupan Buku Seluruh Periode ({closingHistory.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-black text-slate-700 uppercase tracking-wider">
                <th className="py-3 px-4">Periode</th>
                <th className="py-3 px-4">Scope</th>
                <th className="py-3 px-4 text-right">Uang Masuk</th>
                <th className="py-3 px-4 text-right">Uang Keluar</th>
                <th className="py-3 px-4 text-right">Saldo Bersih</th>
                <th className="py-3 px-4 text-right">Hak Investor</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {closingHistory.map((cl) => (
                <tr key={cl.closingId || cl.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">{cl.period}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-800">
                      {cl.scope}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-700 font-bold">
                    {formatRupiah(cl.uangMasuk)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-rose-700 font-bold">
                    {formatRupiah(cl.uangKeluar)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                    {formatRupiah(cl.saldoBersih)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-purple-800 font-bold">
                    {formatRupiah(cl.hakInvestor)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black ${
                        cl.status === 'CLOSED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {cl.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => {
                        setSelectedModalClosing(cl);
                        setShowReportModal(true);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-[11px] font-bold text-slate-700 hover:bg-slate-200 transition-colors"
                    >
                      <FileText className="h-3 w-3" />
                      <span>Rincian</span>
                    </button>
                  </td>
                </tr>
              ))}

              {closingHistory.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-slate-400 italic">
                    Belum ada riwayat penutupan buku.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showReportModal && selectedModalClosing && (
        <ClosingReportModal
          closing={selectedModalClosing}
          onClose={() => {
            setShowReportModal(false);
            setSelectedModalClosing(null);
          }}
          userProfile={userProfile}
        />
      )}

      {showReopenModal && closingRecord && (
        <ReopenMonthModal
          closing={closingRecord}
          onClose={() => setShowReopenModal(false)}
          onSuccess={() => {
            setShowReopenModal(false);
            loadPeriodData();
          }}
          userProfile={userProfile}
        />
      )}

      {showAdjustmentModal && (
        <FinancialAdjustmentModal
          period={selectedPeriod}
          scope={selectedScope === 'GABUNGAN' ? 'PRIBADI' : selectedScope}
          onClose={() => setShowAdjustmentModal(false)}
          onSuccess={() => {
            setShowAdjustmentModal(false);
            loadPeriodData();
          }}
          userProfile={userProfile}
        />
      )}
    </div>
  );
};
