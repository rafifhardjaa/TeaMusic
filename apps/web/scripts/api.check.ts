import assert from 'node:assert/strict';
import { getTrack } from '../src/lib/api';
import type { Track } from '../src/lib/types';

/**
 * Self-check for the getTrack cache.
 *
 * The cache has four branches where a mistake is silent: a wrongly cached null
 * reads as "no track" and kills preview playback, and a cached abort reads as
 * a permanently missing track after a single cancelled request. Both fail only
 * at runtime, in a browser, with no error — so they are pinned here instead.
 *
 * Run: bun run check:api
 */

const TRACK: Track = {
  id: '1',
  name: 'Motion Sickness',
  artist: 'Phoebe Bridgers',
  album: 'Stranger in the Alps',
  genre: 'Alternative',
  coverUrl: 'https://example.test/cover.jpg',
  previewUrl: 'https://example.test/preview.m4a',
  durationMs: 232_000,
  externalUrl: 'https://music.apple.com/track/1',
};

type Reply = { ok: boolean; status: number; body: unknown };
let reply: Reply = { ok: true, status: 200, body: { provider: 'itunes', track: TRACK } };
let calls: string[] = [];

globalThis.fetch = (async (input: string) => {
  calls.push(input);
  if (reply.status === 0) throw new TypeError('connection refused');
  return {
    ok: reply.ok,
    status: reply.status,
    json: async () => reply.body,
  } as Response;
}) as typeof fetch;

// 1. A hit is served from cache, not refetched.
assert.equal((await getTrack('1'))?.name, TRACK.name);
assert.equal((await getTrack('1'))?.name, TRACK.name);
assert.equal(calls.length, 1, 'second getTrack("1") should not hit the network');
console.log('ok  hit is cached, no refetch');

// 2. A 404 is cached as null and not retried — a missing track is as final as a hit.
calls = [];
reply = { ok: false, status: 404, body: { error: 'not found' } };
assert.equal(await getTrack('gone'), null);
assert.equal(await getTrack('gone'), null);
assert.equal(calls.length, 1, 'a 404 should be cached as null, not retried');
console.log('ok  404 is cached as null, not retried');

// 3. A transport failure is NOT cached: the next call must try again.
calls = [];
reply = { ok: true, status: 0, body: null };
await assert.rejects(() => getTrack('flaky'), /Cannot reach the API/);
assert.equal(calls.length, 1);
reply = { ok: true, status: 200, body: { provider: 'itunes', track: TRACK } };
assert.equal((await getTrack('flaky'))?.name, TRACK.name, 'a failed lookup must not poison the cache');
assert.equal(calls.length, 2);
console.log('ok  transport failure is not cached, retry succeeds');

// 4. An abort propagates and is NOT cached as null.
globalThis.fetch = (async () => {
  throw new DOMException('Aborted', 'AbortError');
}) as typeof fetch;
await assert.rejects(
  () => getTrack('aborted'),
  (e: unknown) => e instanceof DOMException && e.name === 'AbortError',
);
calls = [];
globalThis.fetch = (async (input: string) => {
  calls.push(input);
  return { ok: true, status: 200, json: async () => ({ provider: 'itunes', track: TRACK }) } as Response;
}) as typeof fetch;
assert.equal((await getTrack('aborted'))?.name, TRACK.name, 'an abort must not be cached as a missing track');
assert.equal(calls.length, 1);
console.log('ok  abort propagates and is not cached');

console.log('\napi.ts cache check passed');
