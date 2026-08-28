import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  Landmark,
  Lock,
  Wallet,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

import { CurrencyInput } from '../components/CurrencyInput';
import { useAuth } from '../context/AuthContext';
import {
  FinancialTransaction,
  ScopeType,
  Account,
  DailyPerformance,
} from '../types';

import {
  recordFundTransfer,
  subscribeTransactions,
  getAvailableKomisiReal,
} from '../services/transactionService';

import { subscribeAccounts } from '../services/accountService';
import { subscribeDailyPerformance } from '../services/performanceService';

import {
  formatRupiah,
  formatTanggal,
  tanggalHariIni,
} from '../utils/formatters';

export const PindahDanaPage: React.FC = () => {
  const {
    role,
    currentUser,
    userProfile,
  } = useAuth();

  /* ============================================================
     STATE
  ============================================================ */

  const [accounts, setAccounts] = useState<Account[]>([]);

  const [performance, setPerformance] = useState<
    DailyPerformance[]
  >([]);

  const [history, setHistory] = useState<
    FinancialTransaction[]
  >([]);

  const [saving, setSaving] = useState(false);

  const [notice, setNotice] = useState('');

  const [noticeType, setNoticeType] = useState<
    'success' | 'error' | ''
  >('');

  const [availableCommission, setAvailableCommission] =
    useState(0);

  const [loadingAvailable, setLoadingAvailable] =
    useState(false);

  const [form, setForm] = useState({
    date: tanggalHariIni(),

    accountId: '',

    scope: 'SHARING' as ScopeType,

    grossAmount: '' as number | '',

    adminFee: '' as number | '',

    toAccount: '',

    description: '',

    notes: '',
  });

  /* ============================================================
     LOAD AKUN
  ============================================================ */

  useEffect(() => {
    const unsubscribe =
      subscribeAccounts(undefined, (data) => {
        setAccounts(data);
      });

    return () => unsubscribe();
  }, []);

  /* ============================================================
     LOAD PERFORMANCE
  ============================================================ */

  useEffect(() => {
    const unsubscribe =
      subscribeDailyPerformance(
        undefined,
        (data) => {
          setPerformance(data);
        }
      );

    return () => unsubscribe();
  }, []);

  /* ============================================================
     LOAD HISTORY PINDAH DANA
  ============================================================ */

  useEffect(() => {
    const unsubscribe =
      subscribeTransactions(
        {
          sourceType: 'FUND_TRANSFER',
        },
        (data) => {
          setHistory(data);
        }
      );

    return () => unsubscribe();
  }, []);

  /* ============================================================
     AKUN TERPILIH
  ============================================================ */

  const selectedAccount = useMemo(() => {
    if (!form.accountId) {
      return undefined;
    }

    return accounts.find(
      (account) =>
        account.id === form.accountId
    );
  }, [accounts, form.accountId]);

  /* ============================================================
     KOMISI REAL AKUN TERPILIH
  ============================================================ */

  const accountCommission = useMemo(() => {
    if (!form.accountId) {
      return 0;
    }

    return performance
      .filter(
        (item) =>
          item.accountId ===
          form.accountId
      )
      .reduce((total, item) => {
        return (
          total +
          Number(
            item.commissionReal ??
              item.realCommission ??
              0
          )
        );
      }, 0);
  }, [performance, form.accountId]);

  /* ============================================================
     LOAD KOMISI REAL TERSEDIA
  ============================================================ */

  useEffect(() => {
    let cancelled = false;

    const loadAvailable = async () => {
      if (!form.accountId) {
        setAvailableCommission(0);
        return;
      }

      setLoadingAvailable(true);

      try {
        const available =
          await getAvailableKomisiReal(
            form.accountId
          );

        if (!cancelled) {
          setAvailableCommission(
            Number(available) || 0
          );
        }
      } catch (error) {
        console.error(
          'Gagal mengambil Komisi Real tersedia:',
          error
        );

        if (!cancelled) {
          setAvailableCommission(0);
        }
      } finally {
        if (!cancelled) {
          setLoadingAvailable(false);
        }
      }
    };

    loadAvailable();

    return () => {
      cancelled = true;
    };
  }, [
    form.accountId,
    history.length,
  ]);

  /* ============================================================
     NET AMOUNT
  ============================================================ */

  const grossAmount =
    Number(form.grossAmount) || 0;

  const adminFee =
    Number(form.adminFee) || 0;

  const netAmount = Math.max(
    0,
    grossAmount - adminFee
  );

  /* ============================================================
     VALIDATION
  ============================================================ */

  const exceedsAvailable =
    grossAmount > availableCommission;

  const canSubmit =
    Boolean(
      currentUser &&
        userProfile &&
        form.accountId &&
        form.toAccount.trim() &&
        form.date &&
        grossAmount > 0 &&
        adminFee >= 0 &&
        adminFee <= grossAmount &&
        !exceedsAvailable &&
        !loadingAvailable &&
        !saving
    );

  /* ============================================================
     CHANGE ACCOUNT
  ============================================================ */

  const handleAccountChange = (
    accountId: string
  ) => {
    const account =
      accounts.find(
        (item) =>
          item.id === accountId
      );

    setForm((previous) => ({
      ...previous,

      accountId,

      scope:
        account?.scope ||
        'SHARING',

      grossAmount: '',
    }));

    setNotice('');
    setNoticeType('');
  };

  /* ============================================================
     SUBMIT
  ============================================================ */

  const submit = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (!currentUser || !userProfile) {
      return;
    }

    if (!form.accountId) {
      setNotice(
        'Silakan pilih akun TikTok terlebih dahulu.'
      );
      setNoticeType('error');
      return;
    }

    if (!selectedAccount) {
      setNotice(
        'Akun TikTok tidak ditemukan.'
      );
      setNoticeType('error');
      return;
    }

    if (grossAmount <= 0) {
      setNotice(
        'Nominal Komisi Real harus lebih besar dari Rp 0.'
      );
      setNoticeType('error');
      return;
    }

    if (grossAmount > availableCommission) {
      setNotice(
        `Nominal melebihi Komisi Real tersedia. Maksimal ${formatRupiah(
          availableCommission
        )}.`
      );
      setNoticeType('error');
      return;
    }

    if (adminFee > grossAmount) {
      setNotice(
        'Admin TikTok tidak boleh melebihi Komisi Real.'
      );
      setNoticeType('error');
      return;
    }

    if (!form.toAccount.trim()) {
      setNotice(
        'Rekening tujuan wajib diisi.'
      );
      setNoticeType('error');
      return;
    }

    setSaving(true);
    setNotice('');
    setNoticeType('');

    try {
      const result =
        await recordFundTransfer(
          {
            date: form.date,
            scope: selectedAccount?.scope || 'SHARING',
            grossAmount,
            adminFee,
            fromAccount: selectedAccount?.accountName || 'Komisi Real TikTok',
            toAccount: form.toAccount.trim(),
            description: form.description.trim(),
            notes: form.notes.trim(),
          },
          currentUser.uid,
          userProfile.name
        );

      if (!result.success) {
        throw new Error(
          result.message ||
            'Pindah dana gagal disimpan.'
        );
      }

      setNotice(
        `Pindah dana berhasil. ${formatRupiah(
          netAmount
        )} dicatat sebagai uang masuk Kas & Bank.`
      );

      setNoticeType('success');

      setForm({
        date: tanggalHariIni(),

        accountId: '',

        scope: 'SHARING',

        grossAmount: '',

        adminFee: '',

        toAccount: '',

        description: '',

        notes: '',
      });

      /*
       * History listener akan memperbarui data.
       * Available Commission juga akan dihitung ulang
       * ketika data history berubah.
       */
    } catch (error: any) {
      console.error(
        'Pindah dana gagal:',
        error
      );

      setNotice(
        error?.message ||
          'Pindah dana gagal disimpan.'
      );

      setNoticeType('error');
    } finally {
      setSaving(false);
    }
  };

  /* ============================================================
     OWNER ONLY
  ============================================================ */

  if (role !== 'OWNER') {
    return (
      <div className="p-8 text-center text-zinc-500">
        <Lock className="mx-auto mb-3 h-10 w-10" />

        <p className="font-bold">
          Pindah Dana hanya dapat dicatat
          oleh Owner.
        </p>
      </div>
    );
  }

  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <div className="mx-auto max-w-5xl space-y-6">

      {/* ========================================================
          INFO
      ======================================================== */}

      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 text-indigo-950">
        <div className="flex gap-3">
          <ArrowRightLeft className="mt-0.5 h-5 w-5 shrink-0" />

          <div>
            <h2 className="font-black">
              Pindah Dana Komisi Real
            </h2>

            <p className="mt-1 text-sm">
              Pindahkan Komisi Real dari akun
              TikTok ke rekening bank. Setelah
              berhasil, dana bersih akan tercatat
              sebagai uang masuk Kas & Bank.
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================
          FORM
      ======================================================== */}

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

        {/* AKUN TIKTOK */}
        <label className="text-sm font-bold">
          Akun TikTok

          <select
            required
            value={form.accountId}
            onChange={(event) =>
              handleAccountChange(
                event.target.value
              )
            }
            className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white p-2.5"
          >
            <option value="">
              Pilih akun TikTok
            </option>

            {accounts.map((account) => (
              <option
                key={account.id}
                value={account.id}
              >
                {account.name} •{' '}
                {account.scope}
              </option>
            ))}
          </select>
        </label>

        {/* SCOPE OTOMATIS */}
        <label className="text-sm font-bold">
          Scope

          <div className="mt-1.5 rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 font-semibold text-zinc-600">
            {selectedAccount?.scope ||
              form.scope}
          </div>
        </label>

        {/* REKENING TUJUAN */}
        <label className="text-sm font-bold">
          Rekening Bank Tujuan

          <input
            required
            value={form.toAccount}
            onChange={(event) =>
              setForm({
                ...form,
                toAccount:
                  event.target.value,
              })
            }
            placeholder="Contoh: BCA PT KDRT 123456"
            className="mt-1.5 w-full rounded-xl border border-zinc-300 p-2.5"
          />
        </label>

        {/* ======================================================
            COMMISSION SUMMARY
        ====================================================== */}

        {form.accountId && (
          <div className="md:col-span-2 grid gap-3 sm:grid-cols-3">

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-zinc-500">
                <Wallet className="h-4 w-4" />

                Total Komisi Real
              </div>

              <p className="mt-1 text-lg font-black text-zinc-900">
                {formatRupiah(
                  accountCommission
                )}
              </p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-amber-700">
                <ArrowRightLeft className="h-4 w-4" />

                Tersedia Dicairkan
              </div>

              <p className="mt-1 text-lg font-black text-amber-950">
                {loadingAvailable
                  ? 'MEMUAT...'
                  : formatRupiah(
                      availableCommission
                    )}
              </p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />

                Siap Dicairkan
              </div>

              <p className="mt-1 text-lg font-black text-emerald-950">
                {formatRupiah(
                  availableCommission
                )}
              </p>
            </div>

          </div>
        )}

        {/* KOMISI REAL */}
        <label className="text-sm font-bold">
          Komisi Real yang Dicairkan

          <CurrencyInput
            required
            value={form.grossAmount}
            onChange={(grossAmount) =>
              setForm({
                ...form,
                grossAmount,
              })
            }
            className="mt-1.5 w-full rounded-xl border border-zinc-300 p-2.5"
          />

          {exceedsAvailable && (
            <span className="mt-1 block text-xs font-bold text-rose-600">
              Nominal melebihi Komisi Real
              yang tersedia.
            </span>
          )}
        </label>

        {/* ADMIN */}
        <label className="text-sm font-bold">
          Admin TikTok

          <CurrencyInput
            value={form.adminFee}
            onChange={(adminFee) =>
              setForm({
                ...form,
                adminFee,
              })
            }
            className="mt-1.5 w-full rounded-xl border border-zinc-300 p-2.5"
          />
        </label>

        {/* DANA BERSIH */}
        <div className="rounded-xl bg-emerald-50 p-4">
          <span className="text-xs font-bold uppercase text-emerald-700">
            Dana Bersih Masuk Rekening
          </span>

          <p className="mt-1 text-xl font-black text-emerald-900">
            {formatRupiah(netAmount)}
          </p>

          <p className="mt-1 text-[11px] font-medium text-emerald-700">
            Komisi Real − Admin TikTok
          </p>
        </div>

        {/* KETERANGAN */}
        <label className="text-sm font-bold">
          Keterangan

          <input
            value={form.description}
            onChange={(event) =>
              setForm({
                ...form,
                description:
                  event.target.value,
              })
            }
            placeholder="Contoh: Pencairan periode Agustus"
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
            className="mt-1.5 w-full rounded-xl border border-zinc-300 p-2.5"
          />
        </label>

        {/* NOTICE */}
        {notice && (
          <div
            className={`md:col-span-2 flex items-start gap-2 rounded-xl p-3 text-sm font-semibold ${
              noticeType === 'success'
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border border-rose-200 bg-rose-50 text-rose-800'
            }`}
          >
            {noticeType === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}

            <span>{notice}</span>
          </div>
        )}

        {/* SUBMIT */}
        <button
          type="submit"
          disabled={!canSubmit}
          className="md:col-span-2 flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ArrowRightLeft className="h-4 w-4" />

          {saving
            ? 'MENYIMPAN...'
            : loadingAvailable
              ? 'MEMERIKSA SALDO...'
              : exceedsAvailable
                ? 'SALDO TIDAK MENCUKUPI'
                : 'SIMPAN PINDAH DANA'}
        </button>
      </form>

      {/* ========================================================
          HISTORY
      ======================================================== */}

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">

        <div className="flex items-center gap-2 border-b border-zinc-200 p-5">
          <Landmark className="h-5 w-5 text-indigo-600" />

          <div>
            <h3 className="font-black">
              Riwayat Pindah Dana
            </h3>

            <p className="text-xs text-zinc-500">
              Dana yang sudah dipindahkan ke
              rekening bank.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">

            <thead className="bg-zinc-50 text-xs">
              <tr>
                <th className="p-4">
                  Tanggal
                </th>

                <th className="p-4">
                  Akun TikTok
                </th>

                <th className="p-4">
                  Rekening
                </th>

                <th className="p-4">
                  Komisi
                </th>

                <th className="p-4">
                  Admin
                </th>

                <th className="p-4">
                  Diterima
                </th>
              </tr>
            </thead>

            <tbody>
              {history.map((tx) => (
                <tr
                  key={tx.id}
                  className="border-t border-zinc-100 hover:bg-zinc-50"
                >
                  <td className="p-4">
                    {formatTanggal(
                      tx.date
                    )}
                  </td>

                  <td className="p-4">
                    <div className="font-bold text-zinc-900">
                      {tx.accountName ||
                        tx.fromAccount ||
                        '-'}
                    </div>

                    <div className="text-[10px] font-semibold text-zinc-400">
                      {tx.scope}
                    </div>
                  </td>

                  <td className="p-4 font-semibold text-zinc-700">
                    {tx.toAccount || '-'}
                  </td>

                  <td className="p-4">
                    {formatRupiah(
                      Number(
                        tx.amount || 0
                      )
                    )}
                  </td>

                  <td className="p-4 text-rose-600">
                    {formatRupiah(
                      Number(
                        tx.adminFee || 0
                      )
                    )}
                  </td>

                  <td className="p-4 font-black text-emerald-700">
                    {formatRupiah(
                      Number(
                        tx.netAmount ||
                          0
                      )
                    )}
                  </td>
                </tr>
              ))}

              {history.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="p-8 text-center text-zinc-400"
                  >
                    Belum ada pencairan dana.
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
