# GreenBorder Architecture Analysis & Dispensary Directory Transition Plan

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


**Date**: May 29, 2026  
**Objective**: Transition greenborder.org from sales analytics dashboard to automated, data-driven hyper-local cannabis dispensary directory for El Paso users.

---

## CURRENT STATE ANALYSIS

### 🏗️ Current Architecture

**Technology Stack**:
- **Static Site**: Vanilla HTML5 + CSS (Tailwind CDN) + Vanilla JavaScript
- **No Backend**: Runs entirely in the browser
- **No Build System**: Files served directly via GitHub Pages
- **Routing**: File-based (index.html, data.html, astro-buds.html, etc.)
- **Data Storage**: Embedded JavaScript arrays in HTML files

**Current File Structure**:
```
greenborder/
├── index.html                 # Homepage with featured dispensaries (2,282 lines)
├── data.html                  # Sales analytics dashboard (9,965 lines)
├── astro-buds.html            # Dispensary detail page template (903 lines)
├── mango-cannabis.html        # Another detail page
├── old-gods.html              # Another detail page
├── partnerships.html          # Static page
├── news.html                  # News page
├── CLAUDE.md                  # Sales dashboard documentation
├── sales-data-2026.js         # Sales data module
├── dba-matcher.js             # DBA matching utility
├── process-sales-data.js      # Data processing script
├── csv/                       # Raw CSV files (jan_2026.csv, feb_2026.csv)
├── education/                 # Education article pages
├── articles/                  # News article pages
└── public/                    # Static assets
```

### 📊 Current Data Flow (Sales Dashboard)

```
Raw CSV data (feb_2026.csv, jan_2026.csv)
         ↓
sales-data-2026.js (embedded arrays)
         ↓
data.html (JavaScript processing)
         ↓
Frontend rendering (tables, charts with Chart.js)
         ↓
User interactions (month selection, city filter)
```

### 🎯 Key Current State Limitations

1. **Data is hard-coded**: Sales data embedded directly in data.html as JavaScript arrays
2. **No dynamic data sourcing**: Would need to manually update HTML to add new months or cities
3. **Manual dispensary pages**: Each dispensary gets its own HTML file (astro-buds.html, etc.)
4. **No API integration**: Can't pull from Airtable, web scrapers, or external sources
5. **Single-purpose dashboard**: Optimized for sales analytics, not discovery/directory
6. **No templating system**: Each detail page is hand-coded HTML duplicating structure

---

## TARGET STATE: DYNAMIC DISPENSARY DIRECTORY

### 🎯 Vision

Transform greenborder into a **real-time dispensary directory** where:
- Data automatically syncs from Airtable/JSON source
- Users discover dispensaries by location, type, hours, ratings
- Directory auto-generates detail pages (no manual HTML per dispensary)
- Clean separation: sales dashboard (data.html) vs. directory (directory.html or home)
- Modular data pipeline: fetch → transform → cache → render

### 🗂️ New Architecture

```
Data Source (Airtable/JSON API)
         ↓
Data Ingestion Layer (fetch + cache)
         ↓
Data Transformation (normalize, dedupe, enrich)
         ↓
In-Memory Store (JavaScript objects, localStorage for offline)
         ↓
View Layer (render grid, detail modals, search)
         ↓
User Interactions (filter, search, navigate)
```

---

## DETAILED FILE STRUCTURE & MODIFICATIONS

### Phase 1: Create the Data Pipeline

#### File 1: `/data/dispensaries-config.js`
**Purpose**: Configuration for external data sources (Airtable, JSON APIs, web scrapers)

