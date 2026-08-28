import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Video,
  Scissors,
  Send,
  Plus,
  TrendingUp,
  Smartphone,
  ShoppingBag,
  User,
  Filter,
} from 'lucide-react';
import { ContentCalendarItem, UserProfile } from '../../types';
import { ContentStatusBadge } from './ContentStatusBadge';
import { formatTanggal, formatRupiah } from '../../utils/formatters';

interface ContentTodayViewProps {
  todayItems: ContentCalendarItem[];
  userProfile: UserProfile;
  onSelectContent: (item: ContentCalendarItem) => void;
  onAddNew: () => void;
  onQuickPost: (item: ContentCalendarItem) => void;
}

export const ContentTodayView: React.FC<ContentTodayViewProps> = ({
  todayItems,
  userProfile,
  onSelectContent,
  onAddNew,
  onQuickPost,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<string>('SEMUA');

  // Stats calculation
  const totalScheduled = todayItems.length;
  const postedItems = todayItems.filter((i) => i.status === 'DIPOSTING');
  const postedCount = postedItems.length;

  const inProgressItems = todayItems.filter(
    (i) => i.status === 'DIREKAM' || i.status === 'EDITING' || i.status === 'SIAP'
  );
  const pendingItems = todayItems.filter(
    (i) => i.status === 'TERJADWAL' || i.status === 'IDE'
  );
  const cancelledItems = todayItems.filter((i) => i.status === 'DIBATALKAN');

  const totalTargetVT = todayItems.reduce(
    (acc, curr) => acc + (Number(curr.targetOutput) || 1),
    0
  );
  const totalPostedVT = postedItems.reduce(
    (acc, curr) => acc + (Number(curr.targetOutput) || 1),
    0
  );

  const percentComplete =
    totalScheduled > 0 ? Math.round((postedCount / totalScheduled) * 100) : 0;

  // Filtered items
  const filteredItems = todayItems
    .filter((item) => {
      if (selectedStatus === 'SEMUA') return true;
      return item.status === selectedStatus;
    })
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  return (
    <div className="space-y-6">
      {/* 1. Metric Cards Header */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Target Output Hari Ini */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-black uppercase tracking-wider">
              Target Output VT
            </span>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{totalPostedVT}</span>
            <span className="text-sm font-bold text-slate-400">/ {totalTargetVT} VT</span>
          </div>
          <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-orange-600 h-1.5 rounded-full transition-all"
              style={{ width: `${percentComplete}%` }}
            />
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-bold">
            {percentComplete}% Tercapai Hari Ini
          </div>
        </div>

        {/* Card 2: Konten Diposting */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-800 mb-2">
            <span className="text-xs font-black uppercase tracking-wider">
              Konten Diposting
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-900">{postedCount}</div>
          <div className="mt-1 text-[11px] text-emerald-700 font-medium">
            Video sudah tayang di TikTok
          </div>
        </div>

        {/* Card 3: Sedang Diproduksi */}
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-indigo-800 mb-2">
            <span className="text-xs font-black uppercase tracking-wider">
              Proses Produksi
            </span>
            <Scissors className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-900">{inProgressItems.length}</div>
          <div className="mt-1 text-[11px] text-indigo-700 font-medium">
            Rekam & Editing Aktif
          </div>
        </div>

        {/* Card 4: Menunggu Jadwal */}
        <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-blue-800 mb-2">
            <span className="text-xs font-black uppercase tracking-wider">
              Menunggu Jam Tayang
            </span>
            <Clock className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-900">{pendingItems.length}</div>
          <div className="mt-1 text-[11px] text-blue-700 font-medium">
            Siap posting sesuai jam
          </div>
        </div>
      </div>

      {/* 2. Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        {/* Status Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'SEMUA', label: 'Semua Status' },
            { id: 'TERJADWAL', label: 'Terjadwal' },
            { id: 'SIAP', label: 'Siap' },
            { id: 'EDITING', label: 'Editing' },
            { id: 'DIREKAM', label: 'Direkam' },
            { id: 'DIPOSTING', label: 'Diposting' },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setSelectedStatus(st.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                selectedStatus === st.id
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        <button
          onClick={onAddNew}
          className="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-orange-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Tambah Konten Hari Ini</span>
        </button>
      </div>

      {/* 3. Hourly Content Cards List */}
      <div className="space-y-3">
        {filteredItems.map((item) => (
          <div
            key={item.contentId || item.id}
            onClick={() => onSelectContent(item)}
            className="rounded-2xl border border-slate-200 bg-white p-4 hover:border-orange-400 hover:shadow-xs transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            {/* Left: Time & Core Details */}
            <div className="flex items-start gap-4">
              <div className="h-14 w-16 rounded-xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center shrink-0">
                <Clock className="h-4 w-4 text-slate-500 mb-0.5" />
                <span className="font-mono font-black text-slate-900 text-xs">{item.time}</span>
                <span className="text-[9px] text-slate-400 font-bold">WIB</span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-slate-900">{item.title}</h4>
                  <ContentStatusBadge status={item.status} size="sm" />
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1 font-bold text-slate-800">
                    <Smartphone className="h-3.5 w-3.5 text-slate-400" />
                    {item.accountName}
                  </span>
                  {item.productName && (
                    <span className="flex items-center gap-1 font-bold text-emerald-700">
                      <ShoppingBag className="h-3.5 w-3.5" />
                      {item.productName}
                    </span>
                  )}
                  {item.talentName && (
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-orange-500" />
                      Talent: <b className="text-slate-700">{item.talentName}</b>
                    </span>
                  )}
                  {item.editorName && (
                    <span className="flex items-center gap-1">
                      <Scissors className="h-3.5 w-3.5 text-indigo-500" />
                      Editor: <b className="text-slate-700">{item.editorName}</b>
                    </span>
                  )}
                </div>

                {item.taskName && (
                  <div className="text-[11px] text-amber-800 font-medium">
                    Terkait Task: {item.taskName} ({item.targetOutput} {item.unitOutput})
                  </div>
                )}
              </div>
            </div>

            {/* Right: Quick Action Buttons */}
            <div className="flex items-center gap-2 self-end md:self-center shrink-0">
              {item.status !== 'DIPOSTING' && item.status !== 'DIBATALKAN' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickPost(item);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition-colors"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Input Bukti & Post</span>
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectContent(item);
                }}
                className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
              >
                Detail
              </button>
            </div>
          </div>
        ))}

        {filteredItems.length === 0 && (
          <div className="p-12 text-center text-xs text-slate-400 rounded-2xl border border-dashed border-slate-200 bg-white">
            Tidak ada konten untuk hari ini yang sesuai dengan filter.
          </div>
        )}
      </div>
    </div>
  );
};
