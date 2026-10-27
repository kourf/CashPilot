import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import BankStatements from './pages/BankStatements';
import Receipts from './pages/Receipts';
import Coach from './pages/Coach';
import Settings from './pages/Settings';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function AppRouter() {
  return (
    <Router>
      <ErrorBoundary fallbackTitle="Une erreur est survenue dans l'application">
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="releves" element={<ErrorBoundary fallbackTitle="Erreur dans les relevés bancaires"><BankStatements /></ErrorBoundary>} />
            <Route path="tickets" element={<Receipts />} />
            <Route path="coach" element={<Coach />} />
            <Route path="parametres" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </Router>
  );
}
