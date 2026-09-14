import { parseCSVBankStatement, categorizeTransaction, formatMonthLabel, formatDateFR, classifyTransaction, detectBankName, cleanMerchantDescription, CATEGORIES } from './bankParser';

export { formatMonthLabel, formatDateFR, categorizeTransaction, parseCSVBankStatement, classifyTransaction, detectBankName, cleanMerchantDescription, CATEGORIES };
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

  const parsed = classifyTransaction(description, amount);
  return {
    category: parsed.category,
    flowType: parsed.flowType,
    isSubscription: parsed.isSubscription,
    subscriptionDay: parsed.isSubscription ? (parsed.subscriptionDay || subscriptionDay) : undefined,
    confidence: parsed.category !== 'Autre' ? 'high' : 'low'
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
    normCat.includes('epargne') ||
    normCat.includes('investissement') ||
    normCat.includes('virement interne') ||
    normCat.includes('virements internes') ||
    normLabel.includes('livret a') ||
    normLabel.includes('ldds') ||
    normLabel.includes('livret') ||
    normLabel.includes('assurance vie') ||
    normLabel.includes('fortuneo') ||
    normLabel.includes('drame kouroufia') ||
    normLabel.includes('kouroufia fortuneo') ||
    normLabel.includes('virement avec fortuneo') ||
    normLabel.includes('virement de compte') ||
    normLabel.includes('compte a compte') ||
    normLabel.includes('compte à compte')
  ) {
    return 'SAVINGS_TRANSFER';
  }

  // 2. Virements Famille & Proches
  if (normCat.includes('proche') || normCat.includes('famille')) {
    return amount > 0 ? 'INCOME' : 'VARIABLE_EXPENSE';
  }

  // 3. Revenus & Aides
  if (
    amount > 0 ||
    normCat.includes('salaire') ||
    normCat.includes('revenus') ||
    normCat.includes('aides') ||
    normCat.includes('allocations') ||
    normLabel.includes('salaire') ||
    normLabel.includes('virement recu') ||
    normLabel.includes('virement reçu') ||
    normLabel.includes('remboursement') ||
    normLabel.includes('france travail') ||
    normLabel.includes('pole emploi') ||
    normLabel.includes('caf')
  ) {
    return 'INCOME';
  }

  // 4. Charges fixes & Abonnements & Paiements fractionnés & AMEX
  if (
    normCat.includes('logement') ||
    normCat.includes('loyer') ||
    normCat.includes('abonnement') ||
    normCat.includes('télécom') ||
    normCat.includes('telecom') ||
    normCat.includes('assurance') ||
    normCat.includes('frais bancaires') ||
    normCat.includes('fractionn') ||
    normCat.includes('amex') ||
    normCat.includes('energie') ||
    normCat.includes('énergie') ||
    normLabel.includes('totalenergies') ||
    normLabel.includes('edf') ||
    normLabel.includes('engie') ||
    normLabel.includes('sogessur') ||
    normLabel.includes('groupama') ||
    normLabel.includes('swype') ||
    normLabel.includes('orange') ||
    normLabel.includes('la poste mobile') ||
    normLabel.includes('netflix') ||
    normLabel.includes('spotify') ||
    normLabel.includes('klarna') ||
    normLabel.includes('alma') ||
    normLabel.includes('american express')
  ) {
    return 'FIXED_EXPENSE';
  }

  // 5. Dépenses variables / courantes par défaut (incluant Impôts & Amendes, Retrait Espèces, Loisirs & Activités, Alimentation, Transports, Shopping, Santé, Autre)
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

  try {
    const text = await file.text();
    const { bankName: detectedBank, transactions: parsed } = parseCSVBankStatement(text);
    const finalBank = targetBankName || (detectedBank !== 'Compte Courant' ? detectedBank : detected.bankName);
    const finalAccount = targetAccountName || (finalBank ? `${finalBank} - Compte Courant` : detected.accountName);

    return parsed.map((p, idx) => ({
      ...p,
      id: `csv_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      account: targetAccountName || p.account || finalAccount,
      bankName: targetBankName || p.bankName || finalBank,
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


