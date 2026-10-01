import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EnvelopeSimple, LinkSimpleBreak } from '@phosphor-icons/react';
import { Marquee } from '../components/Marquee';
import { SendForm } from '../components/SendForm';
import { SentCard } from '../components/SentCard';
import { HowItWorks, VibeOfTheDay } from '../components/Discover';
import { MoodGrid, ZodiacRail } from '../components/Pickers';
import { PreviewCard } from '../components/PreviewCard';
import { DetailModal } from '../components/DetailModal';
import { useMessagesStore } from '../store/messages';
import * as repo from '../lib/messages';
import type { Message } from '../lib/types';
import { isAbortError, useLatestRequest } from '../lib/useLatestRequest';

export function Home() {
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<Message | null>(null);
  const [sent, setSent] = useState<Message | null>(null);

  const load = useMessagesStore((state) => state.load);
  const items = useMessagesStore((state) => state.items);
  // `status` is read alongside `items.length`, never instead of it. Gating on
  // length alone made an in-flight load indistinguishable from a genuinely
  // empty feed, so the page flashed "Nothing sent yet" at every visitor and
  // then replaced it with the real feed a moment later.
  const status = useMessagesStore((state) => state.status);
  const loadError = useMessagesStore((state) => state.error);
  const formRef = useRef<HTMLDivElement>(null);

  // No AbortController here on purpose: the fetched list lives in a store that
  // outlives this component, so unmounting must not cancel it. StrictMode's
  // double-mount would abort the first pass and leave the feed empty forever.
  useEffect(() => {
    if (items.length === 0) void load();
  }, [items.length, load]);

  // Deep links (/?m=<id>) resolve without waiting for the feed: the row is read
  // from `items` when it is already there, otherwise fetched by id directly.
  //
  // The fetch result is keyed to the id, exactly like DetailModal's track
  // lookup and Inbox's name lookup. That makes a different `?m=` invalidate
  // during render instead of via a reset pass, which is why nothing here calls
  // setState synchronously — and it means the status below is derived, never
  // written from an effect.
  const deepLinkId = params.get('m');
  const [directLink, setDirectLink] = useState<{
    id: string;
    status: 'found' | 'missing';
    message: Message | null;
  } | null>(null);
  const linkFetcher = useLatestRequest();

  const inFeed = deepLinkId ? (items.find((item) => item.id === deepLinkId) ?? null) : null;
  const fetched = deepLinkId && directLink?.id === deepLinkId ? directLink.message : null;

  useEffect(() => {
    if (!deepLinkId) return;
    // Settled for this id, or already in the feed — nothing to fetch.
    if (directLink?.id === deepLinkId) return;
    if (items.some((item) => item.id === deepLinkId)) return;

    const req = linkFetcher.begin();
    repo
      .getMessageById(deepLinkId, req.signal)
      .then((message) => {
        if (req.stale()) return;
        setDirectLink({ id: deepLinkId, status: message ? 'found' : 'missing', message });
      })
      .catch((cause: unknown) => {
        // A missing or unreachable row keeps the modal closed rather than
        // crashing the page; the feed below still loads normally.
        if (req.stale() || isAbortError(cause)) return;
        setDirectLink({ id: deepLinkId, status: 'missing', message: null });
      });
  }, [deepLinkId, items, directLink, linkFetcher]);

  // 'loading' is what you get before the fetch settles for *this* id, because
  // the state either has not been written yet or still belongs to a previous id.
  const deepLinkStatus: 'loading' | 'found' | 'missing' | null = !deepLinkId
    ? null
    : inFeed
      ? 'found'
      : (directLink?.id === deepLinkId ? directLink.status : 'loading');

  const active = selected ?? inFeed ?? fetched;

  const close = useCallback(() => {
    setSelected(null);
    if (params.get('m')) {
      params.delete('m');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const open = useCallback((message: Message) => setSelected(message), []);

  function handleSent(message: Message) {
    setSent(message);
    // Bring the confirmation into view. The panel replaces the form in place,
    // so this lands the user directly on the share link.
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleSendAnother() {
    setSent(null);
  }

  return (
    <>
      <section className="mx-auto w-full max-w-7xl px-5 pt-14 pb-10 md:pt-20">
        <h1 className="max-w-4xl font-serif text-5xl font-bold tracking-tight text-ink md:text-7xl">
          Say <i>Te Amo</i> With <span className="text-accent italic">a track.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-soft md:text-xl">
          Combine your mood and their zodiac to curate the perfect musical message, then share it.
        </p>
      </section>

      {/*
        A shared /?m=<id> link can outlive its whisper — links expire after a
        week — and an id that is no longer there used to fail silently: the
        modal simply never opened, leaving the visitor staring at the form with
        no way to tell a dead link from a slow one.
      */}
      {deepLinkStatus === 'missing' ? (
        <div className="mx-auto w-full max-w-7xl px-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white px-5 py-4">
            <p className="flex min-w-0 items-center gap-2 text-sm text-ink-soft">
              <LinkSimpleBreak size={16} weight="light" className="shrink-0 text-accent" />
              That whisper link could not be opened — it may have expired, or it was never there.
              The latest whispers are still below.
            </p>
            <button
              type="button"
              onClick={close}
              className="shrink-0 rounded-full border border-line px-4 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {deepLinkStatus === 'loading' ? (
        <div className="mx-auto w-full max-w-7xl px-5">
          <p role="status" aria-busy="true" className="text-center text-sm text-ink-soft">
            Opening that whisper…
          </p>
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-7xl px-5 pb-4">
        <HowItWorks />
      </div>

      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-12 px-5 py-14 lg:grid-cols-12 lg:gap-16">
        {/* LEFT: message, zodiac, mood */}
        <div className="col-span-1 flex flex-col gap-12 lg:col-span-7">
          <section ref={formRef} className="flex scroll-mt-24 flex-col gap-6">
            <div className="flex items-center gap-2 border-b border-line pb-3">
              <EnvelopeSimple size={20} weight="light" className="text-ink-soft" />
              <h2 className="font-serif text-xl font-semibold text-ink">
                {sent ? 'On its way' : 'The message'}
              </h2>
            </div>
            {sent ? (
              <SentCard message={sent} onAnother={handleSendAnother} />
            ) : (
              <SendForm onSent={handleSent} />
            )}
          </section>

          <ZodiacRail />
          <MoodGrid />

          {/*
            Vibe of the day lives in the left column on purpose. It was first
            placed under the sticky preview, but sticky pins the preview at
            top-28 while this card scrolls up underneath it, so the two
            overlapped through most of the page. Separate grid columns can
            never overlap, and the right column goes back to holding only the
            sticky preview, as it did before.
          */}
          <VibeOfTheDay onUse={() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
        </div>

        {/* RIGHT: live preview, sticky on desktop */}
        <div className="col-span-1 lg:col-span-5">
          <div className="z-10 flex flex-col gap-4 lg:sticky lg:top-28">
            <PreviewCard />
          </div>
        </div>
      </div>

      {status === 'loading' ? <WhisperSkeleton /> : null}

      {status === 'ready' && items.length > 0 ? <Marquee onOpen={open} /> : null}

      {/*
        A brand-new install has no whispers yet, so the marquee has nothing to
        scroll. Rendering a short prompt beats a blank band that reads like the
        page failed to load. This is only reachable once the load has settled,
        so it can no longer be shown to a visitor whose feed is merely slow.
      */}
      {status === 'ready' && items.length === 0 ? (
        <section className="border-t border-line bg-paper">
          <div className="mx-auto max-w-7xl px-5 pt-16 pb-20 text-center">
            <h2 className="font-serif text-3xl font-bold tracking-tight text-ink">Latest Whispers</h2>
            <p className="mx-auto mt-2 max-w-md text-base text-ink-soft">
              Nothing sent yet. Be the first — compose a track above and it will appear here.
            </p>
          </div>
        </section>
      ) : null}

      {status === 'error' ? (
        <section className="border-t border-line bg-paper">
          <div className="mx-auto max-w-7xl px-5 pt-16 pb-20 text-center">
            <h2 className="font-serif text-3xl font-bold tracking-tight text-ink">Latest Whispers</h2>
            <p className="mx-auto mt-2 max-w-md text-base text-ink-soft">
              {loadError ?? 'Could not load the feed.'}
            </p>
          </div>
        </section>
      ) : null}

      <DetailModal message={active} onClose={close} />
    </>
  );
}

/**
 * Placeholder band for the feed while the first load is in flight. Shaped like
 * Marquee's shell so the page does not reflow when the real cards arrive.
 *
 * Deliberately static rather than a scrolling copy: a moving placeholder reads
 * as live content, and an animation running against a network wait is CPU
 * spent on the one thing the visitor is already waiting for.
 */
function WhisperSkeleton() {
  return (
    <section className="border-t border-line bg-paper" role="status" aria-busy="true">
      <span className="sr-only">Loading the latest whispers</span>
      <div className="mx-auto max-w-7xl px-5 pt-16 pb-10 text-center">
        <h2 className="font-serif text-3xl font-bold tracking-tight text-ink">Latest Whispers</h2>
        <p className="mt-2 text-base text-ink-soft">See what others are sending out.</p>
      </div>
      <div className="mx-auto max-w-7xl px-5 pt-4 pb-16">
        <div className="flex gap-6 overflow-hidden">
          {[0, 1, 2].map((slot) => (
            <div
              key={slot}
              aria-hidden
              className="flex w-[340px] shrink-0 flex-col gap-5 rounded-[1.5rem] border border-line bg-white p-6"
            >
              <div className="h-3 w-24 rounded-full bg-line/40" />
              <div className="flex flex-col gap-2">
                <div className="h-5 w-full rounded-full bg-line/40" />
                <div className="h-5 w-4/5 rounded-full bg-line/40" />
              </div>
              <div className="mt-auto flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-line/40" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <div className="h-3.5 w-2/3 rounded-full bg-line/40" />
                  <div className="h-3 w-1/3 rounded-full bg-line/40" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
