import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Play, 
  Info, 
  BellRing, 
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
  ArrowDownRight
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { calculateKpis, filterByMonth, formatMonthLabel, buildSankeyData, buildCategoryBreakdown } from '../../lib/kpiUtils';
import { formatDateFR, formatCurrency } from '../../lib/bankUtils';
import { useTransactions } from '../../context/TransactionsContext';

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
    return isDemo ? [] : filterByMonth(transactions, selectedMonth);
  }, [transactions, selectedMonth, isDemo]);


  const kpis = useMemo(() => calculateKpis(filteredTransactions), [filteredTransactions]);
  const pieData = useMemo(() => buildCategoryBreakdown(filteredTransactions).slice(0, 5), [filteredTransactions]);
  const sankeyData = useMemo(() => buildSankeyData(kpis, pieData), [kpis, pieData]);

  // Luxury high-tech color accents (Cyan, Emerald, Amber, Violet, Rose)
  const COLORS = ['#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#F43F5E'];

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

  const demoTx = [
    { cleanLabel: 'Carrefour Market', category: 'Alimentation', amount: -85.20, date: '2026-06-15' },
    { cleanLabel: 'Virement Salaire', category: 'Revenus', amount: 3200.00, date: '2026-06-01' },
    { cleanLabel: 'Netflix & Spotify', category: 'Abonnements', amount: -27.98, date: '2026-06-12' },
    { cleanLabel: 'Virement Épargne Sécurité', category: 'Épargne', amount: -500.00, date: '2026-06-11' },
    { cleanLabel: 'Total Énergies', category: 'Logement', amount: -94.50, date: '2026-06-05' },
  ];

  const isEmpty = !loading && !isDemo && filteredTransactions.length === 0 && !error;
  
  const displayRevenus = isDemo ? demoData.reduce((acc, d) => acc + d.revenus, 0) / demoData.length : kpis.revenus;
  const displayDepenses = isDemo ? demoData.reduce((acc, d) => acc + d.depenses, 0) / demoData.length : kpis.depenses;
  const displayReste = isDemo ? (displayRevenus - displayDepenses) : kpis.resteAVivre;
  const displayBudgetJour = isDemo ? (displayReste / 30) : kpis.budgetJournalier;
  const displayAbonnements = isDemo ? '3' : kpis.abonnements > 0 ? (kpis.abonnements).toFixed(2) + ' €' : '0';

  const displayChartData = isDemo ? demoData : sortedChartData;
  const displayTransactions = isDemo ? demoTx : filteredTransactions.slice(0, 5);

  const Skeleton = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <div className={cn("animate-pulse bg-muted/60 dark:bg-white/[0.06] rounded-xl", className)} style={style} />
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-28 md:pb-12">
      
      {/* Top Header Controls (Period selector & Demo badge) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Tableau de bord financier
            </span>
            {isDemo && (
              <span className="badge-amber text-[10px] font-bold px-2 py-0.5 rounded-full">
                Mode Démo
              </span>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-1 text-foreground">
            Aperçu de votre trésorerie
          </h1>
        </div>

        <div className="flex items-center gap-2.5 self-stretch sm:self-auto">
          {!isDemo && availableMonths.length > 0 && (
            <div className="flex items-center gap-2 bg-card/80 dark:bg-[#10141e]/80 border border-border/80 dark:border-white/[0.08] rounded-xl px-3 py-2 shadow-sm">
              <Filter className="w-4 h-4 text-primary" />
              <select 
                className="bg-transparent text-xs md:text-sm font-semibold outline-none text-foreground cursor-pointer"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                <option value="all">Tous les mois</option>
                {availableMonths.map(m => (
                  <option key={m} value={m} className="dark:bg-[#10141e]">{formatMonthLabel(m)}</option>
                ))}
              </select>
            </div>
          )}

          {isEmpty && (
            <Button variant="glass" size="sm" onClick={() => setIsDemo(true)}>
              <Play className="w-3.5 h-3.5 mr-1.5 text-primary fill-primary/20" /> Mode Démo
            </Button>
          )}

          {isDemo && (
            <Button variant="outline" size="sm" onClick={() => setIsDemo(false)}>
              Quitter la démo
            </Button>
          )}
        </div>
      </div>

      {/* Error notification */}
      {error && (
        <div className="glass border-destructive/30 bg-destructive/10 rounded-2xl p-4 flex items-start gap-3 animate-in fade-in">
          <Info className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="w-full">
            <h3 className="text-sm font-semibold text-destructive">Information</h3>
            <p className="text-xs text-destructive/80 mt-0.5">{error}</p>
            <Button size="sm" variant="outline" className="mt-2.5 h-8 text-xs" onClick={() => window.location.reload()}>
              Actualiser
            </Button>
          </div>
        </div>
      )}

      {/* Empty State Banner */}
      {isEmpty && !error && (
        <div className="glass-card rounded-3xl p-6 md:p-8 border-primary/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          <div className="relative z-10 max-w-2xl space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 text-primary flex items-center justify-center shadow-sm">
              <Sparkles size={24} />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Bienvenue sur votre cockpit financier CashPilot
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Importez votre premier relevé bancaire (CSV ou PDF) pour débloquer automatiquement tous vos KPIs, vos flux de trésorerie et vos analyses comparatives.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button onClick={() => navigate('/releves')} className="shadow-md">
                <FileText className="w-4 h-4 mr-2" /> Importer un relevé
              </Button>
              <Button variant="outline" onClick={() => navigate('/tickets')}>
                <Receipt className="w-4 h-4 mr-2" /> Scanner un ticket
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* HERO FINANCIAL METRICS (Finary Wealth & HarmonyOS Widget Feel) */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-3">
        
        {/* HERO CARD : Reste à vivre */}
        <Card className="md:col-span-1 glass-card border-primary/40 dark:border-primary/30 relative overflow-hidden bg-gradient-to-br from-card to-primary/[0.04] dark:from-[#10141e] dark:to-primary/[0.08]">
          <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/10 dark:bg-cyan-500/15 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Capacité nette
              </span>
              <CardTitle className="text-lg font-bold mt-0.5">Reste à vivre</CardTitle>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-primary/15 text-primary flex items-center justify-center border border-primary/20">
              <Wallet size={20} className="stroke-[2.5]" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              {loading ? (
                <Skeleton className="h-10 w-36 mb-1" />
              ) : (
                <div className="text-3xl md:text-4xl font-black tracking-tight text-foreground">
                  {formatCurrency(displayReste, { showSign: false })}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-500" />
                Revenus encaissés déduits des dépenses
              </p>
            </div>

            <div className="pt-3 border-t border-border/60 dark:border-white/[0.06] flex items-center justify-between">
              <div>
                <span className="text-[11px] text-muted-foreground block">Rythme quotidien</span>
                <span className="text-sm font-bold text-foreground">
                  {loading ? '...' : `${formatCurrency(displayBudgetJour, { showSign: false })} / jour`}
                </span>
              </div>
              <span className={cn(
                "text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1",
                displayReste >= 0 ? "badge-jade" : "badge-rose"
              )}>
                {displayReste >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {displayReste >= 0 ? 'Positif' : 'Déficit'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* REVENUS DU MOIS */}
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Entrées financières
              </span>
              <CardTitle className="text-base font-bold mt-0.5">Revenus du mois</CardTitle>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
              <TrendingUp size={20} className="stroke-[2.5]" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              {loading ? (
                <Skeleton className="h-10 w-36 mb-1" />
              ) : (
                <div className="text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">
                  +{formatCurrency(displayRevenus, { showSign: false })}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Salaires & encaissements réels
              </p>
            </div>

            <div className="pt-3 border-t border-border/60 dark:border-white/[0.06] flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Part épargnée</span>
              <span className="font-semibold text-emerald-500">
                {displayRevenus > 0 ? ((kpis.epargne / displayRevenus) * 100).toFixed(1) : 0} %
              </span>
            </div>
          </CardContent>
        </Card>

        {/* DÉPENSES RÉELLES */}
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Sorties d'argent
              </span>
              <CardTitle className="text-base font-bold mt-0.5">Dépenses réelles</CardTitle>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-rose-500/15 text-rose-500 flex items-center justify-center border border-rose-500/20">
              <TrendingDown size={20} className="stroke-[2.5]" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              {loading ? (
                <Skeleton className="h-10 w-36 mb-1" />
              ) : (
                <div className="text-3xl font-extrabold tracking-tight text-foreground">
                  -{formatCurrency(displayDepenses, { showSign: false })}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Fixes, variables et imprévus
              </p>
            </div>

            <div className="pt-3 border-t border-border/60 dark:border-white/[0.06] flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Abonnements récurrents</span>
              <span className="font-semibold text-foreground">{displayAbonnements}</span>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* SUB-METRICS TILES (Xiaomi/Huawei widget pills) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        
        <div className="glass-card rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Charges Fixes</span>
            <Layers size={16} className="text-primary" />
          </div>
          <div className="mt-2">
            {loading ? <Skeleton className="h-6 w-20" /> : (
              <span className="text-lg font-bold text-foreground">
                {formatCurrency(isDemo ? 650 : kpis.fixe, { showSign: false })}
              </span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">Loyer, factures & régies</span>
        </div>

        <div className="glass-card rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Dép. Variables</span>
            <CreditCard size={16} className="text-cyan-500" />
          </div>
          <div className="mt-2">
            {loading ? <Skeleton className="h-6 w-20" /> : (
              <span className="text-lg font-bold text-foreground">
                {formatCurrency(isDemo ? 420 : kpis.variable, { showSign: false })}
              </span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">Alimentation, vie courante</span>
        </div>

        <div className="glass-card rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Épargne Mise de Côté</span>
            <Sparkles size={16} className="text-emerald-500" />
          </div>
          <div className="mt-2">
            {loading ? <Skeleton className="h-6 w-20" /> : (
              <span className="text-lg font-bold text-emerald-500">
                {formatCurrency(isDemo ? 500 : kpis.epargne, { showSign: false })}
              </span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">Patrimoine protégé</span>
        </div>

        <div className="glass-card rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Frais Bancaires</span>
            <BellRing size={16} className="text-rose-500" />
          </div>
          <div className="mt-2">
            {loading ? <Skeleton className="h-6 w-20" /> : (
              <span className="text-lg font-bold text-rose-500">
                {formatCurrency(isDemo ? 12.50 : kpis.frais, { showSign: false })}
              </span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">Commissions & frais</span>
        </div>

      </div>

      {/* CHARTS GRID (High-End Flow & Evolution) */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        
        {/* Evolution Chart */}
        <Card className="col-span-4 glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dynamique</span>
              <CardTitle className="text-base font-bold mt-0.5">
                Évolution {selectedMonth === 'all' ? 'Globale' : 'du mois'}
              </CardTitle>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-emerald-500">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Revenus
              </span>
              <span className="flex items-center gap-1.5 text-rose-500">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> Dépenses
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {loading ? (
              <div className="h-[280px] w-full flex items-end gap-2 px-2 pb-4">
                {[40, 65, 45, 80, 55, 75].map((h, i) => (
                  <Skeleton key={i} className="w-full" style={{ height: `${h}%` }} />
                ))}
              </div>
            ) : displayChartData.length === 0 ? (
              <div className="h-[280px] w-full flex items-center justify-center text-muted-foreground flex-col">
                <Info className="w-8 h-8 mb-2 opacity-25" />
                <p className="text-xs">Données insuffisantes pour tracer le graphique.</p>
              </div>
            ) : (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={displayChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenus" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.35}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorDepenses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.35}/>
                        <stop offset="95%" stopColor="#F43F5E" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.6} />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value: number) => `${value} €`} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        borderRadius: '1rem', 
                        border: '1px solid hsl(var(--border))',
                        boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.2)',
                        color: 'hsl(var(--foreground))',
                        fontSize: '12px'
                      }}
                      formatter={(val: any) => [`${Number(val).toFixed(2)} €`, '']}
                    />
                    <Area type="monotone" dataKey="revenus" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenus)" />
                    <Area type="monotone" dataKey="depenses" stroke="#F43F5E" strokeWidth={2.5} fillOpacity={1} fill="url(#colorDepenses)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sankey / Category Breakdown */}
        <Card className="col-span-3 glass-card">
          <CardHeader>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ventilation</span>
            <CardTitle className="text-base font-bold mt-0.5">Top Catégories de Dépenses</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
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
                  >
                    {pieData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      borderRadius: '0.875rem',
                      border: '1px solid hsl(var(--border))',
                      fontSize: '12px'
                    }}
                    formatter={(value: any, name: any, props: any) => [
                      `${Number(value).toFixed(2)} € (${(props?.payload?.percentage || 0).toFixed(1)}%)`,
                      name
                    ]} 
                  />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full text-center text-muted-foreground flex flex-col items-center justify-center">
                <Info className="w-8 h-8 mb-2 opacity-25" />
                <p className="text-xs">Aucune dépense catégorisée ce mois-ci.</p>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* RECENT TRANSACTIONS & QUICK ACTIONS */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        
        {/* Transactions list (Apple Wallet style) */}
        <Card className="col-span-4 glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Flux récents</span>
              <CardTitle className="text-base font-bold mt-0.5">Dernières opérations</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/releves')} className="text-xs text-primary">
              Voir tout <ArrowRight size={14} className="ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-9 h-9 rounded-xl" />
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
              <div className="py-12 text-center text-muted-foreground flex flex-col items-center">
                <Info className="w-8 h-8 mb-2 opacity-25" />
                <p className="text-xs">Aucune transaction enregistrée.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50 dark:divide-white/[0.04]">
                {displayTransactions.map((tx: any, i: number) => {
                  const isPositive = (tx.amount || 0) > 0;
                  const isEpargne = tx.category === 'Épargne' || tx.category === 'Virements internes';
                  return (
                    <div key={i} className="py-3 flex items-center justify-between group hover:bg-secondary/40 dark:hover:bg-white/[0.02] px-2 rounded-xl transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105",
                          isPositive ? "badge-jade" : isEpargne ? "badge-cyan" : "bg-secondary/80 border-border text-muted-foreground"
                        )}>
                          {isPositive ? <ArrowUpRight size={16} /> : isEpargne ? <Sparkles size={16} /> : <CreditCard size={16} />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-xs md:text-sm text-foreground truncate" title={tx.description || tx.cleanLabel || tx.rawLabel}>
                            {tx.description || tx.cleanLabel || tx.rawLabel}
                          </p>
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <span className="font-medium">{tx.category || 'Autres'}</span>
                            <span>•</span>
                            <span>{formatDateFR(tx.date)}</span>
                          </p>
                        </div>
                      </div>
                      
                      <div className={cn(
                        "font-extrabold text-xs md:text-sm shrink-0 ml-3",
                        isPositive ? "text-emerald-500" : "text-foreground"
                      )}>
                        {formatCurrency(tx.amount || 0, { showSign: true })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Launch & AI Insights */}
        <div className="col-span-3 space-y-4">
          
          {/* AI Intelligence Card */}
          <Card className="glass-card bg-gradient-to-br from-primary/[0.05] to-cyan-500/[0.05] border-primary/25">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                <Lightbulb size={16} />
                <span>Coach IA & Analyse</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Le modèle analyse vos ratios fixes/variables pour détecter vos opportunités d'économies sur les abonnements et courses alimentaires.
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-xs font-semibold justify-between bg-card/60"
                onClick={() => navigate('/coach')}
              >
                <span>Consulter le diagnostic complet</span>
                <ArrowRight size={14} />
              </Button>
            </CardContent>
          </Card>

          {/* Direct Modules Navigation */}
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Modules CashPilot
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <button 
                onClick={() => navigate('/releves')}
                className="w-full p-2.5 rounded-xl flex items-center justify-between text-left text-xs font-semibold hover:bg-secondary/70 dark:hover:bg-white/[0.04] transition-all group"
              >
                <span className="flex items-center gap-2.5">
                  <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                    <FileText size={14} />
                  </span>
                  <span>Relevés Bancaires</span>
                </span>
                <ArrowRight size={14} className="text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button 
                onClick={() => navigate('/tickets')}
                className="w-full p-2.5 rounded-xl flex items-center justify-between text-left text-xs font-semibold hover:bg-secondary/70 dark:hover:bg-white/[0.04] transition-all group"
              >
                <span className="flex items-center gap-2.5">
                  <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-500">
                    <Receipt size={14} />
                  </span>
                  <span>Tickets & Alimentation</span>
                </span>
                <ArrowRight size={14} className="text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button 
                onClick={() => navigate('/parametres')}
                className="w-full p-2.5 rounded-xl flex items-center justify-between text-left text-xs font-semibold hover:bg-secondary/70 dark:hover:bg-white/[0.04] transition-all group"
              >
                <span className="flex items-center gap-2.5">
                  <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                    <ShieldCheck size={14} />
                  </span>
                  <span>Paramètres & Chiffrement</span>
                </span>
                <ArrowRight size={14} className="text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </button>
            </CardContent>
          </Card>

        </div>

      </div>

    </div>
  );
}
