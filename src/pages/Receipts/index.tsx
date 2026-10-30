import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Camera, 
  UploadCloud, 
  Sparkles, 
  Loader2, 
  Store, 
  FileText, 
  ImageIcon, 
  Layers, 
  Plus, 
  X, 
  History, 
  Smartphone, 
  Laptop, 
  Table, 
  FileSpreadsheet, 
  Info, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink,
  Eye,
  EyeOff,
  Check,
  Search,
  Trash2,
  TrendingUp,
  Tag,
  ChevronDown,
  ChevronUp,
  Package,
  Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/utils';
import { formatCurrency, formatDateFR } from '../../lib/bankUtils';
import { useReceipts } from '../../context/ReceiptsContext';
import { 
  type ReceiptItem, 
  type SupermarketAisle,
  type ProductComparisonRow,
  type StorePriceDetail,
  type StoreOfferDetail,
  SUPERMARKET_AISLES,
  correctFrenchSpelling,
  generateGenericNeedKey,
  sanitizeGenericDisplayName,
  normalizeProductNeed
} from '../../types/receipts';
import { ReceiptHistoryView } from './components/ReceiptHistoryView';
import { ReceiptValidationModal } from './components/ReceiptValidationModal';
import { ManualReceiptModal } from './components/ManualReceiptModal';
import { PriceEvolutionModal } from './components/PriceEvolutionModal';
import { DeleteConfirmDialog } from './components/DeleteConfirmDialog';
import { TARGET_PHYSICAL_STORES, resolvePhysicalStore } from '../../lib/storeRegistry';
import { AISLE_CONFIGS, normalizeStoreName } from '../../lib/receiptClassifier';
import { optimizeImageForOCR, formatFileSize, isPdfFile } from '../../lib/imageOptimizer';

/**
 * ============================================================================
 * RÉFÉRENTIEL EN DUR (MAPPING) : MAGASINS PHYSIQUES & LIENS GOOGLE MAPS
 * Relie sans AUCUNE API payante (0 € de coût) les adresses et en-têtes OCR
 * aux fiches officielles Google Maps pour différencier les magasins physiques.
 * ============================================================================
 */
export const STORE_PHYSICAL_MAPPING = {
  intermarche_gaillard: TARGET_PHYSICAL_STORES.intermarche_gaillard,
  intermarche_annemasse: TARGET_PHYSICAL_STORES.intermarche_annemasse,
  intermarche_ville_la_grand: TARGET_PHYSICAL_STORES.intermarche_ville_la_grand,
  carrefour_market_annemasse: TARGET_PHYSICAL_STORES.carrefour_market_annemasse,
  leclerc_ville_la_grand: TARGET_PHYSICAL_STORES.leclerc_ville_la_grand,
  lidl_annemasse: TARGET_PHYSICAL_STORES.lidl_annemasse,
  super_u_etrembieres: TARGET_PHYSICAL_STORES.super_u_etrembieres
} as const;

interface UploadedFilePreview {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
  sizeFormatted: string;
  isPdf: boolean;
  optimizedFile?: File;
  optimizedSizeFormatted?: string;
  reductionPercentage?: number;
  isOptimizing?: boolean;
}

