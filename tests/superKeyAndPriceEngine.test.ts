import { describe, it } from 'node:test';
import assert from 'node:assert';
import { 
  generateSuperKey,
  generateGenericNeedKey,
  correctFrenchSpelling,
  type StandardizedProductDoc,
  type GenericProductDoc
} from '../src/types/receipts.ts';
import { 
  normalizeAisle,
  buildComparativeMatrix,
  buildComparativeMatrixFromProducts
} from '../src/lib/receiptClassifier.ts';

describe('Audit Financier : Super Clé Universelle & Matrice Comparative 0 €', () => {
  it('1. Génère la Super Clé au format strict [marque]_[nom_generique]_[poids_ou_volume]', () => {
    // Danone Actimel Fraise 8x100g
    const key1 = generateSuperKey('Danone', 'Actimel fraise', '8x100g');
    assert.strictEqual(key1, 'danone_actimel_fraise_8x100g');

    // Nettoyage des accents et caractères spéciaux
    const key2 = generateSuperKey('Coca-Cola', 'Sans sucres — Bouteille', '1.5 L');
    assert.strictEqual(key2, 'coca_cola_sans_sucres_bouteille_1_5_l');

    // Panzani Coquillettes 500g
    const key3 = generateSuperKey('Panzani', 'Coquillettes cuisson rapide', '500g');
    assert.strictEqual(key3, 'panzani_coquillettes_cuisson_rapide_500g');
  });

  it('2. Règle des produits Génériques : Affecte marque = "generique" pour produits frais ou sans marque', () => {
    // Pommes de terre 5kg sans marque explicite
    const key1 = generateSuperKey('', 'Pommes de terre', '5kg');
    assert.strictEqual(key1, 'generique_pommes_de_terre_5kg');

    // Primeur / fruits & légumes
    const key2 = generateSuperKey('Primeur', 'Courgettes rondes', '0.420 kg');
    assert.strictEqual(key2, 'generique_courgettes_rondes_0_420_kg');

    // Boucherie traditionnelle en vrac
    const key3 = generateSuperKey('Vrac', 'Steak hache 15%', '250g');
    assert.strictEqual(key3, 'generique_steak_hache_15_250g');
  });

  it('3. Règle des 14 rayons verrouillés : Normalise strictement toute saisie vers les catégories officielles', () => {
    const r1 = normalizeAisle('fruits_legumes');
    assert.strictEqual(r1.label, 'Fruits & Légumes');

    const r2 = normalizeAisle('Boucherie');
    assert.strictEqual(r2.label, 'Boucherie, Volaille & Poissonnerie');

    const r3 = normalizeAisle('Produits d\'entretien');
    assert.strictEqual(r3.label, 'Entretien & Maison');

    const r4 = normalizeAisle('Category inconnue xyz');
    assert.strictEqual(r4.label, 'Autres / Divers');
  });

  it('4. Construit la Matrice Comparative directement depuis les StandardizedProductDoc avec coût Firestore = 0', () => {
    const mockProducts: StandardizedProductDoc[] = [
      {
        superKey: 'generique_pommes_de_terre_5kg',
        marque: 'Générique',
        nom_generique: 'Pommes de terre',
        poids_ou_volume: '5kg',
        unite_mesure: 'kg',
        rayon_assigne: 'Fruits & Légumes',
        rayon_cle: 'fruits_legumes',
        prix_actuel: {
          intermarche_gaillard: {
            prix_unitaire: 0.99,
            prix_paye: 4.95,
            quantite: 1,
            date: '2026-10-18',
            magasin_id: 'intermarche_gaillard',
            magasin_nom: 'Intermarché - Gaillard',
            receiptId: 'rec-1'
          },
          lidl_annemasse: {
            prix_unitaire: 0.79,
            prix_paye: 3.95,
            quantite: 1,
            date: '2026-10-20',
            magasin_id: 'lidl_annemasse',
            magasin_nom: 'Lidl Annemasse',
            receiptId: 'rec-2'
          }
        },
        historique_prix: [
          {
            date: '2026-10-18',
            magasin: 'intermarche_gaillard',
            magasin_nom: 'Intermarché - Gaillard',
            prix_unitaire: 0.99,
            prix_paye: 4.95,
            quantite: 1,
            receiptId: 'rec-1'
          },
          {
            date: '2026-10-20',
            magasin: 'lidl_annemasse',
            magasin_nom: 'Lidl Annemasse',
            prix_unitaire: 0.79,
            prix_paye: 3.95,
            quantite: 1,
            receiptId: 'rec-2'
          }
        ],
        derniere_mise_a_jour: '2026-10-20T10:00:00Z',
        nombre_releves: 2
      }
    ];

    const matrix = buildComparativeMatrixFromProducts(mockProducts, [], 2);

    assert.strictEqual(matrix.stores.length, 2);
    assert.strictEqual(matrix.totalUniqueProducts, 1);
    assert.strictEqual(matrix.totalComparableProducts, 1);
    
    // Écart de prix calculé au kilo : 0.99 - 0.79 = 0.20 €/kg
    assert.strictEqual(matrix.totalPotentialSavings, 0.20);

    const fruitsGroup = matrix.aisleGroups.find(g => g.key === 'fruits_legumes');
    assert.ok(fruitsGroup, 'Groupe Fruits & Légumes présent');
    assert.strictEqual(fruitsGroup.products.length, 1);
    assert.strictEqual(fruitsGroup.products[0].lowestUnitPrice, 0.79);
    assert.strictEqual(fruitsGroup.products[0].highestUnitPrice, 0.99);
    assert.strictEqual(fruitsGroup.products[0].cheapestStore, 'Lidl - Annemasse');
  });

  it('5. Clé de Besoin Générique : Isole le besoin brut et regroupe des marques/formats différents (ex: Sauce burger)', () => {
    // "Sauce burger Super U" -> "sauce_burger"
    const key1 = generateGenericNeedKey('Sauce burger Super U', 'Super U');
    assert.strictEqual(key1, 'sauce_burger');

    // "Sauce burger flacon souple 510g Leclerc" -> "sauce_burger"
    const key2 = generateGenericNeedKey('Sauce burger flacon souple 510g Leclerc', 'Marque Repère');
    assert.strictEqual(key2, 'sauce_burger');

    // Sans paramètre de marque explicite
    const key3 = generateGenericNeedKey('Sauce burger flacon souple 510g');
    assert.strictEqual(key3, 'sauce_burger');

    // Autre exemple : lait demi-écrémé brique 1L
    const key4 = generateGenericNeedKey('Lait demi-écrémé brique 1L', 'Candia');
    assert.strictEqual(key4, 'lait_demi_ecreme');
  });

  it('6. Matrice Comparative : Regroupe sous un document unique à Clé de Besoin Générique et structure offres_magasins', () => {
    const genericDocs: any[] = [
      {
        nom_generique: 'Sauce Burger',
        rayon: 'Épicerie salée & Épices',
        rayon_cle: 'epicerie_salee',
        cle_besoin: 'sauce_burger',
        offres_magasins: {
          super_u_etrembieres: {
            prix_unitaire: 4.58,
            unite: 'kg',
            prix_paye: 2.29,
            marque: 'Super U',
            format: '500g',
            date: '2026-10-18',
            magasin_nom: 'Super U Étrembières',
            magasin_id: 'super_u_etrembieres'
          },
          leclerc_ville_la_grand: {
            prix_unitaire: 4.10,
            unite: 'kg',
            prix_paye: 2.09,
            marque: 'Marque Repère',
            format: '510g',
            date: '2026-10-24',
            magasin_nom: 'E.Leclerc Ville-la-Grand',
            magasin_id: 'leclerc_ville_la_grand'
          }
        },
        meilleure_offre: {
          magasin_id: 'leclerc_ville_la_grand',
          magasin_nom: 'E.Leclerc - Ville-la-Grand',
          prix_unitaire: 4.10,
          unite: 'kg'
        },
        derniere_mise_a_jour: '2026-10-24T18:00:00Z',
        nombre_releves: 2
      }
    ];

    const matrix = buildComparativeMatrixFromProducts(genericDocs, [], 2);

    assert.strictEqual(matrix.stores.length, 2);
    assert.strictEqual(matrix.totalUniqueProducts, 1);
    assert.strictEqual(matrix.totalComparableProducts, 1);

    const epicerieGroup = matrix.aisleGroups.find(g => g.key === 'epicerie_salee');
    assert.ok(epicerieGroup, 'Groupe Épicerie salée présent');
    assert.strictEqual(epicerieGroup.products.length, 1);

    const row = epicerieGroup.products[0];
    assert.strictEqual(row.normalizedName, 'Sauce Burger');
    assert.strictEqual(row.status, 'COMPARABLE');
    assert.strictEqual(row.lowestUnitPrice, 4.10);
    assert.strictEqual(row.highestUnitPrice, 4.58);
    // Écart de prix : 4.58 - 4.10 = 0.48 €/kg
    assert.strictEqual(row.unitPriceDifference, 0.48);
    assert.ok(row.sampleBrands.includes('Super U'));
    assert.ok(row.sampleBrands.includes('Marque Repère'));
  });

  it('7. Intégrité des offres : Recalcul de la meilleure offre lors de la mise à jour ou suppression d\'un ticket', () => {
    const productDoc = {
      nom_generique: 'Lait demi-écrémé',
      rayon: 'Produits frais & Crèmerie',
      rayon_cle: 'frais_cremerie',
      cle_besoin: 'lait_demi_ecreme',
      offres_magasins: {
        intermarche_gaillard: {
          prix_unitaire: 1.15,
          unite: 'L',
          prix_paye: 1.15,
          marque: 'Candia',
          format: '1L',
          date: '2026-10-20',
          magasin_nom: 'Intermarché - Gaillard',
          magasin_id: 'intermarche_gaillard',
          receiptId: 'rec-1'
        },
        leclerc_ville_la_grand: {
          prix_unitaire: 1.05,
          unite: 'L',
          prix_paye: 1.05,
          marque: 'Marque Repère',
          format: '1L',
          date: '2026-10-21',
          magasin_nom: 'E.Leclerc Ville-la-Grand',
          magasin_id: 'leclerc_ville_la_grand',
          receiptId: 'rec-2'
        }
      }
    };

    // Initialement, Leclerc est le moins cher à 1.05 €/L
    let matrix = buildComparativeMatrixFromProducts([productDoc as any], [], 2);
    let row = matrix.aisleGroups.find(g => g.key === 'frais_cremerie')!.products[0];
    assert.strictEqual(row.lowestUnitPrice, 1.05);
    assert.strictEqual(row.cheapestStore, 'E.Leclerc - Ville-la-Grand');

    // Si on supprime le ticket de Leclerc (rec-2), seule l'offre d'Intermarché subsiste
    delete (productDoc.offres_magasins as any).leclerc_ville_la_grand;
    matrix = buildComparativeMatrixFromProducts([productDoc as any], [], 1);
    row = matrix.aisleGroups.find(g => g.key === 'frais_cremerie')!.products[0];
    assert.strictEqual(row.status, 'UNIQUE');
    assert.strictEqual(row.storePrices['Intermarché - Gaillard'].pricePaid, 1.15);
    assert.strictEqual(row.storePrices['Intermarché - Gaillard'].unitPrice, 1.15);
  });

  it('8. Règle vitale d\'orthographe : Corrige systématiquement les erreurs OCR et accents français', () => {
    // "B Uf" -> "Bœuf"
    assert.strictEqual(correctFrenchSpelling('b uf'), 'Bœuf');
    assert.strictEqual(correctFrenchSpelling('B Uf'), 'Bœuf');
    assert.strictEqual(correctFrenchSpelling('boeuf hache'), 'Bœuf haché');

    // "Steack" -> "Steak"
    assert.strictEqual(correctFrenchSpelling('steack'), 'Steak');

    // "Pomm terre" -> "Pommes de terre"
    assert.strictEqual(correctFrenchSpelling('pomm terre'), 'Pommes de terre');
    assert.strictEqual(correctFrenchSpelling('pomme de terre'), 'Pommes de terre');

    // Accents français manquants
    assert.strictEqual(correctFrenchSpelling('creme fraiche'), 'Crème fraîche');
    assert.strictEqual(correctFrenchSpelling('pate feuilletee'), 'Pâte feuilletée');
    assert.strictEqual(correctFrenchSpelling('lait ecreme'), 'Lait écrémé');
    assert.strictEqual(correctFrenchSpelling('poulet roti'), 'Poulet rôti');
    assert.strictEqual(correctFrenchSpelling('oeufs bio'), 'Œufs bio');
  });

  it('9. Nouvelle Structure Firestore : Vérifie la structure historique_prix [{ date, magasin, prix_unitaire }]', () => {
    const docWithPriceHistory: GenericProductDoc = {
      nom_generique: 'Sauce Burger',
      rayon: 'Épicerie salée & Épices',
      cle_besoin: 'sauce_burger',
      offres_magasins: {
        super_u_etrembieres: {
          prix_unitaire: 4.58,
          unite: 'kg',
          prix_paye: 2.29,
          marque: 'Super U',
          format: '500g',
          date: '2026-10-18'
        },
        leclerc_ville_la_grand: {
          prix_unitaire: 4.10,
          unite: 'kg',
          prix_paye: 2.09,
          marque: 'Marque Repère',
          format: '510g',
          date: '2026-10-24'
        }
      },
      historique_prix: [
        { date: '2026-10-18', magasin: 'super_u_etrembieres', prix_unitaire: 4.58 },
        { date: '2026-10-24', magasin: 'leclerc_ville_la_grand', prix_unitaire: 4.10 }
      ]
    };

    assert.strictEqual(docWithPriceHistory.nom_generique, 'Sauce Burger');
    assert.strictEqual(docWithPriceHistory.rayon, 'Épicerie salée & Épices');
    assert.strictEqual(docWithPriceHistory.offres_magasins.super_u_etrembieres.prix_unitaire, 4.58);
    assert.strictEqual(docWithPriceHistory.offres_magasins.leclerc_ville_la_grand.prix_unitaire, 4.10);

    // Vérification stricte du tableau historique_prix
    assert.ok(Array.isArray(docWithPriceHistory.historique_prix));
    assert.strictEqual(docWithPriceHistory.historique_prix.length, 2);
    assert.strictEqual(docWithPriceHistory.historique_prix[1].date, '2026-10-24');
    assert.strictEqual(docWithPriceHistory.historique_prix[1].magasin, 'leclerc_ville_la_grand');
    assert.strictEqual(docWithPriceHistory.historique_prix[1].prix_unitaire, 4.10);
  });
});
