import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardList,
  Plus,
  Calendar,
  Sparkles,
  Search,
  Filter,
  Download,
  CheckCircle2,
  Clock,
  Flame,
  User,
  Users,
  LayoutGrid,
  ListFilter,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  FileSpreadsheet,
  ArrowLeft,
  Pause,
  XCircle,
  Play,
  Check,
  CheckSquare,
  Square,
  Package,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  DailyTask,
  DailyTaskStatus,
  Employee,
  Account,
  TaskTemplate,
} from '../types';
import {
  subscribeDailyTasks,
  subscribeDailyTasksByEmployee,
  subscribeTaskTemplates,
  createDailyTask,
  updateDailyTask,
  mulaiKerjakanTask,
  updateTaskOutput,
  selesaikanTask,
  pauseTask,
  cancelTask,
  deleteDailyTask,
  applyMelindaPresets,
} from '../services/taskService';
import { syncUnsyncedSharingSamplesToTasks } from '../services/sampleService';
import { subscribeEmployees } from '../services/employeeService';
import { subscribeAccounts } from '../services/accountService';
import { TaskCard } from '../components/task/TaskCard';
import { TaskFormModal } from '../components/task/TaskFormModal';
import { TaskDetailModal } from '../components/task/TaskDetailModal';
import { UpdateOutputModal } from '../components/task/UpdateOutputModal';
import { TaskTemplatesModal } from '../components/task/TaskTemplatesModal';
import {
  tanggalHariIni,
  formatTanggal,
  formatHariTanggal,
  formatJamWIB,
  formatDurasiTimestamp,
} from '../utils/formatters';

interface KerjaanHarianPageProps {
  onBackToPortal?: () => void;
}

