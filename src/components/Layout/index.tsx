import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Landmark,
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
import { FloatingNavDock } from '../../pages/Dashboard/components/FloatingNavDock';

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
    <div className="flex h-screen overflow-hidden flex-col antialiased liquid-mesh text-slate-100 selection:bg-cyan-500/20 selection:text-cyan-400 transition-colors duration-300">
      
      {/* Top Sticky Header avec Logo CashPilot, Navigation Info & Profil Apple VisionOS (Masqué sur l'Accueil pour laisser place à la DA épurée Capture 1) */}
      {location.pathname !== '/' && (
        <header className="h-16 px-4 sm:px-6 lg:px-8 border-b border-white/10 backdrop-blur-xl z-30 shrink-0 bg-slate-950/40 text-white shadow-[0_4px_20px_rgba(0,0,0,0.25)] flex items-center">
          <div className="w-full flex items-center justify-between">
            {/* Gauche : Logo CashPilot PRO & Titre de page */}
            <div className="flex items-center gap-3 sm:gap-6">
              <Link to="/" className="flex items-center gap-2.5 sm:gap-3 group">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-cyan-500 via-primary to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/25 group-hover:scale-105 transition-transform duration-300 border border-white/20 shrink-0">
                  <Landmark size={18} className="stroke-[2.5]" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-base sm:text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                      CashPilot
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                      PRO
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-[11px] font-medium text-slate-400">Finance & Patrimoine</p>
                </div>
              </Link>

              <div className="hidden lg:block h-6 w-px bg-white/10" />

              <div className="hidden lg:block">
                <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                  {pageInfo.title}
                </h2>
                <p className="text-xs text-slate-400">
                  {pageInfo.subtitle}
                </p>
              </div>
            </div>

            {/* Droite : Outils, Mode Sombre & Profil Utilisateur */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Badge UID Chiffré discret */}
              <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-slate-300 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
                <span className="text-[11px] font-medium">UID Chiffré</span>
                <ShieldCheck size={13} className="text-emerald-400 ml-0.5" />
              </div>

              {/* Bouton de mise à jour instantanée & purge cache */}
              <button
                onClick={handleForceRefresh}
                title="Vider le cache et charger la dernière version"
                disabled={isRefreshingApp}
                className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl text-slate-300 hover:text-cyan-300 hover:bg-white/[0.08] border border-white/10 flex items-center gap-1.5 text-xs transition-all active:scale-95 cursor-pointer bg-white/[0.04]"
              >
                <RefreshCw size={14} className={cn("text-cyan-400 shrink-0", isRefreshingApp && "animate-spin")} />
                <span className="text-[11px] font-bold text-cyan-300 sm:inline">v2.8</span>
              </button>

              <ThemeToggle variant="compact" />

              {/* Profil utilisateur & Déconnexion */}
              <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-white/10">
                {userProfile && (
                  <div className="flex items-center gap-2">
                    {userProfile.photoURL ? (
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

                    <div className="hidden sm:block text-left min-w-0 max-w-[130px]">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold truncate text-white block">
                          {userProfile.displayName || 'Utilisateur'}
                        </span>
                        {userProfile.isAdmin && (
                          <span className="text-[8px] font-bold px-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            Admin
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] truncate text-slate-400 block">
                        {userProfile.activeWorkspace ? `Espace : ${userProfile.activeWorkspace}` : userProfile.email}
                      </span>
                    </div>
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
          </div>
        </header>
      )}

      {/* Main Content Area (Scrollable naturellement sur toutes les pages y compris Coach) */}
      <main className={cn(
        "flex-1 relative w-full overflow-y-auto touch-scroll",
        (location.pathname === '/' || location.pathname === '/coach')
          ? "p-0"
          : "px-4 sm:px-6 lg:px-8 pb-32 sm:pb-36"
      )}>
        <div className="w-full min-h-full transition-all duration-300">
          <Outlet />
        </div>
      </main>

      {/* Barre Flottante Universelle Ron Design : 5 Onglets (Accueil, Relevés, Tickets, Coach IA, Paramètres) */}
      <FloatingNavDock />
      
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
