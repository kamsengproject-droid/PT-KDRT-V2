import React, { useState } from 'react';
import { X, SlidersHorizontal, AlertCircle, Loader2 } from 'lucide-react';
import { UserProfile, ScopeType } from '../../types';
import { createFinancialAdjustment } from '../../services/closingService';

interface FinancialAdjustmentModalProps {
  period: string; // e.g. "2026-08"
  scope: ScopeType;
  onClose: () => void;
  onSuccess: () => void;
  userProfile: UserProfile;
}

export const FinancialAdjustmentModal: React.FC<FinancialAdjustmentModalProps> = ({
  period,
  scope,
  onClose,
  onSuccess,
  userProfile,
}) => {
  const [type, setType] = useState<'INCOME_ADJUSTMENT' | 'EXPENSE_ADJUSTMENT'>('EXPENSE_ADJUSTMENT');
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState('OPERASIONAL');
  const [sourceType, setSourceType] = useState('LAINNYA');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) {
      setError('Nominal adjustment harus lebih besar dari 0.');
      return;
    }
    if (!reason.trim()) {
      setError('Alasan penyesuaian wajib dicantumkan.');
      return;
    }
    if (!description.trim()) {
      setError('Deskripsi adjustment wajib diisi.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await createFinancialAdjustment(
        {
          period,
          scope,
          type,
          amount: Number(amount),
          description: description.trim(),
          reason: reason.trim(),
          category,
          sourceType,
        },
        userProfile
      );

      alert(`Adjustment keuangan periode ${period} berhasil disimpan.`);
      onSuccess();
    } catch (err: any) {
      console.error('Adjustment error:', err);
      setError(err.message || 'Gagal menyimpan adjustment.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-600 text-white">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider">
                Input Financial Adjustment
              </h3>
              <p className="text-xs text-slate-300">
                Periode Buku: <span className="font-bold text-white">{period}</span> • Scope: <span className="font-bold text-white">{scope}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-amber-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              Prosedur koreksi resmi untuk periode buku yang telah ditutup (CLOSED). Seluruh adjustment akan tercatat di log audit dan buku besar transaksi.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Tipe Adjustment</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full rounded-xl border border-slate-300 p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-100"
              >
                <option value="EXPENSE_ADJUSTMENT">Koreksi Pengeluaran (Beban)</option>
                <option value="INCOME_ADJUSTMENT">Koreksi Uang Masuk (Pendapatan)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Nominal (Rp) *</label>
              <input
                type="number"
                required
                min={1}
                value={amount || ''}
                onChange={(e) => setAmount(Number(e.target.value))}
                placeholder="0"
                className="w-full rounded-xl border border-slate-300 p-2 text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Deskripsi Adjustment *</label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: Koreksi selisih ongkir klaim retur sampel TikTok Shop"
              className="w-full rounded-xl border border-slate-300 p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-100"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Alasan Penyesuaian (Audit Trail) *</label>
            <textarea
              required
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Jelaskan dasar pertimbangan atau dokumen bukti adjustment..."
              className="w-full rounded-xl border border-slate-300 p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-100"
            />
          </div>

          {error && (
            <div className="p-2 rounded-lg bg-rose-50 text-rose-600 font-bold border border-rose-200">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 font-black text-white hover:bg-orange-700 transition-colors shadow-2xs disabled:opacity-50"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Simpan Adjustment</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
