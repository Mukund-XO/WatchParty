import {
  get,
  limitToLast,
  onChildAdded,
  onChildRemoved,
  onDisconnect,
  onValue,
  push,
  query,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
} from 'firebase/database';
import type { ChatEntry, ControlMode, Member, RoomMeta, RoomReaction } from '../types';
import { checkMediaUrl, generateRoomCode, sanitizeSingleLine, sanitizeTextInput, type ReactionKind } from '../utils/security';
import { getFirebase } from './firebase';
import type { PlaybackState } from './playbackSync';
import { parseChat, parseMembers, parseMeta, parsePlayback, parseReaction } from './roomData';

export type RoomErrorCode = 'not-signed-in' | 'invalid-input' | 'denied' | 'create-failed' | 'network';

/** An error with a message that is safe and useful to show to the person using the app. */
export class RoomError extends Error {
  constructor(
    public readonly code: RoomErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'RoomError';
  }
}

function isPermissionDenied(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  return /permission[_ -]?denied/i.test(`${e?.code ?? ''} ${e?.message ?? ''}`);
}

function currentUid(): string {
  const uid = getFirebase().auth.currentUser?.uid;
  if (!uid) throw new RoomError('not-signed-in', 'Still connecting. Try again in a moment.');
  return uid;
}

const roomRef = (code: string, path = '') => ref(getFirebase().db, `rooms/${code}${path ? `/${path}` : ''}`);

// ---------------------------------------------------------------------------------------------
// Creating and finding rooms
// ---------------------------------------------------------------------------------------------

export interface NewRoom {
  title: string;
  videoUrl: string;
  videoTitle: string;
  controlMode: ControlMode;
}

/** Creates a room with the signed-in user as host and returns its code. */
export async function createRoom(input: NewRoom): Promise<string> {
  const uid = currentUid();

  const url = checkMediaUrl(input.videoUrl);
  if (!url.ok) throw new RoomError('invalid-input', url.error);
  const title = sanitizeSingleLine(input.title, 80);
  const videoTitle = sanitizeSingleLine(input.videoTitle, 80);
  if (!title || !videoTitle) throw new RoomError('invalid-input', 'Give the room and the video a name.');

  // A collision with an existing room is refused by the rules (rooms cannot be overwritten), so a
  // permission error is retried with a new code. With 50-bit codes this practically never happens.
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateRoomCode();
    try {
      await set(roomRef(code, 'meta'), {
        hostUid: uid,
        title,
        videoUrl: url.url,
        videoTitle,
        controlMode: input.controlMode,
        createdAt: serverTimestamp(),
      });
      return code;
    } catch (error) {
      if (!isPermissionDenied(error)) {
        throw new RoomError('network', 'Could not reach the server. Check your connection and try again.');
      }
    }
  }
  throw new RoomError(
    'create-failed',
    'The server refused to create the room. If you run this site yourself, check that the database rules are deployed.',
  );
}

/** Returns the room's details, or null if it does not exist or has expired. */
export async function fetchRoomMeta(code: string): Promise<RoomMeta | null> {
  try {
    const snapshot = await get(roomRef(code, 'meta'));
    return snapshot.exists() ? parseMeta(snapshot.val()) : null;
  } catch (error) {
    // The rules deny reads of rooms that do not exist or have expired, which looks like this
    if (isPermissionDenied(error)) return null;
    throw new RoomError('network', 'Could not reach the server. Check your connection and try again.');
  }
}

// ---------------------------------------------------------------------------------------------
// Presence
// ---------------------------------------------------------------------------------------------

export interface Presence {
  rename(name: string): void;
  leave(): Promise<void>;
}

/**
 * Adds the signed-in user to the room's member list and removes them again when they leave or lose
 * their connection. Re-registers automatically after a reconnect.
 */
