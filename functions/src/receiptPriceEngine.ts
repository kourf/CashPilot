/**
 * MOTEUR D'AUDIT FINANCIER CASHPILOT - EXTRACTION, NORMALISATION ET GESTION DES CLÉS DE BESOIN GÉNÉRIQUE
 * Architecture à coût 0 € (optimisation absolue des requêtes et stockage Firestore).
 */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Nomenclature des 14 rayons verrouillés en dur (Règle 4)
export const LOCKED_SUPERMARKET_AISLES = [
  'Boucherie, Volaille & Poissonnerie',
  'Épicerie salée & Épices',
  'Fruits & Légumes',
  'Produits frais & Crèmerie',
  'Épicerie sucrée',
  'Hygiène, Beauté & Sanitaire',
  'Entretien & Maison',
  'Boissons',
  'Maison, Textile & Culture',
  'Santé & Pharmacie',
  'Papeterie & Bureau',
  'Fleurs & Cadeaux',
  'Sacs & Consignes',
  'Autres / Divers'
] as const;

export type LockedSupermarketAisle = typeof LOCKED_SUPERMARKET_AISLES[number];

export const LOCKED_AISLE_SLUG_MAP: Record<string, { key: string; label: LockedSupermarketAisle }> = {
  'boucherie_poissonnerie': { key: 'boucherie_poissonnerie', label: 'Boucherie, Volaille & Poissonnerie' },
  'epicerie_salee': { key: 'epicerie_salee', label: 'Épicerie salée & Épices' },
  'fruits_legumes': { key: 'fruits_legumes', label: 'Fruits & Légumes' },
  'frais_cremerie': { key: 'frais_cremerie', label: 'Produits frais & Crèmerie' },
  'epicerie_sucree': { key: 'epicerie_sucree', label: 'Épicerie sucrée' },
  'hygiene_beaute': { key: 'hygiene_beaute', label: 'Hygiène, Beauté & Sanitaire' },
  'entretien_maison': { key: 'entretien_maison', label: 'Entretien & Maison' },
  'boissons': { key: 'boissons', label: 'Boissons' },
  'maison_textile_culture': { key: 'maison_textile_culture', label: 'Maison, Textile & Culture' },
  'sante_pharmacie': { key: 'sante_pharmacie', label: 'Santé & Pharmacie' },
  'papeterie_bureau': { key: 'papeterie_bureau', label: 'Papeterie & Bureau' },
  'fleurs_cadeaux': { key: 'fleurs_cadeaux', label: 'Fleurs & Cadeaux' },
  'sacs_consignes': { key: 'sacs_consignes', label: 'Sacs & Consignes' },
  'autres_divers': { key: 'autres_divers', label: 'Autres / Divers' }
};

