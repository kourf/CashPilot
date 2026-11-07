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
    { 
      icon: LayoutDashboard, 
      label: 'Accueil', 
      desktopLabel: 'Accueil',
      tabletLabel: 'Accueil',
      mobileLabel: 'Accueil',
      path: '/' 
    },
    { 
      icon: Landmark, 
      label: 'Relevé bancaire', 
      desktopLabel: 'Relevé bancaire',
      tabletLabel: 'Relevés',
      mobileLabel: 'Relevés',
      path: '/releves' 
    },
    { 
      icon: Receipt, 
      label: 'Ticket de caisse', 
      desktopLabel: 'Ticket de caisse',
      tabletLabel: 'Tickets',
      mobileLabel: 'Tickets',
      path: '/tickets' 
    },
    { 
      icon: Sparkles, 
      label: 'Coach IA', 
      desktopLabel: 'Coach IA',
      tabletLabel: 'Coach IA',
      mobileLabel: 'Coach IA',
      path: '/coach',
      isAi: true
    },
    { 
      icon: Settings, 
      label: 'Paramètres', 
      desktopLabel: 'Paramètres',
      tabletLabel: 'Paramètres',
      mobileLabel: 'Paramètres',
      path: '/parametres' 
    },
  ];

  return (
    <nav className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-50 select-none max-w-fit mx-auto transition-all">
      <div className="rounded-full bg-[#052418]/90 hover:bg-[#052418]/95 backdrop-blur-3xl border border-white/25 shadow-[0_20px_50px_rgba(0,0,0,0.65),inset_0_1px_1.5px_rgba(255,255,255,0.35)] p-1.5 sm:p-2 flex items-center justify-center gap-1 sm:gap-1.5 transition-all">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path !== '/' && location.pathname.startsWith(item.path));

          return (
            <Link
              key={item.path}
              to={item.path}
              title={item.label}
              className={cn(
                "relative flex items-center gap-1.5 sm:gap-2 py-2 px-3 sm:px-4 rounded-full transition-all duration-300 cursor-pointer active:scale-95 group",
                isActive
                  ? "bg-gradient-to-r from-[#DCF5E9] via-[#D1FAE5] to-[#B9F1DC] text-[#06331E] font-black shadow-[0_2px_14px_rgba(52,211,153,0.4)] border border-white/90 scale-100"
                  : "text-white/80 hover:text-white hover:bg-white/10 font-medium"
              )}
            >
              <item.icon 
                size={18} 
                className={cn(
                  "shrink-0 transition-transform duration-200 group-hover:scale-110",
                  isActive ? "text-[#06331E] stroke-[2.6]" : (item.isAi ? "text-emerald-300 stroke-[2.2]" : "stroke-[2]"),
                  item.isAi && isCoachLoading && "animate-spin"
                )} 
              />
              
              {/* Libellé dynamique : Plein texte sur Desktop, court sur tablette, actif sur mobile */}
              <span className={cn(
                "text-xs truncate transition-all duration-200",
                isActive 
                  ? "inline font-black text-[#06331E]" 
                  : "hidden sm:inline text-white/85 font-medium"
              )}>
                <span className="hidden lg:inline">{item.desktopLabel}</span>
                <span className="lg:hidden">{item.tabletLabel}</span>
              </span>

              {item.isAi && isCoachLoading && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shadow-[0_0_8px_#34d399]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
