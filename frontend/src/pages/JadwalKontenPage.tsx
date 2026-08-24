import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Home,
  ChevronRight,
  User,
  Smartphone,
  Video,
  Scissors,
  Send,
  ShoppingBag,
  Download,
  Repeat,
  Sparkles,
  Layers,
  ListFilter,
  Eye,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  ContentCalendarItem,
  ContentStatus,
  ScopeType,
  Account,
  Product,
  Employee,
  DailyTask,
} from '../types';
import {
  subscribeContentCalendar,
  exportContentCalendarToCSV,
} from '../services/contentCalendarService';
import { subscribeAccounts } from '../services/accountService';
import { subscribeProducts } from '../services/productService';
import { subscribeEmployees } from '../services/employeeService';
import { subscribeDailyTasks } from '../services/taskService';
import { ContentCalendarGrid } from '../components/contentCalendar/ContentCalendarGrid';
import { ContentTodayView } from '../components/contentCalendar/ContentTodayView';
import { ContentDetailModal } from '../components/contentCalendar/ContentDetailModal';
import { ContentFormModal } from '../components/contentCalendar/ContentFormModal';
import { ContentPostingProofModal } from '../components/contentCalendar/ContentPostingProofModal';
import { ContentStatusBadge } from '../components/contentCalendar/ContentStatusBadge';
import { tanggalHariIni, formatTanggal, formatRupiah } from '../utils/formatters';

interface JadwalKontenPageProps {
  onBackToPortal?: () => void;
}

type SubMenuType = 'KALENDER' | 'DAFTAR' | 'HARI_INI';

