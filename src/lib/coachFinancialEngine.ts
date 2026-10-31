import type { Transaction, CostOfLivingExpenseItem, CustomUserRule } from './kpiUtils.ts';
import { enrichTransactionFallback, DEFAULT_COST_OF_LIVING_ITEMS, getCustomUserRules } from './kpiUtils.ts';
import type { Receipt, StandardizedProductDoc } from '../types/receipts.ts';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const COACH_MAX_OUTPUT_TOKENS = 8192;

export function getGeminiModelName(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('cashpilot_gemini_model');
    if (saved && !saved.includes('2.0') && !saved.includes('1.5') && saved !== 'gemini-2.5-flash-lite') {
      return saved;
    }
    // Nettoyage automatique des anciens modèles dépréciés / 404
    localStorage.setItem('cashpilot_gemini_model', 'gemini-3.5-flash');
  }
  return 'gemini-3.5-flash';
}

export function getGeminiApiKey(): string {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const userKey = localStorage.getItem('cashpilot_gemini_api_key');
      if (userKey && userKey.trim()) {
        return userKey.trim();
      }
    }
  } catch (e) {}
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY) {
      return (import.meta as any).env.VITE_GEMINI_API_KEY;
    }
  } catch (e) {}
  try {
    if (typeof process !== 'undefined' && process.env?.VITE_GEMINI_API_KEY) {
      return process.env.VITE_GEMINI_API_KEY;
    }
  } catch (e) {}
  return '';
}

export interface CategorySummary {
  category: string;
  total: number;
  percentage: number;
  count: number;
}

export interface Rule503020Bucket {
  name: string;
  actual: number;
  percentage: number;
  targetPercentage: number;
  targetAmount: number;
  difference: number;
  categories: { name: string; amount: number }[];
  status: 'optimal' | 'warning' | 'alert';
}

export interface Rule503020Summary {
  totalIncome: number;
  totalExpenses: number;
  needs: Rule503020Bucket;     // Besoins (50%)
  wants: Rule503020Bucket;     // Envies (30%)
  savings: Rule503020Bucket;   // Épargne (20%)
  diagnostic: string;
  advice: string[];
}

export interface FinancialProfile {
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRate: number;
  transactionCount: number;
  dateRange: { start: string; end: string } | null;
  topCategories: CategorySummary[];
  topSingleExpenses: { date: string; label: string; category: string; amount: number }[];
  subscriptions: { label: string; category: string; amount: number; annual: number }[];
  rule503020: Rule503020Summary;
  receiptsSummary: {
    receiptCount: number;
    totalReceiptSpend: number;
    stores: { store: string; total: number; count: number }[];
    topProducts: { name: string; price: number; store: string; date: string }[];
  };
}

/**
 * Types du Système d'Actions Administrateur Sécurisées (Chantier 3)
 */
export type AdminActionType =
  | 'UPDATE_TRANSACTION'
  | 'DELETE_TRANSACTION'
  | 'DELETE_STATEMENT_PERIOD'
  | 'UPDATE_RECEIPT'
  | 'DELETE_RECEIPT'
  | 'UPDATE_BUDGET'
  | 'CREATE_CUSTOM_RULE';

export type AdminTargetType =
  | 'transaction'
  | 'statement'
  | 'receipt'
  | 'budget'
  | 'subscription_rule';

export interface ProposedAdminAction {
  id: string;
  actionType: AdminActionType;
  targetType: AdminTargetType;
  targetId: string;
  title: string;
  description: string;
  oldValues: Record<string, string | number>;
  newValues: Record<string, string | number>;
  payload: Record<string, any>;
  status: 'pending' | 'validated' | 'cancelled' | 'undone';
  executedAt?: string;
  undoneAt?: string;
  archiveId?: string;
}

export interface ArchivedItemRecord {
  id: string;
  targetType: AdminTargetType;
  targetId: string;
  title: string;
  subtitle: string;
  deletedAt: string;
  actionType: AdminActionType;
  previousSnapshot: any;
  restoredAt?: string;
  isRestored?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  status?: 'sending' | 'done' | 'error';
  proposedAction?: ProposedAdminAction;
}

// Catégories attribuées aux Besoins (Fixes / Essentielles)
const NEEDS_CATEGORIES = new Set([
  'Logement', 'Loyer', 'Crédit immobilier', 'Énergie', 'Électricité', 'Gaz', 'Eau',
  'Charges', 'Charges & Factures', 'Assurances', 'Assurance', 'Télécom', 'Abonnements & Télécom',
  'Téléphonie', 'Internet', 'Alimentation & Supermarché', 'Courses', 'Supermarché', 'Alimentation & Courses',
  'Logement & Énergie', 'Santé', 'Pharmacie', 'Médecin', 'Mutuelle', 'Transports', 'Carburant', 'Essence',
  'Transports & Carburant', 'Transport en commun', 'Péage', 'Impôts', 'Taxes', 'Frais bancaires', 'Frais Bancaires'
]);

// Catégories attribuées aux Envies (Variables / Style de vie / Plaisirs)
const WANTS_CATEGORIES = new Set([
  'Restaurants & Sorties', 'Restaurants', 'Bars', 'Sorties', 'Loisirs & Culture', 'Loisirs & Activités',
  'Loisirs', 'Culture', 'Shopping & Vêtements', 'Shopping & Maison', 'Shopping', 'Mode', 'Vêtements',
  'Voyages & Vacances', 'Voyages', 'Vacances', 'Cadeaux', 'Livraisons repas', 'Uber',
  'High-Tech', 'Jeux Vidéo', 'Divertissement', 'Beauté & Bien-être', 'Coiffeur'
]);

// Catégories attribuées à l'Épargne & Investissement
const SAVINGS_CATEGORIES = new Set([
  'Épargne', 'Epargne', 'Épargne & Investissement', 'Investissements', 'Placements', 'PEA', 'Livret A', 'Crypto',
  'Assurance Vie', 'Remboursement de crédit'
]);

/**
 * Compile le profil financier complet et déterministe à partir des transactions et tickets
 */
