import React, { useState } from 'react';
import { Play, KeyRound, ArrowDown, Users, Film, ArrowRight } from 'lucide-react';
import { ROOM_CODE_LENGTH, validateRoomCode } from '../utils/security';

interface HeroSectionProps {
  onCreateRoom: () => void;
  /** Returns an error message to display, or null when the room is being opened. */
  onJoinRoom: (code: string) => string | null;
  onScrollToListings: () => void;
  /** False until the visitor is signed in; the buttons wait for it. */
  ready: boolean;
}

/** Shows what the person types as "ABCDE-FGHJK", without ever storing the dash. */
function formatForInput(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, ROOM_CODE_LENGTH);
  return cleaned.length > 5 ? `${cleaned.slice(0, 5)}-${cleaned.slice(5)}` : cleaned;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onCreateRoom, onJoinRoom, onScrollToListings, ready }) => {
  const [code, setCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const submitJoin = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!validateRoomCode(code)) {
      setErrorMsg('Enter the 10-character room code, for example 7K2QM-X9DPA.');
      return;
    }
    const error = onJoinRoom(code);
    if (error) setErrorMsg(error);
  };

  return (
    <section className="relative pt-10 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto notebook-grid-pattern">
      <div className="absolute left-4 sm:left-8 top-0 bottom-0 w-[1px] bg-[#FAF7F1]/10 pointer-events-none" />

      <div className="text-center max-w-3xl mx-auto pt-6 pb-12">
        <h1 className="font-topic text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#FAF7F1] tracking-tight leading-[1.1] mb-5 text-balance">
          Enjoy Every Frame With Friends.
        </h1>

        <p className="text-base sm:text-lg text-[#9c978b] leading-relaxed max-w-2xl mx-auto font-normal">
          Pick a video, share a private room code, and everyone's player stays in step: play, pause and seek together, with live chat and
          reactions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto my-2">
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

            <h2 className="font-topic text-2xl font-bold text-[#FAF7F1] mb-2 tracking-tight">Create a Watch Room</h2>
            <p className="text-sm text-[#9c978b] leading-relaxed mb-6">
              Choose a film from the library or paste a direct video link. You get a private code and an invite link to share.
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
              <span>Host or shared controls</span>
              <span className="text-[#FAF7F1]">Works across devices</span>
            </div>
          </div>
        </div>

        <form
          onSubmit={submitJoin}
          className="relative group rounded-3xl bg-[#0f1117] border border-white/10 hover:border-[#FAF7F1]/40 p-8 flex flex-col justify-between transition-all duration-300 shadow-xl shadow-black/40"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-[#FAF7F1] mb-6 group-hover:scale-105 transition-transform">
              <KeyRound className="w-5 h-5 text-[#FAF7F1]" />
            </div>

            <h2 className="font-topic text-2xl font-bold text-[#FAF7F1] mb-2 tracking-tight">Join with a Room Code</h2>
            <p className="text-sm text-[#9c978b] leading-relaxed mb-4">
              Enter the code your host shared, or just open their invite link.
            </p>

            <div className="my-4">
              <label htmlFor="room-code-input" className="sr-only">
                Room code
              </label>
              <input
                id="room-code-input"
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                value={code}
                onChange={(e) => {
                  setCode(formatForInput(e.target.value));
                  setErrorMsg('');
                }}
                placeholder="ABCDE-FGHJK"
                aria-invalid={errorMsg ? true : undefined}
                aria-describedby={errorMsg ? 'room-code-error' : undefined}
                className="w-full h-14 text-center text-xl font-bold font-mono tracking-[0.2em] text-[#FAF7F1] placeholder:text-[#9c978b]/40 bg-black/50 border border-white/15 focus:border-[var(--accent)] focus:bg-[var(--accent-subtle)] focus:ring-1 focus:ring-[var(--accent)] rounded-xl transition-all outline-none"
              />
              {errorMsg && (
                <p id="room-code-error" role="alert" className="text-xs text-rose-400 text-center mt-2 font-medium">
                  {errorMsg}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <button
              type="submit"
              disabled={!ready}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-white/[0.08] hover:bg-white/[0.14] text-[#FAF7F1] border border-white/15 hover:border-[var(--accent)]/60 font-topic font-semibold text-sm tracking-wide transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Users className="w-4 h-4 text-[#FAF7F1]" />
              <span>{ready ? 'Join Room' : 'Connecting...'}</span>
            </button>

            <p className="text-[11px] text-[#9c978b] px-1 font-mono">Codes are not case-sensitive. Dashes and spaces are ignored.</p>
          </div>
        </form>
      </div>

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
