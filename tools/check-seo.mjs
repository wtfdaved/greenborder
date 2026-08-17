#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   SEO guard — `npm run check:seo`

   28 hand-authored pages plus 41 generated ones is more than anyone
   checks by eye. The failures that actually happened here were dull
   ones: a canonical pointing at the wrong path after a file was
   renamed, a page missing from the sitemap, a JSON-LD block with a
   trailing comma that Google silently discarded.

   So every indexable page must have:
     1. a <title> that is present and a sane length
     2. a meta description, present and a sane length
     3. a canonical that matches the file's own path
     4. an og:title / og:description / og:image
     5. exactly one <h1>
     6. JSON-LD blocks that parse
     7. a matching entry in sitemap.xml

   Same shape as the other guards: it prints every failure, then exits
   non-zero.
   ═══════════════════════════════════════════════════════════════════ */

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ORIGIN = 'https://greenborder.org';
const EXCLUDE = new Set(['404.html']);

// Google truncates around 60 characters of title and 160 of
// description. Over is not fatal — it just means the tail is never
// read — so the ceilings here are generous and the floors are the real
// check.
const TITLE = { min: 15, max: 75 };
const DESC = { min: 70, max: 320 };

const fail = [];
let checked = 0;

// Length is measured on what a searcher sees, so entities count as the
// one character they render as, not the five they are written with.
const decode = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&nbsp;/g, ' ');

// The URL a file is served at on GitHub Pages.
const urlFor = (file) =>
  ORIGIN + '/' + (file === 'index.html' ? '' : file.replace(/(^|\/)index\.html$/, '$1'));

const sitemap = readFileSync('sitemap.xml', 'utf8');
const sitemapUrls = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));

const files = execSync("git ls-files -- '*.html'", { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter((f) => !f.startsWith('partials/') && !EXCLUDE.has(f));

for (const file of files) {
  const html = readFileSync(file, 'utf8');
  const at = (msg) => fail.push(`${file}: ${msg}`);

  const robots = html.match(/<meta\s+name="robots"\s+content="([^"]*)"/i)?.[1] || '';
  const noindex = /noindex/i.test(robots);

  // ── JSON-LD parses (checked even on noindex pages) ───────────────
  for (const m of html.matchAll(
    /<script\s+type="application\/ld\+json"\s*>([\s\S]*?)<\/script>/gi
  )) {
    try {
      JSON.parse(m[1]);
    } catch (e) {
      at(`JSON-LD block does not parse — ${e.message}`);
    }
  }

  if (noindex) continue;
  checked++;

  // ── Title ────────────────────────────────────────────────────────
  const title = decode(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() || '');
  if (!title) at('no <title>');
  else if (title.length < TITLE.min) at(`<title> is only ${title.length} chars: "${title}"`);
  else if (title.length > TITLE.max)
    at(`<title> is ${title.length} chars, over ${TITLE.max} — the tail will be cut: "${title}"`);

  // ── Description ──────────────────────────────────────────────────
  const raw = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1];
  const desc = raw === undefined ? undefined : decode(raw);
  if (!desc) at('no meta description');
  else if (desc.length < DESC.min) at(`meta description is only ${desc.length} chars`);
  else if (desc.length > DESC.max) at(`meta description is ${desc.length} chars, over ${DESC.max}`);

  // ── Canonical points at this very file ───────────────────────────
  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1];
  if (!canonical) at('no <link rel="canonical">');
  else if (canonical !== urlFor(file))
    at(`canonical is ${canonical} but the file is served at ${urlFor(file)}`);

  // ── Social cards ─────────────────────────────────────────────────
  for (const prop of ['og:title', 'og:description', 'og:image']) {
    const re = new RegExp(`<meta\\s+property="${prop}"\\s+content="[^"]+"`, 'i');
    if (!re.test(html)) at(`no ${prop}`);
  }

  // ── Exactly one h1 ───────────────────────────────────────────────
  const h1s = [...html.matchAll(/<h1[\s>]/gi)].length;
  if (h1s === 0) at('no <h1>');
  else if (h1s > 1) at(`${h1s} <h1> elements — a page has one subject`);

  // ── Listed in the sitemap ────────────────────────────────────────
  if (canonical && !sitemapUrls.has(canonical))
    at(`not in sitemap.xml (${canonical}) — run: npm run build:sitemap`);
}

// A sitemap entry with no page behind it is a soft 404 waiting to be
// crawled.
const canonicals = new Set(
  files
    .map((f) => readFileSync(f, 'utf8').match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1])
    .filter(Boolean)
);
for (const url of sitemapUrls)
  if (!canonicals.has(url)) fail.push(`sitemap.xml lists ${url} but no page declares it`);

if (!fail.length) {
  console.log(`✔ SEO metadata valid across ${checked} indexable pages`);
  process.exit(0);
}

console.error(`\n✖ ${fail.length} SEO problem(s):\n`);
for (const f of fail) console.error(`  ${f}`);
console.error('');
process.exit(1);
