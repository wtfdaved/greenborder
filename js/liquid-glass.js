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

  /* ── Boot ──────────────────────────────────────────────────────── */
  function boot() {
    initReveals();
    initSpecular();
    initHeaderState();

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
