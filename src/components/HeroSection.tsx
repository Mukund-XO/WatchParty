import React, { useState } from 'react';
import { Play, KeyRound, ArrowDown, Users, Film, ArrowRight } from 'lucide-react';
import { validateRoomCode } from '../utils/security';

interface HeroSectionProps {
  onCreateRoom: () => void;
  /** Returns an error message to display, or null when the room was joined. */
  onJoinRoom: (code: string) => string | null;
  onScrollToListings: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onCreateRoom,
  onJoinRoom,
  onScrollToListings,
}) => {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [errorMsg, setErrorMsg] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const handleDigitChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, '');
    if (!clean) {
      const updated = [...digits];
      updated[index] = '';
      setDigits(updated);
      setErrorMsg('');
      return;
    }

    if (clean.length >= 6) {
      const pasteArr = clean.slice(0, 6).split('');
      setDigits(pasteArr);
      const nextInput = document.getElementById(`digit-input-5`);
      nextInput?.focus();
      return;
    }

    const char = clean.slice(-1);
    const updated = [...digits];
    updated[index] = char;
    setDigits(updated);
    setErrorMsg('');

    if (index < 5 && char) {
      const nextInput = document.getElementById(`digit-input-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      const prevInput = document.getElementById(`digit-input-${index - 1}`);
      prevInput?.focus();
    } else if (e.key === 'Enter') {
      submitJoin();
    }
  };

  const submitJoin = () => {
    const rawCode = digits.join('');
    const validCode = validateRoomCode(rawCode);
    if (!validCode) {
      setErrorMsg('Please enter a valid 6-digit room passkey');
      return;
    }
    setIsJoining(true);
    setTimeout(() => {
      const error = onJoinRoom(validCode);
      if (error) setErrorMsg(error);
      setIsJoining(false);
    }, 200);
  };

  return (
    <section className="relative pt-10 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto notebook-grid-pattern">
      {/* Decorative notebook ruler line */}
      <div className="absolute left-4 sm:left-8 top-0 bottom-0 w-[1px] bg-[#FAF7F1]/10 pointer-events-none" />

      {/* Hero Punch Line */}
      <div className="text-center max-w-3xl mx-auto pt-6 pb-12">
        <h1 className="font-topic text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#FAF7F1] tracking-tight leading-[1.1] mb-5 text-balance">
          Enjoy Every Frame With Friends.
        </h1>

        <p className="text-base sm:text-lg text-[#9c978b] leading-relaxed max-w-2xl mx-auto font-normal">
          Synchronized playback, shared reactions, and timestamped margin notes.
          Host a screening room or punch in a 6-digit code to join.
        </p>
      </div>

      {/* Main Split: Two Distinct Primary Action Hubs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto my-2">
        {/* Action 1: Create a Watch Room */}
        <div className="relative group rounded-3xl bg-[#0f1117] border border-white/10 hover:border-[#FAF7F1]/40 p-8 flex flex-col justify-between transition-all duration-300 shadow-xl shadow-black/40">
          <div>
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-105 transition-transform"
              style={{
                backgroundColor: 'var(--accent-subtle, rgba(250, 247, 241, 0.12))',
                border: '1px solid var(--accent-border, rgba(250, 247, 241, 0.35))',
                color: 'var(--accent, #FAF7F1)',
              }}
            >
              <Play className="w-5 h-5 fill-current" />
            </div>

            <h2 className="font-topic text-2xl font-bold text-[#FAF7F1] mb-2 tracking-tight">
              Create a Watch Room
            </h2>
            <p className="text-sm text-[#9c978b] leading-relaxed mb-6">
              Host a screening from the film library or paste your own video link.
              Generate a random 6-digit room pass to share with other tabs.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={onCreateRoom}
              className="w-full flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl font-topic font-bold text-sm tracking-wide shadow-lg shadow-black/40 transition-all cursor-pointer active:scale-[0.98] hover:brightness-105"
              style={{
                backgroundColor: 'var(--accent, #FAF7F1)',
                color: 'var(--accent-contrast, #090a0d)',
              }}
            >
              <Film className="w-4 h-4" />
              <span>Launch New Watch Room</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
            <div className="flex items-center justify-between text-[11px] text-[#9c978b] px-1 font-mono">
              <span>Shared Controls · Auto-Sync</span>
              <span className="text-[#FAF7F1]">Instant 6-Digit Pass</span>
            </div>
          </div>
        </div>

        {/* Action 2: Join a Created Room with 6-Digit Room Code */}
        <div className="relative group rounded-3xl bg-[#0f1117] border border-white/10 hover:border-[#FAF7F1]/40 p-8 flex flex-col justify-between transition-all duration-300 shadow-xl shadow-black/40">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-[#FAF7F1] mb-6 group-hover:scale-105 transition-transform">
              <KeyRound className="w-5 h-5 text-[#FAF7F1]" />
            </div>

            <h2 className="font-topic text-2xl font-bold text-[#FAF7F1] mb-2 tracking-tight">
              Join with 6-Digit Code
            </h2>
            <p className="text-sm text-[#9c978b] leading-relaxed mb-4">
              Enter the 6-digit passkey of a room created in this browser, for example from another tab, to join it.
            </p>

            {/* 6-Digit Input Grid */}
            <div className="my-4">
              <div className="flex items-center justify-center gap-2 sm:gap-2.5">
                {digits.map((digit, idx) => (
                  <React.Fragment key={idx}>
                    <input
                      id={`digit-input-${idx}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      className="w-10 sm:w-12 h-12 sm:h-14 text-center text-lg sm:text-xl font-bold font-mono text-[#FAF7F1] bg-black/50 border border-white/15 focus:border-[var(--accent)] focus:bg-[var(--accent-subtle)] focus:ring-1 focus:ring-[var(--accent)] rounded-xl transition-all outline-none"
                    />
                    {idx === 2 && (
                      <span className="text-[#9c978b] font-mono text-base font-bold select-none">
                        -
                      </span>
                    )}
                  </React.Fragment>
                ))}
              </div>

              {errorMsg && (
                <p className="text-xs text-rose-400 text-center mt-2 font-medium">
                  {errorMsg}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={submitJoin}
              disabled={isJoining}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-white/[0.08] hover:bg-white/[0.14] text-[#FAF7F1] border border-white/15 hover:border-[var(--accent)]/60 font-topic font-semibold text-sm tracking-wide transition-all cursor-pointer active:scale-[0.98]"
            >
              <Users className="w-4 h-4 text-[#FAF7F1]" />
              <span>{isJoining ? 'Connecting to Room...' : 'Join Screening Room'}</span>
            </button>

            <p className="text-[11px] text-[#9c978b] px-1 font-mono">
              Rooms work between tabs of one browser. Cross-device rooms need a server.
            </p>
          </div>
        </div>
      </div>

      {/* Hero CTA Smooth-Scroll Trigger */}
      <div className="mt-12 text-center">
        <button
          onClick={onScrollToListings}
          className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] hover:border-[#FAF7F1]/30 text-xs sm:text-sm font-medium text-[#FAF7F1] transition-all cursor-pointer shadow-md font-topic"
        >
          <span>Explore Available Screenings</span>
          <ArrowDown className="w-4 h-4 text-[#FAF7F1] group-hover:translate-y-0.5 transition-transform" />
        </button>
      </div>
    </section>
  );
};
