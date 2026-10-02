import assert from 'node:assert/strict';
import { createApp } from '../apps/api/src/app';
import { reconfigure } from '../apps/api/src/config';

/**
 * Self-check for the rate limiter (`apps/api/src/rateLimit.ts`).
 *
 * The failure it guards against is invisible in a single request: a limiter
 * that counts when it should not, forgets its TTL and lets a window live
 * forever, gates the wrong routes, or — the dangerous one — fails closed and
 * takes the API down with Upstash. So every one of those is driven through
 * the real app with a scripted Upstash stub: counts, TTL placement, the 429
 * shape the browser must be able to read, and both fail-open directions.
 *
 * Run: bun run check:ratelimit
 */

const UPSTASH = 'https://upstash.test';
const ORIGIN = 'https://teamusic.my.id';

/** Every command the app sent, in order — the assertions read this as a log. */
const calls: string[][] = [];
/** Counter behind the stubbed INCR; `fail` hijacks the next answer. */
let counter = 0;
let fail: 'reject' | 'http500' | null = null;

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url !== UPSTASH) throw new Error(`unexpected fetch: ${url}`);
  const command = JSON.parse(String(init?.body)) as string[];
  calls.push(command);
  if (command[0] === 'EXPIRE') return Response.json({ result: 1 });
  if (fail === 'reject') throw new Error('upstash unreachable');
  if (fail === 'http500') return new Response('busy', { status: 500 });
  counter += 1;
  return Response.json({ result: counter });
}) as typeof fetch;

/** Fresh config with the limiter on, plus a zeroed counter and call log. */
function arm(options: { limiter?: boolean } = {}): void {
  counter = 0;
  fail = null;
  calls.length = 0;
  reconfigure({
    APP_ENV: 'production',
    APP_DEBUG: 'false',
    ALLOWED_ORIGIN: ORIGIN,
    ...(options.limiter === false
      ? {}
      : { UPSTASH_REDIS_REST_URL: UPSTASH, UPSTASH_REDIS_REST_TOKEN: 'test-token' }),
  });
}

const app = createApp();
const hit = (path: string, init?: RequestInit): Promise<Response> =>
  app.handle(new Request(`http://api.test${path}`, init));

// -- without a binding the limiter is off, and never calls out -------------
arm({ limiter: false });
for (let i = 0; i < 5; i += 1) assert.equal((await hit('/api/meta')).status, 200);
assert.equal(calls.length, 0, 'no Upstash binding must mean no network traffic');

// -- hits are counted, and the TTL is set exactly once ---------------------
arm();
for (let i = 0; i < 30; i += 1) assert.equal((await hit('/api/meta')).status, 200, `hit ${i + 1}`);
assert.deepEqual(calls[0], ['INCR', 'rl:/api/meta:unknown'], 'a request without cf-connecting-ip shares one bucket');
assert.deepEqual(calls[1], ['EXPIRE', 'rl:/api/meta:unknown', '60'], 'the first hit opens a 60s window');
const expires = calls.filter((c) => c[0] === 'EXPIRE');
assert.equal(expires.length, 1, 'an EXPIRE per hit would slide the window forever');

// -- over the limit: a 429 the browser can actually read -------------------
const limited = await hit('/api/meta', { headers: { origin: ORIGIN } });
assert.equal(limited.status, 429);
assert.equal(limited.headers.get('retry-after'), '60');
assert.equal(limited.headers.get('access-control-allow-origin'), ORIGIN, 'the 429 must carry CORS or the browser cannot read it');
assert.deepEqual(await limited.json(), { error: 'Too many requests' });
assert.equal((await hit('/api/meta')).status, 429, 'the window does not reset by asking politely');

// -- routes without a rule never spend a round trip ------------------------
const before = calls.length;
assert.equal((await hit('/api/health')).status, 200, 'probes must not be gateable');
assert.equal(calls.length, before, '/api/health is not counted');

// -- preflight is answered before the limiter ------------------------------
const preflight = await hit('/api/meta', { method: 'OPTIONS', headers: { origin: ORIGIN } });
assert.equal(preflight.status, 204);
assert.equal(calls.length, before, 'an OPTIONS never spends a Redis round trip');

// -- /api/errors counts before validation, 11th report is refused ----------
arm();
for (let i = 0; i < 10; i += 1) {
  const res = await hit('/api/errors', { method: 'POST', body: '{}' });
  assert.equal(res.status, 422, 'an invalid body is still a counted hit');
}
const overErrors = await hit('/api/errors', { method: 'POST', body: '{}' });
assert.equal(overErrors.status, 429, 'the 11th error report inside the hour is refused');
assert.deepEqual(calls.filter((c) => c[0] === 'EXPIRE'), [['EXPIRE', 'rl:/api/errors:unknown', '3600']]);

// -- fail-open: Redis down must never take the API down --------------------
arm();
fail = 'reject';
assert.equal((await hit('/api/meta')).status, 200, 'a rejected connection fails open');
arm();
fail = 'http500';
assert.equal((await hit('/api/meta')).status, 200, 'a 500 from Upstash fails open');

globalThis.fetch = realFetch;
console.log('\nrate limit check passed');
