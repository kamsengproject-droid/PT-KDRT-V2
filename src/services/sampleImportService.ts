import * as XLSX from 'xlsx';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  setDoc,
  serverTimestamp,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  AffiliateSample,
  SpreadsheetSampleRow,
  ImportRowValidationStatus,
  DuplicateAction,
  SampleImportLog,
  ScopeType,
  SampleStatus,
} from '../types';
import { catatAuditLog } from './auditService';
import { createSample, updateSample, SAMPLES_COLLECTION } from './sampleService';
import { tanggalHariIni, formatRupiah } from '../utils/formatters';

export const SAMPLE_IMPORT_LOGS_COLLECTION = 'sampleImportLogs';

/**
 * Normalisasi format mata uang / angka dari string spreadsheet
 * Mendukung: "Rp79.899", "79.899", "79,899", "79899", "Rp 79.899", 79899, dll
 */
export function parseCurrencyOrNumber(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : Math.round(val);
  }
  const str = String(val).trim();
  if (!str) return 0;

  // Bersihkan format "Rp", "IDR", spasi
  let clean = str.replace(/^(rp|idr)\.?\s*/i, '').trim();

  // Pola ribuan titik Indonesia: 79.899 atau 1.250.000
  if (/^\d{1,3}(\.\d{3})+$/.test(clean)) {
    clean = clean.replace(/\./g, '');
  } else if (/^\d{1,3}(,\d{3})+$/.test(clean)) {
    // Pola ribuan koma
    clean = clean.replace(/,/g, '');
  } else if (/^\d+(\.\d{1,2})$/.test(clean)) {
    // Pola desimal titik biasa: 79899.50
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : Math.round(parsed);
  } else {
    // Hapus semua karakter non-angka
    clean = clean.replace(/[^\d-]/g, '');
  }

  const num = Number(clean);
  return isNaN(num) ? 0 : num;
}

/**
 * Parsing Nomor Pesanan sebagai STRING murni
 * Mencegah nomor pesanan panjang berubah menjadi scientific notation e+17 atau floating round
 */
export function parseOrderNumberString(rawVal: any, formattedCellText?: string): string {
  if (formattedCellText && String(formattedCellText).trim()) {
    const formattedStr = String(formattedCellText).trim();
    if (!formattedStr.includes('e+') && !formattedStr.includes('E+')) {
      return formattedStr;
    }
  }

  if (rawVal === null || rawVal === undefined) return '';
  const str = String(rawVal).trim();
  if (!str) return '';

  // Jika string mengandung scientific notation (misal: 5.853238617549392e+17)
  if (/^[\d.]+[eE]\+\d+$/.test(str) && typeof rawVal === 'number') {
    try {
      return BigInt(Math.floor(rawVal)).toString();
    } catch {
      return str;
    }
  }

  return str;
}

/**
 * Normalisasi Metode Pembayaran
 * Standar: DANA, COD, TRANSFER, PAYLATER
 */
export function normalizePaymentMethod(rawVal: any): { normalized: string; raw: string } {
  const raw = String(rawVal || '').trim();
  if (!raw) {
    return { normalized: 'LAINNYA', raw: '' };
  }

  const lower = raw.toLowerCase();

  if (lower.includes('dana')) {
    return { normalized: 'DANA', raw };
  }

  if (
    lower === 'cod' ||
    lower.includes('cash on delivery') ||
    lower.includes('bayar di tempat') ||
    lower.includes('bayar ditempat')
  ) {
    return { normalized: 'COD', raw };
  }

  if (
    lower.includes('transfer') ||
    lower.includes('bca') ||
    lower.includes('bri') ||
    lower.includes('bni') ||
    lower.includes('mandiri') ||
    lower.includes('seabank') ||
    lower.includes('bsi') ||
    lower.includes('bank')
  ) {
    return { normalized: 'TRANSFER', raw };
  }

  if (
    lower.includes('paylater') ||
    lower.includes('spaylater') ||
    lower.includes('tiktok paylater') ||
    lower.includes('shopeepaylater') ||
    lower.includes('gopaylater') ||
    lower.includes('pay later')
  ) {
    return { normalized: 'PAYLATER', raw };
  }

  return { normalized: raw.toUpperCase(), raw };
}

/**
 * Normalisasi Header Spreadsheet agar tahan variasi penulisan
 */
