import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Landmark, 
  Receipt, 
  Sparkles, 
  Settings,
  LayoutGrid,
  X,
  ScanLine
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useCoach } from '../../../context/CoachContext';

/**
 * Barre flottante inférieure conforme à la Direction Artistique Ron Design (Photos 1/7 et 5/7) :
 * - Posée sur la zone vert émeraude en bas de l'écran
 * - Capsule en verre dépoli (blanc translucide)
 * - À gauche : grand bouton gélule menthe givrée avec icône et texte clair
 * - À droite : deux boutons parfaitement ronds en verre translucide (Coach IA & Menu rapide des onglets)
 */
export const FloatingNavDock: React.FC = () => {
  const location = useLocation();
  const coachContext = useCoach();
  const isCoachLoading = coachContext?.isLoading;
  const [isGridMenuOpen, setIsGridMenuOpen] = useState(false);

  // Détection de l'onglet actif
  const currentPath = location.pathname;
  let activeTabName = 'Accueil';
  let ActiveIcon = LayoutDashboard;

  if (currentPath.startsWith('/releves')) {
    activeTabName = 'Relevé bancaire';
    ActiveIcon = Landmark;
  } else if (currentPath.startsWith('/tickets')) {
    activeTabName = 'Ticket de caisse';
    ActiveIcon = Receipt;
  } else if (currentPath.startsWith('/coach')) {
    activeTabName = 'Coach IA';
    ActiveIcon = Sparkles;
  } else if (currentPath.startsWith('/parametres')) {
    activeTabName = 'Paramètres';
    ActiveIcon = Settings;
  }

  const allTabs = [
    { name: 'Accueil', path: '/', icon: LayoutDashboard, desc: 'Tableau de bord financier' },
    { name: 'Relevé bancaire', path: '/releves', icon: Landmark, desc: 'Comptes & transactions' },
    { name: 'Ticket de caisse', path: '/tickets', icon: Receipt, desc: 'Courses & comparateur prix' },
    { name: 'Coach IA', path: '/coach', icon: Sparkles, desc: 'Diagnostic & conseils financiers' },
    { name: 'Paramètres', path: '/parametres', icon: Settings, desc: 'Règles & préférences' }
  ];

  return (
    <>
      {/* Popover Menu Grille Déplié (au clic sur le bouton grille 3x3) */}
      {isGridMenuOpen && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsGridMenuOpen(false)}
          />
          <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 z-50 w-[92vw] max-w-sm rounded-[32px] bg-[#072418]/95 backdrop-blur-3xl border border-white/20 p-4 shadow-[0_25px_60px_rgba(0,0,0,0.8)] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 px-2 border-b border-white/10 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                Navigation CashPilot
              </span>
              <button 
                onClick={() => setIsGridMenuOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-1.5">
              {allTabs.map(tab => {
                const isCurrent = (tab.path === '/' && currentPath === '/') || 
                                  (tab.path !== '/' && currentPath.startsWith(tab.path));
                const Icon = tab.icon;
                return (
                  <Link
                    key={tab.path}
                    to={tab.path}
                    onClick={() => setIsGridMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3.5 py-2.5 rounded-2xl transition-all duration-200 group cursor-pointer",
                      isCurrent 
                        ? "bg-gradient-to-r from-[#DCF5E9] via-[#D1FAE5] to-[#B9F1DC] text-[#06331E] font-black shadow-md border border-white/80" 
                        : "text-white/80 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105",
                      isCurrent ? "bg-[#06331E] text-white" : "bg-white/10 text-emerald-400"
                    )}>
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold leading-tight">{tab.name}</div>
                      <div className={cn(
                        "text-[10px] truncate",
                        isCurrent ? "text-[#06331E]/70" : "text-white/50"
                      )}>
                        {tab.desc}
                      </div>
                    </div>
                    {isCurrent && (
                      <span className="w-2 h-2 rounded-full bg-[#06331E]" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Dock Navigation Principal Flottant */}
      <nav className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 z-40 select-none max-w-sm sm:max-w-md w-[92vw] sm:w-auto">
        <div className="rounded-full bg-white/[0.12] hover:bg-white/[0.16] backdrop-blur-2xl border border-white/25 shadow-[0_20px_50px_rgba(2,18,11,0.65),inset_0_1px_1.5px_rgba(255,255,255,0.35)] p-1.5 flex items-center justify-between gap-2 transition-all">
          
          {/* GAUCHE : Grand bouton en forme de gélule avec icône et texte clair (Ron Design) */}
          <Link
            to={currentPath === '/' ? '/releves' : '/'}
            className="flex-1 flex items-center justify-center gap-2.5 px-5 sm:px-6 py-2.5 rounded-full bg-gradient-to-r from-[#DCF5E9] via-[#D1FAE5] to-[#B9F1DC] hover:from-white hover:to-[#DCF5E9] text-[#06331E] font-black text-xs sm:text-sm shadow-[0_4px_16px_rgba(52,211,153,0.35)] border border-white/90 transition-all duration-300 active:scale-95 group shrink-0"
            title={currentPath === '/' ? "Aller au Relevé bancaire" : "Retour à l'Accueil"}
          >
            <ActiveIcon size={18} className="text-[#06331E] stroke-[2.8] transition-transform group-hover:scale-110" />
            <span className="truncate tracking-tight font-extrabold">{activeTabName}</span>
          </Link>

          {/* DROITE : 2 boutons parfaitement ronds en verre translucide (Ron Design) */}
          <div className="flex items-center gap-2 shrink-0">
            
            {/* Bouton Rond 1 : Orbe Coach IA avec halo lumineux */}
            <Link
              to="/coach"
              title="Coach IA"
              className={cn(
                "w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-300 active:scale-90 cursor-pointer relative",
                currentPath.startsWith('/coach')
                  ? "bg-gradient-to-tr from-white via-[#DCF5E9] to-[#86EFAC] text-[#062D1C] shadow-[0_0_24px_rgba(52,211,153,0.85)] border border-white scale-105"
                  : "bg-white/20 hover:bg-white/30 backdrop-blur-xl border border-white/35 text-white shadow-sm hover:scale-105"
              )}
            >
              <Sparkles size={18} className={cn("stroke-[2.5]", isCoachLoading && "animate-spin text-emerald-300")} />
              {isCoachLoading ? (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shadow-[0_0_8px_#34d399]" />
              ) : (
                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-emerald-400/80" />
              )}
            </Link>

            {/* Bouton Rond 2 : Grille d'onglets pour navigation instantanée */}
            <button
              type="button"
              onClick={() => setIsGridMenuOpen(!isGridMenuOpen)}
              title="Menu des onglets"
              className={cn(
                "w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-300 active:scale-90 cursor-pointer bg-white/20 hover:bg-white/30 backdrop-blur-xl border border-white/35 text-white shadow-sm hover:scale-105",
                isGridMenuOpen && "bg-white/40 border-white text-emerald-300"
              )}
            >
              <LayoutGrid size={18} className="stroke-[2.2]" />
            </button>

          </div>

        </div>
      </nav>
    </>
  );
};
