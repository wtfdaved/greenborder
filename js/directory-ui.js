// ============================================
// DIRECTORY UI RENDERING & INTERACTIONS
// ============================================

/**
 * Generate SVG star rating display with configurable styling
 * @param {number} rating - Rating value (0-5)
 * @param {boolean} isPremium - Whether to use gold styling for premium dispensaries
 * @returns {string} HTML string with SVG stars
 */
function generateStarRating(rating, isPremium = false) {
  const stars = [];
  const ratingNum = parseFloat(rating) || 0;

  // Determine color: gold for premium, emerald for standard
  const fillColor = isPremium ? '#fbbf24' : '#34d399';
  const emptyColor = '#4b5563';

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
  const reviewCount = parseInt(count) || 0;
  return `(${reviewCount} Google Review${reviewCount !== 1 ? 's' : ''})`;
}

/**
 * Render dispensaries grouped by city
 * Premium dispensaries appear first in each city
 * Only renders city sections that have dispensaries
 */
function renderDispensariesByCity(dispensaries) {
  try {
    const container = document.getElementById('dispensary-grid-by-city');
    if (!container) {
      console.warn('Container dispensary-grid-by-city not found');
      return;
    }

    if (!dispensaries || dispensaries.length === 0) {
      container.innerHTML = `
        <div class="text-center py-12 text-gray-400">
          <p class="text-lg">No dispensaries found. Try adjusting your filters.</p>
        </div>
      `;
      return;
    }

    // Group by city in order: Sunland Park, Chaparral, Santa Teresa, Anthony
    const cityOrder = ['Sunland Park', 'Chaparral', 'Santa Teresa', 'Anthony'];
    const grouped = {};

    cityOrder.forEach(city => {
      grouped[city] = (dispensaries || []).filter(d => d && d.city === city);
    });

    // Build HTML - only include cities that have dispensaries
    let html = '';
    const citiesWithDispensaries = cityOrder.filter(city => grouped[city]?.length > 0);

    citiesWithDispensaries.forEach(city => {
      const cityDisps = grouped[city] || [];
      if (cityDisps.length === 0) return;

      try {
        // Separate premium and standard
        const premium = cityDisps.filter(d => d && d.isPremium);
        const standard = cityDisps.filter(d => d && !d.isPremium);

        html += `<section class="city-section">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${premium.map(dsp => {
              try {
                return createPremiumCard(dsp);
              } catch (e) {
                console.error('Premium card error:', e);
                return '';
              }
            }).join('')}
            ${standard.map(dsp => {
              try {
                return createStandardCard(dsp);
              } catch (e) {
                console.error('Standard card error:', e);
                return '';
              }
            }).join('')}
          </div>
        </section>`;
      } catch (e) {
        console.error(`Error processing city ${city}:`, e);
      }
    });

    container.innerHTML = html || '<div class="text-center py-12 text-gray-400">No dispensaries to display</div>';
    console.log(`✅ Rendered ${dispensaries.length} dispensaries grouped by ${citiesWithDispensaries.length} cities`);
  } catch (error) {
    console.error('renderDispensariesByCity error:', error);
    const container = document.getElementById('dispensary-grid-by-city');
    if (container) {
      container.innerHTML = '<div class="text-center py-12 text-red-400">Error rendering dispensaries</div>';
    }
  }
}

/**
 * Create a premium dispensary card with liquid glass design
 */
