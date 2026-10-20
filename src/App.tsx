import React, { useState, useEffect, useRef } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TopBar } from './components/TopBar';
import { HeroSection } from './components/HeroSection';
import { ListingsGrid } from './components/ListingsGrid';
import { HowSyncWorks } from './components/HowSyncWorks';
import { Footer } from './components/Footer';
import { CreateRoomModal } from './components/CreateRoomModal';
import { WatchRoomView } from './components/WatchRoomView';
import { WatchRoom, MovieItem } from './types';
import { validateRoomCode, sanitizeSingleLine, randomId } from './utils/security';
import { loadRoomRecord, saveRoomRecord } from './utils/roomRegistry';

const formatCode = (code: string) => `${code.slice(0, 3)}-${code.slice(3)}`;
const clockLabel = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function setRoomHash(code: string | null) {
  const base = window.location.pathname + window.location.search;
  // replaceState does not fire "hashchange", so this never re-triggers the join handler
  window.history.replaceState(null, '', code ? `${base}#room=${code}` : base);
}

function MainApp() {
  const { user } = useAuth();
  const [activeRoom, setActiveRoom] = useState<WatchRoom | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [movieToHost, setMovieToHost] = useState<MovieItem | null>(null);
  const [joinNotice, setJoinNotice] = useState<string | null>(null);

  const handleScrollToListings = () => {
    const el = document.getElementById('listings-grid');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleCreateRoomClick = () => {
    setMovieToHost(null);
    setIsCreateModalOpen(true);
  };

  const handleSelectMovieToHost = (movie: MovieItem) => {
    setMovieToHost(movie);
    setIsCreateModalOpen(true);
  };

  const handleRoomCreated = ({
    code,
    title,
    movie,
    hostName,
  }: {
    code: string;
    title: string;
    movie: MovieItem;
    hostName?: string;
  }) => {
    setIsCreateModalOpen(false);
    setJoinNotice(null);

    const effectiveHostName = sanitizeSingleLine(hostName ?? '', 40) || user.name;

    // Remember the room so another tab of this browser can join it by code or link
    saveRoomRecord({ code, title, hostName: effectiveHostName, movie, createdAt: Date.now() });

    setActiveRoom({
      id: code,
      title,
      hostName: effectiveHostName,
      movie,
      chatMessages: [
        {
          id: randomId('msg'),
          senderId: 'system',
          senderName: 'Watch Party',
          senderAvatar: '',
          text: `Room ${formatCode(code)} is live. Open the invite link in another tab of this browser to watch in sync.`,
          timestamp: clockLabel(),
        },
      ],
    });
    setRoomHash(code);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /** Returns an error message to show the user, or null when the room was joined. */
  const handleJoinRoom = (code: string): string | null => {
    const validCode = validateRoomCode(code);
    if (!validCode) {
      return 'Please enter a valid 6-digit room passkey.';
    }

    const record = loadRoomRecord(validCode);
    if (!record) {
      return `No room ${formatCode(validCode)} found in this browser. Rooms currently only work between tabs of the browser that created them.`;
    }

    setJoinNotice(null);
    setActiveRoom({
      id: record.code,
      title: record.title,
      hostName: record.hostName,
      movie: record.movie,
      chatMessages: [
        {
          id: randomId('msg'),
          senderId: 'system',
          senderName: 'Watch Party',
          senderAvatar: '',
          text: `Joined room ${formatCode(record.code)}. Asking other tabs for the current playback position.`,
          timestamp: clockLabel(),
        },
      ],
    });
    setRoomHash(record.code);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return null;
  };

  const handleLeaveRoom = () => {
    setActiveRoom(null);
    setRoomHash(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Join from an invite link (#room=123456). Refs keep the listener pointed at the latest handler
  // and room without re-registering it on every render.
  const joinRef = useRef(handleJoinRoom);
  joinRef.current = handleJoinRoom;
  const activeRoomIdRef = useRef<string | null>(null);
  activeRoomIdRef.current = activeRoom?.id ?? null;

  useEffect(() => {
    const handleHash = () => {
      const match = window.location.hash.match(/^#room=(.*)$/);
      if (!match) return;

      const code = validateRoomCode(match[1]);
      if (code && code === activeRoomIdRef.current) return;

      const error = code ? joinRef.current(code) : 'That invite link does not contain a valid room code.';
      if (error) {
        setJoinNotice(error);
        setRoomHash(null);
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  return (
    <div className="min-h-screen bg-[#090a0d] text-[#FAF7F1] flex flex-col font-sans selection:bg-white/20 selection:text-white">
      {/* 1) Top Bar with Centered Clapperboard Logo, Clean Small Account Button on Right */}
      <TopBar
        onNavigateHome={handleLeaveRoom}
        onScrollToListings={handleScrollToListings}
        onCreateRoomClick={handleCreateRoomClick}
        onJoinRoomClick={() => {
          const el = document.getElementById('digit-input-0');
          el?.focus();
        }}
        inRoom={!!activeRoom}
        activeRoomId={activeRoom?.id}
      />

      {/* Main Content Area */}
      {activeRoom ? (
        <WatchRoomView room={activeRoom} onLeaveRoom={handleLeaveRoom} />
      ) : (
        <main className="flex-1">
          {joinNotice && (
            <div className="px-4 sm:px-6 lg:px-8 pt-6">
              <div
                role="alert"
                className="max-w-4xl mx-auto px-4 py-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 text-rose-200 text-xs flex items-center justify-between gap-3"
              >
                <span>{joinNotice}</span>
                <button
                  onClick={() => setJoinNotice(null)}
                  className="shrink-0 underline underline-offset-2 hover:text-white cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* 2) Main Hero with punchline "Enjoy Every Frame With Friends.", Space Grotesk topic font, and 2-button split */}
          <HeroSection
            onCreateRoom={handleCreateRoomClick}
            onJoinRoom={handleJoinRoom}
            onScrollToListings={handleScrollToListings}
          />

          {/* 3) Horizontal Slides Movies Section */}
          <ListingsGrid onSelectMovieToHost={handleSelectMovieToHost} />

          {/* 4) Sync Protocol */}
          <HowSyncWorks />
        </main>
      )}

      {/* Footer */}
      {!activeRoom && <Footer onScrollToListings={handleScrollToListings} />}

      {/* Create Room Drawer/Modal. Mounted only while open so every opening starts with a fresh
          room code and the film that was clicked. */}
      {isCreateModalOpen && (
        <CreateRoomModal
          isOpen
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
