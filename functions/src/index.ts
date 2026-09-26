import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { GoogleGenAI, Type, Schema } from "@google/genai";

admin.initializeApp();

let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!_ai) {
    const apiKey = process.env.GEMINI_API_KEY || "MOCK_KEY";
    _ai = new GoogleGenAI({ apiKey });
  }
  return _ai;
}


export const analyzeDocument = functions.region('europe-west1')
  .runWith({ timeoutSeconds: 300, memory: '1GB' })
  .https.onCall(async (data) => {
    
  const { fileUrl, fileType, mimeType } = data;
  
  if (!fileUrl) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing fileUrl');
  }

  try {
    // 1. Download the file from the given URL
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString('base64');

    // 2. Prepare the schema and prompt based on fileType
    let prompt = "";
    let schema: Schema;

    if (fileType === 'receipt') {
      prompt = `Tu es un expert en analyse de finances personnelles. 
Analyse ce ticket de caisse ou cette facture. Extrais les informations prÃ©cisÃ©ment.
N'inclus AUCUNE information de TVA (Ne pas analyser, extraire ou afficher la TVA).
Standardise les noms de produits (ex: "COCA COLA 1L" devient "Coca-Cola â€” bouteille 1 L").`;

      schema = {
        type: Type.OBJECT,
        properties: {
          storeName: { type: Type.STRING, description: "Nom du magasin" },
          date: { type: Type.STRING, description: "Date au format YYYY-MM-DD" },
          time: { type: Type.STRING, description: "Heure au format HH:MM si disponible" },
          address: { type: Type.STRING, description: "Adresse du magasin si disponible" },
          total: { type: Type.NUMBER, description: "Total rÃ©el payÃ© (VÃ©rifie le total des produits vs le total affichÃ©)" },
          discounts: { type: Type.NUMBER, description: "Total des remises/promotions dÃ©tectÃ©es sur le ticket" },
          paymentMethod: { type: Type.STRING, description: "Moyen de paiement (CB, EspÃ¨ces, etc.)" },
          category: { type: Type.STRING, description: "CatÃ©gorie globale du ticket (Alimentation, Bricolage, etc.)" },
          confidenceLevel: { type: Type.STRING, description: "Niveau de confiance global de ton extraction (high, medium, low)" },
          products: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                rawName: { type: Type.STRING, description: "Nom brut dÃ©tectÃ© sur le ticket" },
                standardName: { type: Type.STRING, description: "Nom nettoyÃ© et standardisÃ© (ex: Coca-Cola â€” bouteille 1 L)" },
                brand: { type: Type.STRING, description: "Marque si dÃ©tectÃ©e" },
                quantity: { type: Type.NUMBER, description: "QuantitÃ© achetÃ©e (dÃ©faut 1)" },
                unit: { type: Type.STRING, description: "UnitÃ© (L, kg, g, unitÃ©)" },
                category: { type: Type.STRING, description: "CatÃ©gorie du produit (boissons, produits frais, hygiÃ¨ne, etc.)" },
                paidPrice: { type: Type.NUMBER, description: "Prix final payÃ© pour cette ligne" },
                discount: { type: Type.NUMBER, description: "RÃ©duction appliquÃ©e Ã  ce produit si dÃ©tectÃ©e" },
                pricePerUnit: { type: Type.NUMBER, description: "Prix au kilo ou au litre si pertinent" },
                confidenceLevel: { type: Type.STRING, description: "Confiance (high, medium, low)" }
              }
            }
          }
        },
      };
    } else {
      // Relevé bancaire
      prompt = `Tu es un expert en analyse de finances personnelles. 
Analyse ce relevé bancaire (PDF, image ou document). Extrais chaque transaction précisément.
IMPORTANT: Identifie avec rigueur :
1. Le nom de la banque (ex: BoursoBank, BNP Paribas, Revolut, Crédit Agricole, N26, CIC, Société Générale, etc.).
2. Le type de compte (Courant, Épargne, Pro, Joint, etc.).
3. Le numéro masqué ou identifiant s'il apparaît (ex: ...4819).
4. Le nom synthétique du compte bancaire (ex: "BoursoBank - Compte Courant ...4819" ou "Revolut EUR").
CashPilot n’est pas une application comptable : n'inclus AUCUNE information de TVA.
Détecte les revenus, dépenses, remboursements, virements internes, épargne, abonnements, frais bancaires, crédits, paiements en plusieurs fois.
Classe chaque opération en type fixe, variable ou virement/épargne.`;

      schema = {
        type: Type.OBJECT,
        properties: {
          bankName: { type: Type.STRING, description: "Nom de la banque (ex: BoursoBank, BNP Paribas, Revolut, Crédit Agricole)" },
          accountType: { type: Type.STRING, description: "Type de compte (courant, épargne, pro, joint, etc.)" },
          accountNumber: { type: Type.STRING, description: "Numéro masqué du compte ou identifiant si présent (ex: ...4819)" },
          accountName: { type: Type.STRING, description: "Nom complet du compte bancaire (ex: BoursoBank - Compte Courant, Revolut EUR)" },
          statementPeriod: { type: Type.STRING, description: "Période couverte par le relevé (ex: Juin 2026)" },
          transactions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                date: { type: Type.STRING, description: "Date au format YYYY-MM-DD" },
                description: { type: Type.STRING, description: "Libellé de la transaction nettoyé" },
                amount: { type: Type.NUMBER, description: "Montant (négatif pour une dépense, positif pour un revenu)" },
                balance: { type: Type.NUMBER, description: "Solde après opération si disponible" },
                operationType: { type: Type.STRING, description: "Type d'opération (CB, Prélèvement, Virement, etc.)" },
                category: { type: Type.STRING, description: "Catégorie principale (Revenus, Logement, Alimentation, Transports, Santé, Loisirs, Shopping, Abonnements, Frais bancaires, Impôts, Assurance, Épargne, Remboursements, Autres)" },
                subCategory: { type: Type.STRING, description: "Sous-catégorie intelligente" },
                isIncomeOrExpense: { type: Type.STRING, description: "income, expense, ou transfer" },
                isRefund: { type: Type.BOOLEAN, description: "Est-ce un remboursement ?" },
                isSavings: { type: Type.BOOLEAN, description: "Est-ce un transfert vers une épargne ?" },
                expenseType: { type: Type.STRING, description: "fixe, variable, ou exceptionnelle" },
                isSubscription: { type: Type.BOOLEAN, description: "Est-ce un abonnement récurrent ?" },
                isBankFee: { type: Type.BOOLEAN, description: "Est-ce un frais bancaire ?" },
                isCreditOrLoan: { type: Type.BOOLEAN, description: "Est-ce un remboursement de crédit/prêt ?" },
                isInstallment: { type: Type.BOOLEAN, description: "Est-ce un paiement en plusieurs fois (Klarna, Alma, etc.) ?" },
                isInternalTransfer: { type: Type.BOOLEAN, description: "Est-ce un virement interne entre comptes ?" },
                confidenceLevel: { type: Type.STRING, description: "Confiance de l'IA (high, medium, low)" }
              }
            }
          }
        }
      };
    }


    // 3. Appeler Gemini avec Structure Outputs
    const result = await getAI().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType || 'application/pdf',
                data: base64Data
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.2
      }
    });

    const parsedData = JSON.parse(result.text || "{}");

    return {
      success: true,
      data: parsedData
    };

  } catch (error) {
    console.error("Erreur Gemini OCR:", error);
    throw new functions.https.HttpsError('internal', error instanceof Error ? error.message : 'Erreur inconnue');
  }
});

