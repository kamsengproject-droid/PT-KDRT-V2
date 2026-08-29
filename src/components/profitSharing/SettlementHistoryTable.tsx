import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Clock,
  DollarSign,
  Ban,
  Calendar,
  Layers,
  ChevronRight,
  X,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { ProfitSharingSettlement, SettlementStatus } from '../../types';
import { formatRupiah, formatTanggal, formatBulanTahun } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import { voidSettlement } from '../../services/profitSharingService';

interface SettlementHistoryTableProps {
  settlements: ProfitSharingSettlement[];
  onOpenWithdrawalModal?: (settlementId: string) => void;
  onRefresh?: () => void;
}

export const SettlementHistoryTable: React.FC<SettlementHistoryTableProps> = ({
  settlements,
  onOpenWithdrawalModal,
  onRefresh,
}) => {
  const { userProfile, role } = useAuth();
  const isOwner = role === 'OWNER';

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');

  // Modal detail
  const [selectedSettlement, setSelectedSettlement] = useState<ProfitSharingSettlement | null>(null);

  // Void modal
  const [voidTarget, setVoidTarget] = useState<ProfitSharingSettlement | null>(null);
  const [voidReason, setVoidReason] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Extract available years
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    settlements.forEach((s) => {
      if (s.year) years.add(String(s.year));
    });
    return Array.from(years).sort().reverse();
  }, [settlements]);

  // Filtered settlements
  const filteredSettlements = useMemo(() => {
    return settlements.filter((s) => {
      const matchSearch =
        (s.periodLabel || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.activeTierName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.createdByName || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus = statusFilter === 'ALL' || s.status === statusFilter;
      const matchYear = selectedYear === 'ALL' || String(s.year) === selectedYear;

      return matchSearch && matchStatus && matchYear;
    });
  }, [settlements, searchTerm, statusFilter, selectedYear]);

  // Export CSV
  const handleExportCsv = () => {
    if (filteredSettlements.length === 0) return;

    const headers = [
      'Settlement ID',
      'Periode',
      'Uang Masuk Sharing (Rp)',
      'Pengeluaran Sharing (Rp)',
      'Arus Kas Bersih (Rp)',
      'Tier Aktif',
      '% Investor',
      'Hak Investor (Rp)',
      '% Owner',
      'Bagian Owner (Rp)',
      '% Talent',
      'Bagian Talent (Rp)',
      'PIC Talent',
      '% Editor',
      'Bagian Editor (Rp)',
      'PIC Editor',
      '% Budget Perusahaan',
      'Budget Perusahaan (Rp)',
      'Total Terbayar Investor (Rp)',
      'Sisa Kewajiban Investor (Rp)',
      'Status',
      'Dibuat Oleh',
      'Disetujui Oleh',
      'Alasan VOID',
    ];

    const rows = filteredSettlements.map((s) => [
      s.settlementId,
      s.periodLabel,
      s.totalIncome,
      s.totalExpense,
      s.netProfit,
      s.activeTierName,
      `${s.investorPercentage}%`,
      s.investorAmount,
      `${s.ownerPercentage}%`,
      s.ownerAmount,
      `${s.talentPercentage}%`,
      s.talentAmount,
      s.talentEmployeeName || '-',
      `${s.editorPercentage}%`,
      s.editorAmount,
      s.editorEmployeeName || '-',
      `${s.companyBudgetPercentage}%`,
      s.companyBudgetAmount,
      s.totalPaidToInvestor || 0,
      s.remainingInvestorObligation || 0,
      s.status,
      s.createdByName || '-',
      s.approvedByName || '-',
      s.voidReason || '-',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.map((cell) => `"${cell}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Settlement_Profit_Sharing_PT_KDRT_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle Void
  const handleConfirmVoid = async () => {
    if (!voidTarget?.id || !userProfile) return;
    if (!voidReason.trim() || voidReason.trim().length < 5) {
      setErrorMsg('Alasan VOID wajib diisi minimal 5 karakter.');
      return;
    }

    setActionLoading(true);
    setErrorMsg(null);

    try {
      await voidSettlement(voidTarget.id, voidReason, userProfile);
      setVoidTarget(null);
      setVoidReason('');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal membatalkan settlement.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Filter Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-zinc-900 tracking-tight flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-purple-600" />
              Riwayat Settlement Profit Sharing Bulanan
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Setiap bulan memiliki 1 rekap settlement aktif. Hak investor dicatat sebagai kewajiban sampai dilakukan pembayaran.
            </p>
          </div>

          <button
            onClick={handleExportCsv}
            disabled={filteredSettlements.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-black shadow-2xs transition-colors disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-zinc-100">
          <div className="relative">
            <Search className="h-4 w-4 text-zinc-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari periode, tier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 py-2 text-xs font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="ALL">Semua Status</option>
              <option value="DRAFT">DRAFT</option>
              <option value="REVIEW">REVIEW</option>
              <option value="APPROVED">APPROVED</option>
              <option value="PARTIALLY_PAID">PARTIALLY_PAID</option>
              <option value="PAID">PAID (Lunas)</option>
              <option value="VOID">VOID (Dibatalkan)</option>
            </select>
          </div>

          <div>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="ALL">Semua Tahun</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  Tahun {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-black uppercase tracking-wider text-zinc-500">
                <th className="py-3 px-4">Periode</th>
                <th className="py-3 px-4">Uang Masuk Sharing</th>
                <th className="py-3 px-4">Tier Aktif</th>
                <th className="py-3 px-4">Hak Investor</th>
                <th className="py-3 px-4">Terbayar</th>
                <th className="py-3 px-4">Sisa Kewajiban</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredSettlements.map((s) => (
                <tr key={s.id || s.settlementId} className="hover:bg-zinc-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-zinc-900">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-purple-600" />
                      <span>{s.periodLabel}</span>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono block">
                      ID: {s.settlementId}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 font-black text-emerald-700">
                    {formatRupiah(s.totalIncome)}
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">
                      {s.activeTierName}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 font-extrabold text-blue-900">
                    {formatRupiah(s.investorAmount)}
                    <span className="text-[10px] text-blue-600 block">
                      ({s.investorPercentage}%)
                    </span>
                  </td>

                  <td className="py-3.5 px-4 font-bold text-emerald-800">
                    {formatRupiah(s.totalPaidToInvestor || 0)}
                  </td>

                  <td className="py-3.5 px-4 font-black">
                    <span
                      className={`text-xs ${
                        (s.remainingInvestorObligation || s.investorAmount) > 0
                          ? 'text-amber-700'
                          : 'text-zinc-400'
                      }`}
                    >
                      {formatRupiah(
                        s.remainingInvestorObligation !== undefined
                          ? s.remainingInvestorObligation
                          : s.investorAmount
                      )}
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                        s.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : s.status === 'PAID'
                          ? 'bg-blue-100 text-blue-800 border border-blue-300'
                          : s.status === 'PARTIALLY_PAID'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : s.status === 'REVIEW'
                          ? 'bg-orange-100 text-orange-800 border border-orange-300'
                          : s.status === 'VOID'
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : 'bg-zinc-100 text-zinc-700 border border-zinc-300'
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-center">
                    <div className="inline-flex items-center gap-1.5">
                      {/* DETAIL BUTTON */}
                      <button
                        onClick={() => setSelectedSettlement(s)}
                        className="p-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-700 transition-colors"
                        title="Lihat Rincian Detail"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>

                      {/* WITHDRAWAL BUTTON */}
                      {(s.status === 'APPROVED' || s.status === 'PARTIALLY_PAID') &&
                        onOpenWithdrawalModal &&
                        isOwner && (
                          <button
                            onClick={() => onOpenWithdrawalModal(s.id!)}
                            className="p-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors"
                            title="Catat Pembayaran Hak Investor"
                          >
                            <DollarSign className="h-3.5 w-3.5" />
                          </button>
                        )}

                      {/* VOID BUTTON */}
                      {s.status !== 'VOID' && isOwner && (
                        <button
                          onClick={() => {
                            setVoidTarget(s);
                            setVoidReason('');
                            setErrorMsg(null);
                          }}
                          className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors"
                          title="Batalkan (VOID) Settlement"
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filteredSettlements.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-zinc-400 text-xs">
                    Tidak ada riwayat settlement yang sesuai filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Settlement Modal */}
      {selectedSettlement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-2xl p-6 shadow-2xl border border-zinc-200 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                  DETAIL SETTLEMENT
                </span>
                <h3 className="text-lg font-black text-zinc-900 mt-1">
                  Settlement {selectedSettlement.periodLabel}
                </h3>
              </div>
              <button
                onClick={() => setSelectedSettlement(null)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Financial Overview */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-[10px] font-bold text-emerald-800 uppercase block">
                  Uang Masuk Sharing
                </span>
                <span className="text-base font-black text-emerald-950 block mt-0.5">
                  {formatRupiah(selectedSettlement.totalIncome)}
                </span>
              </div>

              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                <span className="text-[10px] font-bold text-rose-800 uppercase block">
                  Pengeluaran Sharing
                </span>
                <span className="text-base font-black text-rose-950 block mt-0.5">
                  {formatRupiah(selectedSettlement.totalExpense)}
                </span>
              </div>

              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                <span className="text-[10px] font-bold text-zinc-600 uppercase block">
                  Arus Kas Bersih
                </span>
                <span className="text-base font-black text-zinc-900 block mt-0.5">
                  {formatRupiah(selectedSettlement.netProfit)}
                </span>
              </div>
            </div>

            {/* 5 Pillars Breakdown */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <h4 className="text-xs font-black uppercase text-zinc-700">
                  Alokasi Bagi Hasil 5 Pilar
                </h4>
                <span className="text-[11px] font-semibold text-purple-700">
                  Dihitung dari Profit Bersih (Net)
                </span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center p-2.5 rounded-xl bg-blue-50/70 border border-blue-200">
                  <span className="font-bold text-blue-900">
                    1. Hak Investor ({selectedSettlement.investorPercentage}% × Profit Bersih)
                  </span>
                  <span className="font-black text-blue-950">
                    {formatRupiah(selectedSettlement.investorAmount)}
                  </span>
                </div>

                <div className="flex justify-between items-center p-2.5 rounded-xl bg-purple-50/70 border border-purple-200">
                  <span className="font-bold text-purple-900">
                    2. Bagian Owner ({selectedSettlement.ownerPercentage}% × Profit Bersih)
                  </span>
                  <span className="font-black text-purple-950">
                    {formatRupiah(selectedSettlement.ownerAmount)}
                  </span>
                </div>

                <div className="flex justify-between items-center p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
                  <div>
                    <span className="font-bold text-emerald-900 block">
                      3. Bagian Talent ({selectedSettlement.talentPercentage}% × Profit Bersih)
                    </span>
                    <span className="text-[10px] text-emerald-700 font-medium">
                      PIC: {selectedSettlement.talentEmployeeName || '-'}
                    </span>
                  </div>
                  <span className="font-black text-emerald-950">
                    {formatRupiah(selectedSettlement.talentAmount)}
                  </span>
                </div>

                <div className="flex justify-between items-center p-2.5 rounded-xl bg-amber-50/70 border border-amber-200">
                  <div>
                    <span className="font-bold text-amber-900 block">
                      4. Bagian Editor ({selectedSettlement.editorPercentage}% × Profit Bersih)
                    </span>
                    <span className="text-[10px] text-amber-700 font-medium">
                      PIC: {selectedSettlement.editorEmployeeName || '-'}
                    </span>
                  </div>
                  <span className="font-black text-amber-950">
                    {formatRupiah(selectedSettlement.editorAmount)}
                  </span>
                </div>

                <div className="flex justify-between items-center p-2.5 rounded-xl bg-zinc-100 border border-zinc-200">
                  <span className="font-bold text-zinc-800">
                    5. Budget Perusahaan ({selectedSettlement.companyBudgetPercentage}% × Profit Bersih)
                  </span>
                  <span className="font-black text-zinc-950">
                    {formatRupiah(selectedSettlement.companyBudgetAmount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Investor Tracking Status */}
            <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Total Telah Dibayar ke Investor:</span>
                <span className="font-bold text-emerald-700">
                  {formatRupiah(selectedSettlement.totalPaidToInvestor || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Sisa Kewajiban Belum Ditarik:</span>
                <span className="font-black text-amber-700">
                  {formatRupiah(
                    selectedSettlement.remainingInvestorObligation !== undefined
                      ? selectedSettlement.remainingInvestorObligation
                      : selectedSettlement.investorAmount
                  )}
                </span>
              </div>
            </div>

            {/* Audit Trail */}
            <div className="border-t border-zinc-100 pt-3 text-[11px] text-zinc-400 space-y-0.5">
              <div>Dibuat oleh: {selectedSettlement.createdByName || '-'}</div>
              {selectedSettlement.approvedByName && (
                <div>Disetujui oleh: {selectedSettlement.approvedByName}</div>
              )}
              {selectedSettlement.voidReason && (
                <div className="text-rose-600 font-medium">
                  Alasan VOID: {selectedSettlement.voidReason}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedSettlement(null)}
                className="px-4 py-2 rounded-xl bg-zinc-900 text-white font-bold text-xs hover:bg-zinc-800"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VOID Modal */}
      {voidTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl border border-zinc-200 space-y-4">
            <div className="flex items-center gap-2 text-rose-600">
              <Ban className="h-5 w-5" />
              <h3 className="text-base font-black text-zinc-900">Batalkan (VOID) Settlement</h3>
            </div>
            <p className="text-xs text-zinc-500">
              Settlement <strong>{voidTarget.periodLabel}</strong> akan dibatalkan.
            </p>

            {errorMsg && (
              <div className="p-3 bg-rose-50 text-rose-800 text-xs rounded-xl font-bold border border-rose-200">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-zinc-700 block mb-1">
                Alasan Pembatalan (Wajib Minimal 5 Karakter):
              </label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Contoh: Koreksi perhitungan atau penyesuaian tier..."
                rows={3}
                className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setVoidTarget(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmVoid}
                disabled={actionLoading || voidReason.trim().length < 5}
                className="px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
              >
                Konfirmasi VOID
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