```javascript
/**
 * Dispensary Directory Data Configuration
 * Centralized source definitions for cannabis dispensaries in Southern NM
 * 
 * Supports: Airtable API, JSON endpoints, CSV files
 * Caching: localStorage with TTL (1 hour default)
 */

const DISPENSARY_SOURCES = {
  airtable: {
    enabled: true,
    baseId: 'YOUR_AIRTABLE_BASE_ID',           // From environment or config
    tableId: 'YOUR_TABLE_ID',
    apiKey: 'YOUR_AIRTABLE_API_KEY',            // Store in environment, not in code
    url: 'https://api.airtable.com/v0/{baseId}/{tableId}',
    updateInterval: 3600000,                    // 1 hour
    fields: ['name', 'city', 'address', 'phone', 'hours', 'type', 'rating', 'url'],
    view: 'Grid view'                           // Airtable view name
  },
  
  fallbackJson: {
    enabled: true,
    url: '/data/dispensaries-fallback.json',
    updateInterval: 86400000,                   // 24 hours
    format: 'json'
  },
  
  webScraper: {
    enabled: false,                              // Backend-only if implemented
    provider: 'nmdoh',                          // New Mexico Department of Health
    url: 'https://nmdoh.cannabis.api/dispensaries'
  }
};

const CACHE_KEYS = {
  dispensaries: 'tgb:dispensaries:list',
  lastSync: 'tgb:dispensaries:lastSync',
  metadata: 'tgb:dispensaries:metadata'
};

const CACHE_TTL = {
  standard: 3600000,      // 1 hour
  extended: 86400000,     // 24 hours
  realtime: 300000        // 5 minutes
};
```

#### File 2: `/data/data-service.js`
**Purpose**: Handles all data fetching, caching, and transformation

