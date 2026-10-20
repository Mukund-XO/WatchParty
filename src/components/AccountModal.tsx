import React, { useState } from 'react';
import { X, User, Palette, Check, RotateCcw, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme, DEFAULT_ACCENT } from '../context/ThemeContext';
import { sanitizeSingleLine } from '../utils/security';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose }) => {
  const { user, setDisplayName } = useAuth();
  const { accentColor, setAccentColor, applyPreset, resetToDefault, presets } = useTheme();

  const [customHex, setCustomHex] = useState(accentColor);
  const [nicknameInput, setNicknameInput] = useState(user.name);
  const [savedNameToast, setSavedNameToast] = useState(false);

  if (!isOpen) return null;

  const handleCustomColorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (/^#(?:[0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/.test(customHex)) {
      setAccentColor(customHex);
    }
  };

  const handleSaveNickname = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = sanitizeSingleLine(nicknameInput, 40);
    if (clean) {
      setDisplayName(clean);
      setSavedNameToast(true);
      setTimeout(() => setSavedNameToast(false), 2000);
    }
  };

  const isDefaultActive = accentColor.toUpperCase() === DEFAULT_ACCENT.toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg rounded-2xl bg-[#0f1117] border border-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-black/20">
          <div className="flex items-center gap-2.5">
            <User className="w-4 h-4 text-[#FAF7F1]" />
            <h2 className="font-topic text-sm font-semibold text-[#FAF7F1] tracking-wide">
              Profile & Website Accent
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#9c978b] hover:text-[#FAF7F1] hover:bg-white/[0.06] transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {/* Display name */}
          <div className="space-y-3">
            <p className="font-topic text-xs font-medium text-[#9c978b] tracking-wider uppercase">
              Display name
            </p>

            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-[#FAF7F1] font-bold text-xs">
                  {user.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-topic text-sm font-semibold text-[#FAF7F1]">{user.name}</h3>
                  <p className="text-[11px] text-[#9c978b]">
                    No account needed. Your name is saved only in this browser.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveNickname} className="space-y-1.5 pt-1">
                <label className="block text-[11px] text-[#9c978b]">
                  Customize your display name (appears in chat & rooms)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={nicknameInput}
                    onChange={(e) => setNicknameInput(e.target.value)}
                    maxLength={40}
                    placeholder="e.g. Alex, Cinephile42"
                    className="flex-1 px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs text-[#FAF7F1] focus:outline-none focus:border-[var(--accent)]"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-xs font-medium text-[#FAF7F1] border border-white/10 transition-colors cursor-pointer shrink-0 font-topic"
                  >
                    {savedNameToast ? 'Saved!' : 'Save Name'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Website Accent Color Customization */}
          <div className="space-y-3 pt-3 border-t border-white/[0.08]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-[#FAF7F1]" />
                <p className="font-topic text-xs font-semibold text-[#FAF7F1] tracking-wide">
                  Website Accent Color
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!isDefaultActive && (
                  <button
                    onClick={resetToDefault}
                    className="flex items-center gap-1 text-[11px] text-[#9c978b] hover:text-[#FAF7F1] transition-colors cursor-pointer"
                    title="Reset to default Cream/Off-White"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset to Cream</span>
                  </button>
                )}
                <span className="text-[11px] font-mono text-[#FAF7F1] px-1.5 py-0.5 rounded bg-white/[0.05]">
                  {accentColor}
                </span>
              </div>
            </div>

            <p className="text-xs text-[#9c978b] leading-relaxed">
              This option configures the active theme accent across the entire website — including the top bar borders, action buttons, progress bars, and film cards. The default is <span className="text-[#FAF7F1] font-medium">Cream / Off-White (#FAF7F1)</span>.
            </p>

            {/* Presets */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              {presets.map((preset) => {
                const isSelected = accentColor.toLowerCase() === preset.hex.toLowerCase();
                return (
                  <button
                    key={preset.id}
                    onClick={() => {
                      applyPreset(preset.id);
                      setCustomHex(preset.hex);
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[var(--accent)] bg-white/[0.08] text-[#FAF7F1] shadow-sm'
                        : 'border-white/[0.06] bg-white/[0.02] text-[#9c978b] hover:border-white/20 hover:text-[#FAF7F1]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3.5 h-3.5 rounded-md border border-white/20 shrink-0 shadow-sm"
                        style={{ backgroundColor: preset.hex }}
                      />
                      <span className="font-medium font-topic truncate">
                        {preset.name}
                      </span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#FAF7F1] shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Custom Color Input */}
            <form onSubmit={handleCustomColorSubmit} className="pt-2 flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={customHex}
                  onChange={(e) => setCustomHex(e.target.value)}
                  placeholder="#FAF7F1"
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-[#FAF7F1] font-mono focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <input
                type="color"
                value={accentColor.startsWith('#') && accentColor.length === 7 ? accentColor : '#FAF7F1'}
                onChange={(e) => {
                  setAccentColor(e.target.value);
                  setCustomHex(e.target.value);
                }}
                className="w-9 h-9 rounded-xl border border-white/10 cursor-pointer bg-transparent p-0.5"
                title="Pick custom accent color"
              />
              <button
                type="submit"
                className="px-3.5 py-2 text-xs font-medium text-white bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 rounded-xl transition-colors cursor-pointer font-topic shrink-0"
              >
                Apply
              </button>
            </form>

            {/* Live Accent Preview Card */}
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--accent, #FAF7F1)' }} />
                <span className="text-[11px] text-[#9c978b]">Live Accent Preview:</span>
              </div>
              <span
                className="px-3 py-1 rounded-lg text-xs font-bold font-topic shadow-sm"
                style={{
                  backgroundColor: 'var(--accent, #FAF7F1)',
                  color: 'var(--accent-contrast, #090a0d)',
                }}
              >
                Primary Button Style
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-black/30 border-t border-white/[0.08] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer font-topic shadow-sm hover:brightness-105 active:scale-95"
            style={{
              backgroundColor: 'var(--accent, #FAF7F1)',
              color: 'var(--accent-contrast, #090a0d)',
            }}
          >
            Save & Done
          </button>
        </div>
      </div>
    </div>
  );
};
