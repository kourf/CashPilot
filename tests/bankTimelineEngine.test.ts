import test from 'node:test';
import assert from 'node:assert';
import {
  generateTransactionHash,
  recalculerFriseChronologique
} from '../src/lib/bankTimelineEngine.ts';
import type {
  ReleveImporte,
  TransactionDocument
} from '../src/lib/bankTimelineEngine.ts';

test('DÉDUPLICATION PAR HASH : Génère un ID identique pour des doublons stricts ou avec variantes de casse/accents', () => {
  const tx1 = {
    date: '2026-03-15',
    libelle: 'PRLV SEPA NETFLIX 12345',
    montant: -17.99,
    compteId: 'compte_sg'
  };

  const tx2 = {
    date: '2026-03-15',
    libelle: '  prlv sepa netflix 12345  ',
    montant: -17.99,
    compteId: 'compte_sg'
  };

  const tx3AvecAccents = {
    date: '2026-03-15',
    libelle: 'Prlv Sépa Netflix 12345',
    montant: -17.99,
    compteId: 'compte_sg'
  };

  const hash1 = generateTransactionHash(tx1);
  const hash2 = generateTransactionHash(tx2);
  const hash3 = generateTransactionHash(tx3AvecAccents);

  assert.strictEqual(hash1, hash2, 'Les doublons avec espaces ou minuscules doivent avoir le même hash');
  assert.strictEqual(hash1, hash3, 'Les variantes avec accents doivent être normalisées vers le même hash');

  const txDifferente = {
    date: '2026-03-15',
    libelle: 'PRLV SEPA SPOTIFY',
    montant: -10.99,
    compteId: 'compte_sg'
  };
  const hashDiff = generateTransactionHash(txDifferente);
  assert.notStrictEqual(hash1, hashDiff, 'Deux opérations différentes doivent produire des hashes distincts');
});

test('RÈGLE 1 : Un CSV seul sans ancre ne doit JAMAIS produire de solde officiel (Solde non disponible)', () => {
  const relevesCsv: ReleveImporte[] = [
    {
      id: 'csv_mars_2026',
      source_type: 'CSV',
      nom_fichier: 'operations_mars_2026.csv',
      date_debut: '2026-03-01',
      date_fin: '2026-03-31',
      solde_initial: null,
      solde_final: null,
      total_mouvements: -450.50,
      nb_transactions: 3,
      createdAt: '2026-03-31T20:00:00Z'
    }
  ];

  const transactions: TransactionDocument[] = [
    {
      hash_deduplication: 'h1',
      date: '2026-03-05',
      libelle: 'Courses Monoprix',
      montant: -85.50,
      compteId: 'compte_test',
      createdAt: '2026-03-31T20:00:00Z'
    },
    {
      hash_deduplication: 'h2',
      date: '2026-03-10',
      libelle: 'Loyer Appartement',
      montant: -365.00,
      compteId: 'compte_test',
      createdAt: '2026-03-31T20:00:00Z'
    }
  ];

  const result = recalculerFriseChronologique('compte_test', relevesCsv, transactions);

  assert.strictEqual(result.segments.length, 1);
  const segment = result.segments[0];
  assert.strictEqual(segment.type, 'trou', 'Un CSV sans ancre antérieure doit être marqué en trou/non disponible');
  assert.strictEqual(segment.solde, null, 'Le solde officiel doit être null');
  assert.strictEqual(segment.total_mouvements, -450.50, 'Affiche uniquement le total des mouvements');
  assert.strictEqual(result.soldeActuel, null, 'Le solde actuel global doit être null');
  assert.match(segment.alerte_message || '', /Solde non disponible/i);
});

