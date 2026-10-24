import { describe, it } from 'node:test';
import assert from 'node:assert';
import { 
  normalizeStoreName, 
  reconcileStoreWithExisting,
  buildComparativeMatrix 
} from '../src/lib/receiptClassifier.ts';
import { type Receipt } from '../src/types/receipts.ts';

describe('Audit & Différenciation des 3 Intermarché et Déduplication des Enseignes (0 doublon garanti)', () => {
  it('1. Différencie rigoureusement les 3 magasins Intermarché ciblés autour d Annemasse', () => {
    // Intermarché Gaillard (Rue René Cassin)
    assert.strictEqual(normalizeStoreName('Intermarche Gaillard'), 'Intermarché - Gaillard');
    assert.strictEqual(normalizeStoreName('INTERMARCHE', '5 Rue René Cassin 74240 Gaillard'), 'Intermarché - Gaillard');

    // Intermarché Hyper Annemasse (Rue de la Résistance / Thonon)
    assert.strictEqual(normalizeStoreName('INTERMARCHE ANNEMASSE'), 'Intermarché - Annemasse');
    assert.strictEqual(normalizeStoreName('INTERMARCHE', '14 Rue de la Résistance 74100 Annemasse'), 'Intermarché - Annemasse');

    // Intermarché Ville-la-Grand / Vétraz-Monthoux (Rue des Teppes / Érables)
    assert.strictEqual(normalizeStoreName('INTERMARCHE Vetraz-Monthoux'), 'Intermarché - Ville-la-Grand');
    assert.strictEqual(normalizeStoreName('Intermarché Ville-la-Grand'), 'Intermarché - Ville-la-Grand');
    assert.strictEqual(normalizeStoreName('INTERMARCHE', '17 Rue des Teppes 74100 Vetraz-Monthoux'), 'Intermarché - Ville-la-Grand');
  });

  it('2. Normalise canoniquement E.Leclerc Ville-la-Grand', () => {
    assert.strictEqual(normalizeStoreName('E.LECLERC VILLE LA GRAND'), 'E.Leclerc - Ville-la-Grand');
    assert.strictEqual(normalizeStoreName('Leclerc Ville-la-Grand'), 'E.Leclerc - Ville-la-Grand');
    assert.strictEqual(normalizeStoreName('E.Leclerc - 74100 Ville-la-Grand'), 'E.Leclerc - Ville-la-Grand');
  });

  it('3. Normalise canoniquement Lidl Annemasse', () => {
    assert.strictEqual(normalizeStoreName('LIDL ANNEMASSE'), 'Lidl - Annemasse');
    assert.strictEqual(normalizeStoreName('Lidl - 74100 Annemasse'), 'Lidl - Annemasse');
  });

  it('4. Normalise canoniquement Super U Étrembières', () => {
    assert.strictEqual(normalizeStoreName('SUPER U ETREMBIERES'), 'Super U - Étrembières');
    assert.strictEqual(normalizeStoreName('Super U Etrembi res'), 'Super U - Étrembières');
  });

  it('5. Normalise canoniquement Carrefour Market Annemasse', () => {
    assert.strictEqual(normalizeStoreName('Carrefour Market Annemasse'), 'Carrefour Market Annemasse');
    assert.strictEqual(normalizeStoreName('CARREFOUR MARKET', '14 Rue du Faucigny 74100 Annemasse'), 'Carrefour Market Annemasse');
  });

  it('6. Rapprochement avec magasins existants (reconcileStoreWithExisting)', () => {
    const existing = [
      'E.Leclerc - Ville-la-Grand',
      'Lidl - Annemasse',
      'Intermarché - Annemasse',
      'Intermarché - Gaillard',
      'Intermarché - Ville-la-Grand',
      'Super U - Étrembières',
      'Carrefour Market Annemasse'
    ];

    assert.strictEqual(reconcileStoreWithExisting('intermarche gaillard', existing), 'Intermarché - Gaillard');
    assert.strictEqual(reconcileStoreWithExisting('intermarche vetraz', existing), 'Intermarché - Ville-la-Grand');
    assert.strictEqual(reconcileStoreWithExisting('LIDL', existing), 'Lidl - Annemasse');
    assert.strictEqual(reconcileStoreWithExisting('E.Leclerc Ville la Grand', existing), 'E.Leclerc - Ville-la-Grand');
    assert.strictEqual(reconcileStoreWithExisting('Super U Etrembieres', existing), 'Super U - Étrembières');
    assert.strictEqual(reconcileStoreWithExisting('Carrefour Market Chablais', existing), 'Carrefour Market Annemasse');
    // Nouveau magasin réel hors référentiel
    assert.strictEqual(reconcileStoreWithExisting('Carrefour Market Annecy', existing), 'Carrefour Market Annecy');
  });

  it('7. Matrice comparative : Génère des colonnes distinctes pour chaque Intermarché physique', () => {
    const mockReceipts: Receipt[] = [
      {
        id: 'r1',
        userId: 'u1',
        storeName: 'Intermarché - Ville-la-Grand',
        storeId: 'intermarche_ville_la_grand',
        date: '2026-10-18',
        totalAmount: 20,
        items: [{ id: '1', rawName: 'Lait demi-écrémé 1L', normalizedName: 'Lait demi-écrémé', pricePaid: 1.10, quantity: 1, category: 'Produits frais & Crèmerie', unitPrice: 1.10, unit: 'L' }]
      },
      {
        id: 'r2',
        userId: 'u1',
        storeName: 'Intermarché - Gaillard',
        storeId: 'intermarche_gaillard',
        date: '2026-10-19',
        totalAmount: 25,
        items: [{ id: '2', rawName: 'Lait demi-écrémé 1L', normalizedName: 'Lait demi-écrémé', pricePaid: 1.15, quantity: 1, category: 'Produits frais & Crèmerie', unitPrice: 1.15, unit: 'L' }]
      },
      {
        id: 'r3',
        userId: 'u1',
        storeName: 'Intermarché - Annemasse',
        storeId: 'intermarche_annemasse',
        date: '2026-10-20',
        totalAmount: 22,
        items: [{ id: '3', rawName: 'Lait demi-écrémé 1L', normalizedName: 'Lait demi-écrémé', pricePaid: 1.08, quantity: 1, category: 'Produits frais & Crèmerie', unitPrice: 1.08, unit: 'L' }]
      },
      {
        id: 'r4',
        userId: 'u1',
        storeName: 'E.Leclerc - Ville-la-Grand',
        storeId: 'leclerc_ville_la_grand',
        date: '2026-10-21',
        totalAmount: 30,
        items: [{ id: '4', rawName: 'Lait demi-écrémé 1L', normalizedName: 'Lait demi-écrémé', pricePaid: 1.05, quantity: 1, category: 'Produits frais & Crèmerie', unitPrice: 1.05, unit: 'L' }]
      }
    ];

    const matrix = buildComparativeMatrix(mockReceipts);
    // 4 colonnes distinctes attendues : Leclerc + 3 Intermarché physiques séparés
    assert.strictEqual(matrix.stores.length, 4);
    assert.ok(matrix.stores.includes('Intermarché - Gaillard'));
    assert.ok(matrix.stores.includes('Intermarché - Annemasse'));
    assert.ok(matrix.stores.includes('Intermarché - Ville-la-Grand'));
    assert.ok(matrix.stores.includes('E.Leclerc - Ville-la-Grand'));

    // Vérification des métadonnées du magasin
    assert.ok(matrix.storeMetadata);
    assert.strictEqual(matrix.storeMetadata['Intermarché - Gaillard'].id, 'intermarche_gaillard');
    assert.strictEqual(matrix.storeMetadata['Intermarché - Annemasse'].id, 'intermarche_annemasse');
    assert.strictEqual(matrix.storeMetadata['Intermarché - Ville-la-Grand'].id, 'intermarche_ville_la_grand');

    // Vérification de la comparaison de prix sur l'article unique
    const allProducts = matrix.aisleGroups.flatMap(g => g.products);
    const row = allProducts.find(r => r.normalizedName === 'Lait demi-écrémé');
    assert.ok(row);
    assert.strictEqual(row.storePrices['Intermarché - Annemasse'].pricePaid, 1.08);
    assert.strictEqual(row.storePrices['Intermarché - Ville-la-Grand'].pricePaid, 1.10);
    assert.strictEqual(row.storePrices['Intermarché - Gaillard'].pricePaid, 1.15);
    assert.strictEqual(row.storePrices['E.Leclerc - Ville-la-Grand'].pricePaid, 1.05);

    // Le moins cher parmi les Intermarché est Annemasse (1.08 €)
    const intermarchePrices = [
      row.storePrices['Intermarché - Annemasse'].pricePaid,
      row.storePrices['Intermarché - Ville-la-Grand'].pricePaid,
      row.storePrices['Intermarché - Gaillard'].pricePaid
    ];
    assert.strictEqual(Math.min(...intermarchePrices), 1.08);
  });
});
