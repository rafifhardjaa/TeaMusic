/**
 * The only module in this process that reads the environment.
 *
 * Nothing here is VITE_-prefixed, so none of it can reach a browser: Vite
 * inlines only that prefix into a bundle, and the API never builds one. The
 * client's own configuration lives in `apps/web/src/lib/env.ts`, which is
 * the only place `import.meta.env` is read.
 */

/** Anything shaped like an environment: process.env, or Workers' [vars]. */
export interface EnvSource {
  [key: string]: string | undefined;
}

export interface AppConfig {
  port: number;
  allowedOrigin: string;
  appEnv: string;
  debug: boolean;
}

/**
 * Fail closed. A process started without an env file — a misconfigured
 * deploy, a runtime that lost its config — is treated as production, so a
 * missing variable can never be the thing that turns detail back on.
 *
 * Verbose output is opt-in, and production can never turn it on: putting
 * `APP_DEBUG=true` alongside `APP_ENV=production` is not enough to leak. This
 * is the single switch every log line and every detailed error response
 * answers to.
 */
export function loadConfig(source: EnvSource): AppConfig {
  const appEnv = source.APP_ENV?.trim() || 'production';
  const debug = appEnv !== 'production' && source.APP_DEBUG === 'true';
  return {
    port: Number(source.PORT ?? 8787),
    allowedOrigin: source.ALLOWED_ORIGIN ?? 'http://localhost:5173',
    appEnv,
    debug,
  };
}

/**
 * A process that has an environment reads it here. On Cloudflare Workers
 * there is no `process` at all, which is what the typeof guard is for: the
 * Worker supplies its own values through `reconfigure` below instead.
 */
export const config: AppConfig = loadConfig(typeof process !== 'undefined' ? process.env : {});

/**
 * Cloudflare Workers delivers the `[vars]` bindings together with the first
 * request, not at import time, so `src/worker.ts` calls this once before the
 * app is built. The mutation is in place because everything — the CORS
 * closure, `log.ts`'s debug gate — holds the same object and must see one
 * config, not two.
 */
export function reconfigure(source: EnvSource): void {
  Object.assign(config, loadConfig(source));
}
