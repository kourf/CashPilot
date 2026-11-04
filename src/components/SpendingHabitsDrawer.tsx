import React, { useMemo, useState } from 'react';
import { X, Calendar, ArrowLeft, TrendingUp, Tags, FileText, ChevronRight } from 'lucide-react';
import { formatCurrency, formatDateFR, type BankTransaction } from '../lib/bankUtils';

export interface SpendingHabitsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  bankTransactions: BankTransaction[];
}

const DAYS_OF_WEEK = [
  'Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'
];

interface DayStats {
  dayIndex: number; // 0 (Sun) to 6 (Sat)
  name: string;
  totalAmount: number;
  transactions: BankTransaction[];
}

export const SpendingHabitsDrawer: React.FC<SpendingHabitsDrawerProps> = ({
  isOpen,
  onClose,
  onBack,
  bankTransactions
}) => {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Filter & calculate stats
  const { sortedDays, totalExpenses, maxDayAmount } = useMemo(() => {
    const expenses = bankTransactions.filter(t => {
      const isExpense = t.rawAmount !== undefined ? t.rawAmount < 0 : (t.type === 'debit' || t.direction === 'debit' || t.amount < 0);
      return isExpense && !t.isInternalTransfer && t.category !== 'Épargne' && t.category !== 'Virements internes';
    });
    let total = 0;
    let maxAmt = 0;
    const stats: Record<number, DayStats> = {};
    
    for (let i = 0; i < 7; i++) {
      stats[i] = { dayIndex: i, name: DAYS_OF_WEEK[i], totalAmount: 0, transactions: [] };
    }

    expenses.forEach(t => {
      const date = new Date(t.date);
      if (isNaN(date.getTime())) return;
      const day = date.getDay();
      const amt = Math.abs(t.amount);
      stats[day].totalAmount += amt;
      stats[day].transactions.push(t);
      total += amt;
    });

    const sorted = Object.values(stats).sort((a, b) => b.totalAmount - a.totalAmount);
    if (sorted[0]) {
        maxAmt = sorted[0].totalAmount;
    }

    // Sort transactions within each day by date descending
    sorted.forEach(day => {
        day.transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });

    return { sortedDays: sorted, totalExpenses: total, maxDayAmount: maxAmt };
  }, [bankTransactions]);

  if (!isOpen) return null;

  const handleClose = () => {
    setSelectedDay(null);
    onClose();
  };

  const activeDay = selectedDay !== null ? sortedDays.find(d => d.dayIndex === selectedDay) : null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-xl transition-opacity animate-in fade-in duration-200"
        onClick={handleClose}
      />

      {/* Drawer Panel */}
      <div className="relative z-10 w-full max-w-xl bg-[#0b0f1e]/95 backdrop-blur-2xl border-l border-white/15 shadow-[0_25px_60px_rgba(0,0,0,0.8)] flex flex-col h-full animate-in slide-in-from-right duration-300 text-slate-100 overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 bg-white/[0.03] backdrop-blur-xl shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {activeDay ? (
                <button
                  onClick={() => setSelectedDay(null)}
                  className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white border border-white/10 transition-colors flex items-center justify-center shrink-0 cursor-pointer shadow-sm"
                  title="Retour aux jours"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              ) : (
                <>
                  {onBack && (
                    <button
                      type="button"
                      onClick={onBack}
                      className="p-2.5 -ml-1 rounded-2xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white border border-white/10 transition-all flex items-center gap-1.5 text-xs font-bold shrink-0 shadow-sm active:scale-95 cursor-pointer"
                      title="Retour à la liste des outils"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span className="hidden sm:inline">Retour</span>
                    </button>
                  )}
                  <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shadow-md shrink-0 mt-0.5">
                    <Calendar className="w-5 h-5" />
                  </div>
                </>
              )}
              
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
                  {activeDay ? `Détails : ${activeDay.name}` : "Habitudes de Dépenses"}
                </h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {activeDay 
                    ? `${activeDay.transactions.length} transaction(s) ce jour-là` 
                    : "Analyse des jours les plus dépensiers de la semaine."}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white border border-white/10 flex items-center justify-center transition-all shrink-0 cursor-pointer shadow-sm"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Total Summary Header for Main View */}
        {!activeDay && (
          <div className="p-5 border-b border-white/10 bg-white/[0.02] shrink-0">
            <div className="p-4 sm:p-5 rounded-3xl bg-white/[0.035] border border-purple-500/25 shadow-lg backdrop-blur-xl flex items-center justify-between">
              <div>
                <span className="text-xs uppercase font-bold text-indigo-500/90 block mb-1">
                  Total Dépensé (Période)
                </span>
                <span className="text-2xl sm:text-3xl font-black font-mono text-indigo-400">
                  {formatCurrency(totalExpenses, { showSign: false })}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-background/50 border border-border/50 flex items-center justify-center">
                 <TrendingUp className="w-6 h-6 text-indigo-500" />
              </div>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 overscroll-contain bg-transparent">
          
          {/* Main View: List of Days */}
          {!activeDay && (
            <div className="space-y-3 pb-8">
              {sortedDays.map((day, index) => {
                const rank = index + 1;
                const percentOfTotal = totalExpenses > 0 ? (day.totalAmount / totalExpenses) * 100 : 0;
                const percentOfMax = maxDayAmount > 0 ? (day.totalAmount / maxDayAmount) * 100 : 0;
                const isTop = rank === 1 && day.totalAmount > 0;

                return (
                  <button
                    key={day.dayIndex}
                    onClick={() => day.transactions.length > 0 && setSelectedDay(day.dayIndex)}
                    disabled={day.transactions.length === 0}
                    className={`w-full text-left flex flex-col p-4 rounded-2xl border transition-all duration-200 group relative overflow-hidden ${
                      day.transactions.length === 0 
                        ? 'opacity-50 cursor-not-allowed border-border/40 bg-secondary/20' 
                        : isTop 
                          ? 'border-indigo-500/40 bg-indigo-500/5 hover:bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.05)]' 
                          : 'border-border/60 bg-card hover:border-indigo-500/30 hover:bg-secondary/40'
                    }`}
                  >
                    {isTop && (
                      <div className="absolute top-0 right-0 px-3 py-1 bg-indigo-500 text-white text-[10px] font-bold rounded-bl-xl uppercase tracking-wider shadow-sm z-10 flex items-center gap-1">
                         <TrendingUp className="w-3 h-3" /> Pic de dépenses
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between relative z-10 mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          isTop ? 'bg-indigo-500 text-white shadow-md' : 'bg-secondary text-muted-foreground group-hover:bg-indigo-500/20 group-hover:text-indigo-500 transition-colors'
                        }`}>
                          {rank}
                        </div>
                        <h3 className={`font-bold ${isTop ? 'text-purple-300 text-lg' : 'text-white'}`}>
                          {day.name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className={`font-black font-mono ${isTop ? 'text-purple-300 text-lg' : 'text-white'}`}>
                            {formatCurrency(day.totalAmount, { showSign: false })}
                          </div>
                          {day.totalAmount > 0 && (
                            <div className="text-[11px] font-medium text-muted-foreground">
                              {percentOfTotal.toFixed(1)}% du total
                            </div>
                          )}
                        </div>
                        {day.transactions.length > 0 && (
                          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-indigo-500 transition-colors group-hover:translate-x-1" />
                        )}
                      </div>
                    </div>
                    
                    {/* Visual Bar */}
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden relative z-10">
                      <div 
                        className={`h-full rounded-full transition-all duration-700 ease-out ${isTop ? 'bg-indigo-500' : 'bg-indigo-400/50 group-hover:bg-indigo-400'}`}
                        style={{ width: `${percentOfMax}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Drill-down View: Day Details */}
          {activeDay && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 pb-8">
              
              {/* Category Breakdown */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                  <Tags className="w-4 h-4 text-indigo-500" />
                  <h3 className="font-bold text-sm text-white">Répartition par catégorie</h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(() => {
                    const cats: Record<string, number> = {};
                    activeDay.transactions.forEach(t => {
                      const cat = t.category || 'Autre';
                      cats[cat] = (cats[cat] || 0) + Math.abs(t.amount);
                    });
                    return Object.entries(cats)
                      .sort((a, b) => b[1] - a[1])
                      .map(([cat, amount]) => (
                        <div key={cat} className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/10 text-white">
                          <span className="text-sm font-medium text-foreground/90 truncate mr-2" title={cat}>{cat}</span>
                          <span className="font-mono font-bold text-sm shrink-0">{formatCurrency(amount, { showSign: false })}</span>
                        </div>
                      ));
                  })()}
                </div>
              </div>

              {/* Transactions List */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-border/40 pb-2">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  <h3 className="font-bold text-sm text-foreground">Détail des transactions</h3>
                </div>
                
                <div className="space-y-2">
                  {activeDay.transactions.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-white/20 transition-all backdrop-blur-xl shadow-sm group">
                      <div className="min-w-0 flex-1 mr-4">
                        <div className="font-semibold text-sm text-white truncate group-hover:text-purple-300 transition-colors" title={t.description}>
                          {t.description}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                           <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium truncate max-w-[120px]">
                             {t.category}
                           </span>
                           <span className="text-[11px] text-muted-foreground">
                             {formatDateFR(t.date)}
                           </span>
                        </div>
                      </div>
                      <div className="font-mono font-black text-sm shrink-0 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {formatCurrency(Math.abs(t.amount), { showSign: false })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
};
