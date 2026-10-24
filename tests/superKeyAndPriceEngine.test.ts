import { describe, it } from 'node:test';
import assert from 'node:assert';
import { 
  generateSuperKey,
  type StandardizedProductDoc
} from '../src/types/receipts.ts';
import { 
  normalizeAisle,
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
});
