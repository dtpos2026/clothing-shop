/**
 * Firebase bootstrap. Configuration comes from build-time env vars (see .env.example);
 * when they are absent the app runs fully offline/local and all cloud UI explains what
 * is missing instead of failing.
 */
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

const env = import.meta.env;
export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
};
export const FUNCTIONS_REGION = (env.VITE_FIREBASE_FUNCTIONS_REGION as string) || 'asia-south1';

export const isFirebaseConfigured = () => !!(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);

let cache: Promise<{ app: FirebaseApp; auth: Auth; db: Firestore }> | null = null;

export function getFirebase() {
  if (!isFirebaseConfigured()) return Promise.reject(new Error('Firebase is not configured for this build (see docs/FIREBASE_SETUP.md).'));
  if (!cache) {
    cache = (async () => {
      const { initializeApp } = await import('firebase/app');
      const { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence } = await import('firebase/auth');
      const { initializeFirestore, persistentLocalCache, persistentSingleTabManager } = await import('firebase/firestore');
      const app = initializeApp(firebaseConfig as Required<typeof firebaseConfig>);
      const auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
      // Offline persistence: reads served from cache, writes queued and retried automatically
      const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({}) }), ignoreUndefinedProperties: true });
      if (env.VITE_FIREBASE_EMULATORS === 'true') {
        const { connectAuthEmulator } = await import('firebase/auth');
        const { connectFirestoreEmulator } = await import('firebase/firestore');
        connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
        connectFirestoreEmulator(db, '127.0.0.1', 8080);
      }
      return { app, auth, db };
    })();
  }
  return cache;
}

export async function callFunction<TReq, TRes>(name: string, data: TReq): Promise<TRes> {
  const { app } = await getFirebase();
  const { getFunctions, httpsCallable, connectFunctionsEmulator } = await import('firebase/functions');
  const fns = getFunctions(app, FUNCTIONS_REGION);
  if (env.VITE_FIREBASE_EMULATORS === 'true') connectFunctionsEmulator(fns, '127.0.0.1', 5001);
  const r = await httpsCallable<TReq, TRes>(fns, name)(data);
  return r.data;
}

export async function getStorageBucket() {
  const { app } = await getFirebase();
  const { getStorage } = await import('firebase/storage');
  return getStorage(app);
}
