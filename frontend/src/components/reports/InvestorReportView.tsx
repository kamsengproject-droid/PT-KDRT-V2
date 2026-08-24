import React from 'react';
import { ShieldCheck, DollarSign, Wallet, ArrowDownRight, ArrowUpRight, CheckCircle2, Clock, Download, FileSpreadsheet } from 'lucide-react';
import { Transaction, Expense, ProfitSharingSettlement, UserProfile, ReportScopeFilter } from '../../types';
import { formatRupiah, formatTanggal } from '../../utils/formatters';
import { exportReportData } from '../../services/exportService';

interface InvestorReportViewProps {
  transactions: Transaction[];
  expenses: Expense[];
  settlements: ProfitSharingSettlement[];
  userProfile: UserProfile;
  scope: ReportScopeFilter;
  dateRange: string;
}

export const InvestorReportView: React.FC<InvestorReportViewProps> = ({
  transactions,
  expenses,
  settlements,
  userProfile,
  scope,
  dateRange,
}) => {
  // STRICT FILTER: Always filter only SHARING data
  const sharingTx = transactions.filter((t) => t.scope === 'SHARING');
  const sharingExp = expenses.filter((e) => e.scope === 'SHARING');
  const sharingSettlements = settlements; // Settlements are inherently SHARING pool

  let uangMasukSharing = 0;
  let uangKeluarSharing = 0;

  sharingTx.forEach((t) => {
    if (t.type === 'INCOME') {
      uangMasukSharing += t.amount || 0;
    } else if (t.type === 'EXPENSE') {
      uangKeluarSharing += t.amount || 0;
    }
  });

  const saldoSharing = uangMasukSharing - uangKeluarSharing;

  let totalExpenseSharing = 0;
  sharingExp.forEach((e) => {
    totalExpenseSharing += e.amount || 0;
  });

  let totalHakInvestor = 0;
  let totalSudahDibayar = 0;
  let totalBelumDibayar = 0;

  sharingSettlements.forEach((s) => {
    totalHakInvestor += s.bagianInvestor || 0;
    if (s.statusPembayaran === 'PAID') {
      totalSudahDibayar += s.bagianInvestor || 0;
    } else {
      totalBelumDibayar += s.bagianInvestor || 0;
    }
  });

  const handleExport = (format: 'CSV' | 'XLSX') => {
    const exportData = sharingSettlements.map((s) => ({
      Periode: s.period,
      Tier: s.tierName || `Tier ${s.tier}`,
      'Total Uang Masuk Sharing': s.totalUangMasuk || 0,
      'Hak Investor (Porsi)': s.bagianInvestor || 0,
      'Status Pembayaran': s.statusPembayaran,
      'Tanggal Cair': s.settledDate || s.paidDate || '-',
    }));

    exportReportData({
      filenamePrefix: 'laporan_investor_sharing',
      sheetName: 'Laporan Investor',
      category: 'LAPORAN_INVESTOR',
      scope: 'SHARING', // Forcibly SHARING
      periodOrDateRange: dateRange,
      data: exportData,
      format,
      userProfile,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-purple-200 shadow-2xs">
        <div>
          <h2 className="text-base font-black text-purple-950 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-purple-600" />
            <span>LAPORAN KEUANGAN & BAGI HASIL INVESTOR (SHARING POOL)</span>
          </h2>
          <p className="text-xs text-purple-700 font-medium">
            Laporan Resmi Hak Investor Berdasarkan Cashflow Nyata Proyek Kerjasama Sharing
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

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* UANG MASUK SHARING */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
              UANG MASUK SHARING
            </span>
            <ArrowDownRight className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-emerald-950 font-mono tracking-tight">
            {formatRupiah(uangMasukSharing)}
          </div>
          <div className="mt-1 text-[11px] text-emerald-700">Omzet komisi nyata sharing</div>
        </div>

        {/* UANG KELUAR SHARING */}
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-700">
              UANG KELUAR SHARING
            </span>
            <ArrowUpRight className="h-4 w-4 text-rose-600" />
          </div>
          <div className="text-xl font-black text-rose-950 font-mono tracking-tight">
            {formatRupiah(uangKeluarSharing)}
          </div>
          <div className="mt-1 text-[11px] text-rose-700">Beban operasional sharing</div>
        </div>

        {/* SALDO SHARING */}
        <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-700">
              SALDO BERSIH SHARING
            </span>
            <Wallet className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-xl font-black text-blue-950 font-mono tracking-tight">
            {formatRupiah(saldoSharing)}
          </div>
          <div className="mt-1 text-[11px] text-blue-700">Net kas pool sharing</div>
        </div>

        {/* HAK INVESTOR */}
        <div className="rounded-2xl border border-purple-200 bg-purple-50/70 p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-700">
              TOTAL HAK INVESTOR
            </span>
            <ShieldCheck className="h-4 w-4 text-purple-600" />
          </div>
          <div className="text-xl font-black text-purple-950 font-mono tracking-tight">
            {formatRupiah(totalHakInvestor)}
          </div>
          <div className="mt-1 text-[11px] text-purple-700 font-bold">
            Sudah Dibayar: {formatRupiah(totalSudahDibayar)}
          </div>
        </div>
      </div>

      {/* Sisa Kewajiban Banner */}
      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div>
          <div className="font-black text-amber-900 uppercase tracking-wider">
            Sisa Kewajiban Pembayaran Bagi Hasil Investor
          </div>
          <div className="text-amber-700 font-medium mt-0.5">
            Akumulasi settlement yang belum ditransfer ke rekening investor
          </div>
        </div>
        <div className="text-xl font-black font-mono text-amber-950 whitespace-nowrap">
          {formatRupiah(totalBelumDibayar)}
        </div>
      </div>

      {/* Settlement Table for Investor */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
            Rekapitulasi Hak Bagi Hasil Investor Per Periode ({sharingSettlements.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-black text-slate-700 uppercase tracking-wider">
                <th className="py-3 px-4">Periode</th>
                <th className="py-3 px-4">Tier Tiering</th>
                <th className="py-3 px-4 text-right">Uang Masuk Sharing</th>
                <th className="py-3 px-4 text-right">Hak Investor</th>
                <th className="py-3 px-4 text-center">Status Bayar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sharingSettlements.map((s) => (
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
                  <td className="py-3 px-4 text-right font-mono font-black text-purple-800">
                    {formatRupiah(s.bagianInvestor || 0)}
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

              {sharingSettlements.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs text-slate-400 italic">
                    Belum ada data bagi hasil investor pada periode ini.
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
