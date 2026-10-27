import test from 'node:test';
import assert from 'node:assert';
import { 
  buildFinancialProfile, 
  filterExpensesByDateRange, 
  buildCoachSystemContext,
  buildProductQueryPreAudit,
  ensureCompleteAuditResponse,
  detectDeterministicAdminAction,
  parseCoachResponseWithActions,
  COACH_MAX_OUTPUT_TOKENS
} from '../src/lib/coachFinancialEngine.ts';
import {
  enrichTransactionFallback,
  setInMemoryCustomRules
} from '../src/lib/kpiUtils.ts';
import type { Transaction } from '../src/lib/kpiUtils.ts';

test('Coach Financial Engine - Profil & Règle 50/30/20', async () => {
  const transactions: Transaction[] = [
    { date: '2026-03-01', monthKey: '2026-03', direction: 'debit', amount: -800, category: 'Logement', cleanLabel: 'Loyer', rawLabel: 'LOYER' },
    { date: '2026-03-02', monthKey: '2026-03', direction: 'debit', amount: -150, category: 'Alimentation & Supermarché', cleanLabel: 'Courses Carrefour', rawLabel: 'CARREFOUR' },
    { date: '2026-03-03', monthKey: '2026-03', direction: 'debit', amount: -50, category: 'Télécom', cleanLabel: 'Forfait Free', rawLabel: 'FREE MOBILE', isSubscription: true },
    { date: '2026-03-04', monthKey: '2026-03', direction: 'debit', amount: -80, category: 'Restaurants & Sorties', cleanLabel: 'Restaurant Le Bistro', rawLabel: 'RESTO BISTRO' },
    { date: '2026-03-05', monthKey: '2026-03', direction: 'debit', amount: -40, category: 'Shopping & Vêtements', cleanLabel: 'Zara', rawLabel: 'ZARA' },
    { date: '2026-03-06', monthKey: '2026-03', direction: 'debit', amount: -400, category: 'Épargne', cleanLabel: 'Virement Livret A', rawLabel: 'VIR LIVRET A' },
    { date: '2026-03-01', monthKey: '2026-03', direction: 'credit', amount: 2000, category: 'Salaire', cleanLabel: 'Salaire Mars', rawLabel: 'VIREMENT SALAIRE' }
  ];

  const profile = buildFinancialProfile(transactions, [], [], 'EUR');

  assert.strictEqual(profile.totalIncome, 2000);
  assert.strictEqual(profile.totalExpenses, 1120);
  assert.strictEqual(profile.netSavings, 880);

  assert.strictEqual(profile.rule503020.needs.actual, 1000);
  assert.strictEqual(profile.rule503020.needs.percentage, 50);
  assert.strictEqual(profile.rule503020.needs.targetAmount, 1000);
  assert.strictEqual(profile.rule503020.needs.status, 'optimal');

  assert.strictEqual(profile.rule503020.wants.actual, 120);
  assert.strictEqual(profile.rule503020.wants.percentage, 6);
  assert.strictEqual(profile.rule503020.wants.targetAmount, 600);

  assert.strictEqual(profile.rule503020.savings.actual, 400);
  assert.strictEqual(profile.rule503020.savings.percentage, 20);
  assert.strictEqual(profile.rule503020.savings.status, 'optimal');

  const rangeResult = filterExpensesByDateRange(transactions, '2026-03-02', '2026-03-04');
  assert.strictEqual(rangeResult.count, 3);
  assert.strictEqual(rangeResult.total, 280);

  const context = buildCoachSystemContext(profile, transactions, [], [], 'EUR');
  assert.ok(context.includes('Besoins (Cible 50%)'));
  assert.ok(context.includes('1000.00 €'));
  assert.ok(context.includes('Logement'));
  assert.ok(context.includes('GRAND LIVRE'));
});

