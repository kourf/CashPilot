export interface Transaction {
  id?: string;
  date: string;
  monthKey: string;
  rawLabel: string;
  cleanLabel: string;
  description?: string;
  amount: number;
  direction: 'credit' | 'debit';
  category: string;
  subcategory?: string;
  nature?: 'fixe' | 'variable' | 'exceptionnelle' | 'autre';
  isSubscription?: boolean;
  isBankFee?: boolean;
  isInternalTransfer?: boolean;
  isFamilyTransfer?: boolean;
  isInstallment?: boolean;
  needsConfirmation?: boolean;
  bankName?: string;
  accountName?: string;
  matchedRule?: string;
  ruleExplanation?: string;
  [key: string]: any;
}

export interface KPIResult {
  revenus: number;
  depenses: number;
  resteAVivre: number;
  budgetJournalier: number;
  fixe: number;
  variable: number;
  exceptionnelle: number;
  epargne: number;
  remboursements: number;
  abonnements: number;
  frais: number;
  txCount: number;
  topDepense: number;
  topCategory: string;
  initialBalance: number;
  currentBalance: number;
}

/**
 * Nettoie et convertit une saisie utilisateur de montant/solde en nombre flottant.
 * Gère les virgules, points, espaces superflus (espaces insécables inclus) et signes négatifs.
 */
export const parseBalanceInput = (value: string): number => {
  if (!value) return NaN;
  // Nettoyage de tous les espaces superflus (y compris \u00A0, \u202F, \u2007)
  const cleaned = value
    .trim()
    .replace(/[\s\u00A0\u202F\u2007]+/g, '')
    .replace(',', '.');
  
  // Suppression des caractères parasites tout en préservant chiffres, point et signe moins
  const sanitized = cleaned.replace(/[^0-9.-]/g, '');
  if (!sanitized || sanitized === '-' || sanitized === '.' || sanitized === '-.') return NaN;
  
  const parsed = parseFloat(sanitized);
  return isNaN(parsed) ? NaN : parsed;
};

/**
 * Rétro-calcul du Solde de Départ (Point Zéro pour le Reste à Vivre) :
 * Solde de départ = Solde saisi par l'utilisateur aujourd'hui - Somme totale des flux importés
 */
export const calculateStartingBalance = (
  userCurrentBalance: number,
  totalImportedFlows: number
): number => {
  return Math.round((userCurrentBalance - totalImportedFlows) * 100) / 100;
};

/**
 * Calcule la somme totale nette de tous les flux importés (Crédits positifs + Débits négatifs)
 */
export const calculateTotalFlows = (
  transactions: { amount: number; direction?: 'credit' | 'debit'; [key: string]: any }[]
): number => {
  const sum = transactions.reduce((acc, t) => {
    const rawAmt = Number(t.amount) || 0;
    const signed = t.direction === 'debit'
      ? -Math.abs(rawAmt)
      : (t.direction === 'credit' ? Math.abs(rawAmt) : rawAmt);
    return acc + signed;
  }, 0);
  return Math.round(sum * 100) / 100;
};

import { categorizeTransactionWithRule, CATEGORIES_METADATA } from './categorizationRules.ts';

/**
 * Fallback logique pour enrichir une transaction si l'IA a échoué
 */
export const enrichTransactionFallback = (tx: Transaction): Transaction => {
  const label = tx.cleanLabel || tx.rawLabel || tx.description || '';
  const amt = Number(tx.amount) || 0;
  const match = categorizeTransactionWithRule(label, amt);

  const category = (tx.category && tx.category !== 'Autre' && tx.category !== 'Autres' && tx.category !== 'Inconnu')
    ? tx.category
    : match.category;

  const nature = tx.nature && tx.nature !== ('Inconnu' as any)
    ? tx.nature
    : (CATEGORIES_METADATA[category]?.defaultNature || match.nature);

  const isInternalTransfer = tx.isInternalTransfer !== undefined
    ? Boolean(tx.isInternalTransfer)
    : match.isInternalTransfer;

  const isFamilyTransfer = tx.isFamilyTransfer !== undefined
    ? Boolean(tx.isFamilyTransfer)
    : match.isFamilyTransfer;

  const isSubscription = tx.isSubscription !== undefined
    ? Boolean(tx.isSubscription)
    : match.isSubscription;

  const isBankFee = tx.isBankFee !== undefined
    ? Boolean(tx.isBankFee)
    : match.isBankFee;

  const isInstallment = tx.isInstallment !== undefined
    ? Boolean(tx.isInstallment)
    : (category === 'Paiement fractionné' || category.includes('Amex'));

  const matchedRule = tx.matchedRule || match.matchedRule;
  const ruleExplanation = tx.ruleExplanation || match.ruleExplanation;

  return {
    ...tx,
    category,
    nature,
    isInternalTransfer,
    isFamilyTransfer,
    isSubscription,
    isBankFee,
    isInstallment,
    matchedRule,
    ruleExplanation
  };
};

