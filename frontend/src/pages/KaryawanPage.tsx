import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Edit2,
  CheckCircle2,
  XCircle,
  Briefcase,
  Mail,
  Calendar,
  Search,
  ArrowLeft,
  ArrowRight,
  User,
  DollarSign,
  Clock,
  Shield,
  FileText,
  AlertCircle,
  ChevronRight,
  Home,
  Phone,
  Power,
  Sparkles,
  Lock,
  Filter,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  subscribeEmployees,
  tambahKaryawan,
  updateKaryawan,
  toggleStatusKaryawan,
} from '../services/employeeService';
import { subscribeEmployeeAttendance } from '../services/attendanceService';
import { Account, Employee, ScopeType, UserRole, AttendanceRecord } from '../types';
import { subscribeAccounts } from '../services/accountService';
import { getAssignedAccountKeys } from '../utils/accountAccess';
import { formatRupiah, formatTanggal, tanggalHariIni } from '../utils/formatters';
import { Camera, Eye, MapPin, Smartphone } from 'lucide-react';

interface KaryawanPageProps {
  onBackToPortal?: () => void;
  initialSelectedEmployeeId?: string;
}

export const KaryawanPage: React.FC<KaryawanPageProps> = ({
  onBackToPortal,
  initialSelectedEmployeeId,
}) => {
  const { userProfile, role, loading, currentUser } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [selectedPosition, setSelectedPosition] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected employee for "FILE KARYAWAN"
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [activeFileTab, setActiveFileTab] = useState<'PROFIL' | 'ABSENSI' | 'PENGHASILAN' | 'KINERJA'>('PROFIL');
  const [employeeAttendances, setEmployeeAttendances] = useState<AttendanceRecord[]>([]);
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string; subtitle?: string } | null>(null);

  // Modal / Form state
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    nickname: string;
    position: string;
    appRole: UserRole;
    scope: ScopeType;
    baseSalary: number | '';
    startDate: string;
    active: boolean;
    email: string;
    phone: string;
    userId: string;
    notes: string;
    assignedAccountIds: string[];
  }>({
    name: '',
    nickname: '',
    position: 'Talent',
    appRole: 'EMPLOYEE',
    scope: 'SHARING',
    baseSalary: 2500000,
    startDate: tanggalHariIni(),
    active: true,
    email: '',
    phone: '',
    userId: '',
    notes: '',
    assignedAccountIds: [],
  });

  const [accounts, setAccounts] = useState<Account[]>([]);

  const [saving, setSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Daftar akun medsos untuk penetapan tanggung jawab karyawan
  useEffect(() => {
    if (loading || !currentUser) return;
    const unsub = subscribeAccounts(undefined, setAccounts);
    return () => unsub();
  }, [loading, currentUser]);

  // Subscribe to all employees from Firestore
  useEffect(() => {
    if (loading || !currentUser || !userProfile?.active) {
      return;
    }
    const unsub = subscribeEmployees(undefined, (list) => {
      setEmployees(list);
      if (initialSelectedEmployeeId) {
        const found = list.find(
          (e) => e.id === initialSelectedEmployeeId || e.userId === initialSelectedEmployeeId
        );
        if (found) setSelectedEmployee(found);
      }
    });
    return unsub;
  }, [loading, currentUser?.uid, userProfile?.role, userProfile?.active, initialSelectedEmployeeId]);

  // Keep selectedEmployee updated if employees list changes
  useEffect(() => {
    if (selectedEmployee?.id) {
      const updated = employees.find((e) => e.id === selectedEmployee.id);
      if (updated) setSelectedEmployee(updated);
    }
  }, [employees]);

  // Subscribe to selected employee attendance records from Firestore
  useEffect(() => {
    if (loading || !currentUser || !userProfile?.active || !selectedEmployee) {
      setEmployeeAttendances([]);
      return;
    }
    const empTargetId = selectedEmployee.userId || selectedEmployee.id;
    const unsub = subscribeEmployeeAttendance(empTargetId, (list) => {
      // Also match by employeeId or id
      setEmployeeAttendances(list);
    });
    return unsub;
  }, [loading, currentUser?.uid, userProfile?.role, userProfile?.active, selectedEmployee]);

  // Handle Employee & Investor Permission Block
  if (role === 'EMPLOYEE' || role === 'INVESTOR') {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-900 max-w-2xl mx-auto my-12 shadow-sm">
        <Lock className="mx-auto h-12 w-12 text-rose-600 mb-3" />
        <h2 className="font-extrabold text-lg">Akses Data Karyawan Dibatasi</h2>
        <p className="text-xs text-rose-700 mt-2 leading-relaxed">
          {role === 'EMPLOYEE'
            ? 'Karyawan hanya memiliki akses ke Profil Saya dan Slip Gaji pribadi. Daftar seluruh data karyawan hanya dapat diakses oleh Owner dan Manajemen Kantor.'
            : 'Akun Investor hanya memiliki akses ke Laporan Performa & Bagi Hasil Sharing PT.KDRT. Modul internal data karyawan hanya dapat diakses oleh Owner dan Manajemen Kantor.'}
        </p>
        {onBackToPortal && (
          <button
            onClick={onBackToPortal}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-colors shadow-2xs cursor-pointer"
          >
            <Home className="h-4 w-4" />
            <span>Kembali ke Portal</span>
          </button>
        )}
      </div>
    );
  }

  const handleOpenAdd = () => {
    setEditingEmployee(null);
    setFormData({
      name: '',
      nickname: '',
      position: 'Talent',
      appRole: 'EMPLOYEE',
      scope: 'SHARING',
      baseSalary: 2500000,
      startDate: tanggalHariIni(),
      active: true,
      email: '',
      phone: '',
      userId: '',
      notes: '',
      assignedAccountIds: [],
    });
    setSaveError(null);
    setSaveSuccess(null);
    setShowModal(true);
  };

  const handleOpenEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData({
      name: emp.name,
      nickname: emp.nickname || '',
      position: emp.position,
      appRole: emp.appRole || 'EMPLOYEE',
      scope: emp.scope || 'SHARING',
      baseSalary: emp.baseSalary,
      startDate: emp.startDate,
      active: emp.active,
      email: emp.email || '',
      phone: emp.phone || '',
      userId: emp.userId || '',
      notes: emp.notes || '',
      assignedAccountIds: getAssignedAccountKeys(emp),
    });
    setSaveError(null);
    setSaveSuccess(null);
    setShowModal(true);
  };

  const handleQuickPreset = (preset: 'MELINDA' | 'DESTA') => {
    if (preset === 'MELINDA') {
      setFormData({
        name: 'Melinda',
        nickname: 'Meli',
        position: 'Talent',
        appRole: 'EMPLOYEE',
        scope: 'SHARING',
        baseSalary: 2500000,
        startDate: '2026-01-01',
        active: true,
        email: 'melinda@kdrt.id',
        phone: '081234567890',
        userId: 'uid-employee-melinda',
        notes: 'Talent live streaming & video TikTok Sharing',
        assignedAccountIds: [],
      });
    } else {
      setFormData({
        name: 'Desta',
        nickname: 'Desta',
        position: 'Editor',
        appRole: 'EMPLOYEE',
        scope: 'SHARING',
        baseSalary: 2400000,
        startDate: '2026-01-01',
        active: true,
        email: 'desta@kdrt.id',
        phone: '081298765432',
        userId: 'uid-employee-desta',
        notes: 'Editor video konten & live streaming TikTok Sharing',
        assignedAccountIds: [],
      });
    }
  };

  const handleToggleStatus = async (emp: Employee) => {
    const nextStatus = !emp.active;
    const actionText = nextStatus ? 'mengaktifkan' : 'menonaktifkan';
    if (window.confirm(`Apakah Anda yakin ingin ${actionText} status karyawan "${emp.name}"?`)) {
      try {
        await toggleStatusKaryawan(
          emp.id!,
          nextStatus,
          emp.name,
          userProfile?.uid || 'owner',
          userProfile?.name || 'Owner'
        );
        setSaveSuccess(`Status karyawan ${emp.name} berhasil diubah menjadi ${nextStatus ? 'Aktif' : 'Nonaktif'}.`);
      } catch (err: any) {
        setSaveError(err.message || 'Gagal mengubah status karyawan.');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      if (!formData.name.trim()) {
        throw new Error('Nama lengkap karyawan wajib diisi.');
      }
      
      if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        throw new Error('Format email tidak valid.');
      }

      if (formData.active && (formData.appRole === 'EMPLOYEE' || formData.appRole === 'MANAGER')) {
        if (!formData.userId || !formData.userId.trim()) {
          throw new Error('Firebase UID wajib diisi untuk karyawan yang dapat login.');
        }
      }

      if (editingEmployee?.id) {
        await updateKaryawan(
          editingEmployee.id,
          formData,
          userProfile?.uid || 'owner',
          userProfile?.name || 'Owner'
        );
        setSaveSuccess(`Data karyawan ${formData.name} berhasil diperbarui di Firestore.`);
        if (selectedEmployee?.id === editingEmployee.id) {
          setSelectedEmployee({ ...selectedEmployee, ...formData });
        }
      } else {
        await tambahKaryawan(
          formData,
          userProfile?.uid || 'owner',
          userProfile?.name || 'Owner'
        );
        setSaveSuccess(`Karyawan baru "${formData.name}" berhasil disimpan ke Firestore.`);
      }
      setShowModal(false);
    } catch (err: any) {
      console.error('[EMPLOYEE_SAVE_ERROR]', err?.code || 'NO_CODE', err?.message || err);
      setSaveError(err.message || 'Gagal menyimpan data karyawan.');
    } finally {
      setSaving(false);
    }
  };

  // Distinct list of all positions for filter dropdown
  const uniquePositions = Array.from(new Set(employees.map((e) => e.position).filter(Boolean)));

  // Filtered employees
  const filteredEmployees = employees.filter((emp) => {
    // If current user is EMPLOYEE, restrict view to themselves
    if (role === 'EMPLOYEE') {
      const isSelf =
        emp.userId === userProfile?.uid ||
        emp.email === userProfile?.email ||
        emp.name.toLowerCase() === userProfile?.name.toLowerCase();
      if (!isSelf) return false;
    }

    // Status filter
    if (selectedStatus === 'ACTIVE' && !emp.active) return false;
    if (selectedStatus === 'INACTIVE' && emp.active) return false;

    // Position filter
    if (selectedPosition !== 'ALL' && emp.position !== selectedPosition) return false;

    // Search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchName = emp.name.toLowerCase().includes(query);
      const matchNickname = emp.nickname ? emp.nickname.toLowerCase().includes(query) : false;
      const matchPosition = emp.position.toLowerCase().includes(query);
      const matchEmail = emp.email ? emp.email.toLowerCase().includes(query) : false;
      const matchPhone = emp.phone ? emp.phone.toLowerCase().includes(query) : false;
      if (!matchName && !matchNickname && !matchPosition && !matchEmail && !matchPhone) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <nav className="flex items-center space-x-1.5 text-xs text-slate-500 font-medium">
          <button
            onClick={onBackToPortal}
            className="flex items-center gap-1 hover:text-orange-600 font-bold transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
            <span>KANTOR PT.KDRT</span>
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          <button
            onClick={() => setSelectedEmployee(null)}
            className={`transition-colors ${
              !selectedEmployee
                ? 'font-bold text-slate-900'
                : 'hover:text-orange-600 text-slate-500'
            }`}
          >
            DATA KARYAWAN
          </button>
          {selectedEmployee && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-bold text-orange-600 uppercase">
                {selectedEmployee.name}
              </span>
            </>
          )}
        </nav>

        {selectedEmployee ? (
          <button
            onClick={() => setSelectedEmployee(null)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Kembali ke Daftar Karyawan</span>
          </button>
        ) : (
          onBackToPortal && (
            <button
              onClick={onBackToPortal}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            >
              <Home className="h-3.5 w-3.5" />
              <span>Kembali ke Portal</span>
            </button>
          )
        )}
      </div>

      {/* Save Success / Error Toast */}
      {saveSuccess && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900 font-semibold flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{saveSuccess}</span>
          </div>
          <button
            onClick={() => setSaveSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {saveError && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-900 font-semibold flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{saveError}</span>
          </div>
          <button
            onClick={() => setSaveError(null)}
            className="text-rose-700 hover:text-rose-900 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. VIEW: DAFTAR KARYAWAN                                                  */}
      {/* ========================================================================= */}
      {!selectedEmployee ? (
        <div className="space-y-6">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
                <Users className="h-6 w-6 text-orange-600" />
                DATA KARYAWAN
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Kelola file karyawan, jabatan, role aplikasi, status kepegawaian, dan gaji pokok PT.KDRT.
              </p>
            </div>

            {(role === 'OWNER' || role === 'MANAGER') && (
              <button
                onClick={handleOpenAdd}
                data-testid="employee-add-button"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-orange-500 transition-colors"
              >
                <UserPlus className="h-4 w-4" />
                + Tambah Karyawan
              </button>
            )}
          </div>

          {/* Filter, Jabatan & Search Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs">
            {/* Status & Position Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Status Filter */}
              <div className="inline-flex rounded-xl bg-slate-100 p-1">
                <button
                  onClick={() => setSelectedStatus('ALL')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                    selectedStatus === 'ALL'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Semua Status
                </button>
                <button
                  onClick={() => setSelectedStatus('ACTIVE')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                    selectedStatus === 'ACTIVE'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Aktif
                </button>
                <button
                  onClick={() => setSelectedStatus('INACTIVE')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                    selectedStatus === 'INACTIVE'
                      ? 'bg-slate-700 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Nonaktif
                </button>
              </div>

              {/* Jabatan Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                <select
                  value={selectedPosition}
                  onChange={(e) => setSelectedPosition(e.target.value)}
                  className="bg-transparent font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">Semua Jabatan</option>
                  {uniquePositions.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                  <option value="Talent">Talent</option>
                  <option value="Editor">Editor</option>
                  <option value="Manager">Manager</option>
                  <option value="Owner">Owner</option>
                  <option value="Host Live">Host Live</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama, panggilan, jabatan, email, telepon..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:bg-white focus:outline-orange-500"
              />
            </div>
          </div>

          {/* Employee Count Indicator */}
          <div className="flex items-center justify-between text-xs text-slate-500 px-1 font-semibold">
            <span>
              Menampilkan <strong>{filteredEmployees.length}</strong> karyawan terdaftar
            </span>
            <span className="font-mono text-[11px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
              ● Firestore Persistence
            </span>
          </div>

          {/* Employee Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEmployees.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500 bg-white">
                <Users className="mx-auto h-12 w-12 text-slate-400 mb-3 opacity-40" />
                <p className="font-bold text-sm text-slate-800">
                  {employees.length === 0
                    ? 'Belum ada data karyawan terdaftar di Firestore'
                    : 'Tidak ada karyawan yang sesuai filter atau pencarian'}
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  {employees.length === 0
                    ? 'Klik tombol "+ Tambah Karyawan" di atas untuk menambahkan data staf baru secara manual (misal: Melinda atau Desta).'
                    : 'Coba sesuaikan kata kunci pencarian atau ubah filter status/jabatan.'}
                </p>
                {employees.length === 0 && (role === 'OWNER' || role === 'MANAGER') && (
                  <button
                    onClick={handleOpenAdd}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white hover:bg-orange-500 transition-colors shadow-2xs"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>+ Tambah Karyawan Sekarang</span>
                  </button>
                )}
              </div>
            ) : (
              filteredEmployees.map((emp) => (
                <div
                  key={emp.id}
                  className={`rounded-2xl border bg-white p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between ${
                    emp.active
                      ? 'border-slate-200 hover:border-orange-300'
                      : 'border-slate-200 bg-slate-50/70 opacity-80'
                  }`}
                >
                  <div>
                    {/* AVATAR & BASIC INFO */}
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-black text-lg border shadow-2xs ${
                          emp.active
                            ? 'bg-orange-100 text-orange-700 border-orange-200'
                            : 'bg-slate-200 text-slate-600 border-slate-300'
                        }`}
                      >
                        {emp.name.charAt(0).toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h3 className="font-extrabold text-slate-900 text-base truncate">
                            {emp.name}
                            {emp.nickname && (
                              <span className="text-xs font-medium text-slate-500 ml-1">
                                ({emp.nickname})
                              </span>
                            )}
                          </h3>
                        </div>

                        {/* Jabatan & App Role */}
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700">
                            <Briefcase className="h-3 w-3 text-slate-400 shrink-0" />
                            {emp.position}
                          </span>
                          <span className="text-slate-300 text-xs">•</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                            Role: {emp.appRole || 'EMPLOYEE'}
                          </span>
                        </div>

                        {/* Status badge */}
                        <div className="mt-2 flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              emp.active
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                emp.active ? 'bg-emerald-500' : 'bg-slate-400'
                              }`}
                            />
                            {emp.active ? 'Aktif' : 'Nonaktif'}
                          </span>

                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              emp.scope === 'PRIBADI'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {emp.scope || 'SHARING'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* GAJI POKOK & CONTACT */}
                    <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/80 p-3 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          Gaji Pokok
                        </span>
                        <span className="text-sm font-black text-slate-900">
                          {formatRupiah(emp.baseSalary)}
                        </span>
                      </div>

                      {emp.email && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 truncate pt-1 border-t border-slate-100">
                          <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                          <span className="truncate">{emp.email}</span>
                        </div>
                      )}

                      {emp.phone && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 truncate">
                          <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                          <span>{emp.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ACTION BUTTONS */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    {role === 'OWNER' && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(emp)}
                          className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100 transition-colors"
                          title="Edit Data Karyawan"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(emp)}
                          className={`rounded-lg border p-2 transition-colors ${
                            emp.active
                              ? 'border-slate-200 bg-white text-slate-500 hover:bg-rose-50 hover:text-rose-600'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                          title={emp.active ? 'Nonaktifkan Karyawan' : 'Aktifkan Karyawan'}
                        >
                          <Power className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        setSelectedEmployee(emp);
                        setActiveFileTab('PROFIL');
                      }}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-orange-50 border border-orange-200 py-2 px-3 text-xs font-bold text-orange-700 hover:bg-orange-100 transition-colors shadow-2xs"
                    >
                      <span>Buka File</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* 2. VIEW: FILE KARYAWAN DETAIL (4 TABS)                                    */
        /* ========================================================================= */
        <div className="space-y-6">
          {/* Header File Karyawan */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500 font-black text-white text-2xl shadow-md border-2 border-white">
                  {selectedEmployee.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase">
                      {selectedEmployee.name}
                    </h2>
                    {selectedEmployee.nickname && (
                      <span className="text-sm font-semibold text-slate-500">
                        ({selectedEmployee.nickname})
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        selectedEmployee.active
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {selectedEmployee.active ? 'Status: Aktif' : 'Status: Nonaktif'}
                    </span>
                  </div>

                  <div className="text-xs sm:text-sm font-semibold text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                      {selectedEmployee.position}
                    </span>
                    <span>•</span>
                    <span className="font-bold text-slate-700">
                      Role Aplikasi: {selectedEmployee.appRole || 'EMPLOYEE'}
                    </span>
                    <span>•</span>
                    <span className="font-bold text-orange-600">
                      Scope {selectedEmployee.scope || 'SHARING'}
                    </span>
                  </div>
                </div>
              </div>

              {(role === 'OWNER' || role === 'EMPLOYEE') && (
                <div className="flex items-center gap-2">
                  
                  {role === 'OWNER' && (
                    <button
                      onClick={() => handleToggleStatus(selectedEmployee)}

                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors shadow-2xs ${
                      selectedEmployee.active
                        ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    <Power className="h-3.5 w-3.5" />
                                          <span>{selectedEmployee.active ? 'Nonaktifkan' : 'Aktifkan'}</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleOpenEdit(selectedEmployee)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
                  >
                    <Edit2 className="h-3.5 w-3.5 text-slate-500" />
                    <span>Edit File</span>
                  </button>
                </div>
              )}
            </div>

            {/* TAB NAVIGATION: [ PROFIL ] [ ABSENSI ] [ PENGHASILAN ] [ KINERJA ] */}
            <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              {(
                [
                  { id: 'PROFIL', label: 'PROFIL', icon: User },
                  { id: 'ABSENSI', label: 'ABSENSI', icon: Clock },
                  { id: 'PENGHASILAN', label: 'PENGHASILAN', icon: DollarSign },
                  { id: 'KINERJA', label: 'KINERJA', icon: FileText },
                ] as const
              ).map((tab) => {
                const IconComp = tab.icon;
                const isActive = activeFileTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveFileTab(tab.id)}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <IconComp className="h-3.5 w-3.5" />
                    <span>[ {tab.label} ]</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* TAB 1: PROFIL (BERFUNGSI PENUH) */}
          {activeFileTab === 'PROFIL' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    RINCIAN FILE KARYAWAN
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Data profil kepegawaian resmi yang tersimpan di Firestore database PT.KDRT.
                  </p>
                </div>
                {(role === 'OWNER' || role === 'EMPLOYEE') && (
                  <button
                    onClick={() => handleOpenEdit(selectedEmployee)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 hover:underline"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    Edit Profil
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-1">
                  <div className="text-slate-400 font-semibold">Nama Lengkap</div>
                  <div className="text-sm font-bold text-slate-900">{selectedEmployee.name}</div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-1">
                  <div className="text-slate-400 font-semibold">Nama Panggilan</div>
                  <div className="text-sm font-bold text-slate-900">
                    {selectedEmployee.nickname || '-'}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-1">
                  <div className="text-slate-400 font-semibold">Jabatan / Posisi</div>
                  <div className="text-sm font-bold text-slate-900">{selectedEmployee.position}</div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-1">
                  <div className="text-slate-400 font-semibold">Role Aplikasi</div>
                  <div className="text-sm font-bold text-slate-900">
                    {selectedEmployee.appRole || 'EMPLOYEE'}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-1">
                  <div className="text-slate-400 font-semibold">Status Kepegawaian</div>
                  <div className="text-sm font-bold text-emerald-700 flex items-center gap-1.5">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        selectedEmployee.active ? 'bg-emerald-500' : 'bg-slate-400'
                      }`}
                    />
                    {selectedEmployee.active ? 'Aktif Bekerja' : 'Nonaktif'}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-1">
                  <div className="text-slate-400 font-semibold">Tanggal Mulai Kerja</div>
                  <div className="text-sm font-bold text-slate-900">
                    {formatTanggal(selectedEmployee.startDate)}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-1">
                  <div className="text-slate-400 font-semibold">Gaji Pokok Bulanan</div>
                  <div className="text-base font-black text-slate-900">
                    {formatRupiah(selectedEmployee.baseSalary)}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-1">
                  <div className="text-slate-400 font-semibold">Email Karyawan</div>
                  <div className="text-sm font-bold text-slate-900 truncate">
                    {selectedEmployee.email || '-'}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-1">
                  <div className="text-slate-400 font-semibold">Nomor Telepon / WA</div>
                  <div className="text-sm font-bold text-slate-900">
                    {selectedEmployee.phone || '-'}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-1">
                  <div className="text-slate-400 font-semibold">Firebase UID</div>
                  <div className="text-xs font-mono text-slate-700 truncate">
                    {selectedEmployee.userId || selectedEmployee.id || '-'}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-1">
                  <div className="text-slate-400 font-semibold">Scope Bisnis</div>
                  <div className="text-sm font-bold text-orange-600">
                    {selectedEmployee.scope || 'SHARING'}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-1">
                  <div className="text-slate-400 font-semibold">ID Dokumen Firestore</div>
                  <div className="text-xs font-mono text-slate-500 truncate">
                    {selectedEmployee.id}
                  </div>
                </div>
              </div>

              {selectedEmployee.notes && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
                  <div className="text-slate-500 font-bold mb-1">Catatan Tambahan:</div>
                  <p className="text-slate-700 italic">{selectedEmployee.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ABSENSI (PHASE 2B RESMI) */}
          {activeFileTab === 'ABSENSI' && (() => {
            const totalHadir = employeeAttendances.filter((a) => a.status === 'HADIR' || !!a.waktuMasuk || !!a.checkInTime).length;
            const totalTerlambat = employeeAttendances.filter((a) => a.status === 'TERLAMBAT' || (a.menitTerlambat || a.lateMinutes || 0) > 0).length;
            const totalMenitTerlambat = employeeAttendances.reduce((sum, a) => sum + (a.menitTerlambat || a.lateMinutes || 0), 0);
            const totalEarlyCheckout = employeeAttendances.filter((a) => a.isEarlyCheckout || a.checkoutStatus === 'EARLY_CHECKOUT' || (a.earlyCheckoutMinutes || 0) > 0).length;

            return (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      REKAP &amp; RIWAYAT ABSENSI REALTIME
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Data absensi tercatat langsung dari Firestore dengan verifikasi GPS, Geofence kantor, dan Selfie Realtime.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Realtime Firestore</span>
                  </div>
                </div>

                {/* 4 Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                    <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Total Hadir</div>
                    <div className="text-2xl font-black text-emerald-900 mt-1">{totalHadir} Hari</div>
                    <div className="text-[10px] text-emerald-600 mt-1">Presensi Masuk Tercatat</div>
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                    <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Total Terlambat</div>
                    <div className="text-2xl font-black text-amber-900 mt-1">{totalTerlambat} Kali</div>
                    <div className="text-[10px] text-amber-600 mt-1">Check-in lewat 09:00 WIB</div>
                  </div>

                  <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
                    <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Total Menit Telat</div>
                    <div className="text-2xl font-black text-rose-900 mt-1">{totalMenitTerlambat} Menit</div>
                    <div className="text-[10px] text-rose-600 mt-1">Akumulasi Keterlambatan</div>
                  </div>

                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
                    <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Early Checkout</div>
                    <div className="text-2xl font-black text-indigo-900 mt-1">{totalEarlyCheckout} Kali</div>
                    <div className="text-[10px] text-indigo-600 mt-1">Pulang sebelum toleransi</div>
                  </div>
                </div>

                {/* Table Riwayat Absensi */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Log Detail Absensi</h4>
                  {employeeAttendances.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-400 text-xs">
                      Belum ada riwayat absensi untuk karyawan ini.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs text-slate-700">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                          <tr>
                            <th className="px-3.5 py-3">Tanggal</th>
                            <th className="px-3.5 py-3">Check-In</th>
                            <th className="px-3.5 py-3">Check-Out</th>
                            <th className="px-3.5 py-3">Status</th>
                            <th className="px-3.5 py-3">Terlambat</th>
                            <th className="px-3.5 py-3">Pulang Cepat</th>
                            <th className="px-3.5 py-3">Jarak</th>
                            <th className="px-3.5 py-3">GPS Accuracy</th>
                            <th className="px-3.5 py-3 text-center">Foto Selfie</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {employeeAttendances.map((rec) => {
                            const isLate = rec.status === 'TERLAMBAT' || (rec.menitTerlambat || rec.lateMinutes || 0) > 0;
                            const isEarly = rec.isEarlyCheckout || rec.checkoutStatus === 'EARLY_CHECKOUT';
                            const checkInPhoto = rec.fotoMasuk || rec.checkInPhotoUrl;
                            const checkOutPhoto = rec.fotoPulang || rec.checkOutPhotoUrl;

                            return (
                              <tr key={rec.id || `${rec.employeeId}_${rec.tanggal}`} className="hover:bg-slate-50/80">
                                <td className="px-3.5 py-3 font-semibold text-slate-900 whitespace-nowrap">
                                  {formatTanggal(rec.tanggal || rec.date || '')}
                                </td>
                                <td className="px-3.5 py-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                                  {rec.waktuMasuk || rec.checkInTime ? `${rec.waktuMasuk || rec.checkInTime} WIB` : '-'}
                                </td>
                                <td className="px-3.5 py-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                                  {rec.waktuPulang || rec.checkOutTime ? `${rec.waktuPulang || rec.checkOutTime} WIB` : '-'}
                                </td>
                                <td className="px-3.5 py-3 whitespace-nowrap">
                                  {rec.status === 'HADIR' ? (
                                    <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                      HADIR
                                    </span>
                                  ) : isLate ? (
                                    <span className="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                                      TERLAMBAT
                                    </span>
                                  ) : rec.status === 'LIBUR' ? (
                                    <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                                      LIBUR
                                    </span>
                                  ) : (
                                    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                                      {rec.status}
                                    </span>
                                  )}
                                </td>
                                <td className="px-3.5 py-3 whitespace-nowrap">
                                  {isLate ? (
                                    <span className="font-bold text-rose-600">
                                      +{rec.menitTerlambat || rec.lateMinutes || 0}m
                                    </span>
                                  ) : (
                                    <span className="text-emerald-700 font-medium">Tepat Waktu (0m)</span>
                                  )}
                                </td>
                                <td className="px-3.5 py-3 whitespace-nowrap">
                                  {isEarly ? (
                                    <span className="font-bold text-amber-700">
                                      Ya (-{rec.earlyCheckoutMinutes || 0}m)
                                    </span>
                                  ) : rec.waktuPulang || rec.checkOutTime ? (
                                    <span className="text-emerald-700 font-medium">Normal</span>
                                  ) : (
                                    <span className="text-slate-400">-</span>
                                  )}
                                </td>
                                <td className="px-3.5 py-3 text-slate-600 whitespace-nowrap">
                                  {rec.distanceFromOffice !== undefined || rec.checkInDistance !== undefined
                                    ? `${rec.distanceFromOffice ?? rec.checkInDistance} m`
                                    : '-'}
                                </td>
                                <td className="px-3.5 py-3 text-slate-600 whitespace-nowrap">
                                  {rec.accuracy || rec.checkInGpsAccuracy ? `±${Math.round(rec.accuracy || rec.checkInGpsAccuracy || 0)} m` : '-'}
                                </td>
                                <td className="px-3.5 py-3 text-center whitespace-nowrap">
                                  <div className="flex items-center justify-center gap-1.5">
                                    {checkInPhoto ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setPreviewPhoto({
                                            url: checkInPhoto,
                                            title: `Selfie Check-In — ${selectedEmployee.name}`,
                                            subtitle: `${formatTanggal(rec.tanggal || rec.date || '')} • ${rec.waktuMasuk || rec.checkInTime || ''} WIB`,
                                          })
                                        }
                                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                                        title="Lihat Selfie Masuk"
                                      >
                                        <Camera className="h-3 w-3 text-emerald-600" />
                                        <span>Masuk</span>
                                      </button>
                                    ) : (
                                      <span className="text-slate-300 text-[11px]">-</span>
                                    )}

                                    {checkOutPhoto && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setPreviewPhoto({
                                            url: checkOutPhoto,
                                            title: `Selfie Check-Out — ${selectedEmployee.name}`,
                                            subtitle: `${formatTanggal(rec.tanggal || rec.date || '')} • ${rec.waktuPulang || rec.checkOutTime || ''} WIB`,
                                          })
                                        }
                                        className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                                        title="Lihat Selfie Pulang"
                                      >
                                        <Camera className="h-3 w-3 text-indigo-600" />
                                        <span>Pulang</span>
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* TAB 3: PENGHASILAN */}
          {activeFileTab === 'PENGHASILAN' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-6">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    PENGHASILAN &amp; GAJI POKOK
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Data master gaji pokok dan histori sistem payroll resmi PT.KDRT (Kategori SHARING).
                  </p>
                </div>
              </div>

              {/* Penghasilan Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-bold text-slate-500 uppercase">Gaji Pokok Bulanan</div>
                  <div className="text-2xl font-black text-slate-900 mt-1">
                    {formatRupiah(selectedEmployee.baseSalary)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Gaji tetap per bulan
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                  <div className="text-xs font-bold text-emerald-900 uppercase">Uang Rajin Mingguan</div>
                  <div className="text-2xl font-black text-emerald-700 mt-1">
                    Rp 150.000
                  </div>
                  <div className="text-[11px] text-emerald-800 mt-1">
                    Potongan Rp 20.000 / keterlambatan
                  </div>
                </div>

                <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4">
                  <div className="text-xs font-bold text-orange-900 uppercase">Tanggal Pembayaran</div>
                  <div className="text-xl font-black text-orange-700 mt-1">
                    Tanggal 25
                  </div>
                  <div className="text-[11px] text-orange-800 mt-1">
                    Jatuh tempo rutin setiap bulan
                  </div>
                </div>
              </div>

              {/* Status & Kebijakan Payroll */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
                <div className="font-bold text-slate-900 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                  <span>Sistem Penggajian &amp; Uang Rajin Terintegrasi (Phase 2C Selesai)</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Data gaji pokok ini terhubung langsung ke modul <strong>Penggajian &amp; Payroll</strong> dan <strong>Uang Rajin Mingguan</strong>. Keterlambatan absensi masuk otomatis memotong Uang Rajin, tanpa memotong Gaji Pokok. Seluruh slip gaji resmi dapat diakses dan dicetak melalui menu Penggajian atau Slip Gaji Saya.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: KINERJA (PLACEHOLDER RESMI PHASE 3) */}
          {activeFileTab === 'KINERJA' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-12 shadow-xs text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 border border-blue-200 text-blue-600">
                <FileText className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">KINERJA KARYAWAN</h3>
                <p className="text-sm font-bold text-blue-700 mt-1">
                  Modul kinerja akan tersedia pada Phase 3.
                </p>
                <p className="text-xs text-slate-500 max-w-lg mx-auto mt-2 leading-relaxed">
                  Modul ini akan memuat pencatatan kerjaan harian (Daily Tasks), jadwal live streaming, target omzet GMV harian, dan evaluasi KPI berkala.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3.5 py-1 text-xs font-bold text-slate-600 border border-slate-200">
                <span>Tahap Berikutnya: Phase 3 (Kerjaan Harian &amp; KPI)</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL TAMBAH / EDIT KARYAWAN                                             */}
      {/* ========================================================================= */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-orange-600" />
                {editingEmployee ? 'Edit Data Karyawan' : 'Tambah Karyawan Baru'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Quick Presets for Manual Entry as requested */}
            {!editingEmployee && (
              <div className="mb-4 p-3 rounded-xl bg-orange-50/70 border border-orange-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="text-xs text-orange-950">
                  <strong className="block">Isi Cepat Staf Standar:</strong>
                  <span className="text-[11px] text-orange-800">
                    Klik untuk mengisi otomatis formulir dengan data manual:
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleQuickPreset('MELINDA')}
                    className="inline-flex items-center gap-1 rounded-lg bg-white border border-orange-200 px-2.5 py-1 text-xs font-bold text-orange-700 hover:bg-orange-100 transition-colors shadow-2xs"
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>Melinda (Talent)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPreset('DESTA')}
                    className="inline-flex items-center gap-1 rounded-lg bg-white border border-orange-200 px-2.5 py-1 text-xs font-bold text-orange-700 hover:bg-orange-100 transition-colors shadow-2xs"
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>Desta (Editor)</span>
                  </button>
                </div>
              </div>
            )}

            {saveError && (
              <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 font-semibold">
                {saveError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              {/* Row 1: Nama Lengkap & Nama Panggilan */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Nama Lengkap <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="contoh: Melinda"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold focus:outline-orange-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nama Panggilan</label>
                  <input
                    type="text"
                    value={formData.nickname}
                    onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                    placeholder="contoh: Meli"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:outline-orange-500"
                  />
                </div>
              </div>

              {/* Row 2: Jabatan & Role Aplikasi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Jabatan (Pekerjaan) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    placeholder="contoh: Talent / Editor / Manager"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold focus:outline-orange-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Contoh: Talent, Editor, Manager, Host Live, Admin
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Role Aplikasi <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.appRole}
                    onChange={(e) =>
                      setFormData({ ...formData, appRole: e.target.value as UserRole })
                    }
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold focus:outline-orange-500"
                  >
                    <option value="EMPLOYEE">EMPLOYEE (Karyawan)</option>
                    <option value="MANAGER">MANAGER (Manajer)</option>
                  </select>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Hak akses aplikasi terpisah dari jabatan kerja
                  </span>
                </div>
              </div>

              {/* Row 3: Gaji Pokok & Tanggal Mulai Kerja */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Gaji Pokok Bulanan (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={50000}
                    value={formData.baseSalary}
                    onChange={(e) =>
                      setFormData({ ...formData, baseSalary: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-black text-slate-900 focus:outline-orange-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Format: {formatRupiah(formData.baseSalary)}
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tanggal Mulai Kerja <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold focus:outline-orange-500"
                  />
                </div>
              </div>

              {/* Row 4: Email & Telepon */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Karyawan</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contoh: melinda@kdrt.id"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:outline-orange-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nomor Telepon / WhatsApp</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="contoh: 081234567890"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:outline-orange-500"
                  />
                </div>
              </div>

              {/* Row 5: Firebase UID & Scope */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Firebase UID {formData.active && (formData.appRole === 'EMPLOYEE' || formData.appRole === 'MANAGER') ? <span className="text-rose-500">*</span> : '(Opsional)'}
                  </label>
                  <input
                    type="text"
                    required={formData.active && (formData.appRole === 'EMPLOYEE' || formData.appRole === 'MANAGER')}
                    value={formData.userId}
                    onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                    placeholder="UID Firebase Authentication"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono focus:outline-orange-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Scope Bisnis</label>
                  <select
                    value={formData.scope}
                    onChange={(e) =>
                      setFormData({ ...formData, scope: e.target.value as ScopeType })
                    }
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold focus:outline-orange-500"
                  >
                    <option value="SHARING">SHARING (Toko Bersama)</option>
                    <option value="PRIBADI">PRIBADI (Akun Pribadi)</option>
                  </select>
                </div>
              </div>

              {/* Akun Medsos yang menjadi tanggung jawab karyawan (relasi data, bukan hardcode nama) */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-emerald-600" />
                  <label className="font-bold text-slate-800">Akun Medsos yang Ditangani</label>
                </div>
                <p className="mb-2.5 text-[11px] leading-relaxed text-slate-500">
                  Karyawan hanya dapat memilih, melihat, dan menginput Data GMV serta Komisi Real
                  untuk akun yang dicentang di sini. Owner tetap melihat seluruh akun.
                </p>
                {accounts.length === 0 ? (
                  <p className="text-[11px] font-semibold text-slate-500">
                    Belum ada akun medsos terdaftar.
                  </p>
                ) : (
                  <div
                    className="grid max-h-40 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2"
                    data-testid="employee-assigned-accounts"
                  >
                    {accounts.map((acc) => {
                      const checked = formData.assignedAccountIds.includes(acc.id || '');
                      return (
                        <label
                          key={acc.id}
                          className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 transition-colors hover:border-emerald-300"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                assignedAccountIds: e.target.checked
                                  ? [...formData.assignedAccountIds, acc.id || '']
                                  : formData.assignedAccountIds.filter((id) => id !== acc.id),
                              })
                            }
                            className="h-3.5 w-3.5 cursor-pointer rounded"
                            data-testid={`assign-account-${acc.id}`}
                          />
                          <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">
                            {acc.accountName}
                          </span>
                          <span className="shrink-0 text-[9px] font-bold uppercase text-slate-400">
                            {acc.scope}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Catatan */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Catatan Tambahan</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Catatan rekening bank, tugas utama, atau catatan khusus..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:outline-orange-500"
                />
              </div>

              {/* Checkbox Status Aktif */}
              <div className="flex items-center gap-2 pt-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  id="activeCheck"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="h-4 w-4 rounded text-orange-600 focus:ring-orange-500 cursor-pointer"
                />
                <label htmlFor="activeCheck" className="font-bold text-slate-800 cursor-pointer">
                  Status Karyawan Aktif Bekerja (Dapat Login &amp; Mengakses Modul)
                </label>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-orange-600 px-5 py-2 font-bold text-white shadow-xs hover:bg-orange-500 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                >
                  {saving ? 'Menyimpan ke Firestore...' : 'Simpan Data Karyawan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Selfie Photo Preview Modal */}
      {previewPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <div>
                <h4 className="text-xs font-bold text-zinc-100">{previewPhoto.title}</h4>
                {previewPhoto.subtitle && (
                  <p className="text-[10px] text-zinc-400">{previewPhoto.subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-black">
              <img
                src={previewPhoto.url}
                alt={previewPhoto.title}
                className="max-h-[70vh] w-auto max-w-full rounded-xl object-contain shadow-md"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="border-t border-zinc-800 p-3 bg-zinc-900 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="rounded-xl bg-zinc-800 px-4 py-2 text-xs font-bold text-zinc-200 hover:bg-zinc-700"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
