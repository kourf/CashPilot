/**
 * Module Centralisé et Transparent de Catégorisation Financière CashPilot
 * 
 * Définit avec une rigueur absolue :
 * 1. Les règles d'attribution de catégories et de natures (Charges Fixes vs Variables vs Neutres)
 * 2. La détection et l'isolation des Mouvements Inter-Comptes (flux propres neutralisés)
 * 3. La détection et le suivi des Échanges Famille & Amis (Wero, Paylib, proches)
 * 4. La transparence complète de la règle et du mot-clé ayant motivé chaque qualification
 */

export type FlowNature = 'fixe' | 'variable' | 'autre';
export type FlowType = 'INCOME' | 'FIXED_EXPENSE' | 'VARIABLE_EXPENSE' | 'SAVINGS_TRANSFER';

export interface CategoryMetadata {
  name: string;
  defaultNature: FlowNature;
  description: string;
  iconName: string;
  color: string;
  isNeutral?: boolean;
}

export interface CategorizationMatch {
  category: string;
  nature: FlowNature;
  flowType: FlowType;
  isInternalTransfer: boolean;
  isFamilyTransfer: boolean;
  isSubscription: boolean;
  isBankFee: boolean;
  matchedRule: string;
  ruleExplanation: string;
}

/**
 * Référentiel des catégories avec leur qualification par défaut et description
 */
