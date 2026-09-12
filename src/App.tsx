import { useEffect } from 'react';
import AppRouter from './Router';
import { getActiveAccountId, migrateLegacyDeviceDataIfNeeded } from './lib/userUtils';

function App() {
  useEffect(() => {
    // Initialise l'identifiant unifié partagé pour tous les appareils
    getActiveAccountId();
    // Fusionne automatiquement les données créées précédemment sous un ID local isolé
    migrateLegacyDeviceDataIfNeeded().catch(err => {
      console.warn("Migration check:", err);
    });
  }, []);


  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <AppRouter />
    </div>
  );
}

export default App;
