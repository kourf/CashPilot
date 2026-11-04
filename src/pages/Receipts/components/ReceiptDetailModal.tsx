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
  Loader2,
  Zap,
  ShoppingBag
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

  const sumItems = Number(receipt.items.reduce((acc, it) => acc + (it.pricePaid ?? it.price ?? 0), 0).toFixed(2));
  const subtotal = receipt.totalArticles !== undefined 
    ? receipt.totalArticles 
    : (receipt.subtotal !== undefined ? receipt.subtotal : sumItems);
  const discounts = receipt.totalDiscounts || 0;
  const netTotal = receipt.totalAmount;

  // Règle 3 : Audit mathématique
  const expectedTotal = Number(Math.max(0, sumItems - discounts).toFixed(2));
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
    <div className="fixed inset-0 z-[105] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-[#0c1222]/95 backdrop-blur-2xl border border-white/20 shadow-2xl shadow-cyan-950/40 overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER APPLE VISIONOS */}
        <div className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-white/10 flex items-center justify-between gap-3 bg-white/[0.02]">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-cyan-400 shrink-0 shadow-inner">
              <Store size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="glass-pill text-[10px] text-cyan-300 font-mono font-bold">
                  {receipt.items.length} articles
                </span>
                {receipt.time && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 font-bold">
                    <Clock size={11} />
                    {receipt.time}
                  </span>
                )}
              </div>
              <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight mt-0.5 truncate">
                {receipt.storeName}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5 flex-wrap">
                <span className="flex items-center gap-1 text-slate-300">
                  <Calendar size={12} className="text-cyan-400" />
                  {formatDateFR(receipt.date)}
                </span>
                <span>•</span>
                <span>Enregistré le {formatDateFR(receipt.createdAt.slice(0, 10))}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            title="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        {/* CORPS DE LA MODALE */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto max-h-[calc(92vh-160px)]">

          {/* SECTION AUDIT FINANCIER & MATHÉMATIQUE */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.035] border border-white/10 backdrop-blur-xl space-y-3.5 shadow-lg">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 flex-wrap gap-2">
              <span className="uppercase tracking-wider text-[10px] text-slate-400 font-black">Audit Financier du Ticket</span>
              {isEquationBalanced ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono">
                  <CheckCircle2 size={13} className="text-emerald-400" />
                  Équation Mathématique Conforme
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono">
                  <AlertTriangle size={13} className="text-amber-400" />
                  Écart constaté : {formatCurrency(diff, { showSign: false })}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2.5 sm:gap-4 text-center">
              <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 shadow-sm">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-0.5">Sous-total brut</span>
                <span className="text-sm sm:text-base font-extrabold font-mono text-white">
                  {formatCurrency(subtotal, { showSign: false })}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 shadow-sm">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-0.5">Remises & Rabais</span>
                <span className="text-sm sm:text-base font-extrabold font-mono text-emerald-400">
                  {discounts > 0 ? `-${formatCurrency(discounts, { showSign: false })}` : '0,00 €'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/15 border border-cyan-400/40 shadow-lg shadow-cyan-950/40">
                <span className="text-[10px] text-cyan-300 font-black uppercase tracking-wider block mb-0.5">Total Net Payé</span>
                <span className="text-base sm:text-lg font-black font-mono text-white">
                  {formatCurrency(netTotal, { showSign: false })}
                </span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 text-center font-mono pt-0.5">
              Contrôle comptable : {formatCurrency(subtotal, { showSign: false })} (articles) {discounts > 0 ? `- ${formatCurrency(discounts, { showSign: false })} (remises)` : ''} = {formatCurrency(netTotal, { showSign: false })} payé en caisse.
            </div>
          </div>

          {/* LISTE DÉTAILLÉE DES ARTICLES */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ShoppingBag size={13} className="text-cyan-400" />
                Articles du ticket ({receipt.items.length})
              </span>
              <span className="font-mono text-slate-300">Total : {formatCurrency(sumItems, { showSign: false })}</span>
            </h3>

            <div className="border border-white/10 rounded-2xl overflow-hidden bg-white/[0.02] shadow-xl">
              <div className="overflow-x-auto touch-scroll">
                <table className="w-full text-left border-collapse text-xs min-w-[620px]">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-3.5">Produit</th>
                      <th className="py-3 px-3">Marque</th>
                      <th className="py-3 px-3">Rayon</th>
                      <th className="py-3 px-3">Format</th>
                      <th className="py-3 px-3 text-right">Prix Unitaire</th>
                      <th className="py-3 px-3 text-center">Qté</th>
                      <th className="py-3 px-3.5 text-right">Total Ligne</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {receipt.items.map((it) => {
                      const aisleMeta = AISLE_CONFIGS[it.category as SupermarketAisle] || AISLE_CONFIGS['Autres / Divers'];
                      const lineTotal = it.pricePaid ?? it.price ?? 0;

                      return (
                        <tr key={it.id} className="hover:bg-white/[0.03] transition-colors">
                          <td className="py-3 px-3.5 font-bold text-white">
                            <div>{it.normalizedName}</div>
                            {it.rawName && it.rawName !== it.normalizedName && (
                              <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                                Ticket : {it.rawName}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-[11px] text-slate-400 font-medium">
                            {it.brand || 'Générique'}
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-[9px] font-medium text-slate-300 bg-white/[0.05] border border-white/[0.08] px-2 py-0.5 rounded-md truncate max-w-[130px] inline-block">
                              {it.category}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-[11px] text-slate-400 font-mono">
                            {it.weightOrVolume || '—'}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-white">
                            {it.unitPrice > 0 ? (
                              <span>{formatCurrency(it.unitPrice, { showSign: false })}/{it.unit || 'u'}</span>
                            ) : (
                              <span>{formatCurrency(it.quantity > 1 ? lineTotal / it.quantity : lineTotal, { showSign: false })}</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-slate-300">
                            {it.quantity}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono font-black text-white">
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
        <div className="p-4 sm:p-5 border-t border-white/10 bg-white/[0.02] flex flex-col sm:flex-row items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsConfirmOpen(true)}
            className="w-full sm:w-auto h-9 text-xs font-bold gap-1.5 border-rose-500/40 bg-rose-500/10 text-rose-300 hover:text-white hover:bg-rose-600 transition-all shadow-sm rounded-xl cursor-pointer"
          >
            <Trash2 size={14} />
            <span>Supprimer ce ticket définitivement</span>
          </Button>

          <Button 
            onClick={onClose} 
            size="sm" 
            className="w-full sm:w-auto text-xs font-bold px-6 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all cursor-pointer"
          >
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