test('Coach Financial Engine - Chantier 2 : Audit Direct & Réparation Anti-Troncature (8192 tokens)', async () => {
  assert.strictEqual(COACH_MAX_OUTPUT_TOKENS, 8192);

  const receipts = [
    {
      id: 'rcpt_1',
      userId: 'test_user',
      storeName: 'E.Leclerc - Ville-la-Grand',
      date: '2026-10-15',
      totalAmount: 45.50,
      createdAt: '2026-10-15T12:00:00Z',
      items: [
        {
          id: 'it_1',
          rawName: 'BAGUETTE TRADITION',
          normalizedName: 'Baguette tradition',
          brand: 'Générique',
          quantity: 2,
          unitPrice: 0.95,
          pricePaid: 1.90,
          category: 'Boulangerie & Pâtisserie',
          weightOrVolume: '250g',
          unit: 'pièce'
        },
        {
          id: 'it_2',
          rawName: 'POMMES GOLDEN BIO',
          normalizedName: 'Pommes Golden Bio',
          brand: 'Bio Village',
          quantity: 1,
          unitPrice: 2.49,
          pricePaid: 2.49,
          category: 'Fruits & Légumes',
          weightOrVolume: '1kg',
          unit: 'kg'
        }
      ]
    },
    {
      id: 'rcpt_3',
      userId: 'test_user',
      storeName: 'Lidl - Annemasse',
      date: '2026-10-20',
      totalAmount: 28.30,
      createdAt: '2026-10-20T10:00:00Z',
      items: [
        {
          id: 'it_4',
          rawName: 'BAGUETTE CROUSTILLE',
          normalizedName: 'Baguette croustille',
          brand: 'Lidl',
          quantity: 1,
          unitPrice: 0.85,
          pricePaid: 0.85,
          category: 'Boulangerie & Pâtisserie',
          weightOrVolume: '250g',
          unit: 'pièce'
        },
        {
          id: 'it_5',
          rawName: 'BANANES VRAC',
          normalizedName: 'Bananes',
          brand: 'Lidl',
          quantity: 1,
          unitPrice: 1.89,
          pricePaid: 1.89,
          category: 'Fruits & Légumes',
          weightOrVolume: '1kg',
          unit: 'kg'
        }
      ]
    }
  ];

  // Test 1: Pre-audit pour "combien j'achète mon pain ?"
  const painAudit = buildProductQueryPreAudit("combien j'achète mon pain ?", receipts as any, 'EUR');
  assert.ok(painAudit, 'Le pré-audit doit détecter la recherche sur le pain');
  assert.strictEqual(painAudit!.itemCount, 2);
  assert.strictEqual(painAudit!.cheapestPrice, 0.85);
  assert.strictEqual(painAudit!.cheapestStore, 'Lidl - Annemasse');
  assert.ok(painAudit!.directSynthesisText.includes('0.85 €'));
  assert.ok(painAudit!.markdownTable.includes('| Date | Enseigne | Produit & Marque | Quantité | Prix unitaire (€) | Prix total payé (€) |'));
  assert.ok(painAudit!.markdownTable.includes('Baguette tradition'));
  assert.ok(painAudit!.markdownTable.includes('Baguette croustille'));

  // Test 2: Simulation d'une réponse IA tronquée au milieu de l'en-tête du tableau Markdown
  const fruitsAudit = buildProductQueryPreAudit("à combien j'achète mes fruits ?", receipts as any, 'EUR');
  assert.ok(fruitsAudit, 'Le pré-audit doit détecter la recherche sur les fruits');
  const truncatedAiReply = `Voici le détail de vos achats de fruits :\n\n| Date | Enseigne | Produit & Marque`;
  const repairedReply = ensureCompleteAuditResponse(truncatedAiReply, fruitsAudit);

  // La réponse réparée doit contenir la Partie 1 (Synthèse directe) et la Partie 2 (Tableau Markdown complet)
  assert.ok(repairedReply.includes('1.89 €'), 'Doit inclure le prix le moins cher (Bananes Lidl 1.89 €)');
  assert.ok(repairedReply.includes('4.38 €'), 'Doit inclure le montant total dépensé en fruits (2.49 + 1.89 = 4.38 €)');
  assert.ok(repairedReply.includes('| Date | Enseigne | Produit & Marque | Quantité | Prix unitaire (€) | Prix total payé (€) |'));
  assert.ok(repairedReply.includes('Pommes Golden Bio'));
  assert.ok(repairedReply.includes('Bananes'));
});

