import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { PortalHomePage } from './pages/PortalHomePage';
import { AbsensiEmployeePage } from './pages/AbsensiEmployeePage';
import { RiwayatAbsensiPage } from './pages/RiwayatAbsensiPage';
import { SlipGajiEmployeePage } from './pages/SlipGajiEmployeePage';
import { KaryawanPage } from './pages/KaryawanPage';
import { AbsensiOwnerPage } from './pages/AbsensiOwnerPage';
import { UangRajinPage } from './pages/UangRajinPage';
import { PenggajianPage } from './pages/PenggajianPage';
import { PengaturanKantorPage } from './pages/PengaturanKantorPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { DashboardSharingPage } from './pages/DashboardSharingPage';
import { DashboardPribadiPage } from './pages/DashboardPribadiPage';
import { AkunPage } from './pages/AkunPage';
import { PerformaHarianPage } from './pages/PerformaHarianPage';
import { KeuanganPage } from './pages/KeuanganPage';
import { KeuanganPtKdrtPage } from './pages/KeuanganPtKdrtPage';
import { ArusKasPage } from './pages/ArusKasPage';
import { PengeluaranPage } from './pages/PengeluaranPage';
import { ProfitSharingPage } from './pages/ProfitSharingPage';
import { InvestorDashboardPage } from './pages/InvestorDashboardPage';
import { SampelInventoryPage } from './pages/SampelInventoryPage';
import { DatabaseSampelPage } from './pages/DatabaseSampelPage';
import { PenataanLokasiPage } from './pages/PenataanLokasiPage';
import { ProdukPage } from './pages/ProdukPage';
import { SampelPage } from './pages/SampelPage';
import { InventoryPage } from './pages/InventoryPage';
import { HistoryPenarikanPage } from './pages/HistoryPenarikanPage';
import { JadwalKontenPage } from './pages/JadwalKontenPage';
import { LaporanPage } from './pages/LaporanPage';
import { ExportCenterPage } from './pages/ExportCenterPage';
import { TutupBulanPage } from './pages/TutupBulanPage';
import { KerjaanHarianPage } from './pages/KerjaanHarianPage';
import { ProfilSayaPage } from './pages/ProfilSayaPage';
import { InputManualOwnerPage } from './pages/InputManualOwnerPage';
import { LoginPage } from './pages/LoginPage';
import { Lock, Loader2 } from 'lucide-react';
import { getAssignedAccountKeys } from './utils/accountAccess';

