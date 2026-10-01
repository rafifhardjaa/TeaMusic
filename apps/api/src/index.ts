import { createApp } from './app';
import { config } from './config';
import { log } from './log';

/**
 * The Bun entry — local development and anything that runs a process.
 * The Cloudflare deployment builds the same app in `src/worker.ts`.
 */
const app = createApp().listen(config.port);

// The banner names a port and a provider, so it belongs to the same switch as
// the error detail rather than to stdout unconditionally.
log(`TeaMusic API listening on http://localhost:${config.port}`);
log(`  env: ${config.appEnv} — tracks: iTunes Search API`);
