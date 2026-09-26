import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  ArrowLeftRight, 
  Search, 
  Upload, 
  Plus, 
  Trash2, 
  Sparkles, 
  X,
  Loader2,
  Calendar,
  Layers,
  FileSpreadsheet,
  Landmark,
  Wallet,
  Check,
  Pencil,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Key,
  Sliders,
  AlertTriangle,
  Users,
  UserCheck
} from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { BankFlowCharts } from '../../components/BankFlowCharts';
import { SubscriptionOptimizerDrawer } from '../../components/ui/SubscriptionOptimizerDrawer';
import { useTransactions } from '../../context/TransactionsContext';
import { 
  calculateReconciliation, 
  formatBankAmount, 
  detectStatementCurrency,
  type BankReconciliationResult 
} from '../../lib/kpiUtils';
import { getActiveAccountId } from '../../lib/userUtils';
import { auditAndEnrichTransactionsWithGemini, getGeminiApiKey } from '../../lib/geminiService';

export const SUBSCRIPTION_CATEGORIES = new Set([
  'Abonnements',
  'Abonnements & Télécom',
  'Box',
  'Énergie',
  'Logement & Énergie'
]);

import { 
  CATEGORIES, 
  classifyFlowType, 
  calculateBankMetrics, 
  calculateAccountSummaries,
  checkDuplicateTransactions, 
  detectAccountFromFilename,
  parseCSVBankStatement,
  smartCategorizeTransaction,
  cleanMerchantDescription,
  calculateSubscriptionSummary,
  formatMonthLabel,
  formatDateFR,
  formatCurrency,
  type FlowType, 
  type BankTransaction,
  type SubscriptionSummary
} from '../../lib/bankUtils';
import { KpiInfoTooltip } from '../../components/KpiInfoTooltip';
import { db, storage, functions } from '../../lib/firebase';
import { doc, deleteDoc, writeBatch, collection, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';

/**
 * Lecture robuste du contenu d'un fichier avec détection d'encodage (UTF-8, Windows-1252, ISO-8859-1)
 */
export async function readBankStatementFileText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const utf8Decoder = new TextDecoder('utf-8', { fatal: false });
  let text = utf8Decoder.decode(buffer);

  // Si des caractères de substitution (\uFFFD) sont détectés, décoder en Windows-1252 / ISO-8859-1
  if (text.includes('\uFFFD') || text.includes('\u00EF\u00BF\u00BD')) {
    try {
      const winDecoder = new TextDecoder('windows-1252', { fatal: false });
      const winText = winDecoder.decode(buffer);
      if (!winText.includes('\uFFFD')) {
        return winText;
      }
      text = winText;
    } catch {
      try {
        const isoDecoder = new TextDecoder('iso-8859-1', { fatal: false });
        return isoDecoder.decode(buffer);
      } catch {}
    }
  }

  return text;
}

