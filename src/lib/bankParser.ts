export type FlowType = 'INCOME' | 'FIXED_EXPENSE' | 'VARIABLE_EXPENSE' | 'SAVINGS_TRANSFER';

export interface BankTransaction {
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
  confidence?: 'high' | 'medium' | 'low';
  status?: 'Reconciled' | 'Pending' | 'Internal Transfer';
  monthKey?: string;
  rawLabel?: string;
  cleanLabel?: string;
  [key: string]: any;
}

export const CATEGORIES = [
  'Salaire & Revenus',
  'Aides & Allocations',
  'Logement & Énergie',
  'Logement & Loyer',
  'Assurances',
  'Abonnements & Télécom',
  'Abonnements & Services',
  'Alimentation & Courses',
  'Transports & Carburant',
  'Transports & Véhicule',
  'Restaurants & Sorties',
  'Restaurants & Loisirs',
  'Shopping & Maison',
  'Santé',
  'Épargne & Investissement',
  'Virement Interne',
  'Frais bancaires',
  'Autre'
];

/**
 * Détection automatique du nom de la banque depuis les métadonnées, en-têtes et libellés du CSV
 */
export function detectBankName(csvContent: string): string {
  const lower = (csvContent || '').toLowerCase();
  if (
    lower.includes('logitel') ||
    lower.includes('sogessur') ||
    lower.includes('gdb_') ||
    lower.includes('carte x7791') ||
    lower.includes('societe generale') ||
    lower.includes('société générale')
  ) {
    return 'Société Générale';
  }
  if (lower.includes('fortuneo') || lower.includes('ftno')) {
    return 'Fortuneo';
  }
  if (lower.includes('revolut')) {
    return 'Revolut';
  }
  if (lower.includes('bnp paribas') || lower.includes('hellobank')) {
    return 'BNP Paribas';
  }
  if (lower.includes('credit agricole') || lower.includes('crédit agricole') || lower.includes('ca-')) {
    return 'Crédit Agricole';
  }
  if (lower.includes('bourso') || lower.includes('boursorama')) {
    return 'BoursoBank';
  }
  if (lower.includes('n26')) {
    return 'N26';
  }
  return 'Compte Courant';
}

/**
 * Nettoie le libellé bancaire brut pour extraire le nom propre du commerçant / tiers
 */
export function cleanMerchantDescription(raw: string): string {
  if (!raw) return 'Opération Bancaire';
  let clean = raw.trim();
  
  // Supprime les préfixes techniques bancaires
  clean = clean.replace(/^CARTE\s+X\d{4}\s+\d{2}\/\d{2}\s+/i, '');
  clean = clean.replace(/^\d+\s+VIR\s+(EUROPEEN|INSTANTANE)?\s*(EMIS|RECU)?\s*(LOGITEL)?\s*(POUR|DE)?\s*:\s*/i, '');
  clean = clean.replace(/^PRELEVEMENT\s+EUROPEEN\s+\d*\s*DE\s*:\s*/i, '');
  clean = clean.replace(/^VIR\s+(INST\s+RE|RECU|EMIS)\s+\d*\s*(WERO)?\s*(DE|POUR)?\s*:\s*/i, '');
  clean = clean.replace(/^PRLV\s+SEPA\s+/i, '');
  clean = clean.replace(/^VIR\s+SEPA\s+/i, '');

  // Supprime les suffixes et métadonnées parasites
  clean = clean.replace(/\s+COMMERCE ELECTRONIQUE.*$/i, '');
  clean = clean.replace(/\s+\d+,\d{2}\s+EUR.*$/i, '');
  clean = clean.replace(/\s+\d+,\d{2}\s+CHF.*$/i, '');
  clean = clean.replace(/\s+ID:\s*FR\w+/i, '');
  clean = clean.replace(/\s+REF:\s*.*$/i, '');
  clean = clean.replace(/\s+MANDAT\s*.*$/i, '');
  clean = clean.replace(/\s+MOTIF:\s*.*$/i, '');
  clean = clean.replace(/\s+CHEZ:\s*.*$/i, '');
  clean = clean.replace(/\s+DATE:\s*\d{2}\/\d{2}\/\d{4}.*$/i, '');

  return clean.replace(/\s+/g, ' ').trim() || raw.trim();
}

/**
 * Classification financière stricte de chaque transaction
 */