```javascript
/**
 * Dispensary Data Service
 * Single source of truth for all dispensary data operations
 * 
 * Features:
 * - Multi-source data fetching with fallback
 * - Intelligent caching with TTL
 * - Data normalization and deduplication
 * - Error handling and offline mode
 */

class DispensaryDataService {
  constructor(config = DISPENSARY_SOURCES) {
    this.config = config;
    this.data = null;
    this.lastSync = null;
    this.isSyncing = false;
    this.listeners = [];  // Observer pattern for data changes
  }

  /**
   * Fetch dispensaries from source with fallback
   * @returns {Promise<Array>} Normalized dispensary array
   */
  async fetchDispensaries(forceRefresh = false) {
    // Check cache first
    const cached = this.getCachedData();
    if (cached && !forceRefresh) {
      console.log('📦 Using cached dispensary data');
      return cached;
    }

    if (this.isSyncing) {
      return this.data || [];
    }

    this.isSyncing = true;
    try {
      // Try Airtable first
      if (this.config.airtable.enabled) {
        console.log('🌐 Fetching from Airtable...');
        this.data = await this.fetchFromAirtable();
      }
      
      // Fallback to JSON
      if (!this.data && this.config.fallbackJson.enabled) {
        console.log('📄 Falling back to JSON...');
        this.data = await this.fetchFromJson();
      }

      if (this.data) {
        // Transform and validate
        this.data = this.normalizeDispensaries(this.data);
        this.data = this.deduplicateDispensaries(this.data);
        
        // Cache it
        this.setCachedData(this.data);
        this.lastSync = Date.now();
        
        // Notify listeners
        this.notifyListeners('data-updated', this.data);
      }
    } catch (error) {
      console.error('❌ Data fetch failed:', error);
      this.data = cached || [];
    } finally {
      this.isSyncing = false;
    }

    return this.data;
  }

  /**
   * Fetch from Airtable API
   * @private
   */
  async fetchFromAirtable() {
    const { baseId, tableId, apiKey, fields } = this.config.airtable;
    
    const params = new URLSearchParams({
      view: this.config.airtable.view,
      fields: fields.join(','),
      pageSize: 100
    });

    const response = await fetch(
      `https://api.airtable.com/v0/${baseId}/${tableId}?${params}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` }
      }
    );

    if (!response.ok) {
      throw new Error(`Airtable API error: ${response.status}`);
    }

    const { records } = await response.json();
    return records.map(r => r.fields);
  }

  /**
   * Fetch from fallback JSON endpoint
   * @private
   */
  async fetchFromJson() {
    const response = await fetch(this.config.fallbackJson.url);
    if (!response.ok) {
      throw new Error(`JSON fetch error: ${response.status}`);
    }
    return response.json();
  }

  /**
   * Normalize dispensary records to standard schema
   * @private
   */
  normalizeDispensaries(data) {
    return data.map(item => ({
      id: item.id || item.airtableId || this.generateId(item),
      name: item.name || item.dba || '',
      licensee: item.licensee || '',
      
      // Location
      city: item.city || item.addressLocality || '',
      address: item.address || item.streetAddress || '',
      phone: item.phone || item.telephone || '',
      website: item.website || item.url || '',
      
      // Hours & Status
      hours: item.hours || item.operatingHours || {},
      isOpen: item.isOpen !== undefined ? item.isOpen : true,
      
      // Classification
      type: item.type || 'retail',  // 'retail', 'wholesale', 'cultivation'
      
      // Metrics
      rating: parseFloat(item.rating) || 0,
      reviewCount: parseInt(item.reviewCount) || 0,
      
      // Compliance
      licenseNumber: item.licenseNumber || '',
      licenseExpiry: item.licenseExpiry || '',
      
      // Products
      hasAdultUse: item.hasAdultUse !== false,
      hasMedical: item.hasMedical !== false,
      hasConsumption: item.hasConsumption || false,
      
      // Metadata
      lastUpdated: item.lastUpdated || new Date().toISOString(),
      dataSource: item.dataSource || 'airtable'
    }));
  }

  /**
   * Deduplicate dispensaries by name + city
   * @private
   */
  deduplicateDispensaries(data) {
    const seen = new Set();
    return data.filter(item => {
      const key = `${item.name}|${item.city}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Cache management
   * @private
   */
  getCachedData() {
    try {
      const cached = localStorage.getItem(CACHE_KEYS.dispensaries);
      const lastSync = localStorage.getItem(CACHE_KEYS.lastSync);
      
      if (!cached || !lastSync) return null;
      
      const age = Date.now() - parseInt(lastSync);
      if (age > CACHE_KEYS.standard) return null;  // Cache expired
      
      return JSON.parse(cached);
    } catch (e) {
      return null;
    }
  }

  setCachedData(data) {
    try {
      localStorage.setItem(CACHE_KEYS.dispensaries, JSON.stringify(data));
      localStorage.setItem(CACHE_KEYS.lastSync, Date.now().toString());
    } catch (e) {
      console.warn('Cache storage failed:', e);
    }
  }

  /**
   * Observer pattern for reactive updates
   */
  subscribe(listener) {
    this.listeners.push(listener);
  }

  notifyListeners(event, data) {
    this.listeners.forEach(listener => listener(event, data));
  }

  /**
   * Utility: Generate unique ID
   * @private
   */
  generateId(item) {
    return `${item.name}-${item.city}`.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
  }
}

// Export as singleton
const dispensaryService = new DispensaryDataService(DISPENSARY_SOURCES);
```

#### File 3: `/data/dispensaries-fallback.json`
**Purpose**: Fallback data source in case Airtable is unavailable

```json
[
  {
    "id": "astro-buds-sunland-park",
    "name": "Astro Buds",
    "licensee": "ASTRO BUDS LLC",
    "city": "Sunland Park",
    "address": "1650 Appaloosa Dr",
    "phone": "(575) 425-2837",
    "website": "https://astrobudsnm.com/",
    "type": "retail",
    "hasAdultUse": true,
    "hasMedical": true,
    "hasConsumption": true,
    "rating": 4.8,
    "reviewCount": 149,
    "hours": {
      "monday": "09:00-22:00",
      "tuesday": "09:00-22:00",
      "wednesday": "09:00-22:00",
      "thursday": "09:00-22:00",
      "friday": "09:00-23:00",
      "saturday": "09:00-23:00",
      "sunday": "09:00-22:00"
    },
    "lastUpdated": "2026-05-29T00:00:00Z",
    "dataSource": "manual"
  }
]
```

### Phase 2: Create the Directory View

#### File 4: `/directory.html`
**Purpose**: Main dispensary directory with search, filter, and detail view

This file will:
- Import the data service and config
- Display dynamic grid of dispensaries
- Provide filters: city, type, hours (open now), rating
- Show detail modal on click
- Export filtered results as CSV
- Support localStorage for recent searches

#### File 5: `/assets/js/directory-ui.js`
**Purpose**: View layer for directory rendering

Contains functions:
- `renderDispensaryGrid(data, filters)` - Dynamic grid rendering
- `renderDispensaryDetail(id)` - Detail modal view
- `applyFilters(data, filters)` - Client-side filtering
- `handleSearch(query, data)` - Fuzzy search across dispensaries
- `exportToCSV(data)` - Export filtered results
- `getDistanceFromUser(address)` - Distance calculation (optional)

### Phase 3: Refactor Existing Pages

#### Update: `index.html`
**Changes**:
- Import `data-service.js` and `dispensaries-config.js`
- Add "View Full Directory" button linking to `/directory.html`
- Load featured dispensaries dynamically instead of hard-coding

#### Preserve: `data.html`
**Status**: Keep as-is for sales analytics (separate concern)

---

## DATA PIPELINE DIAGRAM

```
┌─────────────────────────────────────────────────┐
│         External Data Sources                    │
│  ┌──────────────┐    ┌──────────────┐           │
│  │  Airtable    │    │  JSON API    │           │
│  │  Base        │    │  /fallback   │           │
│  └──────────────┘    └──────────────┘           │
└────────┬─────────────────────────┬───────────────┘
         │                         │
         └────────┬────────────────┘
                  ↓
         ┌────────────────────────┐
         │ DispensaryDataService  │
         │                        │
         │ • Fetch from sources   │
         │ • Normalize schema     │
         │ • Deduplicate          │
         │ • Cache (localStorage) │
         └────────┬───────────────┘
                  ↓
         ┌────────────────────────┐
         │  In-Memory Data Store  │
         │  (JavaScript object)   │
         └────────┬───────────────┘
                  ↓
    ┌─────────────┴──────────────┐
    ↓                            ↓
┌──────────────┐         ┌──────────────┐
│ Directory UI │         │  Detail View │
│              │         │              │
│ • Grid       │         │ • Modal      │
│ • Search     │         │ • Map        │
│ • Filters    │         │ • Hours/Info │
└──────────────┘         └──────────────┘
```

---

## KEY INTEGRATION POINTS

### 1. **Load Data on Page Init**

In `directory.html` `<script>`:
```javascript
document.addEventListener('DOMContentLoaded', async () => {
  // Load dispensaries
  const dispensaries = await dispensaryService.fetchDispensaries();
  
  // Render initial view
  renderDispensaryGrid(dispensaries);
  
  // Setup listeners for real-time updates
  dispensaryService.subscribe((event, data) => {
    if (event === 'data-updated') {
      console.log('🔄 Data updated, refreshing view');
      renderDispensaryGrid(data);
    }
  });
});
```

### 2. **Handle User Filters**

```javascript
document.querySelectorAll('[data-filter]').forEach(element => {
  element.addEventListener('change', (e) => {
    const filters = {
      city: document.querySelector('[name="city"]').value,
      type: document.querySelector('[name="type"]').value,
      openNow: document.querySelector('[name="open-now"]').checked,
      minRating: document.querySelector('[name="rating"]').value
    };
    
    const filtered = applyFilters(dispensaryService.data, filters);
    renderDispensaryGrid(filtered);
  });
});
```

### 3. **Detail Page Generation**

Instead of static astro-buds.html, use dynamic modal:
```javascript
function openDispensaryDetail(id) {
  const dispensary = dispensaryService.data.find(d => d.id === id);
  if (!dispensary) return;
  
  renderDispensaryDetail(dispensary);
  showModal('#dispensary-modal');
}
```

---

## IMPLEMENTATION CHECKLIST

### Phase 1: Data Infrastructure (Week 1)
- [ ] Create `/data/dispensaries-config.js` with Airtable + JSON config
- [ ] Create `/data/data-service.js` with full data management
- [ ] Create `/data/dispensaries-fallback.json` with seed data
- [ ] Add localStorage cache support
- [ ] Test offline mode (use fallback JSON)

### Phase 2: Directory UI (Week 2)
- [ ] Create `/directory.html` with full layout
- [ ] Create `/assets/js/directory-ui.js` with rendering functions
- [ ] Implement grid view with responsive design (Tailwind)
- [ ] Implement search with fuzzy matching
- [ ] Implement filters: city, type, rating, hours
- [ ] Add detail modal with dispensary info

### Phase 3: Integration (Week 3)
- [ ] Update `index.html` to use data service
- [ ] Add "View Directory" link to homepage
- [ ] Test data sync with Airtable
- [ ] Test fallback behavior
- [ ] Add CSV export
- [ ] Update `robots.txt` and sitemap

### Phase 4: Deployment & Monitoring (Week 4)
- [ ] Deploy to production
- [ ] Add error tracking (Sentry or similar)
- [ ] Monitor API usage and cache hit rates
- [ ] Collect user feedback
- [ ] Document API configuration in .env.example

---

## ENVIRONMENT VARIABLES

Create `.env.local` (git-ignored):
```
VITE_AIRTABLE_BASE_ID=xxxxx
VITE_AIRTABLE_TABLE_ID=xxxxx
VITE_AIRTABLE_API_KEY=xxxxx
VITE_DATA_CACHE_TTL=3600000
VITE_FALLBACK_URL=/data/dispensaries-fallback.json
```

---

## ADVANTAGES OF THIS ARCHITECTURE

✅ **Modular**: Data layer completely separate from UI  
✅ **Resilient**: Automatic fallback to JSON if Airtable unavailable  
✅ **Scalable**: Easy to add new data sources (web scraper, NMDOH API, etc.)  
✅ **Offline-capable**: localStorage caching works when offline  
✅ **Low-latency**: In-memory store provides instant filtering  
✅ **No build step needed**: Works with vanilla HTML/JS  
✅ **SEO-friendly**: Static HTML with dynamic JS enhancement  
✅ **Developer experience**: Clear separation of concerns  

---

## FUTURE ENHANCEMENTS

1. **Advanced Features**:
   - Distance-based sorting (use user geolocation + haversine formula)
   - Opening hours calculation (is "open now")
   - Price comparison across dispensaries
   - Deal/promotion tracking (store in Airtable)
   - User reviews integration (Trustpilot, Google)

2. **Performance**:
   - Implement pagination for large result sets
   - Add service worker for offline mode
   - Compress cached data with LZMA

3. **Analytics**:
   - Track which dispensaries are searched most
   - A/B test filter layouts
   - Monitor Airtable sync failures
   - User search heatmap

4. **Automation**:
   - Scheduled CSV import from NMDOH
   - Auto-deduplicate on sync
   - Slack alerts for data anomalies
   - Auto-refresh every hour

---

## SUMMARY

**Current State**: Static site with embedded sales data in HTML  
**Target State**: Dynamic directory with modular data pipeline  
**Migration Path**: 3 new files + 3 updates + env config  
**Timeline**: 4 weeks for full implementation  
**Risk**: Low - completely additive, no breaking changes to existing pages  

This architecture keeps the lightweight, zero-build-system nature of your current setup while enabling real-time data synchronization from external sources.