export const filterByMonth = (transactions: Transaction[], monthKey: string): Transaction[] => {
  if (!monthKey || monthKey === 'all') return transactions;
  return transactions.filter(tx => tx.monthKey === monthKey);
};

export const calculateKpis = (transactions: Transaction[], initialBalance: number = 0): KPIResult => {
  let revenus = 0;
  let depenses = 0;
  let fixe = 0;
  let variable = 0;
  let exceptionnelle = 0;
  let epargne = 0;
  let remboursements = 0;
  let abonnements = 0;
  let frais = 0;
  let maxDepense = 0;

  const categoryTotals: Record<string, number> = {};

  transactions.forEach(rawTx => {
    const t = enrichTransactionFallback(rawTx);
    const amt = t.amount || 0;
    const isIncome = amt > 0;
    const isExpense = amt < 0;
    const absAmt = Math.abs(amt);

    // NEUTRALISATION STRICTE :
    // Virements internes, épargne neutralisée, cartes à débit différé (Amex) et paiements fractionnés
    // NE SONT JAMAIS déduits des dépenses réelles de consommation pour éviter tout double comptage !
    if (
      t.isInternalTransfer ||
      t.category === 'Virements internes' ||
      t.category === 'Virements Internes' ||
      t.category === 'Remboursement Carte (Amex)' ||
      (t.isInstallment && t.category === 'Paiement fractionné')
    ) {
      return;
    }

    // Flux familiaux / Solidarité isolés pour ne pas polluer les dépenses courantes
    if (t.category === 'Solidarité' || t.category === 'Remboursements/Avances') {
      if (isIncome) remboursements += amt;
      return;
    }

    // Ignorer le solde de départ pour le reste à vivre, il est ajouté à un solde de départ global si besoin.
    // Mais on peut le compter dans les revenus globaux si on veut,
    // ou plutôt l'exclure du calcul des revenus normaux pour ne pas fausser le budget du mois.
    if (t.isStartingBalance || t.category === "Solde de départ") return;

    if (isIncome) {
      if (t.category === 'Remboursements' || t.category === 'Remboursements/Avances') {
        remboursements += amt;
      } else {
        revenus += amt;
      }
    } else if (isExpense) {
      if (t.category === 'Épargne' || t.category === 'Épargne & Investissement') {
        epargne += absAmt;
      } else {
        depenses += absAmt;
        if (absAmt > maxDepense) maxDepense = absAmt;
        
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + absAmt;

        if (t.nature === 'fixe') fixe += absAmt;
        else if (t.nature === 'variable') variable += absAmt;
        else if (t.nature === 'exceptionnelle') exceptionnelle += absAmt;

        if (t.category === 'Abonnements' || t.category === 'Abonnements & Télécom' || t.isSubscription) abonnements += absAmt;
        if (t.category === 'Frais bancaires' || t.isBankFee) frais += absAmt;
      }
    }
  });

  // Reste à vivre : intègre le solde de départ (point zéro) + revenus nets réels - dépenses réelles
  const resteAVivre = Math.round((initialBalance + revenus - depenses) * 100) / 100;
  const budgetJournalier = resteAVivre > 0 ? Math.round((resteAVivre / 30) * 100) / 100 : 0;
  const currentBalance = Math.round((initialBalance + revenus + remboursements - depenses - epargne) * 100) / 100;

  let topCategory = 'Aucune';
  let maxCatAmount = 0;
  Object.entries(categoryTotals).forEach(([cat, total]) => {
    if (total > maxCatAmount) {
      maxCatAmount = total;
      topCategory = cat;
    }
  });

  return {
    revenus,
    depenses,
    resteAVivre,
    budgetJournalier,
    fixe,
    variable,
    exceptionnelle,
    epargne,
    remboursements,
    abonnements,
    frais,
    txCount: transactions.length,
    topDepense: maxDepense,
    topCategory,
    initialBalance,
    currentBalance
  };
};

