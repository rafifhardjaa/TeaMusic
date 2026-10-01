import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './env';
import type { Message, Mood, ZodiacSign } from './types';

/**
 * A publishable key (sb_publishable_...) is client-safe and RLS-respecting,
 * so it is safe to ship to the browser. It is not a service role key and must
 * never be used to bypass policies.
 *
 * Derived from env alone, so it stays synchronous and importable from render
 * paths. The library it gates is loaded separately, on first use.
 */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

let modulePromise: Promise<typeof import('@supabase/supabase-js')> | null = null;
let client: SupabaseClient | null = null;

/**
 * Loads `@supabase/supabase-js` only when it is actually going to be used.
 *
 * The library is one of the largest things in the bundle, and most of this
 * app's visitors run in local mode where it never runs at all. Importing it
 * statically charged every one of them for code only the other mode executes.
 * The promise is kept so the module is fetched once no matter how many queries
 * fire in the same tick.
 */
function loadSupabase(): Promise<typeof import('@supabase/supabase-js')> {
  modulePromise ??= import('@supabase/supabase-js');
  return modulePromise;
}

/**
 * Returns the shared client, loading the library on first call. Throws when
 * Supabase is unconfigured rather than returning null, because every caller
 * immediately threw `SupabaseError('Supabase is not configured')` anyway —
 * the null only existed to be converted back into that throw.
 */
async function requireSupabase(): Promise<SupabaseClient> {
  if (!isSupabaseConfigured) throw new SupabaseError('Supabase is not configured');
  if (!client) {
    const { createClient } = await loadSupabase();
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

const COLUMNS =
  'id, recipient, message, track_id, track_name, artist_name, cover_url, preview_url, zodiac, mood, created_at';

interface Row {
  id: string;
  recipient: string;
  message: string;
  track_id: string;
  track_name: string;
  artist_name: string;
  cover_url: string;
  preview_url: string;
  zodiac: string | null;
  mood: string | null;
  created_at: string;
}

function toMessage(row: Row): Message {
  return {
    id: row.id,
    recipient: row.recipient,
    message: row.message,
    trackId: row.track_id,
    trackName: row.track_name,
    artistName: row.artist_name,
    coverUrl: row.cover_url,
    previewUrl: row.preview_url,
    zodiac: (row.zodiac as ZodiacSign | null) ?? null,
    mood: (row.mood as Mood | null) ?? null,
    createdAt: row.created_at,
  };
}

export class SupabaseError extends Error {
  readonly code: string | undefined;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'SupabaseError';
    this.code = code;
  }
}

export async function fetchMessageById(id: string, signal?: AbortSignal): Promise<Message | null> {
  const supabase = await requireSupabase();

  let query = supabase.from('messages').select(COLUMNS).eq('id', id);

  // `abortSignal` has to be attached before `.single()` — the terminal builder
  // it returns no longer exposes it.
  if (signal) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query.single();

  if (error) {
    if (error.code === 'PGRST116') return null; // PGRST116 is "no rows returned"
    throw new SupabaseError(error.message, error.code);
  }
  return toMessage(data as Row);
}

export async function fetchMessages(limit = 50, signal?: AbortSignal): Promise<Message[]> {
  const supabase = await requireSupabase();

  let query = supabase
    .from('messages')
    .select(COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (signal) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query;

  if (error) throw new SupabaseError(error.message, error.code);
  return (data as Row[]).map(toMessage);
}

export async function searchMessagesByRecipient(recipient: string, limit = 50, signal?: AbortSignal): Promise<Message[]> {
  const supabase = await requireSupabase();

  const needle = recipient.trim().replace(/[\\%_]/g, (char) => `\\${char}`);

  let query = supabase
    .from('messages')
    .select(COLUMNS)
    .ilike('recipient', `%${needle}%`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (signal) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query;

  if (error) throw new SupabaseError(error.message, error.code);
  return (data as Row[]).map(toMessage);
}

export interface NewMessage {
  recipient: string;
  message: string;
  trackId: string;
  trackName: string;
  artistName: string;
  coverUrl: string;
  previewUrl: string;
  zodiac: ZodiacSign | null;
  mood: Mood | null;
}

export async function insertMessage(input: NewMessage): Promise<Message> {
  const supabase = await requireSupabase();

  const { data, error } = await supabase
    .from('messages')
    .insert({
      recipient: input.recipient,
      message: input.message,
      track_id: input.trackId,
      track_name: input.trackName,
      artist_name: input.artistName,
      cover_url: input.coverUrl,
      preview_url: input.previewUrl,
      zodiac: input.zodiac,
      mood: input.mood,
    })
    .select(COLUMNS)
    .single();

  if (error) throw new SupabaseError(error.message, error.code);
  return toMessage(data as Row);
}

/** Probes the connection so the UI can report live vs unreachable. */
export async function pingSupabase(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const supabase = await requireSupabase();
  const { error } = await supabase.from('messages').select('id').limit(1);
  return !error;
}
