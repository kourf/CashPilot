import React from 'react';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  ShieldCheck, 
  Sparkles, 
  TrendingUp, 
  Activity, 
  Check 
} from 'lucide-react';
import { formatBankAmount } from '../../../lib/kpiUtils';
import { cn } from '../../../lib/utils';

interface AppleKpiCardsProps {
  metrics: {
    income: number;
    realExpenses: number;
    netCashFlow: number;
    totalExpenses?: number;
    internalTransfers?: number;
  };
  statementStatus?: {
    hasVerifiedBalance?: boolean;
    formattedAmount?: string;
    kpiTitle?: string;
    kpiSubtitle?: string;
    isPositive?: boolean;
    displayAmount?: number;
  };
  currency: 'EUR' | 'CHF';
  categoryCount?: number;
  selectedFilter: string;
  onFilterChange?: (filter: string) => void;
  onSelectFilter?: (filter: string) => void;
}

export const AppleKpiCards: React.FC<AppleKpiCardsProps> = ({
  metrics,
  statementStatus,
  currency,
  categoryCount = 8,
  selectedFilter,
  onFilterChange,
  onSelectFilter
}) => {
  const handleToggle = (filter: string) => {
    if (onSelectFilter) onSelectFilter(filter);
    else if (onFilterChange) onFilterChange(filter);
  };
  const incomeRate = metrics.income > 0 
    ? Math.min(Math.round((metrics.realExpenses / metrics.income) * 100), 100)
    : 0;

  const isPositiveNet = (statementStatus?.isPositive !== undefined)
    ? statementStatus.isPositive
    : metrics.netCashFlow >= 0;

  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5" data-purpose="kpi-metrics-grid">
      {/* KPI 1 : Revenus Mensuels Encaissés */}
      <article
        onClick={() => handleToggle(selectedFilter === 'INCOME' ? 'ALL' : 'INCOME')}
        className={cn(
          "liquid-glass rounded-3xl p-5 relative overflow-hidden group transition-all duration-300 cursor-pointer",
          selectedFilter === 'INCOME' 
            ? "border-emerald-500/60 shadow-lg shadow-emerald-500/10 scale-[1.01]" 
            : "hover:border-emerald-500/30"
        )}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold flex items-center space-x-1.5">
              <span>Revenus Encaissés</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            </span>
            <div className="text-2xl sm:text-3xl font-black tracking-tight text-foreground mt-1 font-mono">
              {formatBankAmount(metrics.income, currency)}
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl liquid-pill flex items-center justify-center text-emerald-500 shadow-md">
            <ArrowDownLeft size={20} className="stroke-[2.5]" />
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-border/50 dark:border-white/10 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            <TrendingUp size={12} />
            <span>+12.4% vs N-1</span>
          </div>
          <span className="text-muted-foreground text-[11px]">Salaire & Virements reçus</span>
        </div>
      </article>

      {/* KPI 2 : Dépenses Consolidées */}
      <article
        onClick={() => handleToggle(selectedFilter === 'EXPENSE' ? 'ALL' : 'EXPENSE')}
        className={cn(
          "liquid-glass rounded-3xl p-5 relative overflow-hidden group transition-all duration-300 cursor-pointer",
          selectedFilter === 'EXPENSE' 
            ? "border-rose-500/60 shadow-lg shadow-rose-500/10 scale-[1.01]" 
            : "hover:border-rose-500/30"
        )}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold flex items-center space-x-1.5">
              <span>Dépenses Consolidées</span>
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            </span>
            <div className="text-2xl sm:text-3xl font-black tracking-tight text-foreground mt-1 font-mono">
              {formatBankAmount(metrics.realExpenses, currency)}
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl liquid-pill flex items-center justify-center text-rose-500 shadow-md">
            <ArrowUpRight size={20} className="stroke-[2.5]" />
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-border/50 dark:border-white/10 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1 text-rose-600 dark:text-rose-400 font-bold bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
            <Activity size={12} />
            <span>{incomeRate > 0 ? `${incomeRate}% des revenus` : 'Dépenses actives'}</span>
          </div>
          <span className="text-muted-foreground text-[11px]">{categoryCount} catégories actives</span>
        </div>
      </article>

      {/* KPI 3 : Reste à Vivre Réel Net Certifié */}
      <article
        onClick={() => handleToggle('ALL')}
        className={cn(
          "liquid-glass rounded-3xl p-5 relative overflow-hidden border-cyan-500/30 group hover:border-cyan-400/50 transition-all duration-300 cursor-pointer",
          selectedFilter === 'ALL' ? "shadow-xl shadow-cyan-500/10 scale-[1.01]" : ""
        )}
      >
        {/* Lueur d'ambiance cyan Apple */}
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-blue-500/10 to-indigo-500/5 pointer-events-none" />

        <div className="flex items-start justify-between relative z-10">
          <div className="space-y-1">
            <span className="text-xs uppercase tracking-wider text-cyan-600 dark:text-cyan-300 font-bold flex items-center space-x-1.5">
              <span>{statementStatus?.kpiTitle || 'Reste à Vivre Réel (Flux Net)'}</span>
              <ShieldCheck size={14} className="text-cyan-500" />
            </span>
            <div className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 dark:from-white dark:via-cyan-100 dark:to-cyan-300 bg-clip-text text-transparent mt-1 font-mono">
              {statementStatus?.formattedAmount || formatBankAmount(metrics.netCashFlow, currency)}
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl liquid-pill flex items-center justify-center text-cyan-500 border-cyan-400/30 shadow-md">
            <Sparkles size={20} className="stroke-[2.5]" />
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-border/50 dark:border-white/10 flex items-center justify-between text-xs relative z-10">
          <span className={cn(
            "font-semibold px-2.5 py-1 rounded-full border flex items-center space-x-1",
            isPositiveNet
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
              : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25"
          )}>
            <Check size={12} className={isPositiveNet ? "text-emerald-500" : "text-rose-500"} />
            <span>{isPositiveNet ? "Capacité d'épargne saine" : "Vigilance trésorerie"}</span>
          </span>
          <span className="text-muted-foreground text-[11px]">Virements internes neutralisés</span>
        </div>
      </article>
    </section>
  );
};

export default AppleKpiCards;
