/**
 * Input validation shared by the UI and the data layer.
 *
 * Everything here runs in the browser, so it only protects honest users from mistakes and keeps
 * the UI tidy. The rules that actually protect the data live in database.rules.json and are
 * enforced by Firebase. Where both exist (video URLs, room codes) tests check that they agree.
 */

/** Reactions viewers can send. The keys are what is stored; the emoji are only for display. */
export const REACTIONS = {
  popcorn: '🍿',
  fire: '🔥',
  clap: '👏',
  shock: '😱',
  heart: '❤️',
} as const;

export type ReactionKind = keyof typeof REACTIONS;

export const REACTION_KINDS = Object.keys(REACTIONS) as ReactionKind[];

export function isReactionKind(value: unknown): value is ReactionKind {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(REACTIONS, value);
}

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

// ---------------------------------------------------------------------------------------------
// Room codes
// ---------------------------------------------------------------------------------------------

/** Crockford base32: digits and letters without I, L, O and U, so codes are easy to read aloud. */
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const ROOM_CODE_LENGTH = 10;
const ROOM_CODE_PATTERN = /^[0-9A-HJKMNP-TV-Z]{10}$/;

/**
 * Generates a random room code with 50 bits of entropy. The alphabet has 32 symbols, which divides
 * 256 evenly, so taking the low 5 bits of each random byte introduces no bias.
 */
export function generateRoomCode(): string {
  const bytes = new Uint8Array(ROOM_CODE_LENGTH);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b & 31]).join('');
}

/**
 * Turns what a person typed or pasted into a canonical room code, or returns null.
 * Accepts lower case, spaces and dashes ("abcde-fghjk"), and applies the Crockford rules for
 * look-alike characters (O reads as 0; I and L read as 1).
 */
export function validateRoomCode(input: string): string | null {
  if (typeof input !== 'string' || input.length > 64) return null;
  const normalised = input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  return ROOM_CODE_PATTERN.test(normalised) ? normalised : null;
}

/** "ABCDEFGHJK" -> "ABCDE-FGHJK" for display. */
export function formatRoomCode(code: string): string {
  return code.length === ROOM_CODE_LENGTH ? `${code.slice(0, 5)}-${code.slice(5)}` : code;
}

// ---------------------------------------------------------------------------------------------
// Video links
// ---------------------------------------------------------------------------------------------

const BLOCKED_HOST_SUFFIXES = ['.local', '.localhost', '.internal', '.lan', '.intranet', '.corp', '.home', '.arpa'];

/**
 * Checks whether a host-provided video link is acceptable, and returns it in normalised form.
 *
 * Accepts only https:// links on public-looking domain names: no credentials, no raw IP addresses
 * (the URL parser turns decimal, hex and octal forms such as https://2130706433 into dotted
 * quads, so those are caught too), and no single-label or internal-style hostnames.
 *
 * Limits: this runs in the browser and cannot resolve DNS, so a public name that points at a
 * private address is not detected. It also cannot stop the video host from seeing the IP address
 * of every viewer who loads the video; only use sources you trust.
 */
export function checkMediaUrl(rawUrl: string): { ok: true; url: string } | { ok: false; error: string } {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return { ok: false, error: 'URL cannot be empty.' };
  }

  const trimmed = rawUrl.trim();
  if (trimmed.length > 2048) {
    return { ok: false, error: 'URL exceeds maximum allowable length of 2048 characters.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: 'Invalid URL format. Please provide a valid web address.' };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, error: 'Only secure HTTPS video URLs are supported.' };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, error: 'URLs with embedded credentials are not allowed.' };
  }

  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  const isIpLiteral = host.startsWith('[') || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
  const isInternalName = !host.includes('.') || BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
  // The database rules require the host to end in a letters-only label (a real top-level domain).
  const hasPublicSuffix = /\.[a-z]{2,}$/.test(host);

  if (isIpLiteral || isInternalName || !hasPublicSuffix) {
    return { ok: false, error: 'Use a public website address (no IP addresses or internal hostnames).' };
  }

  // href is the parsed, normalised form (lower-case host, punycode for non-ASCII names, escaped path)
  const href = parsed.href;
  if (/[\s"'<>\\]/.test(href) || href.length > 2048) {
    return { ok: false, error: 'This link contains characters that are not allowed.' };
  }

  return { ok: true, url: href };
}

/** Boolean convenience wrapper around checkMediaUrl. */
export function isSafeMediaUrl(rawUrl: string): { valid: boolean; error?: string } {
  const result = checkMediaUrl(rawUrl);
  return result.ok ? { valid: true } : { valid: false, error: result.error };
}

// ---------------------------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------------------------

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
 * Client-side sliding window rate limiter to throttle user actions (chat spam, sync bursts).
 * This only protects the local UI: anything running in a browser can be bypassed, and Realtime
 * Database rules cannot rate-limit appends, so see the README for server-side options.
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
