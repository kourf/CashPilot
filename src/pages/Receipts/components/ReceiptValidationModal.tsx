import React, { useState } from 'react';
import { 
  X, 
  Store, 
  Calendar, 
  Plus, 
  Trash2, 
  Check, 
  AlertCircle, 
  Loader2,
  Tag
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { type ReceiptItem, type SupermarketAisle, SUPERMARKET_AISLES } from '../../../types/receipts';
import { formatCurrency } from '../../../lib/bankUtils';
import { AISLE_CONFIGS, computeUnitPrice } from '../../../lib/receiptClassifier';

interface ReceiptValidationModalProps {
  isOpen: boolean;
  initialData: {
    storeName: string;
    date: string;
    totalAmount: number;
    items: Array<{
      rawName: string;
      normalizedName: string;
      brand?: string;
      pricePaid?: number;
      price?: number;
      quantity?: number;
      weightOrVolume?: string;
      unitPrice?: number;
      category: SupermarketAisle;
      unit?: string;
    }>;
    rawFileCount?: number;
  };
  onCancel: () => void;
  onSave: (validatedData: {
    storeName: string;
    date: string;
    totalAmount: number;
    items: ReceiptItem[];
    rawFileCount?: number;
  }) => Promise<void>;
}

export const ReceiptValidationModal: React.FC<ReceiptValidationModalProps> = ({
  isOpen,
  initialData,
  onCancel,
  onSave
}) => {
  const [storeName, setStoreName] = useState(initialData.storeName || 'Supermarché');
  const [date, setDate] = useState(initialData.date || new Date().toISOString().slice(0, 10));
  const [totalAmount, setTotalAmount] = useState(initialData.totalAmount || 0);

  const [items, setItems] = useState<ReceiptItem[]>(() => {
    return (initialData.items || []).map((it, idx) => {
      const pricePaid = Number(it.pricePaid ?? it.price) || 0;
      const quantity = Math.max(1, Number(it.quantity) || 1);
      const weightOrVolume = String(it.weightOrVolume || '').trim();
      const unit = it.unit || 'pièce';
      let unitPrice = Number(it.unitPrice) || 0;
      if (unitPrice <= 0) {
        const computed = computeUnitPrice(pricePaid, weightOrVolume, quantity);
        unitPrice = computed.unitPrice;
      }

      return {
        id: `val-item-${Date.now()}-${idx}`,
        rawName: it.rawName || 'Article',
        normalizedName: it.normalizedName || it.rawName || 'Article',
        brand: it.brand || 'Générique',
        pricePaid: Number(pricePaid.toFixed(2)),
        price: Number(pricePaid.toFixed(2)),
        quantity,
        weightOrVolume,
        unitPrice: Number(unitPrice.toFixed(2)),
        category: it.category || 'Épicerie salée & Épices',
        unit
      };
    });
  });

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Calcul du total des lignes pour vérification d'audit
  const sumItems = items.reduce((acc, it) => acc + (it.pricePaid * it.quantity), 0);
  const diffTotal = Math.abs(totalAmount - sumItems);
  const isTotalAligned = diffTotal < 0.05;

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
    setTotalAmount(Number(sumItems.toFixed(2)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanStore = storeName.trim();
    if (!cleanStore) {
      setErrorMsg("Veuillez renseigner le nom du magasin / enseigne.");
      return;
    }

    if (!date) {
      setErrorMsg("Veuillez sélectionner la date d'achat.");
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
      const comp = computeUnitPrice(pricePaid, weightOrVolume, quantity);

      return {
        id: it.id || `item-${Date.now()}-${idx}`,
        rawName: it.rawName.trim() || it.normalizedName.trim() || `Article ${idx + 1}`,
        normalizedName: it.normalizedName.trim() || it.rawName.trim() || `Article ${idx + 1}`,
        brand: it.brand?.trim() || 'Générique',
        pricePaid,
        price: pricePaid,
        quantity,
        weightOrVolume,
        unitPrice: Number(it.unitPrice) > 0 ? Number(Number(it.unitPrice).toFixed(2)) : comp.unitPrice,
        category: it.category,
        unit: it.unit || comp.unit
      };
    });

    try {
      setIsSaving(true);
      await onSave({
        storeName: cleanStore,
        date,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div 
        className="w-full max-w-4xl bg-card border border-border/80 dark:border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* EN-TÊTE DE LA MODALE */}
        <div className="p-4 sm:p-5 border-b border-border/70 flex items-center justify-between bg-muted/20 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                Audit Pré-Enregistrement
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-foreground mt-0.5">
              Validation des données extraites du ticket
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Vérifiez et ajustez les libellés, prix et rayons avant intégration définitive dans la matrice comparative.
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* CORPS DU FORMULAIRE */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {errorMsg && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* SECTION 1 : MÉTADONNÉES DU TICKET */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-secondary/30 border border-border/60">
            {/* ENSEIGNE */}
            <div>
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5 mb-1.5">
                <Store size={14} className="text-primary" />
                Enseigne / Magasin *
              </label>
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="ex: Lidl, Carrefour, E.Leclerc..."
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

            {/* TOTAL PAYÉ */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  Montant total du ticket (€) *
                </label>
                {!isTotalAligned && (
                  <button
                    type="button"
                    onClick={handleAutoAlignTotal}
                    className="text-[10px] text-cyan-600 dark:text-cyan-400 hover:underline font-medium"
                    title="Ajuster sur la somme des articles"
                  >
                    Ajuster ({formatCurrency(sumItems, { showSign: false })})
                  </button>
                )}
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

          {/* ALERTE AUDIT SOMME VS TOTAL */}
          <div className="flex items-center justify-between text-xs px-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-muted-foreground">
                Somme des {items.length} article(s) :
              </span>
              <span className="font-mono font-bold text-foreground">
                {formatCurrency(sumItems, { showSign: false })}
              </span>
            </div>

            {isTotalAligned ? (
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Check size={13} />
                Total ticket conforme à la somme des lignes
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-amber-500 flex items-center gap-1">
                <AlertCircle size={13} />
                Écart de {formatCurrency(diffTotal, { showSign: false })} entre le total et la somme
              </span>
            )}
          </div>

          {/* SECTION 2 : LISTE DES ARTICLES EXTRAITS ET ÉDITABLES */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
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

            <div className="border border-border/80 rounded-xl overflow-hidden bg-card/60">
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

          {/* PIED DE MODALE : BOUTONS D'ACTION */}
          <div className="pt-4 border-t border-border/70 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              Données auditées et synchronisées en direct sur PC et smartphone.
            </span>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCancel}
                disabled={isSaving}
                className="h-9 text-xs"
              >
                Annuler
              </Button>

              <Button
                type="submit"
                size="sm"
                disabled={isSaving || items.length === 0}
                className="h-9 text-xs font-bold gap-1.5 shadow-md"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    Valider et enregistrer le ticket ({items.length} articles)
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
