import type { Mood, ZodiacSign } from './types';

interface Display {
  label: string;
  blurb: string;
  /** Phosphor icon name, as used in vibe.html. */
  icon: string;
}

/** House palette, used by the export card and any surface with no accent. */
export const FALLBACK_PALETTE = {
  primary: '#D97757',
  secondary: '#C4A882',
  accent: '#8FA9A4',
  ink: '#22211F',
  paper: '#F4F2EC',
} as const;

export const ZODIAC_META: Record<ZodiacSign, Display> = {
  aries: { label: 'Aries', blurb: 'First. Always first.', icon: 'Fire' },
  taurus: { label: 'Taurus', blurb: 'Slow to move, harder to move.', icon: 'Plant' },
  gemini: { label: 'Gemini', blurb: 'Two thoughts, one mouth.', icon: 'UsersThree' },
  cancer: { label: 'Cancer', blurb: 'Holds the whole family together.', icon: 'Moon' },
  leo: { label: 'Leo', blurb: 'Needs the room to look.', icon: 'Sun' },
  virgo: { label: 'Virgo', blurb: 'Noticing what nobody asked.', icon: 'Sparkle' },
  libra: { label: 'Libra', blurb: 'Will please you before you ask.', icon: 'Scales' },
  scorpio: { label: 'Scorpio', blurb: 'Forgives nothing, forgets nothing.', icon: 'Drop' },
  sagittarius: { label: 'Sagittarius', blurb: 'Leaves before it resolves.', icon: 'ArrowUpRight' },
  capricorn: { label: 'Capricorn', blurb: 'Builds first, celebrates later.', icon: 'Mountains' },
  aquarius: { label: 'Aquarius', blurb: 'Loves everyone from a distance.', icon: 'Waves' },
  pisces: { label: 'Pisces', blurb: 'Boundaries are suggestions.', icon: 'FishSimple' },
};

export const MOOD_META: Record<Mood, Display> = {
  euphoric: { label: 'Euphoric', blurb: 'Too happy, slightly unreasonable.', icon: 'Lightning' },
  nostalgic: { label: 'Nostalgic', blurb: 'A room you cannot get back to.', icon: 'ClockCounterClockwise' },
  romantic: { label: 'Romantic', blurb: 'Involuntary and inconvenient.', icon: 'Heart' },
  melancholic: { label: 'Melancholic', blurb: 'Beautiful, in a draining way.', icon: 'CloudRain' },
  rebellious: { label: 'Rebellious', blurb: 'Refuses the format it is given.', icon: 'HandFist' },
  dreamy: { label: 'Dreamy', blurb: 'Half in the room, half elsewhere.', icon: 'Cloud' },
  chilled: { label: 'Chilled', blurb: 'Deliberately unbothered.', icon: 'Coffee' },
  restless: { label: 'Restless', blurb: 'Standing up without deciding to.', icon: 'MoonStars' },
};

/** One genre per sign. */
const ZODIAC_SEED: Record<ZodiacSign, string> = {
  aries: 'rock',
  taurus: 'soul',
  gemini: 'pop',
  cancer: 'ballad',
  leo: 'disco',
  virgo: 'indie',
  libra: 'r&b',
  scorpio: 'blues',
  sagittarius: 'reggae',
  capricorn: 'orchestral',
  aquarius: 'synthpop',
  pisces: 'ambient',
};

/** One energy word per mood. */
const MOOD_SEED: Record<Mood, string> = {
  euphoric: 'euphoric',
  nostalgic: 'nostalgic',
  romantic: 'love',
  melancholic: 'sad',
  rebellious: 'punk',
  dreamy: 'dreamy',
  chilled: 'chill',
  restless: 'restless',
};

/**
 * The mixer query. Two words out of twenty give 96 distinct iTunes searches,
 * which is as much curation as a fixed lookup table of combinations buys.
 */
export function mixQuery(zodiac: ZodiacSign, mood: Mood): string {
  return `${MOOD_SEED[mood]} ${ZODIAC_SEED[zodiac]}`;
}
