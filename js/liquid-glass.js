/* ═══════════════════════════════════════════════════════════════════
   The Green Border — Liquid Glass shared behaviors
   Scroll reveals, count-up stats, pointer specular, header state.
   Safe to include on every page; no dependencies.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Scroll reveal ─────────────────────────────────────────────── */
  // Auto-tag top-level content blocks so individual pages need no markup edits.
  const REVEAL_SELECTORS = [
    'main > section',
    'main > div',
    '.city-section',
    '.kpi-card',
    '.chart-container',
    '.tgb-footer-card'
  ].join(', ');

  function initReveals() {
    if (reducedMotion || !('IntersectionObserver' in window)) return;

    const candidates = Array.from(document.querySelectorAll(REVEAL_SELECTORS))
      // Skip overlays/modals, hidden elements, and already-tagged blocks.
      .filter((el) => !el.classList.contains('lg-reveal') &&
        !el.closest('[id*="modal"], [id*="overlay"], .hidden'));

    if (!candidates.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      // threshold 0: tall sections (one-column mobile grids) may never have
      // 6% of their height inside a small viewport, which left them stuck at
      // opacity 0 — any visible pixel should reveal the block.
      { rootMargin: '0px 0px -8% 0px', threshold: 0 }
    );

    candidates.forEach((el, i) => {
      el.classList.add('lg-reveal');
      // Small stagger between siblings revealed in the same scroll burst.
      el.style.setProperty('--lg-delay', `${Math.min(i % 4, 3) * 0.07}s`);
      observer.observe(el);
    });

    // Anything already above the fold reveals immediately.
    requestAnimationFrame(() => {
      candidates.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.9) el.classList.add('is-visible');
      });
    });

    // Fail-safe: never leave content invisible if the observer misfires.
    setTimeout(() => {
      candidates.forEach((el) => el.classList.add('is-visible'));
    }, 1500);
  }

  /* ── Count-up numbers ──────────────────────────────────────────── */
  // Animates an element's numeric text from 0 to its value when it
  // scrolls into view. Preserves prefixes/suffixes like $, %, +, ★
  // and thousands separators. Usage: lgCountUp(el) after setting text.
  function animateValue(el) {
    const text = el.textContent.trim();
    const match = text.match(/^([^0-9]*)([\d,]+(?:\.\d+)?)(.*)$/);
    if (!match) return;

    const prefix = match[1];
    const suffix = match[3];
    const target = parseFloat(match[2].replace(/,/g, ''));
    if (!isFinite(target)) return;

    const decimals = (match[2].split('.')[1] || '').length;
    const useCommas = match[2].includes(',');
    const duration = 1100;
    const start = performance.now();

    function frame(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      let value = (target * eased).toFixed(decimals);
      if (useCommas) value = Number(value).toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
      el.textContent = prefix + value + suffix;
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  const countQueue = new Set();
  let countObserver = null;

  function lgCountUp(el) {
    if (!el) return;
    if (reducedMotion || !('IntersectionObserver' in window)) return;
    if (countQueue.has(el)) return;
    countQueue.add(el);

    if (!countObserver) {
      countObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              animateValue(entry.target);
              countObserver.unobserve(entry.target);
              countQueue.delete(entry.target);
            }
          });
        },
        { threshold: 0.4 }
      );
    }
    countObserver.observe(el);
  }
  window.lgCountUp = lgCountUp;

  /* ── Pointer specular hotspot on glass cards ───────────────────── */
  function initSpecular() {
    if (reducedMotion || !window.matchMedia('(pointer: fine)').matches) return;

    document.addEventListener(
      'pointermove',
      (e) => {
        const card = e.target.closest && e.target.closest('.lg-sheen');
        if (!card) return;
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${((e.clientX - rect.left) / rect.width) * 100}%`);
        card.style.setProperty('--my', `${((e.clientY - rect.top) / rect.height) * 100}%`);
      },
      { passive: true }
    );
  }

  /* ── Header scroll state (rAF-throttled) ───────────────────────── */
  function initHeaderState() {
    let ticking = false;
    function update() {
      document.body.classList.toggle('scrolled', window.scrollY > 100);
      ticking = false;
    }
    window.addEventListener(
      'scroll',
      () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(update);
        }
      },
      { passive: true }
    );
    update();
  }

  /* ── Mobile chrome: bottom nav + back-to-top ───────────────────── */
  // One standardized thumb-reach bottom nav for every page. Replaces the
  // per-page hardcoded variants (which were missing on the directory and
  // dispensary detail pages entirely). Hides on scroll-down, returns on
  // scroll-up, and is safe-area aware for notched phones.
  const NAV_ITEMS = [
    {
      href: '/', label: 'Home', match: ['/', '/index.html'],
      icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10"/>'
    },
    {
      href: '/directory.html', label: 'Shops',
      match: ['/directory.html', '/astro-buds.html', '/old-gods.html', '/mango-cannabis.html'],
      icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>'
    },
    {
      href: '/data.html', label: 'Data', match: ['/data.html'],
      icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M3 3v16a2 2 0 002 2h16"/><path stroke-linecap="round" stroke-linejoin="round" d="M7 14l4-4 3 3 5-6"/>'
    },
    {
      href: '/news.html', label: 'News', match: ['/news.html'],
      icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"/>'
    },
    {
      href: '/#education', label: 'Learn', match: [],
      icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>'
    }
  ];

  function initMobileChrome() {
    // Retire any legacy per-page nav markup so there is exactly one nav.
    document.querySelectorAll('.tgb-mobile-nav').forEach((el) => el.remove());

    const path = (location.pathname.replace(/\/+$/, '') || '/').toLowerCase();

    const nav = document.createElement('nav');
    nav.className = 'tgb-mobile-nav';
    nav.id = 'tgb-mobile-menu';
    nav.setAttribute('aria-label', 'Site navigation');
    nav.innerHTML = NAV_ITEMS.map((item) => {
      const active = item.match.includes(path);
      return (
        '<a href="' + item.href + '" class="tgb-nav-item' + (active ? ' active' : '') + '"' +
        (active ? ' aria-current="page"' : '') + '>' +
        '<span class="tgb-nav-icon"><svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">' +
        item.icon + '</svg></span><span>' + item.label + '</span></a>'
      );
    }).join('');
    document.body.appendChild(nav);

    // Back-to-top button on every page (long directory/data pages need it).
    let scrollBtn = document.getElementById('tgb-scroll-btn');
    if (!scrollBtn) {
      scrollBtn = document.createElement('button');
      scrollBtn.id = 'tgb-scroll-btn';
      scrollBtn.type = 'button';
      scrollBtn.setAttribute('aria-label', 'Back to top');
      scrollBtn.innerHTML = '<div id="tgb-scroll-arrow" aria-hidden="true"></div>';
      document.body.appendChild(scrollBtn);
    }
    scrollBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
    });

    // Hide nav on scroll-down, reveal on scroll-up / near page edges.
    let lastY = window.scrollY;
    let ticking = false;
    function update() {
      const y = window.scrollY;
      const delta = y - lastY;
      const nearBottom = window.innerHeight + y >= document.documentElement.scrollHeight - 120;
      if (y < 80 || nearBottom || delta < -6) {
        nav.classList.remove('nav-hidden');
      } else if (delta > 6) {
        nav.classList.add('nav-hidden');
      }
      scrollBtn.classList.toggle('show', y > 500);
      lastY = y;
      ticking = false;
    }
    window.addEventListener(
      'scroll',
      () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(update);
        }
      },
      { passive: true }
    );
    update();
  }

  /* ── Boot ──────────────────────────────────────────────────────── */
  function boot() {
    initReveals();
    initSpecular();
    initHeaderState();
    initMobileChrome();

    // Static stat values opt in to count-up with a data attribute.
    document.querySelectorAll('[data-lg-count]').forEach(lgCountUp);

    // Dynamic content (directory cards render after data load): re-scan once.
    let rescans = 0;
    const rescan = new MutationObserver(() => {
      if (rescans++ > 4) { rescan.disconnect(); return; }
      clearTimeout(rescan._t);
      rescan._t = setTimeout(initReveals, 250);
    });
    const grid = document.getElementById('dispensary-grid-by-city');
    if (grid) rescan.observe(grid, { childList: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
