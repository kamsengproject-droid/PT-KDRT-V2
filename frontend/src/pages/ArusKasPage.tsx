import React, { useEffect, useMemo, useState } from 'react';
import {
  Wallet,
  Plus,
  Minus,
  Search,
  FileText,
  Trash2,
  Lock,
  Building,
  Sparkles,
  ArrowRightLeft,
  Landmark,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { FinancialTransaction, ScopeType } from '../types';

import {
  subscribeTransactions,
  deleteTransaction,
} from '../services/transactionService';

import { deleteKomisiRealAtomic } from '../services/performanceService';

import {
  formatRupiah,
  formatTanggal,
  bulanHariIni,
  formatBulanTahun,
} from '../utils/formatters';

export const ArusKasPage: React.FC = () => {
  const { userProfile, role, currentUser } = useAuth();

  const [selectedMonth, setSelectedMonth] = useState<string>(
    bulanHariIni()
  );

  const [searchQuery, setSearchQuery] = useState<string>('');

  const [transactions, setTransactions] = useState<
    FinancialTransaction[]
  >([]);

  const [loading, setLoading] = useState<boolean>(true);

  const [showDeleteModal, setShowDeleteModal] =
    useState<boolean>(false);

  const [selectedTxForDelete, setSelectedTxForDelete] =
    useState<FinancialTransaction | null>(null);

  const [deleteReason, setDeleteReason] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);

  const [showDetailModal, setShowDetailModal] =
    useState<boolean>(false);

  const [selectedTxDetail, setSelectedTxDetail] =
    useState<FinancialTransaction | null>(null);

  /*
   * ============================================================
   * LOAD TRANSACTIONS
   * ============================================================
   *
   * Kita ambil seluruh transaksi sampai akhir bulan yang dipilih.
   *
   * Kenapa tidak hanya bulan yang dipilih?
   *
   * Karena SALDO REKENING adalah saldo kumulatif.
   *
   * Contoh:
   *
   * Saldo awal Januari       Rp10 jt
   * Uang masuk Januari       Rp 5 jt
   * Uang keluar Januari      Rp 2 jt
   * Uang masuk Februari      Rp 3 jt
   *
   * Saldo Februari            Rp16 jt
   *
   * Jadi saldo tidak boleh dihitung
   * hanya dari transaksi Februari.
   */

  useEffect(() => {
    setLoading(true);

    const startDate = '2000-01-01';

    const [year, month] = selectedMonth
      .split('-')
      .map(Number);

    const lastDay = new Date(
      year,
      month,
      0
    ).getDate();

    const endDate = `${selectedMonth}-${lastDay}`;

    const unsub = subscribeTransactions(
      {
        startDate,
        endDate,
      },
      (data) => {
        /*
         * VOID tidak mempengaruhi saldo.
         */
        const activeTransactions = data.filter(
          (tx) => tx.status !== 'VOID'
        );

        /*
         * KOMISI REAL BUKAN UANG BANK.
         *
         * Historical transaction lama dengan sourceType
         * COMMISSION_REAL / TIKTOK_COMMISSION
         * tidak dihitung sebagai cash.
         */
        const bankTransactions =
          activeTransactions.filter((tx) => {
            if (
              tx.sourceType === 'COMMISSION_REAL' ||
              tx.sourceType === 'TIKTOK_COMMISSION'
            ) {
              return false;
            }

            return true;
          });

        setTransactions(bankTransactions);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [selectedMonth]);

  /*
   * ============================================================
   * CASHFLOW HELPERS
   * ============================================================
   */

  const getIncomeAmount = (
    tx: FinancialTransaction
  ) => {
    if (tx.type === 'INCOME') {
      return Number(tx.amount || 0);
    }

    /*
     * Pindah Dana:
     * yang benar-benar masuk rekening adalah netAmount.
     */
    if (tx.type === 'TRANSFER') {
      return Number(
        tx.netAmount ??
          tx.amount ??
          0
      );
    }

    return 0;
  };

  const getExpenseAmount = (
    tx: FinancialTransaction
  ) => {
    if (tx.type === 'EXPENSE') {
      return Number(tx.amount || 0);
    }

    return 0;
  };

  /*
   * ============================================================
   * TOTAL SALDO REKENING
   * ============================================================
   */

  const totalBankIncome = useMemo(() => {
    return transactions.reduce(
      (total, tx) =>
        total + getIncomeAmount(tx),
      0
    );
  }, [transactions]);

  const totalBankExpense = useMemo(() => {
    return transactions.reduce(
      (total, tx) =>
        total + getExpenseAmount(tx),
      0
    );
  }, [transactions]);

  /*
   * Untuk saat ini saldo rekening dihitung dari transaksi
   * yang sudah tersimpan.
   *
   * Saldo Awal nantinya bisa kita integrasikan lebih dalam
   * dengan collection saldo awal jika struktur service-nya
   * sudah siap.
   */
  const totalBankBalance =
    totalBankIncome -
    totalBankExpense;

  /*
   * ============================================================
   * TRANSACTIONS OF SELECTED MONTH
   * ============================================================
   */

  const monthlyTransactions = useMemo(() => {
    return transactions.filter((tx) =>
      String(tx.date || '').startsWith(
        selectedMonth
      )
    );
  }, [
    transactions,
    selectedMonth,
  ]);

  const monthlyIncome = useMemo(() => {
    return monthlyTransactions.reduce(
      (total, tx) =>
        total + getIncomeAmount(tx),
      0
    );
  }, [monthlyTransactions]);

  const monthlyExpense = useMemo(() => {
    return monthlyTransactions.reduce(
      (total, tx) =>
        total + getExpenseAmount(tx),
      0
    );
  }, [monthlyTransactions]);

  /*
   * ============================================================
   * DELETE
   * ============================================================
   */

  const handleDeleteClick = (
    tx: FinancialTransaction
  ) => {
    if (role !== 'OWNER') {
      alert(
        'Hanya Owner yang dapat menghapus transaksi.'
      );

      return;
    }

    setSelectedTxForDelete(tx);
    setDeleteReason('');
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (
      !selectedTxForDelete ||
      !currentUser ||
      !userProfile
    ) {
      return;
    }

    if (!deleteReason.trim()) {
      alert(
        'Alasan penghapusan wajib diisi.'
      );

      return;
    }

    setSubmitting(true);

    try {
      if (
        selectedTxForDelete.sourceType ===
          'COMMISSION_REAL' &&
        selectedTxForDelete.performanceId
      ) {
        await deleteKomisiRealAtomic(
          selectedTxForDelete.performanceId,
          deleteReason,
          currentUser.uid,
          userProfile.name
        );
      } else {
        await deleteTransaction(
          selectedTxForDelete.id!,
          selectedTxForDelete,
          deleteReason,
          currentUser.uid,
          userProfile.name
        );
      }

      setShowDeleteModal(false);
      setSelectedTxForDelete(null);
    } catch (error: any) {
      console.error(error);

      alert(
        error?.message ||
          'Gagal menghapus transaksi.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  /*
   * ============================================================
   * SECTION
   * ============================================================
   */

  const renderSection = (
    scope: ScopeType,
    title: string,
    icon: React.ReactNode,
    themeClass: string
  ) => {
    const normalizedSearch =
      searchQuery
        .trim()
        .toLowerCase();

    const filtered =
      monthlyTransactions.filter(
        (tx) => {
          const matchScope =
            tx.scope === scope;

          const matchSearch =
            normalizedSearch === '' ||
            (tx.description || '')
              .toLowerCase()
              .includes(
                normalizedSearch
              ) ||
            (tx.category || '')
              .toLowerCase()
              .includes(
                normalizedSearch
              ) ||
            (tx.accountName || '')
              .toLowerCase()
              .includes(
                normalizedSearch
              );

          return (
            matchScope &&
            matchSearch
          );
        }
      );

    let totalIncome = 0;
    let totalExpense = 0;

    filtered.forEach((tx) => {
      totalIncome +=
        getIncomeAmount(tx);

      totalExpense +=
        getExpenseAmount(tx);
    });

    return (
      <div className="mb-10">

        {/* HEADER */}

        <div className="mb-4 flex items-center gap-2 border-b border-zinc-200 pb-2">

          {icon}

          <h2
            className={`text-lg font-black tracking-tight ${themeClass}`}
          >
            {title}
          </h2>

        </div>

        {/* SUMMARY */}

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">

            <span className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase text-emerald-700">

              <Plus className="h-4 w-4" />

              UANG MASUK

            </span>

            <span className="text-2xl font-black text-emerald-900">

              {formatRupiah(
                totalIncome
              )}

            </span>

          </div>

          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">

            <span className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase text-rose-700">

              <Minus className="h-4 w-4" />

              UANG KELUAR

            </span>

            <span className="text-2xl font-black text-rose-900">

              {formatRupiah(
                totalExpense
              )}

            </span>

          </div>

          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">

            <span className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase text-indigo-700">

              <Wallet className="h-4 w-4" />

              NET CASHFLOW

            </span>

            <span className="text-2xl font-black text-indigo-900">

              {formatRupiah(
                totalIncome -
                  totalExpense
              )}

            </span>

          </div>

        </div>

        {/* TABLE */}

        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">

          <div className="overflow-x-auto">

            <table className="w-full text-left text-xs text-zinc-600">

              <thead className="border-b border-zinc-200 bg-zinc-50">

                <tr>

                  <th className="px-5 py-3.5 font-extrabold text-zinc-900">
                    Tanggal
                  </th>

                  <th className="px-5 py-3.5 font-extrabold text-zinc-900">
                    Kategori
                  </th>

                  <th className="px-5 py-3.5 font-extrabold text-zinc-900">
                    Keterangan
                  </th>

                  <th className="px-5 py-3.5 font-extrabold text-zinc-900">
                    Masuk
                  </th>

                  <th className="px-5 py-3.5 font-extrabold text-zinc-900">
                    Keluar
                  </th>

                  <th className="px-5 py-3.5 text-center font-extrabold text-zinc-900">
                    Aksi
                  </th>

                </tr>

              </thead>

              <tbody className="divide-y divide-zinc-100">

                {filtered.length === 0 ? (

                  <tr>

                    <td
                      colSpan={6}
                      className="px-5 py-8 text-center font-medium text-zinc-400"
                    >
                      {loading
                        ? 'MEMUAT DATA...'
                        : 'BELUM ADA DATA TRANSAKSI'}
                    </td>

                  </tr>

                ) : (

                  filtered.map((tx) => {

                    const incomeAmount =
                      getIncomeAmount(tx);

                    const expenseAmount =
                      getExpenseAmount(tx);

                    return (
                      <tr
                        key={tx.id}
                        className="hover:bg-zinc-50"
                      >

                        <td className="whitespace-nowrap px-5 py-3.5 font-medium text-zinc-900">

                          {formatTanggal(
                            tx.date
                          )}

                        </td>

                        <td className="px-5 py-3.5 font-bold text-zinc-700">

                          {tx.category}

                          {tx.type ===
                            'TRANSFER' && (
                            <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">

                              PINDAH DANA

                            </span>
                          )}

                        </td>

                        <td
                          className="max-w-[320px] truncate px-5 py-3.5 text-zinc-500"
                          title={
                            tx.description
                          }
                        >

                          {tx.description}

                          {tx.accountName && (
                            <span className="ml-1 font-semibold text-emerald-600">

                              [
                              {
                                tx.accountName
                              }
                              ]

                            </span>
                          )}

                          {tx.type ===
                            'TRANSFER' && (
                            <span className="ml-1 font-semibold text-indigo-600">

                              [
                              {tx.fromAccount ||
                                'Komisi Real TikTok'}

                              {' → '}

                              {tx.toAccount ||
                                '-'}

                              ]

                            </span>
                          )}

                        </td>

                        <td className="px-5 py-3.5 font-black text-emerald-600">

                          {incomeAmount >
                          0
                            ? formatRupiah(
                                incomeAmount
                              )
                            : '-'}

                        </td>

                        <td className="px-5 py-3.5 font-black text-rose-600">

                          {expenseAmount >
                          0
                            ? formatRupiah(
                                expenseAmount
                              )
                            : '-'}

                        </td>

                        <td className="px-5 py-3.5 text-center">

                          <div className="flex items-center justify-center gap-2">

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTxDetail(
                                  tx
                                );

                                setShowDetailModal(
                                  true
                                );
                              }}
                              className="rounded-lg p-1.5 text-indigo-600 transition-colors hover:bg-indigo-50"
                              title="Lihat Detail"
                            >

                              <FileText className="h-4 w-4" />

                            </button>

                            {role ===
                              'OWNER' && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteClick(
                                    tx
                                  )
                                }
                                className="rounded-lg p-1.5 text-rose-600 transition-colors hover:bg-rose-50"
                                title="Hapus Transaksi"
                              >

                                <Trash2 className="h-4 w-4" />

                              </button>
                            )}

                          </div>

                        </td>

                      </tr>
                    );
                  })
                )}

              </tbody>

            </table>

          </div>

        </div>

      </div>
    );
  };

  /*
   * ============================================================
   * PAGE
   * ============================================================
   */

  return (
    <div className="mx-auto max-w-6xl space-y-6">

      {/* ========================================================
          DASHBOARD SALDO BANK
      ======================================================== */}

      <div className="rounded-3xl border border-zinc-200 bg-zinc-900 p-6 text-white shadow-xl">

        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">

          <div>

            <div className="mb-2 flex items-center gap-2">

              <Landmark className="h-5 w-5 text-emerald-400" />

              <span className="text-xs font-black uppercase tracking-wider text-zinc-400">
                KAS & BANK
              </span>

            </div>

            <p className="text-sm font-bold text-zinc-400">
              Total Saldo Rekening
            </p>

            <p className="mt-1 text-3xl font-black tracking-tight md:text-4xl">

              {formatRupiah(
                totalBankBalance
              )}

            </p>

            <p className="mt-2 text-xs text-zinc-500">
              Saldo dihitung dari seluruh transaksi
              bank yang tercatat sampai periode yang dipilih.
            </p>

          </div>

          <div className="grid grid-cols-2 gap-3 md:w-[420px]">

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">

              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase text-emerald-400">

                <Plus className="h-3.5 w-3.5" />

                Total Masuk

              </div>

              <p className="text-lg font-black">

                {formatRupiah(
                  totalBankIncome
                )}

              </p>

            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">

              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase text-rose-400">

                <Minus className="h-3.5 w-3.5" />

                Total Keluar

              </div>

              <p className="text-lg font-black">

                {formatRupiah(
                  totalBankExpense
                )}

              </p>

            </div>

          </div>

        </div>

      </div>

      {/* ========================================================
          SEARCH + PERIOD
      ======================================================== */}

      <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">

        <div className="flex items-center gap-3">

          <div className="relative">

            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />

            <input
              type="text"
              placeholder="Cari transaksi..."
              value={searchQuery}
              onChange={(e) =>
                setSearchQuery(
                  e.target.value
                )
              }
              className="w-full rounded-xl border border-zinc-300 py-2.5 pl-9 pr-4 text-sm font-medium focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:w-64"
            />

          </div>

        </div>

        <div className="flex items-center gap-2">

          <span className="text-xs font-bold uppercase text-zinc-500">
            Periode:
          </span>

          <input
            type="month"
            value={selectedMonth}
            onChange={(e) =>
              setSelectedMonth(
                e.target.value
              )
            }
            className="rounded-xl border border-zinc-300 bg-white p-2.5 text-sm font-bold text-zinc-800"
          />

        </div>

      </div>

      {/* ========================================================
          MONTHLY SUMMARY
      ======================================================== */}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">

          <p className="text-[11px] font-bold uppercase text-zinc-500">
            Uang Masuk {formatBulanTahun(selectedMonth)}
          </p>

          <p className="mt-1 text-2xl font-black text-emerald-700">

            {formatRupiah(
              monthlyIncome
            )}

          </p>

        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">

          <p className="text-[11px] font-bold uppercase text-zinc-500">
            Uang Keluar {formatBulanTahun(selectedMonth)}
          </p>

          <p className="mt-1 text-2xl font-black text-rose-700">

            {formatRupiah(
              monthlyExpense
            )}

          </p>

        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">

          <p className="text-[11px] font-bold uppercase text-zinc-500">
            Net Cashflow {formatBulanTahun(selectedMonth)}
          </p>

          <p
            className={`mt-1 text-2xl font-black ${
              monthlyIncome -
                monthlyExpense >=
              0
                ? 'text-indigo-700'
                : 'text-rose-700'
            }`}
          >

            {formatRupiah(
              monthlyIncome -
                monthlyExpense
            )}

          </p>

        </div>

      </div>

      {/* ========================================================
          SHARING
      ======================================================== */}

      {renderSection(
        'SHARING',
        'ARUS KAS SHARING',
        <Sparkles className="h-6 w-6 text-indigo-600" />,
        'text-indigo-900'
      )}

      {/* ========================================================
          PRIBADI
      ======================================================== */}

      {role === 'OWNER' &&
        renderSection(
          'PRIBADI',
          'ARUS KAS PRIBADI',
          <Building className="h-6 w-6 text-rose-600" />,
          'text-rose-900'
        )}

      {/* INVESTOR */}

      {role === 'INVESTOR' && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-100 p-6 text-center">

          <Lock className="mx-auto mb-2 h-8 w-8 text-zinc-400" />

          <p className="text-xs font-bold text-zinc-500">
            Arus Kas Pribadi tidak ditampilkan
            untuk Investor.
          </p>

        </div>
      )}

      {/* ========================================================
          DELETE MODAL
      ======================================================== */}

      {showDeleteModal &&
        selectedTxForDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">

            <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 text-zinc-800 shadow-2xl">

              <h3 className="mb-4 flex items-center gap-2 text-base font-black text-rose-700">

                <Trash2 className="h-5 w-5" />

                Hapus Transaksi Permanen

              </h3>

              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4">

                <p className="mb-2 text-xs font-bold text-rose-800">

                  Peringatan: Data akan dihapus
                  secara permanen dari kas operasional.
                  Audit log akan mencatat aksi ini.

                </p>

                <div className="rounded-lg border border-rose-100 bg-white p-2 text-[11px]">

                  <strong>
                    Tx ID:
                  </strong>{' '}

                  {selectedTxForDelete.id}

                  <br />

                  <strong>
                    Nominal:
                  </strong>{' '}

                  {formatRupiah(
                    selectedTxForDelete.amount
                  )}

                  <br />

                  <strong>
                    Kategori:
                  </strong>{' '}

                  {
                    selectedTxForDelete.category
                  }

                </div>

              </div>

              <div>

                <label className="mb-1.5 block text-xs font-bold text-zinc-700">

                  Alasan Penghapusan (Wajib)

                </label>

                <textarea
                  rows={3}
                  required
                  value={deleteReason}
                  onChange={(e) =>
                    setDeleteReason(
                      e.target.value
                    )
                  }
                  placeholder="Contoh: Salah ketik nominal, duplikat transaksi, dll..."
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm font-medium"
                />

              </div>

              <div className="mt-4 flex justify-end gap-2 border-t border-zinc-100 pt-4">

                <button
                  type="button"
                  onClick={() =>
                    setShowDeleteModal(
                      false
                    )
                  }
                  className="rounded-xl px-4 py-2 text-xs font-bold text-zinc-500 hover:bg-zinc-100"
                >
                  Batal
                </button>

                <button
                  type="button"
                  disabled={
                    submitting ||
                    !deleteReason.trim()
                  }
                  onClick={
                    handleConfirmDelete
                  }
                  className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-black text-white shadow-md hover:bg-rose-500 disabled:opacity-50"
                >
                  {submitting
                    ? 'MEMPROSES...'
                    : 'HAPUS PERMANEN'}
                </button>

              </div>

            </div>

          </div>
        )}

      {/* ========================================================
          DETAIL MODAL
      ======================================================== */}

      {showDetailModal &&
        selectedTxDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">

            <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl">

              <div className="mb-4 flex items-center justify-between">

                <h3 className="text-lg font-black text-zinc-900">
                  Rincian Transaksi
                </h3>

                <button
                  type="button"
                  onClick={() =>
                    setShowDetailModal(
                      false
                    )
                  }
                  className="text-zinc-400 hover:text-zinc-700"
                >
                  ✕
                </button>

              </div>

              <div className="space-y-3 text-xs">

                <div className="flex justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-3">

                  <span className="font-bold text-zinc-500">
                    Kategori
                  </span>

                  <span className="font-black text-zinc-900">
                    {
                      selectedTxDetail.category
                    }
                  </span>

                </div>

                {selectedTxDetail.type ===
                  'TRANSFER' && (
                  <>
                    <div className="flex justify-between rounded-lg border border-indigo-100 bg-indigo-50 p-3">

                      <span className="font-bold text-indigo-600">
                        Dari
                      </span>

                      <span className="font-black text-indigo-950">
                        {
                          selectedTxDetail.fromAccount ||
                          'Komisi Real TikTok'
                        }
                      </span>

                    </div>

                    <div className="flex justify-between rounded-lg border border-indigo-100 bg-indigo-50 p-3">

                      <span className="font-bold text-indigo-600">
                        Ke
                      </span>

                      <span className="font-black text-indigo-950">
                        {
                          selectedTxDetail.toAccount ||
                          '-'
                        }
                      </span>

                    </div>

                    <div className="flex justify-between rounded-lg border border-emerald-100 bg-emerald-50 p-3">

                      <span className="font-bold text-emerald-700">
                        Dana Bersih Diterima
                      </span>

                      <span className="font-black text-emerald-900">

                        {formatRupiah(
                          Number(
                            selectedTxDetail.netAmount ??
                              selectedTxDetail.amount ??
                              0
                          )
                        )}

                      </span>

                    </div>
                  </>
                )}

                <div className="flex justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-3">

                  <span className="font-bold text-zinc-500">
                    Tanggal
                  </span>

                  <span className="font-black text-zinc-900">

                    {formatTanggal(
                      selectedTxDetail.date
                    )}

                  </span>

                </div>

                <div className="flex justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-3">

                  <span className="font-bold text-zinc-500">
                    Nominal
                  </span>

                  <span
                    className={`text-lg font-black ${
                      selectedTxDetail.type ===
                      'INCOME'
                        ? 'text-emerald-600'
                        : selectedTxDetail.type ===
                            'EXPENSE'
                          ? 'text-rose-600'
                          : 'text-indigo-600'
                    }`}
                  >

                    {selectedTxDetail.type ===
                    'TRANSFER'
                      ? 'Pindah Dana '
                      : selectedTxDetail.type ===
                          'INCOME'
                        ? '+'
                        : '-'}

                    {formatRupiah(
                      Number(
                        selectedTxDetail.type ===
                          'TRANSFER'
                          ? selectedTxDetail.netAmount ??
                              selectedTxDetail.amount ??
                              0
                          : selectedTxDetail.amount ||
                              0
                      )
                    )}

                  </span>

                </div>

                {selectedTxDetail.accountName && (
                  <div className="flex justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-3">

                    <span className="font-bold text-zinc-500">
                      Akun Sumber
                    </span>

                    <span className="font-black text-zinc-900">
                      {
                        selectedTxDetail.accountName
                      }
                    </span>

                  </div>
                )}

                {selectedTxDetail.description && (
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">

                    <span className="mb-1 block font-bold text-zinc-500">
                      Keterangan
                    </span>

                    <span className="font-medium text-zinc-800">
                      {
                        selectedTxDetail.description
                      }
                    </span>

                  </div>
                )}

                <div className="mt-4 text-center text-[10px] text-zinc-400">

                  TxID:
                  {' '}
                  {
                    selectedTxDetail.id
                  }

                  <br />

                  Dicatat oleh:
                  {' '}
                  {
                    selectedTxDetail.createdByName
                  }

                </div>

              </div>

            </div>

          </div>
        )}

    </div>
  );
};
