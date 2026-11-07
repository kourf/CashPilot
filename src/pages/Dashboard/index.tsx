import { useState, useMemo } from 'react';
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
  EyeOff
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { calculateKpis, filterByMonth, formatMonthLabel } from '../../lib/kpiUtils';
import { formatCurrency } from '../../lib/bankUtils';
import { useTransactions } from '../../context/TransactionsContext';
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
  
  // Données synchronisées en temps réel depuis le TransactionsContext
  const { 
    transactions, 
    loading, 
    error, 
    selectedMonth, 
    setSelectedMonth, 
    availableMonths 
  } = useTransactions();

  // Filtrage strict par mois sélectionné (ou 'all' pour trésorerie consolidée)
  const filteredTransactions = useMemo(() => {
    return filterByMonth(transactions, selectedMonth);
  }, [transactions, selectedMonth]);

  // KPIs calculés dynamiquement sur les données réelles
  const kpis = useMemo(() => calculateKpis(filteredTransactions), [filteredTransactions]);

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

  // Statistiques de ventilation
  const categoryStats = useMemo(() => calculateCategoryStats(filteredTransactions), [filteredTransactions]);

  // Montant Reste à vivre décomposé en 2 tons
  const displayReste = kpis.resteAVivre;
  const displayBudgetJour = kpis.budgetJournalier;
  const formattedResteParts = displayReste.toFixed(2).split('.');
  const integerPart = Math.abs(Number(formattedResteParts[0])).toLocaleString('fr-FR');
  const decimalPart = formattedResteParts[1] || '00';

  // Handlers pour les 4 piliers financiers réels et synchronisés
  const handleOpenPillarIncome = () => {
    const incomeTxs = filteredTransactions.filter(t => (Number(t.amount) || 0) > 0 && !t.isInternalTransfer);
    setCustomAuditTitle("Revenus & Entrées d'argent");
    setCustomAuditTransactions(incomeTxs);
    setCustomAuditAmount(kpis.revenus);
    setSelectedCategoryData(null);
    setAuditType('kpi-income');
    setIsAuditDrawerOpen(true);
  };

  const handleOpenPillarFixed = () => {
    const fixedTxs = filteredTransactions.filter(t => (Number(t.amount) || 0) < 0 && (t.nature === 'fixe' || t.isSubscription));
    setCustomAuditTitle("Charges Fixes & Dépenses Incompressibles");
    setCustomAuditTransactions(fixedTxs);
    setCustomAuditAmount(kpis.fixe);
    setSelectedCategoryData(null);
    setAuditType('kpi-essential');
    setIsAuditDrawerOpen(true);
  };

  const handleOpenPillarVariable = () => {
    const variableTxs = filteredTransactions.filter(t => (Number(t.amount) || 0) < 0 && t.nature === 'variable');
    setCustomAuditTitle("Dépenses Variables & Quotidien");
    setCustomAuditTransactions(variableTxs);
    setCustomAuditAmount(kpis.variable);
    setSelectedCategoryData(null);
    setAuditType('kpi-comfort');
    setIsAuditDrawerOpen(true);
  };

  const handleOpenPillarSavings = () => {
    const savingsTxs = filteredTransactions.filter(t => t.isSavings || t.category === 'Épargne & Investissement' || t.category === 'Épargne');
    setCustomAuditTitle("Épargne Nette & Investissements");
    setCustomAuditTransactions(savingsTxs);
    setCustomAuditAmount(kpis.epargne);
    setSelectedCategoryData(null);
    setAuditType('kpi-savings');
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
          ARRIÈRE-PLAN ATMOSPHÉRIQUE VOLUMÉTRIQUE (Ron Design)
         ========================================================================= */}
      <AuroraBackground />

      {/* =========================================================================
          CONTAINER ERGONOMIQUE WIDESCREEN PC (max-w-7xl) & RESPONSIVE
         ========================================================================= */}
      <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 flex flex-col gap-7">

        {/* =========================================================================
            ROW 1 : EN-TÊTE ÉPURÉ AVEC SÉLECTEUR DE PÉRIODE FLUIDE (z-50 pour survoler le hero)
           ========================================================================= */}
        <header className="relative z-50 w-full flex items-center justify-between py-2 border-b border-white/10 backdrop-blur-md">
          
          {/* Gauche : Logo CashPilot & Sélecteur Dépoli Période */}
          <div className="flex items-center gap-3 sm:gap-6">
            <div className="flex items-center gap-2">
              <span className="text-lg sm:text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                CashPilot
              </span>
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                PRO
              </span>
            </div>

            {/* Sélecteur de Période Glassmorphism avec Popover sans superposition */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsPeriodMenuOpen(!isPeriodMenuOpen)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white backdrop-blur-xl border border-white/15 shadow-sm text-xs sm:text-sm font-medium transition-all active:scale-95 group cursor-pointer"
              >
                <span className="text-slate-400 font-normal truncate max-w-[150px] sm:max-w-[200px]">
                  {currentMonthLabel}
                </span>
                <span className="font-bold text-white">(EUR)</span>
                <ChevronDown 
                  size={14} 
                  className={cn(
                    "text-slate-400 transition-transform duration-200",
                    isPeriodMenuOpen && "rotate-180 text-emerald-400"
                  )} 
                />
              </button>

              {/* Popover Période Dépoli : z-[100] pour toujours flotter AU-DESSUS du hero */}
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
                    
                    {/* Option Tous les mois */}
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

                    {/* Liste des mois archivés réels */}
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

            {/* Badge de variation mensuelle */}
            <div className="hidden sm:flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
              <TrendingUp size={13} />
              <span>+3.21%</span>
            </div>
          </div>

          {/* Droite : Masquer soldes & Bouton Scan Rapide givré */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Bouton Masquer/Afficher les montants */}
            <button
              onClick={() => setHideBalances(!hideBalances)}
              title={hideBalances ? "Afficher les montants" : "Masquer les montants"}
              className="p-2 rounded-full bg-slate-900/60 hover:bg-slate-800 text-slate-300 border border-white/15 backdrop-blur-md transition-all active:scale-95 cursor-pointer"
            >
              {hideBalances ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>

            {/* Bouton Scanner rapide (Pilule givrée menthe d'eau Ron Design) */}
            <button
              onClick={() => setIsScanModalOpen(true)}
              className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-[#DCF5E9] to-[#C6EFE0] hover:from-white hover:to-[#DCF5E9] text-[#083020] font-bold text-xs shadow-md border border-white/80 transition-all active:scale-95 cursor-pointer"
            >
              <ScanLine size={14} className="text-[#083020]" />
              <span className="hidden sm:inline">Scanner un document</span>
              <span className="sm:hidden">Scanner</span>
            </button>
          </div>
        </header>

        {/* =========================================================================
            ROW 2 : LE PLI HÉRO DE NIVEAU 1 (SOLDE HÉRO + CARTE IA FLOTTANTE)
            Positionné en relative z-10 pour ne pas gêner le popover
           ========================================================================= */}
        <section className="relative z-10 w-full grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
          
          {/* CARTE 1 : GRAND SOLDE HÉRO DE TRÉSORERIE (lg:col-span-6) */}
          <div className="lg:col-span-6 rounded-[32px] bg-slate-900/80 hover:bg-slate-900/90 backdrop-blur-3xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_1.5px_rgba(255,255,255,0.3)] p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden group">
            
            {/* Ligne spéculaire haute */}
            <div className="absolute top-0 inset-x-8 h-[1px] bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />

            <div>
              {/* Badge statut direct avec LED vert pulsant */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 mb-3 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
                <span className="text-[11px] font-bold tracking-wider text-emerald-300 uppercase">
                  Disponible immédiat
                </span>
              </div>

              <div className="text-xs font-semibold text-slate-400 mb-1">
                Solde de trésorerie disponible
              </div>

              {/* Montant bicolore à fort impact visuel */}
              <div className="flex items-baseline tracking-tight leading-none select-none font-sans my-2">
                <span className="text-5xl sm:text-6xl font-black text-white drop-shadow-sm">
                  {hideBalances ? "••••" : integerPart}
                </span>
                {!hideBalances && (
                  <span className="text-3xl sm:text-4xl font-light text-slate-400 ml-1">
                    ,{decimalPart} €
                  </span>
                )}
              </div>

              {/* Subtext explicatif : budget disponible par jour */}
              <p className="text-xs sm:text-sm font-normal text-slate-400 mt-2 flex items-center gap-1.5">
                <span>Budget disponible :</span>
                <strong className="text-emerald-400 font-bold">
                  {hideBalances ? "•• €" : `${formatCurrency(displayBudgetJour, { showSign: false })} / jour`}
                </strong>
              </p>
            </div>

            {/* Barre de métadonnées Sécurité */}
            <div className="pt-4 mt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-400" />
                Connexion bancaire chiffrée
              </span>
              <span className="font-medium text-slate-300">
                {transactions.length} transactions analysées
              </span>
            </div>
          </div>

          {/* CARTE 2 : CARTE D'OPTIMISATION BUDGET IA (Milky Smart Card + Slider vert) (lg:col-span-6) */}
          <div className="lg:col-span-6 rounded-[32px] bg-white/95 backdrop-blur-3xl border border-white/90 shadow-[0_20px_50px_rgba(0,0,0,0.25)] p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden group">
            
            <div className="flex items-start justify-between">
              <div className="space-y-1.5 pr-3">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700 border border-indigo-500/25 text-[10px] font-black uppercase tracking-wider">
                  <Sparkles size={11} />
                  Intelligence Financière
                </div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug tracking-tight">
                  Optimisations détectées dans votre budget
                </h2>
                <p className="text-xs text-slate-500">
                  Abonnements récurrents, micro-frais et leviers d'épargne prêts à activer.
                </p>
              </div>

              <div className="flex flex-col items-end shrink-0 pl-2">
                <span className="text-4xl sm:text-5xl font-black text-slate-950 tracking-tight leading-none">
                  18
                </span>
                <span className="text-[10px] font-extrabold tracking-widest text-slate-400 uppercase mt-1">
                  alertes
                </span>
              </div>
            </div>

            {/* Slider Interactif avec bouton vert vif Ron Design #38C976 */}
            <div 
              onClick={() => setIsSavingsDrawerOpen(true)}
              className="w-full h-14 rounded-full bg-slate-100 hover:bg-slate-200/80 border border-slate-200 p-1.5 flex items-center justify-between cursor-pointer group/btn transition-all select-none active:scale-[0.99] shadow-inner mt-4"
            >
              {/* Bouton fléché vert vif avec halo lumineux */}
              <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#38C976] to-[#4ADE80] text-white flex items-center justify-center shadow-[0_0_18px_rgba(56,201,118,0.55)] group-hover/btn:scale-105 transition-transform shrink-0">
                <ArrowRight size={20} strokeWidth={2.5} />
              </div>

              <span className="text-xs sm:text-sm font-bold text-slate-800 group-hover/btn:text-slate-950 transition-colors">
                Vérifier les économies
              </span>

              {/* Puce LED active Coach IA */}
              <div className="pr-3.5 flex items-center">
                <span className="w-2.5 h-2.5 rounded-full bg-[#34D399] shadow-[0_0_8px_#34D399] animate-pulse" />
              </div>
            </div>
          </div>

        </section>

        {/* =========================================================================
            ROW 3 : LES 4 PILIERS FINANCIERS KPI (REV, FIX, VAR, EPA)
            VERRE DÉPOLI VÉRITABLE & HALOS VOLUMÉTRIQUES FIDÈLES À RON DESIGN (IMAGE 3/7)
           ========================================================================= */}
        <section className="w-full space-y-3">
          
          <div className="w-full flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300">
                Piliers Financiers & Analyse des flux
              </h3>
            </div>
            <span className="text-xs font-semibold text-slate-400">
              {currentMonthLabel}
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            
            {/* CARTE 1 : Revenus (Entrées d'argent) */}
            <article 
              onClick={handleOpenPillarIncome}
              className="relative rounded-[32px] bg-slate-900/70 hover:bg-slate-900/85 backdrop-blur-3xl border border-white/20 hover:border-amber-400/50 shadow-[0_16px_36px_rgba(0,0,0,0.4),inset_0_1px_1.5px_rgba(255,255,255,0.25)] p-5 flex flex-col justify-between h-[195px] transition-all duration-300 cursor-pointer group overflow-hidden active:scale-[0.98]"
            >
              {/* Halo d'ambiance doré interne */}
              <div className="absolute -top-10 -left-10 w-32 h-32 rounded-full bg-amber-500/25 blur-3xl group-hover:bg-amber-500/35 transition-colors pointer-events-none" />

              <div className="relative z-10 flex items-start justify-between">
                <div>
                  <span className="text-lg sm:text-xl font-black text-white tracking-tight block">
                    Revenus
                  </span>
                  <span className="text-xs text-white/70 font-normal">
                    Entrées & Salaires
                  </span>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300">
                  {filteredTransactions.filter(t => (Number(t.amount) || 0) > 0 && !t.isInternalTransfer).length} virements
                </span>
              </div>

              {/* Courbe SVG lumineuse haute-définition */}
              <div className="relative z-10 w-full my-auto py-1">
                <svg className="w-full h-10 overflow-visible" fill="none" viewBox="0 0 160 36">
                  <line x1="4" y1="18" x2="156" y2="18" stroke="rgba(255,255,255,0.25)" strokeDasharray="2 3" strokeWidth="1" />
                  <path d="M4 26 C 45 26, 75 14, 105 14 C 130 14, 145 8, 156 8" stroke="rgba(255, 255, 255, 0.95)" strokeLinecap="round" strokeWidth="1.8" />
                  <circle cx="60" cy="18" r="2" fill="none" stroke="white" strokeWidth="1.5" />
                  <circle cx="105" cy="14" r="2" fill="none" stroke="white" strokeWidth="1.5" />
                  <circle cx="156" cy="8" r="3.2" fill="white" filter="drop-shadow(0px 0px 5px white)" />
                </svg>
              </div>

              <div className="relative z-10 flex items-end justify-between">
                <div className="w-7 h-7 rounded-full bg-white/15 border border-white/30 flex items-center justify-center text-white text-xs font-bold shadow-xs">
                  €
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-white/60 font-medium leading-none">Total des entrées</div>
                  <div className="text-base sm:text-lg font-black text-white tracking-tight leading-tight mt-1">
                    {hideBalances ? "•••• €" : `+${formatCurrency(kpis.revenus, { showSign: false })}`}
                  </div>
                </div>
              </div>
            </article>

            {/* CARTE 2 : Charges Fixes */}
            <article 
              onClick={handleOpenPillarFixed}
              className="relative rounded-[32px] bg-slate-900/70 hover:bg-slate-900/85 backdrop-blur-3xl border border-white/20 hover:border-purple-400/50 shadow-[0_16px_36px_rgba(0,0,0,0.4),inset_0_1px_1.5px_rgba(255,255,255,0.25)] p-5 flex flex-col justify-between h-[195px] transition-all duration-300 cursor-pointer group overflow-hidden active:scale-[0.98]"
            >
              {/* Halo d'ambiance violet interne */}
              <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-purple-500/25 blur-3xl group-hover:bg-purple-500/35 transition-colors pointer-events-none" />

              <div className="relative z-10 flex items-start justify-between">
                <div>
                  <span className="text-lg sm:text-xl font-black text-white tracking-tight block">
                    Charges Fixes
                  </span>
                  <span className="text-xs text-white/70 font-normal">
                    Dépenses incompressibles
                  </span>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300">
                  {kpis.revenus > 0 ? `${((kpis.fixe / kpis.revenus) * 100).toFixed(0)}% des revenus` : 'Incompressible'}
                </span>
              </div>

              {/* Courbe SVG lumineuse haute-définition */}
              <div className="relative z-10 w-full my-auto py-1">
                <svg className="w-full h-10 overflow-visible" fill="none" viewBox="0 0 160 36">
                  <line x1="4" y1="18" x2="156" y2="18" stroke="rgba(255,255,255,0.25)" strokeDasharray="2 3" strokeWidth="1" />
                  <path d="M4 10 C 50 10, 75 26, 110 26 C 135 26, 145 20, 156 18" stroke="rgba(255, 255, 255, 0.95)" strokeLinecap="round" strokeWidth="1.8" />
                  <circle cx="75" cy="26" r="2" fill="none" stroke="white" strokeWidth="1.5" />
                  <circle cx="120" cy="24" r="2" fill="none" stroke="white" strokeWidth="1.5" />
                  <circle cx="156" cy="18" r="3.2" fill="white" filter="drop-shadow(0px 0px 5px white)" />
                </svg>
              </div>

              <div className="relative z-10 flex items-end justify-between">
                <div className="w-7 h-7 rounded-full bg-white/15 border border-white/30 flex items-center justify-center text-white text-xs font-bold shadow-xs">
                  €
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-white/60 font-medium leading-none">Total charges fixes</div>
                  <div className="text-base sm:text-lg font-black text-white tracking-tight leading-tight mt-1">
                    {hideBalances ? "•••• €" : `-${formatCurrency(kpis.fixe, { showSign: false })}`}
                  </div>
                </div>
              </div>
            </article>

            {/* CARTE 3 : Dépenses Variables */}
            <article 
              onClick={handleOpenPillarVariable}
              className="relative rounded-[32px] bg-slate-900/70 hover:bg-slate-900/85 backdrop-blur-3xl border border-white/20 hover:border-emerald-400/50 shadow-[0_16px_36px_rgba(0,0,0,0.4),inset_0_1px_1.5px_rgba(255,255,255,0.25)] p-5 flex flex-col justify-between h-[195px] transition-all duration-300 cursor-pointer group overflow-hidden active:scale-[0.98]"
            >
              {/* Halo d'ambiance émeraude interne */}
              <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-emerald-500/25 blur-3xl group-hover:bg-emerald-500/35 transition-colors pointer-events-none" />

              <div className="relative z-10 flex items-start justify-between">
                <div>
                  <span className="text-lg sm:text-xl font-black text-white tracking-tight block">
                    Dépenses Variables
                  </span>
                  <span className="text-xs text-white/70 font-normal">
                    Consommation & Quotidien
                  </span>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                  {kpis.revenus > 0 ? `${((kpis.variable / kpis.revenus) * 100).toFixed(0)}% des revenus` : 'Quotidien'}
                </span>
              </div>

              {/* Courbe SVG lumineuse haute-définition */}
              <div className="relative z-10 w-full my-auto py-1">
                <svg className="w-full h-10 overflow-visible" fill="none" viewBox="0 0 160 36">
                  <line x1="4" y1="18" x2="156" y2="18" stroke="rgba(255,255,255,0.25)" strokeDasharray="2 3" strokeWidth="1" />
                  <path d="M4 24 C 35 24, 60 14, 85 15 C 115 16, 135 27, 156 24" stroke="rgba(255, 255, 255, 0.95)" strokeLinecap="round" strokeWidth="1.8" />
                  <circle cx="50" cy="17" r="2" fill="none" stroke="white" strokeWidth="1.5" />
                  <circle cx="100" cy="18" r="2" fill="none" stroke="white" strokeWidth="1.5" />
                  <circle cx="156" cy="24" r="3.2" fill="white" filter="drop-shadow(0px 0px 5px white)" />
                </svg>
              </div>

              <div className="relative z-10 flex items-end justify-between">
                <div className="w-7 h-7 rounded-full bg-white/15 border border-white/30 flex items-center justify-center text-white text-xs font-bold shadow-xs">
                  €
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-white/60 font-medium leading-none">Total variable</div>
                  <div className="text-base sm:text-lg font-black text-white tracking-tight leading-tight mt-1">
                    {hideBalances ? "•••• €" : `-${formatCurrency(kpis.variable, { showSign: false })}`}
                  </div>
                </div>
              </div>
            </article>

            {/* CARTE 4 : Épargne Nette */}
            <article 
              onClick={handleOpenPillarSavings}
              className="relative rounded-[32px] bg-slate-900/70 hover:bg-slate-900/85 backdrop-blur-3xl border border-white/20 hover:border-cyan-400/50 shadow-[0_16px_36px_rgba(0,0,0,0.4),inset_0_1px_1.5px_rgba(255,255,255,0.25)] p-5 flex flex-col justify-between h-[195px] transition-all duration-300 cursor-pointer group overflow-hidden active:scale-[0.98]"
            >
              {/* Halo d'ambiance cyan interne */}
              <div className="absolute -bottom-10 -right-10 w-32 h-32 rounded-full bg-cyan-500/25 blur-3xl group-hover:bg-cyan-500/35 transition-colors pointer-events-none" />

              <div className="relative z-10 flex items-start justify-between">
                <div>
                  <span className="text-lg sm:text-xl font-black text-white tracking-tight block">
                    Épargne Nette
                  </span>
                  <span className="text-xs text-white/70 font-normal">
                    Capacité d'épargne réelle
                  </span>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                  {kpis.tauxEpargne.toFixed(1)}% du budget
                </span>
              </div>

              {/* Courbe SVG lumineuse haute-définition */}
              <div className="relative z-10 w-full my-auto py-1">
                <svg className="w-full h-10 overflow-visible" fill="none" viewBox="0 0 160 36">
                  <line x1="4" y1="18" x2="156" y2="18" stroke="rgba(255,255,255,0.25)" strokeDasharray="2 3" strokeWidth="1" />
                  <path d="M4 27 C 45 27, 85 22, 115 17 C 135 14, 148 10, 156 8" stroke="rgba(255, 255, 255, 0.95)" strokeLinecap="round" strokeWidth="1.8" />
                  <circle cx="65" cy="24" r="2" fill="none" stroke="white" strokeWidth="1.5" />
                  <circle cx="115" cy="17" r="2" fill="none" stroke="white" strokeWidth="1.5" />
                  <circle cx="156" cy="8" r="3.2" fill="white" filter="drop-shadow(0px 0px 5px white)" />
                </svg>
              </div>

              <div className="relative z-10 flex items-end justify-between">
                <div className="w-7 h-7 rounded-full bg-white/15 border border-white/30 flex items-center justify-center text-white text-xs font-bold shadow-xs">
                  €
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-white/60 font-medium leading-none">Épargne constituée</div>
                  <div className="text-base sm:text-lg font-black text-white tracking-tight leading-tight mt-1">
                    {hideBalances ? "•••• €" : `+${formatCurrency(kpis.epargne, { showSign: false })}`}
                  </div>
                </div>
              </div>
            </article>

          </div>
        </section>

        {/* =========================================================================
            ROW 4 : ÉVOLUTION GLOBALE DES FLUX (GRAPHIQUE PANORAMIQUE DYNAMIQUE)
           ========================================================================= */}
        <section className="w-full">
          <GlobalEvolutionChart 
            transactions={transactions}
            filteredTransactions={filteredTransactions}
            selectedMonth={selectedMonth}
            loading={loading}
          />
        </section>

        {/* =========================================================================
            ROW 5 : ZONE UNIFIÉE DE VENTILATION DES DÉPENSES (DONUT + MATRICE CATÉGORIES)
            Rassemble toute l'analyse des catégories au même endroit sans trou
           ========================================================================= */}
        <section className="w-full">
          <UnifiedCategorySection 
            categoryStats={categoryStats}
            filteredTransactions={filteredTransactions}
            onSelectCategory={handleOpenCategoryAuditItem}
            hideBalances={hideBalances}
          />
        </section>

      </div>

      {/* =========================================================================
          DRAWERS & MODALS CONTEXTUELS
         ========================================================================= */}
      
      {/* Drawer 1 : Recommandations d'économies & 18 Alertes Coach IA */}
      <SavingsAlertsDrawer 
        isOpen={isSavingsDrawerOpen}
        onClose={() => setIsSavingsDrawerOpen(false)}
        kpis={kpis}
        transactions={filteredTransactions}
      />

      {/* Modal 2 : Scanner Rapide de relevés & tickets */}
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
