import React, { useState, useEffect } from 'react';
import {
  Scale,
  Plus,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Clock,
  Calendar,
  Building2,
  DollarSign,
  ArrowRight,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  subscribeReconciliations,
  createReconciliation,
  subscribeTransactions,
} from '../../services/transactionService';
import {
  FinancialReconciliation,
  FinancialTransaction,
  ScopeType,
} from '../../types';
import {
  formatBulanTahun,
  formatRupiah,
  formatTanggal,
  tanggalHariIni,
  bulanHariIni,
} from '../../utils/formatters';

export const RekonsiliasiKas: React.FC = () => {
  const { userProfile, role, loading: authLoading, currentUser } = useAuth();
  const [reconciliations, setReconciliations] = useState<FinancialReconciliation[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [selectedScope, setSelectedScope] = useState<ScopeType | 'ALL'>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>(bulanHariIni());

  // Form state
  const [showModal, setShowModal] = useState<boolean>(false);
  const [accountName, setAccountName] = useState<string>('Rekening BCA Bisnis Kantor');
  const [actualBalanceInput, setActualBalanceInput] = useState<number>(0);
  const [reconcileDate, setReconcileDate] = useState<string>(tanggalHariIni());
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (authLoading || !currentUser || !userProfile?.active) {
      return;
    }
    const unsubReconcile = subscribeReconciliations(setReconciliations);
    const unsubTx = subscribeTransactions(
      {
        scope: selectedScope,
        status: 'ACTIVE',
      },
      setTransactions
    );

    return () => {
      unsubReconcile();
      unsubTx();
    };
  }, [authLoading, currentUser?.uid, userProfile?.role, userProfile?.active, selectedScope]);

  // Hitung saldo sistem kumulatif sampai tanggal/bulan yang dipilih
  const filteredTxs = transactions.filter((t) => t.date <= reconcileDate && (t.status || 'ACTIVE') === 'ACTIVE');
  
  const openingBalance = filteredTxs
    .filter((t) => t.sourceType === 'OPENING_BALANCE')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    
  const totalIncome = filteredTxs
    .filter((t) => t.type === 'INCOME' && t.sourceType !== 'OPENING_BALANCE')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    
  const totalExpense = filteredTxs
    .filter((t) => t.type === 'EXPENSE')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    
  const systemCalculatedBalance = openingBalance + totalIncome - totalExpense;

  const currentDifference = actualBalanceInput - systemCalculatedBalance;

  const handleOpenModal = () => {
    setActualBalanceInput(systemCalculatedBalance);
    setReconcileDate(tanggalHariIni());
    setNotes('');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName.trim()) {
      alert('Nama akun / rekening wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      await createReconciliation(
        {
          date: reconcileDate,
          periodLabel: formatBulanTahun(reconcileDate.substring(0, 7)),
          scope: selectedScope,
          systemBalance: systemCalculatedBalance,
          actualBalance: Number(actualBalanceInput) || 0,
          difference: currentDifference,
          accountName: accountName.trim(),
          notes: notes.trim(),
          status:
            currentDifference === 0
              ? 'SEIMBANG'
              : currentDifference > 0
              ? 'SELISIH_LEBIH'
              : 'SELISIH_KURANG',
          createdBy: userProfile?.uid || 'user',
          createdByName: userProfile?.name || 'Owner',
        },
        userProfile?.uid || 'user',
        userProfile?.name || 'Owner'
      );
      setShowModal(false);
    } catch (err: any) {
      alert('Gagal menyimpan rekonsiliasi: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const accountsPreset = [
    'Rekening BCA Bisnis Kantor',
    'Rekening Mandiri Operasional',
    'Kas Tunai / Cash Studio',
    'E-Wallet GoPay / OVO Bisnis',
    'TikTok Shop Payout Balance',
  ];

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800 border border-amber-200">
              <Scale className="h-3.5 w-3.5" />
              Rekonsiliasi Kas & Bank
            </span>
          </div>
          <h2 className="text-xl font-extrabold text-zinc-900 tracking-tight mt-1">
            Pencocokan Saldo Buku Kas Sistem vs Rekening / Kas Fisik
          </h2>
          <p className="text-xs text-zinc-500 mt-1 max-w-2xl">
            Pastikan angka saldo kas yang tercatat pada sistem PT.KDRT sama persis dengan saldo mutasi rekening bank atau brankas fisik kantor.
          </p>
        </div>

        {role === 'OWNER' && (
          <button
            onClick={handleOpenModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-zinc-800 transition-all shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Rekonsiliasi Baru</span>
          </button>
        )}
      </div>

      {/* Real-time System Balance Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Total Akumulasi Uang Masuk</span>
          <p className="text-xl font-extrabold text-emerald-600 mt-1">{formatRupiah(totalIncome)}</p>
          <span className="text-[11px] text-zinc-500 font-medium">Dari {filteredTxs.filter((t) => t.type === 'INCOME').length} transaksi aktif</span>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Total Akumulasi Uang Keluar</span>
          <p className="text-xl font-extrabold text-rose-600 mt-1">{formatRupiah(totalExpense)}</p>
          <span className="text-[11px] text-zinc-500 font-medium">Dari {filteredTxs.filter((t) => t.type === 'EXPENSE').length} pengeluaran</span>
        </div>

        <div className="rounded-2xl border border-zinc-900 bg-zinc-900 p-5 text-white shadow-md">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Saldo Buku Kas Sistem Saat Ini</span>
          <p className="text-2xl font-extrabold text-emerald-400 mt-1">{formatRupiah(systemCalculatedBalance)}</p>
          <span className="text-[11px] text-zinc-400 font-medium">Status Buku Kas Terkini</span>
        </div>
      </div>

      {/* Riwayat Rekonsiliasi Table */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xs">
        <div className="border-b border-zinc-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-zinc-900 text-sm">Riwayat Rekonsiliasi Kas</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">Catatan berkala hasil pencocokan saldo rekening / kas fisik oleh Owner</p>
          </div>
          <span className="text-xs font-bold text-zinc-400">{reconciliations.length} Rekaman</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 text-zinc-500 uppercase tracking-wider text-[10px] font-bold border-b border-zinc-100">
              <tr>
                <th className="px-6 py-3">Tanggal & Periode</th>
                <th className="px-4 py-3">Akun / Rekening</th>
                <th className="px-4 py-3 text-right">Saldo Sistem</th>
                <th className="px-4 py-3 text-right">Saldo Aktual Fisik</th>
                <th className="px-4 py-3 text-right">Selisih</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-6 py-3">Catatan / Petugas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              {reconciliations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-zinc-400 font-medium">
                    Belum ada riwayat rekonsiliasi kas yang dicatat. Klik tombol <strong>[ Rekonsiliasi Baru ]</strong> untuk mencocokkan saldo.
                  </td>
                </tr>
              ) : (
                reconciliations.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="font-bold text-zinc-900">{formatTanggal(item.date)}</div>
                      <div className="text-[10px] text-zinc-500 font-medium">{item.periodLabel}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-zinc-800 flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-zinc-400" />
                        {item.accountName}
                      </div>
                      <div className="text-[10px] text-zinc-400 font-semibold">Scope: {item.scope}</div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium text-zinc-700">
                      {formatRupiah(item.systemBalance)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-zinc-900">
                      {formatRupiah(item.actualBalance)}
                    </td>
                    <td
                      className={`px-4 py-3.5 text-right font-extrabold ${
                        item.difference === 0
                          ? 'text-emerald-600'
                          : item.difference > 0
                          ? 'text-blue-600'
                          : 'text-rose-600'
                      }`}
                    >
                      {item.difference === 0
                        ? 'Rp 0'
                        : item.difference > 0
                        ? `+${formatRupiah(item.difference)}`
                        : `-${formatRupiah(Math.abs(item.difference))}`}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          item.status === 'SEIMBANG'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : item.status === 'SELISIH_LEBIH'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {item.status === 'SEIMBANG' ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" />
                            SEIMBANG
                          </>
                        ) : item.status === 'SELISIH_LEBIH' ? (
                          <>
                            <TrendingUp className="h-3 w-3" />
                            SURPLUS FISIK
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-3 w-3" />
                            DEFISIT FISIK
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <p className="text-zinc-800 font-medium line-clamp-1">{item.notes || '-'}</p>
                      <span className="text-[10px] text-zinc-400">Oleh: {item.createdByName || 'Owner'}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Input Rekonsiliasi */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-extrabold text-zinc-900 flex items-center gap-2">
                  <Scale className="h-5 w-5 text-amber-600" />
                  Form Rekonsiliasi Saldo Kas
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">Bandingkan saldo pembukuan sistem dengan rekening bank / kas tunai.</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Tanggal Cut-Off</label>
                  <input
                    type="date"
                    required
                    value={reconcileDate}
                    onChange={(e) => setReconcileDate(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Scope</label>
                  <select
                    value={selectedScope}
                    onChange={(e) => setSelectedScope(e.target.value as any)}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 font-bold"
                  >
                    
                    <option value="SHARING">SHARING</option>
                    <option value="PRIBADI">PRIBADI</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">Nama Akun / Rekening Bank / Kas</label>
                <input
                  type="text"
                  required
                  list="accounts-list"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Pilih atau ketik nama rekening/brankas"
                  className="w-full rounded-xl border border-zinc-300 p-2.5 font-medium text-zinc-900"
                />
                <datalist id="accounts-list">
                  {accountsPreset.map((acc) => (
                    <option key={acc} value={acc} />
                  ))}
                </datalist>
              </div>

              {/* Komparasi Nilai */}
              <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-4 space-y-3">
                <div className="flex items-center justify-between text-zinc-600">
                  <span className="font-semibold">Saldo Terhitung Sistem:</span>
                  <span className="font-extrabold text-zinc-900 text-sm">
                    {formatRupiah(systemCalculatedBalance)}
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-zinc-800 mb-1">
                    Saldo Aktual di Rekening / Fisik (Rp)
                  </label>
                  <input
                    type="number"
                    required
                    value={actualBalanceInput}
                    onChange={(e) => setActualBalanceInput(Number(e.target.value))}
                    className="w-full rounded-xl border border-zinc-300 bg-white p-2.5 font-extrabold text-base text-zinc-900 focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* Selisih Box */}
                <div
                  className={`rounded-lg p-3 border flex items-center justify-between ${
                    currentDifference === 0
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : currentDifference > 0
                      ? 'bg-blue-50 border-blue-200 text-blue-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {currentDifference === 0 ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-rose-600" />
                    )}
                    <span className="font-bold">
                      {currentDifference === 0
                        ? 'Saldo Klop (SEIMBANG)'
                        : currentDifference > 0
                        ? 'Surplus Fisik (Lebih)'
                        : 'Defisit Fisik (Kurang)'}
                    </span>
                  </div>
                  <span className="font-extrabold text-sm">
                    {currentDifference === 0
                      ? 'Selisih Rp 0'
                      : `${currentDifference > 0 ? '+' : ''}${formatRupiah(currentDifference)}`}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">Catatan Rekonsiliasi (Opsional)</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Ada biaya admin bank belum tercatat / Klop sesuai mutasi BCA"
                  className="w-full rounded-xl border border-zinc-300 p-2.5 font-medium"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-zinc-200 px-4 py-2 font-semibold text-zinc-600 hover:bg-zinc-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-zinc-900 px-5 py-2 font-bold text-white hover:bg-zinc-800 disabled:opacity-50 shadow-sm"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Rekonsiliasi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
