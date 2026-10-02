import assert from 'node:assert/strict';
import { getHealth, getTrack } from '../src/lib/api';
import type { Track } from '../src/lib/types';

/**
 * Self-check for the getTrack cache.
 *
 * The cache has four branches where a mistake is silent: a wrongly cached null
 * reads as "no track" and kills preview playback, and a cached abort reads as
 * a permanently missing track after a single cancelled request. Both fail only
 * at runtime, in a browser, with no error — so they are pinned here instead.
 *
 * The mocked replies are the provider's own shape (`{ results: [...] }`),
 * because the browser now calls iTunes directly: api.ts maps each item to a
 * Track itself, and the mapping is exercised by every assertion below.
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

/** What iTunes actually returns; `upscaleArtwork` leaves a non-CDN url alone. */
const ITEM = {
  trackId: 1,
  trackName: TRACK.name,
  artistName: TRACK.artist,
  collectionName: TRACK.album,
  primaryGenreName: TRACK.genre,
  artworkUrl100: TRACK.coverUrl,
  previewUrl: TRACK.previewUrl,
  trackTimeMillis: TRACK.durationMs,
  trackViewUrl: TRACK.externalUrl,
};

type Reply = { ok: boolean; status: number; body: unknown };
let reply: Reply = { ok: true, status: 200, body: { resultCount: 1, results: [ITEM] } };
let calls: string[] = [];

globalThis.fetch = (async (input: string) => {
  calls.push(input);
  if (reply.status === 0) throw new TypeError('connection refused');
  return {
    ok: reply.ok,
    status: reply.status,
    json: async () => {
      // Real response.json() rejects on a non-JSON body (e.g. index.html),
      // which is how the SPA-rewrite case arrives.
      if (reply.body === undefined) throw new SyntaxError('Unexpected token <');
      return reply.body;
    },
  } as Response;
}) as typeof fetch;

// 1. A hit is served from cache, not refetched.
assert.equal((await getTrack('1'))?.name, TRACK.name);
assert.equal((await getTrack('1'))?.name, TRACK.name);
assert.equal(calls.length, 1, 'second getTrack("1") should not hit the network');
console.log('ok  hit is cached, no refetch');

// 2. An id the provider does not know answers with an empty result set, which
//    is cached as null and not retried — a missing track is as final as a hit.
calls = [];
reply = { ok: true, status: 200, body: { resultCount: 0, results: [] } };
assert.equal(await getTrack('gone'), null);
assert.equal(await getTrack('gone'), null);
assert.equal(calls.length, 1, 'an empty lookup should be cached as null, not retried');
console.log('ok  empty result set is cached as null, not retried');

// 3. A transport failure is NOT cached: the next call must try again. The
//    failure itself is also retried once in place (1.2s backoff) before it
//    surfaces, so one dropped connection does not end the search.
calls = [];
reply = { ok: true, status: 0, body: null };
await assert.rejects(() => getTrack('flaky'), /Could not reach Apple/);
assert.equal(calls.length, 2, 'a transport failure should be retried once before it throws');
reply = { ok: true, status: 200, body: { resultCount: 1, results: [ITEM] } };
assert.equal((await getTrack('flaky'))?.name, TRACK.name, 'a failed lookup must not poison the cache');
assert.equal(calls.length, 3);
console.log('ok  transport failure retried once, not cached, later call succeeds');

// 3b. A rate-limit refusal is NOT cached either —429 is about the moment, not
//     about the track, and caching it would hide the track for the session.
//     It gets the same single retry, and its own honest message: Apple's raw
//     errorMessage ("rate limited") reads like the page is broken.
calls = [];
reply = { ok: false, status: 429, body: { errorMessage: 'rate limited' } };
await assert.rejects(() => getTrack('throttled'), /rate-limiting this network/);
assert.equal(calls.length, 2, 'a 429 should be retried once before it throws');
reply = { ok: true, status: 200, body: { resultCount: 1, results: [ITEM] } };
assert.equal((await getTrack('throttled'))?.name, TRACK.name, 'a rate limit must not poison the cache');
assert.equal(calls.length, 3);
console.log('ok  rate-limit refusal retried once, not cached, later call succeeds');

// 4. A 2xx that is not JSON must not read as a healthy backend: a wrong
//    API_BASE_URL hits the SPA rewrite, which answers with index.html.
calls = [];
reply = { ok: true, status: 200, body: undefined };
await assert.rejects(() => getHealth(), /non-JSON/);
console.log('ok  non-JSON 2xx is rejected, not a fake success');

// 5. An abort propagates and is NOT cached as null.
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
  return { ok: true, status: 200, json: async () => ({ resultCount: 1, results: [ITEM] }) } as Response;
}) as typeof fetch;
assert.equal((await getTrack('aborted'))?.name, TRACK.name, 'an abort must not be cached as a missing track');
assert.equal(calls.length, 1);
console.log('ok  abort propagates and is not cached');

console.log('\napi.ts cache check passed');
