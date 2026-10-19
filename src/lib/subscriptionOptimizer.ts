import { getGeminiApiKey } from './geminiService';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import type {
  SubscriptionOptimizationRequest,
  SubscriptionOptimizationResponse
} from '../types/index';

export interface CheaperAlternative {
  id: string;
  provider: string;
  planName: string;
  monthlyPrice: number;
  commitment: string;
  badge?: string;
  features: string[];
}

export interface OptimizationAnalysis {
  categoryType: 'box' | 'mobile' | 'streaming' | 'music' | 'gym' | 'energy' | 'insurance' | 'other';
  currentPrice: number;
  bestAlternative: CheaperAlternative;
  allAlternatives: CheaperAlternative[];
  annualSavings: number;
  monthlySavings: number;
  negotiationScript: string;
}

const MARKET_BENCHMARKS: Record<string, CheaperAlternative[]> = {
  box: [
    {
      id: 'box-red',
      provider: 'RED by SFR',
      planName: 'RED Box Fibre Très Haut Débit',
      monthlyPrice: 24.99,
      commitment: 'Sans engagement',
      badge: 'Meilleur Prix',
      features: ['Fibre 500 Mb/s symétrique', 'Appels illimités fixes', 'Box Wi-Fi 5 incluse']
    },
    {
      id: 'box-sosh',
      provider: 'Sosh',
      planName: 'La Boîte Sosh Fibre (Réseau Orange)',
      monthlyPrice: 25.99,
      commitment: 'Sans engagement',
      badge: 'Réseau N°1 Orange',
      features: ['Fibre 300 Mb/s sur réseau Orange', 'Livebox 5 incluse', 'Frais de résiliation remboursés jusqu\'à 100€']
    },
    {
      id: 'box-free',
      provider: 'Free',
      planName: 'Freebox Pop Fibre',
      monthlyPrice: 29.99,
      commitment: 'Sans engagement',
      badge: 'Ultra Rapide 5 Gb/s',
      features: ['Fibre jusqu\'à 5 Gb/s partagés', 'Player TV 4K inclus', 'Forfait Free 5G illimité à 9,99€']
    },
    {
      id: 'box-bouygues',
      provider: 'Bouygues Telecom',
      planName: 'Bbox Fit Fibre',
      monthlyPrice: 19.99,
      commitment: '12 mois',
      badge: 'Éco-Budget',
      features: ['Fibre 400 Mb/s', 'Wi-Fi intelligent', 'Installation fibre gratuite']
    }
  ],
  mobile: [
    {
      id: 'mob-byou',
      provider: 'B&You (Bouygues)',
      planName: 'Série Spéciale 100 Go 5G',
      monthlyPrice: 9.99,
      commitment: 'Sans engagement',
      badge: 'Top Vente',
      features: ['100 Go en 5G en France', '25 Go en Europe / DOM', 'Appels & SMS/MMS illimités']
    },
    {
      id: 'mob-red',
      provider: 'RED by SFR',
      planName: 'Forfait 100 Go 5G',
      monthlyPrice: 9.99,
      commitment: 'Sans engagement',
      badge: 'Sans engagement',
      features: ['100 Go en 5G', '22 Go depuis UE/DOM', 'eSIM disponible immédiatement']
    },
    {
      id: 'mob-prixtel',
      provider: 'Prixtel',
      planName: 'Le grand (40 à 60 Go)',
      monthlyPrice: 6.99,
      commitment: 'Sans engagement',
      badge: 'Prix Mini',
      features: ['Ajustable selon conso', 'Réseau SFR 4G/5G', 'Neutre en carbone']
    },
    {
      id: 'mob-sosh',
      provider: 'Sosh',
      planName: 'Forfait Sosh 80 Go',
      monthlyPrice: 10.99,
      commitment: 'Sans engagement',
      badge: 'Qualité Orange',
      features: ['80 Go sur le réseau Orange', 'Appels/SMS illimités Europe', 'Sans engagement']
    }
  ],
  streaming: [
    {
      id: 'stream-netflix-pub',
      provider: 'Netflix',
      planName: 'Standard avec pub',
      monthlyPrice: 5.99,
      commitment: 'Sans engagement',
      badge: 'Économique',
      features: ['Full HD 1080p', '2 écrans en simultané', 'Accès à tout le catalogue']
    },
    {
      id: 'stream-prime',
      provider: 'Amazon Prime Video',
      planName: 'Abonnement Annuel Prime',
      monthlyPrice: 5.83,
      commitment: 'Annuel',
      badge: 'Prime Inclus',
      features: ['Livraison Prime gratuite', 'Prime Video & Prime Music', 'Économie de 15% vs mensuel']
    },
    {
      id: 'stream-disney-pub',
      provider: 'Disney+',
      planName: 'Standard avec pub',
      monthlyPrice: 5.99,
      commitment: 'Sans engagement',
      badge: 'Famille',
      features: ['1080p Full HD', 'Disney, Pixar, Marvel, Star Wars', 'Contrôle parental avancé']
    }
  ],
  music: [
    {
      id: 'mus-spotify-duo',
      provider: 'Spotify',
      planName: 'Premium Duo (2 comptes)',
      monthlyPrice: 7.50,
      commitment: 'Sans engagement',
      badge: 'Partage',
      features: ['2 comptes Premium indépendants', 'Musique sans pub et hors-ligne', 'Économie de 3,50€/pers']
    },
    {
      id: 'mus-deezer-annuel',
      provider: 'Deezer',
      planName: 'Premium Annuel (-25%)',
      monthlyPrice: 8.25,
      commitment: '1 an',
      badge: '-25% en Annuel',
      features: ['Son haute fidélité FLAC', 'Sans pub, zapping illimité', '99€/an au lieu de 131,88€']
    }
  ],
  gym: [
    {
      id: 'gym-basic-comfort',
      provider: 'Basic-Fit',
      planName: 'Abonnement Comfort',
      monthlyPrice: 24.99,
      commitment: 'Sans engagement',
      badge: 'Accès National',
      features: ['Accès à tous les clubs Basic-Fit', 'Application d\'entraînement', 'Cours virtuels GXR']
    }
  ],
  energy: [
    {
      id: 'nrg-total',
      provider: 'TotalEnergies',
      planName: 'Offre Heures Éco Électricité',
      monthlyPrice: 0,
      commitment: 'Sans engagement',
      badge: '-15% sur les Heures Creuses',
      features: ['Prix indexé sur le tarif réglementé', 'Suivi conso temps réel en appli', 'Résiliation gratuite sans coupure']
    }
  ],
  insurance: [
    {
      id: 'ins-luko',
      provider: 'Acheel / Luko',
      planName: 'Assurance Habitation en ligne',
      monthlyPrice: 7.90,
      commitment: 'Loi Hamon',
      badge: 'Tarif direct',
      features: ['Attestation immédiate', 'Dégât des eaux, incendie, vol', 'Gestion sur smartphone']
    }
  ],
  other: [
    {
      id: 'oth-bundle',
      provider: 'Regroupement & Box',
      planName: 'Offre Quadruple Play Optimisée',
      monthlyPrice: 29.99,
      commitment: 'Sans engagement',
      badge: 'Regroupement',
      features: ['Box Internet + Forfait Mobile', 'Facture unique simplifiée', 'Jusqu\'à 180€ d\'économies/an']
    }
  ]
};

