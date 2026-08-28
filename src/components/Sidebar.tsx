import React, { useState } from 'react';
import {
  LayoutGrid,
  Users,
  CalendarCheck,
  Wallet,
  DollarSign,
  TrendingUp,
  Settings,
  Smartphone,
  Share2,
  Package,
  Boxes,
  FileBarChart,
  ClipboardList,
  X,
  LogOut,
  MapPin,
  Edit3,
  ChevronRight,
  KeyRound,
  UserCircle2,
  Award,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ChangePasswordModal } from './ChangePasswordModal';
import { PtKdrtLogo } from './PtKdrtLogo';

interface SidebarProps {
  activeMenu: string;
  setActiveMenu: (menu: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  allowedRoles?: string[];
}

interface MenuSection {
  section: string;
  items: MenuItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeMenu,
  setActiveMenu,
  isOpen,
  onClose,
}) => {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const { role, userProfile, employeeProfile, logout } = useAuth();

  const isOwner = role === 'OWNER';
  const isEmployee = role === 'EMPLOYEE';
  const isInvestor = role === 'INVESTOR';

  // Data Omset access for a karyawan is driven purely by data (assigned accounts
  // or explicit permission flags) — never by hardcoding a person's name.
  const assignedAccounts =
    employeeProfile?.assignedAccountIds || employeeProfile?.permissions?.canViewSpecificAccounts || [];
  const employeeCanSeeOmset =
    assignedAccounts.length > 0 ||
    Boolean(employeeProfile?.permissions?.canViewOmset) ||
    Boolean(employeeProfile?.permissions?.canInputCommissionReal);

  const menuSections: MenuSection[] = [
    // 1. Employee Specific Menu
    ...(isEmployee
      ? [
          {
            section: 'Menu Karyawan',
            items: [
              ...(employeeProfile?.permissions?.canViewAttendance !== false
                ? [{ id: 'absensi-karyawan', label: 'Absensi', icon: CalendarCheck }]
                : []),
              { id: 'kerjaan-harian', label: 'Kerjaan Hari Ini', icon: ClipboardList },
              ...(employeeProfile?.permissions?.canViewSampleProducts !== false
                ? [
                    { id: 'database-sampel', label: 'Produk Sampel', icon: Package },
                    { id: 'penataan-lokasi', label: 'Penataan Lokasi', icon: MapPin },
                  ]
                : []),
              // Data Omset holds BOTH tabs: Data GMV + Komisi Real
              ...(employeeCanSeeOmset
                ? [{ id: 'performa-harian', label: 'Data Omset', icon: TrendingUp }]
                : []),
            ],
          },
        ]
      : []),

    // 2. Investor Menu
    ...(isInvestor
      ? [
          {
            section: 'Menu Investor',
            items: [
              { id: 'investor-dashboard', label: 'Dashboard Sharing', icon: Share2 },
              { id: 'akun', label: 'Akun Sharing', icon: Smartphone },
              { id: 'database-sampel', label: 'Database Produk', icon: Package },
              { id: 'laporan', label: 'Laporan Sharing', icon: FileBarChart },
            ],
          },
        ]
      : []),

    // 3. Owner / Manager
    ...(!isEmployee && !isInvestor
      ? [
          {
            section: 'Bisnis & Keuangan',
            items: [
              { id: 'keuangan', label: 'Buku Kas & Bank', icon: Wallet },
              { id: 'akun', label: 'Akun TikTok & Medsos', icon: Smartphone },
              // Single entry — Data GMV & Komisi Real live as tabs inside this page
              { id: 'performa-harian', label: 'Data Omset', icon: TrendingUp },
              { id: 'database-sampel', label: 'Produk Sampel', icon: Package },
              { id: 'penataan-lokasi', label: 'Penataan Lokasi', icon: MapPin },
              { id: 'inventory', label: 'Inventaris & Aset', icon: Boxes },
            ],
          },
          {
            section: 'Karyawan',
            items: [
              { id: 'karyawan', label: 'Data Karyawan', icon: Users },
              { id: 'absensi-owner', label: 'Absensi', icon: CalendarCheck },
              ...(isOwner
                ? [
                    { id: 'penggajian', label: 'Salary Karyawan', icon: DollarSign },
                    { id: 'uang-rajin', label: 'Uang Rajin Mingguan', icon: Award },
                  ]
                : []),
              { id: 'kerjaan-harian', label: 'Kerjaan Hari Ini', icon: ClipboardList },
            ],
          },
          {
            section: 'Sharing',
            items: [{ id: 'profit-sharing', label: 'Profit Sharing & Investor', icon: Share2 }],
          },
          {
            section: 'Laporan',
            items: [{ id: 'laporan', label: 'Laporan & Rekapitulasi', icon: FileBarChart }],
          },
          ...(isOwner
            ? [
                {
                  section: 'Input Manual',
                  items: [{ id: 'input-manual', label: 'Input Manual Owner', icon: Edit3 }],
                },
                {
                  section: 'Sistem',
                  items: [{ id: 'pengaturan', label: 'Pengaturan & Audit', icon: Settings }],
                },
              ]
            : []),
        ]
      : []),
  ];

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          data-testid="sidebar-backdrop"
        />
      )}

      <aside
        className={`fixed bottom-0 left-0 top-0 z-40 flex w-[268px] transform flex-col border-r border-white/[0.07] bg-[#070B14] transition-transform duration-200 ease-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        data-testid="app-sidebar"
      >
        {/* Brand */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/[0.07] px-4">
          <button
            onClick={() => {
              setActiveMenu('portal');
              onClose();
            }}
            className="min-w-0 text-left"
            data-testid="sidebar-brand-button"
          >
            <PtKdrtLogo variant="horizontal" size="md" showSubtitle />
          </button>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white/5 hover:text-white lg:hidden"
            aria-label="Tutup navigasi"
            data-testid="sidebar-close-button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Portal shortcut */}
        <div className="px-3 pb-1 pt-3">
          <button
            onClick={() => {
              setActiveMenu('portal');
              onClose();
            }}
            className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors ${
              activeMenu === 'portal'
                ? 'bg-cyan-400/12 text-cyan-300 shadow-[0_0_18px_rgba(0,229,255,0.12)]'
                : 'border border-white/[0.07] text-slate-300 hover:bg-white/[0.04] hover:text-white'
            }`}
            data-testid="sidebar-portal-button"
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="truncate">Portal Aplikasi Kantor</span>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {menuSections.map((group) => (
            <div key={group.section} className="space-y-1.5">
              <h4 className="px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                {group.section}
              </h4>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeMenu === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveMenu(item.id);
                        onClose();
                      }}
                      className={`group relative flex w-full items-center gap-2.5 rounded-lg py-2 pl-3 pr-2 text-[13px] font-medium transition-colors ${
                        isActive
                          ? 'bg-cyan-400/10 text-cyan-300'
                          : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
                      }`}
                      data-testid={`sidebar-menu-${item.id}`}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r bg-cyan-400" />
                      )}
                      <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-cyan-300' : 'text-slate-500'}`} />
                      <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                      <ChevronRight
                        className={`h-3.5 w-3.5 shrink-0 transition-opacity ${
                          isActive ? 'opacity-70' : 'opacity-0 group-hover:opacity-40'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User card */}
        <div className="relative shrink-0 border-t border-white/[0.07] bg-[#0A0F1C] p-3">
          {isProfileMenuOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-2 overflow-hidden rounded-xl border border-white/10 bg-[#161D2E] p-1">
              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  setActiveMenu('data-saya');
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-slate-200 transition-colors hover:bg-white/5"
                data-testid="sidebar-profile-menu-profile"
              >
                <UserCircle2 className="h-4 w-4 text-slate-400" /> Profil Saya
              </button>
              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  window.dispatchEvent(new CustomEvent('OPEN_CHANGE_PASSWORD'));
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-slate-200 transition-colors hover:bg-white/5"
                data-testid="sidebar-profile-menu-password"
              >
                <KeyRound className="h-4 w-4 text-slate-400" /> Ubah Password
              </button>
              <button
                onClick={async () => {
                  setIsProfileMenuOpen(false);
                  if (window.confirm('Keluar dari sesi KANTOR PT.KDRT?')) await logout();
                }}
                className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-white/10 px-3 py-2 text-left text-[13px] font-medium text-rose-400 transition-colors hover:bg-rose-500/10"
                data-testid="sidebar-profile-menu-logout"
              >
                <LogOut className="h-4 w-4" /> Logout
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsProfileMenuOpen((prev) => !prev)}
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 text-left transition-colors hover:bg-white/[0.04]"
              data-testid="sidebar-user-button"
            >
              {userProfile?.photoUrl ? (
                <img
                  src={userProfile.photoUrl}
                  alt={userProfile?.name || 'User'}
                  className="h-8 w-8 shrink-0 rounded-lg border border-white/10 object-cover"
                />
              ) : (
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cyan-400/15 text-xs font-bold uppercase text-cyan-300">
                  {userProfile?.name?.charAt(0) || 'U'}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-white">
                  {userProfile?.name || 'User'}
                </span>
                <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-emerald-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  {isEmployee ? employeeProfile?.position || 'Employee' : role}
                </span>
              </span>
            </button>

            <button
              onClick={async () => {
                if (window.confirm('Keluar dari sesi KANTOR PT.KDRT?')) await logout();
              }}
              className="shrink-0 rounded-lg p-2 text-slate-500 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
              title="Keluar (Logout)"
              data-testid="sidebar-logout-button"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
        <ChangePasswordModal />
      </aside>
    </>
  );
};
