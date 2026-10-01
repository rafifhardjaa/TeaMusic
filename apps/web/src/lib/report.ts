import { apiUrl } from './api';
import { APP_DEBUG, IS_PRODUCTION } from './env';

/**
 * One funnel for everything that goes wrong, instead of a `console.error` in
 * each catch block.
 *
 * The console half is what you read while developing, and it is behind the
 * same `APP_DEBUG` switch as the API's own logging — a production page does
 * not print stacks into a visitor's console. The transport half is the only
 * thing that reaches you in production: a throw caught by an ErrorBoundary has
 * already been swallowed by React, so nobody's console ever sees it once the
 * app is deployed.
 *
 * Reporting must never become a failure of its own. Every path here is wrapped,
 * the request is `keepalive` so it survives a reload (an uncaught error often
 * does get followed by one), and failures are dropped on the floor rather than
 * re-reported — which would recurse.
 */
const ENDPOINT = '/api/errors';

/**
 * Per page load, not per session. A broken render throws once per subtree, but
 * a stuck effect or a retry loop can throw on every tick; ten reports carry the
 * stack, the hundredth carries nothing the first ten did not.
 */
const MAX_REPORTS_PER_PAGE = 10;
let reported = 0;

/**
 * One key per distinct error.
 *
 * React hands a render error to the ErrorBoundary, and depending on version
 * also re-dispatches it at the window — so the same crash can arrive here from
 * two directions. Without this dedupe it is reported twice, and an error raised
 * independently from two places is reported twice too. Keys per page load are
 * naturally bounded; the clear is only a guard against a pathological flood of
 * unique messages.
 */
const seen = new Set<string>();

function keyFor(err: Error, where: string): string {
  const firstFrame = err.stack?.split('\n')[1] ?? '';
  return `${where} ${err.name} ${err.message} ${firstFrame}`;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export function reportError(
  error: unknown,
  where: string,
  extra?: { componentStack?: string | null },
): void {
  const err = error instanceof Error ? error : new Error(String(error));

  const key = keyFor(err, where);
  if (seen.has(key)) return;
  if (seen.size > 200) seen.clear();
  seen.add(key);

  // The console keeps the live object, not a stringified copy — that is what
  // makes the stack expandable in dev. Production prints nothing: the same
  // error is on its way to the API instead.
  if (APP_DEBUG) console.error(`[${where}]`, err, extra?.componentStack ?? undefined);

  if (!IS_PRODUCTION) return;
  if (reported >= MAX_REPORTS_PER_PAGE) return;
  reported += 1;

  try {
    void fetch(`${apiUrl(ENDPOINT)}`, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: truncate(err.message, 500),
        name: err.name,
        stack: truncate(err.stack ?? '', 6000),
        componentStack: truncate(extra?.componentStack ?? '', 6000),
        where: truncate(where, 200),
        href: truncate(window.location.href, 2000),
        at: new Date().toISOString(),
      }),
    }).catch(() => {
      // The API is optional. A visitor on a static-only deploy gets no reports,
      // which must not surface as a second error on top of the first.
    });
  } catch {
    // Absolute last resort: reporting is never allowed to throw.
  }
}

/**
 * Reports what React's boundaries do not reach: exceptions escaping event
 * handlers and async callbacks, and unhandled promise rejections.
 *
 * Installed in production only. The dev console already prints both of these
 * loudly and unhandled rejections do not need a second line under them; this
 * exists for the case where nobody is watching the console at all.
 *
 * Resource load failures are skipped — they arrive as the same event with no
 * `error` attached, and a missing font is not the same class of problem as a
 * thrown TypeError.
 */
export function installGlobalReporting(): void {
  if (!IS_PRODUCTION) return;

  window.addEventListener('error', (event) => {
    if (!event.error) return;
    reportError(event.error, 'window.onerror');
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportError(event.reason, 'unhandledrejection');
  });
}
