import { useCallback, useEffect, useMemo, useRef } from 'react';

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

interface LatestRequest {
  readonly signal: AbortSignal;
  /**
   * True once a newer request has replaced this one, or the request was
   * cancelled. Call before writing the result into state.
   */
  stale(): boolean;
}

/**
 * One place for the two things every fetch site was re-implementing by hand:
 * an `AbortController` that cancels the previous request, and a generation
 * counter that tells a late result to stay out of state.
 *
 * Six sites built these separately and one of them got it wrong — Browse's
 * explore fetch had no controller at all, so leaving the page kept the request
 * running and then wrote into state nobody was reading. `stale()` exists
 * because abort alone is not enough: a result that resolves in the same tick
 * as the abort still has to be dropped.
 *
 * The generation counter is also what makes StrictMode's double-mount safe.
 * Bumping it on teardown invalidates the first pass, so the second pass is
 * the one whose result lands.
 */
export function useLatestRequest() {
  const ref = useRef({ controller: null as AbortController | null, id: 0 });

  useEffect(
    () => () => {
      ref.current.controller?.abort();
      ref.current.controller = null;
      ref.current.id += 1;
    },
    [],
  );

  const begin = useCallback((): LatestRequest => {
    const state = ref.current;
    state.controller?.abort();
    const controller = new AbortController();
    state.controller = controller;
    const id = ++state.id;
    return {
      signal: controller.signal,
      stale: () => state.id !== id || controller.signal.aborted,
    };
  }, []);

  /** Cancels the in-flight request and marks anything still pending as stale. */
  const cancel = useCallback(() => {
    const state = ref.current;
    state.controller?.abort();
    state.controller = null;
    state.id += 1;
  }, []);

  /**
   * Returned through a `useMemo` so the object identity is stable. Callers put
   * it in an effect's dependency array, and a fresh `{ begin, cancel }` literal
   * every render would re-run the effect on every render.
   */
  return useMemo(() => ({ begin, cancel }), [begin, cancel]);
}
