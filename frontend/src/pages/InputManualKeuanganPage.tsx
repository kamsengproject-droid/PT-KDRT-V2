import React, { useEffect, useState } from 'react';
import { CheckCircle2, Lock, PencilLine } from 'lucide-react';
import { CurrencyInput } from '../components/CurrencyInput';
import { useAuth } from '../context/AuthContext';
import { FinancialTransaction, PaymentMethod, ScopeType, TransactionType } from '../types';
import { createFinancialTransaction, subscribeTransactions } from '../services/transactionService';
import { formatRupiah, formatTanggal, tanggalHariIni } from '../utils/formatters';

const INCOME_CATEGORIES = ['ENDORSE', 'SPONSOR', 'JASA', 'PENJUALAN', 'LAINNYA'];
const EXPENSE_CATEGORIES = ['OPERASIONAL', 'GAJI', 'LISTRIK', 'INTERNET', 'TRANSPORTASI', 'IKLAN', 'SEWA', 'LAINNYA'];

export const InputManualKeuanganPage: React.FC = () => {
  const { role, currentUser, userProfile } = useAuth();
  const [items, setItems] = useState<FinancialTransaction[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({
    date: tanggalHariIni(), type: 'INCOME' as Extract<TransactionType, 'INCOME' | 'EXPENSE'>,
    category: 'LAINNYA', scope: 'SHARING' as ScopeType, amount: '' as number | '',
    paymentMethod: 'TRANSFER' as PaymentMethod, description: '', notes: '',
  });

  useEffect(() => subscribeTransactions({ sourceType: 'MANUAL' }, setItems), []);
  if (role !== 'OWNER') return <div className="p-8 text-center text-zinc-500"><Lock className="mx-auto mb-3 h-10 w-10" />Input manual keuangan hanya dapat digunakan oleh Owner.</div>;
  const categories = form.type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser || !userProfile) return;
    if (!form.description.trim()) return setNotice('Keterangan transaksi wajib diisi.');
    setSaving(true); setNotice('');
    try {
      const result = await createFinancialTransaction({
        type: form.type, amount: Number(form.amount), date: form.date, category: form.category,
        scope: form.scope, sourceType: 'MANUAL', paymentMethod: form.paymentMethod,
        description: form.description.trim(), notes: form.notes.trim(), createdBy: currentUser.uid,
        createdByName: userProfile.name,
      }, currentUser.uid, userProfile.name);
      if (!result.success) throw new Error(result.message);
      setNotice('Transaksi manual berhasil disimpan.');
      setForm({ date: tanggalHariIni(), type: 'INCOME', category: 'LAINNYA', scope: 'SHARING', amount: '', paymentMethod: 'TRANSFER', description: '', notes: '' });
    } catch (error: any) { setNotice(error.message || 'Gagal menyimpan transaksi.'); }
    finally { setSaving(false); }
  };
  const changeType = (type: Extract<TransactionType, 'INCOME' | 'EXPENSE'>) => setForm({ ...form, type, category: 'LAINNYA' });

  return <div className="mx-auto max-w-5xl space-y-6">
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950"><div className="flex gap-3"><PencilLine className="mt-0.5 h-5 w-5" /><div><h2 className="font-black">Input Manual Keuangan</h2><p className="mt-1 text-sm">Untuk uang masuk atau keluar yang tidak berasal dari modul otomatis. Komisi Real TikTok tidak tersedia di sini agar tetap sama dengan dashboard akun.</p></div></div></div>
    <form onSubmit={submit} className="grid gap-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm md:grid-cols-2">
      <label className="text-sm font-bold">Tanggal<input required type="date" value={form.date} onChange={e => setForm({...form, date:e.target.value})} className="mt-1.5 w-full rounded-xl border border-zinc-300 p-2.5" /></label>
      <div><span className="text-sm font-bold">Jenis</span><div className="mt-1.5 grid grid-cols-2 gap-2"><button type="button" onClick={() => changeType('INCOME')} className={`rounded-xl p-2.5 text-sm font-bold ${form.type === 'INCOME' ? 'bg-emerald-600 text-white' : 'bg-zinc-100 text-zinc-600'}`}>Uang Masuk</button><button type="button" onClick={() => changeType('EXPENSE')} className={`rounded-xl p-2.5 text-sm font-bold ${form.type === 'EXPENSE' ? 'bg-rose-600 text-white' : 'bg-zinc-100 text-zinc-600'}`}>Uang Keluar</button></div></div>
      <label className="text-sm font-bold">Kategori<select value={form.category} onChange={e => setForm({...form, category:e.target.value})} className="mt-1.5 w-full rounded-xl border border-zinc-300 p-2.5">{categories.map(category => <option key={category}>{category}</option>)}</select></label>
      <label className="text-sm font-bold">Scope<select value={form.scope} onChange={e => setForm({...form, scope:e.target.value as ScopeType})} className="mt-1.5 w-full rounded-xl border border-zinc-300 p-2.5"><option value="SHARING">SHARING</option><option value="PRIBADI">PRIBADI</option></select></label>
      <label className="text-sm font-bold">Nominal<CurrencyInput required value={form.amount} onChange={amount => setForm({...form, amount})} className="mt-1.5 w-full rounded-xl border border-zinc-300 p-2.5" /></label>
      <label className="text-sm font-bold">Metode pembayaran<select value={form.paymentMethod} onChange={e => setForm({...form, paymentMethod:e.target.value as PaymentMethod})} className="mt-1.5 w-full rounded-xl border border-zinc-300 p-2.5"><option value="TRANSFER">Transfer</option><option value="CASH">Kas</option><option value="EWALLET">E-Wallet</option><option value="LAINNYA">Lainnya</option></select></label>
      <label className="text-sm font-bold md:col-span-2">Keterangan<input required value={form.description} onChange={e => setForm({...form, description:e.target.value})} placeholder="Contoh: pembayaran jasa desain" className="mt-1.5 w-full rounded-xl border border-zinc-300 p-2.5" /></label>
      <label className="text-sm font-bold md:col-span-2">Catatan<textarea value={form.notes} onChange={e => setForm({...form, notes:e.target.value})} rows={2} className="mt-1.5 w-full rounded-xl border border-zinc-300 p-2.5" /></label>
      {notice && <p className="md:col-span-2 text-sm font-semibold text-amber-700">{notice}</p>}
      <button disabled={saving} className="md:col-span-2 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{saving ? 'MENYIMPAN...' : 'SIMPAN TRANSAKSI MANUAL'}</button>
    </form>
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"><div className="flex items-center gap-2 border-b p-5"><CheckCircle2 className="h-5 w-5 text-amber-600" /><h3 className="font-black">Riwayat Input Manual</h3></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-zinc-50 text-xs"><tr><th className="p-4">Tanggal</th><th className="p-4">Jenis</th><th className="p-4">Kategori</th><th className="p-4">Scope</th><th className="p-4">Nominal</th></tr></thead><tbody>{items.map(tx => <tr key={tx.id} className="border-t"><td className="p-4">{formatTanggal(tx.date)}</td><td className="p-4">{tx.type === 'INCOME' ? 'Masuk' : 'Keluar'}</td><td className="p-4">{tx.category}</td><td className="p-4">{tx.scope}</td><td className={`p-4 font-black ${tx.type === 'INCOME' ? 'text-emerald-700' : 'text-rose-700'}`}>{formatRupiah(tx.amount)}</td></tr>)}{items.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-zinc-400">Belum ada transaksi manual.</td></tr>}</tbody></table></div></section>
  </div>;
};
