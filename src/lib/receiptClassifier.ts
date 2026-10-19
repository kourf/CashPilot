import { 
  type SupermarketAisle, 
  SUPERMARKET_AISLES, 
  type Receipt, 
  type ProductComparisonRow, 
  type ComparativeMatrix,
  type AisleGroup
} from '../types/receipts';

/**
 * Configuration visuelle et ergonomique pour chacun des 8 rayons de grande surface.
 */
export interface AisleMetadata {
  id: SupermarketAisle;
  order: number;
  label: string;
  description: string;
  iconName: string;
  badgeClass: string;
  accentBorder: string;
}

export const AISLE_CONFIGS: Record<SupermarketAisle, AisleMetadata> = {
  'Boucherie, Volaille & Poissonnerie': {
    id: 'Boucherie, Volaille & Poissonnerie',
    order: 1,
    label: 'Boucherie, Volaille & Poissonnerie',
    description: 'Viandes, poissons, volailles, charcuterie',
    iconName: 'Utensils',
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    accentBorder: 'border-l-rose-500'
  },
  'Épicerie salée & Épices': {
    id: 'Épicerie salée & Épices',
    order: 2,
    label: 'Épicerie salée & Épices',
    description: 'Épices, pâtes, riz, huiles, conserves, sauces',
    iconName: 'Package',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    accentBorder: 'border-l-amber-500'
  },
  'Fruits & Légumes': {
    id: 'Fruits & Légumes',
    order: 3,
    label: 'Fruits & Légumes',
    description: 'Primeur, salades, fruits, légumes, herbes fraîches',
    iconName: 'Carrot',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    accentBorder: 'border-l-emerald-500'
  },
  'Produits frais & Crèmerie': {
    id: 'Produits frais & Crèmerie',
    order: 4,
    label: 'Produits frais & Crèmerie',
    description: 'Laits, beurres, crèmes, fromages, yaourts, œufs',
    iconName: 'Milk',
    badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    accentBorder: 'border-l-blue-500'
  },
  'Épicerie sucrée': {
    id: 'Épicerie sucrée',
    order: 5,
    label: 'Épicerie sucrée',
    description: 'Cafés, thés, biscuits, confitures, chocolats, céréales, farines',
    iconName: 'Cookie',
    badgeClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    accentBorder: 'border-l-orange-500'
  },
  'Hygiène, Beauté & Sanitaire': {
    id: 'Hygiène, Beauté & Sanitaire',
    order: 6,
    label: 'Hygiène, Beauté & Sanitaire',
    description: 'Savons, shampoings, dentifrice, papier toilette, cotons',
    iconName: 'Sparkles',
    badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    accentBorder: 'border-l-purple-500'
  },
  'Entretien & Maison': {
    id: 'Entretien & Maison',
    order: 7,
    label: 'Entretien & Maison',
    description: 'Lessive, éponges, produits ménagers, liquide vaisselle',
    iconName: 'Home',
    badgeClass: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    accentBorder: 'border-l-cyan-500'
  },
  'Boissons': {
    id: 'Boissons',
    order: 8,
    label: 'Boissons',
    description: 'Eaux minérales, jus de fruits, sodas, sirops',
    iconName: 'CupSoda',
    badgeClass: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
    accentBorder: 'border-l-teal-500'
  }
};

/**
 * Détermine avec précision le rayon officiel d'un article à partir de son nom.
 */
