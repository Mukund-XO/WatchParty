import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserAccount } from '../types';
import { randomId, sanitizeSingleLine } from '../utils/security';

interface AuthContextType {
  user: UserAccount;
  setDisplayName: (name: string) => void;
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserAccount>(() => ({
    // Generated fresh for every tab and page load and never stored. If tabs shared one id,
    // each tab would treat the others' sync messages as its own and ignore them.
    id: randomId('user'),
    name: readSavedName() ?? `Guest ${Math.floor(1000 + Math.random() * 9000)}`,
    avatar: '',
  }));

  // Only the display name is remembered between visits.
  useEffect(() => {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify({ name: user.name }));
    } catch {
      // Ignore storage restrictions
    }
  }, [user.name]);

  const setDisplayName = (name: string) => {
    const clean = sanitizeSingleLine(name, 40);
    if (!clean) return;
    setUser((prev) => ({ ...prev, name: clean }));
  };

  return <AuthContext.Provider value={{ user, setDisplayName }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
