import { useEffect, useState } from 'react';
import { useMessagesStore } from '../store/messages';
import { timeAgo } from '../lib/format';
import type { Message } from '../lib/types';
import { CoverArt } from './ui/CoverArt';
import { MetaLabel } from './ui/Card';

interface Props {
  onOpen: (message: Message) => void;
}

/**
 * Marquee scroll speed, in px/second. Slower reads calmer; faster feels busy.
 * A card stays on screen long enough to read the quote at this speed.
 */
const PX_PER_SECOND = 90;

/**
 * The "Latest Whispers" feed. RULES.md allows a plain CSS loop for infinite
 * marquees specifically, because the track is duplicated and must run without
 * seams. Everything else in the project animates through GSAP.
 *
 * Reads `items`, the shared feed. It is deliberately NOT the same list Browse
 * searches over — that overlap used to make Latest Whispers show search results
 * after a Browse search.
 *
 * Looping is two identical copies of the feed inside one track, slid left by
 * 50% (see `marquee-scroll` in index.css). 50% of the track is exactly one
 * copy, so the animation ends precisely where it began and restarts without a
 * visible jump. The list is repeated first when it is too short to cover the
 * viewport, but that repetition is applied to BOTH copies so the two halves
 * stay byte-identical.
 */
export function Marquee({ onOpen }: Props) {
  const items = useMessagesStore((state) => state.items);

  // No load here: Home only renders this band once the feed has settled, and
  // Home already owns the trigger. A second one would be a redundant request,
  // and it is unreachable anyway — see the `items.length === 0` guard below.

  // The track must always cover the viewport, otherwise the loop point lands on
  // bare background. Measured rather than guessed, because the old
  // `Math.ceil(8 / items.length)` heuristic produced a track narrower than the
  // screen on anything but a phone.
  const [viewportWidth, setViewportWidth] = useState(
    () => (typeof window === 'undefined' ? 0 : window.innerWidth),
  );
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (items.length === 0) return null;

  // Card is `w-[280px]` below sm and `w-[340px]` from sm up, with a `gap-6`
  // (24px) between cards. The pitch follows the same breakpoint, so the
  // repeat count always covers the viewport at the width actually shown.
  const cardPitch = (viewportWidth >= 640 ? 340 : 280) + 24;
  // Repeat the list enough times that ONE copy is at least as wide as the
  // viewport. Both copies below are built from this same repeated list, so the
  // loop seam is invisible at any viewport width.
  const repeats = Math.max(1, Math.ceil(viewportWidth / (items.length * cardPitch)));
  const looped = Array.from({ length: repeats }, () => items).flat();

  // Speed in px/second. One loop period travels exactly one copy's width, so
  // deriving the duration from that width keeps the scroll speed identical no
  // matter how many messages the feed holds or how many repeats it needs.
  const copyWidth = looped.length * cardPitch;
  const duration = Math.min(90, Math.max(20, Math.round(copyWidth / PX_PER_SECOND)));

  return (
    <section className="relative border-t border-line bg-paper">
      <div className="mx-auto max-w-7xl px-5 pt-10 pb-6 text-center sm:pt-16 sm:pb-10">
        <h2 className="font-serif text-2xl font-bold tracking-tight text-ink sm:text-3xl">Latest Whispers</h2>
        <p className="mt-2 text-sm text-ink-soft sm:text-base">See what others are sending out.</p>
      </div>

      {/* pt-4 headroom: cards lift 4px on hover (hover:-translate-y-1) and with
          zero top clearance the overflow-hidden viewport would slice their top
          edge off. */}
      <div className="marquee-viewport relative flex w-full overflow-hidden pt-4 pb-10 sm:pb-16">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-24 bg-gradient-to-r from-paper to-transparent md:w-40" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-24 bg-gradient-to-l from-paper to-transparent md:w-40" />

        <div
          className="marquee-track"
          style={{ ['--marquee-duration' as string]: `${duration}s` }}
        >
          {/*
            Exactly two identical copies. The keyframe translates the track by
            -50% of its own width, which is precisely one copy's width, so the
            animation lands exactly where it started and restarts with no jump.
            Rendering any other number of copies breaks that guarantee: the
            -50% no longer aligns to a card boundary and the loop visibly snaps.
          */}
          {[0, 1].map((copy) => (
            <div
              key={copy}
              className="flex shrink-0 gap-6 px-3"
              aria-hidden={copy === 1 ? true : undefined}
            >
              {looped.map((message, index) => (
                <WhisperCard
                  key={`${copy}-${message.id}-${index}`}
                  message={message}
                  onOpen={onOpen}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhisperCard({ message, onOpen }: { message: Message; onOpen: (message: Message) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(message)}
      className="group flex w-[280px] shrink-0 flex-col gap-4 rounded-[1.5rem] border border-line bg-white p-5 text-left shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-accent sm:w-[340px] sm:gap-5 sm:p-6"
    >
      <MetaLabel>To: {message.recipient}</MetaLabel>

      <p className="font-handwriting text-xl leading-relaxed text-ink sm:text-2xl">"{message.message}"</p>

      <div className="mt-auto h-px w-full bg-line/60" />

      <div className="-mx-2 flex items-center gap-4 rounded-xl p-2 transition-colors group-hover:bg-paper/70">
        <CoverArt src={message.coverUrl} alt="" className="h-10 w-10 rounded-lg sm:h-12 sm:w-12" />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-ink">{message.trackName}</span>
          <span className="mt-0.5 truncate text-xs text-ink-soft">{message.artistName}</span>
        </div>
        <span className="ml-auto shrink-0 font-mono text-[10px] text-ink-soft">
          {timeAgo(message.createdAt)}
        </span>
      </div>
    </button>
  );
}