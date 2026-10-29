import Papa from 'papaparse';
import { detectStatementCurrency } from './kpiUtils.ts';

export type FlowType = 'INCOME' | 'FIXED_EXPENSE' | 'VARIABLE_EXPENSE' | 'SAVINGS_TRANSFER';

export interface BankTransaction {
  id: string;
  date: string; // YYYY-MM-DD
  /**
   * Libellé propre et standardisé du commerçant / tiers (ex: "Intermarché", "Orange Fibre", "France Travail").
   * Dérivé exclusivement depuis le libellé complet brut (colonne F).
   */
  description: string;
  amount: number;
  currency?: 'EUR' | 'CHF';
  flowType: FlowType;
  category: string;
  account: string;
  bankName?: string;
  isSubscription?: boolean;
  subscriptionDay?: number;
  confidence?: 'high' | 'medium' | 'low';
  status?: 'Reconciled' | 'Pending' | 'Internal Transfer';
  monthKey?: string;
  /**
   * Libellé complet brut d'origine issu directement et exclusivement de la colonne F (« Libellé complet » pour SG).
   * Contient l'intégralité des mentions SEPA/CB/VIR, identifiants émetteurs et références,
   * sans aucune pollution par les colonnes G (« Catégorie ») ou H (« Sous-Catégorie »).
   */
  rawLabel?: string;
  /**
   * Nom commercial nettoyé équivalent à description.
   */
  cleanLabel?: string;
  [key: string]: any;
}

export const CATEGORIES = [
  // --- Charges Fixes (Incompressibles / Récurrentes) ---
  'Logement & Énergie',
  'Abonnements & Télécom',
  'Assurances',
  'Paiement fractionné',
  'Frais bancaires',
  'Impôts & Amendes',

  // --- Dépenses Variables (Vie quotidienne & Loisirs) ---
  'Alimentation & Courses',
  'Transports & Carburant',
  'Restaurants & Sorties',
  'Shopping & Maison',
  'Loisirs & Activités',
  'Santé',
  'Retrait Espèces',
  'Virements Famille & Proches',

  // --- Revenus & Rentrées ---
  'Salaire & Revenus',
  'Aides & Allocations',

  // --- Épargne & Trésorerie Inter-Comptes ---
  'Épargne & Investissement',
  'Virements Internes',

  // --- Autre ---
  'Autre'
];

/**
 * Détection automatique du nom de la banque depuis les métadonnées, en-têtes et libellés du CSV
 * (Supporte les banques françaises, suisses et néobanques internationales)
 */
export function detectBankName(csvContent: string): string {
  const lower = (csvContent || '').toLowerCase();

  // Banques suisses helvétiques (UBS, PostFinance, Raiffeisen, BCV, Yuh, Neon, ZKB...)
  if (lower.includes('postfinance')) return 'PostFinance';
  if (/\bubs\b|ubs switzerland|ubs ag/i.test(lower)) return 'UBS';
  if (/\bcredit suisse\b/i.test(lower)) return 'Crédit Suisse';
  if (/\bbcv\b|banque cantonale vaudoise/i.test(lower)) return 'BCV';
  if (/\braiffeisen\b/i.test(lower)) return 'Raiffeisen';
  if (/\byuh\b/i.test(lower)) return 'Yuh';
  if (/\bneon\b|neon bank/i.test(lower)) return 'Neon';
  if (/\bbcge\b|banque cantonale de geneve|banque cantonale de genève/i.test(lower)) return 'BCGE';
  if (/\bzkb\b|zürcher kantonalbank|zurcher kantonalbank/i.test(lower)) return 'Zürcher Kantonalbank';
  if (lower.includes('migros bank') || lower.includes('banque migros')) return 'Banque Migros';
  if (lower.includes('banque cantonale') || lower.includes('kantonalbank')) return 'Banque Cantonale';
  if (lower.includes('swissquote')) return 'Swissquote';
  if (lower.includes('valiant')) return 'Valiant';

  // Banques françaises
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
  if (lower.includes('lcl')) return 'LCL';
  if (lower.includes('cic')) return 'CIC';
  if (lower.includes('credit mutuel') || lower.includes('crédit mutuel')) return 'Crédit Mutuel';
  if (lower.includes('la banque postale')) return 'La Banque Postale';
  if (lower.includes('caisse d\'epargne') || lower.includes('caisse d\'épargne')) return 'Caisse d\'Épargne';

  return 'Compte Courant';
}

/**
 * Normalisation robuste d'une date de relevé bancaire (formats français, suisses et ISO) :
 * Gère JJ.MM.AAAA (DD.MM.YYYY), AAAA.MM.JJ (YYYY.MM.DD), JJ.MM.AA (DD.MM.YY),
 * JJ/MM/AAAA (DD/MM/YYYY), AAAA-MM-JJ (YYYY-MM-DD).
 * Retourne la date au format ISO YYYY-MM-DD standardisé.
 */
