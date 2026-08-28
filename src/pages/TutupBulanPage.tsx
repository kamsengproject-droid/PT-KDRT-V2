import React, { useState, useEffect } from 'react';
import {
  Lock,
  Unlock,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  FileText,
  Wallet,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import {
  UserProfile,
  MonthlyClosing,
  ScopeType,
  FinancialAdjustment,
} from '../types';
import { formatRupiah, formatTanggal } from '../utils/formatters';
import {
  computeMonthlySnapshot,
  closeMonth,
  getMonthlyClosing,
} from '../services/closingService';
import { ClosingReportModal } from '../components/reports/ClosingReportModal';
import { ReopenMonthModal } from '../components/reports/ReopenMonthModal';
import { FinancialAdjustmentModal } from '../components/reports/FinancialAdjustmentModal';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

interface TutupBulanPageProps {
  userProfile?: UserProfile;
}

export const TutupBulanPage: React.FC<TutupBulanPageProps> = ({
  userProfile: propUserProfile,
}) => {
  const {
    userProfile: authUserProfile,
    loading: authLoading,
    currentUser,
  } = useAuth();

  const userProfile =
    propUserProfile || authUserProfile;

  const isOwner =
    userProfile?.role === 'OWNER';

  const isInvestor =
    userProfile?.role === 'INVESTOR';

  const defaultPeriod = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month =
      d.getMonth() + 1 < 10
        ? `0${d.getMonth() + 1}`
        : `${d.getMonth() + 1}`;

    return `${year}-${month}`;
  };

  const [selectedPeriod, setSelectedPeriod] =
    useState(defaultPeriod());

  const [selectedScope, setSelectedScope] =
    useState<ScopeType>(
      isInvestor ? 'SHARING' : 'GABUNGAN'
    );

  const [closingRecord, setClosingRecord] =
    useState<MonthlyClosing | null>(null);

  const [livePreview, setLivePreview] =
    useState<MonthlyClosing | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [closingLoading, setClosingLoading] =
    useState(false);

  const [closingHistory, setClosingHistory] =
    useState<MonthlyClosing[]>([]);

  const [adjustments, setAdjustments] =
    useState<FinancialAdjustment[]>([]);

  const [showReportModal, setShowReportModal] =
    useState(false);

  const [
    selectedModalClosing,
    setSelectedModalClosing,
  ] = useState<MonthlyClosing | null>(null);

  const [showReopenModal, setShowReopenModal] =
    useState(false);

  const [
    showAdjustmentModal,
    setShowAdjustmentModal,
  ] = useState(false);

  /*
   * ============================================================
   * REALTIME CLOSING HISTORY
   * ============================================================
   */
  useEffect(() => {
    if (
      authLoading ||
      !currentUser ||
      !userProfile?.active
    ) {
      return;
    }

    const unsubClosing = onSnapshot(
      collection(db, 'monthlyClosings'),
      (snap) => {
        const list = snap.docs
          .map(
            (d) =>
              ({
                id: d.id,
                ...d.data(),
              }) as MonthlyClosing
          )
          .sort((a, b) =>
            b.period > a.period ? 1 : -1
          );

        setClosingHistory(list);
      }
    );

    const unsubAdjustment = onSnapshot(
      collection(
        db,
        'financialAdjustments'
      ),
      (snap) => {
        const list = snap.docs
          .map(
            (d) =>
              ({
                id: d.id,
                ...d.data(),
              }) as FinancialAdjustment
          )
          .sort((a, b) =>
            String(b.createdAt || '').localeCompare(
              String(a.createdAt || '')
            )
          );

        setAdjustments(list);
      }
    );

    return () => {
      unsubClosing();
      unsubAdjustment();
    };
  }, [
    authLoading,
    currentUser?.uid,
    userProfile?.role,
    userProfile?.active,
  ]);

  /*
   * ============================================================
   * LOAD PERIOD
   * ============================================================
   */
  const loadPeriodData = async () => {
    setLoading(true);

    try {
      const existing =
        await getMonthlyClosing(
          selectedPeriod,
          selectedScope
        );

      setClosingRecord(existing);

      if (
        !existing ||
        existing.status === 'OPEN'
      ) {
        const preview =
          await computeMonthlySnapshot(
            selectedPeriod,
            selectedScope
          );

        setLivePreview(
          preview as MonthlyClosing
        );
      } else {
        setLivePreview(existing);
      }
    } catch (error) {
      console.error(
        'Error loading closing data:',
        error
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPeriodData();
  }, [
    selectedPeriod,
    selectedScope,
  ]);

  /*
   * ============================================================
   * CLOSE MONTH
   * ============================================================
   */
  const handleExecuteClose = async () => {
    if (!isOwner) {
      alert(
        'Hanya Owner yang berwenang menutup buku bulanan.'
      );
      return;
    }

    if (!userProfile) {
      alert(
        'Data profil Owner tidak ditemukan.'
      );
      return;
    }

    const confirmMsg =
      `Konfirmasi Penutupan Buku:\n\n` +
      `Apakah Anda yakin ingin MENUTUP buku periode ` +
      `${selectedPeriod} (${selectedScope})?\n\n` +
      `Setelah ditutup, data keuangan periode ini ` +
      `akan dibekukan sebagai Snapshot Resmi.`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    setClosingLoading(true);

    try {
      await closeMonth(
        selectedPeriod,
        selectedScope,
        `Tutup buku reguler periode ${selectedPeriod} oleh ${userProfile.name}`,
        userProfile
      );

      alert(
        `Buku bulan ${selectedPeriod} (${selectedScope}) berhasil DITUTUP dan dibekukan.`
      );

      await loadPeriodData();
    } catch (error: any) {
      console.error(
        'Close month error:',
        error
      );

      alert(
        `Gagal menutup bulan: ${
          error?.message ||
          'Terjadi kesalahan.'
        }`
      );
    } finally {
      setClosingLoading(false);
    }
  };

  const isClosed =
    closingRecord?.status === 'CLOSED';

  const displayData =
    isClosed
      ? closingRecord
      : livePreview;

  const currentAdjustments =
    adjustments.filter(
      (adjustment) =>
        adjustment.period ===
          selectedPeriod &&
        (
          selectedScope === 'GABUNGAN' ||
          adjustment.scope ===
            selectedScope
        )
    );

  /*
   * ============================================================
   * ACCESS GUARD
   * ============================================================
   */
  if (
    !userProfile &&
    !authLoading
  ) {
    return (
      <div className="p-8 text-center text-slate-500">
        Profil pengguna tidak ditemukan.
      </div>
    );
  }

  /*
   * ============================================================
   * PAGE
   * ============================================================
   */
  return (
    <div className="space-y-6 pb-12">

      {/* ======================================================
          HEADER
          ====================================================== */}
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
              Pembekuan Data Kas & Bank,
              Rekonsiliasi, Laporan Resmi,
              dan Financial Adjustment
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300">
            Wewenang Closing:{' '}
            <span className="text-orange-400 font-black">
              {isOwner
                ? 'Owner'
                : 'Read Only'}
            </span>
          </div>
        </div>
      </div>

      {/* ======================================================
          PERIOD & SCOPE
          ====================================================== */}
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
                onChange={(e) =>
                  setSelectedPeriod(
                    e.target.value
                  )
                }
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
                  onChange={(e) =>
                    setSelectedScope(
                      e.target.value as ScopeType
                    )
                  }
                  className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-100"
                >
                  <option value="GABUNGAN">
                    GABUNGAN (Semua)
                  </option>

                  <option value="PRIBADI">
                    PRIBADI
                  </option>

                  <option value="SHARING">
                    SHARING
                  </option>
                </select>
              )}
            </div>

            <button
              onClick={loadPeriodData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 self-end px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs mt-auto disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  loading
                    ? 'animate-spin'
                    : ''
                }`}
              />

              <span>
                Refresh Data
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">

            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider ${
                isClosed
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              {isClosed ? (
                <Lock className="h-3.5 w-3.5" />
              ) : (
                <Unlock className="h-3.5 w-3.5" />
              )}

              <span>
                {isClosed
                  ? 'STATUS: DITUTUP (CLOSED)'
                  : 'STATUS: TERBUKA (OPEN)'}
              </span>
            </span>

            {displayData && (
              <button
                onClick={() => {
                  setSelectedModalClosing(
                    displayData
                  );

                  setShowReportModal(
                    true
                  );
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 text-xs font-black text-white hover:bg-slate-800 transition-colors shadow-2xs"
              >
                <FileText className="h-3.5 w-3.5" />

                <span>
                  Lihat Laporan Lengkap
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================
          DATA
          ====================================================== */}
      {loading ? (
        <div className="py-16 text-center space-y-3 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="h-8 w-8 animate-spin text-orange-600 mx-auto" />

          <div className="text-xs font-bold text-slate-500">
            Menghitung snapshot data periode{' '}
            {selectedPeriod}...
          </div>
        </div>
      ) : displayData ? (
        <div className="space-y-6">

          {/* ==================================================
              STATUS
              ================================================== */}
          {isClosed ? (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">

              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />

                <div>
                  <span className="font-black text-emerald-950 uppercase tracking-wider">
                    Snapshot Buku Periode{' '}
                    {selectedPeriod}{' '}
                    Telah Dibekukan
                  </span>

                  <p className="text-emerald-700 font-medium mt-0.5">
                    Ditutup oleh{' '}
                    <span className="font-bold">
                      {displayData.closedByName}
                    </span>{' '}
                    pada{' '}
                    {displayData.closedAt
                      ? formatTanggal(
                          displayData.closedAt
                        )
                      : '-'}
                    .
                  </p>
                </div>
              </div>

              {isOwner && (
                <div className="flex items-center gap-2">

                  <button
                    onClick={() =>
                      setShowAdjustmentModal(
                        true
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 text-white font-black text-xs hover:bg-orange-700 transition-colors shadow-2xs"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />

                    <span>
                      Input Financial Adjustment
                    </span>
                  </button>

                  <button
                    onClick={() =>
                      setShowReopenModal(
                        true
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-100 text-amber-900 font-black text-xs hover:bg-amber-200 transition-colors"
                  >
                    <Unlock className="h-3.5 w-3.5" />

                    <span>
                      Buka Kembali Bulan
                    </span>
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
                    Periode{' '}
                    {selectedPeriod}{' '}
                    Masih Terbuka
                  </span>

                  <p className="text-amber-800 font-medium mt-0.5">
                    Nilai dihitung langsung dari
                    database. Tutup buku untuk
                    membekukan laporan resmi.
                  </p>
                </div>
              </div>

              {isOwner && (
                <button
                  onClick={
                    handleExecuteClose
                  }
                  disabled={
                    closingLoading
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 text-white font-black text-xs hover:bg-orange-700 transition-colors shadow-md disabled:opacity-50"
                >
                  {closingLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Lock className="h-3.5 w-3.5" />
                  )}

                  <span>
                    TUTUP BULAN INI (
                    {selectedPeriod})
                  </span>
                </button>
              )}
            </div>
          )}

          {/* ==================================================
              KAS & BANK MASTER METRICS
              ================================================== */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            {/* UANG MASUK */}
            <div className="p-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 shadow-2xs">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-emerald-700" />

                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                  KAS & BANK
                  <br />
                  UANG MASUK
                </span>
              </div>

              <div className="text-2xl font-black text-emerald-950 font-mono tracking-tight mt-2">
                {formatRupiah(
                  displayData.uangMasuk
                )}
              </div>

              <div className="mt-1 text-xs text-emerald-700 font-medium">
                Uang yang benar-benar masuk
                ke kas atau rekening bank
              </div>
            </div>

            {/* UANG KELUAR */}
            <div className="p-5 rounded-2xl border border-rose-200 bg-rose-50/70 shadow-2xs">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-rose-700" />

                <span className="text-[10px] font-black uppercase tracking-wider text-rose-700">
                  KAS & BANK
                  <br />
                  UANG KELUAR
                </span>
              </div>

              <div className="text-2xl font-black text-rose-950 font-mono tracking-tight mt-2">
                {formatRupiah(
                  displayData.uangKeluar
                )}
              </div>

              <div className="mt-1 text-xs text-rose-700 font-medium">
                Pengeluaran yang tercatat
                sebagai kas atau bank
              </div>
            </div>

            {/* SALDO */}
            <div className="p-5 rounded-2xl border border-indigo-200 bg-indigo-50/70 shadow-2xs">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-indigo-700" />

                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700">
                  SALDO KAS & BANK
                </span>
              </div>

              <div className="text-2xl font-black text-indigo-950 font-mono tracking-tight mt-2">
                {formatRupiah(
                  displayData.saldoBersih
                )}
              </div>

              <div className="mt-1 text-xs text-indigo-700 font-medium">
                Uang Masuk − Uang Keluar
              </div>
            </div>
          </div>

          {/* ==================================================
              PERFORMANCE / FINANCIAL SECONDARY METRICS
              ================================================== */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">

            {/* GMV */}
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                TOTAL GMV
              </div>

              <div className="text-base font-black font-mono text-slate-900 mt-1">
                {formatRupiah(
                  displayData.gmv
                )}
              </div>

              <div className="mt-1 text-[10px] text-slate-500">
                Performa penjualan
              </div>
            </div>

            {/* KOMISI REAL */}
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 shadow-2xs">
              <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                KOMISI REAL
              </div>

              <div className="text-base font-black font-mono text-emerald-900 mt-1">
                {formatRupiah(
                  displayData.komisiReal
                )}
              </div>

              <div className="mt-1 text-[10px] text-emerald-700">
                Performa akun, belum menjadi
                saldo bank
              </div>
            </div>

            {/* EXPENSE */}
            <div className="p-4 rounded-xl bg-white border border-rose-200 shadow-2xs">
              <div className="text-[10px] font-black uppercase tracking-wider text-rose-700">
                TOTAL EXPENSE
              </div>

              <div className="text-base font-black font-mono text-rose-900 mt-1">
                {formatRupiah(
                  displayData.totalExpense
                )}
              </div>

              <div className="mt-1 text-[10px] text-rose-700">
                Total pengeluaran
              </div>
            </div>

            {/* INVESTOR */}
            <div className="p-4 rounded-xl bg-white border border-purple-200 shadow-2xs">
              <div className="text-[10px] font-black uppercase tracking-wider text-purple-700">
                HAK INVESTOR
              </div>

              <div className="text-base font-black font-mono text-purple-900 mt-1">
                {formatRupiah(
                  displayData.hakInvestor
                )}
              </div>

              <div className="mt-1 text-[10px] text-purple-700">
                Kewajiban profit sharing
              </div>
            </div>
          </div>

          {/* ==================================================
              RECONCILIATION
              ================================================== */}
          {displayData.reconciliationSnapshot && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">

              <div className="flex items-center justify-between border-b border-slate-100 pb-2">

                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Rekonsiliasi Saldo Kas & Bank
                </h3>

                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-black ${
                    displayData
                      .reconciliationSnapshot
                      .status ===
                    'SEIMBANG'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  STATUS:{' '}
                  {
                    displayData
                      .reconciliationSnapshot
                      .status
                  }
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-400 font-bold">
                    Saldo Buku Sistem
                  </div>

                  <div className="text-base font-black font-mono text-slate-900 mt-0.5">
                    {formatRupiah(
                      displayData
                        .reconciliationSnapshot
                        .saldoBuku
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-400 font-bold">
                    Saldo Fisik Aktual
                  </div>

                  <div className="text-base font-black font-mono text-slate-900 mt-0.5">
                    {formatRupiah(
                      displayData
                        .reconciliationSnapshot
                        .saldoAktual
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-400 font-bold">
                    Selisih Kas
                  </div>

                  <div
                    className={`text-base font-black font-mono mt-0.5 ${
                      displayData
                        .reconciliationSnapshot
                        .selisih === 0
                        ? 'text-emerald-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {formatRupiah(
                      displayData
                        .reconciliationSnapshot
                        .selisih
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================
              ADJUSTMENTS
              ================================================== */}
          {currentAdjustments.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">

              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Riwayat Financial Adjustment
                  Periode Ini (
                  {currentAdjustments.length})
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">

                  <thead>
                    <tr className="bg-slate-50 text-slate-700 font-black uppercase border-b border-slate-200">
                      <th className="py-2.5 px-4">
                        Tipe
                      </th>

                      <th className="py-2.5 px-4">
                        Deskripsi & Alasan
                      </th>

                      <th className="py-2.5 px-4 text-right">
                        Nominal
                      </th>

                      <th className="py-2.5 px-4">
                        Dibuat Oleh
                      </th>

                      <th className="py-2.5 px-4">
                        Waktu
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {currentAdjustments.map(
                      (adjustment) => (
                        <tr
                          key={
                            adjustment.id ||
                            adjustment.adjustmentId
                          }
                          className="hover:bg-slate-50"
                        >
                          <td className="py-2.5 px-4 font-bold">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                adjustment.type ===
                                'INCOME_ADJUSTMENT'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {adjustment.type}
                            </span>
                          </td>

                          <td className="py-2.5 px-4">
                            <div className="font-bold text-slate-900">
                              {
                                adjustment.description
                              }
                            </div>

                            <div className="text-[10px] text-slate-500 italic">
                              "
                              {
                                adjustment.reason
                              }
                              "
                            </div>
                          </td>

                          <td className="py-2.5 px-4 text-right font-mono font-black text-slate-900">
                            {formatRupiah(
                              adjustment.amount
                            )}
                          </td>

                          <td className="py-2.5 px-4 text-slate-700">
                            {
                              adjustment.createdByName
                            }
                          </td>

                          <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px]">
                            {formatTanggal(
                              adjustment.createdAt
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400">
          Tidak ada data untuk periode
          yang dipilih.
        </div>
      )}

      {/* ======================================================
          HISTORICAL CLOSING
          ====================================================== */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">

        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
            Riwayat Penutupan Buku Seluruh
            Periode (
            {closingHistory.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">

            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-black text-slate-700 uppercase tracking-wider">

                <th className="py-3 px-4">
                  Periode
                </th>

                <th className="py-3 px-4">
                  Scope
                </th>

                <th className="py-3 px-4 text-right">
                  Kas & Bank Masuk
                </th>

                <th className="py-3 px-4 text-right">
                  Kas & Bank Keluar
                </th>

                <th className="py-3 px-4 text-right">
                  Saldo Kas & Bank
                </th>

                <th className="py-3 px-4 text-right">
                  Hak Investor
                </th>

                <th className="py-3 px-4 text-center">
                  Status
                </th>

                <th className="py-3 px-4 text-center">
                  Aksi
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">

              {closingHistory.map(
                (closing) => (
                  <tr
                    key={
                      closing.closingId ||
                      closing.id
                    }
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {closing.period}
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-800">
                        {closing.scope}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-emerald-700 font-bold">
                      {formatRupiah(
                        closing.uangMasuk
                      )}
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-rose-700 font-bold">
                      {formatRupiah(
                        closing.uangKeluar
                      )}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                      {formatRupiah(
                        closing.saldoBersih
                      )}
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-purple-800 font-bold">
                      {formatRupiah(
                        closing.hakInvestor
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black ${
                          closing.status ===
                          'CLOSED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {closing.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => {
                          setSelectedModalClosing(
                            closing
                          );

                          setShowReportModal(
                            true
                          );
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-[11px] font-bold text-slate-700 hover:bg-slate-200 transition-colors"
                      >
                        <FileText className="h-3 w-3" />

                        <span>
                          Rincian
                        </span>
                      </button>
                    </td>
                  </tr>
                )
              )}

              {closingHistory.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="py-12 text-center text-xs text-slate-400 italic"
                  >
                    Belum ada riwayat
                    penutupan buku.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================
          MODALS
          ====================================================== */}

      {showReportModal &&
        selectedModalClosing && (
          <ClosingReportModal
            closing={
              selectedModalClosing
            }
            onClose={() => {
              setShowReportModal(false);
              setSelectedModalClosing(
                null
              );
            }}
            userProfile={userProfile}
          />
        )}

      {showReopenModal &&
        closingRecord && (
          <ReopenMonthModal
            closing={closingRecord}
            onClose={() =>
              setShowReopenModal(false)
            }
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
          scope={
            selectedScope === 'GABUNGAN'
              ? 'PRIBADI'
              : selectedScope
          }
          onClose={() =>
            setShowAdjustmentModal(false)
          }
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
