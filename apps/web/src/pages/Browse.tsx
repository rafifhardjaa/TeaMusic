import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MagnifyingGlass, SlidersHorizontal } from '@phosphor-icons/react';
import { useGsap } from '../lib/gsap';
import { useMessagesStore } from '../store/messages';
import * as repo from '../lib/messages';
import { MOODS, ZODIAC_SIGNS, type Message, type Mood, type ZodiacSign } from '../lib/types';
import { MOOD_META, ZODIAC_META } from '../lib/constants';
import { icon } from '../lib/icons';
import { timeAgo } from '../lib/format';
import { isAbortError, useLatestRequest } from '../lib/useLatestRequest';
import { MetaLabel } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { CoverArt } from '../components/ui/CoverArt';
import { LoadingLine } from '../components/ui/LoadingLine';

type Sort = 'newest' | 'oldest';

/** Stable empty list, so an inactive Browse mode does not re-run the memo. */
const EMPTY: Message[] = [];

/**
 * Browse has two ways in: search a recipient by name, or explore the latest
 * whispers by vibe. Both funnel into one list, which is then filtered by mood
 * and zodiac and sorted — the filters run client-side over the already-fetched
 * batch, so toggling them is instant and never round-trips.
 *
 * Results live in their own store slice, separate from the Latest Whispers
 * feed, so filtering here cannot leak into Home.
 */
