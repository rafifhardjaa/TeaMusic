import { Elysia, t } from 'elysia';
import { config } from './config';
import { ZODIAC_SIGNS, MOODS } from './domain';
import { imageRoutes } from './image';
import { lookupTrack, searchTracks } from './itunes';
import { log, logBreadcrumb, logError } from './log';

/**
 * The API owns provider integration. Message persistence is deliberately
 * absent: the browser talks to Supabase directly with the publishable key, per
 * ARCHITECTURE.md ("Supabase handles direct data insertion and retrieval").
 */

/**
 * CORS for the one case that needs it: a deploy where the frontend and this API
 * are on different origins (Cloudflare Pages + a separate API host). During
 * development the Vite proxy makes everything same-origin, so these headers
 * change nothing locally.
 *
 * Exactly one origin is echoed back — the configured ALLOWED_ORIGIN, never
 * `*` and never a reflected unknown Origin. A request without an Origin header
 * (curl, server-to-server) is not a CORS request and gets no headers at all.
 */
/**
 * A browser lowercases the host of an Origin header; an env file is typed by
 * hand and may arrive with a capital, a trailing slash or a stray space. The
 * comparison normalizes the configured value once, at load, so a deploy does
 * not fail closed for a reason nobody would think to check. The echoed origin
 * stays exactly what the browser sent, which is what the spec asks for.
 */
const allowedOrigin = (config.allowedOrigin.trim().replace(/\/+$/, '') || '').toLowerCase();

const corsHeaders = (origin: string): Record<string, string> => ({
  'access-control-allow-origin': origin,
  vary: 'Origin',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
});

const app = new Elysia()
  .onRequest(({ request, set }) => {
    const origin = request.headers.get('origin');
    const allowed = origin !== null && origin.toLowerCase() === allowedOrigin;

    // Preflight is answered here with no body: routing past this point would
    // 404 an OPTIONS request, and the browser needs the 204 to proceed.
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: allowed && origin !== null ? corsHeaders(origin) : { vary: 'Origin' },
      });
    }

    if (allowed && origin !== null) {
      Object.assign(set.headers, corsHeaders(origin));
    }
  })
  /**
   * Nothing that describes this process — a raw exception, a provider's status
   * text, a stack — reaches a client unless the deploy has explicitly turned
   * detail on. Anything unhandled is an "Internal Server Error", full stop.
   */
  .onError(({ code, error, set }) => {
    if (code === 'VALIDATION') {
      set.status = 422;
      return { error: 'Invalid request' };
    }
    if (code === 'NOT_FOUND') {
      set.status = 404;
      return { error: 'Not found' };
    }

    set.status = 500;
    if (config.debug) {
      logError(`[${code}]`, error);
      return { error: error instanceof Error ? error.message : 'Internal error' };
    }
    return { error: 'Internal Server Error' };
  })
  .use(imageRoutes)

  .get('/api/health', () => ({ ok: true, provider: 'itunes' as const }))

  .get('/api/meta', () => ({ zodiac: ZODIAC_SIGNS, moods: MOODS, provider: 'itunes' as const }))

  .get(
    '/api/tracks/search',
    async ({ query, set }) => {
      try {
        const tracks = await searchTracks(query.q ?? '', Number(query.limit ?? 12));
        return { provider: 'itunes' as const, tracks };
      } catch (error) {
        set.status = 502;
        logError('[tracks/search]', error);
        return { error: config.debug && error instanceof Error ? error.message : 'Track search failed' };
      }
    },
    {
      query: t.Object({
        q: t.Optional(t.String({ maxLength: 200 })),
        limit: t.Optional(t.Numeric()),
      }),
    },
  )

  .get(
    '/api/tracks/:id',
    async ({ params, set }) => {
      try {
        const track = await lookupTrack(params.id);
        if (!track) {
          set.status = 404;
          return { error: 'Track not found' };
        }
        return { provider: 'itunes' as const, track };
      } catch (error) {
        set.status = 502;
        logError('[tracks/lookup]', error);
        return { error: config.debug && error instanceof Error ? error.message : 'Track lookup failed' };
      }
    },
      { params: t.Object({ id: t.String({ minLength: 1, maxLength: 32 }) }) },
  )

  /**
   * Receives errors the browser caught but React swallowed. Without this the
   * only record of a production crash is someone's local console, which is
   * never read.
   *
   * Two tiers, because "never log anything" and "log everything" are both
   * wrong. The breadcrumb is always on: one line, no stack, every field
   * sanitized first — a timestamp, which part of the app, which route, and a
   * message stripped of paths, tokens and variable values. That is what a
   * production deploy records. The stacks behind it are debug-only, because
   * they name files on a machine and describe how it is put together.
   *
   * Deliberately open: no auth, because the browser has none to present. The
   * validators cap every field, so the worst case is a few hundred bytes of
   * log noise from anyone who finds the endpoint.
   */
  .post(
    '/api/errors',
    async ({ body }) => {
      logBreadcrumb({ where: body.where, name: body.name, message: body.message, href: body.href });
      logError(`[client:${body.where}] ${body.name}: ${body.message}`);
      if (body.stack) logError(body.stack);
      if (body.componentStack) logError(body.componentStack);
      logError(`  at ${body.href} (${body.at})`);
      return { ok: true };
    },
    {
      body: t.Object({
        message: t.String({ maxLength: 1000 }),
        name: t.String({ maxLength: 200 }),
        stack: t.Optional(t.String({ maxLength: 8000 })),
        componentStack: t.Optional(t.String({ maxLength: 8000 })),
        where: t.String({ maxLength: 200 }),
        href: t.String({ maxLength: 2000 }),
        at: t.String({ maxLength: 40 }),
      }),
    },
  )
  .listen(config.port);

// The banner names a port and a provider, so it belongs to the same switch as
// the error detail rather than to stdout unconditionally.
log(`THE Vibe LAB API listening on http://localhost:${config.port}`);
log(`  env: ${config.appEnv} — tracks: iTunes Search API`);
