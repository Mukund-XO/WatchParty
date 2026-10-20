import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import targaryen from 'targaryen';
import { checkMediaUrl } from '../src/utils/security';

// The rules file allows // comment lines (the Firebase CLI does too); JSON.parse does not.
const rulesText = readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8')
  .split('\n')
  .filter((line) => !line.trim().startsWith('//'))
  .join('\n');
const rules = JSON.parse(rulesText);

const NOW = 1_800_000_000_000;
const DAY = 86_400_000;
const SV = { '.sv': 'timestamp' };

const CODE = 'ABCDEFGHJK';
const HOST = 'host-uid';
const ALICE = 'alice-uid';
const BOB = 'bob-uid';
const MALLORY = 'mallory-uid';

const VIDEO = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

type Data = Record<string, unknown>;

function room(overrides: Data = {}, createdAt = NOW - 60_000): Data {
  return {
    rooms: {
      [CODE]: {
        meta: {
          hostUid: HOST,
          title: 'Movie night',
          videoUrl: VIDEO,
          videoTitle: 'Big Buck Bunny',
          controlMode: 'host',
          createdAt,
        },
        members: {
          [HOST]: { name: 'Hannah', joinedAt: NOW - 50_000 },
          [ALICE]: { name: 'Alice', joinedAt: NOW - 40_000 },
        },
        ...overrides,
      },
    },
  };
}

function as(uid: string | null, data: Data | null) {
  const db = targaryen.database(rules, data, NOW);
  return uid === null ? db.as(null) : db.as({ uid });
}

const write = (uid: string | null, data: Data | null, path: string, value: unknown) =>
  as(uid, data).write(path, value, { now: NOW }).allowed;

const read = (uid: string | null, data: Data | null, path: string) => as(uid, data).read(path, NOW).allowed;

const newMeta = (over: Data = {}) => ({
  hostUid: HOST,
  title: 'Movie night',
  videoUrl: VIDEO,
  videoTitle: 'Big Buck Bunny',
  controlMode: 'host',
  createdAt: SV,
  ...over,
});

describe('room creation', () => {
  it('lets a signed-in user create a room as its host', () => {
    expect(write(HOST, null, `/rooms/${CODE}/meta`, newMeta())).toBe(true);
  });

  it('rejects creation without sign-in', () => {
    expect(write(null, null, `/rooms/${CODE}/meta`, newMeta())).toBe(false);
  });

  it('rejects naming someone else as host', () => {
    expect(write(MALLORY, null, `/rooms/${CODE}/meta`, newMeta())).toBe(false);
  });

  it('rejects overwriting an existing room (no takeover)', () => {
    expect(write(MALLORY, room(), `/rooms/${CODE}/meta`, newMeta({ hostUid: MALLORY }))).toBe(false);
  });

  it('rejects the host re-creating the room to reset its clock', () => {
    expect(write(HOST, room(), `/rooms/${CODE}/meta`, newMeta())).toBe(false);
  });

  it.each([
    ['too short', 'ABCDEFGHJ'],
    ['too long', 'ABCDEFGHJKM'],
    ['lower case', 'abcdefghjk'],
    ['contains U', 'ABCDEFGHJU'],
    ['contains O', 'ABCDEFGHJO'],
    ['six digits', '123456'],
  ])('rejects a malformed room code (%s)', (_label, code) => {
    expect(write(HOST, null, `/rooms/${code}/meta`, newMeta())).toBe(false);
  });

  it('rejects createdAt that is not the server time', () => {
    expect(write(HOST, null, `/rooms/${CODE}/meta`, newMeta({ createdAt: NOW - 10 * DAY }))).toBe(false);
  });

  it('rejects unknown extra fields', () => {
    expect(write(HOST, null, `/rooms/${CODE}/meta`, newMeta({ admin: true }))).toBe(false);
  });

  it('rejects empty or oversized titles and an invalid control mode', () => {
    expect(write(HOST, null, `/rooms/${CODE}/meta`, newMeta({ title: '' }))).toBe(false);
    expect(write(HOST, null, `/rooms/${CODE}/meta`, newMeta({ title: 'x'.repeat(81) }))).toBe(false);
    expect(write(HOST, null, `/rooms/${CODE}/meta`, newMeta({ controlMode: 'anyone' }))).toBe(false);
  });
});

