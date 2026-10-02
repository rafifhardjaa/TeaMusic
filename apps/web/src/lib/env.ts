/**
 * The only module in the client that reads `import.meta.env`.
 *
 * Every name here carries the `VITE_` prefix, and that prefix is the whole
 * boundary: Vite inlines `import.meta.env.VITE_*` into the bundle and leaves
 * everything else alone, so a backend variable (`APP_ENV`, `APP_DEBUG`, a
 * service-role key) has no path into a page source. Anything that needs
 * configuration imports it from here.
 *
 * The client's `APP_ENV`/`APP_DEBUG` are therefore mirrors, not the same
 * variables — the browser cannot read the API's, and the API cannot read
 * these.
 */

/**
 * Dashboards are where values get pasted wrong. The recurring shape is a whole
 * `NAME=value` line landing in the value field: the name would ship *inside*
 * the value, and every URL built from it would resolve against the site — a
 * health probe becomes `<site>/VITE_API_BASE_URL=https://…/api/health`, which
 * the SPA rewrite answers with `index.html` and a fake success. Unwrap that
 * one shape; an ordinary value comes back untouched.
 */
function unwrap(name: string, value: string | undefined): string {
  const raw = (value ?? '').trim();
  return raw.startsWith(`${name}=`) ? raw.slice(name.length + 1).trim() : raw;
}

/**
 * Fail closed the same way the API does: a build with no env file behaves as
 * production, so a deploy that forgot its configuration cannot end up
 * chatty. `.env.example` carries the production values; `.env.local` carries
 * the development ones and is never committed.
 */
const APP_ENV = unwrap('VITE_APP_ENV', import.meta.env.VITE_APP_ENV) || 'production';
export const APP_DEBUG =
  APP_ENV !== 'production' && unwrap('VITE_APP_DEBUG', import.meta.env.VITE_APP_DEBUG) === 'true';
export const IS_PRODUCTION = APP_ENV === 'production';

/**
 * Client-safe Supabase settings — publishable key, never a service-role key.
 *
 * The URL is normalized because the Supabase dashboard labels two different
 * things — the bare project URL and the REST URL (`…/rest/v1`) — and pasting
 * the second is the classic mistake: `supabase-js` appends `/rest/v1` itself,
 * so the query ends up at `/rest/v1/rest/v1/…` and 404s while the app reports
 * "Supabase unreachable". Stripping the suffix (and any trailing slash) means
 * either paste works.
 */
export const SUPABASE_URL = unwrap('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL)
  .replace(/\/rest\/v1\/?$/, '')
  .replace(/\/+$/, '');
export const SUPABASE_PUBLISHABLE_KEY = unwrap(
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

/**
 * Empty is the normal case — the dev server proxies `/api`, and a
 * same-origin deploy needs no prefix either.
 */
export const API_BASE_URL = unwrap('VITE_API_BASE_URL', import.meta.env.VITE_API_BASE_URL).replace(
  /\/$/,
  '',
);
