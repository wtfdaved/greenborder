/* ═══════════════════════════════════════════════════════════════════
   The Green Border — shared Tailwind (Play CDN) theme
   One config for every page. Load it immediately AFTER the CDN script:

     <script src="https://cdn.tailwindcss.com"></script>
     <script src="/js/tailwind-brand.js"></script>

   The palette mirrors /css/brand.css. Tailwind's stock warm/green
   families (green, teal, lime, amber, yellow) are remapped onto the two
   brand scales as well, so a stray `text-amber-400` in some page can't
   drift off-palette.

   Historic `emerald-*` / `gold-*` class names are kept — ~30 files use
   them — they now resolve to olive green and desert cream.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  var green = {
    50: '#f5fae6',
    100: '#e7f3c4',
    200: '#d0e693',
    300: '#afd456',
    400: '#7fab16',
    500: '#558203', // BRAND
    600: '#476d03',
    700: '#375302',
    800: '#2a3f02',
    900: '#1c2a01',
  };

  var cream = {
    50: '#fffdf0',
    100: '#fffbdc',
    200: '#fff8b9', // BRAND
    300: '#f2e895',
    400: '#dccf6e',
    500: '#b9ab47',
    600: '#8a7c2e',
    700: '#6b6224',
    800: '#4a431a',
    900: '#34300f',
  };

  // The pages were authored against `gold-400` / `amber-400` as the
  // bright accent, so this variant shifts the scale to put BRAND cream
  // in the 400 slot. Keeps every existing class visually correct.
  var warm = {
    50: '#fffdf0',
    100: '#fffdf0',
    200: '#fffbdc',
    300: '#fffbdc',
    400: '#fff8b9', // BRAND
    500: '#f2e895',
    600: '#dccf6e',
    700: '#8a7c2e',
    800: '#6b6224',
    900: '#4a431a',
  };

  var config = {
    theme: {
      extend: {
        colors: {
          brand: green,
          sand: cream,
          emerald: green,
          green: green,
          teal: green,
          lime: green,
          gold: warm,
          amber: warm,
          yellow: warm,
          // Decorative families the pages picked up along the way. They
          // carry no meaning, so they fold into the two brand hues.
          // (rose/red stay stock — they encode decline and destructive
          // actions, which must not read as brand decoration.)
          blue: green,
          sky: green,
          cyan: green,
          indigo: cream,
          violet: cream,
          purple: cream,
          charcoal: {
            900: '#0a0a0a',
            800: '#111111',
            700: '#1a1a1a',
            600: '#242424',
            500: '#2e2e2e',
          },
        },
        fontFamily: {
          sans: ['Inter', 'system-ui', 'sans-serif'],
          display: ['Fraunces', 'Georgia', 'serif'],
        },
        backgroundImage: {
          'hero-grid':
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23558203' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        },
        animation: {
          'fade-up': 'fadeUp 0.6s ease-out forwards',
          'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        },
        keyframes: {
          fadeUp: {
            '0%': { opacity: '0', transform: 'translateY(24px)' },
            '100%': { opacity: '1', transform: 'translateY(0)' },
          },
        },
      },
    },
  };

  // Browser first: a page that happens to define a global `module`
  // (some UMD bundles do) must still get its Tailwind theme.
  // Tolerate the CDN failing to load too — the page then renders with
  // its own stylesheet instead of throwing on an undefined global.
  if (typeof window !== 'undefined' && window.document) {
    window.tailwind = window.tailwind || {};
    window.tailwind.config = config;
    return;
  }

  // Node (tailwind.config.js / build:css) reads the same object, so the
  // CDN theme and the built stylesheet can never drift apart.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = config;
  }
})();