export const CATEGORIES_METADATA: Record<string, CategoryMetadata> = {
  // --- CHARGES FIXES (Incompressibles / Récurrentes) ---
  'Logement & Énergie': {
    name: 'Logement & Énergie',
    defaultNature: 'fixe',
    description: 'Loyer, mensualités de crédit immobilier, électricité, gaz, eau, charges de copropriété.',
    iconName: 'Home',
    color: '#3B82F6'
  },
  'Assurances': {
    name: 'Assurances',
    defaultNature: 'fixe',
    description: 'Assurance habitation, automobile, mutuelle santé, prévoyance et responsabilité civile.',
    iconName: 'Shield',
    color: '#6366F1'
  },
  'Abonnements & Télécom': {
    name: 'Abonnements & Télécom',
    defaultNature: 'fixe',
    description: 'Forfaits mobiles, box internet, plateformes de streaming, musique, cloud et salles de sport.',
    iconName: 'Smartphone',
    color: '#8B5CF6'
  },
  'Frais bancaires': {
    name: 'Frais bancaires',
    defaultNature: 'fixe',
    description: 'Cotisations de carte bancaire, frais de tenue de compte, commissions d\'intervention et agios.',
    iconName: 'Building2',
    color: '#EC4899'
  },
  'Impôts & Amendes': {
    name: 'Impôts & Amendes',
    defaultNature: 'fixe',
    description: 'Impôt sur le revenu, taxe foncière, redevance, taxes locales et amendes administratives.',
    iconName: 'FileCheck',
    color: '#EF4444'
  },
  'Paiement fractionné': {
    name: 'Paiement fractionné',
    defaultNature: 'fixe',
    description: 'Échéances Klarna, Alma, Oney, Scalapay ou paiements en 3x/4x.',
    iconName: 'CalendarClock',
    color: '#F97316'
  },

  // --- CHARGES VARIABLES (Consommation courante / Arbitrables) ---
  'Alimentation & Courses': {
    name: 'Alimentation & Courses',
    defaultNature: 'variable',
    description: 'Supermarchés, hypermarchés, épiceries, boulangeries, boucheries et marchés de bouche.',
    iconName: 'ShoppingCart',
    color: '#10B981'
  },
  'Transports & Carburant': {
    name: 'Transports & Carburant',
    defaultNature: 'variable',
    description: 'Stations-service, péages, parkings, transports en commun, SNCF, RATP, taxis et VTC.',
    iconName: 'Car',
    color: '#06B6D4'
  },
  'Restaurants & Sorties': {
    name: 'Restaurants & Sorties',
    defaultNature: 'variable',
    description: 'Restaurants, cafés, bars, restauration rapide, Uber Eats, Deliveroo et sorties nocturnes.',
    iconName: 'UtensilsCrossed',
    color: '#F59E0B'
  },
  'Shopping & Maison': {
    name: 'Shopping & Maison',
    defaultNature: 'variable',
    description: 'Vêtements, chaussures, équipement de la maison, bricolage, jardinage et ameublement.',
    iconName: 'ShoppingBag',
    color: '#14B8A6'
  },
  'Loisirs & Activités': {
    name: 'Loisirs & Activités',
    defaultNature: 'variable',
    description: 'Cinémas, spectacles, concerts, musées, vacances, parcs d\'attraction et activités sportives.',
    iconName: 'Ticket',
    color: '#A855F7'
  },
  'Santé': {
    name: 'Santé',
    defaultNature: 'variable',
    description: 'Pharmacies, consultations médicales, soins dentaires, optique et analyses biologiques.',
    iconName: 'HeartPulse',
    color: '#0EA5E9'
  },
  'Retrait Espèces': {
    name: 'Retrait Espèces',
    defaultNature: 'variable',
    description: 'Retraits de billets au distributeur automatique (DAB/GAB).',
    iconName: 'Banknote',
    color: '#64748B'
  },
  'Autre': {
    name: 'Autre',
    defaultNature: 'variable',
    description: 'Dépenses et opérations diverses non rattachées à une catégorie prédéfinie.',
    iconName: 'HelpCircle',
    color: '#94A3B8'
  },
  'Autres dépenses': {
    name: 'Autres dépenses',
    defaultNature: 'variable',
    description: 'Dépenses courantes diverses non ventilées.',
    iconName: 'HelpCircle',
    color: '#94A3B8'
  },

  // --- MOUVEMENTS INTER-COMPTES (Flux Propres Neutralisés) ---
  'Virements Internes': {
    name: 'Virements Internes',
    defaultNature: 'autre',
    description: 'Transferts de fonds entre vos propres comptes bancaires au même nom.',
    iconName: 'ArrowLeftRight',
    color: '#6366F1',
    isNeutral: true
  },
  'Épargne & Investissement': {
    name: 'Épargne & Investissement',
    defaultNature: 'autre',
    description: 'Versements vers Livret A, LDDS, PEL, PEA, assurance-vie et comptes de placement.',
    iconName: 'PiggyBank',
    color: '#10B981',
    isNeutral: true
  },
  'Remboursement Carte (Amex)': {
    name: 'Remboursement Carte (Amex)',
    defaultNature: 'autre',
    description: 'Prélèvement global d\'une carte à débit différé (Amex/CB Diff). Neutralisé en flux de trésorerie pour éviter le double comptage avec les achats détaillés.',
    iconName: 'CreditCard',
    color: '#0284C7',
    isNeutral: true
  },
  'Virement vers Fortuneo': {
    name: 'Virement vers Fortuneo',
    defaultNature: 'autre',
    description: 'Transfert émis vers votre compte Fortuneo.',
    iconName: 'ArrowUpRight',
    color: '#0D9488',
    isNeutral: true
  },
  'Virement reçu de Fortuneo': {
    name: 'Virement reçu de Fortuneo',
    defaultNature: 'autre',
    description: 'Fonds reçus depuis votre compte Fortuneo.',
    iconName: 'ArrowDownLeft',
    color: '#0D9488',
    isNeutral: true
  },
  'Virement vers Revolut': {
    name: 'Virement vers Revolut',
    defaultNature: 'autre',
    description: 'Transfert émis vers votre compte Revolut.',
    iconName: 'ArrowUpRight',
    color: '#2563EB',
    isNeutral: true
  },

  // --- ÉCHANGES FAMILLE & AMIS (Particuliers & Proches) ---
  'Virements Famille & Proches': {
    name: 'Virements Famille & Proches',
    defaultNature: 'autre',
    description: 'Virements émis à destination de proches, amis, colocataires ou membres de la famille.',
    iconName: 'Users',
    color: '#F43F5E'
  },
  'Virement Reçu (Proches)': {
    name: 'Virement Reçu (Proches)',
    defaultNature: 'autre',
    description: 'Remboursements et sommes reçues de particuliers via Wero, Paylib ou virement bancaire.',
    iconName: 'HandCoins',
    color: '#10B981'
  },
  'Solidarité': {
    name: 'Solidarité',
    defaultNature: 'autre',
    description: 'Aides financières directes accordées à des proches.',
    iconName: 'HeartHandshake',
    color: '#E11D48'
  },

  // --- REVENUS & REMBOURSEMENTS ---
  'Salaire & Revenus': {
    name: 'Salaire & Revenus',
    defaultNature: 'autre',
    description: 'Salaires, traitements, primes professionnelles et honoraires.',
    iconName: 'TrendingUp',
    color: '#10B981'
  },
  'Aides & Allocations': {
    name: 'Aides & Allocations',
    defaultNature: 'autre',
    description: 'Prestations sociales CAF, allocations chômage France Travail, bourses et pensions.',
    iconName: 'Gift',
    color: '#22C55E'
  },
  'Remboursements/Avances': {
    name: 'Remboursements/Avances',
    defaultNature: 'autre',
    description: 'Remboursements de frais professionnels, de commerçants ou avances de trésorerie.',
    iconName: 'RotateCcw',
    color: '#14B8A6'
  }
};

/**
 * Règles sémantiques et mots-clés d'attribution
 */
