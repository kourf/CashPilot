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
