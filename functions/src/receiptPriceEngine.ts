/**
 * MOTEUR D'AUDIT FINANCIER CASHPILOT - EXTRACTION, NORMALISATION ET GESTION DES SUPER CLÉS
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

/**
 * Normalise l'affectation du rayon parmi les 14 catégories strictes avec fallback "Autres / Divers"
 */
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

  // Correspondances heuristiques fiables
  if (clean.includes('boucherie') || clean.includes('poisson') || clean.includes('volaille') || clean.includes('viande')) {
    return { key: 'boucherie_poissonnerie', label: 'Boucherie, Volaille & Poissonnerie' };
  }
  if (clean.includes('epicerie_salee') || clean.includes('epice') || clean.includes('salee') || clean.includes('pates') || clean.includes('riz')) {
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

/**
 * ============================================================================
 * RÈGLE 1 & 2 : LA "SUPER CLÉ" UNIVERSELLE (ID STANDARDISÉ FIRESTORE)
 * Format : [marque]_[nom_generique_nettoye]_[poids_ou_volume]
 * - Ignorer toutes les abréviations du ticket au profit d'un nom clair
 * - Si produit frais ou sans marque explicite -> marque = "generique"
 * ============================================================================
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
      .replace(/[\u0300-\u036f]/g, '') // Supprime les diacritiques
      .replace(/[^a-z0-9]+/g, '_')     // Remplace tout caractère non-alphanumérique par _
      .replace(/_+/g, '_')             // Évite les underscores successifs
      .replace(/^_|_$/g, '');          // Supprime les underscores en bordure
  };

  const rawBrand = (marque || '').trim();
  const rawName = (nomGenerique || '').trim();
  const rawWeight = (poidsOuVolume || '').trim();

  // Détection des produits génériques / sans marque explicite (Règle 2)
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

  // Fallback propre
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
 * Structure de l'article extrait via le format "JSON Strict" de Gemini (Règle 5)
 */
export interface StrictExtractedItem {
  marque: string;
  nom_generique: string;
  poids_ou_volume: string;
  prix_paye: number;
  prix_unitaire_calcule: number;
  unite_mesure: 'kg' | 'L' | 'piece';
  rayon_assigne: string;
  quantite?: number;
  rawName?: string;
}

/**
 * Structure du document Produit Standardisé dans Firestore (Règle 6 : 100% Gratuit)
 * Chemin : users/{userId}/products/{superKey}
 */
export interface StandardizedProductDocument {
  superKey: string;
  marque: string;
  nom_generique: string;
  poids_ou_volume: string;
  unite_mesure: 'kg' | 'L' | 'piece';
  rayon_assigne: LockedSupermarketAisle;
  rayon_cle: string;

  // Dictionnaire des derniers prix connus par magasin physique (coût de lecture = 0)
  prix_actuel: Record<string, {
    prix_unitaire: number; // Prix au kilo, au litre ou à la pièce
    prix_paye: number;
    quantite: number;
    date: string;
    magasin_id: string;
    magasin_nom: string;
    receiptId: string;
  }>;

  // Historique ordonné chronologique des relevés passés
  historique_prix: Array<{
    date: string;
    magasin: string; // storeId
    magasin_nom: string;
    prix_unitaire: number;
    prix_paye: number;
    quantite: number;
    receiptId: string;
  }>;

  meilleur_magasin?: {
    storeId: string;
    storeName: string;
    prix_unitaire: number;
  };
  pire_magasin?: {
    storeId: string;
    storeName: string;
    prix_unitaire: number;
  };
  ecart_prix_max?: number;
  derniere_mise_a_jour: string;
  nombre_releves: number;
}

/**
 * ============================================================================
 * CLOUD FUNCTION : Traitement atomique du ticket & mise à jour des produits
 * Met à jour à la fois le ticket et la collection standardisée des produits
 * avec un coût d'infrastructure et de requêtes de 0 €.
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

    // 1. Résolution physique du magasin
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

    const processedSuperKeys: string[] = [];
    const enrichedReceiptItems: any[] = [];

    // 2. Traitement de chaque article et mise à jour des produits
    for (const rawItem of items as StrictExtractedItem[]) {
      const marque = (rawItem.marque || '').trim();
      const nomGenerique = (rawItem.nom_generique || '').trim();
      const poidsOuVolume = (rawItem.poids_ou_volume || '').trim();
      const prixPaye = Number(rawItem.prix_paye) || 0;
      const quantite = Math.max(1, Number(rawItem.quantite) || 1);
      
      // Règle 3 : Prix unitaire de référence
      let prixUnitaire = Number(rawItem.prix_unitaire_calcule) || 0;
      if (prixUnitaire <= 0 && quantite > 0) {
        prixUnitaire = Number((prixPaye / quantite).toFixed(2));
      }

      // Règle 1 : Super Clé universelle
      const superKey = generateSuperKey(marque, nomGenerique, poidsOuVolume);
      processedSuperKeys.push(superKey);

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
        id: `item-${superKey}-${receiptId.slice(-4)}`,
        superKey,
        rawName: rawItem.rawName || `${nomGenerique} ${poidsOuVolume}`,
        normalizedName: nomGenerique.charAt(0).toUpperCase() + nomGenerique.slice(1),
        brand: marque && marque.toLowerCase() !== 'generique' ? (marque.charAt(0).toUpperCase() + marque.slice(1)) : 'Générique',
        pricePaid: Number(prixPaye.toFixed(2)),
        quantity: quantite,
        weightOrVolume: poidsOuVolume,
        unitPrice: Number(prixUnitaire.toFixed(2)),
        referenceUnitPrice: Number(prixUnitaire.toFixed(2)),
        unit: unitMeasure,
        category: aisle.label,
        categoryKey: aisle.key,
        storeId,
        storeName: storeDisplayName
      };
      enrichedReceiptItems.push(receiptItemEnriched);

      // Transaction / mise à jour du document Produit Standardisé
      const productRef = productsCollectionRef.doc(superKey);
      await db.runTransaction(async (transaction) => {
        const productSnap = await transaction.get(productRef);

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
          const prodData = productSnap.data() as StandardizedProductDocument;
          const currentPrices = prodData.prix_actuel || {};

          // Mise à jour du dictionnaire de prix actuel pour ce magasin
          currentPrices[storeId] = {
            prix_unitaire: Number(prixUnitaire.toFixed(2)),
            prix_paye: Number(prixPaye.toFixed(2)),
            quantite,
            date,
            magasin_id: storeId,
            magasin_nom: storeDisplayName,
            receiptId
          };

          // Ajout à l'historique chronologique
          const existingHistory = Array.isArray(prodData.historique_prix) ? prodData.historique_prix : [];
          // Évite l'insertion de doublons stricts pour le même ticket
          const filteredHistory = existingHistory.filter(h => !(h.receiptId === receiptId && h.magasin === storeId));
          const updatedHistory = [...filteredHistory, priceRecord].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          // Recalcul du meilleur et pire magasin
          const storeEntries = Object.entries(currentPrices);
          let meilleur: { storeId: string; storeName: string; prix_unitaire: number } | undefined;
          let pire: { storeId: string; storeName: string; prix_unitaire: number } | undefined;

          if (storeEntries.length > 0) {
            const sortedByPrice = [...storeEntries].sort((a, b) => a[1].prix_unitaire - b[1].prix_unitaire);
            meilleur = {
              storeId: sortedByPrice[0][0],
              storeName: sortedByPrice[0][1].magasin_nom,
              prix_unitaire: sortedByPrice[0][1].prix_unitaire
            };
            pire = {
              storeId: sortedByPrice[sortedByPrice.length - 1][0],
              storeName: sortedByPrice[sortedByPrice.length - 1][1].magasin_nom,
              prix_unitaire: sortedByPrice[sortedByPrice.length - 1][1].prix_unitaire
            };
          }

          const diffMax = meilleur && pire ? Number((pire.prix_unitaire - meilleur.prix_unitaire).toFixed(2)) : 0;

          transaction.update(productRef, {
            prix_actuel: currentPrices,
            historique_prix: updatedHistory,
            meilleur_magasin: meilleur || admin.firestore.FieldValue.delete(),
            pire_magasin: pire || admin.firestore.FieldValue.delete(),
            ecart_prix_max: diffMax,
            derniere_mise_a_jour: nowIso,
            nombre_releves: updatedHistory.length
          });
        } else {
          // Création à la volée du nouveau produit standardisé
          const newDoc: StandardizedProductDocument = {
            superKey,
            marque: marque || 'generique',
            nom_generique: nomGenerique,
            poids_ou_volume: poidsOuVolume,
            unite_mesure: unitMeasure,
            rayon_assigne: aisle.label,
            rayon_cle: aisle.key,
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
            historique_prix: [priceRecord],
            meilleur_magasin: {
              storeId,
              storeName: storeDisplayName,
              prix_unitaire: Number(prixUnitaire.toFixed(2))
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
      superKeysCount: processedSuperKeys.length,
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
      superKeys: processedSuperKeys
    };
  });
