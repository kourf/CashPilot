import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import BankStatements from './pages/BankStatements';
import Receipts from './pages/Receipts';
import Coach from './pages/Coach';
import Settings from './pages/Settings';

export default function AppRouter() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="releves" element={<BankStatements />} />
          <Route path="tickets" element={<Receipts />} />
          <Route path="coach" element={<Coach />} />
          <Route path="parametres" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}
