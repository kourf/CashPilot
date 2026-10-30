import { describe, it } from 'node:test';
import assert from 'node:assert';
import { 
  type ReceiptItem,
  type StandardizedProductDoc,
  type StorePriceDetail,
  type StoreOfferDetail,
  normalizeProductNeed
} from '../src/types/receipts.ts';
import { 
  computeUnitPrice, 
  buildComparativeMatrixFromProducts 
} from '../src/lib/receiptClassifier.ts';

describe('Audit Financier : Moteur IA d’Analyse des Remises Spécifiques par Produit & Promotions', () => {

  it('1. Décompose rigoureusement un produit remisé : Prix Brut, Remise, Net Payé et Taux %', () => {
    // Cas concret supermarché : Bouteille d'huile d'olive 1L à 9.90 € avec Remise Immédiate en caisse de -2.97 € (-30%)
    const rawPricePaid = 6.93;
    const discountAmount = 2.97;
    const initialPrice = Number((rawPricePaid + discountAmount).toFixed(2));
    const discountRate = Math.round((discountAmount / initialPrice) * 100);
    const isPromo = discountAmount > 0;

    assert.strictEqual(initialPrice, 9.90, 'Le prix brut avant remise doit être exactement de 9.90 €');
    assert.strictEqual(discountAmount, 2.97, 'La remise spécifique au produit doit être de 2.97 €');
    assert.strictEqual(rawPricePaid, 6.93, 'Le montant net payé doit être de 6.93 €');
    assert.strictEqual(discountRate, 30, 'Le taux de promotion calculé doit être de 30 %');
    assert.strictEqual(isPromo, true, 'Le flag promotionnel doit être activé');

    // Équation comptable d’audit
    assert.strictEqual(
      Number((initialPrice - discountAmount).toFixed(2)),
      rawPricePaid,
      'L’équation comptable (Brut - Remise = Net) doit être parfaitement équilibrée'
    );
  });

  it('2. Double calcul de prix de référence (€/kg ou €/L) : Base catalogue vs Net promo', () => {
    // Cas : Pâte à tartiner 750g affichée à 5.40 € au catalogue (soit 7.20 €/kg) bénéficiant d’une remise de 1.80 € (-33%) payée 3.60 € (soit 4.80 €/kg)
    const weightOrVolume = '750g';
    const quantity = 1;
    const pricePaid = 3.60;
    const discountAmount = 1.80;
    const initialPrice = Number((pricePaid + discountAmount).toFixed(2)); // 5.40 €

    const netComp = computeUnitPrice(pricePaid, weightOrVolume, quantity);
    const baseComp = computeUnitPrice(initialPrice, weightOrVolume, quantity);

    assert.strictEqual(netComp.unit, 'kg');
    assert.strictEqual(baseComp.unit, 'kg');
    assert.strictEqual(netComp.unitPrice, 4.80, 'Prix unitaire net promotionnel = 3.60 € / 0.750 kg = 4.80 €/kg');
    assert.strictEqual(baseComp.unitPrice, 7.20, 'Prix unitaire base catalogue = 5.40 € / 0.750 kg = 7.20 €/kg');

    // Vérifie que le prix au kilo a bien chuté temporairement
    assert.ok(netComp.unitPrice < baseComp.unitPrice, 'Le prix promotionnel doit être inférieur au prix de base');
    const unitPriceDropPercent = Math.round(((baseComp.unitPrice - netComp.unitPrice) / baseComp.unitPrice) * 100);
    assert.strictEqual(unitPriceDropPercent, 33, 'La baisse du prix au kilo reflète fidèlement les 33% de remise');
  });

  it('3. Intégration de l’offre remisée dans les types ReceiptItem et StandardizedProductDoc', () => {
    const item: ReceiptItem = {
      id: 'item-promo-001',
      rawName: 'SAUCE BURGER 510G REMISE IMMEDIATE',
      normalizedName: 'Sauce burger',
      brand: 'Super U',
      weightOrVolume: '510g',
      quantity: 1,
      pricePaid: 2.29,
      price: 2.29,
      initialPrice: 4.58,
      discountAmount: 2.29,
      discountRate: 50,
      isPromo: true,
      discountType: 'REMISE IMMEDIATE -50%',
      unitPrice: 4.49, // 2.29 / 0.510 = 4.49 €/kg
      initialUnitPrice: 8.98, // 4.58 / 0.510 = 8.98 €/kg
      referenceUnitPrice: 4.49,
      category: 'Épicerie salée & Épices',
      unit: 'kg',
      cle_besoin: 'sauce_burger'
    };

    assert.strictEqual(item.isPromo, true);
    assert.strictEqual(item.discountAmount, 2.29);
    assert.strictEqual(item.discountRate, 50);
    assert.strictEqual(item.discountType, 'REMISE IMMEDIATE -50%');
    assert.strictEqual(item.initialUnitPrice, 8.98);
    assert.strictEqual(item.unitPrice, 4.49);

    // Structure Firestore StandardizedProductDoc
    const productDoc: StandardizedProductDoc = {
      id: 'sauce_burger',
      nom_generique: 'Sauce burger',
      rayon: 'Épicerie salée & Épices',
      rayon_cle: 'epicerie_salee_epices',
      offres_magasins: {
        super_u_etrembieres: {
          prix_unitaire: 4.49,
          unite: 'kg',
          prix_paye: 2.29,
          marque: 'Super U',
          format: '510g',
          date: '2026-10-25',
          magasin_nom: 'Super U Etrembières',
          is_promo: true,
          remise: 2.29,
          taux_remise: 50,
          motif_remise: 'REMISE IMMEDIATE -50%',
          prix_base_unitaire: 8.98,
          prix_brut: 4.58
        }
      },
      prix_actuel: {
        super_u_etrembieres: {
          prix_unitaire: 4.49,
          prix_paye: 2.29,
          quantite: 1,
          date: '2026-10-25',
          is_promo: true,
          remise: 2.29,
          prix_base_unitaire: 8.98
        }
      },
      historique_prix: [
        {
          date: '2026-10-25',
          magasin: 'super_u_etrembieres',
          prix_unitaire: 4.49,
          is_promo: true,
          remise: 2.29,
          prix_base_unitaire: 8.98
        }
      ],
      derniere_mise_a_jour: '2026-10-25T14:30:00Z',
      nombre_releves: 1
    };

    const offer = productDoc.offres_magasins['super_u_etrembieres'];
    assert.strictEqual(offer.is_promo, true);
    assert.strictEqual(offer.remise, 2.29);
    assert.strictEqual(offer.prix_base_unitaire, 8.98);
    assert.strictEqual(offer.prix_unitaire, 4.49);
  });

  it('4. Matrice Comparative : Conserve les indicateurs promotionnels et prévient les faux signaux', () => {
    // Magasin A (Leclerc) : Sauce burger sans promo à 6.50 €/kg (offre pérenne la moins chère hors promo)
    // Magasin B (Super U) : Sauce burger en promo ponctuelle -50% à 4.49 €/kg (base 8.98 €/kg)
    const productList: StandardizedProductDoc[] = [
      {
        id: 'sauce_burger',
        nom_generique: 'Sauce burger',
        rayon: 'Épicerie salée & Épices',
        rayon_cle: 'epicerie_salee_epices',
        offres_magasins: {
          e_leclerc_ville_la_grand: {
            prix_unitaire: 6.50,
            unite: 'kg',
            prix_paye: 3.25,
            marque: 'Rustica',
            format: '500g',
            date: '2026-10-24',
            magasin_nom: 'E.Leclerc Ville-la-Grand',
            is_promo: false,
            remise: 0,
            prix_base_unitaire: 6.50,
            prix_brut: 3.25
          },
          super_u_etrembieres: {
            prix_unitaire: 4.49,
            unite: 'kg',
            prix_paye: 2.29,
            marque: 'Super U',
            format: '510g',
            date: '2026-10-25',
            magasin_nom: 'Super U Etrembières',
            is_promo: true,
            remise: 2.29,
            taux_remise: 50,
            motif_remise: 'REMISE IMMEDIATE -50%',
            prix_base_unitaire: 8.98,
            prix_brut: 4.58
          }
        },
        historique_prix: [],
        derniere_mise_a_jour: '2026-10-25T14:30:00Z',
        nombre_releves: 2
      }
    ];

    const matrix = buildComparativeMatrixFromProducts(productList);
    assert.ok(matrix.stores.length >= 2, 'La matrice doit contenir au moins 2 magasins');

    const aisleGroup = matrix.aisleGroups.find(g => g.aisle === 'Épicerie salée & Épices');
    assert.ok(aisleGroup, 'Le rayon Épicerie salée & Épices doit être présent');

    const sauceProd = aisleGroup?.products.find(p => p.normalizedName.toLowerCase().includes('sauce burger'));
    assert.ok(sauceProd, 'Le produit Sauce Burger doit être consolidé');

    const superUOffer = Object.entries(sauceProd!.storePrices).find(([name]) => name.includes('Super U'));
    assert.ok(superUOffer, 'L’offre Super U doit être enregistrée');
    assert.strictEqual(superUOffer![1].isPromo, true, 'L’offre Super U doit porter le flag isPromo = true');
    assert.strictEqual(superUOffer![1].discountRate, 50, 'Le taux de remise doit être 50%');
    assert.strictEqual(superUOffer![1].initialUnitPrice, 8.98, 'Le prix de référence catalogue Super U doit être 8.98 €/kg');
    assert.strictEqual(superUOffer![1].unitPrice, 4.49, 'Le prix unitaire net payé doit être 4.49 €/kg');

    const leclercOffer = Object.entries(sauceProd!.storePrices).find(([name]) => name.includes('Leclerc'));
    assert.ok(leclercOffer, 'L’offre Leclerc doit être enregistrée');
    assert.strictEqual(leclercOffer![1].isPromo, false, 'Leclerc est au prix régulier');
    assert.strictEqual(leclercOffer![1].unitPrice, 6.50, 'Prix Leclerc = 6.50 €/kg');

    // L'analyse montre clairement :
    // - En prix promo net : Super U est temporairement moins cher (4.49 €/kg vs 6.50 €/kg)
    // - En prix de base hors promo : Leclerc est structurellement moins cher (6.50 €/kg vs 8.98 €/kg)
    assert.ok(superUOffer![1].unitPrice < leclercOffer![1].unitPrice);
    assert.ok(leclercOffer![1].unitPrice < superUOffer![1].initialUnitPrice!);
  });

  it('5. Détection de promotions diverses (Euro brut, Pourcentage, Date courte)', () => {
    // 5.1 Promo en euros fixes (ex: -1.00 € sur paquet de café)
    const cafeInit = 4.50;
    const cafeRemise = 1.00;
    const cafeNet = Number((cafeInit - cafeRemise).toFixed(2));
    const cafeRate = Math.round((cafeRemise / cafeInit) * 100);
    assert.strictEqual(cafeNet, 3.50);
    assert.strictEqual(cafeRate, 22);

    // 5.2 Date courte -50% (ex: viande 8.40 € -> 4.20 €)
    const viandeInit = 8.40;
    const viandeRemise = 4.20;
    const viandeNet = 4.20;
    assert.strictEqual(Number((viandeInit - viandeRemise).toFixed(2)), viandeNet);
    assert.strictEqual(Math.round((viandeRemise / viandeInit) * 100), 50);

    // 5.3 Produit non remisé (remise = 0)
    const eauInit = 0.60;
    const eauRemise = 0;
    const eauNet = 0.60;
    const isEauPromo = eauRemise > 0;
    assert.strictEqual(isEauPromo, false);
    assert.strictEqual(eauNet, eauInit);
  });

});
