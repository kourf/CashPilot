/**
 * ============================================================================
 * CASHPILOT - SCRIPT UTILITAIRE DE MIGRATION & FUSION DE L'HISTORIQUE FIRESTORE
 * ============================================================================
 * Objectif d'audit : Éradiquer les "faux doublons" dans la collection 'products'
 * (ex: fusionner "Pur Jus de Pomme", "Pur Jus Pomme Pet", "Jus de Pomme" en "Jus de pomme",
 *  et "Pain de Mie Harry S Nature", "Pain mie sandwich complet 825g" en "Pain de mie").
 * 
 * Coût de fonctionnement : 0 € (Batch Firestore optimisé).
 * 
 * Usage :
 *   node scripts/migrateAndMergeProducts.cjs [userId]
 *   (par défaut : userId = 'cashpilot_main_user')
 * ============================================================================
 */

const admin = require('firebase-admin');

// 1. Initialisation Firebase Admin
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || 'cashpilot-app-2026'
    });
  } catch (err) {
    console.error("Erreur initialisation admin Firebase:", err.message);
  }
}

const db = admin.firestore();

// 2. Référentiel du Nettoyage Extrême (Réduction à l'Essence Stricte)
const KNOWN_BRANDS = [
  'super u', 'u', 'leclerc', 'e leclerc', 'e.leclerc', 'marque repere', 'carrefour', 'carrefour market',
  'intermarche', 'lidl', 'aldi', 'auchan', 'monoprix', 'casino', 'cora', 'franprix',
  'leader price', 'danone', 'barilla', 'panzani', 'heinz', 'amora', 'president', 
  'cristaline', 'volvic', 'evian', 'coca cola', 'coca-cola', 'freeway', 'milka', 'nestle',
  'harry s', 'harrys', 'harry', 'lu', 'oreo', 'jafad', 'lesieur', 'candia', 'lactel', 'pepsi',
  'bonduelle', 'fleury michon', 'herta', 'knorr', 'maggi', 'maille', 'paysan breton', 'elle vire'
];

const KNOWN_PACKAGING = [
  'flacon', 'flacons', 'bouteille', 'bouteilles', 'brique', 'briques', 'boite', 'boites',
  'sachet', 'sachets', 'pot', 'pots', 'pack', 'packs', 'filet', 'filets', 
  'barquette', 'barquettes', 'lot', 'lots', 'tube', 'tubes', 'etui', 'etuis',
  'canette', 'canettes', 'portion', 'portions', 'souple', 'pet', 'bidon', 'bidons',
  'verre', 'plastique', 'bocal', 'bocaux', 'conserve', 'recharge', 'squeeze', 'squeez',
  'carton', 'poche', 'spray', 'doypack', 'vrac'
];

const KNOWN_MARKETING = [
  'pur', 'pure', 'nature', 'complet', 'complete', 'croustillant', 'croustillante',
  'croustille', 'douceur', 'moelleux', 'moelleuse', 'sandwich', 'toast', 'extra fin',
  'extra fins', 'delicieux', 'fondant', 'gourmand', 'savoureux', 'traditionnel',
  'supreme', 'recette', 'just au four', 'au four', 'format familial', 'familial', 
  'eco', 'rapide', 'cuisson', 'petit', 'petite', 'grand', 'grande', 'maxi', 'mini',
  'uht', 'frais', 'fraiche', 'fraiches'
];

