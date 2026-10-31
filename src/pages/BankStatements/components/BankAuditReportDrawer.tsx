import React, { useState, useMemo } from 'react';
import { 
  X, 
  Sparkles, 
  Clock, 
  Check, 
  Copy, 
  AlertTriangle, 
  ArrowDownLeft, 
  ArrowUpRight, 
  ArrowLeft,
  ShieldAlert, 
  Lightbulb, 
  FileText, 
  TrendingDown, 
  TrendingUp, 
  CreditCard, 
  Building2,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Scale,
  Award,
  Layers
} from 'lucide-react';
import type { DeepAuditReport } from '../../../lib/geminiService';
import { formatCurrency } from '../../../lib/bankUtils';

interface BankAuditReportDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  report: DeepAuditReport | null;
  currency?: string;
}

export const BankAuditReportDrawer: React.FC<BankAuditReportDrawerProps> = ({
  isOpen,
  onClose,
  onBack,
  report,
  currency = 'EUR'
}) => {
  // Navigation en 3 TEMPS validée lors du cadrage d'audit financier
  const [activeTab, setActiveTab] = useState<'revenues' | 'expenses' | 'coverage' | 'markdown'>('revenues');
  const [copied, setCopied] = useState(false);

  if (!isOpen || !report) return null;

  const currSym = currency === 'CHF' ? 'CHF' : '€';

  // 1. CALCULS TEMPS 1 : Encaissements & Stabilité des Revenus
  const totalInflow = report.inflows.totalInflow || 0;
  const recurringItems = report.inflows.items.filter(i => i.isRecurringCore);
  const oneOffItems = report.inflows.items.filter(i => !i.isRecurringCore);

  const totalRecurringInflows = recurringItems.reduce((sum, i) => sum + i.total, 0) || report.inflows.totalRecurringResources || 0;
  const totalOneOffInflows = Math.max(0, totalInflow - totalRecurringInflows);
  const recurringInflowsPct = totalInflow > 0 ? Math.round((totalRecurringInflows / totalInflow) * 100) : 0;
  const isIncomeStable = recurringInflowsPct >= 65;

  // 2. CALCULS TEMPS 2 : Sorties & Ventilation des Dépenses (avec Top 3 Médailles)
  const totalOutflow = report.outflows.totalOutflow || 0;

  // Consolidation de l'intégralité des dépenses (postes lourds récurrents + dépenses courantes)
  const allOutflowItems = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      total: number;
      pctOfOutflow: number;
      pctOfInflow: number;
      nature: 'fixe' | 'variable';
      isWarning?: boolean;
      details?: string;
    }> = [];

    (report.outflows.heavyRecurringItems || []).forEach((item, idx) => {
      const amt = item.total || 0;
      list.push({
        id: `heavy-${idx}`,
        title: item.title,
        total: amt,
        pctOfOutflow: totalOutflow > 0 ? Math.round((amt / totalOutflow) * 100) : 0,
        pctOfInflow: totalInflow > 0 ? Math.round((amt / totalInflow) * 100) : 0,
        nature: 'fixe',
        isWarning: item.isWarning,
        details: item.details
      });
    });

    (report.outflows.dailyLivingItems || []).forEach((item, idx) => {
      const amt = item.total || 0;
      list.push({
        id: `daily-${idx}`,
        title: item.title,
        total: amt,
        pctOfOutflow: totalOutflow > 0 ? Math.round((amt / totalOutflow) * 100) : 0,
        pctOfInflow: totalInflow > 0 ? Math.round((amt / totalInflow) * 100) : 0,
        nature: 'variable',
        details: 'Dépenses de vie courante'
      });
    });

    // Classement du poste le plus coûteux au moins coûteux
    return list.sort((a, b) => b.total - a.total);
  }, [report.outflows, totalOutflow, totalInflow]);

  // Top 3 postes de dépenses (Médailles 🥇, 🥈, 🥉)
  const top3Expenses = allOutflowItems.slice(0, 3);

  // 3. CALCULS TEMPS 3 : Capacité de Couverture & Équilibre Financier
  const coverageRatio = totalOutflow > 0 ? Math.round((totalInflow / totalOutflow) * 100) : 100;
  const netBalance = totalInflow - totalOutflow;
  const isSurplus = netBalance >= 0;

  const handleCopyReport = async () => {
    try {
      await navigator.clipboard.writeText(report.markdownReport);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.warn("Échec de copie dans le presse-papier:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center items-center animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Main Drawer Container */}
      <div className="bg-white dark:bg-gray-900 w-full sm:max-w-3xl sm:rounded-[2rem] rounded-t-[2.2rem] shadow-2xl relative z-10 flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden border border-gray-100 dark:border-gray-800 animate-in slide-in-from-bottom duration-300">
        
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mt-2.5 sm:hidden flex-shrink-0" />

        {/* Sticky Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-white/95 dark:bg-gray-900/95 backdrop-blur-md flex-shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-2 -ml-1 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition flex items-center gap-1.5 text-xs font-bold shrink-0 active:scale-95 cursor-pointer"
                title="Retour à la liste des outils"
              >
                <ArrowLeft size={16} />
                <span className="hidden sm:inline">Retour</span>
              </button>
            )}
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 flex-shrink-0">
              <Sparkles size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-extrabold text-gray-900 dark:text-white text-base sm:text-lg truncate">
                  Rapport d'Audit Financier
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Analyse en 3 Temps
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {report.periodLabel} • {report.totalTransactions} opérations analysées
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            {/* Bouton discret Vue rapport brut / Copier texte */}
            <button
              onClick={() => setActiveTab(activeTab === 'markdown' ? 'revenues' : 'markdown')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border ${
                activeTab === 'markdown'
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 border-gray-900 dark:border-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 border-gray-200/80 dark:border-gray-700'
              }`}
              title="Afficher le rapport textuel complet Markdown"
            >
              <FileText size={14} />
              <span className="hidden sm:inline">{activeTab === 'markdown' ? 'Vue 3 Temps' : 'Rapport Brut'}</span>
            </button>

            <button
              onClick={handleCopyReport}
              className={`p-2 rounded-xl transition text-xs font-semibold flex items-center gap-1.5 ${
                copied 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' 
                  : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'
              }`}
              title="Copier le rapport complet"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              <span className="hidden sm:inline">{copied ? 'Copié' : 'Copier'}</span>
            </button>

            <button 
              onClick={onClose}
              className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition active:scale-95 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* --- NAVIGATION DES 3 TEMPS (Onglets Épurés & Explicites) --- */}
        <div className="flex px-4 pt-2.5 border-b border-gray-100 dark:border-gray-800 space-x-2 overflow-x-auto hide-scrollbar bg-gray-50/70 dark:bg-gray-850/50 flex-shrink-0">
          <button
            onClick={() => setActiveTab('revenues')}
            className={`px-4 py-2 text-xs font-bold whitespace-nowrap rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'revenues'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-gray-900 shadow-xs'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400'
            }`}
          >
            <ArrowDownLeft size={15} className="text-emerald-500" />
            <span>TEMPS 1 : Encaissements & Stabilité</span>
          </button>

          <button
            onClick={() => setActiveTab('expenses')}
            className={`px-4 py-2 text-xs font-bold whitespace-nowrap rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'expenses'
                ? 'border-rose-500 text-rose-600 dark:text-rose-400 bg-white dark:bg-gray-900 shadow-xs'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400'
            }`}
          >
            <ArrowUpRight size={15} className="text-rose-500" />
            <span>TEMPS 2 : Dépenses & Top 3 (🥇🥈🥉)</span>
          </button>

          <button
            onClick={() => setActiveTab('coverage')}
            className={`px-4 py-2 text-xs font-bold whitespace-nowrap rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'coverage'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-900 shadow-xs'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400'
            }`}
          >
            <Scale size={15} className="text-indigo-500" />
            <span>TEMPS 3 : Capacité de Couverture</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

          {/* ========================================================================= */}
          {/* TEMPS 1 : ENCAISSEMENTS & STABILITÉ DES REVENUS                           */}
          {/* ========================================================================= */}
          {activeTab === 'revenues' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              
              {/* Synthèse Chiffrée du TEMPS 1 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
                    Total Encaissé
                  </span>
                  <span className="text-xl sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1 block">
                    +{formatCurrency(totalInflow, { currency, showSign: false })}
                  </span>
                  <span className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 font-medium mt-0.5 block">
                    {report.inflows.items.length} source{report.inflows.items.length > 1 ? 's' : ''} d'encaissement
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
                      Revenus Réguliers (Socle)
                    </span>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      {recurringInflowsPct}% du total
                    </span>
                  </div>
                  <span className="text-xl sm:text-2xl font-black font-mono text-gray-900 dark:text-white mt-1 block">
                    +{formatCurrency(totalRecurringInflows, { currency, showSign: false })}
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium mt-0.5 block truncate">
                    Salaires, indemnités chômage & CAF
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
                      Revenus Ponctuels
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                      {100 - recurringInflowsPct}% du total
                    </span>
                  </div>
                  <span className="text-xl sm:text-2xl font-black font-mono text-gray-900 dark:text-white mt-1 block">
                    +{formatCurrency(totalOneOffInflows, { currency, showSign: false })}
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium mt-0.5 block truncate">
                    Virements de proches & remboursements
                  </span>
                </div>
              </div>

              {/* Diagnostic d'audit de stabilité */}
              <div className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
                isIncomeStable 
                  ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40' 
                  : 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40'
              }`}>
                {isIncomeStable ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="font-extrabold text-sm text-gray-900 dark:text-white">
                    {isIncomeStable 
                      ? 'Socle de revenus fiable et stable' 
                      : 'Attention : Forte dépendance aux encaissements ponctuels'}
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                    {isIncomeStable
                      ? `${recurringInflowsPct}% de vos encaissements proviennent de revenus contractuels ou institutionnels réguliers. Votre capacité à faire face à des charges incompressibles est sécurisée par ce socle.`
                      : `${100 - recurringInflowsPct}% de vos revenus proviennent de flux ponctuels (avances, solidarité familiale, remboursements). Ce manque de visibilité mensuelle requiert une gestion prudente de vos charges fixes.`}
                  </p>
                </div>
              </div>

              {/* Liste détaillée des sources de revenus */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Détail des sources & part sur le revenu total
                  </h4>
                  <span className="text-[11px] text-gray-400">Pourcentage / Total</span>
                </div>

                <div className="space-y-2.5">
                  {report.inflows.items.map((item, idx) => {
                    const pctOfIncome = totalInflow > 0 ? Math.round((item.total / totalInflow) * 100) : 0;
                    return (
                      <div 
                        key={idx}
                        className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 shadow-2xs space-y-2 hover:border-gray-200 dark:hover:border-gray-700 transition"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-gray-900 dark:text-white truncate">
                                {item.source}
                              </span>
                              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                item.isRecurringCore 
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' 
                                  : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                              }`}>
                                {item.isRecurringCore ? 'Revenu Régulier' : 'Encaissement Ponctuel'}
                              </span>
                            </div>
                            {item.details && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {item.details} • {item.count} versement{item.count > 1 ? 's' : ''}
                              </p>
                            )}
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-base sm:text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 block">
                              +{formatCurrency(item.total, { currency, showSign: false })}
                            </span>
                            <span className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-400 font-mono">
                              {pctOfIncome}% du revenu total
                            </span>
                          </div>
                        </div>

                        {/* Barre de répartition visuelle */}
                        <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${item.isRecurringCore ? 'bg-emerald-500' : 'bg-blue-500'}`}
                            style={{ width: `${Math.min(100, Math.max(3, pctOfIncome))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TEMPS 2 : SORTIES & VENTILATION DES DÉPENSES (TOP 3 MÉDAILLES)            */}
          {/* ========================================================================= */}
          {activeTab === 'expenses' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Entête Dépenses Totales */}
              <div className="p-4 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300 block">
                    Total des Dépenses Réelles
                  </span>
                  <span className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400 mt-0.5 block">
                    −{formatCurrency(totalOutflow, { currency, showSign: false })}
                  </span>
                  <span className="text-xs text-rose-800/80 dark:text-rose-300/80 font-medium">
                    Consommation, charges fixes & virements émis
                  </span>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
                    Poids sur les Revenus
                  </span>
                  <span className={`text-xl font-black font-mono ${totalOutflow > totalInflow ? 'text-rose-600' : 'text-gray-900 dark:text-white'}`}>
                    {totalInflow > 0 ? Math.round((totalOutflow / totalInflow) * 100) : 100}%
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium block">
                    {totalOutflow > totalInflow ? '⚠️ Dépassement des revenus' : '✅ Inférieur aux revenus'}
                  </span>
                </div>
              </div>

              {/* --- LE TOP 3 DES POSTES DE DÉPENSE (MIS EN AVANT AVEC MÉDAILLES) --- */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-500" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
                    Top 3 des postes de dépenses (Principaux pôles de coûts)
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {top3Expenses.map((exp, idx) => {
                    const medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : '🥉');
                    const medalLabel = idx === 0 ? '1er Poste' : (idx === 1 ? '2ème Poste' : '3ème Poste');
                    const badgeBg = idx === 0 
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' 
                      : (idx === 1 
                          ? 'bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700' 
                          : 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30');

                    return (
                      <div 
                        key={exp.id}
                        className="p-4 rounded-2xl bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-800 shadow-2xs space-y-2.5 relative overflow-hidden flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-lg">{medal}</span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${badgeBg}`}>
                              {medalLabel}
                            </span>
                          </div>

                          <h5 className="font-extrabold text-sm text-gray-900 dark:text-white line-clamp-2" title={exp.title}>
                            {exp.title}
                          </h5>
                          
                          <span className="text-lg sm:text-xl font-black font-mono text-rose-600 dark:text-rose-400 mt-1 block">
                            −{formatCurrency(exp.total, { currency, showSign: false })}
                          </span>
                        </div>

                        {/* Ratios : % dépenses et % revenus */}
                        <div className="pt-2 border-t border-gray-100 dark:border-gray-750 space-y-1 text-xs">
                          <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                            <span className="text-[11px]">Part des dépenses :</span>
                            <strong className="font-mono text-gray-900 dark:text-white">{exp.pctOfOutflow}%</strong>
                          </div>
                          <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                            <span className="text-[11px]">Part des revenus :</span>
                            <strong className="font-mono text-rose-600 dark:text-rose-400">{exp.pctOfInflow}%</strong>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Liste exhaustive des dépenses */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Ventilation détaillée de toutes les dépenses
                  </h4>
                  <span className="text-[11px] text-gray-400">% Dépenses • % Revenus</span>
                </div>

                <div className="space-y-2">
                  {allOutflowItems.map((item, idx) => (
                    <div 
                      key={item.id || idx}
                      className="p-3.5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 shadow-2xs flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900 dark:text-white text-sm truncate">
                            {item.title}
                          </span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            item.nature === 'fixe'
                              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          }`}>
                            {item.nature === 'fixe' ? 'Charge Fixe' : 'Dépense Courante'}
                          </span>
                          {item.isWarning && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                              ⚠️ Attention
                            </span>
                          )}
                        </div>
                        {item.details && (
                          <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                            {item.details}
                          </p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-sm font-black font-mono text-rose-600 dark:text-rose-400 block">
                          −{formatCurrency(item.total, { currency, showSign: false })}
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">
                          {item.pctOfOutflow}% des dépenses • {item.pctOfInflow}% des revenus
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TEMPS 3 : CAPACITÉ DE COUVERTURE & ÉQUILIBRE FINANCIER                    */}
          {/* ========================================================================= */}
          {activeTab === 'coverage' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Question Centrale & Double Jauge de Couverture */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-background to-secondary/30 border-2 border-indigo-500/25 space-y-4">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                  <Scale size={18} />
                  <span className="text-xs font-black uppercase tracking-wider">
                    Équilibre Budgétaire & Couverture
                  </span>
                </div>

                <h4 className="text-base sm:text-lg font-black text-gray-900 dark:text-white leading-snug">
                  Vos revenus permettent-ils de couvrir l'intégralité de vos dépenses ?
                </h4>

                {/* 1. Pourcentage Simple & Statut Explicite */}
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className={`text-3xl sm:text-4xl font-black font-mono tracking-tight ${
                    coverageRatio >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {coverageRatio} %
                  </span>
                  <span className={`text-sm sm:text-base font-extrabold px-3 py-1 rounded-xl ${
                    coverageRatio >= 100 
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                  }`}>
                    {coverageRatio >= 100 ? '✅ Budget Excédentaire' : '⚠️ Déficit de Couverture'}
                  </span>
                </div>

                {/* 2. Barre de progression visuelle colorée */}
                <div className="space-y-1.5 pt-1">
                  <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden p-0.5 relative">
                    {/* Ligne repère à 100% */}
                    <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-black/40 dark:bg-white/40 z-10" title="Seuil d'équilibre à 100%" />
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        coverageRatio >= 100 
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400' 
                          : coverageRatio >= 90 
                            ? 'bg-gradient-to-r from-amber-500 to-orange-400' 
                            : 'bg-gradient-to-r from-rose-600 to-red-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(5, coverageRatio))}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                    <span>0 % (Aucune couverture)</span>
                    <span className="font-extrabold text-gray-900 dark:text-white">Seuil d'équilibre (100 %)</span>
                  </div>
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed pt-1">
                  {coverageRatio >= 100
                    ? `Vos encaissements couvrent 100% de vos sorties avec une marge de sécurité de +${formatCurrency(netBalance, { currency, showSign: false })}. Vous dégagez une réelle capacité d'épargne.`
                    : `Vos dépenses dépassent vos revenus de ${Math.abs(coverageRatio - 100)}%. Il vous manque ${formatCurrency(Math.abs(netBalance), { currency, showSign: false })} pour être à l'équilibre sur cette période.`}
                </p>
              </div>

              {/* Bilan à 3 Colonnes : Revenus, Dépenses, Solde Net */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Total Revenus (+)</span>
                  <span className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1 block">
                    +{formatCurrency(totalInflow, { currency, showSign: false })}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Total Dépenses (−)</span>
                  <span className="text-lg font-black font-mono text-rose-600 dark:text-rose-400 mt-1 block">
                    −{formatCurrency(totalOutflow, { currency, showSign: false })}
                  </span>
                </div>

                <div className={`p-4 rounded-2xl border shadow-2xs ${
                  isSurplus 
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40' 
                    : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40'
                }`}>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
                    {isSurplus ? 'Capacité d\'Épargne Réelle' : 'Déficit Net à Combler'}
                  </span>
                  <span className={`text-lg font-black font-mono mt-1 block ${
                    isSurplus ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {isSurplus ? '+' : ''}{formatCurrency(netBalance, { currency, showSign: false })}
                  </span>
                </div>
              </div>

              {/* Recommandations concrètes de l'IA */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-purple-500" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
                    Recommandations d'optimisation budgétaire
                  </h4>
                </div>

                <div className="space-y-2.5">
                  {report.recommendations.map(rec => (
                    <div 
                      key={rec.num}
                      className="p-3.5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 shadow-2xs flex items-start gap-3 text-xs"
                    >
                      <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 flex items-center justify-center font-bold shrink-0 mt-0.5">
                        {rec.num}
                      </div>
                      <div>
                        <h5 className="font-bold text-gray-900 dark:text-white">
                          {rec.title}
                        </h5>
                        <p className="text-gray-600 dark:text-gray-300 mt-0.5 leading-relaxed">
                          {rec.action}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* VUE RAPPORT BRUT (MARKDOWN)                                               */}
          {/* ========================================================================= */}
          {activeTab === 'markdown' && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Rapport textuel complet généré par l'IA (prêt à copier ou archiver) :
                </span>
                <button
                  onClick={handleCopyReport}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/30 active:scale-95 transition cursor-pointer"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Copié !' : 'Copier tout le texte'}</span>
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-gray-900 text-gray-100 font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap select-all border border-gray-800">
                {report.markdownReport}
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 flex items-center justify-between gap-3 flex-shrink-0">
          <button
            onClick={handleCopyReport}
            className="flex-1 py-3 px-4 rounded-2xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-750 font-bold text-xs text-gray-800 dark:text-gray-200 flex items-center justify-center gap-2 active:scale-95 transition cursor-pointer"
          >
            {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
            <span>{copied ? 'Rapport copié !' : 'Copier le rapport'}</span>
          </button>
          <button
            onClick={onClose}
            className="py-3 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/30 active:scale-95 transition cursor-pointer"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
};
