import React, { useState, useMemo } from 'react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  Legend 
} from 'recharts';
import { 
  Store, 
  ShoppingBag, 
  Layers, 
  ChevronRight, 
  Filter, 
  TrendingUp, 
  Calendar,
  X,
  Tag
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { type Receipt, type ReceiptItem, type SupermarketAisle } from '../../../types/receipts';
import { formatCurrency, formatDateFR } from '../../../lib/bankUtils';
import { AISLE_CONFIGS } from '../../../lib/receiptClassifier';
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
  '#84cc16'  // lime-500
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

export const SpendingChartsView: React.FC<SpendingChartsViewProps> = ({ receipts }) => {
  const [chartMode, setChartMode] = useState<'store' | 'aisle'>('store');
  const [selectedSliceName, setSelectedSliceName] = useState<string | null>(null);

  // 1. Calcul des données par Enseigne
  const storeData = useMemo(() => {
    const storeMap: Record<string, { total: number; receiptCount: number; items: DrillDownItem[] }> = {};
    
    receipts.forEach(r => {
      const name = r.storeName || 'Autre Enseigne';
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
          totalPaid: Number(((it.pricePaid ?? it.price) * it.quantity).toFixed(2))
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

  // 2. Calcul des données par Rayon
  const aisleData = useMemo(() => {
    const aisleMap: Record<string, { total: number; count: number; items: DrillDownItem[] }> = {};

    receipts.forEach(r => {
      r.items.forEach(it => {
        const cat = it.category || 'Autres / Divers';
        if (!aisleMap[cat]) {
          aisleMap[cat] = { total: 0, count: 0, items: [] };
        }
        const lineTotal = (it.pricePaid ?? it.price) * it.quantity;
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

  // Éléments du drill-down pour la tranche cliquée
  const selectedSliceData = useMemo(() => {
    if (!selectedSliceName) return null;
    return activeData.find(d => d.name === selectedSliceName) || null;
  }, [selectedSliceName, activeData]);

  if (receipts.length === 0) return null;

  return (
    <Card className="glass-card border-border/80 dark:border-white/[0.08] shadow-sm overflow-hidden">
      <CardHeader className="p-4 sm:p-5 pb-2 sm:pb-3 border-b border-border/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <CardTitle className="text-sm sm:text-base font-extrabold flex items-center gap-2 text-foreground">
                <TrendingUp size={16} className="text-primary" />
                Audit & Répartition des Dépenses
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Analyse visuelle interactive de vos {receipts.length} ticket{receipts.length > 1 ? 's' : ''} scannés. Cliquez sur une tranche pour voir le détail des produits.
            </CardDescription>
          </div>

          {/* COMMUTATEUR ENSEIGNE VS RAYON */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary/60 border border-border/70 self-start sm:self-auto">
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
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          
          {/* GRAPHIQUE DONUT RECHARTS */}
          <div className="lg:col-span-6 h-[260px] sm:h-[280px] w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  formatter={(val: number) => [
                    `${formatCurrency(val, { showSign: false })} (${totalSpent > 0 ? ((val / totalSpent) * 100).toFixed(1) : 0}%)`,
                    'Dépenses'
                  ]}
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: '#fff',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)'
                  }}
                  itemStyle={{ color: '#38bdf8', fontWeight: 600 }}
                />
                <Pie
                  data={activeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={88}
                  paddingAngle={3}
                  dataKey="value"
                  cursor="pointer"
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

            {/* TOTAL AU CENTRE DU DONUT */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                Total Audit
              </span>
              <span className="text-base sm:text-lg font-black font-mono text-foreground">
                {formatCurrency(totalSpent, { showSign: false })}
              </span>
              <span className="text-[9px] text-muted-foreground">
                {activeData.length} {chartMode === 'store' ? 'enseigne(s)' : 'rayon(s)'}
              </span>
            </div>
          </div>

          {/* LISTE DES TRANCHES AVEC POURCENTAGE & CLIC POUR DRILL-DOWN */}
          <div className="lg:col-span-6 space-y-2 max-h-[280px] overflow-y-auto pr-1">
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
                        <span className="text-foreground block truncate">{entry.name}</span>
                        <span className="text-[10px] text-muted-foreground block font-mono">
                          {entry.itemCount} article{entry.itemCount > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-bold font-mono text-foreground block">
                        {formatCurrency(entry.value, { showSign: false })}
                      </span>
                      <span className="text-[10px] font-bold text-muted-foreground font-mono">
                        {pct}%
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* DRILL-DOWN : DÉTAIL DES ARTICLES POUR LA TRANCHE SÉLECTIONNÉE            */}
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
