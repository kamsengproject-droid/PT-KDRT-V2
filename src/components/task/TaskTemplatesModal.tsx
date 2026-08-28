import React, { useState } from 'react';
import {
  X,
  Plus,
  Sparkles,
  Trash2,
  Edit2,
  CheckCircle2,
  FileSpreadsheet,
  Check,
  RefreshCw,
} from 'lucide-react';
import { TaskTemplate, DailyTaskPriority, UserRole } from '../../types';
import {
  createTaskTemplate,
  updateTaskTemplate,
  deleteTaskTemplate,
  seedDefaultTaskTemplates,
} from '../../services/taskService';

interface TaskTemplatesModalProps {
  templates: TaskTemplate[];
  role: UserRole;
  currentUserId?: string;
  currentUserName?: string;
  onClose: () => void;
}

export const TaskTemplatesModal: React.FC<TaskTemplatesModalProps> = ({
  templates,
  role,
  currentUserId = '',
  currentUserName = '',
  onClose,
}) => {
  const isOwner = role === 'OWNER';

  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  // Form states
  const [templateName, setTemplateName] = useState<string>('');
  const [targetRole, setTargetRole] = useState<string>('Editor');
  const [description, setDescription] = useState<string>('');
  const [defaultTargetOutput, setDefaultTargetOutput] = useState<number>(10);
  const [unitOutput, setUnitOutput] = useState<string>('VIDEO');
  const [estimatedDuration, setEstimatedDuration] = useState<string>('2 jam');
  const [defaultPriority, setDefaultPriority] = useState<DailyTaskPriority>('NORMAL');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const resetForm = () => {
    setTemplateName('');
    setTargetRole('Editor');
    setDescription('');
    setDefaultTargetOutput(10);
    setUnitOutput('VIDEO');
    setEstimatedDuration('2 jam');
    setDefaultPriority('NORMAL');
    setIsAddingNew(false);
    setEditingTemplateId(null);
  };

  const handleEditClick = (tpl: TaskTemplate) => {
    setEditingTemplateId(tpl.id || null);
    setTemplateName(tpl.templateName);
    setTargetRole(tpl.targetRole);
    setDescription(tpl.description || '');
    setDefaultTargetOutput(tpl.defaultTargetOutput);
    setUnitOutput(tpl.unitOutput);
    setEstimatedDuration(tpl.estimatedDuration || '2 jam');
    setDefaultPriority(tpl.defaultPriority);
    setIsAddingNew(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingTemplateId) {
        await updateTaskTemplate(
          editingTemplateId,
          {
            templateName: templateName.trim(),
            targetRole,
            description: description.trim(),
            defaultTargetOutput: Number(defaultTargetOutput) || 1,
            unitOutput,
            estimatedDuration,
            defaultPriority,
          },
          currentUserId,
          currentUserName
        );
      } else {
        await createTaskTemplate(
          {
            templateName: templateName.trim(),
            targetRole,
            description: description.trim(),
            defaultTargetOutput: Number(defaultTargetOutput) || 1,
            unitOutput,
            estimatedDuration,
            defaultPriority,
            active: true,
          },
          currentUserId,
          currentUserName
        );
      }
      resetForm();
    } catch (err: any) {
      alert('Gagal menyimpan template: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (tpl: TaskTemplate) => {
    if (!tpl.id) return;
    if (window.confirm(`Hapus template "${tpl.templateName}"?`)) {
      try {
        await deleteTaskTemplate(tpl.id, tpl.templateName, currentUserId, currentUserName);
      } catch (err: any) {
        alert('Gagal menghapus template: ' + err.message);
      }
    }
  };

  const handleSeedDefaults = async () => {
    setIsSubmitting(true);
    try {
      const seededCount = await seedDefaultTaskTemplates(currentUserId, currentUserName);
      alert(`Berhasil menambahkan ${seededCount} template tugas standar.`);
    } catch (err: any) {
      alert('Gagal memuat template standar: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
          <div>
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-orange-600" />
              Kelola Template Pekerjaan Harian
            </h3>
            <p className="text-xs text-slate-500">
              Daftar template tugas siap pakai untuk mempercepat penugasan harian
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto pr-1 mt-4 space-y-4">
          {/* Action Bar */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-600">
              Total: {templates.length} Template
            </span>

            {isOwner && (
              <div className="flex items-center gap-2">
                {templates.length === 0 && (
                  <button
                    onClick={handleSeedDefaults}
                    disabled={isSubmitting}
                    className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700 hover:bg-orange-100 flex items-center gap-1"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Muat Template Standar
                  </button>
                )}
                {!isAddingNew && (
                  <button
                    onClick={() => setIsAddingNew(true)}
                    className="rounded-xl bg-orange-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-orange-500 flex items-center gap-1 shadow-2xs"
                  >
                    <Plus className="h-3.5 w-3.5" /> Tambah Template
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Form Add / Edit */}
          {isAddingNew && (
            <form
              onSubmit={handleSave}
              className="rounded-2xl border-2 border-orange-200 bg-orange-50/40 p-4 space-y-3"
            >
              <h4 className="text-xs font-black uppercase tracking-wider text-orange-950">
                {editingTemplateId ? 'Edit Template' : 'Buat Template Baru'}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Nama Template <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Misal: Edit Video, NISA GROSIR88"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Target Jabatan / Divisi
                  </label>
                  <select
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-900"
                  >
                    <option value="Editor">Editor</option>
                    <option value="Talent">Talent</option>
                    <option value="Admin">Admin</option>
                    <option value="Semua Karyawan">Semua Karyawan</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Default Target
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={defaultTargetOutput}
                    onChange={(e) => setDefaultTargetOutput(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Satuan Output
                  </label>
                  <select
                    value={unitOutput}
                    onChange={(e) => setUnitOutput(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-900"
                  >
                    <option value="VT">VT</option>
                    <option value="VIDEO">VIDEO</option>
                    <option value="POSTING">POSTING</option>
                    <option value="COVER">COVER</option>
                    <option value="PRODUK">PRODUK</option>
                    <option value="KONTEN">KONTEN</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Estimasi Waktu
                  </label>
                  <input
                    type="text"
                    placeholder="Misal: 2 jam"
                    value={estimatedDuration}
                    onChange={(e) => setEstimatedDuration(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Deskripsi / Petunjuk Template
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detail instruksi pekerjaan template ini..."
                  className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-orange-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-orange-500"
                >
                  {editingTemplateId ? 'Simpan Perubahan' : 'Buat Template'}
                </button>
              </div>
            </form>
          )}

          {/* List of Templates */}
          <div className="space-y-2">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3.5 flex items-center justify-between gap-3 hover:border-slate-300 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h5 className="text-sm font-black text-slate-900">{tpl.templateName}</h5>
                    <span className="rounded-md bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                      {tpl.targetRole}
                    </span>
                    <span className="rounded-md bg-orange-100 text-orange-800 px-2 py-0.5 text-[10px] font-extrabold">
                      Target: {tpl.defaultTargetOutput} {tpl.unitOutput}
                    </span>
                  </div>
                  {tpl.description && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">{tpl.description}</p>
                  )}
                </div>

                {isOwner && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleEditClick(tpl)}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-slate-800 transition-colors"
                      title="Edit Template"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(tpl)}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                      title="Hapus Template"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
