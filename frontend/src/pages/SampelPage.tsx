import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  Download,
  Calendar,
  User,
  Smartphone,
  ExternalLink,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Truck,
  CheckCheck,
  PlayCircle,
  DollarSign,
  Share2,
  Lock,
  ChevronRight,
  Home,
  RefreshCw,
  ShoppingBag,
  ArrowRight,
  TrendingUp,
  Tag,
  AlertTriangle,
  XCircle,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  AffiliateSample,
  SampleStatus,
  Product,
  Account,
  Employee,
  ScopeType,
} from '../types';
import {
  subscribeSamples,
  createSample,
  updateSample,
  updateSampleStatus,
  updateSampleContentProgress,
  recordSampleExpense,
  deleteSample,
} from '../services/sampleService';
import { subscribeProducts } from '../services/productService';
import { subscribeAccounts } from '../services/accountService';
import { subscribeEmployees } from '../services/employeeService';
import { formatRupiah, formatTanggal, tanggalHariIni, exportToCSV } from '../utils/formatters';

interface SampelPageProps {
  onBackToPortal?: () => void;
  onNavigateToProduk?: () => void;
  initialProductId?: string;
}

const STATUS_FLOW: SampleStatus[] = ['DIPESAN', 'DIKIRIM', 'DITERIMA', 'DIGUNAKAN', 'SELESAI'];

