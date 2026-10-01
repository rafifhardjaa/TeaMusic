import { create } from 'zustand';

/**
 * The composer preview and the detail modal both surface audio. Without a
 * single owner two clips can play over each other, so playback state lives
 * here and the element itself is shared with any progress UI.
 */
interface AudioState {
  activeId: string | null;
  isPlaying: boolean;
  volume: number;
  play: (id: string, src: string) => void;
  toggle: (id: string, src: string) => void;
  stop: () => void;
  setVolume: (volume: number) => void;
}

let current: HTMLAudioElement | null = null;

/**
 * The live element, for progress readouts. The store owns one detached
 * element rather than one per component, so this is the only way to observe
 * its time.
 */
export function getAudioElement(): HTMLAudioElement | null {
  return current;
}

function teardown() {
  if (current) {
    current.pause();
    current.src = '';
    current = null;
  }
}

export const useAudioStore = create<AudioState>((set, get) => ({
  activeId: null,
  isPlaying: false,
  volume: 0.7,

  play: (id, src) => {
    if (current && get().activeId !== id) teardown();
    if (!current) {
      const el = new Audio(src);
      el.loop = true;
      el.volume = get().volume;
      el.onended = () => set({ isPlaying: false });
      current = el;
    }
    void current.play().then(
      () => set({ activeId: id, isPlaying: true }),
      () => set({ activeId: id, isPlaying: false }),
    );
  },

  toggle: (id, src) => {
    if (get().activeId === id) {
      if (get().isPlaying) {
        current?.pause();
        set({ isPlaying: false });
      } else {
        void current?.play().then(() => set({ isPlaying: true }));
      }
      return;
    }
    get().play(id, src);
  },

  stop: () => {
    teardown();
    set({ activeId: null, isPlaying: false });
  },

  setVolume: (volume) => {
    const clamped = Math.min(1, Math.max(0, volume));
    if (current) current.volume = clamped;
    set({ volume: clamped });
  },
}));