export function classifyItemAisle(name: string, rawName: string = ''): SupermarketAisle {
  const text = `${name} ${rawName}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // 1. Entretien & Maison (prioritaire pour éviter que "liquide vaisselle citron" soit classé en fruit)
  if (
    /\b(lessives?|adoucissants?|assouplissants?|liquide vaisselle|tablettes? vaisselle|eponges?|essuie-touts?|essuietouts?|sopalins?|nettoyants?|javel|vinaigre blanc|sacs? poubelle|papier alu|film etirable|bicarbonate|desodorisants?|anticalcaires?|degraissants?|serpillieres?|balais?)\b/.test(text)
  ) {
    return 'Entretien & Maison';
  }

  // 2. Hygiène, Beauté & Sanitaire (prioritaire pour éviter que "savon amande / citron" soit classé en aliment)
  if (
    /\b(savons?|gels? douche|shampoings?|apres-shampoings?|dentifrices?|brosses? a dents?|bains? de bouche|papier toilette|pq|papier wc|cotons?|cotons? tiges?|mouchoirs?|deodorants?|cremes? solaire|rasoirs?|mousse a raser|tampons?|serviettes? hygienique|couches?|lingettes?|baumes?)\b/.test(text)
  ) {
    return 'Hygiène, Beauté & Sanitaire';
  }

  // 3. Boucherie, Volaille & Poissonnerie
  if (
    /\b(steaks?|viandes?|boeufs?|haches?|porcs?|poulets?|dindes?|volailles?|saucisses?|merguez|chipolatas?|jambons?|lardons?|charcuteries?|bacons?|boudins?|canards?|veaux?|agneaux?|poissons?|saumons?|cabillauds?|lieux?|merlus?|thons?|crevettes?|moules?|crustaces?|sardines?|truites?|colins?|escalopes?)\b/.test(text)
  ) {
    return 'Boucherie, Volaille & Poissonnerie';
  }

  // 4. Boissons
  if (
    /\b(eaux?|cristaline|evian|volvic|hepar|san pellegrino|perrier|sodas?|coca|pepsi|fanta|sprite|orangina|oasis|ice tea|jus|nectars?|sirops?|bieres?|vins?|cidres?|smoothies?|limonades?|boissons?)\b/.test(text) &&
    !text.includes('yaourt a boire')
  ) {
    return 'Boissons';
  }

  // 5. Fruits & Légumes
  if (
    /\b(pommes?|poires?|bananes?|oranges?|clementines?|mandarines?|citrons?|raisins?|fraises?|framboises?|melons?|pasteques?|peches?|abricots?|kiwis?|mangues?|avocats?|tomates?|salades?|laitues?|maches?|epinards?|carottes?|courgettes?|aubergines?|poivrons?|oignons?|ails?|echalotes?|pommes? de terre|patates?|champignons?|haricots?|brocolis?|choux?|poireaux?|concombres?|radis|primeurs?|bio fruits?)\b/.test(text)
  ) {
    return 'Fruits & Légumes';
  }

  // 6. Produits frais & Crèmerie
  if (
    /\b(laits?|beurres?|cremes?|creme fraiche|yaourts?|fromages?|camemberts?|emmentals?|mozzarellas?|parmesans?|comtes?|gruyeres?|raclettes?|chevres?|bries?|roqueferts?|petit suisse|faisselles?|oeufs?|cottage|fromage blanc)\b/.test(text)
  ) {
    return 'Produits frais & Crèmerie';
  }

  // 7. Épicerie sucrée
  if (
    /\b(cafes?|thes?|tisanes?|infusions?|sucres?|chocolats?|cacao|biscuits?|cookies?|gateaux?|confitures?|miels?|nutella|pates? a tartiner|cereales?|corn flakes|muesli|pains? de mie|brioches?|pains? au chocolat|croissants?|farines?|levures?|vanille|bonbons?|compotes?)\b/.test(text)
  ) {
    return 'Épicerie sucrée';
  }

  // 8. Épicerie salée & Épices (par défaut pour les aliments secs)
  return 'Épicerie salée & Épices';
}

/**
 * Normalise intelligemment les abréviations de caisse courantes en libellés clairs.
 */
export function normalizeProductName(rawName: string): string {
  let cleaned = rawName
    .replace(/\s+/g, ' ')
    .trim();

  // Nettoyage des codes de lot ou préfixes de caisse fréquents (ex: "CARTE", "PROMO", "BIO")
  cleaned = cleaned.replace(/^(art\s*\d+|promo\s*|lot\s*\d+\s*x?\s*)/i, '');

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Calcule avec rigueur d'audit le prix de référence standardisé (€/kg, €/L, ou €/pièce)
 * à partir de la contenance/poids et du prix net payé.
 */
export function computeUnitPrice(
  pricePaid: number,
  weightOrVolume?: string,
  quantity: number = 1
): { unitPrice: number; unit: string } {
  const safeQty = Math.max(1, quantity);
  const safePrice = Math.max(0, pricePaid);

  if (!weightOrVolume || !weightOrVolume.trim()) {
    const unitPrice = safePrice / safeQty;
    return { unitPrice: Number(unitPrice.toFixed(2)), unit: 'pièce' };
  }

  const text = weightOrVolume.trim().toLowerCase().replace(',', '.');

  // Multi-packs (ex: "6x1.5 L", "4x500 g", "6 x 33 cl")
  const multiMatch = text.match(/^(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*(kg|g|l|cl|ml)?$/i);
  if (multiMatch) {
    const packCount = parseFloat(multiMatch[1]);
    const singleAmount = parseFloat(multiMatch[2]);
    const u = multiMatch[3] || 'pièce';
    const totalVolume = packCount * singleAmount;

    if (u === 'kg') {
      const p = safePrice / totalVolume;
      return { unitPrice: Number(p.toFixed(2)), unit: 'kg' };
    }
    if (u === 'g') {
      const kg = totalVolume / 1000;
      const p = kg > 0 ? safePrice / kg : safePrice;
      return { unitPrice: Number(p.toFixed(2)), unit: 'kg' };
    }
    if (u === 'l') {
      const p = safePrice / totalVolume;
      return { unitPrice: Number(p.toFixed(2)), unit: 'L' };
    }
    if (u === 'cl') {
      const l = totalVolume / 100;
      const p = l > 0 ? safePrice / l : safePrice;
      return { unitPrice: Number(p.toFixed(2)), unit: 'L' };
    }
    if (u === 'ml') {
      const l = totalVolume / 1000;
      const p = l > 0 ? safePrice / l : safePrice;
      return { unitPrice: Number(p.toFixed(2)), unit: 'L' };
    }
  }

  // Simple volume/weight (ex: "1.5 L", "500 g", "250 ml", "1 kg", "33 cl")
  const singleMatch = text.match(/^(\d+(?:\.\d+)?)\s*(kg|g|l|cl|ml)\b/i);
  if (singleMatch) {
    const val = parseFloat(singleMatch[1]);
    const u = singleMatch[2];

    if (u === 'kg') {
      const p = val > 0 ? safePrice / val : safePrice;
      return { unitPrice: Number(p.toFixed(2)), unit: 'kg' };
    }
    if (u === 'g') {
      const kg = val / 1000;
      const p = kg > 0 ? safePrice / kg : safePrice;
      return { unitPrice: Number(p.toFixed(2)), unit: 'kg' };
    }
    if (u === 'l') {
      const p = val > 0 ? safePrice / val : safePrice;
      return { unitPrice: Number(p.toFixed(2)), unit: 'L' };
    }
    if (u === 'cl') {
      const l = val / 100;
      const p = l > 0 ? safePrice / l : safePrice;
      return { unitPrice: Number(p.toFixed(2)), unit: 'L' };
    }
    if (u === 'ml') {
      const l = val / 1000;
      const p = l > 0 ? safePrice / l : safePrice;
      return { unitPrice: Number(p.toFixed(2)), unit: 'L' };
    }
  }

  // Fallback to piece
  const unitPrice = safePrice / safeQty;
  return { unitPrice: Number(unitPrice.toFixed(2)), unit: 'pièce' };
}

/**
 * Calculateur haute performance de la matrice comparative Magasins (colonnes) vs Produits (lignes).
 * Strictement basé sur les données réelles (aucun prix externe injecté).
 * Applique la règle du ticket unique et la comparaison au prix unitaire standardisé.
 */
export function buildComparativeMatrix(
  receipts: Receipt[],
  hiddenProductNames: string[] = []
): ComparativeMatrix {
  // Set des produits masqués par l'utilisateur (suppression de la matrice)
  const hiddenSet = new Set(
    hiddenProductNames.map(p => p.trim().toLowerCase())
  );

  // 1. Extraction de la liste unique des enseignes réelles présentes dans les tickets
  const storeSet = new Set<string>();
  receipts.forEach(r => {
    const store = r.storeName?.trim();
    if (store && Array.isArray(r.items) && r.items.length > 0) {
      storeSet.add(store);
    }
  });

  const stores = Array.from(storeSet).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  const receiptsCount = receipts.length;

  // RÈGLE STRICTE D'AUDIT DU TICKET UNIQUE :
  // Si <= 1 ticket enregistré (ou < 2 enseignes distinctes), AUCUNE comparaison n'est calculée.
  const isSingleReceipt = receiptsCount < 2 || stores.length < 2;

  // 2. Indexation des produits par libellé normalisé
  // Clé : normalizedName en minuscule -> Accumulateur de données
  interface ProductAccumulator {
    canonicalName: string;
    category: SupermarketAisle;
    rawNames: Set<string>;
    brands: Set<string>;
    unit: string;
    storePrices: Record<string, {
      storeName: string;
      pricePaid: number;
      unitPrice: number;
      brand: string;
      weightOrVolume: string;
      date: string;
      receiptId: string;
      quantity: number;
      rawName: string;
      unit: string;
    }>;
  }

  const productMap = new Map<string, ProductAccumulator>();

  receipts.forEach(receipt => {
    const receiptStore = receipt.storeName?.trim();
    if (!receiptStore) return;

    receipt.items.forEach(item => {
      const canonical = (item.normalizedName || item.rawName || 'Article').trim();
      const lookupKey = canonical.toLowerCase();

      // Respect de la règle d'audit : ignorer les produits supprimés de la matrice
      if (hiddenSet.has(lookupKey)) return;

      const pricePaid = Number(item.pricePaid ?? item.price) || 0;
      const weightOrVolume = String(item.weightOrVolume || '').trim();
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const computed = computeUnitPrice(pricePaid, weightOrVolume, quantity);
      const unitPrice = Number(item.unitPrice) > 0 ? Number(item.unitPrice) : computed.unitPrice;
      const unit = item.unit || computed.unit;
      const brand = String(item.brand || '').trim();

      if (!productMap.has(lookupKey)) {
        productMap.set(lookupKey, {
          canonicalName: canonical,
          category: item.category || classifyItemAisle(canonical, item.rawName),
          rawNames: new Set<string>(),
          brands: new Set<string>(),
          unit,
          storePrices: {}
        });
      }

      const acc = productMap.get(lookupKey)!;
      if (item.rawName) {
        acc.rawNames.add(item.rawName);
      }
      if (brand) {
        acc.brands.add(brand);
      }

      const currentStored = acc.storePrices[receiptStore];

      // Conserver le relevé de prix le plus récent pour ce magasin
      if (!currentStored || new Date(receipt.date).getTime() >= new Date(currentStored.date).getTime()) {
        acc.storePrices[receiptStore] = {
          storeName: receiptStore,
          pricePaid,
          unitPrice,
          brand,
          weightOrVolume,
          date: receipt.date,
          receiptId: receipt.id,
          quantity,
          rawName: item.rawName || canonical,
          unit
        };
      }
    });
  });

  // 3. Construction des lignes de comparaison de produits
  const allRows: ProductComparisonRow[] = [];
  let totalPotentialSavings = 0;
  const storeWinCount: Record<string, number> = {};

  stores.forEach(s => {
    storeWinCount[s] = 0;
  });

  productMap.forEach(acc => {
    const presentStores = Object.keys(acc.storePrices);
    const storeCount = presentStores.length;
    if (storeCount === 0) return;

    // Règle d'audit : Produit comparable UNIQUEMENT s'il y a >= 2 tickets ET >= 2 magasins pour ce produit
    const isComparable = !isSingleReceipt && storeCount >= 2;
    const unitPrices = presentStores.map(s => acc.storePrices[s].unitPrice).filter(p => p > 0);

    let lowestUnitPrice: number | undefined;
    let highestUnitPrice: number | undefined;
    let cheapestStore: string | undefined;
    let unitPriceDifference: number | undefined;
    let unitPriceDifferencePercent: number | undefined;

    if (isComparable && unitPrices.length >= 2) {
      lowestUnitPrice = Math.min(...unitPrices);
      highestUnitPrice = Math.max(...unitPrices);

      // Trouver le magasin qui propose ce prix unitaire le plus bas
      cheapestStore = presentStores.find(s => acc.storePrices[s].unitPrice === lowestUnitPrice);

      unitPriceDifference = Math.max(0, Number((highestUnitPrice - lowestUnitPrice).toFixed(2)));
      unitPriceDifferencePercent = highestUnitPrice > 0 
        ? Math.round((unitPriceDifference / highestUnitPrice) * 100) 
        : 0;

      if (unitPriceDifference > 0) {
        totalPotentialSavings += unitPriceDifference;
      }

      if (cheapestStore) {
        storeWinCount[cheapestStore] = (storeWinCount[cheapestStore] || 0) + 1;
      }
    } else if (unitPrices.length > 0 && !isSingleReceipt) {
      lowestUnitPrice = unitPrices[0];
      highestUnitPrice = unitPrices[0];
      cheapestStore = presentStores[0];
    }

    allRows.push({
      normalizedName: acc.canonicalName,
      category: acc.category,
      sampleRawNames: Array.from(acc.rawNames),
      sampleBrands: Array.from(acc.brands),
      storePrices: acc.storePrices,
      storeCount,
      status: isComparable ? 'COMPARABLE' : 'UNIQUE',
      lowestUnitPrice,
      highestUnitPrice,
      cheapestStore,
      unitPriceDifference,
      unitPriceDifferencePercent,
      unit: acc.unit,
      lowestPrice: lowestUnitPrice,
      highestPrice: highestUnitPrice,
      priceDifference: unitPriceDifference,
      priceDifferencePercent: unitPriceDifferencePercent
    });
  });

  // 4. Regroupement par Rayons (8 sections standard de supermarché)
  const aisleGroups: AisleGroup[] = SUPERMARKET_AISLES.map(aisle => {
    const productsInAisle = allRows
      .filter(r => r.category === aisle)
      .sort((a, b) => {
        // En premier les produits comparables, puis ordre alphabétique
        if (a.status === 'COMPARABLE' && b.status !== 'COMPARABLE') return -1;
        if (b.status === 'COMPARABLE' && a.status !== 'COMPARABLE') return 1;
        return a.normalizedName.localeCompare(b.normalizedName, 'fr', { sensitivity: 'base' });
      });

    const comparableCount = productsInAisle.filter(p => p.status === 'COMPARABLE').length;

    return {
      aisle,
      products: productsInAisle,
      totalProducts: productsInAisle.length,
      comparableCount
    };
  });

  // 5. Calcul de l'enseigne globalement la plus compétitive
  const totalComparable = allRows.filter(r => r.status === 'COMPARABLE').length;
  let bestStoreGlobal: ComparativeMatrix['bestStoreGlobal'] = undefined;

  if (totalComparable > 0 && !isSingleReceipt) {
    let bestStoreName = '';
    let maxWins = -1;

    Object.entries(storeWinCount).forEach(([store, wins]) => {
      if (wins > maxWins) {
        maxWins = wins;
        bestStoreName = store;
      }
    });

    if (bestStoreName && maxWins > 0) {
      bestStoreGlobal = {
        storeName: bestStoreName,
        cheapestCount: maxWins,
        percentage: Math.round((maxWins / totalComparable) * 100)
      };
    }
  }

  return {
    stores,
    receiptsCount,
    isSingleReceipt,
    aisleGroups,
    totalUniqueProducts: allRows.length,
    totalComparableProducts: isSingleReceipt ? 0 : totalComparable,
    totalPotentialSavings: isSingleReceipt ? 0 : Number(totalPotentialSavings.toFixed(2)),
    bestStoreGlobal: isSingleReceipt ? undefined : bestStoreGlobal
  };
}
