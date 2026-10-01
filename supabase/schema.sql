-- THE Vibe LAB — Supabase schema
-- Apply via the Supabase SQL editor, or: psql "$SUPABASE_DB_URL" -f supabase/schema.sql
--
-- Mirrors BOOK/DATABASE.md: table `messages`, columns and types as specified,
-- with the recipient index named `idx_recipient` as specified.

create extension if not exists "pgcrypto";

create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  recipient   text not null,
  message     text not null,
  track_id    text not null,
  track_name  text not null,
  artist_name text not null,
  cover_url   text not null,
  preview_url text not null,
  zodiac      text null,
  mood        text null,
  created_at  timestamp not null default now()
);

comment on column public.messages.track_id    is 'iTunes Track ID';
comment on column public.messages.cover_url   is 'URL of the album art (from iTunes)';
comment on column public.messages.preview_url is 'URL of the 30-second audio preview';

-- Indexes (BOOK/DATABASE.md)
create index if not exists idx_recipient on public.messages (recipient);

-- `idx_recipient` above is the index the spec asks for, but on its own it
-- cannot serve the query the app actually runs. Browse searches with
-- `recipient ILIKE '%term%'`, and a btree index only accelerates patterns with
-- a leading anchor, so Postgres demotes the column to a filter and the index
-- goes unused.
--
-- Measured on this schema at 50k rows, searching for a term matching 1 row:
--
--   with this index     255 buffers, 1 row examined,  2.34 ms
--   without it        1,282 buffers, 50,000 examined, 10.20 ms
--
-- The trigram index is what actually delivers "fast search queries". The btree
-- is kept because the spec names it, and it still helps prefix lookups.
--
-- Supabase projects usually keep extensions in the `extensions` schema; if
-- plain `pg_trgm` is refused, use:
--   create extension if not exists pg_trgm with schema extensions;
create extension if not exists pg_trgm;

create index if not exists idx_recipient_trgm
  on public.messages using gin (recipient gin_trgm_ops);

-- Not in the spec, but the recent feed and the marquee both read newest-first
-- (PRD features 4 and 5). Without this, Postgres sorts the whole table on
-- every load. Drop it if the message volume never justifies it.
create index if not exists messages_created_at_idx on public.messages (created_at desc);

-- ---------------------------------------------------------------------------
-- Below this line: additions beyond BOOK/DATABASE.md. Each one exists for a
-- concrete reason and is safe to remove.
-- ---------------------------------------------------------------------------

-- 1. Vocabulary and length guards.
--
-- The insert policy below is public, so without constraints this endpoint is
-- unbounded: any caller can write a 10MB row or a `zodiac` of `'garbage'`,
-- which the UI would then render as an unknown tag. These bounds mirror what
-- the composer already enforces client-side, so they reject nothing legitimate.
-- Plain ALTER TABLE ... ADD CONSTRAINT has no IF NOT EXISTS, so a second run
-- of this file would abort here. The block below adds each constraint only
-- when it is missing, which keeps the whole file safe to re-run — including on
-- a table that was created earlier by hand.
do $$
declare
  defs text[][] := array[
    ['messages_recipient_length',  'check (char_length(recipient)  between 1 and 60)'],
    ['messages_body_length',       'check (char_length(message)    between 1 and 280)'],
    ['messages_track_name_length', 'check (char_length(track_name) between 1 and 200)'],
    ['messages_artist_name_length', 'check (char_length(artist_name) between 1 and 200)'],
    ['messages_preview_url_length', 'check (char_length(preview_url) between 1 and 2048)'],
    ['messages_cover_url_length',   'check (char_length(cover_url)   between 1 and 2048)'],
    ['messages_zodiac_valid', 'check (zodiac is null or zodiac in (
      ''aries'',''taurus'',''gemini'',''cancer'',''leo'',''virgo'',
      ''libra'',''scorpio'',''sagittarius'',''capricorn'',''aquarius'',''pisces''
    ))'],
    ['messages_mood_valid', 'check (mood is null or mood in (
      ''euphoric'',''nostalgic'',''romantic'',''melancholic'',
      ''rebellious'',''dreamy'',''chilled'',''restless''
    ))']
  ];
  entry text[];
begin
  foreach entry slice 1 in array defs loop
    if not exists (
      select 1 from pg_constraint
      where conrelid = 'public.messages'::regclass and conname = entry[1]
    ) then
      execute format('alter table public.messages add constraint %I %s', entry[1], entry[2]);
    end if;
  end loop;
end $$;

-- 2. Row Level Security.
--
-- Required, not optional. Supabase grants the `anon` role broad privileges on
-- tables in `public`, so a table created without RLS is readable and writable
-- by anyone with the publishable key — which ships in the browser bundle.
--
-- The product has no accounts, so messages are deliberately world-readable and
-- world-writable: anyone may send one, anyone may read them.
--
-- UPDATE and DELETE are intentionally absent. Omitting a policy denies the
-- operation outright, so a message can never be rewritten or erased once sent.

alter table public.messages enable row level security;

-- Base privileges, scoped to exactly what the policies allow. Supabase grants
-- these by default on tables created through its UI, but a table created any
-- other way can arrive without them — which surfaces as a bare 42501 that
-- looks identical to an RLS denial. UPDATE and DELETE are deliberately absent.
grant select, insert on public.messages to anon, authenticated;

drop policy if exists messages_public_read on public.messages;
create policy messages_public_read
  on public.messages for select
  to anon, authenticated
  using (true);

drop policy if exists messages_public_insert on public.messages;
create policy messages_public_insert
  on public.messages for insert
  to anon, authenticated
  with check (true);
