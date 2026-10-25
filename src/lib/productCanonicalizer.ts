/**
 * ============================================================================
 * MOTEUR DE NORMALISATION & FAMILLES CANONIQUES EN 3 COUCHES (100% GRATUIT)
 * ============================================================================
 * Couche 1 : Empreinte Pure (Normalisation grammaticale, suppression des stop-words,
 *            mots de liaison, conditionnements, marques et passage au singulier).
 * Couche 2 : Dictionnaire de Regroupement par « Famille Canonique » (Synonymes,
 *            abréviations tickets et corrections OCR avant et après Couche 1).
 * Couche 3 : Fusion des offres magasins, recalcul de l'écart d'audit et filtrage
 *            strict des lignes fantômes / artefacts OCR.
 * ============================================================================
 */

import type { SupermarketAisle } from '../types/receipts.ts';

export interface NormalizedProductNeed {
  /** Clé technique unique standardisée (ex: "delice_volaille_halal", "oeufs", "jus_de_pomme") */
  id: string;
  /** Nom d'affichage français propre, accentué et harmonisé (ex: "Blanc & Délice de volaille", "Œufs") */
  nom_affichage: string;
  /** Rayon officiel verrouillé si imposé par la famille canonique */
  rayon?: SupermarketAisle;
  /** Indique si la ligne est un artefact de ticket non-produit à ignorer (ex: "De articles", "Total") */
  isInvalidArtifact?: boolean;
}

export interface CanonicalFamilyRule {
  /** Expression régulière testée avant et après la Couche 1 */
  pattern: RegExp;
  /** Clé technique canonique (ID Firestore et clé de regroupement) */
  id: string;
  /** Nom canonique officiel affiché dans la matrice */
  nom_affichage: string;
  /** Rayon officiel parmi les 14 rayons verrouillés */
  rayon?: SupermarketAisle;
}

/**
 * Liste des stop-words de la Couche 1 :
 * Mots de liaison, descripteurs parasites, unités et emballages.
 */
export const STOP_WORDS_COUCHE_1 = new Set<string>([
  // Mots de liaison et prépositions
  'de', 'du', 'des', 'd', 'l', 'le', 'la', 'les', 'au', 'aux', 'a', 'en', 'et',
  'ou', 'avec', 'sans', 'sur', 'sous', 'par', 'pour', 'dans', 'un', 'une',
  // Descripteurs parasites & découpes
  'lit', 'gout', 'saveur', 'piece', 'pieces', 'pce', 'pces', 'unite', 'unites',
  'tranche', 'tranches', 'morceau', 'morceaux', 'decoupe', 'decoupes', 'entier', 'entiere', 'entiers',
  // Unités de mesure
  'kg', 'kilo', 'kilos', 'g', 'gr', 'gramme', 'grammes', 'mg',
  'cl', 'ml', 'l', 'litre', 'litres', 'dl',
  // Emballages & conditionnements
  'bocal', 'bocaux', 'sachet', 'sachets', 'pet', 'bidon', 'bidons',
  'bouteille', 'bouteilles', 'pack', 'packs', 'lot', 'lots', 'format', 'familial',
  'boite', 'boites', 'brique', 'briques', 'flacon', 'flacons', 'pot', 'pots',
  'barquette', 'barquettes', 'filet', 'filets', 'etui', 'etuis', 'tube', 'tubes',
  'verre', 'plastique', 'souple', 'squeeze', 'squeez', 'poche', 'doypack', 'vrac',
  // Marketing & mentions prix
  '1er', 'premier', 'prix', 'promo', 'offre', 'nature', 'pur', 'pure',
  'croustillant', 'croustillante', 'douceur', 'moelleux', 'moelleuse', 'sandwich',
  'complet', 'complete', 'extra', 'fin', 'fins', 'fine', 'fines', 'tres',
  'frais', 'fraiche', 'fraiches', 'bio', 'uht', 'mg', 'allonge', 'allongees', 'blonde',
  // Marques distributeurs & nationales courantes
  'super', 'u', 'leclerc', 'marque', 'repere', 'carrefour', 'intermarche', 'lidl',
  'aldi', 'auchan', 'monoprix', 'casino', 'cora', 'franprix', 'leader', 'price',
  'danone', 'barilla', 'panzani', 'heinz', 'amora', 'president', 'cristaline',
  'volvic', 'evian', 'coca', 'freeway', 'milka', 'nestle', 'harrys', 'harry',
  'lu', 'oreo', 'jafad', 'jafun', 'lesieur', 'candia', 'lactel', 'pepsi',
  'bonduelle', 'fleury', 'michon', 'herta', 'knorr', 'maggi', 'maille',
  'paturages', 'monique', 'ranou', 'chabrior', 'paquito', 'odyssee', 'pommette',
  'cantu', 'daise', 'discreet', 'finish', 'mousline', 'ayam', 'landvika', 'kult'
]);

/**
 * Exceptions invariables protégées lors du passage au singulier (Couche 1.4)
 */
export const INVARIANT_SINGULAR_EXCEPTIONS = new Set<string>([
  'mais', 'jus', 'radis', 'pois', 'noix', 'cassis', 'brebis', 'frais', 'epais',
  'ananas', 'os', 'riz', 'couscous', 'houmous', 'speculoos', 'tapas', 'nems',
  'chips', 'muesli', 'gnocchi', 'ravioli', 'tortelloni', 'spaghetti', 'macaroni',
  'farfalle', 'penne', 'lasagne', 'tagliatelle', 'brocoli', 'kiwi', 'litchi',
  'surimi', 'maki', 'sushi', 'tiramisu', 'tofu', 'quinoa', 'coulis', 'hachis'
]);

