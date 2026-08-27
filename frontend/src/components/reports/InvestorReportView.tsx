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

const isKomisiReal = (tx: Transaction) => {
  const sourceType = String(
    tx.sourceType || ''
  ).toUpperCase();

  return (
    sourceType === 'COMMISSION_REAL' ||
    sourceType === 'TIKTOK_COMMISSION' ||
    sourceType === 'TIKTOK COMMISSION'
  );
};

const isFundTransfer = (tx: Transaction) => {
  const sourceType = String(
    tx.sourceType || ''
  ).toUpperCase();

  return sourceType === 'FUND_TRANSFER';
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
   * PEMISAHAN:
   *
   * KOMISI REAL
   * -> performa akun TikTok
   * -> belum menjadi uang bank
   *
   * PINDAH DANA
   * -> uang benar-benar masuk rekening
   * -> yang dihitung adalah NET AMOUNT
   *
   * EXPENSE
   * -> uang benar-benar keluar
   * -> hanya transaction yang menjadi sumber Kas & Bank
   *
   * Jadi laporan Investor tidak lagi menganggap Komisi Real
   * sebagai uang masuk bank.
   * ============================================================
   */

  const sharingTx = transactions.filter(
    (tx) =>
      tx.scope === 'SHARING' &&
      !isKomisiReal(tx)
  );

  const sharingExp = expenses.filter(
    (expense) =>
      expense.scope === 'SHARING'
  );

  const sharingSettlements =
    settlements.filter((settlement) => {
      /*
       * Settlement secara bisnis adalah SHARING pool.
       * Tidak perlu memaksa field scope pada settlement.
       */
      return true;
    });

  /* ============================================================
     KAS & BANK SHARING
     ============================================================ */

  let uangMasukSharing = 0;
  let uangKeluarSharing = 0;

  let jumlahUangMasuk = 0;
  let jumlahUangKeluar = 0;

  let totalKomisiRealExcluded = 0;

  sharingTx.forEach((tx) => {
    const amount =
      Number(tx.amount) || 0;

    /*
     * Pindah Dana:
     *
     * bruto komisi
     * - admin TikTok
     * = uang aktual masuk bank
     */
    if (
      isFundTransfer(tx) &&
      tx.type === 'INCOME'
    ) {
      const netAmount =
        Number(
          tx.netAmount
        ) ||
        Math.max(
          0,
          amount -
            Number(
              tx.adminFee || 0
            )
        );

      if (netAmount > 0) {
        uangMasukSharing +=
          netAmount;

        jumlahUangMasuk += 1;
      }

      return;
    }

    /*
     * Uang masuk manual / income lainnya.
     */
    if (tx.type === 'INCOME') {
      uangMasukSharing +=
        amount;

      jumlahUangMasuk += 1;

      return;
    }

    /*
     * Uang keluar.
     */
    if (tx.type === 'EXPENSE') {
      uangKeluarSharing +=
        amount;

      jumlahUangKeluar += 1;
    }
  });

  /*
   * Untuk berjaga-jaga jika data lama Komisi Real masih berada
   * di transactions, jangan pernah masukkan ke Kas & Bank.
   */
  transactions
    .filter(
      (tx) =>
        tx.scope === 'SHARING' &&
        isKomisiReal(tx)
    )
    .forEach((tx) => {
      totalKomisiRealExcluded +=
        Number(tx.amount) || 0;
    });

  const saldoSharing =
    uangMasukSharing -
    uangKeluarSharing;

  /* ============================================================
     EXPENSE DETAIL
     ============================================================ */

  const totalExpenseSharing =
    sharingExp.reduce(
      (total, expense) =>
        total +
        (Number(expense.amount) || 0),
      0
    );

  /*
   * Jangan gunakan totalExpenseSharing sebagai pengurang
   * Kas & Bank lagi karena expense tersebut sudah tercermin
   * di transactions.
   *
   * Ini mencegah double counting.
   */

  /* ============================================================
     INVESTOR SETTLEMENT
     ============================================================ */

  let totalHakInvestor = 0;
  let totalSudahDibayar = 0;
  let totalBelumDibayar = 0;

  sharingSettlements.forEach(
    (settlement) => {
      const bagianInvestor =
        Number(
          settlement.bagianInvestor
        ) || 0;

      totalHakInvestor +=
        bagianInvestor;

      if (
        settlement.statusPembayaran ===
        'PAID'
      ) {
        totalSudahDibayar +=
          bagianInvestor;
      } else {
        totalBelumDibayar +=
          bagianInvestor;
      }
    }
  );

  /*
   * ============================================================
   * CASHFLOW STATUS
   * ============================================================
   */

  const cashCoverage =
    totalHakInvestor > 0
      ? (
          (uangMasukSharing /
            totalHakInvestor) *
          100
        )
      : 0;

  /*
   * ============================================================
   * EXPORT
   * ============================================================
   */

  const handleExport = (
    format: 'CSV' | 'XLSX'
  ) => {
    const exportData =
      sharingSettlements.map(
        (settlement) => ({
          Periode:
            settlement.period,

          Tier:
            settlement.tierName ||
            `Tier ${settlement.tier}`,

          'Kas & Bank Masuk Sharing':
            settlement.totalUangMasuk ||
            0,

          'Hak Investor':
            settlement.bagianInvestor ||
            0,

          'Sudah Dibayar':
            settlement.statusPembayaran ===
            'PAID'
              ? settlement.bagianInvestor ||
                0
              : 0,

          'Belum Dibayar':
            settlement.statusPembayaran !==
            'PAID'
              ? settlement.bagianInvestor ||
                0
              : 0,

          'Status Pembayaran':
            settlement.statusPembayaran,

          'Tanggal Cair':
            settlement.settledDate ||
            settlement.paidDate ||
            '-',
        })
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

      {/* ======================================================
          HEADER
          ====================================================== */}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-purple-200 shadow-2xs">

        <div>
          <h2 className="text-base font-black text-purple-950 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-purple-600" />

            <span>
              LAPORAN KEUANGAN & BAGI HASIL
              INVESTOR
            </span>
          </h2>

          <p className="text-xs text-purple-700 font-medium">
            SHARING POOL berdasarkan Kas &
            Bank aktual dan settlement investor
          </p>
        </div>

        <div className="flex items-center gap-2">

          <button
            onClick={() =>
              handleExport('CSV')
            }
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />

            <span>
              Export CSV
            </span>
          </button>

          <button
            onClick={() =>
              handleExport('XLSX')
            }
            className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-purple-700 transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />

            <span>
              Export Excel (.xlsx)
            </span>
          </button>
        </div>
      </div>

      {/* ======================================================
          PRIMARY KPI
          ====================================================== */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* KAS MASUK */}

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-2xs">

          <div className="flex items-center justify-between mb-1">

            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
              KAS & BANK
              <br />
              UANG MASUK SHARING
            </span>

            <ArrowDownRight className="h-4 w-4 text-emerald-600" />
          </div>

          <div className="text-xl font-black text-emerald-950 font-mono tracking-tight">
            {formatRupiah(
              uangMasukSharing
            )}
          </div>

          <div className="mt-1 text-[11px] text-emerald-700">
            Uang yang benar-benar masuk
            ke rekening/kas
          </div>

          <div className="mt-2 text-[10px] font-bold text-emerald-600">
            {jumlahUangMasuk}{' '}
            transaksi
          </div>
        </div>

        {/* KAS KELUAR */}

        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 shadow-2xs">

          <div className="flex items-center justify-between mb-1">

            <span className="text-[10px] font-black uppercase tracking-wider text-rose-700">
              KAS & BANK
              <br />
              UANG KELUAR SHARING
            </span>

            <ArrowUpRight className="h-4 w-4 text-rose-600" />
          </div>

          <div className="text-xl font-black text-rose-950 font-mono tracking-tight">
            {formatRupiah(
              uangKeluarSharing
            )}
          </div>

          <div className="mt-1 text-[11px] text-rose-700">
            Pengeluaran yang benar-benar
            mengurangi Kas & Bank
          </div>

          <div className="mt-2 text-[10px] font-bold text-rose-600">
            {jumlahUangKeluar}{' '}
            transaksi
          </div>
        </div>

        {/* SALDO */}

        <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 shadow-2xs">

          <div className="flex items-center justify-between mb-1">

            <span className="text-[10px] font-black uppercase tracking-wider text-blue-700">
              SALDO KAS & BANK
              <br />
              SHARING
            </span>

            <Wallet className="h-4 w-4 text-blue-600" />
          </div>

          <div className="text-xl font-black text-blue-950 font-mono tracking-tight">
            {formatRupiah(
              saldoSharing
            )}
          </div>

          <div className="mt-1 text-[11px] text-blue-700">
            Uang Masuk − Uang Keluar
          </div>
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
            {formatRupiah(
              totalHakInvestor
            )}
          </div>

          <div className="mt-1 text-[11px] text-purple-700 font-bold">
            Sudah Dibayar:{' '}
            {formatRupiah(
              totalSudahDibayar
            )}
          </div>
        </div>
      </div>

      {/* ======================================================
          KOMISI REAL WARNING
          ====================================================== */}

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">

        <div className="flex items-start gap-3">

          <Landmark className="h-5 w-5 text-amber-700 mt-0.5 shrink-0" />

          <div>

            <div className="text-xs font-black uppercase tracking-wider text-amber-900">
              Komisi Real Bukan Saldo Bank
            </div>

            <p className="text-xs text-amber-800 mt-1 font-medium">
              Komisi Real TikTok hanya merupakan
              data performa akun. Nilai tersebut
              baru masuk ke Kas & Bank setelah
              dilakukan Pindah Dana.
            </p>

            {totalKomisiRealExcluded > 0 && (
              <div className="mt-2 text-[10px] font-bold text-amber-700">
                Data Komisi Real lama yang
                ditemukan dan dikecualikan dari
                Kas & Bank:{' '}
                {formatRupiah(
                  totalKomisiRealExcluded
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================
          INVESTOR PAYMENT STATUS
          ====================================================== */}

      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">

        <div>

          <div className="font-black text-amber-900 uppercase tracking-wider">
            Sisa Kewajiban Pembayaran Bagi
            Hasil Investor
          </div>

          <div className="text-amber-700 font-medium mt-0.5">
            Akumulasi settlement yang belum
            dibayar ke investor
          </div>
        </div>

        <div className="text-xl font-black font-mono text-amber-950 whitespace-nowrap">
          {formatRupiah(
            totalBelumDibayar
          )}
        </div>
      </div>

      {/* ======================================================
          PAYMENT COVERAGE
          ====================================================== */}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">

        <div className="flex items-center justify-between mb-3">

          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              Posisi Kas terhadap Hak Investor
            </h3>

            <p className="text-[11px] text-slate-500 mt-0.5">
              Informasi indikator, bukan transaksi
              pembayaran otomatis.
            </p>
          </div>

          <span className="text-sm font-black font-mono text-indigo-700">
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

        <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">

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

      {/* ======================================================
          SETTLEMENT TABLE
          ====================================================== */}

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">

        <div className="p-4 border-b border-slate-100 flex items-center justify-between">

          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              Rekapitulasi Hak Bagi Hasil
              Investor Per Periode
            </h3>

            <p className="text-[10px] text-slate-500 mt-0.5">
              {sharingSettlements.length}{' '}
              settlement
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">

          <table className="w-full text-left text-xs border-collapse">

            <thead>

              <tr className="border-b border-slate-200 bg-slate-50 font-black text-slate-700 uppercase tracking-wider">

                <th className="py-3 px-4">
                  Periode
                </th>

                <th className="py-3 px-4">
                  Tier
                </th>

                <th className="py-3 px-4 text-right">
                  Kas & Bank Masuk
                </th>

                <th className="py-3 px-4 text-right">
                  Hak Investor
                </th>

                <th className="py-3 px-4 text-right">
                  Sudah Dibayar
                </th>

                <th className="py-3 px-4 text-right">
                  Sisa
                </th>

                <th className="py-3 px-4 text-center">
                  Status
                </th>

                <th className="py-3 px-4 text-center">
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
                      className="hover:bg-slate-50 transition-colors"
                    >

                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {
                          settlement.period
                        }
                      </td>

                      <td className="py-3 px-4">

                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-black bg-purple-100 text-purple-800">
                          {
                            settlement.tierName ||
                            `Tier ${settlement.tier}`
                          }
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-emerald-700 font-bold">
                        {formatRupiah(
                          settlement.totalUangMasuk ||
                            0
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-black text-purple-800">
                        {formatRupiah(
                          hak
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-emerald-700 font-bold">
                        {formatRupiah(
                          paid
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-amber-700 font-bold">
                        {formatRupiah(
                          remaining
                        )}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">

                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black ${
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

                      <td className="py-3 px-4 text-center whitespace-nowrap font-mono text-[10px] text-slate-500">
                        {
                          settlement.settledDate ||
                          settlement.paidDate ||
                          '-'
                        }
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
                    className="py-12 text-center text-xs text-slate-400 italic"
                  >
                    Belum ada data bagi hasil
                    investor pada periode ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================
          ACCOUNTING NOTE
          ====================================================== */}

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">

        <div className="text-[10px] font-black uppercase tracking-wider text-slate-700">
          Prinsip Laporan Investor
        </div>

        <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-slate-600">

          <div className="rounded-xl bg-white border border-slate-200 p-3">
            <div className="font-black text-purple-800">
              1. Performa Akun
            </div>

            <div className="mt-1">
              GMV dan Komisi Real adalah
              performa dan bukan saldo rekening.
            </div>
          </div>

          <div className="rounded-xl bg-white border border-slate-200 p-3">
            <div className="font-black text-emerald-800">
              2. Kas & Bank
            </div>

            <div className="mt-1">
              Hanya uang yang benar-benar masuk
              atau keluar yang mempengaruhi saldo.
            </div>
          </div>

          <div className="rounded-xl bg-white border border-slate-200 p-3">
            <div className="font-black text-indigo-800">
              3. Pindah Dana
            </div>

            <div className="mt-1">
              Komisi Real menjadi Kas & Bank
              setelah pencairan, menggunakan
              dana bersih setelah admin.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