test('RÈGLE 2 : Un PDF crée une ancre de solde vérifiée avec priorité absolue', () => {
  const relevePdf: ReleveImporte[] = [
    {
      id: 'pdf_janvier_2026',
      source_type: 'PDF',
      nom_fichier: 'releve_sg_janvier.pdf',
      date_debut: '2026-01-01',
      date_fin: '2026-01-31',
      solde_initial: 1500.00,
      solde_final: 2100.00,
      total_mouvements: 600.00,
      nb_transactions: 1,
      createdAt: '2026-01-31T20:00:00Z'
    }
  ];

  const transactions: TransactionDocument[] = [
    {
      hash_deduplication: 'h_vir_salaire',
      date: '2026-01-28',
      libelle: 'Virement Salaire',
      montant: 600.00,
      compteId: 'compte_test',
      createdAt: '2026-01-31T20:00:00Z'
    }
  ];

  const result = recalculerFriseChronologique('compte_test', relevePdf, transactions);

  assert.strictEqual(result.segments.length, 1);
  const seg = result.segments[0];
  assert.strictEqual(seg.type, 'verifie', 'Le segment PDF doit être certifié');
  assert.strictEqual(seg.solde, 2100.00, 'Le solde final certifié doit être de 2100 €');
  assert.strictEqual(seg.solde_initial, 1500.00);
  assert.strictEqual(seg.ancre_id, 'pdf_janvier_2026');
  assert.strictEqual(result.soldeActuel, 2100.00);
  assert.strictEqual(result.typeSoldeActuel, 'verifie');
  assert.strictEqual(result.alertesRapprochement.length, 0);
});

test('RÈGLE 1 & 3 : Chaîne contiguë Ancre PDF + Segment CSV -> Calcul d un « Solde dérivé »', () => {
  const releves: ReleveImporte[] = [
    {
      id: 'pdf_janvier',
      source_type: 'PDF',
      nom_fichier: 'releve_janvier.pdf',
      date_debut: '2026-01-01',
      date_fin: '2026-01-31',
      solde_initial: 1000.00,
      solde_final: 1200.00,
      total_mouvements: 200.00,
      nb_transactions: 1,
      createdAt: '2026-01-31T20:00:00Z'
    },
    {
      id: 'csv_fevrier',
      source_type: 'CSV',
      nom_fichier: 'mouvements_fevrier.csv',
      date_debut: '2026-02-01',
      date_fin: '2026-02-28',
      solde_initial: null,
      solde_final: null,
      total_mouvements: -350.00,
      nb_transactions: 1,
      createdAt: '2026-02-28T20:00:00Z'
    }
  ];

  const transactions: TransactionDocument[] = [
    {
      hash_deduplication: 'h_jan',
      date: '2026-01-15',
      libelle: 'Prime',
      montant: 200.00,
      compteId: 'compte_test',
      createdAt: '2026-01-31T20:00:00Z'
    },
    {
      hash_deduplication: 'h_fev',
      date: '2026-02-10',
      libelle: 'Achats Carrefour',
      montant: -350.00,
      compteId: 'compte_test',
      createdAt: '2026-02-28T20:00:00Z'
    }
  ];

  const result = recalculerFriseChronologique('compte_test', releves, transactions);

  assert.strictEqual(result.segments.length, 2);
  
  // Segment 1 : PDF Janvier
  assert.strictEqual(result.segments[0].type, 'verifie');
  assert.strictEqual(result.segments[0].solde, 1200.00);

  // Segment 2 : CSV Février contigu
  assert.strictEqual(result.segments[1].type, 'derive', 'Le segment CSV doit produire un solde dérivé');
  assert.strictEqual(result.segments[1].solde_initial, 1200.00, 'Le solde initial du CSV provient de l ancre PDF');
  assert.strictEqual(result.segments[1].total_mouvements, -350.00);
  assert.strictEqual(result.segments[1].solde, 850.00, 'Solde dérivé = 1200 - 350 = 850 €');
  assert.strictEqual(result.segments[1].ancre_id, 'pdf_janvier');

  // Solde actuel
  assert.strictEqual(result.soldeActuel, 850.00);
  assert.strictEqual(result.typeSoldeActuel, 'derive');
});

