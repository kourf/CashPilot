import Papa from 'papaparse';
import { parseCSVBankStatement, categorizeTransaction, formatMonthLabel } from './bankParser';

export { formatMonthLabel, categorizeTransaction, parseCSVBankStatement };
export type FlowType = 'INCOME' | 'FIXED_EXPENSE' | 'VARIABLE_EXPENSE' | 'SAVINGS_TRANSFER';

export interface BankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  flowType: FlowType;
  category: string;
  subcategory?: string;
  account?: string;
  bankName?: string;
  isSubscription?: boolean;
  subscriptionDay?: number;
  confidence?: 'high' | 'medium' | 'low';
  isDuplicate?: boolean;
  status?: 'Reconciled' | 'Pending' | 'Internal Transfer';
  monthKey?: string;
  rawLabel?: string;
  cleanLabel?: string;
  [key: string]: any;
}

export const CATEGORIES = [
  'Salaire & Revenus',
  'Logement & Loyer',
  'Logement & Énergie',
  'Abonnements & Services',
  'Abonnements & Télécom',
  'Alimentation & Courses',
  'Transports & Véhicule',
  'Transports & Carburant',
  'Restaurants & Sorties',
  'Restaurants & Loisirs',
  'Santé',
  'Shopping & Maison',
  'Épargne & Investissement',
  'Virement Interne',
  'Frais bancaires',
  'Autre'
] as const;

