import React, { useState, useEffect, useMemo } from 'react';
import {
  Boxes,
  Package,
  Plus,
  Search,
  Filter,
  Download,
  Calendar,
  User,
  MapPin,
  ExternalLink,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRightLeft,
  DollarSign,
  Share2,
  Lock,
  ChevronRight,
  Home,
  RefreshCw,
  Eye,
  Camera,
  Layers,
  Wrench,
  AlertTriangle,
  HelpCircle,
  Tag,
  CheckCheck,
  Building,
  Upload,
  XCircle,
  X,
  FileText,
  History,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  InventoryItem,
  InventoryHistory,
  InventoryCategory,
  InventoryCondition,
  InventoryStatus,
  ScopeType,
  Employee,
  DEFAULT_INVENTORY_CATEGORIES,
  DEFAULT_INVENTORY_LOCATIONS,
} from '../types';
import {
  subscribeInventory,
  subscribeInventoryHistory,
  createInventory,
  updateInventory,
  moveInventory,
  updateInventoryCondition,
  recordInventoryExpense,
  deleteInventory,
  uploadInventoryPhoto,
} from '../services/inventoryService';
import { subscribeEmployees } from '../services/employeeService';
import { formatRupiah, formatTanggal, tanggalHariIni, exportToCSV } from '../utils/formatters';

interface InventoryPageProps {
  onBackToPortal?: () => void;
}

const CONDITION_OPTIONS: InventoryCondition[] = ['BAIK', 'PERLU PERBAIKAN', 'RUSAK', 'HILANG'];
const STATUS_OPTIONS: InventoryStatus[] = ['AKTIF', 'NONAKTIF'];

