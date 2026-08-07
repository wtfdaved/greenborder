#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   Sales-data integrity guard — `npm run check:data`

   The same monthly numbers live in three places: the source CSV exports,
   the dashboard's rawData in data.html, and the home page's
   sales-data-2026.js. They are updated by hand, so they drift silently.

   Checks:
     1. Every month in monthKeys actually has rows in rawData.
     2. adultUse + medical adds up to total on every row.
     3. No month contains the same dispensary twice.
     4. Where a source CSV exists, its grand-total row matches the month
        total in data.html and in sales-data-2026.js.
   ═══════════════════════════════════════════════════════════════════ */

import { readFileSync, existsSync } from 'node:fs';

const money = (n) => '$' + Math.round(n).toLocaleString();
const fail = [];
const ok = [];

// ── data.html ──────────────────────────────────────────────────────
const html = readFileSync('data.html', 'utf8');
const block = html.split('const rawData = [')[1].split('\n    ];')[0];
const rows = [...block.matchAll(/\{[^}]*\}/g)].map((m) => {
  const o = {};
  for (const p of m[0].matchAll(/'(\w+)':\s*(?:'((?:[^'\\]|\\.)*)'|([-\d.]+))/g))
    o[p[1]] = p[2] !== undefined ? p[2].replace(/\\'/g, "'") : parseFloat(p[3]);
  return o;
});

const monthKeys = JSON.parse(
  html.match(/const monthKeys = (\[[^\]]*\]);/)[1].replace(/'/g, '"')
);
const monthLabels = JSON.parse(
  html.match(/const monthLabels = (\[[^\]]*\]);/)[1].replace(/'/g, '"')
);

if (monthKeys.length !== monthLabels.length)
  fail.push(`monthKeys (${monthKeys.length}) and monthLabels (${monthLabels.length}) differ in length`);

const byMonth = new Map();
for (const r of rows) {
  if (!byMonth.has(r.month)) byMonth.set(r.month, []);
  byMonth.get(r.month).push(r);
}

for (const k of monthKeys) {
  if (!byMonth.has(k)) fail.push(`monthKeys lists ${k} but rawData has no rows for it`);
}
for (const k of byMonth.keys()) {
  if (!monthKeys.includes(k)) fail.push(`rawData has rows for ${k} but monthKeys omits it`);
}

for (const r of rows) {
  if (Math.abs(r.total - (r.adultUse + r.medical)) > 1)
    fail.push(`${r.month} ${r.dba}: adultUse + medical (${money(r.adultUse + r.medical)}) != total (${money(r.total)})`);
}

for (const [month, list] of byMonth) {
  const seen = new Set();
  for (const r of list) {
    if (seen.has(r.dba)) fail.push(`${month}: "${r.dba}" appears twice — MoM matching needs one row per dispensary per month`);
    seen.add(r.dba);
  }
}
ok.push(`data.html: ${rows.length} rows across ${byMonth.size} months`);

// ── sales-data-2026.js ─────────────────────────────────────────────
const js = readFileSync('sales-data-2026.js', 'utf8');
const stores = JSON.parse(js.split('const newSalesData2026 = ')[1].split('\n];')[0] + ']');
const totals = JSON.parse(js.split('const salesTotalsByMonth = ')[1].split('\n];')[0] + ']');

for (const t of totals) {
  const dash = byMonth.get(t.month);
  if (!dash) { fail.push(`salesTotalsByMonth has ${t.month} but data.html does not`); continue; }
  const dashTotal = dash.reduce((a, r) => a + r.total, 0);
  if (Math.abs(dashTotal - t.total) > 1)
    fail.push(`${t.month}: data.html total ${money(dashTotal)} != salesTotalsByMonth ${money(t.total)}`);
  if (dash.length !== t.locations)
    fail.push(`${t.month}: data.html has ${dash.length} stores, salesTotalsByMonth says ${t.locations}`);
}
if (!totals.some((t) => t.month === monthKeys.at(-1)))
  fail.push(`salesTotalsByMonth is missing the newest month (${monthKeys.at(-1)}) — the home page would show stale numbers`);
ok.push(`sales-data-2026.js: ${stores.length} store rows, ${totals.length} monthly totals`);

// ── source CSVs ────────────────────────────────────────────────────
// The exports end with an unlabeled grand-total row; that is the number
// the site must reproduce.
const CSV_MONTHS = { 'June 2026.csv': '2026-06', 'July 2026.csv': '2026-07' };

for (const [file, month] of Object.entries(CSV_MONTHS)) {
  if (!existsSync(file)) continue;
  const lines = readFileSync(file, 'utf8').replace(/\r/g, '').split('\n').filter((l) => l.trim());
  const cellsOf = (line) => {
    const c = []; let cur = '', q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === ',' && !q) { c.push(cur); cur = ''; }
      else cur += ch;
    }
    c.push(cur); return c;
  };
  const num = (s) => parseFloat(String(s).replace(/[$,\s]/g, '')) || 0;
  const last = cellsOf(lines.at(-1));
  if (last[0].trim()) { fail.push(`${file}: expected a grand-total row at the end`); continue; }
  const csvTotal = num(last[7]);
  const dash = byMonth.get(month) || [];
  const dashTotal = dash.reduce((a, r) => a + r.total, 0);
  if (Math.abs(dashTotal - csvTotal) > 1)
    fail.push(`${file}: grand total ${money(csvTotal)} != ${month} in data.html ${money(dashTotal)}`);
  else ok.push(`${file} -> ${month}: ${money(csvTotal)} matches`);
}

// ── report ─────────────────────────────────────────────────────────
if (fail.length) {
  console.error(`\n✖ ${fail.length} sales-data problem(s):\n`);
  fail.forEach((f) => console.error('  ' + f));
  console.error('');
  process.exit(1);
}
ok.forEach((o) => console.log('✔ ' + o));
process.exit(0);