describe('video URL rules', () => {
  const create = (videoUrl: unknown) => write(HOST, null, `/rooms/${CODE}/meta`, newMeta({ videoUrl }));

  it.each([
    VIDEO,
    'https://example.org/movie.mp4',
    'https://cdn.example.co.uk:8443/a/b/c.webm?token=abc&x=1',
    'https://xn--bcher-kva.example/video.mp4',
  ])('accepts %s', (url) => {
    expect(create(url)).toBe(true);
  });

  it.each([
    'http://example.org/movie.mp4',
    'javascript:alert(1)',
    'data:video/mp4;base64,AAAA',
    'blob:https://example.org/uuid',
    'https://127.0.0.1/movie.mp4',
    'https://10.0.0.5/movie.mp4',
    'https://169.254.169.254/latest/meta-data/',
    'https://[::1]/movie.mp4',
    'https://localhost/movie.mp4',
    'https://intranet/movie.mp4',
    'https://printer.local/movie.mp4',
    'https://metadata.google.internal/computeMetadata/v1/',
    'https://user:pass@example.org/movie.mp4',
    'https://example.org/has space.mp4',
    'https://example.org/"quote.mp4',
    'https://example.org/<tag>.mp4',
    `https://example.org/${'a'.repeat(2100)}`,
    42,
    null,
  ])('rejects %s', (url) => {
    expect(create(url)).toBe(false);
  });

  it('agrees with the browser-side check on every URL above', () => {
    const urls = [
      VIDEO,
      'https://example.org/movie.mp4',
      'https://cdn.example.co.uk:8443/a/b/c.webm?token=abc&x=1',
      'http://example.org/movie.mp4',
      'https://127.0.0.1/movie.mp4',
      'https://2130706433/movie.mp4',
      'https://[::1]/movie.mp4',
      'https://localhost/movie.mp4',
      'https://intranet/movie.mp4',
      'https://printer.local/movie.mp4',
      'https://user:pass@example.org/movie.mp4',
      'https://example.org/has space.mp4',
      'https://example.org/"quote.mp4',
    ];
    for (const url of urls) {
      const client = checkMediaUrl(url);
      // The client stores the normalised form, which is what the rules see.
      const stored = client.ok ? client.url : url;
      const server = create(stored);
      expect({ url, accepted: server }).toEqual({ url, accepted: client.ok });
    }
  });
});

describe('reading rooms', () => {
  it('lets a signed-in user read a live room', () => {
    expect(read(BOB, room(), `/rooms/${CODE}`)).toBe(true);
    expect(read(BOB, room(), `/rooms/${CODE}/meta`)).toBe(true);
  });

  it('denies reads without sign-in', () => {
    expect(read(null, room(), `/rooms/${CODE}`)).toBe(false);
  });

  it('denies listing all rooms or the database root', () => {
    expect(read(BOB, room(), '/rooms')).toBe(false);
    expect(read(BOB, room(), '/')).toBe(false);
  });

  it('denies reading a room that does not exist', () => {
    expect(read(BOB, null, `/rooms/${CODE}`)).toBe(false);
  });

  it('denies reading a room older than 24 hours', () => {
    expect(read(BOB, room({}, NOW - DAY - 1), `/rooms/${CODE}`)).toBe(false);
    expect(read(BOB, room({}, NOW - DAY + 60_000), `/rooms/${CODE}`)).toBe(true);
  });
});

describe('updating room settings', () => {
  const metaPath = `/rooms/${CODE}/meta`;

  it('lets the host change the control mode', () => {
    expect(write(HOST, room(), `${metaPath}/controlMode`, 'everyone')).toBe(true);
  });

  it('stops other members changing the control mode', () => {
    expect(write(ALICE, room(), `${metaPath}/controlMode`, 'everyone')).toBe(false);
    expect(write(MALLORY, room(), `${metaPath}/controlMode`, 'everyone')).toBe(false);
  });

  it('stops anyone, including the host, changing the host, video or creation time', () => {
    expect(write(HOST, room(), `${metaPath}/hostUid`, MALLORY)).toBe(false);
    expect(write(MALLORY, room(), `${metaPath}/hostUid`, MALLORY)).toBe(false);
    expect(write(HOST, room(), `${metaPath}/videoUrl`, 'https://example.org/other.mp4')).toBe(false);
    expect(write(HOST, room(), `${metaPath}/createdAt`, SV)).toBe(false);
  });

  it('stops the host editing an expired room', () => {
    expect(write(HOST, room({}, NOW - DAY - 1), `${metaPath}/controlMode`, 'everyone')).toBe(false);
  });
});