test('RÈGLE 4 : Chevauchement et Écart de rapprochement (> 0.01 €)', () => {
  // Le PDF certifie Janvier : solde initial = 1000 €, solde final = 1500 € (delta attendu = +500 €)
  // Or les transactions réelles importées via CSV sur cette même période ne totalisent que +420 €
  // Écart = 80.00 € (> 0.01 €) -> Alerte de rapprochement obligatoire !
  const releves: ReleveImporte[] = [
    {
      id: 'pdf_janvier_incoherent',
      source_type: 'PDF',
      nom_fichier: 'releve_officiel.pdf',
      date_debut: '2026-01-01',
      date_fin: '2026-01-31',
      solde_initial: 1000.00,
      solde_final: 1500.00,
      total_mouvements: 500.00,
      nb_transactions: 1,
      createdAt: '2026-01-31T20:00:00Z'
    }
  ];

  const transactions: TransactionDocument[] = [
    {
      hash_deduplication: 'h_incomplet',
      date: '2026-01-20',
      libelle: 'Virement reçu incomplet',
      montant: 420.00,
      compteId: 'compte_test',
      createdAt: '2026-01-31T20:00:00Z'
    }
  ];

  const result = recalculerFriseChronologique('compte_test', releves, transactions);

  assert.strictEqual(result.segments.length, 1);
  const seg = result.segments[0];
  
  // Priorité absolue au solde PDF
  assert.strictEqual(seg.solde, 1500.00, 'Le solde officiel reste celui du PDF');
  assert.strictEqual(seg.ecart_rapprochement, 80.00, 'Un écart de 80.00 € doit être calculé');
  assert.strictEqual(result.alertesRapprochement.length, 1, 'Une alerte de rapprochement doit être déclenchée');
  assert.match(result.alertesRapprochement[0].message, /Écart de rapprochement de 80.00 €/);
});

test('RÈGLE 3 : Détection d un trou entre deux ancres et calcul de la variation inexpliquée', () => {
  // PDF 1 : Janvier (se termine le 2026-01-31 avec solde = 2000 €)
  // Février est manquant (aucun relevé du 2026-02-01 au 2026-02-28)
  // PDF 2 : Mars (commence le 2026-03-01 avec solde_initial = 2800 €)
  // Une opération de 300 € a été enregistrée en février
  // Variation inexpliquée = (2800 - 2000) - 300 = +500 €
  const releves: ReleveImporte[] = [
    {
      id: 'pdf_janvier',
      source_type: 'PDF',
      nom_fichier: 'janvier.pdf',
      date_debut: '2026-01-01',
      date_fin: '2026-01-31',
      solde_initial: 1800.00,
      solde_final: 2000.00,
      total_mouvements: 200.00,
      nb_transactions: 1,
      createdAt: '2026-01-31T20:00:00Z'
    },
    {
      id: 'pdf_mars',
      source_type: 'PDF',
      nom_fichier: 'mars.pdf',
      date_debut: '2026-03-01',
      date_fin: '2026-03-31',
      solde_initial: 2800.00,
      solde_final: 3100.00,
      total_mouvements: 300.00,
      nb_transactions: 1,
      createdAt: '2026-03-31T20:00:00Z'
    }
  ];

  const transactions: TransactionDocument[] = [
    {
      hash_deduplication: 'h_jan',
      date: '2026-01-10',
      libelle: 'Op Janvier',
      montant: 200.00,
      compteId: 'compte_test',
      createdAt: '2026-01-31T20:00:00Z'
    },
    {
      hash_deduplication: 'h_fev_isolee',
      date: '2026-02-14',
      libelle: 'Op Février isolée',
      montant: 300.00,
      compteId: 'compte_test',
      createdAt: '2026-02-14T20:00:00Z'
    },
    {
      hash_deduplication: 'h_mar',
      date: '2026-03-10',
      libelle: 'Op Mars',
      montant: 300.00,
      compteId: 'compte_test',
      createdAt: '2026-03-31T20:00:00Z'
    }
  ];

  const result = recalculerFriseChronologique('compte_test', releves, transactions);

  // 3 segments attendus : Janvier (vérifié), Trou Février (trou), Mars (vérifié)
  assert.strictEqual(result.segments.length, 3);
  
  const trouSeg = result.segments[1];
  assert.strictEqual(trouSeg.type, 'trou');
  assert.strictEqual(trouSeg.date_debut, '2026-02-01');
  assert.strictEqual(trouSeg.date_fin, '2026-02-28');
  assert.strictEqual(trouSeg.solde, null, 'Le solde du trou est non disponible');
  assert.strictEqual(trouSeg.total_mouvements, 300.00);
  assert.strictEqual(trouSeg.variation_inexpliquee, 500.00, 'Variation inexpliquée = (2800 - 2000) - 300 = 500 €');
  assert.strictEqual(result.trousDetectes.length, 1);
});

