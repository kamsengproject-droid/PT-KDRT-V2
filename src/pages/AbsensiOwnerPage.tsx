import React, { useState, useEffect } from 'react';
import {
  CalendarCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  Camera,
  Users,
  Search,
  Eye,
  Edit,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  subscribeTodayAttendance,
  overrideAttendance,
} from '../services/attendanceService';
import { subscribeEmployees } from '../services/employeeService';
import { AttendanceRecord, Employee } from '../types';
import { formatTanggal, formatHariTanggal, tanggalHariIni } from '../utils/formatters';

export const AbsensiOwnerPage: React.FC = () => {
  const { userProfile, role, loading, currentUser } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>(tanggalHariIni());
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Preview modal for selfie photo
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; name: string; time: string } | null>(
    null
  );

  // Manual Override modal
  const [overrideModal, setOverrideModal] = useState<AttendanceRecord | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<string>('HADIR');
  const [overrideTime, setOverrideTime] = useState<string>('09:00');
  const [savingOverride, setSavingOverride] = useState<boolean>(false);

  useEffect(() => {
    if (loading || !currentUser || !userProfile?.active) {
      return;
    }
    const unsubEmp = subscribeEmployees('SHARING', setEmployees);
    return unsubEmp;
  }, [loading, currentUser?.uid, userProfile?.role, userProfile?.active]);

  useEffect(() => {
    if (loading || !currentUser || !userProfile?.active) {
      return;
    }
    const unsubAtt = subscribeTodayAttendance(selectedDate, setAttendanceRecords);
    return unsubAtt;
  }, [loading, currentUser?.uid, userProfile?.role, userProfile?.active, selectedDate]);

  // Combine employees with attendance records
  const attendanceTable = employees.map((emp) => {
    const rec = attendanceRecords.find((r) => r.employeeId === emp.id);
    return {
      employee: emp,
      record: rec || null,
    };
  });

  const totalKaryawan = employees.length;
  const sudahMasuk = attendanceRecords.filter((r) => r.waktuMasuk).length;
  const terlambat = attendanceRecords.filter((r) => r.status === 'TERLAMBAT' || (r.menitTerlambat && r.menitTerlambat > 0)).length;
  const belumMasuk = totalKaryawan - sudahMasuk;
  const hadirTepatWaktu = sudahMasuk - terlambat;

  const handleSaveOverride = async () => {
    if (!overrideModal) return;
    setSavingOverride(true);
    try {
      await overrideAttendance(
        overrideModal.id || `${overrideModal.employeeId}_${selectedDate}`,
        {
          status: overrideStatus as any,
          waktuMasuk: overrideTime,
          menitTerlambat: overrideStatus === 'HADIR' ? 0 : overrideModal.menitTerlambat,
        },
        userProfile?.uid || 'owner',
        userProfile?.name || 'Owner PT.KDRT'
      );
      setOverrideModal(null);
    } finally {
      setSavingOverride(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Date Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 flex items-center gap-2.5">
            <CalendarCheck className="h-6 w-6 text-emerald-600" />
            Dashboard Absensi Hari Ini
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Monitoring kehadiran, foto selfie, koordinat GPS, dan status keterlambatan tim secara real-time.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white rounded-xl border border-zinc-200 p-1.5 shadow-2xs">
          <Clock className="h-4 w-4 text-zinc-400 ml-2" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-lg border-none bg-transparent px-2 py-1 text-xs font-bold text-zinc-900 focus:outline-none"
          />
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Total Karyawan</span>
            <Users className="h-4 w-4 text-zinc-400" />
          </div>
          <p className="text-2xl font-extrabold text-zinc-900 mt-2">{totalKaryawan}</p>
          <span className="text-[11px] text-zinc-500 font-medium">Staf Aktif Sharing</span>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Sudah Masuk</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-900 mt-2">{sudahMasuk}</p>
          <span className="text-[11px] text-emerald-700 font-medium">{hadirTepatWaktu} Tepat Waktu</span>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Terlambat</span>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-2xl font-extrabold text-amber-900 mt-2">{terlambat}</p>
          <span className="text-[11px] text-amber-700 font-medium">Potongan Rp20.000/kejadian</span>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Belum Masuk</span>
            <Clock className="h-4 w-4 text-zinc-400" />
          </div>
          <p className="text-2xl font-extrabold text-zinc-700 mt-2">{belumMasuk}</p>
          <span className="text-[11px] text-zinc-500 font-medium">Menunggu Absen</span>
        </div>
      </div>

      {/* Attendance Detail Table */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xs">
        <div className="border-b border-zinc-100 px-6 py-4 flex items-center justify-between">
          <h3 className="font-bold text-zinc-900 text-sm">
            Daftar Kehadiran Tim ({formatHariTanggal(selectedDate)})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 text-zinc-500 uppercase tracking-wider text-[10px] font-bold border-b border-zinc-100">
              <tr>
                <th className="px-6 py-3">Karyawan</th>
                <th className="px-4 py-3">Jam Masuk</th>
                <th className="px-4 py-3">Foto Selfie</th>
                <th className="px-4 py-3">Lokasi & Jarak</th>
                <th className="px-4 py-3">Jam Pulang</th>
                <th className="px-4 py-3">Status</th>
                {role === 'OWNER' && <th className="px-4 py-3 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              {attendanceTable.map(({ employee, record }) => {
                const isLate = record?.status === 'TERLAMBAT' || (record?.menitTerlambat && record.menitTerlambat > 0);
                return (
                  <tr key={employee.id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="px-6 py-4 font-semibold text-zinc-900">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 font-bold text-zinc-700 text-xs">
                          {employee.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-zinc-900">{employee.name}</p>
                          <span className="text-[11px] text-zinc-400 font-medium">
                            {employee.position} • {employee.scope}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4 font-mono font-bold text-zinc-800">
                      {record?.waktuMasuk ? `${record.waktuMasuk} WIB` : <span className="text-zinc-300 font-sans">-</span>}
                    </td>

                    <td className="px-4 py-4">
                      {record?.fotoMasuk ? (
                        <button
                          onClick={() =>
                            setPreviewPhoto({
                              url: record.fotoMasuk!,
                              name: employee.name,
                              time: `${record.waktuMasuk || ''} WIB`,
                            })
                          }
                          className="group relative h-10 w-10 overflow-hidden rounded-xl border border-zinc-200 shadow-2xs hover:scale-105 transition-all"
                        >
                          <img
                            src={record.fotoMasuk}
                            alt="Selfie"
                            className="h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <Eye className="h-4 w-4" />
                          </div>
                        </button>
                      ) : (
                        <span className="text-zinc-300 text-[11px]">Belum ada</span>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      {record?.distanceFromOffice !== undefined ? (
                        <div className="flex items-center gap-1.5 text-zinc-600 font-medium">
                          <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                          <span>{record.distanceFromOffice}m dari kantor</span>
                        </div>
                      ) : (
                        <span className="text-zinc-300">-</span>
                      )}
                    </td>

                    <td className="px-4 py-4 font-mono font-bold text-zinc-800">
                      {record?.waktuPulang ? (
                        <div>
                          <span>{record.waktuPulang} WIB</span>
                          {record.isEarlyCheckout || record.checkoutStatus === 'EARLY_CHECKOUT' ? (
                            <span className="block font-sans text-[10px] font-bold text-amber-700">
                              Pulang Cepat (-{record.earlyCheckoutMinutes || 0}m)
                            </span>
                          ) : (
                            <span className="block font-sans text-[10px] font-medium text-emerald-700">
                              Normal
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-300 font-sans">-</span>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      {!record ? (
                        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-bold text-zinc-600">
                          Belum Masuk
                        </span>
                      ) : isLate ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-900">
                          <AlertTriangle className="h-3 w-3 text-amber-600" />
                          Terlambat {record.menitTerlambat}m
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-900">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          Hadir Tepat Waktu
                        </span>
                      )}
                    </td>

                    {role === 'OWNER' && (
                      <td className="px-4 py-4 text-right">
                        {record && (
                          <button
                            onClick={() => {
                              setOverrideModal(record);
                              setOverrideStatus(record.status);
                              setOverrideTime(record.waktuMasuk || '09:00');
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100 transition-colors"
                          >
                            <Edit className="h-3 w-3" />
                            Koreksi
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selfie Picture Enlarge Modal */}
      {previewPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="relative max-w-sm w-full rounded-2xl bg-zinc-900 p-4 text-white overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div>
                <h4 className="font-bold text-sm">{previewPhoto.name}</h4>
                <p className="text-xs text-zinc-400">Absen pada {previewPhoto.time}</p>
              </div>
              <button
                onClick={() => setPreviewPhoto(null)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-3 aspect-square rounded-xl overflow-hidden bg-black flex items-center justify-center">
              <img
                src={previewPhoto.url}
                alt="Selfie"
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Owner Manual Override Modal */}
      {overrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="max-w-md w-full rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200">
            <h3 className="text-base font-bold text-zinc-900 mb-4">
              Koreksi Status Absensi ({overrideModal.employeeName})
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Status Kehadiran</label>
                <select
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 p-2.5 font-medium"
                >
                  <option value="HADIR">HADIR (Tepat Waktu)</option>
                  <option value="TERLAMBAT">TERLAMBAT</option>
                  <option value="IZIN">IZIN</option>
                  <option value="LIBUR">LIBUR</option>
                  <option value="TIDAK HADIR">TIDAK HADIR</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Jam Masuk (WIB)</label>
                <input
                  type="time"
                  value={overrideTime}
                  onChange={(e) => setOverrideTime(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 p-2.5 font-medium"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setOverrideModal(null)}
                  className="rounded-xl border border-zinc-200 px-4 py-2 font-semibold text-zinc-600 hover:bg-zinc-100"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveOverride}
                  disabled={savingOverride}
                  className="rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-500"
                >
                  {savingOverride ? 'Menyimpan...' : 'Simpan Koreksi'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