export function joinRoom(code: string, name: string, onError: (error: unknown) => void): Presence {
  const uid = currentUid();
  const { db } = getFirebase();
  const memberRef = roomRef(code, `members/${uid}`);
  let displayName = sanitizeSingleLine(name, 40) || 'Guest';
  let active = true;

  const register = async () => {
    await onDisconnect(memberRef).remove();
    await set(memberRef, { name: displayName, joinedAt: serverTimestamp() });
  };

  const stop = onValue(ref(db, '.info/connected'), (snapshot) => {
    if (snapshot.val() === true && active) register().catch(onError);
  });

  return {
    rename(next) {
      const clean = sanitizeSingleLine(next, 40);
      if (!clean || clean === displayName) return;
      displayName = clean;
      if (active) set(memberRef, { name: displayName, joinedAt: serverTimestamp() }).catch(onError);
    },
    async leave() {
      active = false;
      stop();
      try {
        await onDisconnect(memberRef).cancel();
        await remove(memberRef);
      } catch {
        // Already disconnected: the server removes the member itself
      }
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Listening
// ---------------------------------------------------------------------------------------------

type Stop = () => void;
type OnError = (error: unknown) => void;

export function watchMeta(code: string, cb: (meta: RoomMeta | null) => void, onError: OnError): Stop {
  return onValue(roomRef(code, 'meta'), (s) => cb(s.exists() ? parseMeta(s.val()) : null), onError);
}

export function watchPlayback(code: string, cb: (state: PlaybackState | null) => void, onError: OnError): Stop {
  return onValue(roomRef(code, 'playback'), (s) => cb(s.exists() ? parsePlayback(s.val()) : null), onError);
}

export function watchMembers(code: string, cb: (members: Member[]) => void, onError: OnError): Stop {
  return onValue(roomRef(code, 'members'), (s) => cb(parseMembers(s.val())), onError);
}

export function watchBanned(code: string, uid: string, cb: (banned: boolean) => void, onError: OnError): Stop {
  return onValue(roomRef(code, `banned/${uid}`), (s) => cb(s.val() === true), onError);
}

/** Calls `onAdd` for the most recent messages and then for each new one; `onRemove` when the host deletes one. */
export function watchChat(
  code: string,
  onAdd: (entry: ChatEntry) => void,
  onRemove: (id: string) => void,
  onError: OnError,
): Stop {
  const q = query(roomRef(code, 'chat'), limitToLast(200));
  const stopAdd = onChildAdded(
    q,
    (s) => {
      const entry = s.key ? parseChat(s.key, s.val()) : null;
      if (entry) onAdd(entry);
    },
    onError,
  );
  const stopRemove = onChildRemoved(q, (s) => s.key && onRemove(s.key), onError);
  return () => {
    stopAdd();
    stopRemove();
  };
}

/** Calls `cb` for recent and new reactions. The caller decides which are fresh enough to show. */
export function watchReactions(code: string, cb: (reaction: RoomReaction) => void, onError: OnError): Stop {
  return onChildAdded(
    query(roomRef(code, 'reactions'), limitToLast(20)),
    (s) => {
      const reaction = s.key ? parseReaction(s.key, s.val()) : null;
      if (reaction) cb(reaction);
    },
    onError,
  );
}

/** Milliseconds to add to the local clock to get the server's clock. */
export function watchServerOffset(cb: (offsetMs: number) => void): Stop {
  return onValue(ref(getFirebase().db, '.info/serverTimeOffset'), (s) => {
    const value = s.val();
    cb(typeof value === 'number' && Number.isFinite(value) ? value : 0);
  });
}

export function watchConnected(cb: (connected: boolean) => void): Stop {
  return onValue(ref(getFirebase().db, '.info/connected'), (s) => cb(s.val() === true));
}

// ---------------------------------------------------------------------------------------------
// Acting
// ---------------------------------------------------------------------------------------------

/** Moves the shared playhead. The rules only allow this for people who may control the room. */
export function writePlayback(code: string, playing: boolean, position: number): Promise<void> {
  const clamped = Math.max(0, Math.min(86_400, Number.isFinite(position) ? position : 0));
  return set(roomRef(code, 'playback'), {
    playing,
    position: clamped,
    updatedAt: serverTimestamp(),
    by: currentUid(),
  });
}

export function writeControlMode(code: string, mode: ControlMode): Promise<void> {
  return set(roomRef(code, 'meta/controlMode'), mode);
}

export function postChat(code: string, name: string, text: string, videoTime?: number): Promise<void> {
  const clean = sanitizeTextInput(text, 300);
  if (!clean) return Promise.resolve();
  const entry: Record<string, unknown> = {
    uid: currentUid(),
    name: sanitizeSingleLine(name, 40),
    text: clean,
    at: serverTimestamp(),
  };
  if (typeof videoTime === 'number' && Number.isFinite(videoTime)) {
    entry.videoTime = Math.max(0, Math.min(86_400, Math.floor(videoTime)));
  }
  return set(push(roomRef(code, 'chat')), entry);
}

export function deleteChat(code: string, id: string): Promise<void> {
  return remove(roomRef(code, `chat/${id}`));
}

const REACTION_LIFETIME_MS = 6000;

export async function postReaction(code: string, kind: ReactionKind): Promise<void> {
  const entry = push(roomRef(code, 'reactions'));
  await set(entry, { uid: currentUid(), kind, at: serverTimestamp() });
  // Reactions are momentary; tidy up after ourselves
  setTimeout(() => {
    remove(entry).catch(() => {});
  }, REACTION_LIFETIME_MS);
}

/** Host only: removes a viewer and stops them rejoining with the same browser profile. */
export function removeViewer(code: string, uid: string): Promise<void> {
  return update(roomRef(code), { [`banned/${uid}`]: true, [`members/${uid}`]: null });
}