interface SemanticRule {
  id: string;
  priority: number;
  pattern: RegExp | string[];
  category: string;
  nature: FlowNature;
  flowType: FlowType;
  isInternalTransfer?: boolean;
  isFamilyTransfer?: boolean;
  isSubscription?: boolean;
  isBankFee?: boolean;
  ruleExplanation: string;
  matchedRuleText: string;
}

const SEMANTIC_RULES: SemanticRule[] = [
  // 1. Double comptage & cartes à débit différé (Cas 2 : achats détaillés déjà saisis)
  {
    id: 'amex_deferred',
    priority: 100,
    pattern: ['american express', 'amex', 'cb differe', 'cb différé', 'carte diff', 'prelevement amex', 'prélèvement amex'],
    category: 'Remboursement Carte (Amex)',
    nature: 'autre',
    flowType: 'SAVINGS_TRANSFER',
    isInternalTransfer: true,
    matchedRuleText: 'Prélèvement Carte Différée (Amex / CB diff)',
    ruleExplanation: 'Neutralisation anti-double comptage : ce prélèvement règle des dépenses par carte déjà enregistrées en détail.'
  },

  // 2. Paiements fractionnés
  {
    id: 'installments',
    priority: 95,
    pattern: ['klarna', 'alma', 'oney', 'scalapay', 'floa', 'clearpay', 'paiement 3x', 'paiement 4x', '3x 4x'],
    category: 'Paiement fractionné',
    nature: 'fixe',
    flowType: 'FIXED_EXPENSE',
    isSubscription: true,
    matchedRuleText: 'Paiement fractionné (Klarna, Alma, Oney, etc.)',
    ruleExplanation: 'Échéance fractionnée récurrente engagée, qualifiée en charge fixe pour le reste à vivre.'
  },

  // 3. Mouvements inter-comptes propres (Livrets, Épargne, Virements internes)
  {
    id: 'internal_own_accounts',
    priority: 90,
    pattern: [
      'virement interne', 'compte a compte', 'compte à compte',
      'livret a', 'livret bleu', 'ldds', 'pel', 'pea', 'cel', 'lep',
      'assurance vie', 'assurance-vie', 'vers epargne', 'de epargne'
    ],
    category: 'Virements Internes',
    nature: 'autre',
    flowType: 'SAVINGS_TRANSFER',
    isInternalTransfer: true,
    matchedRuleText: 'Mouvement inter-comptes (Livrets, Épargne, Comptes propres)',
    ruleExplanation: 'Flux neutre entre vos propres comptes bancaires : exclu des charges réelles de consommation.'
  },

  // 4. Échanges entre proches & particuliers (Wero, Paylib, Lydia, Lyf, Vir inst, Proches)
  {
    id: 'peer_wero_paylib',
    priority: 85,
    pattern: [
      'wero', 'paylib', 'lydia', 'lyf', 'lyf pay', 'vir inst', 'vir inst recu', 'vir inst emis',
      'virement instantane', 'virement instantané',
      'nayssa', 'naustaba', 'naistaba', 'malaguti', 'el hani'
    ],
    category: 'Virements Famille & Proches',
    nature: 'autre',
    flowType: 'VARIABLE_EXPENSE',
    isFamilyTransfer: true,
    matchedRuleText: 'Échange particulier / proche (Wero, Paylib, Lyf, Vir Inst, proches)',
    ruleExplanation: 'Échange financier direct entre particuliers tracé dans le module Famille & Amis.'
  },

  // 5. Revenus : Salaire
  {
    id: 'income_salary',
    priority: 80,
    pattern: ['salaire', 'paye', 'remuneration', 'traitement', 'virement employeur'],
    category: 'Salaire & Revenus',
    nature: 'autre',
    flowType: 'INCOME',
    matchedRuleText: 'Salaire ou rémunération professionnelle',
    ruleExplanation: 'Encaissement principal de revenu d\'activité professionnelle.'
  },

  // 6. Revenus : Allocations & Aides
  {
    id: 'income_social',
    priority: 78,
    pattern: [
      'france travail', 'pole emploi', 'assedic', 'caf ', 'caf de',
      'caisse allocations', 'apl', 'rsa', 'cnav', 'carsat', 'retraite'
    ],
    category: 'Aides & Allocations',
    nature: 'autre',
    flowType: 'INCOME',
    matchedRuleText: 'Prestation sociale (CAF, France Travail, Retraite)',
    ruleExplanation: 'Revenu d\'aide publique ou prestation sociale créditée sur le compte.'
  },

  // 7. Charges Fixes : Logement & Énergie
  {
    id: 'housing_energy',
    priority: 70,
    pattern: [
      'loyer', 'prelevement loyer', 'bail', 'syndic', 'foncia', 'nexity',
      'edf', 'engie', 'totalenergies', 'total energies', 'eni ', 'eni gaz',
      'veolia', 'suez', 'eau de paris', 'eaux', 'gaz de bordeaux'
    ],
    category: 'Logement & Énergie',
    nature: 'fixe',
    flowType: 'FIXED_EXPENSE',
    isSubscription: true,
    matchedRuleText: 'Loyer, énergie ou eau obligatoire',
    ruleExplanation: 'Charge fixe incompressible indispensable au maintien du logement.'
  },

  // 8. Charges Fixes : Assurances
  {
    id: 'insurance',
    priority: 68,
    pattern: [
      'macif', 'maif', 'matmut', 'axa', 'allianz', 'mma', 'direct assurance',
      'generali', 'groupama', 'gmf', 'alan', 'mgen', 'harmonie mutuelle', 'pro btp'
    ],
    category: 'Assurances',
    nature: 'fixe',
    flowType: 'FIXED_EXPENSE',
    isSubscription: true,
    matchedRuleText: 'Contrat d\'assurance ou mutuelle',
    ruleExplanation: 'Contrat récurrent d\'assurance habitation, auto ou complémentaire santé.'
  },

  // 9. Charges Fixes : Abonnements & Télécom
  {
    id: 'telecom_subscriptions',
    priority: 65,
    pattern: [
      'orange', 'sfr', 'free mobile', 'free telecom', 'freebox', 'bouygues',
      'sosh', 'red by sfr', 'netflix', 'spotify', 'deezer', 'apple.com',
      'google one', 'youtube', 'amazon prime', 'prime video', 'disney',
      'canal+', 'canal plus', 'basic fit', 'fitness park', 'chatgpt', 'openai'
    ],
    category: 'Abonnements & Télécom',
    nature: 'fixe',
    flowType: 'FIXED_EXPENSE',
    isSubscription: true,
    matchedRuleText: 'Abonnement box, mobile, streaming ou sport',
    ruleExplanation: 'Engagement récurrent périodique qualifié en charge fixe.'
  },

  // 10. Charges Fixes : Frais Bancaires
  {
    id: 'bank_fees',
    priority: 62,
    pattern: [
      'cotisation carte', 'cotisation formule', 'cotisation jazz', 'cotisation sobrio',
      'tenue de compte', 'frais tenue', 'commission d intervention', 'agios',
      'frais bancaires', 'frais de rejet', 'commission change'
    ],
    category: 'Frais bancaires',
    nature: 'fixe',
    flowType: 'FIXED_EXPENSE',
    isBankFee: true,
    matchedRuleText: 'Frais ou cotisation bancaire',
    ruleExplanation: 'Tarification et frais prélevés directement par l\'établissement bancaire.'
  },

  // 11. Charges Variables : Alimentation & Supermarchés
  {
    id: 'groceries',
    priority: 55,
    pattern: [
      'carrefour', 'auchan', 'leclerc', 'lidl', 'intermarche', 'intermarché',
      'monoprix', 'franprix', 'aldi', 'casino', 'picard', 'biocoop',
      'boulangerie', 'boucherie', 'naturalia', 'grand frais', 'action'
    ],
    category: 'Alimentation & Courses',
    nature: 'variable',
    flowType: 'VARIABLE_EXPENSE',
    matchedRuleText: 'Supermarché ou commerce de bouche',
    ruleExplanation: 'Dépense de consommation courante pour les courses alimentaires.'
  },

  // 12. Charges Variables : Restaurants & Sorties
  {
    id: 'dining_out',
    priority: 52,
    pattern: [
      'restaurant', 'bistrot', 'brasserie', 'mcdonald', 'mc donald', 'burger king',
      'kfc', 'uber eats', 'ubereats', 'deliveroo', 'starbucks', 'subway',
      'domino', 'pizza', 'sushi', 'bar ', 'pub '
    ],
    category: 'Restaurants & Sorties',
    nature: 'variable',
    flowType: 'VARIABLE_EXPENSE',
    matchedRuleText: 'Restauration, livraison repas ou bar',
    ruleExplanation: 'Dépense de loisir et vie sociale modulable selon le budget.'
  },

  // 13. Charges Variables : Transports & Carburant
  {
    id: 'transport',
    priority: 50,
    pattern: [
      'totalenergies rel', 'total access', 'bp ', 'esso', 'station', 'carburant',
      'sncf', 'ratp', 'uber trip', 'bolt', 'blablacar', 'parking', 'peage', 'aprr', 'vinci'
    ],
    category: 'Transports & Carburant',
    nature: 'variable',
    flowType: 'VARIABLE_EXPENSE',
    matchedRuleText: 'Carburant, péage ou transport ponctuel',
    ruleExplanation: 'Frais de déplacement et mobilité du quotidien.'
  },

  // 14. Charges Variables : Santé
  {
    id: 'health_expense',
    priority: 48,
    pattern: [
      'pharmacie', 'doctolib', 'laboratoire', 'dentiste', 'ophtalmologiste',
      'kinesitherapeute', 'opticien', 'optique', 'centre medical'
    ],
    category: 'Santé',
    nature: 'variable',
    flowType: 'VARIABLE_EXPENSE',
    matchedRuleText: 'Pharmacie ou professionnel de santé',
    ruleExplanation: 'Dépense de santé et soins personnels.'
  },

  // 15. Charges Variables : Shopping & Maison
  {
    id: 'shopping',
    priority: 45,
    pattern: [
      'amazon', 'fnac', 'darty', 'ikea', 'leroy merlin', 'castorama',
      'zara', 'h&m', 'uniqlo', 'decathlon', 'kiabi', 'aliexpress', 'temu', 'shein'
    ],
    category: 'Shopping & Maison',
    nature: 'variable',
    flowType: 'VARIABLE_EXPENSE',
    matchedRuleText: 'Enseigne shopping, habillement ou équipement',
    ruleExplanation: 'Achats d\'habillement, décoration, matériel ou commande e-commerce.'
  }
];

