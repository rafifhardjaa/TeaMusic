import { MetaLabel } from './ui/Card';

export function Footer() {
  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-ink-soft">© TeaMusic. All Rights Reserved.</p>

        <nav className="flex items-center gap-6">
        
          <a
            href="https://saweria.co/lazycodix"
            target = "_blank"
            className="transition-colors hover:text-accent"
          >
            <MetaLabel>Support</MetaLabel>
          </a>
        </nav>
      </div>
    </footer>
  );
}
