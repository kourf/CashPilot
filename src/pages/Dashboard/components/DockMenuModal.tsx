import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  LayoutDashboard, 
  Landmark, 
  Receipt, 
  Sparkles, 
  Settings, 
  ChevronRight 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface DockMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DockMenuModal: React.FC<DockMenuModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  const links = [
    { label: 'Accueil', path: '/', icon: LayoutDashboard, desc: 'Cockpit financier & vue 360' },
    { label: 'Relevés bancaires', path: '/releves', icon: Landmark, desc: 'Historique, imports & soldes' },
    { label: 'Ticket de caisse', path: '/tickets', icon: Receipt, desc: 'Comparateur de prix & optimisation' },
    { label: 'Coach IA', path: '/coach', icon: Sparkles, desc: 'Conseils personnalisés & audits' },
    { label: 'Paramètres', path: '/parametres', icon: Settings, desc: 'Comptes, devises & sécurité' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-24 px-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-md"
          />

          {/* Menu Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-[390px] rounded-[32px] bg-white/95 backdrop-blur-3xl border border-white/80 shadow-[0_24px_60px_rgba(0,0,0,0.3)] p-5 z-10 space-y-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Menu de Navigation
              </span>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Links list */}
            <div className="space-y-1.5">
              {links.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      onClose();
                      navigate(item.path);
                    }}
                    className="w-full p-2.5 rounded-2xl hover:bg-slate-100/80 transition-all flex items-center justify-between group text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-700 group-hover:scale-105 group-hover:text-emerald-600 transition-all shrink-0">
                        <Icon size={17} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-emerald-700 truncate">
                          {item.label}
                        </h4>
                        <p className="text-[10px] text-slate-400 truncate">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={15} className="text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
                  </button>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
