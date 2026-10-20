import React, { useMemo } from 'react';
import { 
  Carrot, 
  Milk, 
  Package, 
  Cookie, 
  Utensils, 
  CupSoda, 
  Home, 
  Sparkles, 
  MoreHorizontal,
  Store,
  Check,
  ArrowRight,
  TrendingDown,
  BookOpen,
  HeartPulse,
  ShoppingBag
} from 'lucide-react';
import { 
  type Receipt, 
  type ReceiptItem, 
  type SupermarketAisle, 
  type SupermarketAisleKey, 
  type ComparativeMatrix,
  type AisleGroup,
  SUPERMARKET_AISLES 
} from '../../../types/receipts';
import { cn } from '../../../lib/utils';

interface WhereToBuySectionProps {
  receipts: Receipt[];
  matrix: ComparativeMatrix;
  onSelectAisle?: (aisle: SupermarketAisle) => void;
}

interface CategoryRecommendation {
  aisle: SupermarketAisle;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  recommendedStore: string;
  badgeLabel: string;
  itemCount: number;
  cheapestCount: number;
  style: {
    iconBg: string;
    iconColor: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
  };
}

const AISLE_ICONS: Record<SupermarketAisle, React.ComponentType<{ size?: number; className?: string }>> = {
  'Fruits & Légumes': Carrot,
  'Produits frais & Crèmerie': Milk,
  'Épicerie salée & Épices': Package,
  'Épicerie sucrée': Cookie,
  'Boucherie, Volaille & Poissonnerie': Utensils,
  'Boissons': CupSoda,
  'Entretien & Maison': Home,
  'Hygiène, Beauté & Sanitaire': Sparkles,
  'Maison, Textile & Culture': BookOpen,
  'Santé & Pharmacie': HeartPulse,
  'Sacs & Consignes': ShoppingBag,
  'Autres / Divers': MoreHorizontal
};

const AISLE_STYLES: Record<SupermarketAisle, {
  iconBg: string;
  iconColor: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}> = {
  'Fruits & Légumes': {
    iconBg: 'bg-emerald-500/15 dark:bg-emerald-500/20',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    badgeBg: 'bg-emerald-500/10',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    badgeBorder: 'border-emerald-500/20'
  },
  'Produits frais & Crèmerie': {
    iconBg: 'bg-blue-500/15 dark:bg-blue-500/20',
    iconColor: 'text-blue-600 dark:text-blue-400',
    badgeBg: 'bg-blue-500/10',
    badgeText: 'text-blue-700 dark:text-blue-300',
    badgeBorder: 'border-blue-500/20'
  },
  'Épicerie salée & Épices': {
    iconBg: 'bg-amber-500/15 dark:bg-amber-500/20',
    iconColor: 'text-amber-600 dark:text-amber-400',
    badgeBg: 'bg-amber-500/10',
    badgeText: 'text-amber-700 dark:text-amber-300',
    badgeBorder: 'border-amber-500/20'
  },
  'Épicerie sucrée': {
    iconBg: 'bg-orange-500/15 dark:bg-orange-500/20',
    iconColor: 'text-orange-600 dark:text-orange-400',
    badgeBg: 'bg-orange-500/10',
    badgeText: 'text-orange-700 dark:text-orange-300',
    badgeBorder: 'border-orange-500/20'
  },
  'Boucherie, Volaille & Poissonnerie': {
    iconBg: 'bg-rose-500/15 dark:bg-rose-500/20',
    iconColor: 'text-rose-600 dark:text-rose-400',
    badgeBg: 'bg-rose-500/10',
    badgeText: 'text-rose-700 dark:text-rose-300',
    badgeBorder: 'border-rose-500/20'
  },
  'Boissons': {
    iconBg: 'bg-teal-500/15 dark:bg-teal-500/20',
    iconColor: 'text-teal-600 dark:text-teal-400',
    badgeBg: 'bg-teal-500/10',
    badgeText: 'text-teal-700 dark:text-teal-300',
    badgeBorder: 'border-teal-500/20'
  },
  'Entretien & Maison': {
    iconBg: 'bg-cyan-500/15 dark:bg-cyan-500/20',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    badgeBg: 'bg-cyan-500/10',
    badgeText: 'text-cyan-700 dark:text-cyan-300',
    badgeBorder: 'border-cyan-500/20'
  },
  'Hygiène, Beauté & Sanitaire': {
    iconBg: 'bg-purple-500/15 dark:bg-purple-500/20',
    iconColor: 'text-purple-600 dark:text-purple-400',
    badgeBg: 'bg-purple-500/10',
    badgeText: 'text-purple-700 dark:text-purple-300',
    badgeBorder: 'border-purple-500/20'
  },
  'Maison, Textile & Culture': {
    iconBg: 'bg-indigo-500/15 dark:bg-indigo-500/20',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    badgeBg: 'bg-indigo-500/10',
    badgeText: 'text-indigo-700 dark:text-indigo-300',
    badgeBorder: 'border-indigo-500/20'
  },
  'Santé & Pharmacie': {
    iconBg: 'bg-red-500/15 dark:bg-red-500/20',
    iconColor: 'text-red-600 dark:text-red-400',
    badgeBg: 'bg-red-500/10',
    badgeText: 'text-red-700 dark:text-red-300',
    badgeBorder: 'border-red-500/20'
  },
  'Sacs & Consignes': {
    iconBg: 'bg-amber-600/15 dark:bg-amber-600/20',
    iconColor: 'text-amber-700 dark:text-amber-400',
    badgeBg: 'bg-amber-600/10',
    badgeText: 'text-amber-800 dark:text-amber-300',
    badgeBorder: 'border-amber-600/20'
  },
  'Autres / Divers': {
    iconBg: 'bg-slate-500/15 dark:bg-slate-500/20',
    iconColor: 'text-slate-600 dark:text-slate-400',
    badgeBg: 'bg-slate-500/10',
    badgeText: 'text-slate-700 dark:text-slate-300',
    badgeBorder: 'border-slate-500/20'
  }
};

