import test from 'node:test';
import assert from 'node:assert/strict';

// Import direct avec extension .ts pour le test runner Node.js ESM
import { detectBankName } from '../src/lib/bankParser.ts';
import { 
  validateBankStatementFile, 
  validateBankStatementCSVContent, 
  sanitizeImportErrorMessage,
  getStatementDisplayStatus
} from '../src/lib/bankValidation.ts';

test('1. DÉTECTION DU NOM DE BANQUE (detectBankName)', () => {
  assert.equal(
    detectBankName("Relevé de compte\nDate;Libellé;Montant\n01/02/2026;Logitel Net;10.00"),
    'Société Générale',
    'Doit détecter Société Générale via Logitel'
  );

  assert.equal(
    detectBankName("Extrait Société Générale\n01/02/2026;CARTE X7791;-50.00"),
    'Société Générale',
    'Doit détecter Société Générale via le nom explicite'
  );

  assert.equal(
    detectBankName("BoursoBank - Relevé mensuel\n01/02/2026;Paiement CB;-20.00"),
    'BoursoBank',
    'Doit détecter BoursoBank'
  );

  assert.equal(
    detectBankName("Export Boursorama Banque\n01/02/2026;Paiement CB;-20.00"),
    'BoursoBank',
    'Doit détecter BoursoBank via Boursorama'
  );

  assert.equal(
    detectBankName("Fortuneo Banque - Compte Courant\n01/02/2026;Virement;-100.00"),
    'Fortuneo',
    'Doit détecter Fortuneo'
  );

  assert.equal(
    detectBankName("Revolut Bank UAB\n01/02/2026;Top-up;50.00"),
    'Revolut',
    'Doit détecter Revolut'
  );

  assert.equal(
    detectBankName("Banque Inconnue\n01/02/2026;Operation;-10.00"),
    'Compte Courant',
    'Doit retourner Compte Courant par défaut sans crash'
  );
});

