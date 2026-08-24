import React from 'react';
import { ShoppingBag, TrendingUp, DollarSign, Download, FileSpreadsheet, Film } from 'lucide-react';
import { Product, DailyPerformance, ContentCalendarItem, UserProfile, ReportScopeFilter } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { exportReportData } from '../../services/exportService';

interface ProductReportViewProps {
  products: Product[];
  performances: DailyPerformance[];
  contents: ContentCalendarItem[];
  userProfile: UserProfile;
  scope: ReportScopeFilter;
  dateRange: string;
}

export const ProductReportView: React.FC<ProductReportViewProps> = ({
  products,
  performances,
  contents,
  userProfile,
  scope,
  dateRange,
}) => {
  // Aggregate Product Performance
  const productStats = products.map((prod) => {
    // Linked contents
    const linkedContents = contents.filter((c) => c.productId === prod.id);
    const contentCount = linkedContents.length;

    // Accounts that used this product
    const accountsSet = new Set<string>();
    linkedContents.forEach((c) => {
      if (c.accountName) accountsSet.add(c.accountName);
    });

    // Approximate GMV & Commission allocated to product
    let productGmv = 0;
    let productCommission = 0;
    let daysGenerating = 0;

    // We can also aggregate from dailyPerformance where notes/products mention this product or proportional
    performances.forEach((p) => {
      if (p.notes && p.notes.toLowerCase().includes(prod.name.toLowerCase())) {
        productGmv += p.gmv || 0;
        productCommission += p.realCommission || 0;
        daysGenerating += 1;
      }
    });

    // If direct match was 0, fallback to sample/content proportional estimate
    if (productGmv === 0 && contentCount > 0) {
      const avgGmvPerContent = performances.length > 0
        ? performances.reduce((s, p) => s + (p.gmv || 0), 0) / Math.max(1, contents.length)
        : 0;
      const avgCommPerContent = performances.length > 0
        ? performances.reduce((s, p) => s + (p.realCommission || 0), 0) / Math.max(1, contents.length)
        : 0;
      productGmv = Math.round(avgGmvPerContent * contentCount);
      productCommission = Math.round(avgCommPerContent * contentCount);
      daysGenerating = contentCount;
    }

    return {
      productId: prod.id || '',
      productName: prod.name,
      category: prod.category || '-',
      brand: prod.brand || '-',
      price: prod.price || 0,
      contentCount,
      accountsCount: accountsSet.size,
      accountsList: Array.from(accountsSet).join(', ') || '-',
      productGmv,
      productCommission,
      daysGenerating,
    };
  });

  // Rank by Real Commission
  const rankedProducts = [...productStats].sort((a, b) => b.productCommission - a.productCommission);

  const totalGmv = rankedProducts.reduce((sum, p) => sum + p.productGmv, 0);
  const totalCommission = rankedProducts.reduce((sum, p) => sum + p.productCommission, 0);

  const handleExport = (format: 'CSV' | 'XLSX') => {
    const exportData = rankedProducts.map((p, idx) => ({
      Rank: idx + 1,
      'Nama Produk': p.productName,
      Kategori: p.category,
      Brand: p.brand,
      'Estimasi GMV': p.productGmv,
      'Estimasi Komisi Real': p.productCommission,
      'Jumlah Konten VT': p.contentCount,
      'Jumlah Akun Digunakan': p.accountsCount,
      'Daftar Akun': p.accountsList,
      'Hari Menghasilkan': p.daysGenerating,
    }));

    exportReportData({
      filenamePrefix: 'laporan_produk_affiliate',
      sheetName: 'Laporan Produk',
      category: 'PRODUK',
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
            <ShoppingBag className="h-5 w-5 text-indigo-600" />
            <span>LAPORAN PRODUK AFFILIATE & PRODUTIVITAS VT</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Ranking Produk Penghasil Komisi, Utilisasi Akun, dan Frekuensi Konten Video
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
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-indigo-700 transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Export Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-5 shadow-2xs">
          <span className="text-[11px] font-black uppercase tracking-wider text-indigo-700">
            TOTAL PRODUK TERDAFTAR
          </span>
          <div className="text-2xl font-black text-indigo-950 font-mono tracking-tight mt-1">
            {products.length} Produk
          </div>
          <div className="mt-2 text-xs text-indigo-700 font-medium">
            {rankedProducts.filter((p) => p.contentCount > 0).length} Produk aktif memiliki jadwal konten
          </div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5 shadow-2xs">
          <span className="text-[11px] font-black uppercase tracking-wider text-blue-700">
            TOTAL GMV DISTRIBUSI PRODUK
          </span>
          <div className="text-2xl font-black text-blue-950 font-mono tracking-tight mt-1">
            {formatRupiah(totalGmv)}
          </div>
          <div className="mt-2 text-xs text-blue-700 font-medium">
            Estimasi total omzet penjualan produk
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-2xs">
          <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">
            KOMISI REAL HASIL PRODUK
          </span>
          <div className="text-2xl font-black text-emerald-950 font-mono tracking-tight mt-1">
            {formatRupiah(totalCommission)}
          </div>
          <div className="mt-2 text-xs text-emerald-700 font-medium">
            Total estimasi komisi produk afiliasi
          </div>
        </div>
      </div>

      {/* Product Ranking Table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
            Peringkat Produk Berdasarkan Hasil Komisi ({rankedProducts.length})
          </h3>
          <span className="text-xs text-slate-500 font-medium">Ranking Komisi Real Terbesar</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-black text-slate-700 uppercase tracking-wider">
                <th className="py-3 px-4 text-center w-12">Rank</th>
                <th className="py-3 px-4">Nama Produk</th>
                <th className="py-3 px-4">Kategori / Brand</th>
                <th className="py-3 px-4 text-right">GMV</th>
                <th className="py-3 px-4 text-right">Komisi Real</th>
                <th className="py-3 px-4 text-center">Jumlah Konten</th>
                <th className="py-3 px-4">Akun Terkait</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rankedProducts.map((prod, idx) => (
                <tr key={prod.productId || idx} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 text-center font-black text-slate-500 font-mono">
                    #{idx + 1}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900">
                    <div>{prod.productName}</div>
                    {prod.price > 0 && (
                      <div className="text-[10px] text-slate-400 font-mono">
                        Harga: {formatRupiah(prod.price)}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    <div>{prod.category}</div>
                    <div className="text-[10px] text-slate-400">{prod.brand}</div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-700">
                    {formatRupiah(prod.productGmv)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-black text-emerald-700">
                    {formatRupiah(prod.productCommission)}
                  </td>
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 font-bold text-slate-800 text-[11px]">
                      {prod.contentCount} Konten
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600 max-w-[200px] truncate">
                    {prod.accountsList}
                  </td>
                </tr>
              ))}

              {rankedProducts.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-400 italic">
                    Belum ada data produk terdaftar.
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
