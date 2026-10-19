import { parseCSVBankStatement, categorizeTransaction, formatMonthLabel, formatDateFR, classifyTransaction, detectBankName, cleanMerchantDescription, sanitizeRawBankLabel, CATEGORIES, extractCleanBankStatementRows, type CleanBankStatementRow } from './bankParser';

export { formatMonthLabel, formatDateFR, categorizeTransaction, parseCSVBankStatement, classifyTransaction, detectBankName, cleanMerchantDescription, sanitizeRawBankLabel, CATEGORIES, extractCleanBankStatementRows, type CleanBankStatementRow };
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
    subscriptionDay: parsed.isSubscription ? ((parsed as any).subscriptionDay || subscriptionDay) : undefined,
    confidence: parsed.category !== 'Autre' ? 'high' : 'low'
  };
}

/**
 * Détermine le type de flux financier selon la catégorie, le montant et le libellé
 */
export function classifyFlowType(category: string, amount: number, label: string = ''): FlowType {
  const normCat = (category || '').toLowerCase();
  const normLabel = (label || '').toLowerCase();

  // 0. Catégories standardisées prioritaires
  if (normCat === 'charges fixes' || normCat.includes('charges fixes')) return 'FIXED_EXPENSE';
  if (normCat === 'charges variables courantes' || normCat.includes('charges variables')) return 'VARIABLE_EXPENSE';
  if (normCat === 'dépenses de confort' || normCat.includes('confort')) return 'VARIABLE_EXPENSE';
  if (normCat === 'revenus' || normCat === 'revenu') return 'INCOME';

  // 1. Virements Famille & Proches
  if (normCat.includes('proche') || normCat.includes('famille')) {
    return amount > 0 ? 'INCOME' : 'VARIABLE_EXPENSE';
  }

  // 2. Remboursements Santé & Aides (Montants positifs)
  if (amount > 0 && (normCat.includes('santé') || normCat.includes('sante') || normCat.includes('aide') || normCat.includes('allocation'))) {
    return 'INCOME';
  }

  // 3. Virements Fortuneo & Revolut (Considérés comme entrées/sorties réelles sur le relevé)
  if (normCat.includes('fortuneo') || normLabel.includes('fortuneo')) {
    return amount > 0 ? 'INCOME' : 'VARIABLE_EXPENSE';
  }
  if (normCat.includes('revolut') || normLabel.includes('revolut')) {
    return amount > 0 ? 'INCOME' : 'VARIABLE_EXPENSE';
  }

  // 4. Vraie Épargne & Placements (Livrets A, LDDS, PEA, Assurance-Vie)
  const isThirdPartyInflow = amount > 0 && (
    normLabel.includes('generation') ||
    normLabel.includes('cpam') ||
    normLabel.includes('ameli') ||
    normLabel.includes('mutuelle') ||
    normLabel.includes('caf') ||
    normLabel.includes('salaire')
  );

  if (!isThirdPartyInflow && (
    normCat.includes('épargne') ||
    normCat.includes('epargne') ||
    normCat.includes('investissement') ||
    normLabel.includes('livret a') ||
    normLabel.includes('ldds') ||
    normLabel.includes('livret') ||
    normLabel.includes('assurance vie') ||
    normLabel.includes('compte a compte livret')
  )) {
    return 'SAVINGS_TRANSFER';
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
  let internalTransfers = 0;

  let fortuneoSent = 0;
  let fortuneoReceived = 0;

  transactions.forEach(t => {
    const amt = Math.abs(Number(t.amount) || 0);
    const cat = (t.category || '').toLowerCase();
    const raw = (t.rawLabel || t.description || '').toLowerCase();
    const isFortuneo = cat.includes('fortuneo') || raw.includes('fortuneo');

    // Détermination précise du signe réel :
    // Dans BankTransaction, t.rawAmount contient le montant signé original (- pour débit, + pour crédit).
    // Si t.rawAmount n'est pas fourni, on se base sur t.type, t.direction et t.flowType.
    const isDebit = 
      t.type === 'debit' ||
      t.direction === 'debit' ||
      (typeof t.rawAmount === 'number' && t.rawAmount < 0) ||
      (t.rawAmount === undefined && typeof t.amount === 'number' && t.amount < 0) ||
      t.flowType === 'FIXED_EXPENSE' ||
      t.flowType === 'VARIABLE_EXPENSE';

    const isCredit = !isDebit && (
      t.type === 'credit' ||
      t.direction === 'credit' ||
      t.flowType === 'INCOME' ||
      (typeof t.rawAmount === 'number' && t.rawAmount > 0) ||
      (t.rawAmount === undefined && typeof t.amount === 'number' && t.amount > 0)
    );

    if (isFortuneo) {
      if (isDebit) fortuneoSent += amt;
      else fortuneoReceived += amt;
    }

    if (isCredit) {
      income += amt;
    } else if (t.flowType === 'FIXED_EXPENSE') {
      fixed += amt;
    } else if (t.flowType === 'SAVINGS_TRANSFER') {
      // Option 1 : Rigueur absolue
      // Ne comptabiliser dans "savings" QUE la vraie épargne placée sur livrets ou investissements
      if (
        cat.includes('épargne') ||
        cat.includes('epargne') ||
        cat.includes('investissement') ||
        cat.includes('livret') ||
        cat.includes('placement')
      ) {
        savings += amt;
      } else {
        // Mouvements de trésorerie internes entre comptes courants propres
        internalTransfers += amt;
      }
    } else {
      // Toutes les dépenses de la vie courante (VARIABLE_EXPENSE ou débits réels)
      variable += amt;
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
    internalTransfers,
    fortuneoSent,
    fortuneoReceived,
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

  const normalizeDesc = (str: string) => {
    return (str || '')
      .toLowerCase()
      .replace(/carte\s+x\d+/gi, '')
      .replace(/\d{2}\/\d{2}/gi, '')
      .replace(/prelevement\s+europeen/gi, '')
      .replace(/vir(ement)?\s+(recu|emis|instantane)?/gi, '')
      .replace(/commerce\s+electronique/gi, '')
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 20);
  };

  const getDayTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? 0 : Math.floor(d.getTime() / (1000 * 60 * 60 * 24));
    } catch {
      return 0;
    }
  };

  // Create a pool of existing transactions that we can "consume" to allow identical legitimate transactions
  const existingPool = existingTxs.map(t => ({
    id: t.id,
    amt: Number(t.amount).toFixed(2),
    // Prioritize rawLabel to avoid duplicate bugs when Gemini or the user edits the description
    norm: normalizeDesc(t.rawLabel || t.cleanLabel || t.description || ''),
    raw: (t.rawLabel || t.description || '').toLowerCase(),
    day: getDayTimestamp(t.date),
    date: t.date,
    consumed: false
  }));

  for (const tx of newTxs) {
    const amt = Number(tx.amount).toFixed(2);
    const norm = normalizeDesc(tx.rawLabel || tx.cleanLabel || tx.description || '');
    const raw = (tx.rawLabel || tx.description || '').toLowerCase();
    const day = getDayTimestamp(tx.date);

    // Find the FIRST matching existing transaction that hasn't been consumed yet
    const matchIndex = existingPool.findIndex(e => {
      if (e.consumed) return false;
      if (e.amt !== amt) return false;

      // 1. Exact match on date and description
      if (e.date === tx.date && (e.norm === norm || (norm.length > 3 && e.norm.includes(norm)))) return true;

      // 2. Tolerance of +/- 3 days for card payment differences
      const dayDiff = Math.abs(e.day - day);
      if (dayDiff <= 3 && norm.length >= 4 && (e.norm === norm || e.norm.includes(norm) || norm.includes(e.norm))) {
        return true;
      }

      // 3. Bank reference identical
      if (raw.includes('6594345599s') && e.raw.includes('6594345599s')) return true;

      return false;
    });

    if (matchIndex !== -1) {
      // It's a duplicate of an existing transaction
      existingPool[matchIndex].consumed = true;
      duplicatesCount++;
    } else {
      // It's a new unique transaction! 
      // Add it to our pool so if the same new CSV has this identical transaction again, 
      // it won't be imported twice unless it actually appeared twice in the new CSV.
      existingPool.push({
        id: tx.id,
        amt,
        norm,
        raw,
        day,
        date: tx.date,
        consumed: true // Consume it immediately so subsequent identical txs in the SAME CSV don't match it (they should be imported too if they are genuinely multiple in the CSV)
      });
      uniqueTxs.push(tx);
    }
  }

  return { duplicatesCount, uniqueTxs };
}

/**
 * Identifie les transactions en doublon déjà enregistrées en base (même date, montant identique et libellé similaire)
 * Conserve la première occurrence et retourne la liste des IDs des doublons superflus à supprimer.
 */
export function findDuplicateStoredTransactionIds(transactions: BankTransaction[]): string[] {
  const seenMap = new Map<string, string>();
  const duplicateIds: string[] = [];

  const normalize = (str: string) => {
    return (str || '')
      .toLowerCase()
      .replace(/carte\s+x\d+/gi, '')
      .replace(/\d{2}\/\d{2}/gi, '')
      .replace(/prelevement\s+europeen/gi, '')
      .replace(/vir(ement)?\s+(recu|emis|instantane)?/gi, '')
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 20);
  };

  transactions.forEach(tx => {
    const amt = Number(tx.amount || 0).toFixed(2);
    const date = tx.date || '';
    const norm = normalize(tx.rawLabel || tx.cleanLabel || tx.description || '');
    const key = `${date}_${amt}_${norm}`;

    if (seenMap.has(key)) {
      duplicateIds.push(tx.id);
    } else {
      seenMap.set(key, tx.id);
    }
  });

  return duplicateIds;
}

