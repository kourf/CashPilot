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
  bankName?: string;
  accountName?: string;
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
}

/**
 * Fallback logique pour enrichir une transaction si l'IA a échoué
 */
export const enrichTransactionFallback = (tx: Transaction): Transaction => {
  let { category, nature, cleanLabel, amount } = tx;
  const label = (cleanLabel || tx.rawLabel || tx.description || '').toLowerCase();
  
  if (!category || category === 'Autres' || category === 'Inconnu') {
    if (label.includes('salaire') || label.includes('paye') || label.includes('virement recu')) category = 'Revenus';
    else if (label.includes('loyer') || label.includes('prelevement loyer')) category = 'Logement';
    else if (label.includes('netflix') || label.includes('spotify') || label.includes('apple') || label.includes('abonnement')) category = 'Abonnements';
    else if (label.includes('livret') || label.includes('epargne') || label.includes('virement compte')) category = 'Épargne';
    else if (label.includes('frais') || label.includes('commission') || label.includes('agios') || label.includes('cotisation')) category = 'Frais bancaires';
    else if (label.includes('remboursement') || label.includes('refund') || label.includes('cpam') || label.includes('mutuelle')) category = 'Remboursements';
    else if (label.includes('carrefour') || label.includes('lidl') || label.includes('auchan') || label.includes('leclerc') || label.includes('intermarche')) category = 'Alimentation';
    else if (amount > 0) category = 'Revenus';
    else category = 'Autres';
  }

  // Use the legacy `type` field if `nature` isn't provided but `type` is.
  if (!nature || nature === 'Inconnu' || nature === 'Standard' as any) {
    if (tx.type === 'fixe' || tx.type === 'variable' || tx.type === 'exceptionnelle') {
      nature = tx.type as any;
    } else {
      if (category === 'Logement' || category === 'Abonnements' || category === 'Frais bancaires' || category === 'Assurance') {
        nature = 'fixe';
      } else if (category === 'Alimentation' || category === 'Transport' || category === 'Shopping' || category === 'Loisirs') {
        nature = 'variable';
      } else if (category === 'Revenus' || category === 'Remboursements' || category === 'Épargne' || category === 'Virements internes') {
        nature = 'autre'; // Not an expense per se
      } else {
        nature = 'exceptionnelle';
      }
    }
  }

  return { ...tx, category, nature };
};

export const filterByMonth = (transactions: Transaction[], monthKey: string): Transaction[] => {
  if (!monthKey || monthKey === 'all') return transactions;
  return transactions.filter(tx => tx.monthKey === monthKey);
};

export const calculateKpis = (transactions: Transaction[]): KPIResult => {
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

    if (t.category === 'Virements internes') return;

    if (isIncome) {
      if (t.category === 'Remboursements') {
        remboursements += amt;
      } else {
        revenus += amt;
      }
    } else if (isExpense) {
      if (t.category === 'Épargne') {
        epargne += absAmt;
      } else {
        depenses += absAmt;
        if (absAmt > maxDepense) maxDepense = absAmt;
        
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + absAmt;

        if (t.nature === 'fixe') fixe += absAmt;
        else if (t.nature === 'variable') variable += absAmt;
        else if (t.nature === 'exceptionnelle') exceptionnelle += absAmt;

        if (t.category === 'Abonnements' || t.isSubscription) abonnements += absAmt;
        if (t.category === 'Frais bancaires' || t.isBankFee) frais += absAmt;
      }
    }
  });

  const resteAVivre = revenus - depenses;
  const budgetJournalier = resteAVivre > 0 ? (resteAVivre / 30) : 0;

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
    topCategory
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

  const ENC = `Encaissements - ${formatEuros(kpis.revenus)}`;
  const REV = `Revenus - ${formatEuros(kpis.revenus)}`;
  const BUDG = `Budget disponible - ${formatEuros(kpis.revenus)}`;
  const DEC = `Décaissements - ${formatEuros(kpis.depenses)}`;
  const EPA = `Épargne - ${formatEuros(kpis.epargne)}`;
  const RAV = `Reste à vivre - ${formatEuros(kpis.resteAVivre > 0 ? kpis.resteAVivre : 0)}`;

  if (kpis.revenus > 0) {
    links.push({ source: getNodeIndex(ENC), target: getNodeIndex(REV), value: kpis.revenus });
    links.push({ source: getNodeIndex(REV), target: getNodeIndex(BUDG), value: kpis.revenus });
  }

  const rootNode = kpis.revenus > 0 ? getNodeIndex(BUDG) : getNodeIndex(`Fonds disponibles - ${formatEuros(kpis.depenses + kpis.epargne + (kpis.resteAVivre>0?kpis.resteAVivre:0))}`);

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
