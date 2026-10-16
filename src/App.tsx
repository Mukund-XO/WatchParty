import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TopBar } from './components/TopBar';
import { HeroSection } from './components/HeroSection';
import { ListingsGrid } from './components/ListingsGrid';
import { HowSyncWorks } from './components/HowSyncWorks';
import { Footer } from './components/Footer';
import { CreateRoomModal } from './components/CreateRoomModal';
import { WatchRoomView } from './components/WatchRoomView';
import { MOVIES_CATALOG } from './data/movies';
import { WatchRoom, MovieItem } from './types';
import { validateRoomCode } from './utils/security';

function MainApp() {
  const { user } = useAuth();
  const [activeRoom, setActiveRoom] = useState<WatchRoom | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [movieToHost, setMovieToHost] = useState<MovieItem | null>(null);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#room=')) {
        const code = hash.replace('#room=', '').trim();
        if (code) {
          handleJoinRoom(code);
        }
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

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

    const effectiveHostName = hostName?.trim() || user?.name || 'Guest Host';

    const newRoom: WatchRoom = {
      id: code,
      title,
      hostId: user?.id || 'host_guest',
      hostName: effectiveHostName,
      movie,
      isPlaying: false,
      currentTime: 0,
      lastUpdated: Date.now(),
      viewers: [
        {
          id: user?.id || 'host_guest',
          name: effectiveHostName,
          avatar: user?.avatar || '',
          isHost: true,
          joinedAt: Date.now(),
          pingMs: 14,
        },
      ],
      chatMessages: [
        {
          id: 'welcome_msg',
          senderId: 'system',
          senderName: 'Watch Party',
          senderAvatar: '',
          text: `Welcome to "${title}". Room passkey is ${code.slice(0, 3)}-${code.slice(3)}. Playback is synchronized across all viewers.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ],
      isHost: true,
    };

    setActiveRoom(newRoom);
    window.location.hash = `room=${code}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleJoinRoom = (code: string) => {
    const validCode = validateRoomCode(code) || '842910';
    const movieIndex = Math.abs(parseInt(validCode, 10) || 0) % MOVIES_CATALOG.length;
    const selectedFilm = MOVIES_CATALOG[movieIndex] || MOVIES_CATALOG[0];

    const joinedRoom: WatchRoom = {
      id: validCode,
      title: `${selectedFilm.title} Screening`,
      hostId: 'host_peer',
      hostName: 'Host (Arjun K.)',
      movie: selectedFilm,
      isPlaying: false,
      currentTime: 0,
      lastUpdated: Date.now(),
      viewers: [
        {
          id: 'host_peer',
          name: 'Arjun K.',
          avatar: '',
          isHost: true,
          joinedAt: Date.now() - 600000,
          pingMs: 18,
        },
        {
          id: user?.id || 'usr_joined',
          name: user?.name || 'Guest Student',
          avatar: user?.avatar || '',
          isHost: false,
          joinedAt: Date.now(),
          pingMs: 12,
        },
      ],
      chatMessages: [
        {
          id: 'm1',
          senderId: 'host_peer',
          senderName: 'Arjun K.',
          senderAvatar: '',
          text: `Hey everyone, glad you made it! Starting the film now.`,
          timestamp: '19:42',
          videoTimestamp: 15,
        },
        {
          id: 'm2',
          senderId: 'system',
          senderName: 'Watch Party',
          senderAvatar: '',
          text: `Connected to room ${validCode}. Playback lock enabled.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ],
      isHost: false,
    };

    setActiveRoom(joinedRoom);
    window.location.hash = `room=${validCode}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLeaveRoom = () => {
    setActiveRoom(null);
    history.pushState('', document.title, window.location.pathname + window.location.search);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
          {/* 2) Main Hero with punchline "Enjoy Every Frame With Friends.", Space Grotesk topic font, and 2-button split */}
          <HeroSection
            onCreateRoom={handleCreateRoomClick}
            onJoinRoom={handleJoinRoom}
            onScrollToListings={handleScrollToListings}
          />

          {/* 3) Horizontal Slides Movies Section (Compact height, reduced AI image dependence) */}
          <ListingsGrid
            onSelectMovieToHost={handleSelectMovieToHost}
            onQuickJoinDemo={handleJoinRoom}
          />

          {/* 4) Sync Protocol */}
          <HowSyncWorks />
        </main>
      )}

      {/* Footer */}
      {!activeRoom && <Footer onScrollToListings={handleScrollToListings} />}

      {/* Create Room Drawer/Modal */}
      <CreateRoomModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onRoomCreated={handleRoomCreated}
        initialMovie={movieToHost}
      />
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
