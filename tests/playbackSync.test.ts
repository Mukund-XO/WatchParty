import { describe, expect, it } from 'vitest';
import {
  CORRECTION_RATE_DELTA,
  HARD_SEEK_SECONDS,
  PlaybackSync,
  SEEK_COOLDOWN_MS,
  planCorrection,
  targetPosition,
  type PlaybackState,
  type VideoLike,
} from '../src/lib/playbackSync';

// ---------------------------------------------------------------------------------------------
// Pure arithmetic
// ---------------------------------------------------------------------------------------------

describe('targetPosition', () => {
  const playing: PlaybackState = { playing: true, position: 100, updatedAt: 1_000_000, by: 'h' };

  it('advances while playing', () => {
    expect(targetPosition(playing, 1_000_000)).toBe(100);
    expect(targetPosition(playing, 1_004_500)).toBeCloseTo(104.5);
  });

  it('stays put while paused', () => {
    expect(targetPosition({ ...playing, playing: false }, 9_999_999)).toBe(100);
  });

  it('never goes backwards if the clock estimate is slightly stale', () => {
    expect(targetPosition(playing, 999_000)).toBe(100);
  });

  it('clamps to the video length', () => {
    expect(targetPosition(playing, 1_000_000 + 10_000_000, 120)).toBe(120);
  });

  it('copes with nonsense values', () => {
    expect(targetPosition({ ...playing, position: Number.NaN }, 1_000_000)).toBe(0);
  });
});

describe('planCorrection', () => {
  it('leaves a well-synced playing video alone', () => {
    expect(planCorrection({ local: 50.05, target: 50, playing: true, rate: 1 })).toEqual({ rate: 1 });
  });

  it('slows down when ahead and speeds up when behind', () => {
    expect(planCorrection({ local: 50.4, target: 50, playing: true, rate: 1 }).rate).toBeCloseTo(1 - CORRECTION_RATE_DELTA);
    expect(planCorrection({ local: 49.6, target: 50, playing: true, rate: 1 }).rate).toBeCloseTo(1 + CORRECTION_RATE_DELTA);
  });

  it('keeps correcting until almost exact, then returns to normal speed', () => {
    const slow = 1 - CORRECTION_RATE_DELTA;
    expect(planCorrection({ local: 50.1, target: 50, playing: true, rate: slow }).rate).toBe(slow);
    expect(planCorrection({ local: 50.02, target: 50, playing: true, rate: slow }).rate).toBe(1);
  });

  it('does not keep slowing after overshooting', () => {
    const slow = 1 - CORRECTION_RATE_DELTA;
    expect(planCorrection({ local: 49.9, target: 50, playing: true, rate: slow }).rate).toBe(1);
  });

  it('seeks when far off, with a small lead, at normal speed', () => {
    const plan = planCorrection({ local: 10, target: 50, playing: true, rate: 1.05 });
    expect(plan.seekTo).toBeGreaterThan(50);
    expect(plan.seekTo).toBeLessThan(50.5);
    expect(plan.rate).toBe(1);
  });

  it('while paused, seeks exactly and never changes speed', () => {
    expect(planCorrection({ local: 10, target: 50, playing: false, rate: 1 })).toEqual({ seekTo: 50, rate: 1 });
    expect(planCorrection({ local: 50.1, target: 50, playing: false, rate: 1 })).toEqual({ rate: 1 });
  });
});

// ---------------------------------------------------------------------------------------------
// Simulated viewers
// ---------------------------------------------------------------------------------------------

class FakeVideo implements VideoLike {
  duration = 600;
  paused = true;
  playbackRate = 1;
  readyState = 4;
  seeking = false;
  /** Hardware clock error: 1.005 means this device's video runs 0.5% fast. */
  speed = 1;
  autoplayAllowed = true;
  playCalls = 0;
  /** Number of times the code under test assigned currentTime. */
  seekCount = 0;
  /** Simulates a connection too slow for seeks to land. */
  ignoreSeeks = false;

  private position = 0;

  get currentTime(): number {
    return this.position;
  }

  set currentTime(value: number) {
    this.seekCount++;
    if (!this.ignoreSeeks) this.position = value;
  }

  /** Test setup only: places the playhead without counting as a seek. */
  place(seconds: number) {
    this.position = seconds;
  }

