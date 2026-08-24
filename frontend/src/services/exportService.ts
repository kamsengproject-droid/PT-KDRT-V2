import * as XLSX from 'xlsx';
import { catatAuditLog } from './auditService';
import { UserProfile, ScopeType, ReportScopeFilter } from '../types';
import { tanggalHariIni } from '../utils/formatters';

export type ExportFormat = 'CSV' | 'XLSX';

export type ExportCategory =
  | 'KEUANGAN'
  | 'PERFORMA_AKUN'
  | 'PENGELUARAN'
  | 'KARYAWAN'
  | 'PAYROLL'
  | 'ABSENSI'
  | 'PRODUK'
  | 'SAMPEL'
  | 'INVENTORY'
  | 'PROFIT_SHARING'
  | 'KONTEN'
  | 'LAPORAN_INVESTOR'
  | 'CLOSING_SNAPSHOT';

export interface ExportColumnDef {
  header: string;
  key: string;
  format?: (val: any) => string | number;
}

/**
 * Universal safe data exporter for CSV and XLSX with audit logging & permission enforcement
 */
export async function exportReportData(options: {
  filenamePrefix: string;
  sheetName?: string;
  category: ExportCategory;
  scope: ReportScopeFilter;
  periodOrDateRange?: string;
  data: Record<string, any>[];
  columns?: ExportColumnDef[];
  format: ExportFormat;
  userProfile: UserProfile;
}): Promise<boolean> {
  const {
    filenamePrefix,
    sheetName = 'Data Laporan',
    category,
    scope,
    periodOrDateRange = tanggalHariIni(),
    data,
    columns,
    format,
    userProfile,
  } = options;

  // Strict Permission Check: Investor can NEVER export Private
  if (userProfile.role === 'INVESTOR' && (scope === 'PRIBADI' || scope === 'GABUNGAN')) {
    alert('Akses ditolak: Investor hanya diizinkan mengunduh laporan dengan scope SHARING.');
    return false;
  }

  if (!data || data.length === 0) {
    alert('Tidak ada baris data untuk diexport.');
    return false;
  }

  // Transform data based on columns if defined
  let exportRows: Record<string, any>[] = [];
  if (columns && columns.length > 0) {
    exportRows = data.map((item) => {
      const row: Record<string, any> = {};
      columns.forEach((col) => {
        const val = item[col.key];
        row[col.header] = col.format ? col.format(val) : val !== undefined && val !== null ? val : '-';
      });
      return row;
    });
  } else {
    exportRows = data;
  }

  const cleanPrefix = filenamePrefix.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const finalFilename = `${cleanPrefix}_${scope.toLowerCase()}_${periodOrDateRange.replace(/[^0-9\-]/g, '_')}_${Date.now()}`;

  try {
    if (format === 'XLSX') {
      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31)); // sheet names max 31 chars
      XLSX.writeFile(wb, `${finalFilename}.xlsx`);
    } else {
      // CSV format
      const ws = XLSX.utils.json_to_sheet(exportRows);
      const csvOutput = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob(['\uFEFF' + csvOutput], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${finalFilename}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }

    // Record audit log
    await catatAuditLog(
      userProfile.uid,
      userProfile.name,
      'EXPORT_CREATED',
      `export/${category}`,
      `Export ${format} kategori ${category} (${scope}) total ${exportRows.length} baris.`
    );

    return true;
  } catch (err: any) {
    console.error('Export error:', err);
    alert(`Gagal mengekspor file: ${err.message || 'Terjadi kesalahan'}`);
    return false;
  }
}
