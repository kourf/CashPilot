import React, { useState } from 'react';
import { 
  Store, 
  Calendar, 
  Trash2, 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  Receipt as ReceiptIcon,
  Tag
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { type Receipt } from '../../../types/receipts';
import { formatCurrency, formatDateFR } from '../../../lib/bankUtils';
import { AISLE_CONFIGS } from '../../../lib/receiptClassifier';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';

interface ReceiptHistoryViewProps {
  receipts: Receipt[];
  onDeleteReceipt: (receiptId: string) => Promise<void>;
  onOpenUpload: () => void;
}

export const ReceiptHistoryView: React.FC<ReceiptHistoryViewProps> = ({
  receipts,
  onDeleteReceipt,
  onOpenUpload
}) => {
  const [expandedReceiptId, setExpandedReceiptId] = useState<string | null>(null);
  const [receiptToDelete, setReceiptToDelete] = useState<Receipt | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const toggleExpand = (id: string) => {
    setExpandedReceiptId(prev => (prev === id ? null : id));
  };

  const handleConfirmDelete = async () => {
    if (!receiptToDelete) return;
    try {
      setIsDeleting(true);
      await onDeleteReceipt(receiptToDelete.id);
      setReceiptToDelete(null);
    } catch (err) {
      console.error("Erreur suppression ticket:", err);
      alert("Erreur lors de la suppression du ticket.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (receipts.length === 0) {
    return (
      <div className="p-8 sm:p-12 text-center rounded-2xl glass-card border border-border/80 space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
          <ReceiptIcon size={32} />
        </div>
        <div className="max-w-md mx-auto space-y-1.5">
          <h3 className="text-lg font-bold text-foreground">
            Aucun ticket dans l'historique
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Vos tickets scannés apparaîtront ici pour vous permettre d'auditer le détail de chaque achat ou d'en supprimer si besoin.
          </p>
        </div>
        <Button onClick={onOpenUpload} className="text-xs font-bold gap-2">
          <Plus size={14} />
          Ajouter un ticket
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <ReceiptIcon size={18} className="text-primary" />
            Historique des Tickets Enregistrés ({receipts.length})
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Chaque ticket alimente la matrice comparative multi-enseignes. Supprimer un ticket retire immédiatement ses prix du comparatif.
          </p>
        </div>

        <Button onClick={onOpenUpload} size="sm" className="text-xs font-bold gap-1.5 h-9">
          <Plus size={14} />
          <span>Ajouter un ticket</span>
        </Button>
      </div>

      <div className="space-y-3">
        {receipts.map((receipt) => {
          const isExpanded = expandedReceiptId === receipt.id;

          return (
            <div 
              key={receipt.id}
              className="rounded-2xl border border-border/80 dark:border-white/[0.08] bg-card overflow-hidden shadow-sm transition-all duration-200"
            >
              {/* LIGNE PRINCIPALE DU TICKET */}
              <div 
                onClick={() => toggleExpand(receipt.id)}
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Store size={20} />
                  </div>

                  <div>
                    <h4 className="font-extrabold text-sm sm:text-base text-foreground flex items-center gap-2">
                      {receipt.storeName}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono">
                        {receipt.items.length} articles
                      </span>
                    </h4>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono mt-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {formatDateFR(receipt.date)}
                      </span>
                      <span>•</span>
                      <span>Enregistré le {formatDateFR(receipt.createdAt.slice(0, 10))}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* MONTANT TOTAL DU TICKET */}
                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Total ticket</span>
                    <span className="text-base font-extrabold text-foreground font-mono">
                      {formatCurrency(receipt.totalAmount, { showSign: false })}
                    </span>
                  </div>

                  {/* ACTION SUPPRIMER */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setReceiptToDelete(receipt);
                    }}
                    className="p-2 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    title="Supprimer ce ticket"
                  >
                    <Trash2 size={16} />
                  </button>

                  <div className="text-muted-foreground">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>
              </div>

              {/* DÉTAIL DES ARTICLES DÉROULÉ */}
              {isExpanded && (
                <div className="p-3 sm:p-4 border-t border-border/70 bg-muted/20 space-y-3 animate-in fade-in duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-muted-foreground font-semibold px-1 gap-1">
                    <span>Détail des {receipt.items.length} articles réels</span>
                    <span>Total calculé : {formatCurrency(receipt.items.reduce((acc, it) => acc + (it.price * it.quantity), 0), { showSign: false })}</span>
                  </div>

                  <div className="border border-border/80 rounded-xl overflow-hidden bg-card">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs min-w-[600px]">
                        <thead>
                          <tr className="border-b border-border/80 bg-secondary/40 text-[10px] font-bold text-muted-foreground uppercase">
                            <th className="py-2 px-3">Produit Normalisé</th>
                            <th className="py-2 px-3">Marque</th>
                            <th className="py-2 px-3">Contenance</th>
                            <th className="py-2 px-3">Rayon</th>
                            <th className="py-2 px-3 text-right">Prix Payé</th>
                            <th className="py-2 px-3 text-right">Prix Réf.</th>
                            <th className="py-2 px-3 text-center">Qté</th>
                            <th className="py-2 px-3 text-right">Total Ligne</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {receipt.items.map((it) => (
                            <tr key={it.id} className="hover:bg-muted/20">
                              <td className="py-2 px-3 font-semibold text-foreground">
                                <div>{it.normalizedName}</div>
                                {it.rawName && it.rawName !== it.normalizedName && (
                                  <span className="text-[10px] text-muted-foreground font-mono block">
                                    {it.rawName}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-[11px] text-muted-foreground font-medium">
                                {it.brand || 'Générique'}
                              </td>
                              <td className="py-2 px-3 text-[11px] text-muted-foreground font-mono">
                                {it.weightOrVolume || '—'}
                              </td>
                              <td className="py-2 px-3">
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-secondary text-muted-foreground">
                                  {AISLE_CONFIGS[it.category]?.label || it.category}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                                {formatCurrency(it.pricePaid ?? it.price, { showSign: false })}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-[11px] text-muted-foreground">
                                {it.unitPrice > 0 ? `${formatCurrency(it.unitPrice, { showSign: false })}/${it.unit || 'u'}` : '—'}
                              </td>
                              <td className="py-2 px-3 text-center font-mono text-muted-foreground">
                                {it.quantity}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                                {formatCurrency((it.pricePaid ?? it.price) * it.quantity, { showSign: false })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* MODAL DE CONFIRMATION DE SUPPRESSION D'UN TICKET */}
      <DeleteConfirmDialog
        isOpen={Boolean(receiptToDelete)}
        title="Supprimer ce ticket de caisse ?"
        description={`Le ticket « ${receiptToDelete?.storeName} » du ${receiptToDelete ? formatDateFR(receiptToDelete.date) : ''} (${receiptToDelete ? formatCurrency(receiptToDelete.totalAmount) : ''}) sera définitivement supprimé. Tous les prix associés seront instantanément retirés de la matrice comparative.`}
        confirmLabel="Supprimer le ticket"
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setReceiptToDelete(null)}
      />
    </div>
  );
};
