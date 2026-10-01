import {
  ArrowUpRight,
  ClockCounterClockwise,
  Cloud,
  CloudRain,
  Coffee,
  Drop,
  Fire,
  FishSimple,
  HandFist,
  Heart,
  Lightning,
  Moon,
  MoonStars,
  Mountains,
  Plant,
  Scales,
  Sparkle,
  Sun,
  UsersThree,
  Waves,
} from '@phosphor-icons/react';
import type { ComponentType } from 'react';

type IconProps = {
  size?: number;
  weight?: 'light' | 'fill' | 'regular' | 'bold';
  className?: string;
};

type Glyph = ComponentType<IconProps>;

/**
 * Explicit registry, keyed by the `icon` strings in lib/constants.ts.
 *
 * A namespace import (`import * as Icon`) defeats tree-shaking: it pulls in
 * all ~3,000 icons and took the bundle from 472 KB to 5.5 MB. Naming them
 * keeps the import graph small.
 *
 * Only the twenty names that `ZODIAC_META` and `MOOD_META` actually reference
 * are listed. Every entry is reachable through `icon()`, so an unused one is
 * not tree-shaken — it ships. The icons the rest of the app uses directly
 * (Play, Pause, X, ...) are deliberately absent: they are imported by name at
 * their call site and never looked up by string.
 */
const ICONS: Record<string, Glyph> = {
  ArrowUpRight,
  ClockCounterClockwise,
  Cloud,
  CloudRain,
  Coffee,
  Drop,
  Fire,
  FishSimple,
  HandFist,
  Heart,
  Lightning,
  Moon,
  MoonStars,
  Mountains,
  Plant,
  Scales,
  Sparkle,
  Sun,
  UsersThree,
  Waves,
};

/** Resolves a metadata icon name, tolerating an unknown or stale entry. */
export function icon(name: string): Glyph | null {
  return ICONS[name] ?? null;
}
