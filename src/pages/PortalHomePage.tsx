import React from 'react';
import {
  Users,
  CalendarCheck,
  Award,
  Wallet,
  DollarSign,
  TrendingUp,
  Settings,
  ShieldAlert,
  Smartphone,
  Share2,
  Lock,
  FileSpreadsheet,
  Package,
  Boxes,
  ShoppingBag,
  Calendar,
  FileBarChart,
  ClipboardList,
  Sparkles,
  ChevronRight,
  UserCheck,
  Database,
  Calculator,
  Download,
  Building,
  Home,
  CheckCircle2,
  Clock,
  MapPin,
  Edit3,
  ArrowDownToLine,
  Landmark,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PtKdrtLogo } from '../components/PtKdrtLogo';
import { EmployeePortalDashboard } from '../components/dashboard/EmployeePortalDashboard';

interface PortalHomePageProps {
  onNavigate: (menuId: string) => void;
}

interface FeatureCard {
  id: string;
  title: string;
  category: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'orange' | 'blue' | 'emerald' | 'purple' | 'amber' | 'rose' | 'slate' | 'indigo';
  allowedRoles?: string[];
  ownerOnly?: boolean;
}

export const PortalHomePage: React.FC<PortalHomePageProps> = ({ onNavigate }) => {
  const { role, userProfile, employeeProfile } = useAuth();

  const isOwner = role === 'OWNER';
  const isManager = role === 'MANAGER';
  const isEmployee = role === 'EMPLOYEE';
  const isInvestor = role === 'INVESTOR';

  // Role EMPLOYEE gets a dedicated, modern and friendly portal view
  if (isEmployee) {
    return <EmployeePortalDashboard onNavigate={onNavigate} />;
  }

  // Feature Catalog for Owner, Manager, and Investor
  const featureList: FeatureCard[] = [
    // 1. Bisnis & Keuangan (Owner / Manager)
    {
      id: 'keuangan',
      title: 'Buku Kas & Bank',
      category: 'KEUANGAN',
      desc: 'Buku kas & bank PT KDRT — pencatatan uang masuk, uang keluar, saldo akun, dan rekapitulasi transaksi.',
      icon: Wallet,
      color: 'emerald',
      allowedRoles: ['OWNER', 'MANAGER'],
    },
    {
      id: 'keuangan-pt-kdrt',
      title: 'Keuangan PT KDRT',
      category: 'REKENING PT',
      desc: 'Pencatatan mutasi transaksi keuangan rekening resmi PT KDRT secara manual (Uang Masuk, Uang Keluar, Saldo Rekening).',
      icon: Landmark,
      color: 'amber',
      allowedRoles: ['OWNER', 'MANAGER'],
    },
    {
      id: 'akun',
      title: 'Akun TikTok & Medsos',
      category: 'PLATFORM',
      desc: 'Katalog akun live TikTok, status akun, dan data performa per akun.',
      icon: Smartphone,
      color: 'purple',
      allowedRoles: ['OWNER', 'MANAGER', 'INVESTOR'],
    },
    {
      id: 'performa-harian',
      title: 'Data Omset',
      category: 'PERFORMA',
      desc: 'Data GMV & Komisi Real dalam satu halaman: GMV, estimasi komisi, item sold, impression, dan uang masuk per akun.',
      icon: TrendingUp,
      color: 'blue',
      allowedRoles: ['OWNER', 'MANAGER'],
    },
    {
      id: 'database-sampel',
      title: 'Produk Sampel',
      category: 'DATABASE',
      desc: 'Database master sampel produk, foto, harga, dan ketersediaan di kantor.',
      icon: Package,
      color: 'orange',
      allowedRoles: ['OWNER', 'MANAGER', 'INVESTOR'],
    },
    {
      id: 'penataan-lokasi',
      title: 'Penataan Lokasi',
      category: 'GUDANG',
      desc: 'Penataan tata letak rak, lemari, dan denah penempatan sampel di kantor.',
      icon: MapPin,
      color: 'blue',
      allowedRoles: ['OWNER', 'MANAGER'],
    },
    {
      id: 'history-penarikan',
      title: 'History Penarikan',
      category: 'KEUANGAN',
      desc: 'Riwayat penarikan dana dari akun TikTok/Medsos ke kas/bank PT KDRT & sinkronisasi Buku Kas.',
      icon: ArrowDownToLine,
      color: 'emerald',
      allowedRoles: ['OWNER', 'MANAGER'],
    },
    {
      id: 'kerjaan-harian',
      title: 'Kerjaan Hari Ini',
      category: 'OPERASIONAL',
      desc: 'Target operasional dan checklist tugas harian tim kantor PT.KDRT.',
      icon: ClipboardList,
      color: 'indigo',
      allowedRoles: ['OWNER', 'MANAGER'],
    },

    // 2. Karyawan & HR
    {
      id: 'karyawan',
      title: 'Data Karyawan',
      category: 'HR & GA',
      desc: 'Database data staff, jabatan, status kerja, dan gaji pokok karyawan.',
      icon: Users,
      color: 'blue',
      allowedRoles: ['OWNER', 'MANAGER'],
    },
    {
      id: 'absensi-owner',
      title: 'Absensi',
      category: 'HR & GA',
      desc: 'Rekap log kehadiran harian seluruh karyawan (Senin-Sabtu).',
      icon: CalendarCheck,
      color: 'emerald',
      allowedRoles: ['OWNER', 'MANAGER'],
    },
    {
      id: 'penggajian',
      title: 'Salary Karyawan',
      category: 'PAYROLL',
      desc: 'Input manual gaji pokok, bonus, penyesuaian (+/-), status pembayaran, dan slip gaji karyawan.',
      icon: DollarSign,
      color: 'purple',
      allowedRoles: ['OWNER'],
      ownerOnly: true,
    },
    {
      id: 'uang-rajin',
      title: 'Uang Rajin Mingguan',
      category: 'PAYROLL',
      desc: 'Input manual uang rajin mingguan karyawan, filter periode, rekap per karyawan, dan status bayar.',
      icon: Award,
      color: 'blue',
      allowedRoles: ['OWNER'],
      ownerOnly: true,
    },

    // 3. Sharing & Investor
    {
      id: 'profit-sharing',
      title: 'Profit Sharing & Investor',
      category: 'SHARING',
      desc: 'Kalkulator settlement bagi hasil 45% Investor dan rekapitulasi dana.',
      icon: Share2,
      color: 'amber',
      allowedRoles: ['OWNER', 'MANAGER', 'INVESTOR'],
    },

    // 4. Laporan
    {
      id: 'laporan',
      title: 'Laporan & Rekapitulasi',
      category: 'LAPORAN',
      desc: 'Laporan lengkap keuangan, performa, dan operasional PT.KDRT.',
      icon: FileBarChart,
      color: 'indigo',
      allowedRoles: ['OWNER', 'MANAGER', 'INVESTOR'],
    },

    // 5. Input Manual Owner
    {
      id: 'input-manual',
      title: 'Input Manual Owner',
      category: 'OWNER ONLY',
      desc: 'Bypass input data langsung (Keuangan, Transaksi, Absensi, Master Data).',
      icon: Edit3,
      color: 'rose',
      allowedRoles: ['OWNER'],
      ownerOnly: true,
    },

    // 6. Sistem
    {
      id: 'pengaturan',
      title: 'Pengaturan & Audit',
      category: 'SISTEM',
      desc: 'Konfigurasi jadwal kantor, toleransi jam pulang, dan audit log aktivitas.',
      icon: Settings,
      color: 'slate',
      allowedRoles: ['OWNER'],
      ownerOnly: true,
    },
  ];

  // Filter features by role
  const visibleFeatures = featureList.filter((f) => {
    if (f.ownerOnly && !isOwner) return false;
    if (f.allowedRoles && !f.allowedRoles.includes(role || '')) return false;
    return true;
  });

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'orange':
        return {
          bg: 'bg-orange-500/10 hover:bg-orange-500/20',
          border: 'border-orange-200 hover:border-orange-400',
          iconBg: 'bg-orange-500 text-white',
          text: 'text-orange-950',
          badge: 'bg-orange-100 text-orange-800',
        };
      case 'blue':
        return {
          bg: 'bg-blue-500/10 hover:bg-blue-500/20',
          border: 'border-blue-200 hover:border-blue-400',
          iconBg: 'bg-blue-600 text-white',
          text: 'text-blue-950',
          badge: 'bg-blue-100 text-blue-800',
        };
      case 'emerald':
        return {
          bg: 'bg-emerald-500/10 hover:bg-emerald-500/20',
          border: 'border-emerald-200 hover:border-emerald-400',
          iconBg: 'bg-emerald-600 text-white',
          text: 'text-emerald-950',
          badge: 'bg-emerald-100 text-emerald-800',
        };
      case 'purple':
        return {
          bg: 'bg-purple-500/10 hover:bg-purple-500/20',
          border: 'border-purple-200 hover:border-purple-400',
          iconBg: 'bg-purple-600 text-white',
          text: 'text-purple-950',
          badge: 'bg-purple-100 text-purple-800',
        };
      case 'amber':
        return {
          bg: 'bg-amber-500/10 hover:bg-amber-500/20',
          border: 'border-amber-200 hover:border-amber-400',
          iconBg: 'bg-amber-500 text-white',
          text: 'text-amber-950',
          badge: 'bg-amber-100 text-amber-800',
        };
      case 'rose':
        return {
          bg: 'bg-rose-500/10 hover:bg-rose-500/20',
          border: 'border-rose-200 hover:border-rose-400',
          iconBg: 'bg-rose-600 text-white',
          text: 'text-rose-950',
          badge: 'bg-rose-100 text-rose-800',
        };
      case 'indigo':
        return {
          bg: 'bg-indigo-500/10 hover:bg-indigo-500/20',
          border: 'border-indigo-200 hover:border-indigo-400',
          iconBg: 'bg-indigo-600 text-white',
          text: 'text-indigo-950',
          badge: 'bg-indigo-100 text-indigo-800',
        };
      default:
        return {
          bg: 'bg-slate-500/10 hover:bg-slate-500/20',
          border: 'border-slate-200 hover:border-slate-400',
          iconBg: 'bg-slate-700 text-white',
          text: 'text-slate-950',
          badge: 'bg-slate-100 text-slate-800',
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner Portal Flagship */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900 text-white p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <PtKdrtLogo variant="horizontal" size="sm" showSubtitle={false} className="[&_span]:text-white" />
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-orange-500 text-white uppercase tracking-wider">
                {role} ACCESS
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Portal Aplikasi Kantor PT.KDRT
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Satu pintu terintegrasi untuk seluruh modul operasional bisnis: Keuangan Kas Masuk & Keluar,
              Performa Harian Akun TikTok, Produk Sampel, Presensi Absensi Kerja, Perhitungan Uang Rajin,
              Payroll Gaji, serta Laporan Profit Sharing.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            {isOwner && (
              <button
                onClick={() => onNavigate('input-manual')}
                className="flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-xs font-black text-white shadow-lg hover:bg-rose-500 transition-all cursor-pointer"
              >
                <Edit3 className="h-4 w-4" />
                <span>Input Manual Owner</span>
              </button>
            )}

            <button
              onClick={() => onNavigate(isInvestor ? 'profit-sharing' : 'keuangan')}
              className="flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-xs font-black text-white shadow-lg shadow-orange-500/30 hover:bg-orange-600 transition-all cursor-pointer"
            >
              <span>{isInvestor ? 'Buka Investor Dashboard' : 'Buka Keuangan Kas'}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid Menu Portal */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-orange-500" />
            Daftar Modul & Fitur Aplikasi
          </h2>
          <span className="text-xs font-bold text-slate-400">
            {visibleFeatures.length} Modul Tersedia
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visibleFeatures.map((item) => {
            const Icon = item.icon;
            const style = getColorClasses(item.color);

            return (
              <div
                key={item.id}
                data-testid={`portal-module-${item.id}`}
                onClick={() => onNavigate(item.id)}
                className={`group rounded-2xl border ${style.border} ${style.bg} p-5 shadow-2xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className={`rounded-xl ${style.iconBg} p-2.5 shadow-xs`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${style.badge}`}
                    >
                      {item.category}
                    </span>
                  </div>

                  <h3 className={`text-sm font-black ${style.text} mt-3 group-hover:text-orange-600 transition-colors`}>
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {item.desc}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs font-bold text-slate-600 pt-2 border-t border-slate-200/60 group-hover:text-orange-600">
                  <span>Buka Modul</span>
                  <ChevronRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
