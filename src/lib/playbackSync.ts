/**
 * Playback synchronisation.
 *
 * The room stores one shared fact: "at server time `updatedAt`, the video was at `position` and
 * was `playing` (or paused)". Every viewer, including the one who made the change, turns that
 * into a playhead with the same arithmetic, using the Realtime Database server clock so that
 * differences between devices' own clocks do not matter:
 *
 *     playing: target = position + (serverNow - updatedAt)
 *     paused:  target = position
 *
 * Each viewer then nudges their own <video> towards the target. Small errors are corrected by
 * speeding up or slowing down slightly (imperceptible), large errors by seeking. A viewer who
 * joins late computes the same target on their first tick, so no catch-up message is needed.
 *
 * This file has no React or Firebase imports so it can be tested with a simulated video.
 */

export interface PlaybackState {
  playing: boolean;
  /** Seconds into the video at `updatedAt`. */
  position: number;
  /** Server time in milliseconds when this state was written. */
  updatedAt: number;
  /** uid of the viewer who wrote it. */
  by: string;
}

/** What a room looks like before anyone has pressed play. */
export const IDLE_PLAYBACK: PlaybackState = { playing: false, position: 0, updatedAt: 0, by: '' };

/** Playing: errors beyond this are fixed by seeking instead of changing speed. */
export const HARD_SEEK_SECONDS = 1.0;
/** Playing: errors beyond this start a gentle speed change. */
export const SOFT_CORRECT_SECONDS = 0.2;
/** Playing: once the error is below this, return to normal speed. */
export const SETTLED_SECONDS = 0.05;
/** Paused: errors beyond this are fixed by seeking. */
export const PAUSED_SEEK_SECONDS = 0.25;
/** Speed used to catch up (>1) or wait (<1). A 5% change is hard to notice. */
export const CORRECTION_RATE_DELTA = 0.05;
/** After a hard seek, wait this long before another, so a slow-buffering viewer is not seek-looped. */
export const SEEK_COOLDOWN_MS = 2500;
/** Seeking slightly ahead of the target compensates for the time the video needs to resume. */
export const SEEK_LEAD_SECONDS = 0.25;

/** Where the playhead should be right now. */
export function targetPosition(state: PlaybackState, serverNow: number, duration = Infinity): number {
  let target = state.position;
  if (state.playing) {
    // updatedAt can be slightly in the future if the clock offset estimate is a little stale
    target += Math.max(0, serverNow - state.updatedAt) / 1000;
  }
  if (!Number.isFinite(target) || target < 0) target = 0;
  return Number.isFinite(duration) ? Math.min(target, duration) : target;
}

export interface CorrectionInput {
  /** The viewer's current playhead in seconds. */
  local: number;
  /** Where it should be. */
  target: number;
  playing: boolean;
  /** The video's current playbackRate. */
  rate: number;
}

export interface CorrectionPlan {
  /** Seek to this position, if set. */
  seekTo?: number;
  /** playbackRate to use from now on. */
  rate: number;
}

/**
 * Decides how to move `local` towards `target`. `drift` is positive when this viewer is ahead.
 */
export function planCorrection({ local, target, playing, rate }: CorrectionInput): CorrectionPlan {
  const drift = local - target;
  const error = Math.abs(drift);

  if (!playing) {
    return error > PAUSED_SEEK_SECONDS ? { seekTo: target, rate: 1 } : { rate: 1 };
  }

  if (error > HARD_SEEK_SECONDS) {
    return { seekTo: target + SEEK_LEAD_SECONDS, rate: 1 };
  }

  if (error > SOFT_CORRECT_SECONDS) {
    return { rate: drift > 0 ? 1 - CORRECTION_RATE_DELTA : 1 + CORRECTION_RATE_DELTA };
  }

  // Inside the dead band: keep an ongoing correction running until it is almost exact, then stop.
  if (rate !== 1 && error < SETTLED_SECONDS) {
    return { rate: 1 };
  }
  // Already correcting in the right direction: keep going. Otherwise stay at normal speed.
  if (rate !== 1 && (drift > 0) === (rate < 1)) {
    return { rate };
  }
  return { rate: 1 };
}

