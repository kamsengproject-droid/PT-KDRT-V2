import React from 'react';
import { Box, Layers, MapPin, CheckCircle, AlertTriangle, XCircle, Download, FileSpreadsheet } from 'lucide-react';
import { InventoryItem, UserProfile, ReportScopeFilter } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { exportReportData } from '../../services/exportService';

interface InventoryReportViewProps {
  inventory: InventoryItem[];
  userProfile: UserProfile;
  scope: ReportScopeFilter;
  dateRange: string;
}

export const InventoryReportView: React.FC<InventoryReportViewProps> = ({
  inventory,
  userProfile,
  scope,
  dateRange,
}) => {
  let totalNilai = 0;
  let totalUnit = 0;

  const categoryMap: Record<string, { count: number; value: number }> = {};
  const conditionMap = {
    BAIK: 0,
    PERLU_PERBAIKAN: 0,
    RUSAK: 0,
    HILANG: 0,
  };

  inventory.forEach((item) => {
    const val = (item.purchasePrice || 0) * (item.quantity || 1);
    const qty = item.quantity || 1;
    totalNilai += val;
    totalUnit += qty;

    const cat = item.category || 'PERALATAN';
    if (!categoryMap[cat]) {
      categoryMap[cat] = { count: 0, value: 0 };
    }
    categoryMap[cat].count += qty;
    categoryMap[cat].value += val;

    const cond = item.condition || 'BAIK';
    if (cond === 'BAIK') conditionMap.BAIK += qty;
    else if (cond === 'PERLU_PERBAIKAN') conditionMap.PERLU_PERBAIKAN += qty;
    else if (cond === 'RUSAK') conditionMap.RUSAK += qty;
    else if (cond === 'HILANG') conditionMap.HILANG += qty;
  });

  const handleExport = (format: 'CSV' | 'XLSX') => {
    const exportData = inventory.map((i) => ({
      'Nama Barang': i.name,
      Kategori: i.category || '-',
      Lokasi: i.location || '-',
      Kondisi: i.condition,
      Jumlah: i.quantity || 1,
      'Harga Beli Satuan': i.purchasePrice || 0,
      'Total Nilai': (i.purchasePrice || 0) * (i.quantity || 1),
      PIC: i.picName || '-',
      Scope: i.scope || 'PRIBADI',
    }));

    exportReportData({
      filenamePrefix: 'laporan_inventory_aset',
      sheetName: 'Laporan Inventory',
      category: 'INVENTORY',
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
            <Box className="h-5 w-5 text-teal-600" />
            <span>LAPORAN INVENTORY & ASET OPERASIONAL</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Valuasi Nilai Aset Kantor, Kondisi Fisik, Kategori Barang, dan Distribusi PIC
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
            className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-teal-700 transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Export Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-teal-200 bg-teal-50/70 p-5 shadow-2xs">
          <span className="text-[11px] font-black uppercase tracking-wider text-teal-700">
            TOTAL VALUASI ASET INVENTORY
          </span>
          <div className="text-2xl font-black text-teal-950 font-mono tracking-tight mt-1">
            {formatRupiah(totalNilai)}
          </div>
          <div className="mt-2 text-xs text-teal-700 font-medium">
            Akumulasi harga beli seluruh aset kantor
          </div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5 shadow-2xs">
          <span className="text-[11px] font-black uppercase tracking-wider text-blue-700">
            TOTAL UNIT / FISIK BARANG
          </span>
          <div className="text-2xl font-black text-blue-950 font-mono tracking-tight mt-1">
            {totalUnit} Unit ({inventory.length} Item)
          </div>
          <div className="mt-2 text-xs text-blue-700 font-medium">
            Tersebar di berbagai ruang studio & operasional
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-2xs">
          <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">
            KONDISI ASET BAIK
          </span>
          <div className="text-2xl font-black text-emerald-950 font-mono tracking-tight mt-1">
            {conditionMap.BAIK} Unit
          </div>
          <div className="mt-2 text-xs text-emerald-700 font-medium">
            {totalUnit > 0 ? ((conditionMap.BAIK / totalUnit) * 100).toFixed(1) : '100'}% Dalam kondisi prima
          </div>
        </div>
      </div>

      {/* Breakdown Kondisi & Kategori */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Kondisi */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
            Status Kondisi Fisik Barang
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
              <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Kondisi Baik</div>
              <div className="text-lg font-black font-mono mt-1">{conditionMap.BAIK} Unit</div>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
              <div className="text-[10px] font-black uppercase tracking-wider text-amber-700">Perlu Perbaikan</div>
              <div className="text-lg font-black font-mono mt-1">{conditionMap.PERLU_PERBAIKAN} Unit</div>
            </div>
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900">
              <div className="text-[10px] font-black uppercase tracking-wider text-rose-700">Rusak</div>
              <div className="text-lg font-black font-mono mt-1">{conditionMap.RUSAK} Unit</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-100 border border-slate-300 text-slate-900">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-600">Hilang / Tidak Ada</div>
              <div className="text-lg font-black font-mono mt-1">{conditionMap.HILANG} Unit</div>
            </div>
          </div>
        </div>

        {/* Kategori */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
            Kategori Aset & Peralatan
          </h3>
          <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
            {Object.entries(categoryMap).map(([cat, data]) => (
              <div key={cat} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50 border border-slate-100">
                <span className="font-bold text-slate-800">{cat} ({data.count} unit)</span>
                <span className="font-mono font-black text-slate-900">{formatRupiah(data.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
            Rincian Item Inventory ({inventory.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-black text-slate-700 uppercase tracking-wider">
                <th className="py-3 px-4">Nama Barang</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4">Lokasi</th>
                <th className="py-3 px-4">PIC</th>
                <th className="py-3 px-4 text-center">Jumlah</th>
                <th className="py-3 px-4 text-right">Nilai Satuan</th>
                <th className="py-3 px-4 text-right">Total Nilai</th>
                <th className="py-3 px-4 text-center">Kondisi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inventory.map((item) => (
                <tr key={item.id || item.inventoryId} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900">{item.name}</td>
                  <td className="py-3 px-4 text-slate-600">{item.category || '-'}</td>
                  <td className="py-3 px-4 text-slate-600">{item.location || '-'}</td>
                  <td className="py-3 px-4 text-slate-600">{item.picName || '-'}</td>
                  <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                    {item.quantity || 1}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-600">
                    {formatRupiah(item.purchasePrice || 0)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                    {formatRupiah((item.purchasePrice || 0) * (item.quantity || 1))}
                  </td>
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black ${
                        item.condition === 'BAIK'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.condition === 'PERLU_PERBAIKAN'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {item.condition}
                    </span>
                  </td>
                </tr>
              ))}

              {inventory.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-slate-400 italic">
                    Belum ada data inventory terdaftar.
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