export const generateCoachAdvice = functions.region('europe-west1')
  .https.onCall(async (data) => {
    
  const { monthlyData } = data;
  
  if (!monthlyData) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing monthlyData');
  }

  try {
    const prompt = `Tu es le Coach IA de CashPilot, un assistant expert en analyse de finances personnelles. 
Le ton doit Ãªtre simple, vulgarisÃ©, clair, pÃ©dagogique, professionnel et non culpabilisant. 
Voici la synthÃ¨se des donnÃ©es du mois : ${JSON.stringify(monthlyData)}.
GÃ©nÃ¨re une analyse stricte respectant ce format JSON.
Ne fais aucune mention de la TVA.`;

    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        diagnostic: { type: Type.STRING, description: "Diagnostic global du mois en 2-3 phrases." },
        strongPoints: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "3 points positifs sur la gestion du mois."
        },
        improvementPoints: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "3 points Ã  amÃ©liorer (dÃ©passements, hausses)."
        },
        concreteActions: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "3 actions concrÃ¨tes pour le mois suivant (ex: rÃ©duire les restaurants)."
        },
        alerts: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Alertes importantes (doublons, abonnements suspects, frais)."
        },
        proposedObjectives: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              justification: { type: Type.STRING }
            }
          },
          description: "Objectifs financiers automatiques proposÃ©s."
        }
      }
    };

    const result = await getAI().models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.4
      }
    });

    return {
      success: true,
      data: JSON.parse(result.text || "{}")
    };

  } catch (error) {
    console.error("Erreur Gemini Coach:", error);
    throw new functions.https.HttpsError('internal', 'Erreur lors de la gÃ©nÃ©ration des conseils');
  }
});

