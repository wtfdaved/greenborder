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
    enabled: false,

    // From your Airtable base settings
    // To enable Airtable: set enabled: true and provide valid credentials
    // Credentials can come from:
    // 1. Environment variables: AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID, AIRTABLE_API_KEY
    // 2. This config (will be overridden by env vars)
    // 3. Airtable Sync Service initialization
    baseId: process.env.AIRTABLE_BASE_ID || '',
    tableId: process.env.AIRTABLE_TABLE_ID || '',
    apiKey: process.env.AIRTABLE_API_KEY || '',

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
      'hasConsumption',
      'isPremium',
      'logoUrl'
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
