import React from 'react';
import { Film, CheckCircle2, Clock, XCircle, AlertCircle, Download, FileSpreadsheet, Layers } from 'lucide-react';
import { ContentCalendarItem, Account, Employee, UserProfile, ReportScopeFilter } from '../../types';
import { exportReportData } from '../../services/exportService';

interface ContentReportViewProps {
  contents: ContentCalendarItem[];
  accounts: Account[];
  employees: Employee[];
  userProfile: UserProfile;
  scope: ReportScopeFilter;
  dateRange: string;
}

export const ContentReportView: React.FC<ContentReportViewProps> = ({
  contents,
  accounts,
  employees,
  userProfile,
  scope,
  dateRange,
}) => {
  let targetVt = 0;
  let terjadwal = 0;
  let diposting = 0;
  let tertunda = 0;
  let dibatalkan = 0;

  const accountMap: Record<
    string,
    { accountName: string; scope: string; target: number; posted: number; outstanding: number }
  > = {};

  const employeeMap: Record<
    string,
    { name: string; role: string; target: number; posted: number }
  > = {};

  contents.forEach((c) => {
    const tgt = c.targetOutput || 1;
    targetVt += tgt;

    if (c.status === 'DIPOSTING') {
      diposting += tgt;
    } else if (c.status === 'DIBATALKAN') {
      dibatalkan += tgt;
    } else if (c.status === 'TERJADWAL' || c.status === 'SIAP') {
      terjadwal += tgt;
    } else {
      tertunda += tgt;
    }

    // Account breakdown
    const accId = c.accountId || 'ACC';
    if (!accountMap[accId]) {
      accountMap[accId] = {
        accountName: c.accountName || 'Akun ' + accId,
        scope: c.scope || 'PRIBADI',
        target: 0,
        posted: 0,
        outstanding: 0,
      };
    }
    accountMap[accId].target += tgt;
    if (c.status === 'DIPOSTING') {
      accountMap[accId].posted += tgt;
    } else if (c.status !== 'DIBATALKAN') {
      accountMap[accId].outstanding += tgt;
    }

    // Talent breakdown
    if (c.talentId || c.talentName) {
      const tId = c.talentId || c.talentName || 'TALENT';
      if (!employeeMap[tId]) {
        employeeMap[tId] = {
          name: c.talentName || 'Talent',
          role: 'TALENT',
          target: 0,
          posted: 0,
        };
      }
      employeeMap[tId].target += tgt;
      if (c.status === 'DIPOSTING') employeeMap[tId].posted += tgt;
    }

    // Editor breakdown
    if (c.editorId || c.editorName) {
      const eId = c.editorId || c.editorName || 'EDITOR';
      if (!employeeMap[eId]) {
        employeeMap[eId] = {
          name: c.editorName || 'Editor',
          role: 'EDITOR',
          target: 0,
          posted: 0,
        };
      }
      employeeMap[eId].target += tgt;
      if (c.status === 'DIPOSTING') employeeMap[eId].posted += tgt;
    }
  });

  const accountList = Object.values(accountMap).sort((a, b) => b.posted - a.posted);
  const employeeList = Object.values(employeeMap).sort((a, b) => b.posted - a.posted);

  const handleExport = (format: 'CSV' | 'XLSX') => {
    const exportData = contents.map((c) => ({
      Tanggal: c.date,
      Jam: c.time,
      Akun: c.accountName || '-',
      Scope: c.scope,
      'Judul Konten': c.title,
      Produk: c.productName || '-',
      Talent: c.talentName || '-',
      Editor: c.editorName || '-',
      Status: c.status,
      Target: `${c.targetOutput || 1} ${c.unitOutput || 'VT'}`,
      'Link Posting': c.postedUrl || '-',
    }));

    exportReportData({
      filenamePrefix: 'laporan_produksi_konten',
      sheetName: 'Produksi Konten',
      category: 'KONTEN',
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
            <Film className="h-5 w-5 text-indigo-600" />
            <span>LAPORAN PRODUKSI KONTEN & REALISASI VT</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Pencapaian Target Video TikTok, Rasio Posting, dan Distribusi Output Per Karyawan
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
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-indigo-700 transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Export Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700">
            TOTAL TARGET VT
          </span>
          <div className="text-2xl font-black text-indigo-950 font-mono tracking-tight mt-1">
            {targetVt} <span className="text-xs font-normal text-indigo-800">VT</span>
          </div>
          <div className="mt-1 text-[11px] text-indigo-700">{contents.length} Slot Jadwal</div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
            BERHASIL DIPOSTING
          </span>
          <div className="text-2xl font-black text-emerald-950 font-mono tracking-tight mt-1">
            {diposting} <span className="text-xs font-normal text-emerald-800">VT</span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-700 font-bold">
            {targetVt > 0 ? ((diposting / targetVt) * 100).toFixed(1) : '0'}% Realisasi
          </div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-blue-700">
            TERJADWAL / SIAP
          </span>
          <div className="text-2xl font-black text-blue-950 font-mono tracking-tight mt-1">
            {terjadwal} <span className="text-xs font-normal text-blue-800">VT</span>
          </div>
          <div className="mt-1 text-[11px] text-blue-700">Menunggu jam posting</div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">
            DALAM PRODUKSI / TERTUNDA
          </span>
          <div className="text-2xl font-black text-amber-950 font-mono tracking-tight mt-1">
            {tertunda} <span className="text-xs font-normal text-amber-800">VT</span>
          </div>
          <div className="mt-1 text-[11px] text-amber-700">Tahap Ide, Rekam, Edit</div>
        </div>
      </div>

      {/* Breakdown Per Akun & Per Karyawan */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Per Akun */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2 flex items-center justify-between">
            <span>Realisasi Output Per Akun TikTok</span>
            <span className="text-slate-400">{accountList.length} Akun</span>
          </h3>
          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
            {accountList.map((acc) => (
              <div key={acc.accountName} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="font-bold text-slate-900">{acc.accountName} ({acc.scope})</div>
                  <div className="font-mono font-black text-emerald-700">
                    {acc.posted} / {acc.target} VT
                  </div>
                </div>
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${acc.target > 0 ? (acc.posted / acc.target) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Per Karyawan */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2 flex items-center justify-between">
            <span>Produktivitas Talent & Editor</span>
            <span className="text-slate-400">{employeeList.length} Personel</span>
          </h3>
          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
            {employeeList.map((emp) => (
              <div key={emp.name + emp.role} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <div className="font-bold text-slate-900">{emp.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{emp.role}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold font-mono text-slate-900">{emp.posted} Posted</div>
                  <div className="text-[10px] text-slate-400 font-mono">Target: {emp.target}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
