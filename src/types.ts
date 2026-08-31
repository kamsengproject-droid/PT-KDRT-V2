export type UserRole = 'OWNER' | 'MANAGER' | 'EMPLOYEE' | 'INVESTOR';

export type ScopeType = 'PRIBADI' | 'SHARING';

export interface UserPermissions {
  canReadPrivate: boolean;
  canWritePrivate: boolean;
  canReadSharing: boolean;
  canWriteSharing: boolean;
  canManageAccounts: boolean;
  canManageExpenses: boolean;
  canManageUsers: boolean;
  canViewReports: boolean;
  canExport: boolean;
  canManageHR?: boolean;
  canManagePayroll?: boolean;
}

export interface UserProfile {
  uid: string;
  name: string;
  nickname?: string;
  email: string;
  phone?: string;
  photoUrl?: string;
  role: UserRole;
  active: boolean;
  employeeId?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  permissions: UserPermissions;
  createdAt?: any;
  updatedAt?: any;
}

export interface Account {
  id?: string;
  accountName: string;
  username: string;
  platform: string;
  scope: ScopeType;
  managerId?: string;
  managerName?: string;
  active: boolean;
  startDate: string;
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
}

export interface DailyPerformance {
  id?: string;
  date: string;
  accountId: string;
  accountName?: string;
  scope: ScopeType;
  gmv: number;
  estimatedCommission: number;
  realCommission: number;
  commissionReal?: number; // Canonical field; realCommission kept as legacy mirror
  itemSold?: number; // Jumlah item terjual (Tab Data GMV)
  productImpression?: number; // Product impression / tayangan produk (Tab Data GMV)
  notes?: string;
  commissionNotes?: string; // Catatan khusus Komisi Real
  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
}

export type ExpenseCategory =
  | 'SAMPEL'
  | 'INVENTORY'
  | 'RENOVASI'
  | 'GAJI'
  | 'UANG RAJIN'
  | 'BONUS'
  | 'OPERASIONAL'
  | 'IKLAN'
  | 'SEWA'
  | 'INTERNET'
  | 'LISTRIK'
  | 'TRANSPORTASI'
  | 'PRODUKSI KONTEN'
  | 'SALARY'
  | 'ATTENDANCE_BONUS'
  | 'MARKETING'
  | 'PERALATAN'
  | 'INTERNET_LISTRIK'
  | 'LAINNYA';

export const DEFAULT_EXPENSE_CATEGORIES: string[] = [
  'SAMPEL',
  'INVENTORY',
  'RENOVASI',
  'GAJI',
  'UANG RAJIN',
  'BONUS',
  'OPERASIONAL',
  'IKLAN',
  'SEWA',
  'INTERNET',
  'LISTRIK',
  'TRANSPORTASI',
  'PRODUKSI KONTEN',
  'LAINNYA',
];

export type IncomeSourceType =
  | 'TIKTOK_COMMISSION'
  | 'ENDORSE'
  | 'SPONSOR'
  | 'SERVICE'
  | 'OTHER'
  | 'OPENING_BALANCE';

export const DEFAULT_INCOME_CATEGORIES: string[] = [
  'KOMISI TIKTOK',
  'ENDORSE',
  'SPONSOR',
  'JASA',
  'LAINNYA',
];

// TRANSFER is an internal movement of money, never new income or an expense.
export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'OPENING_BALANCE';
export type TransactionStatus = 'ACTIVE' | 'VOID';
export type TransactionSourceType =
  | 'TIKTOK_COMMISSION'
  | 'WEEKLY_COMMISSION'
  | 'ENDORSE'
  | 'SPONSOR'
  | 'SERVICE'
  | 'SAMPLE'
  | 'INVENTORY'
  | 'PAYROLL'
  | 'ATTENDANCE_BONUS'
  | 'PROFIT_SHARING'
  | 'MANUAL'
  | 'DAILY_EXPENSE'
  | 'COMMISSION_REAL'
  | 'FUND_TRANSFER'
  | 'WITHDRAWAL'
  | 'OTHER'
  | 'OPENING_BALANCE';

export type PaymentMethod = 'CASH' | 'TRANSFER' | 'EWALLET' | 'LAINNYA';

export interface Expense {
  sourceType?: string;
  id?: string;
  date: string;
  amount: number;
  category: ExpenseCategory | string;
  scope: ScopeType;
  accountId?: string;
  accountName?: string;
  employeeId?: string;
  employeeName?: string;
  payrollId?: string;
  sampleId?: string;
  productId?: string;
  inventoryId?: string;
  paymentMethod?: PaymentMethod | string;
  description: string;
  attachment?: string;
  receiptUrl?: string;
  notes?: string;
  status?: TransactionStatus;
  voidReason?: string;
  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface FinancialTransaction {
  id?: string;
  transactionId?: string;
  type: TransactionType; // 'INCOME' | 'EXPENSE'
  amount: number; // Komisi Real for TikTok, or nominal expense
  date: string; // YYYY-MM-DD
  category: string;
  scope: ScopeType; // 'PRIBADI' | 'SHARING'
  sourceType: TransactionSourceType;
  referenceId?: string | null; // Unique logical reference (sampleId, inventoryId, payrollId, etc.)

  // Account / TikTok info (Performa context)
  accountId?: string | null;
  accountName?: string | null;
  sourceAccountId?: string | null;
  sourceAccountName?: string | null;
  destinationAccountName?: string | null;
  sourcePerformanceId?: string | null;
  gmv?: number; // Metrik performa saja (bukan uang kas)
  estimatedCommission?: number; // Metrik performa saja (bukan uang kas)
  realCommission?: number; // Nominal masuk kas

  // Employee / PIC reference if relevant
  employeeId?: string | null;
  employeeName?: string | null;

  // Modul references
  payrollId?: string | null;
  sampleId?: string | null;
  productId?: string | null;
  inventoryId?: string | null;
  profitSharingSettlementId?: string | null;

  // Pindah Dana: a single informational ledger entry so a TikTok payout is not
  // counted again as income. `amount` is the gross commission; netAmount is the
  // amount that actually reaches the destination account after TikTok's fee.
  transferId?: string | null;
  fromAccount?: string | null;
  toAccount?: string | null;
  adminFee?: number;
  netAmount?: number;
  performanceId?: string | null;

  paymentMethod?: PaymentMethod | string;
  description: string;
  attachmentUrl?: string;
  attachmentStoragePath?: string;
  notes?: string;

  // Status & Audit
  status: TransactionStatus; // 'ACTIVE' | 'VOID'
  voidReason?: string;
  voidedAt?: any;
  voidedBy?: string;
  voidedByName?: string;

  createdBy: string;
  createdByName?: string;
  createdAt?: any;
  updatedAt?: any;
  updatedBy?: string;
  updatedByName?: string;
}

// Backward compatibility alias
export type Transaction = FinancialTransaction;

export interface SaldoRealPtKdrt {
  amount: number;
  notes?: string;
  updatedAt?: any;
  updatedBy?: string;
  updatedByName?: string;
}

export type MedsosWithdrawalStatus = 'BERHASIL' | 'DIPROSES' | 'GAGAL' | 'DIBATALKAN';

export interface WithdrawalRecord {
  id?: string;
  date: string; // YYYY-MM-DD (Tanggal Penarikan)
  accountId: string; // Akun TikTok / Medsos ID
  accountName: string; // e.g. "NISAGROSIR88", "KDRT OFFICIAL", dll
  amount: number; // Nominal Penarikan (Number(...) || 0)
  destinationAccount: string; // Tujuan Dana: BCA, Mandiri, Kas Tunai, dll
  status: MedsosWithdrawalStatus; // 'BERHASIL' | 'DIPROSES' | 'GAGAL' | 'DIBATALKAN'
  referenceNumber?: string; // Nomor Referensi / ID Penarikan (opsional)
  notes?: string; // Catatan (opsional)