function createPremiumCard(dsp) {
  try {
    if (!dsp) return '';
    const ratingValue = dsp.rating || 0;
    const stars = generateStarRating(ratingValue, true);
    const reviewText = formatReviewCount(dsp.reviewCount);

    return `
      <div class="premium-card rounded-2xl overflow-hidden transition-all cursor-pointer group relative"
           onclick="try { openDispensaryDetail('${dsp.id}'); } catch(e) { console.error(e); }">
        <div class="premium-badge">FEATURED ✨</div>

        <!-- Glass Header -->
        <div class="card-header-glass p-5 border-b border-emerald-500/20">
          <h3 class="text-xl font-bold text-white mb-1">${escapeHtml(dsp.name)}</h3>
          <p class="text-emerald-100 text-sm flex items-center gap-1">
            <span>📍</span>
            <span>${escapeHtml(dsp.city)}</span>
          </p>
        </div>

        <!-- Content -->
        <div class="p-5 space-y-4">
          <!-- Rating with Stars -->
          <div class="space-y-1.5">
            ${stars}
            <p class="text-gray-400 text-xs font-medium">${ratingValue.toFixed(1)} • ${reviewText}</p>
          </div>

          <!-- Address -->
          <div class="text-sm text-gray-300">
            <p>${escapeHtml(dsp.address)}</p>
          </div>

          <!-- Contact Buttons -->
          <div class="text-sm space-y-2">
            ${dsp.phone ? `<p><a href="tel:${dsp.phone}" class="text-emerald-400 hover:text-emerald-300 font-medium">📞 ${dsp.phone}</a></p>` : ''}
            ${dsp.website ? `<p><a href="${escapeHtml(dsp.website)}" target="_blank" class="text-emerald-400 hover:text-emerald-300 font-medium">🌐 Visit Website</a></p>` : ''}
          </div>

          <!-- Badges with Emoji -->
          <div class="flex flex-wrap gap-2 pt-2">
            ${dsp.hasAdultUse ? '<span class="badge-rec-emoji px-3 py-1.5 rounded-full text-xs font-bold">🌿 Recreational</span>' : ''}
            ${dsp.hasMedical ? '<span class="badge-med-emoji px-3 py-1.5 rounded-full text-xs font-bold">🏥 Medical</span>' : ''}
            ${dsp.hasConsumption ? '<span class="badge-lounge-emoji px-3 py-1.5 rounded-full text-xs font-bold">🛋️ Lounge</span>' : ''}
          </div>

          <!-- CTA -->
          <a href="/partner.html?claim=${encodeURIComponent(dsp.id)}"
             class="mt-4 block w-full text-center px-3 py-2.5 bg-gradient-to-r from-gold-600 to-gold-500 hover:from-gold-500 hover:to-gold-400 text-white text-sm font-bold rounded-lg transition transform hover:scale-105">
            ✓ Claim Listing
          </a>
        </div>
      </div>
    `;
  } catch (error) {
    console.error('createPremiumCard error:', error);
    return '';
  }
}

/**
 * Create a standard dispensary card with liquid glass design
 */