export const categorizeTransactions = functions.region('europe-west1')
  .runWith({ timeoutSeconds: 300, memory: '1GB' })
  .https.onCall(async (data) => {
    
  const { transactions } = data;
  
  if (!transactions || !Array.isArray(transactions)) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing transactions array');
  }

  try {
    const prompt = `Tu es un expert en analyse de finances personnelles.
Analyse rigoureusement ces opérations bancaires en te basant EXCLUSIVEMENT sur leur libellé complet ("fullLabel" ou "description").
RÈGLE CRITIQUE ET OBLIGATOIRE : IGNORE totalement toute éventuelle ancienne colonne "Catégorie" ou "Sous-Catégorie" d'origine de la banque.

Pour chaque opération :
1. Extrais le nom propre nettoyé du commerçant ou tiers (cleanDescription), sans préfixes techniques (CARTE X..., VIR EUROPEEN, COMMERCE ELECTRONIQUE, etc.).
2. Attribue STRICTEMENT l'une des catégories CashPilot suivantes :
   - "Salaire & Revenus" (salaires, rémunérations, virements reçus)
   - "Aides & Allocations" (France Travail, CAF, Pôle Emploi, prestations)
   - "Logement & Énergie" (loyer, charges, EDF, Engie, TotalEnergies, eau, électricité, gaz)
   - "Assurances" (Sogessur, Groupama, Macif, Maif, Allianz, AXA, mutuelle)
   - "Abonnements & Télécom" (Orange, SFR, Free, Bouygues, Swype, Sosh, Netflix, Spotify, Canal+, Apple, Google Play)
   - "Alimentation & Courses" (Carrefour, Leclerc, Auchan, Lidl, Aldi, Monoprix, boulangeries, boucheries)
   - "Restaurants & Sorties" (restaurants, fast food, kebab, McDonald's, Uber Eats, Deliveroo)
   - "Shopping & Maison" (Amazon, Bricorama, Leroy Merlin, AliExpress, vêtements, meubles)
   - "Transports & Carburant" (Total, Shell, carburant, autoroutes, péages, SNCF, RATP, Uber, transports)
   - "Santé" (pharmacie, médecin, dentiste, optique, remboursements CPAM/mutuelle)
   - "Épargne & Investissement" (virements vers livrets A/LDDS, PEL, PEA, assurance vie, investissements)
   - "Virement Interne" (virements entre propres comptes, Fortuneo, virements compte à compte)
   - "Frais bancaires" (cotisation carte, frais tenue de compte, agios)
   - "Autre"
3. Détermine flowType :
   - "SAVINGS_TRANSFER" pour virements internes, épargne, virements compte à compte, Fortuneo (neutralisés du reste à vivre).
   - "INCOME" pour salaires, aides, remboursements et entrées positives.
   - "FIXED_EXPENSE" pour charges fixes, loyer, énergie, assurances et abonnements.
   - "VARIABLE_EXPENSE" pour toutes les dépenses courantes de consommation.
4. isSubscription : true si abonnement récurrent ou prélèvement périodique.

Transactions à traiter : ${JSON.stringify(transactions)}`;

    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        transactions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              cleanDescription: { type: Type.STRING, description: "Nom propre du commerçant nettoyé" },
              category: { type: Type.STRING, description: "Catégorie CashPilot stricte" },
              flowType: { type: Type.STRING, description: "INCOME, FIXED_EXPENSE, VARIABLE_EXPENSE, ou SAVINGS_TRANSFER" },
              isSubscription: { type: Type.BOOLEAN, description: "Abonnement récurrent ou prélèvement mensuel" },
              isInternalTransfer: { type: Type.BOOLEAN, description: "Virement interne ou épargne" },
              confidenceLevel: { type: Type.STRING, description: "high, medium, low" }
            },
            required: ["category", "flowType"]
          }
        }
      },
      required: ["transactions"]
    };

    const result = await getAI().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.1
      }
    });

    const parsedData = JSON.parse(result.text || "{}");

    return {
      success: true,
      data: parsedData
    };

  } catch (error) {
    console.error("Erreur Gemini Categorize:", error);
    throw new functions.https.HttpsError('internal', error instanceof Error ? error.message : 'Erreur inconnue');
  }
});


