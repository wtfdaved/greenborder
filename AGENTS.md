# Working in this repo

This is a static site served by GitHub Pages: 28 hand-authored HTML
pages, plus 41 generated from `data/dispensaries.js`. No framework, no bundler, no build step. Tailwind arrives via the
Play CDN and is configured at runtime by `js/tailwind-brand.js`.

Read `CLAUDE.md` first — it documents the palette, the shared files, and
the guards. The short version:

- **Don't edit a header or footer inside a page.** They are generated
  from `partials/`. Edit the partial, then
  `npm run sync:chrome -- --fix`.
- **Don't edit a page under `dispensaries/`.** They are generated. Edit
  `data/dispensaries.js` or `tools/build-dispensary-pages.mjs`, then
  `npm run build:pages`.
- **Don't add a raw hex to a page.** Use a `--gb-*` token from
  `css/brand.css`, or the `emerald-*` / `gold-*` Tailwind names.
- **Run `npm test` before committing**, and
  `npm run check:assets -- --fix` after touching any shared asset.
- **Run `npm run check:contrast` after any color or theme change.** It
  renders every page in Chromium and fails on text below WCAG AA.
