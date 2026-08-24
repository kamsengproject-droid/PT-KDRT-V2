import React, { useState, useEffect } from 'react';
import {
  Award,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  ChevronRight,
  Sparkles,
  RefreshCw,
  Clock,
  UserCheck,
  Building2,
  CalendarDays,
  Info,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { subscribeEmployees } from '../services/employeeService';
import { getAttendanceRange } from '../services/attendanceService';
import { subscribeHolidays, subscribeWorkplaceSchedule } from '../services/settingsService';
import {
  bayarUangRajin,
  hitungDanSimpanBonusMingguan,
  subscribeAttendanceBonuses,
} from '../services/payrollService';
import {
  AttendanceBonusWeek,
  Employee,
  Holiday,
  WorkplaceSchedule,
} from '../types';
import {
  getRentangMinggu,
  getMingguDalamBulan,
  DEFAULT_SCHEDULE,
} from '../utils/attendanceCalc';
import {
  formatRupiah,
  formatTanggal,
  formatBulanTahun,
  bulanSekarang,
  tanggalHariIni,
} from '../utils/formatters';

export const UangRajinPage: React.FC = () => {
  const { userProfile, role, loading, currentUser } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [schedule, setSchedule] = useState<WorkplaceSchedule>(DEFAULT_SCHEDULE);
  const [bonuses, setBonuses] = useState<AttendanceBonusWeek[]>([]);

  // Period state: Month & Selected Week
  const [selectedMonth, setSelectedMonth] = useState<string>(bulanSekarang());
  const monthWeeks = getMingguDalamBulan(selectedMonth);

  // Default to the first week or current week
  const todayWeek = getRentangMinggu(tanggalHariIni());
  const initialWeekStart = monthWeeks.some((w) => w.weekStart === todayWeek.weekStart)
    ? todayWeek.weekStart
    : monthWeeks[0]?.weekStart || todayWeek.weekStart;

  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(initialWeekStart);

  // Synchronize selected week if month changes
  useEffect(() => {
    const weeks = getMingguDalamBulan(selectedMonth);
    if (weeks.length > 0) {
      const match = weeks.find((w) => w.weekStart === selectedWeekStart);
      if (!match) {
        setSelectedWeekStart(weeks[0].weekStart);
      }
    }
  }, [selectedMonth]);

  const activeWeekInfo =
    monthWeeks.find((w) => w.weekStart === selectedWeekStart) ||
    getRentangMinggu(selectedWeekStart);

  const [loadingPay, setLoadingPay] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [paySuccess, setPaySuccess] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  // Selected bonus for viewing breakdown details modal
  const [detailModal, setDetailModal] = useState<AttendanceBonusWeek | null>(null);

  useEffect(() => {
    if (loading || !currentUser || !userProfile?.active) {
      return;
    }
    const unsubEmp = subscribeEmployees('SHARING', setEmployees);
    const unsubHol = subscribeHolidays(setHolidays);
    const unsubSch = subscribeWorkplaceSchedule(setSchedule);
    const unsubBon = subscribeAttendanceBonuses(selectedWeekStart, setBonuses);

    return () => {
      unsubEmp();
      unsubHol();
      unsubSch();
      unsubBon();
    };
  }, [loading, currentUser?.uid, userProfile?.role, userProfile?.active, selectedWeekStart]);

  // Compute & synchronize weekly bonuses from attendance records for all active employees
  const syncWeeklyBonuses = async () => {
    if (employees.length === 0 || !activeWeekInfo) return;
    setIsSyncing(true);
    try {
      const records = await getAttendanceRange(
        activeWeekInfo.weekStart,
        activeWeekInfo.weekEnd
      );

      for (const emp of employees) {
        const empRecords = records.filter((r) => r.employeeId === emp.id);
        await hitungDanSimpanBonusMingguan(
          emp,
          activeWeekInfo.weekStart,
          activeWeekInfo.weekEnd,
          empRecords,
          holidays,
          schedule
        );
      }
    } catch (err: any) {
      console.error('Gagal sinkronisasi uang rajin:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    syncWeeklyBonuses();
  }, [employees, selectedWeekStart, holidays, schedule]);

  const handlePayBonus = async (bonus: AttendanceBonusWeek) => {
    setLoadingPay(bonus.id || bonus.employeeId);
    setPayError(null);
    setPaySuccess(null);

    try {
      await bayarUangRajin(
        bonus,
        userProfile?.uid || 'owner',
        userProfile?.name || 'Owner PT.KDRT'
      );
      setPaySuccess(
        `Uang Rajin ${bonus.employeeName} sebesar ${formatRupiah(
          bonus.finalBonus
        )} berhasil dibayar dan otomatis dicatat ke Pengeluaran Kas.`
      );
    } catch (err: any) {
      setPayError(err.message || 'Gagal memproses pembayaran Uang Rajin.');
    } finally {
      setLoadingPay(null);
    }
  };

  // Merge loaded employees with bonuses so every sharing employee appears
  const employeeBonusList: AttendanceBonusWeek[] = employees.map((emp) => {
    const existing = bonuses.find((b) => b.employeeId === emp.id);
    if (existing) return existing;
    return {
      employeeId: emp.id!,
      employeeName: emp.name,
      weekStart: activeWeekInfo.weekStart,
      weekEnd: activeWeekInfo.weekEnd,
      label: activeWeekInfo.label,
      baseBonus: schedule.rajinWeeklyBonus || 150000,
      eligibleWorkDays: 6,
      presentDays: 0,
      lateDays: 0,
      lateCount: 0,
      lateDeduction: 0,
      deduction: 0,
      bonusAmount: schedule.rajinWeeklyBonus || 150000,
      finalBonus: schedule.rajinWeeklyBonus || 150000,
      isFullAttendance: false,
      status: 'CALCULATED',
      reason: 'Sedang memuat data kehadiran...',
      breakdown: [],
    };
  });

  const totalBonusMingguan = employeeBonusList.reduce((sum, b) => sum + b.finalBonus, 0);
  const totalSudahDibayar = employeeBonusList
    .filter((b) => b.status === 'SUDAH DIBAYAR')
    .reduce((sum, b) => sum + b.finalBonus, 0);
  const totalBelumDibayar = totalBonusMingguan - totalSudahDibayar;
  const totalKaryawanDisiplin = employeeBonusList.filter((b) => b.lateCount === 0 && b.isFullAttendance).length;
  const totalKeterlambatan = employeeBonusList.reduce((sum, b) => sum + b.lateCount, 0);

  return (
    <div className="space-y-6 pb-12" id="uang-rajin-page-root">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
              <Sparkles className="h-3 w-3" />
              Kategori SHARING
            </span>
            <span className="text-xs text-zinc-400 font-medium">Kantor PT.KDRT</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 flex items-center gap-2.5 mt-1">
            <Award className="h-7 w-7 text-emerald-600" />
            Uang Rajin Mingguan
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">
            Sistem reward kedisiplinan otomatis: Rp150.000/minggu dengan potongan Rp20.000 per keterlambatan (Senin–Sabtu).
          </p>
        </div>

        {/* Filter Controls: Bulan & Minggu */}
        <div className="flex flex-wrap items-center gap-2 bg-white rounded-2xl border border-zinc-200 p-2 shadow-2xs">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-50 rounded-xl border border-zinc-100">
            <Calendar className="h-4 w-4 text-zinc-500" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-bold text-zinc-900 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-50 rounded-xl border border-zinc-100">
            <CalendarDays className="h-4 w-4 text-zinc-500" />
            <select
              value={selectedWeekStart}
              onChange={(e) => setSelectedWeekStart(e.target.value)}
              className="bg-transparent text-xs font-bold text-zinc-900 focus:outline-none"
            >
              {monthWeeks.map((w, idx) => (
                <option key={w.weekStart} value={w.weekStart}>
                  Minggu {idx + 1}: {w.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={syncWeeklyBonuses}
            disabled={isSyncing}
            className="rounded-xl bg-zinc-100 p-2 text-zinc-700 hover:bg-zinc-200 transition-colors disabled:opacity-50"
            title="Kalkulasi Ulang Realtime"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Policy Card */}
      <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 sm:p-5 text-xs text-emerald-900 space-y-2">
        <div className="flex items-center gap-2 font-bold text-emerald-950 text-sm">
          <Sparkles className="h-4 w-4 text-emerald-600" />
          <span>Aturan Resmi Uang Rajin PT.KDRT (Kategori SHARING)</span>
        </div>
        <p className="leading-relaxed text-zinc-700">
          Uang Rajin adalah bonus kedisiplinan mingguan sebesar <strong>Rp150.000</strong> untuk kehadiran penuh (Senin – Sabtu). 
          Setiap keterlambatan memotong <strong>Rp20.000</strong> (Maksimal potongan hingga Rp0). 
          Hari Minggu dan Hari Libur Nasional <strong>tidak memotong</strong> hak Uang Rajin. Pulang cepat (Early Checkout) tidak memotong Uang Rajin.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Periode Terpilih
          </span>
          <div className="mt-1">
            <p className="text-base font-extrabold text-zinc-900">{activeWeekInfo.label}</p>
            <span className="text-xs text-zinc-500 font-medium">{employees.length} Karyawan Sharing</span>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Total Uang Rajin Terhitung
          </span>
          <div className="mt-1">
            <p className="text-2xl font-extrabold text-emerald-600">
              {formatRupiah(totalBonusMingguan)}
            </p>
            <span className="text-xs text-zinc-500 font-medium">Dari dasar Rp150.000/org</span>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Disiplin Penuh (0x Telat)
          </span>
          <div className="mt-1">
            <p className="text-2xl font-extrabold text-zinc-900">
              {totalKaryawanDisiplin} / {employees.length}
            </p>
            <span className="text-xs text-amber-700 font-medium">
              Total {totalKeterlambatan} keterlambatan
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Status Pembayaran
          </span>
          <div className="mt-1">
            <p className="text-2xl font-extrabold text-zinc-900">
              {formatRupiah(totalSudahDibayar)}
            </p>
            <span className="text-xs text-amber-700 font-semibold">
              {formatRupiah(totalBelumDibayar)} Belum Dibayar
            </span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {paySuccess && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-bold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{paySuccess}</span>
        </div>
      )}
      {payError && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs font-bold text-rose-900 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{payError}</span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xs">
        <div className="border-b border-zinc-100 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-zinc-900 text-sm">
              Rekap Uang Rajin Karyawan ({activeWeekInfo.label})
            </h3>
            <p className="text-xs text-zinc-500">
              Data dihitung otomatis dari presensi realtime dan jadwal kerja kantor
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 text-zinc-500 uppercase tracking-wider text-[10px] font-bold border-b border-zinc-100">
              <tr>
                <th className="px-6 py-3.5">Karyawan & Posisi</th>
                <th className="px-4 py-3.5">Bonus Dasar</th>
                <th className="px-4 py-3.5">Kehadiran</th>
                <th className="px-4 py-3.5">Keterlambatan</th>
                <th className="px-4 py-3.5">Potongan</th>
                <th className="px-4 py-3.5">Uang Rajin</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Rincian & Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              {employeeBonusList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-zinc-400 font-medium">
                    Belum ada data karyawan kategori Sharing.
                  </td>
                </tr>
              ) : (
                employeeBonusList.map((item) => {
                  const emp = employees.find((e) => e.id === item.employeeId);
                  return (
                    <tr key={item.employeeId} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-zinc-900 text-sm">{item.employeeName}</p>
                        <span className="text-[11px] text-zinc-500 font-medium">
                          {emp?.position || 'Staf Sharing'}
                        </span>
                      </td>

                      <td className="px-4 py-4 font-semibold text-zinc-700">
                        {formatRupiah(item.baseBonus)}
                      </td>

                      <td className="px-4 py-4">
                        <span className="font-medium text-zinc-800">
                          {item.presentDays}/{item.eligibleWorkDays || 6} Hari
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        {item.lateCount > 0 ? (
                          <span className="inline-flex items-center gap-1 font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            {item.lateCount}x Terlambat
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            0x (Disiplin)
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-4 font-semibold text-rose-600">
                        {item.deduction > 0 ? `-${formatRupiah(item.deduction)}` : 'Rp 0'}
                      </td>

                      <td className="px-4 py-4 font-extrabold text-sm text-emerald-700">
                        {formatRupiah(item.finalBonus)}
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            item.status === 'SUDAH DIBAYAR'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                              : 'bg-amber-100 text-amber-900 border border-amber-200'
                          }`}
                        >
                          {item.status === 'SUDAH DIBAYAR' ? (
                            <>
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              SUDAH DIBAYAR
                            </>
                          ) : (
                            'BELUM DIBAYAR'
                          )}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setDetailModal(item)}
                            className="inline-flex items-center gap-1 rounded-xl bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-200 transition-colors"
                          >
                            <Info className="h-3.5 w-3.5 text-zinc-500" />
                            Buka Detail
                          </button>

                          {role === 'OWNER' && (
                            item.status === 'SUDAH DIBAYAR' ? (
                              <span className="text-[11px] text-zinc-400 font-medium px-2">Lunas</span>
                            ) : (
                              <button
                                onClick={() => handlePayBonus(item)}
                                disabled={loadingPay === item.employeeId}
                                className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                              >
                                <DollarSign className="h-3.5 w-3.5" />
                                {loadingPay === item.employeeId ? 'Memproses...' : 'Bayar'}
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily Breakdown Modal */}
      {detailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-4 border-b border-zinc-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base text-zinc-900">
                    Detail Presensi & Uang Rajin: {detailModal.employeeName}
                  </h3>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">{detailModal.label}</p>
              </div>
              <button
                onClick={() => setDetailModal(null)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Status Summary Banner */}
            <div className="mt-4 rounded-xl bg-zinc-50 p-3 border border-zinc-200/80 text-xs">
              <div className="flex items-center justify-between font-bold text-zinc-900">
                <span>Evaluasi Mingguan:</span>
                <span className={detailModal.finalBonus > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                  {detailModal.reason || 'Kalkulasi Kehadiran'}
                </span>
              </div>
            </div>

            {/* Daily Grid / Table */}
            <div className="mt-4 space-y-2 text-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Rincian 6 Hari Kerja (Senin – Sabtu)
              </span>

              {activeWeekInfo.dates.map((d) => {
                const rec = detailModal.breakdown?.find((b) => b.tanggal === d.tanggal);
                const isLate = rec?.status === 'TERLAMBAT' || (rec?.menitTerlambat && rec.menitTerlambat > 0);
                const isHoliday = rec?.isHoliday;

                return (
                  <div
                    key={d.tanggal}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border ${
                      isHoliday
                        ? 'bg-blue-50/50 border-blue-100'
                        : isLate
                        ? 'bg-amber-50/60 border-amber-200'
                        : rec?.status === 'HADIR'
                        ? 'bg-emerald-50/40 border-emerald-100'
                        : 'bg-zinc-50 border-zinc-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-900">{d.hari}</span>
                        <span className="text-zinc-400 text-[11px]">({formatTanggal(d.tanggal)})</span>
                      </div>
                      <p className="text-[11px] text-zinc-600 mt-0.5">
                        {rec?.keterangan || (isHoliday ? 'Hari Libur Resmi' : 'Belum ada data presensi')}
                      </p>
                    </div>

                    <div className="mt-2 sm:mt-0 text-right">
                      {isHoliday ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-900 border border-blue-200">
                          Libur Resmi (Tanpa Potongan)
                        </span>
                      ) : isLate ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-200">
                          Terlambat ({rec?.menitTerlambat}m) • -Rp20.000
                        </span>
                      ) : rec?.status === 'HADIR' ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-900 border border-emerald-200">
                          Hadir Tepat Waktu (Rp 0)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-zinc-200 px-2 py-0.5 text-[10px] font-bold text-zinc-700">
                          Tidak Hadir
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Math Calculation Card */}
            <div className="mt-5 rounded-2xl bg-zinc-900 p-4 text-white space-y-2 text-xs">
              <div className="flex justify-between items-center text-zinc-300">
                <span>Bonus Dasar Mingguan</span>
                <span className="font-bold">{formatRupiah(detailModal.baseBonus)}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-300">
                <span>Potongan Terlambat ({detailModal.lateCount}x × Rp20.000)</span>
                <span className="font-bold text-rose-400">
                  {detailModal.deduction > 0 ? `-${formatRupiah(detailModal.deduction)}` : 'Rp 0'}
                </span>
              </div>
              <div className="border-t border-zinc-800 pt-2 flex justify-between items-center text-sm">
                <span className="font-extrabold text-white">Total Uang Rajin Minggu Ini</span>
                <span className="text-base font-extrabold text-emerald-400">
                  {formatRupiah(detailModal.finalBonus)}
                </span>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setDetailModal(null)}
                className="rounded-xl bg-zinc-100 px-4 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-200 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