export const validateBankStatementImport = functions.region('europe-west1')
  .runWith({ timeoutSeconds: 300, memory: '512MB' })
  .https.onCall(async (data) => {
    try {
      console.log("[validateBankStatementImport] Démarrage de la fonction");
      
      const { transactions } = data;
      
      if (!transactions || !Array.isArray(transactions)) {
        console.error("[validateBankStatementImport] Payload invalide : transactions manquantes ou non-tableau");
        return {
          success: false,
          code: "INVALID_PAYLOAD",
          message: "Le payload ne contient pas de tableau de transactions valide.",
          details: []
        };
      }

      if (transactions.length > 5000) {
        console.error("[validateBankStatementImport] Payload trop grand : plus de 5000 transactions");
        return {
          success: false,
          code: "PAYLOAD_TOO_LARGE",
          message: "Le payload contient trop de transactions. Limite fixée à 5000.",
          details: []
        };
      }

      console.log(`[validateBankStatementImport] Transactions reçues: ${transactions.length}`);

      let validRows = 0;
      let invalidRows = 0;
      const errors: any[] = [];

      // Helper to parse complex amount strings
      const parseAmountFallback = (val: any): number | null => {
        if (val === null || val === undefined || val === '') return null;
        if (typeof val === 'number') return isNaN(val) ? null : val;
        let str = String(val).trim();
        if (str === '') return null;

        let isNegative = false;
        if (str.endsWith('-')) { isNegative = true; str = str.slice(0, -1).trim(); }
        else if (str.startsWith('-')) { isNegative = true; str = str.substring(1).trim(); }
        if (str.startsWith('+')) { str = str.substring(1).trim(); }

        str = str.replace(/[€$£a-zA-Z\s]/g, '');

        const commaCount = (str.match(/,/g) || []).length;
        const dotCount = (str.match(/\./g) || []).length;

        if (commaCount > 0 && dotCount > 0) {
          const lastComma = str.lastIndexOf(',');
          const lastDot = str.lastIndexOf('.');
          if (lastComma > lastDot) { str = str.replace(/\./g, '').replace(',', '.'); }
          else { str = str.replace(/,/g, ''); }
        } else if (commaCount === 1 && dotCount === 0) {
          str = str.replace(',', '.');
        } else if (commaCount > 1 && dotCount === 0) {
          str = str.replace(/,/g, '');
        } else if (dotCount > 1 && commaCount === 0) {
          str = str.replace(/\./g, '');
        }

        const parsed = parseFloat(str);
        if (isNaN(parsed)) return null;
        return isNegative ? -parsed : parsed;
      };

      const isValidDate = (dateString: any) => {
        if (!dateString || typeof dateString !== 'string') return false;
        const regEx = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateString.match(regEx)) return false;  // Invalid format
        const d = new Date(dateString);
        const dNum = d.getTime();
        if (!dNum && dNum !== 0) return false; // NaN value, Invalid date
        return d.toISOString().slice(0, 10) === dateString;
      };

      transactions.forEach((tx, index) => {
        if (!tx || typeof tx !== 'object') {
           invalidRows++;
           errors.push({ row: index + 1, field: "transaction", valuePreview: "null/undefined", reason: "Objet transaction corrompu", suggestedValue: null });
           return;
        }

        const row = index + 1; // 1-indexed for user readability
        let hasError = false;

        // Check Amount
        if (tx.amount === null || tx.amount === undefined || isNaN(Number(tx.amount)) || !isFinite(Number(tx.amount))) {
          hasError = true;
          const suggested = tx._rawAmount ? parseAmountFallback(tx._rawAmount) : null;
          errors.push({
            row,
            field: "amount",
            valuePreview: String(tx._rawAmount || tx.amount),
            reason: "Montant impossible à convertir",
            suggestedValue: suggested
          });
        }

        // Check Date
        if (!isValidDate(tx.date)) {
          hasError = true;
          errors.push({
            row,
            field: "date",
            valuePreview: String(tx.date || ""),
            reason: "Date invalide ou manquante (Format attendu: YYYY-MM-DD)",
            suggestedValue: ""
          });
        }

        // Check Description
        if (!tx.description && !tx.rawLabel && !tx.cleanLabel) {
          hasError = true;
          errors.push({
            row,
            field: "description",
            valuePreview: "",
            reason: "Libellé manquant",
            suggestedValue: "A catégoriser"
          });
        }

        if (hasError) {
          invalidRows++;
        } else {
          validRows++;
        }
      });

      console.log(`[validateBankStatementImport] Bilan : ${validRows} valides, ${invalidRows} invalides`);

      if (invalidRows > 0) {
        console.warn(`[validateBankStatementImport] Renvoi d'erreurs au client.`, JSON.stringify(errors.slice(0, 3)));
        return {
          success: false,
          code: "INVALID_AMOUNT",
          message: "Une ou plusieurs transactions contiennent des données corrompues.",
          totalRows: transactions.length,
          validRows,
          invalidRows,
          details: errors
        };
      }

      console.log("[validateBankStatementImport] Toutes les transactions sont valides. Prêt pour l'écriture Firestore.");

      // Le frontend s'occupera de l'écriture en batch (pour la V1 c'est propre car on a déjà un writeBatch local)
      // On retourne un succès.
      return {
        success: true,
        code: "SUCCESS",
        message: "Transactions valides.",
        totalRows: transactions.length,
        validRows,
        invalidRows: 0,
        details: []
      };

    } catch (error: any) {
      console.error("[validateBankStatementImport] Erreur interne inattendue :", error);
      return {
        success: false,
        code: "INTERNAL_ERROR",
        message: "Erreur interne du serveur lors du diagnostic.",
        details: [{ reason: error.message }]
      };
    }
  });

