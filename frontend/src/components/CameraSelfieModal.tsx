import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, CheckCircle2, AlertTriangle, X, UploadCloud } from 'lucide-react';

export interface SelfiePhotoMetadata {
  dataUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
  mimeType: string;
}

interface CameraSelfieModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string, metadata?: SelfiePhotoMetadata) => void;
  title?: string;
}

export const CameraSelfieModal: React.FC<CameraSelfieModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  title = 'Ambil Foto Selfie Langsung',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [photoMeta, setPhotoMeta] = useState<SelfiePhotoMetadata | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCapturedImage(null);
      setPhotoMeta(null);
      setCameraError(null);
      setIsProcessing(false);
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async () => {
    setIsInitializing(true);
    setCameraError(null);
    stopCamera();

    // Check if mediaDevices is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('[CAMERA_DEBUG] navigator.mediaDevices.getUserMedia is not supported on this browser');
      setCameraError(
        'Browser atau perangkat Anda tidak mendukung akses live stream kamera. Silakan gunakan tombol Ambil dari Kamera HP di bawah.'
      );
      setIsInitializing(false);
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
        audio: false,
      };

      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (errFirst: any) {
        console.warn('[CAMERA_DEBUG] Primary constraints failed, retrying with fallback:', errFirst);
        // Fallback constraint
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('[CAMERA_DEBUG] Video play catch:', playErr);
        }
      }
      setIsInitializing(false);
    } catch (err: any) {
      console.error('[CAMERA_DEBUG] Gagal mengakses kamera:', err);
      let errMsg = 'Kamera tidak dapat diakses. Izinkan akses kamera lalu coba lagi.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errMsg = 'Izin kamera ditolak. Silakan berikan izin akses kamera pada browser Anda lalu tekan tombol Coba Lagi.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errMsg = 'Perangkat kamera tidak ditemukan pada HP/Laptop Anda.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errMsg = 'Kamera sedang digunakan oleh aplikasi lain. Tutup aplikasi lain lalu coba lagi.';
      }
      setCameraError(errMsg);
      setIsInitializing(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_) {}
      });
      setStream(null);
    }
  };

  const processDataUrl = (dataUrl: string, width: number, height: number) => {
    const stringLength = dataUrl.length - 'data:image/jpeg;base64,'.length;
    const sizeBytes = Math.round((stringLength * 3) / 4);

    const metadata: SelfiePhotoMetadata = {
      dataUrl,
      width,
      height,
      sizeBytes,
      mimeType: 'image/jpeg',
    };

    setPhotoMeta(metadata);
    setCapturedImage(dataUrl);
    stopCamera();
  };

  const takeSnapshot = () => {
    if (!videoRef.current || isProcessing) return;
    setIsProcessing(true);
    try {
      const video = videoRef.current;
      const rawW = video.videoWidth || 640;
      const rawH = video.videoHeight || 480;
      const maxDim = 640;
      let targetW = rawW;
      let targetH = rawH;

      if (rawW >= rawH) {
        if (rawW > maxDim) {
          targetW = maxDim;
          targetH = Math.round((rawH * maxDim) / rawW);
        }
      } else {
        if (rawH > maxDim) {
          targetH = maxDim;
          targetW = Math.round((rawW * maxDim) / rawH);
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Gagal menginisialisasi canvas untuk kompresi foto.');
      }

      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.70);
      processDataUrl(dataUrl, targetW, targetH);
    } catch (err: any) {
      console.error('[ATTENDANCE_IMAGE_ERROR]', err);
      setCameraError('Gagal memproses foto selfie. Silakan coba ulangi pengambilan foto.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onerror = () => {
      console.error('[ATTENDANCE_IMAGE_ERROR] FileReader error');
      setCameraError('Gagal membaca foto dari perangkat. Silakan pilih foto lain.');
      setIsProcessing(false);
    };
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => {
        console.error('[ATTENDANCE_IMAGE_ERROR] Image load error');
        setCameraError('Format file foto tidak didukung.');
        setIsProcessing(false);
      };
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 640;
          let targetW = img.width;
          let targetH = img.height;

          if (img.width >= img.height) {
            if (img.width > maxDim) {
              targetW = maxDim;
              targetH = Math.round((img.height * maxDim) / img.width);
            }
          } else {
            if (img.height > maxDim) {
              targetH = maxDim;
              targetW = Math.round((img.width * maxDim) / img.height);
            }
          }

          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('Gagal membuat context 2D canvas.');
          }

          ctx.drawImage(img, 0, 0, targetW, targetH);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.70);
          processDataUrl(dataUrl, targetW, targetH);
        } catch (err: any) {
          console.error('[ATTENDANCE_IMAGE_ERROR]', err);
          setCameraError('Gagal mengompres foto selfie.');
        } finally {
          setIsProcessing(false);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setPhotoMeta(null);
    setIsProcessing(false);
    startCamera();
  };

  const handleConfirm = () => {
    if (capturedImage && !isProcessing) {
      setIsProcessing(true);
      onCapture(capturedImage, photoMeta || undefined);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-zinc-900 shadow-2xl border border-zinc-800 text-white flex flex-col">
        {/* Hidden Fallback Camera File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="user"
          onChange={handleFileInputChange}
          className="hidden"
        />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
              <Camera className="h-4 w-4" />
            </div>
            <h3 className="font-semibold text-sm sm:text-base text-zinc-100">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Camera Preview / Captured Picture */}
        <div className="relative aspect-square w-full bg-black flex items-center justify-center overflow-hidden">
          {cameraError ? (
            <div className="p-6 text-center text-zinc-300 space-y-4">
              <AlertTriangle className="mx-auto h-12 w-12 text-amber-400" />
              <p className="text-sm leading-relaxed text-zinc-200">{cameraError}</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                <button
                  onClick={startCamera}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-800 px-4 py-2.5 text-xs font-semibold hover:bg-zinc-700 text-white transition-colors"
                >
                  <RefreshCw className="h-4 w-4" /> Coba Lagi
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold hover:bg-emerald-500 text-white transition-colors shadow-md"
                >
                  <UploadCloud className="h-4 w-4" /> Ambil dari Kamera HP
                </button>
              </div>
            </div>
          ) : capturedImage ? (
            <div className="relative h-full w-full">
              <img
                src={capturedImage}
                alt="Selfie Absensi"
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-3 right-3 rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-medium text-white shadow-lg backdrop-blur-sm flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Foto Siap
              </div>
            </div>
          ) : (
            <div className="relative h-full w-full">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`h-full w-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
              />
              {isInitializing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs text-zinc-300">
                  <RefreshCw className="h-6 w-6 animate-spin text-emerald-400 mb-2" />
                </div>
              )}
              {/* Face Target Guide Oval */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-64 w-52 rounded-[50%] border-2 border-dashed border-emerald-400/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.3)]"></div>
              </div>
              <div className="absolute bottom-3 inset-x-0 text-center">
                <span className="inline-block rounded-full bg-black/60 px-3 py-1 text-xs text-zinc-200 backdrop-blur-sm">
                  Posisikan wajah Anda di dalam lingkaran
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-zinc-800 p-4 bg-zinc-900">
          {capturedImage ? (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleRetake}
                disabled={isProcessing}
                className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 py-3 text-sm font-semibold text-zinc-200 hover:bg-zinc-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="h-4 w-4" /> Ulangi Foto
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isProcessing}
                className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> Memproses...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Gunakan Foto
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))}
                className="rounded-xl border border-zinc-800 bg-zinc-800/80 p-3 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
                title="Ganti Kamera Depan/Belakang"
              >
                <RefreshCw className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={takeSnapshot}
                disabled={isInitializing || !!cameraError}
                className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/40 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                <Camera className="h-5 w-5" /> Ambil Foto Sekarang
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border border-zinc-800 bg-zinc-800/80 p-3 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
                title="Pilih Kamera HP"
              >
                <UploadCloud className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