function createStandardCard(dsp) {
  try {
    if (!dsp) return '';
    const ratingValue = dsp.rating || 0;
    const stars = generateStarRating(ratingValue, false);
    const reviewText = formatReviewCount(dsp.reviewCount);

    return `
      <div class="dispensary-card rounded-2xl overflow-hidden transition-all cursor-pointer group"
           onclick="try { openDispensaryDetail('${dsp.id}'); } catch(e) { console.error(e); }">

        <!-- Glass Header -->
        <div class="card-header-glass p-5 border-b border-emerald-500/20">
          <h3 class="text-xl font-bold text-white mb-1">${escapeHtml(dsp.name)}</h3>
          <p class="text-emerald-100 text-sm flex items-center gap-1">
            <span>📍</span>
            <span>${escapeHtml(dsp.city)}</span>
          </p>
        </div>

        <!-- Content -->
        <div class="p-5 space-y-4">
          <!-- Rating with Stars -->
          <div class="space-y-1.5">
            ${stars}
            <p class="text-gray-400 text-xs font-medium">${ratingValue.toFixed(1)} • ${reviewText}</p>
          </div>

          <!-- Address -->
          <div class="text-sm text-gray-300">
            <p>${escapeHtml(dsp.address)}</p>
          </div>

          <!-- Contact Buttons -->
          <div class="text-sm space-y-2">
            ${dsp.phone ? `<p><a href="tel:${dsp.phone}" class="text-emerald-400 hover:text-emerald-300 font-medium">📞 ${dsp.phone}</a></p>` : ''}
            ${dsp.website ? `<p><a href="${escapeHtml(dsp.website)}" target="_blank" class="text-emerald-400 hover:text-emerald-300 font-medium">🌐 Visit Website</a></p>` : ''}
          </div>

          <!-- Badges with Emoji -->
          <div class="flex flex-wrap gap-2 pt-2">
            ${dsp.hasAdultUse ? '<span class="badge-rec-emoji px-3 py-1.5 rounded-full text-xs font-bold">🌿 Recreational</span>' : ''}
            ${dsp.hasMedical ? '<span class="badge-med-emoji px-3 py-1.5 rounded-full text-xs font-bold">🏥 Medical</span>' : ''}
            ${dsp.hasConsumption ? '<span class="badge-lounge-emoji px-3 py-1.5 rounded-full text-xs font-bold">🛋️ Lounge</span>' : ''}
          </div>

          <!-- CTA -->
          <a href="/partner.html?claim=${encodeURIComponent(dsp.id)}"
             class="mt-4 block w-full text-center px-3 py-2.5 bg-gradient-to-r from-gold-600 to-gold-500 hover:from-gold-500 hover:to-gold-400 text-white text-sm font-bold rounded-lg transition transform hover:scale-105">
            ✓ Claim Listing
          </a>
        </div>
      </div>
    `;
  } catch (error) {
    console.error('createStandardCard error:', error);
    return '';
  }
}

/**
 * Backward compatibility: render flat grid (deprecated, using city grouping instead)
 */
function renderDispensaryGrid(dispensaries) {
  renderDispensariesByCity(dispensaries);
}

/**
 * Open detail modal for a dispensary
 */
