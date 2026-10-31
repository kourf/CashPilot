import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import BankStatements from './pages/BankStatements';
import Receipts from './pages/Receipts';
import Coach from './pages/Coach';
import Settings from './pages/Settings';
import LandingPage from './pages/Landing';
import SecretAdminGate from './pages/SecretAdmin';
import PrivateRoute from './components/PrivateRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAuth } from './context/AuthContext';

export default function AppRouter() {
  const { user, loading } = useAuth();

  return (
    <Router>
      <ErrorBoundary fallbackTitle="Une erreur est survenue dans l'application">
        <Routes>
          {/* Passerelles Confidentielles Administrateur (connexion express par identifiant) */}
          <Route path="/porte-secrete" element={<SecretAdminGate />} />
          <Route path="/acces-admin" element={<SecretAdminGate />} />
          <Route path="/admin" element={<SecretAdminGate />} />
          <Route path="/secret" element={<SecretAdminGate />} />

          {/* Route publique : Landing Page épurée et didactique */}
          <Route
            path="/bienvenue"
            element={!loading && user ? <Navigate to="/" replace /> : <LandingPage />}
          />

          {/* Routes Privées : Accès protégé aux 4 onglets (Accueil, Relevé bancaire, Ticket, Coach IA) + Paramètres */}
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route
              path="releves"
              element={
                <ErrorBoundary fallbackTitle="Erreur dans les relevés bancaires">
                  <BankStatements />
                </ErrorBoundary>
              }
            />
            <Route path="tickets" element={<Receipts />} />
            <Route path="coach" element={<Coach />} />
            <Route path="parametres" element={<Settings />} />
          </Route>

          {/* Redirection automatique : Tout visiteur non connecté est envoyé vers la Landing Page */}
          <Route
            path="*"
            element={<Navigate to={user ? '/' : '/bienvenue'} replace />}
          />
        </Routes>
      </ErrorBoundary>
    </Router>
  );
}
