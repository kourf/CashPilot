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
  Search,
  Sparkles,
  Zap
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

const getStoreDotColor = (storeName: string): string => {
  const s = storeName.toLowerCase();
  if (s.includes('leclerc')) return 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]';
  if (s.includes('carrefour')) return 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]';
  if (s.includes('lidl')) return 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]';
  if (s.includes('intermarche') || s.includes('intermarché')) return 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]';
  if (s.includes('super u') || s.includes('système u')) return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]';
  if (s.includes('monoprix')) return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]';
  if (s.includes('casino')) return 'bg-green-600 shadow-[0_0_8px_rgba(22,163,74,0.6)]';
  if (s.includes('auchan')) return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]';
  return 'bg-cyan-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]';
};

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
      <div className="glass-surface p-8 sm:p-14 text-center rounded-3xl border border-white/10 space-y-4 backdrop-blur-2xl shadow-xl">
        <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 text-cyan-400 mx-auto flex items-center justify-center shadow-inner">
          <ReceiptIcon size={32} />
        </div>
        <div className="max-w-md mx-auto space-y-1.5">
          <h3 className="text-lg font-bold text-white tracking-tight">
            Aucun ticket dans l'historique
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Vos tickets scannés ou saisis manuellement apparaîtront ici pour vous permettre d'auditer le détail de chaque achat ou d'en supprimer si besoin.
          </p>
        </div>
        <Button 
          onClick={onOpenUpload} 
          className="text-xs font-bold gap-2 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white rounded-2xl shadow-lg shadow-cyan-500/25 border border-white/20 h-10 px-5 cursor-pointer"
        >
          <Plus size={14} />
          <span>Ajouter un ticket</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* EN-TÊTE DE SECTION (APPLE VISIONOS STYLE) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
            <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
              <ReceiptIcon size={18} className="text-cyan-400" />
              <span>Historique des Tickets Enregistrés</span>
              <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-400/30">
                {receipts.length}
              </span>
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Cliquez sur un ticket pour inspecter chaque ligne comptable ou le supprimer définitivement.
          </p>
        </div>

        <Button 
          onClick={onOpenUpload} 
          size="sm" 
          className="bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold gap-1.5 h-9 px-4 rounded-xl shadow-lg shadow-cyan-500/25 border border-white/20 self-start sm:self-auto cursor-pointer"
        >
          <Plus size={14} />
          <span>Importer un ticket</span>
        </Button>
      </div>

      {/* BARRE DE FILTRES EN CAPSULES (STITCH STYLE - 1 LIGNE HARMONISÉE SUR DESKTOP) */}
      <div className="glass-surface rounded-3xl p-4 sm:p-5 border border-white/10 shadow-xl space-y-3.5 backdrop-blur-2xl">
        {/* Grille 4 colonnes harmonisée sur grand écran */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          {/* FILTRE MOIS */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Mois
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full h-11 px-3 py-2 text-xs rounded-xl border border-white/15 bg-slate-900/90 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/40 font-medium cursor-pointer"
            >
              {MONTHS_FR.map(m => (
                <option key={m.value} value={m.value} className="bg-slate-900 text-white">{m.label}</option>
              ))}
            </select>
          </div>

          {/* FILTRE ANNÉE */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Année
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full h-11 px-3 py-2 text-xs rounded-xl border border-white/15 bg-slate-900/90 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/40 font-medium cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900 text-white">Toutes les années</option>
              {availableYears.map(y => (
                <option key={y} value={y} className="bg-slate-900 text-white">{y}</option>
              ))}
            </select>
          </div>

          {/* FILTRE ENSEIGNE */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Enseigne
            </label>
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="w-full h-11 px-3 py-2 text-xs rounded-xl border border-white/15 bg-slate-900/90 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/40 font-medium truncate cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900 text-white">Toutes les enseignes ({availableStores.length})</option>
              {availableStores.map(s => (
                <option key={s} value={s} className="bg-slate-900 text-white">{s}</option>
              ))}
            </select>
          </div>

          {/* DÉPENSES FILTRÉES EN DIRECT (Hauteur harmonisée h-11 avec les sélecteurs) */}
          <div className="h-11 px-4 rounded-xl bg-gradient-to-r from-cyan-500/15 via-white/[0.04] to-violet-500/10 border border-cyan-500/30 shadow-lg backdrop-blur-md flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-cyan-300">
              Dépenses filtrées
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-black font-mono text-white">
                {formatCurrency(filteredTotalSpent, { showSign: false })}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                ({filteredReceipts.length} ticket{filteredReceipts.length > 1 ? 's' : ''})
              </span>
            </div>
          </div>
        </div>

        {/* CHAMP DE RECHERCHE TEXTUELLE */}
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par nom de produit, marque ou enseigne..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-white/15 bg-white/5 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 font-medium"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* LISTE DES TICKETS FILTRÉS (APPLE VISIONOS STYLE - ÉTENDUE PLEINE LARGEUR) */}
      {filteredReceipts.length === 0 ? (
        <div className="glass-surface p-12 text-center rounded-3xl border border-white/10 text-xs text-slate-400 space-y-2">
          <Filter size={28} className="mx-auto mb-2 opacity-40 text-cyan-400" />
          <p className="font-semibold text-white">Aucun ticket ne correspond à vos critères de filtrage.</p>
          <p className="text-[11px] text-slate-400">Ajustez vos filtres de mois, année ou enseigne pour réafficher vos tickets.</p>
        </div>
      ) : (
        <div className="space-y-2.5 w-full">
          {filteredReceipts.map((receipt) => {
            const dotColor = getStoreDotColor(receipt.storeName);

            return (
              <div 
                key={receipt.id}
                onClick={() => setInspectingReceipt(receipt)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.035] backdrop-blur-xl p-3.5 sm:p-4 hover:bg-white/[0.07] hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-950/30 transition-all duration-200 cursor-pointer group flex flex-col md:flex-row md:items-center justify-between gap-3 relative overflow-hidden"
              >
                {/* IDENTITÉ DU TICKET */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-cyan-300 shrink-0 shadow-inner group-hover:scale-105 group-hover:border-cyan-400/40 transition-transform">
                    <Store size={20} />
                  </div>

                  <div className="min-w-0 space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("w-2 h-2 rounded-full shrink-0", dotColor)} />
                        <h4 className="font-extrabold text-sm sm:text-base text-white tracking-tight leading-snug truncate max-w-[240px] sm:max-w-md">
                          {receipt.storeName}
                        </h4>
                      </div>

                      <span className="glass-pill text-[10px] text-cyan-300 font-mono font-bold">
                        {receipt.items.length} articles
                      </span>

                      {receipt.time && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 font-bold">
                          <Clock size={10} />
                          {receipt.time}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400 font-mono flex-wrap">
                      <span className="flex items-center gap-1 font-semibold text-slate-200">
                        <Calendar size={12} className="text-cyan-400" />
                        {formatDateFR(receipt.date)}
                      </span>
                      <span>•</span>
                      <span>Enregistré le {formatDateFR(receipt.createdAt.slice(0, 10))}</span>
                      {receipt.totalDiscounts !== undefined && receipt.totalDiscounts > 0 && (
                        <>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            <Zap size={8} className="fill-amber-400" />
                            Remises : -{formatCurrency(receipt.totalDiscounts, { showSign: false })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* MONTANT & ACTIONS */}
                <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-2.5 md:pt-0 border-white/5 shrink-0">
                  <div className="text-left md:text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                      Total Payé
                    </span>
                    <span className="text-base sm:text-lg font-black text-white font-mono tracking-tight">
                      {formatCurrency(receipt.totalAmount, { showSign: false })}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* BOUTON DÉTAIL / AUDIT */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspectingReceipt(receipt);
                      }}
                      className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/30 text-cyan-300 hover:text-white transition-all text-xs font-bold cursor-pointer shadow-sm active:scale-95"
                      title="Inspecter le ticket"
                    >
                      <ExternalLink size={13} />
                      <span className="hidden xs:inline">Inspecter</span>
                    </button>

                    {/* ACTION SUPPRIMER DIRECTE */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReceiptToDelete(receipt);
                      }}
                      className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 border border-transparent hover:border-rose-500/30 transition-all cursor-pointer active:scale-95"
                      title="Supprimer définitivement ce ticket"
                    >
                      <Trash2 size={15} />
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
