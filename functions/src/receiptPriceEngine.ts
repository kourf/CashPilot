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
 * Correction orthographique et typographique stricte des libellés OCR (Règle 4)
 * Élimine les coquilles OCR ("B Uf" -> "Bœuf", accents manquants, abréviations).
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

export interface NormalizedProductNeed {
  id: string;
  nom_affichage: string;
  rayon?: LockedSupermarketAisle;
  isInvalidArtifact?: boolean;
}

export interface CanonicalFamilyRule {
  pattern: RegExp;
  id: string;
  nom_affichage: string;
  rayon?: LockedSupermarketAisle;
}

export const STOP_WORDS_COUCHE_1 = new Set<string>([
  'de', 'du', 'des', 'd', 'l', 'le', 'la', 'les', 'au', 'aux', 'a', 'en', 'et',
  'ou', 'avec', 'sans', 'sur', 'sous', 'par', 'pour', 'dans', 'un', 'une',
  'lit', 'gout', 'saveur', 'piece', 'pieces', 'pce', 'pces', 'unite', 'unites',
  'tranche', 'tranches', 'morceau', 'morceaux', 'decoupe', 'decoupes', 'entier', 'entiere', 'entiers',
  'kg', 'kilo', 'kilos', 'g', 'gr', 'gramme', 'grammes', 'mg',
  'cl', 'ml', 'l', 'litre', 'litres', 'dl',
  'bocal', 'bocaux', 'sachet', 'sachets', 'pet', 'bidon', 'bidons',
  'bouteille', 'bouteilles', 'pack', 'packs', 'lot', 'lots', 'format', 'familial',
  'boite', 'boites', 'brique', 'briques', 'flacon', 'flacons', 'pot', 'pots',
  'barquette', 'barquettes', 'filet', 'filets', 'etui', 'etuis', 'tube', 'tubes',
  'verre', 'plastique', 'souple', 'squeeze', 'squeez', 'poche', 'doypack', 'vrac',
  '1er', 'premier', 'prix', 'promo', 'offre', 'nature', 'pur', 'pure',
  'croustillant', 'croustillante', 'douceur', 'moelleux', 'moelleuse', 'sandwich',
  'complet', 'complete', 'extra', 'fin', 'fins', 'fine', 'fines', 'tres',
  'frais', 'fraiche', 'fraiches', 'bio', 'uht', 'mg', 'allonge', 'allongees', 'blonde',
  'super', 'u', 'leclerc', 'marque', 'repere', 'carrefour', 'intermarche', 'lidl',
  'aldi', 'auchan', 'monoprix', 'casino', 'cora', 'franprix', 'leader', 'price',
  'danone', 'barilla', 'panzani', 'heinz', 'amora', 'president', 'cristaline',
  'volvic', 'evian', 'coca', 'freeway', 'milka', 'nestle', 'harrys', 'harry',
  'lu', 'oreo', 'jafad', 'jafun', 'lesieur', 'candia', 'lactel', 'pepsi',
  'bonduelle', 'fleury', 'michon', 'herta', 'knorr', 'maggi', 'maille',
  'paturages', 'monique', 'ranou', 'chabrior', 'paquito', 'odyssee', 'pommette',
  'cantu', 'daise', 'discreet', 'finish', 'mousline', 'ayam', 'landvika', 'kult'
]);

export const INVARIANT_SINGULAR_EXCEPTIONS = new Set<string>([
  'mais', 'jus', 'radis', 'pois', 'noix', 'cassis', 'brebis', 'frais', 'epais',
  'ananas', 'os', 'riz', 'couscous', 'houmous', 'speculoos', 'tapas', 'nems',
  'chips', 'muesli', 'gnocchi', 'ravioli', 'tortelloni', 'spaghetti', 'macaroni',
  'farfalle', 'penne', 'lasagne', 'tagliatelle', 'brocoli', 'kiwi', 'litchi',
  'surimi', 'maki', 'sushi', 'tiramisu', 'tofu', 'quinoa', 'coulis', 'hachis'
]);