export function Browse({ onOpen }: { onOpen: (message: Message) => void }) {
  const search = useMessagesStore((state) => state.search);
  // `results`, not the shared `items` feed. Searching wrote into the feed
  // before, so results leaked into Latest Whispers on the Home page.
  const results = useMessagesStore((state) => state.results);
  const status = useMessagesStore((state) => state.resultStatus);
  const error = useMessagesStore((state) => state.resultError);

  const [params, setParams] = useSearchParams();
  const [term, setTerm] = useState(() => params.get('q') ?? '');
  const [hasSearched, setHasSearched] = useState(Boolean(params.get('q')));
  const [showFilters, setShowFilters] = useState(false);

  // Explore mode: the latest whispers, independent of any search.
  const [latest, setLatest] = useState<Message[]>([]);
  const [exploreStatus, setExploreStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  // Kept as a message rather than a bare 'error' flag: `.catch(() => …)`
  // discarded the reason, so the page could only ever say "Could not load the
  // latest" for every distinct failure — wrong URL, dead network, denied row.
  const [exploreError, setExploreError] = useState<string | null>(null);
  const [exploring, setExploring] = useState(false);

  // Client-side filters and sort.
  const [mood, setMood] = useState<Mood | null>(null);
  const [zodiac, setZodiac] = useState<ZodiacSign | null>(null);
  const [sort, setSort] = useState<Sort>('newest');

  // Two independent request lifecycles: search writes into the store, explore
  // writes into local state. Each supersedes its own kind, never the other.
  const searchRequest = useLatestRequest();
  const exploreRequest = useLatestRequest();

  const scope = useGsap<HTMLDivElement>(({ root, gsap: g }) => {
    const targets = root.querySelectorAll<HTMLElement>('[data-browse-item]');
    if (!targets.length) return;
    g.fromTo(targets, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power2.out', stagger: 0.05 });
  }, [results.length, latest.length, status, exploreStatus]);

  const activeTerm = term.trim();

  // Whichever mode is active supplies the base list the filters apply to.
  // EMPTY is a module constant so the identity stays stable when no mode is
  // active; a fresh `[]` here would defeat the useMemo below.
  const base = exploring ? latest : hasSearched ? results : EMPTY;
  const filtered = useMemo(() => {
    const next = base.filter(
      (m) => (mood === null || m.mood === mood) && (zodiac === null || m.zodiac === zodiac),
    );
    return next.sort((a, b) =>
      sort === 'newest'
        ? b.createdAt.localeCompare(a.createdAt)
        : a.createdAt.localeCompare(b.createdAt),
    );
  }, [base, mood, zodiac, sort]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!activeTerm) return;
    setHasSearched(true);
    setExploring(false);
    void search(activeTerm, searchRequest.begin().signal);
    setParams(activeTerm ? { q: activeTerm } : {}, { replace: true });
  }

  function handleExplore() {
    setExploring(true);
    setHasSearched(false);
    setParams({}, { replace: true });
    if (latest.length > 0) {
      setExploreStatus('ready');
      return;
    }
    setExploreStatus('loading');
    setExploreError(null);
    const req = exploreRequest.begin();
    repo
      .listMessages(req.signal)
      .then((found) => {
        if (req.stale()) return;
        setLatest(found);
        setExploreStatus('ready');
      })
      .catch((cause: unknown) => {
        if (req.stale() || isAbortError(cause)) return;
        setExploreError(cause instanceof Error ? cause.message : 'Could not load the latest');
        setExploreStatus('error');
      });
  }

  function handleNewSearch() {
    setHasSearched(false);
    setExploring(false);
    setTerm('');
    setParams({}, { replace: true });
  }

  const listStatus = exploring ? exploreStatus : status;
  const listError = exploring ? null : error;
  const hasBase = base.length > 0;
  const filtersActive = mood !== null || zodiac !== null;

  return (
    <div ref={scope} className="mx-auto max-w-6xl px-5 py-20">
      <div className="flex flex-col items-center text-center">
        <h1 className="font-serif text-5xl font-bold tracking-tight text-ink md:text-7xl">Browse</h1>
        <p className="mt-4 max-w-md text-base leading-relaxed text-ink-soft">
          Search a recipient by name, or explore the latest whispers by vibe.
        </p>

        {/* Always mounted: searching again must never require a reset. */}
        <form onSubmit={handleSubmit} className="mt-10 flex w-full max-w-md gap-2">
          <div className="relative flex-1">
            <MagnifyingGlass
              size={16}
              weight="light"
              className="pointer-events-none absolute top-1/2 left-0 -translate-y-1/2 text-ink-soft"
            />
            <input
              type="search"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Enter recipient name..."
              aria-label="Search messages by recipient"
              className="w-full border border-line bg-transparent py-2.5 pl-8 pr-4 text-ink placeholder:text-[#B4B0A8] focus:border-accent focus:outline-none transition-colors duration-200"
            />
          </div>
          <Button type="submit" size="md">Search</Button>
        </form>

        <div className="mt-4 flex items-center gap-4">
          <button
            type="button"
            onClick={handleExplore}
            className="text-sm text-ink-soft underline underline-offset-4 transition-colors hover:text-accent"
          >
            {exploring ? 'Showing the latest' : 'Explore the latest instead'}
          </button>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className="inline-flex items-center gap-1.5 text-sm text-ink-soft transition-colors hover:text-accent"
          >
            <SlidersHorizontal size={15} weight="light" />
            Filter by vibe
            {filtersActive ? <span className="text-accent">·on</span> : null}
          </button>
        </div>
      </div>

      {showFilters ? (
        <div className="mt-8 space-y-5 rounded-2xl border border-line bg-white p-5">
          <div>
            <MetaLabel>Mood</MetaLabel>
            <div className="mt-3 flex flex-wrap gap-2">
              {MOODS.map((option) => {
                const Glyph = icon(MOOD_META[option].icon);
                const active = mood === option;
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setMood(active ? null : option)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active ? 'border-ink bg-ink text-white' : 'border-line text-ink hover:border-ink-soft'
                    }`}
                  >
                    {Glyph ? <Glyph size={13} weight="light" /> : null}
                    {MOOD_META[option].label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <MetaLabel>Zodiac</MetaLabel>
            <div className="mt-3 flex flex-wrap gap-2">
              {ZODIAC_SIGNS.map((option) => {
                const active = zodiac === option;
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setZodiac(active ? null : option)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active ? 'border-ink bg-ink text-white' : 'border-line text-ink hover:border-ink-soft'
                    }`}
                  >
                    {ZODIAC_META[option].label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-line/60 pt-4">
            <button
              type="button"
              onClick={() => {
                setMood(null);
                setZodiac(null);
              }}
              className="text-sm text-ink-soft underline underline-offset-4 hover:text-accent"
            >
              Clear filters
            </button>
            <div className="flex items-center gap-2">
              <MetaLabel>Sort</MetaLabel>
              <Button variant="secondary" size="sm" onClick={() => setSort(sort === 'newest' ? 'oldest' : 'newest')}>
                {sort === 'newest' ? 'Newest first' : 'Oldest first'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Result count / status line */}
      {listStatus === 'loading' ? <LoadingLine>Loading whispers…</LoadingLine> : null}
      {listError ? <p className="mt-6 text-sm text-accent">{listError}</p> : null}
      {exploreStatus === 'error' ? (
        <p className="mt-6 text-sm text-accent">{exploreError ?? 'Could not load the latest'}</p>
      ) : null}

      {listStatus === 'ready' ? (
        <p className="mt-6">
          <MetaLabel>
            {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
            {activeTerm && !exploring ? ` for "${activeTerm}"` : ''}
            {filtersActive ? ' matching your filters' : ''}
          </MetaLabel>
        </p>
      ) : null}

      {/* Results */}
      {listStatus === 'ready' && filtered.length > 0 ? (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((message) => (
            <li key={message.id} data-browse-item className="min-w-0">
              <button
                type="button"
                onClick={() => onOpen(message)}
                className="group flex h-full w-full min-w-0 flex-col rounded-2xl border border-line bg-white p-4 text-left transition-colors duration-200 hover:border-accent"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <CoverArt src={message.coverUrl} alt="" className="h-12 w-12 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink group-hover:text-accent">
                      {message.trackName}
                    </p>
                    <p className="truncate text-xs text-ink-soft">{message.artistName}</p>
                  </div>
                  <span className="max-w-28 shrink-0 truncate text-right font-mono text-[10px] text-ink-soft">
                    {timeAgo(message.createdAt)}
                  </span>
                </div>

                <p className="mt-4 w-full font-handwriting text-lg leading-snug break-words text-ink">
                  {message.message}
                </p>

                <p className="mt-4 truncate text-xs text-ink-soft">
                  <span className="uppercase">to</span> {message.recipient}
                </p>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {listStatus === 'ready' && hasBase && filtered.length === 0 && filtersActive ? (
        <div className="mt-8 rounded-2xl border border-line bg-white p-8 text-center">
          <p className="font-serif text-lg text-ink">No whispers match those filters.</p>
          <Button variant="secondary" onClick={() => { setMood(null); setZodiac(null); }} className="mt-4">
            Clear filters
          </Button>
        </div>
      ) : null}

      {listStatus === 'ready' && hasSearched && !exploring && results.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-line bg-white p-10 text-center">
          <p className="font-serif text-xl text-ink">No messages found for this name.</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
            Check the spelling or try a different name.
          </p>
          <Button variant="secondary" onClick={handleNewSearch} className="mt-6">
            New search
          </Button>
        </div>
      ) : null}
    </div>
  );
}
