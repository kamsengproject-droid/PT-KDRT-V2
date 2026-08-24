import React from 'react';
import { ContentStatus } from '../../types';
import {
  Lightbulb,
  Video,
  Scissors,
  CheckCircle2,
  Calendar,
  Send,
  XCircle,
} from 'lucide-react';

interface ContentStatusBadgeProps {
  status: ContentStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const ContentStatusBadge: React.FC<ContentStatusBadgeProps> = ({
  status,
  size = 'md',
  showIcon = true,
}) => {
  let style = 'bg-slate-100 text-slate-700 border-slate-300';
  let Icon = Lightbulb;

  switch (status) {
    case 'IDE':
      style = 'bg-slate-100 text-slate-700 border-slate-300';
      Icon = Lightbulb;
      break;
    case 'DIREKAM':
      style = 'bg-amber-100 text-amber-800 border-amber-300';
      Icon = Video;
      break;
    case 'EDITING':
      style = 'bg-indigo-100 text-indigo-800 border-indigo-300';
      Icon = Scissors;
      break;
    case 'SIAP':
      style = 'bg-teal-100 text-teal-800 border-teal-300';
      Icon = CheckCircle2;
      break;
    case 'TERJADWAL':
      style = 'bg-blue-100 text-blue-800 border-blue-300';
      Icon = Calendar;
      break;
    case 'DIPOSTING':
      style = 'bg-emerald-100 text-emerald-800 border-emerald-300';
      Icon = Send;
      break;
    case 'DIBATALKAN':
      style = 'bg-rose-100 text-rose-800 border-rose-300';
      Icon = XCircle;
      break;
    default:
      style = 'bg-slate-100 text-slate-700 border-slate-300';
      Icon = Lightbulb;
  }

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 font-bold',
    md: 'text-xs px-2.5 py-1 font-bold',
    lg: 'text-sm px-3 py-1.5 font-bold',
  };

  const iconSizes = {
    sm: 'h-3 w-3 mr-1',
    md: 'h-3.5 w-3.5 mr-1.5',
    lg: 'h-4 w-4 mr-2',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border shadow-2xs whitespace-nowrap tracking-wide ${sizeClasses[size]} ${style}`}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      <span>{status}</span>
    </span>
  );
};
