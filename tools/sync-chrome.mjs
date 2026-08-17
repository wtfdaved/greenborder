#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   Header/footer sync — `npm test` (check) · `npm run sync:chrome -- --fix`

   There is no build step here and no templating, so every page carried
   its own copy of the site header and footer. Predictably they drifted:
   six different nav link sets, three different footer shapes, one page
   missing its search icon, one linking its logo to "#", and exactly one
   page marking the current page for screen readers.

   So the markup gets one home — partials/header.html and
   partials/footer.html — and this tool renders it into every page
   between BEGIN/END markers. Bare invocation checks and fails on drift;
   --fix writes. Same shape as check-assets.mjs.

   Per-page variation is data, not divergence: the language comes from
   <html lang>, the current nav item from the path, and the handful of
   pages with their own call to action are listed in CTA below.
   ═══════════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const fix = process.argv.includes('--fix');

// ── Copy ───────────────────────────────────────────────────────────
const STRINGS = {
  en: {
    L_PRIMARY_NAV: 'Primary',
    L_FOOTER_NAV: 'Footer',
    L_HOME: 'Home',
    L_NEWS: 'News',
    L_DATA: 'Sales Data',
    L_SHOPS: 'Dispensaries',
    L_EDU: 'Education',
    L_ABOUT: 'About',
    L_PARTNERS: 'Partnerships',
    L_SEARCH: 'Search dispensaries',
    L_FAVORITES: 'Our Favorites',
    CTA_LABEL: 'Find Dispensary',
    CTA_HREF: '/#dispensaries',
    F_CTA_TITLE: 'Join the Cannabis Club',
    F_CTA_TEXT:
      'Get the inside scoop on new strains, dispensary openings, and members-only discounts near the border.',
    F_CTA_BTN: 'Read the Latest',
    L_FDA_LABEL: 'FDA DISCLAIMER:',
    L_FDA:
      'The statements made regarding these products have not been evaluated by the Food and Drug Administration. The efficacy of these products has not been confirmed by FDA-approved research. These products are not intended to diagnose, treat, cure or prevent any disease.',
    L_AGE_LABEL: 'AGE WARNING:',
    L_AGE:
      'Content on this site is intended for audiences 21+ only. Cannabis products in New Mexico are for use only by adults 21 years of age and older. Keep out of reach of children. It is illegal to drive a motor vehicle while under the influence of cannabis. Crossing state lines with cannabis products is a violation of federal law.',
    L_TAGLINE: 'Powered by the 915 | Made with ❤ in El Paso, Texas',
  },
  es: {
    L_PRIMARY_NAV: 'Principal',
    L_FOOTER_NAV: 'Pie de página',
    L_HOME: 'Inicio',
    L_NEWS: 'Noticias',
    L_DATA: 'Datos de Ventas',
    L_SHOPS: 'Dispensarios',
    L_EDU: 'Educación',
    L_ABOUT: 'Acerca de',
    L_PARTNERS: 'Colaboraciones',
    L_SEARCH: 'Buscar dispensarios',
    L_FAVORITES: 'Nuestros Favoritos',
    CTA_LABEL: 'Buscar Dispensario',
    CTA_HREF: '/#dispensaries',
    F_CTA_TITLE: 'Únete al Cannabis Club',
    F_CTA_TEXT:
      'Recibe primicias sobre nuevas cepas, aperturas de dispensarios y descuentos exclusivos cerca de la frontera.',
    F_CTA_BTN: 'Lee lo más reciente',
    L_FDA_LABEL: 'AVISO DE LA FDA:',
    L_FDA:
      'Las declaraciones sobre estos productos no han sido evaluadas por la Administración de Alimentos y Medicamentos. La eficacia de estos productos no ha sido confirmada por investigaciones aprobadas por la FDA. Estos productos no están destinados a diagnosticar, tratar, curar ni prevenir ninguna enfermedad.',
    L_AGE_LABEL: 'ADVERTENCIA DE EDAD:',
    L_AGE:
      'El contenido de este sitio está destinado únicamente a mayores de 21 años. Los productos de cannabis en Nuevo México son para uso exclusivo de adultos de 21 años o más. Manténgase fuera del alcance de los niños. Es ilegal conducir un vehículo bajo la influencia del cannabis. Cruzar las fronteras estatales con productos de cannabis es una violación de la ley federal.',
    L_TAGLINE: 'Impulsado por el 915 | Hecho con ❤ en El Paso, Texas',
  },
};

// Pages whose header button is not "Find Dispensary".
const CTA = {
  'astro-buds.html': { CTA_LABEL: 'Back Home', CTA_HREF: '/' },
  'old-gods.html': { CTA_LABEL: 'Back Home', CTA_HREF: '/' },
  'mango-cannabis.html': { CTA_LABEL: 'Back Home', CTA_HREF: '/' },
  'partnerships.html': { CTA_LABEL: 'Become a Partner', CTA_HREF: '#contact' },
  'partner.html': { CTA_LABEL: 'Claim Your Listing', CTA_HREF: '#plans' },
};

