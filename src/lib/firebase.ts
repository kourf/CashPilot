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
import { 
  getAuth, 
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  onAuthStateChanged, 
  type User 
} from 'firebase/auth';

// Les variables d'environnement Vite doivent commencer par VITE_
const firebaseConfig = {
  apiKey: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY) || process.env.VITE_FIREBASE_API_KEY || "AIzaSyAnSIXddLfpw3WmX1tTm4CR3fE6aTpusFc",
  authDomain: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN) || process.env.VITE_FIREBASE_AUTH_DOMAIN || "cashpilot-app-2026.firebaseapp.com",
  projectId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_PROJECT_ID) || process.env.VITE_FIREBASE_PROJECT_ID || "cashpilot-app-2026",
  storageBucket: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET) || process.env.VITE_FIREBASE_STORAGE_BUCKET || "cashpilot-app-2026.firebasestorage.app",
  messagingSenderId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID) || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "246674970418",
  appId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_APP_ID) || process.env.VITE_FIREBASE_APP_ID || "1:246674970418:web:3da9647b7f5c1c2449292b"
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

// Authentification Firebase gratuite (Email/Mot de passe & Google Auth - 100% Spark Plan gratuit)
let auth: ReturnType<typeof getAuth>;
try {
  auth = getAuth(app);
} catch (e) {
  console.warn("Firebase Auth init warning:", e);
  auth = null as any;
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

/**
 * Vérifie si un utilisateur est actuellement authentifié (sans connexion anonyme forcée).
 */
export async function ensureAuthenticatedUser(): Promise<User | null> {
  if (!auth || typeof window === 'undefined') return null;
  if (auth.currentUser) return auth.currentUser;

  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user || null);
    });
  });
}

// Connexion aux émulateurs locaux si configuré
if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_USE_FIREBASE_EMULATOR === 'true') {
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectStorageEmulator(storage, 'localhost', 9199);
  connectFunctionsEmulator(functions, 'localhost', 5001);
}

export { 
  app, 
  db, 
  storage, 
  functions, 
  auth,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  onAuthStateChanged,
  type User
};
