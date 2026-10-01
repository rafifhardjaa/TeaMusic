import { breadcrumb, type BreadcrumbInput } from './sanitize';
import { config } from './config';

/**
 * The only module in this process allowed to write to a console.
 *
 * The debug-gated calls funnel through `config.debug` here rather than at each
 * call site, so a log line added later cannot skip the gate:
 * `scripts/security.check.ts` fails if any other API file touches `console`.
 */
export function log(...args: unknown[]): void {
  if (config.debug) console.log(...args);
}

export function logError(...args: unknown[]): void {
  if (config.debug) console.error(...args);
}

/**
 * The one write that is NOT behind the debug gate.
 *
 * A production crash must leave a trace even though detail is off — otherwise
 * the endpoint silently accepts reports and records nothing. It is narrow
 * enough to stay on: the caller hands over four fields, sanitizing happens
 * inside, and stacks are not part of the shape it accepts.
 *
 * Do not add a `config.debug` check here, and do not widen the input — both
 * would undo the "always on, never verbose" line this exists to hold.
 */
export function logBreadcrumb(input: BreadcrumbInput): void {
  console.log(breadcrumb(input));
}
