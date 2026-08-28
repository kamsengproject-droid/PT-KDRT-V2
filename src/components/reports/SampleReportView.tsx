import React from 'react';
import { Package, TrendingDown, Clock, CheckCircle2, AlertCircle, Download, FileSpreadsheet } from 'lucide-react';
import { Sample, UserProfile, ReportScopeFilter } from '../../types';
import { formatRupiah, formatTanggal } from '../../utils/formatters';
import { exportReportData } from '../../services/exportService';

interface SampleReportViewProps {
  samples: Sample[];
  userProfile: UserProfile;
  scope: ReportScopeFilter;
  dateRange: string;
}

export const SampleReportView: React.FC<SampleReportViewProps> = ({
  samples,
  userProfile,
  scope,
  dateRange,
}) => {
  let totalBiayaSampel = 0;
  const statusCountMap: Record<string, { count: number; cost: number }> = {
    DIPESAN: { count: 0, cost: 0 },
    DIKIRIM: { count: 0, cost: 0 },
    DITERIMA: { count: 0, cost: 0 },
    DIGUNAKAN: { count: 0, cost: 0 },
    SELESAI: { count: 0, cost: 0 },
  };

  let kontenBelumSelesai = 0;

  samples.forEach((s) => {
    const cost = s.cost || 0;
    totalBiayaSampel += cost;
    const st = s.status || 'DIPESAN';
    if (!statusCountMap[st]) {
      statusCountMap[st] = { count: 0, cost: 0 };
    }
    statusCountMap[st].count += 1;
    statusCountMap[st].cost += cost;

    if (s.status !== 'SELESAI') {
      kontenBelumSelesai += 1;
    }
  });

  const handleExport = (format: 'CSV' | 'XLSX') => {
    const exportData = samples.map((s) => ({
      Tanggal: s.requestDate || s.receivedDate || '-',
      'Nama Sampel': s.productName || s.name || '-',
      Akun: s.accountName || '-',
      Scope: s.scope || 'PRIBADI',
      Biaya: s.cost || 0,
      Status: s.status,
      PIC: s.picName || '-',
      'Status Konten': s.status === 'SELESAI' ? 'Selesai' : 'Belum Selesai',
    }));

    exportReportData({
      filenamePrefix: 'laporan_sampel_affiliate',
      sheetName: 'Laporan Sampel',
      category: 'SAMPEL',
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
            <Package className="h-5 w-5 text-amber-600" />
            <span>LAPORAN BIAYA & STATUS SAMPEL AFFILIATE</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Monitoring Investasi Sampel Produk, Utilisasi Syuting, dan Status Konten
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
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-amber-700 transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Export Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-2xs">
          <span className="text-[11px] font-black uppercase tracking-wider text-amber-700">
            TOTAL BIAYA SAMPEL
          </span>
          <div className="text-2xl font-black text-amber-950 font-mono tracking-tight mt-1">
            {formatRupiah(totalBiayaSampel)}
          </div>
          <div className="mt-2 text-xs text-amber-700 font-medium">
            Total biaya pembelian & pengadaan sampel
          </div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5 shadow-2xs">
          <span className="text-[11px] font-black uppercase tracking-wider text-blue-700">
            TOTAL UNIT SAMPEL
          </span>
          <div className="text-2xl font-black text-blue-950 font-mono tracking-tight mt-1">
            {samples.length} Sampel
          </div>
          <div className="mt-2 text-xs text-blue-700 font-medium">
            {statusCountMap['SELESAI']?.count || 0} Sampel telah tuntas diproduksi
          </div>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5 shadow-2xs">
          <span className="text-[11px] font-black uppercase tracking-wider text-rose-700">
            KONTEN BELUM SELESAI
          </span>
          <div className="text-2xl font-black text-rose-950 font-mono tracking-tight mt-1">
            {kontenBelumSelesai} Sampel
          </div>
          <div className="mt-2 text-xs text-rose-700 font-medium">
            Sampel dalam proses pengiriman / pembuatan konten
          </div>
        </div>
      </div>

      {/* Status Breakdown Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {Object.entries(statusCountMap).map(([st, data]) => (
          <div key={st} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              {st}
            </div>
            <div className="text-xl font-black text-slate-900 font-mono mt-1">
              {data.count} <span className="text-xs font-normal text-slate-500">item</span>
            </div>
            <div className="text-[11px] font-bold text-amber-700 font-mono mt-1">
              {formatRupiah(data.cost)}
            </div>
          </div>
        ))}
      </div>

      {/* Samples Table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
            Daftar Riwayat Sampel ({samples.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-black text-slate-700 uppercase tracking-wider">
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4">Nama Produk Sampel</th>
                <th className="py-3 px-4">Akun</th>
                <th className="py-3 px-4">PIC / Talent</th>
                <th className="py-3 px-4 text-right">Biaya</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {samples.map((s) => (
                <tr key={s.id || s.sampleId} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                    {formatTanggal(s.requestDate || s.receivedDate || '')}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {s.productName || s.name}
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {s.accountName || '-'}
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {s.picName || '-'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                    {formatRupiah(s.cost || 0)}
                  </td>
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black ${
                        s.status === 'SELESAI'
                          ? 'bg-emerald-100 text-emerald-800'
                          : s.status === 'DIGUNAKAN'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}

              {samples.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-slate-400 italic">
                    Belum ada data sampel pada periode ini.
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
