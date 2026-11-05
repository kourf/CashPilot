import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
  Area,
  AreaChart
} from 'recharts';
import {
  ShoppingBag,
  Store,
  Calendar,
  Sparkles,
  Trophy,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  PieChart as PieIcon,
  BarChart3,
  LineChart as LineIcon,
  Flame,
  Zap,
  Info
} from 'lucide-react';
import { type Receipt, type ReceiptItem } from '../../../types/receipts';
import { formatCurrency, formatDateFR } from '../../../lib/bankUtils';
import { formatMonthLabel } from '../../../lib/bankParser';
import { getCategoryEmoji } from '../../../lib/productEmojiMapper';
import { cn } from '../../../lib/utils';

interface ReceiptMonthlyAuditProps {
  receipts: Receipt[];
  selectedMonth: string; // 'ALL' ou 'YYYY-MM' (ex: '2026-10')
  onSelectMonth: (month: string) => void;
  availableMonths: string[]; // Liste des mois 'YYYY-MM' classés récents en premier
}

// Palette Stitch harmonieuse pour les catégories et magasins
const CHART_PALETTE = [
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

// Mots-clés pour détecter automatiquement les achats d'impulsion / superflus
const IMPULSE_KEYWORDS = [
  'chocolat', 'bonbon', 'confiserie', 'biscuit', 'gateau', 'chips', 'aperitif',
  'soda', 'cola', 'energy drink', 'red bull', 'monster', 'snack', 'barre',
  'glace', 'kinder', 'nutella', 'm&m', 'haribo', 'popcorn', 'sucrerie',
  'chewing-gum', 'friandise', 'biere', 'alcool', 'vin', 'liqueur'
];

/**
 * Tooltip personnalisé avec FLÈCHE INDICATRICE pointant vers la donnée
 * Affiche clairement le nom de la stat, le montant chiffré et le volume.
 */
const ArrowCalloutTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0];
  const name = item.name || label || item.payload?.name || item.payload?.date || 'Donnée';
  const val = Number(item.value || 0);
  const color = item.color || item.payload?.fill || '#06b6d4';
  const percent = item.payload?.percent;
  const count = item.payload?.count || item.payload?.itemCount;

  return (
    <div className="relative pointer-events-none -translate-x-1/2 -translate-y-full mb-2 z-50 select-none animate-in fade-in zoom-in-95 duration-150">
      <div className="px-3.5 py-2.5 rounded-2xl bg-[#0c1222]/95 backdrop-blur-xl border border-cyan-500/30 shadow-2xl shadow-black/80 text-center min-w-[140px] max-w-[220px]">
        {/* Nom de la stat avec puce couleur */}
        <div className="flex items-center justify-center gap-1.5 mb-0.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className="font-extrabold text-white text-xs truncate">{name}</span>
        </div>
        {/* Chiffre principal mis en avant */}
        <div className="font-black font-mono text-sm sm:text-base text-cyan-300">
          {formatCurrency(val, { showSign: false })}
        </div>
        {/* Pourcentage ou articles */}
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-medium">
          {percent !== undefined && (
            <span>{percent}% du mois</span>
          )}
          {count !== undefined && (
            <span>• {count} art.</span>
          )}
        </div>
      </div>
      {/* FLÈCHE INDICATRICE VERS LE BAS POINTANT DIRECTEMENT SUR LE POINT / LA BARRE */}
      <div className="w-0 h-0 mx-auto border-x-[6px] border-x-transparent border-t-[6px] border-t-cyan-500/40 filter drop-shadow-md" />
    </div>
  );
};

