import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip,
  Sector
} from 'recharts';
import { 
  PieChart as PieIcon, 
  Layers, 
  ArrowRight, 
  Info,
  ChevronRight,
  ShieldCheck,
  TrendingDown
} from 'lucide-react';
import { formatCurrency } from '../../../lib/bankUtils';
import { buildCategoryBreakdown, type Transaction } from '../../../lib/kpiUtils';
import { calculateCategoryStats } from '../../../lib/categorizationRules';
import { cn } from '../../../lib/utils';

interface CategoryBreakdownChartProps {
  filteredTransactions: Transaction[];
  onSelectCategory?: (categoryName: string) => void;
  loading?: boolean;
}

// Sophisticated high-tech palette (Cyan, Emerald, Violet, Amber, Rose, Indigo, Teal, Blue)
const PALETTE = [
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#8b5cf6', // Violet
  '#f59e0b', // Amber
  '#f43f5e', // Rose
  '#6366f1', // Indigo
  '#14b8a6', // Teal
  '#3b82f6', // Blue
  '#ec4899', // Pink
  '#64748b'  // Slate
];

// Active sector custom renderer with subtle outer glow
const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{ filter: 'drop-shadow(0px 0px 8px rgba(255,255,255,0.4))' }}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={innerRadius + 3}
        startAngle={startAngle}
        endAngle={endAngle}
        fill="#ffffff"
      />
    </g>
  );
};