export function buildFinancialProfile(
  transactions: Transaction[],
  receipts: Receipt[] = [],
  _products: StandardizedProductDoc[] = [],
  _currency: 'EUR' | 'CHF' = 'EUR'
): FinancialProfile {
  let totalIncome = 0;
  let totalExpenses = 0;
  const categoryTotals: Record<string, { total: number; count: number }> = {};
  const singleDebits: { date: string; label: string; category: string; amount: number }[] = [];
  const subsMap: Map<string, { label: string; category: string; amount: number }> = new Map();

  const needsCatTotals: Record<string, number> = {};
  const wantsCatTotals: Record<string, number> = {};
  const savingsCatTotals: Record<string, number> = {};

  let needsTotal = 0;
  let wantsTotal = 0;
  let savingsTotal = 0;

  const validDates: string[] = [];

  const activeTransactions = transactions.filter(t => !t.isArchived);
  const activeReceipts = receipts.filter((r: any) => !r.isArchived);

  activeTransactions.forEach(rawTx => {
    const tx = enrichTransactionFallback(rawTx);
    const amt = Number(tx.amount) || 0;
    const absAmt = Math.abs(amt);
    const date = tx.date || '';
    if (date) validDates.push(date);

    // Neutraliser les virements internes entre comptes courants (mais conserver les transferts d'épargne comme Livret A / PEA pour la règle 50/30/20)
    const isSavingsTransfer = tx.category?.toLowerCase().includes('épargne') || 
                              tx.category?.toLowerCase().includes('epargne') || 
                              tx.cleanLabel?.toLowerCase().includes('livret') ||
                              tx.rawLabel?.toLowerCase().includes('livret');

    const isPureInternalTransfer = (tx.isInternalTransfer || 
                                    tx.category === 'Virements internes' || 
                                    tx.category === 'Virements Internes') && !isSavingsTransfer;

    if (
      isPureInternalTransfer ||
      tx.category === 'Remboursement Carte (Amex)' ||
      (tx.isInstallment && tx.category === 'Paiement fractionné') ||
      tx.isStartingBalance ||
      tx.category === 'Solde de départ'
    ) {
      return;
    }

    const category = tx.category || 'Autres dépenses';
    const label = tx.cleanLabel || tx.rawLabel || tx.description || 'Opération';

    if (amt > 0) {
      if (tx.category !== 'Remboursements' && tx.category !== 'Remboursements/Avances' && tx.category !== 'Solidarité') {
        totalIncome += amt;
      }
    } else if (amt < 0) {
      const isSaving = SAVINGS_CATEGORIES.has(category) || tx.category?.toLowerCase().includes('épargne');

      if (isSaving) {
        savingsTotal += absAmt;
        savingsCatTotals[category] = (savingsCatTotals[category] || 0) + absAmt;
      } else {
        totalExpenses += absAmt;

        if (!categoryTotals[category]) {
          categoryTotals[category] = { total: 0, count: 0 };
        }
        categoryTotals[category].total += absAmt;
        categoryTotals[category].count += 1;

        singleDebits.push({
          date,
          label,
          category,
          amount: absAmt
        });

        // Abonnements récurrents (séparation par libellé + montant pour éviter de fusionner 2 contrats distincts ex: Google 2.99 vs 10.99)
        if (tx.isSubscription || category.includes('Abonnement') || tx.nature === 'fixe') {
          const isAggregator = label.toLowerCase().includes('google') || label.toLowerCase().includes('apple');
          const key = isAggregator ? `${label.toLowerCase().trim()}__${absAmt.toFixed(2)}` : label.toLowerCase().trim();
          const displayLabel = isAggregator ? `${label} (${absAmt.toFixed(2)} €)` : label;
          if (!subsMap.has(key) || absAmt > subsMap.get(key)!.amount) {
            subsMap.set(key, { label: displayLabel, category, amount: absAmt });
          }
        }

        // Classification 50/30/20 pour les dépenses
        if (WANTS_CATEGORIES.has(category) || (tx.nature === 'variable' && (category.includes('Restaurant') || category.includes('Sorties') || category.includes('Shopping') || category.includes('Loisirs')))) {
          wantsTotal += absAmt;
          wantsCatTotals[category] = (wantsCatTotals[category] || 0) + absAmt;
        } else if (NEEDS_CATEGORIES.has(category) || tx.nature === 'fixe') {
          needsTotal += absAmt;
          needsCatTotals[category] = (needsCatTotals[category] || 0) + absAmt;
        } else {
          if (tx.nature === 'fixe') {
            needsTotal += absAmt;
            needsCatTotals[category] = (needsCatTotals[category] || 0) + absAmt;
          } else {
            wantsTotal += absAmt;
            wantsCatTotals[category] = (wantsCatTotals[category] || 0) + absAmt;
          }
        }
      }
    }
  });

  validDates.sort();
  const dateRange = validDates.length > 0 ? { start: validDates[0], end: validDates[validDates.length - 1] } : null;

  const sortedCategories: CategorySummary[] = Object.entries(categoryTotals)
    .map(([cat, data]) => ({
      category: cat,
      total: Math.round(data.total * 100) / 100,
      percentage: totalExpenses > 0 ? Math.round((data.total / totalExpenses) * 1000) / 10 : 0,
      count: data.count
    }))
    .sort((a, b) => b.total - a.total);

  const topSingleExpenses = singleDebits
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  const subscriptions = Array.from(subsMap.values())
    .map(s => ({
      ...s,
      annual: Math.round(s.amount * 12 * 100) / 100
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 15);

  const baseRevenue = totalIncome > 0 ? totalIncome : totalExpenses;
  const needsTarget = Math.round(baseRevenue * 0.5 * 100) / 100;
  const wantsTarget = Math.round(baseRevenue * 0.3 * 100) / 100;
  const savingsTarget = Math.round(baseRevenue * 0.2 * 100) / 100;

  const needsPct = baseRevenue > 0 ? Math.round((needsTotal / baseRevenue) * 1000) / 10 : 0;
  const wantsPct = baseRevenue > 0 ? Math.round((wantsTotal / baseRevenue) * 1000) / 10 : 0;
  const savingsPct = baseRevenue > 0 ? Math.round((savingsTotal / baseRevenue) * 1000) / 10 : 0;

  const needsStatus: 'optimal' | 'warning' | 'alert' = needsPct <= 50 ? 'optimal' : needsPct <= 60 ? 'warning' : 'alert';
  const wantsStatus: 'optimal' | 'warning' | 'alert' = wantsPct <= 30 ? 'optimal' : wantsPct <= 38 ? 'warning' : 'alert';
  const savingsStatus: 'optimal' | 'warning' | 'alert' = savingsPct >= 20 ? 'optimal' : savingsPct >= 10 ? 'warning' : 'alert';

  let diagnostic = "Budget globalement structuré.";
  const advice: string[] = [];

  if (needsPct > 55) {
    diagnostic = `Vos charges incompressibles (Besoins) absorbent ${needsPct}% de vos flux, dépassant le plafond recommandé de 50%.`;
    advice.push("Renégociez vos contrats fixes (assurances, box/mobile, énergie) ou optimisez votre panier alimentaire.");
  }
  if (wantsPct > 35) {
    diagnostic += ` Vos dépenses discrétionnaires (Envies) à ${wantsPct}% dépassent la cible de 30%.`;
    advice.push("Fixez-vous une enveloppe hebdomadaire stricte pour les sorties et restaurants pour libérer du pouvoir d'épargne.");
  }
  if (savingsPct < 15) {
    advice.push("Mettez en place un virement automatique d'épargne le lendemain de la paie pour atteindre au moins 15-20%.");
  } else {
    advice.push("Excellente discipline d'épargne ! Pensez à diversifier vos excédents au-delà du simple livret bancaire.");
  }

  const rule503020: Rule503020Summary = {
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    needs: {
      name: 'Besoins (Charges Fixes & Vitales)',
      actual: Math.round(needsTotal * 100) / 100,
      percentage: needsPct,
      targetPercentage: 50,
      targetAmount: needsTarget,
      difference: Math.round((needsTotal - needsTarget) * 100) / 100,
      categories: Object.entries(needsCatTotals)
        .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }))
        .sort((a, b) => b.amount - a.amount),
      status: needsStatus
    },
    wants: {
      name: 'Envies (Plaisirs & Style de vie)',
      actual: Math.round(wantsTotal * 100) / 100,
      percentage: wantsPct,
      targetPercentage: 30,
      targetAmount: wantsTarget,
      difference: Math.round((wantsTotal - wantsTarget) * 100) / 100,
      categories: Object.entries(wantsCatTotals)
        .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }))
        .sort((a, b) => b.amount - a.amount),
      status: wantsStatus
    },
    savings: {
      name: 'Épargne & Investissement',
      actual: Math.round(savingsTotal * 100) / 100,
      percentage: savingsPct,
      targetPercentage: 20,
      targetAmount: savingsTarget,
      difference: Math.round((savingsTotal - savingsTarget) * 100) / 100,
      categories: Object.entries(savingsCatTotals)
        .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }))
        .sort((a, b) => b.amount - a.amount),
      status: savingsStatus
    },
    diagnostic,
    advice
  };

  // Analyse des tickets de caisse
  const storeMap: Record<string, { total: number; count: number }> = {};
  let totalReceiptSpend = 0;
  const rawProducts: { name: string; price: number; store: string; date: string }[] = [];

  activeReceipts.forEach(r => {
    const sName = r.storeName || 'Supermarché';
    const amt = Number(r.totalAmount) || 0;
    totalReceiptSpend += amt;
    if (!storeMap[sName]) storeMap[sName] = { total: 0, count: 0 };
    storeMap[sName].total += amt;
    storeMap[sName].count += 1;

    if (Array.isArray(r.items)) {
      r.items.forEach(it => {
        rawProducts.push({
          name: (it as any).cleanName || it.normalizedName || it.rawName || (it as any).name || 'Article',
          price: Number(it.pricePaid) || Number(it.unitPrice) || 0,
          store: sName,
          date: r.date || ''
        });
      });
    }
  });

  const stores = Object.entries(storeMap)
    .map(([store, d]) => ({ store, total: Math.round(d.total * 100) / 100, count: d.count }))
    .sort((a, b) => b.total - a.total);

  const topProducts = rawProducts
    .sort((a, b) => b.price - a.price)
    .slice(0, 10);

  const netSavings = Math.round((totalIncome - totalExpenses) * 100) / 100;
  const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 1000) / 10 : 0;

  return {
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    netSavings,
    savingsRate,
    transactionCount: activeTransactions.length,
    dateRange,
    topCategories: sortedCategories,
    topSingleExpenses,
    subscriptions,
    rule503020,
    receiptsSummary: {
      receiptCount: activeReceipts.length,
      totalReceiptSpend: Math.round(totalReceiptSpend * 100) / 100,
      stores,
      topProducts
    }
  };
}

/**
 * Filtre les dépenses d'une période précise (ex: du YYYY-MM-DD au YYYY-MM-DD)
 */
