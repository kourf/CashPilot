import React from 'react';
import { 
  X, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Store, 
  Calendar, 
  Tag, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Info 
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { Button } from '../../../components/ui/button';
import { type ProductComparisonRow } from '../../../types/receipts';
import { formatCurrency, formatDateFR } from '../../../lib/bankUtils';
import { cn } from '../../../lib/utils';

interface PriceEvolutionModalProps {
  product: ProductComparisonRow | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PriceEvolutionModal: React.FC<PriceEvolutionModalProps> = ({
  product,
  isOpen,
  onClose
}) => {
  if (!isOpen || !product) return null;

  const evolution = product.priceEvolution;
  const history = [...(product.priceHistory || [])].sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  const chartData = history.map(h => ({
    date: h.date,
    dateFormatted: formatDateFR(h.date),
    unitPrice: h.unitPrice,
    pricePaid: h.pricePaid,
    store: h.storeName,
    unit: h.unit || product.unit || 'u'
  }));

  const lastPurchase = history[history.length - 1];
  const previousPurchase = history[history.length - 2];

  const minPrice = history.length > 0 ? Math.min(...history.map(h => h.unitPrice)) : 0;
  const maxPrice = history.length > 0 ? Math.max(...history.map(h => h.unitPrice)) : 0;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl bg-card border border-border/80 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-border/70 flex items-center justify-between gap-3 bg-secondary/30">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {product.category}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {history.length} relevé{history.length > 1 ? 's' : ''} de prix
              </span>
            </div>
            <h2 className="text-lg sm:text-2xl font-black text-foreground tracking-tight mt-1">
              Évolution du Prix : {product.normalizedName}
            </h2>
            {product.sampleBrands.length > 0 && product.sampleBrands[0] !== 'Générique' && (
              <p className="text-xs text-muted-foreground">
                Marques constatées : {product.sampleBrands.join(', ')}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* CONTENU DÉROULANT */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-140px)]">

          {/* BANDEAU STATUT AUDIT / ÉVOLUTION */}
          {evolution ? (
            <div className={cn(
              "p-3.5 sm:p-4 rounded-2xl border flex items-start gap-3",
              evolution.status === 'UP' && "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300",
              evolution.status === 'DOWN' && "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300",
              evolution.status === 'STABLE' && "bg-secondary border-border/80 text-muted-foreground"
            )}>
              <div className="mt-0.5 shrink-0">
                {evolution.status === 'UP' && <AlertTriangle size={18} className="text-red-500" />}
                {evolution.status === 'DOWN' && <CheckCircle2 size={18} className="text-emerald-500" />}
                {evolution.status === 'STABLE' && <Minus size={18} className="text-muted-foreground" />}
              </div>
              <div className="space-y-0.5 text-xs">
                <p className="font-extrabold text-sm">
                  {evolution.message}
                </p>
                <p className="text-[11px] opacity-90">
                  Dernier prix : {formatCurrency(evolution.currentUnitPrice, { showSign: false })}/{product.unit || 'u'} 
                  {evolution.previousUnitPrice !== undefined && ` vs ${formatCurrency(evolution.previousUnitPrice, { showSign: false })}/${product.unit || 'u'} précédemment.`}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-secondary/50 border border-border/70 text-xs text-muted-foreground flex items-center gap-2">
              <Info size={15} className="text-primary shrink-0" />
              <span>Un seul relevé de prix enregistré pour ce produit. L'évolution se débloquera dès votre prochain achat dans cette catégorie !</span>
            </div>
          )}

          {/* METRICS CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="p-3 rounded-xl bg-secondary/40 border border-border/70">
              <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Dernier prix</span>
              <span className="text-base sm:text-lg font-black font-mono text-foreground">
                {lastPurchase ? formatCurrency(lastPurchase.unitPrice, { showSign: false }) : '—'}
              </span>
              <span className="text-[10px] text-muted-foreground block">/{product.unit || 'u'}</span>
            </div>

            <div className="p-3 rounded-xl bg-secondary/40 border border-border/70">
              <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Prix le plus bas</span>
              <span className="text-base sm:text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                {minPrice > 0 ? formatCurrency(minPrice, { showSign: false }) : '—'}
              </span>
              <span className="text-[10px] text-muted-foreground block">/{product.unit || 'u'}</span>
            </div>

            <div className="p-3 rounded-xl bg-secondary/40 border border-border/70">
              <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Prix le plus haut</span>
              <span className="text-base sm:text-lg font-black font-mono text-red-500">
                {maxPrice > 0 ? formatCurrency(maxPrice, { showSign: false }) : '—'}
              </span>
              <span className="text-[10px] text-muted-foreground block">/{product.unit || 'u'}</span>
            </div>

            <div className="p-3 rounded-xl bg-secondary/40 border border-border/70">
              <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Dernière enseigne</span>
              <span className="text-xs sm:text-sm font-bold text-foreground truncate block mt-1">
                {lastPurchase ? lastPurchase.storeName : '—'}
              </span>
              <span className="text-[10px] text-muted-foreground block font-mono">
                {lastPurchase ? formatDateFR(lastPurchase.date) : ''}
              </span>
            </div>
          </div>

          {/* GRAPHIQUE LINE CHART RECHARTS */}
          {chartData.length >= 2 ? (
            <div className="p-4 rounded-2xl bg-secondary/20 border border-border/70 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <TrendingUp size={14} className="text-primary" />
                  Courbe chronologique du prix de référence (€/{product.unit || 'u'})
                </span>
                <span className="font-mono text-[11px]">{chartData.length} points</span>
              </div>

              <div className="h-[220px] w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis 
                      dataKey="dateFormatted" 
                      tick={{ fontSize: 10, fill: '#888' }} 
                      stroke="rgba(255,255,255,0.2)"
                    />
                    <YAxis 
                      dataKey="unitPrice" 
                      domain={['auto', 'auto']}
                      tick={{ fontSize: 10, fill: '#888' }} 
                      stroke="rgba(255,255,255,0.2)"
                      tickFormatter={(val) => `${val} €`}
                    />
                    <Tooltip
                      formatter={(val: number) => [`${val.toFixed(2)} €/${product.unit || 'u'}`, 'Prix de référence']}
                      labelFormatter={(label, payload) => {
                        const item = payload?.[0]?.payload;
                        return item ? `${item.dateFormatted} (${item.store})` : label;
                      }}
                      contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '12px',
                        fontSize: '12px',
                        color: '#fff'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="unitPrice" 
                      stroke="#06b6d4" 
                      strokeWidth={3}
                      dot={{ r: 5, fill: '#06b6d4', stroke: '#ffffff', strokeWidth: 2 }}
                      activeDot={{ r: 7, stroke: '#06b6d4', strokeWidth: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-secondary/20 border border-dashed border-border/70 text-center py-6 text-xs text-muted-foreground">
              La courbe s'affichera dès que vous aurez au moins 2 tickets enregistrés pour ce produit.
            </div>
          )}

          {/* HISTORIQUE COMPLET DES ACHATS POUR CE PRODUIT */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Calendar size={13} />
              Historique détaillé des achats
            </h4>

            <div className="border border-border/70 rounded-xl overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs min-w-[500px]">
                  <thead>
                    <tr className="border-b border-border/70 bg-secondary/40 text-[10px] font-bold text-muted-foreground uppercase">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Magasin</th>
                      <th className="py-2.5 px-3">Marque</th>
                      <th className="py-2.5 px-3">Format</th>
                      <th className="py-2.5 px-3 text-right">Prix Unitaire</th>
                      <th className="py-2.5 px-3 text-center">Qté</th>
                      <th className="py-2.5 px-3 text-right">Total Payé</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {history.map((record, idx) => (
                      <tr key={`${record.receiptId}-${idx}`} className="hover:bg-muted/20">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
                          {formatDateFR(record.date)}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-foreground">
                          {record.storeName}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {record.brand || 'Générique'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
                          {record.weightOrVolume || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-cyan-600 dark:text-cyan-400">
                          {formatCurrency(record.unitPrice, { showSign: false })}/{record.unit || product.unit || 'u'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          {record.quantity}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                          {formatCurrency(record.pricePaid * record.quantity, { showSign: false })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>

        {/* FOOTER */}
        <div className="p-4 sm:p-5 border-t border-border/70 bg-secondary/20 flex items-center justify-end">
          <Button onClick={onClose} size="sm" className="text-xs font-bold px-5">
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
};
