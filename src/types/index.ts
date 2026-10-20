export interface UserAccount {
  /** Random per-tab id, regenerated on every page load. Never persisted. */
  id: string;
  name: string;
  avatar: string;
}

export interface MovieItem {
  id: string;
  title: string;
  subtitle: string;
  duration: string;
  year: number;
  genre: string;
  director: string;
  description: string;
  posterUrl?: string;
  videoUrl: string;
  /** Attribution line shown next to the film (copyright holder and licence). */
  credit?: string;
  creditUrl?: string;
  tags: string[];
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  timestamp: string;
  videoTimestamp?: number;
  reactionEmoji?: string;
}

export interface WatchRoom {
  id: string; // 6-digit code
  title: string;
  hostName: string;
  movie: MovieItem;
  chatMessages: ChatMessage[];
}

export interface SyncAction {
  type: 'PLAY' | 'PAUSE' | 'SEEK' | 'CHAT' | 'REACTION' | 'PING' | 'SYNC_REQUEST';
  roomId: string;
  senderId: string;
  currentTime?: number;
  playbackRate?: number;
  timestamp: number;
  payload?: any;
}

export interface TopBarTheme {
  id: string;
  name: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  accentColor: string;
}

export interface AccentPreset {
  id: string;
  name: string;
  hex: string;
  isDefault?: boolean;
}
