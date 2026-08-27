import React, { useState } from 'react';
import {
  Wallet,
  DollarSign,
  FileSpreadsheet,
  Home,
  ChevronRight,
  Scale,
  ArrowRightLeft,
  PencilLine,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { ArusKasPage } from './ArusKasPage';
import { PengeluaranPage } from './PengeluaranPage';
import { SaldoAwalPage } from './SaldoAwalPage';
import { RekonsiliasiKas } from '../components/finance/RekonsiliasiKas';
import { PindahDanaPage } from './PindahDanaPage';
import { InputManualKeuanganPage } from './InputManualKeuanganPage';

type FinanceTab =
  | 'ARUS_KAS'
  | 'PINDAH_DANA'
  | 'SALDO_AWAL'
  | 'REKONSILIASI'
  | 'PENGELUARAN'
  | 'INPUT_MANUAL';

interface KeuanganPageProps {
  onBackToPortal?: () => void;
  defaultTab?: FinanceTab;
}

const TAB_LABELS: Record<FinanceTab, string> = {
  ARUS_KAS: 'BUKU KAS & CASHFLOW',
  PINDAH_DANA: 'PINDAH DANA',
  SALDO_AWAL: 'SALDO AWAL',
  REKONSILIASI: 'REKONSILIASI KAS & BANK',
  PENGELUARAN: 'PENGELUARAN OPERASIONAL',
  INPUT_MANUAL: 'INPUT MANUAL',
};

export const KeuanganPage: React.FC<KeuanganPageProps> = ({
  onBackToPortal,
  defaultTab = 'ARUS_KAS',
}) => {
  const { role } = useAuth();

  const [activeTab, setActiveTab] = useState<FinanceTab>(defaultTab);

  const isOwner = role === 'OWNER';

  const handleTabChange = (tab: FinanceTab) => {
    setActiveTab(tab);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ============================================================
          BREADCRUMB
      ============================================================ */}
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 pb-3">
        <nav className="flex min-w-0 items-center space-x-1.5 text-xs font-medium text-zinc-500">
          <button
            type="button"
            onClick={onBackToPortal}
            className="flex shrink-0 items-center gap-1 font-bold transition-colors hover:text-emerald-600"
          >
            <Home className="h-3.5 w-3.5" />
            <span>KANTOR PT.KDRT</span>
          </button>

          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-400" />

          <span className="shrink-0 font-bold text-zinc-900">
            KEUANGAN
          </span>

          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-400" />

          <span className="truncate font-bold text-emerald-600">
            {TAB_LABELS[activeTab]}
          </span>
        </nav>

        {onBackToPortal && (
          <button
            type="button"
            onClick={onBackToPortal}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
          >
            <Home className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              Kembali ke Portal
            </span>
          </button>
        )}
      </div>

      {/* ============================================================
          FINANCE NAVIGATION
      ============================================================ */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 pb-3">
        {/* BUKU KAS & CASHFLOW */}
        <button
          type="button"
          onClick={() => handleTabChange('ARUS_KAS')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === 'ARUS_KAS'
              ? 'bg-zinc-900 text-white shadow-sm'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          <DollarSign
            className={`h-4 w-4 ${
              activeTab === 'ARUS_KAS'
                ? 'text-emerald-400'
                : 'text-emerald-500'
            }`}
          />

          <span>[ Buku Kas & Cashflow ]</span>
        </button>

        {/* PINDAH DANA */}
        {isOwner && (
          <button
            type="button"
            onClick={() => handleTabChange('PINDAH_DANA')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
              activeTab === 'PINDAH_DANA'
                ? 'bg-zinc-900 text-white shadow-sm'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            <ArrowRightLeft
              className={`h-4 w-4 ${
                activeTab === 'PINDAH_DANA'
                  ? 'text-indigo-400'
                  : 'text-indigo-500'
              }`}
            />

            <span>[ Pindah Dana ]</span>
          </button>
        )}

        {/* SALDO AWAL */}
        {isOwner && (
          <button
            type="button"
            onClick={() => handleTabChange('SALDO_AWAL')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
              activeTab === 'SALDO_AWAL'
                ? 'bg-zinc-900 text-white shadow-sm'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            <Wallet
              className={`h-4 w-4 ${
                activeTab === 'SALDO_AWAL'
                  ? 'text-indigo-400'
                  : 'text-indigo-500'
              }`}
            />

            <span>[ Saldo Awal ]</span>
          </button>
        )}

        {/* REKONSILIASI */}
        {isOwner && (
          <button
            type="button"
            onClick={() => handleTabChange('REKONSILIASI')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
              activeTab === 'REKONSILIASI'
                ? 'bg-zinc-900 text-white shadow-sm'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            <Scale
              className={`h-4 w-4 ${
                activeTab === 'REKONSILIASI'
                  ? 'text-amber-400'
                  : 'text-amber-500'
              }`}
            />

            <span>[ Rekonsiliasi Kas & Bank ]</span>
          </button>
        )}

        {/* PENGELUARAN */}
        <button
          type="button"
          onClick={() => handleTabChange('PENGELUARAN')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === 'PENGELUARAN'
              ? 'bg-zinc-900 text-white shadow-sm'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          <FileSpreadsheet
            className={`h-4 w-4 ${
              activeTab === 'PENGELUARAN'
                ? 'text-rose-400'
                : 'text-rose-500'
            }`}
          />

          <span>[ Pengeluaran Operasional ]</span>
        </button>

        {/* INPUT MANUAL */}
        {isOwner && (
          <button
            type="button"
            onClick={() => handleTabChange('INPUT_MANUAL')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
              activeTab === 'INPUT_MANUAL'
                ? 'bg-zinc-900 text-white shadow-sm'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            <PencilLine
              className={`h-4 w-4 ${
                activeTab === 'INPUT_MANUAL'
                  ? 'text-amber-400'
                  : 'text-amber-500'
              }`}
            />

            <span>[ Input Manual ]</span>
          </button>
        )}
      </div>

      {/* ============================================================
          TAB CONTENT
      ============================================================ */}
      <div>
        {activeTab === 'ARUS_KAS' && <ArusKasPage />}

        {activeTab === 'PINDAH_DANA' && isOwner && (
          <PindahDanaPage />
        )}

        {activeTab === 'SALDO_AWAL' && isOwner && (
          <SaldoAwalPage />
        )}

        {activeTab === 'REKONSILIASI' && isOwner && (
          <RekonsiliasiKas />
        )}

        {activeTab === 'PENGELUARAN' && <PengeluaranPage />}

        {activeTab === 'INPUT_MANUAL' && isOwner && (
          <InputManualKeuanganPage />
        )}
      </div>
    </div>
  );
};