  play(): Promise<void> {
    this.playCalls++;
    if (!this.autoplayAllowed) {
      return Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }));
    }
    this.paused = false;
    return Promise.resolve();
  }

  pause(): void {
    this.paused = true;
  }

  advance(ms: number) {
    if (!this.paused) this.position += (ms / 1000) * this.playbackRate * this.speed;
  }
}

class Room {
  serverTime = 1_700_000_000_000;
  state: PlaybackState | null = null;
  viewers: { video: FakeVideo; sync: PlaybackSync; gesture: boolean[] }[] = [];
  private msSinceTick = 0;
  localClock = 0;

  /** `clockError` is how wrong this viewer's estimate of the server time is, in ms. */
  join(opts: { speed?: number; clockError?: number; autoplayAllowed?: boolean; startAt?: number } = {}) {
    const video = new FakeVideo();
    video.speed = opts.speed ?? 1;
    video.autoplayAllowed = opts.autoplayAllowed ?? true;
    video.place(opts.startAt ?? 0);
    const gesture: boolean[] = [];
    const sync = new PlaybackSync(
      video,
      () => this.serverTime + (opts.clockError ?? 0),
      (needed) => gesture.push(needed),
      () => this.localClock,
    );
    sync.setState(this.state);
    const viewer = { video, sync, gesture };
    this.viewers.push(viewer);
    return viewer;
  }

  /** What the host's write does: record "now" and the position in the shared state, and tell everyone. */
  setPlayback(playing: boolean, position: number) {
    this.state = { playing, position, updatedAt: this.serverTime, by: 'host' };
    for (const v of this.viewers) v.sync.setState(this.state);
  }

  run(ms: number, step = 50) {
    for (let elapsed = 0; elapsed < ms; elapsed += step) {
      this.serverTime += step;
      this.localClock += step;
      for (const v of this.viewers) v.video.advance(step);
      this.msSinceTick += step;
      if (this.msSinceTick >= 1000) {
        this.msSinceTick = 0;
        for (const v of this.viewers) v.sync.tick();
      }
    }
  }

  maxSpread() {
    const times = this.viewers.map((v) => v.video.currentTime);
    return Math.max(...times) - Math.min(...times);
  }
}

