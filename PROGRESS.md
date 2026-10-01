# PROGRESS

_Status: read-only audit executed, share previews shipped — dead code removed, CORS wired, SEO live, 2026-10-01_

## This pass: share previews and SEO

Two questions had to be answered before the deploy: what a shared link looks
like in a chat, and what a crawler indexes when it follows one.

- **The head carries the default card.** `index.html` now has the full Open
  Graph and Twitter set, a canonical link, `robots` with `max-image-preview:large`,
  and a `WebApplication` JSON-LD block, with `og:url` and `og:image` absolute
  because a crawler will not resolve a relative path. `robots.txt` keeps
  `/history` out, `sitemap.xml` lists the three public routes, and
  `_routes.json` scopes the edge function so the rest stays static.
- **The shareable links are rendered at the edge.**
  `apps/web/functions/[[path]].ts` handles `/` and `/to/*` only. For
  `/?m=<uuid>` it fetches that row; for `/to/<name>` it fetches the newest one
  with the same escaped `ilike` the app sends, ordered `created_at desc`. Both
  go through the Supabase REST API with a 2.5 s timeout, and both rewrite the
  tags in the built-in HTML — replacing, not appending, so there is never a
  second `og:title` for a scraper to guess between. Album art is sized from
  600px to 1000px, and anything unreachable falls back to the default card.
  A crawler runs no JavaScript, so the SPA cannot do any of this itself.
- **Escaping happens once, at the injection point.** Recipient, note and
  track are HTML-escaped before they touch an attribute; a note containing
  `<script>` leaves the function as text.
- **The human's head is kept honest too.** `src/lib/seo.ts` rewrites title,
  description, canonical and `og:url` per route, and `DetailModal` overrides
  them while a card is open and restores the route when it closes — one place,
  because both Home's `?m=` deep link and the Browse picker render that modal.
- **Both images come from the favicon's motif.** `scripts/og-images.py`
  scales the four terracotta bars and the palette into a 1200x630 card and a
  180x180 touch icon, so a palette change stays one edit.
- **`check:seo` proves it offline.** Fifteen assertions: escaping, the size
  rewrite, tag uniqueness after a rewrite, idempotency, and five that drive
  `onRequest` with a stubbed fetch — the inbox query shape, HEAD, and both
  fallbacks.

Bundle moved 507 → 509 KB (`seo.ts`), gzip 168 → 169 KB.

## Previous pass: the audit executed

Everything below came out of a full read-only pass over the repo. Three lists
were produced first — code to delete, dead config, unused dependencies — plus
a short list of debug fixes, then all of it was applied in one sitting.

### Code deleted

- `Card.tsx` exported a `Card` component nothing imported. The file now holds
  `MetaLabel` alone, which twelve files do import.
- `apps/api/src/domain.ts` lost `isZodiacSign`, `isMood`, the `ZodiacSign` /
  `Mood` aliases and `Message` — type-guard helpers for a vocabulary that only
  ever arrives through a validated route. `ZODIAC_SIGNS`, `MOODS` and `Track`
  remain, because `/api/meta` serves the first two.
- `export type App = typeof app` in `apps/api/src/index.ts` had no reader.
- `messages.ts` re-exported `isSupabaseConfigured` and `SupabaseError`, both
  of which have their own module; `NewMessage` stays as a type-only re-export.
- The messages store carried `query` and `isSearching` that no component read —
  `search()` now writes only `resultStatus`, `resultError` and `results`.
- `.marquee-track[data-direction='reverse']` matched nothing.
- Nine dead exports became plain definitions: `APP_ENV`, `DailyVibe`,
  `IconProps`/`Glyph`, `LatestRequest`, `ShareResult`/`renderStoryCard`,
  `requireSupabase`, `oppositeMood`/`trackFromMessage`, `ApiError`,
  `HISTORY_KEY`. Each is still used inside its own module; none was imported
  from outside it.

### Dead config removed

