import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  PieChart,
  Calendar,
  Share2,
  Lock,
  Download,
  Eye,
  FileSpreadsheet,
  Building,
  Sparkles,
  Layers,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  subscribeProfitSharingSettlements,
  subscribeWithdrawals,
  calculateProfitSharingFromTransactions,
  ProfitSharingCalculationResult,
} from '../services/profitSharingService';
import { subscribeTransactions } from '../services/transactionService';
import { subscribeDailyPerformance } from '../services/performanceService';
import {
  ProfitSharingSettlement,
  InvestorWithdrawal,
  FinancialTransaction,
  DailyPerformance,
} from '../types';
import {
  formatRupiah,
  formatTanggal,
  formatBulanTahun,
  bulanHariIni,
  tanggalHariIni,
} from '../utils/formatters';

export const DashboardSharingPage: React.FC = () => {
  const { userProfile, role, loading: authLoading, currentUser } = useAuth();

  // Selected period
  const [selectedMonthStr, setSelectedMonthStr] = useState<string>(bulanHariIni());
  const [year, setYear] = useState<number>(parseInt(bulanHariIni().split('-')[0], 10));
  const [month, setMonth] = useState<string>(bulanHariIni().split('-')[1]);

  // Subscribed data
  const [settlements, setSettlements] = useState<ProfitSharingSettlement[]>([]);
  const [withdrawals, setWithdrawals] = useState<InvestorWithdrawal[]>([]);
  const [sharingTransactions, setSharingTransactions] = useState<FinancialTransaction[]>([]);
  const [performances, setPerformances] = useState<DailyPerformance[]>([]);

  // Live calculation
  const [liveCalc, setLiveCalc] = useState<ProfitSharingCalculationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const handleMonthChange = (val: string) => {
    setSelectedMonthStr(val);
    const [y, m] = val.split('-');
    setYear(parseInt(y, 10));
    setMonth(m);
  };

  useEffect(() => {
    if (authLoading || !currentUser || !userProfile?.active) return;

    const unsubSet = subscribeProfitSharingSettlements(setSettlements);
    const unsubWith = subscribeWithdrawals(setWithdrawals);
    const unsubTx = subscribeTransactions(
      { scope: 'SHARING', status: 'ACTIVE' },
      setSharingTransactions
    );
    const unsubPerf = subscribeDailyPerformance('SHARING', setPerformances);

    return () => {
      unsubSet();
      unsubWith();
      unsubTx();
      unsubPerf();
    };
  }, [authLoading, currentUser?.uid, userProfile?.role, userProfile?.active]);

  useEffect(() => {
    if (authLoading || !currentUser || !userProfile?.active) return;

    let isMounted = true;
    setLoading(true);
    calculateProfitSharingFromTransactions(year, month)
      .then((res) => {
        if (isMounted) {
          setLiveCalc(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error calculating sharing dashboard:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [authLoading, currentUser?.uid, userProfile?.role, userProfile?.active, year, month]);

  // Active settlement
  const currentMonthSettlement = useMemo(() => {
    const monthKey = `${year}_${month}_SHARING`;
    return settlements.find((s) => s.settlementId === monthKey && s.status !== 'VOID');
  }, [settlements, year, month]);

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
    const periodPrefix = `${year}-${month.padStart(2, '0')}`;

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
  }, [performances, year, month]);

  // Aggregated Expenses
  const aggregatedExpenses = useMemo(() => {
    const periodPrefix = `${year}-${month.padStart(2, '0')}`;
    const categoryTotals: Record<string, number> = {};

    sharingTransactions.forEach((tx) => {
      if (tx.type === 'EXPENSE' && tx.date?.startsWith(periodPrefix)) {
        const cat = tx.category || 'OPERASIONAL';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(tx.amount) || 0);
      }
    });

    return Object.entries(categoryTotals).map(([category, amount]) => ({
      category,
      amount,
    }));
  }, [sharingTransactions, year, month]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-3xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-orange-500 text-white uppercase tracking-wider">
              SHARING DASHBOARD
            </span>
            <span className="text-xs text-slate-400">PT. KAMSENG DIGITAL RAJA TERDEPAN</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Dashboard Keuangan Sharing & Investor
          </h1>
          <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
            Monitoring performa keuangan kategori <strong>SHARING</strong>: uang kas masuk & keluar nyata, omset GMV live, serta estimasi hak bagi hasil investor (45%).
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
      {liveCalc && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-2xs">
            <div className="flex items-center justify-between text-emerald-800">
              <span className="text-[11px] font-black uppercase tracking-wider">
                UANG MASUK SHARING
              </span>
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-950 mt-2">
              {formatRupiah(liveCalc.totalIncome)}
            </div>
            <div className="text-[11px] font-medium text-emerald-700 mt-1">
              Periode {formatBulanTahun(selectedMonthStr)}
            </div>
          </div>

          <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5 shadow-2xs">
            <div className="flex items-center justify-between text-rose-800">
              <span className="text-[11px] font-black uppercase tracking-wider">
                UANG KELUAR SHARING
              </span>
              <DollarSign className="h-4 w-4 text-rose-600" />
            </div>
            <div className="text-2xl font-black text-rose-950 mt-2">
              {formatRupiah(liveCalc.totalExpense)}
            </div>
            <div className="text-[11px] font-medium text-rose-700 mt-1">
              Biaya Operasional & Inventory
            </div>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5 shadow-2xs">
            <div className="flex items-center justify-between text-blue-800">
              <span className="text-[11px] font-black uppercase tracking-wider">
                HAK INVESTOR ({liveCalc.investorPercentage}%)
              </span>
              <PieChart className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-blue-950 mt-2">
              {formatRupiah(
                currentMonthSettlement
                  ? currentMonthSettlement.investorAmount
                  : liveCalc.investorAmount
              )}
            </div>
            <div className="text-[11px] font-medium text-blue-700 mt-1">
              {currentMonthSettlement
                ? `Status: ${currentMonthSettlement.status}`
                : 'Estimasi Berjalan (Live)'}
            </div>
          </div>

          <div className="rounded-2xl border border-purple-200 bg-purple-50/70 p-5 shadow-2xs">
            <div className="flex items-center justify-between text-purple-800">
              <span className="text-[11px] font-black uppercase tracking-wider">
                HAK OWNER ({liveCalc.ownerPercentage}%)
              </span>
              <Building className="h-4 w-4 text-purple-600" />
            </div>
            <div className="text-2xl font-black text-purple-950 mt-2">
              {formatRupiah(
                currentMonthSettlement
                  ? currentMonthSettlement.ownerAmount
                  : liveCalc.ownerAmount
              )}
            </div>
            <div className="text-[11px] font-medium text-purple-700 mt-1">
              Bagian Manajemen Operasional
            </div>
          </div>
        </div>
      )}

      {/* Performance Omset */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-orange-500" />
          Ringkasan Omset & Performa TikTok Sharing ({formatBulanTahun(selectedMonthStr)})
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
          Rincian Biaya Operasional Sharing ({formatBulanTahun(selectedMonthStr)})
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
              Belum ada data pengeluaran sharing tercatat untuk periode ini.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
