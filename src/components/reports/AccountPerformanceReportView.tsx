import React from 'react';
import { Smartphone, TrendingUp, TrendingDown, DollarSign, Download, FileSpreadsheet, Percent } from 'lucide-react';
import { DailyPerformance, Account, UserProfile, ReportScopeFilter } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { exportReportData } from '../../services/exportService';

interface AccountPerformanceReportViewProps {
  performances: DailyPerformance[];
  accounts: Account[];
  userProfile: UserProfile;
  scope: ReportScopeFilter;
  dateRange: string;
}

export const AccountPerformanceReportView: React.FC<AccountPerformanceReportViewProps> = ({
  performances,
  accounts,
  userProfile,
  scope,
  dateRange,
}) => {
  // Aggregate by Account
  const accountMap: Record<
    string,
    {
      accountId: string;
      accountName: string;
      scope: string;
      gmv: number;
      estimatedCommission: number;
      realCommission: number;
      entriesCount: number;
    }
  > = {};

  let totalGmv = 0;
  let totalEst = 0;
  let totalReal = 0;

  performances.forEach((p) => {
    const accId = p.accountId || 'UNKNOWN';
    if (!accountMap[accId]) {
      const acc = accounts.find((a) => a.id === accId);
      accountMap[accId] = {
        accountId: accId,
        accountName: p.accountName || acc?.accountName || 'Akun ' + accId,
        scope: p.scope || acc?.scope || 'PRIBADI',
        gmv: 0,
        estimatedCommission: 0,
        realCommission: 0,
        entriesCount: 0,
      };
    }

    accountMap[accId].gmv += p.gmv || 0;
    accountMap[accId].estimatedCommission += p.estimatedCommission || 0;
    accountMap[accId].realCommission += p.realCommission || 0;
    accountMap[accId].entriesCount += 1;

    totalGmv += p.gmv || 0;
    totalEst += p.estimatedCommission || 0;
    totalReal += p.realCommission || 0;
  });

  const accountList = Object.values(accountMap).sort((a, b) => b.realCommission - a.realCommission);

  const handleExport = (format: 'CSV' | 'XLSX') => {
    const exportData = accountList.map((a, idx) => ({
      Rank: idx + 1,
      'Nama Akun': a.accountName,
      Scope: a.scope,
      'GMV (Omzet)': a.gmv,
      'Estimasi Komisi': a.estimatedCommission,
      'Komisi Real': a.realCommission,
      'Rasio Komisi': a.gmv > 0 ? ((a.realCommission / a.gmv) * 100).toFixed(2) + '%' : '0%',
      'Hari Aktif': a.entriesCount,
    }));

    exportReportData({
      filenamePrefix: 'laporan_performa_akun',
      sheetName: 'Performa Akun',
      category: 'PERFORMA_AKUN',
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
            <Smartphone className="h-5 w-5 text-cyan-600" />
            <span>LAPORAN PERFORMA AKUN TIKTOK</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Analisis GMV, Estimasi Komisi, dan Realisasi Komisi (Performa Penjualan & Affiliate)
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
            className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-cyan-700 transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Export Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5 shadow-2xs">
          <span className="text-[11px] font-black uppercase tracking-wider text-blue-700">
            TOTAL GMV (OMZET PENJUALAN)
          </span>
          <div className="text-2xl font-black text-blue-950 font-mono tracking-tight mt-1">
            {formatRupiah(totalGmv)}
          </div>
          <div className="mt-2 text-xs text-blue-700 font-medium">
            Akumulasi nilai penjualan kotor (GMV tidak masuk kas)
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-2xs">
          <span className="text-[11px] font-black uppercase tracking-wider text-amber-700">
            TOTAL ESTIMASI KOMISI
          </span>
          <div className="text-2xl font-black text-amber-950 font-mono tracking-tight mt-1">
            {formatRupiah(totalEst)}
          </div>
          <div className="mt-2 text-xs text-amber-700 font-medium">
            Proyeksi komisi dari tracking TikTok Affiliate
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-2xs">
          <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">
            TOTAL KOMISI REAL (FINAL)
          </span>
          <div className="text-2xl font-black text-emerald-950 font-mono tracking-tight mt-1">
            {formatRupiah(totalReal)}
          </div>
          <div className="mt-2 text-xs text-emerald-700 font-medium flex items-center justify-between">
            <span>Komisi yang sudah ditarik/cair</span>
            <span className="font-bold">
              {totalGmv > 0 ? ((totalReal / totalGmv) * 100).toFixed(1) : '0'}% Avg Take Rate
            </span>
          </div>
        </div>
      </div>

      {/* Account Performance Table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
            Peringkat & Rincian Performa Akun ({accountList.length})
          </h3>
          <span className="text-xs text-slate-500 font-medium">Diurutkan berdasarkan Komisi Real</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-black text-slate-700 uppercase tracking-wider">
                <th className="py-3 px-4 text-center w-12">Rank</th>
                <th className="py-3 px-4">Nama Akun</th>
                <th className="py-3 px-4">Scope</th>
                <th className="py-3 px-4 text-right">GMV</th>
                <th className="py-3 px-4 text-right">Estimasi Komisi</th>
                <th className="py-3 px-4 text-right">Komisi Real</th>
                <th className="py-3 px-4 text-center">Hari Aktif</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accountList.map((acc, index) => (
                <tr key={acc.accountId} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 text-center font-black text-slate-500 font-mono">
                    #{index + 1}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="font-bold text-slate-900">{acc.accountName}</div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black ${
                        acc.scope === 'SHARING'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {acc.scope}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap font-mono text-slate-700">
                    {formatRupiah(acc.gmv)}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap font-mono text-amber-700 font-bold">
                    {formatRupiah(acc.estimatedCommission)}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap font-mono text-emerald-700 font-black">
                    {formatRupiah(acc.realCommission)}
                  </td>
                  <td className="py-3 px-4 text-center whitespace-nowrap font-bold text-slate-600">
                    {acc.entriesCount} Hari
                  </td>
                </tr>
              ))}

              {accountList.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-400 italic">
                    Belum ada data performa akun pada periode ini.
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
