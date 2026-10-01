import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  applyCard,
  escapeHtml,
  onRequest,
  truncate,
  upsizeCover,
  type Env,
} from '../apps/web/functions/[[path]].ts';

/**
 * The share preview is the one feature whose failure is silent: a malformed
 * tag does not throw, it just renders as a bare URL in someone's chat. These
 * assertions cover the parts that can be judged without a crawler — escaping,
 * the size rewrite, and the invariant that matters most, which is that a
 * rewritten page still has exactly one copy of every tag a scraper reads.
 *
 * Run: bun run check:seo
 */

const violations: string[] = [];

function check(label: string, run: () => void): void {
  try {
    run();
    console.log(`ok  ${label}`);
  } catch (error) {
    violations.push(`${label} — ${(error as Error).message}`);
  }
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

async function checkAsync(label: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
    console.log(`ok  ${label}`);
  } catch (error) {
    violations.push(`${label} — ${(error as Error).message}`);
  }
}

const html = readFileSync('apps/web/index.html', 'utf8');

const message = {
  title: 'A song for <Galih> & "friends"',
  description: 'This one made me think of you — 100% <not> a "joke".',
  url: 'https://teamusic.my.id/?m=0b3f9c1e-1f4b-4a0d-9f4a-6f3f2a1b0c9d',
  image: {
    url: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/ab/cd/ef/cover.jpg/1000x1000bb.jpg',
    width: 1000,
    height: 1000,
    alt: 'Cover art for Track — Artist',
  },
};

const rendered = applyCard(html, message);

