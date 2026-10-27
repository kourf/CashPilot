import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  ArrowLeftRight, 
  Users, 
  TrendingUp, 
  TrendingDown, 
  Lock, 
  CreditCard, 
  ShoppingCart, 
  Home, 
  Shield, 
  Smartphone, 
  Building2, 
  FileCheck, 
  CalendarClock, 
  Car, 
  UtensilsCrossed, 
  ShoppingBag, 
  Ticket, 
  HeartPulse, 
  Banknote, 
  HelpCircle, 
  PiggyBank, 
  HandCoins, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ArrowLeft,
  Info, 
  CheckCircle2,
  Tag,
  Calendar,
  Landmark,
  Calculator,
  Scale,
  User,
  AlertTriangle,
  Copy,
  Check
} from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { formatCurrency, formatDateFR, detectSubscriptionEvolution } from '../lib/bankUtils';
import { 
  calculateInternalTransfers, 
  calculatePeerTransfers, 
  extractPersonName,
  type CategoryStatsItem, 
  type InternalTransfersSummary, 
  type PeerTransfersSummary,
  type PersonPeerBalance 
} from '../lib/categorizationRules';

export interface CategoryAuditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  auditType: 'category' | 'inter-accounts' | 'peer-transfers' | 'kpi-income' | 'kpi-expenses' | 'kpi-savings' | 'kpi-essential' | 'kpi-comfort' | 'subscriptions';
  categoryData?: CategoryStatsItem | null;
  interTransfersData?: InternalTransfersSummary | null;
  peerTransfersData?: PeerTransfersSummary | null;
  customTransactions?: any[];
  customTitle?: string;
  customSubtitle?: string;
  customTotalAmount?: number;
  allTransactions?: any[];
}

const ICON_MAP: Record<string, React.ElementType> = {
  Home,
  Shield,
  Smartphone,
  Building2,
  FileCheck,
  CalendarClock,
  ShoppingCart,
  Car,
  UtensilsCrossed,
  ShoppingBag,
  Ticket,
  HeartPulse,
  Banknote,
  HelpCircle,
  ArrowLeftRight,
  PiggyBank,
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  Users,
  HandCoins,
  TrendingUp,
  Tag
};

