// ============================================
// DIRECTORY UI RENDERING & INTERACTIONS
// ============================================

// Preferred display order for known cities; any other city from Airtable is
// appended alphabetically so new cities never disappear from the page.
const PREFERRED_CITY_ORDER = ['Sunland Park', 'Chaparral', 'Santa Teresa', 'Anthony'];

const DAY_LABELS = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun'
};
const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

// ----------------------------------------------------------------------------
// Small data helpers
// ----------------------------------------------------------------------------

/**
 * A rating/review is "real" only when it comes from genuine Airtable data
 * (not the seeded fallback) and has a positive review count. Seed records use
 * uniform placeholder values, so we hide stars/reviews for them to keep the
 * directory credible. They appear automatically once real numbers exist.
 */
function hasRealRating(dsp) {
  return !!dsp && dsp.dataSource !== 'seed' && dsp.rating > 0 && dsp.reviewCount > 0;
}

/**
 * Build a directions URL: prefer an explicit map link, otherwise construct a
 * Google Maps search from the dispensary name + address + city.
 */
function getDirectionsUrl(dsp) {
  if (dsp.mapLink) return dsp.mapLink;
  const query = [dsp.name, dsp.address, dsp.city, 'NM'].filter(Boolean).join(' ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Number of offerings/highlights, used for hero stats. */
function countWith(dispensaries, predicate) {
  return (dispensaries || []).filter(predicate).length;
}

/**
 * True only when we can positively determine the dispensary is open right
 * now from structured hours. Records without parseable hours return false,
 * so the "Open Now" filter never shows stores we can't verify.
 */
function isOpenNow(dsp) {
  if (!dsp || !dsp.hours) return false;
  const status = window.dispensaryService?.getOpenStatus?.(dsp.hours);
  return !!(status && status.isOpen);
}

/** Average of genuine ratings only; null when no real ratings exist. */
function averageRating(dispensaries) {
  const rated = (dispensaries || []).filter(hasRealRating);
  if (!rated.length) return null;
  return rated.reduce((sum, d) => sum + d.rating, 0) / rated.length;
}

// Short, indexable context for each city section — distance/route notes
// help visitors from El Paso plan the trip.
const CITY_BLURBS = {
  'Sunland Park': 'The closest legal cannabis to downtown El Paso — most shops sit just over the state line, about 10–15 minutes from the west side via McNutt Rd / NM-273.',
  'Chaparral': 'A quick drive up War Road from Northeast El Paso, Chaparral serves the 79934/79938 corridor with late-night and 24-hour options.',
  'Santa Teresa': 'Minutes from the Upper Valley and Artcraft Rd, Santa Teresa pairs dispensaries with an easy I-10 detour for west-side shoppers.',
  'Anthony': 'Right off I-10 at the Texas/New Mexico line, Anthony is the natural stop for travelers heading toward Las Cruces.'
};

/**
 * Generate SVG star rating display with configurable styling
 * @param {number} rating - Rating value (0-5)
 * @param {boolean} isPremium - Whether to use gold styling for premium dispensaries
 * @returns {string} HTML string with SVG stars
 */
function generateStarRating(rating, isPremium = false) {
  const stars = [];
  if (!rating) rating = 4.0;
  const ratingNum = parseFloat(rating) || 4.0;

  // Determine color: gold for premium, emerald for standard (light theme)
  const fillColor = isPremium ? '#f59e0b' : '#10b981';
  const emptyColor = '#c7d2cc';

  // Generate 5 star elements
  for (let i = 1; i <= 5; i++) {
    let fillPercent = 100;

    if (i > ratingNum) {
      if (i - 1 < ratingNum) {
        fillPercent = Math.round((ratingNum - (i - 1)) * 100);
      } else {
        fillPercent = 0;
      }
    }

    // Create SVG star with gradient fill
    const starId = `star-${Math.random().toString(36).substr(2, 9)}`;
    const svg = `
      <svg class="inline-block w-5 h-5 mr-0.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="${starId}" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="${fillPercent}%" stop-color="${fillColor}" />
            <stop offset="${fillPercent}%" stop-color="${emptyColor}" />
          </linearGradient>
        </defs>
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
              fill="url(#${starId})" stroke="${isPremium ? '#d97706' : '#047857'}" stroke-width="0.5"/>
      </svg>
    `;
    stars.push(svg);
  }

  return `<div class="flex items-center">${stars.join('')}</div>`;
}

/**
 * Format review count display
 * @param {number} count - Number of reviews
 * @returns {string} Formatted review text
 */
function formatReviewCount(count) {
  if (!count) count = 0;
  const reviewCount = parseInt(count) || 0;
  return `(${reviewCount} Google Review${reviewCount !== 1 ? 's' : ''})`;
}

// ----------------------------------------------------------------------------
// City grouping
// ----------------------------------------------------------------------------

/**
 * Group dispensaries by city, preferred cities first then any others
 * alphabetically. Returns an ordered array of { city, items }.
 */
function groupByCity(dispensaries) {
  const groups = {};
  (dispensaries || []).forEach(d => {
    if (!d || !d.city) return;
    (groups[d.city] = groups[d.city] || []).push(d);
  });

  const allCities = Object.keys(groups);
  const ordered = [
    ...PREFERRED_CITY_ORDER.filter(c => groups[c]),
    ...allCities.filter(c => !PREFERRED_CITY_ORDER.includes(c)).sort()
  ];

  return ordered.map(city => ({ city, items: groups[city] }));
}

/** Stable sort within a city: premium first, then the active sort key. */
function sortDispensaries(items, sortKey) {
  const arr = [...items];
  const byName = (a, b) => a.name.localeCompare(b.name);

  arr.sort((a, b) => {
    // Featured always rises to the top of its city section.
    if (!!a.isPremium !== !!b.isPremium) return a.isPremium ? -1 : 1;

    switch (sortKey) {
      case 'name':
        return byName(a, b);
      case 'rating':
        return (b.rating || 0) - (a.rating || 0) || byName(a, b);
      case 'recent':
        return new Date(b.lastUpdated || 0) - new Date(a.lastUpdated || 0) || byName(a, b);
      default:
        return byName(a, b);
    }
  });
  return arr;
}

// ----------------------------------------------------------------------------
// Rendering
// ----------------------------------------------------------------------------

/**
 * Render dispensaries grouped by city with section headers, premium first.
 * Renders every city present in the data (not just a hardcoded list).
 */
function renderDispensariesByCity(dispensaries, sortKey) {
  try {
    const container = document.getElementById('dispensary-grid-by-city');
    if (!container) {
      console.warn('Container dispensary-grid-by-city not found');
      return;
    }

    if (!dispensaries || dispensaries.length === 0) {
      container.innerHTML = `
        <div class="text-center py-16 text-gray-400">
          <p class="text-lg mb-2">No dispensaries match your filters.</p>
          <button onclick="clearFilters()" class="text-emerald-400 hover:text-emerald-300 underline">Clear all filters</button>
        </div>
      `;
      renderCityNav([]);
      return;
    }

    const grouped = groupByCity(dispensaries);

    let html = '';
    grouped.forEach(({ city, items }) => {
      const sorted = sortDispensaries(items, sortKey);
      const cityId = `city-${(city || '').toLowerCase().replace(/[^\w]+/g, '-')}`;

      // City-level insights: avg rating, open-now count, top-rated pick.
      const avg = averageRating(items);
      const openCount = countWith(items, isOpenNow);
      const rated = items.filter(hasRealRating);
      const topRated = rated.length >= 2
        ? rated.reduce((best, d) => (d.rating > best.rating ? d : best))
        : null;

      const metaPills = [
        avg !== null ? `<span class="meta-pill gold">★ ${avg.toFixed(1)} avg rating</span>` : '',
        openCount > 0 ? `<span class="meta-pill emerald">● ${openCount} open now</span>` : '',
        countWith(items, d => d.hasConsumption) > 0 ? `<span class="meta-pill">🛋️ ${countWith(items, d => d.hasConsumption)} lounge${countWith(items, d => d.hasConsumption) === 1 ? '' : 's'}</span>` : '',
        countWith(items, d => d.deals) > 0 ? `<span class="meta-pill">🔥 ${countWith(items, d => d.deals)} deal${countWith(items, d => d.deals) === 1 ? '' : 's'}</span>` : ''
      ].filter(Boolean).join('');

      const blurb = CITY_BLURBS[city]
        ? `<p class="city-blurb">${escapeHtml(CITY_BLURBS[city])}</p>`
        : '';

      html += `<section class="city-section" id="${cityId}">
        <div class="city-header">
          <h2 class="city-title">${escapeHtml(city)}</h2>
          <span class="city-count">${items.length} dispensar${items.length === 1 ? 'y' : 'ies'}</span>
          ${metaPills ? `<div class="city-meta">${metaPills}</div>` : ''}
        </div>
        ${blurb}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-5">
          ${sorted.map(dsp => {
            try {
              return createDispensaryCard(dsp, { isTopRated: !!topRated && dsp.id === topRated.id });
            } catch (e) {
              console.error('Card render error:', e);
              return '';
            }
          }).join('')}
        </div>
      </section>`;
    });

    container.innerHTML = html || '<div class="text-center py-12 text-gray-400">No dispensaries to display</div>';
    renderCityNav(grouped.map(g => ({ city: g.city, count: g.items.length })));
    console.log(`✅ Rendered ${dispensaries.length} dispensaries across ${grouped.length} cities`);
  } catch (error) {
    console.error('renderDispensariesByCity error:', error);
    const container = document.getElementById('dispensary-grid-by-city');
    if (container) {
      container.innerHTML = '<div class="text-center py-12 text-red-400">Error rendering dispensaries</div>';
    }
  }
}

/**
 * Unified card builder. Every block is field-driven: it only renders when the
 * underlying data exists, so the same card works for a bare record or a fully
 * populated Airtable row.
 */
function createDispensaryCard(dsp, opts = {}) {
  try {
    if (!dsp) return '';

    const premium = !!dsp.isPremium;
    const cardClass = premium ? 'premium-card' : 'dispensary-card';
    const id = escapeHtml(dsp.id);

    // --- Header (logo + name + city) ---
    const logo = dsp.logoUrl
      ? `<img src="${escapeHtml(dsp.logoUrl)}" alt="${escapeHtml(dsp.name)} logo" class="card-logo" loading="lazy" onerror="this.style.display='none'" />`
      : '';

    // --- Rating (only when genuine) ---
    let ratingBlock = '';
    if (hasRealRating(dsp)) {
      ratingBlock = `
        <div class="space-y-1.5">
          <div class="flex items-center gap-2 flex-wrap">
            ${generateStarRating(dsp.rating, premium)}
            ${opts.isTopRated ? '<span class="top-rated-badge">🏆 Top Rated</span>' : ''}
          </div>
          <p class="text-gray-400 text-xs font-medium">${dsp.rating.toFixed(1)} • ${formatReviewCount(dsp.reviewCount)}</p>
        </div>`;
    }

    // --- Open-now / hours pill ---
    let hoursBlock = '';
    const status = window.dispensaryService?.getOpenStatus?.(dsp.hours);
    if (status) {
      hoursBlock = `<span class="open-pill ${status.isOpen ? 'open' : 'closed'}">${status.isOpen ? '● Open now' : '● Closed'} · ${escapeHtml(status.todayLabel)}</span>`;
    } else if (typeof dsp.hours === 'string' && dsp.hours) {
      hoursBlock = `<span class="open-pill neutral">🕑 ${escapeHtml(dsp.hours)}</span>`;
    }

    // --- Deals ---
    const dealsBlock = dsp.deals
      ? `<div class="deal-banner"><span class="deal-tag">🔥 Deal</span><span>${escapeHtml(dsp.deals)}</span></div>`
      : '';

    // --- Offerings badges ---
    const badges = `
      <div class="flex flex-wrap gap-2 pt-1">
        ${dsp.hasAdultUse ? '<span class="badge-rec-emoji px-3 py-1.5 rounded-full text-xs font-bold">🌿 Recreational</span>' : ''}
        ${dsp.hasMedical ? '<span class="badge-med-emoji px-3 py-1.5 rounded-full text-xs font-bold">🏥 Medical</span>' : ''}
        ${dsp.hasConsumption ? '<span class="badge-lounge-emoji px-3 py-1.5 rounded-full text-xs font-bold">🛋️ Lounge</span>' : ''}
      </div>`;

    // --- Action row ---
    const actions = `
      <div class="flex flex-wrap gap-2 pt-1">
        <a href="${escapeHtml(getDirectionsUrl(dsp))}" target="_blank" rel="noopener" class="card-action" onclick="event.stopPropagation()">📍 Directions</a>
        ${dsp.menuUrl ? `<a href="${escapeHtml(dsp.menuUrl)}" target="_blank" rel="noopener" class="card-action accent" onclick="event.stopPropagation()">🛒 Order / Menu</a>` : ''}
        ${dsp.website ? `<a href="${escapeHtml(dsp.website)}" target="_blank" rel="noopener" class="card-action" onclick="event.stopPropagation()">🌐 Website</a>` : ''}
        ${dsp.phone ? `<a href="tel:${escapeHtml(dsp.phone)}" class="card-action" onclick="event.stopPropagation()">📞 Call</a>` : ''}
        ${dsp.instagram ? `<a href="${escapeHtml(dsp.instagram)}" target="_blank" rel="noopener" class="card-action" onclick="event.stopPropagation()" aria-label="Instagram">📸</a>` : ''}
        ${dsp.facebook ? `<a href="${escapeHtml(dsp.facebook)}" target="_blank" rel="noopener" class="card-action" onclick="event.stopPropagation()" aria-label="Facebook">📘</a>` : ''}
      </div>`;

    return `
      <div class="${cardClass} lg-sheen rounded-2xl overflow-hidden transition-all cursor-pointer group relative animate-fade-up"
           onclick="try { openDispensaryDetail('${id}'); } catch(e) { console.error(e); }">
        ${premium ? '<div class="premium-badge">FEATURED ✨</div>' : ''}

        <div class="card-header-glass p-5 border-b border-emerald-500/20 flex items-center gap-3">
          ${logo}
          <div class="min-w-0">
            <h3 class="text-xl font-bold text-white mb-0.5 truncate">${escapeHtml(dsp.name)}</h3>
            <p class="text-emerald-100 text-sm flex items-center gap-1">
              <span>📍</span><span>${escapeHtml(dsp.city)}</span>
            </p>
          </div>
        </div>

        <div class="p-5 space-y-4">
          ${ratingBlock}
          ${hoursBlock ? `<div>${hoursBlock}</div>` : ''}
          <p class="text-sm text-gray-300">${escapeHtml(dsp.address)}</p>
          ${dealsBlock}
          ${badges}
          ${actions}
          <a href="/partner.html?claim=${encodeURIComponent(dsp.id)}" onclick="event.stopPropagation()"
             class="mt-2 block w-full text-center px-3 py-2.5 bg-gradient-to-r from-gold-600 to-gold-500 hover:from-gold-500 hover:to-gold-400 text-white text-sm font-bold rounded-lg transition transform hover:scale-105">
            ✓ Claim Listing
          </a>
        </div>
      </div>
    `;
  } catch (error) {
    console.error('createDispensaryCard error:', error);
    return '';
  }
}

// Backward-compatible aliases
function createPremiumCard(dsp) { return createDispensaryCard(dsp); }
function createStandardCard(dsp) { return createDispensaryCard(dsp); }
function renderDispensaryGrid(dispensaries) { renderDispensariesByCity(dispensaries); }

/**
 * Render city quick-nav jump chips above the grid.
 */
function renderCityNav(cities) {
  const nav = document.getElementById('city-nav');
  if (!nav) return;
  if (!cities || cities.length === 0) {
    nav.innerHTML = '';
    return;
  }
  nav.innerHTML = cities.map(({ city, count }) => {
    const cityId = `city-${(city || '').toLowerCase().replace(/[^\w]+/g, '-')}`;
    return `<a href="#${cityId}" class="city-chip">${escapeHtml(city)} <span class="city-chip-count">${count}</span></a>`;
  }).join('');
}

/**
 * Render hero stat counters from the full dataset.
 */
function renderHeroStats(dispensaries) {
  const el = document.getElementById('hero-stats');
  if (!el) return;
  const data = dispensaries || window.dispensaryService?.data || [];
  const cities = new Set(data.map(d => d.city).filter(Boolean));
  const avg = averageRating(data);
  const openCount = countWith(data, isOpenNow);

  const stats = [
    { value: String(data.length), label: 'Dispensaries' },
    { value: String(cities.size), label: 'Cities' },
    ...(avg !== null ? [{ value: `${avg.toFixed(1)}★`, label: 'Avg Rating' }] : []),
    ...(openCount > 0 ? [{ value: String(openCount), label: 'Open Now' }] : []),
    { value: String(countWith(data, d => d.hasConsumption)), label: 'Lounges' },
    { value: String(countWith(data, d => d.deals)), label: 'Active Deals' }
  ];

  el.innerHTML = stats.map(s => `
    <div class="hero-stat">
      <div class="hero-stat-value">${s.value}</div>
      <div class="hero-stat-label">${s.label}</div>
    </div>`).join('');

  // Animate counts when the band scrolls into view (no-op without lg JS).
  if (typeof window.lgCountUp === 'function') {
    el.querySelectorAll('.hero-stat-value').forEach(v => window.lgCountUp(v));
  }
}

// ----------------------------------------------------------------------------
// Detail modal
// ----------------------------------------------------------------------------

function openDispensaryDetail(dispensaryId) {
  const dispensary = window.dispensaryService.getById(dispensaryId);
  if (!dispensary) {
    console.error('Dispensary not found:', dispensaryId);
    return;
  }

  const modal = document.getElementById('dispensary-modal');
  const content = document.getElementById('modal-content');

  const status = window.dispensaryService?.getOpenStatus?.(dispensary.hours);

  // Full weekly hours table when structured
  let hoursTable = '';
  if (dispensary.hours && typeof dispensary.hours === 'object') {
    const rows = DAY_ORDER
      .filter(day => dispensary.hours[day] || dispensary.hours[day.toUpperCase()])
      .map(day => `<div class="flex justify-between"><span class="text-gray-400">${DAY_LABELS[day]}</span><span>${escapeHtml(String(dispensary.hours[day] || dispensary.hours[day.toUpperCase()]))}</span></div>`)
      .join('');
    if (rows) hoursTable = `<div class="space-y-1 text-sm">${rows}</div>`;
  } else if (typeof dispensary.hours === 'string' && dispensary.hours) {
    hoursTable = `<p class="text-sm text-gray-300">${escapeHtml(dispensary.hours)}</p>`;
  }

  content.innerHTML = `
    <div class="space-y-6">
      <div class="border-b border-gray-700 pb-4 flex items-start gap-4">
        ${dispensary.logoUrl ? `<img src="${escapeHtml(dispensary.logoUrl)}" alt="" class="w-16 h-16 rounded-lg object-cover" onerror="this.style.display='none'" />` : ''}
        <div class="min-w-0">
          <h2 class="text-3xl font-bold text-white">${escapeHtml(dispensary.name)}</h2>
          <p class="text-gray-400 mt-1">📍 ${escapeHtml(dispensary.address || dispensary.city)}</p>
          ${status ? `<span class="open-pill ${status.isOpen ? 'open' : 'closed'} mt-2 inline-block">${status.isOpen ? '● Open now' : '● Closed'} · ${escapeHtml(status.todayLabel)}</span>` : ''}
          ${hasRealRating(dispensary) ? `
            <div class="mt-3 space-y-2">
              ${generateStarRating(dispensary.rating, dispensary.isPremium)}
              <p class="text-gray-400 text-sm">${dispensary.rating.toFixed(1)} • ${formatReviewCount(dispensary.reviewCount)}</p>
            </div>` : ''}
        </div>
      </div>

      ${dispensary.description ? `<p class="text-gray-300">${escapeHtml(dispensary.description)}</p>` : ''}

      ${dispensary.deals ? `<div class="deal-banner"><span class="deal-tag">🔥 Deal</span><span>${escapeHtml(dispensary.deals)}</span></div>` : ''}

      <div class="space-y-2">
        <h3 class="text-lg font-semibold text-emerald-400">Products & Services</h3>
        <div class="flex flex-wrap gap-3">
          ${dispensary.hasAdultUse ? '<span class="bg-emerald-900/50 text-emerald-200 px-3 py-1 rounded">✓ Recreational</span>' : ''}
          ${dispensary.hasMedical ? '<span class="bg-blue-900/50 text-blue-200 px-3 py-1 rounded">✓ Medical</span>' : ''}
          ${dispensary.hasConsumption ? '<span class="bg-gold-900/50 text-gold-200 px-3 py-1 rounded">✓ Consumption Lounge</span>' : ''}
        </div>
      </div>

      ${hoursTable ? `<div class="space-y-2"><h3 class="text-lg font-semibold text-emerald-400">Hours</h3>${hoursTable}</div>` : ''}

      <div class="space-y-2">
        <h3 class="text-lg font-semibold text-emerald-400">Contact & Links</h3>
        <div class="flex flex-wrap gap-2">
          <a href="${escapeHtml(getDirectionsUrl(dispensary))}" target="_blank" rel="noopener" class="card-action">📍 Directions</a>
          ${dispensary.menuUrl ? `<a href="${escapeHtml(dispensary.menuUrl)}" target="_blank" rel="noopener" class="card-action accent">🛒 Order / Menu</a>` : ''}
          ${dispensary.website ? `<a href="${escapeHtml(dispensary.website)}" target="_blank" rel="noopener" class="card-action">🌐 Website</a>` : ''}
          ${dispensary.phone ? `<a href="tel:${escapeHtml(dispensary.phone)}" class="card-action">📞 ${escapeHtml(dispensary.phone)}</a>` : ''}
          ${dispensary.email ? `<a href="mailto:${escapeHtml(dispensary.email)}" class="card-action">✉️ Email</a>` : ''}
          ${dispensary.instagram ? `<a href="${escapeHtml(dispensary.instagram)}" target="_blank" rel="noopener" class="card-action">📸 Instagram</a>` : ''}
          ${dispensary.facebook ? `<a href="${escapeHtml(dispensary.facebook)}" target="_blank" rel="noopener" class="card-action">📘 Facebook</a>` : ''}
        </div>
      </div>

      ${dispensary.licenseNumber ? `
        <div class="bg-gray-900 p-3 rounded text-sm text-gray-400">
          <p>License #: ${escapeHtml(dispensary.licenseNumber)}</p>
        </div>` : ''}

      <div class="border-t border-gray-700 pt-4">
        <a href="/partner.html?claim=${encodeURIComponent(dispensary.id)}"
           class="block px-4 py-2 bg-gold-600 hover:bg-gold-500 text-white font-semibold rounded transition text-center">
          ✓ Is This Your Dispensary? Claim Listing
        </a>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
}

function closeDispensaryModal() {
  const modal = document.getElementById('dispensary-modal');
  modal.classList.add('hidden');
}

// ----------------------------------------------------------------------------
// Filtering, sorting, search
// ----------------------------------------------------------------------------

/**
 * Compute the currently filtered/sorted result set from all controls.
 * Shared by the renderer and the CSV export so they always agree.
 */
function getFilteredResults() {
  let results = window.dispensaryService?.data || [];

  // Search
  const searchInput = document.getElementById('search-input');
  if (searchInput && searchInput.value && window.dispensaryService?.search) {
    try {
      results = window.dispensaryService.search(searchInput.value);
    } catch (e) {
      console.error('Search error:', e);
    }
  }

  // City
  const cityFilter = document.getElementById('city-filter');
  if (cityFilter && cityFilter.value) {
    results = results.filter(d => d && d.city === cityFilter.value);
  }

  // Offerings toggle chips (AND logic)
  const offerings = Array.from(document.querySelectorAll('.offering-chip[data-active="true"]'))
    .map(el => el.dataset.offering);
  offerings.forEach(off => {
    if (off === 'rec') results = results.filter(d => d.hasAdultUse);
    else if (off === 'med') results = results.filter(d => d.hasMedical);
    else if (off === 'lounge') results = results.filter(d => d.hasConsumption);
    else if (off === 'deals') results = results.filter(d => d.deals);
    else if (off === 'open') results = results.filter(isOpenNow);
  });

  return results;
}

function getSortKey() {
  const sortFilter = document.getElementById('sort-filter');
  return sortFilter ? sortFilter.value : 'featured';
}

/**
 * Apply all filters and re-render.
 */
function applyFilters() {
  try {
    const results = getFilteredResults();
    renderDispensariesByCity(results, getSortKey());
    updateResultCount(results.length);
  } catch (error) {
    console.error('applyFilters error:', error);
    const el = document.getElementById('result-count');
    if (el) el.textContent = 'Error applying filters';
  }
}

/**
 * Toggle an offerings chip and re-filter.
 */
function toggleOffering(el) {
  const active = el.dataset.active === 'true';
  el.dataset.active = active ? 'false' : 'true';
  applyFilters();
}

/**
 * Reset all controls.
 */
function clearFilters() {
  const search = document.getElementById('search-input');
  if (search) search.value = '';
  const city = document.getElementById('city-filter');
  if (city) city.value = '';
  const sort = document.getElementById('sort-filter');
  if (sort) sort.value = 'featured';
  document.querySelectorAll('.offering-chip').forEach(el => { el.dataset.active = 'false'; });
  applyFilters();
}

/**
 * Force a fresh pull from Airtable (bypasses cache) and re-render.
 */
async function refreshData() {
  try {
    const el = document.getElementById('result-count');
    if (el) el.textContent = 'Refreshing…';
    await window.dispensaryService.load(true);
    populateCityFilter();
    renderHeroStats();
    applyFilters();
  } catch (e) {
    console.error('Refresh error:', e);
    applyFilters();
  }
}

/**
 * Update city dropdown from available data
 */
function populateCityFilter() {
  try {
    const cities = window.dispensaryService?.getCities?.() || [];
    const select = document.getElementById('city-filter');
    if (select) {
      const current = select.value;
      select.innerHTML = `
        <option value="">All Cities (${cities.length})</option>
        ${cities.map(city => `<option value="${escapeHtml(city)}"${city === current ? ' selected' : ''}>${escapeHtml(city)}</option>`).join('')}
      `;
    }
  } catch (error) {
    console.error('populateCityFilter error:', error);
  }
}

/**
 * Update result count display
 */
function updateResultCount(count) {
  try {
    const countElement = document.getElementById('result-count');
    if (countElement) {
      countElement.textContent = `${count || 0} dispensar${count === 1 ? 'y' : 'ies'} found`;
    }
  } catch (error) {
    console.error('updateResultCount error:', error);
  }
}

/**
 * Export the CURRENTLY FILTERED results as CSV.
 */
function exportToCSV() {
  try {
    const dispensaries = getFilteredResults();

    const headers = ['Name', 'City', 'Address', 'Phone', 'Website', 'Recreational', 'Medical', 'Lounge', 'Deals', 'Menu', 'Hours'];
    const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const hoursToText = (h) => {
      if (!h) return '';
      if (typeof h === 'string') return h;
      return DAY_ORDER.filter(d => h[d]).map(d => `${DAY_LABELS[d]} ${h[d]}`).join('; ');
    };

    const rows = dispensaries.map(d => [
      d.name, d.city, d.address, d.phone, d.website,
      d.hasAdultUse ? 'Yes' : 'No',
      d.hasMedical ? 'Yes' : 'No',
      d.hasConsumption ? 'Yes' : 'No',
      d.deals, d.menuUrl, hoursToText(d.hours)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(csvCell).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `greenborder-dispensaries-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`📥 CSV exported (${dispensaries.length} rows)`);
  } catch (e) {
    console.error('exportToCSV error:', e);
  }
}

