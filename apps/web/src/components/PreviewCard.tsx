import { useEffect, useRef, useState } from 'react';
import { ArrowSquareOut, MagicWand, Play } from '@phosphor-icons/react';
import { searchTracks } from '../lib/api';
import { gsap, useGsap } from '../lib/gsap';
import { MOOD_META, ZODIAC_META, mixQuery } from '../lib/constants';
import { useToast } from '../store/toast';
import { useComposer } from '../store/composer';
import type { Track } from '../lib/types';
import { TrackRow } from './TrackPicker';
import { PreviewToggle } from './PreviewControls';
import { CoverArt } from './ui/CoverArt';
import { MetaLabel } from './ui/Card';

/** How many candidates the mixer offers. iTunes returns far more than this. */
const MIX_CANDIDATES = 6;

/**
 * The live preview, adopted from vibe.html: the draft rendered as the
 * recipient will see it, with a spinning record and the chosen track. Every
 * field updates as you type, which is the whole point of the panel.
 */
export function PreviewCard() {
  const recipient = useComposer((state) => state.recipient);
  const message = useComposer((state) => state.message);
  const track = useComposer((state) => state.track);
  const setTrack = useComposer((state) => state.setTrack);
  const zodiac = useComposer((state) => state.zodiac);
  const mood = useComposer((state) => state.mood);

  // Playback state is read by PreviewToggle, which subscribes on its own, so
  // this panel no longer re-renders when a clip starts or stops.
  const showToast = useToast((state) => state.show);

  const [busy, setBusy] = useState(false);
  // Candidates are keyed to the pairing that produced them, so changing either
  // input invalidates the list during render rather than through a reset effect.
  const [mixState, setMixState] = useState<{ key: string; tracks: Track[] }>({ key: '', tracks: [] });
  const coverRef = useRef<HTMLDivElement>(null);

  const mixKey = zodiac && mood ? `${zodiac}:${mood}` : '';
  const candidates = mixState.key === mixKey ? mixState.tracks : [];

  const scope = useGsap<HTMLDivElement>(({ root, gsap: g }) => {
    g.fromTo(
      root,
      { autoAlpha: 0, y: 22 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: { trigger: root, start: 'top 90%', once: true },
      },
    );
  }, []);

  // One revolution every two seconds. The record is small and the palette is
  // low contrast, so anything slower reads as a static dot.
  const vinylRef = useGsap<HTMLDivElement>(({ root, gsap: g }) => {
    g.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
      g.to(root, { rotation: 360, duration: 2, ease: 'none', repeat: -1 });
    });
  }, []);

  // Crossfade the artwork when the track changes, as in the prototype.
  const previousTrackId = useRef<string | null>(null);
  useEffect(() => {
    const node = coverRef.current;
    if (!node) return;

    const nextId = track?.id ?? null;
    if (previousTrackId.current === nextId) return;

    const isFirst = previousTrackId.current === null;
    previousTrackId.current = nextId;
    if (isFirst) return;

    gsap.fromTo(
      node,
      { autoAlpha: 0.3, scale: 0.96 },
      { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'power2.out' },
    );
  }, [track?.id]);

  /**
   * The mixer: a real iTunes search built from the sign and the mood, not an
   * invented profile. The user picks from the hits, so the result is a track
   * they can actually send.
   */
  async function handleMix() {
    if (!zodiac || !mood) {
      showToast('Select a zodiac and a mood to mix.');
      return;
    }

    setBusy(true);
    try {
      const tracks = await searchTracks(mixQuery(zodiac, mood), MIX_CANDIDATES);
      if (tracks.length === 0) {
        showToast('Nothing came back for that pairing. Try another mood.');
        return;
      }
      setMixState({ key: mixKey, tracks });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'The mixer is unavailable');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={scope}>
      <div className="mb-3 flex items-center justify-between px-1 sm:mb-4">
        <h3 className="font-serif text-lg font-semibold text-ink">Preview</h3>
        <span className="rounded-md bg-line/50 px-2 py-1 text-xs font-medium tracking-wider text-ink-soft uppercase">
          Updates live
        </span>
      </div>

      {/* Phones lose ~90px of height and 12px of padding: the card still reads
          as the centerpiece, but it no longer pushes the pickers off-screen. */}
      <div className="relative flex min-h-[340px] flex-col overflow-hidden rounded-[1.5rem] border border-line/60 bg-white p-5 shadow-soft sm:min-h-[430px] sm:p-8">
        <div className="relative z-10 flex items-center justify-between">
          <MetaLabel>
            To: <span className="text-ink">{recipient.trim() || 'Someone'}</span>
          </MetaLabel>

          <div className="relative h-9 w-9 shrink-0 opacity-80 sm:h-10 sm:w-10">
            {/*
              Grooves alone are rotationally symmetric and therefore invisible
              in motion, so the read comes from the off-centre sheen and the
              high-contrast label.
            */}
            <div
              ref={vinylRef}
              className="absolute inset-0 rounded-full bg-ink shadow-sm"
              style={{
                backgroundImage:
                  'repeating-radial-gradient(circle at center, rgba(255,255,255,0.09) 0 1px, transparent 1px 3px)',
              }}
            >
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    'conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0.22) 50deg, transparent 110deg)',
                }}
              />
              <div className="absolute inset-1 rounded-full border border-white/15" />
              <div className="absolute top-1/2 left-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-sm" />
            </div>
          </div>
        </div>

        <div className="z-10 flex flex-1 items-center justify-center py-6 sm:py-10">
          <p className="px-2 text-center font-handwriting text-2xl leading-relaxed text-ink sm:text-3xl md:text-4xl">
            {message.trim() || 'Write a message to see it here...'}
          </p>
        </div>

        {/* Track row */}
        <div className="group relative z-10 mt-auto flex items-center gap-4 rounded-2xl border border-line/60 bg-paper/50 p-3 transition-colors hover:bg-paper">
          <div
            ref={coverRef}
            className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-line/50 shadow-sm sm:h-14 sm:w-14"
          >
            {track ? (
              <>
                <CoverArt src={track.coverUrl} alt="" className="h-full w-full" rounded="rounded-none" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100">
                  <Play size={20} weight="fill" className="text-white" />
                </div>
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-line/40">
                <MetaLabel>Select</MetaLabel>
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-center overflow-hidden">
            <span className="truncate text-[15px] leading-tight font-semibold text-ink">
              {track ? track.name : 'No track selected'}
            </span>
            <span className="mt-0.5 truncate text-[13px] text-ink-soft">
              {track
                ? track.artist
                : zodiac && mood
                  ? `${ZODIAC_META[zodiac].label} + ${MOOD_META[mood].label}`
                  : 'Mix zodiac & mood'}
            </span>
          </div>

          {track?.previewUrl ? (
            <PreviewToggle
              id={track.id}
              previewUrl={track.previewUrl}
              size={17}
              className="ml-auto"
            />
          ) : null}

          {track?.externalUrl ? (
            <a
              href={track.externalUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Open in Apple Music"
              className={`shrink-0 rounded-full p-2 text-ink-soft transition-colors hover:text-accent ${track.previewUrl ? '' : 'ml-auto'}`}
            >
              <ArrowSquareOut size={17} weight="light" />
            </a>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={() => void handleMix()}
        disabled={busy}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 font-medium text-white transition-all hover:bg-accent active:scale-[0.98] disabled:opacity-50 sm:mt-6 sm:py-3.5"
      >
        <MagicWand size={18} weight="bold" />
        {busy ? 'Mixing' : 'Mix track'}
      </button>

      {candidates.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-line bg-white p-2">
          <MetaLabel className="block px-2 pt-1 pb-2">Pick one for the card</MetaLabel>
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {candidates.map((candidate) => (
              <TrackRow
                key={candidate.id}
                track={candidate}
                onSelect={(picked) => {
                  setTrack(picked);
                  setMixState({ key: '', tracks: [] });
                }}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
