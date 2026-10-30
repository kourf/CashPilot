import { 
  type SupermarketAisle, 
  type SupermarketAisleKey,
  SUPERMARKET_AISLES, 
  SUPERMARKET_AISLE_KEYS,
  type Receipt, 
  type ProductComparisonRow, 
  type ComparativeMatrix,
  type AisleGroup,
  type StandardizedProductDoc,
  type GenericProductDoc,
  type StorePriceDetail,
  type PriceEvolutionInfo,
  generateSuperKey,
  generateGenericNeedKey,
  normalizeProductNeed,
  KNOWN_BRANDS_AND_STORES
} from '../types/receipts.ts';
import { resolvePhysicalStore, TARGET_PHYSICAL_STORES, type PhysicalStoreDefinition } from './storeRegistry.ts';

export const AISLE_KEY_TO_LABEL: Record<SupermarketAisleKey, SupermarketAisle> = {
  boucherie_poissonnerie: 'Boucherie, Volaille & Poissonnerie',
  epicerie_salee: 'Épicerie salée & Épices',
  fruits_legumes: 'Fruits & Légumes',
  frais_cremerie: 'Produits frais & Crèmerie',
  epicerie_sucree: 'Épicerie sucrée',
  hygiene_beaute: 'Hygiène, Beauté & Sanitaire',
  entretien_maison: 'Entretien & Maison',
  boissons: 'Boissons',
  maison_textile_culture: 'Maison, Textile & Culture',
  sante_pharmacie: 'Santé & Pharmacie',
  papeterie_bureau: 'Papeterie & Bureau',
  fleurs_cadeaux: 'Fleurs & Cadeaux',
  sacs_consignes: 'Sacs & Consignes',
  autres_divers: 'Autres / Divers'
};

export const AISLE_LABEL_TO_KEY: Record<SupermarketAisle, SupermarketAisleKey> = {
  'Boucherie, Volaille & Poissonnerie': 'boucherie_poissonnerie',
  'Épicerie salée & Épices': 'epicerie_salee',
  'Fruits & Légumes': 'fruits_legumes',
  'Produits frais & Crèmerie': 'frais_cremerie',
  'Épicerie sucrée': 'epicerie_sucree',
  'Hygiène, Beauté & Sanitaire': 'hygiene_beaute',
  'Entretien & Maison': 'entretien_maison',
  'Boissons': 'boissons',
  'Maison, Textile & Culture': 'maison_textile_culture',
  'Santé & Pharmacie': 'sante_pharmacie',
  'Papeterie & Bureau': 'papeterie_bureau',
  'Fleurs & Cadeaux': 'fleurs_cadeaux',
  'Sacs & Consignes': 'sacs_consignes',
  'Autres / Divers': 'autres_divers'
};

/**
 * Normalise n'importe quelle clé ou libellé de catégorie (slug, label complet, partiel sans accent)
 * vers sa clé canonique et son libellé officiel strict.
 * Si inconnu, bascule sur 'autres_divers' / 'Autres / Divers' comme filet de sécurité.
 */