function cleanGenericEssence(rawName, brand) {
  if (!rawName || typeof rawName !== 'string') return 'produit';

  let s = rawName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-_'/]/g, ' ');

  if (brand && typeof brand === 'string') {
    const b = brand.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (b && b !== 'generique' && b !== 'générique') {
      s = s.replace(new RegExp('\\b' + b.replace(/[^a-z0-9]/g, '\\s*') + '\\b', 'gi'), ' ');
    }
  }

  s = s.replace(/\b1\s*[/_-\s]?\s*2\b/g, 'demi');
  s = s.replace(/\b\d+([.,]\d+)?\s*(kg|g|mg|l|cl|ml|piece|pieces|unite|unites|tranches?)\b/gi, ' ');
  s = s.replace(/\b\d+\s*x\s*\d+([.,]\d+)?\s*(kg|g|mg|l|cl|ml)?\b/gi, ' ');
  s = s.replace(/\bx\s*\d+\b/gi, ' ');
  s = s.replace(/\b\d+\s*(litre|litres|kilo|kilos|gramme|grammes)\b/gi, ' ');
  s = s.replace(/\b\d+([.,]\d+)?\b/gi, ' ');

  for (const b of KNOWN_BRANDS) {
    s = s.replace(new RegExp('\\b' + b.replace(/[^a-z0-9]/g, '\\s*') + '\\b', 'gi'), ' ');
  }
  for (const w of KNOWN_PACKAGING) {
    s = s.replace(new RegExp('\\b' + w + '\\b', 'gi'), ' ');
  }
  for (const m of KNOWN_MARKETING) {
    s = s.replace(new RegExp('\\b' + m + '\\b', 'gi'), ' ');
  }

  s = s.replace(/\bpur\s+jus\b/gi, 'jus');
  s = s.replace(/\bjus\s+pomme\b/gi, 'jus de pomme');
  s = s.replace(/\bjus\s+orange\b/gi, 'jus d orange');
  s = s.replace(/\bjus\s+clementine\b/gi, 'jus de clementine');
  s = s.replace(/\bpain\s+mie\b/gi, 'pain de mie');
  s = s.replace(/\blait\s+demi(\s+ecrem(e|ee)?)?\b/gi, 'lait demi ecreme');
  s = s.replace(/\bsteack\b/gi, 'steak');
  s = s.replace(/\bpomm?\s+terre\b/gi, 'pommes de terre');

  s = s.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s || 'produit';
}

function generateGenericNeedKey(rawName, brand) {
  const essence = cleanGenericEssence(rawName, brand);
  return essence.replace(/\s+/g, '_') || 'produit';
}

function sanitizeGenericDisplayName(rawName, brand) {
  const essence = cleanGenericEssence(rawName, brand);
  const canonicalMap = {
    'pain de mie': 'Pain de mie',
    'jus de pomme': 'Jus de pomme',
    'jus d orange': "Jus d'orange",
    'jus de clementine': 'Jus de clémentine',
    'lait demi ecreme': 'Lait demi-écrémé',
    'haricots verts': 'Haricots verts',
    'mayonnaise': 'Mayonnaise',
    'limonade': 'Limonade',
    'frites allumettes': 'Frites allumettes',
    'pommes de terre': 'Pommes de terre',
    'steak hache': 'Steak haché',
    'creme fraiche': 'Crème fraîche',
    'huile tournesol': 'Huile de tournesol',
    'huile de tournesol': 'Huile de tournesol'
  };

  if (essence in canonicalMap) {
    return canonicalMap[essence];
  }
  return essence.charAt(0).toUpperCase() + essence.slice(1);
}

