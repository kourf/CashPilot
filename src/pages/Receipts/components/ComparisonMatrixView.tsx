import React, { useState, useMemo, useEffect } from 'react';
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
  MoreHorizontal,
  Eye,
  RefreshCw,
  ShoppingBag,
  TrendingDown, 
  TrendingUp,
  Receipt as ReceiptIcon,
  Calendar,
  Tag,
  FileText,
  Layers,
  ArrowRight,
  BookOpen,
  HeartPulse,
  Flower2
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { 
  type ComparativeMatrix, 
  type SupermarketAisle, 
  type Receipt,
  type ProductComparisonRow,
  SUPERMARKET_AISLES 
} from '../../../types/receipts';
import { AISLE_CONFIGS } from '../../../lib/receiptClassifier';
import { formatCurrency, formatDateFR } from '../../../lib/bankUtils';
import { cn } from '../../../lib/utils';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { PriceEvolutionModal } from './PriceEvolutionModal';

interface ComparisonMatrixViewProps {
  matrix: ComparativeMatrix;
  receipts?: Receipt[];
  hiddenProductNames: string[];
  onHideProduct: (normalizedName: string) => Promise<void>;
  onRestoreProduct: (normalizedName: string) => Promise<void>;
  onOpenUpload: () => void;
  selectedAisleFocus?: string | null;
}

const AISLE_ICONS: Record<SupermarketAisle, React.ComponentType<{ size?: number; className?: string }>> = {
  'Boucherie, Volaille & Poissonnerie': Utensils,
  'Épicerie salée & Épices': Package,
  'Fruits & Légumes': Carrot,
  'Produits frais & Crèmerie': Milk,
  'Épicerie sucrée': Cookie,
  'Hygiène, Beauté & Sanitaire': Sparkles,
  'Entretien & Maison': Home,
  'Boissons': CupSoda,
  'Maison, Textile & Culture': BookOpen,
  'Santé & Pharmacie': HeartPulse,
  'Papeterie & Bureau': FileText,
  'Fleurs & Cadeaux': Flower2,
  'Sacs & Consignes': ShoppingBag,
  'Autres / Divers': MoreHorizontal
};

