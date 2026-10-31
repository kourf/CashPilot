import { auth, db } from './firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';

export const SHARED_ACCOUNT_ID = 'cashpilot_main_user';

/**
 * Récupère l'identifiant unique (UID ou Espace) de l'utilisateur actif.
 * - Pour l'administrateur : permet d'utiliser l'espace de données spécifié (ex: cashpilot_main_user)
 * - Pour les utilisateurs standards : utilise strictement leur UID Firebase Auth unique.
 */
export function getActiveAccountId(): string {
  // 1. Priorité Administrateur : espace personnalisé ou espace historique cashpilot_main_user
  try {
    if (typeof window !== 'undefined') {
      const adminWorkspace = localStorage.getItem('cashpilot_admin_workspace');
      if (adminWorkspace && adminWorkspace.trim()) {
        return adminWorkspace.trim();
      }

      // Support des paramètres d'URL confidentiels (?workspace= ou ?account= ou ?sync=)
      if (window.location && window.location.search) {
        const urlParams = new URLSearchParams(window.location.search);
        const urlAccount = urlParams.get('workspace') || urlParams.get('account') || urlParams.get('sync');
        if (urlAccount && urlAccount.trim()) {
          const clean = urlAccount.trim();
          localStorage.setItem('cashpilot_admin_workspace', clean);
          localStorage.setItem('cashpilot_account_id', clean);
          localStorage.setItem('deviceId', clean);
          return clean;
        }
      }
    }
  } catch (e) {
    console.warn("Erreur lecture workspace admin:", e);
  }

  // 2. Utilisateur connecté via Firebase Authentication (UID unique)
  try {
    if (auth && auth.currentUser && auth.currentUser.uid) {
      const uid = auth.currentUser.uid;
      try {
        localStorage.setItem('cashpilot_account_id', uid);
        localStorage.setItem('deviceId', uid);
      } catch {}
      return uid;
    }
  } catch (e) {
    console.warn("Erreur lecture UID Firebase Auth:", e);
  }

  // 3. Fallback sur l'UID mémorisé en session locale
  try {
    if (typeof window !== 'undefined') {
      const storedUid = localStorage.getItem('cashpilot_auth_uid');
      if (storedUid && storedUid.trim()) {
        return storedUid.trim();
      }
    }
  } catch {}

  // 4. Fallback sécurisé (aucun utilisateur connecté)
  return 'unauthenticated';
}

/**
 * Nettoie les caches locaux lors d'un changement d'utilisateur ou d'une déconnexion
 * afin d'empêcher toute fuite de données entre deux sessions sur le même appareil.
 */
export function clearUserSessionCache(): void {
  if (typeof window === 'undefined') return;
  const keysToClear = [
    'cashpilot_tx_cache',
    'cashpilot_transactions',
    'cashpilot_receipts_v2_cache',
    'cashpilot_standardized_products_cache',
    'cashpilot_receipts_hidden_products',
    'cashpilot_pending_receipt_validation',
    'cashpilot_coach_conversations_v3',
    'cashpilot_coach_active_id_v3',
    'cashpilot_custom_rules_v1',
    'cashpilot_archived_items_v1',
    'cashpilot_cost_of_living_v2',
    'cashpilot_cost_of_living',
    'cashpilot_monthly_balances',
    'cashpilot_subscription_mappings',
    'cashpilot_admin_workspace',
    'cashpilot_is_admin'
  ];
  keysToClear.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {}
  });
}

/**
 * Fonction conservée pour rétrocompatibilité.
 */
export async function migrateLegacyDeviceDataIfNeeded(): Promise<number> {
  const uid = getActiveAccountId();
  if (!uid || uid === 'unauthenticated') return 0;

  try {
    localStorage.setItem('deviceId', uid);
    localStorage.setItem('cashpilot_account_id', uid);
  } catch {}
  return 0;
}

/**
 * Permet (sur action volontaire ou migration) de rattacher le champ `userId` aux documents.
 */
export async function ensureUserIdOnUserCollection(uid: string, subcollectionName: string): Promise<void> {
  if (!uid || uid === 'unauthenticated') return;
  try {
    const snap = await getDocs(collection(db, `users/${uid}/${subcollectionName}`));
    if (snap.empty) return;
    const docsMissingUid = snap.docs.filter(d => d.data().userId !== uid);
    if (docsMissingUid.length === 0) return;

    const batch = writeBatch(db);
    docsMissingUid.slice(0, 400).forEach(d => {
      batch.set(doc(db, `users/${uid}/${subcollectionName}/${d.id}`), { userId: uid }, { merge: true });
    });
    await batch.commit();
  } catch {
    // Silencieux hors-ligne
  }
}
