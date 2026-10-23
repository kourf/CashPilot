import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { getActiveAccountId } from '../lib/userUtils';
import { 
  type Receipt, 
  type ReceiptItem,
  type ComparativeMatrix,
  type SupermarketAisle,
  type SupermarketAisleKey,
  getReceiptUniqueKey
} from '../types/receipts';
import { buildComparativeMatrix, classifyItemAisle, normalizeAisle, computeUnitPrice, normalizeStoreName, reconcileStoreWithExisting } from '../lib/receiptClassifier';
import { extractReceiptItemsFromFiles, type ExtractedReceiptResult } from '../lib/geminiService';

export interface ReceiptsContextType {
  receipts: Receipt[];
  matrix: ComparativeMatrix;
  hiddenProductNames: string[];
  isAnalyzing: boolean;
  analysisProgress: string;
  loading: boolean;
  isRealtimeSynced: boolean;
  pendingValidationReceipt: ExtractedReceiptResult | null;
  activeTab: 'matrix' | 'history' | 'upload';
  
  // Actions
  setPendingValidationReceipt: (receipt: ExtractedReceiptResult | null) => void;
  setActiveTab: (tab: 'matrix' | 'history' | 'upload') => void;
  addReceipt: (receiptData: Omit<Receipt, 'id' | 'userId' | 'createdAt'>) => Promise<Receipt>;
  deleteReceipt: (receiptId: string) => Promise<void>;
  hideProductFromMatrix: (normalizedName: string) => Promise<void>;
  restoreProductToMatrix: (normalizedName: string) => Promise<void>;
  extractReceipt: (files: File[]) => Promise<ExtractedReceiptResult>;
}

const CACHE_KEY_RECEIPTS = 'cashpilot_receipts_v2_cache';
const CACHE_KEY_HIDDEN = 'cashpilot_receipts_hidden_products';
const CACHE_KEY_PENDING_RECEIPT = 'cashpilot_pending_receipt_validation';
const CACHE_KEY_ACTIVE_TAB = 'cashpilot_receipts_active_tab';

const ReceiptsContext = createContext<ReceiptsContextType | undefined>(undefined);