  // Sync reference to Buku Kas & Bank
  syncedTransactionId?: string; // e.g. "WITHDRAWAL_{id}"

  // Timestamps & Audit
  createdAt?: any;
  createdBy?: string;
  createdByName?: string;
  updatedAt?: any;
  updatedBy?: string;
  updatedByName?: string;
}

export interface FinancialReconciliation {
  id?: string;
  date: string; // YYYY-MM-DD
  periodLabel: string; // e.g. "Agustus 2026" or "17 Agustus 2026"
  scope: ScopeType | 'ALL';
  systemBalance: number;
  actualBalance: number;
  difference: number; // actualBalance - systemBalance
  accountName: string; // e.g. "Rekening BCA Bisnis", "Kas Tunai Kantor", dll
  notes?: string;
  status: 'SEIMBANG' | 'SELISIH_KURANG' | 'SELISIH_LEBIH';
  createdBy: string;
  createdByName?: string;
  createdAt?: any;
}

export interface Employee {
  id?: string;
  name: string;
  nickname?: string;
  position: string;
  appRole?: UserRole;
  scope?: ScopeType;
  baseSalary: number;
  startDate: string;
  active: boolean;
  userId?: string;
  email: string;
  phone?: string;
  notes?: string;
  photoUrl?: string;
  /**
   * Akun medsos yang menjadi tanggung jawab karyawan ini (Firestore document IDs
   * dari collection `accounts`). Dipakai untuk membatasi akun yang bisa dipilih
   * dan dilihat pada modul Data Omset. Relasi disimpan sebagai data sehingga
   * assignment dapat diubah tanpa mengubah kode.
   */
  assignedAccountIds?: string[];
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  permissions?: {
    canViewAttendance?: boolean;
    canManageOwnProfile?: boolean;
    canChangeOwnPassword?: boolean;
    canViewSampleProducts?: boolean;
    canCreateSampleProduct?: boolean;
    canInputCommissionReal?: boolean;
    canViewOmset?: boolean;
    canViewSharingOmset?: boolean;
    canViewSpecificAccounts?: string[];
  };
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
}

export type AttendanceStatus =
  | 'HADIR'
  | 'TERLAMBAT'
  | 'IZIN'
  | 'LIBUR'
  | 'TIDAK HADIR'
  | 'DI LUAR AREA'
  | 'BELUM LENGKAP'
  | 'EARLY_CHECKOUT';

export type CheckoutStatus = 'NORMAL' | 'EARLY_CHECKOUT' | 'BELUM_PULANG';

export interface AttendanceRecord {
  userId?: string;
  id?: string;
  employeeId: string;
  employeeName?: string;
  date?: string; // YYYY-MM-DD
  tanggal: string; // YYYY-MM-DD
  
  // Waktu
  checkInAt?: any; // serverTimestamp
  checkOutAt?: any; // serverTimestamp
  checkInTime?: string; // e.g. "08:58"
  checkOutTime?: string; // e.g. "17:01"
  waktuMasuk?: string; // compatibility
  waktuPulang?: string; // compatibility

  // Foto & Storage
  checkInPhotoUrl?: string;
  checkOutPhotoUrl?: string;
  fotoMasuk?: string; // compatibility
  fotoPulang?: string; // compatibility
  checkInStoragePath?: string;
  checkOutStoragePath?: string;
  photoWidth?: number;
  photoHeight?: number;
  photoSizeBytes?: number;
  photoMimeType?: string;

  // Lokasi & GPS
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  checkInLatitude?: number;
  checkInLongitude?: number;
  checkInGpsAccuracy?: number;
  checkInDistance?: number;

  latitudePulang?: number;
  longitudePulang?: number;
  accuracyPulang?: number;
  checkOutLatitude?: number;
  checkOutLongitude?: number;
  checkOutGpsAccuracy?: number;
  checkOutDistance?: number;
  distanceFromOffice?: number;

  // Status & Kalkulasi
  status: AttendanceStatus;
  lateMinutes?: number;
  menitTerlambat: number;
  statusPulang?: 'NORMAL' | 'PULANG TERLALU CEPAT';
  checkoutStatus?: CheckoutStatus;
  isEarlyCheckout?: boolean;
  earlyCheckoutMinutes?: number;
  jadwalMasuk?: string; // e.g. "09:00"
  jadwalPulang?: string; // e.g. "17:00" or "12:30"
  
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
}

export type Attendance = AttendanceRecord;

export interface WorkplaceSchedule {
  officeName?: string;
  appName?: string;
  workDays: string[]; // e.g. ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
  activeDays?: number[]; // [1, 2, 3, 4, 5, 6]
  
