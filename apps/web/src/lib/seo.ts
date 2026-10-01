/**
 * Keeps the document head telling the truth about the route on screen.
 *
 * The crawlers get their tags from `index.html` (and, for share links, from
 * the edge function), because they never run this code. What follows is for
 * the visitor: the tab title, the description a search result would read if a
 * human shares a live URL, and the canonical link — all of which go stale the
 * moment a single-page app navigates without reloading.
 *
 * Every value here is derived from the location, never from an env var, so
 * this stays inside the client boundary `check:security` enforces.
 */

export interface PageSeo {
  title: string;
  description: string;
  /** Path (or path + query) this page claims as its own. */
  path: string;
  /** False for routes that should not be indexed, i.e. the 404. */
  index: boolean;
}

const INDEX_ROBOTS = 'index, follow, max-image-preview:large, max-snippet:-1';

function setMeta(attr: 'name' | 'property', key: string, content: string): void {
  const existing = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  const el = existing ?? document.createElement('meta');
  el.setAttribute(attr, key);
  el.setAttribute('content', content);
  if (!existing) document.head.appendChild(el);
}

function setCanonical(href: string): void {
  const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  const el = existing ?? document.createElement('link');
  el.setAttribute('rel', 'canonical');
  el.setAttribute('href', href);
  if (!existing) document.head.appendChild(el);
}

/** Writes the whole head in one pass, so no field is left half-updated. */
export function applyPageSeo({ title, description, path, index }: PageSeo): void {
  const url = new URL(path, window.location.origin).href;

  document.title = title;
  setMeta('name', 'description', description);
  setMeta('name', 'robots', index ? INDEX_ROBOTS : 'noindex, nofollow');
  setCanonical(url);
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:url', url);
  setMeta('name', 'twitter:title', title);
  setMeta('name', 'twitter:description', description);
}

/** Clamps copy the same way the edge function does, without importing it. */
function clamp(value: string, max: number): string {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * A path arrives percent-encoded and may be malformed — `/to/100%` is a URL a
 * person can type. Decoding it must not take the app down for a page nobody
 * will index anyway, so the raw name is the fallback rather than a throw.
 */
function decodePath(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** The head for a route, keyed off the path the router is showing. */
export function routeSeo(pathname: string): PageSeo {
  if (pathname === '/') {
    return {
      title: 'TeaMusic — Say Te Amo With a Track',
      description: 'TeaMusic — send an anonymous song message, then mix it by zodiac and mood.',
      path: '/',
      index: true,
    };
  }
  if (pathname === '/browse') {
    return {
      title: 'Browse the whispers — TeaMusic',
      description: 'Every whisper sent on TeaMusic, newest first. Mix them by zodiac and mood.',
      path: '/browse',
      index: true,
    };
  }
  if (pathname === '/history') {
    return {
      title: 'Your history — TeaMusic',
      description: 'The tracks you sent from this browser, waiting where you left them.',
      path: '/history',
      // Personal and local: robots.txt already blocks the crawl, and the
      // noindex keeps it out of an index that gets there some other way.
      index: false,
    };
  }
  if (pathname === '/to') {
    return {
      title: 'Your whispers — TeaMusic',
      description: 'Enter the name people whisper to you and they will gather here.',
      path: '/to',
      index: true,
    };
  }
  if (pathname.startsWith('/to/')) {
    const name = decodePath(pathname.slice('/to/'.length)).trim();
    return {
      title: `Whispers for ${clamp(name, 40)} — TeaMusic`,
      description: `Everything addressed to ${clamp(name, 60)}, newest first. No sender is stored.`,
      path: pathname,
      index: true,
    };
  }
  return {
    title: 'Nothing here — TeaMusic',
    description: 'That page does not exist.',
    path: pathname,
    index: false,
  };
}

/** The head for an open message, matching the copy the modal shows. */
export function messageSeo(message: { id: string; recipient: string; message: string; trackName: string; artistName: string }): PageSeo {
  const note = message.message.trim();
  const track = `${message.trackName} — ${message.artistName}`;
  return {
    title: `A song for ${clamp(message.recipient, 40) || 'you'} — TeaMusic`,
    description: clamp(note || track, 200),
    path: `/?m=${encodeURIComponent(message.id)}`,
    index: true,
  };
}
