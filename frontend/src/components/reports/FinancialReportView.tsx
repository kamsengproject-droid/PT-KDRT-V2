import React from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  PieChart,
  Download,
  FileSpreadsheet,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import { Transaction, UserProfile, ReportScopeFilter } from '../../types';
import { formatRupiah, formatTanggal } from '../../utils/formatters';
import { exportReportData } from '../../services/exportService';

interface FinancialReportViewProps {
  transactions: Transaction[];
  userProfile: UserProfile;
  scope: ReportScopeFilter;
  dateRange: string;
}

export const FinancialReportView: React.FC<FinancialReportViewProps> = ({
  transactions,
  userProfile,
  scope,
  dateRange,
}) => {
  // 1. Calculate Single Source of Truth metrics
  let uangMasuk = 0;
  let uangKeluar = 0;
  let countIncome = 0;
  let countExpense = 0;

  const sourceTypeMap: Record<string, { total: number; count: number }> = {
    'TIKTOK COMMISSION': { total: 0, count: 0 },
    ENDORSE: { total: 0, count: 0 },
    SPONSOR: { total: 0, count: 0 },
    JASA: { total: 0, count: 0 },
    LAINNYA: { total: 0, count: 0 },
  };

  const dailyMap: Record<string, { masuk: number; keluar: number }> = {};

  transactions.forEach((tx) => {
    const amt = tx.amount || 0;
    if (tx.type === 'INCOME') {
      uangMasuk += amt;
      countIncome += 1;
      const src = tx.sourceType || 'LAINNYA';
      if (!sourceTypeMap[src]) {
        sourceTypeMap[src] = { total: 0, count: 0 };
      }
      sourceTypeMap[src].total += amt;
      sourceTypeMap[src].count += 1;
    } else if (tx.type === 'EXPENSE') {
      uangKeluar += amt;
      countExpense += 1;
    }

    if (tx.date) {
      if (!dailyMap[tx.date]) {
        dailyMap[tx.date] = { masuk: 0, keluar: 0 };
      }
      if (tx.type === 'INCOME') {
        dailyMap[tx.date].masuk += amt;
      } else {
        dailyMap[tx.date].keluar += amt;
      }
    }
  });

  const saldoBersih = uangMasuk - uangKeluar;

  const sourceTypeBreakdown = Object.entries(sourceTypeMap)
    .map(([sourceType, data]) => ({
      sourceType,
      total: data.total,
      count: data.count,
      percentage: uangMasuk > 0 ? (data.total / uangMasuk) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const dailyTrend = Object.entries(dailyMap)
    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
    .slice(0, 15);

  const handleExport = (format: 'CSV' | 'XLSX') => {
    const exportData = transactions.map((t) => ({
      Tanggal: t.date,
      Tipe: t.type === 'INCOME' ? 'UANG MASUK' : 'UANG KELUAR',
      Scope: t.scope,
      Kategori: t.category || '-',
      'Sumber Pendapatan': t.sourceType || '-',
      Deskripsi: t.description,
      Nominal: t.amount,
      Pencatat: t.createdByName || '-',
    }));

    exportReportData({
      filenamePrefix: 'laporan_keuangan',
      sheetName: 'Ringkasan Keuangan',
      category: 'KEUANGAN',
      scope,
      periodOrDateRange: dateRange,
      data: exportData,
      format,
      userProfile,
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-emerald-600" />
            <span>RINGKASAN LAPORAN KEUANGAN</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Single Source of Truth dari Buku Besar Transaksi (Tanpa manipulasi GMV)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('CSV')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => handleExport('XLSX')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Export Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* 2. Primary KPI Cards (Uang Masuk, Uang Keluar, Saldo Bersih) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* UANG MASUK */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">
              TOTAL UANG MASUK (CASH IN)
            </span>
            <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
              <ArrowDownRight className="h-5 w-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-950 font-mono tracking-tight">
            {formatRupiah(uangMasuk)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-emerald-700 font-medium">
            <span>{countIncome} Transaksi Masuk</span>
            <span className="font-bold">100% Cashflow In</span>
          </div>
        </div>

        {/* UANG KELUAR */}
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-rose-700">
              TOTAL UANG KELUAR (CASH OUT)
            </span>
            <div className="rounded-xl bg-rose-100 p-2 text-rose-700">
              <ArrowUpRight className="h-5 w-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-950 font-mono tracking-tight">
            {formatRupiah(uangKeluar)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-rose-700 font-medium">
            <span>{countExpense} Transaksi Keluar</span>
            <span className="font-bold">
              {uangMasuk > 0 ? ((uangKeluar / uangMasuk) * 100).toFixed(1) : '0'}% dari Masuk
            </span>
          </div>
        </div>

        {/* SALDO BERSIH */}
        <div
          className={`rounded-2xl border p-5 shadow-2xs ${
            saldoBersih >= 0
              ? 'border-indigo-200 bg-indigo-50/70'
              : 'border-amber-200 bg-amber-50/70'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className={`text-[11px] font-black uppercase tracking-wider ${
                saldoBersih >= 0 ? 'text-indigo-700' : 'text-amber-700'
              }`}
            >
              SALDO BERSIH (NET SURPLUS)
            </span>
            <div
              className={`rounded-xl p-2 ${
                saldoBersih >= 0
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <div
            className={`text-2xl font-black font-mono tracking-tight ${
              saldoBersih >= 0 ? 'text-indigo-950' : 'text-amber-950'
            }`}
          >
            {formatRupiah(saldoBersih)}
          </div>
          <div
            className={`mt-2 flex items-center justify-between text-xs font-bold ${
              saldoBersih >= 0 ? 'text-indigo-700' : 'text-amber-700'
            }`}
          >
            <span>Rumus: Masuk - Keluar</span>
            <span>{saldoBersih >= 0 ? 'Surplus Kas' : 'Defisit Kas'}</span>
          </div>
        </div>
      </div>

      {/* 3. Breakdown Uang Masuk Berdasarkan sourceType */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <PieChart className="h-4 w-4 text-emerald-600" />
              <span>Breakdown Uang Masuk (Source Type)</span>
            </h3>
            <span className="text-xs font-bold text-slate-500">{countIncome} Transaksi</span>
          </div>

          <div className="space-y-3">
            {sourceTypeBreakdown.map((item) => (
              <div key={item.sourceType} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{item.sourceType}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({item.count}x)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-900 font-mono">
                      {formatRupiah(item.total)}
                    </span>
                    <span className="font-black text-emerald-700 text-[11px] w-12 text-right">
                      {item.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${Math.min(100, item.percentage)}%` }}
                  />
                </div>
              </div>
            ))}

            {sourceTypeBreakdown.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-400 italic">
                Belum ada transaksi uang masuk pada periode ini.
              </div>
            )}
          </div>
        </div>

        {/* Daily Cashflow Trend */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="h-4 w-4 text-indigo-600" />
              <span>Aktivitas Kas Harian Terakhir</span>
            </h3>
            <span className="text-xs font-bold text-slate-500">{dailyTrend.length} Hari Aktif</span>
          </div>

          <div className="overflow-y-auto max-h-[320px] space-y-2 pr-1">
            {dailyTrend.map(([date, d]) => {
              const net = d.masuk - d.keluar;
              return (
                <div
                  key={date}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-900">{formatTanggal(date)}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{date}</div>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="text-emerald-700 font-bold font-mono">
                        +{formatRupiah(d.masuk)}
                      </div>
                      <div className="text-rose-600 text-[11px] font-mono">
                        -{formatRupiah(d.keluar)}
                      </div>
                    </div>
                    <div
                      className={`font-black font-mono w-24 text-right ${
                        net >= 0 ? 'text-indigo-800' : 'text-amber-800'
                      }`}
                    >
                      {formatRupiah(net)}
                    </div>
                  </div>
                </div>
              );
            })}

            {dailyTrend.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-400 italic">
                Belum ada aktivitas kas harian.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Detailed Transaction Table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
            Rincian Buku Kas Transaksi ({transactions.length})
          </h3>
          <span className="text-xs font-medium text-slate-500">Urutan kronologis</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-black text-slate-700 uppercase tracking-wider">
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4">Tipe</th>
                <th className="py-3 px-4">Scope</th>
                <th className="py-3 px-4">Sumber / Kategori</th>
                <th className="py-3 px-4">Deskripsi</th>
                <th className="py-3 px-4 text-right">Nominal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.map((tx) => (
                <tr key={tx.id || tx.transactionId} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-800">
                    {formatTanggal(tx.date)}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                        tx.type === 'INCOME'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {tx.type === 'INCOME' ? 'UANG MASUK' : 'UANG KELUAR'}
                    </span>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black ${
                        tx.scope === 'SHARING'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {tx.scope}
                    </span>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="font-bold text-slate-800">
                      {tx.type === 'INCOME' ? tx.sourceType || 'LAINNYA' : tx.category || 'OPERASIONAL'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-700">
                    <div className="font-medium line-clamp-1">{tx.description}</div>
                    {tx.createdByName && (
                      <div className="text-[10px] text-slate-400">Oleh: {tx.createdByName}</div>
                    )}
                  </td>
                  <td
                    className={`py-3 px-4 text-right whitespace-nowrap font-mono font-black ${
                      tx.type === 'INCOME' ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {tx.type === 'INCOME' ? '+' : '-'}
                    {formatRupiah(tx.amount)}
                  </td>
                </tr>
              ))}

              {transactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-slate-400 italic">
                    Tidak ada transaksi yang sesuai dengan kriteria filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