export const CategoryAuditDrawer: React.FC<CategoryAuditDrawerProps> = ({
  isOpen,
  onClose,
  onBack,
  auditType,
  categoryData,
  interTransfersData,
  peerTransfersData,
  customTransactions,
  customTitle,
  customSubtitle,
  customTotalAmount,
  allTransactions
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [natureFilter, setNatureFilter] = useState<'all' | 'fixe' | 'variable'>('all');
  const [copiedAdviceId, setCopiedAdviceId] = useState<string | null>(null);
  const [expandedNegotiateId, setExpandedNegotiateId] = useState<string | null>(null);

  // Mouvements Inter-Comptes : Solde initial et filtre directionnel (Entrées vs Sorties)
  const [initialBalanceInput, setInitialBalanceInput] = useState<string>(() => {
    return localStorage.getItem('cashpilot_interaccounts_initial_balance') || '0';
  });
  const [interAccountFlowTab, setInterAccountFlowTab] = useState<'all' | 'inflows' | 'outflows'>('all');

  // Échanges Famille & Amis : Filtre interactif par personne
  const [selectedPersonFilter, setSelectedPersonFilter] = useState<string | null>(null);

  // Analyse et suivi de l'évolution des prix pour les abonnements et prélèvements
  const subscriptionEvolutions = useMemo(() => {
    if (auditType !== 'subscriptions') return new Map<string, ReturnType<typeof detectSubscriptionEvolution>>();
    const map = new Map<string, ReturnType<typeof detectSubscriptionEvolution>>();
    const pool = (allTransactions && allTransactions.length > 0) ? allTransactions : (customTransactions || []);
    
    (customTransactions || []).forEach(tx => {
      const evo = detectSubscriptionEvolution(tx, pool);
      map.set(tx.id, evo);
    });
    return map;
  }, [auditType, customTransactions, allTransactions]);

  const subscriptionStats = useMemo(() => {
    if (auditType !== 'subscriptions') {
      return {
        increasesCount: 0,
        totalIncreaseImpact: 0,
        decreasesCount: 0,
        totalDecreaseSavings: 0,
        stableCount: 0,
        newOrSingleCount: 0,
        hasMultiMonthData: false
      };
    }
    let increasesCount = 0;
    let totalIncreaseImpact = 0;
    let decreasesCount = 0;
    let totalDecreaseSavings = 0;
    let stableCount = 0;
    let newOrSingleCount = 0;
    let hasMultiMonthData = false;

    subscriptionEvolutions.forEach(evo => {
      if (evo.history && evo.history.length > 1) {
        hasMultiMonthData = true;
      }
      if (evo.status === 'INCREASED') {
        increasesCount++;
        totalIncreaseImpact += Math.abs(evo.difference || 0);
      } else if (evo.status === 'DECREASED') {
        decreasesCount++;
        totalDecreaseSavings += Math.abs(evo.difference || 0);
      } else if (evo.status === 'STABLE') {
        stableCount++;
      } else {
        newOrSingleCount++;
      }
    });

    return {
      increasesCount,
      totalIncreaseImpact,
      decreasesCount,
      totalDecreaseSavings,
      stableCount,
      newOrSingleCount,
      hasMultiMonthData
    };
  }, [auditType, subscriptionEvolutions]);

  const handleInitialBalanceChange = (val: string) => {
    setInitialBalanceInput(val);
    try {
      localStorage.setItem('cashpilot_interaccounts_initial_balance', val);
    } catch {
      // ignore
    }
  };

  // Réinitialiser les filtres à l'ouverture
  React.useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setNatureFilter('all');
      setInterAccountFlowTab('all');
      setSelectedPersonFilter(null);
    }
  }, [isOpen, auditType, categoryData]);

  // Récupérer la liste des transactions brutes selon le type d'audit
  const rawTransactions = useMemo(() => {
    if (customTransactions && customTransactions.length > 0) {
      return customTransactions;
    }
    if (auditType === 'category' && categoryData) {
      return categoryData.transactions || [];
    }
    if (auditType === 'inter-accounts' && interTransfersData) {
      return interTransfersData.transactions || [];
    }
    if (auditType === 'peer-transfers' && peerTransfersData) {
      return peerTransfersData.transactions || [];
    }
    return [];
  }, [auditType, categoryData, interTransfersData, peerTransfersData, customTransactions]);

  // Données dynamiques calculées pour Mouvements Inter-Comptes
  const effectiveInterTransfers = useMemo(() => {
    if (auditType !== 'inter-accounts') return null;
    if (interTransfersData && (!customTransactions || customTransactions.length === 0)) {
      return interTransfersData;
    }
    return calculateInternalTransfers(rawTransactions);
  }, [auditType, interTransfersData, rawTransactions, customTransactions]);

  // Données dynamiques calculées pour Échanges Famille & Amis
  const effectivePeerTransfers = useMemo(() => {
    if (auditType !== 'peer-transfers') return null;
    if (peerTransfersData && (!customTransactions || customTransactions.length === 0)) {
      return peerTransfersData;
    }
    return calculatePeerTransfers(rawTransactions);
  }, [auditType, peerTransfersData, rawTransactions, customTransactions]);

  // Arithmétique stricte du Solde Actuel Théorique
  const numInitialBalance = parseFloat(initialBalanceInput) || 0;
  const interInflows = effectiveInterTransfers?.inflows || 0;
  const interOutflows = effectiveInterTransfers?.outflows || 0;
  const theoreticalCurrentBalance = numInitialBalance + interInflows - interOutflows;

  // Filtrage par recherche, nature, direction des flux ou personne
  const filteredTransactions = useMemo(() => {
    return rawTransactions.filter(tx => {
      // Filtre de recherche
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const label = (tx.cleanLabel || tx.rawLabel || tx.description || '').toLowerCase();
        const rule = (tx.matchedRule || tx.ruleExplanation || '').toLowerCase();
        const amt = String(Math.abs(tx.amount || 0));
        if (!label.includes(q) && !rule.includes(q) && !amt.includes(q)) {
          return false;
        }
      }

      // Filtre nature (seulement pour category)
      if (auditType === 'category' && natureFilter !== 'all') {
        const isFixe = tx.nature === 'fixe';
        if (natureFilter === 'fixe' && !isFixe) return false;
        if (natureFilter === 'variable' && isFixe) return false;
      }

      // Filtre Mouvements Inter-Comptes (Entrées vs Sorties)
      if (auditType === 'inter-accounts' && interAccountFlowTab !== 'all') {
        const rawAmt = Number(tx.rawAmount !== undefined ? tx.rawAmount : tx.amount) || 0;
        const isCredit = tx.type === 'credit' || tx.direction === 'credit' || rawAmt > 0;
        if (interAccountFlowTab === 'inflows' && !isCredit) return false;
        if (interAccountFlowTab === 'outflows' && isCredit) return false;
      }

      // Filtre Échanges Famille & Amis (par Personne sélectionnée)
      if (auditType === 'peer-transfers' && selectedPersonFilter) {
        const person = extractPersonName(tx);
        if (person !== selectedPersonFilter) return false;
      }

      return true;
    });
  }, [rawTransactions, searchQuery, natureFilter, auditType, interAccountFlowTab, selectedPersonFilter]);

  // Somme totale des transactions actuellement filtrées (garantie de conciliation)
  const currentFilteredSum = useMemo(() => {
    return filteredTransactions.reduce((acc, tx) => acc + Math.abs(tx.amount || 0), 0);
  }, [filteredTransactions]);

  if (!isOpen) return null;

  // Rendu de l'icône de la catégorie
  const CategoryIcon = categoryData ? (ICON_MAP[categoryData.iconName] || Tag) : Tag;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop sombre flouté */}
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Slide-over Drawer Panel */}
      <div className="relative z-10 w-full max-w-2xl bg-card border-l border-border/80 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300 text-foreground overflow-hidden">
        
        {/* --- HEADER --- */}
        <div className="p-4 sm:p-5 border-b border-border/60 bg-secondary/30 dark:bg-white/[0.02] shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
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
              {auditType === 'category' && categoryData && (
                <div 
                  className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-md shrink-0 mt-0.5"
                  style={{ backgroundColor: categoryData.color || '#0EA5E9' }}
                >
                  <CategoryIcon className="w-5 h-5" />
                </div>
              )}
              {auditType === 'inter-accounts' && (
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/25 shrink-0 mt-0.5">
                  <ArrowLeftRight className="w-5 h-5" />
                </div>
              )}
              {auditType === 'peer-transfers' && (
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center text-white shadow-md shadow-rose-500/25 shrink-0 mt-0.5">
                  <Users className="w-5 h-5" />
                </div>
              )}
              {auditType === 'kpi-income' && (
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-md shrink-0 mt-0.5">
                  <ArrowDownLeft className="w-5 h-5" />
                </div>
              )}
              {auditType === 'kpi-expenses' && (
                <div className="w-11 h-11 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shadow-md shrink-0 mt-0.5">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
              )}
              {auditType === 'kpi-savings' && (
                <div className="w-11 h-11 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shadow-md shrink-0 mt-0.5">
                  <PiggyBank className="w-5 h-5" />
                </div>
              )}
              {auditType === 'kpi-essential' && (
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-md shrink-0 mt-0.5">
                  <Lock className="w-5 h-5" />
                </div>
              )}
              {auditType === 'kpi-comfort' && (
                <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center justify-center shadow-md shrink-0 mt-0.5">
                  <CreditCard className="w-5 h-5" />
                </div>
              )}
              {auditType === 'subscriptions' && (
                <div className="w-11 h-11 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shadow-md shrink-0 mt-0.5">
                  <Calendar className="w-5 h-5" />
                </div>
              )}

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-foreground">
                    {auditType === 'category' && (categoryData?.category || 'Détail de la catégorie')}
                    {auditType === 'inter-accounts' && 'Mouvements Inter-Comptes (Flux Propres)'}
                    {auditType === 'peer-transfers' && 'Échanges Famille & Amis (Wero / Paylib)'}
                    {auditType === 'kpi-income' && (customTitle || 'Audit des Revenus Réels')}
                    {auditType === 'kpi-expenses' && (customTitle || 'Audit des Dépenses Réelles')}
                    {auditType === 'kpi-savings' && (customTitle || 'Audit Épargne & Placements')}
                    {auditType === 'kpi-essential' && (customTitle || 'Audit des Dépenses Essentielles')}
                    {auditType === 'kpi-comfort' && (customTitle || 'Audit des Dépenses Confort & Plaisir')}
                    {auditType === 'subscriptions' && (customTitle || 'Abonnements & Prélèvements')}
                  </h2>
                  {auditType === 'category' && categoryData && (
                    <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider">
                      {categoryData.defaultNature === 'fixe' ? 'Charge Fixe par défaut' : 'Charge Variable par défaut'}
                    </Badge>
                  )}
                  {auditType === 'inter-accounts' && (
                    <Badge variant="outline" className="text-[10px] font-bold border-indigo-500/40 text-indigo-400 bg-indigo-500/10">
                      Neutralisé en trésorerie
                    </Badge>
                  )}
                  {auditType === 'peer-transfers' && (
                    <Badge variant="outline" className="text-[10px] font-bold border-rose-500/40 text-rose-400 bg-rose-500/10">
                      Particuliers & Proches
                    </Badge>
                  )}
                  {auditType === 'kpi-income' && (
                    <Badge variant="outline" className="text-[10px] font-bold border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
                      Entrées vérifiées
                    </Badge>
                  )}
                  {auditType === 'kpi-expenses' && (
                    <Badge variant="outline" className="text-[10px] font-bold border-rose-500/40 text-rose-400 bg-rose-500/10">
                      Sorties de consommation
                    </Badge>
                  )}
                  {auditType === 'kpi-savings' && (
                    <Badge variant="outline" className="text-[10px] font-bold border-purple-500/40 text-purple-400 bg-purple-500/10">
                      Patrimoine placé
                    </Badge>
                  )}
                  {auditType === 'kpi-essential' && (
                    <Badge variant="outline" className="text-[10px] font-bold border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
                      Charges Incompressibles & Vitales
                    </Badge>
                  )}
                  {auditType === 'kpi-comfort' && (
                    <Badge variant="outline" className="text-[10px] font-bold border-amber-500/40 text-amber-500 bg-amber-500/10">
                      Arbitrables & Plaisir
                    </Badge>
                  )}
                  {auditType === 'subscriptions' && (
                    <Badge variant="outline" className="text-[10px] font-bold border-blue-500/40 text-blue-400 bg-blue-500/10">
                      Abonnements & Prélèvements
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {auditType === 'category' && categoryData?.description}
                  {auditType === 'inter-accounts' && 'Virements entre compte courant, épargne et livrets : exclus des charges de consommation pour refléter votre niveau de vie exact.'}
                  {auditType === 'peer-transfers' && 'Suivi des remboursements, avances et sommes échangées entre particuliers (Wero, Paylib, proches).'}
                  {auditType === 'kpi-income' && (customSubtitle || 'Ensemble des encaissements et salaires perçus sur la période.')}
                  {auditType === 'kpi-expenses' && (customSubtitle || 'Ensemble des débits réels de consommation (charges fixes et dépenses courantes).')}
                  {auditType === 'kpi-savings' && (customSubtitle || 'Versements vers vos livrets A, LDDS, investissements et épargne de sécurité.')}
                  {auditType === 'kpi-essential' && (customSubtitle || 'Charges incompressibles (loyer, assurances, énergie, télécoms) et dépenses vitales (courses, santé, carburant).')}
                  {auditType === 'kpi-comfort' && (customSubtitle || 'Dépenses arbitrables dédiées à votre niveau de vie : restaurants, sorties, shopping, loisirs et cadeaux aux proches.')}
                  {auditType === 'subscriptions' && (customSubtitle || 'Ensemble des abonnements et prélèvements récurrents détectés sur vos relevés bancaires.')}
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

        {/* --- KPI SUMMARY STRIP (CONCILIATION ARITHMÉTIQUE) --- */}
        <div className="p-4 sm:p-5 border-b border-border/60 bg-secondary/15 dark:bg-white/[0.01] shrink-0 space-y-3">
          {/* CAS 1 : Catégorie de dépense */}
          {auditType === 'category' && categoryData && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="p-3 rounded-xl bg-card border border-border/70 shadow-sm">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    Total Cumulé
                  </span>
                  <span className="text-lg sm:text-xl font-black font-mono text-foreground">
                    {formatCurrency(categoryData.totalAmount, { showSign: false })}
                  </span>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">
                    {categoryData.percentage}% des dépenses réelles
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <span className="text-[10px] uppercase font-bold text-indigo-400/90 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Part Fixe
                  </span>
                  <span className="text-lg sm:text-xl font-black font-mono">
                    {formatCurrency(categoryData.fixedAmount, { showSign: false })}
                  </span>
                  <span className="text-[10px] text-indigo-400/80 block mt-0.5">
                    {categoryData.fixedPercentage}% de la catégorie
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 col-span-2 sm:col-span-1">
                  <span className="text-[10px] uppercase font-bold text-amber-500/90 flex items-center gap-1">
                    <CreditCard className="w-3 h-3" /> Part Variable
                  </span>
                  <span className="text-lg sm:text-xl font-black font-mono">
                    {formatCurrency(categoryData.variableAmount, { showSign: false })}
                  </span>
                  <span className="text-[10px] text-amber-500/80 block mt-0.5">
                    {categoryData.variablePercentage}% de la catégorie
                  </span>
                </div>
              </div>

              {/* Jauge visuelle de répartition Fixe vs Variable */}
              {categoryData.totalAmount > 0 && (
                <div className="space-y-1">
                  <div className="h-2 w-full rounded-full bg-secondary/80 overflow-hidden flex">
                    <div 
                      className="h-full bg-indigo-500 transition-all duration-500" 
                      style={{ width: `${categoryData.fixedPercentage}%` }}
                      title={`Part fixe : ${categoryData.fixedPercentage}%`}
                    />
                    <div 
                      className="h-full bg-amber-500 transition-all duration-500" 
                      style={{ width: `${categoryData.variablePercentage}%` }}
                      title={`Part variable : ${categoryData.variablePercentage}%`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-indigo-500" /> Fixe ({categoryData.fixedPercentage}%)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500" /> Variable ({categoryData.variablePercentage}%)
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CAS 2 : Mouvements Inter-Comptes avec Saisie du Solde Initial & Formule Théorique */}
          {auditType === 'inter-accounts' && effectiveInterTransfers && (
            <div className="space-y-3.5">
              {/* Saisie Solde Initial */}
              <div className="p-3 sm:p-4 rounded-2xl bg-secondary/30 dark:bg-white/[0.02] border border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Landmark className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-extrabold text-foreground flex items-center gap-1.5">
                      Solde Initial du Compte
                    </h3>
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      Indiquez le solde de départ pour calculer le solde théorique réconcilié.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      value={initialBalanceInput}
                      onChange={(e) => handleInitialBalanceChange(e.target.value)}
                      placeholder="0.00"
                      className="w-36 sm:w-40 px-3 py-1.5 text-right font-mono text-sm font-black rounded-xl bg-background border border-border/80 focus:ring-2 focus:ring-primary/40 focus:outline-none text-foreground placeholder:text-muted-foreground shadow-inner"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">€</span>
                  </div>
                  <button
                    onClick={() => handleInitialBalanceChange('0')}
                    className="px-2 py-1.5 rounded-xl border border-border/70 text-[11px] font-bold text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                    title="Réinitialiser à 0 €"
                  >
                    0 €
                  </button>
                </div>
              </div>

              {/* Formule explicite : Solde Initial + Entrées - Sorties = Solde Actuel Théorique */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-indigo-950/20 via-background to-secondary/30 border border-indigo-500/20 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-indigo-400">
                    <Calculator className="w-3.5 h-3.5" />
                    <span>Formule Arithmétique de Suivi des Soldes</span>
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground bg-secondary/80 px-2 py-0.5 rounded-full border border-border/60">
                    Audit Temps Réel
                  </span>
                </div>

                {/* Ruban de calcul avec opérateurs visuels */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="p-2.5 rounded-xl bg-card border border-border/80 shadow-sm flex flex-col justify-center">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">Solde Initial</span>
                    <span className="text-sm sm:text-base font-black font-mono text-foreground mt-0.5">
                      {formatCurrency(numInitialBalance, { showSign: false })}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 shadow-sm flex flex-col justify-center relative">
                    <div className="absolute -left-2 top-1/2 -translate-y-1/2 hidden sm:flex w-4 h-4 rounded-full bg-secondary items-center justify-center text-[10px] font-black text-emerald-400">
                      +
                    </div>
                    <span className="text-[10px] font-bold uppercase text-emerald-400/80">Entrées (Reçus)</span>
                    <span className="text-sm sm:text-base font-black font-mono mt-0.5">
                      +{formatCurrency(interInflows, { showSign: false })}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 shadow-sm flex flex-col justify-center relative">
                    <div className="absolute -left-2 top-1/2 -translate-y-1/2 hidden sm:flex w-4 h-4 rounded-full bg-secondary items-center justify-center text-[10px] font-black text-cyan-400">
                      -
                    </div>
                    <span className="text-[10px] font-bold uppercase text-cyan-400/80">Sorties (Émis)</span>
                    <span className="text-sm sm:text-base font-black font-mono mt-0.5">
                      -{formatCurrency(interOutflows, { showSign: false })}
                    </span>
                  </div>

                  <div className={`p-2.5 rounded-xl border shadow-sm flex flex-col justify-center relative ${
                    theoreticalCurrentBalance >= 0 
                      ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400' 
                      : 'bg-rose-500/15 border-rose-500/35 text-rose-400'
                  }`}>
                    <div className="absolute -left-2 top-1/2 -translate-y-1/2 hidden sm:flex w-4 h-4 rounded-full bg-secondary items-center justify-center text-[10px] font-black text-foreground">
                      =
                    </div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wide">Solde Actuel Théorique</span>
                    <span className="text-sm sm:text-base font-black font-mono mt-0.5">
                      {formatCurrency(theoreticalCurrentBalance, { showSign: false })}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground/90 text-center font-mono font-medium">
                  {formatCurrency(numInitialBalance, { showSign: false })} + {formatCurrency(interInflows, { showSign: false })} - {formatCurrency(interOutflows, { showSign: false })} = <strong className="text-foreground">{formatCurrency(theoreticalCurrentBalance, { showSign: false })}</strong>
                </div>
              </div>

              {/* Séparation visuelle Entrées vs Sorties */}
              <div className="flex items-center gap-1.5 p-1 bg-secondary/40 rounded-xl overflow-x-auto">
                <button
                  onClick={() => setInterAccountFlowTab('all')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                    interAccountFlowTab === 'all' 
                      ? 'bg-card text-foreground shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Toutes ({rawTransactions.length})
                </button>
                <button
                  onClick={() => setInterAccountFlowTab('inflows')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    interAccountFlowTab === 'inflows' 
                      ? 'bg-emerald-500 text-white shadow-sm' 
                      : 'text-emerald-400/90 hover:text-emerald-400'
                  }`}
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  Entrées Reçues (+{formatCurrency(interInflows)})
                </button>
                <button
                  onClick={() => setInterAccountFlowTab('outflows')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    interAccountFlowTab === 'outflows' 
                      ? 'bg-cyan-500 text-white shadow-sm' 
                      : 'text-cyan-400/90 hover:text-cyan-400'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  Sorties Émises (-{formatCurrency(interOutflows)})
                </button>
              </div>
            </div>
          )}

          {/* CAS 3 : Échanges Famille & Amis avec Balance Nette par Personne */}
          {auditType === 'peer-transfers' && effectivePeerTransfers && (
            <div className="space-y-4">
              {/* Synthèse Globale (3 cartes) */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <span className="text-[10px] uppercase font-bold text-emerald-500/90 block">
                    Reçu de Proches (+)
                  </span>
                  <span className="text-base sm:text-lg font-black font-mono">
                    +{formatCurrency(effectivePeerTransfers.received)}
                  </span>
                  <span className="text-[10px] text-emerald-400/80 block mt-0.5">
                    Wero / Remboursements
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  <span className="text-[10px] uppercase font-bold text-rose-500/90 block">
                    Envoyé à Proches (-)
                  </span>
                  <span className="text-base sm:text-lg font-black font-mono">
                    -{formatCurrency(effectivePeerTransfers.sent)}
                  </span>
                  <span className="text-[10px] text-rose-400/80 block mt-0.5">
                    Virements / Avances
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-card border border-border/80 shadow-sm">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    Position Nette
                  </span>
                  <span className={`text-base sm:text-lg font-black font-mono ${effectivePeerTransfers.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatCurrency(effectivePeerTransfers.net, { showSign: true })}
                  </span>
                  <span className="text-[10px] font-bold block mt-0.5">
                    {effectivePeerTransfers.net > 0 ? 'Créancier net' : (effectivePeerTransfers.net < 0 ? 'Débiteur net' : 'Équilibré')}
                  </span>
                </div>
              </div>

              {/* MODULE : Balance Nette par Personne */}
              {effectivePeerTransfers.peopleBalances && effectivePeerTransfers.peopleBalances.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Scale className="w-4 h-4 text-rose-400" />
                      <h3 className="text-xs sm:text-sm font-extrabold text-foreground">
                        Balance Nette par Personne
                      </h3>
                      <span className="text-[10px] font-bold text-muted-foreground bg-secondary/80 px-2 py-0.5 rounded-full border border-border/60">
                        {effectivePeerTransfers.peopleBalances.length} contact{effectivePeerTransfers.peopleBalances.length > 1 ? 's' : ''}
                      </span>
                    </div>

                    {selectedPersonFilter && (
                      <button
                        onClick={() => setSelectedPersonFilter(null)}
                        className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                      >
                        Voir tout le monde
                      </button>
                    )}
                  </div>

                  {/* Cartes individuelles par contact */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {effectivePeerTransfers.peopleBalances.map((person) => {
                      const isSelected = selectedPersonFilter === person.personName;
                      const isBalanced = person.net === 0;
                      const isPositive = person.net > 0;

                      return (
                        <div
                          key={person.personName}
                          onClick={() => setSelectedPersonFilter(isSelected ? null : person.personName)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                            isSelected
                              ? 'bg-primary/10 border-primary ring-2 ring-primary/30 shadow-md'
                              : 'bg-card border-border/70 hover:border-border hover:shadow-sm'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-rose-500 to-amber-500 text-white text-[11px] font-black flex items-center justify-center shrink-0 shadow-sm">
                                {person.avatarLetter}
                              </div>
                              <span className="font-extrabold text-xs sm:text-sm text-foreground truncate" title={person.personName}>
                                {person.personName}
                              </span>
                            </div>

                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                              isBalanced 
                                ? 'bg-secondary text-muted-foreground' 
                                : isPositive 
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            }`}>
                              {isBalanced ? 'À l\'équilibre' : isPositive ? 'Solde + créditeur' : 'Avance en attente'}
                            </span>
                          </div>

                          {/* Structure 3 colonnes : Avancé/Envoyé, Reçu/Remboursé, Solde Net */}
                          <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-border/50 text-center">
                            <div className="flex flex-col">
                              <span className="text-[9px] font-bold uppercase text-muted-foreground">Avancé/Envoyé</span>
                              <span className="text-xs font-black font-mono text-rose-400 mt-0.5">
                                -{formatCurrency(person.sent, { showSign: false })}
                              </span>
                            </div>

                            <div className="flex flex-col">
                              <span className="text-[9px] font-bold uppercase text-muted-foreground">Reçu/Remboursé</span>
                              <span className="text-xs font-black font-mono text-emerald-400 mt-0.5">
                                +{formatCurrency(person.received, { showSign: false })}
                              </span>
                            </div>

                            <div className="flex flex-col">
                              <span className="text-[9px] font-bold uppercase text-muted-foreground">Solde Net</span>
                              <span className={`text-xs font-black font-mono mt-0.5 ${
                                isBalanced ? 'text-muted-foreground' : isPositive ? 'text-emerald-400' : 'text-rose-400'
                              }`}>
                                {formatCurrency(person.net, { showSign: true })}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CAS 4 : Cartes KPI (Revenus, Dépenses Réelles, Épargne, Essentiel, Confort, Abonnements) */}
          {(auditType === 'kpi-income' || auditType === 'kpi-expenses' || auditType === 'kpi-savings' || auditType === 'kpi-essential' || auditType === 'kpi-comfort' || auditType === 'subscriptions') && (
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-card border border-border/80 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  {auditType === 'subscriptions' ? 'Total Mensuel' : 'Total Concilié'}
                </span>
                <span className={`text-lg sm:text-xl font-black font-mono ${
                  auditType === 'kpi-income' ? 'text-emerald-400' : (auditType === 'kpi-expenses' ? 'text-rose-400' : (auditType === 'kpi-savings' ? 'text-purple-400' : (auditType === 'kpi-essential' ? 'text-emerald-400' : (auditType === 'subscriptions' ? 'text-blue-400' : 'text-amber-500'))))
                }`}>
                  {formatCurrency(customTotalAmount !== undefined ? customTotalAmount : currentFilteredSum, { showSign: auditType === 'kpi-income' })}
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  Exactement conforme au relevé
                </span>
              </div>

              <div className="p-3 rounded-xl bg-secondary/40 border border-border/60">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  {auditType === 'subscriptions' ? "Nombre d'abonnements" : "Nombre d'opérations"}
                </span>
                <span className="text-lg sm:text-xl font-black font-mono text-foreground">
                  {rawTransactions.length}
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  Lignes d'écritures bancaires
                </span>
              </div>
            </div>
          )}

          {/* Alerte & Suivi d'évolution des prix d'abonnements */}
          {auditType === 'subscriptions' && (
            <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
              subscriptionStats.increasesCount > 0 
                ? 'bg-rose-500/10 border-rose-500/25 text-rose-300' 
                : subscriptionStats.decreasesCount > 0
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                  : subscriptionStats.hasMultiMonthData
                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                    : 'bg-blue-500/10 border-blue-500/25 text-blue-300'
            }`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  subscriptionStats.increasesCount > 0 
                    ? 'bg-rose-500/20 text-rose-400' 
                    : subscriptionStats.decreasesCount > 0
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : subscriptionStats.hasMultiMonthData
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-blue-500/20 text-blue-400'
                }`}>
                  {subscriptionStats.increasesCount > 0 ? (
                    <AlertTriangle className="w-4 h-4" />
                  ) : subscriptionStats.decreasesCount > 0 ? (
                    <TrendingDown className="w-4 h-4" />
                  ) : subscriptionStats.hasMultiMonthData ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Calendar className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-foreground">
                    {subscriptionStats.increasesCount > 0
                      ? `${subscriptionStats.increasesCount} hausse${subscriptionStats.increasesCount > 1 ? 's' : ''} de tarif détectée${subscriptionStats.increasesCount > 1 ? 's' : ''}`
                      : subscriptionStats.decreasesCount > 0
                        ? `${subscriptionStats.decreasesCount} baisse${subscriptionStats.decreasesCount > 1 ? 's' : ''} de prix constatée${subscriptionStats.decreasesCount > 1 ? 's' : ''}`
                        : subscriptionStats.hasMultiMonthData
                          ? 'Tarifs stables sur l\'ensemble de vos relevés analysés'
                          : 'Analyse basée sur un seul mois de relevé bancaire'}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    {subscriptionStats.increasesCount > 0
                      ? `Surcoût : +${formatCurrency(subscriptionStats.totalIncreaseImpact, { showSign: false })}/mois (+${formatCurrency(subscriptionStats.totalIncreaseImpact * 12, { showSign: false })}/an) • Idéal pour négocier ou résilier`
                      : subscriptionStats.decreasesCount > 0
                        ? `Économie : -${formatCurrency(subscriptionStats.totalDecreaseSavings, { showSign: false })}/mois • Vous bénéficiez de réductions actives`
                        : subscriptionStats.hasMultiMonthData
                          ? `Aucune hausse constatée sur vos ${subscriptionStats.stableCount} abonnements comparés sur plusieurs mois.`
                          : 'Importez d\'autres mois de relevés bancaires pour comparer automatiquement les hausses et baisses de prix.'}
                  </div>
                </div>
              </div>
              {subscriptionStats.increasesCount > 0 ? (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 uppercase tracking-wider shrink-0 hidden sm:inline-block">
                  Opportunité Négociation
                </span>
              ) : subscriptionStats.decreasesCount > 0 ? (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider shrink-0 hidden sm:inline-block">
                  Économies Actives
                </span>
              ) : subscriptionStats.hasMultiMonthData ? (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider shrink-0 hidden sm:inline-block">
                  Tarifs Maîtrisés
                </span>
              ) : (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase tracking-wider shrink-0 hidden sm:inline-block">
                  1 Relevé Disponible
                </span>
              )}
            </div>
          )}
        </div>

        {/* --- BARRE D'OUTILS ET RECHERCHE --- */}
        <div className="p-3 sm:p-4 border-b border-border/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0 bg-card">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par libellé, mot-clé ou montant..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-background border border-border/80 focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {auditType === 'category' && (
            <div className="flex items-center gap-1 bg-secondary/40 p-1 rounded-xl self-start sm:self-auto">
              <button
                onClick={() => setNatureFilter('all')}
                className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-colors ${
                  natureFilter === 'all' 
                    ? 'bg-card text-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Toutes ({rawTransactions.length})
              </button>
              <button
                onClick={() => setNatureFilter('fixe')}
                className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-colors flex items-center gap-1 ${
                  natureFilter === 'fixe' 
                    ? 'bg-indigo-500 text-white shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Lock className="w-3 h-3" /> Fixes
              </button>
              <button
                onClick={() => setNatureFilter('variable')}
                className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-colors flex items-center gap-1 ${
                  natureFilter === 'variable' 
                    ? 'bg-amber-500 text-white shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <CreditCard className="w-3 h-3" /> Variables
              </button>
            </div>
          )}
        </div>

        {/* --- LISTE DES OPÉRATIONS DÉTAILLÉES --- */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-2.5 overscroll-contain">
          {filteredTransactions.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center">
              <Info className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm font-semibold">Aucune opération trouvée</p>
              <p className="text-xs text-muted-foreground/80 mt-1 max-w-xs">
                Aucune transaction ne correspond à vos critères de recherche pour cette période.
              </p>
            </div>
          ) : (
            filteredTransactions.map((tx, idx) => {
              const rawAmt = Number(tx.amount) || 0;
              const isCredit = rawAmt > 0;
              const absAmt = Math.abs(rawAmt);
              const label = tx.cleanLabel || tx.rawLabel || tx.description || 'Opération';
              const isFixe = tx.nature === 'fixe';
              const matchedRuleText = tx.matchedRule || tx.ruleExplanation || 'Règle sémantique standard';

              return (
                <div 
                  key={tx.id || idx}
                  className={`p-3 sm:p-3.5 rounded-xl bg-card border hover:shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 group ${
                    auditType === 'inter-accounts' 
                      ? (isCredit ? 'border-l-4 border-l-emerald-500 border-border/70 bg-emerald-500/[0.02]' : 'border-l-4 border-l-cyan-500 border-border/70 bg-cyan-500/[0.02]')
                      : auditType === 'peer-transfers'
                        ? (isCredit ? 'border-l-4 border-l-emerald-500 border-border/70 bg-emerald-500/[0.02]' : 'border-l-4 border-l-rose-500 border-border/70 bg-rose-500/[0.02]')
                        : 'border-border/70 hover:border-border'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
                      isCredit 
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                        : (auditType === 'subscriptions' 
                            ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' 
                            : (auditType === 'inter-accounts'
                                ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
                                : (auditType === 'peer-transfers'
                                    ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                                    : (isFixe ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-500'))))
                    }`}>
                      {isCredit ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : auditType === 'subscriptions' ? (
                        <Calendar className="w-4 h-4" />
                      ) : (auditType === 'inter-accounts' || auditType === 'peer-transfers') ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : isFixe ? (
                        <Lock className="w-4 h-4" />
                      ) : (
                        <CreditCard className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      {auditType === 'subscriptions' ? (() => {
                        const evo = subscriptionEvolutions.get(tx.id);
                        return (
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-sm text-foreground truncate" title={label}>
                                {tx.cleanLabel || tx.description || label}
                              </span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm">
                                Payé
                              </span>
                              {/* Badge d'évolution de prix illustré */}
                              {evo && evo.status === 'INCREASED' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/15 text-rose-500 dark:text-rose-400 border border-rose-500/30">
                                  <TrendingUp className="w-3 h-3" />
                                  <span>+{formatCurrency(evo.difference || 0, { showSign: false })} ({evo.percentChange && evo.percentChange > 0 ? `+${evo.percentChange}%` : ''}) • Hausse détectée</span>
                                </span>
                              )}
                              {evo && evo.status === 'DECREASED' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border border-emerald-500/30">
                                  <TrendingDown className="w-3 h-3" />
                                  <span>{formatCurrency(evo.difference || 0, { showSign: true })} • Baisse de prix</span>
                                </span>
                              )}
                              {evo && evo.status === 'STABLE' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-secondary text-muted-foreground border border-border/50">
                                  Tarif stable ({formatCurrency(evo.currentAmount, { showSign: false })})
                                </span>
                              )}
                              {evo && evo.status === 'NEW' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-secondary/80 text-muted-foreground border border-border/50">
                                  1er relevé disponible
                                </span>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-4 mt-0.5">
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Libellé Bancaire</span>
                                <span className="text-[11px] text-foreground/90 font-medium truncate" title={tx.rawLabel || tx.description}>{tx.rawLabel || tx.description}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Date de Prélèvement</span>
                                <span className="text-[11px] text-blue-500 font-bold flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {tx.subscriptionDay ? `Le ${tx.subscriptionDay} du mois` : formatDateFR(tx.date)}
                                </span>
                              </div>
                            </div>

                            {/* Illustration de l'historique d'évolution des prix */}
                            {evo && evo.history && evo.history.length > 1 && (
                              <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px]">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Historique :</span>
                                {evo.history.map((pt, hIdx) => (
                                  <React.Fragment key={pt.date + hIdx}>
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${
                                      hIdx === evo.history.length - 1 && evo.status === 'INCREASED'
                                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                        : (hIdx === evo.history.length - 1 && evo.status === 'DECREASED'
                                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                            : 'bg-secondary/70 text-foreground border-border/50')
                                    }`} title={pt.monthKey || pt.date}>
                                      {formatCurrency(pt.amount, { showSign: false })}
                                    </span>
                                    {hIdx < evo.history.length - 1 && (
                                      <span className="text-muted-foreground font-bold text-[10px]">➔</span>
                                    )}
                                  </React.Fragment>
                                ))}
                              </div>
                            )}

                            {/* Aide à la négociation / résiliation en cas de hausse */}
                            {evo && evo.status === 'INCREASED' && (
                              <div className="mt-1.5 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 flex flex-col gap-1.5">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-1.5 text-rose-300 font-bold text-xs">
                                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                    <span>Hausse de tarif constatée (passé de {formatCurrency(evo.previousAmount || 0, { showSign: false })} à {formatCurrency(evo.currentAmount, { showSign: false })})</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setExpandedNegotiateId(expandedNegotiateId === tx.id ? null : tx.id)}
                                    className="text-[10px] font-bold px-2 py-1 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 transition-colors cursor-pointer"
                                  >
                                    {expandedNegotiateId === tx.id ? 'Masquer l\'argumentaire' : 'Conseil négocier / résilier'}
                                  </button>
                                </div>

                                {expandedNegotiateId === tx.id && (
                                  <div className="mt-1 p-2.5 rounded-lg bg-black/30 border border-rose-500/20 space-y-2">
                                    <p className="text-[11px] text-rose-200/90 leading-relaxed">
                                      {evo.negotiationAdvice}
                                    </p>
                                    <div className="pt-2 border-t border-rose-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                      <span className="text-[10px] font-medium text-muted-foreground">
                                        Message type pour le service client :
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const text = `Bonjour,\n\nJ'ai constaté une augmentation tarifaire sur mon abonnement ${tx.cleanLabel || tx.description} (passé de ${evo.previousAmount?.toFixed(2)} € à ${evo.currentAmount.toFixed(2)} € par mois).\n\nSans geste commercial ou alignement sur vos offres actuelles, je souhaite faire valoir mes droits de résiliation sans frais afin de souscrire chez un opérateur concurrent.\n\nMerci de votre retour.`;
                                          navigator.clipboard.writeText(text);
                                          setCopiedAdviceId(tx.id);
                                          setTimeout(() => setCopiedAdviceId(null), 2500);
                                        }}
                                        className="px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer shrink-0"
                                      >
                                        {copiedAdviceId === tx.id ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3 text-white" />}
                                        <span>{copiedAdviceId === tx.id ? 'Copié dans le presse-papier !' : 'Copier le message'}</span>
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })() : (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-xs sm:text-sm text-foreground truncate" title={label}>
                              {label}
                            </span>
                            {/* Badge de Nature Fixe vs Variable & Catégorie */}
                            {(auditType === 'category' || auditType === 'kpi-expenses' || auditType === 'kpi-essential' || auditType === 'kpi-comfort') && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {tx.category && (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary/80 text-foreground border border-border/60">
                                    {tx.category}
                                  </span>
                                )}
                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isFixe 
                                    ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30' 
                                    : 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                                }`}>
                                  {isFixe ? <Lock className="w-2.5 h-2.5" /> : <CreditCard className="w-2.5 h-2.5" />}
                                  {isFixe ? 'Charge Fixe' : 'Charge Variable'}
                                </span>
                              </div>
                            )}
                            {/* Badge Mouvements Inter-Comptes */}
                            {auditType === 'inter-accounts' && (
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                                isCredit 
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                                  : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                              }`}>
                                <ArrowLeftRight className="w-2.5 h-2.5" />
                                {isCredit ? 'Entrée Compte Propre (+)' : 'Sortie Compte Propre (-)'}
                              </span>
                            )}
                            {/* Badge Famille / Proches avec Personne Détectée */}
                            {auditType === 'peer-transfers' && (
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                                isCredit 
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              }`}>
                                <User className="w-2.5 h-2.5" />
                                <span className="font-extrabold">{extractPersonName(tx)}</span> • {isCredit ? 'Reçu / Remboursé (+)' : 'Avancé / Envoyé (-)'}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground mt-1">
                            <span className="font-mono font-medium">
                              {formatDateFR(tx.date)}
                            </span>
                            {tx.rawLabel && tx.rawLabel !== label && (
                              <>
                                <span>•</span>
                                <span className="truncate max-w-[220px]" title={tx.rawLabel}>
                                  {tx.rawLabel}
                                </span>
                              </>
                            )}
                          </div>

                          {/* Transparence de la règle de catégorisation */}
                          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground/90 font-medium">
                            <span className="text-primary font-bold">Règle :</span>
                            <span className="bg-secondary/60 dark:bg-white/[0.04] px-1.5 py-0.5 rounded-md text-foreground/80 truncate max-w-sm">
                              {matchedRuleText}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Montant formaté */}
                  <div className="text-right shrink-0 sm:self-center pl-12 sm:pl-0 flex flex-col items-end">
                    {auditType === 'subscriptions' && (
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Montant Mensuel</span>
                    )}
                    <span className={`text-sm sm:text-base font-black font-mono ${
                      isCredit ? 'text-emerald-400' : 'text-foreground'
                    }`}>
                      {isCredit ? '+' : '-'}{formatCurrency(absAmt, { showSign: false })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* --- FOOTER : CONCILIATION ARITHMÉTIQUE STRICTE --- */}
        <div className="p-4 border-t border-border/60 bg-secondary/30 dark:bg-white/[0.02] flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              <strong>{filteredTransactions.length}</strong> opération{filteredTransactions.length > 1 ? 's' : ''} • Somme arithmétique :
            </span>
            <strong className="text-foreground font-mono">
              {formatCurrency(currentFilteredSum, { showSign: false })}
            </strong>
          </div>

          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Fermer
          </Button>
        </div>

      </div>
    </div>
  );
};
