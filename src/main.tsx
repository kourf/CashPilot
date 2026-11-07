import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

// Version d'application unique pour forcer la synchronisation mobile et PC
export const APP_BUILD_ID = '2026.11.07-v2.9';

// Détection automatique d'ancienne version : purge et recharge transparente
if (typeof window !== 'undefined') {
  const storedBuild = localStorage.getItem('cashpilot_build_id');
  if (storedBuild && storedBuild !== APP_BUILD_ID) {
    localStorage.setItem('cashpilot_build_id', APP_BUILD_ID);
    if ('caches' in window) {
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => {});
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      }).catch(() => {});
    }
  } else if (!storedBuild) {
    localStorage.setItem('cashpilot_build_id', APP_BUILD_ID);
  }
}

/**
 * Purge complète du CacheStorage et réinitialisation du Service Worker
 * pour garantir que le téléphone charge immédiatement la dernière version déployée.
 */
export async function forceAppUpdate() {
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    }
    if (typeof window !== 'undefined' && 'caches' in window) {
      const keys = await caches.keys();
      for (const k of keys) {
        await caches.delete(k);
      }
    }
  } catch (err) {
    console.warn('[CashPilot] Erreur purge cache:', err);
  }
  // Bypasse le cache HTTP du navigateur via query param unique
  if (typeof window !== 'undefined') {
    window.location.href = window.location.origin + window.location.pathname + '?v=' + Date.now();
  }
}

// Enregistrement transparent du Service Worker PWA avec synchronisation automatique
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Si une nouvelle version attend, active immédiatement
    updateSW(true);
  },
  onOfflineReady() {
    console.info('[CashPilot PWA] L\'application est prête pour un fonctionnement ultra-rapide.');
  }
});

// Force une vérification immédiate du SW sur le serveur au démarrage
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then((reg) => {
    reg.update().catch(() => {});
  });
}

// Vérification immédiate lors du retour au premier plan (déverrouillage téléphone, changement d'onglet)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.update().catch(() => {});
        });
      }
      updateSW(true);
    }
  });
}

// Vérification périodique en arrière-plan toutes les 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.update().catch(() => {});
      });
    }
    updateSW(true);
  }, 5 * 60 * 1000);
}

// Rechargement automatique lors de l'activation d'une NOUVELLE version déployée
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  let refreshing = false;
  const hadControllerAtStart = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Ne recharger que si un service worker existait déjà avant (mise à jour réelle, pas premier chargement)
    if (!refreshing && hadControllerAtStart) {
      refreshing = true;
      window.location.reload();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
