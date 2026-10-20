import type { SyncAction, ChatMessage } from '../types';

/** The only reactions a peer is allowed to send. Anything else is dropped. */
export const ALLOWED_REACTIONS: readonly string[] = ['🍿', '🔥', '👏', '😱', '❤️'];

/** Sync messages whose timestamp is further than this from the local clock are ignored (replay protection). */
const MAX_MESSAGE_AGE_MS = 2 * 60 * 1000;

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Random, URL-safe identifier such as "msg_3f2b...". Uses the Web Crypto API when available.
 */
export function randomId(prefix = 'id'): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}_${crypto.randomUUID()}`;
    }
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(12);
      crypto.getRandomValues(bytes);
      return `${prefix}_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
    }
  } catch {
    // fall through to the non-crypto fallback below
  }
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

const BLOCKED_HOST_SUFFIXES = ['.local', '.localhost', '.internal', '.lan', '.intranet', '.corp', '.home', '.home.arpa'];

/**
 * Checks whether a user-provided video URL is acceptable to load in a <video> element.
 *
 * Accepts only https:// URLs on public-looking domain names: no credentials in the URL,
 * no raw IP addresses (the URL parser also normalises decimal/hex/octal forms such as
 * https://2130706433 to 127.0.0.1, so those are caught too), and no single-label or
 * internal-style hostnames.
 *
 * Limits: this runs in the browser and cannot resolve DNS, so a public name that points at a
 * private address is not detected. It also cannot stop the video host from seeing the IP
 * address of every viewer who loads the video; only use sources you trust.
 */
export function isSafeMediaUrl(rawUrl: string): { valid: boolean; error?: string } {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return { valid: false, error: 'URL cannot be empty.' };
  }

  const trimmed = rawUrl.trim();

  if (trimmed.length > 2048) {
    return { valid: false, error: 'URL exceeds maximum allowable length of 2048 characters.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Invalid URL format. Please provide a valid web address.' };
  }

  if (parsed.protocol !== 'https:') {
    return { valid: false, error: 'Only secure HTTPS video URLs are supported.' };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, error: 'URLs with embedded credentials are not allowed.' };
  }

  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  const isIpLiteral = host.startsWith('[') || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
  const isInternalName = !host.includes('.') || BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));

  if (isIpLiteral || isInternalName) {
    return { valid: false, error: 'Use a public website address (no IP addresses or internal hostnames).' };
  }

  return { valid: true };
}

// Control characters, zero-width space, BOM and bidirectional overrides (used to visually spoof names).
const UNSAFE_TEXT_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F​‪-‮⁦-⁩﻿]/g;

/**
 * Sanitizes generic user text input (messages, notes).
 * Removes control and direction-override characters and enforces length bounds.
 * Keeps newlines and tabs.
 */
export function sanitizeTextInput(input: string, maxLength = 300): string {
  if (typeof input !== 'string') return '';
  return input.replace(UNSAFE_TEXT_CHARS, '').trim().slice(0, maxLength);
}

/**
 * Like sanitizeTextInput, but collapses all whitespace (including newlines) so the result is a
 * single line. Use for names and titles.
 */
export function sanitizeSingleLine(input: string, maxLength = 50): string {
  if (typeof input !== 'string') return '';
  return sanitizeTextInput(input, maxLength * 4).replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

/**
 * Validates and strictly extracts a 6-digit room code.
 */
export function validateRoomCode(input: string): string | null {
  if (typeof input !== 'string') return null;
  const digitsOnly = input.replace(/\D/g, '');
  if (digitsOnly.length === 6 && /^[0-9]{6}$/.test(digitsOnly)) {
    return digitsOnly;
  }
  return null;
}

/**
 * Validates an incoming sync message from BroadcastChannel or LocalStorage.
 * Whitelists message types, bounds every number, rebuilds the payload from scratch and
 * rejects stale or far-future messages.
 */
export function validateSyncAction(raw: unknown, expectedRoomId: string): SyncAction | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const candidate = raw as Record<string, unknown>;

  // Room verification
  if (candidate.roomId !== expectedRoomId) {
    return null;
  }

  // Type verification (whitelist)
  const allowedTypes = ['PLAY', 'PAUSE', 'SEEK', 'CHAT', 'REACTION', 'PING', 'SYNC_REQUEST'];
  if (typeof candidate.type !== 'string' || !allowedTypes.includes(candidate.type)) {
    return null;
  }

  // Sender verification
  if (typeof candidate.senderId !== 'string' || !ID_PATTERN.test(candidate.senderId)) {
    return null;
  }

  // Timestamp must be a finite number close to the local clock (stops replays of old messages)
  if (
    typeof candidate.timestamp !== 'number' ||
    !Number.isFinite(candidate.timestamp) ||
    Math.abs(Date.now() - candidate.timestamp) > MAX_MESSAGE_AGE_MS
  ) {
    return null;
  }

  // Timecode sanity bounds (0 to 24 hours)
  let currentTime: number | undefined;
  if (candidate.currentTime !== undefined) {
    if (
      typeof candidate.currentTime !== 'number' ||
      !Number.isFinite(candidate.currentTime) ||
      candidate.currentTime < 0 ||
      candidate.currentTime > 86400
    ) {
      return null;
    }
    currentTime = candidate.currentTime;
  }

  // Payload verification: rebuild the payload from validated fields only
  let sanitizedPayload: unknown = undefined;
  if (candidate.type === 'CHAT') {
    if (!candidate.payload || typeof candidate.payload !== 'object') return null;
    const p = candidate.payload as Record<string, unknown>;
    const text = sanitizeTextInput(String(p.text || ''), 300);
    const senderName = sanitizeSingleLine(String(p.senderName || 'Anonymous'), 50) || 'Anonymous';
    if (!text) return null;

    sanitizedPayload = {
      id: sanitizeSingleLine(String(p.id || randomId('msg')), 64),
      // Always the real sender of the sync message; a peer cannot claim another peer's id.
      senderId: candidate.senderId,
      senderName,
      senderAvatar: '',
      text,
      timestamp: sanitizeSingleLine(String(p.timestamp || ''), 20),
      videoTimestamp:
        typeof p.videoTimestamp === 'number' && Number.isFinite(p.videoTimestamp)
          ? Math.max(0, Math.min(86400, Math.floor(p.videoTimestamp)))
          : undefined,
    } as ChatMessage;
  } else if (candidate.type === 'REACTION') {
    if (!candidate.payload || typeof candidate.payload !== 'object') return null;
    const emoji = (candidate.payload as Record<string, unknown>).emoji;
    if (typeof emoji !== 'string' || !ALLOWED_REACTIONS.includes(emoji)) {
      return null;
    }
    sanitizedPayload = { emoji };
  }

  return {
    type: candidate.type as SyncAction['type'],
    roomId: candidate.roomId as string,
    senderId: candidate.senderId,
    currentTime,
    timestamp: candidate.timestamp,
    payload: sanitizedPayload,
  };
}

/**
 * Client-side sliding window rate limiter to throttle user actions (chat spam, sync bursts).
 * This only protects the local UI: anything running in a browser can be bypassed, so a real
 * server must enforce its own limits.
 */
export class RateLimiter {
  private timestamps: number[] = [];
  private maxOperations: number;
  private timeWindowMs: number;

  constructor(maxOperations = 10, timeWindowMs = 2000) {
    this.maxOperations = maxOperations;
    this.timeWindowMs = timeWindowMs;
  }

  public canProceed(): boolean {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < this.timeWindowMs);
    if (this.timestamps.length >= this.maxOperations) {
      return false;
    }
    this.timestamps.push(now);
    return true;
  }
}