export const CategoryBreakdownChart: React.FC<CategoryBreakdownChartProps> = ({
  filteredTransactions,
  onSelectCategory,
  loading = false
}) => {
  const [viewMode, setViewMode] = useState<'categories' | 'nature'>('categories');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // 1. Categories Breakdown (Top 6 + Autres)
  const categoryData = useMemo(() => {
    const rawBreakdown = buildCategoryBreakdown(filteredTransactions);
    if (rawBreakdown.length === 0) return [];

    const totalVal = rawBreakdown.reduce((acc, curr) => acc + curr.value, 0);

    if (rawBreakdown.length <= 6) {
      return rawBreakdown.map((item, idx) => ({
        ...item,
        percentage: totalVal > 0 ? (item.value / totalVal) * 100 : 0,
        color: PALETTE[idx % PALETTE.length]
      }));
    }

    const topItems = rawBreakdown.slice(0, 5).map((item, idx) => ({
      ...item,
      percentage: totalVal > 0 ? (item.value / totalVal) * 100 : 0,
      color: PALETTE[idx % PALETTE.length]
    }));

    const otherItems = rawBreakdown.slice(5);
    const otherVal = otherItems.reduce((acc, curr) => acc + curr.value, 0);

    topItems.push({
      name: 'Autres catégories',
      value: Math.round(otherVal * 100) / 100,
      percentage: totalVal > 0 ? (otherVal / totalVal) * 100 : 0,
      color: '#64748b'
    });

    return topItems;
  }, [filteredTransactions]);

  // 2. Nature Breakdown (Fixe vs Variable)
  const natureData = useMemo(() => {
    const stats = calculateCategoryStats(filteredTransactions);
    const total = stats.totalFixed + stats.totalVariable;
    if (total === 0) return [];

    return [
      {
        name: 'Charges Fixes',
        value: stats.totalFixed,
        percentage: (stats.totalFixed / total) * 100,
        color: '#06b6d4',
        subtext: 'Loyer, énergies, assurances, abonnements'
      },
      {
        name: 'Dépenses Variables',
        value: stats.totalVariable,
        percentage: (stats.totalVariable / total) * 100,
        color: '#f59e0b',
        subtext: 'Alimentation, sorties, loisirs, imprévus'
      }
    ];
  }, [filteredTransactions]);

  const activeDataset = viewMode === 'categories' ? categoryData : natureData;
  const totalAmount = useMemo(() => {
    return activeDataset.reduce((acc, item) => acc + item.value, 0);
  }, [activeDataset]);

  // Information displayed in the donut hole center
  const centerInfo = useMemo(() => {
    if (activeIndex !== null && activeDataset[activeIndex]) {
      const activeItem = activeDataset[activeIndex];
      return {
        label: activeItem.name,
        amount: activeItem.value,
        percentage: activeItem.percentage,
        isCustom: true
      };
    }
    return {
      label: viewMode === 'categories' ? 'Total Dépenses' : 'Dépenses Réelles',
      amount: totalAmount,
      percentage: 100,
      isCustom: false
    };
  }, [activeIndex, activeDataset, totalAmount, viewMode]);

  return (
    <div className="rounded-3xl bg-white/[0.04] backdrop-blur-2xl p-4 sm:p-6 border border-white/10 shadow-[0_16px_36px_rgba(0,0,0,0.4)] flex flex-col justify-between h-full min-h-[500px]">
      
      {/* Header & View Mode Switcher */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-indigo-500/15 border border-indigo-500/25 text-indigo-300">
                <PieIcon className="w-4 h-4" />
              </span>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  Ventilation Analytique
                </span>
                <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                  Top Catégories de Dépenses
                </h3>
              </div>
            </div>
          </div>

          {/* Toggle between Category and Nature */}
          <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-2xl border border-white/10 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => {
                setViewMode('categories');
                setActiveIndex(null);
              }}
              className={cn(
                "px-2.5 py-1 rounded-xl text-xs font-bold transition-all",
                viewMode === 'categories' 
                  ? "bg-white/15 text-white border border-white/20 shadow-sm" 
                  : "text-slate-400 hover:text-white"
              )}
            >
              Par Catégorie
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('nature');
                setActiveIndex(null);
              }}
              className={cn(
                "px-2.5 py-1 rounded-xl text-xs font-bold transition-all",
                viewMode === 'nature' 
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm" 
                  : "text-slate-400 hover:text-cyan-300"
              )}
            >
              Fixe vs Variable
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Donut & Center Stage */}
      <div className="py-4">
        {loading ? (
          <div className="h-[240px] flex items-center justify-center">
            <div className="w-44 h-44 rounded-full border-4 border-white/10 border-t-cyan-400 animate-spin" />
          </div>
        ) : activeDataset.length === 0 ? (
          <div className="h-[240px] flex flex-col items-center justify-center text-slate-400">
            <Info className="w-8 h-8 mb-2 opacity-30 text-cyan-400" />
            <p className="text-xs">Aucune dépense recensée pour cette période.</p>
          </div>
        ) : (
          <div className="relative h-[230px] sm:h-[250px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  activeIndex={activeIndex !== null ? activeIndex : undefined}
                  activeShape={renderActiveShape}
                  data={activeDataset}
                  cx="50%"
                  cy="50%"
                  innerRadius={68}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  onClick={(entry) => {
                    if (entry?.name && viewMode === 'categories' && onSelectCategory) {
                      onSelectCategory(entry.name);
                    }
                  }}
                  className="cursor-pointer outline-none focus:outline-none"
                >
                  {activeDataset.map((entry, idx) => (
                    <Cell 
                      key={`cell-${idx}`} 
                      fill={entry.color || PALETTE[idx % PALETTE.length]} 
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {/* Central Stage Overlay (Hover details & Totals) */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider truncate max-w-[130px]">
                {centerInfo.label}
              </span>
              <span className="text-lg sm:text-xl font-black text-white drop-shadow-md">
                {formatCurrency(centerInfo.amount, { showSign: false })}
              </span>
              <span className={cn(
                "text-[10px] font-black px-2 py-0.5 rounded-full mt-1 border",
                centerInfo.isCustom 
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" 
                  : "bg-white/10 text-slate-300 border-white/10"
              )}>
                {centerInfo.percentage.toFixed(1)} %
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Precision Legend */}
      <div className="pt-3 border-t border-white/10">
        <div className="space-y-1.5 max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
          {activeDataset.map((item, idx) => {
            const isHovered = activeIndex === idx;
            return (
              <div
                key={item.name}
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseLeave={() => setActiveIndex(null)}
                onClick={() => {
                  if (viewMode === 'categories' && onSelectCategory) {
                    onSelectCategory(item.name);
                  }
                }}
                className={cn(
                  "flex items-center justify-between p-1.5 px-2.5 rounded-xl cursor-pointer transition-all duration-200 group text-xs",
                  isHovered 
                    ? "bg-white/[0.1] border border-white/20 translate-x-1" 
                    : "hover:bg-white/[0.05] border border-transparent"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span 
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm transition-transform group-hover:scale-125" 
                    style={{ backgroundColor: item.color }} 
                  />
                  <span className="font-bold text-slate-200 truncate group-hover:text-white" title={item.name}>
                    {item.name}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="font-extrabold text-white">
                    {formatCurrency(item.value, { showSign: false })}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 bg-white/[0.06] border border-white/10 px-1.5 py-0.5 rounded-md min-w-[42px] text-right">
                    {item.percentage.toFixed(1)} %
                  </span>
                  {viewMode === 'categories' && (
                    <ChevronRight size={13} className="text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-transform" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {viewMode === 'categories' && (
          <p className="text-[10px] text-slate-400 mt-2 text-center">
            💡 Cliquez sur une tranche ou un élément pour ouvrir son audit d'opérations
          </p>
        )}
      </div>

    </div>
  );
};
