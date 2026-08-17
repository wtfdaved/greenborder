# 🌿 Dynamic Dispensary Directory: START HERE

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


You're transitioning greenborder.org from a sales analytics dashboard to an **automated, data-driven dispensary directory** for Southern New Mexico cannabis users.

**Status**: Planning phase complete. Ready to implement.

---

## 📚 DOCUMENTATION ROADMAP

Read these in order:

### 1️⃣ **DIRECTORY_SUMMARY.md** (10 min read)
**Start here.** High-level overview:
- What you're building
- Current vs target state
- Key concepts
- User interactions
- Data flow diagram

👉 **Read this first if you want the big picture.**

---

### 2️⃣ **ARCHITECTURE.md** (15 min read)
**Deep dive.** Detailed technical design:
- Current architecture analysis
- File structure
- Data pipeline design
- Integration points
- Implementation checklist
- Advantages & future enhancements

👉 **Read this if you want to understand the "why" behind design decisions.**

---

### 3️⃣ **IMPLEMENTATION_GUIDE.md** (30 min read)
**Hands-on.** Copy-paste ready code:
- Step-by-step instructions
- Complete source code for all 5 files
- Airtable configuration guide
- Testing checklist
- Troubleshooting

👉 **Read this when you're ready to code. Everything you need is here.**

---

### 4️⃣ **FILES_REFERENCE.md** (5 min read)
**Quick reference.** File-by-file breakdown:
- Current folder structure (before)
- New folder structure (after)
- Each file explained
- Dependencies
- Deployment notes

👉 **Reference this while coding to understand where each piece goes.**

---

## ⚡ QUICK START (2 HOURS)

If you just want to get started without reading everything:

### Step 1: Create Folders (2 min)
```bash
mkdir -p /data /js
```

### Step 2: Copy Code (30 min)
Copy these 5 files from **IMPLEMENTATION_GUIDE.md**:
- [ ] `/data/dispensaries-config.js`
- [ ] `/data/data-service.js`
- [ ] `/data/dispensaries-fallback.json`
- [ ] `/js/directory-ui.js`
- [ ] `/directory.html`

### Step 3: Populate Seed Data (20 min)
Edit `/data/dispensaries-fallback.json` with your dispensary list:
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
  // Add your dispensaries here
]
```

### Step 4: Update Homepage (5 min)
Add to `index.html`:
```html
<a href="/directory.html">View Directory</a>
```

### Step 5: Test (15 min)
```bash
open /directory.html  # Open in browser
```

Should see dispensaries from fallback JSON. Try:
- [ ] Type "Astro" in search → filters results
- [ ] Select city filter → filters by location
- [ ] Click dispensary card → opens detail modal

### Step 6: Commit & Push (10 min)
```bash
git add data/ js/ directory.html
git commit -m "feat: add dynamic dispensary directory"
git push origin claude/greenborder-cannabis-directory-iICk7
```

---

## 🎯 WHAT YOU'RE BUILDING

**Before**: Hand-coded HTML files for each dispensary (not scalable)

**After**: 
```
Airtable (or JSON API)
    ↓
Data Service (fetch, normalize, cache)
    ↓
Browser (instant search, filter, offline)
    ↓
Users discover dispensaries
```

**Features**:
- ✅ Real-time sync from Airtable
- ✅ Instant search & filtering
- ✅ Works offline (cached)
- ✅ No build tools needed
- ✅ Non-breaking changes (all existing pages still work)

---

## 📊 CURRENT STATE

```
greenborder.org
├── Homepage (index.html) - Working ✓
├── Sales Dashboard (data.html) - Working ✓
├── Dispensary Pages
│   ├── astro-buds.html - Hand-coded
│   ├── mango-cannabis.html - Hand-coded
│   └── old-gods.html - Hand-coded
└── Other pages - Working ✓

Problem: Not scalable. Each dispensary needs its own HTML file.
```

---

## 🎯 TARGET STATE

```
greenborder.org
├── Homepage (index.html) - Updated with directory link
├── Sales Dashboard (data.html) - Unchanged
├── Dispensary Directory (directory.html) ← NEW
│   └── Powered by data-service.js ← NEW
│       └── Data from Airtable or fallback JSON
├── Old dispensary pages (astro-buds.html, etc.) - Can be removed
└── Other pages - Working ✓

Result: Scalable. Auto-synced. Dynamic pages.
```

---

## 💾 DATA FLOW

```
Step 1: User opens /directory.html
    ↓
Step 2: Page loads dispensaryService
    ↓
Step 3: Service checks: Is cache fresh?
    ├─ YES → Use cache (instant load)
    └─ NO → Fetch from Airtable or fallback JSON
    ↓