export const CANONICAL_FAMILY_RULES: CanonicalFamilyRule[] = [
  { pattern: /^(ufs|uf|oeuf|oeufs)(\s+.*|$)/i, id: 'oeufs', nom_affichage: 'Œufs', rayon: 'Produits frais & Crèmerie' },
  { pattern: /^(delice.*(dinde|poulet|volaille)|blanc.*(volaille|dinde|poulet)).*/i, id: 'blanc_delice_volaille', nom_affichage: 'Blanc & Délice de volaille', rayon: 'Boucherie, Volaille & Poissonnerie' },
  { pattern: /^lardon.*(poulet|volaille|dinde).*/i, id: 'lardons_volaille_fumes', nom_affichage: 'Lardons de volaille fumés', rayon: 'Boucherie, Volaille & Poissonnerie' },
  { pattern: /^crevette.*(deco|decortique|cuite).*/i, id: 'crevettes_decortiquees', nom_affichage: 'Crevettes décortiquées', rayon: 'Boucherie, Volaille & Poissonnerie' },
  { pattern: /^(de\s+)?(filet\s+)?colin.*alaska.*/i, id: 'filet_colin_alaska', nom_affichage: "Filet de colin d'Alaska", rayon: 'Boucherie, Volaille & Poissonnerie' },
  { pattern: /^thon.*listao.*/i, id: 'thon_listao_naturel', nom_affichage: 'Thon listao au naturel', rayon: 'Épicerie salée & Épices' },
  { pattern: /^(mie|pain.*mie)(\s+.*|$)/i, id: 'pain_de_mie', nom_affichage: 'Pain de mie', rayon: 'Épicerie salée & Épices' },
  { pattern: /^(frite(s)?(\s+allumette.*)?|pomme(s)?\s+(de\s+)?terre\s+frite(s)?.*)$/i, id: 'frites', nom_affichage: 'Frites', rayon: 'Épicerie salée & Épices' },
  { pattern: /^mais(\s+.*(doux|grain|sucre|boite|conserve).*|\s*$)/i, id: 'mais_boite', nom_affichage: 'Maïs en boîte', rayon: 'Épicerie salée & Épices' },
  { pattern: /^(batavia|laitue.*batavia.*|salade.*batavia.*)$/i, id: 'salade_batavia', nom_affichage: 'Salade Batavia', rayon: 'Fruits & Légumes' },
  { pattern: /^concombre(s)?(?!.*fromage)(?!.*betterave)(?!.*maki)(?!.*trio).*/i, id: 'concombre', nom_affichage: 'Concombre', rayon: 'Fruits & Légumes' },
  { pattern: /^melon(s)?(\s+.*|$)/i, id: 'melon', nom_affichage: 'Melon', rayon: 'Fruits & Légumes' },
  { pattern: /^oignon(s)?\s+emince(s)?.*/i, id: 'oignons_eminces', nom_affichage: 'Oignons émincés', rayon: 'Fruits & Légumes' },
  { pattern: /^shaker.*ananas.*/i, id: 'shaker_ananas', nom_affichage: "Shaker d'ananas frais", rayon: 'Fruits & Légumes' },
  { pattern: /^carotte(s)?\s+rape(e|s|es)?.*/i, id: 'carottes_rapees', nom_affichage: 'Carottes râpées', rayon: 'Fruits & Légumes' },
  { pattern: /^(lait.*(demi|1\s*2).*ecreme.*(delacto|sans\s+lactose|facile.*digerer).*|sans\s+lactose)$/i, id: 'lait_demi_ecreme_sans_lactose', nom_affichage: 'Lait demi-écrémé sans lactose', rayon: 'Produits frais & Crèmerie' },
  { pattern: /^lait.*(demi|1\s*2)(\s+ecreme(e)?)?(?!.*(delacto|sans\s+lactose|facile)).*/i, id: 'lait_demi_ecreme', nom_affichage: 'Lait demi-écrémé', rayon: 'Produits frais & Crèmerie' },
  { pattern: /^(pj.*orange.*|pur.*jus.*orange.*|jus.*orange.*)$/i, id: 'jus_d_orange', nom_affichage: "Jus d'orange", rayon: 'Boissons' },
  { pattern: /^(pj.*pomme.*|pur.*jus.*pomme.*|jus.*pomme.*)$/i, id: 'jus_de_pomme', nom_affichage: 'Jus de pomme', rayon: 'Boissons' },
  { pattern: /^(pj.*multi.*|abc.*multi.*|jus.*multifruit.*|jafun.*multifruit.*|jus.*tutti.*frutti.*)$/i, id: 'jus_multifruits', nom_affichage: 'Jus multifruits', rayon: 'Boissons' },
  { pattern: /^(eau.*minerale.*|bouchon.*sport.*)$/i, id: 'eau_minerale', nom_affichage: 'Eau minérale', rayon: 'Boissons' },
  { pattern: /^eau\s+(de\s+)?source(?!.*peche)(?!.*fraise)(?!.*citron).*/i, id: 'eau_de_source', nom_affichage: 'Eau de source', rayon: 'Boissons' },
  { pattern: /^confiture(s)?\s+(de\s+)?fraise(s)?.*/i, id: 'confiture_fraise', nom_affichage: 'Confiture de fraise', rayon: 'Épicerie sucrée' },
  { pattern: /^beignet(s)?\s+(au\s+)?chocolat.*/i, id: 'beignets_chocolat', nom_affichage: 'Beignets au chocolat', rayon: 'Épicerie sucrée' },
  { pattern: /^yaourt(s)?\s+(saveur\s+)?vanille(?!.*bille).*/i, id: 'yaourt_vanille', nom_affichage: 'Yaourt vanille', rayon: 'Produits frais & Crèmerie' },
  { pattern: /^baguette(s)?(\s+la|\s+blanche)?$/i, id: 'baguette', nom_affichage: 'Baguette', rayon: 'Épicerie salée & Épices' },
  { pattern: /^basilic(\s+en|\s+frais)?$/i, id: 'basilic', nom_affichage: 'Basilic', rayon: 'Fruits & Légumes' },
  { pattern: /^banane(s)?(\s+ruban.*|\s+vrac.*)?$/i, id: 'bananes', nom_affichage: 'Bananes', rayon: 'Fruits & Légumes' },
  { pattern: /^pomme(s)?\s+(de\s+)?terre(?!.*frite)(?!.*puree).*/i, id: 'pommes_de_terre', nom_affichage: 'Pommes de terre', rayon: 'Fruits & Légumes' },
  { pattern: /^haricot(s)?\s+vert(s)?.*/i, id: 'haricots_verts', nom_affichage: 'Haricots verts', rayon: 'Épicerie salée & Épices' },
  { pattern: /^mayonnaise.*/i, id: 'mayonnaise', nom_affichage: 'Mayonnaise', rayon: 'Épicerie salée & Épices' },
  { pattern: /^huile\s+(de\s+)?tournesol.*/i, id: 'huile_de_tournesol', nom_affichage: 'Huile de tournesol', rayon: 'Épicerie salée & Épices' },
  { pattern: /^sauce\s+(fruits?\s+)?aigre\s+douce.*/i, id: 'sauce_aigre_douce', nom_affichage: 'Sauce aigre-douce', rayon: 'Épicerie salée & Épices' },
  { pattern: /^(e\s+v\s+)?sauce\s+bechamel.*/i, id: 'sauce_bechamel', nom_affichage: 'Sauce Béchamel', rayon: 'Épicerie salée & Épices' },
  { pattern: /^chips?\s+(mtp\s+)?(bbq|barbecue).*/i, id: 'chips_bbq', nom_affichage: 'Chips BBQ', rayon: 'Épicerie salée & Épices' },
  { pattern: /^cornichon(s)?(\s+fins?)?$/i, id: 'cornichons', nom_affichage: 'Cornichons', rayon: 'Épicerie salée & Épices' },
  { pattern: /^(les\s+saucisdelices|saucisse(s)?\s+(de\s+)?volaille.*)$/i, id: 'saucisses_volaille', nom_affichage: 'Saucisses de volaille', rayon: 'Boucherie, Volaille & Poissonnerie' },
  { pattern: /^(msc\s+)?cabillaud\s+pane.*/i, id: 'cabillaud_pane', nom_affichage: 'Cabillaud pané', rayon: 'Boucherie, Volaille & Poissonnerie' },
  { pattern: /^pave(s)?\s+(de\s+)?truite.*/i, id: 'paves_truite', nom_affichage: 'Pavés de truite', rayon: 'Boucherie, Volaille & Poissonnerie' },
  { pattern: /^truite\s+fume(e)?.*/i, id: 'truite_fumee', nom_affichage: 'Truite fumée', rayon: 'Boucherie, Volaille & Poissonnerie' },
  { pattern: /^saumon\s+fume.*/i, id: 'saumon_fume', nom_affichage: 'Saumon fumé', rayon: 'Boucherie, Volaille & Poissonnerie' },
  { pattern: /^(fromage|specialite)\s+ail\s+(et\s+)?(fines?\s+)?herbes?.*/i, id: 'fromage_ail_fines_herbes', nom_affichage: 'Fromage ail et fines herbes', rayon: 'Produits frais & Crèmerie' },
  { pattern: /^pop\s+(creme\s+)?(saveur\s+)?vanille.*/i, id: 'creme_dessert_vanille', nom_affichage: 'Crème dessert vanille', rayon: 'Produits frais & Crèmerie' },
  { pattern: /^creme\s+(ufs|oeufs|aux\s+oeufs)\s+(sur\s+)?(lit\s+)?(de\s+)?caramel.*/i, id: 'creme_oeufs_caramel', nom_affichage: 'Crème aux œufs caramel', rayon: 'Produits frais & Crèmerie' },
  { pattern: /^(compote(s)?\s+(de\s+)?pomme(s)?(?!.*banane)(?!.*poire).*|dessert\s+(de\s+)?fruits?\s+pomme(s)?)$/i, id: 'compote_pommes', nom_affichage: 'Compote de pommes', rayon: 'Épicerie sucrée' },
  { pattern: /^(biscuit(s)?\s+speculoos|speculoos)$/i, id: 'biscuits_speculoos', nom_affichage: 'Biscuits Spéculoos', rayon: 'Épicerie sucrée' },
  { pattern: /^(cracotte(s)?\s+froment|tartine(s)?\s+craquante(s)?\s+froment)$/i, id: 'tartines_froment', nom_affichage: 'Tartines craquantes au froment', rayon: 'Épicerie sucrée' },
  { pattern: /^(corn\s+flakes?.*|petale(s)?\s+(de\s+)?mais\s+sucre.*)$/i, id: 'corn_flakes', nom_affichage: 'Corn Flakes / Pétales de maïs', rayon: 'Épicerie sucrée' },
  { pattern: /^cereale(s)?\s+(fou|fourree(s)?).*(choc|lait).*/i, id: 'cereales_fourrees_chocolat', nom_affichage: 'Céréales fourrées chocolat lait', rayon: 'Épicerie sucrée' },
  { pattern: /^(cereale(s)?\s+coco\s+pops\s+chocos|chocos)$/i, id: 'cereales_chocos', nom_affichage: 'Céréales Chocos', rayon: 'Épicerie sucrée' },
  { pattern: /^mouchoir(s)?(\s+blancs?)?(\s+en)?(\s+de\s+plis)?$/i, id: 'mouchoirs_papier', nom_affichage: 'Mouchoirs en papier', rayon: 'Hygiène, Beauté & Sanitaire' },
  { pattern: /^lait\s+(de\s+)?corps.*/i, id: 'lait_hydratant_corps', nom_affichage: 'Lait hydratant pour le corps', rayon: 'Hygiène, Beauté & Sanitaire' },
  { pattern: /^eau\s+de\s+toilette.*/i, id: 'eau_de_toilette', nom_affichage: 'Eau de toilette', rayon: 'Hygiène, Beauté & Sanitaire' },
  { pattern: /^essuie\s+tout.*/i, id: 'essuie_tout', nom_affichage: 'Essuie-tout', rayon: 'Entretien & Maison' },
  { pattern: /^(film\s+etirable.*|papier\s+film\s+blanc.*)$/i, id: 'film_alimentaire', nom_affichage: 'Film alimentaire étirable', rayon: 'Entretien & Maison' },
  { pattern: /^(dom\s+)?pile(s)?\s+alca.*/i, id: 'piles_alcalines', nom_affichage: 'Piles alcalines', rayon: 'Entretien & Maison' },
  { pattern: /^lessive\s+liquide.*/i, id: 'lessive_liquide', nom_affichage: 'Lessive liquide', rayon: 'Entretien & Maison' },
  { pattern: /^(liquide\s+vaisselle.*|vaisselle\s+hygiene.*)$/i, id: 'liquide_vaisselle', nom_affichage: 'Liquide vaisselle', rayon: 'Entretien & Maison' },
  { pattern: /^(finish\s+gel.*|gel\s+lavage\s+concentre.*|pastille(s)?\s+lave\s+vaisselle.*)$/i, id: 'produit_lave_vaisselle', nom_affichage: 'Produit lave-vaisselle', rayon: 'Entretien & Maison' },
  { pattern: /^(deboucheur.*|gel\s+deboucheur.*)$/i, id: 'deboucheur_canalisations', nom_affichage: 'Déboucheur canalisations', rayon: 'Entretien & Maison' },
  { pattern: /^syphon\s+(bloc|gel)\s+wc.*/i, id: 'nettoyant_wc', nom_affichage: 'Nettoyant & Bloc WC', rayon: 'Entretien & Maison' },
  { pattern: /^(ice\s+tea\s+peche.*|the\s+(glace(e)?\s+)?peche.*|boisson\s+eau\s+source\s+peche.*|peche)$/i, id: 'the_glace_peche', nom_affichage: 'Thé glacé pêche', rayon: 'Boissons' },
  { pattern: /^(boisson\s+gazeuse\s+lemon\s+lime.*|soda\s+lemon\s+lime.*)$/i, id: 'soda_lemon_lime', nom_affichage: 'Soda citron-citron vert', rayon: 'Boissons' },
  { pattern: /^(orangina(\s+jaune)?|jaune)$/i, id: 'orangina', nom_affichage: 'Orangina', rayon: 'Boissons' },
  { pattern: /^(regular|coca.*regular|cola.*regular)$/i, id: 'cola_standard', nom_affichage: 'Coca-Cola / Cola standard', rayon: 'Boissons' },
  { pattern: /^(zero|coca.*zero|cola.*zero)$/i, id: 'cola_zero', nom_affichage: 'Coca-Cola Zéro / Sans sucre', rayon: 'Boissons' },
  { pattern: /^(glacon(s)?|sac\s+grains?\s+(de\s+)?glace(e)?)$/i, id: 'glacons', nom_affichage: 'Glaçons', rayon: 'Boissons' },
  { pattern: /^(sac|sac\s+kraft\s+drive|sac\s+poignee|sac\s+cabas)$/i, id: 'sac_caisse', nom_affichage: 'Sac de caisse / Cabas', rayon: 'Sacs & Consignes' }
];

