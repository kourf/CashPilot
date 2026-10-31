import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  LabelList 
} from 'recharts';
import { formatBankAmount } from '../../../lib/kpiUtils';

export interface MobileChartsProps {
  metrics: any;
  categoryStats: { categories: any[] };
  currency?: 'EUR' | 'CHF';
  activeTab?: 'sankey' | 'donut' | 'bar';
  hideInternalTabs?: boolean;
  onCategoryClick: (categoryName: string) => void;
}

const COLORS = [
  '#10B981', // Emeraude
  '#3B82F6', // Bleu
  '#F59E0B', // Ambre
  '#EF4444', // Rouge
  '#8B5CF6', // Violet
  '#EC4899', // Rose
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#6366F1', // Indigo
  '#14B8A6'  // Teal
];

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

export const MobileCharts: React.FC<MobileChartsProps> = ({ 
  metrics, 
  categoryStats, 
  currency = 'EUR',
  activeTab: propActiveTab,
  hideInternalTabs = false,
  onCategoryClick 
}) => {
  const [internalTab, setInternalTab] = useState<'sankey' | 'donut' | 'bar'>('sankey');
  const activeTab = propActiveTab || internalTab;

  // Filtrage strict : Aucune macro-catégorie autorisée dans les graphiques
  const validExpenseCategories = useMemo(() => {
    return (categoryStats?.categories || []).filter(
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
      const totalInc = metrics?.income || 0;
      const totalExp = metrics?.realExpenses || 0;
      
      const incomeNodeLabel = totalInc > 0 
        ? `Revenus (${formatBankAmount(totalInc, currency)})` 
        : `Dépenses Totales (${formatBankAmount(totalExp, currency)})`;

      validExpenseCategories.forEach((c: any) => {
        if (c.total > 0.01) {
          const pct = totalInc > 0 ? (c.total / totalInc) * 100 : (totalExp > 0 ? (c.total / totalExp) * 100 : 0);
          rows.push([
            incomeNodeLabel, 
            `${c.category} (${formatBankAmount(c.total, currency)} • ${pct.toFixed(0)}%)`, 
            Number(c.total.toFixed(2))
          ]);
        }
      });

      const reste = totalInc - totalExp;
      if (reste > 0.01) {
         const pct = totalInc > 0 ? (reste / totalInc) * 100 : 0;
         rows.push([
           incomeNodeLabel, 
           `Reste à Vivre (${formatBankAmount(reste, currency)} • ${pct.toFixed(0)}%)`, 
           Number(reste.toFixed(2))
         ]);
      }

      if (rows.length === 0) return;
      dataTable.addRows(rows);

      const isDarkMode = document.documentElement.classList.contains('dark') || true;
      const textColor = isDarkMode ? '#f1f5f9' : '#0f172a';

      const options = {
        width: '100%',
        height: Math.max(340, rows.length * 44),
        sankey: {
          node: {
            nodePadding: 16,
            width: 14,
            colors: ['#06b6d4', ...COLORS, '#10b981'],
            label: { fontSize: 11, color: textColor, bold: true }
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
              selectedName = String(dataTable.getValue(item.row, 1) || '');
            }
          } catch (e) {
            console.error("Sankey selection error", e);
          }
          
          if (selectedName) {
            const found = categoryStats?.categories?.find((c: any) => selectedName.startsWith(c.category));
            if (found) {
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
  }, [googleLoaded, activeTab, categoryStats, metrics, currency]);

  // Tooltip sombre élégant (Google Stitch Glassmorphism) pour éviter le texte blanc sur fond blanc
  const CustomBarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const categoryName = data.payload?.name || '';
      const amount = Number(data.value) || 0;
      const color = data.payload?.fill || '#3b82f6';
      return (
        <div className="bg-gray-900/95 dark:bg-gray-900/95 backdrop-blur-md border border-gray-700/80 p-3 rounded-2xl shadow-xl text-xs space-y-1 z-50">
          <div className="font-bold text-gray-100 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span className="truncate">{categoryName}</span>
          </div>
          <div className="font-mono font-extrabold text-cyan-400 text-sm">
            {formatBankAmount(amount, currency)}
          </div>
        </div>
      );
    }
    return null;
  };

  // Label avec flèche / connecteur pour le donut Recharts
  const renderDonutCalloutLabel = (props: any) => {
    const { cx, cy, midAngle, outerRadius, name, value, fill, index } = props;
    const RADIAN = Math.PI / 180;
    const cos = Math.cos(-midAngle * RADIAN);
    const sin = Math.sin(-midAngle * RADIAN);
    const isRight = cos >= 0;

    const sx = cx + (outerRadius + 3) * cos;
    const sy = cy + (outerRadius + 3) * sin;
    const mx = cx + (outerRadius + 18) * cos;
    const my = cy + (outerRadius + 18) * sin;
    const ex = mx + (isRight ? 1 : -1) * 16;
    const ey = my;

    const color = fill || COLORS[index % COLORS.length];
    const formattedVal = formatBankAmount(value, currency);

    return (
      <g className="cursor-pointer select-none" onClick={() => onCategoryClick(name)}>
        <polyline
          points={`${sx},${sy} ${mx},${my} ${ex},${ey}`}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeOpacity={0.85}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={ex} cy={ey} r={2.5} fill={color} />
        <text
          x={ex + (isRight ? 5 : -5)}
          y={ey}
          textAnchor={isRight ? 'start' : 'end'}
          dominantBaseline="central"
          fill={color}
          className="font-bold text-[10.5px] sm:text-[11px]"
          style={{ fontSize: '11px', fontWeight: 700 }}
        >
          {`${name} (${formattedVal})`}
        </text>
      </g>
    );
  };

  return (
    <div className="w-full">
      {/* Tabs internes (affichés uniquement si non contrôlés par le parent) */}
      {!hideInternalTabs && (
        <div className="flex justify-center space-x-2 mb-4">
          {['sankey', 'donut', 'bar'].map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setInternalTab(tab as any)}
              className={`px-3 py-1 text-xs rounded-full capitalize font-medium transition-colors cursor-pointer ${
                activeTab === tab 
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-sm' 
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 hover:text-foreground'
              }`}
            >
              {tab === 'bar' ? 'Barres' : tab === 'donut' ? 'Donut' : 'Sankey'}
            </button>
          ))}
        </div>
      )}

      {/* Contenu du graphique actif */}
      <div className="w-full min-h-[360px] flex items-center justify-center">
        {activeTab === 'donut' && (
          <div className="w-full h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 25, right: 35, bottom: 25, left: 35 }}>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={62}
                  outerRadius={88}
                  paddingAngle={4}
                  dataKey="value"
                  onClick={(data) => onCategoryClick(data.name)}
                  className="cursor-pointer"
                  labelLine={false}
                  label={renderDonutCalloutLabel}
                >
                  {donutData.map((entry, index) => (
                    <Cell 
                      key={`cell-${entry.name}`} 
                      fill={COLORS[index % COLORS.length]} 
                      className="hover:opacity-80 transition-opacity"
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomBarTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {activeTab === 'bar' && (
          <div className="w-full h-[380px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={barData} 
                margin={{ top: 45, right: 15, left: 10, bottom: 25 }} 
                onClick={(data: any) => data?.activePayload?.[0] && onCategoryClick(data.activePayload[0].payload.name)}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10, fill: '#94a3b8' }} 
                  tickLine={false} 
                  axisLine={false}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={55}
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: '#94a3b8' }} 
                  tickLine={false} 
                  axisLine={false} 
                  width={65} 
                  tickFormatter={(val) => formatBankAmount(val, currency)} 
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }} 
                  content={<CustomBarTooltip />} 
                />
                <Bar 
                  dataKey="Dépenses" 
                  fill="#3B82F6" 
                  radius={[6, 6, 0, 0]} 
                  className="cursor-pointer"
                >
                  {barData.map((entry, index) => (
                    <Cell 
                      key={`cell-${entry.name}`} 
                      fill={COLORS[index % COLORS.length]} 
                      className="hover:opacity-85 transition-opacity"
                    />
                  ))}
                  <LabelList 
                    dataKey="Dépenses" 
                    position="top" 
                    offset={8} 
                    formatter={(val: number) => formatBankAmount(val, currency)} 
                    style={{ fontSize: 10, fill: '#38bdf8', fontWeight: 'bold', fontFamily: 'monospace' }} 
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {activeTab === 'sankey' && (
          <div className="w-full min-h-[350px] overflow-x-auto relative">
            {!googleLoaded ? (
              <div className="flex items-center justify-center min-h-[320px] text-xs text-muted-foreground animate-pulse font-medium">
                Initialisation du flux Sankey...
              </div>
            ) : (
              <div ref={sankeyContainerRef} className="w-full min-h-[340px]" />
            )}
          </div>
        )}
      </div>
      
      {/* Légende détaillée si affichage autonome du Donut */}
      {!hideInternalTabs && activeTab === 'donut' && (
        <div className="mt-4 space-y-2 max-h-44 overflow-y-auto hide-scrollbar">
          {validExpenseCategories.slice(0, 8).map((cat, i) => (
            <div 
              key={cat.category} 
              onClick={() => onCategoryClick(cat.category)} 
              className="flex items-center justify-between text-xs cursor-pointer active:scale-95 transition-transform p-1.5 rounded-xl hover:bg-secondary/40"
            >
              <div className="flex items-center space-x-2 truncate">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="truncate text-foreground font-medium">{cat.category}</span>
              </div>
              <div className="flex flex-col items-end flex-shrink-0 ml-2">
                <span className="font-bold text-foreground font-mono">{formatBankAmount(cat.total, currency)}</span>
                <span className="text-[10px] text-muted-foreground">
                  {metrics?.realExpenses > 0 ? ((cat.total / metrics.realExpenses) * 100).toFixed(1) : 0}% dep. • {metrics?.income > 0 ? ((cat.total / metrics.income) * 100).toFixed(1) : 0}% rev.
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MobileCharts;