export function detectSubscriptionCategoryType(description: string, category: string): OptimizationAnalysis['categoryType'] {
  const text = `${description} ${category}`.toLowerCase();
  
  if (text.includes('box') || text.includes('fibre') || text.includes('freebox') || text.includes('bbox') || text.includes('livebox')) {
    return 'box';
  }
  if (text.includes('mobile') || text.includes('sosh') || text.includes('bouygues') || text.includes('sfr') || text.includes('telecom') || text.includes('télécom') || text.includes('prixtel') || text.includes('salt') || text.includes('swisscom')) {
    return 'mobile';
  }
  if (text.includes('netflix') || text.includes('disney') || text.includes('prime video') || text.includes('canal') || text.includes('cinema') || text.includes('hbo') || text.includes('max')) {
    return 'streaming';
  }
  if (text.includes('spotify') || text.includes('deezer') || text.includes('apple music') || text.includes('tidal') || text.includes('music')) {
    return 'music';
  }
  if (text.includes('fit') || text.includes('gym') || text.includes('sport') || text.includes('salle') || text.includes('neoness') || text.includes('keep cool')) {
    return 'gym';
  }
  if (text.includes('edf') || text.includes('total') || text.includes('engie') || text.includes('energie') || text.includes('électricité') || text.includes('gaz')) {
    return 'energy';
  }
  if (text.includes('assurance') || text.includes('mutuelle') || text.includes('luko') || text.includes('allianz') || text.includes('macif') || text.includes('matmut') || text.includes('maif')) {
    return 'insurance';
  }
  return 'other';
}

