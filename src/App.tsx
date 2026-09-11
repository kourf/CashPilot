import { useEffect } from 'react';
import AppRouter from './Router';

function App() {
  useEffect(() => {
    if (!localStorage.getItem('deviceId')) {
      const newId = 'device_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
      localStorage.setItem('deviceId', newId);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <AppRouter />
    </div>
  );
}

export default App;
