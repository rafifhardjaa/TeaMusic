import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { X } from '@phosphor-icons/react';

interface Props {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
}

export function Modal({ open, onClose, labelledBy, children }: Props) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/35 backdrop-blur-[2px]"
      />
      {/*
        The shell carries no overflow of its own: it is sized by its content,
        so a dialog that fits never scrolls and never reserves dead space.
        Scrolling lives on the inner region, which is the only part that can
        genuinely overflow. The close button stays on the shell, so it does not
        scroll away when the content does.
      */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="relative max-h-[92vh] w-full max-w-lg rounded-t-2xl border border-line bg-paper sm:rounded-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-5 right-5 z-10 rounded-full p-1 text-ink-soft transition-colors hover:text-accent"
        >
          <X size={18} weight="light" />
        </button>
        <div className="max-h-[92vh] overflow-y-auto p-6 sm:p-8">{children}</div>
      </div>
    </div>
  );
}
