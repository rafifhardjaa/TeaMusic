/**
 * Remembers which recipient name the visitor is, so `/to` can drop them
 * straight into their inbox instead of asking on every visit. Local-only:
 * there are no accounts, and the name is not a secret — messages addressed to
 * it are world-readable by design.
 */
const INBOX_KEY = 'vibecheck.inbox.name';

export function loadInboxName(): string {
  try {
    return localStorage.getItem(INBOX_KEY)?.trim() ?? '';
  } catch {
    return '';
  }
}

export function saveInboxName(name: string): void {
  try {
    const trimmed = name.trim();
    if (trimmed) localStorage.setItem(INBOX_KEY, trimmed);
    else localStorage.removeItem(INBOX_KEY);
  } catch {
    // A blocked quota must not break navigation.
  }
}

/** Normalizes a typed or URL name for display. */
export function normalizeName(value: string): string {
  return value.trim();
}

/** Uppercases the first letter for a greeting without touching the rest. */
export function titleCase(value: string): string {
  const trimmed = value.trim();
  return trimmed ? trimmed[0].toUpperCase() + trimmed.slice(1) : '';
}