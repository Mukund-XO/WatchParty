import type { ChatEntry, ControlMode, Member, RoomMeta, RoomReaction } from '../types';
import type { PlaybackState } from './playbackSync';
import { checkMediaUrl, isReactionKind, sanitizeSingleLine, sanitizeTextInput } from '../utils/security';

/**
 * Converts raw database values into the app's types.
 *
 * The database rules already reject malformed writes, but these parsers run on everything that
 * comes back anyway: if a rule is ever loosened by mistake, a bad record is dropped here instead
 * of reaching the UI or the video element.
 */

type Raw = Record<string, unknown>;

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isControlMode(value: unknown): value is ControlMode {
  return value === 'host' || value === 'everyone';
}

export function parseMeta(value: unknown): RoomMeta | null {
  if (!isRecord(value)) return null;
  const { hostUid, title, videoUrl, videoTitle, controlMode, createdAt } = value;
  if (typeof hostUid !== 'string' || !hostUid || hostUid.length > 128) return null;
  if (typeof videoUrl !== 'string') return null;
  const url = checkMediaUrl(videoUrl);
  if (!url.ok) return null;
  if (!isControlMode(controlMode) || !finite(createdAt)) return null;

  return {
    hostUid,
    title: sanitizeSingleLine(String(title ?? ''), 80) || 'Watch Party',
    videoUrl: url.url,
    videoTitle: sanitizeSingleLine(String(videoTitle ?? ''), 80) || 'Video',
    controlMode,
    createdAt,
  };
}

export function parsePlayback(value: unknown): PlaybackState | null {
  if (!isRecord(value)) return null;
  const { playing, position, updatedAt, by } = value;
  if (typeof playing !== 'boolean' || !finite(position) || !finite(updatedAt)) return null;
  if (position < 0 || position > 86_400) return null;
  return { playing, position, updatedAt, by: typeof by === 'string' ? by.slice(0, 128) : '' };
}

export function parseMembers(value: unknown): Member[] {
  if (!isRecord(value)) return [];
  const members: Member[] = [];
  for (const [uid, entry] of Object.entries(value)) {
    if (!isRecord(entry) || !finite(entry.joinedAt)) continue;
    const name = sanitizeSingleLine(String(entry.name ?? ''), 40);
    if (!name) continue;
    members.push({ uid, name, joinedAt: entry.joinedAt });
  }
  return members.sort((a, b) => a.joinedAt - b.joinedAt || a.uid.localeCompare(b.uid));
}

export function parseChat(id: string, value: unknown): ChatEntry | null {
  if (!isRecord(value) || typeof value.uid !== 'string' || !finite(value.at)) return null;
  const text = sanitizeTextInput(String(value.text ?? ''), 300);
  const name = sanitizeSingleLine(String(value.name ?? ''), 40);
  if (!text || !name) return null;
  return {
    id,
    uid: value.uid,
    name,
    text,
    at: value.at,
    videoTime: finite(value.videoTime) ? Math.max(0, Math.min(86_400, value.videoTime)) : undefined,
  };
}

export function parseReaction(id: string, value: unknown): RoomReaction | null {
  if (!isRecord(value) || typeof value.uid !== 'string' || !finite(value.at)) return null;
  if (!isReactionKind(value.kind)) return null;
  return { id, uid: value.uid, kind: value.kind, at: value.at };
}
