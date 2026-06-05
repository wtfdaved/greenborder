// ============================================
// AIRTABLE DATA SYNC SERVICE
// ============================================
// Specialized integration for Airtable API with field mapping
// Maintains JSON fallback for rate limits and API failures

class AirtableSyncService {
  constructor() {
    this.apiKey = null;
    this.baseId = null;
    this.tableId = null;
    this.fields = [];
    this.lastSyncTime = null;
    this.syncInProgress = false;
    this.fallbackData = null;

    // Field mapping: Airtable field → Internal schema
    this.fieldMapping = {
      'Shop Name': 'name',
      'Business Name': 'name',
      'Dispensary Name': 'name',
      'DBA': 'name',

      'Address': 'address',
      'Street Address': 'address',

      'City': 'city',
      'Postal Code': 'zipCode',
      'Zip': 'zipCode',

      'Phone': 'phone',
      'Telephone': 'phone',

      'Website': 'website',
      'Web': 'website',
      'URL': 'website',

      'Deals/Coupons': 'deals',
      'Coupons': 'deals',
      'Special Offers': 'deals',

      'Logo URL': 'logoUrl',
      'Logo': 'logoUrl',
      'Image URL': 'logoUrl',

      'Map Link': 'mapLink',
      'Google Maps': 'mapLink',
      'Maps Link': 'mapLink',
      'Directions': 'mapLink',

      'Hours': 'hours',
      'Business Hours': 'hours',
      'Store Hours': 'hours',

      'Email': 'email',
      'Email Address': 'email',

      'Instagram': 'instagram',
      'IG': 'instagram',
      'Instagram URL': 'instagram',

      'Facebook': 'facebook',
      'FB': 'facebook',
      'Facebook URL': 'facebook',

      'Menu': 'menuUrl',
      'Online Menu': 'menuUrl',
      'Order Online': 'menuUrl',
      'Menu Link': 'menuUrl',
      'Order Link': 'menuUrl',
      'Dutchie': 'menuUrl',
      'Weedmaps': 'menuUrl',

      'License Number': 'licenseNumber',
      'License #': 'licenseNumber',
      'License': 'licenseNumber',

      'Description': 'description',
      'About': 'description',
      'Bio': 'description',

      'Tags': 'tags',
      'Amenities': 'tags',
      'Features': 'tags',

      'isPremium': 'isPremium',
      'Premium': 'isPremium',
      'Featured': 'isPremium',
      'Is Premium': 'isPremium',

      'Type': 'type',
      'Dispensary Type': 'type',
      'License Type': 'type',

      'Rating': 'rating',
      'Review Count': 'reviewCount',

      'Adult Use': 'hasAdultUse',
      'Medical': 'hasMedical',
      'Consumption': 'hasConsumption'
    };
  }

  /**
   * Initialize with Airtable credentials
   * Can be set via environment variables or config
   */
  initialize(config = {}) {
    this.apiKey = config.apiKey || this.getApiKeyFromEnv();
    this.baseId = config.baseId || this.getBaseIdFromEnv();
    this.tableId = config.tableId || this.getTableIdFromEnv();
    this.fields = config.fields || this.getDefaultFields();

    if (this.apiKey && this.baseId && this.tableId) {
      console.log('✅ Airtable sync initialized');
      return true;
    }

    console.warn('⚠️ Airtable credentials incomplete - will use JSON fallback');
    return false;
  }