export function parseBankDate(rawDate?: string | null): string {
  if (!rawDate) return '';
  const trimmed = String(rawDate).trim();

  // 1. Format ISO : YYYY-MM-DD ou YYYY.MM.DD ou YYYY/MM/DD
  const isoMatch = trimmed.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 2. Format standard européen : DD.MM.YYYY ou DD/MM/YYYY ou DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // 3. Format court suisse/allemand : DD.MM.YY ou DD/MM/YY ou DD-MM-YY
  const shortMatch = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2})$/);
  if (shortMatch) {
    const d = shortMatch[1].padStart(2, '0');
    const m = shortMatch[2].padStart(2, '0');
    const yy = parseInt(shortMatch[3], 10);
    const y = yy >= 70 ? `19${yy}` : `20${String(yy).padStart(2, '0')}`;
    return `${y}-${m}-${d}`;
  }

  return '';
}

/**
 * Normalisation universelle d'un montant bancaire (français, suisse ou international) :
 * Gère les apostrophes de milliers suisses (1'450.50, 1’450.50), les espaces (1 450,50),
 * les signes négatifs en fin de chaîne (1'450.50-), les suffixes comptables DB/CR,
 * et les devises intégrées (CHF, EUR, €).
 */
export function parseBankAmount(rawAmount: string | number | null | undefined): number {
  if (rawAmount === null || rawAmount === undefined) return 0;
  if (typeof rawAmount === 'number') return isNaN(rawAmount) ? 0 : rawAmount;
  
  let s = String(rawAmount).trim();
  if (!s) return 0;

  // 1. Détection du signe négatif (début, fin de chaîne ou marqueur DB/DR)
  let isNegative = false;
  if (s.startsWith('-') || s.endsWith('-') || /\b(DB|DR)\b/i.test(s)) {
    isNegative = true;
  }

  // 2. Nettoyage des espaces, devises, marqueurs et apostrophes suisses
  s = s.replace(/[\s\u00A0\u202F\u2007]+/g, '');
  s = s.replace(/['’ʻʼ]/g, '');
  s = s.replace(/(?:CHF|EUR|€|USD|\$|DB|DR|CR|\+|\-)/gi, '');

  // 3. Gestion de la virgule et du point décimal
  if (s.includes('.') && s.includes(',')) {
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    if (lastComma > lastDot) {
      // Format 1.450,50 -> virgule décimale
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // Format 1,450.50 -> point décimal
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }

  // Nettoyage strict
  s = s.replace(/[^\d.]/g, '');
  if (!s) return 0;

  const parsed = parseFloat(s);
  if (isNaN(parsed)) return 0;

  return isNegative ? -Math.abs(parsed) : Math.abs(parsed);
}

/**
 * Nettoie et assainit le libellé brut d'une ligne de relevé bancaire.
 * Normalise les espaces insécables et ponctuations parasites sans JAMAIS tronquer
 * les mentions critiques de la colonne F (SEPA, CB, VIR, mandat, contrat, identifiant émetteur).
 */
export function sanitizeRawBankLabel(raw: string): string {
  if (!raw) return '';
  let s = String(raw).trim();
  // Normalisation des espaces insécables et caractères d'espacement bizarres
  s = s.replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ');
  // Supprime les guillemets d'encadrement CSV éventuels
  s = s.replace(/^["']+|["']+$/g, '');
  // Supprime les suites de points (ex: "...", "..", "....")
  s = s.replace(/\.{2,}/g, ' ');
  // Supprime la ponctuation traînante ou isolée en tout début/fin
  s = s.replace(/^[\s\-.,;:/]+|[\s\-.,;:/]+$/g, '');
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
  if (upper.includes('AMERICAN EXPRESS') || upper.includes('AMEX')) return 'Règlement American Express';
  if (upper.includes('FRANCE TRAVAIL') || upper.includes('POLE EMPLOI')) return 'France Travail';
  if (upper.includes('CAF LOIRE') || upper.includes('CAF DE') || upper.startsWith('CAF ')) return 'CAF Loire-Atlantique';
  if (upper.includes('SWYPE')) return 'Swype';
  if (upper.includes('TOTALENERGIES') || upper.includes('TOTAL DIRECT ENERGIE')) return 'TotalEnergies';
  if (upper.includes('ORANGE FIBRE')) return 'Orange Fibre';
  if (upper.includes('ORANGE MOBILE') || (upper.includes('ORANGE') && upper.includes('PRLV'))) return 'Orange';
  if (upper.includes('LA POSTE MOBILE')) return 'La Poste Mobile';
  if (upper.includes('SOBRIO')) return 'Cotisation Sobrio (Société Générale)';
  if (upper.includes('JAZZ')) return 'Cotisation Jazz (Société Générale)';
  if (upper.includes('ARRETE') && (upper.includes('FORFAITAIRE') || upper.includes('MINIMUM') || upper.includes('JOUR'))) return 'Frais de compte / Arrêté trimestriel';
  if (upper.includes('CRYPTO DYNAMIQUE') || upper.includes('OPTION CRYPTO')) return 'Option Crypto (Frais)';
  if (upper.includes('COMMISSION D\'INTERVENTION') || upper.includes('COMMISSION INTERVENTION')) return 'Commission d\'intervention (Frais)';
  if (upper.includes('SATD')) return 'Frais sur SATD (Impôts)';
  if (upper.includes('SOGESSUR')) return 'Sogessur (Assurance)';
  if (upper.includes('GROUPAMA') && (upper.includes('SOIN') || upper.includes('SANTE'))) return 'Groupama (Santé)';
  if (upper.includes('GROUPAMA')) return 'Groupama (Assurance)';
  if (upper.includes('SOGECAP')) return 'Sogecap (Épargne)';
  if (upper.includes('ALMA')) return 'Alma (Paiement fractionné)';
  if (upper.includes('ONEY')) return 'Oney (3x/4x)';
  if (upper.includes('KLARNA')) return 'Klarna (Paiement fractionné)';

  // Organismes, télécoms, assurances et commerçants suisses prioritaires
  if (upper.includes('SERAFE')) return 'Serafe (Redevance Radio/TV)';
  if (upper.includes('SWISSCOM')) return 'Swisscom';
  if (upper.includes('SUNRISE')) return 'Sunrise';
  if (upper.includes('SALT MOBILE') || (upper.includes('SALT') && (upper.includes('PRLV') || upper.includes('CH') || upper.includes('FACTURE')))) return 'Salt';
  if (upper.includes('WINGO')) return 'Wingo';
  if (upper.includes('YALLO')) return 'Yallo';

  // Assurances suisses (LAMal & Complémentaires)
  if (upper.includes('HELSANA')) return 'Helsana (Assurance Maladie)';
  if (upper.includes('GROUPE MUTUEL') || upper.includes('MUTUEL ASSURANCE')) return 'Groupe Mutuel (Assurance Maladie)';
  if (upper.includes('CSS') && (upper.includes('ASSURANCE') || upper.includes('KRANKEN') || upper.includes('SANTE') || upper.includes('SANTÉ') || upper.includes('PRIME'))) return 'CSS Assurance (Santé)';
  if (upper.includes('SWICA')) return 'Swica (Assurance Maladie)';
  if (upper.includes('CONCORDIA') && (upper.includes('ASSURANCE') || upper.includes('KRANKEN') || upper.includes('SANTE') || upper.includes('PRIME'))) return 'Concordia (Assurance Maladie)';
  if (upper.includes('SANITAS')) return 'Sanitas (Assurance Maladie)';
  if (upper.includes('VISANA')) return 'Visana (Assurance Maladie)';
  if (upper.includes('ASSURA')) return 'Assura (Assurance Maladie)';
  if (upper.includes('KPT ') || upper.startsWith('KPT')) return 'KPT (Assurance Maladie)';
  if (upper.includes('MOBILIERE') || upper.includes('MOBILIAR')) return 'La Mobilière (Assurance)';

  // Énergie suisse
  if (upper.includes('SIG') && (upper.includes('GENEVE') || upper.includes('GENÈVE') || upper.includes('SERVICES INDUSTRIELS'))) return 'SIG (Services Industriels de Genève)';
  if (upper.includes('ROMANDE ENERGIE') || upper.includes('ROMANDE ÉNERGIE')) return 'Romande Énergie';
  if (upper.includes('BKW') && (upper.includes('ENERGIE') || upper.includes('POWER') || upper.includes('AG'))) return 'BKW Energie';
  if (upper.includes('PRIMEO ENERGIE')) return 'Primeo Energie';

  // Transports suisses
  if (upper.includes('CFF') || upper.includes('SBB') || upper.includes('FFS')) {
    if (upper.includes('DEMI-TARIF') || upper.includes('DEMI TARIF') || upper.includes('HALBTAX')) return 'CFF Demi-Tarif';
    if (upper.includes('AG') || upper.includes('ABONNEMENT GENERAL') || upper.includes('GENERALABONNEMENT')) return 'CFF Abonnement Général';
    return 'CFF / SBB';
  }
  if (upper.includes('TPG') || upper.includes('TRANSPORTS PUBLICS GENEVOIS')) return 'TPG (Transports Publics Genevois)';
  if (upper.includes('TRANSPORTS LAUSANNOIS') || upper.includes('TL LAUSANNE')) return 'TL (Transports Lausannois)';

  // Prévoyance suisse (3e pilier 3a)
  if (upper.includes('VIAC')) return 'VIAC (Pilier 3a)';
  if (upper.includes('FINPENSION')) return 'Finpension (Pilier 3a)';
  if (upper.includes('FRANKLY')) return 'Frankly (Pilier 3a)';
  if (upper.includes('PILIER 3A') || upper.includes('SAULE 3A') || upper.includes('SÄULE 3A') || upper.includes('3EME PILIER')) return 'Prévoyance 3a (Épargne)';

  // Régies immobilières suisses (Loyer)
  if (upper.includes('WINCASA')) return 'Wincasa (Loyer)';
  if (upper.includes('LIVIT')) return 'Livit (Loyer)';
  if (upper.includes('PRIVERA')) return 'Privera (Loyer)';
  if (upper.includes('REGIE NAEF') || upper.includes('RÉGIE NAEF') || upper.includes('NAEF IMMOBILIER')) return 'Régie Naef (Loyer)';
  if (upper.includes('GEROFINANCE')) return 'Gerofinance (Loyer)';
  if (upper.includes('COMPTOIR IMMOBILIER')) return 'Comptoir Immobilier (Loyer)';

  // Grande distribution et commerces suisses
  if (upper.includes('COOP PRONTO')) return 'Coop Pronto';
  if (/\bCOOP\b/i.test(clean) && !upper.includes('COOPR') && !upper.includes('COOPRO')) return 'Coop';
  if (upper.includes('MIGROS') || upper.includes('MIGROLINO')) return 'Migros';
  if (upper.includes('DENNER')) return 'Denner';
  if (upper.includes('MANOR')) return 'Manor';
  if (upper.includes('GALAXUS') || upper.includes('DIGITEC')) return 'Galaxus / Digitec';
  if (upper.includes('BRACK.CH') || upper.includes('BRACK CH')) return 'Brack.ch';
  if (upper.includes('OTTO\'S') || upper.includes('OTTOS')) return 'Otto\'s';
  if (upper.includes('VOLG')) return 'Volg';
  if (upper.includes('LANDI')) return 'Landi';
  if (upper.includes('ALDI SUISSE')) return 'Aldi Suisse';
  if (upper.includes('LIDL SCHWEIZ') || upper.includes('LIDL SUISSE')) return 'Lidl Suisse';

  // Paiements TWINT (suisses)
  if (upper.includes('TWINT')) {
    let twintSubject = clean
      .replace(/\bTWINT\b/gi, '')
      .replace(/\bP2P\b/gi, '')
      .replace(/\bMARCHAND\b/gi, '')
      .replace(/\+?41\s?\d{2}\s?\d{3}\s?\d{2}\s?\d{2}|\b07[6-9]\d{7}\b/g, '')
      .trim();
    if (twintSubject.length >= 2) {
      const formatted = twintSubject
        .toLowerCase()
        .split(' ')
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      return `${formatted} (TWINT)`;
    }
    return 'Paiement TWINT';
  }

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

  // Supprime les préfixes techniques bancaires courants français et suisses
  clean = clean.replace(/^(?:EBILL|E-BILL|LSV\+?|QR-FACTURE|QR-RECHNUNG|BVR|SIC|SIX)\s*[:\-]?\s*/i, '');
  clean = clean.replace(/^TWINT\s+(?:P2P\s+|MARCHAND\s+)?/i, '');
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

  // 2. Virements Famille, Proches & TWINT P2P (Wero, Paylib, Lyf, Vir inst, TWINT P2P)
  const isTwintP2P = norm.includes('twint') && 
    !norm.includes('coop') && 
    !norm.includes('migros') && 
    !norm.includes('denner') && 
    !norm.includes('manor') && 
    !norm.includes('galaxus') && 
    !norm.includes('cff') && 
    !norm.includes('sbb');

  const isFamily = 
    isTwintP2P ||
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
        cleanDesc: cleanDesc || (isTwintP2P ? 'Virement Reçu (TWINT)' : 'Virement Reçu (Proches)'),
        flowType: 'INCOME',
        category: 'Virement Reçu (Proches)',
        isSubscription: false
      };
    } else {
      return {
        cleanDesc: cleanDesc || (isTwintP2P ? 'Paiement TWINT' : "Virements Famille & Proches"),
        flowType: 'VARIABLE_EXPENSE',
        category: 'Virements Famille & Proches',
        isSubscription: false
      };
    }
  }

  // 3. Mouvements internes, virements compte à compte, 3e pilier 3a & épargne (Neutralisés du reste à vivre)
  // Prévoyance suisse (3e pilier 3a : VIAC, Finpension, Frankly, Säule 3a)
  const isSwiss3a = 
    norm.includes('viac') ||
    norm.includes('finpension') ||
    norm.includes('frankly') ||
    norm.includes('pilier 3a') ||
    norm.includes('saule 3a') ||
    norm.includes('säule 3a') ||
    norm.includes('3eme pilier') ||
    norm.includes('3ème pilier') ||
    norm.includes('prevoyance 3a') ||
    norm.includes('prévoyance 3a');

  if (isSwiss3a) {
    return {
      cleanDesc: cleanDesc || 'Prévoyance 3a (Épargne)',
      flowType: 'SAVINGS_TRANSFER',
      category: 'Épargne & Investissement',
      isSubscription: false
    };
  }
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
      cleanDesc: 'Règlement American Express',
      flowType: 'FIXED_EXPENSE',
      category: 'Paiement fractionné',
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
  // Primes d'assurance maladie suisse LAMal & LCA (Helsana, Groupe Mutuel, CSS, Swica, Concordia, Sanitas, Visana, Assura)
  if (
    norm.includes('helsana') ||
    norm.includes('groupe mutuel') ||
    norm.includes('mutuel assurance') ||
    (norm.includes('css') && (norm.includes('assurance') || norm.includes('kranken') || norm.includes('sante') || norm.includes('prime'))) ||
    norm.includes('swica') ||
    (norm.includes('concordia') && (norm.includes('assurance') || norm.includes('kranken') || norm.includes('sante') || norm.includes('prime'))) ||
    norm.includes('sanitas') ||
    norm.includes('visana') ||
    norm.includes('assura') ||
    norm.includes('kpt')
  ) {
    return { cleanDesc: cleanDesc || 'Assurance Maladie (LAMal)', flowType: 'FIXED_EXPENSE', category: 'Santé', isSubscription: true };
  }

  // Redevance radio/télévision suisse Serafe
  if (norm.includes('serafe') || norm.includes('billag')) {
    return { cleanDesc: cleanDesc || 'Serafe (Redevance)', flowType: 'FIXED_EXPENSE', category: 'Abonnements & Télécom', isSubscription: true };
  }

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
    norm.includes('gaz de france') ||
    norm.includes('sig geneve') ||
    norm.includes('sig genève') ||
    norm.includes('services industriels de geneve') ||
    norm.includes('romande energie') ||
    norm.includes('romande énergie') ||
    norm.includes('bkw') ||
    norm.includes('primeo energie')
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
    norm.includes('charges copro') ||
    norm.includes('wincasa') ||
    norm.includes('livit') ||
    norm.includes('privera') ||
    norm.includes('regie naef') ||
    norm.includes('régie naef') ||
    norm.includes('naef immobilier') ||
    norm.includes('gerofinance') ||
    norm.includes('comptoir immobilier')
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
    norm.includes('prevoyance') ||
    norm.includes('mobiliere') ||
    norm.includes('mobiliar')
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
    norm.includes('swisscom') ||
    norm.includes('sunrise') ||
    norm.includes('salt mobile') ||
    (norm.includes('salt') && (norm.includes('prlv') || norm.includes('ch') || norm.includes('facture'))) ||
    norm.includes('wingo') ||
    norm.includes('yallo') ||
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

  // Abonnements et pass de transport récurrents (CFF Demi-tarif, AG SBB, Navigo, SNCF, TPG) -> Transports & Carburant
  if (
    norm.includes('cff') ||
    norm.includes('sbb') ||
    norm.includes('ffs') ||
    norm.includes('tpg') ||
    norm.includes('transports lausannois') ||
    norm.includes('navigo') ||
    norm.includes('sncf abonnement') ||
    norm.includes('demi-tarif') ||
    norm.includes('halbtax') ||
    norm.includes('abonnement general') ||
    norm.includes('generalabonnement')
  ) {
    const isSubPass = norm.includes('demi-tarif') || norm.includes('halbtax') || norm.includes('abonnement general') || norm.includes('generalabonnement') || norm.includes('navigo') || norm.includes('abonnement') || norm.includes('forfait');
    return {
      cleanDesc: cleanDesc || (isSubPass ? 'Abonnement CFF' : 'CFF / SBB'),
      flowType: isSubPass ? 'FIXED_EXPENSE' : 'VARIABLE_EXPENSE',
      category: 'Transports & Carburant',
      isSubscription: isSubPass
    };
  }

  // Prélèvements et Abonnements récurrents génériques (PRLV, PRELEVEMENT, ECHEANCE, ABONNEMENT, FORFAIT)
  if (
    amount < 0 && (
      norm.includes('prlv') ||
      norm.includes('prelevement') ||
      norm.includes('abonnement') ||
      norm.includes('forfait') ||
      norm.includes('echeance') ||
      norm.includes('cotis')
    )
  ) {
    if (!norm.includes('vir ') && !norm.includes('virement')) {
      return {
        cleanDesc: cleanDesc || 'Prélèvement Récurrent',
        flowType: 'FIXED_EXPENSE',
        category: 'Abonnements & Télécom',
        isSubscription: true
      };
    }
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
    norm.includes('denner') ||
    norm.includes('volg') ||
    norm.includes('landi') ||
    norm.includes('aldi suisse') ||
    norm.includes('lidl schweiz') ||
    norm.includes('lidl suisse') ||
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
    norm.includes('manor') ||
    norm.includes('galaxus') ||
    norm.includes('digitec') ||
    norm.includes('brack.ch') ||
    norm.includes('brack ch') ||
    norm.includes('otto\'s') ||
    norm.includes('ottos') ||
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

  // Transports, CFF / SBB & Véhicule
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
    norm.includes('cff') ||
    norm.includes('sbb') ||
    norm.includes('ffs') ||
    norm.includes('tpg') ||
    norm.includes('transports lausannois') ||
    norm.includes('demi-tarif') ||
    norm.includes('halbtax') ||
    norm.includes('abonnement general') ||
    norm.includes('generalabonnement') ||
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
    const isSubPass = norm.includes('demi-tarif') || norm.includes('halbtax') || norm.includes('abonnement general') || norm.includes('generalabonnement') || norm.includes('ag cff');
    return {
      cleanDesc: cleanDesc || (isSubPass ? 'Abonnement CFF' : 'Transport & Véhicule'),
      flowType: isSubPass ? 'FIXED_EXPENSE' : 'VARIABLE_EXPENSE',
      category: 'Transports & Carburant',
      isSubscription: isSubPass
    };
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
 * Formatage d'une date en format français complet harmonisé : '10 juillet 2026'
 */
export function formatDateFR(dateStr?: string | null): string {
  if (!dateStr) return '-';
  try {
    const trimmed = String(dateStr).trim();
    const formatFull = (d: Date) => {
      return d.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    };

    // Format YYYY-MM-DD ou YYYY/MM/DD (avec heure optionnelle)
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

    // Format DD/MM/YYYY ou DD-MM-YYYY (avec heure optionnelle)
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
  currency?: 'EUR' | 'CHF';
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
    norm.includes('classement') ||
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
    norm.includes('sous-classe') ||
    norm.includes('sous classe') ||
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
 * Recherche prioritaire et robuste de la colonne F (« Libellé complet »).
 * Pour les relevés Société Générale (SG), le CSV standard est structuré sur 8 colonnes :
 * - Col A (index 0) : Date de l'opération
 * - Col B (index 1) : Date de valeur
 * - Col C (index 2) : Montant
 * - Col D (index 3) : Devise
 * - Col E (index 4) : Libellé simplifié / court
 * - Col F (index 5) : Libellé complet (mentions complètes SEPA/CB/VIR, marchand, références)
 * - Col G (index 6) : Catégorie banque (STRICTEMENT EXCLUE)
 * - Col H (index 7) : Sous-Catégorie banque (STRICTEMENT EXCLUE)
 * 
 * Cette fonction retourne l'index de la colonne F :
 * 1) En priorité par intitulé d'en-tête explicite (« Libellé complet », « Détail », etc.)
 * 2) En cas de fichier Société Générale ou format 8 colonnes, par détection positionnelle sur la colonne F (index 5)
 */
export function findFullDescriptionColumnIndex(
  headers: string[],
  isSG: boolean = false,
  dateColIndices: Set<number> = new Set(),
  amountIndices: Set<number> = new Set()
): number {
  // 1. Détection prioritaire par en-tête explicite
  const explicitIdx = headers.findIndex((h, idx) => {
    if (dateColIndices.has(idx) || amountIndices.has(idx)) return false;
    if (isBankCategoryHeader(h)) return false;
    const norm = normalizeBankHeader(h);
    return (
      (norm.includes('libelle') && (
        norm.includes('complet') ||
        norm.includes('detail') ||
        norm.includes('complementaire') ||
        norm.includes('enrichi') ||
        norm.includes('etendu') ||
        norm.includes('long')
      )) ||
      (norm.includes('texte') && norm.includes('complet')) ||
      (norm.includes('information') && (norm.includes('complementaire') || norm.includes('detail'))) ||
      (norm.includes('detail') && (norm.includes('operation') || norm.includes('ecriture'))) ||
      norm === 'libelle complet' ||
      norm === 'libelle detaille'
    );
  });
  if (explicitIdx >= 0) return explicitIdx;

  // 2. Détection positionnelle sur les fichiers Société Générale (SG) ou 8 colonnes
  if (isSG || headers.length >= 8) {
    if (
      headers.length > 5 &&
      !dateColIndices.has(5) &&
      !amountIndices.has(5) &&
      !isBankCategoryHeader(headers[5])
    ) {
      return 5;
    }
  }

  return -1;
}

/**
 * Filtre et supprime TOUTES les colonnes inutiles ou trompeuses de la banque (y compris les catégories bancaires fausses G et H).
 * Isole directement et exclusivement la colonne F (« Libellé complet ») pour Société Générale.
 * Ne conserve strictement que 3 informations fiables : Date, Libellé de compte brut (Colonne F), et Montant.
 */
export function extractCleanBankStatementRows(csvContent: string): CleanBankStatementRow[] {
  const parsed = Papa.parse(csvContent.trim(), {
    skipEmptyLines: true
  });

  const rows = (parsed.data as string[][]) || [];
  if (rows.length < 2) return [];

  // Détection de la banque et de la devise
  const detectedBank = detectBankName(csvContent);
  const detectedCurrency = detectStatementCurrency(csvContent);
  const isSG = detectedBank === 'Société Générale' ||
    /societe generale|société générale|logitel|gdb_|sogessur|\bsg\b/i.test(csvContent);

  // Détection de la ligne d'en-tête
  let headerLineIndex = 0;
  let maxScore = -1;
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const rowJoined = rows[i].map(sanitizeHeader).join(' ');
    let score = 0;
    if (rowJoined.includes('date')) score += 3;
    if (rowJoined.includes('libelle') || rowJoined.includes('desc') || rowJoined.includes('operation')) score += 3;
    if (rowJoined.includes('montant') || rowJoined.includes('amount') || rowJoined.includes('debit') || rowJoined.includes('credit')) score += 3;
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

  const amountIdx = headers.findIndex(h => h.includes('montant') || h.includes('amount') || (h.includes('valeur') && !h.includes('date')));
  const debitIdx = headers.findIndex(h => h.includes('debit'));
  const creditIdx = headers.findIndex(h => h.includes('credit'));
  const amountColIndices = new Set<number>();
  if (amountIdx >= 0) amountColIndices.add(amountIdx);
  if (debitIdx >= 0) amountColIndices.add(debitIdx);
  if (creditIdx >= 0) amountColIndices.add(creditIdx);

  // Recherche prioritaire de la colonne F (« Libellé complet »)
  const fullDescColIdx = findFullDescriptionColumnIndex(headers, isSG, dateColIndices, amountColIndices);

  // Détection des autres colonnes de libellés / descriptions pour rétrocompatibilité
  const descColIndices: number[] = [];
  headers.forEach((h, idx) => {
    if (dateColIndices.has(idx)) return;
    if (amountColIndices.has(idx)) return;
    if (isBankCategoryHeader(h)) return; // EXCLUSION STRICTE DES CATÉGORIES BANCAIRES
    if (isSG && (idx === 6 || idx === 7)) return; // Colonnes G et H SG STRICTEMENT IGNORÉES
    if (isBankDescriptionHeader(h)) {
      descColIndices.push(idx);
    }
  });

  if (fullDescColIdx >= 0) {
    const others = descColIndices.filter(idx => idx !== fullDescColIdx);
    descColIndices.length = 0;
    descColIndices.push(fullDescColIdx, ...others);
  } else {
    descColIndices.sort((a, b) => {
      const ha = headers[a];
      const hb = headers[b];
      const scoreA = (ha.includes('detail') || ha.includes('complet') || ha.includes('complementaire') || ha.includes('enrichi')) ? 2 : 1;
      const scoreB = (hb.includes('detail') || hb.includes('complet') || hb.includes('complementaire') || hb.includes('enrichi')) ? 2 : 1;
      return scoreB - scoreA;
    });
  }

  const cleanRows: CleanBankStatementRow[] = [];
  const seenRowKeys = new Set<string>();
  let itemIndex = 0;

  for (let i = headerLineIndex + 1; i < rows.length; i++) {
    const cols = rows[i];
    if (!cols || cols.length < 2) continue;

    // 1. Date (YYYY-MM-DD normalisée via parseBankDate)
    let rawDate = dateIdx >= 0 && cols[dateIdx] ? cols[dateIdx] : cols[0];
    const formattedDate = parseBankDate(rawDate);
    if (!formattedDate) continue;

    // 2. Libellé brut d'origine :
    // RÈGLE ABSOLUE D'AUDIT FINANCIER :
    // Si la colonne F (« Libellé complet ») est présente (ou fichier SG), mapper directement et exclusivement sur la colonne F !
    // Aucune concaténation avec les colonnes courtes (colonne E) et exclusion totale des colonnes G et H.
    let rawLabel = '';
    if (fullDescColIdx >= 0 && cols[fullDescColIdx] && String(cols[fullDescColIdx]).trim()) {
      rawLabel = String(cols[fullDescColIdx]).trim();
    } else if (descColIndices.length > 0) {
      rawLabel = String(cols[descColIndices[0]] || '').trim();
    }

    // Fallback de sécurité : chercher une cellule textuelle en ignorant STRICTEMENT toute colonne catégorie
    if (!rawLabel) {
      for (let c = 0; c < cols.length; c++) {
        if (dateColIndices.has(c)) continue;
        if (amountColIndices.has(c)) continue;
        if (isBankCategoryHeader(headers[c])) continue; // NE JAMAIS PRENDRE UNE COLONNE CATÉGORIE
        if (isSG && (c === 6 || c === 7)) continue; // Colonnes G et H SG STRICTEMENT IGNORÉES
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

    // 3. Montant (Normalisation via parseBankAmount, gérant apostrophes suisses, trailing minus et espaces)
    let amount = 0;
    if (debitIdx >= 0 || creditIdx >= 0) {
      const debitRaw = debitIdx >= 0 ? String(cols[debitIdx] || '') : '';
      const creditRaw = creditIdx >= 0 ? String(cols[creditIdx] || '') : '';
      const debit = parseBankAmount(debitRaw);
      const credit = parseBankAmount(creditRaw);
      amount = credit !== 0 ? Math.abs(credit) : -Math.abs(debit);
    } else if (amountIdx >= 0 && cols[amountIdx]) {
      amount = parseBankAmount(cols[amountIdx]);
    }

    if (isNaN(amount) || amount === 0) continue;

    // Suppression stricte des doublons au sein du fichier CSV (même date, montant identique et même libellé normalisé)
    const rowKey = `${formattedDate}_${amount.toFixed(2)}_${sanitizedLabel.toLowerCase()}`;
    if (seenRowKeys.has(rowKey)) {
      continue;
    }
    seenRowKeys.add(rowKey);

    // Conserve UNIQUEMENT Date, Libellé brut assaini (Colonne F), Montant, Devise
    cleanRows.push({
      index: itemIndex++,
      date: formattedDate,
      rawLabel: sanitizedLabel,
      amount,
      currency: detectedCurrency
    });
  }

  return cleanRows;
}

/**
 * Parseur universel de relevés bancaires multi-formats CSV (Société Générale, Fortuneo, Revolut, banques suisses UBS, PostFinance, BCV, etc.)
 */
export function parseCSVBankStatement(csvContent: string): { bankName: string; currency?: 'EUR' | 'CHF'; transactions: BankTransaction[] } {
  const bankName = detectBankName(csvContent);
  const detectedCurrency = detectStatementCurrency(csvContent);
  
  // 1. Parsing robuste avec PapaParse (gestion des délimiteurs ;, virgules, tabulations, guillemets et sauts de ligne)
  const parsed = Papa.parse(csvContent.trim(), {
    skipEmptyLines: true
  });

  const rows = (parsed.data as string[][]) || [];
  if (rows.length < 2) return { bankName, currency: detectedCurrency, transactions: [] };

  // 2. Détection intelligente de la ligne d'en-tête
  let headerLineIndex = 0;
  let maxScore = -1;
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const rowJoined = rows[i].map(sanitizeHeader).join(' ');
    let score = 0;
    if (rowJoined.includes('date')) score += 3;
    if (rowJoined.includes('libelle') || rowJoined.includes('desc') || rowJoined.includes('operation')) score += 3;
    if (rowJoined.includes('montant') || rowJoined.includes('amount') || rowJoined.includes('debit') || rowJoined.includes('credit')) score += 3;
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
  
  // 3. RÈGLE CRITIQUE UTILISATEUR (SOCIÉTÉ GÉNÉRALE & AUDIT STRICT) :
  // Priorité absolue au « Libellé complet » (colonne F / index 5) pour capturer le vrai marchand et les mentions SEPA/CB/VIR
  // Et IGNORER TOTALEMENT les colonnes G (« Catégorie ») et H (« Sous-Catégorie »)
  const isSG = bankName === 'Société Générale' ||
    /societe generale|société générale|logitel|gdb_|sogessur|\bsg\b/i.test(csvContent);

  // Montant : EXCLURE STRICTEMENT 'date valeur' (qui contient 'valeur' mais est une date !)
  const amountIdx = headers.findIndex(h => 
    h.includes('montant') || 
    h.includes('amount') || 
    (h.includes('valeur') && !h.includes('date'))
  );
  const debitIdx = headers.findIndex(h => h.includes('debit'));
  const creditIdx = headers.findIndex(h => h.includes('credit'));
  const amountColIndices = new Set<number>();
  if (amountIdx >= 0) amountColIndices.add(amountIdx);
  if (debitIdx >= 0) amountColIndices.add(debitIdx);
  if (creditIdx >= 0) amountColIndices.add(creditIdx);

  const fullDescIdx = findFullDescriptionColumnIndex(headers, isSG, dateColIndices, amountColIndices);

  // Fallback description index - en excluant rigoureusement toute colonne Date ou Catégorie / Sous-Catégorie
  let fallbackDescIdx = -1;
  if (fullDescIdx === -1) {
    fallbackDescIdx = headers.findIndex((h, idx) => {
      if (dateColIndices.has(idx)) return false;
      if (amountColIndices.has(idx)) return false;
      if (isBankCategoryHeader(h)) return false;
      if (isSG && (idx === 6 || idx === 7)) return false; // Colonnes G et H SG formellement exclues
      return isBankDescriptionHeader(h);
    });
  }

  const results: BankTransaction[] = [];

  for (let i = headerLineIndex + 1; i < rows.length; i++) {
    const cols = rows[i];
    if (!cols || cols.length < 2) continue;

    // 1. Parsing de la date (normalisée via parseBankDate)
    let rawDate = dateIdx >= 0 && cols[dateIdx] ? cols[dateIdx] : cols[0];
    const formattedDate = parseBankDate(rawDate) || new Date().toISOString().split('T')[0];

    // 2. Sélection directe et exclusive du libellé complet (Colonne F pour SG, sans aucune pollution par les colonnes G et H)
    let rawDescription = '';
    if (fullDescIdx >= 0 && cols[fullDescIdx] && String(cols[fullDescIdx]).trim()) {
      rawDescription = String(cols[fullDescIdx]).trim();
    } else if (fallbackDescIdx >= 0 && cols[fallbackDescIdx] && String(cols[fallbackDescIdx]).trim()) {
      rawDescription = String(cols[fallbackDescIdx]).trim();
    } else {
      for (let c = 0; c < cols.length; c++) {
        if (dateColIndices.has(c)) continue; // STRICTEMENT IGNORER LES DATES
        if (amountColIndices.has(c)) continue;
        if (isSG && (c === 6 || c === 7)) continue; // STRICTEMENT IGNORER LES COLONNES G ET H SG
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

    // 3. Parsing du montant (normalisé via parseBankAmount, supportant apostrophes suisses, trailing minus et espaces)
    let amount = 0;
    if (debitIdx >= 0 || creditIdx >= 0) {
      const debitRaw = debitIdx >= 0 ? String(cols[debitIdx] || '') : '';
      const creditRaw = creditIdx >= 0 ? String(cols[creditIdx] || '') : '';
      const debit = parseBankAmount(debitRaw);
      const credit = parseBankAmount(creditRaw);
      amount = credit !== 0 ? Math.abs(credit) : -Math.abs(debit);
    } else if (amountIdx >= 0 && cols[amountIdx]) {
      amount = parseBankAmount(cols[amountIdx]);
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
      currency: detectedCurrency,
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

  return { bankName, currency: detectedCurrency, transactions: results };
}
