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
  return payload as T;
}

export function getHealth(signal?: AbortSignal): Promise<ApiHealth> {
  return request<ApiHealth>('/api/health', { signal });
}

export async function searchTracks(query: string, limit = 12, signal?: AbortSignal): Promise<Track[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const { tracks } = await request<{ provider: string; tracks: Track[] }>(`/api/tracks/search?${params}`, { signal });
  return tracks;
}

/**
 * Track lookups, keyed by iTunes id.
 *
 * A track id is immutable, so a hit cannot go stale within a session. This is
 * the app's only repeat traffic: the detail modal re-requests the same track on
 * every open, and seed hydration requests three more.
 *
 * 404s are cached as `null` on purpose — a missing track is as final as a hit,
 * and re-asking for one gains nothing. Aborts and transport failures are not
 * cached, since both are expected to succeed on a retry.
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

  try {
    const { track } = await request<{ provider: string; track: Track }>(
      `/api/tracks/${encodeURIComponent(id)}`,
      { signal },
    );
    trackCache.set(id, track);
    return track;
  } catch (error) {
    // Rethrown untouched so an aborted lookup stays abortable for the caller,
    // and must not poison the cache with a null the caller reads as "no track".
    if (isAbortError(error)) throw error;
    if (error instanceof ApiError && error.status === 404) {
      trackCache.set(id, null);
      return null;
    }
    throw error;
  }
}
