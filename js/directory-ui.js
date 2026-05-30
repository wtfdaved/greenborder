// ============================================
// DIRECTORY UI RENDERING & INTERACTIONS
// ============================================

/**
 * Render dispensaries grouped by city
 * Premium dispensaries appear first in each city
 */
function renderDispensariesByCity(dispensaries) {
  const container = document.getElementById('dispensary-grid-by-city');
  if (!container) return;

  if (dispensaries.length === 0) {
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
    grouped[city] = dispensaries.filter(d => d.city === city);
  });

  // Build HTML
  let html = '';

  cityOrder.forEach(city => {
    const cityDisps = grouped[city];
    if (cityDisps.length === 0) return;

    // Separate premium and standard
    const premium = cityDisps.filter(d => d.isPremium);
    const standard = cityDisps.filter(d => !d.isPremium);

    html += `<section class="city-section">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${premium.map(dsp => createPremiumCard(dsp)).join('')}
        ${standard.map(dsp => createStandardCard(dsp)).join('')}
      </div>
    </section>`;
  });

  container.innerHTML = html;
  console.log(`✅ Rendered ${dispensaries.length} dispensaries grouped by city`);
}

/**
 * Create a premium dispensary card
 */
function createPremiumCard(dsp) {
  return `
    <div class="premium-card rounded-2xl overflow-hidden transition-all cursor-pointer group relative"
         onclick="openDispensaryDetail('${dsp.id}')">
      <div class="premium-badge">FEATURED ✨</div>

      <!-- Header -->
      <div class="bg-gradient-to-r from-emerald-600 to-emerald-500 p-5">
        <h3 class="text-xl font-bold text-white">${escapeHtml(dsp.name)}</h3>
        <p class="text-emerald-100 text-sm">${escapeHtml(dsp.city)}</p>
      </div>

      <!-- Content -->
      <div class="p-5 space-y-4">
        <!-- Rating -->
        <div class="flex items-center gap-2">
          <span class="text-gold-400 font-bold text-lg">${dsp.rating.toFixed(1)}★</span>
          <span class="text-gray-400 text-sm">(${dsp.reviewCount} reviews)</span>
        </div>

        <!-- Address -->
        <div class="text-sm text-gray-300">
          <p>${escapeHtml(dsp.address)}</p>
        </div>

        <!-- Contact -->
        <div class="text-sm space-y-1">
          ${dsp.phone ? `<p><a href="tel:${dsp.phone}" class="text-emerald-400 hover:underline font-medium">${dsp.phone}</a></p>` : ''}
          ${dsp.website ? `<p><a href="${escapeHtml(dsp.website)}" target="_blank" class="text-emerald-400 hover:underline font-medium">Visit Website →</a></p>` : ''}
        </div>

        <!-- Tags -->
        <div class="flex flex-wrap gap-2">
          ${dsp.hasAdultUse ? '<span class="badge-rec px-2 py-1 rounded text-xs font-bold">Adult Use</span>' : ''}
          ${dsp.hasMedical ? '<span class="badge-med px-2 py-1 rounded text-xs font-bold">Medical</span>' : ''}
          ${dsp.hasConsumption ? '<span class="badge-new px-2 py-1 rounded text-xs font-bold">Lounge</span>' : ''}
        </div>

        <!-- CTA -->
        <a href="/partner.html?claim=${encodeURIComponent(dsp.id)}"
           class="mt-3 block w-full text-center px-3 py-2 bg-gold-600 hover:bg-gold-500 text-white text-sm font-bold rounded-lg transition">
          Claim Listing
        </a>
      </div>
    </div>
  `;
}

/**
 * Create a standard dispensary card
 */
function createStandardCard(dsp) {
  return `
    <div class="dispensary-card rounded-2xl overflow-hidden transition-all cursor-pointer group"
         onclick="openDispensaryDetail('${dsp.id}')">

      <!-- Header -->
      <div class="bg-gradient-to-r from-emerald-600 to-emerald-500 p-5">
        <h3 class="text-xl font-bold text-white">${escapeHtml(dsp.name)}</h3>
        <p class="text-emerald-100 text-sm">${escapeHtml(dsp.city)}</p>
      </div>

      <!-- Content -->
      <div class="p-5 space-y-4">
        <!-- Rating -->
        <div class="flex items-center gap-2">
          <span class="text-gold-400 font-bold">${dsp.rating.toFixed(1)}★</span>
          <span class="text-gray-400 text-sm">(${dsp.reviewCount} reviews)</span>
        </div>

        <!-- Address -->
        <div class="text-sm text-gray-300">
          <p>${escapeHtml(dsp.address)}</p>
        </div>

        <!-- Contact -->
        <div class="text-sm space-y-1">
          ${dsp.phone ? `<p><a href="tel:${dsp.phone}" class="text-emerald-400 hover:underline">${dsp.phone}</a></p>` : ''}
          ${dsp.website ? `<p><a href="${escapeHtml(dsp.website)}" target="_blank" class="text-emerald-400 hover:underline">Visit Website →</a></p>` : ''}
        </div>

        <!-- Tags -->
        <div class="flex flex-wrap gap-2">
          ${dsp.hasAdultUse ? '<span class="badge-rec px-2 py-1 rounded text-xs font-bold">Adult Use</span>' : ''}
          ${dsp.hasMedical ? '<span class="badge-med px-2 py-1 rounded text-xs font-bold">Medical</span>' : ''}
          ${dsp.hasConsumption ? '<span class="badge-new px-2 py-1 rounded text-xs font-bold">Lounge</span>' : ''}
        </div>

        <!-- CTA -->
        <a href="/partner.html?claim=${encodeURIComponent(dsp.id)}"
           class="mt-3 block w-full text-center px-3 py-2 bg-gold-600 hover:bg-gold-500 text-white text-sm font-bold rounded-lg transition">
          Claim Listing
        </a>
      </div>
    </div>
  `;
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
          <div class="mt-3 flex items-center gap-2">
            <span class="text-2xl text-gold-500">${dispensary.rating.toFixed(1)}★</span>
            <span class="text-gray-400">${dispensary.reviewCount} reviews</span>
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
  let results = window.dispensaryService.data;

  // Search
  const searchInput = document.getElementById('search-input');
  if (searchInput && searchInput.value) {
    results = window.dispensaryService.search(searchInput.value);
  }

  // City filter
  const cityFilter = document.getElementById('city-filter');
  if (cityFilter && cityFilter.value) {
    results = results.filter(d => d.city === cityFilter.value);
  }

  // Type filter
  const typeFilter = document.getElementById('type-filter');
  if (typeFilter && typeFilter.value) {
    results = results.filter(d => d.type === typeFilter.value);
  }

  // Rating filter
  const ratingFilter = document.getElementById('rating-filter');
  if (ratingFilter && ratingFilter.value) {
    results = results.filter(d => d.rating >= parseFloat(ratingFilter.value));
  }

  renderDispensariesByCity(results);
  updateResultCount(results.length);
}

/**
 * Update city dropdown from available data
 */
function populateCityFilter() {
  const cities = window.dispensaryService.getCities();
  const select = document.getElementById('city-filter');

  if (select) {
    select.innerHTML = `
      <option value="">All Cities (${cities.length})</option>
      ${cities.map(city => `<option value="${city}">${city}</option>`).join('')}
    `;
  }
}

/**
 * Update result count display
 */
function updateResultCount(count) {
  const countElement = document.getElementById('result-count');
  if (countElement) {
    countElement.textContent = `${count} dispensaries found`;
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
