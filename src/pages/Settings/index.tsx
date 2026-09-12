import React, { useState, useEffect, useMemo } from 'react';
import { 
  Trash2, 
  Download, 
  Calendar, 
  Database, 
  AlertTriangle, 
  Sun, 
  Moon, 
  FileSpreadsheet, 
  CheckCircle2, 
  Layers
} from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useTransactions } from '../../context/TransactionsContext';
import { db } from '../../lib/firebase';
import { doc, writeBatch } from 'firebase/firestore';
import { getActiveAccountId } from '../../lib/userUtils';

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  flowType: string;
  category: string;
  account?: string;
  rawLabel?: string;
  cleanLabel?: string;
  accountName?: string;
  [key: string]: any;
}

function formatMonthLabel(periodStr: string): string {
  if (periodStr === 'ALL') return 'Toutes les périodes (Consolidé)';
  const parts = periodStr.split('-');
  if (parts.length !== 2) return periodStr;
  const year = parts[0];
  const monthNum = parseInt(parts[1], 10);
  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  return `${monthNames[monthNum - 1] || periodStr} ${year}`;
}

export const Settings: React.FC = () => {
  const { transactions: contextTxs, setTransactions: setContextTransactions } = useTransactions();

  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const stored = (localStorage.getItem('theme') || localStorage.getItem('cashpilot-theme')) as 'light' | 'dark';
      if (stored === 'light' || stored === 'dark') return stored;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  });

  // Dynamic Transactions state loaded from shared key and initialized with context/localStorage
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cashpilot_transactions') || localStorage.getItem('cashpilot_tx_cache');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        } catch (e) {
          console.error('Failed to parse transactions:', e);
        }
      }
    }
    return [];
  });

  const [selectedPeriodToDelete, setSelectedPeriodToDelete] = useState<string>('ALL');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  // Synchronise context transactions into local state and localStorage
  useEffect(() => {
    if (contextTxs && Array.isArray(contextTxs) && contextTxs.length > 0) {
      const mapped: Transaction[] = contextTxs.map(t => ({
        id: String(t.id),
        date: String(t.date || ''),
        description: String(t.description || t.cleanLabel || t.rawLabel || 'Opération'),
        amount: Number(t.amount) || 0,
        flowType: String(t.flowType || 'VARIABLE_EXPENSE'),
        category: String(t.category || 'Autre'),
        account: t.accountName || t.account || 'Compte Courant',
        rawLabel: t.rawLabel,
        cleanLabel: t.cleanLabel,
        accountName: t.accountName
      }));
      setTransactions(mapped);
      localStorage.setItem('cashpilot_transactions', JSON.stringify(mapped));
    }
  }, [contextTxs]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
    localStorage.setItem('cashpilot-theme', theme);
  }, [theme]);

  // Sync back to localStorage & Context whenever transactions change
  const syncTransactions = (updated: Transaction[]) => {
    setTransactions(updated);
    localStorage.setItem('cashpilot_transactions', JSON.stringify(updated));
    localStorage.setItem('cashpilot_tx_cache', JSON.stringify(updated));
    if (setContextTransactions) {
      setContextTransactions(updated as any);
    }
    // Trigger custom storage event so other tabs/components can re-render immediately
    window.dispatchEvent(new Event('storage'));
  };

  // Distinct available periods
  const availablePeriods = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(t => {
      if (t.date && t.date.length >= 7) {
        set.add(t.date.substring(0, 7));
      }
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  // Target count of transactions to be deleted
  const targetsToDeleteCount = useMemo(() => {
    if (selectedPeriodToDelete === 'ALL') {
      return transactions.length;
    }
    return transactions.filter(t => t.date && t.date.startsWith(selectedPeriodToDelete)).length;
  }, [transactions, selectedPeriodToDelete]);

  // Estimated data size
  const storageUsageKb = useMemo(() => {
    const raw = localStorage.getItem('cashpilot_transactions') || localStorage.getItem('cashpilot_tx_cache') || '';
    return (new Blob([raw]).size / 1024).toFixed(1);
  }, [transactions]);

  // Handlers
  const handleToggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
    setStatusMessage('Thème mis à jour.');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleExportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(transactions, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `cashpilot_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    setStatusMessage('Exportation des données réussie.');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const executeDeletePeriod = async () => {
    let toDeleteIds: string[] = [];
    let updated: Transaction[] = [];

    if (selectedPeriodToDelete === 'ALL') {
      toDeleteIds = transactions.map(t => t.id);
      updated = [];
    } else {
      toDeleteIds = transactions
        .filter(t => t.date && t.date.startsWith(selectedPeriodToDelete))
        .map(t => t.id);
      updated = transactions.filter(t => !t.date || !t.date.startsWith(selectedPeriodToDelete));
    }

    // 1. Synchronisation locale immédiate (0 ms)
    syncTransactions(updated);
    setShowConfirmModal(false);

    // 2. Synchronisation distante Firestore
    try {
      const accountId = getActiveAccountId();
      if (toDeleteIds.length > 0) {
        for (let i = 0; i < toDeleteIds.length; i += 400) {
          const chunk = toDeleteIds.slice(i, i + 400);
          const batch = writeBatch(db);
          chunk.forEach(id => {
            const docRef = doc(db, `users/${accountId}/transactions`, id);
            batch.delete(docRef);
          });
          await batch.commit();
        }
      }
    } catch (e) {
      console.warn("Erreur suppression Firestore dans Paramètres:", e);
    }

    setStatusMessage(
      selectedPeriodToDelete === 'ALL' 
        ? 'Tous les relevés bancaires ont été supprimés.' 
        : `Les relevés de ${formatMonthLabel(selectedPeriodToDelete)} ont été supprimés.`
    );
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleResetEntireApp = async () => {
    if (window.confirm('Attention : Cette action réinitialise complètement le stockage local et cloud (relevés, reçus, réglages). Continuer ?')) {
      const toDeleteIds = transactions.map(t => t.id);

      localStorage.removeItem('cashpilot_transactions');
      localStorage.removeItem('cashpilot_tx_cache');
      localStorage.removeItem('cashpilot_receipts');
      setTransactions([]);
      if (setContextTransactions) {
        setContextTransactions([]);
      }
      window.dispatchEvent(new Event('storage'));

      // Supprimer de Firestore
      try {
        const accountId = getActiveAccountId();
        for (let i = 0; i < toDeleteIds.length; i += 400) {
          const chunk = toDeleteIds.slice(i, i + 400);
          const batch = writeBatch(db);
          chunk.forEach(id => {
            const docRef = doc(db, `users/${accountId}/transactions`, id);
            batch.delete(docRef);
          });
          await batch.commit();
        }
      } catch (e) {
        console.warn("Erreur reset Firestore:", e);
      }

      setStatusMessage('Réinitialisation complète effectuée.');
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-16 max-w-5xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          <span className="text-xs uppercase tracking-wider font-semibold text-cyan-400">CONFIGURATION & DONNÉES</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground mt-1">Paramètres & Système</h1>
        <p className="text-muted-foreground text-sm">
          Gestion dynamique de vos bases de relevés bancaires, synchronisation en direct et préférences d'affichage.
        </p>
      </div>

      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0"/>
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Dynamic Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 glass-card border border-border/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Relevés Enregistrés</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              <FileSpreadsheet className="w-4 h-4"/>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-foreground">{transactions.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Transactions bancaires actives</p>
          </div>
        </Card>

        <Card className="p-5 glass-card border border-border/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Périodes Couvertes</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Calendar className="w-4 h-4"/>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-foreground">{availablePeriods.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Mois répertoriés dans la base</p>
          </div>
        </Card>

        <Card className="p-5 glass-card border border-border/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Volume Stockage</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Database className="w-4 h-4"/>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-foreground">{storageUsageKb} KB</div>
            <p className="text-xs text-muted-foreground mt-1">Espace local utilisé</p>
          </div>
        </Card>
      </div>

      {/* Relevés Bancaires Management Section */}
      <Card className="p-6 glass-card border border-border/40 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400">
            <Layers className="w-5 h-5"/>
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Gestion & Purge des Relevés Bancaires</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sélectionnez un mois spécifique ou l'ensemble des périodes pour supprimer les opérations associées en direct.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-background/50 border border-border/30">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
              Période cible à gérer
            </label>
            <div className="relative">
              <select
                value={selectedPeriodToDelete}
                onChange={e => setSelectedPeriodToDelete(e.target.value)}
                className="w-full appearance-none bg-card border border-border/50 text-foreground text-sm font-medium rounded-xl pl-9 pr-8 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer shadow-sm"
              >
                <option value="ALL">Toutes les périodes ({transactions.length} opérations)</option>
                {availablePeriods.map(p => {
                  const count = transactions.filter(t => t.date && t.date.startsWith(p)).length;
                  return (
                    <option key={p} value={p}>
                      {formatMonthLabel(p)} ({count} opérations)
                    </option>
                  );
                })}
              </select>
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"/>
            </div>
          </div>

          <div className="flex flex-col justify-end">
            <Button
              onClick={() => setShowConfirmModal(true)}
              disabled={targetsToDeleteCount === 0}
              variant="secondary"
              className="w-full flex items-center justify-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 py-2.5 disabled:opacity-40"
            >
              <Trash2 className="w-4 h-4"/>
              Supprimer les relevés ({targetsToDeleteCount})
            </Button>
          </div>
        </div>
      </Card>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fadeIn">
          <Card className="max-w-md w-full p-6 bg-card border border-border/60 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 rounded-xl bg-rose-500/10">
                <AlertTriangle className="w-6 h-6"/>
              </div>
              <h3 className="text-lg font-bold text-foreground">Confirmer la suppression</h3>
            </div>
            
            <p className="text-sm text-muted-foreground leading-relaxed">
              Êtes-vous certain de vouloir supprimer définitivement <strong className="text-foreground">{targetsToDeleteCount} transaction(s)</strong> correspondant à : <strong className="text-cyan-400">{formatMonthLabel(selectedPeriodToDelete)}</strong> ?
            </p>
            <p className="text-xs text-muted-foreground">
              Cette action mettra immédiatement à jour la page Relevés Bancaires, les KPIs et les graphiques de trésorerie.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => setShowConfirmModal(false)}
                className="border border-border/40"
              >
                Annuler
              </Button>
              <Button
                className="bg-rose-500 hover:bg-rose-600 text-white font-semibold"
                onClick={executeDeletePeriod}
              >
                Confirmer la suppression
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Apparence & Theme Toggle */}
      <Card className="p-6 glass-card border border-border/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            {theme === 'dark' ? <Moon className="w-5 h-5"/> : <Sun className="w-5 h-5"/>}
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Apparence & Thème</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Basculez entre le Mode Sombre Finary et le Mode Clair haute lisibilité.
            </p>
          </div>
        </div>

        <Button
          className="flex items-center gap-2 border border-border/40 px-4 py-2"
          onClick={handleToggleTheme}
          variant="secondary"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-4 h-4 text-amber-400"/>
              <span>Passer en Mode Clair</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-cyan-400"/>
              <span>Passer en Mode Sombre</span>
            </>
          )}
        </Button>
      </Card>

      {/* Backup & Export Section */}
      <Card className="p-6 glass-card border border-border/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
            <Download className="w-5 h-5"/>
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Exportation & Sauvegarde</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Téléchargez une copie intégrale de toutes vos transactions sous format JSON structuré.
            </p>
          </div>
        </div>

        <Button
          variant="secondary"
          disabled={transactions.length === 0}
          onClick={handleExportData}
          className="flex items-center gap-2 border border-border/40 disabled:opacity-40"
        >
          <Download className="w-4 h-4 text-emerald-400"/>
          Exporter les données ({transactions.length})
        </Button>
      </Card>

      {/* Critical Reset Zone */}
      <Card className="p-6 glass-card border border-rose-500/30 space-y-4">
        <div className="flex items-center gap-3 text-rose-400">
          <AlertTriangle className="w-5 h-5 flex-shrink-0"/>
          <div>
            <h2 className="text-base font-semibold text-foreground">Zone Critique</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Effacer la totalité des données locales et distantes de l'application sur cet appareil.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-rose-500/10">
          <span className="text-xs text-muted-foreground">
            Cette opération supprime tous les relevés bancaires, reçus et préférences de votre espace.
          </span>
          <Button
            className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 whitespace-nowrap"
            onClick={handleResetEntireApp}
            size="sm"
          >
            Réinitialiser tout l'espace
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default Settings;
