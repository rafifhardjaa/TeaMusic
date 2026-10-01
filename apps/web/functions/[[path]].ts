/**
 * The share-preview injector.
 *
 * A `/?m=<id>` link is opened in one of two very different ways: by a person,
 * who gets the React app, and by WhatsApp / Instagram / Telegram, which fetch
 * the URL once, read the `<head>`, and never run a line of JavaScript. The
 * crawler therefore has to be told what the message *is* from the HTML it
 * receives, which means the row has to be fetched here, at the edge, and
 * written into the tags before the response leaves.
 *
 * Only the two shareable routes are routed through this function (see
 * `public/_routes.json`); every other request keeps the static path and costs
 * no invocation. The defaults in `index.html` cover the rest, so a Supabase
 * outage degrades to a generic card instead of an error page.
 *
 * Runs on Cloudflare Workers — no Node APIs, no bundler imports. The helpers
 * are exported so `scripts/seo.check.ts` can assert on them directly.
 */

const SITE = 'https://teamusic.my.id';

/** Long enough for a cold Supabase row, short enough not to stall a crawler. */
const FETCH_TIMEOUT_MS = 2500;

/**
 * The card is a link people re-open for a week; five minutes at the edge is
 * enough to absorb a burst of shares without serving a stale recipient name.
 */
const CACHE_CONTROL = 'public, max-age=300';

