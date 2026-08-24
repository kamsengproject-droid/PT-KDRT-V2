import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { subscribeTransactions, createFinancialTransaction as addTransaction, deleteTransaction } from '../services/transactionService';
import { FinancialTransaction } from '../types';
import { formatRupiah, formatTanggal } from '../utils/formatters';
import { CurrencyInput } from '../components/CurrencyInput';
import { Plus, CheckCircle2, AlertTriangle, Scale, Trash2, Wallet } from 'lucide-react';

export const SaldoAwalPage: React.FC = () => {
  const { role, userProfile, currentUser } = useAuth();
  const isOwner = role === 'OWNER';
  
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const [formData, setFormData] = useState({
    date: '2026-07-31',
    scope: 'SHARING',
    accountName: '',
    amount: '' as number | '',
    notes: 'Saldo awal saat pembukuan KANTOR PT.KDRT mulai digunakan.',
  });

  useEffect(() => {
    const unsub = subscribeTransactions(undefined, (data) => {
      setTransactions(data.filter(t => t.sourceType === 'OPENING_BALANCE'));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) return;
    
    if (!formData.amount || formData.amount <= 0) {
      setErrorMsg('Nominal harus lebih dari 0');
      return;
    }
    if (!formData.accountName.trim()) {
      setErrorMsg('Sumber dana / rekening wajib diisi');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    
    try {
      const uid = userProfile?.uid || currentUser?.uid || 'system';
      const name = userProfile?.name || currentUser?.displayName || 'Owner';
      
      const referenceId = `OPENING_BALANCE_${formData.scope}_${formData.accountName.replace(/\s+/g, '_').toUpperCase()}_${formData.date.replace(/-/g, '')}`;
      
      const existing = transactions.find(t => t.referenceId === referenceId && t.status === 'ACTIVE');
      if (existing) {
        throw new Error('Saldo awal untuk Scope, Rekening, dan Tanggal ini sudah tercatat.');
      }

      const tx: any = {
        type: 'INCOME',
        sourceType: 'OPENING_BALANCE',
        amount: Number(formData.amount),
        date: formData.date,
        category: 'Saldo Awal',
        scope: formData.scope as any,
        accountName: formData.accountName,
        description: formData.notes,
        notes: formData.notes,
        referenceId
      };
      
      await addTransaction(tx, uid, name);
      
      setSuccessMsg('Saldo Awal berhasil disimpan.');
      setIsModalOpen(false);
      setFormData({
        date: '2026-07-31',
        scope: 'SHARING',
        accountName: '',
        amount: '',
        notes: 'Saldo awal saat pembukuan KANTOR PT.KDRT mulai digunakan.',
      });
      
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoid = async (tx: FinancialTransaction) => {
    if (!isOwner) return;
    if (!window.confirm('Batalkan / hapus saldo awal ini?')) return;
    
    try {
      const uid = userProfile?.uid || currentUser?.uid || 'system';
      const name = userProfile?.name || currentUser?.displayName || 'Owner';
      await deleteTransaction(tx.id!, tx, 'Dihapus oleh Owner (Saldo Awal)', uid, name);
      setSuccessMsg('Saldo awal dibatalkan.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Gagal membatalkan');
    }
  };

  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-zinc-500">
        <Scale className="h-12 w-12 mb-4 text-zinc-300" />
        <p>Anda tidak memiliki akses ke pengaturan Saldo Awal.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white shadow-lg animate-fade-in">
          <CheckCircle2 className="h-4 w-4" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs">
        <div>
          <h2 className="text-lg font-black text-zinc-900 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-indigo-600" />
            Pengaturan Saldo Awal (Cut-off)
          </h2>
          <p className="text-sm text-zinc-500 mt-1">
            Tentukan posisi kas awal saat perusahaan mulai menggunakan aplikasi (Disarankan: 31 Juli 2026).
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-xs font-bold text-white transition-colors"
        >
          <Plus className="h-4 w-4" />
          Set Saldo Awal
        </button>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-2xs">
        <table className="w-full text-left text-xs text-zinc-600">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="px-5 py-3 font-extrabold text-zinc-900">Tanggal</th>
              <th className="px-5 py-3 font-extrabold text-zinc-900">Scope</th>
              <th className="px-5 py-3 font-extrabold text-zinc-900">Rekening / Sumber</th>
              <th className="px-5 py-3 font-extrabold text-zinc-900">Nominal</th>
              <th className="px-5 py-3 font-extrabold text-zinc-900">Catatan</th>
              <th className="px-5 py-3 font-extrabold text-zinc-900">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading ? (
              <tr><td colSpan={6} className="p-4 text-center">Loading...</td></tr>
            ) : transactions.length === 0 ? (
              <tr><td colSpan={6} className="p-4 text-center">Belum ada data saldo awal.</td></tr>
            ) : (
              transactions.map(tx => (
                <tr key={tx.id} className={tx.status === "VOID" ? 'bg-zinc-50/50 opacity-60' : ''}>
                  <td className="px-5 py-3.5 whitespace-nowrap font-medium">{formatTanggal(tx.date)}</td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black ${tx.scope === 'SHARING' ? 'bg-indigo-100 text-indigo-700' : 'bg-rose-100 text-rose-700'}`}>
                      {tx.scope}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-bold">{tx.accountName}</td>
                  <td className="px-5 py-3.5 font-black text-zinc-900">{formatRupiah(tx.amount)}</td>
                  <td className="px-5 py-3.5">{tx.notes}</td>
                  <td className="px-5 py-3.5">
                    {tx.status === 'ACTIVE' ? (
                      <button onClick={() => handleVoid(tx)} className="text-rose-600 hover:text-rose-500 p-1">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <span className="text-[10px] font-bold text-rose-600 border border-rose-200 bg-rose-50 px-2 py-0.5 rounded-full">DIBATALKAN</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-zinc-200 space-y-4">
            <h3 className="text-base font-black text-zinc-900">Set Saldo Awal (Cut-off)</h3>
            
            {errorMsg && (
              <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-zinc-700 mb-1 text-xs">Tanggal Efektif</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full rounded-xl border border-zinc-300 p-2 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 mb-1 text-xs">Scope</label>
                  <select
                    value={formData.scope}
                    onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                    className="w-full rounded-xl border border-zinc-300 p-2 text-xs font-bold"
                  >
                    <option value="SHARING">SHARING</option>
                    <option value="PRIBADI">PRIBADI</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block font-bold text-zinc-700 mb-1 text-xs">Sumber Dana / Rekening</label>
                <input
                  type="text"
                  required
                  placeholder="Misal: BCA Bisnis"
                  value={formData.accountName}
                  onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                  className="w-full rounded-xl border border-zinc-300 p-2.5 font-medium text-xs"
                />
              </div>

              <div>
                <label className="block font-extrabold text-zinc-800 mb-1 text-xs">Nominal Saldo Awal (Rp)</label>
                <CurrencyInput
                  required
                  value={formData.amount}
                  onChange={(val) => setFormData({ ...formData, amount: val })}
                  className="w-full rounded-xl border-2 border-indigo-200 bg-indigo-50/50 p-2.5 font-black text-indigo-900 text-lg"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1 text-xs">Catatan</label>
                <textarea
                  rows={2}
                  required
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-zinc-500 hover:bg-zinc-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2 text-xs font-black text-white shadow-md"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Saldo Awal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