export const formatMonthLabel = (monthKey: string) => {
  if (!monthKey || monthKey === 'all') return "Tous les mois";
  const [year, month] = monthKey.split('-');
  if (!year || !month) return monthKey;
  const date = new Date(parseInt(year), parseInt(month) - 1);
  const mLabel = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(date);
  return mLabel.charAt(0).toUpperCase() + mLabel.slice(1);
};

export const getAvailableMonths = (transactions: Transaction[]) => {
  const months = new Set<string>();
  transactions.forEach(tx => {
    if (tx.monthKey) months.add(tx.monthKey);
    else if (tx.date && tx.date.length >= 7) months.add(tx.date.substring(0, 7));
  });
  return Array.from(months).sort().reverse();
};

export const buildSankeyData = (kpis: KPIResult, pieData: {name: string, value: number}[] = []) => {
  const formatEuros = (val: number) => `${Math.round(val)} €`;

  const nodes: {name: string}[] = [];
  const links: {source: number, target: number, value: number}[] = [];
  
  if (kpis.revenus <= 0 && kpis.depenses <= 0 && kpis.epargne <= 0 && kpis.resteAVivre <= 0) {
    return { nodes: [], links: [] };
  }

  const nodeMap = new Map<string, number>();
  
  const getNodeIndex = (name: string) => {
    if (!nodeMap.has(name)) {
      nodeMap.set(name, nodes.length);
      nodes.push({ name });
    }
    return nodeMap.get(name)!;
  };

  const initialBal = kpis.initialBalance || 0;
  const totalFunds = Math.max(0, initialBal + kpis.revenus);

  const INIT = `Solde initial - ${formatEuros(initialBal)}`;
  const ENC = `Encaissements - ${formatEuros(kpis.revenus)}`;
  const REV = `Revenus - ${formatEuros(kpis.revenus)}`;
  const BUDG = `Fonds disponibles - ${formatEuros(totalFunds)}`;
  const DEC = `Décaissements - ${formatEuros(kpis.depenses)}`;
  const EPA = `Épargne - ${formatEuros(kpis.epargne)}`;
  const RAV = `Reste à vivre - ${formatEuros(kpis.resteAVivre > 0 ? kpis.resteAVivre : 0)}`;

  if (initialBal > 0) {
    links.push({ source: getNodeIndex(INIT), target: getNodeIndex(BUDG), value: initialBal });
  }

  if (kpis.revenus > 0) {
    links.push({ source: getNodeIndex(ENC), target: getNodeIndex(REV), value: kpis.revenus });
    links.push({ source: getNodeIndex(REV), target: getNodeIndex(BUDG), value: kpis.revenus });
  }

  const rootNode = totalFunds > 0 ? getNodeIndex(BUDG) : getNodeIndex(`Fonds disponibles - ${formatEuros(kpis.depenses + kpis.epargne + (kpis.resteAVivre > 0 ? kpis.resteAVivre : 0))}`);

  if (kpis.depenses > 0) {
    links.push({ source: rootNode, target: getNodeIndex(DEC), value: kpis.depenses });
    pieData.forEach(item => {
      if (item.value > 0) {
        links.push({ source: getNodeIndex(DEC), target: getNodeIndex(`${item.name} - ${formatEuros(item.value)}`), value: item.value });
      }
    });
  }

  if (kpis.epargne > 0) {
    links.push({ source: rootNode, target: getNodeIndex(EPA), value: kpis.epargne });
  }

  if (kpis.resteAVivre > 0) {
    links.push({ source: rootNode, target: getNodeIndex(RAV), value: kpis.resteAVivre });
  }

  return { nodes, links };
};

