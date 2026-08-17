#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   Rendered-contrast guard — `npm run check:contrast`

   `check:colors` proves the palette is clean and that the pairings we
   promise in css/brand.css hold. It cannot prove what a reader actually
   sees: a color is only legible relative to whatever ends up behind it,
   and on this site that is a stack of translucent glass over a gradient
   canvas, with a page's inline <style> and css/liquid-glass.css both
   having a say.

   So this check renders every page in a real browser and measures. For
   each element that owns text it composites the background stack —
   alpha, gradients, ancestors — resolves the effective ink, and fails
   on anything under WCAG AA (4.5:1, or 3:1 for large text).

   Not wired into `npm test`: it needs a browser. Run it after any
   change to color, theme, or a shared stylesheet.

     npm run check:contrast              # every page
     npm run check:contrast -- education # only paths matching "education"

   ═══════════════════════════════════════════════════════════════════ */

import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const CACHE = join(ROOT, 'node_modules', '.cache');
const TW_OUT = join(CACHE, 'tgb-tailwind.css');

// ── The Tailwind stand-in ──────────────────────────────────────────
// The pages load the Tailwind Play CDN at runtime. We can't depend on
// the network reaching it (and shouldn't — a check that silently
// measures unstyled pages is worse than no check), so we build the same
// utilities locally from the same config the CDN is handed and serve
// those instead. tailwindcss is pinned to v3 precisely because that is
// what the Play CDN ships; a v4 build would not match production.
const buildTailwind = () => {
  mkdirSync(CACHE, { recursive: true });
  execFileSync(
    process.execPath,
    [
      join(ROOT, 'node_modules', 'tailwindcss', 'lib', 'cli.js'),
      '-i', join(ROOT, 'css', 'tailwind.css'),
      '-o', TW_OUT,
    ],
    { cwd: ROOT, stdio: 'pipe' }
  );
  return readFileSync(TW_OUT, 'utf8');
};

// ── Static server ──────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml', '.ico': 'image/x-icon',
};

const serve = () =>
  new Promise((resolve) => {
    const server = createServer((req, res) => {
      const path = decodeURIComponent(req.url.split('?')[0]);
      // normalize() collapses any ../ before it can escape the repo
      let file = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ''));
      // Directory → index.html, the way GitHub Pages serves it. The
      // /directory.html stub redirects to "/", so this has to resolve.
      if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
      if (!existsSync(file)) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });

// ── Browser ────────────────────────────────────────────────────────
// Prefer whatever Playwright installed; fall back to any chromium in
// PLAYWRIGHT_BROWSERS_PATH, since managed environments often preinstall
// a build under a different revision than the npm package expects.
const findChromium = () => {
  try {
    const p = chromium.executablePath();
    if (existsSync(p)) return undefined; // default resolution is fine
  } catch {}
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (base && existsSync(base)) {
    for (const dir of execSync(`ls -d ${base}/chromium*`, { encoding: 'utf8' }).split('\n')) {
      if (!dir) continue;
      const bin = join(dir, 'chrome-linux', 'chrome');
      if (existsSync(bin)) return bin;
    }
  }
  throw new Error(
    'No Chromium found. Run: npx playwright install chromium'
  );
};

// ── The measurement, run inside the page ───────────────────────────
const walk = () => {
  const parse = (c) => {
    const m = String(c).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (p.some(Number.isNaN)) return null;
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };

  // A gradient is averaged across its stops. Crude, but it is the
  // honest middle of what a reader lands on, and the alternative —
  // sampling pixels — can't tell text from background.
  const gradientAvg = (img) => {
    const stops = [...String(img).matchAll(/rgba?\([^)]*\)/g)].map((m) => parse(m[0])).filter(Boolean);
    if (!stops.length) return null;
    const n = stops.length;
    return {
      r: stops.reduce((s, c) => s + c.r * c.a + 255 * (1 - c.a), 0) / n,
      g: stops.reduce((s, c) => s + c.g * c.a + 255 * (1 - c.a), 0) / n,
      b: stops.reduce((s, c) => s + c.b * c.a + 255 * (1 - c.a), 0) / n,
      a: stops.reduce((s, c) => s + c.a, 0) / n,
    };
  };

  const bgOf = (el) => {
    const stack = [];
    let n = el;
    while (n && n.nodeType === 1) {
      const s = getComputedStyle(n);
      const c = parse(s.backgroundColor);
      const g = s.backgroundImage && s.backgroundImage !== 'none' ? gradientAvg(s.backgroundImage) : null;
      if (c && c.a > 0) stack.push(c);
      if (g) stack.push(g);
      if ((c && c.a === 1) || (g && g.a >= 0.98)) break;
      n = n.parentElement;
    }
    // Below everything sits the page canvas.
    let base = parse(getComputedStyle(document.documentElement).backgroundColor);
    if (!base || base.a < 1) base = { r: 255, g: 253, b: 240, a: 1 };
    for (const c of stack.reverse()) base = over(c, base);
    return base;
  };

  // Emoji carry their own color; measuring the inherited ink tells us
  // nothing about them.
  const EMOJI = /^[\p{Extended_Pictographic}\p{Emoji_Presentation}\s‍️]+$/u;

  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!el.getClientRects().length) continue;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || parseFloat(s.opacity) === 0) continue;
    if (s.webkitTextFillColor === 'rgba(0, 0, 0, 0)') continue; // gradient-filled text
    const text = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(' ')
      .trim();
    if (!text || EMOJI.test(text)) continue;
    const raw = parse(s.color);
    if (!raw) continue;
    const bg = bgOf(el);
    const fg = over({ ...raw, a: raw.a * parseFloat(s.opacity || 1) }, bg);
    const size = parseFloat(s.fontSize);
    const weight = parseInt(s.fontWeight) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    const r = ratio(fg, bg);
    if (r < need) {
      out.push({
        text: text.slice(0, 52),
        tag: el.tagName.toLowerCase(),
        cls: (typeof el.className === 'string' ? el.className : '').slice(0, 52),
        color: s.color,
        bg: `rgb(${bg.r.toFixed(0)},${bg.g.toFixed(0)},${bg.b.toFixed(0)})`,
        size, weight, need,
        ratio: +r.toFixed(2),
      });
    }
  }
  return out;
};

