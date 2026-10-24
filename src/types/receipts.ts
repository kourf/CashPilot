/**
 * Types TypeScript stricts pour le module "Ticket de caisse" et la matrice comparative.
 * Respect rigoureux du cahier des charges d'audit financier CashPilot (zéro type any).
 */

export const SUPERMARKET_AISLE_KEYS = [
  'boucherie_poissonnerie',
  'epicerie_salee',
  'fruits_legumes',
  'frais_cremerie',
  'epicerie_sucree',
  'hygiene_beaute',
  'entretien_maison',
  'boissons',
  'maison_textile_culture',
  'sante_pharmacie',
  'papeterie_bureau',
  'fleurs_cadeaux',
  'sacs_consignes',
  'autres_divers'
] as const;

export type SupermarketAisleKey = typeof SUPERMARKET_AISLE_KEYS[number];

export const SUPERMARKET_AISLES = [
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

export type SupermarketAisle = typeof SUPERMARKET_AISLES[number];

/**
 * Article individuel extrait ou saisi d'un ticket de caisse
 */
export interface ReceiptItem {
  id: string;
  rawName: string; // Nom brut sur le ticket (ex: "COLA ZERO FREW 1.5L")
  normalizedName: string; // Nom générique du produit nettoyé de la marque (ex: "Cola gazeux sans sucres")
  brand: string; // Marque constatée (ex: "Freeway", "Coca-Cola", "Marque Repère", "Générique")
  pricePaid: number; // Prix total TTC de la ligne payé en caisse (ex: 3.70 pour 2 x 1.85)
  quantity: number; // Quantité achetée (ex: 2)
  weightOrVolume: string; // Contenance formatée (ex: "1.5 L", "500 g", "1 kg", "6x1.5 L")
  weightOrVolumeValue?: number; // Valeur numérique (ex: 1.5, 500, 75)
  weightOrVolumeUnit?: string; // Unité ('kg', 'g', 'l', 'cl', 'piece')
  unitPrice: number; // Prix de référence standardisé (€/kg ou €/L ou €/pièce) pour comparaison équitable
  referenceUnitPrice?: number; // Calcul automatique du prix unitaire de référence
  category: SupermarketAisle | string; // Affectation à l'un des 8 rayons standards ou Autres / Divers
  categoryKey?: SupermarketAisleKey; // Clé normalisée (ex: 'boissons')
  unit: string; // Unité standardisée ("L", "kg", "pièce")
  price?: number; // Alias rétrocompatible vers pricePaid
  storeId?: string; // Identifiant unique du magasin physique exact (ex: 'intermarche_gaillard', 'carrefour_market_annemasse')
  storeName?: string; // Nom officiel localisé du magasin (ex: 'Intermarché - Gaillard', 'Carrefour Market Annemasse')
  superKey?: string; // Super Clé standardisée ([marque]_[nom_generique]_[poids_ou_volume])
  cle_besoin?: string; // Clé de Besoin Générique (ex: "sauce_burger")
  formatExact?: string; // Format / contenance exacte lue sur le ticket (ex: "510g")
  marque?: string; // Alias vers brand
  nomGenerique?: string; // Alias vers normalizedName
}

/**
 * Entité Ticket de caisse enregistrée dans Firestore (users/{userId}/receipts/{id})
 */
export interface Receipt {
  id: string;
  userId: string;
  storeName: string; // Nom de l'enseigne ET ville/localisation (ex: "Intermarché - Gaillard", "E.Leclerc - Ville-la-Grand")
  storeId?: string; // Identifiant physique unique (ex: "intermarche_gaillard", "intermarche_annemasse")
  storeAddress?: string; // Adresse complète extraite de l'en-tête (ex: "5 Rue René Cassin")
  storeCity?: string; // Ville (ex: "Gaillard")
  storePostalCode?: string; // Code postal (ex: "74240")
  googleMapsUrl?: string; // Lien direct Google Maps vérifié
  date: string; // Format ISO YYYY-MM-DD
  time?: string; // Heure de passage en caisse au format HH:mm (ex: "14:32")
  totalArticles?: number; // Total brut des articles TTC avant remises
  subtotal?: number; // Sous-total brut des articles TTC (synonyme de totalArticles)
  totalDiscounts?: number; // Montant total des remises / bons immédiats
  totalAmount: number; // Total final net payé en caisse
  items: ReceiptItem[];
  createdAt: string;
  updatedAt?: string;
  rawFileCount?: number;
}

/**
 * Relevé de prix réel constaté dans un magasin pour un produit spécifique
 */
export interface StorePriceDetail {
  storeName: string;
  storeId?: string;
  googleMapsUrl?: string;
  pricePaid: number;
  unitPrice: number;
  brand: string;
  weightOrVolume: string;
  date: string;
  time?: string;
  receiptId: string;
  quantity: number;
  rawName: string;
  unit: string;
}

export type ProductComparisonStatus = 'UNIQUE' | 'COMPARABLE';

export type PriceEvolutionType = 'HIKE' | 'DROP' | 'STABLE';

export interface PriceEvolutionInfo {
  status: PriceEvolutionType;
  message: string;
  diffUnitPrice: number; // Différence positive ou négative en €/u
  currentUnitPrice?: number;
  previousDate: string;
  previousUnitPrice: number;
  previousStore?: string;
}

/**
 * Ligne de la matrice comparative représentant un produit normalisé
 * croisé avec l'ensemble des enseignes réelles auditées
 */
export interface ProductComparisonRow {
  normalizedName: string;
  category: SupermarketAisle;
  categoryKey: SupermarketAisleKey;
  sampleRawNames: string[];
  sampleBrands: string[];
  storePrices: Record<string, StorePriceDetail>; // Enseigne -> Détails du dernier prix constaté
  priceHistory: StorePriceDetail[]; // Tous les relevés historiques chronologiques pour ce produit
  priceEvolution?: PriceEvolutionInfo; // Évolution textuelle explicite selon règle 5
  storeCount: number; // Nombre d'enseignes distinctes où ce produit a été acheté
  status: ProductComparisonStatus;
  lowestUnitPrice?: number; // Prix de référence (€/kg ou €/L) le plus avantageux
  highestUnitPrice?: number;
  cheapestStore?: string;
  unitPriceDifference?: number; // highestUnitPrice - lowestUnitPrice en €
  unitPriceDifferencePercent?: number; // Écart en % par rapport au magasin le plus cher
  unit: string; // "L", "kg", "pièce"
  lowestPrice?: number; // Alias rétrocompatible
  highestPrice?: number;
  priceDifference?: number;
  priceDifferencePercent?: number;
}

/**
 * Groupe de rayon contenant les produits associés
 */
export interface AisleGroup {
  aisle: SupermarketAisle;
  key: SupermarketAisleKey;
  products: ProductComparisonRow[];
  totalProducts: number;
  comparableCount: number;
}

/**
 * Vue globale de la matrice comparative calculée en mémoire (coût Firestore = 0)
 */
export interface ComparativeMatrix {
  stores: string[]; // Liste ordonnée des magasins réels audités
  storeMetadata?: Record<string, { id: string; displayName: string; googleMapsUrl?: string; address?: string }>;
  receiptsCount: number; // Nombre total de tickets enregistrés
  isSingleReceipt: boolean; // Vrai si < 2 tickets (règle du ticket unique : comparaison désactivée)
  aisleGroups: AisleGroup[];
  totalUniqueProducts: number;
  totalComparableProducts: number;
  totalPotentialSavings: number; // Somme des écarts de prix pour les produits comparables
  bestStoreGlobal?: {
    storeName: string;
    cheapestCount: number;
    percentage: number;
  };
}

/**
 * Clé unique stricte d'anti-doublon (Règle 4) :
 * Nom du Magasin + Date + Heure/Minute + Montant Total
 */
export function getReceiptUniqueKey(
  storeName: string, 
  date: string, 
  time: string = '12:00', 
  totalAmount: number
): string {
  const cleanStore = storeName.trim().toLowerCase().replace(/\s+/g, ' ');
  const cleanDate = date.trim();
  const cleanTime = (time || '12:00').trim().slice(0, 5); // Conserve HH:mm
  const cleanAmount = Number(totalAmount || 0).toFixed(2);
  return `${cleanStore}__${cleanDate}__${cleanTime}__${cleanAmount}`;
}

/**
 * ============================================================================
 * LA "SUPER CLÉ" UNIVERSELLE (ID STANDARDISÉ FIRESTORE)
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

  // Règle 2 : Produits frais ou sans marque explicite -> marque = "generique"
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
 * Document Produit Standardisé dans Firestore (Règle 6 : 100% Gratuit)
 * Collection : users/{userId}/products/{superKey}
 */
export interface StandardizedProductDoc {
  superKey: string;
  marque: string;
  nom_generique: string;
  poids_ou_volume: string;
  unite_mesure: 'kg' | 'L' | 'piece';
  rayon_assigne: SupermarketAisle;
  rayon_cle: SupermarketAisleKey;

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
 * RÈGLE 2 : NOUVELLE STRUCTURE FIRESTORE (100% GRATUITE)
 * Regroupe les offres par magasin sous la Clé de Besoin Générique
 * ============================================================================
 */
export interface StoreOfferDetail {
  prix_unitaire: number; // Prix au kilo, au litre ou à la pièce (€/kg, €/L, €/u)
  unite: string; // "kg", "L", "piece"
  prix_paye: number; // Prix facial payé en caisse
  marque: string; // Marque du produit ("Super U", "Marque Repère", "Générique", etc.)
  format: string; // Format / contenance lue ("500g", "510g", "1.5L", etc.)
  date: string; // Date du relevé YYYY-MM-DD
  magasin_nom?: string; // Nom officiel du magasin (ex: "Super U Étrembières")
  magasin_id?: string; // ID physique (ex: "super_u_etrembieres")
  receiptId?: string; // ID du ticket source
  rawName?: string; // Nom brut sur le ticket
}

export interface PriceHistoryItem {
  date: string;
  magasin: string;
  prix_unitaire: number;
}

export interface GenericProductDoc {
  nom_generique: string; // Nom générique propre (ex: "Sauce Burger")
  rayon: SupermarketAisle | string; // Libellé officiel du rayon (ex: "Épicerie salée & Épices")
  rayon_cle?: SupermarketAisleKey; // Clé normalisée (ex: "epicerie_salee")
  cle_besoin?: string; // Clé normalisée unique (ex: "sauce_burger")
  offres_magasins: Record<string, StoreOfferDetail>; // Magasin -> Offre la plus récente
  historique_prix?: PriceHistoryItem[]; // Historique strict des prix { date, magasin, prix_unitaire }
  historique_offres?: Array<StoreOfferDetail & { magasin: string }>;
  derniere_mise_a_jour?: string;
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
}

export const KNOWN_BRANDS_AND_STORES = [
  'super u', 'u', 'leclerc', 'e leclerc', 'e.leclerc', 'marque repere', 'carrefour', 'carrefour market',
  'intermarche', 'lidl', 'aldi', 'auchan', 'monoprix', 'casino', 'cora', 'franprix',
  'leader price', 'danone', 'barilla', 'panzani', 'heinz', 'amora', 'president', 
  'cristaline', 'volvic', 'evian', 'coca cola', 'coca-cola', 'freeway', 'milka', 'nestle',
  'harry s', 'harrys', 'harry', 'lu', 'oreo', 'jafad', 'lesieur', 'candia', 'lactel', 'pepsi',
  'bonduelle', 'fleury michon', 'herta', 'knorr', 'maggi', 'maille', 'paysan breton', 'elle vire'
] as const;

export const KNOWN_PACKAGING_WORDS = [
  'flacon', 'flacons', 'bouteille', 'bouteilles', 'brique', 'briques', 'boite', 'boites',
  'sachet', 'sachets', 'pot', 'pots', 'pack', 'packs', 'filet', 'filets', 
  'barquette', 'barquettes', 'lot', 'lots', 'tube', 'tubes', 'etui', 'etuis',
  'canette', 'canettes', 'portion', 'portions', 'souple', 'pet', 'bidon', 'bidons',
  'verre', 'plastique', 'bocal', 'bocaux', 'conserve', 'recharge', 'squeeze', 'squeez',
  'carton', 'poche', 'spray', 'doypack', 'vrac'
] as const;

export const KNOWN_MARKETING_WORDS = [
  'pur', 'pure', 'nature', 'complet', 'complete', 'croustillant', 'croustillante',
  'croustille', 'douceur', 'moelleux', 'moelleuse', 'sandwich', 'toast', 'extra fin',
  'extra fins', 'delicieux', 'fondant', 'gourmand', 'savoureux', 'traditionnel',
  'supreme', 'recette', 'just au four', 'au four', 'format familial', 'familial', 
  'eco', 'rapide', 'cuisson', 'petit', 'petite', 'grand', 'grande', 'maxi', 'mini',
  'uht', 'frais', 'fraiche', 'fraiches'
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
/**
 * RÈGLE 1 : NETTOYAGE EXTRÊME - RÉDUCTION À L'ESSENCE STRICTE DU BESOIN
 * Isole uniquement le besoin consommateur en éliminant :
 * - Marques (ex: Harry's, U, Leclerc, Lu)
 * - Emballages / Conditionnements (ex: Pet, Bocal, Sachet, Bidon, Flacon, Brique)
 * - Contenances / Quantités (ex: Kg, 825g, 1Litre, 1.5L, 6x1L)
 * - Adjectifs marketing / superflus (ex: Croustillant, Douceur, Moelleux, Nature, Complet, Sandwich)
 */
export function cleanGenericEssence(rawName?: string, brand?: string): string {
  if (!rawName || typeof rawName !== 'string') return 'produit';

  let s = rawName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-_'/]/g, ' ');

  if (brand && typeof brand === 'string') {
    const b = brand.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (b && b !== 'generique' && b !== 'générique') {
      s = s.replace(new RegExp('\\b' + b.replace(/[^a-z0-9]/g, '\\s*') + '\\b', 'gi'), ' ');
    }
  }

  // Normalisation des fractions (ex: 1/2 ou 1 2 -> demi)
  s = s.replace(/\b1\s*[/_-\s]?\s*2\b/g, 'demi');

  // Suppression des formats et quantités numériques (ex: "500g", "825g", "1.5l", "6x1l", "4x100g", "1litre")
  s = s.replace(/\b\d+([.,]\d+)?\s*(kg|g|mg|l|cl|ml|piece|pieces|unite|unites|tranches?)\b/gi, ' ');
  s = s.replace(/\b\d+\s*x\s*\d+([.,]\d+)?\s*(kg|g|mg|l|cl|ml)?\b/gi, ' ');
  s = s.replace(/\bx\s*\d+\b/gi, ' ');
  s = s.replace(/\b\d+\s*(litre|litres|kilo|kilos|gramme|grammes)\b/gi, ' ');
  s = s.replace(/\b\d+([.,]\d+)?\b/gi, ' ');

  // Suppression des marques
  for (const b of KNOWN_BRANDS_AND_STORES) {
    s = s.replace(new RegExp('\\b' + b.replace(/[^a-z0-9]/g, '\\s*') + '\\b', 'gi'), ' ');
  }

  // Suppression du conditionnement
  for (const w of KNOWN_PACKAGING_WORDS) {
    s = s.replace(new RegExp('\\b' + w + '\\b', 'gi'), ' ');
  }

  // Suppression du marketing
  for (const m of KNOWN_MARKETING_WORDS) {
    s = s.replace(new RegExp('\\b' + m + '\\b', 'gi'), ' ');
  }

  // Remplacement des faux-amis / normalisations canoniques françaises
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

export function generateGenericNeedKey(rawName?: string, brand?: string): string {
  const essence = cleanGenericEssence(rawName, brand);
  return essence.replace(/\s+/g, '_') || 'produit';
}

export function sanitizeGenericDisplayName(rawName?: string, brand?: string): string {
  const essence = cleanGenericEssence(rawName, brand);
  const canonicalMap: Record<string, string> = {
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

/**
 * RÈGLE D'ORTHOGRAPHE ET DE STANDARDISATION :
 * Corrige les coquilles OCR ("B Uf" -> "Bœuf", accents manquants, abréviations).
 */
export function correctFrenchSpelling(str?: string): string {
  if (!str || typeof str !== 'string') return '';
  let s = str.trim();

  const corrections: Array<[RegExp, string]> = [
    [/\bb\s*u+f\b/gi, 'bœuf'],
    [/\bboeuf\b/gi, 'bœuf'],
    [/\bsteack\b/gi, 'steak'],
    [/\bsteacks\b/gi, 'steaks'],
    [/\bpomm?\s+terre\b/gi, 'pommes de terre'],
    [/\bpomme\s+de\s+terre\b/gi, 'pommes de terre'],
    [/\bcreme\b/gi, 'crème'],
    [/\bfraiche\b/gi, 'fraîche'],
    [/\bpate\b/gi, 'pâte'],
    [/\bpates\b/gi, 'pâtes'],
    [/\becreme\b/gi, 'écrémé'],
    [/\becremee\b/gi, 'écrémée'],
    [/\boeuf\b/gi, 'œuf'],
    [/\boeufs\b/gi, 'œufs'],
    [/\bhache\b/gi, 'haché'],
    [/\bhachee\b/gi, 'hachée'],
    [/\brot\b/gi, 'rôti'],
    [/\broti\b/gi, 'rôti'],
    [/\bglace\b/gi, 'glacée'],
    [/\bvolaill\b/gi, 'volaille'],
    [/\bpoiss\b/gi, 'poisson'],
    [/\bfeuilletee\b/gi, 'feuilletée'],
    [/\bbrisee\b/gi, 'brisée'],
    [/\bsurgel\b/gi, 'surgelé'],
    [/\bsurgele\b/gi, 'surgelé'],
    [/\beleve\b/gi, 'élevé'],
    [/\bfrancais\b/gi, 'français'],
    [/\bfrancaise\b/gi, 'française']
  ];

  for (const [regex, replacement] of corrections) {
    s = s.replace(regex, replacement);
  }

  if (s.length > 0) {
    s = s.charAt(0).toUpperCase() + s.slice(1);
  }
  return s;
}


