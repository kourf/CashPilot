import React, { useState } from 'react';
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
  Users, 
  Building2,
  ChevronRight,
  Share2
} from 'lucide-react';
import type { DeepAuditReport } from '../../../lib/geminiService';

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
  const [activeTab, setActiveTab] = useState<'alerts' | 'bias' | 'flows' | 'synthesis' | 'markdown'>('alerts');
  const [copied, setCopied] = useState(false);

  if (!isOpen || !report) return null;

  const currSym = currency === 'CHF' ? 'CHF' : '€';

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
      <div className="bg-white dark:bg-gray-900 w-full sm:max-w-2xl sm:rounded-[2rem] rounded-t-[2.2rem] shadow-2xl relative z-10 flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden border border-gray-100 dark:border-gray-800 animate-in slide-in-from-bottom duration-300">
        
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
                  Audit Approfondi IA
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Gemini 3.8 Flash
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {report.periodLabel} • {report.totalTransactions} opérations
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 flex-shrink-0">
            {report.executionSeconds && (
              <div className="hidden sm:flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 text-xs font-mono font-bold">
                <Clock size={12} />
                <span>{report.executionSeconds}s</span>
              </div>
            )}
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
              className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition active:scale-95"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs (Mobile-Friendly Horizontal Scroll) */}
        <div className="flex px-4 pt-2 border-b border-gray-100 dark:border-gray-800 space-x-2 overflow-x-auto hide-scrollbar bg-gray-50/70 dark:bg-gray-850/50 flex-shrink-0">
          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-3.5 py-2 text-xs font-bold whitespace-nowrap rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'alerts'
                ? 'border-red-500 text-red-600 dark:text-red-400 bg-white dark:bg-gray-900 shadow-sm'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400'
            }`}
          >
            <ShieldAlert size={14} className="text-red-500" />
            <span>Alertes Majeures ({report.alerts.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('bias')}
            className={`px-3.5 py-2 text-xs font-bold whitespace-nowrap rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'bias'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-900 shadow-sm'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400'
            }`}
          >
            <AlertTriangle size={14} className="text-amber-500" />
            <span>Biais Banque ({report.falseBankCategories.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('flows')}
            className={`px-3.5 py-2 text-xs font-bold whitespace-nowrap rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'flows'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-900 shadow-sm'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400'
            }`}
          >
            <ArrowDownLeft size={14} className="text-emerald-500" />
            <span>Flux Réels</span>
          </button>

          <button
            onClick={() => setActiveTab('synthesis')}
            className={`px-3.5 py-2 text-xs font-bold whitespace-nowrap rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'synthesis'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400 bg-white dark:bg-gray-900 shadow-sm'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400'
            }`}
          >
            <Lightbulb size={14} className="text-purple-500" />
            <span>Synthèse & Actions</span>
          </button>

          <button
            onClick={() => setActiveTab('markdown')}
            className={`px-3.5 py-2 text-xs font-bold whitespace-nowrap rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'markdown'
                ? 'border-gray-800 dark:border-white text-gray-900 dark:text-white bg-white dark:bg-gray-900 shadow-sm'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400'
            }`}
          >
            <FileText size={14} />
            <span>Rapport Markdown</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

          {/* TAB 1: POINTS D'ALERTE MAJEURS */}
          {activeTab === 'alerts' && (
            <div className="space-y-4">
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl p-4 text-xs text-red-900 dark:text-red-200 flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-red-950 dark:text-red-100">
                    Audit Critique par l'IA des Libellés Réels
                  </h4>
                  <p className="mt-1 leading-relaxed text-red-800 dark:text-red-300">
                    L'analyse a identifié des flux financiers critiques et des déséquilibres majeurs masqués par la catégorisation d'origine de la banque.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {report.alerts.map((alert, idx) => (
                  <div 
                    key={alert.id || idx}
                    className="p-4 rounded-2xl border transition bg-white dark:bg-gray-800/80 border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 shadow-sm space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          alert.severity === 'critical' ? 'bg-red-500 animate-pulse' : (alert.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-500')
                        }`} />
                        <h5 className="font-bold text-sm text-gray-900 dark:text-white">
                          {idx + 1}. {alert.title}
                        </h5>
                      </div>
                      {typeof alert.amount === 'number' && alert.amount > 0 && (
                        <span className="text-xs font-mono font-extrabold px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 shrink-0">
                          ~{alert.amount.toFixed(0)} {currSym}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed pl-4">
                      {alert.details}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: BIAIS & ERREURS DE LA BANQUE */}
          {activeTab === 'bias' && (
            <div className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-amber-950 dark:text-amber-100">
                    Les catégories du fichier CSV sont trompeuses
                  </h4>
                  <p className="mt-1 leading-relaxed text-amber-800 dark:text-amber-300">
                    La banque classe souvent des virements familiaux en « Restaurants » ou des remboursements en « Achats ». Voici les erreurs corrigées par CashPilot :
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {report.falseBankCategories.map((item, idx) => (
                  <div 
                    key={idx}
                    className="p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 shadow-sm space-y-2.5 text-xs"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-bold text-gray-900 dark:text-white text-xs truncate">
                        {item.realLabel}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 font-semibold shrink-0 line-through">
                        {item.fileCategory}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-750 text-gray-700 dark:text-gray-300 border border-gray-100 dark:border-gray-700 flex items-start gap-2">
                      <ChevronRight size={14} className="text-blue-500 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                          {item.problem}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400 text-[11px]">
                          <span>Reclassé en :</span>
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60">
                            {item.realNature}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: FLUX RÉELS (ENTRÉES & SORTIES DÉCORTIQUÉES) */}
          {activeTab === 'flows' && (
            <div className="space-y-6">
              {/* Entrées réelles */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-extrabold text-sm uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <ArrowDownLeft size={16} />
                    <span>Flux Entrants (Crédits réels)</span>
                  </h4>
                  <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300">
                    +{report.inflows.totalInflow.toFixed(2)} {currSym}
                  </span>
                </div>

                <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 rounded-2xl p-3 mb-3 text-xs text-emerald-900 dark:text-emerald-200">
                  <span className="font-bold">Socle du budget garanti :</span> France Travail + CAF ≈ <span className="font-extrabold font-mono">{report.inflows.coreMonthlyBudget} {currSym}/mois</span> (total de {report.inflows.totalRecurringResources.toFixed(2)} {currSym} sur la période).
                </div>

                <div className="space-y-2">
                  {report.inflows.items.map((item, idx) => (
                    <div 
                      key={idx}
                      className="p-3 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-bold text-gray-900 dark:text-gray-100 truncate">
                          {item.source}
                        </div>
                        {item.details && (
                          <div className="text-[11px] text-gray-400 truncate">
                            {item.details} • {item.count} versement{item.count > 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                      <div className="font-bold font-mono text-emerald-600 dark:text-emerald-400 text-sm shrink-0">
                        +{item.total.toFixed(2)} {currSym}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sorties : Postes lourds */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-extrabold text-sm uppercase tracking-wider text-red-600 dark:text-red-400 flex items-center gap-1.5">
                    <ArrowUpRight size={16} />
                    <span>Postes Lourds & Récurrents</span>
                  </h4>
                  <span className="text-xs font-mono font-bold text-red-700 dark:text-red-300">
                    −{report.outflows.totalHeavyRecurring.toFixed(2)} {currSym}
                  </span>
                </div>

                <div className="space-y-2">
                  {report.outflows.heavyRecurringItems.map((item, idx) => (
                    <div 
                      key={idx}
                      className={`p-3 rounded-2xl border flex items-center justify-between text-xs ${
                        item.isWarning 
                          ? 'bg-red-50/40 dark:bg-red-950/20 border-red-200 dark:border-red-900/40' 
                          : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-800'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5 truncate">
                          <span>{item.title}</span>
                          {item.isWarning && <span className="text-xs">⚠️</span>}
                        </div>
                        <div className="text-[11px] text-gray-400 truncate">
                          {item.details}
                        </div>
                      </div>
                      <div className="font-bold font-mono text-red-600 dark:text-red-400 text-sm shrink-0">
                        −{item.total.toFixed(2)} {currSym}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sorties : Dépenses courantes */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-extrabold text-sm uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <TrendingDown size={16} />
                    <span>Dépenses de Vie Courante</span>
                  </h4>
                  <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-300">
                    −{report.outflows.totalDailyLiving.toFixed(2)} {currSym}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {report.outflows.dailyLivingItems.map((item, idx) => (
                    <div 
                      key={idx}
                      className="p-3 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {item.title}
                        </div>
                      </div>
                      <div className="font-bold font-mono text-gray-700 dark:text-gray-300 text-xs shrink-0">
                        ≈ {item.total.toFixed(0)} {currSym}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SYNTHÈSE & ACTIONS */}
          {activeTab === 'synthesis' && (
            <div className="space-y-6">
              {/* Tableau Chiffré de Synthèse */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm space-y-3">
                <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                  Bilan Budgétaire Chiffré ({report.periodLabel})
                </h4>

                <div className="divide-y divide-gray-100 dark:divide-gray-750 text-xs">
                  <div className="py-2 flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-300 font-medium">Entrées réelles récurrentes (France Travail + CAF)</span>
                    <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400">+{report.synthesis.realRecurringInflows.toFixed(2)} {currSym}</span>
                  </div>
                  <div className="py-2 flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-300 font-medium">Entrées ponctuelles (Virements reçus, remboursements)</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">+{report.synthesis.oneOffInflows.toFixed(2)} {currSym}</span>
                  </div>
                  <div className="py-2 flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-300 font-medium">Charges fixes récurrentes (Loyer, télécom, énergie, assurances, Amex, dettes)</span>
                    <span className="font-mono font-bold text-red-600 dark:text-red-400">−{report.synthesis.fixedRecurringOutflows.toFixed(2)} {currSym}</span>
                  </div>
                  <div className="py-2 flex justify-between items-center bg-red-50/50 dark:bg-red-950/20 px-2 rounded-xl">
                    <span className="text-red-950 dark:text-red-200 font-bold">Virements émis vers tiers / famille ⚠️</span>
                    <span className="font-mono font-extrabold text-red-600 dark:text-red-400">−{report.synthesis.familyTransfersOutflows.toFixed(2)} {currSym}</span>
                  </div>
                  <div className="py-2 flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-300 font-medium">Dépenses de vie courante (Courses, carburant, resto, shopping, santé)</span>
                    <span className="font-mono font-bold text-gray-800 dark:text-gray-200">−{report.synthesis.dailyLivingOutflows.toFixed(2)} {currSym}</span>
                  </div>
                  <div className="pt-3 flex justify-between items-center text-sm">
                    <span className="font-extrabold text-gray-900 dark:text-white">Solde Net Global</span>
                    <span className={`font-mono font-black ${
                      report.synthesis.netBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {report.synthesis.netBalance >= 0 ? '+' : ''}{report.synthesis.netBalance.toFixed(2)} {currSym}
                    </span>
                  </div>
                </div>

                <div className="mt-3 p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 text-xs leading-relaxed">
                  💡 <strong>Constat d'audit :</strong> Le poste « Virements émis vers tiers / proches » (~{Math.round(report.synthesis.familyTransfersOutflows)} {currSym}) est du même ordre de grandeur que la totalité des dépenses courantes du foyer.
                </div>
              </div>

              {/* 6 Recommandations Stratégiques */}
              <div className="space-y-3">
                <h4 className="font-extrabold text-sm uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                  <Lightbulb size={16} />
                  <span>Recommandations Stratégiques de l'IA</span>
                </h4>

                <div className="space-y-2.5">
                  {report.recommendations.map(rec => (
                    <div 
                      key={rec.num}
                      className="p-3.5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 shadow-sm flex items-start gap-3 text-xs"
                    >
                      <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 flex items-center justify-center font-bold shrink-0 mt-0.5">
                        {rec.num}
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 dark:text-white mb-0.5">
                          {rec.title}
                        </div>
                        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                          {rec.action}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: RAPPORT TEXTE BRUT MARKDOWN (COMME DEEPSEEK) */}
          {activeTab === 'markdown' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Rapport textuel complet prêt à copier ou partager :
                </span>
                <button
                  onClick={handleCopyReport}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/30 active:scale-95 transition"
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
            className="flex-1 py-3 px-4 rounded-2xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-750 font-bold text-xs text-gray-800 dark:text-gray-200 flex items-center justify-center gap-2 active:scale-95 transition"
          >
            {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
            <span>{copied ? 'Rapport copié !' : 'Copier le rapport'}</span>
          </button>
          <button
            onClick={onClose}
            className="py-3 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/30 active:scale-95 transition"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
};
