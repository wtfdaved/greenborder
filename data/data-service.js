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