export const buildCategoryBreakdown = (transactions: Transaction[]) => {
  const categoryTotals: Record<string, number> = {};
  let totalExpenses = 0;

  transactions.forEach(rawTx => {
    const t = enrichTransactionFallback(rawTx);
    const amt = t.amount || 0;
    if (amt < 0 && t.category !== 'Virements internes' && t.category !== 'Épargne') {
      const absAmt = Math.abs(amt);
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + absAmt;
      totalExpenses += absAmt;
    }
  });

  return Object.entries(categoryTotals)
    .map(([name, value]) => ({
      name,
      value,
      percentage: totalExpenses > 0 ? (value / totalExpenses) * 100 : 0
    }))
    .sort((a, b) => b.value - a.value);
};

export interface BankReconciliationResult {
  initialBalance: number;
  totalDebits: number;
  totalCredits: number;
  calculatedBalance: number;
  closingBalance: number;
  discrepancy: number;
  isReconciled: boolean;
}

export const calculateReconciliation = (
  initialBalance: number,
  closingBalance: number,
  transactions: { type: 'debit' | 'credit'; amount: number }[]
): BankReconciliationResult => {
  let totalDebits = 0;
  let totalCredits = 0;

  transactions.forEach(t => {
    const absAmt = Math.abs(t.amount || 0);
    if (t.type === 'credit') {
      totalCredits += absAmt;
    } else {
      totalDebits += absAmt;
    }
  });

  const calculatedBalance = Math.round((initialBalance + totalCredits - totalDebits) * 100) / 100;
  const discrepancy = Math.round((calculatedBalance - closingBalance) * 100) / 100;
  const isReconciled = Math.abs(discrepancy) < 0.01;

  return {
    initialBalance,
    totalDebits: Math.round(totalDebits * 100) / 100,
    totalCredits: Math.round(totalCredits * 100) / 100,
    calculatedBalance,
    closingBalance,
    discrepancy,
    isReconciled
  };
};

export const calculateRunningBalances = (
  initialBalance: number,
  transactions: { id: string; date: string; type: 'debit' | 'credit'; amount: number }[]
): Map<string, number> => {
  // Sort transactions in ascending chronological order
  const sorted = [...transactions].sort((a, b) => {
    const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });

  const balanceMap = new Map<string, number>();
  let currentBalance = initialBalance;

  sorted.forEach(tx => {
    const absAmt = Math.abs(tx.amount || 0);
    if (tx.type === 'credit') {
      currentBalance += absAmt;
    } else {
      currentBalance -= absAmt;
    }
    balanceMap.set(tx.id, Math.round(currentBalance * 100) / 100);
  });

  return balanceMap;
};

