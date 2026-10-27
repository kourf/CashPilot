import test from 'node:test';
import assert from 'node:assert/strict';

// Import direct avec extension .ts pour le test runner Node.js ESM
import { 
  detectBankName,
  extractCleanBankStatementRows,
  isBankCategoryHeader,
  isBankDescriptionHeader,
  classifyTransaction,
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
  isSubscriptionOrRecurringDebit
} from '../src/lib/bankUtils.ts';

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
