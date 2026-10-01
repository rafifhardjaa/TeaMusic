# STATUS

**Date:** 2026-10-01
**Phase:** Supabase live, quality gates automated, dead code removed
**Blockers:** None open. The Supabase URL was supplied and the live path is verified (see PROGRESS).

## What exists

| Area              | State   | Notes                                                 |
| ----------------- | ------- | ----------------------------------------------------- |
| Design system     | Done    | Tokens audited in compiled CSS, fonts resolve          |
| F1 Compose        | Done    | Contained inputs, live iTunes search, validation       |
| F2 Vibe Mixer     | Done    | 96 client-side queries, cover-tinted aura, deterministic |
| F3 Share to Story | Done    | 1080x1920 PNG verified visually, cover art embedded    |
| F4 Marquee        | Done    | 340px cards, duplicated CSS loop, pauses on hover      |
| F5 Browse         | Done    | Debounced, URL-synced, indexed on `recipient`           |
| F6 Detail modal   | Done    | Real 30s preview from the stored row, deep linkable    |
| iTunes provider   | Done    | Search + lookup, 600px art, preview, genre             |
| Cover art         | Done    | Loads from CDN directly; only export needs the proxy   |
| API               | Done    | 6 routes, CORS wired to ALLOWED_ORIGIN, no credentials |
| Supabase schema   | Live    | Applied to the real project, verified via REST + browser |
| Supabase client   | Live    | Select/insert/search exercised against the project |
| Share previews    | Done    | Edge OG injection, default card, per-route head |
| Checks            | Live    | 5 runnable `node:assert` scripts, no test framework     |

## Mode

**Live mode.** Supabase credentials are set in `apps/web/.env.local` and the
schema is applied. Messages persist in the `messages` table; local mode
(`localStorage` + iTunes seeds) remains the automatic fallback when keys are
absent.

## Quality gates

| Gate                | Result                       |
| ------------------- | ---------------------------- |
| `tsc` (web + api)   | Clean                        |
| `oxlint`            | Clean, zero warnings         |
| `vite build`        | Passes                       |
| `check:api`         | 4/4 — cache hit, 404, failure, abort |
| `check:phosphor`    | 5/5 — 1,512 icons trimmed and loadable |
| `check:security`    | 4/4 — env reads and console confined |
| `check:sanitize`    | 6/6 — breadcrumbs shed hostile input |
| `check:seo`         | 15/15 — card rewrite, escaping, crawl surface |
| Emoji audit         | Zero codepoints in src       |
| Icon audit          | Phosphor only                |
| Headless render     | Zero console errors          |
| Story image export  | Renders at 1080x1920         |
| Modal network calls | Only `/api/tracks/:id`, cached |
| API-down resilience | Covers + feed still render; banner warns |
| Bundle size        | 509 KB / 169 KB gzip (was 5.5 MB mid-pass, see PROGRESS) |

## Known constraints

- One verification row ("Galih") sits in the `messages` table. Delete it in the
  Table Editor or keep it as the first message.
- Local mode is now dormant but intact: remove the keys from `.env.local` and
  the app falls back to `localStorage` automatically.
- `preview_url` is NOT NULL. The API filters clip-less tracks out of search, so
  the composer can only offer sendable tracks. Measured 0 of 497 iTunes results
  lack a clip.
- A public `INSERT` policy is genuinely unbounded. CHECK constraints cap field
  lengths and vocabularies, but nothing stops volume. Rate limiting needs to
  happen somewhere — the database cannot do it alone.
- The clip filter runs on search only, because `preview_url` is NOT NULL: a
  track without a preview must never reach the form. The lookup route does not
  filter, and cannot produce a row that could not have been inserted.
- Local mode data is per-browser and clears with site data.
- The image proxy allowlist covers `mzstatic.com` and `apple.com`. A different
  artwork host would need adding to `ALLOWED_HOST_SUFFIXES`.

## Next

M1 is done: the schema is applied, the live path is verified, and messages
persist in Supabase on a second device. What is left is in `TODO.md`; in order:

0. **Deploy.** The Koyeb + Cloudflare Pages steps are written out in
   `README.md` under `## Deploy`, including the two `curl` probes that prove
   the share card and the cross-origin API from the live hosts.

1. Shareable per-message links — `/?m=<id>` works in one browser, and `/to/:name`
   groups by recipient, but neither is an unguessable per-message URL.
2. Recipient privacy: an unguessable share slug beside the searchable name.
3. Abuse controls beyond CHECK constraints — something must cap volume.
4. Accessibility pass, then tests beyond the four checks (the mixer and the
   repository layer are the cheapest high-value targets).
