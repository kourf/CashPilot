import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { getAvailableMonths, type Transaction } from '../lib/kpiUtils';
import { getActiveAccountId } from '../lib/userUtils';


interface TransactionsContextType {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  availableMonths: string[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
}

const TransactionsContext = createContext<TransactionsContextType | undefined>(undefined);

const CACHE_KEY = 'cashpilot_tx_cache';

export const TransactionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Initialisation instantanée depuis le cache local (0 ms de latence au montage)
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

  // Mois disponibles calculés à partir des transactions en mémoire
  const availableMonths = useMemo(() => getAvailableMonths(transactions), [transactions]);

  // Si aucun mois sélectionné et qu'on a des mois disponibles, sélectionner le plus récent
  useEffect(() => {
    if (availableMonths.length > 0 && selectedMonth === 'all') {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  // 2. Écouteur Firestore persistant unique (au niveau racine de l'application)
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
        setTransactions
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
