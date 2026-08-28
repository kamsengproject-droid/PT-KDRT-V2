import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Lock,
  PencilLine,
  Landmark,
  ArrowDownCircle,
  ArrowUpCircle,
} from 'lucide-react';

import { CurrencyInput } from '../components/CurrencyInput';
import { useAuth } from '../context/AuthContext';

import {
  FinancialTransaction,
  PaymentMethod,
  ScopeType,
  TransactionType,
} from '../types';

import {
  createFinancialTransaction,
  subscribeTransactions,
} from '../services/transactionService';

import {
  formatRupiah,
  formatTanggal,
  tanggalHariIni,
} from '../utils/formatters';

const INCOME_CATEGORIES = [
  'ENDORSE',
  'SPONSOR',
  'JASA',
  'PENJUALAN',
  'LAINNYA',
];

const EXPENSE_CATEGORIES = [
  'OPERASIONAL',
  'GAJI',
  'LISTRIK',
  'INTERNET',
  'TRANSPORTASI',
  'IKLAN',
  'SEWA',
  'SAMPEL',
  'LAINNYA',
];

type ManualTransactionType = Extract<
  TransactionType,
  'INCOME' | 'EXPENSE'
>;

export const InputManualKeuanganPage: React.FC = () => {
  const {
    role,
    currentUser,
    userProfile,
  } = useAuth();

  const [items, setItems] = useState<
    FinancialTransaction[]
  >([]);

  const [saving, setSaving] =
    useState(false);

  const [notice, setNotice] =
    useState('');

  const [form, setForm] = useState({
    date: tanggalHariIni(),

    type:
      'INCOME' as ManualTransactionType,

    category: 'LAINNYA',

    scope:
      'SHARING' as ScopeType,

    amount: '' as number | '',

    paymentMethod:
      'TRANSFER' as PaymentMethod,

    accountName: '',

    description: '',

    notes: '',
  });

  /* ============================================================
     LOAD TRANSAKSI MANUAL
  ============================================================ */

  useEffect(() => {
    const unsubscribe =
      subscribeTransactions(
        {
          sourceType: 'MANUAL',
        },
        setItems
      );

    return () => unsubscribe();
  }, []);

  /* ============================================================
     OWNER ONLY
  ============================================================ */

  if (role !== 'OWNER') {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-zinc-500">
        <Lock className="mb-3 h-10 w-10" />

        <p className="font-semibold">
          Input manual keuangan hanya dapat
          digunakan oleh Owner.
        </p>
      </div>
    );
  }

  const categories =
    form.type === 'INCOME'
      ? INCOME_CATEGORIES
      : EXPENSE_CATEGORIES;

  /* ============================================================
     CHANGE TYPE
  ============================================================ */

  const changeType = (
    type: ManualTransactionType
  ) => {
    setForm((prev) => ({
      ...prev,
      type,
      category: 'LAINNYA',
    }));

    setNotice('');
  };

  /* ============================================================
     SUBMIT
  ============================================================ */

  const submit = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    setNotice('');

    if (
      !currentUser ||
      !userProfile
    ) {
      setNotice(
        'User belum terdeteksi. Silakan login ulang.'
      );
      return;
    }

    const amount =
      Number(form.amount) || 0;

    if (amount <= 0) {
      setNotice(
        'Nominal transaksi harus lebih dari Rp 0.'
      );
      return;
    }

    if (!form.accountName.trim()) {
      setNotice(
        'Nama rekening wajib diisi.'
      );
      return;
    }

    if (!form.description.trim()) {
      setNotice(
        'Keterangan transaksi wajib diisi.'
      );
      return;
    }

    /*
     * Komisi Real TIDAK boleh dicatat
     * melalui Input Manual.
     */

    if (
      form.category ===
      'KOMISI TIKTOK'
    ) {
      setNotice(
        'Komisi Real TikTok harus berasal dari data performa akun dan dicairkan melalui menu Pindah Dana.'
      );
      return;
    }

    setSaving(true);

    try {
      const referenceId =
        `MANUAL_${form.date}_${form.type}_${Date.now()}`;

      const result =
        await createFinancialTransaction(
          {
            type: form.type,

            amount,

            date: form.date,

            category:
              form.category,

            scope:
              form.scope,

            sourceType:
              'MANUAL',

            referenceId,

            accountName:
              form.accountName.trim(),

            paymentMethod:
              form.paymentMethod,

            description:
              form.description.trim(),

            notes:
              form.notes.trim(),

            createdBy:
              currentUser.uid,

            createdByName:
              userProfile.name,
          } as any,
          currentUser.uid,
          userProfile.name
        );

      if (!result.success) {
        throw new Error(
          result.message ||
            'Transaksi gagal disimpan.'
        );
      }

      setNotice(
        form.type === 'INCOME'
          ? 'Uang masuk berhasil dicatat ke Kas & Bank.'
          : 'Uang keluar berhasil dicatat ke Kas & Bank.'
      );

      setForm({
        date:
          tanggalHariIni(),

        type:
          'INCOME',

        category:
          'LAINNYA',

        scope:
          'SHARING',

        amount:
          '',

        paymentMethod:
          'TRANSFER',

        accountName:
          '',

        description:
          '',

        notes:
          '',
      });
    } catch (error: any) {
      console.error(
        'INPUT MANUAL ERROR:',
        error
      );

      setNotice(
        error?.message ||
          'Gagal menyimpan transaksi manual.'
      );
    } finally {
      setSaving(false);
    }
  };

  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <div className="mx-auto max-w-5xl space-y-6">

      {/* HEADER */}

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">

        <div className="flex gap-3">

          <PencilLine className="mt-0.5 h-5 w-5 shrink-0" />

          <div>

            <h2 className="font-black">
              Input Manual Keuangan
            </h2>

            <p className="mt-1 text-sm">
              Catat uang masuk atau uang keluar
              yang benar-benar terjadi pada
              rekening Kas & Bank.
            </p>

          </div>

        </div>

      </div>

      {/* FORM */}

      <form
        onSubmit={submit}
        className="grid gap-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm md:grid-cols-2"
      >

        {/* TANGGAL */}

        <label className="text-sm font-bold">

          Tanggal

          <input
            required
            type="date"
            value={form.date}
            onChange={(event) =>
              setForm({
                ...form,
                date:
                  event.target.value,
              })
            }
            className="mt-1.5 w-full rounded-xl border border-zinc-300 p-2.5"
          />

        </label>

        {/* JENIS */}

        <div>

          <span className="text-sm font-bold">
            Jenis Transaksi
          </span>

          <div className="mt-1.5 grid grid-cols-2 gap-2">

            <button
              type="button"
              onClick={() =>
                changeType('INCOME')
              }
              className={`flex items-center justify-center gap-2 rounded-xl p-2.5 text-sm font-bold ${
                form.type === 'INCOME'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-100 text-zinc-600'
              }`}
            >

              <ArrowDownCircle className="h-4 w-4" />

              Uang Masuk

            </button>

            <button
              type="button"
              onClick={() =>
                changeType('EXPENSE')
              }
              className={`flex items-center justify-center gap-2 rounded-xl p-2.5 text-sm font-bold ${
                form.type === 'EXPENSE'
                  ? 'bg-rose-600 text-white'
                  : 'bg-zinc-100 text-zinc-600'
              }`}
            >

              <ArrowUpCircle className="h-4 w-4" />

              Uang Keluar

            </button>

          </div>

        </div>

        {/* REKENING */}

        <label className="text-sm font-bold">

          Rekening Bank

          <div className="relative mt-1.5">

            <Landmark className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />

            <input
              required
              value={
                form.accountName
              }
              onChange={(event) =>
                setForm({
                  ...form,
                  accountName:
                    event.target.value,
                })
              }
              placeholder="Contoh: BCA PT KDRT"
              className="w-full rounded-xl border border-zinc-300 py-2.5 pl-10 pr-3"
            />

          </div>

        </label>

        {/* SCOPE */}

        <label className="text-sm font-bold">

          Scope

          <select
            value={form.scope}
            onChange={(event) =>
              setForm({
                ...form,
                scope:
                  event.target
                    .value as ScopeType,
              })
            }
            className="mt-1.5 w-full rounded-xl border border-zinc-300 p-2.5"
          >

            <option value="SHARING">
              SHARING
            </option>

            <option value="PRIBADI">
              PRIBADI
            </option>

          </select>

        </label>

        {/* KATEGORI */}

        <label className="text-sm font-bold">

          Kategori

          <select
            value={form.category}
            onChange={(event) =>
              setForm({
                ...form,
                category:
                  event.target.value,
              })
            }
            className="mt-1.5 w-full rounded-xl border border-zinc-300 p-2.5"
          >

            {categories.map(
              (category) => (
                <option
                  key={category}
                  value={category}
                >
                  {category}
                </option>
              )
            )}

          </select>

        </label>

        {/* NOMINAL */}

        <label className="text-sm font-bold">

          Nominal

          <CurrencyInput
            required
            value={form.amount}
            onChange={(amount) =>
              setForm({
                ...form,
                amount,
              })
            }
            className={`mt-1.5 w-full rounded-xl border p-2.5 ${
              form.type ===
              'INCOME'
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-rose-200 bg-rose-50'
            }`}
          />

        </label>

        {/* PAYMENT METHOD */}

        <label className="text-sm font-bold">

          Metode Pembayaran

          <select
            value={
              form.paymentMethod
            }
            onChange={(event) =>
              setForm({
                ...form,
                paymentMethod:
                  event.target
                    .value as PaymentMethod,
              })
            }
            className="mt-1.5 w-full rounded-xl border border-zinc-300 p-2.5"
          >

            <option value="TRANSFER">
              Transfer Bank
            </option>

            <option value="CASH">
              Kas
            </option>

            <option value="EWALLET">
              E-Wallet
            </option>

            <option value="LAINNYA">
              Lainnya
            </option>

          </select>

        </label>

        {/* KETERANGAN */}

        <label className="text-sm font-bold md:col-span-2">

          Keterangan

          <input
            required
            value={
              form.description
            }
            onChange={(event) =>
              setForm({
                ...form,
                description:
                  event.target.value,
              })
            }
            placeholder="Contoh: pembayaran jasa desain"
            className="mt-1.5 w-full rounded-xl border border-zinc-300 p-2.5"
          />

        </label>

        {/* CATATAN */}

        <label className="text-sm font-bold md:col-span-2">

          Catatan

          <textarea
            value={form.notes}
            onChange={(event) =>
              setForm({
                ...form,
                notes:
                  event.target.value,
              })
            }
            rows={2}
            placeholder="Catatan tambahan jika diperlukan"
            className="mt-1.5 w-full rounded-xl border border-zinc-300 p-2.5"
          />

        </label>

        {/* NOTICE */}

        {notice && (

          <div
            className={`md:col-span-2 rounded-xl p-3 text-sm font-semibold ${
              notice.includes(
                'berhasil'
              )
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-rose-50 text-rose-700'
            }`}
          >
            {notice}
          </div>

        )}

        {/* SUBMIT */}

        <button
          type="submit"
          disabled={saving}
          className={`md:col-span-2 rounded-xl px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50 ${
            form.type ===
            'INCOME'
              ? 'bg-emerald-600 hover:bg-emerald-500'
              : 'bg-rose-600 hover:bg-rose-500'
          }`}
        >

          {saving
            ? 'MENYIMPAN...'
            : form.type ===
              'INCOME'
            ? 'SIMPAN UANG MASUK'
            : 'SIMPAN UANG KELUAR'}

        </button>

      </form>

      {/* RIWAYAT */}

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">

        <div className="flex items-center gap-2 border-b border-zinc-200 p-5">

          <CheckCircle2 className="h-5 w-5 text-amber-600" />

          <h3 className="font-black">
            Riwayat Input Manual
          </h3>

        </div>

        <div className="overflow-x-auto">

          <table className="w-full text-left text-sm">

            <thead className="bg-zinc-50 text-xs">

              <tr>

                <th className="p-4">
                  Tanggal
                </th>

                <th className="p-4">
                  Jenis
                </th>

                <th className="p-4">
                  Kategori
                </th>

                <th className="p-4">
                  Rekening
                </th>

                <th className="p-4">
                  Scope
                </th>

                <th className="p-4">
                  Nominal
                </th>

              </tr>

            </thead>

            <tbody>

              {items.map(
                (tx) => (

                  <tr
                    key={tx.id}
                    className="border-t border-zinc-100"
                  >

                    <td className="p-4">
                      {formatTanggal(
                        tx.date
                      )}
                    </td>

                    <td className="p-4">

                      <span
                        className={`rounded-full px-2 py-1 text-xs font-bold ${
                          tx.type ===
                          'INCOME'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {tx.type ===
                        'INCOME'
                          ? 'Masuk'
                          : 'Keluar'}
                      </span>

                    </td>

                    <td className="p-4">
                      {tx.category}
                    </td>

                    <td className="p-4 font-semibold">
                      {tx.accountName ||
                        '-'}
                    </td>

                    <td className="p-4">
                      {tx.scope}
                    </td>

                    <td
                      className={`p-4 font-black ${
                        tx.type ===
                        'INCOME'
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {tx.type ===
                      'INCOME'
                        ? '+ '
                        : '- '}

                      {formatRupiah(
                        Number(
                          tx.amount ||
                            0
                        )
                      )}
                    </td>

                  </tr>

                )
              )}

              {items.length ===
                0 && (

                <tr>

                  <td
                    colSpan={6}
                    className="p-8 text-center text-zinc-400"
                  >
                    Belum ada transaksi
                    manual.
                  </td>

                </tr>

              )}

            </tbody>

          </table>

        </div>

      </section>

    </div>
  );
};
