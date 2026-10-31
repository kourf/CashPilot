/**
 * Helper intelligent pour assigner un emoji adapté aux produits alimentaires
 * et rayons de supermarché pour le design CashPilot Liquid Glass (Google Stitch).
 */

const KEYWORD_EMOJI_MAP: Array<{ keywords: string[]; emoji: string }> = [
  // Poissons & Fruits de mer
  { keywords: ['surimi', 'crabe', 'crevette', 'gambas', 'homard'], emoji: '🦀' },
  { keywords: ['saumon', 'truite'], emoji: '🍣' },
  { keywords: ['sushi', 'maki', 'california', 'sashimi', 'asiatique'], emoji: '🍱' },
  { keywords: ['cabillaud', 'colin', 'merlu', 'lieu', 'poisson', 'thon', 'sardine', 'maquereau', 'dorade'], emoji: '🐟' },

  // Boucherie & Charcuterie
  { keywords: ['poulet', 'volaille', 'dinde', 'coquelet', 'chapon', 'pintade'], emoji: '🍗' },
  { keywords: ['fermier', 'label rouge', 'canard', 'magret'], emoji: '🐓' },
  { keywords: ['boeuf', 'steak', 'bavette', 'entrecote', 'faux-filet', 'roti', 'viande', 'hache'], emoji: '🥩' },
  { keywords: ['burger', 'hamburg', 'cheeseburger'], emoji: '🍔' },
  { keywords: ['cordon bleu', 'nugget', 'pane', 'escalope'], emoji: '🧀' },
  { keywords: ['porc', 'saucisse', 'lard', 'bacon', 'jambon', 'chorizo', 'saucisson', 'charcuterie'], emoji: '🥓' },

  // Épicerie salée & Condiments
  { keywords: ['cornichon', 'pickles', 'caper'], emoji: '🥒' },
  { keywords: ['sauce', 'ketchup', 'mayo', 'moutarde', 'vinaigre', 'vinaigrette'], emoji: '🥫' },
  { keywords: ['huile', 'olive', 'tournesol', 'colza'], emoji: '🫒' },
  { keywords: ['pate', 'spaghetti', 'coquillette', 'penne', 'tagliatelle', 'lasagne', 'nouille'], emoji: '🍝' },
  { keywords: ['riz', 'basmati', 'thai'], emoji: '🍚' },
  { keywords: ['pizza'], emoji: '🍕' },
  { keywords: ['sel', 'poivre', 'epice', 'curry', 'paprika', 'herbe'], emoji: '🧂' },

  // Fruits & Légumes
  { keywords: ['pomme', 'poire'], emoji: '🍎' },
  { keywords: ['banane'], emoji: '🍌' },
  { keywords: ['fraise', 'framboise', 'myrtille', 'baie'], emoji: '🍓' },
  { keywords: ['orange', 'citron', 'clementine', 'mandarine', 'pamplemousse'], emoji: '🍊' },
  { keywords: ['raisin'], emoji: '🍇' },
  { keywords: ['avocat'], emoji: '🥑' },
  { keywords: ['tomate'], emoji: '🍅' },
  { keywords: ['carotte'], emoji: '🥕' },
  { keywords: ['salade', 'laitue', 'mache', 'epinard', 'roquette'], emoji: '🥗' },
  { keywords: ['pomme de terre', 'patate', 'frite'], emoji: '🥔' },
  { keywords: ['oignon', 'ail', 'echalote'], emoji: '🧅' },
  { keywords: ['champignon'], emoji: '🍄' },

  // Boulangerie & Petit-Déjeuner
  { keywords: ['pain', 'baguette', 'mie', 'toast', 'brioche', 'biscotte'], emoji: '🥖' },
  { keywords: ['croissant', 'chocolatine', 'pain au chocolat', 'beignet', 'muffin'], emoji: '🥐' },
  { keywords: ['cafe', 'expresso', 'capsule', 'dosette', 'grain'], emoji: '☕' },
  { keywords: ['the', 'infusion', 'tisane'], emoji: '🍵' },
  { keywords: ['chocolat', 'cacao', 'nutella', 'pate a tartiner'], emoji: '🍫' },
  { keywords: ['biscuit', 'gateau', 'cookie', 'gaufre', 'sable'], emoji: '🍪' },
  { keywords: ['cereale', 'muesli', 'flocon', 'avoine'], emoji: '🥣' },

  // Produits frais & Crèmerie
  { keywords: ['lait'], emoji: '🥛' },
  { keywords: ['fromage', 'comte', 'emmental', 'mozzarella', 'gruyere', 'camembert', 'brie', 'chevre'], emoji: '🧀' },
  { keywords: ['yaourt', 'fromage blanc', 'creme', 'petit suisse'], emoji: '🥣' },
  { keywords: ['beurre', 'margarine'], emoji: '🧈' },
  { keywords: ['oeuf', 'omelette'], emoji: '🥚' },

  // Boissons
  { keywords: ['eau', 'evian', 'cristaline', 'volvic', 'perrier', 'badoit', 'san pellegrino'], emoji: '💧' },
  { keywords: ['jus', 'nectar', 'smoothie'], emoji: '🧃' },
  { keywords: ['soda', 'coca', 'pepsi', 'fanta', 'sprite', 'schweppes', 'ice tea'], emoji: '🥤' },
  { keywords: ['biere', 'cidre'], emoji: '🍺' },
  { keywords: ['vin', 'champagne', 'cremant', 'prosecco'], emoji: '🍷' },

  // Surgelés
  { keywords: ['glace', 'sorbet', 'esquimau', 'cornet'], emoji: '🍦' },
  { keywords: ['surgele'], emoji: '❄️' },

  // Hygiène, Entretien & Bébé
  { keywords: ['couche', 'lingette', 'bebe', 'biberon'], emoji: '👶' },
  { keywords: ['shampoing', 'savon', 'douche', 'dentifrice', 'hygiene', 'brosse'], emoji: '🧴' },
  { keywords: ['lessive', 'adoucissant', 'nettoyant', 'javel', 'eponge', 'essuie-tout', 'papier toilette'], emoji: '🧼' }
];

const AISLE_FALLBACK_EMOJI: Record<string, string> = {
  'Fruits & Légumes': '🥗',
  'Boucherie & Volaille': '🥩',
  'Poissonnerie & Produits de la mer': '🐟',
  'Charcuterie & Traiteur': '🥓',
  'Produits frais & Crèmerie': '🥛',
  'Boulangerie & Pâtisserie': '🥖',
  'Épicerie salée & Épices': '🧂',
  'Épicerie sucrée & Petit déjeuner': '☕',
  'Boissons sans alcool': '🥤',
  'Vins, Bières & Alcools': '🍷',
  'Surgelés': '❄️',
  'Hygiène & Beauté': '🧴',
  'Entretien & Maison': '🧼',
  'Bébé & Enfant': '👶',
  'Animaux': '🐾',
  'Bio & Diététique': '🌱',
  'Autres / Divers': '📦'
};

/**
 * Retourne un emoji expressif correspondant au produit,
 * avec repli sur le rayon ou sur un paquet générique.
 */
export function getProductEmoji(productName?: string, aisle?: string): string {
  if (productName) {
    const clean = productName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    for (const entry of KEYWORD_EMOJI_MAP) {
      if (entry.keywords.some(k => clean.includes(k))) {
        return entry.emoji;
      }
    }
  }

  if (aisle && AISLE_FALLBACK_EMOJI[aisle]) {
    return AISLE_FALLBACK_EMOJI[aisle];
  }

  return '🛒';
}
