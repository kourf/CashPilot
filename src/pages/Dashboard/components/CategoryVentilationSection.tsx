import React, { useState, useMemo } from 'react';
import { 
  Tag, 
  Layers, 
  CreditCard, 
  Eye, 
  ChevronDown, 
  ChevronUp, 
  SlidersHorizontal,
  Sparkles,
  ArrowUpDown,
  Search,
  Info
} from 'lucide-react';
import { formatCurrency } from '../../../lib/bankUtils';
import { type CategoryStatsItem } from '../../../lib/categorizationRules';
import { cn } from '../../../lib/utils';

interface CategoryVentilationSectionProps {
  categoryStats: {
    categories: CategoryStatsItem[];
    totalFixed: number;
    totalVariable: number;
  };
  onSelectCategory: (category: CategoryStatsItem) => void;
}

type FilterNature = 'all' | 'fixe' | 'variable' | 'top';
type SortField = 'amount' | 'txCount' | 'name';

export const CategoryVentilationSection: React.FC<CategoryVentilationSectionProps> = ({
  categoryStats,
  onSelectCategory
}) => {
  const [filterNature, setFilterNature] = useState<FilterNature>('all');
  const [sortField, setSortField] = useState<SortField>('amount');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpandedAll, setIsExpandedAll] = useState(false);

  const totalExpenses = categoryStats.totalFixed + categoryStats.totalVariable;
  const fixedRatio = totalExpenses > 0 ? (categoryStats.totalFixed / totalExpenses) * 100 : 0;
  const variableRatio = totalExpenses > 0 ? (categoryStats.totalVariable / totalExpenses) * 100 : 0;

  // Filter & Sort
  const filteredCategories = useMemo(() => {
    let list = [...categoryStats.categories];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(c => c.category.toLowerCase().includes(q));
    }

    // Filter by nature
    if (filterNature === 'fixe') {
      list = list.filter(c => c.defaultNature === 'fixe' || c.fixedAmount > c.variableAmount);
    } else if (filterNature === 'variable') {
      list = list.filter(c => c.defaultNature === 'variable' || c.variableAmount >= c.fixedAmount);
    } else if (filterNature === 'top') {
      list = list.slice(0, 5);
    }

    // Sort
    list.sort((a, b) => {
      if (sortField === 'amount') return b.totalAmount - a.totalAmount;
      if (sortField === 'txCount') return b.txCount - a.txCount;
      if (sortField === 'name') return a.category.localeCompare(b.category);
      return 0;
    });

    return list;
  }, [categoryStats.categories, filterNature, sortField, searchQuery]);

  // Show top 8 by default, expand if user toggles or if there are <= 8 items
  const displayedCategories = useMemo(() => {
    if (isExpandedAll || filteredCategories.length <= 8) {
      return filteredCategories;
    }
    return filteredCategories.slice(0, 8);
  }, [filteredCategories, isExpandedAll]);

  const hasHiddenCategories = filteredCategories.length > 8 && !isExpandedAll;

  return (
    <div className="space-y-4">
      
      {/* Section Header with Macro Split Indicator (Fixe vs Variable) */}
      <div className="rounded-3xl bg-white/[0.04] backdrop-blur-2xl p-5 border border-white/10 shadow-[0_16px_36px_rgba(0,0,0,0.35)] space-y-4">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/25 text-cyan-400">
                <Tag className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                  Ventilation par Catégorie & Nature budgétaire
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Répartition rigoureuse de vos sorties d'argent entre charges incompressibles et consommation variable
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex items-center gap-2 self-start md:self-auto text-xs bg-slate-900/60 border border-white/10 rounded-2xl px-3.5 py-2 backdrop-blur-xl">
            <span className="flex items-center gap-1.5 text-cyan-300">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(56,189,248,0.9)]" />
              <span>Fixes :</span>
              <strong className="text-white font-black">{formatCurrency(categoryStats.totalFixed, { showSign: false })}</strong>
              <span className="text-[10px] text-cyan-300/80">({(fixedRatio ?? 0).toFixed(0)}%)</span>
            </span>
            <span className="text-white/20">|</span>
            <span className="flex items-center gap-1.5 text-amber-300">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
              <span>Variables :</span>
              <strong className="text-white font-black">{formatCurrency(categoryStats.totalVariable, { showSign: false })}</strong>
              <span className="text-[10px] text-amber-300/80">({(variableRatio ?? 0).toFixed(0)}%)</span>
            </span>
          </div>
        </div>

        {/* Global Proportional Gauge Bar */}
        <div className="space-y-1.5">
          <div className="w-full h-2.5 rounded-full bg-white/[0.08] overflow-hidden flex shadow-inner">
            <div 
              className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-500 shadow-[0_0_12px_rgba(56,189,248,0.8)]"
              style={{ width: `${fixedRatio}%` }}
              title={`Charges Fixes : ${formatCurrency(categoryStats.totalFixed, { showSign: false })} (${(fixedRatio ?? 0).toFixed(1)}%)`}
            />
            <div 
              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500 shadow-[0_0_12px_rgba(251,191,36,0.8)]"
              style={{ width: `${variableRatio}%` }}
              title={`Dépenses Variables : ${formatCurrency(categoryStats.totalVariable, { showSign: false })} (${(variableRatio ?? 0).toFixed(1)}%)`}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              Charges récurrentes (loyer, assurances, abonnements)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Marges d'ajustement & consommation quotidienne
            </span>
          </div>
        </div>

        {/* Interactive Filter Pills & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-white/5">
          
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/60 p-1 rounded-2xl border border-white/10">
            <button
              type="button"
              onClick={() => setFilterNature('all')}
              className={cn(
                "px-3 py-1 rounded-xl text-xs font-bold transition-all",
                filterNature === 'all' 
                  ? "bg-white/15 text-white border border-white/20 shadow-sm" 
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
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm" 
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
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm" 
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
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm" 
                  : "text-slate-400 hover:text-indigo-300"
              )}
            >
              <Sparkles className="w-3 h-3 text-indigo-400" /> Top 5
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Search filter input */}
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Filtrer une catégorie..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900/60 border border-white/10 rounded-xl pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            {/* Sort toggle */}
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

      </div>

      {/* Categories Cards Grid */}
      {displayedCategories.length === 0 ? (
        <div className="py-12 text-center text-slate-400 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl">
          <Info className="w-8 h-8 mx-auto mb-2 opacity-40 text-cyan-400" />
          <p className="text-sm font-semibold">Aucune catégorie ne correspond aux critères de filtre.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
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
                className="rounded-3xl bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur-xl p-4 border border-white/10 hover:border-cyan-500/40 transition-all duration-300 cursor-pointer group flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.15)] relative overflow-hidden"
              >
                <div>
                  {/* Top card header */}
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div 
                        className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 text-white font-black text-sm shadow-md border border-white/20 transition-transform group-hover:scale-105"
                        style={{ backgroundColor: catItem.color }}
                      >
                        {catItem.category.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-cyan-200 transition-colors" title={catItem.category}>
                          {catItem.category}
                        </h4>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {catItem.txCount} opération{catItem.txCount > 1 ? 's' : ''} • {(catItem?.percentage ?? 0).toFixed(1)}% du budget
                        </span>
                      </div>
                    </div>

                    <span className={cn(
                      "text-[9px] font-extrabold px-2 py-0.5 rounded-full shrink-0 border uppercase tracking-wider",
                      isFixe 
                        ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" 
                        : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                    )}>
                      {catItem.defaultNature}
                    </span>
                  </div>

                  {/* Main Amount */}
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-xs text-slate-400 font-medium">Total débité</span>
                    <span className="text-base sm:text-lg font-black text-white group-hover:text-cyan-300 transition-colors">
                      {formatCurrency(catItem.totalAmount, { showSign: false })}
                    </span>
                  </div>

                  {/* Fixe vs Variable mini progress bar */}
                  <div className="mt-2 w-full h-1.5 rounded-full bg-white/[0.08] overflow-hidden flex">
                    <div 
                      className="h-full bg-cyan-400 transition-all shadow-[0_0_8px_rgba(56,189,248,0.8)]" 
                      style={{ width: `${fixedRatioCategory}%` }}
                      title={`Part Fixe: ${formatCurrency(catItem.fixedAmount, { showSign: false })} (${Number(fixedRatioCategory || 0).toFixed(0)}%)`}
                    />
                    <div 
                      className="h-full bg-amber-400 transition-all shadow-[0_0_8px_rgba(251,191,36,0.8)]" 
                      style={{ width: `${variableRatioCategory}%` }}
                      title={`Part Variable: ${formatCurrency(catItem.variableAmount, { showSign: false })} (${Number(variableRatioCategory || 0).toFixed(0)}%)`}
                    />
                  </div>
                </div>

                {/* Footer details & direct audit link */}
                <div className="mt-3.5 pt-2.5 border-t border-white/10 flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1 text-cyan-300">
                    Fixe: <strong>{formatCurrency(catItem.fixedAmount, { showSign: false })}</strong>
                  </span>
                  <span className="flex items-center gap-1 text-amber-300">
                    Var: <strong>{formatCurrency(catItem.variableAmount, { showSign: false })}</strong>
                  </span>
                  <span className="text-cyan-400 font-bold flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                    <Eye size={12} /> Auditer
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Accordion Expand Button (if more than 8 categories) */}
      {hasHiddenCategories && (
        <div className="pt-2 flex justify-center">
          <button
            type="button"
            onClick={() => setIsExpandedAll(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/15 text-xs font-extrabold text-white transition-all shadow-md hover:border-cyan-500/40"
          >
            <span>Afficher toutes les catégories ({filteredCategories.length})</span>
            <ChevronDown className="w-4 h-4 text-cyan-400 animate-bounce" />
          </button>
        </div>
      )}

      {isExpandedAll && filteredCategories.length > 8 && (
        <div className="pt-2 flex justify-center">
          <button
            type="button"
            onClick={() => setIsExpandedAll(false)}
            className="flex items-center gap-2 px-5 py-2 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-bold text-slate-300 transition-all"
          >
            <span>Réduire la vue</span>
            <ChevronUp className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      )}

    </div>
  );
};