export const formatBankAmount = (
  amount: number,
  currency: 'CHF' | 'EUR' = 'EUR',
  options?: { showSign?: boolean }
): string => {
  const abs = Math.abs(amount);
  const isNeg = amount < 0;
  const isPos = amount > 0;
  const sign = options?.showSign ? (isPos ? '+' : isNeg ? '-' : '') : (isNeg ? '-' : '');
  const fixed = abs.toFixed(2);
  const [intPart, decPart] = fixed.split('.');

  if (currency === 'CHF') {
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
    return `${sign}${formattedInt}.${decPart} CHF`;
  } else {
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${sign}${formattedInt},${decPart} €`;
  }
};

/**
 * Détection robuste de la devise d'un relevé bancaire (CHF vs EUR).
 * Si CHF n'est pas détecté avec certitude, le fallback par défaut est STRICTEMENT 'EUR'.
 */
export const detectStatementCurrency = (contentOrHeader?: string): 'CHF' | 'EUR' => {
  if (!contentOrHeader) return 'EUR';
  const upper = contentOrHeader.toUpperCase();

  // Priorité absolue à l'Euro (€) si présent ou si banque / organisme français
  if (
    upper.includes('EUR') || 
    upper.includes('EUROS') || 
    upper.includes('€') ||
    upper.includes('FRANCE') ||
    upper.includes('FRANCE TRAVAIL') ||
    upper.includes('POLE EMPLOI') ||
    upper.includes('PÔLE EMPLOI') ||
    upper.includes('CAF') ||
    upper.includes('SOCIETE GENERALE') ||
    upper.includes('SOCIÉTÉ GÉNÉRALE') ||
    upper.includes('BOURSORAMA') ||
    upper.includes('BOURSO') ||
    upper.includes('FORTUNEO') ||
    upper.includes('CREDIT AGRICOLE') ||
    upper.includes('CRÉDIT AGRICOLE') ||
    upper.includes('BNP PARIBAS') ||
    upper.includes('LCL') ||
    upper.includes('CIC') ||
    upper.includes('CREDIT MUTUEL') ||
    upper.includes('CRÉDIT MUTUEL') ||
    upper.includes('LA BANQUE POSTALE') ||
    upper.includes('CAISSE D\'EPARGNE') ||
    upper.includes('CAISSE D\'ÉPARGNE') ||
    upper.includes('SOGESSUR') ||
    upper.includes('GROUPAMA') ||
    upper.includes('TOTALENERGIES') ||
    upper.includes('FR76') ||
    upper.includes('IBAN: FR')
  ) {
    return 'EUR';
  }

  // Seul un relevé de compte explicitement et purement suisse émis par une banque helvétique est en CHF.
  // Une simple transaction frontalière ou un abonnement en devises (ex: Swype CHF) ne doit JAMAIS changer la devise du relevé.
  const isChf = 
    (upper.includes('VALUTA: CHF') ||
     upper.includes('DEVISE DU COMPTE: CHF') ||
     upper.includes('MONNAIE DU COMPTE: CHF') ||
     upper.includes('POSTFINANCE') ||
     upper.includes('BANQUE CANTONALE')) &&
    !upper.includes('FR76') &&
    !upper.includes('FRANCE');

  return isChf ? 'CHF' : 'EUR';
};

/**
 * Dictionnaire statique de synonymes et mots-clés pour le calcul des médianes du simulateur "Coût de la vie".
 * Permet de rattacher avec rigueur les opérations réelles de relevés bancaires (EDF, ENGIE, VEOLIA, etc.)
 * aux postes de charges incompressibles du simulateur, sans aucun appel API externe.
 */
export const COST_OF_LIVING_SYNONYMS: Record<string, {
  categoryNames: string[];
  keywords: string[];
}> = {
  'Loyer / Crédit Immobilier': {
    categoryNames: ['Loyer / Charges', 'Logement & Énergie', 'Logement'],
    keywords: [
      'loyer', 'credit immobilier', 'crédit immobilier', 'pret immobilier', 'prêt immobilier',
      'bail', 'syndic', 'foncia', 'nexity', 'echeance pret', 'échéance prêt', 'mensualite pret',
      'mensualité prêt', 'agence immobiliere', 'immobilier'
    ]
  },
  'Électricité / Gaz': {
    categoryNames: ['Électricité, Gaz, Eau', 'Logement & Énergie', 'Énergie'],
    keywords: [
      'edf', 'engie', 'totalenergies', 'total energies', 'eni', 'gaz', 'electricite', 'électricité',
      'gaz de bordeaux', 'direct energie', 'ekwateur', 'enercoop', 'sowee', 'enedis', 'grdf',
      'ohm energie', 'alpiq', 'elec'
    ]
  },
  'Eau': {
    categoryNames: ['Électricité, Gaz, Eau', 'Logement & Énergie', 'Eau'],
    keywords: [
      'eau', 'veolia', 'suez', 'eau de paris', 'eaux', 'saur', 'distrib eau', 'societe des eaux',
      'syndicat des eaux', 'eau du bassin', 'facture eau'
    ]
  },
  'Assurances': {
    categoryNames: ['Assurances'],
    keywords: [
      'assurance', 'macif', 'maif', 'matmut', 'axa', 'allianz', 'mma', 'direct assurance',
      'generali', 'groupama', 'gmf', 'alan', 'pacifica', 'assur', 'abeille assurances',
      'suravenir', 'cardif', 'aviva', 'swiss life', 'cnp'
    ]
  },
  'Santé & Mutuelle': {
    categoryNames: ['Santé & Mutuelle', 'Santé'],
    keywords: [
      'mutuelle', 'sante', 'santé', 'mgen', 'harmonie mutuelle', 'pro btp', 'pharmacie',
      'doctolib', 'dentiste', 'laboratoire', 'cpam', 'medecin', 'kine', 'opticien', 'alain afflelou',
      'optic 2000', 'krys', 'centre medical', 'hopital', 'clinique', 'solimut'
    ]
  },
  'Courses Alimentaires': {
    categoryNames: ['Alimentation & Courses', 'Courses', 'Alimentation'],
    keywords: [
      'courses', 'carrefour', 'auchan', 'leclerc', 'lidl', 'intermarche', 'intermarché',
      'monoprix', 'franprix', 'aldi', 'casino', 'picard', 'biocoop', 'boulangerie', 'boucherie',
      'super u', 'hyper u', 'grand frais', 'naturalia', 'action', 'cora', 'match', 'leader price'
    ]
  },
  'Carburant / Péages': {
    categoryNames: ['Carburant & Péages', 'Transports & Carburant', 'Carburant'],
    keywords: [
      'carburant', 'essence', 'gazole', 'total access', 'totalenergies rel', 'station',
      'bp ', 'esso', 'peage', 'péage', 'aprr', 'vinci', 'sanef', 'autoroute', 'avia', 'shell',
      'relais', 'station service'
    ]
  },
  'Transports en commun': {
    categoryNames: ['Transports', 'Transports & Carburant'],
    keywords: [
      'transports', 'sncf', 'ratp', 'navigo', 'tcl', 'transpole', 'ter', 'bus', 'tramway',
      'metro', 'métro', 'train', 'ile de france mobilites', 'keolis', 'transdev'
    ]
  },
  'Abonnements & Télécom': {
    categoryNames: ['Abonnements & Télécom', 'Abonnements'],
    keywords: [
      'orange', 'sfr', 'free mobile', 'freebox', 'free telecom', 'bouygues', 'sosh', 'red by sfr',
      'netflix', 'spotify', 'deezer', 'apple', 'google one', 'youtube', 'amazon prime', 'disney',
      'canal', 'basic fit', 'fitness park', 'forfait', 'cloud', 'icloud', 'chatgpt', 'openai'
    ]
  }
};

/**
 * Vérifie si une transaction bancaire correspond à un poste du simulateur Coût de la vie
 * en interrogeant son libellé via le dictionnaire de synonymes/mots-clés ou sa catégorie.
 */
export const matchesCostOfLivingItem = (tx: Transaction, itemName: string): boolean => {
  const mapping = COST_OF_LIVING_SYNONYMS[itemName];
  if (!mapping) return false;

  const rawLabel = (tx.cleanLabel || tx.rawLabel || tx.description || '').toLowerCase();
  const txCat = (tx.category || '').toLowerCase();

  // 1. Détection prioritaire par mot-clé dans le libellé bancaire
  if (mapping.keywords.some(kw => rawLabel.includes(kw))) {
    return true;
  }

  // 2. Détection par nom de catégorie avec désambiguïsation
  if (mapping.categoryNames.some(cat => txCat === cat.toLowerCase())) {
    if (txCat.includes('logement') || txCat.includes('energie') || txCat.includes('énergie') || txCat.includes('électricité')) {
      if (itemName === 'Eau') {
        return mapping.keywords.some(kw => rawLabel.includes(kw));
      }
      if (itemName === 'Électricité / Gaz') {
        const isEau = COST_OF_LIVING_SYNONYMS['Eau'].keywords.some(kw => rawLabel.includes(kw));
        if (isEau) return false;
        return mapping.keywords.some(kw => rawLabel.includes(kw)) || !COST_OF_LIVING_SYNONYMS['Loyer / Crédit Immobilier'].keywords.some(kw => rawLabel.includes(kw));
      }
      if (itemName === 'Loyer / Crédit Immobilier') {
        const isElec = COST_OF_LIVING_SYNONYMS['Électricité / Gaz'].keywords.some(kw => rawLabel.includes(kw));
        const isEau = COST_OF_LIVING_SYNONYMS['Eau'].keywords.some(kw => rawLabel.includes(kw));
        return !isElec && !isEau;
      }
    }
    return true;
  }

  return false;
};

/**
 * Calcule la médiane mensuelle des dépenses pour chaque catégorie ET pour chaque poste du simulateur.
 * Retourne un objet où chaque clé est une catégorie ou un poste de charge, et la valeur est la médiane
 * mensuelle calculée ainsi que les transactions associées.
 */
export const calculateCategoryMedians = (transactions: Transaction[]): Record<string, { median: number; sampleTx: Transaction[] }> => {
  const categoryMonthSums: Record<string, Record<string, number>> = {};
  const categorySamples: Record<string, Transaction[]> = {};

  // Structures spécifiques pour les postes du simulateur basés sur les synonymes
  const itemMonthSums: Record<string, Record<string, number>> = {};
  const itemSamples: Record<string, Transaction[]> = {};
  Object.keys(COST_OF_LIVING_SYNONYMS).forEach(itemName => {
    itemMonthSums[itemName] = {};
    itemSamples[itemName] = [];
  });

  transactions.forEach(t => {
    const isIncome = t.rawAmount !== undefined 
      ? t.rawAmount >= 0 
      : (t.type === 'credit' || t.direction === 'credit' || (t.amount > 0 && t.type !== 'debit' && t.direction !== 'debit'));
      
    if (isIncome || t.category === 'Virements Internes' || t.category === 'Virements internes' || t.category === 'Épargne & Investissement') return;
    
    const cat = t.category || 'Autre';
    const month = t.monthKey || t.date?.substring(0, 7) || 'Unknown';
    const absAmt = Math.abs(t.amount);
    
    if (!categoryMonthSums[cat]) {
      categoryMonthSums[cat] = {};
      categorySamples[cat] = [];
    }
    if (!categoryMonthSums[cat][month]) {
      categoryMonthSums[cat][month] = 0;
    }
    categoryMonthSums[cat][month] += absAmt;
    if (categorySamples[cat].length < 15) {
      categorySamples[cat].push(t);
    }

    // Association aux postes de charges via le dictionnaire de synonymes
    Object.keys(COST_OF_LIVING_SYNONYMS).forEach(itemName => {
      if (matchesCostOfLivingItem(t, itemName)) {
        if (!itemMonthSums[itemName][month]) {
          itemMonthSums[itemName][month] = 0;
        }
        itemMonthSums[itemName][month] += absAmt;
        if (itemSamples[itemName].length < 15) {
          itemSamples[itemName].push(t);
        }
      }
    });
  });

  const results: Record<string, { median: number; sampleTx: Transaction[] }> = {};
  
  // 1. Calcul des médianes par catégorie standard
  for (const cat in categoryMonthSums) {
    const sums = Object.values(categoryMonthSums[cat]);
    if (sums.length === 0) {
      results[cat] = { median: 0, sampleTx: [] };
      continue;
    }
    sums.sort((a, b) => a - b);
    const mid = Math.floor(sums.length / 2);
    let median = sums.length % 2 === 0 ? (sums[mid - 1] + sums[mid]) / 2 : sums[mid];
    categorySamples[cat].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    results[cat] = { median: Math.round(median), sampleTx: categorySamples[cat] };
  }

  // 2. Calcul des médianes pour les postes du simulateur (avec règle des synonymes)
  for (const itemName in itemMonthSums) {
    const sums = Object.values(itemMonthSums[itemName]);
    if (sums.length === 0) {
      results[itemName] = { median: 0, sampleTx: [] };
      continue;
    }
    sums.sort((a, b) => a - b);
    const mid = Math.floor(sums.length / 2);
    let median = sums.length % 2 === 0 ? (sums[mid - 1] + sums[mid]) / 2 : sums[mid];
    itemSamples[itemName].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    results[itemName] = { median: Math.round(median), sampleTx: itemSamples[itemName] };
  }
  
  return results;
};
