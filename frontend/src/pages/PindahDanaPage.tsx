import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Landmark, Lock } from 'lucide-react';
import { CurrencyInput } from '../components/CurrencyInput';
import { useAuth } from '../context/AuthContext';
import { FinancialTransaction, ScopeType } from '../types';
import { recordFundTransfer, subscribeTransactions } from '../services/transactionService';
import { formatRupiah, formatTanggal, tanggalHariIni } from '../utils/formatters';

export const PindahDanaPage: React.FC = () => {
  const { role, currentUser, userProfile } = useAuth();
  const [history, setHistory] = useState<FinancialTransaction[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({
    date: tanggalHariIni(), scope: 'SHARING' as ScopeType, grossAmount: '' as number | '',
    adminFee: '' as number | '', toAccount: '', description: '', notes: '',
  });

  useEffect(() => subscribeTransactions({ sourceType: 'FUND_TRANSFER' }, setHistory), []);

  const netAmount = useMemo(
    () => Math.max(0, (Number(form.grossAmount) || 0) - (Number(form.adminFee) || 0)),
    [form.grossAmount, form.adminFee]
  );

  if (role !== 'OWNER') return <div className="p-8 text-center text-zinc-500"><Lock className="mx-auto mb-3 h-10 w-10" />Pindah Dana hanya dapat dicatat oleh Owner.</div>;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser || !userProfile) return;
    setSaving(true); setNotice('');
    try {
      const result = await recordFundTransfer({
        ...form, grossAmount: Number(form.grossAmount), adminFee: Number(form.adminFee) || 0,
        fromAccount: 'Komisi Real TikTok',
      }, currentUser.uid, userProfile.name);
      if (!result.success) throw new Error(result.message);
      setNotice('Pindah dana berhasil dicatat. Ini tidak menambah uang masuk di Buku Kas.');
      setForm({ date: tanggalHariIni(), scope: 'SHARING', grossAmount: '', adminFee: '', toAccount: '', description: '', notes: '' });
    } catch (error: any) { setNotice(error.message || 'Pindah dana gagal disimpan.'); }
    finally { setSaving(false); }
  };

  return <div className="mx-auto max-w-5xl space-y-6">
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 text-indigo-950">
      <div className="flex gap-3"><ArrowRightLeft className="mt-0.5 h-5 w-5" /><div><h2 className="font-black">Pindah Dana Komisi Real</h2><p className="mt-1 text-sm">Pencairan dari Komisi Real TikTok ke rekening bank. Catatan ini bukan pemasukan baru dan tidak mengubah angka Komisi Real pada dashboard akun.</p></div></div>
    </div>
    <form onSubmit={submit} className="grid gap-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm md:grid-cols-2">
      <label className="text-sm font-bold">Tanggal<input required type="date" value={form.date} onChange={e => setForm({...form, date:e.target.value})} className="mt-1.5 w-full rounded-xl border border-zinc-300 p-2.5" /></label>
      <label className="text-sm font-bold">Scope<select value={form.scope} onChange={e => setForm({...form, scope:e.target.value as ScopeType})} className="mt-1.5 w-full rounded-xl border border-zinc-300 p-2.5"><option value="SHARING">SHARING</option><option value="PRIBADI">PRIBADI</option></select></label>
      <label className="text-sm font-bold">Dari<div className="mt-1.5 rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 font-semibold text-zinc-600">Komisi Real TikTok</div></label>
      <label className="text-sm font-bold">Ke rekening bank<input required value={form.toAccount} onChange={e => setForm({...form, toAccount:e.target.value})} placeholder="Contoh: BCA PT KDRT 123456" className="mt-1.5 w-full rounded-xl border border-zinc-300 p-2.5" /></label>
      <label className="text-sm font-bold">Komisi Real (bruto)<CurrencyInput required value={form.grossAmount} onChange={grossAmount => setForm({...form, grossAmount})} className="mt-1.5 w-full rounded-xl border border-zinc-300 p-2.5" /></label>
      <label className="text-sm font-bold">Admin TikTok<CurrencyInput value={form.adminFee} onChange={adminFee => setForm({...form, adminFee})} className="mt-1.5 w-full rounded-xl border border-zinc-300 p-2.5" /></label>
      <div className="rounded-xl bg-emerald-50 p-4"><span className="text-xs font-bold uppercase text-emerald-700">Dana bersih diterima</span><p className="mt-1 text-xl font-black text-emerald-900">{formatRupiah(netAmount)}</p></div>
      <label className="text-sm font-bold">Keterangan<input value={form.description} onChange={e => setForm({...form, description:e.target.value})} placeholder="Contoh: Pencairan periode Agustus" className="mt-1.5 w-full rounded-xl border border-zinc-300 p-2.5" /></label>
      <label className="text-sm font-bold md:col-span-2">Catatan<textarea value={form.notes} onChange={e => setForm({...form, notes:e.target.value})} rows={2} className="mt-1.5 w-full rounded-xl border border-zinc-300 p-2.5" /></label>
      {notice && <p className="md:col-span-2 text-sm font-semibold text-indigo-700">{notice}</p>}
      <button disabled={saving} className="md:col-span-2 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{saving ? 'MENYIMPAN...' : 'SIMPAN PINDAH DANA'}</button>
    </form>
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"><div className="flex items-center gap-2 border-b p-5"><Landmark className="h-5 w-5 text-indigo-600" /><h3 className="font-black">Riwayat Pindah Dana</h3></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-zinc-50 text-xs"><tr><th className="p-4">Tanggal</th><th className="p-4">Tujuan</th><th className="p-4">Komisi</th><th className="p-4">Admin</th><th className="p-4">Diterima</th></tr></thead><tbody>{history.map(tx => <tr key={tx.id} className="border-t"><td className="p-4">{formatTanggal(tx.date)}</td><td className="p-4 font-semibold">{tx.toAccount}</td><td className="p-4">{formatRupiah(tx.amount)}</td><td className="p-4 text-rose-600">{formatRupiah(tx.adminFee || 0)}</td><td className="p-4 font-black text-emerald-700">{formatRupiah(tx.netAmount || 0)}</td></tr>)}{history.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-zinc-400">Belum ada pencairan dana.</td></tr>}</tbody></table></div></section>
  </div>;
};
