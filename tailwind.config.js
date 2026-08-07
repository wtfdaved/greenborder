/** @type {import('tailwindcss').Config} */
// The theme lives in ./js/tailwind-brand.js — the same file the pages
// load after the Tailwind Play CDN — so `npm run build:css` and the
// runtime CDN can never drift apart. Change colors in one place:
// ./css/brand.css for CSS, ./js/tailwind-brand.js for utilities.
const brand = require('./js/tailwind-brand.js');

module.exports = {
  content: ['./**/*.html', './js/**/*.js'],
  ...brand,
  plugins: [],
};
