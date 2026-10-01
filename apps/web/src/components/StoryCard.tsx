import { forwardRef } from 'react';
import type { Message } from '../lib/types';
import { MOOD_META, ZODIAC_META } from '../lib/constants';
import { FALLBACK_PALETTE } from '../lib/constants';
import { useCoverColor } from '../lib/coverColor';
import { snippet } from '../lib/format';
import { CoverArt } from './ui/CoverArt';

interface Props {
  message: Message;
  shareUrl?: string;
}

/** Film-grain SVG, inlined so the export does not depend on a static asset. */
const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`;

/**
 * The `useCoverColor` hook returns `#rrggbb`, but the aura layer wants an
 * alpha channel, so the hex is split back into channels here rather than
 * teaching the hook a second return shape for one caller.
 */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * The export target. Rendered at a fixed 9:16 in pixels because html-to-image
 * captures the node at its intrinsic size rather than its responsive one, and
 * it forwards its ref so the caller can hand html-to-image the card itself.
 *
 * The root is `fixed` so it is out of flow entirely: this node is 1920px tall
 * and is mounted inside the detail modal, so any in-flow positioning would add
 * 1920px of phantom scroll height to the dialog. It must not be `relative` as
 * well — Tailwind v4 emits `.relative` after `.absolute`, so listing both
 * leaves the later one winning and puts the card back into flow.
 */
export const StoryCard = forwardRef<HTMLDivElement, Props>(function StoryCard(
  { message, shareUrl },
  ref,
) {
  const palette = FALLBACK_PALETTE;
  const tint = useCoverColor(message.coverUrl);

  // Extracted covers glow at 0.45, the terracotta fallback at 0.5: soft enough
  // to tint the alabaster without moving the ink off paper.
  const aura = tint ? hexToRgba(tint, 0.45) : hexToRgba(palette.primary, 0.5);

  const zodiac = message.zodiac ? ZODIAC_META[message.zodiac].label : '';
  const mood = message.mood ? MOOD_META[message.mood].label : '';

  return (
    <div
      ref={ref}
      className="pointer-events-none fixed -left-[20000px] top-0 flex h-[1920px] w-[1080px] flex-col items-center overflow-hidden bg-paper select-none"
      style={{ width: 1080, height: 1920, color: palette.ink }}
    >
      {/* Dynamic aura glow, tinted by the cover art's dominant colour. */}
      <div
        aria-hidden
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full mix-blend-multiply"
        style={{
          width: 1200,
          height: 1200,
          background: `radial-gradient(circle, ${aura} 0%, rgba(244, 242, 236, 0) 70%)`,
          filter: 'blur(100px)',
        }}
      />

      {/* Film-grain texture over everything flat. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-multiply"
        style={{ opacity: 0.06, backgroundImage: NOISE }}
      />

      {/* Top header, padded clear of the profile row overlay. */}
      <div className="z-10 flex w-full items-center justify-between px-20 pt-32">
        <h1 className="font-serif font-bold tracking-tight italic" style={{ fontSize: 52 }}>TeaMusic.</h1>
        <div className="flex gap-4">
          {zodiac ? (
            <span className="rounded-full border border-ink/20 bg-white/10 px-6 py-2 font-mono tracking-widest text-ink/70 uppercase backdrop-blur-md" style={{ fontSize: 24 }}>
              {zodiac}
            </span>
          ) : null}
          {mood ? (
            <span className="rounded-full border border-ink/20 bg-white/10 px-6 py-2 font-mono tracking-widest text-ink/70 uppercase backdrop-blur-md" style={{ fontSize: 24 }}>
              {mood}
            </span>
          ) : null}
        </div>
      </div>

      {/* Main message, vertically centred between header and widget. */}
      <div className="z-10 -mt-20 flex w-full flex-1 flex-col items-center justify-center px-24">
        <div className="mb-8 font-mono uppercase opacity-50" style={{ fontSize: 28, letterSpacing: '0.2em' }}>
          A Song For
        </div>
        <h2 className="mb-12 font-serif font-bold" style={{ fontSize: 120 }}>{message.recipient}</h2>

        <p className="font-handwriting w-[90%] text-center leading-tight" style={{ fontSize: 80 }}>
          <span className="mr-2 font-serif text-accent" style={{ fontSize: 90 }}>“</span>
          {snippet(message.message)}
          <span className="ml-2 font-serif text-accent" style={{ fontSize: 90 }}>”</span>
        </p>
      </div>

      {/* Glassmorphism music widget, lifted clear of the reply bar overlay. */}
      <div className="z-10 mb-40 flex items-center gap-10 rounded-[40px] border border-white/40 bg-white/30 p-8 shadow-2xl backdrop-blur-2xl" style={{ width: 850 }}>
        <CoverArt
          src={message.coverUrl}
          alt=""
          className="h-48 w-48"
          rounded="rounded-[24px]"
          viaProxy
        />
        <div className="flex min-w-0 flex-1 flex-col justify-center overflow-hidden">
          <h3 className="truncate font-bold leading-tight" style={{ fontSize: 52 }}>{message.trackName}</h3>
          <p className="mt-2 truncate opacity-70" style={{ fontSize: 36 }}>{message.artistName}</p>
        </div>
        <div
          aria-hidden
          className="mr-6 flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-ink shadow-xl"
        >
          <div className="ml-2 h-0 w-0 border-t-[12px] border-t-transparent border-l-[20px] border-l-white border-b-[12px] border-b-transparent" />
        </div>
      </div>

      {/* Bottom watermark, pinned above the reply bar overlay. */}
      {shareUrl ? (
        <div className="absolute bottom-16 z-10 font-mono tracking-widest opacity-40" style={{ fontSize: 22 }}>
          {shareUrl.replace(/^https?:\/\//, '')}
        </div>
      ) : null}
    </div>
  );
});
