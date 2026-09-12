import React, { useEffect, useRef, useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip as RechartsTooltip 
} from 'recharts';
import { Card } from './ui/card';
import { 
  GitFork, 
  PieChart as PieIcon, 
  TrendingDown, 
  RotateCcw
} from 'lucide-react';
import type { BankTransaction } from '../lib/bankUtils';

interface BankFlowChartsProps {
  transactions: BankTransaction[];
  selectedAccountName?: string;
  selectedMonthName?: string;
}

// Sophisticated color palette conforming to UI/UX Pro Max & luxury financial dashboards
const EXPENSE_PALETTE = [
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#8b5cf6', // Violet / Purple
  '#ec4899', // Pink / Rose
  '#f59e0b', // Amber / Orange
  '#10b981', // Emerald
  '#6366f1', // Indigo
  '#14b8a6', // Teal
  '#f43f5e', // Rose red
  '#84cc16', // Lime
  '#a855f7', // Purple
  '#64748b'  // Slate
];

export const BankFlowCharts: React.FC<BankFlowChartsProps> = ({
  transactions,
  selectedAccountName = 'Tous les comptes',
  selectedMonthName
}) => {
  const sankeyContainerRef = useRef<HTMLDivElement>(null);
  const [googleLoaded, setGoogleLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<'both' | 'sankey' | 'pie'>('both');
  const [isDark, setIsDark] = useState(true);

  // Monitor Dark/Light theme changes
  useEffect(() => {
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkDark();
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Compute Aggregated Incomes and Expenses by Category
  const financialData = useMemo(() => {
    let totalIncome = 0;
    let totalExpenses = 0;
    const expenseCategoryMap = new Map<string, number>();
    const incomeSourceMap = new Map<string, number>();

    transactions.forEach(tx => {
      const amt = Math.abs(Number(tx.amount) || 0);
      if (tx.flowType === 'INCOME') {
        totalIncome += amt;
        const source = tx.category || 'Revenus';
        incomeSourceMap.set(source, (incomeSourceMap.get(source) || 0) + amt);
      } else if (tx.flowType === 'FIXED_EXPENSE' || tx.flowType === 'VARIABLE_EXPENSE') {
        totalExpenses += amt;
        const cat = tx.category || 'Autre';
        expenseCategoryMap.set(cat, (expenseCategoryMap.get(cat) || 0) + amt);
      }
    });

    const expenseItems = Array.from(expenseCategoryMap.entries())
      .map(([name, value], index) => ({
        name,
        value,
        percentage: totalExpenses > 0 ? (value / totalExpenses) * 100 : 0,
        color: EXPENSE_PALETTE[index % EXPENSE_PALETTE.length]
      }))
      .sort((a, b) => b.value - a.value);

    return {
      totalIncome,
      totalExpenses,
      netSavings: Math.max(0, totalIncome - totalExpenses),
      expenseItems,
      hasExpenses: totalExpenses > 0,
      hasIncome: totalIncome > 0
    };
  }, [transactions]);

  // Load Google Charts script for Sankey
  useEffect(() => {
    if ((window as any).google?.visualization?.Sankey) {
      setGoogleLoaded(true);
      return;
    }

    const scriptId = 'google-charts-script';
    const existing = document.getElementById(scriptId) as HTMLScriptElement;

    if (!existing) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://www.gstatic.com/charts/loader.js';
      script.async = true;
      script.onload = () => {
        if ((window as any).google) {
          (window as any).google.charts.load('current', { packages: ['sankey'] });
          (window as any).google.charts.setOnLoadCallback(() => {
            setGoogleLoaded(true);
          });
        }
      };
      document.head.appendChild(script);
    } else {
      const interval = setInterval(() => {
        if ((window as any).google?.visualization?.Sankey) {
          clearInterval(interval);
          setGoogleLoaded(true);
        }
      }, 150);
      return () => clearInterval(interval);
    }
  }, []);

  // Draw Google Charts Sankey Diagram
  useEffect(() => {
    if (!googleLoaded || !sankeyContainerRef.current || !financialData.hasExpenses) return;

    try {
      const google = (window as any).google;
      if (!google?.visualization?.Sankey) return;

      const dataTable = new google.visualization.DataTable();
      dataTable.addColumn('string', 'From');
      dataTable.addColumn('string', 'To');
      dataTable.addColumn('number', 'Montant');

      const rows: any[] = [];
      const totalExp = financialData.totalExpenses;
      const totalInc = financialData.totalIncome;

      // Left Node Name
      const incomeNodeLabel = totalInc > 0
        ? `Revenus (${totalInc.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €)`
        : `Dépenses Décaissées (${totalExp.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €)`;

      // Right Branch Nodes for each Expense Category
      financialData.expenseItems.forEach(item => {
        if (item.value > 0.01) {
          const pctStr = item.percentage.toFixed(1);
          const amtStr = item.value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          const targetLabel = `${item.name} (${amtStr} € • ${pctStr}%)`;
          rows.push([incomeNodeLabel, targetLabel, Number(item.value.toFixed(2))]);
        }
      });

      // If Income > Expenses: Add remaining surplus flow to Savings / Reste à Vivre
      if (totalInc > totalExp && financialData.netSavings > 0.01) {
        const savingsAmt = financialData.netSavings;
        const savingsPct = totalInc > 0 ? (savingsAmt / totalInc) * 100 : 0;
        const savingsLabel = `Épargne & Reste à Vivre (${savingsAmt.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € • ${savingsPct.toFixed(1)}%)`;
        rows.push([incomeNodeLabel, savingsLabel, Number(savingsAmt.toFixed(2))]);
      }

      if (rows.length === 0) return;

      dataTable.addRows(rows);

      // Sankey Styling Configuration
      const options = {
        width: '100%',
        height: Math.max(280, rows.length * 42),
        sankey: {
          node: {
            nodePadding: 16,
            width: 14,
            colors: ['#06b6d4', ...EXPENSE_PALETTE, '#10b981'],
            label: {
              fontName: 'Inter, system-ui, sans-serif',
              fontSize: 11,
              color: isDark ? '#f1f5f9' : '#0f172a',
              bold: true
            }
          },
          link: {
            colorMode: 'gradient',
            colors: ['#06b6d4', ...EXPENSE_PALETTE, '#10b981'],
            fillOpacity: isDark ? 0.35 : 0.45
          }
        },
        backgroundColor: 'transparent'
      };

      const chart = new google.visualization.Sankey(sankeyContainerRef.current);
      chart.draw(dataTable, options);

      // Re-draw on window resize
      const handleResize = () => {
        if (sankeyContainerRef.current && chart) {
          chart.draw(dataTable, options);
        }
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);

    } catch (err) {
      console.error("Erreur génération diagramme Sankey:", err);
    }
  }, [googleLoaded, financialData, isDark, activeTab]);

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      
      {/* Header with Title and Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <GitFork className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base md:text-lg font-bold text-foreground flex items-center gap-2">
              Visualisations Financières du Relevé
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Synchronisé
              </span>
            </h2>
            <p className="text-xs text-muted-foreground">
              {selectedAccountName} • {selectedMonthName && selectedMonthName !== 'all' ? selectedMonthName : 'Toutes périodes'}
            </p>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-secondary/50 dark:bg-white/[0.04] p-1 rounded-xl border border-border/60 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('both')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'both' 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Vue Double
          </button>
          <button
            onClick={() => setActiveTab('sankey')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 ${
              activeTab === 'sankey' 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <GitFork className="w-3 h-3" />
            Sankey
          </button>
          <button
            onClick={() => setActiveTab('pie')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 ${
              activeTab === 'pie' 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <PieIcon className="w-3 h-3" />
            Circulaire
          </button>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className={`grid gap-6 ${
        activeTab === 'both' ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'
      }`}>
        
        {/* 1. SANKEY DIAGRAM (Google Charts Interactive Sankey) */}
        {(activeTab === 'both' || activeTab === 'sankey') && (
          <Card className={`glass-card p-5 border border-border/60 rounded-2xl flex flex-col justify-between ${
            activeTab === 'both' ? 'lg:col-span-7' : 'w-full'
          }`}>
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <GitFork className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-foreground">
                    Diagramme Sankey des Flux (Revenus ➔ Postes de Dépenses)
                  </h3>
                </div>
                <span className="text-[11px] font-mono font-semibold text-cyan-400">
                  {financialData.totalExpenses.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2 mb-3">
                À gauche vos revenus totaux, se ramifiant à droite vers chaque catégorie de dépense avec son montant en € et sa part relative (%).
              </p>
            </div>

            {/* Container for Google Sankey or Fallback */}
            <div className="min-h-[280px] w-full flex items-center justify-center relative overflow-x-auto">
              {!financialData.hasExpenses ? (
                <div className="text-center p-8 text-muted-foreground">
                  <TrendingDown className="w-8 h-8 mx-auto opacity-40 mb-2" />
                  <p className="text-xs font-medium">Aucune dépense enregistrée sur cette période pour générer le Sankey.</p>
                </div>
              ) : !googleLoaded ? (
                <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs">Chargement du moteur Google Charts Sankey...</span>
                </div>
              ) : (
                <div 
                  ref={sankeyContainerRef} 
                  className="w-full h-full min-h-[280px]"
                />
              )}
            </div>

            {/* Flow Summary Legend */}
            {financialData.hasExpenses && (
              <div className="pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                  <span className="font-medium text-foreground">Revenus Détectés :</span>
                  <span className="font-mono font-bold text-emerald-400">
                    +{financialData.totalIncome.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                  <span className="font-medium text-foreground">Dépenses Réelles :</span>
                  <span className="font-mono font-bold text-rose-400">
                    -{financialData.totalExpenses.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  </span>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* 2. CIRCULAR DIAGRAM (Donut Chart - Dépenses uniquement) */}
        {(activeTab === 'both' || activeTab === 'pie') && (
          <Card className={`glass-card p-5 border border-border/60 rounded-2xl flex flex-col justify-between ${
            activeTab === 'both' ? 'lg:col-span-5' : 'w-full'
          }`}>
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <PieIcon className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">
                    Diagramme Circulaire des Dépenses
                  </h3>
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  Dépenses Seules
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2 mb-3">
                Répartition exclusive de vos sorties d'argent par catégorie de dépenses (fixes et courantes).
              </p>
            </div>

            {/* Circular Pie Chart with central total */}
            <div className="relative flex items-center justify-center my-2">
              {!financialData.hasExpenses ? (
                <div className="text-center p-8 text-muted-foreground">
                  <PieIcon className="w-8 h-8 mx-auto opacity-40 mb-2" />
                  <p className="text-xs font-medium">Aucune dépense à afficher dans le diagramme circulaire.</p>
                </div>
              ) : (
                <div className="w-full relative">
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={financialData.expenseItems}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={62}
                        outerRadius={92}
                        paddingAngle={3}
                        stroke="none"
                      >
                        {financialData.expenseItems.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-card/95 backdrop-blur-md p-2.5 rounded-xl border border-border/80 shadow-xl text-xs">
                                <div className="font-bold text-foreground flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
                                  <span>{data.name}</span>
                                </div>
                                <div className="mt-1 text-muted-foreground">
                                  Montant : <span className="font-bold text-foreground font-mono">{data.value.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                                </div>
                                <div className="text-cyan-400 font-semibold">
                                  Part : {data.percentage.toFixed(1)}% des dépenses
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Central callout */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                      Total Dépenses
                    </span>
                    <span className="text-base font-extrabold text-foreground font-mono">
                      {financialData.totalExpenses.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {financialData.expenseItems.length} poste{financialData.expenseItems.length > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Custom Interactive Legend with percentages */}
            {financialData.hasExpenses && (
              <div className="max-h-40 overflow-y-auto pr-1 space-y-1.5 pt-3 border-t border-border/40 scrollbar-thin">
                {financialData.expenseItems.map(item => (
                  <div key={item.name} className="flex items-center justify-between text-xs hover:bg-secondary/40 p-1.5 rounded-lg transition-colors">
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="font-medium text-foreground truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="font-bold font-mono text-foreground">
                        {item.value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                      </span>
                      <span className="text-[11px] font-semibold text-cyan-400 w-12 text-right">
                        {item.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

      </div>
    </div>
  );
};

export default BankFlowCharts;
