import React, { useState, useEffect } from 'react';
import {
  Settings,
  Clock, MapPin,
  Calendar,
  Save,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Building2,
  Globe,
  Info,
  CalendarDays,
  ShieldCheck,
  Edit2,
  Home,
  Wifi,
  RefreshCw,
  Award,
  Sparkles,
  DollarSign,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  hapusHariLibur,
  subscribeOfficeLocation,
  updateOfficeLocation,
  tambahHariLibur,
  updateHariLibur,
  updateWorkplaceSchedule,
  subscribeHolidays,
  subscribeWorkplaceSchedule,
} from '../services/settingsService';
import { Holiday, WorkplaceSchedule, OfficeLocation, ProfitSharingTier, DEFAULT_PROFIT_SHARING_TIERS } from '../types';
import { formatTanggal, tanggalHariIni, formatRupiah } from '../utils/formatters';
import { subscribeProfitSharingTiers } from '../services/profitSharingService';
import { TierConfigManager } from '../components/profitSharing/TierConfigManager';
import { AuditLogPage } from './AuditLogPage';

export const PengaturanKantorPage: React.FC<{ onBackToPortal?: () => void }> = ({
  onBackToPortal,
}) => {
  const { userProfile, role, loading: authLoading, currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'PENGATURAN' | 'AUDIT_LOG'>('PENGATURAN');

  // Schedule & Office Info state
  
  const [office, setOffice] = useState<OfficeLocation>({
    officeName: 'Kantor PT.KDRT',
    latitude: -6.2088,
    longitude: 106.8456,
    radius: 100
  });
  const [savingOffice, setSavingOffice] = useState(false);

  const [schedule, setSchedule] = useState<WorkplaceSchedule>({
    officeName: 'PT.KDRT',
    appName: 'KANTOR PT.KDRT',
    workDays: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
    activeDays: [1, 2, 3, 4, 5, 6],
    checkInTime: '09:00',
    checkOutTime: '17:00',
    weekdayCheckInTime: '09:00',
    weekdayCheckOutTime: '17:00',
    saturdayCheckInTime: '09:00',
    saturdayCheckOutTime: '12:30',
    earlyCheckoutToleranceMinutes: 10,
    lateToleranceMinutes: 0,
    timezone: 'Asia/Jakarta',
    rajinWeeklyBonus: 150000,
    lateDeduction: 20000,
  });

  // Holidays state
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  // Profit Sharing Tiers state
  const [tiers, setTiers] = useState<ProfitSharingTier[]>(DEFAULT_PROFIT_SHARING_TIERS);

  // Holiday Modal state
  const [showHolidayModal, setShowHolidayModal] = useState<boolean>(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [holidayFormData, setHolidayFormData] = useState<{
    date: string;
    name: string;
    notes: string;
    active: boolean;
  }>({
    date: tanggalHariIni(),
    name: '',
    notes: '',
    active: true,
  });

  const [savingSchedule, setSavingSchedule] = useState<boolean>(false);
  const [savingHoliday, setSavingHoliday] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Office Network verification state
  const [networkInfo, setNetworkInfo] = useState<{
    clientIp: string;
    isAllowed: boolean;
    allowedOfficeIps: string[];
    loading: boolean;
  }>({
    clientIp: '',
    isAllowed: false,
    allowedOfficeIps: [],
    loading: false,
  });

  const checkNetworkStatus = async () => {
    setNetworkInfo((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch('/api/auth/client-ip');
      if (res.ok) {
        const data = await res.json();
        setNetworkInfo({
          clientIp: data.clientIp || 'Tidak terdeteksi',
          isAllowed: Boolean(data.isAllowed),
          allowedOfficeIps: data.allowedOfficeIps || [],
          loading: false,
        });
      }
    } catch {
      setNetworkInfo((prev) => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    checkNetworkStatus();
  }, []);

  useEffect(() => {
    if (authLoading || !currentUser || !userProfile?.active) {
      return;
    }
    const unsubSch = subscribeWorkplaceSchedule((data) => {
      setSchedule((prev) => ({
        ...prev,
        ...data,
        officeName: data.officeName || 'PT.KDRT',
        appName: data.appName || 'KANTOR PT.KDRT',
        timezone: 'Asia/Jakarta',
      }));
    });

    const unsubHol = subscribeHolidays(setHolidays);
    const unsubTiers = subscribeProfitSharingTiers(setTiers);

    return () => {
      unsubSch();
      unsubHol();
      unsubTiers();
    };
  }, [authLoading, currentUser?.uid, userProfile?.role, userProfile?.active]);

  const daysList = [
    { key: 1, label: 'Senin' },
    { key: 2, label: 'Selasa' },
    { key: 3, label: 'Rabu' },
    { key: 4, label: 'Kamis' },
    { key: 5, label: 'Jumat' },
    { key: 6, label: 'Sabtu' },
    { key: 0, label: 'Minggu' },
  ];

  const handleToggleDay = (dayKey: number, dayLabel: string) => {
    const currentActiveDays = schedule.activeDays || [1, 2, 3, 4, 5, 6];
    const currentWorkDays = schedule.workDays || ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    let newActiveDays: number[];
    let newWorkDays: string[];

    if (currentActiveDays.includes(dayKey)) {
      newActiveDays = currentActiveDays.filter((k) => k !== dayKey);
      newWorkDays = currentWorkDays.filter((d) => d !== dayLabel);
    } else {
      newActiveDays = [...currentActiveDays, dayKey].sort();
      newWorkDays = [...currentWorkDays, dayLabel];
    }

    setSchedule({
      ...schedule,
      activeDays: newActiveDays,
      workDays: newWorkDays,
    });
  };

  
  const handleSaveOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userProfile) return;
    setSavingOffice(true);
    try {
      await updateOfficeLocation(office, currentUser.uid, userProfile.name);
      alert('Lokasi kantor berhasil disimpan.');
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan lokasi.');
    } finally {
      setSavingOffice(false);
    }
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSchedule(true);
    setSaveSuccess(null);
    setSaveError(null);
    try {
      const weekdayIn = schedule.weekdayCheckInTime || schedule.checkInTime || '09:00';
      const weekdayOut = schedule.weekdayCheckOutTime || schedule.checkOutTime || '17:00';
      const satIn = schedule.saturdayCheckInTime || '09:00';
      const satOut = schedule.saturdayCheckOutTime || '12:30';
      const tolerance = schedule.earlyCheckoutToleranceMinutes !== undefined ? Number(schedule.earlyCheckoutToleranceMinutes) : 10;

      const updatedPayload: WorkplaceSchedule = {
        ...schedule,
        timezone: 'Asia/Jakarta',
        officeName: schedule.officeName || 'PT.KDRT',
        appName: schedule.appName || 'KANTOR PT.KDRT',
        checkInTime: weekdayIn,
        checkOutTime: weekdayOut,
        weekdayCheckInTime: weekdayIn,
        weekdayCheckOutTime: weekdayOut,
        saturdayCheckInTime: satIn,
        saturdayCheckOutTime: satOut,
        earlyCheckoutToleranceMinutes: tolerance,
        rajinWeeklyBonus: Number(schedule.rajinWeeklyBonus !== undefined ? schedule.rajinWeeklyBonus : 150000),
        lateDeduction: Number(schedule.lateDeduction !== undefined ? schedule.lateDeduction : 20000),
        minRajinBonus: Number(schedule.minRajinBonus !== undefined ? schedule.minRajinBonus : 0),
      };

      await updateWorkplaceSchedule(
        updatedPayload,
        userProfile?.uid || 'owner',
        userProfile?.name || 'Owner'
      );
      setSaveSuccess('Pengaturan jam kerja, aturan jam pulang, dan konfigurasi Uang Rajin berhasil disimpan ke Firestore.');
    } catch (err: any) {
      setSaveError(err.message || 'Gagal menyimpan pengaturan kantor.');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleOpenAddHoliday = () => {
    setEditingHoliday(null);
    setHolidayFormData({
      date: tanggalHariIni(),
      name: '',
      notes: '',
      active: true,
    });
    setShowHolidayModal(true);
  };

  const handleOpenEditHoliday = (hol: Holiday) => {
    setEditingHoliday(hol);
    setHolidayFormData({
      date: hol.date,
      name: hol.name,
      notes: hol.notes || '',
      active: hol.active !== undefined ? hol.active : true,
    });
    setShowHolidayModal(true);
  };

  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayFormData.name.trim()) {
      setSaveError('Nama hari libur wajib diisi.');
      return;
    }

    setSavingHoliday(true);
    setSaveSuccess(null);
    setSaveError(null);

    try {
      if (editingHoliday?.id) {
        await updateHariLibur(
          editingHoliday.id,
          holidayFormData,
          userProfile?.uid || 'owner',
          userProfile?.name || 'Owner'
        );
        setSaveSuccess(`Hari libur "${holidayFormData.name}" berhasil diperbarui.`);
      } else {
        await tambahHariLibur(
          holidayFormData,
          userProfile?.uid || 'owner',
          userProfile?.name || 'Owner'
        );
        setSaveSuccess(`Hari libur baru "${holidayFormData.name}" berhasil ditambahkan ke Firestore.`);
      }
      setShowHolidayModal(false);
    } catch (err: any) {
      setSaveError(err.message || 'Gagal menyimpan hari libur.');
    } finally {
      setSavingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (hol: Holiday) => {
    if (window.confirm(`Hapus hari libur "${hol.name}" (${formatTanggal(hol.date)})?`)) {
      try {
        await hapusHariLibur(
          hol.id!,
          hol.name,
          userProfile?.uid || 'owner',
          userProfile?.name || 'Owner'
        );
        setSaveSuccess(`Hari libur "${hol.name}" berhasil dihapus dari Firestore.`);
      } catch (err: any) {
        setSaveError(err.message || 'Gagal menghapus hari libur.');
      }
    }
  };

  return (
    <div className="space-y-6 max-w-5xl pb-12">
      {/* Header & Breadcrumb */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <nav className="flex items-center space-x-1.5 text-xs text-slate-500 font-medium">
          {onBackToPortal ? (
            <button
              onClick={onBackToPortal}
              className="flex items-center gap-1 hover:text-orange-600 font-bold transition-colors"
            >
              <Home className="h-3.5 w-3.5" />
              <span>KANTOR PT.KDRT</span>
            </button>
          ) : (
            <div className="flex items-center gap-1 font-bold text-slate-900">
              <Home className="h-3.5 w-3.5" />
              <span>KANTOR PT.KDRT</span>
            </div>
          )}
          <span className="text-slate-400">/</span>
          <span className="font-bold text-slate-900">PENGATURAN KANTOR</span>
        </nav>

        {onBackToPortal && (
          <button
            onClick={onBackToPortal}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
            <span>Kembali ke Portal</span>
          </button>
        )}
      </div>

      {/* Page Title */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
          <Settings className="h-6 w-6 text-orange-600" />
          PENGATURAN KANTOR
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Konfigurasi identitas kantor, hari &amp; jam kerja standar, timezone Indonesia (Asia/Jakarta), dan kalender hari libur PT.KDRT.
        </p>
      </div>

      {/* Toast Notifications */}
      {saveSuccess && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-900 font-semibold flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{saveSuccess}</span>
          </div>
          <button
            onClick={() => setSaveSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {saveError && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-900 font-semibold flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{saveError}</span>
          </div>
          <button
            onClick={() => setSaveError(null)}
            className="text-rose-700 hover:text-rose-900 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('PENGATURAN')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all ${
            activeTab === 'PENGATURAN'
              ? 'bg-orange-600 text-white shadow-xs'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          <Settings className="h-4 w-4" />
          <span>Pengaturan Kantor &amp; Jam Kerja</span>
        </button>

        <button
          onClick={() => setActiveTab('AUDIT_LOG')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all ${
            activeTab === 'AUDIT_LOG'
              ? 'bg-orange-600 text-white shadow-xs'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Audit Log Sistem</span>
        </button>
      </div>

      {activeTab === 'AUDIT_LOG' ? (
        <AuditLogPage />
      ) : (
        <>
          {/* ========================================================================= */}
          {/* 1. INFORMASI KANTOR & HARI / JAM KERJA                                   */}
          {/* ========================================================================= */}
      <form onSubmit={handleSaveSchedule} className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 font-black text-base text-slate-900">
              <Building2 className="h-5 w-5 text-orange-600" />
              <span>INFORMASI KANTOR &amp; JAM KERJA</span>
            </div>
            <span className="font-mono text-[11px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 font-bold">
              ● Firestore Persistence
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Nama Kantor */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nama Kantor / Perusahaan</label>
              <input
                type="text"
                required
                value={schedule.officeName || 'PT.KDRT'}
                onChange={(e) => setSchedule({ ...schedule, officeName: e.target.value })}
                className="w-full rounded-xl border border-slate-300 p-2.5 font-bold text-slate-900 focus:outline-orange-500"
              />
            </div>

            {/* Nama Aplikasi */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nama Aplikasi Portal</label>
              <input
                type="text"
                required
                value={schedule.appName || 'KANTOR PT.KDRT'}
                onChange={(e) => setSchedule({ ...schedule, appName: e.target.value })}
                className="w-full rounded-xl border border-slate-300 p-2.5 font-bold text-slate-900 focus:outline-orange-500"
              />
            </div>

            {/* Timezone (Fixed Asia/Jakarta as required) */}
            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Globe className="h-3.5 w-3.5 text-slate-400" />
                <span>Timezone Standar Sistem</span>
              </label>
              <input
                type="text"
                disabled
                value="Asia/Jakarta (Waktu Indonesia Barat - WIB)"
                className="w-full rounded-xl border border-slate-200 bg-slate-100 p-2.5 font-bold text-slate-600 cursor-not-allowed"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Timezone Asia/Jakarta digunakan sebagai acuan validasi resmi absensi dan tanggal operasional.
              </span>
            </div>

          {/* ========================================================================= */}
          {/* KONFIGURASI JAM KERJA BERDASARKAN HARI                                   */}
          {/* ========================================================================= */}
          <div className="pt-2 border-t border-slate-100 space-y-4">
            <div>
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-600" />
                <span>ATURAN JAM KERJA &amp; ATURAN JAM PULANG</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Konfigurasi jam masuk, jam pulang normal, dan batas toleransi pulang lebih cepat untuk Senin–Jumat dan Sabtu.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Jadwal Senin - Jumat */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-orange-100 text-orange-700 font-bold text-xs">
                      1–5
                    </span>
                    <span className="font-bold text-slate-900 text-xs">Senin – Jumat (Hari Kerja Standar)</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                    Weekdays
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Jam Masuk (WIB):</label>
                    <input
                      type="time"
                      required
                      value={schedule.weekdayCheckInTime || schedule.checkInTime || '09:00'}
                      onChange={(e) => setSchedule({ ...schedule, weekdayCheckInTime: e.target.value, checkInTime: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 bg-white p-2 font-mono font-bold text-slate-900 focus:outline-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Jam Pulang Normal (WIB):</label>
                    <input
                      type="time"
                      required
                      value={schedule.weekdayCheckOutTime || schedule.checkOutTime || '17:00'}
                      onChange={(e) => setSchedule({ ...schedule, weekdayCheckOutTime: e.target.value, checkOutTime: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 bg-white p-2 font-mono font-bold text-slate-900 focus:outline-orange-500"
                    />
                  </div>
                </div>

                <div className="rounded-xl bg-white p-2.5 border border-slate-200 text-[11px] text-slate-600 space-y-1">
                  <div className="flex justify-between font-semibold">
                    <span>Boleh Pulang Mulai:</span>
                    <span className="text-emerald-700 font-bold font-mono">
                      {(() => {
                        const outTime = schedule.weekdayCheckOutTime || schedule.checkOutTime || '17:00';
                        const [h, m] = outTime.split(':').map(Number);
                        const tol = schedule.earlyCheckoutToleranceMinutes !== undefined ? schedule.earlyCheckoutToleranceMinutes : 10;
                        const totalM = Math.max(0, h * 60 + m - tol);
                        return `${String(Math.floor(totalM / 60)).padStart(2, '0')}:${String(totalM % 60).padStart(2, '0')} WIB`;
                      })()}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Absen pulang rentang 16:50–17:00 = NORMAL. Sebelum 16:50 = EARLY_CHECKOUT.
                  </p>
                </div>
              </div>

              {/* Jadwal Sabtu */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-bold text-xs">
                      6
                    </span>
                    <span className="font-bold text-slate-900 text-xs">Sabtu (Jam Kerja Khusus)</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    Setengah Hari
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Jam Masuk (WIB):</label>
                    <input
                      type="time"
                      required
                      value={schedule.saturdayCheckInTime || '09:00'}
                      onChange={(e) => setSchedule({ ...schedule, saturdayCheckInTime: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 bg-white p-2 font-mono font-bold text-slate-900 focus:outline-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Jam Pulang Normal (WIB):</label>
                    <input
                      type="time"
                      required
                      value={schedule.saturdayCheckOutTime || '12:30'}
                      onChange={(e) => setSchedule({ ...schedule, saturdayCheckOutTime: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 bg-white p-2 font-mono font-bold text-slate-900 focus:outline-orange-500"
                    />
                  </div>
                </div>

                <div className="rounded-xl bg-white p-2.5 border border-slate-200 text-[11px] text-slate-600 space-y-1">
                  <div className="flex justify-between font-semibold">
                    <span>Boleh Pulang Mulai:</span>
                    <span className="text-emerald-700 font-bold font-mono">
                      {(() => {
                        const outTime = schedule.saturdayCheckOutTime || '12:30';
                        const [h, m] = outTime.split(':').map(Number);
                        const tol = schedule.earlyCheckoutToleranceMinutes !== undefined ? schedule.earlyCheckoutToleranceMinutes : 10;
                        const totalM = Math.max(0, h * 60 + m - tol);
                        return `${String(Math.floor(totalM / 60)).padStart(2, '0')}:${String(totalM % 60).padStart(2, '0')} WIB`;
                      })()}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Absen pulang rentang 12:20–12:30 = NORMAL. Sebelum 12:20 = EARLY_CHECKOUT.
                  </p>
                </div>
              </div>
            </div>

            {/* Toleransi & Ketentuan Jam Pulang */}
            <div className="rounded-2xl border border-orange-200 bg-orange-50/50 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="block font-bold text-slate-900 text-xs">
                    Toleransi Pulang Lebih Cepat (Menit)
                  </label>
                  <span className="text-[11px] text-slate-600">
                    Karyawan diperbolehkan absen pulang sebelum jam normal tanpa dianggap pelanggaran.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="60"
                    required
                    value={schedule.earlyCheckoutToleranceMinutes !== undefined ? schedule.earlyCheckoutToleranceMinutes : 10}
                    onChange={(e) => setSchedule({ ...schedule, earlyCheckoutToleranceMinutes: Number(e.target.value) })}
                    className="w-24 rounded-xl border border-orange-300 bg-white p-2 font-mono font-bold text-slate-900 text-center focus:outline-orange-500"
                  />
                  <span className="text-xs font-bold text-slate-700">Menit</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-orange-200 text-xs">
                <div className="rounded-xl bg-white p-2.5 border border-orange-100">
                  <span className="font-bold text-slate-800 block text-[11px]">Senin – Jumat</span>
                  <span className="text-[10px] text-slate-600 block mt-0.5">
                    16:50 – 17:00 = <strong className="text-emerald-700">NORMAL</strong>
                  </span>
                  <span className="text-[10px] text-rose-600 block">
                    &lt; 16:50 = EARLY_CHECKOUT
                  </span>
                </div>
                <div className="rounded-xl bg-white p-2.5 border border-orange-100">
                  <span className="font-bold text-slate-800 block text-[11px]">Sabtu (Setengah Hari)</span>
                  <span className="text-[10px] text-slate-600 block mt-0.5">
                    12:20 – 12:30 = <strong className="text-emerald-700">NORMAL</strong>
                  </span>
                  <span className="text-[10px] text-rose-600 block">
                    &lt; 12:20 = EARLY_CHECKOUT
                  </span>
                </div>
                <div className="rounded-xl bg-white p-2.5 border border-orange-100">
                  <span className="font-bold text-slate-800 block text-[11px]">Minggu</span>
                  <span className="text-[10px] text-blue-700 font-bold block mt-0.5">
                    LIBUR MINGGUAN
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    Tidak ada kewajiban absensi.
                  </span>
                </div>
              </div>
            </div>
          </div>
          </div>

          {/* Konfigurasi Hari Kerja */}
          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <label className="block font-bold text-slate-800 text-xs">
                Konfigurasi Hari Kerja Aktif (Senin - Sabtu)
              </label>
              <span className="text-[11px] font-semibold text-slate-500">
                {schedule.workDays?.length || 6} Hari Kerja / Minggu
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {daysList.map((d) => {
                const isActive = (schedule.activeDays || [1, 2, 3, 4, 5, 6]).includes(d.key);
                return (
                  <button
                    type="button"
                    key={d.key}
                    onClick={() => handleToggleDay(d.key, d.label)}
                    className={`rounded-xl p-3 text-center border font-bold text-xs transition-all ${
                      isActive
                        ? 'bg-orange-600 text-white border-orange-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-sm">{d.label}</div>
                    <div className="text-[10px] mt-0.5 font-normal opacity-90">
                      {isActive ? '✅ Kerja' : '❌ Libur'}
                    </div>
                  </button>
                );
              })}
            </div>
            <span className="text-[11px] text-slate-400 mt-1.5 block">
              Default PT.KDRT: 6 hari kerja (Senin - Sabtu), Minggu libur.
            </span>
          </div>

          {/* Tombol Simpan */}
          {role === 'OWNER' && (
            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={savingSchedule}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-orange-500 disabled:opacity-50 transition-colors"
              >
                <Save className="h-4 w-4" />
                <span>{savingSchedule ? 'Menyimpan ke Firestore...' : 'Simpan Pengaturan Kantor'}</span>
              </button>
            </div>
          )}
        </div>
      </form>

      {/* ========================================================================= */}
      
      {/* ========================================================================= */}
      {/* LOKASI GEOFENCE                                                          */}
      {/* ========================================================================= */}
      <form onSubmit={handleSaveOffice} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs mt-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-indigo-600" />
              <span>LOKASI GEOFENCE KANTOR</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tentukan koordinat GPS kantor untuk validasi absensi (Check-In/Out).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mt-4">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Latitude</label>
            <input
              type="number"
              step="any"
              required
              value={office.latitude}
              onChange={(e) => setOffice({ ...office, latitude: Number(e.target.value) })}
              className="w-full rounded-xl border border-slate-300 p-2.5 font-bold"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Longitude</label>
            <input
              type="number"
              step="any"
              required
              value={office.longitude}
              onChange={(e) => setOffice({ ...office, longitude: Number(e.target.value) })}
              className="w-full rounded-xl border border-slate-300 p-2.5 font-bold"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Radius (meter)</label>
            <input
              type="number"
              required
              min="10"
              value={office.radius}
              onChange={(e) => setOffice({ ...office, radius: Number(e.target.value) })}
              className="w-full rounded-xl border border-slate-300 p-2.5 font-bold"
            />
          </div>
        </div>

        {role === 'OWNER' && (
          <div className="flex justify-end mt-4 pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={savingOffice}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{savingOffice ? 'Menyimpan...' : 'Simpan Lokasi'}</span>
            </button>
          </div>
        )}
      </form>

      {/* ========================================================================= */}
      {/* JARINGAN & IP KANTOR (WIFI ACCESS CONTROL)                                */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Wifi className="h-5 w-5 text-emerald-600" />
              <span>JARINGAN &amp; IP WIFI KANTOR (ACCESS CONTROL)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Akun karyawan (EMPLOYEE &amp; MANAGER) hanya dapat login saat terhubung ke jaringan WiFi kantor PT.KDRT.
            </p>
          </div>

          <button
            type="button"
            onClick={checkNetworkStatus}
            disabled={networkInfo.loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${networkInfo.loading ? 'animate-spin' : ''}`} />
            <span>{networkInfo.loading ? 'Memeriksa...' : 'Cek Status Jaringan'}</span>
          </button>
        </div>

        {/* Current Detected IP Status Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <span className="font-bold text-slate-700 block">IP Publik Perangkat Anda Saat Ini:</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-sm text-slate-900 bg-white px-3 py-1.5 rounded-lg border border-slate-200 break-all">
                {networkInfo.clientIp || 'Mendeteksi...'}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[11px] shrink-0 ${
                  networkInfo.isAllowed
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}
              >
                {networkInfo.isAllowed ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Jaringan Kantor (Diizinkan)</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-3 w-3" />
                    <span>Luar Kantor / Remote</span>
                  </>
                )}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {networkInfo.isAllowed
                ? 'Perangkat Anda terhubung ke jaringan kantor yang terdaftar. Login karyawan diizinkan.'
                : 'Perangkat Anda saat ini berada di luar subnet whitelist jaringan kantor.'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <span className="font-bold text-slate-700 block">Daftar Subnet IP Kantor Terdaftar:</span>
            <div className="space-y-1.5 font-mono text-[11px]">
              <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-md border border-slate-200">
                <span className="font-bold text-slate-800">158.140.166.38 / 158.140.166.0/24</span>
                <span className="text-[10px] text-slate-500 font-sans font-semibold">IPv4 Kantor</span>
              </div>
              <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-md border border-slate-200">
                <span className="font-bold text-slate-800">2402:8780:1201:81ed::/64</span>
                <span className="text-[10px] text-emerald-600 font-sans font-semibold">Subnet WiFi Kantor (All Device)</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-500">
              Subnet IPv6 <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-bold">/64</code> memastikan seluruh HP &amp; laptop karyawan (termasuk Melinda) yang terhubung ke WiFi kantor otomatis dikenali.
            </p>
          </div>
        </div>
      </div>

      {/* 2. DAFTAR HARI LIBUR NASIONAL & KANTOR                                    */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-orange-600" />
              <span>DAFTAR HARI LIBUR (KALENDER KANTOR)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Daftar hari libur nasional atau cuti bersama PT.KDRT. Pada hari libur, absensi tidak dianggap alpa.
            </p>
          </div>

          {role === 'OWNER' && (
            <button
              onClick={handleOpenAddHoliday}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-colors shadow-2xs shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>+ Tambah Hari Libur</span>
            </button>
          )}
        </div>

        {/* Holiday Cards Grid */}
        {holidays.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 bg-slate-50">
            <Calendar className="mx-auto h-8 w-8 text-slate-400 mb-2 opacity-50" />
            <p className="font-bold text-xs text-slate-700">Belum ada hari libur tersimpan di Firestore</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Klik &quot;+ Tambah Hari Libur&quot; untuk mendaftarkan hari libur baru (misal: 17 Agustus 2026 - Hari Kemerdekaan RI).
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {holidays.map((hol) => (
              <div
                key={hol.id || hol.date}
                className="flex items-start justify-between rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs hover:border-orange-300 transition-colors"
              >
                <div className="space-y-1">
                  <div className="font-black text-slate-900 text-sm">{hol.name}</div>
                  <div className="text-orange-600 font-bold flex items-center gap-1 text-[11px]">
                    <Calendar className="h-3 w-3" />
                    <span>{formatTanggal(hol.date)}</span>
                  </div>
                  {hol.notes && (
                    <div className="text-[11px] text-slate-500 italic mt-0.5">{hol.notes}</div>
                  )}
                </div>

                {role === 'OWNER' && hol.id && (
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    <button
                      onClick={() => handleOpenEditHoliday(hol)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                      title="Edit Hari Libur"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteHoliday(hol)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                      title="Hapus Hari Libur"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. KONFIGURASI TIER & PERSENTASE PROFIT SHARING                           */}
      {/* ========================================================================= */}
      <TierConfigManager tiers={tiers} />

      {/* ========================================================================= */}
      {/* MODAL TAMBAH / EDIT HARI LIBUR                                           */}
      {/* ========================================================================= */}
      {showHolidayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-orange-600" />
                <span>{editingHoliday ? 'Edit Hari Libur' : 'Tambah Hari Libur Baru'}</span>
              </h3>
              <button
                onClick={() => setShowHolidayModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveHoliday} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tanggal Libur <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={holidayFormData.date}
                  onChange={(e) => setHolidayFormData({ ...holidayFormData, date: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 font-bold text-slate-900 focus:outline-orange-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Hari Libur <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={holidayFormData.name}
                  onChange={(e) => setHolidayFormData({ ...holidayFormData, name: e.target.value })}
                  placeholder="contoh: Hari Kemerdekaan RI ke-81"
                  className="w-full rounded-xl border border-slate-300 p-2.5 font-bold focus:outline-orange-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Keterangan (Opsional)</label>
                <textarea
                  rows={2}
                  value={holidayFormData.notes}
                  onChange={(e) => setHolidayFormData({ ...holidayFormData, notes: e.target.value })}
                  placeholder="Keterangan cuti bersama atau operasional kantor..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 focus:outline-orange-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowHolidayModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingHoliday}
                  className="rounded-xl bg-orange-600 px-5 py-2 font-bold text-white shadow-xs hover:bg-orange-500 disabled:opacity-50 transition-colors"
                >
                  {savingHoliday ? 'Menyimpan...' : 'Simpan Hari Libur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
};
