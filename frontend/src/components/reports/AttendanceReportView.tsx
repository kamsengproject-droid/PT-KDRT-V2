import React from 'react';
import { Camera, CheckCircle2, Clock, AlertCircle, LogOut, Download, FileSpreadsheet, Lock } from 'lucide-react';
import { Attendance, Employee, UserProfile, ReportScopeFilter } from '../../types';
import { exportReportData } from '../../services/exportService';

interface AttendanceReportViewProps {
  attendances: Attendance[];
  employees: Employee[];
  userProfile: UserProfile;
  scope: ReportScopeFilter;
  dateRange: string;
}

export const AttendanceReportView: React.FC<AttendanceReportViewProps> = ({
  attendances,
  employees,
  userProfile,
  scope,
  dateRange,
}) => {
  const isInvestor = userProfile.role === 'INVESTOR';

  // Strict Investor privacy check
  if (isInvestor) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3 shadow-2xs">
        <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
          <Lock className="h-6 w-6" />
        </div>
        <h3 className="text-base font-black text-slate-900">Akses Terbatas untuk Investor</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Rincian log kehadiran harian, GPS, dan verifikasi selfie karyawan merupakan data operasional internal yang dirahasiakan.
        </p>
      </div>
    );
  }

  // Calculate statistics
  let totalHadir = 0;
  let totalTerlambat = 0;
  let totalTidakHadir = 0;
  let totalEarlyCheckout = 0;
  let totalMenitTerlambat = 0;

  const empStatsMap: Record<
    string,
    {
      employeeId: string;
      employeeName: string;
      hadir: number;
      terlambat: number;
      menitTerlambat: number;
      earlyCheckout: number;
      tidakHadir: number;
    }
  > = {};

  // Initialize for all employees
  employees.forEach((emp) => {
    const id = emp.id || emp.userId || 'EMP';
    empStatsMap[id] = {
      employeeId: id,
      employeeName: emp.name,
      hadir: 0,
      terlambat: 0,
      menitTerlambat: 0,
      earlyCheckout: 0,
      tidakHadir: 0,
    };
  });

  attendances.forEach((att) => {
    const empId = att.employeeId || att.userId;
    if (att.status === 'HADIR') {
      totalHadir += 1;
      if (empId && empStatsMap[empId]) empStatsMap[empId].hadir += 1;
    } else if (att.status === 'TERLAMBAT') {
      totalTerlambat += 1;
      const lateMins = att.lateMinutes || att.menitTerlambat || 0;
      totalMenitTerlambat += lateMins;
      if (empId && empStatsMap[empId]) {
        empStatsMap[empId].terlambat += 1;
        empStatsMap[empId].menitTerlambat += lateMins;
      }
    } else if (att.status === 'TIDAK_HADIR' || att.status === 'ALPHA' || att.status === 'IZIN') {
      totalTidakHadir += 1;
      if (empId && empStatsMap[empId]) empStatsMap[empId].tidakHadir += 1;
    }

    if (att.isEarlyCheckout || att.earlyCheckout) {
      totalEarlyCheckout += 1;
      if (empId && empStatsMap[empId]) empStatsMap[empId].earlyCheckout += 1;
    }
  });

  const empStatsList = Object.values(empStatsMap).sort((a, b) => b.hadir - a.hadir);

  const handleExport = (format: 'CSV' | 'XLSX') => {
    const exportData = empStatsList.map((e) => ({
      'Nama Karyawan': e.employeeName,
      'Hadir Tepat Waktu': e.hadir,
      Terlambat: e.terlambat,
      'Total Menit Terlambat': e.menitTerlambat,
      'Early Checkout': e.earlyCheckout,
      'Izin / Tidak Hadir': e.tidakHadir,
      'Total Presensi': e.hadir + e.terlambat,
    }));

    exportReportData({
      filenamePrefix: 'laporan_rekap_absensi',
      sheetName: 'Rekapitulasi Absensi',
      category: 'ABSENSI',
      scope,
      periodOrDateRange: dateRange,
      data: exportData,
      format,
      userProfile,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Camera className="h-5 w-5 text-blue-600" />
            <span>LAPORAN REKAPITULASI ABSENSI & KEDISIPLINAN</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Rekap Hari Kerja, Ketepatan Waktu, Akumulasi Menit Keterlambatan, dan Early Checkout
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('CSV')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => handleExport('XLSX')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-blue-700 transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Export Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
            TOTAL HADIR TEPAT
          </span>
          <div className="text-2xl font-black text-emerald-950 font-mono tracking-tight mt-1">
            {totalHadir}
          </div>
          <div className="mt-1 text-[11px] text-emerald-700">Presensi normal</div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">
            TOTAL TERLAMBAT
          </span>
          <div className="text-2xl font-black text-amber-950 font-mono tracking-tight mt-1">
            {totalTerlambat} <span className="text-xs font-normal text-amber-800">({totalMenitTerlambat} mnt)</span>
          </div>
          <div className="mt-1 text-[11px] text-amber-700">Presensi lewat jam masuk</div>
        </div>

        <div className="rounded-2xl border border-purple-200 bg-purple-50/70 p-4 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-purple-700">
            EARLY CHECKOUT
          </span>
          <div className="text-2xl font-black text-purple-950 font-mono tracking-tight mt-1">
            {totalEarlyCheckout}
          </div>
          <div className="mt-1 text-[11px] text-purple-700">Pulang mendahului shift</div>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-rose-700">
            TIDAK HADIR / IZIN
          </span>
          <div className="text-2xl font-black text-rose-950 font-mono tracking-tight mt-1">
            {totalTidakHadir}
          </div>
          <div className="mt-1 text-[11px] text-rose-700">Absen tanpa checkout</div>
        </div>
      </div>

      {/* Per-Employee Attendance Table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
            Rekapitulasi Kehadiran Per Karyawan ({empStatsList.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-black text-slate-700 uppercase tracking-wider">
                <th className="py-3 px-4">Nama Karyawan</th>
                <th className="py-3 px-4 text-center">Hadir Tepat</th>
                <th className="py-3 px-4 text-center">Terlambat</th>
                <th className="py-3 px-4 text-center">Total Menit Telat</th>
                <th className="py-3 px-4 text-center">Early Checkout</th>
                <th className="py-3 px-4 text-center">Izin / Alpha</th>
                <th className="py-3 px-4 text-center">Total Hari Kerja</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {empStatsList.map((stat) => {
                const totalWork = stat.hadir + stat.terlambat;
                return (
                  <tr key={stat.employeeId} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{stat.employeeName}</td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-emerald-700">
                      {stat.hadir}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-amber-700">
                      {stat.terlambat}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-700">
                      {stat.menitTerlambat > 0 ? `${stat.menitTerlambat} menit` : '-'}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-purple-700">
                      {stat.earlyCheckout > 0 ? stat.earlyCheckout : '-'}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-rose-700">
                      {stat.tidakHadir > 0 ? stat.tidakHadir : '-'}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-black text-slate-900">
                      {totalWork} Hari
                    </td>
                  </tr>
                );
              })}

              {empStatsList.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-400 italic">
                    Belum ada data absensi untuk periode ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
