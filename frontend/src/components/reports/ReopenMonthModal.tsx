import React, { useState } from 'react';
import { X, Unlock, AlertTriangle, Loader2 } from 'lucide-react';
import { MonthlyClosing, UserProfile } from '../../types';
import { reopenMonth } from '../../services/closingService';

interface ReopenMonthModalProps {
  closing: MonthlyClosing;
  onClose: () => void;
  onSuccess: () => void;
  userProfile: UserProfile;
}

export const ReopenMonthModal: React.FC<ReopenMonthModalProps> = ({
  closing,
  onClose,
  onSuccess,
  userProfile,
}) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Wajib menyertakan alasan pembukaan kembali buku bulan ini.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await reopenMonth(closing.closingId, reason.trim(), userProfile);
      alert(`Buku bulan ${closing.period} (${closing.scope}) berhasil dibuka kembali.`);
      onSuccess();
    } catch (err: any) {
      console.error('Reopen error:', err);
      setError(err.message || 'Gagal membuka kembali bulan.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-amber-50">
          <div className="flex items-center gap-2.5 text-amber-900">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
              <Unlock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider">
                Buka Kembali Buku Bulan
              </h3>
              <p className="text-xs text-amber-700 font-medium">
                {closing.period} • Scope {closing.scope}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <div>
              <span className="font-bold">Peringatan Audit:</span> Membuka kembali bulan yang sudah ditutup akan dicatat ke dalam log audit permanen sistem.
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Alasan Pembukaan Kembali <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Perlu revisi komisi affiliate yang belum tercatat atau penyesuaian bukti transaksi..."
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 focus:outline-none"
            />
          </div>

          {error && (
            <div className="text-xs text-rose-600 font-bold bg-rose-50 p-2 rounded-lg border border-rose-200">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 text-xs font-black text-white hover:bg-amber-700 transition-colors shadow-2xs disabled:opacity-50"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Konfirmasi Buka Kembali</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