export interface CategorizationResult {
  category: string;
  flowType: FlowType;
  isSubscription: boolean;
  subscriptionDay?: number;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Analyse sémantique avancée des libellés bancaires pour détection automatique :
 * - Catégorisation intelligente
 * - Classification en Charges Fixes, Variables, Revenus ou Épargne
 * - Détection des Abonnements récurrents avec date / jour de prélèvement
 */
export function smartCategorizeTransaction(
  description: string,
  amount: number,
  dateStr?: string
): CategorizationResult {
  const norm = (description || '').toLowerCase();

  // Extraction du jour du mois (1 à 31) si la date est disponible
  let subscriptionDay: number | undefined = undefined;
  if (dateStr) {
    try {
      const parts = dateStr.split(/[/-]/);
      if (parts.length === 3) {
        const day = parts[0].length === 4 ? parseInt(parts[2], 10) : parseInt(parts[0], 10);
        if (!isNaN(day) && day >= 1 && day <= 31) {
          subscriptionDay = day;
        }
      }
    } catch (e) {}
  }

  // 1. REVENUS (Positifs ou libellés de rémunération / aides)
  if (
    amount > 0 ||
    norm.includes('salaire') ||
    norm.includes('remuneration') ||
    norm.includes('rémunération') ||
    norm.includes('paie') ||
    norm.includes('virement recu') ||
    norm.includes('virement reçu') ||
    norm.includes('pole emploi') ||
    norm.includes('france travail') ||
    norm.includes('caf de') ||
    norm.includes('cpam remboursement') ||
    norm.includes('remboursement mutuelle') ||
    norm.includes('dividende')
  ) {
    return {
      category: 'Salaire & Revenus',
      flowType: 'INCOME',
      isSubscription: false,
      confidence: 'high'
    };
  }

  // 2. ÉPARGNE & VIREMENTS INTERNES (Neutralisés du reste à vivre)
  if (
    norm.includes('livret a') ||
    norm.includes('ldds') ||
    norm.includes('livret epargne') ||
    norm.includes('livret épargne') ||
    norm.includes('assurance vie') ||
    norm.includes('bourse') ||
    norm.includes('pea') ||
    norm.includes('compte titres') ||
    norm.includes('trade republic') ||
    norm.includes('degiro') ||
    norm.includes('binance') ||
    norm.includes('coinbase') ||
    norm.includes('virement interne') ||
    norm.includes('virement de compte') ||
    norm.includes('epargne') ||
    norm.includes('épargne') ||
    norm.includes('pel')
  ) {
    const isInternal = norm.includes('interne') || norm.includes('de compte');
    return {
      category: isInternal ? 'Virement Interne' : 'Épargne & Investissement',
      flowType: 'SAVINGS_TRANSFER',
      isSubscription: false,
      confidence: 'high'
    };
  }

  // 3. ABONNEMENTS RÉCURRENTS & TÉLÉCOMS (Charge Fixe + isSubscription: true avec date)
  const isSubMatch = (
    norm.includes('netflix') ||
    norm.includes('spotify') ||
    norm.includes('deezer') ||
    norm.includes('apple.com') ||
    norm.includes('apple bill') ||
    norm.includes('itunes') ||
    norm.includes('icloud') ||
    norm.includes('amazon prime') ||
    norm.includes('prime video') ||
    norm.includes('disney') ||
    norm.includes('youtube') ||
    norm.includes('canal plus') ||
    norm.includes('canal+') ||
    norm.includes('paramount') ||
    norm.includes('free mobile') ||
    norm.includes('free telecom') ||
    norm.includes('orange') ||
    norm.includes('sfr') ||
    norm.includes('bouygues') ||
    norm.includes('sosh') ||
    norm.includes('red by sfr') ||
    norm.includes('prixtel') ||
    norm.includes('basic fit') ||
    norm.includes('fitness park') ||
    norm.includes('keep cool') ||
    norm.includes('neoness') ||
    norm.includes('on air fitness') ||
    norm.includes('chatgpt') ||
    norm.includes('openai') ||
    norm.includes('midjourney') ||
    norm.includes('adobe') ||
    norm.includes('google one') ||
    norm.includes('google storage') ||
    norm.includes('dropbox') ||
    norm.includes('canva') ||
    norm.includes('notion') ||
    norm.includes('playstation network') ||
    norm.includes('psn') ||
    norm.includes('xbox game') ||
    norm.includes('nintendo') ||
    norm.includes('le monde') ||
    norm.includes('mediapart') ||
    norm.includes('figaro') ||
    norm.includes('abonnement')
  );

  if (isSubMatch) {
    return {
      category: 'Abonnements & Télécom',
      flowType: 'FIXED_EXPENSE',
      isSubscription: true,
      subscriptionDay,
      confidence: 'high'
    };
  }

  // 4. LOGEMENT & ÉNERGIE & ASSURANCES (Charges Fixes)
  if (
    norm.includes('loyer') ||
    norm.includes('bail') ||
    norm.includes('prelevement loyer') ||
    norm.includes('foncier') ||
    norm.includes('copropriete') ||
    norm.includes('copropriété') ||
    norm.includes('syndic') ||
    norm.includes('edf') ||
    norm.includes('engie') ||
    norm.includes('totalenergies') ||
    norm.includes('total energies') ||
    norm.includes('enedis') ||
    norm.includes('veolia') ||
    norm.includes('suez') ||
    norm.includes('eau de paris') ||
    norm.includes('assurance') ||
    norm.includes('axa') ||
    norm.includes('allianz') ||
    norm.includes('macif') ||
    norm.includes('maif') ||
    norm.includes('matmut') ||
    norm.includes('generali') ||
    norm.includes('direct assurance') ||
    norm.includes('impot') ||
    norm.includes('impôt') ||
    norm.includes('dgfip')
  ) {
    const isRecurring = norm.includes('assurance') || norm.includes('edf') || norm.includes('engie');
    return {
      category: 'Logement & Loyer',
      flowType: 'FIXED_EXPENSE',
      isSubscription: isRecurring,
      subscriptionDay: isRecurring ? subscriptionDay : undefined,
      confidence: 'high'
    };
  }

  // 5. FRAIS BANCAIRES (Charge Fixe)
  if (
    norm.includes('frais bancaires') ||
    norm.includes('cotisation carte') ||
    norm.includes('tenue de compte') ||
    norm.includes('commission') ||
    norm.includes('agios') ||
    norm.includes('interets debiteurs') ||
    norm.includes('intérêts débiteurs')
  ) {
    const isCardFee = norm.includes('cotisation') || norm.includes('tenue');
    return {
      category: 'Frais bancaires',
      flowType: 'FIXED_EXPENSE',
      isSubscription: isCardFee,
      subscriptionDay: isCardFee ? subscriptionDay : undefined,
      confidence: 'high'
    };
  }

  // 6. ALIMENTATION & SUPERMARCHÉS (Dépense Variable)
  if (
    norm.includes('carrefour') ||
    norm.includes('auchan') ||
    norm.includes('leclerc') ||
    norm.includes('lidl') ||
    norm.includes('aldi') ||
    norm.includes('intermarche') ||
    norm.includes('intermarché') ||
    norm.includes('monoprix') ||
    norm.includes('franprix') ||
    norm.includes('super u') ||
    norm.includes('hyper u') ||
    norm.includes('casino') ||
    norm.includes('picard') ||
    norm.includes('biocoop') ||
    norm.includes('naturalia') ||
    norm.includes('grand frais') ||
    norm.includes('boulangerie') ||
    norm.includes('paul') ||
    norm.includes('boucherie') ||
    norm.includes('primeur') ||
    norm.includes('marche') ||
    norm.includes('marché') ||
    norm.includes('coop')
  ) {
    return {
      category: 'Alimentation & Courses',
      flowType: 'VARIABLE_EXPENSE',
      isSubscription: false,
      confidence: 'high'
    };
  }

  // 7. TRANSPORTS & CARBURANT (Dépense Variable ou Abonnement)
  if (
    norm.includes('total') ||
    norm.includes('bp ') ||
    norm.includes('shell') ||
    norm.includes('esso') ||
    norm.includes('station') ||
    norm.includes('carburant') ||
    norm.includes('essence') ||
    norm.includes('diesel') ||
    norm.includes('peage') ||
    norm.includes('péage') ||
    norm.includes('aprr') ||
    norm.includes('vinci autoroutes') ||
    norm.includes('sanef') ||
    norm.includes('sncf') ||
    norm.includes('ratp') ||
    norm.includes('navigo') ||
    norm.includes('tcl') ||
    norm.includes('uber') ||
    norm.includes('bolt') ||
    norm.includes('blablacar') ||
    norm.includes('air france') ||
    norm.includes('easyjet') ||
    norm.includes('ryanair') ||
    norm.includes('parking') ||
    norm.includes('norauto') ||
    norm.includes('feu vert') ||
    norm.includes('garage')
  ) {
    const isNavigo = norm.includes('navigo') || norm.includes('abonnement transport');
    return {
      category: 'Transports & Carburant',
      flowType: isNavigo ? 'FIXED_EXPENSE' : 'VARIABLE_EXPENSE',
      isSubscription: isNavigo,
      subscriptionDay: isNavigo ? subscriptionDay : undefined,
      confidence: 'high'
    };
  }

  // 8. RESTAURANTS & LOISIRS (Dépense Variable)
  if (
    norm.includes('restaurant') ||
    norm.includes('brasserie') ||
    norm.includes('bistrot') ||
    norm.includes('cafe') ||
    norm.includes('café') ||
    norm.includes('bar ') ||
    norm.includes('mcdonald') ||
    norm.includes('burger king') ||
    norm.includes('kfc') ||
    norm.includes('subway') ||
    norm.includes('starbucks') ||
    norm.includes('pizza') ||
    norm.includes('domino') ||
    norm.includes('sushi') ||
    norm.includes('uber eats') ||
    norm.includes('deliveroo') ||
    norm.includes('just eat') ||
    norm.includes('cinema') ||
    norm.includes('cinéma') ||
    norm.includes('ugc') ||
    norm.includes('pathe') ||
    norm.includes('pathé') ||
    norm.includes('theatre') ||
    norm.includes('théâtre') ||
    norm.includes('concert') ||
    norm.includes('fnac') ||
    norm.includes('darty') ||
    norm.includes('steam') ||
    norm.includes('playstation') ||
    norm.includes('decathlon') ||
    norm.includes('cultura') ||
    norm.includes('musee') ||
    norm.includes('musée') ||
    norm.includes('bowling') ||
    norm.includes('billeterie')
  ) {
    return {
      category: 'Restaurants & Loisirs',
      flowType: 'VARIABLE_EXPENSE',
      isSubscription: false,
      confidence: 'high'
    };
  }

  // 9. SANTÉ (Dépense Variable)
  if (
    norm.includes('pharmacie') ||
    norm.includes('doctolib') ||
    norm.includes('medecin') ||
    norm.includes('médecin') ||
    norm.includes('dentiste') ||
    norm.includes('optique') ||
    norm.includes('opticien') ||
    norm.includes('kine') ||
    norm.includes('kiné') ||
    norm.includes('laboratoire') ||
    norm.includes('hopital') ||
    norm.includes('hôpital') ||
    norm.includes('clinique')
  ) {
    return {
      category: 'Santé',
      flowType: 'VARIABLE_EXPENSE',
      isSubscription: false,
      confidence: 'high'
    };
  }

  // 10. DÉFAUT INTELLIGENT
  return {
    category: 'Autre',
    flowType: 'VARIABLE_EXPENSE',
    isSubscription: false,
    confidence: 'low'
  };
}


/**
 * Détermine le type de flux financier selon la catégorie, le montant et le libellé
 */
export function classifyFlowType(category: string, amount: number, label: string = ''): FlowType {
  const normCat = (category || '').toLowerCase();
  const normLabel = (label || '').toLowerCase();

  // 1. Épargne & Virements internes (neutralisés du reste à vivre)
  if (
    normCat.includes('épargne') ||
    normCat.includes('investissement') ||
    normCat.includes('virement interne') ||
    normCat.includes('virements internes') ||
    normLabel.includes('livret a') ||
    normLabel.includes('ldds') ||
    normLabel.includes('assurance vie') ||
    normLabel.includes('virement de compte à compte')
  ) {
    return 'SAVINGS_TRANSFER';
  }

  // 2. Revenus
  if (
    amount > 0 ||
    normCat.includes('salaire') ||
    normCat.includes('revenus') ||
    normLabel.includes('salaire') ||
    normLabel.includes('virement recu') ||
    normLabel.includes('remboursement')
  ) {
    return 'INCOME';
  }

  // 3. Charges fixes
  if (
    normCat.includes('logement') ||
    normCat.includes('loyer') ||
    normCat.includes('abonnement') ||
    normCat.includes('télécom') ||
    normCat.includes('assurance') ||
    normCat.includes('frais bancaires') ||
    normCat.includes('impôt') ||
    normLabel.includes('edf') ||
    normLabel.includes('engie') ||
    normLabel.includes('internet') ||
    normLabel.includes('netflix') ||
    normLabel.includes('spotify')
  ) {
    return 'FIXED_EXPENSE';
  }

  // 4. Dépenses variables / courantes par défaut
  return 'VARIABLE_EXPENSE';
}

/**
 * Calcul exact des métriques financières avec séparation stricte des flux
 */
export function calculateBankMetrics(transactions: BankTransaction[]) {
  let income = 0;
  let fixed = 0;
  let variable = 0;
  let savings = 0;

  transactions.forEach(t => {
    const amt = Math.abs(Number(t.amount) || 0);
    if (t.flowType === 'INCOME') {
      income += amt;
    } else if (t.flowType === 'FIXED_EXPENSE') {
      fixed += amt;
    } else if (t.flowType === 'VARIABLE_EXPENSE') {
      variable += amt;
    } else if (t.flowType === 'SAVINGS_TRANSFER') {
      savings += amt;
    }
  });

  const realExpenses = fixed + variable;
  const netCashFlow = income - realExpenses - savings;
  const resteAVivre = income - realExpenses;

  return {
    income,
    fixed,
    variable,
    realExpenses,
    savings,
    netCashFlow,
    resteAVivre
  };
}

/**
 * Détecte les doublons par comparaison tolérante (date + montant exact + libellé normalisé)
 */
export function checkDuplicateTransactions(newTxs: BankTransaction[], existingTxs: BankTransaction[]) {
  let duplicatesCount = 0;
  const uniqueTxs: BankTransaction[] = [];

  const existingSignatures = new Set(
    existingTxs.map(t => {
      const amt = Number(t.amount).toFixed(2);
      const desc = (t.description || t.rawLabel || t.cleanLabel || '').trim().toLowerCase().slice(0, 30);
      return `${t.date}_${amt}_${desc}`;
    })
  );

  for (const tx of newTxs) {
    const amt = Number(tx.amount).toFixed(2);
    const desc = (tx.description || tx.rawLabel || tx.cleanLabel || '').trim().toLowerCase().slice(0, 30);
    const signature = `${tx.date}_${amt}_${desc}`;

    if (existingSignatures.has(signature)) {
      duplicatesCount++;
    } else {
      existingSignatures.add(signature);
      uniqueTxs.push(tx);
    }
  }

  return { duplicatesCount, uniqueTxs };
}

/**
 * Formateur monétaire élégant
 */
export function formatCurrency(amount: number, currency: string = '€'): string {
  const formatted = Math.abs(amount).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';
  return `${sign}${formatted} ${currency}`;
}

/**
 * Parser de montants flexible (gère virgules, espaces, formats français et internationaux)
 */
export function parseAmount(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  let str = String(val).trim();
  if (str === '') return null;

  let isNegative = false;
  if (str.endsWith('-')) { isNegative = true; str = str.slice(0, -1).trim(); }
  else if (str.startsWith('-')) { isNegative = true; str = str.substring(1).trim(); }
  if (str.startsWith('+')) { str = str.substring(1).trim(); }

  str = str.replace(/[€$a-zA-Z\s]/g, '');

  const commaCount = (str.match(/,/g) || []).length;
  const dotCount = (str.match(/\./g) || []).length;

  if (commaCount > 0 && dotCount > 0) {
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    if (lastComma > lastDot) { str = str.replace(/\./g, '').replace(',', '.'); }
    else { str = str.replace(/,/g, ''); }
  } else if (commaCount === 1 && dotCount === 0) {
    str = str.replace(',', '.');
  } else if (commaCount > 1 && dotCount === 0) {
    str = str.replace(/,/g, '');
  } else if (dotCount > 1 && commaCount === 0) {
    str = str.replace(/\./g, '');
  }

  const parsed = parseFloat(str);
  if (isNaN(parsed)) return null;
  return isNegative ? -parsed : parsed;
}

/**
 * Détection automatique de la banque et du nom de compte à partir du nom de fichier
 */
export function detectAccountFromFilename(filename: string): { bankName: string; accountName: string } {
  const lower = (filename || '').toLowerCase();
  
  if (lower.includes('bourso') || lower.includes('boursorama')) {
    return { bankName: 'BoursoBank', accountName: 'BoursoBank - Compte Courant' };
  }
  if (lower.includes('revolut')) {
    return { bankName: 'Revolut', accountName: 'Revolut EUR' };
  }
  if (lower.includes('bnp') || lower.includes('paribas')) {
    return { bankName: 'BNP Paribas', accountName: 'BNP Paribas - Compte Courant' };
  }
  if (lower.includes('credit_agricole') || lower.includes('agricole') || lower.includes('ca_')) {
    return { bankName: 'Crédit Agricole', accountName: 'Crédit Agricole' };
  }
  if (lower.includes('sg') || lower.includes('societe_generale') || lower.includes('societegenerale')) {
    return { bankName: 'Société Générale', accountName: 'Société Générale' };
  }
  if (lower.includes('n26')) {
    return { bankName: 'N26', accountName: 'N26' };
  }
  if (lower.includes('livret') || lower.includes('ldds')) {
    return { bankName: 'Épargne', accountName: 'Livret Épargne' };
  }
  if (lower.includes('pro')) {
    return { bankName: 'Compte Pro', accountName: 'Compte Pro' };
  }

  return { bankName: 'Banque Principale', accountName: 'Compte Courant' };
}

export interface AccountSummary {
  accountName: string;
  txCount: number;
  income: number;
  expenses: number;
  savings: number;
  netCashFlow: number;
}

/**
 * Calcule la synthèse financière par compte bancaire distinct
 */
export function calculateAccountSummaries(transactions: BankTransaction[]): AccountSummary[] {
  const map = new Map<string, { count: number; income: number; expenses: number; savings: number }>();

  transactions.forEach(t => {
    const acc = t.account || 'Compte Principal';
    if (!map.has(acc)) {
      map.set(acc, { count: 0, income: 0, expenses: 0, savings: 0 });
    }
    const curr = map.get(acc)!;
    curr.count += 1;
    const amt = Math.abs(Number(t.amount) || 0);
    if (t.flowType === 'INCOME') curr.income += amt;
    else if (t.flowType === 'FIXED_EXPENSE' || t.flowType === 'VARIABLE_EXPENSE') curr.expenses += amt;
    else if (t.flowType === 'SAVINGS_TRANSFER') curr.savings += amt;
  });

  return Array.from(map.entries()).map(([accountName, stats]) => ({
    accountName,
    txCount: stats.count,
    income: stats.income,
    expenses: stats.expenses,
    savings: stats.savings,
    netCashFlow: stats.income - stats.expenses - stats.savings
  })).sort((a, b) => b.txCount - a.txCount);
}

/**
 * Parser de fichier CSV automatique avec assignation multi-comptes
 */
export async function parseCsvBankFile(
  file: File,
  targetAccountName?: string,
  targetBankName?: string
): Promise<BankTransaction[]> {
  const detected = detectAccountFromFilename(file.name);
  const finalAccount = targetAccountName || detected.accountName;
  const finalBank = targetBankName || detected.bankName;

  try {
    const text = await file.text();
    const parsed = parseCSVBankStatement(text, finalAccount, finalBank);

    return parsed.map((p, idx) => ({
      id: `csv_${Date.now()}_${idx}`,
      date: p.date,
      description: p.description,
      amount: p.amount,
      flowType: p.flowType,
      category: p.category,
      isSubscription: p.isSubscription,
      subscriptionDay: p.subscriptionDay,
      confidence: 'high' as const,
      account: p.account || finalAccount,
      bankName: p.bankName || finalBank,
      status: p.flowType === 'SAVINGS_TRANSFER' ? ('Internal Transfer' as const) : ('Reconciled' as const)
    }));
  } catch (err) {
    console.error("Erreur lecture CSV:", err);
    return [];
  }
}

export interface SubscriptionSummary {
  totalMonthly: number;
  totalAnnual: number;
  count: number;
  items: BankTransaction[];
}

/**
 * Calcule les métriques d'abonnements récurrents et charges associées
 */
export function calculateSubscriptionSummary(transactions: BankTransaction[]): SubscriptionSummary {
  const subs = transactions.filter(t => t.isSubscription || t.category === 'Abonnements & Télécom');
  const totalMonthly = subs.reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0);
  return {
    totalMonthly,
    totalAnnual: totalMonthly * 12,
    count: subs.length,
    items: subs
  };
}


