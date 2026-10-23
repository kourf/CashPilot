import React, { useMemo, useState } from 'react';
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
  ShoppingBag,
  FileText,
  Flower2,
  Award,
  Layers,
  ChevronRight
} from 'lucide-react';
import { 
  type Receipt, 
  type ReceiptItem, 
  type SupermarketAisle, 
  type ComparativeMatrix,
  type AisleGroup,
  SUPERMARKET_AISLES 
} from '../../../types/receipts';
import { cn } from '../../../lib/utils';
import { normalizeStoreName } from '../../../lib/receiptClassifier';

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

interface StoreRecommendationGroup {
  storeName: string;
  ticketCount: number;
  totalItems: number;
  branding: {
    gradient: string;
    borderHover: string;
    iconBg: string;
    iconColor: string;
    badgeBg: string;
    accentDot: string;
  };
  wonAisles: Array<{
    aisle: SupermarketAisle;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    badgeLabel: string;
    itemCount: number;
    style: {
      iconBg: string;
      iconColor: string;
      badgeBg: string;
      badgeText: string;
      badgeBorder: string;
    };
  }>;
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
  'Papeterie & Bureau': FileText,
  'Fleurs & Cadeaux': Flower2,
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
  'Papeterie & Bureau': {
    iconBg: 'bg-violet-500/15 dark:bg-violet-500/20',
    iconColor: 'text-violet-600 dark:text-violet-400',
    badgeBg: 'bg-violet-500/10',
    badgeText: 'text-violet-700 dark:text-violet-300',
    badgeBorder: 'border-violet-500/20'
  },
  'Fleurs & Cadeaux': {
    iconBg: 'bg-pink-500/15 dark:bg-pink-500/20',
    iconColor: 'text-pink-600 dark:text-pink-400',
    badgeBg: 'bg-pink-500/10',
    badgeText: 'text-pink-700 dark:text-pink-300',
    badgeBorder: 'border-pink-500/20'
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

const getStoreBranding = (storeName: string) => {
  const lower = storeName.toLowerCase();
  if (lower.includes('leclerc')) {
    return {
      gradient: 'from-blue-600/10 via-sky-500/5 to-transparent',
      borderHover: 'hover:border-blue-500/50',
      iconBg: 'bg-blue-500/15 dark:bg-blue-500/25',
      iconColor: 'text-blue-600 dark:text-blue-400',
      badgeBg: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
      accentDot: 'bg-blue-500'
    };
  }
  if (lower.includes('lidl')) {
    return {
      gradient: 'from-amber-500/10 via-yellow-500/5 to-transparent',
      borderHover: 'hover:border-amber-500/50',
      iconBg: 'bg-amber-500/15 dark:bg-amber-500/25',
      iconColor: 'text-amber-600 dark:text-amber-400',
      badgeBg: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
      accentDot: 'bg-amber-500'
    };
  }
  if (lower.includes('intermarche') || lower.includes('intermarché')) {
    return {
      gradient: 'from-rose-500/10 via-red-500/5 to-transparent',
      borderHover: 'hover:border-rose-500/50',
      iconBg: 'bg-rose-500/15 dark:bg-rose-500/25',
      iconColor: 'text-rose-600 dark:text-rose-400',
      badgeBg: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
      accentDot: 'bg-rose-500'
    };
  }
  if (lower.includes('super u') || lower.includes('hyper u') || lower.includes('u express')) {
    return {
      gradient: 'from-cyan-500/10 via-teal-500/5 to-transparent',
      borderHover: 'hover:border-cyan-500/50',
      iconBg: 'bg-cyan-500/15 dark:bg-cyan-500/25',
      iconColor: 'text-cyan-600 dark:text-cyan-400',
      badgeBg: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20',
      accentDot: 'bg-cyan-500'
    };
  }
  return {
    gradient: 'from-primary/10 via-violet-500/5 to-transparent',
    borderHover: 'hover:border-primary/50',
    iconBg: 'bg-primary/15 dark:bg-primary/25',
    iconColor: 'text-primary',
    badgeBg: 'bg-primary/10 text-primary border-primary/20',
    accentDot: 'bg-primary'
  };
};

export const WhereToBuySection: React.FC<WhereToBuySectionProps> = ({
  receipts,
  matrix,
  onSelectAisle
}) => {
  // Mode de vue : 'store' (Par Enseigne - ZÉRO DOUBLON) ou 'aisle' (Par Rayon - 13 Rayons)
  // Par défaut sur 'store' pour garantir qu'aucune enseigne ne soit dupliquée visuellement
  const [viewMode, setViewMode] = useState<'store' | 'aisle'>('store');

  // Calcul avec rigueur d'audit de l'enseigne la plus économique pour chaque rayon
  // RÈGLE MÉTIER STRICTE : AUCUNE MENTION DE POURCENTAGE DANS CETTE SECTION
  const categoryRecommendations = useMemo(() => {
    const list: CategoryRecommendation[] = [];

    // 1. Regrouper les articles réels de tous les tickets par rayon
    const aisleItemsMap = new Map<SupermarketAisle, Array<{ item: ReceiptItem; storeName: string }>>();
    
    receipts.forEach(r => {
      r.items.forEach(it => {
        const aisle = (it.category as SupermarketAisle) || 'Autres / Divers';
        if (!aisleItemsMap.has(aisle)) {
          aisleItemsMap.set(aisle, []);
        }
        aisleItemsMap.get(aisle)!.push({ item: it, storeName: normalizeStoreName(r.storeName) });
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

  // REGROUPEMENT PAR ENSEIGNE (VUE 100% SANS DOUBLONS)
  // Chaque magasin unique forme une seule carte listant tous ses rayons champions
  const storeRecommendations = useMemo(() => {
    // 1. Recenser toutes les enseignes réelles
    const storeMap = new Map<string, StoreRecommendationGroup>();

    receipts.forEach(r => {
      const s = normalizeStoreName(r.storeName);
      if (!s) return;
      if (!storeMap.has(s)) {
        storeMap.set(s, {
          storeName: s,
          ticketCount: 0,
          totalItems: 0,
          branding: getStoreBranding(s),
          wonAisles: []
        });
      }
      const grp = storeMap.get(s)!;
      grp.ticketCount += 1;
      grp.totalItems += r.items.length;
    });

    // 2. Affecter chaque rayon gagnant à son enseigne
    categoryRecommendations.forEach(rec => {
      const grp = storeMap.get(rec.recommendedStore);
      if (grp) {
        grp.wonAisles.push({
          aisle: rec.aisle,
          icon: rec.icon,
          badgeLabel: rec.badgeLabel,
          itemCount: rec.itemCount,
          style: rec.style
        });
      }
    });

    // 3. Trier par nombre de rayons remportés (décroissant), puis par nombre d'articles
    return Array.from(storeMap.values()).sort((a, b) => {
      if (b.wonAisles.length !== a.wonAisles.length) {
        return b.wonAisles.length - a.wonAisles.length;
      }
      return b.totalItems - a.totalItems;
    });
  }, [receipts, categoryRecommendations]);

  if (categoryRecommendations.length === 0) return null;

  return (
    <section className="space-y-4 animate-in fade-in duration-300">
      {/* EN-TÊTE DE SECTION AVEC SÉLECTEUR DE VUE (PAR ENSEIGNE vs PAR RAYON) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500/20 via-primary/20 to-emerald-500/20 text-primary flex items-center justify-center shrink-0 shadow-xs border border-primary/20">
            <Store size={18} className="text-primary dark:text-cyan-400" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-foreground tracking-tight flex items-center gap-2">
              <span>Où acheter quoi ?</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/70 font-mono">
                {viewMode === 'store' 
                  ? `${storeRecommendations.length} enseigne${storeRecommendations.length > 1 ? 's' : ''}`
                  : `${categoryRecommendations.length} rayon${categoryRecommendations.length > 1 ? 's' : ''}`
                }
              </span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {viewMode === 'store'
                ? "Vos magasins analysés et les rayons où ils sont les plus économiques."
                : "L'enseigne la plus économique pour chaque catégorie, calculée d'après vos tickets réels."
              }
            </p>
          </div>
        </div>

        {/* BOUTONS TOGGLE VUE PAR ENSEIGNE (4 MAGASINS SANS DOUBLON) VS VUE PAR RAYON */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary/80 dark:bg-card/90 border border-border/80 self-start sm:self-auto shadow-xs">
          <button
            type="button"
            onClick={() => setViewMode('store')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
              viewMode === 'store'
                ? "bg-card dark:bg-primary/20 text-foreground dark:text-primary shadow-xs border border-border/60 dark:border-primary/30"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Afficher une seule carte par enseigne avec tous ses rayons champions"
          >
            <Store size={13} className={viewMode === 'store' ? "text-primary" : ""} />
            <span>Par Enseigne ({storeRecommendations.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('aisle')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
              viewMode === 'aisle'
                ? "bg-card dark:bg-primary/20 text-foreground dark:text-primary shadow-xs border border-border/60 dark:border-primary/30"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Afficher chaque rayon avec son enseigne recommandée"
          >
            <Layers size={13} className={viewMode === 'aisle' ? "text-primary" : ""} />
            <span>Par Rayon ({categoryRecommendations.length})</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. VUE PAR ENSEIGNE (PAR DÉFAUT : EXACTEMENT 1 CARTE PAR MAGASIN UNIQUE)  */}
      {/* ========================================================================= */}
      {viewMode === 'store' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
          {storeRecommendations.map((grp) => {
            return (
              <div
                key={grp.storeName}
                className={cn(
                  "p-4 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all duration-200 flex flex-col justify-between",
                  "bg-card/90 dark:bg-card/60 backdrop-blur-md border-border/80 dark:border-white/[0.08]",
                  "hover:shadow-lg relative overflow-hidden group select-none",
                  grp.branding.borderHover
                )}
              >
                {/* DÉGRADÉ DE FOND DISCRET */}
                <div 
                  className={cn(
                    "absolute -top-12 -right-12 w-40 h-40 rounded-full blur-2xl pointer-events-none opacity-40 bg-gradient-to-br",
                    grp.branding.gradient
                  )} 
                />

                <div className="space-y-3.5 relative z-10">
                  {/* EN-TÊTE DU MAGASIN : NOM UNIQUE EN GRAND ET STATISTIQUES */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs", grp.branding.iconBg, grp.branding.iconColor)}>
                        <Store size={22} />
                      </div>
                      <div>
                        <h4 className="text-base sm:text-lg font-black text-foreground tracking-tight">
                          {grp.storeName}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium mt-0.5">
                          <span>{grp.ticketCount} ticket{grp.ticketCount > 1 ? 's' : ''}</span>
                          <span>•</span>
                          <span>{grp.totalItems} articles analysés</span>
                        </div>
                      </div>
                    </div>

                    <div className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold border shrink-0 flex items-center gap-1", grp.branding.badgeBg)}>
                      <Award size={12} className="shrink-0" />
                      <span>{grp.wonAisles.length} rayon{grp.wonAisles.length > 1 ? 's' : ''} n°1</span>
                    </div>
                  </div>

                  {/* LISTE DES RAYONS RECOMMANDÉS POUR CE MAGASIN */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 block">
                      À acheter en priorité chez {grp.storeName.split(' ')[0]} :
                    </span>

                    {grp.wonAisles.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {grp.wonAisles.map((w) => {
                          const Icon = w.icon;
                          return (
                            <div
                              key={w.aisle}
                              onClick={() => onSelectAisle?.(w.aisle)}
                              className={cn(
                                "p-2.5 rounded-xl border border-border/70 bg-secondary/40 dark:bg-white/[0.03]",
                                "hover:bg-primary/5 hover:border-primary/40 hover:translate-x-0.5 cursor-pointer transition-all",
                                "flex items-center justify-between gap-2 group/item"
                              )}
                              title={`Filtrer le rayon ${w.aisle} dans le comparateur`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-xs", w.style.iconBg, w.style.iconColor)}>
                                  <Icon size={14} />
                                </div>
                                <div className="min-w-0">
                                  <span className="text-xs font-bold text-foreground block truncate">
                                    {w.aisle}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground block truncate">
                                    {w.badgeLabel}
                                  </span>
                                </div>
                              </div>
                              <ChevronRight size={14} className="text-muted-foreground group-hover/item:text-primary group-hover/item:translate-x-0.5 transition-all shrink-0" />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic py-1">
                        Magasin analysé, aucun rayon n°1 sur l'ensemble du panier.
                      </p>
                    )}
                  </div>
                </div>

                {/* BAS DE CARTE AVEC LIEN DIRECT VERS LE COMPARATEUR */}
                {grp.wonAisles.length > 0 && (
                  <div className="mt-3.5 pt-3 border-t border-border/60 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className={cn("w-1.5 h-1.5 rounded-full", grp.branding.accentDot)} />
                      <span>{grp.wonAisles.length} recommandation{grp.wonAisles.length > 1 ? 's' : ''} auditée{grp.wonAisles.length > 1 ? 's' : ''}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectAisle?.(grp.wonAisles[0].aisle)}
                      className="text-primary hover:underline flex items-center gap-1 text-[11px] font-bold"
                    >
                      <span>Explorer les prix</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. VUE PAR RAYON (13 CARTES AVEC TITRE DE RAYON UNIQUE EN GRAND)          */}
      {/* ========================================================================= */}
      {viewMode === 'aisle' && (
        <div className="flex sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 overflow-x-auto no-scrollbar pb-2 sm:pb-0 overscroll-contain">
          {categoryRecommendations.map((rec) => {
            const Icon = rec.icon;

            return (
              <div
                key={rec.aisle}
                onClick={() => onSelectAisle?.(rec.aisle)}
                className={cn(
                  "min-w-[190px] sm:min-w-0 flex-1 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all duration-200",
                  "bg-card/90 dark:bg-card/60 backdrop-blur-md border-border/80 dark:border-white/[0.08]",
                  "hover:border-primary/50 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer group flex flex-col items-center justify-between text-center select-none"
                )}
                title={`Voir les articles de ${rec.aisle}`}
              >
                {/* PASTILLE RONDE AVEC ICÔNE DU RAYON */}
                <div 
                  className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center mb-3 shadow-xs transition-transform group-hover:scale-110 duration-200",
                    rec.style.iconBg,
                    rec.style.iconColor
                  )}
                >
                  <Icon size={22} />
                </div>

                {/* NOM DU RAYON EN TITRE PRINCIPAL (ÉVITE TOUTE DUPLICATION VISUELLE D'ENSEIGNE) */}
                <div className="w-full space-y-1.5 mb-2.5">
                  <h4 className="text-sm sm:text-base font-black text-foreground group-hover:text-primary transition-colors tracking-tight truncate" title={rec.aisle}>
                    {rec.aisle}
                  </h4>

                  {/* ENSEIGNE RECOMMANDÉE CLAIREMENT IDENTIFIÉE COMME DESTINATION */}
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-secondary/80 dark:bg-white/[0.04] border border-border/80 max-w-full">
                    <Store size={12} className="text-primary shrink-0" />
                    <span className="text-[11px] font-extrabold text-foreground truncate" title={rec.recommendedStore}>
                      {rec.recommendedStore}
                    </span>
                  </div>
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
      )}
    </section>
  );
};
