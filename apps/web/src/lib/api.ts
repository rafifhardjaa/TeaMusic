import { API_BASE_URL } from './env';
import type { ApiHealth, Track } from './types';
import { isAbortError } from './useLatestRequest';

/**
 * Absolute URL for an API path. Empty `API_BASE_URL` is the normal case — the
 * dev server proxies `/api`, and a same-origin deploy needs no prefix either.
 */
export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit & { signal?: AbortSignal }): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new ApiError('Cannot reach the API. Is apps/api running on port 8787?', 0);
  }

  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null;

  if (!response.ok) {
    throw new ApiError(payload?.error ?? `Request failed with status ${response.status}`, response.status);
  }
  // A 2xx that is not JSON never comes from this API — the usual cause is a
  // wrong `VITE_API_BASE_URL` landing on the SPA rewrite, which answers any
  // path with `index.html`. Reading that as success would let the health
  // probe vouch for a backend that is not there.
  if (payload === null) {
    throw new ApiError('API answered with a non-JSON body. Check VITE_API_BASE_URL.', response.status);
  }
  return payload as T;
}

export function getHealth(signal?: AbortSignal): Promise<ApiHealth> {
  return request<ApiHealth>('/api/health', { signal });
}

/**
 * The provider is called from the browser, not through this API: iTunes
 * answers with `access-control-allow-origin: *` (preflight included), so the
 * request carries the visitor's own address — the one thing a shared server
 * cannot borrow. Apple rate-limits datacenter egress into the ground (a
 * Cloudflare Worker got 403/429 on every call), while a residential client
 * sits well inside the documented ~20 requests per minute.
 */
const ITUNES_SEARCH = 'https://itunes.apple.com/search';
const ITUNES_LOOKUP = 'https://itunes.apple.com/lookup';
const STOREFRONT = 'US';

/**
 * One automatic retry, this far apart. Both failures this guards against are
 * transient: a carrier NAT address or iCloud Private Relay shares one public
 * IP with enough strangers to trip Apple's ~20/min budget at any moment, and
 * a single dropped connection should not end the search. A silent second
 * attempt beats an error toast the visitor can do nothing about.
 */
const ITUNES_RETRY_DELAY_MS = 1200;

/**
 * Backoff that stays honest about aborts: cancelling during the wait surfaces
 * as an AbortError instead of resolving as a retry that already happened.
 */
function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Turns a bare transport failure into the truth, by asking a separate
 * question: can this device reach the host at all?
 *
 * A `no-cors` probe needs no headers to succeed — an opaque response resolves
 * whatever status comes back, so "the network is alive" survives even an
 * answer Apple refuses to serve with CORS (error responses carry no
 * `access-control-allow-origin`, which WebKit reports as the same TypeError
 * as a dead connection; that is how an iPhone on a shared or filtered network
 * ends up blaming its own connection). If the probe also throws, nothing on
 * this device can reach the host — a blocked DNS, a content filter, or a
 * network that simply does not route it, not a flaky request.
 */
async function explainTransport(url: URL, signal?: AbortSignal): Promise<ApiError> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return new ApiError('You are offline. Reconnect, then search again.', 0);
  }

  try {
    await fetch(url, { mode: 'no-cors', cache: 'no-store', signal });
    return new ApiError(
      'Apple refused this request — your network is likely rate-limited. Wait a minute or switch networks.',
      0,
    );
  } catch (error) {
    if (isAbortError(error)) throw error;
    return new ApiError(
      'This device cannot reach itunes.apple.com. Try another network, or check for a VPN or content filter.',
      0,
    );
  }
}

interface ITunesItem {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName: string;
  primaryGenreName: string;
  artworkUrl100: string;
  previewUrl: string | null;
  trackTimeMillis: number;
  trackViewUrl: string;
}

/** iTunes only serves 100px artwork. Its CDN path is templated, so swapping
 * the size segment is the supported way to ask for a larger one. */
function upscaleArtwork(url: string): string {
  return url.replace(/\/100x100bb\.(jpg|png)$/, '/600x600bb.$1');
}

function toTrack(item: ITunesItem): Track {
  return {
    id: String(item.trackId),
    name: item.trackName,
    artist: item.artistName,
    album: item.collectionName,
    genre: item.primaryGenreName,
    coverUrl: upscaleArtwork(item.artworkUrl100),
    previewUrl: item.previewUrl,
    durationMs: item.trackTimeMillis,
    externalUrl: item.trackViewUrl,
  };
}

