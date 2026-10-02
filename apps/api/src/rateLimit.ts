import { config } from './config';
import { log } from './log';

export interface RateLimitRule {
  /** Window length in seconds. The Redis key expires exactly with it. */
  windowSec: number;
  /** Hits one client address may spend inside one window. */
  max: number;
}

/**
 * What is counted, and how hard — the routes that cost somebody something.
 *
 * `/api/image` is a proxy that fetches from Apple on the caller's behalf:
 * the most expensive byte this API serves. `/api/errors` accepts an
 * unbounded public POST, which is the shape every abuse-control list starts
 * with. `/api/meta` is cheap but is the canary — it is the route the limit
 * is verified on in production, and a misconfigured limiter should surface
 * there before it ever gates artwork.
 *
 * `/api/health` is deliberately absent: uptime probes poll on a schedule
 * nobody controls, and a probe answered with 429 is a false alarm, not a
 * saved resource.
 */
const RULES: Record<string, RateLimitRule> = {
  '/api/image': { windowSec: 60, max: 30 },
  '/api/meta': { windowSec: 60, max: 30 },
  '/api/errors': { windowSec: 3600, max: 10 },
};

/**
 * Upstash is one continent away from a Cloudflare colo at worst; anything
 * slower than this is not worth holding a request open for. The timeout is
 * the fail-open switch: a slow limiter is a limiter that has stopped.
 */
const UPSTASH_TIMEOUT_MS = 1000;

/**
 * Runs one command against Upstash's REST endpoint. The API answers every
 * command as `{"result": …}` or `{"error": …}` — the error form is how
 * Redis itself reports trouble, so it is turned into a throw and handled by
 * the caller's fail-open path rather than parsed into a verdict.
 */
async function command(args: string[]): Promise<unknown> {
  const response = await fetch(config.upstashUrl, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.upstashToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(UPSTASH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`upstash answered ${response.status}`);
  const payload = (await response.json()) as { result?: unknown; error?: string };
  if (payload.error !== undefined) throw new Error(payload.error);
  return payload.result;
}

/**
 * Spends one hit against `pathname`'s window and reports whether the caller
 * is over it. `null` means "serve the request", and it is also the answer
 * when no rule matches, when no Upstash binding exists (the default for a
 * fresh dev process), and when Redis is slow, broken or unreachable.
 *
 * Fail-open is the whole design: a rate limiter is a brake pedal, never an
 * engine part. Counting wrong, or not counting at all, must cost one extra
 * allowed request — never a dead API.
 */
export async function checkRateLimit(
  pathname: string,
  ip: string | null,
): Promise<{ retryAfterSec: number } | null> {
  const rule = RULES[pathname];
  if (!rule) return null;
  if (!config.upstashUrl || !config.upstashToken) return null;

  // One bucket per route and address: the proxy budget of a heavy exporter
  // must not eat the meta budget of everyone behind the same carrier NAT.
  const key = `rl:${pathname}:${ip ?? 'unknown'}`;
  try {
    const count = Number(await command(['INCR', key]));
    // The TTL is set only when the window is born. An EXPIRE on every
    // increment would slide the window forward forever, and a steady visitor
    // would never earn a fresh one.
    if (count === 1) await command(['EXPIRE', key, String(rule.windowSec)]);
    if (count > rule.max) {
      log(`[ratelimit] ${pathname} over limit (${count}/${rule.max})`);
      // The exact remainder costs a second round trip (PTTL) for nobody's
      // benefit: the caller waits out the window either way, and a slightly
      // generous retry-after is the safe direction to be wrong in.
      return { retryAfterSec: rule.windowSec };
    }
  } catch {
    // Redis trouble is not the client's problem — let the request through.
  }
  return null;
}
