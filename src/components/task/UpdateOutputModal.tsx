import React, { useState } from 'react';
import { X, Plus, Minus, Check, Sparkles, AlertCircle } from 'lucide-react';
import { DailyTask } from '../../types';

interface UpdateOutputModalProps {
  task: DailyTask | null;
  onClose: () => void;
  onSave: (newOutput: number) => Promise<void>;
}

export const UpdateOutputModal: React.FC<UpdateOutputModalProps> = ({
  task,
  onClose,
  onSave,
}) => {
  if (!task) return null;

  const [outputVal, setOutputVal] = useState<number>(task.currentOutput || 0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const target = task.targetOutput || 1;
  const isTargetAchieved = outputVal >= target;

  const handleIncrement = (amount: number) => {
    setOutputVal((prev) => Math.max(0, prev + amount));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave(outputVal);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200">
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600">
              Update Progress Output
            </span>
            <h3 className="text-base font-extrabold text-slate-900 mt-0.5">{task.taskName}</h3>
            <p className="text-xs text-slate-500">{task.employeeName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Target Reference */}
          <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400 font-bold block text-[10px] uppercase">Target Output</span>
              <span className="text-lg font-black text-slate-900">
                {target} {task.unitOutput}
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 font-bold block text-[10px] uppercase">Status Capaian</span>
              <span
                className={`font-black text-xs px-2 py-0.5 rounded-full ${
                  isTargetAchieved
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-900'
                }`}
              >
                {isTargetAchieved ? 'Target Tercapai' : `${outputVal} / ${target} ${task.unitOutput}`}
              </span>
            </div>
          </div>

          {/* Stepper Input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 text-center">
              Jumlah Output Yang Selesai Dikerjakan ({task.unitOutput})
            </label>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => handleIncrement(-1)}
                className="h-12 w-12 rounded-2xl border border-slate-300 bg-white font-black text-slate-700 hover:bg-slate-100 flex items-center justify-center text-lg active:scale-95 transition-all shadow-2xs"
              >
                <Minus className="h-5 w-5" />
              </button>

              <input
                type="number"
                min={0}
                value={outputVal}
                onChange={(e) => setOutputVal(Math.max(0, Number(e.target.value)))}
                className="h-14 w-28 text-center text-2xl font-black rounded-2xl border-2 border-slate-300 focus:border-orange-500 focus:outline-none text-slate-900"
              />

              <button
                type="button"
                onClick={() => handleIncrement(1)}
                className="h-12 w-12 rounded-2xl bg-orange-500 font-black text-white hover:bg-orange-600 flex items-center justify-center text-lg active:scale-95 transition-all shadow-xs"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Step Buttons */}
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleIncrement(5)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                +5 {task.unitOutput}
              </button>
              <button
                type="button"
                onClick={() => handleIncrement(10)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                +10 {task.unitOutput}
              </button>
              <button
                type="button"
                onClick={() => setOutputVal(target)}
                className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
              >
                Set Penuh ({target})
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-orange-600 px-6 py-2.5 text-xs font-black text-white hover:bg-orange-500 shadow-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              <Check className="h-4 w-4" />
              {isSubmitting ? 'Menyimpan...' : 'Simpan Progress Output'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
