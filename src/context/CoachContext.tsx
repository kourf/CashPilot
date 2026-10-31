import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { db, ensureAuthenticatedUser } from '../lib/firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, writeBatch } from 'firebase/firestore';
import { getActiveAccountId } from '../lib/userUtils';
import { useAuth } from './AuthContext';
import { useTransactions } from './TransactionsContext';
import { useReceipts } from './ReceiptsContext';
import {
  buildFinancialProfile,
  askFinancialCoach,
  parseCoachResponseWithActions,
  getActiveCostOfLivingBudgets,
  type ChatMessage,
  type FinancialProfile,
  type ProposedAdminAction,
  type ArchivedItemRecord
} from '../lib/coachFinancialEngine';
import {
  setInMemoryCustomRules,
  enrichTransactionFallback,
  type CustomUserRule,
  type CostOfLivingExpenseItem
} from '../lib/kpiUtils';

export interface SavedConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  scope: string;
}

export interface CoachContextType {
  conversations: SavedConversation[];
  activeConversationId: string;
  currentConversation: SavedConversation;
  messages: ChatMessage[];
  selectedScope: string;
  scopedTransactions: any[];
  financialProfile: FinancialProfile;
  isLoading: boolean;
  loadingStep: string;
  loadingSeconds: number;
  inputPrompt: string;
  setInputPrompt: React.Dispatch<React.SetStateAction<string>>;
  setActiveConversationId: (id: string) => void;
  handleScopeChange: (newScope: string) => void;
  handleCreateNewConversation: () => void;
  handleDeleteConversation: (e: React.MouseEvent | null, convId: string) => void;
  handleDeleteMessage: (messageId: string) => void;
  sendMessage: (textToSend?: string) => Promise<void>;

  // Actions Administrateur Sécurisées (Chantier 3)
  confirmProposedAction: (messageId: string) => Promise<void>;
  rejectProposedAction: (messageId: string) => void;
  undoProposedAction: (messageId: string) => Promise<void>;

  // Module "Mes Règles & Abonnements"
  customRules: CustomUserRule[];
  addCustomRule: (rule: Omit<CustomUserRule, 'id' | 'createdAt'>) => Promise<CustomUserRule>;
  updateCustomRule: (id: string, updates: Partial<CustomUserRule>) => Promise<void>;
  deleteCustomRule: (id: string) => Promise<void>;

  // Corbeille Soft Delete & Restauration
  archivedItems: ArchivedItemRecord[];
  restoreArchivedItem: (archiveId: string) => Promise<void>;
  permanentlyDeleteArchivedItem: (archiveId: string) => Promise<void>;

  // Budgets synchronisés ("Budget & Coût de la vie")
  costOfLivingBudgets: CostOfLivingExpenseItem[];
  updateCostOfLivingBudgets: (items: CostOfLivingExpenseItem[]) => Promise<void>;
}

const STORAGE_CONVERSATIONS = 'cashpilot_coach_conversations_v3';
const STORAGE_ACTIVE_ID = 'cashpilot_coach_active_id_v3';
const LEGACY_STORAGE_CHAT = 'cashpilot_coach_chat_v2';
const STORAGE_CUSTOM_RULES = 'cashpilot_custom_rules_v1';
const STORAGE_ARCHIVED_ITEMS = 'cashpilot_archived_items_v1';
const STORAGE_BUDGETS = 'cashpilot_cost_of_living_v2';

const CoachContext = createContext<CoachContextType | undefined>(undefined);