export default function Receipts() {
  const {
    receipts,
    products,
    matrix,
    hiddenProductNames,
    isAnalyzing,
    analysisProgress,
    pendingValidationReceipt,
    activeTab,
    setPendingValidationReceipt,
    setActiveTab,
    addReceipt,
    deleteReceipt,
    hideProductFromMatrix,
    restoreProductToMatrix,
    extractReceipt,
    harmonizeAndCleanDatabase
  } = useReceipts();

  // État du téléversement
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<UploadedFilePreview[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // État de l'harmonisation / nettoyage de la base Firestore (Couche 3)
  const [isHarmonizing, setIsHarmonizing] = useState(false);
  const [harmonizeFeedback, setHarmonizeFeedback] = useState<string | null>(null);

  const handleHarmonizeDatabase = async () => {
    try {
      setIsHarmonizing(true);
      setHarmonizeFeedback(null);
      const res = await harmonizeAndCleanDatabase();
      setHarmonizeFeedback(
        `Harmonisation terminée : ${res.mergedGroups} familles canoniques consolidées, ${res.deletedDocs} doublons/lignes fantômes supprimés de Firestore.`
      );
      setTimeout(() => setHarmonizeFeedback(null), 8000);
    } catch (err: any) {
      console.error('Erreur harmonisation Firestore:', err);
      setErrorMessage(err?.message || "Erreur lors de l'harmonisation de la base.");
    } finally {
      setIsHarmonizing(false);
    }
  };

  // Modales
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(true);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [selectedProductForEvolution, setSelectedProductForEvolution] = useState<ProductComparisonRow | null>(null);

  // Bonus UI : Bouton "Masquer les produits sans comparaison"
  const [hideUncomparable, setHideUncomparable] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAisleFilter, setSelectedAisleFilter] = useState<string>('ALL');

  // L'INFOBULLE FLOTTANTE (TOOLTIP) AU SURVOL DU PRIX (RÈGLE 3 & STITCH DESIGN DNA)
  const [floatingTooltip, setFloatingTooltip] = useState<{
    offer: StoreOfferDetail;
    storeName: string;
    isCheapest: boolean;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (!floatingTooltip) return;
    const handleDismiss = () => setFloatingTooltip(null);
    window.addEventListener('scroll', handleDismiss, { passive: true });
    window.addEventListener('resize', handleDismiss);
    return () => {
      window.removeEventListener('scroll', handleDismiss);
      window.removeEventListener('resize', handleDismiss);
    };
  }, [floatingTooltip]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pendingValidationReceipt) {
      setIsValidationModalOpen(true);
    }
  }, [pendingValidationReceipt]);

  // Nettoyage des URL d'aperçu d'images lors du démontage
  useEffect(() => {
    return () => {
      selectedFiles.forEach(f => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
    };
  }, [selectedFiles]);

  const scrollToUpload = () => {
    if (uploadSectionRef.current) {
      uploadSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    fileInputRef.current?.click();
  };

  const addFilesToSelection = (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList);
    const newPreviews: UploadedFilePreview[] = incoming.map((file, idx) => {
      const isPdf = isPdfFile(file);
      const isPngOrLarge = !isPdf && ((file.type || '').includes('png') || file.name.toLowerCase().endsWith('.png') || file.size > 800 * 1024);
      return {
        id: `${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        file,
        previewUrl: isPdf ? '' : URL.createObjectURL(file),
        name: file.name,
        sizeFormatted: formatFileSize(file.size),
        isPdf,
        isOptimizing: isPngOrLarge
      };
    });

    setSelectedFiles(prev => [...prev, ...newPreviews]);
    setErrorMessage(null);

    // Optimisation asynchrone instantanée en tâche de fond (PNG et photos lourdes compressées en ~50ms)
    newPreviews.forEach(async (item) => {
      if (item.isPdf) return;
      try {
        const opt = await optimizeImageForOCR(item.file);
        setSelectedFiles(current => current.map(f => {
          if (f.id !== item.id) return f;
          return {
            ...f,
            optimizedFile: opt.file,
            optimizedSizeFormatted: formatFileSize(opt.optimizedSize),
            reductionPercentage: opt.reductionPercentage,
            isOptimizing: false
          };
        }));
      } catch (err) {
        console.warn("[CashPilot ImageOptimizer] Échec pré-optimisation:", err);
        setSelectedFiles(current => current.map(f => f.id === item.id ? { ...f, isOptimizing: false } : f));
      }
    });
  };

  const removeFile = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedFiles(prev => {
      const target = prev.find(f => f.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter(f => f.id !== id);
    });
  };

  const clearAllFiles = () => {
    selectedFiles.forEach(f => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    setSelectedFiles([]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToSelection(e.dataTransfer.files);
    }
  };

  const handleLaunchExtraction = async () => {
    if (selectedFiles.length === 0) return;
    setErrorMessage(null);

    try {
      // Priorité absolue aux fichiers optimisés ultra-légers (300 Ko au lieu de 15 Mo)
      const filesToExtract = selectedFiles.map(f => f.optimizedFile || f.file);
      await extractReceipt(filesToExtract);
      clearAllFiles();
    } catch (err: any) {
      console.error("Erreur lors de l'extraction du ticket :", err);
      setErrorMessage(err?.message || "Une erreur est survenue lors de l'extraction du ticket.");
    }
  };

  const handleSaveValidatedReceipt = async (validatedData: any) => {
    await addReceipt({
      storeName: validatedData.storeName,
      storeId: validatedData.storeId,
      storeAddress: validatedData.storeAddress,
      storeCity: validatedData.storeCity,
      storePostalCode: validatedData.storePostalCode,
      googleMapsUrl: validatedData.googleMapsUrl,
      date: validatedData.date,
      time: validatedData.time,
      totalArticles: validatedData.totalArticles,
      subtotal: validatedData.subtotal,
      totalDiscounts: validatedData.totalDiscounts,
      totalAmount: validatedData.totalAmount,
      items: validatedData.items,
      rawFileCount: validatedData.rawFileCount
    });
    setPendingValidationReceipt(null);
    setIsValidationModalOpen(false);
  };

  const handleSaveManualReceipt = async (manualData: any) => {
    await addReceipt(manualData);
    setIsManualModalOpen(false);
  };

  // ============================================================================
  // TABLEAU CROISÉ MULTI-ENSEIGNES : REGROUPEMENT PAR CLÉ DE BESOIN GÉNÉRIQUE
  // L'interface lit directement les documents Firestore { nom_generique, rayon, offres_magasins }
  // ============================================================================
  const { allStores, crossTableRows, totalComparableCount, totalUniqueCount } = useMemo(() => {
    const storeMap = new Map<string, { id: string; displayName: string; googleMapsUrl?: string; address?: string }>();
    const hiddenSet = new Set(hiddenProductNames.map(k => k.trim().toLowerCase()));

    // 1. Recenser tous les magasins physiques à partir de la matrice et des offres
    matrix.stores.forEach(s => {
      const resolved = resolvePhysicalStore({ storeName: s });
      storeMap.set(resolved.displayName, {
        id: resolved.id,
        displayName: resolved.displayName,
        googleMapsUrl: resolved.googleMapsUrl,
        address: resolved.address
      });
    });

    const rows: Array<{
      cleBesoin: string;
      nomGenerique: string;
      rayon: string;
      storeOffers: Record<string, {
        prixUnitaire: number;
        unite: string;
        prixPaye: number;
        marque: string;
        format: string;
        date: string;
      }>;
      storeCount: number;
      isComparable: boolean;
      lowestPrice: number;
      highestPrice: number;
      priceDiff: number;
      priceDiffPercent: number;
      cheapestStore: string;
      sampleBrands: string[];
      sampleRawRow?: ProductComparisonRow;
    }> = [];

    // 2. CONSOLIDATION EXTRÊME EN 3 COUCHES : Empreinte Pure + Famille Canonique + Fusion Magasins
    const allMatrixProducts = matrix.aisleGroups.flatMap(g => g.products);
    const consolidatedMap = new Map<string, {
      canonicalKey: string;
      nomGenerique: string;
      rayon: string;
      storeOffers: Record<string, any>;
      sampleBrands: Set<string>;
      sampleRawRow?: ProductComparisonRow;
    }>();

    allMatrixProducts.forEach(prod => {
      const lookupKey = prod.normalizedName.trim().toLowerCase();
      const canonical = normalizeProductNeed(prod.normalizedName);
      if (canonical.isInvalidArtifact) return;

      const canonicalKey = canonical.id;
      const cleanDisplayName = canonical.nom_affichage;

      if (
        hiddenSet.has(lookupKey) ||
        hiddenSet.has(canonicalKey) ||
        hiddenSet.has(cleanDisplayName.toLowerCase())
      ) {
        return;
      }

      if (!consolidatedMap.has(canonicalKey)) {
        consolidatedMap.set(canonicalKey, {
          canonicalKey,
          nomGenerique: cleanDisplayName,
          rayon: canonical.rayon || prod.category,
          storeOffers: {},
          sampleBrands: new Set<string>(),
          sampleRawRow: {
            ...prod,
            normalizedName: cleanDisplayName,
            category: (canonical.rayon || prod.category) as SupermarketAisle,
            priceHistory: [...(prod.priceHistory || [])]
          }
        });
      }

      const entry = consolidatedMap.get(canonicalKey)!;
      if (canonical.rayon) {
        entry.rayon = canonical.rayon;
      }

      // Fusionner l'historique des prix pour la courbe d'évolution
      if (entry.sampleRawRow && prod.priceHistory && prod.priceHistory.length > 0) {
        const currentHist = entry.sampleRawRow.priceHistory || [];
        prod.priceHistory.forEach(ph => {
          if (
            ph &&
            ph.unitPrice > 0 &&
            !currentHist.some(x => x.date === ph.date && x.storeName === ph.storeName && Math.abs(x.unitPrice - ph.unitPrice) < 0.01)
          ) {
            currentHist.push(ph);
          }
        });
        entry.sampleRawRow.priceHistory = currentHist.sort((a, b) => a.date.localeCompare(b.date));
      }

      const presentStores = Object.keys(prod.storePrices);

      presentStores.forEach(sName => {
        const sp = prod.storePrices[sName];
        if (!sp || !(sp.unitPrice > 0) || Number.isNaN(sp.unitPrice)) return;

        const resolved = resolvePhysicalStore({ storeName: sName });
        const canonicalStoreName = resolved.displayName;
        if (!canonicalStoreName || canonicalStoreName === 'Supermarché') return;

        if (!storeMap.has(canonicalStoreName)) {
          storeMap.set(canonicalStoreName, {
            id: resolved.id,
            displayName: canonicalStoreName,
            googleMapsUrl: resolved.googleMapsUrl,
            address: resolved.address
          });
        }

        // COUCHE 3.1 : Conserver l'offre la plus récente (ou la plus avantageuse à date égale)
        const existingOffer = entry.storeOffers[canonicalStoreName];
        if (
          !existingOffer ||
          (sp.date && existingOffer.date && sp.date > existingOffer.date) ||
          (sp.date === existingOffer.date && sp.unitPrice < existingOffer.prixUnitaire)
        ) {
          entry.storeOffers[canonicalStoreName] = {
            prixUnitaire: sp.unitPrice,
            unite: sp.unit || prod.unit || 'kg',
            prixPaye: sp.pricePaid,
            marque: sp.brand || 'Générique',
            format: sp.weightOrVolume || '1 pièce',
            date: sp.date
          };
        }

        if (sp.brand && sp.brand !== 'Générique') {
          entry.sampleBrands.add(sp.brand);
        }
      });
    });

    const storesList = Array.from(storeMap.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
    const validStoreNames = new Set(storesList.map(s => s.displayName));

    // COUCHE 3.2 : Transformer le dictionnaire consolidé en lignes et ÉRADIQUER STRICTEMENT LES LIGNES FANTÔMES
    consolidatedMap.forEach(entry => {
      const validOffers: Record<string, any> = {};
      Object.entries(entry.storeOffers).forEach(([stName, off]: [string, any]) => {
        if (validStoreNames.has(stName) && off && off.prixUnitaire > 0 && !Number.isNaN(off.prixUnitaire)) {
          validOffers[stName] = off;
        }
      });

      const storeCount = Object.keys(validOffers).length;
      // RÈGLE STRICTE COUCHE 3.2 : Interdire toute ligne fantôme sans aucun prix valide dans les colonnes magasins
      if (storeCount === 0) return;

      const isComp = storeCount >= 2;
      const unitPrices = Object.values(validOffers).map((o: any) => o.prixUnitaire);
      const lowestPrice = unitPrices.length > 0 ? Math.min(...unitPrices) : 0;
      const highestPrice = unitPrices.length > 0 ? Math.max(...unitPrices) : 0;
      const priceDiff = isComp ? Number((highestPrice - lowestPrice).toFixed(2)) : 0;
      const priceDiffPercent = isComp && highestPrice > 0 ? Math.round((priceDiff / highestPrice) * 100) : 0;

      const cheapestStoreEntry = Object.entries(validOffers).find(([_, o]: any) => o.prixUnitaire === lowestPrice);
      const cheapestStore = cheapestStoreEntry ? cheapestStoreEntry[0] : '';

      rows.push({
        cleBesoin: entry.canonicalKey,
        nomGenerique: entry.nomGenerique,
        rayon: entry.rayon,
        storeOffers: validOffers,
        storeCount,
        isComparable: isComp,
        lowestPrice,
        highestPrice,
        priceDiff,
        priceDiffPercent,
        cheapestStore,
        sampleBrands: Array.from(entry.sampleBrands),
        sampleRawRow: entry.sampleRawRow
      });
    });

    const compCount = rows.filter(r => r.isComparable).length;
    const uniqCount = rows.length - compCount;

    return {
      allStores: storesList,
      crossTableRows: rows,
      totalComparableCount: compCount,
      totalUniqueCount: uniqCount
    };
  }, [matrix, hiddenProductNames]);

  // Filtrage réactif de la vue
  const filteredRows = useMemo(() => {
    return crossTableRows.filter(row => {
      // 1. Bonus UI : Masquer les produits sans comparaison (lignes avec 1 seul magasin)
      if (hideUncomparable && row.storeCount < 2) {
        return false;
      }

      // 2. Filtre Rayon
      if (selectedAisleFilter !== 'ALL' && row.rayon !== selectedAisleFilter) {
        return false;
      }

      // 3. Recherche textuelle
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchName = row.nomGenerique.toLowerCase().includes(q);
        const matchAisle = row.rayon.toLowerCase().includes(q);
        const matchBrand = row.sampleBrands.some(b => b.toLowerCase().includes(q));
        if (!matchName && !matchAisle && !matchBrand) return false;
      }

      return true;
    });
  }, [crossTableRows, hideUncomparable, selectedAisleFilter, searchTerm]);

  // RÈGLE 2 : REGROUPEMENT PAR EN-TÊTES DE SECTION TRANSVERSAUX (RAYONS EN MAJUSCULES)
  const groupedAisles = useMemo(() => {
    const map: Record<string, typeof filteredRows> = {};
    SUPERMARKET_AISLES.forEach(a => {
      map[a] = [];
    });

    filteredRows.forEach(row => {
      const aisle = row.rayon || 'Autres / Divers';
      if (!map[aisle]) {
        map[aisle] = [];
      }
      map[aisle].push(row);
    });

    return SUPERMARKET_AISLES
      .filter(aisle => map[aisle] && map[aisle].length > 0)
      .map(aisle => ({
        aisle,
        rows: map[aisle].sort((a, b) => a.nomGenerique.localeCompare(b.nomGenerique, 'fr', { sensitivity: 'base' }))
      }));
  }, [filteredRows]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      
      {/* ========================================================================= */}
      {/* 1. EN-TÊTE PRINCIPAL & SYNCHRONISATION MULTI-APPAREILS                      */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-border/70 pb-3.5 sm:pb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Audit Alimentaire & Grande Distribution
            </span>

            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <div className="flex items-center gap-1">
                <Laptop size={11} />
                <span>+</span>
                <Smartphone size={11} />
              </div>
              <span className="hidden sm:inline">Synchro PC & Téléphone en direct</span>
              <span className="sm:hidden">Synchro active</span>
            </div>
          </div>

          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight mt-1 text-foreground">
            Matrice Comparative Multi-Enseignes
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Comparez vos prix réels au kilo/litre par rayon d'hypermarché en respectant strictement vos tickets de caisse.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsManualModalOpen(true)}
            className="text-xs gap-1.5 h-8 sm:h-9 bg-card hover:bg-secondary border-border/80"
          >
            <FileSpreadsheet size={14} className="text-primary" />
            <span>Saisie manuelle</span>
          </Button>

          <Button
            size="sm"
            onClick={scrollToUpload}
            className="text-xs font-bold gap-1.5 h-8 sm:h-9 shadow-md"
          >
            <Plus size={14} />
            <span>Importer un ticket de caisse</span>
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SECTION TÉLÉVERSEMENT DU TICKET DE CAISSE (PHOTO OU PDF)                */}
      {/* REMONTÉE TOUT EN HAUT DE PAGE AU-DESSUS DU TABLEAU COMPARATIF              */}
      {/* ========================================================================= */}
      <div ref={uploadSectionRef} id="receipt-upload-section" className="space-y-4">
        <Card className="glass-card overflow-hidden border-border/80 dark:border-white/[0.08] shadow-sm">
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                <Camera className="text-primary" size={18} />
                Téléversement du ticket de caisse (Photo ou PDF)
              </CardTitle>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                <Sparkles size={11} />
                Google Gemini Flash (100% Gratuit)
              </span>
            </div>
            <CardDescription className="text-xs">
              Sélectionnez une ou plusieurs photos successives (pour les longs tickets) ou votre document PDF.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
            <div 
              className={cn(
                "flex flex-col items-center justify-center p-5 sm:p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300 relative group text-center",
                isDragging 
                  ? "border-primary bg-primary/10 scale-[0.99]" 
                  : "border-border/80 dark:border-white/[0.1] hover:border-primary/50 hover:bg-secondary/40 dark:hover:bg-white/[0.02]"
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                id="receipt-file-input" 
                className="hidden" 
                accept="image/*,application/pdf" 
                multiple
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    addFilesToSelection(e.target.files);
                  }
                }}
              />

              <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3 group-hover:scale-105 transition-transform duration-300">
                <UploadCloud size={28} className="stroke-[2.2]" />
              </div>
              
              <p className="text-sm font-bold text-foreground">
                Glissez vos clichés ici ou touchez pour photographier / parcourir
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Pour un ticket long, photographiez-le en 2 ou 3 parties de haut en bas. L'intelligence artificielle réassemble le tout sans doublon.
              </p>

              <div className="mt-4 flex items-center gap-2 flex-wrap justify-center">
                <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-secondary text-muted-foreground border border-border/60">
                  JPG, PNG, WEBP, PDF
                </span>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 flex items-center gap-1">
                  <Zap size={11} className="fill-cyan-500" />
                  Auto-compression PNG ultra-rapide
                </span>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold text-primary bg-primary/10">
                  Multi-fragments supporté
                </span>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                  Audit & validation obligatoire
                </span>
              </div>
            </div>

            {/* MINIATURES DES FICHIERS SÉLECTIONNÉS */}
            {selectedFiles.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers size={14} className="text-primary" />
                    <span className="text-xs font-bold text-foreground">
                      Fragments à analyser ({selectedFiles.length} cliché{selectedFiles.length > 1 ? 's' : ''})
                    </span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={clearAllFiles}
                    className="h-7 text-[11px] text-muted-foreground hover:text-red-500 hover:bg-red-500/10 px-2"
                  >
                    Tout effacer
                  </Button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {selectedFiles.map((fileItem, index) => (
                    <div 
                      key={fileItem.id} 
                      className="relative group rounded-xl overflow-hidden border border-border bg-card p-2 shadow-xs"
                    >
                      <div className="w-full h-24 rounded-lg bg-secondary/50 flex items-center justify-center overflow-hidden mb-1.5 relative">
                        {fileItem.isPdf ? (
                          <div className="flex flex-col items-center justify-center text-muted-foreground p-2 text-center">
                            <FileText size={28} className="text-rose-500 mb-1" />
                            <span className="text-[10px] font-semibold truncate max-w-full px-1">
                              {fileItem.name}
                            </span>
                          </div>
                        ) : (
                          <img 
                            src={fileItem.previewUrl} 
                            alt={fileItem.name} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                          />
                        )}
                        <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-black/70 text-white text-[9px] font-mono font-bold">
                          #{index + 1}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] mt-1">
                        <span className="font-medium text-foreground truncate max-w-[80px]" title={fileItem.name}>
                          {fileItem.name}
                        </span>
                        {fileItem.isOptimizing ? (
                          <span className="text-[9px] text-cyan-500 font-medium flex items-center gap-1 animate-pulse">
                            <Loader2 size={9} className="animate-spin" />
                            Optimisation...
                          </span>
                        ) : fileItem.reductionPercentage && fileItem.reductionPercentage > 0 ? (
                          <span 
                            className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5"
                            title={`Taille allégée de ${fileItem.sizeFormatted} à ${fileItem.optimizedSizeFormatted} (-${fileItem.reductionPercentage}%)`}
                          >
                            <Zap size={9} className="text-emerald-500 fill-emerald-500" />
                            {fileItem.optimizedSizeFormatted} (-{fileItem.reductionPercentage}%)
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {fileItem.sizeFormatted}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={(e) => removeFile(fileItem.id, e)}
                        className="absolute top-3 right-3 p-1 rounded-full bg-black/60 text-white hover:bg-red-500 transition-colors shadow-sm"
                        title="Supprimer ce cliché"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <p className="text-xs text-muted-foreground">
                    Cliquez sur le bouton ci-contre pour lancer la lecture des lignes d'articles par l'IA.
                  </p>
                  <Button
                    onClick={handleLaunchExtraction}
                    disabled={isAnalyzing}
                    className="gap-2 text-xs font-bold shadow-md h-9"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 size={14} className="animate-spin text-cyan-400" />
                        <span>Extraction IA en cours...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} className="text-cyan-400" />
                        <span>Extraire les articles ({selectedFiles.length})</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* BANNIÈRE D'EXTRACTION IA EN COURS */}
      {isAnalyzing && (
        <Card className="border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 via-primary/5 to-cyan-500/10 backdrop-blur-md shadow-md animate-pulse">
          <CardContent className="p-4 sm:p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-500 flex items-center justify-center shrink-0">
              <Loader2 size={24} className="animate-spin text-cyan-400" />
            </div>
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">
                  Extraction IA multimodale en cours...
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400">
                  Google Gemini Flash (Gratuit)
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {analysisProgress || "Gemini extrait les articles, montants, et affecte automatiquement les rayons standardisés..."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* BANNIÈRE TICKET EN ATTENTE DE VALIDATION */}
      {pendingValidationReceipt && !isAnalyzing && (
        <Card className="border-amber-500/40 bg-amber-500/10 backdrop-blur-md shadow-sm">
          <CardContent className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <div>
                <p className="text-xs font-bold text-foreground">
                  Ticket « {pendingValidationReceipt.storeName} » ({pendingValidationReceipt.items.length} articles, {formatCurrency(pendingValidationReceipt.totalAmount, { showSign: false })}) en attente de validation
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Vos données extraites sont conservées intactes en mémoire locale.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
              <Button
                size="sm"
                onClick={() => setIsValidationModalOpen(true)}
                className="h-8 text-xs font-bold gap-1.5 bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
              >
                <CheckCircle2 size={13} />
                <span>Vérifier & Valider</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setPendingValidationReceipt(null);
                  setIsValidationModalOpen(false);
                }}
                className="h-8 text-[11px] text-muted-foreground hover:text-red-500 hover:bg-red-500/10 border-border/80"
              >
                Ignorer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* MESSAGE D'ERREUR */}
      {errorMessage && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-start justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-start gap-2.5">
            <AlertCircle size={17} className="shrink-0 mt-0.5" />
            <div className="whitespace-pre-line leading-relaxed font-medium">{errorMessage}</div>
          </div>
          <button 
            onClick={() => setErrorMessage(null)}
            className="p-1 hover:bg-destructive/20 rounded-md transition-colors shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* NAVIGATION PAR ONGLETS */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-secondary/50 border border-border/70 w-full sm:w-fit overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('matrix')}
          className={cn(
            "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
            activeTab === 'matrix'
              ? "bg-card text-foreground shadow-sm border border-border/70"
              : "text-muted-foreground hover:text-foreground hover:bg-card/40"
          )}
        >
          <Table size={14} className={activeTab === 'matrix' ? "text-primary" : ""} />
          <span>Matrice Comparative ({allStores.length} magasins)</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={cn(
            "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
            activeTab === 'history'
              ? "bg-card text-foreground shadow-sm border border-border/70"
              : "text-muted-foreground hover:text-foreground hover:bg-card/40"
          )}
        >
          <History size={14} className={activeTab === 'history' ? "text-primary" : ""} />
          <span>Historique des Tickets ({receipts.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 3. TABLEAU CROISÉ REACT (REFONTE RÈGLE 3 & LIVRABLE 2)                    */}
      {/* ========================================================================= */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          
          {/* BARRE D'OUTILS DU TABLEAU CROISÉ */}
          <div className="p-3.5 sm:p-4 rounded-2xl glass-card border border-border/70 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
            
            {/* RECHERCHE */}
            <div className="relative flex-1 max-w-md">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher un besoin générique (ex: Sauce burger, Lait, Steak)..."
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

            {/* CONTRÔLES : FILTRE RAYON ET BONUS UI MASQUER INCOMPARABLES */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* SÉLECTEUR DE RAYON */}
              <select
                value={selectedAisleFilter}
                onChange={(e) => setSelectedAisleFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
              >
                <option value="ALL">Tous les rayons ({SUPERMARKET_AISLES.length})</option>
                {SUPERMARKET_AISLES.map(aisle => (
                  <option key={aisle} value={aisle}>{aisle}</option>
                ))}
              </select>

              {/* BONUS UI : BOUTON "MASQUER LES PRODUITS SANS COMPARAISON" */}
              <button
                type="button"
                onClick={() => setHideUncomparable(!hideUncomparable)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer shadow-xs",
                  hideUncomparable
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30"
                    : "bg-secondary/70 hover:bg-secondary text-muted-foreground hover:text-foreground border-border/80"
                )}
                title={hideUncomparable ? "Afficher tous les produits" : "Masquer les produits présents dans un seul magasin"}
              >
                {hideUncomparable ? <Eye size={13} className="text-emerald-500" /> : <EyeOff size={13} />}
                <span>{hideUncomparable ? "Afficher tous les produits" : "Masquer les produits sans comparaison"}</span>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-semibold",
                  hideUncomparable ? "bg-emerald-500/30 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"
                )}>
                  {hideUncomparable ? `${totalComparableCount} comparables` : `${totalUniqueCount} sans comp.`}
                </span>
              </button>

              {/* COUCHE 3.3 : BOUTON "HARMONISER & NETTOYER LES DOUBLONS" (BATCH FIRESTORE 100% GRATUIT) */}
              <button
                type="button"
                onClick={handleHarmonizeDatabase}
                disabled={isHarmonizing}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer shadow-xs",
                  "bg-cyan-500/15 hover:bg-cyan-500/25 border-cyan-500/40 text-cyan-600 dark:text-cyan-400 disabled:opacity-50"
                )}
                title="Consolider immédiatement les doublons et nettoyer les lignes fantômes dans Firestore (Batch 100% gratuit)"
              >
                {isHarmonizing ? (
                  <Loader2 size={13} className="animate-spin text-cyan-500" />
                ) : (
                  <Sparkles size={13} className="text-cyan-500" />
                )}
                <span>{isHarmonizing ? "Harmonisation..." : "Harmoniser & Nettoyer les doublons"}</span>
              </button>
            </div>
          </div>

          {harmonizeFeedback && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 size={15} className="shrink-0" />
              <span>{harmonizeFeedback}</span>
            </div>
          )}

          {/* TABLEAU CROISÉ : LIGNES (BESOIN GÉNÉRIQUE & RAYON) VS COLONNES (MAGASINS PHYSIQUES) */}
          <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px] text-xs">
                <thead>
                  <tr className="border-b border-border/70 bg-secondary/40 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    {/* EN LIGNE (ORDONNÉE) : BESOIN GÉNÉRIQUE & RAYON */}
                    <th className="py-3 px-4 w-[28%] min-w-[180px] font-bold">
                      Produit (Besoin Générique & Rayon) ({filteredRows.length})
                    </th>

                    {/* EN COLONNE (ABSCISSE) : MAGASINS PHYSIQUES EXACTS */}
                    {allStores.map(st => (
                      <th key={st.displayName} className="py-3 px-3 text-center min-w-[130px] font-bold text-foreground">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <Store size={12} className="text-primary" />
                            <span className="font-extrabold text-xs" title={st.displayName}>{st.displayName}</span>
                            {st.googleMapsUrl && (
                              <a
                                href={st.googleMapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-primary transition-colors p-0.5"
                                title="Ouvrir sur Google Maps"
                              >
                                <ExternalLink size={10} />
                              </a>
                            )}
                          </div>
                          {st.address && (
                            <span className="text-[9px] font-normal text-muted-foreground truncate max-w-[120px]" title={st.address}>
                              {st.address}
                            </span>
                          )}
                        </div>
                      </th>
                    ))}

                    {/* COLONNE STATUT & ACTIONS */}
                    <th className="py-3 px-3 text-right w-[15%] min-w-[110px] font-bold">
                      Écart Audit
                    </th>
                    <th className="py-3 px-2 text-center w-[6%] font-bold">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-border/50 text-xs">
                  {groupedAisles.length === 0 ? (
                    <tr>
                      <td colSpan={allStores.length + 3} className="py-12 text-center text-muted-foreground">
                        <Package size={28} className="mx-auto mb-2 opacity-40" />
                        <p className="font-semibold">Aucun produit ne correspond à vos filtres.</p>
                        <p className="text-[11px] mt-0.5">
                          {hideUncomparable ? "Désactivez 'Masquer les produits sans comparaison' pour revoir tous les articles." : "Importez d'autres tickets pour enrichir le comparatif."}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    groupedAisles.map(group => (
                      <React.Fragment key={`aisle-group-${group.aisle}`}>
                        {/* EN-TÊTE DE SECTION TRANSVERSAL DU RAYON (RÈGLE 2 & DESIGN GOOGLE STITCH) */}
                        <tr className="bg-secondary/70 dark:bg-muted/40 border-y-2 border-border/80 sticky top-0 z-10 backdrop-blur-md">
                          <td colSpan={allStores.length + 3} className="py-2.5 px-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                                <span className="font-black text-xs uppercase tracking-wider text-primary">
                                  {group.aisle}
                                </span>
                              </div>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-background/80 text-muted-foreground border border-border/50 font-mono">
                                {group.rows.length} article{group.rows.length > 1 ? 's' : ''}
                              </span>
                            </div>
                          </td>
                        </tr>

                        {/* LISTE DES PRODUITS DU RAYON */}
                        {group.rows.map(row => (
                          <tr key={row.cleBesoin || row.nomGenerique} className="hover:bg-secondary/20 transition-colors group">
                            
                            {/* EN LIGNE (ORDONNÉE) : NOM GÉNÉRIQUE PUR (SANS RÉPÉTITION DU BADGE DE RAYON) */}
                            <td className="py-3 px-4 sticky left-0 bg-card/95 backdrop-blur-xs z-1 border-r border-border/40 max-w-[220px] align-middle">
                              <span className="font-extrabold text-foreground text-xs sm:text-sm tracking-tight leading-snug">
                                {correctFrenchSpelling(row.nomGenerique)}
                              </span>
                            </td>

                        {/* CELLULES CROISÉES : VUE ÉPURÉE (PRIX AU KILO/LITRE EN GRAND ET EN GRAS + INFOBULLE TOOLTIP) */}
                        {allStores.map(st => {
                          const offer = row.storeOffers[st.displayName];
                          if (!offer) {
                            return (
                              <td key={st.displayName} className="py-3 px-3 text-center text-muted-foreground/30 font-mono text-xs align-middle">
                                —
                              </td>
                            );
                          }

                          const isCheapestInRow = row.isComparable && offer.prixUnitaire === row.lowestPrice;

                          return (
                            <td 
                              key={st.displayName}
                              className={cn(
                                "py-3 px-3 text-center transition-colors align-middle",
                                isCheapestInRow && "bg-emerald-500/[0.08] dark:bg-emerald-500/[0.12]"
                              )}
                            >
                              <div
                                className="flex flex-col items-center justify-center cursor-pointer py-1.5 px-2 rounded-xl transition-all hover:bg-secondary/40 select-none group focus:outline-none focus:ring-1 focus:ring-primary/40"
                                onMouseEnter={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setFloatingTooltip({
                                    offer,
                                    storeName: st.displayName,
                                    isCheapest: isCheapestInRow,
                                    x: rect.left + rect.width / 2,
                                    y: rect.top
                                  });
                                }}
                                onMouseLeave={() => setFloatingTooltip(null)}
                                onClick={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setFloatingTooltip(prev => prev ? null : {
                                    offer,
                                    storeName: st.displayName,
                                    isCheapest: isCheapestInRow,
                                    x: rect.left + rect.width / 2,
                                    y: rect.top
                                  });
                                }}
                                role="button"
                                tabIndex={0}
                                title="Survolez pour afficher les détails du relevé"
                              >
                                {/* VUE ÉPURÉE : UNIQUEMENT LE PRIX AU KILO/LITRE EN GRAS ET EN GRAND */}
                                <div className={cn(
                                  "font-black font-mono text-sm sm:text-base flex items-baseline justify-center gap-0.5 tracking-tight transition-transform duration-150 group-hover:scale-105",
                                  isCheapestInRow ? "text-emerald-600 dark:text-emerald-400 font-extrabold" : "text-foreground"
                                )}>
                                  <span>{formatCurrency(offer.prixUnitaire, { showSign: false })}</span>
                                  <span className="text-[11px] font-bold text-muted-foreground">
                                    /{offer.unite}
                                  </span>
                                </div>

                                {/* DISCRET BADGE MOINS CHER */}
                                {isCheapestInRow && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold px-1.5 py-0.2 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 mt-0.5">
                                    <Check size={9} className="stroke-[3]" />
                                    Moins cher
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}

                        {/* STATUT & ÉCART AUDIT */}
                        <td className="py-3 px-3 text-right align-top">
                          {row.isComparable ? (
                            <div className="flex flex-col items-end">
                              <span className="inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
                                {row.storeCount} magasins
                              </span>
                              {row.priceDiff > 0 && (
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                                  -{row.priceDiffPercent}% (+{formatCurrency(row.priceDiff, { showSign: false })})
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-end">
                              <span className="inline-flex items-center text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/60">
                                1 magasin
                              </span>
                              <span className="text-[9px] text-muted-foreground mt-0.5">
                                Unique
                              </span>
                            </div>
                          )}
                        </td>

                        {/* ACTIONS */}
                        <td className="py-3 px-2 text-center align-top">
                          <div className="flex items-center justify-center gap-1">
                            {row.sampleRawRow && (
                              <button
                                type="button"
                                onClick={() => setSelectedProductForEvolution(row.sampleRawRow || null)}
                                className="p-1 rounded-lg text-muted-foreground hover:text-cyan-500 hover:bg-cyan-500/10 transition-colors"
                                title="Voir la courbe d'évolution du prix"
                              >
                                <TrendingUp size={13} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setProductToDelete(row.nomGenerique)}
                              className="p-1 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                              title="Masquer ce produit du tableau comparatif"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>

                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VUE 2 : HISTORIQUE COMPLET DES TICKETS */}
      {activeTab === 'history' && (
        <ReceiptHistoryView
          receipts={receipts}
          onDeleteReceipt={deleteReceipt}
          onOpenUpload={scrollToUpload}
        />
      )}

      {/* ========================================================================= */}
      {/* L'INFOBULLE FLOTTANTE (TOOLTIP) - STITCH DESIGN DNA                       */}
      {/* ========================================================================= */}
      {floatingTooltip && (
        <div
          className="fixed z-[9999] pointer-events-none -translate-x-1/2 -translate-y-full mb-2.5 w-56 p-3 rounded-2xl bg-popover/95 dark:bg-card/95 backdrop-blur-md border border-border/80 shadow-2xl shadow-black/25 text-xs animate-in fade-in zoom-in-95 duration-150 select-none"
          style={{
            left: `${floatingTooltip.x}px`,
            top: `${floatingTooltip.y - 8}px`
          }}
        >
          {/* En-tête : Nom du magasin & Badge Moins Cher */}
          <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-border/60 gap-1.5">
            <div className="flex items-center gap-1.5 truncate">
              <Store size={12} className="text-primary shrink-0" />
              <span className="font-extrabold text-[11px] text-foreground truncate" title={floatingTooltip.storeName}>
                {floatingTooltip.storeName}
              </span>
            </div>
            {floatingTooltip.isCheapest && (
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
                ★ Moins cher
              </span>
            )}
          </div>

          {/* Corps de l'infobulle : Détails stricts stockés dans Firestore */}
          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground font-medium">Prix payé :</span>
              <span className="font-mono font-bold text-foreground">
                {formatCurrency(floatingTooltip.offer.prixPaye, { showSign: false })}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground font-medium">Quantité :</span>
              <span className="font-mono font-semibold text-foreground">
                {floatingTooltip.offer.format || '1 pièce'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground font-medium">Marque :</span>
              <span className="font-semibold text-foreground truncate max-w-[110px]" title={floatingTooltip.offer.marque}>
                {floatingTooltip.offer.marque || 'Générique'}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-border/40">
              <span className="text-muted-foreground font-medium">Date :</span>
              <span className="font-mono text-muted-foreground">
                {formatDateFR(floatingTooltip.offer.date)}
              </span>
            </div>
          </div>

          {/* Flèche pointant vers la cellule de prix */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-border/80" />
        </div>
      )}

      {/* MODALE DE VALIDATION DE TICKET */}
      {pendingValidationReceipt && (
        <ReceiptValidationModal
          isOpen={Boolean(pendingValidationReceipt) && isValidationModalOpen}
          initialData={pendingValidationReceipt}
          existingReceipts={receipts}
          onCancel={() => setIsValidationModalOpen(false)}
          onSave={handleSaveValidatedReceipt}
        />
      )}

      {/* MODALE DE SAISIE MANUELLE */}
      {isManualModalOpen && (
        <ManualReceiptModal
          isOpen={isManualModalOpen}
          existingReceipts={receipts}
          onClose={() => setIsManualModalOpen(false)}
          onSave={handleSaveManualReceipt}
        />
      )}

      {/* MODALE D'ÉVOLUTION DES PRIX */}
      {selectedProductForEvolution && (
        <PriceEvolutionModal
          isOpen={Boolean(selectedProductForEvolution)}
          product={selectedProductForEvolution}
          onClose={() => setSelectedProductForEvolution(null)}
        />
      )}

      {/* DIALOGUE DE CONFIRMATION DE SUPPRESSION */}
      {productToDelete && (
        <DeleteConfirmDialog
          isOpen={Boolean(productToDelete)}
          title="Masquer le produit du comparatif"
          description={`Êtes-vous sûr de vouloir masquer "${productToDelete}" de la matrice comparative ? L'historique de vos tickets restera intact.`}
          onConfirm={async () => {
            if (productToDelete) {
              await hideProductFromMatrix(productToDelete);
              setProductToDelete(null);
            }
          }}
          onCancel={() => setProductToDelete(null)}
        />
      )}

    </div>
  );
}
