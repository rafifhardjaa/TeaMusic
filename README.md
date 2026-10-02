# TeaMusic

Anonymous song messages with a note attached. Pick a track, write the message, mix a vibe onto it, share the story image. The recipient opens a link, the song plays, and they find out it was for them. Your name never appears.

## Stack

| Layer      | Choice                                       |
| ---------- | -------------------------------------------- |
| Frontend   | React 19 + Vite 8 + Tailwind 4 (pnpm)        |
| Routing    | React Router 7                               |
| Animation  | GSAP (ScrollTrigger), CSS only for marquee   |
| Icons      | Phosphor only, zero emojis                   |
| Design     | Adopted from the `vibe.html` prototype        |
| Backend    | ElysiaJS — Bun locally, Cloudflare Workers live |
| Tracks     | iTunes Search API (free, no auth)            |
| Database   | Supabase (PostgreSQL), accessed from browser |
| External   | Web Share API                                |

## Layout

```
apps/web       React frontend (pnpm)
apps/api       ElysiaJS API (Bun)
supabase       schema.sql
scripts        dev.mjs, runs both servers together

# local only, gitignored — kept on disk, never committed:
BOOK           PRD, ARCHITECTURE, DATABASE, DESIGN, RULES
PROGRESS.md    What was built, and the bugs found while verifying it
TODO.md        Feature checklist
STATUS.md      Current state, quality gates, known constraints
```

## Design

Adopted from the `vibe.html` prototype in this repo: warm alabaster palette
(`#F4F2EC` / `#22211F` / `#E3DFD5`, terracotta `#D97757`), soft elevation
shadows instead of heavy borders, a horizontal zodiac pill rail, mood icon
cards, a live preview panel with a spinning record, and a toast.

Cover art loads straight from Apple's CDN. The `/api/image` proxy — resolved
against `VITE_API_BASE_URL`, never as a route on the frontend host itself — is
used by the story-image export and the card's tint sampler, because both read
pixels through a canvas and the same-origin policy blocks that for a
cross-origin image. Keeping display `<img>` off the proxy means cover art still
renders when the API is down.

## Run it

```bash
bun install --cwd apps/api
pnpm install --cwd apps/web
pnpm run dev
```

Web runs on `http://localhost:5173` and proxies `/api` to `http://localhost:8787`.

Or run them separately:

```bash
pnpm run dev:api     # Bun + ElysiaJS on :8787
pnpm run dev:web     # Vite on :5173
```

## Configuration

Only two values are needed, both in `apps/web/.env.local`:

```bash
cp apps/web/.env.example apps/web/.env.local
```

| Variable                        | What it is                                       |
| ------------------------------- | ------------------------------------------------ |
| `VITE_SUPABASE_URL`             | Project Settings -> API -> Project URL           |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | The `sb_publishable_...` key, same page          |
| `VITE_API_BASE_URL`             | Optional. Blank uses the Vite dev proxy on `/api` |
| `VITE_APP_ENV`                  | Optional. Browser mirror of the API's `APP_ENV`  |
| `VITE_APP_DEBUG`                | Optional. Browser mirror of the API's `APP_DEBUG`|

The API needs no credentials at all — it never talks to the provider either (see the API section). Its optional config lives in `apps/api/.env` (copy `apps/api/.env.example`):

| Variable        | What it is                                                  |
| --------------- | ----------------------------------------------------------- |
| `APP_ENV`       | `production` fails closed; `development` unlocks detail      |
| `APP_DEBUG`     | `true` only matters alongside a non-production `APP_ENV`     |
| `PORT`          | Defaults to `8787`                                          |
| `ALLOWED_ORIGIN`| The one origin allowed to call cross-origin (CORS)          |

`VITE_APP_ENV` / `VITE_APP_DEBUG` are mirrors, not the same variables: the
browser cannot read the API's and the API never sees a `VITE_` name. Both
default to production when unset, so a forgotten config file stays quiet.

