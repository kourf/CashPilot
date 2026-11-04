import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  Layers, 
  Sparkles,
  Clock
} from 'lucide-react';
import { formatMonthLabel } from '../lib/kpiUtils';
import { cn } from '../lib/utils';

interface MonthSelectorProps {
  selectedMonth: string;
  onChange: (month: string) => void;
  availableMonths: string[];
  transactionsCountByMonth?: Record<string, number>;
  totalTransactionsCount?: number;
  className?: string;
}

export const MonthSelector: React.FC<MonthSelectorProps> = ({
  selectedMonth,
  onChange,
  availableMonths,
  transactionsCountByMonth = {},
  totalTransactionsCount = 0,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const currentIndex = availableMonths.indexOf(selectedMonth);

  // Quick arrow navigation (availableMonths is sorted descending: [Oct 2026, Sept 2026, ...])
  // Next in time (newer) = index - 1
  // Prev in time (older) = index + 1
  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedMonth === 'all') {
      if (availableMonths.length > 0) onChange(availableMonths[0]);
      return;
    }
    if (currentIndex < availableMonths.length - 1) {
      onChange(availableMonths[currentIndex + 1]);
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedMonth === 'all') return;
    if (currentIndex > 0) {
      onChange(availableMonths[currentIndex - 1]);
    } else if (currentIndex === 0) {
      onChange('all');
    }
  };

  const isAll = selectedMonth === 'all';
  const canGoPrev = !isAll ? currentIndex < availableMonths.length - 1 : availableMonths.length > 0;
  const canGoNext = !isAll;

  const currentLabel = isAll ? 'Tous les mois' : formatMonthLabel(selectedMonth);

  return (
    <div className={cn("relative inline-flex items-center", className)} ref={dropdownRef}>
      
      {/* Container capsule with glassmorphic depth */}
      <div className="flex items-center rounded-2xl bg-slate-900/70 hover:bg-slate-900/90 backdrop-blur-2xl border border-white/15 hover:border-cyan-500/40 shadow-[0_8px_24px_rgba(0,0,0,0.45),inset_0_1px_1px_rgba(255,255,255,0.12)] p-1 transition-all duration-300">
        
        {/* Quick Previous Month Button (remonter dans le passé) */}
        <button
          type="button"
          onClick={handlePrev}
          disabled={!canGoPrev}
          title={isAll ? "Basculer sur le dernier mois" : "Mois précédent"}
          className={cn(
            "w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200",
            canGoPrev 
              ? "text-slate-300 hover:text-white hover:bg-white/[0.12] active:scale-95" 
              : "text-slate-600 cursor-not-allowed opacity-40"
          )}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Central Trigger Pill Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/[0.08] transition-all duration-200 group focus:outline-none"
        >
          <div className="relative flex items-center justify-center">
            <span className={cn(
              "w-2 h-2 rounded-full transition-all duration-300",
              isAll 
                ? "bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.9)]" 
                : "bg-cyan-400 shadow-[0_0_12px_rgba(56,189,248,0.9)] animate-pulse"
            )} />
          </div>

          <div className="flex items-center gap-2 text-left">
            <Calendar className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs sm:text-sm font-bold text-white tracking-tight group-hover:text-cyan-200 transition-colors">
              {currentLabel}
            </span>
          </div>

          <span className={cn(
            "text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all",
            isAll 
              ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/25" 
              : "bg-cyan-500/15 text-cyan-300 border-cyan-500/25"
          )}>
            {isAll ? "Global" : "Mensuel"}
          </span>

          <ChevronDown className={cn(
            "w-4 h-4 text-slate-400 transition-transform duration-300 group-hover:text-white",
            isOpen ? "transform rotate-180 text-cyan-400" : ""
          )} />
        </button>

        {/* Quick Next Month Button (avancer vers le présent) */}
        <button
          type="button"
          onClick={handleNext}
          disabled={!canGoNext}
          title={isAll ? "Déjà sur la vue globale" : currentIndex === 0 ? "Basculer sur tous les mois" : "Mois suivant"}
          className={cn(
            "w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200",
            canGoNext 
              ? "text-slate-300 hover:text-white hover:bg-white/[0.12] active:scale-95" 
              : "text-slate-600 cursor-not-allowed opacity-40"
          )}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* High-End Glassmorphic Popover Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute right-0 top-full mt-2.5 w-72 sm:w-80 rounded-3xl bg-[#090d1a]/95 backdrop-blur-3xl border border-white/20 shadow-[0_24px_64px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.2)] p-2.5 z-50 overflow-hidden"
          >
            {/* Popover Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 mb-1.5">
              <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-cyan-400" /> Période d'analyse
              </span>
              <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/15 border border-cyan-500/25 px-2 py-0.5 rounded-full">
                {availableMonths.length} mois archivés
              </span>
            </div>

            {/* "Tous les mois" Special Row */}
            <button
              type="button"
              onClick={() => {
                onChange('all');
                setIsOpen(false);
              }}
              className={cn(
                "w-full flex items-center justify-between p-2.5 rounded-2xl text-left transition-all duration-200 group mb-1.5",
                isAll 
                  ? "bg-gradient-to-r from-cyan-500/25 to-indigo-500/25 border border-cyan-500/40 text-white shadow-[0_0_15px_rgba(56,189,248,0.2)]" 
                  : "hover:bg-white/[0.08] text-slate-200 border border-transparent"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-all",
                  isAll 
                    ? "bg-cyan-500 text-white border-cyan-400 shadow-md shadow-cyan-500/40" 
                    : "bg-white/[0.06] border-white/10 text-slate-400 group-hover:text-white group-hover:bg-white/[0.12]"
                )}>
                  <Layers className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-extrabold truncate">Tous les mois</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Consolidé
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">
                    {totalTransactionsCount > 0 ? `${totalTransactionsCount} opérations totales` : 'Vision patrimoniale globale'}
                  </p>
                </div>
              </div>

              {isAll && (
                <div className="w-5 h-5 rounded-full bg-cyan-400 text-[#090d1a] flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}
            </button>

            <div className="h-px bg-white/10 my-1 mx-2" />

            {/* Individual Months List */}
            <div className="max-h-64 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {availableMonths.map((monthKey) => {
                const isSelected = selectedMonth === monthKey;
                const count = transactionsCountByMonth[monthKey];

                return (
                  <button
                    key={monthKey}
                    type="button"
                    onClick={() => {
                      onChange(monthKey);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between p-2 rounded-2xl text-left transition-all duration-150 group",
                      isSelected 
                        ? "bg-cyan-500/20 border border-cyan-500/40 text-white shadow-sm" 
                        : "hover:bg-white/[0.07] text-slate-300 border border-transparent"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={cn(
                        "w-2 h-2 rounded-full transition-transform",
                        isSelected 
                          ? "bg-cyan-400 shadow-[0_0_8px_rgba(56,189,248,0.9)] scale-110" 
                          : "bg-white/20 group-hover:bg-cyan-400/60"
                      )} />
                      <div className="min-w-0">
                        <span className={cn(
                          "text-xs sm:text-sm font-bold block truncate",
                          isSelected ? "text-cyan-200" : "text-slate-200 group-hover:text-white"
                        )}>
                          {formatMonthLabel(monthKey)}
                        </span>
                        {count !== undefined && (
                          <span className="text-[10px] text-slate-400 block">
                            {count} opération{count > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-cyan-400/20 border border-cyan-400 text-cyan-300 flex items-center justify-center">
                          <Check className="w-3 h-3 stroke-[2.5]" />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer quick action */}
            <div className="pt-2 mt-1.5 border-t border-white/10 flex items-center justify-between px-2 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-400" /> Synchronisé en direct
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-cyan-400 hover:text-cyan-300 font-bold"
              >
                Fermer
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
