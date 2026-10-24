import React, { useState, useRef, useEffect } from 'react';
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
  MapPin
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/utils';
import { formatCurrency } from '../../lib/bankUtils';
import { useReceipts } from '../../context/ReceiptsContext';
import { type ReceiptItem, type SupermarketAisle } from '../../types/receipts';
import { ComparisonMatrixView } from './components/ComparisonMatrixView';
import { ReceiptHistoryView } from './components/ReceiptHistoryView';
import { ReceiptValidationModal } from './components/ReceiptValidationModal';
import { ManualReceiptModal } from './components/ManualReceiptModal';
import { SpendingChartsView } from './components/SpendingChartsView';
import { WhereToBuySection } from './components/WhereToBuySection';
import { TARGET_PHYSICAL_STORES } from '../../lib/storeRegistry';

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
    matrix,
    hiddenProductNames,
    isAnalyzing,
    analysisProgress,
    isRealtimeSynced,
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

  // Modale de saisie manuelle 100% hors-ligne
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(true);
  const [selectedAisleFocus, setSelectedAisleFocus] = useState<string | null>(null);

  useEffect(() => {
    if (pendingValidationReceipt) {
      setIsValidationModalOpen(true);
    }
  }, [pendingValidationReceipt]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Nettoyage des URL d'aperçu d'images lors du démontage
  useEffect(() => {
    return () => {
      selectedFiles.forEach(f => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
    };
  }, [selectedFiles]);

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

  /**
   * Lance l'extraction IA via Google Gemini Flash (Palier 100% gratuit).
   * À la fin de l'extraction, les données sont persistées dans le Context/LocalStorage
   * garantissant zéro perte lors de la navigation entre onglets !
   */
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

  /**
   * Enregistre définitivement le ticket validé par l'utilisateur
   */
  const handleSaveValidatedReceipt = async (validatedData: {
    storeName: string;
    storeId?: string;
    storeAddress?: string;
    storeCity?: string;
    storePostalCode?: string;
    googleMapsUrl?: string;
    date: string;
    time?: string;
    totalArticles?: number;
    subtotal?: number;
    totalDiscounts?: number;
    totalAmount: number;
    items: ReceiptItem[];
    rawFileCount?: number;
  }) => {
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

    setActiveTab('matrix'); // Redirection immédiate vers la matrice comparative mise à jour
  };

  /**
   * Enregistrement d'un ticket saisi manuellement
   */
  const handleSaveManualReceipt = async (data: {
    storeName: string;
    storeId?: string;
    storeAddress?: string;
    storeCity?: string;
    storePostalCode?: string;
    googleMapsUrl?: string;
    date: string;
    time?: string;
    totalArticles?: number;
    subtotal?: number;
    totalDiscounts?: number;
    totalAmount: number;
    items: ReceiptItem[];
  }) => {
    await addReceipt({
      storeName: data.storeName,
      storeId: data.storeId,
      storeAddress: data.storeAddress,
      storeCity: data.storeCity,
      storePostalCode: data.storePostalCode,
      googleMapsUrl: data.googleMapsUrl,
      date: data.date,
      time: data.time,
      totalArticles: data.totalArticles,
      subtotal: data.subtotal,
      totalDiscounts: data.totalDiscounts,
      totalAmount: data.totalAmount,
      items: data.items,
      rawFileCount: 0
    });

    setIsManualModalOpen(false);
    setActiveTab('matrix');
  };

  return (
    <div className="p-3 sm:p-5 md:p-8 max-w-6xl mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-500 pb-28 md:pb-12">
      
      {/* HEADER SECTION AVEC DESIGN DNA GOOGLE STITCH */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-border/70 pb-3.5 sm:pb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Audit Alimentaire & Grande Distribution
            </span>

            {/* BADGE SYNCHRONISATION EN DIRECT PC & MOBILE */}
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

        {/* BOUTONS D'ACTION RAPIDE */}
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
            onClick={() => setActiveTab('upload')}
            className="text-xs font-bold gap-1.5 h-8 sm:h-9 shadow-md"
          >
            <Plus size={14} />
            <span>Scanner un ticket</span>
          </Button>
        </div>
      </div>

      {/* BANNIÈRE D'EXTRACTION IA EN COURS (PERSISTANTE EN ARRIÈRE-PLAN) */}
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
              <p className="text-[11px] text-cyan-600 dark:text-cyan-400/90 font-medium pt-0.5">
                💡 Vous pouvez basculer vers un autre onglet, l'extraction continue et vous pourrez valider les données à votre retour !
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* BANNIÈRE TICKET ANALYSÉ EN ATTENTE DE VALIDATION (PERSISTANT INTER-ONGLETS) */}
      {pendingValidationReceipt && !isAnalyzing && (
        <Card className="border-amber-500/40 bg-amber-500/10 backdrop-blur-md shadow-sm">
          <CardContent className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <div>
                <p className="text-xs font-bold text-foreground">
                  Ticket « {pendingValidationReceipt.storeName} » ({pendingValidationReceipt.items.length} articles, {formatCurrency(pendingValidationReceipt.totalAmount, { showSign: false })}) en attente de votre validation
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Vos données extraites sont conservées intactes même si vous changez d'onglet ou quittez l'application.
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

      {/* ========================================================================= */}
      {/* AUDIT VISUEL DES DÉPENSES : GRAPHIQUE DONUT & BÂTONS (RÈGLE 6)            */}
      {/* ========================================================================= */}
      {receipts.length > 0 && (
        <SpendingChartsView receipts={receipts} />
      )}

      {/* ========================================================================= */}
      {/* OÙ ACHETER QUOI ? RECOMMANDATIONS ÉCONOMIQUES PAR CATÉGORIE              */}
      {/* ========================================================================= */}
      {receipts.length > 0 && (
        <WhereToBuySection 
          receipts={receipts}
          matrix={matrix}
          onSelectAisle={(aisle) => {
            setSelectedAisleFocus(aisle);
            setActiveTab('matrix');
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* BANDEAU DES 3 MAGASINS INTERMARCHÉ CIBLÉS (DIFFÉRENCIATION GÉOGRAPHIQUE)  */}
      {/* ========================================================================= */}
      <div className="p-3 sm:p-3.5 rounded-2xl bg-card/80 dark:bg-card/50 backdrop-blur-md border border-border/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <Store size={16} />
          </div>
          <div>
            <span className="text-xs font-black text-foreground block">
              Comparateur Localisé des 3 Intermarché
            </span>
            <span className="text-[11px] text-muted-foreground block">
              Chaque magasin physique est comparé dans une colonne distincte avec son lien Google Maps.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            TARGET_PHYSICAL_STORES.intermarche_gaillard,
            TARGET_PHYSICAL_STORES.intermarche_annemasse,
            TARGET_PHYSICAL_STORES.intermarche_ville_la_grand
          ].map(st => (
            <a
              key={st.id}
              href={st.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] sm:text-[11px] font-bold bg-secondary/80 hover:bg-secondary text-foreground border border-border/80 hover:border-primary/40 transition-all shadow-2xs group"
              title={`Ouvrir ${st.googleMapsName} sur Google Maps (${st.address})`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span>{st.displayName}</span>
              <ExternalLink size={10} className="text-muted-foreground group-hover:text-primary transition-colors" />
            </a>
          ))}
        </div>
      </div>

      {/* NAVIGATION PAR ONGLETS (STYLE APPLE GLASS & HARMONYOS) */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-secondary/50 border border-border/70 w-full sm:w-fit overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('matrix')}
          className={cn(
            "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
            activeTab === 'matrix'
              ? "bg-card text-foreground shadow-sm border border-border/70"
              : "text-muted-foreground hover:text-foreground hover:bg-card/40"
          )}
        >
          <Table size={14} className={activeTab === 'matrix' ? "text-primary" : ""} />
          <span>Matrice Comparative ({matrix.stores.length} magasins)</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={cn(
            "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
            activeTab === 'history'
              ? "bg-card text-foreground shadow-sm border border-border/70"
              : "text-muted-foreground hover:text-foreground hover:bg-card/40"
          )}
        >
          <History size={14} className={activeTab === 'history' ? "text-primary" : ""} />
          <span>Historique des Tickets ({receipts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('upload')}
          className={cn(
            "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
            activeTab === 'upload'
              ? "bg-card text-foreground shadow-sm border border-border/70"
              : "text-muted-foreground hover:text-foreground hover:bg-card/40"
          )}
        >
          <Camera size={14} className={activeTab === 'upload' ? "text-primary" : ""} />
          <span>Scanner / Importer</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* VUE 1 : MATRICE COMPARATIVE : MAGASINS (COLONNES) VS PRODUITS (LIGNES)   */}
      {/* ========================================================================= */}
      {activeTab === 'matrix' && (
        <ComparisonMatrixView
          matrix={matrix}
          receipts={receipts}
          hiddenProductNames={hiddenProductNames}
          onHideProduct={hideProductFromMatrix}
          onRestoreProduct={restoreProductToMatrix}
          onOpenUpload={() => setActiveTab('upload')}
          selectedAisleFocus={selectedAisleFocus}
        />
      )}

      {/* ========================================================================= */}
      {/* VUE 2 : HISTORIQUE COMPLET DES TICKETS ENREGISTRÉS                       */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <ReceiptHistoryView
          receipts={receipts}
          onDeleteReceipt={deleteReceipt}
          onOpenUpload={() => setActiveTab('upload')}
        />
      )}

      {/* ========================================================================= */}
      {/* VUE 3 : IMPORTATION / SCAN AVEC TÉLÉVERSEMENT MULTIPLE                   */}
      {/* ========================================================================= */}
      {activeTab === 'upload' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <Card className="glass-card overflow-hidden border-border/80 dark:border-white/[0.08] shadow-sm">
            <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                  <Camera className="text-primary" size={18} />
                  Téléversement du ticket de caisse (Photo ou PDF)
                </CardTitle>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                  <Sparkles size={11} />
                  Google Gemini Flash (Gratuit)
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
                        className="group relative rounded-xl border border-border/80 dark:border-white/[0.08] bg-card overflow-hidden shadow-sm hover:border-primary/50 transition-all duration-200"
                      >
                        <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-md text-[10px] font-bold bg-background/90 backdrop-blur-sm text-foreground border border-border/60 shadow-xs">
                          Partie {index + 1}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => removeFile(fileItem.id, e)}
                          title="Supprimer cette photo"
                          className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-background/90 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 flex items-center justify-center border border-border/60 shadow-xs transition-colors"
                        >
                          <X size={12} />
                        </button>

                        <div className="h-28 bg-muted/40 flex items-center justify-center overflow-hidden">
                          {fileItem.isPdf ? (
                            <div className="flex flex-col items-center gap-1 text-muted-foreground">
                              <FileText size={32} className="text-red-500" />
                              <span className="text-[10px] font-mono uppercase font-bold">PDF</span>
                            </div>
                          ) : fileItem.previewUrl ? (
                            <img 
                              src={fileItem.previewUrl} 
                              alt={`Partie ${index + 1}`} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                            />
                          ) : (
                            <ImageIcon size={28} className="text-muted-foreground" />
                          )}
                        </div>

                        <div className="p-2 bg-card text-[11px] border-t border-border/60">
                          <p className="font-medium text-foreground truncate" title={fileItem.name}>
                            {fileItem.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {fileItem.sizeFormatted}
                          </p>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-full min-h-[140px] rounded-xl border border-dashed border-border/80 dark:border-white/[0.1] hover:border-primary/50 hover:bg-primary/5 flex flex-col items-center justify-center gap-2 p-4 text-muted-foreground hover:text-foreground transition-all duration-200"
                    >
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-primary">
                        <Plus size={16} />
                      </div>
                      <span className="text-xs font-semibold">Ajouter une photo</span>
                      <span className="text-[10px] text-muted-foreground">Suite du ticket</span>
                    </button>
                  </div>
                </div>
              )}

              {/* BOUTON D'ACTION PRINCIPAL */}
              <div className="pt-2">
                <Button 
                  onClick={handleLaunchExtraction} 
                  disabled={selectedFiles.length === 0 || isAnalyzing}
                  className="w-full h-11 text-sm font-bold shadow-md transition-all duration-300"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 size={16} className="mr-2 animate-spin" />
                      Extraction multimodale & classification des rayons en cours...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} className="mr-2 text-cyan-400" />
                      Lancer l'extraction IA {selectedFiles.length > 0 ? `(${selectedFiles.length} fichier${selectedFiles.length > 1 ? 's' : ''})` : ''}
                    </>
                  )}
                </Button>
              </div>

              {/* ASTUCE GUIDAGE AUDIT & PRÉ-VALIDATION */}
              <div className="p-3.5 rounded-xl bg-secondary/50 border border-border/60 flex items-start gap-2.5 text-xs text-muted-foreground leading-relaxed">
                <Info size={16} className="text-primary shrink-0 mt-0.5" />
                <span>
                  <strong>Procédure d'audit rigoureuse :</strong> Dès l'extraction terminée, une fenêtre de validation apparaîtra pour vous permettre de contrôler chaque ligne (prix unitaire, libellé normalisé et rayon de grande surface assigné) avant d'enregistrer le ticket.
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALE 1 : PRÉ-VALIDATION DES DONNÉES DU TICKET PAR L'UTILISATEUR         */}
      {/* ========================================================================= */}
      {pendingValidationReceipt && (
        <ReceiptValidationModal
          isOpen={Boolean(pendingValidationReceipt) && isValidationModalOpen}
          initialData={pendingValidationReceipt}
          existingReceipts={receipts}
          onCancel={() => setIsValidationModalOpen(false)}
          onSave={handleSaveValidatedReceipt}
        />
      )}

      {/* ========================================================================= */}
      {/* MODALE 2 : SAISIE MANUELLE 100% GRATUITE & HORS-LIGNE                     */}
      {/* ========================================================================= */}
      {isManualModalOpen && (
        <ManualReceiptModal
          isOpen={isManualModalOpen}
          existingReceipts={receipts}
          onClose={() => setIsManualModalOpen(false)}
          onSave={handleSaveManualReceipt}
        />
      )}

    </div>
  );
}
