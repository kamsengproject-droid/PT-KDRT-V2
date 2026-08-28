import React, { useState } from 'react';
import {
  Play,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Paperclip,
  Flame,
  ArrowRight,
  Sparkles,
  Edit2,
  Trash2,
  ExternalLink,
  ChevronRight,
  Pause,
  XCircle,
} from 'lucide-react';
import { DailyTask, UserRole } from '../../types';
import { formatJamWIB, formatDurasiTimestamp, formatTanggal } from '../../utils/formatters';

interface TaskCardProps {
  task: DailyTask;
  role: UserRole;
  currentUserId?: string;
  onStart: (task: DailyTask) => void;
  onComplete: (task: DailyTask) => void;
  onUpdateOutput: (task: DailyTask) => void;
  onPause?: (task: DailyTask) => void;
  onViewDetail: (task: DailyTask) => void;
  onEdit?: (task: DailyTask) => void;
  onDelete?: (task: DailyTask) => void;
  isActionLoading?: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  role,
  currentUserId,
  onStart,
  onComplete,
  onUpdateOutput,
  onPause,
  onViewDetail,
  onEdit,
  onDelete,
  isActionLoading = false,
}) => {
  const isOwner = role === 'OWNER';
  const isManager = role === 'MANAGER';
  const isEmployee = role === 'EMPLOYEE';

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

  // Priority styling
  const priorityBadge = () => {
    switch (task.priority) {
      case 'MENDESAK':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700 uppercase tracking-wider border border-rose-200">
            <Flame className="h-3 w-3 text-rose-600" />
            Mendesak
          </span>
        );
      case 'TINGGI':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-800 border border-orange-200">
            Tinggi
          </span>
        );
      case 'RENDAH':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200">
            Rendah
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-100">
            Normal
          </span>
        );
    }
  };

  // Status Badge
  const statusBadge = () => {
    if (isSelesai) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 border border-emerald-200 shadow-2xs">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          SELESAI
        </span>
      );
    }
    if (isSedang) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-extrabold text-amber-900 border border-amber-300 shadow-2xs animate-pulse">
          <span className="h-2 w-2 rounded-full bg-amber-500"></span>
          SEDANG DIKERJAKAN
        </span>
      );
    }
    if (isTertunda) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 border border-slate-200">
          <Pause className="h-3.5 w-3.5 text-slate-500" />
          TERTUNDA
        </span>
      );
    }
    if (isBatal) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-800 border border-rose-200">
          <XCircle className="h-3.5 w-3.5 text-rose-500" />
          DIBATALKAN
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 border border-slate-200">
        <Clock className="h-3.5 w-3.5 text-slate-400" />
        BELUM DIKERJAKAN
      </span>
    );
  };

  return (
    <div
      className={`rounded-2xl border bg-white p-5 transition-all shadow-2xs flex flex-col justify-between relative overflow-hidden ${
        isSedang
          ? 'border-amber-300 ring-2 ring-amber-100 bg-amber-50/10'
          : isSelesai
          ? 'border-emerald-200 bg-emerald-50/15'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Top Meta Bar */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {statusBadge()}
            {priorityBadge()}
            {task.accountName && (
              <span className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-2 py-0.5 text-[10px] font-extrabold text-white">
                {task.accountName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isOwner && onEdit && (
              <button
                onClick={() => onEdit(task)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                title="Edit Tugas"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
            )}
            {isOwner && onDelete && (
              <button
                onClick={() => onDelete(task)}
                className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                title="Hapus Tugas"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Task Title & Employee Name */}
        <div className="mt-3">
          <h3
            onClick={() => onViewDetail(task)}
            className="text-base font-extrabold text-slate-900 hover:text-orange-600 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            {task.taskName}
          </h3>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 font-medium">
            <span>Karyawan: <strong className="text-slate-800">{task.employeeName}</strong></span>
            {task.deadline && (
              <>
                <span>•</span>
                <span className="text-orange-700 font-semibold">Deadline: {task.deadline}</span>
              </>
            )}
          </div>
          {task.notes && (
            <p className="text-xs text-slate-600 mt-2 line-clamp-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
              {task.notes}
            </p>
          )}
        </div>
      </div>

      {/* Target & Progress Output Section */}
      <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-slate-500 uppercase text-[10px] tracking-wider">
            Target Output
          </span>
          <div className="flex items-center gap-1.5">
            <span className={`text-sm ${isTargetAchieved ? 'text-emerald-700 font-black' : 'text-slate-900'}`}>
              {current} / {target} {task.unitOutput}
            </span>
            {isTargetAchieved && (
              <span className="rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-black px-1.5 py-0.2 border border-emerald-200">
                TERCAPAI
              </span>
            )}
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
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

        {/* Warning if completed but under target */}
        {isSelesai && !isTargetAchieved && (
          <div className="rounded-xl bg-amber-50 p-2 border border-amber-200 text-[11px] text-amber-800 font-semibold flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span>Target pekerjaan belum tercapai ({current}/{target} {task.unitOutput}).</span>
          </div>
        )}
      </div>

      {/* Timestamp Details & Execution Stats */}
      {(task.startedAt || task.completedAt) && (
        <div className="mt-3 bg-slate-50 rounded-xl p-2.5 border border-slate-100 text-[11px] text-slate-600 grid grid-cols-2 gap-2">
          <div>
            <span className="text-slate-400 block text-[9px] uppercase font-bold">Mulai</span>
            <span className="font-semibold text-slate-800">{formatJamWIB(task.startedAt)}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[9px] uppercase font-bold">
              {isSelesai ? 'Selesai' : 'Durasi Berjalan'}
            </span>
            <span className="font-semibold text-slate-800">
              {isSelesai ? formatJamWIB(task.completedAt) : durationStr}
            </span>
          </div>
          {isSelesai && (
            <div className="col-span-2 pt-1 border-t border-slate-200/60 flex justify-between">
              <span className="text-slate-400 text-[10px]">Total Durasi:</span>
              <strong className="text-emerald-800">{durationStr}</strong>
            </div>
          )}
        </div>
      )}

      {/* Proof / Attachment indicator */}
      {(task.attachmentUrl || task.proofLink) && (
        <div className="mt-2 flex items-center gap-1 text-[11px] text-blue-600 font-semibold">
          <Paperclip className="h-3 w-3" />
          <a
            href={task.attachmentUrl || task.proofLink}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline truncate max-w-[200px]"
          >
            Lihat Bukti Pekerjaan
          </a>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
        {/* Detail Button */}
        <button
          onClick={() => onViewDetail(task)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
        >
          Detail
        </button>

        {/* 1. If BELUM DIKERJAKAN -> [ MULAI KERJAKAN ] */}
        {(isBelum || isTertunda) && (
          <button
            onClick={() => onStart(task)}
            disabled={isActionLoading}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-orange-600 px-3.5 py-1.5 text-xs font-black text-white hover:bg-orange-500 shadow-xs transition-all disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            MULAI KERJAKAN
          </button>
        )}

        {/* 2. If SEDANG DIKERJAKAN -> [ + TAMBAH OUTPUT ] & [ SELESAIKAN PEKERJAAN ] */}
        {isSedang && (
          <>
            <button
              onClick={() => onUpdateOutput(task)}
              disabled={isActionLoading}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-50 shadow-2xs transition-colors"
            >
              <Plus className="h-3.5 w-3.5 text-orange-600" />
              + Output
            </button>

            <button
              onClick={() => onComplete(task)}
              disabled={isActionLoading}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-black text-white hover:bg-emerald-500 shadow-xs transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              SELESAIKAN
            </button>
          </>
        )}

        {/* 3. If SELESAI -> quick update output if owner or employee wants adjustment */}
        {isSelesai && (
          <div className="flex-1 flex justify-end">
            <button
              onClick={() => onUpdateOutput(task)}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              <Plus className="h-3 w-3" /> Ubah Output ({current}/{target})
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
