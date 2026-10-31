import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2, Landmark, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface PrivateRouteProps {
  children: React.ReactNode;
}

/**
 * Garde de route (PrivateRoute) :
 * - Affiche un écran d'attente élégant pendant la vérification du jeton Firebase Auth.
 * - Redirige de force tout visiteur non connecté vers la Landing Page (`/bienvenue`).
 */
export const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 max-w-xs text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/25">
            <Landmark size={22} />
          </div>
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Loader2 size={16} className="animate-spin text-primary" />
            <span>Vérification de votre session...</span>
          </div>
          <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck size={13} className="text-emerald-500" />
            <span>Espace personnel chiffré & isolé</span>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/bienvenue" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default PrivateRoute;
