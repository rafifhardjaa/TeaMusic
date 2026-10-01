import type { Track } from './domain';

interface ITunesTrack {
  kind: string;
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName: string;
  artworkUrl100: string;
  previewUrl: string | null;
  trackTimeMillis: number;
  trackViewUrl: string;
  primaryGenreName: string;
}

/**
 * iTunes only serves 100px artwork. Its CDN path is templated, so swapping the
 * size segment is the supported way to ask for a larger image.
 */
function upscaleArtwork(url: string): string {
  return url.replace(/\/100x100bb\.(jpg|png)$/, '/600x600bb.$1');
}

function toTrack(item: ITunesTrack): Track {
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

const SEARCH_ENDPOINT = 'https://itunes.apple.com/search';
const LOOKUP_ENDPOINT = 'https://itunes.apple.com/lookup';
const STOREFRONT = 'US';
const TIMEOUT_MS = 8000;

async function fetchJson(url: URL): Promise<{ results: ITunesTrack[] }> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`iTunes responded with status ${response.status}`);
  }

  return (await response.json()) as { results: ITunesTrack[] };
}

/**
 * Only returns tracks that carry a preview clip.
 *
 * `messages.preview_url` is NOT NULL in the schema, so surfacing a track the
 * user cannot actually send would guarantee a failed insert. Measured across
 * ~500 US storefront song results this filter removes nothing in practice; it
 * exists so the constraint is a statement about the data rather than a hope.
 */
export async function searchTracks(query: string, limit = 12): Promise<Track[]> {
  const url = new URL(SEARCH_ENDPOINT);
  url.searchParams.set('term', query);
  url.searchParams.set('entity', 'song');
  url.searchParams.set('media', 'music');
  url.searchParams.set('country', STOREFRONT);
  url.searchParams.set('limit', String(clampLimit(limit, 50)));

  const payload = await fetchJson(url);
  return payload.results
    .filter((item) => Boolean(item.trackId) && Boolean(item.previewUrl))
    .map(toTrack)
    .slice(0, limit);
}

/**
 * iTunes has no route for "track by id alone" other than lookup, which is
 * exactly what the detail modal needs to recover a preview URL for a message
 * that only stored its id.
 */
export async function lookupTrack(trackId: string): Promise<Track | null> {
  const url = new URL(LOOKUP_ENDPOINT);
  url.searchParams.set('id', trackId);
  url.searchParams.set('entity', 'song');
  url.searchParams.set('country', STOREFRONT);

  const payload = await fetchJson(url);
  const first = payload.results.find((item) => item.trackId);
  return first ? toTrack(first) : null;
}

function clampLimit(value: number, max: number): number {
  return Math.min(max, Math.max(1, Math.round(value)));
}