**Cross-origin:** during development Vite proxies `/api`, so everything is
same-origin and CORS never enters into it. When a deploy splits the frontend
and the API onto different hosts, set `ALLOWED_ORIGIN` to the frontend's exact
origin — it is echoed back to that origin only, never to an unknown `Origin`
and never as `*`.

**Without Supabase keys the app runs in local mode** — messages are stored in `localStorage`, seeded from real iTunes tracks so artwork and previews behave exactly as live data would. The UI states which mode it is in.

`sb_publishable_` keys are designed to ship to browsers and are still subject to RLS. Never use a service role key in frontend code.

## Database

```bash
psql "$SUPABASE_DB_URL" -f supabase/schema.sql
```

Or paste `supabase/schema.sql` into the Supabase SQL editor.

### Access model

There are no accounts in this product, so messages are deliberately world-readable and world-writable. The schema grants exactly two operations:

| Operation | Policy                | Why                                     |
| --------- | --------------------- | --------------------------------------- |
| `SELECT`  | public, `using true`  | Messages are the product                |
| `INSERT`  | public, `with check`  | Anyone may send one                      |
| `UPDATE`  | **denied**            | A message is a statement, not a draft   |
| `DELETE`  | **denied**            | Nobody may erase what was said          |

Omitting a policy denies the operation outright. Since a public INSERT endpoint is otherwise unbounded, the table also carries CHECK constraints on every text length and on the zodiac/mood vocabularies.

## API

The API carries only what a browser cannot do for itself. Message persistence is not here: the browser talks to Supabase directly with the publishable key, per ARCHITECTURE.md. Track search is not here either — see *Why track search is not on the API* below.

| Method | Route                | Purpose                             |
| ------ | -------------------- | ----------------------------------- |
| GET    | `/api/health`        | Service status                      |
| GET    | `/api/meta`          | Zodiac + mood vocabularies          |
| GET    | `/api/image?url=`    | Cover art proxy for image export    |
| POST   | `/api/errors`        | Client breadcrumbs and error logs   |

The mixer runs in the browser, not behind a route: `mixQuery` turns the picked
zodiac and mood into an iTunes search (two words out of twenty give 96 distinct
queries), so the same pair always asks the provider for the same things. The
exported card's colours come from the cover art itself, with a fixed house
palette as the fallback when extraction fails.

### Why track search is not on the API

iTunes answers browsers directly — `Access-Control-Allow-Origin: *`, preflight
included — so `apps/web/src/lib/api.ts` calls the provider itself, carrying the
visitor's own IP. That matters because Apple rate-limits datacenter addresses
into the ground: behind Cloudflare Workers every search came back 429 and every
lookup 403, while the same requests from a residential connection succeed on
the first try. A server-side proxy would have been the unreliable half of the
pair. The documented limit (~20 requests per minute) is per IP — per visitor —
and far above what one person generates while searching.

### Why the image proxy exists

Apple's CDN sometimes returns cover art without CORS headers, and
`html-to-image` must read the bytes to embed them in the exported story PNG.
The proxy fetches server side, where the same-origin policy does not apply. It
is restricted to `mzstatic.com` and `apple.com` over https, with a
content-type allowlist and a 4 MB cap, so it is not an open proxy.

## Verify

```bash
pnpm run typecheck      # tsc in both apps
pnpm run lint           # oxlint
pnpm run build          # production bundle

pnpm run check:api      # track cache: hit, 404, transport failure, abort
pnpm run check:phosphor # weight trim keeps every icon loadable
pnpm run check:security # env reads, console calls confined to their modules
pnpm run check:sanitize # breadcrumb scrubber drops hostile input
pnpm run check:seo      # share card rewrite, escaping, crawl surface
```

Every check is a plain `node:assert` script run through bun — no test
framework, one runnable proof per piece of non-trivial logic.

## Deploy

Two hosts, one domain: `teamusic.my.id` serves the app from Vercel,
`api.teamusic.my.id` answers `/api/*` from a Cloudflare Worker, and Supabase
keeps both honest from the browser. Neither host needs a payment method.