export function normalizeLockedAisle(rawCategory?: string): { key: string; label: LockedSupermarketAisle } {
  if (!rawCategory || typeof rawCategory !== 'string') {
    return { key: 'autres_divers', label: 'Autres / Divers' };
  }

  const clean = rawCategory
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  if (clean in LOCKED_AISLE_SLUG_MAP) {
    return LOCKED_AISLE_SLUG_MAP[clean];
  }

  if (clean.includes('boucherie') || clean.includes('poisson') || clean.includes('volaille') || clean.includes('viande')) {
    return { key: 'boucherie_poissonnerie', label: 'Boucherie, Volaille & Poissonnerie' };
  }
  if (clean.includes('epicerie_salee') || clean.includes('epice') || clean.includes('salee') || clean.includes('pates') || clean.includes('riz') || clean.includes('sauce')) {
    return { key: 'epicerie_salee', label: 'Épicerie salée & Épices' };
  }
  if (clean.includes('fruit') || clean.includes('legume') || clean.includes('primeur') || clean.includes('salade')) {
    return { key: 'fruits_legumes', label: 'Fruits & Légumes' };
  }
  if (clean.includes('frais') || clean.includes('cremerie') || clean.includes('lait') || clean.includes('fromage') || clean.includes('yaourt')) {
    return { key: 'frais_cremerie', label: 'Produits frais & Crèmerie' };
  }
  if (clean.includes('epicerie_sucree') || clean.includes('sucree') || clean.includes('biscuit') || clean.includes('chocolat') || clean.includes('cafe')) {
    return { key: 'epicerie_sucree', label: 'Épicerie sucrée' };
  }
  if (clean.includes('hygiene') || clean.includes('beaute') || clean.includes('sanitaire') || clean.includes('shampoing') || clean.includes('savon')) {
    return { key: 'hygiene_beaute', label: 'Hygiène, Beauté & Sanitaire' };
  }
  if (clean.includes('entretien') || clean.includes('maison') || clean.includes('menage') || clean.includes('lessive')) {
    return { key: 'entretien_maison', label: 'Entretien & Maison' };
  }
  if (clean.includes('boisson') || clean.includes('soda') || clean.includes('eau') || clean.includes('jus') || clean.includes('sirop') || clean.includes('biere')) {
    return { key: 'boissons', label: 'Boissons' };
  }
  if (clean.includes('textile') || clean.includes('culture') || clean.includes('livre') || clean.includes('vaisselle') || clean.includes('bazar')) {
    return { key: 'maison_textile_culture', label: 'Maison, Textile & Culture' };
  }
  if (clean.includes('sante') || clean.includes('pharmacie') || clean.includes('pansement') || clean.includes('parapharmacie')) {
    return { key: 'sante_pharmacie', label: 'Santé & Pharmacie' };
  }
  if (clean.includes('papeterie') || clean.includes('bureau') || clean.includes('stylo') || clean.includes('cahier')) {
    return { key: 'papeterie_bureau', label: 'Papeterie & Bureau' };
  }
  if (clean.includes('fleur') || clean.includes('plante') || clean.includes('bouquet') || clean.includes('cadeau')) {
    return { key: 'fleurs_cadeaux', label: 'Fleurs & Cadeaux' };
  }
  if (clean.includes('sac') || clean.includes('cabas') || clean.includes('consigne')) {
    return { key: 'sacs_consignes', label: 'Sacs & Consignes' };
  }

  return { key: 'autres_divers', label: 'Autres / Divers' };
}

export const KNOWN_BRANDS_AND_STORES = [
  'super u', 'u', 'leclerc', 'e.leclerc', 'marque repere', 'carrefour', 'carrefour market',
  'intermarche', 'lidl', 'aldi', 'auchan', 'monoprix', 'casino', 'cora', 'franprix',
  'leader price', 'danone', 'barilla', 'panzani', 'heinz', 'amora', 'president', 
  'cristaline', 'volvic', 'evian', 'coca cola', 'coca-cola', 'freeway', 'milka', 'nestle'
] as const;

export const KNOWN_PACKAGING_WORDS = [
  'flacon', 'bouteille', 'brique', 'boite', 'sachet', 'pot', 'pack', 'filet', 
  'barquette', 'lot', 'tube', 'etui', 'canette', 'portion', 'portions', 'souple', 
  'verre', 'plastique', 'bocal', 'conserve', 'familial', 'eco', 'recharge', 'cuisson', 'rapide'
] as const;

/**
 * ============================================================================
 * RÈGLE 1 : LA "CLÉ DE BESOIN GÉNÉRIQUE"
 * Isole uniquement le besoin brut en éliminant la marque, le format et le conditionnement.
 * Exemples :
 * - "Sauce burger Super U" -> "sauce_burger"
 * - "Sauce burger flacon souple 510g Leclerc" -> "sauce_burger"
 * - "Lait demi-écrémé brique 1L" -> "lait_demi_ecreme"
 * ============================================================================
 */
