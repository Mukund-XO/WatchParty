import React, { useState, useEffect } from 'react';
import { Loader2, TriangleAlert } from 'lucide-react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TopBar } from './components/TopBar';
import { HeroSection } from './components/HeroSection';
import { ListingsGrid } from './components/ListingsGrid';
import { HowSyncWorks } from './components/HowSyncWorks';
import { Footer } from './components/Footer';
import { CreateRoomModal } from './components/CreateRoomModal';
import { WatchRoomView } from './components/WatchRoomView';
import { MovieItem } from './types';
import { validateRoomCode } from './utils/security';

function setRoomHash(code: string | null) {
  const base = window.location.pathname + window.location.search;
  // replaceState does not fire "hashchange", so this never re-triggers the hash handler
  window.history.replaceState(null, '', code ? `${base}#room=${code}` : base);
}

/** The room code in the address bar (#room=CODE), or null. Invalid codes count as "no room". */
function readRoomFromHash(): { code: string | null; invalid: boolean } {
  const match = window.location.hash.match(/^#room=(.*)$/);
  if (!match) return { code: null, invalid: false };
  let raw = match[1];
  try {
    raw = decodeURIComponent(raw);
  } catch {
    // keep the raw text; validation below rejects it
  }
  const code = validateRoomCode(raw);
  return { code, invalid: code === null };
}

function SetupNotice() {
  const { status, missingConfig, error, retry } = useAuth();
  if (status === 'ready') return null;

  if (status === 'connecting') {
    return (
      <div className="px-4 sm:px-6 lg:px-8 pt-6">
        <div className="max-w-4xl mx-auto flex items-center gap-2 text-xs text-[#9c978b]">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Connecting to the server...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-6">
      <div
        role="alert"
        className="max-w-4xl mx-auto px-4 py-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 text-amber-100 text-xs flex items-start gap-3"
      >
        <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="space-y-1.5">
          {status === 'unconfigured' ? (
            <>
              <p className="font-semibold">This site is not connected to a Firebase project yet.</p>
              <p>
                Copy <code className="font-mono">.env.example</code> to <code className="font-mono">.env.local</code> and fill in{' '}
                <span className="font-mono">{missingConfig.join(', ')}</span>. The README has the step-by-step setup.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold">{error ?? 'Could not connect.'}</p>
              <button onClick={retry} className="underline underline-offset-2 hover:text-white cursor-pointer">
                Try again
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MainApp() {
  const { status } = useAuth();
  const [roomCode, setRoomCode] = useState<string | null>(() => readRoomFromHash().code);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [movieToHost, setMovieToHost] = useState<MovieItem | null>(null);
  const [notice, setNotice] = useState<string | null>(() =>
    readRoomFromHash().invalid ? 'That invite link does not contain a valid room code.' : null,
  );

  const handleScrollToListings = () => {
    document.getElementById('listings-grid')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCreateRoomClick = () => {
    setMovieToHost(null);
    setIsCreateModalOpen(true);
  };

  const handleSelectMovieToHost = (movie: MovieItem) => {
    setMovieToHost(movie);
    setIsCreateModalOpen(true);
  };

  const openRoom = (code: string) => {
    setNotice(null);
    setRoomCode(code);
    setRoomHash(code);
    window.scrollTo({ top: 0 });
  };

  const handleRoomCreated = (code: string) => {
    setIsCreateModalOpen(false);
    openRoom(code);
  };

  /** Returns an error message to show the user, or null when the room is being opened. */
  const handleJoinRoom = (rawCode: string): string | null => {
    const code = validateRoomCode(rawCode);
    if (!code) return 'That is not a valid room code. Codes have 10 letters and numbers.';
    openRoom(code);
    return null;
  };

  const handleLeaveRoom = () => {
    setRoomCode(null);
    setRoomHash(null);
    window.scrollTo({ top: 0 });
  };

  // Follow the address bar: pasting an invite link into a tab that is already open switches rooms.
  useEffect(() => {
    const onHashChange = () => {
      const { code, invalid } = readRoomFromHash();
      if (invalid) {
        setNotice('That invite link does not contain a valid room code.');
        setRoomHash(null);
        setRoomCode(null);
      } else {
        setNotice(null);
        setRoomCode(code);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const inRoom = roomCode !== null && status === 'ready';

  return (
    <div className="min-h-screen bg-[#090a0d] text-[#FAF7F1] flex flex-col font-sans selection:bg-white/20 selection:text-white">
      <TopBar
        onNavigateHome={handleLeaveRoom}
        onScrollToListings={handleScrollToListings}
        onCreateRoomClick={handleCreateRoomClick}
        onJoinRoomClick={() => document.getElementById('room-code-input')?.focus()}
        inRoom={inRoom}
        activeRoomId={roomCode ?? undefined}
      />

      {inRoom && roomCode ? (
        // key: switching rooms starts a completely fresh session
        <WatchRoomView key={roomCode} code={roomCode} onLeaveRoom={handleLeaveRoom} />
      ) : (
        <main className="flex-1">
          {notice && (
            <div className="px-4 sm:px-6 lg:px-8 pt-6">
              <div
                role="alert"
                className="max-w-4xl mx-auto px-4 py-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 text-rose-200 text-xs flex items-center justify-between gap-3"
              >
                <span>{notice}</span>
                <button
                  onClick={() => setNotice(null)}
                  className="shrink-0 underline underline-offset-2 hover:text-white cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <SetupNotice />

          <HeroSection
            onCreateRoom={handleCreateRoomClick}
            onJoinRoom={handleJoinRoom}
            onScrollToListings={handleScrollToListings}
            ready={status === 'ready'}
          />

          <ListingsGrid onSelectMovieToHost={handleSelectMovieToHost} />

          <HowSyncWorks />
        </main>
      )}

      {!inRoom && <Footer onScrollToListings={handleScrollToListings} />}

      {/* Mounted only while open so every opening starts fresh with the film that was clicked. */}
      {isCreateModalOpen && (
        <CreateRoomModal
          onClose={() => setIsCreateModalOpen(false)}
          onRoomCreated={handleRoomCreated}
          initialMovie={movieToHost}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
