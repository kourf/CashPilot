export type FlowType = 'INCOME' | 'FIXED_EXPENSE' | 'VARIABLE_EXPENSE' | 'SAVINGS_TRANSFER';

export interface ParsedTransaction {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  flowType: FlowType;
  category: string;
  account: string;
  bankName?: string;
  isSubscription?: boolean;
  subscriptionDay?: number;
}

export const SUBSCRIPTION_KEYWORDS = [
  'netflix', 'spotify', 'deezer', 'apple', 'apple bill', 'itunes', 'icloud',
  'amazon prime', 'prime video', 'disney', 'youtube', 'canal+', 'canal plus',
  'paramount', 'free mobile', 'free telecom', 'orange', 'sfr', 'bouygues', 'sosh',
  'red by sfr', 'edf', 'engie', 'totalenergies', 'total energie', 'eni', 'direct energie',
  'veolia', 'suez', 'eau de', 'basic fit', 'fitness park', 'neoness', 'keep cool',
  'gymlib', 'salle de sport', 'assurance', 'mutuelle', 'allianz', 'axa', 'macif',
  'maif', 'matmut', 'generali', 'alan', 'april', 'chatgpt', 'openai', 'midjourney',
  'adobe', 'google one', 'google storage', 'microsoft 365', 'office 365', 'playstation network',
  'psn', 'xbox game pass', 'nintendo switch online', 'le figaro', 'le monde', 'mediapart'
];

export const INTERNAL_TRANSFER_KEYWORDS = [
  'virement interne', 'vir compte a compte', 'compte a compte', 'livret a', 'ldds', 'lep',
  'compte epargne', 'vers livret', 'de livret', 'virement emis vers', 'virement recu de',
  'vir sepa m dramé', 'virement drame', 'epargne', 'épargne', 'pel', 'cel', 'assurance vie',
  'trade republic', 'degiro', 'binance', 'coinbase', 'pea', 'compte titres', 'bourse',
  'vir interne', 'virement entre vos comptes', 'remise cheque epargne', 'placement'
];

/**
 * Formatage d'une clé de mois en libellé français élégant (ex: '2026-05' -> 'Mai 2026')
 */
export function formatMonthLabel(monthKey: string): string {
  if (!monthKey || monthKey === 'all') return 'Toutes périodes';
  const parts = monthKey.split('-');
  if (parts.length === 2) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    if (!isNaN(year) && !isNaN(month) && month >= 1 && month <= 12) {
      const date = new Date(year, month - 1, 1);
      const label = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      return label.charAt(0).toUpperCase() + label.slice(1);
    }
  }
  return monthKey;
}

/**
 * Analyse sémantique et financière d'une opération pour déterminer son flux et sa catégorie
 */
