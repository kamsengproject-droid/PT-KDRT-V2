import React from 'react';
import { Users, UserCheck, UserX, Briefcase, Download, FileSpreadsheet } from 'lucide-react';
import { Employee, UserProfile, ReportScopeFilter } from '../../types';
import { exportReportData } from '../../services/exportService';

interface EmployeeReportViewProps {
  employees: Employee[];
  userProfile: UserProfile;
  scope: ReportScopeFilter;
  dateRange: string;
}

export const EmployeeReportView: React.FC<EmployeeReportViewProps> = ({
  employees,
  userProfile,
  scope,
  dateRange,
}) => {
  const activeEmployees = employees.filter((e) => e.active !== false);
  const inactiveEmployees = employees.filter((e) => e.active === false);

  const positionMap: Record<string, number> = {};
  const scopeMap: Record<string, number> = { PRIBADI: 0, SHARING: 0 };

  employees.forEach((e) => {
    const pos = e.position || e.role || 'STAFF';
    positionMap[pos] = (positionMap[pos] || 0) + 1;

    const sc = e.scope || 'PRIBADI';
    scopeMap[sc] = (scopeMap[sc] || 0) + 1;
  });

  const handleExport = (format: 'CSV' | 'XLSX') => {
    const exportData = employees.map((e) => ({
      NIK: e.nik || '-',
      'Nama Karyawan': e.name,
      Jabatan: e.position || e.role,
      Scope: e.scope || 'PRIBADI',
      Status: e.active !== false ? 'AKTIF' : 'NONAKTIF',
      'No Telepon': e.phone || '-',
      'Tanggal Bergabung': e.joinDate || '-',
    }));

    exportReportData({
      filenamePrefix: 'laporan_karyawan',
      sheetName: 'Data Karyawan',
      category: 'KARYAWAN',
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
            <Users className="h-5 w-5 text-orange-600" />
            <span>LAPORAN DEMOGRAFI & DATA KARYAWAN</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Komposisi Tim Kantor PT.KDRT Berdasarkan Jabatan, Status Keaktifan, dan Scope Kerja
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
            className="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-orange-700 transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Export Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">
              KARYAWAN AKTIF
            </span>
            <UserCheck className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="text-3xl font-black text-emerald-950 font-mono tracking-tight">
            {activeEmployees.length} Orang
          </div>
          <div className="mt-2 text-xs text-emerald-700 font-medium">
            Karyawan dengan hak akses dan tugas aktif
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">
              KARYAWAN NONAKTIF
            </span>
            <UserX className="h-5 w-5 text-slate-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 font-mono tracking-tight">
            {inactiveEmployees.length} Orang
          </div>
          <div className="mt-2 text-xs text-slate-500 font-medium">
            Alumni / tidak lagi beroperasi
          </div>
        </div>

        <div className="rounded-2xl border border-purple-200 bg-purple-50/70 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-purple-700">
              DISTRIBUSI SCOPE KERJA
            </span>
            <Briefcase className="h-5 w-5 text-purple-600" />
          </div>
          <div className="text-lg font-black text-purple-950 font-mono mt-1 flex items-center gap-3">
            <span>Pribadi: {scopeMap.PRIBADI || 0}</span>
            <span>Sharing: {scopeMap.SHARING || 0}</span>
          </div>
          <div className="mt-2 text-xs text-purple-700 font-medium">
            Alokasi penugasan akun dan beban operasional
          </div>
        </div>
      </div>

      {/* Breakdown Jabatan */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
          Breakdown Berdasarkan Jabatan / Role
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Object.entries(positionMap).map(([pos, count]) => (
            <div key={pos} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 truncate">
                {pos}
              </div>
              <div className="text-xl font-black text-slate-900 font-mono mt-1">
                {count} <span className="text-xs font-normal text-slate-500">orang</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Employees Table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
            Daftar Seluruh Karyawan ({employees.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-black text-slate-700 uppercase tracking-wider">
                <th className="py-3 px-4">Nama Karyawan</th>
                <th className="py-3 px-4">Jabatan</th>
                <th className="py-3 px-4">Scope</th>
                <th className="py-3 px-4">Kontak</th>
                <th className="py-3 px-4">Tgl Bergabung</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((emp) => (
                <tr key={emp.id || emp.userId} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900">
                    <div>{emp.name}</div>
                    {emp.nik && <div className="text-[10px] text-slate-400 font-mono">NIK: {emp.nik}</div>}
                  </td>
                  <td className="py-3 px-4 text-slate-700 font-medium">{emp.position || emp.role}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-800">
                      {emp.scope || 'PRIBADI'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600 font-mono">{emp.phone || '-'}</td>
                  <td className="py-3 px-4 text-slate-600">{emp.joinDate || '-'}</td>
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                        emp.active !== false
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {emp.active !== false ? 'AKTIF' : 'NONAKTIF'}
                    </span>
                  </td>
                </tr>
              ))}

              {employees.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-slate-400 italic">
                    Belum ada data karyawan terdaftar.
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
