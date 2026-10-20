import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Copy,
  Check,
  MessageSquare,
  BookOpen,
  Users,
  ArrowLeft,
  Share2,
  RotateCcw,
  Send,
  Radio,
  WifiOff,
  Crown,
  X,
  Loader2,
  TriangleAlert,
  Lock,
} from 'lucide-react';
import { RoomReaction } from '../types';
import { useAuth } from '../context/AuthContext';
import { MOVIES_CATALOG } from '../data/movies';
import { PlaybackSync, type SyncReport } from '../lib/playbackSync';
import { useRoomSession } from '../lib/useRoomSession';
import { REACTIONS, REACTION_KINDS, RateLimiter, formatRoomCode, sanitizeTextInput, type ReactionKind } from '../utils/security';

interface WatchRoomViewProps {
  code: string;
  onLeaveRoom: () => void;
}

interface FloatingReaction {
  id: string;
  emoji: string;
  x: number;
}

const NOTES_MAX = 5000;
const notesKey = (code: string) => `watchparty_notes_${code}`;

function loadNotes(code: string): string {
  try {
    return (localStorage.getItem(notesKey(code)) ?? '').slice(0, NOTES_MAX);
  } catch {
    return '';
  }
}

function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '00:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const mm = m.toString().padStart(2, '0');
  const ss = s.toString().padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const SYNC_LABELS: Record<SyncReport['status'], string> = {
  loading: 'Loading video...',
  synced: 'In sync',
  'catching-up': 'Catching up...',
  waiting: 'Paused',
  'needs-tap': 'Tap to join',
};

