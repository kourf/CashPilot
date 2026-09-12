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
    const prompt = `Tu es un expert en finances personnelles. 
CatÃ©gorise strictement ces transactions bancaires.
DÃ©tecte les revenus, dÃ©penses, remboursements, virements internes, Ã©pargne, abonnements, frais bancaires, crÃ©dits.
Classe en type fixe, variable ou exceptionnelle.
Ne retourne que le JSON correspondant au schÃ©ma fourni, sans TVA.
Transactions Ã  traiter : ${JSON.stringify(transactions)}`;

    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        transactions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING },
              description: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              category: { type: Type.STRING, description: "CatÃ©gorie principale" },
              subCategory: { type: Type.STRING },
              isIncomeOrExpense: { type: Type.STRING, description: "income, expense, ou transfer" },
              isRefund: { type: Type.BOOLEAN },
              isSavings: { type: Type.BOOLEAN },
              expenseType: { type: Type.STRING, description: "fixe, variable, ou exceptionnelle" },
              isSubscription: { type: Type.BOOLEAN },
              isBankFee: { type: Type.BOOLEAN },
              isCreditOrLoan: { type: Type.BOOLEAN },
              isInstallment: { type: Type.BOOLEAN },
              isInternalTransfer: { type: Type.BOOLEAN }
            }
          }
        }
      }
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
