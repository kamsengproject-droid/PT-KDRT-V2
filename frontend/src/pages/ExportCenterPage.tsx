import React, { useState, useEffect } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  CheckCircle2,
  Calendar,
  Layers,
  ShieldCheck,
  Loader2,
  AlertCircle,
  Database,
} from 'lucide-react';
import {
  UserProfile,
  ReportScopeFilter,
  Account,
  Product,
  Employee,
  Transaction,
  DailyPerformance,
  Expense,
  Sample,
  InventoryItem,
  Attendance,
  Payroll,
  ProfitSharingSettlement,
  ContentCalendarItem,
} from '../types';
import { tanggalHariIni, formatRupiah, formatTanggal } from '../utils/formatters';
import { exportReportData, ExportCategory, ExportFormat } from '../services/exportService';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

interface ExportCenterPageProps {
  userProfile?: UserProfile;
}

export const ExportCenterPage: React.FC<ExportCenterPageProps> = ({ userProfile: propUserProfile }) => {
  const { userProfile: authUserProfile, loading: authLoading, currentUser } = useAuth();
  const userProfile = propUserProfile || authUserProfile;
  const isInvestor = userProfile?.role === 'INVESTOR';

  const [selectedCategory, setSelectedCategory] = useState<ExportCategory>(
    isInvestor ? 'LAPORAN_INVESTOR' : 'KEUANGAN'
  );
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('XLSX');
  const [scope, setScope] = useState<ReportScopeFilter>(isInvestor ? 'SHARING' : 'GABUNGAN');

  const defaultStartDate = () => {
    const d = new Date();
    d.setDate(1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1 < 10 ? `0${d.getMonth() + 1}` : `${d.getMonth() + 1}`;
    return `${year}-${month}-01`;
  };

  const [startDate, setStartDate] = useState(defaultStartDate());
  const [endDate, setEndDate] = useState(tanggalHariIni());
  const [accountId, setAccountId] = useState('SEMUA');
  const [productId, setProductId] = useState('SEMUA');
  const [employeeId, setEmployeeId] = useState('SEMUA');

  // Datasets
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [performances, setPerformances] = useState<DailyPerformance[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [settlements, setSettlements] = useState<ProfitSharingSettlement[]>([]);
  const [contents, setContents] = useState<ContentCalendarItem[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    if (authLoading || !currentUser || !userProfile?.active) {
      return;
    }
    setLoading(true);
    const unsubTx = onSnapshot(collection(db, 'transactions'), (s) =>
      setTransactions(s.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction)))
    );
    const unsubPerf = onSnapshot(collection(db, 'dailyPerformance'), (s) =>
      setPerformances(s.docs.map((d) => ({ id: d.id, ...d.data() } as DailyPerformance)))
    );
    const unsubExp = onSnapshot(collection(db, 'expenses'), (s) =>
      setExpenses(s.docs.map((d) => ({ id: d.id, ...d.data() } as Expense)))
    );
    const unsubProd = onSnapshot(collection(db, 'products'), (s) =>
      setProducts(s.docs.map((d) => ({ id: d.id, ...d.data() } as Product)))
    );
    const unsubSamp = onSnapshot(collection(db, 'samples'), (s) =>
      setSamples(s.docs.map((d) => ({ id: d.id, ...d.data() } as Sample)))
    );
    const unsubInv = onSnapshot(collection(db, 'inventory'), (s) =>
      setInventory(s.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryItem)))
    );
    const unsubEmp = onSnapshot(collection(db, 'employees'), (s) =>
      setEmployees(s.docs.map((d) => ({ id: d.id, ...d.data() } as Employee)))
    );
    const unsubAtt = onSnapshot(collection(db, 'attendances'), (s) =>
      setAttendances(s.docs.map((d) => ({ id: d.id, ...d.data() } as Attendance)))
    );
    const unsubPay = onSnapshot(collection(db, 'payrolls'), (s) =>
      setPayrolls(s.docs.map((d) => ({ id: d.id, ...d.data() } as Payroll)))
    );
    const unsubSet = onSnapshot(collection(db, 'profitSharingSettlements'), (s) =>
      setSettlements(s.docs.map((d) => ({ id: d.id, ...d.data() } as ProfitSharingSettlement)))
    );
    const unsubCont = onSnapshot(collection(db, 'contentCalendar'), (s) =>
      setContents(s.docs.map((d) => ({ id: d.id, ...d.data() } as ContentCalendarItem)))
    );
    const unsubAcc = onSnapshot(collection(db, 'accounts'), (s) => {
      setAccounts(s.docs.map((d) => ({ id: d.id, ...d.data() } as Account)));
      setLoading(false);
    });

    return () => {
      unsubTx();
      unsubPerf();
      unsubExp();
      unsubProd();
      unsubSamp();
      unsubInv();
      unsubEmp();
      unsubAtt();
      unsubPay();
      unsubSet();
      unsubCont();
      unsubAcc();
    };
  }, [authLoading, currentUser?.uid, userProfile?.role, userProfile?.active]);

  // Filter Helper
    const matchFilter = (item: any) => {
    // Exclude void records
    if (item.status === 'VOID') return false;

    // Investor constraint
    if (isInvestor) {
      if (item.scope && item.scope !== 'SHARING') return false;
    } else {
      if (scope !== 'GABUNGAN' && item.scope && item.scope !== scope) {
        return false;
      }
    }

    const dateVal = item.date || item.requestDate || item.receivedDate || item.joinDate;
    if (dateVal) {
      if (startDate && dateVal < startDate) return false;
      if (endDate && dateVal > endDate) return false;
    }

    if (accountId !== 'SEMUA' && item.accountId && item.accountId !== accountId) {
      return false;
    }
    if (productId !== 'SEMUA' && item.productId && item.productId !== productId) {
      return false;
    }
    if (employeeId !== 'SEMUA') {
      const emp = item.employeeId || item.userId;
      if (emp && emp !== employeeId) return false;
    }

    return true;
  };

  // Compile Export Payload based on Category
  const getCompiledData = (): Record<string, any>[] => {
    switch (selectedCategory) {
      case 'KEUANGAN':
        return transactions.filter(matchFilter).map((t) => ({
          Tanggal: t.date,
          Tipe: t.type === 'INCOME' ? 'UANG MASUK' : 'UANG KELUAR',
          Scope: t.scope,
          Kategori: t.category || '-',
          'Sumber Pendapatan': t.sourceType || '-',
          Deskripsi: t.description,
          Nominal: t.amount,
          Pencatat: t.createdByName || '-',
        }));

      case 'PERFORMA_AKUN':
        return performances.filter(matchFilter).map((p) => ({
          Tanggal: p.date,
          'Nama Akun': p.accountName || accounts.find((a) => a.id === p.accountId)?.accountName || '-',
          Scope: p.scope,
          GMV: p.gmv || 0,
          'Estimasi Komisi': p.estimatedCommission || 0,
          'Komisi Real': p.realCommission || 0,
          Catatan: p.notes || '-',
        }));

      case 'PENGELUARAN':
        return expenses.filter(matchFilter).map((e) => ({
          Tanggal: e.date,
          Kategori: e.category,
          Scope: e.scope,
          'Keterangan / Item': e.name || e.description || '-',
          Nominal: e.amount || 0,
          Pencatat: e.createdByName || '-',
        }));

      case 'PAYROLL':
        if (isInvestor) return [];
        return payrolls.filter((p) => {
          if (startDate && p.period && p.period < startDate.substring(0, 7)) return false;
          if (endDate && p.period && p.period > endDate.substring(0, 7)) return false;
          return true;
        }).map((p) => ({
          Periode: p.period,
          'Nama Karyawan': p.employeeName,
          Jabatan: p.position || '-',
          'Gaji Pokok': p.gajiPokok || 0,
          'Uang Rajin': p.uangRajinNominal || p.totalUangRajin || 0,
          Bonus: p.totalBonus || 0,
          Penyesuaian: p.totalAdjustment || 0,
          'Total Bersih': p.totalGajiBersih || p.gajiBersih || 0,
          Status: p.status,
          'Tanggal Bayar': p.paymentDate || '-',
        }));

      case 'ABSENSI':
        if (isInvestor) return [];
        return attendances.filter((a) => {
          if (startDate && a.date < startDate) return false;
          if (endDate && a.date > endDate) return false;
          if (employeeId !== 'SEMUA' && a.employeeId !== employeeId && a.userId !== employeeId) return false;
          return true;
        }).map((a) => ({
          Tanggal: a.date,
          'Nama Karyawan': a.employeeName || a.userName || '-',
          Status: a.status,
          'Jam Masuk': a.checkInTime || '-',
          'Jam Keluar': a.checkOutTime || '-',
          'Menit Terlambat': a.lateMinutes || a.menitTerlambat || 0,
          'Early Checkout': a.isEarlyCheckout ? 'Ya' : 'Tidak',
        }));

      case 'PRODUK':
        return products.filter((p) => {
          if (productId !== 'SEMUA' && p.id !== productId) return false;
          return true;
        }).map((p) => ({
          'Nama Produk': p.name,
          Kategori: p.category || '-',
          Brand: p.brand || '-',
          'Harga Jual': p.price || 0,
          'Link Produk': p.productUrl || '-',
          Deskripsi: p.description || '-',
        }));

      case 'SAMPEL':
        return samples.filter(matchFilter).map((s) => ({
          Tanggal: s.requestDate || s.receivedDate || '-',
          'Nama Sampel': s.productName || s.name,
          Akun: s.accountName || '-',
          Scope: s.scope,
          Biaya: s.cost || 0,
          Status: s.status,
          PIC: s.picName || '-',
        }));

      case 'INVENTORY':
        return inventory.filter((i) => {
          if (scope !== 'GABUNGAN' && i.scope && i.scope !== scope) return false;
          return true;
        }).map((i) => ({
          'Nama Barang': i.name,
          Kategori: i.category || '-',
          Lokasi: i.location || '-',
          Kondisi: i.condition,
          Jumlah: i.quantity || 1,
          'Harga Beli Satuan': i.purchasePrice || 0,
          'Total Nilai': (i.purchasePrice || 0) * (i.quantity || 1),
          PIC: i.picName || '-',
          Scope: i.scope || 'PRIBADI',
        }));

      case 'PROFIT_SHARING':
        return settlements.filter((s) => {
          if (startDate && s.period < startDate.substring(0, 7)) return false;
          if (endDate && s.period > endDate.substring(0, 7)) return false;
          return true;
        }).map((s) => ({
          Periode: s.period,
          Tier: s.tierName || `Tier ${s.tier}`,
          'Total Uang Masuk Sharing': s.totalUangMasuk || 0,
          'Hak Investor': s.bagianInvestor || 0,
          'Hak Owner': s.bagianOwner || 0,
          'Hak Talent': s.bagianTalent || 0,
          'Hak Editor': s.bagianEditor || 0,
          'Budget Perusahaan': s.budgetPerusahaan || 0,
          'Status Pembayaran Investor': s.statusPembayaran,
        }));

      case 'KONTEN':
        return contents.filter(matchFilter).map((c) => ({
          Tanggal: c.date,
          Jam: c.time,
          Akun: c.accountName || '-',
          Scope: c.scope,
          'Judul Konten': c.title,
          Produk: c.productName || '-',
          Talent: c.talentName || '-',
          Editor: c.editorName || '-',
          Status: c.status,
          Target: `${c.targetOutput || 1} ${c.unitOutput || 'VT'}`,
          'Link Posting': c.postedUrl || '-',
        }));

      case 'LAPORAN_INVESTOR':
        return settlements.map((s) => ({
          Periode: s.period,
          Tier: s.tierName || `Tier ${s.tier}`,
          'Total Uang Masuk Sharing': s.totalUangMasuk || 0,
          'Hak Investor': s.bagianInvestor || 0,
          'Status Bayar': s.statusPembayaran,
        }));

      default:
        return [];
    }
  };

  const compiledRows = getCompiledData();

  const handleExecuteExport = async () => {
    if (compiledRows.length === 0) {
      alert('Tidak ada baris data untuk diekspor dengan filter saat ini.');
      return;
    }

    await exportReportData({
      filenamePrefix: `export_${selectedCategory.toLowerCase()}`,
      sheetName: selectedCategory.substring(0, 25),
      category: selectedCategory,
      scope: isInvestor ? 'SHARING' : scope,
      periodOrDateRange: `${startDate}_sd_${endDate}`,
      data: compiledRows,
      format: selectedFormat,
      userProfile,
    });
  };

  const categoriesList: Array<{
    id: ExportCategory;
    label: string;
    investorAllowed: boolean;
  }> = [
    { id: 'KEUANGAN', label: 'Laporan Keuangan', investorAllowed: true },
    { id: 'PERFORMA_AKUN', label: 'Performa Akun TikTok', investorAllowed: true },
    { id: 'PENGELUARAN', label: 'Pengeluaran & Expense', investorAllowed: true },
    { id: 'PAYROLL', label: 'Rekapitulasi Payroll & Gaji', investorAllowed: false },
    { id: 'ABSENSI', label: 'Rekapitulasi Absensi', investorAllowed: false },
    { id: 'PRODUK', label: 'Katalog Produk Affiliate', investorAllowed: true },
    { id: 'SAMPEL', label: 'Pengadaan & Biaya Sampel', investorAllowed: true },
    { id: 'INVENTORY', label: 'Aset & Inventory Kantor', investorAllowed: true },
    { id: 'PROFIT_SHARING', label: 'Settlement Profit Sharing', investorAllowed: true },
    { id: 'KONTEN', label: 'Jadwal & Realisasi Konten VT', investorAllowed: true },
    { id: 'LAPORAN_INVESTOR', label: 'Laporan Khusus Investor', investorAllowed: true },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Page Title Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-emerald-600 rounded-2xl text-white shadow-md">
            <Download className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">
              EXPORT CENTER & DATA EXPORTER
            </h1>
            <p className="text-xs text-slate-300 font-medium">
              Unduh Data Kantor PT.KDRT dalam Format CSV atau Microsoft Excel (.xlsx) Resmi
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300">
            Hak Export: <span className="text-emerald-400 font-black">Aktif</span>
          </div>
        </div>
      </div>

      {/* Main Form Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Dataset & Format Selector */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-5">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-2">
              1. Pilih Kategori Data
            </label>
            <div className="space-y-1.5">
              {categoriesList
                .filter((cat) => (isInvestor ? cat.investorAllowed : true))
                .map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                      selectedCategory === cat.id
                        ? 'bg-emerald-50 text-emerald-950 border border-emerald-300 shadow-2xs'
                        : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <span>{cat.label}</span>
                    {selectedCategory === cat.id && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                  </button>
                ))}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-2">
              2. Pilih Format File
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedFormat('XLSX')}
                className={`p-3 rounded-xl border text-center transition-all ${
                  selectedFormat === 'XLSX'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-950 shadow-2xs'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <FileSpreadsheet className="h-5 w-5 mx-auto mb-1 text-emerald-600" />
                <div className="text-xs font-black">Excel (.xlsx)</div>
                <div className="text-[10px] text-slate-400">Tabel Terformat</div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedFormat('CSV')}
                className={`p-3 rounded-xl border text-center transition-all ${
                  selectedFormat === 'CSV'
                    ? 'border-slate-800 bg-slate-900 text-white shadow-2xs'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <FileText className="h-5 w-5 mx-auto mb-1 text-slate-400" />
                <div className="text-xs font-black">CSV (.csv)</div>
                <div className="text-[10px] text-slate-400">Plain Text Data</div>
              </button>
            </div>
          </div>
        </div>

        {/* Right Col: Filter & Export Action */}
        <div className="lg:col-span-2 space-y-6">
          {/* Filters Box */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2.5">
              <Filter className="h-4 w-4 text-emerald-600" />
              <span>3. Atur Parameter Filter Export</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Tanggal Awal
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Tanggal Akhir
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Scope Bisnis
                </label>
                {isInvestor ? (
                  <div className="rounded-xl border border-purple-200 bg-purple-50 p-2 text-xs font-black text-purple-700">
                    SHARING
                  </div>
                ) : (
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-300 p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="GABUNGAN">GABUNGAN</option>
                    <option value="PRIBADI">PRIBADI</option>
                    <option value="SHARING">SHARING</option>
                  </select>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Akun TikTok
                </label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="SEMUA">Semua Akun</option>
                  {accounts
                    .filter((a) => (isInvestor ? a.scope === 'SHARING' : true))
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.accountName}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Produk
                </label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="SEMUA">Semua Produk</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {!isInvestor && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Karyawan
                  </label>
                  <select
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="SEMUA">Semua Karyawan</option>
                    {employees.map((emp) => (
                      <option key={emp.id || emp.userId} value={emp.id || emp.userId}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Preview & Action Box */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Hasil Filter Siap Export
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {compiledRows.length} baris data ditemukan dan terverifikasi izin akses.
                </p>
              </div>

              <div className="text-right">
                <span className="inline-flex px-3 py-1 rounded-full text-xs font-mono font-black bg-emerald-100 text-emerald-800">
                  {compiledRows.length} Baris
                </span>
              </div>
            </div>

            {compiledRows.length > 0 ? (
              <div className="max-h-[160px] overflow-y-auto border border-slate-100 rounded-xl bg-slate-50 p-2 text-[11px] font-mono text-slate-600">
                <div className="font-bold text-slate-800 mb-1">Preview Baris Pertama:</div>
                <pre className="overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(compiledRows[0], null, 2)}
                </pre>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Tidak ada data yang cocok dengan kriteria filter saat ini.</span>
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={handleExecuteExport}
                disabled={compiledRows.length === 0}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-colors shadow-md disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                <span>
                  DOWNLOAD FILE {selectedFormat} ({compiledRows.length} BARIS DATA)
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