/**
 * Analyse et qualifie une transaction avec transparence de la règle appliquée
 */
export function categorizeTransactionWithRule(
  rawLabel: string,
  amount: number,
  options?: {
    ownAccountsKeywords?: string[];
    familyKeywords?: string[];
  }
): CategorizationMatch {
  const norm = (rawLabel || '').toLowerCase().trim();
  const isCredit = amount > 0;

  // 1. Priorité aux mots-clés personnalisés de l'utilisateur pour les comptes propres
  if (options?.ownAccountsKeywords && options.ownAccountsKeywords.length > 0) {
    const matchedOwn = options.ownAccountsKeywords.find(kw => kw && norm.includes(kw.toLowerCase().trim()));
    if (matchedOwn) {
      return {
        category: 'Virements Internes',
        nature: 'autre',
        flowType: 'SAVINGS_TRANSFER',
        isInternalTransfer: true,
        isFamilyTransfer: false,
        isSubscription: false,
        isBankFee: false,
        matchedRule: `Compte propre utilisateur : "${matchedOwn}"`,
        ruleExplanation: 'Identifié comme votre propre compte : neutralisé de la trésorerie pour préserver le reste à vivre.'
      };
    }
  }

  // 2. Priorité aux mots-clés personnalisés pour la famille / proches
  if (options?.familyKeywords && options.familyKeywords.length > 0) {
    const matchedFamily = options.familyKeywords.find(kw => kw && norm.includes(kw.toLowerCase().trim()));
    if (matchedFamily) {
      return {
        category: isCredit ? 'Virement Reçu (Proches)' : 'Virements Famille & Proches',
        nature: 'autre',
        flowType: isCredit ? 'INCOME' : 'VARIABLE_EXPENSE',
        isInternalTransfer: false,
        isFamilyTransfer: true,
        isSubscription: false,
        isBankFee: false,
        matchedRule: `Proche / Famille détecté : "${matchedFamily}"`,
        ruleExplanation: 'Identifié comme un proche : suivi dans le module analytique Famille & Amis.'
      };
    }
  }

  // 3. Détection par le moteur de règles sémantiques ordonnées par priorité
  for (const rule of SEMANTIC_RULES) {
    let matches = false;
    if (Array.isArray(rule.pattern)) {
      matches = rule.pattern.some(p => norm.includes(p));
    } else if (rule.pattern instanceof RegExp) {
      matches = rule.pattern.test(norm);
    }

    if (matches) {
      // Ajustement spécifique pour les montants positifs reçus via Wero / proches
      if (rule.id === 'peer_wero_paylib' && isCredit) {
        return {
          category: 'Virement Reçu (Proches)',
          nature: 'autre',
          flowType: 'INCOME',
          isInternalTransfer: false,
          isFamilyTransfer: true,
          isSubscription: false,
          isBankFee: false,
          matchedRule: rule.matchedRuleText + ' (Entrée)',
          ruleExplanation: 'Argent reçu d\'un proche via Wero/Paylib comptabilisé en rentrée dans le module Famille & Amis.'
        };
      }

      return {
        category: rule.category,
        nature: rule.nature,
        flowType: rule.flowType,
        isInternalTransfer: Boolean(rule.isInternalTransfer),
        isFamilyTransfer: Boolean(rule.isFamilyTransfer),
        isSubscription: Boolean(rule.isSubscription),
        isBankFee: Boolean(rule.isBankFee),
        matchedRule: rule.matchedRuleText,
        ruleExplanation: rule.ruleExplanation
      };
    }
  }

  // 4. Détection virement générique émis vers un tiers
  if (norm.startsWith('vir ') || norm.startsWith('virement ') || norm.includes('virement instantane')) {
    if (isCredit) {
      return {
        category: 'Virement Reçu (Proches)',
        nature: 'autre',
        flowType: 'INCOME',
        isInternalTransfer: false,
        isFamilyTransfer: true,
        isSubscription: false,
        isBankFee: false,
        matchedRule: 'Virement bancaire entrant reçu',
        ruleExplanation: 'Encaissement par virement d\'un émetteur particulier ou organisme.'
      };
    } else {
      return {
        category: 'Virements Famille & Proches',
        nature: 'autre',
        flowType: 'VARIABLE_EXPENSE',
        isInternalTransfer: false,
        isFamilyTransfer: true,
        isSubscription: false,
        isBankFee: false,
        matchedRule: 'Virement bancaire émis vers un tiers',
        ruleExplanation: 'Virement vers un destinataire individuel suivi dans les échanges de particuliers.'
      };
    }
  }

  // 5. Repli automatique
  if (isCredit) {
    return {
      category: 'Salaire & Revenus',
      nature: 'autre',
      flowType: 'INCOME',
      isInternalTransfer: false,
      isFamilyTransfer: false,
      isSubscription: false,
      isBankFee: false,
      matchedRule: 'Flux entrant non catégorisé',
      ruleExplanation: 'Montant positif comptabilisé en revenu complémentaire.'
    };
  }

  return {
    category: 'Autre',
    nature: 'variable',
    flowType: 'VARIABLE_EXPENSE',
    isInternalTransfer: false,
    isFamilyTransfer: false,
    isSubscription: false,
    isBankFee: false,
    matchedRule: 'Libellé générique / Non répertorié',
    ruleExplanation: 'Opération courante sans mot-clé spécifique détecté, classée par défaut en dépense variable.'
  };
}

