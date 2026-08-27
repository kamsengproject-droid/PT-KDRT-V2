import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  PieChart,
  Calendar,
  Wallet,
  Lock,
  Building,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { subscribeTransactions } from '../services/transactionService';
import { subscribeDailyPerformance } from '../services/performanceService';
import {
  FinancialTransaction,
  DailyPerformance,
} from '../types';
import {
  formatRupiah,
  formatBulanTahun,
  bulanHariIni,
  tanggalHariIni,
} from '../utils/formatters';

export const DashboardPribadiPage: React.FC = () => {
  const {
    userProfile,
    role,
    loading: authLoading,
    currentUser,
  } = useAuth();

  const [selectedMonthStr, setSelectedMonthStr] =
    useState<string>(bulanHariIni());

  const [year, setYear] = useState<number>(
    parseInt(bulanHariIni().split('-')[0], 10)
  );

  const [month, setMonth] = useState<string>(
    bulanHariIni().split('-')[1]
  );

  const [transactions, setTransactions] =
    useState<FinancialTransaction[]>([]);

  const [performances, setPerformances] =
    useState<DailyPerformance[]>([]);

  const handleMonthChange = (val: string) => {
    setSelectedMonthStr(val);

    const [y, m] = val.split('-');

    setYear(parseInt(y, 10));
    setMonth(m);
  };

  /*
   * ============================================================
   * DATA
   * ============================================================
   */
  useEffect(() => {
    if (
      authLoading ||
      !currentUser ||
      !userProfile?.active ||
      role !== 'OWNER'
    ) {
      return;
    }

    const unsubTx = subscribeTransactions(
      {
        scope: 'PRIBADI',
        status: 'ACTIVE',
      },
      setTransactions
    );

    const unsubPerf =
      subscribeDailyPerformance(
        'PRIBADI',
        setPerformances
      );

    return () => {
      unsubTx();
      unsubPerf();
    };
  }, [
    authLoading,
    currentUser?.uid,
    userProfile?.role,
    userProfile?.active,
    role,
  ]);

  const periodPrefix =
    `${year}-${month.padStart(2, '0')}`;

  /*
   * ============================================================
   * KAS & BANK PRIBADI
   *
   * IMPORTANT:
   *
   * Komisi Real bukan uang bank.
   *
   * Komisi Real hanya berasal dari dailyPerformance.
   * Uang tersebut baru menjadi Kas & Bank ketika ada
   * transaksi Pindah Dana.
   *
   * Karena itu:
   *
   * COMMISSION_REAL / TIKTOK_COMMISSION
   * -> EXCLUDE
   *
   * FUND_TRANSFER
   * -> INCLUDE NET AMOUNT
   *
   * INCOME biasa
   * -> INCLUDE
   *
   * EXPENSE
   * -> INCLUDE
   * ============================================================
   */
  const {
    totalIncome,
    totalExpense,
    netCashFlow,
  } = useMemo(() => {
    let income = 0;
    let expense = 0;

    transactions.forEach((tx) => {
      if (
        !tx.date?.startsWith(
          periodPrefix
        )
      ) {
        return;
      }

      const sourceType = String(
        tx.sourceType || ''
      ).toUpperCase();

      /*
       * Komisi Real lama yang mungkin masih
       * berada di transactions harus dikeluarkan
       * dari Kas & Bank.
       */
      if (
        sourceType ===
          'COMMISSION_REAL' ||
        sourceType ===
          'TIKTOK_COMMISSION' ||
        sourceType ===
          'TIKTOK COMMISSION'
      ) {
        return;
      }

      /*
       * Pindah Dana:
       *
       * Uang yang benar-benar diterima bank
       * adalah netAmount setelah admin TikTok.
       */
      if (
        sourceType ===
          'FUND_TRANSFER' &&
        tx.type === 'INCOME'
      ) {
        const netAmount =
          Number(
            tx.netAmount
          ) ||
          Math.max(
            0,
            Number(tx.amount) -
              Number(
                tx.adminFee || 0
              )
          );

        income += netAmount;

        return;
      }

      if (tx.type === 'INCOME') {
        income +=
          Number(tx.amount) || 0;
      }

      if (tx.type === 'EXPENSE') {
        expense +=
          Number(tx.amount) || 0;
      }
    });

    return {
      totalIncome: income,
      totalExpense: expense,
      netCashFlow:
        income - expense,
    };
  }, [
    transactions,
    periodPrefix,
  ]);

  /*
   * ============================================================
   * PERFORMANCE ACCOUNT
   *
   * Ini sengaja DIPISAH dari Kas & Bank.
   * ============================================================
   */
  const {
    gmvHariIni,
    komisiRealHariIni,
    komisiEstimasiHariIni,
    gmvBulanIni,
    komisiRealBulanIni,
    komisiEstimasiBulanIni,
  } = useMemo(() => {
    const today =
      tanggalHariIni();

    let gHariIni = 0;
    let kRealHariIni = 0;
    let kEstHariIni = 0;

    let gBulanIni = 0;
    let kRealBulanIni = 0;
    let kEstBulanIni = 0;

    performances.forEach((p) => {
      const gmv =
        Number(p.gmv) || 0;

      const estimatedCommission =
        Number(
          p.estimatedCommission
        ) || 0;

      const realCommission =
        Number(
          p.commissionReal ??
            p.realCommission
        ) || 0;

      if (p.date === today) {
        gHariIni += gmv;
        kRealHariIni +=
          realCommission;
        kEstHariIni +=
          estimatedCommission;
      }

      if (
        p.date?.startsWith(
          periodPrefix
        )
      ) {
        gBulanIni += gmv;
        kRealBulanIni +=
          realCommission;
        kEstBulanIni +=
          estimatedCommission;
      }
    });

    return {
      gmvHariIni: gHariIni,
      komisiRealHariIni:
        kRealHariIni,
      komisiEstimasiHariIni:
        kEstHariIni,
      gmvBulanIni: gBulanIni,
      komisiRealBulanIni:
        kRealBulanIni,
      komisiEstimasiBulanIni:
        kEstBulanIni,
    };
  }, [
    performances,
    periodPrefix,
  ]);

  /*
   * ============================================================
   * EXPENSE BREAKDOWN
   * ============================================================
   */
  const aggregatedExpenses =
    useMemo(() => {
      const categoryTotals:
        Record<string, number> =
        {};

      transactions.forEach(
        (tx) => {
          if (
            tx.type !==
              'EXPENSE' ||
            !tx.date?.startsWith(
              periodPrefix
            )
          ) {
            return;
          }

          const category =
            tx.category ||
            'OPERASIONAL';

          categoryTotals[
            category
          ] =
            (categoryTotals[
              category
            ] || 0) +
            (Number(tx.amount) ||
              0);
        }
      );

      return Object.entries(
        categoryTotals
      ).map(
        ([
          category,
          amount,
        ]) => ({
          category,
          amount,
        })
      );
    }, [
      transactions,
      periodPrefix,
    ]);

  /*
   * ============================================================
   * ACCESS
   * ============================================================
   */
  if (role !== 'OWNER') {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-900">
        <Lock className="mx-auto h-10 w-10 text-rose-600 mb-2" />

        <h3 className="font-bold text-base">
          Akses Dibatasi
        </h3>

        <p className="text-xs text-rose-700 mt-1">
          Halaman Dashboard Pribadi
          hanya dapat diakses oleh
          Akun Owner PT.KDRT.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ======================================================
          HEADER
          ====================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-3xl shadow-xl">

        <div className="space-y-1">

          <div className="flex items-center gap-2">

            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white uppercase tracking-wider">
              OWNER PRIVATE DASHBOARD
            </span>

            <span className="text-xs text-slate-400">
              PT. KAMSENG DIGITAL RAJA TERDEPAN
            </span>
          </div>

          <h1 className="text-2xl font-black tracking-tight text-white">
            Dashboard Keuangan Pribadi
            (100% Owner)
          </h1>

          <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
            Data terisolasi khusus kategori{' '}
            <strong>PRIBADI</strong>.
            Kas & Bank dipisahkan dari
            performa akun TikTok.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-800 rounded-2xl border border-slate-700 p-2 shrink-0">

          <Calendar className="h-4 w-4 text-orange-400 ml-1" />

          <div className="flex flex-col">

            <span className="text-[9px] font-black uppercase text-slate-400">
              Periode:
            </span>

            <input
              type="month"
              value={selectedMonthStr}
              onChange={(e) =>
                handleMonthChange(
                  e.target.value
                )
              }
              className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>
      </div>

      {/* ======================================================
          KAS & BANK PRIMARY KPI
          ====================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* UANG MASUK */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-2xs">

          <div className="flex items-center justify-between text-emerald-800">

            <span className="text-[11px] font-black uppercase tracking-wider">
              UANG MASUK
              <br />
              KAS & BANK PRIBADI
            </span>

            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>

          <div className="text-2xl font-black text-emerald-950 mt-2">
            {formatRupiah(
              totalIncome
            )}
          </div>

          <div className="text-[11px] font-medium text-emerald-700 mt-1">
            Uang aktual yang masuk
            ke Kas & Bank
          </div>
        </div>

        {/* UANG KELUAR */}
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5 shadow-2xs">

          <div className="flex items-center justify-between text-rose-800">

            <span className="text-[11px] font-black uppercase tracking-wider">
              UANG KELUAR
              <br />
              KAS & BANK PRIBADI
            </span>

            <DollarSign className="h-4 w-4 text-rose-600" />
          </div>

          <div className="text-2xl font-black text-rose-950 mt-2">
            {formatRupiah(
              totalExpense
            )}
          </div>

          <div className="text-[11px] font-medium text-rose-700 mt-1">
            Pengeluaran aktual yang
            mengurangi Kas & Bank
          </div>
        </div>

        {/* NET */}
        <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5 shadow-2xs">

          <div className="flex items-center justify-between text-blue-800">

            <span className="text-[11px] font-black uppercase tracking-wider">
              NET CASH FLOW
              <br />
              KAS & BANK PRIBADI
            </span>

            <Wallet className="h-4 w-4 text-blue-600" />
          </div>

          <div className="text-2xl font-black text-blue-950 mt-2">
            {formatRupiah(
              netCashFlow
            )}
          </div>

          <div className="text-[11px] font-medium text-blue-700 mt-1">
            Uang Masuk − Uang Keluar
          </div>
        </div>
      </div>

      {/* ======================================================
          PERFORMANCE ACCOUNT
          ====================================================== */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">

        <div className="flex items-center justify-between mb-3">

          <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">

            <Sparkles className="h-4 w-4 text-orange-500" />

            <span>
              PERFORMA AKUN TIKTOK PRIBADI (
              {formatBulanTahun(
                selectedMonthStr
              )}
              )
            </span>
          </h3>

          <span className="text-[10px] font-black uppercase text-purple-600">
            BUKAN SALDO BANK
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

          {/* GMV HARI INI */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">

            <span className="text-[10px] font-bold uppercase text-slate-500 block">
              GMV Hari Ini
            </span>

            <span className="text-base font-black text-slate-900 mt-0.5 block">
              {formatRupiah(
                gmvHariIni
              )}
            </span>
          </div>

          {/* KOMISI REAL HARI INI */}
          <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200">

            <span className="text-[10px] font-bold uppercase text-blue-700 block">
              Komisi Real Hari Ini
            </span>

            <span className="text-base font-black text-blue-950 mt-0.5 block">
              {formatRupiah(
                komisiRealHariIni
              )}
            </span>

            <span className="text-[9px] text-blue-600 font-medium">
              Belum menjadi saldo bank
            </span>
          </div>

          {/* GMV BULAN */}
          <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-200">

            <span className="text-[10px] font-bold uppercase text-indigo-700 block">
              GMV Bulan Ini
            </span>

            <span className="text-base font-black text-indigo-950 mt-0.5 block">
              {formatRupiah(
                gmvBulanIni
              )}
            </span>
          </div>

          {/* KOMISI REAL BULAN */}
          <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200">

            <span className="text-[10px] font-bold uppercase text-emerald-700 block">
              Komisi Real Bulan Ini
            </span>

            <span className="text-base font-black text-emerald-950 mt-0.5 block">
              {formatRupiah(
                komisiRealBulanIni
              )}
            </span>

            <span className="text-[9px] text-emerald-600 font-medium">
              Masuk bank melalui Pindah Dana
            </span>
          </div>
        </div>

        {/* INFO PEMISAHAN */}
        <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3">

          <div className="flex items-start gap-2">

            <Building className="h-4 w-4 text-purple-600 mt-0.5 shrink-0" />

            <div className="text-[11px] text-purple-800">

              <span className="font-black">
                PEMISAHAN PERFORMA & KAS:
              </span>{' '}

              GMV, Komisi Estimasi, dan
              Komisi Real berasal dari
              data performa akun. Komisi Real
              tidak otomatis menambah saldo
              bank. Dana baru tercatat sebagai
              uang masuk Kas & Bank setelah
              proses <strong>Pindah Dana</strong>.
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================
          EXPENSE BREAKDOWN
          ====================================================== */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">

        <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">

          <PieChart className="h-4 w-4 text-rose-600" />

          Rincian Biaya Operasional
          Pribadi (
          {formatBulanTahun(
            selectedMonthStr
          )}
          )
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-2">

          {aggregatedExpenses.map(
            (item) => (
              <div
                key={
                  item.category
                }
                className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between"
              >
                <span className="text-[10px] font-bold uppercase text-slate-500">
                  {item.category}
                </span>

                <span className="text-sm font-black text-rose-700 mt-1">
                  {formatRupiah(
                    item.amount
                  )}
                </span>
              </div>
            )
          )}

          {aggregatedExpenses.length ===
            0 && (
            <div className="col-span-full py-4 text-center text-slate-400 text-xs">
              Belum ada data pengeluaran
              pribadi tercatat untuk
              periode ini.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
