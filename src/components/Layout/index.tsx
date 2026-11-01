import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Landmark, 
  Receipt, 
  MessageSquareHeart, 
  Settings,
  Sparkles,
  ShieldCheck,
  Loader2,
  LogOut,
  RefreshCw
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { ThemeToggle } from '../ThemeToggle';
import { useTransactions } from '../../context/TransactionsContext';
import { useCoach } from '../../context/CoachContext';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { icon: LayoutDashboard, label: 'Accueil', shortLabel: 'Accueil', path: '/' },
  { icon: Landmark, label: 'Relevé bancaire', shortLabel: 'Relevés', path: '/releves' },
  { icon: Receipt, label: 'Ticket de caisse', shortLabel: 'Tickets', path: '/tickets' },
  { icon: MessageSquareHeart, label: 'Coach IA', shortLabel: 'Coach IA', path: '/coach', badge: 'IA' },
  { icon: Settings, label: 'Paramètres', shortLabel: 'Paramètres', path: '/parametres' },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userProfile, logout } = useAuth();
  const txContext = useTransactions();
  const coachContext = useCoach();
  const importState = txContext?.importState;
  const appNotification = txContext?.appNotification;
  const isCoachLoading = coachContext?.isLoading;

  const userInitials = (userProfile?.displayName || userProfile?.email || 'CP')
    .slice(0, 2)
    .toUpperCase();

  const [isRefreshingApp, setIsRefreshingApp] = useState(false);

  const handleForceRefresh = async () => {
    setIsRefreshingApp(true);
    try {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }
      if (typeof window !== 'undefined' && 'caches' in window) {
        const keys = await caches.keys();
        for (const k of keys) {
          await caches.delete(k);
        }
      }
    } catch (e) {
      console.warn('[CashPilot] Erreur refresh:', e);
    }
    if (typeof window !== 'undefined') {
      window.location.href = window.location.origin + window.location.pathname + '?v=' + Date.now();
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/bienvenue', { replace: true });
  };

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/': return { title: 'Tableau de bord', subtitle: 'Aperçu global de votre patrimoine et flux' };
      case '/releves': return { title: 'Relevés Bancaires', subtitle: 'Analyse et historique multi-comptes' };
      case '/tickets': return { title: 'Tickets & Courses', subtitle: 'Optimisation alimentaire et comparateur' };
      case '/coach': return { title: 'Coach Financier IA', subtitle: 'Conseils personnalisés d’optimisation' };
      case '/parametres': return { title: 'Paramètres', subtitle: 'Préférences et gestion des données' };
      default: return { title: 'CashPilot', subtitle: 'Gestion financière intelligente' };
    }
  };

  const pageInfo = getPageTitle();

  return (
    <div className="flex h-screen overflow-hidden flex-col md:flex-row antialiased liquid-mesh text-slate-100 selection:bg-cyan-500/20 selection:text-cyan-400 transition-colors duration-300">
      
      {/* Desktop Sidebar (Apple VisionOS / Liquid Glass aesthetic) */}
      <aside className="hidden md:flex flex-col w-64 border-r border-white/10 backdrop-blur-2xl p-4 justify-between z-30 bg-slate-950/25 text-slate-100 shadow-[4px_0_24px_rgba(0,0,0,0.3)]">
        <div className="space-y-6">
          {/* Brand Header */}
          <Link to="/" className="flex items-center gap-3 px-2 group">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 via-primary to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/25 group-hover:scale-105 transition-transform duration-300 border border-white/20">
              <Landmark size={20} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                  CashPilot
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                  PRO
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-400">Finance & Patrimoine</p>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="space-y-1.5 pt-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || 
                (item.path !== '/' && location.pathname.startsWith(item.path));
              const isCoachTab = item.path === '/coach';
                
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative cursor-pointer",
                    isActive 
                      ? "bg-white/[0.14] text-white shadow-[0_2px_14px_rgba(56,189,248,0.25)] border border-white/20 font-semibold" 
                      : "text-slate-300 hover:text-white hover:bg-white/[0.07] border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <item.icon 
                      size={18} 
                      className={cn(
                        "transition-transform duration-200 group-hover:scale-110",
                        isActive ? "text-cyan-400 stroke-[2.5]" : "text-slate-400 group-hover:text-slate-200"
                      )} 
                    />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span className={cn(
                      "text-[10px] font-bold px-1.5 py-0.2 rounded-full flex items-center gap-1",
                      isActive ? "bg-white/20 text-white" : "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                    )}>
                      {isCoachTab && isCoachLoading ? (
                        <Loader2 size={10} className="animate-spin text-cyan-400" />
                      ) : (
                        <Sparkles size={10} />
                      )}
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="space-y-3 pt-4 border-t border-white/10">
          <ThemeToggle variant="expanded" />

          {userProfile && (
            <div className="px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.05] flex items-center justify-between gap-2 transition-colors">
              <div className="flex items-center gap-2.5 min-w-0">
                {userProfile.photoURL ? (
                  <img
                    src={userProfile.photoURL}
                    alt={userProfile.displayName || 'Profil'}
                    className="w-7 h-7 rounded-full object-cover border border-cyan-500/30 shrink-0"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-500/20 to-primary/20 border border-cyan-500/30 flex items-center justify-center text-[10px] font-bold text-cyan-300 shrink-0">
                    {userInitials}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold truncate text-white">
                      {userProfile.displayName || 'Utilisateur'}
                    </p>
                    {userProfile.isAdmin && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">
                        Admin
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] truncate text-slate-400">
                    {userProfile.activeWorkspace ? `Espace : ${userProfile.activeWorkspace}` : userProfile.email}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                title="Se déconnecter"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0 cursor-pointer"
              >
                <LogOut size={14} />
              </button>
            </div>
          )}

          <div className="px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03] flex items-center justify-between transition-colors">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
              <span className="text-[11px] font-medium text-slate-300">UID Isolé & Chiffré</span>
            </div>
            <ShieldCheck size={14} className="text-emerald-400" />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Top Sticky Header */}
        <header className="h-16 px-4 md:px-8 border-b border-white/10 backdrop-blur-xl flex items-center justify-between z-20 shrink-0 bg-slate-950/20 text-white shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
          <div>
            <h2 className="text-base md:text-lg font-bold tracking-tight text-white flex items-center gap-2">
              {pageInfo.title}
            </h2>
            <p className="hidden sm:block text-xs text-slate-400">
              {pageInfo.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Bouton de mise à jour instantanée & purge cache (idéal pour PWA smartphone) */}
            <button
              onClick={handleForceRefresh}
              title="Vider le cache et charger la dernière version"
              disabled={isRefreshingApp}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl text-slate-300 hover:text-cyan-300 hover:bg-white/[0.08] border border-white/10 flex items-center gap-1.5 text-xs transition-all active:scale-95 cursor-pointer bg-white/[0.04]"
            >
              <RefreshCw size={14} className={cn("text-cyan-400 shrink-0", isRefreshingApp && "animate-spin")} />
              <span className="text-[11px] font-bold text-cyan-300 sm:inline">v2.4</span>
            </button>

            <ThemeToggle variant="compact" />

            <div className="flex items-center gap-2 pl-3 border-l border-white/10">
              {userProfile?.photoURL ? (
                <img
                  src={userProfile.photoURL}
                  alt={userProfile.displayName || 'Profil'}
                  className="w-8 h-8 rounded-full object-cover border border-cyan-500/30"
                />
              ) : (
                <div
                  title={userProfile?.email || 'Compte connecté'}
                  className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500/20 to-primary/20 border border-cyan-500/30 flex items-center justify-center text-xs font-bold text-cyan-300"
                >
                  {userInitials}
                </div>
              )}
              <button
                onClick={handleLogout}
                title="Se déconnecter"
                className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        {/* Page Container */}
        <main className="flex-1 overflow-y-auto pb-36 sm:pb-32 md:pb-8 relative touch-scroll">
          <Outlet />
        </main>
      </div>

      {/* Bottom Navigation for Mobile (Apple VisionOS / iOS 26 Floating Liquid Glass) */}
      <nav className="md:hidden fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] inset-x-3 max-w-lg mx-auto z-50 pointer-events-none select-none">
        <div className="pointer-events-auto rounded-[26px] bg-[#0c101d]/90 dark:bg-[#07090e]/90 backdrop-blur-2xl border border-white/20 dark:border-white/15 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.7),inset_0_1px_1.5px_0_rgba(255,255,255,0.35)] p-1.5 flex items-center justify-between gap-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== '/' && location.pathname.startsWith(item.path));
            const isCoachTab = item.path === '/coach';
              
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex-1 relative flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all duration-300 group cursor-pointer active:scale-95",
                  isActive
                    ? "bg-white/[0.14] dark:bg-white/[0.10] text-white shadow-[0_2px_12px_rgba(56,189,248,0.25)] border border-white/25 dark:border-white/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent"
                )}
              >
                {/* Active Indicator Top Specular Glow */}
                {isActive && (
                  <span className="absolute -top-[1px] inset-x-3 h-[1.5px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_8px_rgba(56,189,248,0.9)] rounded-full" />
                )}

                <div className="relative flex items-center justify-center">
                  <item.icon 
                    size={19} 
                    className={cn(
                      "transition-all duration-300",
                      isActive 
                        ? "text-cyan-400 dark:text-cyan-300 scale-110 stroke-[2.4] drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]" 
                        : "text-slate-400 group-hover:text-slate-200 stroke-[1.8]"
                    )} 
                  />
                  {isCoachTab && isCoachLoading && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-400 animate-ping shadow-[0_0_6px_rgba(56,189,248,1)]" />
                  )}
                  {item.badge && !isCoachLoading && (
                    <span className={cn(
                      "absolute -top-1.5 -right-2.5 text-[8px] font-black px-1 py-0.2 rounded-full uppercase leading-none tracking-wider",
                      isActive 
                        ? "bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-[0_0_6px_rgba(56,189,248,0.6)]" 
                        : "bg-white/15 text-slate-300 border border-white/10"
                    )}>
                      {item.badge}
                    </span>
                  )}
                </div>

                <span className={cn(
                  "text-[10px] mt-1 transition-colors duration-200 leading-tight",
                  isActive 
                    ? "font-bold text-white tracking-tight" 
                    : "font-medium text-slate-400 group-hover:text-slate-200"
                )}>
                  {item.shortLabel || item.label}
                </span>

                {/* Subtile Active Pill Dot */}
                {isActive && (
                  <span className="absolute bottom-1 w-3.5 h-0.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
      
      {/* Badge Flottant Persistant : Indique l'avancement du relevé même en changeant d'onglet */}
      {Boolean(importState?.isImporting) && location.pathname !== '/releves' && (
        <Link
          to="/releves"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white backdrop-blur-xl shadow-xl shadow-indigo-500/25 border border-white/20 text-xs font-semibold hover:scale-105 active:scale-95 transition-all group animate-pulse"
        >
          <div className="relative flex items-center justify-center">
            <Loader2 size={14} className="animate-spin text-white" />
            <Sparkles size={8} className="absolute -top-1 -right-1 text-amber-300 animate-bounce" />
          </div>
          <span>Analyse du relevé en cours</span>
          <span className="font-mono bg-white/20 px-2 py-0.5 rounded-full text-[11px] font-bold">
            {(importState?.aiAnalysisSeconds ?? 0).toFixed(1)}s
          </span>
          <span className="text-[10px] bg-white/15 px-1.5 py-0.5 rounded-md text-indigo-100 group-hover:bg-white/25">
            Voir →
          </span>
        </Link>
      )}

      {/* Badge Flottant Persistant : Indique que le Coach IA réfléchit en arrière-plan pendant la navigation inter-onglets (Chantier 1) */}
      {Boolean(isCoachLoading) && location.pathname !== '/coach' && !importState?.isImporting && (
        <Link
          to="/coach"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-600 via-primary to-indigo-600 text-white backdrop-blur-xl shadow-xl shadow-cyan-500/25 border border-white/20 text-xs font-semibold hover:scale-105 active:scale-95 transition-all group"
        >
          <div className="relative flex items-center justify-center">
            <Loader2 size={14} className="animate-spin text-white" />
            <Sparkles size={8} className="absolute -top-1 -right-1 text-cyan-200 animate-bounce" />
          </div>
          <span>Coach IA réfléchit en arrière-plan...</span>
          <span className="text-[10px] bg-white/15 px-1.5 py-0.5 rounded-md text-cyan-100 group-hover:bg-white/25">
            Ouvrir →
          </span>
        </Link>
      )}

      {/* Toast Notification Persistant multi-onglets */}
      {appNotification && location.pathname !== '/releves' && (
        <div className={cn(
          "fixed top-4 right-4 z-50 max-w-sm px-4 py-3 rounded-2xl shadow-luxury text-xs font-semibold flex items-center gap-3 backdrop-blur-xl border animate-in slide-in-from-top-4 fade-in duration-300",
          appNotification.type === 'success' ? "bg-emerald-600/95 text-white border-emerald-400/30 shadow-emerald-500/20" :
          appNotification.type === 'error' ? "bg-red-600/95 text-white border-red-400/30 shadow-red-500/20" :
          "bg-blue-600/95 text-white border-blue-400/30 shadow-blue-500/20"
        )}>
          <span>{appNotification.message}</span>
        </div>
      )}
    </div>
  );
}
