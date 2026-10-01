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
 * Fail closed the same way the API does: a build with no env file behaves as
 * production, so a deploy that forgot its configuration cannot end up
 * chatty. `.env.example` carries the production values; `.env.local` carries
 * the development ones and is never committed.
 */
const APP_ENV = import.meta.env.VITE_APP_ENV?.trim() || 'production';
export const APP_DEBUG = APP_ENV !== 'production' && import.meta.env.VITE_APP_DEBUG === 'true';
export const IS_PRODUCTION = APP_ENV === 'production';

/** Client-safe Supabase settings — publishable key, never a service-role key. */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
export const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';

/**
 * Empty is the normal case — the dev server proxies `/api`, and a
 * same-origin deploy needs no prefix either.
 */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