describe('simulated room', () => {
  it('starts everyone together and keeps them within a fraction of a second', () => {
    const room = new Room();
    const host = room.join();
    const a = room.join({ speed: 1.004 });
    const b = room.join({ speed: 0.996, clockError: 120 });
    room.setPlayback(true, 0);

    room.run(5_000);
    let worst = 0;
    for (let i = 0; i < 120; i++) {
      room.run(1_000);
      worst = Math.max(worst, room.maxSpread());
    }
    expect(host.video.paused).toBe(false);
    expect(a.video.paused).toBe(false);
    expect(b.video.paused).toBe(false);
    expect(worst).toBeLessThan(0.5);
  });

  it('puts a late joiner at the right place without any catch-up message', () => {
    const room = new Room();
    room.join();
    room.setPlayback(true, 10);
    room.run(45_000); // the room is now ~55s in

    const late = room.join({ startAt: 0 });
    room.run(1_500);

    expect(late.video.currentTime).toBeGreaterThan(55);
    expect(Math.abs(late.video.currentTime - (10 + room.serverTime / 1000 - (room.state!.updatedAt) / 1000))).toBeLessThan(1);
    expect(room.maxSpread()).toBeLessThan(0.6);
  });

  it('pauses everyone at the same spot and keeps late joiners there', () => {
    const room = new Room();
    const host = room.join();
    const follower = room.join({ speed: 1.003 });
    room.setPlayback(true, 0);
    room.run(20_000);

    room.setPlayback(false, host.video.currentTime);
    room.run(3_000);
    const pausedAt = room.state!.position;

    expect(host.video.paused).toBe(true);
    expect(follower.video.paused).toBe(true);
    expect(Math.abs(follower.video.currentTime - pausedAt)).toBeLessThan(0.3);

    const late = room.join();
    room.run(2_000);
    expect(late.video.paused).toBe(true);
    expect(Math.abs(late.video.currentTime - pausedAt)).toBeLessThan(0.3);
  });

  it('follows a seek while playing and while paused', () => {
    const room = new Room();
    room.join();
    const follower = room.join();
    room.setPlayback(true, 0);
    room.run(10_000);

    room.setPlayback(true, 300);
    room.run(2_000);
    expect(follower.video.currentTime).toBeGreaterThan(301);
    expect(follower.video.currentTime).toBeLessThan(303);

    room.setPlayback(false, 42);
    room.run(1_500);
    expect(follower.video.currentTime).toBeCloseTo(42, 0);
  });

  it('does not keep seeking when the clock estimate is off by a few hundred milliseconds', () => {
    const room = new Room();
    room.join();
    const tracked = new FakeVideo();
    const sync = new PlaybackSync(tracked, () => room.serverTime + 400, () => {}, () => room.localClock);
    const viewer = { video: tracked, sync, gesture: [] as boolean[] };
    room.viewers.push(viewer);
    room.setPlayback(true, 0);
    room.run(90_000);

    // One seek to get into place at the start; after that, only speed changes
    expect(tracked.seekCount).toBeLessThanOrEqual(2);
    expect(Math.abs(room.viewers[0].video.currentTime - tracked.currentTime)).toBeLessThan(0.7);
  });

  it('rate-limits hard seeks for a viewer that cannot keep up', () => {
    const room = new Room();
    room.join();
    const stuck = new FakeVideo();
    stuck.ignoreSeeks = true; // e.g. a very slow connection: seeks do not land
    const sync = new PlaybackSync(stuck, () => room.serverTime, () => {}, () => room.localClock);
    room.viewers.push({ video: stuck, sync, gesture: [] });
    room.setPlayback(true, 100);

    room.run(10_000);
    // Without a cooldown this would be ~10 seeks (one per tick)
    expect(stuck.seekCount).toBeLessThanOrEqual(Math.ceil(10_000 / SEEK_COOLDOWN_MS) + 1);
  });

  it('leaves a stalled, buffering viewer alone instead of seeking it repeatedly', () => {
    const room = new Room();
    room.join();
    const buffering = new FakeVideo();
    buffering.readyState = 2; // HAVE_CURRENT_DATA: not enough data to keep playing
    buffering.paused = false; // it is trying to play...
    buffering.speed = 0; // ...but the playhead is stalled waiting for data
    const sync = new PlaybackSync(buffering, () => room.serverTime, () => {}, () => room.localClock);
    room.viewers.push({ video: buffering, sync, gesture: [] });
    room.setPlayback(true, 100); // the room is far ahead of this viewer

    room.run(6_000);
    expect(buffering.seekCount).toBe(0);

    // Once enough data has arrived it is allowed to jump to the right place
    buffering.readyState = 4;
    buffering.speed = 1;
    room.run(1_100);
    expect(buffering.seekCount).toBeGreaterThan(0);
    expect(buffering.currentTime).toBeGreaterThan(105);
  });

  it('asks for a tap when the browser blocks autoplay, and does not retry in a loop', async () => {
    const room = new Room();
    const blocked = room.join({ autoplayAllowed: false });
    room.setPlayback(true, 0);
    await Promise.resolve();
    room.run(5_000);
    await Promise.resolve();

    expect(blocked.gesture).toEqual([true]);
    expect(blocked.video.playCalls).toBe(1);
    expect(blocked.video.paused).toBe(true);

    // The viewer taps: autoplay is now allowed
    blocked.video.autoplayAllowed = true;
    blocked.sync.resume();
    await Promise.resolve();
    room.run(2_000);

    expect(blocked.gesture).toEqual([true, false]);
    expect(blocked.video.paused).toBe(false);
    expect(blocked.video.currentTime).toBeGreaterThan(6);
  });

  it('stops at the end of the video', () => {
    const room = new Room();
    const v = room.join();
    v.video.duration = 30;
    room.setPlayback(true, 20);
    room.run(25_000);
    expect(v.video.paused).toBe(true);
    expect(v.video.currentTime).toBeLessThanOrEqual(30.3);
  });

  it('waits for the video to load before acting', () => {
    const room = new Room();
    const v = room.join();
    v.video.readyState = 0;
    room.setPlayback(true, 50);
    expect(v.video.paused).toBe(true);
    expect(v.sync.tick().status).toBe('loading');
    v.video.readyState = 4;
    room.run(1_100);
    expect(v.video.paused).toBe(false);
    expect(v.video.currentTime).toBeGreaterThan(50);
  });

  it('exposes drift and status for the UI', () => {
    const room = new Room();
    const v = room.join();
    expect(v.sync.tick().status).toBe('waiting');
    room.setPlayback(true, 0);
    room.run(3_000);
    const report = v.sync.tick();
    expect(report.status).toBe('synced');
    expect(Math.abs(report.drift)).toBeLessThan(HARD_SEEK_SECONDS);
  });
});
