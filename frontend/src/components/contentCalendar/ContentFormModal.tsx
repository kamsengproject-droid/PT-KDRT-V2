import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  Smartphone,
  ShoppingBag,
  User,
  Scissors,
  ClipboardList,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Repeat,
  Sparkles,
  Plus,
  Share2,
  Lock,
} from 'lucide-react';
import {
  ContentCalendarItem,
  ContentStatus,
  ContentRecurringTemplate,
  ContentRecurringFrequency,
  Account,
  Product,
  Employee,
  DailyTask,
  UserProfile,
} from '../../types';
import {
  createContentItem,
  updateContentItem,
  createBatchRecurringContent,
} from '../../services/contentCalendarService';
import { tanggalHariIni, formatRupiah, formatTanggal } from '../../utils/formatters';

interface ContentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingItem: ContentCalendarItem | null;
  accounts: Account[];
  products: Product[];
  employees: Employee[];
  tasks: DailyTask[];
  userProfile: UserProfile;
  onSuccess: () => void;
  defaultDate?: string;
}

export const ContentFormModal: React.FC<ContentFormModalProps> = ({
  isOpen,
  onClose,
  editingItem,
  accounts,
  products,
  employees,
  tasks,
  userProfile,
  onSuccess,
  defaultDate,
}) => {
  const [activeTab, setActiveTab] = useState<'SINGLE' | 'RECURRING'>('SINGLE');

  // Single Item Form State
  const [date, setDate] = useState<string>(
    editingItem?.date || defaultDate || tanggalHariIni()
  );
  const [time, setTime] = useState<string>(editingItem?.time || '19:00');
  const [title, setTitle] = useState<string>(editingItem?.title || '');
  const [accountId, setAccountId] = useState<string>(editingItem?.accountId || '');
  const [productId, setProductId] = useState<string>(editingItem?.productId || '');
  const [talentId, setTalentId] = useState<string>(editingItem?.talentId || '');
  const [editorId, setEditorId] = useState<string>(editingItem?.editorId || '');
  const [taskId, setTaskId] = useState<string>(editingItem?.taskId || '');
  const [targetOutput, setTargetOutput] = useState<number>(
    editingItem?.targetOutput || 1
  );
  const [unitOutput, setUnitOutput] = useState<string>(
    editingItem?.unitOutput || 'VT'
  );
  const [status, setStatus] = useState<ContentStatus>(
    editingItem?.status || 'TERJADWAL'
  );
  const [notes, setNotes] = useState<string>(editingItem?.notes || '');

  // Recurring Template Form State
  const [recTitle, setRecTitle] = useState<string>('');
  const [recTemplateName, setRecTemplateName] = useState<string>('');
  const [recFrequency, setRecFrequency] = useState<ContentRecurringFrequency>('DAILY');
  const [recStartDate, setRecStartDate] = useState<string>(tanggalHariIni());
  const [recEndDate, setRecEndDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [recCustomDays, setRecCustomDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [recTime, setRecTime] = useState<string>('19:00');
  const [recAccountId, setRecAccountId] = useState<string>('');
  const [recProductId, setRecProductId] = useState<string>('');
  const [recTalentId, setRecTalentId] = useState<string>('');
  const [recEditorId, setRecEditorId] = useState<string>('');
  const [recTaskId, setRecTaskId] = useState<string>('');
  const [recTargetOutput, setRecTargetOutput] = useState<number>(1);
  const [recUnitOutput, setRecUnitOutput] = useState<string>('VT');
  const [recNotes, setRecNotes] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize/reset single form on open/change
  useEffect(() => {
    if (editingItem) {
      setActiveTab('SINGLE');
      setDate(editingItem.date || tanggalHariIni());
      setTime(editingItem.time || '19:00');
      setTitle(editingItem.title || '');
      setAccountId(editingItem.accountId || '');
      setProductId(editingItem.productId || '');
      setTalentId(editingItem.talentId || '');
      setEditorId(editingItem.editorId || '');
      setTaskId(editingItem.taskId || '');
      setTargetOutput(editingItem.targetOutput || 1);
      setUnitOutput(editingItem.unitOutput || 'VT');
      setStatus(editingItem.status || 'TERJADWAL');
      setNotes(editingItem.notes || '');
    } else {
      setDate(defaultDate || tanggalHariIni());
      setTime('19:00');
      setTitle('');
      setAccountId(accounts.length > 0 ? accounts[0].id || '' : '');
      setProductId('');
      setTalentId('');
      setEditorId('');
      setTaskId('');
      setTargetOutput(1);
      setUnitOutput('VT');
      setStatus('TERJADWAL');
      setNotes('');
      setRecAccountId(accounts.length > 0 ? accounts[0].id || '' : '');
    }
  }, [editingItem, isOpen, accounts, defaultDate]);

  if (!isOpen) return null;

  // Selected details lookup
  const selectedAccount = accounts.find((a) => a.id === accountId);
  const selectedProduct = products.find((p) => (p.productId || p.id) === productId);
  const selectedTalent = employees.find((e) => (e.id || e.userId) === talentId);
  const selectedEditor = employees.find((e) => (e.id || e.userId) === editorId);
  const selectedTask = tasks.find((t) => (t.taskId || t.id) === taskId);

  // Filter tasks if talent/editor or account is selected
  const availableTasks = tasks.filter((t) => {
    if (t.status === 'SELESAI' || t.status === 'DIBATALKAN') return false;
    if (talentId && t.employeeId && t.employeeId !== talentId) return false;
    return true;
  });

  const handleToggleCustomDay = (day: number) => {
    setRecCustomDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage('Judul / Nama Konten wajib diisi.');
      return;
    }
    if (!accountId) {
      setErrorMessage('Pilih akun TikTok tujuan.');
      return;
    }

    try {
      setIsSubmitting(true);
      const acc = accounts.find((a) => a.id === accountId);

      const payload = {
        title: title.trim(),
        date,
        time,
        accountId,
        accountName: acc?.accountName || 'TikTok',
        accountUsername: acc?.username || '',
        scope: acc?.scope || 'PRIBADI',
        productId: productId || undefined,
        productName: selectedProduct?.productName || undefined,
        productImage: selectedProduct?.productImage || selectedProduct?.photoUrl || undefined,
        productPrice: selectedProduct?.productPrice || undefined,
        productUrl: selectedProduct?.productUrl || undefined,
        talentId: talentId || undefined,
        talentName: selectedTalent?.name || undefined,
        editorId: editorId || undefined,
        editorName: selectedEditor?.name || undefined,
        taskId: taskId || undefined,
        taskName: selectedTask?.taskName || undefined,
        targetOutput: Number(targetOutput) || 1,
        unitOutput: unitOutput || 'VT',
        status,
        notes: notes.trim(),
      };

      if (editingItem) {
        await updateContentItem(
          editingItem.contentId || editingItem.id!,
          editingItem,
          payload,
          userProfile
        );
      } else {
        await createContentItem(payload as any, userProfile);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Gagal menyimpan data jadwal konten.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecurringSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!recTitle.trim()) {
      setErrorMessage('Judul Konten Berulang wajib diisi.');
      return;
    }
    if (!recAccountId) {
      setErrorMessage('Pilih akun TikTok untuk jadwal berulang.');
      return;
    }
    if (!recStartDate || !recEndDate || recStartDate > recEndDate) {
      setErrorMessage('Rentang tanggal jadwal berulang tidak valid.');
      return;
    }

    try {
      setIsSubmitting(true);
      const acc = accounts.find((a) => a.id === recAccountId);
      const prod = products.find((p) => (p.productId || p.id) === recProductId);
      const tal = employees.find((e) => (e.id || e.userId) === recTalentId);
      const edi = employees.find((e) => (e.id || e.userId) === recEditorId);
      const tsk = tasks.find((t) => (t.taskId || t.id) === recTaskId);

      const template: ContentRecurringTemplate = {
        templateName: recTemplateName.trim() || recTitle.trim(),
        title: recTitle.trim(),
        frequency: recFrequency,
        customDays: recFrequency === 'CUSTOM_DAYS' ? recCustomDays : undefined,
        time: recTime,
        accountId: recAccountId,
        accountName: acc?.accountName || 'TikTok',
        scope: acc?.scope || 'PRIBADI',
        productId: recProductId || undefined,
        productName: prod?.productName || undefined,
        productImage: prod?.productImage || prod?.photoUrl || undefined,
        productPrice: prod?.productPrice || undefined,
        productUrl: prod?.productUrl || undefined,
        talentId: recTalentId || undefined,
        talentName: tal?.name || undefined,
        editorId: recEditorId || undefined,
        editorName: edi?.name || undefined,
        taskId: recTaskId || undefined,
        taskName: tsk?.taskName || undefined,
        targetOutput: Number(recTargetOutput) || 1,
        unitOutput: recUnitOutput || 'VT',
        notes: recNotes.trim(),
        active: true,
        createdBy: userProfile.uid,
        createdByName: userProfile.name,
      };

      const createdCount = await createBatchRecurringContent(
        template,
        recStartDate,
        recEndDate,
        userProfile
      );

      alert(`Berhasil membuat ${createdCount} rekaman jadwal konten pada rentang ${formatTanggal(recStartDate)} s/d ${formatTanggal(recEndDate)}.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Gagal membuat jadwal konten berulang.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const dayLabels = [
    { num: 1, label: 'Sen' },
    { num: 2, label: 'Sel' },
    { num: 3, label: 'Rab' },
    { num: 4, label: 'Kam' },
    { num: 5, label: 'Jum' },
    { num: 6, label: 'Sab' },
    { num: 7, label: 'Min' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl max-h-[92vh] rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50 shrink-0">
          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight">
              {editingItem ? 'Edit Jadwal Konten' : 'Jadwal Konten Baru'}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Hubungkan Akun TikTok, Produk, Talent, Editor & Kerjaan Harian
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selection (Single vs Recurring) */}
        {!editingItem && (
          <div className="flex border-b border-slate-200 px-6 bg-slate-100/60 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('SINGLE')}
              className={`py-3 px-4 text-xs font-black border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'SINGLE'
                  ? 'border-orange-600 text-orange-700 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Konten Tunggal</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('RECURRING')}
              className={`py-3 px-4 text-xs font-black border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'RECURRING'
                  ? 'border-orange-600 text-orange-700 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Repeat className="h-3.5 w-3.5" />
              <span>Jadwal Berulang (Batch Generator)</span>
            </button>
          </div>
        )}

        {/* Form Container */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {activeTab === 'SINGLE' ? (
            /* ================= SINGLE FORM ================= */
            <form id="singleContentForm" onSubmit={handleSingleSubmit} className="space-y-4">
              {/* Row 1: Tanggal & Jam */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Tanggal Posting <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Jam Posting WIB <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                </div>
              </div>

              {/* Row 2: Judul Konten */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Judul / Nama Konten <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Review Skincare Serum Sebelum & Sesudah"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                />
              </div>

              {/* Row 3: Akun TikTok & Produk */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Akun TikTok <span className="text-rose-500">*</span></span>
                    {selectedAccount && (
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                          selectedAccount.scope === 'SHARING'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {selectedAccount.scope === 'SHARING' ? <Share2 className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
                        {selectedAccount.scope}
                      </span>
                    )}
                  </label>
                  <select
                    required
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  >
                    <option value="" disabled>-- Pilih Akun TikTok --</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.accountName} ({acc.scope})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Produk Promosi (Opsional)
                  </label>
                  <select
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  >
                    <option value="">-- Tanpa Produk Spesifik --</option>
                    {products.map((prod) => (
                      <option key={prod.productId || prod.id} value={prod.productId || prod.id}>
                        {prod.productName} ({prod.category || 'Umum'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Product Preview Card if Selected */}
              {selectedProduct && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center gap-3">
                  {selectedProduct.productImage || selectedProduct.photoUrl ? (
                    <img
                      src={selectedProduct.productImage || selectedProduct.photoUrl}
                      alt={selectedProduct.productName}
                      className="h-10 w-10 rounded-lg object-cover border border-slate-200 bg-white shrink-0"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                      <ShoppingBag className="h-5 w-5" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 text-xs">
                    <div className="font-bold text-slate-800 truncate">{selectedProduct.productName}</div>
                    <div className="text-emerald-700 font-bold">
                      {formatRupiah(selectedProduct.productPrice)} • Komisi: {selectedProduct.commissionRate}%
                    </div>
                  </div>
                </div>
              )}

              {/* Row 4: Talent & Editor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Talent
                  </label>
                  <select
                    value={talentId}
                    onChange={(e) => setTalentId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  >
                    <option value="">-- Pilih Talent --</option>
                    {employees.map((emp) => (
                      <option key={emp.id || emp.userId} value={emp.id || emp.userId}>
                        {emp.name} ({emp.position})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Editor
                  </label>
                  <select
                    value={editorId}
                    onChange={(e) => setEditorId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  >
                    <option value="">-- Pilih Editor --</option>
                    {employees.map((emp) => (
                      <option key={emp.id || emp.userId} value={emp.id || emp.userId}>
                        {emp.name} ({emp.position})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 5: Relasi Daily Task & Target Output */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Kerjaan Harian / Task (Phase 3A)
                  </label>
                  <select
                    value={taskId}
                    onChange={(e) => setTaskId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  >
                    <option value="">-- Tidak Terhubung Task --</option>
                    {availableTasks.map((t) => (
                      <option key={t.taskId || t.id} value={t.taskId || t.id}>
                        {t.taskName} ({t.employeeName} - Target: {t.targetOutput} {t.unitOutput})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Target Output
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={targetOutput}
                      onChange={(e) => setTargetOutput(Number(e.target.value) || 1)}
                      className="w-20 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    />
                    <input
                      type="text"
                      value={unitOutput}
                      onChange={(e) => setUnitOutput(e.target.value.toUpperCase())}
                      placeholder="VT"
                      className="w-16 rounded-xl border border-slate-300 px-2 py-2 text-sm text-slate-800 uppercase focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    />
                  </div>
                </div>
              </div>

              {/* Row 6: Status Awal */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Status Konten
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {(['IDE', 'DIREKAM', 'EDITING', 'SIAP', 'TERJADWAL', 'DIPOSTING'] as ContentStatus[]).map(
                    (st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStatus(st)}
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                          status === st
                            ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {st}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Row 7: Catatan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Catatan / Brief
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Instruksi angle video, hook 3 detik pertama, sound trending, dll..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100 resize-none"
                />
              </div>
            </form>
          ) : (
            /* ================= RECURRING BATCH FORM ================= */
            <form id="recurringContentForm" onSubmit={handleRecurringSubmit} className="space-y-4">
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Generator Jadwal Berulang Otomatis</span>: Sistem akan membuat rekaman jadwal konten mandiri per tanggal dalam rentang yang dipilih tanpa membuat data ganda.
                </div>
              </div>

              {/* Judul & Template Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Nama Template / Format <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={recTemplateName}
                    onChange={(e) => setRecTemplateName(e.target.value)}
                    placeholder="Contoh: Routine VT Pagi Jam 19:00"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Pola Judul Konten <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={recTitle}
                    onChange={(e) => setRecTitle(e.target.value)}
                    placeholder="Contoh: Video Harian Promosi"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                </div>
              </div>

              {/* Frekuensi & Hari */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Frekuensi Pengulangan
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'DAILY', label: 'Setiap Hari' },
                    { id: 'MON_SAT', label: 'Senin - Sabtu' },
                    { id: 'WEEKLY', label: 'Mingguan' },
                    { id: 'CUSTOM_DAYS', label: 'Hari Tertentu' },
                  ].map((freq) => (
                    <button
                      key={freq.id}
                      type="button"
                      onClick={() => setRecFrequency(freq.id as ContentRecurringFrequency)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                        recFrequency === freq.id
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {freq.label}
                    </button>
                  ))}
                </div>

                {recFrequency === 'CUSTOM_DAYS' && (
                  <div className="flex items-center gap-1.5 pt-2">
                    {dayLabels.map((d) => {
                      const isSelected = recCustomDays.includes(d.num);
                      return (
                        <button
                          key={d.num}
                          type="button"
                          onClick={() => handleToggleCustomDay(d.num)}
                          className={`h-9 w-9 rounded-xl font-bold text-xs transition-colors border ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Rentang Tanggal & Jam */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Dari Tanggal <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={recStartDate}
                    onChange={(e) => setRecStartDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Sampai Tanggal <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={recEndDate}
                    onChange={(e) => setRecEndDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Jam Posting WIB <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={recTime}
                    onChange={(e) => setRecTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                </div>
              </div>

              {/* Akun & Produk */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Akun TikTok <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={recAccountId}
                    onChange={(e) => setRecAccountId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  >
                    <option value="" disabled>-- Pilih Akun TikTok --</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.accountName} ({acc.scope})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Produk Promosi (Opsional)
                  </label>
                  <select
                    value={recProductId}
                    onChange={(e) => setRecProductId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  >
                    <option value="">-- Tanpa Produk Spesifik --</option>
                    {products.map((prod) => (
                      <option key={prod.productId || prod.id} value={prod.productId || prod.id}>
                        {prod.productName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Talent & Editor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Talent
                  </label>
                  <select
                    value={recTalentId}
                    onChange={(e) => setRecTalentId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  >
                    <option value="">-- Pilih Talent --</option>
                    {employees.map((emp) => (
                      <option key={emp.id || emp.userId} value={emp.id || emp.userId}>
                        {emp.name} ({emp.position})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Editor
                  </label>
                  <select
                    value={recEditorId}
                    onChange={(e) => setRecEditorId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  >
                    <option value="">-- Pilih Editor --</option>
                    {employees.map((emp) => (
                      <option key={emp.id || emp.userId} value={emp.id || emp.userId}>
                        {emp.name} ({emp.position})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 shrink-0 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            form={activeTab === 'SINGLE' ? 'singleContentForm' : 'recurringContentForm'}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-orange-700 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>{editingItem ? 'Simpan Perubahan' : activeTab === 'SINGLE' ? 'Jadwalkan Konten' : 'Generate Jadwal Berulang'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
