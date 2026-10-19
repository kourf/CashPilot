import React, { useState } from 'react';
import { 
  X, 
  Store, 
  Calendar, 
  Clock, 
  Trash2, 
  Receipt as ReceiptIcon, 
  Tag, 
  Layers, 
  CheckCircle2, 
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { type Receipt, type SupermarketAisle } from '../../../types/receipts';
import { formatCurrency, formatDateFR } from '../../../lib/bankUtils';
import { AISLE_CONFIGS } from '../../../lib/receiptClassifier';
import { cn } from '../../../lib/utils';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';

interface ReceiptDetailModalProps {
  receipt: Receipt | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleteReceipt: (receiptId: string) => Promise<void>;
}

export const ReceiptDetailModal: React.FC<ReceiptDetailModalProps> = ({
  receipt,
  isOpen,
  onClose,
  onDeleteReceipt
}) => {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !receipt) return null;

  const sumItems = receipt.items.reduce((acc, it) => acc + ((it.pricePaid ?? it.price) * it.quantity), 0);
  const subtotal = receipt.subtotal !== undefined ? receipt.subtotal : Number(sumItems.toFixed(2));
  const discounts = receipt.totalDiscounts || 0;
  const netTotal = receipt.totalAmount;

  // Règle 3 : Audit mathématique
  const expectedTotal = Number(Math.max(0, subtotal - discounts).toFixed(2));
  const diff = Math.abs(expectedTotal - netTotal);
  const isEquationBalanced = diff <= 0.05;

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await onDeleteReceipt(receipt.id);
      setIsConfirmOpen(false);
      onClose();
    } catch (err) {
      console.error("Erreur suppression ticket:", err);
      alert("Erreur lors de la suppression définitive du ticket.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[105] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-card border border-border/80 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-border/70 flex items-center justify-between gap-3 bg-secondary/30">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Store size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/70 font-mono">
                  {receipt.items.length} articles
                </span>
                {receipt.time && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 font-mono flex items-center gap-1">
                    <Clock size={11} />
                    {receipt.time}
                  </span>
                )}
              </div>
              <h2 className="text-lg sm:text-2xl font-black text-foreground tracking-tight mt-0.5">
                {receipt.storeName}
              </h2>
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono mt-0.5">
                <span className="flex items-center gap-1">
                  <Calendar size={12} />
                  {formatDateFR(receipt.date)}
                </span>
                <span>•</span>
                <span>Enregistré le {formatDateFR(receipt.createdAt.slice(0, 10))}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* CORPS DE LA MODALE */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto max-h-[calc(92vh-160px)]">

          {/* SECTION AUDIT FINANCIER & MATHÉMATIQUE */}
          <div className="p-4 rounded-2xl bg-secondary/30 border border-border/70 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
              <span className="uppercase tracking-wider">Audit Financier du Ticket</span>
              {isEquationBalanced ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={13} />
                  Équation Mathématique Conforme
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-500">
                  <AlertTriangle size={13} />
                  Écart constaté : {formatCurrency(diff, { showSign: false })}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2.5 sm:gap-4 text-center">
              <div className="p-3 rounded-xl bg-card border border-border/70">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Sous-total brut</span>
                <span className="text-sm sm:text-base font-extrabold font-mono text-foreground">
                  {formatCurrency(subtotal, { showSign: false })}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-card border border-border/70">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Remises & Rabais</span>
                <span className="text-sm sm:text-base font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                  {discounts > 0 ? `-${formatCurrency(discounts, { showSign: false })}` : '0,00 €'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-card border border-primary/30 bg-primary/5">
                <span className="text-[10px] text-primary font-bold uppercase block">Total Net Payé</span>
                <span className="text-base sm:text-lg font-black font-mono text-foreground">
                  {formatCurrency(netTotal, { showSign: false })}
                </span>
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground text-center font-mono">
              Contrôle comptable : {formatCurrency(subtotal, { showSign: false })} (articles) {discounts > 0 ? `- ${formatCurrency(discounts, { showSign: false })} (remises)` : ''} = {formatCurrency(netTotal, { showSign: false })} payé en caisse.
            </div>
          </div>

          {/* LISTE DÉTAILLÉE DES ARTICLES */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Articles du ticket ({receipt.items.length})</span>
              <span className="font-mono">Total calculé : {formatCurrency(sumItems, { showSign: false })}</span>
            </h3>

            <div className="border border-border/70 rounded-xl overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs min-w-[600px]">
                  <thead>
                    <tr className="border-b border-border/70 bg-secondary/40 text-[10px] font-bold text-muted-foreground uppercase">
                      <th className="py-2.5 px-3">Produit</th>
                      <th className="py-2.5 px-3">Marque</th>
                      <th className="py-2.5 px-3">Rayon</th>
                      <th className="py-2.5 px-3">Format</th>
                      <th className="py-2.5 px-3 text-right">Prix Unitaire</th>
                      <th className="py-2.5 px-3 text-center">Qté</th>
                      <th className="py-2.5 px-3 text-right">Total Ligne</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {receipt.items.map((it) => {
                      const aisleMeta = AISLE_CONFIGS[it.category as SupermarketAisle] || AISLE_CONFIGS['Autres / Divers'];
                      const lineTotal = (it.pricePaid ?? it.price) * it.quantity;

                      return (
                        <tr key={it.id} className="hover:bg-muted/20">
                          <td className="py-2.5 px-3 font-semibold text-foreground">
                            <div>{it.normalizedName}</div>
                            {it.rawName && it.rawName !== it.normalizedName && (
                              <span className="text-[10px] text-muted-foreground font-mono block">
                                Ticket : {it.rawName}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-muted-foreground font-medium">
                            {it.brand || 'Générique'}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-md border", aisleMeta?.badgeClass)}>
                              {it.category}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-muted-foreground font-mono">
                            {it.weightOrVolume || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                            {it.unitPrice > 0 ? (
                              <span>{formatCurrency(it.unitPrice, { showSign: false })}/{it.unit || 'u'}</span>
                            ) : (
                              <span>{formatCurrency(it.pricePaid ?? it.price, { showSign: false })}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-muted-foreground">
                            {it.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-extrabold text-foreground">
                            {formatCurrency(lineTotal, { showSign: false })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>

        {/* FOOTER AVEC BOUTON DE SUPPRESSION DÉFINITIVE ROUGE VISIBLE */}
        <div className="p-4 sm:p-5 border-t border-border/70 bg-secondary/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsConfirmOpen(true)}
            className="w-full sm:w-auto h-9 text-xs font-bold gap-1.5 border-red-500/40 text-red-600 hover:text-white hover:bg-red-600 dark:border-red-500/50 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white transition-all shadow-xs"
          >
            <Trash2 size={15} />
            <span>🗑️ Supprimer ce ticket définitivement</span>
          </Button>

          <Button onClick={onClose} size="sm" className="w-full sm:w-auto text-xs font-bold px-6 h-9">
            Fermer
          </Button>
        </div>
      </div>

      {/* DIALOGUE DE CONFIRMATION DE SUPPRESSION */}
      <DeleteConfirmDialog
        isOpen={isConfirmOpen}
        title="Supprimer ce ticket de caisse définitivement ?"
        description={`Le ticket « ${receipt.storeName} » du ${formatDateFR(receipt.date)} (${formatCurrency(receipt.totalAmount)}) sera supprimé de la base de données. Tous ses prix seront instantanément retirés de la matrice comparative et des graphiques.`}
        confirmLabel="🗑️ Supprimer définitivement"
        isDeleting={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </div>
  );
};