export const JadwalKontenPage: React.FC<JadwalKontenPageProps> = ({
  onBackToPortal,
}) => {
  const { userProfile, role, loading: authLoading, currentUser } = useAuth();

  // Submenu
  const [activeSubMenu, setActiveSubMenu] = useState<SubMenuType>('KALENDER');
  const [calendarViewMode, setCalendarViewMode] = useState<'BULAN' | 'MINGGU' | 'HARI' | 'DAFTAR'>('BULAN');
  const [currentDate, setCurrentDate] = useState<string>(tanggalHariIni());

  // Data collections
  const [contentItems, setContentItems] = useState<ContentCalendarItem[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterAccount, setFilterAccount] = useState<string>('SEMUA');
  const [filterProduct, setFilterProduct] = useState<string>('SEMUA');
  const [filterTalent, setFilterTalent] = useState<string>('SEMUA');
  const [filterEditor, setFilterEditor] = useState<string>('SEMUA');
  const [filterStatus, setFilterStatus] = useState<string>('SEMUA');
  const [filterScope, setFilterScope] = useState<string>('SEMUA');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  // Modals
  const [selectedContent, setSelectedContent] = useState<ContentCalendarItem | null>(null);
  const [showFormModal, setShowFormModal] = useState<boolean>(false);
  const [editingContent, setEditingContent] = useState<ContentCalendarItem | null>(null);
  const [showPostingModal, setShowPostingModal] = useState<boolean>(false);
  const [postingContent, setPostingContent] = useState<ContentCalendarItem | null>(null);
  const [formDefaultDate, setFormDefaultDate] = useState<string>(tanggalHariIni());

  // Subscribe to real-time collections
  useEffect(() => {
    if (authLoading || !currentUser || !userProfile?.active) {
      return;
    }
    setLoading(true);

    const unsubContent = subscribeContentCalendar(
      undefined,
      (items) => {
        setContentItems(items);
        setLoading(false);
      },
      userProfile || undefined
    );

    const unsubAcc = subscribeAccounts(undefined, (accList) => {
      setAccounts(accList);
    });

    const unsubProd = subscribeProducts(undefined, (prodList) => {
      setProducts(prodList);
    });

    const unsubEmp = subscribeEmployees(undefined, (empList) => {
      setEmployees(empList);
    });

    const unsubTask = subscribeDailyTasks(undefined, (taskList) => {
      setTasks(taskList);
    });

    return () => {
      unsubContent();
      unsubAcc();
      unsubProd();
      unsubEmp();
      unsubTask();
    };
  }, [authLoading, currentUser?.uid, userProfile?.role, userProfile?.active]);

  // Filtered Content Items
  const filteredContentItems = contentItems.filter((item) => {
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title?.toLowerCase().includes(q);
      const matchAccount = item.accountName?.toLowerCase().includes(q);
      const matchProduct = item.productName?.toLowerCase().includes(q);
      const matchTalent = item.talentName?.toLowerCase().includes(q);
      const matchEditor = item.editorName?.toLowerCase().includes(q);
      const matchNotes = item.notes?.toLowerCase().includes(q);
      if (!matchTitle && !matchAccount && !matchProduct && !matchTalent && !matchEditor && !matchNotes) {
        return false;
      }
    }

    if (filterAccount !== 'SEMUA' && item.accountId !== filterAccount) return false;
    if (filterProduct !== 'SEMUA' && item.productId !== filterProduct) return false;
    if (filterTalent !== 'SEMUA' && item.talentId !== filterTalent) return false;
    if (filterEditor !== 'SEMUA' && item.editorId !== filterEditor) return false;
    if (filterStatus !== 'SEMUA' && item.status !== filterStatus) return false;
    if (filterScope !== 'SEMUA' && item.scope !== filterScope) return false;
    if (filterStartDate && item.date < filterStartDate) return false;
    if (filterEndDate && item.date > filterEndDate) return false;

    return true;
  });

  // Today items for dedicated tab
  const todayDateStr = tanggalHariIni();
  const todayItems = contentItems.filter((item) => item.date === todayDateStr);

  const handleAddNewAtDate = (dateStr: string) => {
    setEditingContent(null);
    setFormDefaultDate(dateStr);
    setShowFormModal(true);
  };

  const handleQuickPost = (item: ContentCalendarItem) => {
    setPostingContent(item);
    setShowPostingModal(true);
  };

  const handleExportCSV = () => {
    exportContentCalendarToCSV(filteredContentItems);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 mb-1">
            {onBackToPortal && (
              <button
                onClick={onBackToPortal}
                className="flex items-center gap-1 text-slate-500 hover:text-slate-800 transition-colors"
              >
                <Home className="h-3.5 w-3.5" />
                <span>Portal</span>
              </button>
            )}
            <ChevronRight className="h-3 w-3" />
            <span className="text-orange-600">Jadwal Konten & Produksi VT</span>
          </div>

          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-orange-600" />
            <span>JADWAL KONTEN & CONTENT MANAGEMENT</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Integrasi Akun TikTok, Produk, Talent, Editor, Kerjaan Harian, & Realisasi Posting
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            title="Export CSV"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          <button
            onClick={() => {
              setEditingContent(null);
              setFormDefaultDate(tanggalHariIni());
              setShowFormModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-orange-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Konten</span>
          </button>
        </div>
      </div>

      {/* 2. Submenu Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubMenu('KALENDER')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeSubMenu === 'KALENDER'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <CalendarIcon className="h-4 w-4" />
            <span>Kalender Konten</span>
          </button>

          <button
            onClick={() => setActiveSubMenu('HARI_INI')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all relative ${
              activeSubMenu === 'HARI_INI'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>Konten Hari Ini</span>
            {todayItems.length > 0 && (
              <span className="h-5 min-w-5 px-1.5 rounded-full bg-orange-600 text-white text-[10px] font-black flex items-center justify-center">
                {todayItems.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubMenu('DAFTAR')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeSubMenu === 'DAFTAR'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <ListFilter className="h-4 w-4" />
            <span>Daftar Konten</span>
          </button>
        </div>

        {/* If in Calendar View, show Month/Week/Day/List switcher */}
        {activeSubMenu === 'KALENDER' && (
          <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-bold text-slate-600">
            {(['BULAN', 'MINGGU', 'HARI', 'DAFTAR'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setCalendarViewMode(mode)}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  calendarViewMode === mode
                    ? 'bg-white text-slate-900 shadow-2xs font-black'
                    : 'hover:text-slate-900'
                }`}
              >
                {mode === 'BULAN'
                  ? 'Bulan'
                  : mode === 'MINGGU'
                  ? 'Minggu'
                  : mode === 'HARI'
                  ? 'Hari'
                  : 'Tabel'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. Global Filters Bar (Visible for Calendar & Daftar) */}
      {activeSubMenu !== 'HARI_INI' && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {/* Search Input */}
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Pencarian
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari judul, akun, produk, talent..."
                  className="w-full rounded-xl border border-slate-300 pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                />
              </div>
            </div>

            {/* Filter Akun */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Akun TikTok
              </label>
              <select
                value={filterAccount}
                onChange={(e) => setFilterAccount(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
              >
                <option value="SEMUA">Semua Akun</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.accountName}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Status */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
              >
                <option value="SEMUA">Semua Status</option>
                <option value="IDE">IDE</option>
                <option value="DIREKAM">DIREKAM</option>
                <option value="EDITING">EDITING</option>
                <option value="SIAP">SIAP</option>
                <option value="TERJADWAL">TERJADWAL</option>
                <option value="DIPOSTING">DIPOSTING</option>
                <option value="DIBATALKAN">DIBATALKAN</option>
              </select>
            </div>

            {/* Filter Talent */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Talent
              </label>
              <select
                value={filterTalent}
                onChange={(e) => setFilterTalent(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
              >
                <option value="SEMUA">Semua Talent</option>
                {employees.map((emp) => (
                  <option key={emp.id || emp.userId} value={emp.id || emp.userId}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Scope */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Kategori Scope
              </label>
              <select
                value={filterScope}
                onChange={(e) => setFilterScope(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
              >
                <option value="SEMUA">Semua Scope</option>
                <option value="PRIBADI">PRIBADI</option>
                <option value="SHARING">SHARING</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 4. Active Submenu Content Rendering */}
      {activeSubMenu === 'KALENDER' && (
        <ContentCalendarGrid
          items={filteredContentItems}
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          onSelectContent={(item) => setSelectedContent(item)}
          onAddNewAtDate={handleAddNewAtDate}
          viewMode={calendarViewMode}
        />
      )}

      {activeSubMenu === 'HARI_INI' && (
        <ContentTodayView
          todayItems={todayItems}
          userProfile={userProfile!}
          onSelectContent={(item) => setSelectedContent(item)}
          onAddNew={() => handleAddNewAtDate(tanggalHariIni())}
          onQuickPost={handleQuickPost}
        />
      )}

      {activeSubMenu === 'DAFTAR' && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              Daftar Semua Jadwal Konten ({filteredContentItems.length})
            </h3>
            <button
              onClick={handleExportCSV}
              className="text-xs font-bold text-orange-600 hover:underline"
            >
              Download Data
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 font-black text-slate-700 uppercase tracking-wider">
                  <th className="py-3 px-4">Tanggal & Jam</th>
                  <th className="py-3 px-4">Akun TikTok</th>
                  <th className="py-3 px-4">Produk</th>
                  <th className="py-3 px-4">Judul Konten</th>
                  <th className="py-3 px-4">Talent / Editor</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredContentItems.map((item) => (
                  <tr
                    key={item.contentId || item.id}
                    onClick={() => setSelectedContent(item)}
                    className="hover:bg-orange-50/40 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-800">
                      <div>{formatTanggal(item.date)}</div>
                      <div className="text-[11px] text-slate-500 font-mono font-bold">
                        {item.time} WIB
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-bold text-slate-900">{item.accountName}</div>
                      <div className="text-[10px] text-slate-400">{item.scope}</div>
                    </td>

                    <td className="py-3 px-4">
                      {item.productName ? (
                        <div className="font-bold text-emerald-800 line-clamp-1">
                          {item.productName}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 line-clamp-1">{item.title}</div>
                      {item.taskName && (
                        <div className="text-[10px] text-amber-700 font-medium truncate">
                          Task: {item.taskName}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="text-slate-700">T: {item.talentName || '-'}</div>
                      <div className="text-slate-500 text-[11px]">E: {item.editorName || '-'}</div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <ContentStatusBadge status={item.status} size="sm" />
                    </td>

                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedContent(item);
                        }}
                        className="rounded-lg border border-slate-300 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredContentItems.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-xs text-slate-400 italic">
                      Tidak ada konten yang ditemukan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Modals */}
      {selectedContent && (
        <ContentDetailModal
          isOpen={Boolean(selectedContent)}
          onClose={() => setSelectedContent(null)}
          content={selectedContent}
          userProfile={userProfile!}
          linkedTask={tasks.find((t) => (t.taskId || t.id) === selectedContent.taskId) || null}
          onEdit={(item) => {
            setSelectedContent(null);
            setEditingContent(item);
            setShowFormModal(true);
          }}
          onRefresh={() => {}}
        />
      )}

      {showFormModal && (
        <ContentFormModal
          isOpen={showFormModal}
          onClose={() => {
            setShowFormModal(false);
            setEditingContent(null);
          }}
          editingItem={editingContent}
          accounts={accounts}
          products={products}
          employees={employees}
          tasks={tasks}
          userProfile={userProfile!}
          onSuccess={() => {}}
          defaultDate={formDefaultDate}
        />
      )}

      {showPostingModal && postingContent && (
        <ContentPostingProofModal
          isOpen={showPostingModal}
          onClose={() => {
            setShowPostingModal(false);
            setPostingContent(null);
          }}
          content={postingContent}
          userProfile={userProfile!}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
};
