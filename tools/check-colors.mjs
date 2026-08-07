#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   Palette guardrail — `npm run check:colors`

   The site's color scheme is two brand colors (#558203 olive green and
   #FFF8B9 desert cream) plus their tints/shades, a short list of
   neutrals, and a handful of status colors that intentionally sit
   outside the brand. Colors are spread across ~30 hand-authored files,
   so the only thing keeping them from drifting is a check like this.

   Fails when it finds:
     1. an off-palette hex literal or rgb()/rgba() triple, and
     2. a documented text/background pairing that misses WCAG AA.
   ═══════════════════════════════════════════════════════════════════ */

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

// ── The palette ────────────────────────────────────────────────────
const BRAND = {
  // olive green scale
  '#f5fae6': 'green-50', '#e7f3c4': 'green-100', '#d0e693': 'green-200',
  '#afd456': 'green-300', '#7fab16': 'green-400', '#558203': 'green-500 (BRAND)',
  '#476d03': 'green-600', '#375302': 'green-700', '#2a3f02': 'green-800',
  '#1c2a01': 'green-900',
  // desert cream scale
  '#fffdf0': 'cream-50', '#fffbdc': 'cream-100', '#fff8b9': 'cream-200 (BRAND)',
  '#f2e895': 'cream-300', '#dccf6e': 'cream-400', '#b9ab47': 'cream-500',
  '#8a7c2e': 'cream-600', '#6b6224': 'cream-700', '#4a431a': 'cream-800',
  '#34300f': 'cream-900',
  // ramp steps used by the ranked dashboard bars
  '#33500a': 'ramp', '#3d5f0d': 'ramp', '#527f10': 'ramp', '#5d8c1c': 'ramp',
  '#7a7029': 'ramp', '#998a35': 'ramp', '#6b9c04': 'ramp',
  // warm ink neutrals
  '#22280f': 'ink-900', '#31371c': 'ink-700', '#4b5233': 'ink-500',
  '#6d7457': 'ink-300', '#5d6448': 'ink', '#7d8465': 'ink',
  '#2d3014': 'shadow ink', '#232712': 'ink', '#e6e1c4': 'empty-state fill',
  '#fbf6e0': 'canvas', '#f7f3e2': 'canvas',
};

// Grayscale, black/white and the browser-default-ish neutrals the pages
// were built on. These carry no hue, so they don't fight the brand.
const NEUTRALS = new Set([
  '#ffffff', '#000000', '#0a0a0a', '#111111', '#1a1a1a', '#222222',
  '#242424', '#2e2e2e', '#f8f8f8', '#f0f0f0', '#f3f4f6', '#cccccc',
  '#e5e7eb', '#d1d5db', '#cbd5e1', '#9ca3af', '#94a3b8', '#6b7280',
  '#4b5563', '#374151', '#334155', '#475569', '#1e293b', '#0f172a',
  '#86868b', '#6e6e73', '#1d1d1f',
]);

// Status colors: growth/decline and destructive actions must stay
// readable as status, so they are deliberately outside the brand.
const STATUS = new Set([
  '#dc2626', '#e11d48', '#be123c', '#f87171', '#ef4444', '#fca5a5',
]);

const ALLOWED = new Set([
  ...Object.keys(BRAND),
  ...NEUTRALS,
  ...STATUS,
]);

// ── WCAG AA pairings we promise in css/brand.css ───────────────────
const PAIRS = [
  ['#375302', '#fffdf0', 4.5, 'brand text on the light canvas'],
  ['#476d03', '#fffdf0', 4.5, 'green-600 on the light canvas'],
  ['#6b6224', '#fffdf0', 4.5, 'cream-700 (accent text) on the light canvas'],
  ['#22280f', '#fffdf0', 4.5, 'body ink on the light canvas'],
  ['#fffbdc', '#375302', 4.5, 'skip-link text on its green fill'],
  ['#fff8b9', '#0a0a0a', 4.5, 'brand cream on the dark canvas'],
  ['#7fab16', '#0a0a0a', 4.5, 'green-400 on the dark canvas'],
  ['#558203', '#fffdf0', 3.0, 'brand green as a large/graphical element'],
];

const luminance = (hex) => {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

// ── Scan ───────────────────────────────────────────────────────────
const files = execSync(
  "git ls-files -- '*.html' '*.css' '*.js' '*.mjs' '*.svg' '*.webmanifest'",
  { encoding: 'utf8' }
)
  .split('\n')
  .filter(Boolean)
  .filter((f) => !f.startsWith('node_modules/') && !f.startsWith('tools/'));

const toHex = (r, g, b) =>
  '#' + [r, g, b].map((n) => Number(n).toString(16).padStart(2, '0')).join('');

const offenders = [];

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');

  lines.forEach((line, i) => {
    const found = new Set();

    for (const m of line.matchAll(/(?:#|%23)([0-9a-fA-F]{6})(?![0-9a-fA-F])/g)) {
      found.add('#' + m[1].toLowerCase());
    }
    for (const m of line.matchAll(
      /\brgba?\(\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})/g
    )) {
      found.add(toHex(m[1], m[2], m[3]));
    }

    for (const hex of found) {
      if (!ALLOWED.has(hex)) {
        offenders.push({ file, line: i + 1, hex, text: line.trim().slice(0, 100) });
      }
    }
  });
}

// ── Report ─────────────────────────────────────────────────────────
let failed = false;

if (offenders.length) {
  failed = true;
  console.error(`\n✖ ${offenders.length} off-palette color(s):\n`);
  for (const o of offenders) {
    console.error(`  ${o.file}:${o.line}  ${o.hex}`);
    console.error(`      ${o.text}`);
  }
  console.error(
    '\n  Use a token from css/brand.css, or add the value to the palette\n' +
      '  in tools/check-colors.mjs if it is a deliberate addition.\n'
  );
} else {
  console.log(`✔ palette clean across ${files.length} files`);
}

const failures = PAIRS.filter(([fg, bg, min]) => contrast(fg, bg) < min);
if (failures.length) {
  failed = true;
  console.error('\n✖ contrast pairings below their target:\n');
  for (const [fg, bg, min, label] of failures) {
    console.error(
      `  ${label}: ${fg} on ${bg} = ${contrast(fg, bg).toFixed(2)}:1 (need ${min}:1)`
    );
  }
} else {
  console.log(`✔ ${PAIRS.length} contrast pairings meet their WCAG target`);
}

process.exit(failed ? 1 : 0);