export const SampelPage: React.FC<SampelPageProps> = ({
  onBackToPortal,
  onNavigateToProduk,
  initialProductId,
}) => {
  const { userProfile, role, loading: authLoading, currentUser } = useAuth();
  const isOwner = role === 'OWNER';
  const isManager = role === 'MANAGER';
  const isEmployee = role === 'EMPLOYEE';
  const isInvestor = role === 'INVESTOR';

  const [samples, setSamples] = useState<AffiliateSample[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<SampleStatus | 'SEMUA'>('SEMUA');
  const [accountFilter, setAccountFilter] = useState<string>('SEMUA');
  const [employeeFilter, setEmployeeFilter] = useState<string>('SEMUA');
  const [scopeFilter, setScopeFilter] = useState<'SEMUA' | ScopeType>('SEMUA');
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7) // e.g. "2026-08"
  );

  // Modals & UI States
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingSample, setEditingSample] = useState<AffiliateSample | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [deletingSample, setDeletingSample] = useState<AffiliateSample | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    productId: string;
    productName: string;
    productUrl: string;
    productImage: string;
    samplePrice: number;
    purchaseDate: string;
    quantity: number;
    totalCost: number;
    status: SampleStatus;
    accountId: string;
    employeeId: string;
    targetContent: number;
    completedContent: number;
    unitContent: string;
    scope: ScopeType;
    autoCreateExpense: boolean;
    autoCreateTask: boolean;
    notes: string;
  }>({
    productId: '',
    productName: '',
    productUrl: '',
    productImage: '',
    samplePrice: 0,
    purchaseDate: tanggalHariIni(),
    quantity: 1,
    totalCost: 0,
    status: 'DIPESAN',
    accountId: '',
    employeeId: '',
    targetContent: 3,
    completedContent: 0,
    unitContent: 'VT',
    scope: 'PRIBADI',
    autoCreateExpense: true,
    autoCreateTask: true,
    notes: '',
  });

  // Load Initial Subscriptions
  useEffect(() => {
    if (authLoading || !currentUser || !userProfile?.active) {
      return;
    }
    setLoading(true);

    const unsubSamples = subscribeSamples(undefined, (sampleList) => {
      let filtered = sampleList;
      if (isInvestor) {
        filtered = sampleList.filter((s) => s.scope === 'SHARING');
      } else if (isEmployee && !userProfile?.permissions?.canReadPrivate) {
        // Employee view: self assigned or permitted
        filtered = sampleList.filter(
          (s) =>
            s.employeeId === userProfile?.employeeId ||
            s.createdBy === userProfile?.uid ||
            s.scope === 'SHARING'
        );
      }
      setSamples(filtered);
      setLoading(false);
    });

    const unsubProducts = subscribeProducts(undefined, (prodList) => {
      setProducts(prodList.filter((p) => p.status === 'AKTIF'));
    });

    const unsubAccounts = subscribeAccounts(undefined, (accList) => {
      setAccounts(accList.filter((a) => a.active));
    });

    const unsubEmployees = subscribeEmployees(undefined, (empList) => {
      setEmployees(empList.filter((e) => e.active !== false));
    });

    return () => {
      unsubSamples();
      unsubProducts();
      unsubAccounts();
      unsubEmployees();
    };
  }, [authLoading, currentUser?.uid, userProfile?.role, userProfile?.active, isInvestor, isEmployee]);

  // If initialProductId was passed, trigger open modal for that product
  useEffect(() => {
    if (initialProductId && products.length > 0 && !isInvestor) {
      const p = products.find((prod) => prod.id === initialProductId);
      if (p) {
        handleOpenAddWithProduct(p);
      }
    }
  }, [initialProductId, products]);

  // Filtered Samples
  const filteredSamples = useMemo(() => {
    return samples.filter((s) => {
      if (scopeFilter !== 'SEMUA' && s.scope !== scopeFilter) return false;
      if (statusFilter !== 'SEMUA' && s.status !== statusFilter) return false;
      if (accountFilter !== 'SEMUA' && s.accountId !== accountFilter) return false;
      if (employeeFilter !== 'SEMUA' && s.employeeId !== employeeFilter) return false;

      // Month filter if selected
      if (selectedMonth && s.purchaseDate && !s.purchaseDate.startsWith(selectedMonth)) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const prodMatch = s.productName?.toLowerCase().includes(query);
        const accMatch = s.accountName?.toLowerCase().includes(query);
        const empMatch = s.employeeName?.toLowerCase().includes(query);
        const notesMatch = s.notes?.toLowerCase().includes(query);
        const statusMatch = s.status?.toLowerCase().includes(query);
        if (!prodMatch && !accMatch && !empMatch && !notesMatch && !statusMatch) return false;
      }
      return true;
    });
  }, [samples, scopeFilter, statusFilter, accountFilter, employeeFilter, selectedMonth, searchQuery]);

  // Dashboard Metrics
  const metrics = useMemo(() => {
    const totalCount = samples.length;
    const currentMonthPrefix = selectedMonth || new Date().toISOString().slice(0, 7);

    // Current month samples
    const currentMonthSamples = samples.filter(
      (s) => s.purchaseDate && s.purchaseDate.startsWith(currentMonthPrefix)
    );

    const totalCostAll = samples.reduce((sum, s) => sum + (Number(s.totalCost) || 0), 0);
    const totalCostMonth = currentMonthSamples.reduce(
      (sum, s) => sum + (Number(s.totalCost) || 0),
      0
    );

    const dipesan = samples.filter((s) => s.status === 'DIPESAN').length;
    const dikirim = samples.filter((s) => s.status === 'DIKIRIM').length;
    const diterima = samples.filter((s) => s.status === 'DITERIMA').length;
    const digunakan = samples.filter((s) => s.status === 'DIGUNAKAN').length;
    const selesai = samples.filter((s) => s.status === 'SELESAI').length;

    // Content target not reached yet
    const belumSelesaiKonten = samples.filter(
      (s) => (Number(s.completedContent) || 0) < (Number(s.targetContent) || 1)
    ).length;

    return {
      totalCount,
      totalCostAll,
      totalCostMonth,
      dipesan,
      dikirim,
      diterima,
      digunakan,
      selesai,
      belumSelesaiKonten,
    };
  }, [samples, selectedMonth]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingSample(null);
    const defaultProduct = products[0];
    const defaultAccount = accounts[0];
    const defaultEmployee = employees[0];

    const initialPrice = defaultProduct ? defaultProduct.productPrice : 0;

    setFormData({
      productId: defaultProduct ? defaultProduct.id || '' : '',
      productName: defaultProduct ? defaultProduct.productName : '',
      productUrl: defaultProduct ? defaultProduct.productUrl || '' : '',
      productImage: defaultProduct ? defaultProduct.productImage || defaultProduct.photoUrl || '' : '',
      samplePrice: initialPrice,
      purchaseDate: tanggalHariIni(),
      quantity: 1,
      totalCost: initialPrice * 1,
      status: 'DIPESAN',
      accountId: defaultAccount ? defaultAccount.id || '' : '',
      employeeId: defaultEmployee ? defaultEmployee.id || '' : '',
      targetContent: 3,
      completedContent: 0,
      unitContent: 'VT',
      scope: defaultProduct ? defaultProduct.scope : 'PRIBADI',
      autoCreateExpense: true,
      autoCreateTask: true,
      notes: '',
    });
    setActionError(null);
    setIsModalOpen(true);
  };

  // Open Add with specific product
  const handleOpenAddWithProduct = (p: Product) => {
    setEditingSample(null);
    const defaultAccount = accounts.find((a) => p.accountIds?.includes(a.id || '')) || accounts[0];
    const defaultEmployee = employees[0];

    setFormData({
      productId: p.id || '',
      productName: p.productName,
      productUrl: p.productUrl || '',
      productImage: p.productImage || p.photoUrl || '',
      samplePrice: p.productPrice,
      purchaseDate: tanggalHariIni(),
      quantity: 1,
      totalCost: p.productPrice * 1,
      status: 'DIPESAN',
      accountId: defaultAccount ? defaultAccount.id || '' : '',
      employeeId: defaultEmployee ? defaultEmployee.id || '' : '',
      targetContent: 3,
      completedContent: 0,
      unitContent: 'VT',
      scope: p.scope,
      autoCreateExpense: true,
      autoCreateTask: true,
      notes: '',
    });
    setActionError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (sample: AffiliateSample) => {
    setEditingSample(sample);
    setFormData({
      productId: sample.productId,
      productName: sample.productName,
      productUrl: sample.productUrl || '',
      productImage: sample.productImage || '',
      samplePrice: sample.samplePrice,
      purchaseDate: sample.purchaseDate || tanggalHariIni(),
      quantity: sample.quantity,
      totalCost: sample.totalCost,
      status: sample.status,
      accountId: sample.accountId || '',
      employeeId: sample.employeeId || '',
      targetContent: sample.targetContent || 3,
      completedContent: sample.completedContent || 0,
      unitContent: sample.unitContent || 'VT',
      scope: sample.scope,
      autoCreateExpense: false,
      autoCreateTask: false,
      notes: sample.notes || '',
    });
    setActionError(null);
    setIsModalOpen(true);
  };

  // Handle Product Select change in form
  const handleProductChange = (prodId: string) => {
    const selected = products.find((p) => p.id === prodId);
    if (selected) {
      const price = selected.productPrice;
      const qty = formData.quantity || 1;
      setFormData((prev) => ({
        ...prev,
        productId: selected.id || '',
        productName: selected.productName,
        productUrl: selected.productUrl || '',
        productImage: selected.productImage || selected.photoUrl || '',
        samplePrice: price,
        totalCost: price * qty,
        scope: selected.scope,
        accountId:
          selected.accountId ||
          (selected.accountIds && selected.accountIds[0]) ||
          prev.accountId,
      }));
    }
  };

  // Handle Qty / Price calculation
  const handleQtyPriceChange = (price: number, qty: number) => {
    const validPrice = Math.max(0, price);
    const validQty = Math.max(1, qty);
    setFormData((prev) => ({
      ...prev,
      samplePrice: validPrice,
      quantity: validQty,
      totalCost: validPrice * validQty,
    }));
  };

  // Submit Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.productName.trim()) {
      setActionError('Nama produk sampel wajib dipilih atau diisi.');
      return;
    }

    setSubmitting(true);
    setActionError(null);

    const selectedAccount = accounts.find((a) => a.id === formData.accountId);
    const selectedEmployee = employees.find((e) => e.id === formData.employeeId);

    try {
      if (editingSample && editingSample.id) {
        await updateSample(
          editingSample.id,
          editingSample,
          {
            productId: formData.productId,
            productName: formData.productName,
            productUrl: formData.productUrl,
            productImage: formData.productImage,
            samplePrice: Number(formData.samplePrice),
            quantity: Number(formData.quantity),
            totalCost: Number(formData.totalCost),
            purchaseDate: formData.purchaseDate,
            status: formData.status,
            accountId: formData.accountId,
            accountName: selectedAccount?.accountName || editingSample.accountName || '',
            employeeId: formData.employeeId,
            employeeName: selectedEmployee?.name || editingSample.employeeName || '',
            targetContent: Number(formData.targetContent),
            completedContent: Number(formData.completedContent),
            unitContent: formData.unitContent,
            scope: formData.scope,
            notes: formData.notes.trim(),
          },
          userProfile?.uid || 'anonymous',
          userProfile?.name || 'User'
        );
        showToast(`Data sampel "${formData.productName}" berhasil diperbarui!`);
      } else {
        await createSample(
          {
            productId: formData.productId,
            productName: formData.productName,
            productUrl: formData.productUrl,
            productImage: formData.productImage,
            samplePrice: Number(formData.samplePrice),
            quantity: Number(formData.quantity),
            totalCost: Number(formData.totalCost),
            purchaseDate: formData.purchaseDate,
            status: formData.status,
            accountId: formData.accountId,
            accountName: selectedAccount?.accountName || '',
            employeeId: formData.employeeId,
            employeeName: selectedEmployee?.name || '',
            targetContent: Number(formData.targetContent),
            completedContent: Number(formData.completedContent),
            unitContent: formData.unitContent,
            scope: formData.scope,
            notes: formData.notes.trim(),
            createdBy: userProfile?.uid || 'anonymous',
          },
          formData.autoCreateExpense,
          formData.autoCreateTask,
          userProfile?.uid || 'anonymous',
          userProfile?.name || 'User'
        );
        showToast(`Sampel "${formData.productName}" berhasil dicatat!`);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Error saving sample:', err);
      setActionError(err.message || 'Gagal menyimpan data sampel.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Quick Status Change
  const handleStatusChange = async (sample: AffiliateSample, newStatus: SampleStatus) => {
    if (!sample.id) return;
    try {
      await updateSampleStatus(
        sample.id,
        sample,
        newStatus,
        userProfile?.uid || 'anonymous',
        userProfile?.name || 'User'
      );
      showToast(`Status sampel ${sample.productName} diubah ke ${newStatus}`);
    } catch (err: any) {
      alert(`Gagal mengubah status sampel: ${err.message}`);
    }
  };

  // Handle Quick Increment Content (+1 VT)
  const handleIncrementContent = async (sample: AffiliateSample) => {
    if (!sample.id) return;
    const current = Number(sample.completedContent) || 0;
    const next = current + 1;
    try {
      await updateSampleContentProgress(
        sample.id,
        sample,
        next,
        userProfile?.uid || 'anonymous',
        userProfile?.name || 'User'
      );
      showToast(
        `Progress konten ${sample.productName}: ${next}/${sample.targetContent} ${sample.unitContent || 'VT'}`
      );
    } catch (err: any) {
      alert(`Gagal update konten: ${err.message}`);
    }
  };

  // Handle Record Expense Anti-Double-Entry
  const handleRecordExpense = async (sample: AffiliateSample) => {
    if (!sample.id) return;
    try {
      const result = await recordSampleExpense(
        sample.id,
        sample,
        userProfile?.uid || 'anonymous',
        userProfile?.name || 'User'
      );

      if (result.success) {
        showToast(result.message);
      } else {
        alert(result.message);
      }
    } catch (err: any) {
      alert(`Gagal mencatat pengeluaran sampel: ${err.message}`);
    }
  };

  // Delete Sample
  const handleDeleteConfirm = async () => {
    if (!deletingSample || !deletingSample.id) return;
    try {
      await deleteSample(
        deletingSample.id,
        deletingSample,
        userProfile?.uid || 'anonymous',
        userProfile?.name || 'User'
      );
      showToast(`Sampel "${deletingSample.productName}" berhasil dihapus.`);
      setDeletingSample(null);
    } catch (err: any) {
      alert(`Gagal menghapus sampel: ${err.message}`);
    }
  };

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // Export CSV
  const handleExportCSV = () => {
    const exportData = filteredSamples.map((s) => {
      const target = Number(s.targetContent) || 1;
      const completed = Number(s.completedContent) || 0;
      const isTargetAchieved = completed >= target;

      return {
        Tanggal: s.purchaseDate,
        Produk: s.productName,
        'Harga Sampel (Rp)': s.samplePrice,
        Jumlah: s.quantity,
        'Total Biaya (Rp)': s.totalCost,
        Status: s.status,
        'Akun TikTok': s.accountName || '-',
        'Karyawan Penanggung Jawab': s.employeeName || '-',
        'Target Konten': `${target} ${s.unitContent || 'VT'}`,
        'Konten Selesai': `${completed} ${s.unitContent || 'VT'}`,
        'Status Konten': isTargetAchieved ? 'TARGET KONTEN TERCAPAI' : 'BELUM SELESAI',
        'Tercatat di Pengeluaran': s.isExpenseRecorded ? 'YA (Expense ID)' : 'BELUM',
        Scope: s.scope,
        Catatan: s.notes || '-',
      };
    });

    exportToCSV(exportData, `Rekap_Sampel_Affiliate_PT_KDRT_${tanggalHariIni()}.csv`);
  };

  // Status color helper
  const getStatusBadge = (status: SampleStatus) => {
    switch (status) {
      case 'DIPESAN':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'DIKIRIM':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'DITERIMA':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'DIGUNAKAN':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'SELESAI':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div id="sampel-page-container" className="space-y-5 pb-12">
      {/* Success Toast */}
      {successToast && (
        <div
          id="sample-toast-success"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-slate-900/95 px-4 py-3 text-sm font-medium text-emerald-400 shadow-2xl backdrop-blur border border-emerald-500/30 animate-fade-in"
        >
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header & Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            {onBackToPortal && (
              <button
                onClick={onBackToPortal}
                className="flex items-center gap-1 hover:text-indigo-600 transition"
              >
                <Home className="h-3.5 w-3.5" /> Portal
              </button>
            )}
            {onBackToPortal && <ChevronRight className="h-3 w-3" />}
            <span className="text-slate-700">BISNIS & KEUANGAN</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-indigo-600">SAMPEL AFFILIATE</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Package className="h-7 w-7 text-indigo-600" />
            Pencatatan Sampel Affiliate
          </h1>
          <p className="text-sm text-slate-500">
            Pelacakan pembelian sampel, status pengiriman, penugasan karyawan, dan target konten VT.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {onNavigateToProduk && (
            <button
              onClick={onNavigateToProduk}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition"
            >
              <ShoppingBag className="h-4 w-4 text-slate-500" />
              <span>Katalog Produk</span>
            </button>
          )}

          <button
            id="btn-export-samples-csv"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Export CSV</span>
          </button>

          {!isInvestor && (
            <button
              id="btn-add-sample"
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Sampel</span>
            </button>
          )}
        </div>
      </div>

      {/* Dashboard Metrik Sampel */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {/* Total Biaya Bulan Ini (Prominent Card) */}
        <div className="col-span-2 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-indigo-50/30 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">
              Total Biaya Sampel Bulan Ini
            </span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-md border border-indigo-200 bg-white px-2 py-0.5 text-xs text-indigo-950 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-indigo-700">
            {formatRupiah(metrics.totalCostMonth)}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-indigo-600/90 font-medium">
            <span>Total Semua Periode: {formatRupiah(metrics.totalCostAll)}</span>
            <span>{samples.length} Sampel</span>
          </div>
        </div>

        {/* Dipesan & Dikirim */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-blue-700">
            Dipesan
          </div>
          <div className="mt-1 text-2xl font-bold text-blue-900">{metrics.dipesan}</div>
          <div className="mt-0.5 text-xs text-blue-600">Menunggu Resi</div>
        </div>

        <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3.5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-purple-700">
            Dikirim
          </div>
          <div className="mt-1 text-2xl font-bold text-purple-900">{metrics.dikirim}</div>
          <div className="mt-0.5 text-xs text-purple-600">Dalam Perjalanan</div>
        </div>

        {/* Diterima & Digunakan */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-700">
            Diterima
          </div>
          <div className="mt-1 text-2xl font-bold text-amber-900">{metrics.diterima}</div>
          <div className="mt-0.5 text-xs text-amber-600">Siap Diproduksi</div>
        </div>

        {/* Konten Belum Selesai */}
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3.5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-rose-700">
            Konten Belum Selesai
          </div>
          <div className="mt-1 text-2xl font-bold text-rose-900">
            {metrics.belumSelesaiKonten}
          </div>
          <div className="mt-0.5 text-xs text-rose-600">Target Belum Penuh</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              id="input-search-sample"
              type="text"
              placeholder="Cari produk, akun, karyawan, atau catatan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-300 pl-9 pr-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              id="filter-sample-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="SEMUA">Semua Status Sampel</option>
              {STATUS_FLOW.map((st) => (
                <option key={st} value={st}>
                  Status: {st}
                </option>
              ))}
            </select>
          </div>

          {/* Akun Filter */}
          <div>
            <select
              id="filter-sample-account"
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="SEMUA">Semua Akun TikTok</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.accountName}
                </option>
              ))}
            </select>
          </div>

          {/* Karyawan Filter */}
          <div>
            <select
              id="filter-sample-employee"
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="SEMUA">Semua Karyawan (PIC)</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Scope and Reset Filter Row */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            {!isInvestor && (
              <div className="flex items-center gap-1">
                <span className="font-semibold text-slate-600">Scope:</span>
                <button
                  onClick={() => setScopeFilter('SEMUA')}
                  className={`px-2 py-0.5 rounded font-medium ${
                    scopeFilter === 'SEMUA' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  Semua
                </button>
                <button
                  onClick={() => setScopeFilter('PRIBADI')}
                  className={`px-2 py-0.5 rounded font-medium ${
                    scopeFilter === 'PRIBADI' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  PRIBADI
                </button>
                <button
                  onClick={() => setScopeFilter('SHARING')}
                  className={`px-2 py-0.5 rounded font-medium ${
                    scopeFilter === 'SHARING' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  SHARING
                </button>
              </div>
            )}
          </div>

          <div className="text-slate-500 font-medium">
            Menampilkan <strong className="text-slate-900">{filteredSamples.length}</strong> data sampel
          </div>
        </div>
      </div>

      {/* Samples Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-500 mb-3" />
            <p className="text-sm font-medium">Memuat data sampel affiliate...</p>
          </div>
        ) : filteredSamples.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-900">Belum ada sampel tercatat</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
              {searchQuery || statusFilter !== 'SEMUA' || accountFilter !== 'SEMUA'
                ? 'Tidak ada data sampel yang cocok dengan filter.'
                : 'Catat pembelian sampel affiliate baru untuk memantau pengeluaran dan target VT karyawan.'}
            </p>
            {!isInvestor && (
              <button
                onClick={handleOpenAdd}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                Catat Sampel Pertama
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-4 py-3.5">Tanggal</th>
                  <th className="px-4 py-3.5">Produk & Sampel</th>
                  <th className="px-4 py-3.5">Harga & Qty</th>
                  <th className="px-4 py-3.5">Total Biaya</th>
                  <th className="px-4 py-3.5">Status Sampel</th>
                  <th className="px-4 py-3.5">Akun & Karyawan</th>
                  <th className="px-4 py-3.5">Target & Konten VT</th>
                  <th className="px-4 py-3.5">Biaya Kas</th>
                  <th className="px-4 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {filteredSamples.map((sample) => {
                  const target = Number(sample.targetContent) || 1;
                  const completed = Number(sample.completedContent) || 0;
                  const remaining = Math.max(0, target - completed);
                  const isTargetAchieved = completed >= target;
                  const progressPct = Math.min(100, Math.round((completed / target) * 100));

                  return (
                    <tr key={sample.id} className="hover:bg-slate-50/80 transition">
                      {/* Tanggal */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-600">
                        <div className="font-medium text-slate-900">
                          {formatTanggal(sample.purchaseDate)}
                        </div>
                        {sample.scope === 'SHARING' ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 mt-1">
                            <Share2 className="h-2.5 w-2.5" /> SHARING
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200 mt-1">
                            <Lock className="h-2.5 w-2.5" /> PRIBADI
                          </span>
                        )}
                      </td>

                      {/* Produk */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center">
                            {sample.productImage ? (
                              <img
                                src={sample.productImage}
                                alt={sample.productName}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Package className="h-5 w-5 text-slate-400" />
                            )}
                          </div>
                          <div className="max-w-xs">
                            <div className="font-semibold text-slate-900 line-clamp-1">
                              {sample.productName}
                            </div>
                            {sample.productUrl && (
                              <a
                                href={sample.productUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                              >
                                <span>Link Toko</span>
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            )}
                            {sample.notes && (
                              <div className="text-[11px] text-slate-400 truncate mt-0.5">
                                {sample.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Harga & Qty */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs">
                        <div className="font-medium text-slate-800">
                          {formatRupiah(sample.samplePrice)}
                        </div>
                        <div className="text-slate-500">Jumlah: {sample.quantity} unit</div>
                      </td>

                      {/* Total Biaya */}
                      <td className="px-4 py-3.5 whitespace-nowrap font-bold text-indigo-700">
                        {formatRupiah(sample.totalCost)}
                      </td>

                      {/* Status Sampel */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {!isInvestor ? (
                          <select
                            value={sample.status}
                            onChange={(e) =>
                              handleStatusChange(sample, e.target.value as SampleStatus)
                            }
                            className={`rounded-full px-2.5 py-1 text-xs font-bold border focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${getStatusBadge(
                              sample.status
                            )}`}
                          >
                            {STATUS_FLOW.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border ${getStatusBadge(
                              sample.status
                            )}`}
                          >
                            {sample.status}
                          </span>
                        )}
                      </td>

                      {/* Akun & Karyawan */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs">
                        <div className="flex items-center gap-1 font-semibold text-slate-800">
                          <Smartphone className="h-3.5 w-3.5 text-slate-400" />
                          <span>{sample.accountName || '-'}</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-500 mt-0.5">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          <span>PIC: {sample.employeeName || 'Belum Ditugaskan'}</span>
                        </div>
                      </td>

                      {/* Target & Konten Tracking */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="w-36 space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-900">
                              {completed} / {target} {sample.unitContent || 'VT'}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                isTargetAchieved
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {isTargetAchieved ? '🟢 TERCAPAI' : `🟡 Sisa ${remaining}`}
                            </span>
                          </div>

                          {/* Mini Progress bar */}
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                            <div
                              className={`h-full transition-all duration-300 ${
                                isTargetAchieved ? 'bg-emerald-500' : 'bg-indigo-600'
                              }`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>

                          {/* Quick Increment Action */}
                          {!isInvestor && (
                            <div className="pt-0.5">
                              <button
                                onClick={() => handleIncrementContent(sample)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                              >
                                <Plus className="h-3 w-3" /> Tambah 1 VT Selesai
                              </button>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Biaya Kas (Anti-Double-Entry Status) */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs">
                        {sample.isExpenseRecorded || sample.expenseId ? (
                          <div className="flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                            <CheckCheck className="h-3.5 w-3.5" />
                            <span>Tercatat Kas</span>
                          </div>
                        ) : !isInvestor ? (
                          <button
                            onClick={() => handleRecordExpense(sample)}
                            className="inline-flex items-center gap-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 text-xs font-semibold transition border border-slate-300"
                          >
                            <DollarSign className="h-3 w-3 text-slate-500" />
                            <span>+ Catat Kas</span>
                          </button>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isInvestor && (
                            <button
                              onClick={() => handleOpenEdit(sample)}
                              title="Edit Data Sampel"
                              className="rounded p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}

                          {isOwner && (
                            <button
                              onClick={() => setDeletingSample(sample)}
                              title="Hapus Sampel"
                              className="rounded p-1.5 text-red-500 hover:bg-red-50 transition"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
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

      {/* Modal Tambah / Edit Sampel */}
      {isModalOpen && (
        <div
          id="modal-sample-form"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in"
        >
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Package className="h-5 w-5 text-indigo-600" />
                  {editingSample ? 'Edit Data Pembelian Sampel' : 'Tambah Pembelian Sampel Baru'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Input detail sampel, penanggung jawab karyawan, target konten, dan integrasi arus kas.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {actionError && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
                  {actionError}
                </div>
              )}

              {/* Pilih Produk dari Katalog */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Pilih Produk dari Katalog <span className="text-red-500">*</span>
                </label>
                {products.length > 0 ? (
                  <select
                    id="select-sample-product"
                    value={formData.productId}
                    onChange={(e) => handleProductChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                  >
                    <option value="">-- Pilih Produk --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.productName} (Rp {p.productPrice.toLocaleString('id-ID')})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-2.5 rounded-lg bg-amber-50 text-amber-800 text-xs border border-amber-200 flex items-center justify-between">
                    <span>Belum ada produk aktif di katalog.</span>
                    {onNavigateToProduk && (
                      <button
                        type="button"
                        onClick={onNavigateToProduk}
                        className="font-bold underline hover:text-amber-900"
                      >
                        + Tambah Produk Dulu
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Nama Produk (Custom/Auto) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Nama Produk Sampel <span className="text-red-500">*</span>
                </label>
                <input
                  id="input-sample-product-name"
                  type="text"
                  required
                  placeholder="Contoh: Skintific 5X Ceramide Barrier 30g"
                  value={formData.productName}
                  onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Harga Sampel & Jumlah Qty */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Harga Sampel Satuan (Rp) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="input-sample-price"
                    type="number"
                    min="0"
                    required
                    value={formData.samplePrice || ''}
                    onChange={(e) =>
                      handleQtyPriceChange(Number(e.target.value), formData.quantity)
                    }
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Jumlah (Qty) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="input-sample-qty"
                    type="number"
                    min="1"
                    required
                    value={formData.quantity}
                    onChange={(e) =>
                      handleQtyPriceChange(formData.samplePrice, Number(e.target.value))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Total Biaya (Otomatis)
                  </label>
                  <div className="rounded-lg bg-indigo-50/80 border border-indigo-200 px-3.5 py-2 text-sm font-bold text-indigo-700 flex items-center">
                    {formatRupiah(formData.totalCost)}
                  </div>
                </div>
              </div>

              {/* Tanggal Pembelian & Status Awal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Tanggal Pembelian
                  </label>
                  <input
                    id="input-sample-purchase-date"
                    type="date"
                    required
                    value={formData.purchaseDate}
                    onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Status Sampel
                  </label>
                  <select
                    id="select-sample-status-form"
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value as SampleStatus })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                  >
                    {STATUS_FLOW.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Akun TikTok & Karyawan Penanggung Jawab */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Akun yang Akan Membuat Konten
                  </label>
                  <select
                    id="select-sample-account"
                    value={formData.accountId}
                    onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">-- Pilih Akun TikTok --</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.accountName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Karyawan Penanggung Jawab (PIC)
                  </label>
                  <select
                    id="select-sample-employee"
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">-- Pilih Karyawan --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.position || 'Karyawan'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Target Konten & Unit */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Target Konten
                  </label>
                  <input
                    id="input-sample-target-content"
                    type="number"
                    min="1"
                    value={formData.targetContent}
                    onChange={(e) =>
                      setFormData({ ...formData, targetContent: Number(e.target.value) || 1 })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Konten Selesai
                  </label>
                  <input
                    id="input-sample-completed-content"
                    type="number"
                    min="0"
                    value={formData.completedContent}
                    onChange={(e) =>
                      setFormData({ ...formData, completedContent: Number(e.target.value) || 0 })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Scope Visibilitas
                  </label>
                  <select
                    id="select-sample-scope"
                    value={formData.scope}
                    onChange={(e) =>
                      setFormData({ ...formData, scope: e.target.value as ScopeType })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="PRIBADI">PRIBADI (Internal Kantor)</option>
                    <option value="SHARING">SHARING (Investor Visible)</option>
                  </select>
                </div>
              </div>

              {/* Automatic Options (Add Only) */}
              {!editingSample && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3.5 space-y-2">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.autoCreateExpense}
                      onChange={(e) =>
                        setFormData({ ...formData, autoCreateExpense: e.target.checked })
                      }
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>
                      Catat otomatis biaya sampel (
                      <strong className="text-indigo-700 font-bold">
                        {formatRupiah(formData.totalCost)}
                      </strong>
                      ) ke Pengeluaran Kas (Kategori: SAMPEL)
                    </span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.autoCreateTask}
                      onChange={(e) =>
                        setFormData({ ...formData, autoCreateTask: e.target.checked })
                      }
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>
                      Buat tugas otomatis di Kerjaan Harian untuk karyawan yang ditugaskan (Target:{' '}
                      {formData.targetContent} {formData.unitContent})
                    </span>
                  </label>
                </div>
              )}

              {/* Catatan */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Catatan Tambahan
                </label>
                <textarea
                  id="textarea-sample-notes"
                  rows={2}
                  placeholder="Nomor resi pengiriman, arahan video, tanggal tiba, dll..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  id="btn-save-sample"
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 transition"
                >
                  {submitting && <RefreshCw className="h-4 w-4 animate-spin" />}
                  <span>{editingSample ? 'Simpan Perubahan' : 'Simpan Sampel'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingSample && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Hapus Sampel?</h3>
            <p className="text-sm text-slate-600 mt-2">
              Apakah Anda yakin ingin menghapus data sampel{' '}
              <strong className="text-slate-900 font-semibold">{deletingSample.productName}</strong>?
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setDeletingSample(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                id="btn-confirm-delete-sample"
                onClick={handleDeleteConfirm}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
