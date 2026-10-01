# TODO

_Status: quality gates automated, dead code removed, share previews shipped, 2026-10-01_

## Just completed

### Share previews and SEO

- [x] Default card in `index.html`: Open Graph, Twitter, canonical, robots
      with `max-image-preview:large`, `WebApplication` JSON-LD
- [x] `og-default.png` (1200x630) and `apple-touch-icon.png` (180x180),
      generated from the favicon motif by `scripts/og-images.py`
- [x] `robots.txt` (history disallowed), `sitemap.xml`, and `_routes.json`
      scoping the edge function to the two shareable routes
- [x] The edge function renders a shared link's own card — `/?m=<id>` shows
      "A song for {recipient}" with the cover art, `/to/:name` shows the newest
      whisper — because a crawler never runs the SPA
- [x] Per-route head (title, description, canonical, og:url) kept honest across
      client navigations, and restored when a card modal closes
- [x] `pnpm run check:seo` — 15 assertions over escaping, tag uniqueness, the
      LIKE-escaped inbox query, and both fallbacks

### UI adoption from `vibe.html`

- [x] Palette: `#F4F2EC` bg, `#22211F` text, `#76736A` muted, `#E3DFD5` border, `#D97757` accent
- [x] `shadow-soft` / `shadow-lift` elevation, used instead of heavy borders
- [x] Contained inputs with a terracotta focus ring (`.field`)
- [x] Branding unified on **VibeCheck.** across nav, footer, story card, share title, `<title>`
- [x] Masthead: "Express it with *a track.*" with the italic terracotta accent
- [x] Layout: form + zodiac + mood on the left, live preview sticky on the right
- [x] Zodiac as a horizontal pill rail with Phosphor icons and edge fade masks
- [x] Moods as icon cards, four across
- [x] Live preview card: spinning vinyl, recipient, Kalam message, track row
- [x] Artwork crossfade on track change, scale pop on picker select
- [x] Toast for send / mix / errors
- [x] "Latest Whispers" marquee with 340px cards
- [x] Horizontal scrollbar hidden on the rail

### Bugs reported and fixed

- [x] **Cover art missing** — root cause was mine: display was routed through
      `/api/image`, so every cover depended on the API being up. Display now
      loads the CDN URL directly. Only the html-to-image export uses the proxy,
      because only it reads pixels through a canvas.
- [x] **Play button missing** — same root cause. With the API down, track search
      failed, so there was nothing to play. Verified 11 results / 11 play buttons
      with the API up, and covers at 600px with the API **fully down**.
- [x] Seed rows no longer dropped when the API is unreachable; they fall back to
      verified artwork URLs so the feed is never empty
- [x] `import * as Icon` pulled in all 3,045 Phosphor icons and took the bundle
      from 472 KB to **5.5 MB**. Replaced with an explicit registry: **557 KB**
- [x] Two fabricated artwork URLs in the seed data, caught by curl before ship
- [x] Removed `Hero.tsx` and `VibeMixer.tsx`; split into `Pickers` (zodiac rail
      + mood grid) and `PreviewCard`, so the prototype layout composes without
      rendering the mixer twice
- [x] `Card.tsx` no longer exports an unused `Card` component; `MetaLabel` is
      all that is left of it, and it is the only thing imported from the file

## Verified

- [x] `tsc` clean, `oxlint` clean, build succeeds
- [x] Headless Chrome, full flow: search 11 results + 11 play buttons + 600px
      covers, pick, fill, mix "Golden Ratio Longing", send, marquee 6 to 8,
      browse `?q=dewi` returns 1 card with a 600px cover
- [x] Story export 1080x1920, branded VibeCheck.
- [x] Mobile 390px verified
- [x] **API-down regression test**: covers still 600px, feed still renders,
      banner reads "API OFFLINE"
- [x] Zero console errors throughout

## Cleared

- [x] **Supply `VITE_SUPABASE_URL`** — provided, and the live path is verified end to end
- [x] Apply `supabase/schema.sql`, then verify the RLS policies
- [x] Re-run the full flow against live Supabase

## Next milestone: M1 — real persistence

**Goal:** the app works for someone other than you, and stops losing data.

1. [x] **Supabase live** — URL supplied, schema applied, 4 queries and both
   policies verified against the real project.
2. **Share links that resolve** — `/?m=<id>` works in one browser but is not
   discoverable. Add a per-message path so a shared link opens the detail view
   directly on any device.
3. **Recipient privacy** — messages are world-readable by design, but a
   recipient name is guessable. Consider an unguessable share slug separate
   from the searchable recipient.
4. **Abuse controls** — a public INSERT policy is unbounded. CHECK constraints
   cap field size; nothing caps volume. Needs rate limiting somewhere the
   database cannot do it alone.
5. **Error states** — a failed send currently surfaces only as a toast. Add
   retry and a visible failure state on the button.

## M2 — quality bar

6. **Tests** — four runnable `node:assert` checks exist (`check:api`,
   `check:phosphor`, `check:security`, `check:sanitize`), each a proof for one
   piece of non-trivial logic. The mixer is still the cheapest high-value
   target for the next one, then the repository layer.
7. **Accessibility pass** — focus traps in the modal, `aria-live` on the
   preview, contrast check on the new palette.
8. [x] **Code splitting** — route-level `lazy()` on Browse, History and Inbox
   plus a lazy `html-to-image`; initial chunk is 507 KB / 168 KB gzip.
9. [x] **README refresh** — routes, checks and configuration now match the code.

## M3 — polish

10. Marquee and toast already adopted from the prototype; remaining prototype
    ideas not yet taken: the `About` nav item, a mobile nav menu (the links are
    hidden below `md`), and hover-scaled cover art on the whisper cards.
11. [x] Reconcile `BOOK/RULES.md`, `BOOK/PRD.md` and `BOOK/ARCHITECTURE.md`,
    which said Spotify — all three now say iTunes.
12. Empty state for a brand-new install with zero messages: currently nothing
    renders below the fold, which reads as a broken page.
