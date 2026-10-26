import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  ArrowUp,
  ArrowDown,
  ArrowLeft,
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
  UserCheck,
  PiggyBank,
  Info,
  Tag,
  Clock,
  CheckCircle2,
  Zap,
  Activity,
  ShieldCheck
} from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { BankFlowCharts } from '../../components/BankFlowCharts';
import { MobileCharts } from './components/MobileCharts';
import { BankAuditReportDrawer } from './components/BankAuditReportDrawer';
import { CategoryAuditDrawer } from '../../components/CategoryAuditDrawer';
import { isPeerTransferTransaction } from '../../lib/categorizationRules';
import { CostOfLivingBuilderDrawer } from '../../components/CostOfLivingBuilderDrawer';
import { SpendingHabitsDrawer } from '../../components/SpendingHabitsDrawer';
import { BudgetTrackingDrawer } from '../../components/BudgetTrackingDrawer';
import { FriseChronologiqueView } from '../../components/FriseChronologiqueView';

import { useTransactions } from '../../context/TransactionsContext';
import { 
  calculateReconciliation, 
  formatBankAmount, 
  detectStatementCurrency,
  type BankReconciliationResult 
} from '../../lib/kpiUtils';
import { getActiveAccountId } from '../../lib/userUtils';
import { 
  auditAndEnrichTransactionsWithGemini, 
  getGeminiApiKey, 
  batchAuditStatementWithGemini,
  generateDeepAuditReport,
  AVAILABLE_FREE_GEMINI_MODELS,
  getGeminiModelName,
  setGeminiModelName,
  testGeminiModelConnection,
  extractBankStatementDirectly,
  type DeepAuditReport
} from '../../lib/geminiService';

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
  findDuplicateStoredTransactionIds,
  detectAccountFromFilename,
  detectBankName,
  validateBankStatementFile,
  validateBankStatementCSVContent,
  sanitizeImportErrorMessage,
  parseCSVBankStatement,
  smartCategorizeTransaction,
  cleanMerchantDescription,
  calculateSubscriptionSummary,
  formatMonthLabel,
  formatDateFR,
  formatCurrency,
  getStatementDisplayStatus,
  type StatementDisplayStatus,
  extractCleanBankStatementRows,
  type CleanBankStatementRow,
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
    availableMonths,
    currency,
    setCurrency,
    customBalances,
    setCustomBalances,
    isRealtimeSynced,
    importState,
    startImportSession,
    updateImportStatus,
    finishImportSession,
    cancelImportSession,
    setAppNotification,
  } = useTransactions();

  // Local state for interactive features
  const [searchTerm, setSearchTerm] = useState('');
  const [isToolsSheetOpen, setIsToolsSheetOpen] = useState(false);
  const [activeViewMode, setActiveViewMode] = useState<'transactions' | 'timeline'>('transactions');
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

  const [transferFilter, setTransferFilter] = useState<'ALL' | 'EXPENSES_INCOME' | 'INTERNAL'>('ALL');

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

  // AI Batch Analysis & Chronomètre states (Gemini 3.8 Flash Free Tier)
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [aiAnalysisSeconds, setAiAnalysisSeconds] = useState(0);
  const [aiAnalysisStats, setAiAnalysisStats] = useState<{
    totalCount: number;
    executionTimeSeconds: string;
    timestamp: Date;
  } | null>(null);
  const aiTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (aiTimerRef.current) clearInterval(aiTimerRef.current);
    };
  }, []);

  // Gemini Generative AI states
  const [isEnhancingWithGemini, setIsEnhancingWithGemini] = useState(false);
  const [isGeminiKeyModalOpen, setIsGeminiKeyModalOpen] = useState(false);
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState(() => getGeminiApiKey());
  const [selectedAiModel, setSelectedAiModel] = useState<string>(() => getGeminiModelName());
  const [isTestingAiConnection, setIsTestingAiConnection] = useState(false);
  const [aiConnectionTestResult, setAiConnectionTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Audit Drawer States
  const [isAuditDrawerOpen, setIsAuditDrawerOpen] = useState(false);
  const [isCostOfLivingDrawerOpen, setIsCostOfLivingDrawerOpen] = useState(false);
  const [isSpendingHabitsDrawerOpen, setIsSpendingHabitsDrawerOpen] = useState(false);
  const [isBudgetTrackingDrawerOpen, setIsBudgetTrackingDrawerOpen] = useState(false);
  const [auditType, setAuditType] = useState<'category' | 'inter-accounts' | 'peer-transfers' | 'kpi-income' | 'kpi-expenses' | 'kpi-savings' | 'kpi-essential' | 'kpi-comfort' | 'subscriptions'>('category');
  const [selectedCategoryData, setSelectedCategoryData] = useState<any>(null);
  const [auditCustomTransactions, setAuditCustomTransactions] = useState<BankTransaction[]>([]);
  const [auditCustomTitle, setAuditCustomTitle] = useState('');
  const [auditCustomSubtitle, setAuditCustomSubtitle] = useState('');
  const [auditCustomTotal, setAuditCustomTotal] = useState(0);

  const handleOpenEssentialAudit = () => {
    setIsCostOfLivingDrawerOpen(true);
  };

  const handleOpenInterAccountsAudit = () => {
    setAuditType('inter-accounts');
    setAuditCustomTitle('Mouvements Inter-Comptes (Flux Propres)');
    setAuditCustomSubtitle('Virements entre vos comptes propres');
    const interTxs = monthScopedTransactions.filter(t => Boolean(
      t.isInternalTransfer ||
      t.category === 'Virements Internes' ||
      t.category === 'Virements internes' ||
      t.category === 'Épargne & Investissement' ||
      t.category === 'Épargne' ||
      t.category === 'Remboursement Carte (Amex)' ||
      t.category?.includes('Fortuneo') ||
      t.category?.includes('Revolut')
    ));
    setAuditCustomTransactions(interTxs);
    setAuditCustomTotal(0);
    setIsAuditDrawerOpen(true);
  };

  const handleOpenPeerTransfersAudit = () => {
    setAuditType('peer-transfers');
    setAuditCustomTitle('Échanges Famille & Amis');
    setAuditCustomSubtitle('Remboursements et envois à vos proches');
    const peerTxs = monthScopedTransactions.filter(t => isPeerTransferTransaction(t));
    setAuditCustomTransactions(peerTxs);
    setAuditCustomTotal(0);
    setIsAuditDrawerOpen(true);
  };

  // AI Subscription Optimizer Drawer State
  const handleOpenSubscriptionsAudit = () => {
    let subTxs = subscriptionSummary.items;
    let total = subscriptionSummary.totalMonthly;
    if (subTxs.length === 0) {
      subTxs = monthScopedTransactions.filter(t => Boolean(t.isSubscription || t.category === 'Abonnements & Télécom' || t.category === 'Abonnements'));
      total = subTxs.reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
    }
    if (subTxs.length === 0) {
      subTxs = bankTransactions.filter(t => Boolean(t.isSubscription || t.category === 'Abonnements & Télécom' || t.category === 'Abonnements'));
      total = subTxs.reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
    }
    setAuditType('subscriptions');
    setAuditCustomTitle('Abonnements & Prélèvements');
    setAuditCustomSubtitle('Tous vos abonnements et prélèvements récurrents');
    setAuditCustomTransactions(subTxs);
    setAuditCustomTotal(total);
    setIsAuditDrawerOpen(true);
  };

  // Deep Financial Audit State (DeepSeek-style comprehensive report)
  const [deepAuditReport, setDeepAuditReport] = useState<DeepAuditReport | null>(null);
  const [isDeepAuditDrawerOpen, setIsDeepAuditDrawerOpen] = useState(false);
  const [isGeneratingDeepAudit, setIsGeneratingDeepAudit] = useState(false);

  // Retour vers le menu global Analyses & Outils
  const handleBackToTools = () => {
    setIsAuditDrawerOpen(false);
    setIsCostOfLivingDrawerOpen(false);
    setIsSpendingHabitsDrawerOpen(false);
    setIsBudgetTrackingDrawerOpen(false);
    setIsDeepAuditDrawerOpen(false);
    setIsToolsSheetOpen(true);
  };

  const handleOpenDeepAudit = async (customTxs?: BankTransaction[]) => {
    // Audit dynamique lié au sélecteur de mois :
    // - Si un mois est sélectionné, audite UNIQUEMENT ce mois
    // - Si "Tous les mois" est sélectionné, audite l'ensemble du relevé
    const txsToAudit = customTxs && customTxs.length > 0
      ? customTxs
      : (selectedMonth === 'all'
          ? (bankTransactions.length > 0 ? bankTransactions : monthScopedTransactions)
          : (monthScopedTransactions.length > 0 ? monthScopedTransactions : bankTransactions.filter(t => t.monthKey === selectedMonth || t.date?.startsWith(selectedMonth)))
        );

    if (txsToAudit.length === 0) {
      setNotification({
        type: 'info',
        message: selectedMonth !== 'all'
          ? `Aucune transaction trouvée pour le mois de ${formatMonthLabel(selectedMonth)}.`
          : "Veuillez d'abord importer un relevé bancaire pour générer l'audit approfondi."
      });
      return;
    }

    const monthLabel = selectedMonth !== 'all' ? formatMonthLabel(selectedMonth) : "Tous les mois";

    setIsGeneratingDeepAudit(true);
    try {
      const rep = await generateDeepAuditReport(txsToAudit, currency, monthLabel);
      setDeepAuditReport(rep);
      setIsDeepAuditDrawerOpen(true);
    } catch (err: any) {
      console.error("Erreur génération audit approfondi:", err);
      setNotification({
        type: 'error',
        message: "Erreur lors de la génération de l'audit : " + (err?.message || '')
      });
    } finally {
      setIsGeneratingDeepAudit(false);
    }
  };

  // Suppression des doublons en base (Deduplication)
  const handlePurgeDuplicates = async () => {
    const duplicateIds = findDuplicateStoredTransactionIds(bankTransactions);
    if (duplicateIds.length === 0) {
      setNotification({
        type: 'success',
        message: "Aucun doublon détecté ! Vos opérations sont 100% saines et propres."
      });
      return;
    }

    if (!window.confirm(`Supprimer définitivement les ${duplicateIds.length} doublons identifiés dans vos opérations ?`)) {
      return;
    }

    try {
      const accountId = getActiveAccountId();
      for (let i = 0; i < duplicateIds.length; i += 400) {
        const chunk = duplicateIds.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach(id => {
          const docRef = doc(db, `users/${accountId}/transactions`, id);
          batch.delete(docRef);
        });
        await batch.commit();
      }

      setRawTransactions(prev => prev.filter(t => !duplicateIds.includes(t.id)));

      // Nettoyer cache local
      try {
        const raw = localStorage.getItem('cashpilot_tx_cache');
        if (raw) {
          const parsed = JSON.parse(raw);
          const filtered = parsed.filter((t: any) => !duplicateIds.includes(t.id));
          localStorage.setItem('cashpilot_tx_cache', JSON.stringify(filtered));
          localStorage.setItem('cashpilot_transactions', JSON.stringify(filtered));
        }
      } catch (e) {}

      setNotification({
        type: 'success',
        message: `Nettoyage réussi : ${duplicateIds.length} doublon${duplicateIds.length > 1 ? 's' : ''} supprimé${duplicateIds.length > 1 ? 's' : ''} avec succès !`
      });
    } catch (err: any) {
      console.error("Erreur suppression doublons:", err);
      setNotification({
        type: 'error',
        message: "Erreur lors de la suppression des doublons."
      });
    }
  };


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

  // Interactive inline category dropdown state
  const [openCategoryDropdownTxId, setOpenCategoryDropdownTxId] = useState<string | null>(null);

  // Close category dropdown on click outside
  useEffect(() => {
    const handleGlobalClick = () => {
      setOpenCategoryDropdownTxId(null);
    };
    if (openCategoryDropdownTxId) {
      window.addEventListener('click', handleGlobalClick);
      return () => window.removeEventListener('click', handleGlobalClick);
    }
  }, [openCategoryDropdownTxId]);

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
      
      // Auto-analyse intelligente du libellé complet si catégorie manquante, 'Autre' ou macro-catégorie non distinguée
      const smart = smartCategorizeTransaction(rawDesc, amount, t.date);
      // Correction proactive : si un montant positif a été indûment étiqueté en SAVINGS_TRANSFER alors qu'il s'agit d'un revenu réel (tiers, proche, alloc)
      const isSuspectSavings = amount > 0 && (t.flowType === 'SAVINGS_TRANSFER' || t.category === 'Épargne & Investissement') && smart.flowType === 'INCOME';
      
      const isGenericOrMacroCategory = !t.category || 
        t.category === 'Autre' || 
        t.category === 'Charges variables courantes' || 
        t.category === 'Charges variables' || 
        t.category === 'Charges fixes' || 
        t.category === 'Dépenses de confort' || 
        t.category === 'Revenus' ||
        t.category === 'Revenu';

      let category = t.category;
      if (isSuspectSavings) {
        category = smart.category;
      } else if (isGenericOrMacroCategory) {
        if (smart.category && smart.category !== 'Autre') {
          category = smart.category;
        } else if (amount > 0) {
          category = 'Salaire & Revenus';
        } else if (t.category === 'Charges fixes' || t.isSubscription) {
          category = 'Abonnements & Télécom';
        } else if (t.category === 'Charges variables courantes') {
          category = 'Alimentation & Courses';
        } else if (t.category === 'Dépenses de confort') {
          category = 'Restaurants & Sorties';
        } else {
          category = 'Autre';
        }
      }

      let isSubscription = t.isSubscription !== undefined 
        ? Boolean(t.isSubscription) 
        : (category === 'Abonnements & Télécom' || smart.isSubscription);

      // Sécurité anti-faux-positifs : Les encaissements et virements ponctuels ne sont JAMAIS des abonnements
      const rawTextUpperCheck = `${rawDesc} ${cleanDesc}`.toUpperCase();
      if (amount > 0 || ((rawTextUpperCheck.includes('VIR ') || rawTextUpperCheck.includes('VIREMENT')) && !rawTextUpperCheck.includes('PERMANENT'))) {
        isSubscription = false;
      }

      // Règle comptable : Définition de la nature (Fixe vs Variable vs Revenu vs Épargne)
      let flowType: FlowType = isSuspectSavings ? 'INCOME' : 'VARIABLE_EXPENSE';
      if (amount > 0) {
        flowType = 'INCOME';
      } else if (
        category === 'Logement & Énergie' || 
        category === 'Abonnements & Télécom' || 
        category === 'Assurances' || 
        category === 'Frais bancaires' || 
        category === 'Impôts & Amendes' || 
        category === 'Paiement fractionné' ||
        isSubscription
      ) {
        flowType = 'FIXED_EXPENSE';
      } else if (category === 'Épargne & Investissement' || category === 'Virements Internes') {
        flowType = 'SAVINGS_TRANSFER';
      } else {
        flowType = 'VARIABLE_EXPENSE';
      }

      const account = t.accountName || t.account || 'Compte Principal';
      const bankName = t.bankName || (account.includes(' - ') ? account.split(' - ')[0] : account);
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

      // Un virement interne ne peut être qu'un véritable VIREMENT (jamais un paiement carte, prélèvement ou frais)
      const isTransferOperation = 
        rawTextUpper.includes('VIR ') || 
        rawTextUpper.includes('VIREMENT') || 
        rawTextUpper.includes('COMPTE A COMPTE') ||
        category === 'Virements Internes';

      // Les virements internes restent limités aux mouvements de comptes propres ("Fortuneo", "Virement Interne", ou son 2nd compte perso)
      // Les mots-clés génériques de la banque ("SG", "Société Générale", "Compte Courant") ne doivent JAMAIS convertir une dépense courante en virement interne
      const matchesOwnAccount = isTransferOperation && (
        rawText.includes('virement interne') ||
        rawText.includes('compte a compte') ||
        rawText.includes('fortuneo') ||
        (rawTextUpper.includes('KOUROUFIA') && !matchesFamily) ||
        virementRules.ownAccountsKeywords.some(kw => {
          const k = kw.trim().toLowerCase();
          if (!k || k === 'sg' || k === 'société générale' || k === 'societe generale' || k === 'compte courant') return false;
          return rawText.includes(k);
        })
      );

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
      } else if (isTransferOperation && (matchesUserFirstName || matchesOwnAccount)) {
        // Uniquement les virements entre comptes propres de l'utilisateur
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
        source_type: t.source_type || t.sourceType || t.importFormat || 'CSV',
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

  // Détermination fidèle de la réalité du relevé bancaire (Règle stricte CSV sans Solde / Dispo)
  const statementStatus: StatementDisplayStatus = useMemo(() => {
    const scopedTxs = selectedAccount === 'ALL'
      ? monthScopedTransactions
      : monthScopedTransactions.filter(t => t.account === selectedAccount);

    return getStatementDisplayStatus(
      scopedTxs,
      metrics.netCashFlow || 0,
      currentMonthBalances.closing,
      currency
    );
  }, [monthScopedTransactions, selectedAccount, metrics.netCashFlow, currentMonthBalances.closing, currency]);

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

      // Détermination rigoureuse du sens du flux (Débit = Dépense, Crédit = Entrée)
      const isDebit = 
        t.type === 'debit' || 
        t.direction === 'debit' || 
        (typeof t.rawAmount === 'number' && t.rawAmount < 0) ||
        (t.rawAmount === undefined && typeof t.amount === 'number' && t.amount < 0) ||
        t.flowType === 'FIXED_EXPENSE' || 
        t.flowType === 'VARIABLE_EXPENSE';

      const isCredit = !isDebit;

      if (selectedFilter === 'ALL') return true;
      if (selectedFilter === 'INCOME') return isCredit;
      if (selectedFilter === 'FIXED') return isDebit && t.flowType === 'FIXED_EXPENSE';
      if (selectedFilter === 'VARIABLE') return isDebit && (t.flowType === 'VARIABLE_EXPENSE' || t.flowType !== 'FIXED_EXPENSE');
      if (selectedFilter === 'SUBSCRIPTION') return Boolean(t.isSubscription || t.category === 'Abonnements & Télécom');
      if (selectedFilter === 'EXPENSE') return isDebit && !t.isInternalTransfer && t.flowType !== 'SAVINGS_TRANSFER';
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

    // Repérer les opérations en base ayant 'Autre', ou les encaissements (>0) classés à tort en dépenses/Virements Famille
    const unclassifiedInDb = rawTransactions.filter(t => {
      if (t.category === 'Autre') return true;
      const amt = Number(t.amount) || 0;
      // Détection des encaissements positifs (>0) qui ont fuité dans les dépenses ou l'épargne
      if (amt > 0) {
        if (t.flowType !== 'INCOME' || t.category === 'Virements Famille & Proches' || t.direction === 'debit') {
          return true;
        }
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

  // 1. Inline Category Change with Firestore sync & Rule Memorization for Past & Future Imports
  const handleQuickCategoryRemap = async (tx: BankTransaction, newCategory: string) => {
    setOpenCategoryDropdownTxId(null);
    if (!tx || tx.category === newCategory) return;

    const rawMerchant = tx.cleanLabel || tx.description || tx.rawLabel || '';
    const cleanKey = cleanMerchantDescription(rawMerchant).toLowerCase().trim();
    const newFlow = classifyFlowType(newCategory, tx.amount, tx.description);
    const isSub = newCategory === 'Abonnements & Télécom' || (tx.isSubscription && newFlow === 'FIXED_EXPENSE');

    // 1. Sauvegarde et mémorisation de la règle de remappage dans le localStorage
    try {
      const savedRulesRaw = localStorage.getItem('cashpilot_custom_rules');
      let rules: any[] = [];
      if (savedRulesRaw) {
        try { rules = JSON.parse(savedRulesRaw) || []; } catch {}
      }
      const existingRuleIdx = rules.findIndex((r: any) => r.keyword && (r.keyword.toLowerCase() === cleanKey || cleanKey.includes(r.keyword.toLowerCase())));
      const newRuleObj = {
        id: `rule_${Date.now()}`,
        keyword: cleanKey,
        category: newCategory,
        flowType: newFlow,
        isSubscription: isSub,
        createdAt: new Date().toISOString()
      };
      if (existingRuleIdx >= 0) {
        rules[existingRuleIdx] = { ...rules[existingRuleIdx], ...newRuleObj };
      } else {
        rules.push(newRuleObj);
      }
      localStorage.setItem('cashpilot_custom_rules', JSON.stringify(rules));

      // Dictionnaire direct de remappage pour accès instantané
      const remapRulesRaw = localStorage.getItem('cashpilot_category_remap_rules');
      let remapDict: Record<string, string> = {};
      if (remapRulesRaw) {
        try { remapDict = JSON.parse(remapRulesRaw) || {}; } catch {}
      }
      remapDict[cleanKey] = newCategory;
      localStorage.setItem('cashpilot_category_remap_rules', JSON.stringify(remapDict));
    } catch (e) {
      console.error("Erreur sauvegarde règle:", e);
    }

    // 2. Détection immédiate de toutes les transactions passées ayant le même libellé / commerçant
    const matchingTxs = bankTransactions.filter(t => {
      if (t.id === tx.id) return true;
      const tDesc = cleanMerchantDescription(t.cleanLabel || t.description || t.rawLabel || '').toLowerCase().trim();
      return tDesc === cleanKey || (cleanKey.length > 3 && tDesc.includes(cleanKey));
    });

    const matchingIds = new Set(matchingTxs.map(t => t.id));

    // 3. Mise à jour optimiste locale immédiate (0ms de latence perçue)
    setRawTransactions(prev => prev.map(t => {
      if (matchingIds.has(t.id)) {
        const txFlow = classifyFlowType(newCategory, t.amount, t.description);
        return {
          ...t,
          category: newCategory,
          flowType: txFlow,
          isSubscription: newCategory === 'Abonnements & Télécom' || (t.isSubscription && txFlow === 'FIXED_EXPENSE'),
          nature: txFlow === 'FIXED_EXPENSE' ? 'fixe' : txFlow === 'VARIABLE_EXPENSE' ? 'variable' : 'autre'
        };
      }
      return t;
    }));

    // 4. Synchronisation par lot (writeBatch) dans Firestore pour persistance cloud
    try {
      const accountId = getActiveAccountId();
      const batch = writeBatch(db);
      matchingTxs.forEach(t => {
        const docRef = doc(db, `users/${accountId}/transactions`, t.id);
        const txFlow = classifyFlowType(newCategory, t.amount, t.description);
        batch.update(docRef, {
          category: newCategory,
          flowType: txFlow,
          nature: txFlow === 'FIXED_EXPENSE' ? 'fixe' : txFlow === 'VARIABLE_EXPENSE' ? 'variable' : 'autre',
          isSubscription: newCategory === 'Abonnements & Télécom' || (t.isSubscription && txFlow === 'FIXED_EXPENSE'),
          updatedAt: new Date().toISOString()
        });
      });
      await batch.commit();

      setNotification({
        type: 'success',
        message: `${matchingTxs.length} opération${matchingTxs.length > 1 ? 's' : ''} reclassée${matchingTxs.length > 1 ? 's' : ''} en "${newCategory}". Règle mémorisée pour les futurs imports.`
      });
    } catch (err) {
      console.error("Erreur réassignation Firestore:", err);
      setNotification({
        type: 'error',
        message: "Échec de la synchronisation Firestore."
      });
    }
  };

  const handleCategoryChange = async (id: string, newCategory: string) => {
    const tx = bankTransactions.find(t => t.id === id);
    if (!tx) return;
    await handleQuickCategoryRemap(tx, newCategory);
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

  // 8. File Upload & Extraction avec refonte stricte CSV (3 colonnes) & Audit IA Gemini 3.8 Flash
  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // --- 0. VALIDATION PRÉALABLE DU RELEVÉ BANCAIRE (REJET IMMÉDIAT DES FICHIERS HORS RB) ---
    const fileValidation = validateBankStatementFile(file);
    if (!fileValidation.isValid) {
      setNotification({
        type: 'error',
        message: fileValidation.errorMessage || `Le fichier "${file.name}" n'est pas un relevé bancaire supporté. Veuillez importer un relevé au format CSV ou PDF.`
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    startImportSession(file.name);
    setIsProcessingFile(true);
    setFileStatusMessage(`Lecture de ${file.name}...`);

    try {
      const accountId = getActiveAccountId();
      let extractedTxs: BankTransaction[] = [];
      let detectedBankName = '';
      let detectedAccountName = '';

      if (file.name.endsWith('.csv') || file.type.includes('csv') || file.type.includes('text')) {
        // --- 1. REFONTE IMPORT CSV : FILTRAGE STRICT DES 3 COLONNES (Date, Libellé brut, Montant) ---
        setFileStatusMessage("Filtrage des colonnes bancaires (Date, Libellé brut, Montant)...");
        const text = await readBankStatementFileText(file);
        // Validation du contenu : vérification de la structure d'un relevé bancaire
        const csvValidation = validateBankStatementCSVContent(text, file.name);
        if (!csvValidation.isValid) {
          setNotification({
            type: 'error',
            message: csvValidation.errorMessage || `Ce fichier ne semble pas être un relevé de compte bancaire valide.`
          });
          setIsProcessingFile(false);
          setFileStatusMessage(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }
        
        // Détection automatique de la devise et du nom de banque/compte
        const detectedBank = detectBankName(text);
        const fileDetection = detectAccountFromFilename(file.name);
        const detectedCurrency = detectStatementCurrency(text) || 'EUR';
        if (detectedCurrency && detectedCurrency !== currency) {
          setCurrency(detectedCurrency);
        }

        detectedBankName = detectedBank !== 'Compte Courant' ? detectedBank : fileDetection.bankName;
        detectedAccountName = detectedBankName ? `${detectedBankName} - Compte Courant` : fileDetection.accountName;

        // Extraction stricte : TOUTES les colonnes inutiles de la banque sont supprimées
        const cleanRows = extractCleanBankStatementRows(text);

        if (cleanRows.length === 0) {
          setNotification({
            type: 'error',
            message: `Ce fichier ("${file.name}") ne contient aucune transaction bancaire exploitable (colonnes Date, Libellé et Montant introuvables). Veuillez vérifier votre fichier.`
          });
          setIsProcessingFile(false);
          setFileStatusMessage(null);
          return;
        }

        // --- 2. NOUVELLE FONCTIONNALITÉ UI : INDICATEUR DE CHARGEMENT & CHRONOMÈTRE ---
        setIsAiAnalyzing(true);
        setAiAnalysisSeconds(0);
        const startMsg = `L'IA Gemini 2.5 Flash Ultra analyse vos ${cleanRows.length} opérations en lot...`;
        setFileStatusMessage(startMsg);
        updateImportStatus(startMsg, true);

        // Démarrage du chronomètre local (synchronisé avec TransactionsContext)
        const startTime = performance.now();
        if (aiTimerRef.current) clearInterval(aiTimerRef.current);
        aiTimerRef.current = setInterval(() => {
          setAiAnalysisSeconds(prev => parseFloat((prev + 0.1).toFixed(1)));
        }, 100);

        try {
          let aiResults: any[] = [];
          try {
            // Audit direct ultra-rapide par Gemini 2.5 Flash Ultra (~1s) avec repli transparent
            aiResults = await batchAuditStatementWithGemini(
              cleanRows.map(r => ({
                index: r.index,
                date: r.date,
                rawLabel: r.rawLabel,
                amount: r.amount
              })),
              (processed, total) => {
                const progMsg = `Audit IA intégral en cours : ${processed}/${total} opérations analysées par Gemini...`;
                setFileStatusMessage(progMsg);
                updateImportStatus(progMsg, true);
              }
            );
          } catch (auditErr: any) {
            console.warn("Audit Gemini en lot avec repli local instantané :", auditErr);
            aiResults = cleanRows.map(r => {
              const localClass = classifyTransaction(r.rawLabel, r.amount);
              return {
                index: r.index,
                merchantName: localClass.cleanDesc || cleanMerchantDescription(r.rawLabel),
                category: localClass.category !== 'Autre' ? localClass.category : (r.amount > 0 ? 'Salaire & Revenus' : 'Alimentation & Courses'),
                isSubscription: Boolean(localClass.isSubscription)
              };
            });
          }

          // Arrêt du chronomètre
          if (aiTimerRef.current) {
            clearInterval(aiTimerRef.current);
            aiTimerRef.current = null;
          }
          const totalDurationSec = ((performance.now() - startTime) / 1000).toFixed(2);

          const resultMap = new Map<number, any>();
          aiResults.forEach(item => {
            if (typeof item.index === 'number') {
              resultMap.set(item.index, item);
            }
          });

          // Enregistrement des statistiques pour affichage permanent du chronomètre UI
          setAiAnalysisStats({
            totalCount: cleanRows.length,
            executionTimeSeconds: totalDurationSec,
            timestamp: new Date()
          });
          extractedTxs = cleanRows.map((row, idx) => {
            const ai = resultMap.get(row.index) || resultMap.get(idx);
            const localClass = classifyTransaction(row.rawLabel, row.amount);
            const merchantName = ai?.merchantName || localClass.cleanDesc || cleanMerchantDescription(row.rawLabel);
            
            // Catégorisation intelligente : Exclusion stricte des macro-catégories
            let category = ai?.category;
            const isMacroOrGeneric = !category || 
              category === 'Autre' || 
              category === 'Charges variables courantes' || 
              category === 'Charges variables' || 
              category === 'Charges fixes' || 
              category === 'Dépenses de confort' || 
              category === 'Revenus' ||
              category === 'Revenu';

            const isSub = ai?.isSubscription !== undefined ? Boolean(ai.isSubscription) : Boolean(localClass.isSubscription);
            const isPositive = Number(row.amount) > 0;

            if (isMacroOrGeneric) {
              if (localClass.category && localClass.category !== 'Autre') {
                category = localClass.category;
              } else if (isPositive) {
                category = 'Salaire & Revenus';
              } else if (category === 'Charges fixes' || isSub) {
                category = 'Abonnements & Télécom';
              } else if (category === 'Charges variables courantes') {
                category = 'Alimentation & Courses';
              } else if (category === 'Dépenses de confort') {
                category = 'Restaurants & Sorties';
              } else {
                category = 'Alimentation & Courses';
              }
            }
            
            // Affinement des virements proches
            if (isPositive) {
              const rawUp = (row.rawLabel || '').toUpperCase();
              if (
                rawUp.includes('VIR') && (
                  rawUp.includes('NAYSSA') || rawUp.includes('NAISTABA') || rawUp.includes('DRAME') ||
                  rawUp.includes('EL HANI') || rawUp.includes('WERO') || rawUp.includes('PAYLIB') ||
                  rawUp.includes('LE BEAUF') || rawUp.includes('REVOLUT') || rawUp.includes('PROCHE')
                )
              ) {
                category = 'Virement Reçu (Proches)';
              } else if (category === 'Virements Famille & Proches') {
                category = 'Virement Reçu (Proches)';
              }
            } else {
              const rawUp = (row.rawLabel || '').toUpperCase();
              if (
                rawUp.includes('VIR') && (
                  rawUp.includes('NAYSSA') || rawUp.includes('NAISTABA') || rawUp.includes('DRAME') ||
                  rawUp.includes('EL HANI') || rawUp.includes('WERO') || rawUp.includes('PAYLIB') ||
                  rawUp.includes('LE BEAUF') || rawUp.includes('REVOLUT') || rawUp.includes('M. KOUROUFIA')
                ) && !rawUp.includes('LOYER')
              ) {
                category = 'Virements Famille & Proches';
              }
            }

            // RÈGLE COMPTABLE ABSOLUE DU SENS DU FLUX :
            let flow: FlowType = 'VARIABLE_EXPENSE';
            if (isPositive) {
              flow = 'INCOME';
            } else if (
              category === 'Logement & Énergie' || 
              category === 'Abonnements & Télécom' || 
              category === 'Assurances' || 
              category === 'Frais bancaires' || 
              category === 'Paiement fractionné' ||
              isSub
            ) {
              flow = 'FIXED_EXPENSE';
            } else if (category === 'Épargne & Investissement') {
              flow = 'SAVINGS_TRANSFER';
            } else {
              flow = 'VARIABLE_EXPENSE';
            }

            const dayOfMonth = row.date ? parseInt(row.date.split('-')[2], 10) : undefined;

            return {
              id: `csv_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
              date: row.date,
              description: merchantName,
              rawLabel: row.rawLabel,
              cleanLabel: merchantName,
              amount: row.amount,
              flowType: flow,
              category,
              isSubscription: isSub,
              subscriptionDay: isSub ? dayOfMonth : undefined,
              confidence: 'high' as const,
              account: detectedAccountName,
              bankName: detectedBankName,
              status: flow === 'SAVINGS_TRANSFER' ? ('Internal Transfer' as const) : ('Reconciled' as const)
            };
          });

        } catch (aiErr: any) {
          if (aiTimerRef.current) {
            clearInterval(aiTimerRef.current);
            aiTimerRef.current = null;
          }
          console.error("Erreur Cloud Function analyzeBankStatement:", aiErr);
          throw new Error("Erreur Cloud Function Gemini : " + (aiErr.message || 'Échec de l\'analyse IA.'));
        } finally {
          setIsAiAnalyzing(false);
        }

      } else {
        // Fast direct multimodal analysis with Gemini 3.8 Flash (100% Free, zero server lag)
        setFileStatusMessage("Analyse directe et intelligente par Gemini 3.8 Flash (ultra-rapide)...");
        let directSuccess = false;

        try {
          const directResult = await extractBankStatementDirectly(file);
          if (directResult && directResult.isBankStatement === false) {
            setNotification({
              type: 'error',
              message: `Ce document ("${file.name}") ne semble pas être un relevé de compte bancaire${directResult.rejectionReason ? ` (${directResult.rejectionReason})` : ''}. Veuillez importer un relevé bancaire officiel.`
            });
            setIsProcessingFile(false);
            setFileStatusMessage(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
          }
          if (directResult && directResult.transactions && directResult.transactions.length > 0) {
            detectedBankName = directResult.bankName || 'Banque';
            detectedAccountName = directResult.accountName || `${detectedBankName} - ${directResult.accountType || 'Compte'}`;
            const fileCurrency = directResult.currency || 'EUR';
            if (fileCurrency && fileCurrency !== currency) {
              setCurrency(fileCurrency);
            }

            extractedTxs = directResult.transactions.map((t: any, i: number) => {
              const amt = Number(t.amount) || 0;
              const desc = t.cleanLabel || t.rawLabel || 'Opération';
              const smart = smartCategorizeTransaction(desc, amt, t.date);
              const isMacro = !t.category || 
                t.category === 'Charges fixes' || 
                t.category === 'Charges variables courantes' || 
                t.category === 'Charges variables' || 
                t.category === 'Dépenses de confort' || 
                t.category === 'Revenus' || 
                t.category === 'Autre';

              let cat = (!isMacro && t.category) ? t.category : smart.category;
              if (cat === 'Charges fixes' || (!cat && t.isSubscription)) cat = 'Abonnements & Télécom';
              if (cat === 'Charges variables courantes' || !cat) cat = amt > 0 ? 'Salaire & Revenus' : 'Alimentation & Courses';
              if (cat === 'Dépenses de confort') cat = 'Restaurants & Sorties';

              const isFixed = cat === 'Logement & Énergie' || 
                cat === 'Abonnements & Télécom' || 
                cat === 'Assurances' || 
                cat === 'Frais bancaires' || 
                cat === 'Impôts & Amendes' || 
                cat === 'Paiement fractionné' || 
                Boolean(t.isSubscription);

              const flow: FlowType = amt > 0 ? 'INCOME' : (isFixed ? 'FIXED_EXPENSE' : (cat === 'Épargne & Investissement' || cat === 'Virements Internes' ? 'SAVINGS_TRANSFER' : 'VARIABLE_EXPENSE'));
              return {
                id: `direct_${Date.now()}_${i}`,
                date: t.date || new Date().toISOString().substring(0, 10),
                description: desc,
                rawLabel: t.rawLabel || desc,
                cleanLabel: desc,
                amount: amt,
                flowType: flow,
                category: cat,
                isSubscription: t.isSubscription !== undefined ? t.isSubscription : smart.isSubscription,
                subscriptionDay: smart.subscriptionDay,
                confidence: 'high' as const,
                account: detectedAccountName,
                bankName: detectedBankName
              };
            });
            directSuccess = true;
          }
        } catch (directErr: any) {
          console.warn("Échec extraction directe Gemini, bascule vers Cloud Function :", directErr);
        }

        if (!directSuccess) {
          // Fallback to Cloud Function if direct Gemini extraction is unavailable
          setFileStatusMessage("Téléversement sécurisé vers Firebase Storage...");
          const storageRef = ref(storage, `users/${accountId}/uploads/statements/${Date.now()}_${file.name}`);
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);

          setFileStatusMessage("Analyse OCR et détection intelligente du compte par l'IA...");
          const analyzeDocument = httpsCallable(functions, 'analyzeDocument');
          const response = await analyzeDocument({ fileUrl: url, fileType: 'bank_statement', mimeType: file.type });
          const result = response.data as any;

          if (result.success && result.data) {
            if (result.data.isBankStatement === false) {
              setNotification({
                type: 'error',
                message: `Ce document ("${file.name}") ne semble pas être un relevé bancaire valide${result.data.rejectionReason ? ` (${result.data.rejectionReason})` : ''}. Assurez-vous d'importer un relevé de compte officiel.`
              });
              setIsProcessingFile(false);
              setFileStatusMessage(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
              return;
            }
            detectedBankName = result.data.bankName || 'Banque';
            detectedAccountName = result.data.accountName || `${detectedBankName} - ${result.data.accountType || 'Compte'}`;

            const detectedCurrency = detectStatementCurrency(result.data.currency || result.data.rawText || file.name);
            const fileCurrency = detectedCurrency || 'EUR';
            if (fileCurrency && fileCurrency !== currency) {
              setCurrency(fileCurrency);
            }

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
                  rawLabel: t.rawLabel || desc,
                  cleanLabel: desc,
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
      }

      if (extractedTxs.length === 0) {
        setNotification({
          type: 'error',
          message: `Aucune opération bancaire n'a été détectée dans ce document ("${file.name}"). Assurez-vous d'importer un relevé bancaire officiel (PDF ou CSV).`
        });
        setIsProcessingFile(false);
        setFileStatusMessage(null);
        return;
      }

      // Check Duplicates against existing transactions
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

      // Sauvegarde des transactions uniques dans Firestore batch
      setFileStatusMessage(`Sauvegarde de ${uniqueTxs.length} opérations pour "${detectedAccountName}"...`);
      const isPdfFile = file.name.toLowerCase().endsWith('.pdf') || file.type.includes('pdf');
      const batch = writeBatch(db);
      const txRef = collection(db, `users/${accountId}/transactions`);

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
          nature: tx.flowType === 'FIXED_EXPENSE' ? 'fixe' : (tx.flowType === 'INCOME' ? 'revenu' : 'variable'),
          source_type: isPdfFile ? 'PDF' : 'CSV',
          importFormat: isPdfFile ? 'PDF' : 'CSV',
          isSubscription: Boolean(tx.isSubscription),
          subscriptionDay: tx.subscriptionDay || null,
          accountName: tx.account || detectedAccountName || 'Compte Principal',
          bankName: tx.bankName || detectedBankName || 'Banque',
          aiStatus: 'gemini_analyzed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      });

      await batch.commit();

      const totalDurationSec = ((performance.now() - (typeof startTime !== 'undefined' ? startTime : performance.now())) / 1000).toFixed(2);
      const stats = {
        totalCount: uniqueTxs.length,
        executionTimeSeconds: totalDurationSec,
        timestamp: new Date()
      };

      setAiAnalysisStats(stats);
      finishImportSession(stats);
      setIsAiAnalyzing(false);
      setIsProcessingFile(false);
      setIsUploading(false);

      const successMsg = `Import réussi : ${uniqueTxs.length} opérations auditées et enregistrées (${duplicatesCount} doublons ignorés).`;
      setNotification({
        type: 'success',
        message: successMsg
      });
      setAppNotification({
        type: 'success',
        message: successMsg
      });

      // Synchronisations secondaires en arrière-plan sans bloquer l'interface
      (async () => {
        try {
          const sortedByDate = [...uniqueTxs].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
          const dateDebut = sortedByDate[0]?.date || new Date().toISOString().substring(0, 10);
          const dateFin = sortedByDate[sortedByDate.length - 1]?.date || dateDebut;
          const isPdfFile = file.name.toLowerCase().endsWith('.pdf') || file.type.includes('pdf');

          const releveRef = doc(collection(db, `users/${accountId}/comptes/compte_principal/releves`));
          const relevePayload = {
            id: releveRef.id,
            compteId: 'compte_principal',
            source_type: isPdfFile ? 'PDF' : 'CSV',
            nom_fichier: file.name,
            date_debut: dateDebut,
            date_fin: dateFin,
            solde_initial: null,
            solde_final: null,
            transactions_count: uniqueTxs.length,
            createdAt: new Date().toISOString()
          };
          await setDoc(releveRef, relevePayload, { merge: true });

          try {
            const nosqlReleveRef = doc(db, 'ComptesBancaires/compte_principal/RelevesImportes', releveRef.id);
            await setDoc(nosqlReleveRef, relevePayload, { merge: true });
          } catch {
            // Ignorer si les règles d'écriture ComptesBancaires sont restreintes
          }
        } catch (syncErr) {
          console.warn("Synchronisation ComptesBancaires différée :", syncErr);
        }
      })();

      // Rapport d'audit approfondi IA en tâche de fond (non-bloquant)
      (async () => {
        try {
          const fullAudit = await generateDeepAuditReport(uniqueTxs, detectedCurrency);
          setDeepAuditReport(fullAudit);
        } catch (auditErr) {
          console.warn("Génération automatique de l'audit approfondi ignorée :", auditErr);
        }
      })();
    } catch (err: any) {
      console.error("Erreur import relevé:", err);
      cancelImportSession();
      setIsProcessingFile(false);
      setIsAiAnalyzing(false);
      setIsUploading(false);
      const errMsg = sanitizeImportErrorMessage(err, file.name);
      setNotification({
        type: 'error',
        message: errMsg
      });
      setAppNotification({
        type: 'error',
        message: errMsg
      });
    } finally {
      setIsProcessingFile(false);
      setIsAiAnalyzing(false);
      setFileStatusMessage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const categoryStats = useMemo(() => {
    const totals: Record<string, number> = {};
    const scopedTxs = selectedAccount === 'ALL'
      ? monthScopedTransactions
      : monthScopedTransactions.filter(t => t.account === selectedAccount);
      
    scopedTxs.forEach(t => {
      const isDebit = 
        t.type === 'debit' ||
        t.direction === 'debit' ||
        (typeof t.rawAmount === 'number' && t.rawAmount < 0) ||
        (t.rawAmount === undefined && typeof t.amount === 'number' && t.amount < 0) ||
        t.flowType === 'FIXED_EXPENSE' ||
        t.flowType === 'VARIABLE_EXPENSE';

      // Seules les dépenses effectives (débits réels, hors virements internes et épargne) entrent dans les dépenses par catégorie
      if (!isDebit) return;
      if (t.isInternalTransfer || t.flowType === 'SAVINGS_TRANSFER') return;

      const amt = Math.abs(Number(t.amount) || 0);
      let cat = t.category;
      
      // Exclusion stricte des macro-catégories pour les graphiques et synthèses
      const isMacroOrEmpty = !cat || 
        cat === 'Charges fixes' || 
        cat === 'Charges variables courantes' || 
        cat === 'Charges variables' || 
        cat === 'Dépenses de confort' || 
        cat === 'Revenus' ||
        cat === 'Revenu' ||
        cat === 'Autre' ||
        cat === 'Autres';

      if (isMacroOrEmpty) {
        const smart = smartCategorizeTransaction(t.rawLabel || t.description, t.amount, t.date);
        if (smart.category && smart.category !== 'Autre') {
          cat = smart.category;
        } else if (cat === 'Charges fixes' || t.isSubscription) {
          cat = 'Abonnements & Télécom';
        } else if (cat === 'Charges variables courantes') {
          cat = 'Alimentation & Courses';
        } else if (cat === 'Dépenses de confort') {
          cat = 'Restaurants & Sorties';
        } else {
          cat = 'Autre';
        }
      }

      totals[cat] = (totals[cat] || 0) + amt;
    });
    const categories = Object.entries(totals)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
      
    return { categories };
  }, [monthScopedTransactions, selectedAccount]);

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans pb-20 relative">
      {/* 1. En-tête et Filtre Global Épuré */}
      <header className="flex justify-between items-center p-4 bg-white dark:bg-gray-800 shadow-sm z-10 sticky top-0">
        <div className="flex items-center space-x-2">
          {/* Sélecteur de mois à fort contraste CSS (accessible et lisible sur PC et mobile) */}
          <div className="relative flex items-center">
            <select 
              value={selectedMonth} 
              onChange={e => setSelectedMonth(e.target.value)}
              className="appearance-none bg-gray-100 hover:bg-gray-200/80 dark:bg-gray-700 dark:hover:bg-gray-650 text-gray-900 dark:text-gray-100 font-bold text-base sm:text-lg pl-3.5 pr-8 py-2 rounded-2xl border border-gray-200 dark:border-gray-600 shadow-sm outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-colors"
            >
              <option value="all" className="bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 py-1 font-semibold">
                Tous les mois
              </option>
              {availableMonths.map(m => (
                <option 
                  key={m} 
                  value={m}
                  className="bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 py-1 font-semibold"
                >
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 dark:text-gray-400" />
          </div>
        </div>
        <div className="flex items-center space-x-2">
           <button 
              onClick={() => fileInputRef.current?.click()}
              className="h-10 w-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg hover:bg-blue-700 transition active:scale-95 flex-shrink-0 cursor-pointer"
              title="Importer un relevé bancaire (CSV ou PDF)"
           >
             <Plus size={18} strokeWidth={2.5}/>
             <span className="sr-only">RB</span>
           </button>
        </div>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept=".csv,.txt,.tsv,.pdf,application/pdf,text/csv,text/plain"
          onChange={(e) => { if (e.target.files && e.target.files.length > 0) handleFileUpload(e.target.files[0]) }} 
        />
      </header>
      {/* SÉLECTEUR DE VUE : OPÉRATIONS vs FRISE CHRONOLOGIQUE */}
      <div className="flex items-center space-x-2 border-b border-gray-100 dark:border-gray-800 px-4 pt-2.5 pb-2.5 bg-white dark:bg-gray-900 sticky top-0 z-20 shadow-xs">
        <button
          onClick={() => setActiveViewMode('transactions')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeViewMode === 'transactions'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700/60'
          }`}
        >
          <FileSpreadsheet size={14} />
          <span>Opérations & Analyses</span>
        </button>

        <button
          onClick={() => setActiveViewMode('timeline')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
            activeViewMode === 'timeline'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700/60'
          }`}
        >
          <Clock size={14} />
          <span>Frise Chronologique</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            Rapprochement
          </span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {activeViewMode === 'timeline' ? (
          <FriseChronologiqueView compteId="compte_principal" currency={currency} />
        ) : (
          <>
        {/* Indicateur de chargement visuel avec chronomètre en direct lors de l'analyse IA */}
        {(Boolean(importState?.isAiAnalyzing) || isAiAnalyzing || Boolean(importState?.isImporting)) && (
          <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/40 dark:via-indigo-950/40 dark:to-purple-950/40 border-2 border-indigo-500/40 dark:border-indigo-500/50 rounded-[1.8rem] p-5 shadow-lg shadow-indigo-500/10 transition-all animate-pulse">
            <div className="flex items-center space-x-4">
              <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-500/30 flex-shrink-0">
                <Loader2 className="w-6 h-6 animate-spin text-white" />
                <Sparkles className="w-4 h-4 absolute -top-1 -right-1 text-amber-300 animate-bounce" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h4 className="font-bold text-gray-900 dark:text-white text-base flex items-center gap-2">
                    <span>Audit & Catégorisation IA en cours</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 font-mono font-semibold">
                      Gemini 2.5 Flash Ultra
                    </span>
                  </h4>
                  <div className="flex items-center space-x-1.5 font-mono text-base font-extrabold text-indigo-600 dark:text-indigo-400 bg-white/80 dark:bg-gray-800/80 px-2.5 py-0.5 rounded-xl border border-indigo-100 dark:border-indigo-800">
                    <Clock size={14} className="animate-spin text-indigo-500" />
                    <span>{((importState?.isAiAnalyzing ? importState?.aiAnalysisSeconds : aiAnalysisSeconds) ?? 0).toFixed(1)}s</span>
                  </div>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1.5">
                  {importState?.fileStatusMessage || fileStatusMessage || "Filtrage des 3 colonnes (Date, Libellé brut, Montant) et audit en lot par l'IA..."}
                </p>
                {/* Barre de progression visuelle */}
                <div className="w-full bg-indigo-100 dark:bg-indigo-900/50 rounded-full h-2 mt-3 overflow-hidden">
                  <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-2 rounded-full w-full animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chronomètre & Résultat d'analyse IA une fois terminée */}
        {(importState?.aiAnalysisStats || aiAnalysisStats) && !(importState?.isAiAnalyzing || isAiAnalyzing || importState?.isImporting) && (
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-green-50 dark:from-emerald-950/30 dark:via-teal-950/30 dark:to-green-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-[1.8rem] p-4 sm:p-5 shadow-sm flex items-start justify-between gap-3 transition-all">
            <div className="flex items-start space-x-3.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 dark:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                    ⏱️ Analyse IA terminée en <span className="font-mono text-emerald-600 dark:text-emerald-400 font-extrabold text-base">{(importState?.aiAnalysisStats || aiAnalysisStats)?.executionTimeSeconds} secondes</span> !
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-semibold font-mono">
                    {(importState?.aiAnalysisStats || aiAnalysisStats)?.totalCount} opérations
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium">
                    Gemini 2.5 Flash Ultra
                  </span>
                </div>
                <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-1 leading-relaxed">
                  Colonnes inutiles éliminées (Date, Libellé brut et Montant conservés). Vrais noms nettoyés, 4 catégories comptables standardisées et abonnements isolés.
                </p>
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <button 
                    onClick={() => handleOpenDeepAudit()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:opacity-95 text-white text-xs font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition cursor-pointer"
                  >
                    <Sparkles size={14} className="text-amber-300" />
                    <span>Consulter le Rapport d'Audit Approfondi IA</span>
                  </button>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setAiAnalysisStats(null)}
              className="text-emerald-700/60 dark:text-emerald-400/60 hover:text-emerald-900 dark:hover:text-emerald-200 p-1.5 rounded-lg hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30 transition flex-shrink-0"
              title="Masquer"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* 2. Bloc 1 : Les KPI (Cartes cliquables) */}
        <div className="flex space-x-3 overflow-x-auto pb-2 snap-x hide-scrollbar">
           {/* Revenus */}
           <div 
             onClick={() => setSelectedFilter(selectedFilter === 'INCOME' ? 'ALL' : 'INCOME')}
             className={`snap-start min-w-[120px] flex-1 p-3 rounded-3xl border transition-all cursor-pointer ${selectedFilter === 'INCOME' ? 'border-green-500 bg-green-50 dark:bg-green-900/20 shadow-md scale-[1.02]' : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800'}`}
           >
             <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1 flex items-center"><ArrowDownLeft size={12} className="mr-1 text-green-500"/> Revenus</div>
             <div className="font-bold text-lg text-green-600 dark:text-green-400">{formatBankAmount(metrics.income, currency)}</div>
           </div>
           
           {/* Dépenses */}
           <div 
             onClick={() => setSelectedFilter(selectedFilter === 'EXPENSE' ? 'ALL' : 'EXPENSE')}
             className={`snap-start min-w-[120px] flex-1 p-3 rounded-3xl border transition-all cursor-pointer ${selectedFilter === 'EXPENSE' ? 'border-red-500 bg-red-50 dark:bg-red-900/20 shadow-md scale-[1.02]' : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800'}`}
           >
             <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1 flex items-center"><ArrowUpRight size={12} className="mr-1 text-red-500"/> Dépenses</div>
             <div className="font-bold text-lg text-red-600 dark:text-red-400">{formatBankAmount(metrics.realExpenses, currency)}</div>
           </div>

           {/* Solde Vérifié (PDF) OU Flux Net (CSV) - Respect strict de la réalité du relevé */}
           <div 
             onClick={() => setSelectedFilter('ALL')}
             className={`snap-start min-w-[120px] flex-1 p-3 rounded-3xl border transition-all cursor-pointer ${selectedFilter === 'ALL' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md scale-[1.02]' : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800'}`}
             title={statementStatus.explanation}
           >
             {statementStatus.hasVerifiedBalance ? (
               <>
                 <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1 flex items-center">
                   <ShieldCheck size={12} className="mr-1 text-emerald-500"/> {statementStatus.kpiTitle}
                 </div>
                 <div className="font-bold text-lg text-emerald-600 dark:text-emerald-400">
                   {statementStatus.formattedAmount}
                 </div>
                 <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-medium truncate mt-0.5">
                   {statementStatus.kpiSubtitle}
                 </div>
               </>
             ) : (
               <>
                 <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1 flex items-center">
                   <Activity size={12} className="mr-1 text-blue-500"/> {statementStatus.kpiTitle}
                 </div>
                 <div className={`font-bold text-lg ${statementStatus.isPositive ? 'text-emerald-600 dark:text-emerald-400' : statementStatus.isNegative ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}`}>
                   {statementStatus.formattedAmount}
                 </div>
                 <div className="flex items-center gap-1 mt-0.5">
                   <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium truncate">{statementStatus.kpiSubtitle}</span>
                   {statementStatus.kpiBadge && (
                     <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold shrink-0">
                       {statementStatus.kpiBadge}
                     </span>
                   )}
                 </div>
               </>
             )}
           </div>
        </div>

        {/* Actions Rapides Épurées */}
        <div className="flex space-x-2.5 overflow-x-auto pb-4 hide-scrollbar">
          <button 
            onClick={() => fileInputRef.current?.click()} 
            className="flex items-center space-x-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 px-4 py-2.5 rounded-[1.2rem] shadow-sm active:scale-95 transition-transform flex-shrink-0 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 cursor-pointer"
          >
             <Upload size={16} className="text-blue-500" />
             <span className="text-xs font-semibold">Importer RB</span>
          </button>

          <button 
            onClick={() => setIsToolsSheetOpen(true)} 
            className="flex items-center space-x-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 px-4 py-2.5 rounded-[1.2rem] shadow-sm active:scale-95 transition-transform flex-shrink-0 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 cursor-pointer group"
          >
             <Layers size={16} className="text-orange-500 group-hover:rotate-12 transition-transform" />
             <span className="text-xs font-bold">Outils & Analyses</span>
             <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 font-extrabold border border-orange-500/20">8</span>
          </button>
        </div>

          {/* 3. Bloc 2 : Les Graphiques (Sélecteur de vue) */}
          <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-5 shadow-sm border border-gray-100 dark:border-gray-800">
           <MobileCharts 
             metrics={metrics} 
             categoryStats={categoryStats} 
             onCategoryClick={(cat) => {
               setSearchTerm(cat);
               setTimeout(() => {
                 document.getElementById('tx-list')?.scrollIntoView({ behavior: 'smooth' });
               }, 50);
             }}
           />
        </div>

        {/* 4. Bloc 3 : Historique des Transactions */}
        <div id="tx-list" className="space-y-4 pb-12">
           {/* Filtres Rapides */}
           <div className="flex space-x-2 overflow-x-auto pb-1 hide-scrollbar">
             <button onClick={() => setSelectedFilter(selectedFilter === 'FIXED' ? 'ALL' : 'FIXED')} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${selectedFilter === 'FIXED' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-white text-gray-600 dark:bg-gray-800 dark:text-gray-300 border border-gray-100 dark:border-gray-700'}`}>Fixes</button>
             <button onClick={() => setSelectedFilter(selectedFilter === 'VARIABLE' ? 'ALL' : 'VARIABLE')} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${selectedFilter === 'VARIABLE' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-white text-gray-600 dark:bg-gray-800 dark:text-gray-300 border border-gray-100 dark:border-gray-700'}`}>Variables</button>
             
             {/* Simple select dropdown for Category */}
             <div className="relative">
               <select 
                 className="appearance-none px-4 py-2 pr-8 rounded-full text-sm font-medium whitespace-nowrap bg-white text-gray-600 dark:bg-gray-800 dark:text-gray-300 border border-gray-100 dark:border-gray-700 outline-none cursor-pointer"
                 onChange={(e) => {
                   setSearchTerm(e.target.value === 'all' ? '' : e.target.value);
                 }}
                 value={CATEGORIES.includes(searchTerm) ? searchTerm : (searchTerm === '' ? 'all' : 'custom')}
               >
                 <option value="all">Catégories</option>
                 {CATEGORIES.map(cat => (
                   <option key={cat} value={cat}>{cat}</option>
                 ))}
               </select>
               <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
             </div>

             {(searchTerm || selectedFilter !== 'ALL') && (
               <button onClick={() => {setSearchTerm(''); setSelectedFilter('ALL');}} className="px-4 py-2 rounded-full text-sm font-medium bg-rose-50 text-rose-600 dark:bg-rose-900/20 whitespace-nowrap">Effacer</button>
             )}
           </div>

           {/* Liste Verticale Epurée */}
           <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-800 divide-y divide-gray-50 dark:divide-gray-800/50">
             {filteredTransactions.length === 0 ? (
               <div className="p-10 text-center text-gray-400 font-medium">Aucune transaction trouvée</div>
             ) : (
               filteredTransactions.slice(0, 100).map(tx => (
                 <div key={tx.id} onClick={() => handleOpenEditModal(tx)} className="p-4 flex items-center justify-between hover:bg-gray-100/80 dark:hover:bg-gray-700/50 active:scale-[0.98] transition-all cursor-pointer">
                   <div className="flex items-center space-x-4 overflow-hidden">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                        tx.flowType === 'INCOME' || tx.type === 'credit' 
                          ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 border border-green-500/20' 
                          : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 border border-red-500/20'
                      }`}>
                        {tx.flowType === 'INCOME' || tx.type === 'credit' 
                          ? <ArrowDownLeft size={18} /> 
                          : <ArrowUpRight size={18} />}
                      </div>
                     <div className="truncate">
                       <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                         <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{formatDateFR(tx.date)}</span>
                         
                         {/* Badge de catégorie interactif (Tailwind) avec menu déroulant */}
                         <div className="relative inline-block" onClick={e => e.stopPropagation()}>
                           <button
                             type="button"
                             onClick={(e) => {
                               e.stopPropagation();
                               setOpenCategoryDropdownTxId(openCategoryDropdownTxId === tx.id ? null : tx.id);
                             }}
                             className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 dark:bg-gray-700/80 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-400 hover:bg-blue-50/70 dark:hover:bg-blue-900/30 transition-all cursor-pointer group/badge"
                             title="Cliquer pour changer de catégorie et mémoriser la règle"
                           >
                             <Tag size={10} className="text-gray-400 group-hover/badge:text-blue-500" />
                             <span className="truncate max-w-[120px] sm:max-w-[180px] font-medium">{tx.category || 'Autre'}</span>
                             <ChevronDown size={10} className="text-gray-400 group-hover/badge:text-blue-500 transition-transform" />
                           </button>

                           {openCategoryDropdownTxId === tx.id && (
                             <div 
                               className="absolute left-0 top-full mt-1.5 w-64 max-h-60 overflow-y-auto bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 py-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-150"
                               onClick={e => e.stopPropagation()}
                             >
                               <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-gray-400 border-b border-gray-100 dark:border-gray-700/50 mb-1 flex items-center justify-between">
                                 <span>Modifier la catégorie</span>
                                 <span className="text-[9px] text-blue-500 font-semibold">Règle mémorisée</span>
                               </div>
                               {CATEGORIES.map(cat => (
                                 <button
                                   key={cat}
                                   type="button"
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     handleQuickCategoryRemap(tx, cat);
                                   }}
                                   className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors ${
                                     tx.category === cat ? 'font-bold text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/15' : 'text-gray-700 dark:text-gray-200'
                                   }`}
                                 >
                                   <span className="truncate">{cat}</span>
                                   {tx.category === cat && <Check size={12} className="text-blue-500 shrink-0 ml-1" />}
                                 </button>
                               ))}
                             </div>
                           )}
                         </div>
                          {/* Badge Abonnement détecté avec tag Payé */}
                          {Boolean(tx.isSubscription) && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              <span>🔁 Abonnement</span>
                              <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-[9px]">Payé</span>
                            </span>
                          )}

                          {/* Badge Échanges Proches / Famille */}
                          {Boolean(tx.isFamilyTransfer || isPeerTransferTransaction(tx)) && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-pink-50 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300 border border-pink-200 dark:border-pink-800">
                              👥 Proches
                            </span>
                          )}
                       </div>
                       <div className="font-semibold text-gray-900 dark:text-gray-100 truncate text-sm">{tx.description}</div>
                        {/* Affichage du libellé brut bancaire si différent du marchand nettoyé */}
                        {tx.rawLabel && tx.rawLabel.trim().toLowerCase() !== tx.description.trim().toLowerCase() && (
                          <div className="text-[11px] text-gray-400 dark:text-gray-500 truncate font-mono mt-0.5" title={tx.rawLabel}>
                            {tx.rawLabel}
                          </div>
                        )}
                     </div>
                   </div>
                   <div className={`font-bold flex-shrink-0 ml-3 text-[15px] ${tx.flowType === 'INCOME' || tx.type === 'credit' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                     {tx.flowType === 'INCOME' || tx.type === 'credit' ? '+' : '-'}{formatBankAmount(Math.abs(tx.amount), currency, {showSign: false})}
                   </div>
                 </div>
               ))
             )}
             {filteredTransactions.length > 100 && (
               <div className="p-4 text-center text-xs font-semibold text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-b-[2rem]">Affichage limité aux 100 dernières opérations</div>
             )}
           </div>
        </div>
        </>
      )}
      </div>

      {/* Tools Modal / Responsive Hub avec Google Stitch Design DNA */}
      {isToolsSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 animate-in fade-in duration-200">
           {/* Backdrop avec flou haut de gamme */}
           <div 
             className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity" 
             onClick={() => setIsToolsSheetOpen(false)}
           />

           {/* Boîte Modale / Hub Bento Réactif */}
           <div className="bg-white dark:bg-gray-900 w-full sm:max-w-4xl lg:max-w-5xl rounded-t-[2.2rem] sm:rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-gray-800/80 relative animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden text-gray-900 dark:text-gray-100 z-10">
             
             {/* Poignée mobile */}
             <div className="pt-3 pb-1 flex justify-center sm:hidden shrink-0">
               <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full" />
             </div>

             {/* En-tête de Hub Premium */}
             <div className="sticky top-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md z-20 px-5 sm:px-7 py-4 sm:py-5 border-b border-gray-100 dark:border-gray-800/80 flex justify-between items-center shrink-0">
               <div className="flex items-center gap-3.5">
                 <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-4 ring-indigo-500/10 shrink-0">
                   <Sparkles size={20} className="text-amber-300" />
                 </div>
                 <div>
                   <div className="flex items-center gap-2 flex-wrap">
                     <h3 className="font-extrabold text-lg sm:text-xl text-gray-900 dark:text-white tracking-tight">
                       Centre d'Analyses & Outils
                     </h3>
                     <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                       8 Modules Experts
                     </span>
                   </div>
                   <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                     Audits IA, projections prédictives, suivi des charges et contrôle de vos comptes
                   </p>
                 </div>
               </div>

               <button 
                 onClick={() => setIsToolsSheetOpen(false)} 
                 className="p-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-2xl active:scale-90 transition-all cursor-pointer shadow-sm"
                 title="Fermer"
               >
                 <X size={18}/>
               </button>
             </div>

             {/* Contenu Défilant Bento Grid */}
             <div className="p-4 sm:p-6 overflow-y-auto space-y-6 overscroll-contain">
                
                {/* 1. SECTION IA & AUDITS STRATÉGIQUES (HERO BENTO) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2 text-[11px] font-extrabold tracking-wider text-indigo-600 dark:text-indigo-400 uppercase">
                      <Sparkles size={14} className="text-amber-400" />
                      <span>Audits Stratégiques & Intelligence Artificielle</span>
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest hidden sm:inline">Piliers d'analyse</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Outil Frise Chronologique & Rapprochement */}
                    <button 
                      onClick={() => {
                        setIsToolsSheetOpen(false); 
                        setActiveViewMode('timeline');
                      }} 
                      className="relative p-5 rounded-[1.8rem] bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent dark:from-emerald-950/40 dark:via-teal-950/20 dark:to-transparent border-2 border-emerald-500/30 dark:border-emerald-500/40 hover:border-emerald-500 shadow-sm hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-300 group cursor-pointer text-left flex flex-col justify-between active:scale-[0.98]"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-extrabold font-mono border border-emerald-500/25 uppercase tracking-wider">
                            Moteur NoSQL
                          </span>
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 size={12} />
                            Source vérifiée
                          </span>
                        </div>

                        <div className="flex items-start gap-3.5">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/25 group-hover:scale-105 transition-transform shrink-0">
                            <Clock size={22} />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-base text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                              Frise Chronologique & Rapprochement
                            </h4>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                              Rapprochement continu PDF vs CSV, validation des soldes officiels et détection automatique des ruptures temporelles ou écarts.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-emerald-500/20 flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        <span>Explorer la timeline continue</span>
                        <ChevronDown className="rotate-[-90deg] group-hover:translate-x-1 transition-transform" size={16}/>
                      </div>
                    </button>

                    {/* 1. Rapport d'Audit Approfondi IA */}
                    <button 
                      onClick={() => {
                        setIsToolsSheetOpen(false); 
                        handleOpenDeepAudit();
                      }} 
                      className="relative p-5 rounded-[1.8rem] bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-pink-500/5 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-transparent border-2 border-indigo-500/35 dark:border-indigo-500/45 hover:border-indigo-500 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 group cursor-pointer text-left flex flex-col justify-between active:scale-[0.98]"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="text-[10px] px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-extrabold font-mono border border-indigo-500/25 uppercase tracking-wider">
                            Gemini 2.5 Flash
                          </span>
                          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                            <Zap size={12} className="text-amber-400" />
                            Diagnostic 360°
                          </span>
                        </div>

                        <div className="flex items-start gap-3.5">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/25 group-hover:scale-105 transition-transform shrink-0">
                            {isGeneratingDeepAudit ? <Loader2 size={22} className="animate-spin" /> : <Sparkles size={22} className="text-amber-300" />}
                          </div>
                          <div>
                            <h4 className="font-extrabold text-base text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              Rapport d'Audit Approfondi IA
                            </h4>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                              {isGeneratingDeepAudit ? "Génération en cours par l'intelligence artificielle..." : "Synthèse financière en 6 volets : analyse du biais bancaire, flux nets réels, 7 alertes prédictives & stratégie de trésorerie."}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-indigo-500/20 flex items-center justify-between text-xs font-bold text-indigo-700 dark:text-indigo-300">
                        <span>{isGeneratingDeepAudit ? "Génération..." : "Consulter le rapport d'audit"}</span>
                        <ChevronDown className="rotate-[-90deg] group-hover:translate-x-1 transition-transform" size={16}/>
                      </div>
                    </button>
                  </div>
                </div>

                {/* 2. SECTION CHARGES & MAÎTRISE BUDGÉTAIRE */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[11px] font-extrabold tracking-wider text-amber-600 dark:text-amber-400 uppercase px-1">
                    <Layers size={14} />
                    <span>Maîtrise des Charges & Optimisation Budgétaire</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {/* Abonnements & Prélèvements */}
                    <button 
                      onClick={() => {
                        setIsToolsSheetOpen(false); 
                        handleOpenSubscriptionsAudit();
                      }} 
                      className="p-4 sm:p-4.5 rounded-[1.6rem] bg-white dark:bg-gray-800/90 border border-blue-500/20 hover:border-blue-500/50 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 shadow-sm hover:shadow-md transition-all group cursor-pointer text-left flex items-start justify-between gap-3 active:scale-[0.98]"
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <Calendar size={20}/>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate">
                              Abonnements & Prélèvements
                            </h4>
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-extrabold uppercase">
                              Anti-Hausse
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                            Détection d'augmentations de tarif, suivi chronologique et assistant de résiliation.
                          </p>
                        </div>
                      </div>
                      <ChevronDown className="rotate-[-90deg] text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all shrink-0 mt-2" size={18}/>
                    </button>

                    {/* Coût de la vie */}
                    <button 
                      onClick={() => {
                        setIsToolsSheetOpen(false); 
                        handleOpenEssentialAudit();
                      }} 
                      className="p-4 sm:p-4.5 rounded-[1.6rem] bg-white dark:bg-gray-800/90 border border-amber-500/20 hover:border-amber-500/50 hover:bg-amber-50/30 dark:hover:bg-amber-950/20 shadow-sm hover:shadow-md transition-all group cursor-pointer text-left flex items-start justify-between gap-3 active:scale-[0.98]"
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <Layers size={20}/>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate">
                              Coût de la vie
                            </h4>
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-extrabold uppercase">
                              Médianes Réelles
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                            Simulateur mensuel des charges incompressibles basé sur vos médianes réelles.
                          </p>
                        </div>
                      </div>
                      <ChevronDown className="rotate-[-90deg] text-gray-400 group-hover:text-amber-500 group-hover:translate-x-1 transition-all shrink-0 mt-2" size={18}/>
                    </button>

                    {/* Fixation de Budget */}
                    <button 
                      onClick={() => {
                        setIsToolsSheetOpen(false); 
                        setIsBudgetTrackingDrawerOpen(true);
                      }} 
                      className="p-4 sm:p-4.5 rounded-[1.6rem] bg-white dark:bg-gray-800/90 border border-teal-500/20 hover:border-teal-500/50 hover:bg-teal-50/30 dark:hover:bg-teal-950/20 shadow-sm hover:shadow-md transition-all group cursor-pointer text-left flex items-start justify-between gap-3 active:scale-[0.98]"
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <PiggyBank size={20}/>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate">
                              Fixation de Budget
                            </h4>
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 font-extrabold uppercase">
                              Épargne Cible
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                            Définition de plafonds de dépenses par catégorie pour maximiser votre épargne.
                          </p>
                        </div>
                      </div>
                      <ChevronDown className="rotate-[-90deg] text-gray-400 group-hover:text-teal-500 group-hover:translate-x-1 transition-all shrink-0 mt-2" size={18}/>
                    </button>

                    {/* Habitudes de Dépenses */}
                    <button 
                      onClick={() => {
                        setIsToolsSheetOpen(false); 
                        setIsSpendingHabitsDrawerOpen(true);
                      }} 
                      className="p-4 sm:p-4.5 rounded-[1.6rem] bg-white dark:bg-gray-800/90 border border-purple-500/20 hover:border-purple-500/50 hover:bg-purple-50/30 dark:hover:bg-purple-950/20 shadow-sm hover:shadow-md transition-all group cursor-pointer text-left flex items-start justify-between gap-3 active:scale-[0.98]"
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <Clock size={20}/>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate">
                              Habitudes de Dépenses
                            </h4>
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-extrabold uppercase">
                              Temporalité
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                            Analyse chronologique des jours et périodes d'achats les plus intenses.
                          </p>
                        </div>
                      </div>
                      <ChevronDown className="rotate-[-90deg] text-gray-400 group-hover:text-purple-500 group-hover:translate-x-1 transition-all shrink-0 mt-2" size={18}/>
                    </button>
                  </div>
                </div>

                {/* 3. SECTION FLUX & SOLIDARITÉ */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[11px] font-extrabold tracking-wider text-rose-600 dark:text-rose-400 uppercase px-1">
                    <Users size={14} />
                    <span>Flux Internes & Rapprochements Tiers</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {/* Mouvements Inter-comptes */}
                    <button 
                      onClick={() => {
                        setIsToolsSheetOpen(false); 
                        handleOpenInterAccountsAudit();
                      }} 
                      className="p-4 sm:p-4.5 rounded-[1.6rem] bg-white dark:bg-gray-800/90 border border-indigo-500/20 hover:border-indigo-500/50 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 shadow-sm hover:shadow-md transition-all group cursor-pointer text-left flex items-start justify-between gap-3 active:scale-[0.98]"
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <ArrowLeftRight size={20}/>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate">
                              Mouvements Inter-comptes
                            </h4>
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-extrabold uppercase">
                              Neutre au Bilan
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                            Rapprochement et compensation des transferts entre vos différents comptes.
                          </p>
                        </div>
                      </div>
                      <ChevronDown className="rotate-[-90deg] text-gray-400 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all shrink-0 mt-2" size={18}/>
                    </button>

                    {/* Échanges Famille & Amis */}
                    <button 
                      onClick={() => {
                        setIsToolsSheetOpen(false); 
                        handleOpenPeerTransfersAudit();
                      }} 
                      className="p-4 sm:p-4.5 rounded-[1.6rem] bg-white dark:bg-gray-800/90 border border-pink-500/20 hover:border-pink-500/50 hover:bg-pink-50/30 dark:hover:bg-pink-950/20 shadow-sm hover:shadow-md transition-all group cursor-pointer text-left flex items-start justify-between gap-3 active:scale-[0.98]"
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <Users size={20}/>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate">
                              Échanges Famille & Amis
                            </h4>
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-600 dark:text-pink-400 font-extrabold uppercase">
                              Balance Tiers
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                            Position débitrice/créditrice et solde des remboursements avec vos proches.
                          </p>
                        </div>
                      </div>
                      <ChevronDown className="rotate-[-90deg] text-gray-400 group-hover:text-pink-500 group-hover:translate-x-1 transition-all shrink-0 mt-2" size={18}/>
                    </button>
                  </div>
                </div>

                {/* 4. PARAMÈTRES AVANCÉS & ACTION DESTRUCTIVE (ZONE SÉCURISÉE) */}
                <div className="pt-2">
                  <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                        <AlertTriangle size={17} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900 dark:text-white">Zone de Réinitialisation</div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">Supprimer définitivement ce relevé et toutes ses opérations du périmètre actif</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setIsToolsSheetOpen(false); 
                        handlePurgeScope();
                      }} 
                      className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95 shrink-0"
                    >
                      <Trash2 size={14}/>
                      <span>Supprimer ce relevé</span>
                    </button>
                  </div>
                </div>

             </div>
           </div>
        </div>
      )}

      {/* Legacy & New Drawer Modals with Retour */}
      {isAuditDrawerOpen && (
        <CategoryAuditDrawer 
          isOpen={isAuditDrawerOpen} 
          onClose={() => setIsAuditDrawerOpen(false)} 
          onBack={handleBackToTools}
          categoryData={selectedCategoryData} 
          auditType={auditType} 
          customTransactions={auditCustomTransactions} 
          customTitle={auditCustomTitle} 
          customSubtitle={auditCustomSubtitle} 
          customTotalAmount={auditCustomTotal} 
          allTransactions={bankTransactions}
        />
      )}
      {isCostOfLivingDrawerOpen && (
        <CostOfLivingBuilderDrawer 
          isOpen={isCostOfLivingDrawerOpen} 
          onClose={() => setIsCostOfLivingDrawerOpen(false)} 
          onBack={handleBackToTools}
          bankTransactions={bankTransactions} 
        />
      )}
      {isSpendingHabitsDrawerOpen && (
        <SpendingHabitsDrawer 
          isOpen={isSpendingHabitsDrawerOpen} 
          onClose={() => setIsSpendingHabitsDrawerOpen(false)} 
          onBack={handleBackToTools}
          bankTransactions={monthScopedTransactions} 
        />
      )}
      {isBudgetTrackingDrawerOpen && (
        <BudgetTrackingDrawer 
          isOpen={isBudgetTrackingDrawerOpen} 
          onClose={() => setIsBudgetTrackingDrawerOpen(false)} 
          onBack={handleBackToTools}
          monthTransactions={monthScopedTransactions} 
          allTransactions={bankTransactions} 
        />
      )}
      
      {/* Deep Financial Audit Drawer (DeepSeek caliber) */}
      <BankAuditReportDrawer
        isOpen={isDeepAuditDrawerOpen}
        onClose={() => setIsDeepAuditDrawerOpen(false)}
        onBack={handleBackToTools}
        report={deepAuditReport}
        currency={currency}
      />
      
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-full shadow-2xl font-medium text-sm z-50 flex items-center space-x-3 animate-in fade-in slide-in-from-top-4 ${notification.type === 'success' ? 'bg-green-600 text-white' : notification.type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'}`}>
          {notification.type === 'success' ? <Check size={18}/> : notification.type === 'error' ? <AlertTriangle size={18}/> : <Info size={18}/>}
          <span>{notification.message}</span>
        </div>
      )}
      
      {/* Edit Tx Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-end justify-center backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-t-[2rem] w-full max-w-md animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-6">
               <h3 className="font-bold text-xl">Modifier l'opération</h3>
               <button onClick={() => setIsEditModalOpen(false)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full"><X size={18}/></button>
            </div>
            <form onSubmit={handleSaveEditModal} className="space-y-5">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Libellé</label>
                <input type="text" value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none outline-none font-medium text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Catégorie</label>
                <div className="relative">
                  <select value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})} className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none outline-none font-medium text-gray-900 dark:text-white appearance-none pr-10">
                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                </div>
              </div>
              <div className="pt-2">
                <button type="submit" className="w-full p-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-600/30 active:scale-95 transition-transform">Enregistrer les modifs</button>
                <button type="button" onClick={() => editingTx && handleDelete(editingTx.id)} className="w-full p-4 font-bold mt-3 text-rose-600 bg-rose-50 dark:bg-rose-900/20 rounded-2xl active:scale-95 transition-transform">Supprimer l'opération</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Configuration & Montée en Gamme IA (100% Gratuit) */}
      {isGeminiKeyModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[110] flex items-end sm:items-center justify-center backdrop-blur-sm animate-in fade-in p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-t-[2.2rem] sm:rounded-[2rem] w-full max-w-lg shadow-2xl border border-gray-100 dark:border-gray-800 animate-in slide-in-from-bottom duration-300 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                  <Sparkles size={20} className="text-amber-300" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-gray-900 dark:text-white">Configuration IA & Montée en Gamme</h3>
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <span>✓ 100% Gratuit (Free Tier Google AI Studio)</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsGeminiKeyModalOpen(false);
                  setAiConnectionTestResult(null);
                }} 
                className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full active:scale-90 transition-transform"
              >
                <X size={18}/>
              </button>
            </div>

            <div className="space-y-5">
              {/* Sélecteur de Modèle IA (Montée en gamme) */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5 block flex items-center justify-between">
                  <span>Modèle IA Google (Free Tier)</span>
                  <span className="text-[10px] text-indigo-500 font-semibold lowercase">sélection instantanée</span>
                </label>
                <div className="space-y-2.5">
                  {AVAILABLE_FREE_GEMINI_MODELS.map(m => {
                    const isSelected = selectedAiModel === m.id;
                    return (
                      <div
                        key={m.id}
                        onClick={() => {
                          setSelectedAiModel(m.id);
                          setGeminiModelName(m.id);
                          setAiConnectionTestResult(null);
                        }}
                        className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 shadow-sm'
                            : 'border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-gray-50/50 dark:bg-gray-800/40'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-sm text-gray-900 dark:text-white">{m.name}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                              {m.badge}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                            {m.quota}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                          {m.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Champ Clé API Google */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Clé API Google Gemini</label>
                  <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                  >
                    Obtenir une clé gratuite →
                  </a>
                </div>
                <input 
                  type="password" 
                  value={geminiApiKeyInput} 
                  onChange={e => setGeminiApiKeyInput(e.target.value)} 
                  placeholder="AIzaSy... ou AQ.Ab8..." 
                  className="w-full p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 outline-none font-mono text-sm text-gray-900 dark:text-white focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Bouton Test de Connexion Directe */}
              <div>
                <button
                  type="button"
                  disabled={isTestingAiConnection}
                  onClick={async () => {
                    setIsTestingAiConnection(true);
                    setAiConnectionTestResult(null);
                    if (geminiApiKeyInput.trim()) {
                      localStorage.setItem('cashpilot_gemini_api_key', geminiApiKeyInput.trim());
                    }
                    const res = await testGeminiModelConnection(selectedAiModel);
                    setAiConnectionTestResult(res);
                    setIsTestingAiConnection(false);
                  }}
                  className="w-full py-3 px-4 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center space-x-2 active:scale-95 transition-transform cursor-pointer"
                >
                  {isTestingAiConnection ? (
                    <>
                      <Loader2 size={16} className="animate-spin text-indigo-600" />
                      <span>Test en cours avec {selectedAiModel}...</span>
                    </>
                  ) : (
                    <>
                      <Zap size={16} className="text-amber-500" />
                      <span>Tester la connexion en direct ({selectedAiModel})</span>
                    </>
                  )}
                </button>

                {aiConnectionTestResult && (
                  <div className={`mt-2.5 p-3 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-in fade-in ${
                    aiConnectionTestResult.success 
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                      : 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  }`}>
                    {aiConnectionTestResult.success ? <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" /> : <AlertTriangle size={16} className="text-rose-600 flex-shrink-0" />}
                    <span>{aiConnectionTestResult.message}</span>
                  </div>
                )}
              </div>

              {/* Enregistrer et Fermer */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (geminiApiKeyInput.trim()) {
                      localStorage.setItem('cashpilot_gemini_api_key', geminiApiKeyInput.trim());
                    }
                    setGeminiModelName(selectedAiModel);
                    setIsGeminiKeyModalOpen(false);
                    setNotification({
                      type: 'success',
                      message: `Configuration IA enregistrée : Modèle ${selectedAiModel} activé (100% Gratuit) !`
                    });
                  }}
                  className="w-full p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-600/30 active:scale-95 transition-transform"
                >
                  Enregistrer & Utiliser {selectedAiModel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default BankStatements;
