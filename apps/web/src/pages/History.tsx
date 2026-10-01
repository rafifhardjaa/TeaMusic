import { useEffect, useState } from 'react';
import { Check, Copy } from '@phosphor-icons/react';
import { HISTORY_TTL, loadHistory } from '../lib/history';
import type { HistoryEntry } from '../lib/history';
import { MetaLabel } from '../components/ui/Card';

function expiryLabel(entry: HistoryEntry): string {
  const ageMs = Date.now() - entry.timestamp;
  const leftMs = HISTORY_TTL - ageMs;
  if (leftMs <= 0) return 'expired';
  const days = Math.floor(leftMs / 86_400_000);
  if (days >= 1) return `expires in ${days}d`;
  const hours = Math.floor(leftMs / 3_600_000);
  return `expires in ${hours}h`;
}

export function History() {
  const [entries, setEntries] = useState<HistoryEntry[]>(() => loadHistory());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // loadHistory already drops anything older than 7 days, but an item can
  // expire while the tab is open, so trim again on visibility return.
  useEffect(() => {
    const refresh = () => setEntries(loadHistory());
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  useEffect(() => {
    if (copiedId === null) return;
    const t = setTimeout(() => setCopiedId(null), 1800);
    return () => clearTimeout(t);
  }, [copiedId]);

  async function copyLink(entry: HistoryEntry) {
    const url = `${window.location.origin}/?m=${entry.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(entry.id);
    } catch {
      return;
    }
  }

  if (entries.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-20">
        <MetaLabel>Sent messages — last 7 days</MetaLabel>
        <h1 className="mt-4 max-w-2xl font-serif text-3xl leading-tight text-ink md:text-5xl">History</h1>
        <p className="mt-4 max-w-xl text-ink-soft">Nothing in the last seven days. Links you send will appear here until they expire.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-20">
      <MetaLabel>Sent messages — last 7 days</MetaLabel>
      <h1 className="mt-4 max-w-2xl font-serif text-3xl leading-tight text-ink md:text-5xl">History</h1>
      <p className="mt-4 max-w-xl text-ink-soft">Each link expires seven days after it was created. Copy one before it does if you still need it.</p>

      <ul className="mt-10 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
        {entries.map((entry) => (
          <li key={entry.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:flex-nowrap">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">To {entry.recipient}</p>
              <p className="mt-0.5 truncate text-xs text-ink-soft">
                {entry.track_name}
                <span className="mx-2 text-line">/</span>
                {expiryLabel(entry)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void copyLink(entry)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition-colors ${
                copiedId === entry.id
                  ? 'border-accent bg-accent text-white'
                  : 'border-line bg-white text-ink hover:border-ink-soft'
              }`}
              aria-label="Copy link"
            >
              {copiedId === entry.id ? <Check size={14} weight="bold" /> : <Copy size={14} weight="light" />}
              {copiedId === entry.id ? 'Copied' : 'Copy link'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
