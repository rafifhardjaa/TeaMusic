import { NavLink } from 'react-router-dom';
import { Waveform } from '@phosphor-icons/react';

const LINKS = [
  { to: '/', label: 'Create' },
  { to: '/browse', label: 'Browse' },
  { to: '/to', label: 'Inbox' },
  { to: '/history', label: 'History' },
];

export function Nav() {
  // Full-bleed bar (border spans the viewport); the inner row shares the
  // app's standard container so nav content aligns with page content.
  return (
    <nav className="sticky top-0 z-50 border-b border-line/50 bg-paper/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4">
        <NavLink to="/" className="flex items-center gap-2">
          <Waveform size={26} weight="fill" className="text-ink" />
          <span className="font-serif text-2xl font-bold tracking-tight text-ink italic">TeaMusic.</span>
        </NavLink>

        <div className="flex gap-8 text-sm font-medium">
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
      </div>
    </nav>
  );
}
