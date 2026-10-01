import type { Message } from './types';
import { snippet } from './format';
import { isAbortError } from './useLatestRequest';

const FILENAME_STEM = 'vibe-lab-story';

/** 1x1 transparent GIF. A dead cover leaves a gap instead of killing the render. */
const BLANK_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const CAPTURE = {
  width: 1080,
  height: 1920,
  pixelRatio: 1,
  cacheBust: true,
  includeQueryParams: true,
  backgroundColor: '#FAF9F6',
  // html-to-image re-fetches every <img> to inline it as a data URL. Those
  // fetches have to be CORS, and a failure has to degrade to the placeholder
  // rather than reject the whole render and hand back an empty canvas.
  fetchRequestInit: { mode: 'cors', credentials: 'omit' },
  imagePlaceholder: BLANK_IMAGE,
  onImageErrorHandler: () => BLANK_IMAGE,
} as const;

/**
 * html-to-image copies the node's *computed* styles onto its clone, and
 * Tailwind v4 expresses `-translate-x-*` as the standalone `translate`
 * property rather than `transform`. Overriding only `transform` left the clone
 * shifted 12000px off-canvas, so the 1080x1920 canvas received nothing but the
 * background colour: a blank white PNG. Every property used to park the card
 * off-screen has to be reset here, or the capture has to be done on a node that
 * is not parked.
 */
const CAPTURE_STYLE = {
  width: '1080px',
  height: '1920px',
  position: 'static',
  left: '0',
  top: '0',
  margin: '0',
  transform: 'none',
  translate: 'none',
  scale: 'none',
  rotate: 'none',
  visibility: 'visible',
  opacity: '1',
} as const;

/**
 * html-to-image walks the clone tree and can hand the filter a nullish entry,
 * so the predicate has to tolerate anything that is not an element.
 */
const keepNode = (node: unknown): boolean =>
  !(node instanceof Element) || !node.classList.contains('story-export-hidden');

/**
 * The faces the export card actually sets, at the sizes it sets them. These
 * come from a Google Fonts `@import` in index.css. `document.fonts.ready` only
 * waits on faces already requested by layout, and the card is parked off-screen
 * with the rest of the modal body, so a face it alone needs can still be
 * pending. Asking for each one by name removes the guesswork.
 */
const EXPORT_FACES = [
  '700 120px "Playfair Display"',
  'italic 700 52px "Playfair Display"',
  '400 80px "Kalam"',
  '400 24px "JetBrains Mono"',
];

/**
 * Renders a DOM node to a story-sized PNG. Sized for 9:16 stories so the
 * output can be posted without cropping.
 *
 * `html-to-image` is loaded on demand rather than statically. Nothing but the
 * export path touches it, and it is large enough to matter — shipping it in the
 * initial bundle cost every visitor the download to save one user the wait for
 * the PNG. The module is fetched on the first export and reused after that.
 */
async function renderStoryCard(node: HTMLElement): Promise<Blob> {
  // The font loads run in parallel with the module fetch: the fetch is the slow
  // part on a cold cache, and the two are independent.
  const [{ toBlob }] = await Promise.all([
    import('html-to-image'),
    Promise.all(EXPORT_FACES.map((face) => document.fonts.load(face).catch(() => []))),
  ]);
  await document.fonts.ready;

  const blob = await toBlob(node, {
    ...CAPTURE,
    style: CAPTURE_STYLE,
    filter: keepNode,
  });

  if (!blob) throw new Error('The story image could not be rendered');
  return blob;
}

/**
 * Waits until every <img> inside the node is either loaded or broken. A fixed
 * sleep was used before, but it burned 800ms on every download even when the
 * artwork was already cached and ready. Polling the actual elements is both
 * faster on the common case and correct on the slow one.
 */
function imagesReady(node: HTMLElement): Promise<void> {
  const images = Array.from(node.querySelectorAll('img'));
  if (images.length === 0) return Promise.resolve();
  return new Promise((resolve) => {
    let pending = images.length;
    const check = () => {
      pending -= 1;
      if (pending <= 0) resolve();
    };
    for (const img of images) {
      if (img.complete) {
        check();
      } else {
        img.addEventListener('load', check, { once: true });
        img.addEventListener('error', check, { once: true });
      }
    }
  });
}

/** Saves a blob to disk. Kept separate so share and download agree on naming. */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke on the next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadStoryCard(node: HTMLElement, recipient: string): Promise<void> {
  await imagesReady(node);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const blob = await renderStoryCard(node);
  downloadBlob(blob, `${FILENAME_STEM}-${slug(recipient)}.png`);
}

/**
 * Result of a share attempt: the sheet succeeded, the clipboard got the
 * link, the user cancelled, or nothing worked.
 */
type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

/**
 * Shares the story image itself through the native share sheet, so it can go
 * straight to a messaging app's image picker on mobile (WhatsApp, IG Stories).
 *
 * Two constraints shape this. First, `navigator.canShare` must confirm the file
 * type is accepted before calling `share` — otherwise Safari throws instead of
 * opening the sheet. Second, this must run in the same task as the user gesture
 * that triggered it: rendering the card is async, and some browsers revoke the
 * transient activation across that await, which makes `share` fail with
 * `NotAllowedError`. If the sheet cannot take the file, it falls back to
 * downloading it, which always works.
 */
export async function shareStoryImage(
  node: HTMLElement,
  message: Message,
): Promise<'shared' | 'downloaded' | 'cancelled' | 'failed'> {
  let blob: Blob;
  try {
    await imagesReady(node);
    blob = await renderStoryCard(node);
  } catch {
    return 'failed';
  }

  const filename = `${FILENAME_STEM}-${slug(message.recipient)}.png`;
  const file = new File([blob], filename, { type: 'image/png' });

  if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
    try {
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `A song for ${message.recipient}`,
        });
        return 'shared';
      }
    } catch (error) {
      if (isAbortError(error)) return 'cancelled';
      // NotAllowedError here is the activation-lost case below; fall through
      // to the download, which does not depend on the gesture.
    }
  }

  try {
    downloadBlob(blob, filename);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}

/**
 * Shares the message through the native Web Share API when it exists,
 * otherwise drops the link on the clipboard. The payload is shaped for
 * messaging apps like WhatsApp and Telegram, which render title, text
 * and the appended URL independently.
 */
export async function shareMessage(message: Message, url: string): Promise<ShareResult> {
  const title = `A song for ${message.recipient}`;
  const text =
    `"${snippet(message.message)}"\n\n` +
    `${message.trackName} - ${message.artistName}\n` +
    `Listen to the track and view the full message here:`;

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (error) {
      if (isAbortError(error)) return 'cancelled';
      return 'failed';
    }
  }

  // No share sheet is available, or it threw for a reason the user cannot
  // fix. The link is still worth having, so fall back to the clipboard.
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return 'copied';
  } catch {
    return 'failed';
  }
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'story'
  );
}