describe('shared playback', () => {
  const path = `/rooms/${CODE}/playback`;
  const state = (over: Data = {}) => ({ playing: true, position: 12.5, updatedAt: SV, by: HOST, ...over });

  it('lets the host move the playhead', () => {
    expect(write(HOST, room(), path, state())).toBe(true);
  });

  it('stops ordinary members while the room is host-controlled', () => {
    expect(write(ALICE, room(), path, state({ by: ALICE }))).toBe(false);
  });

  it('lets members control playback when the room is set to everyone', () => {
    const data = room();
    (data.rooms as any)[CODE].meta.controlMode = 'everyone';
    expect(write(ALICE, data, path, state({ by: ALICE }))).toBe(true);
  });

  it('still stops non-members when the room is set to everyone', () => {
    const data = room();
    (data.rooms as any)[CODE].meta.controlMode = 'everyone';
    expect(write(MALLORY, data, path, state({ by: MALLORY }))).toBe(false);
  });

  it('rejects forged authorship, bad positions, client-chosen times and extra fields', () => {
    expect(write(HOST, room(), path, state({ by: ALICE }))).toBe(false);
    expect(write(HOST, room(), path, state({ position: -1 }))).toBe(false);
    expect(write(HOST, room(), path, state({ position: 86_401 }))).toBe(false);
    expect(write(HOST, room(), path, state({ position: 'soon' }))).toBe(false);
    expect(write(HOST, room(), path, state({ playing: 'yes' }))).toBe(false);
    expect(write(HOST, room(), path, state({ updatedAt: NOW - 5 * DAY }))).toBe(false);
    expect(write(HOST, room(), path, state({ extra: 1 }))).toBe(false);
  });

  it('stops playback writes in an expired room', () => {
    expect(write(HOST, room({}, NOW - DAY - 1), path, state())).toBe(false);
  });
});

describe('members and presence', () => {
  const memberPath = (uid: string) => `/rooms/${CODE}/members/${uid}`;
  const member = (over: Data = {}) => ({ name: 'Bob', joinedAt: SV, ...over });

  it('lets someone join as themselves', () => {
    expect(write(BOB, room(), memberPath(BOB), member())).toBe(true);
  });

  it('stops someone joining as another user', () => {
    expect(write(MALLORY, room(), memberPath(BOB), member())).toBe(false);
  });

  it('cannot join a room that does not exist', () => {
    expect(write(BOB, null, memberPath(BOB), member())).toBe(false);
  });

  it('cannot join an expired room', () => {
    expect(write(BOB, room({}, NOW - DAY - 1), memberPath(BOB), member())).toBe(false);
  });

  it('rejects bad names and fields', () => {
    expect(write(BOB, room(), memberPath(BOB), member({ name: '' }))).toBe(false);
    expect(write(BOB, room(), memberPath(BOB), member({ name: 'x'.repeat(41) }))).toBe(false);
    expect(write(BOB, room(), memberPath(BOB), member({ joinedAt: 1 }))).toBe(false);
    expect(write(BOB, room(), memberPath(BOB), member({ isHost: true }))).toBe(false);
  });

  it('lets a member leave, and the host remove anyone, but not other members', () => {
    expect(write(ALICE, room(), memberPath(ALICE), null)).toBe(true);
    expect(write(HOST, room(), memberPath(ALICE), null)).toBe(true);
    expect(write(MALLORY, room(), memberPath(ALICE), null)).toBe(false);
    const data = room();
    (data.rooms as any)[CODE].members[BOB] = { name: 'Bob', joinedAt: NOW - 1000 };
    expect(write(BOB, data, memberPath(ALICE), null)).toBe(false);
  });

  it('stops banned users rejoining but lets them leave', () => {
    const data = room({ banned: { [MALLORY]: true }, members: { [MALLORY]: { name: 'M', joinedAt: NOW - 5 } } });
    expect(write(MALLORY, data, memberPath(MALLORY), member({ name: 'M' }))).toBe(false);
    expect(write(MALLORY, data, memberPath(MALLORY), null)).toBe(true);
  });

  it('only lets the host ban', () => {
    expect(write(HOST, room(), `/rooms/${CODE}/banned/${MALLORY}`, true)).toBe(true);
    expect(write(ALICE, room(), `/rooms/${CODE}/banned/${MALLORY}`, true)).toBe(false);
    expect(write(MALLORY, room(), `/rooms/${CODE}/banned/${HOST}`, true)).toBe(false);
    expect(write(HOST, room(), `/rooms/${CODE}/banned/${MALLORY}`, 'yes')).toBe(false);
  });
});