  // Default / fallback times
  checkInTime: string; // '09:00'
  checkOutTime: string; // '17:00'

  // Specific Day Schedules
  weekdayCheckInTime?: string; // '09:00' (Senin–Jumat)
  weekdayCheckOutTime?: string; // '17:00' (Senin–Jumat)
  saturdayCheckInTime?: string; // '09:00' (Sabtu)
  saturdayCheckOutTime?: string; // '12:30' (Sabtu)

  // Toleransi
  earlyCheckoutToleranceMinutes?: number; // 10 menit
  lateToleranceMinutes?: number; // 0

  timezone: string; // 'Asia/Jakarta'
  rajinWeeklyBonus?: number; // 150000
  lateDeduction?: number; // 20000
  minRajinBonus?: number; // 0
  updatedAt?: any;
  updatedBy?: string;
}

export interface OfficeLocation {
  officeName: string;
  latitude: number;
  longitude: number;
  radius: number; // meters, e.g. 100
  updatedAt?: any;
  updatedBy?: string;
}

export interface Holiday {
  id?: string;
  date: string; // YYYY-MM-DD
  name: string;
  notes?: string;
  active?: boolean;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
}

export type PayrollStatus = 'DRAFT' | 'CALCULATED' | 'APPROVED' | 'PAID' | 'BELUM DIBAYAR' | 'SUDAH DIBAYAR';
export type PaymentStatus = 'BELUM DIBAYAR' | 'SIAP DIBAYAR' | 'SUDAH DIBAYAR' | PayrollStatus;
export type AdjustmentType = 'ADDITION' | 'DEDUCTION';

export interface AttendanceBonusDayBreakdown {
  tanggal: string;
  hari: string;
  isHoliday: boolean;
  holidayName?: string;
  isWorkDay: boolean;
  checkInTime?: string;
  checkOutTime?: string;
  status: AttendanceStatus | 'TIDAK HADIR' | 'LIBUR' | 'BELUM ABSEN';
  menitTerlambat: number;
  potongan: number;
  keterangan: string;
}

export interface AttendanceBonusWeek {
  id?: string;
  employeeId: string;
  employeeName: string;
  weekStart: string; // YYYY-MM-DD (Senin)
  weekEnd: string; // YYYY-MM-DD (Sabtu)
  month?: string; // YYYY-MM
  label: string; // "10 – 15 Agustus 2026"
  baseBonus: number; // 150000
  eligibleWorkDays: number; // hari kerja aktif (Senin-Sabtu minus libur nasional)
  presentDays: number; // jumlah hadir valid
  lateDays: number; // jumlah hari terlambat
  lateCount: number;
  lateDeduction: number; // potongan Rp 20.000 / hari terlambat
  deduction: number;
  bonusAmount: number; // final Uang Rajin (Rp 0 jika tidak hadir penuh)
  finalBonus: number;
  isFullAttendance: boolean;
  reason?: string;
  status: 'CALCULATED' | 'APPROVED' | 'PAID' | 'SIAP DIBAYAR' | 'SUDAH DIBAYAR';
  paidAt?: any;
  paidBy?: string;
  paidByName?: string;
  paymentDate?: string;
  paymentAccount?: string;
  paymentTransactionId?: string;
  syncedTransactionId?: string;
  breakdown: AttendanceBonusDayBreakdown[];
  createdAt?: any;
  updatedAt?: any;
}

export interface PayrollRecord {
  id?: string;
  payrollId?: string;
  employeeId: string;
  employeeName: string;
  jobTitle?: string;
  month: string; // YYYY-MM e.g. '2026-08'
  monthLabel?: string; // 'Agustus 2026'
  periodMonth?: string;
  periodYear?: number;
  baseSalary: number; // dari employees.baseSalary
  attendanceBonus: number; // akumulasi Uang Rajin mingguan
  bonus: number; // manual bonus
  bonusAmount?: number;
  bonusNote?: string;
  adjustmentAddition: number; // manual adjustment tambah
  adjustmentAdditionNote?: string;
  adjustmentDeduction: number; // manual adjustment potong
  adjustmentDeductionNote?: string;
  deduction?: number; // compat
  deductionNote?: string; // compat
  totalPay: number; // baseSalary + attendanceBonus + bonus + adjustmentAddition - adjustmentDeduction
  total: number;
  status: PayrollStatus;
  notes?: string;
  paymentDate?: string;
  paymentAccount?: string;
  paymentTransactionId?: string;
  approvedAt?: any;
  approvedBy?: string;
  approvedByName?: string;
  paidAt?: any;
  paidBy?: string;
  paidByName?: string;
  expenseId?: string;
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
  updatedBy?: string;
}

export type Payroll = PayrollRecord;

export interface AuditLogEntry {
  id?: string;
  userId: string;
  userName: string;
  action: string;
  target: string;
  details?: string;
  before?: any;
  after?: any;
  timestamp?: any;
}

export interface ContentScheduleItem {
  id?: string;
  title: string;
  platform: string;
  accountName: string;
  talentName: string;
  contentType: 'LIVE_STREAMING' | 'VIDEO_VT' | 'AFFILIATE_POST';
  scheduledDate: string;
  scheduledTime: string;
  status: 'TERJADWAL' | 'SELESAI' | 'BATAL';
  notes?: string;
  createdAt?: any;
}

export interface SampleInventoryItem {
  id?: string;
  itemName: string;
  category: string;
  brand?: string;
  quantity: number;
  pricePerUnit: number;
  totalCost: number;
  status: 'TERSEDIA' | 'DIPAKAI_LIVE' | 'HABIS' | 'REVIEW';
  receivedDate: string;
  assignedTalentId?: string;
  assignedTalentName?: string;
  notes?: string;
  createdAt?: any;
}

// ==========================================
// PHASE 3A: KERJAAN HARIAN & TARGET PRODUKSI
// ==========================================

export type DailyTaskStatus =
  | 'BELUM DIKERJAKAN'
  | 'SEDANG DIKERJAKAN'
  | 'SELESAI'
  | 'TERTUNDA'
  | 'DIBATALKAN';

export type DailyTaskPriority = 'RENDAH' | 'NORMAL' | 'TINGGI' | 'MENDESAK';

export type RecurringScheduleType = 'DAILY' | 'MON_FRI' | 'MON_SAT' | 'WEEKLY';

export interface DailyTask {
  id?: string;
  taskId?: string;
  tanggal: string; // YYYY-MM-DD
  employeeId: string;
  employeeName: string;
  taskName: string;
  accountId?: string;
  accountName?: string;
  targetOutput: number;
  currentOutput: number;
  unitOutput: string; // e.g. "VT", "VIDEO", "POSTING", "COVER", "PRODUK"
  status: DailyTaskStatus;
  priority: DailyTaskPriority;
  deadline?: string; // e.g. "18:00" or "2026-08-17 18:00"
  notes?: string;
  attachment?: string;
  attachmentUrl?: string;
  proofLink?: string;
  proofType?: 'FILE' | 'LINK' | 'TEXT';
  isRecurring?: boolean;
  recurringFrequency?: RecurringScheduleType;
  templateId?: string;
  sampleId?: string;
  productId?: string;
  sourceType?: string;
  sourceId?: string;
  scope?: ScopeType;
  createdBy: string;
  createdByName?: string;
  createdAt?: any;
  startedAt?: any;
  completedAt?: any;
  updatedAt?: any;
  updatedBy?: string;
  updatedByName?: string;
  durationMinutes?: number;
  progressPercentage?: number;
}

export interface TaskTemplate {
  id?: string;
  templateName: string;
  targetRole: string; // e.g. "Editor", "Talent", "Semua Karyawan"
  description: string;
  defaultTargetOutput: number;
  unitOutput: string; // e.g. "VIDEO", "VT", "POSTING"
  estimatedDuration?: string; // e.g. "120 menit"
  defaultPriority: DailyTaskPriority;
  accountId?: string;
  accountName?: string;
  active: boolean;
  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
}

// ==========================================
// PHASE 3B: PRODUK & SAMPEL AFFILIATE
// ==========================================

export type ProductStatus = 'AKTIF' | 'NONAKTIF';

export interface Product {
  id?: string;
  productId?: string;
  productName: string;
  productImage?: string; // Photo URL
  photoStoragePath?: string;
  photoUrl?: string;
  photoSizeBytes?: number;
  photoMimeType?: string;
  photoWidth?: number;
  photoHeight?: number;
  productPrice: number; // Harga Beli / Harga Produk
  productUrl?: string; // Link Toko / Link Produk
  commissionRate: number; // Persentase Komisi (%)
  accountId?: string; // Akun Utama
  accountName?: string;
  accountIds?: string[]; // Multi-Akun TikTok
  accountNames?: string[];
  category: string; // e.g. "Skincare", "Elektronik", "Fashion", "Mainan", "Rumah Tangga", "Lainnya"
  notes?: string;
  scope: ScopeType; // 'PRIBADI' | 'SHARING'
  status: ProductStatus; // 'AKTIF' | 'NONAKTIF'
  createdBy: string;
  createdByName?: string;
  createdAt?: any;
  updatedAt?: any;
  updatedBy?: string;
  updatedByName?: string;
}

export type SampleStatus = 'DIPESAN' | 'DIKIRIM' | 'DITERIMA' | 'DIGUNAKAN' | 'SELESAI';

export interface AffiliateSample {
  id?: string;
  sampleId?: string;
  productId: string;
  productName: string;
  productImage?: string;
  productPrice?: number;
  productUrl?: string;
  
