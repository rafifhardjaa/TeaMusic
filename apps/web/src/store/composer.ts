import { create } from 'zustand';
import type { Mood, Track, ZodiacSign } from '../lib/types';

export const RECIPIENT_MAX = 60;
export const MESSAGE_MAX = 280;

/**
 * The mixer and the send form are siblings on the Home page but both feed the
 * same draft, so the draft is lifted into a store rather than drilled through
 * props or duplicated in two places.
 */
interface ComposerState {
  recipient: string;
  message: string;
  track: Track | null;
  zodiac: ZodiacSign | null;
  mood: Mood | null;
  setRecipient: (value: string) => void;
  setMessage: (value: string) => void;
  setTrack: (track: Track | null) => void;
  setZodiac: (value: ZodiacSign | null) => void;
  setMood: (value: Mood | null) => void;
  reset: () => void;
}

const EMPTY = {
  recipient: '',
  message: '',
  track: null,
  zodiac: null,
  mood: null,
} satisfies Omit<ComposerState, 'setRecipient' | 'setMessage' | 'setTrack' | 'setZodiac' | 'setMood' | 'reset'>;

export const useComposer = create<ComposerState>((set) => ({
  ...EMPTY,
  setRecipient: (recipient) => set({ recipient }),
  setMessage: (message) => set({ message }),
  setTrack: (track) => set({ track }),
  setZodiac: (zodiac) => set({ zodiac }),
  setMood: (mood) => set({ mood }),
  reset: () => set({ ...EMPTY }),
}));
