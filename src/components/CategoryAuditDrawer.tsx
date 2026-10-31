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
  Check,
  Tv,
  Layers,
  ArrowUpDown,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  formatCurrency, 
  formatDateFR, 
  detectSubscriptionEvolution,
  getSubscriptionMetadata,
  type SubscriptionPriceEvolution,
  type SubscriptionMetadata
} from '../lib/bankUtils';
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

  // Set des abonnements dépliés pour affichage des détails techniques à la demande (Google Stitch Ultra-Épuré)
  const [expandedSubscriptionIds, setExpandedSubscriptionIds] = useState<Set<string>>(new Set());

  const toggleSubscriptionExpand = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedSubscriptionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Mouvements Inter-Comptes : Solde initial et filtre directionnel (Entrées vs Sorties)
  const [initialBalanceInput, setInitialBalanceInput] = useState<string>(() => {
    return localStorage.getItem('cashpilot_interaccounts_initial_balance') || '0';
  });
  const [interAccountFlowTab, setInterAccountFlowTab] = useState<'all' | 'inflows' | 'outflows'>('all');

  // Échanges Famille & Amis : Filtre interactif par personne
  const [selectedPersonFilter, setSelectedPersonFilter] = useState<string | null>(null);

  // Mode de tri pour Abonnements & Prélèvements : 'logical' (par nature de contrat) | 'day' (1er au 31) | 'amount' (décroissant) | 'alerts'
  const [subscriptionSortMode, setSubscriptionSortMode] = useState<'logical' | 'day' | 'amount' | 'alerts'>('logical');

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

  // Métadonnées enrichies, définitions explicites et ordre logique
  const subscriptionMetadataMap = useMemo(() => {
    if (auditType !== 'subscriptions') return new Map<string, SubscriptionMetadata>();
    const map = new Map<string, SubscriptionMetadata>();
    (customTransactions || []).forEach(tx => {
      const evo = subscriptionEvolutions.get(tx.id);
      const meta = getSubscriptionMetadata(tx, evo, allTransactions);
      map.set(tx.id, meta);
    });
    return map;
  }, [auditType, customTransactions, subscriptionEvolutions, allTransactions]);

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
      // Exclure strictement les cartes de crédit / débit différé (American Express) des alertes d'augmentation
      if (evo.isCreditCard || evo.status === 'VARIABLE_DEBIT') {
        if (evo.history && evo.history.length > 1) {
          hasMultiMonthData = true;
        }
        return;
      }
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
      setSubscriptionSortMode('logical');
      setExpandedSubscriptionIds(new Set());
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

  // Tri et hiérarchisation intelligente des abonnements selon le mode choisi
  const sortedSubscriptionTransactions = useMemo(() => {
    if (auditType !== 'subscriptions') return filteredTransactions;
    const list = [...filteredTransactions];

    if (subscriptionSortMode === 'day') {
      return list.sort((a, b) => {
        const dayA = a.subscriptionDay || (a.date ? parseInt(a.date.split(/[/-]/).pop() || '1', 10) : 1);
        const dayB = b.subscriptionDay || (b.date ? parseInt(b.date.split(/[/-]/).pop() || '1', 10) : 1);
        return dayA - dayB;
      });
    }

    if (subscriptionSortMode === 'amount') {
      return list.sort((a, b) => {
        const amtA = Math.abs(Number(a.amount !== undefined ? a.amount : a.rawAmount) || 0);
        const amtB = Math.abs(Number(b.amount !== undefined ? b.amount : b.rawAmount) || 0);
        return amtB - amtA;
      });
    }

    if (subscriptionSortMode === 'alerts') {
      return list.sort((a, b) => {
        const evoA = subscriptionEvolutions.get(a.id);
        const evoB = subscriptionEvolutions.get(b.id);
        const priority = (s?: string) => s === 'INCREASED' ? 1 : (s === 'DECREASED' ? 2 : (s === 'STABLE' ? 3 : 4));
        return priority(evoA?.status) - priority(evoB?.status);
      });
    }

    // Mode par défaut : 'logical' (Ordre logique par type de contrat puis montant décroissant)
    return list.sort((a, b) => {
      const metaA = subscriptionMetadataMap.get(a.id) || getSubscriptionMetadata(a, subscriptionEvolutions.get(a.id), allTransactions);
      const metaB = subscriptionMetadataMap.get(b.id) || getSubscriptionMetadata(b, subscriptionEvolutions.get(b.id), allTransactions);
      if (metaA.logicalGroupOrder !== metaB.logicalGroupOrder) {
        return metaA.logicalGroupOrder - metaB.logicalGroupOrder;
      }
      const amtA = Math.abs(Number(a.amount !== undefined ? a.amount : a.rawAmount) || 0);
      const amtB = Math.abs(Number(b.amount !== undefined ? b.amount : b.rawAmount) || 0);
      return amtB - amtA;
    });
  }, [auditType, filteredTransactions, subscriptionSortMode, subscriptionEvolutions, subscriptionMetadataMap, allTransactions]);

  // Regroupement par catégories logiques avec sous-totaux pour l'ordre logique
  const subscriptionGroupedList = useMemo(() => {
    if (auditType !== 'subscriptions' || subscriptionSortMode !== 'logical') return null;

    const groupsOrder: Array<{
      id: SubscriptionMetadata['logicalGroup'];
      label: string;
      icon: React.ElementType;
      color: string;
    }> = [
      { id: 'housing', label: 'Logement & Énergie', icon: Home, color: 'text-amber-500 bg-amber-500/10 border-amber-500/25' },
      { id: 'insurance', label: 'Assurances & Prévoyance', icon: Shield, color: 'text-blue-500 bg-blue-500/10 border-blue-500/25' },
      { id: 'telecom', label: 'Télécoms & Box Internet', icon: Smartphone, color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/25' },
      { id: 'digital', label: 'Services Numériques & Streaming', icon: Tv, color: 'text-purple-500 bg-purple-500/10 border-purple-500/25' },
      { id: 'bnpl', label: 'Paiements Fractionnés (3x / 4x)', icon: Layers, color: 'text-orange-500 bg-orange-500/10 border-orange-500/25' },
      { id: 'credit_card', label: 'Cartes de Crédit à Débit Différé', icon: CreditCard, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/25' },
      { id: 'bank_fees', label: 'Frais & Services Bancaires', icon: Landmark, color: 'text-rose-500 bg-rose-500/10 border-rose-500/25' },
      { id: 'other', label: 'Autres Prélèvements Récurrents', icon: CalendarClock, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/25' }
    ];

    const map = new Map<string, any[]>();
    sortedSubscriptionTransactions.forEach(tx => {
      const meta = subscriptionMetadataMap.get(tx.id) || getSubscriptionMetadata(tx, subscriptionEvolutions.get(tx.id), allTransactions);
      const gid = meta.logicalGroup;
      const list = map.get(gid) || [];
      list.push(tx);
      map.set(gid, list);
    });

    return groupsOrder
      .map(g => {
        const txs = map.get(g.id) || [];
        const total = txs.reduce((sum, t) => sum + Math.abs(Number(t.amount !== undefined ? t.amount : t.rawAmount) || 0), 0);
        return {
          ...g,
          transactions: txs,
          total
        };
      })
      .filter(g => g.transactions.length > 0);
  }, [auditType, subscriptionSortMode, sortedSubscriptionTransactions, subscriptionMetadataMap, subscriptionEvolutions, allTransactions]);

  // Carte détaillée et épurée (Google Stitch UI/UX) pour chaque abonnement ou prélèvement récurrent
  const renderSubscriptionCard = (tx: any, idx: number) => {
    const rawAmt = Number(tx.amount !== undefined ? tx.amount : tx.rawAmount) || 0;
    const absAmt = Math.abs(rawAmt);
    const evo = subscriptionEvolutions.get(tx.id);
    const meta = subscriptionMetadataMap.get(tx.id) || getSubscriptionMetadata(tx, evo, allTransactions);

    // Icône contextuelle selon la nature du contrat
    const CardIcon = meta.isCreditCard ? CreditCard :
                     meta.isBNPL ? Layers :
                     meta.isBankFee ? Landmark :
                     meta.logicalGroup === 'housing' ? Home :
                     meta.logicalGroup === 'insurance' ? Shield :
                     meta.logicalGroup === 'telecom' ? Smartphone :
                     meta.logicalGroup === 'digital' ? Tv : CalendarClock;

    // Palette douce et contrastée (Stitch Design DNA)
    const iconStyle = meta.isCreditCard ? 'bg-indigo-500/10 text-indigo-400' :
                      meta.isBNPL ? 'bg-amber-500/10 text-amber-500' :
                      meta.isBankFee ? 'bg-rose-500/10 text-rose-400' :
                      meta.logicalGroup === 'housing' ? 'bg-amber-500/10 text-amber-500' :
                      meta.logicalGroup === 'insurance' ? 'bg-blue-500/10 text-blue-400' :
                      meta.logicalGroup === 'telecom' ? 'bg-cyan-500/10 text-cyan-400' :
                      meta.logicalGroup === 'digital' ? 'bg-purple-500/10 text-purple-400' :
                      'bg-emerald-500/10 text-emerald-400';

    const isExpanded = expandedSubscriptionIds.has(tx.id);
    const isCopied = copiedAdviceId === tx.id;

    return (
      <div 
        key={tx.id || idx}
        className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
          isExpanded 
            ? 'bg-card border-border shadow-xs' 
            : 'bg-card/70 hover:bg-card border-border/50 hover:border-border/80'
        }`}
      >
        {/* --- LIGNE PRINCIPALE ULTRA-ÉPURÉE (CLIQUABLE POUR DÉPLIER / REPLIER) --- */}
        <div 
          onClick={() => toggleSubscriptionExpand(tx.id)}
          className="p-3.5 sm:p-4 flex items-center justify-between gap-3 cursor-pointer select-none group"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Icône de service discrète */}
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${iconStyle}`}>
              <CardIcon className="w-4.5 h-4.5" />
            </div>

            {/* Identité commerciale et sous-titre épuré */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm sm:text-base text-foreground tracking-tight truncate" title={meta.cleanTitle}>
                  {meta.cleanTitle}
                </span>

                {/* Badge spécifique carte à débit différé (Amex) */}
                {meta.isCreditCard && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <CreditCard className="w-2.5 h-2.5" /> Amex
                  </span>
                )}

                {/* Badge paiement fractionné (BNPL) */}
                {meta.isBNPL && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
                    <Layers className="w-2.5 h-2.5" /> {meta.installmentDetails ? `3x/4x (${meta.installmentDetails.current}/${meta.installmentDetails.total})` : 'Paiement fractionné'}
                  </span>
                )}

                {/* Badge d'évolution de tarif discret */}
                {evo && evo.status === 'INCREASED' && !meta.isCreditCard && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                    <TrendingUp className="w-2.5 h-2.5" />
                    <span>+{formatCurrency(evo.difference || 0, { showSign: false })}</span>
                  </span>
                )}
                {evo && evo.status === 'DECREASED' && !meta.isCreditCard && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <TrendingDown className="w-2.5 h-2.5" />
                    <span>{formatCurrency(evo.difference || 0, { showSign: true })}</span>
                  </span>
                )}
              </div>

              {/* Ligne informative subtile */}
              <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5 mt-0.5 truncate">
                <span>{tx.subscriptionDay ? `Le ${tx.subscriptionDay} du mois` : formatDateFR(tx.date)}</span>
                {meta.isBNPL && meta.installmentDetails && (
                  <>
                    <span>•</span>
                    <span className="text-orange-400/90 truncate">{meta.installmentDetails.explanation}</span>
                  </>
                )}
                {!meta.isBNPL && !meta.isCreditCard && meta.plainDescription && (
                  <>
                    <span>•</span>
                    <span className="truncate max-w-[200px] sm:max-w-xs">{meta.plainDescription}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Montant & Bouton de dépliage */}
          <div className="flex items-center gap-2.5 shrink-0 pl-1">
            <div className="text-right">
              <span className="text-sm sm:text-base font-black font-mono tracking-tight text-foreground">
                -{formatCurrency(absAmt, { showSign: false })}
              </span>
              <span className="text-[10px] text-muted-foreground ml-1">
                {meta.isCreditCard ? 'débit' : '/m'}
              </span>
            </div>

            <div className="w-7 h-7 rounded-lg bg-secondary/50 group-hover:bg-secondary text-muted-foreground group-hover:text-foreground flex items-center justify-center transition-colors">
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            </div>
          </div>
        </div>

        {/* --- DÉTAILS CONTEXTUELS & TECHNIQUES (DÉPLIAGE PROGRESSIF À LA DEMANDE) --- */}
        {isExpanded && (
          <div className="border-t border-border/40 bg-secondary/20 dark:bg-white/[0.01] px-4 py-3.5 space-y-3 text-xs animate-in fade-in duration-200">
            {/* Définition claire et explicite */}
            <div className="flex items-start gap-2 text-[11.5px] text-foreground/90 leading-relaxed font-medium">
              <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <span>{meta.plainDescription}</span>
            </div>

            {/* Disclaimer humble si libellé bancaire succinct */}
            {meta.humbleDisclaimer && (
              <p className="text-[11px] text-muted-foreground pl-5.5 italic leading-tight">
                {meta.humbleDisclaimer}
              </p>
            )}

            {/* Détails du paiement fractionné (BNPL : échéances restantes & fin estimée) */}
            {meta.isBNPL && meta.installmentDetails && (
              <div className="flex items-center gap-2 pl-5.5 text-[11.5px] font-semibold text-orange-400">
                <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                <span>{meta.installmentDetails.explanation}</span>
              </div>
            )}

            {/* Explication carte à débit différé (Amex) */}
            {meta.isCreditCard && (
              <div className="flex items-center gap-2 pl-5.5 text-[11.5px] font-semibold text-indigo-400">
                <CreditCard className="w-3.5 h-3.5 shrink-0" />
                <span>Prélèvement carte de crédit à débit différé (achats variables du mois écoulé).</span>
              </div>
            )}

            {/* Historique chronologique fluide si multi-mois disponible */}
            {evo && evo.history && evo.history.length > 1 && (
              <div className="space-y-1.5 pt-1 pl-5.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-primary" /> Historique ({evo.history.length} mois analysés) :
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {evo.history.map((pt, hIdx) => {
                    const isLatest = hIdx === evo.history.length - 1;
                    const isIncreased = isLatest && evo.status === 'INCREASED' && !meta.isCreditCard;
                    const isDecreased = isLatest && evo.status === 'DECREASED' && !meta.isCreditCard;

                    return (
                      <div key={pt.date + hIdx} className="flex items-center gap-1">
                        <div className={`px-2 py-0.5 rounded-md text-[11px] font-mono flex items-center gap-1 ${
                          isIncreased
                            ? 'bg-rose-500/15 text-rose-400 font-bold border border-rose-500/30'
                            : isDecreased
                              ? 'bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30'
                              : 'bg-secondary/70 text-foreground/80 border border-border/40 font-medium'
                        }`}>
                          <span className="font-sans font-bold text-[9px] uppercase text-muted-foreground">
                            {pt.monthLabel || pt.monthKey}
                          </span>
                          <span className="font-bold">
                            {formatCurrency(pt.amount, { showSign: false })}
                          </span>
                        </div>
                        {hIdx < evo.history.length - 1 && (
                          <span className="text-muted-foreground/40 text-[10px]">→</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Assistance négociation / résiliation en cas de hausse réelle */}
            {evo && evo.status === 'INCREASED' && !meta.isCreditCard && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-2 mt-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Hausse de +{formatCurrency(evo.difference || 0, { showSign: false })} constatée ({formatCurrency(evo.previousAmount || 0, { showSign: false })} → {formatCurrency(evo.currentAmount, { showSign: false })})</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const text = `Bonjour,\n\nJ'ai constaté une augmentation tarifaire sur mon abonnement ${meta.cleanTitle} (passé de ${evo.previousAmount?.toFixed(2)} € à ${evo.currentAmount.toFixed(2)} € par mois).\n\nSans geste commercial ou alignement sur vos offres actuelles, je souhaite faire valoir mes droits de résiliation sans frais afin de souscrire chez un opérateur concurrent.\n\nMerci de votre retour.`;
                      navigator.clipboard.writeText(text);
                      setCopiedAdviceId(tx.id);
                      setTimeout(() => setCopiedAdviceId(null), 2500);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs active:scale-95 transition-all cursor-pointer shrink-0"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5 text-white" />}
                    <span>{isCopied ? 'Copié !' : 'Copier modèle contestation'}</span>
                  </button>
                </div>
                <p className="text-[11.5px] text-rose-200/90 leading-relaxed font-normal">
                  {evo.negotiationAdvice}
                </p>
              </div>
            )}

            {/* Pied de carte technique avec traçabilité bancaire */}
            <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[10.5px] text-muted-foreground">
              <div className="flex items-center gap-1.5 min-w-0 max-w-[80%]" title={tx.rawLabel || tx.description}>
                <span className="uppercase text-[9px] font-bold tracking-wider text-muted-foreground/70 shrink-0">Libellé relevé :</span>
                <span className="font-mono text-foreground/70 truncate">{tx.rawLabel || tx.description}</span>
              </div>
              <div className="text-[10px] font-medium text-muted-foreground shrink-0 font-mono">
                {formatDateFR(tx.date)}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

    // Carte standard pour les autres types d'audit (Catégories, Inter-comptes, Famille/Amis...)
  const renderGeneralCard = (tx: any, idx: number) => {
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
              : (auditType === 'inter-accounts'
                  ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
                  : (auditType === 'peer-transfers'
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                      : (isFixe ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-500')))
          }`}>
            {isCredit ? (
              <ArrowDownLeft className="w-4 h-4" />
            ) : (auditType === 'inter-accounts' || auditType === 'peer-transfers') ? (
              <ArrowUpRight className="w-4 h-4" />
            ) : isFixe ? (
              <Lock className="w-4 h-4" />
            ) : (
              <CreditCard className="w-4 h-4" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-xs sm:text-sm text-foreground truncate" title={label}>
                {label}
              </span>
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

            <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground/90 font-medium">
              <span className="text-primary font-bold">Règle :</span>
              <span className="bg-secondary/60 dark:bg-white/[0.04] px-1.5 py-0.5 rounded-md text-foreground/80 truncate max-w-sm">
                {matchedRuleText}
              </span>
            </div>
          </div>
        </div>

        <div className="text-right shrink-0 sm:self-center pl-12 sm:pl-0 flex flex-col items-end">
          <span className={`text-sm sm:text-base font-black font-mono ${
            isCredit ? 'text-emerald-400' : 'text-foreground'
          }`}>
            {isCredit ? '+' : '-'}{formatCurrency(absAmt, { showSign: false })}
          </span>
        </div>
      </div>
    );
  };

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

          {/* CAS 4 : Cartes KPI Standards (Revenus, Dépenses Réelles, Épargne, Essentiel, Confort) */}
          {(auditType === 'kpi-income' || auditType === 'kpi-expenses' || auditType === 'kpi-savings' || auditType === 'kpi-essential' || auditType === 'kpi-comfort') && (
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-card border border-border/80 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Total Concilié
                </span>
                <span className={`text-lg sm:text-xl font-black font-mono ${
                  auditType === 'kpi-income' ? 'text-emerald-400' : (auditType === 'kpi-expenses' ? 'text-rose-400' : (auditType === 'kpi-savings' ? 'text-purple-400' : (auditType === 'kpi-essential' ? 'text-emerald-400' : 'text-amber-500')))
                }`}>
                  {formatCurrency(customTotalAmount !== undefined ? customTotalAmount : currentFilteredSum, { showSign: auditType === 'kpi-income' })}
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  Exactement conforme au relevé
                </span>
              </div>

              <div className="p-3 rounded-xl bg-secondary/40 border border-border/60">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Nombre d'opérations
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

          {/* CAS 5 : Synthèse Épurée pour Abonnements & Prélèvements (Google Stitch DNA) */}
          {auditType === 'subscriptions' && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-blue-500/5 via-indigo-500/5 to-secondary/30 border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-baseline gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Total Mensuel Récurrent
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-foreground">
                      {formatCurrency(customTotalAmount !== undefined ? customTotalAmount : currentFilteredSum, { showSign: false })}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">/ mois</span>
                  </div>
                </div>
                <div className="hidden sm:block h-8 w-px bg-border/60 mx-1 self-center" />
                <div className="text-xs text-muted-foreground font-medium space-y-0.5">
                  <div>~<strong>{formatCurrency((customTotalAmount !== undefined ? customTotalAmount : currentFilteredSum) * 12, { showSign: false })}</strong> / an</div>
                  <div><strong>{rawTransactions.length}</strong> contrat{rawTransactions.length > 1 ? 's' : ''} actif{rawTransactions.length > 1 ? 's' : ''}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                {subscriptionStats.increasesCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setSubscriptionSortMode(subscriptionSortMode === 'alerts' ? 'logical' : 'alerts')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                      subscriptionSortMode === 'alerts'
                        ? 'bg-rose-500 text-white'
                        : 'bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 border border-rose-500/30'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{subscriptionStats.increasesCount} hausse{subscriptionStats.increasesCount > 1 ? 's' : ''} (+{formatCurrency(subscriptionStats.totalIncreaseImpact, { showSign: false })})</span>
                  </button>
                ) : subscriptionStats.decreasesCount > 0 ? (
                  <div className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 flex items-center gap-1.5">
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>{subscriptionStats.decreasesCount} économie{subscriptionStats.decreasesCount > 1 ? 's' : ''} (-{formatCurrency(subscriptionStats.totalDecreaseSavings, { showSign: false })})</span>
                  </div>
                ) : subscriptionStats.hasMultiMonthData ? (
                  <div className="px-3 py-1.5 rounded-xl text-xs font-bold bg-secondary/80 text-foreground/80 border border-border/50 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Tarifs 100% stables</span>
                  </div>
                ) : (
                  <div className="px-3 py-1.5 rounded-xl text-xs font-medium bg-secondary/60 text-muted-foreground border border-border/40 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-400" />
                    <span>1 relevé analysé</span>
                  </div>
                )}
              </div>
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
              placeholder={auditType === 'subscriptions' ? "Rechercher un abonnement (Netflix, EDF, Orange, 10.99...)" : "Rechercher par libellé, mot-clé ou montant..."}
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-background border border-border/80 focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground placeholder:text-muted-foreground"
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

          {auditType === 'subscriptions' && (
            <div className="flex items-center justify-between gap-2 flex-wrap self-start sm:self-auto">
              <div className="flex items-center gap-1 bg-secondary/40 p-1 rounded-xl overflow-x-auto border border-border/40">
                <button
                  type="button"
                  onClick={() => setSubscriptionSortMode('logical')}
                  className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-all cursor-pointer ${
                    subscriptionSortMode === 'logical' 
                      ? 'bg-card text-foreground shadow-xs font-bold' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Regrouper par catégorie"
                >
                  Catégorie
                </button>
                <button
                  type="button"
                  onClick={() => setSubscriptionSortMode('day')}
                  className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-all cursor-pointer ${
                    subscriptionSortMode === 'day' 
                      ? 'bg-card text-foreground shadow-xs font-bold' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Trier par jour d'échéance"
                >
                  Échéance
                </button>
                <button
                  type="button"
                  onClick={() => setSubscriptionSortMode('amount')}
                  className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-all cursor-pointer ${
                    subscriptionSortMode === 'amount' 
                      ? 'bg-card text-foreground shadow-xs font-bold' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Trier par montant décroissant"
                >
                  Montant
                </button>
                {subscriptionStats.increasesCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setSubscriptionSortMode('alerts')}
                    className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all cursor-pointer ${
                      subscriptionSortMode === 'alerts' 
                        ? 'bg-rose-500 text-white shadow-xs' 
                        : 'text-rose-400 hover:text-rose-300'
                    }`}
                    title="Afficher les hausses de tarifs"
                  >
                    Hausses ({subscriptionStats.increasesCount})
                  </button>
                )}
              </div>

              {/* Bouton Tout déplier / replier */}
              <button
                type="button"
                onClick={() => {
                  if (expandedSubscriptionIds.size > 0) {
                    setExpandedSubscriptionIds(new Set());
                  } else {
                    setExpandedSubscriptionIds(new Set(sortedSubscriptionTransactions.map(t => t.id)));
                  }
                }}
                className="text-[11px] font-semibold text-muted-foreground hover:text-foreground px-2 py-1 transition-colors cursor-pointer"
              >
                {expandedSubscriptionIds.size > 0 ? 'Tout replier' : 'Tout déplier'}
              </button>
            </div>
          )}
        </div>

                {/* --- LISTE DES OPÉRATIONS DÉTAILLÉES --- */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3 overscroll-contain">
          {filteredTransactions.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center">
              <Info className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm font-semibold">Aucune opération trouvée</p>
              <p className="text-xs text-muted-foreground/80 mt-1 max-w-xs">
                Aucune transaction ne correspond à vos critères de recherche pour cette période.
              </p>
            </div>
          ) : auditType === 'subscriptions' ? (
            subscriptionSortMode === 'logical' && subscriptionGroupedList ? (
              <div className="space-y-4">
                {subscriptionGroupedList.map(group => {
                  const GroupIcon = group.icon;
                  return (
                    <div key={group.id} className="space-y-2">
                      <div className="flex items-center justify-between px-1 pt-1 text-xs">
                        <div className="flex items-center gap-2">
                          <GroupIcon className="w-3.5 h-3.5 text-muted-foreground" />
                          <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                            {group.label}
                          </h3>
                          <span className="text-[10px] font-medium text-muted-foreground/60">
                            ({group.transactions.length})
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold font-mono text-muted-foreground">
                            {formatCurrency(group.total, { showSign: false })}/m
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {group.transactions.map((tx, idx) => renderSubscriptionCard(tx, idx))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {sortedSubscriptionTransactions.map((tx, idx) => renderSubscriptionCard(tx, idx))}
              </div>
            )
          ) : (
            <div className="space-y-2.5">
              {filteredTransactions.map((tx, idx) => renderGeneralCard(tx, idx))}
            </div>
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