  samplePrice: number; // Harga Satuan Sampel
  purchaseDate: string; // Tanggal Pembelian YYYY-MM-DD
  quantity: number; // Jumlah Sampel
  totalCost: number; // samplePrice * quantity
  
  status: SampleStatus; // DIPESAN -> DIKIRIM -> DITERIMA -> DIGUNAKAN -> SELESAI
  
  // Akun & Tim yang Mengerjakan
  accountId?: string;
  accountName?: string;
  accountIds?: string[];
  accountNames?: string[];
  employeeId?: string;
  employeeName?: string;
  
  // Content Tracking
  targetContent: number; // Target VT (misal: 3)
  completedContent: number; // Konten Selesai (misal: 2)
  unitContent?: string; // e.g. "VT"
  
  // Relasi Kerjaan Harian (Phase 3A)
  taskId?: string;
  taskIds?: string[];
  
  // Pengeluaran Keuangan & Anti-Double-Entry
  expenseId?: string; // ID transaksi pengeluaran di 'expenses'
  isExpenseRecorded?: boolean;
  expenseRecordedAt?: any;
  
  scope: ScopeType; // 'PRIBADI' | 'SHARING'
  category?: string;
  notes?: string;
  sellerName?: string; // Nama Seller/Toko tempat sampel dibeli
  brandName?: string; // Nama Brand produk sampel
  size?: string; // Ukuran / Size sampel (free text: S, M, L, XL, XXL, 3XL, All Size, 42, dll). Boleh kosong.
  color?: string; // Warna / Varian Warna sampel (e.g. "A-Hitam", "Navy", "Putih")
  productPriceVal?: number; // Harga Produk Asli dari Spreadsheet / Toko
  shippingCost?: number; // Biaya Ongkir
  discount?: number; // Diskon / Voucher
  totalPaid?: number; // Total Bayar
  orderNumber?: string; // Nomor Pesanan (STRING digit panjang)
  paymentMethod?: string; // Kategori metode pembayaran (DANA, COD, TRANSFER, PAYLATER, dll)
  paymentMethodRaw?: string; // Teks asli metode pembayaran dari spreadsheet
  sequenceNumber?: number; // Nomor urutan baris spreadsheet
  source?: 'manual' | 'ai_scan' | 'spreadsheet_import' | string; // Sumber pencatatan sampel
  importBatchId?: string; // ID Batch import spreadsheet
  importFileName?: string; // Nama file spreadsheet yang diimport
  importedAt?: any; // Timestamp saat import
  importedBy?: string; // User ID yang mengimport
  importedByName?: string; // Nama User yang mengimport
  sampleImage?: string; // Foto kondisi fisik sampel (BEDA dari productImage / foto produk master)
  photoUrl?: string; // Alias kompatibilitas foto sampel

