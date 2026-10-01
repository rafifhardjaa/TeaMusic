import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Enforces the environment boundaries the app is built around.
 *
 * Each rule fails closed and quietly today — a `console.error(apiKey)` added
 * six months from now, or an `import.meta.env.APP_SERVICE_ROLE` reaching for a
 * backend variable, builds clean and leaks in production. The boundaries are
 * therefore asserted here instead of being a matter of remembering them:
 *
 *   1. Client code reads configuration through src/lib/env.ts only, and only
 *      under the VITE_ prefix — that prefix is what stops backend variables
 *      from being inlined into a bundle at all.
 *   2. Client console output happens in src/lib/report.ts only, behind
 *      APP_DEBUG.
 *   3. The API reads the environment through src/config.ts only.
 *   4. The API writes to a console through src/log.ts only, where the
 *      APP_DEBUG gate lives — plus the one deliberately ungated line, the
 *      sanitized breadcrumb for /api/errors.
 *   5. The committed env template carries the production values.
 *   6. Local env files are gitignored.
 *
 * Run: bun run check:security
 */

const WEB_SRC = 'apps/web/src';
const API_SRC = 'apps/api/src';

const WEB_ENV = join(WEB_SRC, 'lib', 'env.ts');
const WEB_CONSOLE = join(WEB_SRC, 'lib', 'report.ts');
const API_ENV = join(API_SRC, 'config.ts');
const API_CONSOLE = join(API_SRC, 'log.ts');

const violations: string[] = [];

function walk(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, found);
    else if (/\.(ts|tsx)$/.test(entry.name)) found.push(path);
  }
  return found;
}

function at(file: string, index: number, source: string): string {
  const line = source.slice(0, index).split('\n').length;
  return `${file}:${line}`;
}

let clientReads = 0;
for (const file of walk(WEB_SRC)) {
  const source = readFileSync(file, 'utf8');

  for (const match of source.matchAll(/import\.meta\.env(\.[A-Za-z_][A-Za-z0-9_]*)?/g)) {
    const where = at(file, match.index ?? 0, source);
    if (file !== WEB_ENV) {
      violations.push(`${where} reads import.meta.env — only ${WEB_ENV} may`);
      continue;
    }
    const name = match[1]?.slice(1);
    if (name && !name.startsWith('VITE_')) {
      violations.push(`${where} reads ${name} — only VITE_-prefixed names reach the client`);
    }
    clientReads += 1;
  }

  if (file !== WEB_CONSOLE && /console\.(log|error|warn|info|debug)\s*\(/.test(source)) {
    violations.push(`${file} writes to a console — only ${WEB_CONSOLE} may, behind APP_DEBUG`);
  }
}

let apiReads = 0;
for (const file of walk(API_SRC)) {
  const source = readFileSync(file, 'utf8');

  if (/\b(process\.env|Bun\.env)\b/.test(source)) {
    if (file !== API_ENV) violations.push(`${file} reads the environment — only ${API_ENV} may`);
    else apiReads += 1;
  }

  if (file !== API_CONSOLE && /console\.(log|error|warn|info|debug)\s*\(/.test(source)) {
    violations.push(`${file} writes to a console — only ${API_CONSOLE} may, behind APP_DEBUG`);
  }
}

const template = readFileSync('apps/api/.env.example', 'utf8');
if (!/^APP_ENV=production$/m.test(template)) violations.push('apps/api/.env.example must set APP_ENV=production');
if (!/^APP_DEBUG=false$/m.test(template)) violations.push('apps/api/.env.example must set APP_DEBUG=false');

for (const file of ['apps/api/.env.local', 'apps/web/.env.local', 'apps/web/.env.development.local']) {
  if (!existsSync(file)) continue;
  try {
    execFileSync('git', ['check-ignore', '-q', file]);
  } catch {
    violations.push(`${file} is not gitignored — local env files must never be committed`);
  }
}

if (violations.length > 0) {
  console.error('security check failed:');
  for (const violation of violations) console.error(`  - ${violation}`);
  process.exit(1);
}

console.log(`ok  ${clientReads} client env reads, all in ${WEB_ENV}, all VITE_-prefixed`);
console.log(`ok  ${apiReads} API env read, confined to ${API_ENV}`);
console.log('ok  console access confined to report.ts and log.ts');
console.log('ok  env template carries production values, local env files are ignored');
console.log('\nsecurity boundary check passed');