export const BankStatements: React.FC = () => {
  const { 
    transactions: rawTransactions, 
    setTransactions: setRawTransactions,
    selectedMonth,
    setSelectedMonth,
    availableMonths
  } = useTransactions();

  // Local state for interactive features
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');
  const [selectedAccount, setSelectedAccount] = useState<string>('ALL');
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  
  // Modals & Panels
  const [isUploading, setIsUploading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkCategoryModalOpen, setIsBulkCategoryModalOpen] = useState(false);
  const [isBulkAccountModalOpen, setIsBulkAccountModalOpen] = useState(false);
  const [bulkTargetCategory, setBulkTargetCategory] = useState<string>(CATEGORIES[0]);
  const [bulkTargetAccount, setBulkTargetAccount] = useState<string>('');

  // Single Transaction Edit Modal State (Manual Override)
  const [editingTx, setEditingTx] = useState<BankTransaction | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    description: '',
    amount: '',
    category: 'Autre',
    flowType: 'VARIABLE_EXPENSE' as FlowType,
    isSubscription: false,
    subscriptionDay: 1,
    account: 'Compte Principal'
  });

  // Accounting Reconciliation & Bank Mirror States
  const [currency, setCurrency] = useState<'EUR' | 'CHF'>(() => {
    const saved = localStorage.getItem('cashpilot_statement_currency') || '';
    const detectedCurrency = detectStatementCurrency(saved);
    const currency = detectedCurrency || 'EUR';
    return currency;
  });
  const [transferFilter, setTransferFilter] = useState<'ALL' | 'EXPENSES_INCOME' | 'INTERNAL'>('ALL');
  
  // Custom or statement initial/closing balances per month
  const [customBalances, setCustomBalances] = useState<Record<string, { initial: number; closing: number }>>(() => {
    try {
      const saved = localStorage.getItem('cashpilot_monthly_balances');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [isEditBalanceModalOpen, setIsEditBalanceModalOpen] = useState(false);
  const [editBalanceForm, setEditBalanceForm] = useState({
    initialBalance: '',
    closingBalance: ''
  });

  // Expand / collapse subscription banner
  const [showSubscriptionDetails, setShowSubscriptionDetails] = useState(true);
  
  // Upload & File states
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [fileStatusMessage, setFileStatusMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Gemini Generative AI states
  const [isEnhancingWithGemini, setIsEnhancingWithGemini] = useState(false);
  const [isGeminiKeyModalOpen, setIsGeminiKeyModalOpen] = useState(false);
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState(() => getGeminiApiKey());

  // AI Subscription Optimizer Drawer State
  const [selectedSubscriptionTx, setSelectedSubscriptionTx] = useState<BankTransaction | null>(null);
  const [isOptimizerDrawerOpen, setIsOptimizerDrawerOpen] = useState(false);

  // Transfer Heuristics & Rules State (Family vs Self internal transfer)
  const [virementRules, setVirementRules] = useState<{
    userFirstName: string;
    userLastName: string;
    familyKeywords: string[];
    ownAccountsKeywords: string[];
  }>(() => {
    const defaultRules = {
      userFirstName: 'Kouroufia',
      userLastName: 'Dramé',
      familyKeywords: ['Naistaba', 'Nayssa', 'El Hani'],
      ownAccountsKeywords: ['Fortuneo', 'SG', 'Société Générale', 'Kouroufia', 'Compte Courant', 'Livret A', 'LDDS', 'Virement Interne']
    };
    try {
      const saved = localStorage.getItem('cashpilot_virement_rules');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          userFirstName: parsed.userFirstName || defaultRules.userFirstName,
          userLastName: parsed.userLastName || defaultRules.userLastName,
          familyKeywords: Array.isArray(parsed.familyKeywords) && parsed.familyKeywords.length > 0
            ? parsed.familyKeywords
            : defaultRules.familyKeywords,
          ownAccountsKeywords: Array.isArray(parsed.ownAccountsKeywords) && parsed.ownAccountsKeywords.length > 0
            ? parsed.ownAccountsKeywords
            : defaultRules.ownAccountsKeywords
        };
      }
    } catch {
      // fallback
    }
    return defaultRules;
  });

  const [isVirementRulesModalOpen, setIsVirementRulesModalOpen] = useState(false);
  const [newFamilyKeyword, setNewFamilyKeyword] = useState('');
  const [newOwnAccountKeyword, setNewOwnAccountKeyword] = useState('');

  // Online / Offline connectivity listener
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync customBalances when updated or deleted in Settings or another component
  useEffect(() => {
    const handleBalanceSync = () => {
      try {
        const saved = localStorage.getItem('cashpilot_monthly_balances');
        setCustomBalances(saved ? JSON.parse(saved) : {});
      } catch {
        setCustomBalances({});
      }
    };
    window.addEventListener('storage', handleBalanceSync);
    window.addEventListener('cashpilot_balances_updated', handleBalanceSync);
    return () => {
      window.removeEventListener('storage', handleBalanceSync);
      window.removeEventListener('cashpilot_balances_updated', handleBalanceSync);
    };
  }, []);

  // Form state for manual transaction
  const [manualTx, setManualTx] = useState({
    date: new Date().toISOString().substring(0, 10),
    description: '',
    amount: '',
    category: 'Alimentation & Courses',
    flowType: 'VARIABLE_EXPENSE' as FlowType,
    account: 'Compte Courant',
    customAccount: '',
    isSubscription: false,
    subscriptionDay: 1
  });

  // Convert raw Firestore transactions to BankTransaction models with strict flowType, smart categorization fallback and subscription detection
  const bankTransactions: BankTransaction[] = useMemo(() => {
    return rawTransactions.map(t => {
      const id = String(t.id || `tx_${t.date}_${t.amount}_${Math.random()}`);
      // RÈGLE : Analyse rigoureusement le Libellé complet (rawLabel)
      const rawDesc = t.rawLabel || t.description || t.cleanLabel || 'Opération';
      const cleanDesc = t.cleanLabel || (t.description && t.description !== t.rawLabel ? t.description : cleanMerchantDescription(rawDesc));
      const amount = Number(t.amount) || 0;
      
      // Auto-analyse intelligente du libellé complet si catégorie manquante ou 'Autre'
      const smart = smartCategorizeTransaction(rawDesc, amount, t.date);
      // Correction proactive : si un montant positif a été indûment étiqueté en SAVINGS_TRANSFER alors qu'il s'agit d'un revenu réel (tiers, proche, alloc)
      const isSuspectSavings = amount > 0 && (t.flowType === 'SAVINGS_TRANSFER' || t.category === 'Épargne & Investissement') && smart.flowType === 'INCOME';
      const category = isSuspectSavings
        ? smart.category
        : ((t.category && t.category !== 'Autre') ? t.category : smart.category);
      const flowType: FlowType = isSuspectSavings
        ? 'INCOME'
        : (t.flowType || (category === smart.category ? smart.flowType : classifyFlowType(category, amount, rawDesc)));
      const account = t.accountName || t.account || 'Compte Principal';
      const bankName = t.bankName || (account.includes(' - ') ? account.split(' - ')[0] : account);
      const isSubscription = t.isSubscription !== undefined 
        ? Boolean(t.isSubscription) 
        : (category === 'Abonnements & Télécom' || smart.isSubscription);
      const subscriptionDay = t.subscriptionDay !== undefined && t.subscriptionDay !== null
        ? Number(t.subscriptionDay)
        : (smart.subscriptionDay || (t.date ? parseInt(t.date.split('-')[2], 10) : undefined));

      const rawAmount = amount;
      const isCredit = rawAmount > 0;
      const type: 'debit' | 'credit' = isCredit ? 'credit' : 'debit';
      const absAmount = Math.abs(rawAmount);

      // 2. Heuristique Stricte & Dynamique : Virements Internes (Comptes Propres) vs Famille & Proches
      const rawText = `${rawDesc} ${cleanDesc} ${category}`.toLowerCase();
      const rawTextUpper = `${rawDesc} ${cleanDesc}`.toUpperCase();

      // Règle Critique Stricte : Tout libellé contenant "Nayssa", "Naustaba", "Naistaba", "El Hani" ou "Dramé" (sans son prénom "Kouroufia")
      // est FORMELLEMENT exclu des virements internes et constitue une dépense ou un revenu réel.
      const hasFamilySubstring = 
        rawTextUpper.includes('NAYSSA') ||
        rawTextUpper.includes('NAUSTABA') ||
        rawTextUpper.includes('NAISTABA') ||
        rawTextUpper.includes('EL HANI') ||
        ((rawTextUpper.includes('DRAMÉ') || rawTextUpper.includes('DRAME')) && !rawTextUpper.includes('KOUROUFIA'));

      const matchesFamily = hasFamilySubstring || virementRules.familyKeywords.some(kw => {
        const k = kw.trim().toLowerCase();
        return k.length > 0 && rawText.includes(k);
      });

      // Vérifie si la transaction mentionne le prénom propre de l'utilisateur (Kouroufia)
      // Permet d'identifier avec certitude "DRAME Kouroufia" (son 2nd compte perso propre) !
      const matchesUserFirstName = rawTextUpper.includes('KOUROUFIA') || (virementRules.userFirstName.trim()
        ? rawText.includes(virementRules.userFirstName.trim().toLowerCase())
        : false);

      // Les virements internes restent limités aux mouvements de comptes propres ("Fortuneo", "SG", "Société Générale", "Virement Interne", ou son 2nd compte perso)
      const matchesOwnAccount = 
        /\bSG\b/i.test(rawText) ||
        rawText.includes('société générale') ||
        rawText.includes('societe generale') ||
        rawText.includes('fortuneo') ||
        rawText.includes('virement interne') ||
        virementRules.ownAccountsKeywords.some(kw => {
          const k = kw.trim().toLowerCase();
          if (!k) return false;
          if (k === 'sg') return /\bsg\b/i.test(rawText);
          return rawText.includes(k);
        });

      let isInternalTransfer = false;
      let isFamilyTransfer = false;

      if (t.isInternalTransfer !== undefined && t.isInternalTransfer !== null) {
        // Respect d'un forçage ou ajustement manuel
        isInternalTransfer = Boolean(t.isInternalTransfer);
        isFamilyTransfer = !isInternalTransfer && (matchesFamily || category === 'Virements Famille & Proches');
      } else if (matchesFamily) {
        // Priorité absolue : Si le nom d'un proche est présent, ce n'est JAMAIS un virement interne
        isInternalTransfer = false;
        isFamilyTransfer = true;
      } else if (matchesUserFirstName || matchesOwnAccount) {
        // Uniquement les comptes propres de l'utilisateur
        isInternalTransfer = true;
        isFamilyTransfer = false;
      }

      // Ajustement intelligent de la catégorie et du flux financier
      let finalCategory = category;
      if (isFamilyTransfer) {
        if (category === 'Autre' || category === 'Virements Internes' || category.includes('Virement')) {
          finalCategory = 'Virements Famille & Proches';
        }
      } else if (isInternalTransfer && category === 'Autre') {
        finalCategory = 'Virements Internes';
      }

      // Si c'est un virement familial / tiers, il s'agit d'une dépense ou d'un revenu réel (pas neutralisé en épargne)
      const correctedFlowType: FlowType = isFamilyTransfer
        ? (rawAmount > 0 ? 'INCOME' : 'VARIABLE_EXPENSE')
        : (isInternalTransfer ? 'SAVINGS_TRANSFER' : flowType);

      return {
        id,
        date: t.date || new Date().toISOString().substring(0, 10),
        description: cleanDesc,
        amount: absAmount,
        rawAmount,
        type,
        isInternalTransfer,
        isFamilyTransfer,
        flowType: correctedFlowType,
        category: finalCategory,
        account,
        bankName,
        isSubscription,
        subscriptionDay,
        confidence: smart.confidence,
        status: isInternalTransfer ? 'Internal Transfer' : 'Reconciled',
        monthKey: t.monthKey || (t.date ? t.date.substring(0, 7) : undefined),
        rawLabel: t.rawLabel || rawDesc,
        cleanLabel: cleanDesc
      };
    });
  }, [rawTransactions, virementRules]);

  // List of all distinct bank accounts discovered across transactions
  const availableAccounts = useMemo(() => {
    const set = new Set<string>();
    bankTransactions.forEach(t => {
      if (t.account) set.add(t.account);
    });
    if (set.size === 0) set.add('Compte Courant');
    return Array.from(set);
  }, [bankTransactions]);

  // Transactions filtered by selected month (for metrics and accounts breakdown)
  const monthScopedTransactions = useMemo(() => {
    if (selectedMonth === 'all') return bankTransactions;
    return bankTransactions.filter(t => t.monthKey === selectedMonth || t.date.startsWith(selectedMonth));
  }, [bankTransactions, selectedMonth]);

  // Active initial and closing balance for current selected month
  const currentMonthBalances = useMemo(() => {
    if (monthScopedTransactions.length === 0) {
      return { initial: 0, closing: 0 };
    }
    const monthKey = selectedMonth === 'all' ? (availableMonths[0] || '') : selectedMonth;
    if (monthKey && customBalances[monthKey]) {
      return customBalances[monthKey];
    }
    return { initial: 0, closing: 0 };
  }, [selectedMonth, availableMonths, customBalances, monthScopedTransactions.length]);

  // Strict Accounting Reconciliation calculation (Swiss banking standard)
  const reconciliation: BankReconciliationResult = useMemo(() => {
    const scopedTxs = selectedAccount === 'ALL'
      ? monthScopedTransactions
      : monthScopedTransactions.filter(t => t.account === selectedAccount);

    return calculateReconciliation(
      currentMonthBalances.initial,
      currentMonthBalances.closing,
      scopedTxs.map(t => ({ type: t.type as 'debit' | 'credit', amount: t.amount }))
    );
  }, [monthScopedTransactions, selectedAccount, currentMonthBalances]);

  // Financial summary per bank account for the selected period
  const accountSummaries = useMemo(() => {
    return calculateAccountSummaries(monthScopedTransactions);
  }, [monthScopedTransactions]);

  // Financial Metrics (Calculated either for all accounts consolidated, or scoped to a specific account)
  const metrics = useMemo(() => {
    const scopedTxs = selectedAccount === 'ALL'
      ? monthScopedTransactions
      : monthScopedTransactions.filter(t => t.account === selectedAccount);

    return calculateBankMetrics(scopedTxs);
  }, [monthScopedTransactions, selectedAccount]);

  // Subscription & Recurring Charges Summary for the scoped view
  const subscriptionSummary: SubscriptionSummary = useMemo(() => {
    const scopedTxs = selectedAccount === 'ALL'
      ? monthScopedTransactions
      : monthScopedTransactions.filter(t => t.account === selectedAccount);

    return calculateSubscriptionSummary(scopedTxs);
  }, [monthScopedTransactions, selectedAccount]);


  // Filtered & Searched Transaction List for the table
  const filteredTransactions = useMemo(() => {
    return monthScopedTransactions.filter(t => {
      // Account filter
      if (selectedAccount !== 'ALL' && t.account !== selectedAccount) {
        return false;
      }

      // Text search filter
      const search = searchTerm.toLowerCase().trim();
      if (search) {
        const matchDesc = t.description.toLowerCase().includes(search);
        const matchCat = t.category.toLowerCase().includes(search);
        const matchAmt = String(t.amount).includes(search);
        const matchAcc = (t.account || '').toLowerCase().includes(search);
        const matchBank = (t.bankName || '').toLowerCase().includes(search);
        if (!matchDesc && !matchCat && !matchAmt && !matchAcc && !matchBank) return false;
      }

      // Internal transfer segmented filter
      if (transferFilter === 'EXPENSES_INCOME' && t.isInternalTransfer) return false;
      if (transferFilter === 'INTERNAL' && !t.isInternalTransfer) return false;

      // Flow type & Subscription filter
      if (selectedFilter === 'ALL') return true;
      if (selectedFilter === 'INCOME') return t.flowType === 'INCOME';
      if (selectedFilter === 'FIXED') return t.flowType === 'FIXED_EXPENSE';
      if (selectedFilter === 'VARIABLE') return t.flowType === 'VARIABLE_EXPENSE';
      if (selectedFilter === 'SUBSCRIPTION') return Boolean(t.isSubscription || t.category === 'Abonnements & Télécom');
      if (selectedFilter === 'EXPENSE') return t.flowType === 'FIXED_EXPENSE' || t.flowType === 'VARIABLE_EXPENSE';
      if (selectedFilter === 'SAVINGS') return t.flowType === 'SAVINGS_TRANSFER';
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [monthScopedTransactions, selectedAccount, searchTerm, selectedFilter, transferFilter]);

  // Auto-hide notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Synchronisation automatique en arrière-plan avec Gemini pour les opérations 'Autre' et les flux d'encaissement suspects
  const autoGeminiRunRef = useRef(false);
  useEffect(() => {
    if (autoGeminiRunRef.current || !rawTransactions || rawTransactions.length === 0) return;

    // Repérer les opérations en base ayant 'Autre' ou les rentrées d'argent indûment classées en épargne
    const unclassifiedInDb = rawTransactions.filter(t => {
      if (t.category === 'Autre') return true;
      const amt = Number(t.amount) || 0;
      if (amt > 0 && (t.flowType === 'SAVINGS_TRANSFER' || t.category === 'Épargne & Investissement')) {
        const raw = (t.rawLabel || t.description || '').toLowerCase();
        return raw.includes('nayssa') || raw.includes('el hani') || raw.includes('naistaba') || raw.includes('generation') || raw.includes('cpam') || raw.includes('wero');
      }
      return false;
    });
    if (unclassifiedInDb.length === 0) return;

    autoGeminiRunRef.current = true;
    (async () => {
      try {
        const accountId = getActiveAccountId();
        const geminiResults = await auditAndEnrichTransactionsWithGemini(
          unclassifiedInDb.filter(t => Boolean(t.id)).map(t => ({
            id: String(t.id),
            date: t.date || '',
            amount: Number(t.amount) || 0,
            rawLabel: t.rawLabel || '',
            description: t.description || '',
            category: t.category || 'Autre',
            flowType: t.flowType as any
          }))
        );

        const geminiMap = new Map(geminiResults.map(r => [r.id, r]));
        const batch = writeBatch(db);
        let count = 0;

        unclassifiedInDb.forEach(t => {
          if (!t.id) return;
          const res = geminiMap.get(t.id);
          if (res && CATEGORIES.includes(res.category)) {
            const docRef = doc(db, `users/${accountId}/transactions`, t.id);
            batch.update(docRef, {
              category: res.category,
              flowType: res.flowType,
              description: res.cleanDesc || t.description,
              nature: res.flowType === 'FIXED_EXPENSE' ? 'fixe' : res.flowType === 'VARIABLE_EXPENSE' ? 'variable' : 'autre',
              confidence: 'high',
              aiStatus: 'gemini_enhanced',
              aiExplanation: res.explanation,
              updatedAt: new Date().toISOString()
            });
            count++;
          }
        });

        if (count > 0) {
          await batch.commit();
          console.log(`Auto-Gemini background: ${count} transactions auditées et synchronisées avec succès.`);
        }
      } catch (err) {
        console.warn('Auto-Gemini background sync skipped:', err);
      }
    })();
  }, [rawTransactions]);

  // Basculer un virement entre "Virement Interne (Mes comptes)" et "Famille & Proches" en 1 clic
  const handleToggleVirementType = async (tx: BankTransaction) => {
    const willBeInternal = !tx.isInternalTransfer;
    const newCat = willBeInternal ? 'Virements Internes' : 'Virements Famille & Proches';
    const newFlow: FlowType = willBeInternal ? 'SAVINGS_TRANSFER' : (tx.rawAmount > 0 ? 'INCOME' : 'VARIABLE_EXPENSE');

    // Mise à jour optimiste locale
    setRawTransactions(prev => prev.map(t => t.id === tx.id ? {
      ...t,
      isInternalTransfer: willBeInternal,
      category: newCat,
      flowType: newFlow
    } : t));

    try {
      const accountId = getActiveAccountId();
      const docRef = doc(db, `users/${accountId}/transactions`, tx.id);
      await updateDoc(docRef, {
        isInternalTransfer: willBeInternal,
        category: newCat,
        flowType: newFlow,
        nature: willBeInternal ? 'autre' : 'variable',
        updatedAt: new Date().toISOString()
      });

      setNotification({
        type: 'success',
        message: willBeInternal 
          ? `Reclassé en "Virement Interne (Mes comptes)" (neutralisé en trésorerie).` 
          : `Reclassé en "Famille & Proches" (comptabilisé en flux réel).`
      });
    } catch (err) {
      console.error("Erreur toggle virement:", err);
      setNotification({
        type: 'error',
        message: "Erreur lors de la mise à jour."
      });
    }
  };

  // Sauvegarde des règles de virement dans le localStorage
  const handleSaveVirementRules = (updated: typeof virementRules) => {
    setVirementRules(updated);
    try {
      localStorage.setItem('cashpilot_virement_rules', JSON.stringify(updated));
      setNotification({
        type: 'success',
        message: 'Règles de détection des virements enregistrées avec succès !'
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddFamilyKeyword = () => {
    const kw = newFamilyKeyword.trim();
    if (!kw) return;
    if (virementRules.familyKeywords.map(k => k.toLowerCase()).includes(kw.toLowerCase())) {
      setNewFamilyKeyword('');
      return;
    }
    const updated = {
      ...virementRules,
      familyKeywords: [...virementRules.familyKeywords, kw]
    };
    handleSaveVirementRules(updated);
    setNewFamilyKeyword('');
  };

  const handleRemoveFamilyKeyword = (kwToRemove: string) => {
    const updated = {
      ...virementRules,
      familyKeywords: virementRules.familyKeywords.filter(k => k !== kwToRemove)
    };
    handleSaveVirementRules(updated);
  };

  const handleAddOwnAccountKeyword = () => {
    const kw = newOwnAccountKeyword.trim();
    if (!kw) return;
    if (virementRules.ownAccountsKeywords.map(k => k.toLowerCase()).includes(kw.toLowerCase())) {
      setNewOwnAccountKeyword('');
      return;
    }
    const updated = {
      ...virementRules,
      ownAccountsKeywords: [...virementRules.ownAccountsKeywords, kw]
    };
    handleSaveVirementRules(updated);
    setNewOwnAccountKeyword('');
  };

  const handleRemoveOwnAccountKeyword = (kwToRemove: string) => {
    const updated = {
      ...virementRules,
      ownAccountsKeywords: virementRules.ownAccountsKeywords.filter(k => k !== kwToRemove)
    };
    handleSaveVirementRules(updated);
  };

  // 1. Inline Category Change with Firestore sync
  const handleCategoryChange = async (id: string, newCategory: string) => {
    const tx = bankTransactions.find(t => t.id === id);
    if (!tx) return;

    const newFlowType = classifyFlowType(newCategory, tx.amount, tx.description);
    const isSub = newCategory === 'Abonnements & Télécom' || (tx.isSubscription && newFlowType === 'FIXED_EXPENSE');

    // Optimistic local update for 0ms latency
    setRawTransactions(prev => prev.map(t => t.id === id ? {
      ...t,
      category: newCategory,
      flowType: newFlowType,
      isSubscription: isSub,
      nature: newFlowType === 'FIXED_EXPENSE' ? 'fixe' : newFlowType === 'VARIABLE_EXPENSE' ? 'variable' : 'autre'
    } : t));

    try {
      const accountId = getActiveAccountId();
      const docRef = doc(db, `users/${accountId}/transactions`, id);
      
      await updateDoc(docRef, {
        category: newCategory,
        flowType: newFlowType,
        isSubscription: isSub,
        nature: newFlowType === 'FIXED_EXPENSE' ? 'fixe' : newFlowType === 'VARIABLE_EXPENSE' ? 'variable' : 'autre',
        updatedAt: new Date().toISOString()
      });

      setNotification({
        type: 'success',
        message: `Catégorie mise à jour : ${newCategory}`
      });
    } catch (err) {
      console.error("Erreur lors de la mise à jour de la catégorie:", err);
      setNotification({
        type: 'error',
        message: "Échec de la synchronisation Firestore."
      });
    }
  };

  // Open Edit Modal for Single Transaction (Manual Override)
  const handleOpenEditModal = (tx: BankTransaction) => {
    setEditingTx(tx);
    setEditForm({
      description: tx.description,
      amount: String(Math.abs(tx.amount)),
      category: tx.category,
      flowType: tx.flowType,
      isSubscription: Boolean(tx.isSubscription),
      subscriptionDay: tx.subscriptionDay || (tx.date ? parseInt(tx.date.split('-')[2], 10) : 1),
      account: tx.account || 'Compte Principal'
    });
    setIsEditModalOpen(true);
  };

  // Save changes from Edit Modal
  const handleSaveEditModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;

    try {
      const accountId = getActiveAccountId();
      const docRef = doc(db, `users/${accountId}/transactions`, editingTx.id);

      const parsedAmt = parseFloat(editForm.amount.replace(',', '.'));
      const finalAmount = !isNaN(parsedAmt)
        ? (editForm.flowType === 'INCOME' ? Math.abs(parsedAmt) : -Math.abs(parsedAmt))
        : editingTx.amount;

      const bankName = editForm.account.includes(' - ') ? editForm.account.split(' - ')[0] : editForm.account;

      await updateDoc(docRef, {
        description: editForm.description.trim(),
        cleanLabel: editForm.description.trim(),
        category: editForm.category,
        flowType: editForm.flowType,
        nature: editForm.flowType === 'FIXED_EXPENSE' ? 'fixe' : editForm.flowType === 'VARIABLE_EXPENSE' ? 'variable' : 'autre',
        isSubscription: editForm.isSubscription,
        subscriptionDay: editForm.isSubscription ? Number(editForm.subscriptionDay) : null,
        accountName: editForm.account,
        bankName,
        amount: finalAmount,
        direction: finalAmount > 0 ? 'credit' : 'debit',
        updatedAt: new Date().toISOString()
      });

      setIsEditModalOpen(false);
      setEditingTx(null);
      setNotification({
        type: 'success',
        message: `Opération mise à jour : ${editForm.category} (${editForm.flowType === 'FIXED_EXPENSE' ? 'Charge Fixe' : editForm.flowType === 'VARIABLE_EXPENSE' ? 'Dépense Courante' : editForm.flowType})`
      });
    } catch (err) {
      console.error("Erreur mise à jour transaction:", err);
      setNotification({
        type: 'error',
        message: "Échec de la sauvegarde de la transaction."
      });
    }
  };

  // AI Auto-Categorize for Selected or Visible Transactions
  const handleAutoCategorizeSelected = async () => {
    const idsToProcess = selectedTxIds.size > 0 
      ? Array.from(selectedTxIds) 
      : monthScopedTransactions.filter(t => t.category === 'Autre').map(t => t.id);

    if (idsToProcess.length === 0) {
      setNotification({
        type: 'info',
        message: "Toutes les opérations visibles sont déjà catégorisées avec précision."
      });
      return;
    }

    try {
      const accountId = getActiveAccountId();
      const batch = writeBatch(db);
      let updatedCount = 0;

      idsToProcess.forEach(id => {
        const tx = bankTransactions.find(t => t.id === id);
        if (!tx) return;
        const rawDesc = tx.rawLabel || tx.description;
        const smart = smartCategorizeTransaction(rawDesc, tx.amount, tx.date);
        const cleanDesc = tx.cleanLabel || cleanMerchantDescription(rawDesc);
        const docRef = doc(db, `users/${accountId}/transactions`, id);
        batch.update(docRef, {
          description: cleanDesc,
          cleanLabel: cleanDesc,
          category: smart.category,
          flowType: smart.flowType,
          nature: smart.flowType === 'FIXED_EXPENSE' ? 'fixe' : smart.flowType === 'VARIABLE_EXPENSE' ? 'variable' : 'autre',
          isSubscription: smart.isSubscription,
          subscriptionDay: smart.subscriptionDay || null,
          updatedAt: new Date().toISOString()
        });
        updatedCount++;
      });

      await batch.commit();
      setSelectedTxIds(new Set());
      setNotification({
        type: 'success',
        message: `${updatedCount} opérations analysées et reclassées automatiquement par l'IA !`
      });
    } catch (err) {
      console.error("Erreur auto-catégorisation:", err);
      setNotification({
        type: 'error',
        message: "Erreur lors de l'analyse automatique des transactions."
      });
    }
  };

  // Google Gemini Generative AI Categorization Fallback & Flow Audit
  const handleGeminiCategorization = async () => {
    const targets = selectedTxIds.size > 0
      ? monthScopedTransactions.filter(t => selectedTxIds.has(t.id))
      : monthScopedTransactions.filter(t => t.category === 'Autre' || (t.amount > 0 && t.flowType === 'SAVINGS_TRANSFER'));

    if (targets.length === 0) {
      setNotification({
        type: 'info',
        message: 'Toutes les opérations visibles sont déjà catégorisées avec précision.'
      });
      return;
    }

    const currentKey = getGeminiApiKey();
    if (!currentKey) {
      setIsGeminiKeyModalOpen(true);
      return;
    }

    setIsEnhancingWithGemini(true);
    try {
      const results = await auditAndEnrichTransactionsWithGemini(
        targets.map(t => ({
          id: t.id,
          date: t.date,
          amount: Number(t.amount) || 0,
          rawLabel: t.rawLabel,
          description: t.description,
          category: t.category,
          flowType: t.flowType
        }))
      );
      const resultMap = new Map(results.map(r => [r.id, r]));

      const accountId = getActiveAccountId();
      const batch = writeBatch(db);
      let updatedCount = 0;

      targets.forEach(tx => {
        const res = resultMap.get(tx.id);
        if (res && CATEGORIES.includes(res.category)) {
          const docRef = doc(db, `users/${accountId}/transactions`, tx.id);
          batch.update(docRef, {
            category: res.category,
            flowType: res.flowType,
            description: res.cleanDesc || tx.description,
            nature: res.flowType === 'FIXED_EXPENSE' ? 'fixe' : res.flowType === 'VARIABLE_EXPENSE' ? 'variable' : 'autre',
            confidence: 'high',
            aiStatus: 'gemini_enhanced',
            aiExplanation: res.explanation,
            updatedAt: new Date().toISOString()
          });
          updatedCount++;
        }
      });

      if (updatedCount > 0) {
        await batch.commit();
        setSelectedTxIds(new Set());
        setNotification({
          type: 'success',
          message: `${updatedCount} opération${updatedCount > 1 ? 's' : ''} analysée${updatedCount > 1 ? 's' : ''} et catégorisée${updatedCount > 1 ? 's' : ''} avec succès par Google Gemini !`
        });
      } else {
        setNotification({
          type: 'info',
          message: 'Gemini n\'a pas trouvé de correspondance catégorielle certaine pour ces libellés.'
        });
      }
    } catch (err: any) {
      console.error('Erreur catégorisation Gemini:', err);
      if (err?.message?.includes('Clé API') || err?.message?.includes('API_KEY') || err?.message?.includes('Google AI Studio')) {
        setIsGeminiKeyModalOpen(true);
      }
      setNotification({
        type: 'error',
        message: err?.message || "Erreur lors de l'appel à Google Gemini."
      });
    } finally {
      setIsEnhancingWithGemini(false);
    }
  };

  // 2. Single Delete with Firestore sync
  const handleDelete = async (id: string) => {
    if (!window.confirm("Supprimer définitivement cette transaction ?")) return;

    try {
      const accountId = getActiveAccountId();
      await deleteDoc(doc(db, `users/${accountId}/transactions`, id));


      setSelectedTxIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });

      setNotification({
        type: 'info',
        message: "Transaction supprimée avec succès."
      });
    } catch (err) {
      console.error("Erreur suppression transaction:", err);
      setNotification({
        type: 'error',
        message: "Impossible de supprimer la transaction."
      });
    }
  };

  // 3. Selection Handlers
  const handleToggleSelect = (id: string) => {
    setSelectedTxIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedTxIds.size === filteredTransactions.length) {
      setSelectedTxIds(new Set());
    } else {
      setSelectedTxIds(new Set(filteredTransactions.map(t => t.id)));
    }
  };

  // 4. Bulk Delete with writeBatch
  const handleDeleteSelected = async () => {
    const count = selectedTxIds.size;
    if (count === 0) return;
    if (!window.confirm(`Supprimer ces ${count} transactions sélectionnées ?`)) return;

    try {
      const accountId = getActiveAccountId();
      const batch = writeBatch(db);

      selectedTxIds.forEach(id => {
        const docRef = doc(db, `users/${accountId}/transactions`, id);
        batch.delete(docRef);
      });

      await batch.commit();
      setSelectedTxIds(new Set());
      setNotification({
        type: 'info',
        message: `${count} transactions supprimées en lot.`
      });
    } catch (err) {
      console.error("Erreur suppression groupée:", err);
      setNotification({
        type: 'error',
        message: "Erreur lors de la suppression en lot."
      });
    }
  };

  // 4b. Purge entire current month statement or all statements directly from BankStatements
  const handlePurgeScope = async () => {
    if (monthScopedTransactions.length === 0) return;
    const isAll = selectedMonth === 'all';
    const targetLabel = isAll ? 'toutes les opérations de tous vos relevés' : `toutes les opérations de ${formatMonthLabel(selectedMonth)}`;
    if (!window.confirm(`Supprimer définitivement ${targetLabel} (${monthScopedTransactions.length} transaction${monthScopedTransactions.length > 1 ? 's' : ''}) ?`)) {
      return;
    }

    try {
      const accountId = getActiveAccountId();
      const idsToDelete = monthScopedTransactions.map(t => t.id);

      // 1. Suppression Firestore
      for (let i = 0; i < idsToDelete.length; i += 400) {
        const chunk = idsToDelete.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach(id => {
          const docRef = doc(db, `users/${accountId}/transactions`, id);
          batch.delete(docRef);
        });
        await batch.commit();
      }

      // 2. Nettoyage LocalStorage & balances
      if (isAll) {
        localStorage.removeItem('cashpilot_monthly_balances');
        localStorage.removeItem('cashpilot_transactions');
        localStorage.removeItem('cashpilot_tx_cache');
        setCustomBalances({});
      } else {
        const updatedBalances = { ...customBalances };
        delete updatedBalances[selectedMonth];
        setCustomBalances(updatedBalances);
        localStorage.setItem('cashpilot_monthly_balances', JSON.stringify(updatedBalances));
        
        try {
          const raw = localStorage.getItem('cashpilot_tx_cache');
          if (raw) {
            const parsed = JSON.parse(raw);
            const filtered = parsed.filter((t: any) => !idsToDelete.includes(t.id));
            localStorage.setItem('cashpilot_tx_cache', JSON.stringify(filtered));
            localStorage.setItem('cashpilot_transactions', JSON.stringify(filtered));
          }
        } catch (e) {}
      }

      setSelectedTxIds(new Set());
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('cashpilot_balances_updated'));

      setNotification({
        type: 'success',
        message: `${idsToDelete.length} opération${idsToDelete.length > 1 ? 's' : ''} supprimée${idsToDelete.length > 1 ? 's' : ''} avec succès.`
      });
    } catch (err: any) {
      console.error("Erreur suppression relevé:", err);
      setNotification({
        type: 'error',
        message: "Erreur lors de la suppression du relevé."
      });
    }
  };

  // 5. Bulk Category Update
  const handleBulkCategoryApply = async () => {
    const count = selectedTxIds.size;
    if (count === 0) return;

    try {
      const accountId = getActiveAccountId();
      const batch = writeBatch(db);

      selectedTxIds.forEach(id => {
        const tx = bankTransactions.find(t => t.id === id);
        const flow = tx ? classifyFlowType(bulkTargetCategory, tx.amount, tx.description) : 'VARIABLE_EXPENSE';
        const docRef = doc(db, `users/${accountId}/transactions`, id);
        batch.update(docRef, {
          category: bulkTargetCategory,
          flowType: flow,
          nature: flow === 'FIXED_EXPENSE' ? 'fixe' : flow === 'VARIABLE_EXPENSE' ? 'variable' : 'autre',
          updatedAt: new Date().toISOString()
        });
      });

      await batch.commit();
      setIsBulkCategoryModalOpen(false);
      setSelectedTxIds(new Set());
      setNotification({
        type: 'success',
        message: `${count} transactions reclassées en "${bulkTargetCategory}".`
      });
    } catch (err) {
      console.error("Erreur réassignation groupée:", err);
      setNotification({
        type: 'error',
        message: "Erreur lors du changement de catégorie en lot."
      });
    }
  };

  // 6. Bulk Account Reassignment
  const handleBulkAccountApply = async () => {
    const count = selectedTxIds.size;
    const targetAccount = bulkTargetAccount.trim();
    if (count === 0 || !targetAccount) return;

    try {
      const accountId = getActiveAccountId();
      const batch = writeBatch(db);
      const bankName = targetAccount.includes(' - ') ? targetAccount.split(' - ')[0] : targetAccount;

      selectedTxIds.forEach(id => {
        const docRef = doc(db, `users/${accountId}/transactions`, id);

        batch.update(docRef, {
          accountName: targetAccount,
          bankName,
          updatedAt: new Date().toISOString()
        });
      });

      await batch.commit();
      setIsBulkAccountModalOpen(false);
      setSelectedTxIds(new Set());
      setNotification({
        type: 'success',
        message: `${count} transactions associées au compte "${targetAccount}".`
      });
    } catch (err) {
      console.error("Erreur assignation compte:", err);
      setNotification({
        type: 'error',
        message: "Erreur lors de l'assignation de compte en lot."
      });
    }
  };

  // 7. Manual Transaction Submission
  const handleCreateManualTx = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawAmt = parseFloat(manualTx.amount.replace(',', '.'));
    if (isNaN(rawAmt) || rawAmt === 0) {
      alert("Veuillez saisir un montant numérique valide.");
      return;
    }
    if (!manualTx.description.trim()) {
      alert("Veuillez indiquer un libellé.");
      return;
    }

    const finalAccount = manualTx.account === 'CUSTOM'
      ? (manualTx.customAccount.trim() || 'Compte Personnalisé')
      : manualTx.account;
    const finalBank = finalAccount.includes(' - ') ? finalAccount.split(' - ')[0] : finalAccount;

    try {
      const accountId = getActiveAccountId();
      const txCollection = collection(db, `users/${accountId}/transactions`);
      const newDocRef = doc(txCollection);

      const finalAmount = manualTx.flowType === 'INCOME' ? Math.abs(rawAmt) : -Math.abs(rawAmt);
      const monthKey = manualTx.date.substring(0, 7);

      await writeBatch(db).set(newDocRef, {
        id: newDocRef.id,
        date: manualTx.date,
        monthKey,
        rawLabel: manualTx.description,
        cleanLabel: manualTx.description,
        amount: finalAmount,
        direction: finalAmount > 0 ? 'credit' : 'debit',
        category: manualTx.category,
        flowType: manualTx.flowType,
        nature: manualTx.flowType === 'FIXED_EXPENSE' ? 'fixe' : manualTx.flowType === 'VARIABLE_EXPENSE' ? 'variable' : 'autre',
        isSubscription: Boolean(manualTx.isSubscription),
        subscriptionDay: manualTx.isSubscription ? Number(manualTx.subscriptionDay) : null,
        accountName: finalAccount,
        bankName: finalBank,
        aiStatus: 'completed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }).commit();

      setIsAddModalOpen(false);
      setManualTx({
        date: new Date().toISOString().substring(0, 10),
        description: '',
        amount: '',
        category: 'Alimentation & Courses',
        flowType: 'VARIABLE_EXPENSE',
        account: finalAccount,
        customAccount: '',
        isSubscription: false,
        subscriptionDay: 1
      });

      setNotification({
        type: 'success',
        message: `Opération ajoutée avec succès sur "${finalAccount}" !`
      });
    } catch (err) {
      console.error("Erreur ajout manuel:", err);
      setNotification({
        type: 'error',
        message: "Échec de l'enregistrement de l'opération."
      });
    }
  };

  // 8. File Upload & Extraction with Multi-Account AI Detection
  const handleFileUpload = async (file: File) => {
    setIsProcessingFile(true);
    setFileStatusMessage(`Analyse de ${file.name}...`);

    try {
      const accountId = getActiveAccountId();
      let extractedTxs: BankTransaction[] = [];
      let detectedBankName = '';
      let detectedAccountName = '';

      if (file.name.endsWith('.csv') || file.type.includes('csv') || file.type.includes('text')) {
        // Direct Client CSV Parsing with intelligent bank signature & merchant extraction
        setFileStatusMessage("Lecture et détection intelligente du relevé...");
        const text = await readBankStatementFileText(file);
        const { bankName: detectedBank, transactions: parsedTxs } = parseCSVBankStatement(text);
        const fileDetection = detectAccountFromFilename(file.name);

        const detectedCurrency = detectStatementCurrency(text);
        const fileCurrency = detectedCurrency || 'EUR';
        setCurrency(fileCurrency);
        localStorage.setItem('cashpilot_statement_currency', fileCurrency);

        detectedBankName = detectedBank !== 'Compte Courant' ? detectedBank : fileDetection.bankName;
        detectedAccountName = detectedBankName ? `${detectedBankName} - Compte Courant` : fileDetection.accountName;

        extractedTxs = parsedTxs.map((t, idx) => ({
          ...t,
          id: `csv_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
          account: detectedAccountName,
          bankName: detectedBankName
        }));
      } else {
        // PDF or Image Upload to Firebase Cloud Function (Gemini Multi-Account extraction)
        setFileStatusMessage("Téléversement sécurisé vers Firebase Storage...");
        const storageRef = ref(storage, `users/${accountId}/uploads/statements/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);

        setFileStatusMessage("Analyse OCR et détection intelligente du compte par l'IA...");
        const analyzeDocument = httpsCallable(functions, 'analyzeDocument');
        const response = await analyzeDocument({ fileUrl: url, fileType: 'bank_statement', mimeType: file.type });
        const result = response.data as any;

        if (result.success && result.data) {
          detectedBankName = result.data.bankName || 'Banque';
          detectedAccountName = result.data.accountName || `${detectedBankName} - ${result.data.accountType || 'Compte'}`;

          const detectedCurrency = detectStatementCurrency(result.data.currency || result.data.rawText || file.name);
          const fileCurrency = detectedCurrency || 'EUR';
          setCurrency(fileCurrency);
          localStorage.setItem('cashpilot_statement_currency', fileCurrency);

          if (result.data.transactions) {
            extractedTxs = result.data.transactions.map((t: any, i: number) => {
              const amt = Number(t.amount) || 0;
              const desc = t.description || t.label || 'Opération';
              const smart = smartCategorizeTransaction(desc, amt, t.date);
              const cat = (t.category && t.category !== 'Autre') ? t.category : smart.category;
              const flow = t.flowType || (cat === smart.category ? smart.flowType : classifyFlowType(cat, amt, desc));
              return {
                id: `pdf_${Date.now()}_${i}`,
                date: t.date || new Date().toISOString().substring(0, 10),
                description: desc,
                amount: amt,
                flowType: flow,
                category: cat,
                isSubscription: smart.isSubscription,
                subscriptionDay: smart.subscriptionDay,
                confidence: smart.confidence,
                account: detectedAccountName,
                bankName: detectedBankName
              };
            });
          }
        }
      }

      if (extractedTxs.length === 0) {
        setNotification({
          type: 'info',
          message: "Aucune transaction exploitable n'a été détectée dans ce relevé."
        });
        setIsProcessingFile(false);
        setFileStatusMessage(null);
        return;
      }

      // Check Duplicates against existing transactions (en ignorant les anciennes transactions corrompues dont le libellé était une date)
      setFileStatusMessage("Vérification des doublons...");
      const validExistingTxs = bankTransactions.filter(t => 
        !/^\d{1,2}[./-]\d{1,2}([./-]\d{2,4})?$/.test(t.description)
      );
      const { duplicatesCount, uniqueTxs } = checkDuplicateTransactions(extractedTxs, validExistingTxs);

      if (uniqueTxs.length === 0) {
        setNotification({
          type: 'info',
          message: `Les ${duplicatesCount} transactions importées sont déjà présentes pour ce compte.`
        });
        setIsProcessingFile(false);
        setFileStatusMessage(null);
        setIsUploading(false);
        return;
      }

      // 8b. Catégorisation et audit automatique par IA Générative Google Gemini
      const txsNeedingAi = uniqueTxs.filter(t => t.category === 'Autre' || (t.amount > 0 && t.flowType === 'SAVINGS_TRANSFER'));
      if (txsNeedingAi.length > 0) {
        setFileStatusMessage(`Analyse & Catégorisation IA par Google Gemini (${txsNeedingAi.length} opérations)...`);
        try {
          const aiResults = await auditAndEnrichTransactionsWithGemini(txsNeedingAi);
          const aiResultMap = new Map(aiResults.map(r => [r.id, r]));
          
          let aiCount = 0;
          uniqueTxs.forEach(tx => {
            const ai = aiResultMap.get(tx.id);
            if (ai && CATEGORIES.includes(ai.category)) {
              tx.category = ai.category;
              tx.flowType = ai.flowType;
              if (ai.cleanDesc) tx.description = ai.cleanDesc;
              tx.confidence = 'high';
              tx.aiStatus = 'gemini_enhanced';
              aiCount++;
            }
          });
          if (aiCount > 0) {
            console.log(`Gemini a automatiquement audité et catégorisé ${aiCount} opérations lors de l'import.`);
          }
        } catch (geminiErr) {
          console.warn("Analyse Gemini automatique ignorée ou indisponible lors de l'import:", geminiErr);
        }
      }

      // Save Unique Transactions in Firestore batch
      setFileStatusMessage(`Sauvegarde de ${uniqueTxs.length} opérations pour "${detectedAccountName}"...`);
      const batch = writeBatch(db);
      const txRef = collection(db, `users/${accountId}/transactions`);

      // Nettoyage automatique des anciennes opérations corrompues (où la date avait été prise pour libellé)
      const corruptedOldDocs = bankTransactions.filter(t => 
        (t.account === detectedAccountName || t.bankName === detectedBankName) && 
        /^\d{1,2}[./-]\d{1,2}([./-]\d{2,4})?$/.test(t.description)
      );
      if (corruptedOldDocs.length > 0) {
        corruptedOldDocs.forEach(oldTx => {
          batch.delete(doc(db, `users/${accountId}/transactions`, oldTx.id));
        });
      }

      uniqueTxs.forEach(tx => {
        const newDoc = doc(txRef);
        const monthKey = tx.date ? tx.date.substring(0, 7) : new Date().toISOString().substring(0, 7);

        batch.set(newDoc, {
          id: newDoc.id,
          date: tx.date,
          monthKey,
          rawLabel: tx.rawLabel || tx.description,
          cleanLabel: tx.cleanLabel || tx.description,
          description: tx.cleanLabel || tx.description,
          amount: tx.amount,
          direction: tx.amount > 0 ? 'credit' : 'debit',
          category: tx.category,
          flowType: tx.flowType,
          nature: tx.flowType === 'FIXED_EXPENSE' ? 'fixe' : tx.flowType === 'VARIABLE_EXPENSE' ? 'variable' : 'autre',
          isSubscription: Boolean(tx.isSubscription),
          subscriptionDay: tx.subscriptionDay || null,
          accountName: tx.account || detectedAccountName || 'Compte Principal',
          bankName: tx.bankName || detectedBankName || 'Banque',
          aiStatus: 'completed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      });

      await batch.commit();

      setNotification({
        type: 'success',
        message: `Import réussi : ${uniqueTxs.length} opérations rattachées à "${detectedAccountName}" (${duplicatesCount} doublons ignorés).`
      });
      setIsUploading(false);
    } catch (err: any) {
      console.error("Erreur import relevé:", err);
      setNotification({
        type: 'error',
        message: "Erreur lors de l'analyse du relevé : " + (err.message || 'Format non supporté.')
      });
    } finally {
      setIsProcessingFile(false);
      setFileStatusMessage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-28 md:pb-12 max-w-7xl mx-auto p-4 md:p-8">
      
      {/* Toast Notification Banner */}
      {notification && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-lg transition-all animate-in slide-in-from-top-2 ${
          notification.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
          notification.type === 'error' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
          'bg-primary/10 border-primary/30 text-primary'
        }`}>
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Offline Alert Banner */}
      {!isOnline && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span>
              <strong>Connexion Internet interrompue.</strong> Votre navigateur est hors-ligne (ce qui provoque l'écran du dinosaure Chrome). Dès que la connexion est rétablie, la page se synchronise automatiquement.
            </span>
          </div>
          <Button size="sm" variant="ghost" onClick={() => window.location.reload()} className="text-xs h-7 text-amber-500 hover:bg-amber-500/20">
            Actualiser
          </Button>
        </div>
      )}

      {/* Header Title & Top Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse" />
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Gestion de Trésorerie Multi-Comptes & Audit
            </span>
          </div>
          <div className="flex items-center gap-3 flex-wrap mt-1">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
              Relevés Bancaires
            </h1>
            {reconciliation.isReconciled && (
              <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 bg-emerald-500/10 font-bold px-2.5 py-0.5 text-xs">
                ✓ Relevé équilibré
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez vos différents comptes bancaires au sein d'un même mois avec classification et neutralisation de l'épargne.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Currency Pill Toggle */}
          <div className="flex items-center bg-secondary/60 dark:bg-white/[0.04] p-1 rounded-xl border border-border/60">
            <button
              type="button"
              onClick={() => {
                setCurrency('EUR');
                localStorage.setItem('cashpilot_statement_currency', 'EUR');
              }}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                currency === 'EUR'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              EUR (€)
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrency('CHF');
                localStorage.setItem('cashpilot_statement_currency', 'CHF');
              }}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                currency === 'CHF'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              CHF (CHF)
            </button>
          </div>

          {/* Adjust balances button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditBalanceForm({
                initialBalance: currentMonthBalances.initial ? String(currentMonthBalances.initial) : '',
                closingBalance: currentMonthBalances.closing ? String(currentMonthBalances.closing) : ''
              });
              setIsEditBalanceModalOpen(true);
            }}
            className="text-xs border-border/80 flex items-center gap-1.5 shadow-sm"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Ajuster soldes</span>
          </Button>

          {/* Virement & Family Rules button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsVirementRulesModalOpen(true)}
            className="text-xs border-border/80 flex items-center gap-1.5 shadow-sm hover:border-primary/50 text-foreground"
            title="Configurer les règles de reconnaissance pour vos comptes et vos proches"
          >
            <Users className="w-3.5 h-3.5 text-primary" />
            <span>Règles Virements & Famille</span>
          </Button>

          {/* Delete statement button */}
          {monthScopedTransactions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePurgeScope}
              className="text-xs border-rose-500/30 text-rose-400 hover:bg-rose-500/10 flex items-center gap-1.5 shadow-sm"
              title="Supprimer définitivement les relevés et opérations de cette période"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Supprimer le relevé</span>
            </Button>
          )}

          {/* Month Selector */}
          {availableMonths.length > 0 && (
            <div className="flex items-center gap-2 bg-card/80 dark:bg-[#10141e]/80 border border-border/80 dark:border-white/[0.08] rounded-xl px-3 py-1.5 shadow-sm">
              <Calendar className="w-4 h-4 text-primary" />
              <select
                className="bg-transparent text-xs md:text-sm font-semibold outline-none text-foreground cursor-pointer"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
              >
                <option value="all">Toutes périodes</option>
                {availableMonths.map(m => (
                  <option key={m} value={m} className="dark:bg-[#10141e]">{formatMonthLabel(m)}</option>
                ))}
              </select>
            </div>
          )}

          <Button 
            variant="secondary"
            onClick={() => setIsUploading(!isUploading)}
            className="flex items-center gap-2 border border-border/40 shadow-sm"
          >
            <Upload className="w-4 h-4 text-primary" />
            Importer un relevé
          </Button>

          <Button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            Ajouter une opération
          </Button>
        </div>
      </div>

      {/* MULTI-ACCOUNTS BREAKDOWN & SELECTOR BAR */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Landmark className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Comptes Bancaires Actifs
            </span>
          </div>
          {selectedAccount !== 'ALL' && (
            <button
              onClick={() => setSelectedAccount('ALL')}
              className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
            >
              Afficher tous les comptes (Consolidé)
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
          {/* Consolidated button */}
          <button
            onClick={() => setSelectedAccount('ALL')}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 flex-shrink-0 border ${
              selectedAccount === 'ALL'
                ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20'
                : 'bg-card/80 dark:bg-white/[0.03] text-muted-foreground hover:text-foreground border-border/60'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Tous les comptes (Consolidé)</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              selectedAccount === 'ALL' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>
              {monthScopedTransactions.length}
            </span>
          </button>

          {/* Account Pills */}
          {accountSummaries.map(acc => {
            const isSelected = selectedAccount === acc.accountName;
            const isPos = acc.netCashFlow >= 0;

            return (
              <button
                key={acc.accountName}
                onClick={() => setSelectedAccount(acc.accountName)}
                className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 flex-shrink-0 border ${
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20'
                    : 'bg-card/80 dark:bg-white/[0.03] text-foreground hover:border-primary/40 border-border/60'
                }`}
              >
                <Landmark className="w-3.5 h-3.5 opacity-75" />
                <span className="max-w-[150px] truncate">{acc.accountName}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-lg ${
                  isSelected
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : isPos ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                }`}>
                  {formatCurrency(acc.netCashFlow, { showSign: true, decimals: 0 })}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Clean Minimalist Upload Dropzone */}
      {isUploading && (
        <Card 
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handleFileUpload(e.dataTransfer.files[0]);
            }
          }}
          className={`p-8 border-dashed border-2 transition-all duration-300 rounded-2xl relative shadow-sm text-center ${
            isDragging 
              ? 'border-primary bg-primary/10 ring-2 ring-primary/30 scale-[1.01]' 
              : 'border-primary/40 hover:border-primary/60 bg-card/60 backdrop-blur-md'
          }`}
        >
          <button 
            onClick={() => {
              setIsUploading(false);
              setIsDragging(false);
            }}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>

          <div 
            className="flex flex-col items-center justify-center gap-3 py-4 cursor-pointer group"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className={`p-4 rounded-2xl transition-all duration-300 shadow-inner ${
              isDragging
                ? 'bg-primary/20 text-primary scale-110 ring-2 ring-primary/40'
                : 'bg-primary/10 text-primary ring-1 ring-primary/20 group-hover:scale-105 group-hover:bg-primary/15'
            }`}>
              {isProcessingFile ? (
                <Loader2 className="w-8 h-8 animate-spin" />
              ) : (
                <Upload className="w-8 h-8 animate-bounce" />
              )}
            </div>

            <div>
              <p className="text-base font-bold text-foreground">
                {isProcessingFile ? fileStatusMessage : "Glissez-déposez votre relevé bancaire (PDF, CSV, image)"}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                L'IA analyse le document, identifie l'établissement bancaire et déduplique automatiquement
              </p>
            </div>

            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".csv,.pdf,text/csv,application/pdf,image/*"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }} 
            />

            <Button 
              size="sm" 
              variant="outline" 
              disabled={isProcessingFile}
              className="mt-2 pointer-events-none font-semibold text-xs border-primary/30 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300"
            >
              {isProcessingFile ? "Extraction en cours..." : "Sélectionner un fichier"}
            </Button>
          </div>
        </Card>
      )}

      {/* Top Metrics Strip (Dynamic: Consolidated or Scoped to Selected Account) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Inflows */}
        <Card className="glass-card p-5 border border-border/60 hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Revenus {selectedAccount !== 'ALL' ? `(${selectedAccount})` : 'Réels'}
              </span>
              <KpiInfoTooltip type="income" amount={metrics.income} accountName={selectedAccount} />
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black font-mono tracking-normal text-foreground">
              {formatCurrency(metrics.income, { showSign: true })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedAccount === 'ALL' ? 'Total des encaissements consolidés' : `Encaissements sur ${selectedAccount}`}
            </p>
          </div>
        </Card>

        {/* Real Outflows */}
        <Card className="glass-card p-5 border border-border/60 hover:border-rose-500/40 transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Dépenses Réelles
              </span>
              <KpiInfoTooltip
                type="expenses"
                amount={metrics.realExpenses}
                fixedAmount={metrics.fixed}
                variableAmount={metrics.variable}
              />
            </div>
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black font-mono tracking-normal text-rose-500">
              {formatCurrency(-metrics.realExpenses, { showSign: true })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Fixes ({formatCurrency(metrics.fixed, { decimals: 0 })}) + Variables ({formatCurrency(metrics.variable, { decimals: 0 })})
            </p>
          </div>
        </Card>

        {/* Savings & Investments (Option 1: Real Savings Placements) */}
        <Card className="glass-card p-5 border border-border/60 hover:border-purple-500/40 transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Épargne & Placements
              </span>
              <KpiInfoTooltip type="savings" amount={metrics.savings} />
            </div>
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black font-mono tracking-normal text-purple-500">
              {formatCurrency(metrics.savings, { showSign: false })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.savings > 0
                ? 'Placé sur livrets & investissements'
                : 'Aucun versement sur livret dédié'}
            </p>
          </div>
        </Card>

        {/* Net Cash Flow / Reste à Vivre Réel */}
        <Card className="glass-card p-5 border border-border/60 hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {monthScopedTransactions.length > 0 && (currentMonthBalances.initial !== 0 || currentMonthBalances.closing !== 0)
                  ? `Solde Disponible ${selectedAccount !== 'ALL' ? `(${selectedAccount})` : '(Relevé)'}`
                  : `Reste à Vivre ${selectedAccount !== 'ALL' ? selectedAccount : 'Global'}`}
              </span>
              <KpiInfoTooltip
                type="resteAVivre"
                amount={
                  monthScopedTransactions.length === 0
                    ? 0
                    : (currentMonthBalances.initial !== 0 || currentMonthBalances.closing !== 0)
                      ? (currentMonthBalances.closing || reconciliation.calculatedBalance)
                      : metrics.resteAVivre
                }
              />
            </div>
            <div className={`p-2.5 rounded-xl ${
              monthScopedTransactions.length === 0
                ? 'bg-muted/30 text-muted-foreground'
                : (currentMonthBalances.initial !== 0 || currentMonthBalances.closing !== 0
                    ? (currentMonthBalances.closing || reconciliation.calculatedBalance) >= 0
                    : metrics.resteAVivre >= 0)
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : 'bg-rose-500/10 text-rose-500'
            }`}>
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl font-black font-mono tracking-normal ${
              monthScopedTransactions.length === 0
                ? 'text-foreground'
                : (currentMonthBalances.initial !== 0 || currentMonthBalances.closing !== 0
                    ? (currentMonthBalances.closing || reconciliation.calculatedBalance) >= 0
                    : metrics.resteAVivre >= 0)
                  ? 'text-emerald-500'
                  : 'text-rose-500'
            }`}>
              {monthScopedTransactions.length === 0
                ? '0,00 €'
                : (currentMonthBalances.initial !== 0 || currentMonthBalances.closing !== 0)
                  ? formatCurrency(currentMonthBalances.closing || reconciliation.calculatedBalance, { showSign: true })
                  : formatCurrency(metrics.resteAVivre, { showSign: true })}
            </div>
            <div className="mt-1.5 flex flex-col gap-0.5">
              {monthScopedTransactions.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Aucune opération enregistrée sur cette période
                </p>
              ) : (currentMonthBalances.initial !== 0 || currentMonthBalances.closing !== 0) ? (
                <>
                  <div className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                    <span>Flux net de la période :</span>
                    <span className={`font-mono font-bold ${reconciliation.calculatedBalance - currentMonthBalances.initial >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {formatCurrency(reconciliation.calculatedBalance - currentMonthBalances.initial, { showSign: true })}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/75">
                    Solde initial ({formatCurrency(currentMonthBalances.initial)}) + Flux net ({formatCurrency(reconciliation.calculatedBalance - currentMonthBalances.initial, { showSign: true })}) = {formatCurrency(reconciliation.calculatedBalance)}
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Solde net disponible : {formatCurrency(metrics.netCashFlow, { showSign: true, decimals: 0 })}
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Fortuneo / Inter-compte Summary Banner */}
      {(metrics.fortuneoSent > 0 || metrics.fortuneoReceived > 0) && (
        <Card className="glass-card p-4 md:p-5 border border-cyan-500/30 bg-gradient-to-r from-cyan-950/20 via-background to-blue-950/20 rounded-2xl shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-2xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex-shrink-0 mt-0.5">
                <ArrowLeftRight className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-foreground">
                    Trésorerie & Virements Fortuneo
                  </h3>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                    Fidélité Relevé
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  L'argent transféré vers Fortuneo est décompté en dépense/sortie réelle sur votre compte. Lors de l'import futur de votre relevé Fortuneo, l'application effectuera le croisement automatique de patrimoine.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
              <div className="px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-right">
                <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Envoyé vers Fortuneo</div>
                <div className="text-sm md:text-base font-bold font-mono text-rose-400">
                  {formatCurrency(-metrics.fortuneoSent, { showSign: true })}
                </div>
              </div>

              {metrics.fortuneoReceived > 0 && (
                <div className="px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-right">
                  <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Reçu de Fortuneo</div>
                  <div className="text-sm md:text-base font-bold font-mono text-emerald-400">
                    {formatCurrency(metrics.fortuneoReceived, { showSign: true })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Abonnements & Charges Récurrentes Détectés Banner */}
      <Card className="glass-card p-5 border border-cyan-500/20 bg-gradient-to-r from-cyan-950/20 via-background to-blue-950/20 rounded-2xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-2xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex-shrink-0 mt-0.5">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">
                  Abonnements & Prélèvements Récurrents Détectés
                </h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                  {subscriptionSummary.count} actif{subscriptionSummary.count > 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                L'IA analyse vos libellés et extrait automatiquement vos services récurrents avec leur jour de prélèvement.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="text-right">
              <div className="text-xs text-muted-foreground font-medium">Coût Mensuel</div>
              <div className="text-lg font-extrabold text-cyan-400 font-mono">
                {formatCurrency(subscriptionSummary.totalMonthly, { showSign: false })}
              </div>
            </div>

            <div className="h-8 w-px bg-border/60 hidden sm:block" />

            <div className="text-right">
              <div className="text-xs text-muted-foreground font-medium">Projection Annuelle</div>
              <div className="text-lg font-extrabold text-foreground font-mono">
                {formatCurrency(subscriptionSummary.totalAnnual, { showSign: false })}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                onClick={() => {
                  setSelectedSubscriptionTx(subscriptionSummary.items[0] || null);
                  setIsOptimizerDrawerOpen(true);
                }}
                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1.5 shadow-md shadow-indigo-500/25 transition-all"
                title="Trouver les forfaits et abonnements concurrents les moins chers"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Optimiser avec l'IA (Tarifs moins chers)</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedFilter(selectedFilter === 'SUBSCRIPTION' ? 'ALL' : 'SUBSCRIPTION')}
                className={`text-xs border-cyan-500/30 hover:bg-cyan-500/10 transition-colors ${
                  selectedFilter === 'SUBSCRIPTION' ? 'bg-cyan-500/20 text-cyan-300' : 'text-foreground'
                }`}
              >
                {selectedFilter === 'SUBSCRIPTION' ? 'Afficher tout' : 'Filtrer ces abonnements'}
              </Button>

              {subscriptionSummary.count > 0 && (
                <button
                  onClick={() => setShowSubscriptionDetails(!showSubscriptionDetails)}
                  className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                  title={showSubscriptionDetails ? "Masquer la liste" : "Afficher la liste"}
                >
                  {showSubscriptionDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Subscription Chips Row when expanded */}
        {showSubscriptionDetails && subscriptionSummary.count > 0 && (
          <div className="mt-4 pt-4 border-t border-border/40 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 animate-in fade-in">
            {subscriptionSummary.items.map(sub => (
              <div
                key={sub.id}
                onClick={() => handleOpenEditModal(sub)}
                className="p-3 rounded-xl bg-card/60 dark:bg-white/[0.03] border border-border/60 hover:border-cyan-500/40 cursor-pointer transition-all flex flex-col justify-between group"
                title="Cliquer pour modifier l'affectation"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-bold text-foreground truncate group-hover:text-cyan-400 transition-colors">
                      {sub.description}
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5 font-medium">
                      <Calendar className="w-3 h-3 text-cyan-400" />
                      <span>
                        {sub.subscriptionDay ? `Prélevé le ${sub.subscriptionDay}` : 'Date variable'}
                      </span>
                      <span className="opacity-40">•</span>
                      <span className="truncate">{sub.account || 'Compte Principal'}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-xs font-bold font-mono text-cyan-400">
                      {formatCurrency(Math.abs(sub.amount), { showSign: false })}
                    </span>
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSubscriptionTx(sub);
                      setIsOptimizerDrawerOpen(true);
                    }}
                    className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 hover:underline"
                  >
                    <Sparkles className="w-3 h-3 text-indigo-400" />
                    Trouver un meilleur prix
                  </button>
                  <span className="text-[10px] text-muted-foreground group-hover:text-foreground">Modifier ✎</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 2 Graphiques Synchronisés : Diagramme Sankey des Flux & Diagramme Circulaire des Dépenses */}
      <BankFlowCharts
        transactions={selectedAccount === 'ALL' ? monthScopedTransactions : monthScopedTransactions.filter(t => t.account === selectedAccount)}
        selectedAccountName={selectedAccount === 'ALL' ? 'Tous les comptes (Consolidé)' : selectedAccount}
        selectedMonthName={selectedMonth === 'all' ? 'Toutes périodes' : formatMonthLabel(selectedMonth)}
        currency={currency}
      />

      {/* Interactive Control Bar & Segmented Transfer Filter */}
      <Card className="glass-card p-4 border border-border/60 space-y-3">
        {/* Top line: Search, Filter pills, Bulk actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher libellé, compte, commerçant, montant..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs md:text-sm rounded-xl bg-background/80 border border-border/60 focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground transition-all"
            />
          </div>

          {/* Quick Flow Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {[
              { id: 'ALL', label: 'Toutes', icon: null },
              { id: 'INCOME', label: 'Revenus', icon: null },
              { id: 'FIXED', label: 'Charges Fixes', icon: null },
              { id: 'VARIABLE', label: 'Dépenses Courantes', icon: null },
              { id: 'SUBSCRIPTION', label: `Abonnements (${subscriptionSummary.count})`, icon: RotateCcw },
              { id: 'SAVINGS', label: 'Épargne / Neutre', icon: null },
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    selectedFilter === tab.id
                      ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                      : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                  }`}
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* AI Auto-Categorize & Bulk Actions */}
          <div className="flex items-center gap-2 animate-in fade-in flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={handleAutoCategorizeSelected}
              className="flex items-center gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/10"
              title="L'IA heuristique analyse tous les libellés sans catégorie ou les lignes sélectionnées"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{selectedTxIds.size > 0 ? `Auto-catégoriser (${selectedTxIds.size})` : "Heuristique"}</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleGeminiCategorization}
              disabled={isEnhancingWithGemini}
              className="flex items-center gap-1.5 text-xs text-violet-400 border-violet-500/40 hover:bg-violet-500/10 transition-colors"
              title="Catégorisation sémantique par IA générative Google Gemini"
            >
              {isEnhancingWithGemini ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>Gemini IA</span>
            </Button>

            {selectedTxIds.size > 0 && (
              <>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setIsBulkAccountModalOpen(true)}
                  className="flex items-center gap-1.5 text-xs"
                >
                  <Landmark className="w-3.5 h-3.5" />
                  Changer de compte ({selectedTxIds.size})
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setIsBulkCategoryModalOpen(true)}
                  className="flex items-center gap-1.5 text-xs"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Reclasser ({selectedTxIds.size})
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={handleDeleteSelected}
                  className="flex items-center gap-1.5 text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Supprimer ({selectedTxIds.size})
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Segmented Transfer Filter (Option B: Internal Transfer Filtering) */}
        <div className="pt-2 border-t border-border/40 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Vue Opérations :</span>
            <div className="inline-flex p-1 bg-secondary/60 dark:bg-white/[0.04] rounded-xl border border-border/60">
              <button
                type="button"
                onClick={() => setTransferFilter('ALL')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  transferFilter === 'ALL'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Toutes les opérations ({monthScopedTransactions.length})
              </button>
              <button
                type="button"
                onClick={() => setTransferFilter('EXPENSES_INCOME')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  transferFilter === 'EXPENSES_INCOME'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Dépenses & Revenus
              </button>
              <button
                type="button"
                onClick={() => setTransferFilter('INTERNAL')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 ${
                  transferFilter === 'INTERNAL'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ArrowLeftRight className="w-3 h-3 text-cyan-400" />
                <span>Virements internes & Épargne</span>
              </button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground font-mono tabular-nums">
            {filteredTransactions.length} écriture{filteredTransactions.length > 1 ? 's' : ''} affichée{filteredTransactions.length > 1 ? 's' : ''}
          </div>
        </div>
      </Card>

      {/* Bank Mirror Table (Option B: Swiss Bank Statement Mirror) */}
      <Card className="glass-card overflow-hidden border border-border/70 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs md:text-sm border-collapse">
            <thead>
              <tr className="border-b border-border/70 bg-secondary/40 dark:bg-white/[0.03] text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filteredTransactions.length > 0 && selectedTxIds.size === filteredTransactions.length}
                    onChange={handleSelectAll}
                    className="rounded border-border cursor-pointer"
                  />
                </th>
                <th className="py-3 px-3.5 whitespace-nowrap">Date valeur</th>
                <th className="py-3 px-3.5">Opération</th>
                <th className="py-3 px-3.5 text-right font-mono text-rose-500 whitespace-nowrap">Débit (-)</th>
                <th className="py-3 px-3.5 text-right font-mono text-emerald-500 whitespace-nowrap">Crédit (+)</th>
                <th className="py-3 px-3 text-center w-16">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileSpreadsheet className="w-8 h-8 opacity-40 text-muted-foreground" />
                      <p className="text-sm font-medium">Aucune opération trouvée pour ces critères.</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedAccount !== 'ALL' 
                          ? `Aucune opération enregistrée pour le compte "${selectedAccount}".`
                          : "Importez un relevé bancaire ou modifiez les filtres de recherche."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(tx => {
                  const isSelected = selectedTxIds.has(tx.id);
                  const isDebit = tx.type === 'debit';
                  const isCredit = tx.type === 'credit';
                  // Strict category match: only allowed subscription categories, never regular expenses (groceries, restaurants, shopping, etc.)
                  const isSubscriptionCategory = SUBSCRIPTION_CATEGORIES.has(tx.category);

                  return (
                    <tr
                      key={tx.id}
                      className={`transition-colors hover:bg-secondary/40 dark:hover:bg-white/[0.03] ${
                        isSelected ? 'bg-primary/5' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(tx.id)}
                          className="rounded border-border cursor-pointer"
                        />
                      </td>

                      {/* Date Valeur */}
                      <td className="py-3 px-3.5 whitespace-nowrap font-mono text-xs text-muted-foreground tabular-nums">
                        {formatDateFR(tx.date)}
                      </td>

                      {/* Description + Category Pill + Transfer Pill */}
                      <td className="py-3 px-3.5">
                        <div className="flex flex-col gap-1 max-w-xl">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-foreground tracking-tight text-xs md:text-sm">
                              {tx.description}
                            </span>
                            {tx.isInternalTransfer ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleVirementType(tx);
                                }}
                                className="inline-flex items-center gap-1 text-[10px] font-bold py-0.5 px-2 rounded-lg border border-cyan-500/40 text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 hover:border-cyan-500 transition-all cursor-pointer shadow-sm group"
                                title="Virement entre vos comptes propres (neutralisé en trésorerie). Cliquez pour reclasser en Famille & Proches."
                              >
                                <ArrowLeftRight className="w-2.5 h-2.5 group-hover:rotate-180 transition-transform duration-300" />
                                <span>Virement Interne (Mes comptes)</span>
                              </button>
                            ) : (tx.isFamilyTransfer || tx.category === 'Virements Famille & Proches') ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleVirementType(tx);
                                }}
                                className="inline-flex items-center gap-1 text-[10px] font-bold py-0.5 px-2 rounded-lg border border-purple-500/40 text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 hover:border-purple-500 transition-all cursor-pointer shadow-sm group"
                                title="Virement familial / proche (comptabilisé en dépense ou revenu réel). Cliquez pour reclasser en Virement Interne."
                              >
                                <Users className="w-2.5 h-2.5 text-purple-400" />
                                <span>Famille & Proches</span>
                              </button>
                            ) : null}
                            {(tx.isSubscription || tx.category === 'Abonnements & Télécom') && (
                              <Badge variant="subscription" className="text-[10px] py-0 px-1.5 flex items-center gap-1">
                                <RotateCcw className="w-2.5 h-2.5" />
                                <span>Abonnement {tx.subscriptionDay ? `(le ${tx.subscriptionDay})` : ''}</span>
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
                            {/* Inline Account Selector Button */}
                            <button
                              onClick={() => setSelectedAccount(tx.account || 'Compte Principal')}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-secondary/50 dark:bg-white/[0.04] border border-border/50 hover:border-primary/50 text-foreground transition-all"
                              title="Filtrer ce compte"
                            >
                              <Landmark className="w-2.5 h-2.5 text-primary opacity-80" />
                              <span className="max-w-[120px] truncate">{tx.account || 'Compte Principal'}</span>
                            </button>

                            {/* Category Selector */}
                            <select
                              value={tx.category}
                              onChange={e => handleCategoryChange(tx.id, e.target.value)}
                              className="bg-transparent text-[11px] font-medium text-muted-foreground hover:text-foreground border border-border/40 hover:border-border/80 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer dark:bg-[#10141e]"
                            >
                              {CATEGORIES.map(cat => (
                                <option key={cat} value={cat} className="dark:bg-[#10141e] text-foreground">
                                  {cat}
                                </option>
                              ))}
                            </select>

                            {tx.rawLabel && tx.rawLabel !== tx.description && (
                              <span className="text-[10px] opacity-60 truncate max-w-xs font-mono" title={tx.rawLabel}>
                                {tx.rawLabel}
                              </span>
                            )}
                          </div>

                          {/* AI Subscription Optimizer Button - Rendered ONLY if transaction.category matches subscription categories */}
                          {isSubscriptionCategory && (
                            <div className="pt-0.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedSubscriptionTx(tx);
                                  setIsOptimizerDrawerOpen(true);
                                }}
                                className="text-xs text-indigo-500 hover:text-indigo-600 mt-1 h-auto py-1 px-2 flex items-center w-fit border border-indigo-500/20 hover:bg-indigo-500/10 rounded-lg transition-colors"
                              >
                                <Sparkles className="w-3 h-3 mr-1 text-indigo-400" />
                                Trouver un meilleur prix
                              </Button>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Débit (-) Column */}
                      <td className="py-3 px-3.5 text-right whitespace-nowrap font-mono tabular-nums text-xs md:text-sm font-semibold">
                        {isDebit ? (
                          <span className="text-rose-600 dark:text-rose-400">
                            {formatBankAmount(tx.amount, currency)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </td>

                      {/* Crédit (+) Column */}
                      <td className="py-3 px-3.5 text-right whitespace-nowrap font-mono tabular-nums text-xs md:text-sm font-semibold">
                        {isCredit ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {formatBankAmount(tx.amount, currency)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </td>

                      {/* Minimal Action Icons */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEditModal(tx)}
                            className="p-1 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            title="Modifier l'opération"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(tx.id)}
                            className="p-1 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                            title="Supprimer l'opération"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal: Add Manual Transaction */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <Card className="w-full max-w-md p-6 bg-card border border-border/80 shadow-2xl rounded-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-border/60">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" /> Nouvelle Opération
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1 rounded-lg text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateManualTx} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Compte Bancaire</label>
                <select
                  value={manualTx.account}
                  onChange={e => setManualTx({ ...manualTx, account: e.target.value })}
                  className="w-full p-2.5 text-xs rounded-xl bg-background border border-border/80 focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
                >
                  {availableAccounts.map(acc => (
                    <option key={acc} value={acc}>{acc}</option>
                  ))}
                  <option value="CUSTOM">+ Nouveau compte personnalisé...</option>
                </select>
              </div>

              {manualTx.account === 'CUSTOM' && (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Nom du nouveau compte</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: BoursoBank - Compte Pro, Revolut..."
                    value={manualTx.customAccount}
                    onChange={e => setManualTx({ ...manualTx, customAccount: e.target.value })}
                    className="w-full p-2.5 text-xs rounded-xl bg-background border border-border/80 focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={manualTx.date}
                  onChange={e => setManualTx({ ...manualTx, date: e.target.value })}
                  className="w-full p-2.5 text-xs rounded-xl bg-background border border-border/80 focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Libellé / Description</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Salaire, Loyer, Carrefour..."
                  value={manualTx.description}
                  onChange={e => setManualTx({ ...manualTx, description: e.target.value })}
                  className="w-full p-2.5 text-xs rounded-xl bg-background border border-border/80 focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Montant (€)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="Ex: 45.50"
                  value={manualTx.amount}
                  onChange={e => setManualTx({ ...manualTx, amount: e.target.value })}
                  className="w-full p-2.5 text-xs rounded-xl bg-background border border-border/80 focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Type de Flux</label>
                <select
                  value={manualTx.flowType}
                  onChange={e => setManualTx({ ...manualTx, flowType: e.target.value as FlowType })}
                  className="w-full p-2.5 text-xs rounded-xl bg-background border border-border/80 focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
                >
                  <option value="VARIABLE_EXPENSE">Dépense Courante (Variable)</option>
                  <option value="FIXED_EXPENSE">Charge Fixe (Loyer, Abonnements)</option>
                  <option value="INCOME">Revenu (Salaire, Entrée d'argent)</option>
                  <option value="SAVINGS_TRANSFER">Épargne & Virement Neutre</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Catégorie</label>
                <select
                  value={manualTx.category}
                  onChange={e => setManualTx({ ...manualTx, category: e.target.value })}
                  className="w-full p-2.5 text-xs rounded-xl bg-background border border-border/80 focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Manual Subscription Toggle & Day */}
              <div className="p-3 rounded-xl bg-secondary/40 dark:bg-white/[0.02] border border-border/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                    <label htmlFor="manualSubToggle" className="text-xs font-bold text-foreground cursor-pointer">
                      Abonnement récurrent
                    </label>
                  </div>
                  <input
                    type="checkbox"
                    id="manualSubToggle"
                    checked={manualTx.isSubscription}
                    onChange={e => setManualTx({ ...manualTx, isSubscription: e.target.checked })}
                    className="rounded border-border text-primary cursor-pointer w-4 h-4"
                  />
                </div>

                {manualTx.isSubscription && (
                  <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-3 animate-in fade-in">
                    <label className="text-xs text-muted-foreground font-medium">
                      Jour habituel de prélèvement :
                    </label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-muted-foreground">Le</span>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={manualTx.subscriptionDay}
                        onChange={e => setManualTx({ ...manualTx, subscriptionDay: parseInt(e.target.value, 10) || 1 })}
                        className="w-16 p-1.5 text-xs text-center rounded-lg bg-background border border-border/80 text-foreground font-bold font-mono focus:ring-1 focus:ring-primary outline-none"
                      />
                      <span className="text-xs font-semibold text-muted-foreground">du mois</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border/60">
                <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" className="bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                  Enregistrer
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: Bulk Account Reassignment */}
      {isBulkAccountModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <Card className="w-full max-w-sm p-6 bg-card border border-border/80 shadow-2xl rounded-2xl">
            <h3 className="text-base font-bold text-foreground mb-2 flex items-center gap-2">
              <Landmark className="w-4 h-4 text-primary" /> Changer de compte bancaire
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Rattacher les {selectedTxIds.size} opérations sélectionnées à un autre compte.
            </p>

            <select
              value={bulkTargetAccount}
              onChange={e => setBulkTargetAccount(e.target.value)}
              className="w-full p-2.5 text-xs rounded-xl bg-background border border-border/80 focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground mb-4"
            >
              <option value="">Sélectionnez un compte...</option>
              {availableAccounts.map(acc => (
                <option key={acc} value={acc}>{acc}</option>
              ))}
              <option value="CUSTOM">+ Nouveau compte personnalisé...</option>
            </select>

            {bulkTargetAccount === 'CUSTOM' && (
              <input
                type="text"
                placeholder="Ex: BoursoBank - Compte Pro"
                onChange={e => setBulkTargetAccount(e.target.value)}
                className="w-full p-2.5 text-xs rounded-xl bg-background border border-border/80 focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground mb-4"
              />
            )}

            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setIsBulkAccountModalOpen(false)}>
                Annuler
              </Button>
              <Button size="sm" onClick={handleBulkAccountApply} disabled={!bulkTargetAccount || bulkTargetAccount === 'CUSTOM'}>
                Appliquer
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Modal: Bulk Category Update */}
      {isBulkCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <Card className="w-full max-w-sm p-6 bg-card border border-border/80 shadow-2xl rounded-2xl">
            <h3 className="text-base font-bold text-foreground mb-2">Reclasser les opérations sélectionnées</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Attribuer une nouvelle catégorie à {selectedTxIds.size} transactions.
            </p>

            <select
              value={bulkTargetCategory}
              onChange={e => setBulkTargetCategory(e.target.value)}
              className="w-full p-2.5 text-xs rounded-xl bg-background border border-border/80 focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground mb-6"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setIsBulkCategoryModalOpen(false)}>
                Annuler
              </Button>
              <Button size="sm" onClick={handleBulkCategoryApply}>
                Appliquer
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Modal: Edit / Manual Override Transaction */}
      {isEditModalOpen && editingTx && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <Card className="w-full max-w-md p-6 bg-card border border-border/80 shadow-2xl rounded-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-border/60">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-primary" />
                  Modifier l'affectation
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Corrigez manuellement la catégorie, le type de flux et l'abonnement
                </p>
              </div>
              <button 
                onClick={() => { setIsEditModalOpen(false); setEditingTx(null); }} 
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditModal} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Libellé de l'opération
                </label>
                <input
                  type="text"
                  required
                  value={editForm.description}
                  onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full p-2.5 text-xs rounded-xl bg-background border border-border/80 focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Montant (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editForm.amount}
                    onChange={e => setEditForm({ ...editForm, amount: e.target.value })}
                    className="w-full p-2.5 text-xs rounded-xl bg-background border border-border/80 focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Compte Bancaire
                  </label>
                  <select
                    value={editForm.account}
                    onChange={e => setEditForm({ ...editForm, account: e.target.value })}
                    className="w-full p-2.5 text-xs rounded-xl bg-background border border-border/80 focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
                  >
                    {availableAccounts.map(acc => (
                      <option key={acc} value={acc}>{acc}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Catégorie
                </label>
                <select
                  value={editForm.category}
                  onChange={e => {
                    const newCat = e.target.value;
                    const autoFlow = classifyFlowType(newCat, parseFloat(editForm.amount) || -10, editForm.description);
                    setEditForm({ 
                      ...editForm, 
                      category: newCat,
                      flowType: autoFlow,
                      isSubscription: newCat === 'Abonnements & Télécom' ? true : editForm.isSubscription
                    });
                  }}
                  className="w-full p-2.5 text-xs rounded-xl bg-background border border-border/80 focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground font-semibold"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Type de Flux Financier
                </label>
                <select
                  value={editForm.flowType}
                  onChange={e => setEditForm({ ...editForm, flowType: e.target.value as FlowType })}
                  className="w-full p-2.5 text-xs rounded-xl bg-background border border-border/80 focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground font-semibold"
                >
                  <option value="VARIABLE_EXPENSE">Dépense Courante (Alimentation, Loisirs, Shopping)</option>
                  <option value="FIXED_EXPENSE">Charge Fixe (Loyer, Abonnements, Énergie, Assurances)</option>
                  <option value="INCOME">Revenu (Salaire, Primes, Aides, Dividendes)</option>
                  <option value="SAVINGS_TRANSFER">Épargne / Virement Interne (Neutralisé)</option>
                </select>
              </div>

              {/* Subscription Toggle & Day selector */}
              <div className="p-3 rounded-xl bg-secondary/40 dark:bg-white/[0.02] border border-border/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-cyan-400" />
                    <label htmlFor="editSubToggle" className="text-xs font-bold text-foreground cursor-pointer">
                      Abonnement ou Prélèvement Récurrent
                    </label>
                  </div>
                  <input
                    type="checkbox"
                    id="editSubToggle"
                    checked={editForm.isSubscription}
                    onChange={e => setEditForm({ ...editForm, isSubscription: e.target.checked })}
                    className="rounded border-border text-primary cursor-pointer w-4 h-4"
                  />
                </div>

                {editForm.isSubscription && (
                  <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-3 animate-in fade-in">
                    <label className="text-xs text-muted-foreground font-medium">
                      Jour habituel de prélèvement :
                    </label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-muted-foreground">Le</span>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={editForm.subscriptionDay}
                        onChange={e => setEditForm({ ...editForm, subscriptionDay: parseInt(e.target.value, 10) || 1 })}
                        className="w-16 p-1.5 text-xs text-center rounded-lg bg-background border border-border/80 text-foreground font-bold font-mono focus:ring-1 focus:ring-primary outline-none"
                      />
                      <span className="text-xs font-semibold text-muted-foreground">du mois</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border/60">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => { setIsEditModalOpen(false); setEditingTx(null); }}
                >
                  Annuler
                </Button>
                <Button 
                  type="submit" 
                  className="bg-primary text-primary-foreground shadow-lg shadow-primary/20 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Enregistrer
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Gemini API Key Configuration Modal */}
      {isGeminiKeyModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="glass-card w-full max-w-md p-6 border border-border/80 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-violet-500/15 text-violet-400 border border-violet-500/30">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Clé API Google Gemini</h3>
                  <p className="text-xs text-muted-foreground">Catégorisation sémantique générative</p>
                </div>
              </div>
              <button
                onClick={() => setIsGeminiKeyModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 pt-2">
              <div className="text-xs text-muted-foreground leading-relaxed">
                Obtenez gratuitement une clé API en quelques secondes sur{' '}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-violet-400 underline hover:text-violet-300 font-semibold inline-flex items-center gap-1"
                >
                  Google AI Studio ↗
                </a>
                . Elle sera sauvegardée localement dans votre navigateur pour vos futures analyses.
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Clé API (VITE_GEMINI_API_KEY)</label>
                <input
                  type="password"
                  value={geminiApiKeyInput}
                  onChange={e => setGeminiApiKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full p-2.5 text-xs rounded-xl bg-background border border-border/80 focus:outline-none focus:ring-2 focus:ring-violet-500/40 text-foreground font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsGeminiKeyModalOpen(false)}
                  className="text-xs"
                >
                  Annuler
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    const trimmed = geminiApiKeyInput.trim();
                    if (trimmed) {
                      localStorage.setItem('cashpilot_gemini_api_key', trimmed);
                      setIsGeminiKeyModalOpen(false);
                      setNotification({
                        type: 'success',
                        message: 'Clé API Gemini enregistrée avec succès !'
                      });
                      handleGeminiCategorization();
                    } else {
                      localStorage.removeItem('cashpilot_gemini_api_key');
                      setIsGeminiKeyModalOpen(false);
                    }
                  }}
                  className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold"
                >
                  Enregistrer & Lancer
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Modal: Adjust Statement Initial & Closing Balances */}
      {isEditBalanceModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <Card className="glass-card w-full max-w-md p-6 border border-border/80 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">
                  Ajuster les soldes du relevé
                </h3>
              </div>
              <button
                onClick={() => setIsEditBalanceModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Définissez le solde initial de début de relevé et le solde de clôture officiel pour valider la réconciliation au centime près.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const initVal = parseFloat(editBalanceForm.initialBalance.replace(',', '.'));
                const closeVal = parseFloat(editBalanceForm.closingBalance.replace(',', '.'));
                if (isNaN(initVal) || isNaN(closeVal)) return;

                const monthKey = selectedMonth === 'all' ? (availableMonths[0] || (selectedMonth !== 'all' ? selectedMonth : '')) : selectedMonth;
                if (!monthKey) return;
                const updated = {
                  ...customBalances,
                  [monthKey]: { initial: initVal, closing: closeVal }
                };
                setCustomBalances(updated);
                localStorage.setItem('cashpilot_monthly_balances', JSON.stringify(updated));
                window.dispatchEvent(new CustomEvent('cashpilot_balances_updated'));
                setIsEditBalanceModalOpen(false);
                setNotification({
                  type: 'success',
                  message: `Soldes du relevé mis à jour pour ${formatMonthLabel(monthKey)}.`
                });
              }}
              className="space-y-4 pt-1"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Solde Initial (au début de période)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={editBalanceForm.initialBalance}
                    onChange={(e) => setEditBalanceForm({ ...editBalanceForm, initialBalance: e.target.value })}
                    placeholder="0.00"
                    className="w-full p-2.5 text-xs rounded-xl bg-background border border-border/80 focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground font-mono font-bold"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                    {currency}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Solde Final / Clôture (affiché sur votre relevé bancaire)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={editBalanceForm.closingBalance}
                    onChange={(e) => setEditBalanceForm({ ...editBalanceForm, closingBalance: e.target.value })}
                    placeholder="0.00"
                    className="w-full p-2.5 text-xs rounded-xl bg-background border border-border/80 focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground font-mono font-bold"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                    {currency}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditBalanceModalOpen(false)}
                  className="text-xs"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-primary text-primary-foreground text-xs font-semibold"
                >
                  Valider la réconciliation
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: Règles des Virements & Proches */}
      {isVirementRulesModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <Card className="w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 bg-card border border-border/80 shadow-2xl rounded-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    Règles des Virements & Proches
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Distinguez automatiquement vos comptes personnels de votre famille et de vos proches
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsVirementRulesModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Section 1: Identité du Titulaire (Mes Comptes Propres) */}
              <div className="p-4 rounded-2xl bg-secondary/30 dark:bg-white/[0.02] border border-border/60 space-y-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-cyan-400" />
                  <h4 className="text-sm font-bold text-foreground">
                    Votre Identité & Vos Comptes Propres (Virements Internes)
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Tout virement mentionnant votre prénom <strong>{virementRules.userFirstName}</strong> (ex: <em>"DRAME Kouroufia"</em>) ou vos banques propres est automatiquement <strong>neutralisé en trésorerie (épargne)</strong> et n'impacte pas vos dépenses réelles.
                </p>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      Votre Prénom
                    </label>
                    <input
                      type="text"
                      value={virementRules.userFirstName}
                      onChange={(e) => handleSaveVirementRules({ ...virementRules, userFirstName: e.target.value })}
                      placeholder="Kouroufia"
                      className="w-full p-2 text-xs rounded-xl bg-background border border-border/80 text-foreground font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      Votre Nom
                    </label>
                    <input
                      type="text"
                      value={virementRules.userLastName}
                      onChange={(e) => handleSaveVirementRules({ ...virementRules, userLastName: e.target.value })}
                      placeholder="Dramé"
                      className="w-full p-2 text-xs rounded-xl bg-background border border-border/80 text-foreground font-semibold"
                    />
                  </div>
                </div>

                {/* Own Accounts Keyword Tags */}
                <div className="pt-2">
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5">
                    Mots-clés de vos comptes propres (Fortuneo, SG, Livret...)
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {virementRules.ownAccountsKeywords.map(kw => (
                      <span
                        key={kw}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                      >
                        <span>{kw}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveOwnAccountKeyword(kw)}
                          className="hover:text-rose-400 transition-colors ml-0.5"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newOwnAccountKeyword}
                      onChange={(e) => setNewOwnAccountKeyword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddOwnAccountKeyword())}
                      placeholder="Ajouter un compte (ex: BoursoBank, Revolut, etc.)"
                      className="flex-1 p-2 text-xs rounded-xl bg-background border border-border/80 text-foreground"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddOwnAccountKeyword}
                      className="text-xs shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Ajouter
                    </Button>
                  </div>
                </div>
              </div>

              {/* Section 2: Membres de la Famille & Proches */}
              <div className="p-4 rounded-2xl bg-purple-500/5 dark:bg-purple-500/[0.03] border border-purple-500/20 space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-400" />
                  <h4 className="text-sm font-bold text-foreground">
                    Membres de votre Famille & Proches (Virements Tiers / Dépenses réelles)
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Même s'ils portent le nom de famille <strong>{virementRules.userLastName}</strong> (ex: <em>"Naistaba Dramé"</em>), tout virement contenant l'un de ces prénoms sera reconnu comme <strong>Virement Famille & Proches</strong> (comptabilisé fidèlement en dépense ou rentrée réelle, sans être faussement neutralisé).
                </p>

                {/* Family Keywords Tags */}
                <div>
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {virementRules.familyKeywords.map(kw => (
                      <span
                        key={kw}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30"
                      >
                        <span>{kw}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFamilyKeyword(kw)}
                          className="hover:text-rose-400 transition-colors ml-0.5"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newFamilyKeyword}
                      onChange={(e) => setNewFamilyKeyword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddFamilyKeyword())}
                      placeholder="Ajouter un prénom (ex: Naistaba, Nayssa, Mamadou, etc.)"
                      className="flex-1 p-2 text-xs rounded-xl bg-background border border-border/80 text-foreground"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddFamilyKeyword}
                      className="text-xs bg-purple-600 hover:bg-purple-700 text-white shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Ajouter un proche
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-border/60">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  const defaultRules = {
                    userFirstName: 'Kouroufia',
                    userLastName: 'Dramé',
                    familyKeywords: ['Naistaba', 'Nayssa', 'El Hani'],
                    ownAccountsKeywords: ['Fortuneo', 'SG', 'Société Générale', 'Kouroufia', 'Compte Courant', 'Livret A', 'LDDS', 'Virement Interne']
                  };
                  handleSaveVirementRules(defaultRules);
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Rétablir par défaut
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={() => setIsVirementRulesModalOpen(false)}
                className="bg-primary text-primary-foreground text-xs font-semibold"
              >
                Fermer & Appliquer
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* AI Subscription Optimizer Slide-Over Drawer */}
      <SubscriptionOptimizerDrawer
        isOpen={isOptimizerDrawerOpen}
        onClose={() => setIsOptimizerDrawerOpen(false)}
        transaction={selectedSubscriptionTx ? {
          id: selectedSubscriptionTx.id,
          description: selectedSubscriptionTx.description,
          amount: selectedSubscriptionTx.amount,
          category: selectedSubscriptionTx.category,
          account: selectedSubscriptionTx.account,
          currency: currency
        } : null}
        countryContext={currency === 'CHF' ? 'Switzerland' : 'France'}
      />


    </div>
  );
};

export default BankStatements;
