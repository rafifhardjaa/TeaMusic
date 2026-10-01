import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Runs a GSAP context scoped to a ref so every tween and ScrollTrigger created
 * inside is reverted on unmount. This is the only sanctioned animation entry
 * point; RULES.md requires GSAP exclusively.
 */
export function useGsap<T extends HTMLElement>(
  setup: (context: { root: T; gsap: typeof gsap }) => void,
  deps: readonly unknown[] = [],
) {
  const scope = useRef<T>(null);

  // The caller owns the dependency list and every call site passes an array
  // literal, which is where it gets checked. `deps` is forwarded verbatim from
  // here, so this one forward cannot be verified statically.
  useLayoutEffect(() => {
    const root = scope.current;
    if (!root) return;

    const context = gsap.context(() => {
      setup({ root, gsap });
    }, root);

    return () => context.revert();
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return scope;
}

export { gsap, ScrollTrigger };