export function singularizeWord(word: string): string {
  if (!word || word.length <= 2) return word;
  if (INVARIANT_SINGULAR_EXCEPTIONS.has(word)) return word;
  let w = word;
  if (w.endsWith('aux') && w.length > 4) return w.slice(0, -1);
  if ((w.endsWith('s') || w.endsWith('x')) && w.length > 3) w = w.slice(0, -1);
  if (
    w.length > 4 &&
    (w.endsWith('rapee') ||
      w.endsWith('fumee') ||
      w.endsWith('decortiquee') ||
      w.endsWith('emincee') ||
      w.endsWith('glacee') ||
      w.endsWith('allegee') ||
      w.endsWith('fourree') ||
      w.endsWith('sucree') ||
      w.endsWith('salee') ||
      w.endsWith('pelee') ||
      w.endsWith('grillee') ||
      w.endsWith('panee') ||
      w.endsWith('tranchee') ||
      w.endsWith('hachee') ||
      w.endsWith('ecremee'))
  ) {
    w = w.slice(0, -1);
  }
  return w;
}

export function preNormalizeRawText(rawName: string): string {
  if (!rawName || typeof rawName !== 'string') return '';
  let s = rawName
    .replace(/œ/gi, 'oe')
    .replace(/æ/gi, 'ae')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_'/’.,:;()[\]]+/g, ' ');
  s = s.replace(/\bb\s*u+f\b/g, 'boeuf');
  s = s.replace(/\bc\s*ur\b/g, 'coeur');
  s = s.replace(/\b1\s*[/_\s-]?\s*2\b/g, 'demi');
  s = s.replace(/\bsteacks?\b/g, 'steak');
  s = s.replace(/\bpomm?\s+terre\b/g, 'pommes de terre');
  return s.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function isInvalidReceiptArtifact(rawName?: string): boolean {
  if (!rawName || typeof rawName !== 'string') return true;
  const s = preNormalizeRawText(rawName);
  if (!s || s.length < 2) return true;
  const invalidPatterns = [
    /^(de\s+)?articles?$/,
    /^\d+\s+articles?$/,
    /^nb\s+articles?$/,
    /^total(\s+.*)?$/,
    /^sous\s+total(\s+.*)?$/,
    /^montant(\s+.*)?$/,
    /^carte\s+bancaire(\s+.*)?$/,
    /^cb(\s+.*)?$/,
    /^especes(\s+.*)?$/,
    /^rendu\s+monnaie(\s+.*)?$/,
    /^remise(\s+immediate)?$/,
    /^bon\s+d\s+achat$/,
    /^tva(\s+.*)?$/,
    /^produit(s)?(\s+inconnu)?$/
  ];
  return invalidPatterns.some(rx => rx.test(s));
}

export function normalizeProductNeed(rawName?: string, brand?: string): NormalizedProductNeed {
  if (!rawName || typeof rawName !== 'string') {
    return { id: 'produit', nom_affichage: 'Produit', isInvalidArtifact: true };
  }
  const invalid = isInvalidReceiptArtifact(rawName);
  const preNorm = preNormalizeRawText(rawName);
  if (!preNorm) {
    return { id: 'produit', nom_affichage: 'Produit', isInvalidArtifact: true };
  }

  for (const rule of CANONICAL_FAMILY_RULES) {
    if (rule.pattern.test(preNorm)) {
      return { id: rule.id, nom_affichage: rule.nom_affichage, rayon: rule.rayon, isInvalidArtifact: false };
    }
  }

  let working = preNorm;
  if (brand && typeof brand === 'string') {
    const cleanBrand = preNormalizeRawText(brand);
    if (cleanBrand && cleanBrand !== 'generique') {
      working = working.replace(new RegExp('\\b' + cleanBrand.replace(/\s+/g, '\\s+') + '\\b', 'gi'), ' ');
    }
  }

  working = working.replace(/\b\d+([.,]\d+)?\s*(kg|g|mg|l|cl|ml|m|cm|mm|pce|piece|pieces|tranche|tranches|unite|unites|rlx|plis|c)\b/gi, ' ');
  working = working.replace(/\b\d+\s*x\s*\d+([.,]\d+)?\b/gi, ' ');
  working = working.replace(/\bx\s*\d+\b/gi, ' ');
  working = working.replace(/\b\d+\b/g, ' ');

  const rawTokens = working.split(/\s+/).filter(Boolean);
  const filteredTokens: string[] = [];

  for (const token of rawTokens) {
    if (token.length <= 1) continue;
    if (STOP_WORDS_COUCHE_1.has(token)) continue;
    const singular = singularizeWord(token);
    if (singular && singular.length > 1 && !STOP_WORDS_COUCHE_1.has(singular)) {
      if (filteredTokens[filteredTokens.length - 1] !== singular) {
        filteredTokens.push(singular);
      }
    }
  }

  const pureSentence = filteredTokens.join(' ');
  if (pureSentence) {
    for (const rule of CANONICAL_FAMILY_RULES) {
      if (rule.pattern.test(pureSentence)) {
        return { id: rule.id, nom_affichage: rule.nom_affichage, rayon: rule.rayon, isInvalidArtifact: false };
      }
    }
  }

  const finalId = pureSentence ? pureSentence.replace(/\s+/g, '_') : preNorm.replace(/\s+/g, '_');

  let cleanDisplay = rawName
    .replace(/[-_]+/g, ' ')
    .replace(/\b\d+([.,]\d+)?\s*(kg|g|mg|l|cl|ml|m|cm|piece|pieces|pce|tranche|tranches)\b/gi, ' ')
    .replace(/\b1er\s+prix\b/gi, ' ')
    .replace(/\bprix\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const edgeStopWords = /^(de|du|des|d|l|le|la|les|en|au|aux|a|et|avec|sans|sur|piece|pce|kg|g|l|ml|cl|t|m|b|s|e|v)\s+/i;
  const trailingStopWords = /\s+(de|du|des|d|l|le|la|les|en|au|aux|a|et|avec|sans|sur|piece|pce|kg|g|l|ml|cl|t|m|b|s|e|v)$/i;
  let prev = '';
  while (cleanDisplay !== prev) {
    prev = cleanDisplay;
    cleanDisplay = cleanDisplay.replace(edgeStopWords, '').replace(trailingStopWords, '').trim();
  }
  if (!cleanDisplay && filteredTokens.length > 0) {
    cleanDisplay = filteredTokens.join(' ');
  }

  return {
    id: finalId || 'produit',
    nom_affichage: correctFrenchSpelling(cleanDisplay || 'Produit'),
    isInvalidArtifact: invalid
  };
}

export function cleanGenericEssence(rawName?: string, brand?: string): string {
  return normalizeProductNeed(rawName, brand).id.replace(/_/g, ' ') || 'produit';
}

export function generateGenericNeedKey(rawName?: string, brand?: string): string {
  return normalizeProductNeed(rawName, brand).id || 'produit';
}

export function sanitizeGenericDisplayName(rawName?: string, brand?: string): string {
  return normalizeProductNeed(rawName, brand).nom_affichage || 'Produit';
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
  // Détection des remises et promotions (Règle 5)
  is_promo?: boolean;
  remise?: number;
  taux_remise_pct?: number;
  motif_remise?: string;
  prix_brut?: number;
  prix_unitaire_base?: number;
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
  is_promo?: boolean;
  remise?: number;
  taux_remise?: number;
  motif_remise?: string;
  prix_base_unitaire?: number;
  prix_brut?: number;
}

/**
 * Structure du document Firestore regroupant les offres par magasin sous la Clé de Besoin Générique (Règle 2)
 * ID de document = Clé de Besoin Générique (ex: "sauce_burger")
 * Collection : users/{userId}/products/{cle_besoin}
 */
export interface PriceHistoryItem {
  date: string;
  magasin: string;
  prix_unitaire: number;
  is_promo?: boolean;
  remise?: number;
  prix_base_unitaire?: number;
}

export interface GenericProductDocument {
  nom_generique: string;
  rayon: LockedSupermarketAisle;
  rayon_cle: string;
  cle_besoin: string;
  offres_magasins: Record<string, StoreOfferDetail>;
  historique_offres?: Array<StoreOfferDetail & { magasin: string }>;
  // Rétrocompatibilité
  prix_actuel?: Record<string, any>;
  historique_prix: PriceHistoryItem[];
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

        const isPromo = Boolean(rawItem.is_promo || (rawItem as any).isPromo || (rawItem.remise && rawItem.remise > 0) || ((rawItem as any).discountAmount && (rawItem as any).discountAmount > 0));
        const remiseVal = Number(rawItem.remise ?? (rawItem as any).discountAmount) || 0;
        const initialP = Number(rawItem.prix_brut ?? (rawItem as any).initialPrice) || Number(prixPaye.toFixed(2));
        const baseUnitP = Number(rawItem.prix_unitaire_base ?? (rawItem as any).initialUnitPrice) || Number(prixUnitaire.toFixed(2));

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
          rawName: receiptItemEnriched.rawName,
          is_promo: isPromo,
          remise: remiseVal > 0 ? Number(remiseVal.toFixed(2)) : undefined,
          taux_remise: rawItem.taux_remise_pct ?? (rawItem as any).discountRate,
          motif_remise: rawItem.motif_remise ?? (rawItem as any).discountType,
          prix_base_unitaire: baseUnitP > 0 ? Number(baseUnitP.toFixed(2)) : undefined,
          prix_brut: initialP > 0 ? Number(initialP.toFixed(2)) : undefined
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

          // Historique chronologique complet
          const existingHistory = Array.isArray(prodData.historique_offres) ? prodData.historique_offres : [];
          const filteredHistory = existingHistory.filter(h => !(h.receiptId === receiptId && h.magasin === storeId));
          const updatedHistory = [...filteredHistory, { ...offerDetail, magasin: storeId }].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          // RÈGLE 2 : Historique des prix standardisé { date, magasin, prix_unitaire }
          const existingPriceHistory = Array.isArray(prodData.historique_prix) ? prodData.historique_prix : [];
          const filteredPriceHistory = existingPriceHistory.filter(h => !(h.date === date && h.magasin === storeId));
          const updatedPriceHistory: any[] = [
            ...filteredPriceHistory,
            {
              date,
              magasin: storeId,
              prix_unitaire: Number(prixUnitaire.toFixed(2)),
              is_promo: isPromo,
              remise: remiseVal > 0 ? Number(remiseVal.toFixed(2)) : undefined,
              prix_base_unitaire: baseUnitP > 0 ? Number(baseUnitP.toFixed(2)) : undefined
            }
          ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

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
            nom_generique: sanitizeGenericDisplayName(nomGeneriqueNettoye, marque) || prodData.nom_generique,
            offres_magasins: currentOffers,
            historique_prix: updatedPriceHistory,
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
            nom_generique: sanitizeGenericDisplayName(nomGeneriqueNettoye, marque),
            rayon: aisle.label,
            rayon_cle: aisle.key,
            cle_besoin: cleBesoin,
            offres_magasins: {
              [storeId]: offerDetail
            },
            historique_prix: [
              {
                date,
                magasin: storeId,
                prix_unitaire: Number(prixUnitaire.toFixed(2))
              }
            ],
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


// Alias strict selon les spécifications d'audit CashPilot
export const updateGenericNeedOffers = processReceiptWithSuperKeys;
