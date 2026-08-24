import React from 'react';
import {
  CalendarCheck,
  FileSpreadsheet,
  Package,
  Layers,
  ShoppingBag,
  Sparkles,
  Award,
  ChevronRight,
  TrendingUp,
  MapPin,
  ClipboardList,
  DollarSign
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatRupiah } from '../../utils/formatters';

interface EmployeePortalDashboardProps {
  onNavigate: (menuId: string) => void;
}

export const EmployeePortalDashboard: React.FC<EmployeePortalDashboardProps> = ({
  onNavigate,
}) => {
  const { userProfile, employeeProfile } = useAuth();

  const isDesta =
    (userProfile?.name || '').toLowerCase().includes('desta') ||
    (employeeProfile?.name || '').toLowerCase().includes('desta') ||
    (userProfile?.email || '').toLowerCase().includes('desta');

  const isMelinda =
    (userProfile?.name || '').toLowerCase().includes('melinda') ||
    (employeeProfile?.name || '').toLowerCase().includes('melinda') ||
    (userProfile?.email || '').toLowerCase().includes('melinda');

  return (
    <div className="space-y-6">
      {/* Employee Welcome Card */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-800 tracking-wider">
                PORTAL KARYAWAN AKTIF
              </span>
              <span className="text-xs text-zinc-400 font-medium">KANTOR PT.KDRT</span>
            </div>
            <h2 className="text-2xl font-black text-zinc-900 tracking-tight">
              Halo, {employeeProfile?.name || userProfile?.name || 'Karyawan PT.KDRT'}
            </h2>
            <p className="text-xs text-zinc-500 max-w-xl leading-relaxed">
              Posisi:{' '}
              <strong className="text-zinc-800 font-bold">
                {employeeProfile?.position || 'Staff Operasional'}
              </strong>{' '}
              • Status:{' '}
              <span className="text-emerald-800 font-bold">Aktif Bekerja</span> •
              Gaji Pokok:{' '}
              <strong className="text-zinc-900 font-black">
                {formatRupiah(employeeProfile?.baseSalary || 0)}
              </strong>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onNavigate('absensi-karyawan')}
              className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-xs font-black text-white shadow-md hover:bg-orange-600 transition-all cursor-pointer"
            >
              <CalendarCheck className="h-4 w-4" />
              <span>Buka Absensi Sekarang</span>
            </button>
          </div>
        </div>
      </div>

      {/* Employee Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Absensi & Check-in */}
        <div
          onClick={() => onNavigate('absensi-karyawan')}
          className="group rounded-2xl border border-orange-200 bg-linear-to-br from-orange-50 to-amber-50/50 p-5 shadow-2xs hover:shadow-md hover:border-orange-300 transition-all cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="rounded-xl bg-orange-500 p-2.5 text-white shadow-xs">
                <CalendarCheck className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-black uppercase text-orange-800 bg-orange-100/80 px-2 py-0.5 rounded-md">
                HARIAN
              </span>
            </div>
            <h3 className="text-sm font-black text-zinc-900 mt-3 group-hover:text-orange-600 transition-colors">
              Absensi Kehadiran
            </h3>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              Check-In masuk kerja, Check-Out pulang, dan pantau status harian Anda.
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs font-bold text-orange-600 pt-2 border-t border-orange-200/60">
            <span>Masuk Absen</span>
            <ChevronRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* 2. Kerjaan Hari Ini */}
        <div
          onClick={() => onNavigate('kerjaan-harian')}
          className="group rounded-2xl border border-indigo-200 bg-linear-to-br from-indigo-50 to-blue-50/50 p-5 shadow-2xs hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="rounded-xl bg-indigo-600 p-2.5 text-white shadow-xs">
                <ClipboardList className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-black uppercase text-indigo-800 bg-indigo-100/80 px-2 py-0.5 rounded-md">
                TUGAS
              </span>
            </div>
            <h3 className="text-sm font-black text-zinc-900 mt-3 group-hover:text-indigo-600 transition-colors">
              Kerjaan Hari Ini
            </h3>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              Daftar target tugas operasional harian kantor yang perlu diselesaikan.
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs font-bold text-indigo-600 pt-2 border-t border-indigo-200/60">
            <span>Lihat Target</span>
            <ChevronRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* 3. Produk Sampel */}
        <div
          onClick={() => onNavigate('database-sampel')}
          className="group rounded-2xl border border-blue-200 bg-linear-to-br from-blue-50 to-indigo-50/50 p-5 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="rounded-xl bg-blue-600 p-2.5 text-white shadow-xs">
                <Package className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-black uppercase text-blue-800 bg-blue-100/80 px-2 py-0.5 rounded-md">
                DATABASE
              </span>
            </div>
            <h3 className="text-sm font-black text-zinc-900 mt-3 group-hover:text-blue-600 transition-colors">
              Produk Sampel
            </h3>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              Katalog sampel produk, kategori, foto, dan status ketersediaan di kantor.
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs font-bold text-blue-600 pt-2 border-t border-blue-200/60">
            <span>Buka Database</span>
            <ChevronRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* 4. Penataan Lokasi (Only non-Desta) */}
        {!isDesta && (
          <div
            onClick={() => onNavigate('penataan-lokasi')}
            className="group rounded-2xl border border-emerald-200 bg-linear-to-br from-emerald-50 to-teal-50/50 p-5 shadow-2xs hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="rounded-xl bg-emerald-600 p-2.5 text-white shadow-xs">
                  <MapPin className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-black uppercase text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                  GUDANG
                </span>
              </div>
              <h3 className="text-sm font-black text-zinc-900 mt-3 group-hover:text-emerald-600 transition-colors">
                Penataan Lokasi
              </h3>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                Manajemen tata letak rak, lemari, dan posisi fisik sampel di kantor.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs font-bold text-emerald-600 pt-2 border-t border-emerald-200/60">
              <span>Kelola Rak</span>
              <ChevronRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        )}

        {/* 5. Data Omset (Melinda & Desta) */}
        {(isMelinda || isDesta) && (
          <div
            onClick={() => onNavigate('performa-harian')}
            className="group rounded-2xl border border-purple-200 bg-linear-to-br from-purple-50 to-fuchsia-50/50 p-5 shadow-2xs hover:shadow-md hover:border-purple-300 transition-all cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="rounded-xl bg-purple-600 p-2.5 text-white shadow-xs">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-black uppercase text-purple-800 bg-purple-100/80 px-2 py-0.5 rounded-md">
                  OMSET
                </span>
              </div>
              <h3 className="text-sm font-black text-zinc-900 mt-3 group-hover:text-purple-600 transition-colors">
                Data Omset
              </h3>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                Pantau performa penjualan, input GMV, dan estimasi komisi akun TikTok.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs font-bold text-purple-600 pt-2 border-t border-purple-200/60">
              <span>Buka Data Omset</span>
              <ChevronRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        )}

      </div>

      {/* Syarat & Ketentuan Kehadiran Karyawan */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs space-y-3">
        <h4 className="text-xs font-black uppercase tracking-wider text-zinc-500 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-orange-500" />
          Ketentuan Jam Kerja & Uang Rajin PT.KDRT
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
            <span className="font-bold text-zinc-800 block">Jadwal Kerja Normal:</span>
            <p className="text-zinc-500 mt-0.5">
              Senin – Jumat: <strong>09:00 – 17:00 WIB</strong> (Boleh Checkout mulai 16:50 WIB).
            </p>
          </div>
          <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
            <span className="font-bold text-zinc-800 block">Jadwal Hari Sabtu:</span>
            <p className="text-zinc-500 mt-0.5">
              Sabtu: <strong>09:00 – 12:30 WIB</strong> (Boleh Checkout mulai 12:20 WIB).
            </p>
          </div>
          <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
            <span className="font-bold text-emerald-900 block">Bonus Uang Rajin:</span>
            <p className="text-emerald-700 mt-0.5">
              Uang Rajin dihitung mingguan (Senin–Sabtu). Hadir penuh tanpa terlambat mendapat bonus penuh.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
