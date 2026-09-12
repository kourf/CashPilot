import { db } from './firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';

export const SHARED_ACCOUNT_ID = 'cashpilot_main_user';

/**
 * Récupère l'identifiant du compte partagé actif.
 * Permet à tous les appareils (PC, Mobile, Tablette) d'accéder au même espace de trésorerie.
 */
export function getActiveAccountId(): string {
  // 1. Vérifier si un paramètre d'URL de synchronisation est fourni (?sync= ou ?account=)
  try {
    if (typeof window !== 'undefined' && window.location) {
      const urlParams = new URLSearchParams(window.location.search);
      const syncParam = urlParams.get('sync') || urlParams.get('account');
      if (syncParam && syncParam.trim()) {
        const clean = syncParam.trim();
        localStorage.setItem('cashpilot_account_id', clean);
        localStorage.setItem('deviceId', clean);
        return clean;
      }
    }
  } catch (e) {
    console.warn("Erreur lecture paramètre URL sync:", e);
  }

  // 2. Vérifier si un identifiant personnalisé est configuré dans localStorage
  const stored = localStorage.getItem('cashpilot_account_id');
  if (stored && stored.trim() && stored !== 'default-user' && !stored.startsWith('device_')) {
    return stored.trim();
  }

  // 3. Par défaut : Espace unifié partagé pour tous les appareils
  localStorage.setItem('cashpilot_account_id', SHARED_ACCOUNT_ID);
  return SHARED_ACCOUNT_ID;
}

/**
 * Migre automatiquement les transactions créées sous un ancien identifiant local (device_*)
 * vers l'espace partagé unifié, sans créer de doublons.
 */
export async function migrateLegacyDeviceDataIfNeeded(): Promise<number> {
  const targetAccountId = getActiveAccountId();
  const legacyId = localStorage.getItem('deviceId');

  if (!legacyId || legacyId === targetAccountId || !legacyId.startsWith('device_')) {
    // Si déjà sur le compte partagé, on s'assure juste que deviceId est aligné
    localStorage.setItem('deviceId', targetAccountId);
    return 0;
  }

  try {
    console.log(`[Sync] Analyse des données locales de l'appareil (${legacyId}) vers l'espace partagé (${targetAccountId})...`);
    const legacySnap = await getDocs(collection(db, `users/${legacyId}/transactions`));
    
    if (legacySnap.empty) {
      console.log(`[Sync] Aucune transaction isolée sur ${legacyId}. Alignement sur ${targetAccountId}.`);
      localStorage.setItem('deviceId', targetAccountId);
      return 0;
    }

    console.log(`[Sync] ${legacySnap.size} opérations trouvées sur l'appareil. Fusion vers l'espace partagé...`);
    const targetSnap = await getDocs(collection(db, `users/${targetAccountId}/transactions`));
    
    const targetSignatures = new Set(
      targetSnap.docs.map(d => {
        const data = d.data();
        const amt = Number(data.amount).toFixed(2);
        const desc = (data.description || data.rawLabel || data.cleanLabel || '').trim().toLowerCase();
        return `${data.date}_${amt}_${desc}`;
      })
    );

    const batch = writeBatch(db);
    let migratedCount = 0;

    legacySnap.docs.forEach(docSnap => {
      const data = docSnap.data();
      const amt = Number(data.amount).toFixed(2);
      const desc = (data.description || data.rawLabel || data.cleanLabel || '').trim().toLowerCase();
      const signature = `${data.date}_${amt}_${desc}`;

      if (!targetSignatures.has(signature)) {
        const newRef = doc(collection(db, `users/${targetAccountId}/transactions`));
        batch.set(newRef, {
          ...data,
          id: newRef.id,
          migratedFrom: legacyId,
          migratedAt: new Date().toISOString()
        });
        targetSignatures.add(signature);
        migratedCount++;
      }
    });

    if (migratedCount > 0) {
      await batch.commit();
      console.log(`[Sync] ${migratedCount} transactions migrées avec succès vers l'espace partagé !`);
    }

    // Aligner le deviceId et forcer le rafraîchissement du cache
    localStorage.setItem('deviceId', targetAccountId);
    localStorage.removeItem('cashpilot_tx_cache');

    return migratedCount;
  } catch (err) {
    console.error("[Sync] Erreur lors de la migration des données de l'appareil :", err);
    localStorage.setItem('deviceId', targetAccountId);
    return 0;
  }
}
