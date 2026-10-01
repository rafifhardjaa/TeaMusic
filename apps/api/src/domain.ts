export const ZODIAC_SIGNS = [
  'aries',
  'taurus',
  'gemini',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'scorpio',
  'sagittarius',
  'capricorn',
  'aquarius',
  'pisces',
] as const;

export const MOODS = [
  'euphoric',
  'nostalgic',
  'romantic',
  'melancholic',
  'rebellious',
  'dreamy',
  'chilled',
  'restless',
] as const;

export interface Track {
  id: string;
  name: string;
  artist: string;
  album: string;
  genre: string;
  coverUrl: string;
  previewUrl: string | null;
  durationMs: number;
  externalUrl: string;
}
