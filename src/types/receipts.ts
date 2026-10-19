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
}

/**
 * Entité Ticket de caisse enregistrée dans Firestore (users/{userId}/receipts/{id})
 */
export interface Receipt {
  id: string;
  userId: string;
  storeName: string; // Nom de l'enseigne ET ville/localisation (ex: "E.Leclerc Ville-la-Grand")
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