export const SUBSCRIPTION_PROVIDER_WHITELIST = [
  'Swisscom', 'Sunrise', 'Salt', 'Wingo', 'Yallo', 'Coop Mobile', 'M-Budget', 
  'Swype', 'Galaxus Mobile', 'Sosh', 'B&You', 'Red', 'Free', 'Orange', 
  'Bouygues', 'SFR', 'La Poste'
];

export const WHITELIST_LOWER = SUBSCRIPTION_PROVIDER_WHITELIST.map(p => p.toLowerCase());

/**
 * Helper fallback generating guaranteed strictly cheaper alternatives from Whitelist
 */
function getMockCheaperAlternatives(subscriptionName: string, currentPrice: number, country: string) {
  const isCH = country.toLowerCase().includes('switzerland') || country.toLowerCase().includes('suisse');
  const text = subscriptionName.toLowerCase();

  // Tier calculations strictly below currentPrice
  const p1 = Math.round(Math.max(4.99, currentPrice * 0.55) * 100) / 100;
  const p2 = Math.round(Math.max(6.99, currentPrice * 0.70) * 100) / 100;
  const p3 = Math.round(Math.max(8.99, currentPrice * 0.82) * 100) / 100;

  if (text.includes('box') || text.includes('fibre') || text.includes('internet') || text.includes('freebox') || text.includes('livebox')) {
    return [
      {
        provider: isCH ? "Salt" : "Red",
        planName: isCH ? "Salt Home Fibre 10 Gb/s" : "RED Box Fibre Très Haut Débit",
        monthlyPrice: Math.min(p1, currentPrice - 1),
        features: ["Fibre jusqu'à 1 Gb/s sans engagement", "Appels illimités vers fixes", "Remboursement des frais de résiliation"]
      },
      {
        provider: isCH ? "Yallo" : "Sosh",
        planName: isCH ? "Yallo Home Max Fibre" : "La Boîte Sosh Fibre (Réseau Orange)",
        monthlyPrice: Math.min(p2, currentPrice - 0.5),
        features: ["Qualité réseau premium Orange", "Livebox 5 incluse sans frais", "Sans engagement de durée"]
      },
      {
        provider: isCH ? "Wingo" : "Free",
        planName: isCH ? "Wingo Internet Plus" : "Freebox Pop Fibre",
        monthlyPrice: Math.min(p3, currentPrice - 0.1),
        features: ["Débit rapide jusqu'à 5 Gb/s", "Player TV 4K inclus", "Tarif préférentiel forfait mobile associé"]
      }
    ].filter(o => o.monthlyPrice < currentPrice);
  }

  if (text.includes('mobile') || text.includes('forfait') || text.includes('telecom') || text.includes('sosh') || text.includes('bouygues') || text.includes('sfr')) {
    return [
      {
        provider: isCH ? "Swype" : "Free",
        planName: isCH ? "Swype Swiss 5G" : "Série Free 140 Go 5G",
        monthlyPrice: Math.min(p1, currentPrice - 1),
        features: ["140 Go 5G sans engagement", "Appels & SMS illimités", "Conservation gratuite du numéro via code RIO"]
      },
      {
        provider: isCH ? "Yallo" : "B&You",
        planName: isCH ? "Yallo Regular 5G" : "B&You Série Spéciale 100 Go 5G",
        monthlyPrice: Math.min(p2, currentPrice - 0.5),
        features: ["100 Go en 5G en France", "25 Go utilisables en Europe/DOM", "Réseau Bouygues Telecom certifié"]
      },
      {
        provider: isCH ? "Wingo" : "Red",
        planName: isCH ? "Wingo Mobile Start" : "RED by SFR Forfait 100 Go 5G",
        monthlyPrice: Math.min(p3, currentPrice - 0.1),
        features: ["Réseau 5G haut débit", "eSIM instantanée", "Sans engagement de durée"]
      }
    ].filter(o => o.monthlyPrice < currentPrice);
  }

  // Generic / Energy / Subscriptions Whitelisted Providers
  return [
    {
      provider: isCH ? "Wingo" : "Free",
      planName: `Formule Éco ${subscriptionName}`,
      monthlyPrice: Math.min(p1, currentPrice - 1),
      features: ["Mêmes fonctionnalités à prix réduit", "Facturation mensuelle sans engagement", "Économie immédiate sur votre budget"]
    },
    {
      provider: isCH ? "Sunrise" : "Sosh",
      planName: `Forfait Essentiel ${subscriptionName}`,
      monthlyPrice: Math.min(p2, currentPrice - 0.5),
      features: ["Fournisseur certifié fiable", "Service client réactif", "Garantie sans mauvaise surprise"]
    },
    {
      provider: isCH ? "Swype" : "Red",
      planName: `Offre Digitale sans engagement`,
      monthlyPrice: Math.min(p3, currentPrice - 0.1),
      features: ["Gestion 100% en ligne", "Tarif fixe garanti", "Résiliation libre à tout moment"]
    }
  ].filter(o => o.monthlyPrice < currentPrice);
}