Step 4: Normalize & deduplicate data
    ↓
Step 5: Save to localStorage cache
    ↓
Step 6: Render grid of dispensaries
    ↓
Step 7: User interacts (search, filter)
    ↓
Step 8: UI updates in real-time (no page reload)
```

---

## 📁 FILES CREATED BY THIS PLAN

| File | Size | Purpose |
|------|------|---------|
| `/data/dispensaries-config.js` | 1 KB | Configuration |
| `/data/data-service.js` | 8 KB | Data engine |
| `/data/dispensaries-fallback.json` | Variable | Seed data |
| `/js/directory-ui.js` | 6 KB | View rendering |
| `/directory.html` | 4 KB | Main page |
| **Total** | **~19 KB** | **Minifies to <8 KB** |

---

## 🔐 SECURITY

✅ **By default secure**:
- No sensitive data in localStorage
- HTML escaping prevents XSS
- API key stored in `.env.local` (git-ignored)

⚠️ **Best practices**:
- Use Airtable API key, not full credentials
- Scope to single base/table
- Rotate key every 6 months

---

## 🚀 WHAT HAPPENS NEXT

### Phase 1: Fallback JSON (Now)
- Create the 5 files
- Test with local JSON data
- Works offline automatically

### Phase 2: Airtable Integration (Next)
- Create Airtable base
- Add dispensary table
- Generate API key
- Update config
- Test sync

### Phase 3: Advanced Features (Later)
- Distance-based sorting
- Deal tracking
- User reviews
- Auto-refresh schedule
- Analytics dashboard

---

## ❓ FAQ

**Q: Will this break existing pages?**  
A: No. Completely non-breaking. All existing pages work as-is.

**Q: Do I need a backend server?**  
A: No. Works entirely in the browser with Airtable API (optional).

**Q: What about SEO?**  
A: Excellent. Each dispensary is discoverable. Directory page is indexable.

**Q: Can I use different data sources?**  
A: Yes. Architecture supports Airtable, JSON, web scrapers, NMDOH API, etc.

**Q: How long does data refresh take?**  
A: First load: 1-3 seconds from Airtable. After that: instant from cache.

**Q: What if Airtable is down?**  
A: Falls back to JSON. Shows cached data. No data loss.

**Q: Can I customize the look?**  
A: Yes. Uses Tailwind CSS. Easy to modify colors, layout, fonts.

**Q: How many dispensaries can this handle?**  
A: ~500 before needing pagination. Scales easily beyond.

---

## 🎯 SUCCESS CRITERIA

After implementation, you should be able to:

- [ ] Open `/directory.html` and see all dispensaries
- [ ] Search by name ("Astro" → shows Astro Buds)
- [ ] Filter by city (dropdown shows all cities)
- [ ] Filter by type (retail, lounge, cultivation)
- [ ] Click dispensary card → opens detail modal
- [ ] Export filtered results as CSV
- [ ] Add new dispensary to Airtable → appears on site
- [ ] Works on mobile (responsive)
- [ ] Works offline (cached)
- [ ] Link on homepage points to directory

---

## 📞 SUPPORT

| Issue | Solution |
|-------|----------|
| Don't know where to start | Read **DIRECTORY_SUMMARY.md** |
| Want to understand the design | Read **ARCHITECTURE.md** |
| Ready to code | Use **IMPLEMENTATION_GUIDE.md** |
| Need quick reference | Check **FILES_REFERENCE.md** |
| Code won't work | Check browser console (F12) for errors |
| Have questions | See FAQ section above |

---

## 🚦 NEXT STEPS

**Choose your path:**

### 🧠 "Explain the whole design" (30 minutes)
1. Read DIRECTORY_SUMMARY.md
2. Read ARCHITECTURE.md
3. Come back here

### ⚡ "Just get it working" (2 hours)
1. Follow QUICK START section (above)
2. Test in browser
3. Commit and push

### 📚 "Show me all the code" (1 hour)
1. Read IMPLEMENTATION_GUIDE.md
2. Copy-paste the 5 files
3. Customize dispensaries
4. Test and commit

### 🎓 "I need to understand everything" (2 hours)
1. Read all 4 docs in order
2. Review the code
3. Understand the architecture
4. Then implement

---

## 🎉 THE PAYOFF

After just 2 hours of work, you'll have:

✅ Automated dispensary directory  
✅ Real-time search & filtering  
✅ Offline-capable  
✅ Syncs with Airtable (or any JSON API)  
✅ No build tools or servers needed  
✅ Scales from 5 to 500+ dispensaries  
✅ Future-proof architecture  

All for **~20KB of clean, modular code** that's easy to maintain and extend.

---

**Ready to go?** Pick a doc from the roadmap above and start reading! 🚀