- The root `pnpm-lock.yaml` had an empty importer — the root package has no
  dependencies. Deleting it sticks only until the next root `pnpm run`, which
  makes pnpm re-install and regenerate it, so it is a pnpm artifact rather than
  a file this repo owns.
- `apps/api/.gitignore` had mangled log patterns (`_.log`,
  `report.[0-9]_.[0-9]_...`) where globs belong. Now `*.log` and
  `report.[0-9]*.[0-9]*.[0-9]*.[0-9]*.json`.

### Unused dependencies removed

- `@supabase/supabase-js` was a dependency of `apps/api` and is imported
  nowhere in it: persistence is deliberately browser-side. `bun install`
  dropped it from `bun.lock` and the API still typechecks.
- `@types/node` came off `apps/web` together with `"types": ["node"]` in
  `tsconfig.node.json`. That config only covers `vite.config.ts`, and typecheck
  stayed clean without it, so neither was doing work.

### CORS wired to the config that already existed

`ALLOWED_ORIGIN` was documented but unread. It is now a `onRequest` hook in
`apps/api/src/index.ts`: an exact match against the configured origin echoes
that origin back with `Vary: Origin`, `GET, POST, OPTIONS` and
`content-type`, and an `OPTIONS` preflight is answered in the hook with a 204
before routing would 404 it. Anything else — an unknown `Origin`, no Origin at
all — gets no CORS headers, and the value never becomes `*`. Written by hand
against the Elysia hook API rather than with `@elysiajs/cors`, so no dependency
was added for it.

Verified with curl against the running server:

| Request                            | Result                                   |
| ---------------------------------- | ---------------------------------------- |
| GET, allowed Origin                | 200 + `Access-Control-Allow-Origin`      |
| OPTIONS, allowed Origin            | 204 + full allow headers                 |
| GET, `https://evil.example`        | 200, **no** ACAO header                  |
| OPTIONS, unknown Origin            | 204, **no** ACAO header                  |
| GET, no Origin header              | 200, **no** ACAO header                  |

### Debug fixes

- `lib/api.ts` had two over-indented `if (isAbortError(...))` lines in its
  catch blocks.
- `pages/History.tsx` hardcoded `604_800_000` where `HISTORY_TTL` exists; it
  imports it now.
- `ModeBanner` told the reader to run `npm run dev` in a pnpm repo — now
  `pnpm run dev:api`, which is the single command that starts the process the
  banner says is missing. Same correction in `scripts/dev.mjs`.
- `share.ts` prefixed shared text with `🎵`, the one emoji left in src. Dropped;
  RULES has no exceptions.
- `apps/api/.env.example` explains what `ALLOWED_ORIGIN` actually does.

### Docs refreshed

- **README**: `/api/mixer` was listed as a route and has never existed — the
  mixer runs in the browser as `mixQuery()`. Replaced with `POST /api/errors`.
  The HSL-palette paragraph went with it, along with the `picsum` reference in
  the proxy section. `npm run` became `pnpm run` throughout, the four check
  scripts were added, and the configuration tables now cover
  `VITE_APP_ENV`/`VITE_APP_DEBUG` and the API's four values including CORS.
- **STATUS**: blocker cleared, `Tests: None` replaced with the four checks and
  their pass counts, bundle row updated to 507 KB / 168 KB gzip, the
  `/api/mixer` row corrected, and a `preview_url` contradiction resolved — the
  schema says `not null`, so one bullet claiming it was nullable was wrong.
- **TODO**: `VibeReadout.tsx` never existed (the split was `Pickers` +
  `PreviewCard`); Supabase items moved to Cleared; tests, code splitting,
  README refresh and the Spotify reconciliation marked done with what they now
  are.
- **BOOK**: `PRD.md`, `RULES.md` and `ARCHITECTURE.md` all said Spotify. Now
  iTunes, and the PRD's "embedded Spotify player" became the 30-second preview
  it has always been.

### Verification

