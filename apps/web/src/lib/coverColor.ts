import { useEffect, useState } from 'react';

/** Side of the offscreen sample. The bucket average below does the real work, so
 *  a bigger grid only costs read time. */
const SAMPLE_EDGE = 16;

/** 4 bits per channel, 4096 buckets. Coarse enough to cluster, fine enough that
 *  a gradient cover still lands on a representative bucket. */
const BUCKET_SHIFT = 4;

/** Below this spread a pixel is grey, and a grey tint is invisible at 15% alpha. */
const MIN_CHROMA = 12;

/** PNG covers carry an alpha channel; the dominant swatch should not be a corner. */
const MIN_ALPHA = 200;

const cache = new Map<string, string>();

/**
 * Averages the pixels in the busiest 4-bit bucket rather than taking the bucket's
 * centre value, so the result is a real mean and not a posterised step.
 */
function readDominant(img: HTMLImageElement): string | null {
  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE_EDGE;
  canvas.height = SAMPLE_EDGE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, SAMPLE_EDGE, SAMPLE_EDGE);

  let pixels: Uint8ClampedArray;
  try {
    pixels = ctx.getImageData(0, 0, SAMPLE_EDGE, SAMPLE_EDGE).data;
  } catch {
    // Tainted canvas. Fails safe: the card keeps its static palette.
    return null;
  }

  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < MIN_ALPHA) continue;
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    if (Math.max(r, g, b) - Math.min(r, g, b) < MIN_CHROMA) continue;
    const key = ((r >> BUCKET_SHIFT) << 8) | ((g >> BUCKET_SHIFT) << 4) | (b >> BUCKET_SHIFT);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.n += 1;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
    } else {
      buckets.set(key, { n: 1, r, g, b });
    }
  }

  let best: { n: number; r: number; g: number; b: number } | undefined;
  for (const bucket of buckets.values()) {
    if (!best || bucket.n > best.n) best = bucket;
  }
  const top = best;
  if (!top) return null;

  const channels = [top.r, top.g, top.b]
    .map((sum) => Math.round(sum / top.n).toString(16).padStart(2, '0'))
    .join('');
  return `#${channels}`;
}

/**
 * Dominant colour of `coverUrl` as `#rrggbb`, or null while the image is still
 * loading and null again if the read is refused. Callers are expected to treat
 * null as "no tint" rather than as an error.
 *
 * Artwork is fetched through `/api/image`, which is same-origin for the same
 * reason CoverArt routes its export-path images there: a same-origin canvas read
 * is untainted, so no CORS headers are needed on the proxy.
 */
export function useCoverColor(coverUrl: string): string | null {
  const [sampled, setSampled] = useState<{ url: string; hex: string | null } | null>(null);

  useEffect(() => {
    let live = true;
    if (!coverUrl) return;

    const img = new Image();
    img.onload = () => {
      const hex = readDominant(img);
      if (hex) cache.set(coverUrl, hex);
      if (live) setSampled({ url: coverUrl, hex });
    };
    // A failed load never fires onload, so the card simply keeps its wash.
    // The cache-busting query is shared with CoverArt so the canvas extractor
    // and the DOM image never see a different blob for the same cover.
    img.src = `/api/image?url=${encodeURIComponent(coverUrl)}&cb=${Date.now()}`;

    return () => {
      live = false;
      img.onload = null;
      img.onerror = null;
      img.src = '';
    };
  }, [coverUrl]);

  // The cache is read during render rather than pushed through state, so a cover
  // that has already been sampled tints the card on first paint instead of a
  // frame later. A sample belonging to a previous cover is ignored outright.
  if (sampled && sampled.url === coverUrl) return sampled.hex;
  return coverUrl ? cache.get(coverUrl) ?? null : null;
}

// ponytail: sampling is async, so an export fired before the artwork lands gets
// the untinted wash. The card is mounted when the modal opens and the image is
// a cached 600px JPEG, so the window is small. Close it by having this hook also
// expose a ready flag and disabling the export buttons until it flips.
