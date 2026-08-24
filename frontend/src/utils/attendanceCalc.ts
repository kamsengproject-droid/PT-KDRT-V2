import {
  AttendanceBonusDayBreakdown,
  AttendanceRecord,
  AttendanceStatus,
  CheckoutStatus,
  Holiday,
  WorkplaceSchedule,
} from '../types';
import { formatTanggal } from './formatters';

export const DEFAULT_SCHEDULE: WorkplaceSchedule = {
  officeName: 'Kantor PT.KDRT',
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
  minRajinBonus: 0,
};

export interface DayScheduleDetail {
  namaHari: string;
  dayIndex: number; // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
  isSunday: boolean;
  isSaturday: boolean;
  isWeekday: boolean;
  isLibur: boolean;
  checkInTime: string;
  checkOutTime: string;
  earliestAllowedCheckOut: string; // e.g. "16:50" or "12:20"
  earliestCheckoutTime: string; // alias e.g. "16:50" or "12:20"
  earlyCheckoutToleranceMinutes: number;
  labelJadwal: string;
}

// Dapatkan jadwal spesifik berdasarkan hari dalam tanggal yang bersangkutan
export function getJadwalHari(
  tanggalStr: string,
  schedule: WorkplaceSchedule = DEFAULT_SCHEDULE
): DayScheduleDetail {
  const d = new Date(tanggalStr + 'T12:00:00');
  const dayIndex = d.getDay(); // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
  const namaHari = d.toLocaleDateString('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' });

  const isSunday = dayIndex === 0;
  const isSaturday = dayIndex === 6;
  const isWeekday = dayIndex >= 1 && dayIndex <= 5;
  const tolerance = schedule.earlyCheckoutToleranceMinutes !== undefined ? schedule.earlyCheckoutToleranceMinutes : 10;

  let checkIn = schedule.weekdayCheckInTime || schedule.checkInTime || '09:00';
  let checkOut = schedule.weekdayCheckOutTime || schedule.checkOutTime || '17:00';

  if (isSaturday) {
    checkIn = schedule.saturdayCheckInTime || '09:00';
    checkOut = schedule.saturdayCheckOutTime || '12:30';
  }

  // Hitung batas waktu tercepat boleh absen pulang (checkOut dikurangi toleransi menit)
  const [coH, coM] = checkOut.split(':').map(Number);
  const totalCoMinutes = coH * 60 + coM;
  const allowedMinutes = Math.max(0, totalCoMinutes - tolerance);
  const allowedH = Math.floor(allowedMinutes / 60);
  const allowedM = allowedMinutes % 60;
  const earliestAllowedCheckOut = `${String(allowedH).padStart(2, '0')}:${String(allowedM).padStart(2, '0')}`;

  let labelJadwal = `${checkIn} – ${checkOut} WIB (Boleh Pulang: ≥${earliestAllowedCheckOut})`;
  if (isSunday) {
    labelJadwal = 'Hari Libur Mingguan (Minggu)';
  } else if (isSaturday) {
    labelJadwal = `Sabtu: Masuk ${checkIn} • Pulang ${checkOut} WIB (Boleh Pulang mulai ${earliestAllowedCheckOut} WIB)`;
  } else {
    labelJadwal = `Senin–Jumat: Masuk ${checkIn} • Pulang ${checkOut} WIB (Boleh Pulang mulai ${earliestAllowedCheckOut} WIB)`;
  }

  return {
    namaHari,
    dayIndex,
    isSunday,
    isSaturday,
    isWeekday,
    isLibur: isSunday,
    checkInTime: checkIn,
    checkOutTime: checkOut,
    earliestAllowedCheckOut,
    earliestCheckoutTime: earliestAllowedCheckOut,
    earlyCheckoutToleranceMinutes: tolerance,
    labelJadwal,
  };
}