function clampLimit(value: number, max: number): number {
  return Math.min(max, Math.max(1, Math.round(value)));
}

async function itunes<T>(url: URL, signal?: AbortSignal): Promise<T> {
  // A refusal from Apple itself (429) keeps its own message; a transport
  // failure only records that the network, not Apple, said no.
  let refusal: ApiError | null = null;
  let transportFailed = false;

  // Two attempts at most. The second follows only a failure; any other
  // refusal is answered once and taken at face value.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) await wait(ITUNES_RETRY_DELAY_MS, signal);

    let response: Response;
    try {
      response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    } catch (error) {
      if (isAbortError(error)) throw error;
      // A WebKit TypeError also hides a 429 that arrived without CORS headers —
      // the browser refuses the response before the page can read it, which is
      // how an iPhone on a shared or filtered network used to report a dead
      // connection while the same page on Android was fine. Whether this is
      // throttling or a blocked host cannot be told from here; the retry above
      // runs first, and explainTransport() decides the message if both fail.
      transportFailed = true;
      continue;
    }

    const payload = (await response.json().catch(() => null)) as (T & { errorMessage?: string }) | null;

    if (response.status === 429) {
      // Shared address over the ~20/min budget. Apple's own errorMessage just
      // says "rate limited"; naming the cause saves the visitor from checking
      // a connection that is working fine.
      refusal = new ApiError('Apple is rate-limiting this network. Try again in a minute.', 429);
      continue;
    }
    if (!response.ok) {
      // Anything else is a fact about this request, not the moment — thrown,
      // never cached, so the next attempt asks again.
      throw new ApiError(payload?.errorMessage ?? `iTunes request failed with status ${response.status}`, response.status);
    }
    return payload as T;
  }

  // The loop exits only through `continue`, so at least one failure is
  // recorded. A 429 from the second attempt outranks a transport guess: it is
  // Apple speaking, not the network.
  if (refusal) throw refusal;
  if (transportFailed) throw await explainTransport(url, signal);
  throw new ApiError('iTunes request failed.', 0); // unreachable
}

/**
 * Only returns tracks that carry a preview clip.
 *
 * `messages.preview_url` is NOT NULL in the schema, so surfacing a track the
 * user cannot actually send would guarantee a failed insert. Measured across
 * ~500 US storefront song results this filter removes nothing in practice; it
 * exists so the constraint is a statement about the data rather than a hope.
 */
export async function searchTracks(query: string, limit = 12, signal?: AbortSignal): Promise<Track[]> {
  const url = new URL(ITUNES_SEARCH);
  url.searchParams.set('term', query);
  url.searchParams.set('entity', 'song');
  url.searchParams.set('media', 'music');
  url.searchParams.set('country', STOREFRONT);
  url.searchParams.set('limit', String(clampLimit(limit, 50)));

  const payload = await itunes<{ results: ITunesItem[] }>(url, signal);
  return payload.results
    .filter((item) => Boolean(item.trackId) && Boolean(item.previewUrl))
    .map(toTrack)
    .slice(0, limit);
}

/**
 * Track lookups, keyed by iTunes id.
 *
 * A track id is immutable, so a hit cannot go stale within a session. This is
 * the app's only repeat traffic: the detail modal re-requests the same track on
 * every open, and seed hydration requests three more.
 *
 * An id iTunes does not know answers with an empty result set — as final as a
 * hit, and cached as null for the same reason. Aborts, transport failures and
 * rate-limit refusals are never cached; the last two are retried once inside
 * `itunes()` first, since both are expected to succeed moments later.
 *
 * ponytail: unbounded for the life of the tab. Fine at session scale; a visitor
 * opening thousands of distinct tracks should cap it (LRU by insertion order).
 */
const trackCache = new Map<string, Track | null>();

/**
 * Recovers a full track from a bare id. Messages only persist the id, so this
 * is how the detail modal gets hold of a preview URL.
 */
export async function getTrack(id: string, signal?: AbortSignal): Promise<Track | null> {
  if (trackCache.has(id)) return trackCache.get(id) ?? null;

  const url = new URL(ITUNES_LOOKUP);
  url.searchParams.set('id', id);
  url.searchParams.set('entity', 'song');
  url.searchParams.set('country', STOREFRONT);

  const payload = await itunes<{ results: ITunesItem[] }>(url, signal);
  const first = payload.results.find((item) => item.trackId);
  const track = first ? toTrack(first) : null;
  trackCache.set(id, track);
  return track;
}