export function normalizeAisle(input?: string): { key: SupermarketAisleKey; label: SupermarketAisle } {
  if (!input || typeof input !== 'string') {
    return { key: 'autres_divers', label: 'Autres / Divers' };
  }

  const trimmed = input.trim();

  // 1. Correspondance directe avec une clé slug connue
  if (trimmed in AISLE_KEY_TO_LABEL) {
    const k = trimmed as SupermarketAisleKey;
    return { key: k, label: AISLE_KEY_TO_LABEL[k] };
  }

  // 2. Correspondance directe avec un libellé officiel exact
  if (trimmed in AISLE_LABEL_TO_KEY) {
    const l = trimmed as SupermarketAisle;
    return { key: AISLE_LABEL_TO_KEY[l], label: l };
  }

  // 3. Normalisation phonétique / sans accents
  const clean = trimmed
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  if (clean.includes('boucherie') || clean.includes('poisson') || clean.includes('volaille') || clean.includes('viande')) {
    return { key: 'boucherie_poissonnerie', label: 'Boucherie, Volaille & Poissonnerie' };
  }
  if (clean.includes('epicerie_salee') || clean.includes('epice') || clean.includes('salee') || clean.includes('conserve') || clean.includes('sauce')) {
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
  if (clean.includes('entretien') || clean.includes('maison') || clean.includes('menage') || clean.includes('lessive') || clean.includes('vaisselle')) {
    return { key: 'entretien_maison', label: 'Entretien & Maison' };
  }
  if (clean.includes('boisson') || clean.includes('soda') || clean.includes('eau') || clean.includes('jus') || clean.includes('sirop')) {
    return { key: 'boissons', label: 'Boissons' };
  }
  if (clean.includes('papeterie') || clean.includes('bureau') || clean.includes('stylo') || clean.includes('cahier') || clean.includes('classeur') || clean.includes('fourniture_scolaire')) {
    return { key: 'papeterie_bureau', label: 'Papeterie & Bureau' };
  }
  if (clean.includes('fleur') || clean.includes('cadeau') || clean.includes('plante') || clean.includes('bouquet') || clean.includes('bougie') || clean.includes('emballage_cadeau')) {
    return { key: 'fleurs_cadeaux', label: 'Fleurs & Cadeaux' };
  }
  if (clean.includes('maison_textile') || clean.includes('textile') || clean.includes('culture') || clean.includes('livre') || clean.includes('vaisselle') || clean.includes('drap') || clean.includes('electromenager') || clean.includes('bazar')) {
    return { key: 'maison_textile_culture', label: 'Maison, Textile & Culture' };
  }
  if (clean.includes('sante') || clean.includes('pharmacie') || clean.includes('parapharmacie') || clean.includes('pansement') || clean.includes('vitamine') || clean.includes('medicament') || clean.includes('test')) {
    return { key: 'sante_pharmacie', label: 'Santé & Pharmacie' };
  }
  if (clean.includes('sac') || clean.includes('cabas') || clean.includes('consigne')) {
    return { key: 'sacs_consignes', label: 'Sacs & Consignes' };
  }

  return { key: 'autres_divers', label: 'Autres / Divers' };
}

/**
 * Configuration visuelle et ergonomique pour chacun des rayons de grande surface (+ filet de sécurité).
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
  },
  'Maison, Textile & Culture': {
    id: 'Maison, Textile & Culture',
    order: 9,
    label: 'Maison, Textile & Culture',
    description: 'Livres, vaisselle, draps, électroménager, bazar, vêtements',
    iconName: 'BookOpen',
    badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    accentBorder: 'border-l-indigo-500'
  },
  'Santé & Pharmacie': {
    id: 'Santé & Pharmacie',
    order: 10,
    label: 'Santé & Pharmacie',
    description: 'Parapharmacie, tests, pansements, compléments, soins médicaux',
    iconName: 'HeartPulse',
    badgeClass: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    accentBorder: 'border-l-red-500'
  },
  'Papeterie & Bureau': {
    id: 'Papeterie & Bureau',
    order: 11,
    label: 'Papeterie & Bureau',
    description: 'Cahiers, stylos, fournitures scolaires, classeurs, papier, enveloppes',
    iconName: 'FileText',
    badgeClass: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
    accentBorder: 'border-l-violet-500'
  },
  'Fleurs & Cadeaux': {
    id: 'Fleurs & Cadeaux',
    order: 12,
    label: 'Fleurs & Cadeaux',
    description: 'Bouquets, plantes, emballages cadeaux, bougies décoratives, cartes',
    iconName: 'Flower2',
    badgeClass: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
    accentBorder: 'border-l-pink-500'
  },
  'Sacs & Consignes': {
    id: 'Sacs & Consignes',
    order: 13,
    label: 'Sacs & Consignes',
    description: 'Sacs cabas, sacs réutilisables, consignes de bouteilles',
    iconName: 'ShoppingBag',
    badgeClass: 'bg-amber-600/10 text-amber-700 dark:text-amber-400 border-amber-600/20',
    accentBorder: 'border-l-amber-600'
  },
  'Autres / Divers': {
    id: 'Autres / Divers',
    order: 14,
    label: 'Autres / Divers',
    description: 'Articles non classés ou divers',
    iconName: 'MoreHorizontal',
    badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
    accentBorder: 'border-l-slate-500'
  }
};

/**
 * Détermine avec précision le rayon officiel d'un article à partir de son nom.
 */
export function classifyItemAisle(name: string, rawName: string = ''): SupermarketAisle {
  const text = `${name} ${rawName}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // 0. Sacs & Consignes (prioritaire absolu)
  if (
    /\b(sacs? cabas|cabas|sacs? reutilisables?|sacs? kraft|sacs? plastique|consignes?|consignations?|bouteilles? consignee)\b/.test(text)
  ) {
    return 'Sacs & Consignes';
  }

  // 0.bis Santé & Pharmacie (dépollue le budget alimentation)
  if (
    /\b(parapharmacies?|pansements?|compresses?|desinfectants?|antiseptiques?|tests? covid|autotests?|vitamines?|complements? alimentaires?|dolipranes?|paracetamol|pastilles? gorge|arnica|gel hydroalcoolique|thermometres?|masques?|serum phy|biseptine|preservatifs?)\b/.test(text)
  ) {
    return 'Santé & Pharmacie';
  }

  // 0.ter Papeterie & Bureau (dépollue le budget alimentation)
  if (
    /\b(stylos?|cahiers?|classeurs?|feutres?|crayons?|gommes?|regles?|colles?|ciseaux?|enveloppes?|blocs? notes?|scotchs?|rubans? adhesifs?|chemises? cartonnees?|feuilles? simples?|feuilles? doubles?|agrafes?|agrafeuses?|post-it|fournitures? scolaires?|intercalaires?|surligneurs?|pochettes? plastiques?|papeteries?|papier a4|papier imprimante)\b/.test(text)
  ) {
    return 'Papeterie & Bureau';
  }

  // 0.quater Fleurs & Cadeaux (dépollue le budget alimentation)
  if (
    /\b(fleurs?|bouquets?|plantes?|roses?|tulipes?|orchidees?|compositions? florales?|papiers? cadeaux?|bolducs?|cartes? postales?|cartes? de voeux?|bougies? parfumees?|bougies? decoratives?|coffrets? cadeaux?|emballages? cadeaux?)\b/.test(text)
  ) {
    return 'Fleurs & Cadeaux';
  }

  // 0.quinquies Maison, Textile & Culture (dépollue le budget alimentation)
  if (
    /\b(livres?|romans?|magazines?|journaux?|bd|mangas?|vaisselles?|assiettes?|verres?|casseroles?|poeles?|couverts?|draps?|serviettes? de bain|torchons?|oreillers?|couettes?|ampoules?|piles?|electromenagers?|grille-pain|bouilloires?|cafetieres?|cables?|chargeurs?|ecouteurs?|textiles?|t-shirts?|chaussettes?|calecons?|slips?|pyjamas?)\b/.test(text)
  ) {
    return 'Maison, Textile & Culture';
  }

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
  quantity: number = 1,
  weightOrVolumeValue?: number,
  weightOrVolumeUnit?: string
): { unitPrice: number; unit: string } {
  const safeQty = Math.max(1, quantity);
  const safePrice = Math.max(0, pricePaid);

  // 1. Calcul prioritaire si valeur et unité numériques sont directement fournies
  if (typeof weightOrVolumeValue === 'number' && weightOrVolumeValue > 0 && weightOrVolumeUnit) {
    const u = weightOrVolumeUnit.toLowerCase().trim();
    if (u === 'kg') {
      return { unitPrice: Number((safePrice / weightOrVolumeValue).toFixed(2)), unit: 'kg' };
    }
    if (u === 'g') {
      const kg = weightOrVolumeValue / 1000;
      return { unitPrice: Number((safePrice / (kg > 0 ? kg : 1)).toFixed(2)), unit: 'kg' };
    }
    if (u === 'l') {
      return { unitPrice: Number((safePrice / weightOrVolumeValue).toFixed(2)), unit: 'L' };
    }
    if (u === 'cl') {
      const l = weightOrVolumeValue / 100;
      return { unitPrice: Number((safePrice / (l > 0 ? l : 1)).toFixed(2)), unit: 'L' };
    }
    if (u === 'ml') {
      const l = weightOrVolumeValue / 1000;
      return { unitPrice: Number((safePrice / (l > 0 ? l : 1)).toFixed(2)), unit: 'L' };
    }
    if (u === 'piece' || u === 'piece' || u === 'unite' || u === 'u') {
      return { unitPrice: Number((safePrice / (weightOrVolumeValue * safeQty)).toFixed(2)), unit: 'pièce' };
    }
  }

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
 * Capitalise harmonieusement un texte en respectant les tirets et espaces.
 */
function capitalizeWords(str: string): string {
  return str
    .split(/(\s+|-|\/)/)
    .map(part => {
      if (part === ' ' || part === '-' || part === '/' || /^\s+$/.test(part)) return part;
      if (part.length === 0) return part;
      const lower = part.toLowerCase();
      // Mots de liaison français
      if (['de', 'du', 'des', 'la', 'le', 'les', 'en', 'sur', 'sous', 'aux', 'd', 'l', 'et'].includes(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}

function stripBrandPrefix(fullStr: string, brandLength: number): string {
  let sub = fullStr.slice(brandLength).trim();
  while (sub.startsWith('-') || sub.startsWith(':') || sub.startsWith('—')) {
    sub = sub.slice(1).trim();
  }
  return sub;
}

/**
 * Nettoie et normalise la partie localisation (ville/commune) du magasin :
 * - Supprime les suffixes d'adresse ou de rue (ex: "- Rue Albert Henon")
 * - Supprime les codes postaux (ex: "74100")
 * - Harmonise les anomalies d'OCR ou de casse (ex: "Etrembi res" -> "Etrembières")
 */
function cleanCityLocation(rawCity: string): string {
  if (!rawCity || typeof rawCity !== 'string') return '';
  let city = rawCity.trim();

  // Supprimer les caractères de séparation au début ou à la fin sans regex bracket dangereuse
  while (city.startsWith('-') || city.startsWith(':') || city.startsWith('—') || city.startsWith(' ')) {
    city = city.slice(1).trim();
  }
  while (city.endsWith('-') || city.endsWith(':') || city.endsWith('—') || city.endsWith(' ')) {
    city = city.slice(0, -1).trim();
  }

  // Supprimer les codes postaux à 5 chiffres (ex: "74100")
  city = city.replace(/\b\d{5}\b/g, '').trim();

  // Supprimer les mentions de voies / adresses / rues / boulevards
  city = city.replace(/\s*-\s*(?:rue|av|avenue|bd|boulevard|route|rte|chemin|allee|allée|impasse|zi|zac|centre commercial|c\.?c\.?)\b.*$/i, '').trim();
  city = city.replace(/\s+(?:rue|avenue|boulevard|route|chemin|impasse)\s+.*$/i, '').trim();
  city = city.replace(/\s+/g, ' ').trim();

  // Harmonisation canonique des villes fréquentes pour éliminer tout risque de doublon
  const normalizedKey = city
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalizedKey.includes('etrembi') || normalizedKey.includes('etrembiere') || normalizedKey.includes('etrembieres')) {
    return 'Etrembières';
  }
  if (normalizedKey.includes('ville la grand') || normalizedKey.includes('villelagrand')) {
    return 'Ville-la-Grand';
  }
  if (normalizedKey.includes('vetraz') || normalizedKey.includes('monthoux')) {
    return 'Vétraz-Monthoux';
  }
  if (normalizedKey === 'annemasse') {
    return 'Annemasse';
  }
  if (normalizedKey === 'gaillard') {
    return 'Gaillard';
  }
  if (normalizedKey.includes('saint julien') || normalizedKey.includes('st julien')) {
    return 'Saint-Julien-en-Genevois';
  }

  return capitalizeWords(city);
}

/**
 * Normalise rigoureusement le nom d'un magasin pour éviter les doublons dus à la casse,
 * aux adresses superflues, aux espaces multiples ou aux variations d'OCR.
 * Format canonique garanti via le référentiel physique : "[Enseigne] - [Commune]"
 * (ex: "Intermarché - Gaillard", "Intermarché - Annemasse", "Intermarché - Ville-la-Grand", "E.Leclerc - Ville-la-Grand").
 */
export function normalizeStoreName(rawName?: string, rawAddress?: string): string {
  if (!rawName || typeof rawName !== 'string') return 'Supermarché';

  // 1. Nettoyage des espaces insécables, invisibles et multiples
  const cleaned = rawName
    .replace(/[\u200B\u00A0\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return 'Supermarché';

  // Résolution via le référentiel de magasins physiques (0 € d'API externe)
  const resolved = resolvePhysicalStore({
    storeName: cleaned,
    storeAddress: rawAddress
  });

  return resolved.displayName;
}

/**
 * Rapproche intelligemment un nom de magasin extrait ou saisi avec la liste des magasins déjà existants
 * dans l'application.
 * 
 * Si le magasin correspond à une enseigne déjà enregistrée (même marque + même commune, ou correspondance
 * normalisée), il renvoie le nom exact déjà présent dans l'application pour consolider les données
 * (mise à jour des prix, historique, zéro colonne doublon).
 * 
 * Si le magasin ne correspond à aucun magasin existant, il renvoie le nouveau nom canonique
 * (permettant la création d'une nouvelle colonne dans la matrice comparative).
 */
export function reconcileStoreWithExisting(
  candidateStore: string,
  existingStores: string[] = []
): string {
  const normalizedCandidate = normalizeStoreName(candidateStore);
  if (!existingStores || existingStores.length === 0) {
    return normalizedCandidate;
  }

  // 1. Correspondance exacte insensible à la casse
  const exactMatch = existingStores.find(
    s => s.toLowerCase() === normalizedCandidate.toLowerCase()
  );
  if (exactMatch) return exactMatch;

  // 2. Correspondance après normalisation des deux côtés
  const normalizedExisting = existingStores.map(s => ({
    original: s,
    normalized: normalizeStoreName(s)
  }));

  const normMatch = normalizedExisting.find(
    item => item.normalized.toLowerCase() === normalizedCandidate.toLowerCase()
  );
  if (normMatch) return normMatch.original;

  // 3. Correspondance phonétique / sans accents (gère les typos OCR)
  const stripAccents = (str: string) =>
    str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

  const candidateKey = stripAccents(normalizedCandidate);

  const phoneticMatch = normalizedExisting.find(
    item => stripAccents(item.normalized) === candidateKey
  );
  if (phoneticMatch) return phoneticMatch.original;

  // 3.5 Correspondance par marque unique lorsque la commune est omise sur le ticket
  // Ex: Le ticket indique juste "LIDL" ou "E.LECLERC", et l'utilisateur n'a qu'un seul magasin de cette enseigne (ex: "Lidl Annemasse")
  const candidateWords = candidateKey.split(' ').filter(Boolean);
  if (candidateWords.length <= 2) {
    const brandMatches = normalizedExisting.filter(item => {
      const existingKey = stripAccents(item.normalized);
      return existingKey.startsWith(candidateKey) || candidateWords.every(w => existingKey.includes(w));
    });
    if (brandMatches.length === 1) {
      return brandMatches[0].original;
    }
  }

  // 4. Si c'est un véritable nouveau magasin, renvoyer le nouveau nom canonique
  return normalizedCandidate;
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
  const storeMetadata: Record<string, { id: string; displayName: string; googleMapsUrl?: string; address?: string }> = {};

  receipts.forEach(r => {
    const resolved = resolvePhysicalStore({
      storeName: r.storeName,
      storeAddress: r.storeAddress,
      storePostalCode: r.storePostalCode,
      storeCity: r.storeCity
    });
    const store = resolved.displayName;
    if (store && Array.isArray(r.items) && r.items.length > 0) {
      storeSet.add(store);
      storeMetadata[store] = {
        id: resolved.id,
        displayName: resolved.displayName,
        googleMapsUrl: resolved.googleMapsUrl,
        address: resolved.address
      };
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
    categoryKey: SupermarketAisleKey;
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
    const receiptStore = normalizeStoreName(receipt.storeName);
    if (!receiptStore) return;

    receipt.items.forEach(item => {
      // RÈGLE 1 & COUCHE 1/2 : Empreinte Pure & Famille Canonique
      const rawCandidate = (item.nomGenerique || item.normalizedName || item.rawName || '').trim();
      const canonicalNeed = normalizeProductNeed(rawCandidate, item.brand);
      if (canonicalNeed.isInvalidArtifact) return;

      const needKey = canonicalNeed.id;
      const lookupKey = needKey;

      // Respect de la règle d'audit : ignorer les produits supprimés de la matrice
      if (
        hiddenSet.has(lookupKey) ||
        hiddenSet.has((item.normalizedName || '').toLowerCase()) ||
        hiddenSet.has(canonicalNeed.nom_affichage.toLowerCase())
      ) {
        return;
      }

      const pricePaid = Number(item.pricePaid ?? item.price) || 0;
      const weightOrVolume = String(item.weightOrVolume || item.formatExact || '').trim();
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const computed = computeUnitPrice(
        pricePaid, 
        weightOrVolume, 
        quantity, 
        item.weightOrVolumeValue, 
        item.weightOrVolumeUnit
      );
      const unitPrice = Number(item.unitPrice) > 0 ? Number(item.unitPrice) : (item.referenceUnitPrice || computed.unitPrice);
      if (!unitPrice || unitPrice <= 0 || Number.isNaN(unitPrice)) return;

      const unit = item.unit || computed.unit;
      const brand = String(item.brand || '').trim();

      const canonical = canonicalNeed.nom_affichage;
      const normalizedCat = normalizeAisle(
        canonicalNeed.rayon || item.categoryKey || item.category || classifyItemAisle(canonical, item.rawName)
      );

      if (!productMap.has(lookupKey)) {
        productMap.set(lookupKey, {
          canonicalName: canonical,
          category: normalizedCat.label,
          categoryKey: normalizedCat.key,
          rawNames: new Set<string>(),
          brands: new Set<string>(),
          unit,
          storePrices: {} as Record<string, import('../types/receipts').StorePriceDetail>,
          allPriceRecords: [] as import('../types/receipts').StorePriceDetail[]
        });
      }

      const acc = productMap.get(lookupKey)!;
      if (item.rawName) {
        acc.rawNames.add(item.rawName);
      }
      if (brand) {
        acc.brands.add(brand);
      }

      const priceDetail: import('../types/receipts.ts').StorePriceDetail = {
        storeName: receiptStore,
        storeId: storeMetadata[receiptStore]?.id,
        googleMapsUrl: storeMetadata[receiptStore]?.googleMapsUrl,
        pricePaid,
        unitPrice,
        brand,
        weightOrVolume,
        date: receipt.date,
        time: receipt.time,
        receiptId: receipt.id,
        quantity,
        rawName: item.rawName || canonical,
        unit,
        isPromo: item.isPromo,
        discountAmount: item.discountAmount,
        discountRate: item.discountRate,
        discountType: item.discountType,
        initialUnitPrice: item.initialUnitPrice,
        initialPrice: item.initialPrice
      };

      acc.allPriceRecords.push(priceDetail);

      const currentStored = acc.storePrices[receiptStore];

      // Conserver le relevé de prix le plus récent pour ce magasin
      if (!currentStored || new Date(receipt.date).getTime() >= new Date(currentStored.date).getTime()) {
        acc.storePrices[receiptStore] = priceDetail;
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

    // Trier tous les relevés historiques chronologiquement (du plus ancien au plus récent)
    const sortedHistory = [...acc.allPriceRecords].sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time || '12:00'}:00`).getTime();
      const dateB = new Date(`${b.date}T${b.time || '12:00'}:00`).getTime();
      return dateA - dateB;
    });

    // Calcul de l'évolution du prix (Règle 5)
    let priceEvolution: import('../types/receipts').PriceEvolutionInfo | undefined = undefined;
    if (sortedHistory.length >= 2) {
      const latest = sortedHistory[sortedHistory.length - 1];
      // Chercher si possible un achat antérieur dans le même magasin, sinon le dernier achat global
      const sameStoreRecords = sortedHistory.filter(r => normalizeStoreName(r.storeName) === normalizeStoreName(latest.storeName));
      const comparisonTarget = sameStoreRecords.length >= 2
        ? sameStoreRecords[sameStoreRecords.length - 2]
        : sortedHistory[sortedHistory.length - 2];

      const diff = Number((latest.unitPrice - comparisonTarget.unitPrice).toFixed(2));
      const targetDate = new Date(comparisonTarget.date);
      let previousMonth = 'le dernier achat';
      try {
        const monthName = new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(targetDate);
        previousMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
      } catch {}

      const unitLabel = latest.unit ? `€/${latest.unit}` : '€';

      if (diff > 0.01) {
        priceEvolution = {
          status: 'HIKE',
          message: `🚨 Attention : Prix en hausse (+${diff.toFixed(2).replace('.', ',')} ${unitLabel} depuis le dernier achat)`,
          diffUnitPrice: diff,
          currentUnitPrice: latest.unitPrice,
          previousDate: comparisonTarget.date,
          previousUnitPrice: comparisonTarget.unitPrice,
          previousStore: comparisonTarget.storeName
        };
      } else if (diff < -0.01) {
        priceEvolution = {
          status: 'DROP',
          message: `✅ Bonne affaire : Moins cher qu'en ${previousMonth} (-${Math.abs(diff).toFixed(2).replace('.', ',')} ${unitLabel})`,
          diffUnitPrice: diff,
          currentUnitPrice: latest.unitPrice,
          previousDate: comparisonTarget.date,
          previousUnitPrice: comparisonTarget.unitPrice,
          previousStore: comparisonTarget.storeName
        };
      } else {
        priceEvolution = {
          status: 'STABLE',
          message: `Prix stable (${latest.unitPrice.toFixed(2).replace('.', ',')} ${unitLabel})`,
          diffUnitPrice: 0,
          currentUnitPrice: latest.unitPrice,
          previousDate: comparisonTarget.date,
          previousUnitPrice: comparisonTarget.unitPrice,
          previousStore: comparisonTarget.storeName
        };
      }
    }

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
      categoryKey: acc.categoryKey,
      sampleRawNames: Array.from(acc.rawNames),
      sampleBrands: Array.from(acc.brands),
      storePrices: acc.storePrices,
      priceHistory: sortedHistory,
      priceEvolution,
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

  // 4. Regroupement par Rayons (8 sections standard de supermarché + filet Autres / Divers)
  const aisleGroups: AisleGroup[] = SUPERMARKET_AISLES.map(aisle => {
    const key = AISLE_LABEL_TO_KEY[aisle];
    const productsInAisle = allRows
      .filter(r => r.categoryKey === key || r.category === aisle)
      .sort((a, b) => {
        // En premier les produits comparables, puis ordre alphabétique
        if (a.status === 'COMPARABLE' && b.status !== 'COMPARABLE') return -1;
        if (b.status === 'COMPARABLE' && a.status !== 'COMPARABLE') return 1;
        return a.normalizedName.localeCompare(b.normalizedName, 'fr', { sensitivity: 'base' });
      });

    const comparableCount = productsInAisle.filter(p => p.status === 'COMPARABLE').length;

    return {
      aisle,
      key,
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
    storeMetadata,
    receiptsCount,
    isSingleReceipt,
    aisleGroups,
    totalUniqueProducts: allRows.length,
    totalComparableProducts: isSingleReceipt ? 0 : totalComparable,
    totalPotentialSavings: isSingleReceipt ? 0 : Number(totalPotentialSavings.toFixed(2)),
    bestStoreGlobal: isSingleReceipt ? undefined : bestStoreGlobal
  };
}

/**
 * Construit la matrice comparative directement à partir de la collection standardisée des produits
 * (users/{userId}/products) selon la règle 6 (100% Gratuit).
 * Coût Firestore = 0 (1 seule lecture par produit fournit instantanément prix actuels de toutes les enseignes et historique).
 */
export function buildComparativeMatrixFromProducts(
  products: StandardizedProductDoc[],
  hiddenProductNames: string[] = [],
  receiptsCount: number = 0
): ComparativeMatrix {
  const hiddenSet = new Set(hiddenProductNames.map(n => n.trim().toLowerCase()));

  // 1. Détermination de la liste ordonnée des magasins réels audités
  const storeMap = new Map<string, { id: string; displayName: string; googleMapsUrl?: string; address?: string }>();
  
  products.forEach(p => {
    const offers = (p as any).offres_magasins || p.prix_actuel;
    if (offers) {
      Object.entries(offers).forEach(([stId, pa]: [string, any]) => {
        const normName = normalizeStoreName(pa?.magasin_nom || stId);
        if (normName && normName !== 'Supermarché' && !storeMap.has(normName)) {
          const resolved = resolvePhysicalStore({ storeName: normName });
          storeMap.set(normName, {
            id: pa?.magasin_id || resolved.id,
            displayName: normName,
            googleMapsUrl: resolved.googleMapsUrl,
            address: resolved.address
          });
        }
      });
    }
  });

  const stores = Array.from(storeMap.keys());
  const storeMetadata: Record<string, { id: string; displayName: string; googleMapsUrl?: string; address?: string }> = {};
  storeMap.forEach((meta, k) => {
    storeMetadata[k] = meta;
  });

  const isSingleReceipt = receiptsCount === 1;

  // 2. Consolidation préalable par Famille Canonique (Couches 1, 2 & 3)
  const consolidatedProducts = new Map<string, {
    canonicalId: string;
    displayName: string;
    aisle: { key: SupermarketAisleKey; label: SupermarketAisle };
    unit: string;
    storePrices: Record<string, StorePriceDetail>;
    history: StorePriceDetail[];
    sampleBrands: Set<string>;
    sampleRawNames: Set<string>;
  }>();

  products.forEach(p => {
    const rawName = p.nom_generique || (p as any).cle_besoin || p.superKey || '';
    const canonicalNeed = normalizeProductNeed(rawName, p.marque);
    if (canonicalNeed.isInvalidArtifact) return;

    const rawKey = ((p as any).cle_besoin || p.superKey || p.nom_generique || '').trim().toLowerCase();
    if (
      hiddenSet.has(rawKey) ||
      hiddenSet.has(canonicalNeed.id) ||
      hiddenSet.has((p.nom_generique || '').toLowerCase()) ||
      hiddenSet.has(canonicalNeed.nom_affichage.toLowerCase())
    ) {
      return;
    }

    const storePrices: Record<string, StorePriceDetail> = {};
    const sampleBrands = new Set<string>();
    if (p.marque && p.marque !== 'Générique') sampleBrands.add(p.marque);

    if ((p as any).offres_magasins) {
      Object.entries((p as any).offres_magasins).forEach(([stId, offer]: [string, any]) => {
        if (!offer || !(Number(offer.prix_unitaire) > 0)) return;
        const storeKey = normalizeStoreName(offer.magasin_nom || stId);
        if (!storeKey || storeKey === 'Supermarché') return;
        if (offer.marque && offer.marque !== 'Générique') sampleBrands.add(offer.marque);
        storePrices[storeKey] = {
          storeName: storeKey,
          storeId: offer.magasin_id || stId,
          googleMapsUrl: storeMetadata[storeKey]?.googleMapsUrl,
          pricePaid: Number(offer.prix_paye) || Number(offer.prix_unitaire),
          unitPrice: Number(offer.prix_unitaire),
          brand: offer.marque || 'Générique',
          weightOrVolume: offer.format || '1 piece',
          date: offer.date || new Date().toISOString().slice(0, 10),
          receiptId: offer.receiptId || '',
          quantity: 1,
          rawName: offer.rawName || p.nom_generique,
          unit: offer.unite || p.unite_mesure || 'piece',
          isPromo: Boolean((offer as any).is_promo ?? (offer as any).isPromo ?? ((offer as any).remise && (offer as any).remise > 0)),
          discountAmount: (offer as any).remise ?? (offer as any).discountAmount,
          discountRate: (offer as any).taux_remise ?? (offer as any).discountRate,
          discountType: (offer as any).motif_remise ?? (offer as any).discountType,
          initialUnitPrice: (offer as any).prix_base_unitaire ?? (offer as any).initialUnitPrice,
          initialPrice: (offer as any).prix_brut ?? (offer as any).initialPrice
        };
      });
    } else if (p.prix_actuel) {
      Object.entries(p.prix_actuel).forEach(([stId, pa]) => {
        if (!pa || !(Number(pa.prix_unitaire) > 0)) return;
        const storeKey = normalizeStoreName(pa.magasin_nom || stId);
        if (!storeKey || storeKey === 'Supermarché') return;
        storePrices[storeKey] = {
          storeName: storeKey,
          storeId: pa.magasin_id || stId,
          googleMapsUrl: storeMetadata[storeKey]?.googleMapsUrl,
          pricePaid: Number(pa.prix_paye) || Number(pa.prix_unitaire),
          unitPrice: Number(pa.prix_unitaire),
          brand: p.marque || 'Générique',
          weightOrVolume: p.poids_ou_volume || '1 piece',
          date: pa.date || new Date().toISOString().slice(0, 10),
          receiptId: pa.receiptId || '',
          quantity: pa.quantite || 1,
          rawName: p.nom_generique,
          unit: p.unite_mesure || 'piece'
        };
      });
    }

    if (Object.keys(storePrices).length === 0) return;

    const historySource = (p as any).historique_offres || p.historique_prix || [];
    const mappedHistory: StorePriceDetail[] = historySource
      .filter((h: any) => h && Number(h.prix_unitaire) > 0)
      .map((h: any) => ({
        storeName: normalizeStoreName(h.magasin_nom || h.magasin),
        storeId: h.magasin,
        googleMapsUrl: storeMetadata[normalizeStoreName(h.magasin_nom || h.magasin)]?.googleMapsUrl,
        pricePaid: Number(h.prix_paye) || Number(h.prix_unitaire),
        unitPrice: Number(h.prix_unitaire),
        brand: h.marque || p.marque || 'Générique',
        weightOrVolume: h.format || p.poids_ou_volume || '1 piece',
        date: h.date || new Date().toISOString().slice(0, 10),
        receiptId: h.receiptId || '',
        quantity: h.quantite || 1,
        rawName: p.nom_generique,
        unit: h.unite || p.unite_mesure || 'piece'
      }));

    const aisle = normalizeAisle(
      canonicalNeed.rayon || (p as any).rayon || p.rayon_cle || p.rayon_assigne || classifyItemAisle(canonicalNeed.nom_affichage, rawName)
    );
    const displayName = canonicalNeed.nom_affichage;

    if (!consolidatedProducts.has(canonicalNeed.id)) {
      consolidatedProducts.set(canonicalNeed.id, {
        canonicalId: canonicalNeed.id,
        displayName,
        aisle,
        unit: p.unite_mesure || 'piece',
        storePrices: { ...storePrices },
        history: [...mappedHistory],
        sampleBrands: new Set(sampleBrands),
        sampleRawNames: new Set([p.nom_generique].filter(Boolean))
      });
    } else {
      const existing = consolidatedProducts.get(canonicalNeed.id)!;
      if (canonicalNeed.rayon) {
        existing.aisle = normalizeAisle(canonicalNeed.rayon);
      }
      sampleBrands.forEach(b => existing.sampleBrands.add(b));
      if (p.nom_generique) existing.sampleRawNames.add(p.nom_generique);

      // Fusion des offres par magasin : conserver la plus récente (ou la plus avantageuse à date égale)
      Object.entries(storePrices).forEach(([stKey, sp]) => {
        const cur = existing.storePrices[stKey];
        if (!cur || sp.date > cur.date || (sp.date === cur.date && sp.unitPrice < cur.unitPrice)) {
          existing.storePrices[stKey] = sp;
        }
      });

      existing.history.push(...mappedHistory);
    }
  });

  // 3. Construction des lignes de comparaison
  const allRows: ProductComparisonRow[] = [];
  let totalPotentialSavings = 0;
  const storeWinCount: Record<string, number> = {};
  stores.forEach(s => { storeWinCount[s] = 0; });

  consolidatedProducts.forEach(entry => {
    const storePrices = entry.storePrices;
    const presentStores = Object.keys(storePrices);
    const storeCount = presentStores.length;
    if (storeCount === 0) return;

    const sortedHistory = [...entry.history].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Évolution des prix
    let priceEvolution: PriceEvolutionInfo | undefined;
    if (sortedHistory.length >= 2) {
      const latest = sortedHistory[sortedHistory.length - 1];
      const sameStoreRecords = sortedHistory.filter(r => r.storeName === latest.storeName);
      const comparisonTarget = sameStoreRecords.length >= 2
        ? sameStoreRecords[sameStoreRecords.length - 2]
        : sortedHistory[sortedHistory.length - 2];

      const diff = Number((latest.unitPrice - comparisonTarget.unitPrice).toFixed(2));
      const targetDate = new Date(comparisonTarget.date);
      let previousMonth = 'le dernier achat';
      try {
        const monthName = new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(targetDate);
        previousMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
      } catch {}

      const unitLabel = latest.unit ? `€/${latest.unit}` : '€';
      if (diff > 0.01) {
        priceEvolution = {
          status: 'HIKE',
          message: `🚨 Attention : Prix en hausse (+${diff.toFixed(2).replace('.', ',')} ${unitLabel} depuis le dernier achat)`,
          diffUnitPrice: diff,
          currentUnitPrice: latest.unitPrice,
          previousDate: comparisonTarget.date,
          previousUnitPrice: comparisonTarget.unitPrice,
          previousStore: comparisonTarget.storeName
        };
      } else if (diff < -0.01) {
        priceEvolution = {
          status: 'DROP',
          message: `✅ Bonne affaire : Moins cher qu'en ${previousMonth} (-${Math.abs(diff).toFixed(2).replace('.', ',')} ${unitLabel})`,
          diffUnitPrice: diff,
          currentUnitPrice: latest.unitPrice,
          previousDate: comparisonTarget.date,
          previousUnitPrice: comparisonTarget.unitPrice,
          previousStore: comparisonTarget.storeName
        };
      } else {
        priceEvolution = {
          status: 'STABLE',
          message: `Prix stable (${latest.unitPrice.toFixed(2).replace('.', ',')} ${unitLabel})`,
          diffUnitPrice: 0,
          currentUnitPrice: latest.unitPrice,
          previousDate: comparisonTarget.date,
          previousUnitPrice: comparisonTarget.unitPrice,
          previousStore: comparisonTarget.storeName
        };
      }
    }

    const isComparable = storeCount >= 2;
    const unitPrices = Object.values(storePrices).map(sp => sp.unitPrice);
    let lowestUnitPrice: number | undefined;
    let highestUnitPrice: number | undefined;
    let cheapestStore: string | undefined;
    let unitPriceDifference = 0;
    let unitPriceDifferencePercent = 0;

    if (isComparable) {
      lowestUnitPrice = Math.min(...unitPrices);
      highestUnitPrice = Math.max(...unitPrices);
      const cheapestEntry = Object.entries(storePrices).find(([_, sp]) => sp.unitPrice === lowestUnitPrice);
      if (cheapestEntry) {
        cheapestStore = cheapestEntry[0];
      }
      unitPriceDifference = Math.max(0, Number((highestUnitPrice - lowestUnitPrice).toFixed(2)));
      unitPriceDifferencePercent = highestUnitPrice > 0 ? Math.round((unitPriceDifference / highestUnitPrice) * 100) : 0;
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

    const aisle = entry.aisle;
    const displayName = entry.displayName;

    allRows.push({
      normalizedName: displayName,
      category: aisle.label,
      categoryKey: aisle.key,
      sampleRawNames: Array.from(entry.sampleRawNames),
      sampleBrands: entry.sampleBrands.size > 0 ? Array.from(entry.sampleBrands) : ['Générique'],
      storePrices,
      priceHistory: sortedHistory,
      priceEvolution,
      storeCount,
      status: isComparable ? 'COMPARABLE' : 'UNIQUE',
      lowestUnitPrice,
      highestUnitPrice,
      cheapestStore,
      unitPriceDifference,
      unitPriceDifferencePercent,
      unit: (entry.unit as any) || 'piece',
      lowestPrice: lowestUnitPrice,
      highestPrice: highestUnitPrice,
      priceDifference: unitPriceDifference,
      priceDifferencePercent: unitPriceDifferencePercent
    });
  });

  // Regroupement par Rayons
  const aisleGroups: AisleGroup[] = SUPERMARKET_AISLES.map(aisle => {
    const key = AISLE_LABEL_TO_KEY[aisle];
    const productsInAisle = allRows
      .filter(r => r.categoryKey === key || r.category === aisle)
      .sort((a, b) => {
        if (a.status === 'COMPARABLE' && b.status !== 'COMPARABLE') return -1;
        if (b.status === 'COMPARABLE' && a.status !== 'COMPARABLE') return 1;
        return a.normalizedName.localeCompare(b.normalizedName, 'fr', { sensitivity: 'base' });
      });

    return {
      aisle,
      key,
      products: productsInAisle,
      totalProducts: productsInAisle.length,
      comparableCount: productsInAisle.filter(p => p.status === 'COMPARABLE').length
    };
  });

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
    storeMetadata,
    receiptsCount,
    isSingleReceipt,
    aisleGroups,
    totalUniqueProducts: allRows.length,
    totalComparableProducts: isSingleReceipt ? 0 : totalComparable,
    totalPotentialSavings: isSingleReceipt ? 0 : Number(totalPotentialSavings.toFixed(2)),
    bestStoreGlobal: isSingleReceipt ? undefined : bestStoreGlobal
  };
}