export const InventoryPage: React.FC<InventoryPageProps> = ({ onBackToPortal }) => {
  const { userProfile, role, loading: authLoading, currentUser } = useAuth();
  const isOwner = role === 'OWNER';
  const isManager = role === 'MANAGER';
  const isEmployee = role === 'EMPLOYEE';
  const isInvestor = role === 'INVESTOR';

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('SEMUA');
  const [conditionFilter, setConditionFilter] = useState<InventoryCondition | 'SEMUA'>('SEMUA');
  const [statusFilter, setStatusFilter] = useState<InventoryStatus | 'SEMUA'>('SEMUA');
  const [scopeFilter, setScopeFilter] = useState<'SEMUA' | ScopeType>('SEMUA');
  const [picFilter, setPicFilter] = useState<string>('SEMUA');
  const [locationFilter, setLocationFilter] = useState<string>('SEMUA');

  // Modals & Drawers
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Detail Modal / Drawer with 3 Tabs
  const [selectedItemDetail, setSelectedItemDetail] = useState<InventoryItem | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'PROFIL' | 'RIWAYAT' | 'PENGELUARAN'>('PROFIL');
  const [itemHistories, setItemHistories] = useState<InventoryHistory[]>([]);
  const [loadingHistories, setLoadingHistories] = useState<boolean>(false);

  // Move Modal
  const [movingItem, setMovingItem] = useState<InventoryItem | null>(null);
  const [moveLocation, setMoveLocation] = useState<string>('');
  const [movePicId, setMovePicId] = useState<string>('');
  const [moveNotes, setMoveNotes] = useState<string>('');
  const [submittingMove, setSubmittingMove] = useState<boolean>(false);

  // Delete Confirmation
  const [deletingItem, setDeletingItem] = useState<InventoryItem | null>(null);

  // Photo Upload State
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState<boolean>(false);

  // Form State
  const [formData, setFormData] = useState<{
    itemName: string;
    category: string;
    customCategory: string;
    quantity: number;
    pricePerUnit: number;
    totalValue: number;
    purchaseDate: string;
    purchaseLink: string;
    serialNumber: string;
    location: string;
    customLocation: string;
    picEmployeeId: string;
    condition: InventoryCondition;
    status: InventoryStatus;
    scope: ScopeType;
    autoCreateExpense: boolean;
    notes: string;
  }>({
    itemName: '',
    category: 'PERALATAN KONTEN',
    customCategory: '',
    quantity: 1,
    pricePerUnit: 0,
    totalValue: 0,
    purchaseDate: tanggalHariIni(),
    purchaseLink: '',
    serialNumber: '',
    location: 'Studio',
    customLocation: '',
    picEmployeeId: '',
    condition: 'BAIK',
    status: 'AKTIF',
    scope: 'PRIBADI',
    autoCreateExpense: true,
    notes: '',
  });

  // Subscribe to Inventory and Employees
  useEffect(() => {
    if (authLoading || !currentUser || !userProfile?.active) {
      return;
    }
    setLoading(true);

    const unsubInventory = subscribeInventory(undefined, (itemList) => {
      let filtered = itemList;
      if (isInvestor) {
        // Investor strictly restricted to SHARING scope
        filtered = itemList.filter((i) => i.scope === 'SHARING');
      } else if (isEmployee && !userProfile?.permissions?.canReadPrivate) {
        // Employee sees items assigned to them or created by them or SHARING
        filtered = itemList.filter(
          (i) =>
            i.picEmployeeId === userProfile?.employeeId ||
            i.createdBy === userProfile?.uid ||
            i.scope === 'SHARING'
        );
      }
      setItems(filtered);
      setLoading(false);
    });

    const unsubEmployees = subscribeEmployees(undefined, (empList) => {
      setEmployees(empList.filter((e) => e.active !== false));
    });

    return () => {
      unsubInventory();
      unsubEmployees();
    };
  }, [authLoading, currentUser?.uid, userProfile?.role, userProfile?.active, isInvestor, isEmployee]);

  // Subscribe to item histories when detail modal is opened
  useEffect(() => {
    if (authLoading || !currentUser || !userProfile?.active) {
      return;
    }
    if (selectedItemDetail && selectedItemDetail.id) {
      setLoadingHistories(true);
      const unsub = subscribeInventoryHistory(selectedItemDetail.id, (histories) => {
        setItemHistories(histories);
        setLoadingHistories(false);
      });
      return () => unsub();
    } else {
      setItemHistories([]);
    }
  }, [authLoading, currentUser?.uid, userProfile?.role, userProfile?.active, selectedItemDetail]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (scopeFilter !== 'SEMUA' && item.scope !== scopeFilter) return false;
      if (categoryFilter !== 'SEMUA' && item.category !== categoryFilter) return false;
      if (conditionFilter !== 'SEMUA' && item.condition !== conditionFilter) return false;
      if (statusFilter !== 'SEMUA' && item.status !== statusFilter) return false;
      if (picFilter !== 'SEMUA' && item.picEmployeeId !== picFilter) return false;
      if (locationFilter !== 'SEMUA' && item.location !== locationFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = item.itemName?.toLowerCase().includes(q);
        const catMatch = item.category?.toLowerCase().includes(q);
        const snMatch = item.serialNumber?.toLowerCase().includes(q);
        const locMatch = item.location?.toLowerCase().includes(q);
        const picMatch = item.picEmployeeName?.toLowerCase().includes(q);
        const notesMatch = item.notes?.toLowerCase().includes(q);
        if (!nameMatch && !catMatch && !snMatch && !locMatch && !picMatch && !notesMatch) {
          return false;
        }
      }
      return true;
    });
  }, [
    items,
    scopeFilter,
    categoryFilter,
    conditionFilter,
    statusFilter,
    picFilter,
    locationFilter,
    searchQuery,
  ]);

  // Dashboard Metrics & Category Breakdown
  const metrics = useMemo(() => {
    const totalCount = items.length;
    const totalUnits = items.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0);
    const totalValue = items.reduce((sum, i) => sum + (Number(i.totalValue) || 0), 0);

    const aktif = items.filter((i) => i.status === 'AKTIF').length;
    const nonaktif = items.filter((i) => i.status === 'NONAKTIF').length;

    const baik = items.filter((i) => i.condition === 'BAIK').length;
    const perluPerbaikan = items.filter((i) => i.condition === 'PERLU PERBAIKAN').length;
    const rusak = items.filter((i) => i.condition === 'RUSAK').length;
    const hilang = items.filter((i) => i.condition === 'HILANG').length;

    // Nilai berdasarkan kategori
    const categoryTotals: Record<string, { count: number; totalValue: number }> = {};
    items.forEach((item) => {
      const cat = item.category || 'LAINNYA';
      if (!categoryTotals[cat]) {
        categoryTotals[cat] = { count: 0, totalValue: 0 };
      }
      categoryTotals[cat].count += Number(item.quantity) || 1;
      categoryTotals[cat].totalValue += Number(item.totalValue) || 0;
    });

    const categoryList = Object.keys(categoryTotals).map((cat) => ({
      category: cat,
      count: categoryTotals[cat].count,
      totalValue: categoryTotals[cat].totalValue,
      percentage: totalValue > 0 ? Math.round((categoryTotals[cat].totalValue / totalValue) * 100) : 0,
    })).sort((a, b) => b.totalValue - a.totalValue);

    return {
      totalCount,
      totalUnits,
      totalValue,
      aktif,
      nonaktif,
      baik,
      perluPerbaikan,
      rusak,
      hilang,
      categoryList,
    };
  }, [items]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingItem(null);
    setPhotoFile(null);
    setPhotoPreview(null);
    setFormData({
      itemName: '',
      category: DEFAULT_INVENTORY_CATEGORIES[0],
      customCategory: '',
      quantity: 1,
      pricePerUnit: 0,
      totalValue: 0,
      purchaseDate: tanggalHariIni(),
      purchaseLink: '',
      serialNumber: '',
      location: DEFAULT_INVENTORY_LOCATIONS[0],
      customLocation: '',
      picEmployeeId: employees[0]?.id || '',
      condition: 'BAIK',
      status: 'AKTIF',
      scope: 'PRIBADI',
      autoCreateExpense: true,
      notes: '',
    });
    setActionError(null);
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setPhotoFile(null);
    setPhotoPreview(item.photoUrl || null);

    const isCustomCat = !DEFAULT_INVENTORY_CATEGORIES.includes(item.category as any);
    const isCustomLoc = !DEFAULT_INVENTORY_LOCATIONS.includes(item.location);

    setFormData({
      itemName: item.itemName,
      category: isCustomCat ? 'LAINNYA' : item.category,
      customCategory: isCustomCat ? item.category : '',
      quantity: item.quantity || 1,
      pricePerUnit: item.pricePerUnit || 0,
      totalValue: item.totalValue || (item.quantity * item.pricePerUnit) || 0,
      purchaseDate: item.purchaseDate || tanggalHariIni(),
      purchaseLink: item.purchaseLink || '',
      serialNumber: item.serialNumber || '',
      location: isCustomLoc ? 'Lainnya' : item.location,
      customLocation: isCustomLoc ? item.location : '',
      picEmployeeId: item.picEmployeeId || '',
      condition: item.condition || 'BAIK',
      status: item.status || 'AKTIF',
      scope: item.scope || 'PRIBADI',
      autoCreateExpense: false,
      notes: item.notes || '',
    });
    setActionError(null);
    setIsFormModalOpen(true);
  };

  // Handle Photo selection
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      const previewUrl = URL.createObjectURL(file);
      setPhotoPreview(previewUrl);
    }
  };

  // Live Qty / Price calculation
  const handleQtyPriceChange = (qty: number, price: number) => {
    const validQty = Math.max(1, qty);
    const validPrice = Math.max(0, price);
    setFormData((prev) => ({
      ...prev,
      quantity: validQty,
      pricePerUnit: validPrice,
      totalValue: validQty * validPrice,
    }));
  };

  // Submit Inventory Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.itemName.trim()) {
      setActionError('Nama barang wajib diisi.');
      return;
    }

    setSubmitting(true);
    setActionError(null);

    const finalCategory =
      formData.category === 'LAINNYA' && formData.customCategory.trim()
        ? formData.customCategory.trim()
        : formData.category;

    const finalLocation =
      formData.location === 'Lainnya' && formData.customLocation.trim()
        ? formData.customLocation.trim()
        : formData.location;

    const selectedPic = employees.find((emp) => emp.id === formData.picEmployeeId);

    try {
      let photoMetadata: any = {};

      if (photoFile) {
        setUploadingPhoto(true);
        const uploaded = await uploadInventoryPhoto(photoFile, 'inv');
        photoMetadata = {
          photoUrl: uploaded.photoUrl,
          photoStoragePath: uploaded.storagePath,
          photoSizeBytes: uploaded.photoSizeBytes,
          photoMimeType: uploaded.photoMimeType,
          photoWidth: uploaded.photoWidth,
          photoHeight: uploaded.photoHeight,
        };
        setUploadingPhoto(false);
      } else if (editingItem) {
        photoMetadata = {
          photoUrl: editingItem.photoUrl || '',
          photoStoragePath: editingItem.photoStoragePath || '',
          photoSizeBytes: editingItem.photoSizeBytes || 0,
          photoMimeType: editingItem.photoMimeType || '',
          photoWidth: editingItem.photoWidth || 0,
          photoHeight: editingItem.photoHeight || 0,
        };
      }

      if (editingItem && editingItem.id) {
        await updateInventory(
          editingItem.id,
          editingItem,
          {
            itemName: formData.itemName.trim(),
            category: finalCategory,
            quantity: Number(formData.quantity),
            pricePerUnit: Number(formData.pricePerUnit),
            totalValue: Number(formData.quantity) * Number(formData.pricePerUnit),
            purchaseDate: formData.purchaseDate,
            purchaseLink: formData.purchaseLink.trim(),
            serialNumber: formData.serialNumber.trim(),
            location: finalLocation,
            picEmployeeId: formData.picEmployeeId || '',
            picEmployeeName: selectedPic?.name || '',
            condition: formData.condition,
            status: formData.status,
            scope: formData.scope,
            notes: formData.notes.trim(),
            ...photoMetadata,
          },
          userProfile?.uid || 'anonymous',
          userProfile?.name || 'User'
        );
        showToast(`Data barang "${formData.itemName}" berhasil diperbarui.`);
      } else {
        await createInventory(
          {
            itemName: formData.itemName.trim(),
            category: finalCategory,
            quantity: Number(formData.quantity),
            pricePerUnit: Number(formData.pricePerUnit),
            totalValue: Number(formData.quantity) * Number(formData.pricePerUnit),
            purchaseDate: formData.purchaseDate,
            purchaseLink: formData.purchaseLink.trim(),
            serialNumber: formData.serialNumber.trim(),
            location: finalLocation,
            picEmployeeId: formData.picEmployeeId || '',
            picEmployeeName: selectedPic?.name || '',
            condition: formData.condition,
            status: formData.status,
            scope: formData.scope,
            notes: formData.notes.trim(),
            createdBy: userProfile?.uid || 'anonymous',
            ...photoMetadata,
          },
          formData.autoCreateExpense,
          userProfile?.uid || 'anonymous',
          userProfile?.name || 'User'
        );
        showToast(`Barang inventory "${formData.itemName}" berhasil ditambahkan.`);
      }

      setIsFormModalOpen(false);
    } catch (err: any) {
      console.error('Error saving inventory:', err);
      setActionError(err.message || 'Gagal menyimpan data inventory.');
    } finally {
      setSubmitting(false);
      setUploadingPhoto(false);
    }
  };

  // Open Move Modal
  const handleOpenMove = (item: InventoryItem) => {
    setMovingItem(item);
    setMoveLocation(item.location || DEFAULT_INVENTORY_LOCATIONS[0]);
    setMovePicId(item.picEmployeeId || '');
    setMoveNotes('');
    setIsFormModalOpen(false);
  };

  // Submit Move Action
  const handleSubmitMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movingItem || !movingItem.id) return;

    setSubmittingMove(true);
    const selectedPic = employees.find((emp) => emp.id === movePicId);

    try {
      await moveInventory(
        movingItem.id,
        movingItem,
        moveLocation,
        movePicId,
        selectedPic?.name || '',
        moveNotes,
        userProfile?.uid || 'anonymous',
        userProfile?.name || 'User'
      );
      showToast(`Barang "${movingItem.itemName}" berhasil dipindahkan ke ${moveLocation}.`);
      setMovingItem(null);
    } catch (err: any) {
      alert(`Gagal memindahkan barang: ${err.message}`);
    } finally {
      setSubmittingMove(false);
    }
  };

  // Quick Condition Change
  const handleQuickConditionChange = async (item: InventoryItem, newCond: InventoryCondition) => {
    if (!item.id || item.condition === newCond) return;
    try {
      await updateInventoryCondition(
        item.id,
        item,
        newCond,
        `Perubahan kondisi cepat dari tabel`,
        userProfile?.uid || 'anonymous',
        userProfile?.name || 'User'
      );
      showToast(`Kondisi ${item.itemName} diubah ke ${newCond}`);
    } catch (err: any) {
      alert(`Gagal mengubah kondisi barang: ${err.message}`);
    }
  };

  // Record Expense Manual with Anti-Double-Entry
  const handleRecordExpense = async (item: InventoryItem) => {
    if (!item.id) return;
    try {
      const result = await recordInventoryExpense(
        item.id,
        item,
        userProfile?.uid || 'anonymous',
        userProfile?.name || 'User'
      );

      if (result.success) {
        showToast(result.message);
      } else {
        alert(result.message);
      }
    } catch (err: any) {
      alert(`Gagal mencatat pengeluaran inventory: ${err.message}`);
    }
  };

  // Delete Confirm
  const handleDeleteConfirm = async () => {
    if (!deletingItem || !deletingItem.id) return;
    try {
      await deleteInventory(
        deletingItem.id,
        deletingItem,
        userProfile?.uid || 'anonymous',
        userProfile?.name || 'User'
      );
      showToast(`Barang "${deletingItem.itemName}" berhasil dihapus.`);
      setDeletingItem(null);
    } catch (err: any) {
      alert(`Gagal menghapus barang: ${err.message}`);
    }
  };

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // Export to CSV
  const handleExportCSV = () => {
    const exportData = filteredItems.map((item) => ({
      'Nama Barang': item.itemName,
      Kategori: item.category,
      Jumlah: item.quantity,
      'Harga Satuan (Rp)': item.pricePerUnit,
      'Total Nilai (Rp)': item.totalValue,
      'Tanggal Pembelian': item.purchaseDate,
      Lokasi: item.location,
      'Penanggung Jawab (PIC)': item.picEmployeeName || '-',
      Kondisi: item.condition,
      Status: item.status,
      Scope: item.scope,
      'Nomor Seri': item.serialNumber || '-',
      'Tercatat Kas': item.isExpenseRecorded ? 'YA' : 'BELUM',
      'Link Pembelian': item.purchaseLink || '-',
      Catatan: item.notes || '-',
    }));

    exportToCSV(exportData, `Rekap_Inventory_Aset_PT_KDRT_${tanggalHariIni()}.csv`);
  };

  // Condition Badge Helper
  const getConditionBadge = (cond: InventoryCondition) => {
    switch (cond) {
      case 'BAIK':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PERLU PERBAIKAN':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'RUSAK':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'HILANG':
        return 'bg-slate-800 text-slate-100 border-slate-700';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div id="inventory-page-container" className="space-y-5 pb-12">
      {/* Toast Notification */}
      {successToast && (
        <div
          id="inventory-toast-success"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-slate-900/95 px-4 py-3 text-sm font-medium text-emerald-400 shadow-2xl backdrop-blur border border-emerald-500/30 animate-fade-in"
        >
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header & Main Actions */}
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
            <span className="text-slate-700">OPERASIONAL & ASET</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-indigo-600">INVENTORY & ASET</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Boxes className="h-7 w-7 text-indigo-600" />
            Inventory & Aset Kantor
          </h1>
          <p className="text-sm text-slate-500">
            Pencatatan aset operasional, peralatan konten, lokasi penyimpanan, kondisi, dan penanggung jawab PT.KDRT.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            id="btn-export-inventory-csv"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Export CSV</span>
          </button>

          {!isInvestor && (
            <button
              id="btn-add-inventory"
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Inventory</span>
            </button>
          )}
        </div>
      </div>

      {/* Dashboard Metrik Inventory */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {/* Total Nilai Inventory (Prominent Card) */}
        <div className="col-span-2 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-indigo-50/40 p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center justify-between">
            <span>Total Nilai Inventory</span>
            <Tag className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-1 text-2xl font-extrabold text-indigo-700">
            {formatRupiah(metrics.totalValue)}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-indigo-600 font-medium">
            <span>{metrics.totalCount} Barang ({metrics.totalUnits} Unit)</span>
            <span>{metrics.aktif} Barang Aktif</span>
          </div>
        </div>

        {/* Kondisi Baik */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-800 flex items-center justify-between">
            <span>Kondisi Baik</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-1 text-2xl font-bold text-emerald-900">{metrics.baik}</div>
          <div className="mt-0.5 text-xs text-emerald-600">Siap Digunakan</div>
        </div>

        {/* Perlu Perbaikan */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-800 flex items-center justify-between">
            <span>Perlu Perbaikan</span>
            <Wrench className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-1 text-2xl font-bold text-amber-900">{metrics.perluPerbaikan}</div>
          <div className="mt-0.5 text-xs text-amber-600">Perlu Servis</div>
        </div>

        {/* Rusak */}
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3.5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-rose-800 flex items-center justify-between">
            <span>Rusak</span>
            <AlertTriangle className="h-4 w-4 text-rose-600" />
          </div>
          <div className="mt-1 text-2xl font-bold text-rose-900">{metrics.rusak}</div>
          <div className="mt-0.5 text-xs text-rose-600">Tidak Berfungsi</div>
        </div>

        {/* Hilang */}
        <div className="rounded-xl border border-slate-300 bg-slate-100/70 p-3.5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center justify-between">
            <span>Hilang</span>
            <HelpCircle className="h-4 w-4 text-slate-500" />
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-800">{metrics.hilang}</div>
          <div className="mt-0.5 text-xs text-slate-500">Tidak Ditemukan</div>
        </div>
      </div>

      {/* Nilai Berdasarkan Kategori (Visual Breakdown) */}
      {metrics.categoryList.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-indigo-600" />
            Distribusi Nilai Aset per Kategori
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {metrics.categoryList.slice(0, 4).map((catItem) => (
              <div
                key={catItem.category}
                className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span className="truncate">{catItem.category}</span>
                  <span className="text-indigo-600 font-bold">{catItem.percentage}%</span>
                </div>
                <div className="mt-1 text-sm font-bold text-slate-900">
                  {formatRupiah(catItem.totalValue)}
                </div>
                <div className="mt-1.5 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full"
                    style={{ width: `${catItem.percentage}%` }}
                  />
                </div>
                <div className="mt-1 text-[11px] text-slate-500">{catItem.count} unit barang</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              id="input-search-inventory"
              type="text"
              placeholder="Cari nama barang, no. seri, PIC, lokasi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-300 pl-9 pr-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Kategori Filter */}
          <div>
            <select
              id="filter-inventory-category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="SEMUA">Semua Kategori</option>
              {DEFAULT_INVENTORY_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Kondisi Filter */}
          <div>
            <select
              id="filter-inventory-condition"
              value={conditionFilter}
              onChange={(e) => setConditionFilter(e.target.value as any)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="SEMUA">Semua Kondisi</option>
              {CONDITION_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  Kondisi: {c}
                </option>
              ))}
            </select>
          </div>

          {/* Lokasi Filter */}
          <div>
            <select
              id="filter-inventory-location"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="SEMUA">Semua Lokasi</option>
              {DEFAULT_INVENTORY_LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  Lokasi: {loc}
                </option>
              ))}
            </select>
          </div>

          {/* PIC Filter */}
          <div>
            <select
              id="filter-inventory-pic"
              value={picFilter}
              onChange={(e) => setPicFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="SEMUA">Semua PIC</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Scope & Reset Bar */}
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

            <div className="flex items-center gap-1 ml-2">
              <span className="font-semibold text-slate-600">Status:</span>
              <button
                onClick={() => setStatusFilter('SEMUA')}
                className={`px-2 py-0.5 rounded font-medium ${
                  statusFilter === 'SEMUA' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setStatusFilter('AKTIF')}
                className={`px-2 py-0.5 rounded font-medium ${
                  statusFilter === 'AKTIF' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                AKTIF
              </button>
              <button
                onClick={() => setStatusFilter('NONAKTIF')}
                className={`px-2 py-0.5 rounded font-medium ${
                  statusFilter === 'NONAKTIF' ? 'bg-slate-400 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                NONAKTIF
              </button>
            </div>
          </div>

          <div className="text-slate-500 font-medium">
            Menampilkan <strong className="text-slate-900">{filteredItems.length}</strong> aset barang
          </div>
        </div>
      </div>

      {/* Main Inventory Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-500 mb-3" />
            <p className="text-sm font-medium">Memuat data inventory & aset...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center">
            <Boxes className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-900">Belum ada barang inventory</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
              {searchQuery || categoryFilter !== 'SEMUA' || conditionFilter !== 'SEMUA'
                ? 'Tidak ada barang yang cocok dengan kriteria pencarian/filter.'
                : 'Mulai catat seluruh peralatan konten, elektronik, furniture, dan aset kantor PT.KDRT.'}
            </p>
            {!isInvestor && (
              <button
                onClick={handleOpenAdd}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                Tambah Barang Pertama
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-4 py-3.5">Barang & Kategori</th>
                  <th className="px-4 py-3.5">Jumlah & Harga</th>
                  <th className="px-4 py-3.5">Total Nilai</th>
                  <th className="px-4 py-3.5">Lokasi & PIC</th>
                  <th className="px-4 py-3.5">Kondisi</th>
                  <th className="px-4 py-3.5">Status & Scope</th>
                  <th className="px-4 py-3.5">Biaya Kas</th>
                  <th className="px-4 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition">
                    {/* Foto & Nama Barang */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center">
                          {item.photoUrl ? (
                            <img
                              src={item.photoUrl}
                              alt={item.itemName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Boxes className="h-6 w-6 text-slate-400" />
                          )}
                        </div>
                        <div className="max-w-xs">
                          <button
                            onClick={() => {
                              setSelectedItemDetail(item);
                              setActiveDetailTab('PROFIL');
                            }}
                            className="font-bold text-slate-900 hover:text-indigo-600 text-left line-clamp-1 transition"
                          >
                            {item.itemName}
                          </button>
                          <div className="flex items-center gap-1 text-xs text-indigo-600 font-medium mt-0.5">
                            <span>{item.category}</span>
                            {item.serialNumber && (
                              <span className="text-slate-400 text-[11px]">
                                • SN: {item.serialNumber}
                              </span>
                            )}
                          </div>
                          {item.purchaseDate && (
                            <div className="text-[11px] text-slate-400">
                              Dibeli: {formatTanggal(item.purchaseDate)}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Qty & Harga Satuan */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-xs">
                      <div className="font-bold text-slate-900">
                        {item.quantity} Unit
                      </div>
                      <div className="text-slate-500">
                        @ {formatRupiah(item.pricePerUnit)}
                      </div>
                    </td>

                    {/* Total Nilai */}
                    <td className="px-4 py-3.5 whitespace-nowrap font-bold text-indigo-700">
                      {formatRupiah(item.totalValue)}
                    </td>

                    {/* Lokasi & PIC */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-xs">
                      <div className="flex items-center gap-1 font-semibold text-slate-800">
                        <MapPin className="h-3.5 w-3.5 text-indigo-500" />
                        <span>{item.location}</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-500 mt-0.5">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        <span>PIC: {item.picEmployeeName || 'Belum Ditugaskan'}</span>
                      </div>
                    </td>

                    {/* Kondisi */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {!isInvestor ? (
                        <select
                          value={item.condition}
                          onChange={(e) =>
                            handleQuickConditionChange(item, e.target.value as InventoryCondition)
                          }
                          className={`rounded-full px-2.5 py-1 text-xs font-bold border focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${getConditionBadge(
                            item.condition
                          )}`}
                        >
                          {CONDITION_OPTIONS.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border ${getConditionBadge(
                            item.condition
                          )}`}
                        >
                          {item.condition}
                        </span>
                      )}
                    </td>

                    {/* Status & Scope */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-xs">
                      <div>
                        {item.status === 'AKTIF' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" /> AKTIF
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            NONAKTIF
                          </span>
                        )}
                      </div>
                      <div className="mt-1">
                        {item.scope === 'SHARING' ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                            <Share2 className="h-2.5 w-2.5" /> SHARING
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                            <Lock className="h-2.5 w-2.5" /> PRIBADI
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Biaya Kas (Anti-Double-Entry Status) */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-xs">
                      {item.isExpenseRecorded || item.expenseId ? (
                        <div className="flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                          <CheckCheck className="h-3.5 w-3.5" />
                          <span>Tercatat Kas</span>
                        </div>
                      ) : !isInvestor ? (
                        <button
                          onClick={() => handleRecordExpense(item)}
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
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setSelectedItemDetail(item);
                            setActiveDetailTab('PROFIL');
                          }}
                          title="Lihat Detail & Riwayat"
                          className="rounded p-1.5 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {!isInvestor && (
                          <button
                            onClick={() => handleOpenMove(item)}
                            title="Pindahkan Lokasi / PIC"
                            className="rounded p-1.5 text-indigo-600 hover:bg-indigo-50 transition"
                          >
                            <ArrowRightLeft className="h-4 w-4" />
                          </button>
                        )}

                        {!isInvestor && (
                          <button
                            onClick={() => handleOpenEdit(item)}
                            title="Edit Data Barang"
                            className="rounded p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}

                        {isOwner && (
                          <button
                            onClick={() => setDeletingItem(item)}
                            title="Hapus Barang"
                            className="rounded p-1.5 text-red-500 hover:bg-red-50 transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Tambah / Edit Inventory */}
      {isFormModalOpen && (
        <div
          id="modal-inventory-form"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in"
        >
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Boxes className="h-5 w-5 text-indigo-600" />
                  {editingItem ? 'Edit Data Barang Inventory' : 'Tambah Inventory & Aset Baru'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Input detail peralatan, multi-qty, harga beli, lokasi, penanggung jawab, dan integrasi kas.
                </p>
              </div>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {actionError && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Nama Barang */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Nama Barang / Peralatan <span className="text-red-500">*</span>
                </label>
                <input
                  id="input-inventory-name"
                  type="text"
                  required
                  placeholder="Contoh: Kamera Sony Alpha A7 IV / Ring Light Godox 60W / Laptop Editing M2"
                  value={formData.itemName}
                  onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                />
              </div>

              {/* Kategori & Kategori Custom */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Kategori <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="select-inventory-category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {DEFAULT_INVENTORY_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {formData.category === 'LAINNYA' && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Nama Kategori Custom <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Masukkan nama kategori baru"
                      value={formData.customCategory}
                      onChange={(e) => setFormData({ ...formData, customCategory: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>

              {/* Foto Upload dengan Canvas Compression */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Foto Barang (Firebase Storage)
                </label>
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-slate-300 bg-slate-100 flex items-center justify-center">
                    {photoPreview ? (
                      <img
                        src={photoPreview}
                        alt="Preview Foto"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Camera className="h-6 w-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      id="input-inventory-photo"
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoSelect}
                      className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Foto dikompresi otomatis sebelum diunggah ke Firebase Storage.
                    </p>
                  </div>
                </div>
              </div>

              {/* Multi-Qty, Harga Satuan & Total Nilai Otomatis */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Jumlah Unit (Qty) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="input-inventory-qty"
                    type="number"
                    min="1"
                    required
                    value={formData.quantity}
                    onChange={(e) =>
                      handleQtyPriceChange(Number(e.target.value), formData.pricePerUnit)
                    }
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Harga Satuan (Rp) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="input-inventory-price"
                    type="number"
                    min="0"
                    required
                    value={formData.pricePerUnit || ''}
                    onChange={(e) =>
                      handleQtyPriceChange(formData.quantity, Number(e.target.value))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Total Nilai (Otomatis)
                  </label>
                  <div className="rounded-lg bg-indigo-50/70 border border-indigo-200 px-3.5 py-2 text-sm font-extrabold text-indigo-700">
                    {formatRupiah(formData.totalValue)}
                  </div>
                </div>
              </div>

              {/* Tanggal & Link Pembelian & Nomor Seri */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Tanggal Pembelian <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="input-inventory-date"
                    type="date"
                    required
                    value={formData.purchaseDate}
                    onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Nomor Seri / SN (Opsional)
                  </label>
                  <input
                    id="input-inventory-sn"
                    type="text"
                    placeholder="Contoh: SN-882941X"
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Link Pembelian (Opsional)
                  </label>
                  <input
                    id="input-inventory-link"
                    type="url"
                    placeholder="https://..."
                    value={formData.purchaseLink}
                    onChange={(e) => setFormData({ ...formData, purchaseLink: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Lokasi & Penanggung Jawab (PIC) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Lokasi Barang <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="select-inventory-location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {DEFAULT_INVENTORY_LOCATIONS.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                  {formData.location === 'Lainnya' && (
                    <input
                      type="text"
                      placeholder="Masukkan nama lokasi"
                      value={formData.customLocation}
                      onChange={(e) => setFormData({ ...formData, customLocation: e.target.value })}
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Penanggung Jawab (PIC Karyawan)
                  </label>
                  <select
                    id="select-inventory-pic"
                    value={formData.picEmployeeId}
                    onChange={(e) => setFormData({ ...formData, picEmployeeId: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">-- Belum Ditugaskan --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Kondisi, Status, dan Scope */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Kondisi Barang <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="select-inventory-condition"
                    value={formData.condition}
                    onChange={(e) =>
                      setFormData({ ...formData, condition: e.target.value as InventoryCondition })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                  >
                    {CONDITION_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Status Penggunaan <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="select-inventory-status"
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value as InventoryStatus })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Scope <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="select-inventory-scope"
                    value={formData.scope}
                    onChange={(e) =>
                      setFormData({ ...formData, scope: e.target.value as ScopeType })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                  >
                    <option value="PRIBADI">PRIBADI (Internal Kantor)</option>
                    <option value="SHARING">SHARING (Terbuka untuk Investor)</option>
                  </select>
                </div>
              </div>

              {/* Integrasi Kas / Pengeluaran */}
              {!editingItem && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3.5 space-y-2">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.autoCreateExpense}
                      onChange={(e) =>
                        setFormData({ ...formData, autoCreateExpense: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-bold text-indigo-950">
                      Otomatis catat pembelian ini ke Pengeluaran Kas (Kategori: INVENTORY)
                    </span>
                  </label>
                  <p className="text-[11px] text-indigo-700/80 pl-6">
                    Sistem akan mencatat pengeluaran sebesar Rp {formData.totalValue.toLocaleString('id-ID')} ke modul Arus Kas dan Buku Pengeluaran dengan proteksi Anti-Double-Entry.
                  </p>
                </div>
              )}

              {/* Catatan */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Catatan Tambahan
                </label>
                <textarea
                  id="textarea-inventory-notes"
                  rows={2}
                  placeholder="Kelengkapan box, nomor invoice, garansi, atau catatan khusus lainnya..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting || uploadingPhoto}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  {submitting || uploadingPhoto ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>{uploadingPhoto ? 'Mengunggah Foto...' : 'Menyimpan...'}</span>
                    </>
                  ) : (
                    <span>{editingItem ? 'Simpan Perubahan' : 'Simpan Inventory'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal [ PINDAHKAN ] Barang */}
      {movingItem && (
        <div
          id="modal-move-inventory"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in"
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ArrowRightLeft className="h-5 w-5 text-indigo-600" />
                  Pindahkan Barang / Ubah PIC
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{movingItem.itemName}</p>
              </div>
              <button
                onClick={() => setMovingItem(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitMove} className="p-6 space-y-4">
              {/* Lokasi Baru */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Lokasi Baru <span className="text-red-500">*</span>
                </label>
                <div className="text-xs text-slate-500 mb-1.5">
                  Lokasi Saat Ini: <strong className="text-slate-800">{movingItem.location}</strong>
                </div>
                <select
                  value={moveLocation}
                  onChange={(e) => setMoveLocation(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {DEFAULT_INVENTORY_LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>

              {/* PIC Baru */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Penanggung Jawab Baru (PIC)
                </label>
                <div className="text-xs text-slate-500 mb-1.5">
                  PIC Saat Ini:{' '}
                  <strong className="text-slate-800">
                    {movingItem.picEmployeeName || 'Belum ada'}
                  </strong>
                </div>
                <select
                  value={movePicId}
                  onChange={(e) => setMovePicId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">-- Tanpa PIC / Kantor Umum --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Catatan Pemindahan */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Alasan / Catatan Pemindahan
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Dipinjam untuk live studio B / diserahterimakan..."
                  value={moveNotes}
                  onChange={(e) => setMoveNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setMovingItem(null)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingMove}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  {submittingMove ? 'Memproses...' : 'Simpan Pemindahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal / Drawer Detail Inventory dengan 3 TAB (Profil, Riwayat, Pengeluaran) */}
      {selectedItemDetail && (
        <div
          id="modal-inventory-detail"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in"
        >
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white flex items-center justify-center">
                  {selectedItemDetail.photoUrl ? (
                    <img
                      src={selectedItemDetail.photoUrl}
                      alt={selectedItemDetail.itemName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Boxes className="h-5 w-5 text-indigo-600" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{selectedItemDetail.itemName}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-indigo-600">{selectedItemDetail.category}</span>
                    <span>•</span>
                    <span>Lokasi: {selectedItemDetail.location}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedItemDetail(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center border-b border-slate-200 bg-white px-6">
              <button
                onClick={() => setActiveDetailTab('PROFIL')}
                className={`flex items-center gap-2 border-b-2 py-3 px-4 text-xs font-bold uppercase tracking-wider transition ${
                  activeDetailTab === 'PROFIL'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileText className="h-4 w-4" />
                <span>Profil & Spesifikasi</span>
              </button>

              <button
                onClick={() => setActiveDetailTab('RIWAYAT')}
                className={`flex items-center gap-2 border-b-2 py-3 px-4 text-xs font-bold uppercase tracking-wider transition ${
                  activeDetailTab === 'RIWAYAT'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <History className="h-4 w-4" />
                <span>Riwayat & Timeline ({itemHistories.length})</span>
              </button>

              <button
                onClick={() => setActiveDetailTab('PENGELUARAN')}
                className={`flex items-center gap-2 border-b-2 py-3 px-4 text-xs font-bold uppercase tracking-wider transition ${
                  activeDetailTab === 'PENGELUARAN'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <DollarSign className="h-4 w-4" />
                <span>Integrasi Kas</span>
              </button>
            </div>

            {/* Tab Contents */}
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {/* TAB 1: PROFIL & SPESIFIKASI */}
              {activeDetailTab === 'PROFIL' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Foto Besar jika ada */}
                    {selectedItemDetail.photoUrl && (
                      <div className="sm:col-span-2 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 max-h-60 flex items-center justify-center">
                        <img
                          src={selectedItemDetail.photoUrl}
                          alt={selectedItemDetail.itemName}
                          className="max-h-60 w-auto object-contain"
                        />
                      </div>
                    )}

                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2.5">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Informasi Aset
                      </div>
                      <div className="text-sm">
                        <span className="text-slate-500">Kategori:</span>{' '}
                        <strong className="text-slate-900">{selectedItemDetail.category}</strong>
                      </div>
                      <div className="text-sm">
                        <span className="text-slate-500">Nomor Seri (SN):</span>{' '}
                        <strong className="text-slate-900">{selectedItemDetail.serialNumber || '-'}</strong>
                      </div>
                      <div className="text-sm">
                        <span className="text-slate-500">Kondisi:</span>{' '}
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold border ${getConditionBadge(
                            selectedItemDetail.condition
                          )}`}
                        >
                          {selectedItemDetail.condition}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-slate-500">Status:</span>{' '}
                        <strong className="text-slate-900">{selectedItemDetail.status}</strong>
                      </div>
                      <div className="text-sm">
                        <span className="text-slate-500">Scope:</span>{' '}
                        <strong className="text-slate-900">{selectedItemDetail.scope}</strong>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2.5">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Nilai & Finansial
                      </div>
                      <div className="text-sm">
                        <span className="text-slate-500">Jumlah:</span>{' '}
                        <strong className="text-slate-900">{selectedItemDetail.quantity} Unit</strong>
                      </div>
                      <div className="text-sm">
                        <span className="text-slate-500">Harga Satuan:</span>{' '}
                        <strong className="text-slate-900">
                          {formatRupiah(selectedItemDetail.pricePerUnit)}
                        </strong>
                      </div>
                      <div className="text-sm">
                        <span className="text-slate-500">Total Nilai:</span>{' '}
                        <strong className="text-indigo-700 text-base font-extrabold">
                          {formatRupiah(selectedItemDetail.totalValue)}
                        </strong>
                      </div>
                      <div className="text-sm">
                        <span className="text-slate-500">Tanggal Pembelian:</span>{' '}
                        <strong className="text-slate-900">
                          {formatTanggal(selectedItemDetail.purchaseDate)}
                        </strong>
                      </div>
                      {selectedItemDetail.purchaseLink && (
                        <div className="text-sm">
                          <a
                            href={selectedItemDetail.purchaseLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline font-semibold"
                          >
                            <span>Buka Link Toko / Pembelian</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Lokasi & PIC */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Penempatan & PIC
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-slate-500">Lokasi:</span>{' '}
                        <strong className="text-slate-900">{selectedItemDetail.location}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">PIC Penanggung Jawab:</span>{' '}
                        <strong className="text-slate-900">
                          {selectedItemDetail.picEmployeeName || 'Belum Ditugaskan'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Catatan */}
                  {selectedItemDetail.notes && (
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Catatan
                      </div>
                      <p className="text-sm text-slate-700">{selectedItemDetail.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: RIWAYAT / TIMELINE */}
              {activeDetailTab === 'RIWAYAT' && (
                <div className="space-y-4">
                  {loadingHistories ? (
                    <div className="p-8 text-center text-slate-500">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-500 mb-2" />
                      <p className="text-xs font-medium">Memuat histori inventory...</p>
                    </div>
                  ) : itemHistories.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      <History className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-xs">Belum ada riwayat aktivitas yang tercatat.</p>
                    </div>
                  ) : (
                    <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                      {itemHistories.map((h, idx) => (
                        <div key={h.id || idx} className="relative group">
                          {/* Dot */}
                          <div className="absolute -left-6 top-1 h-4 w-4 rounded-full bg-indigo-600 border-2 border-white shadow-sm" />

                          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-indigo-700 uppercase tracking-wider">
                                {h.action.replace(/_/g, ' ')}
                              </span>
                              <span className="text-slate-400">
                                {formatTanggal(h.date || h.createdAt)}
                              </span>
                            </div>

                            {h.notes && (
                              <p className="text-xs text-slate-700 font-medium">{h.notes}</p>
                            )}

                            {h.previousLocation && h.newLocation && (
                              <div className="text-[11px] text-slate-500">
                                Lokasi: {h.previousLocation} ➔ <strong>{h.newLocation}</strong>
                              </div>
                            )}

                            {h.previousCondition && h.newCondition && (
                              <div className="text-[11px] text-slate-500">
                                Kondisi: {h.previousCondition} ➔ <strong>{h.newCondition}</strong>
                              </div>
                            )}

                            <div className="text-[10px] text-slate-400 pt-1">
                              Oleh: {h.actorName}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: INTEGRASI KAS & ANTI DOUBLE ENTRY */}
              {activeDetailTab === 'PENGELUARAN' && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        Status Pengeluaran Kas
                      </span>
                      {selectedItemDetail.isExpenseRecorded || selectedItemDetail.expenseId ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-300">
                          <CheckCheck className="h-3.5 w-3.5" /> SUDAH TERCATAT DI KAS
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 border border-amber-300">
                          BELUM DICATAT KE KAS
                        </span>
                      )}
                    </div>

                    <div className="text-sm">
                      <span className="text-slate-500">Total Nilai Barang:</span>{' '}
                      <strong className="text-indigo-700 font-bold">
                        {formatRupiah(selectedItemDetail.totalValue)}
                      </strong>
                    </div>

                    {selectedItemDetail.expenseId && (
                      <div className="text-xs text-slate-500">
                        Reference Expense ID: <code className="bg-white px-1.5 py-0.5 rounded border">{selectedItemDetail.expenseId}</code>
                      </div>
                    )}

                    {!selectedItemDetail.isExpenseRecorded && !selectedItemDetail.expenseId && !isInvestor && (
                      <div className="pt-2">
                        <button
                          onClick={() => {
                            handleRecordExpense(selectedItemDetail);
                            setSelectedItemDetail({
                              ...selectedItemDetail,
                              isExpenseRecorded: true,
                            });
                          }}
                          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition"
                        >
                          <DollarSign className="h-4 w-4" />
                          <span>Catat Sebagai Pengeluaran Kas Sekarang</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 text-xs text-indigo-900 space-y-1.5">
                    <div className="font-bold flex items-center gap-1.5">
                      <Lock className="h-4 w-4 text-indigo-600" />
                      Proteksi Anti-Double-Entry
                    </div>
                    <p>
                      Sistem menjamin satu barang inventory hanya dapat dicatat satu kali ke buku pengeluaran kas. Jika sudah tercatat, sistem akan mencegah duplikasi pencatatan.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3">
              <button
                onClick={() => setSelectedItemDetail(null)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-900 transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingItem && (
        <div
          id="modal-delete-inventory"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in"
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="rounded-full bg-red-100 p-2.5">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Hapus Barang Inventory?</h3>
                <p className="text-xs text-slate-500">{deletingItem.itemName}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus barang <strong>"{deletingItem.itemName}"</strong> (Kategori: {deletingItem.category}, Nilai: {formatRupiah(deletingItem.totalValue)}) dari sistem? Aksi ini akan dicatat ke Audit Log.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeletingItem(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 shadow-sm"
              >
                Ya, Hapus Barang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
