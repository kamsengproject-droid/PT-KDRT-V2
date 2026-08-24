import React from 'react';
import { Filter, Calendar, Layers, User, Smartphone, Tag, RefreshCw } from 'lucide-react';
import { ReportGlobalFilter, ReportScopeFilter, Account, Product, Employee, UserProfile } from '../../types';

interface ReportFilterBarProps {
  filter: ReportGlobalFilter;
  onChangeFilter: (newFilter: ReportGlobalFilter) => void;
  accounts: Account[];
  products: Product[];
  employees: Employee[];
  userProfile: UserProfile;
  showAccountFilter?: boolean;
  showProductFilter?: boolean;
  showEmployeeFilter?: boolean;
  showCategoryFilter?: boolean;
  showStatusFilter?: boolean;
  categoriesList?: string[];
  statusesList?: string[];
  onReset?: () => void;
}

export const ReportFilterBar: React.FC<ReportFilterBarProps> = ({
  filter,
  onChangeFilter,
  accounts,
  products,
  employees,
  userProfile,
  showAccountFilter = true,
  showProductFilter = true,
  showEmployeeFilter = true,
  showCategoryFilter = false,
  showStatusFilter = false,
  categoriesList = [],
  statusesList = [],
  onReset,
}) => {
  const isInvestor = userProfile.role === 'INVESTOR';

  const updateField = (field: keyof ReportGlobalFilter, val: any) => {
    onChangeFilter({
      ...filter,
      [field]: val,
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2 text-xs font-black text-slate-800 uppercase tracking-wider">
          <Filter className="h-4 w-4 text-orange-600" />
          <span>Filter Global Laporan</span>
        </div>
        {onReset && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Reset Filter</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {/* 1. Tanggal Awal */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Tanggal Awal
          </label>
          <div className="relative">
            <input
              type="date"
              value={filter.startDate}
              onChange={(e) => updateField('startDate', e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
            />
          </div>
        </div>

        {/* 2. Tanggal Akhir */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Tanggal Akhir
          </label>
          <div className="relative">
            <input
              type="date"
              value={filter.endDate}
              onChange={(e) => updateField('endDate', e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
            />
          </div>
        </div>

        {/* 3. Scope */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Scope Bisnis
          </label>
          {isInvestor ? (
            <div className="rounded-xl border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-black text-purple-700">
              SHARING (Investor)
            </div>
          ) : (
            <select
              value={filter.scope}
              onChange={(e) => updateField('scope', e.target.value as ReportScopeFilter)}
              className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
            >
              <option value="GABUNGAN">GABUNGAN (Semua)</option>
              <option value="PRIBADI">PRIBADI</option>
              <option value="SHARING">SHARING</option>
            </select>
          )}
        </div>

        {/* 4. Akun TikTok */}
        {showAccountFilter && (
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Akun TikTok
            </label>
            <select
              value={filter.accountId}
              onChange={(e) => updateField('accountId', e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
            >
              <option value="SEMUA">Semua Akun</option>
              {accounts
                .filter((acc) => (isInvestor ? acc.scope === 'SHARING' : true))
                .map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.accountName} ({acc.scope})
                  </option>
                ))}
            </select>
          </div>
        )}

        {/* 5. Produk */}
        {showProductFilter && (
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Produk Affiliate
            </label>
            <select
              value={filter.productId}
              onChange={(e) => updateField('productId', e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
            >
              <option value="SEMUA">Semua Produk</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 6. Karyawan */}
        {showEmployeeFilter && !isInvestor && (
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Karyawan / Talent / Editor
            </label>
            <select
              value={filter.employeeId}
              onChange={(e) => updateField('employeeId', e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
            >
              <option value="SEMUA">Semua Karyawan</option>
              {employees.map((emp) => (
                <option key={emp.id || emp.userId} value={emp.id || emp.userId}>
                  {emp.name} ({emp.position || emp.role})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 7. Kategori */}
        {showCategoryFilter && categoriesList.length > 0 && (
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Kategori
            </label>
            <select
              value={filter.category}
              onChange={(e) => updateField('category', e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
            >
              <option value="SEMUA">Semua Kategori</option>
              {categoriesList.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 8. Status */}
        {showStatusFilter && statusesList.length > 0 && (
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Status
            </label>
            <select
              value={filter.status}
              onChange={(e) => updateField('status', e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
            >
              <option value="SEMUA">Semua Status</option>
              {statusesList.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
};
