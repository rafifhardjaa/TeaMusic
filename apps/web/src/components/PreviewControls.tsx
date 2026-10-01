import { Pause, Play, SpeakerHigh } from '@phosphor-icons/react';
import { useAudioStore } from '../store/audio';

const TOGGLE = 'shrink-0 rounded-full p-2 text-ink-soft transition-colors hover:text-accent';

interface ToggleProps {
  id: string;
  previewUrl: string;
  /** Icon edge, matching the row it sits in. */
  size?: number;
  /** Extra classes from the call site, appended so both layouts keep their own. */
  className?: string;
}

/**
 * Play/pause for a track's 30 second snippet. One component for all three call
 * sites (track list rows, the detail modal, the live preview): they differ only
 * in icon size and one layout class, and duplicating the button meant three
 * copies of the store wiring and the aria labels.
 */
export function PreviewToggle({ id, previewUrl, size = 16, className = '' }: ToggleProps) {
  const activeId = useAudioStore((state) => state.activeId);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const toggle = useAudioStore((state) => state.toggle);

  const playing = activeId === id && isPlaying;

  return (
    <button
      type="button"
      onClick={() => toggle(id, previewUrl)}
      aria-label={playing ? 'Pause preview' : 'Play preview'}
      className={className ? `${TOGGLE} ${className}` : TOGGLE}
    >
      {playing ? <Pause size={size} weight="light" /> : <Play size={size} weight="light" />}
    </button>
  );
}

/** Renders nothing until a preview is actually playing. */
export function VolumeControl() {
  const volume = useAudioStore((state) => state.volume);
  const setVolume = useAudioStore((state) => state.setVolume);
  const activeId = useAudioStore((state) => state.activeId);

  if (!activeId) return null;

  return (
    <div className="flex items-center gap-2">
      <SpeakerHigh size={15} weight="light" className="text-ink-soft" />
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(volume * 100)}
        onChange={(event) => setVolume(Number(event.target.value) / 100)}
        aria-label="Preview volume"
        className="w-20 accent-[#D97757]"
      />
    </div>
  );
}
