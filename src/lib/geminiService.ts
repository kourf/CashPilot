import { GoogleGenerativeAI } from '@google/generative-ai';
import { CATEGORIES } from './bankParser';

export function getGeminiApiKey(): string {
  return (
    import.meta.env.VITE_GEMINI_API_KEY ||
    (typeof window !== 'undefined' ? localStorage.getItem('cashpilot_gemini_api_key') || '' : '')
  );
}

export async function categorizeWithGemini(descriptions: string[]): Promise<Record<string, string>> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      "Clé API Gemini manquante. Veuillez renseigner votre clé API Google Gemini dans le fichier .env (VITE_GEMINI_API_KEY) ou dans vos paramètres."
    );
  }
  if (!descriptions || descriptions.length === 0) return {};

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  // Dédoublonner les libellés pour optimiser les tokens
  const uniqueDescriptions = Array.from(new Set(descriptions.map(d => d.trim()).filter(Boolean))).slice(0, 40);

  const prompt = `
Tu es un expert financier. Ta mission est de catégoriser des libellés bancaires isolés.
Tu dois choisir STRICTEMENT la catégorie correspondante dans cette liste exacte :
${CATEGORIES.map(c => `- ${c}`).join('\n')}

Voici les libellés à catégoriser :
${uniqueDescriptions.map((desc, i) => `${i + 1}. "${desc}"`).join('\n')}

Renvoie UNIQUEMENT un objet JSON valide. Les clés doivent être les libellés exacts fournis, et les valeurs la catégorie choisie. Aucun texte additionnel ou markdown.
Exemple de format attendu :
{
  "Uber Eats": "Restaurants & Sorties",
  "Leroy Merlin": "Shopping & Maison"
}
`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const jsonStr = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error: any) {
    console.error('Erreur d\'analyse Gemini:', error);
    if (error?.message?.includes('API_KEY_INVALID') || error?.message?.includes('API key not valid')) {
      throw new Error('Clé API Gemini non valide. Vérifiez votre clé Google AI Studio.');
    }
    throw new Error('Échec de la communication avec l\'API Gemini. Vérifiez votre clé API ou votre connexion.');
  }
}
