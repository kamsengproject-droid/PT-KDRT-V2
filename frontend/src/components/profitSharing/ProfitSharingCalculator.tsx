import React, { useState, useEffect, useMemo } from 'react';
import {
  Calculator,
  AlertTriangle,
  CheckCircle2,
  Share2,
  ArrowRight,
  UserCheck,
  ShieldCheck,
  Ban,
  DollarSign,
  TrendingUp,
  FileCheck,
  Clock,
  Sparkles,
  Info,
  Calendar,
  Layers,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  ProfitSharingTier,
  ProfitSharingSettlement,
  Employee,
  SettlementStatus,
} from '../../types';
import {
  calculateProfitSharingFromTransactions,
  ProfitSharingCalculationResult,
  saveDraftOrReviewSettlement,
  approveSettlement,
  voidSettlement,
  getActiveSettlementForMonth,
} from '../../services/profitSharingService';
import { subscribeEmployees } from '../../services/employeeService';
import { formatRupiah, formatBulanTahun, bulanHariIni, tanggalHariIni } from '../../utils/formatters';

interface ProfitSharingCalculatorProps {
  tiers: ProfitSharingTier[];
  onOpenWithdrawalModal?: (settlementId: string) => void;
  onNavigateToTiers?: () => void;
}

export const ProfitSharingCalculator: React.FC<ProfitSharingCalculatorProps> = ({
  tiers,
  onOpenWithdrawalModal,
  onNavigateToTiers,
}) => {
  const { userProfile, role } = useAuth();
  const isOwner = role === 'OWNER';
  const isManager = role === 'MANAGER';

  // Period selection
  const [selectedMonthStr, setSelectedMonthStr] = useState<string>(bulanHariIni()); // "2026-08"
  const [year, setYear] = useState<number>(parseInt(bulanHariIni().split('-')[0], 10));
  const [month, setMonth] = useState<string>(bulanHariIni().split('-')[1]);

  // Calculations & Settlement State
  const [calcResult, setCalcResult] = useState<ProfitSharingCalculationResult | null>(null);
  const [activeSettlement, setActiveSettlement] = useState<ProfitSharingSettlement | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Custom percentages override (if Owner wants to adjust formula for settlement)
  const [customInvestorPct, setCustomInvestorPct] = useState<number | null>(null);
  const [customOwnerPct, setCustomOwnerPct] = useState<number | null>(null);
  const [customTalentPct, setCustomTalentPct] = useState<number | null>(null);
  const [customEditorPct, setCustomEditorPct] = useState<number | null>(null);
  const [customBudgetPct, setCustomBudgetPct] = useState<number | null>(null);

  // PIC Employee selection
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedTalentEmpId, setSelectedTalentEmpId] = useState<string>('');
  const [selectedEditorEmpId, setSelectedEditorEmpId] = useState<string>('');

  // Void modal state
  const [showVoidModal, setShowVoidModal] = useState<boolean>(false);
  const [voidReason, setVoidReason] = useState<string>('');

  // Handle month picker change
  const handleMonthChange = (val: string) => {
    setSelectedMonthStr(val);
    const [y, m] = val.split('-');
    setYear(parseInt(y, 10));
    setMonth(m);
    // Reset custom overrides when month changes
    setCustomInvestorPct(null);
    setCustomOwnerPct(null);
    setCustomTalentPct(null);
    setCustomEditorPct(null);
    setCustomBudgetPct(null);
  };

  // Load employees
  useEffect(() => {
    const unsubEmp = subscribeEmployees(undefined, setEmployees);
    return () => unsubEmp();
  }, []);

  // Filter Talent & Editor employees
  const talentEmployees = useMemo(() => {
    return employees.filter(
      (e) =>
        e.active !== false &&
        (e.position?.toLowerCase().includes('talent') ||
          e.position?.toLowerCase().includes('host') ||
          e.nickname?.toLowerCase().includes('melinda') ||
          e.name?.toLowerCase().includes('melinda'))
    );
  }, [employees]);

  const editorEmployees = useMemo(() => {
    return employees.filter(
      (e) =>
        e.active !== false &&
        (e.position?.toLowerCase().includes('editor') ||
          e.position?.toLowerCase().includes('video') ||
          e.nickname?.toLowerCase().includes('desta') ||
          e.name?.toLowerCase().includes('desta'))
    );
  }, [employees]);

  // Load calculation and active settlement
  const loadData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      // 1. Check if an active settlement already exists in Firestore
      const settlement = await getActiveSettlementForMonth(year, month);
      setActiveSettlement(settlement);

      if (settlement) {
        setSelectedTalentEmpId(settlement.talentEmployeeId || '');
        setSelectedEditorEmpId(settlement.editorEmployeeId || '');
      }

      // 2. Perform live calculation from transactions collection
      const overrides =
        customInvestorPct !== null ||
        customOwnerPct !== null ||
        customTalentPct !== null ||
        customEditorPct !== null ||
        customBudgetPct !== null
          ? {
              investorPercentage: customInvestorPct !== null ? customInvestorPct : undefined,
              ownerPercentage: customOwnerPct !== null ? customOwnerPct : undefined,
              talentPercentage: customTalentPct !== null ? customTalentPct : undefined,
              editorPercentage: customEditorPct !== null ? customEditorPct : undefined,
              companyBudgetPercentage: customBudgetPct !== null ? customBudgetPct : undefined,
            }
          : undefined;

      const calc = await calculateProfitSharingFromTransactions(
        year,
        month,
        tiers,
        overrides
      );
      setCalcResult(calc);
    } catch (err: any) {
      console.error('Error loading profit sharing calculation:', err);
      setErrorMessage(err.message || 'Gagal memuat perhitungan bagi hasil.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [
    year,
    month,
    tiers,
    customInvestorPct,
    customOwnerPct,
    customTalentPct,
    customEditorPct,
    customBudgetPct,
  ]);

  // Save as Draft or Review
  const handleSaveSettlement = async (status: 'DRAFT' | 'REVIEW') => {
    if (!calcResult || !userProfile) return;
    setActionLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const talentObj = employees.find((e) => e.id === selectedTalentEmpId);
      const editorObj = employees.find((e) => e.id === selectedEditorEmpId);

      await saveDraftOrReviewSettlement(
        calcResult,
        {
          status,
          talentEmployeeId: selectedTalentEmpId,
          talentEmployeeName: talentObj?.name || '',
          editorEmployeeId: selectedEditorEmpId,
          editorEmployeeName: editorObj?.name || '',
          statusNotes: `Disimpan oleh ${userProfile.name} pada ${new Date().toLocaleString('id-ID')}`,
        },
        userProfile
      );

      setSuccessMessage(
        status === 'REVIEW'
          ? `Settlement ${calcResult.periodLabel} berhasil diajukan untuk REVIEW Owner.`
          : `Draft settlement ${calcResult.periodLabel} berhasil disimpan.`
      );
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan settlement.');
    } finally {
      setActionLoading(false);
    }
  };

  // Approve Settlement
  const handleApproveSettlement = async () => {
    if (!calcResult || !userProfile) return;
    setActionLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // If no settlement created yet, create draft first then approve
      let targetDocId = activeSettlement?.id;
      if (!targetDocId) {
        const talentObj = employees.find((e) => e.id === selectedTalentEmpId);
        const editorObj = employees.find((e) => e.id === selectedEditorEmpId);

        targetDocId = await saveDraftOrReviewSettlement(
          calcResult,
          {
            status: 'DRAFT',
            talentEmployeeId: selectedTalentEmpId,
            talentEmployeeName: talentObj?.name || '',
            editorEmployeeId: selectedEditorEmpId,
            editorEmployeeName: editorObj?.name || '',
          },
          userProfile
        );
      }

      await approveSettlement(targetDocId, userProfile);
      setSuccessMessage(
        `Settlement ${calcResult.periodLabel} BERHASIL DISETUJUI (APPROVED). Hak Investor tercatat sebagai Kewajiban.`
      );
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyetujui settlement.');
    } finally {
      setActionLoading(false);
    }
  };

  // Void Settlement
  const handleVoidSettlement = async () => {
    if (!activeSettlement?.id || !userProfile) return;
    if (!voidReason.trim()) {
      setErrorMessage('Harap isi alasan pembatalan settlement.');
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await voidSettlement(activeSettlement.id, voidReason, userProfile);
      setSuccessMessage(`Settlement ${activeSettlement.periodLabel} telah DIBATALKAN (VOID).`);
      setShowVoidModal(false);
      setVoidReason('');
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal membatalkan settlement.');
    } finally {
      setActionLoading(false);
    }
  };

  // Reset custom percentage adjustments back to tier defaults
  const handleResetPercentages = () => {
    setCustomInvestorPct(null);
    setCustomOwnerPct(null);
    setCustomTalentPct(null);
    setCustomEditorPct(null);
    setCustomBudgetPct(null);
  };

  const isApproved = activeSettlement?.status === 'APPROVED';
  const isPaidOrPartial =
    activeSettlement?.status === 'PAID' || activeSettlement?.status === 'PARTIALLY_PAID';
  const isLocked = isApproved || isPaidOrPartial;

  return (
    <div className="space-y-6">
      {/* 1. Header & Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-purple-50 text-purple-700 border border-purple-200">
              <Calculator className="h-3.5 w-3.5" />
              KALKULATOR & SETTLEMENT PROFIT SHARING
            </span>
            {activeSettlement && (
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${
                  activeSettlement.status === 'APPROVED'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : activeSettlement.status === 'PAID'
                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                    : activeSettlement.status === 'PARTIALLY_PAID'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : activeSettlement.status === 'REVIEW'
                    ? 'bg-orange-100 text-orange-800 border border-orange-300'
                    : activeSettlement.status === 'VOID'
                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                    : 'bg-zinc-100 text-zinc-700 border border-zinc-300'
                }`}
              >
                STATUS: {activeSettlement.status}
              </span>
            )}
          </div>
          <h2 className="text-xl font-black text-zinc-900 tracking-tight">
            Perhitungan Bagi Hasil Kategori Sharing
          </h2>
          <p className="text-xs text-zinc-500 max-w-2xl leading-relaxed">
            Dihitung otomatis berdasarkan <strong>Uang Masuk Sharing Nyata</strong> (bukan GMV/estimasi) dari Buku Kas Master Transaksi. Hak investor dicatat sebagai <em>Kewajiban (Accrued)</em> dan hanya menjadi pengeluaran kas ketika dibayarkan.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-zinc-50 rounded-xl border border-zinc-200 p-2 shrink-0">
          <Calendar className="h-4 w-4 text-zinc-500 ml-1" />
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase text-zinc-400">Periode Bulan:</span>
            <input
              type="month"
              value={selectedMonthStr}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-bold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>
      </div>

      {/* Alert Notices */}
      {errorMessage && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-800 flex items-start gap-3 shadow-2xs">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-extrabold text-sm">Peringatan Validasi:</p>
            <p className="font-medium text-rose-700 leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800 flex items-center gap-3 shadow-2xs">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* 2. Active Tier & Formula Banner */}
      {calcResult && (
        <div
          className={`rounded-2xl p-5 border shadow-2xs transition-all ${
            calcResult.isFormulaValid
              ? 'bg-linear-to-r from-zinc-900 to-zinc-800 text-white border-zinc-800'
              : 'bg-amber-50 border-amber-300 text-amber-950'
          }`}
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                    calcResult.isFormulaValid
                      ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
                      : 'bg-rose-500 text-white font-black animate-pulse'
                  }`}
                >
                  {calcResult.isFormulaValid ? 'FORMULA VALID (100%)' : 'PERLU PENYESUAIAN FORMULA'}
                </span>
                <span
                  className={`text-xs font-bold ${
                    calcResult.isFormulaValid ? 'text-zinc-400' : 'text-amber-800'
                  }`}
                >
                  Tier Aktif: <strong>{calcResult.activeTier.name}</strong>
                </span>
              </div>
              <h3 className="text-lg font-black tracking-tight">
                {calcResult.isFormulaValid
                  ? `Skema Bagi Hasil ${formatBulanTahun(selectedMonthStr)}`
                  : `⚠️ Peringatan: Total Formula ${calcResult.totalPercentage}% (Melebihi 100%)`}
              </h3>
              <p
                className={`text-xs max-w-3xl leading-relaxed ${
                  calcResult.isFormulaValid ? 'text-zinc-300' : 'text-amber-900 font-medium'
                }`}
              >
                {calcResult.isFormulaValid
                  ? calcResult.activeTier.description ||
                    `Uang masuk tercatat ${formatRupiah(calcResult.totalIncome)}. Formula persentase seimbang 100%.`
                  : `Uang masuk sharing mencapai ${formatRupiah(calcResult.totalIncome)}. Formula tier ini menghasilkan total ${calcResult.totalPercentage}%. Sistem tidak memotong bagian pihak manapun secara otomatis. Owner harus menyesuaikan persentase sebelum settlement dapat disetujui (APPROVED).`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <div
                className={`p-3 rounded-xl border ${
                  calcResult.isFormulaValid
                    ? 'bg-zinc-800/80 border-zinc-700 text-white'
                    : 'bg-white border-amber-300 text-amber-950'
                }`}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  TOTAL PERSENTASE
                </div>
                <div
                  className={`text-xl font-black ${
                    calcResult.isFormulaValid ? 'text-emerald-400' : 'text-rose-600'
                  }`}
                >
                  {calcResult.totalPercentage}%{' '}
                  <span className="text-xs font-normal text-zinc-400">
                    {calcResult.isFormulaValid
                      ? '(Pas 100%)'
                      : `(Selisih +${calcResult.totalPercentage - 100}%)`}
                  </span>
                </div>
              </div>

              {onNavigateToTiers && isOwner && (
                <button
                  onClick={onNavigateToTiers}
                  className="rounded-xl bg-white/10 hover:bg-white/20 text-white px-3 py-2 text-xs font-bold border border-white/20 transition-colors inline-flex items-center gap-1.5"
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>Konfigurasi Tier</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Three Top KPI Metrics from Master Transactions */}
      {calcResult && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-2xs">
            <div className="flex items-center justify-between text-emerald-800">
              <span className="text-[11px] font-black uppercase tracking-wider">
                UANG MASUK SHARING NYATA
              </span>
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-950 mt-2">
              {formatRupiah(calcResult.totalIncome)}
            </div>
            <div className="text-[11px] font-medium text-emerald-700 mt-1">
              Dasar Perhitungan Bagi Hasil (Kas Riil)
            </div>
          </div>

          <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-5 shadow-2xs">
            <div className="flex items-center justify-between text-rose-800">
              <span className="text-[11px] font-black uppercase tracking-wider">
                PENGELUARAN SHARING
              </span>
              <DollarSign className="h-4 w-4 text-rose-600" />
            </div>
            <div className="text-2xl font-black text-rose-950 mt-2">
              {formatRupiah(calcResult.totalExpense)}
            </div>
            <div className="text-[11px] font-medium text-rose-700 mt-1">
              Biaya Operasional, Sampel & Inventory
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between text-zinc-600">
              <span className="text-[11px] font-black uppercase tracking-wider">
                ARUS KAS BERSIH (NET)
              </span>
              <Sparkles className="h-4 w-4 text-purple-600" />
            </div>
            <div
              className={`text-2xl font-black mt-2 ${
                calcResult.netProfit >= 0 ? 'text-zinc-900' : 'text-rose-600'
              }`}
            >
              {formatRupiah(calcResult.netProfit)}
            </div>
            <div className="text-[11px] font-medium text-zinc-400 mt-1">
              Saldo Mutasi Kas Periode Ini
            </div>
          </div>
        </div>
      )}

      {/* 4. Five Pillars Distribution Breakdown */}
      {calcResult && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-800 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-600" />
              Rincian Alokasi Nominal Bagi Hasil (5 Pilar)
            </h3>
            {isOwner && !isLocked && (
              <button
                onClick={handleResetPercentages}
                className="text-xs text-purple-600 hover:text-purple-700 font-bold underline"
              >
                Reset ke Persentase Tier Default
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Pilar 1: INVESTOR (45%) */}
            <div className="rounded-2xl border border-blue-200 bg-linear-to-b from-blue-50/60 to-white p-4 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-blue-900 uppercase">1. Hak Investor</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-100 text-blue-800">
                    {calcResult.investorPercentage}%
                  </span>
                </div>
                <div className="text-xl font-black text-blue-950 mt-3">
                  {formatRupiah(calcResult.investorAmount)}
                </div>
                <p className="text-[11px] text-blue-700 mt-1">
                  Status: <strong>Accrued (Kewajiban)</strong> sampai dibayarkan melalui menu penarikan.
                </p>
              </div>

              {isOwner && !isLocked && (
                <div className="mt-4 pt-3 border-t border-blue-100">
                  <label className="text-[10px] font-bold text-zinc-500 block mb-1">
                    Sesuaikan % Investor:
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={
                      customInvestorPct !== null
                        ? customInvestorPct
                        : calcResult.investorPercentage
                    }
                    onChange={(e) => setCustomInvestorPct(Number(e.target.value))}
                    className="w-full rounded-lg border border-blue-200 bg-white px-2 py-1 text-xs font-bold text-zinc-800"
                  />
                </div>
              )}
            </div>

            {/* Pilar 2: OWNER (45%) */}
            <div className="rounded-2xl border border-purple-200 bg-linear-to-b from-purple-50/60 to-white p-4 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-purple-900 uppercase">2. Bagian Owner</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-100 text-purple-800">
                    {calcResult.ownerPercentage}%
                  </span>
                </div>
                <div className="text-xl font-black text-purple-950 mt-3">
                  {formatRupiah(calcResult.ownerAmount)}
                </div>
                <p className="text-[11px] text-purple-700 mt-1">
                  Hak Pengelola & Manajemen PT.KDRT.
                </p>
              </div>

              {isOwner && !isLocked && (
                <div className="mt-4 pt-3 border-t border-purple-100">
                  <label className="text-[10px] font-bold text-zinc-500 block mb-1">
                    Sesuaikan % Owner:
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={
                      customOwnerPct !== null
                        ? customOwnerPct
                        : calcResult.ownerPercentage
                    }
                    onChange={(e) => setCustomOwnerPct(Number(e.target.value))}
                    className="w-full rounded-lg border border-purple-200 bg-white px-2 py-1 text-xs font-bold text-zinc-800"
                  />
                </div>
              )}
            </div>

            {/* Pilar 3: TALENT (5% / 7% / 10%) */}
            <div className="rounded-2xl border border-emerald-200 bg-linear-to-b from-emerald-50/60 to-white p-4 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-900 uppercase">3. Bagian Talent</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800">
                    {calcResult.talentPercentage}%
                  </span>
                </div>
                <div className="text-xl font-black text-emerald-950 mt-3">
                  {formatRupiah(calcResult.talentAmount)}
                </div>

                {/* Talent Employee Selector */}
                <div className="mt-2">
                  <label className="text-[10px] font-bold text-emerald-800 block mb-0.5">
                    Karyawan PIC Talent:
                  </label>
                  <select
                    value={selectedTalentEmpId}
                    onChange={(e) => setSelectedTalentEmpId(e.target.value)}
                    disabled={isLocked}
                    className="w-full rounded-lg border border-emerald-200 bg-white px-2 py-1 text-xs font-bold text-zinc-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-zinc-100"
                  >
                    <option value="">-- Pilih PIC Talent --</option>
                    {talentEmployees.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.position})
                      </option>
                    ))}
                    {talentEmployees.length === 0 && (
                      <option disabled value="">
                        (Belum ada karyawan posisi Talent)
                      </option>
                    )}
                  </select>
                </div>
              </div>

              {isOwner && !isLocked && (
                <div className="mt-4 pt-3 border-t border-emerald-100">
                  <label className="text-[10px] font-bold text-zinc-500 block mb-1">
                    Sesuaikan % Talent:
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={
                      customTalentPct !== null
                        ? customTalentPct
                        : calcResult.talentPercentage
                    }
                    onChange={(e) => setCustomTalentPct(Number(e.target.value))}
                    className="w-full rounded-lg border border-emerald-200 bg-white px-2 py-1 text-xs font-bold text-zinc-800"
                  />
                </div>
              )}
            </div>

            {/* Pilar 4: EDITOR (5% / 7% / 10%) */}
            <div className="rounded-2xl border border-amber-200 bg-linear-to-b from-amber-50/60 to-white p-4 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-900 uppercase">4. Bagian Editor</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-800">
                    {calcResult.editorPercentage}%
                  </span>
                </div>
                <div className="text-xl font-black text-amber-950 mt-3">
                  {formatRupiah(calcResult.editorAmount)}
                </div>

                {/* Editor Employee Selector */}
                <div className="mt-2">
                  <label className="text-[10px] font-bold text-amber-800 block mb-0.5">
                    Karyawan PIC Editor:
                  </label>
                  <select
                    value={selectedEditorEmpId}
                    onChange={(e) => setSelectedEditorEmpId(e.target.value)}
                    disabled={isLocked}
                    className="w-full rounded-lg border border-amber-200 bg-white px-2 py-1 text-xs font-bold text-zinc-800 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:bg-zinc-100"
                  >
                    <option value="">-- Pilih PIC Editor --</option>
                    {editorEmployees.map((ed) => (
                      <option key={ed.id} value={ed.id}>
                        {ed.name} ({ed.position})
                      </option>
                    ))}
                    {editorEmployees.length === 0 && (
                      <option disabled value="">
                        (Belum ada karyawan posisi Editor)
                      </option>
                    )}
                  </select>
                </div>
              </div>

              {isOwner && !isLocked && (
                <div className="mt-4 pt-3 border-t border-amber-100">
                  <label className="text-[10px] font-bold text-zinc-500 block mb-1">
                    Sesuaikan % Editor:
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={
                      customEditorPct !== null
                        ? customEditorPct
                        : calcResult.editorPercentage
                    }
                    onChange={(e) => setCustomEditorPct(Number(e.target.value))}
                    className="w-full rounded-lg border border-amber-200 bg-white px-2 py-1 text-xs font-bold text-zinc-800"
                  />
                </div>
              )}
            </div>

            {/* Pilar 5: BUDGET PERUSAHAAN (10% / 0%) */}
            <div className="rounded-2xl border border-zinc-300 bg-linear-to-b from-zinc-100 to-white p-4 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-zinc-900 uppercase">5. Budget PT.KDRT</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-zinc-200 text-zinc-800">
                    {calcResult.companyBudgetPercentage}%
                  </span>
                </div>
                <div className="text-xl font-black text-zinc-950 mt-3">
                  {formatRupiah(calcResult.companyBudgetAmount)}
                </div>
                <p className="text-[11px] text-zinc-600 mt-1">
                  Cadangan operasional / tak terduga perusahaan.
                </p>
              </div>

              {isOwner && !isLocked && (
                <div className="mt-4 pt-3 border-t border-zinc-200">
                  <label className="text-[10px] font-bold text-zinc-500 block mb-1">
                    Sesuaikan % Budget:
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={
                      customBudgetPct !== null
                        ? customBudgetPct
                        : calcResult.companyBudgetPercentage
                    }
                    onChange={(e) => setCustomBudgetPct(Number(e.target.value))}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs font-bold text-zinc-800"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. Settlement Actions Bar */}
      {calcResult && (
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-black uppercase text-zinc-700">
                Aksi Settlement: {formatBulanTahun(selectedMonthStr)}
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              {activeSettlement
                ? `Status saat ini: ${activeSettlement.status}. Dibuat oleh ${activeSettlement.createdByName || 'Sistem'}.`
                : 'Belum ada settlement tersimpan untuk periode ini.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* DRAFT BUTTON */}
            {!isLocked && (
              <button
                onClick={() => handleSaveSettlement('DRAFT')}
                disabled={actionLoading}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-zinc-100 hover:bg-zinc-200 text-zinc-800 transition-colors disabled:opacity-50"
              >
                Simpan DRAFT
              </button>
            )}

            {/* REVIEW BUTTON */}
            {!isLocked && (
              <button
                onClick={() => handleSaveSettlement('REVIEW')}
                disabled={actionLoading}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-orange-100 hover:bg-orange-200 text-orange-800 transition-colors disabled:opacity-50"
              >
                Ajukan REVIEW
              </button>
            )}

            {/* APPROVE BUTTON (OWNER ONLY) */}
            {isOwner && !isApproved && !isPaidOrPartial && (
              <button
                onClick={handleApproveSettlement}
                disabled={actionLoading || !calcResult.isFormulaValid}
                title={
                  !calcResult.isFormulaValid
                    ? 'Total formula harus tepat 100% untuk disetujui'
                    : 'Setujui settlement bagi hasil'
                }
                className={`px-4 py-2 rounded-xl text-xs font-black inline-flex items-center gap-1.5 transition-all shadow-xs ${
                  calcResult.isFormulaValid
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                }`}
              >
                <ShieldCheck className="h-4 w-4" />
                <span>SETUJUI (APPROVE)</span>
              </button>
            )}

            {/* WITHDRAWAL SHORTCUT IF APPROVED */}
            {(isApproved || isPaidOrPartial) && onOpenWithdrawalModal && isOwner && (
              <button
                onClick={() => onOpenWithdrawalModal(activeSettlement!.id!)}
                className="px-4 py-2 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-1.5 shadow-xs"
              >
                <DollarSign className="h-4 w-4" />
                <span>Bayar / Withdrawal Investor</span>
              </button>
            )}

            {/* VOID BUTTON */}
            {activeSettlement && activeSettlement.status !== 'VOID' && isOwner && (
              <button
                onClick={() => setShowVoidModal(true)}
                disabled={actionLoading}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors"
              >
                <Ban className="h-3.5 w-3.5 inline mr-1" />
                Batalkan (VOID)
              </button>
            )}
          </div>
        </div>
      )}

      {/* VOID Modal */}
      {showVoidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl border border-zinc-200 space-y-4">
            <div className="flex items-center gap-2 text-rose-600">
              <Ban className="h-5 w-5" />
              <h3 className="text-base font-black text-zinc-900">Batalkan (VOID) Settlement</h3>
            </div>
            <p className="text-xs text-zinc-500">
              Settlement periode <strong>{formatBulanTahun(selectedMonthStr)}</strong> akan dibatalkan. Tindakan ini tercatat pada Audit Log.
            </p>

            <div>
              <label className="text-xs font-bold text-zinc-700 block mb-1">
                Alasan Pembatalan (Wajib Minimal 5 Karakter):
              </label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Contoh: Koreksi transaksi komisi TikTok atau penyesuaian tier..."
                rows={3}
                className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowVoidModal(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100"
              >
                Batal
              </button>
              <button
                onClick={handleVoidSettlement}
                disabled={actionLoading || voidReason.trim().length < 5}
                className="px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
              >
                Konfirmasi VOID
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
