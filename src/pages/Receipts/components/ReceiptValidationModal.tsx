import React, { useState } from 'react';
import { 
  X, 
  Store, 
  Calendar, 
  Clock,
  Plus, 
  Trash2, 
  Check, 
  AlertCircle, 
  Loader2,
  Tag,
  ShieldAlert,
  Percent
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { 
  type Receipt,
  type ReceiptItem, 
  type SupermarketAisle, 
  type SupermarketAisleKey, 
  SUPERMARKET_AISLES,
  getReceiptUniqueKey
} from '../../../types/receipts';
import { formatCurrency, formatDateFR } from '../../../lib/bankUtils';
import { AISLE_CONFIGS, computeUnitPrice, normalizeAisle, normalizeStoreName } from '../../../lib/receiptClassifier';

interface ReceiptValidationModalProps {
  isOpen: boolean;
  initialData: {
    storeName: string;
    date: string;
    time?: string;
    totalArticles?: number;
    subtotal?: number;
    totalDiscounts?: number;
    totalAmount: number;
    items: Array<{
      rawName: string;
      normalizedName: string;
      brand?: string;
      pricePaid?: number;
      price?: number;
      quantity?: number;
      weightOrVolume?: string;
      weightOrVolumeValue?: number;
      weightOrVolumeUnit?: string;
      unitPrice?: number;
      referenceUnitPrice?: number;
      category: SupermarketAisle | string;
      categoryKey?: SupermarketAisleKey;
      unit?: string;
    }>;
    rawFileCount?: number;
  };
  existingReceipts?: Receipt[];
  onCancel: () => void;
  onSave: (validatedData: {
    storeName: string;
    date: string;
    time?: string;
    totalArticles?: number;
    subtotal?: number;
    totalDiscounts?: number;
    totalAmount: number;
    items: ReceiptItem[];
    rawFileCount?: number;
  }) => Promise<void>;
}

export const ReceiptValidationModal: React.FC<ReceiptValidationModalProps> = ({
  isOpen,
  initialData,
  existingReceipts = [],
  onCancel,
  onSave
}) => {
  const [storeName, setStoreName] = useState(normalizeStoreName(initialData.storeName || 'Supermarché'));
  const [date, setDate] = useState(initialData.date || new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(initialData.time || '');
  const [totalDiscounts, setTotalDiscounts] = useState(initialData.totalDiscounts || 0);
  const [totalAmount, setTotalAmount] = useState(initialData.totalAmount || 0);

  const [items, setItems] = useState<ReceiptItem[]>(() => {
    return (initialData.items || []).map((it, idx) => {
      const pricePaid = Number(it.pricePaid ?? it.price) || 0;
      const quantity = Math.max(1, Number(it.quantity) || 1);
      const weightOrVolume = String(it.weightOrVolume || '').trim();
      const comp = computeUnitPrice(
        pricePaid, 
        weightOrVolume, 
        quantity, 
        it.weightOrVolumeValue, 
        it.weightOrVolumeUnit
      );
      const unit = it.unit || comp.unit;
      const unitPrice = Number(it.referenceUnitPrice || it.unitPrice) > 0 
        ? Number(it.referenceUnitPrice || it.unitPrice) 
        : comp.unitPrice;
      const aisle = normalizeAisle(it.categoryKey || it.category);

      return {
        id: `val-item-${Date.now()}-${idx}`,
        rawName: it.rawName || 'Article',
        normalizedName: it.normalizedName || it.rawName || 'Article',
        brand: it.brand || 'Générique',
        pricePaid: Number(pricePaid.toFixed(2)),
        price: Number(pricePaid.toFixed(2)),
        quantity,
        weightOrVolume,
        weightOrVolumeValue: it.weightOrVolumeValue,
        weightOrVolumeUnit: it.weightOrVolumeUnit,
        unitPrice: Number(unitPrice.toFixed(2)),
        referenceUnitPrice: Number(unitPrice.toFixed(2)),
        category: aisle.label,
        categoryKey: aisle.key,
        unit
      };
    });
  });

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Calcul du total des lignes pour vérification d'audit (Règle 3)
  const sumItems = Number(items.reduce((acc, it) => acc + (Number(it.pricePaid) || 0), 0).toFixed(2));
  const subtotal = initialData.totalArticles !== undefined 
    ? initialData.totalArticles 
    : (initialData.subtotal !== undefined ? initialData.subtotal : sumItems);
  const expectedTotal = Number(Math.max(0, sumItems - totalDiscounts).toFixed(2));
  const diffEquation = Math.abs(expectedTotal - totalAmount);
  const isEquationBalanced = diffEquation <= 0.05;

  // Règle 4 : Contrôle strict anti-doublon (magasin + date + heure + total)
  const currentKey = getReceiptUniqueKey(normalizeStoreName(storeName), date, time, totalAmount);
  const duplicateReceipt = existingReceipts.find(r => 
    getReceiptUniqueKey(normalizeStoreName(r.storeName), r.date, r.time, r.totalAmount) === currentKey
  );
  const isDuplicate = Boolean(duplicateReceipt);

  const handleItemChange = (index: number, field: keyof ReceiptItem, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };
      if (field === 'pricePaid' || field === 'quantity' || field === 'weightOrVolume') {
        const p = field === 'pricePaid' ? Number(value) : item.pricePaid;
        const q = field === 'quantity' ? Number(value) : item.quantity;
        const w = field === 'weightOrVolume' ? String(value) : item.weightOrVolume;
        const comp = computeUnitPrice(p, w, q);
        item.unitPrice = comp.unitPrice;
        item.unit = comp.unit;
        item.price = p;
      }
      updated[index] = item;
      return updated;
    });
  };

  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      {
        id: `val-item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        rawName: '',
        normalizedName: '',
        brand: 'Générique',
        pricePaid: 0,
        price: 0,
        quantity: 1,
        weightOrVolume: '',
        unitPrice: 0,
        category: 'Produits frais & Crèmerie',
        unit: 'pièce'
      }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleAutoAlignTotal = () => {
    setTotalAmount(expectedTotal);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanStore = normalizeStoreName(storeName);
    if (!cleanStore) {
      setErrorMsg("Veuillez renseigner le nom du magasin / enseigne.");
      return;
    }

    if (!date) {
      setErrorMsg("Veuillez sélectionner la date d'achat.");
      return;
    }

    if (isDuplicate) {
      setErrorMsg(`🚨 Ticket déjà importé : Ce ticket de caisse (${cleanStore} le ${formatDateFR(date)} à ${time || '--:--'} pour ${formatCurrency(totalAmount)}) existe déjà dans votre historique. Importation bloquée pour éviter les doublons.`);
      return;
    }

    if (items.length === 0) {
      setErrorMsg("Le ticket doit contenir au moins un article.");
      return;
    }

    // Validation des articles avec calcul rigoureux
    const validItems: ReceiptItem[] = items.map((it, idx) => {
      const pricePaid = Number(Number(it.pricePaid || it.price || 0).toFixed(2));
      const quantity = Math.max(1, Number(it.quantity || 1));
      const weightOrVolume = (it.weightOrVolume || '').trim();
      const comp = computeUnitPrice(pricePaid, weightOrVolume, quantity, it.weightOrVolumeValue, it.weightOrVolumeUnit);
      const aisle = normalizeAisle(it.categoryKey || it.category);
      const unitPrice = Number(it.unitPrice) > 0 ? Number(Number(it.unitPrice).toFixed(2)) : (it.referenceUnitPrice || comp.unitPrice);

      return {
        id: it.id || `item-${Date.now()}-${idx}`,
        rawName: it.rawName.trim() || it.normalizedName.trim() || `Article ${idx + 1}`,
        normalizedName: it.normalizedName.trim() || it.rawName.trim() || `Article ${idx + 1}`,
        brand: it.brand?.trim() || 'Générique',
        pricePaid,
        price: pricePaid,
        quantity,
        weightOrVolume,
        weightOrVolumeValue: it.weightOrVolumeValue,
        weightOrVolumeUnit: it.weightOrVolumeUnit,
        unitPrice,
        referenceUnitPrice: unitPrice,
        category: aisle.label,
        categoryKey: aisle.key,
        unit: it.unit || comp.unit
      };
    });

    try {
      setIsSaving(true);
      await onSave({
        storeName: cleanStore,
        date,
        time: time.trim() || undefined,
        totalArticles: Number(sumItems.toFixed(2)),
        subtotal: Number(sumItems.toFixed(2)),
        totalDiscounts: Number(totalDiscounts.toFixed(2)),
        totalAmount: Number(totalAmount.toFixed(2)),
        items: validItems,
        rawFileCount: initialData.rawFileCount || 1
      });
    } catch (err: any) {
      console.error("Erreur enregistrement validation ticket:", err);
      setErrorMsg(err?.message || "Une erreur est survenue lors de l'enregistrement du ticket.");
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-4xl bg-card border border-border/80 dark:border-white/[0.1] rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[94dvh] sm:h-auto sm:max-h-[88vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* EN-TÊTE FIXE DE LA MODALE */}
        <div className="p-3.5 sm:p-5 border-b border-border/70 flex items-center justify-between bg-muted/20 shrink-0">
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse shrink-0" />
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-primary truncate">
                Audit Pré-Enregistrement
              </span>
            </div>
            <h2 className="text-base sm:text-xl font-extrabold text-foreground mt-0.5 truncate">
              Validation des données extraites du ticket
            </h2>
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-1">
              Contrôlez les libellés, prix et rayons avant intégration définitive dans la matrice comparative.
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* CONTENEUR FORMULAIRE AVEC CORPS DÉFILANT ET PIED VERROUILLÉ */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          
          {/* CORPS DÉFILANT */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-3.5 sm:p-6 space-y-4 sm:space-y-6">
            
            {errorMsg && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* ALERTE STRICTE ANTI-DOUBLON (RÈGLE 4) */}
            {isDuplicate && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs flex items-start gap-3 animate-in shake duration-200">
                <ShieldAlert size={20} className="text-red-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-extrabold text-sm">
                    🚨 Ticket déjà importé
                  </p>
                  <p className="leading-relaxed">
                    Ce ticket de caisse (<strong>{storeName}</strong> du <strong>{formatDateFR(date)}</strong> à <strong>{time || '--:--'}</strong> pour un total de <strong>{formatCurrency(totalAmount)}</strong>) existe déjà dans votre historique. L'importation est bloquée pour préserver l'intégrité de vos statistiques.
                  </p>
                </div>
              </div>
            )}

            {/* SECTION 1 : MÉTADONNÉES DU TICKET (RÈGLES 1, 2, 3, 4) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-secondary/30 border border-border/60">
              {/* ENSEIGNE AVEC LOCALISATION */}
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5 mb-1.5">
                  <Store size={14} className="text-primary" />
                  Enseigne & Ville / Localisation *
                </label>
                <input
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="ex: E.Leclerc Ville-la-Grand, Lidl Annemasse..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
                />
              </div>

              {/* DATE */}
              <div>
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5 mb-1.5">
                  <Calendar size={14} className="text-primary" />
                  Date de l'achat *
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                />
              </div>

              {/* HEURE (POUR DISCRIMINATION DES DOUBLONS) */}
              <div>
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5 mb-1.5">
                  <Clock size={14} className="text-primary" />
                  Heure de caisse
                </label>
                <input
                  type="text"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  placeholder="ex: 14:35"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                />
              </div>

              {/* TOTAL PAYÉ */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1">
                    Total payé (€) *
                  </label>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono font-bold"
                />
              </div>
            </div>

            {/* REMISES & CONTRÔLE COMPTABLE D'AUDIT (RÈGLE 3) */}
            <div className="p-3.5 rounded-xl bg-secondary/20 border border-border/70 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Sous-total articles :</span>
                    <span className="font-mono font-bold text-foreground">
                      {formatCurrency(sumItems, { showSign: false })}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Percent size={13} className="text-emerald-500" />
                    <span className="text-muted-foreground">Remises :</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={totalDiscounts}
                      onChange={(e) => setTotalDiscounts(Math.max(0, parseFloat(e.target.value) || 0))}
                      placeholder="0,00"
                      className="w-20 px-2 py-1 text-xs rounded-lg border border-border bg-card text-foreground font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Net attendu :</span>
                  <span className="font-mono font-bold text-foreground">
                    {formatCurrency(expectedTotal, { showSign: false })}
                  </span>
                </div>
              </div>

              {/* BANDEAU CONFORMITÉ ÉQUATION MATHÉMATIQUE */}
              {isEquationBalanced ? (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Check size={14} />
                    Audit Mathématique Conforme : (Articles {formatCurrency(sumItems, { showSign: false })} {totalDiscounts > 0 ? `- Remises ${formatCurrency(totalDiscounts, { showSign: false })}` : ''} = Net {formatCurrency(totalAmount, { showSign: false })})
                  </span>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <AlertCircle size={14} className="shrink-0" />
                    Écart de calcul : {formatCurrency(diffEquation, { showSign: false })} (Articles : {formatCurrency(sumItems, { showSign: false })} {totalDiscounts > 0 ? `- Remises : ${formatCurrency(totalDiscounts, { showSign: false })}` : ''} ≠ Total : {formatCurrency(totalAmount, { showSign: false })})
                  </span>
                  <button
                    type="button"
                    onClick={handleAutoAlignTotal}
                    className="text-[11px] font-bold underline hover:opacity-80 text-left sm:text-right shrink-0"
                  >
                    Ajuster à l'équation ({formatCurrency(expectedTotal, { showSign: false })})
                  </button>
                </div>
              )}
            </div>

            {/* SECTION 2 : ARTICLES */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-2">
                  <Tag size={15} className="text-primary" />
                  Articles ({items.length})
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddItem}
                  className="h-7 text-xs gap-1 border-dashed"
                >
                  <Plus size={13} />
                  <span>Ajouter une ligne</span>
                </Button>
              </div>

              {/* 1. VUE MOBILE : CARTES TACTILES ERGONOMIQUES (SM:HIDDEN) */}
              <div className="sm:hidden space-y-2.5">
                {items.map((item, idx) => (
                  <div key={item.id} className="p-3 rounded-xl border border-border/80 bg-secondary/20 space-y-2.5">
                    {/* EN-TÊTE DE LA CARTE ARTICLE */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        {item.rawName && item.rawName !== item.normalizedName ? (
                          <span className="text-[10px] text-muted-foreground font-mono truncate" title={item.rawName}>
                            Ticket : {item.rawName}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground font-medium">
                            Article {idx + 1}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0"
                        title="Supprimer cette ligne"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* LIBELLÉ NORMALISÉ */}
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground block mb-1">
                        Libellé normalisé *
                      </label>
                      <input
                        type="text"
                        required
                        value={item.normalizedName}
                        onChange={(e) => handleItemChange(idx, 'normalizedName', e.target.value)}
                        placeholder="ex: Lait demi-écrémé"
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                      />
                    </div>

                    {/* RAYON & MARQUE */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground block mb-1">
                          Rayon *
                        </label>
                        <select
                          value={item.category}
                          onChange={(e) => handleItemChange(idx, 'category', e.target.value as SupermarketAisle)}
                          className="w-full px-2 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium truncate"
                        >
                          {SUPERMARKET_AISLES.map(aisle => (
                            <option key={aisle} value={aisle}>
                              {AISLE_CONFIGS[aisle].label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground block mb-1">
                          Marque
                        </label>
                        <input
                          type="text"
                          value={item.brand}
                          onChange={(e) => handleItemChange(idx, 'brand', e.target.value)}
                          placeholder="ex: Freeway, Président"
                          className="w-full px-2 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                        />
                      </div>
                    </div>

                    {/* PRIX, CONTENANCE, QUANTITÉ */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground block mb-1">
                          Prix payé (€) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={item.pricePaid}
                          onChange={(e) => handleItemChange(idx, 'pricePaid', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 text-xs text-right rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono font-bold"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground block mb-1">
                          Format / Poids
                        </label>
                        <input
                          type="text"
                          value={item.weightOrVolume}
                          onChange={(e) => handleItemChange(idx, 'weightOrVolume', e.target.value)}
                          placeholder="ex: 1 L, 500 g"
                          className="w-full px-2 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground block mb-1 text-center">
                          Qté
                        </label>
                        <input
                          type="number"
                          step="1"
                          min="1"
                          required
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                          className="w-full px-2 py-1.5 text-xs text-center rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono font-bold"
                        />
                      </div>
                    </div>

                    {/* PRIX DE RÉFÉRENCE CALCULÉ */}
                    <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-border/40 text-muted-foreground">
                      <span>Prix standardisé :</span>
                      <span className="font-mono font-bold text-foreground">
                        {formatCurrency(item.unitPrice, { showSign: false })} / {item.unit || 'pièce'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* 2. VUE DESKTOP : TABLEAU COMPLET (HIDDEN SM:BLOCK) */}
              <div className="hidden sm:block border border-border/80 rounded-xl overflow-hidden bg-card/60">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[850px] text-xs">
                    <thead>
                      <tr className="border-b border-border/80 bg-muted/40 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        <th className="py-2.5 px-3 w-[22%]">Libellé Normalisé *</th>
                        <th className="py-2.5 px-3 w-[14%]">Marque</th>
                        <th className="py-2.5 px-3 w-[12%]">Contenance/Poids</th>
                        <th className="py-2.5 px-3 w-[22%]">Rayon Assigné *</th>
                        <th className="py-2.5 px-3 w-[11%] text-right">Prix Payé (€)</th>
                        <th className="py-2.5 px-3 w-[11%] text-right">Prix Réf. (€/u)</th>
                        <th className="py-2.5 px-3 w-[5%] text-center">Qté</th>
                        <th className="py-2.5 px-3 w-[5%] text-center">Action</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-border/60">
                      {items.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                          {/* LIBELLÉ NORMALISÉ */}
                          <td className="p-2 px-3">
                            <input
                              type="text"
                              required
                              value={item.normalizedName}
                              onChange={(e) => handleItemChange(idx, 'normalizedName', e.target.value)}
                              placeholder="ex: Lait demi-écrémé"
                              className="w-full px-2 py-1 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                            />
                            {item.rawName && item.rawName !== item.normalizedName && (
                              <span className="text-[10px] text-muted-foreground font-mono block truncate mt-0.5" title={item.rawName}>
                                Ticket : {item.rawName}
                              </span>
                            )}
                          </td>

                          {/* MARQUE */}
                          <td className="p-2 px-3">
                            <input
                              type="text"
                              value={item.brand}
                              onChange={(e) => handleItemChange(idx, 'brand', e.target.value)}
                              placeholder="ex: Freeway, Président"
                              className="w-full px-2 py-1 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                            />
                          </td>

                          {/* CONTENANCE / POIDS */}
                          <td className="p-2 px-3">
                            <input
                              type="text"
                              value={item.weightOrVolume}
                              onChange={(e) => handleItemChange(idx, 'weightOrVolume', e.target.value)}
                              placeholder="ex: 1.5 L, 500 g"
                              className="w-full px-2 py-1 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                            />
                          </td>

                          {/* RAYON ASSIGNÉ */}
                          <td className="p-2 px-3">
                            <select
                              value={item.category}
                              onChange={(e) => handleItemChange(idx, 'category', e.target.value as SupermarketAisle)}
                              className="w-full px-2 py-1 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                            >
                              {SUPERMARKET_AISLES.map(aisle => (
                                <option key={aisle} value={aisle}>
                                  {AISLE_CONFIGS[aisle].label}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* PRIX PAYÉ */}
                          <td className="p-2 px-3 text-right">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              required
                              value={item.pricePaid}
                              onChange={(e) => handleItemChange(idx, 'pricePaid', parseFloat(e.target.value) || 0)}
                              className="w-20 px-2 py-1 text-xs text-right rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono font-bold ml-auto"
                            />
                          </td>

                          {/* PRIX DE RÉFÉRENCE CALCULÉ */}
                          <td className="p-2 px-3 text-right">
                            <div className="flex flex-col items-end">
                              <span className="font-mono font-bold text-xs text-foreground">
                                {formatCurrency(item.unitPrice, { showSign: false })}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-medium">
                                € / {item.unit || 'pièce'}
                              </span>
                            </div>
                          </td>

                          {/* QUANTITÉ */}
                          <td className="p-2 px-3 text-center">
                            <input
                              type="number"
                              step="1"
                              min="1"
                              required
                              value={item.quantity}
                              onChange={(e) => handleItemChange(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                              className="w-12 px-1 py-1 text-xs text-center rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono mx-auto"
                            />
                          </td>

                          {/* ACTION SUPPRIMER */}
                          <td className="p-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                              title="Supprimer cette ligne"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>

          {/* PIED DE MODALE VERROUILLÉ (STICKY FOOTER AVEC SAFE-AREA) */}
          <div className="shrink-0 bg-card/95 backdrop-blur-md border-t border-border/80 p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between z-30">
            <div className="hidden sm:flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span>Données auditées et synchronisées en direct sur PC et smartphone.</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCancel}
                disabled={isSaving}
                className="h-10 sm:h-9 text-xs flex-1 sm:flex-none border-border/80"
              >
                Annuler
              </Button>

              <Button
                type="submit"
                size="sm"
                disabled={isSaving || items.length === 0 || isDuplicate}
                className="h-10 sm:h-9 text-xs font-bold gap-1.5 shadow-md flex-1 sm:flex-none"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Enregistrement...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    <span>Valider le ticket ({items.length} art.)</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
};
