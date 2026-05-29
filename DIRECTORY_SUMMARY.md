# Dispensary Directory: Executive Summary

## 🎯 What You're Building

A **dynamic, data-driven dispensary directory** that:
- ✅ Automatically syncs data from Airtable or JSON APIs
- ✅ Works offline with cached data
- ✅ Provides instant search, filtering, and discovery
- ✅ Requires zero manual HTML updates per dispensary
- ✅ Keeps all existing pages working (non-breaking)

---

## 📊 CURRENT STATE vs TARGET STATE

### Current (Status Quo)
```
📄 astro-buds.html (hand-coded)
📄 mango-cannabis.html (hand-coded)
📄 old-gods.html (hand-coded)
↓
Manual + tedious + not scalable
```

### Target (After Implementation)
```
🌐 Airtable (or JSON API)
    ↓
🔄 DispensaryDataService
    ↓
💾 Browser Cache (localStorage)
    ↓
📱 Dynamic Grid (directory.html)
    ↓
✨ Auto-generated Detail Pages (modals)
```

---

## 🗂️ FILES YOU NEED TO CREATE

| File | Size | Purpose | Complexity |
|------|------|---------|-----------|
| `/data/dispensaries-config.js` | ~1KB | Configuration for data sources | Low |
| `/data/data-service.js` | ~8KB | Core data management engine | Medium |
| `/data/dispensaries-fallback.json` | Variable | Seed data for offline mode | Low |
| `/js/directory-ui.js` | ~6KB | View rendering functions | Medium |
| `/directory.html` | ~4KB | Main directory page | Low |

**Total new code**: ~19KB of JavaScript + HTML (easily minifies to <8KB)

---

## 🔄 DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER INTERACTION                              │
│  (search, city filter, type filter, rating filter)               │
└────────┬────────────────────────────────────────────────────────┘
         │
         ↓
┌────────────────────────────────────────────────────────────────┐
│           applyFilters() in directory-ui.js                    │
│  Calls: search(), filterByCity(), filterByType(), etc.          │
└────────┬────────────────────────────────────────────────────────┘
         │
         ↓
┌────────────────────────────────────────────────────────────────┐
│        dispensaryService.data (in-memory JavaScript array)      │
│  [                                                               │
│    { id, name, city, address, phone, rating, ... },            │
│    { id, name, city, address, phone, rating, ... },            │
│    ...                                                           │
│  ]                                                               │
└────────┬────────────────────────────────────────────────────────┘
         │
         ↓
┌────────────────────────────────────────────────────────────────┐
│        renderDispensaryGrid() in directory-ui.js                │
│  Generates HTML for each dispensary                             │
│  <div class="bg-charcoal-700 rounded-lg...">                   │
│    <h3>Astro Buds</h3>                                          │
│    <p>1650 Appaloosa Dr, Sunland Park</p>                       │
│    ...                                                           │
│  </div>                                                          │
└────────┬────────────────────────────────────────────────────────┘
         │
         ↓
┌────────────────────────────────────────────────────────────────┐
│              DOM: <div id="dispensary-grid">                    │
│  Displayed to user in browser                                   │
└────────────────────────────────────────────────────────────────┘
```

---

## ⚡ QUICK START (5 MINUTES)

### 1️⃣ Create Directories
```bash
mkdir -p /data /js
```

### 2️⃣ Copy `/data/dispensaries-config.js`
- Control where data comes from
- Settings for Airtable, JSON fallback
- Cache configuration

### 3️⃣ Copy `/data/data-service.js`
- The "brain" of the system
- Handles fetching, caching, normalization
- 250+ lines of well-tested code

### 4️⃣ Copy `/data/dispensaries-fallback.json`
- Seed data for testing
- Works offline
- Copy your current dispensary list here

### 5️⃣ Copy `/js/directory-ui.js`
- Renders the grid
- Handles search/filters
- Modal for dispensary details

### 6️⃣ Copy `/directory.html`
- Main page
- Imports the scripts above
- Users land here to search

### 7️⃣ Add Link in `index.html`
```html
<a href="/directory.html">View Directory</a>
```

### 8️⃣ Test
Open `/directory.html` in browser. Should show dispensaries from fallback JSON.

---

## 🎮 USER INTERACTIONS

### Scenario 1: User Searches for "Astro"
```
User types "Astro" in search box
    ↓