export function classifyTransaction(rawDescription: string, amount: number): {
  cleanDesc: string;
  flowType: FlowType;
  category: string;
  isSubscription: boolean;
} {
  const descLower = (rawDescription || '').toLowerCase();
  const cleanDesc = cleanMerchantDescription(rawDescription);

  // 1. Mouvements internes, virements compte à compte & épargne (Neutralisés des dépenses de vie)
  if (
    descLower.includes('fortuneo') ||
    descLower.includes('livret') ||
    descLower.includes('drame kouroufia') ||
    descLower.includes('kouroufia fortuneo') ||
    descLower.includes('virement avec fortuneo') ||
    descLower.includes('virement interne') ||
    descLower.includes('compte a compte') ||
    descLower.includes('vers livret') ||
    descLower.includes('de livret') ||
    descLower.includes('epargne') ||
    descLower.includes('épargne') ||
    descLower.includes('pel') ||
    descLower.includes('cel') ||
    descLower.includes('ldds') ||
    descLower.includes('lep')
  ) {
    return {
      cleanDesc: cleanDesc || 'Virement Interne / Épargne',
      flowType: 'SAVINGS_TRANSFER',
      category: 'Épargne & Investissement',
      isSubscription: false,
    };
  }

  // 2. Montants positifs -> Revenus & Aides
  if (amount > 0) {
    if (descLower.includes('france travail') || descLower.includes('pole emploi')) {
      return { cleanDesc: 'France Travail (Allocation)', flowType: 'INCOME', category: 'Aides & Allocations', isSubscription: false };
    }
    if (descLower.includes('caf de') || descLower.includes('caf ')) {
      return { cleanDesc: 'CAF (Allocations Familiales)', flowType: 'INCOME', category: 'Aides & Allocations', isSubscription: false };
    }
    if (descLower.includes('salaire') || descLower.includes('remuneration') || descLower.includes('rémunération') || descLower.includes('paie')) {
      return { cleanDesc: cleanDesc || 'Salaire & Revenus', flowType: 'INCOME', category: 'Salaire & Revenus', isSubscription: false };
    }
    if (descLower.includes('groupama') || descLower.includes('generation') || descLower.includes('cpam') || descLower.includes('securite sociale') || descLower.includes('soin')) {
      return { cleanDesc: cleanDesc || 'Remboursement Santé / Mutuelle', flowType: 'INCOME', category: 'Santé', isSubscription: false };
    }
    if (descLower.includes('wero') || descLower.includes('naistaba') || descLower.includes('el hani') || descLower.includes('revolut')) {
      return { cleanDesc: cleanDesc || 'Virement Reçu', flowType: 'INCOME', category: 'Salaire & Revenus', isSubscription: false };
    }
    return { cleanDesc: cleanDesc || 'Revenu / Encaissement', flowType: 'INCOME', category: 'Salaire & Revenus', isSubscription: false };
  }

  // 3. Charges Fixes & Abonnements (Montants négatifs)
  if (descLower.includes('totalenergies') || descLower.includes('edf') || descLower.includes('engie')) {
    return { cleanDesc: 'TotalEnergies (Électricité & Gaz)', flowType: 'FIXED_EXPENSE', category: 'Logement & Énergie', isSubscription: true };
  }
  if (descLower.includes('groupama') || descLower.includes('sogessur') || descLower.includes('assurance') || descLower.includes('allianz') || descLower.includes('macif') || descLower.includes('axa')) {
    return { cleanDesc: cleanDesc || 'Assurance', flowType: 'FIXED_EXPENSE', category: 'Assurances', isSubscription: true };
  }
  if (descLower.includes('orange') || descLower.includes('la poste mobile') || descLower.includes('free telecom') || descLower.includes('free mobile') || descLower.includes('sfr') || descLower.includes('bouygues') || descLower.includes('swype') || descLower.includes('sosh')) {
    return { cleanDesc: cleanDesc || 'Abonnement Télécom & Internet', flowType: 'FIXED_EXPENSE', category: 'Abonnements & Télécom', isSubscription: true };
  }
  if (descLower.includes('google play') || descLower.includes('apple.com') || descLower.includes('spotify') || descLower.includes('netflix') || descLower.includes('amazon prime') || descLower.includes('icloud') || descLower.includes('deezer') || descLower.includes('disney')) {
    return { cleanDesc: cleanDesc || 'Service Numérique / Abonnement', flowType: 'FIXED_EXPENSE', category: 'Abonnements & Télécom', isSubscription: true };
  }
  if (descLower.includes('loyer') || descLower.includes('bail') || descLower.includes('syndic')) {
    return { cleanDesc: cleanDesc || 'Loyer & Charges Résidence', flowType: 'FIXED_EXPENSE', category: 'Logement & Énergie', isSubscription: true };
  }
  if (descLower.includes('frais') || descLower.includes('cotisation carte') || descLower.includes('agios') || descLower.includes('commission')) {
    return { cleanDesc: cleanDesc || 'Frais Bancaires', flowType: 'FIXED_EXPENSE', category: 'Frais bancaires', isSubscription: false };
  }

  // 4. Dépenses Variables (Consommation courante)
  if (
    descLower.includes('boucherie') ||
    descLower.includes('boulangerie') ||
    descLower.includes('paniere') ||
    descLower.includes('intermarche') ||
    descLower.includes('intermarché') ||
    descLower.includes('leclerc') ||
    descLower.includes('carrefour') ||
    descLower.includes('lidl') ||
    descLower.includes('aldi') ||
    descLower.includes('monoprix') ||
    descLower.includes('super u') ||
    descLower.includes('franprix') ||
    descLower.includes('coop')
  ) {
    return { cleanDesc: cleanDesc || 'Alimentation & Courses', flowType: 'VARIABLE_EXPENSE', category: 'Alimentation & Courses', isSubscription: false };
  }
  if (
    descLower.includes('kebab') ||
    descLower.includes('restaurant') ||
    descLower.includes('bosphore') ||
    descLower.includes('dallmayr') ||
    descLower.includes('uber *eats') ||
    descLower.includes('uber eats') ||
    descLower.includes('deliveroo') ||
    descLower.includes('mcdo') ||
    descLower.includes('burger')
  ) {
    return { cleanDesc: cleanDesc || 'Restaurant & Restauration Rapide', flowType: 'VARIABLE_EXPENSE', category: 'Restaurants & Sorties', isSubscription: false };
  }
  if (descLower.includes('bricorama') || descLower.includes('leroy merlin') || descLower.includes('gifi') || descLower.includes('ikea') || descLower.includes('castorama')) {
    return { cleanDesc: cleanDesc || 'Bricolage & Maison', flowType: 'VARIABLE_EXPENSE', category: 'Shopping & Maison', isSubscription: false };
  }
  if (descLower.includes('amazon') || descLower.includes('cdiscount') || descLower.includes('aliexpress') || descLower.includes('xiaomi') || descLower.includes('ville-la-dis') || descLower.includes('shein')) {
    return { cleanDesc: cleanDesc || 'Achats & E-Commerce', flowType: 'VARIABLE_EXPENSE', category: 'Shopping & Maison', isSubscription: false };
  }
  if (descLower.includes('sodi est') || descLower.includes('carter-cash') || descLower.includes('total') || descLower.includes('essence') || descLower.includes('sapn') || descLower.includes('peage') || descLower.includes('sncf') || descLower.includes('amende')) {
    return { cleanDesc: cleanDesc || 'Transport & Véhicule', flowType: 'VARIABLE_EXPENSE', category: 'Transports & Carburant', isSubscription: false };
  }
  if (descLower.includes('doctolib') || descLower.includes('pharmacie') || descLower.includes('laboratoire') || descLower.includes('dentiste') || descLower.includes('medecin')) {
    return { cleanDesc: cleanDesc || 'Santé & Pharmacie', flowType: 'VARIABLE_EXPENSE', category: 'Santé', isSubscription: false };
  }

  return { cleanDesc: cleanDesc || rawDescription, flowType: 'VARIABLE_EXPENSE', category: 'Autre', isSubscription: false };
}

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
 * Fonction de catégorisation compatible avec les anciens appels
 */
