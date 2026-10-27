import { parseCSVBankStatement, categorizeTransaction, formatMonthLabel, formatDateFR, classifyTransaction, detectBankName, cleanMerchantDescription, sanitizeRawBankLabel, CATEGORIES, extractCleanBankStatementRows, type CleanBankStatementRow } from './bankParser.ts';
import { validateBankStatementFile, validateBankStatementCSVContent, sanitizeImportErrorMessage, type BankFileValidationResult } from './bankValidation.ts';

export { formatMonthLabel, formatDateFR, categorizeTransaction, parseCSVBankStatement, classifyTransaction, detectBankName, cleanMerchantDescription, sanitizeRawBankLabel, CATEGORIES, extractCleanBankStatementRows, validateBankStatementFile, validateBankStatementCSVContent, sanitizeImportErrorMessage, type CleanBankStatementRow, type BankFileValidationResult };
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
  let startingBalance = 0;

  transactions.forEach(t => {
    const amt = Math.abs(Number(t.amount) || 0);
    const isStartingBalance = t.isStartingBalance || t.category === "Solde de départ" || t.rawLabel === "Solde de départ";

    if (isStartingBalance) {
      startingBalance += Number(t.amount) || 0;
      return;
    }

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
  const resteAVivre = income - realExpenses; // Strictement sans transfers internes ou epargne, conformément à la règle mémoire

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
    resteAVivre,
    startingBalance
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

export interface StatementDisplayStatus {
  isCsv: boolean;
  hasVerifiedBalance: boolean;
  kpiTitle: string; // 'Solde Vérifié' ou 'Flux Net'
  kpiSubtitle: string; // 'Certifié relevé PDF' ou 'Total mouvements (CSV)'
  kpiBadge: string | null; // null ou 'Solde non dispo'
  displayAmount: number;
  formattedAmount: string;
  isPositive: boolean;
  isNegative: boolean;
  explanation: string;
}

/**
 * RÈGLE FONDAMENTALE COMPTABLE :
 * Un relevé CSV ne contenant ni solde initial ni solde final officiel, il ne doit JAMAIS afficher de "Solde" ou "Dispo".
 * L'interface doit refléter fidèlement la réalité bancaire :
 * - CSV sans ancre certifiée : affiche strictement le « Flux Net » (total des mouvements) et indique « Solde non disponible ».
 * - PDF avec ancre vérifiée : affiche le « Solde Vérifié ».
 */
export function getStatementDisplayStatus(
  transactions: { source_type?: string; sourceType?: string; importFormat?: string }[],
  netCashFlow: number,
  verifiedPdfBalance: number | null | undefined,
  currency: 'EUR' | 'CHF' = 'EUR'
): StatementDisplayStatus {
  const currSym = currency === 'CHF' ? 'CHF' : '€';
  const hasPdfSource = transactions.some(
    t => t.source_type === 'PDF' || t.sourceType === 'PDF' || t.importFormat === 'PDF'
  );
  const hasVerified = Boolean(hasPdfSource && verifiedPdfBalance !== null && verifiedPdfBalance !== undefined && verifiedPdfBalance !== 0);

  if (hasVerified) {
    const balance = verifiedPdfBalance!;
    return {
      isCsv: false,
      hasVerifiedBalance: true,
      kpiTitle: 'Solde Vérifié',
      kpiSubtitle: 'Certifié relevé PDF',
      kpiBadge: null,
      displayAmount: balance,
      formattedAmount: formatCurrency(balance, { showSign: false, currency: currSym }),
      isPositive: balance >= 0,
      isNegative: balance < 0,
      explanation: 'Solde officiel et certifié issu du relevé bancaire PDF.'
    };
  }

  return {
    isCsv: true,
    hasVerifiedBalance: false,
    kpiTitle: 'Flux Net',
    kpiSubtitle: 'Total mouvements (CSV)',
    kpiBadge: 'Solde non dispo',
    displayAmount: null as any,
    formattedAmount: '—',
    isPositive: false,
    isNegative: false,
    explanation: "Relevé CSV : seules les opérations sont répertoriées. Aucun solde certifié n'y figurant, aucun montant n'est affiché dans le flux net."
  };
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

export interface SubscriptionPricePoint {
  date: string;
  amount: number;
  rawLabel?: string;
  formattedDate?: string;
  monthKey?: string;
}

export interface SubscriptionPriceEvolution {
  serviceKey: string;
  serviceName: string;
  currentAmount: number;
  previousAmount?: number;
  difference?: number;
  percentChange?: number;
  status: 'INCREASED' | 'DECREASED' | 'STABLE' | 'NEW';
  history: SubscriptionPricePoint[];
  negotiationAdvice?: string;
}

/**
 * Normalise l'empreinte d'un abonnement pour le reconnaître infailliblement à travers plusieurs mois.
 * Éradique les références bancaires variables, mandats SEPA, dates, numéros de facture,
 * et associe les enseignes courantes à leurs clés canoniques.
 */
export function normalizeSubscriptionServiceKey(tx: { cleanLabel?: string; rawLabel?: string; description?: string }): string {
  const label = (tx.cleanLabel || tx.description || tx.rawLabel || '').trim();
  const rawDesc = (tx.rawLabel || tx.description || tx.cleanLabel || '').trim();
  
  const cleanedMerchant = cleanMerchantDescription(rawDesc || label);
  const candidate = (cleanedMerchant && cleanedMerchant !== 'Opération Bancaire') ? cleanedMerchant : label;

  const norm = candidate
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const normRaw = `${rawDesc} ${label} ${norm}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // 1. Dictionnaire d'alias canoniques prioritaires pour services & prélèvements récurrents
  if (normRaw.includes('netflix')) return 'netflix';
  if (normRaw.includes('spotify')) return 'spotify';
  if (normRaw.includes('deezer')) return 'deezer';
  if (normRaw.includes('amazon prime') || normRaw.includes('amzn prime') || normRaw.includes('prime video')) return 'amazon prime';
  if (normRaw.includes('disney')) return 'disney plus';
  if (normRaw.includes('canal plus') || normRaw.includes('canal+') || normRaw.includes('canalplus')) return 'canal plus';
  if (normRaw.includes('free mobile') || (normRaw.includes('free') && (normRaw.includes('telecom') || normRaw.includes('mobile') || normRaw.includes('fact')))) return 'free mobile';
  if (normRaw.includes('freebox') || normRaw.includes('free box')) return 'freebox';
  if (normRaw.includes('orange') || normRaw.includes('sosh')) return 'orange';
  if (normRaw.includes('bouygues') || normRaw.includes('b&you') || normRaw.includes('byou')) return 'bouygues telecom';
  if (normRaw.includes('sfr') || normRaw.includes('red by sfr')) return 'sfr';
  if (normRaw.includes('la poste mobile')) return 'la poste mobile';
  if (normRaw.includes('totalenergies') || normRaw.includes('total direct') || normRaw.includes('total energie')) return 'totalenergies';
  if (normRaw.includes('electricite de france') || normRaw.includes('edf')) return 'edf';
  if (normRaw.includes('engie') || normRaw.includes('gaz de france') || normRaw.includes('gdf')) return 'engie';
  if (normRaw.includes('veolia')) return 'veolia';
  if (normRaw.includes('suez')) return 'suez';
  if (normRaw.includes('sogessur')) return 'sogessur';
  if (normRaw.includes('macif')) return 'macif';
  if (normRaw.includes('maif')) return 'maif';
  if (normRaw.includes('matmut')) return 'matmut';
  if (normRaw.includes('allianz')) return 'allianz';
  if (normRaw.includes('axa')) return 'axa';
  if (normRaw.includes('alan')) return 'alan assurance';
  if (normRaw.includes('groupama')) return 'groupama';
  if (normRaw.includes('generali')) return 'generali';
  if (normRaw.includes('gmf')) return 'gmf';
  if (normRaw.includes('mma')) return 'mma';
  if (normRaw.includes('swiss life') || normRaw.includes('swisslife')) return 'swiss life';
  if (normRaw.includes('harmonie mutuelle')) return 'harmonie mutuelle';
  if (normRaw.includes('mgen')) return 'mgen';
  if (normRaw.includes('basic fit') || normRaw.includes('basicfit')) return 'basic fit';
  if (normRaw.includes('fitness park') || normRaw.includes('fitnesspark')) return 'fitness park';
  if (normRaw.includes('keep cool') || normRaw.includes('keepcool')) return 'keep cool';
  if (normRaw.includes('swype')) return 'swype';
  if (normRaw.includes('sobrio')) return 'sobrio';
  if (normRaw.includes('jazz')) return 'jazz';
  if (normRaw.includes('klarna')) return 'klarna';
  if (normRaw.includes('oney')) return 'oney';
  if (normRaw.includes('alma')) return 'alma';
  if (normRaw.includes('chatgpt') || normRaw.includes('openai')) return 'chatgpt';
  if (normRaw.includes('apple') || normRaw.includes('icloud') || normRaw.includes('itunes')) return 'apple';
  if (normRaw.includes('google') || normRaw.includes('youtube')) return 'google';

  // 2. Normalisation générique pour tout autre organisme / contrat récurrent
  const cleaned = norm
    .replace(/\b(prlv|prelevement|vir|virement|sepa|europeen)\b/gi, ' ')
    .replace(/\b(cotis|cotisation|echeance|ech|facture|fact|client|ref|reference|mandat|emetteur|destinataire|cpt|bq|titulaire)\b/gi, ' ')
    .replace(/\b(cb|carte|mensuel|trimestriel|annuel|forfait|contrat)\b/gi, ' ')
    .replace(/\b\d+\b/g, ' ') // Supprime les nombres (mandats, montants, dates, réf)
    .replace(/[^a-z]/g, ' ')
    .trim();

  const tokens = cleaned
    .split(/\s+/)
    .filter(w => w.length >= 2);

  return tokens.slice(0, 3).join(' ') || norm.slice(0, 15).trim();
}

/**
 * Vérifie si deux clés de services d'abonnement correspondent au même fournisseur
 */
export function areSubscriptionKeysMatching(key1: string, key2: string): boolean {
  if (!key1 || !key2) return false;
  if (key1 === key2) return true;
  if (key1.length >= 4 && (key1.includes(key2) || key2.includes(key1))) return true;

  const tokens1 = key1.split(/\s+/).filter(w => w.length >= 3);
  const tokens2 = key2.split(/\s+/).filter(w => w.length >= 3);
  if (tokens1.length > 0 && tokens2.length > 0) {
    const hasShared = tokens1.some(t => tokens2.includes(t));
    if (hasShared && (tokens1.length === 1 || tokens2.length === 1)) return true;
  }
  return false;
}

/**
 * Détermine si une opération correspond à un abonnement ou un prélèvement récurrent
 */
export function isSubscriptionOrRecurringDebit(tx: {
  amount?: number;
  rawLabel?: string;
  cleanLabel?: string;
  description?: string;
  category?: string;
  isSubscription?: boolean;
}): boolean {
  if ((Number(tx.amount) || 0) >= 0) return false;
  if (tx.isSubscription) return true;

  const cat = (tx.category || '').toLowerCase();
  if (cat.includes('abonnement') || cat.includes('télécom') || cat.includes('telecom')) return true;

  const raw = `${tx.rawLabel || ''} ${tx.cleanLabel || ''} ${tx.description || ''}`.toLowerCase();

  // Mots-clés de prélèvements et contrats réguliers
  if (
    raw.includes('prlv') ||
    raw.includes('prelevement') ||
    raw.includes('cotis') ||
    raw.includes('cotisation') ||
    raw.includes('abonnement') ||
    raw.includes('forfait') ||
    raw.includes('echeance')
  ) {
    return true;
  }

  // Fournisseurs d'abonnements courants
  const knownServices = [
    'netflix', 'spotify', 'deezer', 'amazon prime', 'prime video', 'disney',
    'canal', 'free mobile', 'freebox', 'orange', 'sfr', 'bouygues',
    'totalenergies', 'edf', 'engie', 'veolia', 'suez', 'sogessur',
    'macif', 'maif', 'matmut', 'allianz', 'axa', 'alan', 'basic fit',
    'fitness park', 'swype', 'sobrio', 'icloud', 'chatgpt'
  ];

  return knownServices.some(s => raw.includes(s));
}

/**
 * Analyse l'évolution du prix d'un abonnement ou prélèvement par rapport à l'historique complet disponible.
 * Compare l'ensemble des mois disponibles (pas seulement les deux derniers) pour détecter toute hausse ou baisse.
 */
export function detectSubscriptionEvolution(
  currentTx: { amount: number; date?: string; cleanLabel?: string; rawLabel?: string; description?: string; category?: string; isSubscription?: boolean },
  allTransactions: Array<{ amount: number; date: string; cleanLabel?: string; rawLabel?: string; description?: string; category?: string; isSubscription?: boolean }>
): SubscriptionPriceEvolution {
  const serviceKey = normalizeSubscriptionServiceKey(currentTx);
  const serviceName = currentTx.cleanLabel || cleanMerchantDescription(currentTx.rawLabel || currentTx.description || '') || currentTx.description || currentTx.rawLabel || 'Abonnement';
  const currAmt = Math.abs(Number(currentTx.amount) || 0);

  // Rechercher toutes les opérations correspondantes dans l'historique (débits uniquement)
  const matches = (allTransactions || [])
    .filter(t => {
      if ((Number(t.amount) || 0) >= 0) return false;
      const k = normalizeSubscriptionServiceKey(t);
      return areSubscriptionKeysMatching(k, serviceKey);
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Regrouper par mois distinct (YYYY-MM) pour obtenir 1 montant par mois
  const monthMap = new Map<string, { date: string; amount: number; rawLabel?: string }>();

  matches.forEach(m => {
    const d = m.date || '';
    const monthKey = d.substring(0, 7) || 'releve';
    const amt = Math.abs(Number(m.amount) || 0);
    monthMap.set(monthKey, {
      date: d,
      amount: amt,
      rawLabel: m.rawLabel || m.description
    });
  });

  // Si l'opération en cours n'est pas encore présente pour son mois
  if (currentTx.date) {
    const currMonth = currentTx.date.substring(0, 7);
    if (!monthMap.has(currMonth)) {
      monthMap.set(currMonth, {
        date: currentTx.date,
        amount: currAmt,
        rawLabel: currentTx.rawLabel || currentTx.description
      });
    }
  }

  // Convertir en tableau chronologique
  const history: SubscriptionPricePoint[] = Array.from(monthMap.entries())
    .map(([mKey, val]) => ({
      date: val.date,
      amount: val.amount,
      rawLabel: val.rawLabel,
      formattedDate: formatDateFR(val.date),
      monthKey: mKey
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Si on a au moins 2 mois distincts dans l'historique
  if (history.length >= 2) {
    const latest = history[history.length - 1];
    const previous = history[history.length - 2];
    const first = history[0];

    const stepDiff = Math.round((latest.amount - previous.amount) * 100) / 100;
    const overallDiff = Math.round((latest.amount - first.amount) * 100) / 100;

    // Chercher la dernière occurrence ayant un montant différent du montant actuel
    const prevDifferent = [...history].reverse().find(p => Math.abs(p.amount - latest.amount) >= 0.05);

    let effectiveDiff = 0;
    let refPreviousAmount = previous.amount;

    if (Math.abs(stepDiff) >= 0.05) {
      // Changement direct entre le dernier mois et le mois précédent
      effectiveDiff = stepDiff;
      refPreviousAmount = previous.amount;
    } else if (prevDifferent && Math.abs(latest.amount - prevDifferent.amount) >= 0.05) {
      // Hausse ou baisse antérieure encore active sur le tarif actuel
      effectiveDiff = Math.round((latest.amount - prevDifferent.amount) * 100) / 100;
      refPreviousAmount = prevDifferent.amount;
    } else if (Math.abs(overallDiff) >= 0.05) {
      effectiveDiff = overallDiff;
      refPreviousAmount = first.amount;
    }

    const pct = refPreviousAmount > 0 ? Math.round((effectiveDiff / refPreviousAmount) * 1000) / 10 : 0;

    if (effectiveDiff >= 0.05) {
      return {
        serviceKey,
        serviceName,
        currentAmount: latest.amount,
        previousAmount: refPreviousAmount,
        difference: effectiveDiff,
        percentChange: pct,
        status: 'INCREASED',
        history,
        negotiationAdvice: `Hausse de tarif constatée (passé de ${refPreviousAmount.toFixed(2)} € à ${latest.amount.toFixed(2)} €, soit +${effectiveDiff.toFixed(2)} €/mois et +${(effectiveDiff * 12).toFixed(2)} €/an). Conformément à l'article L224-33 du Code de la consommation, une augmentation tarifaire unilatérale vous donne le droit de résilier sans frais pendant 4 mois. Pensez à faire jouer la concurrence ou négocier une remise fidélité.`
      };
    } else if (effectiveDiff <= -0.05) {
      return {
        serviceKey,
        serviceName,
        currentAmount: latest.amount,
        previousAmount: refPreviousAmount,
        difference: effectiveDiff,
        percentChange: pct,
        status: 'DECREASED',
        history,
        negotiationAdvice: `Baisse de tarif constatée (${effectiveDiff.toFixed(2)} €/mois). Vous bénéficiez d'une réduction ou d'une remise active.`
      };
    } else {
      return {
        serviceKey,
        serviceName,
        currentAmount: latest.amount,
        previousAmount: latest.amount,
        difference: 0,
        percentChange: 0,
        status: 'STABLE',
        history,
        negotiationAdvice: `Tarif stable et inchangé (${latest.amount.toFixed(2)} €/mois sur ${history.length} mois analysés).`
      };
    }
  }

  // 1 seul mois disponible
  return {
    serviceKey,
    serviceName,
    currentAmount: currAmt,
    previousAmount: currAmt,
    difference: 0,
    percentChange: 0,
    status: 'NEW',
    history,
    negotiationAdvice: `Premier prélèvement répertorié sur vos relevés disponibles (${currAmt.toFixed(2)} €). Importez d'autres relevés mensuels pour comparer automatiquement les hausses ou baisses de prix.`
  };
}

