// Format angka ke Rupiah, contoh: 1500000 -> "Rp 1.500.000"
export function formatRupiah(value: number | string | undefined | null): string {
  const num = Number(value) || 0;
  return 'Rp ' + num.toLocaleString('id-ID', { maximumFractionDigits: 0 });
}

// Format tanggal ke format Indonesia, contoh: "17 Agustus 2026"
export function formatTanggal(date: Date | string | number | undefined | null): string {
  if (!date) return '-';
  try {
    const d = typeof date === 'string' && date.includes('-') && date.length === 10
      ? new Date(date + 'T12:00:00')
      : new Date(date);
    if (isNaN(d.getTime())) return String(date);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Jakarta',
    });
  } catch {
    return String(date);
  }
}

// Format hari dan tanggal, contoh: "Senin, 17 Agustus 2026"
export function formatHariTanggal(date: Date | string | number | undefined | null): string {
  if (!date) return '-';
  try {
    const d = typeof date === 'string' && date.includes('-') && date.length === 10
      ? new Date(date + 'T12:00:00')
      : new Date(date);
    if (isNaN(d.getTime())) return String(date);
    return d.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Jakarta',
    });
  } catch {
    return String(date);
  }
}

// Format jam (HH:mm:ss atau HH:mm WIB)
export function formatJam(date: Date | string | number | undefined | null): string {
  if (!date) return '-';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    return d.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Asia/Jakarta',
    }) + ' WIB';
  } catch {
    return String(date);
  }
}

// Format jam pendek (HH:mm)
export function formatJamPendek(date: Date | string | number | undefined | null): string {
  if (!date) return '-';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    return d.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    });
  } catch {
    return String(date);
  }
}

// Tanggal hari ini format YYYY-MM-DD (WIB)
export function tanggalHariIni(): string {
  // Use Asia/Jakarta timeZone
  const formatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' });
  return formatter.format(new Date());
}

// Tanggal kemarin format YYYY-MM-DD (WIB)
export function tanggalKemarin(): string {
  const todayStr = tanggalHariIni();
  const [y, m, d] = todayStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  dateObj.setDate(dateObj.getDate() - 1);
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Bulan hari ini format YYYY-MM
export function bulanHariIni(): string {
  return tanggalHariIni().substring(0, 7);
}

export const bulanSekarang = bulanHariIni;

// Nama bulan Indonesia dari 'YYYY-MM'
export function formatBulanTahun(yearMonth: string): string {
  if (!yearMonth || yearMonth.length < 7) return yearMonth;
  const [year, month] = yearMonth.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

// Format Tanggal dan Jam lengkap (contoh: "17 Agu 2026, 09:00:15 WIB")
export function formatTanggalWaktu(timestamp: any): string {
  if (!timestamp) return '-';
  try {
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(d.getTime())) return '-';
    return (
      d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }) +
      ', ' +
      d.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Jakarta',
      }) +
      ' WIB'
    );
  } catch {
    return '-';
  }
}

// Format Jam WIB sederhana dari timestamp (contoh: "09:15 WIB")
export function formatJamWIB(timestamp: any): string {
  if (!timestamp) return '-';
  try {
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(d.getTime())) return '-';
    return (
      d.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta',
      }) + ' WIB'
    );
  } catch {
    return '-';
  }
}

// Hitung dan format durasi antara dua timestamp (contoh: "5 jam 20 menit" atau "45 menit")
export function formatDurasiTimestamp(start: any, end: any): string {
  if (!start) return '-';
  try {
    const startDate = start.toDate ? start.toDate() : new Date(start);
    const endDate = end ? (end.toDate ? end.toDate() : new Date(end)) : new Date();
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return '-';
    
    const diffMs = endDate.getTime() - startDate.getTime();
    if (diffMs <= 0) return '0 menit';
    
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0 && minutes > 0) {
      return `${hours} jam ${minutes} menit`;
    } else if (hours > 0) {
      return `${hours} jam`;
    } else {
      return `${minutes} menit`;
    }
  } catch {
    return '-';
  }
}

// Utility export data to CSV file with UTF-8 BOM for Excel compatibility
export function exportToCSV(data: Record<string, any>[], filename: string): void {
  if (!data || data.length === 0) {
    alert('Tidak ada data untuk diexport.');
    return;
  }

  const headers = Object.keys(data[0]);
  const csvRows: string[] = [];

  // Header row
  csvRows.push(headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','));

  // Data rows
  for (const row of data) {
    const values = headers.map((header) => {
      const val = row[header] !== undefined && row[header] !== null ? row[header] : '';
      const stringVal = String(val).replace(/"/g, '""');
      return `"${stringVal}"`;
    });
    csvRows.push(values.join(','));
  }

  const csvString = '\uFEFF' + csvRows.join('\r\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}


