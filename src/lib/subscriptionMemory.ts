import { db } from './firebase';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

export interface SubscriptionMapping {
  rawDescription: string;
  amount: number;
  resolvedName: string;
  updatedAt: string;
}

/**
 * Génère une clé déterministe et normalisée basée sur le libellé et le montant.
 */
export function getSubscriptionMappingKey(description: string, amount: number): string {
  const normDesc = (description || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 50);

  const roundedCents = Math.round(Math.abs(amount) * 100);
  return `${normDesc}_${roundedCents}`;
}

/**
 * Recherche si un abonnement masqué par un agrégateur (ex: Google Play, Apple)
 * a déjà été clarifié et mémorisé pour ce montant.
 */
export async function getSubscriptionMapping(
  accountId: string,
  description: string,
  amount: number
): Promise<string | null> {
  const key = getSubscriptionMappingKey(description, amount);

  // 1. Cache chaud local immédiat (0 latence)
  try {
    const localRaw = localStorage.getItem('cashpilot_subscription_mappings');
    if (localRaw) {
      const cache = JSON.parse(localRaw);
      if (cache && cache[key] && typeof cache[key].resolvedName === 'string') {
        return cache[key].resolvedName;
      }
    }
  } catch {
    // ignore
  }

  // 2. Recherche dans Firestore (Scoped Utilisateur & Global)
  try {
    const userDocRef = doc(db, `users/${accountId}/subscription_mappings`, key);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const data = snap.data() as SubscriptionMapping;
      if (data?.resolvedName) {
        updateLocalCache(key, data);
        return data.resolvedName;
      }
    }

    // Fallback collection partagée
    const globalDocRef = doc(db, 'subscription_mappings', key);
    const globalSnap = await getDoc(globalDocRef);
    if (globalSnap.exists()) {
      const data = globalSnap.data() as SubscriptionMapping;
      if (data?.resolvedName) {
        updateLocalCache(key, data);
        return data.resolvedName;
      }
    }
  } catch (err) {
    console.warn('Subscription mapping lookup skipped:', err);
  }

  return null;
}

/**
 * Enregistre une clarification de l'utilisateur dans Firestore et en local
 * pour les futures résolutions autonomes.
 */
export async function saveSubscriptionMapping(
  accountId: string,
  description: string,
  amount: number,
  resolvedName: string
): Promise<void> {
  const key = getSubscriptionMappingKey(description, amount);
  const mapping: SubscriptionMapping = {
    rawDescription: description.trim(),
    amount: Math.abs(amount),
    resolvedName: resolvedName.trim(),
    updatedAt: new Date().toISOString()
  };

  // Mise à jour cache local
  updateLocalCache(key, mapping);

  // Sauvegarde Firestore
  try {
    const userDocRef = doc(db, `users/${accountId}/subscription_mappings`, key);
    await setDoc(userDocRef, mapping, { merge: true });

    const globalDocRef = doc(db, 'subscription_mappings', key);
    await setDoc(globalDocRef, mapping, { merge: true });
  } catch (err) {
    console.warn('Erreur sauvegarde Firestore mapping abonnement:', err);
  }
}

/**
 * Supprime un mapping en cas de réinitialisation manuelle par l'utilisateur.
 */
export async function deleteSubscriptionMapping(
  accountId: string,
  description: string,
  amount: number
): Promise<void> {
  const key = getSubscriptionMappingKey(description, amount);

  try {
    const localRaw = localStorage.getItem('cashpilot_subscription_mappings');
    if (localRaw) {
      const cache = JSON.parse(localRaw);
      delete cache[key];
      localStorage.setItem('cashpilot_subscription_mappings', JSON.stringify(cache));
    }
  } catch {}

  try {
    await deleteDoc(doc(db, `users/${accountId}/subscription_mappings`, key));
    await deleteDoc(doc(db, 'subscription_mappings', key));
  } catch (err) {
    console.warn('Erreur suppression Firestore mapping:', err);
  }
}

function updateLocalCache(key: string, data: SubscriptionMapping) {
  try {
    const localRaw = localStorage.getItem('cashpilot_subscription_mappings');
    const cache = localRaw ? JSON.parse(localRaw) : {};
    cache[key] = data;
    localStorage.setItem('cashpilot_subscription_mappings', JSON.stringify(cache));
  } catch {}
}
