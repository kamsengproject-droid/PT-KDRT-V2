import React from 'react';
import { ContentCalendarItem, ContentStatus, CONTENT_STATUS_SEQUENCE } from '../../types';
import {
  Lightbulb,
  Video,
  Scissors,
  CheckCircle2,
  Calendar,
  Send,
  XCircle,
  Clock,
  User,
} from 'lucide-react';
import { formatTanggal } from '../../utils/formatters';

interface ContentTimelineProps {
  content: ContentCalendarItem;
}

export const ContentTimeline: React.FC<ContentTimelineProps> = ({ content }) => {
  const isCancelled = content.status === 'DIBATALKAN';

  const formatTimestamp = (timestamp: any): string => {
    if (!timestamp) return '';
    try {
      if (typeof timestamp === 'string') {
        const d = new Date(timestamp);
        return `${d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
      }
      if (timestamp.toDate) {
        const d = timestamp.toDate();
        return `${d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
      }
      if (timestamp.seconds) {
        const d = new Date(timestamp.seconds * 1000);
        return `${d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
      }
    } catch {
      return '';
    }
    return '';
  };

  const getStepTimestamp = (status: ContentStatus) => {
    switch (status) {
      case 'IDE':
        return formatTimestamp(content.ideAt || content.createdAt);
      case 'DIREKAM':
        return formatTimestamp(content.direkamAt);
      case 'EDITING':
        return formatTimestamp(content.editingAt);
      case 'SIAP':
        return formatTimestamp(content.siapAt);
      case 'TERJADWAL':
        return formatTimestamp(content.terjadwalAt);
      case 'DIPOSTING':
        return formatTimestamp(content.postedAt || content.postedAtTimestamp);
      default:
        return '';
    }
  };

  const currentIdx = CONTENT_STATUS_SEQUENCE.indexOf(content.status);

  const getStepIcon = (status: ContentStatus) => {
    switch (status) {
      case 'IDE':
        return Lightbulb;
      case 'DIREKAM':
        return Video;
      case 'EDITING':
        return Scissors;
      case 'SIAP':
        return CheckCircle2;
      case 'TERJADWAL':
        return Calendar;
      case 'DIPOSTING':
        return Send;
      default:
        return Clock;
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Sequence Progress Bar */}
      <div className="relative">
        <div className="overflow-x-auto pb-2">
          <div className="min-w-[600px] flex items-center justify-between relative px-2">
            {/* Background Line */}
            <div className="absolute left-6 right-6 top-4 h-1 bg-slate-200 -z-0" />

            {CONTENT_STATUS_SEQUENCE.map((status, index) => {
              const Icon = getStepIcon(status);
              const isPastOrCurrent = !isCancelled && index <= currentIdx;
              const isCurrent = !isCancelled && status === content.status;
              const timeStr = getStepTimestamp(status);

              return (
                <div
                  key={status}
                  className="flex flex-col items-center relative z-10 text-center flex-1"
                >
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                      isCurrent
                        ? 'bg-orange-600 text-white ring-4 ring-orange-100 shadow-md scale-110'
                        : isPastOrCurrent
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white text-slate-400 border-2 border-slate-200'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span
                    className={`mt-1.5 text-xs font-bold ${
                      isCurrent
                        ? 'text-orange-700 font-black'
                        : isPastOrCurrent
                        ? 'text-slate-800'
                        : 'text-slate-400'
                    }`}
                  >
                    {status}
                  </span>
                  {timeStr ? (
                    <span className="text-[10px] text-slate-500 font-medium mt-0.5">
                      {timeStr}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-300">-</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* If Cancelled notice */}
      {isCancelled && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-start gap-2">
          <XCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Konten Dibatalkan</div>
            <div className="text-rose-700 mt-0.5">
              {content.cancellationReason || content.notes || 'Jadwal konten telah dibatalkan.'}
            </div>
            {content.cancelledAt && (
              <div className="text-[11px] text-rose-500 mt-1">
                Waktu Pembatalan: {formatTimestamp(content.cancelledAt)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Audit Trail History List */}
      {content.statusHistory && content.statusHistory.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <h5 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
            Riwayat Perubahan Status
          </h5>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {content.statusHistory.map((hist, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between text-xs bg-slate-50 rounded-lg p-2 border border-slate-200"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-800">{hist.status}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-600 flex items-center gap-1">
                      <User className="h-3 w-3 text-slate-400" />
                      {hist.actorName || 'Sistem'}
                    </span>
                  </div>
                  {hist.notes && (
                    <div className="text-[11px] text-slate-500 italic">{hist.notes}</div>
                  )}
                  {hist.postedUrl && (
                    <a
                      href={hist.postedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-blue-600 hover:underline block truncate max-w-xs"
                    >
                      {hist.postedUrl}
                    </a>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap ml-2">
                  {formatTimestamp(hist.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
