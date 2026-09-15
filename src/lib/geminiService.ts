import { GoogleGenerativeAI } from '@google/generative-ai';
import { CATEGORIES } from './bankParser';

export function getGeminiApiKey(): string {
  return (
    import.meta.env.VITE_GEMINI_API_KEY ||
    (typeof window !== 'undefined' ? localStorage.getItem('cashpilot_gemini_api_key') || '' : '')
  );
}

export interface BankTransactionItem {
  id: string;
  date?: string;
  amount: number;
  rawLabel?: string;
  description?: string;
  category?: string;
  flowType?: string;
}

export interface GeminiEnrichResult {
  id: string;
  cleanDesc: string;
  flowType: 'INCOME' | 'FIXED_EXPENSE' | 'VARIABLE_EXPENSE' | 'SAVINGS_TRANSFER';
  category: string;
  confidence: 'high' | 'medium' | 'low';
  explanation: string;
}

export async function auditAndEnrichTransactionsWithGemini(
  transactions: BankTransactionItem[]
): Promise<GeminiEnrichResult[]> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      "Clé API Gemini manquante. Veuillez renseigner votre clé API Google Gemini dans vos paramètres ou le fichier .env."
    );
  }
  if (!transactions || transactions.length === 0) return [];

  const genAI = new GoogleGenerativeAI(apiKey);
  const payload = transactions.slice(0, 30).map(t => ({
    id: t.id,
    date: t.date,
    amount: Number(t.amount) || 0,
    rawLabel: t.rawLabel || t.description || 'Opération'
  }));

  const prompt = `
Tu es l'IA financière experte de CashPilot.
Ta mission est d'auditer et classifier avec une précision chirurgicale ces opérations bancaires :
- flowType : STRICTEMENT 'INCOME' (Revenu / Encaissement), 'FIXED_EXPENSE' (Charge Fixe), 'VARIABLE_EXPENSE' (Dépense Courante), ou 'SAVINGS_TRANSFER' (Épargne / Virement interne neutralisé).
- category : STRICTEMENT choisie parmi :
${CATEGORIES.map(c => `- ${c}`).join('\n')}
- cleanDesc : Nom propre nettoyé (ex: "Nayssa El Hani", "CAF", "France Travail", "TotalEnergies").

RÈGLES CAPITALES POUR LES FLUX ENTRANTS (Montant > 0) :
1. Un montant positif (> 0) représente de l'argent reçu sur le compte bancaire (encaissement).
2. NE JAMAIS classer un montant positif en 'SAVINGS_TRANSFER' ou 'Épargne & Investissement' sauf s'il s'agit EXPLICITEMENT d'un virement entre les propres comptes ou livrets personnels de l'utilisateur (ex: de son propre livret A ou de son autre compte bancaire au même nom).
3. Si le virement est reçu d'un tiers, d'un proche, d'un ami ou de la famille (par exemple Nayssa El Hani, même si le motif indique "Envoye depuis Revolut", "Wero" ou "PayPal") :
   - flowType : 'INCOME'
   - category : 'Virement Reçu (Proches)'
   Le mot "Revolut" ou "Wero" dans le motif indique uniquement l'application de paiement utilisée par l'expéditeur, ce n'est PAS un compte d'épargne de l'utilisateur !
4. Si le virement provient d'une mutuelle ou assurance de santé (ex: GENERATION, CPAM, AMELI, Mutuelle) :
   - flowType : 'INCOME'
   - category : 'Santé'
5. Si le virement provient d'un organisme d'aide sociale (ex: CAF, France Travail, Allocations) :
   - flowType : 'INCOME'
   - category : 'Aides & Allocations'
6. Si le virement provient d'un employeur / salaire :
   - flowType : 'INCOME'
   - category : 'Salaire & Revenus'

Voici les opérations à auditer :
${JSON.stringify(payload, null, 2)}

Renvoie UNIQUEMENT un tableau JSON d'objets au format :
[
  {
    "id": "...",
    "cleanDesc": "...",
    "flowType": "INCOME",
    "category": "...",
    "confidence": "high",
    "explanation": "..."
  }
]
`;

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json' }
    });
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const jsonStr = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error: any) {
    console.warn('Erreur Gemini 2.5 Flash pour audit, repli automatique 1.5...', error);
    try {
      const fallbackModel = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: { responseMimeType: 'application/json' }
      });
      const fallbackResult = await fallbackModel.generateContent(prompt);
      const responseText = fallbackResult.response.text();
      const jsonStr = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(jsonStr);
    } catch (fallbackError) {
      console.error('Erreur finale Gemini Audit:', fallbackError);
      throw fallbackError;
    }
  }
}

export async function categorizeWithGemini(descriptions: string[]): Promise<Record<string, string>> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      "Clé API Gemini manquante. Veuillez renseigner votre clé API Google Gemini dans vos paramètres ou le fichier .env."
    );
  }
  if (!descriptions || descriptions.length === 0) return {};

  const genAI = new GoogleGenerativeAI(apiKey);
  const uniqueDescriptions = Array.from(new Set(descriptions.map(d => d.trim()).filter(Boolean))).slice(0, 40);
  if (uniqueDescriptions.length === 0) return {};

  const prompt = `
Tu es un expert financier. Ta mission est de catégoriser des libellés bancaires isolés.
Tu dois choisir STRICTEMENT la catégorie correspondante dans cette liste exacte :
${CATEGORIES.map(c => `- ${c}`).join('\n')}

Voici les libellés à catégoriser :
${uniqueDescriptions.map((desc, i) => `${i + 1}. "${desc}"`).join('\n')}

Renvoie UNIQUEMENT un objet JSON valide dont les clés sont les libellés exacts fournis et les valeurs la catégorie choisie.
`;

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json' }
    });
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const jsonStr = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error: any) {
    console.warn('Erreur Gemini 2.5 Flash, repli automatique...', error);
    try {
      const fallbackModel = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: { responseMimeType: 'application/json' }
      });
      const fallbackResult = await fallbackModel.generateContent(prompt);
      const responseText = fallbackResult.response.text();
      const jsonStr = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(jsonStr);
    } catch (fallbackError) {
      console.error('Erreur finale Gemini:', fallbackError);
      throw new Error('Échec de la communication avec l\'API Gemini.');
    }
  }
}
