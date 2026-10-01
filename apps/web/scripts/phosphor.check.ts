import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { KNOWN_WEIGHTS, USED_WEIGHTS, trimUnusedWeights } from '../plugins/phosphor-weights';

/**
 * Self-check for the Phosphor weight trim in vite.config.
 *
 * The failure it guards against is invisible: dropping a weight the app does
 * render with would build clean, lint clean, and ship icons that draw as
 * nothing. So every installed icon definition is run through the real
 * transform, and the two weights it is supposed to lose must be gone from all
 * of them, while all four it renders with must survive in every file it trims.
 *
 * Then every icon src actually uses is loaded from the trimmed source, so the
 * claim ends at the data the renderer reads rather than at matching strings.
 *
 * Run: bun run check:phosphor
 */

const DEFS = 'node_modules/@phosphor-icons/react/dist/defs';
const DROPPED = [...KNOWN_WEIGHTS].filter((weight) => !USED_WEIGHTS.has(weight));

function walk(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, found);
    else if (/\.(tsx|ts)$/.test(entry.name)) found.push(path);
  }
  return found;
}

/** Capitalized JSX tags — filtered down to Phosphor's by the defs lookup. */
function jsxTags(source: string): string[] {
  return [...source.matchAll(/<([A-Z][A-Za-z0-9]*)/g)].map((match) => match[1]);
}

assert.deepEqual(
  [...DROPPED].sort(),
  ['duotone', 'thin'],
  'the weights this app does not render should be exactly thin and duotone',
);

const files = readdirSync(DEFS).filter((name) => name.endsWith('.es.js'));
assert.ok(files.length > 1_000, `expected the full icon set, found ${files.length}`);

let trimmed = 0;
let saved = 0;

for (const name of files) {
  const code = readFileSync(join(DEFS, name), 'utf8');
  const out = trimUnusedWeights(code);
  const after = out ?? code;
  if (out !== null) {
    trimmed += 1;
    saved += code.length - out.length;
    for (const weight of USED_WEIGHTS) {
      assert.ok(after.includes(`"${weight}"`), `${name} lost the ${weight} weight it renders with`);
    }
  }
  for (const weight of DROPPED) {
    assert.ok(!after.includes(`"${weight}"`), `${name} still ships ${weight}`);
  }
}

assert.ok(trimmed > 0, 'the transform did not fire on a single icon definition');
console.log(`ok  ${files.length} definitions, ${trimmed} trimmed, ${saved} source bytes removed`);

// The trim only runs when it recognizes the whole shape of a file.
const MINIMAL = [
  'import * as a from "react";',
  'const l = /* @__PURE__ */ new Map([',
  '  ["regular", a.createElement("path", { d: "M1" })],',
  '  ["light", a.createElement("path", { d: "M2" })]',
  ']);',
  'export { l as default };',
].join('\n');
assert.equal(trimUnusedWeights(MINIMAL), null, 'an already-minimal file must pass through untouched');
console.log('ok  already-minimal file passes through');

const SAMPLE = MINIMAL.replace(
  '"light"',
  '"thin"',
).replace(
  '"regular"',
  '"unknown-future-weight"',
);
assert.equal(
  trimUnusedWeights(SAMPLE),
  null,
  'an unrecognized weight must abort the trim instead of guessing',
);
console.log('ok  unrecognized weight aborts the trim');

assert.equal(trimUnusedWeights('export default 1;'), null, 'a file without the map must be left alone');
console.log('ok  unrelated shapes are left alone');

// Load every icon src uses from its trimmed source. This is the assertion the
// rest of the check exists to support: the four weights still hold elements,
// and the two that were dropped are gone.
const usedIcons = [...new Set(walk('src').flatMap((file) => jsxTags(readFileSync(file, 'utf8'))))]
  .filter((name) => existsSync(join(DEFS, `${name}.es.js`)))
  .sort();
assert.ok(usedIcons.length >= 20, `expected the app's icon set, found ${usedIcons.length}`);

const scratch = join('node_modules', '.tmp', 'phosphor-check');
rmSync(scratch, { recursive: true, force: true });
mkdirSync(scratch, { recursive: true });

for (const icon of usedIcons) {
  const trimmed = trimUnusedWeights(readFileSync(join(DEFS, `${icon}.es.js`), 'utf8'));
  assert.ok(trimmed, `${icon} did not trim, so nothing would be proved about it`);

  const file = join(scratch, `${icon}.js`);
  writeFileSync(file, trimmed);
  const module = (await import(pathToFileURL(file).href)) as { default: Map<string, unknown> };
  const weights = module.default;

  assert.equal(weights.size, USED_WEIGHTS.size, `${icon} should keep exactly ${USED_WEIGHTS.size} weights`);
  for (const weight of USED_WEIGHTS) {
    assert.ok(weights.get(weight), `${icon} renders with ${weight}, which has no data left`);
  }
  for (const weight of DROPPED) {
    assert.equal(weights.get(weight), undefined, `${icon} still carries ${weight}`);
  }
}

rmSync(scratch, { recursive: true, force: true });
console.log(`ok  ${usedIcons.length} icons load from trimmed source with every rendered weight intact`);

console.log('\nphosphor weight trim check passed');
