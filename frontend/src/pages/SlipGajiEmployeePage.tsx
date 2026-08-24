import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Calendar,
  CheckCircle2,
  FileText,
  DollarSign,
  Award,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  subscribeAttendanceBonusesByEmployee,
  subscribeEmployeePayroll,
} from '../services/payrollService';
import { AttendanceBonusWeek, PayrollRecord } from '../types';
import { formatBulanTahun, formatRupiah, formatTanggal, bulanSekarang } from '../utils/formatters';
import { SlipGajiModal } from '../components/SlipGajiModal';

export const SlipGajiEmployeePage: React.FC = () => {
  const { userProfile, employeeProfile, role, loading: authLoading, currentUser } = useAuth();
  const activeEmployeeId =
    employeeProfile?.id ||
    (userProfile?.name?.toLowerCase().includes('desta') ? 'desta-id' : 'melinda-id');
  const activeEmployeeName = employeeProfile?.name || userProfile?.name || 'Karyawan PT.KDRT';

  const [selectedMonth, setSelectedMonth] = useState<string>(bulanSekarang());
  const [payrollList, setPayrollList] = useState<PayrollRecord[]>([]);
  const [weeklyBonuses, setWeeklyBonuses] = useState<AttendanceBonusWeek[]>([]);
  const [selectedSlip, setSelectedSlip] = useState<PayrollRecord | null>(null);

  useEffect(() => {
    if (authLoading || !currentUser || !userProfile?.active || !activeEmployeeId) return;

    const unsubPay = subscribeEmployeePayroll(activeEmployeeId, setPayrollList);
    const unsubBon = subscribeAttendanceBonusesByEmployee(activeEmployeeId, setWeeklyBonuses);

    return () => {
      unsubPay();
      unsubBon();
    };
  }, [authLoading, currentUser?.uid, userProfile?.role, userProfile?.active, activeEmployeeId]);

  const myPayroll = payrollList.find((p) => p.month === selectedMonth);
  const myMonthBonuses = weeklyBonuses.filter(
    (b) => b.weekStart.startsWith(selectedMonth) || b.month === selectedMonth
  );

  const total = myPayroll?.totalPay || myPayroll?.total || 0;
  const isPaid = myPayroll?.status === 'PAID' || myPayroll?.status === 'SUDAH DIBAYAR';

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12" id="slip-gaji-employee-root">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
              <Sparkles className="h-3 w-3" />
              Portal Karyawan
            </span>
            <span className="text-xs text-zinc-400 font-medium">PT.KDRT</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 flex items-center gap-2.5 mt-1">
            <Wallet className="h-7 w-7 text-emerald-600" />
            Slip Gaji & Penghasilan Saya
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">
            Rincian gaji pokok, bonus uang rajin kedisiplinan mingguan, dan slip gaji resmi untuk{' '}
            <strong>{activeEmployeeName}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white rounded-2xl border border-zinc-200 p-2 shadow-2xs">
          <Calendar className="h-4 w-4 text-zinc-400 ml-1" />
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-transparent text-xs font-bold text-zinc-900 focus:outline-none"
          />
        </div>
      </div>

      {/* Salary Overview Card */}
      {!myPayroll ? (
        <div className="rounded-3xl border border-zinc-200 bg-white p-12 text-center text-zinc-500 shadow-2xs space-y-3">
          <FileText className="mx-auto h-12 w-12 text-zinc-300" />
          <h3 className="font-bold text-zinc-800 text-base">
            Data Slip Gaji Bulan {formatBulanTahun(selectedMonth)} Belum Tersedia
          </h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Slip gaji akan muncul otomatis setelah kalkulasi kehadiran diproses dan disetujui Owner. Penggajian rutin jatuh tempo pada tanggal 25.
          </p>
        </div>
      ) : (
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-5">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Periode Penggajian
              </span>
              <h2 className="text-xl font-extrabold text-zinc-900 mt-0.5">
                {myPayroll.monthLabel || formatBulanTahun(myPayroll.month)}
              </h2>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 font-bold text-xs rounded-full px-3 py-1 self-start sm:self-auto ${
                isPaid
                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                  : 'bg-amber-100 text-amber-900 border border-amber-200'
              }`}
            >
              {isPaid && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
              {isPaid ? 'SUDAH DIBAYAR (LUNAS)' : 'DALAM PROSES (BELUM DIBAYAR)'}
            </span>
          </div>

          {/* Breakdown Items */}
          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2.5 border-b border-zinc-100">
              <span className="text-zinc-600 font-medium">Gaji Pokok Bulanan:</span>
              <span className="font-bold text-zinc-900 text-sm">
                {formatRupiah(myPayroll.baseSalary)}
              </span>
            </div>

            <div className="flex justify-between py-2.5 border-b border-zinc-100">
              <div>
                <span className="text-zinc-600 font-medium flex items-center gap-1">
                  <Award className="h-3.5 w-3.5 text-emerald-600" />
                  Total Uang Rajin Absensi:
                </span>
                <span className="text-[11px] text-zinc-400">
                  Akumulasi bonus kedisiplinan mingguan
                </span>
              </div>
              <span className="font-bold text-emerald-700 text-sm">
                +{formatRupiah(myPayroll.attendanceBonus)}
              </span>
            </div>

            {(myPayroll.bonus || myPayroll.bonusAmount || 0) > 0 && (
              <div className="flex justify-between py-2.5 border-b border-zinc-100">
                <div>
                  <span className="text-zinc-600 font-medium">Bonus / Insentif:</span>
                  {myPayroll.bonusNote && (
                    <span className="block text-[11px] text-zinc-400">{myPayroll.bonusNote}</span>
                  )}
                </div>
                <span className="font-bold text-emerald-700 text-sm">
                  +{formatRupiah(myPayroll.bonus || myPayroll.bonusAmount || 0)}
                </span>
              </div>
            )}

            {(myPayroll.adjustmentAddition || 0) > 0 && (
              <div className="flex justify-between py-2.5 border-b border-zinc-100">
                <div>
                  <span className="text-zinc-600 font-medium">Penyesuaian Tambahan (+):</span>
                  {myPayroll.adjustmentAdditionNote && (
                    <span className="block text-[11px] text-zinc-400">
                      {myPayroll.adjustmentAdditionNote}
                    </span>
                  )}
                </div>
                <span className="font-bold text-emerald-700 text-sm">
                  +{formatRupiah(myPayroll.adjustmentAddition || 0)}
                </span>
              </div>
            )}

            {(myPayroll.adjustmentDeduction || myPayroll.deduction || 0) > 0 && (
              <div className="flex justify-between py-2.5 border-b border-zinc-100">
                <div>
                  <span className="text-zinc-600 font-medium">Potongan (−):</span>
                  {(myPayroll.adjustmentDeductionNote || myPayroll.deductionNote) && (
                    <span className="block text-[11px] text-zinc-400">
                      {myPayroll.adjustmentDeductionNote || myPayroll.deductionNote}
                    </span>
                  )}
                </div>
                <span className="font-bold text-rose-600 text-sm">
                  -{formatRupiah(myPayroll.adjustmentDeduction || myPayroll.deduction || 0)}
                </span>
              </div>
            )}
          </div>

          {/* Grand Total */}
          <div className="rounded-2xl bg-zinc-900 p-5 text-white flex justify-between items-center shadow-xs">
            <div>
              <span className="text-[10px] uppercase text-zinc-400 font-bold block">
                Total Gaji Bersih Diterima
              </span>
              <span className="text-xs text-zinc-400">Take Home Pay (THP)</span>
            </div>
            <span className="text-2xl font-extrabold text-emerald-400">{formatRupiah(total)}</span>
          </div>

          {/* Action Button */}
          <button
            onClick={() => setSelectedSlip(myPayroll)}
            className="w-full rounded-2xl bg-emerald-600 py-3.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 transition-colors flex items-center justify-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Buka & Cetak Slip Gaji Resmi
          </button>
        </div>
      )}

      {/* Weekly Uang Rajin Summary for this Employee */}
      {myMonthBonuses.length > 0 && (
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-emerald-600" />
            <h3 className="font-bold text-zinc-900 text-sm">
              Rekap Uang Rajin Mingguan Bulan Ini
            </h3>
          </div>

          <div className="space-y-2">
            {myMonthBonuses.map((wb) => (
              <div
                key={wb.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 border border-zinc-100 text-xs"
              >
                <div>
                  <span className="font-bold text-zinc-900 block">{wb.label}</span>
                  <span className="text-zinc-500 text-[11px]">
                    {wb.reason || `Hadir ${wb.presentDays}/${wb.eligibleWorkDays} hari`}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-emerald-700 block text-sm">
                    {formatRupiah(wb.finalBonus)}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-medium">{wb.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Slip Gaji Modal */}
      <SlipGajiModal payroll={selectedSlip} onClose={() => setSelectedSlip(null)} />
    </div>
  );
};
