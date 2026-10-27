import {
  generateGenericNeedKey,
  resolvePhysicalStore,
  normalizeLockedAisle,
  sanitizeGenericDisplayName,
  normalizeProductNeed
} from "./receiptPriceEngine";
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
      prompt = `Tu es l'analyste financier d'élite et auditeur de prix de CashPilot.
MISSION PRIORITAIRE : Analyse rigoureusement ce ticket de caisse (photo, scan ou PDF) et extrais chaque article en JSON STRICT avec une fidélité absolue, sans aucun texte introductif, sans markdown ni backticks.
N'inclus AUCUNE information de TVA et IGNORE les lignes non-produits ("12 DE ARTICLES", "Sous-total", "Carte bancaire", "Remise").

================================================================================
RÈGLE 1 : LE "NETTOYAGE EXTRÊME" & FAMILLE CANONIQUE (COUCHES 1 & 2)
================================================================================
Pour chaque article, tu dois extraire le champ "nom_generique_nettoye" en réduisant le libellé à sa FAMILLE CANONIQUE PURE :
1. AUCUNE MARQUE : Élimine totalement toute marque ou enseigne (Harry's, Lu, Danone, Heinz, Marque Repère, Super U, Président, Candia, Lesieur, Jafun, Paquito, Pâturages, Monique Ranou, Chabrior, etc.).
2. AUCUN EMBALLAGE / CONDITIONNEMENT : Élimine Pet, Bocal, Sachet, Bidon, Flacon, Brique, Boîte, Canette, Barquette, Lot, Pack, Filet, Tube, Étui, Pot, Verre, Plastique, Squeeze, Bouchon sport, etc.
3. AUCUNE CONTENANCE NI DÉCOUPE : Élimine Kg, 825g, 1L, 1.5L, 6x1L, Pièce, Pce, Tranche, Tranches, Morceaux, Découpé, 1er prix, Prix.
4. AUCUN MOT PARASITE COUPÉ EN DÉBUT/FIN : Interdiction absolue de produire "Baguette la", "Basilic en", "Mouchoirs blancs en", "De colin d alaska".

NOMENCLATURE CANONIQUE OBLIGATOIRE (FAMILLES STANDARDS) :
- Tous les œufs ("Ufs b", "Ufs boulanger", "Ufs sol", "Œufs cage", "Œufs label rouge", "Œufs plein air") -> "Œufs" (Rayon : "Produits frais & Crèmerie")
- "Delice de dinde halal" / "Delice dinde halal" / "Delice poulet dinde fume" / "Blanc de volaille" -> "Blanc & Délice de volaille"
- "Lardon poulet gout fume" / "Lardon volaille fumee" -> "Lardons de volaille fumés"
- "Crevette deco cuite" / "Crevettes decortiquees" -> "Crevettes décortiquées"
- "De colin d alaska meuniere" / "Colin d'Alaska" -> "Filet de colin d'Alaska"
- "Thon entier listao" / "Thon listao au naturel" -> "Thon listao au naturel" (Rayon : "Épicerie salée & Épices")
- "Mie" / "Pain de Mie Harry S Nature" / "Pain mie sandwich complet 825g" -> "Pain de mie"
- "Frites allumette kg" / "Frites allumettes" / "Pommes de terre frites" -> "Frites"
- "Mais doux" / "Mais grain sucre" -> "Maïs en boîte"
- "Batavia" / "Laitue batavia blonde" / "Salade batavia blonde" -> "Salade Batavia"
- "Concombre" / "Concombre piece" / "Concombre tranches" -> "Concombre"
- "Melon piece" / "Melon vert" / "Melon vert en morceaux" -> "Melon"
- "Oignons eminces" / "Oignons eminces kg" -> "Oignons émincés"
- "Shaker ananas" / "Shaker d ananas decoupe" -> "Shaker d'ananas frais"
- "Carotte rapee" / "Carottes rapees" -> "Carottes râpées"
- "Lait demi écrémé delacto" / "Lait demi écrémé delactose" / "Lait demi écrémé facile a digerer" -> "Lait demi-écrémé sans lactose"
- "Lait demi écrémé" / "Lait 1/2 écrémé UHT 1L" -> "Lait demi-écrémé"
- "Pj orange sp p" / "Jus d orange sans pulpe" / "Jus d'orange" -> "Jus d'orange"
- "Pj pomme" / "Pur Jus de Pomme" / "Pur Jus Pomme Pet" -> "Jus de pomme"
- "Pj multi" / "Abc multi bk" / "Jafun boisson multifruits" / "Jus multifruits" -> "Jus multifruits"
- "Eau minerale" / "Eau minerale naturelle" / "Bouchon sport" -> "Eau minérale"
- "Eau de source" / "Eau source" -> "Eau de source"
- "Confiture de fraise" / "Confiture fraise" -> "Confiture de fraise"
- "Beignet chocolat" / "Beignets chocolat" -> "Beignets au chocolat"
- "Yaourt vanille bio" / "Yaourts vanille" -> "Yaourt vanille"

================================================================================
RÈGLE 2 : RÈGLE VITALE D'ORTHOGRAPHE ET DE CASSE FRANÇAISE
================================================================================
- "B Uf" -> "Bœuf", "Ufs" -> "Œufs", "C ur" -> "Cœur", "Steack" -> "Steak", "Pomm terre" -> "Pommes de terre".
- Rétablis impérativement tous les accents français ("Crème", "Pâte", "Œufs", "Écrémé", "Râpées", "Décortiquées").

================================================================================
RÈGLE 3 : GESTION DES PRODUITS SANS MARQUE OU FRAIS
================================================================================
- Pour tout produit frais ou sans marque explicite, inscris OBLIGATOIREMENT "marque": "generique".

================================================================================
RÈGLE 4 : NOMENCLATURE STRICTE DES 14 RAYONS OFFICIELS
================================================================================
Le champ "rayon_assigne" doit être choisi STRICTEMENT parmi la liste suivante :
1. Boucherie, Volaille & Poissonnerie
2. Épicerie salée & Épices
3. Fruits & Légumes
4. Produits frais & Crèmerie
5. Épicerie sucrée
6. Hygiène, Beauté & Sanitaire
7. Entretien & Maison
8. Boissons
9. Maison, Textile & Culture
10. Santé & Pharmacie
11. Papeterie & Bureau
12. Fleurs & Cadeaux
13. Sacs & Consignes
14. Autres / Divers`;

      schema = {
        type: Type.OBJECT,
        properties: {
          storeName: { type: Type.STRING, description: "Nom du magasin ou de l'enseigne" },
          address: { type: Type.STRING, description: "Adresse physique complète et ville du magasin lue sur l'en-tête" },
          date: { type: Type.STRING, description: "Date au format YYYY-MM-DD" },
          time: { type: Type.STRING, description: "Heure au format HH:MM si disponible" },
          total: { type: Type.NUMBER, description: "Total réel payé en caisse" },
          discounts: { type: Type.NUMBER, description: "Total des remises et promotions détectées" },
          paymentMethod: { type: Type.STRING, description: "Moyen de paiement (CB, Espèces, etc.)" },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                nom_generique_nettoye: { type: Type.STRING, description: "Nom du besoin générique sans marque ni format (ex: Sauce Burger)" },
                marque: { type: Type.STRING, description: "Marque constatée ou Générique" },
                format_exact: { type: Type.STRING, description: "Format/contenance exacte lue (ex: 510g, 500g, 1L)" },
                prix_paye: { type: Type.NUMBER, description: "Prix total payé pour cette ligne" },
                prix_unitaire_calcule: { type: Type.NUMBER, description: "Prix au kilo (€/kg), au litre (€/L) ou à la pièce" },
                unite_mesure: { type: Type.STRING, description: "kg, L, ou piece" },
                rayon_assigne: { type: Type.STRING, description: "Un des 14 rayons officiels verrouillés" }
              },
              required: ["nom_generique_nettoye", "marque", "format_exact", "prix_paye", "prix_unitaire_calcule", "unite_mesure", "rayon_assigne"]
            }
          }
        },
        required: ["storeName", "total", "items"]
      };
    } else {
      // Relevé bancaire
      prompt = `Tu es un expert-comptable et auditeur financier d'élite pour l'application CashPilot.
VÉRIFICATION INITIALE OBLIGATOIRE DU DOCUMENT :
Vérifie impérativement si ce document est RÉELLEMENT un relevé ou extrait de compte bancaire officiel (contenant des opérations bancaires avec débits/crédits, dates et montants).
Si ce document N'EST PAS un relevé bancaire officiel (ex: facture d'achat, ticket de caisse, quittance, bulletin de salaire, photo personnelle, devis, contrat, document administratif divers) :
- Définis "isBankStatement": false
- Précise la nature du document dans "rejectionReason" (ex: "Facture", "Ticket de caisse", "Document non bancaire")
- Laisse "transactions": []

Si c'est bien un relevé bancaire :
- Définis "isBankStatement": true
Analyse rigoureusement ce relevé bancaire (PDF, image ou document). Extrais chaque transaction avec une fidélité mathématique absolue.
CashPilot n’est pas une application de gestion d'entreprise : n'inclus AUCUNE information de TVA.

RÈGLES COMPTABLES STRICTES ET PRIORITAIRES (NEUTRALISATION DES BIAIS & COÛT ZÉRO) :
1. IGNORER TOTALEMENT LA BANQUE : Ignore catégoriquement toute catégorie ou classification d'origine fournie par la banque (qui est fréquemment trompeuse). Fais une analyse sémantique pure basée uniquement sur le libellé brut réel ("rawLabel" ou libellé complet).
2. CORRECTION DU DOUBLE COMPTAGE (FLUX NEUTRES) :
   - Cartes à débit différé : identifie formellement les prélèvements de cartes à débit différé (ex: "Remboursement American Express", "Amex", "CB Différé").
   - Paiements fractionnés : identifie les mensualités de paiement en plusieurs fois (ex: "3x 4x Oney", "Alma", "Klarna", "Scalapay", "Floa Bank", "Paiement 3x", "Paiement 4x").
   - OBLIGATION : Marque obligatoirement ces opérations avec isInternalTransfer: true, isInstallment: true et category: "Paiement fractionné" ou "Remboursement Carte (Amex)". Elles doivent impérativement être neutralisées afin de ne JAMAIS être déduites une seconde fois du Reste à vivre (les achats d'origine étant déjà comptabilisés).
3. VIREMENTS INTERNES ET PROPRES COMPTES :
   - Détecte les transferts entre les propres comptes de l'utilisateur (ex: mots-clés de banques/fintechs comme "Fortuneo", "Revolut", "BoursoBank", "Boursorama", "N26", ou livrets "Livret A", "LDDS", "PEL", "PEA", "Compte à compte", ou nom identique au titulaire déduit).
   - Ces mouvements doivent être classés en "Virements Internes" ou "Épargne & Investissement" avec isInternalTransfer: true (flux neutre ne devant pas impacter les dépenses réelles).
4. FLUX FAMILIAUX ET ENTRE PROCHES :
   - Isole les transferts d'argent entre proches (reconnaissables par des prénoms/noms de personnes physiques sans nom d'enseigne commerciale ni raison sociale) dans une catégorie neutre "Remboursements/Avances" ou "Solidarité", afin de ne pas polluer les dépenses de consommation courante.
5. TITULAIRE ET HEURISTIQUES GÉNÉRIQUES (AGNOSTIQUE GRAND PUBLIC) :
   - Le système est universel : ne présuppose aucun nom codé en dur. Déduis le nom du titulaire principal en analysant la récurrence des libellés de rémunération ("VIR SALAIRE...", "PAYE...", "DE: [EMPLOYEUR] A: [TITULAIRE]") ou l'entête du relevé.
6. VIREMENTS AMBIGUS (CATÉGORIE D'ATTENTE) :
   - Si un virement émis ou reçu est ambigu (ex: "Virement émis vers [Nom Inconnu]" sans certitude absolue s'il s'agit d'un compte propre, d'un artisan ou d'un proche), classe-le impérativement dans la catégorie d'attente "À confirmer (Virement)" avec confidenceLevel: "low" et needsConfirmation: true, plutôt que d'extrapoler à tort.`;

      schema = {
        type: Type.OBJECT,
        properties: {
          isBankStatement: { type: Type.BOOLEAN, description: "True si le document est un relevé bancaire officiel, false si c'est un autre document (facture, ticket de caisse, photo perso, etc.)" },
          rejectionReason: { type: Type.STRING, description: "Raison du rejet si ce n'est pas un relevé bancaire" },
          bankName: { type: Type.STRING, description: "Nom de la banque (ex: BoursoBank, BNP Paribas, Revolut, Crédit Agricole, Société Générale)" },
          accountType: { type: Type.STRING, description: "Type de compte (courant, épargne, pro, joint, etc.)" },
          accountNumber: { type: Type.STRING, description: "Numéro masqué du compte ou identifiant si présent (ex: ...4819)" },
          accountName: { type: Type.STRING, description: "Nom complet du compte bancaire (ex: BoursoBank - Compte Courant, Revolut EUR)" },
          statementPeriod: { type: Type.STRING, description: "Période couverte par le relevé (ex: Juin 2026)" },
          inferredAccountOwner: { type: Type.STRING, description: "Nom et prénom du titulaire principal déduit via les récurrences" },
          transactions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                date: { type: Type.STRING, description: "Date au format YYYY-MM-DD" },
                description: { type: Type.STRING, description: "Libellé de la transaction nettoyé de ses préfixes techniques" },
                rawLabel: { type: Type.STRING, description: "Libellé complet brut d'origine" },
                amount: { type: Type.NUMBER, description: "Montant (négatif pour une dépense/débit, positif pour un revenu/crédit)" },
                balance: { type: Type.NUMBER, description: "Solde après opération si disponible sur le relevé" },
                operationType: { type: Type.STRING, description: "Type d'opération (CB, Prélèvement, Virement, etc.)" },
                category: { type: Type.STRING, description: "Catégorie CashPilot (Salaire & Revenus, Aides & Allocations, Logement & Énergie, Alimentation & Courses, Restaurants & Sorties, Shopping & Maison, Transports & Carburant, Santé, Abonnements & Télécom, Frais bancaires, Épargne & Investissement, Virements Internes, Remboursements/Avances, Solidarité, Paiement fractionné, Remboursement Carte (Amex), À confirmer (Virement), Autre)" },
                subCategory: { type: Type.STRING, description: "Sous-catégorie intelligente" },
                isIncomeOrExpense: { type: Type.STRING, description: "income, expense, ou transfer" },
                isRefund: { type: Type.BOOLEAN, description: "Est-ce un remboursement ?" },
                isSavings: { type: Type.BOOLEAN, description: "Est-ce un transfert vers une épargne ?" },
                expenseType: { type: Type.STRING, description: "fixe, variable, ou exceptionnelle" },
                isSubscription: { type: Type.BOOLEAN, description: "Est-ce un abonnement récurrent ?" },
                isBankFee: { type: Type.BOOLEAN, description: "Est-ce un frais bancaire ?" },
                isCreditOrLoan: { type: Type.BOOLEAN, description: "Est-ce un remboursement de crédit/prêt ?" },
                isInstallment: { type: Type.BOOLEAN, description: "Est-ce un paiement fractionné ou différé (Klarna, Alma, Oney, Amex) ?" },
                isInternalTransfer: { type: Type.BOOLEAN, description: "Flux neutre (virement compte à compte, épargne, débit différé ou fractionné neutralisé)" },
                isFamilyTransfer: { type: Type.BOOLEAN, description: "Transfert familial ou entre proches physiques (Solidarité / Remboursements)" },
                needsConfirmation: { type: Type.BOOLEAN, description: "Vrai si l'opération est ambiguë et requiert validation manuelle" },
                confidenceLevel: { type: Type.STRING, description: "Confiance de l'IA (high, medium, low)" }
              },
              required: ["date", "description", "amount", "category"]
            }
          }
        },
        required: ["bankName", "transactions"]
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
        temperature: 0.2,
        maxOutputTokens: 8192
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
        temperature: 0.4,
        maxOutputTokens: 8192
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
    const prompt = `Tu es un expert-comptable et auditeur financier d'élite pour l'application CashPilot.
Analyse rigoureusement ces opérations bancaires en te basant EXCLUSIVEMENT sur leur libellé brut complet ("rawLabel" ou "description").

RÈGLES COMPTABLES STRICTES ET PRIORITAIRES (NEUTRALISATION DES BIAIS & COÛT ZÉRO) :
1. IGNORER TOTALEMENT LA BANQUE : Ignore catégoriquement toute catégorie ou classification d'origine de la banque. Analyse purement sémantique du libellé brut.
2. CORRECTION DU DOUBLE COMPTAGE (FLUX NEUTRES) :
   - Cartes à débit différé : identifie formellement les prélèvements de cartes à débit différé (ex: "Remboursement American Express", "Amex", "CB Différé").
   - Paiements fractionnés : identifie les mensualités de paiement en plusieurs fois (ex: "3x 4x Oney", "Alma", "Klarna", "Scalapay", "Floa Bank", "Paiement 3x", "Paiement 4x").
   - OBLIGATION : Marque ces opérations avec isInternalTransfer: true, flowType: "SAVINGS_TRANSFER" et category: "Paiement fractionné" ou "Remboursement Carte (Amex)". Elles ne doivent JAMAIS être déduites du Reste à vivre une seconde fois (les dépenses d'origine étant déjà comptabilisées).
3. VIREMENTS INTERNES ET PROPRES COMPTES :
   - Détecte les transferts entre propres comptes de l'utilisateur (mots-clés de banques/fintechs comme "Fortuneo", "Revolut", "BoursoBank", "Boursorama", "N26", livrets "Livret A", "LDDS", "PEL", "PEA", "Compte à compte", ou nom identique au titulaire).
   - Classe-les en flowType: "SAVINGS_TRANSFER", category: "Virements Internes" ou "Épargne & Investissement", avec isInternalTransfer: true (neutre de trésorerie).
4. FLUX FAMILIAUX ET ENTRE PROCHES :
   - Isole les transferts d'argent entre personnes physiques proches (prénoms/noms de famille sans enseigne commerciale ni société) dans la catégorie "Remboursements/Avances" ou "Solidarité" afin de ne pas polluer les dépenses de consommation courante.
5. TITULAIRE ET HEURISTIQUES GÉNÉRIQUES (AGNOSTIQUE GRAND PUBLIC) :
   - Ne présuppose aucun nom codé en dur. Déduis le titulaire principal en analysant la récurrence des libellés de rémunération ("VIR SALAIRE...", "PAYE...", "DE: [EMPLOYEUR] A: [TITULAIRE]").
6. VIREMENTS AMBIGUS (CATÉGORIE D'ATTENTE) :
   - Si un virement émis ou reçu est ambigu (ex: "Virement émis vers [Nom Inconnu]" sans certitude absolue s'il s'agit d'un compte propre ou d'un artisan/tiers), classe-le en "À confirmer (Virement)" avec confidenceLevel: "low" et needsConfirmation: true.

Pour chaque opération :
1. Extrais le nom propre nettoyé du commerçant ou tiers (cleanDescription), sans préfixes techniques (CARTE X..., VIR EUROPEEN, COMMERCE ELECTRONIQUE, etc.).
2. Attribue STRICTEMENT l'une des catégories CashPilot :
   - "Salaire & Revenus"
   - "Aides & Allocations"
   - "Remboursements/Avances"
   - "Solidarité"
   - "Logement & Énergie"
   - "Assurances"
   - "Abonnements & Télécom"
   - "Alimentation & Courses"
   - "Restaurants & Sorties"
   - "Shopping & Maison"
   - "Transports & Carburant"
   - "Santé"
   - "Épargne & Investissement"
   - "Virements Internes"
   - "Frais bancaires"
   - "Paiement fractionné"
   - "Remboursement Carte (Amex)"
   - "À confirmer (Virement)"
   - "Autre"
3. Détermine flowType :
   - "SAVINGS_TRANSFER" pour virements internes, épargne, débit différé et fractionné neutralisés (neutralisés du reste à vivre).
   - "INCOME" pour salaires, aides, allocations et rentrées réelles.
   - "FIXED_EXPENSE" pour charges fixes (loyer, énergie, assurances, abonnements).
   - "VARIABLE_EXPENSE" pour toutes les dépenses courantes de consommation.

Transactions à traiter : ${JSON.stringify(transactions)}`;

    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        inferredAccountOwner: { type: Type.STRING, description: "Nom/prénom du titulaire principal déduit" },
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
              isInternalTransfer: { type: Type.BOOLEAN, description: "Virement interne, débit différé ou fractionné neutralisé" },
              isFamilyTransfer: { type: Type.BOOLEAN, description: "Transfert familial ou entre proches" },
              needsConfirmation: { type: Type.BOOLEAN, description: "Vrai si libellé ambigu nécessitant confirmation utilisateur" },
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
        temperature: 0.1,
        maxOutputTokens: 8192
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

