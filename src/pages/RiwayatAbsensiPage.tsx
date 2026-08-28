import React, { useState, useEffect } from 'react';
import {
  CalendarCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  Search,
  Filter,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { subscribeEmployeeAttendance } from '../services/attendanceService';
import { AttendanceRecord } from '../types';
import { formatTanggal, formatHariTanggal, tanggalHariIni } from '../utils/formatters';

export const RiwayatAbsensiPage: React.FC = () => {
  const { userProfile, employeeProfile, role, loading: authLoading, currentUser } = useAuth();
  const activeEmployeeId = employeeProfile?.id || (userProfile?.name === 'Desta' ? 'desta-id' : 'melinda-id');
  const activeEmployeeName = employeeProfile?.name || userProfile?.name || 'Melinda';

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [filterMonth, setFilterMonth] = useState<string>(tanggalHariIni().substring(0, 7));

  useEffect(() => {
    if (authLoading || !currentUser || !userProfile?.active || !activeEmployeeId) {
      return;
    }
    const unsub = subscribeEmployeeAttendance(activeEmployeeId, setRecords);
    return unsub;
  }, [authLoading, currentUser?.uid, userProfile?.role, userProfile?.active, activeEmployeeId]);

  const filteredRecords = records.filter((r) => r.tanggal.startsWith(filterMonth));

  const totalHadir = filteredRecords.filter((r) => r.status === 'HADIR').length;
  const totalTerlambat = filteredRecords.filter((r) => r.status === 'TERLAMBAT' || (r.menitTerlambat && r.menitTerlambat > 0)).length;
  const totalLibur = filteredRecords.filter((r) => r.status === 'LIBUR').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 flex items-center gap-2.5">
            <CalendarCheck className="h-6 w-6 text-emerald-600" />
            Riwayat Absensi Saya
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Catatan kehadiran, jam masuk, jam pulang, dan status keterlambatan Anda ({activeEmployeeName}).
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white rounded-xl border border-zinc-200 p-1.5 shadow-2xs">
          <Filter className="h-4 w-4 text-zinc-400 ml-2" />
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="rounded-lg border-none bg-transparent px-2 py-1 text-xs font-bold text-zinc-900 focus:outline-none"
          />
        </div>
      </div>

      {/* Monthly Summary Badges */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-center">
          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Hadir Tepat Waktu</span>
          <p className="text-2xl font-extrabold text-emerald-900 mt-1">{totalHadir} Hari</p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 text-center">
          <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Terlambat</span>
          <p className="text-2xl font-extrabold text-amber-900 mt-1">{totalTerlambat} Kali</p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-center">
          <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">Libur / Cuti</span>
          <p className="text-2xl font-extrabold text-blue-900 mt-1">{totalLibur} Hari</p>
        </div>
      </div>

      {/* Records Table */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 text-zinc-500 uppercase tracking-wider text-[10px] font-bold border-b border-zinc-100">
              <tr>
                <th className="px-6 py-3">Tanggal & Hari</th>
                <th className="px-4 py-3">Jam Masuk</th>
                <th className="px-4 py-3">Jam Pulang</th>
                <th className="px-4 py-3">Keterlambatan</th>
                <th className="px-4 py-3">Lokasi Absen</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-400 font-medium">
                    Belum ada riwayat absensi pada bulan yang dipilih.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                  const isLate = rec.status === 'TERLAMBAT' || (rec.menitTerlambat && rec.menitTerlambat > 0);
                  return (
                    <tr key={rec.id} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="px-6 py-3.5 font-bold text-zinc-900">
                        {formatHariTanggal(rec.tanggal)}
                      </td>
                      <td className="px-4 py-3.5 font-mono font-bold text-zinc-800">
                        {rec.waktuMasuk ? `${rec.waktuMasuk} WIB` : '-'}
                      </td>
                      <td className="px-4 py-3.5 font-mono font-bold text-zinc-800">
                        {rec.waktuPulang ? (
                          <div>
                            <span>{rec.waktuPulang} WIB</span>
                            {rec.isEarlyCheckout || rec.checkoutStatus === 'EARLY_CHECKOUT' ? (
                              <span className="block font-sans text-[10px] font-bold text-amber-700">
                                Pulang Cepat (-{rec.earlyCheckoutMinutes || 0}m)
                              </span>
                            ) : (
                              <span className="block font-sans text-[10px] font-normal text-emerald-700">
                                Normal
                              </span>
                            )}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {isLate ? (
                          <span className="font-bold text-amber-700">
                            +{rec.menitTerlambat} Menit
                          </span>
                        ) : (
                          <span className="text-zinc-400">0 Menit (Tepat)</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {rec.distanceFromOffice !== undefined ? (
                          <span className="text-zinc-600 font-medium">
                            {rec.distanceFromOffice}m dari kantor
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {isLate ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-900">
                            <AlertTriangle className="h-3 w-3 text-amber-600" />
                            TERLAMBAT
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-900">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            HADIR
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
