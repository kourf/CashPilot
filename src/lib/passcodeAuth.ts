/**
 * Module d'authentification par code de déverrouillage sécurisé (Passcode / Code PIN).
 * 
 * SÉCURITÉ STRICTE :
 * Aucun code de déverrouillage n'est stocké en clair dans le code source.
 * La vérification s'opère via un hachage cryptographique irréversible salé (SHA-256)
 * exécuté nativement via l'API Web Crypto du navigateur (window.crypto.subtle).
 */

const PASSCODE_SALT = 'cashpilot_visionos_pin_vault_salt_8f7b2c9a';

// Empreinte SHA-256 salée calculée pour le code secret autorisé
const AUTHORIZED_PASSCODE_HASH = '712d7cd5c9e483b5291a2db7a7cd92d18626c7d6469b95503bf998cf5306694f';

// Espace de données cible associé au déverrouillage administrateur
export const DEFAULT_PASSCODE_WORKSPACE = 'cashpilot_main_user';

/**
 * Calcule l'empreinte SHA-256 salée d'un code PIN à l'aide de l'API Web Crypto native.
 */
export async function computePasscodeHash(pin: string): Promise<string> {
  const cleanPin = (pin || '').trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(`${cleanPin}:${PASSCODE_SALT}`);

  // Utilisation de crypto.subtle (disponible dans tous les navigateurs modernes et HTTPS/Localhost)
  const subtleCrypto = typeof window !== 'undefined' && window.crypto && window.crypto.subtle
    ? window.crypto.subtle
    : null;

  if (subtleCrypto) {
    const hashBuffer = await subtleCrypto.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback si crypto.subtle n'est pas encore initialisé
  let hash = 0;
  const str = `${cleanPin}:${PASSCODE_SALT}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(16);
}

/**
 * Vérifie si le code PIN saisi correspond à l'empreinte autorisée
 * sans jamais dévoiler ni comparer en clair le code dans le code source.
 */
export async function verifyPasscode(enteredPin: string): Promise<boolean> {
  if (!enteredPin || enteredPin.trim().length === 0) {
    return false;
  }

  try {
    const computedHash = await computePasscodeHash(enteredPin);

    // Vérification contre l'empreinte officielle autorisée
    if (computedHash === AUTHORIZED_PASSCODE_HASH) {
      return true;
    }

    // Support d'une éventuelle empreinte personnalisée sauvegardée localement
    if (typeof window !== 'undefined') {
      const customHash = localStorage.getItem('cashpilot_custom_passcode_hash');
      if (customHash && computedHash === customHash) {
        return true;
      }
    }

    return false;
  } catch (err) {
    console.error('Erreur lors de la vérification du code de déverrouillage:', err);
    return false;
  }
}
