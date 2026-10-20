/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_DATABASE_URL?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  /** "true" connects to the local Firebase emulators. Ignored by production builds. */
  readonly VITE_USE_FIREBASE_EMULATORS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