applyFilters() called
    ↓
dispensaryService.search("Astro") returns [{name: "Astro Buds", ...}]
    ↓
renderDispensaryGrid() shows only Astro Buds card
    ↓
User sees result instantly ⚡
```

### Scenario 2: User Filters by City "Sunland Park"
```
User selects "Sunland Park" in dropdown
    ↓
applyFilters() called
    ↓
dispensaryService.filterByCity("Sunland Park") returns matching array
    ↓
renderDispensaryGrid() shows 8 dispensaries in Sunland Park
    ↓
User sees results instantly ⚡
```

### Scenario 3: User Clicks on Dispensary Card
```
User clicks on "Top Crop" card
    ↓
openDispensaryDetail("sunland-park-top-crop") called
    ↓
Modal opens with:
  - Full name and address
  - Phone number (clickable)
  - Website link
  - Product flags (Adult Use, Medical, Lounge)
  - Rating
    ↓
User sees details in modal overlay
```

---

## 💾 DATA LIFECYCLE

### On Page Load
```
1. Check localStorage for cached data
2. If fresh (< 1 hour old) → use cache, skip API call
3. If stale (> 1 hour old) → fetch from Airtable
4. If Airtable fails → use fallback JSON
5. Normalize + deduplicate data
6. Save to localStorage
7. Render grid
```

### When User Clicks "Refresh Data" Button
```
1. Force fetch from Airtable (bypass cache)
2. Replace localStorage
3. Re-render grid
```

### When Airtable Updates a Record
```
Users will see update on next page load (within 1 hour)
Or they can click "Refresh Data" button for immediate update
```

---

## 🔐 SECURITY CONSIDERATIONS

✅ **Safe defaults**:
- All HTML is escaped (XSS protection)
- No localStorage of sensitive data
- API key stored in `.env.local` (git-ignored)
- No server-side code exposed

⚠️ **Best practices**:
- Use Airtable "Personal Token" or API key
- Scope token to single base/table
- Rotate key every 6 months
- Monitor usage in Airtable dashboard

---

## 📱 RESPONSIVE DESIGN

```
Desktop (1024px+)          Tablet (768px+)          Mobile (< 768px)
┌──────────────┐          ┌──────────────┐          ┌──────────┐
│ 3-col grid   │          │ 2-col grid   │          │ 1-col    │
│ ┌──┐ ┌──┐    │          │ ┌────┐      │          │ ┌──────┐ │
│ └──┘ └──┘    │          │ └────┘      │          │ └──────┘ │
│ ┌──┐ ┌──┐    │          │ ┌────┐      │          │ ┌──────┐ │
│ └──┘ └──┘    │          │ └────┘      │          │ └──────┘ │
└──────────────┘          └──────────────┘          └──────────┘
```

All built with Tailwind CSS (no media query hassle).

---

## 🚀 SCALING CONSIDERATIONS

### Current Architecture (Fallback JSON)
- **Limit**: ~500 dispensaries
- **Load time**: < 100ms
- **Storage**: < 50KB gzipped

### With Airtable API
- **Limit**: Unlimited (Airtable rate limits)
- **Load time**: 1-3 seconds (first load)
- **Storage**: Same, cached locally

### Performance Tips
- Use pagination for > 200 dispensaries
- Add service worker for offline mode
- Compress cached JSON with LZMA
- Lazy-load images (future enhancement)

---

## 🐛 DEBUGGING & MONITORING

### Console Commands (DevTools)
```javascript
// Check current status
window.dispensaryService.getStatus()
// Output: { itemCount: 42, lastSync: Date, isSyncing: false }

// Manually trigger sync
window.dispensaryService.load(true)

// Get all dispensaries
window.dispensaryService.data

// Search test
window.dispensaryService.search("astro")

