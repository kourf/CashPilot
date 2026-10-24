import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy, doc, setDoc } from 'firebase/firestore';
import { getAvailableMonths, type Transaction } from '../lib/kpiUtils';
import { getActiveAccountId } from '../lib/userUtils';

export interface ActiveImportState {
  isImporting: boolean;
  isAiAnalyzing: boolean;
  aiAnalysisSeconds: number;
  fileStatusMessage: string | null;
  fileName: string | null;
  aiAnalysisStats: {
    totalCount: number;
    executionTimeSeconds: string;
    timestamp: Date;
  } | null;
}

interface TransactionsContextType {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  availableMonths: string[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  currency: 'EUR' | 'CHF';
  setCurrency: (newCurrency: 'EUR' | 'CHF') => Promise<void>;
  customBalances: Record<string, { initial: number; closing: number }>;
  setCustomBalances: (balances: Record<string, { initial: number; closing: number }>) => Promise<void>;
  isRealtimeSynced: boolean;
}

const CACHE_KEY = 'cashpilot_tx_cache';
const CURRENCY_KEY = 'cashpilot_statement_currency';
const BALANCES_KEY = 'cashpilot_monthly_balances';

const TransactionsContext = createContext<TransactionsContextType | undefined>(undefined);

export const TransactionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Initialisation optimiste immédiate depuis le localStorage pour un chargement instantané (0 ms)
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Erreur lecture cache local transactions:", e);
    }
    return [];
  });

  // Si on a déjà des données en cache, le premier rendu est instantané (loading = false)
  const [loading, setLoading] = useState<boolean>(() => transactions.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const hasInitializedMonthRef = useRef(false);

  // Synchronisation temps réel de la devise (€ par défaut absolu, purge du CHF obsolète sur mobile)
  const [currency, setCurrencyState] = useState<'EUR' | 'CHF'>(() => {
    try {
      const saved = localStorage.getItem(CURRENCY_KEY);
      if (saved === 'CHF') {
        localStorage.setItem(CURRENCY_KEY, 'EUR');
        return 'EUR';
      }
      return (saved as 'EUR' | 'CHF') || 'EUR';
    } catch {
      return 'EUR';
    }
  });

  // Soldes mensuels personnalisés (synchronisés en direct)
  const [customBalances, setCustomBalancesState] = useState<Record<string, { initial: number; closing: number }>>(() => {
    try {
      const saved = localStorage.getItem(BALANCES_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [isRealtimeSynced, setIsRealtimeSynced] = useState<boolean>(false);

  // État persistant de l'import et du chronomètre IA (survit au changement d'onglet)
  const [importState, setImportState] = useState<ActiveImportState>({
    isImporting: false,
    isAiAnalyzing: false,
    aiAnalysisSeconds: 0,
    fileStatusMessage: null,
    fileName: null,
    aiAnalysisStats: null
  });

  const [appNotification, setAppNotificationState] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const notificationTimeoutRef = useRef<any>(null);
  const importTimerRef = useRef<any>(null);

  const setAppNotification = (notif: { type: 'success' | 'error' | 'info'; message: string } | null) => {
    if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    setAppNotificationState(notif);
    if (notif) {
      notificationTimeoutRef.current = setTimeout(() => {
        setAppNotificationState(null);
      }, 6000);
    }
  };

  const startImportSession = (fileName: string) => {
    if (importTimerRef.current) {
      clearInterval(importTimerRef.current);
      importTimerRef.current = null;
    }
    setImportState({
      isImporting: true,
      isAiAnalyzing: false,
      aiAnalysisSeconds: 0,
      fileStatusMessage: `Lecture de ${fileName}...`,
      fileName,
      aiAnalysisStats: null
    });
  };

  const updateImportStatus = (message: string, isAiAnalyzing = true) => {
    setImportState(prev => {
      if (isAiAnalyzing && !importTimerRef.current) {
        importTimerRef.current = setInterval(() => {
          setImportState(curr => ({
            ...curr,
            aiAnalysisSeconds: parseFloat((curr.aiAnalysisSeconds + 0.1).toFixed(1))
          }));
        }, 100);
      }
      return {
        ...prev,
        isImporting: true,
        isAiAnalyzing,
        fileStatusMessage: message
      };
    });
  };

  const finishImportSession = (stats?: { totalCount: number; executionTimeSeconds: string; timestamp: Date }) => {
    if (importTimerRef.current) {
      clearInterval(importTimerRef.current);
      importTimerRef.current = null;
    }
    setImportState(prev => ({
      ...prev,
      isImporting: false,
      isAiAnalyzing: false,
      fileStatusMessage: null,
      aiAnalysisStats: stats || prev.aiAnalysisStats
    }));
  };

  const cancelImportSession = () => {
    if (importTimerRef.current) {
      clearInterval(importTimerRef.current);
      importTimerRef.current = null;
    }
    setImportState(prev => ({
      ...prev,
      isImporting: false,
      isAiAnalyzing: false,
      fileStatusMessage: null
    }));
  };

  // Mois disponibles calculés à partir des transactions en mémoire
  const availableMonths = useMemo(() => getAvailableMonths(transactions), [transactions]);

  // Initialisation unique au premier chargement sur le mois le plus récent (sans écraser le choix 'all' de l'utilisateur)
  useEffect(() => {
    if (availableMonths.length === 0) {
      setSelectedMonth('all');
      hasInitializedMonthRef.current = false;
    } else if (!hasInitializedMonthRef.current) {
      setSelectedMonth(availableMonths[0]);
      hasInitializedMonthRef.current = true;
    }
  }, [availableMonths]);

  // 2. Écouteur Firestore persistant pour la configuration globale (Devise, Soldes, Sync PC & Mobile en direct)
  useEffect(() => {
    let unsubConfig: (() => void) | undefined;
    try {
      const accountId = getActiveAccountId();
      const configDocRef = doc(db, `users/${accountId}/settings/app_config`);

      unsubConfig = onSnapshot(configDocRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const remoteCurr = data.currency === 'CHF' ? 'CHF' : 'EUR';
          setCurrencyState(remoteCurr);
          try {
            localStorage.setItem(CURRENCY_KEY, remoteCurr);
          } catch (e) {}

          if (data.monthlyBalances && typeof data.monthlyBalances === 'object') {
            setCustomBalancesState(data.monthlyBalances);
            try {
              localStorage.setItem(BALANCES_KEY, JSON.stringify(data.monthlyBalances));
            } catch (e) {}
          }
          setIsRealtimeSynced(true);
        } else {
          // Si le document distant n'existe pas encore, on l'initialise avec l'Euro (€)
          setDoc(configDocRef, {
            currency: 'EUR',
            monthlyBalances: {},
            updatedAt: new Date().toISOString()
          }, { merge: true }).catch(err => console.warn("Erreur initialisation config Firestore:", err));
          setCurrencyState('EUR');
          try {
            localStorage.setItem(CURRENCY_KEY, 'EUR');
          } catch (e) {}
          setIsRealtimeSynced(true);
        }
      }, (err) => {
        console.warn("Écouteur settings Firestore hors-ligne:", err);
      });
    } catch (e) {
      console.warn("Erreur initialisation écouteur config:", e);
    }

    return () => {
      if (unsubConfig) unsubConfig();
    };
  }, []);

  const setCurrency = async (newCurr: 'EUR' | 'CHF') => {
    setCurrencyState(newCurr);
    try {
      localStorage.setItem(CURRENCY_KEY, newCurr);
    } catch (e) {}

    try {
      const accountId = getActiveAccountId();
      const configDocRef = doc(db, `users/${accountId}/settings/app_config`);
      await setDoc(configDocRef, {
        currency: newCurr,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.warn("Erreur synchronisation devise Firestore:", err);
    }
  };

  const setCustomBalances = async (balances: Record<string, { initial: number; closing: number }>) => {
    setCustomBalancesState(balances);
    try {
      localStorage.setItem(BALANCES_KEY, JSON.stringify(balances));
    } catch (e) {}

    try {
      const accountId = getActiveAccountId();
      const configDocRef = doc(db, `users/${accountId}/settings/app_config`);
      await setDoc(configDocRef, {
        monthlyBalances: balances,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.warn("Erreur synchronisation soldes Firestore:", err);
    }
  };

  // 3. Écouteur Firestore persistant unique pour les transactions (au niveau racine de l'application)
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    
    // Timeout de sécurité si le réseau est totalement indisponible et pas de cache
    const timeoutId = setTimeout(() => {
      if (loading && transactions.length === 0) {
        setLoading(false);
        setError("Le chargement prend plus de temps que prévu.");
      }
    }, 8000);

    try {
      const accountId = getActiveAccountId();

      const q = query(
        collection(db, `users/${accountId}/transactions`),
        orderBy('date', 'desc')
      );

      unsubscribe = onSnapshot(q, (snapshot) => {
        const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as unknown as Transaction[];
        
        setTransactions(txs);
        setLoading(false);
        setError(null);
        clearTimeout(timeoutId);

        // Sauvegarde synchrone dans le cache chaud local
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(txs));
        } catch (storageErr) {
          console.warn("Erreur écriture cache transactions:", storageErr);
        }
      }, (err) => {
        console.error("Erreur Firestore sync transactions:", err);
        // Si on a des transactions en cache, on ne bloque pas l'utilisateur
        if (transactions.length === 0) {
          setError("Impossible de synchroniser vos données. Vérifiez votre connexion.");
        }
        setLoading(false);
        clearTimeout(timeoutId);
      });
    } catch (err) {
      console.error("Erreur d'initialisation de l'écouteur Firestore:", err);
      if (transactions.length === 0) {
        setError("Une erreur inattendue est survenue.");
      }
      setLoading(false);
      clearTimeout(timeoutId);
    }

    return () => {
      clearTimeout(timeoutId);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  return (
    <TransactionsContext.Provider
      value={{
        transactions,
        loading,
        error,
        selectedMonth,
        setSelectedMonth,
        availableMonths,
        setTransactions,
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
        appNotification,
        setAppNotification
      }}
    >
      {children}
    </TransactionsContext.Provider>
  );
};

export const useTransactions = (): TransactionsContextType => {
  const context = useContext(TransactionsContext);
  if (!context) {
    throw new Error('useTransactions doit être utilisé au sein d\'un TransactionsProvider');
  }
  return context;
};