export interface Env {
  ASSETS: { fetch(input: RequestInfo | URL): Promise<Response> };
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

export interface PagesContext {
  request: Request;
  env: Env;
}

/** What ends up in the crawlers' preview. */
export interface Card {
  title: string;
  description: string;
  url: string;
  image?: { url: string; width: number; height: number; alt: string };
}

interface MessageRow {
  id: string;
  recipient: string;
  message: string;
  track_name: string;
  artist_name: string;
  cover_url: string;
}

/** Keys this function owns. Anything not listed here stays as built. */
const OWNED_KEYS = new Set([
  'description',
  'og:title',
  'og:description',
  'og:url',
  'og:image',
  'og:image:width',
  'og:image:height',
  'og:image:alt',
  'twitter:title',
  'twitter:description',
  'twitter:image',
  'twitter:image:alt',
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Every user-supplied string that lands in an attribute or a text node. */
export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Caps the copy so a wall of text cannot become the whole preview. */
export function truncate(value: string, max: number): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * iTunes hands out a thumbnail URL and the API only ever rewrites it to 600px
 * (`apps/api/src/itunes.ts`); a link preview wants a larger source so the card
 * is not interpolated up from a stamp.
 */
export function upsizeCover(url: string): string {
  if (!url.startsWith('https://')) return '';
  return url.replace(/\/\d+x\d+bb\.(jpg|png)/, '/1000x1000bb.$1');
}

/** PostgREST passes the pattern straight to LIKE, whose escape character is `\`. */
function likePattern(term: string): string {
  const escaped = term.replace(/[\\%_]/g, (char) => `\\${char}`);
  return encodeURIComponent(`%${escaped}%`);
}

function titleCase(value: string): string {
  return value.replace(/\b[\p{L}]/gu, (char) => char.toUpperCase());
}

async function supabaseSelect(env: Env, search: string): Promise<MessageRow[]> {
  const base = env.VITE_SUPABASE_URL?.replace(/\/+$/, '');
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) return [];

  const select = 'id,recipient,message,track_name,artist_name,cover_url';
  const response = await fetch(`${base}/rest/v1/messages?select=${select}&${search}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) return [];

  const rows: unknown = await response.json();
  return Array.isArray(rows) ? (rows as MessageRow[]) : [];
}

/** `/?m=<id>` — the card the sender hands to the person they sent it to. */
function messageCard(message: MessageRow, id: string): Card {
  const recipient = truncate(message.recipient, 40) || 'you';
  const track = `${message.track_name} — ${message.artist_name}`;
  const note = truncate(message.message, 200);

  return {
    title: `A song for ${recipient}`,
    // The note is the point of the link; the track only fills in when the
    // sender left nothing to say beyond the song itself.
    description: note || truncate(track, 200),
    url: `${SITE}/?m=${encodeURIComponent(id)}`,
    image: coverCard(message, `Cover art for ${track}`),
  };
}

/** `/to/<name>` — the recipient's own link, previewing the newest whisper. */
function inboxCard(latest: MessageRow | undefined, name: string): Card {
  const display = titleCase(truncate(name, 40)) || 'Someone';
  const card: Card = {
    title: `Whispers for ${truncate(name, 40)}`,
    description: latest
      ? `${display}, someone said this. Anonymous song messages waiting, newest first.`
      : `Everything addressed to ${truncate(name, 60)}, newest first. No sender is stored.`,
    url: `${SITE}/to/${encodeURIComponent(name)}`,
  };
  if (latest) card.image = coverCard(latest, `Cover art for ${latest.track_name}`);
  return card;
}

function coverCard(message: MessageRow, alt: string) {
  const url = upsizeCover(message.cover_url);
  if (!url) return undefined;
  return { url, width: 1000, height: 1000, alt: truncate(alt, 100) };
}

function meta(property: string, content: string): string {
  return `<meta property="${property}" content="${escapeHtml(content)}" />`;
}

function metaNamed(name: string, content: string): string {
  return `<meta name="${name}" content="${escapeHtml(content)}" />`;
}

/**
 * Swaps the built-in tags for this card's, rather than appending beside them:
 * two `og:title` tags leave the crawler guessing which one to show.
 */
export function applyCard(html: string, card: Card): string {
  const stripped = html
    .replace(/<meta\s[^>]*>/g, (tag) => {
      const key = /\s(?:property|name)="([^"]+)"/.exec(tag)?.[1];
      return key && OWNED_KEYS.has(key) ? '' : tag;
    })
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<link rel="canonical"[^>]*>/i, '');

  const tags = [
    `<title>${escapeHtml(card.title)}</title>`,
    `<link rel="canonical" href="${escapeHtml(card.url)}" />`,
    metaNamed('description', card.description),
    meta('og:title', card.title),
    meta('og:description', card.description),
    meta('og:url', card.url),
  ];

  if (card.image) {
    tags.push(
      meta('og:image', card.image.url),
      meta('og:image:width', String(card.image.width)),
      meta('og:image:height', String(card.image.height)),
      meta('og:image:alt', card.image.alt),
    );
  }

  tags.push(
    metaNamed('twitter:title', card.title),
    metaNamed('twitter:description', card.description),
  );
  if (card.image) tags.push(metaNamed('twitter:image', card.image.url), metaNamed('twitter:image:alt', card.image.alt));

  const block = tags.join('\n    ');
  // The whitespace before </head> is eaten rather than preserved: stripping
  // the old tags leaves their line breaks behind, and consuming them here is
  // what makes a second application of the same card byte-identical.
  return stripped.replace(/\s*<\/head>/, `\n  ${block}\n  </head>`);
}

/** Resolves the route to a card, or `null` to serve the built-in preview. */
export async function resolveCard(url: URL, env: Env): Promise<Card | null> {
  const messageId = url.searchParams.get('m')?.trim();
  if (messageId && UUID.test(messageId)) {
    const [message] = await supabaseSelect(env, `id=eq.${encodeURIComponent(messageId)}&limit=1`);
    return message ? messageCard(message, messageId) : null;
  }

  const inbox = /^\/to\/([^/]+)\/?$/.exec(url.pathname);
  if (inbox) {
    const name = decodeURIComponent(inbox[1]).trim();
    if (!name) return null;
    const [latest] = await supabaseSelect(
      env,
      `recipient=ilike.${likePattern(name)}&order=created_at.desc&limit=1`,
    );
    return inboxCard(latest, name);
  }

  return null;
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);

  // GET and HEAD are the only methods a crawler or a browser uses here; the
  // rest fall through to the static asset untouched.
  if (request.method !== 'GET' && request.method !== 'HEAD') return env.ASSETS.fetch(request);

  // The asset binding has no SPA fallback of its own, so every shareable path
  // is answered with the document root, which is where the built-in tags live.
  const asset = await env.ASSETS.fetch(new Request(new URL('/', url)));
  if (!asset.ok) return asset;

  let body = await asset.text();
  try {
    const card = await resolveCard(url, env);
    if (card) body = applyCard(body, card);
  } catch {
    // A crawler that cannot reach Supabase still gets the generic card.
  }

  const headers = new Headers({ 'content-type': 'text/html; charset=utf-8', 'cache-control': CACHE_CONTROL });
  return request.method === 'HEAD' ? new Response(null, { status: 200, headers }) : new Response(body, { headers });
}