/**
 * Extrait la liste des abonnements et prélèvements uniques actifs à partir de l'ensemble des relevés.
 * Chaque service n'apparaît qu'une seule fois (la dernière occurrence connue ou l'occurrence du mois ciblé),
 * évitant les doublons et permettant une analyse cross-mensuelle parfaite.
 */
export function extractUniqueActiveSubscriptions(
  scopedTransactions: BankTransaction[],
  allTransactions: BankTransaction[]
): { subscriptions: BankTransaction[]; totalMonthly: number } {
  const pool = (allTransactions && allTransactions.length > 0) ? allTransactions : scopedTransactions;

  // Filtrer les débits récurrents / abonnements / prélèvements
  const recurringTxs = pool.filter(t => isSubscriptionOrRecurringDebit(t));

  // Regrouper par clé de service canonique
  const groups = new Map<string, BankTransaction[]>();
  recurringTxs.forEach(t => {
    const key = normalizeSubscriptionServiceKey(t);
    if (!key) return;
    const list = groups.get(key) || [];
    list.push(t);
    groups.set(key, list);
  });

  const uniqueSubs: BankTransaction[] = [];
  let totalMonthly = 0;

  groups.forEach((txList) => {
    // Trier chronologiquement (le plus récent en premier)
    const sorted = [...txList].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Si une transaction appartient aux scopedTransactions, la privilégier comme représentante
    const scopedMatch = sorted.find(t => scopedTransactions.some(sc => sc.id === t.id));
    const representative = scopedMatch || sorted[0];

    if (representative) {
      uniqueSubs.push(representative);
      totalMonthly += Math.abs(Number(representative.amount) || 0);
    }
  });

  // Trier par montant décroissant
  uniqueSubs.sort((a, b) => Math.abs(Number(b.amount) || 0) - Math.abs(Number(a.amount) || 0));

  return {
    subscriptions: uniqueSubs,
    totalMonthly: Math.round(totalMonthly * 100) / 100
  };
}

/**
 * Calcule les métriques d'abonnements récurrents et charges associées
 */
export function calculateSubscriptionSummary(transactions: BankTransaction[]): SubscriptionSummary {
  const recurring = transactions.filter(t => isSubscriptionOrRecurringDebit(t));

  const seenKeys = new Set<string>();
  const uniqueItems: BankTransaction[] = [];
  let totalMonthly = 0;

  recurring.forEach(t => {
    const key = normalizeSubscriptionServiceKey(t);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueItems.push(t);
      totalMonthly += Math.abs(Number(t.amount) || 0);
    }
  });

  totalMonthly = Math.round(totalMonthly * 100) / 100;

  return {
    totalMonthly,
    totalAnnual: Math.round(totalMonthly * 12 * 100) / 100,
    count: uniqueItems.length,
    items: uniqueItems
  };
}


