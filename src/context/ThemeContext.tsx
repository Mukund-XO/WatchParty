import React, { createContext, useContext, useState, useEffect } from 'react';
import { AccentPreset, TopBarTheme } from '../types';

export const DEFAULT_ACCENT = '#FAF7F1'; // Cream / Off-White

export const ACCENT_PRESETS: AccentPreset[] = [
  {
    id: 'cream-default',
    name: 'Cream / Off-White',
    hex: '#FAF7F1',
    isDefault: true,
  },
  {
    id: 'warm-sand',
    name: 'Warm Sand',
    hex: '#E6DEC8',
  },
  {
    id: 'classic-maroon',
    name: 'Cinema Maroon',
    hex: '#800000',
  },
  {
    id: 'soft-mint',
    name: 'Soft Mint',
    hex: '#B4E1D0',
  },
  {
    id: 'sky-ice',
    name: 'Sky Ice',
    hex: '#B8E1FF',
  },
  {
    id: 'pale-peach',
    name: 'Pale Peach',
    hex: '#F8C8B4',
  },
  {
    id: 'amber-gold',
    name: 'Amber Gold',
    hex: '#F5CE7A',
  },
  {
    id: 'lavender-pearl',
    name: 'Lavender Pearl',
    hex: '#E0D4EC',
  },
  {
    id: 'pure-white',
    name: 'Pure White',
    hex: '#FFFFFF',
  },
];

export const THEME_PRESETS: TopBarTheme[] = ACCENT_PRESETS.map((p) => ({
  id: p.id,
  name: p.name,
  bgColor: '#0c0e12',
  borderColor: 'rgba(255, 255, 255, 0.08)',
  textColor: '#FAF7F1',
  accentColor: p.hex,
}));

function getContrastColor(hex: string): '#090a0d' | '#FAF7F1' {
  const clean = hex.replace('#', '');
  if (clean.length !== 6 && clean.length !== 3) return '#090a0d';
  let fullHex = clean;
  if (clean.length === 3) {
    fullHex = clean.split('').map((c) => c + c).join('');
  }
  const r = parseInt(fullHex.substring(0, 2), 16) || 250;
  const g = parseInt(fullHex.substring(2, 4), 16) || 247;
  const b = parseInt(fullHex.substring(4, 6), 16) || 241;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? '#090a0d' : '#FAF7F1';
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  let fullHex = clean;
  if (clean.length === 3) {
    fullHex = clean.split('').map((c) => c + c).join('');
  }
  if (fullHex.length !== 6) return `rgba(250, 247, 241, ${alpha})`;
  const r = parseInt(fullHex.substring(0, 2), 16) || 250;
  const g = parseInt(fullHex.substring(2, 4), 16) || 247;
  const b = parseInt(fullHex.substring(4, 6), 16) || 241;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface ThemeContextType {
  accentColor: string;
  setAccentColor: (hex: string) => void;
  accentContrastColor: '#090a0d' | '#FAF7F1';
  presets: AccentPreset[];
  topBarColor: string;
  setTopBarColor: (hex: string) => void;
  applyPreset: (presetId: string) => void;
  resetToDefault: () => void;
  currentTheme: TopBarTheme;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Default accent color is strictly Cream / Off-White #FAF7F1
  const [accentColor, setAccentColorState] = useState<string>(() => {
    const saved = localStorage.getItem('watchparty_accent_color');
    if (saved && /^#[0-9A-Fa-f]{3,6}$/.test(saved)) {
      return saved;
    }
    return DEFAULT_ACCENT;
  });

  const [topBarColor, setTopBarColorState] = useState<string>(() => {
    const saved = localStorage.getItem('watchparty_topbar_bg');
    return saved || '#0c0e12';
  });

  const contrastColor = getContrastColor(accentColor);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent', accentColor);
    root.style.setProperty('--accent-color', accentColor);
    root.style.setProperty('--accent-contrast', contrastColor);
    root.style.setProperty('--accent-border', hexToRgba(accentColor, 0.4));
    root.style.setProperty('--accent-subtle', hexToRgba(accentColor, 0.12));
    root.style.setProperty('--topbar-bg', topBarColor);
    root.style.setProperty('--topbar-border', hexToRgba(accentColor, 0.18));

    try {
      localStorage.setItem('watchparty_accent_color', accentColor);
      localStorage.setItem('watchparty_topbar_bg', topBarColor);
    } catch {
      // storage restrictions
    }
  }, [accentColor, contrastColor, topBarColor]);

  const setAccentColor = (hex: string) => {
    setAccentColorState(hex);
  };

  const setTopBarColor = (hex: string) => {
    setTopBarColorState(hex);
  };

  const applyPreset = (presetId: string) => {
    const preset = ACCENT_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setAccentColor(preset.hex);
    }
  };

  const resetToDefault = () => {
    setAccentColor(DEFAULT_ACCENT);
  };

  const currentTheme: TopBarTheme = {
    id: 'active-theme',
    name: 'Active Theme',
    bgColor: topBarColor,
    borderColor: hexToRgba(accentColor, 0.18),
    textColor: '#FAF7F1',
    accentColor,
  };

  return (
    <ThemeContext.Provider
      value={{
        accentColor,
        setAccentColor,
        accentContrastColor: contrastColor,
        presets: ACCENT_PRESETS,
        topBarColor,
        setTopBarColor,
        applyPreset,
        resetToDefault,
        currentTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
