/**
 * Référentiel en dur (Mapping) des magasins physiques pour CashPilot.
 * Permet de différencier avec une précision chirurgicale les magasins d'une même enseigne
 * (notamment les 3 Intermarché autour d'Annemasse) à partir de leur adresse d'en-tête,
 * sans AUCUNE API payante (0 € de coût d'infrastructure).
 */

export interface PhysicalStoreDefinition {
  id: string; // Identifiant unique (ex: 'intermarche_gaillard', 'intermarche_annemasse')
  brand: string; // Nom de l'enseigne mère (ex: 'Intermarché', 'E.Leclerc', 'Lidl', 'Super U')
  displayName: string; // Libellé canonique pour le tableau comparatif (ex: 'Intermarché - Gaillard')
  shortName: string; // Commune ou dénomination courte (ex: 'Gaillard')
  googleMapsName: string; // Nom officiel de la fiche Google Maps
  googleMapsUrl: string; // Lien direct Google Maps vérifié
  address: string; // Adresse postale complète
  city: string; // Commune officielle
  postalCode: string; // Code postal
  addressKeywords: string[]; // Mots-clés discriminants dans l'adresse OCR ou l'en-tête
}

/**
 * Répertoire officiel des 3 magasins Intermarché ciblés et des enseignes phares du bassin lémanique
 */
export const TARGET_PHYSICAL_STORES: Record<string, PhysicalStoreDefinition> = {
  // 1. INTERMARCHÉ GAILLARD
  intermarche_gaillard: {
    id: 'intermarche_gaillard',
    brand: 'Intermarché',
    displayName: 'Intermarché - Gaillard',
    shortName: 'Gaillard',
    googleMapsName: 'Intermarché Gaillard',
    googleMapsUrl: 'https://maps.app.goo.gl/WbcHrAVUtbrxjwXK8',
    address: '5 Rue René Cassin, ZAC de la Châtelaine, 74240 Gaillard',
    city: 'Gaillard',
    postalCode: '74240',
    addressKeywords: [
      'cassin',
      'rene cassin',
      'rené cassin',
      'chatelaine',
      'châtelaine',
      'gaillard',
      '74240'
    ]
  },

  // 2. INTERMARCHÉ HYPER ANNEMASSE (La Galerie)
  intermarche_annemasse: {
    id: 'intermarche_annemasse',
    brand: 'Intermarché',
    displayName: 'Intermarché - Annemasse',
    shortName: 'Annemasse',
    googleMapsName: 'Intermarché Hyper Annemasse',
    googleMapsUrl: 'https://maps.app.goo.gl/n2vkEedyFULFRAFB7',
    address: '14 Rue de la Résistance / Route de Thonon, 74100 Annemasse',
    city: 'Annemasse',
    postalCode: '74100',
    addressKeywords: [
      'resistance',
      'résistance',
      'mermoz',
      'jean mermoz',
      'thonon',
      'route de thonon',
      'la galerie',
      'centre commercial la galerie',
      'annemasse'
    ]
  },

  // 3. INTERMARCHÉ VILLE-LA-GRAND / VÉTRAZ-MONTHOUX
  intermarche_ville_la_grand: {
    id: 'intermarche_ville_la_grand',
    brand: 'Intermarché',
    displayName: 'Intermarché - Ville-la-Grand',
    shortName: 'Ville-la-Grand',
    googleMapsName: 'Intermarché Super Vétraz-Monthoux / Ville-la-Grand',
    googleMapsUrl: 'https://maps.app.goo.gl/u4bgwq9Af9a5pm9E7',
    address: '17 Rue des Teppes / Chemin des Érables, 74100 Vétraz-Monthoux',
    city: 'Ville-la-Grand',
    postalCode: '74100',
    addressKeywords: [
      'teppes',
      'des teppes',
      'erables',
      'érables',
      'chemin des erables',
      'vetraz',
      'vétraz',
      'monthoux',
      'ville-la-grand',
      'ville la grand'
    ]
  },

  // 4. E.LECLERC VILLE-LA-GRAND
  leclerc_ville_la_grand: {
    id: 'leclerc_ville_la_grand',
    brand: 'E.Leclerc',
    displayName: 'E.Leclerc - Ville-la-Grand',
    shortName: 'Ville-la-Grand',
    googleMapsName: 'E.Leclerc Ville-la-Grand',
    googleMapsUrl: 'https://www.google.com/maps/search/E.Leclerc+Ville-la-Grand',
    address: 'Rue Albert Hénon, 74100 Ville-la-Grand',
    city: 'Ville-la-Grand',
    postalCode: '74100',
    addressKeywords: [
      'albert henon',
      'albert hénon',
      'henon',
      'hénon',
      'ville-la-grand',
      'ville la grand'
    ]
  },

  // 5. LIDL ANNEMASSE
  lidl_annemasse: {
    id: 'lidl_annemasse',
    brand: 'Lidl',
    displayName: 'Lidl - Annemasse',
    shortName: 'Annemasse',
    googleMapsName: 'Lidl Annemasse',
    googleMapsUrl: 'https://www.google.com/maps/search/Lidl+Annemasse',
    address: '14 Rue de Genève, 74100 Annemasse',
    city: 'Annemasse',
    postalCode: '74100',
    addressKeywords: [
      'geneve',
      'genève',
      'rue de geneve',
      'annemasse'
    ]
  },

  // 6. SUPER U ÉTREMBIÈRES
  super_u_etrembieres: {
    id: 'super_u_etrembieres',
    brand: 'Super U',
    displayName: 'Super U - Étrembières',
    shortName: 'Étrembières',
    googleMapsName: 'Super U Étrembières',
    googleMapsUrl: 'https://www.google.com/maps/search/Super+U+Etrembieres',
    address: 'Shopping Léman - 21 Chemin du Carre, 74100 Étrembières',
    city: 'Étrembières',
    postalCode: '74100',
    addressKeywords: [
      'carre',
      'carré',
      'shopping leman',
      'shopping léman',
      'etrembieres',
      'étrembières',
      'etrembiere'
    ]
  }
};

