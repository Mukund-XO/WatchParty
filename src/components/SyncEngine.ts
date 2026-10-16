import { SyncAction } from '../types';
import { validateSyncAction, RateLimiter } from '../utils/security';

export class SyncChannel {
  private channel: BroadcastChannel | null = null;
  private roomId: string;
  private onActionCallback: (action: SyncAction) => void;
  private storageKey: string;
  private broadcastLimiter: RateLimiter;

  constructor(roomId: string, onAction: (action: SyncAction) => void) {
    this.roomId = roomId;
    this.onActionCallback = onAction;
    this.storageKey = `synccinema_event_${roomId}`;
    // Limit broadcasts to at most 20 actions per 1 second to prevent sync-loop floods
    this.broadcastLimiter = new RateLimiter(20, 1000);

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel(`synccinema_room_${roomId}`);
        this.channel.onmessage = (event: MessageEvent) => {
          // Validate incoming schema and origin
          const validAction = validateSyncAction(event.data, this.roomId);
          if (validAction) {
            this.onActionCallback(validAction);
          }
        };
      } catch {
        // Fallback gracefully without verbose errors
      }
    }

    // Storage fallback for cross-tab sync
    window.addEventListener('storage', this.handleStorageEvent);
  }

  private handleStorageEvent = (event: StorageEvent) => {
    if (event.key === this.storageKey && event.newValue) {
      try {
        // Limit maximum payload size (prevent oversized localStorage attacks)
        if (event.newValue.length > 8192) return;

        const parsed = JSON.parse(event.newValue);
        const validAction = validateSyncAction(parsed, this.roomId);
        if (validAction) {
          this.onActionCallback(validAction);
        }
      } catch {
        // Suppress raw error traces from malformed input
      }
    }
  };

  public broadcast(action: Omit<SyncAction, 'roomId' | 'timestamp'>) {
    // Check rate limit
    if (!this.broadcastLimiter.canProceed()) {
      return;
    }

    const fullAction: SyncAction = {
      ...action,
      roomId: this.roomId,
      timestamp: Date.now(),
    };

    // 1. BroadcastChannel
    if (this.channel) {
      try {
        this.channel.postMessage(fullAction);
      } catch {
        // Non-blocking
      }
    }

    // 2. Storage event
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(fullAction));
    } catch {
      // Storage quota or restricted environment
    }
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
    window.removeEventListener('storage', this.handleStorageEvent);
  }
}

/**
 * Generate cryptographically secure 6-digit room code using crypto.getRandomValues
 */
export function generateRoomCode(): string {
  try {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    const code = 100000 + (array[0] % 900000);
    return code.toString();
  } catch {
    // Fallback if crypto is unavailable
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
