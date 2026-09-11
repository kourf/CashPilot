import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Sankey, Legend } from 'recharts';
import { Wallet, Activity, CreditCard, Play, Info, Calendar, BellRing, Sparkles, FileText, Receipt, Lightbulb, ArrowRight, Filter } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { db } from '../../lib/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { calculateKpis, filterByMonth, getAvailableMonths, formatMonthLabel, buildSankeyData, buildCategoryBreakdown, type Transaction } from '../../lib/kpiUtils';

export default function Dashboard() {
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  useEffect(() => {
    let unsubscribe: () => void;
    
    // Timeout de sécurité au cas où Firebase ne répond pas
    const timeoutId = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setError("Le chargement prend plus de temps que prévu.");
      }
    }, 10000);

    if (isDemo) {
      clearTimeout(timeoutId);
      setLoading(false);
      return;
    }

    try {
      const deviceId = localStorage.getItem('deviceId') || 'default-user';
      const q = query(
        collection(db, `users/${deviceId}/transactions`),
        orderBy('date', 'desc')
      );

      unsubscribe = onSnapshot(q, (snapshot) => {
        const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTransactions(txs);
        setLoading(false);
        clearTimeout(timeoutId);
      }, (err) => {
        console.error("Erreur de chargement des transactions:", err);
        setError("Impossible de charger vos données. Vérifiez votre connexion.");
        setLoading(false);
        clearTimeout(timeoutId);
      });
    } catch (err) {
      console.error(err);
      setError("Une erreur inattendue est survenue.");
      setLoading(false);
      clearTimeout(timeoutId);
    }

    return () => {
      clearTimeout(timeoutId);
      if (unsubscribe) unsubscribe();
    };
  }, [isDemo]);

  const availableMonths = useMemo(() => getAvailableMonths(transactions), [transactions]);
  
  useEffect(() => {
    if (availableMonths.length > 0 && selectedMonth === 'all' && !isDemo) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth, isDemo]);

  const filteredTransactions = useMemo(() => {
    return isDemo ? [] : filterByMonth(transactions, selectedMonth);
  }, [transactions, selectedMonth, isDemo]);

  const kpis = useMemo(() => calculateKpis(filteredTransactions), [filteredTransactions]);
  const pieData = useMemo(() => buildCategoryBreakdown(filteredTransactions).slice(0, 5), [filteredTransactions]);
  const sankeyData = useMemo(() => buildSankeyData(kpis, pieData), [kpis, pieData]);
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  const economiesPossibles = kpis.abonnements * 0.15; 
  const documentsImportes = filteredTransactions.length > 0 ? 1 : 0; 
  const ticketsAnalyses = 0; 
  
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
    { cleanLabel: 'Carrefour', category: 'Alimentation', amount: -85.20, date: '2026-06-15', isExpense: true },
    { cleanLabel: 'Salaire', category: 'Revenus', amount: 3200.00, date: '2026-06-01', isExpense: false },
    { cleanLabel: 'Netflix', category: 'Abonnements', amount: -15.99, date: '2026-06-12', isExpense: true },
    { cleanLabel: 'Virement Épargne', category: 'Épargne', amount: -500.00, date: '2026-06-11', isExpense: true, isNeutral: true },
  ];

  const isEmpty = !loading && !isDemo && filteredTransactions.length === 0 && !error;
  
  const displayRevenus = isDemo ? demoData.reduce((acc, d) => acc + d.revenus, 0) / demoData.length : kpis.revenus;
  const displayDepenses = isDemo ? demoData.reduce((acc, d) => acc + d.depenses, 0) / demoData.length : kpis.depenses;
  const displayReste = isDemo ? (displayRevenus - displayDepenses) : kpis.resteAVivre;
  const displayBudgetJour = isDemo ? (displayReste / 30) : kpis.budgetJournalier;
  const displayAbonnements = isDemo ? '3' : kpis.abonnements > 0 ? (kpis.abonnements).toFixed(2) + ' €' : '0';
  const displayEconomies = isDemo ? 45.50 : economiesPossibles;
  const displayDocs = isDemo ? 2 : documentsImportes;
  const displayTickets = isDemo ? 12 : ticketsAnalyses;
  const displayChartData = isDemo ? demoData : sortedChartData;
  const displayTransactions = isDemo ? demoTx : filteredTransactions.slice(0, 5);

  const Skeleton = ({ className }: { className?: string }) => (
    <div className={cn("animate-pulse bg-muted rounded-md", className)} />
  );

  return (
    <div className="p-6 md:p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center">
            Vue Globale 
            {isDemo && <span className="text-amber-500 text-xs ml-3 bg-amber-500/10 px-2 py-1 rounded-full border border-amber-500/20">Mode Démonstration</span>}
          </h1>
          <p className="text-muted-foreground mt-1">Gérez et analysez vos finances personnelles.</p>
        </div>
        <div className="flex gap-2">
            {!isDemo && availableMonths.length > 0 && (
              <div className="flex items-center gap-2 bg-background border rounded-md px-3 py-1.5 shadow-sm mr-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <select 
                  className="bg-transparent text-sm font-medium outline-none text-foreground cursor-pointer"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                >
                  <option value="all">Tous les mois</option>
                  {availableMonths.map(m => (
                    <option key={m} value={m}>{formatMonthLabel(m)}</option>
                  ))}
                </select>
              </div>
            )}
          {isEmpty && (
            <Button variant="outline" size="sm" onClick={() => setIsDemo(true)}>
              <Play className="w-4 h-4 mr-2" /> Voir la démo
            </Button>
          )}
          {isDemo && <Button variant="default" size="sm" onClick={() => setIsDemo(false)}>Quitter la démo</Button>}
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-start gap-4">
          <Info className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
          <div className="w-full">
            <h3 className="font-semibold text-destructive">Erreur</h3>
            <p className="text-sm text-destructive/80 mt-1">{error}</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => window.location.reload()}>Réessayer</Button>
          </div>
        </div>
      )}

      {isEmpty && !error && (
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-start gap-4">
          <Info className="w-6 h-6 text-primary shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-primary">Aucune donnée réelle disponible</h3>
            <p className="text-sm text-primary/80 mt-1">
              Consultez vos onglets dédiés pour importer vos relevés bancaires ou tickets de caisse. Les données s'afficheront ici automatiquement.
            </p>
            <div className="flex gap-3 mt-3">
              <Button size="sm" onClick={() => window.location.href = '/statements'}>Aller aux Relevés</Button>
              <Button size="sm" variant="outline" onClick={() => window.location.href = '/receipts'}>Aller aux Tickets</Button>
            </div>
          </div>
        </div>
      )}

      {/* 8 KPIs Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass border-primary/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Reste à vivre</CardTitle>
            <Wallet className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-24 mb-1" /> : <div className="text-2xl font-bold">{displayReste.toFixed(2)} €</div>}
            <p className="text-xs text-muted-foreground mt-1">Revenus encaissés - Dépenses</p>
          </CardContent>
        </Card>
        
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Revenus</CardTitle>
            <Activity className="w-4 h-4 text-success" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-24 mb-1" /> : <div className="text-2xl font-bold">{displayRevenus.toFixed(2)} €</div>}
            <p className="text-xs text-muted-foreground mt-1">Hors virements internes</p>
          </CardContent>
        </Card>
        
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Dépenses réelles</CardTitle>
            <CreditCard className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-24 mb-1" /> : <div className="text-2xl font-bold">{displayDepenses.toFixed(2)} €</div>}
            <p className="text-xs text-muted-foreground mt-1">Hors épargne</p>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Budget journalier</CardTitle>
            <Calendar className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-24 mb-1" /> : <div className="text-2xl font-bold">{displayBudgetJour.toFixed(2)} € <span className="text-sm font-normal text-muted-foreground">/ jour</span></div>}
            <p className="text-xs text-muted-foreground mt-1">Basé sur le reste à vivre</p>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Abonnements</CardTitle>
            <BellRing className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-12 mb-1" /> : <div className="text-2xl font-bold">{displayAbonnements}</div>}
            <p className="text-xs text-muted-foreground mt-1">Dépenses récurrentes</p>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Épargne</CardTitle>
            <Sparkles className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-24 mb-1" /> : <div className="text-2xl font-bold text-primary">{isDemo ? '500.00' : kpis.epargne.toFixed(2)} €</div>}
            <p className="text-xs text-muted-foreground mt-1">Mis de côté</p>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Top Dépense</CardTitle>
            <FileText className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-12 mb-1" /> : <div className="text-2xl font-bold">{isDemo ? '85.20 €' : kpis.topDepense.toFixed(2) + ' €'}</div>}
            <p className="text-xs text-muted-foreground mt-1">Ce mois-ci</p>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Top Catégorie</CardTitle>
            <Receipt className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-12 mb-1" /> : <div className="text-2xl font-bold capitalize truncate">{isDemo ? 'Alimentation' : kpis.topCategory}</div>}
            <p className="text-xs text-muted-foreground mt-1">La plus coûteuse</p>
          </CardContent>
        </Card>
      </div>

      {/* Breakdowns and Charts */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <div className="bg-card border rounded-lg p-4 text-center glass"><span className="block text-muted-foreground mb-1 text-sm">Dépenses Fixes</span>{loading ? <Skeleton className="h-6 w-16 mx-auto" /> : <span className="font-semibold text-lg">{isDemo ? '650.00' : kpis.fixe.toFixed(2)}€</span>}</div>
        <div className="bg-card border rounded-lg p-4 text-center glass"><span className="block text-muted-foreground mb-1 text-sm">Dép. Variables</span>{loading ? <Skeleton className="h-6 w-16 mx-auto" /> : <span className="font-semibold text-lg">{isDemo ? '420.00' : kpis.variable.toFixed(2)}€</span>}</div>
        <div className="bg-card border rounded-lg p-4 text-center glass"><span className="block text-muted-foreground mb-1 text-sm">Exceptionnelles</span>{loading ? <Skeleton className="h-6 w-16 mx-auto" /> : <span className="font-semibold text-lg">{isDemo ? '150.00' : kpis.exceptionnelle.toFixed(2)}€</span>}</div>
        <div className="bg-card border rounded-lg p-4 text-center glass"><span className="block text-muted-foreground mb-1 text-sm">Frais Bancaires</span>{loading ? <Skeleton className="h-6 w-16 mx-auto" /> : <span className="font-semibold text-lg text-destructive">{isDemo ? '12.50' : kpis.frais.toFixed(2)}€</span>}</div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 glass">
          <CardHeader>
            <CardTitle>Flux des Finances (Sankey)</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] pl-2">
            {loading ? (
              <div className="h-full w-full flex items-center justify-center">
                <Skeleton className="w-full h-full rounded-lg" />
              </div>
            ) : (!isDemo && sankeyData.links.length > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <Sankey data={sankeyData} nodePadding={50} margin={{ left: 20, right: 20, top: 20, bottom: 20 }}
                  link={{ stroke: '#cbd5e1' }} node={{ fill: '#3b82f6' }} />
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-muted-foreground flex-col">
                <Info className="w-8 h-8 mb-2 opacity-20" />
                <p>Données insuffisantes pour le diagramme de flux.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3 glass">
          <CardHeader>
            <CardTitle>Répartition par catégorie</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {loading ? (
               <Skeleton className="w-full h-full rounded-full max-w-[200px] mx-auto" />
            ) : (!isDemo && pieData.length > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" nameKey="name">
                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string, props: any) => [`${value.toFixed(2)} € (${(props?.payload?.percentage || 0).toFixed(1)}%)`, name]} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="py-10 text-center text-muted-foreground flex flex-col items-center">
                <Info className="w-8 h-8 mb-2 opacity-20" />
                <p>Aucune dépense catégorisée ce mois-ci.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 glass">
          <CardHeader>
            <CardTitle>Évolution {selectedMonth === 'all' ? 'Globale' : 'du mois'}</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            {loading ? (
              <div className="h-[300px] w-full flex items-end gap-2 px-4 pb-4">
                {[40, 70, 45, 90, 65, 80].map((h, i) => (
                  <Skeleton key={i} className="w-full rounded-t-sm" style={{ height: `${h}%` }} />
                ))}
              </div>
            ) : displayChartData.length === 0 ? (
              <div className="h-[300px] w-full flex items-center justify-center text-muted-foreground flex-col">
                <Info className="w-8 h-8 mb-2 opacity-20" />
                <p>Données insuffisantes pour tracer le graphique.</p>
              </div>
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={displayChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenus" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--success)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--success)" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorDepenses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--destructive)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--destructive)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value: number) => `€${value}`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '8px', border: '1px solid var(--border)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                      itemStyle={{ color: 'var(--foreground)' }}
                    />
                    <Area type="monotone" dataKey="revenus" stroke="var(--success)" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenus)" />
                    <Area type="monotone" dataKey="depenses" stroke="var(--destructive)" strokeWidth={2} fillOpacity={1} fill="url(#colorDepenses)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="col-span-3 glass">
          <CardHeader>
            <CardTitle>Dernières Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-6">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Skeleton className="w-10 h-10 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : displayTransactions.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground flex flex-col items-center">
                <Info className="w-8 h-8 mb-2 opacity-20" />
                <p>Aucune transaction importée.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {displayTransactions.map((tx: any, i: number) => {
                  const isPositive = (tx.amount || 0) > 0;
                  const isNeutral = tx.category === 'Épargne' || tx.category === 'Virements internes';
                  return (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          isPositive ? "bg-success/10 text-success" : isNeutral ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                        )}>
                          {isPositive ? <Activity size={18} /> : isNeutral ? <Wallet size={18} /> : <CreditCard size={18} />}
                        </div>
                        <div className="max-w-[150px] md:max-w-[200px]">
                          <p className="font-medium text-sm truncate" title={tx.description || tx.cleanLabel || tx.rawLabel}>{tx.description || tx.cleanLabel || tx.rawLabel}</p>
                          <p className="text-xs text-muted-foreground">{tx.category || 'Autres'} • {tx.date}</p>
                        </div>
                      </div>
                      <div className={cn(
                        "font-bold text-sm",
                        isPositive ? "text-success" : isNeutral ? "text-foreground" : "text-foreground"
                      )}>
                        {isPositive ? '+' : ''}{(tx.amount || 0).toFixed(2)} €
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Lightbulb className="w-5 h-5 text-amber-500" /> Alertes IA</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
               <Skeleton className="h-16 w-full rounded-lg" />
            ) : isEmpty ? (
              <p className="text-sm text-muted-foreground italic">Connectez vos données pour recevoir des conseils personnalisés.</p>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm">
                  L'IA analysera bientôt vos habitudes de consommation pour détecter les dépenses anormales.
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Synthèse du mois</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                 <div className="flex justify-between"><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-10" /></div>
                 <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ) : isEmpty ? (
              <p className="text-sm text-muted-foreground italic">Aucune donnée pour générer une synthèse.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Taux d'épargne</span>
                  <span className="font-medium">{displayRevenus > 0 ? ((displayReste / displayRevenus)*100).toFixed(1) : 0}%</span>
                </div>
                <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                  <div className="bg-primary h-full" style={{ width: `${displayRevenus > 0 ? Math.min(100, (displayReste / displayRevenus)*100) : 0}%` }} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle>Accès Rapides</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="ghost" className="w-full justify-between hover:bg-primary/10" onClick={() => window.location.href = '/statements'}>
              <span className="flex items-center gap-2"><FileText className="w-4 h-4" /> Relevés Bancaires</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button variant="ghost" className="w-full justify-between hover:bg-primary/10" onClick={() => window.location.href = '/receipts'}>
              <span className="flex items-center gap-2"><Receipt className="w-4 h-4" /> Tickets de caisse</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button variant="ghost" className="w-full justify-between hover:bg-primary/10" onClick={() => window.location.href = '/coach'}>
              <span className="flex items-center gap-2"><Sparkles className="w-4 h-4" /> Entraîneur IA</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