// 3. Fonction principale de migration & fusion
async function runMigration(targetUserId = 'cashpilot_main_user') {
  console.log(`\n================================================================`);
  console.log(`CASHPILOT - MIGRATION & FUSION DES FAUX DOUBLONS FIRESTORE`);
  console.log(`Cible : Utilisateur [${targetUserId}] | Projet [cashpilot-app-2026]`);
  console.log(`================================================================\n`);

  const productsCollRef = db.collection(`users/${targetUserId}/products`);
  const snapshot = await productsCollRef.get();

  if (snapshot.empty) {
    console.log(`Aucun produit trouvé dans users/${targetUserId}/products.`);
    return;
  }

  console.log(`✓ Documents bruts analysés : ${snapshot.size}`);

  const groups = new Map();

  snapshot.docs.forEach(docSnap => {
    const data = docSnap.data();
    const currentId = docSnap.id;
    const rawName = data.nom_generique || currentId;
    const brand = data.marque || '';
    const canonicalKey = generateGenericNeedKey(rawName, brand);

    if (!groups.has(canonicalKey)) {
      groups.set(canonicalKey, []);
    }
    groups.get(canonicalKey).push({ id: currentId, data });
  });

  console.log(`✓ Groupes canoniques identifiés : ${groups.size}\n`);

  let mergedGroupsCount = 0;
  let deletedDocsCount = 0;

  for (const [canonicalKey, docList] of groups.entries()) {
    const needsConsolidation = docList.length > 1 || docList[0].id !== canonicalKey;

    if (!needsConsolidation) {
      continue;
    }

    const mergedOffers = {};
    const allHistPrix = [];
    const allHistOffres = [];
    let representativeName = '';
    let representativeAisle = '';
    let representativeAisleKey = '';

    for (const item of docList) {
      const d = item.data;
      if (!representativeName) {
        representativeName = sanitizeGenericDisplayName(d.nom_generique || d.cle_besoin || canonicalKey);
      }
      if (!representativeAisle) {
        representativeAisle = d.rayon || 'Autres / Divers';
        representativeAisleKey = d.rayon_cle || 'autres_divers';
      }

      // Fusion offres magasins (priorité à la plus récente)
      const offers = d.offres_magasins || {};
      for (const [storeId, offer] of Object.entries(offers)) {
        if (!mergedOffers[storeId] || new Date(offer.date).getTime() >= new Date(mergedOffers[storeId].date).getTime()) {
          mergedOffers[storeId] = offer;
        }
      }

      if (Array.isArray(d.historique_prix)) {
        allHistPrix.push(...d.historique_prix);
      }
      if (Array.isArray(d.historique_offres)) {
        allHistOffres.push(...d.historique_offres);
      }
    }

    // Dédoublonnage et tri chronologique
    const seenPriceKeys = new Set();
    const dedupedHistPrix = allHistPrix.filter(h => {
      const key = `${h.date}_${h.magasin}`;
      if (seenPriceKeys.has(key)) return false;
      seenPriceKeys.add(key);
      return true;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const seenOfferKeys = new Set();
    const dedupedHistOffres = allHistOffres.filter(h => {
      const key = `${h.date}_${h.magasin || h.magasin_id}`;
      if (seenOfferKeys.has(key)) return false;
      seenOfferKeys.add(key);
      return true;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calcul meilleure offre
    const offerEntries = Object.entries(mergedOffers);
    let meilleure;
    let pire;
    if (offerEntries.length > 0) {
      const sorted = [...offerEntries].sort((a, b) => a[1].prix_unitaire - b[1].prix_unitaire);
      meilleure = {
        magasin_id: sorted[0][0],
        magasin_nom: sorted[0][1].magasin_nom || sorted[0][0],
        prix_unitaire: sorted[0][1].prix_unitaire,
        unite: sorted[0][1].unite
      };
      pire = {
        magasin_id: sorted[sorted.length - 1][0],
        magasin_nom: sorted[sorted.length - 1][1].magasin_nom || sorted[sorted.length - 1][0],
        prix_unitaire: sorted[sorted.length - 1][1].prix_unitaire,
        unite: sorted[sorted.length - 1][1].unite
      };
    }

    const consolidatedDoc = {
      nom_generique: representativeName,
      rayon: representativeAisle,
      rayon_cle: representativeAisleKey,
      cle_besoin: canonicalKey,
      offres_magasins: mergedOffers,
      historique_prix: dedupedHistPrix,
      historique_offres: dedupedHistOffres,
      meilleure_offre: meilleure || null,
      pire_offre: pire || null,
      derniere_mise_a_jour: new Date().toISOString(),
      nombre_releves: dedupedHistOffres.length
    };

    const batch = db.batch();
    const targetDocRef = productsCollRef.doc(canonicalKey);
    batch.set(targetDocRef, consolidatedDoc, { merge: true });

    for (const oldItem of docList) {
      if (oldItem.id !== canonicalKey) {
        batch.delete(productsCollRef.doc(oldItem.id));
        deletedDocsCount++;
      }
    }

    await batch.commit();
    mergedGroupsCount++;

    console.log(`[FUSION RÉUSSIE]`);
    console.log(`  -> Clé canonique : ${canonicalKey} (« ${representativeName} »)`);
    console.log(`  -> Anciens IDs : [${docList.map(d => d.id).join(', ')}]`);
    console.log(`  -> Magasins consolidés : ${Object.keys(mergedOffers).length}`);
    console.log(`  -> Points d'historique conservés : ${dedupedHistPrix.length}\n`);
  }

  console.log(`================================================================`);
  console.log(`RAPPORT D'AUDIT & RÉSULTAT FINAL :`);
  console.log(`- Total documents initiaux : ${snapshot.size}`);
  console.log(`- Groupes consolidés : ${mergedGroupsCount}`);
  console.log(`- Anciens faux doublons supprimés : ${deletedDocsCount}`);
  console.log(`- Documents finaux après fusion : ${snapshot.size - deletedDocsCount + (groups.has(canonicalKey) ? 0 : 0)}`);
  console.log(`- Coût financier : 0 €`);
  console.log(`================================================================\n`);
}

// Export pour usage en module et exécution directe
module.exports = {
  runMigration,
  cleanGenericEssence,
  generateGenericNeedKey,
  sanitizeGenericDisplayName
};

if (require.main === module) {
  const userIdArg = process.argv[2] || 'cashpilot_main_user';
  runMigration(userIdArg)
    .then(() => process.exit(0))
    .catch(err => {
      console.error("Échec de la migration:", err);
      process.exit(1);
    });
}