// Utility kurangi menit dari format HH:mm
export function kurangiMenit(timeStr: string, minutesToSubtract: number): string {
  if (!timeStr || !timeStr.includes(':')) return timeStr;
  const [h, m] = timeStr.split(':').map(Number);
  let totalMin = h * 60 + m - minutesToSubtract;
  if (totalMin < 0) totalMin += 24 * 60;
  const newH = Math.floor(totalMin / 60) % 24;
  const newM = totalMin % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

// Hitung status pulang (NORMAL vs PULANG TERLALU CEPAT / EARLY_CHECKOUT)
export function hitungStatusPulang(
  jamPulangStr: string, // "HH:mm" atau "HH:mm:ss"
  jadwalPulangStr: string = '17:00', // "17:00" atau "12:30"
  toleransiPulangCepat: number = 10
): {
  statusPulang: 'NORMAL' | 'PULANG TERLALU CEPAT';
  checkoutStatus: CheckoutStatus;
  isEarlyCheckout: boolean;
  earlyCheckoutMinutes: number;
  earliestAllowedTime: string;
} {
  if (!jamPulangStr) {
    return {
      statusPulang: 'NORMAL',
      checkoutStatus: 'BELUM_PULANG',
      isEarlyCheckout: false,
      earlyCheckoutMinutes: 0,
      earliestAllowedTime: jadwalPulangStr,
    };
  }

  const [jamAktual, menitAktual] = jamPulangStr.split(':').map(Number);
  const [jamJadwal, menitJadwal] = jadwalPulangStr.split(':').map(Number);

  const totalMenitAktual = jamAktual * 60 + menitAktual;
  const totalMenitJadwal = jamJadwal * 60 + menitJadwal;
  const batasMenitBolehPulang = totalMenitJadwal - toleransiPulangCepat;

  const allowedH = Math.floor(Math.max(0, batasMenitBolehPulang) / 60);
  const allowedM = Math.max(0, batasMenitBolehPulang) % 60;
  const earliestAllowedTime = `${String(allowedH).padStart(2, '0')}:${String(allowedM).padStart(2, '0')}`;

  if (totalMenitAktual < batasMenitBolehPulang) {
    const selisih = batasMenitBolehPulang - totalMenitAktual;
    return {
      statusPulang: 'PULANG TERLALU CEPAT',
      checkoutStatus: 'EARLY_CHECKOUT',
      isEarlyCheckout: true,
      earlyCheckoutMinutes: selisih,
      earliestAllowedTime,
    };
  }

  return {
    statusPulang: 'NORMAL',
    checkoutStatus: 'NORMAL',
    isEarlyCheckout: false,
    earlyCheckoutMinutes: 0,
    earliestAllowedTime,
  };
}

// Hitung menit terlambat berdasarkan jam jadwal masuk dan jam absen aktual
export function hitungMenitTerlambat(
  jamAbsenStr: string, // format "HH:mm" atau "HH:mm:ss"
  jadwalMasukStr: string = '09:00',
  toleransi: number = 0
): { status: AttendanceStatus; menitTerlambat: number } {
  if (!jamAbsenStr) {
    return { status: 'BELUM LENGKAP', menitTerlambat: 0 };
  }

  const [jamAktual, menitAktual] = jamAbsenStr.split(':').map(Number);
  const [jamJadwal, menitJadwal] = jadwalMasukStr.split(':').map(Number);

  const totalMenitAktual = jamAktual * 60 + menitAktual;
  const totalMenitJadwal = jamJadwal * 60 + menitJadwal;

  const selisih = totalMenitAktual - (totalMenitJadwal + toleransi);

  if (selisih > 0) {
    return {
      status: 'TERLAMBAT',
      menitTerlambat: selisih,
    };
  }

  return {
    status: 'HADIR',
    menitTerlambat: 0,
  };
}

// Cek apakah tanggal tertentu adalah hari libur atau hari non-kerja
export function cekHariLibur(
  tanggalStr: string, // YYYY-MM-DD
  holidays: Holiday[] = [],
  workDays: string[] = DEFAULT_SCHEDULE.workDays
): { isLibur: boolean; alasan?: string; holidayName?: string } {
  const d = new Date(tanggalStr + 'T12:00:00');
  const namaHari = d.toLocaleDateString('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' });

  // Cek daftar hari libur nasional / kantor
  const holiday = holidays.find((h) => h.date === tanggalStr);
  if (holiday) {
    return { isLibur: true, alasan: `Hari Libur: ${holiday.name}`, holidayName: holiday.name };
  }

  // Cek apakah hari kerja
  if (!workDays.includes(namaHari)) {
    return { isLibur: true, alasan: `Bukan Hari Kerja (${namaHari})` };
  }

  return { isLibur: false };
}

