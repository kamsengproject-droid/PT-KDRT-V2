import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  Download,
  ExternalLink,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Upload,
  Image as ImageIcon,
  Tag,
  Share2,
  Lock,
  ChevronRight,
  Home,
  RefreshCw,
  ShoppingBag,
  Percent,
  Layers,
  ArrowUpDown,
  Smartphone,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Product, ProductStatus, ScopeType, Account } from '../types';
import {
  subscribeProducts,
  createProduct,
  updateProduct,
  toggleProductStatus,
  deleteProduct,
} from '../services/productService';
import { subscribeAccounts } from '../services/accountService';
import { formatRupiah, formatTanggal, exportToCSV } from '../utils/formatters';

interface ProdukPageProps {
  onBackToPortal?: () => void;
  onNavigateToSampel?: (productId?: string) => void;
}

const KATEGORI_OPTIONS = [
  'Skincare & Kecantikan',
  'Fashion & Pakaian',
  'Mainan & Hobi',
  'Baju Anak & Bayi',
  'Elektronik & Gadget',
  'Rumah Tangga & Dapur',
  'Otomotif & Aksesoris',
  'Makanan & Minuman',
  'Kesehatan & Kebugaran',
  'Lainnya',
];

export const ProdukPage: React.FC<ProdukPageProps> = ({
  onBackToPortal,
  onNavigateToSampel,
}) => {
  const { userProfile, role, loading: authLoading, currentUser } = useAuth();
  const isOwner = role === 'OWNER';
  const isManager = role === 'MANAGER';
  const isEmployee = role === 'EMPLOYEE';
  const isInvestor = role === 'INVESTOR';

  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<ProductStatus | 'SEMUA'>('SEMUA');
  const [categoryFilter, setCategoryFilter] = useState<string>('SEMUA');
  const [scopeFilter, setScopeFilter] = useState<'SEMUA' | ScopeType>('SEMUA');
  const [accountFilter, setAccountFilter] = useState<string>('SEMUA');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Delete confirmation
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  // Form Data
  const [formData, setFormData] = useState<{
    productName: string;
    productPrice: number;
    productUrl: string;
    commissionRate: number;
    accountIds: string[];
    category: string;
    scope: ScopeType;
    status: ProductStatus;
    notes: string;
  }>({
    productName: '',
    productPrice: 0,
    productUrl: '',
    commissionRate: 10,
    accountIds: [],
    category: 'Skincare & Kecantikan',
    scope: 'PRIBADI',
    status: 'AKTIF',
    notes: '',
  });

  // Subscribe products & accounts
  useEffect(() => {
    if (authLoading || !currentUser || !userProfile?.active) {
      return;
    }
    setLoading(true);
    const unsubProducts = subscribeProducts(undefined, (prodList) => {
      // Permission filter
      let filtered = prodList;
      if (isInvestor) {
        filtered = prodList.filter((p) => p.scope === 'SHARING');
      } else if (isEmployee && !userProfile?.permissions?.canReadPrivate) {
        // Employee with limited permission
        filtered = prodList.filter(
          (p) =>
            p.scope === 'SHARING' ||
            (p.accountIds && p.accountIds.some((accId) => accounts.some((a) => a.id === accId)))
        );
      }
      setProducts(filtered);
      setLoading(false);
    });

    const unsubAccounts = subscribeAccounts(undefined, (accList) => {
      setAccounts(accList.filter((a) => a.active));
    });

    return () => {
      unsubProducts();
      unsubAccounts();
    };
  }, [authLoading, currentUser?.uid, userProfile?.role, userProfile?.active, isInvestor, isEmployee]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Scope filter
      if (scopeFilter !== 'SEMUA' && p.scope !== scopeFilter) return false;
      // Status filter
      if (statusFilter !== 'SEMUA' && p.status !== statusFilter) return false;
      // Category filter
      if (categoryFilter !== 'SEMUA' && p.category !== categoryFilter) return false;
      // Account filter
      if (accountFilter !== 'SEMUA') {
        const matchesMain = p.accountId === accountFilter;
        const matchesMulti = p.accountIds && p.accountIds.includes(accountFilter);
        if (!matchesMain && !matchesMulti) return false;
      }
      // Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const nameMatch = p.productName?.toLowerCase().includes(query);
        const catMatch = p.category?.toLowerCase().includes(query);
        const urlMatch = p.productUrl?.toLowerCase().includes(query);
        const accMatch =
          p.accountName?.toLowerCase().includes(query) ||
          p.accountNames?.some((n) => n.toLowerCase().includes(query));
        const notesMatch = p.notes?.toLowerCase().includes(query);
        if (!nameMatch && !catMatch && !urlMatch && !accMatch && !notesMatch) return false;
      }
      return true;
    });
  }, [products, scopeFilter, statusFilter, categoryFilter, accountFilter, searchQuery]);

  // Metrics summary
  const metrics = useMemo(() => {
    const total = products.length;
    const aktif = products.filter((p) => p.status === 'AKTIF').length;
    const nonaktif = total - aktif;
    const avgCommission =
      total > 0
        ? Math.round(
            products.reduce((sum, p) => sum + (Number(p.commissionRate) || 0), 0) / total
          )
        : 0;
    const sharingCount = products.filter((p) => p.scope === 'SHARING').length;
    const pribadiCount = products.filter((p) => p.scope === 'PRIBADI').length;

    return { total, aktif, nonaktif, avgCommission, sharingCount, pribadiCount };
  }, [products]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormData({
      productName: '',
      productPrice: 0,
      productUrl: '',
      commissionRate: 10,
      accountIds: accounts.length > 0 ? [accounts[0].id || ''] : [],
      category: 'Skincare & Kecantikan',
      scope: 'PRIBADI',
      status: 'AKTIF',
      notes: '',
    });
    setPreviewImage(null);
    setImageFile(null);
    setActionError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    const existingAccounts = product.accountIds || (product.accountId ? [product.accountId] : []);
    setFormData({
      productName: product.productName,
      productPrice: product.productPrice,
      productUrl: product.productUrl || '',
      commissionRate: product.commissionRate || 10,
      accountIds: existingAccounts,
      category: product.category || 'Skincare & Kecantikan',
      scope: product.scope || 'PRIBADI',
      status: product.status || 'AKTIF',
      notes: product.notes || '',
    });
    setPreviewImage(product.productImage || product.photoUrl || null);
    setImageFile(null);
    setActionError(null);
    setIsModalOpen(true);
  };

  // Handle Image Selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.productName.trim()) {
      setActionError('Nama produk wajib diisi.');
      return;
    }

    setSubmitting(true);
    setActionError(null);

    // Map account names
    const selectedAccounts = accounts.filter((a) => formData.accountIds.includes(a.id || ''));
    const accountNames = selectedAccounts.map((a) => a.accountName);
    const primaryAccount = selectedAccounts[0];

    try {
      if (editingProduct && editingProduct.id) {
        await updateProduct(
          editingProduct.id,
          editingProduct,
          {
            productName: formData.productName.trim(),
            productPrice: Number(formData.productPrice) || 0,
            productUrl: formData.productUrl.trim(),
            commissionRate: Number(formData.commissionRate) || 0,
            accountIds: formData.accountIds,
            accountNames: accountNames,
            accountId: primaryAccount?.id || '',
            accountName: primaryAccount?.accountName || '',
            category: formData.category,
            scope: formData.scope,
            status: formData.status,
            notes: formData.notes.trim(),
          },
          imageFile,
          userProfile?.uid || 'anonymous',
          userProfile?.name || 'User'
        );
        showToast(`Produk "${formData.productName}" berhasil diperbarui!`);
      } else {
        await createProduct(
          {
            productName: formData.productName.trim(),
            productPrice: Number(formData.productPrice) || 0,
            productUrl: formData.productUrl.trim(),
            commissionRate: Number(formData.commissionRate) || 0,
            accountIds: formData.accountIds,
            accountNames: accountNames,
            accountId: primaryAccount?.id || '',
            accountName: primaryAccount?.accountName || '',
            category: formData.category,
            scope: formData.scope,
            status: formData.status,
            notes: formData.notes.trim(),
            createdBy: userProfile?.uid || 'anonymous',
          },
          imageFile,
          userProfile?.uid || 'anonymous',
          userProfile?.name || 'User'
        );
        showToast(`Produk "${formData.productName}" berhasil ditambahkan!`);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Error saving product:', err);
      setActionError(err.message || 'Gagal menyimpan data produk.');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle status
  const handleToggleStatus = async (product: Product) => {
    if (!product.id) return;
    const newStatus: ProductStatus = product.status === 'AKTIF' ? 'NONAKTIF' : 'AKTIF';
    try {
      await toggleProductStatus(
        product.id,
        product,
        newStatus,
        userProfile?.uid || 'anonymous',
        userProfile?.name || 'User'
      );
      showToast(`Status produk diubah menjadi ${newStatus}`);
    } catch (err: any) {
      alert(`Gagal mengubah status: ${err.message}`);
    }
  };

  // Confirm delete
  const handleDeleteConfirm = async () => {
    if (!deletingProduct || !deletingProduct.id) return;
    try {
      await deleteProduct(
        deletingProduct.id,
        deletingProduct,
        userProfile?.uid || 'anonymous',
        userProfile?.name || 'User'
      );
      showToast(`Produk "${deletingProduct.productName}" berhasil dihapus.`);
      setDeletingProduct(null);
    } catch (err: any) {
      alert(`Gagal menghapus produk: ${err.message}`);
    }
  };

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // Export CSV
  const handleExportCSV = () => {
    const exportData = filteredProducts.map((p) => ({
      'Nama Produk': p.productName,
      'Harga Beli (Rp)': p.productPrice,
      'Komisi (%)': p.commissionRate,
      'Link Produk': p.productUrl || '-',
      'Akun TikTok': p.accountNames?.join(', ') || p.accountName || '-',
      Kategori: p.category,
      Scope: p.scope,
      Status: p.status,
      Catatan: p.notes || '-',
      'Dibuat Oleh': p.createdByName || '-',
    }));

    exportToCSV(exportData, `Katalog_Produk_PT_KDRT_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div id="produk-page-container" className="space-y-5 pb-12">
      {/* Toast Notification */}
      {successToast && (
        <div
          id="product-toast-success"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-slate-900/95 px-4 py-3 text-sm font-medium text-emerald-400 shadow-2xl backdrop-blur border border-emerald-500/30 animate-fade-in"
        >
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header & Breadcrumb */}
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
            <span className="text-indigo-600">PRODUK AFFILIATE</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingBag className="h-7 w-7 text-indigo-600" />
            Katalog Produk Affiliate
          </h1>
          <p className="text-sm text-slate-500">
            Pencatatan produk promosi affiliate, harga beli sampel, komisi, dan relasi akun TikTok.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            id="btn-export-products-csv"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Export CSV</span>
          </button>

          {!isInvestor && (
            <button
              id="btn-add-product"
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Produk</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Total Produk
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{metrics.total}</div>
          <div className="mt-0.5 text-xs text-slate-400">Katalog Tersimpan</div>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Produk Aktif
          </div>
          <div className="mt-1 text-2xl font-bold text-emerald-800">{metrics.aktif}</div>
          <div className="mt-0.5 text-xs text-emerald-600">Dipromosikan</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">
            Nonaktif
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-700">{metrics.nonaktif}</div>
          <div className="mt-0.5 text-xs text-slate-400">Diarsipkan</div>
        </div>

        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3.5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
            Rata-rata Komisi
          </div>
          <div className="mt-1 text-2xl font-bold text-indigo-800">{metrics.avgCommission}%</div>
          <div className="mt-0.5 text-xs text-indigo-600">Margin Komisi</div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-700">
            Scope Sharing
          </div>
          <div className="mt-1 text-2xl font-bold text-amber-800">{metrics.sharingCount}</div>
          <div className="mt-0.5 text-xs text-amber-600">Investor Visible</div>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-blue-700">
            Scope Pribadi
          </div>
          <div className="mt-1 text-2xl font-bold text-blue-800">{metrics.pribadiCount}</div>
          <div className="mt-0.5 text-xs text-blue-600">Internal Owner</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              id="input-search-product"
              type="text"
              placeholder="Cari nama produk, kategori, link, atau akun..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-300 pl-9 pr-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Scope Filter */}
          {!isInvestor && (
            <div>
              <select
                id="filter-product-scope"
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value as any)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="SEMUA">Semua Scope</option>
                <option value="PRIBADI">Scope: PRIBADI (Owner)</option>
                <option value="SHARING">Scope: SHARING (Investor)</option>
              </select>
            </div>
          )}

          {/* Status Filter */}
          <div>
            <select
              id="filter-product-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="SEMUA">Semua Status</option>
              <option value="AKTIF">Hanya AKTIF</option>
              <option value="NONAKTIF">Hanya NONAKTIF</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              id="filter-product-category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="SEMUA">Semua Kategori</option>
              {KATEGORI_OPTIONS.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Multi-Account Filter Row */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap text-xs text-slate-600">
          <span className="font-semibold flex items-center gap-1">
            <Smartphone className="h-3.5 w-3.5 text-slate-500" /> Filter Akun:
          </span>
          <button
            onClick={() => setAccountFilter('SEMUA')}
            className={`px-2.5 py-1 rounded-md font-medium transition ${
              accountFilter === 'SEMUA'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua Akun ({products.length})
          </button>
          {accounts.map((acc) => (
            <button
              key={acc.id}
              onClick={() => setAccountFilter(acc.id || '')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                accountFilter === acc.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {acc.accountName}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid / Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-500 mb-3" />
            <p className="text-sm font-medium">Memuat katalog produk...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center">
            <ShoppingBag className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-900">Belum ada produk ditemukan</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
              {searchQuery || statusFilter !== 'SEMUA' || categoryFilter !== 'SEMUA'
                ? 'Tidak ada produk yang cocok dengan filter yang dipilih.'
                : 'Mulai catat produk affiliate Anda dengan menekan tombol Tambah Produk.'}
            </p>
            {!isInvestor && (
              <button
                onClick={handleOpenAdd}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                Tambah Produk Pertama
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-4 py-3.5">Produk</th>
                  <th className="px-4 py-3.5">Kategori</th>
                  <th className="px-4 py-3.5">Harga Beli</th>
                  <th className="px-4 py-3.5">Komisi</th>
                  <th className="px-4 py-3.5">Akun TikTok</th>
                  <th className="px-4 py-3.5">Scope</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {filteredProducts.map((p) => {
                  const photoSrc = p.productImage || p.photoUrl;
                  const isAktif = p.status === 'AKTIF';
                  const accountList = p.accountNames || (p.accountName ? [p.accountName] : []);

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50/80 transition ${!isAktif ? 'opacity-70 bg-slate-50/40' : ''}`}
                    >
                      {/* Product Name & Image */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center">
                            {photoSrc ? (
                              <img
                                src={photoSrc}
                                alt={p.productName}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <ImageIcon className="h-6 w-6 text-slate-400" />
                            )}
                          </div>
                          <div className="max-w-xs">
                            <div className="font-semibold text-slate-900 line-clamp-1">
                              {p.productName}
                            </div>
                            {p.productUrl && (
                              <a
                                href={p.productUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-0.5 inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                              >
                                <span>Link Toko / Produk</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            {p.notes && (
                              <div className="text-xs text-slate-400 truncate mt-0.5">
                                {p.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Kategori */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                          <Tag className="h-3 w-3 text-slate-500" />
                          {p.category || 'Umum'}
                        </span>
                      </td>

                      {/* Harga Beli */}
                      <td className="px-4 py-3.5 whitespace-nowrap font-medium text-slate-900">
                        {formatRupiah(p.productPrice)}
                      </td>

                      {/* Komisi Rate */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                          {p.commissionRate}%
                        </span>
                      </td>

                      {/* Akun TikTok */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          {accountList.length > 0 ? (
                            accountList.map((accName, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center rounded bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 border border-indigo-100"
                              >
                                {accName}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </div>
                      </td>

                      {/* Scope */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {p.scope === 'SHARING' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                            <Share2 className="h-3 w-3" /> SHARING
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
                            <Lock className="h-3 w-3" /> PRIBADI
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {isAktif ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>
                            AKTIF
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-500"></span>
                            NONAKTIF
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Order Sample Shortcut */}
                          {onNavigateToSampel && isAktif && !isInvestor && (
                            <button
                              onClick={() => onNavigateToSampel(p.id)}
                              title="Pesan Sampel untuk produk ini"
                              className="inline-flex items-center gap-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 py-1 text-xs font-semibold transition"
                            >
                              <Package className="h-3.5 w-3.5" />
                              <span>+ Sampel</span>
                            </button>
                          )}

                          {!isInvestor && (
                            <>
                              <button
                                onClick={() => handleOpenEdit(p)}
                                title="Edit Produk"
                                className="rounded p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>

                              <button
                                onClick={() => handleToggleStatus(p)}
                                title={isAktif ? 'Nonaktifkan Produk' : 'Aktifkan Produk'}
                                className={`rounded p-1.5 transition ${
                                  isAktif
                                    ? 'text-amber-600 hover:bg-amber-50'
                                    : 'text-emerald-600 hover:bg-emerald-50'
                                }`}
                              >
                                {isAktif ? (
                                  <XCircle className="h-4 w-4" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4" />
                                )}
                              </button>
                            </>
                          )}

                          {isOwner && (
                            <button
                              onClick={() => setDeletingProduct(p)}
                              title="Hapus Produk"
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

      {/* Modal Tambah / Edit Produk */}
      {isModalOpen && (
        <div
          id="modal-product-form"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in"
        >
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-indigo-600" />
                  {editingProduct ? 'Edit Data Produk' : 'Tambah Produk Affiliate Baru'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Input data manual produk, harga sampel, persentase komisi, dan multi-akun TikTok.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {actionError && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
                  {actionError}
                </div>
              )}

              {/* Nama Produk */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Nama Produk <span className="text-red-500">*</span>
                </label>
                <input
                  id="input-product-name"
                  type="text"
                  required
                  placeholder="Contoh: Skintific 5X Ceramide Barrier Moisture Gel 30g"
                  value={formData.productName}
                  onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Foto Produk Upload */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Foto Produk (Disimpan di Firebase Storage)
                </label>
                <div className="flex items-start gap-4">
                  <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-slate-300 bg-slate-100 flex items-center justify-center">
                    {previewImage ? (
                      <img
                        src={previewImage}
                        alt="Preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      id="input-product-photo"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Format JPG/PNG/WebP. Foto akan dikompres otomatis sebelum diunggah ke Firebase
                      Storage untuk efisiensi ruang.
                    </p>
                  </div>
                </div>
              </div>

              {/* Harga Beli & Komisi Rate */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Harga Beli / Harga Produk (Rp)
                  </label>
                  <input
                    id="input-product-price"
                    type="number"
                    min="0"
                    placeholder="Contoh: 125000"
                    value={formData.productPrice || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, productPrice: Number(e.target.value) || 0 })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                  />
                  {formData.productPrice > 0 && (
                    <div className="text-xs text-indigo-600 mt-1 font-semibold">
                      {formatRupiah(formData.productPrice)}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Komisi Affiliate (%)
                  </label>
                  <div className="relative">
                    <input
                      id="input-product-commission"
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      placeholder="Contoh: 12.5"
                      value={formData.commissionRate || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, commissionRate: Number(e.target.value) || 0 })
                      }
                      className="w-full rounded-lg border border-slate-300 pl-3.5 pr-8 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                    />
                    <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  </div>
                </div>
              </div>

              {/* Link Toko / Link Produk */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Link Toko / Link Produk (TikTok Shop / Shopee / dll.)
                </label>
                <input
                  id="input-product-url"
                  type="url"
                  placeholder="https://vt.tiktok.com/... atau https://shop.tiktok.com/..."
                  value={formData.productUrl}
                  onChange={(e) => setFormData({ ...formData, productUrl: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Multi Akun TikTok */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Akun TikTok yang Mempromosikan (Bisa Pilih Banyak)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-xl border border-slate-200 p-3 bg-slate-50/60 max-h-36 overflow-y-auto">
                  {accounts.map((acc) => {
                    const isSelected = formData.accountIds.includes(acc.id || '');
                    return (
                      <label
                        key={acc.id}
                        className={`flex items-center gap-2 rounded-lg p-2 text-xs font-medium cursor-pointer border transition ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const accId = acc.id || '';
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                accountIds: [...formData.accountIds, accId],
                              });
                            } else {
                              setFormData({
                                ...formData,
                                accountIds: formData.accountIds.filter((id) => id !== accId),
                              });
                            }
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="truncate">{acc.accountName}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Kategori, Scope & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Kategori Produk
                  </label>
                  <select
                    id="select-product-category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {KATEGORI_OPTIONS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Scope Visibilitas
                  </label>
                  <select
                    id="select-product-scope"
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

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Status Produk
                  </label>
                  <select
                    id="select-product-status"
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value as ProductStatus })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="AKTIF">AKTIF (Dipromosikan)</option>
                    <option value="NONAKTIF">NONAKTIF (Diarsipkan)</option>
                  </select>
                </div>
              </div>

              {/* Catatan */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Catatan / Keterangan Tambahan
                </label>
                <textarea
                  id="textarea-product-notes"
                  rows={2}
                  placeholder="Catatan hook konten, USP produk, link supplier, dll..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Modal Footer */}
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
                  id="btn-save-product"
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 transition"
                >
                  {submitting && <RefreshCw className="h-4 w-4 animate-spin" />}
                  <span>{editingProduct ? 'Simpan Perubahan' : 'Simpan Produk'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Hapus Produk?</h3>
            <p className="text-sm text-slate-600 mt-2">
              Apakah Anda yakin ingin menghapus produk{' '}
              <strong className="text-slate-900 font-semibold">{deletingProduct.productName}</strong>{' '}
              dari katalog?
            </p>
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 p-2.5 rounded-lg mt-3">
              Tip: Jika produk sudah pernah memiliki sampel atau konten, lebih disarankan mengubah
              statusnya menjadi <strong>NONAKTIF</strong> daripada menghapus permanen.
            </p>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setDeletingProduct(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                id="btn-confirm-delete-product"
                onClick={handleDeleteConfirm}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
