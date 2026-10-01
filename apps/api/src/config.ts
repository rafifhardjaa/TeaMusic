/**
 * The only module in this process that reads the environment.
 *
 * Nothing here is VITE_-prefixed, so none of it can reach a browser: Vite
 * inlines only that prefix into a bundle, and the API never builds one. The
 * client's own configuration lives in `apps/web/src/lib/env.ts`, which is the
 * only place `import.meta.env` is read.
 */
const env = process.env;

/**
 * Fail closed. A process started without an env file — a misconfigured deploy,
 * a container that lost its config — is treated as production, so a missing
 * file can never be the thing that turns detail back on.
 */
const appEnv = env.APP_ENV?.trim() || 'production';

/**
 * Verbose output is opt-in, and production can never turn it on: putting
 * `APP_DEBUG=true` in a production env file is not enough to leak. This is the
 * single switch every log line and every detailed error response answers to.
 */
const debug = appEnv !== 'production' && env.APP_DEBUG === 'true';

export const config = {
  port: Number(env.PORT ?? 8787),
  allowedOrigin: env.ALLOWED_ORIGIN ?? 'http://localhost:5173',
  appEnv,
  debug,
} as const;
