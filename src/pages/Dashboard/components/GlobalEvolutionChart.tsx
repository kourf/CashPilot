import React, { useState, useMemo } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Calendar, 
  Sparkles, 
  Layers, 
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Info
} from 'lucide-react';
import { formatCurrency, formatDateFR } from '../../../lib/bankUtils';
import { formatMonthLabel, type Transaction } from '../../../lib/kpiUtils';
import { cn } from '../../../lib/utils';

interface GlobalEvolutionChartProps {
  transactions: Transaction[];
  filteredTransactions: Transaction[];
  selectedMonth: string;
  isDemo?: boolean;
  loading?: boolean;
}

type MetricFilter = 'both' | 'net' | 'income' | 'expense';
type TimeGranularity = 'auto' | 'daily' | 'monthly';

export const GlobalEvolutionChart: React.FC<GlobalEvolutionChartProps> = ({
  transactions,
  filteredTransactions,
  selectedMonth,
  isDemo = false,
  loading = false
}) => {
  const [metricFilter, setMetricFilter] = useState<MetricFilter>('both');
  const [intraMonthView, setIntraMonthView] = useState<'daily' | 'monthly'>('daily');

  const isAllMonths = selectedMonth === 'all';

  // Demo fallback data
  const demoMonthlyData = [
    { name: 'Jan 2026', key: '2026-01', revenus: 3800, depenses: 2450, net: 1350 },
    { name: 'Fév 2026', key: '2026-02', revenus: 3200, depenses: 1980, net: 1220 },
    { name: 'Mar 2026', key: '2026-03', revenus: 4100, depenses: 3200, net: 900 },
    { name: 'Avr 2026', key: '2026-04', revenus: 3500, depenses: 2600, net: 900 },
    { name: 'Mai 2026', key: '2026-05', revenus: 4800, depenses: 3100, net: 1700 },
    { name: 'Juin 2026', key: '2026-06', revenus: 4300, depenses: 2950, net: 1350 },
  ];

  // 1. Monthly Aggregated Data across all transactions
  const monthlyData = useMemo(() => {
    if (isDemo) return demoMonthlyData;

    const map: Record<string, { key: string; name: string; revenus: number; depenses: number; net: number }> = {};

    transactions.forEach((t) => {
      const monthKey = t.monthKey || (t.date ? t.date.substring(0, 7) : '') || 'Inconnu';
      if (!map[monthKey]) {
        map[monthKey] = {
          key: monthKey,
          name: formatMonthLabel(monthKey),
          revenus: 0,
          depenses: 0,
          net: 0
        };
      }
      const amt = Number(t.amount) || 0;
      const isInternal = t.isInternalTransfer || t.category === 'Virements internes';
      if (amt > 0 && !isInternal) {
        map[monthKey].revenus += amt;
      } else if (amt < 0 && !isInternal && t.category !== 'Épargne') {
        map[monthKey].depenses += Math.abs(amt);
      }
    });

    return Object.values(map)
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((item) => ({
        ...item,
        net: item.revenus - item.depenses
      }));
  }, [transactions, isDemo]);

  // 2. Daily Aggregated Data for the selected month (intra-month progression)
  const dailyData = useMemo(() => {
    if (isDemo || isAllMonths) return [];

    const map: Record<string, { day: string; date: string; revenus: number; depenses: number; net: number; cumulNet: number }> = {};

    // Sort filtered transactions chronologically
    const sorted = [...filteredTransactions].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    sorted.forEach((t) => {
      if (!t.date) return;
      const dayKey = t.date.substring(8, 10) || t.date;
      const fullDate = t.date;

      if (!map[fullDate]) {
        map[fullDate] = {
          day: `${parseInt(dayKey, 10)} ${new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(new Date(fullDate))}`,
          date: fullDate,
          revenus: 0,
          depenses: 0,
          net: 0,
          cumulNet: 0
        };
      }

      const amt = Number(t.amount) || 0;
      const isInternal = t.isInternalTransfer || t.category === 'Virements internes';
      if (amt > 0 && !isInternal) {
        map[fullDate].revenus += amt;
      } else if (amt < 0 && !isInternal && t.category !== 'Épargne') {
        map[fullDate].depenses += Math.abs(amt);
      }
    });

    let runningCumul = 0;
    return Object.values(map)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((item) => {
        const netDay = item.revenus - item.depenses;
        runningCumul += netDay;
        return {
          ...item,
          name: item.day,
          net: netDay,
          cumulNet: runningCumul
        };
      });
  }, [filteredTransactions, isAllMonths, isDemo]);

  // Determine current active dataset
  const activeData = useMemo(() => {
    if (isAllMonths) return monthlyData;
    if (intraMonthView === 'daily' && dailyData.length > 0) return dailyData;
    return monthlyData;
  }, [isAllMonths, intraMonthView, dailyData, monthlyData]);

  // Summary statistics for the currently active data
  const stats = useMemo(() => {
    if (activeData.length === 0) {
      return { totalRevenus: 0, totalDepenses: 0, soldeNet: 0, epargneRate: 0 };
    }
    const totalRevenus = activeData.reduce((acc, d) => acc + (d.revenus || 0), 0);
    const totalDepenses = activeData.reduce((acc, d) => acc + (d.depenses || 0), 0);
    const soldeNet = totalRevenus - totalDepenses;
    const epargneRate = totalRevenus > 0 ? (Math.max(0, soldeNet) / totalRevenus) * 100 : 0;
    return { totalRevenus, totalDepenses, soldeNet, epargneRate };
  }, [activeData]);

  // High-Tech Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const dataItem = payload[0]?.payload;
    const rev = dataItem?.revenus || 0;
    const dep = dataItem?.depenses || 0;
    const net = rev - dep;
    const isNetPos = net >= 0;

    return (
      <div className="rounded-2xl bg-[#090e1f]/95 backdrop-blur-2xl border border-white/20 p-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.85)] text-slate-100 min-w-[210px] space-y-2.5">
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <span className="text-xs font-black text-white flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            {dataItem?.date ? formatDateFR(dataItem.date) : label}
          </span>
          <span className={cn(
            "text-[9px] font-bold px-1.5 py-0.5 rounded-full border",
            isNetPos ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-rose-500/15 text-rose-300 border-rose-500/30"
          )}>
            {isNetPos ? 'Excédent' : 'Déficit'}
          </span>
        </div>

        <div className="space-y-1.5 text-xs">
          {(metricFilter === 'both' || metricFilter === 'income') && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                Revenus
              </span>
              <span className="font-extrabold text-emerald-400">
                +{formatCurrency(rev, { showSign: false })}
              </span>
            </div>
          )}

          {(metricFilter === 'both' || metricFilter === 'expense') && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
                Dépenses
              </span>
              <span className="font-extrabold text-rose-400">
                -{formatCurrency(dep, { showSign: false })}
              </span>
            </div>
          )}

          <div className="pt-1.5 border-t border-white/10 flex items-center justify-between text-xs">
            <span className="text-slate-300 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
              Solde Net
            </span>
            <span className={cn("font-black", isNetPos ? "text-emerald-300" : "text-rose-300")}>
              {isNetPos ? '+' : ''}{formatCurrency(net, { showSign: false })}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-3xl bg-white/[0.04] backdrop-blur-2xl p-4 sm:p-6 border border-white/10 shadow-[0_16px_36px_rgba(0,0,0,0.4)] flex flex-col justify-between h-full min-h-[500px]">
      
      {/* Header controls & summary stats */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/25 text-cyan-400">
                <Activity className="w-4 h-4" />
              </span>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  Dynamique Temporelle & Flux
                </span>
                <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                  Évolution {isAllMonths ? 'Globale Consolidée' : `${formatMonthLabel(selectedMonth)}`}
                </h3>
              </div>
            </div>
          </div>

          {/* Metric View Filters */}
          <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto bg-slate-900/60 p-1 rounded-2xl border border-white/10 backdrop-blur-xl">
            <button
              type="button"
              onClick={() => setMetricFilter('both')}
              className={cn(
                "px-2.5 py-1 rounded-xl text-xs font-bold transition-all",
                metricFilter === 'both' 
                  ? "bg-white/15 text-white shadow-sm border border-white/20" 
                  : "text-slate-400 hover:text-white"
              )}
            >
              Tous les flux
            </button>
            <button
              type="button"
              onClick={() => setMetricFilter('net')}
              className={cn(
                "px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1",
                metricFilter === 'net' 
                  ? "bg-cyan-500/20 text-cyan-300 shadow-sm border border-cyan-500/40" 
                  : "text-slate-400 hover:text-cyan-300"
              )}
            >
              <Sparkles className="w-3 h-3 text-cyan-400" /> Flux Net
            </button>
            <button
              type="button"
              onClick={() => setMetricFilter('income')}
              className={cn(
                "px-2.5 py-1 rounded-xl text-xs font-bold transition-all",
                metricFilter === 'income' 
                  ? "bg-emerald-500/20 text-emerald-300 shadow-sm border border-emerald-500/40" 
                  : "text-slate-400 hover:text-emerald-300"
              )}
            >
              Revenus
            </button>
            <button
              type="button"
              onClick={() => setMetricFilter('expense')}
              className={cn(
                "px-2.5 py-1 rounded-xl text-xs font-bold transition-all",
                metricFilter === 'expense' 
                  ? "bg-rose-500/20 text-rose-300 shadow-sm border border-rose-500/40" 
                  : "text-slate-400 hover:text-rose-300"
              )}
            >
              Dépenses
            </button>
          </div>
        </div>

        {/* Dynamic Context Bar (KPI capsules above chart) avec Flèches explicites */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-3 border-b border-white/5 my-2">
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-2.5">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
              <span>Total Entrées</span>
              <ArrowUpRight size={13} className="text-emerald-400" />
            </div>
            <span className="text-xs sm:text-sm font-black text-emerald-400 block mt-1">
              +{formatCurrency(stats.totalRevenus, { showSign: false })}
            </span>
          </div>
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-2.5">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
              <span>Total Sorties</span>
              <ArrowDownRight size={13} className="text-rose-400" />
            </div>
            <span className="text-xs sm:text-sm font-black text-rose-400 block mt-1">
              -{formatCurrency(stats.totalDepenses, { showSign: false })}
            </span>
          </div>
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-2.5">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
              <span>Flux Net</span>
              {stats.soldeNet >= 0 ? (
                <TrendingUp size={13} className="text-emerald-400" />
              ) : (
                <TrendingDown size={13} className="text-rose-400" />
              )}
            </div>
            <span className={cn(
              "text-xs sm:text-sm font-black block mt-1",
              stats.soldeNet >= 0 ? "text-emerald-400" : "text-rose-400"
            )}>
              {stats.soldeNet >= 0 ? '+' : ''}{formatCurrency(stats.soldeNet, { showSign: false })}
            </span>
          </div>
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-2.5">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
              <span>Taux d'Épargne</span>
              <Sparkles size={13} className="text-cyan-400" />
            </div>
            <span className="text-xs sm:text-sm font-black text-cyan-400 block mt-1">
              {(stats?.epargneRate ?? 0).toFixed(1)} %
            </span>
          </div>
        </div>

        {/* Légende Visuelle Explicite avec Flèches de visualisation */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl bg-slate-900/60 border border-white/10 text-xs my-2">
          <div className="flex items-center gap-1.5 text-slate-300 font-bold">
            <Activity size={14} className="text-cyan-400" />
            <span>Légende du graphique :</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-xs font-semibold">
            <div className="flex items-center gap-1.5 text-emerald-300">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
              <ArrowUpRight size={14} className="text-emerald-400" />
              <span>Courbe Verte : Entrées (Revenus)</span>
            </div>
            <div className="flex items-center gap-1.5 text-rose-300">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.9)]" />
              <ArrowDownRight size={14} className="text-rose-400" />
              <span>Courbe Rouge : Sorties (Dépenses)</span>
            </div>
            <div className="flex items-center gap-1.5 text-cyan-300">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(56,189,248,0.9)]" />
              <TrendingUp size={14} className="text-cyan-400" />
              <span>Courbe Bleue : Solde / Flux Net</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="pt-2 min-h-[300px] flex-1">
        {loading ? (
          <div className="h-[280px] w-full flex items-end gap-2 px-2 pb-4">
            {[35, 60, 45, 80, 55, 75, 50, 85].map((h, i) => (
              <div 
                key={i} 
                className="w-full bg-white/[0.06] rounded-2xl animate-pulse" 
                style={{ height: `${h}%` }} 
              />
            ))}
          </div>
        ) : activeData.length === 0 ? (
          <div className="h-[280px] w-full flex flex-col items-center justify-center text-slate-400">
            <Info className="w-8 h-8 mb-2 opacity-30 text-cyan-400" />
            <p className="text-xs">Données insuffisantes pour tracer la courbe temporelle.</p>
          </div>
        ) : (
          <div className="h-[280px] sm:h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activeData} margin={{ top: 15, right: 12, left: -18, bottom: 0 }}>
                <defs>
                  {/* Emerald Income Gradient */}
                  <linearGradient id="colorGlowRevenus" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.45} />
                    <stop offset="60%" stopColor="#10B981" stopOpacity={0.10} />
                    <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>

                  {/* Rose Expense Gradient */}
                  <linearGradient id="colorGlowDepenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F43F5E" stopOpacity={0.45} />
                    <stop offset="60%" stopColor="#F43F5E" stopOpacity={0.10} />
                    <stop offset="100%" stopColor="#F43F5E" stopOpacity={0} />
                  </linearGradient>

                  {/* Cyan Net Flow Gradient */}
                  <linearGradient id="colorGlowNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06B6D4" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#06B6D4" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.07)" />
                
                <XAxis 
                  dataKey="name" 
                  stroke="rgba(255,255,255,0.4)" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false}
                  tickMargin={8}
                />
                
                <YAxis 
                  stroke="rgba(255,255,255,0.4)" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(val: number) => `${Math.round(val)} €`}
                />

                <Tooltip content={<CustomTooltip />} />

                {/* Optional Zero Line for Net flow */}
                {metricFilter === 'net' && (
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
                )}

                {/* Revenus Area */}
                {(metricFilter === 'both' || metricFilter === 'income') && (
                  <Area 
                    type="monotone" 
                    dataKey="revenus" 
                    name="Revenus"
                    stroke="#10B981" 
                    strokeWidth={2.5} 
                    fillOpacity={1} 
                    fill="url(#colorGlowRevenus)" 
                    dot={{ r: 2.5, fill: '#10B981', strokeWidth: 1, stroke: '#070a14' }}
                    activeDot={{ r: 6, fill: '#10B981', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                )}

                {/* Dépenses Area */}
                {(metricFilter === 'both' || metricFilter === 'expense') && (
                  <Area 
                    type="monotone" 
                    dataKey="depenses" 
                    name="Dépenses"
                    stroke="#F43F5E" 
                    strokeWidth={2.5} 
                    fillOpacity={1} 
                    fill="url(#colorGlowDepenses)" 
                    dot={{ r: 2.5, fill: '#F43F5E', strokeWidth: 1, stroke: '#070a14' }}
                    activeDot={{ r: 6, fill: '#F43F5E', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                )}

                {/* Net Cashflow Area */}
                {metricFilter === 'net' && (
                  <Area 
                    type="monotone" 
                    dataKey="net" 
                    name="Flux Net"
                    stroke="#06B6D4" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorGlowNet)" 
                    dot={{ r: 3, fill: '#06B6D4', strokeWidth: 1, stroke: '#ffffff' }}
                    activeDot={{ r: 7, fill: '#06B6D4', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Footer controls: switch daily vs monthly if single month selected */}
      {!isAllMonths && dailyData.length > 0 && (
        <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5 text-[11px]">
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            Mode d'affichage temporel :
          </span>
          <div className="flex items-center gap-1 bg-white/[0.04] p-0.5 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => setIntraMonthView('daily')}
              className={cn(
                "px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-all",
                intraMonthView === 'daily' 
                  ? "bg-cyan-500/25 text-cyan-200 border border-cyan-500/30" 
                  : "text-slate-400 hover:text-white"
              )}
            >
              Jour par jour ({dailyData.length} j.)
            </button>
            <button
              type="button"
              onClick={() => setIntraMonthView('monthly')}
              className={cn(
                "px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-all",
                intraMonthView === 'monthly' 
                  ? "bg-cyan-500/25 text-cyan-200 border border-cyan-500/30" 
                  : "text-slate-400 hover:text-white"
              )}
            >
              Vue comparative (12 mois)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
