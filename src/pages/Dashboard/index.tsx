import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
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
  Filter,
  ShieldCheck,
  CreditCard,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  Users,
  Lock,
  ChevronRight,
  Eye,
  Tag,
  HandCoins,
  Compass,
  Zap,
  Activity
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { calculateKpis, filterByMonth, formatMonthLabel, buildCategoryBreakdown } from '../../lib/kpiUtils';
import { formatDateFR, formatCurrency } from '../../lib/bankUtils';
import { useTransactions } from '../../context/TransactionsContext';
import { 
  calculateCategoryStats, 
  calculateInternalTransfers, 
  calculatePeerTransfers, 
  type CategoryStatsItem 
} from '../../lib/categorizationRules';
import { CategoryAuditDrawer } from '../../components/CategoryAuditDrawer';
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
  const pieData = useMemo(() => buildCategoryBreakdown(filteredTransactions).slice(0, 5), [filteredTransactions]);

  // Statistiques avancées et segmentation par nature
  const categoryStats = useMemo(() => {
    return calculateCategoryStats(filteredTransactions);
  }, [filteredTransactions]);

  // Mouvements Inter-Comptes (flux propres neutralisés)
  const interAccountsSummary = useMemo(() => {
    return calculateInternalTransfers(filteredTransactions);
  }, [filteredTransactions]);

  // Échanges Famille & Amis
  const peerTransfersSummary = useMemo(() => {
    return calculatePeerTransfers(filteredTransactions);
  }, [filteredTransactions]);

  // État du Drawer d'audit détaillé
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

  // Luxury Apple High-Tech Palettes (Cyan, Emerald, Amber, Violet, Rose)
  const COLORS = ['#38BDF8', '#10B981', '#F59E0B', '#8B5CF6', '#F43F5E'];

  const chartData = transactions.reduce((acc: any, t) => {
    const month = t.monthKey || (t.date || '').substring(0, 7) || 'Inconnu';
    if (!acc[month]) acc[month] = { name: month, revenus: 0, depenses: 0 };
    if ((t.amount || 0) > 0 && t.category !== 'Virements internes') acc[month].revenus += (t.amount || 0);
    if ((t.amount || 0) < 0 && t.category !== 'Virements internes' && t.category !== 'Épargne') acc[month].depenses += Math.abs(t.amount || 0);
    return acc;
  }, {});

  const sortedChartData = Object.values(chartData).sort((a: any, b: any) => a.name.localeCompare(b.name));

  const demoData = [
    { name: 'Jan', depenses: 2400, revenus: 4000 },
    { name: 'Fév', depenses: 1398, revenus: 3000 },
    { name: 'Mar', depenses: 3800, revenus: 4200 },
    { name: 'Avr', depenses: 3908, revenus: 4800 },
    { name: 'Mai', depenses: 4800, revenus: 5000 },
    { name: 'Juin', depenses: 3800, revenus: 4300 },
  ];

  const isEmpty = !loading && !isDemo && filteredTransactions.length === 0 && !error;
  
  const displayRevenus = isDemo ? demoData.reduce((acc, d) => acc + d.revenus, 0) / demoData.length : kpis.revenus;
  const displayDepenses = isDemo ? demoData.reduce((acc, d) => acc + d.depenses, 0) / demoData.length : kpis.depenses;
  const displayReste = isDemo ? (displayRevenus - displayDepenses) : kpis.resteAVivre;
  const displayBudgetJour = isDemo ? (displayReste / 30) : kpis.budgetJournalier;
  const displayAbonnements = isDemo ? '3 abonn.' : kpis.abonnements > 0 ? `${kpis.abonnements.toFixed(2)} €` : '0 €';

  const displayChartData = isDemo ? demoData : sortedChartData;
  const displayTransactions = isDemo ? DEMO_TRANSACTIONS.slice(0, 6) : filteredTransactions.slice(0, 6);

  const Skeleton = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <div className={cn("animate-pulse bg-white/[0.06] rounded-2xl", className)} style={style} />
  );

  return (
    <div className="p-3 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-28 md:pb-12 text-slate-100 select-none">
      
      {/* Top Header Controls (Period selector & Demo badge) - Apple VisionOS Style */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.03] backdrop-blur-2xl p-4 sm:p-5 rounded-3xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(56,189,248,0.8)] animate-pulse" />
            <span className="text-[11px] font-bold tracking-widest text-cyan-300 uppercase">
              Cockpit Financier • VisionOS
            </span>
            {isDemo && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Mode Démo Actif
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1 text-white flex items-center gap-3">
            Aperçu de Trésorerie
          </h1>
        </div>

        <div className="flex items-center gap-2.5 self-stretch sm:self-auto">
          {!isDemo && availableMonths.length > 0 && (
            <div className="flex items-center gap-2 bg-white/[0.06] backdrop-blur-xl border border-white/15 rounded-2xl px-3.5 py-2 shadow-sm">
              <Filter className="w-4 h-4 text-cyan-400" />
              <select 
                className="bg-transparent text-xs sm:text-sm font-semibold outline-none text-slate-200 cursor-pointer"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                <option value="all" className="bg-[#070a14] text-white">Tous les mois</option>
                {availableMonths.map(m => (
                  <option key={m} value={m} className="bg-[#070a14] text-white">{formatMonthLabel(m)}</option>
                ))}
              </select>
            </div>
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

      {/* Empty State Banner (Apple Liquid Glass) */}
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

      {/* HERO BENTO GRID (Apple VisionOS / macOS Sequoia Style) */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-3">
        
        {/* HERO CARD : Apple Wallet Style "Reste à vivre" */}
        <div className="md:col-span-1 rounded-3xl bg-gradient-to-b from-white/[0.08] to-white/[0.03] backdrop-blur-2xl border border-white/20 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.3)] relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-cyan-500/25 to-transparent rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform duration-700" />
          
          <div className="flex items-center justify-between pb-3">
            <div>
              <span className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider block">
                Capacité nette mensuelle
              </span>
              <h3 className="text-lg font-extrabold text-white mt-0.5">Reste à vivre</h3>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-white/[0.1] border border-white/20 text-cyan-400 flex items-center justify-center shadow-lg group-hover:rotate-6 transition-transform">
              <Wallet size={22} className="stroke-[2.2]" />
            </div>
          </div>

          <div className="space-y-4 mt-2">
            <div>
              {loading ? (
                <Skeleton className="h-12 w-48 mb-2" />
              ) : (
                <div className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white drop-shadow-[0_4px_16px_rgba(56,189,248,0.25)]">
                  {formatCurrency(displayReste, { showSign: false })}
                </div>
              )}
              <p className="text-xs text-slate-300 mt-1.5 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-400" />
                Revenus encaissés nets de charges réelles
              </p>
            </div>

            <div className="pt-4 border-t border-white/10 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 block font-medium">Budget par jour</span>
                <span className="text-sm sm:text-base font-extrabold text-white">
                  {loading ? '...' : `${formatCurrency(displayBudgetJour, { showSign: false })} / jour`}
                </span>
              </div>
              <span className={cn(
                "text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 border shadow-sm",
                displayReste >= 0 
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.3)]" 
                  : "bg-rose-500/20 text-rose-300 border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.3)]"
              )}>
                {displayReste >= 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                {displayReste >= 0 ? 'Solde Positif' : 'Déficit'}
              </span>
            </div>
          </div>
        </div>

        {/* REVENUS DU MOIS */}
        <div className="rounded-3xl bg-white/[0.04] backdrop-blur-2xl border border-white/10 p-6 shadow-[0_16px_36px_rgba(0,0,0,0.35)] hover:border-emerald-500/30 transition-all duration-300 group">
          <div className="flex items-center justify-between pb-3">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Entrées financières
              </span>
              <h3 className="text-base font-extrabold text-white mt-0.5">Revenus du mois</h3>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
              <TrendingUp size={22} className="stroke-[2.2]" />
            </div>
          </div>

          <div className="space-y-4 mt-2">
            <div>
              {loading ? (
                <Skeleton className="h-10 w-40 mb-2" />
              ) : (
                <div className="text-3xl font-black tracking-tight text-emerald-400 drop-shadow-[0_2px_12px_rgba(16,185,129,0.25)]">
                  +{formatCurrency(displayRevenus, { showSign: false })}
                </div>
              )}
              <p className="text-xs text-slate-400 mt-1">
                Salaires, rentes & encaissements réels
              </p>
            </div>

            <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="text-slate-400">Part épargnée</span>
              <span className="font-bold text-emerald-400 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                {displayRevenus > 0 ? ((kpis.epargne / displayRevenus) * 100).toFixed(1) : 0} %
              </span>
            </div>
          </div>
        </div>

        {/* DÉPENSES RÉELLES */}
        <div className="rounded-3xl bg-white/[0.04] backdrop-blur-2xl border border-white/10 p-6 shadow-[0_16px_36px_rgba(0,0,0,0.35)] hover:border-rose-500/30 transition-all duration-300 group">
          <div className="flex items-center justify-between pb-3">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Sorties d'argent
              </span>
              <h3 className="text-base font-extrabold text-white mt-0.5">Dépenses réelles</h3>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-rose-500/15 border border-rose-500/25 text-rose-400 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
              <TrendingDown size={22} className="stroke-[2.2]" />
            </div>
          </div>

          <div className="space-y-4 mt-2">
            <div>
              {loading ? (
                <Skeleton className="h-10 w-40 mb-2" />
              ) : (
                <div className="text-3xl font-black tracking-tight text-white drop-shadow-[0_2px_12px_rgba(244,63,94,0.2)]">
                  -{formatCurrency(displayDepenses, { showSign: false })}
                </div>
              )}
              <p className="text-xs text-slate-400 mt-1">
                Charges fixes, consommation & imprévus
              </p>
            </div>

            <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="text-slate-400">Abonnements récurrents</span>
              <span className="font-bold text-indigo-300 px-2 py-0.5 rounded-lg bg-indigo-500/15 border border-indigo-500/25">
                {displayAbonnements}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* SUB-METRICS TILES (Liquid Glass Bento Capsules) */}
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

      {/* DEDICATED MODULES: Mouvements Inter-Comptes & Échanges Famille/Amis */}
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

      {/* SECTION: VENTILATION DÉTAILLÉE PAR CATÉGORIE & NATURE */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Tag size={18} className="text-cyan-400" />
              <h2 className="text-lg font-bold text-white">
                Ventilation par Catégorie & Nature (Fixe vs Variable)
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Sélectionnez une catégorie pour ouvrir son tiroir d'audit et réconcilier chaque opération
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs bg-white/[0.04] border border-white/10 rounded-2xl px-3.5 py-1.5 backdrop-blur-xl">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
              <span className="text-slate-400">Fixes :</span>
              <strong className="text-white">{formatCurrency(categoryStats.totalFixed, { showSign: false })}</strong>
            </span>
            <span className="text-white/20">|</span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
              <span className="text-slate-400">Variables :</span>
              <strong className="text-white">{formatCurrency(categoryStats.totalVariable, { showSign: false })}</strong>
            </span>
          </div>
        </div>

        {/* Categories Interactive Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {categoryStats.categories.length === 0 ? (
            <div className="col-span-full py-8 text-center text-slate-400 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl">
              <Info className="w-7 h-7 mx-auto mb-1.5 opacity-40 text-cyan-400" />
              <p className="text-xs">Aucune dépense de consommation enregistrée sur cette période.</p>
            </div>
          ) : (
            categoryStats.categories.map((catItem) => (
              <div
                key={catItem.category}
                onClick={() => handleOpenCategoryAuditItem(catItem)}
                className="rounded-3xl bg-white/[0.03] backdrop-blur-xl p-4 border border-white/10 hover:border-cyan-500/40 hover:bg-white/[0.06] transition-all cursor-pointer group flex flex-col justify-between shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div 
                        className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 text-white font-black text-xs shadow-md border border-white/20"
                        style={{ backgroundColor: catItem.color }}
                      >
                        {catItem.category.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-bold text-white truncate" title={catItem.category}>
                          {catItem.category}
                        </h4>
                        <span className="text-[10px] text-slate-400">
                          {catItem.txCount} opé. ({catItem.percentage.toFixed(1)}%)
                        </span>
                      </div>
                    </div>

                    <span className={cn(
                      "text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 border uppercase",
                      catItem.defaultNature === 'fixe'
                        ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
                        : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                    )}>
                      {catItem.defaultNature}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-baseline justify-between">
                    <span className="text-xs text-slate-400">Total débité</span>
                    <span className="text-sm sm:text-base font-black text-white">
                      {formatCurrency(catItem.totalAmount, { showSign: false })}
                    </span>
                  </div>

                  {/* Fixe vs Variable Progress mini bar */}
                  <div className="mt-2 w-full h-1.5 rounded-full bg-white/[0.08] overflow-hidden flex">
                    <div 
                      className="h-full bg-cyan-400 transition-all shadow-[0_0_8px_rgba(56,189,248,0.8)]" 
                      style={{ width: `${catItem.totalAmount > 0 ? (catItem.fixedAmount / catItem.totalAmount) * 100 : 0}%` }}
                      title={`Fixe: ${catItem.fixedAmount.toFixed(2)} €`}
                    />
                    <div 
                      className="h-full bg-amber-400 transition-all" 
                      style={{ width: `${catItem.totalAmount > 0 ? (catItem.variableAmount / catItem.totalAmount) * 100 : 0}%` }}
                      title={`Variable: ${catItem.variableAmount.toFixed(2)} €`}
                    />
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1 text-cyan-300">
                    Fixe: <strong>{formatCurrency(catItem.fixedAmount, { showSign: false })}</strong>
                  </span>
                  <span className="flex items-center gap-1 text-amber-300">
                    Var: <strong>{formatCurrency(catItem.variableAmount, { showSign: false })}</strong>
                  </span>
                  <span className="text-cyan-400 font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                    <Eye size={12} /> Voir
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* CHARTS GRID (Apple VisionOS Liquid Area & Donut) */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        
        {/* Evolution Chart */}
        <div className="col-span-4 rounded-3xl bg-white/[0.04] backdrop-blur-2xl p-6 border border-white/10 shadow-[0_16px_36px_rgba(0,0,0,0.4)]">
          <div className="flex flex-row items-center justify-between pb-4 border-b border-white/10">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Dynamique temporelle</span>
              <h3 className="text-base font-extrabold text-white mt-0.5">
                Évolution {selectedMonth === 'all' ? 'Globale' : 'du mois'}
              </h3>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" /> Revenus
              </span>
              <span className="flex items-center gap-1.5 text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]" /> Dépenses
              </span>
            </div>
          </div>
          
          <div className="pt-4">
            {loading ? (
              <div className="h-[280px] w-full flex items-end gap-2 px-2 pb-4">
                {[40, 65, 45, 80, 55, 75].map((h, i) => (
                  <Skeleton key={i} className="w-full" style={{ height: `${h}%` }} />
                ))}
              </div>
            ) : displayChartData.length === 0 ? (
              <div className="h-[280px] w-full flex items-center justify-center text-slate-400 flex-col">
                <Info className="w-8 h-8 mb-2 opacity-30 text-cyan-400" />
                <p className="text-xs">Données insuffisantes pour tracer le graphique.</p>
              </div>
            ) : (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={displayChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenusStitch" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.45}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorDepensesStitch" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.45}/>
                        <stop offset="95%" stopColor="#F43F5E" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value: number) => `${value} €`} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#070a14', 
                        borderRadius: '1.25rem', 
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
                        color: '#f8fafc',
                        fontSize: '12px',
                        backdropFilter: 'blur(20px)'
                      }}
                      formatter={(val: any) => [`${Number(val).toFixed(2)} €`, '']}
                    />
                    <Area type="monotone" dataKey="revenus" stroke="#10B981" strokeWidth={2.8} fillOpacity={1} fill="url(#colorRevenusStitch)" />
                    <Area type="monotone" dataKey="depenses" stroke="#F43F5E" strokeWidth={2.8} fillOpacity={1} fill="url(#colorDepensesStitch)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Category Breakdown Donut */}
        <div className="col-span-3 rounded-3xl bg-white/[0.04] backdrop-blur-2xl p-6 border border-white/10 shadow-[0_16px_36px_rgba(0,0,0,0.4)]">
          <div className="pb-4 border-b border-white/10">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Ventilation</span>
            <h3 className="text-base font-extrabold text-white mt-0.5">Top Catégories de Dépenses</h3>
          </div>
          
          <div className="h-[280px] pt-2">
            {loading ? (
               <Skeleton className="w-48 h-48 rounded-full mx-auto" />
            ) : (!isDemo && pieData.length > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={pieData} 
                    cx="50%" 
                    cy="45%" 
                    innerRadius={55} 
                    outerRadius={85} 
                    paddingAngle={4} 
                    dataKey="value" 
                    nameKey="name"
                    className="cursor-pointer outline-none"
                    onClick={(entry: any) => {
                      if (entry && entry.name) {
                        handleOpenCategoryAuditByName(entry.name);
                      }
                    }}
                  >
                    {pieData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#070a14',
                      borderRadius: '1.25rem',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
                      fontSize: '12px',
                      color: '#f8fafc'
                    }}
                    formatter={(value: any, name: any, props: any) => [
                      `${Number(value).toFixed(2)} € (${(props?.payload?.percentage || 0).toFixed(1)}%)`,
                      name
                    ]} 
                  />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full text-center text-slate-400 flex flex-col items-center justify-center">
                <Info className="w-8 h-8 mb-2 opacity-30 text-cyan-400" />
                <p className="text-xs">Aucune dépense catégorisée ce mois-ci.</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* RECENT TRANSACTIONS & QUICK ACTIONS */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        
        {/* Transactions list (Apple Wallet style) */}
        <div className="col-span-4 rounded-3xl bg-white/[0.04] backdrop-blur-2xl p-6 border border-white/10 shadow-[0_16px_36px_rgba(0,0,0,0.4)]">
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
                    <div key={i} className="py-3.5 flex items-center justify-between group hover:bg-white/[0.05] px-2.5 rounded-2xl transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
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

        {/* Quick Launch & AI Insights */}
        <div className="col-span-3 space-y-4">
          
          {/* AI Intelligence Card (Apple Intelligence Studio Feel) */}
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

          {/* Direct Modules Navigation (Liquid Glass list) */}
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
