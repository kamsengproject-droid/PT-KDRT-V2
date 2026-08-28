import React from 'react';
import { CreditCard, DollarSign, CheckCircle2, Clock, Lock, Download, FileSpreadsheet } from 'lucide-react';
import { Payroll, UserProfile, ReportScopeFilter } from '../../types';
import { formatRupiah, formatTanggal } from '../../utils/formatters';
import { exportReportData } from '../../services/exportService';

interface PayrollReportViewProps {
  payrolls: Payroll[];
  userProfile: UserProfile;
  scope: ReportScopeFilter;
  dateRange: string;
}

export const PayrollReportView: React.FC<PayrollReportViewProps> = ({
  payrolls,
  userProfile,
  scope,
  dateRange,
}) => {
  const isInvestor = userProfile.role === 'INVESTOR';

  // Investor privacy check: Investor cannot see individual payroll breakdowns
  if (isInvestor) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3 shadow-2xs">
        <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
          <Lock className="h-6 w-6" />
        </div>
        <h3 className="text-base font-black text-slate-900">Akses Terbatas untuk Investor</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Rincian gaji individual dan slip penggajian karyawan bersifat rahasia. Total beban gaji sharing tercantum secara agregat pada Laporan Investor.
        </p>
      </div>
    );
  }

  let totalGajiPokok = 0;
  let totalUangRajin = 0;
  let totalBonus = 0;
  let totalAdjustment = 0;
  let totalPayroll = 0;
  let totalSudahDibayar = 0;
  let totalBelumDibayar = 0;

  payrolls.forEach((p) => {
    const net = p.totalGajiBersih || p.gajiBersih || 0;
    totalPayroll += net;
    totalGajiPokok += p.gajiPokok || 0;
    totalUangRajin += p.uangRajinNominal || p.totalUangRajin || 0;
    totalBonus += p.totalBonus || 0;
    totalAdjustment += p.totalAdjustment || 0;

    if (p.status === 'DIBAYAR') {
      totalSudahDibayar += net;
    } else {
      totalBelumDibayar += net;
    }
  });

  const handleExport = (format: 'CSV' | 'XLSX') => {
    const exportData = payrolls.map((p) => ({
      Periode: p.period,
      'Nama Karyawan': p.employeeName,
      Jabatan: p.position || '-',
      'Gaji Pokok': p.gajiPokok || 0,
      'Uang Rajin': p.uangRajinNominal || p.totalUangRajin || 0,
      Bonus: p.totalBonus || 0,
      Penyesuaian: p.totalAdjustment || 0,
      'Total Gaji Bersih': p.totalGajiBersih || p.gajiBersih || 0,
      Status: p.status,
      'Tanggal Bayar': p.paymentDate || '-',
    }));

    exportReportData({
      filenamePrefix: 'laporan_penggajian_payroll',
      sheetName: 'Rekapitulasi Payroll',
      category: 'PAYROLL',
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
            <CreditCard className="h-5 w-5 text-emerald-600" />
            <span>LAPORAN REKAPITULASI PENGGAJIAN & PAYROLL</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Akumulasi Beban Gaji Pokok, Uang Rajin, Bonus Output, dan Status Pembayaran
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 shadow-2xs">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">
            TOTAL BEBAN PAYROLL KANTOR
          </span>
          <div className="text-2xl font-black text-slate-950 font-mono tracking-tight mt-1">
            {formatRupiah(totalPayroll)}
          </div>
          <div className="mt-2 text-xs text-slate-500 font-medium">
            {payrolls.length} Slip Gaji Karyawan
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-2xs">
          <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">
            TOTAL SUDAH DIBAYAR (PAID)
          </span>
          <div className="text-2xl font-black text-emerald-950 font-mono tracking-tight mt-1">
            {formatRupiah(totalSudahDibayar)}
          </div>
          <div className="mt-2 text-xs text-emerald-700 font-medium">
            Gaji yang telah ditransfer ke rekening karyawan
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-2xs">
          <span className="text-[11px] font-black uppercase tracking-wider text-amber-700">
            TOTAL BELUM DIBAYAR (PENDING)
          </span>
          <div className="text-2xl font-black text-amber-950 font-mono tracking-tight mt-1">
            {formatRupiah(totalBelumDibayar)}
          </div>
          <div className="mt-2 text-xs text-amber-700 font-medium">
            Kewajiban payroll dalam antrean pencairan
          </div>
        </div>
      </div>

      {/* Breakdown Komponen Gaji */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Gaji Pokok</div>
          <div className="text-base font-black font-mono text-slate-900 mt-1">{formatRupiah(totalGajiPokok)}</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Total Uang Rajin</div>
          <div className="text-base font-black font-mono text-emerald-900 mt-1">{formatRupiah(totalUangRajin)}</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-black uppercase tracking-wider text-blue-700">Total Bonus Target</div>
          <div className="text-base font-black font-mono text-blue-900 mt-1">{formatRupiah(totalBonus)}</div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[10px] font-black uppercase tracking-wider text-purple-700">Total Penyesuaian</div>
          <div className="text-base font-black font-mono text-purple-900 mt-1">{formatRupiah(totalAdjustment)}</div>
        </div>
      </div>

      {/* Payroll Table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
            Rincian Payroll Karyawan ({payrolls.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-black text-slate-700 uppercase tracking-wider">
                <th className="py-3 px-4">Periode</th>
                <th className="py-3 px-4">Nama Karyawan</th>
                <th className="py-3 px-4 text-right">Gaji Pokok</th>
                <th className="py-3 px-4 text-right">Uang Rajin</th>
                <th className="py-3 px-4 text-right">Bonus</th>
                <th className="py-3 px-4 text-right">Total Bersih</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payrolls.map((p) => (
                <tr key={p.id || p.payrollId} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 font-mono text-slate-700">{p.period}</td>
                  <td className="py-3 px-4 font-bold text-slate-900">
                    <div>{p.employeeName}</div>
                    <div className="text-[10px] text-slate-400">{p.position}</div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-600">
                    {formatRupiah(p.gajiPokok || 0)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-700">
                    {formatRupiah(p.uangRajinNominal || p.totalUangRajin || 0)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-blue-700">
                    {formatRupiah(p.totalBonus || 0)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                    {formatRupiah(p.totalGajiBersih || p.gajiBersih || 0)}
                  </td>
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                        p.status === 'DIBAYAR'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}

              {payrolls.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-400 italic">
                    Belum ada data payroll pada periode ini.
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
