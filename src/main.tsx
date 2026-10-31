import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

// Enregistrement transparent du Service Worker PWA avec rechargement automatique en arrière-plan
registerSW({
  immediate: true,
  onOfflineReady() {
    console.info('[CashPilot PWA] L\'application est prête pour un fonctionnement ultra-rapide.');
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
