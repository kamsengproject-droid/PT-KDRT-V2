import React, { useState, useEffect } from 'react';
import {
  FileText,
  Wallet,
  Smartphone,
  TrendingDown,
  ShoppingBag,
  Package,
  Box,
  Users,
  Camera,
  CreditCard,
  PieChart,
  Film,
  ShieldCheck,
  Download,
  Loader2,
  Calendar,
} from 'lucide-react';
import {
  UserProfile,
  ReportSubMenu,
  ReportGlobalFilter,
  Transaction,
  DailyPerformance,
  Expense,
  Product,
  Sample,
  InventoryItem,
  Employee,
  Attendance,
  Payroll,
  ProfitSharingSettlement,
  ContentCalendarItem,
  Account,
} from '../types';
import { tanggalHariIni, formatRupiah } from '../utils/formatters';
import { ReportFilterBar } from '../components/reports/ReportFilterBar';
import { FinancialReportView } from '../components/reports/FinancialReportView';
import { AccountPerformanceReportView } from '../components/reports/AccountPerformanceReportView';
import { ExpenseReportView } from '../components/reports/ExpenseReportView';
import { ProductReportView } from '../components/reports/ProductReportView';
import { SampleReportView } from '../components/reports/SampleReportView';
import { InventoryReportView } from '../components/reports/InventoryReportView';
import { EmployeeReportView } from '../components/reports/EmployeeReportView';
import { AttendanceReportView } from '../components/reports/AttendanceReportView';
import { PayrollReportView } from '../components/reports/PayrollReportView';
import { ProfitSharingReportView } from '../components/reports/ProfitSharingReportView';
import { ContentReportView } from '../components/reports/ContentReportView';
import { InvestorReportView } from '../components/reports/InvestorReportView';
import { ExportCenterPage } from './ExportCenterPage';

// Firebase Services
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

interface LaporanPageProps {
  userProfile?: UserProfile;
}

