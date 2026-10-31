import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

// Enregistrement transparent du Service Worker PWA avec synchronisation automatique en temps réel
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Si une nouvelle version est déployée, déclenche la mise à jour sans friction
    updateSW(true);
  },
  onOfflineReady() {
    console.info('[CashPilot PWA] L\'application est prête pour un fonctionnement ultra-rapide.');
  }
});

// Vérification immédiate lors du retour au premier plan (déverrouillage téléphone, changement d'onglet PC)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      updateSW(true);
    }
  });
}

// Vérification périodique en arrière-plan toutes les 15 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    updateSW(true);
  }, 15 * 60 * 1000);
}

// Rechargement fluide unique lors de l'activation d'une NOUVELLE version déployée
// CRITIQUE : on ne recharge QUE si un controller existait déjà au démarrage (mise à jour)
// pour ne jamais interrompre l'enregistrement initial lors de la première visite !
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  const hadControllerAtStart = Boolean(navigator.serviceWorker.controller);
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadControllerAtStart && !refreshing) {
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