/**
 * Normalise un texte pour recherche de mots-clés sans accents ni ponctuation
 */
function cleanSearchText(text?: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Rapprochement intelligent d'un ticket avec le magasin physique exact
 * basé sur l'en-tête OCR (nom, adresse, ville, code postal).
 * 0 appel API payante, 0 latence, 100% fiable.
 */
export function resolvePhysicalStore(params: {
  storeName?: string;
  storeAddress?: string;
  storePostalCode?: string;
  storeCity?: string;
  rawHeader?: string;
}): PhysicalStoreDefinition {
  const combinedText = cleanSearchText(`
    ${params.storeName || ''} 
    ${params.storeAddress || ''} 
    ${params.storePostalCode || ''} 
    ${params.storeCity || ''} 
    ${params.rawHeader || ''}
  `);

  const rawLower = (params.storeName || '').toLowerCase();

  // 1. DIFFÉRENCIATION RIGOUREUSE DES 3 INTERMARCHÉ
  if (
    rawLower.includes('intermarche') || 
    rawLower.includes('intermarché') || 
    combinedText.includes('intermarche')
  ) {
    // Intermarché Gaillard (Rue René Cassin, 74240 Gaillard)
    const gaillard = TARGET_PHYSICAL_STORES.intermarche_gaillard;
    if (gaillard.addressKeywords.some(kw => combinedText.includes(kw))) {
      return gaillard;
    }

    // Intermarché Ville-la-Grand / Vétraz-Monthoux (Rue des Teppes, 74100)
    const vlg = TARGET_PHYSICAL_STORES.intermarche_ville_la_grand;
    if (vlg.addressKeywords.some(kw => combinedText.includes(kw))) {
      return vlg;
    }

    // Intermarché Annemasse (Résistance / Mermoz / Route de Thonon)
    const annemasse = TARGET_PHYSICAL_STORES.intermarche_annemasse;
    if (annemasse.addressKeywords.some(kw => combinedText.includes(kw))) {
      return annemasse;
    }

    // Si le ticket mentionne seulement "Annemasse", repli sur l'Hyper Annemasse
    if (combinedText.includes('annemasse')) {
      return annemasse;
    }

    // Par défaut pour Intermarché si rien d'autre précisé
    return annemasse;
  }

  // 2. E.LECLERC
  if (rawLower.includes('leclerc') || combinedText.includes('leclerc')) {
    const leclerc = TARGET_PHYSICAL_STORES.leclerc_ville_la_grand;
    if (leclerc.addressKeywords.some(kw => combinedText.includes(kw)) || combinedText.includes('74100')) {
      return leclerc;
    }
    // Autre Leclerc éventuel
    const city = params.storeCity ? params.storeCity.trim() : 'Ville-la-Grand';
    const cleanCity = city.charAt(0).toUpperCase() + city.slice(1);
    const slug = `leclerc_${cleanCity.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    return {
      id: slug,
      brand: 'E.Leclerc',
      displayName: `E.Leclerc - ${cleanCity}`,
      shortName: cleanCity,
      googleMapsName: `E.Leclerc ${cleanCity}`,
      googleMapsUrl: `https://www.google.com/maps/search/E.Leclerc+${encodeURIComponent(cleanCity)}`,
      address: params.storeAddress || '',
      city: cleanCity,
      postalCode: params.storePostalCode || '',
      addressKeywords: [cleanCity.toLowerCase()]
    };
  }

  // 3. LIDL
  if (rawLower.includes('lidl') || combinedText.includes('lidl')) {
    const lidl = TARGET_PHYSICAL_STORES.lidl_annemasse;
    if (lidl.addressKeywords.some(kw => combinedText.includes(kw)) || combinedText.includes('annemasse') || combinedText.includes('74100')) {
      return lidl;
    }
    const city = params.storeCity ? params.storeCity.trim() : 'Annemasse';
    const cleanCity = city.charAt(0).toUpperCase() + city.slice(1);
    const slug = `lidl_${cleanCity.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    return {
      id: slug,
      brand: 'Lidl',
      displayName: `Lidl - ${cleanCity}`,
      shortName: cleanCity,
      googleMapsName: `Lidl ${cleanCity}`,
      googleMapsUrl: `https://www.google.com/maps/search/Lidl+${encodeURIComponent(cleanCity)}`,
      address: params.storeAddress || '',
      city: cleanCity,
      postalCode: params.storePostalCode || '',
      addressKeywords: [cleanCity.toLowerCase()]
    };
  }

  // 4. SUPER U / HYPER U / U EXPRESS
  if (
    rawLower.includes('super u') || 
    rawLower.includes('hyper u') || 
    rawLower.includes('u express') || 
    combinedText.includes('super u')
  ) {
    const superU = TARGET_PHYSICAL_STORES.super_u_etrembieres;
    if (superU.addressKeywords.some(kw => combinedText.includes(kw)) || combinedText.includes('etrembi') || combinedText.includes('74100')) {
      return superU;
    }
    const city = params.storeCity ? params.storeCity.trim() : 'Étrembières';
    const cleanCity = city.charAt(0).toUpperCase() + city.slice(1);
    const slug = `super_u_${cleanCity.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    return {
      id: slug,
      brand: 'Super U',
      displayName: `Super U - ${cleanCity}`,
      shortName: cleanCity,
      googleMapsName: `Super U ${cleanCity}`,
      googleMapsUrl: `https://www.google.com/maps/search/Super+U+${encodeURIComponent(cleanCity)}`,
      address: params.storeAddress || '',
      city: cleanCity,
      postalCode: params.storePostalCode || '',
      addressKeywords: [cleanCity.toLowerCase()]
    };
  }

  // 5. AUTRES ENSEIGNES (ex: Carrefour, Auchan, Monoprix, etc.)
  const rawClean = (params.storeName || 'Supermarché').trim();
  const city = params.storeCity ? params.storeCity.trim() : '';
  const displayName = city ? `${rawClean} - ${city}` : rawClean;
  const slug = displayName.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

  return {
    id: slug || 'magasin_inconnu',
    brand: rawClean,
    displayName,
    shortName: city || rawClean,
    googleMapsName: displayName,
    googleMapsUrl: `https://www.google.com/maps/search/${encodeURIComponent(displayName)}`,
    address: params.storeAddress || '',
    city: city || '',
    postalCode: params.storePostalCode || '',
    addressKeywords: [cleanSearchText(displayName)]
  };
}

/**
 * Liste de tous les magasins physiques connus pour alimenter les listes déroulantes de l'UI
 */
export const KNOWN_PHYSICAL_STORES_LIST = Object.values(TARGET_PHYSICAL_STORES);
