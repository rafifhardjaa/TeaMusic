/**
 * Turns anything a browser sends into a single line that is safe to print on a
 * production console.
 *
 * `/api/errors` is deliberately unauthenticated, so this input is
 * attacker-controlled as much as accidental: a message can carry a stack
 * someone pasted in, a connection string, a token, or the path of the machine
 * that raised it. The rule is that none of those can come back out — the
 * breadcrumb records that something happened and where in the app it happened,
 * never where the code lives or what it was holding.
 */

/** A whole line that is a stack frame. Dropped before anything else runs. */
const STACK_FRAME = /^\s*at\s+/;

/** URLs are pulled out first so the path rule below never sees their innards. */
const URL_IN_TEXT = /\b[a-z][a-z0-9+.-]*:\/\/[^\s)"']+/gi;

const RULES: [RegExp, string][] = [
  // Absolute filesystem paths — Windows drive, UNC, then POSIX. The optional
  // tail swallows `:line:column` so the frame does not leak after the path.
  [/(?:[A-Za-z]:\\|\\\\)[^\s)"']+/g, '<path>'],
  [/\/(?:[\w.@+-]+\/)+[\w.@+-]+(?::\d+:\d+)?/g, '<path>'],
  // Variable assignments: APP_DEBUG=true, DATABASE_URL=..., VITE_*=.... The
  // name survives because it says what was configured; the value does not.
  [/\b([A-Z][A-Z0-9_]{2,})=[^\s]+/g, '$1=***'],
  // Credential shapes, in the order they are most likely to arrive.
  [/\bsb_(?:publishable|secret)[\w-]*/gi, 'sb_***'],
  [/\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]*/g, '<jwt>'],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer ***'],
  [/\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]+/g, '<key>'],
  [/\bAKIA[0-9A-Z]{16}\b/g, '<key>'],
  [/\b[0-9a-f]{32,}\b/gi, '<hex>'],
  // Quotes would break the quoting of the field this ends up inside.
  [/"/g, "'"],
];

/**
 * A public origin is public: `https://` keeps scheme and host and loses path,
 * query, fragment and credentials. Every other scheme is internal plumbing —
 * `postgres://db.internal:5432`, `redis://cache:6379` — so it loses the lot
 * rather than handing over a host and a port. `file://` is a path by another
 * name.
 */
function stripUrls(text: string): string {
  return text.replace(URL_IN_TEXT, (match) => {
    const scheme = match.slice(0, match.indexOf('://')).toLowerCase();
    if (scheme === 'file') return '<path>';
    if (scheme !== 'http' && scheme !== 'https') return '<url>';
    try {
      const url = new URL(match);
      return `${url.protocol}//${url.host}`;
    } catch {
      return '<url>';
    }
  });
}

/**
 * Sanitized, single-line, length-capped text for one field.
 *
 * Over-redaction is the correct failure: a field that loses a few characters
 * is a worse outcome than one that carries a secret, so the rules run in the
 * order that removes the most and keeps the least.
 */
export function safeText(value: string, max = 300): string {
  const withoutFrames = value
    .split('\n')
    .filter((line) => !STACK_FRAME.test(line))
    .join(' ');

  let text = stripUrls(withoutFrames);
  for (const [pattern, replacement] of RULES) text = text.replace(pattern, replacement);

  text = text.replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * The route, and only the route: origin plus pathname, with query and
 * fragment removed — that is where share links put ids and where a leaked
 * token would be sitting.
 */
export function safeLocation(href: string): string {
  try {
    const url = new URL(href);
    if (url.origin === 'null') return '<unknown>';
    return `${url.origin}${url.pathname}`;
  } catch {
    return '<unknown>';
  }
}

export interface BreadcrumbInput {
  where: string;
  name: string;
  message: string;
  href: string;
}

/**
 * One line: when, which part of the app, which route, what happened.
 *
 * Deliberately no stack and no component stack — those are debug-only. `now`
 * is a parameter so the check can assert on the timestamp it produces.
 */
export function breadcrumb(input: BreadcrumbInput, now: Date = new Date()): string {
  return [
    '[client-error]',
    now.toISOString(),
    `where="${safeText(input.where, 80)}"`,
    `name="${safeText(input.name, 80)}"`,
    `at="${safeLocation(input.href)}"`,
    `message="${safeText(input.message, 300)}"`,
  ].join(' ');
}
