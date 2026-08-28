import React from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Video,
  Scissors,
  Send,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';
import { ContentCalendarItem } from '../../types';

interface ContentProductionDashboardWidgetProps {
  todayItems: ContentCalendarItem[];
  onNavigateToCalendar: () => void;
}

export const ContentProductionDashboardWidget: React.FC<ContentProductionDashboardWidgetProps> = ({
  todayItems,
  onNavigateToCalendar,
}) => {
  const totalScheduled = todayItems.length;
  const postedItems = todayItems.filter((i) => i.status === 'DIPOSTING');
  const postedCount = postedItems.length;

  const inProgressCount = todayItems.filter(
    (i) => i.status === 'DIREKAM' || i.status === 'EDITING' || i.status === 'SIAP'
  ).length;

  const pendingCount = todayItems.filter(
    (i) => i.status === 'TERJADWAL' || i.status === 'IDE'
  ).length;

  const totalTargetVT = todayItems.reduce(
    (acc, curr) => acc + (Number(curr.targetOutput) || 1),
    0
  );
  const totalPostedVT = postedItems.reduce(
    (acc, curr) => acc + (Number(curr.targetOutput) || 1),
    0
  );

  const percent =
    totalTargetVT > 0 ? Math.round((totalPostedVT / totalTargetVT) * 100) : 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold">
            <Calendar className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight">
              PRODUKSI KONTEN (HARI INI)
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Monitoring Target VT, Jadwal & Realisasi Posting
            </p>
          </div>
        </div>

        <button
          onClick={onNavigateToCalendar}
          className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700 hover:underline"
        >
          <span>Buka Kalender</span>
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {/* Metric 4-Boxes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Target Output VT
          </div>
          <div className="text-xl font-black text-slate-900 mt-0.5">
            {totalPostedVT} <span className="text-xs font-normal text-slate-400">/ {totalTargetVT} VT</span>
          </div>
          <div className="text-[10px] text-slate-500 font-bold mt-1">
            {percent}% Selesai
          </div>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
            Terjadwal
          </div>
          <div className="text-xl font-black text-blue-900 mt-0.5">{totalScheduled}</div>
          <div className="text-[10px] text-blue-600 font-medium mt-1">Konten hari ini</div>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            Diposting
          </div>
          <div className="text-xl font-black text-emerald-900 mt-0.5">{postedCount}</div>
          <div className="text-[10px] text-emerald-600 font-medium mt-1">Video tayang</div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
            Dalam Proses
          </div>
          <div className="text-xl font-black text-amber-900 mt-0.5">{inProgressCount}</div>
          <div className="text-[10px] text-amber-600 font-medium mt-1">Rekam / Edit</div>
        </div>
      </div>
    </div>
  );
};