### API — Cloudflare Workers

- **Deploy:** `wrangler` logs in with the Cloudflare account that owns the
  zone, then ships the Worker:

  ```bash
  bunx wrangler login            # once, opens a browser
  cd apps/api && bun run deploy
  ```

- **Runtime:** `wrangler.toml` points at `src/worker.ts` — the same Elysia app
  `src/index.ts` runs under Bun, built with the official Cloudflare adapter.
  No container, no sleep after 15 minutes: the free tier covers 100 000
  requests per day, and this API is nowhere near it.
- **Environment:** lives in `wrangler.toml` under `[vars]`:

  | Variable         | Value                   | Why                                   |
  | ---------------- | ----------------------- | ------------------------------------- |
  | `APP_ENV`        | `production`            | forces every verbose path off         |
  | `APP_DEBUG`      | `false`                 | belt and braces — production ignores it anyway |
  | `ALLOWED_ORIGIN` | `https://teamusic.my.id` | the only origin the API answers with CORS headers |

  Nothing else: messages go browser → Supabase directly, and track lookups
  never pass through this worker — the browser calls iTunes itself.
- **Domain:** Workers → *teamusic-api* → Settings → Domains & Routes →
  Custom Domains → `api.teamusic.my.id`. The zone lives on the same account,
  so the DNS record and the certificate are created automatically.
- **Logs:** `[observability]` is enabled in `wrangler.toml`; breadcrumbs
  posted to `/api/errors` land in Workers → Observability (free tier
  includes them).
- **Local dev:** unchanged — `pnpm run dev:api` runs
  `bun --watch src/index.ts` on `:8787`. To run the real Worker runtime
  locally instead (workerd, no account needed): `bun run dev:worker`.

### Web — Vercel

- **Project:** import the repository and set **Root Directory** to
  `apps/web`. Everything else is pinned in `apps/web/vercel.json`: install
  `pnpm install --frozen-lockfile`, build `pnpm build` (`tsc -b && vite
  build`), output `dist`, plus an SPA rewrite so client routes reach
  `index.html`.
- **Environment** (build time and middleware runtime, plain text):

  | Variable                       | Value                          |
  | ------------------------------ | ------------------------------ |
  | `VITE_SUPABASE_URL`            | from `apps/web/.env.local`     |
  | `VITE_SUPABASE_PUBLISHABLE_KEY`| the publishable key next to it |
  | `VITE_API_BASE_URL`            | `https://api.teamusic.my.id`   |
  | `VITE_APP_ENV`                 | `production`                   |
  | `VITE_APP_DEBUG`               | `false`                        |

  With no Supabase variables the build is not broken — it runs in local
  mode — it is simply not the live site.
- **Share previews:** `apps/web/middleware.ts` runs only on `/` and `/to/*`
  (its `config.matcher`), where it fetches the built document from the
  static asset, looks the message up at the edge, and rewrites the head
  before the response leaves. Every other path never invokes it.
- **Domain:** with the zone on Cloudflare, add two records:

  | Name  | Type  | Target                | Proxy    |
  | ----- | ----- | --------------------- | -------- |
  | `@`   | A     | `76.76.21.21`         | DNS only |
  | `www` | CNAME | `cname.vercel-dns.com`| DNS only |

  Keep both DNS-only (grey cloud) until Vercel reports the certificate as
  ready in *Settings → Domains*. Afterwards the proxy may stay off — Vercel
  already serves from its own edge.

### After the first deploy

```bash
# the share card a crawler would read — needs a real message id
curl -s 'https://teamusic.my.id/?m=<id>' | grep -o 'property="og:title" content="[^"]*"'

# the API across origins
curl -sI -H 'Origin: https://teamusic.my.id' https://api.teamusic.my.id/api/health
```

Both should answer from the deployed hosts. A card that still says
`TeaMusic — Say Te Amo With a Track` means the message lookup missed, not
that the tags are missing: the default card is the intended fallback.
