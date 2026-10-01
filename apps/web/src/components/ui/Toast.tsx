import { useEffect } from 'react';
import { Info } from '@phosphor-icons/react';
import { gsap } from '../../lib/gsap';
import { useToast } from '../../store/toast';

let timer: ReturnType<typeof setTimeout> | undefined;

/**
 * Transient feedback, adopted from the toast in vibe.html. Driven by GSAP so
 * the entrance matches the rest of the motion in the project.
 */
export function Toast() {
  const message = useToast((state) => state.message);
  const dismiss = useToast((state) => state.dismiss);

  useEffect(() => {
    if (!message) return;

    if (timer) clearTimeout(timer);
    const node = document.getElementById('vibe-toast');
    if (node) {
      gsap.fromTo(
        node,
        { y: 20, scale: 0.9, autoAlpha: 0 },
        { y: 0, scale: 1, autoAlpha: 1, duration: 0.4, ease: 'back.out(1.5)' },
      );
    }

    timer = setTimeout(() => {
      const el = document.getElementById('vibe-toast');
      if (!el) {
        dismiss();
        return;
      }
      gsap.to(el, {
        y: 10,
        autoAlpha: 0,
        duration: 0.3,
        ease: 'power2.in',
        onComplete: dismiss,
      });
    }, 3000);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [message, dismiss]);

  return (
    <div
      id="vibe-toast"
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-8 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-ink px-5 py-3 text-white opacity-0 shadow-soft"
    >
      <Info size={18} weight="fill" className="shrink-0" />
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}