describe('chat', () => {
  const id = '-OabcdefghijKLMNOPQR';
  const path = (msgId = id) => `/rooms/${CODE}/chat/${msgId}`;
  const msg = (over: Data = {}) => ({ uid: ALICE, name: 'Alice', text: 'hello', at: SV, videoTime: 31, ...over });

  it('lets a member post as themselves', () => {
    expect(write(ALICE, room(), path(), msg())).toBe(true);
    expect(write(ALICE, room(), path(), msg({ videoTime: undefined }))).toBe(true);
  });

  it('stops non-members posting', () => {
    expect(write(MALLORY, room(), path(), msg({ uid: MALLORY, name: 'Alice' }))).toBe(false);
  });

  it('stops impersonation by uid or by name', () => {
    expect(write(ALICE, room(), path(), msg({ uid: HOST }))).toBe(false);
    expect(write(ALICE, room(), path(), msg({ name: 'Hannah' }))).toBe(false);
  });

  it('rejects bad text, times, ids and extra fields', () => {
    expect(write(ALICE, room(), path(), msg({ text: '' }))).toBe(false);
    expect(write(ALICE, room(), path(), msg({ text: 'x'.repeat(301) }))).toBe(false);
    expect(write(ALICE, room(), path(), msg({ at: 1 }))).toBe(false);
    expect(write(ALICE, room(), path(), msg({ videoTime: -5 }))).toBe(false);
    expect(write(ALICE, room(), path(), msg({ videoTime: 99_999 }))).toBe(false);
    expect(write(ALICE, room(), path('custom-id'), msg())).toBe(false);
    expect(write(ALICE, room(), path(), msg({ html: '<b>' }))).toBe(false);
  });

  it('cannot edit or delete messages, except the host deleting', () => {
    const data = room({ chat: { [id]: { uid: ALICE, name: 'Alice', text: 'hi', at: NOW - 5 } } });
    expect(write(ALICE, data, path(), msg({ text: 'edited' }))).toBe(false);
    expect(write(ALICE, data, path(), null)).toBe(false);
    expect(write(MALLORY, data, path(), null)).toBe(false);
    expect(write(HOST, data, path(), null)).toBe(true);
  });

  it('stops posting in an expired room', () => {
    expect(write(ALICE, room({}, NOW - DAY - 1), path(), msg())).toBe(false);
  });
});

describe('reactions', () => {
  const id = '-OabcdefghijKLMNOPQR';
  const path = `/rooms/${CODE}/reactions/${id}`;
  const reaction = (over: Data = {}) => ({ uid: ALICE, kind: 'fire', at: SV, ...over });

  it('lets a member send an allowed reaction', () => {
    expect(write(ALICE, room(), path, reaction())).toBe(true);
  });

  it('rejects unknown kinds, forged senders and non-members', () => {
    expect(write(ALICE, room(), path, reaction({ kind: '<script>' }))).toBe(false);
    expect(write(ALICE, room(), path, reaction({ kind: '🔥' }))).toBe(false);
    expect(write(ALICE, room(), path, reaction({ uid: HOST }))).toBe(false);
    expect(write(MALLORY, room(), path, reaction({ uid: MALLORY }))).toBe(false);
  });

  it('lets the sender clean up their own reaction but not others', () => {
    const data = room({ reactions: { [id]: { uid: ALICE, kind: 'fire', at: NOW - 5 } } });
    expect(write(ALICE, data, path, null)).toBe(true);
    expect(write(MALLORY, data, path, null)).toBe(false);
  });
});

describe('everything else is closed', () => {
  it('denies arbitrary paths', () => {
    expect(write(HOST, room(), '/users/host-uid', { admin: true })).toBe(false);
    expect(write(HOST, room(), `/rooms/${CODE}/secret`, 'x')).toBe(false);
    expect(write(HOST, room(), '/rooms', {})).toBe(false);
    expect(write(HOST, room(), '/', {})).toBe(false);
  });
});
