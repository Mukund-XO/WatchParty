import type { MovieItem } from '../types';
import { MOVIES_CATALOG, buildCustomMovie } from '../data/movies';
import { isSafeMediaUrl, sanitizeSingleLine, validateRoomCode } from './security';

/**
 * Rooms are remembered in localStorage, so a room can only be joined from the browser that
 * created it (for example from a second tab). Rooms that reach other devices need a server.
 *
 * Only small, validated fields are stored, and everything is re-validated when it is read back,
 * so a tampered record cannot inject an unsafe video URL or oversized text.
 */
export interface RoomRecord {
  code: string;
  title: string;
  hostName: string;
  movie: MovieItem;
  createdAt: number;
}

interface StoredRoom {
  title: string;
  hostName: string;
  movieId?: string;
  customVideo?: { url: string; title: string };
  createdAt: number;
}

const KEY_PREFIX = 'watchparty_room_';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_STORED_CHARS = 8192;

export function saveRoomRecord(record: RoomRecord): void {
  const isCatalogFilm = MOVIES_CATALOG.some((m) => m.id === record.movie.id);
  const stored: StoredRoom = {
    title: record.title,
    hostName: record.hostName,
    createdAt: record.createdAt,
    ...(isCatalogFilm
      ? { movieId: record.movie.id }
      : { customVideo: { url: record.movie.videoUrl, title: record.movie.title } }),
  };

  try {
    localStorage.setItem(KEY_PREFIX + record.code, JSON.stringify(stored));
  } catch {
    return; // Storage full or blocked: the room still works in this tab
  }
  pruneExpiredRooms();
}

export function loadRoomRecord(rawCode: string): RoomRecord | null {
  const code = validateRoomCode(rawCode);
  if (!code) return null;

  try {
    const raw = localStorage.getItem(KEY_PREFIX + code);
    if (!raw || raw.length > MAX_STORED_CHARS) return null;

    const parsed = JSON.parse(raw) as Partial<StoredRoom> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.createdAt !== 'number' || Date.now() - parsed.createdAt > MAX_AGE_MS) return null;

    let movie: MovieItem | undefined;
    if (typeof parsed.movieId === 'string') {
      movie = MOVIES_CATALOG.find((m) => m.id === parsed.movieId);
    } else if (
      parsed.customVideo &&
      typeof parsed.customVideo.url === 'string' &&
      isSafeMediaUrl(parsed.customVideo.url).valid
    ) {
      movie = buildCustomMovie(parsed.customVideo.url, String(parsed.customVideo.title ?? ''));
    }
    if (!movie) return null;

    return {
      code,
      title: sanitizeSingleLine(String(parsed.title ?? ''), 80) || `${movie.title} Watch Party`,
      hostName: sanitizeSingleLine(String(parsed.hostName ?? ''), 40) || 'Host',
      movie,
      createdAt: parsed.createdAt,
    };
  } catch {
    return null;
  }
}

function pruneExpiredRooms(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(KEY_PREFIX)) continue;
      let createdAt: unknown;
      try {
        createdAt = JSON.parse(localStorage.getItem(key) ?? 'null')?.createdAt;
      } catch {
        createdAt = undefined;
      }
      if (typeof createdAt !== 'number' || Date.now() - createdAt > MAX_AGE_MS) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Cleanup is best-effort
  }
}