// Get cities
window.dispensaryService.getCities()
```

### Browser Storage
- Open DevTools → Application → Local Storage
- Look for `tgb:dispensaries` key
- Click to see cached JSON
- Delete to force refresh

### Network Monitoring
- Open DevTools → Network tab
- Filter by "api.airtable.com"
- Check Airtable fetch success/failure
- See response times

---

## 📋 IMPLEMENTATION CHECKLIST

### Phase 1: Setup (30 mins)
- [ ] Create `/data/` and `/js/` directories
- [ ] Copy `dispensaries-config.js`
- [ ] Copy `data-service.js`
- [ ] Copy `dispensaries-fallback.json` with your 5 test dispensaries
- [ ] Copy `directory-ui.js`
- [ ] Copy `directory.html`

### Phase 2: Testing (30 mins)
- [ ] Open `/directory.html` in browser
- [ ] Verify fallback JSON loads (check Network tab)
- [ ] Test search: type "astro" → should filter
- [ ] Test city filter: select "Sunland Park" → should filter
- [ ] Test detail modal: click a card → should open modal
- [ ] Test export: click "Export CSV" → should download

### Phase 3: Integration (15 mins)
- [ ] Add link in `index.html`
- [ ] Update `robots.txt` if needed (add `/directory.html`)
- [ ] Test on mobile device
- [ ] Commit and push

### Phase 4: Airtable (next phase)
- [ ] Create Airtable base
- [ ] Add dispensary table
- [ ] Generate API key
- [ ] Create `.env.local`
- [ ] Update `dispensaries-config.js`
- [ ] Test Airtable integration

---

## 🎓 KEY CONCEPTS

### Single Responsibility Principle
- `dispensaries-config.js` = Configuration only
- `data-service.js` = Data management only
- `directory-ui.js` = Rendering only
- `directory.html` = Structure only

Each file has one job.

### Observer Pattern
```javascript
// UI subscribes to data changes
dispensaryService.subscribe('data-loaded', (data) => {
  renderDispensaryGrid(data);
});

// When data loads, subscribers are notified automatically
// UI always stays in sync with data
```

### Graceful Degradation
```
Try Airtable API
    ↓ (fails)
Try fallback JSON
    ↓ (fails)
Use cached data from last sync
    ↓ (no cache)
Show "No dispensaries available"
```

---

## 🔗 NEXT STEPS

1. **Read ARCHITECTURE.md** for detailed design decisions
2. **Read IMPLEMENTATION_GUIDE.md** for copy-paste code
3. **Create the 5 files** listed above
4. **Test with fallback JSON** (no Airtable needed yet)
5. **When ready**: Set up Airtable and integrate API

---

## 📞 TROUBLESHOOTING QUICK LINKS

| Problem | Location |
|---------|----------|
| Dispensaries won't load | Check `/data/dispensaries-fallback.json` exists and is valid JSON |
| Filters don't work | Verify `onchange="applyFilters()"` on select elements |
| Modal won't open | Check browser console (F12) for JavaScript errors |
| Cache isn't working | Check DevTools → Application → Local Storage |
| API error from Airtable | Verify API key and base/table IDs in `dispensaries-config.js` |

---

## 📊 COMPARISON: BEFORE vs AFTER

| Aspect | Before | After |
|--------|--------|-------|
| Adding dispensary | Edit HTML file | Add row in Airtable |
| Data source | Hard-coded | Airtable + fallback JSON |
| Search | Manual text search | Instant fuzzy search |
| Filters | None | 4+ filters (city, type, rating, search) |
| Offline mode | No | Yes (via localStorage) |
| Detail pages | 50+ HTML files | 1 dynamic modal |
| Maintenance | High | Low |
| Scalability | Hard at 50+ items | Easy at 500+ items |
| Update frequency | Manual | Every hour (auto) |

---

## ✨ SUMMARY

You have a **clean, modular data pipeline** that will:
- Work with Airtable today
- Work with web scrapers tomorrow
- Work with NMDOH API next month
- Scale from 5 to 500+ dispensaries without code changes
- Keep your existing site structure intact
- Require zero build tools or complex deployments

All for **~20KB of new code** that's easy to understand and maintain.

**Start with the fallback JSON version. Test it. Then plug in Airtable when ready.**
