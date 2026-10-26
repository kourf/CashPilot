/**
 * Module de validation rigoureuse des relevés bancaires (RB) pour CashPilot
 * Empêche l'import de fichiers non-RB et fournit des messages d'erreur simples et explicites.
 */

export interface BankFileValidationResult {
  isValid: boolean;
  errorMessage?: string;
  fileType?: 'csv' | 'pdf';
}

/**
 * Valide le format, l'extension et la taille d'un fichier avant tout traitement.
 */
export function validateBankStatementFile(file: { name: string; size: number }): BankFileValidationResult {
  if (!file) {
    return {
      isValid: false,
      errorMessage: "Aucun fichier n'a été fourni."
    };
  }

  if (file.size === 0) {
    return {
      isValid: false,
      errorMessage: `Le fichier « ${file.name} » est vide (0 octet). Veuillez sélectionner un fichier valide.`
    };
  }

  const parts = file.name.split('.');
  const ext = (parts.length > 1 ? parts.pop() : '')?.toLowerCase() || '';
  const allowedExtensions = ['csv', 'tsv', 'txt', 'pdf'];

  if (!allowedExtensions.includes(ext)) {
    const extDisplay = ext ? ext.toUpperCase() : 'inconnu';
    return {
      isValid: false,
      errorMessage: `Le document « ${file.name} » (${extDisplay}) n'est pas un relevé bancaire supporté. Veuillez déposer un fichier au format CSV ou PDF.`
    };
  }

  return {
    isValid: true,
    fileType: ext === 'pdf' ? 'pdf' : 'csv'
  };
}

/**
 * Valide le contenu textuel d'un CSV/TSV/TXT pour s'assurer qu'il s'agit bien d'un relevé de compte bancaire.
 */
export function validateBankStatementCSVContent(content: string, filename: string = 'releve.csv'): BankFileValidationResult {
  if (!content || !content.trim()) {
    return {
      isValid: false,
      errorMessage: `Le fichier « ${filename} » ne contient aucune donnée textuelle exploitable.`
    };
  }

  // Vérifie la présence minimale de colonnes bancaires fondamentales
  const lower = content.toLowerCase();
  const hasDate = lower.includes('date');
  const hasAmountOrDebitCredit = lower.includes('montant') || lower.includes('debit') || lower.includes('credit') || lower.includes('solde') || lower.includes('valeur');
  const hasLabel = lower.includes('libelle') || lower.includes('opération') || lower.includes('operation') || lower.includes('description') || lower.includes('motif');

  if (!hasDate || (!hasAmountOrDebitCredit && !hasLabel)) {
    return {
      isValid: false,
      errorMessage: `Ce fichier (« ${filename} ») ne semble pas être un relevé de compte bancaire valide (colonnes Date, Libellé et Montant introuvables). Veuillez vérifier votre fichier.`
    };
  }

  return {
    isValid: true,
    fileType: 'csv'
  };
}

/**
 * Assainit les messages d'erreur techniques pour l'utilisateur final en français clair et rassurant.
 */
export function sanitizeImportErrorMessage(err: unknown, filename?: string): string {
  const filePrefix = filename ? ` pour « ${filename} »` : '';
  const message = err instanceof Error ? err.message : String(err || '');

  if (message.includes('detectBankName is not defined') || message.includes('detectBankName')) {
    return `Erreur technique lors de la détection de la banque${filePrefix}. Le composant a été mis à jour, veuillez réimporter votre relevé.`;
  }
  if (message.includes('Clé API Google Gemini introuvable')) {
    return 'Clé API Google Gemini manquante. Veuillez renseigner votre clé API dans les Paramètres pour analyser les relevés PDF.';
  }
  if (message.includes('Failed to fetch') || message.includes('network') || message.includes('réseau') || message.includes('timeout')) {
    return `Erreur de connexion réseau${filePrefix}. Veuillez vérifier votre connexion internet et réessayer.`;
  }
  if (message.includes('quota') || message.includes('ResourceExhausted') || message.includes('429')) {
    return "Le service d'analyse IA est momentanément surchargé. Veuillez patienter un instant ou réessayer.";
  }
  if (message) {
    return `Erreur lors de l'analyse du relevé${filePrefix} : ${message}`;
  }
  return `Impossible d'analyser le document${filePrefix}. Assurez-vous d'importer un relevé de compte bancaire valide (PDF ou CSV).`;
}

export interface StatementDisplayStatus {
  isCsv: boolean;
  hasVerifiedBalance: boolean;
  kpiTitle: string; // 'Solde Vérifié' ou 'Flux Net'
  kpiSubtitle: string; // 'Certifié relevé PDF' ou 'Total mouvements (CSV)'
  kpiBadge: string | null; // null ou 'Solde non dispo'
  displayAmount: number | null;
  formattedAmount: string;
  isPositive: boolean;
  isNegative: boolean;
  explanation: string;
}

function formatCurrencyAmount(amount: number, currency: 'EUR' | 'CHF' = 'EUR', showSign = false): string {
  const isPos = amount > 0;
  const isNeg = amount < 0;
  const abs = Math.abs(amount);
  const fixed = abs.toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const sign = showSign ? (isPos ? '+' : isNeg ? '-' : '') : (isNeg ? '-' : '');
  const currSym = currency === 'CHF' ? 'CHF' : '€';
  return `${sign}${intFormatted},${decPart} ${currSym}`;
}

/**
 * RÈGLE FONDAMENTALE COMPTABLE :
 * Un relevé CSV ne contenant ni solde initial ni solde final officiel certifié par la banque,
 * il ne doit JAMAIS afficher de montant dans le Flux Net ni afficher de Solde/Dispo.
 * L'interface doit refléter fidèlement la réalité bancaire :
 * - CSV sans ancre certifiée : n'affiche AUCUN montant dans le Flux Net ('—') et indique « Solde non dispo ».
 * - PDF avec ancre vérifiée : affiche le « Solde Vérifié » officiel.
 */
export function getStatementDisplayStatus(
  transactions: { source_type?: string; sourceType?: string; importFormat?: string }[],
  netCashFlow: number,
  verifiedPdfBalance: number | null | undefined,
  currency: 'EUR' | 'CHF' = 'EUR'
): StatementDisplayStatus {
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
      formattedAmount: formatCurrencyAmount(balance, currency, false),
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
    displayAmount: null,
    formattedAmount: '—',
    isPositive: false,
    isNegative: false,
    explanation: "Relevé CSV : seules les opérations sont répertoriées. Aucun solde certifié n'y figurant, aucun montant n'est affiché dans le flux net."
  };
}