export function generateGenericNeedKey(rawName?: string, brand?: string): string {
  if (!rawName || typeof rawName !== 'string') {
    return 'produit';
  }

  let s = rawName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (brand && typeof brand === 'string') {
    const b = brand.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (b && b !== 'generique' && b !== 'générique') {
      s = s.replace(new RegExp('\\b' + b.replace(/[^a-z0-9]/g, '\\s*') + '\\b', 'gi'), ' ');
    }
  }

  // Suppression des formats et quantités numériques (ex: "500g", "510 g", "1.5l", "6x1l", "4x100g")
  s = s.replace(/\b\d+([.,]\d+)?\s*(kg|g|mg|l|cl|ml|piece|pieces|unite|unites)\b/gi, ' ');
  s = s.replace(/\b\d+\s*x\s*\d+([.,]\d+)?\s*(kg|g|mg|l|cl|ml)?\b/gi, ' ');
  s = s.replace(/\bx\s*\d+\b/gi, ' ');

  // Suppression des marques et enseignes courantes
  for (const b of KNOWN_BRANDS_AND_STORES) {
    s = s.replace(new RegExp('\\b' + b.replace(/[^a-z0-9]/g, '\\s*') + '\\b', 'gi'), ' ');
  }

  // Suppression des conditionnements
  for (const w of KNOWN_PACKAGING_WORDS) {
    s = s.replace(new RegExp('\\b' + w + '\\b', 'gi'), ' ');
  }

  // Caractères spéciaux vers underscore
  s = s.replace(/[^a-z0-9]+/g, '_')
       .replace(/_+/g, '_')
       .replace(/^_|_$/g, '');

  return s || 'produit';
}

/**
 * Super Clé de compatibilité (marque + nom + format)
 */
export function generateSuperKey(
  marque?: string,
  nomGenerique?: string,
  poidsOuVolume?: string
): string {
  const sanitize = (val: string): string => {
    return val
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  };

  const rawBrand = (marque || '').trim();
  const rawName = (nomGenerique || '').trim();
  const rawWeight = (poidsOuVolume || '').trim();

  const isGeneric = !rawBrand ||
    rawBrand.toLowerCase() === 'generique' ||
    rawBrand.toLowerCase() === 'générique' ||
    rawBrand.toLowerCase() === 'sans marque' ||
    rawBrand.toLowerCase() === 'primeur' ||
    rawBrand.toLowerCase() === 'rayon frais' ||
    rawBrand.toLowerCase() === 'boucherie' ||
    rawBrand.toLowerCase() === 'vrac';

  const brandClean = isGeneric ? 'generique' : (sanitize(rawBrand) || 'generique');
  const nameClean = sanitize(rawName) || 'produit';
  const weightClean = sanitize(rawWeight) || '1_piece';

  return `${brandClean}_${nameClean}_${weightClean}`;
}

/**
 * Référentiel de magasins physiques ciblés (0 € de coût, aucune API externe)
 */
export interface PhysicalStoreMatch {
  id: string;
  displayName: string;
  address?: string;
  city?: string;
  postalCode?: string;
  googleMapsUrl?: string;
}

