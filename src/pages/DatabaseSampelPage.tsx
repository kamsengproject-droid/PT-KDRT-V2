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

  // Master product photo state for Master Product modal
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string>('');
  const [productImageRemoved, setProductImageRemoved] = useState(false);
  const productCameraInputRef = React.useRef<HTMLInputElement>(null);
  const productGalleryInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (sampleImagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(sampleImagePreview);
      }
      if (productImagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(productImagePreview);
      }
    };
  }, [sampleImagePreview, productImagePreview]);

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
        const matchSeller = (s as any).sellerName?.toLowerCase().includes(q);
        const matchOrder = (s as any).orderNumber?.toLowerCase().includes(q);
        const matchNotes = s.notes?.toLowerCase().includes(q);
        if (!matchName && !matchAcc && !matchPic && !matchBrand && !matchLoc && !matchSeller && !matchOrder && !matchNotes) return false;
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
    setProductImageFile(null);
    setProductImagePreview('');
    setProductImageRemoved(false);
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setProductFormData({
      productName: prod.productName,
      productPrice: prod.productPrice || '',
      productUrl: prod.productUrl || '',
      productImage: prod.productImage || (prod as any).photoUrl || '',
      commissionRate: prod.commissionRate || 10,
      accountIds: prod.accountIds || [],
      category: prod.category || (isSharingEmployee ? 'Fashion Kaos' : 'Skincare & Kecantikan'),
      scope: prod.scope || 'PRIBADI',
      status: prod.status || 'AKTIF',
      notes: prod.notes || '',
    });
    setProductImageFile(null);
    setProductImagePreview(prod.productImage || (prod as any).photoUrl || '');
    setProductImageRemoved(false);
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
    const prodImg = prod.productImage || (prod as any).photoUrl || '';

    setSampleFormData({
      productId: prod.id || prod.productId || '',
      productName: prod.productName,
      productUrl: prod.productUrl || '',
      productImage: prodImg,
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
    setSampleImagePreview(prodImg);
    setSampleImageRemoved(false);
    setIsSampleModalOpen(true);
  };

  const handleOpenEditSample = (sample: AffiliateSample) => {
    setEditingSample(sample);
    const sampleImg = sample.sampleImage || sample.productImage || (sample as any).photoUrl || '';
    setSampleFormData({
      productId: sample.productId || '',
      productName: sample.productName,
      productUrl: sample.productUrl || '',
      productImage: sample.productImage || sampleImg,
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
    setSampleImagePreview(sampleImg);
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
      const prodImg = found.productImage || (found as any).photoUrl || '';
      if (prodImg && !sampleImageFile) {
        setSampleImagePreview(prodImg);
      }
      setSampleFormData((prev) => ({
        ...prev,
        productId: found.id || found.productId || '',
        productName: found.productName,
        productUrl: found.productUrl || '',
        productImage: prodImg,
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

      let finalPhotoUrl = productFormData.productImage;
      if (productImageRemoved) {
        finalPhotoUrl = '';
      }

      if (editingProduct?.id) {
        await updateProduct(
          editingProduct.id,
          editingProduct,
          {
            ...productFormData,
            productPrice: Number(productFormData.productPrice) || 0,
            commissionRate: Number(productFormData.commissionRate) || 0,
            productImage: finalPhotoUrl,
            photoUrl: finalPhotoUrl,
          },
          productImageFile,
          uid,
          name
        );
        setSuccessToast(`Master produk "${productFormData.productName}" berhasil diperbarui.`);
      } else {
        await createProduct(
          {
            ...productFormData,
            productPrice: Number(productFormData.productPrice) || 0,
            commissionRate: Number(productFormData.commissionRate) || 0,
            productImage: finalPhotoUrl,
            photoUrl: finalPhotoUrl,
          },
          productImageFile,
          uid,
          name
        );
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
      // wasn't touched, we preserve the existing photo URL.
      let sampleImageUrl: string | undefined = undefined;
      if (sampleImageFile) {
        const tempId = editingSample?.id || `temp_${Date.now()}`;
        sampleImageUrl = await uploadSampleImage(sampleImageFile, tempId);
      } else if (sampleImageRemoved) {
        sampleImageUrl = '';
      } else if (sampleFormData.productImage) {
        sampleImageUrl = sampleFormData.productImage;
      }

      const payload: any = {
        ...sampleFormData,
        accountName: selAcc?.accountName || '',
        employeeName: selEmp?.name || '',
      };
      if (sampleImageUrl !== undefined) {
        payload.sampleImage = sampleImageUrl;
        payload.productImage = sampleImageUrl;
        payload.photoUrl = sampleImageUrl;
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
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all cursor-pointer ${
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
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all cursor-pointer ${
              activeTab === 'MASTER_PRODUK'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            <ShoppingBag className="h-4 w-4 text-indigo-400" />
            <span>KATALOG MASTER PRODUK ({filteredProducts.length})</span>
          </button>
        </div>

        {/* Info label on tab bar */}
        <div className="text-[11px] font-bold text-zinc-500 hidden sm:block">
          {activeTab === 'SAMPEL' ? '🎨 Galeri Sampel Fisik & Progres Konten' : '📦 Master Katalog Produk'}
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'SAMPEL' ? (
        <div className="space-y-6">
          {/* ================= BAR PENCARIAN & FILTER SAMPEL (Tepat di Atas Kolom Sampel) ================= */}
          <div className="bg-gradient-to-br from-zinc-900 via-slate-900 to-zinc-900 border border-zinc-800 rounded-3xl p-4 sm:p-5 text-white shadow-xl space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Search className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-white tracking-tight flex items-center gap-2 uppercase">
                    Pencarian Cepat Sampel
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Cari produk untuk dibuat konten, lalu klik foto produk untuk langsung update progres VT.
                  </p>
                </div>
              </div>

              {/* Status counter pill */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-zinc-300 bg-zinc-800/80 border border-zinc-700/60 px-3 py-1 rounded-xl">
                  🟢 <strong className="text-amber-400">{newSamples.length}</strong> Belum Konten • ✅ <strong className="text-emerald-400">{oldSamples.length}</strong> Target Tercapai
                </span>
              </div>
            </div>

            {/* Input Pencarian & Filter Dropdown */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
              {/* Input Text Box */}
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-400 pointer-events-none" />
                <input
                  id="input-cari-sampel-utama"
                  type="text"
                  placeholder="Ketik nama produk, brand, PIC kreator, akun medsos, seller, lokasi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-2xl border border-zinc-700 bg-zinc-950/90 pl-10 pr-10 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                    title="Hapus pencarian"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Filter Scope & Lokasi */}
              <div className="flex flex-wrap items-center gap-2">
                {!isInvestor && (
                  <div className="flex items-center bg-zinc-950/90 border border-zinc-700 rounded-2xl p-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setScopeFilter('SEMUA')}
                      className={`rounded-xl px-3 py-1.5 font-black transition-all cursor-pointer ${
                        scopeFilter === 'SEMUA' ? 'bg-zinc-800 text-white shadow-xs' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => setScopeFilter('SHARING')}
                      className={`rounded-xl px-3 py-1.5 font-black transition-all cursor-pointer ${
                        scopeFilter === 'SHARING' ? 'bg-emerald-600 text-white shadow-xs' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Sharing
                    </button>
                    <button
                      type="button"
                      onClick={() => setScopeFilter('PRIBADI')}
                      className={`rounded-xl px-3 py-1.5 font-black transition-all cursor-pointer ${
                        scopeFilter === 'PRIBADI' ? 'bg-blue-600 text-white shadow-xs' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Pribadi
                    </button>
                  </div>
                )}

                {locations.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-zinc-950/90 border border-zinc-700 rounded-2xl px-3 py-2 text-xs">
                    <MapPin className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                    <select
                      value={locationFilter}
                      onChange={(e) => setLocationFilter(e.target.value)}
                      className="bg-transparent text-xs font-bold text-zinc-200 focus:outline-hidden cursor-pointer"
                    >
                      <option value="SEMUA" className="bg-zinc-900 text-white">Semua Lokasi</option>
                      <option value="BELUM_DITATA" className="bg-zinc-900 text-amber-400">⚠️ Belum Ditata</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.kodeLokasi} className="bg-zinc-900 text-white">
                          📍 {loc.kodeLokasi} ({loc.namaLokasi})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Active filter notification if any */}
            {(searchQuery || scopeFilter !== 'SEMUA' || locationFilter !== 'SEMUA') && (
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-400">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-zinc-400">Filter Aktif:</span>
                  {searchQuery && (
                    <span className="bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 font-bold px-2 py-0.5 rounded-lg">
                      "{searchQuery}"
                    </span>
                  )}
                  {scopeFilter !== 'SEMUA' && (
                    <span className="bg-zinc-800 border border-zinc-700 text-zinc-200 font-bold px-2 py-0.5 rounded-lg">
                      Scope: {scopeFilter}
                    </span>
                  )}
                  {locationFilter !== 'SEMUA' && (
                    <span className="bg-indigo-950 border border-indigo-700 text-indigo-300 font-bold px-2 py-0.5 rounded-lg">
                      Lokasi: {locationFilter}
                    </span>
                  )}
                  <span className="text-zinc-500">({filteredSamples.length} ditemukan)</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setScopeFilter('SEMUA');
                    setLocationFilter('SEMUA');
                  }}
                  className="text-xs font-bold text-rose-400 hover:text-rose-300 underline cursor-pointer shrink-0"
                >
                  Reset Filter
                </button>
              </div>
            )}
          </div>

          {/* Mobile Tab Switcher: Hanya BELUM SELESAI & SELESAI di mobile */}
          <div className="flex lg:hidden items-center p-1 bg-zinc-100 rounded-2xl border border-zinc-200 gap-1.5">
            <button
              type="button"
              onClick={() => setMobileSampleTab('BELUM_SELESAI')}
              className={`flex-1 py-2.5 px-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
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
              className={`flex-1 py-2.5 px-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
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
              <div className="flex items-center justify-between bg-amber-50/80 border border-amber-200/90 rounded-2xl px-4 py-3 shadow-2xs">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-amber-500 animate-pulse" />
                  <div>
                    <h2 className="font-black text-sm text-zinc-900 tracking-tight">
                      BELUM DIBUAT KONTEN (PROSES BERJALAN)
                    </h2>
                    <p className="text-[10px] text-amber-800 font-medium">
                      Klik foto produk untuk membuka & update penyelesaian VT.
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-amber-200/90 px-3 py-1 text-xs font-black text-amber-950 shrink-0">
                  {newSamples.length} Item
                </span>
              </div>

            {newSamples.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-zinc-200 bg-zinc-50/50 p-10 text-center text-xs text-zinc-400 space-y-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                <p className="font-bold text-zinc-700">Semua sampel sudah memenuhi target konten VT!</p>
                <p className="text-[11px] text-zinc-400">Tidak ada sampel yang menunggu pembuatan konten.</p>
              </div>
            ) : (
              /* Product Gallery Grid */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {newSamples.map((sample) => {
                  const target = Number(sample.targetContent) || 1;
                  const current = Number(sample.completedContent) || 0;
                  const percent = Math.min(100, Math.round((current / target) * 100));
                  const photo = sample.sampleImage || sample.productImage || (sample as any).photoUrl;

                  return (
                    <div
                      key={sample.id}
                      className="group flex flex-col rounded-3xl border border-zinc-200 bg-white overflow-hidden shadow-2xs hover:shadow-lg hover:border-emerald-400 transition-all duration-200"
                    >
                      {/* Foto Produk Dominan (Klik foto untuk langsung buka progress/update VT) */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setProgressModalSample(sample);
                          setNewCompletedCount(sample.completedContent || 0);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            setProgressModalSample(sample);
                            setNewCompletedCount(sample.completedContent || 0);
                          }
                        }}
                        title="Klik foto untuk update progres VT"
                        className="relative h-48 sm:h-52 w-full bg-zinc-900 cursor-pointer overflow-hidden select-none"
                      >
                        {photo ? (
                          <img
                            src={photo}
                            alt={sample.productName}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-108"
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 text-zinc-500 p-4 text-center">
                            <Package className="h-10 w-10 text-zinc-600 mb-1 group-hover:text-emerald-400 transition-colors" />
                            <span className="text-[11px] font-bold text-zinc-400">Belum ada foto</span>
                          </div>
                        )}

                        {/* Gradient Overlay for Badges & Legibility */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/40 pointer-events-none" />

                        {/* Top Badges */}
                        <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between gap-1 pointer-events-none">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span
                              className={`rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-sm ${
                                sample.scope === 'SHARING'
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-blue-600 text-white'
                              }`}
                            >
                              {sample.scope}
                            </span>
                            {sample.locationCode ? (
                              <span className="inline-flex items-center gap-0.5 rounded-lg bg-indigo-600/90 text-white backdrop-blur-xs px-2 py-0.5 text-[10px] font-bold shadow-sm">
                                <MapPin className="h-3 w-3" />
                                {sample.locationCode}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 rounded-lg bg-amber-500/90 text-white backdrop-blur-xs px-2 py-0.5 text-[9px] font-bold shadow-sm">
                                Belum Ditata
                              </span>
                            )}
                          </div>

                          {/* Target VT Badge */}
                          <span className="inline-flex items-center gap-1 rounded-lg bg-orange-600/95 text-white backdrop-blur-xs px-2.5 py-0.5 text-[11px] font-black shadow-md border border-orange-400/40">
                            <PlayCircle className="h-3.5 w-3.5" />
                            {current}/{target} {sample.unitContent || 'VT'}
                          </span>
                        </div>

                        {/* Center Hover Action Hint */}
                        <div className="absolute bottom-2.5 inset-x-2.5 flex items-center justify-center opacity-90 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <span className="inline-flex items-center gap-1.5 rounded-xl bg-black/70 group-hover:bg-orange-600 text-white px-3 py-1 text-[11px] font-black backdrop-blur-md shadow-lg border border-white/10 group-hover:border-orange-400/50 transition-all">
                            <PlayCircle className="h-3.5 w-3.5 text-orange-400 group-hover:text-white" />
                            <span>Klik Foto → Update VT ({percent}%)</span>
                          </span>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div className="space-y-2">
                          {/* Nama Produk (Judul Utama) */}
                          <h3
                            onClick={() => {
                              setProgressModalSample(sample);
                              setNewCompletedCount(sample.completedContent || 0);
                            }}
                            title={sample.productName}
                            className="font-black text-sm text-zinc-900 group-hover:text-emerald-700 transition-colors line-clamp-2 leading-snug cursor-pointer"
                          >
                            {sample.productName}
                          </h3>

                          {/* Info Badges & Detail Grid */}
                          <div className="space-y-1.5 text-[11px] text-zinc-600 bg-zinc-50 rounded-2xl p-2.5 border border-zinc-100">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-zinc-500 font-medium">Brand:</span>
                              <span className="font-bold text-zinc-800 truncate max-w-[140px]">
                                {sample.brandName || <span className="text-zinc-400 italic">Tanpa Brand</span>}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-zinc-500 font-medium">Akun:</span>
                              <span className="font-bold text-indigo-700 truncate max-w-[140px]">
                                {sample.accountName || 'Akun -'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-zinc-500 font-medium">PIC:</span>
                              <span className="font-black text-zinc-900 truncate max-w-[140px]">
                                {sample.employeeName || '-'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-1 pt-1 border-t border-zinc-200/60 text-[10px]">
                              <span className="text-zinc-400">Tgl Beli:</span>
                              <span className="font-medium text-zinc-600">{formatTanggal(sample.purchaseDate)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Progress Bar VT */}
                        <div className="space-y-1.5 bg-orange-50/70 rounded-2xl p-2.5 border border-orange-200/80">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[11px] font-bold text-orange-950">
                              Progress Konten ({sample.unitContent || 'VT'}):
                            </span>
                            <span className="font-black text-orange-900">
                              {current} / {target} ({percent}%)
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-orange-200/70 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                percent >= 100 ? 'bg-emerald-500' : 'bg-orange-500'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>

                        {/* Card Footer Actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-zinc-100 gap-2">
                          {!isInvestor ? (
                            <button
                              type="button"
                              onClick={() => {
                                setProgressModalSample(sample);
                                setNewCompletedCount(sample.completedContent || 0);
                              }}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-95 text-white px-3 py-2 text-xs font-black shadow-xs transition-all cursor-pointer"
                            >
                              <PlayCircle className="h-4 w-4" />
                              <span>Update VT</span>
                            </button>
                          ) : (
                            <span className="text-[10px] font-bold text-zinc-400">Mode Investor</span>
                          )}

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setDetailSample(sample)}
                              title="Lihat detail lengkap sampel"
                              className="rounded-xl px-2.5 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors cursor-pointer"
                            >
                              Detail
                            </button>
                            {!isInvestor && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditSample(sample)}
                                  title="Edit data sampel"
                                  className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 transition-colors cursor-pointer"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                {isOwner && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSample(sample)}
                                    title="Hapus sampel"
                                    className="rounded-xl p-2 text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
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
            <div className="flex items-center justify-between bg-zinc-100 border border-zinc-200 rounded-2xl px-4 py-3 shadow-2xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <div>
                  <h2 className="font-black text-sm text-zinc-900 tracking-tight">
                    TOTAL SELESAI (TARGET TERPENUHI)
                  </h2>
                  <p className="text-[10px] text-zinc-500 font-medium">
                    Sampel yang seluruh target konten VT-nya telah terselesaikan.
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-zinc-200 px-3 py-1 text-xs font-black text-zinc-700 shrink-0">
                {oldSamples.length} Item
              </span>
            </div>

            {oldSamples.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-zinc-200 bg-zinc-50/50 p-10 text-center text-xs text-zinc-400">
                Belum ada sampel yang memenuhi target konten.
              </div>
            ) : (
              /* Product Gallery Grid Selesai */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {oldSamples.map((sample) => {
                  const photo = sample.sampleImage || sample.productImage || (sample as any).photoUrl;
                  const target = Number(sample.targetContent) || 1;
                  const current = Number(sample.completedContent) || target;

                  return (
                    <div
                      key={sample.id}
                      className="group flex flex-col rounded-3xl border border-zinc-200 bg-zinc-50/60 overflow-hidden shadow-2xs hover:shadow-md hover:border-emerald-300 transition-all opacity-95 hover:opacity-100"
                    >
                      {/* Foto Produk */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setProgressModalSample(sample);
                          setNewCompletedCount(sample.completedContent || 0);
                        }}
                        title="Klik foto untuk melihat / ubah progress"
                        className="relative h-44 sm:h-48 w-full bg-zinc-900 cursor-pointer overflow-hidden"
                      >
                        {photo ? (
                          <img
                            src={photo}
                            alt={sample.productName}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center bg-zinc-800 text-zinc-500">
                            <Package className="h-8 w-8 text-zinc-600 mb-1" />
                            <span className="text-[10px] font-bold text-zinc-400">Foto tidak tersedia</span>
                          </div>
                        )}

                        {/* Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/30 pointer-events-none" />

                        {/* Badges on Photo */}
                        <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between gap-1 pointer-events-none">
                          <span className="rounded-lg bg-emerald-600 text-white px-2 py-0.5 text-[9px] font-black uppercase">
                            {sample.scope}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-600/95 text-white backdrop-blur-xs px-2 py-0.5 text-[10px] font-black shadow-sm">
                            <Check className="h-3 w-3" /> SELESAI
                          </span>
                        </div>

                        <div className="absolute bottom-2 inset-x-2 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <span className="rounded-xl bg-black/80 text-white px-2.5 py-1 text-[10px] font-bold backdrop-blur-xs border border-white/10">
                            🔍 Klik untuk Detail / Ubah VT
                          </span>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
                        <div>
                          <h3
                            onClick={() => setDetailSample(sample)}
                            title={sample.productName}
                            className="font-bold text-xs sm:text-sm text-zinc-900 line-clamp-2 leading-snug cursor-pointer hover:text-emerald-700"
                          >
                            {sample.productName}
                          </h3>

                          <div className="mt-2 space-y-1 text-[11px] text-zinc-600 bg-white/80 rounded-xl p-2 border border-zinc-200/60">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-zinc-400">PIC:</span>
                              <span className="font-bold text-zinc-800 truncate">{sample.employeeName || '-'}</span>
                            </div>
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-zinc-400">Akun:</span>
                              <span className="font-semibold text-indigo-700 truncate">{sample.accountName || '-'}</span>
                            </div>
                            {sample.brandName && (
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-zinc-400">Brand:</span>
                                <span className="font-medium text-zinc-700 truncate">{sample.brandName}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Progress complete indicator */}
                        <div className="bg-emerald-50 rounded-xl p-2 border border-emerald-200/80 flex items-center justify-between text-xs">
                          <span className="text-[11px] font-bold text-emerald-900 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Target Terpenuhi
                          </span>
                          <span className="font-black text-emerald-950 text-[11px]">
                            {current}/{target} {sample.unitContent || 'VT'}
                          </span>
                        </div>

                        {/* Footer actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-zinc-200/80 text-xs">
                          <button
                            type="button"
                            onClick={() => setDetailSample(sample)}
                            className="rounded-lg px-2 py-1 text-[11px] font-bold text-zinc-700 hover:bg-zinc-200 transition-colors cursor-pointer"
                          >
                            Detail
                          </button>

                          {!isInvestor && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setProgressModalSample(sample);
                                  setNewCompletedCount(sample.completedContent || 0);
                                }}
                                title="Update VT"
                                className="rounded-lg px-2 py-1 text-[11px] font-bold text-orange-700 hover:bg-orange-100 transition-colors cursor-pointer"
                              >
                                Ubah VT
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditSample(sample)}
                                title="Edit sampel"
                                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-800 transition-colors cursor-pointer"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      ) : (
        /* ================= KATALOG MASTER PRODUK (products) ================= */
        <div className="space-y-4">
          {/* Master product search bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900 p-4 rounded-2xl border border-zinc-800 text-white">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-400" />
              <input
                type="text"
                placeholder="Cari master produk..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-indigo-500 font-medium"
              />
            </div>
            <span className="text-xs font-bold text-indigo-300">
              Total {filteredProducts.length} Produk Master
            </span>
          </div>

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

              {/* Foto Produk */}
              <div className="space-y-2">
                <label className="block font-bold text-zinc-700">Foto Master Produk (Kamera / Galeri / URL)</label>
                <input
                  ref={productCameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setProductImageFile(file);
                      setProductImagePreview(URL.createObjectURL(file));
                      setProductImageRemoved(false);
                    }
                    e.target.value = '';
                  }}
                />
                <input
                  ref={productGalleryInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setProductImageFile(file);
                      setProductImagePreview(URL.createObjectURL(file));
                      setProductImageRemoved(false);
                    }
                    e.target.value = '';
                  }}
                />

                {productImagePreview ? (
                  <div className="space-y-2">
                    <img
                      src={productImagePreview}
                      alt="Preview foto produk"
                      className="w-full max-h-48 object-cover rounded-xl border border-zinc-300"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => productCameraInputRef.current?.click()}
                        className="flex-1 rounded-xl border border-zinc-300 p-2 text-xs font-bold text-zinc-700"
                      >
                        📷 Ambil Ulang
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProductImageFile(null);
                          setProductImagePreview('');
                          setProductImageRemoved(true);
                          setProductFormData({ ...productFormData, productImage: '' });
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
                      onClick={() => productCameraInputRef.current?.click()}
                      className="rounded-xl border border-zinc-300 p-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
                    >
                      📷 AMBIL FOTO
                    </button>
                    <button
                      type="button"
                      onClick={() => productGalleryInputRef.current?.click()}
                      className="rounded-xl border border-zinc-300 p-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
                    >
                      🖼️ PILIH DARI GALERI
                    </button>
                  </div>
                )}

                <input
                  type="text"
                  value={productFormData.productImage}
                  onChange={(e) => {
                    setProductFormData({ ...productFormData, productImage: e.target.value });
                    if (e.target.value && !productImageFile) {
                      setProductImagePreview(e.target.value);
                      setProductImageRemoved(false);
                    }
                  }}
                  placeholder="Atau tempel URL gambar (https://...)"
                  className="w-full rounded-xl border border-zinc-300 p-2 text-xs text-zinc-600"
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
                    <div className="relative group rounded-xl overflow-hidden border border-zinc-300 bg-zinc-100 flex items-center justify-center">
                      <img
                        src={sampleImagePreview}
                        alt="Preview foto sampel"
                        className="w-full max-h-52 object-contain"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="rounded-xl border border-zinc-300 bg-white p-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
                      >
                        📷 Kamera
                      </button>
                      <button
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        className="rounded-xl border border-zinc-300 bg-white p-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
                      >
                        🖼️ Galeri
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSampleImageFile(null);
                          setSampleImagePreview('');
                          setSampleImageRemoved(true);
                          setSampleFormData((prev) => ({ ...prev, productImage: '' }));
                        }}
                        className="rounded-xl border border-red-300 bg-red-50 p-2 text-xs font-bold text-red-600 hover:bg-red-100"
                      >
                        🗑️ Hapus
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="rounded-xl border border-zinc-300 bg-white p-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
                    >
                      📷 AMBIL FOTO
                    </button>
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="rounded-xl border border-zinc-300 bg-white p-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
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
      {progressModalSample && (() => {
        const target = Number(progressModalSample.targetContent) || 1;
        const current = Number(newCompletedCount) || 0;
        const percent = Math.min(100, Math.round((current / target) * 100));
        const photo = progressModalSample.sampleImage || progressModalSample.productImage || (progressModalSample as any).photoUrl;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 text-zinc-900 shadow-2xl border border-zinc-200 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                    <PlayCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-zinc-900">
                      Update Progres VT / Konten
                    </h3>
                    <p className="text-[11px] text-zinc-500 font-medium">
                      Perbarui jumlah video/konten yang telah diproduksi
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setProgressModalSample(null)}
                  className="rounded-full p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Product Preview Card */}
              <div className="flex items-center gap-3 bg-zinc-50 border border-zinc-200/80 rounded-2xl p-3">
                {photo ? (
                  <img
                    src={photo}
                    alt={progressModalSample.productName}
                    referrerPolicy="no-referrer"
                    className="h-16 w-16 rounded-xl object-cover border border-zinc-200 shrink-0 shadow-2xs"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-zinc-200 text-zinc-400 shrink-0">
                    <Package className="h-7 w-7" />
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-0.5">
                  <span className="inline-block px-1.5 py-0.2 text-[9px] font-black uppercase rounded bg-zinc-200 text-zinc-700">
                    {progressModalSample.scope}
                  </span>
                  <h4 className="font-bold text-xs sm:text-sm text-zinc-900 truncate">
                    {progressModalSample.productName}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                    <span>PIC: <strong className="text-zinc-700">{progressModalSample.employeeName || '-'}</strong></span>
                    <span>•</span>
                    <span className="text-indigo-600 font-semibold">{progressModalSample.accountName || 'Akun -'}</span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleUpdateProgressSubmit} className="space-y-4 text-xs">
                {/* Stepper Input Counter */}
                <div className="space-y-2">
                  <label className="block font-bold text-zinc-700 text-center">
                    Jumlah Konten Selesai ({progressModalSample.unitContent || 'VT'})
                  </label>
                  
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setNewCompletedCount(Math.max(0, current - 1))}
                      disabled={current <= 0}
                      className="h-12 w-12 rounded-2xl border border-zinc-200 bg-zinc-100 hover:bg-zinc-200 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-lg font-black text-zinc-700 transition-all flex items-center justify-center cursor-pointer"
                    >
                      -1
                    </button>

                    <input
                      type="number"
                      min={0}
                      max={target}
                      value={newCompletedCount}
                      onChange={(e) => setNewCompletedCount(Math.max(0, Math.min(target, Number(e.target.value))))}
                      className="w-28 h-12 rounded-2xl border-2 border-orange-400 bg-orange-50/50 p-2 text-2xl font-black text-center text-orange-700 focus:outline-hidden focus:border-orange-600 focus:ring-2 focus:ring-orange-200"
                    />

                    <button
                      type="button"
                      onClick={() => setNewCompletedCount(Math.min(target, current + 1))}
                      disabled={current >= target}
                      className="h-12 w-12 rounded-2xl border border-orange-200 bg-orange-100 hover:bg-orange-200 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-lg font-black text-orange-700 transition-all flex items-center justify-center cursor-pointer"
                    >
                      +1
                    </button>
                  </div>

                  {/* Quick Shortcut Buttons */}
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setNewCompletedCount(0)}
                      className="px-2.5 py-1 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-bold text-[11px] transition-colors cursor-pointer"
                    >
                      Reset (0)
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewCompletedCount(target)}
                      className="px-3 py-1 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-black text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="h-3 w-3" /> Target Terpenuhi ({target} {progressModalSample.unitContent || 'VT'})
                    </button>
                  </div>
                </div>

                {/* Live Progress Preview */}
                <div className="space-y-1.5 bg-zinc-50 border border-zinc-200/80 rounded-2xl p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[11px] font-bold text-zinc-600">
                      Status Progres:
                    </span>
                    <span className={`font-black text-xs ${percent >= 100 ? 'text-emerald-700' : 'text-orange-700'}`}>
                      {current} / {target} {progressModalSample.unitContent || 'VT'} ({percent}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-zinc-200 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        percent >= 100 ? 'bg-emerald-500' : 'bg-orange-500'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  {percent >= 100 && (
                    <p className="text-[11px] font-bold text-emerald-700 text-center pt-0.5">
                      🎉 Sampel ini akan otomatis dipindahkan ke kolom TARGET TERPENUHI!
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={() => setProgressModalSample(null)}
                    className="rounded-2xl border border-zinc-200 px-4 py-2.5 font-bold text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-5 py-2.5 font-black shadow-md shadow-orange-500/20 active:scale-95 transition-all cursor-pointer text-center flex items-center justify-center gap-1.5"
                  >
                    <Check className="h-4 w-4" />
                    <span>Simpan Progres</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

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
              {(detailSample.sampleImage || detailSample.productImage || (detailSample as any).photoUrl) && (
                <img
                  src={detailSample.sampleImage || detailSample.productImage || (detailSample as any).photoUrl}
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
              {(detailProduct.productImage || (detailProduct as any).photoUrl) && (
                <img
                  src={detailProduct.productImage || (detailProduct as any).photoUrl}
                  alt="Foto master produk"
                  className="w-full max-h-48 object-cover rounded-xl border border-zinc-200 mb-1"
                />
              )}
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
