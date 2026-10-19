import React, { useState, useMemo } from 'react';
import { 
  Store, 
  Search, 
  Trash2, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  Info,
  Utensils,
  Package,
  Carrot,
  Milk,
  Cookie,
  Home,
  CupSoda,
  Eye,
  RefreshCw,
  ShoppingBag,
  TrendingDown
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { 
  type ComparativeMatrix, 
  type SupermarketAisle, 
  SUPERMARKET_AISLES 
} from '../../../types/receipts';
import { AISLE_CONFIGS } from '../../../lib/receiptClassifier';
import { formatCurrency, formatDateFR } from '../../../lib/bankUtils';
import { cn } from '../../../lib/utils';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';

interface ComparisonMatrixViewProps {
  matrix: ComparativeMatrix;
  hiddenProductNames: string[];
  onHideProduct: (normalizedName: string) => Promise<void>;
  onRestoreProduct: (normalizedName: string) => Promise<void>;
  onOpenUpload: () => void;
}

const AISLE_ICONS: Record<SupermarketAisle, React.ComponentType<{ size?: number; className?: string }>> = {
  'Boucherie, Volaille & Poissonnerie': Utensils,
  'Épicerie salée & Épices': Package,
  'Fruits & Légumes': Carrot,
  'Produits frais & Crèmerie': Milk,
  'Épicerie sucrée': Cookie,
  'Hygiène, Beauté & Sanitaire': Sparkles,
  'Entretien & Maison': Home,
  'Boissons': CupSoda
};

export const ComparisonMatrixView: React.FC<ComparisonMatrixViewProps> = ({
  matrix,
  hiddenProductNames,
  onHideProduct,
  onRestoreProduct,
  onOpenUpload
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAisleFilter, setSelectedAisleFilter] = useState<string>('ALL');
  const [onlyComparable, setOnlyComparable] = useState(false);
  
  // Accordéons ouverts par défaut
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    SUPERMARKET_AISLES.forEach(a => { init[a] = true; });
    return init;
  });

  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showHiddenModal, setShowHiddenModal] = useState(false);

  const toggleAccordion = (aisle: SupermarketAisle) => {
    setOpenAccordions(prev => ({
      ...prev,
      [aisle]: !prev[aisle]
    }));
  };

  const handleConfirmDeleteProduct = async () => {
    if (!productToDelete) return;
    try {
      setIsDeleting(true);
      await onHideProduct(productToDelete);
      setProductToDelete(null);
    } catch (err) {
      console.error("Erreur suppression produit:", err);
      alert("Erreur lors de la suppression du produit de la matrice.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtrage réactif de la matrice en mémoire
  const filteredAisleGroups = useMemo(() => {
    return matrix.aisleGroups.map(group => {
      // Filtre par rayon si un rayon spécifique est choisi
      if (selectedAisleFilter !== 'ALL' && group.aisle !== selectedAisleFilter) {
        return { ...group, products: [] };
      }

      const prods = group.products.filter(p => {
        // Filtre par terme de recherche
        if (searchTerm.trim()) {
          const s = searchTerm.toLowerCase().trim();
          const matchNorm = p.normalizedName.toLowerCase().includes(s);
          const matchRaw = p.sampleRawNames.some(rn => rn.toLowerCase().includes(s));
          if (!matchNorm && !matchRaw) return false;
        }

        // Filtre uniquement comparables
        if (onlyComparable && p.status !== 'COMPARABLE') {
          return false;
        }

        return true;
      });

      return {
        ...group,
        products: prods
      };
    }).filter(group => selectedAisleFilter === 'ALL' || group.aisle === selectedAisleFilter);
  }, [matrix.aisleGroups, selectedAisleFilter, searchTerm, onlyComparable]);

  const totalFilteredProducts = filteredAisleGroups.reduce((acc, g) => acc + g.products.length, 0);

  // État vide si aucun ticket n'a encore été importé
  if (matrix.stores.length === 0) {
    return (
      <div className="p-8 sm:p-12 text-center rounded-2xl glass-card border border-border/80 space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
          <Store size={32} />
        </div>
        <div className="max-w-md mx-auto space-y-1.5">
          <h3 className="text-lg font-bold text-foreground">
            Aucun ticket de caisse enregistré
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Importez vos premiers tickets de caisse (photo, scan ou PDF) pour construire automatiquement votre matrice comparative multi-enseignes.
          </p>
        </div>
        <Button onClick={onOpenUpload} className="text-xs font-bold gap-2">
          <Sparkles size={14} className="text-cyan-400" />
          Importer mon premier ticket
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* SYNTHÈSE D'AUDIT COMPTABLE (EN-TÊTE DE LA MATRICE) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* CARTE 1 : MAGASINS AUDITÉS */}
        <div className="p-3.5 sm:p-4 rounded-2xl glass-card border border-border/70 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
            <Store size={13} className="text-primary" />
            Enseignes Réelles
          </span>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-extrabold text-foreground font-mono">
              {matrix.stores.length}
            </span>
            <span className="text-[10px] text-muted-foreground block truncate mt-0.5" title={matrix.stores.join(', ')}>
              {matrix.stores.join(' • ')}
            </span>
          </div>
        </div>

        {/* CARTE 2 : PRODUITS SUIVIS */}
        <div className="p-3.5 sm:p-4 rounded-2xl glass-card border border-border/70 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
            <ShoppingBag size={13} className="text-cyan-500" />
            Références Produits
          </span>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-extrabold text-foreground font-mono">
              {matrix.totalUniqueProducts}
            </span>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              Normalisées & auditées
            </span>
          </div>
        </div>

        {/* CARTE 3 : PRODUITS COMPARABLES (PRÉSENTS DANS AU MOINS 2 MAGASINS) */}
        <div className="p-3.5 sm:p-4 rounded-2xl glass-card border border-border/70 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
            <Sparkles size={13} className="text-emerald-500" />
            Produits Comparables
          </span>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-extrabold text-emerald-500 font-mono">
              {matrix.totalComparableProducts}
            </span>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              Présents dans ≥ 2 enseignes
            </span>
          </div>
        </div>

        {/* CARTE 4 : GAIN MAXIMAL CONSTATÉ */}
        <div className="p-3.5 sm:p-4 rounded-2xl glass-card border border-border/70 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
            <TrendingDown size={13} className="text-green-500" />
            Écart Global Détecté
          </span>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-extrabold text-green-500 font-mono">
              {formatCurrency(matrix.totalPotentialSavings, { showSign: false })}
            </span>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              {matrix.bestStoreGlobal ? `🏆 ${matrix.bestStoreGlobal.storeName} (-cher à ${matrix.bestStoreGlobal.percentage}%)` : 'Sur vos paniers réels'}
            </span>
          </div>
        </div>
      </div>

      {/* BANDEAU RÈGLE STRICTE DU TICKET UNIQUE */}
      {(matrix.isSingleReceipt || matrix.receiptsCount < 2 || matrix.stores.length < 2) && (
        <div className="p-3.5 px-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Info size={16} className="shrink-0 text-amber-500" />
            <span>
              <strong>1 seule enseigne enregistrée</strong> — importez un second ticket pour activer la comparaison et débloquer les badges <em>« Meilleur prix »</em>.
            </span>
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={onOpenUpload}
            className="h-7 text-[11px] shrink-0 border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 font-bold"
          >
            + Scanner un 2ème ticket
          </Button>
        </div>
      )}

      {/* BARRE DE RECHERCHE ET FILTRES */}
      <div className="p-4 rounded-2xl glass-card border border-border/70 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* CHAMP DE RECHERCHE */}
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher un produit (ex: Lait, Steak, Pâtes, Lessive)..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            )}
          </div>

          {/* TOGGLE UNIQUEMENT COMPARABLES */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setOnlyComparable(!onlyComparable)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5",
                onlyComparable
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold"
                  : "bg-secondary/60 hover:bg-secondary text-muted-foreground border-border/60"
              )}
            >
              <span className={cn("w-2 h-2 rounded-full", onlyComparable ? "bg-emerald-500" : "bg-muted-foreground/40")} />
              <span>Comparables uniquement ({matrix.totalComparableProducts})</span>
            </button>

            {/* RESTAURATION DES PRODUITS MASQUÉS */}
            {hiddenProductNames.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHiddenModal(true)}
                className="px-2.5 py-1.5 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors flex items-center gap-1"
                title="Gérer les produits masqués"
              >
                <Eye size={13} />
                <span>Masqués ({hiddenProductNames.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* PILLS DE FILTRE PAR RAYON */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 text-xs no-scrollbar">
          <button
            onClick={() => setSelectedAisleFilter('ALL')}
            className={cn(
              "px-3 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all border shrink-0",
              selectedAisleFilter === 'ALL'
                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                : "bg-secondary/50 hover:bg-secondary text-muted-foreground border-border/60"
            )}
          >
            Tous les rayons ({matrix.totalUniqueProducts})
          </button>

          {SUPERMARKET_AISLES.map(aisle => {
            const group = matrix.aisleGroups.find(g => g.aisle === aisle);
            const count = group ? group.totalProducts : 0;
            const Icon = AISLE_ICONS[aisle];

            return (
              <button
                key={aisle}
                onClick={() => setSelectedAisleFilter(aisle)}
                className={cn(
                  "px-3 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all border flex items-center gap-1.5 shrink-0",
                  selectedAisleFilter === aisle
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-secondary/50 hover:bg-secondary text-muted-foreground border-border/60"
                )}
              >
                <Icon size={12} />
                <span>{AISLE_CONFIGS[aisle].label}</span>
                <span className="opacity-70 font-mono">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* RÉSULTAT DU FILTRAGE */}
      {totalFilteredProducts === 0 ? (
        <div className="p-8 text-center rounded-2xl glass-card border border-border/70 space-y-2">
          <p className="text-sm font-semibold text-foreground">
            Aucun article ne correspond à votre filtre.
          </p>
          <p className="text-xs text-muted-foreground">
            Modifiez votre terme de recherche ou désactivez le filtre <em>« Comparables uniquement »</em>.
          </p>
        </div>
      ) : (
        /* ACCORDÉONS DES 8 RAYONS DE GRANDE SURFACE */
        <div className="space-y-4">
          {filteredAisleGroups.map((group) => {
            if (group.products.length === 0) return null;

            const aisleMeta = AISLE_CONFIGS[group.aisle];
            const AisleIcon = AISLE_ICONS[group.aisle];
            const isOpen = openAccordions[group.aisle] ?? true;

            return (
              <div 
                key={group.aisle}
                className={cn(
                  "rounded-2xl border border-border/80 dark:border-white/[0.08] bg-card overflow-hidden shadow-sm transition-all duration-200",
                  aisleMeta.accentBorder,
                  "border-l-4"
                )}
              >
                {/* EN-TÊTE DE L'ACCORDÉON DE RAYON */}
                <button
                  type="button"
                  onClick={() => toggleAccordion(group.aisle)}
                  className="w-full p-3.5 sm:p-4 flex items-center justify-between bg-muted/20 hover:bg-muted/30 transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <div className={cn("p-2 rounded-xl flex items-center justify-center shrink-0", aisleMeta.badgeClass)}>
                      <AisleIcon size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-extrabold text-sm sm:text-base text-foreground tracking-tight">
                          {aisleMeta.label}
                        </h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/60 font-mono">
                          {group.products.length} article{group.products.length > 1 ? 's' : ''}
                        </span>
                        {group.comparableCount > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
                            {group.comparableCount} comparable{group.comparableCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 hidden sm:block">
                        {aisleMeta.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-muted-foreground">
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {/* TABLEAU COMPARATIF : MAGASINS (COLONNES) VS PRODUITS (LIGNES) */}
                {isOpen && (
                  <div className="overflow-x-auto border-t border-border/70">
                    <table className="w-full text-left border-collapse min-w-[700px] text-xs">
                      <thead>
                        <tr className="border-b border-border/70 bg-secondary/30 dark:bg-white/[0.02] text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          {/* COLONNE FIXE : PRODUIT */}
                          <th className="py-3 px-4 w-[28%] font-semibold">
                            Produit ({group.products.length})
                          </th>

                          {/* COLONNES DYNAMIQUES : EXCLUSIVEMENT LES MAGASINS RÉELS AUDITÉS */}
                          {matrix.stores.map(store => (
                            <th 
                              key={store} 
                              className="py-3 px-3 text-center font-bold text-foreground font-mono"
                            >
                              <div className="flex items-center justify-center gap-1">
                                <Store size={12} className="text-primary" />
                                <span>{store}</span>
                              </div>
                            </th>
                          ))}

                          {/* COLONNE STATUT & ÉCART D'ARBITRAGE */}
                          <th className="py-3 px-4 text-right w-[18%] font-semibold">
                            Statut & Écart
                          </th>

                          {/* COLONNE ACTION (SUPPRESSION PRODUIT MATRICE) */}
                          <th className="py-3 px-3 text-center w-[6%] font-semibold">
                            Action
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-border/50 text-xs">
                        {group.products.map(product => {
                          const isComparable = product.status === 'COMPARABLE';

                          return (
                            <tr 
                              key={product.normalizedName}
                              className="hover:bg-secondary/20 dark:hover:bg-white/[0.02] transition-colors group"
                            >
                              {/* 1. PRODUIT (FIXE / STICKY EN SCROLL MOBILE) */}
                              <td className="py-3 px-4 sticky left-0 bg-card/95 backdrop-blur-xs z-10 border-r border-border/40 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                <div className="flex flex-col">
                                  <span className="font-bold text-foreground text-sm tracking-tight leading-snug">
                                    {product.normalizedName}
                                  </span>
                                  {product.sampleBrands.length > 0 && product.sampleBrands[0] !== 'Générique' && (
                                    <span className="text-[10px] text-primary/80 font-medium mt-0.5 truncate max-w-[200px]">
                                      Marque : {product.sampleBrands.join(', ')}
                                    </span>
                                  )}
                                  {product.sampleRawNames.length > 0 && product.sampleRawNames[0] !== product.normalizedName && (
                                    <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[200px] mt-0.5">
                                      Ticket : {product.sampleRawNames[0]}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* 2. COLONNES MAGASINS (PRIX RÉELS AUDITÉS AU KILO/LITRE) */}
                              {matrix.stores.map(store => {
                                const priceInfo = product.storePrices[store];
                                if (!priceInfo) {
                                  return (
                                    <td key={store} className="py-3 px-3 text-center text-muted-foreground/40 font-mono text-xs">
                                      —
                                    </td>
                                  );
                                }

                                const unitPrice = priceInfo.unitPrice || priceInfo.pricePaid || priceInfo.price;
                                const isCheapestInRow = isComparable && unitPrice === product.lowestUnitPrice;

                                return (
                                  <td 
                                    key={store} 
                                    className={cn(
                                      "py-3 px-3 text-center transition-colors",
                                      isCheapestInRow && "bg-emerald-500/[0.08] dark:bg-emerald-500/[0.12]"
                                    )}
                                  >
                                    <div className="flex flex-col items-center justify-center">
                                      {/* PRIX DE RÉFÉRENCE UNITAIRE STANDARDISÉ (€/KG OU €/L) */}
                                      <span className={cn(
                                        "font-bold font-mono text-sm flex items-baseline gap-0.5",
                                        isCheapestInRow 
                                          ? "text-emerald-600 dark:text-emerald-400 font-extrabold" 
                                          : "text-foreground"
                                      )}>
                                        <span>{formatCurrency(unitPrice, { showSign: false })}</span>
                                        <span className="text-[10px] font-normal text-muted-foreground">
                                          /{priceInfo.unit || product.unit || 'u'}
                                        </span>
                                      </span>

                                      {/* PRIX NET PAYÉ EN CAISSE & CONTENANCE */}
                                      {(priceInfo.weightOrVolume || (priceInfo.pricePaid && priceInfo.pricePaid !== unitPrice)) && (
                                        <span className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                          {formatCurrency(priceInfo.pricePaid || priceInfo.price, { showSign: false })}
                                          {priceInfo.weightOrVolume ? ` (${priceInfo.weightOrVolume})` : ''}
                                        </span>
                                      )}

                                      {/* MARQUE CONSTATÉE SUR CE MAGASIN */}
                                      {priceInfo.brand && priceInfo.brand !== 'Générique' && (
                                        <span className="text-[9px] text-muted-foreground/80 font-medium truncate max-w-[100px] mt-0.5">
                                          {priceInfo.brand}
                                        </span>
                                      )}

                                      {/* BADGE MEILLEUR PRIX (RÈGLE D'AUDIT SUR PRODUITS COMPARABLES) */}
                                      {isCheapestInRow ? (
                                        <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 mt-1 border border-emerald-500/30">
                                          <Check size={9} className="stroke-[3]" />
                                          Meilleur prix
                                        </span>
                                      ) : (
                                        <span className="text-[9px] text-muted-foreground font-mono mt-0.5">
                                          {formatDateFR(priceInfo.date)}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}

                              {/* 3. STATUT ET ÉCART EN € ET % */}
                              <td className="py-3 px-4 text-right">
                                {isComparable ? (
                                  <div className="flex flex-col items-end">
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                      Comparable ({product.storeCount} magasins)
                                    </span>

                                    {product.unitPriceDifference && product.unitPriceDifference > 0 ? (
                                      <span className="text-[11px] font-bold text-green-500 font-mono mt-1">
                                        Écart : +{formatCurrency(product.unitPriceDifference, { showSign: false })}/{product.unit || 'u'}
                                        {product.unitPriceDifferencePercent ? ` (+${product.unitPriceDifferencePercent}%)` : ''}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                        Prix identique
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-end">
                                    <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/60">
                                      Unique (non comparable)
                                    </span>
                                    <span className="text-[10px] text-muted-foreground mt-0.5">
                                      {Object.keys(product.storePrices).length === 1
                                        ? `Acheté à ${Object.keys(product.storePrices)[0]}`
                                        : `${Object.keys(product.storePrices).length} enseignes`}
                                    </span>
                                  </div>
                                )}
                              </td>

                              {/* 4. ACTION SUPPRESSION PRODUIT MATRICE */}
                              <td className="py-3 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => setProductToDelete(product.normalizedName)}
                                  className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                  title="Supprimer ce produit de la matrice comparative"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* BOÎTE DE DIALOGUE DE SUPPRESSION D'UN PRODUIT DE LA MATRICE */}
      <DeleteConfirmDialog
        isOpen={Boolean(productToDelete)}
        title="Supprimer ce produit du comparatif ?"
        description={`Le produit « ${productToDelete} » sera retiré de la matrice comparative multi-enseignes. Conformément aux règles d'audit, vos tickets bruts enregistrés dans l'historique restent parfaitement intacts.`}
        confirmLabel="Retirer de la matrice"
        isDeleting={isDeleting}
        onConfirm={handleConfirmDeleteProduct}
        onCancel={() => setProductToDelete(null)}
      />

      {/* MODALE DE GESTION DES PRODUITS MASQUÉS */}
      {showHiddenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">
                Produits masqués de la matrice ({hiddenProductNames.length})
              </h3>
              <button
                onClick={() => setShowHiddenModal(false)}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                Fermer
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 text-xs divide-y divide-border/60">
              {hiddenProductNames.map(name => (
                <div key={name} className="pt-2 flex items-center justify-between">
                  <span className="font-semibold text-foreground capitalize truncate max-w-[260px]">
                    {name}
                  </span>
                  <button
                    onClick={() => onRestoreProduct(name)}
                    className="text-[11px] text-primary hover:underline font-bold"
                  >
                    Restaurer
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