export function categorizeTransaction(
  description: string,
  amount: number,
  dateStr?: string
): { flowType: FlowType; category: string; isSubscription: boolean; subscriptionDay?: number } {
  const desc = (description || '').toLowerCase();

  // Extraction du jour du prélèvement si date fournie
  let subscriptionDay: number | undefined = undefined;
  if (dateStr) {
    try {
      const parts = dateStr.split(/[-/]/);
      if (parts.length === 3) {
        const d = parts[0].length === 4 ? parseInt(parts[2], 10) : parseInt(parts[0], 10);
        if (!isNaN(d) && d >= 1 && d <= 31) subscriptionDay = d;
      }
    } catch (e) {}
  }

  // 1. Check for Internal Transfers & Savings first (Neutral flow)
  const isInternal = INTERNAL_TRANSFER_KEYWORDS.some(k => desc.includes(k));
  if (isInternal) {
    return {
      flowType: 'SAVINGS_TRANSFER',
      category: 'Épargne & Investissement',
      isSubscription: false,
    };
  }

  // 2. Positive amounts -> Incomes
  if (amount > 0) {
    if (
      desc.includes('salaire') ||
      desc.includes('paye') ||
      desc.includes('paie') ||
      desc.includes('remuneration') ||
      desc.includes('rémunération') ||
      desc.includes('virement recu') ||
      desc.includes('virement reçu') ||
      desc.includes('pole emploi') ||
      desc.includes('france travail') ||
      desc.includes('caf') ||
      desc.includes('cpam') ||
      desc.includes('remboursement')
    ) {
      return { flowType: 'INCOME', category: 'Salaire & Revenus', isSubscription: false };
    }
    return { flowType: 'INCOME', category: 'Salaire & Revenus', isSubscription: false };
  }

  // 3. Subscriptions / Fixed expenses
  const isSub = SUBSCRIPTION_KEYWORDS.some(k => desc.includes(k));
  if (isSub) {
    if (
      desc.includes('edf') ||
      desc.includes('engie') ||
      desc.includes('totalenergies') ||
      desc.includes('loyer') ||
      desc.includes('bail') ||
      desc.includes('eau')
    ) {
      return {
        flowType: 'FIXED_EXPENSE',
        category: 'Logement & Énergie',
        isSubscription: true,
        subscriptionDay
      };
    }
    return {
      flowType: 'FIXED_EXPENSE',
      category: 'Abonnements & Services',
      isSubscription: true,
      subscriptionDay
    };
  }

  if (
    desc.includes('loyer') ||
    desc.includes('immobilier') ||
    desc.includes('syndic') ||
    desc.includes('assurance habitation') ||
    desc.includes('quittance')
  ) {
    return { flowType: 'FIXED_EXPENSE', category: 'Logement & Loyer', isSubscription: false };
  }

  if (
    desc.includes('frais tenue') ||
    desc.includes('cotisation carte') ||
    desc.includes('commission d intervention') ||
    desc.includes('agios')
  ) {
    return { flowType: 'FIXED_EXPENSE', category: 'Frais bancaires', isSubscription: false };
  }

  // 4. Variable Expenses by merchant / nature
  if (
    desc.includes('carrefour') ||
    desc.includes('auchan') ||
    desc.includes('lidl') ||
    desc.includes('leclerc') ||
    desc.includes('monoprix') ||
    desc.includes('intermarche') ||
    desc.includes('intermarché') ||
    desc.includes('courses') ||
    desc.includes('boulangerie') ||
    desc.includes('aldi') ||
    desc.includes('super u') ||
    desc.includes('franprix') ||
    desc.includes('biocoop') ||
    desc.includes('picard') ||
    desc.includes('boucherie') ||
    desc.includes('primeur')
  ) {
    return { flowType: 'VARIABLE_EXPENSE', category: 'Alimentation & Courses', isSubscription: false };
  }

  if (
    desc.includes('uber eats') ||
    desc.includes('deliveroo') ||
    desc.includes('just eat') ||
    desc.includes('restaurant') ||
    desc.includes('mcdo') ||
    desc.includes('mcdonald') ||
    desc.includes('burger king') ||
    desc.includes('kfc') ||
    desc.includes('subway') ||
    desc.includes('pizza') ||
    desc.includes('sushi') ||
    desc.includes('brasserie') ||
    desc.includes('bistrot') ||
    desc.includes('cafe') ||
    desc.includes('café') ||
    desc.includes('bar ') ||
    desc.includes('cinema') ||
    desc.includes('cinéma') ||
    desc.includes('ugc') ||
    desc.includes('pathe')
  ) {
    return { flowType: 'VARIABLE_EXPENSE', category: 'Restaurants & Sorties', isSubscription: false };
  }

  if (
    desc.includes('sncf') ||
    desc.includes('ratp') ||
    desc.includes('navigo') ||
    desc.includes('tpg') ||
    desc.includes('cff') ||
    desc.includes('total') ||
    desc.includes('esso') ||
    desc.includes('bp ') ||
    desc.includes('shell') ||
    desc.includes('essence') ||
    desc.includes('carburant') ||
    desc.includes('peage') ||
    desc.includes('péage') ||
    desc.includes('station') ||
    desc.includes('uber') ||
    desc.includes('blablacar') ||
    desc.includes('parking')
  ) {
    const isNavigo = desc.includes('navigo') || desc.includes('abonnement transport');
    return {
      flowType: isNavigo ? 'FIXED_EXPENSE' : 'VARIABLE_EXPENSE',
      category: 'Transports & Véhicule',
      isSubscription: isNavigo,
      subscriptionDay: isNavigo ? subscriptionDay : undefined
    };
  }

  if (
    desc.includes('pharmacie') ||
    desc.includes('doctolib') ||
    desc.includes('medecin') ||
    desc.includes('médecin') ||
    desc.includes('laboratoire') ||
    desc.includes('dentiste') ||
    desc.includes('kine') ||
    desc.includes('optique') ||
    desc.includes('hopital')
  ) {
    return { flowType: 'VARIABLE_EXPENSE', category: 'Santé', isSubscription: false };
  }

  if (
    desc.includes('amazon') ||
    desc.includes('fnac') ||
    desc.includes('darty') ||
    desc.includes('zara') ||
    desc.includes('h&m') ||
    desc.includes('ikea') ||
    desc.includes('decathlon') ||
    desc.includes('leroy merlin') ||
    desc.includes('castorama')
  ) {
    return { flowType: 'VARIABLE_EXPENSE', category: 'Shopping & Maison', isSubscription: false };
  }

  return { flowType: 'VARIABLE_EXPENSE', category: 'Autre', isSubscription: false };
}

