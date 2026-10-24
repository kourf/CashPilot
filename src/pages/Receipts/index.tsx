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
  Package
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
  SUPERMARKET_AISLES,
  correctFrenchSpelling
} from '../../types/receipts';
import { ReceiptHistoryView } from './components/ReceiptHistoryView';
import { ReceiptValidationModal } from './components/ReceiptValidationModal';
import { ManualReceiptModal } from './components/ManualReceiptModal';
import { PriceEvolutionModal } from './components/PriceEvolutionModal';
import { DeleteConfirmDialog } from './components/DeleteConfirmDialog';
import { TARGET_PHYSICAL_STORES, resolvePhysicalStore } from '../../lib/storeRegistry';
import { AISLE_CONFIGS, normalizeStoreName } from '../../lib/receiptClassifier';

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
    extractReceipt
  } = useReceipts();

  // État du téléversement
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<UploadedFilePreview[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      return {
        id: `${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        file,
        previewUrl: isPdf ? '' : URL.createObjectURL(file),
        name: file.name,
        sizeFormatted: file.size > 1024 * 1024 
          ? `${(file.size / (1024 * 1024)).toFixed(1)} Mo` 
          : `${Math.round(file.size / 1024)} Ko`,
        isPdf
      };
    });

    setSelectedFiles(prev => [...prev, ...newPreviews]);
    setErrorMessage(null);
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
      const rawFiles = selectedFiles.map(f => f.file);
      await extractReceipt(rawFiles);
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

    // Priorité aux lignes de la matrice (enrichies avec historique, évolution et offres_magasins)
    const allMatrixProducts = matrix.aisleGroups.flatMap(g => g.products);

    allMatrixProducts.forEach(prod => {
      const lookupKey = prod.normalizedName.trim().toLowerCase();
      if (hiddenSet.has(lookupKey)) return;

      const storeOffers: Record<string, any> = {};
      const presentStores = Object.keys(prod.storePrices);
      const sampleBrands = new Set<string>();

      presentStores.forEach(sName => {
        const sp = prod.storePrices[sName];
        if (!storeMap.has(sName)) {
          const resolved = resolvePhysicalStore({ storeName: sName });
          storeMap.set(sName, {
            id: resolved.id,
            displayName: sName,
            googleMapsUrl: resolved.googleMapsUrl,
            address: resolved.address
          });
        }

        storeOffers[sName] = {
          prixUnitaire: sp.unitPrice,
          unite: sp.unit || prod.unit || 'kg',
          prixPaye: sp.pricePaid,
          marque: sp.brand || 'Générique',
          format: sp.weightOrVolume || '1 pièce',
          date: sp.date
        };

        if (sp.brand && sp.brand !== 'Générique') {
          sampleBrands.add(sp.brand);
        }
      });

      const storeCount = presentStores.length;
      const isComp = storeCount >= 2;
      const unitPrices = Object.values(storeOffers).map((o: any) => o.prixUnitaire);
      const lowestPrice = unitPrices.length > 0 ? Math.min(...unitPrices) : 0;
      const highestPrice = unitPrices.length > 0 ? Math.max(...unitPrices) : 0;
      const priceDiff = isComp ? Number((highestPrice - lowestPrice).toFixed(2)) : 0;
      const priceDiffPercent = isComp && highestPrice > 0 ? Math.round((priceDiff / highestPrice) * 100) : 0;
      
      const cheapestStoreEntry = Object.entries(storeOffers).find(([_, o]: any) => o.prixUnitaire === lowestPrice);
      const cheapestStore = cheapestStoreEntry ? cheapestStoreEntry[0] : '';

      rows.push({
        cleBesoin: prod.normalizedName.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        nomGenerique: prod.normalizedName,
        rayon: prod.category,
        storeOffers,
        storeCount,
        isComparable: isComp,
        lowestPrice,
        highestPrice,
        priceDiff,
        priceDiffPercent,
        cheapestStore,
        sampleBrands: Array.from(sampleBrands),
        sampleRawRow: prod
      });
    });

    const storesList = Array.from(storeMap.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
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

                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-medium text-foreground truncate max-w-[90px]" title={fileItem.name}>
                          {fileItem.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {fileItem.sizeFormatted}
                        </span>
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
            </div>
          </div>

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
                  {filteredRows.length === 0 ? (
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
                    filteredRows.map(row => (
                      <tr key={row.nomGenerique} className="hover:bg-secondary/20 transition-colors group">
                        
                        {/* EN LIGNE (ORDONNÉE) : NOM GÉNÉRIQUE & RAYON ASSIGNÉ */}
                        <td className="py-3 px-4 sticky left-0 bg-card/95 backdrop-blur-xs z-10 border-r border-border/40 max-w-[220px] align-top">
                          <div className="flex flex-col space-y-1">
                            <span className="font-extrabold text-foreground text-xs sm:text-sm tracking-tight leading-snug">
                              {correctFrenchSpelling(row.nomGenerique)}
                            </span>
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="inline-flex items-center text-[9px] font-semibold px-1.5 py-0.2 rounded bg-secondary text-muted-foreground border border-border/60">
                                {row.rayon}
                              </span>
                            </div>
                            {row.sampleBrands.length > 0 && (
                              <span className="text-[9px] text-primary/80 font-medium truncate">
                                Marque(s) : {row.sampleBrands.join(', ')}
                              </span>
                            )}
                          </div>
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