export const LaporanPage: React.FC<LaporanPageProps> = ({ userProfile: propUserProfile }) => {
  const { userProfile: authUserProfile, loading: authLoading, currentUser } = useAuth();
  const userProfile = propUserProfile || authUserProfile;
  const isInvestor = userProfile?.role === 'INVESTOR';

  // Submenu Tab State
  const [activeTab, setActiveTab] = useState<ReportSubMenu>(
    isInvestor ? 'INVESTOR' : 'KEUANGAN'
  );

  // Global Filter State
  const defaultStartDate = () => {
    const d = new Date();
    d.setDate(1); // 1st of current month
    const year = d.getFullYear();
    const month = d.getMonth() + 1 < 10 ? `0${d.getMonth() + 1}` : `${d.getMonth() + 1}`;
    return `${year}-${month}-01`;
  };

  const [filter, setFilter] = useState<ReportGlobalFilter>({
    startDate: defaultStartDate(),
    endDate: tanggalHariIni(),
    scope: isInvestor ? 'SHARING' : 'GABUNGAN',
    accountId: 'SEMUA',
    productId: 'SEMUA',
    employeeId: 'SEMUA',
    category: 'SEMUA',
    status: 'SEMUA',
  });

  // Data Collections State
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

  // Real-time Subscriptions
  useEffect(() => {
    if (authLoading || !currentUser || !userProfile?.active) {
      return;
    }
    setLoading(true);

    const unsubTx = onSnapshot(collection(db, 'transactions'), (snap) => {
      setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction)));
    });

    const unsubPerf = onSnapshot(collection(db, 'dailyPerformance'), (snap) => {
      setPerformances(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DailyPerformance)));
    });

    const unsubExp = onSnapshot(collection(db, 'expenses'), (snap) => {
      setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Expense)));
    });

    const unsubProd = onSnapshot(collection(db, 'products'), (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
    });

    const unsubSamp = onSnapshot(collection(db, 'samples'), (snap) => {
      setSamples(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Sample)));
    });

    const unsubInv = onSnapshot(collection(db, 'inventory'), (snap) => {
      setInventory(snap.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryItem)));
    });

    const unsubEmp = onSnapshot(collection(db, 'employees'), (snap) => {
      setEmployees(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Employee)));
    });

    const unsubAtt = onSnapshot(collection(db, 'attendances'), (snap) => {
      setAttendances(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Attendance)));
    });

    const unsubPay = onSnapshot(collection(db, 'payrolls'), (snap) => {
      setPayrolls(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Payroll)));
    });

    const unsubSet = onSnapshot(collection(db, 'profitSharingSettlements'), (snap) => {
      setSettlements(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProfitSharingSettlement)));
    });

    const unsubCont = onSnapshot(collection(db, 'contentCalendar'), (snap) => {
      setContents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ContentCalendarItem)));
    });

    const unsubAcc = onSnapshot(collection(db, 'accounts'), (snap) => {
      setAccounts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Account)));
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
  const filterByDateAndScope = (item: {
    date?: string;
    requestDate?: string;
    receivedDate?: string;
    period?: string;
    scope?: string;
    accountId?: string;
    productId?: string;
    employeeId?: string;
    userId?: string;
  }) => {
    // 1. Investor Constraint
    if (isInvestor) {
      if (item.scope && item.scope !== 'SHARING') return false;
    } else {
      if (filter.scope !== 'GABUNGAN' && item.scope && item.scope !== filter.scope) {
        return false;
      }
    }

    // 2. Date Constraint
    const itemDate = item.date || item.requestDate || item.receivedDate;
    if (itemDate) {
      if (filter.startDate && itemDate < filter.startDate) return false;
      if (filter.endDate && itemDate > filter.endDate) return false;
    }

    // 3. Account Constraint
    if (filter.accountId !== 'SEMUA' && item.accountId && item.accountId !== filter.accountId) {
      return false;
    }

    // 4. Product Constraint
    if (filter.productId !== 'SEMUA' && item.productId && item.productId !== filter.productId) {
      return false;
    }

    // 5. Employee Constraint
    if (filter.employeeId !== 'SEMUA') {
      const empId = item.employeeId || item.userId;
      if (empId && empId !== filter.employeeId) return false;
    }

    return true;
  };

  // Filtered Datasets
  const filteredTransactions = transactions.filter(filterByDateAndScope);
  const filteredPerformances = performances.filter(filterByDateAndScope);
  const filteredExpenses = expenses.filter(filterByDateAndScope);
  const filteredSamples = samples.filter(filterByDateAndScope);
  const filteredContents = contents.filter(filterByDateAndScope);
  const filteredPayrolls = payrolls.filter((p) => {
    if (isInvestor) return false;
    return true;
  });
  const filteredAttendances = attendances.filter((a) => {
    if (isInvestor) return false;
    if (filter.startDate && a.date < filter.startDate) return false;
    if (filter.endDate && a.date > filter.endDate) return false;
    if (filter.employeeId !== 'SEMUA') {
      const empId = a.employeeId || a.userId;
      if (empId !== filter.employeeId) return false;
    }
    return true;
  });
  const filteredSettlements = settlements.filter((s) => {
    // Settlements match
    return true;
  });

  const dateRangeStr = `${filter.startDate}_sd_${filter.endDate}`;

  // Menu items list
  const subMenuItems: Array<{
    id: ReportSubMenu;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    investorAllowed: boolean;
  }> = [
    { id: 'KEUANGAN', label: 'Ringkasan Keuangan', icon: Wallet, investorAllowed: true },
    { id: 'PERFORMA_AKUN', label: 'Performa Akun', icon: Smartphone, investorAllowed: true },
    { id: 'PENGELUARAN', label: 'Pengeluaran', icon: TrendingDown, investorAllowed: true },
    { id: 'PRODUK', label: 'Produk', icon: ShoppingBag, investorAllowed: true },
    { id: 'SAMPEL', label: 'Sampel', icon: Package, investorAllowed: true },
    { id: 'INVENTORY', label: 'Inventaris & Aset', icon: Box, investorAllowed: true },
    { id: 'KARYAWAN', label: 'Data Karyawan', icon: Users, investorAllowed: false },
    { id: 'ABSENSI', label: 'Absensi', icon: Camera, investorAllowed: false },
    { id: 'PENGGAJIAN', label: 'Salary Karyawan', icon: CreditCard, investorAllowed: false },
    { id: 'PROFIT_SHARING', label: 'Profit Sharing', icon: PieChart, investorAllowed: true },
    { id: 'KONTEN', label: 'Konten', icon: Film, investorAllowed: true },
    { id: 'INVESTOR', label: 'Laporan Investor', icon: ShieldCheck, investorAllowed: true },
    { id: 'EKSPOR', label: 'Ekspor CSV / XLSX', icon: Download, investorAllowed: true },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Page Title Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-orange-600 rounded-2xl text-white shadow-md">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">
              PUSAT LAPORAN & REKAPITULASI KANTOR
            </h1>
            <p className="text-xs text-slate-300 font-medium">
              Analisis Komprehensif Arus Kas, Performa Penjualan, Profit Sharing, dan Produktivitas Tim
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300">
            Role: <span className="text-orange-400 font-black">{userProfile.role}</span>
          </div>
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300">
            Scope: <span className="text-emerald-400 font-black">{filter.scope}</span>
          </div>
        </div>
      </div>

      {/* 12 Submenu Nav Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200">
        {subMenuItems
          .filter((item) => (isInvestor ? item.investorAllowed : true))
          .map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-orange-600 text-white shadow-2xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
      </div>

      {/* Universal Filter Bar */}
      <ReportFilterBar
        filter={filter}
        onChangeFilter={setFilter}
        accounts={accounts}
        products={products}
        employees={employees}
        userProfile={userProfile}
        onReset={() =>
          setFilter({
            startDate: defaultStartDate(),
            endDate: tanggalHariIni(),
            scope: isInvestor ? 'SHARING' : 'GABUNGAN',
            accountId: 'SEMUA',
            productId: 'SEMUA',
            employeeId: 'SEMUA',
            category: 'SEMUA',
            status: 'SEMUA',
          })
        }
      />

      {/* Loading Indicator */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-orange-600 mx-auto" />
          <div className="text-xs font-bold text-slate-500">
            Mengambil data laporan terpusat dari Firebase...
          </div>
        </div>
      ) : (
        /* Report Content Views */
        <div>
          {activeTab === 'KEUANGAN' && (
            <FinancialReportView
              transactions={filteredTransactions}
              userProfile={userProfile}
              scope={filter.scope}
              dateRange={dateRangeStr}
            />
          )}

          {activeTab === 'PERFORMA_AKUN' && (
            <AccountPerformanceReportView
              performances={filteredPerformances}
              accounts={accounts}
              userProfile={userProfile}
              scope={filter.scope}
              dateRange={dateRangeStr}
            />
          )}

          {activeTab === 'PENGELUARAN' && (
            <ExpenseReportView
              expenses={filteredExpenses}
              userProfile={userProfile}
              scope={filter.scope}
              dateRange={dateRangeStr}
            />
          )}

          {activeTab === 'PRODUK' && (
            <ProductReportView
              products={products}
              performances={filteredPerformances}
              contents={filteredContents}
              userProfile={userProfile}
              scope={filter.scope}
              dateRange={dateRangeStr}
            />
          )}

          {activeTab === 'SAMPEL' && (
            <SampleReportView
              samples={filteredSamples}
              userProfile={userProfile}
              scope={filter.scope}
              dateRange={dateRangeStr}
            />
          )}

          {activeTab === 'INVENTORY' && (
            <InventoryReportView
              inventory={inventory}
              userProfile={userProfile}
              scope={filter.scope}
              dateRange={dateRangeStr}
            />
          )}

          {activeTab === 'KARYAWAN' && (
            <EmployeeReportView
              employees={employees}
              userProfile={userProfile}
              scope={filter.scope}
              dateRange={dateRangeStr}
            />
          )}

          {activeTab === 'ABSENSI' && (
            <AttendanceReportView
              attendances={filteredAttendances}
              employees={employees}
              userProfile={userProfile}
              scope={filter.scope}
              dateRange={dateRangeStr}
            />
          )}

          {activeTab === 'PENGGAJIAN' && (
            <PayrollReportView
              payrolls={filteredPayrolls}
              userProfile={userProfile}
              scope={filter.scope}
              dateRange={dateRangeStr}
            />
          )}

          {activeTab === 'PROFIT_SHARING' && (
            <ProfitSharingReportView
              settlements={filteredSettlements}
              userProfile={userProfile}
              scope={filter.scope}
              dateRange={dateRangeStr}
            />
          )}

          {activeTab === 'KONTEN' && (
            <ContentReportView
              contents={filteredContents}
              accounts={accounts}
              employees={employees}
              userProfile={userProfile}
              scope={filter.scope}
              dateRange={dateRangeStr}
            />
          )}

          {activeTab === 'INVESTOR' && (
            <InvestorReportView
              transactions={filteredTransactions}
              expenses={filteredExpenses}
              settlements={filteredSettlements}
              userProfile={userProfile}
              scope={filter.scope}
              dateRange={dateRangeStr}
            />
          )}

          {activeTab === 'EKSPOR' && (
            <ExportCenterPage userProfile={userProfile} />
          )}
        </div>
      )}
    </div>
  );
};