// Dapatkan rentang Senin - Sabtu untuk tanggal acuan
export function getRentangMinggu(tanggalStr: string): {
  weekStart: string; // YYYY-MM-DD (Senin)
  weekEnd: string; // YYYY-MM-DD (Sabtu)
  label: string; // "10 – 15 Agustus 2026"
  dates: { tanggal: string; hari: string }[];
} {
  const d = new Date(tanggalStr + 'T12:00:00');
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);

  const dates: { tanggal: string; hari: string }[] = [];
  for (let i = 0; i < 6; i++) {
    const cur = new Date(monday);
    cur.setDate(monday.getDate() + i);
    const dateStr = cur.toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
    const hariName = cur.toLocaleDateString('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' });
    dates.push({ tanggal: dateStr, hari: hariName });
  }

  const weekStart = dates[0].tanggal;
  const weekEnd = dates[dates.length - 1].tanggal;
  const label = `${formatTanggal(weekStart)} – ${formatTanggal(weekEnd)}`;

  return { weekStart, weekEnd, label, dates };
}

// Dapatkan seluruh minggu (Senin–Sabtu) dalam satu bulan kalender
export function getMingguDalamBulan(bulanStr: string): {
  weekStart: string;
  weekEnd: string;
  label: string;
  dates: { tanggal: string; hari: string }[];
}[] {
  const [yearStr, monthStr] = bulanStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-12

  const firstDayOfMonth = new Date(year, month - 1, 1, 12, 0, 0);
  const lastDayOfMonth = new Date(year, month, 0, 12, 0, 0);

  const weeksMap = new Map<string, { weekStart: string; weekEnd: string; label: string; dates: { tanggal: string; hari: string }[] }>();

  for (let d = new Date(firstDayOfMonth); d <= lastDayOfMonth; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
    const week = getRentangMinggu(dateStr);
    if (!weeksMap.has(week.weekStart)) {
      weeksMap.set(week.weekStart, week);
    }
  }

  return Array.from(weeksMap.values());
}

