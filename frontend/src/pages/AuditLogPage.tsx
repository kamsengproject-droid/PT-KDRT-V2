import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  User,
  Clock,
  FileSpreadsheet,
  CheckCircle2,
} from 'lucide-react';
import { subscribeAuditLogs } from '../services/auditService';
import { AuditLogEntry } from '../types';
import { formatTanggalWaktu } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';

export const AuditLogPage: React.FC = () => {
  const { userProfile, loading: authLoading, currentUser } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');

  useEffect(() => {
    if (authLoading || !currentUser || !userProfile?.active) {
      return;
    }
    const unsub = subscribeAuditLogs(100, setLogs);
    return unsub;
  }, [authLoading, currentUser?.uid, userProfile?.role, userProfile?.active]);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.target.toLowerCase().includes(searchQuery.toLowerCase()) ||
      JSON.stringify(log.details || {}).toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAction =
      selectedAction === 'ALL' || log.action.toUpperCase().includes(selectedAction);

    return matchesSearch && matchesAction;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 flex items-center gap-2.5">
          <ShieldAlert className="h-6 w-6 text-emerald-600" />
          Audit Log Sistem PT.KDRT
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Rekaman jejak aktivitas finansial, absensi masuk/pulang, penggajian, dan perubahan pengaturan.
        </p>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-2xs">
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setSelectedAction('ALL')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
              selectedAction === 'ALL'
                ? 'bg-zinc-900 text-white'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            Semua Aksi
          </button>
          <button
            onClick={() => setSelectedAction('ABSENSI')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
              selectedAction === 'ABSENSI'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            Absensi
          </button>
          <button
            onClick={() => setSelectedAction('PAYROLL')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
              selectedAction === 'PAYROLL'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
            }`}
          >
            Penggajian
          </button>
          <button
            onClick={() => setSelectedAction('BONUS')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
              selectedAction === 'BONUS'
                ? 'bg-purple-600 text-white'
                : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
            }`}
          >
            Uang Rajin
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Cari user, aksi, catatan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 py-1.5 text-xs text-zinc-900 focus:bg-white focus:outline-emerald-500"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 text-zinc-500 uppercase tracking-wider text-[10px] font-bold border-b border-zinc-100">
              <tr>
                <th className="px-6 py-3">Waktu (WIB)</th>
                <th className="px-4 py-3">Pengguna</th>
                <th className="px-4 py-3">Aktivitas / Aksi</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-6 py-3">Detail Parameter</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700 font-mono">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-400 font-sans font-medium">
                    Belum ada log aktivitas yang tercatat.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="px-6 py-3.5 text-zinc-500 whitespace-nowrap">
                      {formatTanggalWaktu(log.timestamp)}
                    </td>
                    <td className="px-4 py-3.5 font-sans font-bold text-zinc-900">
                      {log.userName}
                    </td>
                    <td className="px-4 py-3.5 font-sans">
                      <span className="inline-block rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-800">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-sans font-medium text-zinc-700">
                      {log.target}
                    </td>
                    <td className="px-6 py-3.5 text-[11px] text-zinc-600 font-mono truncate max-w-xs">
                      {JSON.stringify(log.details || {})}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
