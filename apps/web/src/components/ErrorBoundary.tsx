import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '../lib/report';
import { Button } from './ui/Button';

interface Props {
  children: ReactNode;
  /** Names the region in the fallback, so the message says what broke. */
  label?: string;
  /** Replaces the default panel entirely. */
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time throws so one broken subtree cannot take down the page.
 *
 * Without this, any throw during render unmounts the whole React tree and the
 * user gets a blank white document with no way back. Two are mounted in the
 * app: one around the routed page, so a crash keeps the nav and footer alive,
 * and one around everything, as a last resort.
 *
 * A class component because `getDerivedStateFromError` has no hook equivalent.
 * There is deliberately no reset button: the boundaries are keyed by route, so
 * navigating away remounts them and clears the error for free.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // The console still gets the live object; `reportError` additionally ships
    // it to the API, which is the only copy that survives past deployment.
    reportError(error, `ErrorBoundary${this.props.label ? `:${this.props.label}` : ''}`, {
      componentStack: info.componentStack,
    });
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="mx-auto max-w-2xl px-5 py-24 text-center">
        <p className="font-serif text-3xl font-bold tracking-tight text-ink">
          {this.props.label ? `${this.props.label} hit a snag` : 'Something broke'}
        </p>
        <p className="mx-auto mt-3 max-w-md text-base text-ink-soft">
          {error.message || 'An unexpected error stopped this part of the page from rendering.'}
        </p>
        <p className="mt-2 text-sm text-ink-soft">The rest of the page still works — try another section.</p>
        <Button variant="secondary" className="mt-6" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    );
  }
}