  // Penataan Lokasi Fisik Sampel (Rak / Hanger / Lemari)
  locationId?: string;
  locationCode?: string; // e.g. "CELANA-A", "BATIK-A"
  locationName?: string; // e.g. "Rak Celana A", "Hanger Batik A"

  createdBy: string;
  createdByName?: string;
  createdAt?: any;
  updatedAt?: any;
  updatedBy?: string;
  updatedByName?: string;
}

// Backward compatibility alias
export type Sample = AffiliateSample;

export type SampleLocationType = 'RAK' | 'HANGER' | 'KOTAK' | 'LEMARI' | 'LAINNYA';

export interface SampleLocation {
  id?: string;
  locationId?: string;
  kodeLokasi: string; // e.g. "CELANA-A", "BATIK-A" (Unique identifier)
  namaLokasi: string; // e.g. "Rak Celana A", "Hanger Batik A"
  kategori: string;   // e.g. "Fashion Celana", "Fashion Batik", "Fashion Kaos", "Fashion Setelan", etc.
  tipeLokasi: SampleLocationType | string; // "RAK" | "HANGER" | "KOTAK" | "LEMARI" | "LAINNYA"
  aktif: boolean;
  active?: boolean;
  notes?: string;
  createdAt?: any;
  createdBy?: string;
  createdByName?: string;
  updatedAt?: any;
  updatedBy?: string;
  updatedByName?: string;
}

// ==========================================
// PHASE 3C: INVENTORY & ASET KANTOR
// ==========================================

export type InventoryCategory =
  | 'PERALATAN KONTEN'
  | 'ELEKTRONIK'
  | 'KOMPUTER'
  | 'FURNITURE'
  | 'PROPERTI KONTEN'
  | 'PERLENGKAPAN KANTOR'
  | 'INVENTORY HABIS PAKAI'
  | 'LAINNYA';

export const DEFAULT_INVENTORY_CATEGORIES: InventoryCategory[] = [
  'PERALATAN KONTEN',
  'ELEKTRONIK',
  'KOMPUTER',
  'FURNITURE',
  'PROPERTI KONTEN',
  'PERLENGKAPAN KANTOR',
  'INVENTORY HABIS PAKAI',
  'LAINNYA',
];

export const DEFAULT_INVENTORY_LOCATIONS = [
  'Studio',
  'Ruang Editor',
  'Gudang',
  'Ruang Kerja',
  'Rumah',
  'Mobil',
  'Lainnya',
];

export type InventoryCondition = 'BAIK' | 'PERLU PERBAIKAN' | 'RUSAK' | 'HILANG';
export type InventoryStatus = 'AKTIF' | 'NONAKTIF';

export interface InventoryItem {
  id?: string;
  inventoryId?: string;
  itemName: string; // Nama Barang
  category: string; // Kategori Barang

  // Foto & Storage Metadata
  photoUrl?: string;
  photoStoragePath?: string;
  photoSizeBytes?: number;
  photoMimeType?: string;
  photoWidth?: number;
  photoHeight?: number;

  // Multi-Qty & Nilai
  quantity: number; // Jumlah unit (contoh: 4)
  pricePerUnit: number; // Harga satuan (Rp)
  totalValue: number; // Otomatis = quantity * pricePerUnit

  // Pembelian & Identifikasi
  purchaseDate: string; // YYYY-MM-DD
  purchaseLink?: string; // Link pembelian (Shopee/Tokopedia/dll)
  serialNumber?: string; // Nomor seri opsional

  // Lokasi & Penanggung Jawab
  location: string; // Lokasi penyimpanan barang
  picEmployeeId?: string; // ID Karyawan PIC
  picEmployeeName?: string; // Nama Karyawan PIC

  // Kondisi & Status
  condition: InventoryCondition; // BAIK | PERLU PERBAIKAN | RUSAK | HILANG
  status: InventoryStatus; // AKTIF | NONAKTIF
  scope: ScopeType; // PRIBADI | SHARING

  // Integrasi Pengeluaran Keuangan & Anti-Double-Entry
  expenseId?: string; // ID transaksi pengeluaran terkait
  isExpenseRecorded?: boolean;
  expenseRecordedAt?: any;

  notes?: string;

  // Audit Tracking
  createdBy: string;
  createdByName?: string;
  createdAt?: any;
  updatedAt?: any;
  updatedBy?: string;
  updatedByName?: string;
}

export type InventoryHistoryAction =
  | 'DIBELI'
  | 'DIPINDAHKAN'
  | 'PIC_BERUBAH'
  | 'KONDISI_BERUBAH'
  | 'DIPERBAIKI'
  | 'STATUS_BERUBAH'
  | 'EXPENSE_DICATAT'
  | 'DIUPDATE'
  | 'LAINNYA';

export interface InventoryHistory {
  id?: string;
  inventoryId: string;
  itemName: string;
  action: InventoryHistoryAction;
  date: string; // YYYY-MM-DD or formatted timestamp
  
  // Perubahan Lokasi & PIC
  previousLocation?: string;
  newLocation?: string;
  previousPicId?: string;
  previousPicName?: string;
  newPicId?: string;
  newPicName?: string;

  // Perubahan Kondisi & Status
  previousCondition?: InventoryCondition;
  newCondition?: InventoryCondition;
  previousStatus?: InventoryStatus;
  newStatus?: InventoryStatus;

