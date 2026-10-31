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
  TrendingDown, 
  Tag, 
  ChevronDown, 
  ChevronUp, 
  ChevronLeft,
  ChevronRight,
  Package, 
  Zap,
  LayoutGrid,
  MoreHorizontal,
  Navigation
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
import { OptimalCartModal } from './components/OptimalCartModal';
import { getProductEmoji } from '../../lib/productEmojiMapper';
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
  const [isOptimalCartModalOpen, setIsOptimalCartModalOpen] = useState(false);

  // Mode d'affichage Stitch : Cartes Horizontales Déstructurées (Défaut) vs Tableau Croisé
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Filtres
  const [hideUncomparable, setHideUncomparable] = useState(false);
  const [showPromosOnly, setShowPromosOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAisleFilter, setSelectedAisleFilter] = useState<string>('ALL');
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('ALL');

  // Pagination pour la vue Cartes Stitch
  const [currentPage, setCurrentPage] = useState(1);

  // Menu d'options actif (...) sur chaque carte
  const [activeMenuProduct, setActiveMenuProduct] = useState<string | null>(null);

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

  // Fermeture du menu contextuel au clic extérieur
  useEffect(() => {
    if (!activeMenuProduct) return;
    const handleDismissMenu = () => setActiveMenuProduct(null);
    window.addEventListener('click', handleDismissMenu);
    return () => window.removeEventListener('click', handleDismissMenu);
  }, [activeMenuProduct]);

  // Réinitialiser la pagination lors d'un changement de filtre
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedAisleFilter, selectedStoreFilter, showPromosOnly, hideUncomparable]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
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
  const { allStores, crossTableRows, totalComparableCount, totalUniqueCount, totalPromosCount } = useMemo(() => {
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
        isPromo?: boolean;
        discountAmount?: number;
        discountRate?: number;
        discountType?: string;
        initialUnitPrice?: number;
        initialPrice?: number;
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
      hasAnyPromo?: boolean;
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

        const isItemPromo = Boolean(sp.isPromo || (sp.discountAmount && sp.discountAmount > 0));
        const discAmt = sp.discountAmount || 0;
        const discRate = sp.discountRate || (sp.initialPrice && discAmt > 0 ? Math.round((discAmt / sp.initialPrice) * 100) : 0);
        const initUnitPrice = sp.initialUnitPrice || sp.unitPrice;
        const initPrice = sp.initialPrice || (discAmt > 0 ? Number((sp.pricePaid + discAmt).toFixed(2)) : sp.pricePaid);

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
            date: sp.date,
            isPromo: isItemPromo,
            discountAmount: discAmt,
            discountRate: discRate,
            discountType: sp.discountType || '',
            initialUnitPrice: initUnitPrice,
            initialPrice: initPrice
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
      const hasAnyPromo = Object.values(validOffers).some((o: any) => Boolean(o.isPromo || (o.discountAmount && o.discountAmount > 0)));

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
        sampleRawRow: entry.sampleRawRow,
        hasAnyPromo
      });
    });

    const compCount = rows.filter(r => r.isComparable).length;
    const uniqCount = rows.length - compCount;
    const promoCount = rows.filter(r => r.hasAnyPromo).length;

    return {
      allStores: storesList,
      crossTableRows: rows,
      totalComparableCount: compCount,
      totalUniqueCount: uniqCount,
      totalPromosCount: promoCount
    };
  }, [matrix, hiddenProductNames]);

  // Filtrage réactif de la vue (Promos, Magasin spécifique, Incomparables, Rayon, Recherche)
  const filteredRows = useMemo(() => {
    return crossTableRows.filter(row => {
      // 0. Filtre Promotions Uniquement
      if (showPromosOnly && !row.hasAnyPromo) {
        return false;
      }

      // 1. Filtre Enseigne Spécifique (Pillule Stitch)
      if (selectedStoreFilter !== 'ALL' && !row.storeOffers[selectedStoreFilter]) {
        return false;
      }

      // 2. Bonus UI : Masquer les produits sans comparaison (lignes avec 1 seul magasin)
      if (hideUncomparable && row.storeCount < 2) {
        return false;
      }

      // 3. Filtre Rayon
      if (selectedAisleFilter !== 'ALL' && row.rayon !== selectedAisleFilter) {
        return false;
      }

      // 4. Recherche textuelle
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchName = row.nomGenerique.toLowerCase().includes(q);
        const matchAisle = row.rayon.toLowerCase().includes(q);
        const matchBrand = row.sampleBrands.some(b => b.toLowerCase().includes(q));
        if (!matchName && !matchAisle && !matchBrand) return false;
      }

      return true;
    });
  }, [crossTableRows, showPromosOnly, selectedStoreFilter, hideUncomparable, selectedAisleFilter, searchTerm]);

  // Pagination pour la vue Cartes Stitch
  const ITEMS_PER_PAGE = 12;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ITEMS_PER_PAGE));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRows.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRows, currentPage]);

  // Calcul dynamique de l'économie globale détectée sur les courses
  const totalDetectedSavings = useMemo(() => {
    const comparableRows = crossTableRows.filter(r => r.isComparable && r.priceDiff > 0);
    return Number(comparableRows.reduce((acc, r) => acc + r.priceDiff, 0).toFixed(2));
  }, [crossTableRows]);

  // Couleur du point indicateur pour chaque enseigne
  const getStoreDotColor = (storeName: string): string => {
    const s = storeName.toLowerCase();
    if (s.includes('leclerc')) return 'bg-blue-500';
    if (s.includes('carrefour')) return 'bg-sky-400';
    if (s.includes('intermarche') || s.includes('intermarché')) return 'bg-red-500';
    if (s.includes('lidl')) return 'bg-amber-400';
    if (s.includes('super u') || s.includes('hyper u') || s.includes('système u')) return 'bg-cyan-400';
    if (s.includes('monoprix')) return 'bg-rose-500';
    if (s.includes('auchan')) return 'bg-emerald-400';
    return 'bg-indigo-400';
  };

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
    <div className="liquid-mesh min-h-screen text-slate-100 pb-36 p-3 sm:p-6 md:p-8 space-y-6 sm:space-y-8 rounded-3xl max-w-7xl mx-auto relative select-none">
      
      {/* ========================================================================= */}
      {/* 1. EN-TÊTE PRINCIPAL STITCH & SYNCHRONISATION MULTI-APPAREILS             */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-white/10 pb-4 sm:pb-6">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Audit Alimentaire & Grande Distribution • Google Stitch Pro
            </span>

            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <div className="flex items-center gap-1">
                <Laptop size={11} />
                <span>+</span>
                <Smartphone size={11} />
              </div>
              <span className="hidden sm:inline">Synchro direct PC & Mobile</span>
              <span className="sm:hidden">Synchro active</span>
            </div>
          </div>

          <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight mt-1 text-white flex items-center gap-2.5">
            <span>Matrice Comparative Multi-Enseignes</span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
              PRO
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Surveillance des prix unitaires réels (€/kg, €/L) par enseigne, détection des remises et optimisation du panier.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsManualModalOpen(true)}
            className="text-xs gap-1.5 h-9 bg-white/5 hover:bg-white/10 border-white/15 text-slate-200"
          >
            <FileSpreadsheet size={14} className="text-cyan-400" />
            <span>Saisie manuelle</span>
          </Button>

          <Button
            size="sm"
            onClick={scrollToUpload}
            className="text-xs font-bold gap-1.5 h-9 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20 cursor-pointer"
          >
            <Plus size={14} />
            <span>Scanner un ticket</span>
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SECTION TÉLÉVERSEMENT DU TICKET DE CAISSE (HERO UPLOAD STITCH)          */}
      {/* ========================================================================= */}
      <div ref={uploadSectionRef} id="receipt-upload-section" className="relative">
        <div className="glass-surface rounded-3xl p-5 sm:p-7 relative overflow-hidden group border border-white/10 shadow-2xl">
          {/* Laser Sweep Effect */}
          <div className="scanner-laser" />

          {/* Hidden inputs */}
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
          <input
            ref={cameraInputRef}
            type="file"
            id="receipt-camera-input"
            className="hidden"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                addFilesToSelection(e.target.files);
              }
            }}
          />

          <div
            className={cn(
              "flex flex-col items-center justify-center p-6 sm:p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300 text-center relative",
              isDragging
                ? "border-cyan-400 bg-cyan-500/10 scale-[0.99]"
                : "border-white/15 hover:border-cyan-400/50 hover:bg-white/[0.03]"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {/* Neomorphic AI Camera Icon */}
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-cyan-500/20 via-blue-500/20 to-purple-500/20 border border-cyan-400/30 text-cyan-400 flex items-center justify-center mb-3 shadow-[0_0_20px_rgba(56,189,248,0.25)] group-hover:scale-110 transition-transform duration-300">
              <Camera size={30} className="stroke-[2.2]" />
            </div>

            <h3 className="text-base sm:text-lg font-black text-white">
              Déposez vos tickets de caisse ou photographiez
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md">
              Pour les longs tickets, prenez plusieurs photos successives. Google Gemini Flash réassemble le tout instantanément sans doublon.
            </p>

            {/* Boutons d'action internes au Hero */}
            <div className="mt-4 flex items-center gap-2 flex-wrap justify-center" onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                variant="outline"
                onClick={() => cameraInputRef.current?.click()}
                className="h-8 text-xs font-bold gap-1.5 bg-white/10 hover:bg-white/15 border-white/20 text-white rounded-xl"
              >
                <Camera size={13} className="text-cyan-400" />
                <span>Prendre une photo</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 text-xs font-bold gap-1.5 bg-white/10 hover:bg-white/15 border-white/20 text-white rounded-xl"
              >
                <UploadCloud size={13} className="text-cyan-400" />
                <span>Parcourir les fichiers</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsManualModalOpen(true)}
                className="h-8 text-xs font-medium gap-1 text-slate-400 hover:text-white rounded-xl"
              >
                <FileSpreadsheet size={13} />
                <span>Saisie manuelle</span>
              </Button>
            </div>

            {/* Badges descriptifs */}
            <div className="mt-4 flex items-center gap-2 flex-wrap justify-center">
              <span className="glass-pill text-[11px] text-slate-300">
                JPG, PNG, WEBP, PDF
              </span>
              <span className="glass-pill text-[11px] text-cyan-400 font-semibold flex items-center gap-1 border-cyan-500/30">
                <Zap size={11} className="fill-cyan-400" />
                Compression PNG auto
              </span>
              <span className="glass-pill text-[11px] text-purple-300 font-semibold border-purple-500/30">
                Multi-fragments supporté
              </span>
              <span className="glass-pill text-[11px] text-emerald-400 font-semibold border-emerald-500/30">
                Audit & validation stricts
              </span>
            </div>
          </div>

          {/* MINIATURES DES FICHIERS SÉLECTIONNÉS */}
          {selectedFiles.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-white/10 mt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers size={14} className="text-cyan-400" />
                  <span className="text-xs font-bold text-white">
                    Fragments prêts à l'analyse ({selectedFiles.length} cliché{selectedFiles.length > 1 ? 's' : ''})
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFiles}
                  className="h-7 text-[11px] text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 px-2"
                >
                  Tout effacer
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {selectedFiles.map((fileItem, index) => (
                  <div
                    key={fileItem.id}
                    className="relative group rounded-2xl overflow-hidden border border-white/10 bg-slate-900/60 p-2 shadow-md"
                  >
                    <div className="w-full h-24 rounded-xl bg-slate-950 flex items-center justify-center overflow-hidden mb-1.5 relative">
                      {fileItem.isPdf ? (
                        <div className="flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                          <FileText size={28} className="text-rose-400 mb-1" />
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
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-black/80 text-white text-[9px] font-mono font-bold">
                        #{index + 1}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] mt-1">
                      <span className="font-medium text-slate-200 truncate max-w-[80px]" title={fileItem.name}>
                        {fileItem.name}
                      </span>
                      {fileItem.isOptimizing ? (
                        <span className="text-[9px] text-cyan-400 font-medium flex items-center gap-1 animate-pulse">
                          <Loader2 size={9} className="animate-spin" />
                          Optimisation...
                        </span>
                      ) : fileItem.reductionPercentage && fileItem.reductionPercentage > 0 ? (
                        <span
                          className="text-[9px] font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded flex items-center gap-0.5"
                          title={`Taille allégée de ${fileItem.sizeFormatted} à ${fileItem.optimizedSizeFormatted} (-${fileItem.reductionPercentage}%)`}
                        >
                          <Zap size={9} className="text-emerald-400 fill-emerald-400" />
                          -{fileItem.reductionPercentage}%
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono">
                          {fileItem.sizeFormatted}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={(e) => removeFile(fileItem.id, e)}
                      className="absolute top-3 right-3 p-1 rounded-full bg-black/70 text-white hover:bg-rose-500 transition-colors shadow-sm"
                      title="Supprimer ce cliché"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <p className="text-xs text-slate-400">
                  Cliquez sur le bouton ci-contre pour lancer la lecture des lignes d'articles par l'IA.
                </p>
                <Button
                  onClick={handleLaunchExtraction}
                  disabled={isAnalyzing}
                  className="gap-2 text-xs font-black shadow-lg shadow-cyan-500/25 h-10 px-5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl cursor-pointer"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 size={14} className="animate-spin text-white" />
                      <span>Extraction IA en cours...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} className="text-cyan-200" />
                      <span>Extraire les articles ({selectedFiles.length})</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BANNIÈRE D'EXTRACTION IA EN COURS */}
      {isAnalyzing && (
        <div className="glass-surface border border-cyan-500/40 bg-cyan-500/10 rounded-2xl p-4 sm:p-5 flex items-center gap-4 animate-pulse">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
            <Loader2 size={24} className="animate-spin text-cyan-400" />
          </div>
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">
                Extraction IA multimodale en cours...
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Google Gemini Flash (Gratuit)
              </span>
            </div>
            <p className="text-xs text-slate-300">
              {analysisProgress || "Gemini extrait les articles, montants, et affecte automatiquement les rayons standardisés..."}
            </p>
          </div>
        </div>
      )}

      {/* BANNIÈRE TICKET EN ATTENTE DE VALIDATION */}
      {pendingValidationReceipt && !isAnalyzing && (
        <div className="glass-surface border border-amber-500/40 bg-amber-500/10 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-amber-400 animate-pulse shrink-0 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
            <div>
              <p className="text-xs sm:text-sm font-bold text-white">
                Ticket « {pendingValidationReceipt.storeName} » ({pendingValidationReceipt.items.length} articles, {formatCurrency(pendingValidationReceipt.totalAmount, { showSign: false })}) en attente de validation
              </p>
              <p className="text-[11px] text-slate-300">
                Vos données extraites sont conservées intactes en mémoire locale.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <Button
              size="sm"
              onClick={() => setIsValidationModalOpen(true)}
              className="h-8 text-xs font-bold gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl shadow-md cursor-pointer"
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
              className="h-8 text-[11px] text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border-white/10 rounded-xl"
            >
              Ignorer
            </Button>
          </div>
        </div>
      )}

      {/* MESSAGE D'ERREUR */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-start justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-start gap-2.5">
            <AlertCircle size={17} className="shrink-0 mt-0.5 text-rose-400" />
            <div className="whitespace-pre-line leading-relaxed font-medium">{errorMessage}</div>
          </div>
          <button 
            onClick={() => setErrorMessage(null)}
            className="p-1 hover:bg-rose-500/20 rounded-md transition-colors shrink-0 text-rose-300"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* NAVIGATION PAR ONGLETS (APPLE VISIONOS STYLE) & SÉLECTEUR DE VUE          */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Apple visionOS Segmented Control */}
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-md w-full sm:w-fit overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('matrix')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
              activeTab === 'matrix'
                ? "bg-white/15 text-white shadow-md border border-white/20 font-black"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            )}
          >
            <Table size={14} className={activeTab === 'matrix' ? "text-cyan-400" : ""} />
            <span>Matrice Comparative ({allStores.length} magasins)</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
              activeTab === 'history'
                ? "bg-white/15 text-white shadow-md border border-white/20 font-black"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            )}
          >
            <History size={14} className={activeTab === 'history' ? "text-cyan-400" : ""} />
            <span>Historique des Tickets ({receipts.length})</span>
          </button>
        </div>

        {/* View Switcher: Cartes Liquid Glass vs Tableau Croisé */}
        {activeTab === 'matrix' && (
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-md self-start sm:self-auto">
            <button
              onClick={() => setViewMode('cards')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                viewMode === 'cards'
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
              title="Vue Cartes Liquid Glass (Google Stitch)"
            >
              <LayoutGrid size={13} />
              <span>Cartes Stitch</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                viewMode === 'table'
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
              title="Vue Tableau Croisé classique"
            >
              <Table size={13} />
              <span>Tableau Croisé</span>
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. MATRICE COMPARATIVE (GOOGLE STITCH CARTES & TABLEAU CROISÉ)            */}
      {/* ========================================================================= */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          
          {/* BARRE DE FILTRES EN CAPSULES (STITCH STYLE) */}
          <div className="glass-surface rounded-2xl p-3.5 sm:p-4 border border-white/10 space-y-3 shadow-lg">
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* RECHERCHE */}
              <div className="relative flex-1 max-w-md">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Rechercher un produit (ex: Saumon, Sauce burger, Lait)..."
                  className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-white/15 bg-white/5 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 font-medium"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* CONTRÔLES : SÉLECTEUR DE RAYON, PROMOS, MASQUER UNIQUE, HARMONISER */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* SÉLECTEUR DE RAYON */}
                <select
                  value={selectedAisleFilter}
                  onChange={(e) => setSelectedAisleFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl border border-white/15 bg-slate-900/90 text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-400 font-medium"
                >
                  <option value="ALL">Tous les rayons ({SUPERMARKET_AISLES.length})</option>
                  {SUPERMARKET_AISLES.map(aisle => (
                    <option key={aisle} value={aisle}>{aisle}</option>
                  ))}
                </select>

                {/* FILTRE PROMOS */}
                <button
                  type="button"
                  onClick={() => setShowPromosOnly(!showPromosOnly)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer shadow-sm",
                    showPromosOnly
                      ? "bg-amber-500/25 border-amber-500/50 text-amber-300 ring-1 ring-amber-500/40"
                      : "bg-white/5 hover:bg-white/10 text-slate-300 border-white/10"
                  )}
                  title={showPromosOnly ? "Afficher tous les articles" : "Filtrer uniquement les articles ayant une remise ou promo"}
                >
                  <Zap size={13} className={showPromosOnly ? "text-amber-400 fill-amber-400" : "text-amber-400"} />
                  <span>Promos</span>
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold",
                    showPromosOnly ? "bg-amber-500/40 text-amber-200" : "bg-white/10 text-slate-400"
                  )}>
                    {totalPromosCount}
                  </span>
                </button>

                {/* FILTRE PRODUITS COMPARABLES SEULEMENT */}
                <button
                  type="button"
                  onClick={() => setHideUncomparable(!hideUncomparable)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer shadow-sm",
                    hideUncomparable
                      ? "bg-emerald-500/25 border-emerald-500/50 text-emerald-300 ring-1 ring-emerald-500/40"
                      : "bg-white/5 hover:bg-white/10 text-slate-300 border-white/10"
                  )}
                  title={hideUncomparable ? "Afficher tous les produits" : "Masquer les produits présents dans un seul magasin"}
                >
                  {hideUncomparable ? <Eye size={13} className="text-emerald-400" /> : <EyeOff size={13} />}
                  <span>{hideUncomparable ? "Tous les produits" : "Comparer uniquement"}</span>
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold",
                    hideUncomparable ? "bg-emerald-500/40 text-emerald-200" : "bg-white/10 text-slate-400"
                  )}>
                    {hideUncomparable ? `${totalComparableCount}` : `${totalUniqueCount}`}
                  </span>
                </button>

                {/* HARMONISER & DOUBLONS FIRESTORE */}
                <button
                  type="button"
                  onClick={handleHarmonizeDatabase}
                  disabled={isHarmonizing}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer shadow-sm",
                    "bg-cyan-500/15 hover:bg-cyan-500/25 border-cyan-500/40 text-cyan-300 disabled:opacity-50"
                  )}
                  title="Consolider les doublons et nettoyer les lignes fantômes dans Firestore (Batch 100% gratuit)"
                >
                  {isHarmonizing ? (
                    <Loader2 size={13} className="animate-spin text-cyan-400" />
                  ) : (
                    <Sparkles size={13} className="text-cyan-400" />
                  )}
                  <span>{isHarmonizing ? "Harmonisation..." : "✨ Harmoniser & Doublons"}</span>
                </button>
              </div>
            </div>

            {/* PILLULES DE FILTRE PAR MAGASIN PHYSIQUE (STITCH PILLS) */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2 border-t border-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 mr-1">
                Magasins :
              </span>
              <button
                type="button"
                onClick={() => setSelectedStoreFilter('ALL')}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer border",
                  selectedStoreFilter === 'ALL'
                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm"
                    : "glass-pill text-slate-300 hover:text-white"
                )}
              >
                Toutes les enseignes ({allStores.length})
              </button>
              {allStores.map(st => {
                const isSelected = selectedStoreFilter === st.displayName;
                const dotColor = getStoreDotColor(st.displayName);
                return (
                  <button
                    key={st.displayName}
                    type="button"
                    onClick={() => setSelectedStoreFilter(isSelected ? 'ALL' : st.displayName)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer border",
                      isSelected
                        ? "bg-cyan-500/25 text-white border-cyan-400 shadow-sm"
                        : "glass-pill text-slate-300 hover:text-white"
                    )}
                  >
                    <span className={cn("w-2 h-2 rounded-full", dotColor)} />
                    <span>{st.displayName}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {harmonizeFeedback && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
              <span>{harmonizeFeedback}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* OPTION 1 : VUE EN CARTES HORIZONTALES LIQUID GLASS (STITCH DÉFAUT)          */}
          {/* ========================================================================= */}
          {viewMode === 'cards' && (
            <div className="space-y-3">
              {paginatedRows.length === 0 ? (
                <div className="glass-surface rounded-3xl p-12 text-center text-slate-400 border border-white/10">
                  <Package size={36} className="mx-auto mb-3 opacity-40 text-cyan-400" />
                  <p className="font-bold text-white text-base">Aucun produit ne correspond à vos filtres.</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {hideUncomparable
                      ? "Désactivez 'Comparer uniquement' pour réafficher tous les articles uniques."
                      : "Importez d'autres tickets ou ajustez vos critères de recherche."}
                  </p>
                </div>
              ) : (
                paginatedRows.map((row) => (
                  <div
                    key={row.cleBesoin || row.nomGenerique}
                    className="glass-surface rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-all hover:border-cyan-400/40 relative border border-white/10 shadow-lg group"
                  >
                    {/* COLONNE GAUCHE : EMOJI INTELLIGENT, NOM GÉNÉRIQUE & BADGES */}
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                        {getProductEmoji(row.nomGenerique, row.rayon)}
                      </div>

                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-white text-sm sm:text-base tracking-tight leading-snug">
                            {correctFrenchSpelling(row.nomGenerique)}
                          </h4>
                          <span className="glass-pill text-[10px] text-cyan-300 font-mono font-bold">
                            {row.dominantUnit || 'Format standard'}
                          </span>
                          <span className="glass-pill text-[10px] text-slate-300 font-medium">
                            {row.rayon}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {row.isComparable ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono">
                              <span>{row.storeCount} enseignes comparées</span>
                              {row.priceDiff > 0 && (
                                <span>• Écart : -{row.priceDiffPercent}% (+{formatCurrency(row.priceDiff, { showSign: false })})</span>
                              )}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10 font-mono">
                              1 enseigne (Unique)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* COLONNE CENTRALE / DROITE : PILLULES DE PRIX PAR MAGASIN */}
                    <div className="flex items-center gap-3 self-stretch lg:self-auto justify-between lg:justify-end">
                      <div className="flex flex-wrap items-center gap-2 justify-start lg:justify-end flex-1">
                        {allStores.map(st => {
                          const offer = row.storeOffers[st.displayName];
                          if (!offer) {
                            return (
                              <div
                                key={st.displayName}
                                className="flex flex-col items-center justify-center px-2.5 py-1.5 rounded-xl border border-white/5 bg-white/[0.02] text-slate-500 opacity-40 text-center select-none"
                              >
                                <div className="flex items-center gap-1 text-[9px] font-bold">
                                  <span className={cn("w-1.5 h-1.5 rounded-full", getStoreDotColor(st.displayName))} />
                                  <span>{st.displayName}</span>
                                </div>
                                <span className="font-mono text-xs mt-0.5">—</span>
                              </div>
                            );
                          }

                          const isCheapestInRow = row.isComparable && offer.prixUnitaire === row.lowestPrice;

                          return (
                            <div
                              key={st.displayName}
                              className={cn(
                                "flex flex-col items-center justify-center px-3 py-1.5 rounded-xl border transition-all cursor-pointer group/pill text-center select-none relative",
                                isCheapestInRow
                                  ? "glass-glow-emerald border-emerald-500/50 bg-emerald-500/15 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400/40"
                                  : "glass-pill text-slate-200 border-white/15 hover:border-white/30"
                              )}
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
                              title="Survolez ou touchez pour afficher l'infobulle détaillée"
                            >
                              {/* Nom enseigne */}
                              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold mb-0.5">
                                <span className={cn("w-1.5 h-1.5 rounded-full", getStoreDotColor(st.displayName))} />
                                <span>{st.displayName}</span>
                              </div>

                              {/* Prix d'origine barré si promo */}
                              {offer.isPromo && offer.initialUnitPrice && offer.initialUnitPrice > offer.prixUnitaire && (
                                <span className="text-[9px] font-mono text-slate-400 line-through leading-none">
                                  {formatCurrency(offer.initialUnitPrice, { showSign: false })}
                                </span>
                              )}

                              {/* Prix unitaire (€/kg ou €/L) en grand */}
                              <div className={cn(
                                "font-black font-mono text-sm sm:text-base flex items-baseline justify-center gap-0.5 tracking-tight",
                                isCheapestInRow ? "text-emerald-300 font-extrabold" : "text-white"
                              )}>
                                <span>{formatCurrency(offer.prixUnitaire, { showSign: false })}</span>
                                <span className="text-[10px] font-bold text-slate-400">
                                  /{offer.unite}
                                </span>
                              </div>

                              {/* Prix payé du pack en discret */}
                              <span className="text-[10px] text-slate-400 font-mono leading-none">
                                ({formatCurrency(offer.prixPaye, { showSign: false })})
                              </span>

                              {/* Badges Promo & Moins cher */}
                              <div className="flex items-center gap-1 mt-1">
                                {offer.isPromo && (
                                  <span className="inline-flex items-center gap-0.5 text-[8px] font-black px-1.5 py-0.2 rounded-md bg-amber-500/25 text-amber-300 border border-amber-500/40">
                                    <Zap size={7} className="fill-amber-400" />
                                    -{offer.discountRate || Math.round(((offer.discountAmount || 0) / (offer.initialPrice || 1)) * 100)}%
                                  </span>
                                )}
                                {isCheapestInRow && (
                                  <span className="inline-flex items-center gap-0.5 text-[8px] font-black px-1.5 py-0.2 rounded-md bg-emerald-500/25 text-emerald-300 border border-emerald-500/40">
                                    <Check size={8} className="stroke-[3]" />
                                    Moins cher
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* MENU D'OPTIONS (...) */}
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuProduct(activeMenuProduct === row.nomGenerique ? null : row.nomGenerique);
                          }}
                          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                          title="Options de l'article"
                        >
                          <MoreHorizontal size={16} />
                        </button>

                        {activeMenuProduct === row.nomGenerique && (
                          <div className="absolute right-0 top-12 z-30 w-52 p-1.5 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-white/15 shadow-2xl space-y-1">
                            {row.sampleRawRow && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedProductForEvolution(row.sampleRawRow || null);
                                  setActiveMenuProduct(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-cyan-300 hover:bg-cyan-500/15 transition-colors text-left cursor-pointer"
                              >
                                <TrendingUp size={14} className="text-cyan-400" />
                                <span>Courbe d'évolution</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setProductToDelete(row.nomGenerique);
                                setActiveMenuProduct(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-300 hover:text-rose-200 hover:bg-rose-500/15 transition-colors text-left cursor-pointer"
                            >
                              <Trash2 size={14} className="text-rose-400" />
                              <span>Masquer du comparatif</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* OPTION 2 : VUE EN TABLEAU CROISÉ AVANCÉ (AVEC GROUPES DE RAYONS)          */}
          {/* ========================================================================= */}
          {viewMode === 'table' && (
            <div className="rounded-2xl border border-white/15 bg-slate-900/60 overflow-hidden shadow-xl backdrop-blur-md">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px] text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4 w-[28%] min-w-[180px] font-bold">
                        Produit (Besoin & Rayon) ({filteredRows.length})
                      </th>

                      {allStores.map(st => (
                        <th key={st.displayName} className="py-3 px-3 text-center min-w-[130px] font-bold text-white">
                          <div className="flex flex-col items-center justify-center gap-1">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <span className={cn("w-2 h-2 rounded-full", getStoreDotColor(st.displayName))} />
                              <span className="font-extrabold text-xs" title={st.displayName}>{st.displayName}</span>
                              {st.googleMapsUrl && (
                                <a
                                  href={st.googleMapsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-slate-400 hover:text-cyan-400 transition-colors p-0.5"
                                  title="Ouvrir sur Google Maps"
                                >
                                  <ExternalLink size={10} />
                                </a>
                              )}
                            </div>
                            {st.address && (
                              <span className="text-[9px] font-normal text-slate-400 truncate max-w-[120px]" title={st.address}>
                                {st.address}
                              </span>
                            )}
                          </div>
                        </th>
                      ))}

                      <th className="py-3 px-3 text-right w-[15%] min-w-[110px] font-bold">
                        Écart Audit
                      </th>
                      <th className="py-3 px-2 text-center w-[6%] font-bold">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-white/5 text-xs">
                    {groupedAisles.length === 0 ? (
                      <tr>
                        <td colSpan={allStores.length + 3} className="py-12 text-center text-slate-400">
                          <Package size={28} className="mx-auto mb-2 opacity-40 text-cyan-400" />
                          <p className="font-semibold text-white">Aucun produit ne correspond à vos filtres.</p>
                          <p className="text-[11px] mt-0.5">
                            {hideUncomparable ? "Désactivez 'Comparer uniquement' pour revoir tous les articles." : "Importez d'autres tickets pour enrichir le comparatif."}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      groupedAisles.map(group => (
                        <React.Fragment key={`aisle-group-${group.aisle}`}>
                          <tr className="bg-white/5 border-y border-white/10 sticky top-0 z-10 backdrop-blur-md">
                            <td colSpan={allStores.length + 3} className="py-2.5 px-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                                  <span className="font-black text-xs uppercase tracking-wider text-cyan-300">
                                    {group.aisle}
                                  </span>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-mono">
                                  {group.rows.length} article{group.rows.length > 1 ? 's' : ''}
                                </span>
                              </div>
                            </td>
                          </tr>

                          {group.rows.map(row => (
                            <tr key={row.cleBesoin || row.nomGenerique} className="hover:bg-white/[0.03] transition-colors group">
                              <td className="py-3 px-4 sticky left-0 bg-slate-950/90 backdrop-blur-xs z-1 border-r border-white/10 max-w-[220px] align-middle">
                                <div className="flex items-center gap-2">
                                  <span className="text-base shrink-0">{getProductEmoji(row.nomGenerique, row.rayon)}</span>
                                  <span className="font-extrabold text-white text-xs sm:text-sm tracking-tight leading-snug">
                                    {correctFrenchSpelling(row.nomGenerique)}
                                  </span>
                                </div>
                              </td>

                              {allStores.map(st => {
                                const offer = row.storeOffers[st.displayName];
                                if (!offer) {
                                  return (
                                    <td key={st.displayName} className="py-3 px-3 text-center text-slate-600 font-mono text-xs align-middle">
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
                                      isCheapestInRow && "bg-emerald-500/10"
                                    )}
                                  >
                                    <div
                                      className="flex flex-col items-center justify-center cursor-pointer py-1.5 px-2 rounded-xl transition-all hover:bg-white/5 select-none group/cell"
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
                                    >
                                      {offer.isPromo && offer.initialUnitPrice && offer.initialUnitPrice > offer.prixUnitaire && (
                                        <span className="text-[10px] font-mono text-slate-400 line-through block leading-none mb-0.5">
                                          {formatCurrency(offer.initialUnitPrice, { showSign: false })}
                                        </span>
                                      )}

                                      <div className={cn(
                                        "font-black font-mono text-sm sm:text-base flex items-baseline justify-center gap-0.5 tracking-tight transition-transform duration-150 group-hover/cell:scale-105",
                                        isCheapestInRow ? "text-emerald-300 font-extrabold" : "text-white"
                                      )}>
                                        <span>{formatCurrency(offer.prixUnitaire, { showSign: false })}</span>
                                        <span className="text-[11px] font-bold text-slate-400">
                                          /{offer.unite}
                                        </span>
                                      </div>

                                      <div className="flex flex-wrap items-center justify-center gap-1 mt-0.5">
                                        {offer.isPromo && (
                                          <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                            <Zap size={8} className="fill-amber-400" />
                                            -{offer.discountRate || Math.round(((offer.discountAmount || 0) / (offer.initialPrice || 1)) * 100)}%
                                          </span>
                                        )}

                                        {isCheapestInRow && (
                                          <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                            <Check size={9} className="stroke-[3]" />
                                            Moins cher
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                );
                              })}

                              <td className="py-3 px-3 text-right align-top">
                                {row.isComparable ? (
                                  <div className="flex flex-col items-end">
                                    <span className="inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono">
                                      {row.storeCount} magasins
                                    </span>
                                    {row.priceDiff > 0 && (
                                      <span className="text-[10px] font-bold text-emerald-300 font-mono mt-1">
                                        -{row.priceDiffPercent}% (+{formatCurrency(row.priceDiff, { showSign: false })})
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-end">
                                    <span className="inline-flex items-center text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10">
                                      1 magasin
                                    </span>
                                    <span className="text-[9px] text-slate-400 mt-0.5">
                                      Unique
                                    </span>
                                  </div>
                                )}
                              </td>

                              <td className="py-3 px-2 text-center align-top">
                                <div className="flex items-center justify-center gap-1">
                                  {row.sampleRawRow && (
                                    <button
                                      type="button"
                                      onClick={() => setSelectedProductForEvolution(row.sampleRawRow || null)}
                                      className="p-1 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/15 transition-colors"
                                      title="Voir la courbe d'évolution du prix"
                                    >
                                      <TrendingUp size={13} />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setProductToDelete(row.nomGenerique)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 transition-colors"
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
          )}

          {/* ========================================================================= */}
          {/* BARRE FLOTTANTE INFÉRIEURE STITCH (TOTAL ÉCONOMIES & PANIER OPTIMAL)      */}
          {/* ========================================================================= */}
          {filteredRows.length > 0 && (
            <div className="fixed bottom-[4.75rem] md:bottom-4 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-4xl p-2.5 sm:p-3 rounded-2xl bg-slate-950/90 backdrop-blur-xl border border-white/15 shadow-2xl shadow-black/80 flex items-center justify-between gap-3 text-xs">
              {/* Économies potentielles détectées */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <TrendingDown size={16} />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-black text-emerald-400 font-mono text-sm sm:text-base">
                      -{formatCurrency(totalDetectedSavings, { showSign: false })}
                    </span>
                    <span className="text-[10px] font-bold text-slate-300 hidden sm:inline">
                      d'économies potentielles
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-400 hidden sm:inline">
                    Sur l'ensemble des articles comparables
                  </span>
                </div>
              </div>

              {/* Pagination minimalist Stitch */}
              {viewMode === 'cards' && totalPages > 1 && (
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-2.5 py-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1 text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer"
                    title="Page précédente"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="font-mono text-[11px] font-bold text-slate-200">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1 text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer"
                    title="Page suivante"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}

              {/* Bouton Panier Optimal CTA */}
              <Button
                onClick={() => setIsOptimalCartModalOpen(true)}
                className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-xs gap-1.5 rounded-xl shadow-lg shadow-emerald-500/25 h-9 px-3 sm:px-4 cursor-pointer"
              >
                <Navigation size={14} className="fill-slate-950" />
                <span className="hidden sm:inline">Créer mon panier optimal</span>
                <span className="sm:hidden">Panier optimal</span>
              </Button>
            </div>
          )}

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
          className="fixed z-[9999] pointer-events-none -translate-x-1/2 -translate-y-full mb-2.5 w-60 p-3.5 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-white/20 shadow-2xl shadow-black/80 text-xs animate-in fade-in zoom-in-95 duration-150 select-none text-slate-100"
          style={{
            left: `${floatingTooltip.x}px`,
            top: `${floatingTooltip.y - 8}px`
          }}
        >
          {/* En-tête : Nom du magasin & Badge Moins Cher */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 gap-1.5">
            <div className="flex items-center gap-1.5 truncate">
              <span className={cn("w-2 h-2 rounded-full shrink-0", getStoreDotColor(floatingTooltip.storeName))} />
              <span className="font-black text-xs text-white truncate" title={floatingTooltip.storeName}>
                {floatingTooltip.storeName}
              </span>
            </div>
            {floatingTooltip.isCheapest && (
              <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shrink-0">
                ★ Moins cher
              </span>
            )}
          </div>

          {/* Corps de l'infobulle : Détails stricts stockés dans Firestore */}
          <div className="space-y-1.5 text-[11px]">
            {/* ENCART PROMOTION SI ACTIVE */}
            {floatingTooltip.offer.is_promo || floatingTooltip.offer.isPromo ? (
              <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 space-y-1 mb-1.5">
                <div className="flex items-center justify-between font-bold text-[10px]">
                  <span className="flex items-center gap-1">
                    <Zap size={10} className="fill-amber-400 shrink-0" />
                    Offre Promotionnelle :
                  </span>
                  <span>
                    -{floatingTooltip.offer.taux_remise || floatingTooltip.offer.discountRate || Math.round((((floatingTooltip.offer.remise || floatingTooltip.offer.discountAmount) || 0) / (floatingTooltip.offer.prix_brut || floatingTooltip.offer.initialPrice || 1)) * 100)}%
                  </span>
                </div>
                {Boolean(floatingTooltip.offer.remise || floatingTooltip.offer.discountAmount) && (
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-300">Remise appliquée :</span>
                    <span className="font-mono font-bold text-amber-300">
                      -{formatCurrency(floatingTooltip.offer.remise || floatingTooltip.offer.discountAmount || 0, { showSign: false })}
                    </span>
                  </div>
                )}
                {(floatingTooltip.offer.prix_base_unitaire || floatingTooltip.offer.initialUnitPrice) && (
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-300">Base hors remise :</span>
                    <span className="font-mono line-through text-slate-400">
                      {formatCurrency(floatingTooltip.offer.prix_base_unitaire || floatingTooltip.offer.initialUnitPrice, { showSign: false })}/{floatingTooltip.offer.unite}
                    </span>
                  </div>
                )}
                {(floatingTooltip.offer.motif_remise || floatingTooltip.offer.discountType) && (
                  <div className="text-[9px] text-slate-300 italic truncate">
                    Motif : {floatingTooltip.offer.motif_remise || floatingTooltip.offer.discountType}
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Prix payé :</span>
              <span className="font-mono font-bold text-white">
                {formatCurrency(floatingTooltip.offer.prixPaye, { showSign: false })}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Quantité :</span>
              <span className="font-mono font-semibold text-white">
                {floatingTooltip.offer.format || '1 pièce'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Marque :</span>
              <span className="font-semibold text-white truncate max-w-[110px]" title={floatingTooltip.offer.marque}>
                {floatingTooltip.offer.marque || 'Générique'}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-white/10">
              <span className="text-slate-400 font-medium">Date :</span>
              <span className="font-mono text-slate-300">
                {formatDateFR(floatingTooltip.offer.date)}
              </span>
            </div>
          </div>

          {/* Flèche pointant vers la cellule de prix */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-900/95" />
        </div>
      )}

      {/* MODALE DU PANIER OPTIMAL (MULTI-ENSEIGNES & ÉCONOMIES MAXIMALES) */}
      <OptimalCartModal
        isOpen={isOptimalCartModalOpen}
        onClose={() => setIsOptimalCartModalOpen(false)}
        rows={crossTableRows}
      />

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
