import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Sector 
} from 'recharts';
import { 
  Tag, 
  PieChart as PieIcon, 
  Layers, 
  Sparkles, 
  Search, 
  ArrowUpDown, 
  ChevronDown, 
  ChevronUp, 
  Eye, 
  Info,
  SlidersHorizontal
} from 'lucide-react';
import { formatCurrency } from '../../../lib/bankUtils';
import { type CategoryStatsItem } from '../../../lib/categorizationRules';
import { type Transaction } from '../../../lib/kpiUtils';
import { cn } from '../../../lib/utils';

interface UnifiedCategorySectionProps {
  categoryStats: {
    categories: CategoryStatsItem[];
    totalFixed: number;
    totalVariable: number;
  };
  filteredTransactions: Transaction[];
  onSelectCategory: (category: CategoryStatsItem) => void;
  hideBalances?: boolean;
}

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

export const UnifiedCategorySection: React.FC<UnifiedCategorySectionProps> = ({
  categoryStats,
  filteredTransactions,
  onSelectCategory,
  hideBalances = false
}) => {
  const [viewMode, setViewMode] = useState<'categories' | 'nature'>('categories');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [filterNature, setFilterNature] = useState<'all' | 'fixe' | 'variable' | 'top'>('all');
  const [sortField, setSortField] = useState<'amount' | 'txCount' | 'name'>('amount');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpandedAll, setIsExpandedAll] = useState(false);

  const totalExpenses = categoryStats.totalFixed + categoryStats.totalVariable;
  const fixedRatio = totalExpenses > 0 ? (categoryStats.totalFixed / totalExpenses) * 100 : 0;
  const variableRatio = totalExpenses > 0 ? (categoryStats.totalVariable / totalExpenses) * 100 : 0;

  // Donut data by category
  const donutCategoryData = useMemo(() => {
    return categoryStats.categories.slice(0, 8).map((cat, idx) => ({
      name: cat.category,
      value: cat.totalAmount,
      percentage: totalExpenses > 0 ? (cat.totalAmount / totalExpenses) * 100 : 0,
      color: cat.color || PALETTE[idx % PALETTE.length]
    }));
  }, [categoryStats, totalExpenses]);

  // Donut data by nature (Fixed vs Variable)
  const donutNatureData = useMemo(() => {
    return [
      {
        name: 'Charges Fixes',
        value: categoryStats.totalFixed,
        percentage: fixedRatio,
        color: '#06b6d4',
        subtext: 'Loyer, énergie, abonnements'
      },
      {
        name: 'Dépenses Variables',
        value: categoryStats.totalVariable,
        percentage: variableRatio,
        color: '#f59e0b',
        subtext: 'Alimentation, sorties, loisirs'
      }
    ];
  }, [categoryStats, fixedRatio, variableRatio]);

  const activeDonutDataset = viewMode === 'categories' ? donutCategoryData : donutNatureData;

  const centerInfo = useMemo(() => {
    if (activeIndex !== null && activeDonutDataset[activeIndex]) {
      const activeItem = activeDonutDataset[activeIndex];
      return {
        label: activeItem.name,
        amount: activeItem.value,
        percentage: activeItem.percentage,
        isCustom: true
      };
    }
    return {
      label: viewMode === 'categories' ? 'Total Dépenses' : 'Dépenses Réelles',
      amount: totalExpenses,
      percentage: 100,
      isCustom: false
    };
  }, [activeIndex, activeDonutDataset, totalExpenses, viewMode]);

  // Filtered & Sorted categories for the right-hand matrix
  const filteredCategories = useMemo(() => {
    let list = [...categoryStats.categories];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(c => c.category.toLowerCase().includes(q));
    }

    if (filterNature === 'fixe') {
      list = list.filter(c => c.defaultNature === 'fixe' || c.fixedAmount > c.variableAmount);
    } else if (filterNature === 'variable') {
      list = list.filter(c => c.defaultNature === 'variable' || c.variableAmount >= c.fixedAmount);
    } else if (filterNature === 'top') {
      list = list.slice(0, 5);
    }

    list.sort((a, b) => {
      if (sortField === 'amount') return b.totalAmount - a.totalAmount;
      if (sortField === 'txCount') return b.txCount - a.txCount;
      if (sortField === 'name') return a.category.localeCompare(b.category);
      return 0;
    });

    return list;
  }, [categoryStats.categories, filterNature, sortField, searchQuery]);

  const displayedCategories = useMemo(() => {
    if (isExpandedAll || filteredCategories.length <= 6) {
      return filteredCategories;
    }
    return filteredCategories.slice(0, 6);
  }, [filteredCategories, isExpandedAll]);

  const hasHiddenCategories = filteredCategories.length > 6 && !isExpandedAll;

  return (
    <div className="w-full rounded-[32px] bg-slate-900/80 hover:bg-slate-900/90 backdrop-blur-3xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_1.5px_rgba(255,255,255,0.2)] p-6 sm:p-8 space-y-6 relative overflow-hidden">
      
      {/* Specular line */}
      <div className="absolute top-0 inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
      
      {/* =========================================================================
          HEADER UNIFIÉ : TITRE, STATS MACRO & JAUGE GLOBALE PLEINE LARGEUR
         ========================================================================= */}
      <div className="space-y-4 pb-4 border-b border-white/10">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-2xl bg-cyan-500/15 border border-cyan-500/25 text-cyan-400">
              <Tag className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Ventilation & Répartition des Dépenses
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Cartographie consolidée de vos sorties d'argent entre charges incompressibles et consommation variable
              </p>
            </div>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex items-center gap-2 self-start md:self-auto text-xs bg-white/[0.04] border border-white/10 rounded-2xl px-3.5 py-2 backdrop-blur-xl">
            <span className="flex items-center gap-1.5 text-cyan-300">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(56,189,248,0.9)]" />
              <span>Fixes :</span>
              <strong className="text-white font-black">
                {hideBalances ? "•••• €" : formatCurrency(categoryStats.totalFixed, { showSign: false })}
              </strong>
              <span className="text-[10px] text-cyan-300/80">({fixedRatio.toFixed(0)}%)</span>
            </span>
            <span className="text-white/20">|</span>
            <span className="flex items-center gap-1.5 text-amber-300">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
              <span>Variables :</span>
              <strong className="text-white font-black">
                {hideBalances ? "•••• €" : formatCurrency(categoryStats.totalVariable, { showSign: false })}
              </strong>
              <span className="text-[10px] text-amber-300/80">({variableRatio.toFixed(0)}%)</span>
            </span>
          </div>
        </div>

        {/* Global Proportional Gauge Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="w-full h-3 rounded-full bg-white/[0.08] overflow-hidden flex shadow-inner">
            <div 
              className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-500 shadow-[0_0_12px_rgba(56,189,248,0.8)]"
              style={{ width: `${fixedRatio}%` }}
              title={`Charges Fixes : ${formatCurrency(categoryStats.totalFixed, { showSign: false })} (${fixedRatio.toFixed(1)}%)`}
            />
            <div 
              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500 shadow-[0_0_12px_rgba(251,191,36,0.8)]"
              style={{ width: `${variableRatio}%` }}
              title={`Dépenses Variables : ${formatCurrency(categoryStats.totalVariable, { showSign: false })} (${variableRatio.toFixed(1)}%)`}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              Charges récurrentes incompressibles (loyer, assurances, abonnements)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Consommation quotidienne & marge d'ajustement
            </span>
          </div>
        </div>

      </div>

      {/* =========================================================================
          CONTENU PRINCIPAL : DONUT À GAUCHE (5 COLS) + MATRICE DES CATÉGORIES À DROITE (7 COLS)
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* =====================================================================
            GAUCHE (5 COLS) : DONUT INTERACTIF AVEC TOTAL AU CENTRE & BASCULE
           ===================================================================== */}
        <div className="lg:col-span-5 flex flex-col justify-between h-full bg-white/[0.02] border border-white/10 rounded-3xl p-5 space-y-4">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PieIcon size={16} className="text-indigo-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Répartition Visuelle
              </span>
            </div>

            {/* Bascule Par Catégorie / Fixe vs Variable */}
            <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-2xl border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => {
                  setViewMode('categories');
                  setActiveIndex(null);
                }}
                className={cn(
                  "px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all",
                  viewMode === 'categories' 
                    ? "bg-white/15 text-white border border-white/20 shadow-xs" 
                    : "text-slate-400 hover:text-white"
                )}
              >
                Catégories
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode('nature');
                  setActiveIndex(null);
                }}
                className={cn(
                  "px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all",
                  viewMode === 'nature' 
                    ? "bg-white/15 text-white border border-white/20 shadow-xs" 
                    : "text-slate-400 hover:text-white"
                )}
              >
                Fixe / Var
              </button>
            </div>
          </div>

          {/* Donut Chart Container */}
          <div className="relative w-full h-[260px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  activeIndex={activeIndex !== null ? activeIndex : undefined}
                  activeShape={renderActiveShape}
                  data={activeDonutDataset}
                  cx="50%"
                  cy="50%"
                  innerRadius={68}
                  outerRadius={98}
                  paddingAngle={3}
                  dataKey="value"
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  {activeDonutDataset.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color} 
                      stroke="rgba(255,255,255,0.15)"
                      strokeWidth={1}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {/* Total / Active Category display in the hole */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate max-w-[140px]">
                {centerInfo.label}
              </span>
              <span className="text-xl sm:text-2xl font-black text-white tracking-tight leading-none mt-1">
                {hideBalances ? "•••• €" : formatCurrency(centerInfo.amount, { showSign: false })}
              </span>
              <span className="text-[11px] font-bold text-cyan-300 mt-0.5">
                {centerInfo.percentage.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Mini Légende des Top Dépenses */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-[11px]">
            {activeDonutDataset.slice(0, 4).map((item) => (
              <div key={item.name} className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-slate-300 truncate">{item.name}</span>
                <span className="text-slate-400 font-bold ml-auto">{item.percentage.toFixed(0)}%</span>
              </div>
            ))}
          </div>

        </div>

        {/* =====================================================================
            DROITE (7 COLS) : MATRICE DES CATÉGORIES AVEC FILTRES & AUDIT DIRECT
           ===================================================================== */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Controls Bar : Filtres + Recherche + Tri */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            
            <div className="flex flex-wrap items-center gap-1.5 bg-white/[0.04] p-1 rounded-2xl border border-white/10">
              <button
                type="button"
                onClick={() => setFilterNature('all')}
                className={cn(
                  "px-3 py-1 rounded-xl text-xs font-bold transition-all",
                  filterNature === 'all' 
                    ? "bg-white/15 text-white border border-white/20 shadow-xs" 
                    : "text-slate-400 hover:text-white"
                )}
              >
                Toutes ({categoryStats.categories.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterNature('fixe')}
                className={cn(
                  "px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                  filterNature === 'fixe' 
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs" 
                    : "text-slate-400 hover:text-cyan-300"
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> Fixes
              </button>
              <button
                type="button"
                onClick={() => setFilterNature('variable')}
                className={cn(
                  "px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                  filterNature === 'variable' 
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs" 
                    : "text-slate-400 hover:text-amber-300"
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Variables
              </button>
              <button
                type="button"
                onClick={() => setFilterNature('top')}
                className={cn(
                  "px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1",
                  filterNature === 'top' 
                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-xs" 
                    : "text-slate-400 hover:text-indigo-300"
                )}
              >
                <Sparkles className="w-3 h-3 text-indigo-400" /> Top 5
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-44">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <button
                type="button"
                onClick={() => setSortField(sortField === 'amount' ? 'txCount' : 'amount')}
                className="px-2.5 py-1 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 shrink-0"
                title="Changer le tri"
              >
                <ArrowUpDown className="w-3 h-3 text-cyan-400" />
                <span className="hidden sm:inline">Tri:</span>
                <span className="font-bold">{sortField === 'amount' ? 'Montant' : 'Opérations'}</span>
              </button>
            </div>

          </div>

          {/* Grille des Cartes de Catégories */}
          {displayedCategories.length === 0 ? (
            <div className="py-12 text-center text-slate-400 rounded-3xl bg-white/[0.02] border border-white/10">
              <Info className="w-8 h-8 mx-auto mb-2 opacity-40 text-cyan-400" />
              <p className="text-sm font-semibold">Aucune catégorie ne correspond aux critères.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {displayedCategories.map((catItem) => {
                const isFixe = catItem.defaultNature === 'fixe';
                const fixedRatioCategory = catItem.totalAmount > 0 
                  ? (catItem.fixedAmount / catItem.totalAmount) * 100 
                  : 0;
                const variableRatioCategory = catItem.totalAmount > 0 
                  ? (catItem.variableAmount / catItem.totalAmount) * 100 
                  : 0;

                return (
                  <div
                    key={catItem.category}
                    onClick={() => onSelectCategory(catItem)}
                    className="rounded-[24px] bg-white/[0.05] hover:bg-white/[0.10] backdrop-blur-2xl p-4 sm:p-5 border border-white/15 hover:border-white/35 shadow-[0_10px_25px_rgba(0,0,0,0.25),inset_0_1px_1px_rgba(255,255,255,0.2)] transition-all duration-300 cursor-pointer group flex flex-col justify-between relative overflow-hidden active:scale-[0.99]"
                  >
                    <div>
                      {/* En-tête de carte catégorie */}
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div 
                            className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 text-white font-black text-xs shadow-md border border-white/25 transition-transform group-hover:scale-105"
                            style={{ backgroundColor: catItem.color || '#06b6d4' }}
                          >
                            {catItem.category.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-cyan-200 transition-colors" title={catItem.category}>
                              {catItem.category}
                            </h4>
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              {catItem.txCount} opérations • {catItem.percentage.toFixed(1)}% du budget
                            </span>
                          </div>
                        </div>

                        <span className={cn(
                          "text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0 border uppercase tracking-wider",
                          isFixe 
                            ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/35" 
                            : "bg-amber-500/20 text-amber-300 border-amber-500/35"
                        )}>
                          {isFixe ? 'Charge Fixe' : 'Dépense Variable'}
                        </span>
                      </div>

                      {/* Montant principal */}
                      <div className="mt-3 flex items-baseline justify-between">
                        <span className="text-xs text-slate-400 font-medium">Total débité</span>
                        <span className="text-base sm:text-lg font-black text-white group-hover:text-cyan-300 transition-colors">
                          {hideBalances ? "•••• €" : formatCurrency(catItem.totalAmount, { showSign: false })}
                        </span>
                      </div>

                      {/* Jauge bicolore Fixe vs Variable */}
                      <div className="mt-2.5 w-full h-2 rounded-full bg-white/[0.08] overflow-hidden flex shadow-inner">
                        <div 
                          className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-500 shadow-[0_0_8px_rgba(56,189,248,0.8)]" 
                          style={{ width: `${fixedRatioCategory}%` }}
                          title={`Part Fixe : ${formatCurrency(catItem.fixedAmount, { showSign: false })} (${fixedRatioCategory.toFixed(0)}%)`}
                        />
                        <div 
                          className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500 shadow-[0_0_8px_rgba(251,191,36,0.8)]" 
                          style={{ width: `${variableRatioCategory}%` }}
                          title={`Part Variable : ${formatCurrency(catItem.variableAmount, { showSign: false })} (${variableRatioCategory.toFixed(0)}%)`}
                        />
                      </div>
                    </div>

                    {/* Pied de carte avec pilule d'action */}
                    <div className="mt-3.5 pt-2.5 border-t border-white/10 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-400">
                        {isFixe ? 'Dépense récurrente' : 'Consommation courante'}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 group-hover:bg-cyan-500/25 group-hover:text-cyan-200 text-white font-bold text-[11px] border border-white/20 transition-all">
                        <span>Détails & audit</span>
                        <Eye size={12} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Accordion Expand Button */}
          {hasHiddenCategories && (
            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={() => setIsExpandedAll(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#DCF5E9] to-[#C6EFE0] hover:from-white hover:to-[#DCF5E9] text-[#06331E] font-black text-xs shadow-md border border-white/80 transition-all active:scale-95 cursor-pointer"
              >
                <span>Afficher toutes les catégories ({filteredCategories.length})</span>
                <ChevronDown className="w-4 h-4 text-[#06331E] animate-bounce" />
              </button>
            </div>
          )}

          {isExpandedAll && filteredCategories.length > 6 && (
            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={() => setIsExpandedAll(false)}
                className="flex items-center gap-2 px-4 py-1.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-bold text-slate-300 transition-all"
              >
                <span>Réduire la vue</span>
                <ChevronUp className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
