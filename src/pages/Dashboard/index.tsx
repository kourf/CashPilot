import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronDown, 
  ArrowRight, 
  Sparkles, 
  TrendingUp, 
  ScanLine, 
  ShieldCheck, 
  Check, 
  Eye, 
  EyeOff,
  Landmark,
  Repeat,
  Receipt,
  Store,
  LayoutGrid
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { 
  calculateKpis, 
  filterByMonth, 
  formatMonthLabel,
  calculateBankStatementSynthesis,
  calculateReceiptsSynthesis,
  calculateCoachSynthesis,
  calculateBicolorCashflow
} from '../../lib/kpiUtils';
import { formatCurrency } from '../../lib/bankUtils';
import { useTransactions } from '../../context/TransactionsContext';
import { useReceipts } from '../../context/ReceiptsContext';
import { useCoach } from '../../context/CoachContext';
import { 
  calculateCategoryStats, 
  type CategoryStatsItem 
} from '../../lib/categorizationRules';
import { CategoryAuditDrawer } from '../../components/CategoryAuditDrawer';
import { AuroraBackground } from './components/AuroraBackground';
import { SavingsAlertsDrawer } from './components/SavingsAlertsDrawer';
import { QuickScanModal } from './components/QuickScanModal';
import { GlobalEvolutionChart } from './components/GlobalEvolutionChart';
import { UnifiedCategorySection } from './components/UnifiedCategorySection';
import { db } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { getActiveAccountId } from '../../lib/userUtils';

