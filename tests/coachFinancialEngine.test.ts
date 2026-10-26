import test from 'node:test';
import assert from 'node:assert';
import { 
  buildFinancialProfile, 
  filterExpensesByDateRange, 
  buildCoachSystemContext 
} from '../src/lib/coachFinancialEngine.ts';
import type { Transaction } from '../src/lib/kpiUtils.ts';

test('Coach Financial Engine - Profil & Règle 50/30/20', async (t) => {
  const transactions: Transaction[] = [
    { date: '2026-03-01', amount: -800, category: 'Logement', cleanLabel: 'Loyer', rawLabel: 'LOYER' },
    { date: '2026-03-02', amount: -150, category: 'Alimentation & Supermarché', cleanLabel: 'Courses Carrefour', rawLabel: 'CARREFOUR' },
    { date: '2026-03-03', amount: -50, category: 'Télécom', cleanLabel: 'Forfait Free', rawLabel: 'FREE MOBILE', isSubscription: true },
    { date: '2026-03-04', amount: -80, category: 'Restaurants & Sorties', cleanLabel: 'Restaurant Le Bistro', rawLabel: 'RESTO BISTRO' },
    { date: '2026-03-05', amount: -40, category: 'Shopping & Vêtements', cleanLabel: 'Zara', rawLabel: 'ZARA' },
    { date: '2026-03-06', amount: -400, category: 'Épargne', cleanLabel: 'Virement Livret A', rawLabel: 'VIR LIVRET A' },
    { date: '2026-03-01', amount: 2000, category: 'Salaire', cleanLabel: 'Salaire Mars', rawLabel: 'VIREMENT SALAIRE' }
  ];

  const profile = buildFinancialProfile(transactions, [], [], 'EUR');

  // Total revenus = 2000 €
  assert.strictEqual(profile.totalIncome, 2000);
  // Total dépenses de consommation (hors épargne) = 800 + 150 + 50 + 80 + 40 = 1120 €
  assert.strictEqual(profile.totalExpenses, 1120);
  assert.strictEqual(profile.netSavings, 880);

  // 50/30/20 Checks
  // Besoins = Logement (800) + Alimentation (150) + Télécom (50) = 1000 € (50% pile de 2000 €)
  assert.strictEqual(profile.rule503020.needs.actual, 1000);
  assert.strictEqual(profile.rule503020.needs.percentage, 50);
  assert.strictEqual(profile.rule503020.needs.targetAmount, 1000);
  assert.strictEqual(profile.rule503020.needs.status, 'optimal');

  // Envies = Restaurants (80) + Shopping (40) = 120 € (6% de 2000 €, cible 30% = 600 €)
  assert.strictEqual(profile.rule503020.wants.actual, 120);
  assert.strictEqual(profile.rule503020.wants.percentage, 6);
  assert.strictEqual(profile.rule503020.wants.targetAmount, 600);

  // Épargne = 400 € (20% pile de 2000 €, cible 20% = 400 €)
  assert.strictEqual(profile.rule503020.savings.actual, 400);
  assert.strictEqual(profile.rule503020.savings.percentage, 20);
  assert.strictEqual(profile.rule503020.savings.status, 'optimal');

  // Top Catégories
  assert.strictEqual(profile.topCategories[0].category, 'Logement');
  assert.strictEqual(profile.topCategories[0].total, 800);
  assert.strictEqual(profile.topCategories[1].category, 'Alimentation & Supermarché');
  assert.strictEqual(profile.topCategories[1].total, 150);
  assert.strictEqual(profile.topCategories[2].category, 'Restaurants & Sorties');
  assert.strictEqual(profile.topCategories[2].total, 80);

  // Filtrage par date (du 2026-03-02 au 2026-03-04)
  const rangeResult = filterExpensesByDateRange(transactions, '2026-03-02', '2026-03-04');
  // Dépenses dans cet intervalle : 150 (Courses), 50 (Télécom), 80 (Resto) = 280 €
  assert.strictEqual(rangeResult.count, 3);
  assert.strictEqual(rangeResult.total, 280);

  // Vérification de la construction du contexte prompt
  const context = buildCoachSystemContext(profile, transactions, 'EUR');
  assert.ok(context.includes('Besoins (Cible 50%)'));
  assert.ok(context.includes('1000.00 €'));
  assert.ok(context.includes('Logement'));
  assert.ok(context.includes('GRAND LIVRE'));
});
