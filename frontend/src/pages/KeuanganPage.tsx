import React, { useState } from 'react';
import {
  Wallet,
  DollarSign,
  FileSpreadsheet,
  TrendingUp,
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

interface KeuanganPageProps {
  onBackToPortal?: () => void;
  defaultTab?: 'ARUS_KAS' | 'PINDAH_DANA' | 'PENGELUARAN' | 'INPUT_MANUAL' | 'REKONSILIASI' | 'SALDO_AWAL';
}

export const KeuanganPage: React.FC<KeuanganPageProps> = ({
  onBackToPortal,
  defaultTab = 'ARUS_KAS',
}) => {
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<NonNullable<KeuanganPageProps['defaultTab']>>(defaultTab);

  return (
    <div className="space-y-6 pb-12">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200 pb-3">
        <nav className="flex items-center space-x-1.5 text-xs text-zinc-500 font-medium">
          <button
            onClick={onBackToPortal}
            className="flex items-center gap-1 hover:text-emerald-600 font-bold transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
            <span>KANTOR PT.KDRT</span>
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
          <span className="font-bold text-zinc-900">KEUANGAN</span>
          <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
          <span className="font-bold text-emerald-600">
            {activeTab === 'ARUS_KAS'
              ? 'BUKU KAS & CASHFLOW'
              : activeTab === 'PINDAH_DANA' ? 'PINDAH DANA' : activeTab === 'INPUT_MANUAL' ? 'INPUT MANUAL KEUANGAN' : activeTab === 'SALDO_AWAL' ? 'SALDO AWAL & PENYESUAIAN' : activeTab === 'REKONSILIASI'
              ? 'REKONSILIASI KAS'
              : 'PENGELUARAN OPERASIONAL'}
          </span>
        </nav>

        {onBackToPortal && (
          <button
            onClick={onBackToPortal}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 shadow-2xs hover:bg-zinc-50 transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
            <span>Kembali ke Portal</span>
          </button>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 pb-3">
        <button
          onClick={() => setActiveTab('ARUS_KAS')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === 'ARUS_KAS'
              ? 'bg-zinc-900 text-white shadow-xs'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          <DollarSign className="h-4 w-4 text-emerald-400" />
          <span>[ Buku Kas & Cashflow Master ]</span>
        </button>

        {role === 'OWNER' && <button onClick={() => setActiveTab('PINDAH_DANA')} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${activeTab === 'PINDAH_DANA' ? 'bg-zinc-900 text-white shadow-xs' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
          <ArrowRightLeft className="h-4 w-4 text-indigo-400" /><span>[ Pindah Dana ]</span>
        </button>}

        
        {role === 'OWNER' && (
          <button
            onClick={() => setActiveTab('SALDO_AWAL')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
              activeTab === 'SALDO_AWAL'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            <Wallet className="h-4 w-4 text-indigo-400" />
            <span>[ Saldo Awal ]</span>
          </button>
        )}
        {role === 'OWNER' && (
          <button
            onClick={() => setActiveTab('REKONSILIASI')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
              activeTab === 'REKONSILIASI'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            <Scale className="h-4 w-4 text-amber-400" />
            <span>[ Rekonsiliasi Kas & Bank ]</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('PENGELUARAN')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === 'PENGELUARAN'
              ? 'bg-zinc-900 text-white shadow-xs'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          <FileSpreadsheet className="h-4 w-4 text-rose-400" />
          <span>[ Pengeluaran Operasional ]</span>
        </button>
        {role === 'OWNER' && <button onClick={() => setActiveTab('INPUT_MANUAL')} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${activeTab === 'INPUT_MANUAL' ? 'bg-zinc-900 text-white shadow-xs' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
          <PencilLine className="h-4 w-4 text-amber-400" /><span>[ Input Manual ]</span>
        </button>}
      </div>

      {/* Tab Content */}
            {activeTab === 'ARUS_KAS' ? (
        <ArusKasPage />
      ) : activeTab === 'PINDAH_DANA' ? (
        <PindahDanaPage />
      ) : activeTab === 'INPUT_MANUAL' ? (
        <InputManualKeuanganPage />
      ) : activeTab === 'SALDO_AWAL' ? (
        <SaldoAwalPage />
      ) : activeTab === 'REKONSILIASI' ? (
        <RekonsiliasiKas />
      ) : (
        <PengeluaranPage />
      )}
    </div>
  );
};