export function categorizeTransaction(
  description: string,
  amount: number,
  dateStr?: string
): { flowType: FlowType; category: string; isSubscription: boolean; subscriptionDay?: number } {
  const result = classifyTransaction(description, amount);
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
  return {
    flowType: result.flowType,
    category: result.category,
    isSubscription: result.isSubscription,
    subscriptionDay
  };
}

/**
 * Parseur universel de relevés bancaires multi-formats CSV (Société Générale, Fortuneo, Revolut, etc.)
 */
export function parseCSVBankStatement(csvContent: string): { bankName: string; transactions: BankTransaction[] } {
  const bankName = detectBankName(csvContent);
  const lines = (csvContent || '').split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) return { bankName, transactions: [] };

  // Détection de la ligne d'en-tête (cherche la ligne qui a les mots clés bancaires)
  let headerLineIndex = 0;
  let maxScore = -1;
  for (let i = 0; i < Math.min(15, lines.length); i++) {
    const lower = lines[i].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let score = 0;
    if (lower.includes('date')) score += 3;
    if (lower.includes('libelle') || lower.includes('desc') || lower.includes('operation')) score += 3;
    if (lower.includes('montant') || lower.includes('debit') || lower.includes('credit')) score += 3;
    if (score > maxScore) {
      maxScore = score;
      headerLineIndex = i;
    }
  }

  const sampleLine = lines[headerLineIndex];
  const delimiter = sampleLine.includes(';') ? ';' : sampleLine.includes('\t') ? '\t' : ',';
  
  const headers = lines[headerLineIndex].split(delimiter).map(h => 
    h.trim().toLowerCase().replace(/^["']|["']$/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  );

  const dateIdx = headers.findIndex(h => h.includes('date transaction') || h.includes('date operation') || h === 'date' || h.includes('date'));
  
  // Priorité absolue au « Libellé complet » pour capturer le vrai marchand et éliminer les buckets génériques
  const fullDescIdx = headers.findIndex(h => h.includes('libelle complet') || h.includes('libell complet'));
  const fallbackDescIdx = headers.findIndex(h => h.includes('libelle operation') || h.includes('libelle') || h.includes('description') || h.includes('motif') || h.includes('detail'));
  
  const amountIdx = headers.findIndex(h => h.includes('montant') || h.includes('valeur'));
  const debitIdx = headers.findIndex(h => h.includes('debit'));
  const creditIdx = headers.findIndex(h => h.includes('credit'));

  const results: BankTransaction[] = [];

  for (let i = headerLineIndex + 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length < 2) continue;

    // 1. Parsing de la date
    let rawDate = dateIdx >= 0 && cols[dateIdx] ? cols[dateIdx] : cols[0];
    let formattedDate = new Date().toISOString().split('T')[0];
    if (rawDate) {
      const dmy = rawDate.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
      if (dmy) {
        formattedDate = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
      } else if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
        formattedDate = rawDate.slice(0, 10);
      }
    }

    // 2. Sélection stricte du libellé complet
    let rawDescription = '';
    if (fullDescIdx >= 0 && cols[fullDescIdx]) {
      rawDescription = cols[fullDescIdx];
    } else if (fallbackDescIdx >= 0 && cols[fallbackDescIdx]) {
      rawDescription = cols[fallbackDescIdx];
    } else {
      rawDescription = cols[1] || 'Opération Bancaire';
    }

    // 3. Parsing du montant
    let amount = 0;
    if (debitIdx >= 0 || creditIdx >= 0) {
      const debitRaw = debitIdx >= 0 ? cols[debitIdx] : '';
      const creditRaw = creditIdx >= 0 ? cols[creditIdx] : '';
      const debit = parseFloat(debitRaw.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
      const credit = parseFloat(creditRaw.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
      amount = credit !== 0 ? Math.abs(credit) : -Math.abs(debit);
    } else if (amountIdx >= 0 && cols[amountIdx]) {
      const cleanAmt = cols[amountIdx].replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
      amount = parseFloat(cleanAmt) || 0;
    }

    if (isNaN(amount) || amount === 0) continue;

    const { cleanDesc, flowType, category, isSubscription } = classifyTransaction(rawDescription, amount);

    let subscriptionDay: number | undefined = undefined;
    if (isSubscription && formattedDate) {
      const dParts = formattedDate.split('-');
      if (dParts.length === 3) subscriptionDay = parseInt(dParts[2], 10);
    }

    results.push({
      id: `tx_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 6)}`,
      date: formattedDate,
      description: cleanDesc,
      rawLabel: rawDescription,
      cleanLabel: cleanDesc,
      amount,
      flowType,
      category,
      account: bankName,
      bankName,
      isSubscription,
      subscriptionDay,
      confidence: 'high',
      status: flowType === 'SAVINGS_TRANSFER' ? 'Internal Transfer' : 'Reconciled'
    });
  }

  return { bankName, transactions: results };
}