export const ReceiptsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Initialisation optimiste immédiate depuis le localStorage (0 ms de latence)
  const [receipts, setReceipts] = useState<Receipt[]>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY_RECEIPTS);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed as Receipt[];
      }
    } catch (e) {
      console.warn("Erreur lecture cache local tickets:", e);
    }
    return [];
  });

  const [hiddenProductNames, setHiddenProductNames] = useState<string[]>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY_HIDDEN);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed as string[];
      }
    } catch {
      return [];
    }
    return [];
  });

  // Ticket en cours d'audit/validation persisté : survit aux bascules d'onglets et rechargements
  const [pendingValidationReceipt, setPendingValidationReceiptState] = useState<ExtractedReceiptResult | null>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY_PENDING_RECEIPT);
      if (cached) return JSON.parse(cached);
    } catch {}
    return null;
  });

  const setPendingValidationReceipt = useCallback((val: ExtractedReceiptResult | null) => {
    setPendingValidationReceiptState(val);
    try {
      if (val) {
        localStorage.setItem(CACHE_KEY_PENDING_RECEIPT, JSON.stringify(val));
      } else {
        localStorage.removeItem(CACHE_KEY_PENDING_RECEIPT);
      }
    } catch {}
  }, []);

  const [activeTab, setActiveTabState] = useState<'matrix' | 'history' | 'upload'>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY_ACTIVE_TAB);
      if (cached === 'matrix' || cached === 'history' || cached === 'upload') return cached;
    } catch {}
    return 'matrix';
  });

  const setActiveTab = useCallback((tab: 'matrix' | 'history' | 'upload') => {
    setActiveTabState(tab);
    try {
      localStorage.setItem(CACHE_KEY_ACTIVE_TAB, tab);
    } catch {}
  }, []);

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisProgress, setAnalysisProgress] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(() => receipts.length === 0);
  const [isRealtimeSynced, setIsRealtimeSynced] = useState<boolean>(false);

  // 2. Écouteur Firestore en direct pour la collection 'receipts' (PC & Smartphone synchronisés)
  useEffect(() => {
    let unsubReceipts: (() => void) | undefined;

    try {
      const accountId = getActiveAccountId();
      const receiptsColRef = collection(db, `users/${accountId}/receipts`);

      unsubReceipts = onSnapshot(receiptsColRef, (snapshot) => {
        const list: Receipt[] = snapshot.docs.map(d => {
          const data = d.data();

          // Normalisation et typage strict des articles
          const rawItems = Array.isArray(data.items) 
            ? data.items 
            : (Array.isArray(data.products) ? data.products : []);

          const consolidatedItemsMap = new Map<string, ReceiptItem>();

          rawItems.forEach((it: Record<string, unknown>, idx: number) => {
            const rawName = String(it.rawName || it.name || 'Article').trim();
            const normalizedName = String(it.normalizedName || it.standardName || it.cleanName || rawName).trim();
            const brand = String(it.brand || '').trim();
            const pricePaid = Number(it.pricePaid ?? it.price ?? it.paidPrice) || 0;
            const quantity = Math.max(1, Number(it.quantity) || 1);
            const weightOrVolume = String(it.weightOrVolume || it.volume || it.weight || '').trim();
            const weightOrVolumeValue = typeof it.weightOrVolumeValue === 'number' ? it.weightOrVolumeValue : undefined;
            const weightOrVolumeUnit = typeof it.weightOrVolumeUnit === 'string' ? it.weightOrVolumeUnit : undefined;
            const comp = computeUnitPrice(pricePaid, weightOrVolume, quantity, weightOrVolumeValue, weightOrVolumeUnit);
            const unit = String(it.unit || '').trim() || comp.unit;
            const unitPrice = Number(it.referenceUnitPrice || it.unitPrice) > 0 ? Number(it.referenceUnitPrice || it.unitPrice) : comp.unitPrice;
            const aisle = normalizeAisle(String(it.categoryKey || it.category || classifyItemAisle(normalizedName, rawName)));

            // Clé de fusion stricte au sein du ticket : même libellé normalisé + même unité
            const itemKey = `${normalizedName.toLowerCase()}__${unit.toLowerCase()}`;

            if (consolidatedItemsMap.has(itemKey)) {
              const existing = consolidatedItemsMap.get(itemKey)!;
              existing.quantity += quantity;
              existing.pricePaid = Number((existing.pricePaid + pricePaid).toFixed(2));
              existing.price = existing.pricePaid;
              const recomputed = computeUnitPrice(existing.pricePaid, existing.weightOrVolume, existing.quantity, existing.weightOrVolumeValue, existing.weightOrVolumeUnit);
              existing.unitPrice = recomputed.unitPrice;
              existing.referenceUnitPrice = recomputed.unitPrice;
            } else {
              consolidatedItemsMap.set(itemKey, {
                id: String(it.id || `item-${d.id}-${idx}`),
                rawName,
                normalizedName,
                brand: brand || 'Générique',
                pricePaid: Number(pricePaid.toFixed(2)),
                price: Number(pricePaid.toFixed(2)),
                quantity,
                weightOrVolume,
                weightOrVolumeValue,
                weightOrVolumeUnit,
                unitPrice: Number(unitPrice.toFixed(2)),
                referenceUnitPrice: Number(unitPrice.toFixed(2)),
                category: aisle.label,
                categoryKey: aisle.key,
                unit
              });
            }
          });

          const items: ReceiptItem[] = Array.from(consolidatedItemsMap.values());

          const totalCalculated = items.reduce((acc, it) => acc + (it.pricePaid ?? it.price ?? 0), 0);
          const totalAmount = Number(data.totalAmount ?? data.totalPaid ?? data.total) || Number(totalCalculated.toFixed(2));

          const r: Receipt = {
            id: d.id,
            userId: accountId,
            storeName: normalizeStoreName(data.storeName),
            date: String(data.date || new Date().toISOString().slice(0, 10)),
            time: data.time ? String(data.time).trim() : undefined,
            totalArticles: typeof data.totalArticles === 'number' ? Number(data.totalArticles.toFixed(2)) : (typeof data.subtotal === 'number' ? Number(data.subtotal.toFixed(2)) : undefined),
            subtotal: typeof data.subtotal === 'number' ? Number(data.subtotal.toFixed(2)) : undefined,
            totalDiscounts: typeof data.totalDiscounts === 'number' ? Number(data.totalDiscounts.toFixed(2)) : undefined,
            totalAmount: Number(totalAmount.toFixed(2)),
            items,
            createdAt: String(data.createdAt || new Date().toISOString()),
            updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
            rawFileCount: typeof data.rawFileCount === 'number' ? data.rawFileCount : 1
          };

          return r;
        });

        // Tri chronologique décroissant (les tickets les plus récents en premier)
        list.sort((a, b) => {
          const tA = new Date(a.date || a.createdAt || 0).getTime();
          const tB = new Date(b.date || b.createdAt || 0).getTime();
          return tB - tA;
        });

        setReceipts(list);
        setLoading(false);
        setIsRealtimeSynced(true);

        try {
          localStorage.setItem(CACHE_KEY_RECEIPTS, JSON.stringify(list));
        } catch (e) {}
      }, (err) => {
        console.warn("Écouteur Firestore tickets hors-ligne:", err);
        setLoading(false);
      });
    } catch (e) {
      console.warn("Erreur initialisation écouteur tickets:", e);
      setLoading(false);
    }

    return () => {
      if (unsubReceipts) unsubReceipts();
    };
  }, []);

  // 3. Écouteur Firestore pour les exclusions de la matrice (produits supprimés du comparatif)
  useEffect(() => {
    let unsubExclusions: (() => void) | undefined;
    try {
      const accountId = getActiveAccountId();
      const docRef = doc(db, `users/${accountId}/settings/receipt_matrix_exclusions`);

      unsubExclusions = onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data.hiddenProductNames)) {
            setHiddenProductNames(data.hiddenProductNames);
            try {
              localStorage.setItem(CACHE_KEY_HIDDEN, JSON.stringify(data.hiddenProductNames));
            } catch (e) {}
          }
        }
      }, (err) => {
        console.warn("Écouteur exclusions tickets:", err);
      });
    } catch (e) {
      console.warn("Erreur écouteur exclusions tickets:", e);
    }

    return () => {
      if (unsubExclusions) unsubExclusions();
    };
  }, []);

  // 4. Calcul de la matrice comparative Magasins vs Produits en mémoire
  // Zéro coût Firestore : calcul instantané et réactif à chaque changement
  const matrix = useMemo<ComparativeMatrix>(() => {
    return buildComparativeMatrix(receipts, hiddenProductNames);
  }, [receipts, hiddenProductNames]);

  // Action : Enregistrement d'un ticket validé par l'utilisateur
  const addReceipt = useCallback(async (
    receiptData: Omit<Receipt, 'id' | 'userId' | 'createdAt'>
  ): Promise<Receipt> => {
    const knownStores = Array.from(new Set(receipts.map(r => normalizeStoreName(r.storeName)).filter(Boolean)));
    const normalizedStore = reconcileStoreWithExisting(receiptData.storeName, knownStores);

    // Règle 4 : Clé Anti-Doublon stricte (Nom Magasin + Date + Heure/Minute + Montant)
    const currentKey = getReceiptUniqueKey(
      normalizedStore,
      receiptData.date,
      receiptData.time,
      receiptData.totalAmount
    );
    const existing = receipts.find(r => 
      getReceiptUniqueKey(normalizeStoreName(r.storeName), r.date, r.time, r.totalAmount) === currentKey
    );
    if (existing) {
      throw new Error(`🚨 Ticket déjà importé : Ce ticket de caisse (${normalizedStore} le ${receiptData.date} pour ${receiptData.totalAmount} €) existe déjà dans votre historique. Importation bloquée pour éviter les doublons.`);
    }

    const accountId = getActiveAccountId();
    const docId = `receipt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    const fullReceipt: Receipt = {
      ...receiptData,
      storeName: normalizedStore,
      id: docId,
      userId: accountId,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    // Sauvegarde Firestore sans valeurs 'undefined'
    const sanitizeForFirestore = (obj: any): any => {
      if (obj === undefined) return null;
      if (obj === null || typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
      const res: Record<string, any> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (v !== undefined) {
          res[k] = sanitizeForFirestore(v);
        }
      }
      return res;
    };

    const docRef = doc(db, `users/${accountId}/receipts/${docId}`);
    await setDoc(docRef, sanitizeForFirestore(fullReceipt));

    // Effacer le ticket en attente puisqu'il est validé et enregistré
    setPendingValidationReceipt(null);

    // Mise à jour optimiste immédiate
    setReceipts(prev => {
      const updated = [fullReceipt, ...prev.filter(r => r.id !== docId)];
      try {
        localStorage.setItem(CACHE_KEY_RECEIPTS, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    return fullReceipt;
  }, [setPendingValidationReceipt]);

  // Action : Suppression d'un ticket complet
  const deleteReceipt = useCallback(async (receiptId: string): Promise<void> => {
    const accountId = getActiveAccountId();
    await deleteDoc(doc(db, `users/${accountId}/receipts/${receiptId}`));

    // Mise à jour optimiste immédiate
    setReceipts(prev => {
      const updated = prev.filter(r => r.id !== receiptId);
      try {
        localStorage.setItem(CACHE_KEY_RECEIPTS, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  }, []);

  // Action : Suppression d'un produit de la matrice comparative (sans corrompre l'historique des tickets)
  const hideProductFromMatrix = useCallback(async (normalizedName: string): Promise<void> => {
    const cleanKey = normalizedName.trim().toLowerCase();
    if (!cleanKey) return;

    const nextList = Array.from(new Set([...hiddenProductNames, cleanKey]));
    setHiddenProductNames(nextList);

    try {
      localStorage.setItem(CACHE_KEY_HIDDEN, JSON.stringify(nextList));
      const accountId = getActiveAccountId();
      const docRef = doc(db, `users/${accountId}/settings/receipt_matrix_exclusions`);
      await setDoc(docRef, {
        hiddenProductNames: nextList,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.warn("Erreur enregistrement exclusion produit:", err);
    }
  }, [hiddenProductNames]);

  // Action : Restauration d'un produit dans la matrice
  const restoreProductToMatrix = useCallback(async (normalizedName: string): Promise<void> => {
    const cleanKey = normalizedName.trim().toLowerCase();
    const nextList = hiddenProductNames.filter(k => k !== cleanKey);
    setHiddenProductNames(nextList);

    try {
      localStorage.setItem(CACHE_KEY_HIDDEN, JSON.stringify(nextList));
      const accountId = getActiveAccountId();
      const docRef = doc(db, `users/${accountId}/settings/receipt_matrix_exclusions`);
      await setDoc(docRef, {
        hiddenProductNames: nextList,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.warn("Erreur restauration produit:", err);
    }
  }, [hiddenProductNames]);

  // Action : Extraction OCR / IA via Gemini Flash (100% gratuit)
  const extractReceipt = useCallback(async (files: File[]): Promise<ExtractedReceiptResult> => {
    try {
      setIsAnalyzing(true);
      setAnalysisProgress("Extraction par Gemini Flash Vision...");
      const knownStores = Array.from(new Set(receipts.map(r => normalizeStoreName(r.storeName)).filter(Boolean)));
      const res = await extractReceiptItemsFromFiles(files, knownStores);
      setPendingValidationReceipt(res);
      return res;
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress('');
    }
  }, [receipts, setPendingValidationReceipt]);

  const value: ReceiptsContextType = {
    receipts,
    matrix,
    hiddenProductNames,
    isAnalyzing,
    analysisProgress,
    loading,
    isRealtimeSynced,
    pendingValidationReceipt,
    activeTab,
    setPendingValidationReceipt,
    setActiveTab,
    addReceipt,
    deleteReceipt,
    hideProductFromMatrix,
    restoreProductToMatrix,
    extractReceipt
  };

  return (
    <ReceiptsContext.Provider value={value}>
      {children}
    </ReceiptsContext.Provider>
  );
};

export const useReceipts = () => {
  const context = useContext(ReceiptsContext);
  if (!context) {
    throw new Error('useReceipts must be used within a ReceiptsProvider');
  }
  return context;
};