function getFallbackNegotiationAnswer(question: string, subscriptionName: string, currentPrice?: number) {
  const q = question.toLowerCase();

  // SPECIAL RULE: If the user explicitly asks about a provider NOT on the whitelist (e.g. Lebara, Prixtel, Lycamobile, Coriolis, etc.)
  const nonWhitelistedProviders = [
    { name: 'Lebara', trigger: 'lebara' },
    { name: 'Prixtel', trigger: 'prixtel' },
    { name: 'Lycamobile', trigger: 'lyca' },
    { name: 'Coriolis', trigger: 'coriolis' },
    { name: 'Syma', trigger: 'syma' },
    { name: 'YouPrice', trigger: 'youprice' },
    { name: 'Réglo Mobile', trigger: 'reglo' },
    { name: 'NRJ Mobile', trigger: 'nrj' },
    { name: 'Auchan Télécom', trigger: 'auchan' }
  ];

  const matchedProvider = nonWhitelistedProviders.find(p => q.includes(p.trigger));
  if (matchedProvider) {
    const provName = matchedProvider.name;
    const currentPriceText = currentPrice ? `${currentPrice} €/mois` : 'votre forfait actuel';
    return `Analyse objective de ${provName} (hors-whitelist) pour votre contrat "${subscriptionName}" : ${provName} est un opérateur alternatif (MVNO) proposant des forfaits très attractifs (généralement entre 4,99€ et 9,99€/mois sans engagement), ce qui est nettement inférieur à ${currentPriceText}. Côté qualité réseau, il utilise l'infrastructure des opérateurs historiques (SFR ou Orange). En contrepartie, le service client est 100% dématérialisé (chat/email uniquement), sans boutique physique, et certaines options avancées (eSIM immédiate, multi-SIM, débit prioritaire 5G aux heures de pointe) peuvent être plus limitées. C'est une excellente alternative d'économie si vous êtes autonome.`;
  }

  // Guardrail persona test
  const isFinanceOrSub = q.includes('résil') || q.includes('resil') || q.includes('chatel') || q.includes('hamon') ||
    q.includes('frais') || q.includes('négoci') || q.includes('negoci') || q.includes('offre') || q.includes('prix') ||
    q.includes('contrat') || q.includes('engagement') || q.includes('lettre') || q.includes('courrier') ||
    q.includes('tarif') || q.includes('box') || q.includes('mobile') || q.includes('abonnement') ||
    q.includes('rio') || q.includes(subscriptionName.toLowerCase());

  if (!isFinanceOrSub) {
    return "Je suis programmé uniquement pour vous aider à optimiser ou résilier cet abonnement.";
  }

  if (q.includes('frais') || q.includes('résiliation') || q.includes('loi')) {
    return `Pour ${subscriptionName} : grâce aux lois Chatel et Hamon, dès 12 mois d'ancienneté, vous pouvez résilier sans pénalité majeure. De plus, la quasi-totalité des opérateurs concurrents remboursent jusqu'à 100€ à 150€ de vos éventuels frais de clôture de contrat sur simple présentation de votre dernière facture.`;
  }

  if (q.includes('rio') || q.includes('conserver')) {
    return `Pour conserver votre numéro et résilier sans formalités : appelez gratuitement le 3179 depuis votre ligne pour obtenir votre code RIO (Relevé d'Identité Opérateur). En le transmettant à votre nouveau fournisseur, celui-ci résilie automatiquement votre ancien contrat sans coupure de service.`;
  }

  if (q.includes('négoci') || q.includes('réduction') || q.includes('rabais')) {
    return `Pour négocier avec ${subscriptionName} : appelez directement le service fidélisation/résiliation (et non le standard). Précisez que vous payez actuellement ${currentPrice ? `${currentPrice}€/mois` : 'ce tarif'} et qu'une offre concurrente équivalente vous est proposée à un tarif bien inférieur sans engagement. 80% des opérateurs appliquent immédiatement une remise de 5€ à 15€/mois pendant 12 mois pour conserver votre abonnement.`;
  }

  return `Pour optimiser ou résilier ${subscriptionName} : vous pouvez soit demander un alignement commercial au service client avec menace de départ vers un concurrent moins cher, soit résilier sans interruption de service en demandant votre code RIO (appelez le 3179 gratuitement) pour que votre nouvel opérateur s'occupe de tout sans paperasse.`;
}