/** The parts of an HTMLVideoElement this module needs, so tests can supply a fake. */
export interface VideoLike {
  currentTime: number;
  readonly duration: number;
  readonly paused: boolean;
  playbackRate: number;
  readonly readyState: number;
  readonly seeking: boolean;
  play(): Promise<void>;
  pause(): void;
}

export type SyncStatus = 'loading' | 'synced' | 'catching-up' | 'waiting' | 'needs-tap';

export interface SyncReport {
  status: SyncStatus;
  /** Seconds this viewer is ahead (+) or behind (-) of the room. */
  drift: number;
  target: number;
}

export class PlaybackSync {
  private state: PlaybackState = IDLE_PLAYBACK;
  private lastHardSeekAt = -Infinity;
  private playPending = false;
  private needsGesture = false;

  constructor(
    private readonly video: VideoLike,
    /** Current server time in ms. */
    private readonly serverNow: () => number,
    /** Called when the browser refused to start playback without a tap. */
    private readonly onNeedsGesture: (needed: boolean) => void = () => {},
    /** Monotonic-ish local clock in ms, injectable for tests. */
    private readonly localNow: () => number = () => Date.now(),
  ) {}

  /** Call whenever the room's playback state changes (and once on join). */
  setState(state: PlaybackState | null): void {
    this.state = state ?? IDLE_PLAYBACK;
    // A fresh instruction from the room is allowed to seek immediately.
    this.lastHardSeekAt = -Infinity;
    this.tick();
  }

  /**
   * Call from a tap or click after the browser blocked autoplay. Must stay synchronous: the
   * browser only allows video.play() while the tap's user activation is still in effect.
   */
  resume(): void {
    this.setNeedsGesture(false);
    this.tick();
  }

  private setNeedsGesture(needed: boolean) {
    if (this.needsGesture !== needed) {
      this.needsGesture = needed;
      this.onNeedsGesture(needed);
    }
  }

  private startPlayback() {
    if (this.playPending) return;
    this.playPending = true;
    this.video
      .play()
      .then(() => this.setNeedsGesture(false))
      .catch((error: unknown) => {
        // NotAllowedError means "tap first". Anything else (such as a load error) is not fixable by a tap.
        if (error && (error as { name?: string }).name === 'NotAllowedError') {
          this.setNeedsGesture(true);
        }
      })
      .finally(() => {
        this.playPending = false;
      });
  }

  /** Run about once a second, and after every state change. */
  tick(): SyncReport {
    const video = this.video;
    const pb = this.state;

    if (video.readyState < 1) {
      return { status: 'loading', drift: 0, target: pb.position };
    }

    const duration = Number.isFinite(video.duration) ? video.duration : Infinity;
    const target = targetPosition(pb, this.serverNow(), duration);
    const atEnd = Number.isFinite(duration) && target >= duration - 0.05;
    const shouldPlay = pb.playing && !atEnd;

    if (shouldPlay) {
      // Do not retry in a loop while the browser is waiting for a tap
      if (video.paused && !this.needsGesture) this.startPlayback();
    } else if (!video.paused) {
      video.pause();
    }

    const drift = video.currentTime - target;

    // Do not fight the video while it is buffering or already seeking
    if (video.seeking || (shouldPlay && !video.paused && video.readyState < 3)) {
      return { status: 'catching-up', drift, target };
    }

    const plan = planCorrection({
      local: video.currentTime,
      target,
      playing: shouldPlay && !video.paused,
      rate: video.playbackRate,
    });

    if (plan.seekTo !== undefined) {
      const now = this.localNow();
      const isHardSeekWhilePlaying = shouldPlay;
      if (!isHardSeekWhilePlaying || now - this.lastHardSeekAt >= SEEK_COOLDOWN_MS) {
        video.currentTime = Math.min(plan.seekTo, Number.isFinite(duration) ? duration : plan.seekTo);
        if (isHardSeekWhilePlaying) this.lastHardSeekAt = now;
      }
    }
    if (video.playbackRate !== plan.rate) {
      video.playbackRate = plan.rate;
    }

    let status: SyncStatus;
    if (this.needsGesture && shouldPlay) status = 'needs-tap';
    else if (!pb.playing) status = 'waiting';
    else status = Math.abs(drift) <= 0.5 ? 'synced' : 'catching-up';

    return { status, drift, target };
  }
}
