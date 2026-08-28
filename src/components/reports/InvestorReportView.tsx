import React from 'react';
import {
  ShieldCheck,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  Download,
  FileSpreadsheet,
  Landmark,
} from 'lucide-react';

import {
  Transaction,
  Expense,
  ProfitSharingSettlement,
  UserProfile,
  ReportScopeFilter,
} from '../../types';

import { formatRupiah } from '../../utils/formatters';
import { exportReportData } from '../../services/exportService';

interface InvestorReportViewProps {
  transactions: Transaction[];
  expenses: Expense[];
  settlements: ProfitSharingSettlement[];
  userProfile: UserProfile;
  scope: ReportScopeFilter;
  dateRange: string;
}

const normalizeSourceType = (
  transaction: Transaction
) =>
  String(
    transaction.sourceType || ''
  ).toUpperCase();

const isKomisiReal = (
  transaction: Transaction
) => {
  const source =
    normalizeSourceType(transaction);

  return (
    source === 'COMMISSION_REAL' ||
    source === 'TIKTOK_COMMISSION' ||
    source === 'TIKTOK COMMISSION'
  );
};

const isFundTransfer = (
  transaction: Transaction
) =>
  normalizeSourceType(transaction) ===
  'FUND_TRANSFER';

const getFundTransferNet = (
  transaction: Transaction
) => {
  const net =
    Number(transaction.netAmount);

  if (net > 0) {
    return net;
  }

  return Math.max(
    0,
    Number(transaction.amount || 0) -
      Number(transaction.adminFee || 0)
  );
};

export const InvestorReportView: React.FC<
  InvestorReportViewProps
