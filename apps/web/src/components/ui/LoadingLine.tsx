interface Props {
  children: string;
  /** Spacing, since the surrounding list differs per page. */
  className?: string;
}

/**
 * The one way a page says "still fetching". Two pages had their own wording
 * and neither announced itself, so the same wait read differently depending on
 * where you were and was silent to a screen reader.
 */
export function LoadingLine({ children, className = 'mt-6' }: Props) {
  return (
    <p className={`${className} text-sm text-ink-soft`} role="status" aria-busy="true">
      {children}
    </p>
  );
}
