import React, { useState } from 'react';
import {
  X,
  Plus,
  Sparkles,
  Repeat,
} from 'lucide-react';
import {
  DailyTask,
  DailyTaskStatus,
  Employee,
  Account,
  TaskTemplate,
  RecurringScheduleType,
} from '../../types';
import { tanggalHariIni } from '../../utils/formatters';

interface TaskFormModalProps {
  initialTask?: DailyTask | null;
  employees: Employee[];
  accounts: Account[];
  templates: TaskTemplate[];
  selectedDate: string;
  onClose: () => void;
  onSave: (
    taskData: Omit<DailyTask, 'id' | 'taskId' | 'createdAt' | 'updatedAt'>,
    isEdit: boolean
  ) => Promise<void>;
}

export const TaskFormModal: React.FC<TaskFormModalProps> = ({
  initialTask,
  employees,
  accounts,
  templates,
  selectedDate,
  onClose,
  onSave,
}) => {
  const isEdit = Boolean(initialTask?.id);

  const [tanggal, setTanggal] = useState<string>(
    initialTask?.tanggal || selectedDate || tanggalHariIni()
  );
  const [employeeId, setEmployeeId] = useState<string>(
    initialTask?.employeeId || (employees[0]?.id || '')
  );
  const [taskName, setTaskName] = useState<string>(initialTask?.taskName || '');
  const [accountId, setAccountId] = useState<string>(initialTask?.accountId || '');
  const [unitOutput, setUnitOutput] = useState<string>(initialTask?.unitOutput || 'TAKE VIDEO');
  const [targetOutput, setTargetOutput] = useState<number>(initialTask?.targetOutput || 10);
  const [currentOutput, setCurrentOutput] = useState<number>(initialTask?.currentOutput || 0);
  const [status, setStatus] = useState<DailyTaskStatus>(
    initialTask?.status || 'BELUM DIKERJAKAN'
  );
  const [notes, setNotes] = useState<string>(initialTask?.notes || '');
  const [isRecurring, setIsRecurring] = useState<boolean>(
    Boolean(initialTask?.isRecurring)
  );
  const [recurringFrequency, setRecurringFrequency] = useState<RecurringScheduleType>(
    initialTask?.recurringFrequency || 'DAILY'
  );

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Handle template selection
  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;

    const tpl = templates.find((t) => t.id === templateId);
    if (tpl) {
      setTaskName(tpl.templateName);
      setTargetOutput(tpl.defaultTargetOutput);
      setUnitOutput(tpl.unitOutput || 'TAKE VIDEO');
      if (tpl.accountId) setAccountId(tpl.accountId);
      if (tpl.description && !notes) setNotes(tpl.description);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!taskName.trim()) {
      setErrorMsg('Nama pekerjaan / tugas wajib diisi.');
      return;
    }
    if (!employeeId) {
      setErrorMsg('Pilih karyawan penanggung jawab.');
      return;
    }

    const selectedEmployee = employees.find((emp) => emp.id === employeeId);
    const selectedAccount = accounts.find((acc) => acc.id === accountId);

    setIsSubmitting(true);
    try {
      const payload: any = {
        tanggal: tanggal || tanggalHariIni(),
        employeeId,
        employeeName: selectedEmployee?.name || 'Karyawan',
        taskName: taskName.trim(),
        targetOutput: Number(targetOutput) || 1,
        currentOutput: Number(currentOutput) || 0,
        unitOutput: unitOutput || 'TAKE VIDEO',
        status,
        notes: notes.trim(),
        isRecurring,
        createdBy: initialTask?.createdBy || '',
      };

      if (accountId) {
        payload.accountId = accountId;
      }
      if (selectedAccount?.accountName) {
        payload.accountName = selectedAccount.accountName;
      }
      if (isRecurring) {
        payload.recurringFrequency = recurringFrequency;
      }
      if (selectedTemplateId) {
        payload.templateId = selectedTemplateId;
      }

      await onSave(payload, isEdit);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan tugas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
          <div>
            <h3 className="text-lg font-black text-slate-900">
              {isEdit ? 'Ubah Rincian Pekerjaan' : 'Tambah Pekerjaan Harian'}
            </h3>
            <p className="text-xs text-slate-500">
              {isEdit
                ? 'Perbarui target atau rincian pekerjaan karyawan'
                : 'Tugaskan pekerjaan dan target produksi harian'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-800 border border-rose-200">
            {errorMsg}
          </div>
        )}

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-1 mt-4 space-y-4">
          {/* Quick Template Picker (Only for new tasks) */}
          {!isEdit && templates.length > 0 && (
            <div className="rounded-2xl bg-orange-50/60 p-3.5 border border-orange-200 space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-bold text-orange-950">
                <Sparkles className="h-3.5 w-3.5 text-orange-600" />
                Pilih Dari Template Tugas (Opsional):
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleSelectTemplate(e.target.value)}
                className="w-full rounded-xl border border-orange-300 bg-white p-2 text-xs font-semibold text-slate-800 focus:border-orange-500 focus:outline-none"
              >
                <option value="">-- Pilih Template Tersimpan --</option>
                {templates
                  .filter((t) => t.active)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.templateName} ({t.targetRole} - Target: {t.defaultTargetOutput} {t.unitOutput})
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Tanggal & Karyawan Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tanggal Pekerjaan <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold text-slate-900 focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Karyawan Penanggung Jawab <span className="text-rose-500">*</span>
              </label>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold text-slate-900 focus:border-orange-500 focus:outline-none"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.position || 'Karyawan'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Nama Pekerjaan */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nama Pekerjaan / Tugas <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Contoh: TAKE VIDEO NISA GROSIR88, Edit VT Mainan"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold text-slate-900 focus:border-orange-500 focus:outline-none"
            />
          </div>

          {/* Terkait Akun TikTok */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Terkait Akun TikTok (Opsional)
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold text-slate-900 focus:border-orange-500 focus:outline-none"
            >
              <option value="">-- Umum / Tanpa Akun Khusus --</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.accountName} ({acc.scope})
                </option>
              ))}
            </select>
          </div>

          {/* TUGAS HARIAN & Target Output */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                TUGAS HARIAN <span className="text-rose-500">*</span>
              </label>
              <select
                value={unitOutput}
                onChange={(e) => setUnitOutput(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold text-slate-900 focus:border-orange-500 focus:outline-none"
              >
                <option value="TAKE VIDEO">TAKE VIDEO</option>
                <option value="EDIT VIDEO">EDIT VIDEO</option>
                <option value="UPLOAD VIDEO">UPLOAD VIDEO</option>
                <option value="TUGAS LAINNYA">TUGAS LAINNYA</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Target Output ({unitOutput === 'TAKE VIDEO' || unitOutput === 'EDIT VIDEO' || unitOutput === 'UPLOAD VIDEO' ? 'Jumlah Video' : 'Jumlah Target'}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                value={targetOutput}
                onChange={(e) => setTargetOutput(Math.max(1, Number(e.target.value)))}
                required
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-black text-slate-900 focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Status & Output saat ini (If editing) */}
          {isEdit && (
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Status Pekerjaan
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as DailyTaskStatus)}
                  className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs font-bold text-slate-900"
                >
                  <option value="BELUM DIKERJAKAN">BELUM DIKERJAKAN</option>
                  <option value="SEDANG DIKERJAKAN">SEDANG DIKERJAKAN</option>
                  <option value="SELESAI">SELESAI</option>
                  <option value="TERTUNDA">TERTUNDA</option>
                  <option value="DIBATALKAN">DIBATALKAN</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Output Saat Ini
                </label>
                <input
                  type="number"
                  min={0}
                  value={currentOutput}
                  onChange={(e) => setCurrentOutput(Math.max(0, Number(e.target.value)))}
                  className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs font-bold text-slate-900"
                />
              </div>
            </div>
          )}

          {/* Catatan & Instruksi Khusus */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Catatan & Instruksi (Opsional)
            </label>
            <textarea
              rows={2}
              placeholder="Tambahkan instruksi kerja, deskripsi, atau arahan khusus..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-orange-500 focus:outline-none"
            />
          </div>

          {/* Opsi Tugas Rutin */}
          <div className="rounded-2xl border border-slate-200 p-3.5 bg-slate-50 space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="h-4 w-4 rounded-sm border-slate-300 text-orange-600 focus:ring-orange-500"
              />
              <Repeat className="h-3.5 w-3.5 text-slate-600" />
              Tandai sebagai Tugas Rutin Harian
            </label>

            {isRecurring && (
              <div className="pt-1 pl-6">
                <select
                  value={recurringFrequency}
                  onChange={(e) => setRecurringFrequency(e.target.value as RecurringScheduleType)}
                  className="rounded-xl border border-slate-300 bg-white p-2 text-xs font-semibold text-slate-800"
                >
                  <option value="DAILY">Setiap Hari (Senin - Minggu)</option>
                  <option value="MON_SAT">Senin - Sabtu (Hari Kerja)</option>
                  <option value="MON_FRI">Senin - Jumat</option>
                  <option value="WEEKLY">Mingguan</option>
                </select>
              </div>
            )}
          </div>

          {/* Form Actions Footer */}
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-orange-600 px-6 py-2.5 text-xs font-black text-white hover:bg-orange-500 shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                'Menyimpan...'
              ) : isEdit ? (
                'Simpan Perubahan'
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Tambah Pekerjaan
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
