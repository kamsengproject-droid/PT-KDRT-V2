import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Building2,
  Plus,
  Edit,
  Trash2,
  Calendar,
  Search,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  FileText,
  AlertTriangle,
  X,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Home,
  SlidersHorizontal,
  Check,
  Info,
  Lock,
} from 'lucide-react';
import {
  collection,
  doc,
  addDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { FinancialTransaction, TransactionType, SaldoRealPtKdrt } from '../types';
import {
  formatRupiah,
  formatTanggal,
  tanggalHariIni,
  bulanHariIni,
  formatBulanTahun,
} from '../utils/formatters';
import { CurrencyInput } from '../components/CurrencyInput';
import { catatAuditLog } from '../services/auditService';
import {
  syncAllKomisiRealToTransactions,
  KomisiSyncSummary,
} from '../services/performanceService';
import {
  syncAllUangRajinToTransactions,
} from '../services/payrollService';
import {
  subscribeSaldoRealPtKdrt,
  updateSaldoRealPtKdrt,
} from '../services/settingsService';

interface KeuanganPageProps {
  onBackToPortal?: () => void;
}

// Preset Akun Kas & Bank
const PRESET_ACCOUNTS = [
  'BCA PT KDRT',
  'Kas Tunai',
  'BCA',
  'Mandiri',
  'SeaBank',
  'BRI',
  'BNI',
  'BSI',
];

// Preset Kategori Uang Masuk
const PRESET_INCOME_CATEGORIES = [
  'Penarikan TikTok/Medsos',
  'Komisi TikTok',
  'Endorse & Sponsorship',
  'Penjualan & Jasa',
  'Modal / Suntikan Dana',
  'Bonus & Bagi Hasil',
  'Lainnya',
];

// Preset Kategori Uang Keluar
const PRESET_EXPENSE_CATEGORIES = [
  'Gaji & Upah Karyawan',
  'Uang Rajin Mingguan',
  'Operasional Kantor',
  'Sewa Tempat & Studio',
  'Listrik, Air & Utilitas',
  'Internet & Wifi',
  'Iklan & Marketing',
  'Pembelian Sampel Produk',
  'Inventaris & Peralatan',
  'Renovasi & Maintenance',
  'Konsumsi & Snack Tim',
  'Biaya Admin & Pajak',
  'Lainnya',
];

export const KeuanganPage: React.FC<KeuanganPageProps> = ({ onBackToPortal }) => {
  const { currentUser, userProfile, role } = useAuth();
  const isOwnerOrManager = role === 'OWNER' || role === 'MANAGER';

  // 1. Data State
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // 1B. Saldo Real PT KDRT (Input Manual Owner) State
  const [saldoRealData, setSaldoRealData] = useState<SaldoRealPtKdrt | null>(null);
  const [isEditSaldoRealModalOpen, setIsEditSaldoRealModalOpen] = useState(false);
  const [saldoRealAmountInput, setSaldoRealAmountInput] = useState<number | ''>('');
  const [saldoRealNotesInput, setSaldoRealNotesInput] = useState<string>('');
  const [saldoRealSaving, setSaldoRealSaving] = useState(false);

  // 1C. Sync Summary Modal State
  const [syncSummary, setSyncSummary] = useState<KomisiSyncSummary | null>(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // 2. Filter States
  const [selectedMonth, setSelectedMonth] = useState<string>(bulanHariIni());
  const [filterAccount, setFilterAccount] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 3. Modal Form State (Tambah & Edit Transaksi)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [formDate, setFormDate] = useState<string>(tanggalHariIni());
  const [formType, setFormType] = useState<TransactionType>('INCOME');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>('Komisi TikTok');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [formAccount, setFormAccount] = useState<string>('BCA');
  const [customAccount, setCustomAccount] = useState<string>('');
  const [formAmount, setFormAmount] = useState<number | ''>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  // 4. Modal Delete Confirmation State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingTransaction, setDeletingTransaction] = useState<FinancialTransaction | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // 5. Toast Notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [syncingKomisi, setSyncingKomisi] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Helper format timestamp WIB
  const formatTimestampWIB = (ts: any): string => {
    if (!ts) return '-';
    try {
      let d: Date;
      if (ts.toDate && typeof ts.toDate === 'function') {
        d = ts.toDate();
      } else if (ts.seconds) {
        d = new Date(ts.seconds * 1000);
      } else if (typeof ts === 'string' || typeof ts === 'number') {
        d = new Date(ts);
      } else if (ts instanceof Date) {
        d = ts;
      } else {
        return '-';
      }
      if (isNaN(d.getTime())) return '-';
      return (
        d.toLocaleString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Jakarta',
        }) + ' WIB'
      );
    } catch {
      return '-';
    }
  };

  // Subscribe Saldo Real PT KDRT (Input Manual Owner)
  useEffect(() => {
    const unsub = subscribeSaldoRealPtKdrt((data) => {
      setSaldoRealData(data);
    });
    return () => unsub();
  }, []);

  // Auto-sync / Backfill historical Komisi Real & Uang Rajin Mingguan to transactions on mount
  useEffect(() => {
    const currentUid = currentUser?.uid || 'system';
    const currentName = userProfile?.name || 'Sistem Auto-Sync';

    Promise.all([
      syncAllKomisiRealToTransactions(currentUid, currentName),
      syncAllUangRajinToTransactions(currentUid, currentName),
    ])
      .then(([komisiRes, uangRajinRes]) => {
        if (komisiRes.totalNew > 0 || komisiRes.totalUpdated > 0) {
          console.log(`Auto-synced Komisi Real: ${komisiRes.totalNew} new, ${komisiRes.totalUpdated} updated.`);
        }
        if (uangRajinRes.syncedCount > 0) {
          console.log(`Auto-synced Uang Rajin: ${uangRajinRes.syncedCount} transaksi uang keluar dicatat.`);
        }
      })
      .catch((err) => {
        console.warn('Auto-sync data ke Buku Kas & Bank failed on mount:', err);
      });
  }, [currentUser?.uid, userProfile?.name]);

  // Manual Trigger Sync Komisi Real & Uang Rajin Mingguan
  const handleManualSync = async () => {
    setSyncingKomisi(true);
    const currentUid = currentUser?.uid || 'system';
    const currentName = userProfile?.name || 'Sistem Auto-Sync';

    try {
      const [komisiRes, uangRajinRes] = await Promise.all([
        syncAllKomisiRealToTransactions(currentUid, currentName),
        syncAllUangRajinToTransactions(currentUid, currentName),
      ]);

      setSyncSummary(komisiRes);
      setIsSyncModalOpen(true);
      showToast(
        `Sinkronisasi Selesai: Komisi Real (${komisiRes.totalNew} baru, ${komisiRes.totalUpdated} update) & Uang Rajin (${uangRajinRes.syncedCount} tercatat sebagai Uang Keluar).`
      );
    } catch (err: any) {
      showToast('Gagal sinkronisasi data: ' + (err.message || 'Error server'), 'error');
    } finally {
      setSyncingKomisi(false);
    }
  };

  // Open Edit Saldo Real Modal (Owner only)
  const handleOpenEditSaldoRealModal = () => {
    setSaldoRealAmountInput(saldoRealData?.amount !== undefined ? saldoRealData.amount : '');
    setSaldoRealNotesInput(saldoRealData?.notes || '');
    setIsEditSaldoRealModalOpen(true);
  };

  // Save Saldo Real PT KDRT
  const handleSaveSaldoReal = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalAmount = Number(saldoRealAmountInput) || 0;
    if (finalAmount < 0) {
      showToast('Nominal Saldo Real tidak boleh negatif.', 'error');
      return;
    }

    setSaldoRealSaving(true);
    try {
      await updateSaldoRealPtKdrt(
        finalAmount,
        saldoRealNotesInput,
        currentUser?.uid || 'owner',
        userProfile?.name || 'Owner'
      );
      setIsEditSaldoRealModalOpen(false);
      showToast('Saldo Real PT KDRT berhasil disimpan ke Firebase.');
    } catch (err: any) {
      showToast('Gagal menyimpan Saldo Real: ' + (err.message || 'Error server'), 'error');
    } finally {
      setSaldoRealSaving(false);
    }
  };

  // Real-time Firestore Subscription
  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, 'transactions'),
      (snapshot) => {
        const list: FinancialTransaction[] = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              transactionId: docSnap.id,
              ...data,
            } as FinancialTransaction;
          })
          .filter((tx) => (tx.status || 'ACTIVE') === 'ACTIVE');

        setTransactions(list);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching transactions:', error);
        setLoading(false);
        showToast('Gagal memuat data transaksi dari Firebase.', 'error');
      }
    );

    return () => unsubscribe();
  }, []);

  // Collect all unique account names across preset and existing transactions
  const allAccountNames = useMemo(() => {
    const set = new Set<string>(PRESET_ACCOUNTS);
    transactions.forEach((tx) => {
      const acc = tx.accountName || (tx as any).account || tx.accountId;
      if (acc && typeof acc === 'string' && acc.trim()) {
        set.add(acc.trim());
      }
    });
    return Array.from(set);
  }, [transactions]);

  // Chronological list with cumulative running balance
  const transactionsWithRunningBalance = useMemo(() => {
    // Sort ascending by date & createdAt for exact historical cumulative balance
    const sortedAsc = [...transactions].sort((a, b) => {
      const dateCmp = (a.date || '').localeCompare(b.date || '');
      if (dateCmp !== 0) return dateCmp;
      return (a.id || '').localeCompare(b.id || '');
    });

    let running = 0;
    const withBalance = sortedAsc.map((tx) => {
      const amt = Number(tx.amount) || 0;
      const isIncome = tx.type === 'INCOME' || tx.type === 'OPENING_BALANCE';
      if (isIncome) {
        running += amt;
      } else {
        running -= amt;
      }
      return {
        ...tx,
        runningBalance: running,
      };
    });

    // Return in descending order (latest date on top)
    return withBalance.reverse();
  }, [transactions]);

  // Overall Global Totals (All Time)
  const globalCalculations = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    let totalOpening = 0;

    const accountBalances: Record<string, { masuk: number; keluar: number; saldo: number }> = {};

    // Initialize all known accounts
    allAccountNames.forEach((acc) => {
      accountBalances[acc] = { masuk: 0, keluar: 0, saldo: 0 };
    });

    transactions.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      const acc = (tx.accountName || (tx as any).account || tx.accountId || 'Kas Tunai').trim();

      if (!accountBalances[acc]) {
        accountBalances[acc] = { masuk: 0, keluar: 0, saldo: 0 };
      }

      if (tx.type === 'INCOME') {
        totalIn += amt;
        accountBalances[acc].masuk += amt;
        accountBalances[acc].saldo += amt;
      } else if (tx.type === 'OPENING_BALANCE') {
        totalOpening += amt;
        accountBalances[acc].masuk += amt;
        accountBalances[acc].saldo += amt;
      } else if (tx.type === 'EXPENSE') {
        totalOut += amt;
        accountBalances[acc].keluar += amt;
        accountBalances[acc].saldo -= amt;
      }
    });

    const grandTotalSaldo = totalIn + totalOpening - totalOut;

    return {
      totalIn,
      totalOut,
      totalOpening,
      grandTotalSaldo,
      accountBalances,
    };
  }, [transactions, allAccountNames]);

  // Period Filtered Totals (Selected Month)
  const periodCalculations = useMemo(() => {
    let totalInMonth = 0;
    let totalOutMonth = 0;

    transactions.forEach((tx) => {
      if (!selectedMonth || tx.date.startsWith(selectedMonth)) {
        const amt = Number(tx.amount) || 0;
        if (tx.type === 'INCOME' || tx.type === 'OPENING_BALANCE') {
          totalInMonth += amt;
        } else if (tx.type === 'EXPENSE') {
          totalOutMonth += amt;
        }
      }
    });

    return {
      totalInMonth,
      totalOutMonth,
      netMonth: totalInMonth - totalOutMonth,
    };
  }, [transactions, selectedMonth]);

  // Filtered Transactions for the Table
  const filteredTransactions = useMemo(() => {
    return transactionsWithRunningBalance.filter((tx) => {
      // 1. Month Filter
      if (selectedMonth && !tx.date.startsWith(selectedMonth)) {
        return false;
      }

      // 2. Type Filter
      if (filterType !== 'ALL') {
        if (filterType === 'INCOME' && tx.type !== 'INCOME' && tx.type !== 'OPENING_BALANCE') {
          return false;
        }
        if (filterType === 'EXPENSE' && tx.type !== 'EXPENSE') {
          return false;
        }
      }

      // 3. Account Filter
      if (filterAccount !== 'ALL') {
        const acc = (tx.accountName || (tx as any).account || tx.accountId || '').trim();
        if (acc !== filterAccount) {
          return false;
        }
      }

      // 4. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const desc = (tx.description || '').toLowerCase();
        const cat = (tx.category || '').toLowerCase();
        const acc = (tx.accountName || (tx as any).account || '').toLowerCase();
        const notes = (tx.notes || '').toLowerCase();
        const dateStr = (tx.date || '').toLowerCase();

        return (
          desc.includes(q) ||
          cat.includes(q) ||
          acc.includes(q) ||
          notes.includes(q) ||
          dateStr.includes(q)
        );
      }

      return true;
    });
  }, [transactionsWithRunningBalance, selectedMonth, filterType, filterAccount, searchQuery]);

  // Month navigation helpers
  const handlePrevMonth = () => {
    if (!selectedMonth) {
      setSelectedMonth(bulanHariIni());
      return;
    }
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m - 2, 1);
    const newY = date.getFullYear();
    const newM = String(date.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${newY}-${newM}`);
  };

  const handleNextMonth = () => {
    if (!selectedMonth) {
      setSelectedMonth(bulanHariIni());
      return;
    }
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m, 1);
    const newY = date.getFullYear();
    const newM = String(date.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${newY}-${newM}`);
  };

  // Open Modal for New Transaction
  const handleOpenAddModal = (defaultType: TransactionType = 'INCOME') => {
    setIsEditing(false);
    setEditingId(null);
    setFormDate(tanggalHariIni());
    setFormType(defaultType);
    setFormDescription('');
    setFormCategory(defaultType === 'INCOME' ? PRESET_INCOME_CATEGORIES[0] : PRESET_EXPENSE_CATEGORIES[0]);
    setCustomCategory('');
    setFormAccount('BCA');
    setCustomAccount('');
    setFormAmount('');
    setFormNotes('');
    setFormError('');
    setIsModalOpen(true);
  };

  // Open Modal for Edit Transaction
  const handleOpenEditModal = (tx: FinancialTransaction) => {
    setIsEditing(true);
    setEditingId(tx.id || tx.transactionId || null);
    setFormDate(tx.date || tanggalHariIni());
    setFormType(tx.type === 'EXPENSE' ? 'EXPENSE' : 'INCOME');
    setFormDescription(tx.description || '');

    const cat = tx.category || '';
    const presets = tx.type === 'EXPENSE' ? PRESET_EXPENSE_CATEGORIES : PRESET_INCOME_CATEGORIES;
    if (presets.includes(cat)) {
      setFormCategory(cat);
      setCustomCategory('');
    } else {
      setFormCategory('CUSTOM');
      setCustomCategory(cat);
    }

    const acc = tx.accountName || (tx as any).account || tx.accountId || 'BCA';
    if (PRESET_ACCOUNTS.includes(acc)) {
      setFormAccount(acc);
      setCustomAccount('');
    } else {
      setFormAccount('CUSTOM');
      setCustomAccount(acc);
    }

    setFormAmount(Number(tx.amount) || '');
    setFormNotes(tx.notes || '');
    setFormError('');
    setIsModalOpen(true);
  };

  // Save Transaction (Create / Update)
  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const finalAmount = Number(formAmount) || 0;
    if (finalAmount <= 0) {
      setFormError('Nominal transaksi harus lebih besar dari Rp 0.');
      return;
    }

    if (!formDescription.trim()) {
      setFormError('Keterangan transaksi wajib diisi.');
      return;
    }

    const finalCategory = formCategory === 'CUSTOM' ? customCategory.trim() : formCategory;
    if (!finalCategory) {
      setFormError('Kategori transaksi wajib diisi.');
      return;
    }

    const finalAccount = formAccount === 'CUSTOM' ? customAccount.trim() : formAccount;
    if (!finalAccount) {
      setFormError('Akun kas / bank wajib dipilih atau diisi.');
      return;
    }

    setSubmitting(true);
    try {
      const currentUserId = currentUser?.uid || 'anonymous';
      const currentUserName = userProfile?.name || currentUser?.email || 'Admin';

      const existingTx = isEditing && editingId ? transactions.find(t => (t.id || t.transactionId) === editingId) : null;

      const payload: any = {
        date: formDate,
        type: formType,
        description: formDescription.trim(),
        category: finalCategory,
        accountName: finalAccount,
        accountId: finalAccount,
        amount: finalAmount,
        notes: formNotes.trim(),
        scope: existingTx?.scope || 'SHARING',
        sourceType: existingTx?.sourceType || 'MANUAL',
        status: 'ACTIVE',
        updatedAt: serverTimestamp(),
        updatedBy: currentUserId,
        updatedByName: currentUserName,
      };

      if (existingTx?.sourcePerformanceId) payload.sourcePerformanceId = existingTx.sourcePerformanceId;
      if (existingTx?.referenceId) payload.referenceId = existingTx.referenceId;
      if (existingTx?.performanceId) payload.performanceId = existingTx.performanceId;
      if (existingTx?.sourceAccountId) payload.sourceAccountId = existingTx.sourceAccountId;
      if (existingTx?.sourceAccountName) payload.sourceAccountName = existingTx.sourceAccountName;
      if (existingTx?.destinationAccountName) payload.destinationAccountName = existingTx.destinationAccountName;

      if (isEditing && editingId) {
        // Update existing document
        const docRef = doc(db, 'transactions', editingId);
        await updateDoc(docRef, payload);

        await catatAuditLog(
          currentUserId,
          currentUserName,
          'TRANSACTION_UPDATED',
          `[EDIT] ${formType === 'INCOME' ? 'Uang Masuk' : 'Uang Keluar'} - ${formatRupiah(finalAmount)}`,
          `Keterangan: ${formDescription}, Akun: ${finalAccount}, Kategori: ${finalCategory}, Tanggal: ${formDate}`
        );

        showToast('Transaksi berhasil diperbarui.');
      } else {
        // Create new document
        const newPayload = {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: currentUserId,
          createdByName: currentUserName,
        };

        const docRef = await addDoc(collection(db, 'transactions'), newPayload);

        await catatAuditLog(
          currentUserId,
          currentUserName,
          'TRANSACTION_CREATED',
          `[TAMBAH] ${formType === 'INCOME' ? 'Uang Masuk' : 'Uang Keluar'} - ${formatRupiah(finalAmount)}`,
          `Keterangan: ${formDescription}, Akun: ${finalAccount}, Kategori: ${finalCategory}, Tanggal: ${formDate}`
        );

        showToast('Transaksi berhasil dicatat ke Buku Kas & Bank.');
      }

      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Error saving transaction:', err);
      setFormError(err.message || 'Gagal menyimpan transaksi ke Firebase.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Delete Confirmation Modal
  const handleOpenDeleteModal = (tx: FinancialTransaction) => {
    setDeletingTransaction(tx);
    setIsDeleteModalOpen(true);
  };

  // Confirm Delete Transaction
  const handleConfirmDelete = async () => {
    if (!deletingTransaction?.id && !deletingTransaction?.transactionId) return;
    const idToDelete = deletingTransaction.id || deletingTransaction.transactionId!;

    setDeleteLoading(true);
    try {
      const currentUserId = currentUser?.uid || 'anonymous';
      const currentUserName = userProfile?.name || currentUser?.email || 'Admin';

      // Delete from Firestore
      const docRef = doc(db, 'transactions', idToDelete);
      await deleteDoc(docRef);

      // Jika transaksi terhubung ke salary/payroll, kembalikan status salary ke BELUM DIBAYAR
      const isPayrollTx =
        deletingTransaction.sourceType === 'PAYROLL' ||
        Boolean(deletingTransaction.payrollId) ||
        idToDelete.startsWith('PAYROLL_');

      if (isPayrollTx) {
        const payrollDocId =
          deletingTransaction.payrollId ||
          (idToDelete.startsWith('PAYROLL_') ? idToDelete.replace('PAYROLL_', '') : null);

        if (payrollDocId) {
          try {
            const payRef = doc(db, 'payroll', payrollDocId);
            const paySnap = await getDoc(payRef);
            if (paySnap.exists()) {
              await updateDoc(payRef, {
                status: 'DRAFT',
                paymentDate: null,
                paymentAccount: null,
                paymentTransactionId: null,
                paidAt: null,
                paidBy: null,
                paidByName: null,
                updatedAt: serverTimestamp(),
              });

              await catatAuditLog(
                currentUserId,
                currentUserName,
                'SALARY_RESET_UNPAID',
                `Salary ID: ${payrollDocId}`,
                `Status salary otomatis dikembalikan ke BELUM DIBAYAR karena transaksi kas ${idToDelete} telah dihapus.`
              );
            }
          } catch (payErr) {
            console.warn('Gagal reset status salary terkait transaksi yang dihapus:', payErr);
          }
        }
      }

      // Jika transaksi terhubung ke Uang Rajin Mingguan, kembalikan status ke BELUM DIBAYAR
      const isUangRajinTx =
        deletingTransaction.sourceType === 'ATTENDANCE_BONUS' ||
        idToDelete.startsWith('UANG_RAJIN_') ||
        idToDelete.startsWith('ATTENDANCE_BONUS_');

      if (isUangRajinTx) {
        const bonusDocId =
          deletingTransaction.referenceId ||
          (idToDelete.startsWith('UANG_RAJIN_') ? idToDelete.replace('UANG_RAJIN_', '') : null) ||
          (idToDelete.startsWith('ATTENDANCE_BONUS_') ? idToDelete.replace('ATTENDANCE_BONUS_', '') : null);

        if (bonusDocId) {
          try {
            const bonusRef = doc(db, 'attendanceBonuses', bonusDocId);
            const bonusSnap = await getDoc(bonusRef);
            if (bonusSnap.exists()) {
              await updateDoc(bonusRef, {
                status: 'CALCULATED',
                paymentDate: null,
                paymentAccount: null,
                paymentTransactionId: null,
                syncedTransactionId: null,
                paidAt: null,
                paidBy: null,
                paidByName: null,
                updatedAt: serverTimestamp(),
              });

              await catatAuditLog(
                currentUserId,
                currentUserName,
                'UANG_RAJIN_RESET_UNPAID',
                `Uang Rajin ID: ${bonusDocId}`,
                `Status Uang Rajin otomatis dikembalikan ke BELUM DIBAYAR karena transaksi kas ${idToDelete} telah dihapus.`
              );
            }
          } catch (bonusErr) {
            console.warn('Gagal reset status uang rajin terkait transaksi yang dihapus:', bonusErr);
          }
        }
      }

      await catatAuditLog(
        currentUserId,
        currentUserName,
        'DELETE_TRANSACTION',
        `[HAPUS] ${deletingTransaction.type} - ${formatRupiah(deletingTransaction.amount)}`,
        `ID: ${idToDelete}, Keterangan: ${deletingTransaction.description}, Akun: ${deletingTransaction.accountName || (deletingTransaction as any).account}`
      );

      showToast('Transaksi berhasil dihapus.');
      setIsDeleteModalOpen(false);
      setDeletingTransaction(null);
    } catch (err: any) {
      console.error('Error deleting transaction:', err);
      showToast('Gagal menghapus transaksi: ' + (err.message || 'Error server'), 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-16 text-zinc-100">
      {/* Toast Notification */}
      {toast && (
        <div
          id="toast-notification"
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-5 py-3.5 text-sm font-semibold shadow-2xl transition-all ${
            toast.type === 'success'
              ? 'border border-emerald-500/30 bg-emerald-950/90 text-emerald-200'
              : 'border border-rose-500/30 bg-rose-950/90 text-rose-200'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-rose-400" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header & Breadcrumb */}
      <div className="flex flex-col gap-4 border-b border-zinc-800/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
            {onBackToPortal && (
              <button
                type="button"
                onClick={onBackToPortal}
                className="flex items-center gap-1 text-zinc-400 transition hover:text-cyan-400"
              >
                <Home className="h-3.5 w-3.5" />
                <span>Portal Kantor</span>
              </button>
            )}
            {onBackToPortal && <span>/</span>}
            <span className="text-cyan-400 font-bold">Buku Kas & Bank</span>
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
            <Wallet className="h-6 w-6 text-cyan-400" />
            Buku Kas & Bank PT KDRT
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Pencatatan uang masuk dan uang keluar kas & bank operasional secara langsung, sederhana, dan akurat.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            id="btn-sync-komisi-real"
            type="button"
            onClick={handleManualSync}
            disabled={syncingKomisi}
            title="Sinkronkan otomatis data Komisi Real & Uang Rajin Mingguan ke Buku Kas & Bank"
            className="flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-950/40 px-3.5 py-2.5 text-xs font-bold text-cyan-300 hover:bg-cyan-900/50 hover:text-white transition active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${syncingKomisi ? 'animate-spin' : ''}`} />
            <span>{syncingKomisi ? 'Menyinkronkan...' : 'Sinkronkan Data (Komisi & Uang Rajin)'}</span>
          </button>

          <button
            id="btn-input-uang-masuk"
            type="button"
            onClick={() => handleOpenAddModal('INCOME')}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-950/40 transition hover:bg-emerald-500 active:scale-95"
          >
            <ArrowDownLeft className="h-4 w-4" />
            <span>+ Input Uang Masuk</span>
          </button>

          <button
            id="btn-input-uang-keluar"
            type="button"
            onClick={() => handleOpenAddModal('EXPENSE')}
            className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-950/40 transition hover:bg-rose-500 active:scale-95"
          >
            <ArrowUpRight className="h-4 w-4" />
            <span>+ Input Uang Keluar</span>
          </button>
        </div>
      </div>

      {/* ============================================================
          TOP 4 DASHBOARD CARDS
      ============================================================ */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* CARD 1: TOTAL UANG MASUK */}
        <div
          id="card-total-uang-masuk"
          className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-zinc-900/95 via-zinc-900/70 to-emerald-950/30 p-5 shadow-lg flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              1. Total Uang Masuk
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ArrowDownLeft className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-black tracking-tight text-emerald-400">
              {formatRupiah(selectedMonth ? periodCalculations.totalInMonth : globalCalculations.totalIn)}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-zinc-400 border-t border-zinc-800/80 pt-2">
              <span className="font-semibold text-zinc-300">
                {selectedMonth ? formatBulanTahun(selectedMonth) : 'Semua Periode'}
              </span>
              {selectedMonth && (
                <span className="text-zinc-500 text-[11px]">
                  All-time: {formatRupiah(globalCalculations.totalIn + globalCalculations.totalOpening)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* CARD 2: TOTAL UANG KELUAR */}
        <div
          id="card-total-uang-keluar"
          className="relative overflow-hidden rounded-2xl border border-rose-500/20 bg-gradient-to-br from-zinc-900/95 via-zinc-900/70 to-rose-950/30 p-5 shadow-lg flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
              2. Total Uang Keluar
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <ArrowUpRight className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-black tracking-tight text-rose-400">
              {formatRupiah(selectedMonth ? periodCalculations.totalOutMonth : globalCalculations.totalOut)}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-zinc-400 border-t border-zinc-800/80 pt-2">
              <span className="font-semibold text-zinc-300">
                {selectedMonth ? formatBulanTahun(selectedMonth) : 'Semua Periode'}
              </span>
              {selectedMonth && (
                <span className="text-zinc-500 text-[11px]">
                  All-time: {formatRupiah(globalCalculations.totalOut)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* CARD 3: PROFIT / LOSS */}
        <div
          id="card-profit-loss"
          className={`relative overflow-hidden rounded-2xl border p-5 shadow-lg flex flex-col justify-between ${
            (selectedMonth ? periodCalculations.netMonth : globalCalculations.totalIn - globalCalculations.totalOut) >= 0
              ? 'border-emerald-500/30 bg-gradient-to-br from-zinc-900/95 via-zinc-900/70 to-emerald-950/20'
              : 'border-rose-500/30 bg-gradient-to-br from-zinc-900/95 via-zinc-900/70 to-rose-950/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
              3. Profit / Loss
            </span>
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                (selectedMonth ? periodCalculations.netMonth : globalCalculations.totalIn - globalCalculations.totalOut) >= 0
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}
            >
              {(selectedMonth ? periodCalculations.netMonth : globalCalculations.totalIn - globalCalculations.totalOut) >= 0 ? (
                <TrendingUp className="h-5 w-5" />
              ) : (
                <TrendingDown className="h-5 w-5" />
              )}
            </div>
          </div>
          <div className="mt-4">
            <div
              className={`text-2xl sm:text-3xl font-black tracking-tight ${
                (selectedMonth ? periodCalculations.netMonth : globalCalculations.totalIn - globalCalculations.totalOut) >= 0
                  ? 'text-emerald-400'
                  : 'text-rose-400'
              }`}
            >
              {(selectedMonth ? periodCalculations.netMonth : globalCalculations.totalIn - globalCalculations.totalOut) >= 0 ? '+' : ''}
              {formatRupiah(selectedMonth ? periodCalculations.netMonth : globalCalculations.totalIn - globalCalculations.totalOut)}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-zinc-400 border-t border-zinc-800/80 pt-2">
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold ${
                  (selectedMonth ? periodCalculations.netMonth : globalCalculations.totalIn - globalCalculations.totalOut) >= 0
                    ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-950/60 text-rose-400 border border-rose-500/30'
                }`}
              >
                {(selectedMonth ? periodCalculations.netMonth : globalCalculations.totalIn - globalCalculations.totalOut) >= 0
                  ? 'Surplus (Profit)'
                  : 'Defisit (Loss)'}
              </span>
              {selectedMonth && (
                <span className="text-zinc-500 text-[11px]">
                  All-time: {globalCalculations.totalIn - globalCalculations.totalOut >= 0 ? '+' : ''}
                  {formatRupiah(globalCalculations.totalIn - globalCalculations.totalOut)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* CARD 4: SALDO REAL PT KDRT (MANUAL INPUT OWNER) */}
        <div
          id="card-saldo-real-pt-kdrt"
          className="relative overflow-hidden rounded-2xl border border-cyan-500/40 bg-gradient-to-br from-zinc-900/95 via-zinc-900/80 to-cyan-950/40 p-5 shadow-lg flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                4. Saldo Real PT KDRT
              </span>
              <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300 border border-cyan-500/30">
                Input Owner
              </span>
            </div>
            {isOwnerOrManager ? (
              <button
                id="btn-edit-saldo-real"
                type="button"
                onClick={handleOpenEditSaldoRealModal}
                title="Edit Saldo Real PT KDRT"
                className="flex h-8 items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-950/60 px-2.5 text-xs font-bold text-cyan-300 hover:bg-cyan-900 hover:text-white transition active:scale-95 shadow"
              >
                <Edit className="h-3.5 w-3.5" />
                <span>Edit</span>
              </button>
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-zinc-500" title="Hanya Owner yang dapat mengubah">
                <Lock className="h-4 w-4" />
              </div>
            )}
          </div>
          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-baseline gap-2">
              <span>{formatRupiah(Number(saldoRealData?.amount) || 0)}</span>
            </div>
            <div className="mt-2 flex flex-col gap-1 border-t border-zinc-800/80 pt-2 text-xs">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-[11px] text-zinc-400 truncate">
                  {saldoRealData?.updatedAt ? `Update: ${formatTimestampWIB(saldoRealData.updatedAt)}` : 'Belum diinput Owner'}
                </span>
                {saldoRealData?.updatedByName && (
                  <span className="text-[10px] text-cyan-400 font-semibold truncate max-w-[90px]">
                    oleh {saldoRealData.updatedByName}
                  </span>
                )}
              </div>
              {saldoRealData?.notes && (
                <p className="text-[11px] text-zinc-400 truncate italic">
                  "{saldoRealData.notes}"
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          FILTER & CONTROLS SECTION
      ============================================================ */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-md backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: Periode Bulan Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-xl border border-zinc-700 bg-zinc-800/80 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={handlePrevMonth}
                title="Bulan Sebelumnya"
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-white transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-2 px-3 py-1">
                <Calendar className="h-4 w-4 text-cyan-400" />
                <span className="font-bold text-white">
                  {selectedMonth ? formatBulanTahun(selectedMonth) : 'Semua Periode'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                title="Bulan Berikutnya"
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-white transition"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Quick Month Switcher / All Button */}
            {selectedMonth ? (
              <button
                type="button"
                onClick={() => setSelectedMonth('')}
                className="rounded-xl border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 hover:text-white transition"
              >
                Lihat Semua Periode
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSelectedMonth(bulanHariIni())}
                className="rounded-xl border border-cyan-500/40 bg-cyan-950/40 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/50 transition"
              >
                Bulan Ini ({formatBulanTahun(bulanHariIni())})
              </button>
            )}

            {/* Filter Jenis Transaksi */}
            <div className="flex items-center rounded-xl border border-zinc-700 bg-zinc-800/80 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFilterType('ALL')}
                className={`rounded-lg px-2.5 py-1.5 transition ${
                  filterType === 'ALL'
                    ? 'bg-zinc-700 text-white font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setFilterType('INCOME')}
                className={`rounded-lg px-2.5 py-1.5 transition ${
                  filterType === 'INCOME'
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'text-zinc-400 hover:text-emerald-300'
                }`}
              >
                Uang Masuk
              </button>
              <button
                type="button"
                onClick={() => setFilterType('EXPENSE')}
                className={`rounded-lg px-2.5 py-1.5 transition ${
                  filterType === 'EXPENSE'
                    ? 'bg-rose-600 text-white font-bold'
                    : 'text-zinc-400 hover:text-rose-300'
                }`}
              >
                Uang Keluar
              </button>
            </div>

            {/* Filter Akun Dropdown */}
            <div className="relative">
              <select
                id="filter-akun-select"
                value={filterAccount}
                onChange={(e) => setFilterAccount(e.target.value)}
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-200 focus:border-cyan-500 focus:outline-none"
              >
                <option value="ALL">Semua Akun (Kas & Bank)</option>
                {allAccountNames.map((acc) => (
                  <option key={acc} value={acc}>
                    {acc}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Right: Search Input */}
          <div className="relative min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              id="input-search-transaksi"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari keterangan, kategori..."
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-cyan-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================
          TABEL TRANSAKSI BUKU KAS & BANK
      ============================================================ */}
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-cyan-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Daftar Transaksi Buku Kas & Bank
            </h2>
            <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-bold text-zinc-400">
              {filteredTransactions.length} Transaksi
            </span>
          </div>

          <div className="text-xs text-zinc-400">
            {selectedMonth ? (
              <span>Periode: <strong className="text-white">{formatBulanTahun(selectedMonth)}</strong></span>
            ) : (
              <span>Menampilkan: <strong className="text-white">Semua Transaksi</strong></span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-cyan-400" />
            <p className="mt-3 text-xs font-semibold text-zinc-400">
              Memuat data transaksi Buku Kas & Bank...
            </p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800/80 text-zinc-500 mb-3">
              <Wallet className="h-7 w-7" />
            </div>
            <h3 className="text-sm font-bold text-zinc-200">Belum Ada Transaksi</h3>
            <p className="mt-1 text-xs text-zinc-500 max-w-sm">
              Tidak ada catatan transaksi pada filter atau periode ini. Klik tombol di bawah untuk mencatat transaksi baru.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenAddModal('INCOME')}
                className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition"
              >
                + Input Uang Masuk
              </button>
              <button
                type="button"
                onClick={() => handleOpenAddModal('EXPENSE')}
                className="rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-rose-500 transition"
              >
                + Input Uang Keluar
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-800 bg-zinc-950/60 font-bold uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="py-3.5 pl-5 pr-3">Tanggal</th>
                  <th className="px-3 py-3.5">Jenis</th>
                  <th className="px-3 py-3.5">Keterangan</th>
                  <th className="px-3 py-3.5">Kategori</th>
                  <th className="px-3 py-3.5">Akun</th>
                  <th className="px-3 py-3.5 text-right text-emerald-400">Uang Masuk</th>
                  <th className="px-3 py-3.5 text-right text-rose-400">Uang Keluar</th>
                  <th className="px-3 py-3.5 text-right text-cyan-400">Saldo</th>
                  <th className="py-3.5 pl-3 pr-5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-medium text-zinc-300">
                {filteredTransactions.map((tx) => {
                  const isIncome = tx.type === 'INCOME' || tx.type === 'OPENING_BALANCE';
                  const isExpense = tx.type === 'EXPENSE';
                  const nominal = Number(tx.amount) || 0;
                  const acc = tx.accountName || (tx as any).account || tx.accountId || 'Kas Tunai';
                  const isCommissionReal =
                    tx.sourceType === 'COMMISSION_REAL' ||
                    (tx.id || '').startsWith('COMMISSION_REAL_') ||
                    Boolean(tx.sourcePerformanceId);
                  const isWithdrawal =
                    tx.sourceType === 'WITHDRAWAL' ||
                    (tx.id || '').startsWith('WITHDRAWAL_');
                  const isUangRajin =
                    tx.sourceType === 'ATTENDANCE_BONUS' ||
                    (tx.id || '').startsWith('UANG_RAJIN_') ||
                    (tx.id || '').startsWith('ATTENDANCE_BONUS_') ||
                    Boolean(
                      tx.referenceId &&
                        (tx.category === 'Uang Rajin Mingguan' ||
                          tx.description?.toLowerCase().includes('uang rajin'))
                    );

                  return (
                    <tr
                      key={tx.id || tx.transactionId}
                      className="hover:bg-zinc-800/40 transition-colors group"
                    >
                      {/* 1. Tanggal */}
                      <td className="py-3.5 pl-5 pr-3 whitespace-nowrap text-zinc-300 font-medium">
                        {formatTanggal(tx.date)}
                      </td>

                      {/* 2. Jenis */}
                      <td className="px-3 py-3.5 whitespace-nowrap">
                        {isIncome ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-400 border border-emerald-500/30">
                            <ArrowDownLeft className="h-3 w-3" />
                            {tx.type === 'OPENING_BALANCE' ? 'Saldo Awal' : 'Uang Masuk'}
                          </span>
                        ) : isExpense ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-2 py-0.5 text-[11px] font-bold text-rose-400 border border-rose-500/30">
                            <ArrowUpRight className="h-3 w-3" />
                            Uang Keluar
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/15 px-2 py-0.5 text-[11px] font-bold text-indigo-400 border border-indigo-500/30">
                            {tx.type}
                          </span>
                        )}
                      </td>

                      {/* 3. Keterangan */}
                      <td className="px-3 py-3.5 max-w-[280px]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-white truncate" title={tx.description}>
                            {tx.description || '-'}
                          </span>
                          {isCommissionReal && (
                            <span className="inline-flex items-center gap-1 rounded bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-bold text-cyan-400 border border-cyan-500/30 shrink-0">
                              Komisi Real TikTok
                            </span>
                          )}
                          {isWithdrawal && (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30 shrink-0">
                              Penarikan Medsos
                            </span>
                          )}
                          {isUangRajin && (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/30 shrink-0">
                              Uang Rajin
                            </span>
                          )}
                        </div>
                        {tx.notes && (
                          <div className="text-[11px] text-zinc-500 truncate" title={tx.notes}>
                            {tx.notes}
                          </div>
                        )}
                      </td>

                      {/* 4. Kategori */}
                      <td className="px-3 py-3.5 whitespace-nowrap">
                        <span className="inline-block rounded-md bg-zinc-800 px-2 py-0.5 text-[11px] font-semibold text-zinc-300 border border-zinc-700/60">
                          {tx.category || '-'}
                        </span>
                      </td>

                      {/* 5. Akun */}
                      <td className="px-3 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-semibold text-zinc-200">
                          <Landmark className="h-3 w-3 text-zinc-400" />
                          {acc}
                        </span>
                      </td>

                      {/* 6. Uang Masuk */}
                      <td className="px-3 py-3.5 whitespace-nowrap text-right font-mono font-bold text-emerald-400">
                        {isIncome ? formatRupiah(nominal) : '-'}
                      </td>

                      {/* 7. Uang Keluar */}
                      <td className="px-3 py-3.5 whitespace-nowrap text-right font-mono font-bold text-rose-400">
                        {isExpense ? formatRupiah(nominal) : '-'}
                      </td>

                      {/* 8. Saldo Berjalan */}
                      <td className="px-3 py-3.5 whitespace-nowrap text-right font-mono font-bold text-zinc-200">
                        {formatRupiah((tx as any).runningBalance)}
                      </td>

                      {/* 9. Aksi (Edit & Hapus) */}
                      <td className="py-3.5 pl-3 pr-5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(tx)}
                            title="Edit Transaksi"
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300 hover:bg-amber-500/20 hover:text-amber-300 transition"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenDeleteModal(tx)}
                            title="Hapus Transaksi"
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300 hover:bg-rose-500/20 hover:text-rose-300 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============================================================
          MODAL: TAMBAH / EDIT TRANSAKSI
      ============================================================ */}
      {isModalOpen && (
        <div
          id="modal-transaksi"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fadeIn"
        >
          <div className="relative w-full max-w-lg rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    formType === 'INCOME'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {formType === 'INCOME' ? (
                    <ArrowDownLeft className="h-5 w-5" />
                  ) : (
                    <ArrowUpRight className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {isEditing ? 'Edit Transaksi' : 'Input Transaksi Baru'}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Pencatatan manual Buku Kas & Bank PT KDRT
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Error Message */}
            {formError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-950/50 p-3 text-xs font-semibold text-rose-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Modal Form */}
            <form onSubmit={handleSaveTransaction} className="mt-4 space-y-4 text-xs">
              {/* Jenis Transaksi Selector (Uang Masuk / Uang Keluar) */}
              <div>
                <label className="block font-bold text-zinc-300 mb-1.5">
                  Jenis Transaksi <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormType('INCOME');
                      setFormCategory(PRESET_INCOME_CATEGORIES[0]);
                    }}
                    className={`flex items-center justify-center gap-2 rounded-xl py-2.5 font-bold transition border ${
                      formType === 'INCOME'
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
                    }`}
                  >
                    <ArrowDownLeft className="h-4 w-4" />
                    <span>UANG MASUK</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormType('EXPENSE');
                      setFormCategory(PRESET_EXPENSE_CATEGORIES[0]);
                    }}
                    className={`flex items-center justify-center gap-2 rounded-xl py-2.5 font-bold transition border ${
                      formType === 'EXPENSE'
                        ? 'bg-rose-600 text-white border-rose-500 shadow-md'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
                    }`}
                  >
                    <ArrowUpRight className="h-4 w-4" />
                    <span>UANG KELUAR</span>
                  </button>
                </div>
              </div>

              {/* Tanggal & Nominal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-300 mb-1">
                    Tanggal Transaksi <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-300 mb-1">
                    Nominal Transaksi (Rp) <span className="text-rose-400">*</span>
                  </label>
                  <CurrencyInput
                    value={formAmount}
                    onChange={(val) => setFormAmount(val)}
                    placeholder="Rp 0"
                    required
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800 pl-10 pr-3 py-2.5 text-xs text-white font-mono font-bold focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Keterangan */}
              <div>
                <label className="block font-bold text-zinc-300 mb-1">
                  Keterangan <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Contoh: Pencairan komisi live streaming TikTok / Pembayaran sewa studio"
                  required
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              {/* Kategori */}
              <div>
                <label className="block font-bold text-zinc-300 mb-1">
                  Kategori <span className="text-rose-400">*</span>
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                >
                  {(formType === 'INCOME' ? PRESET_INCOME_CATEGORIES : PRESET_EXPENSE_CATEGORIES).map(
                    (cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    )
                  )}
                  <option value="CUSTOM">+ Kategori Lainnya (Ketik Manual)</option>
                </select>

                {formCategory === 'CUSTOM' && (
                  <input
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="Masukkan nama kategori baru..."
                    required
                    className="mt-2 w-full rounded-xl border border-cyan-500/50 bg-zinc-800 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-cyan-400 focus:outline-none"
                  />
                )}
              </div>

              {/* Akun Kas / Bank */}
              <div>
                <label className="block font-bold text-zinc-300 mb-1">
                  Akun Kas / Bank <span className="text-rose-400">*</span>
                </label>
                <select
                  value={formAccount}
                  onChange={(e) => setFormAccount(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
                >
                  {PRESET_ACCOUNTS.map((acc) => (
                    <option key={acc} value={acc}>
                      {acc}
                    </option>
                  ))}
                  <option value="CUSTOM">+ Akun Bank Lainnya (Ketik Manual)</option>
                </select>

                {formAccount === 'CUSTOM' && (
                  <input
                    type="text"
                    value={customAccount}
                    onChange={(e) => setCustomAccount(e.target.value)}
                    placeholder="Masukkan nama akun bank atau dompet..."
                    required
                    className="mt-2 w-full rounded-xl border border-cyan-500/50 bg-zinc-800 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-cyan-400 focus:outline-none"
                  />
                )}
              </div>

              {/* Catatan Tambahan (Opsional) */}
              <div>
                <label className="block font-bold text-zinc-300 mb-1">
                  Catatan (Opsional)
                </label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  placeholder="Catatan pelengkap jika ada..."
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              {/* Modal Footer Buttons */}
              <div className="flex items-center justify-end gap-2.5 border-t border-zinc-800 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-lg transition ${
                    formType === 'INCOME'
                      ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/40'
                      : 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/40'
                  } ${submitting ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {submitting && <RefreshCw className="h-4 w-4 animate-spin" />}
                  <span>{isEditing ? 'Simpan Perubahan' : 'Simpan Transaksi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL: KONFIRMASI HAPUS TRANSAKSI
      ============================================================ */}
      {isDeleteModalOpen && deletingTransaction && (
        <div
          id="modal-hapus-transaksi"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fadeIn"
        >
          <div className="relative w-full max-w-md rounded-2xl border border-rose-500/30 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Konfirmasi Hapus Transaksi</h3>
                <p className="text-xs text-zinc-400">Tindakan ini tidak dapat dibatalkan.</p>
              </div>
            </div>

            {/* Detail Transaksi yang akan dihapus */}
            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3.5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-400">Tanggal:</span>
                <span className="font-semibold text-zinc-200">{formatTanggal(deletingTransaction.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Jenis:</span>
                <span
                  className={`font-bold ${
                    deletingTransaction.type === 'INCOME' ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {deletingTransaction.type === 'INCOME' ? 'UANG MASUK' : 'UANG KELUAR'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Keterangan:</span>
                <span className="font-semibold text-zinc-200 max-w-[200px] text-right truncate">
                  {deletingTransaction.description}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Akun:</span>
                <span className="font-semibold text-zinc-200">
                  {deletingTransaction.accountName || (deletingTransaction as any).account || '-'}
                </span>
              </div>
              <div className="flex justify-between border-t border-zinc-800 pt-2">
                <span className="text-zinc-400">Nominal:</span>
                <span className="font-mono font-bold text-white text-sm">
                  {formatRupiah(deletingTransaction.amount)}
                </span>
              </div>
            </div>

            <p className="mt-3 text-xs text-zinc-400">
              Apakah Anda yakin ingin menghapus data transaksi ini secara permanen dari Firebase?
            </p>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeletingTransaction(null);
                }}
                disabled={deleteLoading}
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
                className="flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-950/50 hover:bg-rose-500 transition disabled:opacity-60"
              >
                {deleteLoading && <RefreshCw className="h-4 w-4 animate-spin" />}
                <span>Hapus Transaksi</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL: EDIT SALDO REAL PT KDRT (INPUT MANUAL OWNER)
      ============================================================ */}
      {isEditSaldoRealModalOpen && (
        <div
          id="modal-edit-saldo-real"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fadeIn"
        >
          <div className="relative w-full max-w-lg rounded-2xl border border-cyan-500/40 bg-zinc-900 p-6 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Edit Saldo Real PT KDRT
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Input manual saldo kas/bank riil perusahaan oleh Owner
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditSaldoRealModalOpen(false)}
                disabled={saldoRealSaving}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Explanation Note */}
            <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-950/30 p-3.5 text-xs text-cyan-200/90 leading-relaxed">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-cyan-300">Catatan Saldo Aktual:</span>
                  <p className="mt-0.5 text-zinc-300">
                    Angka ini merupakan saldo kas/bank fisik aktual PT KDRT yang diinput mandiri oleh Owner. Nilai ini tidak terpengaruh oleh kalkulasi transaksi harian.
                  </p>
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveSaldoReal} className="mt-4 space-y-4 text-xs">
              {/* Saldo Saat Ini (Read-only reference) */}
              <div>
                <label className="block font-bold text-zinc-400 mb-1">
                  Saldo Real Saat Ini
                </label>
                <div className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm font-bold text-zinc-300">
                  {formatRupiah(Number(saldoRealData?.amount) || 0)}
                  {saldoRealData?.updatedAt && (
                    <span className="ml-2 text-[11px] font-normal text-zinc-500">
                      (Diperbarui: {formatTimestampWIB(saldoRealData.updatedAt)})
                    </span>
                  )}
                </div>
              </div>

              {/* Saldo Real Baru (Input) */}
              <div>
                <label className="block font-bold text-zinc-200 mb-1">
                  Saldo Real Baru (Rp) <span className="text-cyan-400">*</span>
                </label>
                <CurrencyInput
                  value={saldoRealAmountInput}
                  onChange={(val) => setSaldoRealAmountInput(val)}
                  placeholder="0"
                  required
                  className="w-full rounded-xl border border-cyan-500/50 bg-zinc-800 px-3.5 py-3 text-base font-bold text-white placeholder-zinc-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
              </div>

              {/* Catatan / Keterangan Penyesuaian */}
              <div>
                <label className="block font-bold text-zinc-200 mb-1">
                  Catatan / Keterangan Penyesuaian (Opsional)
                </label>
                <textarea
                  value={saldoRealNotesInput}
                  onChange={(e) => setSaldoRealNotesInput(e.target.value)}
                  rows={2}
                  placeholder="Contoh: Rekening BCA + kas operasional kantor per 28 Agustus 2026"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 border-t border-zinc-800 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditSaldoRealModalOpen(false)}
                  disabled={saldoRealSaving}
                  className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saldoRealSaving}
                  className="flex items-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-cyan-950/50 transition active:scale-95 disabled:opacity-60"
                >
                  {saldoRealSaving && <RefreshCw className="h-4 w-4 animate-spin" />}
                  <span>{saldoRealSaving ? 'Menyimpan...' : 'Simpan Saldo Real'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL: HASIL SINKRONISASI KOMISI REAL
      ============================================================ */}
      {isSyncModalOpen && syncSummary && (
        <div
          id="modal-sync-summary"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fadeIn"
        >
          <div className="relative w-full max-w-lg rounded-2xl border border-cyan-500/40 bg-zinc-900 p-6 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Hasil Sinkronisasi Komisi Real
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Data Omset / Komisi Real &rarr; Buku Kas & Bank
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSyncModalOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Metrics Grid */}
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3">
                <div className="text-[11px] font-semibold text-emerald-400">Transaksi Baru</div>
                <div className="mt-1 text-xl font-black text-white">{syncSummary.totalNew}</div>
                <div className="text-[10px] text-emerald-300/80">Ditambahkan ke Buku Kas</div>
              </div>

              <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3">
                <div className="text-[11px] font-semibold text-cyan-400">Diperbarui</div>
                <div className="mt-1 text-xl font-black text-white">{syncSummary.totalUpdated}</div>
                <div className="text-[10px] text-cyan-300/80">Penyesuaian nominal/data</div>
              </div>

              <div className="rounded-xl border border-zinc-700 bg-zinc-800/40 p-3">
                <div className="text-[11px] font-semibold text-zinc-300">Sudah Sesuai</div>
                <div className="mt-1 text-xl font-black text-white">{syncSummary.totalAlreadySynced}</div>
                <div className="text-[10px] text-zinc-400">Tidak ada perubahan</div>
              </div>

              <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-3">
                <div className="text-[11px] font-semibold text-indigo-400">Duplikasi</div>
                <div className="mt-1 text-xl font-black text-white">0</div>
                <div className="text-[10px] text-indigo-300/80">Anti-duplicate terjamin</div>
              </div>
            </div>

            {/* Details List if any additions or updates */}
            {syncSummary.details && syncSummary.details.length > 0 && (
              <div className="mt-4">
                <label className="block text-[11px] font-bold text-zinc-400 mb-1.5">
                  Rincian Data yang Diproses ({syncSummary.details.length}):
                </label>
                <div className="max-h-40 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/80 p-2.5 space-y-1 text-[11px] font-mono text-zinc-300">
                  {syncSummary.details.map((detail, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 py-0.5">
                      <span className="text-cyan-400">&bull;</span>
                      <span>{detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-5 flex justify-end border-t border-zinc-800 pt-4">
              <button
                type="button"
                onClick={() => setIsSyncModalOpen(false)}
                className="rounded-xl bg-cyan-600 hover:bg-cyan-500 px-5 py-2 text-xs font-bold text-white transition active:scale-95"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
