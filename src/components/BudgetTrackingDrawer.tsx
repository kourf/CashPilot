import React, { useMemo, useState, useEffect } from 'react';
import { 
  X, 
  PiggyBank, 
  AlertTriangle, 
  Target, 
  CheckCircle2,
  Home, 
  HeartPulse, 
  ShoppingCart, 
  Car, 
  Tv, 
  Shield, 
  Droplet, 
  Zap, 
  Layers,
  ArrowUpRight,
  ArrowLeft,
  TrendingDown,
  Utensils,
  ShoppingBag,
  Sparkles,
  Landmark,
  Scale,
  Receipt,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { formatCurrency, formatDateFR, isDebitTransaction, type BankTransaction } from '../lib/bankUtils';
import { matchesCostOfLivingItem } from '../lib/kpiUtils';

export interface BudgetTrackingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  monthTransactions: BankTransaction[];
  allTransactions: BankTransaction[];
}

interface BudgetItemRow {
  id: string;
  name: string;
  categoryGroup?: string;
  budgetAllocated: number;
  realSpent: number;
  diff: number; // budgetAllocated - realSpent (>0: restant, <0: dépassé)
  percentage: number;
  icon: React.ElementType;
  isFromRB: boolean;
  txCount: number;
  transactions: BankTransaction[];
}

const DEFAULT_POSTS = [
  { id: 'loyer', name: 'Loyer / Crédit Immobilier', group: 'logement', icon: Home, defaultBudget: 0 },
  { id: 'elec', name: 'Électricité / Gaz', group: 'logement', icon: Zap, defaultBudget: 0 },
  { id: 'eau', name: 'Eau & Charges', group: 'logement', icon: Droplet, defaultBudget: 0 },
  { id: 'assurance', name: 'Assurances', group: 'sante', icon: Shield, defaultBudget: 0 },
  { id: 'sante', name: 'Santé & Mutuelle', group: 'sante', icon: HeartPulse, defaultBudget: 0 },
  { id: 'courses', name: 'Courses Alimentaires', group: 'alimentation', icon: ShoppingCart, defaultBudget: 0 },
  { id: 'restaurants', name: 'Restaurants & Restauration', group: 'restaurants', icon: Utensils, defaultBudget: 0 },
  { id: 'cafes', name: 'Cafés, Bars & Sorties', group: 'restaurants', icon: Utensils, defaultBudget: 0 },
  { id: 'carburant', name: 'Carburant & Péages', group: 'transport', icon: Car, defaultBudget: 0 },
  { id: 'transports', name: 'Transports en commun', group: 'transport', icon: Car, defaultBudget: 0 },
  { id: 'telecom', name: 'Box Internet & Mobiles', group: 'abonnements', icon: Tv, defaultBudget: 0 },
  { id: 'streaming', name: 'Streaming, Cloud & Services', group: 'abonnements', icon: Tv, defaultBudget: 0 },
  { id: 'loisirs', name: 'Loisirs, Sorties & Culture', group: 'loisirs', icon: Sparkles, defaultBudget: 0 },
  { id: 'sport', name: 'Sport & Bien-être', group: 'loisirs', icon: Sparkles, defaultBudget: 0 },
  { id: 'shopping', name: 'Shopping & Équipement', group: 'shopping', icon: ShoppingBag, defaultBudget: 0 },
  { id: 'frais_bancaires', name: 'Frais bancaires & Cotisations', group: 'bancaire', icon: Landmark, defaultBudget: 0 }
];

const getCategoryIcon = (name: string): React.ElementType => {
  const norm = (name || '').toLowerCase();
  if (norm.includes('loyer') || norm.includes('logement') || norm.includes('crédit immo') || norm.includes('credit immo')) return Home;
  if (norm.includes('élec') || norm.includes('elec') || norm.includes('gaz') || norm.includes('energie') || norm.includes('énergie')) return Zap;
  if (norm.includes('eau')) return Droplet;
  if (norm.includes('assur')) return Shield;
  if (norm.includes('santé') || norm.includes('mutuelle') || norm.includes('sante') || norm.includes('pharma')) return HeartPulse;
  if (norm.includes('course') || norm.includes('aliment') || norm.includes('supermarché') || norm.includes('courses')) return ShoppingCart;
  if (norm.includes('carburant') || norm.includes('transport') || norm.includes('péage') || norm.includes('peage') || norm.includes('essence')) return Car;
  if (norm.includes('abonnement') || norm.includes('télécom') || norm.includes('telecom') || norm.includes('streaming') || norm.includes('forfait')) return Tv;
  if (norm.includes('restaurant') || norm.includes('sortie') || norm.includes('bar') || norm.includes('café') || norm.includes('fast food') || norm.includes('boulangerie')) return Utensils;
  if (norm.includes('shopping') || norm.includes('maison') || norm.includes('vêtement') || norm.includes('mode')) return ShoppingBag;
  if (norm.includes('loisir') || norm.includes('activité') || norm.includes('sport') || norm.includes('vacances')) return Sparkles;
  if (norm.includes('frais') || norm.includes('banque') || norm.includes('bancaire')) return Landmark;
  if (norm.includes('impôt') || norm.includes('amende') || norm.includes('taxe')) return Scale;
  return Receipt;
};