check('escapes every character that can leave an attribute', () => {
  assert.equal(escapeHtml(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;');
  assert.equal(escapeHtml('plain text'), 'plain text');
});

check('collapses whitespace and caps copy with an ellipsis', () => {
  assert.equal(truncate('  a\n  b  ', 10), 'a b');
  assert.equal(truncate('exactly ten', 11), 'exactly ten');
  assert.equal(truncate('a much longer line of text', 12), 'a much long…');
});

check('sizes album art up and refuses anything not https', () => {
  const thumb = 'https://is1-ssl.mzstatic.com/image/thumb/Music/v4/x.jpg/600x600bb.jpg';
  assert.equal(upsizeCover(thumb), 'https://is1-ssl.mzstatic.com/image/thumb/Music/v4/x.jpg/1000x1000bb.jpg');
  assert.equal(upsizeCover('http://insecure.example/600x600bb.jpg'), '');
  assert.equal(upsizeCover('/local/600x600bb.jpg'), '');
  assert.equal(upsizeCover('https://cdn.example/already/1000x1000bb.jpg'), 'https://cdn.example/already/1000x1000bb.jpg');
});

check('writes one copy of every tag a scraper reads', () => {
  assert.equal(count(rendered, '<title>'), 1);
  assert.equal(count(rendered, 'name="description"'), 1);
  assert.equal(count(rendered, 'rel="canonical"'), 1);
  for (const property of ['og:title', 'og:description', 'og:url', 'og:image', 'og:image:width', 'og:image:height', 'og:image:alt']) {
    assert.equal(count(rendered, `property="${property}"`), 1, `og tag ${property}`);
  }
  for (const name of ['twitter:title', 'twitter:description', 'twitter:image', 'twitter:image:alt']) {
    assert.equal(count(rendered, `name="${name}"`), 1, `twitter tag ${name}`);
  }
});

check('escapes the message out of both the title and the attributes', () => {
  assert.ok(!rendered.includes('<Galih>'), 'raw angle brackets leaked');
  assert.ok(rendered.includes('A song for &lt;Galih&gt; &amp; &quot;friends&quot;'));
  assert.ok(rendered.includes('content="This one made me think of you — 100% &lt;not&gt; a &quot;joke&quot;."'));
  assert.ok(!/<script>alert/.test(rendered));
});

check('swaps in the cover art and points the canonical at the link', () => {
  assert.ok(rendered.includes('content="https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/ab/cd/ef/cover.jpg/1000x1000bb.jpg"'));
  assert.ok(rendered.includes('content="1000"'));
  assert.ok(rendered.includes(`href="${message.url}"`));
  assert.ok(!rendered.includes('VibeCheck — express it with a track'), 'the built-in title survived');
});

check('leaves the tags it does not own alone', () => {
  assert.ok(rendered.includes('name="twitter:card" content="summary_large_image"'));
  assert.ok(rendered.includes('property="og:type"'));
  assert.ok(rendered.includes('application/ld+json'), 'structured data was dropped');
  assert.ok(rendered.includes('</head>'));
});

check('is idempotent — reapplying changes nothing', () => {
  assert.equal(applyCard(rendered, message), rendered);
});

check('index.html ships the default card the crawlers fall back to', () => {
  assert.ok(html.includes('https://teamusic.my.id/og-default.png'), 'og:image must be absolute');
  assert.ok(html.includes('rel="canonical" href="https://teamusic.my.id/"'));
  assert.ok(html.includes('max-image-preview:large'));
  assert.ok(html.includes('content="summary_large_image"'));
  assert.ok(html.includes('apple-touch-icon'));
  assert.ok(html.includes('property="og:image:width" content="1200"'));
  assert.ok(!html.includes('%VITE_'), 'an env placeholder survived into the head');
});

check('the static crawl surface is complete', () => {
  const robots = readFileSync('apps/web/public/robots.txt', 'utf8');
  assert.ok(/^Disallow: \/history$/m.test(robots), 'history must stay out of the index');
  assert.ok(/^Sitemap: https:\/\/teamusic\.my\.id\/sitemap\.xml$/m.test(robots));

  const sitemap = readFileSync('apps/web/public/sitemap.xml', 'utf8');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.deepEqual(locs, ['https://teamusic.my.id/', 'https://teamusic.my.id/browse', 'https://teamusic.my.id/to']);
  assert.ok(!locs.some((loc) => loc.includes('/history')), 'history must not be in the sitemap');

  const routes = JSON.parse(readFileSync('apps/web/public/_routes.json', 'utf8')) as { version: number; include: string[] };
  assert.equal(routes.version, 1);
  assert.deepEqual(routes.include, ['/', '/to/*'], 'only the shareable routes may invoke the function');
});

/**
 * The handler end to end, with Supabase swapped for a stub row: what query it
 * sends, what it writes into the head, and what it does when there is nothing
 * to look up. Runs last because it rebinds the global fetch.
 */
async function integration(): Promise<void> {
  const row = {
    id: '0b3f9c1e-1f4b-4a0d-9f4a-6f3f2a1b0c9d',
    recipient: 'Galih',
    message: 'This one made me think of you.',
    track_name: 'Cruel Summer',
    artist_name: 'Taylor Swift',
    cover_url: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/ab/cd/ef/cover.jpg/600x600bb.jpg',
  };

  const realFetch = globalThis.fetch;
  let queried = '';
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    queried = String(input);
    return new Response(JSON.stringify([row]), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  const env: Env = {
    ASSETS: { fetch: async () => new Response(html, { status: 200 }) },
    VITE_SUPABASE_URL: 'https://project.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'anon-key',
  };

  try {
    await checkAsync('rewards a message link with that message', async () => {
      const response = await onRequest({ request: new Request(`https://teamusic.my.id/?m=${row.id}`), env });
      const body = await response.text();
      assert.ok(queried.includes(`id=eq.${row.id}`), `queried ${queried}`);
      assert.ok(body.includes('<title>A song for Galih</title>'));
      assert.ok(body.includes('content="https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/ab/cd/ef/cover.jpg/1000x1000bb.jpg"'));
      assert.equal(count(body, 'property="og:title"'), 1);
      assert.equal(response.headers.get('cache-control'), 'public, max-age=300');
    });

    await checkAsync('searches an inbox link like the app does, escaped', async () => {
      const response = await onRequest({ request: new Request('https://teamusic.my.id/to/50%25_off'), env });
      const body = await response.text();
      const decoded = decodeURIComponent(queried);
      // `%`, `_` and `\` are all wildcards to LIKE, so all three leave escaped.
      assert.ok(decoded.includes('recipient=ilike.%50\\%\\_off%'), `queried ${queried}`);
      assert.ok(decoded.includes('order=created_at.desc'), 'the newest whisper must win');
      // The card carries the recipient, not the site: the chat already names
      // where the link came from, and the tab suffix would just be noise.
      assert.ok(body.includes('<title>Whispers for 50%_off</title>'), 'inbox title');
      assert.ok(body.includes('50%_off, someone said this.'));
    });

    await checkAsync('answers HEAD with headers and an empty body', async () => {
      const response = await onRequest({ request: new Request('https://teamusic.my.id/?m=0b3f9c1e-1f4b-4a0d-9f4a-6f3f2a1b0c9d', { method: 'HEAD' }), env });
      assert.equal(response.status, 200);
      assert.equal(await response.text(), '');
      assert.ok(response.headers.get('cache-control'));
    });

    await checkAsync('falls back to the built-in card when nothing is configured', async () => {
      const response = await onRequest({
        request: new Request('https://teamusic.my.id/?m=0b3f9c1e-1f4b-4a0d-9f4a-6f3f2a1b0c9d'),
        env: { ASSETS: env.ASSETS },
      });
      assert.equal(await response.text(), html);
    });

    await checkAsync('ignores a link whose id is not a uuid', async () => {
      queried = '';
      const response = await onRequest({ request: new Request('https://teamusic.my.id/?m=<script>'), env });
      assert.equal(await response.text(), html);
      assert.ok(!queried.includes('script'), 'a malformed id must never reach the query');
    });
  } finally {
    globalThis.fetch = realFetch;
  }
}

await integration();

if (violations.length > 0) {
  console.error('seo check failed:');
  for (const violation of violations) console.error(`  - ${violation}`);
  process.exit(1);
}

console.log('\nseo check passed');
