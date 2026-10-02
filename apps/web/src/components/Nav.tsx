import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { List, Waveform, X } from '@phosphor-icons/react';

const LINKS = [
  { to: '/', label: 'Create' },
  { to: '/browse', label: 'Browse' },
  { to: '/to', label: 'Inbox' },
  { to: '/history', label: 'History' },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const barRef = useRef<HTMLElement>(null);

  // Route changes close the menu, including browser back/forward while it is
  // open. Adjusted during render rather than in an effect: comparing the path
  // against the last one seen is the React-sanctioned "adjust state when a
  // prop changes" pattern, and it skips the extra effect-driven re-render an
  // effect would cost on every navigation.
  const [lastPath, setLastPath] = useState(location.pathname);
  if (location.pathname !== lastPath) {
    setLastPath(location.pathname);
    setOpen(false);
  }

  // Escape and taps outside the bar close it too. A menu with no outside-click
  // dismissal traps the page behind a panel the user may not connect to the
  // button that opened it.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!barRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  // Full-bleed bar (border spans the viewport); the inner row shares the
  // app's standard container so nav content aligns with page content.
  // Below md the four links collapse into a dropdown under the bar: the bar
  // is sticky, so the panel rides the same sticky stack and needs no overlay.
  return (
    <nav ref={barRef} className="sticky top-0 z-50 border-b border-line/50 bg-paper/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4">
        <NavLink to="/" className="flex items-center gap-2">
          <Waveform size={26} weight="fill" className="text-ink" />
          <span className="font-serif text-2xl font-bold tracking-tight text-ink italic">TeaMusic.</span>
        </NavLink>

        <div className="hidden gap-8 text-sm font-medium md:flex">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              // `end` only for the root: `/` would otherwise match every route
              // as a prefix. `/to` must stay lit while on `/to/:name`, so it
              // keeps prefix matching.
              end={link.to === '/'}
              className={({ isActive }) =>
                `transition-colors ${isActive ? 'text-ink' : 'text-ink-soft hover:text-ink'}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>

        <button
          type="button"
          className="-mr-2 p-2 text-ink md:hidden"
          aria-expanded={open}
          aria-controls="nav-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={24} /> : <List size={24} />}
        </button>
      </div>

      {open && (
        <div id="nav-menu" className="border-t border-line/50 md:hidden">
          <div className="mx-auto flex w-full max-w-6xl flex-col px-5">
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `border-b border-line/40 py-3.5 text-sm font-medium transition-colors last:border-b-0 ${
                    isActive ? 'text-ink' : 'text-ink-soft hover:text-ink'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