  notes?: string;
  actorUid: string;
  actorName: string;
  createdAt?: any;
}

// ==========================================
// PHASE 4: PROFIT SHARING & INVESTOR DASHBOARD
// ==========================================

export interface ProfitSharingTier {
  id?: string;
  tierId?: string;
  name: string; // e.g. "Tier Dasar (< Rp20 Juta)"
  minIncome: number; // e.g. 0, 20000000, 50000000, 100000000
  maxIncome?: number | null; // e.g. 19999999, 49999999, 99999999, null
  investorPercentage: number; // 45
  ownerPercentage: number; // 45
  talentPercentage: number; // 0, 5, 7, 10
  editorPercentage: number; // 0, 5, 7, 10
  companyBudgetPercentage: number; // 10, 0
  description?: string;
  isActive: boolean;
  createdAt?: any;
  updatedAt?: any;
  updatedBy?: string;
}

export const DEFAULT_PROFIT_SHARING_TIERS: ProfitSharingTier[] = [
  {
    tierId: 'tier_1',
    name: 'Tier Dasar (< Rp20 Juta)',
    minIncome: 0,
    maxIncome: 19999999,
    investorPercentage: 45,
    ownerPercentage: 45,
    talentPercentage: 0,
    editorPercentage: 0,
    companyBudgetPercentage: 10,
    description: 'Bila uang masuk sharing < Rp20 Juta: Investor 45%, Owner 45%, Budget Operasional/Tak Terduga 10%.',
    isActive: true,
  },
  {
    tierId: 'tier_2',
    name: 'Tier Standard (>= Rp20 Juta)',
    minIncome: 20000000,
    maxIncome: 49999999,
    investorPercentage: 45,
    ownerPercentage: 45,
    talentPercentage: 5,
    editorPercentage: 5,
    companyBudgetPercentage: 0,
    description: 'Bila uang masuk sharing >= Rp20 Juta: Investor 45%, Owner 45%, Talent 5%, Editor 5%.',
    isActive: true,
  },
  {
    tierId: 'tier_3',
    name: 'Tier Prestasi (>= Rp50 Juta)',
    minIncome: 50000000,
    maxIncome: 99999999,
    investorPercentage: 45,
    ownerPercentage: 45,
    talentPercentage: 7,
    editorPercentage: 7,
    companyBudgetPercentage: 0,
    description: 'Bila uang masuk sharing >= Rp50 Juta: Formula awal menghasilkan 104% (Perlu penyesuaian Owner sebelum approval).',
    isActive: true,
  },
  {
    tierId: 'tier_4',
    name: 'Tier Maksimal (>= Rp100 Juta)',
    minIncome: 100000000,
    maxIncome: null,
    investorPercentage: 45,
    ownerPercentage: 45,
    talentPercentage: 10,
    editorPercentage: 10,
    companyBudgetPercentage: 0,
    description: 'Bila uang masuk sharing >= Rp100 Juta: Formula awal menghasilkan 110% (Perlu penyesuaian Owner sebelum approval).',
    isActive: true,
  },
];

export type SettlementStatus =
  | 'DRAFT'
  | 'REVIEW'
  | 'APPROVED'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'VOID';

export interface ProfitSharingSettlement {
  id?: string;
  settlementId: string; // `${year}_${month}_SHARING` (e.g. "2026_08_SHARING")
  periodStart: string; // YYYY-MM-01
  periodEnd: string; // YYYY-MM-lastDay
  year: number;
  month: string; // '08'
  periodLabel: string; // "Agustus 2026"
  scope: 'SHARING';

  // 1. Dasar Perhitungan Kas Nyata (Dari Master Collection 'transactions')
  totalIncome: number; // Sum of active type='INCOME' & scope='SHARING'
  totalExpense: number; // Sum of active type='EXPENSE' & scope='SHARING'
  netProfit: number; // totalIncome - totalExpense (Cashflow net)
  calculationBasis?: 'NET_PROFIT' | 'INCOME' | string; // "Profit sharing dihitung dari Arus Kas Bersih (Net)"

  // 2. Tier & Formula Persentase
  activeTierId?: string;
  activeTierName: string;
  investorPercentage: number;
  ownerPercentage: number;
  talentPercentage: number;
  editorPercentage: number;
  companyBudgetPercentage: number;
  totalPercentage: number; // Harus 100 untuk APPROVED
  isFormulaValid: boolean; // totalPercentage === 100
  formulaWarning?: string;

  // 3. Nominal Pembagian (Rp)
  investorAmount: number;
  ownerAmount: number;
  talentAmount: number;
  editorAmount: number;
  companyBudgetAmount: number;

  // 4. PIC Karyawan Talent & Editor
  talentEmployeeId?: string;
  talentEmployeeName?: string;
  editorEmployeeId?: string;
  editorEmployeeName?: string;

  // 5. Tracking Kewajiban & Pembayaran Investor
  totalPaidToInvestor: number; // Akumulasi withdrawal berstatus PAID
  remainingInvestorObligation: number; // investorAmount - totalPaidToInvestor
  isAccrued: boolean; // true (Kewajiban sampai dibayar nyata)

  // 6. Status & Workflow
  status: SettlementStatus;
  statusNotes?: string;
  voidReason?: string;

  // 7. Audit & Sign-off
  createdBy: string;
  createdByName?: string;
  createdAt?: any;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: any;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: any;
  paidAt?: any;
  updatedAt?: any;
  updatedBy?: string;
  updatedByName?: string;
}

export type WithdrawalStatus = 'PAID' | 'VOID';

export interface InvestorWithdrawal {
  id?: string;
  withdrawalId?: string;
  settlementId: string; // Foreign key ke settlement
  periodLabel: string; // "Agustus 2026"
  scope: 'SHARING';

  investorId?: string;
  investorName: string;
  date: string; // YYYY-MM-DD
  amount: number; // Nominal yang dibayarkan (Rp)
  paymentMethod: PaymentMethod; // TRANSFER / CASH / EWALLET
  bankAccount?: string; // Nama Bank & Rekening Tujuan

  notes?: string;
  receiptUrl?: string;
  receiptStoragePath?: string;

  // Integrasi Transaksi Kas Master (Phase 3D)
  transactionId?: string; // ID mutasi di collection 'transactions'
  isExpenseRecorded: boolean;
  expenseRecordedAt?: any;

  status: WithdrawalStatus; // PAID | VOID
  voidReason?: string;
  voidedBy?: string;
  voidedByName?: string;
  voidedAt?: any;

  createdBy: string;
  createdByName?: string;
  createdAt?: any;
  updatedAt?: any;
}

// ==========================================
// PHASE 5: JADWAL KONTEN & CONTENT MANAGEMENT
// ==========================================

export type ContentStatus =
  | 'IDE'
  | 'DIREKAM'
  | 'EDITING'
  | 'SIAP'
  | 'TERJADWAL'
  | 'DIPOSTING'
  | 'DIBATALKAN';

export const CONTENT_STATUS_SEQUENCE: ContentStatus[] = [
  'IDE',
  'DIREKAM',
  'EDITING',
  'SIAP',
  'TERJADWAL',
  'DIPOSTING',
];

export interface ContentStatusHistory {
  status: ContentStatus;
  timestamp: any;
  actorUid: string;
  actorName: string;
  notes?: string;
  postedUrl?: string;
}

export interface ContentCalendarItem {
  id?: string;
  contentId: string;
  title: string; // Judul / Nama Konten
  date: string; // YYYY-MM-DD
  time: string; // HH:mm e.g. "19:00"

