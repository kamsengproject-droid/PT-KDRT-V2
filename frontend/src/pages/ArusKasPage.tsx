import React, { useState, useEffect } from 'react';
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
  const {
    userProfile,
    role,
    currentUser,
  } = useAuth();

  const [selectedMonth, setSelectedMonth] =
    useState<string>(bulanHariIni());

  const [searchQuery, setSearchQuery] =
    useState<string>('');

  const [transactions, setTransactions] =
    useState<FinancialTransaction[]>([]);

  const [loading, setLoading] =
    useState<boolean>(true);

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] =
    useState<boolean>(false);

  const [selectedTxForDelete, setSelectedTxForDelete] =
    useState<FinancialTransaction | null>(null);

  const [deleteReason, setDeleteReason] =
    useState<string>('');

  const [submitting, setSubmitting] =
    useState<boolean>(false);

  // Detail modal
  const [showDetailModal, setShowDetailModal] =
    useState<boolean>(false);

  const [selectedTxDetail, setSelectedTxDetail] =
    useState<FinancialTransaction | null>(null);

  /* ============================================================
     LOAD TRANSACTIONS
  ============================================================ */

  useEffect(() => {
    setLoading(true);

    const startDate = `${selectedMonth}-01`;

    const [year, month] =
      selectedMonth
        .split('-')
        .map(Number);

    const lastDay =
      new Date(
        year,
        month,
        0
      ).getDate();

    const endDate =
      `${selectedMonth}-${lastDay}`;

    const unsub =
      subscribeTransactions(
        {
          startDate,
          endDate,
        },
        (data) => {
          /*
           * Hanya transaksi aktif yang dihitung.
           */
          const activeTransactions =
            data.filter(
              (tx) =>
                tx.status !== 'VOID'
            );

          /*
           * KOMISI REAL BUKAN KAS BANK.
           *
           * Historical transaction lama dengan:
           *
           * COMMISSION_REAL
           * TIKTOK_COMMISSION
           *
           * tidak boleh dihitung sebagai uang bank.
           *
           * Data performa Komisi Real tetap berada
           * di dailyPerformance.
           */
          const bankTransactions =
            activeTransactions.filter(
              (tx) => {
                if (
                  tx.sourceType ===
                    'COMMISSION_REAL' ||
                  tx.sourceType ===
                    'TIKTOK_COMMISSION'
                ) {
                  return false;
                }

                return true;
              }
            );

          setTransactions(
            bankTransactions
          );

          setLoading(false);
        }
      );

    return () => unsub();
  }, [selectedMonth]);

  /* ============================================================
     DELETE
  ============================================================ */

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

  const handleConfirmDelete =
    async () => {
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
        /*
         * Historical Commission Real
         * tetap dapat dihapus secara atomic.
         */
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

  /* ============================================================
     RENDER CASHFLOW SECTION
  ============================================================ */

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
      transactions.filter(
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

    /* ==========================================================
       CASHFLOW CALCULATION

       INCOME:
       amount

       TRANSFER:
       netAmount

       EXPENSE:
       amount
    ========================================================== */

    let totalIncome = 0;
    let totalExpense = 0;

    filtered.forEach((tx) => {
      if (
        tx.type === 'INCOME'
      ) {
        totalIncome +=
          Number(
            tx.amount || 0
          );
      }

      if (
        tx.type === 'TRANSFER'
      ) {
        totalIncome +=
          Number(
            tx.netAmount ??
              tx.amount ??
              0
          );
      }

      if (
        tx.type === 'EXPENSE'
      ) {
        totalExpense +=
          Number(
            tx.amount || 0
          );
      }
    });

    return (
      <div className="mb-10">

        {/* SECTION HEADER */}

        <div className="mb-4 flex items-center gap-2 border-b border-zinc-200 pb-2">
          {icon}

          <h2
            className={`text-lg font-black tracking-tight ${themeClass}`}
          >
            {title}
          </h2>
        </div>

        {/* SUMMARY */}

        <div className="mb-6 grid grid-cols-2 gap-4">

          {/* UANG MASUK */}

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <span className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase text-emerald-600">
              <Plus className="h-4 w-4" />

              UANG MASUK (
              {formatBulanTahun(
                selectedMonth
              )}
              )
            </span>

            <span className="text-2xl font-black text-emerald-900">
              {formatRupiah(
                totalIncome
              )}
            </span>
          </div>

          {/* UANG KELUAR */}

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <span className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase text-rose-600">
              <Minus className="h-4 w-4" />

              UANG KELUAR (
              {formatBulanTahun(
                selectedMonth
              )}
              )
            </span>

            <span className="text-2xl font-black text-rose-900">
              {formatRupiah(
                totalExpense
              )}
            </span>
          </div>
        </div>

        {/* TRANSACTION TABLE */}

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

                  filtered.map(
                    (tx) => {

                      const incomeAmount =
                        tx.type ===
                        'INCOME'
                          ? Number(
                              tx.amount ||
                                0
                            )
                          : tx.type ===
                              'TRANSFER'
                            ? Number(
                                tx.netAmount ??
                                  tx.amount ??
                                  0
                              )
                            : 0;

                      const expenseAmount =
                        tx.type ===
                        'EXPENSE'
                          ? Number(
                              tx.amount ||
                                0
                            )
                          : 0;

                      return (
                        <tr
                          key={tx.id}
                          className="hover:bg-zinc-50"
                        >

                          {/* DATE */}

                          <td className="whitespace-nowrap px-5 py-3.5 font-medium text-zinc-900">
                            {formatTanggal(
                              tx.date
                            )}
                          </td>

                          {/* CATEGORY */}

                          <td className="px-5 py-3.5 font-bold text-zinc-700">

                            {tx.category}

                            {tx.type ===
                              'TRANSFER' && (
                              <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] text-indigo-700">
                                PINDAH DANA
                              </span>
                            )}

                          </td>

                          {/* DESCRIPTION */}

                          <td
                            className="max-w-[260px] truncate px-5 py-3.5 text-zinc-500"
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

                          {/* UANG MASUK */}

                          <td className="px-5 py-3.5 font-black text-emerald-600">

                            {incomeAmount >
                            0
                              ? formatRupiah(
                                  incomeAmount
                                )
                              : '-'}

                          </td>

                          {/* UANG KELUAR */}

                          <td className="px-5 py-3.5 font-black text-rose-600">

                            {expenseAmount >
                            0
                              ? formatRupiah(
                                  expenseAmount
                                )
                              : '-'}

                          </td>

                          {/* ACTION */}

                          <td className="px-5 py-3.5 text-center">

                            <div className="flex items-center justify-center gap-2">

                              {/* DETAIL */}

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

                              {/* DELETE */}

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
                    }
                  )
                )}

              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  /* ============================================================
     PAGE
  ============================================================ */

  return (
    <div className="mx-auto max-w-6xl space-y-6">

      {/* SEARCH + PERIOD */}

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

      {/* SHARING */}

      {renderSection(
        'SHARING',
        'ARUS KAS SHARING',
        <Sparkles className="h-6 w-6 text-indigo-600" />,
        'text-indigo-900'
      )}

      {/* PRIBADI */}

      {role ===
        'OWNER' &&
        renderSection(
          'PRIBADI',
          'ARUS KAS PRIBADI',
          <Building className="h-6 w-6 text-rose-600" />,
          'text-rose-900'
        )}

      {/* INVESTOR */}

      {role ===
        'INVESTOR' && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-100 p-6 text-center">

          <Lock className="mx-auto mb-2 h-8 w-8 text-zinc-400" />

          <p className="text-xs font-bold text-zinc-500">
            Arus Kas Pribadi tidak
            ditampilkan untuk Investor.
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
                  Peringatan: Data akan
                  dihapus secara permanen
                  dari kas operasional.
                  Audit log akan mencatat
                  aksi ini.
                </p>

                <div className="rounded-lg border border-rose-100 bg-white p-2 text-[11px]">

                  <strong>
                    Tx ID:
                  </strong>{' '}
                  {
                    selectedTxForDelete.id
                  }

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
                  value={
                    deleteReason
                  }
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

                {/* CATEGORY */}

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

                {/* TRANSFER */}

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

                {/* DATE */}

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

                {/* NOMINAL */}

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

                {/* ACCOUNT */}

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

                {/* DESCRIPTION */}

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

                {/* META */}

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
