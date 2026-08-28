import React, { useState, useEffect } from 'react';
import { AlertCircle, Link2, Trash2 } from 'lucide-react';
import { db } from '../../firebase';
import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { formatRupiah, formatTanggal } from '../../utils/formatters';
import { catatAuditLog } from '../../services/auditService';
import { getPerformanceDocId, checkDuplicatePerformance, saveKomisiReal } from '../../services/performanceService';
import { deleteTransaction } from '../../services/transactionService';

export const OrphanTransactionAlert: React.FC = () => {
  const { role, currentUser, userProfile } = useAuth();
  const [orphanTx, setOrphanTx] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [resolving, setResolving] = useState(false);
  const orphanId = 'r7rT8lPlRwI8F2KXqoFm';

  useEffect(() => {
    if (role !== 'OWNER') {
      setLoading(false);
      return;
    }
    
    const checkOrphan = async () => {
      try {
        const txSnap = await getDoc(doc(db, 'transactions', orphanId));
        if (txSnap.exists()) {
          const txData = txSnap.data();
          // Check if it's already linked or performance exists
          if (txData.status !== 'VOID') {
             // We need to check if we already fixed it
             if (txData.performanceId) {
                const perfSnap = await getDoc(doc(db, 'dailyPerformance', txData.performanceId));
                if (perfSnap.exists()) {
                   setOrphanTx(null);
                   return;
                }
             }
             // It's still orphan
             setOrphanTx({ id: txSnap.id, ...txData });
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    checkOrphan();
  }, [role]);

  const handleLink = async () => {
    if (!orphanTx || !currentUser || !userProfile) return;
    setResolving(true);
    try {
      const accountId = 'NISAGROSIR88';
      const date = '2026-08-18';
      const isDup = await checkDuplicatePerformance(accountId, date);
      
      const perfId = getPerformanceDocId(accountId, date);
      
      const batch = writeBatch(db);
      
      // Update transaction reference
      batch.update(doc(db, 'transactions', orphanId), {
         performanceId: perfId,
         sourceType: 'COMMISSION_REAL'
      });
      
      // If performance does not exist, create it to link
      if (!isDup) {
         batch.set(doc(db, 'dailyPerformance', perfId), {
           date: date,
           accountId: accountId,
           accountName: 'NISA GROSIR 88', // Assuming known name
           scope: 'SHARING',
           gmv: 0,
           estimatedCommission: 0,
           commissionReal: orphanTx.amount,
           realCommission: orphanTx.amount,
           createdBy: currentUser.uid,
           notes: 'Data direkonstruksi dari transaksi orphan',
         }, { merge: true });
      } else {
         batch.update(doc(db, 'dailyPerformance', perfId), {
           commissionReal: orphanTx.amount,
           realCommission: orphanTx.amount
         });
      }
      
      await batch.commit();
      await catatAuditLog(currentUser.uid, userProfile.name, 'RESOLVE_ORPHAN', orphanId, 'Menghubungkan transaksi dengan data omset');
      setOrphanTx(null);
      setShowModal(false);
      alert('Berhasil dihubungkan.');
    } catch (err) {
      console.error(err);
      alert('Gagal menghubungkan.');
    } finally {
      setResolving(false);
    }
  };

  const handleDelete = async () => {
    if (!orphanTx || !currentUser || !userProfile) return;
    setResolving(true);
    try {
      await deleteTransaction(
        orphanId, 
        orphanTx, 
        'Menghapus transaksi orphan secara manual',
        currentUser.uid,
        userProfile.name
      );
      setOrphanTx(null);
      setShowModal(false);
      alert('Transaksi berhasil dihapus.');
    } catch (err) {
      console.error(err);
      alert('Gagal menghapus.');
    } finally {
      setResolving(false);
    }
  };

  if (loading || !orphanTx || role !== 'OWNER') return null;

  return (
    <>
      <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 p-4 shadow-sm flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-bold text-amber-900">Perhatian: Ada Transaksi Belum Terhubung (Orphan)</h4>
          <p className="text-xs text-amber-800 mt-1 mb-3">
            Ditemukan 1 transaksi Commission Real yang kehilangan Data Omset pasangannya (TxID: {orphanId}).
          </p>
          <button 
            onClick={() => setShowModal(true)}
            className="text-xs font-bold bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 shadow-sm transition-colors"
          >
            Selesaikan Masalah
          </button>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-zinc-200 overflow-hidden">
            <div className="bg-amber-50 p-4 border-b border-amber-100 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <h3 className="font-bold text-amber-900">TRANSAKSI BELUM TERHUBUNG</h3>
            </div>
            
            <div className="p-6">
              <div className="text-xs text-zinc-600 bg-zinc-50 border border-zinc-200 p-3 rounded-xl mb-6">
                <strong>Tx ID:</strong> {orphanTx.id}<br/>
                <strong>Tanggal:</strong> {formatTanggal(orphanTx.date)}<br/>
                <strong>Akun:</strong> {orphanTx.accountName || orphanTx.accountId || 'NISAGROSIR88'}<br/>
                <strong>Nominal:</strong> <span className="font-bold text-emerald-600">{formatRupiah(orphanTx.amount)}</span>
              </div>
              
              <div className="flex flex-col gap-3">
                <button 
                  disabled={resolving}
                  onClick={handleLink}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm py-3 rounded-xl shadow-sm transition-colors"
                >
                  <Link2 className="h-4 w-4" />
                  HUBUNGKAN KE DATA OMSET
                </button>
                <button 
                  disabled={resolving}
                  onClick={handleDelete}
                  className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm py-3 rounded-xl shadow-sm transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  HAPUS TRANSAKSI
                </button>
                <button 
                  disabled={resolving}
                  onClick={() => setShowModal(false)}
                  className="w-full text-zinc-500 font-bold text-sm py-2 hover:bg-zinc-50 rounded-xl transition-colors mt-2"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