export function filterExpensesByDateRange(
  transactions: Transaction[],
  startDateStr: string,
  endDateStr: string
): { transactions: Transaction[]; total: number; count: number } {
  const parseDate = (s: string) => {
    if (!s) return null;
    const clean = s.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return new Date(clean);
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(clean)) {
      const [d, m, y] = clean.split('/').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date(clean);
  };

  const start = parseDate(startDateStr);
  const end = parseDate(endDateStr);

  const matched = transactions.filter(t => {
    if (t.isArchived) return false;
    const amt = Number(t.amount) || 0;
    if (amt >= 0) return false;
    if (!t.date) return false;
    const d = parseDate(t.date);
    if (!d || isNaN(d.getTime())) return false;
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  });

  const total = matched.reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0);

  return {
    transactions: matched.sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    total: Math.round(total * 100) / 100,
    count: matched.length
  };
}

/**
 * Récupère les budgets actuels de la section "Budget & Coût de la vie"
 */
export function getActiveCostOfLivingBudgets(): CostOfLivingExpenseItem[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('cashpilot_cost_of_living_v2') || localStorage.getItem('cashpilot_cost_of_living');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch {}
  return DEFAULT_COST_OF_LIVING_ITEMS;
}

/**
 * CHANTIER 2 : Pré-Audit Déterministe Intelligent sur les produits / rayons des tickets de caisse
 * Garantit une réponse complète en 2 parties (Synthèse directe + Tableau Markdown) sans aucune troncature.
 */
export interface ProductQueryPreAudit {
  matchedKeyword: string;
  itemCount: number;
  averageUnitPrice: number;
  cheapestPrice: number;
  cheapestStore: string;
  cheapestItemName: string;
  totalSpent: number;
  markdownTable: string;
  directSynthesisText: string;
  rows: Array<{
    date: string;
    store: string;
    productAndBrand: string;
    quantity: number;
    unitPrice: number;
    totalPaid: number;
  }>;
}

const PRODUCT_FAMILY_SYNONYMS: Record<string, string[]> = {
  pain: ['pain', 'baguette', 'mie', 'brioche', 'campagne', 'croustille', 'tradition', 'boulangerie', 'viennoiserie', 'croissant'],
  fruit: ['fruit', 'fruits', 'banane', 'pomme', 'poire', 'orange', 'clémentine', 'mandarine', 'fraise', 'framboise', 'melon', 'pastèque', 'ananas', 'raisin', 'kiwi', 'pêche', 'nectarine', 'abricot', 'citron', 'mangue', 'avocat', 'fruits & légumes'],
  legume: ['légume', 'legume', 'légumes', 'legumes', 'tomate', 'carotte', 'salade', 'batavia', 'concombre', 'courgette', 'aubergine', 'poivron', 'oignon', 'pomme de terre', 'patate', 'haricot', 'brocoli', 'chou', 'épinard', 'champignon'],
  lait: ['lait', 'demi-écrémé', 'écrémé', 'entier', 'lactel', 'candia', 'delactose'],
  oeuf: ['oeuf', 'oeufs', 'œuf', 'œufs', 'ufs'],
  viande: ['viande', 'poulet', 'dinde', 'volaille', 'boeuf', 'bœuf', 'steak', 'haché', 'lardon', 'jambon', 'saucisse', 'merguez', 'boucherie', 'veau', 'agneau'],
  poisson: ['poisson', 'saumon', 'thon', 'colin', 'cabillaud', 'crevette', 'crevettes', 'poissonnerie', 'sardine', 'maquereau'],
  fromage: ['fromage', 'emmental', 'comté', 'mozzarella', 'chèvre', 'camembert', 'brie', 'raclette', 'parmesan', 'râpé', 'crèmerie'],
  yaourt: ['yaourt', 'yaourts', 'fromage blanc', 'petit suisse', 'danone', 'skyr', 'dessert lacté'],
  boisson: ['boisson', 'boissons', 'eau', 'jus', 'soda', 'coca', 'sirop', 'cristaline', 'evian', 'vittel', 'multifruits'],
  cafe: ['café', 'cafe', 'expresso', 'dosette', 'capsule', 'nescafe', 'carte noire', 'lavazza', 'l or'],
  pate: ['pâte', 'pâtes', 'spaghetti', 'coquillette', 'penne', 'tagliatelle', 'macaroni', 'barilla', 'panzani'],
  riz: ['riz', 'basmati', 'thaï', 'taureau ailé', 'uncle ben'],
  huile: ['huile', 'olive', 'tournesol', 'colza', 'lesieur', 'puget'],
  beurre: ['beurre', 'président', 'paysan breton', 'margarine']
};