  // Relasi Akun TikTok
  accountId: string;
  accountName: string;
  accountUsername?: string;
  scope: ScopeType; // 'PRIBADI' | 'SHARING' (follows account)

  // Relasi Produk (Phase 3B)
  productId?: string;
  productName?: string;
  productImage?: string;
  productPrice?: number;
  productUrl?: string;

  // Tim Talent & Editor
  talentId?: string;
  talentName?: string;
  editorId?: string;
  editorName?: string;

  // Relasi Daily Task (Phase 3A)
  taskId?: string;
  taskName?: string;

  // Output & Target
  targetOutput: number; // e.g. 1
  unitOutput: string; // e.g. "VT", "VIDEO", "POSTING"

  // Status & Lifecycle
  status: ContentStatus;
  notes?: string;

  // Bukti Posting (Ketika status: DIPOSTING)
  postedUrl?: string; // Link posting TikTok e.g. "https://tiktok.com/@kamseng/video/..."
  postedAt?: any; // serverTimestamp
  postedProofUrl?: string; // URL screenshot bukti posting di Firebase Storage
  postedProofStoragePath?: string;

  // Timeline History Timestamps
  statusHistory?: ContentStatusHistory[];
  ideAt?: any;
  direkamAt?: any;
  editingAt?: any;
  siapAt?: any;
  terjadwalAt?: any;
  postedAtTimestamp?: any;
  cancelledAt?: any;
  cancellationReason?: string;

  // Recurring linkage
  recurringTemplateId?: string;
  isRecurringInstance?: boolean;

  // Audit
  createdBy: string;
  createdByName?: string;
  createdAt?: any;
  updatedAt?: any;
  updatedBy?: string;
  updatedByName?: string;
}

export type ContentRecurringFrequency = 'DAILY' | 'MON_SAT' | 'WEEKLY' | 'CUSTOM_DAYS';

export interface ContentRecurringTemplate {
  id?: string;
  templateId?: string;
  templateName: string;
  title: string;
  frequency: ContentRecurringFrequency;
  customDays?: number[]; // [1, 2, 3, 4, 5, 6] (1 = Senin, 7 = Minggu)
  time: string; // "19:00"
  accountId: string;
  accountName: string;
  scope: ScopeType;
  productId?: string;
  productName?: string;
  productImage?: string;
  productPrice?: number;
  productUrl?: string;
  talentId?: string;
  talentName?: string;
  editorId?: string;
  editorName?: string;
  taskId?: string;
  taskName?: string;
  targetOutput: number;
  unitOutput: string;
  notes?: string;
  active: boolean;
  createdBy: string;
  createdByName?: string;
  createdAt?: any;
  updatedAt?: any;
}

// ============================================================================
// PHASE 6: LAPORAN, EXPORT, CLOSING BULANAN & REKAPITULASI
// ============================================================================

export type ReportSubMenu =
  | 'KEUANGAN'
  | 'PERFORMA_AKUN'
  | 'PENGELUARAN'
  | 'PRODUK'
  | 'SAMPEL'
  | 'INVENTORY'
  | 'KARYAWAN'
  | 'ABSENSI'
  | 'PENGGAJIAN'
  | 'PROFIT_SHARING'
  | 'KONTEN'
  | 'INVESTOR'
  | 'EKSPOR';

export type ReportScopeFilter = 'PRIBADI' | 'SHARING' | 'GABUNGAN';

export interface ReportGlobalFilter {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  scope: ReportScopeFilter;
  accountId: string; // 'SEMUA' or account ID
  productId: string; // 'SEMUA' or product ID
  employeeId: string; // 'SEMUA' or employee ID
  category: string; // 'SEMUA' or category
  status: string; // 'SEMUA' or status
}

export type MonthlyClosingStatus = 'OPEN' | 'CLOSED';

export interface MonthlyClosing {
  id?: string;
  closingId: string; // e.g. "CLOSING_2026-08_SHARING"
  year: number; // 2026
  month: number; // 8 (1-12)
  period: string; // "2026-08"
  scope: ReportScopeFilter; // 'PRIBADI' | 'SHARING' | 'GABUNGAN'
  status: MonthlyClosingStatus; // 'OPEN' | 'CLOSED'
  notes?: string;

  // Snapshot Angka Historis (Frozen/Stabil)
  uangMasuk: number; // Single Source of Truth dari transactions
  uangKeluar: number; // Single Source of Truth dari transactions
  saldoBersih: number; // uangMasuk - uangKeluar

  // Performa & Komisi
  gmv: number;
  estimasiKomisi: number;
  komisiReal: number;

  // Expense & Operasional
  totalExpense: number;
  totalSampleExpense: number;
  totalInventoryValue: number;

  // Payroll
  totalPayroll: number;
  totalGajiPokok: number;
  totalUangRajin: number;
  totalBonus: number;
  totalPayrollPaid: number;
  totalPayrollUnpaid: number;

  // Profit Sharing (Settlements)
  totalProfitSharingMasuk: number;
  hakInvestor: number;
  hakOwner: number;
  hakTalent: number;
  hakEditor: number;
  budgetPerusahaan: number;
  investorPaid: number;
  investorUnpaid: number;

  // Produksi Konten & Tugas
  totalContentPlanned: number;
  totalContentPosted: number;
  totalTasksCompleted: number;

  // Breakdowns
  sourceTypeBreakdown: Record<string, number>;
  expenseCategoryBreakdown: Record<string, number>;
  topExpenses: Array<{ name: string; amount: number; category: string }>;

  // Rekonsiliasi Snapshot
  reconciliationSnapshot?: {
    saldoBuku: number;
    saldoAktual: number;
    selisih: number;
    status: 'SEIMBANG' | 'SURPLUS FISIK' | 'DEFISIT FISIK';
    reconciledAt?: any;
    reconciledByName?: string;
  };