// Which nav item is the page you are on.
const current = (file) => {
  if (file === 'index.html') return 'HOME';
  if (file === 'news.html' || file.startsWith('articles/')) return 'NEWS';
  if (file === 'data.html') return 'DATA';
  if (file.startsWith('education/')) return 'EDU';
  if (['astro-buds.html', 'old-gods.html', 'mango-cannabis.html'].includes(file)) return 'SHOPS';
  return null;
};

// The redirect stub has no chrome by design, and the partials are the
// templates — rendering them into themselves would destroy the tokens.
const SKIP = new Set(['directory.html']);
const skip = (f) => SKIP.has(f) || f.startsWith('partials/');

// ── Render ─────────────────────────────────────────────────────────
const NAV_KEYS = ['HOME', 'NEWS', 'DATA', 'SHOPS', 'EDU', 'ABOUT'];

const render = (template, file) => {
  const lang = file.startsWith('education/es/') ? 'es' : 'en';
  const vars = { ...STRINGS[lang], ...(CTA[file] || {}) };
  const cur = current(file);

  let out = template.replace(/^<!--[\s\S]*?-->\n/, ''); // drop the partial's own note
  for (const key of NAV_KEYS) {
    out = out.replaceAll(`{{CUR_${key}}}`, key === cur ? ' aria-current="page"' : '');
  }
  for (const [key, value] of Object.entries(vars)) {
    out = out.replaceAll(`{{${key}}}`, value);
  }

  const missing = out.match(/\{\{[A-Z_]+\}\}/g);
  if (missing) throw new Error(`${file}: unfilled token(s) ${[...new Set(missing)].join(', ')}`);
  return out.trimEnd();
};

// ── Splice ─────────────────────────────────────────────────────────
// First run has no markers, so fall back to the element the page
// already has. After that the markers are the anchor.
// The BEGIN marker carries a "do not edit here" note, so match the
// region name and let anything follow it up to the END marker.
const REGIONS = {
  header: {
    marker: /<!-- BEGIN:header\b[\s\S]*?<!-- END:header -->/,
    legacy: /<header id="tgb-glass-header"[\s\S]*?<\/header>/,
  },
  footer: {
    marker: /<!-- BEGIN:footer\b[\s\S]*?<!-- END:footer -->/,
    legacy: /<footer[\s\S]*?<\/footer>/,
  },
};

const wrap = (name, html) =>
  `<!-- BEGIN:${name} — generated from partials/${name}.html, do not edit here -->\n${html}\n<!-- END:${name} -->`;

const files = execSync("git ls-files '*.html'", { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter((f) => !skip(f));

const headerTpl = readFileSync('partials/header.html', 'utf8');
const footerTpl = readFileSync('partials/footer.html', 'utf8');

const drifted = [];
const missingRegion = [];
let changed = 0;

for (const file of files) {
  const before = readFileSync(file, 'utf8');
  let out = before;

  for (const [name, tpl] of [['header', headerTpl], ['footer', footerTpl]]) {
    const want = wrap(name, render(tpl, file));
    const { marker, legacy } = REGIONS[name];

    const re = marker.test(out) ? marker : legacy.test(out) ? legacy : null;
    if (!re) {
      missingRegion.push({ file, name });
      continue;
    }
    const found = out.match(re)[0];
    if (found !== want) {
      drifted.push({ file, name });
      out = out.replace(re, () => want);
    }
  }

  if (fix && out !== before) {
    writeFileSync(file, out);
    changed++;
  }
}

// ── Report ─────────────────────────────────────────────────────────
if (missingRegion.length) {
  console.error(`\n✖ ${missingRegion.length} page(s) with no chrome region to sync:\n`);
  for (const m of missingRegion) console.error(`  ${m.file}: no ${m.name}`);
  console.error(
    `\n  Add <!-- BEGIN:${'<region>'} --> / <!-- END:${'<region>'} --> markers where the\n` +
      '  chrome belongs, then run: npm run sync:chrome -- --fix\n'
  );
  process.exit(1);
}

if (!drifted.length) {
  console.log(`✔ header and footer match partials/ across ${files.length} pages`);
  process.exit(0);
}

if (fix) {
  console.log(`✔ synced header/footer into ${changed} page(s) from partials/`);
  process.exit(0);
}

console.error(`\n✖ ${drifted.length} chrome region(s) drifted from partials/:\n`);
for (const d of drifted) console.error(`  ${d.file}: ${d.name}`);
console.error(
  '\n  The header and footer are generated. Edit partials/header.html or\n' +
    '  partials/footer.html, then run: npm run sync:chrome -- --fix\n'
);
process.exit(1);
