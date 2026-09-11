import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Landmark, 
  Receipt, 
  MessageSquareHeart, 
  Settings,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { ThemeToggle } from '../ThemeToggle';

const navItems = [
  { icon: LayoutDashboard, label: 'Accueil', path: '/' },
  { icon: Landmark, label: 'Relevé bancaire', path: '/releves' },
  { icon: Receipt, label: 'Ticket de caisse', path: '/tickets' },
  { icon: MessageSquareHeart, label: 'Coach IA', path: '/coach', badge: 'IA' },
  { icon: Settings, label: 'Paramètres', path: '/parametres' },
];

export default function Layout() {
  const location = useLocation();

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
                      "text-[10px] font-bold px-1.5 py-0.2 rounded-full flex items-center gap-0.5",
                      isActive ? "bg-white/20 text-white" : "bg-primary/15 text-primary"
                    )}>
                      <Sparkles size={10} />
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

          <div className="px-3 py-2 rounded-xl bg-secondary/40 dark:bg-white/[0.02] border border-border/50 dark:border-white/[0.04] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-medium text-muted-foreground">Mode Chiffré</span>
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
            {/* Quick Theme Toggle for mobile or desktop top bar */}
            <ThemeToggle variant="compact" />

            <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-border/70 dark:border-white/[0.08]">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary/20 to-cyan-500/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary">
                CP
              </div>
            </div>
          </div>
        </header>

        {/* Page Container */}
        <main className="flex-1 overflow-y-auto pb-24 md:pb-8 relative">
          <Outlet />
        </main>
      </div>

      {/* Bottom Navigation for Mobile (iOS 18 Floating Glass Bar) */}
      <nav className="md:hidden fixed bottom-3 left-3 right-3 rounded-2xl border border-border/80 dark:border-white/[0.1] bg-card/90 dark:bg-[#10141e]/90 backdrop-blur-2xl shadow-luxury z-50">
        <div className="flex justify-around items-center p-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== '/' && location.pathname.startsWith(item.path));
              
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-xl transition-all relative",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon size={20} className={cn(
                  "transition-transform duration-300",
                  isActive && "scale-110 stroke-[2.5]"
                )} />
                <span className="text-[10px] font-medium">{item.label}</span>
                {isActive && (
                  <span className="absolute -bottom-1 w-4 h-0.5 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
      
    </div>
  );
}
