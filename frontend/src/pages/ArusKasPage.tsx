```tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Landmark,
  Lock,
  RefreshCw,
  Wallet,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import {
  FinancialTransaction,
  ScopeType,
} from '../types';

import {
  deleteTransaction,
  subscribeTransactions,
} from '../services/transactionService';

import {
  formatRupiah,
  formatTanggal,
} from '../utils/formatters';

type ScopeFilter =
  | 'ALL'
  | 'SHARING'
  | 'PRIBADI';

interface AccountBalance {
  name: string;
  scope: ScopeType;
  saldoAwal: number;
  uangMasuk: number;
  uangKeluar: number;
  saldo: number;
}

const STORAGE_KEY =
  'kdrt_finance_bank_accounts';

const DEFAULT_ACCOUNTS = [
  {
    name: 'BCA PT KDRT',
    scope: 'SHARING' as ScopeType,
  },
];

function normalizeAccountName(
  value?: string | null
) {
  return (
    value?.trim() ||
    'Rekening Belum Ditentukan'
  );
}

function isBankIncome(
  tx: FinancialTransaction
) {
  if (tx.status === 'VOID') {
    return false;
  }

  if (
    tx.sourceType ===
      'COMMISSION_REAL' ||
    tx.sourceType ===
      'TIKTOK_COMMISSION'
  ) {
    return false;
  }

  if (
    tx.sourceType ===
    'FUND_TRANSFER'
  ) {
    return true;
  }

  return tx.type === 'INCOME';
}

function isBankExpense(
  tx: FinancialTransaction
) {
  if (tx.status === 'VOID') {
    return false;
  }

  if (
    tx.sourceType ===
      'COMMISSION_REAL' ||
    tx.sourceType ===
      'TIKTOK_COMMISSION'
  ) {
    return false;
  }

  return tx.type === 'EXPENSE';
}

function getBankIncomeAmount(
  tx: FinancialTransaction
) {
  if (
    tx.sourceType ===
    'FUND_TRANSFER'
  ) {
    return Number(
      tx.netAmount || 0
    );
  }

  return Number(
    tx.amount || 0
  );
}

export const ArusKasPage: React.FC = () => {
  const {
    role,
  } = useAuth();

  const [
    transactions,
    setTransactions,
  ] = useState<
    FinancialTransaction[]
  >([]);

  const [
    scopeFilter,
    setScopeFilter,
  ] = useState<ScopeFilter>('ALL');

  const [
    selectedAccount,
    setSelectedAccount,
  ] = useState('ALL');

  const [
    showTransactions,
    setShowTransactions,
  ] = useState(true);

  const [
    deleting,
    setDeleting,
  ] = useState<string | null>(null);

  const [
    accounts,
    setAccounts,
  ] = useState<
    {
      name: string;
      scope: ScopeType;
    }[]
  >(DEFAULT_ACCOUNTS);

  useEffect(() => {
    const raw =
      localStorage.getItem(
        STORAGE_KEY
      );

    if (!raw) return;

    try {
      const parsed =
        JSON.parse(raw);

      if (
        Array.isArray(parsed) &&
        parsed.length > 0
      ) {
        setAccounts(parsed);
      }
    } catch {
      // Ignore invalid local account configuration.
    }
  }, []);

  useEffect(() => {
    return subscribeTransactions(
      undefined,
      setTransactions
    );
  }, []);

  const visibleTransactions =
    useMemo(() => {
      return transactions
        .filter((tx) => {
          if (
            scopeFilter !== 'ALL' &&
            tx.scope !== scopeFilter
          ) {
            return false;
          }

          if (
            selectedAccount !== 'ALL'
          ) {
            const account =
              normalizeAccountName(
                tx.accountName ||
                  tx.toAccount
              );

            if (
              account !==
              selectedAccount
            ) {
              return false;
            }
          }

          return true;
        })
        .sort(
          (a, b) =>
            (b.date || '').localeCompare(
              a.date || ''
            )
        );
    }, [
      transactions,
      scopeFilter,
      selectedAccount,
    ]);

  const bankAccounts =
    useMemo(() => {
      const map =
        new Map<
          string,
          AccountBalance
        >();

      /*
       * Daftar rekening yang sudah
       * dikenal sistem.
       */
      accounts.forEach(
        (account) => {
          const key =
            account.name.trim();

          if (!key) return;

          map.set(key, {
            name: key,
            scope:
              account.scope,
            saldoAwal: 0,
            uangMasuk: 0,
            uangKeluar: 0,
            saldo: 0,
          });
        }
      );

      /*
       * Tambahkan rekening yang muncul
       * dari transaksi.
       */
      transactions.forEach(
        (tx) => {
          if (
            tx.status === 'VOID'
          ) {
            return;
          }

          const accountName =
            normalizeAccountName(
              tx.accountName ||
                tx.toAccount
            );

          if (
            accountName ===
            'Rekening Belum Ditentukan'
          ) {
            return;
          }

          if (
            !map.has(accountName)
          ) {
            map.set(
              accountName,
              {
                name:
                  accountName,
                scope:
                  tx.scope ===
                  'PRIBADI'
                    ? 'PRIBADI'
                    : 'SHARING',
                saldoAwal: 0,
                uangMasuk: 0,
                uangKeluar: 0,
                saldo: 0,
              }
            );
          }
        }
      );

      transactions.forEach(
        (tx) => {
          if (
            tx.status === 'VOID'
          ) {
            return;
          }

          const accountName =
            normalizeAccountName(
              tx.accountName ||
                tx.toAccount
            );

          const account =
            map.get(
              accountName
            );

          if (!account) {
            return;
          }

          if (
            isBankIncome(tx)
          ) {
            account.uangMasuk +=
              getBankIncomeAmount(
                tx
              );
          }

          if (
            isBankExpense(tx)
          ) {
            account.uangKeluar +=
              Number(
                tx.amount || 0
              );
          }

          account.saldo =
            account.saldoAwal +
            account.uangMasuk -
            account.uangKeluar;
        }
      );

      return Array.from(
        map.values()
      );
    }, [
      transactions,
      accounts,
    ]);

  const filteredAccounts =
    useMemo(() => {
      if (
        scopeFilter === 'ALL'
      ) {
        return bankAccounts;
      }

      return bankAccounts.filter(
        (account) =>
          account.scope ===
          scopeFilter
      );
    }, [
      bankAccounts,
      scopeFilter,
    ]);

  const totalSaldo =
    filteredAccounts.reduce(
      (sum, account) =>
        sum + account.saldo,
      0
    );

  const totalIncome =
    filteredAccounts.reduce(
      (sum, account) =>
        sum + account.uangMasuk,
      0
    );

  const totalExpense =
    filteredAccounts.reduce(
      (sum, account) =>
        sum + account.uangKeluar,
      0
    );

  const totalSaldoAwal =
    filteredAccounts.reduce(
      (sum, account) =>
        sum + account.saldoAwal,
      0
    );

  const handleDelete =
    async (
      tx: FinancialTransaction
    ) => {
      if (
        role !== 'OWNER'
      ) {
        return;
      }

      const reason =
        window.prompt(
          'Alasan VOID transaksi ini:'
        );

      if (
        !reason?.trim()
      ) {
        return;
      }

      setDeleting(
        tx.id || null
      );

      try {
        await deleteTransaction(
          tx.id!,
          tx,
          reason.trim(),
          'owner',
          'Owner PT KDRT'
        );
      } catch (error) {
        console.error(
          'Gagal VOID transaksi:',
          error
        );

        window.alert(
          error instanceof Error
            ? error.message
            : 'Gagal melakukan VOID transaksi.'
        );
      } finally {
        setDeleting(null);
      }
    };

  if (
    role !== 'OWNER' &&
    role !== 'MANAGER'
  ) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-zinc-500">
        <Lock className="mb-3 h-10 w-10" />
        <p className="font-bold">
          Buku Kas & Bank tidak dapat
          diakses oleh role ini.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* HEADER */}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

        <div>
          <div className="flex items-center gap-2">
            <Landmark className="h-6 w-6 text-emerald-600" />

            <h1 className="text-xl font-black text-zinc-900">
              Kas & Bank
            </h1>
          </div>

          <p className="mt-1 text-sm text-zinc-500">
            Saldo rekening aktual berdasarkan
            transaksi keuangan yang sudah tercatat.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setTransactions(
              [...transactions]
            )
          }
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
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
                setScopeFilter(
                  value
                )
              }
              className={`rounded-xl px-4 py-2 text-xs font-black transition ${
                scopeFilter ===
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

          {bankAccounts.map(
            (account) => (
              <option
                key={account.name}
                value={account.name}
              >
                {account.name}
              </option>
            )
          )}
        </select>

      </div>

      {/* TOTAL SALDO */}

      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">

        <div className="flex items-start justify-between gap-4">

          <div>

            <p className="text-xs font-black uppercase tracking-wider text-zinc-500">
              Total Saldo Rekening Real
            </p>

            <p className="mt-2 text-3xl font-black text-zinc-950">
              {formatRupiah(
                totalSaldo
              )}
            </p>

            <p className="mt-2 text-xs text-zinc-500">
              {scopeFilter ===
              'ALL'
                ? 'Semua rekening'
                : `Rekening ${scopeFilter.toLowerCase()}`}
            </p>

          </div>

          <div className="rounded-2xl bg-emerald-50 p-3">
            <Wallet className="h-6 w-6 text-emerald-600" />
          </div>

        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">

          <div className="rounded-2xl bg-zinc-50 p-4">
            <p className="text-xs font-bold text-zinc-500">
              Saldo Awal
            </p>
            <p className="mt-1 font-black">
              {formatRupiah(
                totalSaldoAwal
              )}
            </p>
          </div>

          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-xs font-bold text-emerald-700">
              Uang Masuk
            </p>
            <p className="mt-1 font-black text-emerald-800">
              +{' '}
              {formatRupiah(
                totalIncome
              )}
            </p>
          </div>

          <div className="rounded-2xl bg-rose-50 p-4">
            <p className="text-xs font-bold text-rose-700">
              Uang Keluar
            </p>
            <p className="mt-1 font-black text-rose-800">
              -{' '}
              {formatRupiah(
                totalExpense
              )}
            </p>
          </div>

        </div>

      </div>

      {/* REKENING */}

      <section className="space-y-3">

        <div className="flex items-center justify-between">

          <div>
            <h2 className="text-lg font-black text-zinc-900">
              Saldo Rekening
            </h2>

            <p className="text-xs text-zinc-500">
              Dipisahkan berdasarkan rekening dan scope.
            </p>
          </div>

          <Building2 className="h-5 w-5 text-zinc-400" />

        </div>

        {filteredAccounts.length ===
        0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-400">
            Belum ada rekening.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">

            {filteredAccounts.map(
              (account) => (
                <div
                  key={account.name}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
                >

                  <div className="flex items-start justify-between">

                    <div>

                      <div className="flex items-center gap-2">

                        <Landmark className="h-5 w-5 text-indigo-600" />

                        <h3 className="font-black text-zinc-900">
                          {account.name}
                        </h3>

                      </div>

                      <span className="mt-2 inline-block rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-black text-zinc-600">
                        {account.scope}
                      </span>

                    </div>

                    <div className="text-right">

                      <p className="text-[10px] font-bold uppercase text-zinc-400">
                        Saldo
                      </p>

                      <p
                        className={`text-xl font-black ${
                          account.saldo <
                          0
                            ? 'text-rose-600'
                            : 'text-zinc-950'
                        }`}
                      >
                        {formatRupiah(
                          account.saldo
                        )}
                      </p>

                    </div>

                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2">

                    <div className="rounded-xl bg-emerald-50 p-3">

                      <p className="text-[10px] font-bold text-emerald-700">
                        Masuk
                      </p>

                      <p className="mt-1 text-sm font-black text-emerald-800">
                        +{' '}
                        {formatRupiah(
                          account.uangMasuk
                        )}
                      </p>

                    </div>

                    <div className="rounded-xl bg-rose-50 p-3">

                      <p className="text-[10px] font-bold text-rose-700">
                        Keluar
                      </p>

                      <p className="mt-1 text-sm font-black text-rose-800">
                        -{' '}
                        {formatRupiah(
                          account.uangKeluar
                        )}
                      </p>

                    </div>

                  </div>

                </div>
              )
            )}

          </div>
        )}

      </section>

      {/* INFO FLOW */}

      <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5">

        <div className="flex gap-3">

          <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />

          <div>

            <p className="font-black text-indigo-950">
              Prinsip Kas & Bank
            </p>

            <p className="mt-1 text-sm leading-6 text-indigo-900">

              Komisi Real TikTok hanya menjadi
              data performa akun. Setelah dilakukan
              Pindah Dana, dana bersih yang diterima
              rekening baru dihitung sebagai Uang Masuk
              Kas & Bank.

            </p>

          </div>

        </div>

      </div>

      {/* TRANSACTIONS */}

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">

        <button
          type="button"
          onClick={() =>
            setShowTransactions(
              !showTransactions
            )
          }
          className="flex w-full items-center justify-between border-b border-zinc-200 p-5 text-left hover:bg-zinc-50"
        >

          <div>

            <h2 className="font-black text-zinc-900">
              Riwayat Kas & Bank
            </h2>

            <p className="mt-1 text-xs text-zinc-500">
              {visibleTransactions.length}{' '}
              transaksi
            </p>

          </div>

          {showTransactions ? (
            <ChevronUp className="h-5 w-5 text-zinc-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-zinc-400" />
          )}

        </button>

        {showTransactions && (

          <div className="overflow-x-auto">

            <table className="w-full text-left text-sm">

              <thead className="bg-zinc-50 text-[11px] font-black uppercase text-zinc-500">

                <tr>

                  <th className="p-4">
                    Tanggal
                  </th>

                  <th className="p-4">
                    Keterangan
                  </th>

                  <th className="p-4">
                    Rekening
                  </th>

                  <th className="p-4">
                    Scope
                  </th>

                  <th className="p-4 text-right">
                    Nominal
                  </th>

                  {role ===
                    'OWNER' && (
                    <th className="p-4">
                      Aksi
                    </th>
                  )}

                </tr>

              </thead>

              <tbody>

                {visibleTransactions.map(
                  (tx) => {

                    const income =
                      isBankIncome(
                        tx
                      );

                    const expense =
                      isBankExpense(
                        tx
                      );

                    const transfer =
                      tx.sourceType ===
                      'FUND_TRANSFER';

                    return (
                      <tr
                        key={tx.id}
                        className="border-t border-zinc-100"
                      >

                        <td className="whitespace-nowrap p-4 text-zinc-600">
                          {formatTanggal(
                            tx.date
                          )}
                        </td>

                        <td className="p-4">

                          <div className="flex items-center gap-2">

                            {income ? (
                              <ArrowDownCircle className="h-4 w-4 text-emerald-600" />
                            ) : expense ? (
                              <ArrowUpCircle className="h-4 w-4 text-rose-600" />
                            ) : (
                              <RefreshCw className="h-4 w-4 text-indigo-600" />
                            )}

                            <div>

                              <p className="font-bold text-zinc-900">
                                {tx.description ||
                                  tx.category ||
                                  'Transaksi'}
                              </p>

                              <p className="text-[11px] text-zinc-400">
                                {transfer
                                  ? 'Pindah Dana'
                                  : tx.category ||
                                    tx.sourceType ||
                                    '-'}
                              </p>

                            </div>

                          </div>

                        </td>

                        <td className="p-4 font-semibold text-zinc-700">
                          {normalizeAccountName(
                            tx.accountName ||
                              tx.toAccount
                          )}
                        </td>

                        <td className="p-4">
                          <span className="rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-black text-zinc-600">
                            {tx.scope}
                          </span>
                        </td>

                        <td
                          className={`whitespace-nowrap p-4 text-right font-black ${
                            income
                              ? 'text-emerald-700'
                              : expense
                                ? 'text-rose-700'
                                : 'text-zinc-700'
                          }`}
                        >
                          {income
                            ? '+ '
                            : expense
                              ? '- '
                              : ''}

                          {formatRupiah(
                            transfer
                              ? Number(
                                  tx.netAmount ||
                                    0
                                )
                              : Number(
                                  tx.amount ||
                                    0
                                )
                          )}

                          {transfer &&
                            Number(
                              tx.adminFee ||
                                0
                            ) >
                              0 && (
                              <div className="text-[10px] font-semibold text-zinc-400">
                                Admin:{' '}
                                {formatRupiah(
                                  Number(
                                    tx.adminFee
                                  )
                                )}
                              </div>
                            )}

                        </td>

                        {role ===
                          'OWNER' && (
                          <td className="p-4">

                            <button
                              type="button"
                              disabled={
                                deleting ===
                                tx.id
                              }
                              onClick={() =>
                                handleDelete(
                                  tx
                                )
                              }
                              className="rounded-lg px-2 py-1 text-[10px] font-black text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                            >
                              {deleting ===
                              tx.id
                                ? '...'
                                : 'VOID'}
                            </button>

                          </td>
                        )}

                      </tr>
                    );
                  }
                )}

                {visibleTransactions.length ===
                  0 && (
                  <tr>

                    <td
                      colSpan={
                        role ===
                        'OWNER'
                          ? 6
                          : 5
                      }
                      className="p-10 text-center text-zinc-400"
                    >
                      Belum ada transaksi
                      Kas & Bank.
                    </td>

                  </tr>
                )}

              </tbody>

            </table>

          </div>

        )}

      </section>

    </div>
  );
};
```

**Copy All → replace `ArusKasPage.tsx` → Save → commit.**