export const WatchRoomView: React.FC<WatchRoomViewProps> = ({ code, onLeaveRoom }) => {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const syncRef = useRef<PlaybackSync | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const reactionTimers = useRef<number[]>([]);
  const chatLimiter = useRef(new RateLimiter(6, 3000));
  const reactionLimiter = useRef(new RateLimiter(5, 3000));

  const [currentTime, setCurrentTime] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [report, setReport] = useState<SyncReport>({ status: 'loading', drift: 0, target: 0 });
  const [needsTap, setNeedsTap] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'viewers' | 'notes'>('chat');
  const [chatInput, setChatInput] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [floating, setFloating] = useState<FloatingReaction[]>([]);
  const [notes, setNotes] = useState(() => loadNotes(code));

  const onReaction = useCallback((reaction: RoomReaction) => {
    const id = `${reaction.id}`;
    const x = 20 + Math.random() * 60;
    setFloating((prev) => [...prev.slice(-12), { id, emoji: REACTIONS[reaction.kind], x }]);
    const timer = window.setTimeout(() => setFloating((prev) => prev.filter((r) => r.id !== id)), 2000);
    reactionTimers.current.push(timer);
  }, []);

  const session = useRoomSession(code, user.id, user.name, onReaction);
  const { status, meta, playback, members, chat, connected, isHost, canControl, actions, serverNow } = session;

  const isPlaying = playback?.playing ?? false;
  const hostName = meta ? (members.find((m) => m.uid === meta.hostUid)?.name ?? 'Host') : '';
  const film = meta ? MOVIES_CATALOG.find((m) => m.videoUrl === meta.videoUrl) : undefined;

  // ------------------------------------------------------------------------------------------
  // Keeping the video in step with the room
  // ------------------------------------------------------------------------------------------

  const latestPlayback = useRef(playback);
  latestPlayback.current = playback;

  // Start the sync engine when the <video> exists (the room has loaded)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || status !== 'ready') return;

    const sync = new PlaybackSync(video, serverNow, setNeedsTap);
    syncRef.current = sync;
    sync.setState(latestPlayback.current);
    setReport(sync.tick());

    const interval = window.setInterval(() => setReport(sync.tick()), 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') setReport(sync.tick());
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      syncRef.current = null;
    };
  }, [status, serverNow]);

  // Apply every change to the shared playhead immediately
  useEffect(() => {
    const sync = syncRef.current;
    if (!sync) return;
    sync.setState(playback);
    setReport(sync.tick());
  }, [playback]);

  // Clean up timers, and keep the chat scrolled to the newest message
  useEffect(() => () => reactionTimers.current.forEach((t) => window.clearTimeout(t)), []);
  useEffect(() => {
    if (activeTab === 'chat') chatEndRef.current?.scrollIntoView({ block: 'end' });
  }, [chat.length, activeTab]);

  // Notes stay on this device only
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        if (notes) localStorage.setItem(notesKey(code), notes);
        else localStorage.removeItem(notesKey(code));
      } catch {
        // Storage may be blocked; notes then last only for this visit
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [notes, code]);

  // ------------------------------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------------------------------

  const fail = (message: string) => {
    setActionError(message);
    window.setTimeout(() => setActionError((current) => (current === message ? null : current)), 4000);
  };

  const runAction = (promise: Promise<unknown>, message = 'That did not go through. Check your connection and try again.') => {
    promise.catch(() => fail(message));
  };

  const CONTROL_DENIED = 'Only the host can control playback in this room.';

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (!canControl) return fail(CONTROL_DENIED);
    const atEnd = video.ended || (Number.isFinite(video.duration) && video.currentTime >= video.duration - 0.5);
    runAction(actions.setPlayback(!isPlaying, atEnd ? 0 : video.currentTime), CONTROL_DENIED);
  };

  const commitSeek = () => {
    if (scrub === null) return;
    const target = scrub;
    setScrub(null);
    if (!canControl) return fail(CONTROL_DENIED);
    runAction(actions.setPlayback(isPlaying, target), CONTROL_DENIED);
  };

  const jumpToTimecode = (seconds: number) => {
    if (!canControl) return;
    const bounded = Math.max(0, Math.min(duration || 86_400, seconds));
    runAction(actions.setPlayback(isPlaying, bounded), CONTROL_DENIED);
  };

  const forceResync = () => {
    const sync = syncRef.current;
    if (!sync) return;
    sync.setState(playback);
    setReport(sync.tick());
  };

  const sendReaction = (kind: ReactionKind) => {
    if (!reactionLimiter.current.canProceed()) return;
    runAction(actions.sendReaction(kind));
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const text = sanitizeTextInput(chatInput, 300);
    if (!text) return;
    if (!chatLimiter.current.canProceed()) return fail('Slow down a little: too many messages at once.');
    runAction(actions.sendChat(text, currentTime), 'Message not sent. Check your connection and try again.');
    setChatInput('');
  };

  const copy = async (what: 'code' | 'link') => {
    const text = what === 'code' ? code : `${window.location.origin}${window.location.pathname}#room=${code}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      fail('Could not copy. Select the text and copy it by hand.');
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const changeVolume = (value: number) => {
    const video = videoRef.current;
    setVolume(value);
    if (video) {
      video.volume = value;
      if (value > 0 && video.muted) {
        video.muted = false;
        setIsMuted(false);
      }
    }
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      stageRef.current?.requestFullscreen?.().catch(() => {});
    }
  };

  const confirmRemove = (uid: string, name: string) => {
    if (window.confirm(`Remove ${name} from this room? They will not be able to rejoin with the same browser.`)) {
      runAction(actions.removeViewer(uid), 'Could not remove that viewer.');
    }
  };

  // ------------------------------------------------------------------------------------------
  // Screens other than the room itself
  // ------------------------------------------------------------------------------------------

  if (status !== 'ready' || !meta) {
    const message =
      status === 'not-found'
        ? { title: 'Room not found', body: 'This code is not an active room. It may have been mistyped, or the room is more than 24 hours old.' }
        : status === 'removed'
          ? { title: 'Removed from room', body: 'The host removed you from this room.' }
          : status === 'error'
            ? { title: 'Could not open the room', body: session.error ?? 'Something went wrong. Try again.' }
            : null;

    return (
      <div className="flex-1 flex items-center justify-center p-6">
        {message ? (
          <div role="alert" className="max-w-md text-center space-y-4">
            <TriangleAlert className="w-8 h-8 mx-auto text-amber-300" />
            <h1 className="font-topic text-xl font-bold text-[#FAF7F1]">{message.title}</h1>
            <p className="text-sm text-[#9c978b]">{message.body}</p>
            <button
              onClick={onLeaveRoom}
              className="px-5 py-2.5 rounded-xl bg-[#FAF7F1] text-[#090a0d] text-xs font-topic font-bold cursor-pointer hover:bg-white"
            >
              Back to lobby
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-[#9c978b]">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Joining room {formatRoomCode(code)}...</span>
          </div>
        )}
      </div>
    );
  }

  const sliderValue = scrub ?? currentTime;
  const shownDrift = Math.abs(report.drift);

  return (
    <div className="flex-1 bg-[#090a0d] flex flex-col">
      {/* Room header */}
      <div className="bg-[#0f1117] border-b border-white/[0.08] px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onLeaveRoom}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#9c978b] hover:text-[#FAF7F1] border border-white/10 text-xs font-medium transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Leave</span>
            </button>
            <div className="min-w-0">
              <h1 className="font-topic text-sm font-bold text-[#FAF7F1] leading-tight truncate">{meta.title}</h1>
              <div className="flex items-center gap-2 text-[11px] text-[#9c978b] font-mono">
                <span className="truncate">{meta.videoTitle}</span>
                <span>·</span>
                <span className="truncate">Host: {hostName}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {!connected ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-400/30 text-amber-200 text-xs font-mono">
                <WifiOff className="w-3.5 h-3.5" />
                <span>Reconnecting...</span>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-[#FAF7F1] text-xs font-mono" aria-live="polite">
                <Radio className="w-3.5 h-3.5" />
                <span>{SYNC_LABELS[report.status]}</span>
                {report.status === 'catching-up' && shownDrift >= 0.5 && <span className="text-[#9c978b]">({shownDrift.toFixed(1)}s)</span>}
              </div>
            )}

            <div className="flex items-center rounded-xl bg-black/60 border border-[#FAF7F1]/30 overflow-hidden text-xs">
              <div className="px-3 py-1.5 font-mono font-bold text-[#FAF7F1] tracking-wider">{formatRoomCode(code)}</div>
              <button
                onClick={() => copy('code')}
                aria-label="Copy room code"
                className="px-2.5 py-1.5 hover:bg-white/[0.08] text-[#9c978b] hover:text-[#FAF7F1] border-l border-white/10 transition-colors flex items-center gap-1 cursor-pointer"
              >
                {copied === 'code' ? <Check className="w-3.5 h-3.5 text-[#FAF7F1]" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="text-[11px] font-medium hidden sm:inline">{copied === 'code' ? 'Copied' : 'Code'}</span>
              </button>
            </div>

            <button
              onClick={() => copy('link')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-medium text-[#FAF7F1] transition-colors cursor-pointer"
            >
              {copied === 'link' ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copied === 'link' ? 'Link copied' : 'Invite'}</span>
            </button>

            {isHost && (
              <button
                onClick={() => runAction(actions.setControlMode(meta.controlMode === 'host' ? 'everyone' : 'host'), 'Could not change the setting.')}
                title="Choose who can play, pause and seek"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-medium text-[#FAF7F1] transition-colors cursor-pointer"
              >
                {meta.controlMode === 'host' ? <Lock className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                <span>{meta.controlMode === 'host' ? 'Only you control' : 'Everyone controls'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {actionError && (
        <div className="px-4 sm:px-6 pt-4">
          <div role="alert" className="max-w-7xl mx-auto px-4 py-2.5 rounded-xl border border-rose-400/30 bg-rose-500/10 text-rose-200 text-xs">
            {actionError}
          </div>
        </div>
      )}

      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Player */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div
            ref={stageRef}
            className="relative group rounded-3xl bg-black border border-white/10 overflow-hidden shadow-2xl aspect-video flex items-center justify-center"
          >
            <video
              ref={videoRef}
              src={meta.videoUrl}
              preload="auto"
              playsInline
              onClick={togglePlayPause}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onDurationChange={(e) => setDuration(e.currentTarget.duration)}
              onLoadedMetadata={(e) => {
                setVideoError(false);
                setDuration(e.currentTarget.duration);
                e.currentTarget.volume = volume;
                const sync = syncRef.current;
                if (sync) setReport(sync.tick());
              }}
              onCanPlay={() => {
                const sync = syncRef.current;
                if (sync) setReport(sync.tick());
              }}
              onSeeked={() => {
                const sync = syncRef.current;
                if (sync) setReport(sync.tick());
              }}
              onError={() => setVideoError(true)}
              className="w-full h-full object-contain cursor-pointer"
            />

            {videoError && (
              <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/85 p-6 text-center">
                <TriangleAlert className="w-6 h-6 text-amber-300" />
                <p className="text-sm text-[#FAF7F1] font-medium">This video could not be loaded.</p>
                <p className="text-xs text-[#9c978b] max-w-sm">The link may be broken, blocked by the video host, or not a direct MP4/WebM file.</p>
              </div>
            )}

            {needsTap && !videoError && (
              <button
                onClick={() => syncRef.current?.resume()}
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-[#FAF7F1] cursor-pointer"
              >
                <span className="w-16 h-16 rounded-full bg-[#FAF7F1] text-[#090a0d] flex items-center justify-center">
                  <Play className="w-7 h-7 fill-current ml-1" />
                </span>
                <span className="font-topic text-sm font-bold">Tap to join playback</span>
                <span className="text-xs text-[#9c978b]">Your browser needs a tap before it can play the video.</span>
              </button>
            )}

            {!isPlaying && !needsTap && !videoError && (
              <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/60 border border-white/10 text-[11px] text-[#FAF7F1] font-mono pointer-events-none">
                {canControl ? 'Press play to start for everyone' : 'Waiting for the host to press play'}
              </div>
            )}

            {/* Floating reactions */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
              {floating.map((reaction) => (
                <div
                  key={reaction.id}
                  style={{ left: `${reaction.x}%` }}
                  className="absolute bottom-16 text-3xl sm:text-4xl animate-bounce duration-1000 transform -translate-x-1/2 transition-all opacity-90 drop-shadow-lg"
                >
                  {reaction.emoji}
                </div>
              ))}
            </div>

            {/* Controls */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 opacity-90 group-hover:opacity-100 transition-opacity flex flex-col gap-2">
              <input
                type="range"
                aria-label="Seek"
                min={0}
                max={duration || 100}
                step={0.1}
                value={Math.min(sliderValue, duration || 100)}
                disabled={!canControl}
                onChange={(e) => setScrub(parseFloat(e.target.value))}
                onPointerUp={commitSeek}
                onPointerCancel={commitSeek}
                onKeyUp={commitSeek}
                onBlur={commitSeek}
                title={canControl ? undefined : CONTROL_DENIED}
                className="w-full h-1.5 bg-white/20 rounded-lg appearance-none accent-[#FAF7F1] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              />

              <div className="flex items-center justify-between text-xs text-[#FAF7F1] pt-1">
                <div className="flex items-center gap-4">
                  <button
                    onClick={togglePlayPause}
                    aria-label={isPlaying ? 'Pause for everyone' : 'Play for everyone'}
                    disabled={!canControl}
                    title={canControl ? undefined : CONTROL_DENIED}
                    className="p-2 rounded-xl bg-[#FAF7F1] hover:bg-white text-[#090a0d] font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                  </button>

                  <div className="font-mono text-xs text-[#FAF7F1]">
                    <span>{formatSeconds(sliderValue)}</span>
                    <span className="text-[#9c978b] mx-1">/</span>
                    <span className="text-[#9c978b]">{formatSeconds(duration)}</span>
                  </div>

                  <button
                    onClick={forceResync}
                    className="flex items-center gap-1.5 text-xs text-[#9c978b] hover:text-[#FAF7F1] transition-colors ml-2 cursor-pointer"
                    title="Jump straight to where the room is"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Resync</span>
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleMute}
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                    className="p-1.5 text-[#9c978b] hover:text-[#FAF7F1] transition-colors cursor-pointer"
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <input
                    type="range"
                    aria-label="Volume (only for you)"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => changeVolume(parseFloat(e.target.value))}
                    className="hidden sm:block w-20 h-1 bg-white/20 rounded-lg appearance-none accent-[#FAF7F1] cursor-pointer"
                  />
                  <button
                    onClick={toggleFullscreen}
                    aria-label="Toggle fullscreen"
                    className="p-1.5 text-[#9c978b] hover:text-[#FAF7F1] transition-colors cursor-pointer"
                  >
                    <Maximize className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Reactions */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-[#0f1117] border border-white/[0.08]">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#9c978b] font-medium hidden sm:inline font-topic">Reactions:</span>
              {REACTION_KINDS.map((kind) => (
                <button
                  key={kind}
                  onClick={() => sendReaction(kind)}
                  aria-label={`Send ${kind} reaction`}
                  className="px-2.5 py-1 text-lg rounded-xl bg-white/[0.04] hover:bg-white/[0.1] hover:scale-110 active:scale-95 transition-all cursor-pointer"
                >
                  {REACTIONS[kind]}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-[#9c978b]">
              <Users className="w-3.5 h-3.5 text-[#FAF7F1]" />
              <span>
                {members.length} watching
              </span>
            </div>
          </div>

          {film?.credit && (
            <p className="text-[11px] text-[#9c978b]/80 px-1">
              {film.creditUrl ? (
                <a href={film.creditUrl} target="_blank" rel="noopener noreferrer" className="hover:text-[#FAF7F1] underline underline-offset-2">
                  {film.credit}
                </a>
              ) : (
                film.credit
              )}
            </p>
          )}
        </div>

        {/* Side panel */}
        <div className="lg:col-span-4 flex flex-col rounded-3xl bg-[#0f1117] border border-white/10 overflow-hidden shadow-xl min-h-[520px]">
          <div role="tablist" className="flex items-center border-b border-white/[0.08] bg-black/20 p-2 gap-1.5">
            {(
              [
                { id: 'chat', label: 'Chat', icon: MessageSquare },
                { id: 'viewers', label: `Viewers (${members.length})`, icon: Users },
                { id: 'notes', label: 'Notes', icon: BookOpen },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={activeTab === id}
                onClick={() => setActiveTab(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-topic font-semibold transition-all cursor-pointer ${
                  activeTab === id ? 'bg-white/[0.08] text-[#FAF7F1] border border-white/10' : 'text-[#9c978b] hover:text-[#FAF7F1]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 text-[#FAF7F1]" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {activeTab === 'chat' && (
            <div className="flex-1 flex flex-col justify-between p-4 relative notebook-ruled-lines min-h-0">
              <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 max-h-[400px] custom-scrollbar" aria-live="polite">
                {chat.length === 0 ? (
                  <div className="text-center py-12 text-xs text-[#9c978b]">No messages yet. Say hello!</div>
                ) : (
                  chat.map((msg) => (
                    <div key={msg.id} className="text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-topic font-semibold text-[#FAF7F1] truncate">
                          {msg.name}
                          {msg.uid === meta.hostUid && <Crown className="inline w-3 h-3 ml-1 -mt-0.5 text-amber-300" aria-label="Host" />}
                          {msg.uid === user.id && <span className="text-[#9c978b] font-normal"> (you)</span>}
                        </span>
                        <div className="flex items-center gap-1.5 font-mono text-[10px] text-[#9c978b] shrink-0">
                          {msg.videoTime !== undefined &&
                            (canControl ? (
                              <button
                                onClick={() => jumpToTimecode(msg.videoTime!)}
                                className="text-[#FAF7F1] hover:underline cursor-pointer"
                                title="Jump everyone to this moment"
                              >
                                [{formatSeconds(msg.videoTime)}]
                              </button>
                            ) : (
                              <span>[{formatSeconds(msg.videoTime)}]</span>
                            ))}
                          <span>{formatClock(msg.at)}</span>
                          {isHost && (
                            <button
                              onClick={() => runAction(actions.removeChat(msg.id), 'Could not delete that message.')}
                              aria-label="Delete message"
                              className="text-[#9c978b] hover:text-rose-300 cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      {/* React escapes this text, so messages can never run as HTML */}
                      <p className="text-[#FAF7F1] leading-relaxed bg-black/30 p-2 rounded-xl border border-white/[0.04] break-words whitespace-pre-wrap">
                        {msg.text}
                      </p>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={handleSendChat} className="pt-3 border-t border-white/[0.08] mt-2 flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  maxLength={300}
                  aria-label="Message"
                  placeholder="Write a note... (tags the video time)"
                  className="flex-1 px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-xs text-[#FAF7F1] focus:outline-none focus:border-[#FAF7F1]"
                />
                <button
                  type="submit"
                  aria-label="Send message"
                  className="p-2 rounded-xl bg-[#FAF7F1] hover:bg-white text-[#090a0d] transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          )}

          {activeTab === 'viewers' && (
            <ul className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {members.map((member) => (
                <li
                  key={member.uid}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-black/30 border border-white/[0.05] text-xs"
                >
                  <span className="flex items-center gap-2 min-w-0 text-[#FAF7F1]">
                    <span className="w-6 h-6 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center font-bold text-[10px] shrink-0">
                      {member.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="truncate">{member.name}</span>
                    {member.uid === meta.hostUid && <Crown className="w-3 h-3 text-amber-300 shrink-0" aria-label="Host" />}
                    {member.uid === user.id && <span className="text-[#9c978b]">(you)</span>}
                  </span>
                  {isHost && member.uid !== user.id && (
                    <button
                      onClick={() => confirmRemove(member.uid, member.name)}
                      className="text-[11px] text-[#9c978b] hover:text-rose-300 cursor-pointer shrink-0"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
              {members.length === 0 && <li className="text-center py-12 text-xs text-[#9c978b]">Nobody here yet.</li>}
            </ul>
          )}

          {activeTab === 'notes' && (
            <div className="flex-1 flex flex-col p-4 relative notebook-ruled-lines">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.06]">
                <span className="font-topic text-[11px] font-mono text-[#FAF7F1] uppercase tracking-wide">Private notes</span>
                <span className="text-[11px] text-[#9c978b]">Saved on this device only</span>
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, NOTES_MAX))}
                rows={14}
                aria-label="Private notes"
                className="w-full flex-1 bg-transparent border-0 text-xs text-[#FAF7F1] font-mono leading-relaxed resize-none focus:outline-none custom-scrollbar p-1"
                placeholder="Jot down thoughts and timestamps. Only you can see these."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
