import React, { useState } from 'react';
import { 
  X, 
  Store, 
  Calendar, 
  Plus, 
  Trash2, 
  Check, 
  AlertCircle,
  FileSpreadsheet
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { type ReceiptItem, type SupermarketAisle, SUPERMARKET_AISLES } from '../../../types/receipts';
import { AISLE_CONFIGS, computeUnitPrice, normalizeAisle } from '../../../lib/receiptClassifier';
import { formatCurrency } from '../../../lib/bankUtils';

interface ManualReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    storeName: string;
    date: string;
    totalAmount: number;
    items: ReceiptItem[];
  }) => Promise<void>;
}

export const ManualReceiptModal: React.FC<ManualReceiptModalProps> = ({
  isOpen,
  onClose,
  onSave
}) => {
  const [storeName, setStoreName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [totalAmount, setTotalAmount] = useState<number>(0);
  
  const [items, setItems] = useState<ReceiptItem[]>([
    {
      id: `manual-1`,
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

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const sumItems = items.reduce((acc, it) => acc + (it.pricePaid * it.quantity), 0);

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
        id: `manual-${Date.now()}-${prev.length + 1}`,
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
    if (items.length <= 1) return;
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
      setErrorMsg("Veuillez renseigner le nom de l'enseigne.");
      return;
    }

    if (!date) {
      setErrorMsg("Veuillez sélectionner la date.");
      return;
    }

    const validItems = items.filter(it => it.normalizedName.trim().length > 0 && it.pricePaid > 0);
    if (validItems.length === 0) {
      setErrorMsg("Veuillez renseigner au moins un article avec un nom et un prix supérieur à 0.");
      return;
    }

    const finalTotal = totalAmount > 0 ? totalAmount : Number(sumItems.toFixed(2));

    try {
      setIsSaving(true);
      await onSave({
        storeName: cleanStore,
        date,
        totalAmount: Number(finalTotal.toFixed(2)),
        items: validItems.map((it, idx) => {
          const pricePaid = Number(Number(it.pricePaid).toFixed(2));
          const quantity = Math.max(1, Number(it.quantity) || 1);
          const weightOrVolume = (it.weightOrVolume || '').trim();
          const comp = computeUnitPrice(pricePaid, weightOrVolume, quantity);
          const aisle = normalizeAisle(it.category);
          const unitPrice = Number(it.unitPrice) > 0 ? Number(Number(it.unitPrice).toFixed(2)) : comp.unitPrice;

          return {
            ...it,
            id: `item-${Date.now()}-${idx}`,
            normalizedName: it.normalizedName.trim(),
            rawName: it.rawName.trim() || it.normalizedName.trim(),
            brand: it.brand?.trim() || 'Générique',
            pricePaid,
            price: pricePaid,
            quantity,
            weightOrVolume,
            unitPrice,
            referenceUnitPrice: unitPrice,
            category: aisle.label,
            categoryKey: aisle.key,
            unit: it.unit || comp.unit
          };
        })
      });
      onClose();
    } catch (err: any) {
      console.error("Erreur enregistrement manuel:", err);
      setErrorMsg(err?.message || "Erreur lors de l'enregistrement du ticket.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-4xl bg-card border border-border/80 dark:border-white/[0.1] rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[94dvh] sm:h-auto sm:max-h-[88vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* EN-TÊTE FIXE */}
        <div className="p-3.5 sm:p-5 border-b border-border/70 flex items-center justify-between bg-muted/20 shrink-0">
          <div className="flex items-center gap-3 min-w-0 pr-2">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <FileSpreadsheet size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-extrabold text-foreground truncate">
                Saisie manuelle d'un ticket de caisse
              </h2>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
                Ajoutez directement vos articles sans scan, 100% hors-ligne et gratuit.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* CONTENEUR DU FORMULAIRE AVEC CORPS DÉFILANT ET PIED VERROUILLÉ */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          
          {/* CORPS DÉFILANT */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-3.5 sm:p-6 space-y-4 sm:space-y-6">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* MÉTADONNÉES TICKET */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-secondary/30 border border-border/60">
              <div>
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5 mb-1.5">
                  <Store size={14} className="text-primary" />
                  Magasin / Enseigne *
                </label>
                <input
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="ex: Lidl, Carrefour, Leclerc..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
                />
              </div>

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

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-foreground">
                    Montant total (€)
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoAlignTotal}
                    className="text-[10px] text-cyan-600 dark:text-cyan-400 hover:underline font-medium"
                  >
                    Somme ({formatCurrency(sumItems, { showSign: false })})
                  </button>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={totalAmount || ''}
                  onChange={(e) => setTotalAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono font-bold"
                />
              </div>
            </div>

            {/* LISTE DES ARTICLES */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-bold text-foreground">
                  Articles à enregistrer ({items.length})
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
                    {/* EN-TÊTE CARTE */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          Article {idx + 1}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        disabled={items.length <= 1}
                        className="p-1 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-30 shrink-0"
                        title="Supprimer cette ligne"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* NOM DU PRODUIT */}
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground block mb-1">
                        Nom du produit *
                      </label>
                      <input
                        type="text"
                        required
                        value={item.normalizedName}
                        onChange={(e) => handleItemChange(idx, 'normalizedName', e.target.value)}
                        placeholder="ex: Pâtes coquillettes"
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
                          placeholder="ex: Barilla, Lustucru"
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
                          min="0.01"
                          required
                          value={item.pricePaid || ''}
                          onChange={(e) => handleItemChange(idx, 'pricePaid', parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
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
                          placeholder="ex: 500 g, 1 kg"
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

                    {/* PRIX UNITAIRE CALCULÉ */}
                    {item.unitPrice > 0 && item.weightOrVolume && (
                      <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-border/40 text-muted-foreground">
                        <span>Prix standardisé :</span>
                        <span className="font-mono font-bold text-foreground">
                          {formatCurrency(item.unitPrice, { showSign: false })} / {item.unit || 'u'}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* 2. VUE DESKTOP : TABLEAU COMPLET (HIDDEN SM:BLOCK) */}
              <div className="hidden sm:block border border-border/80 rounded-xl overflow-hidden bg-card/60">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[800px] text-xs">
                    <thead>
                      <tr className="border-b border-border/80 bg-muted/40 text-[10px] font-bold text-muted-foreground uppercase">
                        <th className="py-2.5 px-3 w-[24%]">Nom du Produit *</th>
                        <th className="py-2.5 px-3 w-[15%]">Marque</th>
                        <th className="py-2.5 px-3 w-[13%]">Contenance/Poids</th>
                        <th className="py-2.5 px-3 w-[22%]">Rayon Assigné *</th>
                        <th className="py-2.5 px-3 w-[12%] text-right">Prix Payé (€) *</th>
                        <th className="py-2.5 px-3 w-[8%] text-center">Qté</th>
                        <th className="py-2.5 px-3 w-[6%] text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {items.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-muted/30">
                          {/* NOM DU PRODUIT */}
                          <td className="p-2 px-3">
                            <input
                              type="text"
                              required
                              value={item.normalizedName}
                              onChange={(e) => handleItemChange(idx, 'normalizedName', e.target.value)}
                              placeholder="ex: Pâtes coquillettes"
                              className="w-full px-2 py-1 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                            />
                          </td>

                          {/* MARQUE */}
                          <td className="p-2 px-3">
                            <input
                              type="text"
                              value={item.brand}
                              onChange={(e) => handleItemChange(idx, 'brand', e.target.value)}
                              placeholder="ex: Barilla, Lustucru"
                              className="w-full px-2 py-1 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                            />
                          </td>

                          {/* CONTENANCE / POIDS */}
                          <td className="p-2 px-3">
                            <input
                              type="text"
                              value={item.weightOrVolume}
                              onChange={(e) => handleItemChange(idx, 'weightOrVolume', e.target.value)}
                              placeholder="ex: 500 g, 1 kg"
                              className="w-full px-2 py-1 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                            />
                          </td>

                          {/* RAYON ASSIGNÉ */}
                          <td className="p-2 px-3">
                            <select
                              value={item.category}
                              onChange={(e) => handleItemChange(idx, 'category', e.target.value as SupermarketAisle)}
                              className="w-full px-2 py-1 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
                              min="0.01"
                              required
                              value={item.pricePaid || ''}
                              onChange={(e) => handleItemChange(idx, 'pricePaid', parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              className="w-20 px-2 py-1 text-xs text-right rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono font-bold ml-auto"
                            />
                            {item.unitPrice > 0 && item.weightOrVolume && (
                              <span className="text-[10px] text-muted-foreground font-mono block mt-0.5">
                                {formatCurrency(item.unitPrice, { showSign: false })} / {item.unit || 'u'}
                              </span>
                            )}
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

                          {/* ACTION */}
                          <td className="p-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              disabled={items.length <= 1}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-30"
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

          {/* PIED VERROUILLÉ (STICKY FOOTER AVEC SAFE-AREA) */}
          <div className="shrink-0 bg-card/95 backdrop-blur-md border-t border-border/80 p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between z-30">
            <span className="text-xs font-semibold text-muted-foreground">
              Total des lignes : <strong className="text-foreground font-mono">{formatCurrency(sumItems, { showSign: false })}</strong>
            </span>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={isSaving}
                className="h-10 sm:h-9 text-xs flex-1 sm:flex-none border-border/80"
              >
                Annuler
              </Button>

              <Button
                type="submit"
                size="sm"
                disabled={isSaving}
                className="h-10 sm:h-9 text-xs font-bold gap-1.5 shadow-md flex-1 sm:flex-none"
              >
                <Check size={14} />
                <span>Enregistrer le ticket</span>
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
