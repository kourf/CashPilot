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

// Rechargement fluide unique lors de l'activation d'une nouvelle version déployée
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
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
