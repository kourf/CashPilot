import React from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Layers, 
  Clock, 
  Calculator,
  RotateCcw
} from 'lucide-react';
import { formatBankAmount } from '../../../lib/kpiUtils';

interface ReconciliationCardProps {
  metrics: {
    income: number;
    realExpenses: number;
    netCashFlow: number;
  };
  initialBalance: number;
  closingBalance: number;
  currency: 'EUR' | 'CHF';
  onGoToTimeline: () => void;
  onOpenBalanceEditor?: () => void;
}

export const ReconciliationCard: React.FC<ReconciliationCardProps> = ({
  metrics,
  initialBalance,
  closingBalance,
  currency,
  onGoToTimeline,
  onOpenBalanceEditor
}) => {
  const theoreticalClosing = initialBalance + metrics.income - metrics.realExpenses;
  const delta = Math.abs(closingBalance - theoreticalClosing);
  const isPerfect = delta < 0.05;

  return (
    <section className="space-y-6">
      <div className="liquid-glass rounded-3xl p-6 sm:p-8 space-y-6">
        {/* En-tête */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border/60 dark:border-white/10">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl liquid-pill flex items-center justify-center text-primary border-primary/30 shadow-md">
              <Calculator size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-foreground">
                  Rapprochement Bancaire & Cohérence Mathématique
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  isPerfect 
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25"
                }`}>
                  {isPerfect ? "Solde Certifié 100%" : "Contrôle Recommandé"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Vérification continue entre le solde de départ, les flux réels et le solde de clôture
              </p>
            </div>
          </div>

          {onOpenBalanceEditor && (
            <button
              onClick={onOpenBalanceEditor}
              className="liquid-pill px-4 py-2 rounded-2xl text-xs font-semibold text-primary hover:text-primary/80 transition-all flex items-center space-x-1.5 self-start sm:self-auto cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>Ajuster soldes du mois</span>
            </button>
          )}
        </div>

        {/* 4 Colonnes du Rapprochement */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-secondary/50 dark:bg-white/[0.03] border border-border/60 dark:border-white/[0.06] space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              01 • Solde Initial
            </span>
            <div className="text-xl sm:text-2xl font-black text-foreground font-mono">
              {formatBankAmount(initialBalance, currency)}
            </div>
            <p className="text-[11px] text-muted-foreground">Début de période relevé</p>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-500/[0.04] border border-emerald-500/20 space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              02 • Total Revenus (+)
            </span>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              +{formatBankAmount(metrics.income, currency)}
            </div>
            <p className="text-[11px] text-muted-foreground">Entrées nettes certifiées</p>
          </div>

          <div className="p-4 rounded-2xl bg-rose-500/[0.04] border border-rose-500/20 space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              03 • Total Dépenses (-)
            </span>
            <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
              -{formatBankAmount(metrics.realExpenses, currency)}
            </div>
            <p className="text-[11px] text-muted-foreground">Sorties consolidées</p>
          </div>

          <div className="p-4 rounded-2xl bg-primary/5 border border-primary/25 space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
              04 • Solde Final Théorique
            </span>
            <div className="text-xl sm:text-2xl font-black text-foreground font-mono">
              {formatBankAmount(theoreticalClosing, currency)}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {isPerfect ? "Conforme au centime près" : `Écart constaté : ${formatBankAmount(delta, currency)}`}
            </p>
          </div>
        </div>

        {/* Diagnostic Card */}
        <div className={`p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
          isPerfect 
            ? "bg-emerald-500/[0.06] border-emerald-500/30 text-emerald-950 dark:text-emerald-200" 
            : "bg-amber-500/[0.06] border-amber-500/30 text-amber-950 dark:text-amber-200"
        }`}>
          <div className="flex items-center space-x-3">
            {isPerfect ? (
              <CheckCircle2 size={24} className="text-emerald-500 shrink-0" />
            ) : (
              <AlertTriangle size={24} className="text-amber-500 shrink-0" />
            )}
            <div>
              <div className="font-bold text-sm">
                {isPerfect 
                  ? "Cohérence mathématique certifiée à 100%" 
                  : "Contrôle chronologique recommandé"}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isPerfect
                  ? "Toutes les opérations débitrices et créditrices sont parfaitement équilibrées avec les soldes bancaires déclarés."
                  : "Un léger décalage existe entre les mouvements saisis et le solde déclaré. La Frise Chronologique permet d'identifier les segments manquants."}
              </p>
            </div>
          </div>

          <button
            onClick={onGoToTimeline}
            className="liquid-pill px-4 py-2 rounded-xl text-xs font-bold text-foreground flex items-center space-x-1.5 shrink-0 hover:border-primary/50 cursor-pointer shadow-xs"
          >
            <Clock size={14} className="text-primary" />
            <span>Consulter la Frise Chronologique</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </section>
  );
};

export default ReconciliationCard;