export default function Dashboard() {
  const navigate = useNavigate();
  const [hideBalances, setHideBalances] = useState(false);
  
  // 1. Données Relevé Bancaire synchronisées en temps réel depuis le TransactionsContext
  const { 
    transactions, 
    loading: txLoading, 
    selectedMonth, 
    setSelectedMonth, 
    availableMonths 
  } = useTransactions();

  // 2. Données Ticket de Caisse synchronisées depuis le ReceiptsContext
  const { 
    receipts, 
    matrix 
  } = useReceipts();

  // 3. Données Coach & Réglages depuis le CoachContext
  const { 
    financialProfile 
  } = useCoach();

  // Filtrage strict par mois sélectionné (ou 'all' pour trésorerie consolidée)
  const filteredTransactions = useMemo(() => {
    return filterByMonth(transactions, selectedMonth);
  }, [transactions, selectedMonth]);

  // KPIs généraux calculés dynamiquement sur les données réelles
  const kpis = useMemo(() => calculateKpis(filteredTransactions), [filteredTransactions]);

  // Synthèse Relevé Bancaire (Net géant bicolore, fixes, abonnements, 6 mois)
  const bankSynthesis = useMemo(() => {
    return calculateBankStatementSynthesis(transactions, selectedMonth);
  }, [transactions, selectedMonth]);

  // Synthèse Ticket de Caisse (budget courses, panier moyen, top enseigne, top 3 écarts de prix)
  const receiptsSynthesis = useMemo(() => {
    return calculateReceiptsSynthesis(receipts, matrix, selectedMonth, transactions);
  }, [receipts, matrix, selectedMonth, transactions]);

  // Synthèse Coach & Réglages (diagnostic flash, points d'attention, jauge d'épargne)
  const coachSynthesis = useMemo(() => {
    return calculateCoachSynthesis(kpis, financialProfile);
  }, [kpis, financialProfile]);

  // Modals & Drawers
  const [isSavingsDrawerOpen, setIsSavingsDrawerOpen] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isPeriodMenuOpen, setIsPeriodMenuOpen] = useState(false);

  // Audit Drawer étendu pour les catégories et les 4 piliers
  const [isAuditDrawerOpen, setIsAuditDrawerOpen] = useState(false);
  const [auditType, setAuditType] = useState<'category' | 'inter-accounts' | 'peer-transfers' | 'kpi-income' | 'kpi-expenses' | 'kpi-savings' | 'kpi-essential' | 'kpi-comfort' | 'subscriptions'>('category');
  const [selectedCategoryData, setSelectedCategoryData] = useState<CategoryStatsItem | null>(null);
  const [customAuditTitle, setCustomAuditTitle] = useState<string>('');
  const [customAuditTransactions, setCustomAuditTransactions] = useState<any[]>([]);
  const [customAuditAmount, setCustomAuditAmount] = useState<number | undefined>(undefined);

  // Handlers pour les cartes KPI cliquables
  const handleOpenPillarFixed = () => {
    const fixedTxs = filteredTransactions.filter(t => (Number(t.amount) || 0) < 0 && (t.nature === 'fixe' || t.isSubscription));
    setCustomAuditTitle("Charges Fixes & Dépenses Incompressibles");
    setCustomAuditTransactions(fixedTxs);
    setCustomAuditAmount(bankSynthesis.fixedTotal);
    setSelectedCategoryData(null);
    setAuditType('kpi-essential');
    setIsAuditDrawerOpen(true);
  };

  const handleOpenPillarSubscriptions = () => {
    const subTxs = filteredTransactions.filter(t => (Number(t.amount) || 0) < 0 && (t.isSubscription || t.category === 'Abonnements' || t.category === 'Abonnements & Télécom'));
    setCustomAuditTitle("Abonnements & Prélèvements Récurrents");
    setCustomAuditTransactions(subTxs);
    setCustomAuditAmount(bankSynthesis.subscriptionsTotal);
    setSelectedCategoryData(null);
    setAuditType('subscriptions');
    setIsAuditDrawerOpen(true);
  };

  const handleOpenCategoryAuditItem = (catItem: CategoryStatsItem) => {
    setSelectedCategoryData(catItem);
    setCustomAuditTransactions([]);
    setCustomAuditTitle('');
    setCustomAuditAmount(undefined);
    setAuditType('category');
    setIsAuditDrawerOpen(true);
  };

  const handleTransactionCategoryChange = async (txId: string, newCategory: string) => {
    try {
      const accountId = getActiveAccountId();
      const docRef = doc(db, `users/${accountId}/transactions`, txId);
      await updateDoc(docRef, { category: newCategory });
    } catch (err) {
      console.error('Failed to update category', err);
    }
  };

  const isAllMonths = selectedMonth === 'all';
  const currentMonthLabel = isAllMonths ? 'Trésorerie Globale' : formatMonthLabel(selectedMonth);

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center select-none font-sans overflow-x-hidden text-slate-100 pb-44">
      
      {/* =========================================================================
          ARRIÈRE-PLAN ATMOSPHÉRIQUE AURORA (Direction Artistique Ron Design)
          - Tiers supérieur blanc pur (#FFFFFF vers #F8FAFC) avec micro-points
          - 3 sphères floutées : lavande pâle, pêche ambré, vert émeraude profond
         ========================================================================= */}
      <AuroraBackground />

      {/* =========================================================================
          CONTAINER ERGONOMIQUE WIDESCREEN PC (max-w-7xl) & RESPONSIVE
         ========================================================================= */}
      <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-5 flex flex-col gap-6 sm:gap-7 z-10">

        {/* =========================================================================
            ZONE 1 : TIERS SUPÉRIEUR LUMINEUX
            - En-tête avec sélecteur de période, badge arrondi de variation et bouton carré
            - Grand solde bicolore (#CBD5E1 et #0F172A)
           ========================================================================= */}
        <section className="w-full flex flex-col gap-4 pt-2 pb-3">
          
          {/* Header Supérieur : Sélecteur Période + Badge Variation + Bouton Carré */}
          <div className="w-full flex items-center justify-between">
            
            {/* Gauche : Sélecteur de période fluide en capsule nacrée */}
            <div className="relative z-50 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsPeriodMenuOpen(!isPeriodMenuOpen)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow-xs border border-slate-200/80 text-xs sm:text-sm font-semibold transition-all active:scale-95 cursor-pointer"
              >
                <span className="truncate max-w-[160px] sm:max-w-[220px]">
                  {currentMonthLabel}
                </span>
                <span className="text-slate-500 font-bold">(EUR)</span>
                <ChevronDown 
                  size={14} 
                  className={cn(
                    "text-slate-400 transition-transform duration-200",
                    isPeriodMenuOpen && "rotate-180 text-emerald-600"
                  )} 
                />
              </button>

              {/* Badge arrondi de variation mensuelle */}
              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs font-bold">
                <TrendingUp size={13} />
                <span>+3.21%</span>
              </div>

              {/* Popover Période 100% Opaque (#0B101D) sans aucun texte superposé */}
              {isPeriodMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-[90]" 
                    onClick={() => setIsPeriodMenuOpen(false)} 
                  />
                  <div className="absolute left-0 top-full mt-2 w-80 rounded-3xl bg-[#0B101D] border border-white/25 shadow-[0_25px_70px_rgba(0,0,0,0.95)] p-3 z-[100] animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between px-3 py-1.5 mb-1">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Sélectionner la période
                      </span>
                      <span className="text-[10px] font-bold text-emerald-400">
                        {availableMonths.length > 0 ? `${availableMonths.length} mois archivés` : 'Temps réel'}
                      </span>
                    </div>
                    
                    <button
                      onClick={() => {
                        setSelectedMonth('all');
                        setIsPeriodMenuOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all text-left cursor-pointer",
                        isAllMonths 
                          ? "bg-gradient-to-r from-[#DCF5E9] via-[#D1FAE5] to-[#B9F1DC] text-[#06331E] font-black border border-white/90 shadow-md" 
                          : "text-slate-100 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <span>Tous les mois (Vue consolidée)</span>
                      {isAllMonths && <Check size={16} className="text-[#06331E] stroke-[3]" />}
                    </button>

                    <div className="h-px bg-white/15 my-2" />

                    <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar pr-1">
                      {availableMonths.length === 0 ? (
                        <div className="px-3.5 py-4 text-xs text-slate-400 text-center italic">
                          Aucun mois archivé
                        </div>
                      ) : (
                        availableMonths.map((m) => {
                          const isSel = selectedMonth === m;
                          return (
                            <button
                              key={m}
                              onClick={() => {
                                setSelectedMonth(m);
                                setIsPeriodMenuOpen(false);
                              }}
                              className={cn(
                                "w-full flex items-center justify-between px-4 py-2.5 rounded-2xl text-xs sm:text-sm transition-all text-left cursor-pointer",
                                isSel 
                                  ? "bg-gradient-to-r from-[#DCF5E9] via-[#D1FAE5] to-[#B9F1DC] text-[#06331E] font-black border border-white/90 shadow-md" 
                                  : "text-slate-200 hover:bg-white/10 hover:text-white font-medium"
                              )}
                            >
                              <span className="capitalize">{formatMonthLabel(m)}</span>
                              {isSel && <Check size={16} className="text-[#06331E] stroke-[3]" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Droite : Masquer montants & Bouton Carré d'Action Ron Design */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setHideBalances(!hideBalances)}
                title={hideBalances ? "Afficher les montants" : "Masquer les montants"}
                className="w-9 h-9 rounded-2xl bg-white/90 hover:bg-white border border-slate-200/80 text-slate-700 flex items-center justify-center shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                {hideBalances ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>

              {/* Bouton Carré d'Action Supérieur Droit (Inspiration Ron Design Photo 2) */}
              <button
                onClick={() => setIsScanModalOpen(true)}
                title="Scanner un relevé ou un ticket de caisse"
                className="w-9 h-9 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-900 flex items-center justify-center shadow-xs transition-all active:scale-95 cursor-pointer group"
              >
                <LayoutGrid size={17} className="transition-transform group-hover:scale-110" />
              </button>
            </div>

          </div>

          {/* Solde Bicolore Géant : Premiers caractères en gris clair (#CBD5E1), suite en noir profond (#0F172A) */}
          <div className="pt-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              {isAllMonths ? "Trésorerie Globale Nette" : `Cash-flow Net • ${currentMonthLabel}`}
            </div>

            <div className="flex items-baseline tracking-tight select-none font-sans font-light text-5xl sm:text-6xl lg:text-7xl">
              {hideBalances ? (
                <span className="text-[#0F172A] font-bold">•••• €</span>
              ) : (
                <>
                  <span className="text-[#CBD5E1] font-light">
                    {bankSynthesis.bicolor.lightGrayPart}
                  </span>
                  <span className="text-[#0F172A] font-extrabold ml-0.5">
                    {bankSynthesis.bicolor.darkBlackPart}
                  </span>
                </>
              )}
            </div>

            <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                <ShieldCheck size={13} />
                Calculé à partir de Firestore (0 € coût IA)
              </span>
              <span>•</span>
              <span>{transactions.length} flux bancaires synchronisés</span>
            </p>
          </div>

        </section>

        {/* =========================================================================
            ZONE 2 : CARTE PORCELAINE PRINCIPALE (Milky Smart Card)
            - Blanche laiteuse (opacité 90 %, flou élevé, coins très arrondis, ombre douce)
            - Diagnostic flash à gauche, grand chiffre clé à droite (18 points d'attention)
            - Large bouton pilule gris perle avec cercle vert vif (#22C55E), halo lumineux et flèche
           ========================================================================= */}
        <section className="w-full">
          <Card 
            variant="porcelain"
            className="w-full p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden group border border-white/90 shadow-[0_20px_50px_rgba(15,23,42,0.08),inset_0_1px_2px_rgba(255,255,255,1)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5 max-w-xl">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 text-[10px] font-black uppercase tracking-wider">
                  <Sparkles size={11} className="text-emerald-600" />
                  Diagnostic Flash • Coach Financier
                </div>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 leading-snug tracking-tight">
                  {coachSynthesis.flashDiagnostic}
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Charges incompressibles, abonnements redondants et opportunités d'épargne prêts à analyser.
                </p>
              </div>

              {/* Grand chiffre clé à droite (18 points d'attention - Ron Design) */}
              <div className="flex flex-col items-end shrink-0 pl-2">
                <span className="text-4xl sm:text-5xl font-black text-slate-950 tracking-tight leading-none">
                  {coachSynthesis.attentionPointsCount}
                </span>
                <span className="text-[10px] font-extrabold tracking-widest text-slate-400 uppercase mt-1">
                  alertes
                </span>
              </div>
            </div>

            {/* Bouton Pilule Lumineux Gris Perle avec Cercle Vert Vif Ron Design (#22C55E) */}
            <div 
              onClick={() => navigate('/coach')}
              className="w-full h-14 rounded-full bg-[#EAECEF] hover:bg-[#E2E5E9] border border-slate-200/90 p-1.5 flex items-center justify-between cursor-pointer group/btn transition-all select-none active:scale-[0.99] shadow-inner mt-5"
            >
              {/* Cercle vert vif (#22C55E) avec halo lumineux et flèche blanche */}
              <div className="w-11 h-11 rounded-full bg-[#22C55E] text-white flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.6)] group-hover/btn:scale-105 transition-transform shrink-0">
                <ArrowRight size={20} strokeWidth={2.6} />
              </div>

              <span className="text-xs sm:text-sm font-bold text-slate-800 group-hover/btn:text-slate-950 transition-colors">
                Consulter le diagnostic & conseils du Coach IA
              </span>

              {/* Puce LED active verte pulsante */}
              <div className="pr-3.5 flex items-center">
                <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] shadow-[0_0_8px_#22C55E] animate-pulse" />
              </div>
            </div>
          </Card>
        </section>

        {/* =========================================================================
            ZONE 3 : GRILLE CARRÉE 2x2 EN VERRE DÉPOLI (Blanc 15 %, flou marqué, bordure 1px)
            Titres et montants principaux en blanc pur (#FFFFFF), secondaires à 60 %
            Fine courbe SVG avec point blanc lumineux au centre
           ========================================================================= */}
        <section className="w-full space-y-3">
          <div className="w-full flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-200">
                Synthèse Financière Multi-Onglets (2x2)
              </h3>
            </div>
            <span className="text-xs font-semibold text-white/70">
              {currentMonthLabel}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            
            {/* CARTE 1 : Relevé Bancaire - Charges Fixes */}
            <Card
              variant="frosted"
              onClick={handleOpenPillarFixed}
              className="p-5 sm:p-6 h-[200px] cursor-pointer group active:scale-[0.99]"
            >
              {/* En-tête de carte */}
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-white tracking-tight">
                    Charges Fixes
                  </h4>
                  <span className="text-xs text-white/60">
                    Dépenses incompressibles
                  </span>
                </div>
                <span className="text-xs font-bold text-white/90 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20">
                  {bankSynthesis.fixedRatio}% des revenus
                </span>
              </div>

              {/* Mini-courbe SVG fluide avec point blanc lumineux au centre */}
              <div className="my-auto w-full py-1">
                <svg className="w-full h-9 overflow-visible" fill="none" viewBox="0 0 160 32">
                  <line x1="4" y1="16" x2="156" y2="16" stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" strokeWidth="1" />
                  <path d="M4 22 C 45 22, 75 10, 110 10 C 135 10, 145 16, 156 16" stroke="rgba(255, 255, 255, 0.95)" strokeLinecap="round" strokeWidth="2" />
                  <circle cx="80" cy="12" r="3" fill="white" filter="drop-shadow(0 0 6px white)" />
                </svg>
              </div>

              {/* Pied de carte */}
              <div className="flex items-end justify-between">
                <div className="w-8 h-8 rounded-full bg-white/15 border border-white/30 flex items-center justify-center text-white">
                  <Landmark size={15} />
                </div>
                <div className="text-right">
                  <div className="text-xs text-white/60 font-medium">
                    {bankSynthesis.fixedCount} prélèvements
                  </div>
                  <div className="text-base sm:text-lg font-black text-white tracking-tight leading-tight mt-0.5">
                    {hideBalances ? "•••• €" : `-${formatCurrency(bankSynthesis.fixedTotal, { showSign: false })}`}
                  </div>
                </div>
              </div>
            </Card>

            {/* CARTE 2 : Relevé Bancaire - Abonnements Actifs */}
            <Card
              variant="frosted"
              onClick={handleOpenPillarSubscriptions}
              className="p-5 sm:p-6 h-[200px] cursor-pointer group active:scale-[0.99]"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-white tracking-tight">
                    Abonnements
                  </h4>
                  <span className="text-xs text-white/60">
                    Contrats & récurrences
                  </span>
                </div>
                <span className="text-xs font-bold text-white/90 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20">
                  {bankSynthesis.subscriptionsCount} actifs
                </span>
              </div>

              <div className="my-auto w-full py-1">
                <svg className="w-full h-9 overflow-visible" fill="none" viewBox="0 0 160 32">
                  <line x1="4" y1="16" x2="156" y2="16" stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" strokeWidth="1" />
                  <path d="M4 14 C 50 14, 70 24, 105 24 C 130 24, 145 12, 156 12" stroke="rgba(255, 255, 255, 0.95)" strokeLinecap="round" strokeWidth="2" />
                  <circle cx="85" cy="22" r="3" fill="white" filter="drop-shadow(0 0 6px white)" />
                </svg>
              </div>

              <div className="flex items-end justify-between">
                <div className="w-8 h-8 rounded-full bg-white/15 border border-white/30 flex items-center justify-center text-white">
                  <Repeat size={15} />
                </div>
                <div className="text-right">
                  <div className="text-xs text-white/60 font-medium">
                    Moyenne mensuelle
                  </div>
                  <div className="text-base sm:text-lg font-black text-white tracking-tight leading-tight mt-0.5">
                    {hideBalances ? "•••• €" : `-${formatCurrency(bankSynthesis.subscriptionsTotal, { showSign: false })}`}
                  </div>
                </div>
              </div>
            </Card>

            {/* CARTE 3 : Ticket de Caisse - Budget Courses & Panier Moyen */}
            <Card
              variant="frosted"
              onClick={() => navigate('/tickets')}
              className="p-5 sm:p-6 h-[200px] cursor-pointer group active:scale-[0.99]"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-white tracking-tight">
                    Budget Courses
                  </h4>
                  <span className="text-xs text-white/60">
                    Alimentation & supermarché
                  </span>
                </div>
                <span className="text-xs font-bold text-white/90 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20">
                  Panier {formatCurrency(receiptsSynthesis.averageBasket, { showSign: false })}
                </span>
              </div>

              <div className="my-auto w-full py-1">
                <svg className="w-full h-9 overflow-visible" fill="none" viewBox="0 0 160 32">
                  <line x1="4" y1="16" x2="156" y2="16" stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" strokeWidth="1" />
                  <path d="M4 20 C 40 20, 65 8, 95 12 C 120 16, 140 22, 156 18" stroke="rgba(255, 255, 255, 0.95)" strokeLinecap="round" strokeWidth="2" />
                  <circle cx="95" cy="12" r="3" fill="white" filter="drop-shadow(0 0 6px white)" />
                </svg>
              </div>

              <div className="flex items-end justify-between">
                <div className="w-8 h-8 rounded-full bg-white/15 border border-white/30 flex items-center justify-center text-white">
                  <Receipt size={15} />
                </div>
                <div className="text-right">
                  <div className="text-xs text-white/60 font-medium">
                    {receiptsSynthesis.receiptCount} tickets audités
                  </div>
                  <div className="text-base sm:text-lg font-black text-white tracking-tight leading-tight mt-0.5">
                    {hideBalances ? "•••• €" : formatCurrency(receiptsSynthesis.groceryBudget, { showSign: false })}
                  </div>
                </div>
              </div>
            </Card>

            {/* CARTE 4 : Ticket de Caisse - Top Enseigne & Écarts de Prix */}
            <Card
              variant="frosted"
              onClick={() => navigate('/tickets')}
              className="p-5 sm:p-6 h-[200px] cursor-pointer group active:scale-[0.99]"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-white tracking-tight">
                    Top Enseigne
                  </h4>
                  <span className="text-xs text-white/60">
                    Magasin le moins cher
                  </span>
                </div>
                <span className="text-xs font-bold text-white/90 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20">
                  Écart -{receiptsSynthesis.top3PriceGaps[0]?.diffPercent || 18}%
                </span>
              </div>

              <div className="my-auto w-full py-1">
                <svg className="w-full h-9 overflow-visible" fill="none" viewBox="0 0 160 32">
                  <line x1="4" y1="16" x2="156" y2="16" stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" strokeWidth="1" />
                  <path d="M4 12 C 45 12, 75 22, 115 16 C 135 12, 148 8, 156 8" stroke="rgba(255, 255, 255, 0.95)" strokeLinecap="round" strokeWidth="2" />
                  <circle cx="115" cy="16" r="3" fill="white" filter="drop-shadow(0 0 6px white)" />
                </svg>
              </div>

              <div className="flex items-end justify-between">
                <div className="w-8 h-8 rounded-full bg-white/15 border border-white/30 flex items-center justify-center text-white">
                  <Store size={15} />
                </div>
                <div className="text-right min-w-0">
                  <div className="text-xs text-white/60 font-medium truncate max-w-[170px]">
                    {receiptsSynthesis.top3PriceGaps[0]?.name || 'Écarts constatés'}
                  </div>
                  <div className="text-base sm:text-lg font-black text-white tracking-tight leading-tight mt-0.5 truncate max-w-[170px]">
                    {receiptsSynthesis.cheapestStore}
                  </div>
                </div>
              </div>
            </Card>

          </div>
        </section>

        {/* =========================================================================
            ZONE 4 : GRAPHIQUE D'ÉVOLUTION GLOBALE & DYNAMIQUE TEMPORELLE
           ========================================================================= */}
        <section className="w-full pt-2">
          <GlobalEvolutionChart 
            transactions={transactions}
            filteredTransactions={filteredTransactions}
            selectedMonth={selectedMonth}
            loading={txLoading}
          />
        </section>

        {/* =========================================================================
            ZONE 5 : VENTILATION & RÉPARTITION DES DÉPENSES
           ========================================================================= */}
        <section className="w-full">
          <UnifiedCategorySection 
            transactions={filteredTransactions}
            onSelectCategory={handleOpenCategoryAuditItem}
            hideBalances={hideBalances}
          />
        </section>

      </div>

      {/* =========================================================================
          TIROIRS MODAUX LATÉRAUX & INTERACTIFS
         ========================================================================= */}
      
      {/* Drawer 1 : Alertes d'optimisation IA */}
      <SavingsAlertsDrawer
        isOpen={isSavingsDrawerOpen}
        onClose={() => setIsSavingsDrawerOpen(false)}
        transactions={filteredTransactions}
      />

      {/* Drawer 2 : Modal Scan Rapide */}
      <QuickScanModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
      />

      {/* Drawer 3 : Audit approfondi de catégorie ou pilier financier */}
      <CategoryAuditDrawer 
        isOpen={isAuditDrawerOpen}
        onClose={() => setIsAuditDrawerOpen(false)}
        auditType={auditType}
        categoryData={selectedCategoryData}
        allTransactions={filteredTransactions}
        customTransactions={customAuditTransactions.length > 0 ? customAuditTransactions : undefined}
        customTitle={customAuditTitle || undefined}
        customTotalAmount={customAuditAmount}
        onCategoryChange={handleTransactionCategoryChange}
      />

    </div>
  );
}
