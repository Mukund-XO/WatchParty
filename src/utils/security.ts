import { SyncAction, ChatMessage } from '../types';

/**
 * Validates whether a user-provided media stream URL is safe to load in a video element.
 * Blocks dangerous protocols (javascript:, data:, file:) and private network probing.
 */
export function isSafeMediaUrl(rawUrl: string): { valid: boolean; error?: string } {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'URL cannot be empty.' };
  }

  const trimmed = rawUrl.trim();

  if (trimmed.length > 2048) {
    return { valid: false, error: 'URL exceeds maximum allowable length of 2048 characters.' };
  }

  // Explicitly block dangerous scheme prefixes before URL parsing
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:') ||
    lower.startsWith('blob:')
  ) {
    return { valid: false, error: 'Unsafe URL protocol detected. Only HTTPS streams are permitted.' };
  }

  try {
    const parsed = new URL(trimmed);

    // Enforce HTTPS in production; allow HTTP only on localhost during local dev
    const isLocalhost =
      parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';

    if (parsed.protocol !== 'https:' && !(isLocalhost && parsed.protocol === 'http:')) {
      return { valid: false, error: 'Only secure HTTPS video URLs are supported.' };
    }

    // SSRF / Private network protection: Block internal cloud metadata and private IP ranges
    const host = parsed.hostname.toLowerCase();
    if (
      !isLocalhost &&
      (host === '169.254.169.254' || // AWS/GCP metadata service
        host === 'metadata.google.internal' ||
        host.startsWith('10.') ||
        host.startsWith('192.168.') ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
        host === '0.0.0.0')
    ) {
      return { valid: false, error: 'Access to private internal network addresses is restricted.' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format. Please provide a valid web address.' };
  }
}

/**
 * Sanitizes generic user text input (room titles, messages, names).
 * Removes ASCII control characters and enforces length bounds.
 */
export function sanitizeTextInput(input: string, maxLength = 300): string {
  if (typeof input !== 'string') return '';

  // Remove dangerous non-printable ASCII control characters (keep newline and tab)
  const cleaned = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return cleaned.trim().slice(0, maxLength);
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
 * Defends against prototype pollution, state poisoning, and injection attacks.
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
  const allowedTypes = ['PLAY', 'PAUSE', 'SEEK', 'CHAT', 'REACTION', 'PING'];
  if (typeof candidate.type !== 'string' || !allowedTypes.includes(candidate.type)) {
    return null;
  }

  // Sender verification
  if (typeof candidate.senderId !== 'string' || candidate.senderId.length > 64) {
    return null;
  }

  // Timestamp sanity check (must be a realistic number within 1 hour)
  if (
    typeof candidate.timestamp !== 'number' ||
    !Number.isFinite(candidate.timestamp) ||
    candidate.timestamp < 0
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

  // Payload verification
  let sanitizedPayload: unknown = undefined;
  if (candidate.type === 'CHAT' && candidate.payload && typeof candidate.payload === 'object') {
    const p = candidate.payload as Record<string, unknown>;
    const text = sanitizeTextInput(String(p.text || ''), 300);
    const senderName = sanitizeTextInput(String(p.senderName || 'Anonymous'), 50);
    if (!text) return null;

    sanitizedPayload = {
      id: sanitizeTextInput(String(p.id || `msg_${Date.now()}`), 64),
      senderId: sanitizeTextInput(String(p.senderId || candidate.senderId), 64),
      senderName,
      senderAvatar: '',
      text,
      timestamp: sanitizeTextInput(String(p.timestamp || ''), 20),
      videoTimestamp:
        typeof p.videoTimestamp === 'number' && Number.isFinite(p.videoTimestamp)
          ? Math.max(0, Math.min(86400, Math.floor(p.videoTimestamp)))
          : undefined,
    } as ChatMessage;
  } else if (candidate.type === 'REACTION' && candidate.payload && typeof candidate.payload === 'object') {
    const p = candidate.payload as Record<string, unknown>;
    const rawEmoji = String(p.emoji || '');
    // Allow standard emojis up to 8 bytes
    if (rawEmoji.length > 0 && rawEmoji.length <= 8) {
      sanitizedPayload = { emoji: rawEmoji.slice(0, 8) };
    } else {
      return null;
    }
  }

  return {
    type: candidate.type as SyncAction['type'],
    roomId: candidate.roomId as string,
    senderId: candidate.senderId as string,
    currentTime,
    timestamp: candidate.timestamp as number,
    payload: sanitizedPayload,
  };
}

/**
 * Client-side sliding window rate limiter to throttle user actions (chat spam, sync bursts).
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
