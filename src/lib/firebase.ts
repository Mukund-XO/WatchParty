import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  connectAuthEmulator,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase, type Database } from 'firebase/database';

/**
 * Firebase web config. These values identify your project and are meant to be public: they are
 * visible to every visitor of any Firebase web app. Security comes from database.rules.json,
 * not from hiding them. See the README for restricting the API key to your domain.
 */
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

function isRealValue(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && !/^(YOUR_|MY_|your-|changeme)/i.test(value.trim());
}

const ENV_NAMES: Record<keyof typeof config, string> = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  databaseURL: 'VITE_FIREBASE_DATABASE_URL',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  appId: 'VITE_FIREBASE_APP_ID',
};

/** Names of the environment variables that are missing or still hold placeholder text. */
export const missingFirebaseConfig: string[] = (Object.keys(config) as (keyof typeof config)[])
  .filter((key) => !isRealValue(config[key]))
  .map((key) => ENV_NAMES[key]);

export const isFirebaseConfigured = missingFirebaseConfig.length === 0;

/** Emulators are for local development only; a production build never connects to them. */
const useEmulators = import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';

interface Services {
  app: FirebaseApp;
  auth: Auth;
  db: Database;
}

let services: Services | null = null;

/** Starts Firebase on first use. Throws if the project is not configured. */
export function getFirebase(): Services {
  if (!isFirebaseConfigured) {
    throw new Error(`Firebase is not configured. Missing: ${missingFirebaseConfig.join(', ')}`);
  }
  if (!services) {
    const app = initializeApp(config as Record<string, string>);
    // Anonymous sign-in needs no pop-ups or redirects, so skip the resolver that would load a
    // third-party iframe. Persistence keeps the same anonymous user across visits.
    const auth = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    });
    const db = getDatabase(app);
    if (useEmulators) {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectDatabaseEmulator(db, '127.0.0.1', 9000);
    }
    services = { app, auth, db };
  }
  return services;
}
