import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  ArrowLeft,
  Share2,
  RotateCcw,
  Send,
  Radio,
  ShieldCheck,
} from 'lucide-react';
import { WatchRoom, ChatMessage, SyncAction } from '../types';
import { SyncChannel } from './SyncEngine';
import { useAuth } from '../context/AuthContext';
import {
  ALLOWED_REACTIONS,
  RateLimiter,
  isSafeMediaUrl,
  randomId,
  sanitizeSingleLine,
  sanitizeTextInput,
} from '../utils/security';

interface WatchRoomViewProps {
  room: WatchRoom;
  onLeaveRoom: () => void;
}

interface FloatingReaction {
  id: string;
  emoji: string;
  x: number;
}

const MAX_CHAT_MESSAGES = 500;
const MAX_NOTES_CHARS = 20000;
const SEEK_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'];

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard access is blocked on insecure origins or when permission is denied
    return false;
  }
}

export const WatchRoomView: React.FC<WatchRoomViewProps> = ({ room, onLeaveRoom }) => {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'notes'>('chat');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(room.chatMessages);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing'>('synced');

  const notesKey = `watchparty_notes_${room.id}`;
  const [notes, setNotes] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(notesKey);
      if (saved !== null) return saved.slice(0, MAX_NOTES_CHARS);
    } catch {
      // Storage unavailable: start with the default template
    }
    return `# ${room.movie.title} Screening Notes\n- Opening sequence establishes quiet mood\n- Sound design shift at 03:40\n- Discussion scheduled right after credits roll`;
  });

  const syncChannelRef = useRef<SyncChannel | null>(null);
  const chatLimiterRef = useRef(new RateLimiter(6, 3000));

  // Re-check the video URL at the point of use, not only when the room was created.
  const safeVideoUrl = useMemo(
    () => (isSafeMediaUrl(room.movie.videoUrl).valid ? room.movie.videoUrl : undefined),
    [room.movie.videoUrl]
  );

  // Notes are saved in this browser, per room
  useEffect(() => {
    try {
      localStorage.setItem(notesKey, notes.slice(0, MAX_NOTES_CHARS));
    } catch {
      // Storage full or blocked: notes stay in memory only
    }
  }, [notes, notesKey]);

  useEffect(() => {
    const applyRemoteAction = (action: SyncAction) => {
      const video = videoRef.current;

      switch (action.type) {
        case 'PLAY':
          if (video) {
            if (action.currentTime !== undefined && Math.abs(video.currentTime - action.currentTime) > 0.3) {
              video.currentTime = action.currentTime;
            }
            // May be rejected by the browser's autoplay policy; the video's own play/pause
            // events keep the UI state truthful either way.
            video.play().catch(() => {});
          }
          break;

        case 'PAUSE':
          if (video) {
            if (action.currentTime !== undefined) {
              video.currentTime = action.currentTime;
            }
            video.pause();
          }
          break;

        case 'SEEK':
          if (video && action.currentTime !== undefined) {
            video.currentTime = action.currentTime;
            setCurrentTime(action.currentTime);
          }
          break;

        case 'SYNC_REQUEST':
          // A tab that just joined asks for the current state. Answer with ours.
          if (video && video.readyState >= 1) {
            channel.broadcast({
              type: video.paused ? 'PAUSE' : 'PLAY',
              currentTime: video.currentTime,
            });
          }
          break;

        case 'CHAT': {
          const incoming = action.payload as ChatMessage | undefined;
          if (incoming) {
            setChatMessages((prev) =>
              prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming].slice(-MAX_CHAT_MESSAGES)
            );
          }
          break;
        }

        case 'REACTION':
          if (action.payload?.emoji) {
            triggerFloatingReaction(action.payload.emoji);
          }
          break;
      }
    };

    const channel = new SyncChannel(room.id, applyRemoteAction);
    syncChannelRef.current = channel;

    // If other tabs are already in this room, ask where they are
    channel.broadcast({ type: 'SYNC_REQUEST' });

    return () => {
      channel.destroy();
      if (syncChannelRef.current === channel) {
        syncChannelRef.current = null;
      }
    };
  }, [room.id]);

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      // Only tell the others to play if this tab actually managed to start
      video
        .play()
        .then(() => {
          syncChannelRef.current?.broadcast({ type: 'PLAY', currentTime: video.currentTime });
        })
        .catch(() => {});
    } else {
      video.pause();
      syncChannelRef.current?.broadcast({ type: 'PAUSE', currentTime: video.currentTime });
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      videoRef.current.volume = volume;
    }
  };

  // While dragging the slider only this tab moves. The new position is sent once, on release,
  // so the final position is never lost to the broadcast rate limit.
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (videoRef.current && Number.isFinite(newTime)) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const commitSeek = () => {
    if (videoRef.current) {
      syncChannelRef.current?.broadcast({ type: 'SEEK', currentTime: videoRef.current.currentTime });
    }
  };

  // Clicking a chat timestamp only moves this tab, so one message cannot yank everyone's video around.
  const jumpToTimecode = (seconds: number) => {
    if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return;
    const bounded = Math.max(0, Math.min(duration || 86400, seconds));

    if (videoRef.current) {
      videoRef.current.currentTime = bounded;
      setCurrentTime(bounded);
    }
  };

  // Pushes THIS tab's position and play state to every other tab in the room
  const forceResync = () => {
    setSyncStatus('syncing');
    if (videoRef.current) {
      syncChannelRef.current?.broadcast({
        type: videoRef.current.paused ? 'PAUSE' : 'PLAY',
        currentTime: videoRef.current.currentTime,
      });
    }
    setTimeout(() => setSyncStatus('synced'), 400);
  };

  const triggerFloatingReaction = (emoji: string) => {
    if (!ALLOWED_REACTIONS.includes(emoji)) return;
    const newReaction: FloatingReaction = {
      id: randomId('fx'),
      emoji,
      x: 20 + Math.random() * 60,
    };
    setFloatingReactions((prev) => [...prev, newReaction]);
    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== newReaction.id));
    }, 2000);
  };

  const sendReaction = (emoji: string) => {
    if (!ALLOWED_REACTIONS.includes(emoji)) return;
    triggerFloatingReaction(emoji);
    syncChannelRef.current?.broadcast({
      type: 'REACTION',
      payload: { emoji },
    });
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = sanitizeTextInput(chatInput, 300);
    if (!cleanText) return;

    // Rate-limit chat messages to stop message flooding
    if (!chatLimiterRef.current.canProceed()) {
      return;
    }

    const newMsg: ChatMessage = {
      id: randomId('msg'),
      senderId: user.id,
      senderName: sanitizeSingleLine(user.name || 'Viewer', 50),
      senderAvatar: '',
      text: cleanText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      videoTimestamp: Math.max(0, Math.floor(currentTime)),
    };

    setChatMessages((prev) => [...prev, newMsg].slice(-MAX_CHAT_MESSAGES));
    syncChannelRef.current?.broadcast({
      type: 'CHAT',
      payload: newMsg,
    });
    setChatInput('');
  };

  const copyRoomCode = async () => {
    if (await copyToClipboard(room.id)) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const copyRoomLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}#room=${room.id}`;
    if (await copyToClipboard(url)) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const formatSeconds = (sec: number) => {
    if (!Number.isFinite(sec)) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#090a0d] flex flex-col">
      {/* Room Navigation Sub-Header */}
      <div className="bg-[#0f1117] border-b border-white/[0.08] px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onLeaveRoom}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#9c978b] hover:text-[#FAF7F1] border border-white/10 text-xs font-medium transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Lobby</span>
            </button>
            <div>
              <h1 className="font-topic text-sm font-bold text-[#FAF7F1] leading-tight">
                {room.title}
              </h1>
              <div className="flex items-center gap-2 text-[11px] text-[#9c978b] font-mono">
                <span>{room.movie.title}</span>
                <span>·</span>
                <span>Host: {room.hostName}</span>
              </div>
            </div>
          </div>

          {/* 6-Digit Room Pass & Invite Controls */}
          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-[#FAF7F1] text-xs font-mono">
              <Radio className="w-3.5 h-3.5 text-[#FAF7F1] animate-pulse" />
              <span>{syncStatus === 'synced' ? 'Synchronized' : 'Syncing...'}</span>
            </div>

            {/* Room Code Badge */}
            <div className="flex items-center rounded-xl bg-black/60 border border-[#FAF7F1]/30 overflow-hidden text-xs">
              <div className="px-3 py-1.5 font-mono font-bold text-[#FAF7F1] tracking-wider">
                {room.id.slice(0, 3)}-{room.id.slice(3)}
              </div>
              <button
                onClick={copyRoomCode}
                className="px-2.5 py-1.5 hover:bg-white/[0.08] text-[#9c978b] hover:text-[#FAF7F1] border-l border-white/10 transition-colors flex items-center gap-1 cursor-pointer"
                title="Copy Passkey"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-[#FAF7F1]" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="text-[11px] font-medium hidden sm:inline">
                  {copiedCode ? 'Copied' : 'Passkey'}
                </span>
              </button>
            </div>

            <button
              onClick={copyRoomLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-medium text-[#FAF7F1] transition-colors cursor-pointer"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-[#FAF7F1]" /> : <Share2 className="w-3.5 h-3.5 text-[#FAF7F1]" />}
              <span>{copiedLink ? 'Link Copied' : 'Invite'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Watch Room Body */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Synchronized Video Player Area (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="relative group rounded-3xl bg-black border border-white/10 overflow-hidden shadow-2xl aspect-video flex items-center justify-center">
            {safeVideoUrl ? (
              <video
                ref={videoRef}
                src={safeVideoUrl}
                preload="metadata"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                className="w-full h-full object-contain cursor-pointer"
                onClick={togglePlayPause}
                playsInline
              />
            ) : (
              <p className="px-6 text-center text-xs text-rose-300">
                This video link was blocked because it is not a safe HTTPS address.
              </p>
            )}

            {/* Floating Live Reactions */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {floatingReactions.map((reaction) => (
                <div
                  key={reaction.id}
                  style={{ left: `${reaction.x}%` }}
                  className="absolute bottom-16 text-3xl sm:text-4xl animate-bounce duration-1000 transform -translate-x-1/2 transition-all opacity-90 drop-shadow-lg"
                >
                  {reaction.emoji}
                </div>
              ))}
            </div>

            {/* Playback overlay controls */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 opacity-90 group-hover:opacity-100 transition-opacity flex flex-col gap-2">
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                onPointerUp={commitSeek}
                onKeyUp={(e) => {
                  if (SEEK_KEYS.includes(e.key)) commitSeek();
                }}
                aria-label="Seek"
                className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#FAF7F1]"
              />

              <div className="flex items-center justify-between text-xs text-[#FAF7F1] pt-1">
                <div className="flex items-center gap-4">
                  <button
                    onClick={togglePlayPause}
                    className="p-2 rounded-xl bg-[#FAF7F1] hover:bg-white text-[#090a0d] font-bold transition-all active:scale-95 cursor-pointer"
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                  </button>

                  <div className="font-mono text-xs text-[#FAF7F1]">
                    <span>{formatSeconds(currentTime)}</span>
                    <span className="text-[#9c978b] mx-1">/</span>
                    <span className="text-[#9c978b]">{formatSeconds(duration)}</span>
                  </div>

                  <button
                    onClick={forceResync}
                    className="flex items-center gap-1.5 text-xs text-[#9c978b] hover:text-[#FAF7F1] transition-colors ml-2 cursor-pointer"
                    title="Send my position and play state to every tab in the room"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Force Sync</span>
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.muted = !isMuted;
                        setIsMuted(!isMuted);
                      }
                    }}
                    className="p-1.5 text-[#9c978b] hover:text-[#FAF7F1] transition-colors cursor-pointer"
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={() => {
                      if (videoRef.current) {
                        if (document.fullscreenElement) {
                          document.exitFullscreen();
                        } else {
                          videoRef.current.requestFullscreen();
                        }
                      }
                    }}
                    className="p-1.5 text-[#9c978b] hover:text-[#FAF7F1] transition-colors cursor-pointer"
                    aria-label="Toggle fullscreen"
                  >
                    <Maximize className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Reaction Bar */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-[#0f1117] border border-white/[0.08]">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#9c978b] font-medium hidden sm:inline font-topic">
                Reactions:
              </span>
              {ALLOWED_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => sendReaction(emoji)}
                  className="px-2.5 py-1 text-lg rounded-xl bg-white/[0.04] hover:bg-white/[0.1] hover:scale-110 active:scale-95 transition-all cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs text-[#9c978b]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#FAF7F1]" />
              <span>Syncs across tabs in this browser</span>
            </div>
          </div>
        </div>

        {/* Right Column: Campus Notebook Chat & Notes (4 cols) */}
        <div className="lg:col-span-4 flex flex-col rounded-3xl bg-[#0f1117] border border-white/10 overflow-hidden shadow-xl min-h-[520px]">
          {/* Tab Selector */}
          <div className="flex items-center border-b border-white/[0.08] bg-black/20 p-2 gap-1.5">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-topic font-semibold transition-all cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-white/[0.08] text-[#FAF7F1] border border-white/10'
                  : 'text-[#9c978b] hover:text-[#FAF7F1]'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#FAF7F1]" />
              <span>Room Chat</span>
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-topic font-semibold transition-all cursor-pointer ${
                activeTab === 'notes'
                  ? 'bg-white/[0.08] text-[#FAF7F1] border border-white/10'
                  : 'text-[#9c978b] hover:text-[#FAF7F1]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-[#FAF7F1]" />
              <span>Notebook</span>
            </button>
          </div>

          {/* Tab Content 1: Campus Chat */}
          {activeTab === 'chat' ? (
            <div className="flex-1 flex flex-col justify-between p-4 relative notebook-ruled-lines">
              <div className="absolute left-10 top-0 bottom-0 w-[1px] bg-white/[0.06] pointer-events-none" />

              <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 max-h-[400px] custom-scrollbar">
                {chatMessages.length === 0 ? (
                  <div className="text-center py-12 text-xs text-[#9c978b]">
                    No messages yet. Send a note or reaction!
                  </div>
                ) : (
                  chatMessages.map((msg) => (
                    <div key={msg.id} className="text-xs space-y-1 relative pl-5">
                      <div className="flex items-center justify-between">
                        <span className="font-topic font-semibold text-[#FAF7F1]">
                          {msg.senderName}
                        </span>
                        <div className="flex items-center gap-1.5 font-mono text-[10px] text-[#9c978b]">
                          {msg.videoTimestamp !== undefined && (
                            <button
                              onClick={() => jumpToTimecode(msg.videoTimestamp!)}
                              className="text-[#FAF7F1] hover:underline cursor-pointer"
                              title="Jump this tab's video to this timestamp"
                            >
                              [{formatSeconds(msg.videoTimestamp)}]
                            </button>
                          )}
                          <span>{msg.timestamp}</span>
                        </div>
                      </div>
                      <p className="text-[#FAF7F1] leading-relaxed bg-black/30 p-2 rounded-xl border border-white/[0.04]">
                        {msg.text}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendChat} className="pt-3 border-t border-white/[0.08] mt-2 flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  maxLength={300}
                  placeholder="Note in margins... (auto-tags time)"
                  className="flex-1 px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-xs text-[#FAF7F1] focus:outline-none focus:border-[#FAF7F1]"
                />
                <button
                  type="submit"
                  className="p-2 rounded-xl bg-[#FAF7F1] hover:bg-white text-[#090a0d] transition-colors cursor-pointer"
                  title="Send message"
                  aria-label="Send message"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          ) : (
            /* Tab Content 2: Screening Notes (saved in this browser, per room) */
            <div className="flex-1 flex flex-col p-4 relative notebook-ruled-lines">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.06]">
                <span className="font-topic text-[11px] font-mono text-[#FAF7F1] uppercase tracking-wide">
                  Screening Journal Pad
                </span>
                <span className="text-[11px] text-[#9c978b]">Saved in this browser</span>
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, MAX_NOTES_CHARS))}
                rows={14}
                className="w-full flex-1 bg-transparent border-0 text-xs text-[#FAF7F1] font-mono leading-relaxed resize-none focus:outline-none custom-scrollbar p-1"
                placeholder="Type your film critique, timestamps, and camera analysis..."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
