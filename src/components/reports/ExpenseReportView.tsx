import React from 'react';
import { TrendingDown, PieChart, Download, FileSpreadsheet, Layers } from 'lucide-react';
import { Expense, UserProfile, ReportScopeFilter } from '../../types';
import { formatRupiah, formatTanggal } from '../../utils/formatters';
import { exportReportData } from '../../services/exportService';

interface ExpenseReportViewProps {
  expenses: Expense[];
  userProfile: UserProfile;
  scope: ReportScopeFilter;
  dateRange: string;
}

export const ExpenseReportView: React.FC<ExpenseReportViewProps> = ({
  expenses,
  userProfile,
  scope,
  dateRange,
}) => {
  let totalExpense = 0;
  const categoryMap: Record<string, { nominal: number; count: number }> = {};

  expenses.forEach((e) => {
    const amt = e.amount || 0;
    totalExpense += amt;
    const cat = e.category || 'OPERASIONAL';
    if (!categoryMap[cat]) {
      categoryMap[cat] = { nominal: 0, count: 0 };
    }
    categoryMap[cat].nominal += amt;
    categoryMap[cat].count += 1;
  });

  const categoryBreakdown = Object.entries(categoryMap)
    .map(([category, data]) => ({
      category,
      nominal: data.nominal,
      count: data.count,
      percentage: totalExpense > 0 ? (data.nominal / totalExpense) * 100 : 0,
    }))
    .sort((a, b) => b.nominal - a.nominal)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  const topExpenseItems = [...expenses].sort((a, b) => (b.amount || 0) - (a.amount || 0)).slice(0, 10);

  const handleExport = (format: 'CSV' | 'XLSX') => {
    const exportData = expenses.map((e) => ({
      Tanggal: e.date,
      Kategori: e.category,
      Scope: e.scope,
      Keterangan: e.name || e.description || '-',
      Nominal: e.amount,
      Pencatat: e.createdByName || '-',
    }));

    exportReportData({
      filenamePrefix: 'laporan_pengeluaran',
      sheetName: 'Pengeluaran',
      category: 'PENGELUARAN',
      scope,
      periodOrDateRange: dateRange,
      data: exportData,
      format,
      userProfile,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-rose-600" />
            <span>LAPORAN PENGELUARAN & EXPENSE OPERASIONAL</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Struktur Biaya Operasional, Ranking Kategori, dan Analisis Beban Usaha
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
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-rose-700 transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Export Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Total Card */}
      <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-black uppercase tracking-wider text-rose-700">
            TOTAL PENGELUARAN PERIODE INI
          </span>
          <div className="text-3xl font-black text-rose-950 font-mono tracking-tight mt-1">
            {formatRupiah(totalExpense)}
          </div>
        </div>
        <div className="text-xs font-bold text-rose-800 bg-rose-100 px-4 py-2 rounded-xl">
          {expenses.length} Transaksi Beban Tercatat
        </div>
      </div>

      {/* Category Breakdown Cards / Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <PieChart className="h-4 w-4 text-rose-600" />
              <span>Ranking Beban Berdasarkan Kategori</span>
            </h3>
            <span className="text-xs font-bold text-slate-500">{categoryBreakdown.length} Kategori</span>
          </div>

          <div className="space-y-3">
            {categoryBreakdown.map((cat) => (
              <div key={cat.category} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-slate-400">#{cat.rank}</span>
                    <span className="font-bold text-slate-900">{cat.category}</span>
                    <span className="text-[10px] text-slate-400">({cat.count}x)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-900 font-mono">
                      {formatRupiah(cat.nominal)}
                    </span>
                    <span className="font-black text-rose-700 text-[11px] w-12 text-right">
                      {cat.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-rose-500 transition-all duration-300"
                    style={{ width: `${Math.min(100, cat.percentage)}%` }}
                  />
                </div>
              </div>
            ))}

            {categoryBreakdown.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-400 italic">
                Belum ada data pengeluaran pada periode ini.
              </div>
            )}
          </div>
        </div>

        {/* Top 10 Single Expense Items */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Layers className="h-4 w-4 text-amber-600" />
              <span>10 Pengeluaran Nominal Terbesar</span>
            </h3>
          </div>

          <div className="overflow-y-auto max-h-[360px] space-y-2 pr-1">
            {topExpenseItems.map((item, idx) => (
              <div
                key={item.id || idx}
                className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-black text-slate-400 w-5">#{idx + 1}</span>
                  <div>
                    <div className="font-bold text-slate-900 line-clamp-1">
                      {item.name || item.description || item.category}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {formatTanggal(item.date)} • {item.category}
                    </div>
                  </div>
                </div>
                <div className="font-black text-rose-700 font-mono whitespace-nowrap">
                  {formatRupiah(item.amount)}
                </div>
              </div>
            ))}

            {topExpenseItems.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-400 italic">
                Belum ada transaksi pengeluaran.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
