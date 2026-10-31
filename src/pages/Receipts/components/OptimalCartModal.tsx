import React from 'react';
import { 
  X, 
  Store, 
  TrendingDown, 
  Sparkles, 
  ShoppingBag, 
  CheckCircle2, 
  ArrowRight,
  Navigation
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { formatCurrency } from '../../../lib/bankUtils';
import { getProductEmoji } from '../../../lib/productEmojiMapper';

interface OptimalCartModalProps {
  isOpen: boolean;
  onClose: () => void;
  rows: Array<{
    cleBesoin: string;
    nomGenerique: string;
    rayon: string;
    storeOffers: Record<string, any>;
    storeCount: number;
    isComparable: boolean;
    lowestPrice: number;
    highestPrice: number;
    priceDiff: number;
    priceDiffPercent: number;
    cheapestStore: string;
  }>;
}

export const OptimalCartModal: React.FC<OptimalCartModalProps> = ({
  isOpen,
  onClose,
  rows
}) => {
  if (!isOpen) return null;

  // Calculer les statistiques d'optimisation
  const comparableRows = rows.filter(r => r.isComparable && r.priceDiff > 0);
  const totalPotentialSavings = comparableRows.reduce((acc, r) => acc + r.priceDiff, 0);

  // Répartition par magasin le moins cher
  const storeWinCounts: Record<string, { count: number; items: typeof comparableRows; totalSavings: number }> = {};
  comparableRows.forEach(r => {
    const store = r.cheapestStore || 'Autre';
    if (!storeWinCounts[store]) {
      storeWinCounts[store] = { count: 0, items: [], totalSavings: 0 };
    }
    storeWinCounts[store].count += 1;
    storeWinCounts[store].items.push(r);
    storeWinCounts[store].totalSavings += r.priceDiff;
  });

  const sortedStores = Object.entries(storeWinCounts).sort((a, b) => b[1].count - a[1].count);
  const bestSingleStore = sortedStores[0] ? sortedStores[0][0] : null;

  return (
    <div 
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-3xl glass-surface rounded-[2rem] border border-white/25 shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] text-slate-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* EN-TÊTE DE LA MODALE */}
        <div className="p-5 sm:p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl glass-glow-emerald flex items-center justify-center text-emerald-300 shadow-glow-emerald shrink-0">
              <Sparkles size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">
                  Itinéraire &amp; Stratégie d'Achat
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Algorithme 0 €
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight mt-0.5">
                Panier Optimal &amp; Économies Détectées
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full glass-pill hover:bg-white/20 flex items-center justify-center text-slate-400 hover:text-white transition-colors shrink-0"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* CORPS DÉFILANT */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* BANDEAU TOP SYNTHÈSE D'ÉCONOMIE */}
          <div className="glass-glow-emerald rounded-2xl p-5 border border-emerald-400/40 relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                <TrendingDown size={16} />
                <span>Gain maximal théorique sur l'ensemble des articles comparés :</span>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">
                -{formatCurrency(totalPotentialSavings, { showSign: false })}
              </div>
              <p className="text-[11px] text-emerald-200/80">
                Sur <strong>{comparableRows.length} articles</strong> analysés dans au moins 2 enseignes concurrentes.
              </p>
            </div>

            {bestSingleStore && (
              <div className="glass-pill px-4 py-3 rounded-xl border border-white/20 text-left sm:text-right shrink-0">
                <div className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">
                  Enseigne la plus compétitive
                </div>
                <div className="text-sm font-extrabold text-white mt-0.5 flex items-center gap-1.5 justify-start sm:justify-end">
                  <Store size={14} className="text-cyan-400" />
                  <span>{bestSingleStore}</span>
                </div>
                <div className="text-[10px] text-emerald-300 mt-0.5">
                  Leader sur {storeWinCounts[bestSingleStore].count} produit{storeWinCounts[bestSingleStore].count > 1 ? 's' : ''}
                </div>
              </div>
            )}
          </div>

          {/* PALMARÈS DES ENSEIGNES (STRATÉGIE MULTI-MAGASINS) */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Navigation size={14} className="text-cyan-400" />
              <span>Où acheter chaque produit pour payer le moins cher ?</span>
            </h3>

            {sortedStores.length === 0 ? (
              <div className="p-8 text-center glass-pill rounded-2xl text-slate-400 text-xs">
                Aucun produit comparable n'a encore été relevé dans plusieurs magasins. Scannez d'autres tickets pour enrichir le comparatif.
              </div>
            ) : (
              <div className="space-y-3">
                {sortedStores.map(([storeName, data], idx) => (
                  <div key={storeName} className="glass-surface rounded-2xl p-4 border border-white/15 space-y-3">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-bold flex items-center justify-center border border-cyan-400/30">
                          {idx + 1}
                        </span>
                        <div>
                          <h4 className="font-extrabold text-white text-sm flex items-center gap-1.5">
                            <Store size={13} className="text-cyan-300" />
                            <span>{storeName}</span>
                          </h4>
                          <span className="text-[10px] text-slate-400">
                            {data.count} article{data.count > 1 ? 's' : ''} au tarif le plus bas
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold text-emerald-400 font-mono">
                          +{formatCurrency(data.totalSavings, { showSign: false })}
                        </span>
                        <span className="text-[10px] text-slate-400 block">économisés ici</span>
                      </div>
                    </div>

                    {/* LISTE COMPACTE DES ARTICLES CONSEILLÉS CHEZ CE COMMERÇANT */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {data.items.slice(0, 8).map(item => {
                        const offer = item.storeOffers[storeName];
                        return (
                          <div key={item.cleBesoin} className="glass-pill px-3 py-2 rounded-xl flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 truncate">
                              <span className="text-base shrink-0">{getProductEmoji(item.nomGenerique, item.rayon)}</span>
                              <span className="font-medium text-white truncate" title={item.nomGenerique}>
                                {item.nomGenerique}
                              </span>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-bold text-emerald-300 font-mono">
                                {formatCurrency(offer?.prixUnitaire || item.lowestPrice, { showSign: false })}
                              </span>
                              <span className="text-[9px] text-slate-400 block font-mono">
                                /{offer?.unite || 'u'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {data.items.length > 8 && (
                      <p className="text-[10px] text-slate-400 italic text-center pt-1">
                        + {data.items.length - 8} autre{data.items.length - 8 > 1 ? 's' : ''} article{data.items.length - 8 > 1 ? 's' : ''}...
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* PIED DE MODALE */}
        <div className="p-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Audit temps réel basé sur vos tickets physiques enregistrés.
          </span>
          <Button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-full glass-pill hover:bg-white/20 text-white font-bold text-xs border border-white/30 ml-auto"
          >
            Fermer l'analyse
          </Button>
        </div>
      </div>
    </div>
  );
};
