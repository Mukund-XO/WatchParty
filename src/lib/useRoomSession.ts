import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatEntry, ControlMode, Member, RoomMeta, RoomReaction } from '../types';
import type { ReactionKind } from '../utils/security';
import type { PlaybackState } from './playbackSync';
import {
  RoomError,
  deleteChat,
  fetchRoomMeta,
  joinRoom,
  postChat,
  postReaction,
  removeViewer,
  watchBanned,
  watchChat,
  watchConnected,
  watchMembers,
  watchMeta,
  watchPlayback,
  watchReactions,
  watchServerOffset,
  writeControlMode,
  writePlayback,
  type Presence,
} from './rooms';

export type SessionStatus = 'loading' | 'ready' | 'not-found' | 'removed' | 'error';

export interface RoomSession {
  status: SessionStatus;
  /** Message to show when status is "error". */
  error: string | null;
  meta: RoomMeta | null;
  members: Member[];
  chat: ChatEntry[];
  playback: PlaybackState | null;
  /** True while the connection to the server is up. */
  connected: boolean;
  isHost: boolean;
  /** True if this viewer may play, pause and seek for everyone. */
  canControl: boolean;
  /** Current server time in ms, from the local clock plus the measured offset. */
  serverNow: () => number;
  actions: {
    setPlayback(playing: boolean, position: number): Promise<void>;
    setControlMode(mode: ControlMode): Promise<void>;
    sendChat(text: string, videoTime?: number): Promise<void>;
    removeChat(id: string): Promise<void>;
    sendReaction(kind: ReactionKind): Promise<void>;
    removeViewer(uid: string): Promise<void>;
  };
}

const MAX_CHAT_IN_MEMORY = 300;
/** Ignore reactions older than this, so opening a room does not replay the last few minutes. */
const REACTION_MAX_AGE_MS = 5000;

function friendlyError(error: unknown): string {
  if (error instanceof RoomError) return error.message;
  return 'Something went wrong talking to the server. Check your connection and try again.';
}

/**
 * Joins a room and keeps everything about it up to date: details, members, chat, the shared
 * playhead and the connection state. Leaves the room again when the component unmounts.
 */
export function useRoomSession(
  code: string,
  uid: string,
  displayName: string,
  onReaction: (reaction: RoomReaction) => void,
): RoomSession {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<RoomMeta | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [chat, setChat] = useState<ChatEntry[]>([]);
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const [connected, setConnected] = useState(true);

  const offsetRef = useRef(0);
  const serverNow = useCallback(() => Date.now() + offsetRef.current, []);

  const reactionHandler = useRef(onReaction);
  reactionHandler.current = onReaction;
  const nameRef = useRef(displayName);
  nameRef.current = displayName;
  const presenceRef = useRef<Presence | null>(null);

  useEffect(() => {
    let cancelled = false;
    const stops: Array<() => void> = [];
    const fail = (e: unknown) => {
      if (cancelled) return;
      // A permission error after joining means the room expired or we were removed
      setError(friendlyError(e));
      setStatus((current) => (current === 'removed' || current === 'not-found' ? current : 'error'));
    };

    setStatus('loading');
    setError(null);
    setMeta(null);
    setMembers([]);
    setChat([]);
    setPlayback(null);

    (async () => {
      let initial: RoomMeta | null;
      try {
        initial = await fetchRoomMeta(code);
      } catch (e) {
        if (!cancelled) fail(e);
        return;
      }
      if (cancelled) return;
      if (!initial) {
        setStatus('not-found');
        return;
      }

      setMeta(initial);
      setStatus('ready');

      stops.push(watchServerOffset((offset) => (offsetRef.current = offset)));
      stops.push(watchConnected(setConnected));

      stops.push(
        watchMeta(
          code,
          (next) => {
            if (cancelled) return;
            if (next) setMeta(next);
            else setStatus('not-found'); // deleted or expired while we were watching
          },
          fail,
        ),
      );
      stops.push(watchPlayback(code, setPlayback, fail));
      stops.push(watchMembers(code, setMembers, fail));
      stops.push(
        watchBanned(
          code,
          uid,
          (banned) => {
            if (banned && !cancelled) setStatus('removed');
          },
          fail,
        ),
      );
      stops.push(
        watchChat(
          code,
          (entry) =>
            setChat((prev) =>
              prev.some((m) => m.id === entry.id) ? prev : [...prev, entry].sort((a, b) => a.at - b.at).slice(-MAX_CHAT_IN_MEMORY),
            ),
          (id) => setChat((prev) => prev.filter((m) => m.id !== id)),
          fail,
        ),
      );
      stops.push(
        watchReactions(
          code,
          (reaction) => {
            if (serverNow() - reaction.at <= REACTION_MAX_AGE_MS) reactionHandler.current(reaction);
          },
          fail,
        ),
      );

      try {
        presenceRef.current = joinRoom(code, nameRef.current, fail);
      } catch (e) {
        fail(e);
      }
    })();

    return () => {
      cancelled = true;
      stops.forEach((stop) => stop());
      presenceRef.current?.leave();
      presenceRef.current = null;
    };
  }, [code, uid, serverNow]);

  // Keep the member list's name current if the person edits their display name mid-room
  useEffect(() => {
    presenceRef.current?.rename(displayName);
  }, [displayName]);

  // Leave the room if we have been removed from it
  useEffect(() => {
    if (status === 'removed') {
      presenceRef.current?.leave();
      presenceRef.current = null;
    }
  }, [status]);

  const isHost = !!meta && meta.hostUid === uid;
  const canControl = isHost || (meta?.controlMode === 'everyone' && status === 'ready');

  const actions = useMemo<RoomSession['actions']>(
    () => ({
      setPlayback: (playing, position) => writePlayback(code, playing, position),
      setControlMode: (mode) => writeControlMode(code, mode),
      sendChat: (text, videoTime) => postChat(code, nameRef.current, text, videoTime),
      removeChat: (id) => deleteChat(code, id),
      sendReaction: (kind) => postReaction(code, kind),
      removeViewer: (target) => removeViewer(code, target),
    }),
    [code],
  );

  return { status, error, meta, members, chat, playback, connected, isHost, canControl, serverNow, actions };
}
