const HISTORY_KEY = 'vibe_lab_history';
export const HISTORY_TTL = 604_800_000;

export interface HistoryEntry {
  id: string;
  recipient: string;
  timestamp: number;
  track_name: string;
}

function readRaw(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function writeRaw(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 100)));
  } catch {
    return;
  }
}

export function loadHistory(): HistoryEntry[] {
  const all = readRaw();
  const now = Date.now();
  const kept = all.filter((e) => now - e.timestamp < HISTORY_TTL);
  if (kept.length !== all.length) writeRaw(kept);
  return kept.sort((a, b) => b.timestamp - a.timestamp);
}

export function pushHistory(entry: HistoryEntry): void {
  const all = readRaw().filter((e) => Date.now() - e.timestamp < HISTORY_TTL);
  writeRaw([entry, ...all]);
}
