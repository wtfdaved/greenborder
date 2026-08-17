# GreenBorder Directory: Complete File Reference

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


Complete map of all files - what exists, what's new, what changes.

---

## 📁 CURRENT STRUCTURE (BEFORE)

```
greenborder/
├── index.html                    ← Homepage (keep as-is)
├── data.html                     ← Sales dashboard (keep as-is)
├── astro-buds.html               ← Dispensary detail (hand-coded)
├── mango-cannabis.html           ← Dispensary detail (hand-coded)
├── old-gods.html                 ← Dispensary detail (hand-coded)
├── partnerships.html             ← Static page (keep as-is)
├── news.html                     ← News page (keep as-is)
│
├── sales-data-2026.js            ← Sales data (keep as-is)
├── dba-matcher.js                ← Sales helper (keep as-is)
├── process-sales-data.js         ← Sales helper (keep as-is)
│
├── csv/                          ← Sales CSVs (keep as-is)
│   ├── jan_2026.csv
│   └── feb_2026.csv
│
├── education/                    ← Education pages (keep as-is)
└── articles/                     ← News articles (keep as-is)
```

**Problem**: Each dispensary needs its own HTML file. Non-scalable.

---

## 📁 NEW STRUCTURE (AFTER)

```
greenborder/
│
├── index.html                    ← MODIFIED: Add link to directory
├── data.html                     ← UNCHANGED
├── directory.html                ← NEW: Main directory page
│
├── astro-buds.html               ← KEEP (optional, for legacy)
├── mango-cannabis.html           ← KEEP (optional, for legacy)
├── old-gods.html                 ← KEEP (optional, for legacy)
│
├── data/                         ← NEW FOLDER
│   ├── dispensaries-config.js    ← NEW: Data source config
│   ├── data-service.js           ← NEW: Core data engine
│   └── dispensaries-fallback.json ← NEW: Seed data
│
├── js/                           ← NEW FOLDER
│   └── directory-ui.js           ← NEW: View rendering
│
├── sales-data-2026.js            ← UNCHANGED
├── dba-matcher.js                ← UNCHANGED
├── process-sales-data.js         ← UNCHANGED
│
├── csv/                          ← UNCHANGED
├── education/                    ← UNCHANGED
└── articles/                     ← UNCHANGED
```

**Result**: Scalable. Single source of truth (Airtable). Dynamic pages.

---

## 🔧 FILES TO CREATE

### 1. `/data/dispensaries-config.js`

**Line count**: ~50 lines  
**Purpose**: Configuration for data sources

```
What it contains:
- Airtable connection details
- JSON fallback URL
- Cache settings
- Feature flags
```

**When to use**: Never edit during normal operation. Only change if:
- Switching from Airtable to different API
- Changing cache duration
- Enabling/disabling features

---

### 2. `/data/data-service.js`

**Line count**: ~380 lines  
**Purpose**: Core data engine - the "brain" of the system

```
What it does:
- Fetches from Airtable or JSON
- Normalizes data to standard schema
- Deduplicates dispensaries
- Manages browser cache (localStorage)
- Provides search/filter methods
- Notifies UI of updates (observer pattern)

What it exposes:
- async load(forceRefresh)  → loads all dispensaries
- search(query)             → fuzzy search
- filterByCity(city)        → filter by location
- filterByType(type)        → filter by type
- getById(id)               → get single dispensary
- getCities()               → list all cities
- subscribe(event, fn)      → listen for updates
- getStatus()               → debug info

How to use:
  await dispensaryService.load()
  const results = dispensaryService.search("astro")
  dispensaryService.subscribe('data-loaded', (data) => {
    console.log("Data updated:", data)
  })
```

---

### 3. `/data/dispensaries-fallback.json`

**Content**: JSON array of dispensary objects  
**Purpose**: Offline data, testing, fallback if Airtable fails

```json
[
  {
    "id": "sunland-park-astro-buds",
    "name": "Astro Buds",
    "city": "Sunland Park",
    "address": "1650 Appaloosa Dr",
    "phone": "(575) 425-2837",
    "website": "https://astrobudsnm.com/",
    "rating": 4.8,
    "reviewCount": 149,
    "type": "retail",
    "hasAdultUse": true,
    "hasMedical": true,
    "hasConsumption": true
  }
  // ... more dispensaries
]
```

**Where it comes from**: You populate this with your current dispensaries  
**How to create**: Copy your dispensary list into JSON format, or:
1. Go to Airtable
2. Export as CSV
3. Use CSV-to-JSON converter
4. Paste into this file

---

### 4. `/js/directory-ui.js`

**Line count**: ~250 lines  
**Purpose**: View rendering and user interaction

