import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';
import { getActiveAccountId } from '../lib/userUtils';
import { 
  type Receipt, 
  type ReceiptItem,
  type ComparativeMatrix,
  type SupermarketAisle,
  type SupermarketAisleKey,
  type StandardizedProductDoc,
  generateSuperKey,
  generateGenericNeedKey,
  normalizeProductNeed,
  getReceiptUniqueKey
} from '../types/receipts';
import { 
  buildComparativeMatrix, 
  buildComparativeMatrixFromProducts, 
  classifyItemAisle, 
  normalizeAisle, 
  computeUnitPrice, 
  normalizeStoreName, 
  reconcileStoreWithExisting 
} from '../lib/receiptClassifier';
import { extractReceiptItemsFromFiles, type ExtractedReceiptResult } from '../lib/geminiService';
import { resolvePhysicalStore } from '../lib/storeRegistry.ts';

export interface ReceiptsContextType {
  receipts: Receipt[];
  products: StandardizedProductDoc[];
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
  harmonizeAndCleanDatabase: () => Promise<{ mergedGroups: number; deletedDocs: number; totalProducts: number }>;
}

const CACHE_KEY_RECEIPTS = 'cashpilot_receipts_v2_cache';
const CACHE_KEY_PRODUCTS = 'cashpilot_standardized_products_cache';
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

  const [products, setProducts] = useState<StandardizedProductDoc[]>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY_PRODUCTS);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed as StandardizedProductDoc[];
      }
    } catch (e) {
      console.warn("Erreur lecture cache local produits:", e);
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
        const list: Receipt[] = snapshot.docs
          .filter(d => !d.data().isArchived)
          .map(d => {
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

          const resolved = resolvePhysicalStore({
            storeName: data.storeName,
            storeAddress: data.storeAddress,
            storePostalCode: data.storePostalCode,
            storeCity: data.storeCity
          });

          const receiptStoreName = data.storeName ? normalizeStoreName(data.storeName, data.storeAddress) : resolved.displayName;
          const receiptStoreId = data.storeId || resolved.id;

          const items: ReceiptItem[] = Array.from(consolidatedItemsMap.values()).map(it => ({
            ...it,
            storeId: it.storeId || receiptStoreId,
            storeName: it.storeName || receiptStoreName
          }));

          const totalCalculated = items.reduce((acc, it) => acc + (it.pricePaid ?? it.price ?? 0), 0);
          const totalAmount = Number(data.totalAmount ?? data.totalPaid ?? data.total) || Number(totalCalculated.toFixed(2));

          const r: Receipt = {
            id: d.id,
            userId: accountId,
            storeName: receiptStoreName,
            storeId: receiptStoreId,
            storeAddress: data.storeAddress || resolved.address,
            storeCity: data.storeCity || resolved.city,
            storePostalCode: data.storePostalCode || resolved.postalCode,
            googleMapsUrl: data.googleMapsUrl || resolved.googleMapsUrl,
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

  // 2.5 Écouteur Firestore pour la collection standardisée des produits (Règle 6 : 100% Gratuit)
  useEffect(() => {
    let unsubProducts: (() => void) | undefined;
    try {
      const accountId = getActiveAccountId();
      const productsColRef = collection(db, `users/${accountId}/products`);

      unsubProducts = onSnapshot(productsColRef, (snapshot) => {
        const list: StandardizedProductDoc[] = snapshot.docs.map(d => ({
          ...(d.data() as StandardizedProductDoc),
          superKey: (d.data() as any).cle_besoin || (d.data() as any).superKey || d.id,
          _docId: d.id
        } as any));
        setProducts(list);
        try {
          localStorage.setItem(CACHE_KEY_PRODUCTS, JSON.stringify(list));
        } catch (e) {}
      }, (err) => {
        console.warn("Écouteur Firestore produits standardisés:", err);
      });
    } catch (e) {
      console.warn("Erreur écouteur produits:", e);
    }

    return () => {
      if (unsubProducts) unsubProducts();
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

  // 4. Calcul de la matrice comparative Magasins vs Produits en mémoire (Couches 1, 2 & 3)
  // Unifie la collection `products` et les articles réels de `receipts` pour garantir 0 perte de prix et 0 ligne fantôme
  const matrix = useMemo<ComparativeMatrix>(() => {
    const virtualDocsFromReceipts: StandardizedProductDoc[] = [];

    receipts.forEach(r => {
      const resolved = resolvePhysicalStore({
        storeName: r.storeName,
        storeAddress: r.storeAddress,
        storePostalCode: r.storePostalCode,
        storeCity: r.storeCity
      });
      const stId = r.storeId || resolved.id;
      const stName = resolved.displayName;

      (r.items || []).forEach(it => {
        const rawCandidate = it.nomGenerique || it.normalizedName || it.rawName || '';
        const canonical = normalizeProductNeed(rawCandidate, it.brand);
        if (canonical.isInvalidArtifact) return;

        const pricePaid = Number(it.pricePaid ?? it.price) || 0;
        const comp = computeUnitPrice(pricePaid, it.weightOrVolume, it.quantity, it.weightOrVolumeValue, it.weightOrVolumeUnit);
        const unitPrice = Number(it.unitPrice) > 0 ? Number(it.unitPrice) : comp.unitPrice;
        if (!(unitPrice > 0)) return;

        const aisle = normalizeAisle(canonical.rayon || it.categoryKey || it.category || classifyItemAisle(canonical.nom_affichage, it.rawName));

        virtualDocsFromReceipts.push({
          superKey: canonical.id,
          cle_besoin: canonical.id,
          marque: it.brand || 'Générique',
          nom_generique: canonical.nom_affichage,
          poids_ou_volume: it.weightOrVolume || '1 piece',
          unite_mesure: (it.unit || comp.unit || 'piece') as any,
          rayon: aisle.label,
          rayon_assigne: aisle.label,
          rayon_cle: aisle.key,
          offres_magasins: {
            [stId]: {
              prix_unitaire: unitPrice,
              unite: it.unit || comp.unit || 'piece',
              prix_paye: pricePaid,
              marque: it.brand || 'Générique',
              format: it.weightOrVolume || '1 piece',
              date: r.date,
              magasin_nom: stName,
              magasin_id: stId,
              receiptId: r.id,
              rawName: it.rawName
            }
          },
          prix_actuel: {
            [stId]: {
              prix_unitaire: unitPrice,
              prix_paye: pricePaid,
              quantite: it.quantity || 1,
              date: r.date,
              magasin_id: stId,
              magasin_nom: stName,
              receiptId: r.id
            }
          },
          historique_prix: [
            {
              date: r.date,
              magasin: stId,
              magasin_nom: stName,
              prix_unitaire: unitPrice,
              prix_paye: pricePaid,
              quantite: it.quantity || 1,
              receiptId: r.id
            }
          ],
          derniere_mise_a_jour: r.createdAt || new Date().toISOString(),
          nombre_releves: 1
        } as any);
      });
    });

    const unifiedList = [...products, ...virtualDocsFromReceipts];
    if (unifiedList.length > 0) {
      return buildComparativeMatrixFromProducts(unifiedList, hiddenProductNames, Math.max(receipts.length, 2));
    }
    return buildComparativeMatrix(receipts, hiddenProductNames);
  }, [products, receipts, hiddenProductNames]);

  // Action : Enregistrement d'un ticket validé par l'utilisateur
  const addReceipt = useCallback(async (
    receiptData: Omit<Receipt, 'id' | 'userId' | 'createdAt'>
  ): Promise<Receipt> => {
    const resolved = resolvePhysicalStore({
      storeName: receiptData.storeName,
      storeAddress: receiptData.storeAddress,
      storePostalCode: receiptData.storePostalCode,
      storeCity: receiptData.storeCity
    });

    const normalizedStore = resolved.displayName;
    const storeId = receiptData.storeId || resolved.id;

    // Règle 4 : Clé Anti-Doublon stricte (Nom Magasin + Date + Heure/Minute + Montant)
    const currentKey = getReceiptUniqueKey(
      normalizedStore,
      receiptData.date,
      receiptData.time,
      receiptData.totalAmount
    );
    const existing = receipts.find(r => 
      getReceiptUniqueKey(normalizeStoreName(r.storeName, r.storeAddress), r.date, r.time, r.totalAmount) === currentKey
    );
    if (existing) {
      throw new Error(`🚨 Ticket déjà importé : Ce ticket de caisse (${normalizedStore} le ${receiptData.date} pour ${receiptData.totalAmount} €) existe déjà dans votre historique. Importation bloquée pour éviter les doublons.`);
    }

    const accountId = getActiveAccountId();
    const docId = `receipt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    const enrichedItems: ReceiptItem[] = (receiptData.items || []).map(it => ({
      ...it,
      storeId,
      storeName: normalizedStore
    }));

    const fullReceipt: Receipt = {
      ...receiptData,
      storeName: normalizedStore,
      storeId,
      storeAddress: receiptData.storeAddress || resolved.address,
      storeCity: receiptData.storeCity || resolved.city,
      storePostalCode: receiptData.storePostalCode || resolved.postalCode,
      googleMapsUrl: receiptData.googleMapsUrl || resolved.googleMapsUrl,
      items: enrichedItems,
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

    // Mise à jour de la collection standardisée des produits (Règle 6 : 100% Gratuit)
    const updatedProductsMap = new Map<string, StandardizedProductDoc>();
    products.forEach(p => updatedProductsMap.set(p.superKey, { ...p }));

    for (const it of enrichedItems) {
      // RÈGLE 1 & 2 (Couches 1 & 2) : Famille Canonique et structure offres_magasins
      const canonical = normalizeProductNeed(it.nomGenerique || it.normalizedName || it.rawName, it.brand);
      if (canonical.isInvalidArtifact) continue;

      const cleBesoin = canonical.id;
      it.cle_besoin = cleBesoin;
      it.superKey = cleBesoin;
      it.normalizedName = canonical.nom_affichage;
      if (canonical.rayon) {
        const normAisle = normalizeAisle(canonical.rayon);
        it.category = normAisle.label;
        it.categoryKey = normAisle.key;
      }

      const offerRecord = {
        prix_unitaire: it.unitPrice,
        unite: it.unit || 'piece',
        prix_paye: it.pricePaid,
        marque: it.brand || 'Générique',
        format: it.weightOrVolume || it.formatExact || '1 piece',
        date: receiptData.date,
        magasin_nom: normalizedStore,
        magasin_id: storeId,
        receiptId: docId
      };

      const priceRecord = {
        date: receiptData.date,
        magasin: storeId,
        magasin_nom: normalizedStore,
        prix_unitaire: it.unitPrice,
        prix_paye: it.pricePaid,
        quantite: it.quantity,
        receiptId: docId
      };

      const existingProd = updatedProductsMap.get(cleBesoin);
      const nowIso = new Date().toISOString();

      if (existingProd) {
        const currentOffers = { ...((existingProd as any).offres_magasins || {}) };
        currentOffers[storeId] = offerRecord;

        const currentPrices = { ...(existingProd.prix_actuel || {}) };
        currentPrices[storeId] = {
          prix_unitaire: it.unitPrice,
          prix_paye: it.pricePaid,
          quantite: it.quantity,
          date: receiptData.date,
          magasin_id: storeId,
          magasin_nom: normalizedStore,
          receiptId: docId
        };

        const existingHist = Array.isArray((existingProd as any).historique_offres) 
          ? (existingProd as any).historique_offres 
          : [];
        const filteredHist = existingHist.filter((h: any) => !(h.receiptId === docId && (h.magasin === storeId || h.magasin_id === storeId)));
        const nextHist = [...filteredHist, { ...offerRecord, magasin: storeId }].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // RÈGLE 2 : Historique standardisé { date, magasin, prix_unitaire }
        const existingHistPrix = Array.isArray((existingProd as any).historique_prix) ? (existingProd as any).historique_prix : [];
        const filteredHistPrix = existingHistPrix.filter((h: any) => !(h.date === receiptData.date && h.magasin === storeId));
        const nextHistPrix = [
          ...filteredHistPrix,
          {
            date: receiptData.date,
            magasin: storeId,
            prix_unitaire: it.unitPrice
          }
        ].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const sortedOffers = Object.entries(currentOffers).sort((a: any, b: any) => a[1].prix_unitaire - b[1].prix_unitaire);
        const bestOffer = sortedOffers.length > 0 ? {
          magasin_id: sortedOffers[0][0],
          magasin_nom: sortedOffers[0][1].magasin_nom || sortedOffers[0][0],
          prix_unitaire: sortedOffers[0][1].prix_unitaire,
          unite: sortedOffers[0][1].unite
        } : undefined;

        const updatedProd: any = {
          ...existingProd,
          nom_generique: it.normalizedName,
          rayon: it.category,
          rayon_cle: it.categoryKey,
          cle_besoin: cleBesoin,
          offres_magasins: currentOffers,
          prix_actuel: currentPrices,
          historique_offres: nextHist,
          historique_prix: nextHistPrix,
          meilleure_offre: bestOffer,
          derniere_mise_a_jour: nowIso,
          nombre_releves: nextHist.length
        };
        updatedProductsMap.set(cleBesoin, updatedProd);

        const prodDocRef = doc(db, `users/${accountId}/products/${cleBesoin}`);
        setDoc(prodDocRef, sanitizeForFirestore(updatedProd), { merge: true }).catch(err => {
          console.warn(`Erreur sync produit Firestore ${cleBesoin}:`, err);
        });
      } else {
        const newProd: any = {
          nom_generique: it.normalizedName,
          rayon: it.category || 'Autres / Divers',
          rayon_cle: it.categoryKey || 'autres_divers',
          cle_besoin: cleBesoin,
          superKey: cleBesoin,
          marque: it.brand || 'Générique',
          poids_ou_volume: it.weightOrVolume || it.formatExact || '1 piece',
          unite_mesure: (it.unit as any) || 'piece',
          offres_magasins: {
            [storeId]: offerRecord
          },
          prix_actuel: {
            [storeId]: {
              prix_unitaire: it.unitPrice,
              prix_paye: it.pricePaid,
              quantite: it.quantity,
              date: receiptData.date,
              magasin_id: storeId,
              magasin_nom: normalizedStore,
              receiptId: docId
            }
          },
          historique_offres: [{ ...offerRecord, magasin: storeId }],
          historique_prix: [{ date: receiptData.date, magasin: storeId, prix_unitaire: it.unitPrice }],
          meilleure_offre: {
            magasin_id: storeId,
            magasin_nom: normalizedStore,
            prix_unitaire: it.unitPrice,
            unite: it.unit || 'piece'
          },
          derniere_mise_a_jour: nowIso,
          nombre_releves: 1
        };
        updatedProductsMap.set(cleBesoin, newProd);

        const prodDocRef = doc(db, `users/${accountId}/products/${cleBesoin}`);
        setDoc(prodDocRef, sanitizeForFirestore(newProd)).catch(err => {
          console.warn(`Erreur creation produit Firestore ${cleBesoin}:`, err);
        });
      }
    }

    const nextProductsList = Array.from(updatedProductsMap.values());
    setProducts(nextProductsList);
    try {
      localStorage.setItem(CACHE_KEY_PRODUCTS, JSON.stringify(nextProductsList));
    } catch (e) {}

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
  }, [products, receipts, setPendingValidationReceipt]);

  // Action : Suppression d'un ticket complet avec nettoyage cohérent des offres orphelines
  const deleteReceipt = useCallback(async (receiptId: string): Promise<void> => {
    const accountId = getActiveAccountId();
    await deleteDoc(doc(db, `users/${accountId}/receipts/${receiptId}`));

    // Nettoyage des offres liées à ce ticket dans la collection produits standardisés
    const updatedProducts: StandardizedProductDoc[] = [];
    for (const prod of products) {
      const prodKey = (prod as any).cle_besoin || prod.superKey;
      let hasChanges = false;
      const offers = { ...((prod as any).offres_magasins || {}) };
      const prices = { ...(prod.prix_actuel || {}) };

      for (const [sId, offer] of Object.entries(offers) as [string, any][]) {
        if (offer.receiptId === receiptId) {
          delete offers[sId];
          delete prices[sId];
          hasChanges = true;
        }
      }

      const rawHist = (prod as any).historique_offres || prod.historique_prix || [];
      const nextHist = rawHist.filter((h: any) => h.receiptId !== receiptId);
      if (nextHist.length !== rawHist.length) {
        hasChanges = true;
      }

      if (hasChanges) {
        const remainingOffers = Object.entries(offers);
        if (remainingOffers.length === 0) {
          deleteDoc(doc(db, `users/${accountId}/products/${prodKey}`)).catch(e => console.warn(e));
        } else {
          const sorted = [...remainingOffers].sort((a: any, b: any) => a[1].prix_unitaire - b[1].prix_unitaire);
          const best = {
            magasin_id: sorted[0][0],
            magasin_nom: sorted[0][1].magasin_nom || sorted[0][0],
            prix_unitaire: sorted[0][1].prix_unitaire,
            unite: sorted[0][1].unite
          };
          const updatedDoc: any = {
            ...prod,
            offres_magasins: offers,
            prix_actuel: prices,
            historique_offres: nextHist,
            historique_prix: nextHist,
            meilleure_offre: best,
            nombre_releves: nextHist.length
          };
          updatedProducts.push(updatedDoc);
          setDoc(doc(db, `users/${accountId}/products/${prodKey}`), updatedDoc, { merge: true }).catch(e => console.warn(e));
        }
      } else {
        updatedProducts.push(prod);
      }
    }

    setProducts(updatedProducts);
    try {
      localStorage.setItem(CACHE_KEY_PRODUCTS, JSON.stringify(updatedProducts));
    } catch (e) {}

    // Mise à jour optimiste immédiate
    setReceipts(prev => {
      const updated = prev.filter(r => r.id !== receiptId);
      try {
        localStorage.setItem(CACHE_KEY_RECEIPTS, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  }, [products]);

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
      setAnalysisProgress("Optimisation des images pour Gemini Vision...");
      const knownStores = Array.from(new Set(receipts.map(r => normalizeStoreName(r.storeName)).filter(Boolean)));
      const res = await extractReceiptItemsFromFiles(files, knownStores, (progressMsg) => {
        setAnalysisProgress(progressMsg);
      });
      setPendingValidationReceipt(res);
      return res;
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress('');
    }
  }, [receipts, setPendingValidationReceipt]);

  // Action (COUCHE 3) : Harmonisation & Nettoyage par batch Firestore 100% gratuit de la base existante
  const harmonizeAndCleanDatabase = useCallback(async (): Promise<{
    mergedGroups: number;
    deletedDocs: number;
    totalProducts: number;
  }> => {
    const accountId = getActiveAccountId();
    const productsColRef = collection(db, `users/${accountId}/products`);
    const snapshot = await getDocs(productsColRef);

    // 1. Accumulateur par Clé de Famille Canonique (Couches 1 & 2)
    const canonicalGroups = new Map<string, {
      canonicalId: string;
      nomGenerique: string;
      rayon: SupermarketAisle;
      rayonCle: SupermarketAisleKey;
      unite: string;
      offresMagasins: Record<string, any>;
      prixActuel: Record<string, any>;
      historiqueOffres: any[];
      historiquePrix: any[];
      sourceDocIds: Set<string>;
    }>();

    const obsoleteDocIds = new Set<string>();

    const registerOffer = (
      rawName: string,
      brand: string,
      rawCategory: string | undefined,
      storeIdInput: string,
      storeNameInput: string,
      unitPrice: number,
      pricePaid: number,
      unit: string,
      format: string,
      date: string,
      receiptId: string,
      quantity: number,
      sourceDocId?: string
    ) => {
      if (!(unitPrice > 0) || Number.isNaN(unitPrice)) return;
      const canonical = normalizeProductNeed(rawName, brand);
      if (canonical.isInvalidArtifact) {
        if (sourceDocId) obsoleteDocIds.add(sourceDocId);
        return;
      }

      const resolvedStore = resolvePhysicalStore({ storeName: storeNameInput || storeIdInput });
      const stId = resolvedStore.id || storeIdInput;
      const stName = resolvedStore.displayName;
      if (!stName || stName === 'Supermarché') return;

      const aisle = normalizeAisle(
        canonical.rayon || rawCategory || classifyItemAisle(canonical.nom_affichage, rawName)
      );

      if (!canonicalGroups.has(canonical.id)) {
        canonicalGroups.set(canonical.id, {
          canonicalId: canonical.id,
          nomGenerique: canonical.nom_affichage,
          rayon: aisle.label,
          rayonCle: aisle.key,
          unite: unit || 'piece',
          offresMagasins: {},
          prixActuel: {},
          historiqueOffres: [],
          historiquePrix: [],
          sourceDocIds: new Set<string>()
        });
      }

      const group = canonicalGroups.get(canonical.id)!;
      if (canonical.rayon) {
        const forcedAisle = normalizeAisle(canonical.rayon);
        group.rayon = forcedAisle.label;
        group.rayonCle = forcedAisle.key;
      }
      if (sourceDocId) {
        group.sourceDocIds.add(sourceDocId);
        if (sourceDocId !== canonical.id) {
          obsoleteDocIds.add(sourceDocId);
        }
      }

      const existingOffer = group.offresMagasins[stId];
      const safeDate = date || new Date().toISOString().slice(0, 10);

      if (
        !existingOffer ||
        safeDate > existingOffer.date ||
        (safeDate === existingOffer.date && unitPrice < existingOffer.prix_unitaire)
      ) {
        group.offresMagasins[stId] = {
          prix_unitaire: Number(unitPrice.toFixed(2)),
          unite: unit || group.unite || 'piece',
          prix_paye: Number((pricePaid || unitPrice).toFixed(2)),
          marque: brand || 'Générique',
          format: format || '1 piece',
          date: safeDate,
          magasin_nom: stName,
          magasin_id: stId,
          receiptId: receiptId || '',
          rawName: rawName || canonical.nom_affichage
        };

        group.prixActuel[stId] = {
          prix_unitaire: Number(unitPrice.toFixed(2)),
          prix_paye: Number((pricePaid || unitPrice).toFixed(2)),
          quantite: quantity || 1,
          date: safeDate,
          magasin_id: stId,
          magasin_nom: stName,
          receiptId: receiptId || ''
        };
      }

      const histDuplicate = group.historiquePrix.some(
        h => h.date === safeDate && h.magasin === stId && Math.abs(h.prix_unitaire - unitPrice) < 0.01
      );
      if (!histDuplicate) {
        group.historiquePrix.push({
          date: safeDate,
          magasin: stId,
          magasin_nom: stName,
          prix_unitaire: Number(unitPrice.toFixed(2)),
          prix_paye: Number((pricePaid || unitPrice).toFixed(2)),
          quantite: quantity || 1,
          receiptId: receiptId || ''
        });
        group.historiqueOffres.push({
          prix_unitaire: Number(unitPrice.toFixed(2)),
          unite: unit || 'piece',
          prix_paye: Number((pricePaid || unitPrice).toFixed(2)),
          marque: brand || 'Générique',
          format: format || '1 piece',
          date: safeDate,
          magasin: stId,
          magasin_nom: stName,
          magasin_id: stId,
          receiptId: receiptId || ''
        });
      }
    };

    // A. Parcourir d'abord tous les tickets existants (source de vérité complète)
    receipts.forEach(r => {
      const resolvedStore = resolvePhysicalStore({
        storeName: r.storeName,
        storeAddress: r.storeAddress,
        storePostalCode: r.storePostalCode,
        storeCity: r.storeCity
      });
      const stId = r.storeId || resolvedStore.id;
      const stName = resolvedStore.displayName;

      (r.items || []).forEach(it => {
        const pricePaid = Number(it.pricePaid ?? it.price) || 0;
        const comp = computeUnitPrice(pricePaid, it.weightOrVolume, it.quantity, it.weightOrVolumeValue, it.weightOrVolumeUnit);
        const unitPrice = Number(it.unitPrice) > 0 ? Number(it.unitPrice) : comp.unitPrice;
        registerOffer(
          it.nomGenerique || it.normalizedName || it.rawName,
          it.brand || 'Générique',
          it.category,
          stId,
          stName,
          unitPrice,
          pricePaid,
          it.unit || comp.unit || 'piece',
          it.weightOrVolume || '1 piece',
          r.date,
          r.id,
          it.quantity || 1
        );
      });
    });

    // B. Parcourir les documents existants dans `users/{accountId}/products`
    snapshot.docs.forEach(docSnap => {
      const d = docSnap.data() as any;
      const docId = docSnap.id;
      const rawName = d.nom_generique || d.nom_generique_nettoye || d.cle_besoin || d.superKey || docId;
      const canonical = normalizeProductNeed(rawName, d.marque);

      if (canonical.isInvalidArtifact) {
        obsoleteDocIds.add(docId);
        return;
      }

      if (docId !== canonical.id) {
        obsoleteDocIds.add(docId);
      }

      let hasValidOffer = false;
      if (d.offres_magasins && typeof d.offres_magasins === 'object') {
        Object.entries(d.offres_magasins).forEach(([stId, off]: [string, any]) => {
          if (off && Number(off.prix_unitaire) > 0) {
            hasValidOffer = true;
            registerOffer(
              rawName,
              off.marque || d.marque || 'Générique',
              d.rayon || d.rayon_assigne,
              off.magasin_id || stId,
              off.magasin_nom || stId,
              Number(off.prix_unitaire),
              Number(off.prix_paye) || Number(off.prix_unitaire),
              off.unite || d.unite_mesure || 'piece',
              off.format || d.poids_ou_volume || '1 piece',
              off.date || '',
              off.receiptId || '',
              1,
              docId
            );
          }
        });
      } else if (d.prix_actuel && typeof d.prix_actuel === 'object') {
        Object.entries(d.prix_actuel).forEach(([stId, pa]: [string, any]) => {
          if (pa && Number(pa.prix_unitaire) > 0) {
            hasValidOffer = true;
            registerOffer(
              rawName,
              d.marque || 'Générique',
              d.rayon || d.rayon_assigne,
              pa.magasin_id || stId,
              pa.magasin_nom || stId,
              Number(pa.prix_unitaire),
              Number(pa.prix_paye) || Number(pa.prix_unitaire),
              d.unite_mesure || 'piece',
              d.poids_ou_volume || '1 piece',
              pa.date || '',
              pa.receiptId || '',
              pa.quantite || 1,
              docId
            );
          }
        });
      }

      if (!hasValidOffer) {
        obsoleteDocIds.add(docId);
      }
    });

    // 2. Écriture par lots Firestore (max 400 opérations par batch)
    const nowIso = new Date().toISOString();
    let batch = writeBatch(db);
    let opCount = 0;
    let mergedGroups = 0;
    let deletedDocs = 0;
    const newProductsState: StandardizedProductDoc[] = [];

    const commitIfFull = async () => {
      if (opCount >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      }
    };

    for (const [canonicalId, group] of canonicalGroups.entries()) {
      const offerEntries = Object.entries(group.offresMagasins);
      if (offerEntries.length === 0) continue;

      const sortedOffers = [...offerEntries].sort((a, b) => a[1].prix_unitaire - b[1].prix_unitaire);
      const best = sortedOffers[0][1];
      const worst = sortedOffers[sortedOffers.length - 1][1];

      const cleanDoc: any = {
        superKey: canonicalId,
        cle_besoin: canonicalId,
        nom_generique: group.nomGenerique,
        nom_generique_nettoye: group.nomGenerique,
        rayon: group.rayon,
        rayon_assigne: group.rayon,
        rayon_cle: group.rayonCle,
        marque: best.marque || 'Générique',
        poids_ou_volume: best.format || '1 piece',
        unite_mesure: group.unite || 'piece',
        offres_magasins: group.offresMagasins,
        prix_actuel: group.prixActuel,
        historique_offres: group.historiqueOffres.sort((a, b) => a.date.localeCompare(b.date)),
        historique_prix: group.historiquePrix.sort((a, b) => a.date.localeCompare(b.date)),
        meilleure_offre: {
          magasin_id: best.magasin_id,
          magasin_nom: best.magasin_nom,
          prix_unitaire: best.prix_unitaire,
          unite: best.unite
        },
        pire_offre: {
          magasin_id: worst.magasin_id,
          magasin_nom: worst.magasin_nom,
          prix_unitaire: worst.prix_unitaire,
          unite: worst.unite
        },
        ecart_prix_max: Number((worst.prix_unitaire - best.prix_unitaire).toFixed(2)),
        derniere_mise_a_jour: nowIso,
        nombre_releves: group.historiquePrix.length
      };

      const targetRef = doc(db, `users/${accountId}/products/${canonicalId}`);
      batch.set(targetRef, cleanDoc);
      opCount++;
      mergedGroups++;
      newProductsState.push(cleanDoc as StandardizedProductDoc);
      await commitIfFull();
    }

    for (const obsoleteId of obsoleteDocIds) {
      if (!canonicalGroups.has(obsoleteId)) {
        const delRef = doc(db, `users/${accountId}/products/${obsoleteId}`);
        batch.delete(delRef);
        opCount++;
        deletedDocs++;
        await commitIfFull();
      }
    }

    if (opCount > 0) {
      await batch.commit();
    }

    setProducts(newProductsState);
    try {
      localStorage.setItem(CACHE_KEY_PRODUCTS, JSON.stringify(newProductsState));
      localStorage.setItem('cashpilot_canonical_migration_v3_done', 'true');
    } catch {}

    return {
      mergedGroups,
      deletedDocs,
      totalProducts: newProductsState.length
    };
  }, [receipts]);

  // Exécution automatique unique en arrière-plan pour nettoyer les 20 tickets existants dès l'ouverture
  useEffect(() => {
    if (!isRealtimeSynced || receipts.length === 0) return;
    const alreadyDone = localStorage.getItem('cashpilot_canonical_migration_v3_done');
    if (alreadyDone === 'true') return;

    harmonizeAndCleanDatabase().catch(err => {
      console.warn('Harmonisation automatique en arrière-plan:', err);
    });
  }, [isRealtimeSynced, receipts.length, harmonizeAndCleanDatabase]);

  const value: ReceiptsContextType = {
    receipts,
    products,
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
    extractReceipt,
    harmonizeAndCleanDatabase
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
