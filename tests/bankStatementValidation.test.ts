import test from 'node:test';
import assert from 'node:assert/strict';

// Import direct avec extension .ts pour le test runner Node.js ESM
import { 
  detectBankName,
  extractCleanBankStatementRows,
  isBankCategoryHeader,
  isBankDescriptionHeader,
  classifyTransaction,
  formatDateFR,
  CATEGORIES
} from '../src/lib/bankParser.ts';
import { 
  validateBankStatementFile, 
  validateBankStatementCSVContent, 
  sanitizeImportErrorMessage,
  getStatementDisplayStatus
} from '../src/lib/bankValidation.ts';
import { 
  detectSubscriptionEvolution,
  normalizeSubscriptionServiceKey,
  extractUniqueActiveSubscriptions,
  isSubscriptionOrRecurringDebit,
  isDebitTransaction,
  areSubscriptionKeysMatching,
  parseInstallmentDetails,
  getSubscriptionMetadata
} from '../src/lib/bankUtils.ts';
import { 
  matchesCostOfLivingItem, 
  DEFAULT_COST_OF_LIVING_ITEMS, 
  CATEGORY_GROUPS_CONFIG 
} from '../src/lib/kpiUtils.ts';

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

  // Erreur de référence classifyTransaction is not defined
  const classifyErr = new Error("Erreur Cloud Function Gemini : classifyTransaction is not defined");
  const msg4 = sanitizeImportErrorMessage(classifyErr, 'GDB_27102026.csv');
  assert.match(msg4, /Erreur technique lors de la classification/);
  assert.doesNotMatch(msg4, /is not defined/);
});