export function buildProductQueryPreAudit(
  userPrompt: string,
  receipts: Receipt[],
  currency: string = 'EUR'
): ProductQueryPreAudit | null {
  const sym = currency === 'CHF' ? 'CHF' : '€';
  const normPrompt = (userPrompt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Détecter si la question porte sur le prix / l'achat d'un produit ou rayon
  const isProductQuestion =
    normPrompt.includes('combien') ||
    normPrompt.includes('prix') ||
    normPrompt.includes('achete') ||
    normPrompt.includes('acheter') ||
    normPrompt.includes('coute') ||
    normPrompt.includes('coutent') ||
    normPrompt.includes('paye') ||
    normPrompt.includes('depense') ||
    normPrompt.includes('historique') ||
    normPrompt.includes('compar');

  if (!isProductQuestion || !receipts || receipts.length === 0) return null;

  // Identifier la famille ou le mot-clé recherché
  let targetKeywords: string[] = [];
  let matchedLabel = '';

  for (const [familyKey, synonyms] of Object.entries(PRODUCT_FAMILY_SYNONYMS)) {
    const normSynonyms = synonyms.map(s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
    if (normSynonyms.some(s => normPrompt.includes(s))) {
      targetKeywords = normSynonyms;
      matchedLabel = synonyms[0];
      // Cas spécifique "fruits" sans "légumes" : cibler les fruits et le rayon Fruits & Légumes
      if (familyKey === 'fruit' && !normPrompt.includes('legume')) {
        matchedLabel = 'fruits';
      } else if (familyKey === 'pain') {
        matchedLabel = 'pain & boulangerie';
      }
      break;
    }
  }

  // Si aucune famille prédéfinie, extraire un nom de produit significatif de la question
  if (targetKeywords.length === 0) {
    const stopWords = new Set([
      'combien', 'quel', 'quelle', 'quels', 'quelles', 'est', 'sont', 'le', 'la', 'les', 'mes', 'mon', 'ma',
      'des', 'du', 'de', 'dans', 'sur', 'pour', 'avec', 'sans', 'chez', 'prix', 'coute', 'coutent', 'achete',
      'acheter', 'paye', 'payer', 'depense', 'depenses', 'ticket', 'tickets', 'caisse', 'courses', 'magasin',
      'enseigne', 'moyen', 'total', 'tableau', 'liste', 'moi', 'donne', 'fais', 'analyse', 'repond', 'question'
    ]);
    const words = normPrompt
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !stopWords.has(w));

    if (words.length > 0) {
      targetKeywords = words;
      matchedLabel = words.join(' ');
    }
  }

  if (targetKeywords.length === 0) return null;

  const activeReceipts = receipts.filter((r: any) => !r.isArchived);
  const rows: ProductQueryPreAudit['rows'] = [];

  // Liste d'exclusion si l'utilisateur demande spécifiquement "fruits" (exclure les légumes purs s'il demande uniquement les fruits, tout en gardant les fruits)
  const isStrictFruitQuery = normPrompt.includes('fruit') && !normPrompt.includes('legume');
  const pureVegetables = ['concombre', 'salade', 'batavia', 'carotte', 'oignon', 'pomme de terre', 'frite', 'courgette', 'aubergine', 'poivron', 'haricot', 'brocoli', 'chou', 'epinard', 'champignon', 'ail', 'echalote', 'poireau', 'celeri', 'radis', 'navet', 'mais'];

  activeReceipts.forEach(rcpt => {
    const store = rcpt.storeName || 'Supermarché';
    const date = rcpt.date || 'N/A';
    if (!Array.isArray(rcpt.items)) return;

    rcpt.items.forEach(it => {
      const cleanName = (it as any).cleanName || it.normalizedName || (it as any).nomGenerique || it.rawName || (it as any).name || 'Article';
      const rawName = it.rawName || (it as any).name || '';
      const brand = it.brand || (it as any).marque || 'Générique';
      const category = it.category || '';
      const fullSearchText = `${cleanName} ${rawName} ${brand} ${category}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      const matches = targetKeywords.some(kw => fullSearchText.includes(kw));
      if (!matches) return;

      if (isStrictFruitQuery) {
        const nameLower = `${cleanName} ${rawName}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (pureVegetables.some(veg => nameLower.includes(veg))) {
          return;
        }
      }

      const qty = Math.max(1, Number(it.quantity) || 1);
      const totalPaid = Number(it.pricePaid ?? it.price) || (Number(it.unitPrice) || 0) * qty;
      const unitPrice = Number(it.unitPrice) > 0 ? Number(it.unitPrice) : totalPaid / qty;
      const format = it.weightOrVolume || (it as any).formatExact ? ` [${it.weightOrVolume || (it as any).formatExact}]` : '';
      const brandLabel = brand && brand.toLowerCase() !== 'générique' && brand.toLowerCase() !== 'generique' ? ` (${brand})` : ' (Générique)';

      rows.push({
        date,
        store,
        productAndBrand: `${cleanName}${brandLabel}${format}`,
        quantity: qty,
        unitPrice: Math.round(unitPrice * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100
      });
    });
  });

  if (rows.length === 0) return null;

  // Trier par date décroissante
  rows.sort((a, b) => b.date.localeCompare(a.date));

  const totalSpent = Math.round(rows.reduce((acc, r) => acc + r.totalPaid, 0) * 100) / 100;
  const averageUnitPrice = Math.round((rows.reduce((acc, r) => acc + r.unitPrice, 0) / rows.length) * 100) / 100;

  let cheapestRow = rows[0];
  for (const r of rows) {
    if (r.unitPrice > 0 && r.unitPrice < cheapestRow.unitPrice) {
      cheapestRow = r;
    }
  }

  const header = `| Date | Enseigne | Produit & Marque | Quantité | Prix unitaire (${sym}) | Prix total payé (${sym}) |\n| :--- | :--- | :--- | :---: | :---: | :---: |`;
  const tableLines = rows.map(
    r => `| ${r.date} | ${r.store} | ${r.productAndBrand} | ${r.quantity} | ${r.unitPrice.toFixed(2)} ${sym} | **${r.totalPaid.toFixed(2)} ${sym}** |`
  );
  const totalFooter = `| **TOTAL** | **${rows.length} achats** | — | **${rows.reduce((acc, r) => acc + r.quantity, 0)}** | **Moy: ${averageUnitPrice.toFixed(2)} ${sym}** | **${totalSpent.toFixed(2)} ${sym}** |`;

  const markdownTable = `${header}\n${tableLines.join('\n')}\n${totalFooter}`;

  const directSynthesisText = `Vous achetez vos **${matchedLabel}** au prix unitaire moyen de **${averageUnitPrice.toFixed(2)} ${sym}**, avec le tarif le moins cher constaté à **${cheapestRow.unitPrice.toFixed(2)} ${sym}** chez **${cheapestRow.store}** (${cheapestRow.productAndBrand}), pour un montant total dépensé de **${totalSpent.toFixed(2)} ${sym}** sur la période.`;

  return {
    matchedKeyword: matchedLabel,
    itemCount: rows.length,
    averageUnitPrice,
    cheapestPrice: cheapestRow.unitPrice,
    cheapestStore: cheapestRow.store,
    cheapestItemName: cheapestRow.productAndBrand,
    totalSpent,
    markdownTable,
    directSynthesisText,
    rows
  };
}

/**
 * Filet de sécurité anti-troncature (Chantier 2) :
 * Si l'IA a généré un début de tableau tronqué ou incomplet, complète automatiquement avec le tableau complet.
 */
export function ensureCompleteAuditResponse(
  rawText: string,
  preAudit: ProductQueryPreAudit | null
): string {
  const cleaned = (rawText || '').trim();
  if (!preAudit) return cleaned;

  // Vérifier si la réponse contient un tableau Markdown complet (au moins l'en-tête + séparateur + 1 ligne de données complète)
  const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);
  const tableLines = lines.filter(l => l.startsWith('|'));

  // Cas 1 : Le texte se termine brutalement sur une ligne d'en-tête de tableau incomplète (ex: "| Date | Enseigne | Produit & Marque")
  const lastLine = lines[lines.length - 1] || '';
  const isTruncatedTableHeader =
    (lastLine.startsWith('|') && (lastLine.includes('Date') || lastLine.includes('Enseigne') || lastLine.includes('---'))) ||
    tableLines.length <= 2;

  if (isTruncatedTableHeader) {
    // Retirer les lignes de tableau incomplètes à la fin
    const nonTableIntroLines = lines.filter(l => !l.startsWith('|'));
    const intro = nonTableIntroLines.length > 0
      ? nonTableIntroLines.join('\n\n')
      : preAudit.directSynthesisText;

    return `${intro}\n\n${preAudit.markdownTable}`;
  }

  return cleaned;
}

/**
 * Construit le prompt système contenant l'intégralité de la base de données financière
 * (Datawarehouse Relevés Bancaires + Tickets + Articles + Budgets + Règles Personnalisées)
 */
