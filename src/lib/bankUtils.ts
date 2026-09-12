import Papa from 'papaparse';

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
  'Abonnements & Télécom',
  'Alimentation & Courses',
  'Transports & Carburant',
  'Restaurants & Loisirs',
  'Santé',
  'Épargne & Investissement',
  'Virement Interne',
  'Frais bancaires',
  'Autre'
] as const;

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
 * Parser de fichier CSV automatique
 */
export function parseCsvBankFile(file: File): Promise<BankTransaction[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const rows = results.data as any[];
          if (!rows || rows.length === 0) {
            return resolve([]);
          }

          // Détection automatique des colonnes
          const headers = Object.keys(rows[0] || {});
          const dateCol = headers.find(h => /date|jour/i.test(h)) || headers[0];
          const descCol = headers.find(h => /libell|description|label|motif|operation/i.test(h)) || headers[1];
          const amountCol = headers.find(h => /montant|amount|valeur/i.test(h));
          const debitCol = headers.find(h => /debit/i.test(h));
          const creditCol = headers.find(h => /credit/i.test(h));

          const parsed: BankTransaction[] = [];

          rows.forEach((row, idx) => {
            const rawDate = row[dateCol] || '';
            const description = String(row[descCol] || 'Opération sans libellé').trim();

            let amount: number | null = null;
            if (amountCol && row[amountCol] !== undefined) {
              amount = parseAmount(row[amountCol]);
            } else if (debitCol || creditCol) {
              const debit = debitCol ? parseAmount(row[debitCol]) : null;
              const credit = creditCol ? parseAmount(row[creditCol]) : null;
              if (debit !== null && debit !== 0) amount = -Math.abs(debit);
              else if (credit !== null && credit !== 0) amount = Math.abs(credit);
            }

            if (amount === null || isNaN(amount)) return;

            // Normalisation de date
            let formattedDate = rawDate;
            const dParts = rawDate.split(/[/-]/);
            if (dParts.length === 3) {
              if (dParts[2].length === 4) {
                formattedDate = `${dParts[2]}-${dParts[1].padStart(2, '0')}-${dParts[0].padStart(2, '0')}`;
              } else if (dParts[0].length === 4) {
                formattedDate = `${dParts[0]}-${dParts[1].padStart(2, '0')}-${dParts[2].padStart(2, '0')}`;
              }
            }
            if (!formattedDate || formattedDate.length < 10) {
              formattedDate = new Date().toISOString().substring(0, 10);
            }

            const category = amount > 0 ? 'Salaire & Revenus' : 'Autre';
            const flowType = classifyFlowType(category, amount, description);

            parsed.push({
              id: `csv_${Date.now()}_${idx}`,
              date: formattedDate,
              description,
              amount,
              flowType,
              category,
              account: 'Compte Principal',
              status: flowType === 'SAVINGS_TRANSFER' ? 'Internal Transfer' : 'Reconciled'
            });
          });

          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      },
      error: (err) => reject(err)
    });
  });
}
