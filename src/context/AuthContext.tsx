import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserAccount } from '../types';
import { sanitizeTextInput } from '../utils/security';

interface AuthContextType {
  user: UserAccount;
  isGuest: boolean;
  login: (userData?: Partial<UserAccount>) => void;
  logout: () => void;
  updateUser: (data: Partial<UserAccount>) => void;
  setGuestNickname: (name: string) => void;
}

const DEFAULT_STUDENT_USER: UserAccount = {
  id: 'usr_mukundan_2026',
  name: 'Mukundan A.S.',
  email: 'mukundan.as2026@vitstudent.ac.in',
  studentId: 'VIT-2026-CS-084',
  avatar: '',
  role: 'club_lead',
  isGuest: false,
};

function createGuestUser(customName?: string): UserAccount {
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return {
    id: `guest_${suffix}`,
    name: customName || `Guest #${suffix}`,
    email: '',
    studentId: 'GUEST-ACCESS',
    avatar: '',
    role: 'student',
    isGuest: true,
  };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserAccount>(() => {
    const saved = localStorage.getItem('synccinema_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.name === 'string') {
          return parsed;
        }
      } catch {
        // Fallback to guest
      }
    }
    // Default to a guest user so no forced login is ever required
    return createGuestUser();
  });

  useEffect(() => {
    try {
      localStorage.setItem('synccinema_user', JSON.stringify(user));
    } catch {
      // Ignore storage restrictions
    }
  }, [user]);

  const login = (customData?: Partial<UserAccount>) => {
    const newUser: UserAccount = {
      ...DEFAULT_STUDENT_USER,
      ...customData,
      isGuest: false,
    };
    setUser(newUser);
  };

  const logout = () => {
    const guest = createGuestUser();
    setUser(guest);
  };

  const setGuestNickname = (nickname: string) => {
    const clean = sanitizeTextInput(nickname, 40);
    if (!clean) return;
    setUser((prev) => ({
      ...prev,
      name: clean,
      isGuest: true,
    }));
  };

  const updateUser = (data: Partial<UserAccount>) => {
    setUser((prev) => ({ ...prev, ...data }));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isGuest: !!user.isGuest,
        login,
        logout,
        updateUser,
        setGuestNickname,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
