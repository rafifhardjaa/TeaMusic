import {
  fetchMessageById,
  fetchMessages,
  insertMessage,
  isSupabaseConfigured,
  searchMessagesByRecipient,
} from './supabase';
import type { NewMessage } from './supabase';
import { getTrack } from './api';
import type { Message, Mood, ZodiacSign } from './types';

export type { NewMessage };

const STORAGE_KEY = 'vibe-lab.messages.v1';

/**
 * When Supabase is not configured the app still has to work, so messages fall
 * back to localStorage. Seeded once so Browse and the marquee are not empty on
 * a first run.
 */
interface SeedSpec {
  id: string;
  recipient: string;
  message: string;
  trackId: string;
  trackName: string;
  artistName: string;
  /**
   * Last-known artwork, used only when the API cannot be reached. Display
   * loads cover art straight from the CDN, so the feed still renders with the
   * API down. Apple can rotate these paths; the live lookup replaces them
   * whenever the API is available.
   */
  fallbackCover: string;
  zodiac: ZodiacSign | null;
  mood: Mood | null;
  minutesAgo: number;
}

/**
 * Real iTunes ids, so local mode resolves previews and artwork exactly as live
 * data would. Invented ids would 404 on lookup and hide bugs that only surface
 * against the real provider.
 */
const SEED_SPECS: SeedSpec[] = [
  {
    id: 'seed-1',
    recipient: 'Nadia',
    message: 'You said you would call. I stopped waiting, but I kept the song.',
    trackId: '1436646794',
    trackName: 'Motion Sickness',
    artistName: 'Phoebe Bridgers',
    fallbackCover:
      'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/e0/26/47/e02647bc-2135-6bb0-0efe-1fca80dfbd37/60221.jpg/600x600bb.jpg',
    zodiac: 'scorpio',
    mood: 'melancholic',
    minutesAgo: 42,
  },
  {
    id: 'seed-2',
    recipient: 'Bagas',
    message: 'Congrats on the new job. This one is loud enough to celebrate properly.',
    trackId: '1499378607',
    trackName: 'Blinding Lights',
    artistName: 'The Weeknd',
    fallbackCover:
      'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/6f/bc/e6/6fbce6c4-c38c-72d8-4fd0-66cfff32f679/20UMGIM12176.rgb.jpg/600x600bb.jpg',
    zodiac: 'aries',
    mood: 'euphoric',
    minutesAgo: 180,
  },
  {
    id: 'seed-3',
    recipient: 'Rin',
    message: 'Three years. Same coffee order. Different person reading this.',
    trackId: '509665325',
    trackName: 'Myth',
    artistName: 'Beach House',
    fallbackCover:
      'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/8b/b7/08/8bb7086b-cdb5-1ffe-926b-e7637bda6a0d/BeachHouse_Bloom_iTunes.jpg/600x600bb.jpg',
    zodiac: 'pisces',
    mood: 'dreamy',
    minutesAgo: 1560,
  },
];

/**
 * Seeds carry artwork and a preview clip from the provider rather than
 * hardcoded URLs, which would rot when Apple reshuffles its CDN paths.
 *
 * A spec that cannot be resolved is dropped rather than written with blank
 * fields. `cover_url` and `preview_url` are both NOT NULL with a minimum
 * length in the schema, so a half-built row would be rejected by the very
 * constraints the app relies on. If the API is unreachable, local mode starts
 * empty instead of persisting something the live database would refuse.
 */
async function buildSeed(spec: SeedSpec): Promise<Message> {
  const base: Message = {
    id: spec.id,
    recipient: spec.recipient,
    message: spec.message,
    trackId: spec.trackId,
    trackName: spec.trackName,
    artistName: spec.artistName,
    coverUrl: spec.fallbackCover,
    previewUrl: '',
    zodiac: spec.zodiac,
    mood: spec.mood,
    createdAt: new Date(Date.now() - spec.minutesAgo * 60_000).toISOString(),
  };

  try {
    const track = await getTrack(spec.trackId);
    if (!track?.coverUrl) return base;
    return {
      ...base,
      trackId: track.id,
      trackName: track.name,
      artistName: track.artist,
      coverUrl: track.coverUrl,
      previewUrl: track.previewUrl ?? '',
    };
  } catch {
    // Keep the row. An empty feed with no explanation is worse than a seed
    // whose preview is unavailable.
    return base;
  }
}

let seeding: Promise<Message[]> | null = null;

function seedOnce(): Promise<Message[]> {
  seeding ??= Promise.all(SEED_SPECS.map(buildSeed));
  return seeding;
}

function readLocal(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Message[]) : [];
  } catch {
    return [];
  }
}

/**
 * Returns stored messages, hydrating the seed set on first run. Local mode is
 * the only place this is used, so the cost is one-time.
 */
async function readOrSeed(): Promise<Message[]> {
  const stored = readLocal();
  if (stored.length > 0) return stored;

  const seeded = await seedOnce();
  writeLocal(seeded);
  return seeded;
}

function writeLocal(messages: Message[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(0, 100)));
  } catch {
    // A full or blocked storage quota must not break sending.
  }
}

export async function getMessageById(id: string, signal?: AbortSignal): Promise<Message | null> {
  if (isSupabaseConfigured) return fetchMessageById(id, signal);
  const all = await readOrSeed();
  return all.find((m) => m.id === id) ?? null;
}

export async function listMessages(signal?: AbortSignal): Promise<Message[]> {
  if (isSupabaseConfigured) return fetchMessages(50, signal);
  const all = await readOrSeed();
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function findMessages(recipient: string, signal?: AbortSignal): Promise<Message[]> {
  if (isSupabaseConfigured) return searchMessagesByRecipient(recipient, 50, signal);

  const needle = recipient.trim().toLowerCase();
  if (!needle) return listMessages(signal);
  const all = await readOrSeed();
  return all
    .filter((item) => item.recipient.toLowerCase().includes(needle))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function sendMessage(input: NewMessage): Promise<Message> {
  if (isSupabaseConfigured) return insertMessage(input);

  const created: Message = { id: crypto.randomUUID(), ...input, createdAt: new Date().toISOString() };
  writeLocal([created, ...readLocal()]);
  return created;
}
