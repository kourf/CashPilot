import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Sparkles, 
  TrendingDown, 
  Receipt, 
  Layers, 
  CreditCard, 
  ArrowRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SavingsAlertsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  alertsCount?: number;
}

export const SavingsAlertsDrawer: React.FC<SavingsAlertsDrawerProps> = ({
  isOpen,
  onClose,
  alertsCount = 18
}) => {
  const navigate = useNavigate();

  const mockAlerts = [
    {
      id: 1,
      category: 'Abonnements & Médias',
      icon: Layers,
      title: 'Netflix Family + Spotify récurrent',
      potentialGain: '14,99 € / mois',
      description: 'Détecté depuis 4 mois sans variation. Un forfait groupé ou annuel réduirait ce coût.',
      type: 'sub'
    },
    {
      id: 2,
      category: 'Courses Alimentaires (Tickets)',
      icon: Receipt,
      title: 'Écart de prix sur les produits laitiers & bio',
      potentialGain: '28,40 € / mois',
      description: 'Prix supérieur de 18% par rapport à l’enseigne concurrente identifiée par le comparateur.',
      type: 'grocery'
    },
    {
      id: 3,
      category: 'Frais Bancaires',
      icon: CreditCard,
      title: 'Commissions de tenue de compte & agios',
      potentialGain: '12,50 € / mois',
      description: 'Frais récurrents prélevés le 10 du mois pouvant être neutralisés auprès de votre banque.',
      type: 'fee'
    },
    {
      id: 4,
      category: 'Énergie & Télécoms',
      icon: TrendingDown,
      title: 'Abonnement mobile 5G surdimensionné',
      potentialGain: '15,00 € / mois',
      description: 'Consommation data moyenne < 15 Go sur un forfait facturé 29,99 €/mois.',
      type: 'energy'
    }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 transition-opacity"
          />

          {/* Slide-over Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed inset-y-0 right-0 w-full max-w-md bg-white/90 backdrop-blur-3xl border-l border-white/60 shadow-2xl z-50 flex flex-col justify-between overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-200/60 bg-gradient-to-b from-white to-white/70">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-600 flex items-center justify-center">
                    <Sparkles size={18} />
                  </span>
                  <div>
                    <span className="text-[10px] font-bold tracking-widest text-emerald-600 uppercase">
                      Coach IA • Optimisations
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 leading-tight">
                      {alertsCount} Économies Détectées
                    </h3>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Total Potential Gain Banner */}
              <div className="mt-4 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-600 font-medium block">Gain estimé cumulé</span>
                  <span className="text-xl font-black text-emerald-600">+70,89 € / mois</span>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500 text-white shadow-sm shadow-emerald-500/30">
                  Activé
                </span>
              </div>
            </div>

            {/* Alerts List */}
            <div className="p-6 overflow-y-auto space-y-3.5 flex-1 custom-scrollbar">
              {mockAlerts.map((alert) => {
                const Icon = alert.icon;
                return (
                  <div
                    key={alert.id}
                    className="p-4 rounded-2xl bg-white/80 border border-slate-200/70 shadow-sm hover:shadow-md transition-all space-y-2 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                          <Icon size={16} />
                        </div>
                        <div>
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                            {alert.category}
                          </span>
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                            {alert.title}
                          </h4>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg shrink-0">
                        {alert.potentialGain}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed pl-10">
                      {alert.description}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-200/60 bg-white/80 flex flex-col gap-2">
              <button
                onClick={() => {
                  onClose();
                  navigate('/coach');
                }}
                className="w-full py-3.5 rounded-2xl bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-slate-900/15 transition-all active:scale-[0.98]"
              >
                <span>Accéder au Diagnostic Coach IA Complet</span>
                <ArrowRight size={15} />
              </button>
              <button
                onClick={onClose}
                className="w-full py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
              >
                Fermer
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