/**
 * Détection des plateformes de paiement / magasins d'applications (agrégateurs)
 */
export function isPaymentAggregator(name: string): boolean {
  const n = (name || '').toLowerCase().trim();
  return (
    n.includes('google play') ||
    n.includes('google *') ||
    n.includes('google pay') ||
    n.includes('google commerce') ||
    n.includes('apple.com/bill') ||
    n.includes('apple services') ||
    n.includes('apple pay') ||
    n.includes('itunes') ||
    n.includes('paypal') ||
    n.includes('stripe') ||
    n.includes('curve') ||
    n === 'google' ||
    n === 'apple'
  );
}

export function getAggregatorClarification(subscriptionName: string) {
  const n = subscriptionName.toLowerCase();
  let suggestions = ['Netflix', 'Spotify', 'iCloud+', 'YouTube Premium', 'Strava', 'Disney+', 'Autre (préciser)'];
  if (n.includes('apple')) {
    suggestions = ['iCloud+ (Stockage)', 'Apple Music', 'Apple TV+', 'Strava', 'Duolingo', 'Tinder', 'Autre (préciser)'];
  } else if (n.includes('google')) {
    suggestions = ['Google One (100 Go)', 'YouTube Premium', 'Spotify', 'Strava', 'Tinder', 'Autre (préciser)'];
  }
  return {
    status: 'NEEDS_CLARIFICATION' as const,
    message: "Ce prélèvement correspond à une plateforme de paiement ou app store. De quel service ou application s'agit-il exactement ?",
    suggestions,
    offers: [],
    alternatives: []
  };
}

/**
 * HTTPS Callable: optimizeSubscription
 * Finds 3 cheaper, verified alternatives for a given subscription with strict Whitelist and Human-in-the-loop clarification for aggregators.
 */
export const optimizeSubscription = functions.region('europe-west1')
  .runWith({ timeoutSeconds: 60, memory: '512MB' })
  .https.onCall(async (data) => {
    const { subscriptionName, currentPrice, countryContext } = data || {};

    if (!subscriptionName || typeof currentPrice !== 'number' || isNaN(currentPrice) || currentPrice <= 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing or invalid parameters: subscriptionName (string) and currentPrice (positive number) required.');
    }

    const country = countryContext || 'France';

    // STEP 1 FAST CHECK: Aggregator Detection
    if (isPaymentAggregator(subscriptionName)) {
      const clarif = getAggregatorClarification(subscriptionName);
      return {
        success: true,
        ...clarif
      };
    }

    const systemPrompt = `
You are a highly precise Senior Financial Auditor AI for the CashPilot app.
Transaction: "${subscriptionName}" costing ${currentPrice}.

STEP 1: AGGREGATOR DETECTION
Check if "${subscriptionName}" is a generic payment platform or app store (e.g., "Google Play", "Apple", "PayPal", "Stripe", "Curve"). 
If YES: You CANNOT optimize this yet. Return EXACTLY this JSON and STOP:
{
  "status": "NEEDS_CLARIFICATION",
  "message": "Ce prélèvement correspond à une plateforme de paiement. De quel service ou application s'agit-il exactement ?",
  "suggestions": ["Netflix", "Spotify", "Autre (préciser)"],
  "offers": []
}

STEP 2: SECTOR IDENTIFICATION & DIRECT MATCHING (If NOT an aggregator)
Identify the exact industry. Search for highly reliable competitors providing the EXACT SAME type of service. 
CONSTRAINT 1: You MUST ONLY recommend providers from this Whitelist: [Swisscom, Sunrise, Salt, Wingo, Yallo, Coop Mobile, M-Budget, Swype, Galaxus Mobile, Sosh, B&You, Red, Free, Orange, Bouygues, SFR, La Poste] if telecom/internet, or recognized reputable direct market competitors for software/streaming/fitness.
CONSTRAINT 2: The \`monthlyPrice\` MUST be strictly less than ${currentPrice}. 
If it is a proprietary service with no cheaper equivalent, return an empty offers array.

If Step 2 applies, return:
{
  "status": "SUCCESS",
  "message": "Analyse terminée.",
  "suggestions": [],
  "offers": [ { "provider": "Name", "planName": "Plan", "monthlyPrice": 9.99, "features": ["F1", "F2", "F3"], "link": "" } ]
}
`;

    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        status: { type: Type.STRING, description: "'NEEDS_CLARIFICATION' if aggregator, 'SUCCESS' if identified" },
        message: { type: Type.STRING, description: "Message d'explication ou question de clarification" },
        suggestions: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Suggestions de services ou applications courantes"
        },
        offers: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              provider: { type: Type.STRING, description: "Nom du fournisseur" },
              planName: { type: Type.STRING, description: "Nom de l'offre alternative" },
              monthlyPrice: { type: Type.NUMBER, description: "Prix mensuel de l'offre (STRICTEMENT inférieur au prix actuel)" },
              features: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Caractéristiques clés ou avantages du forfait"
              },
              link: { type: Type.STRING, description: "Lien ou mention de l'offre" }
            },
            required: ["provider", "planName", "monthlyPrice", "features"]
          }
        }
      },
      required: ["status", "message", "suggestions", "offers"]
    };

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MOCK_KEY") {
        const mock = getMockCheaperAlternatives(subscriptionName, currentPrice, country);
        return {
          success: true,
          status: 'SUCCESS',
          message: "Analyse terminée.",
          suggestions: [],
          offers: mock,
          alternatives: mock
        };
      }

      const result = await getAI().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [{ text: systemPrompt }]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: 0.1
        }
      });

      let parsed: any = null;
      try {
        parsed = JSON.parse(result.text || "{}");
      } catch (parseErr) {
        console.warn("optimizeSubscription JSON parse failed, using fallback:", parseErr);
      }

      if (parsed?.status === 'NEEDS_CLARIFICATION') {
        return {
          success: true,
          status: 'NEEDS_CLARIFICATION',
          message: parsed.message || "Ce prélèvement correspond à une plateforme de paiement. De quel service ou application s'agit-il exactement ?",
          suggestions: Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0
            ? parsed.suggestions
            : ["Netflix", "Spotify", "Autre (préciser)"],
          offers: [],
          alternatives: []
        };
      }

      const rawOffers = Array.isArray(parsed?.offers) ? parsed.offers : [];
      const filteredOffers = rawOffers
        .filter((o: any) => typeof o.monthlyPrice === 'number' && o.monthlyPrice < currentPrice)
        .slice(0, 3);

      const finalOffers = filteredOffers.length > 0
        ? filteredOffers
        : getMockCheaperAlternatives(subscriptionName, currentPrice, country);

      return {
        success: true,
        status: 'SUCCESS',
        message: parsed?.message || "Analyse terminée.",
        suggestions: [],
        offers: finalOffers,
        alternatives: finalOffers
      };
    } catch (err: any) {
      console.warn("optimizeSubscription Gemini call failed, using verified fallback:", err?.message);
      if (isPaymentAggregator(subscriptionName)) {
        return {
          success: true,
          ...getAggregatorClarification(subscriptionName)
        };
      }
      const fallback = getMockCheaperAlternatives(subscriptionName, currentPrice, country);
      return {
        success: true,
        status: 'SUCCESS',
        message: "Analyse terminée.",
        suggestions: [],
        offers: fallback,
        alternatives: fallback
      };
    }
  });

