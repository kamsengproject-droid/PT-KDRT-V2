import React, { useEffect, useState } from 'react';
import {
  Plus,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Wallet,
  Landmark,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';

import {
  subscribeTransactions,
  createFinancialTransaction as addTransaction,
  deleteTransaction,
} from '../services/transactionService';

import { FinancialTransaction } from '../types';

import {
  formatRupiah,
  formatTanggal,
} from '../utils/formatters';

import { CurrencyInput } from '../components/CurrencyInput';

export const SaldoAwalPage: React.FC = () => {
  const {
    role,
    userProfile,
    currentUser,
  } = useAuth();

  const isOwner = role === 'OWNER';

  const [transactions, setTransactions] =
    useState<FinancialTransaction[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [isModalOpen, setIsModalOpen] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [errorMsg, setErrorMsg] =
    useState('');

  const [successMsg, setSuccessMsg] =
    useState('');

  const [formData, setFormData] =
    useState({
      date: '2026-07-31',
      scope: 'SHARING',
      accountName: '',
      amount: '' as number | '',
      notes:
        'Saldo rekening saat pembukuan KANTOR PT.KDRT mulai digunakan.',
    });

  /* ============================================================
     LOAD SALDO AWAL
  ============================================================ */

  useEffect(() => {
    const unsub =
      subscribeTransactions(
        undefined,
        (data) => {
          const openingBalances =
            data.filter(
              (transaction) =>
                transaction.sourceType ===
                'OPENING_BALANCE'
            );

          setTransactions(
            openingBalances
          );

          setLoading(false);
        }
      );

    return () => unsub();
  }, []);

  /* ============================================================
     TOTAL SALDO AWAL
  ============================================================ */

  const activeTransactions =
    transactions.filter(
      (transaction) =>
        transaction.status !== 'VOID'
    );

  const sharingBalance =
    activeTransactions
      .filter(
        (transaction) =>
          transaction.scope === 'SHARING'
      )
      .reduce(
        (total, transaction) =>
          total +
          Number(
            transaction.amount || 0
          ),
        0
      );

  const pribadiBalance =
    activeTransactions
      .filter(
        (transaction) =>
          transaction.scope === 'PRIBADI'
      )
      .reduce(
        (total, transaction) =>
          total +
          Number(
            transaction.amount || 0
          ),
        0
      );

  const totalOpeningBalance =
    sharingBalance +
    pribadiBalance;

  /* ============================================================
     SUBMIT
  ============================================================ */

  const handleSubmit = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (!isOwner) return;

    setErrorMsg('');
    setSuccessMsg('');

    if (
      !formData.amount ||
      Number(formData.amount) <= 0
    ) {
      setErrorMsg(
        'Nominal saldo awal harus lebih dari Rp 0.'
      );
      return;
    }

    if (!formData.accountName.trim()) {
      setErrorMsg(
        'Nama rekening wajib diisi.'
      );
      return;
    }

    setSubmitting(true);

    try {
      const uid =
        userProfile?.uid ||
        currentUser?.uid ||
        'system';

      const name =
        userProfile?.name ||
        currentUser?.displayName ||
        'Owner';

      /*
       * Satu rekening + tanggal + scope
       * tidak boleh mempunyai saldo awal ganda.
       */

      const referenceId =
        `OPENING_BALANCE_${formData.scope}_${formData.accountName
          .replace(/\s+/g, '_')
          .toUpperCase()}_${formData.date.replace(
          /-/g,
          ''
        )}`;

      const existing =
        transactions.find(
          (transaction) =>
            transaction.referenceId ===
              referenceId &&
            transaction.status ===
              'ACTIVE'
        );

      if (existing) {
        throw new Error(
          'Saldo awal untuk rekening, scope, dan tanggal tersebut sudah tercatat.'
        );
      }

      /*
       * OPENING_BALANCE adalah saldo awal rekening.
       *
       * Bukan pendapatan.
       *
       * Arus Kas harus memperlakukannya sebagai
       * titik awal saldo rekening.
       */

      const transaction: any = {
        type: 'INCOME',

        sourceType:
          'OPENING_BALANCE',

        amount:
          Number(formData.amount),

        date:
          formData.date,

        category:
          'SALDO AWAL REKENING',

        scope:
          formData.scope,

        accountName:
          formData.accountName.trim(),

        description:
          'Saldo awal rekening',

        notes:
          formData.notes.trim(),

        referenceId,

        paymentMethod:
          'TRANSFER',

        createdBy:
          uid,

        createdByName:
          name,
      };

      await addTransaction(
        transaction,
        uid,
        name
      );

      setSuccessMsg(
        'Saldo awal rekening berhasil disimpan.'
      );

      setIsModalOpen(false);

      setFormData({
        date: '2026-07-31',
        scope: 'SHARING',
        accountName: '',
        amount: '',
        notes:
          'Saldo rekening saat pembukuan KANTOR PT.KDRT mulai digunakan.',
      });

      setTimeout(
        () => setSuccessMsg(''),
        3000
      );
    } catch (error: any) {
      console.error(
        'Gagal menyimpan saldo awal:',
        error
      );

      setErrorMsg(
        error?.message ||
          'Gagal menyimpan saldo awal.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* ============================================================
     VOID SALDO AWAL
  ============================================================ */

  const handleVoid = async (
    transaction: FinancialTransaction
  ) => {
    if (!isOwner) return;

    const confirmed =
      window.confirm(
        'Batalkan saldo awal rekening ini?'
      );

    if (!confirmed) return;

    try {
      const uid =
        userProfile?.uid ||
        currentUser?.uid ||
        'system';

      const name =
        userProfile?.name ||
        currentUser?.displayName ||
        'Owner';

      await deleteTransaction(
        transaction.id!,
        transaction,
        'Dibatalkan oleh Owner dari menu Saldo Awal',
        uid,
        name
      );

      setSuccessMsg(
        'Saldo awal berhasil dibatalkan.'
      );

      setTimeout(
        () => setSuccessMsg(''),
        3000
      );
    } catch (error: any) {
      console.error(error);

      alert(
        error?.message ||
          'Gagal membatalkan saldo awal.'
      );
    }
  };

  /* ============================================================
     OWNER ONLY
  ============================================================ */

  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-zinc-500">
        <Wallet className="mb-4 h-12 w-12 text-zinc-300" />

        <p className="font-semibold">
          Anda tidak memiliki akses ke
          pengaturan Saldo Awal.
        </p>
      </div>
    );
  }

  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <div className="space-y-6">

      {/* SUCCESS */}

      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white shadow-lg">

          <CheckCircle2 className="h-4 w-4" />

          <span>
            {successMsg}
          </span>

        </div>
      )}

      {/* HEADER */}

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

          <div>

            <h2 className="flex items-center gap-2 text-lg font-black text-zinc-900">

              <Landmark className="h-5 w-5 text-indigo-600" />

              Saldo Awal Rekening

            </h2>

            <p className="mt-1 text-sm text-zinc-500">

              Masukkan saldo rekening yang benar-benar
              tersedia saat sistem mulai digunakan.

            </p>

          </div>

          <button
            type="button"
            onClick={() => {
              setErrorMsg('');
              setIsModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-indigo-500"
          >

            <Plus className="h-4 w-4" />

            Set Saldo Awal

          </button>

        </div>

      </div>

      {/* SUMMARY */}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">

          <p className="text-[11px] font-bold uppercase text-indigo-700">
            Total Saldo Awal
          </p>

          <p className="mt-1 text-2xl font-black text-indigo-950">
            {formatRupiah(
              totalOpeningBalance
            )}
          </p>

        </div>

        <div className="rounded-2xl border border-indigo-200 bg-white p-5">

          <p className="text-[11px] font-bold uppercase text-indigo-600">
            Saldo Awal Sharing
          </p>

          <p className="mt-1 text-2xl font-black text-zinc-900">
            {formatRupiah(
              sharingBalance
            )}
          </p>

        </div>

        <div className="rounded-2xl border border-rose-200 bg-white p-5">

          <p className="text-[11px] font-bold uppercase text-rose-600">
            Saldo Awal Pribadi
          </p>

          <p className="mt-1 text-2xl font-black text-zinc-900">
            {formatRupiah(
              pribadiBalance
            )}
          </p>

        </div>

      </div>

      {/* TABLE */}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">

        <div className="overflow-x-auto">

          <table className="w-full text-left text-xs text-zinc-600">

            <thead className="border-b border-zinc-200 bg-zinc-50">

              <tr>

                <th className="px-5 py-3 font-extrabold text-zinc-900">
                  Tanggal
                </th>

                <th className="px-5 py-3 font-extrabold text-zinc-900">
                  Scope
                </th>

                <th className="px-5 py-3 font-extrabold text-zinc-900">
                  Rekening
                </th>

                <th className="px-5 py-3 font-extrabold text-zinc-900">
                  Nominal
                </th>

                <th className="px-5 py-3 font-extrabold text-zinc-900">
                  Catatan
                </th>

                <th className="px-5 py-3 font-extrabold text-zinc-900">
                  Status
                </th>

                <th className="px-5 py-3 font-extrabold text-zinc-900">
                  Aksi
                </th>

              </tr>

            </thead>

            <tbody className="divide-y divide-zinc-100">

              {loading ? (

                <tr>

                  <td
                    colSpan={7}
                    className="p-8 text-center text-zinc-400"
                  >
                    MEMUAT DATA...
                  </td>

                </tr>

              ) : transactions.length === 0 ? (

                <tr>

                  <td
                    colSpan={7}
                    className="p-8 text-center text-zinc-400"
                  >
                    Belum ada saldo awal rekening.
                  </td>

                </tr>

              ) : (

                transactions.map(
                  (transaction) => (

                    <tr
                      key={transaction.id}
                      className={
                        transaction.status ===
                        'VOID'
                          ? 'bg-zinc-50 opacity-60'
                          : 'hover:bg-zinc-50'
                      }
                    >

                      <td className="whitespace-nowrap px-5 py-3.5 font-medium">

                        {formatTanggal(
                          transaction.date
                        )}

                      </td>

                      <td className="px-5 py-3.5">

                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ${
                            transaction.scope ===
                            'SHARING'
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >

                          {
                            transaction.scope
                          }

                        </span>

                      </td>

                      <td className="px-5 py-3.5 font-bold text-zinc-900">

                        {
                          transaction.accountName
                        }

                      </td>

                      <td className="px-5 py-3.5 font-black text-indigo-700">

                        {formatRupiah(
                          Number(
                            transaction.amount ||
                              0
                          )
                        )}

                      </td>

                      <td className="max-w-[280px] px-5 py-3.5">

                        {
                          transaction.notes ||
                          transaction.description ||
                          '-'
                        }

                      </td>

                      <td className="px-5 py-3.5">

                        {transaction.status ===
                        'VOID' ? (

                          <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                            DIBATALKAN
                          </span>

                        ) : (

                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                            AKTIF
                          </span>

                        )}

                      </td>

                      <td className="px-5 py-3.5">

                        {transaction.status ===
                          'ACTIVE' && (

                          <button
                            type="button"
                            onClick={() =>
                              handleVoid(
                                transaction
                              )
                            }
                            className="rounded-lg p-1.5 text-rose-600 transition-colors hover:bg-rose-50"
                            title="Batalkan Saldo Awal"
                          >

                            <Trash2 className="h-4 w-4" />

                          </button>

                        )}

                      </td>

                    </tr>

                  )
                )

              )}

            </tbody>

          </table>

        </div>

      </div>

      {/* ========================================================
          MODAL
      ======================================================== */}

      {isModalOpen && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">

          <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl">

            <div className="mb-5">

              <h3 className="text-lg font-black text-zinc-900">
                Set Saldo Awal Rekening
              </h3>

              <p className="mt-1 text-xs text-zinc-500">
                Masukkan saldo nyata yang sudah
                tersedia di rekening pada tanggal
                cut-off.
              </p>

            </div>

            {/* ERROR */}

            {errorMsg && (

              <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">

                <AlertTriangle className="h-4 w-4" />

                {errorMsg}

              </div>

            )}

            <form
              onSubmit={handleSubmit}
              className="space-y-4"
            >

              {/* TANGGAL + SCOPE */}

              <div className="grid grid-cols-2 gap-4">

                <div>

                  <label className="mb-1 block text-xs font-bold text-zinc-700">
                    Tanggal Efektif
                  </label>

                  <input
                    type="date"
                    required
                    value={
                      formData.date
                    }
                    onChange={(event) =>
                      setFormData({
                        ...formData,
                        date:
                          event.target
                            .value,
                      })
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
                      formData.scope
                    }
                    onChange={(event) =>
                      setFormData({
                        ...formData,
                        scope:
                          event.target
                            .value,
                      })
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

              {/* REKENING */}

              <div>

                <label className="mb-1 block text-xs font-bold text-zinc-700">
                  Nama Rekening
                </label>

                <input
                  type="text"
                  required
                  placeholder="Contoh: BCA PT KDRT"
                  value={
                    formData.accountName
                  }
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      accountName:
                        event.target
                          .value,
                    })
                  }
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs font-medium"
                />

              </div>

              {/* NOMINAL */}

              <div>

                <label className="mb-1 block text-xs font-extrabold text-zinc-800">
                  Saldo Rekening Saat Cut-off
                </label>

                <CurrencyInput
                  required
                  value={
                    formData.amount
                  }
                  onChange={(value) =>
                    setFormData({
                      ...formData,
                      amount:
                        value,
                    })
                  }
                  className="w-full rounded-xl border-2 border-indigo-200 bg-indigo-50/50 p-3 text-lg font-black text-indigo-900"
                />

              </div>

              {/* CATATAN */}

              <div>

                <label className="mb-1 block text-xs font-bold text-zinc-700">
                  Catatan
                </label>

                <textarea
                  rows={3}
                  required
                  value={
                    formData.notes
                  }
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      notes:
                        event.target
                          .value,
                    })
                  }
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs"
                />

              </div>

              {/* BUTTON */}

              <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">

                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(
                      false
                    );
                    setErrorMsg('');
                  }}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-zinc-500 hover:bg-zinc-100"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={
                    submitting
                  }
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white shadow-md transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >

                  {submitting
                    ? 'MENYIMPAN...'
                    : 'SIMPAN SALDO AWAL'}

                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );
};
