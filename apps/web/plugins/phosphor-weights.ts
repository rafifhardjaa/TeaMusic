import type { Plugin } from 'vite';

/**
 * Weights this app renders. Every icon call in src passes one of these
 * literally, or nothing at all — which means `regular`, its default.
 */
export const USED_WEIGHTS = new Set(['light', 'bold', 'fill', 'regular']);
export const KNOWN_WEIGHTS = new Set(['thin', 'light', 'regular', 'bold', 'fill', 'duotone']);

const PHOSPHOR_DEFS = /@phosphor-icons[/\\]react[/\\]dist[/\\]defs[/\\][^/\\]+\.es\.js$/;

interface WeightEntry {
  start: number;
  end: number;
  weight: string;
}

/**
 * Phosphor ships all six weights of path data with every icon, built eagerly
 * into a `Map` at module load. Nothing tree-shakes them: they are data inside
 * an object that is referenced as a whole, so the two weights this app never
 * uses were still being parsed, evaluated and shipped for all 25 icons —
 * about 38% of what the icon set costs, and the largest single thing left to
 * cut once the Supabase client moved behind its own chunk.
 *
 * The rendered result does not change. Each icon keeps the weights it is
 * actually drawn with, so the SVG a visitor sees is identical.
 *
 * It fails the safe way too: if the shape of these files ever changes, no
 * recognizable weight is found and the source is returned untouched. We lose
 * the bytes and keep working, rather than shipping empty icons.
 */
export function trimUnusedWeights(code: string): string | null {
  const mapAt = code.indexOf('new Map([');
  if (mapAt < 0) return null;
  const arrayOpen = mapAt + 'new Map('.length;

  const entries: WeightEntry[] = [];
  let depth = 0;
  let entryStart = -1;
  let close = -1;

  for (let i = arrayOpen; i < code.length; i += 1) {
    const char = code[i];

    if (char === '"' || char === "'" || char === '`') {
      // These files contain no escapes inside strings — only SVG path data,
      // which never uses any of these characters except as delimiters.
      const quote = char;
      i += 1;
      while (i < code.length && code[i] !== quote) i += 1;
      continue;
    }

    if (char === '[') {
      depth += 1;
      if (depth === 2 && entryStart < 0) entryStart = i;
    } else if (char === ']') {
      if (depth === 2 && entryStart >= 0) {
        entries.push({ start: entryStart, end: i + 1, weight: readWeight(code, entryStart) });
        entryStart = -1;
      }
      depth -= 1;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }

  if (close < 0 || entries.length === 0) return null;
  if (entries.some((entry) => !KNOWN_WEIGHTS.has(entry.weight))) return null;

  const kept = entries.filter((entry) => USED_WEIGHTS.has(entry.weight));
  if (kept.length === 0 || kept.length === entries.length) return null;

  return (
    code.slice(0, arrayOpen + 1) +
    kept.map((entry) => code.slice(entry.start, entry.end)).join(',\n  ') +
    code.slice(close)
  );
}

/** The weight key is the first string literal inside a `["name", …]` entry. */
function readWeight(code: string, entryStart: number): string {
  const open = code.indexOf('"', entryStart);
  const close = open < 0 ? -1 : code.indexOf('"', open + 1);
  return open < 0 || close < 0 ? '' : code.slice(open + 1, close);
}

export function phosphorWeights(): Plugin {
  return {
    name: 'phosphor:drop-unused-weights',
    transform(code, id) {
      if (!PHOSPHOR_DEFS.test(id.split('?')[0])) return null;
      return trimUnusedWeights(code);
    },
  };
}