export const KerjaanHarianPage: React.FC<KerjaanHarianPageProps> = ({ onBackToPortal }) => {
  const { role, userProfile, employeeProfile, loading: authLoading, currentUser } = useAuth();
  const isOwner = role === 'OWNER';
  const isManager = role === 'MANAGER';
  const isEmployee = role === 'EMPLOYEE';
  const activeEmployeeId = employeeProfile?.id || userProfile?.employeeId || (userProfile?.name === 'Desta' ? 'desta-id' : 'melinda-id');
  const currentUserId = userProfile?.uid || currentUser?.uid || activeEmployeeId;
  const currentUserName = employeeProfile?.name || userProfile?.name || 'Pengguna';

  // Date State (Defaults to Today WIB)
  const [selectedDate, setSelectedDate] = useState<string>(tanggalHariIni());

  // Data States from Firestore
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filter States
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>('SEMUA');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('SEMUA');
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>('SEMUA');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'TODO' | 'GRID' | 'TABLE'>('TODO');

  // Modal States
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingTask, setEditingTask] = useState<DailyTask | null>(null);
  const [detailTask, setDetailTask] = useState<DailyTask | null>(null);
  const [outputModalTask, setOutputModalTask] = useState<DailyTask | null>(null);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState<boolean>(false);
  const [isApplyingPreset, setIsApplyingPreset] = useState<boolean>(false);
  const [presetSuccessMsg, setPresetSuccessMsg] = useState<string>('');

  // 1. Subscribe to Employees & Accounts
  useEffect(() => {
    if (authLoading || !currentUser || !userProfile?.active) {
      return;
    }
    const unsubEmployees = subscribeEmployees(undefined, (empList) => {
      // For employee role, keep only self or all active for owner
      setEmployees(empList.filter((e) => e.active !== false));
    });

    const unsubAccounts = subscribeAccounts(undefined, (accList) => {
      setAccounts(accList);
    });

    const unsubTemplates = subscribeTaskTemplates((tplList) => {
      setTemplates(tplList);
    });

    return () => {
      unsubEmployees();
      unsubAccounts();
      unsubTemplates();
    };
  }, [authLoading, currentUser?.uid, userProfile?.role, userProfile?.active]);

  // 2. Subscribe to Tasks (Filtered by Employee if Employee Role, or by Date for Owner)
  useEffect(() => {
    if (authLoading || !currentUser || !userProfile?.active) {
      return;
    }

    // Auto-sync unlinked sharing samples in background
    syncUnsyncedSharingSamplesToTasks(currentUserId, currentUserName).catch(() => {});

    setIsLoading(true);
    let unsubTasks: () => void;

    if (isEmployee) {
      unsubTasks = subscribeDailyTasksByEmployee(
        {
          employeeId: activeEmployeeId,
          assigneeEmployeeId: activeEmployeeId,
          userId: currentUserId,
          employeeName: currentUserName,
        },
        selectedDate,
        (list) => {
          setTasks(list);
          setIsLoading(false);
        }
      );
    } else {
      unsubTasks = subscribeDailyTasks(
        { tanggal: selectedDate },
        (list) => {
          setTasks(list);
          setIsLoading(false);
        }
      );
    }

    return () => {
      if (unsubTasks) unsubTasks();
    };
  }, [
    authLoading,
    currentUser?.uid,
    userProfile?.role,
    userProfile?.active,
    isEmployee,
    activeEmployeeId,
    currentUserId,
    currentUserName,
    selectedDate,
  ]);

  // Date Quick Navigation
  const handlePrevDay = () => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleSetToday = () => {
    setSelectedDate(tanggalHariIni());
  };

  // Find Melinda employee
  const melindaEmployee = useMemo(() => {
    return employees.find(
      (e) =>
        e.name.toLowerCase().includes('melinda') ||
        (e.position && e.position.toLowerCase().includes('melinda'))
    );
  }, [employees]);

  // Check if Melinda already has presets for selected date
  const melindaPresetApplied = useMemo(() => {
    if (!melindaEmployee) return false;
    return tasks.some(
      (t) =>
        t.employeeId === melindaEmployee.id &&
        t.tanggal === selectedDate &&
        (t.taskName.toLowerCase().includes('nisa grosir') ||
          t.taskName.toLowerCase().includes('duniamainan') ||
          t.taskName.toLowerCase().includes('baju anak'))
    );
  }, [tasks, melindaEmployee, selectedDate]);

  // 1-Click Apply Melinda Presets
  const handleApplyMelindaPresets = async () => {
    if (!melindaEmployee) {
      alert('Data karyawan Melinda tidak ditemukan.');
      return;
    }

    setIsApplyingPreset(true);
    setPresetSuccessMsg('');
    try {
      const count = await applyMelindaPresets(
        melindaEmployee,
        selectedDate,
        currentUserId,
        currentUserName,
        tasks
      );
      if (count > 0) {
        setPresetSuccessMsg(`Berhasil menerapkan 3 preset tugas produksi untuk Melinda (${count} tugas baru dibuat).`);
      } else {
        setPresetSuccessMsg('Preset tugas untuk Melinda pada tanggal ini sudah lengkap.');
      }
    } catch (err: any) {
      alert('Gagal menerapkan preset: ' + err.message);
    } finally {
      setIsApplyingPreset(false);
      setTimeout(() => setPresetSuccessMsg(''), 5000);
    }
  };

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Employee filter (For Owner/Manager)
      if (selectedEmployeeFilter !== 'SEMUA' && task.employeeId !== selectedEmployeeFilter) {
        return false;
      }
      // Status filter
      if (selectedStatusFilter !== 'SEMUA' && task.status !== selectedStatusFilter) {
        return false;
      }
      // Account filter
      if (selectedAccountFilter !== 'SEMUA' && task.accountId !== selectedAccountFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = task.taskName.toLowerCase().includes(q);
        const matchEmp = task.employeeName.toLowerCase().includes(q);
        const matchNotes = (task.notes || '').toLowerCase().includes(q);
        const matchAcc = (task.accountName || '').toLowerCase().includes(q);
        if (!matchName && !matchEmp && !matchNotes && !matchAcc) return false;
      }
      return true;
    });
  }, [tasks, selectedEmployeeFilter, selectedStatusFilter, selectedAccountFilter, searchQuery]);

  // KPI Metrics Calculation
  const totalTasks = tasks.length;
  const selesaiTasks = tasks.filter((t) => t.status === 'SELESAI').length;
  const sedangTasks = tasks.filter((t) => t.status === 'SEDANG DIKERJAKAN').length;
  const belumTasks = tasks.filter((t) => t.status === 'BELUM DIKERJAKAN').length;
  const tertundaTasks = tasks.filter((t) => t.status === 'TERTUNDA' || t.status === 'DIBATALKAN').length;

  const totalTargetOutput = tasks.reduce((acc, t) => acc + (Number(t.targetOutput) || 0), 0);
  const totalCurrentOutput = tasks.reduce((acc, t) => acc + (Number(t.currentOutput) || 0), 0);
  const overallOutputPercent = totalTargetOutput > 0 ? Math.min(100, Math.round((totalCurrentOutput / totalTargetOutput) * 100)) : 0;

  // Grouped by Employee for High-Density Summary
  const employeeSummaries = useMemo(() => {
    const map = new Map<
      string,
      {
        employeeId: string;
        employeeName: string;
        totalTasks: number;
        completedTasks: number;
        inProgressTasks: number;
        pendingTasks: number;
        targetOutput: number;
        currentOutput: number;
        unit: string;
      }
    >();

    tasks.forEach((t) => {
      const existing = map.get(t.employeeId) || {
        employeeId: t.employeeId,
        employeeName: t.employeeName,
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        pendingTasks: 0,
        targetOutput: 0,
        currentOutput: 0,
        unit: t.unitOutput || 'VT',
      };

      existing.totalTasks += 1;
      if (t.status === 'SELESAI') existing.completedTasks += 1;
      else if (t.status === 'SEDANG DIKERJAKAN') existing.inProgressTasks += 1;
      else existing.pendingTasks += 1;

      existing.targetOutput += Number(t.targetOutput) || 0;
      existing.currentOutput += Number(t.currentOutput) || 0;

      map.set(t.employeeId, existing);
    });

    return Array.from(map.values());
  }, [tasks]);

  // Actions Handlers
  const handleStartTask = async (task: DailyTask) => {
    if (!task.id) return;
    try {
      await mulaiKerjakanTask(task.id, task, currentUserId, currentUserName);
    } catch (err: any) {
      alert('Gagal memulai tugas: ' + err.message);
    }
  };

  const handleCompleteTask = async (task: DailyTask) => {
    if (!task.id) return;
    const isUnderTarget = (task.currentOutput || 0) < (task.targetOutput || 1);

    if (isUnderTarget) {
      const confirmed = window.confirm(
        `Target output belum tercapai (${task.currentOutput || 0} / ${task.targetOutput} ${task.unitOutput}). Apakah Anda yakin ingin menyelesaikan pekerjaan ini?`
      );
      if (!confirmed) return;
    }

    try {
      await selesaikanTask(task.id, task, undefined, currentUserId, currentUserName);
    } catch (err: any) {
      alert('Gagal menyelesaikan tugas: ' + err.message);
    }
  };

  const handleSaveOutput = async (newOutput: number) => {
    if (!outputModalTask?.id) return;
    try {
      await updateTaskOutput(outputModalTask.id, outputModalTask, newOutput, currentUserId, currentUserName);
    } catch (err: any) {
      alert('Gagal memperbarui output: ' + err.message);
    }
  };

  const handlePauseTask = async (task: DailyTask, reason?: string) => {
    if (!task.id) return;
    try {
      await pauseTask(task.id, task, currentUserId, currentUserName, reason);
    } catch (err: any) {
      alert('Gagal menunda tugas: ' + err.message);
    }
  };

  const handleCancelTask = async (task: DailyTask, reason?: string) => {
    if (!task.id) return;
    try {
      await cancelTask(task.id, task, currentUserId, currentUserName, reason);
    } catch (err: any) {
      alert('Gagal membatalkan tugas: ' + err.message);
    }
  };

  const handleOverrideStatus = async (task: DailyTask, newStatus: DailyTaskStatus) => {
    if (!task.id) return;
    try {
      await updateDailyTask(task.id, task, { status: newStatus }, currentUserId, currentUserName, true);
    } catch (err: any) {
      alert('Gagal mengubah status: ' + err.message);
    }
  };

  const handleDeleteTask = async (task: DailyTask) => {
    if (!task.id) return;
    try {
      await deleteDailyTask(task.id, task, currentUserId, currentUserName);
    } catch (err: any) {
      alert('Gagal menghapus tugas: ' + err.message);
    }
  };

  const handleSaveTaskForm = async (
    taskData: Omit<DailyTask, 'id' | 'taskId' | 'createdAt' | 'updatedAt'>,
    isEdit: boolean
  ) => {
    if (isEdit && editingTask?.id) {
      await updateDailyTask(editingTask.id, editingTask, taskData, currentUserId, currentUserName);
    } else {
      await createDailyTask(taskData, currentUserId, currentUserName);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredTasks.length === 0) {
      alert('Tidak ada data tugas untuk diekspor.');
      return;
    }

    const headers = [
      'Tanggal',
      'Karyawan',
      'Nama Pekerjaan',
      'Akun TikTok',
      'Target Output',
      'Output Tercapai',
      'Satuan',
      'Persentase',
      'Status',
      'Prioritas',
      'Mulai Dikerjakan',
      'Selesai Dikerjakan',
      'Total Durasi',
      'Deadline',
      'Catatan',
      'Bukti/Link',
    ];

    const rows = filteredTasks.map((t) => [
      `"${t.tanggal}"`,
      `"${t.employeeName}"`,
      `"${t.taskName.replace(/"/g, '""')}"`,
      `"${t.accountName || '-'}"`,
      t.targetOutput || 0,
      t.currentOutput || 0,
      `"${t.unitOutput || 'VT'}"`,
      `"${t.targetOutput > 0 ? Math.round(((t.currentOutput || 0) / t.targetOutput) * 100) : 0}%"`,
      `"${t.status}"`,
      `"${t.priority}"`,
      `"${formatJamWIB(t.startedAt)}"`,
      `"${formatJamWIB(t.completedAt)}"`,
      `"${formatDurasiTimestamp(t.startedAt, t.completedAt)}"`,
      `"${t.deadline || '-'}"`,
      `"${(t.notes || '').replace(/"/g, '""')}"`,
      `"${t.attachmentUrl || t.proofLink || '-'}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Kerjaan_Harian_PT_KDRT_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            {onBackToPortal && (
              <button
                onClick={onBackToPortal}
                className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs"
                title="Kembali ke Portal"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <span className="text-[11px] font-bold uppercase tracking-wider text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-0.5 rounded-md">
              PT. KDRT
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1 flex items-center gap-2.5">
            <ClipboardList className="h-7 w-7 text-orange-600" />
            Kerjaan Hari Ini
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isEmployee
              ? `Daftar To-Do pekerjaan & target output saya untuk ${currentUserName}`
              : 'Daftar To-Do pekerjaan, monitoring target output harian karyawan & template'}
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Templates Modal Button (Owner / Manager) */}
          {!isEmployee && (
            <button
              onClick={() => setIsTemplatesModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition-all"
            >
              <Sparkles className="h-4 w-4 text-orange-600" />
              Kelola Template
            </button>
          )}

          {/* Export CSV Button (Owner / Manager) */}
          {!isEmployee && (
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition-all"
            >
              <Download className="h-4 w-4 text-emerald-600" />
              Export CSV
            </button>
          )}

          {/* Add Task Button */}
          {!isEmployee && (
            <button
              onClick={() => {
                setEditingTask(null);
                setIsFormOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2 text-xs font-black text-white hover:bg-orange-500 shadow-xs transition-all active:scale-95"
            >
              <Plus className="h-4 w-4" />
              + Tambah Pekerjaan
            </button>
          )}
        </div>
      </div>

      {/* Date Navigation Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevDay}
            className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 transition-colors"
            title="Hari Sebelumnya"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-orange-600 shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-black text-slate-900 bg-slate-50 focus:border-orange-500 focus:outline-none"
            />
            <span className="text-xs font-bold text-slate-700 hidden sm:inline">
              ({formatHariTanggal(selectedDate)})
            </span>
          </div>

          <button
            onClick={handleNextDay}
            className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 transition-colors"
            title="Hari Berikutnya"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {selectedDate !== tanggalHariIni() && (
            <button
              onClick={handleSetToday}
              className="rounded-xl bg-orange-100 px-3 py-1.5 text-xs font-extrabold text-orange-800 hover:bg-orange-200 transition-colors"
            >
              Hari Ini
            </button>
          )}
        </div>

        {/* Preset Melinda Quick Bar (For Owner/Manager if Melinda exists) */}
        {!isEmployee && melindaEmployee && (
          <div className="flex items-center gap-2">
            {presetSuccessMsg && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                {presetSuccessMsg}
              </span>
            )}
            <button
              onClick={handleApplyMelindaPresets}
              disabled={isApplyingPreset}
              className="inline-flex items-center gap-1.5 rounded-xl border border-orange-300 bg-orange-50 px-3.5 py-1.5 text-xs font-black text-orange-800 hover:bg-orange-100 transition-all shadow-2xs disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4 text-orange-600" />
              {isApplyingPreset
                ? 'Menerapkan...'
                : melindaPresetApplied
                ? '✓ Preset Melinda Aktif'
                : '+ Terapkan Preset Melinda (3 Tugas)'}
            </button>
          </div>
        )}
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Tasks */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Total Pekerjaan
          </span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">{totalTasks}</span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">{selectedDate}</span>
        </div>

        {/* Selesai */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
            🟢 Selesai
          </span>
          <span className="text-2xl font-black text-emerald-900 mt-1 block">{selesaiTasks}</span>
          <span className="text-[11px] text-emerald-700 font-semibold mt-0.5 block">
            {totalTasks > 0 ? Math.round((selesaiTasks / totalTasks) * 100) : 0}% Pekerjaan
          </span>
        </div>

        {/* Sedang Dikerjakan */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-2xs">
          <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
            🟡 Sedang Dikerjakan
          </span>
          <span className="text-2xl font-black text-amber-900 mt-1 block">{sedangTasks}</span>
          <span className="text-[11px] text-amber-700 font-semibold mt-0.5 block">Dalam Proses</span>
        </div>

        {/* Belum Dikerjakan */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            ⚪ Belum Dikerjakan
          </span>
          <span className="text-2xl font-black text-slate-700 mt-1 block">{belumTasks}</span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Antrean</span>
        </div>

        {/* Tertunda / Batal */}
        <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4 shadow-2xs">
          <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">
            🔴 Tertunda / Batal
          </span>
          <span className="text-2xl font-black text-rose-900 mt-1 block">{tertundaTasks}</span>
          <span className="text-[11px] text-rose-700 font-semibold mt-0.5 block">Kendala / Jeda</span>
        </div>

        {/* Total Output Progress */}
        <div className="rounded-2xl border border-orange-200 bg-orange-50/50 p-4 shadow-2xs">
          <span className="text-[10px] font-bold text-orange-900 uppercase tracking-wider block">
            🎯 Total Output
          </span>
          <span className="text-2xl font-black text-orange-950 mt-1 block">
            {totalCurrentOutput} / {totalTargetOutput}
          </span>
          <div className="w-full bg-orange-200 h-1.5 rounded-full overflow-hidden mt-1.5">
            <div
              className="bg-orange-600 h-full rounded-full transition-all"
              style={{ width: `${overallOutputPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Monitoring Per Karyawan (Owner/Manager View) */}
      {!isEmployee && employeeSummaries.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Users className="h-4 w-4 text-orange-600" />
              Monitoring Per Karyawan Hari Ini
            </h3>
            <span className="text-[11px] text-slate-500 font-semibold">
              {employeeSummaries.length} Karyawan Aktif Memiliki Tugas
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {employeeSummaries.map((emp) => {
              const empPercent =
                emp.targetOutput > 0
                  ? Math.min(100, Math.round((emp.currentOutput / emp.targetOutput) * 100))
                  : 0;
              const isEmpAchieved = emp.currentOutput >= emp.targetOutput && emp.targetOutput > 0;

              return (
                <div
                  key={emp.employeeId}
                  onClick={() =>
                    setSelectedEmployeeFilter(
                      selectedEmployeeFilter === emp.employeeId ? 'SEMUA' : emp.employeeId
                    )
                  }
                  className={`rounded-xl border p-3.5 transition-all cursor-pointer ${
                    selectedEmployeeFilter === emp.employeeId
                      ? 'border-orange-500 bg-orange-50/60 ring-2 ring-orange-200'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-slate-900">{emp.employeeName}</span>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                        isEmpAchieved
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-800'
                      }`}
                    >
                      {emp.completedTasks}/{emp.totalTasks} Tugas
                    </span>
                  </div>

                  {/* Output Counter */}
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Output Produksi:</span>
                    <strong className="text-slate-900 font-black">
                      {emp.currentOutput} / {emp.targetOutput} {emp.unit} ({empPercent}%)
                    </strong>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden mt-1.5">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isEmpAchieved ? 'bg-emerald-500' : 'bg-orange-500'
                      }`}
                      style={{ width: `${empPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama pekerjaan, karyawan, akun, atau catatan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:border-orange-500 focus:outline-none"
            />
          </div>

          {/* Employee Filter (Owner/Manager) */}
          {!isEmployee && (
            <select
              value={selectedEmployeeFilter}
              onChange={(e) => setSelectedEmployeeFilter(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800"
            >
              <option value="SEMUA">Semua Karyawan ({employees.length})</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          )}

          {/* Status Filter */}
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800"
          >
            <option value="SEMUA">Semua Status</option>
            <option value="BELUM DIKERJAKAN">Belum Dikerjakan</option>
            <option value="SEDANG DIKERJAKAN">Sedang Dikerjakan</option>
            <option value="SELESAI">Selesai</option>
            <option value="TERTUNDA">Tertunda</option>
            <option value="DIBATALKAN">Dibatalkan</option>
          </select>

          {/* Account Filter */}
          {!isEmployee && (
            <select
              value={selectedAccountFilter}
              onChange={(e) => setSelectedAccountFilter(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800"
            >
              <option value="SEMUA">Semua Akun TikTok</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.accountName}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* View Mode Toggle (To-Do vs Grid vs Table) */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setViewMode('TODO')}
            className={`rounded-lg p-1.5 text-xs font-bold transition-all ${
              viewMode === 'TODO'
                ? 'bg-white text-orange-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Tampilan To-Do List"
          >
            <CheckSquare className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('GRID')}
            className={`rounded-lg p-1.5 text-xs font-bold transition-all ${
              viewMode === 'GRID'
                ? 'bg-white text-orange-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Tampilan Kartu"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('TABLE')}
            className={`rounded-lg p-1.5 text-xs font-bold transition-all ${
              viewMode === 'TABLE'
                ? 'bg-white text-orange-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Tampilan Tabel Rapat"
          >
            <ListFilter className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Task Listing */}
      {isLoading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-slate-500">
          <RefreshCw className="h-8 w-8 text-orange-500 animate-spin mx-auto mb-2" />
          <p className="text-xs font-semibold">Memuat data kerjaan harian dari Firestore...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500 space-y-3">
          <ClipboardList className="h-10 w-10 text-slate-400 mx-auto" />
          <h4 className="text-base font-bold text-slate-800">
            Belum ada tugas pada tanggal {formatTanggal(selectedDate)}
          </h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {isEmployee
              ? 'Anda belum memiliki tugas yang dijadwalkan pada tanggal ini.'
              : 'Klik tombol "+ Tambah Pekerjaan" atau "Terapkan Preset Melinda" untuk membuat tugas produksi baru.'}
          </p>

          {!isEmployee && (
            <div className="pt-2 flex items-center justify-center gap-2">
              {melindaEmployee && (
                <button
                  onClick={handleApplyMelindaPresets}
                  className="rounded-xl bg-orange-100 text-orange-800 border border-orange-200 px-4 py-2 text-xs font-bold hover:bg-orange-200"
                >
                  Terapkan Preset Melinda
                </button>
              )}
              <button
                onClick={() => {
                  setEditingTask(null);
                  setIsFormOpen(true);
                }}
                className="rounded-xl bg-orange-600 text-white px-4 py-2 text-xs font-bold hover:bg-orange-500"
              >
                + Tambah Pekerjaan Baru
              </button>
            </div>
          )}
        </div>
      ) : viewMode === 'TODO' ? (
        /* Sederhana & Praktis: Tampilan To-Do List */
        <div className="space-y-4">
          {isEmployee ? (
            /* Employee Dedicated To-Do List with Dedicated Sample Section */
            (() => {
              const sampleTasks = filteredTasks.filter(
                (t) => (t.sourceType === 'SAMPLE' || Boolean(t.sampleId)) && t.status !== 'SELESAI' && (t.currentOutput || 0) < (t.targetOutput || 1)
              );
              const manualTasks = filteredTasks.filter(
                (t) => !(t.sourceType === 'SAMPLE' || Boolean(t.sampleId)) && t.status !== 'SELESAI'
              );
              const completedTasks = filteredTasks.filter(
                (t) => t.status === 'SELESAI' || (t.currentOutput || 0) >= (t.targetOutput || 1)
              );

              return (
                <div className="space-y-4">
                  {/* 1. SECTION: SAMPEL BELUM DIKONTENKAN */}
                  <div className="rounded-2xl border border-orange-200 bg-orange-50/20 p-4 sm:p-6 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between border-b border-orange-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-600 text-white shadow-xs">
                          <Package className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                            SAMPEL BELUM DIKONTENKAN
                          </h3>
                          <p className="text-[11px] text-slate-500 font-medium">
                            Produk sampel Sharing yang sudah diterima dan wajib diproduksi kontennya
                          </p>
                        </div>
                      </div>
                      <span className="rounded-full bg-orange-100 text-orange-800 text-[11px] font-black px-3 py-1 border border-orange-200">
                        {sampleTasks.length} Sampel
                      </span>
                    </div>

                    {sampleTasks.length === 0 ? (
                      <div className="text-center py-6 text-xs text-slate-400 font-medium bg-white/60 rounded-xl border border-dashed border-orange-200">
                        🎉 Semua sampel Sharing sudah selesai diproduksi! Tidak ada antrean sampel.
                      </div>
                    ) : (
                      <div className="divide-y divide-orange-100/60">
                        {sampleTasks.map((task) => {
                          const target = task.targetOutput || 3;
                          const current = task.currentOutput || 0;
                          const percent = Math.min(100, Math.round((current / target) * 100));

                          return (
                            <div
                              key={task.id}
                              className="flex flex-col sm:flex-row sm:items-center justify-between py-3.5 px-2 gap-3 transition-colors rounded-xl bg-white hover:bg-orange-50/40 p-3 border border-orange-100/80 mb-2 shadow-2xs"
                            >
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <button
                                  onClick={() => handleCompleteTask(task)}
                                  className="mt-0.5 text-orange-600 hover:text-orange-700 transition-colors shrink-0"
                                  title="Tandai Selesai"
                                >
                                  <Square className="h-6 w-6 text-orange-400 hover:text-orange-600" />
                                </button>

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      onClick={() => setDetailTask(task)}
                                      className="text-sm font-black text-slate-900 hover:text-orange-600 cursor-pointer transition-colors"
                                    >
                                      {task.taskName}
                                    </span>

                                    <span className="rounded-md bg-orange-100 text-orange-800 font-extrabold text-[10px] px-2 py-0.5 border border-orange-200">
                                      SAMPEL SHARING
                                    </span>

                                    {task.accountName && (
                                      <span className="rounded-md bg-zinc-900 text-white font-extrabold text-[10px] px-2 py-0.5">
                                        {task.accountName}
                                      </span>
                                    )}
                                  </div>

                                  <div className="text-xs text-slate-600 mt-1.5 flex flex-wrap items-center gap-3 font-medium">
                                    <span>
                                      Target:{' '}
                                      <strong className="text-slate-900 font-bold">
                                        {target} {task.unitOutput || 'VT'}
                                      </strong>
                                    </span>
                                    <span>•</span>
                                    <span>
                                      Progress:{' '}
                                      <strong className="text-orange-600 font-black">
                                        {current} / {target} {task.unitOutput || 'VT'}
                                      </strong>
                                    </span>
                                  </div>

                                  {/* Progress bar */}
                                  <div className="w-full max-w-md bg-slate-100 h-2 rounded-full overflow-hidden mt-2 border border-slate-200/50">
                                    <div
                                      className="bg-orange-500 h-full rounded-full transition-all duration-300"
                                      style={{ width: `${percent}%` }}
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                <button
                                  onClick={() => setOutputModalTask(task)}
                                  className="rounded-xl border border-orange-300 bg-orange-500 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-orange-600 shadow-xs transition-colors"
                                >
                                  + Update Output
                                </button>
                                <button
                                  onClick={() => setDetailTask(task)}
                                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                                >
                                  Detail
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 2. SECTION: TUGAS OPERASIONAL LAINNYA */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-white shadow-xs">
                          <CheckSquare className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="font-black text-sm text-slate-900">
                            TUGAS OPERASIONAL LAINNYA
                          </h3>
                          <p className="text-[11px] text-slate-500 font-medium">
                            Pekerjaan harian & to-do reguler non-sampel
                          </p>
                        </div>
                      </div>
                      <span className="rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold px-3 py-1">
                        {manualTasks.length} Tugas
                      </span>
                    </div>

                    {manualTasks.length === 0 ? (
                      <div className="text-center py-6 text-xs text-slate-400 font-medium">
                        Tidak ada tugas operasional harian lainnya yang aktif.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {manualTasks.map((task) => {
                          const target = task.targetOutput || 1;
                          const current = task.currentOutput || 0;
                          const percent = Math.min(100, Math.round((current / target) * 100));

                          return (
                            <div
                              key={task.id}
                              className="flex flex-col sm:flex-row sm:items-center justify-between py-3.5 px-2 gap-3 transition-colors rounded-xl hover:bg-slate-50"
                            >
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <button
                                  onClick={() => handleCompleteTask(task)}
                                  className="mt-0.5 text-orange-600 hover:text-orange-700 transition-colors shrink-0"
                                  title="Tandai Selesai"
                                >
                                  <Square className="h-6 w-6 text-slate-400 hover:text-orange-600" />
                                </button>

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      onClick={() => setDetailTask(task)}
                                      className="text-sm font-bold text-slate-900 hover:text-orange-600 cursor-pointer transition-colors"
                                    >
                                      {task.taskName} — {target} {task.unitOutput || 'VT'}
                                    </span>

                                    {task.accountName && (
                                      <span className="rounded-md bg-zinc-900 text-white font-extrabold text-[10px] px-2 py-0.5">
                                        {task.accountName}
                                      </span>
                                    )}
                                  </div>

                                  <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                                    <span>
                                      Output:{' '}
                                      <strong className="text-slate-800 font-bold">
                                        {current} / {target} {task.unitOutput || 'VT'}
                                      </strong>{' '}
                                      ({percent}%)
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                <button
                                  onClick={() => setOutputModalTask(task)}
                                  className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                  + Update Output
                                </button>
                                <button
                                  onClick={() => setDetailTask(task)}
                                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                                >
                                  Detail
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 3. SECTION: PEKERJAAN SELESAI */}
                  {completedTasks.length > 0 && (
                    <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/20 p-4 sm:p-5 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between border-b border-emerald-100 pb-2.5">
                        <h4 className="font-black text-xs text-emerald-900 flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          PEKERJAAN SELESAI ({completedTasks.length})
                        </h4>
                      </div>

                      <div className="divide-y divide-emerald-100/60">
                        {completedTasks.map((task) => {
                          const target = task.targetOutput || 1;
                          const current = task.currentOutput || target;

                          return (
                            <div
                              key={task.id}
                              className="flex flex-col sm:flex-row sm:items-center justify-between py-2.5 px-2 gap-2 rounded-xl transition-colors bg-emerald-50/40"
                            >
                              <div className="flex items-start gap-3 min-w-0 flex-1">
                                <button
                                  onClick={() => handleOverrideStatus(task, 'SEDANG DIKERJAKAN')}
                                  className="mt-0.5 text-emerald-600 hover:text-emerald-700 transition-colors shrink-0"
                                  title="Buka kembali"
                                >
                                  <CheckSquare className="h-5 w-5 text-emerald-600" />
                                </button>

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      onClick={() => setDetailTask(task)}
                                      className="text-xs font-bold line-through text-slate-400 cursor-pointer"
                                    >
                                      {task.taskName}
                                    </span>
                                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                      SELESAI ({current}/{target} {task.unitOutput || 'VT'})
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={() => setDetailTask(task)}
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                              >
                                Detail
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()
          ) : (

            /* Owner / Manager View: Grouped To-Do Lists by Employee */
            <div className="space-y-4">
              {employeeSummaries.map((emp) => {
                const empTasks = filteredTasks.filter((t) => t.employeeId === emp.employeeId);
                if (empTasks.length === 0) return null;

                return (
                  <div
                    key={emp.employeeId}
                    className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-xl bg-orange-100 text-orange-800 flex items-center justify-center font-black text-xs">
                          {emp.employeeName.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-black text-sm text-slate-900">{emp.employeeName}</h4>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {empTasks.length} Tugas Harian
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-xs font-black text-slate-900 block">
                            {emp.currentOutput} / {emp.targetOutput} {emp.unit}
                          </span>
                          <span className="text-[10px] text-slate-500 font-bold">
                            {emp.completedTasks}/{emp.totalTasks} Selesai
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {empTasks.map((task) => {
                        const isDone = task.status === 'SELESAI';
                        const target = task.targetOutput || 1;
                        const current = task.currentOutput || 0;

                        return (
                          <div
                            key={task.id}
                            className={`flex flex-col sm:flex-row sm:items-center justify-between py-2.5 px-2 gap-2 rounded-xl transition-colors ${
                              isDone ? 'bg-emerald-50/20' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <button
                                onClick={() => {
                                  if (isDone) {
                                    handleOverrideStatus(task, 'SEDANG DIKERJAKAN');
                                  } else {
                                    handleCompleteTask(task);
                                  }
                                }}
                                className="mt-0.5 text-orange-600 hover:text-orange-700 transition-colors shrink-0"
                              >
                                {isDone ? (
                                  <CheckSquare className="h-5 w-5 text-emerald-600" />
                                ) : (
                                  <Square className="h-5 w-5 text-slate-400 hover:text-orange-600" />
                                )}
                              </button>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    onClick={() => setDetailTask(task)}
                                    className={`text-xs font-bold cursor-pointer transition-colors ${
                                      isDone
                                        ? 'line-through text-slate-400'
                                        : 'text-slate-900 hover:text-orange-600'
                                    }`}
                                  >
                                    {task.taskName} — {target} {task.unitOutput || 'VT'}
                                  </span>

                                  {task.accountName && (
                                    <span className="rounded-md bg-zinc-900 text-white font-extrabold text-[9px] px-1.5 py-0.5">
                                      {task.accountName}
                                    </span>
                                  )}

                                  <span
                                    className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${
                                      isDone
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {isDone ? 'SELESAI' : 'BELUM SELESAI'}
                                  </span>
                                </div>

                                <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-2.5">
                                  <span>
                                    Progress:{' '}
                                    <strong className="text-slate-800 font-bold">
                                      {current} / {target} {task.unitOutput || 'VT'}
                                    </strong>
                                  </span>
                                  {task.startedAt && (
                                    <span>Mulai: {formatJamWIB(task.startedAt)}</span>
                                  )}
                                  {task.completedAt && (
                                    <span className="text-emerald-700">
                                      Selesai: {formatJamWIB(task.completedAt)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                              <button
                                onClick={() => setOutputModalTask(task)}
                                className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                              >
                                + Output
                              </button>
                              <button
                                onClick={() => setDetailTask(task)}
                                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
                              >
                                Detail
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : viewMode === 'GRID' ? (
        /* Card Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              role={role}
              currentUserId={currentUserId}
              onStart={handleStartTask}
              onComplete={handleCompleteTask}
              onUpdateOutput={(t) => setOutputModalTask(t)}
              onPause={(t) => handlePauseTask(t)}
              onViewDetail={(t) => setDetailTask(t)}
              onEdit={(t) => {
                setEditingTask(t);
                setIsFormOpen(true);
              }}
              onDelete={handleDeleteTask}
            />
          ))}
        </div>
      ) : (
        /* High Density Table View */
        <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-600">
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Nama Pekerjaan</th>
                  <th className="py-3 px-4">Karyawan</th>
                  <th className="py-3 px-4">Akun</th>
                  <th className="py-3 px-4 text-center">Progress Output</th>
                  <th className="py-3 px-4">Mulai / Selesai</th>
                  <th className="py-3 px-4">Durasi</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTasks.map((task) => {
                  const target = task.targetOutput || 1;
                  const current = task.currentOutput || 0;
                  const percent = Math.min(100, Math.round((current / target) * 100));
                  const isTargetAchieved = current >= target;

                  return (
                    <tr key={task.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block font-extrabold text-[10px] px-2 py-0.5 rounded-full ${
                            task.status === 'SELESAI'
                              ? 'bg-emerald-100 text-emerald-800'
                              : task.status === 'SEDANG DIKERJAKAN'
                              ? 'bg-amber-100 text-amber-900 animate-pulse'
                              : task.status === 'TERTUNDA'
                              ? 'bg-slate-200 text-slate-700'
                              : task.status === 'DIBATALKAN'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {task.status}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div
                          onClick={() => setDetailTask(task)}
                          className="font-bold text-slate-900 hover:text-orange-600 cursor-pointer"
                        >
                          {task.taskName}
                        </div>
                        {task.notes && (
                          <div className="text-[11px] text-slate-500 truncate max-w-xs">{task.notes}</div>
                        )}
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-800">{task.employeeName}</td>

                      <td className="py-3 px-4">
                        {task.accountName ? (
                          <span className="rounded-md bg-zinc-900 text-white font-extrabold text-[10px] px-2 py-0.5">
                            {task.accountName}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="font-black text-slate-900">
                          {current} / {target} {task.unitOutput}
                        </div>
                        <div className="w-20 bg-slate-100 h-1.5 rounded-full mx-auto mt-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isTargetAchieved ? 'bg-emerald-500' : 'bg-orange-500'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </td>

                      <td className="py-3 px-4 text-[11px] text-slate-600">
                        <div>Mulai: {formatJamWIB(task.startedAt)}</div>
                        <div>Selesai: {formatJamWIB(task.completedAt)}</div>
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-800 text-[11px]">
                        {formatDurasiTimestamp(task.startedAt, task.completedAt)}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setDetailTask(task)}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                          >
                            Detail
                          </button>

                          {task.status === 'BELUM DIKERJAKAN' && (
                            <button
                              onClick={() => handleStartTask(task)}
                              className="rounded-lg bg-orange-600 px-2 py-1 text-[11px] font-black text-white hover:bg-orange-500"
                            >
                              Mulai
                            </button>
                          )}

                          {task.status === 'SEDANG DIKERJAKAN' && (
                            <>
                              <button
                                onClick={() => setOutputModalTask(task)}
                                className="rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-bold text-slate-800 hover:bg-slate-100"
                              >
                                + Output
                              </button>
                              <button
                                onClick={() => handleCompleteTask(task)}
                                className="rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-black text-white hover:bg-emerald-500"
                              >
                                Selesai
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODALS */}
      {/* 1. Task Form Modal (Add / Edit) */}
      {isFormOpen && (
        <TaskFormModal
          initialTask={editingTask}
          employees={employees}
          accounts={accounts}
          templates={templates}
          selectedDate={selectedDate}
          onClose={() => {
            setIsFormOpen(false);
            setEditingTask(null);
          }}
          onSave={handleSaveTaskForm}
        />
      )}

      {/* 2. Task Detail Modal */}
      {detailTask && (
        <TaskDetailModal
          task={detailTask}
          role={role}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          onClose={() => setDetailTask(null)}
          onStart={handleStartTask}
          onComplete={handleCompleteTask}
          onUpdateOutput={(t) => {
            setDetailTask(null);
            setOutputModalTask(t);
          }}
          onPause={handlePauseTask}
          onCancel={handleCancelTask}
          onOverrideStatus={handleOverrideStatus}
          onEdit={(t) => {
            setDetailTask(null);
            setEditingTask(t);
            setIsFormOpen(true);
          }}
          onDelete={handleDeleteTask}
        />
      )}

      {/* 3. Output Progress Modal */}
      {outputModalTask && (
        <UpdateOutputModal
          task={outputModalTask}
          onClose={() => setOutputModalTask(null)}
          onSave={handleSaveOutput}
        />
      )}

      {/* 4. Task Templates Management Modal */}
      {isTemplatesModalOpen && (
        <TaskTemplatesModal
          templates={templates}
          role={role}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          onClose={() => setIsTemplatesModalOpen(false)}
        />
      )}
    </div>
  );
};
