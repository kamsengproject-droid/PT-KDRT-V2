import React from 'react';
import { PieChart, DollarSign, CheckCircle2, Clock, Download, FileSpreadsheet } from 'lucide-react';
import { ProfitSharingSettlement, UserProfile, ReportScopeFilter } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { exportReportData } from '../../services/exportService';

interface ProfitSharingReportViewProps {
  settlements: ProfitSharingSettlement[];
  userProfile: UserProfile;
  scope: ReportScopeFilter;
  dateRange: string;
}

export const ProfitSharingReportView: React.FC<ProfitSharingReportViewProps> = ({
  settlements,
  userProfile,
  scope,
  dateRange,
}) => {
  let totalUangMasukSharing = 0;
  let totalHakInvestor = 0;
  let totalHakOwner = 0;
  let totalHakTalent = 0;
  let totalHakEditor = 0;
  let totalBudgetPerusahaan = 0;
  let totalSudahDibayar = 0;
  let totalBelumDibayar = 0;

  settlements.forEach((s) => {
    totalUangMasukSharing += s.totalUangMasuk || 0;
    totalHakInvestor += s.bagianInvestor || 0;
    totalHakOwner += s.bagianOwner || 0;
    totalHakTalent += s.bagianTalent || 0;
    totalHakEditor += s.bagianEditor || 0;
    totalBudgetPerusahaan += s.budgetPerusahaan || 0;

    if (s.statusPembayaran === 'PAID') {
      totalSudahDibayar += s.bagianInvestor || 0;
    } else {
      totalBelumDibayar += s.bagianInvestor || 0;
    }
  });

  const handleExport = (format: 'CSV' | 'XLSX') => {
    const exportData = settlements.map((s) => ({
      Periode: s.period,
      Tier: s.tierName || `Tier ${s.tier}`,
      'Total Uang Masuk Sharing': s.totalUangMasuk || 0,
      'Hak Investor': s.bagianInvestor || 0,
      'Hak Owner': s.bagianOwner || 0,
      'Hak Talent': s.bagianTalent || 0,
      'Hak Editor': s.bagianEditor || 0,
      'Budget Perusahaan': s.budgetPerusahaan || 0,
      'Status Pembayaran Investor': s.statusPembayaran,
    }));

    exportReportData({
      filenamePrefix: 'laporan_profit_sharing',
      sheetName: 'Profit Sharing',
      category: 'PROFIT_SHARING',
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
            <PieChart className="h-5 w-5 text-purple-600" />
            <span>LAPORAN REKAPITULASI PROFIT SHARING</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Distribusi Bagi Hasil Berdasarkan Settlement Final (Investor, Owner, Talent, Editor, dan Kas Perusahaan)
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
            className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-purple-700 transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Export Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-purple-200 bg-purple-50/70 p-5 shadow-2xs">
          <span className="text-[11px] font-black uppercase tracking-wider text-purple-700">
            TOTAL UANG MASUK SHARING
          </span>
          <div className="text-2xl font-black text-purple-950 font-mono tracking-tight mt-1">
            {formatRupiah(totalUangMasukSharing)}
          </div>
          <div className="mt-2 text-xs text-purple-700 font-medium">
            Dasar pembagian porsi profit sharing
          </div>
        </div>

        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-5 shadow-2xs">
          <span className="text-[11px] font-black uppercase tracking-wider text-indigo-700">
            TOTAL HAK INVESTOR
          </span>
          <div className="text-2xl font-black text-indigo-950 font-mono tracking-tight mt-1">
            {formatRupiah(totalHakInvestor)}
          </div>
          <div className="mt-2 text-xs text-indigo-700 font-medium">
            Kewajiban bagi hasil investor
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-2xs">
          <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">
            HAK INVESTOR SUDAH DIBAYAR
          </span>
          <div className="text-2xl font-black text-emerald-950 font-mono tracking-tight mt-1">
            {formatRupiah(totalSudahDibayar)}
          </div>
          <div className="mt-2 text-xs text-emerald-700 font-medium">
            Sisa Belum Bayar: <span className="font-bold font-mono">{formatRupiah(totalBelumDibayar)}</span>
          </div>
        </div>
      </div>

      {/* Breakdown Porsi Stakeholders */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-black uppercase tracking-wider text-indigo-700">Investor</div>
          <div className="text-base font-black font-mono text-indigo-950 mt-1">{formatRupiah(totalHakInvestor)}</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-700">Owner</div>
          <div className="text-base font-black font-mono text-slate-900 mt-1">{formatRupiah(totalHakOwner)}</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-black uppercase tracking-wider text-amber-700">Talent</div>
          <div className="text-base font-black font-mono text-amber-900 mt-1">{formatRupiah(totalHakTalent)}</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-black uppercase tracking-wider text-blue-700">Editor</div>
          <div className="text-base font-black font-mono text-blue-900 mt-1">{formatRupiah(totalHakEditor)}</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Budget Perusahaan</div>
          <div className="text-base font-black font-mono text-emerald-900 mt-1">{formatRupiah(totalBudgetPerusahaan)}</div>
        </div>
      </div>

      {/* Settlement History Table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
            Rincian Settlement Profit Sharing ({settlements.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-black text-slate-700 uppercase tracking-wider">
                <th className="py-3 px-4">Periode</th>
                <th className="py-3 px-4">Tier</th>
                <th className="py-3 px-4 text-right">Uang Masuk</th>
                <th className="py-3 px-4 text-right">Hak Investor</th>
                <th className="py-3 px-4 text-right">Hak Owner</th>
                <th className="py-3 px-4 text-right">Talent & Editor</th>
                <th className="py-3 px-4 text-right">Budget PT</th>
                <th className="py-3 px-4 text-center">Status Bayar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {settlements.map((s) => (
                <tr key={s.id || s.settlementId} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">{s.period}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-black bg-purple-100 text-purple-800">
                      {s.tierName || `Tier ${s.tier}`}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-700 font-bold">
                    {formatRupiah(s.totalUangMasuk || 0)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-black text-indigo-700">
                    {formatRupiah(s.bagianInvestor || 0)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-700">
                    {formatRupiah(s.bagianOwner || 0)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-700">
                    {formatRupiah((s.bagianTalent || 0) + (s.bagianEditor || 0))}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-700">
                    {formatRupiah(s.budgetPerusahaan || 0)}
                  </td>
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                        s.statusPembayaran === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {s.statusPembayaran}
                    </span>
                  </td>
                </tr>
              ))}

              {settlements.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-slate-400 italic">
                    Belum ada settlement profit sharing yang dibuat.
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