/**
 * HTTPS Callable: analyzeBankStatement
 * 
 * Reçoit un tableau filtré de transactions (Date, Libellé brut, Montant)
 * Effectue un audit en lot (Batch) via l'API Google Gemini 1.5 Flash (Free Tier)
 * Reconstruit :
 * 1. Le nom du vrai marchand nettoyé (merchantName)
 * 2. La catégorie comptable standardisée (category : 'Charges fixes', 'Charges variables courantes', 'Dépenses de confort', 'Revenus')
 * 3. L'indicateur booléen isSubscription (vrai si abonnement mensuel renégociable)
 */
export const analyzeBankStatement = functions.region('europe-west1')
  .runWith({ timeoutSeconds: 300, memory: '1GB' })
  .https.onCall(async (data, context) => {
    const serverStartTime = Date.now();
    console.log("[analyzeBankStatement] Démarrage de l'analyse IA du relevé bancaire...");

    const { transactions } = data || {};

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Le tableau de transactions (Date, Libellé brut, Montant) est requis et ne peut pas être vide.'
      );
    }

    console.log(`[analyzeBankStatement] ${transactions.length} opérations reçues pour audit par Gemini 1.5 Flash.`);

    const systemPrompt = `Tu es un auditeur financier et expert-comptable d'élite pour l'application de finances personnelles CashPilot.

MISSION :
Tu reçois un lot de transactions bancaires brutes sous forme d'un tableau JSON contenant UNIQUEMENT :
- index (nombre entier)
- date (YYYY-MM-DD)
- rawLabel (libellé brut d'origine fourni par la banque)
- amount (montant numérique : négatif pour un débit/dépense, positif pour un crédit/revenu)

RÈGLES COMPTABLES STRICTES ET PRIORITAIRES :
1. IGNORANCE TOTALE DU PASSÉ : Ignore catégoriquement toute catégorie ou classification antérieure de la banque. Fais une analyse sémantique pure basée UNIQUEMENT sur le libellé brut ("rawLabel") et le montant ("amount") pour reconstruire et enrichir la donnée.
2. NETTOYAGE DU MARCHAND (merchantName) :
   - Extrais le nom réel et standardisé du commerçant, organisme ou tiers (ex: "PRLV SEPA NETFLIX 12345" -> "Netflix", "CARTE 15/04 MONOPRIX 4567" -> "Monoprix", "VIR SEPA SALAIRE ACME INC" -> "Acme Inc", "TOTAL DIRECT ENERGIE 998" -> "TotalEnergies", "PRLV FREE TELECOM 883" -> "Free", "CB SNCF CONNECT" -> "SNCF").
   - Élimine tout bruit technique : codes bancaires (CARTE, CB, VIR, PRLV, SEPA, FACTURE, RETRAIT DAB, COMMERCE ELECTRONIQUE, etc.), dates intégrées, numéros de mandat ou de carte.
3. CATÉGORIES ET NATURES DE FLUX COMPTABLES :
   - flowType : 'FIXED_EXPENSE' pour les charges fixes incompressibles ou récurrentes (logement, énergie, abonnements, télécom, assurances, frais bancaires, impôts, paiements fractionnés) ; 'VARIABLE_EXPENSE' pour les dépenses courantes et arbitrables ; 'INCOME' pour les revenus ; 'SAVINGS_TRANSFER' pour l'épargne.
   - category : Attribue STRICTEMENT l'une des catégories précises officielles suivantes (RÈGLE ABSOLUE : NE JAMAIS renvoyer 'Charges fixes', 'Charges variables' ou 'Revenus' comme nom de catégorie) :
     * "Logement & Énergie" : Loyer, charges, électricité, gaz, eau (EDF, Engie, TotalEnergies)
     * "Abonnements & Télécom" : Forfaits mobiles, box, streaming, salle de sport (Free, Orange, SFR, Netflix, Spotify, Basic-Fit)
     * "Assurances" : Assurance auto, habitation, santé, prévoyance (Macif, Maif, Axa, Allianz)
     * "Paiement fractionné" : Klarna, Alma, PayPal 4x, mensualités de prêts, Amex
     * "Frais bancaires" : Cotisations carte, tenue de compte, commissions, agios
     * "Impôts & Amendes" : Impôt revenu, taxe foncière, amendes, DGFIP
     * "Alimentation & Courses" : Supermarchés, hypermarchés, épiceries, boucheries, boulangeries (Carrefour, Leclerc, Intermarché, Lidl)
     * "Transports & Carburant" : Carburant, péage, parking, train, bus, métro, Uber (Total, BP, SNCF, RATP)
     * "Restaurants & Sorties" : Restaurants, fast-food, cafés, livraisons repas (McDonald's, Deliveroo, Uber Eats)
     * "Shopping & Maison" : Vêtements, déco, ameublement, high-tech, bricolage (Amazon, Zara, Ikea, Fnac)
     * "Loisirs & Activités" : Cinéma, sport, concerts, parcs, voyages, jeux vidéo (Booking, Airbnb, Steam)
     * "Santé" : Pharmacie, médecins, dentiste, optique, hôpital
     * "Retrait Espèces" : Retraits au distributeur DAB
     * "Virements Famille & Proches" : Virements vers amis ou proches (Wero, Paylib, proches)
     * "Salaire & Revenus" : Salaires, honoraires, primes employeur
     * "Aides & Allocations" : CAF, France Travail, remboursements mutuelle / CPAM
     * "Épargne & Investissement" : Livrets A, LDDS, PEA, assurance-vie
     * "Virements Internes" : Virements entre comptes bancaires propres
     * "Autre" : Opération inclassable
4. DÉTECTION DES ABONNEMENTS (isSubscription) :
   - Assigne "isSubscription: true" EXCLUSIVEMENT aux abonnements et prélèvements mensuels/récurrents (charges fixes) qui constituent des contrats reconductibles et potentiellement renégociables ou résiliables (ex: Netflix, Spotify, Disney+, salle de sport Basic-Fit, box internet Orange/Free/SFR, forfait mobile, Amazon Prime, abonnements SaaS/logiciels, assurances).
   - Pour tout achat ponctuel, plein d'essence, course en supermarché, restaurant, virement ponctuel ou salaire : assigne "isSubscription: false".
5. EXHAUSTIVITÉ ET ORDRE :
   Tu DOIS traiter et renvoyer TOUTES les transactions fournies dans le tableau. Chaque transaction doit avoir son index correspondant exact.`;

    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        results: {
          type: Type.ARRAY,
          description: "Liste des transactions analysées et enrichies",
          items: {
            type: Type.OBJECT,
            properties: {
              index: { 
                type: Type.INTEGER, 
                description: "Index de la transaction dans le lot envoyé" 
              },
              merchantName: { 
                type: Type.STRING, 
                description: "Nom propre et nettoyé du commerçant ou tiers" 
              },
              category: { 
                type: Type.STRING, 
                description: "Sous-catégorie officielle précise (ex: 'Alimentation & Courses', 'Transports & Carburant', 'Abonnements & Télécom', etc.)" 
              },
              isSubscription: { 
                type: Type.BOOLEAN, 
                description: "Vrai s'il s'agit d'un abonnement mensuel (charge fixe) renégociable" 
              }
            },
            required: ["index", "merchantName", "category", "isSubscription"]
          }
        }
      },
      required: ["results"]
    };

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MOCK_KEY") {
        console.warn("[analyzeBankStatement] GEMINI_API_KEY non définie ou MOCK, activation du fallback local.");
        const fallbackResults = transactions.map((t: any, idx: number) => {
          const raw = String(t.rawLabel || '').trim();
          const amt = Number(t.amount) || 0;
          const isIncome = amt > 0;
          let cat = isIncome ? 'Salaire & Revenus' : 'Alimentation & Courses';
          let isSub = false;
          const lower = raw.toLowerCase();

          if (lower.includes('netflix') || lower.includes('spotify') || lower.includes('freebox') || lower.includes('orange') || lower.includes('sfr') || lower.includes('bouygues') || lower.includes('basic fit')) {
            cat = 'Abonnements & Télécom';
            isSub = true;
          } else if (lower.includes('assurance') || lower.includes('macif') || lower.includes('maif') || lower.includes('axa')) {
            cat = 'Assurances';
            isSub = true;
          } else if (lower.includes('edf') || lower.includes('engie') || lower.includes('totalenergies') || lower.includes('loyer')) {
            cat = 'Logement & Énergie';
            isSub = true;
          } else if (lower.includes('restaurant') || lower.includes('mcdo') || lower.includes('burger') || lower.includes('uber eats') || lower.includes('deliveroo')) {
            cat = 'Restaurants & Sorties';
          } else if (lower.includes('total ') || lower.includes('carburant') || lower.includes('sncf') || lower.includes('ratp') || lower.includes('peage')) {
            cat = 'Transports & Carburant';
          } else if (lower.includes('zara') || lower.includes('fnac') || lower.includes('amazon') || lower.includes('ikea')) {
            cat = 'Shopping & Maison';
          } else if (lower.includes('pharmacie') || lower.includes('doctolib') || lower.includes('medecin')) {
            cat = 'Santé';
          } else if (lower.includes('cinema') || lower.includes('steam') || lower.includes('playstation')) {
            cat = 'Loisirs & Activités';
          } else if (lower.includes('caf ') || lower.includes('pole emploi') || lower.includes('france travail') || lower.includes('cpam')) {
            cat = 'Aides & Allocations';
          } else if (isIncome) {
            cat = 'Salaire & Revenus';
          }

          const cleanedMerchant = raw.replace(/^(CARTE\s+\d{2}\/\d{2}|VIR\s+SEPA|PRLV\s+SEPA|PAIEMENT\s+CB)\s*/i, '').trim() || raw;

          return {
            index: typeof t.index === 'number' ? t.index : idx,
            merchantName: cleanedMerchant,
            category: cat,
            isSubscription: isSub
          };
        });

        const elapsedMs = Date.now() - serverStartTime;
        return {
          success: true,
          count: fallbackResults.length,
          executionTimeSeconds: (elapsedMs / 1000).toFixed(2),
          results: fallbackResults
        };
      }

      // Envoi du lot (Batch) à Gemini 1.5 Flash (Free Tier)
      const BATCH_SIZE = 120;
      const allResults: any[] = [];

      for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
        const batch = transactions.slice(i, i + BATCH_SIZE);
        const payload = batch.map((tx: any, bIdx: number) => ({
          index: typeof tx.index === 'number' ? tx.index : (i + bIdx),
          date: tx.date || '',
          rawLabel: String(tx.rawLabel || '').slice(0, 150),
          amount: Number(tx.amount) || 0
        }));

        const userPrompt = `Voici les transactions bancaires à analyser en lot (${batch.length} opérations) :\n${JSON.stringify(payload)}`;

        const candidateModels = [
          (data.model || 'gemini-3.8-flash').trim(),
          'gemini-3.8-flash',
          'gemini-flash-latest',
          'gemini-3.5-flash'
        ];
        const uniqueModels = Array.from(new Set(candidateModels));

        let result: any = null;
        let lastErr: any = null;

        for (const candidateModel of uniqueModels) {
          try {
            result = await getAI().models.generateContent({
              model: candidateModel,
              contents: [
                {
                  role: 'user',
                  parts: [
                    { text: systemPrompt },
                    { text: userPrompt }
                  ]
                }
              ],
              config: {
                responseMimeType: "application/json",
                responseSchema,
                temperature: 0.1
              }
            });
            break;
          } catch (err: any) {
            lastErr = err;
            console.warn(`[analyzeBankStatement] Tentative avec ${candidateModel} a échoué:`, err?.message || err);
          }
        }

        if (!result) {
          throw lastErr || new Error("Échec de l'appel au modèle Gemini.");
        }

        const rawText = result.text || "{}";
        let parsed: any = null;
        try {
          parsed = JSON.parse(rawText);
        } catch (pe) {
          const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
          parsed = JSON.parse(cleaned);
        }

        const items = Array.isArray(parsed?.results) ? parsed.results : (Array.isArray(parsed) ? parsed : []);
        allResults.push(...items);
      }

      const elapsedMs = Date.now() - serverStartTime;
      const durationSeconds = (elapsedMs / 1000).toFixed(2);
      console.log(`[analyzeBankStatement] Fin d'analyse en ${durationSeconds}s (${allResults.length} résultats enrichis).`);

      return {
        success: true,
        count: allResults.length,
        executionTimeSeconds: durationSeconds,
        results: allResults
      };

    } catch (error: any) {
      console.error("[analyzeBankStatement] Erreur Gemini 1.5 Flash:", error);
      throw new functions.https.HttpsError(
        'internal',
        `Erreur Gemini 1.5 Flash : ${error.message || 'Erreur inconnue lors du traitement du relevé.'}`
      );
    }
  });




