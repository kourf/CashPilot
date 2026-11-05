import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Play, 
  Info, 
  Sparkles, 
  FileText, 
  Receipt, 
  Lightbulb, 
  ArrowRight, 
  ShieldCheck, 
  CreditCard, 
  Layers, 
  ArrowUpRight, 
  ArrowDownRight, 
  ArrowLeftRight, 
  Users, 
  Lock, 
  ChevronRight, 
  HandCoins, 
  Activity
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { calculateKpis, filterByMonth, formatMonthLabel } from '../../lib/kpiUtils';
import { formatDateFR, formatCurrency } from '../../lib/bankUtils';
import { useTransactions } from '../../context/TransactionsContext';
import { 
  calculateCategoryStats, 
  calculateInternalTransfers, 
  calculatePeerTransfers, 
  type CategoryStatsItem 
} from '../../lib/categorizationRules';
import { CategoryAuditDrawer } from '../../components/CategoryAuditDrawer';
import { MonthSelector } from '../../components/MonthSelector';
import { GlobalEvolutionChart } from './components/GlobalEvolutionChart';
import { CategoryBreakdownChart } from './components/CategoryBreakdownChart';
import { CategoryVentilationSection } from './components/CategoryVentilationSection';
import { db } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { CATEGORIES } from '../../lib/bankParser';
import { getActiveAccountId } from '../../lib/userUtils';

