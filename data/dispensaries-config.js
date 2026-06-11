// ============================================
// DISPENSARY DATA SOURCE CONFIGURATION
// ============================================

/**
 * Data source definitions for cannabis dispensaries
 * Supports Airtable, JSON APIs, and fallback JSON files
 */

// Browser-safe environment lookup. In the browser `process` does not exist, so
// reading `process.env.X` directly throws a ReferenceError and aborts this
// script (which previously left DISPENSARY_CONFIG undefined and broke the whole
// page). Prefer window.ENV (injected by the host) then process.env (build/SSR).
const ENV = (() => {
  try {
    if (typeof window !== 'undefined' && window.ENV) return window.ENV;
  } catch (e) { /* ignore */ }
  try {
    if (typeof process !== 'undefined' && process.env) return process.env;
  } catch (e) { /* ignore */ }
  return {};
})();

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
    baseId: ENV.AIRTABLE_BASE_ID || '',
    tableId: ENV.AIRTABLE_TABLE_ID || '',
    apiKey: ENV.AIRTABLE_API_KEY || '',

    // NOTE: view/fields below are no longer sent to the API — the fetch
    // requests all fields and relies on airtableSync's field mapping.
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
