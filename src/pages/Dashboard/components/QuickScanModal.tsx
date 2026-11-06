import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Receipt, Sparkles, ArrowRight, UploadCloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface QuickScanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickScanModal: React.FC<QuickScanModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/45 backdrop-blur-md"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-sm rounded-[32px] bg-white/95 backdrop-blur-3xl border border-white/80 shadow-[0_24px_50px_rgba(0,0,0,0.25)] p-6 z-10 space-y-5"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-600 flex items-center justify-center">
                  <UploadCloud size={19} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    Scanner un document
                  </h3>
                  <p className="text-[11px] text-slate-400">Ajout instantané à votre cockpit</p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <button
                onClick={() => {
                  onClose();
                  navigate('/releves');
                }}
                className="w-full p-4 rounded-2xl bg-slate-50 hover:bg-emerald-50/50 border border-slate-200/80 hover:border-emerald-300 transition-all flex items-center justify-between group text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-emerald-600 shrink-0 group-hover:scale-105 transition-transform">
                    <FileText size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-emerald-700">
                      Relevé bancaire (PDF / CSV)
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Mise à jour des soldes, dépenses & flux
                    </p>
                  </div>
                </div>
                <ArrowRight size={15} className="text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
              </button>

              <button
                onClick={() => {
                  onClose();
                  navigate('/tickets');
                }}
                className="w-full p-4 rounded-2xl bg-slate-50 hover:bg-indigo-50/50 border border-slate-200/80 hover:border-indigo-300 transition-all flex items-center justify-between group text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-indigo-600 shrink-0 group-hover:scale-105 transition-transform">
                    <Receipt size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-indigo-700">
                      Ticket de caisse & courses
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Comparateur de prix & détection promos
                    </p>
                  </div>
                </div>
                <ArrowRight size={15} className="text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