export const ReceiptMonthlyAudit: React.FC<ReceiptMonthlyAuditProps> = ({
  receipts,
  selectedMonth,
  onSelectMonth,
  availableMonths
}) => {
  // Vue graphique sélectionnée : 'pie' (Catégories) | 'bar' (Magasins) | 'line' (Évolution)
  const [chartView, setChartView] = useState<'pie' | 'bar' | 'line'>('pie');

  // 1. Filtrage des tickets pour le mois sélectionné
  const currentMonthReceipts = useMemo(() => {
    if (selectedMonth === 'ALL') return receipts;
    return receipts.filter(r => (r.date || '').startsWith(selectedMonth));
  }, [receipts, selectedMonth]);

  // Mois précédent pour le calcul de l'indice d'inflation
  const previousMonthKey = useMemo(() => {
    if (selectedMonth === 'ALL') {
      return availableMonths.length > 1 ? availableMonths[1] : null;
    }
    const idx = availableMonths.indexOf(selectedMonth);
    return idx >= 0 && idx + 1 < availableMonths.length ? availableMonths[idx + 1] : null;
  }, [selectedMonth, availableMonths]);

  const previousMonthReceipts = useMemo(() => {
    if (!previousMonthKey) return [];
    return receipts.filter(r => (r.date || '').startsWith(previousMonthKey));
  }, [receipts, previousMonthKey]);

  // 2. INDICATEURS CLÉS (KPIs)
  const kpis = useMemo(() => {
    const totalSpent = currentMonthReceipts.reduce((acc, r) => acc + (r.totalAmount || 0), 0);
    const receiptCount = currentMonthReceipts.length;
    const avgBasket = receiptCount > 0 ? totalSpent / receiptCount : 0;

    // Article le plus cher acheté
    let mostExpensiveItem: { name: string; store: string; price: number; date: string } | null = null;
    currentMonthReceipts.forEach(r => {
      (r.items || []).forEach(it => {
        const p = it.pricePaid ?? it.price ?? 0;
        if (!mostExpensiveItem || p > mostExpensiveItem.price) {
          mostExpensiveItem = {
            name: it.standardized_name || it.normalizedName || it.rawName,
            store: r.storeName,
            price: p,
            date: r.date
          };
        }
      });
    });

    return {
      totalSpent,
      receiptCount,
      avgBasket,
      mostExpensiveItem
    };
  }, [currentMonthReceipts]);

  // 3. PALMARÈS DES MAGASINS
  const storePalmares = useMemo(() => {
    const map: Record<string, { visits: number; totalSpent: number }> = {};
    currentMonthReceipts.forEach(r => {
      const s = r.storeName || 'Magasin';
      if (!map[s]) map[s] = { visits: 0, totalSpent: 0 };
      map[s].visits += 1;
      map[s].totalSpent += r.totalAmount || 0;
    });

    const entries = Object.entries(map);
    if (entries.length === 0) return { mostVisited: null, cheapestStore: null };

    // Plus fréquenté
    entries.sort((a, b) => b[1].visits - a[1].visits);
    const mostVisited = {
      name: entries[0][0],
      visits: entries[0][1].visits,
      percentage: Math.round((entries[0][1].visits / (currentMonthReceipts.length || 1)) * 100)
    };

    // Moins cher selon le panier moyen
    entries.sort((a, b) => {
      const avgA = a[1].totalSpent / (a[1].visits || 1);
      const avgB = b[1].totalSpent / (b[1].visits || 1);
      return avgA - avgB;
    });
    const cheapestStore = {
      name: entries[0][0],
      avgBasket: entries[0][1].totalSpent / (entries[0][1].visits || 1)
    };

    return { mostVisited, cheapestStore };
  }, [currentMonthReceipts]);

  // 4. INDICE D'INFLATION PERSONNEL (Top 5 produits récurrents vs M-1)
  const inflationAnalysis = useMemo(() => {
    // Fréquence des articles du mois sélectionné
    const freqMap: Record<string, { count: number; currentPrices: number[]; rawName: string }> = {};

    currentMonthReceipts.forEach(r => {
      (r.items || []).forEach(it => {
        const key = (it.standardized_name || it.normalizedName || it.rawName || '').trim().toLowerCase();
        if (!key) return;
        const uPrice = it.unitPrice || it.pricePaid || 0;
        if (uPrice <= 0) return;

        if (!freqMap[key]) {
          freqMap[key] = {
            count: 0,
            currentPrices: [],
            rawName: it.standardized_name || it.normalizedName || it.rawName
          };
        }
        freqMap[key].count += 1;
        freqMap[key].currentPrices.push(uPrice);
      });
    });

    // Top 5 produits récurrents
    const top5Keys = Object.entries(freqMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);

    // Comparaison avec les prix du mois précédent
    const prevPriceMap: Record<string, number[]> = {};
    previousMonthReceipts.forEach(r => {
      (r.items || []).forEach(it => {
        const key = (it.standardized_name || it.normalizedName || it.rawName || '').trim().toLowerCase();
        const uPrice = it.unitPrice || it.pricePaid || 0;
        if (key && uPrice > 0) {
          if (!prevPriceMap[key]) prevPriceMap[key] = [];
          prevPriceMap[key].push(uPrice);
        }
      });
    });

    const itemsDiff: Array<{
      name: string;
      currentAvg: number;
      prevAvg: number;
      diffAmount: number;
      diffPercent: number;
    }> = [];

    let totalDiffPercent = 0;
    let countComparable = 0;

    top5Keys.forEach(([key, info]) => {
      const currAvg = info.currentPrices.reduce((a, b) => a + b, 0) / info.currentPrices.length;
      const prevPrices = prevPriceMap[key];
      if (prevPrices && prevPrices.length > 0) {
        const prevAvg = prevPrices.reduce((a, b) => a + b, 0) / prevPrices.length;
        const diffAmount = currAvg - prevAvg;
        const diffPercent = prevAvg > 0 ? (diffAmount / prevAvg) * 100 : 0;
        itemsDiff.push({
          name: info.rawName,
          currentAvg: currAvg,
          prevAvg,
          diffAmount,
          diffPercent
        });
        totalDiffPercent += diffPercent;
        countComparable += 1;
      } else {
        itemsDiff.push({
          name: info.rawName,
          currentAvg: currAvg,
          prevAvg: currAvg,
          diffAmount: 0,
          diffPercent: 0
        });
      }
    });

    const globalInflationPercent = countComparable > 0 ? totalDiffPercent / countComparable : 0;

    return {
      globalInflationPercent,
      hasPreviousMonth: Boolean(previousMonthKey),
      previousMonthLabel: previousMonthKey ? formatMonthLabel(previousMonthKey) : 'Mois précédent',
      itemsDiff
    };
  }, [currentMonthReceipts, previousMonthReceipts, previousMonthKey]);

  // 5. ALERTE "ACHATS D'IMPULSION"
  const impulseAnalysis = useMemo(() => {
    let impulseTotal = 0;
    const detectedItems: Array<{ name: string; store: string; price: number; date: string }> = [];

    currentMonthReceipts.forEach(r => {
      (r.items || []).forEach(it => {
        const nameLower = (it.rawName || '' + ' ' + (it.normalizedName || '')).toLowerCase();
        const catLower = (it.category || '').toLowerCase();
        const isImpulse =
          IMPULSE_KEYWORDS.some(kw => nameLower.includes(kw)) ||
          catLower.includes('sucree') ||
          catLower.includes('bonbon');

        if (isImpulse) {
          const p = it.pricePaid ?? it.price ?? 0;
          impulseTotal += p;
          detectedItems.push({
            name: it.standardized_name || it.normalizedName || it.rawName,
            store: r.storeName,
            price: p,
            date: r.date
          });
        }
      });
    });

    detectedItems.sort((a, b) => b.price - a.price);

    const percentOfBudget = kpis.totalSpent > 0 ? (impulseTotal / kpis.totalSpent) * 100 : 0;

    return {
      impulseTotal,
      percentOfBudget,
      detectedItems: detectedItems.slice(0, 4) // Top 4 pour l'affichage épuré
    };
  }, [currentMonthReceipts, kpis.totalSpent]);

  // 6. DONNÉES GRAPHIQUES RECHARTS
  // 6.1 Données par Catégorie (Pie Chart)
  const categoryChartData = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    currentMonthReceipts.forEach(r => {
      (r.items || []).forEach(it => {
        const cat = it.category || 'Autres / Divers';
        if (!map[cat]) map[cat] = { total: 0, count: 0 };
        map[cat].total += it.pricePaid ?? it.price ?? 0;
        map[cat].count += it.quantity || 1;
      });
    });

    return Object.entries(map)
      .map(([name, data], idx) => ({
        name,
        value: Number(data.total.toFixed(2)),
        count: data.count,
        percent: kpis.totalSpent > 0 ? Number(((data.total / kpis.totalSpent) * 100).toFixed(1)) : 0,
        fill: CHART_PALETTE[idx % CHART_PALETTE.length]
      }))
      .sort((a, b) => b.value - a.value);
  }, [currentMonthReceipts, kpis.totalSpent]);

  // 6.2 Données par Magasin (Bar Chart)
  const storeChartData = useMemo(() => {
    const map: Record<string, { total: number; visits: number }> = {};
    currentMonthReceipts.forEach(r => {
      const s = r.storeName || 'Magasin';
      if (!map[s]) map[s] = { total: 0, visits: 0 };
      map[s].total += r.totalAmount || 0;
      map[s].visits += 1;
    });

    return Object.entries(map)
      .map(([name, data], idx) => ({
        name,
        value: Number(data.total.toFixed(2)),
        visits: data.visits,
        percent: kpis.totalSpent > 0 ? Number(((data.total / kpis.totalSpent) * 100).toFixed(1)) : 0,
        fill: CHART_PALETTE[idx % CHART_PALETTE.length]
      }))
      .sort((a, b) => b.value - a.value);
  }, [currentMonthReceipts, kpis.totalSpent]);

  // 6.3 Évolution Temporelle (Line Chart)
  const timelineChartData = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    currentMonthReceipts.forEach(r => {
      const d = r.date || 'Inconnu';
      if (!map[d]) map[d] = { total: 0, count: 0 };
      map[d].total += r.totalAmount || 0;
      map[d].count += 1;
    });

    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, data]) => {
        const parts = date.split('-');
        const shortDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : date;
        return {
          date: shortDate,
          fullDate: date,
          value: Number(data.total.toFixed(2)),
          count: data.count,
          fill: '#06b6d4'
        };
      });
  }, [currentMonthReceipts]);

  return (
    <div className="space-y-4">
      {/* ========================================================================= */}
      {/* 1. CARTE DE CONTRÔLE GLOBALE : SÉLECTEUR DE MOIS & TITRE D'AUDIT           */}
      {/* ========================================================================= */}
      <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-r from-slate-900/90 via-[#0c1222]/95 to-slate-900/90 border border-white/10 shadow-sm backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-300 shadow-inner shrink-0">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
              <span>Tableau de Bord d'Audit Alimentaire</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
                IA Audit
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Analyses, graphiques et métriques d'optimisation de vos courses
            </p>
          </div>
        </div>

        {/* Sélecteur Global de Mois */}
        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-300">
            <Calendar size={14} className="text-cyan-400" />
            <span>Période :</span>
          </div>

          <select
            value={selectedMonth}
            onChange={(e) => onSelectMonth(e.target.value)}
            className="px-3.5 py-2 text-xs font-bold rounded-xl border border-cyan-500/30 bg-slate-900 text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 cursor-pointer shadow-sm transition-all"
          >
            <option value="ALL">🌟 Tout l'historique ({receipts.length} tickets)</option>
            {availableMonths.map(m => (
              <option key={m} value={m}>
                📅 {formatMonthLabel(m)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. RAPPORT MENSUEL STRUCTURÉ EN CARTES D'INFORMATION (KPI)               */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1 : Panier Moyen & Dépenses Totales */}
        <div className="rounded-2xl p-4 bg-slate-900/80 border border-white/10 shadow-sm hover:border-cyan-500/30 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-bold uppercase tracking-wider text-[10px] text-cyan-300">Panier Moyen</span>
            <div className="p-1.5 rounded-xl bg-cyan-500/10 text-cyan-400">
              <ShoppingBag size={15} />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black font-mono text-white">
              {formatCurrency(kpis.avgBasket, { showSign: false })}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>Total du mois :</span>
              <span className="font-mono font-bold text-slate-200">
                {formatCurrency(kpis.totalSpent, { showSign: false })}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 2 : Nombre de Passages en Caisse */}
        <div className="rounded-2xl p-4 bg-slate-900/80 border border-white/10 shadow-sm hover:border-cyan-500/30 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-bold uppercase tracking-wider text-[10px] text-emerald-300">Passages en Caisse</span>
            <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Store size={15} />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black font-mono text-white">
              {kpis.receiptCount} <span className="text-sm font-semibold text-slate-400">tickets</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>Fréquence :</span>
              <span className="font-semibold text-emerald-400">
                {kpis.receiptCount > 0 ? `~${(kpis.receiptCount / 4).toFixed(1)} / sem.` : '0'}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 3 : Article le Plus Cher */}
        <div className="rounded-2xl p-4 bg-slate-900/80 border border-white/10 shadow-sm hover:border-cyan-500/30 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-bold uppercase tracking-wider text-[10px] text-amber-300">Article le Plus Cher</span>
            <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-400">
              <Trophy size={15} />
            </div>
          </div>
          <div>
            {kpis.mostExpensiveItem ? (
              <>
                <div className="text-base sm:text-lg font-black font-mono text-white truncate" title={kpis.mostExpensiveItem.name}>
                  {kpis.mostExpensiveItem.name}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                  <span className="truncate max-w-[110px]">{kpis.mostExpensiveItem.store}</span>
                  <span className="font-mono font-black text-amber-300">
                    {formatCurrency(kpis.mostExpensiveItem.price, { showSign: false })}
                  </span>
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-500 italic">Aucun article enregistré</div>
            )}
          </div>
        </div>

        {/* KPI 4 : Alerte Achats d'Impulsion */}
        <div className="rounded-2xl p-4 bg-slate-900/80 border border-white/10 shadow-sm hover:border-rose-500/30 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-bold uppercase tracking-wider text-[10px] text-rose-300">Achats d'Impulsion</span>
            <div className="p-1.5 rounded-xl bg-rose-500/10 text-rose-400">
              <Flame size={15} />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black font-mono text-rose-300">
              {formatCurrency(impulseAnalysis.impulseTotal, { showSign: false })}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>Impact budget :</span>
              <span className="font-mono font-bold text-rose-400">
                {impulseAnalysis.percentOfBudget.toFixed(1)}% du total
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. ENCARTS EXPERTS : INDICE D'INFLATION & PALMARÈS DES ENSEIGNES           */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* A. Indice d'Inflation Personnel (Top 5 produits récurrents vs M-1) */}
        <div className="rounded-2xl p-4 sm:p-5 bg-slate-900/80 border border-white/10 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
                <TrendingUp size={14} />
              </div>
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-white">Indice d'Inflation Personnel</h3>
                <p className="text-[10px] text-slate-400">
                  Évolution du prix des 5 produits les plus récurrents {inflationAnalysis.hasPreviousMonth ? `vs ${inflationAnalysis.previousMonthLabel}` : ''}
                </p>
              </div>
            </div>

            <div className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-xl font-mono font-black text-xs border",
              inflationAnalysis.globalInflationPercent > 0
                ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                : inflationAnalysis.globalInflationPercent < 0
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                  : "bg-white/5 text-slate-300 border-white/10"
            )}>
              {inflationAnalysis.globalInflationPercent > 0 ? (
                <>
                  <TrendingUp size={13} className="text-rose-400" />
                  <span>+{inflationAnalysis.globalInflationPercent.toFixed(1)}%</span>
                </>
              ) : inflationAnalysis.globalInflationPercent < 0 ? (
                <>
                  <TrendingDown size={13} className="text-emerald-400" />
                  <span>{inflationAnalysis.globalInflationPercent.toFixed(1)}%</span>
                </>
              ) : (
                <>
                  <Minus size={13} className="text-slate-400" />
                  <span>0.0%</span>
                </>
              )}
            </div>
          </div>

          {/* Liste des 5 produits récurrents */}
          <div className="space-y-2 text-xs">
            {inflationAnalysis.itemsDiff.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">Aucun produit récurrent identifié pour cette période.</p>
            ) : (
              inflationAnalysis.itemsDiff.map(item => (
                <div key={item.name} className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="font-semibold text-slate-200 truncate max-w-[180px] sm:max-w-[240px]">
                    {item.name}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-slate-400 text-[11px]">
                      {item.currentAvg.toFixed(2).replace('.', ',')} €
                    </span>
                    <span className={cn(
                      "font-mono font-bold text-[11px] px-1.5 py-0.2 rounded-md",
                      item.diffPercent > 0
                        ? "text-rose-400 bg-rose-500/10"
                        : item.diffPercent < 0
                          ? "text-emerald-400 bg-emerald-500/10"
                          : "text-slate-400 bg-white/5"
                    )}>
                      {item.diffPercent > 0 ? `+${item.diffPercent.toFixed(1)}%` : `${item.diffPercent.toFixed(1)}%`}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* B. Palmarès des Magasins & Alerte Impulsion Détaillée */}
        <div className="rounded-2xl p-4 sm:p-5 bg-slate-900/80 border border-white/10 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-400">
                <Store size={14} />
              </div>
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-white">Palmarès & Arbitrage des Enseignes</h3>
                <p className="text-[10px] text-slate-400">Fréquentation et économies comparées</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Magasin le plus fréquenté */}
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Le plus fréquenté</span>
              <div className="font-black text-sm text-white truncate">
                {storePalmares.mostVisited ? storePalmares.mostVisited.name : '—'}
              </div>
              <div className="text-[11px] text-cyan-300 font-medium">
                {storePalmares.mostVisited ? `${storePalmares.mostVisited.visits} passages (${storePalmares.mostVisited.percentage}%)` : 'Aucune donnée'}
              </div>
            </div>

            {/* Magasin le moins cher */}
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Le plus économique</span>
              <div className="font-black text-sm text-emerald-400 truncate">
                {storePalmares.cheapestStore ? storePalmares.cheapestStore.name : '—'}
              </div>
              <div className="text-[11px] text-slate-400 font-medium">
                {storePalmares.cheapestStore ? `Panier moyen : ${formatCurrency(storePalmares.cheapestStore.avgBasket, { showSign: false })}` : 'Aucune donnée'}
              </div>
            </div>
          </div>

          {/* Alerte Achats d'Impulsion / Conseils */}
          {impulseAnalysis.impulseTotal > 0 && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-200 text-xs flex items-start gap-2.5">
              <AlertTriangle size={15} className="text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold text-white">Attention aux achats d'impulsion :</span>
                <p className="text-[11px] text-rose-200/90 leading-relaxed">
                  {impulseAnalysis.detectedItems.length} article(s) plaisir identifiés pour un total de{' '}
                  <strong className="text-white font-mono">{formatCurrency(impulseAnalysis.impulseTotal, { showSign: false })}</strong>.
                  En réduisant ces extras le mois prochain, vous augmenteriez directement votre épargne mensuelle.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. SECTION D'ANALYSE VISUELLE : 3 GRAPHISME RECHARTS AVEC FLÈCHE TOOLTIP   */}
      {/* ========================================================================= */}
      <div className="rounded-2xl p-4 sm:p-5 bg-slate-900/80 border border-white/10 shadow-sm space-y-4">
        {/* Barre de contrôle des 3 vues graphiques */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
              {chartView === 'pie' ? <PieIcon size={16} /> : chartView === 'bar' ? <BarChart3 size={16} /> : <LineIcon size={16} />}
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base text-white">
                {chartView === 'pie' && 'Répartition des Dépenses par Rayon'}
                {chartView === 'bar' && 'Comparatif des Dépenses par Enseigne'}
                {chartView === 'line' && 'Évolution Temporelle des Dépenses'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Survolez ou touchez chaque barre ou tranche pour afficher la flèche détaillée
              </p>
            </div>
          </div>

          {/* Boutons de bascule des 3 vues */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setChartView('pie')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                chartView === 'pie'
                  ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <PieIcon size={13} />
              <span>Rayons</span>
            </button>

            <button
              type="button"
              onClick={() => setChartView('bar')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                chartView === 'bar'
                  ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <BarChart3 size={13} />
              <span>Magasins</span>
            </button>

            <button
              type="button"
              onClick={() => setChartView('line')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                chartView === 'line'
                  ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <LineIcon size={13} />
              <span>Évolution</span>
            </button>
          </div>
        </div>

        {/* Zone de rendu Recharts */}
        <div className="w-full h-64 sm:h-72">
          {chartView === 'pie' && (
            categoryChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">
                Aucune donnée par rayon pour cette période.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<ArrowCalloutTooltip />} />
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} stroke="rgba(12, 18, 34, 0.8)" strokeWidth={2} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )
          )}

          {chartView === 'bar' && (
            storeChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">
                Aucune donnée par magasin pour cette période.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={storeChartData} margin={{ top: 15, right: 10, left: 10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    interval={0}
                    tick={{ fill: '#94a3b8' }}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}€`}
                  />
                  <Tooltip content={<ArrowCalloutTooltip />} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {storeChartData.map((entry, index) => (
                      <Cell key={`bar-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )
          )}

          {chartView === 'line' && (
            timelineChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">
                Aucune dépense enregistrée sur cette période.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineChartData} margin={{ top: 15, right: 10, left: 10, bottom: 20 }}>
                  <defs>
                    <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    tick={{ fill: '#94a3b8' }}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}€`}
                  />
                  <Tooltip content={<ArrowCalloutTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#06b6d4"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#lineGradient)"
                    activeDot={{ r: 6, fill: '#22d3ee', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )
          )}
        </div>

        {/* Légende interactive des catégories / magasins */}
        {chartView === 'pie' && (
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-white/5 text-xs max-h-24 overflow-y-auto no-scrollbar">
            {categoryChartData.map(entry => (
              <div key={entry.name} className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white/[0.02] border border-white/5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.fill }} />
                <span className="text-slate-300 font-medium truncate max-w-[120px]">{entry.name}</span>
                <span className="font-mono font-bold text-white text-[11px]">{entry.percent}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
