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
  Layers,
  RotateCcw,
  BookmarkCheck,
  Plus,
  Edit3,
  Archive,
  Sparkles,
  Check,
  X,
  ShieldCheck,
  LogOut,
  User as UserIcon
} from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useTransactions } from '../../context/TransactionsContext';
import { useCoach } from '../../context/CoachContext';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/firebase';
import { writeBatch, collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { getActiveAccountId } from '../../lib/userUtils';
import { formatDateExplicit } from '../../lib/kpiUtils';
import type { CustomUserRule } from '../../lib/kpiUtils';

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
  isArchived?: boolean;
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
  const { userProfile, logout } = useAuth();
  const { transactions: contextTxs, setTransactions: setContextTransactions } = useTransactions();
  const {
    customRules,
    addCustomRule,
    updateCustomRule,
    deleteCustomRule,
    archivedItems,
    restoreArchivedItem,
    permanentlyDeleteArchivedItem
  } = useCoach();

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
          if (Array.isArray(parsed)) return parsed.filter((t: any) => !t.isArchived);
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

  // Custom Rules form state
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState<{
    pattern: string;
    exactAmount: string;
    customLabel: string;
    category: string;
    budgetPostName: string;
    isSubscription: boolean;
    customNote: string;
  }>({
    pattern: '',
    exactAmount: '',
    customLabel: '',
    category: 'Abonnements & Télécom',
    budgetPostName: 'Streaming, Cloud & Services',
    isSubscription: true,
    customNote: ''
  });

  // Synchronise context transactions into local state and localStorage
  useEffect(() => {
    if (contextTxs && Array.isArray(contextTxs)) {
      const mapped: Transaction[] = contextTxs
        .filter((t: any) => !t.isArchived)
        .map(t => ({
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

  const resetRuleForm = () => {
    setEditingRuleId(null);
    setRuleForm({
      pattern: '',
      exactAmount: '',
      customLabel: '',
      category: 'Abonnements & Télécom',
      budgetPostName: 'Streaming, Cloud & Services',
      isSubscription: true,
      customNote: ''
    });
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleForm.pattern.trim() || !ruleForm.customLabel.trim()) return;

    const exactAmt = ruleForm.exactAmount.trim() !== '' ? Number(ruleForm.exactAmount.replace(',', '.')) : undefined;

    if (editingRuleId) {
      await updateCustomRule(editingRuleId, {
        pattern: ruleForm.pattern.trim().toUpperCase(),
        exactAmount: exactAmt !== undefined && !isNaN(exactAmt) ? Math.abs(exactAmt) : undefined,
        customLabel: ruleForm.customLabel.trim(),
        category: ruleForm.category.trim(),
        budgetPostName: ruleForm.budgetPostName.trim() || undefined,
        nature: ruleForm.isSubscription ? 'fixe' : 'variable',
        isSubscription: ruleForm.isSubscription,
        customNote: ruleForm.customNote.trim() || undefined
      });
      setStatusMessage(`Règle "${ruleForm.customLabel}" mise à jour.`);
    } else {
      await addCustomRule({
        pattern: ruleForm.pattern.trim().toUpperCase(),
        exactAmount: exactAmt !== undefined && !isNaN(exactAmt) ? Math.abs(exactAmt) : undefined,
        customLabel: ruleForm.customLabel.trim(),
        category: ruleForm.category.trim(),
        budgetPostName: ruleForm.budgetPostName.trim() || undefined,
        nature: ruleForm.isSubscription ? 'fixe' : 'variable',
        isSubscription: ruleForm.isSubscription,
        customNote: ruleForm.customNote.trim() || undefined
      });
      setStatusMessage(`Nouvelle règle "${ruleForm.customLabel}" créée et synchronisée.`);
    }
    resetRuleForm();
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const startEditRule = (rule: CustomUserRule) => {
    setEditingRuleId(rule.id);
    setRuleForm({
      pattern: rule.pattern,
      exactAmount: rule.exactAmount !== undefined ? String(rule.exactAmount) : '',
      customLabel: rule.customLabel,
      category: rule.category,
      budgetPostName: rule.budgetPostName || 'Streaming, Cloud & Services',
      isSubscription: Boolean(rule.isSubscription),
      customNote: rule.customNote || ''
    });
  };

  const executeDeletePeriod = async () => {
    let updated: Transaction[] = [];
    let toArchive: Transaction[] = [];

    if (selectedPeriodToDelete === 'ALL') {
      toArchive = [...transactions];
      updated = [];
      localStorage.removeItem('cashpilot_monthly_balances');
    } else {
      toArchive = transactions.filter(t => t.date && t.date.startsWith(selectedPeriodToDelete));
      updated = transactions.filter(t => !t.date || !t.date.startsWith(selectedPeriodToDelete));

      try {
        const savedBalances = localStorage.getItem('cashpilot_monthly_balances');
        if (savedBalances) {
          const balances = JSON.parse(savedBalances);
          delete balances[selectedPeriodToDelete];
          localStorage.setItem('cashpilot_monthly_balances', JSON.stringify(balances));
        }
      } catch (e) {
        console.warn("Erreur suppression monthly_balances:", e);
      }
    }

    const archId = `arch_settings_${Date.now()}`;
    const archiveRecord = {
      id: archId,
      targetType: 'statement' as const,
      targetId: selectedPeriodToDelete,
      title: selectedPeriodToDelete === 'ALL'
        ? `Tous les relevés (${toArchive.length} opérations)`
        : `Relevé ${formatMonthLabel(selectedPeriodToDelete)} (${toArchive.length} opérations)`,
      subtitle: `${toArchive.length} opérations bancaires`,
      deletedAt: new Date().toISOString(),
      actionType: 'DELETE_STATEMENT_PERIOD' as const,
      previousSnapshot: {
        monthKey: selectedPeriodToDelete,
        transactions: toArchive
      }
    };

    // 1. Archiver dans la corbeille locale (Soft Delete)
    if (toArchive.length > 0) {
      try {
        const rawArch = localStorage.getItem('cashpilot_archived_items_v1');
        const currentArch = rawArch ? JSON.parse(rawArch) : [];
        localStorage.setItem('cashpilot_archived_items_v1', JSON.stringify([archiveRecord, ...currentArch]));
      } catch {
        // ignore
      }
    }

    // 2. Synchronisation locale immédiate (0 ms)
    syncTransactions(updated);
    window.dispatchEvent(new CustomEvent('cashpilot_balances_updated'));
    setShowConfirmModal(false);

    // 3. Synchronisation distante Firestore (Soft Delete isArchived: true)
    try {
      const accountId = getActiveAccountId();
      const colRef = collection(db, `users/${accountId}/transactions`);
      const snap = await getDocs(colRef);
      const periodDocs = selectedPeriodToDelete === 'ALL'
        ? snap.docs
        : snap.docs.filter(d => {
            const data = d.data();
            return (data.date && data.date.startsWith(selectedPeriodToDelete)) || 
                   (data.monthKey === selectedPeriodToDelete);
          });

      for (let i = 0; i < periodDocs.length; i += 400) {
        const chunk = periodDocs.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach(d => batch.set(d.ref, { isArchived: true, deletedAt: new Date().toISOString() }, { merge: true }));
        await batch.commit();
      }

      if (toArchive.length > 0) {
        await setDoc(doc(db, `users/${accountId}/archived_items`, archId), archiveRecord);
      }
    } catch (e) {
      console.warn("Erreur archivage Firestore dans Paramètres:", e);
    }

    setStatusMessage(
      selectedPeriodToDelete === 'ALL' 
        ? 'Tous les relevés bancaires ont été placés dans la Corbeille (restaurables à tout moment).' 
        : `Les relevés de ${formatMonthLabel(selectedPeriodToDelete)} ont été placés dans la Corbeille.`
    );
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleRestoreItem = async (archiveId: string, label: string) => {
    await restoreArchivedItem(archiveId);
    setStatusMessage(`Élément restauré avec succès : ${label}`);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const handlePermanentDeleteItem = async (archiveId: string, label: string) => {
    await permanentlyDeleteArchivedItem(archiveId);
    setStatusMessage(`Élément supprimé définitivement : ${label}`);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const handleResetEntireApp = async () => {
    if (window.confirm('Attention : Cette action réinitialise complètement le stockage local et cloud (relevés, reçus, réglages). Continuer ?')) {
      localStorage.removeItem('cashpilot_transactions');
      localStorage.removeItem('cashpilot_tx_cache');
      localStorage.removeItem('cashpilot_receipts');
      localStorage.removeItem('cashpilot_monthly_balances');
      localStorage.removeItem('cashpilot_statement_currency');
      setTransactions([]);
      if (setContextTransactions) {
        setContextTransactions([]);
      }
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('cashpilot_balances_updated'));

      try {
        const accountId = getActiveAccountId();
        const snap = await getDocs(collection(db, `users/${accountId}/transactions`));
        const allDocs = snap.docs;
        for (let i = 0; i < allDocs.length; i += 400) {
          const chunk = allDocs.slice(i, i + 400);
          const batch = writeBatch(db);
          chunk.forEach(d => batch.delete(d.ref));
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span className="text-xs uppercase tracking-wider font-semibold text-cyan-400">CONFIGURATION, RÈGLES & CORBEILLE</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mt-1">Paramètres & Système</h1>
          <p className="text-muted-foreground text-sm">
            Gestion de votre compte isolé, de vos règles d'abonnements personnalisées, corbeille de restauration et préférences.
          </p>
        </div>

        {userProfile && (
          <div className="p-3.5 rounded-2xl bg-card border border-border/60 flex items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary border border-primary/30 flex items-center justify-center shrink-0">
                <UserIcon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-foreground truncate">
                    {userProfile.displayName || 'Mon Espace'}
                  </span>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                </div>
                <p className="text-[11px] text-muted-foreground truncate">{userProfile.email}</p>
                <p className="text-[10px] font-mono text-muted-foreground/80 truncate">
                  Espace actif : <strong className="text-cyan-400">{userProfile.activeWorkspace || userProfile.uid.slice(0, 12) + '…'}</strong>
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => logout()}
              className="text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 flex items-center gap-1.5 shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Déconnexion</span>
            </Button>
          </div>
        )}
      </div>

      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0"/>
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Dynamic Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-5 glass-card border border-border/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Opérations Actives</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              <FileSpreadsheet className="w-4 h-4"/>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-foreground">{transactions.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Transactions bancaires</p>
          </div>
        </Card>

        <Card className="p-5 glass-card border border-border/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Règles Actives</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <BookmarkCheck className="w-4 h-4"/>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-foreground">{customRules.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Règles & abonnements</p>
          </div>
        </Card>

        <Card className="p-5 glass-card border border-border/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Corbeille</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Archive className="w-4 h-4"/>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-foreground">{archivedItems.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Éléments restaurables</p>
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
            <p className="text-xs text-muted-foreground mt-1">{availablePeriods.length} mois couverts</p>
          </div>
        </Card>
      </div>

      {/* SECTION 1 : Module "Mes Règles & Abonnements Personnalisés" */}
      <Card className="p-6 glass-card border border-indigo-500/25 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              <BookmarkCheck className="w-5 h-5"/>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">Mes Règles & Abonnements Personnalisés</h2>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                  Synchronisé avec le Coach IA
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Définissez vos propres règles de catégorisation et précisions d'abonnements (ex: distinguer Google 2,99 € de Google 10,99 €). Modifiables ou supprimables en 1 clic sans toucher au code.
              </p>
            </div>
          </div>
        </div>

        {/* Formulaire d'ajout / édition de règle */}
        <form onSubmit={handleSaveRule} className="p-4 rounded-xl bg-background/60 border border-border/50 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              {editingRuleId ? 'Modifier la règle sélectionnée' : 'Ajouter une règle ou précision d\'abonnement'}
            </span>
            {editingRuleId && (
              <button
                type="button"
                onClick={resetRuleForm}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Annuler l'édition
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                Mot-clé bancaire (ex: GOOGLE, NETFLIX) *
              </label>
              <input
                type="text"
                required
                value={ruleForm.pattern}
                onChange={e => setRuleForm(prev => ({ ...prev, pattern: e.target.value }))}
                placeholder="Ex: GOOGLE"
                className="w-full px-3 py-2 text-xs rounded-lg bg-card border border-border text-foreground focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                Montant exact (€) <span className="text-[10px] opacity-70">(optionnel)</span>
              </label>
              <input
                type="text"
                value={ruleForm.exactAmount}
                onChange={e => setRuleForm(prev => ({ ...prev, exactAmount: e.target.value }))}
                placeholder="Ex: 2.99 (vide = tout montant)"
                className="w-full px-3 py-2 text-xs rounded-lg bg-card border border-border text-foreground font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                Nom affiché explicite *
              </label>
              <input
                type="text"
                required
                value={ruleForm.customLabel}
                onChange={e => setRuleForm(prev => ({ ...prev, customLabel: e.target.value }))}
                placeholder="Ex: Abonnement Google One 200 Go"
                className="w-full px-3 py-2 text-xs rounded-lg bg-card border border-border text-foreground focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                Catégorie budgétaire
              </label>
              <input
                type="text"
                value={ruleForm.category}
                onChange={e => setRuleForm(prev => ({ ...prev, category: e.target.value }))}
                placeholder="Ex: Abonnements & Télécom"
                className="w-full px-3 py-2 text-xs rounded-lg bg-card border border-border text-foreground focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                Note ou précision pour l'IA
              </label>
              <input
                type="text"
                value={ruleForm.customNote}
                onChange={e => setRuleForm(prev => ({ ...prev, customNote: e.target.value }))}
                placeholder="Ex: Stockage cloud photo"
                className="w-full px-3 py-2 text-xs rounded-lg bg-card border border-border text-foreground focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex items-end justify-between gap-2">
              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer py-2">
                <input
                  type="checkbox"
                  checked={ruleForm.isSubscription}
                  onChange={e => setRuleForm(prev => ({
                    ...prev,
                    isSubscription: e.target.checked
                  }))}
                  className="rounded border-border text-indigo-600 focus:ring-indigo-500"
                />
                <span>Abonnement / Charge fixe</span>
              </label>
              <Button
                type="submit"
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5"
              >
                {editingRuleId ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                {editingRuleId ? 'Enregistrer' : 'Ajouter'}
              </Button>
            </div>
          </div>
        </form>

        {/* Liste des cartes / tags de règles personnalisées */}
        {customRules.length === 0 ? (
          <div className="text-center py-6 px-4 rounded-xl border border-dashed border-border/60 text-muted-foreground text-xs">
            Aucune règle personnalisée enregistrée pour le moment. Vous pouvez en créer une ci-dessus ou simplement dire au Coach IA :{" "}
            <em className="text-foreground">« Le prélèvement Google de 2,99 € correspond à Google One »</em>.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {customRules.map(rule => (
              <div
                key={rule.id}
                className="p-3.5 rounded-xl bg-background/70 border border-border/60 hover:border-indigo-500/40 transition-all flex items-start justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-foreground truncate">{rule.customLabel}</span>
                    {rule.exactAmount !== undefined && (
                      <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                        = {rule.exactAmount.toFixed(2)} €
                      </span>
                    )}
                    {rule.isSubscription && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-400">
                        Abonnement
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span>Mot-clé : <strong className="font-mono text-foreground">{rule.pattern}</strong></span>
                    <span>•</span>
                    <span>Catégorie : <strong className="text-foreground">{rule.category}</strong></span>
                  </div>
                  {rule.customNote && (
                    <p className="text-[11px] text-muted-foreground italic">« {rule.customNote} »</p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => startEditRule(rule)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                    title="Modifier cette règle"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteCustomRule(rule.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Supprimer cette règle"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* SECTION 2 : Corbeille & Éléments Archivés (Soft Delete & Restauration 1-clic) */}
      <Card className="p-6 glass-card border border-amber-500/25 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <Archive className="w-5 h-5"/>
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Corbeille & Éléments Archivés (Soft Delete)</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Les opérations, tickets ou relevés supprimés via le Coach IA ou les Paramètres sont conservés ici afin de permettre une restauration immédiate en cas d'erreur.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
            {archivedItems.length} élément(s)
          </span>
        </div>

        {archivedItems.length === 0 ? (
          <div className="text-center py-6 px-4 rounded-xl border border-dashed border-border/60 text-muted-foreground text-xs">
            La corbeille est vide. Aucun élément archivé.
          </div>
        ) : (
          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
            {archivedItems.map(item => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl bg-background/70 border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/15 text-amber-400">
                      {item.targetType === 'receipt'
                        ? 'Ticket de caisse'
                        : item.targetType === 'statement'
                        ? 'Relevé mensuel'
                        : 'Transaction'}
                    </span>
                    <span className="text-xs font-semibold text-foreground">{item.title}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {item.subtitle} • Archivé le {formatDateExplicit(item.deletedAt)}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleRestoreItem(item.id, item.title)}
                    className="text-xs flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restaurer
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handlePermanentDeleteItem(item.id, item.title)}
                    className="text-xs flex items-center gap-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25"
                    title="Supprimer définitivement"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Relevés Bancaires Management Section */}
      <Card className="p-6 glass-card border border-border/40 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400">
            <Layers className="w-5 h-5"/>
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Gestion & Archivage des Relevés Bancaires</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sélectionnez un mois spécifique ou l'ensemble des périodes pour archiver les opérations associées (restaurables depuis la Corbeille ci-dessus).
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
              Archiver les relevés ({targetsToDeleteCount})
            </Button>
          </div>
        </div>
      </Card>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fadeIn">
          <Card className="max-w-md w-full p-6 bg-card border border-border/60 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="p-2 rounded-xl bg-amber-500/10">
                <AlertTriangle className="w-6 h-6"/>
              </div>
              <h3 className="text-lg font-bold text-foreground">Confirmer la mise en corbeille</h3>
            </div>
            
            <p className="text-sm text-muted-foreground leading-relaxed">
              Voulez-vous déplacer <strong className="text-foreground">{targetsToDeleteCount} transaction(s)</strong> correspondant à <strong className="text-cyan-400">{formatMonthLabel(selectedPeriodToDelete)}</strong> vers la Corbeille ?
            </p>
            <p className="text-xs text-muted-foreground">
              Vos tableaux de bord et KPIs seront immédiatement mis à jour. Vous pourrez restaurer ces opérations en 1 clic depuis la section Corbeille.
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
                Confirmer l'archivage
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
