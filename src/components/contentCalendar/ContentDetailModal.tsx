import React, { useState } from 'react';
import {
  X,
  Calendar,
  Clock,
  Smartphone,
  ShoppingBag,
  User,
  Scissors,
  ClipboardList,
  ExternalLink,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Video,
  Send,
  XCircle,
  Link as LinkIcon,
  Image as ImageIcon,
  Share2,
  Lock,
} from 'lucide-react';
import { ContentCalendarItem, DailyTask, UserProfile } from '../../types';
import { ContentStatusBadge } from './ContentStatusBadge';
import { ContentTimeline } from './ContentTimeline';
import { ContentPostingProofModal } from './ContentPostingProofModal';
import { updateContentStatus, deleteContentItem } from '../../services/contentCalendarService';
import { formatTanggal, formatRupiah } from '../../utils/formatters';

interface ContentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: ContentCalendarItem | null;
  userProfile: UserProfile;
  linkedTask?: DailyTask | null;
  onEdit: (item: ContentCalendarItem) => void;
  onRefresh: () => void;
}

export const ContentDetailModal: React.FC<ContentDetailModalProps> = ({
  isOpen,
  onClose,
  content,
  userProfile,
  linkedTask,
  onEdit,
  onRefresh,
}) => {
  const [showPostingModal, setShowPostingModal] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !content) return null;

  const isOwner = userProfile.role === 'OWNER';
  const isManager = userProfile.role === 'MANAGER';
  const isEmployee = userProfile.role === 'EMPLOYEE';
  const empId = userProfile.employeeId || userProfile.uid;
  const isAssigned = content.talentId === empId || content.editorId === empId;

  const canEdit = isOwner || isManager || isAssigned;
  const canDelete = isOwner || isManager;

  const handleStatusTransition = async (newStatus: any) => {
    try {
      setIsUpdating(true);
      setErrorMessage(null);
      await updateContentStatus(
        content.contentId || content.id!,
        content,
        newStatus,
        userProfile,
        {
          notes: `Status diubah menjadi ${newStatus} oleh ${userProfile.name}`,
        }
      );
      onRefresh();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Gagal mengubah status konten.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelContent = async () => {
    const reason = prompt('Masukkan alasan pembatalan konten ini:');
    if (!reason) return;

    try {
      setIsUpdating(true);
      setErrorMessage(null);
      await updateContentStatus(
        content.contentId || content.id!,
        content,
        'DIBATALKAN',
        userProfile,
        {
          cancellationReason: reason,
          notes: `Dibatalkan oleh ${userProfile.name}: ${reason}`,
        }
      );
      onRefresh();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Gagal membatalkan konten.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Yakin ingin menghapus jadwal konten "${content.title}"? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }

    try {
      setIsUpdating(true);
      await deleteContentItem(content.contentId || content.id!, content, userProfile);
      onRefresh();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Gagal menghapus konten.');
      setIsUpdating(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
        <div className="w-full max-w-3xl max-h-[90vh] rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50 shrink-0">
            <div className="flex items-center gap-3">
              <ContentStatusBadge status={content.status} size="lg" />
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  {content.title}
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-0.5">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    {formatTanggal(content.date)}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 font-bold text-slate-700">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    {content.time} WIB
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canEdit && (
                <button
                  onClick={() => onEdit(content)}
                  className="rounded-xl border border-slate-300 p-2 text-slate-600 hover:bg-white hover:text-slate-900 transition-colors shadow-2xs"
                  title="Edit Konten"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              )}
              {canDelete && (
                <button
                  onClick={handleDelete}
                  className="rounded-xl border border-rose-200 p-2 text-rose-600 hover:bg-rose-50 transition-colors shadow-2xs"
                  title="Hapus Konten"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Content Body */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            {errorMessage && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Grid 2 Columns: Details & Metadata */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Kolom 1: Akun & Produk */}
              <div className="space-y-4">
                {/* Akun TikTok Card */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Smartphone className="h-3.5 w-3.5 text-slate-500" />
                      Akun TikTok
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        content.scope === 'SHARING'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {content.scope === 'SHARING' ? <Share2 className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
                      {content.scope || 'PRIBADI'}
                    </span>
                  </div>
                  <div className="font-bold text-slate-900 text-sm">{content.accountName}</div>
                  {content.accountUsername && (
                    <div className="text-xs text-slate-500">@{content.accountUsername}</div>
                  )}
                </div>

                {/* Produk Card */}
                {content.productId || content.productName ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                      <ShoppingBag className="h-3.5 w-3.5 text-slate-500" />
                      Produk Promosi
                    </div>
                    <div className="flex items-center gap-3">
                      {content.productImage ? (
                        <img
                          src={content.productImage}
                          alt={content.productName}
                          className="h-12 w-12 rounded-xl object-cover border border-slate-200 bg-white shrink-0 shadow-2xs"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-xl bg-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                          <ShoppingBag className="h-6 w-6" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900 text-sm truncate">
                          {content.productName || 'Produk Affiliate'}
                        </div>
                        {content.productPrice && (
                          <div className="text-xs text-emerald-700 font-bold">
                            {formatRupiah(content.productPrice)}
                          </div>
                        )}
                        {content.productUrl && (
                          <a
                            href={content.productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline mt-0.5"
                          >
                            <span>Link Produk</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                    Tidak ada produk spesifik dikaitkan.
                  </div>
                )}
              </div>

              {/* Kolom 2: Tim & Daily Task */}
              <div className="space-y-4">
                {/* Tim Talent & Editor */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Penanggung Jawab Produksi
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                      <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                        <User className="h-3 w-3 text-orange-500" />
                        TALENT
                      </div>
                      <div className="text-xs font-bold text-slate-900 mt-1 truncate">
                        {content.talentName || '-'}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                      <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                        <Scissors className="h-3 w-3 text-indigo-500" />
                        EDITOR
                      </div>
                      <div className="text-xs font-bold text-slate-900 mt-1 truncate">
                        {content.editorName || '-'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Daily Task Target Linkage */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <ClipboardList className="h-3.5 w-3.5 text-slate-500" />
                      Kerjaan Harian (Phase 3A)
                    </span>
                    <span className="font-black text-slate-900 text-xs">
                      {content.targetOutput} {content.unitOutput || 'VT'}
                    </span>
                  </div>

                  {content.taskId || content.taskName ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-2.5 text-xs">
                      <div className="font-bold text-amber-900 truncate">
                        {content.taskName || 'Tugas Terhubung'}
                      </div>
                      {linkedTask ? (
                        <div className="mt-1 flex items-center justify-between text-[11px] text-amber-800">
                          <span>
                            Progress: <b>{linkedTask.currentOutput} / {linkedTask.targetOutput} {linkedTask.unitOutput}</b>
                          </span>
                          <span
                            className={`font-black px-2 py-0.5 rounded-md ${
                              linkedTask.currentOutput >= linkedTask.targetOutput
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {linkedTask.currentOutput >= linkedTask.targetOutput ? 'TERCAPAI' : 'BERJALAN'}
                          </span>
                        </div>
                      ) : (
                        <div className="text-[11px] text-amber-700 mt-0.5">
                          Terkait dengan tugas produksi harian tim.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 italic">
                      Konten ini berdiri sendiri (tidak dikaitkan dengan daily task khusus).
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bukti Posting (Jika ada) */}
            {(content.postedUrl || content.postedProofUrl) && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
                <div className="text-xs font-black text-emerald-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Bukti Publikasi TikTok
                </div>
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  {content.postedProofUrl && (
                    <a
                      href={content.postedProofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block shrink-0 group relative"
                    >
                      <img
                        src={content.postedProofUrl}
                        alt="Bukti Posting"
                        className="h-28 w-28 object-cover rounded-xl border border-emerald-300 shadow-xs group-hover:opacity-90 transition-opacity"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 rounded-xl transition-opacity text-white text-[10px] font-bold">
                        Buka Gambar
                      </div>
                    </a>
                  )}
                  <div className="space-y-2 flex-1 min-w-0 text-xs">
                    {content.postedUrl && (
                      <div>
                        <div className="text-slate-500 font-medium">Link Posting:</div>
                        <a
                          href={content.postedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-800 font-bold hover:underline truncate max-w-full"
                        >
                          <LinkIcon className="h-3 w-3 shrink-0" />
                          <span className="truncate">{content.postedUrl}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </div>
                    )}
                    {content.notes && (
                      <div>
                        <div className="text-slate-500 font-medium">Catatan:</div>
                        <div className="text-slate-800 italic">{content.notes}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Catatan Konten (Jika ada dan bukan posting) */}
            {content.notes && !content.postedUrl && !content.postedProofUrl && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Catatan / Brief Konten
                </div>
                <p className="text-xs text-slate-700 whitespace-pre-wrap">{content.notes}</p>
              </div>
            )}

            {/* Status Timeline & Lifecycle */}
            <div className="rounded-2xl border border-slate-200 p-5 bg-white shadow-2xs">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-4">
                Timeline Siklus Status Produksi
              </h4>
              <ContentTimeline content={content} />
            </div>
          </div>

          {/* Footer Action Buttons */}
          <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 shrink-0 flex flex-wrap items-center justify-between gap-2">
            <div>
              {content.status !== 'DIBATALKAN' && content.status !== 'DIPOSTING' && canEdit && (
                <button
                  type="button"
                  onClick={handleCancelContent}
                  disabled={isUpdating}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-800 hover:underline disabled:opacity-50"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  <span>Batalkan Konten</span>
                </button>
              )}
            </div>

            {/* Next Step Action Buttons */}
            <div className="flex items-center gap-2">
              {content.status === 'IDE' && canEdit && (
                <button
                  type="button"
                  onClick={() => handleStatusTransition('DIREKAM')}
                  disabled={isUpdating}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-700 transition-colors"
                >
                  <Video className="h-3.5 w-3.5" />
                  <span>Mulai Rekam (DIREKAM)</span>
                </button>
              )}

              {content.status === 'DIREKAM' && canEdit && (
                <button
                  type="button"
                  onClick={() => handleStatusTransition('EDITING')}
                  disabled={isUpdating}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition-colors"
                >
                  <Scissors className="h-3.5 w-3.5" />
                  <span>Kirim ke Editing (EDITING)</span>
                </button>
              )}

              {content.status === 'EDITING' && canEdit && (
                <button
                  type="button"
                  onClick={() => handleStatusTransition('SIAP')}
                  disabled={isUpdating}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-teal-700 transition-colors"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Video Siap (SIAP)</span>
                </button>
              )}

              {content.status === 'SIAP' && canEdit && (
                <button
                  type="button"
                  onClick={() => handleStatusTransition('TERJADWAL')}
                  disabled={isUpdating}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-colors"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Jadwalkan Jam Tayang (TERJADWAL)</span>
                </button>
              )}

              {content.status !== 'DIPOSTING' && content.status !== 'DIBATALKAN' && canEdit && (
                <button
                  type="button"
                  onClick={() => setShowPostingModal(true)}
                  disabled={isUpdating}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Input Bukti & DIPOSTING</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Posting Proof Modal */}
      {showPostingModal && (
        <ContentPostingProofModal
          isOpen={showPostingModal}
          onClose={() => setShowPostingModal(false)}
          content={content}
          userProfile={userProfile}
          onSuccess={() => {
            onRefresh();
            onClose();
          }}
        />
      )}
    </>
  );
};