// Hitung Uang Rajin Mingguan untuk seorang karyawan secara komprehensif (Configurable Owner)
export function hitungUangRajinMingguan(
  attendanceRecords: AttendanceRecord[], // records for the employee in the week
  weekStart: string,
  weekEnd: string,
  holidays: Holiday[] = [],
  baseBonus: number = 150000,
  lateDeduction: number = 20000,
  workDays: string[] = DEFAULT_SCHEDULE.workDays,
  minBonus: number = 0
): {
  baseBonus: number;
  eligibleWorkDays: number;
  presentDays: number;
  lateDays: number;
  lateCount: number;
  lateDeduction: number;
  deduction: number;
  bonusAmount: number;
  finalBonus: number;
  isFullAttendance: boolean;
  reason: string;
  breakdown: AttendanceBonusDayBreakdown[];
} {
  const weekInfo = getRentangMinggu(weekStart);
  let eligibleWorkDays = 0;
  let presentDays = 0;
  let lateDays = 0;

  const breakdown: AttendanceBonusDayBreakdown[] = weekInfo.dates.map((item) => {
    const tanggal = item.tanggal;
    const hari = item.hari;

    // Cek apakah libur nasional / kantor
    const liburCheck = cekHariLibur(tanggal, holidays, workDays);
    const isHoliday = liburCheck.isLibur && !!liburCheck.holidayName;
    const isWorkDay = workDays.includes(hari) && !isHoliday;

    if (isWorkDay) {
      eligibleWorkDays += 1;
    }

    // Cari record attendance
    const record = attendanceRecords.find(
      (r) => r.tanggal === tanggal || r.date === tanggal || (r.id && r.id.endsWith(tanggal.replace(/-/g, '')))
    );

    const checkInTime = record?.waktuMasuk || record?.checkInTime;
    const checkOutTime = record?.waktuPulang || record?.checkOutTime;
    const hasCheckIn = !!checkInTime || record?.status === 'HADIR' || record?.status === 'TERLAMBAT';

    let status: AttendanceStatus | 'TIDAK HADIR' | 'LIBUR' | 'BELUM ABSEN' = 'BELUM ABSEN';
    let menitTerlambat = 0;
    let potongan = 0;
    let keterangan = '';

    if (isHoliday) {
      status = 'LIBUR';
      keterangan = `Hari Libur: ${liburCheck.holidayName || 'Libur Resmi'}`;
    } else if (!isWorkDay) {
      status = 'LIBUR';
      keterangan = `Libur Rutin (${hari})`;
    } else if (hasCheckIn) {
      presentDays += 1;
      menitTerlambat = record.menitTerlambat || record.lateMinutes || 0;
      const isLate = record.status === 'TERLAMBAT' || menitTerlambat > 0;

      if (isLate) {
        lateDays += 1;
        potongan = lateDeduction;
        status = 'TERLAMBAT';
        keterangan = `Check-In ${checkInTime || 'Hadir'} (Terlambat ${menitTerlambat} menit) → Potongan Rp${lateDeduction.toLocaleString('id-ID')}`;
      } else {
        status = 'HADIR';
        keterangan = `Check-In ${checkInTime || 'Hadir'} (Tepat Waktu / Full Day)`;
      }

      if (record.isEarlyCheckout || record.checkoutStatus === 'EARLY_CHECKOUT') {
        keterangan += ` • Pulang cepat ${checkOutTime || ''} WIB (-${record.earlyCheckoutMinutes || 0}m, tidak memotong Uang Rajin)`;
      }
    } else {
      status = 'TIDAK HADIR';
      keterangan = 'Tidak ada catatan Check-In valid pada hari kerja ini';
    }

    return {
      tanggal,
      hari,
      isHoliday,
      holidayName: liburCheck.holidayName,
      isWorkDay,
      checkInTime,
      checkOutTime,
      status,
      menitTerlambat,
      potongan,
      keterangan,
    };
  });

  // Aturan PT.KDRT (Configurable oleh Owner):
  // 1. Kehadiran penuh wajib (semua eligibleWorkDays harus ada Check-In / Full Day). Jika tidak penuh, Uang Rajin = minBonus.
  // 2. Terlambat memotong lateDeduction per kejadian keterlambatan.
  // 3. Batas minimum pembayaran = minBonus (default Rp 0). Jika hasil negatif otomatis minBonus.
  const isFullAttendance = eligibleWorkDays > 0 && presentDays >= eligibleWorkDays;
  let finalBonus = minBonus;
  let totalDeduction = 0;
  let reason = '';

  if (!isFullAttendance) {
    finalBonus = minBonus;
    totalDeduction = baseBonus;
    reason = `Tidak memenuhi kehadiran penuh minggu ini (Hadir ${presentDays}/${eligibleWorkDays} hari kerja).`;
  } else {
    totalDeduction = lateDays * lateDeduction;
    // Perhitungan dinamis: baseBonus - totalDeduction (batas minimum minBonus, default Rp 0)
    finalBonus = Math.max(minBonus, baseBonus - totalDeduction);
    if (lateDays > 0) {
      reason = `Hadir penuh (${presentDays}/${eligibleWorkDays} hari), terlambat ${lateDays} kali (Potongan Rp${totalDeduction.toLocaleString('id-ID')}).`;
    } else {
      reason = `Hadir penuh tepat waktu (${presentDays}/${eligibleWorkDays} hari) tanpa keterlambatan.`;
    }
  }

  return {
    baseBonus,
    eligibleWorkDays,
    presentDays,
    lateDays,
    lateCount: lateDays,
    lateDeduction: totalDeduction,
    deduction: totalDeduction,
    bonusAmount: finalBonus,
    finalBonus,
    isFullAttendance,
    reason,
    breakdown,
  };
}