/**
 * Structure de synthèse par catégorie pour l'audit et la vue détaillée
 */
export interface CategoryStatsItem {
  category: string;
  totalAmount: number;
  fixedAmount: number;
  variableAmount: number;
  otherAmount: number;
  fixedPercentage: number;
  variablePercentage: number;
  txCount: number;
  percentage: number; // % des dépenses réelles totales
  defaultNature: FlowNature;
  description: string;
  iconName: string;
  color: string;
  transactions: any[];
}

export interface CategoriesSummaryResult {
  categories: CategoryStatsItem[];
  totalExpenses: number;
  totalFixed: number;
  totalVariable: number;
}

/**
 * Calcule avec rigueur arithmétique la ventilation complète par catégorie et nature
 */
export function calculateCategoryStats(transactions: any[]): CategoriesSummaryResult {
  const categoryMap = new Map<string, {
    total: number;
    fixed: number;
    variable: number;
    other: number;
    txs: any[];
  }>();

  let totalExpenses = 0;
  let totalFixed = 0;
  let totalVariable = 0;

  transactions.forEach(tx => {
    const rawAmt = Number(tx.rawAmount !== undefined ? tx.rawAmount : tx.amount) || 0;
    const isDebit = tx.flowType === 'FIXED_EXPENSE' || 
                    tx.flowType === 'VARIABLE_EXPENSE' || 
                    tx.direction === 'debit' || 
                    tx.type === 'debit' || 
                    rawAmt < 0;

    // Si c'est un crédit/revenu avéré et non une dépense, on ignore
    if (!isDebit && (tx.flowType === 'INCOME' || tx.direction === 'credit' || tx.type === 'credit' || rawAmt > 0)) {
      return;
    }

    const absAmt = Math.abs(rawAmt || Number(tx.amount) || 0);
    if (absAmt === 0) return;

    const cat = tx.category || 'Autres dépenses';

    // Exclure les flux internes et épargne neutralisée pour ne pas fausser les dépenses réelles de vie
    if (
      tx.isInternalTransfer ||
      cat === 'Virements Internes' ||
      cat === 'Virements internes' ||
      cat === 'Remboursement Carte (Amex)' ||
      cat === 'Épargne & Investissement' ||
      cat === 'Épargne' ||
      (tx.isInstallment && cat === 'Paiement fractionné')
    ) {
      return;
    }

    if (!categoryMap.has(cat)) {
      categoryMap.set(cat, { total: 0, fixed: 0, variable: 0, other: 0, txs: [] });
    }

    const current = categoryMap.get(cat)!;
    current.total += absAmt;
    current.txs.push(tx);

    // Détermination de la nature de la transaction individuelle
    const nature: FlowNature = tx.nature === 'fixe' ? 'fixe' : (tx.nature === 'variable' ? 'variable' : (
      CATEGORIES_METADATA[cat]?.defaultNature || 'variable'
    ));

    if (nature === 'fixe') {
      current.fixed += absAmt;
      totalFixed += absAmt;
    } else if (nature === 'variable') {
      current.variable += absAmt;
      totalVariable += absAmt;
    } else {
      current.other += absAmt;
    }

    totalExpenses += absAmt;
  });

  const categories: CategoryStatsItem[] = Array.from(categoryMap.entries()).map(([cat, data]) => {
    const meta = CATEGORIES_METADATA[cat] || {
      name: cat,
      defaultNature: 'variable',
      description: 'Dépenses diverses',
      iconName: 'Tag',
      color: '#0EA5E9'
    };

    const totalRound = Math.round(data.total * 100) / 100;
    const fixedRound = Math.round(data.fixed * 100) / 100;
    const variableRound = Math.round(data.variable * 100) / 100;

    return {
      category: cat,
      totalAmount: totalRound,
      fixedAmount: fixedRound,
      variableAmount: variableRound,
      otherAmount: Math.round(data.other * 100) / 100,
      fixedPercentage: totalRound > 0 ? Math.round((fixedRound / totalRound) * 1000) / 10 : 0,
      variablePercentage: totalRound > 0 ? Math.round((variableRound / totalRound) * 1000) / 10 : 0,
      txCount: data.txs.length,
      percentage: totalExpenses > 0 ? Math.round((totalRound / totalExpenses) * 1000) / 10 : 0,
      defaultNature: meta.defaultNature,
      description: meta.description,
      iconName: meta.iconName,
      color: meta.color,
      transactions: [...data.txs].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    };
  }).sort((a, b) => b.totalAmount - a.totalAmount);

  return {
    categories,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    totalFixed: Math.round(totalFixed * 100) / 100,
    totalVariable: Math.round(totalVariable * 100) / 100
  };
}

