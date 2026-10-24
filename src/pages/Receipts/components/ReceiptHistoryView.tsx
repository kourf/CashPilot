import React, { useState, useMemo } from 'react';
import { 
  Store, 
  Calendar, 
  Trash2, 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  Receipt as ReceiptIcon,
  Tag,
  Filter,
  Clock,
  ExternalLink,
  Percent,
  Search
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { type Receipt, type SupermarketAisle } from '../../../types/receipts';
import { formatCurrency, formatDateFR } from '../../../lib/bankUtils';
import { AISLE_CONFIGS, normalizeStoreName } from '../../../lib/receiptClassifier';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { ReceiptDetailModal } from './ReceiptDetailModal';
import { cn } from '../../../lib/utils';

interface ReceiptHistoryViewProps {
  receipts: Receipt[];
  onDeleteReceipt: (receiptId: string) => Promise<void>;
  onOpenUpload: () => void;
}

const MONTHS_FR = [
  { value: 'ALL', label: 'Tous les mois' },
  { value: '01', label: 'Janvier' },
  { value: '02', label: 'Février' },
  { value: '03', label: 'Mars' },
  { value: '04', label: 'Avril' },
  { value: '05', label: 'Mai' },
  { value: '06', label: 'Juin' },
  { value: '07', label: 'Juillet' },
  { value: '08', label: 'Août' },
  { value: '09', label: 'Septembre' },
  { value: '10', label: 'Octobre' },
  { value: '11', label: 'Novembre' },
  { value: '12', label: 'Décembre' }
];

export const ReceiptHistoryView: React.FC<ReceiptHistoryViewProps> = ({
  receipts,
  onDeleteReceipt,
  onOpenUpload
}) => {
  // Filtres
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedStore, setSelectedStore] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modale de détail du ticket
  const [inspectingReceipt, setInspectingReceipt] = useState<Receipt | null>(null);

  // Modale de confirmation de suppression
  const [receiptToDelete, setReceiptToDelete] = useState<Receipt | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Années disponibles
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    receipts.forEach(r => {
      const y = r.date?.slice(0, 4);
      if (y) years.add(y);
    });
    return Array.from(years).sort().reverse();
  }, [receipts]);

  // Enseignes disponibles
  const availableStores = useMemo(() => {
    const stores = new Set<string>();
    receipts.forEach(r => {
      if (r.storeName) stores.add(normalizeStoreName(r.storeName));
    });
    return Array.from(stores).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  }, [receipts]);

  // Filtrage réactif des tickets (Règle 7)
  const filteredReceipts = useMemo(() => {
    return receipts.filter(r => {
      // Filtre Année
      if (selectedYear !== 'ALL') {
        const y = r.date?.slice(0, 4);
        if (y !== selectedYear) return false;
      }

      // Filtre Mois
      if (selectedMonth !== 'ALL') {
        const m = r.date?.slice(5, 7);
        if (m !== selectedMonth) return false;
      }

      // Filtre Enseigne
      if (selectedStore !== 'ALL') {
        if (normalizeStoreName(r.storeName) !== selectedStore) return false;
      }

      // Recherche par texte
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchStore = r.storeName.toLowerCase().includes(q);
        const matchItem = r.items.some(it => 
          it.normalizedName.toLowerCase().includes(q) || 
          it.rawName.toLowerCase().includes(q) ||
          (it.brand && it.brand.toLowerCase().includes(q))
        );
        if (!matchStore && !matchItem) return false;
      }

      return true;
    });
  }, [receipts, selectedYear, selectedMonth, selectedStore, searchTerm]);

  // Calcul du montant total filtré
  const filteredTotalSpent = useMemo(() => {
    return filteredReceipts.reduce((acc, r) => acc + r.totalAmount, 0);
  }, [filteredReceipts]);

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
            Vos tickets scannés ou saisis manuellement apparaîtront ici pour vous permettre d'auditer le détail de chaque achat ou d'en supprimer si besoin.
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
      {/* EN-TÊTE DE SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <ReceiptIcon size={18} className="text-primary" />
            Historique des Tickets Enregistrés ({receipts.length})
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cliquez sur un ticket pour inspecter chaque ligne comptable ou le supprimer définitivement.
          </p>
        </div>

        <Button onClick={onOpenUpload} size="sm" className="text-xs font-bold gap-1.5 h-9 self-start sm:self-auto">
          <Plus size={14} />
          <span>Importer un ticket de caisse</span>
        </Button>
      </div>

      {/* BARRE DE FILTRES AVANCÉE (RÈGLE 7) */}
      <div className="p-3.5 sm:p-4 rounded-2xl glass-card border border-border/70 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* SÉLECTEURS DE FILTRAGE : MOIS, ANNÉE, ENSEIGNE */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 flex-1 max-w-2xl">
            {/* FILTRE MOIS */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Mois
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
              >
                {MONTHS_FR.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* FILTRE ANNÉE */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Année
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
              >
                <option value="ALL">Toutes les années</option>
                {availableYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* FILTRE ENSEIGNE */}
            <div className="col-span-2 sm:col-span-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Enseigne
              </label>
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium truncate"
              >
                <option value="ALL">Toutes les enseignes ({availableStores.length})</option>
                {availableStores.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* DÉPENSES FILTRÉES EN DIRECT */}
          <div className="p-2.5 px-4 rounded-xl bg-primary/10 border border-primary/20 flex flex-col items-start md:items-end shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
              Dépenses filtrées
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base sm:text-lg font-black font-mono text-foreground">
                {formatCurrency(filteredTotalSpent, { showSign: false })}
              </span>
              <span className="text-[11px] text-muted-foreground font-medium">
                (sur {filteredReceipts.length} ticket{filteredReceipts.length > 1 ? 's' : ''})
              </span>
            </div>
          </div>

        </div>

        {/* CHAMP DE RECHERCHE TEXTUELLE */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par nom de produit, marque ou enseigne..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
          />
        </div>
      </div>

      {/* LISTE DES TICKETS FILTRÉS */}
      {filteredReceipts.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border border-dashed border-border/80 text-xs text-muted-foreground">
          Aucun ticket ne correspond à vos critères de filtrage.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReceipts.map((receipt) => {
            const sumLineItems = receipt.items.reduce((acc, it) => acc + (it.pricePaid ?? it.price ?? 0), 0);

            return (
              <div 
                key={receipt.id}
                onClick={() => setInspectingReceipt(receipt)}
                className="rounded-2xl border border-border/80 dark:border-white/[0.08] bg-card p-4 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                {/* IDENTITÉ DU TICKET */}
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                    <Store size={20} />
                  </div>

                  <div>
                    <h4 className="font-extrabold text-sm sm:text-base text-foreground flex items-center gap-2 flex-wrap">
                      <span>{receipt.storeName}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono">
                        {receipt.items.length} articles
                      </span>
                      {receipt.time && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold flex items-center gap-1">
                          <Clock size={10} />
                          {receipt.time}
                        </span>
                      )}
                    </h4>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1 font-semibold text-foreground/80">
                        <Calendar size={12} className="text-primary" />
                        {formatDateFR(receipt.date)}
                      </span>
                      <span>•</span>
                      <span>Enregistré le {formatDateFR(receipt.createdAt.slice(0, 10))}</span>
                      {receipt.totalDiscounts !== undefined && receipt.totalDiscounts > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            Remises : -{formatCurrency(receipt.totalDiscounts, { showSign: false })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* MONTANT & ACTIONS */}
                <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-border/60">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                      Total Payé
                    </span>
                    <span className="text-base sm:text-lg font-black text-foreground font-mono">
                      {formatCurrency(receipt.totalAmount, { showSign: false })}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* BOUTON DÉTAIL / AUDIT */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspectingReceipt(receipt);
                      }}
                      className="p-2 rounded-xl text-primary hover:bg-primary/10 transition-colors text-xs font-bold flex items-center gap-1"
                      title="Inspecter le ticket"
                    >
                      <ExternalLink size={16} />
                      <span className="hidden md:inline">Inspecter</span>
                    </button>

                    {/* ACTION SUPPRIMER DIRECTE */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReceiptToDelete(receipt);
                      }}
                      className="p-2 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      title="Supprimer définitivement ce ticket"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODALE D'INSPECTION DÉTAILLÉE DU TICKET (RÈGLE 7) */}
      {inspectingReceipt && (
        <ReceiptDetailModal
          receipt={inspectingReceipt}
          isOpen={Boolean(inspectingReceipt)}
          onClose={() => setInspectingReceipt(null)}
          onDeleteReceipt={onDeleteReceipt}
        />
      )}

      {/* MODAL RAPIDE DE CONFIRMATION DE SUPPRESSION */}
      <DeleteConfirmDialog
        isOpen={Boolean(receiptToDelete)}
        title="Supprimer ce ticket de caisse définitivement ?"
        description={`Le ticket « ${receiptToDelete?.storeName} » du ${receiptToDelete ? formatDateFR(receiptToDelete.date) : ''} (${receiptToDelete ? formatCurrency(receiptToDelete.totalAmount) : ''}) sera définitivement supprimé. Tous les prix associés seront instantanément retirés de la matrice comparative et des graphiques.`}
        confirmLabel="🗑️ Supprimer définitivement"
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setReceiptToDelete(null)}
      />
    </div>
  );
};
