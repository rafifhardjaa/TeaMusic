import type { Message, Mood, Track } from './types';
import { useComposer } from '../store/composer';

/**
 * Opposite moods, used by "answer with a track". The pairs are involutive —
 * flipping twice returns the original — so the answer to an answer lands back
 * where it started rather than drifting.
 */
const MOOD_OPPOSITE: Record<Mood, Mood> = {
  euphoric: 'melancholic',
  melancholic: 'euphoric',
  nostalgic: 'restless',
  restless: 'nostalgic',
  romantic: 'rebellious',
  rebellious: 'romantic',
  dreamy: 'chilled',
  chilled: 'dreamy',
};

function oppositeMood(mood: Mood | null): Mood | null {
  return mood ? MOOD_OPPOSITE[mood] : null;
}

/**
 * Rebuilds a `Track` from a stored message.
 *
 * Messages store the fields the composer needs (id, name, artist, cover, clip)
 * but not the ones only the search response carries (album, genre, duration,
 * Apple Music link). Those are filled with blanks rather than refetched: the
 * composer never reads them when sending, so a lookup here would cost a round
 * trip to populate values that are never sent.
 */
function trackFromMessage(message: Message): Track {
  return {
    id: message.trackId,
    name: message.trackName,
    artist: message.artistName,
    album: '',
    genre: '',
    coverUrl: message.coverUrl,
    previewUrl: message.previewUrl || null,
    durationMs: 0,
    externalUrl: '',
  };
}

/**
 * Prefills the composer to answer a received whisper: same track, the opposite
 * mood, no recipient and no note. Anonymous both ways, so there is no sender to
 * address — the answer is its own message.
 *
 * The track is set directly rather than by searching for it again, so the
 * answer uses the exact track the original used even if it has left search
 * results. The recipient field is deliberately left blank for the user to fill.
 */
export function startVibeBack(message: Message): void {
  const draft = useComposer.getState();
  draft.setTrack(trackFromMessage(message));
  draft.setMood(oppositeMood(message.mood));
  draft.setZodiac(message.zodiac);
  draft.setRecipient('');
  draft.setMessage('');
}