const DEMO_TRANSACTIONS = [
  { id: 'demo-1', cleanLabel: 'Carrefour Market', category: 'Alimentation & Courses', amount: -85.20, date: '2026-06-15', nature: 'variable' },
  { id: 'demo-2', cleanLabel: 'Virement Salaire Mensuel', category: 'Revenus', amount: 3200.00, date: '2026-06-01', nature: 'autre' },
  { id: 'demo-3', cleanLabel: 'Netflix & Spotify Family', category: 'Abonnements & Médias', amount: -27.98, date: '2026-06-12', nature: 'fixe', isSubscription: true },
  { id: 'demo-4', cleanLabel: 'Virement Épargne Livret A', category: 'Épargne & Investissement', amount: -500.00, date: '2026-06-11', nature: 'autre', isInternalTransfer: true },
  { id: 'demo-5', cleanLabel: 'Total Énergies EDF', category: 'Logement & Charges', amount: -94.50, date: '2026-06-05', nature: 'fixe' },
  { id: 'demo-6', cleanLabel: 'Restaurant Le Comptoir', category: 'Restaurants & Sorties', amount: -64.00, date: '2026-06-10', nature: 'variable' },
  { id: 'demo-7', cleanLabel: 'Prélèvement Amex (CB Diff)', category: 'Remboursement Carte (Amex)', amount: -350.00, date: '2026-06-28', nature: 'autre', isInternalTransfer: true },
  { id: 'demo-8', cleanLabel: 'Virement Wero Reçu Thomas', category: 'Virement Reçu (Proches)', amount: 45.00, date: '2026-06-14', nature: 'autre', isFamilyTransfer: true },
  { id: 'demo-9', cleanLabel: 'Virement Paylib Envoi Sarah', category: 'Virements Famille & Proches', amount: -30.00, date: '2026-06-13', nature: 'autre', isFamilyTransfer: true },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [isDemo, setIsDemo] = useState(false);
  
  const { 
    transactions, 
    loading: ctxLoading, 
    error: ctxError, 
    selectedMonth, 
    setSelectedMonth, 
    availableMonths 
  } = useTransactions();

  const loading = isDemo ? false : ctxLoading;
  const error = isDemo ? null : ctxError;

  const filteredTransactions = useMemo(() => {
    return isDemo ? (DEMO_TRANSACTIONS as any) : filterByMonth(transactions, selectedMonth);
  }, [transactions, selectedMonth, isDemo]);

  const kpis = useMemo(() => calculateKpis(filteredTransactions), [filteredTransactions]);

  // Operations count by month for MonthSelector badges
  const transactionsCountByMonth = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.forEach(t => {
      const m = t.monthKey || (t.date ? t.date.substring(0, 7) : '');
      if (m) map[m] = (map[m] || 0) + 1;
    });
    return map;
  }, [transactions]);

  // Advanced Category Stats & Nature breakdown
  const categoryStats = useMemo(() => {
    return calculateCategoryStats(filteredTransactions);
  }, [filteredTransactions]);

  // Inter-Accounts flows (own accounts, neutralized)
  const interAccountsSummary = useMemo(() => {
    return calculateInternalTransfers(filteredTransactions);
  }, [filteredTransactions]);

  // P2P Peer transfers (Family & Friends)
  const peerTransfersSummary = useMemo(() => {
    return calculatePeerTransfers(filteredTransactions);
  }, [filteredTransactions]);

  // Audit Drawer states
  const [isAuditDrawerOpen, setIsAuditDrawerOpen] = useState(false);
  const [auditType, setAuditType] = useState<'category' | 'inter-accounts' | 'peer-transfers'>('category');
  const [selectedCategoryData, setSelectedCategoryData] = useState<CategoryStatsItem | null>(null);

  const handleOpenCategoryAuditByName = (catName: string) => {
    const found = categoryStats.categories.find(c => c.category === catName);
    if (found) {
      setSelectedCategoryData(found);
      setAuditType('category');
      setIsAuditDrawerOpen(true);
    }
  };

  const handleOpenCategoryAuditItem = (catItem: CategoryStatsItem) => {
    setSelectedCategoryData(catItem);
    setAuditType('category');
    setIsAuditDrawerOpen(true);
  };

  const handleOpenInterAccountsAudit = () => {
    setAuditType('inter-accounts');
    setIsAuditDrawerOpen(true);
  };

  const handleOpenPeerTransfersAudit = () => {
    setAuditType('peer-transfers');
    setIsAuditDrawerOpen(true);
  };

  const handleTransactionCategoryChange = async (txId: string, newCategory: string) => {
    try {
      if (txId.startsWith('demo-')) return;
      const accountId = getActiveAccountId();
      const docRef = doc(db, `users/${accountId}/transactions`, txId);
      await updateDoc(docRef, { category: newCategory });
    } catch (err) {
      console.error('Failed to update category', err);
    }
  };

  const isEmpty = !loading && !isDemo && filteredTransactions.length === 0 && !error;
  
  const displayRevenus = isDemo ? 3200 : kpis.revenus;
  const displayDepenses = isDemo ? 1980 : kpis.depenses;
  const displayReste = isDemo ? (displayRevenus - displayDepenses) : kpis.resteAVivre;
  const displayBudgetJour = isDemo ? (displayReste / 30) : kpis.budgetJournalier;
  const displayAbonnements = isDemo ? '27,98 €' : kpis.abonnements > 0 ? `${kpis.abonnements.toFixed(2)} €` : '0 €';

  const displayTransactions = isDemo ? DEMO_TRANSACTIONS.slice(0, 6) : filteredTransactions.slice(0, 6);

  // Financial health ratio: portion of revenues saved / remaining
  const savingsRate = displayRevenus > 0 ? Math.max(0, (displayReste / displayRevenus) * 100) : 0;
  const isHealthy = displayReste >= 0;

  const Skeleton = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <div className={cn("animate-pulse bg-white/[0.06] rounded-2xl", className)} style={style} />
  );

  return (
    <div className="w-full py-4 sm:py-6 space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-36 sm:pb-32 md:pb-12 text-slate-100 select-none">
      
      {/* =========================================================================
          TOP COMMAND CENTER BAR: MonthSelector, Live Sync & VisionOS Branding
         ========================================================================= */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.03] backdrop-blur-2xl p-4 sm:p-5 rounded-3xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(56,189,248,0.9)] animate-pulse" />
            <span className="text-[11px] font-extrabold tracking-widest text-cyan-300 uppercase">
              Cockpit Financier • Vision 360
            </span>
            {isDemo && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Mode Démo Actif
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1 text-white flex items-center gap-3">
            Aperçu de Trésorerie
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">
            {selectedMonth === 'all' 
              ? `Vue consolidée sur ${transactions.length} opération${transactions.length > 1 ? 's' : ''}` 
              : `Période active : ${formatMonthLabel(selectedMonth)} • ${filteredTransactions.length} opération${filteredTransactions.length > 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Premium Month Selector & Action controls */}
        <div className="flex items-center gap-3 self-stretch sm:self-auto flex-wrap sm:flex-nowrap justify-between sm:justify-end">
          {!isDemo && availableMonths.length > 0 && (
            <MonthSelector
              selectedMonth={selectedMonth}
              onChange={setSelectedMonth}
              availableMonths={availableMonths}
              transactionsCountByMonth={transactionsCountByMonth}
              totalTransactionsCount={transactions.length}
            />
          )}

          {isEmpty && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsDemo(true)}
              className="bg-white/[0.08] border-white/20 text-white hover:bg-white/[0.15] rounded-2xl shadow-sm"
            >
              <Play className="w-3.5 h-3.5 mr-1.5 text-cyan-400 fill-cyan-400/20" /> Mode Démo
            </Button>
          )}

          {isDemo && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsDemo(false)}
              className="bg-white/[0.08] border-white/20 text-slate-200 hover:bg-white/[0.15] rounded-2xl"
            >
              Quitter la démo
            </Button>
          )}
        </div>
      </div>

      {/* Error notification */}
      {error && (
        <div className="backdrop-blur-2xl border border-rose-500/30 bg-rose-500/10 rounded-3xl p-4 sm:p-5 flex items-start gap-3 animate-in fade-in shadow-lg">
          <Info className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="w-full">
            <h3 className="text-sm font-bold text-rose-300">Information du système</h3>
            <p className="text-xs text-rose-200/80 mt-0.5">{error}</p>
            <Button 
              size="sm" 
              variant="outline" 
              className="mt-2.5 h-8 text-xs border-rose-400/30 text-rose-200 hover:bg-rose-500/20 rounded-xl" 
              onClick={() => window.location.reload()}
            >
              Actualiser
            </Button>
          </div>
        </div>
      )}

      {/* Empty State Banner */}
      {isEmpty && !error && (
        <div className="relative overflow-hidden rounded-3xl bg-white/[0.04] backdrop-blur-2xl border border-white/15 p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-cyan-500/20 via-primary/20 to-transparent rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-cyan-500/25 border border-white/20">
              <Sparkles size={24} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Bienvenue sur votre cockpit CashPilot
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed mt-1">
                Importez votre premier relevé bancaire (CSV ou PDF) pour alimenter en temps réel tous vos indicateurs de trésorerie, vos flux et la matrice comparatrice.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button 
                onClick={() => navigate('/releves')} 
                className="bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white rounded-2xl shadow-lg shadow-cyan-500/25 border border-white/20 font-semibold"
              >
                <FileText className="w-4 h-4 mr-2" /> Importer un relevé
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate('/tickets')}
                className="bg-white/[0.08] hover:bg-white/[0.15] border-white/20 text-white rounded-2xl"
              >
                <Receipt className="w-4 h-4 mr-2 text-cyan-400" /> Scanner un ticket
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          HERO BENTO GRID: 4 Top Financial Health KPI Cards (Apple Stitch Design DNA)
         ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        
        {/* CARD 1: HERO "Reste à vivre" */}
        <div className="rounded-3xl bg-gradient-to-b from-white/[0.09] to-white/[0.03] backdrop-blur-2xl border border-white/20 p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.3)] relative overflow-hidden group flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-44 h-44 bg-gradient-to-bl from-cyan-500/25 to-transparent rounded-full blur-3xl pointer-events-none group-hover:scale-125 transition-transform duration-700" />
          
          <div>
            <div className="flex items-center justify-between pb-3">
              <div>
                <span className="text-[10px] sm:text-[11px] font-bold text-cyan-300 uppercase tracking-wider block">
                  Capacité disponible
                </span>
                <h3 className="text-base sm:text-lg font-extrabold text-white mt-0.5">Reste à vivre</h3>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-white/[0.1] border border-white/20 text-cyan-400 flex items-center justify-center shadow-lg group-hover:rotate-6 transition-transform">
                <Wallet size={22} className="stroke-[2.2]" />
              </div>
            </div>

            <div className="space-y-2 mt-2">
              {loading ? (
                <Skeleton className="h-10 w-40 mb-2" />
              ) : (
                <div className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white drop-shadow-[0_4px_16px_rgba(56,189,248,0.25)]">
                  {formatCurrency(displayReste, { showSign: false })}
                </div>
              )}
              <p className="text-[11px] text-slate-300 flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-emerald-400 shrink-0" />
                <span>Revenus nets de charges réelles</span>
              </p>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 block font-medium">Budget par jour</span>
              <span className="text-xs sm:text-sm font-extrabold text-white">
                {loading ? '...' : `${formatCurrency(displayBudgetJour, { showSign: false })} / jour`}
              </span>
            </div>
            <span className={cn(
              "text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 border shadow-sm",
              isHealthy 
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.3)]" 
                : "bg-rose-500/20 text-rose-300 border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.3)]"
            )}>
              {isHealthy ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {isHealthy ? 'Positif' : 'Déficit'}
            </span>
          </div>
        </div>

        {/* CARD 2: REVENUS DU MOIS */}
        <div className="rounded-3xl bg-white/[0.04] backdrop-blur-2xl border border-white/10 p-5 sm:p-6 shadow-[0_16px_36px_rgba(0,0,0,0.35)] hover:border-emerald-500/30 transition-all duration-300 group flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3">
              <div>
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Entrées financières
                </span>
                <h3 className="text-base sm:text-lg font-extrabold text-white mt-0.5">Revenus encaissés</h3>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                <TrendingUp size={22} className="stroke-[2.2]" />
              </div>
            </div>

            <div className="space-y-2 mt-2">
              {loading ? (
                <Skeleton className="h-10 w-36 mb-2" />
              ) : (
                <div className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-emerald-400 drop-shadow-[0_2px_12px_rgba(16,185,129,0.25)]">
                  +{formatCurrency(displayRevenus, { showSign: false })}
                </div>
              )}
              <p className="text-[11px] text-slate-400">
                Salaires, rentes & encaissements réels
              </p>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between text-xs">
            <span className="text-slate-400 text-[11px]">Part préservée</span>
            <span className="font-bold text-emerald-400 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px]">
              {savingsRate.toFixed(1)} %
            </span>
          </div>
        </div>

        {/* CARD 3: DÉPENSES RÉELLES */}
        <div className="rounded-3xl bg-white/[0.04] backdrop-blur-2xl border border-white/10 p-5 sm:p-6 shadow-[0_16px_36px_rgba(0,0,0,0.35)] hover:border-rose-500/30 transition-all duration-300 group flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3">
              <div>
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Sorties d'argent
                </span>
                <h3 className="text-base sm:text-lg font-extrabold text-white mt-0.5">Dépenses réelles</h3>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-rose-500/15 border border-rose-500/25 text-rose-400 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                <TrendingDown size={22} className="stroke-[2.2]" />
              </div>
            </div>

            <div className="space-y-2 mt-2">
              {loading ? (
                <Skeleton className="h-10 w-36 mb-2" />
              ) : (
                <div className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white drop-shadow-[0_2px_12px_rgba(244,63,94,0.2)]">
                  -{formatCurrency(displayDepenses, { showSign: false })}
                </div>
              )}
              <p className="text-[11px] text-slate-400">
                Charges fixes, consommation & imprévus
              </p>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between text-xs">
            <span className="text-slate-400 text-[11px]">Abonnements</span>
            <span className="font-bold text-indigo-300 px-2 py-0.5 rounded-lg bg-indigo-500/15 border border-indigo-500/25 text-[11px]">
              {displayAbonnements}
            </span>
          </div>
        </div>

        {/* CARD 4: CHARGES INCOMPRESSIBLES & ABONNEMENTS */}
        <div className="rounded-3xl bg-white/[0.04] backdrop-blur-2xl border border-white/10 p-5 sm:p-6 shadow-[0_16px_36px_rgba(0,0,0,0.35)] hover:border-cyan-500/30 transition-all duration-300 group flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3">
              <div>
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Structure fixe
                </span>
                <h3 className="text-base sm:text-lg font-extrabold text-white mt-0.5">Charges Fixes</h3>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 border border-cyan-500/25 text-cyan-400 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                <Layers size={22} className="stroke-[2.2]" />
              </div>
            </div>

            <div className="space-y-2 mt-2">
              {loading ? (
                <Skeleton className="h-10 w-36 mb-2" />
              ) : (
                <div className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-cyan-300 drop-shadow-[0_2px_12px_rgba(56,189,248,0.25)]">
                  {formatCurrency(isDemo ? 650 : kpis.fixe, { showSign: false })}
                </div>
              )}
              <p className="text-[11px] text-slate-400">
                Loyer, énergie, télécom & abonnements
              </p>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between text-xs">
            <span className="text-slate-400 text-[11px]">Dép. Variables</span>
            <span className="font-bold text-slate-200 px-2 py-0.5 rounded-lg bg-white/[0.06] border border-white/10 text-[11px]">
              {formatCurrency(isDemo ? 420 : kpis.variable, { showSign: false })}
            </span>
          </div>
        </div>

      </div>

      {/* =========================================================================
          SUB-METRICS CAPSULES (Charges Fixes, Dép. Variables, Épargne, Frais)
         ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        
        <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 p-4 flex flex-col justify-between hover:bg-white/[0.06] transition-colors">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Charges Fixes</span>
            <Layers size={17} className="text-cyan-400" />
          </div>
          <div className="mt-2.5">
            {loading ? <Skeleton className="h-6 w-20" /> : (
              <span className="text-lg sm:text-xl font-black text-white">
                {formatCurrency(isDemo ? 650 : kpis.fixe, { showSign: false })}
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 mt-1">Loyer, énergies & régies</span>
        </div>

        <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 p-4 flex flex-col justify-between hover:bg-white/[0.06] transition-colors">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Dép. Variables</span>
            <CreditCard size={17} className="text-indigo-400" />
          </div>
          <div className="mt-2.5">
            {loading ? <Skeleton className="h-6 w-20" /> : (
              <span className="text-lg sm:text-xl font-black text-white">
                {formatCurrency(isDemo ? 420 : kpis.variable, { showSign: false })}
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 mt-1">Alimentation, loisirs & sorties</span>
        </div>

        <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 p-4 flex flex-col justify-between hover:bg-white/[0.06] transition-colors">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Épargne Mise de Côté</span>
            <Sparkles size={17} className="text-emerald-400" />
          </div>
          <div className="mt-2.5">
            {loading ? <Skeleton className="h-6 w-20" /> : (
              <span className="text-lg sm:text-xl font-black text-emerald-400">
                {formatCurrency(isDemo ? 500 : kpis.epargne, { showSign: false })}
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 mt-1">Trésorerie & investissements</span>
        </div>

        <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 p-4 flex flex-col justify-between hover:bg-white/[0.06] transition-colors">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Frais Bancaires</span>
            <Activity size={17} className="text-rose-400" />
          </div>
          <div className="mt-2.5">
            {loading ? <Skeleton className="h-6 w-20" /> : (
              <span className="text-lg sm:text-xl font-black text-rose-400">
                {formatCurrency(isDemo ? 12.50 : kpis.frais, { showSign: false })}
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 mt-1">Commissions & tenues de compte</span>
        </div>

      </div>

      {/* =========================================================================
          DEDICATED MODULES: Mouvements Inter-Comptes & Échanges Famille/Amis
         ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Module Mouvements Inter-Comptes */}
        <div 
          onClick={handleOpenInterAccountsAudit}
          className="rounded-3xl bg-white/[0.04] backdrop-blur-2xl p-5 border border-white/10 hover:border-cyan-500/40 transition-all cursor-pointer relative overflow-hidden group shadow-lg"
        >
          <div className="absolute top-0 right-0 w-36 h-36 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform" />
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/25 text-cyan-400 flex items-center justify-center font-bold">
                <ArrowLeftRight size={19} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  Mouvements Inter-Comptes
                  <span className="text-[10px] bg-cyan-500/15 text-cyan-300 border border-cyan-500/25 px-2 py-0.5 rounded-full font-semibold">Flux Neutre</span>
                </h3>
                <p className="text-[11px] text-slate-400">Virements propres exclus des dépenses réelles</p>
              </div>
            </div>
            <div className="flex items-center text-xs font-semibold text-cyan-400 group-hover:translate-x-1 transition-transform">
              <span>Auditer</span>
              <ChevronRight size={15} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/10">
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400">Entrées propres</span>
              <p className="text-xs sm:text-sm font-bold text-emerald-400 truncate">
                +{formatCurrency(interAccountsSummary.inflows, { showSign: false })}
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400">Sorties propres</span>
              <p className="text-xs sm:text-sm font-bold text-slate-200 truncate">
                -{formatCurrency(interAccountsSummary.outflows, { showSign: false })}
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400">Solde Net</span>
              <p className={cn(
                "text-xs sm:text-sm font-black truncate",
                interAccountsSummary.net >= 0 ? "text-emerald-400" : "text-amber-400"
              )}>
                {interAccountsSummary.net >= 0 ? '+' : ''}{formatCurrency(interAccountsSummary.net, { showSign: false })}
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-1.5">
            <span>{interAccountsSummary.transactions.length} opération{interAccountsSummary.transactions.length > 1 ? 's' : ''} neutralisée{interAccountsSummary.transactions.length > 1 ? 's' : ''}</span>
            <span className="text-cyan-300 font-medium flex items-center gap-1">
              <Lock size={11} /> 0 impact sur le Reste à Vivre
            </span>
          </div>
        </div>

        {/* Module Échanges Famille & Amis */}
        <div 
          onClick={handleOpenPeerTransfersAudit}
          className="rounded-3xl bg-white/[0.04] backdrop-blur-2xl p-5 border border-white/10 hover:border-indigo-500/40 transition-all cursor-pointer relative overflow-hidden group shadow-lg"
        >
          <div className="absolute top-0 right-0 w-36 h-36 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform" />
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 flex items-center justify-center font-bold">
                <Users size={19} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  Échanges Famille & Amis
                  <span className="text-[10px] bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 px-2 py-0.5 rounded-full font-semibold">Particuliers</span>
                </h3>
                <p className="text-[11px] text-slate-400">Wero, Paylib, proches & remboursements</p>
              </div>
            </div>
            <div className="flex items-center text-xs font-semibold text-indigo-300 group-hover:translate-x-1 transition-transform">
              <span>Auditer</span>
              <ChevronRight size={15} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/10">
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400">Reçu de proches</span>
              <p className="text-xs sm:text-sm font-bold text-emerald-400 truncate">
                +{formatCurrency(peerTransfersSummary.totalReceived, { showSign: false })}
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400">Envoyé à proches</span>
              <p className="text-xs sm:text-sm font-bold text-rose-400 truncate">
                -{formatCurrency(peerTransfersSummary.totalSent, { showSign: false })}
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400">Position nette</span>
              <p className={cn(
                "text-xs sm:text-sm font-black truncate",
                peerTransfersSummary.net >= 0 ? "text-emerald-400" : "text-rose-400"
              )}>
                {peerTransfersSummary.net >= 0 ? '+' : ''}{formatCurrency(peerTransfersSummary.net, { showSign: false })}
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-1.5">
            <span>{peerTransfersSummary.transactions.length} flux P2P recensé{peerTransfersSummary.transactions.length > 1 ? 's' : ''}</span>
            <span className={cn(
              "font-medium flex items-center gap-1",
              peerTransfersSummary.net >= 0 ? "text-emerald-400" : "text-rose-400"
            )}>
              <HandCoins size={11} /> {peerTransfersSummary.net >= 0 ? 'Position Créancière' : 'Position Débitrice'}
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          UPGRADED CHARTS SECTION: Évolution Globale + Ventilation Donut
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
        
        {/* Dynamic Evolution Chart (4 cols on desktop) */}
        <div className="col-span-1 lg:col-span-4">
          <GlobalEvolutionChart
            transactions={transactions}
            filteredTransactions={filteredTransactions}
            selectedMonth={selectedMonth}
            isDemo={isDemo}
            loading={loading}
          />
        </div>

        {/* Dynamic Category Breakdown Donut (3 cols on desktop) */}
        <div className="col-span-1 lg:col-span-3">
          <CategoryBreakdownChart
            filteredTransactions={filteredTransactions}
            onSelectCategory={handleOpenCategoryAuditByName}
            loading={loading}
          />
        </div>

      </div>

      {/* =========================================================================
          REFINED VENTILATION SECTION: Filtered, Categorized & Balanced
         ========================================================================= */}
      <CategoryVentilationSection
        categoryStats={categoryStats}
        onSelectCategory={handleOpenCategoryAuditItem}
      />

      {/* =========================================================================
          RECENT OPERATIONS & AI INTELLIGENCE
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
        
        {/* Transactions list (Apple Wallet style) */}
        <div className="col-span-1 lg:col-span-4 rounded-3xl bg-white/[0.04] backdrop-blur-2xl p-4 sm:p-6 border border-white/10 shadow-[0_16px_36px_rgba(0,0,0,0.4)]">
          <div className="flex flex-row items-center justify-between pb-4 border-b border-white/10">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Flux récents</span>
              <h3 className="text-base font-extrabold text-white mt-0.5">Dernières opérations</h3>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/releves')} 
              className="text-xs text-cyan-400 hover:text-cyan-300 hover:bg-white/[0.08] rounded-xl"
            >
              Voir tout <ArrowRight size={14} className="ml-1" />
            </Button>
          </div>

          <div className="pt-3">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-10 h-10 rounded-2xl" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-3.5 w-28" />
                        <Skeleton className="h-2.5 w-16" />
                      </div>
                    </div>
                    <Skeleton className="h-4 w-14" />
                  </div>
                ))}
              </div>
            ) : displayTransactions.length === 0 ? (
              <div className="py-12 text-center text-slate-400 flex flex-col items-center">
                <Info className="w-8 h-8 mb-2 opacity-30 text-cyan-400" />
                <p className="text-xs">Aucune transaction enregistrée.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {displayTransactions.map((tx: any, i: number) => {
                  const isPositive = (tx.amount || 0) > 0;
                  const isEpargne = tx.category === 'Épargne' || tx.category === 'Virements internes';
                  return (
                    <div key={i} className="py-3.5 flex items-center justify-between group hover:bg-white/[0.05] px-2.5 rounded-2xl transition-colors gap-2">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={cn(
                          "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105 shadow-md",
                          isPositive 
                            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)]" 
                            : isEpargne 
                              ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-300" 
                              : "bg-white/[0.06] border-white/10 text-slate-300"
                        )}>
                          {isPositive ? <ArrowUpRight size={17} /> : isEpargne ? <Sparkles size={17} /> : <CreditCard size={17} />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs sm:text-sm text-white truncate" title={tx.description || tx.cleanLabel || tx.rawLabel}>
                            {tx.description || tx.cleanLabel || tx.rawLabel}
                          </p>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <select
                              value={tx.category || 'Autres'}
                              onChange={(e) => handleTransactionCategoryChange(tx.id, e.target.value)}
                              className="font-medium bg-transparent border-none p-0 cursor-pointer focus:ring-0 appearance-none max-w-[120px] sm:max-w-[150px] truncate text-slate-300 hover:text-white transition-colors"
                              title="Modifier la catégorie"
                            >
                              {CATEGORIES.map(cat => (
                                <option key={cat} value={cat} className="bg-[#070a14] text-white">{cat}</option>
                              ))}
                            </select>
                            <span>•</span>
                            <span>{formatDateFR(tx.date)}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className={cn(
                        "font-black text-xs sm:text-sm shrink-0 ml-3",
                        isPositive ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]" : "text-white"
                      )}>
                        {formatCurrency(tx.amount || 0, { showSign: true })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Quick Launch & AI Insights (3 cols on desktop) */}
        <div className="col-span-1 lg:col-span-3 space-y-4">
          
          {/* AI Intelligence Card */}
          <div className="rounded-3xl bg-gradient-to-br from-cyan-500/15 via-primary/10 to-indigo-600/15 backdrop-blur-2xl p-6 border border-white/15 shadow-[0_16px_36px_rgba(0,0,0,0.4)] relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-36 h-36 bg-cyan-400/20 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform" />
            <div className="flex items-center gap-2.5 text-cyan-300 font-bold text-sm mb-2">
              <div className="w-7 h-7 rounded-xl bg-cyan-400/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
                <Lightbulb size={16} />
              </div>
              <span>Coach IA & Diagnostic</span>
            </div>
            <div className="space-y-3">
              <p className="text-xs text-slate-300 leading-relaxed">
                Le modèle analyse vos ratios fixes/variables pour détecter vos opportunités d'économies sur les abonnements et courses alimentaires.
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-xs font-bold justify-between bg-white/[0.08] hover:bg-white/[0.15] border-white/20 text-white rounded-2xl shadow-sm"
                onClick={() => navigate('/coach')}
              >
                <span>Consulter le diagnostic complet</span>
                <ArrowRight size={14} />
              </Button>
            </div>
          </div>

          {/* Direct Modules Navigation */}
          <div className="rounded-3xl bg-white/[0.04] backdrop-blur-2xl p-6 border border-white/10 shadow-[0_16px_36px_rgba(0,0,0,0.4)]">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
              Navigation Rapide
            </h4>
            <div className="space-y-2">
              <button 
                onClick={() => navigate('/releves')}
                className="w-full p-3 rounded-2xl flex items-center justify-between text-left text-xs font-bold bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/15 transition-all group"
              >
                <span className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">
                    <FileText size={15} />
                  </span>
                  <span className="text-white">Relevés Bancaires</span>
                </span>
                <ArrowRight size={14} className="text-slate-400 group-hover:translate-x-1 group-hover:text-cyan-400 transition-all" />
              </button>

              <button 
                onClick={() => navigate('/tickets')}
                className="w-full p-3 rounded-2xl flex items-center justify-between text-left text-xs font-bold bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/15 transition-all group"
              >
                <span className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                    <Receipt size={15} />
                  </span>
                  <span className="text-white">Tickets & Comparateur</span>
                </span>
                <ArrowRight size={14} className="text-slate-400 group-hover:translate-x-1 group-hover:text-indigo-300 transition-all" />
              </button>

              <button 
                onClick={() => navigate('/parametres')}
                className="w-full p-3 rounded-2xl flex items-center justify-between text-left text-xs font-bold bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/15 transition-all group"
              >
                <span className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                    <ShieldCheck size={15} />
                  </span>
                  <span className="text-white">Paramètres & Sécurité</span>
                </span>
                <ArrowRight size={14} className="text-slate-400 group-hover:translate-x-1 group-hover:text-emerald-400 transition-all" />
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* Slide-Over Drawer d'audit détaillé */}
      <CategoryAuditDrawer 
        isOpen={isAuditDrawerOpen}
        onClose={() => setIsAuditDrawerOpen(false)}
        auditType={auditType}
        categoryData={selectedCategoryData}
        interTransfersData={interAccountsSummary}
        peerTransfersData={peerTransfersSummary}
      />

    </div>
  );
}