/**
 * Formateur monétaire universel avec espace de 3 chiffres (séparateur de milliers net et lisible)
 * Ex: 1267.9 -> "1 267,90 €" (ou "+1 267,90 €" si showSign: true)
 */
export function formatCurrency(
  amount: number | string,
  options: {
    showSign?: boolean;
    currency?: string;
    decimals?: number;
    showCurrency?: boolean;
  } | string = {}
): string {
  const opts = typeof options === 'string' ? { currency: options } : options;
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(',', '.')) || 0;
  if (isNaN(num)) return `0,00 ${opts.currency ?? '€'}`.trim();

  const isPositive = num > 0;
  const isNegative = num < 0;
  const abs = Math.abs(num);
  const decimals = opts.decimals ?? 2;

  const fixed = abs.toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');

  // Espace régulier tous les 3 chiffres pour une séparation ultra-nette
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  const sign = opts.showSign
    ? (isPositive ? '+' : isNegative ? '-' : '')
    : (isNegative ? '-' : '');

  const decimalStr = decimals > 0 ? `,${decPart}` : '';
  const currencySymbol = opts.showCurrency !== false ? (opts.currency ?? '€') : '';
  const currencyStr = currencySymbol ? ` ${currencySymbol}` : '';

  return `${sign}${intFormatted}${decimalStr}${currencyStr}`;
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


