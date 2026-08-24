import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  Plus,
  Minus,
  Search,
  FileText,
  Trash2,
  Lock,
  Building,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import {
  FinancialTransaction,
  ScopeType
} from '../types';
import {
  subscribeTransactions,
  deleteTransaction,
} from '../services/transactionService';
import { deleteKomisiRealAtomic } from '../services/performanceService';
import { formatRupiah, formatTanggal, bulanHariIni, formatBulanTahun } from '../utils/formatters';

export const ArusKasPage: React.FC = () => {
  const { userProfile, role, currentUser } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState<string>(bulanHariIni());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals State
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [selectedTxForDelete, setSelectedTxForDelete] = useState<FinancialTransaction | null>(null);
  const [deleteReason, setDeleteReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [selectedTxDetail, setSelectedTxDetail] = useState<FinancialTransaction | null>(null);

  useEffect(() => {
    // Only fetch for the selected month to keep it light
    const startDate = `${selectedMonth}-01`;
    const lastDay = new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]), 0).getDate();
    const endDate = `${selectedMonth}-${lastDay}`;
    
    // We fetch all types, all scopes, status ACTIVE (and old ones without status)
    const unsub = subscribeTransactions({
      startDate,
      endDate
    }, (data) => {
      // Filter out VOID explicitly. Treat missing status as ACTIVE.
      const activeTx = data.filter(tx => tx.status !== 'VOID');
      setTransactions(activeTx);
      setLoading(false);
    });

    return () => unsub();
  }, [selectedMonth]);

  const handleDeleteClick = (tx: FinancialTransaction) => {
    if (role !== 'OWNER') {
      alert('Hanya Owner yang dapat menghapus transaksi.');
      return;
    }
    setSelectedTxForDelete(tx);
    setDeleteReason('');
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedTxForDelete || !currentUser || !userProfile) return;
    setSubmitting(true);
    try {
      if (selectedTxForDelete.sourceType === 'COMMISSION_REAL' && selectedTxForDelete.performanceId) {
        // Atomic delete for performance & transaction
        await deleteKomisiRealAtomic(
          selectedTxForDelete.performanceId,
          deleteReason,
          currentUser.uid,
          userProfile.name
        );
      } else {
        // Normal transaction delete
        await deleteTransaction(
          selectedTxForDelete.id!,
          selectedTxForDelete,
          deleteReason,
          currentUser.uid,
          userProfile.name
        );
      }
      setShowDeleteModal(false);
      setSelectedTxForDelete(null);
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Gagal menghapus transaksi.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderSection = (scope: ScopeType, title: string, icon: React.ReactNode, themeClass: string) => {
    // Filter
    const filtered = transactions.filter(tx => {
      const matchScope = tx.scope === scope;
      const matchSearch =
        tx.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tx.accountName || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchScope && matchSearch;
    });

    let totalIncome = 0;
    let totalExpense = 0;
    filtered.forEach(tx => {
      if (tx.type === 'INCOME') totalIncome += tx.amount;
      if (tx.type === 'EXPENSE') totalExpense += tx.amount;
    });

    // We only display the net cash flow for this month (or total balance if requested, but for now we display monthly summary)
    // "Saldo Awal + Income - Expense". For true balance, we need all time transactions.
    // For this specific table (monthly), we will show Income and Expense for the month.

    return (
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4 border-b border-zinc-200 pb-2">
          {icon}
          <h2 className={`text-lg font-black tracking-tight ${themeClass}`}>{title}</h2>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-5 bg-white rounded-2xl border border-zinc-200 shadow-sm">
            <span className="text-[11px] font-bold uppercase text-emerald-600 flex items-center gap-1.5 mb-1">
              <Plus className="h-4 w-4" /> UANG MASUK ({formatBulanTahun(selectedMonth)})
            </span>
            <span className="text-2xl font-black text-emerald-900">
              {formatRupiah(totalIncome)}
            </span>
          </div>
          <div className="p-5 bg-white rounded-2xl border border-zinc-200 shadow-sm">
            <span className="text-[11px] font-bold uppercase text-rose-600 flex items-center gap-1.5 mb-1">
              <Minus className="h-4 w-4" /> UANG KELUAR ({formatBulanTahun(selectedMonth)})
            </span>
            <span className="text-2xl font-black text-rose-900">
              {formatRupiah(totalExpense)}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-600">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="px-5 py-3.5 font-extrabold text-zinc-900">Tanggal</th>
                  <th className="px-5 py-3.5 font-extrabold text-zinc-900">Kategori</th>
                  <th className="px-5 py-3.5 font-extrabold text-zinc-900">Keterangan</th>
                  <th className="px-5 py-3.5 font-extrabold text-zinc-900">Masuk</th>
                  <th className="px-5 py-3.5 font-extrabold text-zinc-900">Keluar</th>
                  <th className="px-5 py-3.5 font-extrabold text-zinc-900 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-zinc-400 font-medium">
                      BELUM ADA DATA TRANSAKSI
                    </td>
                  </tr>
                ) : (
                  filtered.map(tx => (
                    <tr key={tx.id} className="hover:bg-zinc-50">
                      <td className="px-5 py-3.5 whitespace-nowrap font-medium text-zinc-900">{formatTanggal(tx.date)}</td>
                      <td className="px-5 py-3.5 font-bold text-zinc-700">{tx.category}</td>
                      <td className="px-5 py-3.5 max-w-[200px] truncate text-zinc-500" title={tx.description}>
                        {tx.description}
                        {tx.accountName && <span className="ml-1 text-emerald-600 font-semibold">[{tx.accountName}]</span>}
                      </td>
                      <td className="px-5 py-3.5 font-black text-emerald-600">
                        {tx.type === 'INCOME' ? formatRupiah(tx.amount) : '-'}
                      </td>
                      <td className="px-5 py-3.5 font-black text-rose-600">
                        {tx.type === 'EXPENSE' ? formatRupiah(tx.amount) : '-'}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedTxDetail(tx);
                              setShowDetailModal(true);
                            }}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Lihat Detail"
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                          {role === 'OWNER' && (
                            <button
                              onClick={() => handleDeleteClick(tx)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Hapus Transaksi"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Cari transaksi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2.5 rounded-xl border border-zinc-300 text-sm font-medium w-full sm:w-64 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-500 uppercase">Periode:</span>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-xl border border-zinc-300 p-2.5 text-sm font-bold bg-white text-zinc-800"
          />
        </div>
      </div>

      {/* SHARING SECTION */}
      {renderSection('SHARING', 'ARUS KAS SHARING', <Sparkles className="h-6 w-6 text-indigo-600" />, 'text-indigo-900')}

      {/* PRIVATE SECTION */}
      {role === 'OWNER' && (
        renderSection('PRIBADI', 'ARUS KAS PRIBADI', <Building className="h-6 w-6 text-rose-600" />, 'text-rose-900')
      )}
      
      {role === 'INVESTOR' && (
        <div className="p-6 bg-zinc-100 rounded-xl border border-zinc-200 text-center">
          <Lock className="mx-auto h-8 w-8 text-zinc-400 mb-2" />
          <p className="text-xs text-zinc-500 font-bold">Arus Kas Pribadi tidak ditampilkan untuk Investor.</p>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && selectedTxForDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-zinc-200 text-zinc-800">
            <h3 className="text-base font-black flex items-center gap-2 mb-4 text-rose-700">
              <Trash2 className="h-5 w-5" />
              Hapus Transaksi Permanen
            </h3>
            
            <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 mb-4">
              <p className="text-xs text-rose-800 font-bold mb-2">
                Peringatan: Data akan dihapus secara permanen dari kas operasional. Audit log akan mencatat aksi ini.
              </p>
              <div className="text-[11px] bg-white p-2 rounded-lg border border-rose-100">
                <strong>Tx ID:</strong> {selectedTxForDelete.id}<br/>
                <strong>Nominal:</strong> {formatRupiah(selectedTxForDelete.amount)}<br/>
                <strong>Kategori:</strong> {selectedTxForDelete.category}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                Alasan Penghapusan (Wajib)
              </label>
              <textarea
                rows={3}
                required
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Contoh: Salah ketik nominal, duplikat transaksi, dll..."
                className="w-full rounded-xl border border-zinc-300 p-2.5 font-medium text-sm"
              />
            </div>
            
            <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100 mt-4">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-zinc-500 hover:bg-zinc-100"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submitting || !deleteReason.trim()}
                onClick={handleConfirmDelete}
                className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-black text-white hover:bg-rose-500 disabled:opacity-50 shadow-md"
              >
                {submitting ? 'MEMPROSES...' : 'HAPUS PERMANEN'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedTxDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200">
             <div className="flex justify-between items-center mb-4">
               <h3 className="font-black text-lg text-zinc-900">Rincian Transaksi</h3>
               <button onClick={() => setShowDetailModal(false)} className="text-zinc-400 hover:text-zinc-700">✕</button>
             </div>
             
             <div className="space-y-3 text-xs">
               <div className="flex justify-between p-3 rounded-lg bg-zinc-50 border border-zinc-200">
                 <span className="font-bold text-zinc-500">Kategori</span>
                 <span className="font-black text-zinc-900">{selectedTxDetail.category}</span>
               </div>
               <div className="flex justify-between p-3 rounded-lg bg-zinc-50 border border-zinc-200">
                 <span className="font-bold text-zinc-500">Tanggal</span>
                 <span className="font-black text-zinc-900">{formatTanggal(selectedTxDetail.date)}</span>
               </div>
               <div className="flex justify-between p-3 rounded-lg bg-zinc-50 border border-zinc-200">
                 <span className="font-bold text-zinc-500">Nominal</span>
                 <span className={`font-black text-lg ${selectedTxDetail.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>
                   {selectedTxDetail.type === 'INCOME' ? '+' : '-'}{formatRupiah(selectedTxDetail.amount)}
                 </span>
               </div>
               {selectedTxDetail.accountName && (
                 <div className="flex justify-between p-3 rounded-lg bg-zinc-50 border border-zinc-200">
                   <span className="font-bold text-zinc-500">Akun Sumber</span>
                   <span className="font-black text-zinc-900">{selectedTxDetail.accountName}</span>
                 </div>
               )}
               {selectedTxDetail.description && (
                 <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200">
                   <span className="font-bold text-zinc-500 block mb-1">Keterangan</span>
                   <span className="font-medium text-zinc-800">{selectedTxDetail.description}</span>
                 </div>
               )}
               <div className="text-[10px] text-zinc-400 mt-4 text-center">
                 TxID: {selectedTxDetail.id} <br/>
                 Dicatat oleh: {selectedTxDetail.createdByName}
               </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
