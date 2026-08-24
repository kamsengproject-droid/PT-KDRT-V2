import React from 'react';
import { Menu, LogOut, Wifi } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { PtKdrtLogo } from './PtKdrtLogo';

interface NavbarProps {
  onToggleSidebar?: () => void;
  activeMenu: string;
  setActiveMenu: (menu: string) => void;
}

const ROLE_BADGE: Record<UserRole, string> = {
  OWNER: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  MANAGER: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300',
  EMPLOYEE: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  INVESTOR: 'border-violet-400/30 bg-violet-400/10 text-violet-300',
};

const getAvatarInitials = (name?: string) => {
  if (!name) return 'U';
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, setActiveMenu }) => {
  const { userProfile, role, logout } = useAuth();

  return (
    <header
      className="sticky top-0 z-30 flex h-16 w-full shrink-0 items-center justify-between border-b border-white/[0.07] bg-[#070B14]/85 px-3 backdrop-blur-xl sm:px-6"
      data-testid="app-navbar"
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 text-slate-300 transition-colors hover:bg-white/5 hover:text-white lg:hidden"
          aria-label="Buka navigasi"
          data-testid="navbar-toggle-sidebar"
        >
          <Menu className="h-4 w-4" />
        </button>

        <button
          onClick={() => setActiveMenu('portal')}
          className="min-w-0 text-left lg:hidden"
          data-testid="navbar-brand-button"
        >
          <PtKdrtLogo variant="horizontal" size="sm" showSubtitle={false} />
        </button>

        <div className="hidden min-w-0 lg:block">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300/70">
            Kantor PT.KDRT
          </p>
          <p className="truncate text-[13px] font-medium text-slate-400">
            Portal Manajemen Afiliasi &amp; Operasional
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <span className="hidden items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300 md:inline-flex">
          <Wifi className="h-3 w-3" />
          Firestore Online
        </span>

        <button
          onClick={() => setActiveMenu('profil-saya')}
          className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-1 pr-2 text-left transition-colors hover:bg-white/[0.06] sm:pr-2.5"
          title="Profil & Akun"
          data-testid="navbar-profile-button"
        >
          {userProfile?.photoUrl ? (
            <img
              src={userProfile.photoUrl}
              alt={userProfile?.name || 'User'}
              className="h-8 w-8 shrink-0 rounded-lg border border-white/10 object-cover"
            />
          ) : (
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cyan-400/15 text-[11px] font-bold text-cyan-300">
              {getAvatarInitials(userProfile?.name)}
            </span>
          )}
          <span className="hidden min-w-0 flex-col sm:flex">
            <span className="max-w-[130px] truncate text-[13px] font-semibold text-white">
              {userProfile?.name || 'User'}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-slate-500">
              {role === 'EMPLOYEE' ? 'Profil Saya' : role}
            </span>
          </span>
          <span
            className={`hidden rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider md:inline ${ROLE_BADGE[role]}`}
          >
            {role}
          </span>
        </button>

        <button
          onClick={async () => {
            if (window.confirm('Keluar dari sesi KANTOR PT.KDRT?')) await logout();
          }}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-rose-500/25 bg-rose-500/10 px-2.5 text-[12px] font-semibold text-rose-300 transition-colors hover:bg-rose-500/20 sm:px-3"
          aria-label="Logout"
          data-testid="navbar-logout-button"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Keluar</span>
        </button>
      </div>
    </header>
  );
};
