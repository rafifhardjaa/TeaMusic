import { useCallback, useEffect, useState, lazy, Suspense } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Nav } from './components/Nav';
import { ModeBanner } from './components/ModeBanner';
import { DetailModal } from './components/DetailModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Footer } from './components/Footer';
import { Toast } from './components/ui/Toast';
import { Home } from './pages/Home';
import { applyPageSeo, routeSeo } from './lib/seo';
import type { Message } from './lib/types';

// Every route but Home is fetched on navigation. The pages export named
// components, so the module is remapped to the shape `lazy` expects.
const Browse = lazy(() => import('./pages/Browse').then((m) => ({ default: m.Browse })));
const History = lazy(() => import('./pages/History').then((m) => ({ default: m.History })));
const Inbox = lazy(() => import('./pages/Inbox').then((m) => ({ default: m.Inbox })));

export default function App() {
  const [active, setActive] = useState<Message | null>(null);
  const close = useCallback(() => setActive(null), []);
  const { pathname } = useLocation();

  /*
    The router changes the page without a reload, so the head has to be
    rewritten by hand. An open message overrides this from inside DetailModal,
    which is the only component that knows whether a card is up, and restores
    the route it was opened from when it closes.
  */
  useEffect(() => {
    applyPageSeo(routeSeo(pathname));
  }, [pathname]);

  // overflow-x-clip, not hidden: hidden makes this a scroll container and
  // silently disables every position:sticky descendant (e.g. the preview
  // card). Clip restrains the x-axis without creating one.
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <Nav />
      <ModeBanner />

      {/*
        Keyed on the pathname so a crashed page clears itself on navigation —
        that is the whole recovery mechanism, which is why ErrorBoundary has no
        reset button. Nav and footer sit outside it on purpose: a page that
        throws must not cost the visitor the site.
      */}
      <main className="flex-1">
        <ErrorBoundary key={pathname} label="This page">
          <Suspense fallback={<RouteSkeleton />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/browse" element={<Browse onOpen={setActive} />} />
              <Route path="/history" element={<History />} />
              {/* Two inbox routes: `/to` prompts for a name (or uses the remembered
                  one), `/to/:name` opens it directly. Both land on the same page. */}
              <Route path="/to" element={<Inbox onOpen={setActive} />} />
              <Route path="/to/:name" element={<Inbox onOpen={setActive} />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>

      <Footer />

      {/*
        The modal is outside the routed boundary on purpose — it is not part of
        any page — so it gets its own. A throw while a track preview is resolving
        should cost the dialog, not the page behind it.
      */}
      {active ? (
        <ErrorBoundary label="The track preview">
          <DetailModal message={active} onClose={close} />
        </ErrorBoundary>
      ) : null}

      <Toast />
    </div>
  );
}

function NotFound() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-32 text-center">
      <p className="font-serif text-5xl text-ink">Nothing here</p>
      <p className="mt-3 text-ink-soft">That page does not exist.</p>
    </div>
  );
}

/** Holds the layout while a lazily loaded route is fetched, so nothing jumps. */
function RouteSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-20" role="status" aria-busy="true">
      <span className="sr-only">Loading this page</span>
      <div className="h-10 w-52 rounded-lg bg-line/40" />
      <div className="mt-6 h-4 w-80 max-w-full rounded-full bg-line/40" />
      <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((slot) => (
          <div key={slot} aria-hidden className="h-40 rounded-2xl bg-line/40" />
        ))}
      </div>
    </div>
  );
}
