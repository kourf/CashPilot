import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Landmark, 
  Receipt, 
  Sparkles, 
  Settings 
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useCoach } from '../../../context/CoachContext';

export const FloatingNavDock: React.FC = () => {
  const location = useLocation();
  const coachContext = useCoach();
  const isCoachLoading = coachContext?.isLoading;

  const navItems = [
    { icon: LayoutDashboard, label: 'Accueil', shortLabel: 'Accueil', path: '/' },
    { icon: Landmark, label: 'Relevé bancaire', shortLabel: 'Relevés', path: '/releves' },
    { icon: Receipt, label: 'Ticket de caisse', shortLabel: 'Tickets', path: '/tickets' },
    { icon: Sparkles, label: 'Coach IA', shortLabel: 'Coach IA', path: '/coach', isCenterLens: true },
    { icon: Settings, label: 'Paramètres', shortLabel: 'Paramètres', path: '/parametres' },
  ];

  return (
    <nav className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-50 select-none max-w-lg sm:max-w-2xl w-auto">
      <div className="rounded-full bg-[#062418]/90 hover:bg-[#062418]/95 backdrop-blur-3xl border border-white/25 shadow-[0_24px_50px_rgba(2,18,11,0.8),inset_0_1px_1px_rgba(255,255,255,0.3)] px-2 sm:px-3 py-1.5 flex items-center justify-between sm:justify-center gap-1 sm:gap-2 transition-all">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path !== '/' && location.pathname.startsWith(item.path));

          // Bouton Central Spécial : Lentille Orbe Coach IA (Inspiration Ron Design Image 5/7)
          if (item.isCenterLens) {
            return (
              <Link
                key={item.path}
                to={item.path}
                title={item.label}
                className={cn(
                  "relative w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-300 active:scale-90 cursor-pointer shrink-0 mx-1",
                  isActive
                    ? "bg-gradient-to-tr from-white via-[#DCF5E9] to-[#86EFAC] text-[#062D1C] shadow-[0_0_24px_rgba(52,211,153,0.85)] border border-white scale-105"
                    : "bg-gradient-to-tr from-white/90 via-[#E0F8EE] to-[#B8F0D8] text-[#083020] shadow-[0_0_16px_rgba(52,211,153,0.5)] border border-white/90 hover:scale-105"
                )}
              >
                <item.icon size={20} className={cn("stroke-[2.5]", isCoachLoading && "animate-spin")} />
                {isCoachLoading && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shadow-[0_0_8px_#34d399]" />
                )}
              </Link>
            );
          }

          // Autres Boutons : Pilule Givrée Menthe Ron Design si actif, Dépoli satiné si inactif
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "relative flex items-center gap-1.5 py-2 px-3 sm:px-4 rounded-full transition-all duration-300 cursor-pointer active:scale-95 group",
                isActive
                  ? "bg-gradient-to-r from-[#DCF5E9] via-[#D1FAE5] to-[#B9F1DC] text-[#06331E] font-black shadow-[0_2px_12px_rgba(52,211,153,0.35)] border border-white/90"
                  : "text-white/75 hover:text-white hover:bg-white/10 font-medium"
              )}
            >
              <item.icon 
                size={17} 
                className={cn(
                  "transition-transform group-hover:scale-105",
                  isActive ? "text-[#06331E] stroke-[2.6]" : "stroke-[2]"
                )} 
              />
              <span className={cn(
                "text-xs truncate transition-all duration-200",
                isActive ? "inline font-black text-[#06331E]" : "hidden sm:inline text-white/80 font-medium"
              )}>
                {item.shortLabel}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