export const BudgetTrackingDrawer: React.FC<BudgetTrackingDrawerProps> = ({
  isOpen,
  onClose,
  onBack,
  monthTransactions,
  allTransactions
}) => {
  const [costOfLivingItems, setCostOfLivingItems] = useState<any[]>([]);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Helper montant unifié
  const getTxAmount = (t: BankTransaction) => Math.abs(Number(t.amount !== undefined ? t.amount : t.rawAmount) || 0);

  // Helper filtre dépense universel
  const isExpense = (t: BankTransaction) => {
    if (!isDebitTransaction(t)) return false;
    if (t.isInternalTransfer) return false;
    if (t.flowType === 'SAVINGS_TRANSFER' || t.flowType === 'INCOME') return false;
    const cat = (t.category || '').toLowerCase();
    if (cat.includes('virement interne') || cat.includes('épargne')) return false;
    return true;
  };

  // 1. Charger les postes budgétés depuis l'outil Coût de la vie (localStorage)
  useEffect(() => {
    if (!isOpen) return;

    const saved = localStorage.getItem('cashpilot_cost_of_living_v2') || localStorage.getItem('cashpilot_cost_of_living');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCostOfLivingItems(parsed);
          return;
        }
      } catch (e) {}
    }

    // Fallback: calcul des moyennes historiques si l'utilisateur n'a pas encore calibré son coût de la vie
    const sums: Record<string, number> = {};
    const months = new Set<string>();
    (allTransactions || []).forEach(t => {
      if (isExpense(t)) {
        const amt = getTxAmount(t);
        const cat = t.category || 'Autre';
        sums[cat] = (sums[cat] || 0) + amt;
        if (t.monthKey) months.add(t.monthKey);
      }
    });
    const numMonths = Math.max(1, months.size);

    const fallbackItems = DEFAULT_POSTS.map(post => {
      let avg = 0;
      if (post.name.includes('Loyer')) avg = (sums['Loyer / Charges'] || sums['Logement & Énergie'] || 0) / numMonths;
      else if (post.name.includes('Électricité') || post.name.includes('Gaz')) avg = ((sums['Électricité, Gaz, Eau'] || sums['Logement & Énergie'] || 0) / numMonths) / 2;
      else if (post.name.includes('Eau')) avg = ((sums['Électricité, Gaz, Eau'] || 0) / numMonths) / 2;
      else if (post.name.includes('Assurance')) avg = (sums['Assurances'] || 0) / numMonths;
      else if (post.name.includes('Santé')) avg = (sums['Santé & Mutuelle'] || sums['Santé'] || 0) / numMonths;
      else if (post.name.includes('Courses')) avg = (sums['Alimentation & Courses'] || 0) / numMonths;
      else if (post.name.includes('Carburant')) avg = (sums['Carburant & Péages'] || sums['Transports & Carburant'] || 0) / numMonths;
      else if (post.name.includes('Transports en commun')) avg = (sums['Transports'] || 0) / numMonths;
      else if (post.name.includes('Abonnements')) avg = (sums['Abonnements & Télécom'] || sums['Abonnements'] || 0) / numMonths;

      return {
        id: post.id,
        name: post.name,
        amount: Math.round(avg),
        categoryGroup: post.group
      };
    });

    setCostOfLivingItems(fallbackItems);
  }, [isOpen, allTransactions]);

  // 2. Calcul dynamique ligne par ligne : Budget Alloué vs Dépense Réelle du relevé
  const budgetRows: BudgetItemRow[] = useMemo(() => {
    // Détecter toutes les dépenses réelles du relevé
    const targetTxs = (monthTransactions && monthTransactions.length > 0) ? monthTransactions : (allTransactions || []);
    const expenseTxs = targetTxs.filter(isExpense);

    const postList = costOfLivingItems.length > 0 ? costOfLivingItems : DEFAULT_POSTS;
    const matchedTxIds = new Set<string>();

    // A. Traiter les postes calibrés au simulateur
    const rows: BudgetItemRow[] = postList.map((item, idx) => {
      const itemName = item.name || 'Poste';
      const budgeted = Number(item.amount) || 0;

      let realSpent = 0;
      const rowTxs: BankTransaction[] = [];

      expenseTxs.forEach(tx => {
        if (matchesCostOfLivingItem(tx as any, itemName)) {
          const amt = getTxAmount(tx);
          realSpent += amt;
          rowTxs.push(tx);
          if (tx.id) matchedTxIds.add(tx.id);
        }
      });

      const Icon = getCategoryIcon(itemName);
      const diff = budgeted - realSpent;
      const percentage = budgeted > 0 ? (realSpent / budgeted) * 100 : (realSpent > 0 ? 100 : 0);

      return {
        id: item.id || `post_${idx}`,
        name: itemName,
        categoryGroup: item.categoryGroup,
        budgetAllocated: budgeted,
        realSpent: Math.round(realSpent * 100) / 100,
        diff: Math.round(diff * 100) / 100,
        percentage,
        icon: Icon,
        isFromRB: false,
        txCount: rowTxs.length,
        transactions: rowTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      };
    });

    // B. Ventiler TOUTES les autres dépenses réelles du relevé par leur vraie catégorie du RB !
    const remainingExpenses = expenseTxs.filter(t => !t.id || !matchedTxIds.has(t.id));
    const rbCategoryGroups = new Map<string, BankTransaction[]>();

    remainingExpenses.forEach(tx => {
      const cat = tx.category || 'Autre';
      const list = rbCategoryGroups.get(cat) || [];
      list.push(tx);
      rbCategoryGroups.set(cat, list);
    });

    // Trier les catégories réelles du RB par montant dépensé décroissant
    const sortedRBCategories = Array.from(rbCategoryGroups.entries())
      .map(([catName, txList]) => {
        const spent = txList.reduce((sum, tx) => sum + getTxAmount(tx), 0);
        return { catName, txList, spent };
      })
      .sort((a, b) => b.spent - a.spent);

    sortedRBCategories.forEach(({ catName, txList, spent }, idx) => {
      rows.push({
        id: `rb_cat_${idx}_${catName}`,
        name: catName,
        categoryGroup: 'rb_real',
        budgetAllocated: 0,
        realSpent: Math.round(spent * 100) / 100,
        diff: -Math.round(spent * 100) / 100,
        percentage: 100,
        icon: getCategoryIcon(catName),
        isFromRB: true,
        txCount: txList.length,
        transactions: txList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      });
    });

    return rows;
  }, [costOfLivingItems, monthTransactions, allTransactions]);

  // 3. Totaux globaux réconciliés
  const totalAllocated = useMemo(() => {
    return budgetRows.reduce((sum, r) => sum + r.budgetAllocated, 0);
  }, [budgetRows]);

  const totalRealSpent = useMemo(() => {
    return budgetRows.reduce((sum, r) => sum + r.realSpent, 0);
  }, [budgetRows]);

  const totalRemaining = totalAllocated - totalRealSpent;
  const isGlobalOverBudget = totalRemaining < 0;
  const globalPercentage = totalAllocated > 0 ? (totalRealSpent / totalAllocated) * 100 : 0;
  const globalVisualPercentage = Math.min(globalPercentage, 100);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop sombre flouté */}
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative z-10 w-full max-w-3xl bg-card border-l border-border/80 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300 text-foreground overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border/60 bg-secondary/30 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="p-2.5 -ml-1 rounded-2xl bg-secondary/80 hover:bg-secondary text-foreground transition-all flex items-center gap-1.5 text-xs font-bold shrink-0 shadow-sm active:scale-95 cursor-pointer"
                  title="Retour à la liste des outils"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Retour</span>
                </button>
              )}
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-md shrink-0 mt-0.5">
                <PiggyBank className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
                  Fixation de Budget
                </h2>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Comparez vos dépenses réelles à votre budget théorique catégorie par catégorie.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors shrink-0"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Summary Banner */}
        <div className="p-4 sm:p-5 border-b border-border/60 bg-secondary/15 shrink-0 space-y-3">
          {/* Alerte synthétique */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            {isGlobalOverBudget ? (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span className="text-xs font-extrabold">
                  Budget dépassé de {formatCurrency(Math.abs(totalRemaining), { showSign: false })} sur ce relevé
                </span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span className="text-xs font-extrabold">
                  Il vous reste {formatCurrency(totalRemaining, { showSign: false })} sur votre budget de ce mois.
                </span>
              </div>
            )}

            <div className="text-right">
              <span className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${
                globalPercentage > 100 ? 'text-rose-400' : (globalPercentage >= 85 ? 'text-amber-400' : 'text-emerald-400')
              }`}>
                {globalPercentage.toFixed(0)}%
              </span>
              <span className="text-[10px] text-muted-foreground block font-medium">du budget consommé</span>
            </div>
          </div>

          {/* Jauge globale */}
          <div className="w-full h-2.5 rounded-full bg-secondary/80 overflow-hidden shadow-inner">
            <div 
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                globalPercentage > 100 ? 'bg-rose-500' : (globalPercentage >= 85 ? 'bg-amber-500' : 'bg-emerald-500')
              }`}
              style={{ width: `${globalVisualPercentage}%` }}
            />
          </div>

          {/* Cartes métriques de synthèse */}
          <div className="grid grid-cols-3 gap-2 pt-1 text-center">
            <div className="p-2.5 rounded-xl bg-card border border-border/70">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Budget Alloué</span>
              <span className="text-sm sm:text-base font-black font-mono text-foreground">
                {formatCurrency(totalAllocated, { showSign: false })}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-card border border-border/70">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Dépense Réelle</span>
              <span className="text-sm sm:text-base font-black font-mono text-foreground">
                {formatCurrency(totalRealSpent, { showSign: false })}
              </span>
            </div>
            <div className={`p-2.5 rounded-xl border ${
              totalRemaining >= 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}>
              <span className="text-[10px] uppercase font-bold block opacity-80">Écart Net</span>
              <span className="text-sm sm:text-base font-black font-mono">
                {totalRemaining >= 0 ? '+' : '-'}{formatCurrency(Math.abs(totalRemaining), { showSign: false })}
              </span>
            </div>
          </div>
        </div>

        {/* Content Area : Ventilation Ligne par Ligne (Tableau Réel vs Budgété) */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3 overscroll-contain">
          <div className="flex items-center justify-between pb-1">
            <h3 className="text-xs uppercase font-extrabold text-muted-foreground tracking-wider">
              Ventilation par poste et catégorie réelle du relevé
            </h3>
            <span className="text-[11px] text-muted-foreground font-medium">
              {budgetRows.length} postes audités
            </span>
          </div>

          {/* Tableau sur écran moyen/grand & Cartes sur mobile */}
          <div className="space-y-2">
            {/* Header du tableau */}
            <div className="hidden sm:grid sm:grid-cols-12 gap-3 px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/40">
              <div className="col-span-4">Poste / Catégorie Relevé</div>
              <div className="col-span-2 text-right">Budget Alloué</div>
              <div className="col-span-2 text-right">Dépense Réelle</div>
              <div className="col-span-2 text-right">Écart</div>
              <div className="col-span-2 text-center">Jauge</div>
            </div>

            {budgetRows.map((row) => {
              const Icon = row.icon;
              const isOver = row.diff < 0;
              const isAmber = row.percentage >= 85 && row.percentage <= 100;
              
              const progressWidth = Math.min(row.percentage, 100);
              const barColor = isOver ? 'bg-rose-500' : (isAmber ? 'bg-amber-500' : 'bg-emerald-500');
              const badgeBg = isOver ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
              const isExpanded = expandedRowId === row.id;

              return (
                <div 
                  key={row.id}
                  className="rounded-xl bg-card border border-border/70 hover:border-border transition-all overflow-hidden"
                >
                  <div 
                    onClick={() => setExpandedRowId(isExpanded ? null : row.id)}
                    className="p-3 sm:px-3 sm:py-2.5 flex flex-col sm:grid sm:grid-cols-12 sm:items-center gap-2.5 cursor-pointer select-none hover:bg-secondary/20 transition-colors"
                  >
                    {/* Colonne Poste */}
                    <div className="col-span-4 flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                        row.isFromRB ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-secondary/80 border-border/50 text-primary'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-xs sm:text-sm text-foreground truncate block">
                            {row.name}
                          </span>
                          {row.isFromRB && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
                              Relevé Bancaire
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                          <span>{row.txCount} opération{row.txCount > 1 ? 's' : ''}</span>
                          {row.budgetAllocated === 0 && row.realSpent > 0 && !row.isFromRB && (
                            <span className="text-amber-500 font-semibold">
                              Non calibré au simulateur
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Mobile Row : Données récapitulatives sur téléphone */}
                    <div className="grid grid-cols-3 gap-2 sm:hidden text-center pt-1 border-t border-border/40">
                      <div>
                        <span className="text-[9px] text-muted-foreground uppercase block">Alloué</span>
                        <span className="font-mono text-xs font-bold text-foreground">
                          {formatCurrency(row.budgetAllocated, { showSign: false })}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-muted-foreground uppercase block">Réel</span>
                        <span className="font-mono text-xs font-bold text-foreground">
                          {formatCurrency(row.realSpent, { showSign: false })}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-muted-foreground uppercase block">Écart</span>
                        <span className={`font-mono text-xs font-bold ${isOver ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {row.diff >= 0 ? '+' : '-'}{formatCurrency(Math.abs(row.diff), { showSign: false })}
                        </span>
                      </div>
                    </div>

                    {/* Desktop Colonne Budget Alloué */}
                    <div className="hidden sm:block col-span-2 text-right font-mono text-xs sm:text-sm font-bold text-foreground">
                      {formatCurrency(row.budgetAllocated, { showSign: false })}
                    </div>

                    {/* Desktop Colonne Dépense Réelle */}
                    <div className="hidden sm:block col-span-2 text-right font-mono text-xs sm:text-sm font-bold text-foreground">
                      {formatCurrency(row.realSpent, { showSign: false })}
                    </div>

                    {/* Desktop Colonne Écart */}
                    <div className="hidden sm:flex col-span-2 justify-end">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg border font-mono ${badgeBg}`}>
                        {row.diff >= 0 ? '+' : '-'}{formatCurrency(Math.abs(row.diff), { showSign: false })}
                      </span>
                    </div>

                    {/* Colonne Jauge Visuelle */}
                    <div className="col-span-2 flex items-center gap-2 pt-1 sm:pt-0">
                      <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden shadow-inner">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                          style={{ width: `${progressWidth}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-mono font-bold shrink-0 w-8 text-right ${
                        isOver ? 'text-rose-400' : (isAmber ? 'text-amber-400' : 'text-emerald-400')
                      }`}>
                        {row.percentage.toFixed(0)}%
                      </span>
                      <div className="text-muted-foreground">
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  </div>

                  {/* Section Dépliante : Liste des opérations réelles du relevé */}
                  {isExpanded && (
                    <div className="p-3 bg-secondary/30 border-t border-border/50 text-xs space-y-2 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider pb-1 border-b border-border/30">
                        <span>Écritures bancaires réelles associées ({row.txCount})</span>
                        <span>Montant débit</span>
                      </div>
                      {row.transactions.length === 0 ? (
                        <p className="text-muted-foreground text-center py-2 text-[11px]">
                          Aucune écriture bancaire enregistrée sur ce poste pour ce relevé.
                        </p>
                      ) : (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {row.transactions.map((tx, txIdx) => {
                            const amt = getTxAmount(tx);
                            return (
                              <div key={tx.id || txIdx} className="flex items-center justify-between gap-2 py-1 px-2 rounded-lg bg-card/60 border border-border/40 hover:bg-card transition-colors">
                                <div className="min-w-0 flex items-center gap-2">
                                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                                    {formatDateFR(tx.date)}
                                  </span>
                                  <span className="font-semibold text-foreground truncate text-[11px]" title={tx.rawLabel || tx.description}>
                                    {tx.cleanLabel || tx.description || tx.rawLabel || 'Opération'}
                                  </span>
                                </div>
                                <span className="font-mono font-bold text-foreground shrink-0 text-xs">
                                  -{formatCurrency(amt, { showSign: false })}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Info note */}
          <div className="mt-6 text-center text-xs text-muted-foreground border-t border-border/50 pt-4 pb-2">
            Le budget théorique est calibré à partir de l'outil <strong>Coût de la vie</strong>. Les catégories non budgétées sont issues directement de votre <strong>Relevé Bancaire (RB)</strong> afin de réconcilier 100% de vos dépenses réelles.
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/60 bg-secondary/30 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Ventilation budgétaire conforme à vos relevés</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-secondary hover:bg-secondary/80 text-foreground transition-colors border border-border/60 cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
