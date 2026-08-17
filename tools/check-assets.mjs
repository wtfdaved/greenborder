#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   Shared-asset cache-busting guard — `npm run check:assets`

   The pages are static HTML that pull their real styling from a few
   shared files. Browsers cache those aggressively, so shipping new HTML
   against a stale cached stylesheet renders a half-old, half-new page —
   this repo has been bitten by it twice (see the "stale cached
   stylesheet" fix in the history, and the recolor that followed it).

   Hand-incremented ?v=N numbers fail the same way: they only work if
   someone remembers. So the version IS the content hash. Change a
   shared asset and this check fails until the references are updated:

     npm run check:assets -- --fix

   ═══════════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';

// asset path -> how it appears in href/src attributes
const ASSETS = [
  'css/brand.css',
  'css/liquid-glass.css',
  'css/longform.css',
  'js/liquid-glass.js',
  'js/tailwind-brand.js',
];

const fix = process.argv.includes('--fix');

const version = (p) =>
  createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 8);

const want = Object.fromEntries(ASSETS.map((a) => [a, version(a)]));

const files = execSync("git ls-files -- '*.html'", { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  // partials/ are chrome templates, not pages; sync-chrome.mjs renders
  // them into the pages, which is where the asset refs actually live.
  .filter((f) => !f.startsWith('partials/'));

const stale = [];
let fixed = 0;

for (const file of files) {
  const before = readFileSync(file, 'utf8');
  let out = before;

  for (const asset of ASSETS) {
    // matches /css/brand.css?v=xxxx  (and the same path without a query)
    const re = new RegExp(`(/${asset.replace('.', '\\.')})(\\?v=([\\w]+))?`, 'g');
    out = out.replace(re, (m, path, _q, seen) => {
      if (seen === want[asset]) return m;
      stale.push({ file, asset, seen: seen || '(none)', want: want[asset] });
      return `${path}?v=${want[asset]}`;
    });
  }

  if (fix && out !== before) {
    writeFileSync(file, out);
    fixed++;
  }
}

if (!stale.length) {
  console.log(`✔ shared assets cache-busted by content hash across ${files.length} pages`);
  process.exit(0);
}

if (fix) {
  console.log(`✔ updated ${fixed} page(s) to current asset hashes:`);
  for (const [asset, v] of Object.entries(want)) console.log(`    ${asset} -> ?v=${v}`);
  process.exit(0);
}

console.error(`\n✖ ${stale.length} stale shared-asset reference(s):\n`);
const seen = new Set();
for (const s of stale) {
  const k = `${s.asset}|${s.seen}`;
  if (seen.has(k)) continue;
  seen.add(k);
  console.error(`  ${s.asset}: pages reference ?v=${s.seen}, content hashes to ${s.want}`);
}
console.error(
  '\n  A shared asset changed without its cache-busting version.\n' +
    '  Returning visitors would get new HTML against the old cached file.\n' +
    '  Run: npm run check:assets -- --fix\n'
);
process.exit(1);
