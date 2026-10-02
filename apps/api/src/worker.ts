import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';
import { createApp } from './app';
import { reconfigure, type EnvSource } from './config';

/** The `[vars]` bindings wrangler ships from wrangler.toml, plus the
 *  UPSTASH_REDIS_REST_TOKEN Worker secret (`wrangler secret put`). */
interface WorkerEnv extends EnvSource {
  APP_ENV?: string;
  APP_DEBUG?: string;
  ALLOWED_ORIGIN?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
}

/**
 * workerd splits module evaluation from request handling: code generation from
 * strings — which is how Elysia composes its handlers through the `Function`
 * constructor — is permitted while the module evaluates and rejected once
 * requests are in flight (`EvalError: Code generation from strings disallowed`).
 * So the app is built and compiled here, at import time, and `.compile()`'s
 * AOT routing table is frozen before the isolate serves anything. Nothing in
 * `createApp` reads configuration at build time, so compiling before the
 * bindings exist is safe.
 */
const app = createApp(CloudflareAdapter).compile();

let configured = false;

/**
 * The module-worker entry (see `main` in wrangler.toml).
 *
 * `[vars]` arrive with the first request rather than at import time, so the
 * first call hands them to `reconfigure()` before any route runs; the shared
 * config object is mutated in place and every later request reads the settled
 * values. Later calls reuse the compiled app — requests never trigger
 * composition.
 */
export default {
  fetch(request: Request, env: WorkerEnv): Response | Promise<Response> {
    if (!configured) {
      reconfigure(env);
      configured = true;
    }
    return app.fetch(request);
  },
};
