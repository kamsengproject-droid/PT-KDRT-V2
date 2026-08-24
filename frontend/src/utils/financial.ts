import { DailyPerformance, Expense } from '../types';

// Semua rumus keuangan terpusat di sini — jangan duplikasi di komponen manapun.

// Uang Masuk HANYA dari Komisi Real, BUKAN GMV, BUKAN Estimasi Komisi.
export function hitungUangMasuk(dailyPerformanceList: DailyPerformance[]): number {
  return dailyPerformanceList.reduce((total, item) => total + (Number(item.realCommission) || 0), 0);
}

export function hitungUangKeluar(expenseList: Expense[]): number {
  return expenseList.reduce((total, item) => total + (Number(item.amount) || 0), 0);
}

export function hitungArusKasBersih(uangMasuk: number, uangKeluar: number): number {
  return uangMasuk - uangKeluar;
}

export function hitungTotalGMV(dailyPerformanceList: DailyPerformance[]): number {
  return dailyPerformanceList.reduce((total, item) => total + (Number(item.gmv) || 0), 0);
}

export function hitungTotalEstimasiKomisi(dailyPerformanceList: DailyPerformance[]): number {
  return dailyPerformanceList.reduce((total, item) => total + (Number(item.estimatedCommission) || 0), 0);
}

// Ringkasan performa per akun
export function ringkasanPerforma(dailyPerformanceList: DailyPerformance[]) {
  const perAkun: Record<string, { gmv: number; estimatedCommission: number; realCommission: number; jumlahEntri: number }> = {};
  for (const item of dailyPerformanceList) {
    const key = item.accountId || 'tanpa-id';
    if (!perAkun[key]) {
      perAkun[key] = { gmv: 0, estimatedCommission: 0, realCommission: 0, jumlahEntri: 0 };
    }
    perAkun[key].gmv += Number(item.gmv) || 0;
    perAkun[key].estimatedCommission += Number(item.estimatedCommission) || 0;
    perAkun[key].realCommission += Number(item.realCommission) || 0;
    perAkun[key].jumlahEntri += 1;
  }
  return perAkun;
}
