import React from 'react';
import { X, Printer, Building2, CheckCircle2, DollarSign, Sparkles } from 'lucide-react';
import { PayrollRecord } from '../types';
import { formatRupiah, formatTanggal, formatBulanTahun } from '../utils/formatters';

interface SlipGajiModalProps {
  payroll: PayrollRecord | null;
  onClose: () => void;
}

export const SlipGajiModal: React.FC<SlipGajiModalProps> = ({ payroll, onClose }) => {
  if (!payroll) return null;

  const handlePrint = () => {
    window.print();
  };

  const total = payroll.totalPay || payroll.total || 0;
  const isPaid = payroll.status === 'PAID' || payroll.status === 'SUDAH DIBAYAR';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-zinc-200 text-zinc-900 overflow-hidden flex flex-col my-8">
        {/* Modal Controls Bar */}
        <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-6 py-4 print:hidden">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            <h3 className="font-bold text-zinc-800 text-sm">Slip Gaji Karyawan PT.KDRT</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition-colors shadow-2xs"
            >
              <Printer className="h-4 w-4" /> Cetak / Unduh PDF
            </button>
            <button
              onClick={onClose}
              className="rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Slip Document Printable Container */}
        <div className="p-8 sm:p-10 bg-white space-y-6 print:p-0">
          {/* Company Header */}
          <div className="border-b-2 border-zinc-900 pb-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white font-extrabold">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h1 className="text-xl font-extrabold tracking-tight text-zinc-900">PT. KDRT</h1>
                    <p className="text-xs text-zinc-500 font-medium">
                      Kantor Operasional & Studio Talent (Kategori SHARING)
                    </p>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="inline-block rounded-lg bg-zinc-900 px-3 py-1 text-xs font-extrabold text-white uppercase tracking-wider">
                  SLIP GAJI RESMI
                </div>
                <p className="text-xs text-zinc-600 mt-1 font-bold">
                  Periode: {payroll.monthLabel || formatBulanTahun(payroll.month)}
                </p>
              </div>
            </div>
          </div>

          {/* Employee & Meta Details */}
          <div className="grid grid-cols-2 gap-4 rounded-xl bg-zinc-50 p-4 border border-zinc-100 text-xs">
            <div>
              <span className="block text-[11px] font-bold text-zinc-400 uppercase">Nama Karyawan</span>
              <span className="font-extrabold text-zinc-900 text-sm mt-0.5 block">{payroll.employeeName}</span>
              {payroll.jobTitle && (
                <span className="text-[11px] text-zinc-500 font-medium">{payroll.jobTitle}</span>
              )}
            </div>
            <div>
              <span className="block text-[11px] font-bold text-zinc-400 uppercase">Status Pembayaran</span>
              <span
                className={`inline-flex items-center gap-1 font-bold text-xs rounded-full px-2.5 py-0.5 mt-0.5 ${
                  isPaid
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                    : 'bg-amber-100 text-amber-900 border border-amber-200'
                }`}
              >
                {isPaid && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                {isPaid ? 'SUDAH DIBAYAR (PAID)' : 'MENUNGGU PEMBAYARAN'}
              </span>
            </div>
            <div>
              <span className="block text-[11px] font-bold text-zinc-400 uppercase">Tanggal Pembayaran</span>
              <span className="font-semibold text-zinc-800">
                {payroll.paidAt
                  ? formatTanggal(payroll.paymentDate || payroll.paidAt)
                  : 'Rutin Tanggal 25 Setiap Bulan'}
              </span>
            </div>
            <div>
              <span className="block text-[11px] font-bold text-zinc-400 uppercase">Otorisasi Pembayaran</span>
              <span className="font-semibold text-zinc-800">
                {payroll.paidByName || payroll.approvedByName || 'Owner PT.KDRT'}
              </span>
            </div>
          </div>

          {/* Breakdown Table */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Rincian Komponen Penghasilan
            </h4>
            <div className="divide-y divide-zinc-100 border-y border-zinc-200 text-xs">
              {/* Gaji Pokok */}
              <div className="flex justify-between py-3">
                <div>
                  <span className="text-zinc-800 font-bold">Gaji Pokok</span>
                  <p className="text-[11px] text-zinc-400">Gaji dasar bulanan tetap</p>
                </div>
                <span className="font-bold text-zinc-900 text-sm">
                  {formatRupiah(payroll.baseSalary)}
                </span>
              </div>

              {/* Uang Rajin */}
              <div className="flex justify-between py-3">
                <div>
                  <span className="text-zinc-800 font-bold flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-emerald-600" />
                    Uang Rajin Mingguan (Presensi Realtime)
                  </span>
                  <p className="text-[11px] text-zinc-400">
                    Akumulasi bonus kedisiplinan dan absensi tepat waktu (Rp150.000/minggu)
                  </p>
                </div>
                <span className="font-bold text-emerald-700 text-sm">
                  +{formatRupiah(payroll.attendanceBonus)}
                </span>
              </div>

              {/* Bonus Tambahan */}
              {(payroll.bonus || payroll.bonusAmount || 0) > 0 && (
                <div className="flex justify-between py-3">
                  <div>
                    <span className="text-zinc-800 font-bold">Bonus & Insentif Khusus</span>
                    {payroll.bonusNote && (
                      <p className="text-[11px] text-zinc-500">{payroll.bonusNote}</p>
                    )}
                  </div>
                  <span className="font-bold text-emerald-700 text-sm">
                    +{formatRupiah(payroll.bonus || payroll.bonusAmount || 0)}
                  </span>
                </div>
              )}

              {/* Penyesuaian Tambahan */}
              {(payroll.adjustmentAddition || 0) > 0 && (
                <div className="flex justify-between py-3">
                  <div>
                    <span className="text-zinc-800 font-bold">Penyesuaian Tambahan (+)</span>
                    {payroll.adjustmentAdditionNote && (
                      <p className="text-[11px] text-zinc-500">{payroll.adjustmentAdditionNote}</p>
                    )}
                  </div>
                  <span className="font-bold text-emerald-700 text-sm">
                    +{formatRupiah(payroll.adjustmentAddition || 0)}
                  </span>
                </div>
              )}

              {/* Potongan Manual */}
              {(payroll.adjustmentDeduction || payroll.deduction || 0) > 0 && (
                <div className="flex justify-between py-3">
                  <div>
                    <span className="text-zinc-800 font-bold">Potongan Manual (−)</span>
                    {(payroll.adjustmentDeductionNote || payroll.deductionNote) && (
                      <p className="text-[11px] text-zinc-500">
                        {payroll.adjustmentDeductionNote || payroll.deductionNote}
                      </p>
                    )}
                  </div>
                  <span className="font-bold text-rose-600 text-sm">
                    -{formatRupiah(payroll.adjustmentDeduction || payroll.deduction || 0)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Grand Total */}
          <div className="flex items-center justify-between rounded-2xl bg-zinc-900 p-5 text-white shadow-xs">
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-zinc-400 font-bold">
                Total Gaji Bersih Diterima
              </span>
              <span className="text-xs text-zinc-300">Take Home Pay (THP)</span>
            </div>
            <span className="text-2xl font-extrabold text-emerald-400">
              {formatRupiah(total)}
            </span>
          </div>

          {/* Signature Footer */}
          <div className="pt-8 flex justify-between items-end text-xs text-zinc-500">
            <div>
              <p className="font-medium text-zinc-600">Penerima (Karyawan),</p>
              <div className="h-16"></div>
              <p className="font-bold text-zinc-900 border-t border-zinc-300 pt-1">
                {payroll.employeeName}
              </p>
            </div>
            <div className="text-right">
              <p className="font-medium text-zinc-600">Disetujui & Dibayarkan oleh,</p>
              <div className="h-16"></div>
              <p className="font-bold text-zinc-900 border-t border-zinc-300 pt-1">
                {payroll.paidByName || payroll.approvedByName || 'Owner PT.KDRT'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
