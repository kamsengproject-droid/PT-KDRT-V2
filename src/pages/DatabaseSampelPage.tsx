import React, { useState, useEffect, useMemo } from 'react';
import { CurrencyInput } from '../components/CurrencyInput';
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
  Layers,
  Percent,
  Check,
  SlidersHorizontal,
  Camera,
  Sparkles,
  MapPin,
  FileSpreadsheet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ProductScanModal } from '../components/sample/ProductScanModal';
import { AddProductSampleModal } from '../components/sample/AddProductSampleModal';
import { ImportSpreadsheetModal } from '../components/sample/ImportSpreadsheetModal';
import { AIScanResult } from '../services/aiScanService';
import {
  AffiliateSample,
  SampleStatus,
  Product,
  Account,
  Employee,
  ScopeType,
  ProductStatus,
  SampleLocation,
} from '../types';
import {
  subscribeSamples,
  createSample,
  updateSample,
  updateSampleStatus,
  updateSampleContentProgress,
  deleteSample,
  uploadSampleImage,
  syncAllSamplesToFinancialTransactions,
} from '../services/sampleService';
import {
  subscribeProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../services/productService';
import { subscribeAccounts } from '../services/accountService';
import { subscribeEmployees } from '../services/employeeService';
import { subscribeSampleLocations } from '../services/sampleLocationService';
import { formatRupiah, formatTanggal, tanggalHariIni, exportToCSV } from '../utils/formatters';

interface DatabaseSampelPageProps {
  onBackToPortal?: () => void;
  initialProductId?: string;
  initialTab?: 'SAMPEL' | 'PRODUK' | 'MASTER_PRODUK';
}

export const MASTER_KATEGORI_OPTIONS = [
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

export const EMPLOYEE_KATEGORI_OPTIONS = [
  'Fashion Kaos',
  'Fashion Setelan',
  'Fashion Batik',
  'Fashion Celana',
];

export const DatabaseSampelPage: React.FC<DatabaseSampelPageProps> = ({
  onBackToPortal,
  initialProductId,
  initialTab,
}) => {
  const { userProfile, role, loading: authLoading, currentUser, employeeProfile } = useAuth();
  const isOwner = role === 'OWNER';
  const isManager = role === 'MANAGER';
  const isEmployee = role === 'EMPLOYEE';
  const isInvestor = role === 'INVESTOR';
  // Sharing employees (e.g. Melinda, Desta) get the restricted Fashion category set.
  // Employees on PRIBADI scope still see the full master category list.
  const isSharingEmployee = isEmployee && userProfile?.scope === 'SHARING';

  // Data states
  const [samples, setSamples] = useState<AffiliateSample[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<SampleLocation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [scopeFilter, setScopeFilter] = useState<'SEMUA' | ScopeType>(isInvestor ? 'SHARING' : 'SEMUA');
  const [locationFilter, setLocationFilter] = useState<string>('SEMUA');
  
  // Periode Filter untuk Dashboard Metrik (Default: Bulan Sekarang YYYY-MM)
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(currentMonthStr);
  const [isSyncingLedger, setIsSyncingLedger] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<'SAMPEL' | 'MASTER_PRODUK'>(
    initialTab === 'PRODUK' || initialTab === 'MASTER_PRODUK' ? 'MASTER_PRODUK' : 'SAMPEL'
  );
  // Mobile tab state: BELUM SELESAI vs SELESAI
  const [mobileSampleTab, setMobileSampleTab] = useState<'BELUM_SELESAI' | 'SELESAI'>('BELUM_SELESAI');

  // AI Screenshot Scan Modal state
  const [isScanModalOpen, setIsScanModalOpen] = useState<boolean>(false);

  // Unified Single Entry Modal State (+ TAMBAH PRODUK / SAMPEL)
  const [isAddProductSampleModalOpen, setIsAddProductSampleModalOpen] = useState<boolean>(false);
  const [scanDataForUnifiedForm, setScanDataForUnifiedForm] = useState<AIScanResult | null>(null);

  // Spreadsheet Import Modal State (PHASE: IMPORT SPREADSHEET SAMPLE DATABASE)
  const [isImportSpreadsheetModalOpen, setIsImportSpreadsheetModalOpen] = useState<boolean>(false);

  // Chooser Modal State (+ TAMBAH PRODUK / SAMPEL)
  const [showAddChooser, setShowAddChooser] = useState<boolean>(false);

  // Product Form Modal
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productFormData, setProductFormData] = useState<{
    productName: string;
    productPrice: number | '';
    productUrl: string;
    productImage: string;
    commissionRate: number | '';
    accountIds: string[];
    category: string;
    scope: ScopeType;
    status: ProductStatus;
    notes: string;
  }>({
    productName: '',
    productPrice: '',
    productUrl: '',
    productImage: '',
    commissionRate: 10,
    accountIds: [],
    category: isSharingEmployee ? 'Fashion Kaos' : 'Skincare & Kecantikan',
    scope: isEmployee ? (userProfile?.scope || 'SHARING') : (isInvestor ? 'SHARING' : 'PRIBADI'),
    status: 'AKTIF',
    notes: '',
  });

  // Sample Form Modal
  const [isSampleModalOpen, setIsSampleModalOpen] = useState<boolean>(false);
  const [editingSample, setEditingSample] = useState<AffiliateSample | null>(null);
  const [sampleFormData, setSampleFormData] = useState<{
    productId: string;
    productName: string;
    productUrl: string;
    productImage: string;
    samplePrice: number | '';
    purchaseDate: string;
    quantity: number | '';
    totalCost: number | '';
    status: SampleStatus;
    accountId: string;
    employeeId: string;
    targetContent: number | '';
    completedContent: number;
    unitContent: string;
    scope: ScopeType;
    autoCreateExpense: boolean;
    autoCreateTask: boolean;
    notes: string;
    brandName: string;
    size: string;
    locationId?: string;
    locationCode?: string;
    locationName?: string;
  }>({
    productId: '',
    productName: '',
    productUrl: '',
    productImage: '',
    samplePrice: '',
    purchaseDate: tanggalHariIni(),
    quantity: '',
    totalCost: '',
    status: 'DITERIMA',
    accountId: '',
    employeeId: '',
    targetContent: '',
    completedContent: 0,
    unitContent: 'VT',
    scope: isEmployee ? (userProfile?.scope || 'SHARING') : (isInvestor ? 'SHARING' : 'PRIBADI'),
    autoCreateExpense: true,
    autoCreateTask: true,
    notes: '',
    brandName: '',
    size: '',
    locationId: '',
    locationCode: '',
    locationName: '',
  });

  // Sample photo state — kept separate from sampleFormData because it holds a raw
  // File object (not Firestore-serializable). Upload only happens on Save (see
  // handleSubmitSample), never on select/preview.
  const [sampleImageFile, setSampleImageFile] = useState<File | null>(null);
  const [sampleImagePreview, setSampleImagePreview] = useState<string>('');
  const [sampleImageRemoved, setSampleImageRemoved] = useState(false);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const galleryInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (sampleImagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(sampleImagePreview);
      }
    };
  }, [sampleImagePreview]);

  // Output progress modal
  const [progressModalSample, setProgressModalSample] = useState<AffiliateSample | null>(null);
  const [newCompletedCount, setNewCompletedCount] = useState<number>(0);

  // Detail Modal
  const [detailSample, setDetailSample] = useState<AffiliateSample | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);

  // Submitting & Feedback states
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Initial Data Subscriptions
  useEffect(() => {
    if (authLoading || !currentUser || !userProfile?.active) {
      return;
    }
    setLoading(true);

    const unsubProducts = subscribeProducts(undefined, (prodList) => {
      let filtered = prodList;
      if (isInvestor) {
        filtered = prodList.filter((p) => p.scope === 'SHARING');
      }
      setProducts(filtered);
    });

    const unsubSamples = subscribeSamples(undefined, (sampleList) => {
      let filtered = sampleList;
      if (isInvestor) {
        filtered = sampleList.filter((s) => s.scope === 'SHARING');
      }
      setSamples(filtered);
      setLoading(false);
    });

    const unsubAccounts = subscribeAccounts(undefined, (accList) => {
      let filtered = accList.filter((a) => a.active);
      if (isInvestor) {
        filtered = filtered.filter((a) => a.scope === 'SHARING');
      }
      setAccounts(filtered);
    });

    const unsubEmployees = subscribeEmployees(undefined, (empList) => {
      setEmployees(empList.filter((e) => e.active));
    });

    const unsubLocations = subscribeSampleLocations((locList) => {
      setLocations(locList.filter((l) => l.aktif !== false));
    });

    return () => {
      unsubProducts();
      unsubSamples();
      unsubAccounts();
      unsubEmployees();
      unsubLocations();
    };
  }, [authLoading, currentUser?.uid, userProfile?.role, userProfile?.active, isInvestor]);

  // Handle Initial Product ID if navigated from outside
  useEffect(() => {
    if (initialProductId && products.length > 0) {
      const prod = products.find((p) => p.id === initialProductId || p.productId === initialProductId);
      if (prod) {
        handleOpenBuySample(prod);
      }
    }
  }, [initialProductId, products]);

  // Auto clear toast
  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  // Filtered Samples
  const filteredSamples = useMemo(() => {
    return samples.filter((s) => {
      if (isInvestor && s.scope !== 'SHARING') return false;
      if (scopeFilter !== 'SEMUA' && s.scope !== scopeFilter) return false;

      // Location filter
      if (locationFilter === 'BELUM_DITATA') {
        if (s.locationId || s.locationCode) return false;
      } else if (locationFilter !== 'SEMUA') {
        if (s.locationId !== locationFilter && s.locationCode !== locationFilter) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = s.productName?.toLowerCase().includes(q);
        const matchAcc = s.accountName?.toLowerCase().includes(q);
        const matchPic = s.employeeName?.toLowerCase().includes(q);
        const matchBrand = s.brandName?.toLowerCase().includes(q);
        const matchLoc = s.locationCode?.toLowerCase().includes(q) || s.locationName?.toLowerCase().includes(q);
        if (!matchName && !matchPic && !matchBrand && !matchLoc) return false;
      }
      return true;
    });
  }, [samples, scopeFilter, locationFilter, searchQuery, isInvestor]);

  // Dashboard Metrics & Period Filter
  // TOTAL BELANJA SAMPEL: Sum of total cost / totalBayar for the selected period
  // TOTAL SAMPEL: Count of all samples in Database Sampel for the period
  // BELUM DIBUAT KONTEN: Samples not meeting target VT
  // TOTAL SELESAI / TARGET TERPENUHI: Samples meeting target VT
  const { periodFilteredSamples, metrics } = useMemo(() => {
    let totalBelanjaSampel = 0;
    let totalSampel = 0;
    let belumKontenCount = 0;
    let targetTerpenuhiCount = 0;

    const periodSamples = filteredSamples.filter((s) => {
      if (selectedPeriod === 'SEMUA') return true;
      if (!s.purchaseDate) return false;
      return s.purchaseDate.startsWith(selectedPeriod);
    });

    periodSamples.forEach((s) => {
      totalSampel++;
      const cost = Number(s.totalPaid || s.totalCost || (Number(s.samplePrice || 0) * Number(s.quantity || 1))) || 0;
      totalBelanjaSampel += cost;

      const target = Number(s.targetContent) || 1;
      const current = Number(s.completedContent) || 0;
      if (s.status === 'SELESAI' || current >= target) {
        targetTerpenuhiCount++;
      } else {
        belumKontenCount++;
      }
    });

    return {
      periodFilteredSamples: periodSamples,
      metrics: {
        totalBelanjaSampel,
        totalSampel,
        belumKontenCount,
        targetTerpenuhiCount,
      },
    };
  }, [filteredSamples, selectedPeriod]);

  // Split into:
  // BELUM DIBUAT KONTEN / PROSES BERJALAN (current < target)
  // TOTAL SELESAI / TARGET TERPENUHI (current >= target || status === 'SELESAI')
  const { newSamples, oldSamples } = useMemo(() => {
    const fresh: AffiliateSample[] = [];
    const archived: AffiliateSample[] = [];

    filteredSamples.forEach((s) => {
      const target = Number(s.targetContent) || 1;
      const current = Number(s.completedContent) || 0;
      const isDone = s.status === 'SELESAI' || current >= target;
      if (isDone) {
        archived.push(s);
      } else {
        fresh.push(s);
      }
    });

    return { newSamples: fresh, oldSamples: archived };
  }, [filteredSamples]);

  // Handle manual sync to Buku Kas & Bank
  const handleSyncToFinancialLedger = async () => {
    if (isSyncingLedger) return;
    setIsSyncingLedger(true);
    try {
      const uid = userProfile?.uid || currentUser?.uid || 'system';
      const name = userProfile?.name || currentUser?.displayName || 'Admin';
      const result = await syncAllSamplesToFinancialTransactions(uid, name);
      setSuccessToast(`Berhasil menyinkronkan ${result.syncedCount} transaksi pembelian sampel (Rp ${result.totalAmount.toLocaleString('id-ID')}) ke Buku Kas & Bank.`);
    } catch (err: any) {
      alert('Gagal menyinkronkan ke Buku Kas & Bank: ' + err.message);
    } finally {
      setIsSyncingLedger(false);
    }
  };

  // Filtered Master Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (isInvestor && p.scope !== 'SHARING') return false;
      if (scopeFilter !== 'SEMUA' && p.scope !== scopeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.productName?.toLowerCase().includes(q);
        const matchCat = p.category?.toLowerCase().includes(q);
        if (!matchName && !matchCat) return false;
      }
      return true;
    });
  }, [products, scopeFilter, searchQuery, isInvestor]);

  // Handlers for Add Master Product
  const handleOpenAddProduct = () => {
    setShowAddChooser(false);
    setEditingProduct(null);
    setProductFormData({
      productName: '',
      productPrice: 0,
      productUrl: '',
      productImage: '',
      commissionRate: 10,
      accountIds: accounts.length > 0 ? [accounts[0].id!] : [],
      category: isSharingEmployee ? 'Fashion Kaos' : 'Skincare & Kecantikan',
      scope: isEmployee ? (userProfile?.scope || 'SHARING') : (isInvestor ? 'SHARING' : 'PRIBADI'),
      status: 'AKTIF',
      notes: '',
    });
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setProductFormData({
      productName: prod.productName,
      productPrice: prod.productPrice || '',
      productUrl: prod.productUrl || '',
      productImage: prod.productImage || '',
      commissionRate: prod.commissionRate || 10,
      accountIds: prod.accountIds || [],
      category: prod.category || (isSharingEmployee ? 'Fashion Kaos' : 'Skincare & Kecantikan'),
      scope: prod.scope || 'PRIBADI',
      status: prod.status || 'AKTIF',
      notes: prod.notes || '',
    });
    setIsProductModalOpen(true);
  };

  // Handlers for Add Sample
  const handleOpenAddSample = () => {
    setShowAddChooser(false);
    setEditingSample(null);
    const defaultAcc = accounts[0];
    const defaultEmp = employees[0];
    // Sharing employees (e.g. Melinda, Desta) cannot pick their own PIC — always self-assigned.
    const isSharingEmployee = isEmployee && userProfile?.scope === 'SHARING';
    const selfEmployeeId = (employeeProfile as any)?.employeeId || employeeProfile?.id || '';
    setSampleFormData({
      productId: '',
      productName: '',
      productUrl: '',
      productImage: '',
      samplePrice: 0,
      purchaseDate: tanggalHariIni(),
      quantity: '',
      totalCost: '',
      // Sample masuk ke database = sudah diterima di kantor, jadi status default DITERIMA.
      status: 'DITERIMA',
      accountId: defaultAcc?.id || '',
      employeeId: isSharingEmployee ? selfEmployeeId : (defaultEmp?.employeeId || defaultEmp?.id || ''),
      targetContent: '',
      completedContent: 0,
      unitContent: 'VT',
      scope: isEmployee ? (userProfile?.scope || 'SHARING') : (isInvestor ? 'SHARING' : (defaultAcc?.scope || 'PRIBADI')),
      autoCreateExpense: true,
      autoCreateTask: true,
      notes: '',
      sellerName: '',
      brandName: '',
      size: '',
      locationId: '',
      locationCode: '',
      locationName: '',
    });
    setSampleImageFile(null);
    setSampleImagePreview('');
    setSampleImageRemoved(false);
    setIsSampleModalOpen(true);
  };

  // Tombol [ + BELI SAMPEL ] dari Master Product
  const handleOpenBuySample = (prod: Product) => {
    setEditingSample(null);
    const defaultAcc = accounts.find((a) => prod.accountIds?.includes(a.id!)) || accounts[0];
    const defaultEmp = employees[0];
    const price = Number(prod.productPrice) || 0;
    const isSharingEmployee = isEmployee && userProfile?.scope === 'SHARING';
    const selfEmployeeId = (employeeProfile as any)?.employeeId || employeeProfile?.id || '';

    setSampleFormData({
      productId: prod.id || prod.productId || '',
      productName: prod.productName,
      productUrl: prod.productUrl || '',
      productImage: prod.productImage || '',
      samplePrice: price,
      purchaseDate: tanggalHariIni(),
      quantity: '',
      totalCost: price,
      status: 'DITERIMA',
      accountId: defaultAcc?.id || '',
      employeeId: isSharingEmployee ? selfEmployeeId : (defaultEmp?.employeeId || defaultEmp?.id || ''),
      targetContent: '',
      completedContent: 0,
      unitContent: 'VT',
      scope: prod.scope || 'PRIBADI',
      autoCreateExpense: true,
      autoCreateTask: true,
      notes: `Pembelian sampel untuk ${prod.productName}`,
      sellerName: '',
      brandName: '',
      size: '',
      locationId: '',
      locationCode: '',
      locationName: '',
    });
    setSampleImageFile(null);
    setSampleImagePreview('');
    setSampleImageRemoved(false);
    setIsSampleModalOpen(true);
  };

  const handleOpenEditSample = (sample: AffiliateSample) => {
    setEditingSample(sample);
    setSampleFormData({
      productId: sample.productId || '',
      productName: sample.productName,
      productUrl: sample.productUrl || '',
      productImage: sample.productImage || '',
      samplePrice: sample.samplePrice || 0,
      purchaseDate: sample.purchaseDate || tanggalHariIni(),
      quantity: sample.quantity || 1,
      totalCost: sample.totalCost || 0,
      status: sample.status || 'DIPESAN',
      accountId: sample.accountId || '',
      employeeId: sample.employeeId || '',
      targetContent: sample.targetContent || 3,
      completedContent: sample.completedContent || 0,
      unitContent: sample.unitContent || 'VT',
      scope: sample.scope || 'PRIBADI',
      autoCreateExpense: false,
      autoCreateTask: false,
      notes: sample.notes || '',
      sellerName: sample.sellerName || '',
      brandName: sample.brandName || '',
      size: sample.size || '',
      locationId: sample.locationId || '',
      locationCode: sample.locationCode || '',
      locationName: sample.locationName || '',
    });
    setSampleImageFile(null);
    setSampleImagePreview(sample.sampleImage || '');
    setSampleImageRemoved(false);
    setIsSampleModalOpen(true);
  };

  // Select Master Product in Sample Form (Autofill)
  const handleSelectProductInForm = (selectedProdId: string) => {
    if (!selectedProdId) {
      setSampleFormData((prev) => ({
        ...prev,
        productId: '',
      }));
      return;
    }
    const found = products.find((p) => p.id === selectedProdId || p.productId === selectedProdId);
    if (found) {
      const price = Number(found.productPrice) || 0;
      const qty = sampleFormData.quantity || 1;
      setSampleFormData((prev) => ({
        ...prev,
        productId: found.id || found.productId || '',
        productName: found.productName,
        productUrl: found.productUrl || '',
        productImage: found.productImage || '',
        samplePrice: price,
        totalCost: price * qty,
        scope: found.scope || prev.scope,
      }));
    }
  };

  // Submit Master Product Form
  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productFormData.productName.trim()) {
      setActionError('Nama produk wajib diisi.');
      return;
    }
    setSubmitting(true);
    setActionError(null);
    try {
      const uid = userProfile?.uid || currentUser?.uid || 'system';
      const name = userProfile?.name || currentUser?.displayName || 'User';

      if (editingProduct?.id) {
        await updateProduct(editingProduct.id, editingProduct, { ...productFormData, productPrice: Number(productFormData.productPrice) || 0, commissionRate: Number(productFormData.commissionRate) || 0 }, null, uid, name);
        setSuccessToast(`Master produk "${productFormData.productName}" berhasil diperbarui.`);
      } else {
        await createProduct({ ...productFormData, productPrice: Number(productFormData.productPrice) || 0, commissionRate: Number(productFormData.commissionRate) || 0 }, null, uid, name);
        setSuccessToast(`Master produk "${productFormData.productName}" berhasil ditambahkan.`);
      }
      setIsProductModalOpen(false);
    } catch (err: any) {
      setActionError(err.message || 'Gagal menyimpan produk');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Sample Form
  const handleSubmitSample = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sampleFormData.productName.trim()) {
      setActionError('Nama produk/sampel wajib diisi.');
      return;
    }
    setSubmitting(true);
    setActionError(null);
    try {
      const uid = userProfile?.uid || currentUser?.uid || 'system';
      const name = userProfile?.name || currentUser?.displayName || 'User';

      // Find account name and employee name
      const selAcc = accounts.find((a) => a.id === sampleFormData.accountId);
      const selEmp = employees.find((e) => e.employeeId === sampleFormData.employeeId || e.id === sampleFormData.employeeId);

      // Sample photo: upload ONLY here (on Save click), ONLY if the user picked a
      // new file (camera or gallery) in this session. If editing and the photo
      // wasn't touched, we don't include `sampleImage` in the payload at all, so
      // updateDoc leaves the existing Storage URL untouched (no re-upload).
      let sampleImageUrl: string | undefined = undefined;
      if (sampleImageFile) {
        const tempId = editingSample?.id || `temp_${Date.now()}`;
        sampleImageUrl = await uploadSampleImage(sampleImageFile, tempId);
      } else if (sampleImageRemoved) {
        sampleImageUrl = '';
      }

      const payload: any = {
        ...sampleFormData,
        accountName: selAcc?.accountName || '',
        employeeName: selEmp?.name || '',
      };
      if (sampleImageUrl !== undefined) {
        payload.sampleImage = sampleImageUrl;
      }

      if (editingSample?.id) {
        await updateSample(editingSample.id, editingSample, payload, uid, name);
        setSuccessToast('PRODUK SAMPEL BERHASIL DISIMPAN');
      } else {
        await createSample(
          payload,
          sampleFormData.autoCreateExpense !== false,
          sampleFormData.autoCreateTask,
          uid,
          name
        );
        setSuccessToast('PRODUK SAMPEL BERHASIL DISIMPAN');
      }
      setIsSampleModalOpen(false);
    } catch (err: any) {
      setActionError(err.message || 'PRODUK SAMPEL GAGAL DISIMPAN');
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Progress Content Update
  const handleUpdateProgressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!progressModalSample?.id) return;
    try {
      const uid = userProfile?.uid || 'system';
      const name = userProfile?.name || 'User';
      await updateSampleContentProgress(progressModalSample.id, progressModalSample, newCompletedCount, uid, name);
      setProgressModalSample(null);
      setSuccessToast(`Progress output berhasil diperbarui.`);
    } catch (err: any) {
      alert('Gagal update progress: ' + err.message);
    }
  };

  // Delete Sample
  const handleDeleteSample = async (sample: AffiliateSample) => {
    if (window.confirm(`Hapus data sampel "${sample.productName}"?`)) {
      const uid = userProfile?.uid || 'system';
      const name = userProfile?.name || 'User';
      await deleteSample(sample.id!, sample, uid, name);
      setSuccessToast(`Sampel "${sample.productName}" telah dihapus.`);
    }
  };

  // Delete Product
  const handleDeleteProduct = async (prod: Product) => {
    if (window.confirm(`Hapus master produk "${prod.productName}"?`)) {
      const uid = userProfile?.uid || 'system';
      const name = userProfile?.name || 'User';
      await deleteProduct(prod.id!, prod, uid, name);
      setSuccessToast(`Master produk "${prod.productName}" telah dihapus.`);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Feedback */}
      {successToast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white shadow-xl animate-bounce">
          <CheckCircle2 className="h-4 w-4" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200 pb-3">
        <nav className="flex items-center space-x-1.5 text-xs text-zinc-500 font-medium">
          <button
            onClick={onBackToPortal}
            className="flex items-center gap-1 hover:text-emerald-600 font-bold transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
            <span>KANTOR PT.KDRT</span>
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
          <span className="font-bold text-zinc-900">DATABASE SAMPEL</span>
        </nav>

        {onBackToPortal && (
          <button
            onClick={onBackToPortal}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 shadow-2xs hover:bg-zinc-50 transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
            <span>Kembali ke Portal</span>
          </button>
        )}
      </div>

      {/* Header & Big Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-zinc-900 via-slate-900 to-zinc-900 rounded-3xl p-6 text-white shadow-xl border border-zinc-800">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2.5 py-0.5 rounded-lg">
              Pusat Produk & Sampel Afiliasi
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
            <Package className="h-8 w-8 text-emerald-400" />
            DATABASE SAMPEL
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-xl">
            Pusat terpadu seluruh katalog Master Produk affiliate dan pencatatan pembelian, kedatangan, serta progres VT sampel fisik.
          </p>
        </div>

        {/* Big Action Buttons */}
        {!isInvestor && (role !== 'EMPLOYEE' || employeeProfile?.permissions?.canCreateSampleProduct || isEmployee) && (
          <div className="flex items-center gap-3 flex-wrap">
            <button
              id="btn-import-spreadsheet"
              type="button"
              onClick={() => setIsImportSpreadsheetModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-zinc-800/90 hover:bg-zinc-700 active:scale-95 text-emerald-400 hover:text-emerald-300 px-4 py-4 text-xs sm:text-sm font-black shadow-lg border border-emerald-500/30 transition-all cursor-pointer"
            >
              <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
              <span>📥 IMPORT SPREADSHEET</span>
            </button>

            <button
              id="btn-tambah-produk-sampel"
              type="button"
              onClick={() => setIsAddProductSampleModalOpen(true)}
              className="inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white px-5 py-4 text-xs sm:text-sm font-black shadow-lg shadow-emerald-600/25 transition-all cursor-pointer border border-emerald-400/30"
            >
              <Plus className="h-5 w-5 stroke-[3]" />
              <span>+ TAMBAH PRODUK / SAMPEL</span>
            </button>
          </div>
        )}
      </div>

      {/* Dashboard Period Selector & Financial Sync Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50 border border-zinc-200 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-xs font-black text-zinc-900 uppercase tracking-wide">
              PERIODE REKAPITULASI SAMPEL
            </h3>
            <p className="text-[11px] text-zinc-500 font-medium">
              Metrik dihitung berdasarkan tanggal pembelian sampel pada bulan yang dipilih.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-xl px-3 py-1.5 shadow-2xs">
            <span className="text-[11px] font-bold text-zinc-500">Bulan:</span>
            <input
              type="month"
              value={selectedPeriod === 'SEMUA' ? '' : selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value || 'SEMUA')}
              className="bg-transparent text-xs font-black text-zinc-900 focus:outline-hidden cursor-pointer"
            />
            {selectedPeriod !== 'SEMUA' && (
              <button
                type="button"
                onClick={() => setSelectedPeriod('SEMUA')}
                className="text-[10px] font-bold text-zinc-400 hover:text-zinc-700 underline ml-1"
              >
                Semua Periode
              </button>
            )}
          </div>

          {(isOwner || isManager) && (
            <button
              type="button"
              onClick={handleSyncToFinancialLedger}
              disabled={isSyncingLedger}
              title="Sinkronkan seluruh data pembelian sampel ke Buku Kas & Bank sebagai Uang Keluar"
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-3 py-2 text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncingLedger ? 'animate-spin' : ''}`} />
              <span>{isSyncingLedger ? 'Menyinkronkan...' : 'Sinkron ke Buku Kas'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 KPI Dashboard Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metrik 1: TOTAL BELANJA SAMPEL */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800">
              TOTAL BELANJA SAMPEL
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-200/80 text-emerald-900">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-950 mt-2">
            {formatRupiah(metrics.totalBelanjaSampel)}
          </p>
          <span className="text-[11px] text-emerald-700 font-medium">
            {selectedPeriod === 'SEMUA' ? 'Total seluruh periode' : `Periode ${selectedPeriod}`}
          </span>
        </div>

        {/* Metrik 2: TOTAL SAMPEL */}
        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-blue-800">
              TOTAL SAMPEL
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-200/80 text-blue-900">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-blue-950 mt-2">{metrics.totalSampel}</p>
          <span className="text-[11px] text-blue-700 font-medium">Diinput pada periode ini</span>
        </div>

        {/* Metrik 3: BELUM DIBUAT KONTEN */}
        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-rose-800">
              BELUM DIBUAT KONTEN
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-200/80 text-rose-900">
              <PlayCircle className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-rose-950 mt-2">{metrics.belumKontenCount}</p>
          <span className="text-[11px] text-rose-700 font-medium">Target VT belum terpenuhi</span>
        </div>

        {/* Metrik 4: TOTAL SELESAI / TARGET TERPENUHI */}
        <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-teal-800">
              TARGET TERPENUHI
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-200/80 text-teal-900">
              <CheckCheck className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-teal-950 mt-2">{metrics.targetTerpenuhiCount}</p>
          <span className="text-[11px] text-teal-700 font-medium">Target VT selesai tuntas</span>
        </div>
      </div>

      {/* Tab Navigation: Sampel vs Master Produk */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('SAMPEL')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all ${
              activeTab === 'SAMPEL'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            <Package className="h-4 w-4 text-emerald-400" />
            <span>PEMANTAUAN SAMPEL ({filteredSamples.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('MASTER_PRODUK')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all ${
              activeTab === 'MASTER_PRODUK'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            <ShoppingBag className="h-4 w-4 text-indigo-400" />
            <span>KATALOG MASTER PRODUK ({filteredProducts.length})</span>
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {!isInvestor && (
            <div className="flex items-center bg-zinc-100 rounded-xl p-1 text-xs">
              <button
                onClick={() => setScopeFilter('SEMUA')}
                className={`rounded-lg px-2.5 py-1 font-bold ${
                  scopeFilter === 'SEMUA' ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-500'
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setScopeFilter('SHARING')}
                className={`rounded-lg px-2.5 py-1 font-bold ${
                  scopeFilter === 'SHARING' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-zinc-500'
                }`}
              >
                Sharing
              </button>
              <button
                onClick={() => setScopeFilter('PRIBADI')}
                className={`rounded-lg px-2.5 py-1 font-bold ${
                  scopeFilter === 'PRIBADI' ? 'bg-blue-600 text-white shadow-2xs' : 'text-zinc-500'
                }`}
              >
                Pribadi
              </button>
            </div>
          )}

          {activeTab === 'SAMPEL' && locations.length > 0 && (
            <div className="flex items-center gap-1.5 bg-white border border-zinc-200 rounded-xl px-2.5 py-1 text-xs shadow-2xs">
              <MapPin className="h-3.5 w-3.5 text-indigo-600" />
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-zinc-700 focus:outline-hidden cursor-pointer"
              >
                <option value="SEMUA">Semua Lokasi</option>
                <option value="BELUM_DITATA">⚠️ Belum Ditata</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.kodeLokasi}>
                    📍 {loc.kodeLokasi} ({loc.namaLokasi})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Cari produk / PIC / akun..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 py-1.5 text-xs text-zinc-800 placeholder-zinc-400 focus:outline-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'SAMPEL' ? (
        <div className="space-y-4">
          {/* Mobile Tab Switcher: Hanya BELUM SELESAI & SELESAI di mobile */}
          <div className="flex lg:hidden items-center p-1 bg-zinc-100 rounded-2xl border border-zinc-200 gap-1.5">
            <button
              type="button"
              onClick={() => setMobileSampleTab('BELUM_SELESAI')}
              className={`flex-1 py-2.5 px-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                mobileSampleTab === 'BELUM_SELESAI'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900 bg-white/60'
              }`}
            >
              <span>🟢 BELUM SELESAI</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${mobileSampleTab === 'BELUM_SELESAI' ? 'bg-amber-600 text-white' : 'bg-zinc-200 text-zinc-700'}`}>
                {newSamples.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMobileSampleTab('SELESAI')}
              className={`flex-1 py-2.5 px-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                mobileSampleTab === 'SELESAI'
                  ? 'bg-zinc-800 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900 bg-white/60'
              }`}
            >
              <span>✅ TARGET TERPENUHI</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${mobileSampleTab === 'SELESAI' ? 'bg-zinc-700 text-white' : 'bg-zinc-200 text-zinc-700'}`}>
                {oldSamples.length}
              </span>
            </button>
          </div>

          {/* ================= 2-COLUMN VIEW: BELUM SELESAI VS SELESAI ================= */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* KOLOM 1: BELUM DIBUAT KONTEN / PROSES BERJALAN */}
            <div className={`space-y-4 ${mobileSampleTab === 'SELESAI' ? 'hidden lg:block' : 'block'}`}>
              <div className="flex items-center justify-between bg-amber-50/70 border border-amber-200 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-amber-500 animate-pulse" />
                  <h2 className="font-black text-sm text-zinc-900 tracking-tight">
                    BELUM DIBUAT KONTEN (PROSES BERJALAN)
                  </h2>
                </div>
                <span className="rounded-full bg-amber-200/80 px-2.5 py-0.5 text-xs font-black text-amber-900">
                  {newSamples.length} Item
                </span>
              </div>

            {newSamples.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 text-center text-xs text-zinc-400">
                Semua sampel sudah memenuhi target konten VT.
              </div>
            ) : (
              <div className="space-y-3">
                {newSamples.map((sample) => {
                  const target = Number(sample.targetContent) || 1;
                  const current = Number(sample.completedContent) || 0;
                  const percent = Math.min(100, Math.round((current / target) * 100));

                  return (
                    <div
                      key={sample.id}
                      className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs hover:border-emerald-300 transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {sample.productImage ? (
                            <img
                              src={sample.productImage}
                              alt={sample.productName}
                              className="h-12 w-12 rounded-xl object-cover border border-zinc-200 shrink-0"
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400 shrink-0 font-bold text-xs">
                              <Package className="h-6 w-6" />
                            </div>
                          )}

                          <div className="min-w-0">
                            <h3 className="font-bold text-sm text-zinc-900 truncate">
                              {sample.productName}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-zinc-500">
                              <span>Tgl: {formatTanggal(sample.purchaseDate)}</span>
                              <span>•</span>
                              <span>{sample.accountName || 'Akun -'}</span>
                              <span>•</span>
                              <span className="font-semibold text-zinc-700">PIC: {sample.employeeName || '-'}</span>
                              {sample.brandName && (
                                <>
                                  <span>•</span>
                                  <span className="font-medium text-zinc-600">Brand: {sample.brandName}</span>
                                </>
                              )}
                              <span>•</span>
                              {sample.locationCode ? (
                                <span className="inline-flex items-center gap-0.5 rounded-md bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                                  <MapPin className="h-3 w-3" />
                                  {sample.locationCode}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                                  Belum Ditata
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[9px] font-extrabold ${
                              sample.scope === 'SHARING'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {sample.scope}
                          </span>
                        </div>
                      </div>

                      {/* Progress Output VT Bar */}
                      <div className="bg-zinc-50 rounded-xl p-2.5 border border-zinc-100 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-zinc-600">
                            Progress Konten ({sample.unitContent || 'VT'}):
                          </span>
                          <span className="font-black text-zinc-900">
                            {current} / {target} {sample.unitContent || 'VT'} ({percent}%)
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-zinc-200 overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              percent >= 100 ? 'bg-emerald-500' : 'bg-orange-500'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-between pt-1 border-t border-zinc-100 text-xs">
                        {!isInvestor ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setProgressModalSample(sample);
                                setNewCompletedCount(sample.completedContent || 0);
                              }}
                              className="rounded-lg bg-orange-50 border border-orange-200 px-2.5 py-1 text-[11px] font-bold text-orange-700 hover:bg-orange-100 transition-colors"
                            >
                              + Update VT
                            </button>
                          </div>
                        ) : (
                          <div className="text-[11px] font-medium text-zinc-400">
                            Mode Investor (Hanya Lihat)
                          </div>
                        )}

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setDetailSample(sample)}
                            className="rounded-lg px-2 py-1 text-[11px] font-semibold text-zinc-500 hover:bg-zinc-100"
                          >
                            Detail
                          </button>
                          {!isInvestor && (
                            <>
                              <button
                                onClick={() => handleOpenEditSample(sample)}
                                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              {isOwner && (
                                <button
                                  onClick={() => handleDeleteSample(sample)}
                                  className="rounded-lg p-1 text-rose-400 hover:bg-rose-50 hover:text-rose-600"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* KOLOM 2: TOTAL SELESAI / TARGET TERPENUHI */}
          <div className={`space-y-4 ${mobileSampleTab === 'BELUM_SELESAI' ? 'hidden lg:block' : 'block'}`}>
            <div className="flex items-center justify-between bg-zinc-100 border border-zinc-200 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <h2 className="font-black text-sm text-zinc-900 tracking-tight">
                  TOTAL SELESAI (TARGET TERPENUHI)
                </h2>
              </div>
              <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-black text-zinc-700">
                {oldSamples.length} Item
              </span>
            </div>

            {oldSamples.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 text-center text-xs text-zinc-400">
                Belum ada sampel yang memenuhi target konten.
              </div>
            ) : (
              <div className="space-y-3">
                {oldSamples.map((sample) => (
                  <div
                    key={sample.id}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4 shadow-2xs space-y-2 opacity-90 hover:opacity-100 transition-opacity"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {sample.productImage ? (
                          <img
                            src={sample.productImage}
                            alt={sample.productName}
                            className="h-10 w-10 rounded-xl object-cover border border-zinc-200 shrink-0 grayscale"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-200 text-zinc-500 shrink-0 font-bold text-xs">
                            <Package className="h-5 w-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm text-zinc-800 truncate">
                            {sample.productName}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                            <span>{formatTanggal(sample.purchaseDate)}</span>
                            <span>•</span>
                            <span>{sample.accountName || 'Akun -'}</span>
                            <span>•</span>
                            <span>PIC: {sample.employeeName || '-'}</span>
                            {sample.brandName && (
                              <>
                                <span>•</span>
                                <span className="font-medium text-zinc-600">Brand: {sample.brandName}</span>
                              </>
                            )}
                            <span>•</span>
                            {sample.locationCode ? (
                              <span className="inline-flex items-center gap-0.5 rounded-md bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                                <MapPin className="h-3 w-3" />
                                {sample.locationCode}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 rounded-md bg-zinc-200 px-1.5 py-0.5 text-[9px] font-bold text-zinc-600">
                                Belum Ditata
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-black flex items-center gap-1">
                          <Check className="h-3 w-3" /> TARGET TERCAPAI
                        </span>
                        <span className="text-[10px] font-bold text-zinc-600">
                          {sample.completedContent}/{sample.targetContent} {sample.unitContent || 'VT'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-200 text-xs">
                      <span className="text-[11px] text-zinc-400">
                        {!isEmployee ? `Biaya: ${formatRupiah(sample.totalPaid || sample.totalCost || 0)}` : `Tanggal: ${formatTanggal(sample.purchaseDate)}`}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setDetailSample(sample)}
                          className="rounded-lg px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-200"
                        >
                          Detail
                        </button>
                        {!isInvestor && (
                          <button
                            onClick={() => handleOpenEditSample(sample)}
                            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      ) : (
        /* ================= KATALOG MASTER PRODUK (products) ================= */
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-indigo-50/70 border border-indigo-200 rounded-2xl px-4 py-3">
            <div>
              <h2 className="font-black text-sm text-zinc-900">
                KATALOG MASTER PRODUK AFFILIATE
              </h2>
              <p className="text-xs text-zinc-500">
                Master barang afiliasi. Klik <strong>[ + BELI SAMPEL ]</strong> pada produk untuk langsung mencatat kedatangan unit fisik.
              </p>
            </div>
            <span className="rounded-full bg-indigo-200/80 px-2.5 py-0.5 text-xs font-black text-indigo-900">
              {filteredProducts.length} Produk
            </span>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-12 text-center text-zinc-400 text-xs">
              Belum ada master produk terdaftar. Klik <strong>[ + TAMBAH PRODUK ]</strong> di atas untuk menambahkan.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((prod) => (
                <div
                  key={prod.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs flex flex-col justify-between hover:border-emerald-300 transition-all"
                >
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      {prod.productImage ? (
                        <img
                          src={prod.productImage}
                          alt={prod.productName}
                          className="h-16 w-16 rounded-xl object-cover border border-zinc-200 shrink-0"
                        />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shrink-0 font-bold">
                          <ShoppingBag className="h-8 w-8" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase">
                            {prod.category || 'Afiliasi'}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-black ${
                              prod.scope === 'SHARING'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {prod.scope}
                          </span>
                        </div>
                        <h3 className="font-bold text-sm text-zinc-900 truncate mt-0.5">
                          {prod.productName}
                        </h3>
                        {!isEmployee && (
                          <p className="font-black text-sm text-emerald-700 mt-1">
                            {formatRupiah(prod.productPrice || 0)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-zinc-50 rounded-xl p-2 text-[11px] border border-zinc-100">
                      <div>
                        <span className="text-zinc-400 block">Kategori:</span>
                        <strong className="text-zinc-800 font-bold">{prod.category || '-'}</strong>
                      </div>
                      {!isEmployee && (
                        <div>
                          <span className="text-zinc-400 block">Komisi:</span>
                          <strong className="text-indigo-700 font-bold">
                            {prod.commissionRate || 10}% ({formatRupiah(((prod.productPrice || 0) * (prod.commissionRate || 10)) / 100)})
                          </strong>
                        </div>
                      )}
                      <div>
                        <span className="text-zinc-400 block">Status:</span>
                        <strong className="text-zinc-800 font-bold">{prod.status || 'AKTIF'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Footer & Action: [ + BELI SAMPEL ] */}
                  <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between gap-2">
                    {!isInvestor ? (
                      <button
                        onClick={() => handleOpenBuySample(prod)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white py-2 px-3 text-xs font-black shadow-2xs transition-colors cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>+ BELI SAMPEL</span>
                      </button>
                    ) : (
                      <span className="flex-1 text-[11px] font-semibold text-zinc-400">
                        Katalog Produk Sharing
                      </span>
                    )}

                    <button
                      onClick={() => setDetailProduct(prod)}
                      className="rounded-xl border border-zinc-200 bg-zinc-50 p-2 text-zinc-600 hover:bg-zinc-100"
                      title="Lihat Detail Produk"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>

                    {!isInvestor && (
                      <>
                        <button
                          onClick={() => handleOpenEditProduct(prod)}
                          className="rounded-xl border border-zinc-200 bg-zinc-50 p-2 text-zinc-600 hover:bg-zinc-100"
                          title="Edit Master Produk"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        {isOwner && (
                          <button
                            onClick={() => handleDeleteProduct(prod)}
                            className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-rose-600 hover:bg-rose-100"
                            title="Hapus Master Produk"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= MODAL: TAMBAH / EDIT MASTER PRODUK ================= */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 text-zinc-900 shadow-2xl border border-zinc-200 my-8">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
              <h3 className="text-base font-black text-zinc-900 flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-indigo-600" />
                {editingProduct ? 'Edit Master Produk' : 'Tambah Master Produk Afiliasi'}
              </h3>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {actionError && (
              <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitProduct} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-zinc-700 mb-1">Nama Produk *</label>
                <input
                  type="text"
                  required
                  value={productFormData.productName}
                  onChange={(e) => setProductFormData({ ...productFormData, productName: e.target.value })}
                  placeholder="contoh: Vacuum Cleaner Wireless Portable"
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm focus:outline-emerald-500 font-medium"
                />
              </div>

              {!isEmployee && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-zinc-700 mb-1">Harga Produk (Rp)</label>
                    <CurrencyInput
                      value={productFormData.productPrice}
                      onChange={(val) => setProductFormData({ ...productFormData, productPrice: val })}
                      className="w-full rounded-xl border border-zinc-300 p-2.5 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-zinc-700 mb-1">Komisi Afiliasi (%)</label>
                    <CurrencyInput
                      prefix=""
                      value={productFormData.commissionRate}
                      onChange={(val) => setProductFormData({ ...productFormData, commissionRate: val })}
                      className="w-full rounded-xl border border-zinc-300 p-2.5 font-bold text-indigo-700"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-zinc-700 mb-1">Foto Produk (URL Gambar)</label>
                <input
                  type="text"
                  value={productFormData.productImage}
                  onChange={(e) => setProductFormData({ ...productFormData, productImage: e.target.value })}
                  placeholder="https://... / link foto produk"
                  className="w-full rounded-xl border border-zinc-300 p-2.5"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">Link Produk / Toko (TikTok/Shopee)</label>
                <input
                  type="text"
                  value={productFormData.productUrl}
                  onChange={(e) => setProductFormData({ ...productFormData, productUrl: e.target.value })}
                  placeholder="https://vt.tiktok.com/... atau link etalase"
                  className="w-full rounded-xl border border-zinc-300 p-2.5"
                />
              </div>

              <div className={`grid ${isEmployee ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Kategori</label>
                  <select
                    value={productFormData.category}
                    onChange={(e) => setProductFormData({ ...productFormData, category: e.target.value })}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 font-medium"
                  >
                    {(isSharingEmployee ? EMPLOYEE_KATEGORI_OPTIONS : MASTER_KATEGORI_OPTIONS).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {!isEmployee && (
                  <div>
                    <label className="block font-bold text-zinc-700 mb-1">Scope Kepemilikan</label>
                    <select
                      disabled={isInvestor}
                      value={productFormData.scope}
                      onChange={(e) => setProductFormData({ ...productFormData, scope: e.target.value as ScopeType })}
                      className="w-full rounded-xl border border-zinc-300 p-2.5 font-bold"
                    >
                      <option value="SHARING">SHARING (Investor & Kantor)</option>
                      <option value="PRIBADI">PRIBADI (Owner PT.KDRT)</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">Catatan Produk</label>
                <textarea
                  rows={2}
                  value={productFormData.notes}
                  onChange={(e) => setProductFormData({ ...productFormData, notes: e.target.value })}
                  placeholder="Catatan keunggulan produk / script hook..."
                  className="w-full rounded-xl border border-zinc-300 p-2.5"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="rounded-xl border border-zinc-200 px-4 py-2.5 font-bold text-zinc-600 hover:bg-zinc-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 font-black shadow-md cursor-pointer"
                >
                  {submitting ? 'Menyimpan...' : 'SIMPAN PRODUK'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: TAMBAH / EDIT SAMPEL PRODUK ================= */}
      {isSampleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 text-zinc-900 shadow-2xl border border-zinc-200 my-8">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
              <h3 className="text-base font-black text-zinc-900 flex items-center gap-2">
                <Package className="h-5 w-5 text-emerald-600" />
                {editingSample ? 'Edit Data Sampel' : 'Catat Pembelian Sampel Fisik'}
              </h3>
              <button
                onClick={() => setIsSampleModalOpen(false)}
                className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {actionError && (
              <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitSample} className="space-y-3.5 text-xs">
              {/* Dropdown Pilih Master Produk */}
              <div>
                <label className="block font-bold text-zinc-700 mb-1">
                  Pilih Master Produk (Autofill data)
                </label>
                <select
                  value={sampleFormData.productId}
                  onChange={(e) => handleSelectProductInForm(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 p-2.5 font-medium"
                >
                  <option value="">-- Buat / Ketik Manual atau Pilih Master --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {isEmployee ? p.productName : `${p.productName} (${formatRupiah(p.productPrice || 0)}) - ${p.scope}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">Nama Produk Sampel *</label>
                <input
                  type="text"
                  required
                  value={sampleFormData.productName}
                  onChange={(e) => setSampleFormData({ ...sampleFormData, productName: e.target.value })}
                  placeholder="Nama produk sampel yang dibeli"
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">Nama Brand / Toko *</label>
                <input
                  type="text"
                  required
                  value={sampleFormData.brandName}
                  onChange={(e) => setSampleFormData({ ...sampleFormData, brandName: e.target.value })}
                  placeholder="Nama brand atau toko penjual sampel"
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">Size / Ukuran</label>
                <input
                  type="text"
                  data-testid="sample-size-input"
                  value={sampleFormData.size}
                  onChange={(e) => setSampleFormData({ ...sampleFormData, size: e.target.value })}
                  placeholder="Contoh: S, M, L, XL, XXL, 3XL, All Size, 42 (boleh kosong)"
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm font-bold"
                />
                <p className="text-[10px] text-zinc-500 mt-1 font-medium">Opsional. Tidak semua produk mempunyai ukuran.</p>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">Foto Sampel</label>

                {/* Hidden inputs: camera (rear) & gallery. accept+capture only affects mobile;
                    desktop browsers fall back to the normal file picker automatically. */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setSampleImageFile(file);
                      setSampleImagePreview(URL.createObjectURL(file));
                      setSampleImageRemoved(false);
                    }
                    e.target.value = '';
                  }}
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setSampleImageFile(file);
                      setSampleImagePreview(URL.createObjectURL(file));
                      setSampleImageRemoved(false);
                    }
                    e.target.value = '';
                  }}
                />

                {sampleImagePreview ? (
                  <div className="space-y-2">
                    <img
                      src={sampleImagePreview}
                      alt="Preview foto sampel"
                      className="w-full max-h-48 object-cover rounded-xl border border-zinc-300"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="flex-1 rounded-xl border border-zinc-300 p-2 text-xs font-bold text-zinc-700"
                      >
                        📷 Ambil Ulang
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSampleImageFile(null);
                          setSampleImagePreview('');
                          setSampleImageRemoved(true);
                        }}
                        className="flex-1 rounded-xl border border-red-300 bg-red-50 p-2 text-xs font-bold text-red-600"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="rounded-xl border border-zinc-300 p-2.5 text-xs font-bold text-zinc-700"
                    >
                      📷 AMBIL FOTO
                    </button>
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="rounded-xl border border-zinc-300 p-2.5 text-xs font-bold text-zinc-700"
                    >
                      🖼️ PILIH DARI GALERI
                    </button>
                  </div>
                )}
              </div>

              <div className={`grid ${isEmployee ? 'grid-cols-1' : 'grid-cols-3'} gap-2.5`}>
                {!isEmployee && (
                  <div>
                    <label className="block font-bold text-zinc-700 mb-1">Harga Sampel</label>
                    <CurrencyInput
                      value={sampleFormData.samplePrice}
                      onChange={(val) => {
                        const price = Number(val) || 0;
                        setSampleFormData({
                          ...sampleFormData,
                          samplePrice: val,
                          totalCost: price * (Number(sampleFormData.quantity) || 1),
                        });
                      }}
                      className="w-full rounded-xl border border-zinc-300 p-2 font-bold"
                    />
                  </div>
                )}
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Qty</label>
                  <CurrencyInput
                    prefix=""
                    value={sampleFormData.quantity}
                    onChange={(val) => {
                      const qty = Math.max(1, Number(val) || 1);
                      setSampleFormData({
                        ...sampleFormData,
                        quantity: val,
                        totalCost: (Number(sampleFormData.samplePrice) || 0) * qty,
                      });
                    }}
                    className="w-full rounded-xl border border-zinc-300 p-2 font-bold text-center"
                  />
                </div>
                {!isEmployee && (
                  <div>
                    <label className="block font-bold text-zinc-700 mb-1">Total Biaya (Rp)</label>
                    <CurrencyInput
                      value={sampleFormData.totalCost}
                      onChange={(val) => setSampleFormData({ ...sampleFormData, totalCost: val })}
                      className="w-full rounded-xl border border-zinc-300 p-2 font-black text-rose-700"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Tanggal Pembelian</label>
                  <input
                    type="date"
                    required
                    value={sampleFormData.purchaseDate}
                    onChange={(e) => setSampleFormData({ ...sampleFormData, purchaseDate: e.target.value })}
                    className="w-full rounded-xl border border-zinc-300 p-2 font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Target VT / Output Konten</label>
                  <CurrencyInput
                    prefix=""
                    value={sampleFormData.targetContent}
                    onChange={(val) => setSampleFormData({ ...sampleFormData, targetContent: val })}
                    className="w-full rounded-xl border border-zinc-300 p-2 font-bold text-orange-700"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">Akun TikTok / Medsos</label>
                <select
                  value={sampleFormData.accountId}
                  onChange={(e) => {
                    const acc = accounts.find((a) => a.id === e.target.value);
                    setSampleFormData({
                      ...sampleFormData,
                      accountId: e.target.value,
                      scope: acc?.scope || sampleFormData.scope,
                    });
                  }}
                  className="w-full rounded-xl border border-zinc-300 p-2 font-medium"
                >
                  <option value="">-- Pilih Akun --</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.accountName} ({a.scope})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">📍 Lokasi Rak / Hanger</label>
                <select
                  value={sampleFormData.locationId || ''}
                  onChange={(e) => {
                    const locId = e.target.value;
                    const selected = locations.find((l) => l.id === locId);
                    setSampleFormData({
                      ...sampleFormData,
                      locationId: locId,
                      locationCode: selected?.kodeLokasi || '',
                      locationName: selected?.namaLokasi || '',
                    });
                  }}
                  className="w-full rounded-xl border border-zinc-300 p-2 font-semibold text-zinc-800"
                >
                  <option value="">-- Pilih Lokasi Fisik (Opsional) --</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      📍 {loc.kodeLokasi} — {loc.namaLokasi} ({loc.tipeLokasi} / {loc.kategori})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Atur posisi rak / gantungan fisik sampel di studio live atau kantor.
                </p>
              </div>

              {!isEmployee && (
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Scope</label>
                  <select
                    disabled={isInvestor}
                    value={sampleFormData.scope}
                    onChange={(e) => setSampleFormData({ ...sampleFormData, scope: e.target.value as ScopeType })}
                    className="w-full rounded-xl border border-zinc-300 p-2 font-bold"
                  >
                    <option value="SHARING">SHARING</option>
                    <option value="PRIBADI">PRIBADI</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block font-bold text-zinc-700 mb-1">Catatan / Link Toko</label>
                <input
                  type="text"
                  value={sampleFormData.notes}
                  onChange={(e) => setSampleFormData({ ...sampleFormData, notes: e.target.value })}
                  placeholder="Keterangan pembelian sampel / nomor resi..."
                  className="w-full rounded-xl border border-zinc-300 p-2"
                />
              </div>

              {!editingSample && !isEmployee && (
                <div className="rounded-xl bg-zinc-50 p-3 border border-zinc-200 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-zinc-800">
                    <input
                      type="checkbox"
                      checked={sampleFormData.autoCreateExpense}
                      onChange={(e) => setSampleFormData({ ...sampleFormData, autoCreateExpense: e.target.checked })}
                      className="rounded text-emerald-600"
                    />
                    <span>Catat otomatis sebagai Pengeluaran Pembelian Sampel</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-zinc-800">
                    <input
                      type="checkbox"
                      checked={sampleFormData.autoCreateTask}
                      onChange={(e) => setSampleFormData({ ...sampleFormData, autoCreateTask: e.target.checked })}
                      className="rounded text-orange-600"
                    />
                    <span>Buat otomatis To-Do di "Kerjaan Hari Ini" PIC</span>
                  </label>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsSampleModalOpen(false)}
                  className="rounded-xl border border-zinc-200 px-4 py-2.5 font-bold text-zinc-600 hover:bg-zinc-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 font-black shadow-md cursor-pointer"
                >
                  {submitting ? 'MENYIMPAN SAMPEL...' : 'SIMPAN SAMPEL'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: QUICK UPDATE VT ================= */}
      {progressModalSample && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-zinc-900 shadow-2xl border border-zinc-200">
            <h3 className="text-base font-black text-zinc-900 mb-2 flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-orange-600" />
              Update Progress Output VT
            </h3>
            <p className="text-xs text-zinc-500 mb-4">{progressModalSample.productName}</p>

            <form onSubmit={handleUpdateProgressSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-zinc-700 mb-1">Jumlah Konten VT Selesai</label>
                <input
                  type="number"
                  min={0}
                  max={progressModalSample.targetContent || 99}
                  value={newCompletedCount}
                  onChange={(e) => setNewCompletedCount(Number(e.target.value))}
                  className="w-full rounded-xl border border-zinc-300 p-3 text-lg font-black text-center text-orange-600"
                />
                <span className="block text-[11px] text-zinc-400 mt-1 text-center">
                  Target total: {progressModalSample.targetContent || 1} {progressModalSample.unitContent || 'VT'}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setProgressModalSample(null)}
                  className="rounded-xl border border-zinc-200 px-4 py-2 font-bold text-zinc-600"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-orange-600 hover:bg-orange-500 text-white px-5 py-2 font-black"
                >
                  Simpan Progress
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: DETAIL SAMPEL ================= */}
      {detailSample && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-zinc-900 shadow-2xl border border-zinc-200 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-base font-black text-zinc-900">Detail Sampel Fisik</h3>
              <button onClick={() => setDetailSample(null)} className="text-zinc-400">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {detailSample.sampleImage && (
                <img
                  src={detailSample.sampleImage}
                  alt="Foto sampel"
                  className="w-full max-h-48 object-cover rounded-xl border border-zinc-200 mb-1"
                />
              )}
              <div className="flex justify-between border-b border-zinc-100 pb-2">
                <span className="text-zinc-500">Nama Produk:</span>
                <strong className="text-zinc-900 font-bold">{detailSample.productName}</strong>
              </div>
              <div className="flex justify-between border-b border-zinc-100 pb-2">
                <span className="text-zinc-500">Brand / Toko:</span>
                <span className="font-semibold text-zinc-800">{detailSample.brandName || detailSample.sellerName || '-'}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-100 pb-2" data-testid="sample-detail-size">
                <span className="text-zinc-500">Size / Ukuran:</span>
                <span className="font-semibold text-zinc-800">{detailSample.size || '-'}</span>
              </div>
              {detailSample.color && (
                <div className="flex justify-between border-b border-zinc-100 pb-2">
                  <span className="text-zinc-500">Warna / Varian:</span>
                  <span className="font-semibold text-zinc-800">{detailSample.color}</span>
                </div>
              )}
              {detailSample.orderNumber && (
                <div className="flex justify-between border-b border-zinc-100 pb-2">
                  <span className="text-zinc-500">No. Pesanan:</span>
                  <span className="font-mono font-bold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded-md">
                    {detailSample.orderNumber}
                  </span>
                </div>
              )}
              {detailSample.paymentMethod && (
                <div className="flex justify-between border-b border-zinc-100 pb-2">
                  <span className="text-zinc-500">Metode Pembayaran:</span>
                  <span className="font-semibold text-zinc-800">
                    {detailSample.paymentMethod} {detailSample.paymentMethodRaw && detailSample.paymentMethodRaw !== detailSample.paymentMethod ? `(${detailSample.paymentMethodRaw})` : ''}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-b border-zinc-100 pb-2">
                <span className="text-zinc-500">Status:</span>
                <strong className="text-emerald-700 font-bold">{detailSample.status}</strong>
              </div>
              <div className="flex justify-between border-b border-zinc-100 pb-2">
                <span className="text-zinc-500">Tanggal Pembelian:</span>
                <span className="font-semibold text-zinc-800">{formatTanggal(detailSample.purchaseDate)}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-100 pb-2">
                <span className="text-zinc-500">Akun:</span>
                <span className="font-semibold text-zinc-800">{detailSample.accountName || '-'}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-100 pb-2">
                <span className="text-zinc-500">PIC:</span>
                <span className="font-semibold text-zinc-800">{detailSample.employeeName || '-'}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-100 pb-2">
                <span className="text-zinc-500">Lokasi Fisik:</span>
                {detailSample.locationCode ? (
                  <span className="inline-flex items-center gap-1 font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg">
                    <MapPin className="h-3 w-3" />
                    {detailSample.locationCode} {detailSample.locationName ? `— ${detailSample.locationName}` : ''}
                  </span>
                ) : (
                  <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                    Belum Ditata
                  </span>
                )}
              </div>
              {!isEmployee && (
                <div className="flex justify-between border-b border-zinc-100 pb-2">
                  <span className="text-zinc-500">Total Biaya:</span>
                  <strong className="text-zinc-900">{formatRupiah(detailSample.totalCost || 0)}</strong>
                </div>
              )}
              <div className="flex justify-between border-b border-zinc-100 pb-2">
                <span className="text-zinc-500">Target Output:</span>
                <span className="font-bold text-orange-700">
                  {detailSample.completedContent} / {detailSample.targetContent} {detailSample.unitContent || 'VT'}
                </span>
              </div>
              {detailSample.notes && (
                <div className="pt-1">
                  <span className="text-zinc-500 block mb-1">Catatan:</span>
                  <p className="bg-zinc-50 p-2.5 rounded-xl border border-zinc-200 text-zinc-700">
                    {detailSample.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                onClick={() => setDetailSample(null)}
                className="w-full rounded-xl bg-zinc-900 text-white py-2.5 font-bold text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: DETAIL MASTER PRODUK ================= */}
      {detailProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-zinc-900 shadow-2xl border border-zinc-200 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-base font-black text-zinc-900">Detail Master Produk</h3>
              <button onClick={() => setDetailProduct(null)} className="text-zinc-400">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between border-b border-zinc-100 pb-2">
                <span className="text-zinc-500">Nama Produk:</span>
                <strong className="text-zinc-900 font-bold">{detailProduct.productName}</strong>
              </div>
              {!isEmployee && (
                <>
                  <div className="flex justify-between border-b border-zinc-100 pb-2">
                    <span className="text-zinc-500">Harga:</span>
                    <strong className="text-emerald-700 font-bold">{formatRupiah(detailProduct.productPrice || 0)}</strong>
                  </div>
                  <div className="flex justify-between border-b border-zinc-100 pb-2">
                    <span className="text-zinc-500">Komisi (%):</span>
                    <strong className="text-indigo-700 font-bold">{detailProduct.commissionRate || 10}%</strong>
                  </div>
                </>
              )}
              <div className="flex justify-between border-b border-zinc-100 pb-2">
                <span className="text-zinc-500">Kategori:</span>
                <span className="font-semibold text-zinc-800">{detailProduct.category || '-'}</span>
              </div>
              {!isEmployee && (
                <div className="flex justify-between border-b border-zinc-100 pb-2">
                  <span className="text-zinc-500">Scope:</span>
                  <span className="font-bold text-zinc-900">{detailProduct.scope}</span>
                </div>
              )}
              {detailProduct.productUrl && (
                <div className="border-b border-zinc-100 pb-2">
                  <span className="text-zinc-500 block mb-1">Link Toko:</span>
                  <a
                    href={detailProduct.productUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 hover:underline flex items-center gap-1 font-semibold truncate"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" /> {detailProduct.productUrl}
                  </a>
                </div>
              )}
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => {
                  setDetailProduct(null);
                  handleOpenBuySample(detailProduct);
                }}
                className="flex-1 rounded-xl bg-emerald-600 text-white py-2.5 font-bold text-xs hover:bg-emerald-500"
              >
                + Beli Sampel Dari Produk Ini
              </button>
              <button
                onClick={() => setDetailProduct(null)}
                className="rounded-xl border border-zinc-200 px-4 py-2.5 font-bold text-xs text-zinc-700 hover:bg-zinc-100"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: SCAN SCREENSHOT PRODUK (AI) ================= */}
      <ProductScanModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        accounts={accounts}
        existingProducts={products}
        currentUserId={userProfile?.uid || 'anonymous'}
        currentUserName={userProfile?.name || 'User'}
        defaultScope={isEmployee ? (userProfile?.scope || 'SHARING') : (isInvestor ? 'SHARING' : 'PRIBADI')}
        canChooseScope={!isEmployee && !isInvestor}
        onScanExtracted={(extractedData) => {
          setScanDataForUnifiedForm(extractedData);
          setIsAddProductSampleModalOpen(true);
        }}
        onProductCreated={(newProd, autoOpenSample) => {
          setProducts((prev) => [newProd, ...prev.filter((p) => p.id !== newProd.id)]);
          setSuccessToast(`Produk "${newProd.productName}" berhasil ditambahkan ke Katalog.`);
          if (autoOpenSample) {
            handleOpenBuySample(newProd);
          }
        }}
      />

      {/* ================= MODAL: SINGLE ENTRY PRODUK & SAMPEL ================= */}
      <AddProductSampleModal
        isOpen={isAddProductSampleModalOpen}
        onClose={() => {
          setIsAddProductSampleModalOpen(false);
          setScanDataForUnifiedForm(null);
        }}
        accounts={accounts}
        employees={employees}
        existingProducts={products}
        currentUserId={userProfile?.uid || 'anonymous'}
        currentUserName={userProfile?.name || 'User'}
        defaultScope={isEmployee ? (userProfile?.scope || 'SHARING') : (isInvestor ? 'SHARING' : 'PRIBADI')}
        canChooseScope={!isEmployee && !isInvestor}
        onSaved={({ product, sample }) => {
          if (product) {
            setProducts((prev) => [product, ...prev.filter((p) => p.id !== product.id)]);
          }
          if (sample) {
            setSamples((prev) => [sample, ...prev.filter((s) => s.id !== sample.id)]);
          }
          if (sample) {
            setSuccessToast(`Master produk "${product.productName}" dan data sampel fisik berhasil disimpan.`);
          } else {
            setSuccessToast(`Master produk "${product.productName}" berhasil disimpan ke Katalog.`);
          }
        }}
      />

      {/* ================= MODAL: IMPORT SPREADSHEET (PHASE: IMPORT SPREADSHEET V2) ================= */}
      <ImportSpreadsheetModal
        isOpen={isImportSpreadsheetModalOpen}
        onClose={() => setIsImportSpreadsheetModalOpen(false)}
        existingSamples={samples}
        accounts={accounts}
        employees={employees}
        currentUserId={userProfile?.uid || 'anonymous'}
        currentUserName={userProfile?.name || 'User'}
        defaultScope={isEmployee ? (userProfile?.scope || 'SHARING') : (isInvestor ? 'SHARING' : 'SHARING')}
        canChooseScope={!isEmployee && !isInvestor}
        onImportSuccess={({ batchId, successCount }) => {
          setSuccessToast(`Import ${batchId} sukses! ${successCount} data sampel berhasil dimasukkan ke database.`);
        }}
      />
    </div>
  );
};