/**
 * ============================================================================
 * COUCHE 2 : DICTIONNAIRE DE REGROUPEMENT PAR « FAMILLE CANONIQUE »
 * S'exécute AVANT et APRÈS la Couche 1 pour garantir le regroupement parfait
 * des synonymes, abréviations de tickets et erreurs d'OCR.
 * ============================================================================
 */
export const CANONICAL_FAMILY_RULES: CanonicalFamilyRule[] = [
  // 1. ŒUFS (OCR tronqué "Ufs b", "Ufs boulanger", "Ufs sol", "Œufs cage", "Œufs dates", "Œufs label rouge")
  {
    pattern: /^(ufs|uf|oeuf|oeufs)(\s+.*|$)/i,
    id: 'oeufs',
    nom_affichage: 'Œufs',
    rayon: 'Produits frais & Crèmerie'
  },

  // 2. BLANC & DÉLICE DE VOLAILLE ("Delice de dinde halal", "Delice dinde halal", "Delice poulet dinde fume", "Blanc de volaille")
  {
    pattern: /^(delice.*(dinde|poulet|volaille)|blanc.*(volaille|dinde|poulet)).*/i,
    id: 'blanc_delice_volaille',
    nom_affichage: 'Blanc & Délice de volaille',
    rayon: 'Boucherie, Volaille & Poissonnerie'
  },

  // 3. LARDONS DE VOLAILLE FUMÉS ("Lardon poulet gout fume", "Lardon volaille fumee")
  {
    pattern: /^lardon.*(poulet|volaille|dinde).*/i,
    id: 'lardons_volaille_fumes',
    nom_affichage: 'Lardons de volaille fumés',
    rayon: 'Boucherie, Volaille & Poissonnerie'
  },

  // 4. CREVETTES DÉCORTIQUÉES ("Crevette deco cuite", "Crevettes decortiquees")
  {
    pattern: /^crevette.*(deco|decortique|cuite).*/i,
    id: 'crevettes_decortiquees',
    nom_affichage: 'Crevettes décortiquées',
    rayon: 'Boucherie, Volaille & Poissonnerie'
  },

  // 5. FILET DE COLIN D'ALASKA ("De colin d alaska meuniere", "Colin d'alaska")
  {
    pattern: /^(de\s+)?(filet\s+)?colin.*alaska.*/i,
    id: 'filet_colin_alaska',
    nom_affichage: "Filet de colin d'Alaska",
    rayon: 'Boucherie, Volaille & Poissonnerie'
  },

  // 6. THON LISTAO AU NATUREL ("Thon entier listao", "Thon entier listao au naturel", "Thon listao au naturel")
  {
    pattern: /^thon.*listao.*/i,
    id: 'thon_listao_naturel',
    nom_affichage: 'Thon listao au naturel',
    rayon: 'Épicerie salée & Épices'
  },

  // 7. PAIN DE MIE ("Mie", "Pain de mie", "Pain de Mie Harry S Nature", "Pain mie sandwich complet 825g")
  {
    pattern: /^(mie|pain.*mie)(\s+.*|$)/i,
    id: 'pain_de_mie',
    nom_affichage: 'Pain de mie',
    rayon: 'Épicerie salée & Épices'
  },

  // 8. FRITES ("Frites allumette kg", "Frites allumettes", "Pommes de terre frites")
  {
    pattern: /^(frite(s)?(\s+allumette.*)?|pomme(s)?\s+(de\s+)?terre\s+frite(s)?.*)$/i,
    id: 'frites',
    nom_affichage: 'Frites',
    rayon: 'Épicerie salée & Épices'
  },

  // 9. MAÏS EN BOÎTE ("Mais doux", "Mais grain sucre")
  {
    pattern: /^mais(\s+.*(doux|grain|sucre|boite|conserve).*|\s*$)/i,
    id: 'mais_boite',
    nom_affichage: 'Maïs en boîte',
    rayon: 'Épicerie salée & Épices'
  },

  // 10. SALADE BATAVIA ("Batavia", "Laitue batavia blonde", "Salade batavia blonde")
  {
    pattern: /^(batavia|laitue.*batavia.*|salade.*batavia.*)$/i,
    id: 'salade_batavia',
    nom_affichage: 'Salade Batavia',
    rayon: 'Fruits & Légumes'
  },

  // 11. CONCOMBRE ("Concombre", "Concombre piece", "Concombre tranches" — exclut "Concombre fromage", "Betterave concombre", "Maki concombre")
  {
    pattern: /^concombre(s)?(?!.*fromage)(?!.*betterave)(?!.*maki)(?!.*trio).*/i,
    id: 'concombre',
    nom_affichage: 'Concombre',
    rayon: 'Fruits & Légumes'
  },

  // 12. MELON ("Melon piece", "Melon vert", "Melon vert en morceaux")
  {
    pattern: /^melon(s)?(\s+.*|$)/i,
    id: 'melon',
    nom_affichage: 'Melon',
    rayon: 'Fruits & Légumes'
  },

  // 13. OIGNONS ÉMINCÉS ("Oignons eminces", "Oignons eminces kg")
  {
    pattern: /^oignon(s)?\s+emince(s)?.*/i,
    id: 'oignons_eminces',
    nom_affichage: 'Oignons émincés',
    rayon: 'Fruits & Légumes'
  },

  // 14. SHAKER D'ANANAS FRAIS ("Shaker ananas", "Shaker d ananas decoupe")
  {
    pattern: /^shaker.*ananas.*/i,
    id: 'shaker_ananas',
    nom_affichage: "Shaker d'ananas frais",
    rayon: 'Fruits & Légumes'
  },

  // 15. CAROTTES RÂPÉES ("Carotte rapee", "Carottes rapees")
  {
    pattern: /^carotte(s)?\s+rape(e|s|es)?.*/i,
    id: 'carottes_rapees',
    nom_affichage: 'Carottes râpées',
    rayon: 'Fruits & Légumes'
  },

  // 16. LAIT DEMI-ÉCRÉMÉ SANS LACTOSE ("Lait demi écrémé delacto", "Lait demi écrémé delactose", "Lait demi écrémé facile a digerer", "Sans lactose")
  {
    pattern: /^(lait.*(demi|1\s*2).*ecreme.*(delacto|sans\s+lactose|facile.*digerer).*|sans\s+lactose)$/i,
    id: 'lait_demi_ecreme_sans_lactose',
    nom_affichage: 'Lait demi-écrémé sans lactose',
    rayon: 'Produits frais & Crèmerie'
  },

  // 17. LAIT DEMI-ÉCRÉMÉ ("Lait demi écrémé", "Lait demi-écrémé", "Lait 1/2 écrémé")
  {
    pattern: /^lait.*(demi|1\s*2)(\s+ecreme(e)?)?(?!.*(delacto|sans\s+lactose|facile)).*/i,
    id: 'lait_demi_ecreme',
    nom_affichage: 'Lait demi-écrémé',
    rayon: 'Produits frais & Crèmerie'
  },

  // 18. JUS D'ORANGE ("Pj orange sp p", "Jus d orange sans pulpe", "Jus d'orange")
  {
    pattern: /^(pj.*orange.*|pur.*jus.*orange.*|jus.*orange.*)$/i,
    id: 'jus_d_orange',
    nom_affichage: "Jus d'orange",
    rayon: 'Boissons'
  },

  // 19. JUS DE POMME ("Pj pomme", "Pur Jus de Pomme", "Pur Jus Pomme Pet", "Jus de pomme")
  {
    pattern: /^(pj.*pomme.*|pur.*jus.*pomme.*|jus.*pomme.*)$/i,
    id: 'jus_de_pomme',
    nom_affichage: 'Jus de pomme',
    rayon: 'Boissons'
  },

  // 20. JUS MULTIFRUITS ("Pj multi", "Abc multi bk", "Jus multifruits", "Jus multifruits abc", "Jafun boisson multifruits", "Jus tutti frutti")
  {
    pattern: /^(pj.*multi.*|abc.*multi.*|jus.*multifruit.*|jafun.*multifruit.*|jus.*tutti.*frutti.*)$/i,
    id: 'jus_multifruits',
    nom_affichage: 'Jus multifruits',
    rayon: 'Boissons'
  },

  // 21. EAU MINÉRALE ("Eau minerale", "Eau minerale naturelle", "Bouchon sport")
  {
    pattern: /^(eau.*minerale.*|bouchon.*sport.*)$/i,
    id: 'eau_minerale',
    nom_affichage: 'Eau minérale',
    rayon: 'Boissons'
  },

  // 22. EAU DE SOURCE ("Eau de source", "Eau source" — exclut "Boisson eau source peche")
  {
    pattern: /^eau\s+(de\s+)?source(?!.*peche)(?!.*fraise)(?!.*citron).*/i,
    id: 'eau_de_source',
    nom_affichage: 'Eau de source',
    rayon: 'Boissons'
  },

  // 23. CONFITURE DE FRAISE ("Confiture de fraise", "Confiture fraise")
  {
    pattern: /^confiture(s)?\s+(de\s+)?fraise(s)?.*/i,
    id: 'confiture_fraise',
    nom_affichage: 'Confiture de fraise',
    rayon: 'Épicerie sucrée'
  },

  // 24. BEIGNETS AU CHOCOLAT ("Beignet chocolat", "Beignets chocolat")
  {
    pattern: /^beignet(s)?\s+(au\s+)?chocolat.*/i,
    id: 'beignets_chocolat',
    nom_affichage: 'Beignets au chocolat',
    rayon: 'Épicerie sucrée'
  },

  // 25. YAOURT VANILLE ("Yaourt vanille bio", "Yaourts vanille")
  {
    pattern: /^yaourt(s)?\s+(saveur\s+)?vanille(?!.*bille).*/i,
    id: 'yaourt_vanille',
    nom_affichage: 'Yaourt vanille',
    rayon: 'Produits frais & Crèmerie'
  },

  // --- RÈGLES COMPLÉMENTAIRES DÉTECTÉES DANS LA MATRICE ACTUELLE ---

  // 26. BAGUETTE ("Baguette", "Baguette la" — conserve "Baguette campagne" et "Baguette tradition" distinctes ou regroupées)
  {
    pattern: /^baguette(s)?(\s+la|\s+blanche)?$/i,
    id: 'baguette',
    nom_affichage: 'Baguette',
    rayon: 'Épicerie salée & Épices'
  },

  // 27. BASILIC ("Basilic en", "Basilic")
  {
    pattern: /^basilic(\s+en|\s+frais)?$/i,
    id: 'basilic',
    nom_affichage: 'Basilic',
    rayon: 'Fruits & Légumes'
  },

  // 28. BANANES ("Banane ruban fruits", "Bananes")
  {
    pattern: /^banane(s)?(\s+ruban.*|\s+vrac.*)?$/i,
    id: 'bananes',
    nom_affichage: 'Bananes',
    rayon: 'Fruits & Légumes'
  },

  // 29. POMMES DE TERRE ("Pommes de terre 1er prix", "Pommes de terre prix", "Pomm terre")
  {
    pattern: /^pomme(s)?\s+(de\s+)?terre(?!.*frite)(?!.*puree).*/i,
    id: 'pommes_de_terre',
    nom_affichage: 'Pommes de terre',
    rayon: 'Fruits & Légumes'
  },

  // 30. HARICOTS VERTS ("Haricots verts", "Haricots verts extra fins")
  {
    pattern: /^haricot(s)?\s+vert(s)?.*/i,
    id: 'haricots_verts',
    nom_affichage: 'Haricots verts',
    rayon: 'Épicerie salée & Épices'
  },

  // 31. PETITS POIS ("Petits pois tres fins", "Petits pois extra fins")
  {
    pattern: /^petit(s)?\s+pois(?!.*carotte).*/i,
    id: 'petits_pois',
    nom_affichage: 'Petits pois',
    rayon: 'Épicerie salée & Épices'
  },

  // 32. MAYONNAISE
  {
    pattern: /^mayonnaise.*/i,
    id: 'mayonnaise',
    nom_affichage: 'Mayonnaise',
    rayon: 'Épicerie salée & Épices'
  },

  // 33. HUILE DE TOURNESOL
  {
    pattern: /^huile\s+(de\s+)?tournesol.*/i,
    id: 'huile_de_tournesol',
    nom_affichage: 'Huile de tournesol',
    rayon: 'Épicerie salée & Épices'
  },

  // 34. HUILE D'OLIVE VIERGE
  {
    pattern: /^huile\s+(d\s+)?olive.*/i,
    id: 'huile_d_olive',
    nom_affichage: "Huile d'olive vierge",
    rayon: 'Épicerie salée & Épices'
  },

  // 35. SAUCE AIGRE-DOUCE ("Sauce aigre douce", "Sauce fruits aigre douce")
  {
    pattern: /^sauce\s+(fruits?\s+)?aigre\s+douce.*/i,
    id: 'sauce_aigre_douce',
    nom_affichage: 'Sauce aigre-douce',
    rayon: 'Épicerie salée & Épices'
  },

  // 36. SAUCE BÉCHAMEL ("E v sauce bechamel", "Sauce bechamel")
  {
    pattern: /^(e\s+v\s+)?sauce\s+bechamel.*/i,
    id: 'sauce_bechamel',
    nom_affichage: 'Sauce Béchamel',
    rayon: 'Épicerie salée & Épices'
  },

  // 37. CHIPS BBQ ("Chips mtp bbq", "Chips barbecue")
  {
    pattern: /^chips?\s+(mtp\s+)?(bbq|barbecue).*/i,
    id: 'chips_bbq',
    nom_affichage: 'Chips BBQ',
    rayon: 'Épicerie salée & Épices'
  },

  // 38. CORNICHONS ("Cornichons fins", "Cornichons")
  {
    pattern: /^cornichon(s)?(\s+fins?)?$/i,
    id: 'cornichons',
    nom_affichage: 'Cornichons',
    rayon: 'Épicerie salée & Épices'
  },

  // 39. SAUCISSES DE VOLAILLE ("Les saucisdelices", "Saucisse de volaille")
  {
    pattern: /^(les\s+saucisdelices|saucisse(s)?\s+(de\s+)?volaille.*)$/i,
    id: 'saucisses_volaille',
    nom_affichage: 'Saucisses de volaille',
    rayon: 'Boucherie, Volaille & Poissonnerie'
  },

  // 40. CABILLAUD PANÉ ("Msc cabillaud pane", "Cabillaud pane")
  {
    pattern: /^(msc\s+)?cabillaud\s+pane.*/i,
    id: 'cabillaud_pane',
    nom_affichage: 'Cabillaud pané',
    rayon: 'Boucherie, Volaille & Poissonnerie'
  },

  // 41. PAVÉS DE TRUITE ("Paves de truite")
  {
    pattern: /^pave(s)?\s+(de\s+)?truite.*/i,
    id: 'paves_truite',
    nom_affichage: 'Pavés de truite',
    rayon: 'Boucherie, Volaille & Poissonnerie'
  },

  // 42. TRUITE FUMÉE ("Truite fumee landvika", "Truite fumee")
  {
    pattern: /^truite\s+fume(e)?.*/i,
    id: 'truite_fumee',
    nom_affichage: 'Truite fumée',
    rayon: 'Boucherie, Volaille & Poissonnerie'
  },

  // 43. SAUMON FUMÉ ("Saumon fume norvege", "Saumon fume")
  {
    pattern: /^saumon\s+fume.*/i,
    id: 'saumon_fume',
    nom_affichage: 'Saumon fumé',
    rayon: 'Boucherie, Volaille & Poissonnerie'
  },

  // 44. FROMAGE AIL ET FINES HERBES ("Fromage ail et fines herbes", "Specialite ail et herbes")
  {
    pattern: /^(fromage|specialite)\s+ail\s+(et\s+)?(fines?\s+)?herbes?.*/i,
    id: 'fromage_ail_fines_herbes',
    nom_affichage: 'Fromage ail et fines herbes',
    rayon: 'Produits frais & Crèmerie'
  },

  // 45. CRÈME DESSERT VANILLE ("Pop crème saveur vanille", "Pop vanille bil 3c")
  {
    pattern: /^pop\s+(creme\s+)?(saveur\s+)?vanille.*/i,
    id: 'creme_dessert_vanille',
    nom_affichage: 'Crème dessert vanille',
    rayon: 'Produits frais & Crèmerie'
  },

  // 46. CRÈME AUX ŒUFS CARAMEL ("Crème ufs sur lit caramel")
  {
    pattern: /^creme\s+(ufs|oeufs|aux\s+oeufs)\s+(sur\s+)?(lit\s+)?(de\s+)?caramel.*/i,
    id: 'creme_oeufs_caramel',
    nom_affichage: 'Crème aux œufs caramel',
    rayon: 'Produits frais & Crèmerie'
  },

  // 47. COMPOTE DE POMMES ("Compote de pomme sans sucre ajoute", "Dessert fruits pomme")
  {
    pattern: /^(compote(s)?\s+(de\s+)?pomme(s)?(?!.*banane)(?!.*poire).*|dessert\s+(de\s+)?fruits?\s+pomme(s)?)$/i,
    id: 'compote_pommes',
    nom_affichage: 'Compote de pommes',
    rayon: 'Épicerie sucrée'
  },

  // 48. BISCUITS SPÉCULOOS ("Biscuits speculoos", "Speculoos")
  {
    pattern: /^(biscuit(s)?\s+speculoos|speculoos)$/i,
    id: 'biscuits_speculoos',
    nom_affichage: 'Biscuits Spéculoos',
    rayon: 'Épicerie sucrée'
  },

  // 49. TARTINES CRAQUANTES AU FROMENT ("Cracotte froment", "Tartines craquantes froment")
  {
    pattern: /^(cracotte(s)?\s+froment|tartine(s)?\s+craquante(s)?\s+froment)$/i,
    id: 'tartines_froment',
    nom_affichage: 'Tartines craquantes au froment',
    rayon: 'Épicerie sucrée'
  },

  // 50. CORN FLAKES / PÉTALES DE MAÏS ("Corn flakes sucres", "Petales mais sucre m l")
  {
    pattern: /^(corn\s+flakes?.*|petale(s)?\s+(de\s+)?mais\s+sucre.*)$/i,
    id: 'corn_flakes',
    nom_affichage: 'Corn Flakes / Pétales de maïs',
    rayon: 'Épicerie sucrée'
  },

  // 51. CÉRÉALES FOURRÉES CHOCOLAT LAIT ("Cereale fou choc lait", "Cereales fourrees au lait")
  {
    pattern: /^cereale(s)?\s+(fou|fourree(s)?).*(choc|lait).*/i,
    id: 'cereales_fourrees_chocolat',
    nom_affichage: 'Céréales fourrées chocolat lait',
    rayon: 'Épicerie sucrée'
  },

  // 52. CÉRÉALES CHOCOS ("Cereales coco pops chocos", "Chocos")
  {
    pattern: /^(cereale(s)?\s+coco\s+pops\s+chocos|chocos)$/i,
    id: 'cereales_chocos',
    nom_affichage: 'Céréales Chocos',
    rayon: 'Épicerie sucrée'
  },

  // 53. MOUCHOIRS EN PAPIER ("Mouchoirs blancs en", "Mouchoirs de plis")
  {
    pattern: /^mouchoir(s)?(\s+blancs?)?(\s+en)?(\s+de\s+plis)?$/i,
    id: 'mouchoirs_papier',
    nom_affichage: 'Mouchoirs en papier',
    rayon: 'Hygiène, Beauté & Sanitaire'
  },

  // 54. LAIT HYDRATANT POUR LE CORPS ("Lait corps absolu", "Lait corps solide hyaluronique", "Lait de corps poche")
  {
    pattern: /^lait\s+(de\s+)?corps.*/i,
    id: 'lait_hydratant_corps',
    nom_affichage: 'Lait hydratant pour le corps',
    rayon: 'Hygiène, Beauté & Sanitaire'
  },

  // 55. EAU DE TOILETTE ("Eau de toilette fleur d oranger", "Eau de toilette fleur de coton")
  {
    pattern: /^eau\s+de\s+toilette.*/i,
    id: 'eau_de_toilette',
    nom_affichage: 'Eau de toilette',
    rayon: 'Hygiène, Beauté & Sanitaire'
  },

  // 56. ESSUIE-TOUT ("Essuie tout", "Essuie tout blanc")
  {
    pattern: /^essuie\s+tout.*/i,
    id: 'essuie_tout',
    nom_affichage: 'Essuie-tout',
    rayon: 'Entretien & Maison'
  },

  // 57. FILM ALIMENTAIRE ÉTIRABLE ("Film etirable 50m", "Papier film blanc")
  {
    pattern: /^(film\s+etirable.*|papier\s+film\s+blanc.*)$/i,
    id: 'film_alimentaire',
    nom_affichage: 'Film alimentaire étirable',
    rayon: 'Entretien & Maison'
  },

  // 58. PILES ALCALINES ("Dom pile alca classique", "Dom pile alca powermax")
  {
    pattern: /^(dom\s+)?pile(s)?\s+alca.*/i,
    id: 'piles_alcalines',
    nom_affichage: 'Piles alcalines',
    rayon: 'Entretien & Maison'
  },

  // 59. LESSIVE LIQUIDE ("Lessive liquide fraicheur", "Lessive liquide marseille")
  {
    pattern: /^lessive\s+liquide.*/i,
    id: 'lessive_liquide',
    nom_affichage: 'Lessive liquide',
    rayon: 'Entretien & Maison'
  },

  // 60. LIQUIDE VAISSELLE ("Liquide vaisselle exotique", "Liquide vaisselle peaux sensibles", "Vaisselle hygiene")
  {
    pattern: /^(liquide\s+vaisselle.*|vaisselle\s+hygiene.*)$/i,
    id: 'liquide_vaisselle',
    nom_affichage: 'Liquide vaisselle',
    rayon: 'Entretien & Maison'
  },

  // 61. PRODUIT LAVE-VAISSELLE ("Finish gel citron", "Gel lavage concentre", "Pastille lave vaisselle")
  {
    pattern: /^(finish\s+gel.*|gel\s+lavage\s+concentre.*|pastille(s)?\s+lave\s+vaisselle.*)$/i,
    id: 'produit_lave_vaisselle',
    nom_affichage: 'Produit lave-vaisselle',
    rayon: 'Entretien & Maison'
  },

  // 62. DÉBOUCHEUR CANALISATIONS ("Deboucheur special cheveux", "Gel deboucheur javel soude")
  {
    pattern: /^(deboucheur.*|gel\s+deboucheur.*)$/i,
    id: 'deboucheur_canalisations',
    nom_affichage: 'Déboucheur canalisations',
    rayon: 'Entretien & Maison'
  },

  // 63. NETTOYANT & BLOC WC ("Syphon bloc wc cuvette javel", "Syphon gel wc marine")
  {
    pattern: /^syphon\s+(bloc|gel)\s+wc.*/i,
    id: 'nettoyant_wc',
    nom_affichage: 'Nettoyant & Bloc WC',
    rayon: 'Entretien & Maison'
  },

  // 64. THÉ GLACÉ PÊCHE ("Ice tea peche", "The glacée peche", "The peche", "Boisson eau source peche", "Peche")
  {
    pattern: /^(ice\s+tea\s+peche.*|the\s+(glace(e)?\s+)?peche.*|boisson\s+eau\s+source\s+peche.*|peche)$/i,
    id: 'the_glace_peche',
    nom_affichage: 'Thé glacé pêche',
    rayon: 'Boissons'
  },

  // 65. SODA CITRON-CITRON VERT ("Boisson gazeuse lemon lime", "Soda lemon lime")
  {
    pattern: /^(boisson\s+gazeuse\s+lemon\s+lime.*|soda\s+lemon\s+lime.*)$/i,
    id: 'soda_lemon_lime',
    nom_affichage: 'Soda citron-citron vert',
    rayon: 'Boissons'
  },

  // 66. ORANGINA ("Orangina jaune", "Jaune")
  {
    pattern: /^(orangina(\s+jaune)?|jaune)$/i,
    id: 'orangina',
    nom_affichage: 'Orangina',
    rayon: 'Boissons'
  },

  // 67. COCA-COLA / COLA STANDARD ("Regular", "Coca regular", "Cola regular")
  {
    pattern: /^(regular|coca.*regular|cola.*regular)$/i,
    id: 'cola_standard',
    nom_affichage: 'Coca-Cola / Cola standard',
    rayon: 'Boissons'
  },

  // 68. COCA-COLA ZÉRO / SANS SUCRE ("Zero", "Coca zero", "Cola zero")
  {
    pattern: /^(zero|coca.*zero|cola.*zero)$/i,
    id: 'cola_zero',
    nom_affichage: 'Coca-Cola Zéro / Sans sucre',
    rayon: 'Boissons'
  },

  // 69. GLAÇONS ("Glacons", "Sac grains de glacée", "Sac grains de glace")
  {
    pattern: /^(glacon(s)?|sac\s+grains?\s+(de\s+)?glace(e)?)$/i,
    id: 'glacons',
    nom_affichage: 'Glaçons',
    rayon: 'Boissons'
  },

  // 70. SAC DE CAISSE / CABAS ("Sac", "Sac kraft drive", "Sac poignee")
  {
    pattern: /^(sac|sac\s+kraft\s+drive|sac\s+poignee|sac\s+cabas)$/i,
    id: 'sac_caisse',
    nom_affichage: 'Sac de caisse / Cabas',
    rayon: 'Sacs & Consignes'
  }
];