export function buildCoachSystemContext(
  profile: FinancialProfile,
  transactions: Transaction[],
  receiptsOrCurrency?: Receipt[] | string,
  products?: StandardizedProductDoc[],
  currency: string = 'EUR',
  userPromptForPreAudit?: string
): string {
  let receipts: Receipt[] = [];
  let sym = currency === 'CHF' ? 'CHF' : '€';

  if (typeof receiptsOrCurrency === 'string') {
    sym = receiptsOrCurrency === 'CHF' ? 'CHF' : '€';
  } else if (Array.isArray(receiptsOrCurrency)) {
    receipts = receiptsOrCurrency.filter((r: any) => !r.isArchived);
    sym = currency === 'CHF' ? 'CHF' : '€';
  }

  const activeTransactions = transactions.filter(t => !t.isArchived);

  // Formatage du top des catégories
  const topCatsText = profile.topCategories
    .slice(0, 10)
    .map((c, i) => `${i + 1}. **${c.category}** : ${c.total.toFixed(2)} ${sym} (${c.percentage}% du total des dépenses, ${c.count} opérations)`)
    .join('\n');

  // Formatage de la règle 50/30/20
  const r = profile.rule503020;
  const rule503020Text = `
- **Besoins (Cible 50%)** : Actuel = ${r.needs.actual.toFixed(2)} ${sym} (${r.needs.percentage}%) | Cible idéale = ${r.needs.targetAmount.toFixed(2)} ${sym} | Écart = ${r.needs.difference > 0 ? '+' : ''}${r.needs.difference.toFixed(2)} ${sym} (Statut : ${r.needs.status.toUpperCase()})
  Principaux postes : ${r.needs.categories.slice(0, 4).map(c => `${c.name}: ${c.amount.toFixed(2)} ${sym}`).join(', ')}
- **Envies (Cible 30%)** : Actuel = ${r.wants.actual.toFixed(2)} ${sym} (${r.wants.percentage}%) | Cible idéale = ${r.wants.targetAmount.toFixed(2)} ${sym} | Écart = ${r.wants.difference > 0 ? '+' : ''}${r.wants.difference.toFixed(2)} ${sym} (Statut : ${r.wants.status.toUpperCase()})
  Principaux postes : ${r.wants.categories.slice(0, 4).map(c => `${c.name}: ${c.amount.toFixed(2)} ${sym}`).join(', ')}
- **Épargne (Cible 20%)** : Actuel = ${r.savings.actual.toFixed(2)} ${sym} (${r.savings.percentage}%) | Cible idéale = ${r.savings.targetAmount.toFixed(2)} ${sym} | Écart = ${r.savings.difference > 0 ? '+' : ''}${r.savings.difference.toFixed(2)} ${sym} (Statut : ${r.savings.status.toUpperCase()})
  Principaux postes : ${r.savings.categories.slice(0, 3).map(c => `${c.name}: ${c.amount.toFixed(2)} ${sym}`).join(', ') || 'Aucune épargne explicite détectée'}
Diagnostic du Coach : ${r.diagnostic}
Conseils clés : ${r.advice.join(' | ')}
`;

  // Formatage des abonnements
  const subsText = profile.subscriptions.length > 0
    ? profile.subscriptions.map(s => `- **${s.label}** (${s.category}) : ${s.amount.toFixed(2)} ${sym}/mois (~${s.annual.toFixed(2)} ${sym}/an)`).join('\n')
    : 'Aucun abonnement récurrent détecté.';

  // Formatage des budgets "Budget & Coût de la vie"
  const currentBudgets = getActiveCostOfLivingBudgets();
  const budgetsText = currentBudgets
    .map(b => `- [ID: ${b.id}] **${b.name}** (Groupe: ${b.categoryGroup}) : Budget alloué = **${(Number(b.amount) || 0).toFixed(2)} ${sym}/mois**`)
    .join('\n');

  // Formatage des règles personnalisées de l'utilisateur
  const customRules = getCustomUserRules();
  const customRulesText = customRules.length > 0
    ? customRules.map(cr => `- [RuleID: ${cr.id}] Mot-clé "${cr.pattern}"${cr.exactAmount ? ` (Montant exact: ${cr.exactAmount.toFixed(2)} ${sym})` : ''} => Libellé: **${cr.customLabel}** | Catégorie: **${cr.category}**${cr.budgetPostName ? ` | Poste Budget: ${cr.budgetPostName}` : ''}${cr.customNote ? ` | Note: ${cr.customNote}` : ''}`).join('\n')
    : 'Aucune règle personnalisée enregistrée pour le moment.';

  // 1. DATAWAREHOUSE EXHAUSTIF ET COMPACT DES TICKETS DE CAISSE ET ARTICLES
  let receiptsDataWarehouseSection = '';
  if (receipts && receipts.length > 0) {
    const storeBreakdown: Record<string, { total: number; count: number; dates: string[] }> = {};
    const detailedReceiptsLines: string[] = [];
    const allItemsLines: string[] = [];

    const sortedReceipts = [...receipts].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    sortedReceipts.forEach(rcpt => {
      const sName = rcpt.storeName || 'Magasin Inconnu';
      const tot = Number(rcpt.totalAmount) || 0;
      const d = rcpt.date || 'N/A';
      const tTime = rcpt.time ? ` à ${rcpt.time}` : '';
      const itemsCount = Array.isArray(rcpt.items) ? rcpt.items.length : (rcpt.totalArticles || 0);

      if (!storeBreakdown[sName]) {
        storeBreakdown[sName] = { total: 0, count: 0, dates: [] };
      }
      storeBreakdown[sName].total += tot;
      storeBreakdown[sName].count += 1;
      storeBreakdown[sName].dates.push(d);

      detailedReceiptsLines.push(`- [${d}${tTime}] | **${sName}** | Montant: **${tot.toFixed(2)} ${sym}** | ${itemsCount} articles (Ticket ID: ${rcpt.id})`);

      if (Array.isArray(rcpt.items)) {
        rcpt.items.forEach(it => {
          const rawN = it.rawName || (it as any).name || '';
          const cleanN = (it as any).cleanName || it.normalizedName || (it as any).nomGenerique || rawN || 'Article';
          const brand = it.brand || (it as any).marque ? `(${it.brand || (it as any).marque})` : '';
          const weight = it.weightOrVolume || (it as any).formatExact ? `[${it.weightOrVolume || (it as any).formatExact}]` : '';
          const qty = it.quantity || 1;
          const pu = Number(it.unitPrice) || (it.pricePaid ? it.pricePaid / qty : 0);
          const pp = Number(it.pricePaid) || (pu * qty);
          const cat = it.category ? `{Rayon: ${it.category}}` : '';

          allItemsLines.push(`${d} | ${sName} | ${cleanN} ${brand} ${weight} | Qté: ${qty} | PU: ${pu.toFixed(2)} ${sym} | Payé: ${pp.toFixed(2)} ${sym} | ${cat} | TicketID: ${rcpt.id}`);
        });
      }
    });

    const storeSummaryList = Object.entries(storeBreakdown)
      .map(([s, data]) => `- **${s}** : **${data.total.toFixed(2)} ${sym}** dépensés au total sur **${data.count} tickets** (Dates: ${data.dates.join(', ')})`)
      .join('\n');

    receiptsDataWarehouseSection = `
================================================================================
DATAWAREHOUSE COMPLET DES TICKETS DE CAISSE (${receipts.length} TICKETS ENREGISTRÉS)
================================================================================
RÉPARTITION PAR MAGASIN PHYSIQUE DÉTECTÉ :
${storeSummaryList}

LISTE COMPLÈTE DE TOUS LES TICKETS DE CAISSE (DATE, MAGASIN EXACT, MONTANT TOTAL, ID) :
${detailedReceiptsLines.join('\n')}

================================================================================
DATAWAREHOUSE INTÉGRAL DE TOUS LES ARTICLES ACHETÉS EN MAGASIN (${allItemsLines.length} ARTICLES)
(Format : Date | Enseigne | Nom standardisé (Marque) [Format] | Qté | PU | Total Payé | Rayon | TicketID)
================================================================================
${allItemsLines.join('\n')}
`;
  } else {
    receiptsDataWarehouseSection = `
================================================================================
DATAWAREHOUSE DES TICKETS DE CAISSE
================================================================================
Aucun ticket de caisse numérisé pour le moment.
`;
  }

  // 2. PRODUITS STANDARDISÉS & HISTORIQUE DES PRIX
  let productsSection = '';
  if (products && products.length > 0) {
    const pLines: string[] = [];
    products.slice(0, 100).forEach(p => {
      const best = (p as any).meilleure_offre
        ? `Meilleur: ${(p as any).meilleure_offre.magasin_nom} (${Number((p as any).meilleure_offre.prix_unitaire).toFixed(2)} ${sym})`
        : (p.meilleur_magasin ? `Meilleur: ${p.meilleur_magasin.storeName} (${p.meilleur_magasin.prix_unitaire.toFixed(2)} ${sym})` : '');
      pLines.push(`- **${p.nom_generique}** (${p.marque}) [${p.rayon_assigne || (p as any).rayon}] : ${best}`);
    });
    productsSection = `
================================================================================
CATALOGUE COMPARATIF DES PRODUITS STANDARDISÉS (${products.length} RÉFÉRENCES)
================================================================================
${pLines.join('\n')}
`;
  }

  // 3. Pré-audit déterministe si une question produit est posée
  let preAuditSection = '';
  if (userPromptForPreAudit) {
    const preAudit = buildProductQueryPreAudit(userPromptForPreAudit, receipts, currency);
    if (preAudit) {
      preAuditSection = `
================================================================================
PRÉ-AUDIT MATHÉMATIQUE EXACT POUR LA QUESTION DE L'UTILISATEUR ("${preAudit.matchedKeyword}")
================================================================================
Utilise OBLIGATOIREMENT ces résultats mathématiquement vérifiés pour répondre :
- Nombre d'achats trouvés : ${preAudit.itemCount}
- Prix unitaire moyen payé : ${preAudit.averageUnitPrice.toFixed(2)} ${sym}
- Prix le moins cher constaté : ${preAudit.cheapestPrice.toFixed(2)} ${sym} chez ${preAudit.cheapestStore} (${preAudit.cheapestItemName})
- Montant total dépensé sur la période : ${preAudit.totalSpent.toFixed(2)} ${sym}

SYNTHÈSE DIRECTE PRÉ-CALCULÉE (PARTIE 1) :
${preAudit.directSynthesisText}

TABLEAU JUSTIFICATIF COMPLET PRÉ-CALCULÉ (PARTIE 2 - REPRODUIS TOUTES LES LIGNES SANS TRONQUER) :
${preAudit.markdownTable}
`;
    }
  }

  // 4. Grand Livre compact des Transactions Bancaires (jusqu'à 800 opérations pour préserver la fenêtre de contexte)
  const ledgerLines: string[] = [];
  const sortedTx = [...activeTransactions].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const maxTx = Math.min(sortedTx.length, 800);

  for (let i = 0; i < maxTx; i++) {
    const t = enrichTransactionFallback(sortedTx[i]);
    const txId = t.id || `tx-${i}`;
    const d = t.date || 'N/A';
    const amt = (Number(t.amount) || 0).toFixed(2);
    const cat = t.category || 'Autre';
    const lbl = (t.cleanLabel || t.rawLabel || t.description || 'Opération').replace(/[|\n\r]/g, ' ').substring(0, 45);
    const nat = t.nature ? `[${t.nature}]` : '';
    const sub = t.isSubscription ? '[Abonnement]' : '';
    ledgerLines.push(`${txId} | ${d} | ${amt} ${sym} | ${cat} | ${lbl} ${nat} ${sub}`);
  }

  const ledgerText = ledgerLines.join('\n');

  return `
Tu es le **Coach Financier Personnel CashPilot**, un expert d'élite en finances personnelles, comptabilité analytique et optimisation du pouvoir d'achat.
Tu as ACCÈS DIRECT ET INTÉGRAL À L'ENSEMBLE DU DATAWAREHOUSE FINANCIER RÉEL de l'utilisateur fourni ci-dessous :
1. L'intégralité des relevés bancaires (toutes les transactions par ID, date et libellé)
2. L'intégralité des tickets de caisse (tous les passages en caisse avec dates, IDs et montants)
3. L'intégralité des articles achetés (chaque produit individuel, sa marque, sa quantité, son prix unitaire, son prix payé et son enseigne exacte)
4. Les budgets alloués dans la section "Budget & Coût de la vie"
5. Les règles personnalisées & clarifications d'abonnements de l'utilisateur.

================================================================================
SYNTHÈSE DU PROFIL FINANCIER GLOBAL
================================================================================
- Période couverte : du ${profile.dateRange?.start || 'N/A'} au ${profile.dateRange?.end || 'N/A'}
- Nombre total d'opérations bancaires : ${profile.transactionCount}
- Nombre total de tickets de caisse : ${receipts.length}
- Total Revenus / Entrées : +${profile.totalIncome.toFixed(2)} ${sym}
- Total Dépenses de consommation : -${profile.totalExpenses.toFixed(2)} ${sym}
- Épargne Nette / Solde des flux : ${profile.netSavings >= 0 ? '+' : ''}${profile.netSavings.toFixed(2)} ${sym}
- Taux d'épargne : ${profile.savingsRate}%

================================================================================
RÉPARTITION RÈGLE 50/30/20 (CALCULÉE PRÉCISÉMENT)
================================================================================
${rule503020Text}

================================================================================
TOP 10 DES POSTES DE DÉPENSES BANCAIRES LES PLUS IMPORTANTS
================================================================================
${topCatsText}

================================================================================
ABONNEMENTS ET CHARGES RÉCURRENTES
================================================================================
${subsText}

================================================================================
BUDGETS ALLOUÉS ("BUDGET & COÛT DE LA VIE")
================================================================================
${budgetsText}

================================================================================
RÈGLES PERSONNALISÉES & CLARIFICATIONS D'ABONNEMENTS DE L'UTILISATEUR
================================================================================
${customRulesText}

${preAuditSection}

${receiptsDataWarehouseSection}

${productsSection}

================================================================================
GRAND LIVRE COMPLET DES TRANSACTIONS BANCAIRES (${sortedTx.length} OPÉRATIONS)
(Format: TxID | Date | Montant | Catégorie | Libellé Opération)
================================================================================
${ledgerText}

================================================================================
CONSIGNES ET RÈGLES DE RÉPONSE STRICTES DU COACH ("AUDIT DIRECT")
================================================================================

1. **CONSIGNE SYSTÈME "AUDIT DIRECT" EN 2 PARTIES OBLIGATOIRES (POUR TOUTE QUESTION SUR LES DÉPENSES, PRODUITS OU ACHATS)** :
   Tu dois TOUJOURS structurer ta réponse selon ces 2 parties strictes, sans jamais tronquer ni couper le tableau :
   - **Partie 1 (Synthèse directe en 1 à 2 phrases)** : Réponds immédiatement dès la première ligne avec les chiffres clés en gras avant tout tableau :
     * **Prix moyen payé**
     * **Prix le moins cher constaté et dans quelle enseigne**
     * **Montant total dépensé sur la période**
   - **Partie 2 (Tableau justificatif complet)** : Affiche ensuite le tableau Markdown complet et parfaitement formaté avec TOUTES les lignes correspondantes :
     | Date | Enseigne | Produit & Marque | Quantité | Prix unitaire (${sym}) | Prix total payé (${sym}) |
     | :--- | :--- | :--- | :---: | :---: | :---: |
     *(Suivi de toutes les lignes de données et d'une ligne de TOTAL en gras. INTERDICTION ABSOLUE de t'arrêter après l'en-tête du tableau !)*

2. **RÈGLE OBLIGATOIRE SUR LES ENSEIGNES & MAGASINS (ex: Leclerc, Carrefour, Intermarché, Lidl, Super U)** :
   - Quand l'utilisateur demande ses dépenses chez une enseigne :
   - Explore les TICKETS DE CAISSE ainsi que les RELEVÉS BANCAIRES.
   - S'il existe PLUSIEURS magasins différents sous cette enseigne (ex: "E.Leclerc - Ville-la-Grand", "E.Leclerc - Roques", ou "Intermarché - Annemasse", "Intermarché - Ville-la-Grand", "Intermarché - Gaillard") :
     * **TU DOIS OBLIGATOIREMENT LISTER DISTINCTEMENT TOUS LES MAGASINS PORTANT CE NOM**, avec le montant dépensé dans chaque magasin et son nombre de tickets !
     * Donne le **TOTAL GLOBAL CUMULÉ** pour cette enseigne.
     * Fournis ensuite la **LISTE CHRONOLOGIQUE DÉTAILLÉE DE CHAQUE TICKET** en tableau Markdown.

3. **RÈGLE OBLIGATOIRE SUR LA RECHERCHE DE PRODUITS SPÉCIFIQUES (ex: "à combien j'achète mes fruits ?", "combien j'achète mon pain ?", "le café", "le lait", etc.)** :
   - Scanne méticuleusement la section "DATAWAREHOUSE INTÉGRAL DE TOUS LES ARTICLES ACHETÉS EN MAGASIN" (et utilise le "PRÉ-AUDIT MATHÉMATIQUE EXACT" s'il est fourni ci-dessus).
   - Commence par la **Partie 1 (Synthèse directe en 1 à 2 phrases)** suivie de la **Partie 2 (Tableau Markdown complet)**.

4. **SYSTÈME D'ACTIONS ADMINISTRATEUR SÉCURISÉES ("CARTES DE VALIDATION")** :
   - Si l'utilisateur demande de **modifier, supprimer ou annuler** :
     * un relevé bancaire d'un mois (actionType: "DELETE_STATEMENT_PERIOD", targetType: "statement")
     * une dépense ou transaction bancaire (actionType: "UPDATE_TRANSACTION" ou "DELETE_TRANSACTION", targetType: "transaction")
     * un ticket de caisse ou le prix d'un article (actionType: "UPDATE_RECEIPT" ou "DELETE_RECEIPT", targetType: "receipt")
     * un budget dans "Budget & Coût de la vie" (actionType: "UPDATE_BUDGET", targetType: "budget")
     * ou apporte une **précision sur un abonnement, un prélèvement ou une règle de catégorisation** (actionType: "CREATE_CUSTOM_RULE", targetType: "subscription_rule") :
   - **RÈGLE DE SÉCURITÉ ABSOLUE** : Explique clairement le changement proposé dans ta réponse et indique à l'utilisateur de cliquer sur **[ ✅ Valider ]** dans la carte de confirmation ci-dessous pour appliquer la modification.
   - Ajoute OBLIGATOIREMENT à la toute fin de ton message une balise unique \`<PROPOSED_ACTION>{"actionType":"...","targetType":"...","targetId":"...","title":"...","description":"...","oldValues":{...},"newValues":{...},"payload":{...}}</PROPOSED_ACTION>\` sur une seule ligne JSON valide.
`;
}