export const ComparisonMatrixView: React.FC<ComparisonMatrixViewProps> = ({
  matrix,
  receipts = [],
  hiddenProductNames,
  onHideProduct,
  onRestoreProduct,
  onOpenUpload,
  selectedAisleFocus
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAisleFilter, setSelectedAisleFilter] = useState<string>(() => selectedAisleFocus || 'ALL');
  const [onlyComparable, setOnlyComparable] = useState(false);

  useEffect(() => {
    if (selectedAisleFocus) {
      setSelectedAisleFilter(selectedAisleFocus);
      setOpenAccordions(prev => ({
        ...prev,
        [selectedAisleFocus]: true
      }));
    }
  }, [selectedAisleFocus]);
  
  // Mode d'affichage : 'aisles' (vue matricielle par rayons) ou 'ticket' (vue ticket de caisse immersive)
  const [viewMode, setViewMode] = useState<'aisles' | 'ticket'>('aisles');
  const [selectedReceiptId, setSelectedReceiptId] = useState<string>(() => receipts[0]?.id || '');

  // Accordéons ouverts par défaut
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    SUPERMARKET_AISLES.forEach(a => { init[a] = true; });
    return init;
  });

  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showHiddenModal, setShowHiddenModal] = useState(false);
  const [selectedProductForEvolution, setSelectedProductForEvolution] = useState<ProductComparisonRow | null>(null);

  // RÈGLE STRICTE D'AUDIT : Moins de 2 tickets ou moins de 2 enseignes -> Comparaison strictement désactivée
  const isSingleReceipt = matrix.isSingleReceipt || matrix.receiptsCount < 2 || matrix.stores.length < 2;
  const isSingleStore = matrix.stores.length === 1;
  const activeReceipt = receipts.find(r => r.id === selectedReceiptId) || receipts[0] || null;
  const coveredAislesCount = matrix.aisleGroups.filter(g => g.products.length > 0).length;

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
          const matchBrand = p.sampleBrands.some(b => b.toLowerCase().includes(s));
          if (!matchNorm && !matchRaw && !matchBrand) return false;
        }

        // Filtre uniquement comparables (actif seulement si multi-enseignes)
        if (onlyComparable && !matrix.isSingleReceipt && p.status !== 'COMPARABLE') {
          return false;
        }

        return true;
      });

      return {
        ...group,
        products: prods
      };
    }).filter(group => selectedAisleFilter === 'ALL' || group.aisle === selectedAisleFilter);
  }, [matrix.aisleGroups, selectedAisleFilter, searchTerm, onlyComparable, matrix.isSingleReceipt]);

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
    <div className="space-y-4 sm:space-y-6">
      
      {/* SYNTHÈSE AUDIT DYNAMIQUE : ADAPTÉE TICKET UNIQUE VS MULTI-ENSEIGNES */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        {/* CARTE 1 : ENSEIGNE(S) */}
        <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl glass-card border border-border/70 flex flex-col justify-between">
          <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
            <Store size={13} className="text-primary" />
            {isSingleReceipt ? 'Enseigne Relevée' : 'Enseignes Réelles'}
          </span>
          <div className="mt-1.5 sm:mt-2">
            <span className="text-lg sm:text-2xl font-extrabold text-foreground font-mono truncate block">
              {isSingleReceipt ? (matrix.stores[0] || '1 enseigne') : matrix.stores.length}
            </span>
            <span className="text-[9px] sm:text-[10px] text-muted-foreground block truncate mt-0.5" title={matrix.stores.join(', ')}>
              {isSingleReceipt 
                ? (activeReceipt?.date ? `Ticket du ${formatDateFR(activeReceipt.date)}` : '1er ticket enregistré') 
                : matrix.stores.join(' • ')}
            </span>
          </div>
        </div>

        {/* CARTE 2 : NOMBRE DE PRODUITS */}
        <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl glass-card border border-border/70 flex flex-col justify-between">
          <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
            <ShoppingBag size={13} className="text-cyan-500" />
            {isSingleReceipt ? 'Articles Achetés' : 'Références Produits'}
          </span>
          <div className="mt-1.5 sm:mt-2">
            <span className="text-lg sm:text-2xl font-extrabold text-foreground font-mono">
              {matrix.totalUniqueProducts}
            </span>
            <span className="text-[9px] sm:text-[10px] text-muted-foreground block mt-0.5">
              {isSingleReceipt ? `Sur ${coveredAislesCount} rayon${coveredAislesCount > 1 ? 's' : ''}` : 'Normalisées & auditées'}
            </span>
          </div>
        </div>

        {/* CARTE 3 : TOTAL TICKET OU PRODUITS COMPARABLES */}
        {isSingleReceipt ? (
          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl glass-card border border-border/70 flex flex-col justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
              <ReceiptIcon size={13} className="text-emerald-500" />
              Total Ticket Payé
            </span>
            <div className="mt-1.5 sm:mt-2">
              <span className="text-lg sm:text-2xl font-extrabold text-emerald-500 font-mono">
                {formatCurrency(activeReceipt?.totalAmount || 0, { showSign: false })}
              </span>
              <span className="text-[9px] sm:text-[10px] text-muted-foreground block mt-0.5">
                Montant net en caisse
              </span>
            </div>
          </div>
        ) : (
          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl glass-card border border-border/70 flex flex-col justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
              <Sparkles size={13} className="text-emerald-500" />
              Produits Comparables
            </span>
            <div className="mt-1.5 sm:mt-2">
              <span className="text-lg sm:text-2xl font-extrabold text-emerald-500 font-mono">
                {matrix.totalComparableProducts}
              </span>
              <span className="text-[9px] sm:text-[10px] text-muted-foreground block mt-0.5">
                Présents dans ≥ 2 enseignes
              </span>
            </div>
          </div>
        )}

        {/* CARTE 4 : RAYONS COUVERTS OU GAIN CONSTATÉ */}
        {isSingleReceipt ? (
          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl glass-card border border-border/70 flex flex-col justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
              <Layers size={13} className="text-teal-500" />
              Rayons Supermarché
            </span>
            <div className="mt-1.5 sm:mt-2">
              <span className="text-lg sm:text-2xl font-extrabold text-teal-500 font-mono">
                {coveredAislesCount} / {SUPERMARKET_AISLES.length}
              </span>
              <span className="text-[9px] sm:text-[10px] text-muted-foreground block mt-0.5">
                Rayons représentés
              </span>
            </div>
          </div>
        ) : (
          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl glass-card border border-border/70 flex flex-col justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
              <TrendingDown size={13} className="text-green-500" />
              Écart Global Détecté
            </span>
            <div className="mt-1.5 sm:mt-2">
              <span className="text-lg sm:text-2xl font-extrabold text-green-500 font-mono">
                {formatCurrency(matrix.totalPotentialSavings, { showSign: false })}
              </span>
              <span className="text-[9px] sm:text-[10px] text-muted-foreground block mt-0.5">
                {matrix.bestStoreGlobal ? `🏆 ${matrix.bestStoreGlobal.storeName} (-cher à ${matrix.bestStoreGlobal.percentage}%)` : 'Sur vos paniers réels'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* BANDEAU RÈGLE STRICTE D'AUDIT : TICKET UNIQUE ET INVITATION COMPARATIF */}
      {isSingleReceipt && (
        <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-amber-500/10 via-primary/5 to-cyan-500/10 border border-amber-500/30 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Info size={18} />
            </div>
            <div>
              <p className="font-extrabold text-foreground text-xs sm:text-sm flex items-center gap-2">
                <span>1 seul ticket enregistré — importez un 2ᵉ ticket pour activer le comparatif</span>
              </p>
              <p className="text-muted-foreground text-[10px] sm:text-[11px] mt-0.5 leading-relaxed">
                Tous les articles achetés de votre ticket « {matrix.stores[0] || 'Supermarché'} » sont détaillés ci-dessous par rayon avec leurs prix réels au kilo/litre. Dès le 2ᵉ ticket d'une autre enseigne, le calcul comparatif et les badges « Moins cher » s'activeront automatiquement !
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <Button 
              size="sm" 
              onClick={onOpenUpload}
              className="h-8 text-xs font-bold gap-1.5 shadow-sm"
            >
              <Sparkles size={13} className="text-cyan-400" />
              <span>+ Scanner un 2ᵉ ticket</span>
            </Button>
          </div>
        </div>
      )}

      {/* SÉLECTEUR DE MODE D'AFFICHAGE & SÉLECTION DE TICKET */}
      {receipts.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 rounded-xl sm:rounded-2xl bg-secondary/40 border border-border/70 w-full sm:w-fit overflow-x-auto no-scrollbar">
            <button
              onClick={() => setViewMode('aisles')}
              className={cn(
                "px-3 py-1.5 rounded-lg sm:rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap flex-1 sm:flex-none",
                viewMode === 'aisles'
                  ? "bg-card text-foreground shadow-xs border border-border/70"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/40"
              )}
            >
              <Package size={13} className={viewMode === 'aisles' ? "text-primary" : ""} />
              <span>Vue par Rayons ({coveredAislesCount})</span>
            </button>

            <button
              onClick={() => setViewMode('ticket')}
              className={cn(
                "px-3 py-1.5 rounded-lg sm:rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap flex-1 sm:flex-none",
                viewMode === 'ticket'
                  ? "bg-card text-foreground shadow-xs border border-border/70"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/40"
              )}
            >
              <ReceiptIcon size={13} className={viewMode === 'ticket' ? "text-primary" : ""} />
              <span>Vue Ticket Stylisée</span>
            </button>
          </div>

          {/* SÉLECTEUR DE TICKET SPÉCIFIQUE EN VUE TICKET */}
          {viewMode === 'ticket' && receipts.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-muted-foreground">Ticket affiché :</span>
              <select
                value={selectedReceiptId}
                onChange={(e) => setSelectedReceiptId(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-xl border border-border bg-card text-foreground font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {receipts.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.storeName} ({formatDateFR(r.date)}) - {formatCurrency(r.totalAmount, { showSign: false })}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* VUE SPÉCIALE : TICKET DE CAISSE STYLISÉ (VISUEL IMMERSIF RÉCLAMÉ PAR L'UTILISATEUR) */}
      {viewMode === 'ticket' && activeReceipt ? (
        <div className="max-w-xl mx-auto rounded-2xl sm:rounded-3xl bg-card border-2 border-dashed border-border/90 p-3.5 sm:p-7 shadow-xl space-y-4 sm:space-y-5 font-mono text-xs relative overflow-hidden">
          {/* BANDE DÉCORATIVE HAUT DU TICKET */}
          <div className="text-center space-y-1.5 border-b border-dashed border-border/90 pb-4">
            <div className="inline-block px-3 py-1 rounded-full bg-secondary text-primary font-bold text-[10px] uppercase tracking-wider mb-1">
              Reçu de Caisse Officiel
            </div>
            <h2 className="text-xl font-black tracking-widest uppercase text-foreground">
              {activeReceipt.storeName}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Date : {formatDateFR(activeReceipt.date)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {activeReceipt.items.length} article{activeReceipt.items.length > 1 ? 's' : ''} • Audit Financier CashPilot
            </p>
          </div>

          {/* TABLEAU DES ARTICLES DU TICKET */}
          <div className="divide-y divide-border/40 text-xs">
            {activeReceipt.items.map((item, idx) => {
              const aisleMeta = AISLE_CONFIGS[item.category as SupermarketAisle] || AISLE_CONFIGS['Autres / Divers'];
              const lineTotal = item.pricePaid ?? item.price ?? 0;
              const unitPriceVal = item.unitPrice || item.referenceUnitPrice || (item.quantity > 1 ? lineTotal / item.quantity : lineTotal);

              return (
                <div key={item.id || idx} className="py-2.5 flex items-start justify-between gap-3">
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-foreground truncate max-w-[220px]">
                        {item.quantity > 1 ? `${item.quantity}x ` : ''}{item.normalizedName}
                      </span>
                      {item.brand && item.brand !== 'Générique' && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-secondary text-primary font-medium">
                          {item.brand}
                        </span>
                      )}
                    </div>
                    {item.rawName && item.rawName !== item.normalizedName && (
                      <p className="text-[10px] text-muted-foreground truncate">
                        Ticket : {item.rawName}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-0.5 flex-wrap">
                      <span className={cn("px-1.5 py-0.2 rounded text-[9px] font-semibold border", aisleMeta?.badgeClass)}>
                        {item.category}
                      </span>
                      {item.weightOrVolume && (
                        <span>Format : {item.weightOrVolume}</span>
                      )}
                      {unitPriceVal > 0 && (
                        <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                          {formatCurrency(unitPriceVal, { showSign: false })}/{item.unit || 'pièce'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-bold text-foreground text-sm font-mono">
                      {formatCurrency(lineTotal, { showSign: false })}
                    </span>
                    {item.quantity > 1 && (
                      <span className="block text-[10px] text-muted-foreground">
                        ({formatCurrency(lineTotal / item.quantity, { showSign: false })}/u)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* TOTAL DU TICKET */}
          <div className="border-t-2 border-dashed border-border/90 pt-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Nombre d'articles :</span>
              <span className="font-bold text-foreground">{activeReceipt.items.length}</span>
            </div>
            <div className="flex items-center justify-between text-base font-black text-foreground pt-1">
              <span>TOTAL PAYÉ :</span>
              <span className="text-xl font-mono text-emerald-500">
                {formatCurrency(activeReceipt.totalAmount, { showSign: false })}
              </span>
            </div>
          </div>

          {/* CODE BARRE FICTIF DÉCORATIF DE REÇU */}
          <div className="text-center pt-3 border-t border-dashed border-border/70 space-y-1">
            <div className="h-8 mx-auto w-48 bg-foreground/10 dark:bg-foreground/20 rounded flex items-center justify-around px-2">
              <span className="w-0.5 h-6 bg-foreground/60" />
              <span className="w-1 h-6 bg-foreground/60" />
              <span className="w-0.5 h-6 bg-foreground/60" />
              <span className="w-2 h-6 bg-foreground/60" />
              <span className="w-0.5 h-6 bg-foreground/60" />
              <span className="w-1.5 h-6 bg-foreground/60" />
              <span className="w-0.5 h-6 bg-foreground/60" />
            </div>
            <p className="text-[9px] text-muted-foreground uppercase">
              Réf : {activeReceipt.id}
            </p>
          </div>
        </div>
      ) : (
        /* VUE MATRICIELLE PAR RAYONS DE SUPERMARCHÉ (VUE PAR DÉFAUT) */
        <>
          {/* BARRE DE RECHERCHE ET FILTRES */}
          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl glass-card border border-border/70 space-y-2.5 sm:space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
              {/* CHAMP DE RECHERCHE */}
              <div className="relative flex-1 max-w-md">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Rechercher un produit (ex: Lait, Steak, Pâtes, Lessive)..."
                  className="w-full pl-9 pr-8 py-1.5 sm:py-2 text-xs rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
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

              {/* FILTRES COMPLÉMENTAIRES */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                {/* TOGGLE UNIQUEMENT COMPARABLES (ACTIF UNIQUEMENT QUAND AU MOINS 2 ENSEIGNES EXISTENT) */}
                {!matrix.isSingleReceipt && matrix.totalComparableProducts > 0 && (
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
                )}

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
                  "px-2.5 sm:px-3 py-1 rounded-lg sm:rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all border shrink-0",
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
                      "px-2.5 sm:px-3 py-1 rounded-lg sm:rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all border flex items-center gap-1.5 shrink-0",
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
                Modifiez votre terme de recherche ou sélectionnez un autre rayon.
              </p>
            </div>
          ) : (
            /* ACCORDÉONS DES 8 RAYONS DE GRANDE SURFACE */
            <div className="space-y-3 sm:space-y-4">
              {filteredAisleGroups.map((group) => {
                if (group.products.length === 0) return null;

                const aisleMeta = AISLE_CONFIGS[group.aisle];
                const AisleIcon = AISLE_ICONS[group.aisle];
                const isOpen = openAccordions[group.aisle] ?? true;

                return (
                  <div 
                    key={group.aisle}
                    className={cn(
                      "rounded-xl sm:rounded-2xl border border-border/80 dark:border-white/[0.08] bg-card overflow-hidden shadow-sm transition-all duration-200",
                      aisleMeta.accentBorder,
                      "border-l-4"
                    )}
                  >
                    {/* EN-TÊTE DE L'ACCORDÉON DE RAYON */}
                    <button
                      type="button"
                      onClick={() => toggleAccordion(group.aisle)}
                      className="w-full p-3 sm:p-4 flex items-center justify-between bg-muted/20 hover:bg-muted/30 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className={cn("p-1.5 sm:p-2 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0", aisleMeta.badgeClass)}>
                          <AisleIcon size={15} />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            <h3 className="font-extrabold text-xs sm:text-base text-foreground tracking-tight">
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
                      <div className="overflow-x-auto border-t border-border/70 overscroll-x-contain">
                        <table className="w-full text-left border-collapse min-w-[620px] sm:min-w-[700px] text-xs">
                          <thead>
                            <tr className="border-b border-border/70 bg-secondary/30 dark:bg-white/[0.02] text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                              {/* COLONNE FIXE : PRODUIT */}
                              <th className="py-2.5 sm:py-3 px-3 sm:px-4 w-[28%] font-semibold min-w-[130px] sm:min-w-[180px]">
                                Produit ({group.products.length})
                              </th>

                              {/* COLONNES DYNAMIQUES : LES MAGASINS AUDITÉS */}
                              {matrix.stores.map(store => (
                                <th 
                                  key={store} 
                                  className="py-2.5 sm:py-3 px-2 sm:px-3 text-center font-bold text-foreground font-mono min-w-[95px] sm:min-w-[120px]"
                                >
                                  <div className="flex items-center justify-center gap-1">
                                    <Store size={12} className="text-primary" />
                                    <span>{store}</span>
                                  </div>
                                </th>
                              ))}

                              {/* COLONNE STATUT & DÉTAILS */}
                              <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-right w-[24%] font-semibold min-w-[110px] sm:min-w-[140px]">
                                {isSingleReceipt ? 'Détail Achat' : 'Statut & Écart Audit'}
                              </th>

                              {/* COLONNE ACTION (SUPPRESSION PRODUIT MATRICE) */}
                              <th className="py-2.5 sm:py-3 px-2 sm:px-3 text-center w-[5%] font-semibold">
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
                                  <td className="py-2.5 sm:py-3 px-3 sm:px-4 sticky left-0 bg-card/95 backdrop-blur-xs z-10 border-r border-border/40 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] max-w-[140px] sm:max-w-[240px]">
                                    <div className="flex flex-col">
                                      <span className="font-bold text-foreground text-xs sm:text-sm tracking-tight leading-snug line-clamp-2">
                                        {product.normalizedName}
                                      </span>
                                      {product.sampleBrands.length > 0 && product.sampleBrands[0] !== 'Générique' && (
                                        <span className="text-[9px] sm:text-[10px] text-primary/80 font-medium mt-0.5 truncate">
                                          Marque : {product.sampleBrands.join(', ')}
                                        </span>
                                      )}
                                      {product.sampleRawNames.length > 0 && product.sampleRawNames[0] !== product.normalizedName && (
                                        <span className="text-[9px] sm:text-[10px] text-muted-foreground font-mono truncate mt-0.5">
                                          Ticket : {product.sampleRawNames[0]}
                                        </span>
                                      )}
                                      {/* BADGE ÉVOLUTION PRIX AUDITÉ (RÈGLE 5) */}
                                      {product.priceEvolution && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedProductForEvolution(product);
                                          }}
                                          className={cn(
                                            "text-left inline-flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md mt-1.5 border transition-all hover:scale-[1.02] cursor-pointer shadow-xs",
                                            (product.priceEvolution.status === 'HIKE' || product.priceEvolution.status === 'UP') && "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30 hover:bg-red-500/25",
                                            (product.priceEvolution.status === 'DROP' || product.priceEvolution.status === 'DOWN') && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25",
                                            product.priceEvolution.status === 'STABLE' && "bg-secondary text-muted-foreground border-border/80 hover:bg-secondary/80"
                                          )}
                                          title="Cliquer pour afficher la courbe d'évolution et l'historique de ce produit"
                                        >
                                          <TrendingUp size={11} className={cn(
                                            (product.priceEvolution.status === 'DROP' || product.priceEvolution.status === 'DOWN') && "rotate-180 text-emerald-500",
                                            (product.priceEvolution.status === 'HIKE' || product.priceEvolution.status === 'UP') && "text-red-500"
                                          )} />
                                          <span className="line-clamp-1">{product.priceEvolution.message}</span>
                                        </button>
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

                                    const unitPrice = priceInfo.unitPrice || priceInfo.pricePaid;
                                    // RÈGLE STRICTE D'AUDIT : Badge "Moins cher" UNIQUEMENT si >= 2 tickets ET produit comparable
                                    const isCheapestInRow = !isSingleReceipt && isComparable && unitPrice === product.lowestUnitPrice;

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
                                              {formatCurrency(priceInfo.pricePaid, { showSign: false })}
                                              {priceInfo.weightOrVolume ? ` (${priceInfo.weightOrVolume})` : ''}
                                            </span>
                                          )}

                                          {/* MARQUE CONSTATÉE SUR CE MAGASIN */}
                                          {priceInfo.brand && priceInfo.brand !== 'Générique' && (
                                            <span className="text-[9px] text-muted-foreground/80 font-medium truncate max-w-[100px] mt-0.5">
                                              {priceInfo.brand}
                                            </span>
                                          )}

                                          {/* BADGE "MOINS CHER" OU DATE D'ACHAT */}
                                          {isCheapestInRow ? (
                                            <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 mt-1 border border-emerald-500/30">
                                              <Check size={9} className="stroke-[3]" />
                                              Moins cher
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

                                  {/* 3. STATUT ET DÉTAILS D'ACHAT */}
                                  <td className="py-3 px-4 text-right">
                                    {isSingleReceipt ? (
                                      <div className="flex flex-col items-end">
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20">
                                          <Tag size={10} />
                                          {product.storePrices[matrix.stores[0]]?.quantity && product.storePrices[matrix.stores[0]].quantity > 1 
                                            ? `x${product.storePrices[matrix.stores[0]].quantity}` 
                                            : '1 unité'}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                          Payé : {formatCurrency(product.storePrices[matrix.stores[0]]?.pricePaid || 0, { showSign: false })}
                                        </span>
                                      </div>
                                    ) : isComparable ? (
                                      <div className="flex flex-col items-end">
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                          Comparable ({product.storeCount} magasins)
                                        </span>

                                        {product.unitPriceDifference && product.unitPriceDifference > 0 ? (
                                          <div className="text-right mt-1">
                                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 font-mono block">
                                              {formatCurrency(product.lowestUnitPrice || 0, { showSign: false })}/{product.unit || 'u'} vs {formatCurrency(product.highestUnitPrice || 0, { showSign: false })}/{product.unit || 'u'}
                                            </span>
                                            <span className="text-[10px] font-bold text-green-500 font-mono block">
                                              Économie : {product.unitPriceDifferencePercent}% (+{formatCurrency(product.unitPriceDifference, { showSign: false })}/{product.unit || 'u'})
                                            </span>
                                          </div>
                                        ) : (
                                          <span className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                            Prix identique
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="flex flex-col items-end">
                                        <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/60">
                                          Unique ({Object.keys(product.storePrices)[0] || '1 enseigne'})
                                        </span>
                                        <span className="text-[10px] text-muted-foreground mt-0.5">
                                          Non comparable
                                        </span>
                                      </div>
                                    )}
                                  </td>

                                  {/* 4. ACTION SUPPRESSION PRODUIT MATRICE */}
                                  <td className="py-3 px-3 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => setSelectedProductForEvolution(product)}
                                        className="p-1.5 rounded-lg text-muted-foreground hover:text-cyan-500 hover:bg-cyan-500/10 transition-colors"
                                        title="Voir la courbe d'évolution et l'historique du prix"
                                      >
                                        <TrendingUp size={13} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setProductToDelete(product.normalizedName)}
                                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                        title="Supprimer ce produit de la matrice comparative"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
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
        </>
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

      {/* MODALE D'ÉVOLUTION DU PRIX AVEC COURBE RECHARTS (RÈGLE 5) */}
      {selectedProductForEvolution && (
        <PriceEvolutionModal
          product={selectedProductForEvolution}
          isOpen={Boolean(selectedProductForEvolution)}
          onClose={() => setSelectedProductForEvolution(null)}
        />
      )}

    </div>
  );
};
