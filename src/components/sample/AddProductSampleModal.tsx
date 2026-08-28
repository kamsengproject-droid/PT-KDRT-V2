import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Package,
  ShoppingBag,
  Upload,
  Camera,
  Image as ImageIcon,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  DollarSign,
  Layers,
  User,
  Film,
  Check,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { Product, AffiliateSample, Account, Employee, ScopeType, SampleStatus } from '../../types';
import { createProduct, uploadProductPhoto } from '../../services/productService';
import { createSample } from '../../services/sampleService';
import { CurrencyInput } from '../CurrencyInput';
import { formatRupiah, tanggalHariIni } from '../../utils/formatters';
import { compressImageFile } from '../../utils/imageCompressor';

interface AddProductSampleModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts?: Account[];
  employees: Employee[];
  existingProducts: Product[];
  currentUserId: string;
  currentUserName: string;
  defaultScope: ScopeType;
  canChooseScope: boolean;
  onSaved: (result: { product: Product; sample?: AffiliateSample }) => void;
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

export const AddProductSampleModal: React.FC<AddProductSampleModalProps> = ({
  isOpen,
  onClose,
  accounts = [],
  employees,
  existingProducts,
  currentUserId,
  currentUserName,
  defaultScope,
  canChooseScope,
  onSaved,
}) => {
  const activeCategoryOptions = canChooseScope ? MASTER_KATEGORI_OPTIONS : EMPLOYEE_KATEGORI_OPTIONS;

  // FORM FIELDS
  const [productName, setProductName] = useState<string>('');
  const [productImage, setProductImage] = useState<string>('');
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string>(canChooseScope ? 'Skincare & Kecantikan' : 'Fashion Kaos');
  const [productPrice, setProductPrice] = useState<number | ''>('');
  const [samplePrice, setSamplePrice] = useState<number | ''>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [receivedDate, setReceivedDate] = useState<string>(tanggalHariIni());
  const [assignedEmployeeId, setAssignedEmployeeId] = useState<string>('');
  const [targetContent, setTargetContent] = useState<number>(3);
  const [notes, setNotes] = useState<string>('');
  const [size, setSize] = useState<string>('');
  const [scope, setScope] = useState<ScopeType>(canChooseScope ? defaultScope : 'SHARING');

  // DUPLICATE CHECK & RESOLUTION
  const [matchingProduct, setMatchingProduct] = useState<Product | null>(null);
  const [useExistingProduct, setUseExistingProduct] = useState<boolean>(false);

  // SUBMIT STATES
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize or Reset Form
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setIsSubmitting(false);
      setUseExistingProduct(false);
      setMatchingProduct(null);

      // Clean Form Initial States
      setProductName('');
      setProductImage('');
      setSelectedPhotoFile(null);
      setCategory(canChooseScope ? 'Skincare & Kecantikan' : 'Fashion Kaos');
      setProductPrice('');
      setSamplePrice('');
      setQuantity(1);
      setReceivedDate(tanggalHariIni());
      setTargetContent(3);
      setNotes('');
      setSize('');
      // Non-owner (Desta/Melinda/Employee) is ALWAYS SHARING
      setScope(canChooseScope ? defaultScope : 'SHARING');

      // Auto-assign PIC if current logged in user is Melinda or Desta or matches employee record
      const lowerName = (currentUserName || '').toLowerCase();
      const matchedEmp = employees.find(
        (e) =>
          e.userId === currentUserId ||
          e.id === currentUserId ||
          (e.name && (lowerName.includes(e.name.toLowerCase()) || e.name.toLowerCase().includes(lowerName)))
      );

      if (matchedEmp) {
        setAssignedEmployeeId(matchedEmp.id);
      } else if (employees.length > 0) {
        setAssignedEmployeeId(employees[0].id);
      } else {
        setAssignedEmployeeId('');
      }
    }
  }, [isOpen, defaultScope, canChooseScope, employees, currentUserId, currentUserName]);

  // Synchronize sample price with product price if not manually diverged
  const handleProductPriceChange = (val: number) => {
    setProductPrice(val);
    if (!samplePrice || samplePrice === productPrice) {
      setSamplePrice(val);
    }
  };

  // Real-time duplicate check
  useEffect(() => {
    if (!productName.trim()) {
      setMatchingProduct(null);
      setUseExistingProduct(false);
      return;
    }

    const cleanInputName = productName.trim().toLowerCase();

    const match = existingProducts.find((p) => {
      const pName = (p.productName || '').trim().toLowerCase();
      return pName === cleanInputName && cleanInputName.length > 2;
    });

    if (match) {
      setMatchingProduct(match);
    } else {
      setMatchingProduct(null);
      setUseExistingProduct(false);
    }
  }, [productName, existingProducts]);

  // Image Upload & Camera Handler with Lightweight Compression
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Mohon pilih file gambar JPG, PNG, atau WebP.');
      return;
    }

    try {
      // Compress lightly on the client side (max 1000px, 0.82 quality)
      const compressed = await compressImageFile(file, 1000, 1000, 0.82);
      const compressedFile = new File(
        [compressed.blob],
        `sample_${Date.now()}.jpg`,
        { type: compressed.mimeType }
      );
      setSelectedPhotoFile(compressedFile);
      setProductImage(compressed.dataUrl);
    } catch (err) {
      console.warn('Kompresi foto gagal, menggunakan file asli:', err);
      setSelectedPhotoFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result) {
          setProductImage(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    } finally {
      // Reset input value so the same file or re-capture can be selected
      e.target.value = '';
    }
  };

  // Calculated Total Belanja Sampel = Harga Sampel × Qty
  const numericSamplePrice = Number(samplePrice) || 0;
  const numericQty = Math.max(1, Number(quantity) || 1);
  const totalBelanjaSampel = numericSamplePrice * numericQty;

  // Single Save Handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!productName.trim()) {
      setErrorMessage('Nama Produk wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalProductId = '';
      let savedProduct: Product;
      const finalScope: ScopeType = canChooseScope ? scope : 'SHARING';

      // 0. UPLOAD PHOTO TO FIREBASE STORAGE ONCE (IF FILE SELECTED)
      let finalPhotoUrl = productImage && !productImage.startsWith('data:') ? productImage : '';
      let photoStoragePath = '';
      let photoSizeBytes = 0;
      let photoMimeType = '';
      let photoWidth = 0;
      let photoHeight = 0;

      if (selectedPhotoFile) {
        try {
          const tempId = 'sample_prod_' + Date.now();
          const uploaded = await uploadProductPhoto(selectedPhotoFile, tempId);
          finalPhotoUrl = uploaded.photoUrl;
          photoStoragePath = uploaded.storagePath;
          photoSizeBytes = uploaded.photoSizeBytes;
          photoMimeType = uploaded.photoMimeType;
          photoWidth = uploaded.photoWidth;
          photoHeight = uploaded.photoHeight;
        } catch (uploadErr: any) {
          console.warn('Gagal upload ke Firebase Storage, simpan tanpa foto:', uploadErr);
        }
      }

      // 1. PRODUCT RESOLUTION: Existing vs New Master Product
      if (useExistingProduct && matchingProduct?.id) {
        finalProductId = matchingProduct.id;
        savedProduct = matchingProduct;
      } else {
        // Create new Master Product record
        const productPayload: Omit<Product, 'id' | 'productId' | 'createdAt' | 'updatedAt'> = {
          productName: productName.trim(),
          productPrice: Number(productPrice) || 0,
          productUrl: '',
          productImage: finalPhotoUrl || '',
          photoUrl: finalPhotoUrl || '',
          photoStoragePath: photoStoragePath || '',
          photoSizeBytes: photoSizeBytes || undefined,
          photoMimeType: photoMimeType || undefined,
          photoWidth: photoWidth || undefined,
          photoHeight: photoHeight || undefined,
          category,
          commissionRate: 10,
          scope: finalScope,
          status: 'AKTIF',
          notes: notes.trim(),
          accountIds: [],
          createdBy: currentUserId,
          createdByName: currentUserName,
        };

        finalProductId = await createProduct(
          productPayload,
          null, // Already uploaded to Firebase Storage
          currentUserId,
          currentUserName
        );

        savedProduct = {
          id: finalProductId,
          productId: finalProductId,
          ...productPayload,
        };
      }

      // 2. SAMPLE RECORD CREATION: Status is always 'DITERIMA' (sudah diterima di kantor)
      const assignedEmp = employees.find((e) => e.id === assignedEmployeeId);

      const samplePayload: Omit<AffiliateSample, 'id' | 'sampleId' | 'createdAt' | 'updatedAt'> = {
        productId: finalProductId,
        productName: productName.trim(),
        productUrl: '',
        productImage: finalPhotoUrl || '',
        samplePrice: numericSamplePrice,
        quantity: numericQty,
        totalCost: totalBelanjaSampel,
        purchaseDate: receivedDate || tanggalHariIni(),
        employeeId: assignedEmployeeId || '',
        employeeName: assignedEmp?.name || '',
        accountId: '',
        accountName: '',
        targetContent: Number(targetContent) || 3,
        completedContent: 0,
        unitContent: 'VT',
        size: size.trim(),
        status: 'DITERIMA', // Sampel yang diinput = SUDAH DITERIMA
        scope: finalScope,  // Desta/Melinda otomatis SHARING
        notes: notes.trim(),
        createdBy: currentUserId,
        createdByName: currentUserName,
      };

      const sampleId = await createSample(
        samplePayload,
        true, // Auto record financial expense as operational sample expense
        true,  // Auto create daily task for PIC talent
        currentUserId,
        currentUserName
      );

      const savedSample: AffiliateSample = {
        id: sampleId,
        sampleId,
        ...samplePayload,
      };

      // Trigger success callback & close
      onSaved({ product: savedProduct, sample: savedSample });
      onClose();
    } catch (err: any) {
      console.error('[SAVE_SAMPLE_ERROR]', err);
      setErrorMessage(err.message || 'Gagal menyimpan data sampel.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-3xl bg-white text-zinc-900 shadow-2xl border border-zinc-200 overflow-hidden my-auto max-h-[94vh] flex flex-col animate-in fade-in zoom-in duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 bg-zinc-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight">
                TAMBAH SAMPEL
              </h3>
              <p className="text-xs text-zinc-400">
                Formulir input sampel produk kantor (Otomatis berstatus Diterima)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* Error Message */}
          {errorMessage && (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs font-bold text-rose-800 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* DUPLICATE WARNING BOX */}
          {matchingProduct && (
            <div className="rounded-2xl bg-amber-50 border-2 border-amber-300 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-900">
                    ⚠️ Produk Serupa Sudah Ada di Database!
                  </h4>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Ditemukan produk: <strong className="text-zinc-900 font-extrabold">{matchingProduct.productName}</strong> ({formatRupiah(matchingProduct.productPrice || 0)}).
                  </p>
                </div>
              </div>

              {/* Action Choices for Duplicates */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200/80">
                <button
                  type="button"
                  onClick={() => setUseExistingProduct(true)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    useExistingProduct
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-white text-zinc-700 border border-amber-300 hover:bg-amber-100'
                  }`}
                >
                  <Check className="h-4 w-4" />
                  <span>[ Gunakan Produk Existing ]</span>
                </button>

                <button
                  type="button"
                  onClick={() => setUseExistingProduct(false)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    !useExistingProduct
                      ? 'bg-zinc-800 text-white shadow-md'
                      : 'bg-white text-zinc-700 border border-amber-300 hover:bg-amber-100'
                  }`}
                >
                  <span>[ Tetap Buat Produk Baru ]</span>
                </button>
              </div>

              {useExistingProduct && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 text-[11px] font-bold text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Sampel akan dihubungkan ke Master Produk ID: {matchingProduct.id}.</span>
                </div>
              )}
            </div>
          )}

          {/* 1. NAMA PRODUK */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1">
              Nama Produk <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Contoh: Skintific 5X Ceramide Barrier Moisture Gel 30g"
              className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-xs font-bold text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* 2. FOTO PRODUK */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-700">
              Foto Produk
            </label>

            {/* Hidden Input Elements for Direct Camera (Environment/Rear) and Gallery */}
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              onChange={handleImageFileChange}
              className="hidden"
            />
            <input
              type="file"
              ref={galleryInputRef}
              accept="image/*"
              onChange={handleImageFileChange}
              className="hidden"
            />

            {!productImage ? (
              /* State 1: Belum Ada Foto - Dua Pilihan (Kamera Langsung & Galeri) */
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 rounded-2xl border-2 border-emerald-500 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 p-3 text-xs font-black transition-all cursor-pointer shadow-xs min-h-[48px] active:scale-98"
                  >
                    <Camera className="h-4 w-4 text-emerald-700 shrink-0" />
                    <span>[ 📷 AMBIL FOTO LANGSUNG ]</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-800 p-3 text-xs font-black transition-all cursor-pointer shadow-xs min-h-[48px] active:scale-98"
                  >
                    <ImageIcon className="h-4 w-4 text-zinc-600 shrink-0" />
                    <span>[ 🖼️ PILIH DARI GALERI ]</span>
                  </button>
                </div>

                {/* Optional URL Input Fallback */}
                <div className="pt-1">
                  <input
                    type="text"
                    value={productImage}
                    onChange={(e) => setProductImage(e.target.value)}
                    placeholder="Atau tempel URL gambar jika ada..."
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50/70 px-3 py-2 text-xs text-zinc-700 placeholder:text-zinc-400 focus:border-emerald-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
            ) : (
              /* State 2: Preview Foto dengan Kontrol Ganti & Hapus */
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-3.5 flex flex-col sm:flex-row items-center gap-4">
                <div className="relative h-20 w-20 rounded-xl overflow-hidden border border-zinc-300 bg-zinc-200 shrink-0 shadow-xs">
                  <img
                    src={productImage}
                    alt="Preview Produk"
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="flex-1 text-center sm:text-left space-y-1.5 w-full">
                  <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-bold text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Foto Siap Disimpan</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 font-medium">
                    Foto terkompresi otomatis & akan diunggah ke Storage saat disimpan.
                  </p>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-900 text-xs font-bold hover:bg-emerald-100 transition-colors cursor-pointer min-h-[36px]"
                    >
                      <Camera className="h-3.5 w-3.5 text-emerald-700" />
                      <span>[ Ambil Ulang ]</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-zinc-300 bg-white text-zinc-800 text-xs font-bold hover:bg-zinc-100 transition-colors cursor-pointer min-h-[36px]"
                    >
                      <ImageIcon className="h-3.5 w-3.5 text-zinc-600" />
                      <span>[ Galeri ]</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setProductImage('');
                        setSelectedPhotoFile(null);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 transition-colors cursor-pointer min-h-[36px]"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                      <span>[ Hapus ]</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3. KATEGORI & HARGA PRODUK */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                Kategori
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-xs font-bold text-zinc-900 focus:border-emerald-500 focus:outline-none"
              >
                {activeCategoryOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                Harga Produk (Katalog)
              </label>
              <CurrencyInput
                value={productPrice === '' ? 0 : Number(productPrice)}
                onChange={handleProductPriceChange}
                placeholder="Rp 0"
                className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-xs font-black text-zinc-900 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* 4. HARGA SAMPEL & QTY */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                Harga Sampel <span className="text-rose-500">*</span>
              </label>
              <CurrencyInput
                value={samplePrice === '' ? 0 : Number(samplePrice)}
                onChange={(val) => setSamplePrice(val)}
                placeholder="Rp 0"
                className="w-full rounded-xl border border-emerald-300 bg-white px-3.5 py-2.5 text-xs font-black text-zinc-900 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                Qty <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                className="w-full rounded-xl border border-emerald-300 bg-white px-3.5 py-2.5 text-xs font-black text-zinc-900 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* 4b. SIZE / UKURAN (opsional, free text) */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1">
              Size / Ukuran
            </label>
            <input
              type="text"
              data-testid="add-sample-size-input"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              placeholder="Contoh: S, M, L, XL, XXL, 3XL, All Size, 42 (boleh kosong)"
              className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-xs font-bold text-zinc-900 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* 5. TANGGAL DITERIMA, PIC & TARGET VT */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                Tanggal Diterima
              </label>
              <input
                type="date"
                required
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-xs font-bold text-zinc-900 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                PIC
              </label>
              <select
                value={assignedEmployeeId}
                onChange={(e) => setAssignedEmployeeId(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-xs font-bold text-zinc-900 focus:border-emerald-500 focus:outline-none"
              >
                <option value="">-- Pilih PIC --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.position})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                Target VT
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  value={targetContent}
                  onChange={(e) => setTargetContent(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-xs font-black text-zinc-900 focus:border-emerald-500 focus:outline-none"
                />
                <span className="absolute right-3.5 top-2.5 text-xs font-bold text-zinc-400">VT</span>
              </div>
            </div>
          </div>

          {/* 6. SCOPE (OWNER ONLY) */}
          {canChooseScope && (
            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                Scope Bisnis
              </label>
              <div className="flex gap-2 max-w-xs">
                <button
                  type="button"
                  onClick={() => setScope('SHARING')}
                  className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    scope === 'SHARING'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-100'
                  }`}
                >
                  SHARING
                </button>
                <button
                  type="button"
                  onClick={() => setScope('PRIBADI')}
                  className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    scope === 'PRIBADI'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-100'
                  }`}
                >
                  PRIBADI
                </button>
              </div>
            </div>
          )}

          {/* 7. CATATAN */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1">
              CATATAN
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tambahkan catatan jika diperlukan..."
              className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-xs font-medium text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* 8. TOTAL BELANJA SAMPEL */}
          <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/70 p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-900">
                TOTAL BELANJA SAMPEL
              </span>
              <p className="text-xs text-emerald-700 font-medium">
                Dihitung otomatis: Harga Sampel ({formatRupiah(numericSamplePrice)}) × {numericQty} pcs
              </p>
            </div>
            <div className="text-right">
              <span className="text-lg sm:text-xl font-black text-emerald-950">
                {formatRupiah(totalBelanjaSampel)}
              </span>
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="border-t border-zinc-200 px-6 py-4 bg-zinc-50 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            [ BATAL ]
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-6 py-2.5 text-xs font-black shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Menyimpan Sampel...</span>
            ) : (
              <>
                <Check className="h-4 w-4 stroke-[3]" />
                <span>[ SIMPAN SAMPEL ]</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

