import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowCounterClockwise, ArrowSquareOut, DownloadSimple, ShareNetwork } from '@phosphor-icons/react';
import * as api from '../lib/api';
import { downloadStoryCard, shareMessage } from '../lib/share';
import { useToast } from '../store/toast';
import { MOOD_META, ZODIAC_META } from '../lib/constants';
import { timeAgo } from '../lib/format';
import { isAbortError, useLatestRequest } from '../lib/useLatestRequest';
import { applyPageSeo, messageSeo, routeSeo } from '../lib/seo';
import { startVibeBack } from '../lib/vibeBack';
import { getAudioElement, useAudioStore } from '../store/audio';
import type { Message, Track } from '../lib/types';
import { StoryCard } from './StoryCard';
import { Button } from './ui/Button';
import { MetaLabel } from './ui/Card';
import { Modal } from './ui/Modal';
import { CoverArt } from './ui/CoverArt';
import { PreviewToggle } from './PreviewControls';

const HEADING_ID = 'detail-modal-heading';

/** iTunes preview clips are always 30 seconds. */
const PREVIEW_SECONDS = 30;

interface Props {
  message: Message | null;
  onClose: () => void;
}

export function DetailModal({ message, onClose }: Props) {
  const navigate = useNavigate();
  // The lookup is keyed to the message it belongs to, so opening a different
  // message invalidates the previous result during render instead of via an
  // effect that resets state and causes a second pass.
  const [trackState, setTrackState] = useState<{ key: string; track: Track | null }>({
    key: '',
    track: null,
  });
  const [busy, setBusy] = useState<'download' | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const storyRef = useRef<HTMLDivElement>(null);
  const stop = useAudioStore((state) => state.stop);
  const showToast = useToast((state) => state.show);
  const trackFetcher = useLatestRequest();

  const open = Boolean(message);
  const shareUrl = message ? `${window.location.origin}/?m=${message.id}` : '';

  const trackKey = message?.trackId ?? '';
  const track = trackState.key === trackKey ? trackState.track : null;

  // `preview_url` is NOT NULL, so playback needs no request. The lookup is
  // still made, but only to recover the Apple Music link, which is not stored.
  useEffect(() => {
    if (!open) stop();
  }, [open, stop]);

  // The store owns one detached <audio>, not a node inside the dialog, so the
  // teardown has to be delegated to it. This runs on unmount as well as on
  // close, which covers the case where the page drops the whole subtree.
  useEffect(() => stop, [stop]);

  // The tab follows the card: an open message is a shareable URL of its own,
  // so the head describes it for as long as the dialog is up, and the cleanup
  // puts back the route it was opened from. Both Home's `?m=` deep link and
  // the Browse picker render this component, which is why the rewrite lives
  // here instead of in either caller.
  const { pathname } = useLocation();
  useEffect(() => {
    if (!message) return;
    applyPageSeo(messageSeo(message));
    return () => applyPageSeo(routeSeo(pathname));
  }, [message, pathname]);

  useEffect(() => {
    // Closing the modal leaves the lookup alone: its result keys into the
    // track cache either way, and `stale()` stops it from reaching state.
    // A different message does supersede it via `begin()`.
    if (!trackKey) return;

    const req = trackFetcher.begin();

    api
      .getTrack(trackKey, req.signal)
      .then((found) => {
        if (req.stale()) return;
        setTrackState({ key: trackKey, track: found });
      })
      .catch((e) => {
        // Playback is an enhancement; the message still reads fine without it.
        if (req.stale() || isAbortError(e)) return;
      });
  }, [trackKey, trackFetcher]);

  async function handleShare() {
    if (!message) return;
    setFeedback(null);
    const result = await shareMessage(message, shareUrl);
    if (result === 'copied') {
      showToast('Link copied to clipboard!');
    } else if (result === 'failed') {
      setFeedback('Could not share');
    }
  }

  /**
   * Closes the loop: prefills the composer with this track and the opposite
   * mood, then returns to the form. Sender is never stored, so the answer is
   * anonymous too — the user picks a new recipient in the form.
   */
  function handleVibeBack() {
    if (!message) return;
    startVibeBack(message);
    stop();
    onClose();
    navigate('/');
  }

  async function handleDownload() {
    if (!message || !storyRef.current) return;
    setBusy('download');
    setFeedback(null);
    try {
      await downloadStoryCard(storyRef.current, message.recipient);
      setFeedback('Image saved');
    } catch {
      setFeedback('Could not render the image');
    } finally {
      setBusy(null);
    }
  }

  // Playback state is read by PreviewToggle and PreviewBar, which subscribe to
  // the store themselves, so the dialog does not re-render on every tick.
  const previewUrl = message?.previewUrl ?? null;

  return (
    <Modal open={open} onClose={onClose} labelledBy={HEADING_ID}>
      {message ? (
        <div className="space-y-7">
          <div className="pr-8">
            <MetaLabel>{timeAgo(message.createdAt)}</MetaLabel>
            <h2 id={HEADING_ID} className="mt-2 font-serif text-3xl leading-tight text-ink">
              A song for {message.recipient}
            </h2>
          </div>

          <p className="font-handwriting text-2xl leading-snug text-ink">{message.message}</p>

          <div className="flex items-center gap-4 rounded-2xl border border-line bg-white p-3">
            <CoverArt src={message.coverUrl} alt="" className="h-16 w-16" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-serif text-base text-ink">{message.trackName}</p>
              <p className="truncate text-sm text-ink-soft">{message.artistName}</p>
            </div>
            {previewUrl ? (
              <PreviewToggle id={message.trackId} previewUrl={previewUrl} size={17} />
            ) : null}
            {track?.externalUrl ? (
              <a
                href={track.externalUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Open in Apple Music"
                className="shrink-0 rounded-full p-2 text-ink-soft transition-colors hover:text-accent"
              >
                <ArrowSquareOut size={17} weight="light" />
              </a>
            ) : null}
          </div>

          {previewUrl ? <PreviewBar id={message.trackId} /> : null}

          {message.zodiac || message.mood ? (
            <div className="flex flex-wrap items-center gap-2">
              {message.zodiac ? (
                <span className="rounded-full border border-line px-3 py-1 text-xs text-ink-soft">
                  {ZODIAC_META[message.zodiac].label}
                </span>
              ) : null}
              {message.mood ? (
                <span className="rounded-full border border-line px-3 py-1 text-xs text-ink-soft">
                  {MOOD_META[message.mood].label}
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-line pt-6">
            {/* The reply action is the primary one: it is what turns a received
                whisper into a new message. Share and download stay secondary. */}
            <Button onClick={handleVibeBack}>
              <ArrowCounterClockwise size={15} weight="light" />
              Answer with a track
            </Button>
            <Button variant="secondary" onClick={() => void handleShare()}>
              <ShareNetwork size={15} weight="light" />
              Share
            </Button>
            <Button variant="secondary" onClick={() => void handleDownload()} disabled={busy !== null}>
              <DownloadSimple size={15} weight="light" />
              {busy === 'download' ? 'Rendering' : 'Download image'}
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>

          {feedback ? <MetaLabel className="block">{feedback}</MetaLabel> : null}

          <StoryCard key={message.id} ref={storyRef} message={message} shareUrl={shareUrl} />
        </div>
      ) : null}
    </Modal>
  );
}

/** 30 second preview with a live position readout. */
function PreviewBar({ id }: { id: string }) {
  const activeId = useAudioStore((state) => state.activeId);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  // Position is keyed to the track, so switching clips invalidates it during
  // render rather than through a reset effect.
  const [positionState, setPositionState] = useState({ key: '', position: 0 });
  const position = positionState.key === id ? positionState.position : 0;

  useEffect(() => {
    if (activeId !== id) return;

    // The store owns a single detached element, so this is how the progress
    // bar gets at its clock.
    const element = getAudioElement();
    if (!element) return;

    const read = () => setPositionState({ key: id, position: element.currentTime });
    const onEnd = () => setPositionState({ key: id, position: 0 });

    element.addEventListener('timeupdate', read);
    element.addEventListener('play', read);
    element.addEventListener('ended', onEnd);
    read();

    return () => {
      element.removeEventListener('timeupdate', read);
      element.removeEventListener('play', read);
      element.removeEventListener('ended', onEnd);
    };
  }, [activeId, id]);

  const active = activeId === id && isPlaying;

  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-line" aria-hidden>
        <div
          className="h-px bg-accent transition-[width] duration-150"
          style={{ width: `${active ? Math.min(100, (position / PREVIEW_SECONDS) * 100) : 0}%` }}
        />
      </div>
      <MetaLabel>{active ? `${Math.floor(position)}s / 30s` : '30s preview'}</MetaLabel>
    </div>
  );
}
