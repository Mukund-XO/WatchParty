import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { UserAccount } from '../types';
import { sanitizeSingleLine } from '../utils/security';
import { getFirebase, isFirebaseConfigured, missingFirebaseConfig } from '../lib/firebase';

export type AuthStatus = 'connecting' | 'ready' | 'unconfigured' | 'error';

interface AuthContextType {
  user: UserAccount;
  status: AuthStatus;
  /** Names of environment variables that still need a value (when status is "unconfigured"). */
  missingConfig: string[];
  /** Safe-to-show message when status is "error". */
  error: string | null;
  setDisplayName: (name: string) => void;
  retry: () => void;
}

const PROFILE_KEY = 'watchparty_profile';
// Older versions saved a whole profile (including an email address and student ID) under this key.
// It is deleted on load so that data does not linger in the browser.
const LEGACY_PROFILE_KEYS = ['synccinema_user'];

function readSavedName(): string | null {
  try {
    LEGACY_PROFILE_KEYS.forEach((key) => localStorage.removeItem(key));
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.name === 'string') {
      return sanitizeSingleLine(parsed.name, 40) || null;
    }
  } catch {
    // Ignore corrupt or blocked storage and fall back to a generated name
  }
  return null;
}

function describeAuthError(error: unknown): string {
  const code = (error as { code?: string } | null)?.code ?? '';
  if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') {
    return 'Anonymous sign-in is switched off for this Firebase project. Enable it under Authentication > Sign-in method.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Could not reach the server. Check your connection and try again.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many attempts from this device. Wait a minute and try again.';
  }
  return 'Could not sign in. Check your connection and try again.';
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Signs every visitor in anonymously with Firebase Authentication. There are no passwords and no
 * personal data: the browser gets a random, stable user id which the database rules use to tell
 * the host from the other viewers. Clearing site data creates a new identity.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [uid, setUid] = useState('');
  const [name, setName] = useState<string>(() => readSavedName() ?? `Guest ${Math.floor(1000 + Math.random() * 9000)}`);
  const [status, setStatus] = useState<AuthStatus>(isFirebaseConfigured ? 'connecting' : 'unconfigured');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const { auth } = getFirebase();
    let cancelled = false;
    setStatus('connecting');
    setError(null);

    const stop = onAuthStateChanged(auth, (firebaseUser) => {
      if (cancelled) return;
      if (firebaseUser) {
        setUid(firebaseUser.uid);
        setStatus('ready');
      } else {
        setUid('');
        signInAnonymously(auth).catch((e: unknown) => {
          if (cancelled) return;
          setError(describeAuthError(e));
          setStatus('error');
        });
      }
    });

    return () => {
      cancelled = true;
      stop();
    };
  }, [attempt]);

  // Only the display name is remembered between visits.
  useEffect(() => {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify({ name }));
    } catch {
      // Ignore storage restrictions
    }
  }, [name]);

  const setDisplayName = useCallback((next: string) => {
    const clean = sanitizeSingleLine(next, 40);
    if (clean) setName(clean);
  }, []);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const value = useMemo<AuthContextType>(
    () => ({
      user: { id: uid, name, avatar: '' },
      status,
      missingConfig: missingFirebaseConfig,
      error,
      setDisplayName,
      retry,
    }),
    [uid, name, status, error, setDisplayName, retry],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
