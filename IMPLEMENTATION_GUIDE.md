# Dispensary Directory: Implementation Guide

> **Superseded — August 2026.** This document planned a standalone
> `/directory.html` page. That page was built, then retired: the
> homepage directory absorbed everything it could do (star ratings,
> detail modal, call links, `?q=`/`?city=` deep links), and
> `/directory.html` is now a redirect stub kept only so existing
> inbound links resolve. `js/directory-ui.js` and the service stack it
> describes are gone from the browser; `data/dispensaries.js` remains
> the single source of dispensary data. Kept as a record of the
> original design, not as a guide to the current code — see CLAUDE.md
> for that.


Quick-start guide for adding the dynamic dispensary directory to greenborder.org.

---

## QUICK REFERENCE: FILES TO CREATE/MODIFY

| File | Type | Purpose | Complexity |
|------|------|---------|-----------|
| `/data/dispensaries-config.js` | CREATE | Data source configuration | Low |
| `/data/data-service.js` | CREATE | Core data management | Medium |
| `/data/dispensaries-fallback.json` | CREATE | Fallback data source | Low |
| `/js/directory-ui.js` | CREATE | View rendering functions | Medium |
| `/directory.html` | CREATE | Main directory page | Medium |
| `index.html` | MODIFY | Link to directory | Low |
| `CNAME` | NO CHANGE | Already pointing to greenborder.org | - |

---

## STEP-BY-STEP IMPLEMENTATION

### STEP 1: Create Directory Structure

```bash
mkdir -p /data /js /assets/css
```

### STEP 2: Create Config File

**File**: `/data/dispensaries-config.js`

This file tells the system where to fetch data from:

```javascript
// ============================================
// DISPENSARY DATA SOURCE CONFIGURATION
// ============================================

/**
 * Data source definitions for cannabis dispensaries
 * Supports Airtable, JSON APIs, and fallback JSON files
 */

const DISPENSARY_CONFIG = {
  // Primary: Airtable API
  airtable: {
    enabled: true,
    
    // From your Airtable base settings
    baseId: import.meta.env.VITE_AIRTABLE_BASE_ID || 'appXXXXXXXXXXXXXX',
    tableId: import.meta.env.VITE_AIRTABLE_TABLE_ID || 'tblXXXXXXXXXXXXXX',
    apiKey: import.meta.env.VITE_AIRTABLE_API_KEY || '',
    
    // Which Airtable view to use
    view: 'Grid view',
    
    // Fields to fetch (order doesn't matter, but these are required)
    fields: [
      'id',
      'name',
      'city',
      'address',
      'phone',
      'website',
      'hours',
      'type',
      'rating',
      'reviewCount',
      'hasAdultUse',
      'hasMedical',
      'hasConsumption'
    ],
    
    // How often to refresh from Airtable (milliseconds)
    updateInterval: 3600000  // 1 hour
  },

  // Fallback: Static JSON file
  fallbackJson: {
    enabled: true,
    url: '/data/dispensaries-fallback.json',
    updateInterval: 86400000  // 24 hours
  },

  // Local storage caching
  cache: {
    ttl: 3600000,  // 1 hour
    keys: {
      data: 'tgb:dispensaries',
      lastSync: 'tgb:dispensaries:sync',
      errors: 'tgb:dispensaries:errors'
    }
  }
};

// Feature flags
const FEATURES = {
  fuzzySearch: true,
  distanceCalculation: false,  // Requires geolocation
  offlineMode: true,
  dataAutoRefresh: true,
  showDebugInfo: false  // Set to true for development
};
```

### STEP 3: Create Data Service

**File**: `/data/data-service.js`

The core engine that handles all data operations:

```javascript
// ============================================
// DISPENSARY DATA SERVICE
// ============================================
// Handles fetching, caching, normalization, and distribution of dispensary data

class DispensaryDataService {
  constructor(config = DISPENSARY_CONFIG) {
    this.config = config;
    this.data = [];
    this.isSyncing = false;
    this.lastSync = null;
    this.lastError = null;
    
    // Observer pattern for UI reactivity
    this.subscribers = new Map();
    
    // Auto-refresh timer
    this.refreshTimer = null;
  }

  /**
   * Primary method: Fetch all dispensaries
   * Tries Airtable first, falls back to JSON, checks cache
   */
  async load(forceRefresh = false) {
    console.log('📊 Loading dispensary data...');
    
    // Check cache first
    if (!forceRefresh) {
      const cached = this.loadFromCache();
      if (cached) {
        this.data = cached;
        console.log(`✅ Loaded ${cached.length} dispensaries from cache`);
        return cached;
      }
    }

    if (this.isSyncing) {
      console.log('⏳ Sync already in progress...');
      return this.data;
    }

    this.isSyncing = true;

    try {
      // Try primary source
      if (this.config.airtable.enabled && this.config.airtable.apiKey) {
        console.log('🌐 Fetching from Airtable...');
        this.data = await this.fetchFromAirtable();
      }

      // Fallback if needed
      if (!this.data || this.data.length === 0) {
        if (this.config.fallbackJson.enabled) {
          console.log('📄 Falling back to JSON...');
          this.data = await this.fetchFromJson();
        }
      }

      // Process the data
      if (this.data.length > 0) {
        this.data = this.normalize(this.data);
        this.data = this.deduplicate(this.data);
        this.data = this.sortByCity(this.data);
        
        this.saveToCache();
        this.lastSync = new Date();
        this.lastError = null;
        
        console.log(`✅ Loaded ${this.data.length} dispensaries`);
        this.publish('data-loaded', this.data);
      }

    } catch (error) {
      console.error('❌ Data load failed:', error);
      this.lastError = error.message;
      this.publish('data-error', error);
      
      // Try to recover from cache
      const cached = this.loadFromCache();
      if (cached) {
        this.data = cached;
        console.log(`ℹ️ Using stale cache data (${cached.length} items)`);
      }
    }

    this.isSyncing = false;
    return this.data;
  }

  /**
   * Fetch from Airtable API
   * @private
   */
  async fetchFromAirtable() {
    const { baseId, tableId, apiKey, fields, view } = this.config.airtable;

    // Build API URL with parameters
    const params = new URLSearchParams({
      view: view,
      fields: fields.join(','),
      pageSize: 100
    });

    const url = `https://api.airtable.com/v0/${baseId}/${tableId}?${params}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 401) {
      throw new Error('Airtable API key invalid');
    }

    if (!response.ok) {
      throw new Error(`Airtable API error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    
    // Airtable returns records with .fields property
    return json.records.map(record => ({
      airtableId: record.id,
      ...record.fields
    }));
  }

  /**
   * Fetch from JSON fallback
   * @private
   */
  async fetchFromJson() {
    const response = await fetch(this.config.fallbackJson.url);
    
    if (!response.ok) {
      throw new Error(`JSON fetch failed: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Normalize disparate data formats to standard schema
   * @private
   */
  normalize(data) {
    return data.map(item => ({
      // Identity
      id: item.id || item.airtableId || this.generateId(item),
      
      // Core Info
      name: String(item.name || '').trim(),
      licensee: String(item.licensee || '').trim(),
      
      // Location
      city: String(item.city || '').trim(),
      address: String(item.address || '').trim(),
      zipCode: String(item.zipCode || item.postal || '').trim(),
      
      // Contact
      phone: String(item.phone || item.telephone || '').trim(),
      website: String(item.website || item.url || '').trim(),
      
      // Hours (could be object or string)
      hours: typeof item.hours === 'string' 
        ? this.parseHours(item.hours)
        : item.hours || {},
      
      // Classification
      type: this.normalizeType(item.type),
      
      // Ratings
      rating: this.parseFloat(item.rating),
      reviewCount: this.parseInt(item.reviewCount),
      
      // Product flags
      hasAdultUse: this.parseBoolean(item.hasAdultUse),
      hasMedical: this.parseBoolean(item.hasMedical),
      hasConsumption: this.parseBoolean(item.hasConsumption),
      
      // License info
      licenseNumber: String(item.licenseNumber || '').trim(),
      licenseExpiry: item.licenseExpiry || null,
      
      // Metadata
      dataSource: item.dataSource || 'airtable',
      lastUpdated: item.lastUpdated || new Date().toISOString(),
      tags: item.tags || []
    }));
  }

  /**
   * Remove duplicate dispensaries (same name + city)
   * @private
   */
  deduplicate(data) {
    const seen = new Set();
    const result = [];

    data.forEach(item => {
      const key = `${item.name.toLowerCase()}|${item.city.toLowerCase()}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    });

    return result;
  }

  /**
   * Sort dispensaries by city for consistent display
   * @private
   */
  sortByCity(data) {
    return data.sort((a, b) => {
      const cityCompare = a.city.localeCompare(b.city);
      if (cityCompare !== 0) return cityCompare;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Cache management: Load from localStorage
   * @private
   */
  loadFromCache() {
    try {
      const cached = localStorage.getItem(this.config.cache.keys.data);
      const timestamp = localStorage.getItem(this.config.cache.keys.lastSync);

      if (!cached || !timestamp) return null;

      // Check if cache is expired
      const age = Date.now() - parseInt(timestamp);
      if (age > this.config.cache.ttl) {
        console.log('⏰ Cache expired');
        return null;
      }

      const hoursOld = Math.floor(age / 1000 / 60 / 60);
      console.log(`📦 Cache hit (${hoursOld}h old)`);
      
      return JSON.parse(cached);
    } catch (e) {
      console.warn('Cache load failed:', e);
      return null;
    }
  }

  /**
   * Cache management: Save to localStorage
   * @private
   */
  saveToCache() {
    try {
      localStorage.setItem(
        this.config.cache.keys.data,
        JSON.stringify(this.data)
      );
      localStorage.setItem(
        this.config.cache.keys.lastSync,
        Date.now().toString()
      );
    } catch (e) {
      console.warn('Cache save failed (storage full?):', e);
    }
  }

  /**
   * Search/Filter methods
   */
  
  filterByCity(city) {
    if (!city) return this.data;
    return this.data.filter(d => 
      d.city.toLowerCase() === city.toLowerCase()
    );
  }

  filterByType(type) {
    if (!type) return this.data;
    return this.data.filter(d => 
      d.type === type
    );
  }

  filterByRating(minRating) {
    if (!minRating) return this.data;
    return this.data.filter(d => 
      d.rating >= parseFloat(minRating)
    );
  }

  /**
   * Fuzzy search across name + city
   */
  search(query) {
    if (!query) return this.data;

    const q = query.toLowerCase();
    return this.data.filter(item => 
      item.name.toLowerCase().includes(q) ||
      item.city.toLowerCase().includes(q) ||
      (item.phone || '').includes(q)
    );
  }

  /**
   * Get unique cities for filter dropdowns
   */
  getCities() {
    const cities = new Set(this.data.map(d => d.city));
    return Array.from(cities).sort();
  }

  /**
   * Get dispensary by ID
   */
  getById(id) {
    return this.data.find(d => d.id === id);
  }

  /**
   * Observer pattern: Subscribe to data updates
   */
  subscribe(eventName, callback) {
    if (!this.subscribers.has(eventName)) {
      this.subscribers.set(eventName, []);
    }
    this.subscribers.get(eventName).push(callback);
    
    return () => {
      const callbacks = this.subscribers.get(eventName);
      const index = callbacks.indexOf(callback);
      if (index > -1) callbacks.splice(index, 1);
    };
  }

  /**
   * Publish events to subscribers
   * @private
   */
  publish(eventName, data) {
    const callbacks = this.subscribers.get(eventName) || [];
    callbacks.forEach(cb => {
      try {
        cb(data);
      } catch (e) {
        console.error(`Error in subscriber for ${eventName}:`, e);
      }
    });
  }

  /**
   * Utility: Generate consistent IDs
   * @private
   */
  generateId(item) {
    const name = (item.name || '').toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
    
    const city = (item.city || '').toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
    
    return city ? `${city}-${name}` : name;
  }

  /**
   * Utility: Normalize dispensary type
   * @private
   */
  normalizeType(type) {
    if (!type) return 'retail';
    
    const typeStr = String(type).toLowerCase().trim();
    if (typeStr.includes('retail') || typeStr.includes('dispensary')) return 'retail';
    if (typeStr.includes('wholesale')) return 'wholesale';
    if (typeStr.includes('cultivation') || typeStr.includes('grow')) return 'cultivation';
    if (typeStr.includes('lounge') || typeStr.includes('consumption')) return 'lounge';
    
    return 'retail';
  }

  /**
   * Utility: Safe float parsing
   * @private
   */
  parseFloat(value) {
    if (typeof value === 'number') return value;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Utility: Safe integer parsing
   * @private
   */
  parseInt(value) {
    if (typeof value === 'number') return value;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Utility: Safe boolean parsing
   * @private
   */
  parseBoolean(value) {
    if (typeof value === 'boolean') return value;
    return String(value).toLowerCase() === 'true';
  }

  /**
   * Utility: Parse hours string (optional advanced feature)
   * @private
   */
  parseHours(hoursString) {
    // If already an object, return as-is
    if (typeof hoursString === 'object') return hoursString;
    
    // Placeholder: could implement more sophisticated parsing
    return {};
  }

  /**
   * Get status info for debugging
   */
  getStatus() {
    return {
      itemCount: this.data.length,
      lastSync: this.lastSync,
      lastError: this.lastError,
      cacheEnabled: this.config.cache.ttl > 0,
      isSyncing: this.isSyncing
    };
  }
}

// Export as global singleton
window.dispensaryService = new DispensaryDataService(DISPENSARY_CONFIG);
```

### STEP 4: Create Fallback Data

**File**: `/data/dispensaries-fallback.json`

Seed data for offline mode and testing:

```json
[
  {
    "id": "sunland-park-astro-buds",
    "name": "Astro Buds",
    "licensee": "ASTRO BUDS LLC",
    "city": "Sunland Park",
    "address": "1650 Appaloosa Dr",
    "zipCode": "88063",
    "phone": "(575) 425-2837",
    "website": "https://astrobudsnm.com/",
    "type": "retail",
    "rating": 4.8,
    "reviewCount": 149,
    "hasAdultUse": true,
    "hasMedical": true,
    "hasConsumption": true,
    "licenseNumber": "NMDOH-001",
    "lastUpdated": "2026-05-29T00:00:00Z",
    "tags": ["lounge", "food", "cannabis"]
  },
  {
    "id": "sunland-park-top-crop",
    "name": "Top Crop",
    "licensee": "CHADCOR HOLDINGS NM",
    "city": "Sunland Park",
    "address": "1621 Appaloosa Dr",
    "zipCode": "88063",
    "phone": "(575) 555-0001",
    "website": "https://topcrop.example.com",
    "type": "retail",
    "rating": 4.5,
    "reviewCount": 87,
    "hasAdultUse": true,
    "hasMedical": true,
    "hasConsumption": false,
    "lastUpdated": "2026-05-29T00:00:00Z"
  }
]
```

### STEP 5: Create Directory UI Functions

**File**: `/js/directory-ui.js`

View rendering and interaction handlers:

```javascript
// ============================================
// DIRECTORY UI RENDERING & INTERACTIONS
// ============================================

/**
 * Render the dispensary grid
 * Called when data loads or filters change
 */
function renderDispensaryGrid(dispensaries) {
  const container = document.getElementById('dispensary-grid');
  if (!container) return;

  if (dispensaries.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-12 text-center text-gray-400">
        <p>No dispensaries found. Try adjusting your filters.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = dispensaries.map(dsp => `
    <div class="bg-charcoal-700 rounded-lg overflow-hidden hover:ring-2 hover:ring-emerald-500 transition-all cursor-pointer group"
         onclick="openDispensaryDetail('${dsp.id}')">
      
      <!-- Header -->
      <div class="bg-gradient-to-r from-emerald-600 to-emerald-500 p-4">
        <h3 class="text-xl font-bold text-white">${escapeHtml(dsp.name)}</h3>
        <p class="text-emerald-100 text-sm">${escapeHtml(dsp.city)}</p>
      </div>
      
      <!-- Content -->
      <div class="p-4 space-y-3">
        <!-- Rating -->
        <div class="flex items-center gap-2">
          <span class="text-gold-500 font-bold">${dsp.rating.toFixed(1)}★</span>
          <span class="text-gray-400 text-sm">(${dsp.reviewCount} reviews)</span>
        </div>
        
        <!-- Address -->
        <div class="text-sm text-gray-300">
          <p>${escapeHtml(dsp.address)}</p>
        </div>
        
        <!-- Contact -->
        <div class="text-sm space-y-1">
          <p><a href="tel:${dsp.phone}" class="text-emerald-400 hover:underline">${dsp.phone}</a></p>
          ${dsp.website ? `<p><a href="${escapeHtml(dsp.website)}" target="_blank" class="text-emerald-400 hover:underline">Visit Website →</a></p>` : ''}
        </div>
        
        <!-- Tags -->
        <div class="flex flex-wrap gap-2">
          ${dsp.hasAdultUse ? '<span class="bg-emerald-900 text-emerald-200 text-xs px-2 py-1 rounded">Adult Use</span>' : ''}
          ${dsp.hasMedical ? '<span class="bg-blue-900 text-blue-200 text-xs px-2 py-1 rounded">Medical</span>' : ''}
          ${dsp.hasConsumption ? '<span class="bg-gold-900 text-gold-200 text-xs px-2 py-1 rounded">Lounge</span>' : ''}
        </div>
      </div>
    </div>
  `).join('');

  console.log(`✅ Rendered ${dispensaries.length} dispensaries`);
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
 * Apply filters and re-render grid
 */
function applyFilters() {
  let results = window.dispensaryService.data;

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

  // Search
  const searchInput = document.getElementById('search-input');
  if (searchInput && searchInput.value) {
    results = window.dispensaryService.search(searchInput.value);
  }

  renderDispensaryGrid(results);
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
```

---

## Step 6: Create Directory Page

**File**: `/directory.html` (skeleton - you'll customize styling)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cannabis Dispensary Directory | The Green Border</title>
  
  <meta name="description" content="Find cannabis dispensaries in Southern New Mexico near El Paso. Search by location, type, hours, and ratings." />
  <meta name="keywords" content="cannabis dispensary directory, El Paso dispensaries, New Mexico cannabis, Sunland Park" />
  
  <!-- Tailwind CSS -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            emerald: { 400: '#34d399', 500: '#10b981', 600: '#059669' },
            gold: { 400: '#fbbf24', 500: '#f59e0b' },
            charcoal: { 700: '#1a1a1a', 900: '#0a0a0a' },
          }
        }
      }
    }
  </script>

  <!-- Google Fonts -->
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

  <style>
    body {
      font-family: 'Inter', system-ui, sans-serif;
      background-color: #0a0a0a;
      color: #e5e7eb;
    }
  </style>
</head>

<body class="bg-charcoal-900">
  <!-- Header -->
  <header class="bg-charcoal-700 border-b border-emerald-500/20 sticky top-0 z-40">
    <div class="max-w-7xl mx-auto px-4 py-4">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-emerald-400">🌿 Green Border Dispensary Directory</h1>
        <a href="index.html" class="text-gray-400 hover:text-white transition">← Back to Home</a>
      </div>
      <p class="text-gray-400 mt-2">Find cannabis dispensaries in Southern New Mexico</p>
    </div>
  </header>

  <!-- Main Content -->
  <main class="max-w-7xl mx-auto px-4 py-8">
    
    <!-- Filters & Search -->
    <div class="bg-charcoal-700 rounded-lg p-6 mb-8 space-y-4">
      <h2 class="text-lg font-semibold text-emerald-400">Filters</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Search -->
        <div>
          <label class="block text-sm text-gray-400 mb-2">Search</label>
          <input 
            id="search-input"
            type="text" 
            placeholder="Dispensary name or city..."
            class="w-full bg-charcoal-900 text-white px-3 py-2 rounded border border-gray-700 focus:border-emerald-500 outline-none"
            onkeyup="applyFilters()"
          />
        </div>

        <!-- City Filter -->
        <div>
          <label class="block text-sm text-gray-400 mb-2">City</label>
          <select 
            id="city-filter"
            class="w-full bg-charcoal-900 text-white px-3 py-2 rounded border border-gray-700 focus:border-emerald-500 outline-none"
            onchange="applyFilters()"
          >
            <option value="">All Cities</option>
          </select>
        </div>

        <!-- Type Filter -->
        <div>
          <label class="block text-sm text-gray-400 mb-2">Type</label>
          <select 
            id="type-filter"
            class="w-full bg-charcoal-900 text-white px-3 py-2 rounded border border-gray-700 focus:border-emerald-500 outline-none"
            onchange="applyFilters()"
          >
            <option value="">All Types</option>
            <option value="retail">Retail</option>
            <option value="lounge">Lounge</option>
            <option value="wholesale">Wholesale</option>
            <option value="cultivation">Cultivation</option>
          </select>
        </div>

        <!-- Rating Filter -->
        <div>
          <label class="block text-sm text-gray-400 mb-2">Min. Rating</label>
          <select 
            id="rating-filter"
            class="w-full bg-charcoal-900 text-white px-3 py-2 rounded border border-gray-700 focus:border-emerald-500 outline-none"
            onchange="applyFilters()"
          >
            <option value="">Any Rating</option>
            <option value="4.5">4.5+ ★</option>
            <option value="4.0">4.0+ ★</option>
            <option value="3.5">3.5+ ★</option>
          </select>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex gap-3 justify-end pt-2">
        <button onclick="exportToCSV()" class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition">
          📥 Export CSV
        </button>
        <button onclick="location.reload()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition">
          🔄 Refresh Data
        </button>
      </div>
    </div>

    <!-- Results Count -->
    <div class="mb-4 text-gray-400">
      <p id="result-count">Loading dispensaries...</p>
    </div>

    <!-- Dispensary Grid -->
    <div id="dispensary-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      <div class="col-span-full text-center py-12 text-gray-500">Loading...</div>
    </div>

  </main>

  <!-- Detail Modal -->
  <div id="dispensary-modal" class="hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-charcoal-700 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
      <div class="sticky top-0 bg-charcoal-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <h2 class="text-xl font-bold text-white">Dispensary Details</h2>
        <button onclick="closeDispensaryModal()" class="text-gray-400 hover:text-white">✕</button>
      </div>
      <div id="modal-content" class="p-6"></div>
    </div>
  </div>

  <!-- Scripts -->
  <script src="/data/dispensaries-config.js"></script>
  <script src="/data/data-service.js"></script>
  <script src="/js/directory-ui.js"></script>

  <script>
    // Initialize directory on page load
    document.addEventListener('DOMContentLoaded', async () => {
      console.log('🚀 Initializing Dispensary Directory...');
      
      // Load data
      const dispensaries = await window.dispensaryService.load();
      
      if (dispensaries.length > 0) {
        // Populate filters
        populateCityFilter();
        
        // Render grid
        renderDispensaryGrid(dispensaries);
        
        // Update count
        document.getElementById('result-count').textContent = `${dispensaries.length} dispensaries found`;
      } else {
        document.getElementById('result-count').textContent = 'No dispensaries available';
      }

      // Subscribe to data updates
      window.dispensaryService.subscribe('data-loaded', (data) => {
        console.log('📊 Data updated, refreshing view...');
        populateCityFilter();
        applyFilters();
      });

      // Close modal on background click
      document.getElementById('dispensary-modal').addEventListener('click', (e) => {
        if (e.target.id === 'dispensary-modal') closeDispensaryModal();
      });

      // Show service status
      console.log('📊 Service Status:', window.dispensaryService.getStatus());
    });
  </script>
</body>
</html>
```

---

## STEP 7: Update Index.html

Add a link to the directory in your homepage. Find this section in `index.html`:

```html
<!-- Add this button in a prominent location -->
<div class="text-center py-12">
  <h2 class="text-3xl font-bold text-white mb-4">Find Dispensaries</h2>
  <p class="text-gray-400 mb-6">Search our complete directory of Southern New Mexico dispensaries</p>
  <a href="/directory.html" class="inline-block px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition">
    → Explore Directory
  </a>
</div>
```

---

## TESTING CHECKLIST

- [ ] **Local Testing**
  - [ ] Create `/data/` and `/js/` directories
  - [ ] Add all JavaScript files
  - [ ] Open `/directory.html` in browser
  - [ ] Verify fallback JSON loads (no API key needed)
  - [ ] Test search, filters
  - [ ] Test detail modal
  - [ ] Check browser console for errors

- [ ] **Cache Testing**
  - [ ] Open DevTools → Application → Local Storage
  - [ ] Verify `tgb:dispensaries` key exists
  - [ ] Refresh page → should load from cache
  - [ ] Clear cache → should refetch

- [ ] **Airtable Integration** (when ready)
  - [ ] Set `VITE_AIRTABLE_API_KEY` in `.env.local`
  - [ ] Verify Airtable fetch succeeds
  - [ ] Compare record count with fallback

---

## NEXT: AIRTABLE SETUP

Once you have Airtable account:

1. Create base with table named "Dispensaries"
2. Add columns: name, city, address, phone, website, rating, type, hasAdultUse, hasMedical, hasConsumption
3. Add some test records
4. Copy Base ID and Table ID from Airtable settings
5. Generate API key
6. Create `.env.local`:
```
VITE_AIRTABLE_BASE_ID=appXXXXX
VITE_AIRTABLE_TABLE_ID=tblXXXXX
VITE_AIRTABLE_API_KEY=patXXXXX
```

That's it! The data service will handle the rest.

---

## TROUBLESHOOTING

| Issue | Solution |
|-------|----------|
| "No dispensaries found" | Check `/data/dispensaries-fallback.json` exists and has valid JSON |
| CORS error from Airtable | Verify API key is correct, check CORS settings in Airtable |
| Cache not updating | Clear localStorage manually or wait 1 hour for TTL |
| Modal won't open | Check browser console for errors, verify `dispensary-modal` div exists |
| Filters not working | Check that `onchange="applyFilters()"` is on select elements |

