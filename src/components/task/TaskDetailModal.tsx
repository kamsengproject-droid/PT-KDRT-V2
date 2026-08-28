import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  Clock,
  Play,
  Pause,
  XCircle,
  Paperclip,
  Upload,
  Link2,
  AlertCircle,
  Calendar,
  User,
  Flame,
  FileText,
  Trash2,
  Edit2,
  ShieldAlert,
  ExternalLink,
} from 'lucide-react';
import { DailyTask, UserRole, DailyTaskStatus } from '../../types';
import {
  formatTanggalWaktu,
  formatJamWIB,
  formatDurasiTimestamp,
  formatTanggal,
} from '../../utils/formatters';
import { uploadTaskProofFile, saveTaskProofLink } from '../../services/taskService';

interface TaskDetailModalProps {
  task: DailyTask | null;
  role: UserRole;
  currentUserId?: string;
  currentUserName?: string;
  onClose: () => void;
  onStart: (task: DailyTask) => void;
  onComplete: (task: DailyTask) => void;
  onUpdateOutput: (task: DailyTask) => void;
  onPause: (task: DailyTask, reason?: string) => void;
  onCancel: (task: DailyTask, reason?: string) => void;
  onOverrideStatus?: (task: DailyTask, newStatus: DailyTaskStatus) => void;
  onEdit?: (task: DailyTask) => void;
  onDelete?: (task: DailyTask) => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  role,
  currentUserId = '',
  currentUserName = '',
  onClose,
  onStart,
  onComplete,
  onUpdateOutput,
  onPause,
  onCancel,
  onOverrideStatus,
  onEdit,
  onDelete,
}) => {
  if (!task) return null;

  const isOwner = role === 'OWNER';
  const isManager = role === 'MANAGER';

  const isBelum = task.status === 'BELUM DIKERJAKAN';
  const isSedang = task.status === 'SEDANG DIKERJAKAN';
  const isSelesai = task.status === 'SELESAI';
  const isTertunda = task.status === 'TERTUNDA';
  const isBatal = task.status === 'DIBATALKAN';

  const target = task.targetOutput || 1;
  const current = task.currentOutput || 0;
  const percent = Math.min(100, Math.round((current / target) * 100));
  const isTargetAchieved = current >= target;

  const durationStr = formatDurasiTimestamp(task.startedAt, task.completedAt);

  // File upload state
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofLinkInput, setProofLinkInput] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<string>('');

  // Pause / Cancel reason state
  const [showReasonInput, setShowReasonInput] = useState<'PAUSE' | 'CANCEL' | null>(null);
  const [reasonText, setReasonText] = useState<string>('');

  // Override status state
  const [overrideStatus, setOverrideStatus] = useState<DailyTaskStatus>(task.status);
  const [showOverride, setShowOverride] = useState<boolean>(false);

  const handleUploadFile = async () => {
    if (!proofFile || !task.id) return;
    setIsUploading(true);
    try {
      await uploadTaskProofFile(task.id, proofFile, currentUserId);
      setUploadSuccess('File bukti pekerjaan berhasil diunggah!');
      setProofFile(null);
    } catch (err: any) {
      alert('Gagal mengunggah file: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveLink = async () => {
    if (!proofLinkInput.trim() || !task.id) return;
    setIsUploading(true);
    try {
      await saveTaskProofLink(task.id, proofLinkInput.trim(), currentUserId, currentUserName);
      setUploadSuccess('Link bukti pekerjaan berhasil disimpan!');
      setProofLinkInput('');
    } catch (err: any) {
      alert('Gagal menyimpan link: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 my-8 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-md">
                Detail Kerjaan Harian
              </span>
              {task.priority === 'MENDESAK' && (
                <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-800 border border-rose-200">
                  <Flame className="h-3 w-3 text-rose-600" />
                  Mendesak
                </span>
              )}
            </div>
            <h3 className="text-xl font-black text-slate-900 mt-1">{task.taskName}</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Penanggung Jawab: <strong className="text-slate-800">{task.employeeName}</strong> • {formatTanggal(task.tanggal)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto pr-1 mt-4 space-y-5">
          {/* Output Progress Big Card */}
          <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Capaian Target</span>
                <div className="text-2xl font-black text-slate-900 mt-0.5">
                  {current} / {target} <span className="text-sm font-bold text-slate-500">{task.unitOutput}</span>
                </div>
              </div>
              <div className="text-right">
                <span
                  className={`inline-block font-black text-xs px-3 py-1 rounded-full ${
                    isTargetAchieved
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : isSedang
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {isTargetAchieved ? '✓ Target Tercapai' : `${percent}% Selesai`}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden mt-3">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  isTargetAchieved
                    ? 'bg-emerald-500'
                    : isSedang
                    ? 'bg-amber-500'
                    : 'bg-slate-400'
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>

            {/* Incomplete Warning */}
            {isSelesai && !isTargetAchieved && (
              <div className="mt-3 rounded-xl bg-amber-50 p-2.5 border border-amber-200 text-xs text-amber-800 font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Pekerjaan telah ditandai selesai namun belum memenuhi target output ({current}/{target} {task.unitOutput}).</span>
              </div>
            )}
          </div>

          {/* Timeline & Execution Timestamps */}
          <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-orange-600" />
              Linimasa & Jejak Waktu Pekerjaan
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">1. Dibuat</span>
                <span className="font-bold text-slate-800">{formatTanggalWaktu(task.createdAt)}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Oleh: {task.createdByName || 'Sistem'}</span>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">2. Mulai Dikerjakan</span>
                <span className="font-bold text-slate-800">
                  {task.startedAt ? formatTanggalWaktu(task.startedAt) : '- Belum Mulai -'}
                </span>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">3. Selesai</span>
                <span className="font-bold text-slate-800">
                  {task.completedAt ? formatTanggalWaktu(task.completedAt) : '- Belum Selesai -'}
                </span>
                {task.startedAt && (
                  <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
                    Durasi: {durationStr}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Notes & Account Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="rounded-2xl border border-slate-200 p-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Akun Terkait</span>
              <span className="font-extrabold text-sm text-slate-900 mt-1 block">
                {task.accountName || 'Umum (Tidak terikat akun khusus)'}
              </span>
              {task.deadline && (
                <div className="mt-2 text-slate-600">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Batas Waktu</span>
                  <span className="font-bold text-orange-700">{task.deadline}</span>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Instruksi / Catatan</span>
              <p className="font-medium text-slate-800 mt-1 whitespace-pre-wrap">
                {task.notes || 'Tidak ada catatan tambahan.'}
              </p>
            </div>
          </div>

          {/* Bukti Pekerjaan (Attachments & Proof Links) */}
          <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Paperclip className="h-3.5 w-3.5 text-orange-600" />
              Bukti Hasil Pekerjaan & Dokumen
            </h4>

            {uploadSuccess && (
              <div className="rounded-xl bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
                {uploadSuccess}
              </div>
            )}

            {/* Current Proof Preview if exists */}
            {(task.attachmentUrl || task.proofLink) && (
              <div className="rounded-xl bg-blue-50/70 p-3 border border-blue-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600 shrink-0" />
                  <div>
                    <span className="font-bold text-blue-950 block">Bukti Pekerjaan Tersedia:</span>
                    <a
                      href={task.attachmentUrl || task.proofLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-700 hover:underline font-semibold flex items-center gap-1 mt-0.5 truncate max-w-sm"
                    >
                      Buka Tautan / File Bukti <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Upload File / Link Forms */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {/* Upload File */}
              <div className="rounded-xl border border-dashed border-slate-300 p-3 bg-slate-50/50 space-y-2">
                <label className="text-xs font-bold text-slate-700 block flex items-center gap-1">
                  <Upload className="h-3.5 w-3.5" /> Upload File Bukti
                </label>
                <input
                  type="file"
                  onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                  className="w-full text-[11px] text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-orange-100 file:text-orange-800 hover:file:bg-orange-200"
                />
                {proofFile && (
                  <button
                    onClick={handleUploadFile}
                    disabled={isUploading}
                    className="w-full rounded-xl bg-orange-600 py-1.5 text-xs font-bold text-white hover:bg-orange-500 disabled:opacity-50"
                  >
                    {isUploading ? 'Mengunggah...' : 'Unggah File'}
                  </button>
                )}
              </div>

              {/* Input Link */}
              <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/50 space-y-2">
                <label className="text-xs font-bold text-slate-700 block flex items-center gap-1">
                  <Link2 className="h-3.5 w-3.5" /> Input Link (GDrive / TikTok / Docs)
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={proofLinkInput}
                  onChange={(e) => setProofLinkInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-1.5 text-xs bg-white text-slate-900"
                />
                {proofLinkInput.trim() && (
                  <button
                    onClick={handleSaveLink}
                    disabled={isUploading}
                    className="w-full rounded-xl bg-blue-600 py-1.5 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50"
                  >
                    {isUploading ? 'Menyimpan...' : 'Simpan Link'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Pause / Cancel Reason Form */}
          {showReasonInput && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-4 space-y-2">
              <label className="text-xs font-bold text-amber-950 block">
                {showReasonInput === 'PAUSE' ? 'Alasan Penundaan Tugas:' : 'Alasan Pembatalan Tugas:'}
              </label>
              <input
                type="text"
                placeholder="Misal: Menunggu materi konten dari talent..."
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value)}
                className="w-full rounded-xl border border-amber-300 bg-white p-2 text-xs text-slate-900"
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setShowReasonInput(null)}
                  className="rounded-lg px-3 py-1 text-xs font-bold text-slate-600 bg-white border border-slate-200"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    if (showReasonInput === 'PAUSE') {
                      onPause(task, reasonText);
                    } else {
                      onCancel(task, reasonText);
                    }
                    setShowReasonInput(null);
                    onClose();
                  }}
                  className="rounded-lg px-3 py-1 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800"
                >
                  Konfirmasi
                </button>
              </div>
            </div>
          )}

          {/* Owner Override Status Panel */}
          {isOwner && onOverrideStatus && (
            <div className="rounded-2xl border border-slate-200 p-3.5 bg-slate-50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <ShieldAlert className="h-3.5 w-3.5 text-orange-600" />
                  Owner Override Status
                </span>
                <button
                  type="button"
                  onClick={() => setShowOverride(!showOverride)}
                  className="text-xs font-bold text-orange-600 hover:underline"
                >
                  {showOverride ? 'Tutup' : 'Ubah Status Paksa'}
                </button>
              </div>

              {showOverride && (
                <div className="flex items-center gap-2 pt-2">
                  <select
                    value={overrideStatus}
                    onChange={(e) => setOverrideStatus(e.target.value as DailyTaskStatus)}
                    className="rounded-xl border border-slate-300 bg-white p-2 text-xs font-bold text-slate-900 flex-1"
                  >
                    <option value="BELUM DIKERJAKAN">BELUM DIKERJAKAN</option>
                    <option value="SEDANG DIKERJAKAN">SEDANG DIKERJAKAN</option>
                    <option value="SELESAI">SELESAI</option>
                    <option value="TERTUNDA">TERTUNDA</option>
                    <option value="DIBATALKAN">DIBATALKAN</option>
                  </select>
                  <button
                    onClick={() => {
                      onOverrideStatus(task, overrideStatus);
                      setShowOverride(false);
                      onClose();
                    }}
                    className="rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white hover:bg-orange-500"
                  >
                    Terapkan
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            {isOwner && onEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(task);
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1"
              >
                <Edit2 className="h-3.5 w-3.5" /> Edit
              </button>
            )}
            {isOwner && onDelete && (
              <button
                onClick={() => {
                  if (window.confirm(`Hapus tugas "${task.taskName}"?`)) {
                    onDelete(task);
                    onClose();
                  }
                }}
                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 flex items-center gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" /> Hapus
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Pause / Cancel Options */}
            {isSedang && (
              <>
                <button
                  onClick={() => setShowReasonInput('PAUSE')}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                >
                  <Pause className="h-3.5 w-3.5 text-slate-500" /> Tunda
                </button>
                <button
                  onClick={() => setShowReasonInput('CANCEL')}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 flex items-center gap-1"
                >
                  <XCircle className="h-3.5 w-3.5 text-rose-500" /> Batalkan
                </button>
              </>
            )}

            {/* Primary Action Button */}
            {(isBelum || isTertunda) && (
              <button
                onClick={() => {
                  onStart(task);
                  onClose();
                }}
                className="rounded-xl bg-orange-600 px-5 py-2 text-xs font-black text-white hover:bg-orange-500 flex items-center gap-1.5 shadow-xs"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                MULAI KERJAKAN
              </button>
            )}

            {isSedang && (
              <>
                <button
                  onClick={() => {
                    onClose();
                    onUpdateOutput(task);
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 shadow-2xs"
                >
                  + Update Output
                </button>
                <button
                  onClick={() => {
                    onComplete(task);
                    onClose();
                  }}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-black text-white hover:bg-emerald-500 flex items-center gap-1.5 shadow-xs"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  SELESAIKAN PEKERJAAN
                </button>
              </>
            )}

            {isSelesai && (
              <button
                onClick={() => {
                  onClose();
                  onUpdateOutput(task);
                }}
                className="rounded-xl bg-orange-600 px-5 py-2 text-xs font-bold text-white hover:bg-orange-500"
              >
                Perbarui Output ({current}/{target})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
