import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  ShoppingBag,
  Package,
  Layers,
  Percent,
  ExternalLink,
  Smartphone,
  RefreshCw,
  Image as ImageIcon,
  Check,
  Flame,
  Info,
  DollarSign,
} from 'lucide-react';
import { CurrencyInput } from '../CurrencyInput';
import { Product, Account, ScopeType, ProductStatus } from '../../types';
import {
  scanProductScreenshot,
  cropProductImage,
  checkDuplicateProducts,
  AIScanResult,
} from '../../services/aiScanService';
import { createProduct } from '../../services/productService';
import { formatRupiah } from '../../utils/formatters';

interface ProductScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  existingProducts: Product[];
  currentUserId: string;
  currentUserName: string;
  defaultScope: ScopeType;
  canChooseScope: boolean;
  onProductCreated: (newProduct: Product, autoOpenSampleOrder?: boolean) => void;
  onScanExtracted?: (scanResult: AIScanResult) => void;
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

export const ProductScanModal: React.FC<ProductScanModalProps> = ({
  isOpen,
  onClose,
  accounts,
  existingProducts,
  currentUserId,
  currentUserName,
  defaultScope,
  canChooseScope,
  onProductCreated,
  onScanExtracted,
}) => {
  const activeCategoryOptions = canChooseScope ? MASTER_KATEGORI_OPTIONS : EMPLOYEE_KATEGORI_OPTIONS;

  // Step state: 'UPLOAD' | 'SCANNING' | 'REVIEW' | 'SUCCESS'
  const [step, setStep] = useState<'UPLOAD' | 'SCANNING' | 'REVIEW' | 'SUCCESS'>('UPLOAD');

  // File states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [croppedFile, setCroppedFile] = useState<File | null>(null);
  const [croppedPreview, setCroppedPreview] = useState<string | null>(null);
  const [activeImageChoice, setActiveImageChoice] = useState<'CROPPED' | 'ORIGINAL'>('CROPPED');

  // AI Extraction results & raw metadata
  const [scanResult, setScanResult] = useState<AIScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Form Fields (Editable by User)
  const [productName, setProductName] = useState<string>('');
  const [productPrice, setProductPrice] = useState<number>(0);
  const [platform, setPlatform] = useState<'TikTok' | 'Shopee' | 'MANUAL'>('TikTok');
  const [category, setCategory] = useState<string>(canChooseScope ? 'Skincare & Kecantikan' : 'Fashion Kaos');
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [scope, setScope] = useState<ScopeType>(defaultScope);
  const [commissionRate, setCommissionRate] = useState<number | ''>(''); // Left empty by default
  const [productUrl, setProductUrl] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Duplicate Check warning
  const [duplicates, setDuplicates] = useState<Product[]>([]);
  const [ignoreDuplicates, setIgnoreDuplicates] = useState<boolean>(false);

  // Submitting state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Newly created product reference for post-save action
  const [createdProduct, setCreatedProduct] = useState<Product | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Reset modal state on open
  useEffect(() => {
    if (isOpen) {
      setStep('UPLOAD');
      setSelectedFile(null);
      setFilePreview(null);
      setCroppedFile(null);
      setCroppedPreview(null);
      setActiveImageChoice('CROPPED');
      setScanResult(null);
      setScanError(null);
      setProductName('');
      setProductPrice(0);
      setPlatform('TikTok');
      setCategory(canChooseScope ? 'Skincare & Kecantikan' : 'Fashion Kaos');
      setSelectedAccountIds(accounts.length > 0 ? [accounts[0].id || ''] : []);
      setScope(defaultScope);
      setCommissionRate('');
      setProductUrl('');
      setNotes('');
      setDuplicates([]);
      setIgnoreDuplicates(false);
      setIsSubmitting(false);
      setSubmitError(null);
      setCreatedProduct(null);
    }
  }, [isOpen, defaultScope, accounts]);

  // Handle File Selection
  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Mohon pilih file gambar screenshot yang valid (JPG, PNG, WebP).');
      return;
    }
    setSelectedFile(file);
    setScanError(null);
    const objectUrl = URL.createObjectURL(file);
    setFilePreview(objectUrl);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Run AI Scan
  const handleRunScan = async () => {
    if (!selectedFile) return;

    setStep('SCANNING');
    setScanError(null);

    try {
      // 1. Call Gemini API endpoint
      const result = await scanProductScreenshot(selectedFile);
      setScanResult(result);

      // 2. Crop product image if bounding box returned
      const cropped = await cropProductImage(selectedFile, result.productImageBoundingBox);
      setCroppedFile(cropped.file);
      setCroppedPreview(cropped.previewUrl);
      setActiveImageChoice(result.productImageBoundingBox ? 'CROPPED' : 'ORIGINAL');

      // 3. Pre-fill form fields
      setProductName(result.productName || '');
      setProductPrice(result.productPrice || 0);
      setPlatform(result.platform || 'TikTok');
      if (result.category && activeCategoryOptions.includes(result.category)) {
        setCategory(result.category);
      } else {
        setCategory(canChooseScope ? 'Skincare & Kecantikan' : 'Fashion Kaos');
      }

      // Build initial notes from variants or recommendation
      let noteText = '';
      if (result.variantOrSize) {
        noteText += `Varian/Ukuran: ${result.variantOrSize}\n`;
      }
      if (result.aiRecommendation) {
        noteText += `Badge: ${result.aiRecommendation}\n`;
      }
      if (result.notes) {
        noteText += result.notes;
      }
      setNotes(noteText.trim());

      // 4. Duplicate Check
      const foundDuplicates = checkDuplicateProducts(result.productName, '', existingProducts);
      setDuplicates(foundDuplicates);

      setStep('REVIEW');
    } catch (err: any) {
      console.error('Scan failed:', err);
      setScanError(err.message || 'Data tidak dapat dibaca dengan jelas dari screenshot. Silakan isi manual.');
      setStep('UPLOAD');
    }
  };

  // Re-check duplicates when name or url changes
  const handleNameChange = (val: string) => {
    setProductName(val);
    if (!ignoreDuplicates) {
      const found = checkDuplicateProducts(val, productUrl, existingProducts);
      setDuplicates(found);
    }
  };

  const handleUrlChange = (val: string) => {
    setProductUrl(val);
    if (!ignoreDuplicates) {
      const found = checkDuplicateProducts(productName, val, existingProducts);
      setDuplicates(found);
    }
  };

  // Handle Form Submission -> Save Product to Firestore
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!productName.trim()) {
      setSubmitError('Nama produk wajib diisi.');
      return;
    }

    if (duplicates.length > 0 && !ignoreDuplicates) {
      setSubmitError('Produk serupa terdeteksi. Silakan konfirmasi untuk tetap menambahkan.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Pick file to upload
      const fileToUpload = activeImageChoice === 'CROPPED' && croppedFile ? croppedFile : selectedFile;

      const selectedAccounts = accounts.filter((a) => selectedAccountIds.includes(a.id || ''));
      const accountNames = selectedAccounts.map((a) => a.accountName);
      const primaryAccount = selectedAccounts[0];

      const productPayload: Omit<Product, 'id' | 'productId' | 'createdAt' | 'updatedAt'> = {
        productName: productName.trim(),
        productPrice: Number(productPrice) || 0,
        productUrl: productUrl.trim(),
        commissionRate: commissionRate !== '' ? Number(commissionRate) : 0,
        accountIds: selectedAccountIds,
        accountNames: accountNames,
        accountId: primaryAccount?.id || '',
        accountName: primaryAccount?.accountName || '',
        category: category,
        scope: scope,
        status: 'AKTIF',
        notes: notes.trim(),
        createdBy: currentUserId,
      };

      // Save to Firestore via productService (which also uploads image to Firebase Storage)
      const newDocId = await createProduct(
        productPayload,
        fileToUpload,
        currentUserId,
        currentUserName
      );

      const savedProduct: Product = {
        id: newDocId,
        productId: newDocId,
        ...productPayload,
        productImage: croppedPreview || filePreview || undefined,
        photoUrl: croppedPreview || filePreview || undefined,
        createdByName: currentUserName,
      };

      setCreatedProduct(savedProduct);
      onProductCreated(savedProduct, false);
      setStep('SUCCESS');
    } catch (err: any) {
      console.error('Error saving scanned product:', err);
      setSubmitError(err.message || 'Gagal menyimpan data produk.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="modal-scan-product-screenshot"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-zinc-200 overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 bg-gradient-to-r from-zinc-900 via-slate-900 to-zinc-900 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded">
                  AI SCANNER
                </span>
                <h3 className="text-base font-black text-white">
                  SCAN SCREENSHOT PRODUK
                </h3>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Upload screenshot TikTok Shop / Shopee untuk auto-fill form produk
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body Based on Current Step */}
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {/* ========================================================================= */}
          {/* STEP 1: UPLOAD SCREENSHOT */}
          {/* ========================================================================= */}
          {step === 'UPLOAD' && (
            <div className="space-y-5">
              {scanError && (
                <div className="flex items-start gap-3 rounded-2xl bg-rose-50 p-4 border border-rose-200 text-rose-800 text-xs">
                  <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
                  <div>
                    <span className="font-bold block">Gagal Membaca Screenshot:</span>
                    <span>{scanError}</span>
                  </div>
                </div>
              )}

              {/* Upload Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`group flex flex-col items-center justify-center rounded-3xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
                  selectedFile
                    ? 'border-emerald-500 bg-emerald-50/30'
                    : 'border-zinc-300 hover:border-emerald-500 hover:bg-zinc-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />

                {filePreview ? (
                  <div className="space-y-3">
                    <div className="relative mx-auto h-48 max-w-xs overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-md">
                      <img
                        src={filePreview}
                        alt="Screenshot Preview"
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="text-xs font-bold text-zinc-700">
                      {selectedFile?.name} ({(Number(selectedFile?.size || 0) / 1024).toFixed(0)} KB)
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Klik atau seret gambar lain untuk mengganti screenshot
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600 group-hover:scale-105 transition-transform">
                      <Upload className="h-8 w-8" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-zinc-900">
                        Klik untuk upload atau seret screenshot ke sini
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        Format JPG, PNG, atau WebP dari TikTok Shop / Shopee / Marketplace
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Instructions Pill */}
              <div className="rounded-2xl bg-zinc-50 p-4 border border-zinc-200/80 text-xs text-zinc-600 space-y-1.5">
                <div className="font-bold text-zinc-800 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  Apa yang akan diekstrak AI:
                </div>
                <ul className="grid grid-cols-2 gap-1.5 text-[11px] text-zinc-500 pt-1">
                  <li className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-600" /> Nama / Judul Produk
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-600" /> Harga Produk (Rp)
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-600" /> Platform (TikTok / Shopee)
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-600" /> Foto Produk (Auto-Crop)
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-600" /> Badge / Top Selling
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-600" /> Varian / Estimasi Earning
                  </li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-2xl border border-zinc-200 bg-white px-5 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={!selectedFile}
                  onClick={handleRunScan}
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-2.5 text-xs font-black text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>ANALISIS DENGAN AI</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: SCANNING IN PROGRESS */}
          {/* ========================================================================= */}
          {step === 'SCANNING' && (
            <div className="py-12 text-center space-y-4">
              <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600">
                <RefreshCw className="h-10 w-10 animate-spin" />
                <Sparkles className="absolute top-2 right-2 h-5 w-5 text-amber-500 animate-pulse" />
              </div>
              <div>
                <h4 className="text-base font-black text-zinc-900">
                  AI Sedang Menganalisis Screenshot...
                </h4>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                  Mengekstrak nama produk, nominal harga, platform, ranking, dan memotong foto produk utama...
                </p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: REVIEW / EDIT FORM (MANDATORY USER REVIEW) */}
          {/* ========================================================================= */}
          {step === 'REVIEW' && (
            <form onSubmit={handleSaveProduct} className="space-y-5">
              {submitError && (
                <div className="rounded-2xl bg-rose-50 p-4 border border-rose-200 text-xs font-bold text-rose-800">
                  {submitError}
                </div>
              )}

              {/* AI Badges & Recommendation info */}
              <div className="space-y-2">
                {scanResult?.aiRecommendation && (
                  <div className="flex items-center gap-2 rounded-2xl bg-amber-50 px-3.5 py-2.5 border border-amber-200 text-amber-900 text-xs">
                    <Flame className="h-4 w-4 text-amber-600 shrink-0" />
                    <div>
                      <span className="font-extrabold uppercase tracking-wide">
                        Badge Terdeteksi: {scanResult.aiRecommendation}
                      </span>
                      <span className="text-[11px] text-amber-700 block">
                        (Informasi display dari marketplace, tidak mengubah sistem kas/winning secara otomatis)
                      </span>
                    </div>
                  </div>
                )}

                {scanResult?.earningInfo && (
                  <div className="flex items-start gap-2 rounded-2xl bg-blue-50 px-3.5 py-2.5 border border-blue-200 text-blue-900 text-xs">
                    <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">
                        Informasi Earning Terbaca: &ldquo;{scanResult.earningInfo}&rdquo;
                      </span>
                      <span className="text-[11px] text-blue-700 block mt-0.5">
                        ⚠️ Catatan: Ini adalah estimasi display dari screenshot, <strong>BUKAN Komisi Real</strong> dan tidak masuk ke pembukuan kas.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Foto Produk Preview & Selector */}
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-3">
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-700">
                  Foto Produk (Disimpan di Firebase Storage)
                </label>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-zinc-200 bg-white shadow-sm flex items-center justify-center">
                    <img
                      src={activeImageChoice === 'CROPPED' && croppedPreview ? croppedPreview : (filePreview || '')}
                      alt="Product Preview"
                      className="h-full w-full object-contain"
                    />
                  </div>

                  <div className="flex-1 space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      {croppedPreview && (
                        <button
                          type="button"
                          onClick={() => setActiveImageChoice('CROPPED')}
                          className={`px-3 py-1.5 rounded-xl font-bold border text-xs transition-all cursor-pointer ${
                            activeImageChoice === 'CROPPED'
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                          }`}
                        >
                          Foto Produk (Auto-Crop AI)
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setActiveImageChoice('ORIGINAL')}
                        className={`px-3 py-1.5 rounded-xl font-bold border text-xs transition-all cursor-pointer ${
                          activeImageChoice === 'ORIGINAL'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                        }`}
                      >
                        Screenshot Penuh
                      </button>
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      Foto akan diunggah aman ke Firebase Storage dan dihubungkan ke data Master Produk.
                    </p>
                  </div>
                </div>
              </div>

              {/* Nama Produk */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-black uppercase tracking-wider text-zinc-700">
                    Nama Produk <span className="text-rose-500">*</span>
                  </label>
                  {scanResult?.confidence?.productName && (
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                        scanResult.confidence.productName === 'HIGH'
                          ? 'bg-emerald-100 text-emerald-800'
                          : scanResult.confidence.productName === 'MEDIUM'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      Confidence: {scanResult.confidence.productName}
                      {scanResult.confidence.productName === 'LOW' && ' (Perlu Dicek)'}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Skintific 5X Ceramide Barrier Moisture Gel 30g"
                  value={productName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full rounded-2xl border border-zinc-300 px-4 py-2.5 text-xs sm:text-sm font-semibold text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Duplicate Products Alert */}
              {duplicates.length > 0 && (
                <div className="rounded-2xl bg-amber-50 p-4 border border-amber-200 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-black text-amber-900">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span>⚠️ Peringatan: Produk Serupa Ditemukan di Katalog ({duplicates.length})</span>
                  </div>
                  <ul className="text-xs text-amber-800 divide-y divide-amber-200/60 max-h-28 overflow-y-auto">
                    {duplicates.map((dup) => (
                      <li key={dup.id} className="py-1 flex items-center justify-between">
                        <span className="font-semibold truncate max-w-xs">{dup.productName}</span>
                        <span className="font-bold text-amber-950">{formatRupiah(dup.productPrice)}</span>
                      </li>
                    ))}
                  </ul>
                  <label className="flex items-center gap-2 text-xs font-bold text-amber-900 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ignoreDuplicates}
                      onChange={(e) => setIgnoreDuplicates(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>Tetap simpan sebagai produk baru (abaikan duplikasi)</span>
                  </label>
                </div>
              )}

              {/* Harga & Platform */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Harga Produk */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-black uppercase tracking-wider text-zinc-700">
                      Harga Produk (Rp)
                    </label>
                    {scanResult?.confidence?.productPrice && (
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                          scanResult.confidence.productPrice === 'HIGH'
                            ? 'bg-emerald-100 text-emerald-800'
                            : scanResult.confidence.productPrice === 'MEDIUM'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        Confidence: {scanResult.confidence.productPrice}
                      </span>
                    )}
                  </div>
                  <CurrencyInput
                    value={productPrice}
                    onChange={(val) => setProductPrice(val)}
                    placeholder="Rp 0"
                    className="w-full rounded-2xl border border-zinc-300 px-4 py-2.5 text-xs sm:text-sm font-bold text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  {productPrice > 0 && (
                    <span className="text-[11px] text-emerald-600 font-bold block mt-1">
                      {formatRupiah(productPrice)}
                    </span>
                  )}
                </div>

                {/* Platform */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-black uppercase tracking-wider text-zinc-700">
                      Platform Marketplace
                    </label>
                    {scanResult?.confidence?.platform && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-zinc-100 text-zinc-700">
                        {scanResult.confidence.platform}
                      </span>
                    )}
                  </div>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value as any)}
                    className="w-full rounded-2xl border border-zinc-300 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="TikTok">TikTok Shop</option>
                    <option value="Shopee">Shopee</option>
                    <option value="MANUAL">Lainnya / Manual Selection</option>
                  </select>
                </div>
              </div>

              {/* Kategori & Scope */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-zinc-700 mb-1">
                    Kategori Produk
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-300 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {activeCategoryOptions.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-zinc-700 mb-1">
                    Scope Visibilitas
                  </label>
                  {canChooseScope ? (
                    <select
                      value={scope}
                      onChange={(e) => setScope(e.target.value as ScopeType)}
                      className="w-full rounded-2xl border border-zinc-300 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="PRIBADI">PRIBADI (Internal Owner)</option>
                      <option value="SHARING">SHARING (Investor Visible)</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      disabled
                      value={scope}
                      className="w-full rounded-2xl border border-zinc-200 bg-zinc-100 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-zinc-500"
                    />
                  )}
                </div>
              </div>

              {/* Komisi Affiliate (Manual Input / Kept Empty by Default) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-zinc-700 mb-1">
                    Komisi Affiliate (%) <span className="text-zinc-400 font-normal text-[11px]">(Manual)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      placeholder="Input manual (misal: 10)"
                      value={commissionRate}
                      onChange={(e) => setCommissionRate(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full rounded-2xl border border-zinc-300 pl-4 pr-9 py-2.5 text-xs sm:text-sm font-bold text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <Percent className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  </div>
                  <span className="text-[10px] text-zinc-400 block mt-1">
                    AI dilarang menentukan komisi real secara otomatis.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-zinc-700 mb-1">
                    Link Produk / Toko (Opsional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://vt.tiktok.com/... atau https://shop.tiktok.com/..."
                    value={productUrl}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-300 px-4 py-2.5 text-xs sm:text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Akun TikTok / Medsos Terkait */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-700 mb-1.5">
                  Akun TikTok yang Mempromosikan (Bisa Pilih Banyak)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-2xl border border-zinc-200 p-3 bg-zinc-50 max-h-32 overflow-y-auto">
                  {accounts.map((acc) => {
                    const isSelected = selectedAccountIds.includes(acc.id || '');
                    return (
                      <label
                        key={acc.id}
                        className={`flex items-center gap-2 rounded-xl p-2 text-xs font-bold cursor-pointer border transition-all ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                            : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const accId = acc.id || '';
                            if (e.target.checked) {
                              setSelectedAccountIds([...selectedAccountIds, accId]);
                            } else {
                              setSelectedAccountIds(selectedAccountIds.filter((id) => id !== accId));
                            }
                          }}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="truncate">{acc.accountName}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Catatan / Varian */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-700 mb-1">
                  Catatan Tambahan / Varian
                </label>
                <textarea
                  rows={2}
                  placeholder="Varian, ukuran, atau catatan khusus lainnya..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-2xl border border-zinc-300 px-4 py-2 text-xs sm:text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setStep('UPLOAD')}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  ← Scan Ulang
                </button>

                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
                  >
                    Batal
                  </button>

                  {onScanExtracted && scanResult && (
                    <button
                      type="button"
                      onClick={() => {
                        const finalImage = activeImageChoice === 'CROPPED' && croppedPreview ? croppedPreview : (filePreview || '');
                        onScanExtracted({
                          ...scanResult,
                          productName: productName,
                          productPrice: Number(productPrice) || 0,
                          productUrl: productUrl,
                          platform: platform,
                          category: category,
                          productImageUrl: finalImage,
                        });
                        onClose();
                      }}
                      className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all cursor-pointer"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>[ 📝 LANJUTKAN KE FORMULIR INPUT ]</span>
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting || (duplicates.length > 0 && !ignoreDuplicates)}
                    className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-2.5 text-xs font-black text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>MENYIMPAN...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>SIMPAN KE MASTER PRODUK</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* STEP 4: SUCCESS OPTION (POST-SAVE) */}
          {/* ========================================================================= */}
          {step === 'SUCCESS' && createdProduct && (
            <div className="py-6 text-center space-y-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-10 w-10" />
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">
                  BERHASIL DISIMPAN
                </span>
                <h4 className="text-lg font-black text-zinc-900 pt-1">
                  {createdProduct.productName}
                </h4>
                <p className="text-xs text-zinc-500 max-w-md mx-auto">
                  Produk telah masuk ke katalog Master Produk dengan harga {formatRupiah(createdProduct.productPrice)}.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 max-w-md mx-auto">
                <button
                  type="button"
                  onClick={() => {
                    onProductCreated(createdProduct, true);
                    onClose();
                  }}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3.5 text-xs font-black text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 transition-all cursor-pointer"
                >
                  <Package className="h-4 w-4" />
                  <span>+ BELI SAMPEL DARI PRODUK INI</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  <Check className="h-4 w-4" />
                  <span>SELESAI / LIHAT KATALOG</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
