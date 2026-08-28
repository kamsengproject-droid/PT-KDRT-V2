import React, { useState } from 'react';
import {
  X,
  Upload,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  Send,
} from 'lucide-react';
import { ContentCalendarItem, UserProfile } from '../../types';
import {
  updateContentStatus,
  uploadContentProofImage,
} from '../../services/contentCalendarService';

interface ContentPostingProofModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: ContentCalendarItem;
  userProfile: UserProfile;
  onSuccess: () => void;
}

export const ContentPostingProofModal: React.FC<ContentPostingProofModalProps> = ({
  isOpen,
  onClose,
  content,
  userProfile,
  onSuccess,
}) => {
  const [postedUrl, setPostedUrl] = useState<string>(content.postedUrl || '');
  const [notes, setNotes] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(content.postedProofUrl || null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!postedUrl.trim() && !selectedFile && !content.postedProofUrl) {
      setErrorMessage('Wajib memasukkan Link Posting TikTok atau mengunggah Screenshot Bukti.');
      return;
    }

    try {
      setIsSubmitting(true);
      let proofUrl = content.postedProofUrl;
      let proofStoragePath = content.postedProofStoragePath;

      if (selectedFile) {
        const uploadRes = await uploadContentProofImage(selectedFile, content.contentId || content.id || 'proof');
        proofUrl = uploadRes.downloadUrl;
        proofStoragePath = uploadRes.storagePath;
      }

      await updateContentStatus(content.contentId || content.id!, content, 'DIPOSTING', userProfile, {
        postedUrl: postedUrl.trim(),
        postedProofUrl: proofUrl,
        postedProofStoragePath: proofStoragePath,
        notes: notes.trim() || 'Konten berhasil diposting ke TikTok.',
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Gagal menyimpan bukti posting.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-emerald-50/50">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Send className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Selesaikan & Bukti Posting</h3>
              <p className="text-xs text-slate-500 font-medium">{content.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Account & Product Mini Context */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500">Akun:</span>{' '}
              <span className="font-bold text-slate-800">{content.accountName}</span>
            </div>
            {content.productName && (
              <div>
                <span className="text-slate-500">Produk:</span>{' '}
                <span className="font-bold text-slate-800">{content.productName}</span>
              </div>
            )}
            <div>
              <span className="text-slate-500">Target:</span>{' '}
              <span className="font-bold text-emerald-700">{content.targetOutput} {content.unitOutput}</span>
            </div>
          </div>

          {/* Link Posting Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Link Postingan TikTok <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="url"
                required
                value={postedUrl}
                onChange={(e) => setPostedUrl(e.target.value)}
                placeholder="https://vt.tiktok.com/... atau https://www.tiktok.com/@..."
                className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Salin dan tempel URL video TikTok yang sudah ditayangkan.
            </p>
          </div>

          {/* Screenshot Upload (Firebase Storage) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Screenshot / Foto Bukti Posting (Opsional)
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-xl hover:border-emerald-400 transition-colors bg-slate-50/50">
              <div className="space-y-1 text-center">
                {previewUrl ? (
                  <div className="space-y-2">
                    <img
                      src={previewUrl}
                      alt="Preview Bukti"
                      className="mx-auto h-32 w-auto object-cover rounded-lg border border-slate-200 shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl(null);
                      }}
                      className="text-xs text-rose-600 hover:underline"
                    >
                      Hapus Foto
                    </button>
                  </div>
                ) : (
                  <>
                    <ImageIcon className="mx-auto h-8 w-8 text-slate-400" />
                    <div className="flex text-xs text-slate-600 justify-center">
                      <label className="relative cursor-pointer rounded-md font-bold text-emerald-600 hover:text-emerald-500 focus-within:outline-none">
                        <span>Pilih Gambar</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="sr-only"
                        />
                      </label>
                      <p className="pl-1">atau drag and drop</p>
                    </div>
                    <p className="text-[10px] text-slate-400">PNG, JPG, JPEG hingga 10MB</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Catatan Tambahan */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Catatan Publikasi
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan performa jam tayang, sound, atau engagement..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 resize-none"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Tandai DIPOSTING</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
