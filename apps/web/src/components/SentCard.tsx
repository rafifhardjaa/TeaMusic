import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, Download, ShareNetwork } from '@phosphor-icons/react';
import { shareMessage, downloadStoryImage } from '../lib/share';
import { useToast } from '../store/toast';
import type { Message } from '../lib/types';
import { StoryCard } from './StoryCard';
import { Button } from './ui/Button';
import { MetaLabel } from './ui/Card';
import { CoverArt } from './ui/CoverArt';

/**
 * The moment right after a send.
 *
 * The send is the emotional peak of the product, so it gets its own panel
 * rather than a toast that scrolls away. It surfaces the one artefact that
 * matters — the share link — and every way to act on it: copy the link, share
 * the link, or download / share the story image itself. "Send another" resets
 * back to a blank form without a page reload.
 */
export function SentCard({ message, onAnother }: { message: Message; onAnother: () => void }) {
  const storyRef = useRef<HTMLDivElement>(null);
  const showToast = useToast((state) => state.show);
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<'download-image' | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const shareUrl = `${window.location.origin}/?m=${message.id}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast('Could not copy — select the link instead');
    }
  }

  async function handleShareLink() {
    setFeedback(null);
    const result = await shareMessage(message, shareUrl);
    if (result === 'copied') showToast('Link copied to clipboard!');
    else if (result === 'failed') setFeedback('Could not share');
  }

  async function handleDownloadImage() {
    if (!storyRef.current) return;
    setBusy('download-image');
    setFeedback(null);
    try {
      const result = await downloadStoryImage(storyRef.current, message);
      if (result === 'downloaded') setFeedback('Image saved');
      else if (result === 'failed') setFeedback('Could not render the image');
    } finally {
      setBusy(null);
    }
  }

  function handleViewInbox() {
    navigate(`/to/${encodeURIComponent(message.recipient)}`);
  }

  return (
    <div className="rounded-[1.5rem] border border-line bg-white p-6 shadow-soft sm:p-8">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white">
          <Check size={18} weight="bold" />
        </span>
        <div>
          <h2 className="font-serif text-xl font-semibold text-ink">Sent anonymously</h2>
          <p className="text-sm text-ink-soft">It is in the whispers below.</p>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4 rounded-2xl border border-line bg-paper/60 p-4">
        <CoverArt src={message.coverUrl} alt="" className="h-16 w-16 shrink-0" />
        <div className="min-w-0 flex-1">
          <MetaLabel>A song for {message.recipient}</MetaLabel>
          <p className="mt-1 truncate font-serif text-base text-ink">{message.trackName}</p>
          <p className="truncate text-sm text-ink-soft">{message.artistName}</p>
        </div>
      </div>

      {/* Share link row — the artefact the whole product hands out. */}
      <div className="mt-5 flex items-center gap-2 rounded-xl border border-line bg-paper/60 p-2 pl-4">
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink-soft">{shareUrl}</span>
        <button
          type="button"
          onClick={() => void copyLink()}
          className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
            copied ? 'bg-accent text-white' : 'border border-line bg-white text-ink hover:border-accent'
          }`}
          aria-label="Copy share link"
        >
          {copied ? <Check size={14} weight="bold" /> : <Copy size={14} weight="light" />}
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void handleShareLink()}>
          <ShareNetwork size={15} weight="light" />
          Share
        </Button>
        <Button variant="secondary" onClick={() => void handleDownloadImage()} disabled={busy !== null}>
          <Download size={15} weight="light" />
          {busy === 'download-image' ? 'Preparing' : 'Download'}
        </Button>
        <Button variant="ghost" onClick={onAnother}>
          Send another
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleViewInbox}
          className="text-sm text-ink-soft underline underline-offset-4 transition-colors hover:text-accent"
        >
          See {message.recipient}&rsquo;s inbox
        </button>
        {feedback ? <MetaLabel className="text-ink-soft">{feedback}</MetaLabel> : null}
      </div>

      {/* Offscreen export target, same parking as the detail modal. */}
      <StoryCard message={message} shareUrl={shareUrl} ref={storyRef} />
    </div>
  );
}