| Gate                   | Result                                  |
| ---------------------- | --------------------------------------- |
| `pnpm typecheck`       | Clean, both apps                        |
| `pnpm lint`            | Clean, zero warnings                    |
| `check:api`            | 4/4                                     |
| `check:phosphor`       | 5/5 — 1,512 icons trimmed               |
| `check:security`       | 4/4                                     |
| `check:sanitize`       | 6/6                                     |
| `pnpm build`           | 507.10 kB / 167.88 kB gzip              |
| CORS curl matrix       | 5 cases, table above                    |
| Dev servers            | web `:5173` and API `:8787` both 200    |

## This pass: UI adoption and two bug fixes

### The two reported bugs had one root cause, and it was mine

"Cover art missing" and "play button missing" both trace to a single decision:
I had routed *display* of cover art through the `/api/image` proxy. That made
every cover depend on the API process being alive. With it down:

- `/api/image` returned 502, so no cover rendered anywhere
- `/api/tracks/search` returned 502, so there were no results and therefore no
  play buttons to render

Reproduced deliberately by running Vite alone, and confirmed fixed by running
Vite alone again: covers load at 600px and the feed renders, with the banner
correctly reading "API OFFLINE".

The fix is that display loads the CDN URL directly, because an `<img>` does not
need CORS to paint. Only the html-to-image export needs the proxy, because only
it reads pixels back through a canvas. `CoverArt` now takes a `viaProxy` prop
and only the story card sets it.

Seed rows were also dropping themselves whenever the API was unreachable, which
turned a degraded app into an empty one. They now fall back to artwork URLs I
verified return 200.

### A performance regression caught while adopting the UI

Reading icon names out of a namespace import (`import * as Icon`) pulled in all
3,045 Phosphor icons: **472 KB became 5.5 MB**. Replaced with an explicit
registry in `lib/icons.ts`, back to **557 KB**. Worth remembering: Phosphor
exports namespace-style, and a wildcard import is the natural mistake.

### What was adopted from `vibe.html`

Palette (`#F4F2EC` / `#22211F` / `#76736A` / `#E3DFD5`, accent unchanged), soft
elevation shadows, contained inputs with a terracotta focus ring, the
"Express it with *a track.*" masthead, the form-left / preview-right split, the
zodiac pill rail with edge fades, mood icon cards, the spinning-vinyl preview
card, artwork crossfade, scale pop on select, the toast, and the larger
"Latest Whispers" marquee cards. Branding unified on VibeCheck.

The prototype's mood set (4 items) and zodiac icons were not copied verbatim:
the product has 8 moods that are already persisted and constrained in the
schema, so only the visual treatment was taken. The prototype's emoji in mock
copy was dropped, since RULES.md forbids them.

`Hero.tsx` and `VibeMixer.tsx` were deleted. The mixer became `Pickers.tsx`
(zodiac rail + mood grid) and `PreviewCard.tsx`, so Home can compose the
prototype's layout without rendering the picker twice.

## Earlier: what changed

Track data moved from **Spotify Web API to iTunes Search API**, and message
persistence moved from the Elysia API to **Supabase accessed directly from the
browser** with the publishable key.

### Why iTunes

| | Spotify | iTunes |
| --- | --- | --- |
| Auth | Paid app, client credentials | None |
| CORS | Restricted | `Access-Control-Allow-Origin: *` |
| 30s preview | `preview_url` deprecated for new apps | `previewUrl` on almost every track |
| Extra signal | — | `primaryGenreName`, useful for the mixer |

The preview point matters most: it closes the gap flagged in the previous pass,
where inline playback could not be relied on. The detail modal now has real
audio, and no iframe embed.

### Data flow

```
browser ──search/lookup──> Elysia (Bun) ──> iTunes Search API
       │
       └──read/insert────> Supabase (publishable key, RLS-scoped)
```

The API no longer touches the database. It does provider integration, the
mixer, and the cover art proxy. This matches ARCHITECTURE.md: *"Supabase handles
direct data insertion and retrieval"*, *"ElysiaJS ... for Zodiac/Mood combination
algorithms"*.

### Access model