export const CoachProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const activeUid = user ? getActiveAccountId() : null;
  const {
    transactions = [],
    setTransactions,
    currency = 'EUR',
    setAppNotification
  } = useTransactions();
  const { receipts = [], products = [] } = useReceipts();

  // Initialisation de l'authentification isolée
  useEffect(() => {
    ensureAuthenticatedUser().catch(() => {});
  }, []);

  // 1. Conversations du Coach IA persistées
  const [conversations, setConversations] = useState<SavedConversation[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CONVERSATIONS);
      if (saved) {
        const parsed: SavedConversation[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(c => ({
            ...c,
            messages: (c.messages || []).map((m: any) => ({
              ...m,
              timestamp: new Date(m.timestamp || Date.now())
            }))
          }));
        }
      }

      const legacy = localStorage.getItem(LEGACY_STORAGE_CHAT);
      if (legacy) {
        const parsedLegacy = JSON.parse(legacy);
        if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
          const firstUserMsg = parsedLegacy.find((m: any) => m.role === 'user');
          const title = firstUserMsg ? firstUserMsg.content.slice(0, 40) + '...' : 'Discussion existante';
          return [{
            id: `conv-${Date.now()}`,
            title,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: parsedLegacy.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp || Date.now()) })),
            scope: 'all'
          }];
        }
      }
    } catch (e) {
      console.warn("Erreur chargement conversations coach:", e);
    }

    return [{
      id: `conv-${Date.now()}`,
      title: 'Nouvelle discussion',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      scope: 'all'
    }];
  });

  const [activeConversationId, setActiveConversationIdState] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem(STORAGE_ACTIVE_ID);
      if (savedId) return savedId;
    } catch {}
    return conversations[0]?.id || `conv-${Date.now()}`;
  });

  const setActiveConversationId = useCallback((id: string) => {
    setActiveConversationIdState(id);
    try {
      localStorage.setItem(STORAGE_ACTIVE_ID, id);
    } catch {}
  }, []);

  const currentConversation = useMemo(() => {
    return conversations.find(c => c.id === activeConversationId) || conversations[0] || {
      id: `conv-${Date.now()}`,
      title: 'Nouvelle discussion',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      scope: 'all'
    };
  }, [conversations, activeConversationId]);

  const messages = currentConversation.messages;
  const selectedScope = currentConversation.scope || 'all';

  // Helper de sérialisation d'une conversation pour Firestore
  const formatConversationForFirestore = (c: SavedConversation) => ({
    id: c.id,
    title: c.title || 'Discussion',
    createdAt: c.createdAt || Date.now(),
    updatedAt: c.updatedAt || Date.now(),
    scope: c.scope || 'all',
    messages: (c.messages || []).map(m => {
      let ts = new Date().toISOString();
      if (m.timestamp instanceof Date) {
        ts = m.timestamp.toISOString();
      } else if (typeof m.timestamp === 'string') {
        ts = m.timestamp;
      } else if (typeof m.timestamp === 'number') {
        ts = new Date(m.timestamp).toISOString();
      }
      const cleanMsg: any = {
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: ts,
        status: m.status || 'done'
      };
      if (m.proposedAction) {
        cleanMsg.proposedAction = JSON.parse(JSON.stringify(m.proposedAction));
      }
      return cleanMsg;
    })
  });

  const syncConversationToFirestore = useCallback(async (conv: SavedConversation) => {
    if (!conv || !conv.id) return;
    // Ne jamais polluer la base partagée avec des conversations vides (0 message)
    if (!conv.messages || conv.messages.length === 0) return;

    try {
      const accountId = getActiveAccountId();
      const docRef = doc(db, `users/${accountId}/coach_conversations/${conv.id}`);
      await setDoc(docRef, formatConversationForFirestore(conv), { merge: true });
    } catch (e) {
      console.warn("Erreur sauvegarde Firestore conversation coach:", e);
    }
  }, []);

  const deleteConversationFromFirestore = useCallback(async (convId: string) => {
    if (!convId) return;
    try {
      const accountId = getActiveAccountId();
      await deleteDoc(doc(db, `users/${accountId}/coach_conversations/${convId}`));
    } catch (e) {
      console.warn("Erreur suppression Firestore conversation coach:", e);
    }
  }, []);

  // Écouteur temps réel Firestore pour `coach_conversations` (Synchronisation PC <-> Téléphone)
  useEffect(() => {
    if (!activeUid) return;
    let unsub: (() => void) | undefined;
    try {
      const accountId = activeUid;
      const colRef = collection(db, `users/${accountId}/coach_conversations`);
      unsub = onSnapshot(colRef, (snap) => {
        if (!snap.empty) {
          const remoteConvs: SavedConversation[] = snap.docs.map(docSnap => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              title: data.title || 'Discussion',
              createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.parse(data.createdAt) || Date.now(),
              updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.parse(data.updatedAt) || Date.now(),
              scope: data.scope || 'all',
              messages: Array.isArray(data.messages) ? data.messages.map((m: any) => ({
                ...m,
                timestamp: m.timestamp?.toDate ? m.timestamp.toDate() : new Date(m.timestamp || Date.now())
              })) : []
            };
          }).filter(c => c.messages && c.messages.length > 0)
            .sort((a, b) => b.updatedAt - a.updatedAt);

          if (remoteConvs.length > 0) {
            setConversations(prev => {
              // Si l'utilisateur est sur un brouillon local vierge (0 message), on le préserve au sommet
              const currentLocal = prev.find(p => p.id === activeConversationId);
              if (currentLocal && currentLocal.messages.length === 0 && !remoteConvs.some(r => r.id === currentLocal.id)) {
                return [currentLocal, ...remoteConvs];
              }
              return remoteConvs;
            });

            try {
              localStorage.setItem(STORAGE_CONVERSATIONS, JSON.stringify(remoteConvs));
            } catch {}
          }
        } else {
          // Si Firestore est encore vide mais que ce device a des conversations locales valides, on les synchronise
          try {
            const saved = localStorage.getItem(STORAGE_CONVERSATIONS);
            if (saved) {
              const parsed: SavedConversation[] = JSON.parse(saved);
              const validLocal = Array.isArray(parsed) ? parsed.filter(c => c.messages && c.messages.length > 0) : [];
              if (validLocal.length > 0) {
                validLocal.forEach(conv => {
                  syncConversationToFirestore(conv);
                });
              }
            }
          } catch {}
        }
      }, (err) => {
        console.warn("Écouteur coach_conversations hors-ligne:", err);
      });
    } catch (e) {
      console.warn("Erreur init coach_conversations:", e);
    }

    return () => {
      if (unsub) unsub();
    };
  }, [activeUid, activeConversationId, syncConversationToFirestore]);

  // Sauvegarde automatique dans localStorage + synchronisation Firestore
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CONVERSATIONS, JSON.stringify(conversations));
      localStorage.setItem(STORAGE_ACTIVE_ID, activeConversationId);
    } catch (e) {
      console.warn("Erreur sauvegarde conversations coach:", e);
    }
  }, [conversations, activeConversationId]);

  // 2. Règles Personnalisées & Clarifications d'Abonnements
  const [customRules, setCustomRules] = useState<CustomUserRule[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CUSTOM_RULES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setInMemoryCustomRules(parsed);
          return parsed.filter((r: CustomUserRule) => !r.isArchived);
        }
      }
    } catch {}
    return [];
  });

  // Écouteur temps réel Firestore pour `custom_rules`
  useEffect(() => {
    if (!activeUid) {
      setCustomRules([]);
      return;
    }
    let unsub: (() => void) | undefined;
    try {
      const accountId = activeUid;
      const colRef = collection(db, `users/${accountId}/custom_rules`);
      unsub = onSnapshot(colRef, (snap) => {
        const rules: CustomUserRule[] = snap.docs
          .map(d => ({ id: d.id, ...(d.data() as any) }))
          .filter((r: CustomUserRule) => !r.isArchived);
        setCustomRules(rules);
        setInMemoryCustomRules(rules);
        try {
          localStorage.setItem(STORAGE_CUSTOM_RULES, JSON.stringify(rules));
        } catch {}
        window.dispatchEvent(new CustomEvent('cashpilot_rules_updated'));
      }, (err) => {
        console.warn("Écouteur custom_rules hors-ligne:", err);
      });
    } catch (e) {
      console.warn("Erreur init custom_rules:", e);
    }
    return () => {
      if (unsub) unsub();
    };
  }, [activeUid]);

  // 3. Corbeille / Éléments Archivés (Soft Delete)
  const [archivedItems, setArchivedItems] = useState<ArchivedItemRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_ARCHIVED_ITEMS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter((a: ArchivedItemRecord) => !a.isRestored);
      }
    } catch {}
    return [];
  });

  useEffect(() => {
    if (!activeUid) {
      setArchivedItems([]);
      return;
    }
    let unsub: (() => void) | undefined;
    try {
      const accountId = activeUid;
      const colRef = collection(db, `users/${accountId}/archived_items`);
      unsub = onSnapshot(colRef, (snap) => {
        const items: ArchivedItemRecord[] = snap.docs
          .map(d => ({ id: d.id, ...(d.data() as any) }))
          .filter((a: ArchivedItemRecord) => !a.isRestored)
          .sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || ''));
        setArchivedItems(items);
        try {
          localStorage.setItem(STORAGE_ARCHIVED_ITEMS, JSON.stringify(items));
        } catch {}
      }, (err) => {
        console.warn("Écouteur archived_items hors-ligne:", err);
      });
    } catch (e) {
      console.warn("Erreur init archived_items:", e);
    }
    return () => {
      if (unsub) unsub();
    };
  }, [activeUid]);

  // 4. Budgets "Budget & Coût de la vie" synchronisés en temps réel
  const [costOfLivingBudgets, setCostOfLivingBudgets] = useState<CostOfLivingExpenseItem[]>(() => {
    return getActiveCostOfLivingBudgets();
  });

  useEffect(() => {
    if (!activeUid) return;
    let unsub: (() => void) | undefined;
    try {
      const accountId = activeUid;
      const docRef = doc(db, `users/${accountId}/settings/cost_of_living`);
      unsub = onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data.items) && data.items.length > 0) {
            setCostOfLivingBudgets(data.items);
            try {
              localStorage.setItem(STORAGE_BUDGETS, JSON.stringify(data.items));
              localStorage.setItem('cashpilot_cost_of_living', JSON.stringify(data.items));
            } catch {}
          }
        }
      }, () => {});
    } catch {}

    const handleLocalBudgetUpdate = () => {
      setCostOfLivingBudgets(getActiveCostOfLivingBudgets());
    };
    window.addEventListener('cashpilot_cost_of_living_updated', handleLocalBudgetUpdate);

    return () => {
      if (unsub) unsub();
      window.removeEventListener('cashpilot_cost_of_living_updated', handleLocalBudgetUpdate);
    };
  }, [activeUid]);

  const updateCostOfLivingBudgets = useCallback(async (items: CostOfLivingExpenseItem[]) => {
    setCostOfLivingBudgets(items);
    try {
      localStorage.setItem(STORAGE_BUDGETS, JSON.stringify(items));
      localStorage.setItem('cashpilot_cost_of_living', JSON.stringify(items));
      window.dispatchEvent(new CustomEvent('cashpilot_cost_of_living_updated'));
    } catch {}

    try {
      const accountId = getActiveAccountId();
      await setDoc(doc(db, `users/${accountId}/settings/cost_of_living`), {
        items,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.warn("Erreur sync Firestore cost_of_living:", e);
    }
  }, []);

  // 5. Transactions filtrées et Profil Financier (recalculés automatiquement si customRules changent)
  const scopedTransactions = useMemo(() => {
    const active = transactions.filter(t => !t.isArchived).map(t => enrichTransactionFallback(t));
    if (selectedScope === 'all') return active;
    return active.filter(t => t.monthKey === selectedScope || (t.date && t.date.startsWith(selectedScope)));
  }, [transactions, selectedScope, customRules]);

  const financialProfile: FinancialProfile = useMemo(() => {
    return buildFinancialProfile(scopedTransactions, receipts, products, currency);
  }, [scopedTransactions, receipts, products, currency]);

  // 6. État de chargement global en arrière-plan (Chantier 1)
  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('Analyse des données...');
  const loadingSeconds = 0;

  const handleScopeChange = useCallback((newScope: string) => {
    setConversations(prev => prev.map(c => {
      if (c.id === activeConversationId) {
        return { ...c, scope: newScope, updatedAt: Date.now() };
      }
      return c;
    }));
  }, [activeConversationId]);

  const handleCreateNewConversation = useCallback(() => {
    // Si la conversation active est déjà une page blanche (0 message), on y reste sans créer de doublon
    const current = conversations.find(c => c.id === activeConversationId);
    if (current && (!current.messages || current.messages.length === 0)) {
      return;
    }
    const newConv: SavedConversation = {
      id: `conv-${Date.now()}`,
      title: 'Nouvelle discussion',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      scope: selectedScope
    };
    setConversations(prev => [newConv, ...prev.filter(c => c.messages && c.messages.length > 0)]);
    setActiveConversationId(newConv.id);
  }, [selectedScope, activeConversationId, conversations, setActiveConversationId]);

  const handleDeleteConversation = useCallback((e: React.MouseEvent | null, convId: string) => {
    if (e) e.stopPropagation();
    deleteConversationFromFirestore(convId);
    setConversations(prev => {
      const updated = prev.filter(c => c.id !== convId);
      if (updated.length === 0) {
        const resetConv: SavedConversation = {
          id: `conv-${Date.now()}`,
          title: 'Nouvelle discussion',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: [],
          scope: 'all'
        };
        setActiveConversationId(resetConv.id);
        return [resetConv];
      }
      if (activeConversationId === convId && updated.length > 0) {
        setActiveConversationId(updated[0].id);
      }
      return updated;
    });
  }, [activeConversationId, setActiveConversationId, deleteConversationFromFirestore]);

  const handleDeleteMessage = useCallback((messageId: string) => {
    setConversations(prev => prev.map(c => {
      if (c.id === activeConversationId) {
        const nextMsgs = c.messages.filter(m => m.id !== messageId);
        const updated = {
          ...c,
          messages: nextMsgs,
          updatedAt: Date.now()
        };
        if (nextMsgs.length > 0) {
          syncConversationToFirestore(updated);
        } else {
          deleteConversationFromFirestore(c.id);
        }
        return updated;
      }
      return c;
    }));
  }, [activeConversationId, syncConversationToFirestore, deleteConversationFromFirestore]);

  // 7. Envoi de message persistant en arrière-plan (survit à la navigation inter-onglets)
  const sendMessage = useCallback(async (textToSend?: string) => {
    const prompt = (textToSend !== undefined ? textToSend : inputPrompt).trim();
    if (!prompt || isLoading) return;

    const targetConvId = activeConversationId;
    const currentMsgsSnapshot = [...messages];

    setInputPrompt('');

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: new Date(),
      status: 'done'
    };

    const newTitle = currentMsgsSnapshot.length === 0
      ? prompt.slice(0, 42) + (prompt.length > 42 ? '...' : '')
      : currentConversation.title;

    const updatedWithUser: SavedConversation = {
      ...currentConversation,
      id: targetConvId,
      title: newTitle,
      messages: [...currentConversation.messages, userMessage],
      updatedAt: Date.now()
    };

    setConversations(prev => prev.map(c => c.id === targetConvId ? updatedWithUser : c));
    syncConversationToFirestore(updatedWithUser);

    setIsLoading(true);
    setLoadingStep("Exploration de votre base bancaire et tickets...");

    const stepTimer1 = setTimeout(() => {
      setLoadingStep("Calcul des ratios, médianes et audit des articles...");
    }, 800);

    const stepTimer2 = setTimeout(() => {
      setLoadingStep("Rédaction de la synthèse et du tableau complet...");
    }, 1700);

    try {
      const rawResponseText = await askFinancialCoach(
        prompt,
        currentMsgsSnapshot,
        financialProfile,
        scopedTransactions,
        receipts,
        products,
        currency
      );

      const { cleanText, proposedAction } = parseCoachResponseWithActions(
        rawResponseText,
        prompt,
        scopedTransactions,
        receipts,
        costOfLivingBudgets
      );

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: cleanText,
        timestamp: new Date(),
        status: 'done',
        proposedAction
      };

      const updatedWithAssistant: SavedConversation = {
        ...currentConversation,
        id: targetConvId,
        title: newTitle,
        messages: [...currentConversation.messages, userMessage, assistantMessage],
        updatedAt: Date.now()
      };

      setConversations(prev => prev.map(c => c.id === targetConvId ? updatedWithAssistant : c));
      syncConversationToFirestore(updatedWithAssistant);

      // Si l'utilisateur a navigué sur un autre onglet pendant le chargement, le notifier
      if (typeof window !== 'undefined' && window.location.pathname !== '/coach' && setAppNotification) {
        setAppNotification({
          type: 'success',
          message: '✨ Votre Coach IA a terminé son analyse ! Cliquez sur Coach IA pour voir la réponse.'
        });
      }
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `assistant-err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Une erreur est survenue lors de la communication avec l'IA.**\n\n${err?.message || 'Veuillez vérifier votre connexion ou votre clé API.'}`,
        timestamp: new Date(),
        status: 'error'
      };

      const updatedWithError: SavedConversation = {
        ...currentConversation,
        id: targetConvId,
        title: newTitle,
        messages: [...currentConversation.messages, userMessage, errorMessage],
        updatedAt: Date.now()
      };

      setConversations(prev => prev.map(c => c.id === targetConvId ? updatedWithError : c));
      syncConversationToFirestore(updatedWithError);
    } finally {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setIsLoading(false);
    }
  }, [
    inputPrompt,
    isLoading,
    activeConversationId,
    messages,
    currentConversation,
    financialProfile,
    scopedTransactions,
    receipts,
    products,
    currency,
    costOfLivingBudgets,
    setAppNotification,
    syncConversationToFirestore
  ]);

  // 8. CRUD Règles Personnalisées ("Mes Règles & Abonnements")
  const addCustomRule = useCallback(async (ruleData: Omit<CustomUserRule, 'id' | 'createdAt'>): Promise<CustomUserRule> => {
    const accountId = getActiveAccountId();
    const ruleId = `rule-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const newRule: CustomUserRule = {
      ...ruleData,
      id: ruleId,
      createdAt: nowIso,
      updatedAt: nowIso,
      isArchived: false
    };

    const nextRules = [newRule, ...customRules];
    setCustomRules(nextRules);
    setInMemoryCustomRules(nextRules);
    try {
      localStorage.setItem(STORAGE_CUSTOM_RULES, JSON.stringify(nextRules));
    } catch {}

    // Ré-enrichir immédiatement les transactions en mémoire
    setTransactions(prev => prev.map(t => enrichTransactionFallback(t)));

    try {
      const cleanObj = JSON.parse(JSON.stringify(newRule));
      await setDoc(doc(db, `users/${accountId}/custom_rules/${ruleId}`), cleanObj);
    } catch (e) {
      console.warn("Erreur sauvegarde Firestore custom_rule:", e);
    }

    return newRule;
  }, [customRules, setTransactions]);

  const updateCustomRule = useCallback(async (id: string, updates: Partial<CustomUserRule>) => {
    const accountId = getActiveAccountId();
    const nowIso = new Date().toISOString();

    const nextRules = customRules.map(r => r.id === id ? { ...r, ...updates, updatedAt: nowIso } : r);
    setCustomRules(nextRules);
    setInMemoryCustomRules(nextRules);
    try {
      localStorage.setItem(STORAGE_CUSTOM_RULES, JSON.stringify(nextRules));
    } catch {}

    setTransactions(prev => prev.map(t => enrichTransactionFallback(t)));

    try {
      const cleanUpdates = JSON.parse(JSON.stringify({ ...updates, updatedAt: nowIso }));
      await setDoc(doc(db, `users/${accountId}/custom_rules/${id}`), cleanUpdates, { merge: true });
    } catch (e) {
      console.warn("Erreur update Firestore custom_rule:", e);
    }
  }, [customRules, setTransactions]);

  const deleteCustomRule = useCallback(async (id: string) => {
    const accountId = getActiveAccountId();
    const target = customRules.find(r => r.id === id);
    const nowIso = new Date().toISOString();

    const nextRules = customRules.filter(r => r.id !== id);
    setCustomRules(nextRules);
    setInMemoryCustomRules(nextRules);
    try {
      localStorage.setItem(STORAGE_CUSTOM_RULES, JSON.stringify(nextRules));
    } catch {}

    if (target) {
      const archiveRecord: ArchivedItemRecord = {
        id: `arch-rule-${Date.now()}`,
        targetType: 'subscription_rule',
        targetId: id,
        title: `Règle : ${target.customLabel}`,
        subtitle: `Mot-clé "${target.pattern}" (${target.category})`,
        deletedAt: nowIso,
        actionType: 'CREATE_CUSTOM_RULE',
        previousSnapshot: target
      };
      setArchivedItems(prev => [archiveRecord, ...prev]);
      try {
        await setDoc(doc(db, `users/${accountId}/archived_items/${archiveRecord.id}`), JSON.parse(JSON.stringify(archiveRecord)));
      } catch {}
    }

    try {
      await setDoc(doc(db, `users/${accountId}/custom_rules/${id}`), { isArchived: true, deletedAt: nowIso }, { merge: true });
    } catch (e) {
      console.warn("Erreur soft-delete Firestore custom_rule:", e);
    }
  }, [customRules]);

  // 9. Validation, Annulation et Undo des Actions Administrateur dans le Chat (Chantier 3)
  const confirmProposedAction = useCallback(async (messageId: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg || !msg.proposedAction || msg.proposedAction.status !== 'pending') return;

    const action = msg.proposedAction;
    const accountId = getActiveAccountId();
    const nowIso = new Date().toISOString();
    const archiveId = `arch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    let archiveRecord: ArchivedItemRecord | null = null;

    try {
      if (action.actionType === 'UPDATE_BUDGET') {
        const { budgetId, budgetName, categoryGroup, oldAmount, newAmount } = action.payload;
        const currentList = [...costOfLivingBudgets];
        const exists = currentList.some(b => b.id === budgetId || b.name.toLowerCase() === String(budgetName || '').toLowerCase());

        let updatedBudgets: CostOfLivingExpenseItem[];
        if (exists) {
          updatedBudgets = currentList.map(b =>
            (b.id === budgetId || b.name.toLowerCase() === String(budgetName || '').toLowerCase())
              ? { ...b, amount: Number(newAmount), isAutoCalculated: false }
              : b
          );
        } else {
          updatedBudgets = [
            ...currentList,
            {
              id: budgetId || `custom-${Date.now()}`,
              name: budgetName || action.targetId,
              amount: Number(newAmount),
              categoryGroup: categoryGroup || 'loisirs',
              isAutoCalculated: false
            }
          ];
        }

        await updateCostOfLivingBudgets(updatedBudgets);

        archiveRecord = {
          id: archiveId,
          targetType: 'budget',
          targetId: String(budgetId || budgetName),
          title: `Modification Budget : ${budgetName || action.targetId}`,
          subtitle: `Ancien montant : ${Number(oldAmount || 0).toFixed(2)} € → Nouveau : ${Number(newAmount).toFixed(2)} €`,
          deletedAt: nowIso,
          actionType: 'UPDATE_BUDGET',
          previousSnapshot: currentList
        };
      } else if (action.actionType === 'CREATE_CUSTOM_RULE') {
        const p = action.payload;
        const created = await addCustomRule({
          pattern: p.pattern || action.targetId,
          exactAmount: p.exactAmount ? Number(p.exactAmount) : undefined,
          customLabel: p.customLabel || action.title,
          category: p.category || 'Abonnements & Télécom',
          budgetPostName: p.budgetPostName || 'Streaming, Cloud & Services',
          isSubscription: p.isSubscription !== undefined ? Boolean(p.isSubscription) : true,
          customNote: p.customNote || action.description
        });

        archiveRecord = {
          id: archiveId,
          targetType: 'subscription_rule',
          targetId: created.id,
          title: `Règle créée : ${created.customLabel}`,
          subtitle: `Mot-clé : ${created.pattern}`,
          deletedAt: nowIso,
          actionType: 'CREATE_CUSTOM_RULE',
          previousSnapshot: { ruleId: created.id }
        };
      } else if (action.actionType === 'DELETE_TRANSACTION') {
        const txId = String(action.payload.transactionId || action.targetId);
        const snapTx = action.payload.transactionSnapshot || transactions.find(t => String(t.id) === txId);

        setTransactions(prev => {
          const next = prev.filter(t => String(t.id) !== txId);
          try {
            localStorage.setItem('cashpilot_tx_cache', JSON.stringify(next));
          } catch {}
          return next;
        });

        try {
          await setDoc(doc(db, `users/${accountId}/transactions/${txId}`), {
            isArchived: true,
            deletedAt: nowIso
          }, { merge: true });
        } catch (e) {
          console.warn("Erreur Firestore soft delete transaction:", e);
        }

        archiveRecord = {
          id: archiveId,
          targetType: 'transaction',
          targetId: txId,
          title: `Transaction archivée : ${snapTx?.cleanLabel || snapTx?.rawLabel || txId}`,
          subtitle: `${snapTx?.date || ''} • ${Number(snapTx?.amount || 0).toFixed(2)} €`,
          deletedAt: nowIso,
          actionType: 'DELETE_TRANSACTION',
          previousSnapshot: snapTx
        };
      } else if (action.actionType === 'UPDATE_TRANSACTION') {
        const txId = String(action.payload.transactionId || action.targetId);
        const snapTx = transactions.find(t => String(t.id) === txId) || action.payload.transactionSnapshot;
        const updates = action.payload.updates || {};

        setTransactions(prev => {
          const next = prev.map(t => String(t.id) === txId ? { ...t, ...updates } : t);
          try {
            localStorage.setItem('cashpilot_tx_cache', JSON.stringify(next));
          } catch {}
          return next;
        });

        try {
          await setDoc(doc(db, `users/${accountId}/transactions/${txId}`), updates, { merge: true });
        } catch (e) {
          console.warn("Erreur Firestore update transaction:", e);
        }

        archiveRecord = {
          id: archiveId,
          targetType: 'transaction',
          targetId: txId,
          title: `Modification Transaction : ${snapTx?.cleanLabel || txId}`,
          subtitle: `État précédent sauvegardé (${snapTx?.date || ''})`,
          deletedAt: nowIso,
          actionType: 'UPDATE_TRANSACTION',
          previousSnapshot: snapTx
        };
      } else if (action.actionType === 'DELETE_STATEMENT_PERIOD') {
        const monthKey = String(action.payload.monthKey || action.targetId);
        const affectedTxs = transactions.filter(t => t.monthKey === monthKey || (t.date && t.date.startsWith(monthKey)));

        setTransactions(prev => {
          const next = prev.filter(t => !(t.monthKey === monthKey || (t.date && t.date.startsWith(monthKey))));
          try {
            localStorage.setItem('cashpilot_tx_cache', JSON.stringify(next));
          } catch {}
          return next;
        });

        try {
          const batch = writeBatch(db);
          affectedTxs.forEach(t => {
            if (t.id) {
              batch.set(doc(db, `users/${accountId}/transactions/${t.id}`), {
                isArchived: true,
                deletedAt: nowIso
              }, { merge: true });
            }
          });
          await batch.commit();
        } catch (e) {
          console.warn("Erreur Firestore soft delete statement period:", e);
        }

        archiveRecord = {
          id: archiveId,
          targetType: 'statement',
          targetId: monthKey,
          title: `Relevé Bancaire archivé : Période ${monthKey}`,
          subtitle: `${affectedTxs.length} opérations bancaires mises en corbeille`,
          deletedAt: nowIso,
          actionType: 'DELETE_STATEMENT_PERIOD',
          previousSnapshot: affectedTxs
        };
      } else if (action.actionType === 'DELETE_RECEIPT') {
        const receiptId = String(action.payload.receiptId || action.targetId);
        const snapRcpt = action.payload.receiptSnapshot || receipts.find(r => r.id === receiptId);

        try {
          await setDoc(doc(db, `users/${accountId}/receipts/${receiptId}`), {
            isArchived: true,
            deletedAt: nowIso
          }, { merge: true });
        } catch (e) {
          console.warn("Erreur Firestore soft delete receipt:", e);
        }

        archiveRecord = {
          id: archiveId,
          targetType: 'receipt',
          targetId: receiptId,
          title: `Ticket de caisse archivé : ${snapRcpt?.storeName || receiptId}`,
          subtitle: `${snapRcpt?.date || ''} • ${Number(snapRcpt?.totalAmount || 0).toFixed(2)} €`,
          deletedAt: nowIso,
          actionType: 'DELETE_RECEIPT',
          previousSnapshot: snapRcpt
        };
      } else if (action.actionType === 'UPDATE_RECEIPT') {
        const receiptId = String(action.payload.receiptId || action.targetId);
        const snapRcpt = receipts.find(r => r.id === receiptId) || action.payload.receiptSnapshot;
        const updates = action.payload.updates || {};

        try {
          await setDoc(doc(db, `users/${accountId}/receipts/${receiptId}`), {
            ...updates,
            updatedAt: nowIso
          }, { merge: true });
        } catch (e) {
          console.warn("Erreur Firestore update receipt:", e);
        }

        archiveRecord = {
          id: archiveId,
          targetType: 'receipt',
          targetId: receiptId,
          title: `Ticket modifié : ${snapRcpt?.storeName || receiptId}`,
          subtitle: `État précédent sauvegardé (${snapRcpt?.date || ''})`,
          deletedAt: nowIso,
          actionType: 'UPDATE_RECEIPT',
          previousSnapshot: snapRcpt
        };
      }

      if (archiveRecord) {
        const nextArchives = [archiveRecord, ...archivedItems];
        setArchivedItems(nextArchives);
        try {
          localStorage.setItem(STORAGE_ARCHIVED_ITEMS, JSON.stringify(nextArchives));
          await setDoc(doc(db, `users/${accountId}/archived_items/${archiveId}`), JSON.parse(JSON.stringify(archiveRecord)));
        } catch (e) {
          console.warn("Erreur enregistrement archiveRecord:", e);
        }
      }

      // Mettre à jour le statut de la carte dans le message
      setConversations(prev => prev.map(c => {
        if (c.id === activeConversationId) {
          const updated = {
            ...c,
            messages: c.messages.map(m => {
              if (m.id === messageId && m.proposedAction) {
                return {
                  ...m,
                  proposedAction: {
                    ...m.proposedAction,
                    status: 'validated' as const,
                    executedAt: nowIso,
                    archiveId
                  }
                };
              }
              return m;
            }),
            updatedAt: Date.now()
          };
          syncConversationToFirestore(updated);
          return updated;
        }
        return c;
      }));

      if (setAppNotification) {
        setAppNotification({
          type: 'success',
          message: `✅ Action validée et synchronisée en temps réel : ${action.title}`
        });
      }
    } catch (err) {
      console.error("Erreur lors de la validation de l'action:", err);
    }
  }, [
    messages,
    costOfLivingBudgets,
    updateCostOfLivingBudgets,
    addCustomRule,
    transactions,
    setTransactions,
    receipts,
    archivedItems,
    activeConversationId,
    setAppNotification,
    syncConversationToFirestore
  ]);

  const rejectProposedAction = useCallback((messageId: string) => {
    setConversations(prev => prev.map(c => {
      if (c.id === activeConversationId) {
        const updated = {
          ...c,
          messages: c.messages.map(m => {
            if (m.id === messageId && m.proposedAction) {
              return {
                ...m,
                proposedAction: {
                  ...m.proposedAction,
                  status: 'cancelled' as const
                }
              };
            }
            return m;
          }),
          updatedAt: Date.now()
        };
        syncConversationToFirestore(updated);
        return updated;
      }
      return c;
    }));
  }, [activeConversationId, syncConversationToFirestore]);

  // Restaurer un élément archivé (depuis le bouton Undo du chat OU depuis la Corbeille dans Paramètres)
  const restoreArchivedItem = useCallback(async (archiveId: string) => {
    const record = archivedItems.find(a => a.id === archiveId);
    if (!record) return;

    const accountId = getActiveAccountId();
    const nowIso = new Date().toISOString();

    try {
      if (record.actionType === 'UPDATE_BUDGET' && Array.isArray(record.previousSnapshot)) {
        await updateCostOfLivingBudgets(record.previousSnapshot);
      } else if (record.actionType === 'CREATE_CUSTOM_RULE' && record.previousSnapshot?.ruleId) {
        const rId = record.previousSnapshot.ruleId;
        const nextRules = customRules.filter(r => r.id !== rId);
        setCustomRules(nextRules);
        setInMemoryCustomRules(nextRules);
        try {
          localStorage.setItem(STORAGE_CUSTOM_RULES, JSON.stringify(nextRules));
          await setDoc(doc(db, `users/${accountId}/custom_rules/${rId}`), { isArchived: true }, { merge: true });
        } catch {}
      } else if (record.targetType === 'transaction' && record.previousSnapshot) {
        const snapTx = { ...record.previousSnapshot, isArchived: false, deletedAt: null };
        setTransactions(prev => {
          const filtered = prev.filter(t => String(t.id) !== String(snapTx.id));
          const next = [snapTx, ...filtered].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
          try {
            localStorage.setItem('cashpilot_tx_cache', JSON.stringify(next));
          } catch {}
          return next;
        });
        try {
          await setDoc(doc(db, `users/${accountId}/transactions/${snapTx.id}`), JSON.parse(JSON.stringify(snapTx)), { merge: true });
        } catch {}
      } else if (record.targetType === 'statement' && Array.isArray(record.previousSnapshot)) {
        const restoredTxs = record.previousSnapshot.map((t: any) => ({ ...t, isArchived: false, deletedAt: null }));
        setTransactions(prev => {
          const restoredIds = new Set(restoredTxs.map((t: any) => String(t.id)));
          const next = [...restoredTxs, ...prev.filter(t => !restoredIds.has(String(t.id)))].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
          try {
            localStorage.setItem('cashpilot_tx_cache', JSON.stringify(next));
          } catch {}
          return next;
        });
        try {
          const batch = writeBatch(db);
          restoredTxs.forEach((t: any) => {
            if (t.id) {
              batch.set(doc(db, `users/${accountId}/transactions/${t.id}`), { isArchived: false, deletedAt: null }, { merge: true });
            }
          });
          await batch.commit();
        } catch {}
      } else if (record.targetType === 'receipt' && record.previousSnapshot) {
        const snapRcpt = { ...record.previousSnapshot, isArchived: false, deletedAt: null };
        try {
          await setDoc(doc(db, `users/${accountId}/receipts/${snapRcpt.id}`), JSON.parse(JSON.stringify(snapRcpt)), { merge: true });
        } catch {}
      }

      // Marquer l'archive comme restaurée
      const nextArchives = archivedItems.filter(a => a.id !== archiveId);
      setArchivedItems(nextArchives);
      try {
        localStorage.setItem(STORAGE_ARCHIVED_ITEMS, JSON.stringify(nextArchives));
        await updateDoc(doc(db, `users/${accountId}/archived_items/${archiveId}`), {
          isRestored: true,
          restoredAt: nowIso
        });
      } catch {}

      if (setAppNotification) {
        setAppNotification({
          type: 'info',
          message: `↩️ Action annulée et données restaurées : ${record.title}`
        });
      }
    } catch (e) {
      console.error("Erreur lors de la restauration de l'archive:", e);
    }
  }, [archivedItems, updateCostOfLivingBudgets, customRules, setTransactions, setAppNotification]);

  const undoProposedAction = useCallback(async (messageId: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg || !msg.proposedAction || msg.proposedAction.status !== 'validated') return;

    const archiveId = msg.proposedAction.archiveId;
    if (archiveId) {
      await restoreArchivedItem(archiveId);
    }

    setConversations(prev => prev.map(c => {
      if (c.id === activeConversationId) {
        const updated = {
          ...c,
          messages: c.messages.map(m => {
            if (m.id === messageId && m.proposedAction) {
              return {
                ...m,
                proposedAction: {
                  ...m.proposedAction,
                  status: 'undone' as const,
                  undoneAt: new Date().toISOString()
                }
              };
            }
            return m;
          }),
          updatedAt: Date.now()
        };
        syncConversationToFirestore(updated);
        return updated;
      }
      return c;
    }));
  }, [messages, restoreArchivedItem, activeConversationId, syncConversationToFirestore]);

  const permanentlyDeleteArchivedItem = useCallback(async (archiveId: string) => {
    const accountId = getActiveAccountId();
    const nextArchives = archivedItems.filter(a => a.id !== archiveId);
    setArchivedItems(nextArchives);
    try {
      localStorage.setItem(STORAGE_ARCHIVED_ITEMS, JSON.stringify(nextArchives));
      await deleteDoc(doc(db, `users/${accountId}/archived_items/${archiveId}`));
    } catch {}
  }, [archivedItems]);

  return (
    <CoachContext.Provider
      value={{
        conversations,
        activeConversationId,
        currentConversation,
        messages,
        selectedScope,
        scopedTransactions,
        financialProfile,
        isLoading,
        loadingStep,
        loadingSeconds,
        inputPrompt,
        setInputPrompt,
        setActiveConversationId,
        handleScopeChange,
        handleCreateNewConversation,
        handleDeleteConversation,
        handleDeleteMessage,
        sendMessage,
        confirmProposedAction,
        rejectProposedAction,
        undoProposedAction,
        customRules,
        addCustomRule,
        updateCustomRule,
        deleteCustomRule,
        archivedItems,
        restoreArchivedItem,
        permanentlyDeleteArchivedItem,
        costOfLivingBudgets,
        updateCostOfLivingBudgets
      }}
    >
      {children}
    </CoachContext.Provider>
  );
};

export const useCoach = (): CoachContextType => {
  const ctx = useContext(CoachContext);
  if (!ctx) {
    throw new Error('useCoach doit être utilisé au sein d\'un CoachProvider');
  }
  return ctx;
};