export function analyzeAndFindCheaperTariffs(
  subscriptionName: string,
  currentPrice: number,
  category: string = 'Abonnements'
): OptimizationAnalysis {
  const categoryType = detectSubscriptionCategoryType(subscriptionName, category);
  const candidateOffers = MARKET_BENCHMARKS[categoryType] || MARKET_BENCHMARKS.box;

  const validOffers = candidateOffers.filter(o => o.monthlyPrice > 0);
  const sortedByPrice = [...validOffers].sort((a, b) => a.monthlyPrice - b.monthlyPrice);
  
  const bestAlternative = sortedByPrice[0] || {
    id: 'generic-saving',
    provider: 'Opérateur Alternatif',
    planName: 'Offre Sans Engagement Promo',
    monthlyPrice: Math.max(9.99, Math.round(currentPrice * 0.65 * 100) / 100),
    commitment: 'Sans engagement',
    badge: 'Économie 35%',
    features: ['Tarif préférentiel négocié', 'Sans frais de changement', 'Portabilité du numéro incluse']
  };

  const monthlySavings = Math.max(0, currentPrice - bestAlternative.monthlyPrice);
  const annualSavings = Math.round(monthlySavings * 12 * 100) / 100;

  const negotiationScript = `Bonjour,\n\nJe suis client chez vous pour le service "${subscriptionName}" facturé actuellement ${currentPrice.toFixed(2)} € par mois.\n\nJe constate que plusieurs offres concurrentes équivalentes (notamment chez ${bestAlternative.provider} avec l'offre "${bestAlternative.planName}") sont proposées à ${bestAlternative.monthlyPrice.toFixed(2)} € par mois, sans engagement.\n\nSouhaitant rester fidèle à vos services si les conditions tarifaires sont alignées, je souhaiterais savoir quel geste commercial ou quel réalignement tarifaire vous pouvez m'accorder sur mon contrat actuel avant que j'envisage une résiliation.\n\nDans l'attente de votre retour,\nCordialement.`;

  return {
    categoryType,
    currentPrice,
    bestAlternative,
    allAlternatives: sortedByPrice,
    annualSavings,
    monthlySavings,
    negotiationScript
  };
}

export async function askSubscriptionAiAdvisor(
  userQuestion: string,
  analysis: OptimizationAnalysis,
  subscriptionName: string
): Promise<string> {
  const apiKey = getGeminiApiKey();

  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const prompt = `Tu es le conseiller financier et expert en optimisation des abonnements de CashPilot.
Contexte du contrat client :
- Fournisseur / Libellé : ${subscriptionName}
- Coût mensuel actuel : ${analysis.currentPrice} €/mois (${(analysis.currentPrice * 12).toFixed(2)} €/an)
- Meilleure offre concurrente détectée : ${analysis.bestAlternative.provider} (${analysis.bestAlternative.planName}) à ${analysis.bestAlternative.monthlyPrice} €/mois
- Économie annuelle estimée : ${analysis.annualSavings} €/an

Question du client : "${userQuestion}"

Directives :
1. Sois très précis, concret et apporte des arguments chiffrés.
2. Explique clairement les droits du client (Loi Chatel, Loi Hamon, portabilité sans coupure, remboursement des frais de résiliation jusqu'à 100€).
3. Reste concis (3 à 5 phrases max) et percutant.`;
      const res = await model.generateContent(prompt);
      return res.response.text();
    } catch (err) {
      console.warn('Fallback to local AI advisor:', err);
    }
  }

  const q = userQuestion.toLowerCase();
  if (q.includes('frais') || q.includes('résiliation')) {
    return "En France, les nouvelles offres (Sosh, Free, RED by SFR, Bouygues) remboursent généralement jusqu'à 100€ à 150€ de vos frais de résiliation actuels. Si votre contrat a plus de 12 mois, la Loi Chatel et la Loi Hamon vous permettent de résilier sans pénalité.";
  }
  if (q.includes('négocier') || q.includes('conserver')) {
    return `Pour négocier avec ${subscriptionName} : appelez le service résiliation (et non le service client standard). Citez précisément l'offre de ${analysis.bestAlternative.provider} à ${analysis.bestAlternative.monthlyPrice}€/mois. 80% des clients obtiennent une réduction de 5€ à 15€/mois pendant 12 mois sans changer de matériel.`;
  }
  if (q.includes('gain') || q.includes('économie') || q.includes('combien')) {
    return `En basculant sur l'offre ${analysis.bestAlternative.planName} de ${analysis.bestAlternative.provider}, vous économisez exactement ${analysis.monthlySavings.toFixed(2)}€ chaque mois, soit ${analysis.annualSavings.toFixed(2)}€ d'économie nette sur 1 an et ${(analysis.annualSavings * 2).toFixed(2)}€ sur 2 ans.`;
  }

  return `Sur le marché actuel, l'offre ${analysis.bestAlternative.provider} (${analysis.bestAlternative.planName}) à ${analysis.bestAlternative.monthlyPrice}€/mois est le meilleur compromis qualité/prix par rapport à ${subscriptionName}. Vous pouvez conserver votre numéro ou vos identifiants sans coupure grâce au code RIO.`;
}

export const optimizeSubscription = async (
  request: SubscriptionOptimizationRequest
): Promise<SubscriptionOptimizationResponse> => {
  try {
    const optimizeFn = httpsCallable<SubscriptionOptimizationRequest, any>(
      functions,
      'optimizeSubscription'
    );

    const result = await optimizeFn(request);

    // Cloud functions returning standard { success: boolean, data: T }
    // Need to extract the data part as response
    if (result.data?.success) {
        return result.data.data as SubscriptionOptimizationResponse;
    }

    throw new Error('Unexpected response format from optimization function');

  } catch (error) {
    console.error('Error optimizing subscription:', error);
    throw error;
  }
};