The publishable key is client-safe but RLS-respecting, so it cannot bypass
policies. The product has no accounts, so the schema grants public `SELECT` and
public `INSERT` and deliberately omits `UPDATE` and `DELETE`. A message is a
statement someone made; letting anyone rewrite or erase it would undermine the
format. Because a public INSERT endpoint is otherwise unbounded, the table also
carries CHECK constraints on text lengths and on the zodiac/mood vocabularies.

### Schema change

`preview_url` added per the updated `BOOK/DATABASE.md`. It is nullable rather
than `NOT NULL` because iTunes does not publish a preview for every track, and a
`NOT NULL` column would reject legitimate sends. Messages now persist their own
clip, so opening the detail modal makes **no lookup request** in the common
case; `/api/tracks/:id` remains as a fallback for rows without a clip.

## Bugs found and fixed while verifying

1. **Track search only fired after `onFocus`.** Any value change without a focus
   event never searched, so autofill and programmatic input silently did
   nothing. Now any edit counts as intent.
2. **Nested `<button>` inside `<button>`** in the search results. Invalid HTML;
   React logged a validateDOMNesting error and click handling was unreliable.
   The row and the preview control are now siblings.
3. **Empty `cover_url` crashed React.** An empty `src` string throws, and four
   components rendered artwork unguarded. Artwork now goes through one
   `CoverArt` component that handles missing and failed sources.
4. **Seed data used invented track ids and no artwork.** iTunes 404'd on lookup
   and React errored on the empty `src`. Seeds now use real iTunes ids and
   hydrate artwork *and* preview from the provider, so local mode cannot hide
   bugs that only appear against real data. No hardcoded artwork URLs, which
   would rot when Apple reshuffles its CDN paths.
5. **Image proxy allowlist rewritten** as a suffix match, because Apple shards
   artwork across numbered subdomains (`is1-ssl`, `is2-ssl`, ...). The leading
   dot prevents a lookalike domain from matching.
6. Two `setState`-in-effect patterns removed in favour of render-time
   derivation.

## Verification performed

- `tsc` clean in both apps, `oxlint` clean with zero warnings, production build
  succeeds.
- iTunes confirmed live: search returns 600x600 artwork, a real `previewUrl`,
  `primaryGenreName` and an Apple Music link; lookup by id resolves.
- Headless Chrome, full flow against live iTunes:
  - search "the weeknd blinding lights" -> results render
  - pick a track, fill the form, mix Libra + Romantic -> "Golden Ratio Longing"
  - send -> appears at the top of the marquee as "just now"
  - open the modal -> 600px cover, preview control present, **only `/api/mixer`
    called**, no track lookup, confirming the stored `preview_url` is used
  - export -> 1080x1920 PNG, 1.82 MB
  - browse `?q=dewi` -> 1 result
  - **zero console errors, zero exceptions, zero network errors**
- Exported story image written to disk and visually inspected: Playfair
  headline, Kalam handwriting, real album art embedded, correct palette.

## Schema aligned to BOOK/DATABASE.md

Rewritten to the spec: `preview_url text not null`, and the recipient index
named `idx_recipient` as the spec names it. The temporary Neon project used for
verification has been deleted; the existing `affiliate-erp` project was not
touched.

### `preview_url` is now NOT NULL

The spec is right that it can be. Measured across 497 US storefront song results
across 20 queries: **0 missing `previewUrl`**. To make the constraint a
statement about the data rather than a hope, the API now filters preview-less
tracks out of search results, and the composer refuses to send a track without
a clip.

Making it NOT NULL cascaded into three code changes:

- `Message.previewUrl` is `string`, not `string | null`.
- Seed rows that cannot be resolved are **dropped** instead of written with
  blank fields, since `cover_url` and `preview_url` both have a minimum-length
  check. A half-built seed would be rejected by the same constraints the app
  depends on.
- The detail modal no longer needs a lookup to play audio; the remaining
  lookup only recovers the Apple Music link, which is not stored.

### The recipient index does not do what the spec assumes

