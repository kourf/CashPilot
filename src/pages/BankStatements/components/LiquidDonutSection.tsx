import React, { useState, useMemo } from 'react';
import { 
  PieChart as PieChartIcon, 
  GitPullRequest, 
  BarChart2, 
  Info, 
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip 
} from 'recharts';
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
  '#10B981', // Emeraude
  '#3B82F6', // Bleu
  '#F59E0B', // Ambre
  '#EF4444', // Rouge
  '#8B5CF6', // Violet
  '#EC4899', // Rose
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#6366F1', // Indigo
  '#14B8A6'  // Teal
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

  // Donut Segments consolidés (top 8 pour un rendu visuel aéré)
  const donutSegments = useMemo(() => {
    return validExpenseCategories.slice(0, 8).map((cat, index) => {
      const proportion = totalExpenses > 0 ? cat.total / totalExpenses : 0;
      return {
        ...cat,
        color: DONUT_COLORS[index % DONUT_COLORS.length],
        percentage: (proportion * 100).toFixed(1),
        subtitle: CATEGORY_SUBTITLES[cat.category] || 'Dépenses courantes'
      };
    });
  }, [validExpenseCategories, totalExpenses]);

  const donutData = useMemo(() => {
    return donutSegments.map(s => ({
      name: s.category,
      value: s.total,
      color: s.color,
      percentage: s.percentage,
      subtitle: s.subtitle
    }));
  }, [donutSegments]);

  const topCategories = useMemo(() => donutSegments.slice(0, 4), [donutSegments]);
  const otherCategories = useMemo(() => donutSegments.slice(4, 8), [donutSegments]);

  // Rendu personnalisé des flèches connectrices avec nom de la catégorie et montant (Design DNA Stitch)
  const renderDonutCalloutLabel = (props: any) => {
    const { cx, cy, midAngle, outerRadius, name, value, fill, index } = props;
    const RADIAN = Math.PI / 180;
    const cos = Math.cos(-midAngle * RADIAN);
    const sin = Math.sin(-midAngle * RADIAN);
    const isRight = cos >= 0;

    // Point d'ancrage sur le pourtour extérieur du donut
    const sx = cx + (outerRadius + 4) * cos;
    const sy = cy + (outerRadius + 4) * sin;

    // Point de coude angulaire
    const mx = cx + (outerRadius + 22) * cos;
    const my = cy + (outerRadius + 22) * sin;

    // Segment horizontal vers le libellé
    const ex = mx + (isRight ? 1 : -1) * 18;
    const ey = my;

    const color = fill || DONUT_COLORS[index % DONUT_COLORS.length];
    const isHovered = hoveredCategory === name;
    const formattedVal = formatBankAmount(value, currency);

    return (
      <g 
        className="cursor-pointer select-none transition-all duration-200" 
        onClick={() => handleCategoryClick(name)}
        onMouseEnter={() => setHoveredCategory(name)}
        onMouseLeave={() => setHoveredCategory(null)}
      >
        {/* Ligne connectrice / flèche directionnelle */}
        <polyline
          points={`${sx},${sy} ${mx},${my} ${ex},${ey}`}
          fill="none"
          stroke={color}
          strokeWidth={isHovered ? 2.5 : 1.5}
          strokeOpacity={hoveredCategory && !isHovered ? 0.35 : 0.85}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Puce directionnelle au terminal de la flèche */}
        <circle 
          cx={ex} 
          cy={ey} 
          r={isHovered ? 3.5 : 2.5} 
          fill={color} 
        />
        {/* Libellé : Catégorie & Montant */}
        <text
          x={ex + (isRight ? 6 : -6)}
          y={ey}
          textAnchor={isRight ? 'start' : 'end'}
          dominantBaseline="central"
          fill={color}
          className={cn(
            "font-bold transition-all duration-200",
            isHovered ? "opacity-100" : "",
            hoveredCategory && !isHovered ? "opacity-40" : "opacity-95"
          )}
          style={{ 
            fontSize: isHovered ? '11.5px' : '10.5px', 
            fontWeight: isHovered ? 800 : 700 
          }}
        >
          {`${name} (${formattedVal})`}
        </text>
      </g>
    );
  };

  // Tooltip sombre élégant (Google Stitch)
  const CustomDonutTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-gray-900/95 dark:bg-gray-900/95 backdrop-blur-md border border-gray-700/80 p-3 rounded-2xl shadow-xl text-xs space-y-1 z-50">
          <div className="font-bold text-gray-100 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: data.payload?.color || '#3b82f6' }} />
            <span className="truncate">{data.name}</span>
          </div>
          <div className="font-mono font-extrabold text-cyan-400 text-sm">
            {formatBankAmount(data.value, currency)}
          </div>
          {data.payload?.percentage && (
            <div className="text-[10px] text-gray-400">
              {data.payload.percentage}% des dépenses
            </div>
          )}
        </div>
      );
    }
    return null;
  };

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

        {/* Sélecteur de vue graphique unique (Apple Segmented Pill) */}
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

      {/* 1. ONGLET DONUT ACTIF (AVEC FLÈCHES ET LIBELLÉS) */}
      {activeChartTab === 'donut' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-2">
          {/* Cœur visuel Donut (Recharts avec flèches + Centre Apple Liquid Graphic) */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center relative py-2">
            {/* Halo lumineux d'arrière-plan */}
            <div className="w-72 h-72 rounded-full absolute bg-gradient-to-tr from-cyan-500/15 via-blue-600/15 to-indigo-500/10 blur-3xl pointer-events-none" />

            {/* Donut Recharts avec flèches connectrices vers catégories et montants */}
            <div className="relative w-full h-[360px] sm:h-[390px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 25, right: 35, bottom: 25, left: 35 }}>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={62}
                    outerRadius={88}
                    paddingAngle={3.5}
                    dataKey="value"
                    onClick={(data) => handleCategoryClick(data.name)}
                    onMouseEnter={(data) => setHoveredCategory(data.name)}
                    onMouseLeave={() => setHoveredCategory(null)}
                    className="cursor-pointer"
                    labelLine={false}
                    label={renderDonutCalloutLabel}
                  >
                    {donutData.map((entry) => (
                      <Cell
                        key={`cell-${entry.name}`}
                        fill={entry.color}
                        stroke={hoveredCategory === entry.name ? '#ffffff' : 'transparent'}
                        strokeWidth={hoveredCategory === entry.name ? 2 : 0}
                        className="transition-all duration-200 cursor-pointer"
                        opacity={hoveredCategory && hoveredCategory !== entry.name ? 0.45 : 1}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomDonutTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              {/* Centre d'affichage du Liquid Donut */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
                <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground font-bold truncate max-w-[130px]">
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

            <p className="text-xs text-muted-foreground mt-2 flex items-center space-x-1.5">
              <Info size={13} className="text-primary" />
              <span>Cliquez un segment ou une étiquette pour isoler ses opérations</span>
            </p>
          </div>

          {/* Nuage des Catégories & Légende détaillée (sur la droite) */}
          <div className="lg:col-span-5 space-y-2.5">
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
                      (isHovered || selectedCategory === cat.category) ? "border-primary/60 scale-[1.01] shadow-md ring-1 ring-primary/40 bg-primary/5" : ""
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
      )}

      {/* 2. ONGLET SANKEY (DIRECTEMENT CONTRÔLÉ SANS ONGLETS INTERNES DOUBLONS) */}
      {activeChartTab === 'sankey' && (
        <div className="pt-2 animate-in fade-in duration-300">
          <MobileCharts
            metrics={metrics}
            categoryStats={categoryStats}
            currency={currency}
            activeTab="sankey"
            hideInternalTabs={true}
            onCategoryClick={handleCategoryClick}
          />
        </div>
      )}

      {/* 3. ONGLET BARRES (DIRECTEMENT CONTRÔLÉ SANS ONGLETS INTERNES DOUBLONS) */}
      {activeChartTab === 'bar' && (
        <div className="pt-2 animate-in fade-in duration-300">
          <MobileCharts
            metrics={metrics}
            categoryStats={categoryStats}
            currency={currency}
            activeTab="bar"
            hideInternalTabs={true}
            onCategoryClick={handleCategoryClick}
          />
        </div>
      )}
    </section>
  );
};

export default LiquidDonutSection;