test('2. VALIDATION EXTENSION ET FICHIER (validateBankStatementFile)', () => {
  // Rejet des fichiers hors relevés bancaires (images, bureautique, audio/vidéo)
  const imageJpg = validateBankStatementFile({ name: 'photo_vacances.jpg', size: 102400 });
  assert.equal(imageJpg.isValid, false);
  assert.match(imageJpg.errorMessage!, /n'est pas un relevé bancaire supporté/);

  const imagePng = validateBankStatementFile({ name: 'capture_ecran.png', size: 204800 });
  assert.equal(imagePng.isValid, false);

  const excelXlsx = validateBankStatementFile({ name: 'inventaire.xlsx', size: 50000 });
  assert.equal(excelXlsx.isValid, false);

  const wordDocx = validateBankStatementFile({ name: 'contrat.docx', size: 30000 });
  assert.equal(wordDocx.isValid, false);

  // Rejet des fichiers vides
  const emptyFile = validateBankStatementFile({ name: 'releve.csv', size: 0 });
  assert.equal(emptyFile.isValid, false);
  assert.match(emptyFile.errorMessage!, /vide \(0 octet\)/);

  // Acceptation des formats autorisés (CSV, TSV, TXT, PDF)
  const validCsv = validateBankStatementFile({ name: 'releve_sg_fevrier.csv', size: 4096 });
  assert.equal(validCsv.isValid, true);
  assert.equal(validCsv.fileType, 'csv');

  const validPdf = validateBankStatementFile({ name: 'releve_bourso_2026.pdf', size: 150000 });
  assert.equal(validPdf.isValid, true);
  assert.equal(validPdf.fileType, 'pdf');

  const validTxt = validateBankStatementFile({ name: 'export_banque.txt', size: 2048 });
  assert.equal(validTxt.isValid, true);
  assert.equal(validTxt.fileType, 'csv');
});

test('3. VALIDATION DU CONTENU CSV (validateBankStatementCSVContent)', () => {
  // CSV bancaire valide avec colonnes attendues
  const bankCsv = `Date;Libellé;Montant;Solde
01/02/2026;Prélèvement EDF;-65.40;1250.00
02/02/2026;Virement Salaire;2500.00;3750.00`;
  const validResult = validateBankStatementCSVContent(bankCsv, 'releve.csv');
  assert.equal(validResult.isValid, true);

  // CSV non bancaire (ex: liste de contacts ou clients)
  const contactsCsv = `Nom;Prenom;Email;Telephone
Dupont;Jean;jean.dupont@email.com;0601020304
Martin;Sophie;sophie.martin@email.com;0611223344`;
  const invalidResult = validateBankStatementCSVContent(contactsCsv, 'contacts.csv');
  assert.equal(invalidResult.isValid, false);
  assert.match(invalidResult.errorMessage!, /ne semble pas être un relevé de compte bancaire valide/);

  // Fichier vide ou sans texte
  const emptyCsv = validateBankStatementCSVContent('', 'vide.csv');
  assert.equal(emptyCsv.isValid, false);
});

test('4. ASSAINISSEMENT DES MESSAGES D\'ERREUR (sanitizeImportErrorMessage)', () => {
  // Gestion de l'erreur historique detectBankName is not defined
  const technicalErr = new ReferenceError("detectBankName is not defined");
  const msg1 = sanitizeImportErrorMessage(technicalErr, 'releve.csv');
  assert.match(msg1, /Erreur technique lors de la détection de la banque/);
  assert.doesNotMatch(msg1, /ReferenceError/);

  // Erreur clé API
  const apiErr = new Error("Clé API Google Gemini introuvable. Veuillez renseigner votre clé API");
  const msg2 = sanitizeImportErrorMessage(apiErr);
  assert.match(msg2, /Clé API Google Gemini manquante/);

  // Erreur réseau
  const networkErr = new TypeError("Failed to fetch");
  const msg3 = sanitizeImportErrorMessage(networkErr, 'releve.pdf');
  assert.match(msg3, /Erreur de connexion réseau/);
});

test('5. CONFORMITÉ AU FORMAT RB : RÈGLE STRICTE CSV SANS SOLDE NI DISPO (FIDÉLITÉ À LA RÉALITÉ)', () => {
  // Cas 1 : Relevé CSV pur (opérations bancaires sans solde certifié)
  const csvTransactions = [
    { source_type: 'CSV', libelle: 'Salaire', montant: 3000 },
    { source_type: 'CSV', libelle: 'Loyer', montant: -1200 },
    { source_type: 'CSV', libelle: 'Courses', montant: -450 }
  ];
  const netFlow = 3000 - 1200 - 450; // +1350 €

  const csvStatus = getStatementDisplayStatus(csvTransactions, netFlow, null, 'EUR');

  // Doit être formellement identifié comme CSV
  assert.equal(csvStatus.isCsv, true, 'Doit être identifié comme relevé CSV');
  assert.equal(csvStatus.hasVerifiedBalance, false, 'Un CSV ne doit JAMAIS produire de solde vérifié');
  
  // RÈGLE MÉTIER : NE JAMAIS afficher "Solde" ou "Dispo" pour un CSV !
  assert.notEqual(csvStatus.kpiTitle.toLowerCase(), 'dispo', 'Le titre ne doit JAMAIS être Dispo');
  assert.notEqual(csvStatus.kpiTitle.toLowerCase(), 'solde', 'Le titre ne doit JAMAIS être Solde');
  assert.equal(csvStatus.kpiTitle, 'Flux Net', 'Le KPI doit fidèlement afficher Flux Net');
  
  // Affiche le total signé des mouvements
  assert.equal(csvStatus.kpiSubtitle, 'Total mouvements (CSV)');
  assert.equal(csvStatus.kpiBadge, 'Solde non dispo');
  assert.match(csvStatus.formattedAmount, /\+1 350,00 €/);
  assert.equal(csvStatus.isPositive, true);
  assert.match(csvStatus.explanation, /Relevé CSV/);

  // Cas 2 : Relevé CSV avec flux négatif
  const negativeNetFlow = -650.40;
  const csvNegativeStatus = getStatementDisplayStatus(csvTransactions, negativeNetFlow, null, 'EUR');
  assert.equal(csvNegativeStatus.isNegative, true);
  assert.match(csvNegativeStatus.formattedAmount, /-650,40 €/);
  assert.equal(csvNegativeStatus.kpiTitle, 'Flux Net');

  // Cas 3 : Relevé bancaire officiel PDF avec solde vérifié
  const pdfTransactions = [
    { source_type: 'PDF', libelle: 'Virement reçu', montant: 1500 }
  ];
  const pdfVerifiedClosingBalance = 2450.75;
  const pdfStatus = getStatementDisplayStatus(pdfTransactions, 1500, pdfVerifiedClosingBalance, 'EUR');

  assert.equal(pdfStatus.isCsv, false);
  assert.equal(pdfStatus.hasVerifiedBalance, true);
  assert.equal(pdfStatus.kpiTitle, 'Solde Vérifié');
  assert.equal(pdfStatus.kpiSubtitle, 'Certifié relevé PDF');
  assert.equal(pdfStatus.kpiBadge, null);
  assert.match(pdfStatus.formattedAmount, /2 450,75 €/);
});
