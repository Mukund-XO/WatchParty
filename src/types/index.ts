export interface UserAccount {
  /** Firebase anonymous-auth uid. Empty until sign-in has finished. */
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

/** Who may play, pause and seek for the whole room. */
export type ControlMode = 'host' | 'everyone';

/** Fixed facts about a room, written once when it is created. */
export interface RoomMeta {
  hostUid: string;
  title: string;
  videoUrl: string;
  videoTitle: string;
  controlMode: ControlMode;
  /** Server time in ms. */
  createdAt: number;
}

export interface Member {
  uid: string;
  name: string;
  /** Server time in ms. */
  joinedAt: number;
}

export interface ChatEntry {
  id: string;
  uid: string;
  name: string;
  text: string;
  /** Server time in ms. */
  at: number;
  /** Where in the video the message was sent, in seconds. */
  videoTime?: number;
}

export interface RoomReaction {
  id: string;
  uid: string;
  kind: 'popcorn' | 'fire' | 'clap' | 'shock' | 'heart';
  /** Server time in ms. */
  at: number;
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