export const WhereToBuySection: React.FC<WhereToBuySectionProps> = ({
  receipts,
  matrix,
  onSelectAisle
}) => {
  // Calcul avec rigueur d'audit de l'enseigne la plus économique pour chaque rayon
  // RÈGLE MÉTIER STRICTE : AUCUNE MENTION DE POURCENTAGE DANS CETTE SECTION
  const recommendations = useMemo(() => {
    const list: CategoryRecommendation[] = [];

    // 1. Regrouper les articles réels de tous les tickets par rayon
    const aisleItemsMap = new Map<SupermarketAisle, Array<{ item: ReceiptItem; storeName: string }>>();
    
    receipts.forEach(r => {
      r.items.forEach(it => {
        const aisle = (it.category as SupermarketAisle) || 'Autres / Divers';
        if (!aisleItemsMap.has(aisle)) {
          aisleItemsMap.set(aisle, []);
        }
        aisleItemsMap.get(aisle)!.push({ item: it, storeName: r.storeName });
      });
    });

    // 2. Indexer la matrice pour le décompte des produits comparables les moins chers
    const matrixAisleMap = new Map<SupermarketAisle, AisleGroup>();
    matrix.aisleGroups.forEach(g => {
      matrixAisleMap.set(g.aisle, g);
    });

    // 3. Parcourir chaque rayon dans l'ordre officiel
    SUPERMARKET_AISLES.forEach(aisle => {
      const items = aisleItemsMap.get(aisle);
      if (!items || items.length === 0) return; // Uniquement les rayons avec achats constatés

      const group = matrixAisleMap.get(aisle);
      const storeWins: Record<string, number> = {};
      const storeItemCount: Record<string, number> = {};
      const storeUnitPrices: Record<string, number[]> = {};

      items.forEach(({ item, storeName }) => {
        storeItemCount[storeName] = (storeItemCount[storeName] || 0) + 1;
        const unitPrice = item.unitPrice || item.referenceUnitPrice || (item.pricePaid / Math.max(1, item.quantity));
        if (unitPrice > 0) {
          if (!storeUnitPrices[storeName]) storeUnitPrices[storeName] = [];
          storeUnitPrices[storeName].push(unitPrice);
        }
      });

      // Compter les victoires par magasin dans ce rayon (produits comparables où le magasin est le - cher)
      if (group && group.products) {
        group.products.forEach(p => {
          if (p.cheapestStore && p.status === 'COMPARABLE') {
            storeWins[p.cheapestStore] = (storeWins[p.cheapestStore] || 0) + 1;
          }
        });
      }

      const distinctStores = Object.keys(storeItemCount);
      let winningStore = distinctStores[0];
      let maxWins = -1;

      // Priorité 1 : Le magasin avec le plus grand nombre de produits les moins chers
      distinctStores.forEach(s => {
        const wins = storeWins[s] || 0;
        if (wins > maxWins) {
          maxWins = wins;
          winningStore = s;
        }
      });

      // Priorité 2 : Si aucun produit comparable direct, magasin au prix unitaire moyen le plus bas
      if (maxWins <= 0 && distinctStores.length > 1) {
        let lowestAvg = Infinity;
        distinctStores.forEach(s => {
          const prices = storeUnitPrices[s] || [];
          if (prices.length > 0) {
            const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
            if (avg < lowestAvg) {
              lowestAvg = avg;
              winningStore = s;
            }
          }
        });
      }

      // Priorité 3 : Si un seul magasin ou égalité, magasin avec le plus d'articles achetés
      if (!winningStore || distinctStores.length === 1) {
        winningStore = distinctStores.sort((a, b) => (storeItemCount[b] || 0) - (storeItemCount[a] || 0))[0];
      }

      // Libellé de recommandation (STRICTEMENT SANS POURCENTAGE)
      const wins = storeWins[winningStore] || 0;
      let badgeLabel = 'Meilleur prix constaté';

      if (distinctStores.length > 1) {
        if (wins > 1) {
          badgeLabel = `${wins} articles les moins chers`;
        } else if (wins === 1) {
          badgeLabel = 'Prix le plus bas du rayon';
        } else {
          badgeLabel = 'Prix moyen le plus bas';
        }
      } else {
        badgeLabel = `${items.length} article${items.length > 1 ? 's' : ''} analysé${items.length > 1 ? 's' : ''}`;
      }

      const style = AISLE_STYLES[aisle] || AISLE_STYLES['Autres / Divers'];

      list.push({
        aisle,
        icon: AISLE_ICONS[aisle] || Package,
        recommendedStore: winningStore,
        badgeLabel,
        itemCount: items.length,
        cheapestCount: wins,
        style
      });
    });

    return list;
  }, [receipts, matrix]);

  if (recommendations.length === 0) return null;

  return (
    <section className="space-y-3.5 animate-in fade-in duration-300">
      {/* EN-TÊTE DE LA SECTION STYLE GOOGLE STITCH */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500/20 via-primary/20 to-emerald-500/20 text-primary flex items-center justify-center shrink-0 shadow-xs">
            <Store size={16} className="text-primary dark:text-cyan-400" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-foreground tracking-tight flex items-center gap-2">
              <span>Où acheter quoi ?</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/70 font-mono">
                {recommendations.length} rayon{recommendations.length > 1 ? 's' : ''}
              </span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              L'enseigne la plus économique pour chaque catégorie, calculée d'après vos tickets réels.
            </p>
          </div>
        </div>

        <div className="text-[11px] font-medium text-muted-foreground hidden sm:flex items-center gap-1.5 self-start sm:self-auto">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Calculé en temps réel sur vos prix constatés</span>
        </div>
      </div>

      {/* GRILLE DE CARTES DESIGN DNA GOOGLE STITCH */}
      <div className="flex sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 overflow-x-auto no-scrollbar pb-2 sm:pb-0 overscroll-contain">
        {recommendations.map((rec) => {
          const Icon = rec.icon;

          return (
            <div
              key={rec.aisle}
              onClick={() => onSelectAisle?.(rec.aisle)}
              className={cn(
                "min-w-[175px] sm:min-w-0 flex-1 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all duration-200",
                "bg-card/90 dark:bg-card/60 backdrop-blur-md border-border/80 dark:border-white/[0.08]",
                "hover:border-primary/50 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer group flex flex-col items-center justify-between text-center select-none"
              )}
              title={`Voir les articles de ${rec.aisle}`}
            >
              {/* PASTILLE RONDE AVEC ICÔNE DÉDIÉE AU RAYON */}
              <div 
                className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center mb-3 shadow-xs transition-transform group-hover:scale-110 duration-200",
                  rec.style.iconBg,
                  rec.style.iconColor
                )}
              >
                <Icon size={22} />
              </div>

              {/* NOM DE LA CATÉGORIE / RAYON */}
              <div className="w-full space-y-1 mb-2">
                <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground block truncate" title={rec.aisle}>
                  {rec.aisle}
                </span>

                {/* ENSEIGNE RECOMMANDÉE EN GRAND ET EN GRAS */}
                <h4 className="text-base sm:text-lg font-black text-foreground group-hover:text-primary transition-colors tracking-tight truncate" title={rec.recommendedStore}>
                  {rec.recommendedStore}
                </h4>
              </div>

              {/* BADGE ÉCONOMIQUE (STRICTEMENT SANS POURCENTAGE) */}
              <div 
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold border max-w-full truncate",
                  rec.style.badgeBg,
                  rec.style.badgeText,
                  rec.style.badgeBorder
                )}
              >
                <Check size={12} className="shrink-0 text-emerald-500" />
                <span className="truncate">{rec.badgeLabel}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
