import React, { useState, useEffect } from 'react';
import {
  PieChart,
  Calculator,
  FileSpreadsheet,
  DollarSign,
  Layers,
  Home,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  CreditCard,
  Eye,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  subscribeProfitSharingTiers,
  subscribeProfitSharingSettlements,
  subscribeWithdrawals,
} from '../services/profitSharingService';
import {
  ProfitSharingTier,
  ProfitSharingSettlement,
  InvestorWithdrawal,
  DEFAULT_PROFIT_SHARING_TIERS,
} from '../types';
import { ProfitSharingCalculator } from '../components/profitSharing/ProfitSharingCalculator';
import { SettlementHistoryTable } from '../components/profitSharing/SettlementHistoryTable';
import { WithdrawalManager } from '../components/profitSharing/WithdrawalManager';
import { TierConfigManager } from '../components/profitSharing/TierConfigManager';
import { InvestorDashboardPage } from './InvestorDashboardPage';

interface ProfitSharingPageProps {
  onBackToPortal?: () => void;
  defaultTab?: 'CALCULATOR' | 'HISTORY' | 'WITHDRAWAL' | 'TIERS' | 'INVESTOR_VIEW';
}

export const ProfitSharingPage: React.FC<ProfitSharingPageProps> = ({
  onBackToPortal,
  defaultTab = 'CALCULATOR',
}) => {
  const { userProfile, role, loading: authLoading, currentUser } = useAuth();
  const isOwner = role === 'OWNER';
  const isInvestor = role === 'INVESTOR';

  const [activeTab, setActiveTab] = useState<
    'CALCULATOR' | 'HISTORY' | 'WITHDRAWAL' | 'TIERS' | 'INVESTOR_VIEW'
  >(isInvestor ? 'INVESTOR_VIEW' : defaultTab);

  const [tiers, setTiers] = useState<ProfitSharingTier[]>(DEFAULT_PROFIT_SHARING_TIERS);
  const [settlements, setSettlements] = useState<ProfitSharingSettlement[]>([]);
  const [withdrawals, setWithdrawals] = useState<InvestorWithdrawal[]>([]);
  const [targetSettlementForWithdrawal, setTargetSettlementForWithdrawal] = useState<
    string | undefined
  >(undefined);

  // Subscriptions
  useEffect(() => {
    if (authLoading || !currentUser || !userProfile?.active) {
      return;
    }
    const unsubTiers = subscribeProfitSharingTiers((data) => {
      setTiers(data);
    });

    const unsubSettlements = subscribeProfitSharingSettlements((data) => {
      setSettlements(data);
    });

    const unsubWithdrawals = subscribeWithdrawals((data) => {
      setWithdrawals(data);
    });

    return () => {
      unsubTiers();
      unsubSettlements();
      unsubWithdrawals();
    };
  }, [authLoading, currentUser?.uid, userProfile?.role, userProfile?.active]);

  const handleOpenWithdrawalModal = (settlementId: string) => {
    setTargetSettlementForWithdrawal(settlementId);
    setActiveTab('WITHDRAWAL');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200 pb-3">
        <nav className="flex items-center space-x-1.5 text-xs text-zinc-500 font-medium">
          <button
            onClick={onBackToPortal}
            className="flex items-center gap-1 hover:text-purple-600 font-bold transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
            <span>KANTOR PT.KDRT</span>
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
          <span className="font-bold text-zinc-900">PROFIT SHARING</span>
          <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
          <span className="font-bold text-purple-600">
            {activeTab === 'CALCULATOR'
              ? 'KALKULATOR & SETTLEMENT'
              : activeTab === 'HISTORY'
              ? 'RIWAYAT SETTLEMENT'
              : activeTab === 'WITHDRAWAL'
              ? 'KEWAJIBAN & WITHDRAWAL INVESTOR'
              : activeTab === 'INVESTOR_VIEW'
              ? 'DASHBOARD INVESTOR'
              : 'KONFIGURASI TIER'}
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
        {!isInvestor && (
          <>
            <button
              onClick={() => setActiveTab('CALCULATOR')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all ${
                activeTab === 'CALCULATOR'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              <Calculator className="h-4 w-4" />
              <span>Kalkulator & Settlement</span>
            </button>

            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all ${
                activeTab === 'HISTORY'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Riwayat Settlement</span>
              {settlements.length > 0 && (
                <span className="ml-1 rounded-full bg-purple-900/40 px-1.5 py-0.5 text-[10px] text-purple-100">
                  {settlements.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('WITHDRAWAL')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all ${
                activeTab === 'WITHDRAWAL'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              <CreditCard className="h-4 w-4" />
              <span>Kewajiban & Withdrawal</span>
              {withdrawals.length > 0 && (
                <span className="ml-1 rounded-full bg-purple-900/40 px-1.5 py-0.5 text-[10px] text-purple-100">
                  {withdrawals.length}
                </span>
              )}
            </button>
          </>
        )}

        <button
          onClick={() => setActiveTab('INVESTOR_VIEW')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all ${
            activeTab === 'INVESTOR_VIEW'
              ? 'bg-purple-700 text-white shadow-xs'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          <Eye className="h-4 w-4" />
          <span>Dashboard Investor</span>
        </button>

        {isOwner && (
          <button
            onClick={() => setActiveTab('TIERS')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all ${
              activeTab === 'TIERS'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Konfigurasi Tier</span>
          </button>
        )}
      </div>

      {/* Main Tab Contents */}
      {activeTab === 'CALCULATOR' && (
        <ProfitSharingCalculator
          tiers={tiers}
          onOpenWithdrawalModal={handleOpenWithdrawalModal}
          onNavigateToTiers={() => setActiveTab('TIERS')}
        />
      )}

      {activeTab === 'HISTORY' && (
        <SettlementHistoryTable
          settlements={settlements}
          onOpenWithdrawalModal={handleOpenWithdrawalModal}
        />
      )}

      {activeTab === 'WITHDRAWAL' && (
        <WithdrawalManager
          settlements={settlements}
          withdrawals={withdrawals}
          initialSettlementId={targetSettlementForWithdrawal}
        />
      )}

      {activeTab === 'INVESTOR_VIEW' && (
        <InvestorDashboardPage onBackToPortal={onBackToPortal} />
      )}

      {activeTab === 'TIERS' && <TierConfigManager tiers={tiers} />}
    </div>
  );
};