export function resolvePhysicalStore(params: {
  storeName?: string;
  storeAddress?: string;
  storePostalCode?: string;
  storeCity?: string;
}): PhysicalStoreMatch {
  const name = (params.storeName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const addr = (params.storeAddress || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const city = (params.storeCity || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const combined = `${name} ${addr} ${city} ${params.storePostalCode || ''}`;

  // 1. Intermarché Gaillard
  if (
    (name.includes('intermarche') || name.includes('inter')) &&
    (combined.includes('gaillard') || combined.includes('cassin') || combined.includes('chatelaine') || combined.includes('74240'))
  ) {
    return {
      id: 'intermarche_gaillard',
      displayName: 'Intermarché - Gaillard',
      address: '5 Rue René Cassin, 74240 Gaillard',
      city: 'Gaillard',
      postalCode: '74240',
      googleMapsUrl: 'https://maps.app.goo.gl/n2vkEedyFULFRAFB7'
    };
  }

  // 2. Intermarché Annemasse
  if (
    (name.includes('intermarche') || name.includes('inter')) &&
    (combined.includes('resistance') || combined.includes('thonon') || (combined.includes('annemasse') && !combined.includes('ville')))
  ) {
    return {
      id: 'intermarche_annemasse',
      displayName: 'Intermarché - Annemasse',
      address: '14 Rue de la Résistance, 74100 Annemasse',
      city: 'Annemasse',
      postalCode: '74100',
      googleMapsUrl: 'https://maps.app.goo.gl/WbcHrAVUtbrxjwXK8'
    };
  }

  // 3. Intermarché Ville-la-Grand / Vétraz-Monthoux
  if (
    (name.includes('intermarche') || name.includes('inter')) &&
    (combined.includes('teppes') || combined.includes('vetraz') || combined.includes('ville-la-grand') || combined.includes('erables'))
  ) {
    return {
      id: 'intermarche_ville_la_grand',
      displayName: 'Intermarché - Ville-la-Grand',
      address: '17 Rue des Teppes, 74100 Vétraz-Monthoux',
      city: 'Ville-la-Grand',
      postalCode: '74100',
      googleMapsUrl: 'https://maps.app.goo.gl/u4bgwq9Af9a5pm9E7'
    };
  }

  // 4. Carrefour Market Annemasse
  if (
    (name.includes('carrefour') || name.includes('market')) &&
    (combined.includes('annemasse') || combined.includes('albert henon') || combined.includes('henon') || combined.includes('74100'))
  ) {
    return {
      id: 'carrefour_market_annemasse',
      displayName: 'Carrefour Market Annemasse',
      address: 'Rue Albert Hénon, 74100 Annemasse',
      city: 'Annemasse',
      postalCode: '74100',
      googleMapsUrl: 'https://maps.google.com/?q=Carrefour+Market+Annemasse'
    };
  }

  // 5. E.Leclerc Ville-la-Grand
  if (
    (name.includes('leclerc') || name.includes('e.leclerc')) &&
    (combined.includes('ville') || combined.includes('mont-blanc') || combined.includes('74100'))
  ) {
    return {
      id: 'leclerc_ville_la_grand',
      displayName: 'E.Leclerc - Ville-la-Grand',
      address: 'Rue des Deux Montagnes, 74100 Ville-la-Grand',
      city: 'Ville-la-Grand',
      postalCode: '74100',
      googleMapsUrl: 'https://maps.google.com/?q=E.Leclerc+Ville-la-Grand'
    };
  }

  // 6. Lidl Annemasse
  if (name.includes('lidl') && (combined.includes('annemasse') || combined.includes('geneve') || combined.includes('74100'))) {
    return {
      id: 'lidl_annemasse',
      displayName: 'Lidl Annemasse',
      address: '14 Rue de Genève, 74100 Annemasse',
      city: 'Annemasse',
      postalCode: '74100',
      googleMapsUrl: 'https://maps.google.com/?q=Lidl+Annemasse'
    };
  }

  // 7. Super U Étrembières
  if (name.includes('super u') || name.includes('etrembieres') || combined.includes('etrembi')) {
    return {
      id: 'super_u_etrembieres',
      displayName: 'Super U Étrembières',
      address: 'Shopping Léman, 21 Chemin du Carre, 74100 Étrembières',
      city: 'Étrembières',
      postalCode: '74100',
      googleMapsUrl: 'https://maps.google.com/?q=Super+U+Etrembieres'
    };
  }

  const cleanName = (params.storeName || 'Magasin').trim();
  const cleanCity = (params.storeCity || '').trim();
  const slug = `${cleanName}_${cleanCity}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  const display = cleanCity ? `${cleanName} - ${cleanCity}` : cleanName;

  return {
    id: slug || 'magasin_inconnu',
    displayName: display,
    address: params.storeAddress,
    city: params.storeCity,
    postalCode: params.storePostalCode
  };
}

/**
 * Structure de l'article extrait via le format "JSON Strict" de Gemini (Règle 4)
 */
export interface StrictExtractedItem {
  nom_generique_nettoye: string; // Sans marque ni format (ex: "Sauce burger")
  marque: string; // Marque du produit ou "generique"
  format_exact: string; // Poids/volume lu (ex: "500g", "510g")
  prix_paye: number;
  prix_unitaire_calcule: number;
  unite_mesure: 'kg' | 'L' | 'piece';
  rayon_assigne: string;
  // Rétrocompatibilité
  nom_generique?: string;
  poids_ou_volume?: string;
  quantite?: number;
  rawName?: string;
}

/**
 * Détail d'une offre pour un magasin physique dans Firestore
 */
export interface StoreOfferDetail {
  prix_unitaire: number;
  unite: string;
  prix_paye: number;
  marque: string;
  format: string;
  date: string;
  magasin_nom?: string;
  magasin_id?: string;
  receiptId?: string;
  rawName?: string;
}

/**
 * Structure du document Firestore regroupant les offres par magasin sous la Clé de Besoin Générique (Règle 2)
 * ID de document = Clé de Besoin Générique (ex: "sauce_burger")
 * Collection : users/{userId}/products/{cle_besoin}
 */
export interface GenericProductDocument {
  nom_generique: string;
  rayon: LockedSupermarketAisle;
  rayon_cle: string;
  cle_besoin: string;
  offres_magasins: Record<string, StoreOfferDetail>;
  historique_offres?: Array<StoreOfferDetail & { magasin: string }>;
  // Rétrocompatibilité
  prix_actuel?: Record<string, any>;
  historique_prix?: Array<any>;
  meilleure_offre?: {
    magasin_id: string;
    magasin_nom: string;
    prix_unitaire: number;
    unite: string;
  };
  pire_offre?: {
    magasin_id: string;
    magasin_nom: string;
    prix_unitaire: number;
    unite: string;
  };
  ecart_prix_max?: number;
  derniere_mise_a_jour: string;
  nombre_releves: number;
}

/**
 * ============================================================================
 * CLOUD FUNCTION (Livrable 1) :
 * Reçoit le JSON de l'IA, crée la "Clé de Besoin Générique",
 * et met à jour le dictionnaire offres_magasins dans Firestore.
 * Coût = 0 € (Batch / Transaction atomique).
 * ============================================================================
 */
export const processReceiptWithSuperKeys = functions.region('europe-west1')
  .runWith({ timeoutSeconds: 120, memory: '512MB' })
  .https.onCall(async (data, context) => {
    const {
      userId = 'cashpilot_main_user',
      receiptId = `receipt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      storeName,
      storeAddress,
      storePostalCode,
      storeCity,
      googleMapsUrl,
      date = new Date().toISOString().slice(0, 10),
      time = '12:00',
      totalAmount = 0,
      totalDiscount = 0,
      totalArticles,
      items = []
    } = data || {};

    if (!Array.isArray(items) || items.length === 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        "Le ticket doit comporter au moins un article extrait."
      );
    }

    const db = admin.firestore();

    // 1. Résolution physique du magasin (Intermarché Gaillard, Annemasse, Ville-la-Grand, etc.)
    const resolvedStore = resolvePhysicalStore({
      storeName,
      storeAddress,
      storePostalCode,
      storeCity
    });

    const storeId = resolvedStore.id;
    const storeDisplayName = resolvedStore.displayName;
    const finalGoogleMapsUrl = googleMapsUrl || resolvedStore.googleMapsUrl;
    const nowIso = new Date().toISOString();

    const productsCollectionRef = db.collection(`users/${userId}/products`);
    const receiptDocRef = db.collection(`users/${userId}/receipts`).doc(receiptId);

    const processedKeys: string[] = [];
    const enrichedReceiptItems: any[] = [];

    // 2. Traitement de chaque article et mise à jour sous sa "Clé de Besoin Générique"
    for (const rawItem of items as StrictExtractedItem[]) {
      const marque = (rawItem.marque || '').trim();
      const nomGeneriqueNettoye = (rawItem.nom_generique_nettoye || rawItem.nom_generique || '').trim();
      const formatExact = (rawItem.format_exact || rawItem.poids_ou_volume || '').trim();
      const prixPaye = Number(rawItem.prix_paye) || 0;
      const quantite = Math.max(1, Number(rawItem.quantite) || 1);
      
      let prixUnitaire = Number(rawItem.prix_unitaire_calcule) || 0;
      if (prixUnitaire <= 0 && quantite > 0) {
        prixUnitaire = Number((prixPaye / quantite).toFixed(2));
      }

      // RÈGLE 1 : Clé de Besoin Générique (ex: "sauce_burger")
      const cleBesoin = generateGenericNeedKey(nomGeneriqueNettoye, marque);
      processedKeys.push(cleBesoin);

      // Règle 4 : Rayon verrouillé
      const aisle = normalizeLockedAisle(rawItem.rayon_assigne);

      // Unité de mesure ('kg', 'L', 'piece')
      let unitMeasure: 'kg' | 'L' | 'piece' = 'piece';
      const rawU = (rawItem.unite_mesure || '').toLowerCase().trim();
      if (rawU.includes('kg') || rawU.includes('kilo') || rawU.includes('g')) {
        unitMeasure = 'kg';
      } else if (rawU.includes('l') || rawU.includes('litre') || rawU.includes('cl')) {
        unitMeasure = 'L';
      }

      const receiptItemEnriched = {
        id: `item-${cleBesoin}-${receiptId.slice(-4)}`,
        cle_besoin: cleBesoin,
        rawName: rawItem.rawName || `${nomGeneriqueNettoye} ${formatExact}`,
        normalizedName: nomGeneriqueNettoye.charAt(0).toUpperCase() + nomGeneriqueNettoye.slice(1),
        brand: marque && marque.toLowerCase() !== 'generique' ? (marque.charAt(0).toUpperCase() + marque.slice(1)) : 'Générique',
        pricePaid: Number(prixPaye.toFixed(2)),
        quantity: quantite,
        weightOrVolume: formatExact,
        unitPrice: Number(prixUnitaire.toFixed(2)),
        referenceUnitPrice: Number(prixUnitaire.toFixed(2)),
        unit: unitMeasure,
        category: aisle.label,
        categoryKey: aisle.key,
        storeId,
        storeName: storeDisplayName
      };
      enrichedReceiptItems.push(receiptItemEnriched);

      // RÈGLE 2 : Mise à jour du document Firestore par Clé de Besoin Générique
      const productRef = productsCollectionRef.doc(cleBesoin);
      await db.runTransaction(async (transaction) => {
        const productSnap = await transaction.get(productRef);

        const offerDetail: StoreOfferDetail = {
          prix_unitaire: Number(prixUnitaire.toFixed(2)),
          unite: unitMeasure,
          prix_paye: Number(prixPaye.toFixed(2)),
          marque: receiptItemEnriched.brand,
          format: formatExact || '1 piece',
          date,
          magasin_nom: storeDisplayName,
          magasin_id: storeId,
          receiptId,
          rawName: receiptItemEnriched.rawName
        };

        const priceRecord = {
          date,
          magasin: storeId,
          magasin_nom: storeDisplayName,
          prix_unitaire: Number(prixUnitaire.toFixed(2)),
          prix_paye: Number(prixPaye.toFixed(2)),
          quantite,
          receiptId
        };

        if (productSnap.exists) {
          const prodData = productSnap.data() as GenericProductDocument;
          const currentOffers = prodData.offres_magasins || {};

          // Mise à jour de l'offre pour ce magasin exact
          currentOffers[storeId] = offerDetail;

          // Rétrocompatibilité prix_actuel
          const currentPrices = prodData.prix_actuel || {};
          currentPrices[storeId] = {
            prix_unitaire: Number(prixUnitaire.toFixed(2)),
            prix_paye: Number(prixPaye.toFixed(2)),
            quantite,
            date,
            magasin_id: storeId,
            magasin_nom: storeDisplayName,
            receiptId
          };

          // Historique chronologique
          const existingHistory = Array.isArray(prodData.historique_offres) ? prodData.historique_offres : [];
          const filteredHistory = existingHistory.filter(h => !(h.receiptId === receiptId && h.magasin === storeId));
          const updatedHistory = [...filteredHistory, { ...offerDetail, magasin: storeId }].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          // Recalcul de la meilleure et de la pire offre
          const offerEntries = Object.entries(currentOffers);
          let meilleure: { magasin_id: string; magasin_nom: string; prix_unitaire: number; unite: string } | undefined;
          let pire: { magasin_id: string; magasin_nom: string; prix_unitaire: number; unite: string } | undefined;

          if (offerEntries.length > 0) {
            const sortedByPrice = [...offerEntries].sort((a, b) => a[1].prix_unitaire - b[1].prix_unitaire);
            meilleure = {
              magasin_id: sortedByPrice[0][0],
              magasin_nom: sortedByPrice[0][1].magasin_nom || sortedByPrice[0][0],
              prix_unitaire: sortedByPrice[0][1].prix_unitaire,
              unite: sortedByPrice[0][1].unite
            };
            pire = {
              magasin_id: sortedByPrice[sortedByPrice.length - 1][0],
              magasin_nom: sortedByPrice[sortedByPrice.length - 1][1].magasin_nom || sortedByPrice[sortedByPrice.length - 1][0],
              prix_unitaire: sortedByPrice[sortedByPrice.length - 1][1].prix_unitaire,
              unite: sortedByPrice[sortedByPrice.length - 1][1].unite
            };
          }

          const diffMax = meilleure && pire ? Number((pire.prix_unitaire - meilleure.prix_unitaire).toFixed(2)) : 0;

          transaction.update(productRef, {
            offres_magasins: currentOffers,
            prix_actuel: currentPrices,
            historique_offres: updatedHistory,
            meilleure_offre: meilleure || admin.firestore.FieldValue.delete(),
            pire_offre: pire || admin.firestore.FieldValue.delete(),
            ecart_prix_max: diffMax,
            derniere_mise_a_jour: nowIso,
            nombre_releves: updatedHistory.length
          });
        } else {
          // RÈGLE 2 : Création à la volée du document structuré par Besoin Générique
          const newDoc: GenericProductDocument = {
            nom_generique: nomGeneriqueNettoye.charAt(0).toUpperCase() + nomGeneriqueNettoye.slice(1),
            rayon: aisle.label,
            rayon_cle: aisle.key,
            cle_besoin: cleBesoin,
            offres_magasins: {
              [storeId]: offerDetail
            },
            prix_actuel: {
              [storeId]: {
                prix_unitaire: Number(prixUnitaire.toFixed(2)),
                prix_paye: Number(prixPaye.toFixed(2)),
                quantite,
                date,
                magasin_id: storeId,
                magasin_nom: storeDisplayName,
                receiptId
              }
            },
            historique_offres: [{ ...offerDetail, magasin: storeId }],
            historique_prix: [priceRecord],
            meilleure_offre: {
              magasin_id: storeId,
              magasin_nom: storeDisplayName,
              prix_unitaire: Number(prixUnitaire.toFixed(2)),
              unite: unitMeasure
            },
            derniere_mise_a_jour: nowIso,
            nombre_releves: 1
          };

          transaction.set(productRef, newDoc);
        }
      });
    }

    // 3. Sauvegarde du document Ticket dans la collection 'receipts'
    const fullReceiptDoc = {
      id: receiptId,
      userId,
      storeName: storeDisplayName,
      storeId,
      storeAddress: resolvedStore.address,
      storeCity: resolvedStore.city,
      storePostalCode: resolvedStore.postalCode,
      googleMapsUrl: finalGoogleMapsUrl,
      date,
      time,
      totalArticles: totalArticles ?? totalAmount,
      subtotal: totalArticles ?? totalAmount,
      totalDiscounts: totalDiscount > 0 ? Number(totalDiscount.toFixed(2)) : undefined,
      totalAmount: Number(totalAmount.toFixed(2)),
      items: enrichedReceiptItems,
      cleBesoinCount: processedKeys.length,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    await receiptDocRef.set(fullReceiptDoc);

    return {
      success: true,
      receiptId,
      storeId,
      storeName: storeDisplayName,
      processedItemsCount: enrichedReceiptItems.length,
      cleBesoinList: processedKeys
    };
  });
