import type { Transaction } from './kpiUtils.ts';
import { enrichTransactionFallback } from './kpiUtils.ts';
import type { Receipt, StandardizedProductDoc } from '../types/receipts.ts';
import { GoogleGenerativeAI } from '@google/generative-ai';

export function getGeminiModelName(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('cashpilot_gemini_model');
    if (saved && saved !== 'gemini-3.8-flash' && saved !== 'gemini-3.5-flash') {
      return saved;
    }
  }
  return 'gemini-2.5-flash';
}

export function getGeminiApiKey(): string {
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
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('cashpilot_gemini_api_key') || '';
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

// Catégories attribuées aux Besoins (Fixes / Essentielles)
const NEEDS_CATEGORIES = new Set([
  'Logement', 'Loyer', 'Crédit immobilier', 'Énergie', 'Électricité', 'Gaz', 'Eau',
  'Charges', 'Charges & Factures', 'Assurances', 'Assurance', 'Télécom', 'Abonnements & Télécom',
  'Téléphonie', 'Internet', 'Alimentation & Supermarché', 'Courses', 'Supermarché',
  'Santé', 'Pharmacie', 'Médecin', 'Mutuelle', 'Transports', 'Carburant', 'Essence',
  'Transport en commun', 'Péage', 'Impôts', 'Taxes', 'Frais bancaires', 'Frais Bancaires'
]);

// Catégories attribuées aux Envies (Variables / Style de vie / Plaisirs)
const WANTS_CATEGORIES = new Set([
  'Restaurants & Sorties', 'Restaurants', 'Bars', 'Sorties', 'Loisirs & Culture',
  'Loisirs', 'Culture', 'Shopping & Vêtements', 'Shopping', 'Mode', 'Vêtements',
  'Voyages & Vacances', 'Voyages', 'Vacances', 'Cadeaux', 'Livraisons repas', 'Uber',
  'High-Tech', 'Jeux Vidéo', 'Divertissement', 'Beauté & Bien-être', 'Coiffeur'
]);

// Catégories attribuées à l'Épargne & Investissement
const SAVINGS_CATEGORIES = new Set([
  'Épargne', 'Epargne', 'Investissements', 'Placements', 'PEA', 'Livret A', 'Crypto',
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

  transactions.forEach(rawTx => {
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

        // Agrégation par catégorie de dépenses
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

        // Abonnements récurrents
        if (tx.isSubscription || category.includes('Abonnement') || tx.nature === 'fixe') {
          const key = label.toLowerCase().trim();
          if (!subsMap.has(key) || absAmt > subsMap.get(key)!.amount) {
            subsMap.set(key, { label, category, amount: absAmt });
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
          // Fallback selon la nature
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

  // Tri des dates
  validDates.sort();
  const dateRange = validDates.length > 0 ? { start: validDates[0], end: validDates[validDates.length - 1] } : null;

  // Tri des catégories par montant décroissant
  const sortedCategories: CategorySummary[] = Object.entries(categoryTotals)
    .map(([cat, data]) => ({
      category: cat,
      total: Math.round(data.total * 100) / 100,
      percentage: totalExpenses > 0 ? Math.round((data.total / totalExpenses) * 1000) / 10 : 0,
      count: data.count
    }))
    .sort((a, b) => b.total - a.total);

  // Top dépenses individuelles
  const topSingleExpenses = singleDebits
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  // Subscriptions
  const subscriptions = Array.from(subsMap.values())
    .map(s => ({
      ...s,
      annual: Math.round(s.amount * 12 * 100) / 100
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 12);

  // 50/30/20 Calculation
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

  receipts.forEach(r => {
    const sName = r.storeName || 'Supermarché';
    const amt = Number(r.totalAmount) || 0;
    totalReceiptSpend += amt;
    if (!storeMap[sName]) storeMap[sName] = { total: 0, count: 0 };
    storeMap[sName].total += amt;
    storeMap[sName].count += 1;

    if (Array.isArray(r.items)) {
      r.items.forEach(it => {
        rawProducts.push({
          name: it.cleanName || it.name,
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
    transactionCount: transactions.length,
    dateRange,
    topCategories: sortedCategories,
    topSingleExpenses,
    subscriptions,
    rule503020,
    receiptsSummary: {
      receiptCount: receipts.length,
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
    // Format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return new Date(clean);
    // Format DD/MM/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(clean)) {
      const [d, m, y] = clean.split('/').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date(clean);
  };

  const start = parseDate(startDateStr);
  const end = parseDate(endDateStr);

  const matched = transactions.filter(t => {
    const amt = Number(t.amount) || 0;
    if (amt >= 0) return false; // uniquement les dépenses
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
 * Construit le prompt système contenant l'intégralité de la base de données financière
 */
export function buildCoachSystemContext(
  profile: FinancialProfile,
  transactions: Transaction[],
  currency: string = 'EUR'
): string {
  const sym = currency === 'CHF' ? 'CHF' : '€';

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

  // Formatage des tickets de caisse
  const receiptsText = profile.receiptsSummary.receiptCount > 0
    ? `
Nombre de tickets numérisés : ${profile.receiptsSummary.receiptCount}
Total dépensé en courses : ${profile.receiptsSummary.totalReceiptSpend.toFixed(2)} ${sym}
Enseignes fréquentées : ${profile.receiptsSummary.stores.map(s => `${s.store} (${s.total.toFixed(2)} ${sym}, ${s.count} tickets)`).join(', ')}
Articles les plus chers identifiés : ${profile.receiptsSummary.topProducts.slice(0, 5).map(p => `${p.name} (${p.price.toFixed(2)} ${sym} chez ${p.store})`).join(', ')}
`
    : 'Aucun ticket de caisse numérisé pour le moment.';

  // Compression du Grand Livre des Transactions (jusqu'à 1500 transactions en format ultra-compact)
  // [Date] | Montant | Catégorie | Libellé | Sub?
  const ledgerLines: string[] = [];
  const sortedTx = [...transactions].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const maxTx = Math.min(sortedTx.length, 1200);

  for (let i = 0; i < maxTx; i++) {
    const t = sortedTx[i];
    const d = t.date || 'N/A';
    const amt = (Number(t.amount) || 0).toFixed(2);
    const cat = t.category || 'Autre';
    const lbl = (t.cleanLabel || t.rawLabel || t.description || 'Opération').replace(/[|\n\r]/g, ' ').substring(0, 35);
    const sub = t.isSubscription ? '[Abo]' : '';
    ledgerLines.push(`${d} | ${amt} ${sym} | ${cat} | ${lbl} ${sub}`);
  }

  const ledgerText = ledgerLines.join('\n');

  return `
Tu es le **Coach Financier Personnel CashPilot**, un expert en finances personnelles, gestion budgétaire et optimisation du pouvoir d'achat.
Tu as ACCÈS DIRECT ET INTÉGRAL à l'ensemble de la base de données financière réelle de l'utilisateur fournie ci-dessous.

================================================================================
SYNTHÈSE DU PROFIL FINANCIER DE L'UTILISATEUR
================================================================================
- Période couverte : du ${profile.dateRange?.start || 'N/A'} au ${profile.dateRange?.end || 'N/A'}
- Nombre total de transactions : ${profile.transactionCount}
- Total Revenus / Entrées : +${profile.totalIncome.toFixed(2)} ${sym}
- Total Dépenses / Sorties : -${profile.totalExpenses.toFixed(2)} ${sym}
- Épargne Nette / Solde des flux : ${profile.netSavings >= 0 ? '+' : ''}${profile.netSavings.toFixed(2)} ${sym}
- Taux d'épargne : ${profile.savingsRate}%

================================================================================
RÉPARTITION RÈGLE 50/30/20 (CALCULÉE PRÉCISÉMENT)
================================================================================
${rule503020Text}

================================================================================
TOP 10 DES POSTES DE DÉPENSES LES PLUS IMPORTANTS
================================================================================
${topCatsText}

================================================================================
ABONNEMENTS ET PRÉLÈVEMENTS RÉCURRENTS
================================================================================
${subsText}

================================================================================
DONNÉES TICKETS DE CAISSE & COURSES
================================================================================
${receiptsText}

================================================================================
EXTRAIT INTÉGRAL DU GRAND LIVRE BANCAIRE (Date | Montant | Catégorie | Libellé)
================================================================================
${ledgerText}

================================================================================
CONSIGNES ET RÈGLES DE RÉPONSE DU COACH
================================================================================
1. **RÉPONSE DIRECTE ET PRÉCISE AUX QUESTIONS TYPIQUES** :
   - **Si l'utilisateur demande ses "3 postes de dépenses les plus importants"** :
     Donne EXACTEMENT les 3 premiers postes listés dans la section TOP DES POSTES ci-dessus avec le montant exact en ${sym}, le pourcentage du total des dépenses, et pour chacun une recommandation concrète pour réduire ou maîtriser ce poste.
   - **Si l'utilisateur demande des conseils sur la règle 50/30/20** :
     Détaille rigoureusement ses 3 piliers (Besoins 50%, Envies 30%, Épargne 20%) avec ses VRAIS chiffres, son écart par rapport à la cible, et donne une feuille de route en 3 étapes pour rééquilibrer son budget.
   - **Si l'utilisateur demande de "lister des dépenses de telle date à telle date" (ex: du 01 au 15)** :
     Recherche méticuleusement dans le grand livre ci-dessus toutes les opérations entre ces deux dates. Présente-les sous la forme d'un tableau Markdown élégant avec : Date, Libellé, Catégorie, Montant. Calcule et affiche la somme totale exacte de cette période en fin de tableau !
   - **Si l'utilisateur demande des conseils d'économies ou d'optimisation** :
     Appuie-toi sur ses vrais abonnements, ses magasins de courses et ses postes surdimensionnés pour proposer des gains en euros réels et chiffrés.

2. **STYLE & TON** :
   - Professionnel, bienveillant, percutant et très clair.
   - Utilise un français impeccable.
   - Mets en valeur les chiffres clés en **gras**.
   - Utilise des puces et des tableaux markdown (| Col 1 | Col 2 |) pour structurer tes réponses.
   - Ne commence JAMAIS par des phrases creuses du style "En tant qu'IA...". Agis immédiatement comme son conseiller financier dédié.
`;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  status?: 'sending' | 'done' | 'error';
}

/**
 * Envoie un message au Coach IA Gemini avec l'historique et le contexte complet de la base de données
 */
export async function askFinancialCoach(
  userPrompt: string,
  history: ChatMessage[],
  profile: FinancialProfile,
  transactions: Transaction[],
  currency: string = 'EUR'
): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Clé API Google Gemini introuvable. Veuillez vérifier votre fichier .env ou les paramètres.");
  }

  const systemContext = buildCoachSystemContext(profile, transactions, currency);
  const genAI = new GoogleGenerativeAI(apiKey);

  // Modèles candidats avec bascule automatique
  const preferredModel = getGeminiModelName();
  const candidateModels = Array.from(new Set([
    preferredModel,
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-2.0-flash'
  ]));

  let lastError: any = null;

  for (const modelId of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelId,
        generationConfig: {
          temperature: 0.2, // Rigueur analytique et chiffres précis
          topP: 0.95,
          maxOutputTokens: 2048,
        }
      });

      // Construction des tours de conversation pour Gemini
      // Format Gemini: contents = [ { role: 'user' | 'model', parts: [{ text }] } ]
      const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];

      // 1. Premier tour : Injection du contexte système dans un premier message utilisateur + accusé de réception modèle
      contents.push({
        role: 'user',
        parts: [{ text: systemContext + `\n\nConfirme que tu es prêt à coacher l'utilisateur sur la base de ces données.` }]
      });
      contents.push({
        role: 'model',
        parts: [{ text: `Bonjour ! J'ai bien analysé l'intégralité de votre base de données financière (${profile.transactionCount} opérations et ${profile.receiptsSummary.receiptCount} tickets de caisse). Je suis prêt à vous guider et à répondre à toutes vos questions.` }]
      });

      // 2. Historique des échanges récents (les 6 derniers pour conserver la fluidité sans saturer)
      const recentHistory = history.slice(-6);
      for (const msg of recentHistory) {
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        });
      }

      // 3. Question actuelle de l'utilisateur
      contents.push({
        role: 'user',
        parts: [{ text: userPrompt }]
      });

      const response = await model.generateContent({ contents });
      const text = response.response.text();

      if (text && text.trim()) {
        return text.trim();
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`Erreur lors de l'appel Coach avec ${modelId}:`, err?.message || err);
    }
  }

  throw new Error(lastError?.message || "Le Coach IA n'a pas pu générer de réponse. Veuillez réessayer dans quelques instants.");
}
