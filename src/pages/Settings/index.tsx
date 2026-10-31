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
  User as UserIcon,
  SlidersHorizontal,
  Lock,
  Search,
  Filter,
  ArrowRight,
  ShieldAlert,
  Zap,
  HardDrive,
  RefreshCw,
  FolderSync
} from 'lucide-react';
import { useTransactions } from '../../context/TransactionsContext';
import { useCoach } from '../../context/CoachContext';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/firebase';
import { writeBatch, collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { getActiveAccountId } from '../../lib/userUtils';
import { formatDateExplicit, DEFAULT_COST_OF_LIVING_ITEMS } from '../../lib/kpiUtils';
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

const AVAILABLE_CATEGORIES = [
  'Abonnements & Télécom',
  'Alimentation & Courses',
  'Restaurants & Sorties',
  'Logement & Énergie',
  'Assurances',
  'Santé',
  'Transports & Carburant',
  'Loisirs & Activités',
  'Shopping & Maison',
  'Frais bancaires',
  'Épargne & Investissement',
  'Virements Internes',
  'Solidarité',
  'Salaire & Revenus',
  'Autre'
];

type SettingsTab = 'general' | 'rules' | 'statements' | 'security';

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
  const { transactions: contextTxs, setTransactions: setContextTransactions, currency = 'EUR' } = useTransactions();
  const {
    customRules,
    addCustomRule,
    updateCustomRule,
    deleteCustomRule,
    archivedItems,
    restoreArchivedItem,
    permanentlyDeleteArchivedItem
  } = useCoach();

  // Onglet actif
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

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

  // Modales VisionOS Liquid Glass
  const [showArchiveConfirmModal, setShowArchiveConfirmModal] = useState<boolean>(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState<boolean>(false);
  const [itemToDeletePermanently, setItemToDeletePermanently] = useState<{ id: string; label: string } | null>(null);
  const [resetConfirmationText, setResetConfirmationText] = useState<string>('');

  // Filtres et recherche pour les règles
  const [ruleSearchQuery, setRuleSearchQuery] = useState<string>('');
  const [ruleCategoryFilter, setRuleCategoryFilter] = useState<string>('ALL');

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

    setStatusMessage('Exportation des données réussie (fichier JSON téléchargé).');
    setTimeout(() => setStatusMessage(null), 3500);
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
      setStatusMessage(`Règle "${ruleForm.customLabel}" mise à jour et synchronisée avec le Coach IA.`);
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
      setStatusMessage(`Nouvelle règle "${ruleForm.customLabel}" créée avec succès.`);
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
    // Naviguer sur l'onglet règles et scroll haut
    setActiveTab('rules');
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
    setShowArchiveConfirmModal(false);

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
        ? 'Tous les relevés bancaires ont été déplacés dans la Corbeille (restaurables en 1 clic).' 
        : `Les relevés de ${formatMonthLabel(selectedPeriodToDelete)} ont été déplacés dans la Corbeille.`
    );
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleRestoreItem = async (archiveId: string, label: string) => {
    await restoreArchivedItem(archiveId);
    setStatusMessage(`Élément restauré avec succès : ${label}`);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const confirmPermanentDelete = async () => {
    if (!itemToDeletePermanently) return;
    await permanentlyDeleteArchivedItem(itemToDeletePermanently.id);
    setStatusMessage(`Suppression définitive effectuée : ${itemToDeletePermanently.label}`);
    setItemToDeletePermanently(null);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const executeResetEntireApp = async () => {
    if (resetConfirmationText.trim().toUpperCase() !== 'CONFIRMER') {
      alert('Veuillez saisir CONFIRMER pour valider la réinitialisation.');
      return;
    }

    localStorage.removeItem('cashpilot_transactions');
    localStorage.removeItem('cashpilot_tx_cache');
    localStorage.removeItem('cashpilot_receipts');
    localStorage.removeItem('cashpilot_monthly_balances');
    localStorage.removeItem('cashpilot_statement_currency');
    localStorage.removeItem('cashpilot_custom_rules_v1');
    localStorage.removeItem('cashpilot_archived_items_v1');
    localStorage.removeItem('cashpilot_coach_conversations_v3');
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

    setShowResetConfirmModal(false);
    setResetConfirmationText('');
    setStatusMessage('Réinitialisation complète effectuée. Espace réinitialisé à neuf.');
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Règles filtrées
  const filteredCustomRules = useMemo(() => {
    return customRules.filter(rule => {
      const matchesSearch = 
        !ruleSearchQuery.trim() ||
        rule.customLabel.toLowerCase().includes(ruleSearchQuery.toLowerCase()) ||
        rule.pattern.toLowerCase().includes(ruleSearchQuery.toLowerCase()) ||
        (rule.customNote && rule.customNote.toLowerCase().includes(ruleSearchQuery.toLowerCase()));
      
      const matchesCategory = 
        ruleCategoryFilter === 'ALL' ||
        (ruleCategoryFilter === 'SUBSCRIPTIONS' ? rule.isSubscription : rule.category === ruleCategoryFilter);

      return matchesSearch && matchesCategory;
    });
  }, [customRules, ruleSearchQuery, ruleCategoryFilter]);

  const subscriptionsCount = useMemo(() => {
    return customRules.filter(r => r.isSubscription).length;
  }, [customRules]);

  return (
    <div className="coach-liquid-aura min-h-[calc(100vh-4rem)] text-white relative selection:bg-sky-500/30 selection:text-white overflow-x-hidden pb-20">
      
      {/* Toast Notification Flottant Liquid Glass */}
      {statusMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300 max-w-md w-[90%] pointer-events-none">
          <div className="apple-glass rounded-2xl px-4 py-3 border-emerald-400/40 shadow-2xl flex items-center gap-3 text-emerald-300 text-xs sm:text-sm font-medium">
            <CheckCircle2 size={18} className="shrink-0 text-emerald-400" />
            <span className="leading-snug">{statusMessage}</span>
          </div>
        </div>
      )}

      {/* 1. HERO BANNER VISIONOS IMMERSIF */}
      <div className="pt-6 pb-4 px-4 sm:px-6 md:px-8 max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6 text-center md:text-left">
          
          {/* Bloc Titre & Orb Central */}
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
            <div className="relative">
              <div className="apple-glass specular-glow w-20 h-20 sm:w-22 sm:h-22 rounded-[30px] flex items-center justify-center relative z-10 transition-transform duration-500 hover:scale-105 border border-white/25">
                <div className="absolute inset-1 rounded-[26px] bg-gradient-to-tr from-cyan-500/20 via-sky-400/10 to-indigo-500/20" />
                <SlidersHorizontal className="w-9 h-9 sm:w-10 sm:h-10 text-sky-400 relative z-10 drop-shadow-[0_0_12px_rgba(56,189,248,0.5)]" />
              </div>
              <div className="absolute -bottom-1 -right-1 z-20 w-7 h-7 rounded-full apple-glass flex items-center justify-center border border-white/30 text-emerald-400 shadow-lg">
                <Sparkles size={13} />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#38bdf8]" />
                <span className="text-[11px] uppercase tracking-wider font-extrabold text-cyan-300">
                  CENTRE DE CONTRÔLE & SYSTÈME
                </span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                Paramètres & Préférences
              </h1>
              <p className="text-xs sm:text-sm text-slate-300/90 max-w-xl font-light leading-relaxed">
                Gérez vos règles d'intelligence financière, pilotez vos relevés, restaurez vos éléments et sécurisez votre espace isolé.
              </p>
            </div>
          </div>

          {/* Badge Profil & Statut Sécurisé */}
          {userProfile && (
            <div className="apple-glass rounded-2xl p-3 sm:p-3.5 border-white/15 flex items-center gap-3 shrink-0 self-stretch sm:self-auto justify-between md:justify-start shadow-xl">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500/20 to-blue-600/30 border border-sky-400/30 text-sky-300 flex items-center justify-center font-bold text-xs shrink-0 shadow-inner">
                  {userProfile.photoURL ? (
                    <img src={userProfile.photoURL} alt="Profil" className="w-full h-full rounded-xl object-cover" />
                  ) : (
                    (userProfile.displayName || userProfile.email || 'CP').slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white truncate max-w-[130px]">
                      {userProfile.displayName || 'Mon Compte'}
                    </span>
                    <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
                  </div>
                  <p className="text-[11px] text-slate-300 truncate max-w-[150px]">{userProfile.email}</p>
                  <p className="text-[10px] font-mono text-cyan-300 truncate">
                    Espace : <strong>{userProfile.activeWorkspace || userProfile.uid.slice(0, 10) + '…'}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => logout()}
                className="p-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-all hover:scale-105 active:scale-95 cursor-pointer shrink-0"
                title="Se déconnecter de votre espace"
              >
                <LogOut size={15} />
              </button>
            </div>
          )}
        </div>

        {/* 2. STATS PILLS EN DIRECT */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5 mt-5">
          <div className="apple-glass-pill rounded-2xl p-3 flex items-center gap-3 border-white/15">
            <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center border border-sky-400/25 shrink-0">
              <FileSpreadsheet size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-base font-bold font-mono text-white leading-none">{transactions.length}</div>
              <span className="text-[10px] text-slate-400 font-medium truncate block mt-0.5">Opérations actives</span>
            </div>
          </div>

          <div className="apple-glass-pill rounded-2xl p-3 flex items-center gap-3 border-white/15">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center border border-indigo-400/25 shrink-0">
              <BookmarkCheck size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-base font-bold font-mono text-white leading-none">{customRules.length}</div>
              <span className="text-[10px] text-slate-400 font-medium truncate block mt-0.5">Règles IA & Abos</span>
            </div>
          </div>

          <div className="apple-glass-pill rounded-2xl p-3 flex items-center gap-3 border-white/15">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-400/25 shrink-0">
              <Archive size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-base font-bold font-mono text-white leading-none">{archivedItems.length}</div>
              <span className="text-[10px] text-slate-400 font-medium truncate block mt-0.5">Corbeille restaurable</span>
            </div>
          </div>

          <div className="apple-glass-pill rounded-2xl p-3 flex items-center gap-3 border-white/15">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-400/25 shrink-0">
              <Database size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-base font-bold font-mono text-white leading-none">{storageUsageKb} KB</div>
              <span className="text-[10px] text-slate-400 font-medium truncate block mt-0.5">{availablePeriods.length} mois en base</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. CAPSULE DE NAVIGATION PAR ONGLETS LIQUID GLASS */}
      <div className="sticky top-2 z-30 px-3 sm:px-6 py-2 max-w-5xl mx-auto">
        <div className="apple-glass rounded-full p-1.5 flex items-center justify-between gap-1 sm:gap-2 shadow-2xl border border-white/20 overflow-x-auto custom-scrollbar">
          
          <button
            onClick={() => setActiveTab('general')}
            className={`px-3 sm:px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'general'
                ? 'apple-glass-active text-white border-sky-400/50 shadow-[0_0_15px_rgba(56,189,248,0.3)]'
                : 'apple-glass-pill hover:bg-white/10 text-slate-300 hover:text-white'
            }`}
          >
            <UserIcon size={14} className={activeTab === 'general' ? 'text-sky-400' : 'text-slate-400'} />
            <span>Profil & Général</span>
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            className={`px-3 sm:px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'rules'
                ? 'apple-glass-active text-white border-indigo-400/50 shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                : 'apple-glass-pill hover:bg-white/10 text-slate-300 hover:text-white'
            }`}
          >
            <Sparkles size={14} className={activeTab === 'rules' ? 'text-indigo-400' : 'text-slate-400'} />
            <span>Règles & IA</span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-indigo-500/25 text-indigo-300 border border-indigo-400/30">
              {customRules.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('statements')}
            className={`px-3 sm:px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'statements'
                ? 'apple-glass-active text-white border-amber-400/50 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                : 'apple-glass-pill hover:bg-white/10 text-slate-300 hover:text-white'
            }`}
          >
            <Layers size={14} className={activeTab === 'statements' ? 'text-amber-400' : 'text-slate-400'} />
            <span>Relevés & Corbeille</span>
            {archivedItems.length > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500/25 text-amber-300 border border-amber-400/30">
                {archivedItems.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`px-3 sm:px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'security'
                ? 'apple-glass-active text-white border-rose-400/50 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                : 'apple-glass-pill hover:bg-white/10 text-slate-300 hover:text-white'
            }`}
          >
            <ShieldCheck size={14} className={activeTab === 'security' ? 'text-rose-400' : 'text-slate-400'} />
            <span>Sauvegarde & Sécurité</span>
          </button>

        </div>
      </div>

      {/* 4. CONTENU MODULAIRE DES ONGLETS */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8 mt-5 space-y-6">

        {/* ======================================================== */}
        {/* ONGLET 1 : PROFIL & SYSTÈME                               */}
        {/* ======================================================== */}
        {activeTab === 'general' && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            
            {/* Carte Profil Utilisateur */}
            <div className="apple-glass-card rounded-3xl p-5 sm:p-7 border-white/15 space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl apple-glass flex items-center justify-center text-sky-400 border border-sky-400/30">
                    <UserIcon size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Identité & Espace Privé</h3>
                    <p className="text-xs text-slate-400">Vos informations d'authentification et votre périmètre de travail</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-[11px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Session Active</span>
                </div>
              </div>

              {userProfile ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Nom affiché</span>
                    <p className="text-sm font-semibold text-white">{userProfile.displayName || 'Utilisateur CashPilot'}</p>
                    <p className="text-xs text-slate-400">{userProfile.email}</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Espace actif (Partition UID)</span>
                    <p className="text-sm font-mono font-bold text-cyan-300 truncate">
                      {userProfile.activeWorkspace || userProfile.uid}
                    </p>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Lock size={12} className="text-emerald-400" /> Données 100% isolées et non partagées
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-white/5 text-slate-400 text-xs">
                  Aucun profil utilisateur détecté. Vous naviguez en mode invité ou administrateur générique.
                </div>
              )}
            </div>

            {/* Carte Apparence & Thème */}
            <div className="apple-glass-card rounded-3xl p-5 sm:p-7 border-white/15 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl apple-glass flex items-center justify-center text-amber-400 border border-amber-400/30">
                    {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Apparence & Atmosphère Visuelle</h3>
                    <p className="text-xs text-slate-400">Basculez entre le Mode Sombre Finary / VisionOS et le Mode Clair haute lisibilité</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleToggleTheme}
                  className="px-4 py-2.5 rounded-2xl apple-glass-pill hover:bg-white/15 text-xs font-bold text-white flex items-center gap-2 border border-white/20 transition-all hover:scale-105 active:scale-95 cursor-pointer self-start sm:self-auto"
                >
                  {theme === 'dark' ? (
                    <>
                      <Sun size={15} className="text-amber-400" />
                      <span>Passer en Mode Clair</span>
                    </>
                  ) : (
                    <>
                      <Moon size={15} className="text-cyan-400" />
                      <span>Passer en Mode Sombre</span>
                    </>
                  )}
                </button>
              </div>

              {/* Sélecteur visuel interactif */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                <div
                  onClick={() => theme !== 'dark' && handleToggleTheme()}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    theme === 'dark'
                      ? 'apple-glass-active border-sky-400/50 shadow-lg'
                      : 'apple-glass-pill hover:bg-white/10 border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-cyan-400">
                      <Moon size={16} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Mode Sombre VisionOS</h4>
                      <p className="text-[11px] text-slate-400">Contraste luxury, liquid aura & verres fumés</p>
                    </div>
                  </div>
                  {theme === 'dark' && <CheckCircle2 size={18} className="text-sky-400" />}
                </div>

                <div
                  onClick={() => theme !== 'light' && handleToggleTheme()}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    theme === 'light'
                      ? 'apple-glass-active border-amber-400/50 shadow-lg'
                      : 'apple-glass-pill hover:bg-white/10 border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-amber-500">
                      <Sun size={16} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Mode Clair Haute Lisibilité</h4>
                      <p className="text-[11px] text-slate-400">Rendu épuré pour la bureautique de jour</p>
                    </div>
                  </div>
                  {theme === 'light' && <CheckCircle2 size={18} className="text-amber-400" />}
                </div>
              </div>
            </div>

            {/* Carte Diagnostics & Infrastructure */}
            <div className="apple-glass-card rounded-3xl p-5 sm:p-7 border-white/15 space-y-4">
              <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                <div className="w-10 h-10 rounded-2xl apple-glass flex items-center justify-center text-emerald-400 border border-emerald-400/30">
                  <HardDrive size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">État du Système & Diagnostic du Grand Livre</h3>
                  <p className="text-xs text-slate-400">Contrôle de conformité de la synchronisation locale et distante</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Moteur Cloud Firestore</span>
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Synchronisation 0 ms</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Devise Principale</span>
                  <div className="flex items-center gap-2 text-xs font-semibold text-white">
                    <span className="px-2 py-0.5 rounded-md bg-white/10 font-mono">{currency} (€)</span>
                    <span className="text-[11px] text-slate-400">Euro Standard</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Protocoles de Sécurité</span>
                  <div className="flex items-center gap-2 text-xs font-semibold text-sky-300">
                    <ShieldCheck size={14} className="text-sky-400" />
                    <span>Chiffrement AES-256</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* ONGLET 2 : RÈGLES & IA (Gestion & Preview Temps Réel)     */}
        {/* ======================================================== */}
        {activeTab === 'rules' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            
            {/* Header explicatif avec badge synchro */}
            <div className="apple-glass-card rounded-3xl p-5 sm:p-6 border-indigo-400/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl apple-glass text-indigo-400 border border-indigo-400/30 flex items-center justify-center shrink-0">
                  <BookmarkCheck size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-white">Règles & Abonnements Personnalisés</h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                      Synchronisé avec l'Assistant IA
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Définissez vos règles de catégorisation et précisions d'abonnements (ex: distinguer Google 2,99 € de Google 10,99 €). 
                    Le Coach IA et le grand livre appliquent ces règles instantanément sans recharger la page.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-400/30">
                  {customRules.length} règles ({subscriptionsCount} abonnements)
                </span>
              </div>
            </div>

            {/* FORMULAIRE D'ÉDITION AVEC LIVE PREVIEW */}
            <form onSubmit={handleSaveRule} className="apple-glass-card rounded-3xl p-5 sm:p-7 border-indigo-400/30 space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-300 flex items-center gap-2">
                  <Sparkles size={15} className="text-indigo-400" />
                  {editingRuleId ? 'Modifier la règle sélectionnée' : 'Créer une nouvelle règle ou clarifier un abonnement'}
                </span>
                {editingRuleId && (
                  <button
                    type="button"
                    onClick={resetRuleForm}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <X size={14} /> Annuler l'édition
                  </button>
                )}
              </div>

              {/* Champs principaux */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1.5">
                    Mot-clé bancaire détecté *
                  </label>
                  <input
                    type="text"
                    required
                    value={ruleForm.pattern}
                    onChange={e => setRuleForm(prev => ({ ...prev, pattern: e.target.value }))}
                    placeholder="Ex: GOOGLE, NETFLIX, SOBRIO"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-white/5 border border-white/15 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Mot présent dans le libellé bancaire</span>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1.5">
                    Montant exact (€) <span className="text-slate-400 font-normal">(optionnel)</span>
                  </label>
                  <input
                    type="text"
                    value={ruleForm.exactAmount}
                    onChange={e => setRuleForm(prev => ({ ...prev, exactAmount: e.target.value }))}
                    placeholder="Ex: 2.99 (vide = tout montant)"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-white/5 border border-white/15 text-white placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-400"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Pour distinguer plusieurs tarifs</span>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1.5">
                    Nom explicite à afficher *
                  </label>
                  <input
                    type="text"
                    required
                    value={ruleForm.customLabel}
                    onChange={e => setRuleForm(prev => ({ ...prev, customLabel: e.target.value }))}
                    placeholder="Ex: Google One (Stockage Cloud 100 Go)"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-white/5 border border-white/15 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Apparaîtra dans les graphiques et le Coach</span>
                </div>
              </div>

              {/* Catégories & Précision */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1.5">
                    Catégorie CashPilot
                  </label>
                  <select
                    value={ruleForm.category}
                    onChange={e => setRuleForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#0a0d18] border border-white/15 text-white focus:outline-none focus:border-indigo-400 cursor-pointer"
                  >
                    {AVAILABLE_CATEGORIES.map(cat => (
                      <option key={cat} value={cat} className="bg-[#0a0d18] text-white">
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1.5">
                    Poste Coût de la vie
                  </label>
                  <select
                    value={ruleForm.budgetPostName}
                    onChange={e => setRuleForm(prev => ({ ...prev, budgetPostName: e.target.value }))}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#0a0d18] border border-white/15 text-white focus:outline-none focus:border-indigo-400 cursor-pointer"
                  >
                    {DEFAULT_COST_OF_LIVING_ITEMS.map(item => (
                      <option key={item.id} value={item.name} className="bg-[#0a0d18] text-white">
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1.5">
                    Note ou précision contextuelle
                  </label>
                  <input
                    type="text"
                    value={ruleForm.customNote}
                    onChange={e => setRuleForm(prev => ({ ...prev, customNote: e.target.value }))}
                    placeholder="Ex: Stockage cloud photos famille"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-white/5 border border-white/15 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400"
                  />
                </div>
              </div>

              {/* CARTE PREVIEW EN DIRECT */}
              <div className="p-4 rounded-2xl bg-indigo-500/[0.08] border border-indigo-500/30 space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                  <Zap size={12} className="text-indigo-400" />
                  Aperçu en direct dans votre Grand Livre & Coach IA
                </span>
                <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-white">
                      {ruleForm.customLabel.trim() || 'Exemple de Libellé Nettoyé'}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30">
                      Mot-clé : {ruleForm.pattern.trim().toUpperCase() || 'MOT-CLÉ'}
                    </span>
                    {ruleForm.exactAmount.trim() && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                        = {Number(ruleForm.exactAmount.replace(',', '.')).toFixed(2)} €
                      </span>
                    )}
                    {ruleForm.isSubscription && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                        Abonnement Fixe
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-300 flex items-center gap-2">
                    <span className="text-emerald-400 font-semibold">{ruleForm.category}</span>
                    <span>•</span>
                    <span className="text-slate-400">{ruleForm.budgetPostName}</span>
                  </div>
                </div>
              </div>

              {/* Bouton de soumission & Checkbox */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <label className="flex items-center gap-2 text-xs text-white cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={ruleForm.isSubscription}
                    onChange={e => setRuleForm(prev => ({ ...prev, isSubscription: e.target.checked }))}
                    className="w-4 h-4 rounded border-white/20 text-indigo-500 focus:ring-0 bg-white/10 cursor-pointer"
                  />
                  <span>Considérer comme un abonnement récurrent / charge fixe</span>
                </label>

                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-sky-500 to-blue-600 hover:from-indigo-400 hover:to-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-500/25 hover:scale-105 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {editingRuleId ? <Check size={15} /> : <Plus size={15} />}
                  <span>{editingRuleId ? 'Enregistrer les modifications' : '+ Créer cette règle'}</span>
                </button>
              </div>
            </form>

            {/* BARRE DE RECHERCHE ET FILTRES */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={ruleSearchQuery}
                  onChange={e => setRuleSearchQuery(e.target.value)}
                  placeholder="Rechercher par mot-clé, libellé ou note..."
                  className="w-full pl-9 pr-4 py-2 rounded-2xl bg-white/5 border border-white/15 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter size={14} className="text-slate-400 shrink-0" />
                <select
                  value={ruleCategoryFilter}
                  onChange={e => setRuleCategoryFilter(e.target.value)}
                  className="px-3 py-2 rounded-2xl bg-[#0a0d18] border border-white/15 text-xs text-white focus:outline-none focus:border-indigo-400 cursor-pointer"
                >
                  <option value="ALL">Toutes les règles ({customRules.length})</option>
                  <option value="SUBSCRIPTIONS">Abonnements uniquement ({subscriptionsCount})</option>
                  {AVAILABLE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* GRILLE DES RÈGLES EXISTANTES */}
            {filteredCustomRules.length === 0 ? (
              <div className="apple-glass-card rounded-3xl p-8 text-center space-y-3 border-dashed border-white/20">
                <div className="w-12 h-12 rounded-2xl apple-glass mx-auto flex items-center justify-center text-slate-400">
                  <BookmarkCheck size={22} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-white">Aucune règle ne correspond à votre filtre</p>
                  <p className="text-[11px] text-slate-400 max-w-md mx-auto leading-relaxed">
                    Vous pouvez créer une règle ci-dessus ou simplement dire au Coach IA :{" "}
                    <em className="text-sky-300">« Le prélèvement Google de 2,99 € correspond à Google One »</em>.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredCustomRules.map(rule => (
                  <div
                    key={rule.id}
                    className="apple-glass-card rounded-2xl p-4 sm:p-5 border-white/15 flex items-start justify-between gap-3 group transition-all duration-300 hover:border-indigo-400/40"
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white truncate max-w-[200px]">
                          {rule.customLabel}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-400/30">
                          {rule.pattern}
                        </span>
                        {rule.exactAmount !== undefined && (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/30">
                            {Number(rule.exactAmount).toFixed(2)} €
                          </span>
                        )}
                        {rule.isSubscription && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300">
                            Abonnement
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-300 flex items-center gap-2 flex-wrap">
                        <span className="text-emerald-400 font-medium">{rule.category}</span>
                        {rule.budgetPostName && (
                          <>
                            <span>•</span>
                            <span className="text-slate-400">{rule.budgetPostName}</span>
                          </>
                        )}
                      </div>

                      {rule.customNote && (
                        <p className="text-[11px] text-slate-400 italic">« {rule.customNote} »</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEditRule(rule)}
                        className="p-2 rounded-xl text-slate-400 hover:text-sky-300 hover:bg-white/10 transition-colors cursor-pointer"
                        title="Modifier cette règle"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCustomRule(rule.id)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
                        title="Supprimer cette règle"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}

        {/* ======================================================== */}
        {/* ONGLET 3 : RELEVÉS & CORBEILLE                           */}
        {/* ======================================================== */}
        {activeTab === 'statements' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            
            {/* SOUS-SECTION A : ARCHIVAGE MENSUEL CIBLÉ */}
            <div className="apple-glass-card rounded-3xl p-5 sm:p-7 border-white/15 space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl apple-glass flex items-center justify-center text-sky-400 border border-sky-400/30">
                    <Layers size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Gestion & Archivage des Relevés Bancaires</h3>
                    <p className="text-xs text-slate-400">Déplacez un mois spécifique ou l'ensemble des opérations vers la Corbeille sécurisée</p>
                  </div>
                </div>
                <div className="text-xs font-mono text-slate-300">
                  {transactions.length} opération(s) en base
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                <div>
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                    Sélectionner la période cible
                  </label>
                  <div className="relative">
                    <select
                      value={selectedPeriodToDelete}
                      onChange={e => setSelectedPeriodToDelete(e.target.value)}
                      className="w-full appearance-none bg-[#0a0d18] border border-white/15 text-white text-xs sm:text-sm font-medium rounded-xl pl-9 pr-8 py-2.5 focus:outline-none focus:border-sky-400 cursor-pointer shadow-sm"
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
                    <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="flex flex-col justify-end">
                  <button
                    type="button"
                    onClick={() => setShowArchiveConfirmModal(true)}
                    disabled={targetsToDeleteCount === 0}
                    className="w-full py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95 cursor-pointer"
                  >
                    <Trash2 size={15} />
                    <span>Placer en Corbeille ({targetsToDeleteCount} opérations)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* SOUS-SECTION B : CORBEILLE DE RESTAURATION 1-CLIC */}
            <div className="apple-glass-card rounded-3xl p-5 sm:p-7 border-amber-400/25 space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl apple-glass flex items-center justify-center text-amber-400 border border-amber-400/30">
                    <Archive size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white">Corbeille & Éléments Archivés (Soft Delete)</h3>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                        Restauration 1-clic
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Les éléments supprimés par erreur ou via le Coach IA peuvent être restaurés instantanément ici.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/30 shrink-0">
                  {archivedItems.length} élément(s)
                </span>
              </div>

              {archivedItems.length === 0 ? (
                <div className="apple-glass-card rounded-2xl p-8 text-center space-y-2 border-dashed border-white/20">
                  <div className="w-12 h-12 rounded-2xl apple-glass mx-auto flex items-center justify-center text-slate-400">
                    <CheckCircle2 size={22} className="text-emerald-400" />
                  </div>
                  <p className="text-xs font-bold text-white">La corbeille est parfaitement vide</p>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    Aucun relevé, ticket ou transaction en attente de restauration.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
                  {archivedItems.map(item => (
                    <div
                      key={item.id}
                      className="apple-glass-pill rounded-2xl p-4 border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group transition-all hover:bg-white/10"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/25">
                            {item.targetType === 'receipt'
                              ? 'Ticket de caisse'
                              : item.targetType === 'statement'
                              ? 'Relevé mensuel'
                              : 'Transaction'}
                          </span>
                          <span className="text-xs font-bold text-white">{item.title}</span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {item.subtitle} • Mis en corbeille le {formatDateExplicit(item.deletedAt)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleRestoreItem(item.id, item.title)}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
                        >
                          <RotateCcw size={13} />
                          <span>Restaurer</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setItemToDeletePermanently({ id: item.id, label: item.title })}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
                          title="Supprimer définitivement"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* ONGLET 4 : SAUVEGARDE & SÉCURITÉ                          */}
        {/* ======================================================== */}
        {activeTab === 'security' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            
            {/* Exportation JSON Complète */}
            <div className="apple-glass-card rounded-3xl p-5 sm:p-7 border-emerald-500/25 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl apple-glass flex items-center justify-center text-emerald-400 border border-emerald-400/30">
                    <Download size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Exportation & Sauvegarde JSON</h3>
                    <p className="text-xs text-slate-400">
                      Téléchargez une copie intégrale de toutes vos opérations sous format JSON standard et portable
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={transactions.length === 0}
                  onClick={handleExportData}
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer self-start sm:self-auto"
                >
                  <Download size={15} />
                  <span>Exporter ({transactions.length} flux)</span>
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-slate-300 leading-relaxed">
                Ce fichier d'exportation contient l'intégralité de vos opérations enrichies, catégories, montants et comptes. 
                Conservez ce fichier dans un endroit sûr pour vos archives patrimoniales.
              </div>
            </div>

            {/* Architecture de Sécurité & Confidentialité */}
            <div className="apple-glass-card rounded-3xl p-5 sm:p-7 border-white/15 space-y-4">
              <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                <div className="w-10 h-10 rounded-2xl apple-glass flex items-center justify-center text-sky-400 border border-sky-400/30">
                  <Lock size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Chiffrement & Isolation des Données</h3>
                  <p className="text-xs text-slate-400">Principes de confidentialité appliqués à CashPilot</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-emerald-400" /> Isolation Firestore par UID
                  </span>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Vos données sont cloisonnées sous le chemin <code className="text-cyan-300 font-mono">/users/&#123;uid&#125;/</code>. Aucun utilisateur ni administrateur standard ne peut accéder à votre grand livre.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Zap size={14} className="text-sky-400" /> Confidentialité de l'IA Google Gemini
                  </span>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Les invites du Coach IA n'entraînent aucun modèle public tiers. Vos relevés restent cantonnés à votre session d'analyse.
                  </p>
                </div>
              </div>
            </div>

            {/* ZONE CRITIQUE : RÉINITIALISATION COMPLÈTE */}
            <div className="apple-glass-card rounded-3xl p-5 sm:p-7 border-rose-500/30 bg-rose-500/[0.04] space-y-4">
              <div className="flex items-center gap-3 text-rose-300">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0">
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Zone Critique du Compte</h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Effacer la totalité des données locales et distantes de l'application sur cet appareil.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-rose-500/20">
                <span className="text-xs text-slate-300 max-w-lg leading-relaxed">
                  Cette opération supprime tous les relevés bancaires, tickets, règles personnalisées et préférences de votre espace. Cette action est irréversible.
                </span>
                <button
                  type="button"
                  onClick={() => setShowResetConfirmModal(true)}
                  className="px-5 py-2.5 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer whitespace-nowrap self-start sm:self-auto shadow-lg shadow-rose-500/10"
                >
                  Réinitialiser tout l'espace
                </button>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* ======================================================== */}
      {/* MODALES LIQUID GLASS VISIONOS                            */}
      {/* ======================================================== */}

      {/* 1. Modal Confirmation Archivage Relevés */}
      {showArchiveConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            onClick={() => setShowArchiveConfirmModal(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-md cursor-pointer"
          />
          <div className="relative w-full max-w-md apple-glass bg-[#080a14]/95 border border-white/20 rounded-3xl p-6 shadow-2xl space-y-4 z-10 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="w-10 h-10 rounded-2xl apple-glass flex items-center justify-center border border-amber-400/30">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Confirmer la mise en corbeille</h3>
                <span className="text-[10px] uppercase font-bold text-amber-300 tracking-wider">Soft Delete Sécurisé</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Voulez-vous déplacer <strong className="text-white">{targetsToDeleteCount} transaction(s)</strong> correspondant à <strong className="text-cyan-300">{formatMonthLabel(selectedPeriodToDelete)}</strong> vers la Corbeille ?
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/10">
              Vos tableaux de bord et KPIs seront immédiatement mis à jour. Vous pourrez restaurer ces opérations en 1 clic à tout moment depuis l'onglet « Relevés & Corbeille ».
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowArchiveConfirmModal(false)}
                className="px-4 py-2 rounded-xl apple-glass-pill hover:bg-white/10 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={executeDeletePeriod}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-white text-xs font-bold transition-all shadow-lg shadow-rose-500/25 cursor-pointer"
              >
                Confirmer l'archivage
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal Confirmation Suppression Définitive */}
      {itemToDeletePermanently && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            onClick={() => setItemToDeletePermanently(null)}
            className="absolute inset-0 bg-black/70 backdrop-blur-md cursor-pointer"
          />
          <div className="relative w-full max-w-md apple-glass bg-[#080a14]/95 border border-rose-500/30 rounded-3xl p-6 shadow-2xl space-y-4 z-10 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Suppression Définitive</h3>
                <span className="text-[10px] uppercase font-bold text-rose-300 tracking-wider">Action Irréversible</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Êtes-vous certain de vouloir supprimer définitivement cet élément de la corbeille :{" "}
              <strong className="text-white">« {itemToDeletePermanently.label} »</strong> ?
            </p>
            <p className="text-[11px] text-rose-300/80 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
              Attention : Cet élément sera définitivement purgé du cache local et de Firestore. Aucune restauration ultérieure ne sera possible.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setItemToDeletePermanently(null)}
                className="px-4 py-2 rounded-xl apple-glass-pill hover:bg-white/10 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmPermanentDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                Purger définitivement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal Confirmation Réinitialisation Totale de l'App */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            onClick={() => setShowResetConfirmModal(false)}
            className="absolute inset-0 bg-black/75 backdrop-blur-md cursor-pointer"
          />
          <div className="relative w-full max-w-md apple-glass bg-[#080a14]/95 border border-rose-500/40 rounded-3xl p-6 shadow-2xl space-y-4 z-10 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center">
                <ShieldAlert size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Réinitialisation Complète</h3>
                <span className="text-[10px] uppercase font-bold text-rose-300 tracking-wider">Suppression de toutes les données</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Cette action supprimera toutes les transactions, tickets, soldes, règles IA et conversations archivées sur cet espace.
            </p>

            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-semibold text-slate-300 block">
                Pour confirmer, veuillez saisir <strong className="text-rose-400 font-mono">CONFIRMER</strong> ci-dessous :
              </label>
              <input
                type="text"
                value={resetConfirmationText}
                onChange={e => setResetConfirmationText(e.target.value)}
                placeholder="Tapez CONFIRMER"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-white/5 border border-rose-500/40 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-rose-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowResetConfirmModal(false);
                  setResetConfirmationText('');
                }}
                className="px-4 py-2 rounded-xl apple-glass-pill hover:bg-white/10 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={resetConfirmationText.trim().toUpperCase() !== 'CONFIRMER'}
                onClick={executeResetEntireApp}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white text-xs font-bold transition-all shadow-lg shadow-rose-600/30 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                Réinitialiser l'espace à neuf
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Settings;
