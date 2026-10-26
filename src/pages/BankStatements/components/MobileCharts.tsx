import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LabelList } from 'recharts';

interface MobileChartsProps {
  metrics: any;
  categoryStats: { categories: any[] };
  onCategoryClick: (categoryName: string) => void;
}

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'];

/**
 * RÈGLE D'AFFICHAGE STRICTE :
 * Les diagrammes (en beignet, en bâtons, Sankey) ne doivent JAMAIS afficher de macro-catégorie
 * comme "Charges fixes" ou "Charges variables courantes". Seules les vraies sous-catégories
 * de dépenses (Carburant, Alimentation, Abonnements, Logement, Santé, etc.) sont visualisées.
 */
function isExcludedMacroCategory(categoryName: string): boolean {
  const norm = (categoryName || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  return (
    norm === 'charges fixes' ||
    norm === 'charges variables' ||
    norm === 'charges variables courantes' ||
    norm === 'depenses de confort' ||
    norm === 'revenus' ||
    norm === 'revenu'
  );
}

export const MobileCharts: React.FC<MobileChartsProps> = ({ metrics, categoryStats, onCategoryClick }) => {
  const [activeTab, setActiveTab] = useState<'sankey' | 'donut' | 'bar'>('donut');

  // Filtrage strict : Aucune macro-catégorie autorisée dans les graphiques
  const validExpenseCategories = useMemo(() => {
    return (categoryStats.categories || []).filter(
      c => !isExcludedMacroCategory(c.category) && c.total > 0.01
    );
  }, [categoryStats]);

  const donutData = useMemo(() => {
    return validExpenseCategories.slice(0, 8).map(c => ({
      name: c.category,
      value: c.total
    }));
  }, [validExpenseCategories]);

  const barData = useMemo(() => {
    return validExpenseCategories.slice(0, 10).map(c => ({
      name: c.category,
      Dépenses: c.total
    }));
  }, [validExpenseCategories]);

  const sankeyContainerRef = useRef<HTMLDivElement>(null);
  const [googleLoaded, setGoogleLoaded] = useState(false);
  const isDark = true; // Assume dark for mobile or check document

  useEffect(() => {
    const checkDark = () => document.documentElement.classList.contains('dark');
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
          (window as any).google.charts.setOnLoadCallback(() => setGoogleLoaded(true));
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

  useEffect(() => {
    if (!googleLoaded || !sankeyContainerRef.current || activeTab !== 'sankey') return;

    try {
      const google = (window as any).google;
      if (!google?.visualization?.Sankey) return;

      const dataTable = new google.visualization.DataTable();
      dataTable.addColumn('string', 'From');
      dataTable.addColumn('string', 'To');
      dataTable.addColumn('number', 'Montant');

      const rows: any[] = [];
      const totalInc = metrics.income || 0;
      const totalExp = metrics.realExpenses || 0;
      
      const incomeNodeLabel = totalInc > 0 ? `Revenus (${totalInc.toFixed(0)} €)` : `Dépenses Totales (${totalExp.toFixed(0)} €)`;

      validExpenseCategories.forEach((c: any) => {
        if (c.total > 0.01) {
          const pct = totalInc > 0 ? (c.total / totalInc) * 100 : (totalExp > 0 ? (c.total / totalExp) * 100 : 0);
          rows.push([incomeNodeLabel, `${c.category} (${c.total.toFixed(0)} € • ${pct.toFixed(0)}%)`, Number(c.total.toFixed(2))]);
        }
      });

      const reste = totalInc - totalExp;
      if (reste > 0.01) {
         const pct = totalInc > 0 ? (reste / totalInc) * 100 : 0;
         rows.push([incomeNodeLabel, `Reste à Vivre (${reste.toFixed(0)} € • ${pct.toFixed(0)}%)`, Number(reste.toFixed(2))]);
      }

      if (rows.length === 0) return;
      dataTable.addRows(rows);

      const isDarkMode = document.documentElement.classList.contains('dark') || true;
      const textColor = isDarkMode ? '#f1f5f9' : '#0f172a';

      const options = {
        width: '100%',
        height: Math.max(300, rows.length * 40),
        sankey: {
          node: {
            nodePadding: 12,
            width: 12,
            colors: ['#06b6d4', ...COLORS, '#10b981'],
            label: { fontSize: 10, color: textColor, bold: true }
          },
          link: {
            colorMode: 'gradient',
            colors: ['#06b6d4', ...COLORS, '#10b981'],
            fillOpacity: isDarkMode ? 0.35 : 0.45
          }
        },
        backgroundColor: 'transparent'
      };

      const chart = new google.visualization.Sankey(sankeyContainerRef.current);

      google.visualization.events.addListener(chart, 'select', () => {
        const selection = chart.getSelection();
        if (selection && selection.length > 0) {
          const item = selection[0];
          let selectedName = '';
          
          try {
            if (item.name) {
              selectedName = String(item.name);
            } else if (item.row !== null && item.row !== undefined) {
              // Get the target node label (column 1 is 'To')
              selectedName = String(dataTable.getValue(item.row, 1) || '');
            }
          } catch (e) {
            console.error("Sankey selection error", e);
          }
          
          if (selectedName) {
            const found = categoryStats.categories.find((c: any) => selectedName.startsWith(c.category));
            if (found) {
              // Execute asynchronously to allow Google Charts to finish its event loop
              setTimeout(() => {
                onCategoryClick(found.category);
              }, 10);
            }
          }
        }
      });

      chart.draw(dataTable, options);

    } catch (err) {
      console.error("Erreur génération diagramme Sankey:", err);
    }

    return () => {
      if (sankeyContainerRef.current) sankeyContainerRef.current.innerHTML = '';
    };
  }, [googleLoaded, activeTab, categoryStats, metrics]);

  return (
    <div className="w-full">
      {/* Tabs */}
      <div className="flex justify-center space-x-2 mb-4">
        {['sankey', 'donut', 'bar'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-3 py-1 text-xs rounded-full capitalize font-medium transition-colors ${activeTab === tab ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Chart Content */}
      <div className="h-[300px] w-full mt-4">
        {activeTab === 'donut' && (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                onClick={(data) => onCategoryClick(data.name)}
                className="cursor-pointer"
                labelLine={true}
                label={({ name, value }) => `${name} (${Math.round(value).toLocaleString('fr-FR')} €)`}
              >
                {donutData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `${value.toFixed(2)} €`} />
            </PieChart>
          </ResponsiveContainer>
        )}

        {activeTab === 'bar' && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 40, right: 10, left: 0, bottom: 0 }} onClick={(data: any) => data?.activePayload?.[0] && onCategoryClick(data.activePayload[0].payload.name)}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis dataKey="name" tick={{fontSize: 10}} tickLine={false} axisLine={false} hide />
              <YAxis tick={{fontSize: 10}} tickLine={false} axisLine={false} width={45} tickFormatter={(val) => Math.round(val).toLocaleString('fr-FR')} />
              <Tooltip cursor={{fill: 'transparent'}} formatter={(value: number) => `${value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`} />
              <Bar dataKey="Dépenses" fill="#3B82F6" radius={[4, 4, 0, 0]} className="cursor-pointer">
                {barData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
                <LabelList dataKey="name" position="top" offset={16} style={{ fontSize: 10, fill: '#f1f5f9', fontWeight: 'bold' }} />
                <LabelList dataKey="Dépenses" position="top" offset={4} formatter={(val: number) => `${Math.round(val).toLocaleString('fr-FR')} €`} style={{ fontSize: 10, fill: '#38bdf8', fontWeight: 'bold' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {activeTab === 'sankey' && (
          <div className="w-full h-full min-h-[300px] overflow-x-auto relative">
            {!googleLoaded ? (
              <div className="flex items-center justify-center h-full text-xs text-gray-400">
                Chargement Sankey...
              </div>
            ) : (
              <div ref={sankeyContainerRef} className="w-full min-h-[300px]" />
            )}
          </div>
        )}
      </div>
      
      {/* Legend / Category list with % vs Income and vs Expenses */}
      {activeTab === 'donut' && (
        <div className="mt-4 space-y-2 max-h-40 overflow-y-auto hide-scrollbar">
          {validExpenseCategories.slice(0, 8).map((cat, i) => (
            <div key={cat.category} onClick={() => onCategoryClick(cat.category)} className="flex items-center justify-between text-xs cursor-pointer active:scale-95 transition-transform p-1 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800">
              <div className="flex items-center space-x-2 truncate">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{backgroundColor: COLORS[i % COLORS.length]}}></div>
                <span className="truncate text-gray-700 dark:text-gray-300">{cat.category}</span>
              </div>
              <div className="flex flex-col items-end flex-shrink-0 ml-2">
                <span className="font-medium text-gray-900 dark:text-gray-100">{cat.total.toFixed(2)} €</span>
                <span className="text-[10px] text-gray-400">
                  {metrics.realExpenses > 0 ? ((cat.total / metrics.realExpenses) * 100).toFixed(1) : 0}% dep. • {metrics.income > 0 ? ((cat.total / metrics.income) * 100).toFixed(1) : 0}% rev.
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