const MainLayout: React.FC = () => {
  const { currentUser, role, userProfile, employeeProfile, loading } = useAuth();
  // Default to the flagship "Portal Aplikasi Kantor" or "investor-dashboard" for Investor
  const [activeMenu, setActiveMenu] = useState<string>(role === 'INVESTOR' ? 'investor-dashboard' : 'portal');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [selectedProductIdForSample, setSelectedProductIdForSample] = useState<string | undefined>(undefined);

  // Auto direct investor to investor dashboard
  React.useEffect(() => {
    if (role === 'INVESTOR' && activeMenu === 'portal') {
      setActiveMenu('investor-dashboard');
    }
  }, [role, activeMenu]);

  if (loading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-[#070B14] text-white" data-testid="app-loading">
        <img src="/assets/logo-pt-kdrt.png" alt="PT KDRT" className="h-20 w-20 rounded-2xl object-contain" />
        <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
        <div className="text-center">
          <p className="font-display text-sm font-semibold text-slate-100">Memuat Sesi PT.KDRT</p>
          <p className="mt-1 text-xs text-slate-500">Sinkronisasi autentikasi &amp; database Firestore</p>
        </div>
      </div>
    );
  }

  // Unauthenticated user -> display Login Page
  if (!currentUser || !userProfile) {
    return <LoginPage />;
  }

  const handleBackToPortal = () => {
    setActiveMenu('portal');
  };

  const handleNavigateToSampel = (productId?: string) => {
    setSelectedProductIdForSample(productId);
    setActiveMenu('sampel');
  };

  const handleNavigateToProduk = () => {
    setActiveMenu('produk');
  };

  // Render current view
  const renderContent = () => {
    // ---------------------------------------------------------
    // RESTRICTION UNTUK ROLE EMPLOYEE
    // ---------------------------------------------------------
    if (role === 'EMPLOYEE') {
      // Access is derived from data (assigned accounts / permission flags), never
      // from hardcoding a person's name.
      const hasAssignedAccounts = getAssignedAccountKeys(employeeProfile).length > 0;
      const canSeeOmset =
        hasAssignedAccounts ||
        Boolean(employeeProfile?.permissions?.canViewOmset) ||
        Boolean(employeeProfile?.permissions?.canInputCommissionReal);

      const allowedForEmployee = [
        'portal',
        'absensi-karyawan',
        'riwayat-absensi',
        'slip-gaji-karyawan',
        'profil-saya',
        'data-saya',
        'kerjaan-harian',
        'database-sampel',
        'penataan-lokasi',
        'lokasi-sampel',
        'produk',
        'sampel',
        'sampel-inventory',
        ...(canSeeOmset ? ['performa-harian', 'input-komisi-real'] : []),
      ];
      if (!allowedForEmployee.includes(activeMenu)) {
        return (
          <div className="flex h-full items-center justify-center p-8">
            <div className="max-w-sm rounded-2xl border border-rose-500/25 bg-rose-500/10 p-8 text-center">
              <Lock className="mx-auto mb-3 h-9 w-9 text-rose-400" />
              <h3 className="font-display text-base font-semibold text-white">Akses Dibatasi</h3>
              <p className="mt-2 text-sm leading-relaxed text-rose-200/80">
                Halaman ini tidak tersedia untuk Karyawan. Anda hanya memiliki akses ke modul yang diizinkan.
              </p>
            </div>
          </div>
        );
      }
    }

    switch (activeMenu) {
      // Flagship Portal
      case 'portal':
        return <PortalHomePage onNavigate={(menuId) => setActiveMenu(menuId)} />;

      // 1. Employee Specific Modules
      case 'absensi-karyawan':
        return <AbsensiEmployeePage />;
      case 'riwayat-absensi':
        return <RiwayatAbsensiPage />;
      case 'slip-gaji-karyawan':
        return <SlipGajiEmployeePage />;
      case 'profil-saya':
        return <ProfilSayaPage onBackToPortal={handleBackToPortal} />;
      case 'data-saya':
        if (role === 'EMPLOYEE') {
          return <ProfilSayaPage onBackToPortal={handleBackToPortal} />;
        }
        return (
          <KaryawanPage
            onBackToPortal={handleBackToPortal}
            initialSelectedEmployeeId={userProfile?.employeeId || userProfile?.uid}
          />
        );

      // 2. Business & Finance Modules
      case 'keuangan-pt-kdrt':
      case 'keuangan-pt':
        if (role !== 'OWNER' && role !== 'MANAGER') {
          return (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-900">
              <Lock className="mx-auto h-10 w-10 text-rose-600 mb-2" />
              <h3 className="font-bold text-base">Akses Dibatasi</h3>
              <p className="text-xs text-rose-700 mt-1">
                Keuangan PT KDRT hanya dapat diakses oleh Akun Owner / Manager PT.KDRT.
              </p>
            </div>
          );
        }
        return <KeuanganPtKdrtPage onBackToPortal={handleBackToPortal} />;
      case 'keuangan':
      case 'arus-kas':
      case 'pengeluaran':
        return <KeuanganPage onBackToPortal={handleBackToPortal} />;
      case 'history-penarikan':
      case 'penarikan':
        return <HistoryPenarikanPage onBackToPortal={handleBackToPortal} />;
      case 'profit-sharing':
        if (role === 'INVESTOR') {
          return <InvestorDashboardPage onBackToPortal={handleBackToPortal} />;
        }
        if (role !== 'OWNER' && role !== 'MANAGER') {
          return (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-900">
              <Lock className="mx-auto h-10 w-10 text-rose-600 mb-2" />
              <h3 className="font-bold text-base">Akses Dibatasi</h3>
              <p className="text-xs text-rose-700 mt-1">
                Kalkulator dan Settlement Profit Sharing hanya dapat diakses oleh Akun Owner / Manager PT.KDRT.
              </p>
            </div>
          );
        }
        return <ProfitSharingPage onBackToPortal={handleBackToPortal} />;
      case 'investor-dashboard':
        return <InvestorDashboardPage onBackToPortal={handleBackToPortal} />;
      case 'akun':
        return <AkunPage />;
      case 'performa-harian':
        return <PerformaHarianPage initialTab="GMV" />;
      // Input Komisi Real is no longer its own module — it is the second tab of Data Omset.
      case 'input-komisi-real':
        return <PerformaHarianPage initialTab="KOMISI" />;
      case 'input-manual':
        if (role !== 'OWNER') {
          return (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-900">
              <Lock className="mx-auto h-10 w-10 text-rose-600 mb-2" />
              <h3 className="font-bold text-base">Akses Dibatasi</h3>
              <p className="text-xs text-rose-700 mt-1">
                Menu Input Manual hanya dapat diakses oleh Akun Owner PT.KDRT.
              </p>
            </div>
          );
        }
        return <InputManualOwnerPage onBackToPortal={handleBackToPortal} />;
      case 'dashboard-sharing':
      case 'keuangan-sharing':
        return role === 'INVESTOR' ? (
          <InvestorDashboardPage onBackToPortal={handleBackToPortal} />
        ) : (
          <DashboardSharingPage />
        );
      case 'dashboard-pribadi':
        if (role !== 'OWNER') {
          return (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-900">
              <Lock className="mx-auto h-10 w-10 text-rose-600 mb-2" />
              <h3 className="font-bold text-base">Akses Dibatasi</h3>
              <p className="text-xs text-rose-700 mt-1">
                Dashboard Pribadi hanya dapat diakses oleh Akun Owner PT.KDRT.
              </p>
            </div>
          );
        }
        return <DashboardPribadiPage />;

      // 3. Operational & HR Modules
      case 'karyawan':
        return <KaryawanPage onBackToPortal={handleBackToPortal} />;
      case 'absensi-owner':
        return <AbsensiOwnerPage />;
      case 'uang-rajin':
        return <UangRajinPage />;
      case 'penggajian':
        if (role !== 'OWNER') {
          return (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-900">
              <Lock className="mx-auto h-10 w-10 text-rose-600 mb-2" />
              <h3 className="font-bold text-base">Akses Dibatasi</h3>
              <p className="text-xs text-rose-700 mt-1">
                Halaman penggajian hanya dapat diakses oleh Owner.
              </p>
            </div>
          );
        }
        return <PenggajianPage />;

      // 4. Products, Sample, Tasks, Schedule & Reports
      case 'database-sampel':
        return <DatabaseSampelPage onBackToPortal={handleBackToPortal} />;
      case 'penataan-lokasi':
      case 'lokasi-sampel':
        return <PenataanLokasiPage onBackToPortal={handleBackToPortal} />;
      case 'produk':
        return <DatabaseSampelPage onBackToPortal={handleBackToPortal} initialTab="PRODUK" />;
      case 'sampel':
      case 'sampel-inventory':
        return <DatabaseSampelPage onBackToPortal={handleBackToPortal} initialTab="SAMPEL" />;
      case 'kerjaan-harian':
        return <KerjaanHarianPage onBackToPortal={handleBackToPortal} />;
      case 'inventory':
      case 'inventory-aset':
        return <InventoryPage onBackToPortal={handleBackToPortal} />;
      case 'jadwal-konten':
        return <JadwalKontenPage onBackToPortal={handleBackToPortal} />;
      case 'laporan':
      case 'laporan-sharing':
        return <LaporanPage userProfile={userProfile!} />;
      case 'export-center':
      case 'export':
        return <ExportCenterPage userProfile={userProfile!} />;
      case 'tutup-bulan':
      case 'closing':
        return <TutupBulanPage userProfile={userProfile!} />;

      // 5. Settings & Audit
      case 'pengaturan':
        return <PengaturanKantorPage onBackToPortal={handleBackToPortal} />;
      case 'audit-log':
        return <AuditLogPage />;

      default:
        return <PortalHomePage onNavigate={(menuId) => setActiveMenu(menuId)} />;
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#070B14] text-slate-300 antialiased">
      {/* Top Header Navbar */}
      <Navbar
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        activeMenu={activeMenu}
        setActiveMenu={setActiveMenu}
      />

      {/* Main Workspace Layout with Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeMenu={activeMenu}
          setActiveMenu={setActiveMenu}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className="mx-auto w-full max-w-[1600px]">{renderContent()}</div>
          </main>

          <footer className="flex h-9 shrink-0 items-center justify-between border-t border-white/[0.07] bg-[#070B14] px-6 font-mono text-[10px] text-slate-500">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                FIRESTORE ONLINE
              </span>
              <span className="hidden sm:inline text-slate-700">|</span>
              <span className="hidden sm:inline">PORTAL APLIKASI PT.KDRT</span>
            </div>
            <div>PT. KDRT MANAGEMENT</div>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}
