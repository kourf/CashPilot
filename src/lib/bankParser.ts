import Papa from 'papaparse';

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
  'Charges fixes',
  'Charges variables courantes',
  'Dépenses de confort',
  'Revenus',
  'Salaire & Revenus',
  'Aides & Allocations',
  'Virement Reçu (Proches)',
  'Logement & Énergie',
  'Assurances',
  'Abonnements & Télécom',
  'Alimentation & Courses',
  'Transports & Carburant',
  'Restaurants & Sorties',
  'Shopping & Maison',
  'Loisirs & Activités',
  'Santé',
  'Impôts & Amendes',
  'Paiement fractionné',
  'Frais bancaires',
  'Remboursement Carte (Amex)',
  'Virement vers Fortuneo',
  'Virement reçu de Fortuneo',
  'Virement vers Revolut',
  'Épargne & Investissement',
  'Virements Internes',
  'Virements Famille & Proches',
  'Retrait Espèces',
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
  if (lower.includes('fortuneo') || lower.includes('ftno')) return 'Fortuneo';
  if (lower.includes('revolut')) return 'Revolut';
  if (lower.includes('bnp paribas') || lower.includes('hellobank')) return 'BNP Paribas';
  if (lower.includes('credit agricole') || lower.includes('crédit agricole') || lower.includes('ca-')) return 'Crédit Agricole';
  if (lower.includes('bourso') || lower.includes('boursorama')) return 'BoursoBank';
  if (lower.includes('n26')) return 'N26';
  return 'Compte Courant';
}

/**
 * Nettoie et assainit le libellé brut d'une ligne de relevé bancaire (élimine les points superflus, double espaces et codes parasites)
 */
