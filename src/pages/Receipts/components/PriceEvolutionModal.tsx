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
  Info,
  Sparkles
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
    store: h.storeName
  }));

  const minPrice = history.length > 0 ? Math.min(...history.map(h => h.unitPrice)) : 0;
  const maxPrice = history.length > 0 ? Math.max(...history.map(h => h.unitPrice)) : 0;
  const lastPurchase = history.length > 0 ? history[history.length - 1] : null;

  return (
    <div className="fixed inset-0 z-[105] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl bg-[#0c1222]/95 border border-white/20 shadow-2xl shadow-cyan-950/40 backdrop-blur-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER APPLE VISIONOS */}
        <div className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-white/10 flex items-center justify-between gap-3 bg-white/[0.02]">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="glass-pill text-[10px] text-cyan-300 font-mono font-bold">
                {product.category}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {history.length} relevé{history.length > 1 ? 's' : ''} de prix
              </span>
            </div>
            <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight mt-1 truncate">
              Évolution du Prix : {product.normalizedName}
            </h2>
            {product.sampleBrands.length > 0 && product.sampleBrands[0] !== 'Générique' && (
              <p className="text-xs text-slate-400 mt-0.5">
                Marques constatées : {product.sampleBrands.join(', ')}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        {/* CONTENU DÉROULANT */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-140px)]">

          {/* BANDEAU STATUT AUDIT / ÉVOLUTION */}
          {evolution ? (
            <div className={cn(
              "p-3.5 sm:p-4 rounded-2xl border flex items-start gap-3 backdrop-blur-xl",
              (evolution.status === 'HIKE' || evolution.status === 'UP') && "bg-rose-500/15 border-rose-500/30 text-rose-300",
              (evolution.status === 'DROP' || evolution.status === 'DOWN') && "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
              evolution.status === 'STABLE' && "bg-white/[0.035] border-white/10 text-slate-300"
            )}>
              <div className="mt-0.5 shrink-0">
                {(evolution.status === 'HIKE' || evolution.status === 'UP') && <AlertTriangle size={18} className="text-rose-400" />}
                {(evolution.status === 'DROP' || evolution.status === 'DOWN') && <CheckCircle2 size={18} className="text-emerald-400" />}
                {evolution.status === 'STABLE' && <Minus size={18} className="text-slate-400" />}
              </div>
              <div className="space-y-0.5 text-xs">
                <p className="font-extrabold text-sm text-white">
                  {evolution.message}
                </p>
                <p className="text-[11px] opacity-90 font-mono">
                  Dernier prix : {formatCurrency(evolution.currentUnitPrice ?? lastPurchase?.unitPrice ?? 0, { showSign: false })}/{product.unit || 'u'} 
                  {evolution.previousUnitPrice !== undefined && ` vs ${formatCurrency(evolution.previousUnitPrice, { showSign: false })}/${product.unit || 'u'} précédemment.`}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-white/[0.035] border border-white/10 text-xs text-slate-300 flex items-center gap-2">
              <Info size={16} className="text-cyan-400 shrink-0" />
              <span>Un seul relevé de prix enregistré pour ce produit. L'évolution se débloquera dès votre prochain achat dans cette catégorie !</span>
            </div>
          )}

          {/* METRICS CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 shadow-sm">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-0.5">Dernier prix</span>
              <span className="text-base sm:text-lg font-black font-mono text-white">
                {lastPurchase ? formatCurrency(lastPurchase.unitPrice, { showSign: false }) : '—'}
              </span>
              <span className="text-[10px] text-slate-400 block font-mono">/{product.unit || 'u'}</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 shadow-sm">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-0.5">Prix le plus bas</span>
              <span className="text-base sm:text-lg font-black font-mono text-emerald-400">
                {minPrice > 0 ? formatCurrency(minPrice, { showSign: false }) : '—'}
              </span>
              <span className="text-[10px] text-slate-400 block font-mono">/{product.unit || 'u'}</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 shadow-sm">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-0.5">Prix le plus haut</span>
              <span className="text-base sm:text-lg font-black font-mono text-rose-400">
                {maxPrice > 0 ? formatCurrency(maxPrice, { showSign: false }) : '—'}
              </span>
              <span className="text-[10px] text-slate-400 block font-mono">/{product.unit || 'u'}</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 shadow-sm">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-0.5">Dernière enseigne</span>
              <span className="text-xs sm:text-sm font-bold text-white truncate block mt-0.5">
                {lastPurchase ? lastPurchase.storeName : '—'}
              </span>
              <span className="text-[10px] text-slate-400 block font-mono">
                {lastPurchase ? formatDateFR(lastPurchase.date) : ''}
              </span>
            </div>
          </div>

          {/* GRAPHIQUE LINE CHART RECHARTS */}
          {chartData.length >= 2 ? (
            <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.035] border border-white/10 shadow-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span className="flex items-center gap-1.5 text-white">
                  <TrendingUp size={14} className="text-cyan-400" />
                  Courbe chronologique du prix (€/{product.unit || 'u'})
                </span>
                <span className="font-mono text-[11px] text-cyan-300 font-bold">{chartData.length} relevés</span>
              </div>

              <div className="h-[220px] w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis 
                      dataKey="dateFormatted" 
                      tick={{ fontSize: 10, fill: '#94a3b8' }} 
                      stroke="rgba(255,255,255,0.15)"
                    />
                    <YAxis 
                      dataKey="unitPrice" 
                      domain={['auto', 'auto']}
                      tick={{ fontSize: 10, fill: '#94a3b8' }} 
                      stroke="rgba(255,255,255,0.15)"
                      tickFormatter={(val) => `${val} €`}
                    />
                    <Tooltip
                      formatter={(val: number) => [`${val.toFixed(2)} €/${product.unit || 'u'}`, 'Prix standardisé']}
                      labelFormatter={(label, payload) => {
                        const item = payload?.[0]?.payload;
                        return item ? `${item.dateFormatted} (${item.store})` : label;
                      }}
                      contentStyle={{
                        backgroundColor: 'rgba(12, 18, 34, 0.95)',
                        borderColor: 'rgba(255, 255, 255, 0.15)',
                        borderRadius: '16px',
                        fontSize: '12px',
                        color: '#fff',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="unitPrice" 
                      stroke="#38bdf8" 
                      strokeWidth={3}
                      dot={{ r: 5, fill: '#38bdf8', stroke: '#0c1222', strokeWidth: 2 }}
                      activeDot={{ r: 7, stroke: '#38bdf8', strokeWidth: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-dashed border-white/10 text-center text-xs text-slate-400">
              La courbe s'affichera dès que vous aurez au moins 2 tickets enregistrés pour ce produit.
            </div>
          )}

          {/* HISTORIQUE COMPLET DES ACHATS POUR CE PRODUIT */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Calendar size={13} className="text-cyan-400" />
              Historique détaillé des achats
            </h4>

            <div className="border border-white/10 rounded-2xl overflow-hidden bg-white/[0.02] shadow-xl">
              <div className="overflow-x-auto touch-scroll">
                <table className="w-full text-left border-collapse text-xs min-w-[520px]">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Magasin</th>
                      <th className="py-2.5 px-3">Marque</th>
                      <th className="py-2.5 px-3">Format</th>
                      <th className="py-2.5 px-3 text-right">Prix Unitaire</th>
                      <th className="py-2.5 px-3 text-center">Qté</th>
                      <th className="py-2.5 px-3 text-right">Total Payé</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {history.map((record, idx) => (
                      <tr key={`${record.receiptId}-${idx}`} className="hover:bg-white/[0.03] transition-colors">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                          {formatDateFR(record.date)}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-white">
                          {record.storeName}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">
                          {record.brand || 'Générique'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                          {record.weightOrVolume || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-cyan-300">
                          {formatCurrency(record.unitPrice, { showSign: false })}/{record.unit || product.unit || 'u'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-300">
                          {record.quantity}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-white">
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
        <div className="p-4 sm:p-5 border-t border-white/10 bg-white/[0.02] flex items-center justify-end">
          <Button 
            onClick={onClose} 
            size="sm" 
            className="text-xs font-bold px-6 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all cursor-pointer"
          >
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
};