/**
 * Convertit un mot français (sans accent, en minuscules) au singulier strict pour la clé technique.
 */
export function singularizeWord(word: string): string {
  if (!word || word.length <= 2) return word;
  if (INVARIANT_SINGULAR_EXCEPTIONS.has(word)) return word;

  let w = word;

  // Pluriels en -aux -> -au (ex: gateaux -> gateau, poireaux -> poireau)
  if (w.endsWith('aux') && w.length > 4) {
    return w.slice(0, -1); // gateaux -> gateau
  }

  // Retrait du 's' ou 'x' final de pluriel
  if ((w.endsWith('s') || w.endsWith('x')) && w.length > 3) {
    w = w.slice(0, -1);
  }

  // Harmonisation des participes passés féminins fréquents sur la clé technique
  // (ex: rapee -> rape, fumee -> fume, decortiquee -> decortique, emincee -> emince)
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

/**
 * Pré-normalise une chaîne brute : minuscules, remplacement de œ -> oe,
 * ponctuation remplacée par espaces, suppression des accents.
 */
export function preNormalizeRawText(rawName: string): string {
  if (!rawName || typeof rawName !== 'string') return '';

  let s = rawName
    .replace(/œ/gi, 'oe')
    .replace(/æ/gi, 'ae')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_'/’.,:;()[\]]+/g, ' ');

  // Corrections OCR préliminaires
  s = s.replace(/\bb\s*u+f\b/g, 'boeuf');
  s = s.replace(/\bc\s*ur\b/g, 'coeur');
  s = s.replace(/\b1\s*[/_\s-]?\s*2\b/g, 'demi');
  s = s.replace(/\bsteacks?\b/g, 'steak');
  s = s.replace(/\bpomm?\s+terre\b/g, 'pommes de terre');

  return s.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Détecte si une ligne extraite est un artefact de ticket non-produit
 * (ex: "De articles", "12 articles", "Sous-total", "Carte bancaire", "Produit" vide).
 */
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

/**
 * Nettoie un libellé pour l'affichage humain lorsque le produit n'appartient pas
 * à une famille canonique prédéfinie :
 * - Supprime les mots de liaison ou unités coupés en début/fin ("Baguette la" -> "Baguette", "Basilic en" -> "Basilic")
 * - Corrige l'orthographe et les accents français
 */
export function buildCleanDisplayName(rawName: string, fallbackWords: string[]): string {
  let s = rawName
    .replace(/[-_]+/g, ' ')
    .replace(/\b\d+([.,]\d+)?\s*(kg|g|mg|l|cl|ml|m|cm|piece|pieces|pce|tranche|tranches)\b/gi, ' ')
    .replace(/\b1er\s+prix\b/gi, ' ')
    .replace(/\bprix\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Supprimer les mots parasites isolés en début ou en fin de chaîne
  const edgeStopWords = /^(de|du|des|d|l|le|la|les|en|au|aux|a|et|avec|sans|sur|piece|pce|kg|g|l|ml|cl|t|m|b|s|e|v)\s+/i;
  const trailingStopWords = /\s+(de|du|des|d|l|le|la|les|en|au|aux|a|et|avec|sans|sur|piece|pce|kg|g|l|ml|cl|t|m|b|s|e|v)$/i;

  let prev = '';
  while (s !== prev) {
    prev = s;
    s = s.replace(edgeStopWords, '').replace(trailingStopWords, '').trim();
  }

  if (!s && fallbackWords.length > 0) {
    s = fallbackWords.join(' ');
  }

  // Corrections orthographiques et accents français
  const corrections: Array<[RegExp, string]> = [
    [/\bb\s*u+f\b/gi, 'bœuf'],
    [/\bboeuf\b/gi, 'bœuf'],
    [/\bc\s*ur\b/gi, 'cœur'],
    [/\bcoeur\b/gi, 'cœur'],
    [/\bsteacks?\b/gi, 'steak'],
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
    [/\bufs\b/gi, 'œufs'],
    [/\bhache\b/gi, 'haché'],
    [/\bhachee\b/gi, 'hachée'],
    [/\broti\b/gi, 'rôti'],
    [/\bglacee\b/gi, 'glacée'],
    [/\brape\b/gi, 'râpé'],
    [/\brapee\b/gi, 'râpée'],
    [/\brapees\b/gi, 'râpées'],
    [/\bemince\b/gi, 'émincé'],
    [/\beminces\b/gi, 'émincés'],
    [/\bdecortique\b/gi, 'décortiqué'],
    [/\bdecortiquees\b/gi, 'décortiquées'],
    [/\bfume\b/gi, 'fumé'],
    [/\bfumee\b/gi, 'fumée'],
    [/\bfumes\b/gi, 'fumés'],
    [/\ballege\b/gi, 'allégé'],
    [/\ballegee\b/gi, 'allégée'],
    [/\bfeuilletee\b/gi, 'feuilletée'],
    [/\bbrisee\b/gi, 'brisée'],
    [/\bsurgele\b/gi, 'surgelé'],
    [/\beleve\b/gi, 'élevé'],
    [/\bfrancais\b/gi, 'français'],
    [/\bfrancaise\b/gi, 'française'],
    [/\bepais\b/gi, 'épais'],
    [/\blegers\b/gi, 'légers'],
    [/\blegumes\b/gi, 'légumes'],
    [/\bveloute\b/gi, 'velouté'],
    [/\bpuree\b/gi, 'purée'],
    [/\bcereales\b/gi, 'céréales'],
    [/\bcereale\b/gi, 'céréales'],
    [/\bgateau\b/gi, 'gâteau'],
    [/\bgateaux\b/gi, 'gâteaux'],
    [/\bpecbbq\b/gi, 'BBQ'],
    [/\bpeche\b/gi, 'pêche'],
    [/\bpecheur\b/gi, 'pêcheur'],
    [/\bclementine\b/gi, 'clémentine'],
    [/\bpoeler\b/gi, 'poêler'],
    [/\bmeuniere\b/gi, 'meunière'],
    [/\bprovencale\b/gi, 'provençale'],
    [/\bspecialite\b/gi, 'spécialité'],
    [/\bfromagere\b/gi, 'fromagère'],
    [/\baperitifs\b/gi, 'apéritifs'],
    [/\bvanille\b/gi, 'vanille'],
    [/\bessuie\s+tout\b/gi, 'essuie-tout'],
    [/\bapre(s)?\s+shampoing\b/gi, 'après-shampoing'],
    [/\bdeodorant\b/gi, 'déodorant'],
    [/\bdemelant\b/gi, 'démêlant'],
    [/\bkarite\b/gi, 'karité'],
    [/\bmenager\b/gi, 'ménager'],
    [/\bdesinfectant\b/gi, 'désinfectant'],
    [/\bbacteriennes\b/gi, 'bactériennes'],
    [/\betirable\b/gi, 'étirable'],
    [/\bconcentre\b/gi, 'concentré']
  ];

  for (const [rx, rep] of corrections) {
    s = s.replace(rx, rep);
  }

  s = s.replace(/\s+/g, ' ').trim();
  if (!s) return 'Produit';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * ============================================================================
 * FONCTION PRINCIPALE PARTAGÉE : normalizeProductNeed(rawName, brand)
 * Combine Couche 1 (Empreinte Pure) et Couche 2 (Familles Canoniques).
 * ============================================================================
 */
export function normalizeProductNeed(rawName?: string, brand?: string): NormalizedProductNeed {
  if (!rawName || typeof rawName !== 'string') {
    return { id: 'produit', nom_affichage: 'Produit', isInvalidArtifact: true };
  }

  const invalid = isInvalidReceiptArtifact(rawName);
  const preNorm = preNormalizeRawText(rawName);

  if (!preNorm) {
    return { id: 'produit', nom_affichage: 'Produit', isInvalidArtifact: true };
  }

  // 1. PASSE AVANT COUCHE 1 : Test du Dictionnaire des Familles Canoniques (Couche 2)
  for (const rule of CANONICAL_FAMILY_RULES) {
    if (rule.pattern.test(preNorm)) {
      return {
        id: rule.id,
        nom_affichage: rule.nom_affichage,
        rayon: rule.rayon,
        isInvalidArtifact: false
      };
    }
  }

  // 2. COUCHE 1 : Algorithme d'« Empreinte Pure »
  let working = preNorm;

  // Retrait de la marque passée en paramètre
  if (brand && typeof brand === 'string') {
    const cleanBrand = preNormalizeRawText(brand);
    if (cleanBrand && cleanBrand !== 'generique') {
      working = working.replace(new RegExp('\\b' + cleanBrand.replace(/\s+/g, '\\s+') + '\\b', 'gi'), ' ');
    }
  }

  // Retrait des quantités / contenances numériques (ex: "825g", "1.5l", "6x1l", "50m", "30m", "3c", "t55" gardé si farine)
  working = working.replace(/\b\d+([.,]\d+)?\s*(kg|g|mg|l|cl|ml|m|cm|mm|pce|piece|pieces|tranche|tranches|unite|unites|rlx|plis|c)\b/gi, ' ');
  working = working.replace(/\b\d+\s*x\s*\d+([.,]\d+)?\b/gi, ' ');
  working = working.replace(/\bx\s*\d+\b/gi, ' ');
  working = working.replace(/\b\d+\b/g, ' ');

  // Découpage en mots, filtrage des stop-words (Couche 1.2 & 1.3) et passage au singulier (Couche 1.4)
  const rawTokens = working.split(/\s+/).filter(Boolean);
  const filteredTokens: string[] = [];

  for (const token of rawTokens) {
    // Ignorer les lettres isolées d'1 caractère (ex: "b", "l", "t", "e", "v", "n", "p", "c")
    if (token.length <= 1) continue;
    if (STOP_WORDS_COUCHE_1.has(token)) continue;

    const singular = singularizeWord(token);
    if (singular && singular.length > 1 && !STOP_WORDS_COUCHE_1.has(singular)) {
      // Éviter les répétitions immédiates du même mot (ex: "ecreme ecreme")
      if (filteredTokens[filteredTokens.length - 1] !== singular) {
        filteredTokens.push(singular);
      }
    }
  }

  const pureSentence = filteredTokens.join(' ');

  // 3. PASSE APRÈS COUCHE 1 : Re-test du Dictionnaire des Familles Canoniques sur l'empreinte pure
  if (pureSentence) {
    for (const rule of CANONICAL_FAMILY_RULES) {
      if (rule.pattern.test(pureSentence)) {
        return {
          id: rule.id,
          nom_affichage: rule.nom_affichage,
          rayon: rule.rayon,
          isInvalidArtifact: false
        };
      }
    }
  }

  const finalId = pureSentence
    ? pureSentence.replace(/\s+/g, '_')
    : preNorm.replace(/\s+/g, '_');

  const finalDisplayName = buildCleanDisplayName(rawName, filteredTokens);

  return {
    id: finalId || 'produit',
    nom_affichage: finalDisplayName,
    isInvalidArtifact: invalid
  };
}
