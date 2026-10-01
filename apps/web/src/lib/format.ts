const RELATIVE_UNITS: [number, Intl.RelativeTimeFormatUnit][] = [
  [60, 'second'],
  [3600, 'minute'],
  [86400, 'hour'],
  [604800, 'day'],
  [2629800, 'week'],
  [31557600, 'month'],
];

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const seconds = Math.round((then - Date.now()) / 1000);
  const absolute = Math.abs(seconds);
  if (absolute < 45) return 'just now';

  let divisor = 1;
  for (const [limit, unit] of RELATIVE_UNITS) {
    if (absolute < limit) return rtf.format(Math.round(seconds / divisor), unit);
    divisor = limit;
  }
  return rtf.format(Math.round(seconds / 31557600), 'year');
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * The note reads as an excerpt rather than a full sentence, so an unterminated
 * one gets an ellipsis. U+2026 rather than three periods: one character, and it
 * holds its spacing at display size where three ASCII dots leave a ragged gap.
 */
export function snippet(text: string): string {
  const trimmed = text.trim();
  return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}…`;
}
