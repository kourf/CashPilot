import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  connectFirestoreEmulator 
} from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// Les variables d'environnement Vite doivent commencer par VITE_
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAnSIXddLfpw3WmX1tTm4CR3fE6aTpusFc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "cashpilot-app-2026.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "cashpilot-app-2026",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "cashpilot-app-2026.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "246674970418",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:246674970418:web:3da9647b7f5c1c2449292b"
};

const app = initializeApp(firebaseConfig);

// Initialisation Firestore avec cache persistant IndexedDB multi-onglets (0 latence)
let db: ReturnType<typeof getFirestore>;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (e) {
  console.warn("Firestore persistent cache fallback to getFirestore:", e);
  db = getFirestore(app);
}

const storage = getStorage(app);
const functions = getFunctions(app, 'europe-west1');

// Connexion aux émulateurs locaux si configuré
if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectStorageEmulator(storage, 'localhost', 9199);
  connectFunctionsEmulator(functions, 'localhost', 5001);
}

export { db, storage, functions };

