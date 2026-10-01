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

export type ZodiacSign = (typeof ZODIAC_SIGNS)[number];
export type Mood = (typeof MOODS)[number];

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

export interface Message {
  id: string;
  recipient: string;
  message: string;
  trackId: string;
  trackName: string;
  artistName: string;
  coverUrl: string;
  /** 30 second clip. NOT NULL in the schema, so never absent on a stored row. */
  previewUrl: string;
  zodiac: ZodiacSign | null;
  mood: Mood | null;
  createdAt: string;
}

export interface ApiHealth {
  ok: boolean;
  provider: 'itunes';
}
