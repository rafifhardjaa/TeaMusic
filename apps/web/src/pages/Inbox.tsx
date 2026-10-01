import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, PaperPlaneTilt, Sparkle } from '@phosphor-icons/react';
import * as repo from '../lib/messages';
import type { Message } from '../lib/types';
import { loadInboxName, normalizeName, saveInboxName, titleCase } from '../lib/inbox';
import { timeAgo } from '../lib/format';
import { isAbortError, useLatestRequest } from '../lib/useLatestRequest';
import { startVibeBack } from '../lib/vibeBack';
import { useAudioStore } from '../store/audio';
import { PreviewToggle } from '../components/PreviewControls';
import { Button } from '../components/ui/Button';
import { MetaLabel } from '../components/ui/Card';
import { CoverArt } from '../components/ui/CoverArt';
import { LoadingLine } from '../components/ui/LoadingLine';

/**
 * The recipient's inbox: every whisper addressed to a name, newest first.
 *
 * This is the other half of the product's loop. A sender shares `/to/<name>`
 * (or a single `/?m=<id>` link), the recipient lands here, sees what was sent
 * to them, and can answer any of it with a track. It renders the same rows the
 * Browse grid shows, but framed personally and stacked vertically — an inbox,
 * not a search result.
 */
export function Inbox({ onOpen }: { onOpen: (message: Message) => void }) {
  const params = useParams();
  const navigate = useNavigate();
  const stopAudio = useAudioStore((state) => state.stop);

  const name = useMemo(() => normalizeName(params.name ?? ''), [params.name]);

  const [entry, setEntry] = useState(() => (params.name ? '' : loadInboxName()));
  const formRef = useRef<HTMLFormElement>(null);

  /**
   * Fetch results are keyed to the name they were loaded for, so navigating to
   * a different inbox invalidates the previous list during render instead of
   * briefly showing one name's whispers under another's heading. This mirrors
   * how DetailModal keys its track lookup to the open message.
   */
  const [result, setResult] = useState<{
    name: string;
    status: 'loading' | 'ready' | 'error';
    messages: Message[];
    error: string | null;
  }>({ name: '', status: 'loading', messages: [], error: null });

  // A newer visit supersedes the previous fetch, so the in-flight request is
  // cancelled rather than left to resolve into an inbox nobody is reading.
  // The hook also aborts on unmount and invalidates the first StrictMode pass.
  const fetcher = useLatestRequest();
  useEffect(() => {
    if (!name) return;

    const req = fetcher.begin();

    repo
      .findMessages(name, req.signal)
      .then((found) => {
        if (req.stale()) return;
        setResult({ name, status: 'ready', messages: found, error: null });
      })
      .catch((e) => {
        if (req.stale() || isAbortError(e)) return;
        setResult({
          name,
          status: 'error',
          messages: [],
          error: e instanceof Error ? e.message : 'Could not load your whispers',
        });
      });
  }, [name, fetcher]);

  const fresh = result.name === name;
  const status = fresh ? result.status : 'loading';
  const messages = fresh ? result.messages : [];
  const error = fresh ? result.error : null;

  // Remember the inbox name so `/to` can skip the prompt next visit.
  useEffect(() => {
    if (name) saveInboxName(name);
  }, [name]);

  useEffect(() => () => stopAudio(), [stopAudio]);

  function handleOpenEntry(event: React.FormEvent) {
    event.preventDefault();
    const target = normalizeName(entry);
    if (!target) return;
    saveInboxName(target);
    navigate(`/to/${encodeURIComponent(target)}`);
  }

  function handleVibeBack(message: Message) {
    startVibeBack(message);
    navigate('/');
    stopAudio();
  }

  // No name in the URL: a short prompt, pre-filled with the remembered name.
  if (!name) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-28">
        <div className="text-center">
          <Sparkle size={28} weight="light" className="mx-auto text-accent" />
          <h1 className="mt-4 font-serif text-4xl font-bold tracking-tight text-ink md:text-5xl">
            Your whispers
          </h1>
          <p className="mx-auto mt-4 max-w-md text-ink-soft">
            Enter the name people whisper to you and they will gather here.
          </p>
        </div>

        <form ref={formRef} onSubmit={handleOpenEntry} className="mx-auto mt-10 w-full max-w-md">
          <label htmlFor="inbox-name" className="mb-3 block">
            <MetaLabel>Your name</MetaLabel>
          </label>
          <div className="flex items-center gap-2">
            {/*
              h-11 (44px) matches the `size="md"` button exactly. The default
              form inputs use `p-4` and are 58px tall, which left this row's
              button 14px shorter and 7px off-centre from the field. items-center
              keeps them aligned even if the two heights ever drift again.
            */}
            <input
              id="inbox-name"
              value={entry}
              onChange={(event) => setEntry(event.target.value)}
              placeholder="e.g. Hanip"
              aria-label="Your name"
              autoComplete="off"
              className="field h-11 min-w-0 flex-1 rounded-xl px-4 text-base"
            />
            <Button type="submit" size="md">
              Open
              <ArrowRight size={16} weight="light" />
            </Button>
          </div>
        </form>

        {loadInboxName() ? (
          <p className="mt-6 text-center text-sm text-ink-soft">
            <Link
              to={`/to/${encodeURIComponent(loadInboxName())}`}
              className="underline underline-offset-4 hover:text-accent"
            >
              Open {titleCase(loadInboxName())}&rsquo;s inbox
            </Link>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-20">
      <MetaLabel>Whispers for {name}</MetaLabel>
      <h1 className="mt-4 font-serif text-4xl leading-tight font-bold tracking-tight text-ink md:text-5xl">
        {titleCase(name)}, someone said this.
      </h1>
      <p className="mt-4 max-w-xl text-ink-soft">
        Everything addressed to <span className="font-semibold text-ink">{name}</span>, newest first.
        No sender is stored — answer whichever one you like.
      </p>

      {status === 'loading' ? <LoadingLine className="mt-10">Loading whispers…</LoadingLine> : null}

      {status === 'error' ? <p className="mt-10 text-sm text-accent">{error}</p> : null}

      {status === 'ready' && messages.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-line bg-white p-10 text-center">
          <p className="font-serif text-xl text-ink">No whispers yet.</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
            Nothing has been sent to this name. Share your link so someone can find it.
          </p>
        </div>
      ) : null}

      {messages.length > 0 ? (
        <ul className="mt-10 space-y-4">
          {messages.map((message) => (
            <li key={message.id}>
              <InboxRow message={message} onOpen={onOpen} onVibeBack={handleVibeBack} />
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-12 text-center text-sm text-ink-soft">
        Not you?{' '}
        <Link to="/to" className="underline underline-offset-4 hover:text-accent">
          Open a different inbox
        </Link>
      </p>
    </div>
  );
}

/**
 * One received whisper. Opens the same detail modal as everywhere else, and
 * carries the "answer with a track" affordance that closes the loop.
 */
function InboxRow({
  message,
  onOpen,
  onVibeBack,
}: {
  message: Message;
  onOpen: (message: Message) => void;
  onVibeBack: (message: Message) => void;
}) {
  return (
    <div className="group rounded-2xl border border-line bg-white p-5 transition-colors hover:border-accent">
      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={() => onOpen(message)}
          className="flex min-w-0 flex-1 items-center gap-4 text-left"
        >
          <CoverArt src={message.coverUrl} alt="" className="h-14 w-14 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-handwriting text-lg leading-snug break-words text-ink">
              {message.message}
            </p>
            <p className="mt-2 truncate text-sm text-ink-soft">
              {message.trackName}
              <span className="mx-2 text-line">/</span>
              {message.artistName}
            </p>
            <p className="mt-1 font-mono text-[10px] text-ink-soft">{timeAgo(message.createdAt)}</p>
          </div>
        </button>

        {message.previewUrl ? (
          <PreviewToggle id={message.trackId} previewUrl={message.previewUrl} size={17} />
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line/60 pt-4">
        <MetaLabel>Anonymous</MetaLabel>
        <button
          type="button"
          onClick={() => onVibeBack(message)}
          className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent"
        >
          <PaperPlaneTilt size={13} weight="light" />
          Answer with a track
        </button>
      </div>
    </div>
  );
}