`BOOK/DATABASE.md` asks for "Index on `recipient` for fast search queries".
Browse searches with `recipient ILIKE '%term%'`, and a btree index only
accelerates patterns with a leading anchor. The index therefore goes unused.

Verified on this schema at 50k rows, searching for a term matching one row:

| | Buffers | Rows examined | Time |
| --- | --- | --- | --- |
| with trigram GIN | 255 | 1 | 2.34 ms |
| btree only | 1,282 | 50,000 | 10.20 ms |

A trigram GIN index is what actually delivers the spec's stated purpose, so it
is in the schema alongside the named btree. `idx_recipient` is kept because the
spec names it, and it still helps prefix lookups.

## Schema verification performed

Applied to a real PostgreSQL 17 instance and exercised, not just eyeballed:

- Table DDL, both extensions, all three indexes: applied without error.
- All 11 columns match the spec exactly: names, order, types, nullability, and
  `gen_random_uuid()` / `now()` defaults.
- 7 invalid inserts all **rejected**: `preview_url` null, `cover_url` null,
  recipient 61 chars, message 281 chars, `zodiac` capitalised as `Gemini`,
  `mood` = `garbage`, empty recipient.
- 4 boundary inserts all **accepted**: recipient exactly 60 with message exactly
  280, both nullable columns null, each nullable column set alone. This is the
  half that matters most — an off-by-one in a CHECK would silently reject
  legitimate messages.
- Vocabularies cross-checked by script across `apps/api/src/domain.ts`,
  `apps/web/src/lib/types.ts` and the schema constraints: 12 zodiac and 8 moods,
  matching in all three places.

The RLS block has now been executed against real PostgreSQL 17 with `anon`
and `authenticated` roles created to stand in for the Supabase ones. The
catalog confirms exactly two policies (`SELECT using true`, `INSERT with check
true`, both scoped to those roles) and RLS enabled. With RLS on and no
UPDATE/DELETE policy those operations are denied by a Postgres guarantee, so
there is nothing left in the RLS block that needs Supabase to prove.

One genuine Supabase-only nuance remains: the `anon` role in your project may
be missing base table GRANTs, which produces the same bare 42501 as an RLS
denial. The schema now grants `SELECT, INSERT` explicitly, scoped to match the
policies, so your existing table is covered regardless of how it was created.

## Supabase live verification (done)

After the schema was applied in the SQL Editor:

- `GET /rest/v1/messages` -> `200 []`: the read policy works.
- Deliberately invalid INSERT (empty recipient) -> `400`, code `23514`
  (`messages_recipient_length`): the insert policy lets the write reach the
  check, and the check rejects it. Write path proven without polluting the table.
- Full browser flow against the live project: search -> pick -> fill -> mix
  (Libra + Romantic) -> send -> "Sent", marquee 0 to 2, all with zero console
  errors. The row landed in Supabase with trimmed recipient, full message,
  track, zodiac + mood, real preview and 600px cover, server timestamp.
- `recipient=ilike.%ali%` -> `200 [{"recipient":"Galih"}]`: the Browse query
  shape works through RLS.
- One test row ("Galih") remains in the table. It was written by the
  verification flow. Delete it in the Table Editor, or keep it as the first
  message.

## NOT verified (remaining)

The Supabase path above is verified. What has still never run end to end:

- **A split-origin deploy.** CORS was exercised against the running server with
  curl for five cases, all against `http://localhost:5173`. No deploy has yet
  set `ALLOWED_ORIGIN` to a real frontend origin and loaded the app across it.
- **`POST /api/errors` from a browser.** The route exists, validates and
  typechecks, and `lib/report.ts` calls it, but no test error has travelled the
  whole way into the API log.
- **Volume.** The public INSERT policy caps field size, not count. Nothing has
  measured what sustained traffic does to it.

## Notes

- Demo mode is a first-class path, not a stub. Local mode seeds from the real
  provider precisely so it cannot diverge from live behaviour.
- `PRD.md`, `RULES.md` and `ARCHITECTURE.md` said Spotify until the 2026-10-01
  pass. Everything now says iTunes.