/**
 * Calcul et isolation du module « Mouvements Inter-Comptes »
 */
export interface InternalTransfersSummary {
  inflows: number;
  outflows: number;
  net: number;
  txCount: number;
  transactions: any[];
}

export function calculateInternalTransfers(transactions: any[]): InternalTransfersSummary {
  let inflows = 0;
  let outflows = 0;
  const filteredTxs: any[] = [];

  transactions.forEach(tx => {
    const cat = tx.category || '';
    const isInternal = Boolean(
      tx.isInternalTransfer ||
      cat === 'Virements Internes' ||
      cat === 'Virements internes' ||
      cat === 'Épargne & Investissement' ||
      cat === 'Épargne' ||
      cat === 'Remboursement Carte (Amex)' ||
      cat.includes('Fortuneo') ||
      cat.includes('Revolut')
    );

    if (isInternal) {
      const rawAmt = Number(tx.rawAmount !== undefined ? tx.rawAmount : tx.amount) || 0;
      const isCredit = tx.type === 'credit' || tx.direction === 'credit' || rawAmt > 0;
      const absAmt = Math.abs(rawAmt || Number(tx.amount) || 0);

      if (isCredit) {
        inflows += absAmt;
      } else {
        outflows += absAmt;
      }
      filteredTxs.push(tx);
    }
  });

  return {
    inflows: Math.round(inflows * 100) / 100,
    outflows: Math.round(outflows * 100) / 100,
    net: Math.round((inflows - outflows) * 100) / 100,
    txCount: filteredTxs.length,
    transactions: filteredTxs.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  };
}