/**
 * Détecteur déterministe local d'intentions d'actions administrateur (Fallback haute fiabilité 100% gratuit)
 * Garantit qu'une Carte de Validation interactive est toujours générée lorsque l'utilisateur demande une modification,
 * une suppression ou une règle personnalisée, même si le LLM omet la balise JSON.
 */
export function detectDeterministicAdminAction(
  userPrompt: string,
  transactions: Transaction[],
  receipts: Receipt[],
  budgets: CostOfLivingExpenseItem[] = getActiveCostOfLivingBudgets()
): ProposedAdminAction | null {
  const raw = (userPrompt || '').trim();
  const norm = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Helper pour extraire un montant en € dans la phrase (ex: "400€", "2,99 €", "850 euros")
  const extractAmount = (text: string): number | null => {
    const match = text.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|eur|euros|chf)?/i);
    if (!match) return null;
    const val = parseFloat(match[1].replace(',', '.'));
    return isNaN(val) ? null : val;
  };

  // 1. DÉTECTION DE MODIFICATION DE BUDGET ("Budget & Coût de la vie")
  // Ex: "Fixe mon budget Courses à 400 €", "Modifie le budget Loyer à 850€", "Mets mon budget restaurant à 150 €"
  const isBudgetIntent =
    norm.includes('budget') ||
    norm.includes('cout de la vie') ||
    norm.includes('plafond') ||
    (norm.includes('fixe') && (norm.includes('loyer') || norm.includes('courses') || norm.includes('restaurant') || norm.includes('carburant') || norm.includes('shopping') || norm.includes('loisir')));

  if (isBudgetIntent) {
    const matchedBudget = budgets.find(b => {
      const bNorm = b.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const words = bNorm.split(/[^a-z0-9]+/).filter(w => w.length >= 4);
      return words.some(w => norm.includes(w));
    });

    const amountMatch = raw.match(/(?:a|à|de|sur|=|:)\s*(\d+(?:[.,]\d{1,2})?)\s*(?:€|eur|euros)?/i) || raw.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|eur|euros)/i);
    const newAmt = amountMatch ? parseFloat(amountMatch[1].replace(',', '.')) : null;

    if (matchedBudget && newAmt !== null && !isNaN(newAmt)) {
      return {
        id: `action-budget-${Date.now()}`,
        actionType: 'UPDATE_BUDGET',
        targetType: 'budget',
        targetId: matchedBudget.id,
        title: `Modification du Budget : ${matchedBudget.name}`,
        description: `Mise à jour du montant alloué dans "Budget & Coût de la vie" pour le poste « ${matchedBudget.name} ».`,
        oldValues: {
          'Poste budgétaire': matchedBudget.name,
          'Budget Alloué actuel': `${(Number(matchedBudget.amount) || 0).toFixed(2)} €`
        },
        newValues: {
          'Poste budgétaire': matchedBudget.name,
          'Nouveau Budget Alloué': `${newAmt.toFixed(2)} €`
        },
        payload: {
          budgetId: matchedBudget.id,
          budgetName: matchedBudget.name,
          categoryGroup: matchedBudget.categoryGroup,
          oldAmount: Number(matchedBudget.amount) || 0,
          newAmount: newAmt
        },
        status: 'pending'
      };
    }
  }

  // 2. DÉTECTION DE PRÉCISION SUR UN ABONNEMENT / PRÉLÈVEMENT / RÈGLE PERSONNALISÉE
  // Ex: "Le prélèvement Google de 2,99 € correspond à Google One", "L'abonnement Google 10,99€ c'est YouTube Premium", "Précision : Sobrio est ma cotisation bancaire"
  const isRuleOrSubIntent =
    norm.includes('correspond a') ||
    norm.includes('c est l abonnement') ||
    norm.includes("c'est l'abonnement") ||
    norm.includes('precision') ||
    norm.includes('regle') ||
    norm.includes('renome') ||
    norm.includes('renomme') ||
    norm.includes('affecte toujours') ||
    norm.includes('classe toujours') ||
    (norm.includes('abonnement') && (norm.includes('correspond') || norm.includes('est ') || norm.includes('c est')));

  if (isRuleOrSubIntent) {
    const amt = extractAmount(raw);
    // Chercher le mot-clé d'origine (ex: Google, Apple, Sobrio, Alma, Klarna, Netflix, Free, etc.)
    const commonProviders = ['google', 'apple', 'sobrio', 'alma', 'oney', 'klarna', 'paypal', 'stripe', 'amex', 'free', 'orange', 'sfr', 'bouygues', 'sosh', 'edf', 'engie', 'veolia', 'basic fit'];
    let detectedPattern = commonProviders.find(p => norm.includes(p))?.toUpperCase() || '';

    if (!detectedPattern) {
      const quoted = raw.match(/["«]([^"»]+)["»]/);
      if (quoted) detectedPattern = quoted[1].trim();
    }

    if (detectedPattern) {
      // Extraire le nouveau nom explicite après "correspond à", "c'est", "en", ":"
      const labelMatch = raw.match(/(?:correspond\s+à|correspond\s+a|c'est|c\s+est|en\s+tant\s+que|comme\s+étant|renomme\s+en|appelle\s+ça)\s+["«]?([^."»\n]+)["»]?/i);
      const customLabel = labelMatch ? labelMatch[1].trim() : `${detectedPattern} (Clarifié par l'utilisateur)`;

      return {
        id: `action-rule-${Date.now()}`,
        actionType: 'CREATE_CUSTOM_RULE',
        targetType: 'subscription_rule',
        targetId: `rule-${detectedPattern.toLowerCase().replace(/\s+/g, '-')}-${amt || 'all'}`,
        title: `Nouvelle Règle & Clarification : ${detectedPattern}${amt ? ` (${amt.toFixed(2)} €)` : ''}`,
        description: `Enregistrement d'une règle personnalisée permanente pour identifier clairement ce prélèvement/opération dans toute l'application.`,
        oldValues: {
          'Libellé bancaire détecté': detectedPattern,
          ...(amt ? { 'Montant ciblé': `${amt.toFixed(2)} €` } : { 'Portée': 'Tous les montants' })
        },
        newValues: {
          'Nom explicite affiché': customLabel,
          'Catégorie attribuée': 'Abonnements & Télécom',
          'Poste Coût de la vie': 'Streaming, Cloud & Services'
        },
        payload: {
          pattern: detectedPattern,
          exactAmount: amt || undefined,
          customLabel,
          category: 'Abonnements & Télécom',
          budgetPostName: 'Streaming, Cloud & Services',
          isSubscription: true,
          customNote: raw
        },
        status: 'pending'
      };
    }
  }

  // 3. DÉTECTION DE SUPPRESSION / ARCHIVAGE D'UN TICKET DE CAISSE
  // Ex: "Supprime le ticket Lidl", "Supprime mon dernier ticket de caisse", "Efface le ticket Leclerc du 15/10"
  const isDeleteIntent = norm.includes('supprim') || norm.includes('effac') || norm.includes('retir') || norm.includes('archiv') || norm.includes('annul');

  if (isDeleteIntent && norm.includes('ticket')) {
    const activeReceipts = receipts.filter((r: any) => !r.isArchived);
    const targetReceipt = activeReceipts.find(r => {
      const sNorm = (r.storeName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const storeWords = sNorm.split(/[^a-z0-9]+/).filter(w => w.length >= 3);
      return storeWords.some(w => norm.includes(w)) || (r.date && raw.includes(r.date));
    }) || activeReceipts[0];

    if (targetReceipt) {
      return {
        id: `action-del-rcpt-${Date.now()}`,
        actionType: 'DELETE_RECEIPT',
        targetType: 'receipt',
        targetId: targetReceipt.id,
        title: `Archivage du Ticket : ${targetReceipt.storeName}`,
        description: `Suppression douce (Soft Delete) du ticket de caisse ${targetReceipt.storeName} du ${targetReceipt.date}. Vous pourrez l'annuler à tout moment.`,
        oldValues: {
          'Magasin': targetReceipt.storeName,
          'Date du ticket': targetReceipt.date,
          'Montant TTC': `${Number(targetReceipt.totalAmount).toFixed(2)} €`,
          'Articles': `${targetReceipt.items?.length || 0} articles`
        },
        newValues: {
          'Statut': 'Archivé (Corbeille sécurisée)',
          'Impact Comparateur': 'Retiré de la matrice active'
        },
        payload: {
          receiptId: targetReceipt.id,
          receiptSnapshot: targetReceipt
        },
        status: 'pending'
      };
    }
  }

  // 4. DÉTECTION DE SUPPRESSION D'UN RELEVÉ BANCAIRE / PÉRIODE MENSUELLE
  // Ex: "Supprime le relevé de juin 2026", "Supprime les relevés du mois de mars"
  if (isDeleteIntent && (norm.includes('releve') || norm.includes('mois de'))) {
    const monthNamesMap: Record<string, string> = {
      janvier: '01', fevrier: '02', mars: '03', avril: '04', mai: '05', juin: '06',
      juillet: '07', aout: '08', septembre: '09', octobre: '10', novembre: '11', decembre: '12'
    };
    let detectedMonthKey = '';
    const explicitYm = raw.match(/(20\d{2}-\d{2})/);
    if (explicitYm) {
      detectedMonthKey = explicitYm[1];
    } else {
      for (const [mName, mNum] of Object.entries(monthNamesMap)) {
        if (norm.includes(mName)) {
          const yearMatch = raw.match(/(20\d{2})/);
          const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();
          detectedMonthKey = `${year}-${mNum}`;
          break;
        }
      }
    }

    const activeTxs = transactions.filter(t => !t.isArchived);
    const matchingTxs = detectedMonthKey
      ? activeTxs.filter(t => (t.monthKey === detectedMonthKey) || (t.date && t.date.startsWith(detectedMonthKey)))
      : [];

    if (detectedMonthKey && matchingTxs.length > 0) {
      return {
        id: `action-del-stmt-${Date.now()}`,
        actionType: 'DELETE_STATEMENT_PERIOD',
        targetType: 'statement',
        targetId: detectedMonthKey,
        title: `Archivage du Relevé Bancaire : Période ${detectedMonthKey}`,
        description: `Mise en corbeille (Soft Delete) des ${matchingTxs.length} opérations bancaires de la période ${detectedMonthKey}.`,
        oldValues: {
          'Période ciblée': detectedMonthKey,
          'Nombre de transactions': matchingTxs.length,
          'Statut': 'Actif'
        },
        newValues: {
          'Période ciblée': detectedMonthKey,
          'Statut': 'Archivé (Restaurable en 1 clic)'
        },
        payload: {
          monthKey: detectedMonthKey,
          transactionIds: matchingTxs.map(t => t.id),
          transactionsSnapshot: matchingTxs
        },
        status: 'pending'
      };
    }
  }

  // 5. DÉTECTION DE SUPPRESSION OU MODIFICATION D'UNE TRANSACTION BANCAIRE INDIVIDUELLE
  const activeTxs = transactions.filter(t => !t.isArchived);
  if (isDeleteIntent && activeTxs.length > 0) {
    const matchedTx = activeTxs.find(t => {
      const lbl = `${t.cleanLabel || ''} ${t.rawLabel || ''} ${t.description || ''}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const words = lbl.split(/[^a-z0-9]+/).filter(w => w.length >= 4);
      return words.some(w => norm.includes(w));
    });

    if (matchedTx && matchedTx.id) {
      const label = matchedTx.cleanLabel || matchedTx.rawLabel || matchedTx.description || 'Opération';
      return {
        id: `action-del-tx-${Date.now()}`,
        actionType: 'DELETE_TRANSACTION',
        targetType: 'transaction',
        targetId: String(matchedTx.id),
        title: `Archivage de la Dépense : ${label}`,
        description: `Suppression douce (Soft Delete) de l'opération « ${label} » du ${matchedTx.date}.`,
        oldValues: {
          'Libellé': label,
          'Date': matchedTx.date || 'N/A',
          'Montant': `${Number(matchedTx.amount).toFixed(2)} €`,
          'Catégorie': matchedTx.category || 'Autre'
        },
        newValues: {
          'Statut': 'Archivé (Soft Delete — Restaurable)'
        },
        payload: {
          transactionId: String(matchedTx.id),
          transactionSnapshot: matchedTx
        },
        status: 'pending'
      };
    }
  }

  return null;
}

/**
 * Extrait proprement le texte de réponse et l'objet `proposedAction` éventuel renvoyé par l'IA
 */
export function parseCoachResponseWithActions(
  rawResponse: string,
  userPrompt: string,
  transactions: Transaction[],
  receipts: Receipt[],
  budgets: CostOfLivingExpenseItem[] = getActiveCostOfLivingBudgets()
): { cleanText: string; proposedAction?: ProposedAdminAction } {
  let text = (rawResponse || '').trim();
  let parsedAction: ProposedAdminAction | undefined;

  const actionRegex = /<PROPOSED_ACTION>([\s\S]*?)<\/PROPOSED_ACTION>/i;
  const match = text.match(actionRegex);

  if (match && match[1]) {
    text = text.replace(actionRegex, '').trim();
    try {
      const rawJson = match[1].trim().replace(/^```json/i, '').replace(/```$/i, '').trim();
      const obj = JSON.parse(rawJson);
      if (obj && obj.actionType && obj.targetType) {
        parsedAction = {
          id: obj.id || `action-ai-${Date.now()}`,
          actionType: obj.actionType,
          targetType: obj.targetType,
          targetId: String(obj.targetId || 'target'),
          title: obj.title || 'Action proposée par le Coach IA',
          description: obj.description || 'Veuillez confirmer cette modification avant son application.',
          oldValues: obj.oldValues || {},
          newValues: obj.newValues || {},
          payload: obj.payload || {},
          status: 'pending'
        };
      }
    } catch (e) {
      console.warn("Erreur parsing <PROPOSED_ACTION> JSON:", e);
    }
  }

  // Fallback déterministe si le LLM n'a pas émis la balise mais que l'utilisateur a formulé une demande d'action claire
  if (!parsedAction) {
    const fallbackAction = detectDeterministicAdminAction(userPrompt, transactions, receipts, budgets);
    if (fallbackAction) {
      parsedAction = fallbackAction;
    }
  }

  return {
    cleanText: text,
    proposedAction: parsedAction
  };
}

/**
 * Envoie un message au Coach IA Gemini avec l'historique et le contexte complet de la base de données.
 * Retourne le texte complet garanti sans troncature (maxOutputTokens: 8192 + filet de sécurité anti-troncature).
 */
export async function askFinancialCoach(
  userPrompt: string,
  history: ChatMessage[],
  profile: FinancialProfile,
  transactions: Transaction[],
  receiptsOrCurrency?: Receipt[] | string,
  products?: StandardizedProductDoc[],
  currency: string = 'EUR'
): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Clé API Google Gemini introuvable. Veuillez vérifier votre fichier .env ou les paramètres.");
  }

  let receipts: Receipt[] = [];
  let curr = currency;
  if (typeof receiptsOrCurrency === 'string') {
    curr = receiptsOrCurrency;
  } else if (Array.isArray(receiptsOrCurrency)) {
    receipts = receiptsOrCurrency;
  }

  const preAudit = buildProductQueryPreAudit(userPrompt, receipts, curr);
  const systemContext = buildCoachSystemContext(profile, transactions, receipts, products, curr, userPrompt);
  const genAI = new GoogleGenerativeAI(apiKey);

  // Modèles candidats actifs avec bascule automatique et résilience aux erreurs 404 / 429
  const preferredModel = getGeminiModelName();
  const candidateModels = Array.from(new Set([
    preferredModel,
    'gemini-3.5-flash',
    'gemini-flash-lite-latest',
    'gemini-3.5-flash-lite',
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-2.5-flash'
  ])).filter(m => m && !m.includes('2.0') && !m.includes('1.5') && m !== 'gemini-2.5-flash-lite');

  let lastError: any = null;

  for (const modelId of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelId,
        systemInstruction: systemContext,
        generationConfig: {
          temperature: 0.15, // Rigueur analytique et chiffres précis
          topP: 0.95,
          maxOutputTokens: COACH_MAX_OUTPUT_TOKENS,
        }
      });

      const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];

      // Historique des échanges récents (les 8 derniers pour conserver la fluidité)
      const recentHistory = history.slice(-8);
      for (const msg of recentHistory) {
        if (!msg.content || !msg.content.trim()) continue;
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        });
      }

      // S'assurer que le premier message de `contents` est bien de rôle 'user'
      while (contents.length > 0 && contents[0].role !== 'user') {
        contents.shift();
      }

      // Question actuelle de l'utilisateur avec rappel de non-troncature
      const enrichedUserPrompt = preAudit
        ? `${userPrompt}\n\n[RAPPEL SYSTÈME : Réponds obligatoirement en 2 parties : Partie 1 = Synthèse directe en 1-2 phrases avec prix moyen (${preAudit.averageUnitPrice.toFixed(2)} €), prix le moins cher (${preAudit.cheapestPrice.toFixed(2)} € chez ${preAudit.cheapestStore}) et total dépensé (${preAudit.totalSpent.toFixed(2)} €). Partie 2 = Tableau Markdown complet avec TOUTES les ${preAudit.itemCount} lignes sans rien couper.]`
        : userPrompt;

      contents.push({
        role: 'user',
        parts: [{ text: enrichedUserPrompt }]
      });

      const response = await model.generateContent({ contents });
      const text = response.response.text();

      if (text && text.trim()) {
        return ensureCompleteAuditResponse(text.trim(), preAudit);
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`Erreur lors de l'appel Coach avec ${modelId}:`, err?.message || err);
    }
  }

  // Fallback si l'API est momentanément indisponible mais que nous avons un pré-audit exact
  if (preAudit) {
    return `${preAudit.directSynthesisText}\n\n${preAudit.markdownTable}`;
  }

  const rawMsg = lastError?.message || '';
  if (rawMsg.includes('429') || rawMsg.includes('Quota exceeded') || rawMsg.includes('RESOURCE_EXHAUSTED')) {
    throw new Error(
      "Le quota journalier gratuit de Google Gemini est temporairement saturé. " +
      "Vous pouvez patienter un moment ou renseigner votre propre clé API Google Gemini gratuite dans les Paramètres pour un accès illimité."
    );
  }
  if (rawMsg.includes('API_KEY_INVALID') || rawMsg.includes('API key not valid')) {
    throw new Error(
      "La clé API Google Gemini n'est pas valide. Veuillez vérifier votre clé API dans vos Paramètres."
    );
  }

  throw new Error(rawMsg || "Le Coach IA n'a pas pu générer de réponse. Veuillez réessayer dans quelques instants.");
}
