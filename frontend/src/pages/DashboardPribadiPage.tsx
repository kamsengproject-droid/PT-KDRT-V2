import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  PieChart,
  Calendar,
  Wallet,
  Lock,
  Download,
  Building,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { subscribeTransactions } from '../services/transactionService';
import { subscribeDailyPerformance } from '../services/performanceService';
import { FinancialTransaction, DailyPerformance } from '../types';
import {
  formatRupiah,
  formatTanggal,
  formatBulanTahun,
  bulanHariIni,
  tanggalHariIni,
} from '../utils/formatters';

export const DashboardPribadiPage: React.FC = () => {
  const { userProfile, role, loading: authLoading, currentUser } = useAuth();

  // Selected period
  const [selectedMonthStr, setSelectedMonthStr] = useState<string>(bulanHariIni());
  const [year, setYear] = useState<number>(parseInt(bulanHariIni().split('-')[0], 10));
  const [month, setMonth] = useState<string>(bulanHariIni().split('-')[1]);

  // Subscribed data
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [performances, setPerformances] = useState<DailyPerformance[]>([]);

  const handleMonthChange = (val: string) => {
    setSelectedMonthStr(val);
    const [y, m] = val.split('-');
    setYear(parseInt(y, 10));
    setMonth(m);
  };

  useEffect(() => {
    if (authLoading || !currentUser || !userProfile?.active || role !== 'OWNER') return;

    const unsubTx = subscribeTransactions(
      { scope: 'PRIBADI', status: 'ACTIVE' },
      setTransactions
    );
    const unsubPerf = subscribeDailyPerformance('PRIBADI', setPerformances);

    return () => {
      unsubTx();
      unsubPerf();
    };
  }, [authLoading, currentUser?.uid, userProfile?.role, userProfile?.active, role]);

  const periodPrefix = `${year}-${month.padStart(2, '0')}`;

  // Keuangan metrics (Pribadi strictly)
  const { totalIncome, totalExpense, netCashFlow } = useMemo(() => {
    let inc = 0;
    let exp = 0;

    transactions.forEach((tx) => {
      if (tx.date?.startsWith(periodPrefix)) {
        const amt = Number(tx.amount) || 0;
        if (tx.type === 'INCOME') inc += amt;
        if (tx.type === 'EXPENSE') exp += amt;
      }
    });

    return {
      totalIncome: inc,
      totalExpense: exp,
      netCashFlow: inc - exp,
    };
  }, [transactions, periodPrefix]);

  // Performance metrics: daily GMV and real commission.
  // Menggunakan collection dailyPerformance existing, tanpa collection/field baru.
  const {
    gmvHariIni,
    komisiRealHariIni,
    komisiEstimasiHariIni,
    gmvBulanIni,
    komisiRealBulanIni,
    komisiEstimasiBulanIni,
  } = useMemo(() => {
    const today = tanggalHariIni();

    let gHariIni = 0;
    let kRealHariIni = 0;
    let kEstHariIni = 0;
    let gBulanIni = 0;
    let kRealBulanIni = 0;
    let kEstBulanIni = 0;

    performances.forEach((p) => {
      const gmv = Number(p.gmv) || 0;
      const estimatedCommission = Number(p.estimatedCommission) || 0;
      const realCommission = Number(p.commissionReal ?? p.realCommission) || 0;

      if (p.date === today) {
        gHariIni += gmv;
        kRealHariIni += realCommission;
        kEstHariIni += estimatedCommission;
      }

      if (p.date?.startsWith(periodPrefix)) {
        gBulanIni += gmv;
        kRealBulanIni += realCommission;
        kEstBulanIni += estimatedCommission;
      }
    });

    return {
      gmvHariIni: gHariIni,
      komisiRealHariIni: kRealHariIni,
      komisiEstimasiHariIni: kEstHariIni,
      gmvBulanIni: gBulanIni,
      komisiRealBulanIni: kRealBulanIni,
      komisiEstimasiBulanIni: kEstBulanIni,
    };
  }, [performances, periodPrefix]);

  // Aggregated Expenses
  const aggregatedExpenses = useMemo(() => {
    const categoryTotals: Record<string, number> = {};

    transactions.forEach((tx) => {
      if (tx.type === 'EXPENSE' && tx.date?.startsWith(periodPrefix)) {
        const cat = tx.category || 'OPERASIONAL';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(tx.amount) || 0);
      }
    });

    return Object.entries(categoryTotals).map(([category, amount]) => ({
      category,
      amount,
    }));
  }, [transactions, periodPrefix]);

  if (role !== 'OWNER') {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-900">
        <Lock className="mx-auto h-10 w-10 text-rose-600 mb-2" />
        <h3 className="font-bold text-base">Akses Dibatasi</h3>
        <p className="text-xs text-rose-700 mt-1">
          Halaman Dashboard Pribadi hanya dapat diakses oleh Akun Owner PT.KDRT.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-3xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white uppercase tracking-wider">
              OWNER PRIVATE DASHBOARD
            </span>
            <span className="text-xs text-slate-400">PT. KAMSENG DIGITAL RAJA TERDEPAN</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Dashboard Keuangan Pribadi (100% Owner)
          </h1>
          <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
            Data terisolasi khusus kategori <strong>PRIBADI</strong> (100% Hak Owner, bebas dari kewajiban bagi hasil investor).
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-800 rounded-2xl border border-slate-700 p-2 shrink-0">
          <Calendar className="h-4 w-4 text-orange-400 ml-1" />
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase text-slate-400">Periode:</span>
            <input
              type="month"
              value={selectedMonthStr}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>
      </div>

      {/* Primary KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-[11px] font-black uppercase tracking-wider">
              UANG MASUK PRIBADI
            </span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-950 mt-2">
            {formatRupiah(totalIncome)}
          </div>
          <div className="text-[11px] font-medium text-emerald-700 mt-1">
            Periode {formatBulanTahun(selectedMonthStr)}
          </div>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-rose-800">
            <span className="text-[11px] font-black uppercase tracking-wider">
              UANG KELUAR PRIBADI
            </span>
            <DollarSign className="h-4 w-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-950 mt-2">
            {formatRupiah(totalExpense)}
          </div>
          <div className="text-[11px] font-medium text-rose-700 mt-1">
            Biaya Operasional Pribadi
          </div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-blue-800">
            <span className="text-[11px] font-black uppercase tracking-wider">
              NET CASH FLOW PRIBADI
            </span>
            <Wallet className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-950 mt-2">
            {formatRupiah(netCashFlow)}
          </div>
          <div className="text-[11px] font-medium text-blue-700 mt-1">
            100% Hak Penuh Owner
          </div>
        </div>
      </div>

      {/* Performance Omset */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-orange-500" />
          Ringkasan Omset & Performa TikTok Pribadi ({formatBulanTahun(selectedMonthStr)})
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-500 block">GMV Hari Ini</span>
            <span className="text-base font-black text-slate-900 mt-0.5 block">{formatRupiah(gmvHariIni)}</span>
          </div>
          <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200">
            <span className="text-[10px] font-bold uppercase text-blue-700 block">Komisi Real Hari Ini</span>
            <span className="text-base font-black text-blue-950 mt-0.5 block">{formatRupiah(komisiRealHariIni)}</span>
          </div>
          <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-200">
            <span className="text-[10px] font-bold uppercase text-indigo-700 block">GMV Bulan Ini</span>
            <span className="text-base font-black text-indigo-950 mt-0.5 block">{formatRupiah(gmvBulanIni)}</span>
          </div>
          <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200">
            <span className="text-[10px] font-bold uppercase text-emerald-700 block">Komisi Real Bulan Ini</span>
            <span className="text-base font-black text-emerald-950 mt-0.5 block">{formatRupiah(komisiRealBulanIni)}</span>
          </div>
        </div>
      </div>

      {/* Rincian Pengeluaran Teragregasi */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
          <PieChart className="h-4 w-4 text-rose-600" />
          Rincian Biaya Operasional Pribadi ({formatBulanTahun(selectedMonthStr)})
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-2">
          {aggregatedExpenses.map((item) => (
            <div
              key={item.category}
              className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between"
            >
              <span className="text-[10px] font-bold uppercase text-slate-500">
                {item.category}
              </span>
              <span className="text-sm font-black text-rose-700 mt-1">
                {formatRupiah(item.amount)}
              </span>
            </div>
          ))}

          {aggregatedExpenses.length === 0 && (
            <div className="col-span-full py-4 text-center text-slate-400 text-xs">
              Belum ada data pengeluaran pribadi tercatat untuk periode ini.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