export function sanitizeRawBankLabel(raw: string): string {
  if (!raw) return '';
  let s = String(raw).trim();
  // Normalisation des espaces insécables et caractères d'espacement bizarres
  s = s.replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ');
  // Supprime les suites de points (ex: "...", "..", "....")
  s = s.replace(/\.{2,}/g, ' ');
  // Élimine les mentions de fin de ligne parasites
  s = s.replace(/\s+COMMERCE ELECTRONIQUE.*$/i, '');
  s = s.replace(/\s+NOTRE REF:\s*.*$/i, '');
  s = s.replace(/\s+REF:\s*.*$/i, '');
  s = s.replace(/\s+MANDAT\s*.*$/i, '');
  s = s.replace(/\s+ICS:\s*.*$/i, '');
  // Supprime la ponctuation traînante ou isolée en début/fin
  s = s.replace(/^[\s"'\-.,;:/]+|[\s"'\-.,;:/]+$/g, '');
  s = s.replace(/\s{2,}/g, ' ');
  return s.trim();
}

/**
 * Nettoie le libellé bancaire brut pour extraire le nom propre du commerçant / tiers
 */
export function cleanMerchantDescription(raw: string): string {
  if (!raw) return 'Opération Bancaire';
  let clean = sanitizeRawBankLabel(raw);

  // Détections prioritaires de commerçants & organismes courants
  const upper = clean.toUpperCase();
  if (upper.includes('AMERICAN EXPRESS') || upper.includes('AMEX')) return 'American Express';
  if (upper.includes('FRANCE TRAVAIL') || upper.includes('POLE EMPLOI')) return 'France Travail';
  if (upper.includes('CAF LOIRE') || upper.includes('CAF DE') || upper.startsWith('CAF ')) return 'CAF Loire-Atlantique';
  if (upper.includes('SWYPE')) return 'Swype';
  if (upper.includes('TOTALENERGIES') || upper.includes('TOTAL DIRECT ENERGIE')) return 'TotalEnergies';
  if (upper.includes('ORANGE FIBRE')) return 'Orange Fibre';
  if (upper.includes('ORANGE MOBILE') || (upper.includes('ORANGE') && upper.includes('PRLV'))) return 'Orange';
  if (upper.includes('LA POSTE MOBILE')) return 'La Poste Mobile';
  if (upper.includes('SOBRIO')) return 'Cotisation Sobrio (Banque)';
  if (upper.includes('CRYPTO DYNAMIQUE') || upper.includes('OPTION CRYPTO')) return 'Option Crypto (Frais)';
  if (upper.includes('COMMISSION D\'INTERVENTION') || upper.includes('COMMISSION INTERVENTION')) return 'Commission d\'intervention (Frais)';
  if (upper.includes('SATD')) return 'Frais sur SATD (Impôts)';
  if (upper.includes('SOGESSUR')) return 'Sogessur (Assurance)';
  if (upper.includes('GROUPAMA') && (upper.includes('SOIN') || upper.includes('SANTE'))) return 'Groupama (Santé)';
  if (upper.includes('GROUPAMA')) return 'Groupama (Assurance)';
  if (upper.includes('SOGECAP')) return 'Sogecap (Épargne)';
  if (upper.includes('ONEY')) return 'Oney (3x/4x)';
  if (upper.includes('KLARNA')) return 'Klarna';

  // Détection des virements vers proches / personnes physiques : VIR ... POUR: [Nom] ou DE: [Nom]
  const pourMatch = clean.match(/(?:POUR|DE|FAVEUR DE)\s*:\s*([^/,\-]+)/i);
  if (pourMatch && pourMatch[1]) {
    let name = pourMatch[1].trim();
    name = name.replace(/\b(LOGITEL|WERO|REVOLUT|CEPA|SG|FORTUNEO)\b/gi, '').trim();
    if (name.length >= 2) {
      // Format propre
      return name
        .toLowerCase()
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }
  }

  // Détection des remboursements commerçants (Xiaomi, Amazon, etc.)
  const rembtMatch = clean.match(/(?:REMBT|REMBOURSEMENT)\s+(?:CB\s+)?([A-Za-z0-9\s]+?)(?:\s+\+?\d+|$)/i);
  if (rembtMatch && rembtMatch[1]) {
    const march = rembtMatch[1].replace(/PAYMENTS|FRANCE|PARIS/gi, '').trim();
    if (march.length >= 3) {
      return `${march.charAt(0).toUpperCase() + march.slice(1).toLowerCase()} (Remboursement)`;
    }
  }

  // Supprime les préfixes techniques bancaires courants français
  clean = clean.replace(/^PAIEMENT\s+PAR\s+CARTE\s+DU\s+\d{1,2}\/\d{1,2}(?:\/\d{2,4})?(?:\s*(?:A\s*)?\d{1,2}[:hH]\d{2})?\s*/i, '');
  clean = clean.replace(/^PAIEMENT\s+CARTE\s+DU\s+\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s*/i, '');
  clean = clean.replace(/^ACHAT\s+(?:PAR\s+)?CARTE\s+DU\s+\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s*/i, '');
  clean = clean.replace(/^ACHAT\s+CB\s+(?:\d{2}\/\d{2}\s+)?/i, '');
  clean = clean.replace(/^PAIEMENT\s+CB\s+(?:\d{4}|\d{2}\/\d{2})?\s*/i, '');
  clean = clean.replace(/^CARTE\s+X\d{4}\s+(?:RETRAIT\s+DAB\s+)?\d{2}\/\d{2}\s*(?:\d{2}[hH:]\d{2}\s*)?/i, '');
  clean = clean.replace(/^CARTE\s+(?:DU\s+)?\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s*(?:CB)?\s*/i, '');
  clean = clean.replace(/^CB\s+/i, '');

  clean = clean.replace(/^\d+\s+VIR\s+(?:EUROPEEN|INSTANTANE)?\s*(?:EMIS|RECU)?\s*(?:LOGITEL)?\s*(?:POUR|DE)?\s*:\s*/i, '');
  clean = clean.replace(/^PRELEVEMENT\s+(?:EUROPEEN|SEPA)?\s*\d*\s*(?:DE|POUR)?\s*:\s*/i, '');
  clean = clean.replace(/^PRLV\s+EUROPEEN\s+ACC\s+\d*\s*(?:DE|POUR)?\s*:\s*/i, '');
  clean = clean.replace(/^VIR\s+(?:INST\s+RE|INST\s+EMIS|INST|RECU|EMIS|SEPA)\s*\d*\s*(?:WERO)?\s*(?:DE|POUR)?\s*:\s*/i, '');
  clean = clean.replace(/^VIREMENT\s+(?:SEPA|INSTANTANE|EMIS|RECU)?\s*(?:DE|POUR|EN VOTRE FAVEUR DE)?\s*:\s*/i, '');
  clean = clean.replace(/^PRLV\s+SEPA\s*(?:DE)?\s*:?\s*/i, '');
  clean = clean.replace(/^VIR\s+SEPA\s*/i, '');
  clean = clean.replace(/^COTISATION\s+(?:MENSUELLE|TRIMESTRIELLE|ANNUELLE)?\s*/i, '');
  clean = clean.replace(/^RETRAIT\s+(?:DAB|DISTRIBUTEUR)?\s*(?:\d{2}\/\d{2})?\s*/i, '');
  clean = clean.replace(/^REMBOURSEMENT\s+(?:CB|CARTE)?\s*/i, '');
  clean = clean.replace(/^CHEQUE\s+N°?\s*\d+\s*/i, '');

  // Supprime les suffixes et métadonnées techniques parasites
  clean = clean.replace(/\s+COMMERCE ELECTRONIQUE.*$/i, '');
  clean = clean.replace(/\s+\d+,\d{2}\s*(?:EUR|CHF|USD).*$/i, '');
  clean = clean.replace(/\s+ID:\s*\S+.*$/i, '');
  clean = clean.replace(/\s+REF:\s*.*$/i, '');
  clean = clean.replace(/\s+MANDAT\s*.*$/i, '');
  clean = clean.replace(/\s+MOTIF:\s*.*$/i, '');
  clean = clean.replace(/\s+CHEZ:\s*.*$/i, '');
  clean = clean.replace(/\s+DATE:\s*\d{2}\/\d{2}\/\d{4}.*$/i, '');
  clean = clean.replace(/\s+EMETTEUR:\s*.*$/i, '');
  clean = clean.replace(/\s+NOTRE REF:\s*.*$/i, '');
  clean = clean.replace(/\s+TITULAIRE:\s*.*$/i, '');
  clean = clean.replace(/\s+DESTINATAIRE:\s*.*$/i, '');
  clean = clean.replace(/\s+ICS:\s*.*$/i, '');
  clean = clean.replace(/\s+RUM:\s*.*$/i, '');
  clean = clean.replace(/\s+\d{2}\s+\d{2}\s+BQ\s+\w+\s+CPT\s+\w+.*$/i, '');
  clean = clean.replace(/\s+\d{5}\s+[A-Z\s-]+$/i, '');
  clean = clean.replace(/[\s.,;:/\-_]+$/g, '');

  const result = clean.replace(/\s+/g, ' ').trim();
  if (!result) return sanitizeRawBankLabel(raw) || 'Opération Bancaire';

  // Si tout en majuscules et de longueur raisonnable, formater en Title Case
  if (result === result.toUpperCase() && result.length > 2 && result.length < 40) {
    return result
      .toLowerCase()
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  return result;
}

/**
 * Classification financière stricte de chaque transaction à partir de son libellé complet
 */
export function classifyTransaction(rawDescription: string, amount: number): {
  cleanDesc: string;
  flowType: FlowType;
  category: string;
  isSubscription: boolean;
} {
  const norm = (rawDescription || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const cleanDesc = cleanMerchantDescription(rawDescription);

  // 0. Moteur de règles personnalisées dynamiques (Lecture depuis localStorage)
  try {
    if (typeof window !== 'undefined') {
      // 0a. Règles explicites personnalisées
      const savedRules = localStorage.getItem('cashpilot_custom_rules');
      if (savedRules) {
        const rules = JSON.parse(savedRules);
        if (Array.isArray(rules)) {
          for (const rule of rules) {
            if (rule && rule.keyword && norm.includes(rule.keyword.toLowerCase())) {
              return {
                cleanDesc,
                flowType: rule.flowType,
                category: rule.category,
                isSubscription: rule.flowType === 'FIXED_EXPENSE' || Boolean(rule.isSubscription)
              };
            }
          }
        }
      }

      // 0b. Dictionnaire direct de remappage mémorisé
      const remapRules = localStorage.getItem('cashpilot_category_remap_rules');
      if (remapRules) {
        const dict = JSON.parse(remapRules);
        if (dict && typeof dict === 'object') {
          for (const [key, targetCat] of Object.entries(dict)) {
            if (key && (norm.includes(key.toLowerCase()) || cleanDesc.toLowerCase().includes(key.toLowerCase()))) {
              const isIncome = targetCat === 'Salaire & Revenus' || targetCat === 'Aides & Allocations' || (targetCat as string).includes('Reçu');
              const isFixed = (targetCat as string).includes('Abonnement') || (targetCat as string).includes('Logement') || (targetCat as string).includes('Assurance') || (targetCat as string).includes('Frais');
              return {
                cleanDesc,
                flowType: isIncome ? 'INCOME' : (isFixed ? 'FIXED_EXPENSE' : 'VARIABLE_EXPENSE'),
                category: targetCat as string,
                isSubscription: (targetCat as string).includes('Abonnement')
              };
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('Error reading custom rules from localStorage:', e);
  }

  // 1. Aides sociales, allocations & remboursements santé prioritaires (Montants positifs)
  if (amount > 0) {
    if (
      norm.includes('france travail') ||
      norm.includes('pole emploi') ||
      norm.includes('assedic') ||
      norm.includes('alloc chomage') ||
      norm.includes('are ')
    ) {
      return { cleanDesc: 'France Travail (Allocation)', flowType: 'INCOME', category: 'Aides & Allocations', isSubscription: false };
    }
    if (
      norm.includes('caf ') ||
      norm.includes('caf de') ||
      norm.includes('caisse d allocations') ||
      norm.includes('apl') ||
      norm.includes('rsa') ||
      norm.includes('prime d activite') ||
      norm.includes('prime activite') ||
      norm.includes('aah') ||
      norm.includes('allocations familiales')
    ) {
      return { cleanDesc: 'CAF (Allocations Familiales)', flowType: 'INCOME', category: 'Aides & Allocations', isSubscription: false };
    }
    if (
      norm.includes('generation') ||
      norm.includes('cpam') ||
      norm.includes('ameli') ||
      norm.includes('securite sociale') ||
      norm.includes('mutuelle') ||
      (norm.includes('groupama') && norm.includes('soin'))
    ) {
      return { cleanDesc: cleanDesc || 'Remboursement Santé / Mutuelle', flowType: 'INCOME', category: 'Santé', isSubscription: false };
    }
  }

  // 2. Virements Famille & Proches (Wero, Paylib, Lyf, Vir inst, Prénoms & Noms de proches)
  const isFamily = 
    norm.includes('famille') || 
    norm.includes('solidarite') || 
    norm.includes('argent de poche') ||
    norm.includes('wero') ||
    norm.includes('paylib') ||
    norm.includes('lydia') ||
    norm.includes('lyf') ||
    norm.includes('vir inst') ||
    norm.includes('virement instantane') ||
    norm.includes('virement instantané') ||
    norm.includes('nayssa') ||
    norm.includes('naustaba') ||
    norm.includes('naistaba') ||
    norm.includes('malaguti') ||
    norm.includes('el hani') ||
    ((norm.includes('drame') || norm.includes('dramé')) && !norm.includes('kouroufia'));

  if (isFamily) {
    if (amount > 0) {
      return {
        cleanDesc: cleanDesc || 'Virement Reçu (Proches)',
        flowType: 'INCOME',
        category: 'Virement Reçu (Proches)',
        isSubscription: false
      };
    } else {
      return {
        cleanDesc: cleanDesc || "Virements Famille & Proches",
        flowType: 'VARIABLE_EXPENSE',
        category: 'Virements Famille & Proches',
        isSubscription: false
      };
    }
  }

  // 3. Mouvements internes, virements compte à compte & épargne (Neutralisés du reste à vivre)
  // Attention : Ne neutraliser QUE les vrais mouvements d'épargne personnels et comptes propres
  const isInternalAccount = (norm.includes('virement interne') || norm.includes('compte a compte') || norm.includes('virement de compte')) &&
    !norm.includes('de: generation') && !norm.includes('cpam');
  const isSavingsAccount = norm.includes('livret a') ||
    norm.includes('livret de developpement') ||
    norm.includes('ldds') ||
    norm.includes('ldd') ||
    norm.includes('lep') ||
    norm.includes('livret jeune') ||
    norm.includes('pel') ||
    norm.includes('cel') ||
    norm.includes('pea') ||
    norm.includes('compte sur livret') ||
    norm.includes('compte a terme') ||
    norm.includes('assurance vie') ||
    norm.includes('assurance-vie') ||
    norm.includes('compte a compte livret') ||
    norm.includes('vers livret') ||
    norm.includes('de livret') ||
    norm.includes('depuis livret') ||
    norm.includes('rachat assurance');

  if (amount > 0) {
    // Rentrées d'argent : Vraie Épargne (rachat de livret)
    if (isSavingsAccount) {
      return {
        cleanDesc: cleanDesc || "Rachat d'Épargne / Livret",
        flowType: 'SAVINGS_TRANSFER',
        category: 'Épargne & Investissement',
        isSubscription: false,
      };
    }
    // Rentrées d'argent depuis un compte interne
    if (isInternalAccount) {
      return {
        cleanDesc: cleanDesc || 'Virement Interne Reçu',
        flowType: 'SAVINGS_TRANSFER',
        category: 'Virements Internes',
        isSubscription: false,
      };
    }
  } else {
    // Sorties d'argent vers l'épargne ou investissements dédiés (Livrets, Bourse, Crypto)
    if (
      isSavingsAccount ||
      norm.includes('trade republic') ||
      norm.includes('degiro') ||
      norm.includes('binance') ||
      norm.includes('coinbase') ||
      norm.includes('vers livret')
    ) {
      return {
        cleanDesc: cleanDesc || 'Versement Épargne / Livret',
        flowType: 'SAVINGS_TRANSFER',
        category: 'Épargne & Investissement',
        isSubscription: false,
      };
    }
    // Sorties d'argent vers un autre compte propre
    if (isInternalAccount) {
      return {
        cleanDesc: cleanDesc || 'Virement Interne Émis',
        flowType: 'SAVINGS_TRANSFER',
        category: 'Virements Internes',
        isSubscription: false,
      };
    }
    // Sorties vers Revolut
    if (norm.includes('revolut**0060*') || (norm.includes('revolut') && norm.includes('transf'))) {
      return {
        cleanDesc: 'Virement vers Revolut',
        flowType: 'VARIABLE_EXPENSE',
        category: 'Virement vers Revolut',
        isSubscription: false,
      };
    }
    // Sorties d'argent vers un autre compte courant propre (virement interne)
    if (
      norm.includes('virement interne') ||
      norm.includes('compte a compte')
    ) {
      return {
        cleanDesc: cleanDesc || 'Virement Interne',
        flowType: 'VARIABLE_EXPENSE',
        category: 'Virements Internes',
        isSubscription: false,
      };
    }
  }

  // 3. Impôts, Amendes & SATD
  if (['amende', 'tresorerie', 'satd', 'impot', 'impôt', 'dgi', 'tresor public', 'dgfip'].some(k => norm.includes(k))) {
    return {
      cleanDesc: cleanDesc || 'Trésorerie / Amendes / Impôts',
      flowType: 'VARIABLE_EXPENSE',
      category: 'Impôts & Amendes',
      isSubscription: false
    };
  }

  // 4. Paiements fractionnés (Klarna, Alma, Oney) -> Traités en Charge Fixe
  if (['klarna', 'alma', 'oney', 'clearpay', 'scalapay', 'paiement 3x', 'paiement 4x'].some(k => norm.includes(k))) {
    return {
      cleanDesc: cleanDesc || 'Paiement fractionné',
      flowType: 'FIXED_EXPENSE',
      category: 'Paiement fractionné',
      isSubscription: true
    };
  }

  // 5. Remboursement Carte American Express
  if (['american express', 'amex'].some(k => norm.includes(k))) {
    return {
      cleanDesc: 'Remboursement American Express',
      flowType: 'FIXED_EXPENSE',
      category: 'Remboursement Carte (Amex)',
      isSubscription: true
    };
  }

  // 6. Retraits d'espèces en distributeur
  if (['retrait dab', 'retrait distributeur', 'retrait dab sg', 'retrait especes', 'retrait gab'].some(k => norm.includes(k))) {
    return {
      cleanDesc: cleanDesc || 'Retrait Espèces',
      flowType: 'VARIABLE_EXPENSE',
      category: 'Retrait Espèces',
      isSubscription: false
    };
  }

  // 7. Montants positifs -> Revenus & Aides
  if (amount > 0) {
    // Aides & Prestations sociales
    if (
      norm.includes('france travail') ||
      norm.includes('pole emploi') ||
      norm.includes('assedic') ||
      norm.includes('alloc chomage') ||
      norm.includes('are ')
    ) {
      return { cleanDesc: 'France Travail (Allocation)', flowType: 'INCOME', category: 'Aides & Allocations', isSubscription: false };
    }
    if (
      norm.includes('caf ') ||
      norm.includes('caf de') ||
      norm.includes('caisse d allocations') ||
      norm.includes('apl') ||
      norm.includes('rsa') ||
      norm.includes('prime d activite') ||
      norm.includes('prime activite') ||
      norm.includes('aah') ||
      norm.includes('allocations familiales')
    ) {
      return { cleanDesc: 'CAF (Allocations Familiales)', flowType: 'INCOME', category: 'Aides & Allocations', isSubscription: false };
    }
    if (
      norm.includes('cnav') ||
      norm.includes('carsat') ||
      norm.includes('retraite') ||
      norm.includes('agirc') ||
      norm.includes('arrco') ||
      norm.includes('pension')
    ) {
      return { cleanDesc: 'CARSAT / Retraite', flowType: 'INCOME', category: 'Aides & Allocations', isSubscription: false };
    }
    if (norm.includes('crous') || norm.includes('bourse etudiant')) {
      return { cleanDesc: 'Bourse CROUS', flowType: 'INCOME', category: 'Aides & Allocations', isSubscription: false };
    }

    // Remboursements Santé
    if (
      norm.includes('groupama') ||
      norm.includes('cpam') ||
      norm.includes('securite sociale') ||
      norm.includes('secu') ||
      norm.includes('mutuelle') ||
      norm.includes('generation') ||
      norm.includes('malakoff') ||
      norm.includes('harmonie') ||
      norm.includes('alan') ||
      norm.includes('mgen') ||
      norm.includes('pro btp') ||
      norm.includes('soin') ||
      norm.includes('remboursement')
    ) {
      return { cleanDesc: cleanDesc || 'Remboursement Santé / Mutuelle', flowType: 'INCOME', category: 'Santé', isSubscription: false };
    }

    // Salaires & Rémunérations
    if (
      norm.includes('salaire') ||
      norm.includes('remuneration') ||
      norm.includes('paie') ||
      norm.includes('appointements') ||
      norm.includes('traitement') ||
      norm.includes('acompte')
    ) {
      return { cleanDesc: cleanDesc || 'Salaire & Revenus', flowType: 'INCOME', category: 'Salaire & Revenus', isSubscription: false };
    }

    return { cleanDesc: cleanDesc || 'Revenu / Encaissement', flowType: 'INCOME', category: 'Salaire & Revenus', isSubscription: false };
  }

  // 8. Charges Fixes & Abonnements (Montants négatifs)
  // Logement & Énergie
  if (
    norm.includes('totalenergies') ||
    norm.includes('total direct energie') ||
    norm.includes('edf') ||
    norm.includes('engie') ||
    norm.includes('direct energie') ||
    norm.includes('eni ') ||
    norm.includes('vattenfall') ||
    norm.includes('ekwateur') ||
    norm.includes('iberdrola') ||
    norm.includes('sowee') ||
    norm.includes('gaz de france')
  ) {
    return { cleanDesc: 'TotalEnergies', flowType: 'FIXED_EXPENSE', category: 'Logement & Énergie', isSubscription: true };
  }
  if (
    norm.includes('veolia') ||
    norm.includes('suez') ||
    norm.includes('saur') ||
    norm.includes('eau de paris') ||
    norm.includes('eau du grand lyon') ||
    norm.includes('sedif') ||
    norm.includes('service des eaux')
  ) {
    return { cleanDesc: cleanDesc || 'Service des Eaux', flowType: 'FIXED_EXPENSE', category: 'Logement & Énergie', isSubscription: true };
  }
  if (
    norm.includes('loyer') ||
    norm.includes('bail') ||
    norm.includes('syndic') ||
    norm.includes('foncia') ||
    norm.includes('nexity') ||
    norm.includes('citya') ||
    norm.includes('sergic') ||
    norm.includes('century 21') ||
    norm.includes('orpi') ||
    norm.includes('laforet') ||
    norm.includes('guy hoquet') ||
    norm.includes('copropriete') ||
    norm.includes('charges copro')
  ) {
    return { cleanDesc: cleanDesc || 'Loyer & Charges', flowType: 'FIXED_EXPENSE', category: 'Logement & Énergie', isSubscription: true };
  }

  // Assurances
  if (
    norm.includes('sogessur') ||
    norm.includes('sogecap') ||
    norm.includes('groupama') ||
    norm.includes('macif') ||
    norm.includes('maif') ||
    norm.includes('matmut') ||
    norm.includes('allianz') ||
    norm.includes('axa') ||
    norm.includes('generali') ||
    norm.includes('mma') ||
    norm.includes('direct assurance') ||
    norm.includes('gmf') ||
    norm.includes('abeille') ||
    norm.includes('aviva') ||
    norm.includes('swiss life') ||
    norm.includes('malakoff') ||
    norm.includes('harmonie mutuelle') ||
    norm.includes('pro btp') ||
    norm.includes('alan ') ||
    norm.includes('mgen') ||
    norm.includes('assurance') ||
    norm.includes('prevoyance')
  ) {
    return { cleanDesc: cleanDesc || 'Assurance', flowType: 'FIXED_EXPENSE', category: 'Assurances', isSubscription: true };
  }

  // Abonnements Télécom, Numérique & Loisirs
  if (
    norm.includes('orange') ||
    norm.includes('la poste mobile') ||
    norm.includes('free telecom') ||
    norm.includes('free mobile') ||
    norm.includes('freebox') ||
    norm.includes('free ') ||
    norm.includes('sfr') ||
    norm.includes('bouygues telecom') ||
    norm.includes('bouygues') ||
    norm.includes('swype') ||
    norm.includes('sosh') ||
    norm.includes('red by sfr') ||
    norm.includes('coriolis') ||
    norm.includes('prixtel') ||
    norm.includes('lebara') ||
    norm.includes('lycamobile')
  ) {
    return { cleanDesc: cleanDesc || 'Abonnement Télécom', flowType: 'FIXED_EXPENSE', category: 'Abonnements & Télécom', isSubscription: true };
  }
  if (
    norm.includes('netflix') ||
    norm.includes('spotify') ||
    norm.includes('deezer') ||
    norm.includes('apple.com') ||
    norm.includes('apple services') ||
    norm.includes('itunes') ||
    norm.includes('icloud') ||
    norm.includes('google play') ||
    norm.includes('google storage') ||
    norm.includes('google one') ||
    norm.includes('youtube') ||
    norm.includes('amazon prime') ||
    norm.includes('prime video') ||
    norm.includes('disney') ||
    norm.includes('canal+') ||
    norm.includes('canal plus') ||
    norm.includes('canalplus') ||
    norm.includes('paramount') ||
    norm.includes('crunchyroll') ||
    norm.includes('dazn') ||
    norm.includes('bein') ||
    norm.includes('openai') ||
    norm.includes('chatgpt') ||
    norm.includes('anthropic') ||
    norm.includes('claude') ||
    norm.includes('midjourney') ||
    norm.includes('github') ||
    norm.includes('adobe') ||
    norm.includes('microsoft') ||
    norm.includes('office 365') ||
    norm.includes('dropbox') ||
    norm.includes('canva') ||
    norm.includes('playstation') ||
    norm.includes('psn') ||
    norm.includes('xbox') ||
    norm.includes('nintendo') ||
    norm.includes('basic fit') ||
    norm.includes('fitness park') ||
    norm.includes('keep cool') ||
    norm.includes('on air') ||
    norm.includes('salle de sport')
  ) {
    return { cleanDesc: cleanDesc || 'Service Numérique', flowType: 'FIXED_EXPENSE', category: 'Abonnements & Télécom', isSubscription: true };
  }

  // Frais Bancaires
  if (
    norm.includes('cotisation carte') ||
    norm.includes('cotisation formule') ||
    norm.includes('cotisation jazz') ||
    norm.includes('cotisation sobrio') ||
    norm.includes('cotisation') ||
    norm.includes('tenue de compte') ||
    norm.includes('frais tenue') ||
    norm.includes('commission d intervention') ||
    norm.includes('commission intervention') ||
    norm.includes('agios') ||
    norm.includes('frais bancaires') ||
    norm.includes('frais de rejet') ||
    norm.includes('commission change') ||
    norm.includes('arrete 01') ||
    norm.includes('jours debiteurs') ||
    norm.includes('sobrio')
  ) {
    return { cleanDesc: cleanDesc || 'Frais Bancaires', flowType: 'FIXED_EXPENSE', category: 'Frais bancaires', isSubscription: false };
  }

  // 9. Dépenses Variables (Consommation courante)
  // Alimentation & Courses
  if (
    norm.includes('boucherie') ||
    norm.includes('boucher') ||
    norm.includes('nour') ||
    norm.includes('halal') ||
    norm.includes('boulangerie') ||
    norm.includes('boulang') ||
    norm.includes('patisserie') ||
    norm.includes('fournil') ||
    norm.includes('paniere') ||
    norm.includes('paul') ||
    norm.includes('brioche doree') ||
    norm.includes('mie caline') ||
    norm.includes('feuillette') ||
    norm.includes('marie blachere') ||
    norm.includes('carrefour') ||
    norm.includes('leclerc') ||
    norm.includes('auchan') ||
    norm.includes('intermarche') ||
    norm.includes('lidl') ||
    norm.includes('aldi') ||
    norm.includes('monoprix') ||
    norm.includes('monop') ||
    norm.includes('super u') ||
    norm.includes('hyper u') ||
    norm.includes('u express') ||
    norm.includes('systeme u') ||
    norm.includes('franprix') ||
    norm.includes('casino') ||
    norm.includes('cora') ||
    norm.includes('match') ||
    norm.includes('picard') ||
    norm.includes('grand frais') ||
    norm.includes('biocoop') ||
    norm.includes('naturalia') ||
    norm.includes('bio c bon') ||
    norm.includes('leader price') ||
    norm.includes('netto') ||
    norm.includes('primeur') ||
    norm.includes('fromagerie') ||
    norm.includes('poissonnerie') ||
    norm.includes('epicerie') ||
    norm.includes('superette') ||
    norm.includes('marche') ||
    norm.includes('supermarche') ||
    norm.includes('alimentation') ||
    norm.includes('coop') ||
    norm.includes('migros') ||
    norm.includes('migrolino') ||
    norm.includes('comptoir de la vian')
  ) {
    return { cleanDesc: cleanDesc || 'Alimentation & Courses', flowType: 'VARIABLE_EXPENSE', category: 'Alimentation & Courses', isSubscription: false };
  }

  // Restaurants & Sorties
  if (
    norm.includes('mcdonald') ||
    norm.includes('mcdo') ||
    norm.includes('burger king') ||
    norm.includes('burger') ||
    norm.includes('kfc') ||
    norm.includes('quick') ||
    norm.includes('subway') ||
    norm.includes('five guys') ||
    norm.includes('kebab') ||
    norm.includes('bosphore') ||
    norm.includes('dallmayr') ||
    norm.includes('tacos') ||
    norm.includes("o'tacos") ||
    norm.includes('otacos') ||
    norm.includes('chamas') ||
    norm.includes('domino') ||
    norm.includes('pizza hut') ||
    norm.includes('pizza') ||
    norm.includes('uber *eats') ||
    norm.includes('uber eats') ||
    norm.includes('deliveroo') ||
    norm.includes('just eat') ||
    norm.includes('restaurant') ||
    norm.includes('resto') ||
    norm.includes('brasserie') ||
    norm.includes('bistrot') ||
    norm.includes('sushi') ||
    norm.includes('wok') ||
    norm.includes('traiteur') ||
    norm.includes('starbucks') ||
    norm.includes('columbus') ||
    norm.includes('cafe ') ||
    norm.includes('bar ') ||
    norm.includes('pub ') ||
    norm.includes('ca va smasher') ||
    norm.includes('koyao') ||
    norm.includes('tasty crousty') ||
    norm.includes('nouilles')
  ) {
    return { cleanDesc: cleanDesc || 'Restaurant & Rapide', flowType: 'VARIABLE_EXPENSE', category: 'Restaurants & Sorties', isSubscription: false };
  }

  // Shopping & Maison
  if (
    norm.includes('pull and bear') ||
    norm.includes('electro depot') ||
    norm.includes('etam') ||
    norm.includes('bricorama') ||
    norm.includes('leroy merlin') ||
    norm.includes('castorama') ||
    norm.includes('brico') ||
    norm.includes('manomano') ||
    norm.includes('ikea') ||
    norm.includes('conforama') ||
    norm.includes('but ') ||
    norm.includes('maisons du monde') ||
    norm.includes('maison du monde') ||
    norm.includes('action ') ||
    norm.includes('action.') ||
    norm.includes('gifi') ||
    norm.includes('centrakor') ||
    norm.includes('la foir fouille') ||
    norm.includes('noz') ||
    norm.includes('amazon') ||
    norm.includes('cdiscount') ||
    norm.includes('aliexpress') ||
    norm.includes('ali express') ||
    norm.includes('shein') ||
    norm.includes('temu') ||
    norm.includes('fnac') ||
    norm.includes('darty') ||
    norm.includes('boulanger') ||
    norm.includes('apple store') ||
    norm.includes('zara') ||
    norm.includes('h&m') ||
    norm.includes('primark') ||
    norm.includes('kiabi') ||
    norm.includes('celio') ||
    norm.includes('jules') ||
    norm.includes('decathlon') ||
    norm.includes('intersport') ||
    norm.includes('sephora') ||
    norm.includes('nocibe') ||
    norm.includes('marionnaud') ||
    norm.includes('xiaomi')
  ) {
    return { cleanDesc: cleanDesc || 'Shopping & Maison', flowType: 'VARIABLE_EXPENSE', category: 'Shopping & Maison', isSubscription: false };
  }

  // Loisirs & Activités
  if (
    norm.includes('ile de tortuga') ||
    norm.includes('montagne verte') ||
    norm.includes('cinema') ||
    norm.includes('ugc') ||
    norm.includes('pathe') ||
    norm.includes('gaumont') ||
    norm.includes('theatre') ||
    norm.includes('musee') ||
    norm.includes('parc') ||
    norm.includes('bowling') ||
    norm.includes('laser') ||
    norm.includes('escape game') ||
    norm.includes('zoo') ||
    norm.includes('aquarium')
  ) {
    return { cleanDesc: cleanDesc || 'Loisirs & Activités', flowType: 'VARIABLE_EXPENSE', category: 'Loisirs & Activités', isSubscription: false };
  }

  // Transports & Véhicule
  if (
    norm.includes('sodi est') ||
    norm.includes('carter-cash') ||
    norm.includes('total') ||
    norm.includes('essence') ||
    norm.includes('carburant') ||
    norm.includes('station') ||
    norm.includes('shell') ||
    norm.includes('esso') ||
    norm.includes('bp ') ||
    norm.includes('avia') ||
    norm.includes('sapn') ||
    norm.includes('peage') ||
    norm.includes('aprr') ||
    norm.includes('sanef') ||
    norm.includes('vinci autoroutes') ||
    norm.includes('sncf') ||
    norm.includes('ratp') ||
    norm.includes('train') ||
    norm.includes('ter') ||
    norm.includes('tgv') ||
    norm.includes('blablacar') ||
    norm.includes('uber') ||
    norm.includes('bolt') ||
    norm.includes('taxi') ||
    norm.includes('amb horodateur') ||
    norm.includes('relais de chamarett') ||
    norm.includes('petro belmont') ||
    norm.includes('horodateur') ||
    norm.includes('stationnement') ||
    norm.includes('parking') ||
    norm.includes('garage') ||
    norm.includes('norauto') ||
    norm.includes('feu vert') ||
    norm.includes('point s') ||
    norm.includes('midas') ||
    norm.includes('speedy') ||
    norm.includes('controle technique')
  ) {
    return { cleanDesc: cleanDesc || 'Transport & Véhicule', flowType: 'VARIABLE_EXPENSE', category: 'Transports & Carburant', isSubscription: false };
  }

  // Santé & Pharmacie
  if (
    norm.includes('doctolib') ||
    norm.includes('pharmacie') ||
    norm.includes('phie du') ||
    norm.includes('laboratoire') ||
    norm.includes('dentiste') ||
    norm.includes('medecin') ||
    norm.includes('stancer*grace') ||
    norm.includes('opticien') ||
    norm.includes('kine') ||
    norm.includes('osteo') ||
    norm.includes('hopital') ||
    norm.includes('clinique')
  ) {
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
 * Formatage d'une date en format français complet avec jour de la semaine (ex: '2026-09-11' -> 'Vendredi 11 sept. 2026')
 */
export function formatDateFR(dateStr?: string | null): string {
  if (!dateStr) return '-';
  try {
    const trimmed = String(dateStr).trim();
    const formatFull = (d: Date) => {
      const str = d.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
      return str.charAt(0).toUpperCase() + str.slice(1);
    };

    // Format YYYY-MM-DD ou YYYY/MM/DD
    const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10) - 1;
      const day = parseInt(isoMatch[3], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        return formatFull(d);
      }
    }

    // Format DD/MM/YYYY ou DD-MM-YYYY
    const frMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (frMatch) {
      const day = parseInt(frMatch[1], 10);
      const month = parseInt(frMatch[2], 10) - 1;
      const year = parseInt(frMatch[3], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        return formatFull(d);
      }
    }

    // Fallback standard Date parse
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return formatFull(parsed);
    }
  } catch (e) {
    // Ignorer
  }
  return String(dateStr);
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
 * Nettoyage et normalisation des noms d'en-têtes CSV
 */
export function sanitizeHeader(header: string): string {
  if (!header) return '';
  return String(header)
    .trim()
    .toLowerCase()
    .replace(/^[\"']|[\"']$/g, '')
    // Remplacement des caractères corrompus d'encodage (ex: libell -> libelle)
    .replace(/[\uFFFD\u00EF\u00BF\u00BD]/g, 'e')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface CleanBankStatementRow {
  index: number;
  date: string;     // YYYY-MM-DD
  rawLabel: string; // Libellé brut d'origine uniquement
  amount: number;   // Montant numérique signé
}

function normalizeBankHeader(h: string): string {
  return (h || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * RÈGLE FONDAMENTALE : L'analyse et l'IA ne doivent JAMAIS se fier aux colonnes Catégorie du relevé bancaire (RB).
 * Les banques catégorisent mal (catégories trompeuses, "Autre", "Divers", etc.).
 * Toute colonne de catégorie, type, statut, solde ou méta-donnée bancaire est formellement exclue.
 */
export function isBankCategoryHeader(h: string): boolean {
  const norm = normalizeBankHeader(h);
  return (
    norm.includes('cat') || // categorie, category, categories, sous-cat, etc.
    norm.includes('rubrique') ||
    norm.includes('classif') ||
    norm.includes('famille') ||
    norm.includes('groupe') ||
    norm.includes('nature') ||
    norm.includes('statut') ||
    norm.includes('pointage') ||
    norm.includes('solde') ||
    norm.includes('balance') ||
    norm.includes('devise') ||
    norm.includes('currency') ||
    norm.includes('monnaie') ||
    norm.includes('compte') ||
    norm.includes('iban') ||
    norm.includes('bic') ||
    norm === 'type' ||
    norm.startsWith('type ') ||
    norm.includes('type op') ||
    norm.includes('type de')
  );
}

/**
 * Détecte si un en-tête correspond à un libellé ou une description de l'opération
 */
export function isBankDescriptionHeader(h: string): boolean {
  if (isBankCategoryHeader(h)) return false;
  const norm = normalizeBankHeader(h);
  if (norm.includes('date')) return false;
  if (norm.includes('montant') || norm.includes('debit') || norm.includes('credit') || norm.includes('valeur')) return false;
  return (
    norm.includes('libelle') ||
    norm.includes('label') ||
    norm.includes('description') ||
    norm.includes('detail') ||
    norm.includes('motif') ||
    norm.includes('texte') ||
    norm.includes('operation') ||
    norm.includes('marchand') ||
    norm.includes('commerce') ||
    norm.includes('beneficiaire') ||
    norm.includes('emetteur') ||
    norm.includes('communication') ||
    norm.includes('remarque')
  );
}

/**
 * Filtre et supprime TOUTES les colonnes inutiles ou trompeuses de la banque (y compris les catégories bancaires fausses).
 * Ne conserve strictement que 3 informations fiables : Date, Libellé de compte brut, et Montant.
 */
export function extractCleanBankStatementRows(csvContent: string): CleanBankStatementRow[] {
  const parsed = Papa.parse(csvContent.trim(), {
    skipEmptyLines: true
  });

  const rows = (parsed.data as string[][]) || [];
  if (rows.length < 2) return [];

  // Détection de la ligne d'en-tête
  let headerLineIndex = 0;
  let maxScore = -1;
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const rowJoined = rows[i].map(sanitizeHeader).join(' ');
    let score = 0;
    if (rowJoined.includes('date')) score += 3;
    if (rowJoined.includes('libelle') || rowJoined.includes('desc') || rowJoined.includes('operation')) score += 3;
    if (rowJoined.includes('montant') || rowJoined.includes('debit') || rowJoined.includes('credit')) score += 3;
    if (score > maxScore) {
      maxScore = score;
      headerLineIndex = i;
    }
  }

  const headers = (rows[headerLineIndex] || []).map(sanitizeHeader);

  const dateColIndices = new Set<number>();
  headers.forEach((h, idx) => {
    if (h.includes('date')) dateColIndices.add(idx);
  });

  let dateIdx = headers.findIndex(h => 
    h.includes('date operation') || 
    h.includes('date transaction') || 
    h.includes('date compta') || 
    h === 'date'
  );
  if (dateIdx === -1) dateIdx = headers.findIndex(h => h.includes('date'));

  // Détection des colonnes de libellés / descriptions (en excluant formellement toute catégorie ou métadonnée)
  const descColIndices: number[] = [];
  headers.forEach((h, idx) => {
    if (dateColIndices.has(idx)) return;
    if (isBankCategoryHeader(h)) return; // EXCLUSION STRICTE DES CATÉGORIES BANCAIRES
    if (isBankDescriptionHeader(h)) {
      descColIndices.push(idx);
    }
  });

  // Si plusieurs colonnes descriptives existent (ex: Libellé + Détail de l'écriture), on les ordonne
  // en plaçant les détails les plus complets
  descColIndices.sort((a, b) => {
    const ha = headers[a];
    const hb = headers[b];
    const scoreA = (ha.includes('detail') || ha.includes('complet') || ha.includes('complementaire') || ha.includes('enrichi')) ? 2 : 1;
    const scoreB = (hb.includes('detail') || hb.includes('complet') || hb.includes('complementaire') || hb.includes('enrichi')) ? 2 : 1;
    return scoreB - scoreA;
  });

  const amountIdx = headers.findIndex(h => h.includes('montant') || (h.includes('valeur') && !h.includes('date')));
  const debitIdx = headers.findIndex(h => h.includes('debit'));
  const creditIdx = headers.findIndex(h => h.includes('credit'));

  const cleanRows: CleanBankStatementRow[] = [];
  const seenRowKeys = new Set<string>();
  let itemIndex = 0;

  for (let i = headerLineIndex + 1; i < rows.length; i++) {
    const cols = rows[i];
    if (!cols || cols.length < 2) continue;

    // 1. Date (YYYY-MM-DD)
    let rawDate = dateIdx >= 0 && cols[dateIdx] ? cols[dateIdx] : cols[0];
    let formattedDate = '';
    if (rawDate) {
      const dmy = String(rawDate).match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
      if (dmy) {
        formattedDate = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
      } else if (/^\d{4}-\d{2}-\d{2}/.test(String(rawDate))) {
        formattedDate = String(rawDate).slice(0, 10);
      }
    }
    if (!formattedDate) continue;

    // 2. Libellé brut d'origine (capturé UNIQUEMENT depuis les vraies colonnes de compte, sans colonne catégorie)
    let rawLabel = '';
    if (descColIndices.length > 0) {
      const parts: string[] = [];
      for (const idx of descColIndices) {
        const val = String(cols[idx] || '').trim();
        if (
          val &&
          val.length > 1 &&
          !parts.some(p => p.toLowerCase().includes(val.toLowerCase()) || val.toLowerCase().includes(p.toLowerCase()))
        ) {
          parts.push(val);
        }
      }
      rawLabel = parts.join(' ').trim();
    }

    // Fallback de sécurité : chercher une cellule textuelle en ignorant STRICTEMENT toute colonne catégorie
    if (!rawLabel) {
      for (let c = 0; c < cols.length; c++) {
        if (dateColIndices.has(c)) continue;
        if (c === amountIdx || c === debitIdx || c === creditIdx) continue;
        if (isBankCategoryHeader(headers[c])) continue; // NE JAMAIS PRENDRE UNE COLONNE CATÉGORIE
        const val = String(cols[c] || '').trim();
        if (
          val.length > 2 && 
          isNaN(Number(val.replace(',', '.'))) &&
          !/^\d{1,2}[./-]\d{1,2}([./-]\d{2,4})?$/.test(val) &&
          !/^\d{4}-\d{2}-\d{2}$/.test(val)
        ) {
          rawLabel = val;
          break;
        }
      }
    }

    if (!rawLabel) continue;
    const sanitizedLabel = sanitizeRawBankLabel(rawLabel);
    if (!sanitizedLabel) continue;

    // 3. Montant
    let amount = 0;
    if (debitIdx >= 0 || creditIdx >= 0) {
      const debitRaw = debitIdx >= 0 ? String(cols[debitIdx] || '') : '';
      const creditRaw = creditIdx >= 0 ? String(cols[creditIdx] || '') : '';
      const debit = parseFloat(debitRaw.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
      const credit = parseFloat(creditRaw.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
      amount = credit !== 0 ? Math.abs(credit) : -Math.abs(debit);
    } else if (amountIdx >= 0 && cols[amountIdx]) {
      const cleanAmt = String(cols[amountIdx]).replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
      amount = parseFloat(cleanAmt) || 0;
    }

    if (isNaN(amount) || amount === 0) continue;

    // Suppression stricte des doublons au sein du fichier CSV (même date, montant identique et même libellé normalisé)
    const rowKey = `${formattedDate}_${amount.toFixed(2)}_${sanitizedLabel.toLowerCase()}`;
    if (seenRowKeys.has(rowKey)) {
      continue;
    }
    seenRowKeys.add(rowKey);

    // Conserve UNIQUEMENT Date, Libellé brut assaini, Montant
    cleanRows.push({
      index: itemIndex++,
      date: formattedDate,
      rawLabel: sanitizedLabel,
      amount
    });
  }

  return cleanRows;
}

/**
 * Parseur universel de relevés bancaires multi-formats CSV (Société Générale, Fortuneo, Revolut, etc.)
 */
export function parseCSVBankStatement(csvContent: string): { bankName: string; transactions: BankTransaction[] } {
  const bankName = detectBankName(csvContent);
  
  // 1. Parsing robuste avec PapaParse (gestion des délimiteurs ;, virgules, tabulations, guillemets et sauts de ligne)
  const parsed = Papa.parse(csvContent.trim(), {
    skipEmptyLines: true
  });

  const rows = (parsed.data as string[][]) || [];
  if (rows.length < 2) return { bankName, transactions: [] };

  // 2. Détection intelligente de la ligne d'en-tête
  let headerLineIndex = 0;
  let maxScore = -1;
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const rowJoined = rows[i].map(sanitizeHeader).join(' ');
    let score = 0;
    if (rowJoined.includes('date')) score += 3;
    if (rowJoined.includes('libelle') || rowJoined.includes('desc') || rowJoined.includes('operation')) score += 3;
    if (rowJoined.includes('montant') || rowJoined.includes('debit') || rowJoined.includes('credit')) score += 3;
    if (score > maxScore) {
      maxScore = score;
      headerLineIndex = i;
    }
  }

  const rawHeaders = rows[headerLineIndex] || [];
  const headers = rawHeaders.map(sanitizeHeader);

  // Repérer TOUTES les colonnes contenant une date (date opération, date valeur, etc.)
  const dateColIndices = new Set<number>();
  headers.forEach((h, idx) => {
    if (h.includes('date')) {
      dateColIndices.add(idx);
    }
  });

  // Sélection de la date de l'opération (priorité à date opération / transaction / comptabilisation)
  let dateIdx = headers.findIndex(h => 
    h.includes('date operation') || 
    h.includes('date transaction') || 
    h.includes('date compta') || 
    h === 'date'
  );
  if (dateIdx === -1) {
    dateIdx = headers.findIndex(h => h.includes('date'));
  }
  
  // 3. RÈGLE CRITIQUE UTILISATEUR :
  // Priorité absolue au « Libellé complet » pour capturer le vrai marchand
  // Et NE JAMAIS se focaliser sur « Catégorie » ou « Sous-Catégorie » de la banque
  let fullDescIdx = headers.findIndex(h => {
    return (
      (h.includes('libelle') && h.includes('complet')) ||
      (h.includes('libelle') && h.includes('detail')) ||
      (h.includes('libelle') && h.includes('complementaire')) ||
      (h.includes('libelle') && h.includes('enrichi')) ||
      (h.includes('libelle') && h.includes('etendu')) ||
      (h.includes('libelle') && h.includes('long')) ||
      (h.includes('texte') && h.includes('complet')) ||
      (h.includes('information') && h.includes('complementaire')) ||
      (h.includes('detail') && h.includes('operation'))
    );
  });

  // Fallback description index - en excluant rigoureusement toute colonne Date ou Catégorie / Sous-Catégorie
  let fallbackDescIdx = -1;
  if (fullDescIdx === -1) {
    fallbackDescIdx = headers.findIndex((h, idx) => {
      if (dateColIndices.has(idx)) return false; // JAMAIS UNE COLONNE DATE
      if (isBankCategoryHeader(h)) return false; // STRICTEMENT IGNORÉ (Catégories bancaires fausses)
      return isBankDescriptionHeader(h);
    });
  }

  // Montant : EXCLURE STRICTEMENT 'date valeur' (qui contient 'valeur' mais est une date !)
  const amountIdx = headers.findIndex(h => 
    h.includes('montant') || 
    (h.includes('valeur') && !h.includes('date'))
  );
  const debitIdx = headers.findIndex(h => h.includes('debit'));
  const creditIdx = headers.findIndex(h => h.includes('credit'));

  const results: BankTransaction[] = [];

  for (let i = headerLineIndex + 1; i < rows.length; i++) {
    const cols = rows[i];
    if (!cols || cols.length < 2) continue;

    // 1. Parsing de la date
    let rawDate = dateIdx >= 0 && cols[dateIdx] ? cols[dateIdx] : cols[0];
    let formattedDate = new Date().toISOString().split('T')[0];
    if (rawDate) {
      const dmy = String(rawDate).match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
      if (dmy) {
        formattedDate = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
      } else if (/^\d{4}-\d{2}-\d{2}/.test(String(rawDate))) {
        formattedDate = String(rawDate).slice(0, 10);
      }
    }

    // 2. Sélection stricte du libellé complet (en ignorant totalement Catégorie & Sous-Catégorie et colonnes de Date)
    let rawDescription = '';
    if (fullDescIdx >= 0 && cols[fullDescIdx] && String(cols[fullDescIdx]).trim()) {
      rawDescription = String(cols[fullDescIdx]).trim();
    } else if (fallbackDescIdx >= 0 && cols[fallbackDescIdx] && String(cols[fallbackDescIdx]).trim()) {
      rawDescription = String(cols[fallbackDescIdx]).trim();
    } else {
      for (let c = 0; c < cols.length; c++) {
        if (dateColIndices.has(c)) continue; // STRICTEMENT IGNORER LES DATES
        if (c === amountIdx || c === debitIdx || c === creditIdx) continue;
        const hName = headers[c] || '';
        if (isBankCategoryHeader(hName)) continue; // STRICTEMENT IGNORÉ (Catégories bancaires fausses)
        const val = String(cols[c] || '').trim();
        // Le libellé ne doit être ni un nombre, ni une date au format JJ/MM/AAAA ou AAAA-MM-JJ
        if (
          val.length > 2 && 
          isNaN(Number(val.replace(',', '.'))) &&
          !/^\d{1,2}[./-]\d{1,2}([./-]\d{2,4})?$/.test(val) &&
          !/^\d{4}-\d{2}-\d{2}$/.test(val)
        ) {
          rawDescription = val;
          break;
        }
      }
    }

    // 3. Parsing du montant
    let amount = 0;
    if (debitIdx >= 0 || creditIdx >= 0) {
      const debitRaw = debitIdx >= 0 ? String(cols[debitIdx] || '') : '';
      const creditRaw = creditIdx >= 0 ? String(cols[creditIdx] || '') : '';
      const debit = parseFloat(debitRaw.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
      const credit = parseFloat(creditRaw.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
      amount = credit !== 0 ? Math.abs(credit) : -Math.abs(debit);
    } else if (amountIdx >= 0 && cols[amountIdx]) {
      const cleanAmt = String(cols[amountIdx]).replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
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
      rawLabel: rawDescription, // Le Libellé complet original préservé
      cleanLabel: cleanDesc,
      amount,
      flowType,
      category,
      account: bankName,
      bankName,
      isSubscription,
      subscriptionDay,
      confidence: category !== 'Autre' ? 'high' : 'medium',
      status: flowType === 'SAVINGS_TRANSFER' ? 'Internal Transfer' : 'Reconciled'
    });
  }

  return { bankName, transactions: results };
}