/**
 * Inject JSON-LD ItemList of LocalBusiness for SEO / discoverability.
 */
function injectStructuredData(dispensaries) {
  try {
    const data = dispensaries || window.dispensaryService?.data || [];
    if (!data.length) return;
    const itemList = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Cannabis Dispensary Directory — Southern New Mexico',
      numberOfItems: data.length,
      itemListElement: data.map((d, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Store',
          name: d.name,
          address: { '@type': 'PostalAddress', streetAddress: d.address, addressLocality: d.city, addressRegion: 'NM' },
          ...(d.website ? { url: d.website } : {}),
          ...(d.phone ? { telephone: d.phone } : {})
        }
      }))
    };
    let script = document.getElementById('directory-jsonld');
    if (!script) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = 'directory-jsonld';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(itemList);
  } catch (e) {
    console.warn('JSON-LD injection skipped:', e);
  }
}

/**
 * Utility: Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

// ============================================
// EXPOSE FUNCTIONS TO GLOBAL SCOPE
// ============================================
window.renderDispensariesByCity = renderDispensariesByCity;
window.createDispensaryCard = createDispensaryCard;
window.applyFilters = applyFilters;
window.toggleOffering = toggleOffering;
window.clearFilters = clearFilters;
window.refreshData = refreshData;
window.populateCityFilter = populateCityFilter;
window.updateResultCount = updateResultCount;
window.exportToCSV = exportToCSV;
window.openDispensaryDetail = openDispensaryDetail;
window.closeDispensaryModal = closeDispensaryModal;
window.escapeHtml = escapeHtml;
window.generateStarRating = generateStarRating;
window.formatReviewCount = formatReviewCount;
window.renderHeroStats = renderHeroStats;
window.injectStructuredData = injectStructuredData;
window.getFilteredResults = getFilteredResults;