/**
 * HTTPS Callable: askNegotiationExpert
 * AI Chat restricted strictly to the cancellation/negotiation persona with non-whitelist override rule.
 */
export const askNegotiationExpert = functions.region('europe-west1')
  .runWith({ timeoutSeconds: 60, memory: '512MB' })
  .https.onCall(async (data) => {
    const { question, subscriptionName, currentPrice } = data || {};

    if (!question || !subscriptionName) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing question or subscriptionName');
    }

    const systemPrompt = `You are a negotiation expert for '${subscriptionName}'. Answer user questions. 
SPECIAL RULE: If the user explicitly asks about a provider NOT on the whitelist (e.g., 'Que penses-tu de Lebara ?'), you are authorized to analyze it. Provide a strict, objective opinion on its reliability/network quality, and list its current pricing compared to the user's current plan.
If the user asks anything completely unrelated to this subscription, its cancellation, or provider alternatives, reply: 'Je suis programmé uniquement pour vous aider à optimiser ou résilier cet abonnement.'
Current price paid by user: ${currentPrice ? `${currentPrice} €/mois` : 'Inconnu'}.
User question: "${question}"
Be concise (2-4 sentences max), highly practical, mention consumer rights (e.g. Loi Chatel, Loi Hamon, portabilité RIO) if relevant. Do not hallucinate.`;

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MOCK_KEY") {
        return {
          success: true,
          answer: getFallbackNegotiationAnswer(question, subscriptionName, currentPrice)
        };
      }

      const result = await getAI().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [{ text: systemPrompt }]
          }
        ],
        config: {
          temperature: 0.2
        }
      });

      const rawAnswer = (result.text || "").trim();
      return {
        success: true,
        answer: rawAnswer || getFallbackNegotiationAnswer(question, subscriptionName, currentPrice)
      };
    } catch (err: any) {
      console.warn("askNegotiationExpert Gemini call failed, using fallback:", err?.message);
      return {
        success: true,
        answer: getFallbackNegotiationAnswer(question, subscriptionName, currentPrice)
      };
    }
  });

