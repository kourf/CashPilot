import test from 'node:test';
import assert from 'node:assert';
import { 
  splitTextBySearchQuery,
  findSearchMatches,
  getNextMatchIndex,
  getPrevMatchIndex,
  filterConversations
} from '../src/lib/conversationSearchUtils.ts';

test('Moteur de Recherche Conversation - 1. Gestion des termes vides et nuls', () => {
  const text = "Bonjour, ceci est un message de test.";
  
  assert.deepStrictEqual(splitTextBySearchQuery(text, undefined), [{ text, isMatch: false }]);
  assert.deepStrictEqual(splitTextBySearchQuery(text, ''), [{ text, isMatch: false }]);
  assert.deepStrictEqual(splitTextBySearchQuery(text, '   '), [{ text, isMatch: false }]);
  assert.deepStrictEqual(splitTextBySearchQuery('', 'test'), []);
});

test('Moteur de Recherche Conversation - 2. Absence de correspondance', () => {
  const text = "Votre solde estimé est de 1500 €.";
  const result = splitTextBySearchQuery(text, 'inexistant');
  assert.deepStrictEqual(result, [{ text, isMatch: false }]);
});

test('Moteur de Recherche Conversation - 3. Détection et surlignage sensible à la casse (insensible à la casse, conserve graphie)', () => {
  const text = "Le budget Alimentation chez Carrefour est respecté.";
  const result = splitTextBySearchQuery(text, 'carrefour');
  
  assert.strictEqual(result.length, 3);
  assert.deepStrictEqual(result[0], { text: 'Le budget Alimentation chez ', isMatch: false });
  assert.deepStrictEqual(result[1], { text: 'Carrefour', isMatch: true });
  assert.deepStrictEqual(result[2], { text: ' est respecté.', isMatch: false });
});

test('Moteur de Recherche Conversation - 4. Résilience aux caractères spéciaux Regex (?, *, +, $, (, ), [, ], /, €)', () => {
  const text = "Abonnement Google One (2,99 €) avec la règle 50/30/20 ? C'est parfait !";
  
  // Test avec parenthèses
  const res1 = splitTextBySearchQuery(text, '(2,99 €)');
  assert.strictEqual(res1.length, 3);
  assert.strictEqual(res1[1].text, '(2,99 €)');
  assert.strictEqual(res1[1].isMatch, true);
  
  // Test avec point d'interrogation
  const res2 = splitTextBySearchQuery(text, '?');
  assert.strictEqual(res2.length, 3);
  assert.strictEqual(res2[1].text, '?');
  assert.strictEqual(res2[1].isMatch, true);
  
  // Test avec slash
  const res3 = splitTextBySearchQuery(text, '50/30/20');
  assert.strictEqual(res3.length, 3);
  assert.strictEqual(res3[1].text, '50/30/20');
  assert.strictEqual(res3[1].isMatch, true);

  // Test avec symbole monétaire
  const res4 = splitTextBySearchQuery(text, '€');
  const euroMatches = res4.filter(p => p.isMatch);
  assert.strictEqual(euroMatches.length, 1);
});

test('Moteur de Recherche Conversation - 5. Indexation multi-occurrences et navigation cyclique', () => {
  const messages = [
    { id: 'm1', content: 'Quel est mon budget alimentation ?' },
    { id: 'm2', content: 'Votre budget alimentation s élève à 400 €. L alimentation représente 20% de vos dépenses.' }
  ];

  const matches = findSearchMatches(messages, 'alimentation');

  // 1 occurrence dans m1, 2 occurrences dans m2 -> Total 3
  assert.strictEqual(matches.length, 3);
  assert.strictEqual(matches[0].messageId, 'm1');
  assert.strictEqual(matches[1].messageId, 'm2');
  assert.strictEqual(matches[2].messageId, 'm2');

  // Test navigation Suivant
  let currentIndex = 0;
  currentIndex = getNextMatchIndex(currentIndex, matches.length); // 1
  assert.strictEqual(currentIndex, 1);
  currentIndex = getNextMatchIndex(currentIndex, matches.length); // 2
  assert.strictEqual(currentIndex, 2);
  currentIndex = getNextMatchIndex(currentIndex, matches.length); // 0 (boucle)
  assert.strictEqual(currentIndex, 0);

  // Test navigation Précédent
  currentIndex = getPrevMatchIndex(currentIndex, matches.length); // 2 (boucle arrière)
  assert.strictEqual(currentIndex, 2);
  currentIndex = getPrevMatchIndex(currentIndex, matches.length); // 1
  assert.strictEqual(currentIndex, 1);
});

test('Moteur de Recherche Conversation - 6. Filtrage des discussions historiques par mot-clé', () => {
  const convs = [
    { id: 'c1', title: 'Audit Courses Intermarché', messages: [{ content: 'Voici les prix du lait.' }] },
    { id: 'c2', title: 'Projection Retraite & Épargne', messages: [{ content: 'Calcul du rendement Livret A.' }] },
    { id: 'c3', title: 'Abonnements', messages: [{ content: 'Détection du prélèvement Spotify et Netflix.' }] }
  ];

  // Recherche par mot présent dans le titre
  const r1 = filterConversations(convs, 'Intermarché');
  assert.strictEqual(r1.length, 1);
  assert.strictEqual(r1[0].id, 'c1');

  // Recherche par mot présent dans le corps d'un message
  const r2 = filterConversations(convs, 'Spotify');
  assert.strictEqual(r2.length, 1);
  assert.strictEqual(r2[0].id, 'c3');

  // Recherche vide retourne tout
  const r3 = filterConversations(convs, '');
  assert.strictEqual(r3.length, 3);

  // Recherche sans résultat
  const r4 = filterConversations(convs, 'Introuvable');
  assert.strictEqual(r4.length, 0);
});