/**
 * Structure de balance individuelle par proche
 */
export interface PersonPeerBalance {
  personName: string;
  avatarLetter: string;
  sent: number;     // Avancé / Envoyé (sorties de trésorerie)
  received: number; // Reçu / Remboursé (entrées de trésorerie)
  net: number;      // Reçu - Envoyé (Solde net)
  txCount: number;
  transactions: any[];
}

/**
 * Extrait intelligemment le nom de la personne concernée par le transfert
 */
export function extractPersonName(tx: any): string {
  const label = (tx.cleanLabel || tx.rawLabel || tx.description || '').trim();
  const upper = label.toUpperCase();

  // 1. Détection prioritaire par noms connus de proches
  if (upper.includes('NAYSSA') || upper.includes('NAUSTABA') || upper.includes('NAISTABA')) {
    return 'Nayssa';
  }
  if (upper.includes('MALAGUTI')) {
    return 'M. ou Mme Malaguti';
  }
  if (upper.includes('EL HANI')) {
    return 'Nayssa El Hani';
  }
  if ((upper.includes('DRAMÉ') || upper.includes('DRAME')) && !upper.includes('KOUROUFIA')) {
    return 'Dramé (Proche)';
  }

  // 2. Détection par pattern "VIR RECU ... DE: [NOM]"
  const deMatch = upper.match(/DE\s*:\s*([^,\-\/]+)/i);
  if (deMatch && deMatch[1]) {
    const rawName = deMatch[1].replace(/M\.\s*OU\s*MME/i, '').replace(/M\./i, '').replace(/MME/i, '').trim();
    if (rawName.length > 2) {
      return rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase();
    }
  }

  // 3. Détection par pattern "Wero [Nom]" ou "Paylib [Nom]" ou "Lyf [Nom]"
  const peerMatch = label.match(/(?:wero|paylib|lydia|lyf)\s+(?:reçu|envoi|vers|de)?\s*([a-zA-ZÀ-ÿ]+)/i);
  if (peerMatch && peerMatch[1]) {
    return peerMatch[1].charAt(0).toUpperCase() + peerMatch[1].slice(1).toLowerCase();
  }

  // 4. Nettoyage générique des préfixes bancaires
  let clean = label
    .replace(/^VIR\s+(?:RECU|EMIS|INSTANTANE|INST)?\s*/i, '')
    .replace(/^VIREMENT\s+(?:RECU|EMIS|INSTANTANE)?\s*/i, '')
    .replace(/\b(?:REVOLUT|UBS|FORTUNEO|SG|LOGITEL|DE:)\b/gi, '')
    .replace(/\d+/g, '')
    .trim();

  if (clean.length > 2) {
    const words = clean.split(/\s+/).filter(w => w.length > 1);
    if (words.length > 0) {
      return words.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
  }

  return 'Autre Proche';
}

/**
 * Détecte si une transaction correspond à un échange entre proches / famille
 */
export function isPeerTransferTransaction(tx: any): boolean {
  if (tx.isFamilyTransfer) return true;
  const cat = (tx.category || '').toLowerCase();
  if (
    cat === 'virements famille & proches' ||
    cat === 'virement reçu (proches)' ||
    cat === 'solidarité' ||
    cat === 'remboursements' ||
    cat === 'virement proches' ||
    cat === 'remboursement proches'
  ) return true;

  const text = `${tx.rawLabel || ''} ${tx.cleanLabel || ''} ${tx.description || ''}`.toLowerCase();
  if (
    text.includes('wero') ||
    text.includes('paylib') ||
    text.includes('lydia') ||
    text.includes('lyf') ||
    text.includes('nayssa') ||
    text.includes('naustaba') ||
    text.includes('naistaba') ||
    text.includes('malaguti') ||
    text.includes('el hani') ||
    text.includes('vir inst') ||
    ((text.includes('drame') || text.includes('dramé')) && !text.includes('kouroufia'))
  ) {
    return true;
  }
  return false;
}

/**
 * Calcul et isolation du module « Échanges Famille & Amis »
 */
export interface PeerTransfersSummary {
  received: number;
  sent: number;
  net: number;
  txCount: number;
  transactions: any[];
  peopleBalances: PersonPeerBalance[];
}

export function calculatePeerTransfers(transactions: any[]): PeerTransfersSummary {
  let received = 0;
  let sent = 0;
  const filteredTxs: any[] = [];
  const personMap = new Map<string, { sent: number; received: number; txs: any[] }>();

  transactions.forEach(tx => {
    const isPeer = isPeerTransferTransaction(tx);

    if (isPeer) {
      const rawAmt = Number(tx.rawAmount !== undefined ? tx.rawAmount : tx.amount) || 0;
      const isCredit = tx.type === 'credit' || tx.direction === 'credit' || rawAmt > 0;
      const absAmt = Math.abs(rawAmt || Number(tx.amount) || 0);

      if (isCredit) {
        received += absAmt;
      } else {
        sent += absAmt;
      }
      filteredTxs.push(tx);

      // Aggrégation par personne
      const personName = extractPersonName(tx);
      if (!personMap.has(personName)) {
        personMap.set(personName, { sent: 0, received: 0, txs: [] });
      }
      const pData = personMap.get(personName)!;
      if (isCredit) {
        pData.received += absAmt;
      } else {
        pData.sent += absAmt;
      }
      pData.txs.push(tx);
    }
  });

  const peopleBalances: PersonPeerBalance[] = Array.from(personMap.entries()).map(([personName, data]) => {
    const sentRound = Math.round(data.sent * 100) / 100;
    const receivedRound = Math.round(data.received * 100) / 100;
    const netRound = Math.round((receivedRound - sentRound) * 100) / 100;
    const words = personName.split(' ');
    const avatarLetter = words.length >= 2 
      ? (words[0][0] + words[1][0]).toUpperCase()
      : personName.substring(0, 2).toUpperCase();

    return {
      personName,
      avatarLetter,
      sent: sentRound,
      received: receivedRound,
      net: netRound,
      txCount: data.txs.length,
      transactions: [...data.txs].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    };
  }).sort((a, b) => (b.sent + b.received) - (a.sent + a.received));

  return {
    received: Math.round(received * 100) / 100,
    sent: Math.round(sent * 100) / 100,
    net: Math.round((received - sent) * 100) / 100,
    txCount: filteredTxs.length,
    transactions: filteredTxs.sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    peopleBalances
  };
}
