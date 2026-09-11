# CashPilot

CashPilot est une application premium de gestion, suivi, analyse et optimisation des finances personnelles.

## Fonctionnalités Principales (V1)
- **Import de Relevés Bancaires** : Support PDF et CSV avec OCR via Gemini.
- **Import de Tickets de Caisse** : Analyse automatique des produits via Gemini Vision (photo, galerie, PDF).
- **Comparateur de Prix** : Tableau dynamique comparant le prix de vos produits favoris entre vos différents magasins.
- **Coach IA** : Conseils financiers personnalisés et non-culpabilisants basés sur les repères français (INSEE, Banque de France).
- **Confidentialité** : Suppression totale de vos données d'un simple clic.

## Technologies
- React 18, TypeScript, Vite
- Tailwind CSS (Design Premium, mobile-first)
- Firebase Hosting, Firestore, Storage, Functions
- Google Gemini API (via Firebase Functions sécurisées)

## Configuration et Installation

1. **Cloner le projet** et installer les dépendances :
   ```bash
   npm install
   ```

2. **Configurer Firebase** :
   - Créez un projet Firebase (plan Blaze requis pour les fonctions).
   - Activez Firestore, Storage, Hosting et Functions.
   - Ajoutez vos clés de configuration Firebase dans un fichier `.env.local` (voir `.env.example`).
   - Ajoutez votre clé API Gemini dans l'environnement Firebase Functions :
     ```bash
     firebase functions:secrets:set GEMINI_API_KEY
     ```

3. **Lancer le serveur de développement** :
   ```bash
   npm run dev
   ```

4. **Déployer l'application** :
   ```bash
   firebase deploy
   ```

## Avertissement
Cette application est destinée à la gestion des finances personnelles et ne gère pas la TVA (ni stockage, ni extraction, ni affichage). Elle ne remplace pas une application comptable ou fiscale.
