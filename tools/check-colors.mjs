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
  '#7a7029': 'ramp', '#998a35': 'ramp',
  // warm ink neutrals
  '#22280f': 'ink-900', '#31371c': 'ink-700', '#4b5233': 'ink-500',
  '#5f6749': 'ink-300', '#5d6448': 'ink', '#7d8465': 'ink-on-dark-soft',
  '#9aa383': 'ink-on-dark',
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
// The light canvas is a gradient, so text is checked against its
// DARKEST stop (#f7f3e2). Checking against the lightest one flatters
// every ratio by ~8% and lets borderline colors pass here while failing
// at the bottom of a long page.
const CANVAS = '#f7f3e2';
const DARK = '#0a0a0a';

const PAIRS = [
  ['#375302', CANVAS, 4.5, 'brand text on the light canvas'],
  ['#476d03', CANVAS, 4.5, 'green-600 on the light canvas'],
  ['#6b6224', CANVAS, 4.5, 'cream-700 (accent text) on the light canvas'],
  ['#22280f', CANVAS, 4.5, 'body ink on the light canvas'],
  ['#4b5233', CANVAS, 4.5, 'ink-500 (secondary text) on the light canvas'],
  ['#5f6749', CANVAS, 4.5, 'ink-300 (muted text) on the light canvas'],
  ['#fffbdc', '#375302', 4.5, 'skip-link text on its green fill'],
  ['#ffffff', '#476d03', 4.5, 'button label on the primary green fill'],
  // The accent CTA: cream fill, deep olive label. Checked against the
  // fill's lightest AND darkest stop so the gradient is safe end to end.
  ['#1c2a01', '#fff8b9', 4.5, 'accent-button label on brand cream'],
  ['#1c2a01', '#dccf6e', 4.5, 'accent-button label on cream-400'],
  ['#1c2a01', '#b9ab47', 4.5, 'accent-button label on cream-500'],
  ['#fff8b9', DARK, 4.5, 'brand cream on the dark canvas'],
  ['#7fab16', DARK, 4.5, 'green-400 on the dark canvas'],
  ['#9aa383', DARK, 4.5, 'muted ink on the dark canvas'],
  ['#7d8465', DARK, 4.5, 'separators and meta text on the dark canvas'],
  ['#558203', CANVAS, 3.0, 'brand green as a large/graphical element'],
  ['#8a7c2e', CANVAS, 3.0, 'cream-600 as a graphical element (premium stars)'],
  // A rating only reads if a filled star is clearly not an empty one.
  ['#8a7c2e', '#e6e1c4', 3.0, 'filled vs empty star, premium'],
  ['#558203', '#e6e1c4', 3.0, 'filled vs empty star, standard'],
  ['#558203', DARK, 3.0, 'focus ring on the dark canvas'],
];

// ── Fills that must never carry white text ─────────────────────────
// White on cream-400 is 1.6:1. This is the mistake the palette itself
// cannot catch, so it is checked in the markup: any element that puts
// `text-white` on a light cream fill fails the build.
const CREAM_FILLS =
  /\b(?:bg|from|via|to)-(?:gold|amber|yellow)-(?:50|100|200|300|400|500|600)\b|\b(?:bg|from|via|to)-(?:violet|indigo|purple)-(?:50|100|200|300|400|500)\b|\bbg-sand-(?:50|100|200|300|400|500)\b/;

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
const whiteOnCream = [];

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');

  // Every class list on the line, whether it came from a static
  // `class="…"` attribute or a template literal inside a renderer.
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/class=["'`]([^"'`]*)["'`]/g)) {
      const classes = m[1];
      if (/\btext-white\b/.test(classes) && CREAM_FILLS.test(classes)) {
        whiteOnCream.push({
          file,
          line: i + 1,
          fill: classes.match(CREAM_FILLS)[0],
        });
      }
    }
  });

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

if (whiteOnCream.length) {
  failed = true;
  console.error(`\n✖ ${whiteOnCream.length} white label(s) on a cream fill:\n`);
  for (const o of whiteOnCream) {
    console.error(`  ${o.file}:${o.line}  text-white over ${o.fill}`);
  }
  console.error(
    '\n  Cream fills carry ink, not white — white on cream-400 is 1.6:1.\n' +
      '  Use text-green-900 (or a deeper fill, gold-700 and darker).\n'
  );
} else {
  console.log('✔ no white text sitting on a cream fill');
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