// ── Run ────────────────────────────────────────────────────────────
const filter = process.argv[2];
const pages = execSync("git ls-files '*.html'", { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  // partials/ are chrome fragments, not pages — measuring one outside
  // the page it gets rendered into says nothing about what a reader sees.
  .filter((p) => !p.startsWith('partials/'))
  .filter((p) => !filter || p.includes(filter));

const twCss = buildTailwind();
const { server, port } = await serve();
const browser = await chromium.launch({ executablePath: findChromium() });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });

const stub = {
  contentType: 'application/javascript',
  body:
    `(function(){var s=document.createElement('style');s.textContent=${JSON.stringify(twCss)};` +
    `var c=document.currentScript;c.parentNode.insertBefore(s,c.nextSibling);})();`,
};
await ctx.route('https://cdn.tailwindcss.com', (r) => r.fulfill(stub));
await ctx.route('https://cdn.tailwindcss.com/**', (r) => r.fulfill(stub));

const page = await ctx.newPage();
page.on('pageerror', () => {});

let total = 0;
let checked = 0;

for (const p of pages) {
  try {
    await page.goto(`http://127.0.0.1:${port}/${p}`, { waitUntil: 'load', timeout: 30000 });
  } catch {
    console.error(`  ! ${p} failed to load`);
    continue;
  }
  await page.waitForTimeout(700);

  // The age gate covers the page on four pages; accept it so the
  // content underneath is measurable.
  await page
    .evaluate(() => {
      for (const b of document.querySelectorAll('button, a')) {
        const t = (b.textContent || '').toLowerCase();
        if (t.includes('21') && (t.includes('yes') || t.includes('am') || t.includes('over'))) b.click();
      }
    })
    .catch(() => {});

  // Settle scroll-reveals and fade-ups. Measuring mid-animation reads
  // the transient opacity and reports failures that don't exist.
  await page
    .evaluate(async () => {
      const h = document.body.scrollHeight;
      for (let y = 0; y < h; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 30));
      }
      window.scrollTo(0, 0);
      for (const el of document.querySelectorAll('.reveal, .lg-reveal')) {
        el.classList.add('visible', 'is-visible');
      }
      document.getAnimations().forEach((a) => {
        try { a.finish(); } catch {}
      });
    })
    .catch(() => {});
  await page.waitForTimeout(400);

  const found = await page.evaluate(walk).catch(() => []);
  checked++;
  total += found.length;
  if (!found.length) continue;

  // Collapse identical (color, background, size, class) tuples — one
  // bad rule usually shows up on dozens of nodes.
  const uniq = new Map();
  for (const r of found) {
    const k = `${r.color}|${r.bg}|${r.size}|${r.cls}`;
    if (!uniq.has(k)) uniq.set(k, { ...r, n: 1 });
    else uniq.get(k).n++;
  }
  console.error(`\n✖ ${p} — ${found.length} failing text node(s)`);
  for (const r of [...uniq.values()].sort((a, b) => a.ratio - b.ratio).slice(0, 12)) {
    console.error(
      `    ${r.ratio}:1 (need ${r.need})  ×${r.n}  ${r.size}px/${r.weight}  ${r.tag}.${r.cls}`
    );
    console.error(`      ${r.color} on ${r.bg} :: "${r.text}"`);
  }
}

await browser.close();
server.close();

if (total) {
  console.error(
    `\n✖ ${total} text node(s) below WCAG AA across ${checked} page(s).\n` +
      '  Darken the ink, or darken/lighten the surface it sits on.\n' +
      '  Tokens live in css/brand.css.\n'
  );
  process.exit(1);
}

console.log(`✔ every text node clears WCAG AA across ${checked} pages`);