> = ({
  transactions,
  expenses,
  settlements,
  userProfile,
  scope,
  dateRange,
}) => {
  /*
   * ============================================================
   * INVESTOR REPORT = SHARING ONLY
   *
   * KOMISI REAL
   * -> performa akun
   * -> bukan uang bank
   *
   * PINDAH DANA
   * -> uang benar-benar masuk bank
   * -> gunakan NET AMOUNT
   *
   * EXPENSE
   * -> uang benar-benar keluar
   * ============================================================
   */

  const sharingTransactions =
    transactions.filter(
      (transaction) =>
        transaction.scope === 'SHARING'
    );

  const sharingCashTransactions =
    sharingTransactions.filter(
      (transaction) =>
        !isKomisiReal(transaction)
    );

  const sharingExpenses =
    expenses.filter(
      (expense) =>
        expense.scope === 'SHARING'
    );

  const sharingSettlements =
    settlements;

  let uangMasukSharing = 0;
  let uangKeluarSharing = 0;

  let jumlahUangMasuk = 0;
  let jumlahUangKeluar = 0;

  let totalKomisiRealExcluded = 0;

  sharingCashTransactions.forEach(
    (transaction) => {
      if (
        isFundTransfer(transaction) &&
        transaction.type === 'INCOME'
      ) {
        const net =
          getFundTransferNet(transaction);

        if (net > 0) {
          uangMasukSharing += net;
          jumlahUangMasuk++;
        }

        return;
      }

      if (
        transaction.type === 'INCOME'
      ) {
        uangMasukSharing +=
          Number(transaction.amount) || 0;

        jumlahUangMasuk++;
        return;
      }

      if (
        transaction.type === 'EXPENSE'
      ) {
        uangKeluarSharing +=
          Number(transaction.amount) || 0;

        jumlahUangKeluar++;
      }
    }
  );

  sharingTransactions
    .filter(isKomisiReal)
    .forEach((transaction) => {
      totalKomisiRealExcluded +=
        Number(transaction.amount) || 0;
    });

  const saldoSharing =
    uangMasukSharing -
    uangKeluarSharing;

  /*
   * Detail expenses hanya untuk laporan.
   *
   * Tidak dikurangkan lagi ke saldo karena
   * transaction EXPENSE sudah melakukan
   * pengurangan Kas & Bank.
   */
  const totalExpenseSharing =
    sharingExpenses.reduce(
      (total, expense) =>
        total +
        (Number(expense.amount) || 0),
      0
    );

  let totalHakInvestor = 0;
  let totalSudahDibayar = 0;
  let totalBelumDibayar = 0;

  sharingSettlements.forEach(
    (settlement) => {
      const hak =
        Number(
          settlement.bagianInvestor
        ) || 0;

      totalHakInvestor += hak;

      if (
        settlement.statusPembayaran ===
        'PAID'
      ) {
        totalSudahDibayar += hak;
      } else {
        totalBelumDibayar += hak;
      }
    }
  );

  const cashCoverage =
    totalHakInvestor > 0
      ? (
          (uangMasukSharing /
            totalHakInvestor) *
          100
        )
      : 0;

  const handleExport = (
    format: 'CSV' | 'XLSX'
  ) => {
    const exportData =
      sharingSettlements.map(
        (settlement) => {
          const hak =
            Number(
              settlement.bagianInvestor
            ) || 0;

          const paid =
            settlement.statusPembayaran ===
            'PAID'
              ? hak
              : 0;

          const remaining =
            Math.max(
              0,
              hak - paid
            );

          return {
            Periode:
              settlement.period,

            Tier:
              settlement.tierName ||
              `Tier ${settlement.tier}`,

            'Kas & Bank Masuk Sharing':
              settlement.totalUangMasuk ||
              0,

            'Hak Investor': hak,

            'Sudah Dibayar': paid,

            'Belum Dibayar': remaining,

            'Status Pembayaran':
              settlement.statusPembayaran,

            'Tanggal Cair':
              settlement.settledDate ||
              settlement.paidDate ||
              '-',
          };
        }
      );

    exportReportData({
      filenamePrefix:
        'laporan_investor_sharing',

      sheetName:
        'Laporan Investor',

      category:
        'LAPORAN_INVESTOR',

      scope: 'SHARING',

      periodOrDateRange:
        dateRange,

      data: exportData,

      format,

      userProfile,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-purple-200 bg-white p-4 shadow-2xs sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-base font-black text-purple-950">
            <ShieldCheck className="h-5 w-5 text-purple-600" />
            LAPORAN KEUANGAN & BAGI HASIL
            INVESTOR
          </h2>

          <p className="text-xs font-medium text-purple-700">
            SHARING POOL berdasarkan Kas &
            Bank aktual dan settlement investor
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              handleExport('CSV')
            }
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>

          <button
            onClick={() =>
              handleExport('XLSX')
            }
            className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-purple-700"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Export Excel (.xlsx)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
              KAS & BANK
              <br />
              UANG MASUK SHARING
            </span>
            <ArrowDownRight className="h-4 w-4 text-emerald-600" />
          </div>

          <div className="font-mono text-xl font-black text-emerald-950">
            {formatRupiah(
              uangMasukSharing
            )}
          </div>

          <div className="mt-1 text-[11px] text-emerald-700">
            Uang yang benar-benar masuk
            ke rekening/kas
          </div>

          <div className="mt-2 text-[10px] font-bold text-emerald-600">
            {jumlahUangMasuk} transaksi
          </div>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-700">
              KAS & BANK
              <br />
              UANG KELUAR SHARING
            </span>
            <ArrowUpRight className="h-4 w-4 text-rose-600" />
          </div>

          <div className="font-mono text-xl font-black text-rose-950">
            {formatRupiah(
              uangKeluarSharing
            )}
          </div>

          <div className="mt-1 text-[11px] text-rose-700">
            Pengeluaran yang benar-benar
            mengurangi Kas & Bank
          </div>

          <div className="mt-2 text-[10px] font-bold text-rose-600">
            {jumlahUangKeluar} transaksi
          </div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-700">
              SALDO KAS & BANK
              <br />
              SHARING
            </span>
            <Wallet className="h-4 w-4 text-blue-600" />
          </div>

          <div className="font-mono text-xl font-black text-blue-950">
            {formatRupiah(saldoSharing)}
          </div>

          <div className="mt-1 text-[11px] text-blue-700">
            Uang Masuk − Uang Keluar
          </div>
        </div>

        <div className="rounded-2xl border border-purple-200 bg-purple-50/70 p-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-700">
              TOTAL HAK INVESTOR
            </span>
            <ShieldCheck className="h-4 w-4 text-purple-600" />
          </div>

          <div className="font-mono text-xl font-black text-purple-950">
            {formatRupiah(
              totalHakInvestor
            )}
          </div>

          <div className="mt-1 text-[11px] font-bold text-purple-700">
            Sudah Dibayar:{' '}
            {formatRupiah(
              totalSudahDibayar
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />

          <div>
            <div className="text-xs font-black uppercase tracking-wider text-amber-900">
              Komisi Real Bukan Saldo Bank
            </div>

            <p className="mt-1 text-xs font-medium text-amber-800">
              Komisi Real TikTok adalah data
              performa akun. Nilainya baru
              menjadi Kas & Bank setelah
              Pindah Dana.
            </p>

            {totalKomisiRealExcluded > 0 && (
              <div className="mt-2 text-[10px] font-bold text-amber-700">
                Komisi Real lama yang
                dikecualikan:
                {' '}
                {formatRupiah(
                  totalKomisiRealExcluded
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs sm:flex-row sm:items-center">
        <div>
          <div className="font-black uppercase tracking-wider text-amber-900">
            Sisa Kewajiban Pembayaran
            Bagi Hasil Investor
          </div>

          <div className="mt-0.5 font-medium text-amber-700">
            Akumulasi settlement yang
            belum dibayar.
          </div>
        </div>

        <div className="whitespace-nowrap font-mono text-xl font-black text-amber-950">
          {formatRupiah(
            totalBelumDibayar
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
              Posisi Kas terhadap Hak Investor
            </h3>

            <p className="mt-0.5 text-[11px] text-slate-500">
              Indikator posisi kas, bukan
              pembayaran otomatis.
            </p>
          </div>

          <span className="font-mono text-sm font-black text-indigo-700">
            {Math.min(
              100,
              Math.max(
                0,
                cashCoverage
              )
            ).toFixed(1)}
            %
          </span>
        </div>

        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all"
            style={{
              width: `${Math.min(
                100,
                Math.max(
                  0,
                  cashCoverage
                )
              )}%`,
            }}
          />
        </div>

        <div className="mt-2 flex justify-between text-[10px] font-bold text-slate-500">
          <span>
            Kas & Bank:{' '}
            {formatRupiah(
              uangMasukSharing
            )}
          </span>

          <span>
            Hak Investor:{' '}
            {formatRupiah(
              totalHakInvestor
            )}
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
        <div className="border-b border-slate-100 p-4">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
            Rekapitulasi Hak Bagi Hasil
            Investor Per Periode
          </h3>

          <p className="mt-0.5 text-[10px] text-slate-500">
            {sharingSettlements.length}{' '}
            settlement
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-black uppercase tracking-wider text-slate-700">
                <th className="px-4 py-3">
                  Periode
                </th>
                <th className="px-4 py-3">
                  Tier
                </th>
                <th className="px-4 py-3 text-right">
                  Kas & Bank Masuk
                </th>
                <th className="px-4 py-3 text-right">
                  Hak Investor
                </th>
                <th className="px-4 py-3 text-right">
                  Sudah Dibayar
                </th>
                <th className="px-4 py-3 text-right">
                  Sisa
                </th>
                <th className="px-4 py-3 text-center">
                  Status
                </th>
                <th className="px-4 py-3 text-center">
                  Tanggal Cair
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {sharingSettlements.map(
                (settlement) => {
                  const hak =
                    Number(
                      settlement.bagianInvestor
                    ) || 0;

                  const paid =
                    settlement.statusPembayaran ===
                    'PAID'
                      ? hak
                      : 0;

                  const remaining =
                    Math.max(
                      0,
                      hak - paid
                    );

                  return (
                    <tr
                      key={
                        settlement.id ||
                        settlement.settlementId
                      }
                      className="hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {settlement.period}
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-flex rounded bg-purple-100 px-2 py-0.5 text-[10px] font-black text-purple-800">
                          {settlement.tierName ||
                            `Tier ${settlement.tier}`}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">
                        {formatRupiah(
                          settlement.totalUangMasuk ||
                            0
                        )}
                      </td>

                      <td className="px-4 py-3 text-right font-mono font-black text-purple-800">
                        {formatRupiah(hak)}
                      </td>

                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">
                        {formatRupiah(paid)}
                      </td>

                      <td className="px-4 py-3 text-right font-mono font-bold text-amber-700">
                        {formatRupiah(
                          remaining
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                            settlement.statusPembayaran ===
                            'PAID'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {
                            settlement.statusPembayaran
                          }
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center font-mono text-[10px] text-slate-500">
                        {settlement.settledDate ||
                          settlement.paidDate ||
                          '-'}
                      </td>
                    </tr>
                  );
                }
              )}

              {sharingSettlements.length ===
                0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="py-12 text-center text-xs italic text-slate-400"
                  >
                    Belum ada data bagi
                    hasil investor pada
                    periode ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-[10px] font-black uppercase tracking-wider text-slate-700">
          Prinsip Laporan Investor
        </div>

        <div className="mt-2 grid grid-cols-1 gap-3 text-[11px] text-slate-600 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="font-black text-purple-800">
              1. Performa Akun
            </div>
            <div className="mt-1">
              GMV dan Komisi Real adalah
              performa, bukan saldo rekening.
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="font-black text-emerald-800">
              2. Kas & Bank
            </div>
            <div className="mt-1">
              Hanya uang yang benar-benar
              masuk atau keluar yang
              mempengaruhi saldo.
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="font-black text-indigo-800">
              3. Pindah Dana
            </div>
            <div className="mt-1">
              Komisi Real menjadi Kas &
              Bank setelah pencairan,
              menggunakan dana bersih
              setelah admin.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
