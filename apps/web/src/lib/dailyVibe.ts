import { MOODS, ZODIAC_SIGNS, type Mood, type ZodiacSign } from './types';

/**
 * A single "vibe of the day" pairing, derived from the calendar date so it is
 * stable for everyone on a given day (no server, no randomness) and changes at
 * midnight. This gives Home a reason to be revisited daily without a backend.
 *
 * The date is reduced to a day index since the Unix epoch, then folded into the
 * sign and mood lists with two different coprime-ish strides so consecutive
 * days do not step through the lists in lockstep.
 */
interface DailyVibe {
  zodiac: ZodiacSign;
  mood: Mood;
}

export function dailyVibe(date: Date = new Date()): DailyVibe {
  const dayIndex = Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000,
  );
  return {
    zodiac: ZODIAC_SIGNS[dayIndex % ZODIAC_SIGNS.length],
    // Offset by 5 and stride by 3 so the mood does not change every day in
    // lockstep with the zodiac and the pair feels less mechanical.
    mood: MOODS[(dayIndex * 3 + 5) % MOODS.length],
  };
}
