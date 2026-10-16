import React, { useState, useEffect, useRef } from 'react';
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
import { sanitizeTextInput, RateLimiter } from '../utils/security';

interface WatchRoomViewProps {
  room: WatchRoom;
  onLeaveRoom: () => void;
}

interface FloatingReaction {
  id: string;
  emoji: string;
  x: number;
}

export const WatchRoomView: React.FC<WatchRoomViewProps> = ({ room, onLeaveRoom }) => {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'notes'>('chat');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(room.chatMessages);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing'>('synced');
  const [notes, setNotes] = useState<string>(
    `# ${room.movie.title} Screening Notes\n- Opening sequence establishes quiet mood\n- Sound design shift at 03:40\n- Discussion scheduled right after credits roll`
  );

  const syncChannelRef = useRef<SyncChannel | null>(null);
  const isBroadcastingRef = useRef(false);
  const chatLimiterRef = useRef(new RateLimiter(6, 3000));

  useEffect(() => {
    const handleRemoteAction = (action: SyncAction) => {
      if (action.senderId === user?.id) return;

      if (action.type === 'PLAY') {
        if (videoRef.current) {
          isBroadcastingRef.current = true;
          if (action.currentTime !== undefined && Math.abs(videoRef.current.currentTime - action.currentTime) > 0.3) {
            videoRef.current.currentTime = action.currentTime;
          }
          videoRef.current.play().catch(() => {});
          setIsPlaying(true);
          setTimeout(() => {
            isBroadcastingRef.current = false;
          }, 100);
        }
      } else if (action.type === 'PAUSE') {
        if (videoRef.current) {
          isBroadcastingRef.current = true;
          if (action.currentTime !== undefined) {
            videoRef.current.currentTime = action.currentTime;
          }
          videoRef.current.pause();
          setIsPlaying(false);
          setTimeout(() => {
            isBroadcastingRef.current = false;
          }, 100);
        }
      } else if (action.type === 'SEEK') {
        if (videoRef.current && action.currentTime !== undefined) {
          isBroadcastingRef.current = true;
          videoRef.current.currentTime = action.currentTime;
          setCurrentTime(action.currentTime);
          setTimeout(() => {
            isBroadcastingRef.current = false;
          }, 100);
        }
      } else if (action.type === 'CHAT') {
        if (action.payload) {
          setChatMessages((prev) => [...prev, action.payload]);
        }
      } else if (action.type === 'REACTION') {
        if (action.payload?.emoji) {
          triggerFloatingReaction(action.payload.emoji);
        }
      }
    };

    const channel = new SyncChannel(room.id, handleRemoteAction);
    syncChannelRef.current = channel;

    return () => {
      channel.destroy();
    };
  }, [room.id, user?.id]);

  const togglePlayPause = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
      syncChannelRef.current?.broadcast({
        type: 'PAUSE',
        senderId: user?.id || 'anon',
        currentTime: videoRef.current.currentTime,
      });
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
      syncChannelRef.current?.broadcast({
        type: 'PLAY',
        senderId: user?.id || 'anon',
        currentTime: videoRef.current.currentTime,
      });
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

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      syncChannelRef.current?.broadcast({
        type: 'SEEK',
        senderId: user?.id || 'anon',
        currentTime: newTime,
      });
    }
  };

  const jumpToTimecode = (seconds: number) => {
    if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return;
    const bounded = Math.max(0, Math.min(duration || 86400, seconds));

    if (videoRef.current) {
      videoRef.current.currentTime = bounded;
      setCurrentTime(bounded);
      syncChannelRef.current?.broadcast({
        type: 'SEEK',
        senderId: user?.id || 'anon',
        currentTime: bounded,
      });
    }
  };

  const forceResync = () => {
    setSyncStatus('syncing');
    if (videoRef.current) {
      syncChannelRef.current?.broadcast({
        type: isPlaying ? 'PLAY' : 'PAUSE',
        senderId: user?.id || 'anon',
        currentTime: videoRef.current.currentTime,
      });
    }
    setTimeout(() => setSyncStatus('synced'), 400);
  };

  const triggerFloatingReaction = (emoji: string) => {
    const safeEmoji = typeof emoji === 'string' ? emoji.slice(0, 8) : '🍿';
    const newReaction: FloatingReaction = {
      id: Math.random().toString(),
      emoji: safeEmoji,
      x: 20 + Math.random() * 60,
    };
    setFloatingReactions((prev) => [...prev, newReaction]);
    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== newReaction.id));
    }, 2000);
  };

  const sendReaction = (emoji: string) => {
    const safeEmoji = typeof emoji === 'string' ? emoji.slice(0, 8) : '🍿';
    triggerFloatingReaction(safeEmoji);
    syncChannelRef.current?.broadcast({
      type: 'REACTION',
      senderId: user?.id || 'anon',
      payload: { emoji: safeEmoji },
    });
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = sanitizeTextInput(chatInput, 300);
    if (!cleanText) return;

    // Rate-limit chat messages to stop message flooding / denial of service
    if (!chatLimiterRef.current.canProceed()) {
      return;
    }

    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      senderId: user?.id || 'anon',
      senderName: sanitizeTextInput(user?.name || 'Campus Viewer', 50),
      senderAvatar: '',
      text: cleanText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      videoTimestamp: Math.max(0, Math.floor(currentTime)),
    };

    setChatMessages((prev) => [...prev, newMsg]);
    syncChannelRef.current?.broadcast({
      type: 'CHAT',
      senderId: user?.id || 'anon',
      payload: newMsg,
    });
    setChatInput('');
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(room.id);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyRoomLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#room=${room.id}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const formatSeconds = (sec: number) => {
    if (isNaN(sec)) return '00:00';
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
            <video
              ref={videoRef}
              src={room.movie.videoUrl}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              className="w-full h-full object-contain cursor-pointer"
              onClick={togglePlayPause}
              playsInline
            />

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
                className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#FAF7F1]"
              />

              <div className="flex items-center justify-between text-xs text-[#FAF7F1] pt-1">
                <div className="flex items-center gap-4">
                  <button
                    onClick={togglePlayPause}
                    className="p-2 rounded-xl bg-[#FAF7F1] hover:bg-white text-[#090a0d] font-bold transition-all active:scale-95 cursor-pointer"
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
                    title="Force immediate timestamp sync"
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
              {['🍿', '🔥', '👏', '😱', '❤️'].map((emoji) => (
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
              <span>Real-time sync active</span>
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
                              title="Jump video to this timestamp"
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
                  placeholder="Note in margins... (auto-tags time)"
                  className="flex-1 px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-xs text-[#FAF7F1] focus:outline-none focus:border-[#FAF7F1]"
                />
                <button
                  type="submit"
                  className="p-2 rounded-xl bg-[#FAF7F1] hover:bg-white text-[#090a0d] transition-colors cursor-pointer"
                  title="Send message"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          ) : (
            /* Tab Content 2: Collaborative Screening Notes */
            <div className="flex-1 flex flex-col p-4 relative notebook-ruled-lines">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.06]">
                <span className="font-topic text-[11px] font-mono text-[#FAF7F1] uppercase tracking-wide">
                  Screening Journal Pad
                </span>
                <span className="text-[11px] text-[#9c978b]">Auto-saved locally</span>
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
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
