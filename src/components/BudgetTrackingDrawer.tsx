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
  TrendingDown
} from 'lucide-react';
import { formatCurrency, type BankTransaction } from '../lib/bankUtils';
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
}

const DEFAULT_POSTS = [
  { id: 'loyer', name: 'Loyer / Crédit Immobilier', group: 'logement', icon: Home, defaultBudget: 0 },
  { id: 'elec', name: 'Électricité / Gaz', group: 'logement', icon: Zap, defaultBudget: 0 },
  { id: 'eau', name: 'Eau', group: 'logement', icon: Droplet, defaultBudget: 0 },
  { id: 'assurance', name: 'Assurances', group: 'sante', icon: Shield, defaultBudget: 0 },
  { id: 'sante', name: 'Santé & Mutuelle', group: 'sante', icon: HeartPulse, defaultBudget: 0 },
  { id: 'courses', name: 'Courses Alimentaires', group: 'alimentation', icon: ShoppingCart, defaultBudget: 0 },
  { id: 'carburant', name: 'Carburant / Péages', group: 'transport', icon: Car, defaultBudget: 0 },
  { id: 'transports', name: 'Transports en commun', group: 'transport', icon: Car, defaultBudget: 0 },
  { id: 'telecom', name: 'Abonnements & Télécom', group: 'abonnements', icon: Tv, defaultBudget: 0 }
];

export const BudgetTrackingDrawer: React.FC<BudgetTrackingDrawerProps> = ({
  isOpen,
  onClose,
  onBack,
  monthTransactions,
  allTransactions
}) => {
  const [costOfLivingItems, setCostOfLivingItems] = useState<any[]>([]);

  // 1. Charger les postes budgétés depuis l'outil Coût de la vie (localStorage)
  useEffect(() => {
    if (!isOpen) return;

    const saved = localStorage.getItem('cashpilot_cost_of_living');
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
    allTransactions.forEach(t => {
      if (t.amount < 0 && !t.isInternalTransfer) {
        const amt = Math.abs(t.amount);
        sums[t.category] = (sums[t.category] || 0) + amt;
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

  // 2. Calcul dynamique ligne par ligne : Budget Alloué vs Dépense Réelle du mois
  const budgetRows: BudgetItemRow[] = useMemo(() => {
    // Liste des dépenses réelles du mois
    const expenseTxs = monthTransactions.filter(t => t.amount < 0 && !t.isInternalTransfer);

    const postList = costOfLivingItems.length > 0 ? costOfLivingItems : DEFAULT_POSTS;
    const matchedTxIds = new Set<string>();

    const rows: BudgetItemRow[] = postList.map((item, idx) => {
      const itemName = item.name || 'Poste';
      const budgeted = Number(item.amount) || 0;

      // Calcul dynamique des dépenses réelles rattachées à ce poste via synonymes & catégories
      let realSpent = 0;
      expenseTxs.forEach(tx => {
        if (matchesCostOfLivingItem(tx as any, itemName)) {
          realSpent += Math.abs(tx.amount);
          if (tx.id) matchedTxIds.add(tx.id);
        }
      });

      // Icône contextuelle
      let Icon = Layers;
      if (itemName.includes('Loyer') || itemName.includes('Logement')) Icon = Home;
      else if (itemName.includes('Électricité') || itemName.includes('Gaz')) Icon = Zap;
      else if (itemName.includes('Eau')) Icon = Droplet;
      else if (itemName.includes('Assurance')) Icon = Shield;
      else if (itemName.includes('Santé') || itemName.includes('Mutuelle')) Icon = HeartPulse;
      else if (itemName.includes('Courses') || itemName.includes('Alimentation')) Icon = ShoppingCart;
      else if (itemName.includes('Carburant') || itemName.includes('Transports')) Icon = Car;
      else if (itemName.includes('Abonnement') || itemName.includes('Télécom')) Icon = Tv;

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
        icon: Icon
      };
    });

    // Optionnel: ajouter les autres dépenses réelles non ventilées dans les postes de base
    const otherExpenses = expenseTxs.filter(t => !t.id || !matchedTxIds.has(t.id));
    if (otherExpenses.length > 0) {
      const otherTotal = otherExpenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      rows.push({
        id: 'autres_depenses',
        name: 'Autres Dépenses Courantes',
        categoryGroup: 'autre',
        budgetAllocated: 0,
        realSpent: Math.round(otherTotal * 100) / 100,
        diff: -Math.round(otherTotal * 100) / 100,
        percentage: 100,
        icon: ArrowUpRight
      });
    }

    return rows;
  }, [costOfLivingItems, monthTransactions]);

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
                <span className="font-bold text-xs sm:text-sm">
                  Attention, dépassement global de {formatCurrency(Math.abs(totalRemaining), { showSign: false })}.
                </span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
                <Target className="w-4 h-4 shrink-0 text-emerald-400" />
                <span className="font-bold text-xs sm:text-sm">
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
              Ventilation par poste de dépense
            </h3>
            <span className="text-[11px] text-muted-foreground font-medium">
              {budgetRows.length} postes audités
            </span>
          </div>

          {/* Tableau sur écran moyen/grand & Cartes sur mobile */}
          <div className="space-y-2">
            {/* Header du tableau */}
            <div className="hidden sm:grid sm:grid-cols-12 gap-3 px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/40">
              <div className="col-span-4">Poste</div>
              <div className="col-span-2 text-right">Budget Alloué</div>
              <div className="col-span-2 text-right">Dépense Réelle</div>
              <div className="col-span-2 text-right">Écart</div>
              <div className="col-span-2 text-center">Jauge</div>
            </div>

            {budgetRows.map((row) => {
              const Icon = row.icon;
              const isOver = row.diff < 0;
              const isUnder85 = row.percentage < 85;
              const isAmber = row.percentage >= 85 && row.percentage <= 100;
              
              const progressWidth = Math.min(row.percentage, 100);
              const barColor = isOver ? 'bg-rose-500' : (isAmber ? 'bg-amber-500' : 'bg-emerald-500');
              const badgeBg = isOver ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';

              return (
                <div 
                  key={row.id}
                  className="p-3 sm:px-3 sm:py-2.5 rounded-xl bg-card border border-border/70 hover:border-border transition-all flex flex-col sm:grid sm:grid-cols-12 sm:items-center gap-2.5"
                >
                  {/* Colonne Poste */}
                  <div className="col-span-4 flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-secondary/80 text-foreground flex items-center justify-center shrink-0 border border-border/50">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-xs sm:text-sm text-foreground truncate block">
                        {row.name}
                      </span>
                      {row.budgetAllocated === 0 && row.realSpent > 0 && (
                        <span className="text-[9px] text-amber-500 font-semibold block">
                          Non calibré au simulateur
                        </span>
                      )}
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
                  </div>
                </div>
              );
            })}
          </div>

          {/* Info note */}
          <div className="mt-6 text-center text-xs text-muted-foreground border-t border-border/50 pt-4 pb-2">
            Le budget théorique est calculé à partir de l'outil <strong>Coût de la vie</strong>. Modifiez-y vos charges pour calibrer vos plafonds mensuels.
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
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-secondary hover:bg-secondary/80 text-foreground transition-colors border border-border/60"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
};
