import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Smartphone,
  ShoppingBag,
  User,
  Scissors,
  ExternalLink,
  Plus,
  Send,
  CheckCircle2,
  Share2,
  Lock,
} from 'lucide-react';
import { ContentCalendarItem, ContentStatus } from '../../types';
import { ContentStatusBadge } from './ContentStatusBadge';
import { formatTanggal, formatRupiah } from '../../utils/formatters';

interface ContentCalendarGridProps {
  items: ContentCalendarItem[];
  currentDate: string; // YYYY-MM-DD
  onDateChange: (newDate: string) => void;
  onSelectContent: (item: ContentCalendarItem) => void;
  onAddNewAtDate: (dateStr: string) => void;
  viewMode: 'BULAN' | 'MINGGU' | 'HARI' | 'DAFTAR';
}

export const ContentCalendarGrid: React.FC<ContentCalendarGridProps> = ({
  items,
  currentDate,
  onDateChange,
  onSelectContent,
  onAddNewAtDate,
  viewMode,
}) => {
  const activeDate = new Date(currentDate);

  // Month navigation helpers
  const year = activeDate.getFullYear();
  const month = activeDate.getMonth();

  const handlePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'BULAN') {
      d.setMonth(d.getMonth() - 1);
    } else if (viewMode === 'MINGGU') {
      d.setDate(d.getDate() - 7);
    } else {
      d.setDate(d.getDate() - 1);
    }
    onDateChange(d.toISOString().split('T')[0]);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'BULAN') {
      d.setMonth(d.getMonth() + 1);
    } else if (viewMode === 'MINGGU') {
      d.setDate(d.getDate() + 7);
    } else {
      d.setDate(d.getDate() + 1);
    }
    onDateChange(d.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    const today = new Date().toISOString().split('T')[0];
    onDateChange(today);
  };

  // Month label
  const monthNames = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];

  const currentMonthLabel = `${monthNames[month]} ${year}`;

  // ==========================================
  // 1. MONTH VIEW CALCULATIONS
  // ==========================================
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // Start with Monday (1) to Sunday (7)
  let startOffset = firstDayOfMonth.getDay() - 1;
  if (startOffset === -1) startOffset = 6;

  const totalDays = lastDayOfMonth.getDate();
  const calendarCells = [];

  // Previous month padding
  for (let i = startOffset - 1; i >= 0; i--) {
    const prevDate = new Date(year, month, -i);
    calendarCells.push({
      dateStr: prevDate.toISOString().split('T')[0],
      dayNumber: prevDate.getDate(),
      isCurrentMonth: false,
    });
  }

  // Current month days
  for (let day = 1; day <= totalDays; day++) {
    const d = new Date(year, month, day);
    calendarCells.push({
      dateStr: d.toISOString().split('T')[0],
      dayNumber: day,
      isCurrentMonth: true,
    });
  }

  // Next month padding to fill complete weeks
  const remaining = 35 - (calendarCells.length % 35);
  if (remaining < 7 && remaining > 0) {
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month + 1, i);
      calendarCells.push({
        dateStr: nextDate.toISOString().split('T')[0],
        dayNumber: i,
        isCurrentMonth: false,
      });
    }
  }

  // Group items by date
  const itemsByDate: { [key: string]: ContentCalendarItem[] } = {};
  items.forEach((item) => {
    if (!itemsByDate[item.date]) {
      itemsByDate[item.date] = [];
    }
    itemsByDate[item.date].push(item);
  });

  // Sort each date items by time
  Object.keys(itemsByDate).forEach((d) => {
    itemsByDate[d].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  });

  // ==========================================
  // 2. WEEK VIEW CALCULATIONS
  // ==========================================
  const currentDayOfWeek = activeDate.getDay(); // 0 is Sun
  const mondayOffset = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(activeDate);
    d.setDate(activeDate.getDate() + mondayOffset + i);
    weekDays.push({
      dateStr: d.toISOString().split('T')[0],
      dayName: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'][i],
      dayNumber: d.getDate(),
      isToday: d.toISOString().split('T')[0] === new Date().toISOString().split('T')[0],
    });
  }

  // Today string
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-4">
      {/* Calendar Header Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            className="rounded-xl border border-slate-300 p-2 hover:bg-slate-50 transition-colors shadow-2xs"
            title="Sebelumnya"
          >
            <ChevronLeft className="h-4 w-4 text-slate-700" />
          </button>
          <button
            onClick={handleToday}
            className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            Hari Ini
          </button>
          <button
            onClick={handleNext}
            className="rounded-xl border border-slate-300 p-2 hover:bg-slate-50 transition-colors shadow-2xs"
            title="Berikutnya"
          >
            <ChevronRight className="h-4 w-4 text-slate-700" />
          </button>

          <h3 className="text-base font-black text-slate-900 ml-2">
            {viewMode === 'HARI'
              ? formatTanggal(currentDate)
              : viewMode === 'MINGGU'
              ? `Minggu: ${formatTanggal(weekDays[0].dateStr)} – ${formatTanggal(weekDays[6].dateStr)}`
              : currentMonthLabel}
          </h3>
        </div>

        <div className="text-xs text-slate-500 font-bold">
          Total Terjadwal: <span className="text-orange-600 font-black">{items.length} Konten</span>
        </div>
      </div>

      {/* ==========================================
          VIEW: BULAN (MONTH)
         ========================================== */}
      {viewMode === 'BULAN' && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
          {/* Day of week headers */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-black text-slate-600 uppercase tracking-wider py-2.5">
            <div>Senin</div>
            <div>Selasa</div>
            <div>Rabu</div>
            <div>Kamis</div>
            <div>Jumat</div>
            <div className="text-orange-600">Sabtu</div>
            <div className="text-rose-600">Minggu</div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100">
            {calendarCells.map((cell, idx) => {
              const dayItems = itemsByDate[cell.dateStr] || [];
              const isToday = cell.dateStr === todayStr;

              return (
                <div
                  key={idx}
                  className={`min-h-[120px] p-1.5 sm:p-2 transition-colors flex flex-col justify-between group relative ${
                    !cell.isCurrentMonth
                      ? 'bg-slate-50/60 text-slate-400'
                      : isToday
                      ? 'bg-orange-50/30'
                      : 'bg-white hover:bg-slate-50/80'
                  }`}
                >
                  {/* Date Header */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-black ${
                        isToday
                          ? 'bg-orange-600 text-white shadow-2xs'
                          : cell.isCurrentMonth
                          ? 'text-slate-800'
                          : 'text-slate-400'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>

                    {/* Quick Add Button on Hover */}
                    <button
                      onClick={() => onAddNewAtDate(cell.dateStr)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-orange-100 text-orange-600 transition-opacity"
                      title="Tambah Konten Tanggal Ini"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Content List Items */}
                  <div className="space-y-1 my-1 flex-1 overflow-y-auto max-h-24 pr-0.5">
                    {dayItems.map((item) => (
                      <button
                        key={item.contentId || item.id}
                        onClick={() => onSelectContent(item)}
                        className="w-full text-left p-1 rounded-md text-[11px] border border-slate-200 bg-white shadow-2xs hover:border-orange-400 transition-colors block truncate"
                      >
                        <div className="flex items-center gap-1 font-bold text-slate-800 truncate">
                          <span className="text-[10px] text-slate-500 font-mono shrink-0">
                            {item.time}
                          </span>
                          <span className="truncate">{item.title}</span>
                        </div>
                        <div className="flex items-center justify-between gap-1 mt-0.5">
                          <span className="text-[10px] text-slate-500 truncate">
                            {item.accountName}
                          </span>
                          <ContentStatusBadge status={item.status} size="sm" showIcon={false} />
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Empty state hint */}
                  {dayItems.length === 0 && (
                    <div className="text-[10px] text-slate-300 text-center my-auto py-2">
                      -
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==========================================
          VIEW: MINGGU (WEEK)
         ========================================== */}
      {viewMode === 'MINGGU' && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {weekDays.map((w, idx) => {
            const dayItems = itemsByDate[w.dateStr] || [];

            return (
              <div
                key={idx}
                className={`rounded-2xl border p-3 flex flex-col h-full bg-white shadow-xs ${
                  w.isToday ? 'border-orange-400 ring-2 ring-orange-100' : 'border-slate-200'
                }`}
              >
                {/* Day Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                      {w.dayName}
                    </span>
                    <div className="text-sm font-black text-slate-900">
                      {w.dayNumber} {monthNames[activeDate.getMonth()]}
                    </div>
                  </div>
                  <button
                    onClick={() => onAddNewAtDate(w.dateStr)}
                    className="p-1 rounded-lg text-slate-400 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                    title="Tambah Konten"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                {/* Items in Column */}
                <div className="space-y-2 mt-3 flex-1 overflow-y-auto">
                  {dayItems.map((item) => (
                    <div
                      key={item.contentId || item.id}
                      onClick={() => onSelectContent(item)}
                      className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-orange-400 transition-all cursor-pointer shadow-2xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1 font-mono">
                          <Clock className="h-3 w-3 text-slate-400" />
                          {item.time} WIB
                        </span>
                        <ContentStatusBadge status={item.status} size="sm" showIcon={false} />
                      </div>

                      <div className="font-bold text-xs text-slate-900 line-clamp-2">
                        {item.title}
                      </div>

                      <div className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                        <Smartphone className="h-3 w-3 shrink-0" />
                        <span className="truncate">{item.accountName}</span>
                      </div>

                      {item.productName && (
                        <div className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 truncate">
                          <ShoppingBag className="h-3 w-3 shrink-0" />
                          <span className="truncate">{item.productName}</span>
                        </div>
                      )}
                    </div>
                  ))}

                  {dayItems.length === 0 && (
                    <div className="h-24 flex items-center justify-center text-xs text-slate-400 italic">
                      Tidak ada konten
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ==========================================
          VIEW: HARI (DAY)
         ========================================== */}
      {viewMode === 'HARI' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              Jadwal Tayang: {formatTanggal(currentDate)}
            </h4>
            <button
              onClick={() => onAddNewAtDate(currentDate)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-orange-700 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Tambah Konten Hari Ini</span>
            </button>
          </div>

          <div className="space-y-3">
            {(itemsByDate[currentDate] || []).map((item) => (
              <div
                key={item.contentId || item.id}
                onClick={() => onSelectContent(item)}
                className="rounded-xl border border-slate-200 p-4 hover:border-orange-400 hover:shadow-xs transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white"
              >
                <div className="flex items-start sm:items-center gap-4">
                  <div className="h-12 w-16 rounded-xl bg-slate-100 flex flex-col items-center justify-center font-mono font-bold text-slate-800 text-xs shrink-0 border border-slate-200">
                    <Clock className="h-4 w-4 text-slate-500 mb-0.5" />
                    {item.time}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h5 className="font-bold text-sm text-slate-900">{item.title}</h5>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
                          item.scope === 'SHARING'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {item.scope || 'PRIBADI'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Smartphone className="h-3.5 w-3.5 text-slate-400" />
                        {item.accountName}
                      </span>
                      {item.productName && (
                        <span className="flex items-center gap-1 text-emerald-700 font-bold">
                          <ShoppingBag className="h-3.5 w-3.5" />
                          {item.productName}
                        </span>
                      )}
                      {item.talentName && (
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5 text-orange-500" />
                          Talent: {item.talentName}
                        </span>
                      )}
                      {item.editorName && (
                        <span className="flex items-center gap-1">
                          <Scissors className="h-3.5 w-3.5 text-indigo-500" />
                          Editor: {item.editorName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <ContentStatusBadge status={item.status} size="md" />
                </div>
              </div>
            ))}

            {(!itemsByDate[currentDate] || itemsByDate[currentDate].length === 0) && (
              <div className="p-8 text-center text-xs text-slate-400 rounded-xl border border-dashed border-slate-200">
                Belum ada konten dijadwalkan untuk tanggal ini.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==========================================
          VIEW: DAFTAR (TABLE LIST)
         ========================================== */}
      {viewMode === 'DAFTAR' && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 font-black text-slate-700 uppercase tracking-wider">
                  <th className="py-3 px-4">Tanggal & Jam</th>
                  <th className="py-3 px-4">Akun TikTok</th>
                  <th className="py-3 px-4">Produk</th>
                  <th className="py-3 px-4">Judul Konten</th>
                  <th className="py-3 px-4">Talent / Editor</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr
                    key={item.contentId || item.id}
                    onClick={() => onSelectContent(item)}
                    className="hover:bg-orange-50/40 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-800">
                      <div>{formatTanggal(item.date)}</div>
                      <div className="text-[11px] text-slate-500 font-mono font-bold">
                        {item.time} WIB
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-bold text-slate-900">{item.accountName}</div>
                      <div className="text-[10px] text-slate-400">{item.scope}</div>
                    </td>

                    <td className="py-3 px-4">
                      {item.productName ? (
                        <div className="font-bold text-emerald-800 line-clamp-1">
                          {item.productName}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 line-clamp-1">{item.title}</div>
                      {item.taskName && (
                        <div className="text-[10px] text-amber-700 font-medium truncate">
                          Task: {item.taskName}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="text-slate-700">T: {item.talentName || '-'}</div>
                      <div className="text-slate-500 text-[11px]">E: {item.editorName || '-'}</div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <ContentStatusBadge status={item.status} size="sm" />
                    </td>

                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectContent(item);
                        }}
                        className="rounded-lg border border-slate-300 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))}

                {items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-slate-400 italic">
                      Tidak ada konten yang sesuai dengan filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