```
What it does:
- renderDispensaryGrid(dispensaries)    → render card grid
- openDispensaryDetail(id)              → show modal
- closeDispensaryModal()                → close modal
- applyFilters()                        → apply all active filters
- populateCityFilter()                  → populate dropdown
- exportToCSV()                         → download CSV
- escapeHtml(text)                      → prevent XSS

How to use:
  renderDispensaryGrid(dispensaryService.data)
  openDispensaryDetail("sunland-park-astro-buds")
  applyFilters()  // respects all current filter selections
```

---

### 5. `/directory.html`

**Line count**: ~200 lines  
**Purpose**: Main directory page users visit

```html
Structure:
- Header with title
- Filters section (search, city, type, rating)
- Action buttons (Export CSV, Refresh)
- Dispensary grid (3-column responsive)
- Detail modal (hidden by default)

Scripts loaded:
- Tailwind CSS (styling)
- dispensaries-config.js (settings)
- data-service.js (data engine)
- directory-ui.js (rendering)
- Inline <script> (initialization)

User flow:
1. Page loads → dispensaryService.load() called
2. Data loaded → populateCityFilter() populates dropdown
3. renderDispensaryGrid() displays cards
4. User interacts → applyFilters() called
5. Results update in real-time
```

---

## ✏️ FILES TO MODIFY

### `index.html`

**What to change**: Add link to directory

**Current** (locate this section):
```html
<!-- Featured Dispensaries -->
<section class="featured-dispensaries">
  <!-- Currently shows 3-4 hand-coded dispensaries -->
</section>
```

**Add below it**:
```html
<section class="mt-12 text-center">
  <h2 class="text-3xl font-bold text-emerald-400 mb-4">Full Dispensary Directory</h2>
  <p class="text-gray-400 mb-8">Browse our complete directory of Southern NM dispensaries</p>
  <a href="/directory.html" class="inline-block px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition">
    🌿 Explore Directory
  </a>
</section>
```

**That's it.** No other changes needed to index.html.

---

### `data.html`

**What to change**: NOTHING

Keep as-is. The sales dashboard is a separate concern. It lives in its own world with its own data (sales-data-2026.js).

---

## 🚫 FILES TO KEEP AS-IS

These files continue to work exactly as before:

```
✓ astro-buds.html              (optional, can remove later)
✓ mango-cannabis.html          (optional, can remove later)
✓ old-gods.html                (optional, can remove later)
✓ partnerships.html            (marketing page)
✓ news.html                    (news page)
✓ sales-data-2026.js           (sales analytics)
✓ dba-matcher.js               (sales helper)
✓ process-sales-data.js        (sales helper)
✓ csv/                         (sales data)
✓ education/                   (education pages)
✓ articles/                    (news articles)
```

**No breaking changes.** Everything coexists peacefully.

---

## 📂 DIRECTORY STRUCTURE TO CREATE

```bash
# Create these folders if they don't exist
mkdir -p data
mkdir -p js

# Verify
ls -la data/
ls -la js/
```

---

## 🎯 FILE DEPENDENCIES

```
directory.html
    ├── Imports: dispensaries-config.js
    ├── Imports: data-service.js
    ├── Imports: directory-ui.js
    └── Calls: dispensaryService.load()

data-service.js
    ├── Imports: dispensaries-config.js (DISPENSARY_CONFIG)
    ├── Fetches: api.airtable.com (if enabled)
    ├── Fetches: /data/dispensaries-fallback.json (fallback)
    └── Uses: localStorage (browser storage)

directory-ui.js
    ├── Calls: dispensaryService.search()
    ├── Calls: dispensaryService.filterBy*()
    ├── Renders: HTML to #dispensary-grid
    └── Shows: #dispensary-modal

dispensaries-config.js
    └── Exports: DISPENSARY_CONFIG (used by data-service.js)

dispensaries-fallback.json
    └── Loaded by: data-service.js (if Airtable fails)
```

---

## 🔄 DATA FLOW WITH FILES

```
dispensaries-fallback.json
        ↓ (or Airtable API)
data-service.js (fetch, normalize, cache)
        ↓
dispensaryService.data (in-memory array)
        ↓
directory-ui.js (render functions)
        ↓
directory.html (display to user)
        ↓
User sees: Searchable grid of dispensaries
```

---

## 📋 IMPLEMENTATION CHECKLIST

### Create These 5 Files
- [ ] `/data/dispensaries-config.js` — Copy from IMPLEMENTATION_GUIDE.md
- [ ] `/data/data-service.js` — Copy from IMPLEMENTATION_GUIDE.md
- [ ] `/data/dispensaries-fallback.json` — Create with your dispensaries
- [ ] `/js/directory-ui.js` — Copy from IMPLEMENTATION_GUIDE.md
- [ ] `/directory.html` — Copy from IMPLEMENTATION_GUIDE.md