test('Coach Financial Engine - Chantier 3 : Actions Administrateur, Cartes de Validation & Règles Personnalisées', async () => {
  const transactions: Transaction[] = [
    { id: 'tx_g1', date: '2026-10-05', monthKey: '2026-10', direction: 'debit', amount: -2.99, category: 'Abonnement & Télécom', cleanLabel: 'Google Services', rawLabel: 'PRLV GOOGLE 2.99' },
    { id: 'tx_g2', date: '2026-10-12', monthKey: '2026-10', direction: 'debit', amount: -10.99, category: 'Abonnement & Télécom', cleanLabel: 'Google Services', rawLabel: 'PRLV GOOGLE 10.99' }
  ];

  // Test détection d'une règle personnalisée pour distinguer Google 2.99€ de Google 10.99€
  const ruleAction = detectDeterministicAdminAction(
    "Le prélèvement Google de 2,99 € correspond à Google One Stockage",
    transactions,
    []
  );
  assert.ok(ruleAction, 'Doit générer une action CREATE_CUSTOM_RULE');
  assert.strictEqual(ruleAction!.actionType, 'CREATE_CUSTOM_RULE');
  assert.strictEqual(ruleAction!.payload.pattern, 'GOOGLE');
  assert.strictEqual(ruleAction!.payload.exactAmount, 2.99);

  // Test application de la règle personnalisée dans kpiUtils
  setInMemoryCustomRules([
    {
      id: 'rule_1',
      pattern: 'GOOGLE',
      exactAmount: 2.99,
      customLabel: 'Google One Stockage Cloud (200 Go)',
      category: 'Abonnements & Télécom',
      nature: 'fixe',
      isSubscription: true,
      createdAt: '2026-10-27T10:00:00Z'
    }
  ]);

  const enriched299 = enrichTransactionFallback({ ...transactions[0] });
  const enriched1099 = enrichTransactionFallback({ ...transactions[1] });

  assert.strictEqual(enriched299.cleanLabel, 'Google One Stockage Cloud (200 Go)');
  assert.notStrictEqual(enriched1099.cleanLabel, 'Google One Stockage Cloud (200 Go)');

  // Nettoyage mémoire
  setInMemoryCustomRules([]);

  // Test détection modification d'un budget dans "Budget et coût de la vie"
  const budgetAction = detectDeterministicAdminAction(
    "Fixe mon budget Courses Alimentaires à 450 €",
    transactions,
    []
  );
  assert.ok(budgetAction, 'Doit générer une action UPDATE_BUDGET');
  assert.strictEqual(budgetAction!.actionType, 'UPDATE_BUDGET');
  assert.strictEqual(budgetAction!.payload.newAmount, 450);

  // Test extraction d'un bloc JSON <PROPOSED_ACTION> depuis la réponse de l'IA
  const aiRawWithAction = `Bien sûr, je vous propose de mettre à jour votre budget.\n<PROPOSED_ACTION>{"actionType":"UPDATE_BUDGET","targetType":"budget","targetId":"courses","title":"Modifier le budget Courses","description":"Passage à 450 €","oldValues":{"Actuel":"350 €"},"newValues":{"Nouveau":"450 €"},"payload":{"budgetId":"courses","newAmount":450}}</PROPOSED_ACTION>`;
  const parsed = parseCoachResponseWithActions(aiRawWithAction, "Modifie mon budget", transactions, []);
  assert.ok(!parsed.cleanText.includes('PROPOSED_ACTION'), 'Le bloc JSON technique doit être retiré du texte affiché');
  assert.ok(parsed.proposedAction, 'La carte de validation doit être extraite');
  assert.strictEqual(parsed.proposedAction!.actionType, 'UPDATE_BUDGET');
  assert.strictEqual(parsed.proposedAction!.status, 'pending');
});
