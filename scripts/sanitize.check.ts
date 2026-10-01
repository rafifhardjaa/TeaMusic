import assert from 'node:assert/strict';
import { breadcrumb, safeLocation, safeText } from '../apps/api/src/sanitize';

/**
 * Self-check for the production breadcrumb's sanitizer.
 *
 * This is the one place where a mistake cannot be seen: a sanitizer that lets
 * a stack frame or a connection string through still builds, still lints, and
 * still logs one clean-looking line — the leak is in a log nobody diffed.
 * So the fixtures are the things that must never come back out, plus one
 * ordinary message that must come back out unchanged, because a sanitizer that
 * redacts everything is as useless as one that redacts nothing.
 *
 * Run: bun run check:sanitize
 */

// 1. An ordinary message survives verbatim. Over-redaction is a failure too.
const ordinary = "Cannot read properties of undefined (reading 'previewUrl')";
assert.equal(safeText(ordinary), ordinary, 'a normal message must pass through untouched');
assert.equal(safeText('Track search failed'), 'Track search failed');
console.log('ok  ordinary messages pass through unchanged');

// 2. System paths — the machine this runs on must not appear in a log line.
for (const path of [
  'Failed reading /Users/radja/development/MyProject/vibe-track-app/apps/web/src/lib/api.ts while refreshing',
  'ENOENT: no such file C:\\Users\\radja\\project\\src\\index.ts',
  'opened file:///Users/radja/.env.local',
  'frame at App (/src/lib/api.ts:42:11)',
]) {
  const out = safeText(path);
  assert.ok(!/\/Users|C:\\|file:\/\/|\.ts:\d/.test(out), `path leaked: ${out}`);
}
console.log('ok  filesystem paths and file URLs are redacted');

// 3. Credentials and connection strings.
const secrets = [
  'connect postgres://user:supabase-password@db.internal:5432/app failed',
  'key sb_publishable_9H6YDH3W5R75hc8u4YDT9Q_VfBXC1Z1',
  'token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0In0.signature',
  'auth Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature',
];
for (const secret of secrets) {
  const out = safeText(secret);
  assert.ok(!/supabase-password|sb_publishable_|eyJ|\bBearer\s+eyJ/.test(out), `secret leaked: ${out}`);
}
console.log('ok  credentials, JWTs and connection strings are redacted');

// 4. Environment variables keep their name and lose their value.
const env = 'startup failed with APP_DEBUG=true VITE_SUPABASE_URL=https://kgriq.supabase.co PORT=8787';
const redacted = safeText(env);
assert.ok(redacted.includes('APP_DEBUG=***'), `APP_DEBUG value kept: ${redacted}`);
assert.ok(redacted.includes('VITE_SUPABASE_URL=***'), `VITE_SUPABASE_URL value kept: ${redacted}`);
assert.ok(!redacted.includes('kgriq'), `URL value kept: ${redacted}`);
assert.ok(!redacted.includes('8787'), `PORT value kept: ${redacted}`);
console.log('ok  variable names survive, their values do not');

// 5. Stacks embedded in a message collapse to one line without the frames.
const stacked =
  'Error: boom\n    at Object.foo (/Users/radja/app/src/lib/api.ts:42:11)\n    at Bar (file:///Users/radja/app.ts:1:1)';
const collapsed = safeText(stacked);
assert.ok(!collapsed.includes('\n'), 'must be a single line');
assert.ok(!collapsed.includes('at Object'), 'frame text survived');
assert.ok(!collapsed.includes('/Users'), 'frame path survived');
console.log('ok  embedded stack frames are dropped and the result is one line');

// 6. Length is capped.
assert.ok(safeText('x'.repeat(500)).length <= 301, 'message must be capped');
console.log('ok  field length is capped');

// 7. The route keeps origin and path, and loses query, hash and credentials.
assert.equal(safeLocation('https://user:pass@example.test/send?m=abc#frag'), 'https://example.test/send');
assert.equal(safeLocation('https://example.test/'), 'https://example.test/');
assert.equal(safeLocation('not a url'), '<unknown>');
console.log('ok  route keeps origin and path only');

// 8. The line itself: timestamp, component, route, message — and nothing else.
const now = new Date('2026-10-01T12:00:00.000Z');
const line = breadcrumb(
  {
    where: 'ErrorBoundary:Detail',
    name: 'TypeError',
    message: "Cannot read properties of undefined (reading 'previewUrl')",
    href: 'https://example.test/send?m=8f0a1c2e&token=secret',
  },
  now,
);

assert.equal(line.split('\n').length, 1, 'the breadcrumb must be exactly one line');
assert.ok(line.startsWith('[client-error] '), 'must be recognisable in a log stream');
assert.ok(line.includes(now.toISOString()), 'must carry a timestamp');
assert.ok(line.includes('where="ErrorBoundary:Detail"'), 'must carry the component');
assert.ok(line.includes('at="https://example.test/send"'), 'must carry the route');
assert.ok(line.includes('message="Cannot read properties'), 'must carry the message');
assert.ok(!line.includes('token=secret') && !line.includes('m=8f0a1c2e'), 'query must be dropped');
assert.ok(!line.includes('"message="') && line.match(/"/g)?.length === 8, 'quotes must stay balanced');
console.log('ok  breadcrumb carries timestamp, component, route and message');

// 9. A hostile message through the full line still leaks nothing.
const hostile = breadcrumb(
  {
    where: 'render',
    name: 'Error',
    message: `connect postgres://admin:p%40ss@db:5432/x failed at /Users/radja/development/MyProject/vibe-track-app/apps/api/src/index.ts:12:5 with APP_DEBUG=true`,
    href: 'https://example.test/x#eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.s',
  },
  now,
);
for (const leaked of ['/Users', 'p%40ss', 'db:5432', 'APP_DEBUG=true', 'eyJ']) {
  assert.ok(!hostile.includes(leaked), `hostile input leaked "${leaked}": ${hostile}`);
}
console.log('ok  hostile input leaks no path, credential, variable value or token');

console.log('\nbreadcrumb sanitizer check passed');
