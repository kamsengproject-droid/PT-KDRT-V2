import React, { useEffect, useMemo, useState } from 'react';
import {
  Scale,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Landmark,
  RefreshCw,
  Lock,
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';

import {
  subscribeReconciliations,
  createReconciliation,
  subscribeTransactions,
} from '../../services/transactionService';

import {
  FinancialReconciliation,
  FinancialTransaction,
  ScopeType,
} from '../../types';

import {
  formatBulanTahun,
  formatRupiah,
  formatTanggal,
  tanggalHariIni,
} from '../../utils/formatters';

type ScopeFilter = ScopeType | 'ALL';

function normalizeAccountName(
  accountName?: string | null
) {
  return (
    accountName?.trim() ||
    'Rekening Belum Ditentukan'
  );
}

function isExcludedFromBank(
  transaction: FinancialTransaction
) {
  return (
    transaction.status === 'VOID' ||
    transaction.sourceType ===
      'COMMISSION_REAL' ||
    transaction.sourceType ===
      'TIKTOK_COMMISSION'
  );
}

function getIncomeAmount(
  transaction: FinancialTransaction
) {
  if (
    transaction.sourceType ===
    'FUND_TRANSFER'
  ) {
    return Number(
      transaction.netAmount || 0
    );
  }

  return Number(
    transaction.amount || 0
  );
}

export const RekonsiliasiKas: React.FC = () => {
  const {
    userProfile,
    role,
    loading: authLoading,
    currentUser,
  } = useAuth();

  const [reconciliations, setReconciliations] =
    useState<FinancialReconciliation[]>([]);

  const [transactions, setTransactions] =
    useState<FinancialTransaction[]>([]);

  const [selectedScope, setSelectedScope] =
    useState<ScopeFilter>('ALL');

  const [selectedAccount, setSelectedAccount] =
    useState('ALL');

  const [reconcileDate, setReconcileDate] =
    useState(tanggalHariIni());

  const [showModal, setShowModal] =
    useState(false);

  const [accountName, setAccountName] =
    useState('');

  const [actualBalanceInput, setActualBalanceInput] =
    useState<number>(0);

  const [notes, setNotes] =
    useState('');

  const [saving, setSaving] =
    useState(false);

  /*
   * ============================================================
   * LOAD DATA
   * ============================================================
   */

  useEffect(() => {
    if (
      authLoading ||
      !currentUser ||
      !userProfile?.active
    ) {
      return;
    }

    const unsubReconciliation =
      subscribeReconciliations(
        setReconciliations
      );

    const unsubTransactions =
      subscribeTransactions(
        undefined,
        setTransactions
      );

    return () => {
      unsubReconciliation();
      unsubTransactions();
    };
  }, [
    authLoading,
    currentUser?.uid,
    userProfile?.active,
  ]);

  /*
   * ============================================================
   * ACTIVE BANK TRANSACTIONS
   * ============================================================
   */

  const bankTransactions =
    useMemo(() => {
      return transactions.filter(
        (transaction) => {
          if (
            isExcludedFromBank(
              transaction
            )
          ) {
            return false;
          }

          if (
            selectedScope !== 'ALL' &&
            transaction.scope !==
              selectedScope
          ) {
            return false;
          }

          if (
            selectedAccount !== 'ALL'
          ) {
            const account =
              normalizeAccountName(
                transaction.accountName ||
                  transaction.toAccount
              );

            if (
              account !==
              selectedAccount
            ) {
              return false;
            }
          }

          return (
            transaction.date <=
            reconcileDate
          );
        }
      );
    }, [
      transactions,
      selectedScope,
      selectedAccount,
      reconcileDate,
    ]);

  /*
   * ============================================================
   * ACCOUNT LIST
   * ============================================================
   */

  const accountNames =
    useMemo(() => {
      const names =
        new Set<string>();

      transactions.forEach(
        (transaction) => {
          if (
            isExcludedFromBank(
              transaction
            )
          ) {
            return;
          }

          const name =
            normalizeAccountName(
              transaction.accountName ||
                transaction.toAccount
            );

          if (
            name !==
            'Rekening Belum Ditentukan'
          ) {
            names.add(name);
          }
        }
      );

      return Array.from(names).sort();
    }, [transactions]);

  /*
   * ============================================================
   * SYSTEM BALANCE
   * ============================================================
   *
   * Saldo sistem:
   *
   * Saldo Awal
   * + Uang Masuk
   * - Uang Keluar
   *
   * Komisi Real TIDAK masuk.
   * Pindah Dana masuk menggunakan NET AMOUNT.
   */

  const openingBalance =
    bankTransactions
      .filter(
        (transaction) =>
          transaction.sourceType ===
          'OPENING_BALANCE'
      )
      .reduce(
        (sum, transaction) =>
          sum +
          Number(
            transaction.amount || 0
          ),
        0
      );

  const totalIncome =
    bankTransactions
      .filter(
        (transaction) =>
          transaction.type ===
            'INCOME' &&
          transaction.sourceType !==
            'OPENING_BALANCE'
      )
      .reduce(
        (sum, transaction) =>
          sum +
          getIncomeAmount(
            transaction
          ),
        0
      );

  const totalExpense =
    bankTransactions
      .filter(
        (transaction) =>
          transaction.type ===
          'EXPENSE'
      )
      .reduce(
        (sum, transaction) =>
          sum +
          Number(
            transaction.amount || 0
          ),
        0
      );

  const systemCalculatedBalance =
    openingBalance +
    totalIncome -
    totalExpense;

  const currentDifference =
    Number(actualBalanceInput || 0) -
    systemCalculatedBalance;

  /*
   * ============================================================
   * PER ACCOUNT BALANCE
   * ============================================================
   */

  const accountBalances =
    useMemo(() => {
      const result: Record<
        string,
        {
          accountName: string;
          scope: ScopeType;
          opening: number;
          income: number;
          expense: number;
          balance: number;
        }
      > = {};

      bankTransactions.forEach(
        (transaction) => {
          const name =
            normalizeAccountName(
              transaction.accountName ||
                transaction.toAccount
            );

          if (
            name ===
            'Rekening Belum Ditentukan'
          ) {
            return;
          }

          if (!result[name]) {
            result[name] = {
              accountName: name,
              scope:
                transaction.scope ===
                'PRIBADI'
                  ? 'PRIBADI'
                  : 'SHARING',
              opening: 0,
              income: 0,
              expense: 0,
              balance: 0,
            };
          }

          if (
            transaction.sourceType ===
            'OPENING_BALANCE'
          ) {
            result[name].opening +=
              Number(
                transaction.amount ||
                  0
              );
          } else if (
            transaction.type ===
            'INCOME'
          ) {
            result[name].income +=
              getIncomeAmount(
                transaction
              );
          } else if (
            transaction.type ===
            'EXPENSE'
          ) {
            result[name].expense +=
              Number(
                transaction.amount ||
                  0
              );
          }
        }
      );

      Object.values(result).forEach(
        (account) => {
          account.balance =
            account.opening +
            account.income -
            account.expense;
        }
      );

      return Object.values(result);
    }, [bankTransactions]);

  /*
   * ============================================================
   * SELECTED ACCOUNT BALANCE
   * ============================================================
   */

  const selectedAccountBalance =
    selectedAccount === 'ALL'
      ? systemCalculatedBalance
      : accountBalances.find(
          (account) =>
            account.accountName ===
            selectedAccount
        )?.balance || 0;

  /*
   * ============================================================
   * OPEN MODAL
   * ============================================================
   */

  const handleOpenModal = () => {
    const defaultAccount =
      selectedAccount !== 'ALL'
        ? selectedAccount
        : accountNames[0] || '';

    setAccountName(
      defaultAccount
    );

    const account =
      accountBalances.find(
        (item) =>
          item.accountName ===
          defaultAccount
      );

    setActualBalanceInput(
      account
        ? account.balance
        : systemCalculatedBalance
    );

    setReconcileDate(
      tanggalHariIni()
    );

    setNotes('');
    setShowModal(true);
  };

  /*
   * ============================================================
   * MODAL SYSTEM BALANCE
   * ============================================================
   */

  const modalSystemBalance =
    useMemo(() => {
      if (!accountName.trim()) {
        return systemCalculatedBalance;
      }

      return (
        accountBalances.find(
          (account) =>
            account.accountName ===
            accountName.trim()
        )?.balance || 0
      );
    }, [
      accountName,
      accountBalances,
      systemCalculatedBalance,
    ]);

  const modalDifference =
    Number(actualBalanceInput || 0) -
    modalSystemBalance;

  /*
   * ============================================================
   * SAVE RECONCILIATION
   * ============================================================
   */

  const handleSave = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (role !== 'OWNER') {
      return;
    }

    if (!currentUser) {
      alert(
        'User belum terdeteksi.'
      );
      return;
    }

    if (
      !accountName.trim()
    ) {
      alert(
        'Nama rekening wajib diisi.'
      );
      return;
    }

    setSaving(true);

    try {
      const uid =
        userProfile?.uid ||
        currentUser.uid;

      const name =
        userProfile?.name ||
        currentUser.displayName ||
        'Owner';

      const difference =
        modalDifference;

      const status =
        difference === 0
          ? 'SEIMBANG'
          : difference > 0
            ? 'SELISIH_LEBIH'
            : 'SELISIH_KURANG';

      await createReconciliation(
        {
          date:
            reconcileDate,

          periodLabel:
            formatBulanTahun(
              reconcileDate.substring(
                0,
                7
              )
            ),

          scope:
            selectedScope === 'ALL'
              ? 'SHARING'
              : selectedScope,

          systemBalance:
            modalSystemBalance,

          actualBalance:
            Number(
              actualBalanceInput
            ) || 0,

          difference,

          accountName:
            accountName.trim(),

          notes:
            notes.trim(),

          status,

          createdBy:
            uid,

          createdByName:
            name,
        },
        uid,
        name
      );

      setShowModal(false);
    } catch (error: any) {
      console.error(
        'Gagal menyimpan rekonsiliasi:',
        error
      );

      alert(
        'Gagal menyimpan rekonsiliasi: ' +
          (
            error?.message ||
            'Unknown error'
          )
      );
    } finally {
      setSaving(false);
    }
  };

  /*
   * ============================================================
   * OWNER ONLY
   * ============================================================
   */

  if (
    role !== 'OWNER'
  ) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white p-12 text-center text-zinc-500">
        <Lock className="mb-3 h-10 w-10 text-zinc-300" />

        <p className="font-bold">
          Rekonsiliasi Kas & Bank hanya
          dapat dilakukan oleh Owner.
        </p>
      </div>
    );
  }

  /*
   * ============================================================
   * RENDER
   * ============================================================
   */

  return (
    <div className="space-y-6">

      {/* HEADER */}

      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">

        <div>

          <div className="flex items-center gap-2">

            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800">

              <Scale className="h-3.5 w-3.5" />

              Rekonsiliasi Kas & Bank

            </span>

          </div>

          <h2 className="mt-2 text-xl font-black tracking-tight text-zinc-900">

            Cocokkan Saldo Sistem dengan Rekening

          </h2>

          <p className="mt-1 max-w-2xl text-xs text-zinc-500">

            Gunakan rekonsiliasi untuk memastikan
            saldo Kas & Bank di sistem sama dengan
            saldo rekening bank sebenarnya.

          </p>

        </div>

        <button
          type="button"
          onClick={handleOpenModal}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-xs font-black text-white shadow-sm hover:bg-zinc-800"
        >

          <Plus className="h-4 w-4" />

          Rekonsiliasi Baru

        </button>

      </div>

      {/* FILTER */}

      <div className="flex flex-wrap gap-2">

        {(
          [
            ['ALL', 'Semua'],
            ['SHARING', 'Sharing'],
            ['PRIBADI', 'Pribadi'],
          ] as const
        ).map(
          ([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() =>
                setSelectedScope(
                  value
                )
              }
              className={`rounded-xl px-4 py-2 text-xs font-black ${
                selectedScope ===
                value
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              {label}
            </button>
          )
        )}

        <select
          value={
            selectedAccount
          }
          onChange={(event) =>
            setSelectedAccount(
              event.target.value
            )
          }
          className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-bold text-zinc-700"
        >

          <option value="ALL">
            Semua Rekening
          </option>

          {accountNames.map(
            (account) => (
              <option
                key={account}
                value={account}
              >
                {account}
              </option>
            )
          )}

        </select>

      </div>

      {/* SUMMARY */}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">

          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
            Saldo Awal
          </span>

          <p className="mt-1 text-xl font-black text-zinc-900">
            {formatRupiah(
              openingBalance
            )}
          </p>

        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">

          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
            Uang Masuk
          </span>

          <p className="mt-1 text-xl font-black text-emerald-800">
            +{' '}
            {formatRupiah(
              totalIncome
            )}
          </p>

        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">

          <span className="text-[10px] font-black uppercase tracking-wider text-rose-700">
            Uang Keluar
          </span>

          <p className="mt-1 text-xl font-black text-rose-800">
            -{' '}
            {formatRupiah(
              totalExpense
            )}
          </p>

        </div>

      </div>

      {/* SYSTEM BALANCE */}

      <div className="rounded-3xl bg-zinc-900 p-6 text-white shadow-lg">

        <div className="flex items-center justify-between gap-4">

          <div>

            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
              Saldo Buku Kas Sistem
            </p>

            <p className="mt-1 text-3xl font-black text-emerald-400">
              {formatRupiah(
                selectedAccountBalance
              )}
            </p>

            <p className="mt-2 text-xs text-zinc-400">

              {selectedAccount ===
              'ALL'
                ? 'Total seluruh rekening'
                : selectedAccount}

            </p>

          </div>

          <Landmark className="h-8 w-8 text-zinc-500" />

        </div>

      </div>

      {/* ACCOUNT BALANCES */}

      <section>

        <div className="mb-3">

          <h3 className="font-black text-zinc-900">
            Saldo Sistem per Rekening
          </h3>

          <p className="text-xs text-zinc-500">
            Rekonsiliasi dilakukan terhadap saldo
            rekening yang benar-benar digunakan.
          </p>

        </div>

        <div className="grid gap-4 md:grid-cols-2">

          {accountBalances.length ===
          0 ? (

            <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-400 md:col-span-2">
              Belum ada transaksi Kas & Bank.
            </div>

          ) : (

            accountBalances
              .filter(
                (account) =>
                  selectedScope ===
                    'ALL' ||
                  account.scope ===
                    selectedScope
              )
              .map(
                (account) => (
                  <div
                    key={
                      account.accountName
                    }
                    className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
                  >

                    <div className="flex items-start justify-between">

                      <div>

                        <div className="flex items-center gap-2">

                          <Building2 className="h-5 w-5 text-indigo-600" />

                          <p className="font-black text-zinc-900">
                            {
                              account.accountName
                            }
                          </p>

                        </div>

                        <span className="mt-2 inline-block rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-black text-zinc-600">
                          {account.scope}
                        </span>

                      </div>

                      <p className="text-lg font-black text-zinc-950">
                        {formatRupiah(
                          account.balance
                        )}
                      </p>

                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-[10px]">

                      <div className="rounded-xl bg-zinc-50 p-3">

                        <p className="font-bold text-zinc-400">
                          Awal
                        </p>

                        <p className="mt-1 font-black">
                          {formatRupiah(
                            account.opening
                          )}
                        </p>

                      </div>

                      <div className="rounded-xl bg-emerald-50 p-3">

                        <p className="font-bold text-emerald-600">
                          Masuk
                        </p>

                        <p className="mt-1 font-black text-emerald-700">
                          {formatRupiah(
                            account.income
                          )}
                        </p>

                      </div>

                      <div className="rounded-xl bg-rose-50 p-3">

                        <p className="font-bold text-rose-600">
                          Keluar
                        </p>

                        <p className="mt-1 font-black text-rose-700">
                          {formatRupiah(
                            account.expense
                          )}
                        </p>

                      </div>

                    </div>

                  </div>
                )
              )

          )}

        </div>

      </section>

      {/* HISTORY */}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">

        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">

          <div>

            <h3 className="text-sm font-black text-zinc-900">
              Riwayat Rekonsiliasi
            </h3>

            <p className="mt-0.5 text-[11px] text-zinc-500">
              Catatan pencocokan saldo oleh Owner.
            </p>

          </div>

          <span className="text-xs font-bold text-zinc-400">
            {reconciliations.length}{' '}
            Rekaman
          </span>

        </div>

        <div className="overflow-x-auto">

          <table className="w-full text-left text-xs">

            <thead className="border-b border-zinc-100 bg-zinc-50 text-[10px] font-black uppercase tracking-wider text-zinc-500">

              <tr>

                <th className="px-6 py-3">
                  Tanggal
                </th>

                <th className="px-4 py-3">
                  Rekening
                </th>

                <th className="px-4 py-3 text-right">
                  Sistem
                </th>

                <th className="px-4 py-3 text-right">
                  Aktual
                </th>

                <th className="px-4 py-3 text-right">
                  Selisih
                </th>

                <th className="px-4 py-3 text-center">
                  Status
                </th>

                <th className="px-6 py-3">
                  Catatan
                </th>

              </tr>

            </thead>

            <tbody className="divide-y divide-zinc-100">

              {reconciliations.length ===
              0 ? (

                <tr>

                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-zinc-400"
                  >
                    Belum ada riwayat rekonsiliasi.
                  </td>

                </tr>

              ) : (

                reconciliations.map(
                  (item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-zinc-50"
                    >

                      <td className="px-6 py-3.5">

                        <p className="font-bold text-zinc-900">
                          {formatTanggal(
                            item.date
                          )}
                        </p>

                        <p className="text-[10px] text-zinc-400">
                          {
                            item.periodLabel
                          }
                        </p>

                      </td>

                      <td className="px-4 py-3.5">

                        <p className="flex items-center gap-1.5 font-bold text-zinc-800">

                          <Building2 className="h-3.5 w-3.5 text-zinc-400" />

                          {
                            item.accountName
                          }

                        </p>

                        <p className="text-[10px] text-zinc-400">
                          {item.scope}
                        </p>

                      </td>

                      <td className="px-4 py-3.5 text-right font-bold">
                        {formatRupiah(
                          item.systemBalance
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right font-black">
                        {formatRupiah(
                          item.actualBalance
                        )}
                      </td>

                      <td
                        className={`px-4 py-3.5 text-right font-black ${
                          item.difference ===
                          0
                            ? 'text-emerald-600'
                            : item.difference >
                                0
                              ? 'text-blue-600'
                              : 'text-rose-600'
                        }`}
                      >

                        {item.difference ===
                        0
                          ? 'Rp 0'
                          : item.difference >
                              0
                            ? `+${formatRupiah(
                                item.difference
                              )}`
                            : `-${formatRupiah(
                                Math.abs(
                                  item.difference
                                )
                              )}`}

                      </td>

                      <td className="px-4 py-3.5 text-center">

                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-black ${
                            item.status ===
                            'SEIMBANG'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : item.status ===
                                  'SELISIH_LEBIH'
                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                : 'border-rose-200 bg-rose-50 text-rose-700'
                          }`}
                        >

                          {item.status ===
                          'SEIMBANG' ? (
                            <>
                              <CheckCircle2 className="h-3 w-3" />
                              SEIMBANG
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="h-3 w-3" />

                              {item.status ===
                              'SELISIH_LEBIH'
                                ? 'SURPLUS'
                                : 'DEFISIT'}
                            </>
                          )}

                        </span>

                      </td>

                      <td className="max-w-[240px] px-6 py-3.5">

                        <p className="truncate font-medium text-zinc-700">
                          {item.notes ||
                            '-'}
                        </p>

                        <p className="mt-1 text-[10px] text-zinc-400">
                          Oleh:{' '}
                          {item.createdByName ||
                            'Owner'}
                        </p>

                      </td>

                    </tr>
                  )
                )

              )}

            </tbody>

          </table>

        </div>

      </div>

      {/* MODAL */}

      {showModal && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">

          <div className="w-full max-w-lg rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl">

            <div className="mb-5 flex items-start justify-between border-b border-zinc-100 pb-4">

              <div>

                <h3 className="flex items-center gap-2 text-base font-black text-zinc-900">

                  <Scale className="h-5 w-5 text-amber-600" />

                  Rekonsiliasi Saldo Rekening

                </h3>

                <p className="mt-1 text-xs text-zinc-500">
                  Bandingkan saldo sistem dengan
                  saldo aktual rekening.
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  setShowModal(false)
                }
                className="rounded-lg px-2 py-1 text-zinc-400 hover:bg-zinc-100"
              >
                ✕
              </button>

            </div>

            <form
              onSubmit={handleSave}
              className="space-y-4"
            >

              <div className="grid grid-cols-2 gap-3">

                <div>

                  <label className="mb-1 block text-xs font-bold text-zinc-700">
                    Tanggal Cut-Off
                  </label>

                  <input
                    type="date"
                    required
                    value={
                      reconcileDate
                    }
                    onChange={(event) =>
                      setReconcileDate(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs font-semibold"
                  />

                </div>

                <div>

                  <label className="mb-1 block text-xs font-bold text-zinc-700">
                    Scope
                  </label>

                  <select
                    value={
                      selectedScope ===
                      'ALL'
                        ? 'SHARING'
                        : selectedScope
                    }
                    onChange={(event) =>
                      setSelectedScope(
                        event.target
                          .value as ScopeType
                      )
                    }
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs font-bold"
                  >

                    <option value="SHARING">
                      SHARING
                    </option>

                    <option value="PRIBADI">
                      PRIBADI
                    </option>

                  </select>

                </div>

              </div>

              <div>

                <label className="mb-1 block text-xs font-bold text-zinc-700">
                  Rekening
                </label>

                <select
                  required
                  value={accountName}
                  onChange={(event) =>
                    setAccountName(
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs font-bold"
                >

                  <option value="">
                    Pilih rekening
                  </option>

                  {accountNames.map(
                    (account) => (
                      <option
                        key={account}
                        value={account}
                      >
                        {account}
                      </option>
                    )
                  )}

                </select>

              </div>

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">

                <div className="flex items-center justify-between">

                  <span className="text-xs font-bold text-zinc-500">
                    Saldo Sistem
                  </span>

                  <span className="font-black text-zinc-900">
                    {formatRupiah(
                      modalSystemBalance
                    )}
                  </span>

                </div>

                <div className="mt-4">

                  <label className="mb-1 block text-xs font-black text-zinc-800">
                    Saldo Aktual Rekening
                  </label>

                  <input
                    type="number"
                    min="0"
                    required
                    value={
                      actualBalanceInput
                    }
                    onChange={(event) =>
                      setActualBalanceInput(
                        Number(
                          event.target.value
                        )
                      )
                    }
                    className="w-full rounded-xl border-2 border-zinc-300 bg-white p-3 text-lg font-black focus:border-amber-500 focus:outline-none"
                  />

                </div>

                <div
                  className={`mt-3 flex items-center justify-between rounded-xl border p-3 ${
                    modalDifference ===
                    0
                      ? 'border-emerald-200 bg-emerald-50'
                      : modalDifference >
                          0
                        ? 'border-blue-200 bg-blue-50'
                        : 'border-rose-200 bg-rose-50'
                  }`}
                >

                  <div className="flex items-center gap-2">

                    {modalDifference ===
                    0 ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-rose-600" />
                    )}

                    <span className="text-xs font-black">
                      {modalDifference ===
                      0
                        ? 'SEIMBANG'
                        : modalDifference >
                            0
                          ? 'SALDO FISIK LEBIH'
                          : 'SALDO FISIK KURANG'}
                    </span>

                  </div>

                  <span className="text-sm font-black">
                    {modalDifference ===
                    0
                      ? 'Rp 0'
                      : formatRupiah(
                          modalDifference
                        )}
                  </span>

                </div>

              </div>

              <div>

                <label className="mb-1 block text-xs font-bold text-zinc-700">
                  Catatan
                </label>

                <textarea
                  rows={3}
                  value={notes}
                  onChange={(event) =>
                    setNotes(
                      event.target.value
                    )
                  }
                  placeholder="Contoh: Saldo sesuai mutasi BCA."
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs"
                />

              </div>

              <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">

                <button
                  type="button"
                  onClick={() =>
                    setShowModal(false)
                  }
                  className="rounded-xl border border-zinc-200 px-4 py-2.5 text-xs font-bold text-zinc-600 hover:bg-zinc-100"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-zinc-900 px-5 py-2.5 text-xs font-black text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {saving
                    ? 'MENYIMPAN...'
                    : 'SIMPAN REKONSILIASI'}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );
};
