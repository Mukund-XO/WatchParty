import type { SyncAction } from '../types';
import { validateSyncAction, RateLimiter, randomId } from '../utils/security';

type OutgoingAction = Omit<SyncAction, 'roomId' | 'timestamp' | 'senderId'>;

/**
 * Syncs one room between tabs of the same browser using BroadcastChannel (with a localStorage
 * "storage" event fallback for old browsers). There is no network transport, so it does not
 * reach other browsers or devices.
 */
export class SyncChannel {
  /** Unique per channel instance. Used as the sender id and to ignore our own messages. */
  public readonly clientId = randomId('client');

  private channel: BroadcastChannel | null = null;
  private roomId: string;
  private onActionCallback: (action: SyncAction) => void;
  private storageKey: string;
  private usingStorageFallback = false;
  private broadcastLimiter: RateLimiter;
  private incomingLimiter: RateLimiter;

  constructor(roomId: string, onAction: (action: SyncAction) => void) {
    this.roomId = roomId;
    this.onActionCallback = onAction;
    this.storageKey = `watchparty_event_${roomId}`;
    // Limit broadcasts to at most 20 actions per second to prevent sync-loop floods
    this.broadcastLimiter = new RateLimiter(20, 1000);
    // Drop floods from other tabs instead of re-rendering for every message
    this.incomingLimiter = new RateLimiter(60, 1000);

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel(`watchparty_room_${roomId}`);
        this.channel.onmessage = (event: MessageEvent) => this.receive(event.data);
      } catch {
        this.channel = null;
      }
    }

    // The storage event is only a fallback. Using it alongside BroadcastChannel would deliver
    // every message twice.
    if (!this.channel) {
      this.usingStorageFallback = true;
      window.addEventListener('storage', this.handleStorageEvent);
    }
  }

  private receive(raw: unknown) {
    if (!this.incomingLimiter.canProceed()) return;

    const action = validateSyncAction(raw, this.roomId);
    if (!action || action.senderId === this.clientId) return;

    this.onActionCallback(action);
  }

  private handleStorageEvent = (event: StorageEvent) => {
    if (event.key !== this.storageKey || !event.newValue) return;
    // Limit maximum payload size (prevent oversized localStorage attacks)
    if (event.newValue.length > 8192) return;

    try {
      this.receive(JSON.parse(event.newValue));
    } catch {
      // Suppress raw error traces from malformed input
    }
  };

  /** Returns false if the message was dropped by the rate limiter. */
  public broadcast(action: OutgoingAction): boolean {
    if (!this.broadcastLimiter.canProceed()) {
      return false;
    }

    const fullAction: SyncAction = {
      ...action,
      roomId: this.roomId,
      senderId: this.clientId,
      timestamp: Date.now(),
    };

    try {
      if (this.channel) {
        this.channel.postMessage(fullAction);
      } else {
        localStorage.setItem(this.storageKey, JSON.stringify(fullAction));
      }
    } catch {
      // Storage quota, closed channel or restricted environment
      return false;
    }
    return true;
  }

  public destroy() {
    if (this.channel) {
      try {
        this.channel.close();
      } catch {
        // Non-blocking
      }
      this.channel = null;
    }
    if (this.usingStorageFallback) {
      window.removeEventListener('storage', this.handleStorageEvent);
    }
  }
}

/**
 * Generates a random 6-digit room code (100000-999999) with the Web Crypto API.
 * Values from the uneven top sliver of the 32-bit range are rejected so every code is equally likely.
 */
export function generateRoomCode(): string {
  const range = 900000;
  const limit = Math.floor(0x100000000 / range) * range;
  const buffer = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return String(100000 + (buffer[0] % range));
}