export function matchHeaderKey(rawHeader: string): string | null {
  if (!rawHeader) return null;
  const clean = rawHeader
    .toLowerCase()
    .replace(/[._\-\/\\()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 1. Nomor Urut
  if (['no', 'no.', 'nomor', 'seq', 'sequence', 'no urut', 'urutan'].includes(clean)) {
    return 'sequenceNumber';
  }

  // 2. Seller / Nama Toko
  if (['seller', 'nama seller', 'toko', 'nama toko', 'seller name', 'penjual', 'store', 'shop'].includes(clean)) {
    return 'sellerName';
  }

  // 3. Nama Produk
  if (
    [
      'nama produk',
      'produk',
      'product',
      'product name',
      'nama barang',
      'barang',
      'item',
      'nama item',
      'judul produk',
    ].includes(clean)
  ) {
    return 'productName';
  }

  // 4. Warna
  if (['warna', 'color', 'colour', 'varian warna', 'warna produk', 'variant warna'].includes(clean)) {
    return 'color';
  }

  // 5. Ukuran
  if (['ukuran', 'size', 'varian ukuran', 'dimensi', 'size produk', 'variant size'].includes(clean)) {
    return 'size';
  }

  // 6. Harga Produk
  if (['harga produk', 'harga', 'product price', 'harga satuan', 'price', 'unit price', 'harga barang'].includes(clean)) {
    return 'productPrice';
  }

  // 7. Biaya Ongkir
  if (
    [
      'biaya ongkir',
      'ongkir',
      'shipping cost',
      'shipping',
      'biaya kirim',
      'ongkos kirim',
      'ongkos pengiriman',
      'biaya pengiriman',
    ].includes(clean)
  ) {
    return 'shippingCost';
  }

  // 8. Diskon / Voucher
  if (
    [
      'diskon voucher',
      'diskon/voucher',
      'diskon',
      'voucher',
      'discount',
      'potongan',
      'promo',
      'diskon potongan',
      'voucher diskon',
    ].includes(clean)
  ) {
    return 'discount';
  }

  // 9. Total Bayar
  if (
    [
      'total bayar',
      'total',
      'total pembayaran',
      'total paid',
      'grand total',
      'total harga',
      'jumlah bayar',
      'total belanja',
    ].includes(clean)
  ) {
    return 'totalPaid';
  }

  // 10. Nomor Pesanan
  if (
    [
      'no pesanan',
      'no. pesanan',
      'nomor pesanan',
      'order number',
      'order id',
      'no order',
      'nomor order',
      'no orderan',
      'pesanan',
      'order no',
    ].includes(clean)
  ) {
    return 'orderNumber';
  }

  // 11. Metode Pembayaran
  if (
    [
      'metode pembayaran',
      'pembayaran',
      'payment method',
      'payment',
      'metode bayar',
      'tipe bayar',
      'cara bayar',
      'opsi pembayaran',
    ].includes(clean)
  ) {
    return 'paymentMethod';
  }

  return null;
}

export interface ParsedWorksheetResult {
  sheetName: string;
  allSheetNames: string[];
  headers: string[];
  mappedHeaderKeys: Record<string, string>; // column -> matched key
  rows: SpreadsheetSampleRow[];
  totalRows: number;
  validCount: number;
  warningCount: number;
  needsReviewCount: number;
  duplicateCount: number;
  errorCount: number;
}

/**
 * Membaca & Memvalidasi File Excel Spreadsheet
 */
export async function parseSpreadsheetBuffer(
  buffer: ArrayBuffer,
  existingSamples: AffiliateSample[],
  targetSheetName?: string
): Promise<ParsedWorksheetResult> {
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
    cellText: true,
    raw: true,
  });

  const allSheetNames = workbook.SheetNames;
  const sheetName = targetSheetName && allSheetNames.includes(targetSheetName)
    ? targetSheetName
    : allSheetNames[0];

  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error(`Worksheet "${sheetName}" tidak ditemukan di file spreadsheet.`);
  }

  // Convert worksheet to array of arrays
  const rawMatrix: any[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    raw: false, // get formatted text
  });

  if (!rawMatrix || rawMatrix.length === 0) {
    throw new Error('Spreadsheet kosong atau tidak memiliki data.');
  }

  // Deteksi Baris Header (cari baris pertama yang memiliki kata kunci seperti seller, produk, total, no pesanan)
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(rawMatrix.length, 10); i++) {
    const row = rawMatrix[i];
    if (!row || !Array.isArray(row)) continue;
    const matchCount = row.filter((cell) => matchHeaderKey(String(cell))).length;
    if (matchCount >= 2) {
      headerRowIndex = i;
      break;
    }
  }

  const rawHeaders = (rawMatrix[headerRowIndex] || []).map((h) => String(h || '').trim());
  const mappedHeaderKeys: Record<number, string> = {};

  rawHeaders.forEach((headerText, colIndex) => {
    const matched = matchHeaderKey(headerText);
    if (matched) {
      mappedHeaderKeys[colIndex] = matched;
    }
  });

  // Map order numbers existing for O(1) duplicate checks
  const existingOrderNumberMap = new Map<string, AffiliateSample>();
  existingSamples.forEach((s) => {
    if (s.orderNumber && String(s.orderNumber).trim()) {
      existingOrderNumberMap.set(String(s.orderNumber).trim().toLowerCase(), s);
    }
  });

  const parsedRows: SpreadsheetSampleRow[] = [];

  // Loop data baris setelah header
  for (let r = headerRowIndex + 1; r < rawMatrix.length; r++) {
    const rawRow = rawMatrix[r];
    if (!rawRow || !Array.isArray(rawRow)) continue;

    // Cek jika seluruh baris kosong
    const isAllEmpty = rawRow.every((c) => c === '' || c === null || c === undefined);
    if (isAllEmpty) continue;

    const rowObj: Record<string, any> = {};
    rawRow.forEach((cellVal, colIdx) => {
      const fieldKey = mappedHeaderKeys[colIdx];
      if (fieldKey) {
        rowObj[fieldKey] = cellVal;
      }
    });

    const rowNumber = r + 1;
    const sequenceNumber = parseCurrencyOrNumber(rowObj.sequenceNumber) || parsedRows.length + 1;

    const sellerName = String(rowObj.sellerName || '').trim();
    const productName = String(rowObj.productName || '').trim();
    const color = String(rowObj.color || '').trim();
    const size = String(rowObj.size || '').trim();

    const productPrice = parseCurrencyOrNumber(rowObj.productPrice);
    const shippingCost = parseCurrencyOrNumber(rowObj.shippingCost);
    const discount = parseCurrencyOrNumber(rowObj.discount);
    const totalPaid = parseCurrencyOrNumber(rowObj.totalPaid);

    const orderNumber = parseOrderNumberString(rowObj.orderNumber);
    const paymentInfo = normalizePaymentMethod(rowObj.paymentMethod);

    const validationIssues: string[] = [];
    let status: ImportRowValidationStatus = 'VALID';

    // 1. Validasi Kolom Wajib (ERROR)
    if (!sellerName) {
      validationIssues.push('Nama Seller wajib diisi.');
      status = 'ERROR';
    }
    if (!productName) {
      validationIssues.push('Nama Produk wajib diisi.');
      status = 'ERROR';
    }
    if (!orderNumber) {
      validationIssues.push('Nomor Pesanan wajib diisi.');
      status = 'ERROR';
    }
    if (totalPaid <= 0 && productPrice <= 0) {
      validationIssues.push('Total Bayar atau Harga Produk harus lebih dari 0.');
      status = 'ERROR';
    }

    // 2. Validasi Kalkulasi Harga & Ongkir
    if (status !== 'ERROR') {
      const hasExplicitOngkirOrDiscount = rowObj.shippingCost !== undefined && String(rowObj.shippingCost).trim() !== '' ||
        rowObj.discount !== undefined && String(rowObj.discount).trim() !== '';

      if (hasExplicitOngkirOrDiscount) {
        const expectedTotal = productPrice + shippingCost - discount;
        if (Math.abs(expectedTotal - totalPaid) > 1) {
          status = 'NEEDS_REVIEW';
          validationIssues.push(
            `Kalkulasi selisih: Harga (Rp ${productPrice.toLocaleString('id-ID')}) + Ongkir (Rp ${shippingCost.toLocaleString('id-ID')}) - Diskon (Rp ${discount.toLocaleString('id-ID')}) = Rp ${expectedTotal.toLocaleString('id-ID')}, berbeda dengan Total Bayar Rp ${totalPaid.toLocaleString('id-ID')}.`
          );
        }
      } else {
        // Biaya ongkir belum tersedia eksplisit
        if (productPrice > 0 && totalPaid > 0 && productPrice !== totalPaid) {
          const diff = totalPaid - productPrice;
          status = 'NEEDS_REVIEW';
          validationIssues.push(
            `Biaya ongkir/diskon tidak tersedia eksplisit (Selisih Total Rp ${diff.toLocaleString('id-ID')}). Ditandai untuk dicek operator.`
          );
        }
      }
    }

    // 3. Validasi Peringatan (WARNING)
    const warnings: string[] = [];
    if (!size) {
      warnings.push('Ukuran/Size kosong');
    }
    if (!color) {
      warnings.push('Warna kosong');
    }
    if (paymentInfo.normalized === 'LAINNYA' || !paymentInfo.raw) {
      warnings.push('Metode pembayaran tidak terdeteksi spesifik');
    }

    if (status === 'VALID' && warnings.length > 0) {
      status = 'WARNING';
      validationIssues.push(...warnings);
    }

    // 4. Pengecekan Duplicate (orderNumber)
    let duplicateSampleId: string | undefined = undefined;
    let duplicateSampleName: string | undefined = undefined;
    let duplicateAction: DuplicateAction = 'SKIP';

    if (orderNumber) {
      const existing = existingOrderNumberMap.get(orderNumber.toLowerCase());
      if (existing) {
        status = 'DUPLICATE';
        duplicateSampleId = existing.id;
        duplicateSampleName = existing.productName;
        duplicateAction = 'SKIP'; // Default SKIP
        validationIssues.unshift(
          `Nomor Pesanan "${orderNumber}" sudah tercatat di database (Sampel: ${existing.productName}).`
        );
      }
    }

    parsedRows.push({
      rowNumber,
      sequenceNumber,
      sellerName,
      productName,
      color,
      size,
      productPrice,
      shippingCost,
      discount,
      totalPaid: totalPaid || productPrice,
      orderNumber,
      paymentMethod: paymentInfo.normalized,
      paymentMethodRaw: paymentInfo.raw,
      status,
      validationIssues,
      duplicateSampleId,
      duplicateSampleName,
      duplicateAction,
      rawRowData: rowObj,
    });
  }

  // Hitung agregat status
  let validCount = 0;
  let warningCount = 0;
  let needsReviewCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;

  parsedRows.forEach((r) => {
    if (r.status === 'VALID') validCount++;
    else if (r.status === 'WARNING') warningCount++;
    else if (r.status === 'NEEDS_REVIEW') needsReviewCount++;
    else if (r.status === 'DUPLICATE') duplicateCount++;
    else if (r.status === 'ERROR') errorCount++;
  });

  const mappedKeyReadable: Record<string, string> = {};
  Object.entries(mappedHeaderKeys).forEach(([colIdx, key]) => {
    mappedKeyReadable[rawHeaders[Number(colIdx)] || `Col_${colIdx}`] = key;
  });

  return {
    sheetName,
    allSheetNames,
    headers: rawHeaders,
    mappedHeaderKeys: mappedKeyReadable,
    rows: parsedRows,
    totalRows: parsedRows.length,
    validCount,
    warningCount,
    needsReviewCount,
    duplicateCount,
    errorCount,
  };
}