test('RE-CALCUL RÉTROACTIF : Un import dans le désordre chronologique recalcule toute la frise vers le futur', () => {
  // Scénario : L'utilisateur a d'abord importé un relevé CSV de Mars (sans ancre -> Solde non disponible).
  // Ensuite, il importe le relevé PDF certifié de Janvier (2000 €) et le CSV de Février (-400 €).
  // Le re-calcul rétroactif doit reclasser chronologiquement et calculer le solde dérivé jusqu'à Mars !

  const releveMarsCsv: ReleveImporte = {
    id: 'csv_mars',
    source_type: 'CSV',
    nom_fichier: 'mars.csv',
    date_debut: '2026-03-01',
    date_fin: '2026-03-31',
    solde_initial: null,
    solde_final: null,
    total_mouvements: -150.00,
    nb_transactions: 1,
    createdAt: '2026-03-31T20:00:00Z'
  };

  const txMars: TransactionDocument = {
    hash_deduplication: 'h_mar',
    date: '2026-03-12',
    libelle: 'Internet',
    montant: -150.00,
    compteId: 'compte_test',
    createdAt: '2026-03-31T20:00:00Z'
  };

  // Étape 1 : Mars seul -> non disponible
  const res1 = recalculerFriseChronologique('compte_test', [releveMarsCsv], [txMars]);
  assert.strictEqual(res1.segments[0].type, 'trou');
  assert.strictEqual(res1.soldeActuel, null);

  // Étape 2 : Import rétroactif du PDF de Janvier et du CSV de Février
  const releveJanvierPdf: ReleveImporte = {
    id: 'pdf_janvier',
    source_type: 'PDF',
    nom_fichier: 'janvier.pdf',
    date_debut: '2026-01-01',
    date_fin: '2026-01-31',
    solde_initial: 1800.00,
    solde_final: 2000.00,
    total_mouvements: 200.00,
    nb_transactions: 1,
    createdAt: '2026-01-31T20:00:00Z'
  };

  const releveFevrierCsv: ReleveImporte = {
    id: 'csv_fevrier',
    source_type: 'CSV',
    nom_fichier: 'fevrier.csv',
    date_debut: '2026-02-01',
    date_fin: '2026-02-28',
    solde_initial: null,
    solde_final: null,
    total_mouvements: -400.00,
    nb_transactions: 1,
    createdAt: '2026-02-28T20:00:00Z'
  };

  const txJan: TransactionDocument = {
    hash_deduplication: 'h_jan',
    date: '2026-01-15',
    libelle: 'Salaire',
    montant: 200.00,
    compteId: 'compte_test',
    createdAt: '2026-01-31T20:00:00Z'
  };

  const txFev: TransactionDocument = {
    hash_deduplication: 'h_fev',
    date: '2026-02-15',
    libelle: 'Courses',
    montant: -400.00,
    compteId: 'compte_test',
    createdAt: '2026-02-28T20:00:00Z'
  };

  // Re-calcul rétroactif avec les 3 relevés
  const allReleves = [releveMarsCsv, releveJanvierPdf, releveFevrierCsv]; // Fournis dans le désordre !
  const allTxs = [txMars, txJan, txFev];

  const res2 = recalculerFriseChronologique('compte_test', allReleves, allTxs);

  assert.strictEqual(res2.segments.length, 3);
  
  // 1. Janvier (Vérifié : 2000.00 €)
  assert.strictEqual(res2.segments[0].id, 'seg_pdf_janvier');
  assert.strictEqual(res2.segments[0].type, 'verifie');
  assert.strictEqual(res2.segments[0].solde, 2000.00);

  // 2. Février (Dérivé : 2000 - 400 = 1600.00 €)
  assert.strictEqual(res2.segments[1].id, 'seg_csv_fevrier');
  assert.strictEqual(res2.segments[1].type, 'derive');
  assert.strictEqual(res2.segments[1].solde, 1600.00);

  // 3. Mars (Dérivé rétroactivement : 1600 - 150 = 1450.00 €)
  assert.strictEqual(res2.segments[2].id, 'seg_csv_mars');
  assert.strictEqual(res2.segments[2].type, 'derive', 'Mars a été rétroactivement mis à jour en dérivé');
  assert.strictEqual(res2.segments[2].solde, 1450.00);
  assert.strictEqual(res2.segments[2].ancre_id, 'pdf_janvier');

  // Solde final actuel
  assert.strictEqual(res2.soldeActuel, 1450.00);
  assert.strictEqual(res2.typeSoldeActuel, 'derive');
});
