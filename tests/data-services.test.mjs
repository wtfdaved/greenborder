// ============================================
// SMOKE TESTS — Airtable sync + data service
// ============================================
// Run with: node tests/data-services.test.mjs
// No framework: plain assert + stubbed browser globals so the plain-script
// services (window.* singletons) can run under Node.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(root, p), 'utf8');

// --- Browser global stubs ---------------------------------------------------
const storage = new Map();
globalThis.window = globalThis;
globalThis.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k)
};

// Load the plain scripts (config + data-service share one scope so the
// `DISPENSARY_CONFIG` const resolves).
new Function(src('data/airtableSync.js'))();
new Function(src('data/dispensaries-config.js') + '\n' + src('data/data-service.js'))();

const makeRecords = (n, prefix = 'rec') =>
  Array.from({ length: n }, (_, i) => ({
    id: `${prefix}${i}`,
    fields: { 'Shop Name': `Shop ${prefix}${i}`, 'City': 'Sunland Park' }
  }));

const jsonResponse = (body) => ({ ok: true, status: 200, json: async () => body });

let passed = 0;
const test = async (name, fn) => {
  await fn();
  passed++;
  console.log(`✅ ${name}`);
};

// --- 1. Pagination + no fields param ----------------------------------------
await test('fetchFromAirtable paginates and sends no fields param', async () => {
  const urls = [];
  let call = 0;
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    call++;
    return call === 1
      ? jsonResponse({ records: makeRecords(100, 'a'), offset: 'recOFFSET123' })
      : jsonResponse({ records: makeRecords(5, 'b') });
  };

  window.airtableSync.setCredentials('key', 'base', 'table');
  const out = await window.airtableSync.fetchFromAirtable();

  assert.equal(out.length, 105, 'all pages merged');
  assert.equal(urls.length, 2, 'two pages fetched');
  assert.ok(urls[1].includes('offset=recOFFSET123'), 'second request carries offset');
  assert.ok(urls.every(u => !u.includes('fields')), 'no fields param sent');
  assert.equal(out[0].airtableId, 'a0');
});

// --- 2. Page cap --------------------------------------------------------------
await test('pagination stops at the 20-page safety cap', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return jsonResponse({ records: makeRecords(100, `p${calls}-`), offset: 'more' });
  };
  await window.airtableSync.fetchFromAirtable();
  assert.equal(calls, 20, 'exactly MAX_PAGES requests');
});

// --- 3. Field mapping completeness --------------------------------------------
await test('variant Airtable field names map to the internal schema', async () => {
  const [mapped] = window.airtableSync.mapAirtableRecords([{
    id: 'recX',
    fields: {
      'Shop Name': 'Mango Cannabis',
      'Street Address': '123 McNutt Rd',
      'Zip': '88063',
      'Map Link': 'https://maps.example/x',
      'Tags': ['late-night', 'drive-thru'],
      'Dutchie': 'https://dutchie.example/mango',
      'City': 'Sunland Park'
    }
  }]);

  assert.equal(mapped.address, '123 McNutt Rd');
  assert.equal(mapped.zipCode, '88063');
  assert.equal(mapped.mapLink, 'https://maps.example/x');
  assert.deepEqual(mapped.tags, ['late-night', 'drive-thru']);
  assert.equal(mapped.menuUrl, 'https://dutchie.example/mango');
});

// --- 4. search() ---------------------------------------------------------------
await test('search matches formatted phones, multi-word, and zip', () => {
  const svc = window.dispensaryService;
  svc.data = [
    { name: 'Mango Cannabis', city: 'Sunland Park', address: '123 McNutt Rd', zipCode: '88063', phone: '(575) 425-2837', tags: [], description: '' },
    { name: 'Astro Buds', city: 'Chaparral', address: '456 War Rd', zipCode: '88081', phone: '575-111-2222', tags: ['24-hour'], description: 'Open all night' },
    { name: 'Desert Leaf', city: 'Anthony', address: '789 Main St', zipCode: '88021', phone: '', tags: [], description: '' }
  ];

  assert.equal(svc.search('575-425-2837').length, 1, 'dashed phone matches parenthesized phone');
  assert.equal(svc.search('575-425-2837')[0].name, 'Mango Cannabis');
  assert.equal(svc.search('5754252837').length, 1, 'bare digits match too');
  assert.equal(svc.search('mango sunland').length, 1, 'multi-word AND across fields');
  assert.equal(svc.search('88063').length, 1, 'zip code is searchable');
  assert.equal(svc.search('night').length, 1, 'description is searchable');
  assert.equal(svc.search('zzzznope').length, 0, 'nonsense matches nothing');
  assert.equal(svc.search('').length, 3, 'empty query returns everything');
});

// --- 5. Cache bypass when seed cached but live source configured ----------------
await test('load() bypasses cached seed data when Airtable is configured', async () => {
  const svc = window.dispensaryService;
  const seed = [{ id: 'sunland-park-old', name: 'Old Seed Shop', city: 'Sunland Park', dataSource: 'seed' }];
  storage.set(svc.config.cache.keys.data, JSON.stringify(seed));
  storage.set(svc.config.cache.keys.lastSync, String(Date.now()));

  // Live source configured + returns fresh internal-schema records.
  window.airtableSync = {
    getStatus: () => ({ initialized: true }),
    sync: async () => [{
      airtableId: 'recNew', id: 'sunland-park-fresh', name: 'Fresh Airtable Shop',
      city: 'Sunland Park', dataSource: 'airtable', tags: []
    }]
  };

  svc.data = [];
  const out = await svc.load();

  assert.equal(out.length, 1);
  assert.equal(out[0].name, 'Fresh Airtable Shop', 'seed cache was bypassed');
  assert.equal(out[0].dataSource, 'airtable');
  assert.equal(svc.getDataSourceInfo().source, 'airtable');
  assert.equal(svc.getDataSourceInfo().fromCache, false);
});

console.log(`\n${passed}/5 tests passed`);
