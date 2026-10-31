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
  LogOut
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
    <div className="flex h-screen bg-background text-foreground overflow-hidden flex-col md:flex-row antialiased selection:bg-primary/20 selection:text-primary">
      
      {/* Desktop Sidebar (Apple + HarmonyOS aesthetic) */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border/70 dark:border-white/[0.06] bg-card/60 dark:bg-[#0c0f17]/80 backdrop-blur-2xl p-4 justify-between z-30">
        <div className="space-y-6">
          {/* Brand Header */}
          <Link to="/" className="flex items-center gap-3 px-2 group">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center text-primary-foreground shadow-md shadow-primary/20 group-hover:scale-105 transition-transform duration-300">
              <Landmark size={20} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/75 bg-clip-text text-transparent">
                  CashPilot
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground font-medium">Finance & Patrimoine</p>
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
                    "flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative",
                    isActive 
                      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25 font-semibold" 
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/70 dark:hover:bg-white/[0.04]"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <item.icon 
                      size={18} 
                      className={cn(
                        "transition-transform duration-200 group-hover:scale-110",
                        isActive ? "text-primary-foreground stroke-[2.5]" : "text-muted-foreground group-hover:text-foreground"
                      )} 
                    />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span className={cn(
                      "text-[10px] font-bold px-1.5 py-0.2 rounded-full flex items-center gap-1",
                      isActive ? "bg-white/20 text-white" : "bg-primary/15 text-primary"
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
        <div className="space-y-3 pt-4 border-t border-border/60 dark:border-white/[0.05]">
          <ThemeToggle variant="expanded" />

          {userProfile && (
            <div className="px-3 py-2.5 rounded-xl bg-secondary/50 dark:bg-white/[0.03] border border-border/60 dark:border-white/[0.06] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                {userProfile.photoURL ? (
                  <img
                    src={userProfile.photoURL}
                    alt={userProfile.displayName || 'Profil'}
                    className="w-7 h-7 rounded-full object-cover border border-primary/30 shrink-0"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-primary/20 to-cyan-500/20 border border-primary/30 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                    {userInitials}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-foreground truncate">
                      {userProfile.displayName || 'Utilisateur'}
                    </p>
                    {userProfile.isAdmin && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">
                        Admin
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {userProfile.activeWorkspace ? `Espace : ${userProfile.activeWorkspace}` : userProfile.email}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                title="Se déconnecter"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0 cursor-pointer"
              >
                <LogOut size={14} />
              </button>
            </div>
          )}

          <div className="px-3 py-2 rounded-xl bg-secondary/40 dark:bg-white/[0.02] border border-border/50 dark:border-white/[0.04] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-medium text-muted-foreground">UID Isolé & Chiffré</span>
            </div>
            <ShieldCheck size={14} className="text-emerald-500" />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Top Sticky Header */}
        <header className="h-16 px-4 md:px-8 border-b border-border/70 dark:border-white/[0.06] bg-background/80 dark:bg-[#0a0d14]/80 backdrop-blur-xl flex items-center justify-between z-20 shrink-0">
          <div>
            <h2 className="text-base md:text-lg font-bold tracking-tight text-foreground">
              {pageInfo.title}
            </h2>
            <p className="hidden sm:block text-xs text-muted-foreground">
              {pageInfo.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <ThemeToggle variant="compact" />

            <div className="flex items-center gap-2 pl-3 border-l border-border/70 dark:border-white/[0.08]">
              {userProfile?.photoURL ? (
                <img
                  src={userProfile.photoURL}
                  alt={userProfile.displayName || 'Profil'}
                  className="w-8 h-8 rounded-full object-cover border border-primary/30"
                />
              ) : (
                <div
                  title={userProfile?.email || 'Compte connecté'}
                  className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary/20 to-cyan-500/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary"
                >
                  {userInitials}
                </div>
              )}
              <button
                onClick={handleLogout}
                title="Se déconnecter"
                className="p-2 rounded-xl text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        {/* Page Container */}
        <main className="flex-1 overflow-y-auto pb-24 md:pb-8 relative">
          <Outlet />
        </main>
      </div>

      {/* Bottom Navigation for Mobile (Apple VisionOS / iOS 26 Floating Liquid Glass) */}
      <nav className="md:hidden fixed bottom-3 inset-x-3 max-w-lg mx-auto z-50 pointer-events-none select-none">
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