function openDispensaryDetail(dispensaryId) {
  const dispensary = window.dispensaryService.getById(dispensaryId);
  if (!dispensary) {
    console.error('Dispensary not found:', dispensaryId);
    return;
  }

  const modal = document.getElementById('dispensary-modal');
  const content = document.getElementById('modal-content');

  content.innerHTML = `
    <div class="space-y-6">
      <!-- Header -->
      <div class="border-b border-gray-700 pb-4">
        <h2 class="text-3xl font-bold text-white">${escapeHtml(dispensary.name)}</h2>
        <p class="text-gray-400 mt-1">${escapeHtml(dispensary.city)}</p>

        ${dispensary.rating > 0 ? `
          <div class="mt-3 space-y-2">
            ${generateStarRating(dispensary.rating, dispensary.isPremium)}
            <p class="text-gray-400 text-sm">${dispensary.rating.toFixed(1)} • ${formatReviewCount(dispensary.reviewCount)}</p>
          </div>
        ` : ''}
      </div>

      <!-- Contact Info -->
      <div class="space-y-2">
        <h3 class="text-lg font-semibold text-emerald-400">Contact</h3>
        <p><span class="text-gray-400">Address:</span> ${escapeHtml(dispensary.address)}</p>
        <p><a href="tel:${dispensary.phone}" class="text-emerald-400 hover:underline">${dispensary.phone}</a></p>
        ${dispensary.website ? `<p><a href="${escapeHtml(dispensary.website)}" target="_blank" class="text-emerald-400 hover:underline">🌐 Visit Website</a></p>` : ''}
      </div>

      <!-- Products & Services -->
      <div class="space-y-2">
        <h3 class="text-lg font-semibold text-emerald-400">Products & Services</h3>
        <div class="flex flex-wrap gap-3">
          ${dispensary.hasAdultUse ? '<span class="bg-emerald-900/50 text-emerald-200 px-3 py-1 rounded">✓ Adult Use</span>' : '<span class="bg-gray-700/50 text-gray-400 px-3 py-1 rounded">✗ Adult Use</span>'}
          ${dispensary.hasMedical ? '<span class="bg-blue-900/50 text-blue-200 px-3 py-1 rounded">✓ Medical</span>' : '<span class="bg-gray-700/50 text-gray-400 px-3 py-1 rounded">✗ Medical</span>'}
          ${dispensary.hasConsumption ? '<span class="bg-gold-900/50 text-gold-200 px-3 py-1 rounded">✓ Consumption Lounge</span>' : ''}
        </div>
      </div>

      <!-- License Info (if available) -->
      ${dispensary.licenseNumber ? `
        <div class="bg-gray-900 p-3 rounded text-sm text-gray-400">
          <p>License #: ${escapeHtml(dispensary.licenseNumber)}</p>
        </div>
      ` : ''}

      <!-- Claim/Premium CTA -->
      <div class="border-t border-gray-700 pt-4 flex gap-3">
        <a href="/partner.html?claim=${encodeURIComponent(dispensary.id)}"
           class="flex-1 px-4 py-2 bg-gold-600 hover:bg-gold-500 text-white font-semibold rounded transition text-center">
          ✓ Is This Your Dispensary? Claim Listing
        </a>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
}

/**
 * Close the detail modal
 */
function closeDispensaryModal() {
  const modal = document.getElementById('dispensary-modal');
  modal.classList.add('hidden');
}

/**
 * Apply filters and re-render grid (grouped by city)
 */
function applyFilters() {
  try {
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

    // City filter
    const cityFilter = document.getElementById('city-filter');
    if (cityFilter && cityFilter.value) {
      results = (results || []).filter(d => d && d.city === cityFilter.value);
    }

    // Type filter
    const typeFilter = document.getElementById('type-filter');
    if (typeFilter && typeFilter.value) {
      results = (results || []).filter(d => d && d.type === typeFilter.value);
    }

    // Rating filter
    const ratingFilter = document.getElementById('rating-filter');
    if (ratingFilter && ratingFilter.value) {
      results = (results || []).filter(d => d && d.rating >= parseFloat(ratingFilter.value));
    }

    renderDispensariesByCity(results);
    updateResultCount(results.length);
  } catch (error) {
    console.error('applyFilters error:', error);
    document.getElementById('result-count').textContent = 'Error applying filters';
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
      select.innerHTML = `
        <option value="">All Cities (${cities.length})</option>
        ${(cities || []).map(city => `<option value="${city}">${(city || '').replace(/</g, '&lt;')}</option>`).join('')}
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
      countElement.textContent = `${count || 0} dispensaries found`;
    }
  } catch (error) {
    console.error('updateResultCount error:', error);
  }
}

/**
 * Export filtered results as CSV
 */
function exportToCSV() {
  const dispensaries = window.dispensaryService.data;

  const headers = ['Name', 'City', 'Address', 'Phone', 'Website', 'Rating', 'Type'];
  const rows = dispensaries.map(d => [
    d.name,
    d.city,
    d.address,
    d.phone,
    d.website,
    d.rating,
    d.type
  ]);

  // Create CSV
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  // Download
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `greenborder-dispensaries-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log('📥 CSV exported');
}

/**
 * Utility: Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

// ============================================
// EXPOSE FUNCTIONS TO GLOBAL SCOPE
// ============================================
// Make functions globally accessible for HTML event handlers
window.renderDispensariesByCity = renderDispensariesByCity;
window.applyFilters = applyFilters;
window.populateCityFilter = populateCityFilter;
window.updateResultCount = updateResultCount;
window.exportToCSV = exportToCSV;
window.openDispensaryDetail = openDispensaryDetail;
window.closeDispensaryModal = closeDispensaryModal;
window.escapeHtml = escapeHtml;
window.generateStarRating = generateStarRating;
window.formatReviewCount = formatReviewCount;
