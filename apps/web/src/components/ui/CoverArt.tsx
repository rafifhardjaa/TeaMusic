import { useState, useMemo } from 'react';
import { apiUrl } from '../../lib/api';

interface Props {
  src: string;
  alt: string;
  className?: string;
  rounded?: string;
  /**
   * Appends a `cb=<timestamp>` query to the proxied URL so the browser does
   * not reuse a cached blob for a different cover art during export.
   */
  cacheBust?: boolean;
  /**
   * Routes the image through the API's `/api/image` proxy, resolved against
   * `VITE_API_BASE_URL` (in dev that is empty, so the Vite proxy keeps it
   * same-origin). A bare relative path only works when the API is hosted on
   * the same origin as the app — on the Vercel deploy it would hit the SPA
   * rewrite, answer with HTML, and drop the artwork out of the export.
   * Required on the export path: html-to-image re-fetches each <img> with
   * CORS, and a raw `cover_url` host that does not answer with CORS headers
   * fails that fetch, which would drop the artwork out of the PNG.
   */
  viaProxy?: boolean;
}

/**
 * Returns a stable timestamp for cache busting.
 */
function getCacheBustTimestamp(): number {
  return Date.now();
}

/**
 * The only place cover art is rendered. `cover_url` is a free-text column that
 * can legitimately be empty, and an empty `src` makes React throw, so the
 * placeholder path lives here rather than in four callers.
 */
export function CoverArt({ src, alt, className = '', rounded = 'rounded-lg', viaProxy = false, cacheBust = false }: Props) {
  const [failed, setFailed] = useState(false);
  const cacheBustTimestamp = useMemo(() => getCacheBustTimestamp(), []);

  if (!src || failed) {
    return (
      <div
        aria-hidden
        className={`shrink-0 bg-line/40 ${rounded} ${className}`}
        style={
          className.includes('h-') && className.includes('w-') ? undefined : { width: '100%', paddingTop: '100%' }
        }
      />
    );
  }

  const proxied = viaProxy ? `${apiUrl('/api/image')}?url=${encodeURIComponent(src)}` : src;
  const resolvedSrc = cacheBust
    ? `${proxied}${proxied.includes('?') ? '&' : '?'}cb=${cacheBustTimestamp}`
    : proxied;

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      /*
        Set on the export path only. The proxy answers with CORS for this
        site, so canvas reads inside html-to-image succeed either way; the
        attribute states the requirement and keeps the export working if the
        src is ever swapped for the CDN directly.
        Deliberately absent elsewhere: cover_url is free text from an untrusted
        column, and a host that answers without CORS headers would then fail to
        load at all.
      */
      crossOrigin={viaProxy ? 'anonymous' : undefined}
      loading={viaProxy ? 'eager' : 'lazy'}
      onError={() => setFailed(true)}
      className={`shrink-0 object-cover ${rounded} ${className}`}
    />
  );
}