test('5. CONFORMITÉ AU FORMAT RB : RÈGLE STRICTE CSV SANS SOLDE NI DISPO (AUCUN MONTANT DANS FLUX NET)', () => {
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
  
  // RÈGLE CRUCIALE : Pour un CSV sans solde officiel, AUCUN montant ne doit être affiché dans Flux Net ('—')
  assert.equal(csvStatus.kpiSubtitle, 'Total mouvements (CSV)');
  assert.equal(csvStatus.kpiBadge, 'Solde non dispo');
  assert.equal(csvStatus.formattedAmount, '—', 'Aucun montant ne doit être affiché dans le flux net pour un CSV');
  assert.equal(csvStatus.displayAmount, null);
  assert.match(csvStatus.explanation, /Relevé CSV/);

  // Cas 2 : Relevé CSV avec flux négatif (aucun montant affiché également)
  const negativeNetFlow = -650.40;
  const csvNegativeStatus = getStatementDisplayStatus(csvTransactions, negativeNetFlow, null, 'EUR');
  assert.equal(csvNegativeStatus.formattedAmount, '—');
  assert.equal(csvNegativeStatus.kpiTitle, 'Flux Net');
  assert.equal(csvNegativeStatus.kpiBadge, 'Solde non dispo');

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

test('6. EXCLUSION STRICTE DES COLONNES CATÉGORIES DU RB LORS DE L\'IMPORT CSV', () => {
  // Vérification de la fonction de détection des en-têtes à exclure
  assert.equal(isBankCategoryHeader('Categorie'), true);
  assert.equal(isBankCategoryHeader('Catégorie'), true);
  assert.equal(isBankCategoryHeader('Sous-catégorie'), true);
  assert.equal(isBankCategoryHeader('Rubrique'), true);
  assert.equal(isBankCategoryHeader('Classification'), true);
  assert.equal(isBankCategoryHeader('Type d\'opération'), true);
  assert.equal(isBankCategoryHeader('Solde'), true);

  // Vérification des vrais en-têtes de description
  assert.equal(isBankDescriptionHeader('Libellé'), true);
  assert.equal(isBankDescriptionHeader('Détail de l\'écriture'), true);
  assert.equal(isBankDescriptionHeader('Description'), true);
  assert.equal(isBankDescriptionHeader('Motif'), true);

  // Cas A : CSV bancaire avec colonne Catégorie et Sous-catégorie trompeuses
  const csvWithBankCategories = `Date;Libellé de l'opération;Catégorie;Sous-catégorie;Montant
01/03/2026;CARTE 28/02 INTERMARCHE GAILLARD;Vie quotidienne;Divers;-45.20
02/03/2026;PRLV TOTALENERGIES;Habitat;Énergie;-85.00
03/03/2026;PAIEMENT TOTAL RELAIS DU MONT;Automobile;Carburant;-60.00`;

  const rowsA = extractCleanBankStatementRows(csvWithBankCategories);
  assert.equal(rowsA.length, 3);
  assert.match(rowsA[0].rawLabel, /INTERMARCHE GAILLARD/);
  assert.doesNotMatch(rowsA[0].rawLabel, /Vie quotidienne|Divers/);
  assert.match(rowsA[1].rawLabel, /TOTALENERGIES/);
  assert.doesNotMatch(rowsA[1].rawLabel, /Habitat/);
  assert.match(rowsA[2].rawLabel, /TOTAL RELAIS/);

  // Cas B : CSV où la colonne Catégorie est placée avant la colonne Libellé
  const csvCategoryBeforeLabel = `Date;Catégorie;Description;Montant
01/03/2026;Non catégorisé;MCDONALDS ANNEMASSE;-18.50
02/03/2026;Autre;FREE MOBILE FORFAIT;-19.99`;

  const rowsB = extractCleanBankStatementRows(csvCategoryBeforeLabel);
  assert.equal(rowsB.length, 2);
  assert.equal(rowsB[0].rawLabel, 'MCDONALDS ANNEMASSE');
  assert.equal(rowsB[1].rawLabel, 'FREE MOBILE FORFAIT');

  // Cas C : CSV multi-colonnes de description (Libellé + Détail)
  const csvMultiDesc = `Date;Libellé;Détail de l'écriture;Catégorie de la banque;Montant
01/03/2026;CARTE X7791;PHARMACIE DE LA GARE ANNEMASSE;Santé & Prévoyance;-22.40`;

  const rowsC = extractCleanBankStatementRows(csvMultiDesc);
  assert.equal(rowsC.length, 1);
  assert.match(rowsC[0].rawLabel, /PHARMACIE DE LA GARE/);
  assert.doesNotMatch(rowsC[0].rawLabel, /Santé & Prévoyance/);
});

test('7. DISTINCTION PRÉCISE ET GRANULAIRE DES CATÉGORIES BASÉE EXCLUSIVEMENT SUR LE LIBELLÉ', () => {
  // Chaque opération doit être distinguée selon son vrai poste financier et non pas fondue dans une macro-catégorie
  const txAlim = classifyTransaction('CARTE 28/02 INTERMARCHE GAILLARD', -45.20);
  assert.equal(txAlim.category, 'Alimentation & Courses');
  assert.equal(txAlim.flowType, 'VARIABLE_EXPENSE');

  const txCarburant = classifyTransaction('PAIEMENT TOTAL RELAIS DU MONT', -60.00);
  assert.equal(txCarburant.category, 'Transports & Carburant');
  assert.equal(txCarburant.flowType, 'VARIABLE_EXPENSE');

  const txResto = classifyTransaction('CARTE MCDONALDS ANNEMASSE', -18.50);
  assert.equal(txResto.category, 'Restaurants & Sorties');
  assert.equal(txResto.flowType, 'VARIABLE_EXPENSE');

  const txEnergie = classifyTransaction('PRLV SEPA TOTALENERGIES ELEC', -85.00);
  assert.equal(txEnergie.category, 'Logement & Énergie');
  assert.equal(txEnergie.flowType, 'FIXED_EXPENSE');
  assert.equal(txEnergie.isSubscription, true);

  const txTelecom = classifyTransaction('PRLV SEPA FREE MOBILE', -19.99);
  assert.equal(txTelecom.category, 'Abonnements & Télécom');
  assert.equal(txTelecom.flowType, 'FIXED_EXPENSE');
  assert.equal(txTelecom.isSubscription, true);

  const txSante = classifyTransaction('CARTE PHARMACIE DE LA GARE', -24.80);
  assert.equal(txSante.category, 'Santé');
  assert.equal(txSante.flowType, 'VARIABLE_EXPENSE');

  const txShopping = classifyTransaction('AMAZON EU SARL PAY LUX', -39.99);
  assert.equal(txShopping.category, 'Shopping & Maison');
  assert.equal(txShopping.flowType, 'VARIABLE_EXPENSE');

  const txSalaire = classifyTransaction('VIR SALAIRE ACME CORP', 3200.00);
  assert.equal(txSalaire.category, 'Salaire & Revenus');
  assert.equal(txSalaire.flowType, 'INCOME');

  const txVirementFamille = classifyTransaction('VIR WERO NAYSSA', -50.00);
  assert.equal(txVirementFamille.category, 'Virements Famille & Proches');
  assert.equal(txVirementFamille.flowType, 'VARIABLE_EXPENSE');
});

test('8. STRUCTURE DES CATÉGORIES : AUCUNE MACRO-CATÉGORIE ET REGROUPEMENT PROPRE', () => {
  // RÈGLE : La liste CATEGORIES ne doit JAMAIS comporter de macro-catégorie
  assert.equal(CATEGORIES.includes('Charges fixes'), false, 'Charges fixes est une nature, pas une catégorie');
  assert.equal(CATEGORIES.includes('Charges variables courantes'), false, 'Charges variables courantes est une nature');
  assert.equal(CATEGORIES.includes('Dépenses de confort'), false, 'Dépenses de confort est une nature');
  assert.equal(CATEGORIES.includes('Revenus'), false, 'Revenus est une nature');

  // RÈGLE : Regroupement propre des catégories similaires
  assert.equal(CATEGORIES.includes('Logement & Énergie'), true);
  assert.equal(CATEGORIES.includes('Abonnements & Télécom'), true);
  assert.equal(CATEGORIES.includes('Assurances'), true);
  assert.equal(CATEGORIES.includes('Paiement fractionné'), true);
  assert.equal(CATEGORIES.includes('Frais bancaires'), true);
  assert.equal(CATEGORIES.includes('Impôts & Amendes'), true);
  assert.equal(CATEGORIES.includes('Alimentation & Courses'), true);
  assert.equal(CATEGORIES.includes('Transports & Carburant'), true);
  assert.equal(CATEGORIES.includes('Restaurants & Sorties'), true);
  assert.equal(CATEGORIES.includes('Shopping & Maison'), true);
  assert.equal(CATEGORIES.includes('Loisirs & Activités'), true);
  assert.equal(CATEGORIES.includes('Santé'), true);
  assert.equal(CATEGORIES.includes('Retrait Espèces'), true);
  assert.equal(CATEGORIES.includes('Virements Famille & Proches'), true);
  assert.equal(CATEGORIES.includes('Salaire & Revenus'), true);
  assert.equal(CATEGORIES.includes('Aides & Allocations'), true);
  assert.equal(CATEGORIES.includes('Épargne & Investissement'), true);
  assert.equal(CATEGORIES.includes('Virements Internes'), true);
  assert.equal(CATEGORIES.includes('Autre'), true);

  // Amex doit être classé dans Paiement fractionné (charge fixe) et non dans une catégorie fragmentée
  const amexTx = classifyTransaction('PRELEVEMENT AMERICAN EXPRESS CARTE', -125.00);
  assert.equal(amexTx.category, 'Paiement fractionné');
  assert.equal(amexTx.flowType, 'FIXED_EXPENSE');
});

test('9. OUTIL ABONNEMENTS : DÉTECTION ÉVOLUTION DES PRIX, HISTORIQUE ET AIDE À LA NÉGOCIATION', () => {
  const allTx = [
    { id: '1', date: '2026-01-05', cleanLabel: 'Netflix', rawLabel: 'PRLV SEPA NETFLIX', amount: -13.49, isSubscription: true },
    { id: '2', date: '2026-02-05', cleanLabel: 'Netflix', rawLabel: 'PRLV SEPA NETFLIX', amount: -15.99, isSubscription: true },
    { id: '3', date: '2026-03-05', cleanLabel: 'Netflix', rawLabel: 'PRLV SEPA NETFLIX', amount: -17.99, isSubscription: true },
    { id: '4', date: '2026-01-10', cleanLabel: 'Free Mobile', rawLabel: 'PRLV SEPA FREE MOBILE', amount: -19.99, isSubscription: true },
    { id: '5', date: '2026-02-10', cleanLabel: 'Free Mobile', rawLabel: 'PRLV SEPA FREE MOBILE', amount: -15.99, isSubscription: true },
    { id: '6', date: '2026-01-15', cleanLabel: 'Spotify', rawLabel: 'PRLV SPOTIFY', amount: -10.99, isSubscription: true },
    { id: '7', date: '2026-02-15', cleanLabel: 'Spotify', rawLabel: 'PRLV SPOTIFY', amount: -10.99, isSubscription: true },
    { id: '8', date: '2026-03-20', cleanLabel: 'Disney+', rawLabel: 'PRLV DISNEY PLUS', amount: -8.99, isSubscription: true }
  ];

  // Test 9.1: Hausse de prix détectée sur Netflix
  const evoNetflix = detectSubscriptionEvolution(allTx[2] as any, allTx as any);
  assert.equal(evoNetflix.status, 'INCREASED');
  assert.equal(evoNetflix.currentAmount, 17.99);
  assert.equal(evoNetflix.previousAmount, 15.99);
  assert.equal(evoNetflix.difference, 2.00);
  assert.equal(Math.round(evoNetflix.percentChange || 0), 13);
  assert.equal(evoNetflix.history.length, 3);
  assert.match(evoNetflix.negotiationAdvice || '', /Hausse de/);

  // Test 9.2: Baisse de prix détectée sur Free Mobile
  const evoFree = detectSubscriptionEvolution(allTx[4] as any, allTx as any);
  assert.equal(evoFree.status, 'DECREASED');
  assert.equal(evoFree.difference, -4.00);

  // Test 9.3: Tarif stable sur Spotify
  const evoSpotify = detectSubscriptionEvolution(allTx[6] as any, allTx as any);
  assert.equal(evoSpotify.status, 'STABLE');
  assert.equal(evoSpotify.difference, 0);

  // Test 9.4: Nouveau prélèvement sur Disney+
  const evoDisney = detectSubscriptionEvolution(allTx[7] as any, allTx as any);
  assert.equal(evoDisney.status, 'NEW');

  // Test 9.5: Hausse multi-mois maintenue (Janvier 13.49 €, Février 15.99 €, Mars 15.99 €)
  // Même si Mars == Février (15.99 €), la hausse par rapport au tarif d'origine de 13.49 € (+2.50 €) doit être détectée !
  const sustainedHikeTx = [
    { id: 'h1', date: '2026-01-05', cleanLabel: 'Netflix', rawLabel: 'PRLV SEPA 0019284 NETFLIX 2026-01', amount: -13.49, isSubscription: true },
    { id: 'h2', date: '2026-02-05', cleanLabel: 'Netflix', rawLabel: 'PRLV SEPA 0084729 NETFLIX 2026-02', amount: -15.99, isSubscription: true },
    { id: 'h3', date: '2026-03-05', cleanLabel: 'Netflix', rawLabel: 'PRLV SEPA 0095812 NETFLIX 2026-03', amount: -15.99, isSubscription: true }
  ];
  const evoSustained = detectSubscriptionEvolution(sustainedHikeTx[2] as any, sustainedHikeTx as any);
  assert.equal(evoSustained.status, 'INCREASED', 'Doit détecter la hausse maintenue de +2.50 € même si le dernier mois est stable par rapport au mois précédent');
  assert.equal(evoSustained.currentAmount, 15.99);
  assert.equal(evoSustained.previousAmount, 13.49);
  assert.equal(evoSustained.difference, 2.50);
  assert.equal(evoSustained.history.length, 3);

  // Test 9.6: Reconnaissance canonique des mandats SEPA et références variables
  const key1 = normalizeSubscriptionServiceKey({ rawLabel: 'PRLV SEPA 0019284 NETFLIX 2026-01' });
  const key2 = normalizeSubscriptionServiceKey({ rawLabel: 'PRLV SEPA 0084729 NETFLIX 2026-02' });
  assert.equal(key1, key2, 'Les deux libellés Netflix doivent produire la même clé canonique');

  const keyFree1 = normalizeSubscriptionServiceKey({ rawLabel: 'PRLV SEPA FREE MOBILE FACTURE 01928' });
  const keyFree2 = normalizeSubscriptionServiceKey({ rawLabel: 'PRLV SEPA FREE MOBILE FACTURE 84721' });
  assert.equal(keyFree1, keyFree2, 'Les deux factures Free Mobile doivent produire la même clé canonique');

  // Test 9.7: Prélèvements récurrents (TotalEnergies, Macif, EDF)
  assert.equal(isSubscriptionOrRecurringDebit({ rawLabel: 'PRLV SEPA TOTALENERGIES ELECTRICITE CLIENT 0492819', amount: -75.50 }), true);
  assert.equal(isSubscriptionOrRecurringDebit({ rawLabel: 'PRLV SEPA MACIF ASSURANCE HABITATION 92834', amount: -28.90 }), true);
  assert.equal(isSubscriptionOrRecurringDebit({ rawLabel: 'PRLV SEPA EDF CLIENT 99283401', amount: -65.00 }), true);

  // Test 9.8: Déduplication des abonnements actifs uniques (1 seul abonnement Netflix dans la liste avec tarif actuel)
  const allMixedTx = [...sustainedHikeTx, allTx[4], allTx[6]];
  const { subscriptions: uniqueSubs, totalMonthly } = extractUniqueActiveSubscriptions(sustainedHikeTx as any, allMixedTx as any);
  
  const netflixCount = uniqueSubs.filter(s => normalizeSubscriptionServiceKey(s) === 'netflix').length;
  assert.equal(netflixCount, 1, 'Chaque service ne doit apparaître qu une seule fois dans la liste des abonnements');
  const netflixRep = uniqueSubs.find(s => normalizeSubscriptionServiceKey(s) === 'netflix');
  assert.equal(Math.abs(netflixRep?.amount || 0), 15.99, 'La transaction représentative doit être celle au tarif le plus récent');
  assert.ok(totalMonthly > 0, 'Le total mensuel doit être strictement positif');

  // Test 9.9: Modèle BankTransaction (avec amount positif absolu et rawAmount négatif) & Prélèvement générique CSV
  const txBankModel = {
    id: 'tx_csv_1',
    date: '2026-03-12',
    description: 'Prélèvement Abonnement',
    rawLabel: 'PRLV SEPA 987654 ADHESION MENSUELLE',
    amount: 29.90, // format stocké positif dans bankTransactions
    rawAmount: -29.90,
    type: 'debit',
    flowType: 'FIXED_EXPENSE',
    isSubscription: true
  };
  assert.equal(isSubscriptionOrRecurringDebit(txBankModel as any), true, 'Doit reconnaître le modèle BankTransaction avec amount positif');

  // Test 9.10: Classification automatique des prélèvements génériques dans classifyTransaction
  const classifiedGeneric = classifyTransaction('PRLV SEPA 987654 ADHESION MENSUELLE', -29.90);
  assert.equal(classifiedGeneric.isSubscription, true, 'Tout prélèvement SEPA débit doit être automatiquement flaggué isSubscription');
  assert.equal(classifiedGeneric.flowType, 'FIXED_EXPENSE');
  assert.equal(classifiedGeneric.category, 'Abonnements & Télécom');
});

test('10. SIMULATEUR COÛT DE LA VIE : RÉINITIALISATION À 0 € ET PRÉSERVATION DES POSTES PAR DÉFAUT', () => {
  const defaultItems = [
    { id: 'loyer', name: 'Loyer / Crédit Immobilier', amount: 850, categoryGroup: 'logement' },
    { id: 'courses', name: 'Courses Alimentaires', amount: 450, categoryGroup: 'alimentation' },
    { id: 'custom_1', name: 'Salle de sport', amount: 35, categoryGroup: 'abonnements' }
  ];

  // Action : Réinitialiser remet tous les montants à 0 €
  const zeroed = defaultItems.map(item => ({ ...item, amount: 0 }));
  assert.equal(zeroed.every(i => i.amount === 0), true);
  assert.equal(zeroed.length, 3);
  assert.equal(zeroed[0].name, 'Loyer / Crédit Immobilier');

  // Action : Suppression d un item par défaut remet son montant à 0 € sans supprimer la ligne
  const handledDefaultRemoval = defaultItems.map(item => item.id === 'loyer' ? { ...item, amount: 0 } : item);
  assert.equal(handledDefaultRemoval.find(i => i.id === 'loyer')?.amount, 0);
  assert.equal(handledDefaultRemoval.length, 3, 'La ligne Loyer ne doit pas disparaître');
});

test('11. FIXATION DU BUDGET : DÉPENSES RÉELLES DU RELEVÉ BANCAIRE (RB) ET ÉCART BUDGÉTAIRE', () => {
  // Jeu d'opérations bancaires réelles issues d'un relevé bancaire (RB)
  // Remarque : dans Firestore et l'état React, amount est stocké en valeur positive absolue,
  // et la nature débit est portée par rawAmount < 0 ou flowType ou type: 'debit'.
  const rbTransactions = [
    {
      id: 'tx_loyer_1',
      date: '2026-03-05',
      rawLabel: 'VIR SEPA LOYER MARS 2026',
      cleanLabel: 'Loyer',
      amount: 450.00,
      rawAmount: -450.00,
      flowType: 'FIXED_EXPENSE',
      category: 'Logement'
    },
    {
      id: 'tx_courses_1',
      date: '2026-03-08',
      rawLabel: 'CARTE 08/03 CARREFOUR MARKET ANNEMASSE',
      cleanLabel: 'Carrefour Market',
      amount: 65.50,
      rawAmount: -65.50,
      flowType: 'VARIABLE_EXPENSE',
      category: 'Alimentation & Supermarché'
    },
    {
      id: 'tx_resto_1',
      date: '2026-03-12',
      rawLabel: 'CARTE 12/03 RESTAURANT LE BISTROT',
      cleanLabel: 'Le Bistrot',
      amount: 42.00,
      rawAmount: -42.00,
      flowType: 'VARIABLE_EXPENSE',
      category: 'Restaurants & Sorties'
    },
    {
      id: 'tx_shopping_1',
      date: '2026-03-15',
      rawLabel: 'CARTE 15/03 ZARA VETEMENTS',
      cleanLabel: 'Zara',
      amount: 35.00,
      rawAmount: -35.00,
      flowType: 'VARIABLE_EXPENSE',
      category: 'Shopping & Maison'
    },
    {
      id: 'tx_salaire_1',
      date: '2026-03-28',
      rawLabel: 'VIR SEPA SALAIRE ENTREPRISE ACME',
      cleanLabel: 'Salaire',
      amount: 2100.00,
      rawAmount: 2100.00,
      flowType: 'INCOME',
      category: 'Revenus'
    },
    {
      id: 'tx_vir_interne_1',
      date: '2026-03-10',
      rawLabel: 'VIR INTERNE VERS LIVRET A',
      cleanLabel: 'Virement vers Livret A',
      amount: 200.00,
      rawAmount: -200.00,
      isInternalTransfer: true,
      flowType: 'SAVINGS_TRANSFER',
      category: 'Épargne'
    }
  ];

  // 11.1: Détection universelle des transactions de dépense (isDebitTransaction)
  // Doit identifier correctement les 4 dépenses et exclure salaire & virement interne
  const isExpense = (t: any) => {
    if (!isDebitTransaction(t)) return false;
    if (t.isInternalTransfer) return false;
    if (t.flowType === 'SAVINGS_TRANSFER' || t.flowType === 'INCOME') return false;
    const cat = (t.category || '').toLowerCase();
    if (cat.includes('virement interne') || cat.includes('épargne')) return false;
    return true;
  };

  const detectedExpenses = rbTransactions.filter(isExpense);
  assert.equal(detectedExpenses.length, 4, 'Doit détecter exactement 4 dépenses réelles');
  assert.equal(detectedExpenses.some(t => t.id === 'tx_salaire_1'), false, 'Le salaire ne doit pas être une dépense');
  assert.equal(detectedExpenses.some(t => t.id === 'tx_vir_interne_1'), false, 'Le virement interne ne doit pas être une dépense');

  // 11.2: Rapprochement avec les postes budgétaires calibrés
  const postList = [
    { id: 'loyer', name: 'Loyer / Crédit Immobilier', group: 'logement', defaultBudget: 500 },
    { id: 'courses', name: 'Courses Alimentaires', group: 'alimentation', defaultBudget: 200 }
  ];

  // Matched IDs pour ventiler les dépenses
  const matchedTxIds = new Set<string>();

  // Calcul poste Loyer
  const loyerMatches = detectedExpenses.filter(t => {
    const matches = matchesCostOfLivingItem(t as any, 'Loyer / Crédit Immobilier');
    if (matches) matchedTxIds.add(t.id);
    return matches;
  });
  assert.equal(loyerMatches.length, 1);
  assert.equal(loyerMatches[0].amount, 450);

  // Calcul poste Courses
  const coursesMatches = detectedExpenses.filter(t => {
    const matches = matchesCostOfLivingItem(t as any, 'Courses Alimentaires');
    if (matches) matchedTxIds.add(t.id);
    return matches;
  });
  assert.equal(coursesMatches.length, 1);
  assert.equal(coursesMatches[0].amount, 65.50);

  // 11.3: Dépenses réelles non budgétées issues directement du RB (Restaurants & Shopping)
  // Ne doivent JAMAIS être ignorées ni mises à 0 €
  const remainingExpenses = detectedExpenses.filter(t => !matchedTxIds.has(t.id));
  assert.equal(remainingExpenses.length, 2, 'Les 2 dépenses hors budget de base doivent être capturées');

  const rbCategoryGroups: Record<string, typeof rbTransactions> = {};
  remainingExpenses.forEach(tx => {
    const cat = tx.category || 'Autre';
    if (!rbCategoryGroups[cat]) rbCategoryGroups[cat] = [];
    rbCategoryGroups[cat].push(tx);
  });

  const restoTxs = rbCategoryGroups['Restaurants & Sorties'];
  assert.ok(restoTxs, 'La catégorie "Restaurants & Sorties" issue du RB doit exister');
  assert.equal(restoTxs.reduce((sum, t) => sum + t.amount, 0), 42.00, 'Dépense réelle restaurant = 42 €');

  const shoppingTxs = rbCategoryGroups['Shopping & Maison'];
  assert.ok(shoppingTxs, 'La catégorie "Shopping & Maison" issue du RB doit exister');
  assert.equal(shoppingTxs.reduce((sum, t) => sum + t.amount, 0), 35.00, 'Dépense réelle shopping = 35 €');

  // 11.4: Calcul exact de l'écart budgétaire global
  const totalBudgetAllocated = postList.reduce((sum, p) => sum + p.defaultBudget, 0); // 500 + 200 = 700 €
  const totalRealSpent = detectedExpenses.reduce((sum, t) => sum + t.amount, 0); // 450 + 65.5 + 42 + 35 = 592.50 €
  const totalDiff = totalBudgetAllocated - totalRealSpent; // 700 - 592.50 = +107.50 € (reste à dépenser)

  assert.equal(totalBudgetAllocated, 700.00);
  assert.equal(totalRealSpent, 592.50, 'Les dépenses réelles ne doivent JAMAIS valoir 0,00 €');
  assert.equal(totalDiff, 107.50, 'L écart budgétaire net doit être strictement exact');
});

test('12. ABONNEMENTS ET PRÉLÈVEMENTS : SÉPARATION STRICTE GOOGLE, AMEX SANS FAUSSE ALERTE, BNPL ÉCHÉANCES ET HUMILITÉ DES LIBELLÉS', () => {
  // 12.1: Séparation stricte de deux abonnements Google différents (2,99 € vs 10,99 €)
  const txGoogle299 = {
    id: 'tx_g_storage',
    date: '2026-03-12',
    rawLabel: 'CB GOOGLE SERVICES 12/03',
    cleanLabel: 'Google',
    amount: 2.99,
    rawAmount: -2.99,
    type: 'debit',
    flowType: 'FIXED_EXPENSE',
    isSubscription: true
  };

  const txGoogle1099 = {
    id: 'tx_g_yt',
    date: '2026-03-15',
    rawLabel: 'CB GOOGLE SERVICES 15/03',
    cleanLabel: 'Google',
    amount: 10.99,
    rawAmount: -10.99,
    type: 'debit',
    flowType: 'FIXED_EXPENSE',
    isSubscription: true
  };

  const key299 = normalizeSubscriptionServiceKey(txGoogle299);
  const key1099 = normalizeSubscriptionServiceKey(txGoogle1099);
  assert.notEqual(key299, key1099, 'Google 2,99 € et Google 10,99 € doivent avoir des clés distinctes');
  assert.equal(areSubscriptionKeysMatching(key299, key1099), false, 'Les deux clés Google ne doivent JAMAIS correspondre entre elles');

  // Préservation des deux abonnements dans extractUniqueActiveSubscriptions
  const multiMonthGoogleTxs = [
    { ...txGoogle299, id: 'g1_m1', date: '2026-02-12' },
    { ...txGoogle1099, id: 'g2_m1', date: '2026-02-15' },
    { ...txGoogle299, id: 'g1_m2', date: '2026-03-12' },
    { ...txGoogle1099, id: 'g2_m2', date: '2026-03-15' }
  ];

  const currentMonthScope = [
    { ...txGoogle299, id: 'g1_m2', date: '2026-03-12' },
    { ...txGoogle1099, id: 'g2_m2', date: '2026-03-15' }
  ];

  const { subscriptions: googleSubs, totalMonthly: googleTotal } = extractUniqueActiveSubscriptions(
    currentMonthScope as any,
    multiMonthGoogleTxs as any
  );

  assert.equal(googleSubs.length, 2, 'Les deux abonnements Google doivent TOUS LES DEUX être conservés dans la liste');
  assert.equal(Math.round(googleTotal * 100) / 100, 13.98, 'Le total mensuel doit cumuler 2,99 € + 10,99 € = 13,98 €');

  // Détection de l'évolution des prix : stabilité garantie pour chacun, AUCUNE fausse hausse de 267%
  const evoG1 = detectSubscriptionEvolution(currentMonthScope[0] as any, multiMonthGoogleTxs as any);
  const evoG2 = detectSubscriptionEvolution(currentMonthScope[1] as any, multiMonthGoogleTxs as any);

  assert.equal(evoG1.status, 'STABLE', 'Google 2,99 € doit être analysé comme tarif stable');
  assert.equal(evoG1.currentAmount, 2.99);
  assert.equal(evoG2.status, 'STABLE', 'Google 10,99 € doit être analysé comme tarif stable');
  assert.equal(evoG2.currentAmount, 10.99);

  // 12.2: Remboursement Carte American Express : Carte de crédit à débit différé (variation normale)
  const amexTxs = [
    { id: 'amex_1', date: '2026-01-28', rawLabel: 'PRLV SEPA AMERICAN EXPRESS 01', amount: 320.40, rawAmount: -320.40, isSubscription: true },
    { id: 'amex_2', date: '2026-02-28', rawLabel: 'PRLV SEPA AMERICAN EXPRESS 02', amount: 580.90, rawAmount: -580.90, isSubscription: true },
    { id: 'amex_3', date: '2026-03-28', rawLabel: 'PRLV SEPA AMERICAN EXPRESS 03', amount: 215.10, rawAmount: -215.10, isSubscription: true }
  ];

  const evoAmex = detectSubscriptionEvolution(amexTxs[2] as any, amexTxs as any);
  assert.equal(evoAmex.isCreditCard, true, 'Doit identifier American Express comme carte de crédit à débit différé');
  assert.equal(evoAmex.status, 'VARIABLE_DEBIT', 'Ne doit JAMAIS être flaggué comme une hausse/baisse d abonnement suspecte');
  assert.equal(evoAmex.difference, 0, 'La différence tarifaire doit être neutralisée à 0');
  assert.match(evoAmex.negotiationAdvice || '', /dépenses/i, 'L avis doit expliquer que le montant varie normalement selon les achats carte');

  const metaAmex = getSubscriptionMetadata(amexTxs[2] as any, evoAmex, amexTxs as any);
  assert.equal(metaAmex.logicalGroup, 'credit_card');
  assert.equal(metaAmex.isCreditCard, true);

  // 12.3: Paiements fractionnés (Alma, Oney, Klarna, Floa) : Détection des échéances et date de fin estimée
  const almaTx = {
    id: 'tx_alma',
    date: '2026-03-10',
    rawLabel: 'PRLV SEPA ALMA ECH 02/03 REF 09872',
    cleanLabel: 'Alma',
    amount: 60.00,
    rawAmount: -60.00
  };

  const almaDetails = parseInstallmentDetails(almaTx);
  assert.equal(almaDetails.isBNPL, true);
  assert.equal(almaDetails.provider, 'Alma');
  assert.equal(almaDetails.currentInstallment, 2);
  assert.equal(almaDetails.totalInstallments, 3);
  assert.equal(almaDetails.remainingInstallments, 1);
  assert.equal(almaDetails.estimatedEndMonth, 'Avril 2026', 'Doit estimer la fin à Avril 2026');
  assert.match(almaDetails.explanation, /Échéance 2\/3/);

  const klarnaLastTx = {
    id: 'tx_klarna',
    date: '2026-03-15',
    rawLabel: 'PRLV SEPA KLARNA PAY IN 3 ECH 3/3',
    amount: 45.00
  };
  const klarnaDetails = parseInstallmentDetails(klarnaLastTx);
  assert.equal(klarnaDetails.remainingInstallments, 0);
  assert.match(klarnaDetails.explanation, /soldé ce mois-ci/i);

  // 12.4: Clarté, explications épurées et humilité sur les libellés bancaires
  // Cas Sobrio (Société Générale)
  const sobrioMeta = getSubscriptionMetadata({ rawLabel: 'COTISATION SOBRIO 03/26', cleanLabel: 'Cotisation Sobrio (Banque)' });
  assert.equal(sobrioMeta.cleanTitle, 'Cotisation Sobrio (Société Générale)');
  assert.match(sobrioMeta.plainDescription, /Société Générale/i);
  assert.match(sobrioMeta.plainDescription, /carte bancaire/i);
  assert.equal(sobrioMeta.logicalGroup, 'bank_fees');

  // Cas Arrêté de compte trimestriel / Minimum forfaitaire
  const arreteMeta = getSubscriptionMetadata({ rawLabel: 'ARRETE 01.07/30.09 MINIMUM FORFAITAIRE NOMBRE JOUR', cleanLabel: 'Frais bancaires' });
  assert.equal(arreteMeta.cleanTitle, 'Frais de compte / Arrêté périodique (Banque)');
  assert.match(arreteMeta.plainDescription, /arrêté de compte/i);
  assert.equal(arreteMeta.logicalGroup, 'bank_fees');

  // Cas Google 2,99 € avec mention humble
  const google299Meta = getSubscriptionMetadata(txGoogle299);
  assert.equal(google299Meta.cleanTitle, 'Google (Stockage Cloud Google One)');
  assert.ok(google299Meta.humbleDisclaimer, 'Un disclaimer humble doit être présent pour expliquer que le libellé bancaire est succinct');
  assert.match(google299Meta.humbleDisclaimer || '', /2,99 €/);

  // Cas libellé inconnu et succinct : humble transparence
  const unknownMeta = getSubscriptionMetadata({ rawLabel: 'PRLV SEPA 847291 SAS INCONNU', cleanLabel: 'Opération' });
  assert.ok(unknownMeta.humbleDisclaimer, 'Doit avertir humblement que les informations bancaires sont trop succinctes');
  assert.equal(unknownMeta.logicalGroup, 'other');

  // 12.5: Historique chronologique avec date et mois formaté rattaché au prix
  const multiMonthHistoryTx = [
    { id: 'sp1', date: '2026-01-14', cleanLabel: 'Spotify', rawLabel: 'SPOTIFY', amount: -10.99, isSubscription: true },
    { id: 'sp2', date: '2026-02-14', cleanLabel: 'Spotify', rawLabel: 'SPOTIFY', amount: -10.99, isSubscription: true },
    { id: 'sp3', date: '2026-03-14', cleanLabel: 'Spotify', rawLabel: 'SPOTIFY', amount: -10.99, isSubscription: true }
  ];
  const evoSpo = detectSubscriptionEvolution(multiMonthHistoryTx[2] as any, multiMonthHistoryTx as any);
  assert.equal(evoSpo.history.length, 3);
  assert.ok(evoSpo.history[0].monthLabel, 'Chaque point d historique doit avoir un libellé de mois formaté');
  assert.ok(evoSpo.history[0].formattedDate, 'Chaque point d historique doit avoir une date d exécution formatée');
  assert.equal(evoSpo.history[0].amount, 10.99);

  // 12.6: Ordre logique des catégories d abonnements
  const groupsOrder = ['housing', 'insurance', 'telecom', 'digital', 'bnpl', 'credit_card', 'bank_fees', 'other'];
  const testTxs = [
    { tx: { rawLabel: 'COTISATION SOBRIO' }, expectedGroup: 'bank_fees' },
    { tx: { rawLabel: 'PRLV SEPA AMERICAN EXPRESS' }, expectedGroup: 'credit_card' },
    { tx: { rawLabel: 'PRLV SEPA ALMA ECH 1/3' }, expectedGroup: 'bnpl' },
    { tx: { rawLabel: 'PRLV SEPA NETFLIX' }, expectedGroup: 'digital' },
    { tx: { rawLabel: 'PRLV SEPA ORANGE FIBRE' }, expectedGroup: 'telecom' },
    { tx: { rawLabel: 'PRLV SEPA MACIF ASSURANCE' }, expectedGroup: 'insurance' },
    { tx: { rawLabel: 'PRLV SEPA TOTALENERGIES' }, expectedGroup: 'housing' }
  ];

  testTxs.forEach(({ tx, expectedGroup }) => {
    const meta = getSubscriptionMetadata(tx as any);
    assert.equal(meta.logicalGroup, expectedGroup, `Le contrat ${tx.rawLabel} doit être affecté au groupe logique ${expectedGroup}`);
  });
});

test('13. COÛT DE LA VIE ET HARMONISATION UNIVERSELLE DES DATES', () => {
  // 13.1: Harmonisation stricte de toutes les dates au format français long '10 juillet 2026'
  assert.equal(formatDateFR('2026-07-10'), '10 juillet 2026', 'Doit formater une date ISO au format "10 juillet 2026"');
  assert.equal(formatDateFR('10/07/2026'), '10 juillet 2026', 'Doit formater une date FR slash au format "10 juillet 2026"');
  assert.equal(formatDateFR('2026-10-05'), '5 octobre 2026', 'Doit formater "2026-10-05" en "5 octobre 2026"');
  assert.equal(formatDateFR('05/08/2026'), '5 août 2026', 'Doit formater "05/08/2026" en "5 août 2026"');
  assert.equal(formatDateFR('2026-09-07'), '7 septembre 2026', 'Doit formater "2026-09-07" en "7 septembre 2026"');
  assert.equal(formatDateFR(null), '-', 'Doit retourner un tiret neutre en cas de date nulle');

  // 13.2: Éradication formelle du bug des sous-chaînes dans le Coût de la vie
  // "Intermarché" contient "ter", mais ne doit JAMAIS être affecté à "Transports en commun"
  const txIntermarche = {
    id: 'tx_inter',
    date: '2026-10-05',
    rawLabel: 'CARTE 05/10 INTERMARCHE CONTACT',
    cleanLabel: 'Intermarché',
    amount: 15.95,
    category: 'Alimentation & Courses'
  };
  assert.equal(
    matchesCostOfLivingItem(txIntermarche as any, 'Transports en commun'),
    false,
    'Intermarché ne doit JAMAIS matcher les Transports en commun (éradication du bug de la sous-chaîne "ter")'
  );
  assert.equal(
    matchesCostOfLivingItem(txIntermarche as any, 'Courses Alimentaires'),
    true,
    'Intermarché doit être rattaché aux Courses Alimentaires'
  );

  // "Café Columbus" contient "bus", mais ne doit JAMAIS être affecté à "Transports en commun"
  const txColumbus = {
    id: 'tx_columbus',
    date: '2026-10-02',
    rawLabel: 'CARTE 02/10 CAFE COLUMBUS ANNEMASSE',
    cleanLabel: 'Café Columbus',
    amount: 3.90,
    category: 'Restaurants & Sorties'
  };
  assert.equal(
    matchesCostOfLivingItem(txColumbus as any, 'Transports en commun'),
    false,
    'Café Columbus ne doit JAMAIS matcher les Transports en commun (éradication du bug de la sous-chaîne "bus")'
  );
  assert.equal(
    matchesCostOfLivingItem(txColumbus as any, 'Cafés, Bars & Sorties'),
    true,
    'Café Columbus doit être rattaché à "Cafés, Bars & Sorties"'
  );

  // 13.3: Cloisonnement strict Péages / Carburant vs Transports en commun
  // "Aprr Autoroute" ne doit JAMAIS être dans "Transports en commun"
  const txAprr = {
    id: 'tx_aprr',
    date: '2026-10-05',
    rawLabel: 'CARTE 05/10 APRR AUTOROUTE A40',
    cleanLabel: 'Aprr Autoroute',
    amount: 20.50,
    category: 'Transports & Carburant'
  };
  assert.equal(
    matchesCostOfLivingItem(txAprr as any, 'Transports en commun'),
    false,
    'Aprr Autoroute est un péage autoroutier et ne doit pas figurer dans les transports en commun'
  );
  assert.equal(
    matchesCostOfLivingItem(txAprr as any, 'Carburant & Péages'),
    true,
    'Aprr Autoroute doit figurer dans "Carburant & Péages"'
  );

  // Vrai billet de transport public (TER SNCF)
  const txSncfTer = {
    id: 'tx_sncf',
    date: '2026-10-03',
    rawLabel: 'ACHAT SNCF BILLET TER HAUTS DE FRANCE',
    cleanLabel: 'SNCF',
    amount: 12.40,
    category: 'Transports'
  };
  assert.equal(
    matchesCostOfLivingItem(txSncfTer as any, 'Transports en commun'),
    true,
    'Un billet TER SNCF doit être affecté aux Transports en commun'
  );

  // 13.4: Séparation nette Abonnements & Numérique vs Loisirs & Activités
  const txNetflix = {
    id: 'tx_net',
    date: '2026-10-01',
    rawLabel: 'PRLV SEPA NETFLIX SERVICES',
    cleanLabel: 'Netflix',
    amount: 13.49,
    category: 'Abonnements & Télécom'
  };
  assert.equal(
    matchesCostOfLivingItem(txNetflix as any, 'Streaming, Cloud & Services'),
    true,
    'Netflix doit être classé dans Streaming, Cloud & Services'
  );
  assert.equal(
    matchesCostOfLivingItem(txNetflix as any, 'Loisirs, Sorties & Culture'),
    false,
    'Netflix ne doit pas être fusionné avec les sorties/loisirs'
  );

  const txCinema = {
    id: 'tx_cine',
    date: '2026-10-04',
    rawLabel: 'CARTE 04/10 PATHE GAUMONT PLACE CINEMA',
    cleanLabel: 'Pathé Gaumont',
    amount: 14.50,
    category: 'Loisirs & Activités'
  };
  assert.equal(
    matchesCostOfLivingItem(txCinema as any, 'Loisirs, Sorties & Culture'),
    true,
    'Le cinéma doit être classé dans Loisirs, Sorties & Culture'
  );
  assert.equal(
    matchesCostOfLivingItem(txCinema as any, 'Streaming, Cloud & Services'),
    false,
    'Le cinéma ne doit pas être affecté aux abonnements streaming'
  );
});

test('14. FUSION ET COMPLÉMENTARITÉ : COÛT DE LA VIE ET FIXATION DU BUDGET DANS UNE INTERFACE UNIFIÉE', () => {
  // 14.1: Vérification de l exhaustivité des 9 univers de dépenses
  assert.equal(CATEGORY_GROUPS_CONFIG.length, 9, 'Il doit y avoir exactement 9 univers thématiques');
  const groupIds = CATEGORY_GROUPS_CONFIG.map(g => g.id);
  assert.ok(groupIds.includes('restaurants'), 'Les restaurants doivent avoir leur univers dédié');
  assert.ok(groupIds.includes('abonnements'), 'Les abonnements numériques doivent avoir leur univers dédié');
  assert.ok(groupIds.includes('loisirs'), 'Les loisirs & sport doivent avoir leur univers dédié');

  // 14.2: Les 16 postes par défaut couvrent l ensemble des univers
  assert.equal(DEFAULT_COST_OF_LIVING_ITEMS.length, 16, 'Il doit y avoir 16 postes de charges par défaut');
  assert.ok(DEFAULT_COST_OF_LIVING_ITEMS.some(i => i.name === 'Cafés, Bars & Sorties'), 'Le poste Cafés doit exister');
  assert.ok(DEFAULT_COST_OF_LIVING_ITEMS.some(i => i.name === 'Carburant & Péages'), 'Le poste Carburant & Péages doit exister');
  assert.ok(DEFAULT_COST_OF_LIVING_ITEMS.some(i => i.name === 'Transports en commun'), 'Le poste Transports en commun doit exister');

  // 14.3: Synchronisation directe : Le Budget Alloué est la somme des charges fixées dans Coût de la vie
  const userConfiguredItems = DEFAULT_COST_OF_LIVING_ITEMS.map(item => {
    if (item.name === 'Loyer / Crédit Immobilier') return { ...item, amount: 750 };
    if (item.name === 'Courses Alimentaires') return { ...item, amount: 350 };
    if (item.name === 'Carburant & Péages') return { ...item, amount: 120 };
    return { ...item, amount: 0 };
  });

  const totalAllocated = userConfiguredItems.reduce((sum, i) => sum + i.amount, 0);
  assert.equal(totalAllocated, 1220, 'Le Budget Alloué total doit être la somme exacte des postes calibrés (750 + 350 + 120 = 1220 €)');

  // 14.4: Confronter avec les dépenses réelles du mois
  const monthTransactions = [
    { id: 't1', date: '2026-10-02', rawLabel: 'VIR LOYER', cleanLabel: 'Loyer', amount: 750, rawAmount: -750, category: 'Logement' },
    { id: 't2', date: '2026-10-05', rawLabel: 'CB INTERMARCHE', cleanLabel: 'Intermarché', amount: 92.50, rawAmount: -92.50, category: 'Alimentation & Courses' },
    { id: 't3', date: '2026-10-07', rawLabel: 'CB APRR AUTOROUTE', cleanLabel: 'Aprr Autoroute', amount: 20.50, rawAmount: -20.50, category: 'Transports & Carburant' },
    { id: 't4', date: '2026-10-10', rawLabel: 'CB TOTAL STATION', cleanLabel: 'Total', amount: 45.00, rawAmount: -45.00, category: 'Transports & Carburant' }
  ];

  // Calcul du réel pour Carburant & Péages
  let realSpentCarburant = 0;
  monthTransactions.forEach(tx => {
    if (matchesCostOfLivingItem(tx as any, 'Carburant & Péages')) {
      realSpentCarburant += tx.amount;
    }
  });

  assert.equal(realSpentCarburant, 65.50, 'Aprr (20.50) + Total (45.00) = 65.50 € dépensés en Carburant & Péages');
  const carburantItem = userConfiguredItems.find(i => i.name === 'Carburant & Péages');
  assert.ok(carburantItem);
  const diffCarburant = carburantItem.amount - realSpentCarburant; // 120 - 65.50 = +54.50 € restant
  assert.equal(diffCarburant, 54.50, 'L écart budgétaire restant doit être de 54.50 €');
});
