import React, { useState, useMemo, useEffect } from 'react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList
} from 'recharts';
import { 
  Store, 
  Layers, 
  TrendingUp, 
  X, 
  Tag,
  BarChart3,
  PieChart as PieIcon
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { type Receipt } from '../../../types/receipts';
import { formatCurrency, formatDateFR } from '../../../lib/bankUtils';
import { normalizeStoreName } from '../../../lib/receiptClassifier';
import { cn } from '../../../lib/utils';

interface SpendingChartsViewProps {
  receipts: Receipt[];
}

const PALETTE = [
  '#06b6d4', // cyan-500
  '#10b981', // emerald-500
  '#6366f1', // indigo-500
  '#f59e0b', // amber-500
  '#ec4899', // pink-500
  '#8b5cf6', // purple-500
  '#14b8a6', // teal-500
  '#f97316', // orange-500
  '#3b82f6', // blue-500
  '#84cc16', // lime-500
  '#d946ef', // fuchsia-500
  '#ef4444', // red-500
  '#a855f7', // violet-500
  '#64748b'  // slate-500
];

interface DrillDownItem {
  id: string;
  storeName: string;
  date: string;
  normalizedName: string;
  rawName: string;
  brand: string;
  category: string;
  unitPrice: number;
  unit?: string;
  quantity: number;
  totalPaid: number;
}

/**
 * Découpe élégamment un libellé de catégorie ou d'enseigne sur 1 ou 2 lignes compactes
 * afin de garantir une visibilité totale à 100% sans aucun débordement sur écran mobile.
 */
const getCategoryLabelLines = (rawName: string, isMobileScreen: boolean): { line1: string; line2: string | null } => {
  if (!rawName) return { line1: '', line2: null };

  // Sur écran large si le nom est court, une seule ligne suffit
  if (!isMobileScreen && rawName.length <= 16) {
    return { line1: rawName, line2: null };
  }

  // Découpage naturel sur le séparateur " & " (ex: "Produits frais & Crèmerie", "Fruits & Légumes", "Boucherie, Volaille & Poissonnerie")
  if (rawName.includes(' & ')) {
    const parts = rawName.split(' & ');
    if (parts.length === 2) {
      return { line1: parts[0].trim(), line2: `& ${parts[1].trim()}` };
    }
  }

  // Découpage naturel sur le séparateur " / " (ex: "Autres / Divers")
  if (rawName.includes(' / ')) {
    const parts = rawName.split(' / ');
    return { line1: `${parts[0].trim()} /`, line2: parts[1].trim() };
  }

  // Découpage sur virgule (ex: "Boucherie, Volaille")
  if (rawName.includes(',')) {
    const idx = rawName.indexOf(',');
    return { 
      line1: rawName.slice(0, idx + 1).trim(), 
      line2: rawName.slice(idx + 1).trim() 
    };
  }

  // Découpage au dernier espace si le mot est long (> 13 caractères)
  if (rawName.length > 13 && rawName.includes(' ')) {
    const lastSpace = rawName.lastIndexOf(' ');
    return {
      line1: rawName.slice(0, lastSpace).trim(),
      line2: rawName.slice(lastSpace + 1).trim()
    };
  }

  return { line1: rawName, line2: null };
};

export const SpendingChartsView: React.FC<SpendingChartsViewProps> = ({ receipts }) => {
  // Détection réactive de l'affichage mobile pour adapter et dézoomer les rayons du graphique
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 640;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Mode de regroupement : 'aisle' (Par Rayon) ou 'store' (Par Enseigne)
  const [chartMode, setChartMode] = useState<'store' | 'aisle'>('aisle');
  // Type de diagramme : 'donut' (Camembert) ou 'bar' (Bâtons décroissants)
  const [chartType, setChartType] = useState<'donut' | 'bar'>('donut');
  const [selectedSliceName, setSelectedSliceName] = useState<string | null>(null);

  // 1. Calcul des données par Enseigne (classées décroissantes de gauche à droite)
  const storeData = useMemo(() => {
    const storeMap: Record<string, { total: number; receiptCount: number; items: DrillDownItem[] }> = {};
    
    receipts.forEach(r => {
      const name = normalizeStoreName(r.storeName || 'Autre Enseigne');
      if (!storeMap[name]) {
        storeMap[name] = { total: 0, receiptCount: 0, items: [] };
      }
      storeMap[name].total += r.totalAmount;
      storeMap[name].receiptCount += 1;
      
      r.items.forEach(it => {
        storeMap[name].items.push({
          id: it.id,
          storeName: r.storeName,
          date: r.date,
          normalizedName: it.normalizedName,
          rawName: it.rawName,
          brand: it.brand || 'Générique',
          category: it.category,
          unitPrice: it.unitPrice,
          unit: it.unit,
          quantity: it.quantity,
          totalPaid: Number((it.pricePaid ?? it.price ?? 0).toFixed(2))
        });
      });
    });

    return Object.entries(storeMap)
      .map(([name, data]) => ({
        name,
        value: Number(data.total.toFixed(2)),
        receiptCount: data.receiptCount,
        itemCount: data.items.length,
        items: data.items
      }))
      .sort((a, b) => b.value - a.value);
  }, [receipts]);

  // 2. Calcul des données par Rayon (classées décroissantes de gauche à droite)
  const aisleData = useMemo(() => {
    const aisleMap: Record<string, { total: number; count: number; items: DrillDownItem[] }> = {};

    receipts.forEach(r => {
      r.items.forEach(it => {
        const cat = it.category || 'Autres / Divers';
        if (!aisleMap[cat]) {
          aisleMap[cat] = { total: 0, count: 0, items: [] };
        }
        const lineTotal = it.pricePaid ?? it.price ?? 0;
        aisleMap[cat].total += lineTotal;
        aisleMap[cat].count += it.quantity;
        aisleMap[cat].items.push({
          id: it.id,
          storeName: r.storeName,
          date: r.date,
          normalizedName: it.normalizedName,
          rawName: it.rawName,
          brand: it.brand || 'Générique',
          category: cat,
          unitPrice: it.unitPrice,
          unit: it.unit,
          quantity: it.quantity,
          totalPaid: Number(lineTotal.toFixed(2))
        });
      });
    });

    return Object.entries(aisleMap)
      .map(([name, data]) => ({
        name,
        value: Number(data.total.toFixed(2)),
        itemCount: data.count,
        items: data.items
      }))
      .sort((a, b) => b.value - a.value);
  }, [receipts]);

  const activeData = chartMode === 'store' ? storeData : aisleData;
  const totalSpent = useMemo(() => {
    return activeData.reduce((acc, curr) => acc + curr.value, 0);
  }, [activeData]);

  // Éléments du drill-down pour la tranche / barre sélectionnée
  const selectedSliceData = useMemo(() => {
    if (!selectedSliceName) return null;
    return activeData.find(d => d.name === selectedSliceName) || null;
  }, [selectedSliceName, activeData]);

  // Info-bulle personnalisée : affiche le nom réel de la catégorie (jamais le terme générique "Dépenses")
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    const val = Number(data.value || 0);
    const pct = totalSpent > 0 ? ((val / totalSpent) * 100).toFixed(1) : '0';
    const color = data.fill || PALETTE[0];

    return (
      <div className="bg-slate-900/95 backdrop-blur-md border border-white/10 rounded-xl px-3.5 py-2.5 text-xs shadow-2xl space-y-1.5 z-50 pointer-events-none">
        <div className="flex items-center gap-2">
          <span 
            className="w-3 h-3 rounded-full shrink-0 shadow-xs" 
            style={{ backgroundColor: color }} 
          />
          <span className="font-extrabold text-white text-xs sm:text-sm">
            {data.name}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 pt-1 font-mono">
          <span className="text-cyan-400 font-bold text-xs sm:text-sm">
            {formatCurrency(val, { showSign: false })}
          </span>
          <span className="text-slate-300 font-semibold text-xs">
            {pct}% du total
          </span>
        </div>
        {data.itemCount !== undefined && (
          <div className="text-[10px] text-slate-400 pt-0.5 border-t border-white/10 flex items-center justify-between">
            <span>{data.itemCount} article{data.itemCount > 1 ? 's' : ''}</span>
            {data.receiptCount ? <span>{data.receiptCount} ticket{data.receiptCount > 1 ? 's' : ''}</span> : null}
          </div>
        )}
      </div>
    );
  };

  // Étiquette visible directement sur les tranches du camembert sans devoir survoler à la souris
  const renderCustomPieLabel = (props: any) => {
    const { cx, cy, midAngle, outerRadius, percent, name, value } = props;
    if (percent < 0.02) return null;
    const RADIAN = Math.PI / 180;
    // Dézoom dynamique : sur mobile, ancrage rapproché (12px) pour laisser un maximum d'espace aux étiquettes
    const labelRadius = outerRadius + (isMobile ? 12 : 20);
    const x = cx + labelRadius * Math.cos(-midAngle * RADIAN);
    const y = cy + labelRadius * Math.sin(-midAngle * RADIAN);
    const isRight = x > cx;
    const { line1, line2 } = getCategoryLabelLines(name, isMobile);
    const hasLine2 = Boolean(line2);

    return (
      <text
        x={x}
        y={y}
        fill="#cbd5e1"
        textAnchor={isRight ? 'start' : 'end'}
        dominantBaseline="central"
        className="select-none pointer-events-none"
        style={{ fontSize: isMobile ? '8.5px' : '9.5px', lineHeight: 1 }}
      >
        <tspan 
          x={x} 
          dy={hasLine2 ? (isMobile ? "-9" : "-8") : (isMobile ? "-5" : "-4")} 
          fill="#f8fafc" 
          fontWeight="700"
        >
          {line1}
        </tspan>
        {hasLine2 && (
          <tspan 
            x={x} 
            dy={isMobile ? "10" : "11"} 
            fill="#f8fafc" 
            fontWeight="600"
          >
            {line2}
          </tspan>
        )}
        <tspan 
          x={x} 
          dy={isMobile ? "10" : "11"} 
          fill="#38bdf8" 
          fontWeight="700" 
          fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
        >
          {formatCurrency(value, { showSign: false })}
        </tspan>
      </text>
    );
  };

  if (receipts.length === 0) return null;

  return (
    <Card className="glass-card border-border/80 dark:border-white/[0.08] shadow-sm overflow-hidden">
      <CardHeader className="p-4 sm:p-5 pb-2 sm:pb-3 border-b border-border/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <CardTitle className="text-sm sm:text-base font-extrabold flex items-center gap-2 text-foreground">
                <TrendingUp size={16} className="text-primary" />
                Audit & Répartition des Dépenses
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Analyse visuelle interactive de vos {receipts.length} ticket{receipts.length > 1 ? 's' : ''} scannés. {chartType === 'donut' ? 'Cliquez sur une tranche' : 'Cliquez sur un bâton'} pour voir le détail des produits.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
            {/* COMMUTATEUR FORMAT : CAMEMBERT VS BÂTONS */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary/60 border border-border/70">
              <button
                type="button"
                onClick={() => setChartType('donut')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                  chartType === 'donut'
                    ? "bg-card text-foreground shadow-xs border border-border/80"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/40"
                )}
                title="Affichage en Diagramme Circulaire / Camembert"
              >
                <PieIcon size={13} className={chartType === 'donut' ? "text-primary" : ""} />
                <span>Camembert</span>
              </button>

              <button
                type="button"
                onClick={() => setChartType('bar')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                  chartType === 'bar'
                    ? "bg-card text-foreground shadow-xs border border-border/80"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/40"
                )}
                title="Affichage en Diagramme en Bâtons (Décroissant de gauche à droite)"
              >
                <BarChart3 size={13} className={chartType === 'bar' ? "text-primary" : ""} />
                <span>Bâtons</span>
              </button>
            </div>

            {/* COMMUTATEUR NIVEAU : PAR ENSEIGNE VS PAR RAYON */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary/60 border border-border/70">
              <button
                type="button"
                onClick={() => {
                  setChartMode('store');
                  setSelectedSliceName(null);
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                  chartMode === 'store'
                    ? "bg-card text-foreground shadow-xs border border-border/80"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/40"
                )}
              >
                <Store size={13} className={chartMode === 'store' ? "text-primary" : ""} />
                <span>Par Enseigne</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setChartMode('aisle');
                  setSelectedSliceName(null);
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                  chartMode === 'aisle'
                    ? "bg-card text-foreground shadow-xs border border-border/80"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/40"
                )}
              >
                <Layers size={13} className={chartMode === 'aisle' ? "text-primary" : ""} />
                <span>Par Rayon</span>
              </button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-5">
        {chartType === 'donut' ? (
          /* ========================================================================= */
          /* FORMAT 1 : DIAGRAMME EN CAMEMBERT / DONUT                                  */
          /* ========================================================================= */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
            
            {/* GRAPHIQUE DONUT RECHARTS AVEC ÉTIQUETTES VISIBLES SANS SURVOL */}
            <div className="lg:col-span-6 h-[290px] sm:h-[310px] w-full flex items-center justify-center relative overflow-visible">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 12, right: isMobile ? 6 : 28, left: isMobile ? 6 : 28, bottom: 12 }}>
                  <Tooltip content={<CustomTooltip />} />
                  <Pie
                    data={activeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={isMobile ? 32 : 48}
                    outerRadius={isMobile ? 50 : 74}
                    paddingAngle={3}
                    dataKey="value"
                    cursor="pointer"
                    labelLine={{ stroke: 'rgba(255, 255, 255, 0.35)', strokeWidth: 1 }}
                    label={renderCustomPieLabel}
                    onClick={(entry) => {
                      setSelectedSliceName(prev => prev === entry.name ? null : entry.name);
                    }}
                  >
                    {activeData.map((entry, index) => {
                      const isSelected = selectedSliceName === entry.name;
                      return (
                        <Cell 
                          key={`cell-${entry.name}`} 
                          fill={PALETTE[index % PALETTE.length]}
                          stroke={isSelected ? '#ffffff' : 'transparent'}
                          strokeWidth={isSelected ? 3 : 1}
                          opacity={selectedSliceName && !isSelected ? 0.45 : 1}
                        />
                      );
                    })}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              {/* TOTAL AU CENTRE DU DONUT (DÉZOOMÉ POUR MOBILE) */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[8px] sm:text-[10px] uppercase font-bold text-muted-foreground tracking-wider leading-none">
                  Total
                </span>
                <span className="text-xs sm:text-base font-black font-mono text-foreground leading-tight my-0.5">
                  {formatCurrency(totalSpent, { showSign: false })}
                </span>
                <span className="text-[8px] sm:text-[9px] text-muted-foreground leading-none">
                  {activeData.length} {chartMode === 'store' ? 'ens.' : 'rayons'}
                </span>
              </div>
            </div>

            {/* LISTE DES TRANCHES AVEC NOM, PRIX & POURCENTAGE DISPONIBLES SANS TOUCHER LA SOURIS */}
            <div className="lg:col-span-6 space-y-2 max-h-[290px] overflow-y-auto pr-1">
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-1 pb-1 flex items-center justify-between">
                <span>{chartMode === 'store' ? 'Enseignes auditées' : 'Rayons de supermarché'}</span>
                <span>Dépenses (%)</span>
              </div>

              <div className="space-y-1.5">
                {activeData.map((entry, idx) => {
                  const color = PALETTE[idx % PALETTE.length];
                  const pct = totalSpent > 0 ? ((entry.value / totalSpent) * 100).toFixed(1) : '0';
                  const isSelected = selectedSliceName === entry.name;

                  return (
                    <button
                      key={entry.name}
                      type="button"
                      onClick={() => setSelectedSliceName(prev => prev === entry.name ? null : entry.name)}
                      className={cn(
                        "w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 text-xs",
                        isSelected
                          ? "bg-primary/10 border-primary shadow-xs font-bold"
                          : "bg-secondary/30 hover:bg-secondary/60 border-border/70"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span 
                          className="w-3 h-3 rounded-full shrink-0 shadow-xs" 
                          style={{ backgroundColor: color }} 
                        />
                        <div className="truncate">
                          <span className="text-foreground block truncate font-medium">{entry.name}</span>
                          <span className="text-[10px] text-muted-foreground block font-mono">
                            {entry.itemCount} article{entry.itemCount > 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-bold font-mono text-foreground block">
                          {formatCurrency(entry.value, { showSign: false })}
                        </span>
                        <span className="text-[10px] font-bold text-cyan-400 font-mono">
                          {pct}%
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        ) : (
          /* ========================================================================= */
          /* FORMAT 2 : DIAGRAMME EN BÂTONS (CLASSÉ DÉCROISSANT DE GAUCHE À DROITE)    */
          /* NOM DE LA CATÉGORIE ET PRIX VISIBLES SANS TOUCHER LA SOURIS              */
          /* ========================================================================= */
          <div className="space-y-4">
            <div className="w-full overflow-x-auto pb-2 scrollbar-thin">
              <div className="min-w-[620px] sm:min-w-full h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={activeData}
                    margin={{ top: 38, right: 20, left: 10, bottom: 65 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.08)" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                      height={65}
                      tickFormatter={(name: string) => name.length > 20 ? name.slice(0, 18) + '…' : name}
                    />
                    <YAxis 
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      tickFormatter={(val) => `${val} €`}
                      width={55}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar 
                      dataKey="value" 
                      radius={[6, 6, 0, 0]}
                      cursor="pointer"
                      onClick={(entry: any) => {
                        if (entry && entry.name) {
                          setSelectedSliceName(prev => prev === entry.name ? null : entry.name);
                        }
                      }}
                    >
                      {activeData.map((entry, index) => {
                        const isSelected = selectedSliceName === entry.name;
                        return (
                          <Cell 
                            key={`bar-cell-${entry.name}`} 
                            fill={PALETTE[index % PALETTE.length]}
                            stroke={isSelected ? '#ffffff' : 'transparent'}
                            strokeWidth={isSelected ? 2 : 0}
                            opacity={selectedSliceName && !isSelected ? 0.45 : 1}
                          />
                        );
                      })}
                      {/* NOM DE LA CATÉGORIE AFFICHÉ AU-DESSUS DE CHAQUE BÂTON SANS TOUCHER LA SOURIS */}
                      <LabelList 
                        dataKey="name" 
                        position="top" 
                        offset={18}
                        formatter={(name: string) => name.length > 18 ? name.slice(0, 16) + '…' : name}
                        style={{ fontSize: 10, fill: '#f8fafc', fontWeight: 'bold' }} 
                      />
                      {/* PRIX AFFICHÉ AU-DESSUS DE CHAQUE BÂTON SANS TOUCHER LA SOURIS */}
                      <LabelList 
                        dataKey="value" 
                        position="top" 
                        offset={4}
                        formatter={(val: number) => formatCurrency(val, { showSign: false })}
                        style={{ fontSize: 10, fill: '#38bdf8', fontWeight: 'bold', fontFamily: 'monospace' }} 
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* GRILLE RÉCAPITULATIVE INTERACTIVE SOUS LE DIAGRAMME EN BÂTONS */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 pt-1 border-t border-border/50">
              {activeData.map((entry, idx) => {
                const color = PALETTE[idx % PALETTE.length];
                const pct = totalSpent > 0 ? ((entry.value / totalSpent) * 100).toFixed(1) : '0';
                const isSelected = selectedSliceName === entry.name;

                return (
                  <button
                    key={entry.name}
                    type="button"
                    onClick={() => setSelectedSliceName(prev => prev === entry.name ? null : entry.name)}
                    className={cn(
                      "text-left p-2.5 rounded-xl border transition-all text-xs flex flex-col justify-between gap-1.5",
                      isSelected
                        ? "bg-primary/10 border-primary shadow-xs font-bold"
                        : "bg-secondary/30 hover:bg-secondary/60 border-border/70"
                    )}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span 
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs" 
                        style={{ backgroundColor: color }} 
                      />
                      <span className="text-foreground truncate text-[11px] font-semibold">{entry.name}</span>
                    </div>
                    <div className="flex items-center justify-between font-mono text-[11px] pt-1 border-t border-border/40">
                      <span className="font-bold text-foreground">
                        {formatCurrency(entry.value, { showSign: false })}
                      </span>
                      <span className="text-[10px] text-cyan-400 font-semibold">
                        {pct}%
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DRILL-DOWN : DÉTAIL DES ARTICLES POUR LA TRANCHE / LE BÂTON SÉLECTIONNÉ    */}
        {/* ========================================================================= */}
        {selectedSliceData && (
          <div className="border border-primary/30 bg-primary/5 rounded-2xl p-3.5 sm:p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between gap-2 flex-wrap pb-1 border-b border-primary/20">
              <div className="flex items-center gap-2">
                <Tag size={15} className="text-primary" />
                <h4 className="text-xs sm:text-sm font-extrabold text-foreground">
                  Détail pour « {selectedSliceData.name} » : {formatCurrency(selectedSliceData.value, { showSign: false })} ({selectedSliceData.items.length} articles)
                </h4>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedSliceName(null)}
                className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
              >
                <X size={13} />
                <span>Fermer le détail</span>
              </Button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border/70 bg-card">
              <table className="w-full text-left border-collapse text-xs min-w-[500px]">
                <thead>
                  <tr className="border-b border-border/70 bg-secondary/40 text-[10px] font-bold text-muted-foreground uppercase">
                    <th className="py-2 px-3">Article</th>
                    <th className="py-2 px-3">Enseigne</th>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3 text-right">Prix Unitaire</th>
                    <th className="py-2 px-3 text-center">Qté</th>
                    <th className="py-2 px-3 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {selectedSliceData.items.map((item, idx) => (
                    <tr key={`${item.id}-${idx}`} className="hover:bg-muted/20">
                      <td className="py-2 px-3 font-semibold text-foreground">
                        <div>{item.normalizedName}</div>
                        {item.brand && item.brand !== 'Générique' && (
                          <span className="text-[10px] text-muted-foreground font-normal">
                            {item.brand}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground font-medium">
                        {item.storeName}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground font-mono text-[11px]">
                        {formatDateFR(item.date)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                        {item.unitPrice > 0 ? `${formatCurrency(item.unitPrice, { showSign: false })}/${item.unit || 'u'}` : '—'}
                      </td>
                      <td className="py-2 px-3 text-center font-mono">
                        {item.quantity}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                        {formatCurrency(item.totalPaid, { showSign: false })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
