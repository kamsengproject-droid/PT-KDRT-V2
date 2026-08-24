import React from 'react';
import { X, CheckCircle2, Lock, ShieldCheck, DollarSign, Wallet, FileSpreadsheet, Download, Layers } from 'lucide-react';
import { MonthlyClosing, UserProfile } from '../../types';
import { formatRupiah, formatTanggal } from '../../utils/formatters';
import { exportReportData } from '../../services/exportService';

interface ClosingReportModalProps {
  closing: MonthlyClosing;
  onClose: () => void;
  userProfile: UserProfile;
}

export const ClosingReportModal: React.FC<ClosingReportModalProps> = ({
  closing,
  onClose,
  userProfile,
}) => {
  const handleExport = (format: 'CSV' | 'XLSX') => {
    const summaryData = [
      { Metrik: 'Periode', Nilai: closing.period },
      { Metrik: 'Scope', Nilai: closing.scope },
      { Metrik: 'Status', Nilai: closing.status },
      { Metrik: 'Ditutup Oleh', Nilai: closing.closedByName || '-' },
      { Metrik: 'Waktu Tutup Buku', Nilai: closing.closedAt ? formatTanggal(closing.closedAt) : '-' },
      { Metrik: 'Uang Masuk', Nilai: closing.uangMasuk },
      { Metrik: 'Uang Keluar', Nilai: closing.uangKeluar },
      { Metrik: 'Saldo Bersih', Nilai: closing.saldoBersih },
      { Metrik: 'GMV (Omzet)', Nilai: closing.gmv },
      { Metrik: 'Estimasi Komisi', Nilai: closing.estimasiKomisi },
      { Metrik: 'Komisi Real', Nilai: closing.komisiReal },
      { Metrik: 'Total Expense', Nilai: closing.totalExpense },
      { Metrik: 'Total Payroll', Nilai: closing.totalPayroll },
      { Metrik: 'Total Profit Sharing Masuk', Nilai: closing.totalProfitSharingMasuk },
      { Metrik: 'Hak Investor', Nilai: closing.hakInvestor },
      { Metrik: 'Hak Owner', Nilai: closing.hakOwner },
      { Metrik: 'Valuasi Inventory', Nilai: closing.totalInventoryValue },
      { Metrik: 'Saldo Buku Rekonsiliasi', Nilai: closing.reconciliationSnapshot?.saldoBuku || closing.saldoBersih },
      { Metrik: 'Saldo Fisik Aktual', Nilai: closing.reconciliationSnapshot?.saldoAktual || closing.saldoBersih },
      { Metrik: 'Selisih Rekonsiliasi', Nilai: closing.reconciliationSnapshot?.selisih || 0 },
      { Metrik: 'Status Rekonsiliasi', Nilai: closing.reconciliationSnapshot?.status || 'SEIMBANG' },
    ];

    exportReportData({
      filenamePrefix: `snapshot_closing_${closing.period}`,
      sheetName: `Closing ${closing.period}`,
      category: 'CLOSING_SNAPSHOT',
      scope: closing.scope,
      periodOrDateRange: closing.period,
      data: summaryData,
      format,
      userProfile,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-orange-600 text-white">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight">
                  LAPORAN PENUTUPAN BULAN (CLOSING SNAPSHOT)
                </h3>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                    closing.status === 'CLOSED'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  {closing.status}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Periode: <span className="font-bold text-white">{closing.period}</span> • Scope: <span className="font-bold text-white">{closing.scope}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {/* Audit Info */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-slate-600">
            <div>
              <span className="text-slate-400">Ditutup oleh:</span>{' '}
              <span className="font-bold text-slate-800">{closing.closedByName || 'Owner'}</span>
            </div>
            {closing.closedAt && (
              <div>
                <span className="text-slate-400">Waktu Tutup Buku:</span>{' '}
                <span className="font-bold text-slate-800">{formatTanggal(closing.closedAt)}</span>
              </div>
            )}
            {closing.notes && (
              <div className="w-full text-[11px] text-slate-500 italic mt-1">
                Catatan: "{closing.notes}"
              </div>
            )}
          </div>

          {/* Cashflow Trio */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-950">
              <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Uang Masuk</div>
              <div className="text-xl font-black font-mono mt-1">{formatRupiah(closing.uangMasuk)}</div>
            </div>
            <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-950">
              <div className="text-[10px] font-black uppercase tracking-wider text-rose-700">Uang Keluar</div>
              <div className="text-xl font-black font-mono mt-1">{formatRupiah(closing.uangKeluar)}</div>
            </div>
            <div className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50 text-indigo-950">
              <div className="text-[10px] font-black uppercase tracking-wider text-indigo-700">Saldo Bersih</div>
              <div className="text-xl font-black font-mono mt-1">{formatRupiah(closing.saldoBersih)}</div>
            </div>
          </div>

          {/* Performa Omzet & Komisi */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
            <div className="font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
              Performa Penjualan & Komisi TikTok
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">Total GMV</div>
                <div className="text-sm font-black font-mono text-slate-900">{formatRupiah(closing.gmv)}</div>
              </div>
              <div>
                <div className="text-[10px] text-amber-600 font-bold uppercase">Estimasi Komisi</div>
                <div className="text-sm font-black font-mono text-amber-800">{formatRupiah(closing.estimasiKomisi)}</div>
              </div>
              <div>
                <div className="text-[10px] text-emerald-600 font-bold uppercase">Komisi Real Final</div>
                <div className="text-sm font-black font-mono text-emerald-800">{formatRupiah(closing.komisiReal)}</div>
              </div>
            </div>
          </div>

          {/* Beban Terbesar & Payroll */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2">
              <div className="font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-1.5 flex justify-between">
                <span>Total Expense Operasional</span>
                <span className="font-mono text-rose-700">{formatRupiah(closing.totalExpense)}</span>
              </div>
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                {closing.topExpenses && closing.topExpenses.length > 0 ? (
                  closing.topExpenses.map((exp, idx) => (
                    <div key={idx} className="flex justify-between text-[11px] p-1.5 rounded-lg bg-slate-50">
                      <span className="font-medium text-slate-700 line-clamp-1">{exp.name}</span>
                      <span className="font-mono font-bold text-slate-900">{formatRupiah(exp.amount)}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-400 italic">Tidak ada rincian beban spesifik.</div>
                )}
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2">
              <div className="font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-1.5 flex justify-between">
                <span>Total Payroll & Gaji</span>
                <span className="font-mono text-slate-900">{formatRupiah(closing.totalPayroll)}</span>
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between p-1.5 rounded-lg bg-slate-50">
                  <span className="text-slate-600">Gaji Pokok</span>
                  <span className="font-mono font-bold text-slate-800">{formatRupiah(closing.totalGajiPokok)}</span>
                </div>
                <div className="flex justify-between p-1.5 rounded-lg bg-slate-50">
                  <span className="text-emerald-700 font-bold">Uang Rajin</span>
                  <span className="font-mono font-bold text-emerald-800">{formatRupiah(closing.totalUangRajin)}</span>
                </div>
                <div className="flex justify-between p-1.5 rounded-lg bg-slate-50">
                  <span className="text-blue-700 font-bold">Bonus Target</span>
                  <span className="font-mono font-bold text-blue-800">{formatRupiah(closing.totalBonus)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Profit Sharing & Inventory */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl border border-purple-200 bg-purple-50/50 space-y-2">
              <div className="font-black text-purple-900 uppercase tracking-wider border-b border-purple-200 pb-1.5 flex justify-between">
                <span>Profit Sharing</span>
                <span className="font-mono text-purple-900">{formatRupiah(closing.totalProfitSharingMasuk)}</span>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-purple-800 font-bold">Hak Investor:</span>
                  <span className="font-mono font-black text-purple-950">{formatRupiah(closing.hakInvestor)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Hak Owner:</span>
                  <span className="font-mono text-slate-800">{formatRupiah(closing.hakOwner)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Budget PT:</span>
                  <span className="font-mono text-slate-800">{formatRupiah(closing.budgetPerusahaan)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-teal-200 bg-teal-50/50 space-y-2">
              <div className="font-black text-teal-900 uppercase tracking-wider border-b border-teal-200 pb-1.5 flex justify-between">
                <span>Valuasi Inventory Aset</span>
                <span className="font-mono text-teal-950">{formatRupiah(closing.totalInventoryValue)}</span>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Pengeluaran Sampel:</span>
                  <span className="font-mono text-slate-800">{formatRupiah(closing.totalSampleExpense)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Konten Diposting:</span>
                  <span className="font-mono font-bold text-slate-800">{closing.totalContentPosted} VT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Tugas Harian Tuntas:</span>
                  <span className="font-mono font-bold text-slate-800">{closing.totalTasksCompleted} Task</span>
                </div>
              </div>
            </div>
          </div>

          {/* Rekonsiliasi Kas */}
          {closing.reconciliationSnapshot && (
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
              <div className="font-black text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center justify-between">
                <span>Status Rekonsiliasi Kas Akhir Bulan</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-black ${
                    closing.reconciliationSnapshot.status === 'SEIMBANG'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {closing.reconciliationSnapshot.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Saldo Buku</div>
                  <div className="text-xs font-black font-mono text-slate-900 mt-0.5">
                    {formatRupiah(closing.reconciliationSnapshot.saldoBuku)}
                  </div>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Saldo Fisik Aktual</div>
                  <div className="text-xs font-black font-mono text-slate-900 mt-0.5">
                    {formatRupiah(closing.reconciliationSnapshot.saldoAktual)}
                  </div>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Selisih Fisik</div>
                  <div
                    className={`text-xs font-black font-mono mt-0.5 ${
                      closing.reconciliationSnapshot.selisih === 0 ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {formatRupiah(closing.reconciliationSnapshot.selisih)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport('CSV')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => handleExport('XLSX')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700 transition-colors shadow-2xs"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Export Excel (.xlsx)</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-1.5 rounded-xl bg-slate-900 text-xs font-bold text-white hover:bg-slate-800 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
