import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Ref } from 'react';
import { MagnifyingGlass, SpinnerGap, X } from '@phosphor-icons/react';
import { searchTracks } from '../lib/api';
import { formatDuration } from '../lib/format';
import { isAbortError, useLatestRequest } from '../lib/useLatestRequest';
import type { Track } from '../lib/types';
import { PreviewToggle, VolumeControl } from './PreviewControls';
import { MetaLabel } from './ui/Card';
import { CoverArt } from './ui/CoverArt';

export interface TrackPickerHandle {
  reset: () => void;
}

interface Props {
  selected: Track | null;
  onSelect: (track: Track | null) => void;
  ref?: Ref<TrackPickerHandle>;
}

const DEFAULT_QUERY = 'viral hits';
const DEFAULT_LIMIT = 5;

/** Debounce before a keystroke turns into a request. */
const SEARCH_DEBOUNCE_MS = 320;

export function TrackPicker({ selected, onSelect, ref }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  // Whether the search feedback (dropdown, error, no-match line) is showing.
  // Walking away from a search is a decision: a tap outside closes the card,
  // while the typed query and the fetched results stay in state so refocusing
  // the input brings the same card back.
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const fetcher = useLatestRequest();

  /**
   * One place for both kinds of lookup. Cancels whatever is in flight, sets
   * loading from the same call site that started the request, and refuses to
   * write a result that a newer request has already superseded.
   *
   * This body used to be copy-pasted into the defaults fetch and the debounced
   * search — roughly twenty lines each — with only the query and limit
   * differing. It is a `useCallback` because the debounce effect depends on it:
   * a fresh closure every render would restart the timeout on every render,
   * which is exactly the bug the debounce exists to avoid.
   */
  const request = useCallback(
    (term: string, limit: number) => {
      const req = fetcher.begin();
      setLoading(true);
      setError(null);
      searchTracks(term, limit, req.signal)
        .then((tracks) => {
          if (req.stale()) return;
          setResults(tracks);
          setLoading(false);
        })
        .catch((err) => {
          if (req.stale() || isAbortError(err)) return;
          setError(err instanceof Error ? err.message : 'Track search failed');
          setResults([]);
          setLoading(false);
        });
    },
    [fetcher],
  );

  const clear = useCallback(() => {
    fetcher.cancel();
    setQuery('');
    setResults([]);
    setError(null);
    setTouched(false);
  }, [fetcher]);

  useImperativeHandle(ref, () => ({ reset: clear }), [clear]);

  /**
   * Default recommendations, shown while the query is empty. Fired from the
   * focus and change events rather than from an effect: the loading flag is
   * then set by the event that started the request, which is where React wants
   * state updates to come from.
   */
  function fetchDefaults() {
    request(DEFAULT_QUERY, DEFAULT_LIMIT);
  }

  // Debounced search for user query. The state updates below sit inside the
  // timeout callback, so they are not run synchronously by the effect itself.
  useEffect(() => {
    if (!touched) return;
    if (query.trim() === '') return;

    const handle = setTimeout(() => request(query, 12), SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [query, touched, request]);

  // A tap anywhere outside the picker closes the results card — same
  // outside-tap pattern as Nav. Taps on the dropdown itself are inside the
  // root, so picking a row (or its play button) still lands normally.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  if (selected) {
    return (
      <div className="flex items-center gap-4 rounded-2xl border border-line bg-white p-3">
        <img src={selected.coverUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-base text-ink">{selected.name}</p>
          <p className="truncate text-sm text-ink-soft">{selected.artist}</p>
        </div>
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-label="Change track"
          className="rounded-full p-2 text-ink-soft transition-colors hover:text-accent"
        >
          <X size={16} weight="light" />
        </button>
      </div>
    );
  }

  const hasResults = results.length > 0;
  const isDefault = touched && query.trim() === '';

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <MagnifyingGlass
          size={16}
          weight="light"
          className="pointer-events-none absolute top-1/2 left-0 -translate-y-1/2 text-ink-soft"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            setTouched(true);
            setOpen(true);
            // Emptying the field brings the default recommendations back, which
            // is the same moment the old effect used to fire on.
            if (value.trim() === '') fetchDefaults();
          }}
          onFocus={() => {
            setOpen(true);
            if (touched) return;
            setTouched(true);
            fetchDefaults();
          }}
          placeholder="Search a song or an artist"
          className="w-full border-b border-line bg-transparent py-2 pr-8 pl-7 text-ink placeholder:text-[#B4B0A8] focus:border-accent focus:outline-none transition-colors duration-200"
        />
        {loading ? (
          <SpinnerGap
            size={16}
            className="absolute top-1/2 right-0 -translate-y-1/2 animate-spin text-ink-soft"
          />
        ) : null}
      </div>

      {open && error ? <MetaLabel className="mt-3 block text-accent">{error}</MetaLabel> : null}

      {/* Locked below the input: the flip-above behavior made the dropdown
          jump whenever the form above it grew. A fixed 240px cap with
          internal scroll keeps it reachable instead of repositioning it. */}
      {open && hasResults && (
        <ul
          className="hide-scrollbar absolute top-full left-0 z-50 mt-2 max-h-60 w-full space-y-1 overflow-y-auto rounded-2xl border border-line bg-paper-alt p-2 pr-1 shadow-lift transition-all duration-200"
          role="listbox"
        >
          {isDefault ? (
            <li className="px-2 py-1 text-xs font-mono uppercase tracking-wider text-ink-soft">
              Trending
            </li>
          ) : null}
          {results.map((track) => (
            <TrackRow key={track.id} track={track} onSelect={onSelect} />
          ))}
        </ul>
      )}

      {open && touched && !loading && !hasResults && !error ? (
        <MetaLabel className="mt-3 block">No tracks matched that search</MetaLabel>
      ) : null}

      <div className="mt-4 flex min-h-6 items-center justify-end">
        <VolumeControl />
      </div>
    </div>
  );
}

export function TrackRow({ track, onSelect }: { track: Track; onSelect: (track: Track) => void }) {
  return (
    <li className="group flex items-center gap-2 rounded-xl p-2 transition-colors duration-200 hover:bg-paper-alt" role="option">
      <button
        type="button"
        onClick={() => onSelect(track)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <CoverArt src={track.coverUrl} alt="" className="h-11 w-11" rounded="rounded-md" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-ink group-hover:text-accent">{track.name}</span>
          <span className="block truncate text-xs text-ink-soft">
            {track.artist}
            {track.genre ? ` · ${track.genre}` : ''}
          </span>
        </span>
      </button>

      {track.previewUrl ? <PreviewToggle id={track.id} previewUrl={track.previewUrl} /> : null}
      <span className="font-mono text-[10px] text-[#B4B0A8]">{formatDuration(track.durationMs)}</span>
    </li>
  );
}