/**
 * Buat File Template Excel (.xlsx) Resmi PT KDRT
 */
export function generateSampleImportTemplate(): Blob {
  const headers = [
    'No',
    'Seller',
    'Nama Produk',
    'Warna',
    'Ukuran',
    'Harga Produk',
    'Biaya Ongkir',
    'Diskon/Voucher',
    'Total Bayar',
    'No Pesanan',
    'Metode Pembayaran',
  ];

  const sampleRows = [
    [
      1,
      'Zovee Official',
      'Zovee Kaos Oversize Wanita',
      'A-Hitam',
      '3XL',
      79899,
      12300,
      0,
      92199,
      '585323861754939211',
      'DANA',
    ],
    [
      2,
      'Batik Keraton Jogja',
      'Kemeja Batik Pria Lengan Panjang Slimfit',
      'Coklat Gold',
      'XL',
      125000,
      15000,
      10000,
      130000,
      '585323861754939212',
      'COD',
    ],
    [
      3,
      'Nisa Fashion Store',
      'Celana Kulot Linen Highwaist Premium',
      'Mocca',
      'All Size',
      68000,
      10000,
      5000,
      73000,
      '585323861754939213',
      'TRANSFER',
    ],
  ];

  const wsData = [headers, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = [
    { wch: 6 }, // No
    { wch: 22 }, // Seller
    { wch: 40 }, // Nama Produk
    { wch: 16 }, // Warna
    { wch: 12 }, // Ukuran
    { wch: 16 }, // Harga Produk
    { wch: 14 }, // Biaya Ongkir
    { wch: 16 }, // Diskon/Voucher
    { wch: 16 }, // Total Bayar
    { wch: 24 }, // No Pesanan
    { wch: 18 }, // Metode Pembayaran
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data Sampel');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export interface ExecuteImportOptions {
  rows: SpreadsheetSampleRow[];
  fileName: string;
  scope: ScopeType;
  accountId?: string;
  accountName?: string;
  employeeId?: string;
  employeeName?: string;
  statusSampel: SampleStatus;
  autoCreateExpense: boolean;
  autoCreateTask: boolean;
  currentUserId: string;
  currentUserName: string;
  onProgress?: (progressPercent: number, currentItemText: string) => void;
}

export interface ImportExecutionResult {
  batchId: string;
  total: number;
  successCount: number;
  duplicateSkippedCount: number;
  duplicateUpdatedCount: number;
  errorCount: number;
  errors: Array<{ rowNumber: number; orderNumber: string; productName: string; message: string }>;
  successIds: string[];
}

/**
 * Eksekusi Batch Import ke Firestore (Database Sampel PT KDRT V2)
 */
export async function executeSpreadsheetImport(
  options: ExecuteImportOptions
): Promise<ImportExecutionResult> {
  const {
    rows,
    fileName,
    scope,
    accountId,
    accountName,
    employeeId,
    employeeName,
    statusSampel,
    autoCreateExpense,
    autoCreateTask,
    currentUserId,
    currentUserName,
    onProgress,
  } = options;

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  const batchId = `IMPORT_${dateStr}_${randomSuffix}`;

  let successCount = 0;
  let duplicateSkippedCount = 0;
  let duplicateUpdatedCount = 0;
  let errorCount = 0;
  const errors: Array<{ rowNumber: number; orderNumber: string; productName: string; message: string }> = [];
  const successIds: string[] = [];

  const total = rows.length;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const progress = Math.round(((i + 1) / total) * 100);
    if (onProgress) {
      onProgress(progress, `Mengimpor [${i + 1}/${total}] ${row.productName}...`);
    }

    // Skip row jika ada error fatal validasi
    if (row.status === 'ERROR') {
      errorCount++;
      errors.push({
        rowNumber: row.rowNumber,
        orderNumber: row.orderNumber,
        productName: row.productName || 'Tanpa Nama',
        message: row.validationIssues.join('; ') || 'Data tidak lengkap.',
      });
      continue;
    }

    // Handle DUPLICATE
    if (row.status === 'DUPLICATE') {
      if (row.duplicateAction === 'SKIP') {
        duplicateSkippedCount++;
        continue;
      }

      if (row.duplicateAction === 'UPDATE' && row.duplicateSampleId) {
        try {
          const updatePayload: Partial<AffiliateSample> = {
            sellerName: row.sellerName,
            color: row.color || '',
            size: row.size || '',
            productPriceVal: row.productPrice,
            shippingCost: row.shippingCost,
            discount: row.discount,
            totalPaid: row.totalPaid,
            orderNumber: row.orderNumber,
            paymentMethod: row.paymentMethod,
            paymentMethodRaw: row.paymentMethodRaw,
            source: 'spreadsheet_import',
            importBatchId: batchId,
            importFileName: fileName,
            importedAt: serverTimestamp(),
            importedBy: currentUserId,
            importedByName: currentUserName,
          };

          const docRef = doc(db, SAMPLES_COLLECTION, row.duplicateSampleId);
          await updateDoc(docRef, updatePayload);
          duplicateUpdatedCount++;
          successIds.push(row.duplicateSampleId);
          continue;
        } catch (err: any) {
          errorCount++;
          errors.push({
            rowNumber: row.rowNumber,
            orderNumber: row.orderNumber,
            productName: row.productName,
            message: `Gagal mengupdate duplicate: ${err.message}`,
          });
          continue;
        }
      }
    }

    // Row Baru atau IMPORT_ANYWAY
    try {
      const samplePayload: any = {
        productId: '', // Linked into master product cleanly
        productName: row.productName,
        productUrl: '',
        productImage: '',
        samplePrice: row.productPrice || row.totalPaid,
        productPriceVal: row.productPrice,
        shippingCost: row.shippingCost,
        discount: row.discount,
        totalPaid: row.totalPaid,
        quantity: 1,
        totalCost: row.totalPaid || row.productPrice,
        status: statusSampel || 'DITERIMA',
        scope: scope || 'SHARING',
        purchaseDate: tanggalHariIni(),
        accountId: accountId || '',
        accountName: accountName || '',
        employeeId: employeeId || '',
        employeeName: employeeName || '',
        targetContent: 3,
        completedContent: 0,
        unitContent: 'VT',
        notes: `Import spreadsheet: ${fileName} (No. Pesanan: ${row.orderNumber})`,
        sellerName: row.sellerName,
        brandName: row.sellerName,
        size: row.size || '',
        color: row.color || '',
        orderNumber: row.orderNumber,
        paymentMethod: row.paymentMethod,
        paymentMethodRaw: row.paymentMethodRaw,
        sequenceNumber: row.sequenceNumber,
        source: 'spreadsheet_import',
        importBatchId: batchId,
        importFileName: fileName,
        importedAt: serverTimestamp(),
        importedBy: currentUserId,
        importedByName: currentUserName,
      };

      const newSampleId = await createSample(
        samplePayload,
        autoCreateExpense,
        autoCreateTask,
        currentUserId,
        currentUserName
      );

      successCount++;
      successIds.push(newSampleId);
    } catch (err: any) {
      errorCount++;
      errors.push({
        rowNumber: row.rowNumber,
        orderNumber: row.orderNumber,
        productName: row.productName,
        message: err.message || 'Gagal menyimpan ke database.',
      });
    }
  }

  // Simpan Log Import Batch ke Firestore
  const importLogPayload: SampleImportLog = {
    batchId,
    fileName,
    totalRows: total,
    successCount: successCount + duplicateUpdatedCount,
    duplicateCount: duplicateSkippedCount + duplicateUpdatedCount,
    warningCount: rows.filter((r) => r.status === 'WARNING').length,
    errorCount,
    importedBy: currentUserId,
    importedByName: currentUserName,
    importedAt: serverTimestamp(),
    status: errorCount === 0 ? 'SELESAI' : successCount > 0 ? 'SEBAGIAN' : 'GAGAL',
    scope,
    accountId,
    accountName,
    employeeId,
    employeeName,
    notes: `Batch ${batchId} - File: ${fileName}. Berhasil: ${successCount + duplicateUpdatedCount}, Skip Duplicate: ${duplicateSkippedCount}, Gagal: ${errorCount}`,
  };

  try {
    await addDoc(collection(db, SAMPLE_IMPORT_LOGS_COLLECTION), importLogPayload);
    await catatAuditLog(
      currentUserId,
      currentUserName,
      'SPREADSHEET_SAMPLE_IMPORTED',
      `Import Batch ${batchId}`,
      `File: ${fileName}, Total: ${total}, Sukses: ${successCount + duplicateUpdatedCount}, Skip: ${duplicateSkippedCount}, Error: ${errorCount}`
    );
  } catch (logErr) {
    console.warn('Gagal mencatat import log:', logErr);
  }

  return {
    batchId,
    total,
    successCount: successCount + duplicateUpdatedCount,
    duplicateSkippedCount,
    duplicateUpdatedCount,
    errorCount,
    errors,
    successIds,
  };
}

/**
 * Subscribe Import Logs History
 */
export function subscribeSampleImportLogs(
  callback: (logs: SampleImportLog[]) => void
) {
  const q = query(
    collection(db, SAMPLE_IMPORT_LOGS_COLLECTION),
    orderBy('importedAt', 'desc'),
    limit(30)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const logs = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as SampleImportLog[];
      callback(logs);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, SAMPLE_IMPORT_LOGS_COLLECTION);
    }
  );
}