  /**
   * Main sync method: Fetch from Airtable with JSON fallback
   * @returns {Promise<Array>} Normalized dispensary records
   */
  async sync() {
    if (this.syncInProgress) {
      console.log('⏳ Sync already in progress...');
      return this.fallbackData || [];
    }

    this.syncInProgress = true;

    try {
      // Try Airtable first if configured
      if (this.apiKey && this.baseId && this.tableId) {
        console.log('🌐 Fetching from Airtable...');
        const data = await this.fetchFromAirtable();

        if (data && data.length > 0) {
          this.lastSyncTime = new Date();
          this.fallbackData = data;
          console.log(`✅ Synced ${data.length} records from Airtable`);
          return data;
        }
      }

      // Fall back to JSON
      console.log('📄 Falling back to JSON...');
      const jsonData = await this.fetchFromJson();
      this.fallbackData = jsonData;
      return jsonData;

    } catch (error) {
      console.error('❌ Sync failed:', error.message);

      // Return cached fallback if available
      if (this.fallbackData) {
        console.log('⚠️ Using cached fallback data');
        return this.fallbackData;
      }

      throw error;

    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Fetch data from Airtable API
   * Maps Airtable fields to internal schema
   * @private
   */
  async fetchFromAirtable() {
    const url = `https://api.airtable.com/v0/${this.baseId}/${this.tableId}`;

    const params = new URLSearchParams({
      pageSize: 100,
      fields: this.fields.join(',')
    });

    const response = await fetch(`${url}?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    // Handle API errors
    if (response.status === 401) {
      throw new Error('Airtable API key invalid');
    }

    if (response.status === 429) {
      throw new Error('Airtable rate limit exceeded');
    }

    if (!response.ok) {
      throw new Error(`Airtable API error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();

    // Map Airtable records to internal schema
    return this.mapAirtableRecords(json.records || []);
  }

  /**
   * Fetch fallback JSON data
   * @private
   */
  async fetchFromJson() {
    const response = await fetch('/data/dispensaries-fallback.json');

    if (!response.ok) {
      throw new Error(`JSON fetch failed: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Map Airtable record structure to internal schema
   * Handles field name variations
   * @private
   */
  mapAirtableRecords(records) {
    return records.map(record => {
      const fields = record.fields || {};
      const mapped = {
        airtableId: record.id,
        id: this.generateId(fields)
      };

      // Map each Airtable field to internal schema
      Object.entries(fields).forEach(([airtableField, value]) => {
        const internalField = this.fieldMapping[airtableField];

        if (internalField) {
          mapped[internalField] = this.normalizeFieldValue(internalField, value);
        }
      });

      // Ensure required fields have defaults
      mapped.name = mapped.name || 'Unknown Dispensary';
      mapped.city = mapped.city || 'Unknown';
      mapped.address = mapped.address || '';
      mapped.phone = mapped.phone || '';
      mapped.website = mapped.website || '';
      mapped.type = mapped.type || 'retail';
      mapped.rating = typeof mapped.rating === 'number' ? mapped.rating : 0;
      mapped.reviewCount = typeof mapped.reviewCount === 'number' ? mapped.reviewCount : 0;
      mapped.isPremium = Boolean(mapped.isPremium);
      mapped.hasAdultUse = Boolean(mapped.hasAdultUse);
      mapped.hasMedical = Boolean(mapped.hasMedical);
      mapped.hasConsumption = Boolean(mapped.hasConsumption);
      mapped.logoUrl = mapped.logoUrl || '';
      mapped.mapLink = mapped.mapLink || '';
      mapped.deals = mapped.deals || '';
      mapped.menuUrl = mapped.menuUrl || '';
      mapped.email = mapped.email || '';
      mapped.instagram = mapped.instagram || '';
      mapped.facebook = mapped.facebook || '';
      mapped.description = mapped.description || '';
      mapped.licenseNumber = mapped.licenseNumber || '';
      mapped.hours = mapped.hours || '';
      mapped.tags = Array.isArray(mapped.tags) ? mapped.tags : (mapped.tags ? [mapped.tags] : []);
      mapped.dataSource = 'airtable';
      mapped.lastUpdated = new Date().toISOString();

      return mapped;
    });
  }

  /**
   * Normalize field values based on field type
   * @private
   */
  normalizeFieldValue(fieldName, value) {
    if (value === null || value === undefined) {
      return fieldName.includes('is') || fieldName.includes('has') ? false : '';
    }

    // Handle boolean-like fields
    if (fieldName.includes('is') || fieldName.includes('has')) {
      return Boolean(value) || value === 'true' || value === 1 || value === true;
    }

    // Handle numeric fields
    if (fieldName === 'rating' || fieldName === 'reviewCount') {
      return parseFloat(value) || 0;
    }

    // Handle URL arrays (Airtable often returns attachments/links as array)
    if ((fieldName === 'logoUrl' || fieldName === 'mapLink' || fieldName === 'menuUrl') && Array.isArray(value)) {
      // Airtable attachments are objects with a .url property; plain links are strings
      const first = value[0];
      if (first && typeof first === 'object') return first.url || '';
      return first || '';
    }

    // Pass structured fields through untouched (hours object, tags multi-select array)
    if (fieldName === 'hours' && typeof value === 'object') return value;
    if (fieldName === 'tags') return Array.isArray(value) ? value : [value];

    // Convert to string for text fields
    return String(value).trim();
  }

  /**
   * Generate unique ID from dispensary info
   * @private
   */
  generateId(fields) {
    const name = (fields['Shop Name'] || fields['DBA'] || '').toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');

    const city = (fields['City'] || '').toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');

    return city ? `${city}-${name}` : name || 'unknown';
  }

  /**
   * Get API key from environment variables
   * Checks: window.ENV, process.env, or localStorage
   *
   * To configure:
   * 1. Development: Set window.ENV.AIRTABLE_API_KEY in browser console
   * 2. Production: Use environment variables in hosting (Netlify, Vercel, etc.)
   * 3. Backend: Inject via <script> tag before this file loads
   *
   * @private
   */
  getApiKeyFromEnv() {
    return (
      (typeof window !== 'undefined' && window.ENV?.AIRTABLE_API_KEY) ||
      (typeof process !== 'undefined' && process.env.AIRTABLE_API_KEY) ||
      localStorage.getItem('AIRTABLE_API_KEY') ||
      ''
    );
  }

  /**
   * Get base ID from environment variables
   * Checks: window.ENV, process.env, or localStorage
   * @private
   */
  getBaseIdFromEnv() {
    return (
      (typeof window !== 'undefined' && window.ENV?.AIRTABLE_BASE_ID) ||
      (typeof process !== 'undefined' && process.env.AIRTABLE_BASE_ID) ||
      localStorage.getItem('AIRTABLE_BASE_ID') ||
      ''
    );
  }

  /**
   * Get table ID from environment variables
   * Checks: window.ENV, process.env, or localStorage
   * @private
   */
  getTableIdFromEnv() {
    return (
      (typeof window !== 'undefined' && window.ENV?.AIRTABLE_TABLE_ID) ||
      (typeof process !== 'undefined' && process.env.AIRTABLE_TABLE_ID) ||
      localStorage.getItem('AIRTABLE_TABLE_ID') ||
      ''
    );
  }

  /**
   * Get default fields to fetch from Airtable
   * @private
   */
  getDefaultFields() {
    return [
      'Shop Name',
      'Address',
      'City',
      'Phone',
      'Website',
      'Deals/Coupons',
      'Logo URL',
      'Map Link',
      'isPremium',
      'Type',
      'Rating',
      'Review Count',
      'Adult Use',
      'Medical',
      'Consumption',
      'Hours',
      'Email',
      'Instagram',
      'Facebook',
      'Menu',
      'License Number',
      'Description',
      'Tags'
    ];
  }

  /**
   * Set API credentials (for runtime configuration)
   */
  setCredentials(apiKey, baseId, tableId) {
    this.apiKey = apiKey;
    this.baseId = baseId;
    this.tableId = tableId;
    console.log('✅ Airtable credentials updated');
  }

  /**
   * Add custom field mapping
   * Useful for handling variations in field names
   */
  addFieldMapping(airtableFieldName, internalFieldName) {
    this.fieldMapping[airtableFieldName] = internalFieldName;
    console.log(`✅ Field mapping added: ${airtableFieldName} → ${internalFieldName}`);
  }

  /**
   * Get sync status
   */
  getStatus() {
    return {
      initialized: Boolean(this.apiKey && this.baseId && this.tableId),
      lastSyncTime: this.lastSyncTime,
      syncInProgress: this.syncInProgress,
      fallbackAvailable: Boolean(this.fallbackData),
      recordCount: this.fallbackData?.length || 0
    };
  }

  /**
   * Clear cached fallback data
   */
  clearCache() {
    this.fallbackData = null;
    this.lastSyncTime = null;
    console.log('🗑️ Cache cleared');
  }
}

// Export as global singleton
window.airtableSync = new AirtableSyncService();