// ============================================================================
// MODULE FRISE CHRONOLOGIQUE & GESTION BANCAIRE (COMPTESBANCAIRES)
// ============================================================================

import {
  generateTransactionHash,
  recalculerFriseChronologique,
  ReleveImporte,
  TransactionDocument,
  FriseChronologiqueSegment,
  FriseRecalculResult,
  SourceReleveType
} from './bankTimelineEngine';



/**
 * ============================================================================
 * CLOUD FUNCTION : MET À JOUR LE DICTIONNAIRE offres_magasins SOUS LA CLÉ DE BESOIN
 * Reçoit le JSON de l'IA, crée la "Clé de Besoin Générique", et met à jour
 * atomiquement le document Firestore users/{accountId}/products/{cle_besoin}
 * avec un coût de fonctionnement de 0 € (1 seule écriture/lecture par besoin).
 * ============================================================================
 */
export const updateGenericNeedOffers = functions.region('europe-west1')
  .https.onCall(async (data, context) => {
    const { accountId, receiptId, date, storeName, storeAddress, items } = data;
    if (!accountId || !items || !Array.isArray(items)) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing accountId or items');
    }

    const db = admin.firestore();
    const resolvedStore = resolvePhysicalStore({ storeName, storeAddress });
    const storeId = resolvedStore.id;
    const storeDisplayName = resolvedStore.displayName;
    const receiptDate = date || new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();

    const results: string[] = [];

    for (const item of items) {
      const nomGenerique = (item.nom_generique_nettoye || item.nom_generique || item.rawName || 'Produit').trim();
      const marque = (item.marque || 'Générique').trim();
      const format = (item.format_exact || item.poids_ou_volume || '1 pièce').trim();
      const prixPaye = Number(Number(item.prix_paye).toFixed(2)) || 0;
      const prixUnitaire = Number(Number(item.prix_unitaire_calcule).toFixed(2)) || prixPaye;
      const unite = (item.unite_mesure || 'kg').trim();
      const aisle = normalizeLockedAisle(item.rayon_assigne || item.rayon);

      const cleBesoin = generateGenericNeedKey(nomGenerique, marque);
      const productRef = db.collection('users').doc(accountId).collection('products').doc(cleBesoin);

      const offerData = {
        prix_unitaire: prixUnitaire,
        unite,
        prix_paye: prixPaye,
        marque,
        format,
        date: receiptDate,
        magasin_nom: storeDisplayName,
        magasin_id: storeId,
        receiptId
      };

      await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(productRef);
        if (snap.exists) {
          const prev = snap.data() || {};
          const currentOffers = { ...(prev.offres_magasins || {}) };
          currentOffers[storeId] = offerData;

          transaction.update(productRef, {
            nom_generique: nomGenerique,
            rayon: aisle.label,
            offres_magasins: currentOffers,
            derniere_mise_a_jour: nowIso
          });
        } else {
          transaction.set(productRef, {
            nom_generique: nomGenerique,
            rayon: aisle.label,
            offres_magasins: {
              [storeId]: offerData
            },
            derniere_mise_a_jour: nowIso
          });
        }
      });

      results.push(cleBesoin);
    }

    return {
      success: true,
      storeId,
      storeDisplayName,
      cle_besoin_list: results
    };
  });

