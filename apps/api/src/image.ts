import { Elysia, t } from 'elysia';
import { logError } from './log';

/**
 * Hosts we are willing to fetch on behalf of a client. Cover art comes from
 * Apple's CDN. The allowlist is what keeps this endpoint from being an open
 * proxy for the rest of the internet.
 */
const ALLOWED_HOST_SUFFIXES = ['mzstatic.com', 'apple.com'];

const CONTENT_TYPES: Record<string, string> = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
  'image/gif': 'image/gif',
  'image/avif': 'image/avif',
};

const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Suffix match rather than exact host, because Apple shards artwork across
 * many numbered subdomains (is1-ssl, is2-ssl, ...). The leading dot keeps a
 * lookalike domain like `evil-mzstatic.com` from matching.
 */
function isAllowedHost(hostname: string): boolean {
  return ALLOWED_HOST_SUFFIXES.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`));
}

export const imageRoutes = new Elysia({ prefix: '/api' }).get(
  '/image',
  async ({ query, set }) => {
    let target: URL;
    try {
      target = new URL(query.url);
    } catch {
      set.status = 400;
      return { error: 'Malformed image url' };
    }

    if (target.protocol !== 'https:' || !isAllowedHost(target.hostname)) {
      set.status = 403;
      return { error: 'Host is not on the allowlist' };
    }

    let upstream: Response;
    try {
      upstream = await fetch(target, { signal: AbortSignal.timeout(8000) });
    } catch {
      set.status = 502;
      return { error: 'Upstream image could not be fetched' };
    }

    if (!upstream.ok) {
      set.status = 502;
      // The upstream status is a detail about someone else's infrastructure.
      // It goes to the log when detail is on, and never to the client.
      logError(`[image] ${target.hostname} responded with ${upstream.status}`);
      return { error: 'Upstream image could not be fetched' };
    }

    const contentType = CONTENT_TYPES[upstream.headers.get('content-type')?.split(';')[0]?.trim() ?? ''];
    if (!contentType) {
      set.status = 415;
      return { error: 'Unsupported image type' };
    }

    const bytes = await upstream.arrayBuffer();
    if (bytes.byteLength > MAX_BYTES) {
      set.status = 413;
      return { error: 'Image too large' };
    }

    set.headers['content-type'] = contentType;
    set.headers['cache-control'] = 'public, max-age=86400, immutable';
    return new Uint8Array(bytes);
  },
  { query: t.Object({ url: t.String({ maxLength: 2048 }) }) },
);
