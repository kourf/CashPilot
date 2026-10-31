import React, { useState, useMemo } from 'react';
import { 
  PieChart as PieChartIcon, 
  GitPullRequest, 
  BarChart2, 
  Info, 
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { MobileCharts } from './MobileCharts';
import { formatBankAmount } from '../../../lib/kpiUtils';
import { cn } from '../../../lib/utils';

interface LiquidDonutSectionProps {
  metrics: any;
  categoryStats: { categories: { category: string; total: number }[] };
  currency: 'EUR' | 'CHF';
  selectedMonthLabel?: string;
  selectedCategory?: string;
  onCategoryClick?: (category: string) => void;
  onSelectCategory?: (category: string) => void;
  onOpenAdvisor?: () => void;
}

const DONUT_COLORS = [
  '#10b981', // 1. Emeraude
  '#3b82f6', // 2. Bleu
  '#f59e0b', // 3. Ambre
  '#8b5cf6', // 4. Violet
  '#a855f7', // 5. Pourpre
  '#ec4899', // 6. Rose
  '#06b6d4', // 7. Cyan
  '#f97316', // 8. Orange
  '#64748b'  // 9. Autre
];

function isExcludedMacroCategory(categoryName: string): boolean {
  const norm = (categoryName || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  return (
    norm === 'charges fixes' ||
    norm === 'charges variables' ||
    norm === 'charges variables courantes' ||
    norm === 'depenses de confort' ||
    norm === 'revenus' ||
    norm === 'revenu'
  );
}

// Sous-titres didactiques par catégorie courante
const CATEGORY_SUBTITLES: Record<string, string> = {
  'Virements Famille & Proches': 'Soutien familial, réallocations',
  'Logement & Énergie': 'TotalEnergies, EDF, Eau, Loyer',
  'Abonnements & Télécom': 'Orange SA, Google One, Netflix',
  'Assurances & Prévoyance': 'Habitation, Complémentaire Santé',
  'Paiement fractionné': 'Klarna, PayPal 4x, FLOA',
  'Alimentation & Courses': 'Supermarchés, Drive, Boucherie',
  'Transports & Carburant': 'Essence, Péages, Transilien',
  'Restaurants & Sorties': 'Restaurants, Cafés, Loisirs',
  'Santé & Pharmacie': 'Médecins, Pharmacie, Soins'
};

export const LiquidDonutSection: React.FC<LiquidDonutSectionProps> = ({
  metrics,
  categoryStats,
  currency,
  selectedMonthLabel = 'ce mois',
  selectedCategory,
  onCategoryClick,
  onSelectCategory,
  onOpenAdvisor
}) => {
  const handleCategoryClick = (category: string) => {
    if (onSelectCategory) onSelectCategory(category);
    else if (onCategoryClick) onCategoryClick(category);
  };
  const [activeChartTab, setActiveChartTab] = useState<'sankey' | 'donut' | 'bar'>('donut');
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  // Filtrage strict : Aucune macro-catégorie autorisée dans les graphiques
  const validExpenseCategories = useMemo(() => {
    return (categoryStats?.categories || []).filter(
      c => !isExcludedMacroCategory(c.category) && c.total > 0.01
    );
  }, [categoryStats]);

  const totalExpenses = useMemo(() => {
    const sum = validExpenseCategories.reduce((acc, c) => acc + c.total, 0);
    return sum > 0 ? sum : (metrics?.realExpenses || 0);
  }, [validExpenseCategories, metrics?.realExpenses]);

  // Calcul des coordonnées du Donut SVG (Circonférence = 2 * PI * 38 ≈ 238.761)
  const donutSegments = useMemo(() => {
    const circumference = 2 * Math.PI * 38;
    let currentOffset = 0;

    return validExpenseCategories.slice(0, 8).map((cat, index) => {
      const proportion = totalExpenses > 0 ? cat.total / totalExpenses : 0;
      const dashLength = proportion * circumference;
      const segmentOffset = currentOffset;
      currentOffset -= dashLength;

      return {
        ...cat,
        color: DONUT_COLORS[index % DONUT_COLORS.length],
        percentage: (proportion * 100).toFixed(1),
        dashArray: `${dashLength.toFixed(2)} ${circumference.toFixed(2)}`,
        dashOffset: segmentOffset.toFixed(2),
        subtitle: CATEGORY_SUBTITLES[cat.category] || 'Dépenses courantes'
      };
    });
  }, [validExpenseCategories, totalExpenses]);

  const topCategories = useMemo(() => donutSegments.slice(0, 4), [donutSegments]);
  const otherCategories = useMemo(() => donutSegments.slice(4, 8), [donutSegments]);

  return (
    <section className="liquid-glass rounded-3xl p-5 sm:p-7 md:p-8 space-y-6">
      {/* En-tête du panneau avec sélecteur de vue segmenté */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-border/60 dark:border-white/10">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
              Répartition des flux et postes de dépenses
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
              Analytique IA
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Données consolidées d'après votre relevé bancaire de compte courant ({selectedMonthLabel})
          </p>
        </div>

        {/* Sélecteur de vue graphique (Apple Segmented Pill) */}
        <div className="flex items-center p-1 rounded-2xl liquid-glass-subtle space-x-1 shrink-0">
          <button
            type="button"
            onClick={() => setActiveChartTab('sankey')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer",
              activeChartTab === 'sankey'
                ? "liquid-pill-active shadow-sm"
                : "liquid-pill text-muted-foreground hover:text-foreground"
            )}
          >
            <GitPullRequest size={13} />
            <span>Sankey</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveChartTab('donut')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer",
              activeChartTab === 'donut'
                ? "liquid-pill-active shadow-sm"
                : "liquid-pill text-muted-foreground hover:text-foreground"
            )}
          >
            <PieChartIcon size={13} />
            <span>Donut Actif</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveChartTab('bar')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer",
              activeChartTab === 'bar'
                ? "liquid-pill-active shadow-sm"
                : "liquid-pill text-muted-foreground hover:text-foreground"
            )}
          >
            <BarChart2 size={13} />
            <span>Barres</span>
          </button>
        </div>
      </div>

      {/* Contenu principal selon l'onglet graphique actif */}
      {activeChartTab === 'donut' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-2">
          {/* Cœur visuel Donut (Centre Apple Liquid Graphic) */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center relative py-4">
            {/* Halo lumineux d'arrière-plan */}
            <div className="w-64 h-64 sm:w-72 sm:h-72 rounded-full absolute bg-gradient-to-tr from-cyan-500/15 via-blue-600/15 to-indigo-500/10 blur-3xl pointer-events-none" />

            {/* Donut SVG interactif */}
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 chart-container-float flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Anneau d'arrière-plan */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="12"
                  className="text-secondary/40 dark:text-white/[0.06]"
                />

                {/* Segments colorés des catégories */}
                {donutSegments.map((segment) => {
                  const isHovered = hoveredCategory === segment.category;
                  return (
                    <circle
                      key={segment.category}
                      cx="50"
                      cy="50"
                      r="38"
                      fill="transparent"
                      stroke={segment.color}
                      strokeWidth={isHovered ? 14 : 12}
                      strokeDasharray={segment.dashArray}
                      strokeDashoffset={segment.dashOffset}
                      strokeLinecap="round"
                      className="transition-all duration-300 cursor-pointer opacity-90 hover:opacity-100"
                      onMouseEnter={() => setHoveredCategory(segment.category)}
                      onMouseLeave={() => setHoveredCategory(null)}
                      onClick={() => handleCategoryClick(segment.category)}
                    />
                  );
                })}
              </svg>

              {/* Centre d'affichage du Liquid Donut */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
                <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                  {hoveredCategory || 'Total Dépenses'}
                </span>
                <span className="text-xl sm:text-2xl font-black text-foreground tracking-tight mt-0.5 font-mono">
                  {hoveredCategory
                    ? formatBankAmount(
                        donutSegments.find(s => s.category === hoveredCategory)?.total || 0,
                        currency
                      )
                    : formatBankAmount(totalExpenses, currency)}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  {donutSegments.length} Postes Clés
                </span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-4 flex items-center space-x-1.5">
              <Info size={13} className="text-primary" />
              <span>Survolez ou cliquez un segment pour isoler ses opérations</span>
            </p>
          </div>

          {/* Nuage des Catégories & Légende détaillée */}
          <div className="lg:col-span-6 space-y-2.5">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center justify-between">
              <span>Détail par Catégorie Principale</span>
              <span>Part (%)</span>
            </div>

            {/* Top 4 Catégories principales */}
            <div className="space-y-2">
              {topCategories.map((cat) => {
                const isHovered = hoveredCategory === cat.category;
                return (
                  <div
                    key={cat.category}
                    onClick={() => handleCategoryClick(cat.category)}
                    onMouseEnter={() => setHoveredCategory(cat.category)}
                    onMouseLeave={() => setHoveredCategory(null)}
                    className={cn(
                      "liquid-pill px-4 py-2.5 rounded-2xl flex items-center justify-between group cursor-pointer transition-all",
                      (isHovered || selectedCategory === cat.category) ? "border-primary/60 scale-[1.01] shadow-md ring-1 ring-primary/40" : ""
                    )}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: cat.color }}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                          {cat.category}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {cat.subtitle}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <div className="text-xs font-bold text-foreground font-mono">
                        {formatBankAmount(cat.total, currency)}
                      </div>
                      <div
                        className="text-[11px] font-bold"
                        style={{ color: cat.color }}
                      >
                        {cat.percentage}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Micro-pills pour les autres catégories (5 à 8) */}
            {otherCategories.length > 0 && (
              <div className="grid grid-cols-2 gap-2 pt-1.5">
                {otherCategories.map((cat) => (
                  <div
                    key={cat.category}
                    onClick={() => handleCategoryClick(cat.category)}
                    className={cn(
                      "liquid-glass-subtle px-3 py-2 rounded-xl flex items-center justify-between text-xs cursor-pointer hover:border-primary/40 transition-all",
                      selectedCategory === cat.category ? "ring-1 ring-primary/50 border-primary/40 bg-white/10" : ""
                    )}
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="text-muted-foreground text-[11px] truncate">
                        {cat.category}
                      </span>
                    </div>
                    <span className="font-bold text-foreground text-[11px] font-mono shrink-0 ml-1">
                      {formatBankAmount(cat.total, currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Vues alternatives Sankey ou Barres */
        <div className="pt-2">
          <MobileCharts
            metrics={metrics}
            categoryStats={categoryStats}
            onCategoryClick={handleCategoryClick}
          />
        </div>
      )}
    </section>
  );
};

export default LiquidDonutSection;
