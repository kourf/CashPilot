import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Landmark, 
  Receipt, 
  MessageSquareHeart, 
  Settings 
} from 'lucide-react';
import { cn } from '../../lib/utils';

const navItems = [
  { icon: LayoutDashboard, label: 'Accueil', path: '/' },
  { icon: Landmark, label: 'Relevé bancaire', path: '/releves' },
  { icon: Receipt, label: 'Ticket de caisse', path: '/tickets' },
  { icon: MessageSquareHeart, label: 'Coach IA', path: '/coach' },
  { icon: Settings, label: 'Paramètres', path: '/parametres' },
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-background overflow-hidden flex-col md:flex-row">
      
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card p-4 space-y-8">
        <div className="flex items-center gap-3 px-2">
          <div className="bg-primary/10 text-primary p-2 rounded-xl">
            <Landmark size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">CashPilot</h1>
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== '/' && location.pathname.startsWith(item.path));
              
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200",
                  "hover:bg-muted text-sm font-medium",
                  isActive 
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-soft" 
                    : "text-muted-foreground"
                )}
              >
                <item.icon size={20} className={cn(isActive ? "text-primary-foreground" : "text-muted-foreground")} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-24 md:pb-0 relative">
        <Outlet />
      </main>

      {/* Bottom Navigation for Mobile */}
      <nav className="md:hidden fixed bottom-0 w-full border-t border-border bg-card/80 backdrop-blur-lg z-50">
        <div className="flex justify-around items-center p-2 pb-safe">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== '/' && location.pathname.startsWith(item.path));
              
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-xl transition-all",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon size={24} className={cn(
                  "transition-all duration-300",
                  isActive && "fill-primary/20 scale-110"
                )} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      
    </div>
  );
}
