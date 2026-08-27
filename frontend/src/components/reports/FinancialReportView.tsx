import React from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Wallet,
  PieChart,
  Download,
  FileSpreadsheet,
  Calendar,
} from 'lucide-react';
import {
  Transaction,
  UserProfile,
  ReportScopeFilter,
} from '../../types';
import {
  formatRupiah,
  formatTanggal,
} from '../../utils/formatters';
import { exportReportData } from '../../services/exportService';

interface FinancialReportViewProps {
  transactions: Transaction[];
  userProfile: UserProfile;
  scope: ReportScopeFilter;
  dateRange: string;
}

const isKomisiRealSource = (tx: Transaction) => {
  const source = String(tx.sourceType || '').toUpperCase();

  return (
    source === 'COMMISSION_REAL' ||
    source === 'TIKTOK_COMMISSION' ||
    source === 'TIKTOK COMMISSION'
  );
};

const isFundTransfer = (tx: Transaction) => {
  const source = String(tx.sourceType || '').toUpperCase();

  return (
    source === 'FUND_TRANSFER' ||
    source === 'TRANSFER'
  );
};

export const FinancialReportView: React.FC<
  FinancialReportViewProps
> = ({
  transactions,
  userProfile,
  scope,
  dateRange,
}) => {
  /*
   * ============================================================
   * PEMISAHAN 2 DUNIA KEUANGAN
   *
   * 1. KOMISI REAL
   *    = performa akun TikTok
   *    = BUKAN uang yang sudah ada di bank
   *
   * 2. KAS & BANK
   *    = uang aktual yang sudah masuk/keluar rekening
   *
   * Komisi Real baru menjadi Cash In ketika dilakukan
   * Pindah Dana. Pindah Dana menggunakan netAmount.
   * ============================================================
   */

  let uangMasuk = 0;
  let uangKeluar = 0;

  let countIncome = 0;
  let countExpense = 0;

  let totalKomisiReal = 0;
  let countKomisiReal = 0;

  const sourceTypeMap: Record<
    string,
    { total: number; count: number }
  > = {};

  const dailyMap: Record<
    string,
    { masuk: number; keluar: number }
  > = {};

  /*
   * ============================================================
   * HITUNG TRANSAKSI
   * ============================================================
   */
  transactions.forEach((tx) => {
    const amount = Number(tx.amount) || 0;

    /*
     * KOMISI REAL TIDAK BOLEH MASUK CASHFLOW BANK
     */
    if (isKomisiRealSource(tx)) {
      totalKomisiReal += amount;
      countKomisiReal += 1;
      return;
    }

    /*
     * PINDAH DANA
     *
     * Pindah Dana adalah uang yang benar-benar masuk bank.
     * Yang masuk bank adalah netAmount setelah admin TikTok.
     */
    if (isFundTransfer(tx)) {
      if (tx.type === 'INCOME') {
        const netAmount =
          Number(tx.netAmount ?? amount) || 0;

        uangMasuk += netAmount;
        countIncome += 1;

        const source = 'PINDAH DANA';

        if (!sourceTypeMap[source]) {
          sourceTypeMap[source] = {
            total: 0,
            count: 0,
          };
        }

        sourceTypeMap[source].total += netAmount;
        sourceTypeMap[source].count += 1;

        if (tx.date) {
          if (!dailyMap[tx.date]) {
            dailyMap[tx.date] = {
              masuk: 0,
              keluar: 0,
            };
          }

          dailyMap[tx.date].masuk += netAmount;
        }
      }

      return;
    }

    /*
     * UANG MASUK NORMAL
     */
    if (tx.type === 'INCOME') {
      uangMasuk += amount;
      countIncome += 1;

      const source =
        tx.sourceType || 'LAINNYA';

      if (!sourceTypeMap[source]) {
        sourceTypeMap[source] = {
          total: 0,
          count: 0,
        };
      }

      sourceTypeMap[source].total += amount;
      sourceTypeMap[source].count += 1;
    }

    /*
     * UANG KELUAR
     */
    if (tx.type === 'EXPENSE') {
      uangKeluar += amount;
      countExpense += 1;
    }

    /*
     * DAILY CASHFLOW
     */
    if (tx.date) {
      if (!dailyMap[tx.date]) {
        dailyMap[tx.date] = {
          masuk: 0,
          keluar: 0,
        };
      }

      if (tx.type === 'INCOME') {
        dailyMap[tx.date].masuk += amount;
      }

      if (tx.type === 'EXPENSE') {
        dailyMap[tx.date].keluar += amount;
      }
    }
  });

  const saldoBersih =
    uangMasuk - uangKeluar;

  /*
   * ============================================================
   * SOURCE BREAKDOWN
   * ============================================================
   */
  const sourceTypeBreakdown = Object.entries(
    sourceTypeMap
  )
    .map(([sourceType, data]) => ({
      sourceType,
      total: data.total,
      count: data.count,
      percentage:
        uangMasuk > 0
          ? (data.total / uangMasuk) * 100
          : 0,
    }))
    .sort(
      (a, b) => b.total - a.total
    );

  /*
   * ============================================================
   * DAILY TREND
   * ============================================================
   */
  const dailyTrend = Object.entries(
    dailyMap
  )
    .sort(([dateA], [dateB]) =>
      dateB.localeCompare(dateA)
    )
    .slice(0, 15);

  /*
   * ============================================================
   * EXPORT
   * ============================================================
   */
  const handleExport = (
    format: 'CSV' | 'XLSX'
  ) => {
    const exportData = transactions
      .filter(
        (tx) => !isKomisiRealSource(tx)
      )
      .map((tx) => {
        const isTransfer =
          isFundTransfer(tx);

        const actualAmount =
          isTransfer &&
          tx.type === 'INCOME'
            ? Number(
                tx.netAmount ??
                  tx.amount ??
                  0
              )
            : Number(tx.amount) || 0;

        return {
          Tanggal: tx.date,
          Tipe:
            tx.type === 'INCOME'
              ? 'UANG MASUK'
              : 'UANG KELUAR',
          Scope: tx.scope,
          Kategori:
            tx.category || '-',
          'Sumber Pendapatan':
            isTransfer
              ? 'PINDAH DANA'
              : tx.sourceType || '-',
          Deskripsi:
            tx.description,
          Nominal: actualAmount,
          'Komisi Real Bruto':
            isTransfer
              ? Number(
                  tx.amount || 0
                )
              : 0,
          'Admin TikTok':
            isTransfer
              ? Number(
                  tx.adminFee || 0
                )
              : 0,
          'Dana Bersih':
            isTransfer
              ? Number(
                  tx.netAmount ??
                    tx.amount ??
                    0
                )
              : actualAmount,
          Pencatat:
            tx.createdByName || '-',
        };
      });

    exportReportData({
      filenamePrefix:
        'laporan_keuangan',
      sheetName:
        'Ringkasan Keuangan',
      category: 'KEUANGAN',
      scope,
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">

        <div>
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-emerald-600" />
            <span>
              RINGKASAN LAPORAN KEUANGAN
            </span>
          </h2>

          <p className="text-xs text-slate-500 font-medium">
            Kas & Bank dipisahkan dari
            Performa Akun dan Komisi Real
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
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>
              Export Excel (.xlsx)
            </span>
          </button>
        </div>
      </div>

      {/* ======================================================
          CASH & BANK KPI
          ====================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* UANG MASUK */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-2xs">

          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">
              TOTAL UANG MASUK
              <br />
              KAS & BANK
            </span>

            <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
              <ArrowDownRight className="h-5 w-5" />
            </div>
          </div>

          <div className="text-2xl font-black text-emerald-950 font-mono tracking-tight">
            {formatRupiah(
              uangMasuk
            )}
          </div>

          <div className="mt-2 flex items-center justify-between text-xs text-emerald-700 font-medium">
            <span>
              {countIncome}{' '}
              Transaksi
            </span>

            <span className="font-bold">
              CASH IN AKTUAL
            </span>
          </div>
        </div>

        {/* UANG KELUAR */}
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5 shadow-2xs">

          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-rose-700">
              TOTAL UANG KELUAR
              <br />
              KAS & BANK
            </span>

            <div className="rounded-xl bg-rose-100 p-2 text-rose-700">
              <ArrowUpRight className="h-5 w-5" />
            </div>
          </div>

          <div className="text-2xl font-black text-rose-950 font-mono tracking-tight">
            {formatRupiah(
              uangKeluar
            )}
          </div>

          <div className="mt-2 flex items-center justify-between text-xs text-rose-700 font-medium">
            <span>
              {countExpense}{' '}
              Transaksi
            </span>

            <span className="font-bold">
              {uangMasuk > 0
                ? (
                    (uangKeluar /
                      uangMasuk) *
                    100
                  ).toFixed(1)
                : '0'}
              % dari Masuk
            </span>
          </div>
        </div>

        {/* SALDO */}
        <div
          className={`rounded-2xl border p-5 shadow-2xs ${
            saldoBersih >= 0
              ? 'border-indigo-200 bg-indigo-50/70'
              : 'border-amber-200 bg-amber-50/70'
          }`}
        >

          <div className="flex items-center justify-between mb-2">

            <span
              className={`text-[11px] font-black uppercase tracking-wider ${
                saldoBersih >= 0
                  ? 'text-indigo-700'
                  : 'text-amber-700'
              }`}
            >
              SALDO KAS & BANK
            </span>

            <div
              className={`rounded-xl p-2 ${
                saldoBersih >= 0
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              <Wallet className="h-5 w-5" />
            </div>
          </div>

          <div
            className={`text-2xl font-black font-mono tracking-tight ${
              saldoBersih >= 0
                ? 'text-indigo-950'
                : 'text-amber-950'
            }`}
          >
            {formatRupiah(
              saldoBersih
            )}
          </div>

          <div
            className={`mt-2 flex items-center justify-between text-xs font-bold ${
              saldoBersih >= 0
                ? 'text-indigo-700'
                : 'text-amber-700'
            }`}
          >
            <span>
              Masuk - Keluar
            </span>

            <span>
              {saldoBersih >= 0
                ? 'Surplus Kas'
                : 'Defisit Kas'}
            </span>
          </div>
        </div>
      </div>

      {/* ======================================================
          KOMISI REAL SEPARATE
          ====================================================== */}
      <div className="rounded-2xl border border-purple-200 bg-purple-50/60 p-5 shadow-2xs">

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

          <div>
            <div className="text-[11px] font-black uppercase tracking-wider text-purple-700">
              KOMISI REAL TIKTOK
            </div>

            <div className="text-2xl font-black font-mono text-purple-950 mt-1">
              {formatRupiah(
                totalKomisiReal
              )}
            </div>

            <p className="text-xs text-purple-700 font-medium mt-1">
              Data performa akun. Belum
              dianggap uang bank sampai
              dilakukan Pindah Dana.
            </p>
          </div>

          <div className="rounded-xl border border-purple-200 bg-white px-4 py-3 text-right">
            <div className="text-[10px] font-bold uppercase text-purple-500">
              DATA PERFORMA
            </div>

            <div className="text-sm font-black text-purple-900">
              {countKomisiReal}{' '}
              Catatan
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================
          BREAKDOWN & DAILY
          ====================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* BREAKDOWN */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">

          <div className="flex items-center justify-between border-b border-slate-100 pb-3">

            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <PieChart className="h-4 w-4 text-emerald-600" />
              <span>
                Breakdown Kas & Bank
              </span>
            </h3>

            <span className="text-xs font-bold text-slate-500">
              {countIncome}{' '}
              Transaksi
            </span>
          </div>

          <div className="space-y-3">

            {sourceTypeBreakdown.map(
              (item) => (
                <div
                  key={
                    item.sourceType
                  }
                  className="space-y-1"
                >

                  <div className="flex items-center justify-between text-xs">

                    <div className="flex items-center gap-2">

                      <span className="font-bold text-slate-800">
                        {
                          item.sourceType
                        }
                      </span>

                      <span className="text-[10px] text-slate-400 font-mono">
                        (
                        {
                          item.count
                        }
                        x)
                      </span>
                    </div>

                    <div className="flex items-center gap-3">

                      <span className="font-bold text-slate-900 font-mono">
                        {formatRupiah(
                          item.total
                        )}
                      </span>

                      <span className="font-black text-emerald-700 text-[11px] w-12 text-right">
                        {item.percentage.toFixed(
                          1
                        )}
                        %
                      </span>
                    </div>
                  </div>

                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          item.percentage
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )
            )}

            {sourceTypeBreakdown.length ===
              0 && (
              <div className="py-8 text-center text-xs text-slate-400 italic">
                Belum ada transaksi
                Kas & Bank pada
                periode ini.
              </div>
            )}
          </div>
        </div>

        {/* DAILY CASHFLOW */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">

          <div className="flex items-center justify-between border-b border-slate-100 pb-3">

            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="h-4 w-4 text-indigo-600" />
              <span>
                Aktivitas Kas Harian
              </span>
            </h3>

            <span className="text-xs font-bold text-slate-500">
              {dailyTrend.length}{' '}
              Hari Aktif
            </span>
          </div>

          <div className="overflow-y-auto max-h-[320px] space-y-2 pr-1">

            {dailyTrend.map(
              ([date, daily]) => {
                const net =
                  daily.masuk -
                  daily.keluar;

                return (
                  <div
                    key={date}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900">
                        {formatTanggal(
                          date
                        )}
                      </div>

                      <div className="text-[10px] text-slate-400 font-mono">
                        {date}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-right">

                      <div>
                        <div className="text-emerald-700 font-bold font-mono">
                          +
                          {formatRupiah(
                            daily.masuk
                          )}
                        </div>

                        <div className="text-rose-600 text-[11px] font-mono">
                          -
                          {formatRupiah(
                            daily.keluar
                          )}
                        </div>
                      </div>

                      <div
                        className={`font-black font-mono w-24 text-right ${
                          net >= 0
                            ? 'text-indigo-800'
                            : 'text-amber-800'
                        }`}
                      >
                        {formatRupiah(
                          net
                        )}
                      </div>
                    </div>
                  </div>
                );
              }
            )}

            {dailyTrend.length ===
              0 && (
              <div className="py-8 text-center text-xs text-slate-400 italic">
                Belum ada aktivitas
                kas harian.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================
          DETAIL TRANSAKSI
          ====================================================== */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">

        <div className="p-4 border-b border-slate-100 flex items-center justify-between">

          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
            Rincian Buku Kas
            Transaksi (
            {
              transactions.filter(
                (tx) =>
                  !isKomisiRealSource(
                    tx
                  )
              ).length
            })
          </h3>

          <span className="text-xs font-medium text-slate-500">
            Komisi Real tidak
            ditampilkan sebagai Kas
            & Bank
          </span>
        </div>

        <div className="overflow-x-auto">

          <table className="w-full text-left text-xs border-collapse">

            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-black text-slate-700 uppercase tracking-wider">

                <th className="py-3 px-4">
                  Tanggal
                </th>

                <th className="py-3 px-4">
                  Tipe
                </th>

                <th className="py-3 px-4">
                  Scope
                </th>

                <th className="py-3 px-4">
                  Sumber /
                  Kategori
                </th>

                <th className="py-3 px-4">
                  Deskripsi
                </th>

                <th className="py-3 px-4 text-right">
                  Nominal
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">

              {transactions
                .filter(
                  (tx) =>
                    !isKomisiRealSource(
                      tx
                    )
                )
                .map((tx) => {

                  const transfer =
                    isFundTransfer(
                      tx
                    );

                  const actualAmount =
                    transfer &&
                    tx.type ===
                      'INCOME'
                      ? Number(
                          tx.netAmount ??
                            tx.amount ??
                            0
                        )
                      : Number(
                          tx.amount
                        ) || 0;

                  return (
                    <tr
                      key={
                        tx.id ||
                        tx.transactionId
                      }
                      className="hover:bg-slate-50 transition-colors"
                    >

                      <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-800">
                        {formatTanggal(
                          tx.date
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">

                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                            tx.type ===
                            'INCOME'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {tx.type ===
                          'INCOME'
                            ? 'UANG MASUK'
                            : 'UANG KELUAR'}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">

                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black ${
                            tx.scope ===
                            'SHARING'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {tx.scope}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">

                        <span className="font-bold text-slate-800">
                          {transfer
                            ? 'PINDAH DANA'
                            : tx.type ===
                              'INCOME'
                            ? tx.sourceType ||
                              'LAINNYA'
                            : tx.category ||
                              'OPERASIONAL'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-700">

                        <div className="font-medium line-clamp-1">
                          {
                            tx.description
                          }
                        </div>

                        {transfer && (
                          <div className="text-[10px] text-indigo-500 font-semibold">
                            Bruto:{' '}
                            {formatRupiah(
                              Number(
                                tx.amount ||
                                  0
                              )
                            )}{' '}
                            • Admin:{' '}
                            {formatRupiah(
                              Number(
                                tx.adminFee ||
                                  0
                              )
                            )}
                          </div>
                        )}

                        {tx.createdByName && (
                          <div className="text-[10px] text-slate-400">
                            Oleh:{' '}
                            {
                              tx.createdByName
                            }
                          </div>
                        )}
                      </td>

                      <td
                        className={`py-3 px-4 text-right whitespace-nowrap font-mono font-black ${
                          tx.type ===
                          'INCOME'
                            ? 'text-emerald-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {tx.type ===
                        'INCOME'
                          ? '+'
                          : '-'}
                        {formatRupiah(
                          actualAmount
                        )}
                      </td>
                    </tr>
                  );
                })}

              {transactions.filter(
                (tx) =>
                  !isKomisiRealSource(
                    tx
                  )
              ).length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="py-12 text-center text-xs text-slate-400 italic"
                  >
                    Tidak ada transaksi
                    Kas & Bank yang
                    sesuai dengan
                    filter.
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
