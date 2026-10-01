import { useEffect, useState } from 'react';
import { getHealth } from '../lib/api';
import { isSupabaseConfigured, pingSupabase } from '../lib/supabase';
import { useLatestRequest } from '../lib/useLatestRequest';
import { MetaLabel } from './ui/Card';

type SupabaseState = 'unconfigured' | 'reachable' | 'unreachable';

/**
 * Reports which backends are actually working. Two independent things can
 * fail here: the Elysia API and the Supabase project, so they are reported
 * separately rather than collapsed into one "demo" label.
 *
 * Both checks start in `null`, never in an error state: a banner that flashes
 * before the network answers is worse than one that appears a moment later.
 */
export function ModeBanner() {
  // `null` is the only state that renders nothing, so the banner can never
  // flash an error before the network answers. When Supabase is unconfigured
  // there is nothing to ping, so that branch is resolved during render.
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const [supabase, setSupabase] = useState<SupabaseState | null>(
    isSupabaseConfigured ? null : 'unconfigured',
  );

  const fetcher = useLatestRequest();

  useEffect(() => {
    const req = fetcher.begin();

    // The two probes are independent → fire in parallel. Both branches resolve,
    // so `Promise.all` below cannot reject; `allSettled` would buy nothing.
    // A superseded probe is dropped by `stale()` rather than written, which is
    // what an unmount (and StrictMode's second mount) needs.
    const apiProbe = getHealth(req.signal).then(
      () => true,
      () => false,
    );
    const sbProbe = isSupabaseConfigured
      ? pingSupabase().then(
          (ok) => ok,
          () => false,
        )
      : Promise.resolve(null); // null = "unconfigured", handled during render

    Promise.all([apiProbe, sbProbe]).then(([apiOk, sbOk]) => {
      if (req.stale()) return;
      setApiOk(apiOk);
      setSupabase(sbOk === null ? 'unconfigured' : sbOk ? 'reachable' : 'unreachable');
    });
  }, [fetcher]);

  if (apiOk === null && supabase === null) return null;

  if (apiOk === false) {
    return (
      <Banner tone="accent">
        API offline — start it with: pnpm run dev:api
      </Banner>
    );
  }

  if (supabase === 'unreachable') {
    return (
      <Banner tone="accent">
        Supabase unreachable — check VITE_SUPABASE_URL, then apply supabase/schema.sql
      </Banner>
    );
  }

  if (supabase === 'unconfigured') {
    return (
      <Banner>
        Local mode — messages are stored in this browser only. Add Supabase keys in apps/web/.env.local
      </Banner>
    );
  }

  return null;
}

function Banner({ children, tone = 'neutral' }: { children: string; tone?: 'neutral' | 'accent' }) {
  return (
    <div className={`border-b border-line ${tone === 'accent' ? 'bg-accent/10' : 'bg-paper-alt'}`}>
      <div className="mx-auto max-w-6xl px-5 py-2">
        <MetaLabel className={tone === 'accent' ? 'text-accent' : undefined}>{children}</MetaLabel>
      </div>
    </div>
  );
}
