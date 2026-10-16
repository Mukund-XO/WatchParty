export interface UserAccount {
  id: string;
  name: string;
  email: string;
  studentId: string;
  avatar: string;
  role: 'student' | 'club_lead' | 'host';
  isGuest: boolean;
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
  posterUrl: string;
  videoUrl: string;
  curatorNote?: string;
  activeRoomsCount: number;
  tags: string[];
}

export interface RoomViewer {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  joinedAt: number;
  pingMs: number;
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
  hostId: string;
  hostName: string;
  movie: MovieItem;
  isPlaying: boolean;
  currentTime: number;
  lastUpdated: number;
  viewers: RoomViewer[];
  chatMessages: ChatMessage[];
  isHost: boolean;
}

export interface SyncAction {
  type: 'PLAY' | 'PAUSE' | 'SEEK' | 'CHAT' | 'REACTION' | 'PING';
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

