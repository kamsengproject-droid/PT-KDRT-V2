import React, { useState } from 'react';
import {
  Layers,
  Plus,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Edit2,
  X,
  ShieldCheck,
  Percent,
  Sparkles,
} from 'lucide-react';
import { ProfitSharingTier } from '../../types';
import {
  saveProfitSharingTier,
  resetProfitSharingTiersToDefault,
} from '../../services/profitSharingService';
import { formatRupiah } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';

interface TierConfigManagerProps {
  tiers: ProfitSharingTier[];
  onRefresh?: () => void;
}

export const TierConfigManager: React.FC<TierConfigManagerProps> = ({
  tiers,
  onRefresh,
}) => {
  const { userProfile, role } = useAuth();
  const isOwner = role === 'OWNER';

  const [editingTier, setEditingTier] = useState<Partial<ProfitSharingTier> | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [resetting, setResetting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Open edit modal
  const handleOpenEdit = (tier: ProfitSharingTier) => {
    setEditingTier({ ...tier });
    setErrorMsg(null);
  };

  // Open add new modal
  const handleOpenAdd = () => {
    setEditingTier({
      name: 'Tier Baru',
      minIncome: 0,
      maxIncome: null,
      investorPercentage: 45,
      ownerPercentage: 45,
      talentPercentage: 5,
      editorPercentage: 5,
      companyBudgetPercentage: 0,
      description: '',
      isActive: true,
    });
    setErrorMsg(null);
  };

  // Calculate live sum for modal
  const currentModalTotal =
    editingTier
      ? (Number(editingTier.investorPercentage) || 0) +
        (Number(editingTier.ownerPercentage) || 0) +
        (Number(editingTier.talentPercentage) || 0) +
        (Number(editingTier.editorPercentage) || 0) +
        (Number(editingTier.companyBudgetPercentage) || 0)
      : 0;

  // Save tier
  const handleSaveTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTier || !userProfile) return;

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await saveProfitSharingTier(editingTier, userProfile);
      setSuccessMsg(`Konfigurasi tier "${editingTier.name}" berhasil disimpan.`);
      setEditingTier(null);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan konfigurasi tier.');
    } finally {
      setSaving(false);
    }
  };

  // Reset to default
  const handleResetToDefault = async () => {
    if (!userProfile) return;
    if (
      !window.confirm(
        'Apakah Anda yakin ingin mereset seluruh konfigurasi tier ke aturan baku bawaan PT.KDRT?'
      )
    ) {
      return;
    }

    setResetting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await resetProfitSharingTiersToDefault(userProfile);
      setSuccessMsg('Konfigurasi tier berhasil direset ke aturan baku bawaan.');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mereset tier.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-purple-50 text-purple-700 border border-purple-200">
                PENGATURAN OWNER
              </span>
              <span className="text-xs text-zinc-400 font-bold">KANTOR PT.KDRT</span>
            </div>
            <h3 className="text-lg font-black text-zinc-900 tracking-tight mt-1 flex items-center gap-2">
              <Layers className="h-5 w-5 text-purple-600" />
              Konfigurasi Tier & Persentase Profit Sharing
            </h3>
            <p className="text-xs text-zinc-500 max-w-3xl leading-relaxed mt-0.5">
              Aturan pembagian hasil kategori Sharing berdasarkan ambang batas Uang Masuk Nyata bulanan. Jika persentase tier lebih dari 100%, sistem akan menandai <strong>PERLU PENYESUAIAN</strong> dan menolak approval settlement sampai disesuaikan oleh Owner.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isOwner && (
              <>
                <button
                  onClick={handleResetToDefault}
                  disabled={resetting}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 px-3.5 py-2 text-xs font-bold text-zinc-700 transition-colors disabled:opacity-50"
                  title="Kembalikan ke formula awal"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-zinc-500" />
                  <span>Reset Default</span>
                </button>

                <button
                  onClick={handleOpenAdd}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 text-xs font-black shadow-xs transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Tambah Tier Kustom</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Alert Notices */}
      {errorMsg && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-800 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tier Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tiers.map((tier, idx) => {
          const totalPct =
            (tier.investorPercentage || 0) +
            (tier.ownerPercentage || 0) +
            (tier.talentPercentage || 0) +
            (tier.editorPercentage || 0) +
            (tier.companyBudgetPercentage || 0);

          const isValid = totalPct === 100;

          return (
            <div
              key={tier.id || tier.tierId || idx}
              className={`rounded-2xl border p-5 shadow-2xs flex flex-col justify-between transition-all ${
                isValid
                  ? 'bg-white border-zinc-200'
                  : 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-300'
              }`}
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-2 border-b border-zinc-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-zinc-900">{tier.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          isValid
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {isValid ? 'VALID (100%)' : `PERLU PENYESUAIAN (${totalPct}%)`}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-purple-700 mt-1 block">
                      {tier.maxIncome !== null && tier.maxIncome !== undefined
                        ? `${formatRupiah(tier.minIncome)} s/d ${formatRupiah(tier.maxIncome)}`
                        : `>= ${formatRupiah(tier.minIncome)} (Tanpa Batas Atas)`}
                    </span>
                  </div>

                  {isOwner && (
                    <button
                      onClick={() => handleOpenEdit(tier)}
                      className="p-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-700 transition-colors"
                      title="Edit Tier"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* 5 Pillars Percentages */}
                <div className="grid grid-cols-5 gap-2 py-4 text-center">
                  <div className="p-2 bg-blue-50/80 rounded-xl border border-blue-100">
                    <span className="text-[10px] font-black text-blue-800 uppercase block">
                      Investor
                    </span>
                    <span className="text-sm font-black text-blue-950 mt-0.5 block">
                      {tier.investorPercentage}%
                    </span>
                  </div>

                  <div className="p-2 bg-purple-50/80 rounded-xl border border-purple-100">
                    <span className="text-[10px] font-black text-purple-800 uppercase block">
                      Owner
                    </span>
                    <span className="text-sm font-black text-purple-950 mt-0.5 block">
                      {tier.ownerPercentage}%
                    </span>
                  </div>

                  <div className="p-2 bg-emerald-50/80 rounded-xl border border-emerald-100">
                    <span className="text-[10px] font-black text-emerald-800 uppercase block">
                      Talent
                    </span>
                    <span className="text-sm font-black text-emerald-950 mt-0.5 block">
                      {tier.talentPercentage}%
                    </span>
                  </div>

                  <div className="p-2 bg-amber-50/80 rounded-xl border border-amber-100">
                    <span className="text-[10px] font-black text-amber-800 uppercase block">
                      Editor
                    </span>
                    <span className="text-sm font-black text-amber-950 mt-0.5 block">
                      {tier.editorPercentage}%
                    </span>
                  </div>

                  <div className="p-2 bg-zinc-100 rounded-xl border border-zinc-200">
                    <span className="text-[10px] font-black text-zinc-700 uppercase block">
                      Budget
                    </span>
                    <span className="text-sm font-black text-zinc-900 mt-0.5 block">
                      {tier.companyBudgetPercentage}%
                    </span>
                  </div>
                </div>

                {tier.description && (
                  <p className="text-xs text-zinc-500 italic mt-1 leading-relaxed">
                    {tier.description}
                  </p>
                )}
              </div>

              {!isValid && (
                <div className="mt-3 p-2.5 bg-rose-50 rounded-xl border border-rose-200 text-[11px] text-rose-800 font-medium">
                  ⚠️ Total persentase saat ini adalah <strong>{totalPct}%</strong>. Ketika uang masuk mencapai rentang ini, Owner perlu menyesuaikan persentase di halaman kalkulator sebelum menyetujui settlement.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit Tier Modal */}
      {editingTier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl border border-zinc-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                  EDITOR KONFIGURASI TIER
                </span>
                <h3 className="text-base font-black text-zinc-900 mt-1">
                  {editingTier.id ? 'Edit Tier Bagi Hasil' : 'Tambah Tier Baru'}
                </h3>
              </div>
              <button
                onClick={() => setEditingTier(null)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTier} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-zinc-700 block mb-1">Nama Tier: *</label>
                <input
                  type="text"
                  value={editingTier.name || ''}
                  onChange={(e) => setEditingTier({ ...editingTier, name: e.target.value })}
                  required
                  placeholder="Contoh: Tier Prestasi (>= 50M)"
                  className="w-full rounded-xl border border-zinc-300 p-2.5 font-bold text-zinc-800"
                />
              </div>

              {/* Rentang Omset */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-zinc-700 block mb-1">
                    Minimal Uang Masuk (Rp): *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editingTier.minIncome ?? 0}
                    onChange={(e) =>
                      setEditingTier({ ...editingTier, minIncome: Number(e.target.value) })
                    }
                    required
                    className="w-full rounded-xl border border-zinc-300 p-2.5 font-bold text-zinc-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-zinc-700 block mb-1">
                    Maksimal Uang Masuk (Rp):
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Kosongkan jika tanpa batas atas"
                    value={
                      editingTier.maxIncome !== null && editingTier.maxIncome !== undefined
                        ? editingTier.maxIncome
                        : ''
                    }
                    onChange={(e) =>
                      setEditingTier({
                        ...editingTier,
                        maxIncome: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="w-full rounded-xl border border-zinc-300 p-2.5 font-medium text-zinc-800"
                  />
                </div>
              </div>

              {/* 5 Persentase Form */}
              <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-black uppercase text-zinc-800">
                    Alokasi Persentase (5 Pilar)
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-black ${
                      currentModalTotal === 100
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    Total: {currentModalTotal}% {currentModalTotal === 100 ? '✓' : '⚠️'}
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-blue-800 block mb-1">
                      Investor (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editingTier.investorPercentage ?? 0}
                      onChange={(e) =>
                        setEditingTier({
                          ...editingTier,
                          investorPercentage: Number(e.target.value),
                        })
                      }
                      className="w-full rounded-lg border border-zinc-300 p-2 font-bold text-center text-blue-900"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-purple-800 block mb-1">
                      Owner (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editingTier.ownerPercentage ?? 0}
                      onChange={(e) =>
                        setEditingTier({
                          ...editingTier,
                          ownerPercentage: Number(e.target.value),
                        })
                      }
                      className="w-full rounded-lg border border-zinc-300 p-2 font-bold text-center text-purple-900"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-emerald-800 block mb-1">
                      Talent (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editingTier.talentPercentage ?? 0}
                      onChange={(e) =>
                        setEditingTier({
                          ...editingTier,
                          talentPercentage: Number(e.target.value),
                        })
                      }
                      className="w-full rounded-lg border border-zinc-300 p-2 font-bold text-center text-emerald-900"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-amber-800 block mb-1">
                      Editor (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editingTier.editorPercentage ?? 0}
                      onChange={(e) =>
                        setEditingTier({
                          ...editingTier,
                          editorPercentage: Number(e.target.value),
                        })
                      }
                      className="w-full rounded-lg border border-zinc-300 p-2 font-bold text-center text-amber-900"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-zinc-700 block mb-1">
                      Budget (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editingTier.companyBudgetPercentage ?? 0}
                      onChange={(e) =>
                        setEditingTier({
                          ...editingTier,
                          companyBudgetPercentage: Number(e.target.value),
                        })
                      }
                      className="w-full rounded-lg border border-zinc-300 p-2 font-bold text-center text-zinc-900"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="font-bold text-zinc-700 block mb-1">
                  Deskripsi / Catatan Aturan:
                </label>
                <textarea
                  value={editingTier.description || ''}
                  onChange={(e) =>
                    setEditingTier({ ...editingTier, description: e.target.value })
                  }
                  rows={2}
                  placeholder="Keterangan aturan tier ini..."
                  className="w-full rounded-xl border border-zinc-300 p-2.5 font-medium text-zinc-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setEditingTier(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-700 text-white shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{saving ? 'Menyimpan...' : 'Simpan Tier'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
