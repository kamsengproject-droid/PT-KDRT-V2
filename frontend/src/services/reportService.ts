import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
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
  UserProfile,
} from '../types';

export interface FinancialSummaryData {
  uangMasuk: number;
  uangKeluar: number;
  saldoBersih: number;
  sourceTypeBreakdown: Array<{
    sourceType: string;
    label: string;
    total: number;
    count: number;
    percentage: number;
  }>;
  dailyTrend: Array<{
    date: string;
    uangMasuk: number;
    uangKeluar: number;
    saldoBersih: number;
  }>;
  transactionsList: Transaction[];
}

export interface AccountPerformanceReportData {
  accounts: Array<{
    accountId: string;
    accountName: string;
    scope: string;
    gmv: number;
    estimatedCommission: number;
    realCommission: number;
    previousGmv?: number;
    growthPercentage?: number;
    activeDays: number;
  }>;
  totalGmv: number;
  totalEstimatedCommission: number;
  totalRealCommission: number;
  overallGrowthPercentage: number;
}

export interface ExpenseReportData {
  totalExpense: number;
  categoryBreakdown: Array<{
    category: string;
    nominal: number;
    percentage: number;
    count: number;
    rank: number;
  }>;
  topExpenses: Expense[];
  expensesList: Expense[];
}

export interface ProductReportData {
  products: Array<{
    productId: string;
    productName: string;
    category?: string;
    brand?: string;
    gmv: number;
    realCommission: number;
    contentCount: number;
    accountsUsed: string[];
    daysGenerating: number;
    rank: number;
  }>;
  totalGmv: number;
  totalRealCommission: number;
  totalProductsActive: number;
}

export interface SampleReportData {
  totalBiayaSampel: number;
  totalJumlahSampel: number;
  statusBreakdown: Record<string, { count: number; cost: number }>;
  samplesList: Sample[];
  kontenBelumSelesaiCount: number;
}

export interface InventoryReportData {
  totalNilaiInventory: number;
  totalJumlahItem: number;
  totalJumlahUnit: number;
  categoryBreakdown: Record<string, { count: number; value: number }>;
  locationBreakdown: Record<string, { count: number; value: number }>;
  conditionBreakdown: {
    baik: number;
    perluPerbaikan: number;
    rusak: number;
    hilang: number;
  };
  itemsList: InventoryItem[];
}

export interface EmployeeReportData {
  totalKaryawanAktif: number;
  totalKaryawanNonaktif: number;
  jabatanBreakdown: Record<string, number>;
  scopeBreakdown: Record<string, number>;
  employeesList: Employee[];
}

export interface AttendanceReportData {
  totalHariKerja: number;
  totalHadir: number;
  totalTerlambat: number;
  totalTidakHadir: number;
  totalEarlyCheckout: number;
  totalMenitTerlambat: number;
  employeeStats: Array<{
    employeeId: string;
    employeeName: string;
    hadir: number;
    terlambat: number;
    totalMenitTerlambat: number;
    earlyCheckout: number;
    tidakHadir: number;
  }>;
}

export interface PayrollReportData {
  totalGajiPokok: number;
  totalUangRajin: number;
  totalBonus: number;
  totalAdjustment: number;
  totalPayroll: number;
  totalSudahDibayar: number;
  totalBelumDibayar: number;
  payrollsList: Payroll[];
}

export interface ProfitSharingReportData {
  totalUangMasukSharing: number;
  hakInvestor: number;
  hakOwner: number;
  hakTalent: number;
  hakEditor: number;
  budgetPerusahaan: number;
  sudahDibayar: number;
  belumDibayar: number;
  settlementsList: ProfitSharingSettlement[];
}

export interface ContentReportData {
  targetVt: number;
  terjadwal: number;
  diposting: number;
  tertunda: number;
  dibatalkan: number;
  ide: number;
  direkam: number;
  editing: number;
  siap: number;
  accountBreakdown: Array<{
    accountId: string;
    accountName: string;
    target: number;
    posted: number;
    outstanding: number;
  }>;
  employeeBreakdown: Array<{
    employeeId: string;
    employeeName: string;
    role: 'TALENT' | 'EDITOR';
    targetCount: number;
    postedCount: number;
  }>;
  contentsList: ContentCalendarItem[];
}

export interface InvestorReportData {
  uangMasukSharing: number;
  uangKeluarSharing: number;
  saldoSharing: number;
  expenseSharing: number;
  profitSharingMasuk: number;
  hakInvestor: number;
  sudahDibayar: number;
  sisaKewajiban: number;
  settlements: ProfitSharingSettlement[];
  expenses: Array<{
    date: string;
    category: string;
    description: string;
    amount: number;
  }>;
}

/**
 * Filter matching helper
 */
export function matchFilter(
  item: {
    date?: string;
    scope?: string;
    accountId?: string;
    productId?: string;
    employeeId?: string;
    userId?: string;
    category?: string;
    status?: string;
  },
  filter: ReportGlobalFilter,
  userProfile?: UserProfile
): boolean {
  // If user is Investor, forcibly constrain to SHARING
  if (userProfile?.role === 'INVESTOR') {
    if (item.scope && item.scope !== 'SHARING') return false;
  } else {
    if (filter.scope !== 'GABUNGAN' && item.scope && item.scope !== filter.scope) {
      return false;
    }
  }

  // Date range
  if (item.date) {
    if (filter.startDate && item.date < filter.startDate) return false;
    if (filter.endDate && item.date > filter.endDate) return false;
  }

  // Account
  if (filter.accountId !== 'SEMUA' && item.accountId && item.accountId !== filter.accountId) {
    return false;
  }

  // Product
  if (filter.productId !== 'SEMUA' && item.productId && item.productId !== filter.productId) {
    return false;
  }

  // Employee
  if (filter.employeeId !== 'SEMUA') {
    const empId = item.employeeId || item.userId;
    if (empId && empId !== filter.employeeId) return false;
  }

  // Category
  if (filter.category !== 'SEMUA' && item.category && item.category !== filter.category) {
    return false;
  }

  // Status
  if (filter.status !== 'SEMUA' && item.status && item.status !== filter.status) {
    return false;
  }

  return true;
}
