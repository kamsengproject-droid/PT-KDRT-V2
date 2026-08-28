import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  Plus,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Ban,
  Upload,
  Image as ImageIcon,
  ExternalLink,
  Download,
  Calendar,
  X,
  CreditCard,
  Building,
  User,
  FileSpreadsheet,
} from 'lucide-react';
import {
  ProfitSharingSettlement,
  InvestorWithdrawal,
  PaymentMethod,
} from '../../types';
import {
  recordInvestorWithdrawal,
  voidInvestorWithdrawal,
  uploadWithdrawalReceipt,
} from '../../services/profitSharingService';
import { formatRupiah, formatTanggal, tanggalHariIni } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';

interface WithdrawalManagerProps {
  settlements: ProfitSharingSettlement[];
  withdrawals: InvestorWithdrawal[];
  initialSettlementId?: string;
  onRefresh?: () => void;
}

export const WithdrawalManager: React.FC<WithdrawalManagerProps> = ({
  settlements,
  withdrawals,
  initialSettlementId,
  onRefresh,
}) => {
  const { userProfile, role } = useAuth();
  const isOwner = role === 'OWNER';

  // Modal form state
  const [showAddModal, setShowAddModal] = useState<boolean>(!!initialSettlementId);
  const [selectedSettlementId, setSelectedSettlementId] = useState<string>(
    initialSettlementId || ''
  );
  const [withdrawalDate, setWithdrawalDate] = useState<string>(tanggalHariIni());
  const [withdrawalAmount, setWithdrawalAmount] = useState<number | ''>('');
  const [investorName, setInvestorName] = useState<string>('Investor PT.KDRT');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('TRANSFER');
  const [bankAccount, setBankAccount] = useState<string>('BCA 123-456-7890 a.n Investor');
  const [notes, setNotes] = useState<string>('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);

  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Void modal state
  const [voidTarget, setVoidTarget] = useState<InvestorWithdrawal | null>(null);
  const [voidReason, setVoidReason] = useState<string>('');
  const [voiding, setVoiding] = useState<boolean>(false);

  // Preview receipt image modal
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Settlements available for payout (APPROVED or PARTIALLY_PAID)
  const payableSettlements = useMemo(() => {
    return settlements.filter(
      (s) =>
        (s.status === 'APPROVED' || s.status === 'PARTIALLY_PAID') &&
        (s.remainingInvestorObligation === undefined || s.remainingInvestorObligation > 0)
    );
  }, [settlements]);

  // Selected settlement object in modal
  const currentSelectedSettlement = useMemo(() => {
    return settlements.find((s) => s.id === selectedSettlementId);
  }, [settlements, selectedSettlementId]);

  // Cumulative financial stats
  const totalHakInvestor = useMemo(() => {
    return settlements
      .filter((s) => s.status === 'APPROVED' || s.status === 'PARTIALLY_PAID' || s.status === 'PAID')
      .reduce((sum, s) => sum + (s.investorAmount || 0), 0);
  }, [settlements]);

  const totalSudahDibayar = useMemo(() => {
    return withdrawals
      .filter((w) => w.status === 'PAID')
      .reduce((sum, w) => sum + (w.amount || 0), 0);
  }, [withdrawals]);

  const sisaKewajiban = Math.max(0, totalHakInvestor - totalSudahDibayar);

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setReceiptFile(file);
      setReceiptPreviewUrl(URL.createObjectURL(file));
    }
  };

  // Open add modal
  const handleOpenAddModal = (settlementId?: string) => {
    if (settlementId) {
      setSelectedSettlementId(settlementId);
      const s = settlements.find((item) => item.id === settlementId);
      if (s) {
        setWithdrawalAmount(
          s.remainingInvestorObligation !== undefined
            ? s.remainingInvestorObligation
            : s.investorAmount
        );
      }
    } else if (payableSettlements.length > 0) {
      setSelectedSettlementId(payableSettlements[0].id!);
      setWithdrawalAmount(
        payableSettlements[0].remainingInvestorObligation !== undefined
          ? payableSettlements[0].remainingInvestorObligation
          : payableSettlements[0].investorAmount
      );
    }
    setErrorMsg(null);
    setShowAddModal(true);
  };

  // Submit payment
  const handleSubmitWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    if (!selectedSettlementId) {
      setErrorMsg('Pilih settlement bagi hasil yang akan dibayarkan.');
      return;
    }
    if (!withdrawalAmount || Number(withdrawalAmount) <= 0) {
      setErrorMsg('Nominal pembayaran harus lebih besar dari Rp 0.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      let uploadedReceiptUrl = '';
      let uploadedStoragePath = '';

      if (receiptFile) {
        const uploadRes = await uploadWithdrawalReceipt(receiptFile);
        uploadedReceiptUrl = uploadRes.downloadUrl;
        uploadedStoragePath = uploadRes.storagePath;
      }

      await recordInvestorWithdrawal(
        {
          settlementDocId: selectedSettlementId,
          investorName,
          date: withdrawalDate,
          amount: Number(withdrawalAmount),
          paymentMethod,
          bankAccount,
          notes,
          receiptUrl: uploadedReceiptUrl,
          receiptStoragePath: uploadedStoragePath,
        },
        userProfile
      );

      setSuccessMsg(
        `Pembayaran investor sebesar ${formatRupiah(withdrawalAmount)} berhasil dicatat dan masuk ke Buku Kas Master.`
      );
      setShowAddModal(false);
      setReceiptFile(null);
      setReceiptPreviewUrl(null);
      setNotes('');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memproses pembayaran investor.');
    } finally {
      setSaving(false);
    }
  };

  // Confirm VOID
  const handleConfirmVoid = async () => {
    if (!voidTarget?.id || !userProfile) return;
    if (!voidReason.trim() || voidReason.trim().length < 5) {
      setErrorMsg('Alasan VOID wajib diisi minimal 5 karakter.');
      return;
    }

    setVoiding(true);
    setErrorMsg(null);

    try {
      await voidInvestorWithdrawal(voidTarget.id, voidReason, userProfile);
      setSuccessMsg(`Penarikan dana investor telah DIBATALKAN (VOID) dan transaksi kas terkait telah dinonaktifkan.`);
      setVoidTarget(null);
      setVoidReason('');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal membatalkan penarikan investor.');
    } finally {
      setVoiding(false);
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    if (withdrawals.length === 0) return;

    const headers = [
      'ID Withdrawal',
      'Tanggal Pembayaran',
      'Periode Settlement',
      'Nama Investor',
      'Nominal (Rp)',
      'Metode Pembayaran',
      'Rekening Tujuan',
      'ID Transaksi Kas Master',
      'Status',
      'Catatan',
      'Dibuat Oleh',
      'Alasan VOID',
    ];

    const rows = withdrawals.map((w) => [
      w.withdrawalId || w.id,
      w.date,
      w.periodLabel,
      w.investorName,
      w.amount,
      w.paymentMethod,
      w.bankAccount || '-',
      w.transactionId || '-',
      w.status,
      w.notes || '-',
      w.createdByName || '-',
      w.voidReason || '-',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.map((cell) => `"${cell}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Withdrawal_Investor_PT_KDRT_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* 1. Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-blue-800">
            <span className="text-[11px] font-black uppercase tracking-wider">
              TOTAL HAK INVESTOR (APPROVED)
            </span>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-950 mt-2">
            {formatRupiah(totalHakInvestor)}
          </div>
          <div className="text-[11px] font-medium text-blue-700 mt-1">
            Akumulasi Hak Bagi Hasil Tersahkan
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-[11px] font-black uppercase tracking-wider">
              SUDAH DIBAYAR / DITARIK
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-950 mt-2">
            {formatRupiah(totalSudahDibayar)}
          </div>
          <div className="text-[11px] font-medium text-emerald-700 mt-1">
            Tercatat di Buku Kas Master (Outflow)
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-2xs">
          <div className="flex items-center justify-between text-amber-800">
            <span className="text-[11px] font-black uppercase tracking-wider">
              SISA KEWAJIBAN (ACCRUED)
            </span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-950 mt-2">
            {formatRupiah(sisaKewajiban)}
          </div>
          <div className="text-[11px] font-medium text-amber-700 mt-1">
            Belum Menjadi Pengeluaran Kas
          </div>
        </div>
      </div>

      {/* Alert Notices */}
      {errorMsg && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-800 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 2. Toolbar & Table */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-zinc-900 tracking-tight flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-blue-600" />
              Riwayat Pembayaran & Penarikan Hak Investor (Withdrawal)
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Setiap penarikan otomatis membuat mutasi pengeluaran kategori BAGI HASIL di Buku Kas Master.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              disabled={withdrawals.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 px-3 py-2 text-xs font-bold text-zinc-700 transition-colors disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              <span>Export CSV</span>
            </button>

            {isOwner && (
              <button
                onClick={() => handleOpenAddModal()}
                disabled={payableSettlements.length === 0}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-black shadow-xs transition-colors disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                <span>Catat Pembayaran Investor</span>
              </button>
            )}
          </div>
        </div>

        {/* Table of Withdrawals */}
        <div className="rounded-xl border border-zinc-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-black uppercase tracking-wider text-zinc-500">
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Periode Settlement</th>
                  <th className="py-3 px-4">Penerima (Investor)</th>
                  <th className="py-3 px-4">Nominal</th>
                  <th className="py-3 px-4">Metode & Rekening</th>
                  <th className="py-3 px-4 text-center">Bukti Transfer</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {withdrawals.map((w) => (
                  <tr key={w.id || w.withdrawalId} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-zinc-900">
                      {formatTanggal(w.date)}
                    </td>

                    <td className="py-3.5 px-4 font-bold text-purple-900">
                      {w.periodLabel}
                    </td>

                    <td className="py-3.5 px-4 font-medium text-zinc-800">
                      {w.investorName}
                    </td>

                    <td className="py-3.5 px-4 font-black text-rose-700">
                      {formatRupiah(w.amount)}
                    </td>

                    <td className="py-3.5 px-4 text-zinc-600">
                      <span className="font-bold text-zinc-900">{w.paymentMethod}</span>
                      {w.bankAccount && (
                        <span className="text-[10px] text-zinc-400 block">{w.bankAccount}</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {w.receiptUrl ? (
                        <button
                          onClick={() => setPreviewImageUrl(w.receiptUrl!)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded-lg border border-blue-200"
                        >
                          <ImageIcon className="h-3.5 w-3.5" />
                          <span>Lihat Foto</span>
                        </button>
                      ) : (
                        <span className="text-zinc-400 text-[10px]">-</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                          w.status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}
                      >
                        {w.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {w.status !== 'VOID' && isOwner && (
                        <button
                          onClick={() => {
                            setVoidTarget(w);
                            setVoidReason('');
                            setErrorMsg(null);
                          }}
                          className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors"
                          title="Batalkan (VOID) Pembayaran"
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {withdrawals.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-zinc-400 text-xs">
                      Belum ada catatan pembayaran atau penarikan investor.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Catat Pembayaran Investor */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl border border-zinc-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  PENCATATAN WITHDRAWAL
                </span>
                <h3 className="text-base font-black text-zinc-900 mt-1">
                  Catat Pembayaran Hak Investor
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitWithdrawal} className="space-y-4 text-xs">
              {/* 1. Pilih Settlement */}
              <div>
                <label className="font-bold text-zinc-700 block mb-1">
                  Pilih Settlement Bagi Hasil: *
                </label>
                <select
                  value={selectedSettlementId}
                  onChange={(e) => {
                    setSelectedSettlementId(e.target.value);
                    const s = settlements.find((item) => item.id === e.target.value);
                    if (s) {
                      setWithdrawalAmount(
                        s.remainingInvestorObligation !== undefined
                          ? s.remainingInvestorObligation
                          : s.investorAmount
                      );
                    }
                  }}
                  required
                  className="w-full rounded-xl border border-zinc-300 p-2.5 font-bold text-zinc-800 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Pilih Settlement Periode --</option>
                  {payableSettlements.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.periodLabel} (Sisa Hak: {formatRupiah(s.remainingInvestorObligation ?? s.investorAmount)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Settlement Info Card */}
              {currentSelectedSettlement && (
                <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 flex justify-between items-center text-xs">
                  <div>
                    <span className="text-blue-900 font-bold block">
                      Periode: {currentSelectedSettlement.periodLabel}
                    </span>
                    <span className="text-[11px] text-blue-700">
                      Total Hak: {formatRupiah(currentSelectedSettlement.investorAmount)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-zinc-500 block">
                      Sisa Kewajiban:
                    </span>
                    <span className="text-sm font-black text-blue-950">
                      {formatRupiah(
                        currentSelectedSettlement.remainingInvestorObligation ??
                          currentSelectedSettlement.investorAmount
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* 2. Tanggal & Nominal */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-zinc-700 block mb-1">
                    Tanggal Pembayaran: *
                  </label>
                  <input
                    type="date"
                    value={withdrawalDate}
                    onChange={(e) => setWithdrawalDate(e.target.value)}
                    required
                    className="w-full rounded-xl border border-zinc-300 p-2.5 font-bold text-zinc-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-zinc-700 block mb-1">
                    Nominal Pembayaran (Rp): *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={withdrawalAmount}
                    onChange={(e) =>
                      setWithdrawalAmount(e.target.value ? Number(e.target.value) : '')
                    }
                    placeholder="Contoh: 13500000"
                    required
                    className="w-full rounded-xl border border-zinc-300 p-2.5 font-black text-rose-700 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* 3. Penerima & Rekening */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-zinc-700 block mb-1">
                    Nama Investor / Penerima:
                  </label>
                  <input
                    type="text"
                    value={investorName}
                    onChange={(e) => setInvestorName(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 font-bold text-zinc-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-zinc-700 block mb-1">
                    Metode Pembayaran:
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 font-bold text-zinc-800"
                  >
                    <option value="TRANSFER">TRANSFER BANK</option>
                    <option value="CASH">CASH / TUNAI</option>
                    <option value="EWALLET">E-WALLET</option>
                    <option value="LAINNYA">LAINNYA</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-zinc-700 block mb-1">
                  Detail Rekening / Bank:
                </label>
                <input
                  type="text"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  placeholder="Contoh: BCA 12345678 a.n Nama Investor"
                  className="w-full rounded-xl border border-zinc-300 p-2.5 font-medium text-zinc-800"
                />
              </div>

              {/* 4. Upload Bukti Transfer */}
              <div>
                <label className="font-bold text-zinc-700 block mb-1">
                  Foto Bukti Transfer (Opsional):
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full rounded-xl border border-zinc-300 p-2 font-medium text-zinc-700 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {receiptPreviewUrl && (
                  <div className="mt-2 relative w-24 h-24 rounded-xl overflow-hidden border border-zinc-200">
                    <img
                      src={receiptPreviewUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>

              {/* 5. Catatan */}
              <div>
                <label className="font-bold text-zinc-700 block mb-1">
                  Catatan / Keterangan:
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Catatan transfer bagi hasil..."
                  className="w-full rounded-xl border border-zinc-300 p-2.5 font-medium text-zinc-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{saving ? 'Menyimpan...' : 'Simpan Pembayaran'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Preview Gambar Bukti Transfer */}
      {previewImageUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="relative max-w-2xl max-h-[90vh] bg-white rounded-2xl overflow-hidden p-2">
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="absolute top-4 right-4 z-10 bg-black/60 text-white rounded-full p-1.5 hover:bg-black/80 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={previewImageUrl}
              alt="Bukti Transfer"
              className="max-h-[85vh] w-auto mx-auto object-contain rounded-xl"
            />
          </div>
        </div>
      )}

      {/* Modal VOID Withdrawal */}
      {voidTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl border border-zinc-200 space-y-4">
            <div className="flex items-center gap-2 text-rose-600">
              <Ban className="h-5 w-5" />
              <h3 className="text-base font-black text-zinc-900">Batalkan (VOID) Pembayaran</h3>
            </div>
            <p className="text-xs text-zinc-500">
              Pembayaran senilai <strong>{formatRupiah(voidTarget.amount)}</strong> pada {formatTanggal(voidTarget.date)} akan dibatalkan. Transaksi pengeluaran kas di Buku Kas Master juga akan di-VOID.
            </p>

            <div>
              <label className="text-xs font-bold text-zinc-700 block mb-1">
                Alasan Pembatalan (Wajib Minimal 5 Karakter):
              </label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Contoh: Kesalahan transfer rekening atau koreksi nominal..."
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
                disabled={voiding || voidReason.trim().length < 5}
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