  // Lifecycle & Audit
  closedAt?: any;
  closedBy?: string;
  closedByName?: string;
  reopenedAt?: any;
  reopenedBy?: string;
  reopenedByName?: string;
  reopenReason?: string;

  createdAt?: any;
  updatedAt?: any;
}

export interface FinancialAdjustment {
  id?: string;
  adjustmentId: string;
  period: string; // "2026-08"
  scope: ScopeType;
  type: 'INCOME_ADJUSTMENT' | 'EXPENSE_ADJUSTMENT';
  amount: number;
  description: string;
  reason: string;
  category?: string;
  sourceType?: string;
  approvedBy: string;
  approvedByName: string;
  createdAt?: any;
}

// ============================================================================
// PHASE 7: INPUT MANUAL OWNER (KOMISI MINGGUAN & KOMISI EMPLOYEE)
// ============================================================================

export interface WeeklyCommission {
  id?: string;
  periodWeek: string; // e.g. "Minggu 3 (17 - 23 Agu 2026)"
  accountName: string; // Nama akun / seller
  sellerName?: string;
  accountId?: string;
  amount: number; // Nominal komisi (Rp)
  date: string; // Tanggal input (YYYY-MM-DD)
  notes?: string;
  transactionId?: string; // Linked into master transactions collection
  createdBy: string;
  createdByName?: string;
  createdAt?: any;
  updatedAt?: any;
  updatedBy?: string;
  updatedByName?: string;
}

export interface EmployeeCommission {
  id?: string;
  employeeId: string;
  employeeName: string;
  period: string; // e.g. "2026-08" or "Agustus 2026"
  amount: number; // Nominal komisi (Rp)
  basis: string; // Dasar/Periode Komisi (e.g. "Target VT Tercapai", "Bonus Live 50 Jam")
  notes?: string;
  status: 'BELUM DIBAYAR' | 'SUDAH DIBAYAR';
  paymentDate?: string;
  paidAt?: any;
  paidBy?: string;
  paidByName?: string;
  expenseId?: string;
  createdBy: string;
  createdByName?: string;
  createdAt?: any;
  updatedAt?: any;
  updatedBy?: string;
  updatedByName?: string;
}

// ============================================================================
// KEUANGAN REKENING PT KDRT (TERPISAH & MANUAL REKENING RESMI PT KDRT)
// ============================================================================

export type PtKdrtTransactionType = 'INCOME' | 'EXPENSE';

export interface PtKdrtTransaction {
  id?: string;
  type: PtKdrtTransactionType; // 'INCOME' = Uang Masuk, 'EXPENSE' = Uang Keluar
  date: string; // YYYY-MM-DD
  amount: number; // Nominal Rupiah
  category: string; // Kategori transaksi
  accountName: string; // Nama Rekening, default "BCA PT KDRT"
  description: string; // Deskripsi / Keterangan Transaksi
  notes?: string; // Catatan Tambahan
  referenceNumber?: string; // No. Referensi / No. Bukti Transfer
  createdBy: string;
  createdByName?: string;
  createdAt?: any;
  updatedAt?: any;
  updatedBy?: string;
  updatedByName?: string;
}

export const PT_KDRT_INCOME_CATEGORIES = [
  'Omset Penjualan / Afiliasi',
  'Transfer Masuk Rekening',
  'Suntikan Modal / Investor',
  'Pelunasan / Piutang',
  'Bunga Bank / Pendapatan Finansial',
  'Pengembalian Dana (Refund)',
  'Pendapatan Lain-lain',
] as const;

export const PT_KDRT_EXPENSE_CATEGORIES = [
  'Biaya Operasional PT KDRT',
  'Gaji & Upah Karyawan',
  'Uang Rajin & Bonus',
  'Sewa Tempat & Kantor',
  'Listrik, Internet & Utilitas',
  'Iklan, Ads & Marketing',
  'Pembelian Alat / Inventaris PT',
  'Biaya Admin Bank & Pajak',
  'Penarikan Dana Owner / Prive',
  'Bagi Hasil / Profit Sharing',
  'Pengeluaran Lain-lain',
] as const;

export const PT_KDRT_DEFAULT_ACCOUNTS = [
  'BCA PT KDRT',
  'Mandiri PT KDRT',
  'Kas Tunai PT KDRT',
  'BRI PT KDRT',
  'BNI PT KDRT',
  'SeaBank PT KDRT',
] as const;

// ============================================================================
// PHASE: IMPORT SPREADSHEET SAMPLE DATABASE PT KDRT V2
// ============================================================================

export type ImportRowValidationStatus =
  | 'VALID'
  | 'WARNING'
  | 'ERROR'
  | 'NEEDS_REVIEW'
  | 'DUPLICATE';

export type DuplicateAction = 'SKIP' | 'UPDATE' | 'IMPORT_ANYWAY';

export interface SpreadsheetSampleRow {
  rowNumber: number;
  sequenceNumber: number;
  sellerName: string;
  productName: string;
  color: string;
  size: string;
  productPrice: number;
  shippingCost: number;
  discount: number;
  totalPaid: number;
  orderNumber: string;
  paymentMethod: string;
  paymentMethodRaw: string;
  
  // Photo / Gambar Sampel from Excel
  photoUrl?: string;
  sampleImage?: string;
  productImage?: string;

  // Validation status
  status: ImportRowValidationStatus;
  validationIssues: string[];
  
  // Duplicate resolution
  duplicateSampleId?: string;
  duplicateSampleName?: string;
  duplicateAction: DuplicateAction;
  
  // Raw data mapping snapshot
  rawRowData?: Record<string, any>;
}

export interface SampleImportLog {
  id?: string;
  batchId: string;
  fileName: string;
  fileSizeBytes?: number;
  totalRows: number;
  successCount: number;
  duplicateCount: number;
  warningCount: number;
  errorCount: number;
  importedBy: string;
  importedByName: string;
  importedAt: any;
  status: 'SELESAI' | 'SEBAGIAN' | 'GAGAL';
  scope?: ScopeType;
  accountId?: string;
  accountName?: string;
  employeeId?: string;
  employeeName?: string;
  notes?: string;
}