/**
 * Détection et parsing universel de fichiers CSV bancaires
 * Évite rigoureusement de capturer des colonnes 'Compte' / 'Compte Bancaire' en guise de description !
 */
export function parseCSVBankStatement(
  csvContent: string,
  defaultAccount = 'Compte Courant',
  defaultBank = 'Banque'
): ParsedTransaction[] {
  const allLines = csvContent.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (allLines.length < 2) return [];

  // Détection du délimiteur et de la ligne d'en-tête réelle
  let headerLineIndex = 0;
  let bestKeywordScore = -1;

  for (let i = 0; i < Math.min(10, allLines.length); i++) {
    const lineNorm = allLines[i].toLowerCase();
    let score = 0;
    if (lineNorm.includes('date')) score += 3;
    if (lineNorm.includes('libell') || lineNorm.includes('desc') || lineNorm.includes('motif') || lineNorm.includes('operation')) score += 3;
    if (lineNorm.includes('montant') || lineNorm.includes('debit') || lineNorm.includes('credit') || lineNorm.includes('valeur')) score += 3;
    if (score > bestKeywordScore) {
      bestKeywordScore = score;
      headerLineIndex = i;
    }
  }

  const sampleLine = allLines[headerLineIndex];
  const delimiter = sampleLine.includes(';') ? ';' : sampleLine.includes('\t') ? '\t' : ',';

  const rawHeaders = allLines[headerLineIndex].split(delimiter).map(h => 
    h.trim().replace(/^["']|["']$/g, '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  );

  // Recherche des index de colonnes
  const dateIdx = rawHeaders.findIndex(h => h.includes('date') || h.includes('jour'));
  
  // Index du compte bancaire (si présent)
  const accountIdx = rawHeaders.findIndex(h => 
    (h.includes('compte') || h.includes('account') || h.includes('iban') || h.includes('rib')) &&
    !h.includes('libell') && !h.includes('desc')
  );

  // Index des montants
  const amountIdx = rawHeaders.findIndex(h => h.includes('montant') || h.includes('valeur') || h.includes('euros') || h.includes('total'));
  const debitIdx = rawHeaders.findIndex(h => h.includes('debit'));
  const creditIdx = rawHeaders.findIndex(h => h.includes('credit'));

  // Index de la description (libellé du marchand ou de l'opération)
  let descIdx = rawHeaders.findIndex(h => 
    (h.includes('libell') || h.includes('desc') || h.includes('texte') || h.includes('operation') || 
     h.includes('detail') || h.includes('motif') || h.includes('communication') || h.includes('nom') || 
     h.includes('destinataire') || h.includes('beneficiaire') || h.includes('marchand')) &&
    h !== 'compte' && h !== 'compte bancaire' && h !== 'type de compte'
  );

  // Si non trouvé par mot clé direct, recherche de la meilleure colonne textuelle distincte
  if (descIdx === -1) {
    for (let c = 0; c < rawHeaders.length; c++) {
      if (c !== dateIdx && c !== amountIdx && c !== debitIdx && c !== creditIdx && c !== accountIdx) {
        descIdx = c;
        break;
      }
    }
  }

  // Échantillons pour vérifier si la colonne sélectionnée n'est pas un nom de compte redondant ('Compte Bancaire')
  const rowsData: string[][] = [];
  for (let i = headerLineIndex + 1; i < allLines.length; i++) {
    const rawCols = allLines[i].split(delimiter);
    if (rawCols.length >= 2) {
      rowsData.push(rawCols.map(c => c.trim().replace(/^["']|["']$/g, '')));
    }
  }

  // Vérification intelligente anti-dummy 'Compte Bancaire' :
  // Si la colonne descIdx a la valeur 'Compte Bancaire' ou 'Compte Courant' sur plus de 50% des lignes,
  // alors cette colonne est le compte, et on bascule sur la vraie colonne de libellé avec du texte varié !
  if (descIdx >= 0 && rowsData.length > 0) {
    const valuesInDescCol = rowsData.map(r => (r[descIdx] || '').toLowerCase());
    const isDummyAccountCol = valuesInDescCol.filter(v => v.includes('compte bancaire') || v === 'compte courant' || v === 'compte').length > rowsData.length * 0.5;
    
    if (isDummyAccountCol) {
      let alternativeIdx = -1;
      let maxDistinctValues = 0;
      for (let c = 0; c < rawHeaders.length; c++) {
        if (c !== dateIdx && c !== amountIdx && c !== debitIdx && c !== creditIdx && c !== descIdx) {
          const distinct = new Set(rowsData.map(r => r[c] || '')).size;
          if (distinct > maxDistinctValues) {
            maxDistinctValues = distinct;
            alternativeIdx = c;
          }
        }
      }
      if (alternativeIdx !== -1 && maxDistinctValues > 1) {
        descIdx = alternativeIdx;
      }
    }
  }

  const results: ParsedTransaction[] = [];

  rowsData.forEach((cols, i) => {
    // 1. Extraction et normalisation de la date
    let rawDate = dateIdx >= 0 && cols[dateIdx] ? cols[dateIdx] : cols[0];
    let formattedDate = new Date().toISOString().split('T')[0];

    if (rawDate) {
      // Gère JJ/MM/AAAA ou JJ-MM-AAAA
      const dmy = rawDate.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
      if (dmy) {
        formattedDate = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
      } else if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
        formattedDate = rawDate.slice(0, 10);
      }
    }

    // 2. Extraction du libellé réel
    let description = descIdx >= 0 && cols[descIdx] ? cols[descIdx] : '';
    description = description.replace(/\s+/g, ' ').trim();
    if (!description || description.toLowerCase() === 'compte bancaire') {
      const candidate = cols.find((val, idx) => 
        idx !== dateIdx && idx !== amountIdx && idx !== debitIdx && idx !== creditIdx &&
        val.length > 2 && !/^[\d.,+-]+$/.test(val) && val.toLowerCase() !== 'compte bancaire'
      );
      if (candidate) description = candidate.trim();
    }
    if (!description) description = 'Opération Bancaire';

    // 3. Extraction du montant
    let amount = 0;
    if (debitIdx >= 0 || creditIdx >= 0) {
      const debitRaw = debitIdx >= 0 && cols[debitIdx] ? cols[debitIdx] : '';
      const creditRaw = creditIdx >= 0 && cols[creditIdx] ? cols[creditIdx] : '';
      const cleanDebit = debitRaw.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
      const cleanCredit = creditRaw.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
      const debit = parseFloat(cleanDebit) || 0;
      const credit = parseFloat(cleanCredit) || 0;

      if (credit !== 0) amount = Math.abs(credit);
      else if (debit !== 0) amount = -Math.abs(debit);
    } else if (amountIdx >= 0 && cols[amountIdx]) {
      const cleanAmt = cols[amountIdx].replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
      amount = parseFloat(cleanAmt) || 0;
    } else {
      const lastVal = cols[cols.length - 1] || '';
      const cleanAmt = lastVal.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
      amount = parseFloat(cleanAmt) || 0;
    }

    if (isNaN(amount) || amount === 0) return;

    // 4. Détermination du compte
    const rowAccount = (accountIdx >= 0 && cols[accountIdx]) ? cols[accountIdx].trim() : defaultAccount;

    // 5. Classification sémantique
    const classification = categorizeTransaction(description, amount, formattedDate);

    results.push({
      id: `tx_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
      date: formattedDate,
      description,
      amount,
      flowType: classification.flowType,
      category: classification.category,
      account: rowAccount || defaultAccount,
      bankName: defaultBank,
      isSubscription: classification.isSubscription,
      subscriptionDay: classification.subscriptionDay
    });
  });

  return results;
}
