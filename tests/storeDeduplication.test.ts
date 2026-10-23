import { describe, it } from 'node:test';
import assert from 'node:assert';
import { 
  normalizeStoreName, 
  reconcileStoreWithExisting,
  buildComparativeMatrix 
} from '../src/lib/receiptClassifier.ts';
import { type Receipt } from '../src/types/receipts.ts';

describe('Audit & Déduplication des Enseignes (0 doublon garanti)', () => {
  it('1. Normalise et unifie toutes les variantes d Intermarché du bassin d Annemasse', () => {
    assert.strictEqual(normalizeStoreName('INTERMARCHE Vetraz-Monthoux'), 'Intermarché Annemasse');
    assert.strictEqual(normalizeStoreName('Intermarche Gaillard'), 'Intermarché Annemasse');
    assert.strictEqual(normalizeStoreName('INTERMARCHE ANNEMASSE'), 'Intermarché Annemasse');
    assert.strictEqual(normalizeStoreName('Intermarché - Rue de Genève 74100 Annemasse'), 'Intermarché Annemasse');
  });

  it('2. Normalise canoniquement E.Leclerc Ville-la-Grand', () => {
    assert.strictEqual(normalizeStoreName('E.LECLERC VILLE LA GRAND'), 'E.Leclerc Ville-la-Grand');
    assert.strictEqual(normalizeStoreName('Leclerc Ville-la-Grand'), 'E.Leclerc Ville-la-Grand');
    assert.strictEqual(normalizeStoreName('E.Leclerc - 74100 Ville-la-Grand'), 'E.Leclerc Ville-la-Grand');
  });

  it('3. Normalise canoniquement Lidl Annemasse', () => {
    assert.strictEqual(normalizeStoreName('LIDL ANNEMASSE'), 'Lidl Annemasse');
    assert.strictEqual(normalizeStoreName('Lidl - 74100 Annemasse'), 'Lidl Annemasse');
  });

  it('4. Normalise canoniquement Super U Etrembières', () => {
    assert.strictEqual(normalizeStoreName('SUPER U ETREMBIERES'), 'Super U Etrembières');
    assert.strictEqual(normalizeStoreName('Super U Etrembi res'), 'Super U Etrembières');
  });

  it('5. Rapprochement avec magasins existants (reconcileStoreWithExisting)', () => {
    const existing = [
      'E.Leclerc Ville-la-Grand',
      'Lidl Annemasse',
      'Intermarché Annemasse',
      'Super U Etrembières'
    ];

    assert.strictEqual(reconcileStoreWithExisting('intermarche vetraz', existing), 'Intermarché Annemasse');
    assert.strictEqual(reconcileStoreWithExisting('LIDL', existing), 'Lidl Annemasse');
    assert.strictEqual(reconcileStoreWithExisting('E.Leclerc Ville la Grand', existing), 'E.Leclerc Ville-la-Grand');
    assert.strictEqual(reconcileStoreWithExisting('Super U Etrembieres', existing), 'Super U Etrembières');
    // Nouveau magasin réel
    assert.strictEqual(reconcileStoreWithExisting('Carrefour Market Annecy', existing), 'Carrefour Market Annecy');
  });

  it('6. Matrice comparative : Génère une seule colonne par enseigne réelle sans doublon', () => {
    const mockReceipts: Receipt[] = [
      {
        id: 'r1',
        userId: 'u1',
        storeName: 'Intermarche Vetraz',
        date: '2026-10-18',
        totalAmount: 20,
        items: [{ id: '1', rawName: 'Lait demi-écrémé 1L', normalizedName: 'Lait demi-écrémé', pricePaid: 1.10, quantity: 1, category: 'Produits frais & Crèmerie', unitPrice: 1.10, unit: 'L' }]
      },
      {
        id: 'r2',
        userId: 'u1',
        storeName: 'Intermarché Gaillard',
        date: '2026-10-19',
        totalAmount: 25,
        items: [{ id: '2', rawName: 'Lait demi-écrémé 1L', normalizedName: 'Lait demi-écrémé', pricePaid: 1.15, quantity: 1, category: 'Produits frais & Crèmerie', unitPrice: 1.15, unit: 'L' }]
      },
      {
        id: 'r3',
        userId: 'u1',
        storeName: 'E.Leclerc Ville-la-Grand',
        date: '2026-10-20',
        totalAmount: 30,
        items: [{ id: '3', rawName: 'Lait demi-écrémé 1L', normalizedName: 'Lait demi-écrémé', pricePaid: 1.05, quantity: 1, category: 'Produits frais & Crèmerie', unitPrice: 1.05, unit: 'L' }]
      }
    ];

    const matrix = buildComparativeMatrix(mockReceipts);
    // Seulement 2 enseignes uniques attendues : "E.Leclerc Ville-la-Grand" et "Intermarché Annemasse"
    assert.strictEqual(matrix.stores.length, 2);
    assert.deepStrictEqual(matrix.stores, ['E.Leclerc Ville-la-Grand', 'Intermarché Annemasse']);
  });
});