### Modify This 1 File
- [ ] `index.html` — Add link to `/directory.html`

### Test
- [ ] Open `/directory.html` in browser
- [ ] Verify fallback JSON loads
- [ ] Test search, filters, modal
- [ ] Check DevTools console for errors

### Commit & Push
- [ ] `git add .`
- [ ] `git commit -m "feat: add dynamic dispensary directory"`
- [ ] `git push origin claude/greenborder-cannabis-directory-iICk7`

---

## 🎓 UNDERSTANDING THE ARCHITECTURE

### The Problem (Before)
```
astro-buds.html — 903 lines of HTML (mostly duplicate)
mango-cannabis.html — 903 lines of HTML (mostly duplicate)
old-gods.html — 903 lines of HTML (mostly duplicate)

Want to add 20 more dispensaries?
→ Need 20 more HTML files
→ Nightmare to maintain
→ Can't sync with external data sources
```

### The Solution (After)
```
directory.html — 200 lines of HTML (one template)
data-service.js — 380 lines (data management)
directory-ui.js — 250 lines (rendering logic)
dispensaries-fallback.json — JSON array (data)

Want to add 20 more dispensaries?
→ Add row in Airtable
→ Done. No code changes.
→ Can sync automatically
```

---

## 💡 KEY FILES EXPLAINED

### Why `dispensaries-config.js`?
- **Centralized settings**: All configuration in one place
- **Easy switching**: Change data source without touching code
- **Environment-aware**: Can load from environment variables
- **Feature flags**: Enable/disable features per deployment

### Why `data-service.js`?
- **Single responsibility**: Only handles data operations
- **Reusable**: Can be imported into multiple pages
- **Testable**: Business logic separated from UI
- **Caching smart**: Automatic fallback and offline support
- **Observer pattern**: UI stays in sync automatically

### Why `directory-ui.js`?
- **Rendering isolated**: Pure rendering logic
- **Event handlers**: All UI interactions in one file
- **Templating**: Generate HTML dynamically
- **Filtering**: All filter logic in one place

### Why separate `directory.html`?
- **Keeps concerns separate**: Structure (HTML) vs logic (JS)
- **Easy to customize**: Style/layout without touching JS
- **Fast to iterate**: Change UI without risking data logic
- **SEO friendly**: Search engines see the structure

---

## 🔌 PLUGIN ARCHITECTURE

The beauty of this design: **Easy to plug in new data sources**

### Today: Fallback JSON
```
dispensaries-fallback.json → data-service.js → UI
```

### Tomorrow: Airtable
```
Airtable API → data-service.js → UI
(just update config & apiKey, code stays the same)
```

### Next: Web Scraper
```
NMDOH Website → scraper → JSON → data-service.js → UI
(add new fetch method, wire it up in config)
```

### Next: Google Sheets
```
Google Sheets API → data-service.js → UI
(add new fetch method, same normalization)
```

---

## 🚀 DEPLOYMENT NOTES

### GitHub Pages
```
Push all files to GitHub
No build step needed
Files served directly
```

### Environment Variables
- Store API keys in `.env.local` (git-ignored)
- In `dispensaries-config.js`, reference them:
  ```javascript
  apiKey: import.meta.env.VITE_AIRTABLE_API_KEY || ''
  ```
- GitHub Actions can inject via secrets

### Caching
- Browser caches to localStorage automatically
- 1 hour TTL by default
- User can force refresh via button

---

## ✅ VERIFICATION CHECKLIST

After creating all files:

```bash
# Check files exist
ls -la /data/dispensaries-config.js
ls -la /data/data-service.js
ls -la /data/dispensaries-fallback.json
ls -la /js/directory-ui.js
ls -la /directory.html

# Check syntax (open in browser)
open http://localhost:8000/directory.html

# Check console (F12)
# Should see: "📊 Loading dispensary data..."
# Then: "✅ Loaded X dispensaries from fallback JSON"
```

---

## 📞 SUPPORT

| Issue | Check |
|-------|-------|
| Dispensaries don't show | Check `/data/dispensaries-fallback.json` is valid JSON |
| Fallback not loading | Check DevTools Network tab → `/data/dispensaries-fallback.json` |
| Filters don't work | Check `onchange="applyFilters()"` on selects |
| Modal won't open | Check browser console (F12) for errors |
| Cache not working | Open DevTools → Application → Local Storage |

---

## 🎉 SUMMARY

| Aspect | Count |
|--------|-------|
| Files to CREATE | 5 |
| Files to MODIFY | 1 |
| Files to KEEP | 20+ |
| Lines of new code | ~900 |
| Build tools needed | 0 |
| Server needed | No |
| Breaking changes | 0 |

You're adding a powerful, modular data system without breaking anything.

**Total effort**: 1-2 hours start to finish.