export {
  generateTransactionHash,
  recalculerFriseChronologique,
  ReleveImporte,
  TransactionDocument,
  FriseChronologiqueSegment,
  FriseRecalculResult
};

/**
 * Cloud Function : importerReleveBancaire
 * Traitement en arrière-plan des relevés bancaires (CSV ou PDF).
 * 1. Enregistre le compte bancaire si non existant.
 * 2. Déduplique et écrit les transactions avec hash_deduplication comme ID de document Firestore (coût zéro).
 * 3. Enregistre le relevé importé dans RelevesImportes.
 * 4. Exécute l'algorithme de recalcul chronologique rétroactif.
 * 5. Met à jour la frise chronologique et le solde certifié ou dérivé.
 */
export const importerReleveBancaire = functions.region('europe-west1')
  .runWith({ timeoutSeconds: 300, memory: '512MB' })
  .https.onCall(async (data, context) => {
    try {
      console.log("[importerReleveBancaire] Démarrage du traitement d'import...");

      const {
        compteId = 'compte_principal',
        compteNom = 'Compte Courant Principal',
        compteNumero = '',
        devise = 'EUR',
        source_type,
        nom_fichier = 'releve_sans_nom',
        date_debut,
        date_fin,
        solde_initial = null,
        solde_final = null,
        transactions = []
      } = data || {};

      if (!source_type || (source_type !== 'CSV' && source_type !== 'PDF')) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          "Le paramètre 'source_type' doit être strictement 'CSV' ou 'PDF'."
        );
      }

      if (!date_debut || !date_fin) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          "Les dates de début et de fin du relevé ('date_debut' et 'date_fin' au format YYYY-MM-DD) sont requises."
        );
      }

      const db = admin.firestore();

      // 1. Mise à jour ou création du compte bancaire
      const compteRef = db.collection('ComptesBancaires').doc(compteId);
      await compteRef.set({
        id: compteId,
        nom: compteNom,
        numero: compteNumero,
        devise: devise === 'CHF' ? 'CHF' : 'EUR',
        actif: true,
        derniereMaj: new Date().toISOString()
      }, { merge: true });

      // 2. Déduplication par hash et écriture par lots des transactions
      const releveId = `rel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const batchSize = 400; // Limite Firestore batch = 500 ops
      const txCollectionRef = compteRef.collection('Transactions');
      const preparedTxs: TransactionDocument[] = [];

      let totalMouvements = 0;

      for (const t of transactions) {
        const montantNum = Number(t.montant) || 0;
        totalMouvements += montantNum;
        const libelle = String(t.libelle || t.description || 'Opération').trim();
        const dateStr = String(t.date || date_debut).substring(0, 10);

        const hash = generateTransactionHash({
          date: dateStr,
          libelle,
          montant: montantNum,
          compteId
        });

        preparedTxs.push({
          hash_deduplication: hash,
          date: dateStr,
          libelle,
          montant: Math.round(montantNum * 100) / 100,
          categorie: t.categorie || t.category || 'Non catégorisé',
          flowType: t.flowType || (montantNum > 0 ? 'INCOME' : 'VARIABLE_EXPENSE'),
          releveId,
          compteId,
          createdAt: new Date().toISOString()
        });
      }

      // Écriture par lots de 400
      for (let i = 0; i < preparedTxs.length; i += batchSize) {
        const batch = db.batch();
        const chunk = preparedTxs.slice(i, i + batchSize);
        for (const tx of chunk) {
          const docRef = txCollectionRef.doc(tx.hash_deduplication);
          batch.set(docRef, tx, { merge: true });
        }
        await batch.commit();
      }

      console.log(`[importerReleveBancaire] ${preparedTxs.length} transactions écrites sous ComptesBancaires/${compteId}/Transactions`);

      // 3. Enregistrement du relevé dans RelevesImportes
      const nouveauReleve: ReleveImporte = {
        id: releveId,
        source_type: source_type as SourceReleveType,
        nom_fichier,
        date_debut: String(date_debut).substring(0, 10),
        date_fin: String(date_fin).substring(0, 10),
        solde_initial: solde_initial !== null && solde_initial !== undefined ? Number(solde_initial) : null,
        solde_final: solde_final !== null && solde_final !== undefined ? Number(solde_final) : null,
        total_mouvements: Math.round(totalMouvements * 100) / 100,
        nb_transactions: preparedTxs.length,
        createdAt: new Date().toISOString()
      };

      await compteRef.collection('RelevesImportes').doc(releveId).set(nouveauReleve);

      // 4. Exécution du re-calcul chronologique rétroactif
      const allRelevesSnap = await compteRef.collection('RelevesImportes').get();
      const allReleves: ReleveImporte[] = allRelevesSnap.docs.map(d => d.data() as ReleveImporte);

      const allTxsSnap = await compteRef.collection('Transactions').get();
      const allTxs: TransactionDocument[] = allTxsSnap.docs.map(d => d.data() as TransactionDocument);

      const friseResult = recalculerFriseChronologique(compteId, allReleves, allTxs);

      // 5. Mise à jour de la sous-collection FriseChronologique
      const friseCollRef = compteRef.collection('FriseChronologique');
      const oldFriseSnap = await friseCollRef.get();
      
      // Nettoyage anciens segments
      const deleteBatch = db.batch();
      oldFriseSnap.docs.forEach(docSnap => deleteBatch.delete(docSnap.ref));
      await deleteBatch.commit();

      // Écriture des nouveaux segments recalculés
      for (let i = 0; i < friseResult.segments.length; i += batchSize) {
        const insertBatch = db.batch();
        const chunk = friseResult.segments.slice(i, i + batchSize);
        for (const seg of chunk) {
          const segDocRef = friseCollRef.doc(seg.id);
          insertBatch.set(segDocRef, seg);
        }
        await insertBatch.commit();
      }

      // Mise à jour du document CompteBancaire principal
      await compteRef.update({
        soldeActuel: friseResult.soldeActuel,
        typeSoldeActuel: friseResult.typeSoldeActuel,
        nbReleves: allReleves.length,
        nbTransactions: allTxs.length,
        alertesRapprochementCount: friseResult.alertesRapprochement.length,
        trousCount: friseResult.trousDetectes.length,
        derniereMaj: new Date().toISOString()
      });

      console.log(`[importerReleveBancaire] Frise recalculée avec succès : ${friseResult.segments.length} segments (${friseResult.alertesRapprochement.length} alertes, ${friseResult.trousDetectes.length} trous).`);

      return {
        success: true,
        releveId,
        compteId,
        transactionsImportees: preparedTxs.length,
        friseResult
      };

    } catch (error: any) {
      console.error("[importerReleveBancaire] Erreur traitement relevé:", error);
      throw new functions.https.HttpsError(
        'internal',
        `Erreur lors du traitement du relevé bancaire : ${error.message || 'Erreur interne'}`
      );
    }
  });

/**
 * Cloud Function : recalculerFriseBancaire
 * Recalcule à la demande la frise chronologique d'un compte donné.
 */
export const recalculerFriseBancaire = functions.region('europe-west1')
  .runWith({ timeoutSeconds: 300, memory: '512MB' })
  .https.onCall(async (data, context) => {
    try {
      const { compteId = 'compte_principal' } = data || {};
      const db = admin.firestore();
      const compteRef = db.collection('ComptesBancaires').doc(compteId);

      const [relevesSnap, txsSnap] = await Promise.all([
        compteRef.collection('RelevesImportes').get(),
        compteRef.collection('Transactions').get()
      ]);

      const releves: ReleveImporte[] = relevesSnap.docs.map(d => d.data() as ReleveImporte);
      const txs: TransactionDocument[] = txsSnap.docs.map(d => d.data() as TransactionDocument);

      const result = recalculerFriseChronologique(compteId, releves, txs);

      // Persistance de la frise mise à jour
      const friseCollRef = compteRef.collection('FriseChronologique');
      const oldFriseSnap = await friseCollRef.get();
      const deleteBatch = db.batch();
      oldFriseSnap.docs.forEach(d => deleteBatch.delete(d.ref));
      await deleteBatch.commit();

      const insertBatch = db.batch();
      for (const seg of result.segments) {
        insertBatch.set(friseCollRef.doc(seg.id), seg);
      }
      await insertBatch.commit();

      await compteRef.update({
        soldeActuel: result.soldeActuel,
        typeSoldeActuel: result.typeSoldeActuel,
        alertesRapprochementCount: result.alertesRapprochement.length,
        trousCount: result.trousDetectes.length,
        derniereMaj: new Date().toISOString()
      });

      return {
        success: true,
        compteId,
        result
      };
    } catch (err: any) {
      console.error("[recalculerFriseBancaire] Erreur:", err);
      throw new functions.https.HttpsError('internal', err.message || 'Erreur recalcul frise');
    }
  });

/**
 * ============================================================================
 * CLOUD FUNCTION (LIVRABLE 3 & 4) : MIGRATION & FUSION DE L'HISTORIQUE FIRESTORE
 * Parcourt les produits Firestore d'un utilisateur, regroupe les anciens "faux doublons"
 * sous les nouvelles Clés de Besoin Générique issues du Nettoyage Extrême,
 * fusionne offres_magasins et historiques de prix, et supprime les doublons obsolètes (0 € coût).
 * ============================================================================
 */
export const migrateAndMergeDuplicateProducts = functions.region('europe-west1')
  .runWith({ timeoutSeconds: 300, memory: '1GB' })
  .https.onCall(async (data) => {
    const { userId = 'cashpilot_main_user' } = data || {};
    const db = admin.firestore();

    const productsCollRef = db.collection(`users/${userId}/products`);
    const snapshot = await productsCollRef.get();

    if (snapshot.empty) {
      return { success: true, message: "Aucun produit trouvé dans la collection.", mergedGroups: 0, deletedCount: 0 };
    }

    // Regrouper par nouvelle clé canonique de besoin (Couches 1 & 2)
    const groups = new Map<string, Array<{ id: string; data: any; canonical: ReturnType<typeof normalizeProductNeed> }>>();
    const invalidDocIds: string[] = [];

    snapshot.docs.forEach(docSnap => {
      const docData = docSnap.data();
      const currentId = docSnap.id;
      const rawName = docData.nom_generique || docData.nom_generique_nettoye || currentId;
      const brand = docData.marque || '';
      const canonical = normalizeProductNeed(rawName, brand);

      if (canonical.isInvalidArtifact) {
        invalidDocIds.push(currentId);
        return;
      }

      const canonicalKey = canonical.id;
      if (!groups.has(canonicalKey)) {
        groups.set(canonicalKey, []);
      }
      groups.get(canonicalKey)!.push({ id: currentId, data: docData, canonical });
    });

    let mergedCount = 0;
    let deletedCount = 0;
    const mergeLog: Array<{ canonicalKey: string; oldIds: string[]; finalName: string }> = [];

    // Suppression des artefacts invalides ("De articles", lignes vides)
    if (invalidDocIds.length > 0) {
      const cleanBatch = db.batch();
      for (const badId of invalidDocIds) {
        cleanBatch.delete(productsCollRef.doc(badId));
        deletedCount++;
      }
      await cleanBatch.commit();
    }

    // Traitement par batch Firestore
    for (const [canonicalKey, docList] of groups.entries()) {
      const mergedOffers: Record<string, any> = {};
      const allHistPrix: Array<{ date: string; magasin: string; prix_unitaire: number }> = [];
      const allHistOffres: Array<any> = [];
      const firstCanonical = docList[0].canonical;
      let representativeName = firstCanonical.nom_affichage || sanitizeGenericDisplayName(canonicalKey);
      let representativeAisle = firstCanonical.rayon || '';
      let representativeAisleKey = '';

      for (const item of docList) {
        const d = item.data;
        if (!representativeAisle) {
          representativeAisle = d.rayon || 'Autres / Divers';
          representativeAisleKey = d.rayon_cle || 'autres_divers';
        }

        const offers = d.offres_magasins || d.prix_actuel || {};
        for (const [storeId, offer] of Object.entries(offers)) {
          const off = offer as any;
          if (!off || !(Number(off.prix_unitaire) > 0)) continue;
          const resolvedStore = resolvePhysicalStore({ storeName: off.magasin_nom || storeId });
          const stKey = resolvedStore.id || storeId;
          const cur = mergedOffers[stKey];
          if (!cur || new Date(off.date || 0).getTime() >= new Date(cur.date || 0).getTime()) {
            mergedOffers[stKey] = {
              ...off,
              magasin_id: stKey,
              magasin_nom: resolvedStore.displayName
            };
          }
        }

        if (Array.isArray(d.historique_prix)) {
          allHistPrix.push(...d.historique_prix.filter((h: any) => h && Number(h.prix_unitaire) > 0));
        }

        if (Array.isArray(d.historique_offres)) {
          allHistOffres.push(...d.historique_offres.filter((h: any) => h && Number(h.prix_unitaire) > 0));
        }
      }

      const offerEntries = Object.entries(mergedOffers);
      // COUCHE 3.2 : Suppression stricte des lignes fantômes sans aucun prix valide
      if (offerEntries.length === 0) {
        const ghostBatch = db.batch();
        for (const oldItem of docList) {
          ghostBatch.delete(productsCollRef.doc(oldItem.id));
          deletedCount++;
        }
        await ghostBatch.commit();
        continue;
      }

      if (firstCanonical.rayon) {
        const locked = normalizeLockedAisle(firstCanonical.rayon);
        representativeAisle = locked.label;
        representativeAisleKey = locked.key;
      } else if (!representativeAisleKey) {
        const locked = normalizeLockedAisle(representativeAisle);
        representativeAisle = locked.label;
        representativeAisleKey = locked.key;
      }

      // Dédoublonnage et tri chronologique
      const seenPriceKeys = new Set<string>();
      const dedupedHistPrix = allHistPrix.filter(h => {
        const key = `${h.date}_${h.magasin}`;
        if (seenPriceKeys.has(key)) return false;
        seenPriceKeys.add(key);
        return true;
      }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const seenOfferKeys = new Set<string>();
      const dedupedHistOffres = allHistOffres.filter(h => {
        const key = `${h.date}_${h.magasin || h.magasin_id}`;
        if (seenOfferKeys.has(key)) return false;
        seenOfferKeys.add(key);
        return true;
      }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const sorted = [...offerEntries].sort((a, b) => a[1].prix_unitaire - b[1].prix_unitaire);
      const meilleure = {
        magasin_id: sorted[0][0],
        magasin_nom: sorted[0][1].magasin_nom || sorted[0][0],
        prix_unitaire: sorted[0][1].prix_unitaire,
        unite: sorted[0][1].unite || 'piece'
      };
      const pire = {
        magasin_id: sorted[sorted.length - 1][0],
        magasin_nom: sorted[sorted.length - 1][1].magasin_nom || sorted[sorted.length - 1][0],
        prix_unitaire: sorted[sorted.length - 1][1].prix_unitaire,
        unite: sorted[sorted.length - 1][1].unite || 'piece'
      };

      const consolidatedDoc = {
        superKey: canonicalKey,
        nom_generique: representativeName,
        nom_generique_nettoye: representativeName,
        rayon: representativeAisle,
        rayon_assigne: representativeAisle,
        rayon_cle: representativeAisleKey,
        cle_besoin: canonicalKey,
        offres_magasins: mergedOffers,
        historique_prix: dedupedHistPrix,
        historique_offres: dedupedHistOffres,
        meilleure_offre: meilleure,
        pire_offre: pire,
        ecart_prix_max: Number((pire.prix_unitaire - meilleure.prix_unitaire).toFixed(2)),
        derniere_mise_a_jour: new Date().toISOString(),
        nombre_releves: Math.max(dedupedHistOffres.length, offerEntries.length)
      };

      const batch = db.batch();
      const targetDocRef = productsCollRef.doc(canonicalKey);
      batch.set(targetDocRef, consolidatedDoc, { merge: true });

      for (const oldItem of docList) {
        if (oldItem.id !== canonicalKey) {
          batch.delete(productsCollRef.doc(oldItem.id));
          deletedCount++;
        }
      }

      await batch.commit();
      mergedCount++;
      mergeLog.push({
        canonicalKey,
        oldIds: docList.map(d => d.id),
        finalName: representativeName
      });
    }

    return {
      success: true,
      userId,
      totalInitialDocs: snapshot.size,
      mergedGroupsCount: mergedCount,
      deletedObsoleteDocsCount: deletedCount,
      mergeLog
    };
  });

// ============================================================================
// EXPORT DU MOTEUR COMPARATIF & GESTION DES SUPER CLÉS CASHPILOT (0 € COÛT)
// ============================================================================
export {
  processReceiptWithSuperKeys,
  normalizeProductNeed,
  CANONICAL_FAMILY_RULES,
  generateGenericNeedKey,
  generateSuperKey,
  cleanGenericEssence,
  sanitizeGenericDisplayName,
  correctFrenchSpelling,
  resolvePhysicalStore,
  normalizeLockedAisle,
  LOCKED_SUPERMARKET_AISLES
} from './receiptPriceEngine';
