# Cannabis Sales Dashboard - Code Documentation

## Dashboard Overview

**Purpose**: Interactive analytics dashboard for cannabis sales data across dispensaries in New Mexico, tracking month-over-month growth, market trends, and inventory velocity.

**Technology Stack**:
- **Frontend**: HTML5 + Vanilla JavaScript (no frameworks)
- **Styling**: Tailwind CSS with custom dark theme
- **Charts**: Chart.js for data visualization
- **Data**: Embedded CSV data parsed into JavaScript arrays
- **Time Period**: January 2025 - May 2026 (17 months of cannabis sales data)

**Key Capabilities**:
- Real-time filtering by month, city, and dispensary type
- Month-over-month (MoM) growth tracking with "New ★" indicators
- Drill-down navigation to detailed dispensary information
- Comparison mode for side-by-side analysis
- Sales trend visualization and market breakdown
- Top performers and velocity rankings
- CSV export functionality

---

## Architecture Overview

### Data Flow

```
Raw CSV Data (embedded)
         ↓
rawData Array (parsed monthly records)
         ↓
dispensaryMap + dbaToKey (cross-month matching)
         ↓
aggregatedTableData (processed monthly data)
         ↓
Rendering Functions (charts, tables, KPIs)
         ↓
DOM Updates + Chart.js Instances
```

### Global State Variables

| Variable | Type | Purpose | Location |
|----------|------|---------|----------|
| `rawData` | Array | All raw sales records by month | Line ~100 |
| `currentMonth` | String | Selected month key (e.g., "2026-03") | Line ~8460 |
| `currentCity` | String | Selected city filter | Line ~8461 |
| `currentMetric` | String | Active metric tab (revenue/adultUse/medical) | Line ~8462 |
| `selectedDispensary` | Object | Modal data for detailed view | Line ~8463 |
| `aggregatedTableData` | Object | Processed monthly data cache | Line ~8464 |
| `dispensaryMap` | Object | Maps unique keys to DBAs across months | Line ~8195 |
| `dbaToKey` | Object | Maps each DBA to its unique key | Line ~8196 |
| `chartInstances` | Object | Chart.js instances (trend, breakdown, etc.) | Line ~8465 |
| `comparisonMode` | Boolean | Side-by-side comparison state | Line ~8466 |

### Chart Instances Management

Chart.js instances are stored in a lazy-initialization pattern:
- Created on-demand when first needed
- Stored in `chartInstances` object for reuse
- Destroyed and recreated on data changes
- Keys: `trend`, `breakdown`, `topTen`, `velocity`, `heatmap`

### Event Handling Flow

```
User Interaction (click, input, change)
         ↓
Event Listener (lines 8900+)
         ↓
State Update (currentMonth, currentCity, etc.)
         ↓
Update aggregatedTableData
         ↓
Re-render Tables
         ↓
Update/Re-create Charts
         ↓
DOM Reflection
```

---

## Data Structures

### rawData Array

Each month contains records with this structure:

```javascript
{
  month: "2026-03",           // YYYY-MM format
  dba: "Apogee Dispensary",   // Dispensary name (varies by month)
  licensee: "APOGEE THERAPEUTICS LLC",  // Legal entity name
  city: "Los Angeles",
  adultUseRevenue: 145000,    // Revenue from adult-use sales
  medicalRevenue: 32000,      // Revenue from medical sales
  totalRevenue: 177000,
  units: 4500                 // Units sold
}
```

**Important**: February 2026 uses full licensee names while March 2026 uses shorter "DBA" names. The `dispensaryMap` system handles cross-month matching.

### aggregatedTableData

Processed data structure created by `getAggregatedData()`:

```javascript
{
  byCity: {
    "Los Angeles": [
      {
        dba: "Apogee Dispensary",
        city: "Los Angeles",
        adultUse: 145000,
        medical: 32000,
        total: 177000,
        avgPerDay: 5700,
        count: 1
      },
      // ... more dispensaries
    ],
    // ... more cities
  },
  cityTotals: {
    "Los Angeles": { adultUse: ..., medical: ..., total: ... },
    // ...
  }
}
```

### Dispensary Mapping System

**Purpose**: Cross-month matching to handle naming variations (Feb: "APOGEE THERAPEUTICS LLC" → Mar: "Apogee Dispensary")

**Key Objects**:
- `dispensaryMap`: `{ "los angeles|apogee" → "Apogee Dispensary" }`
- `dbaToKey`: `{ "Apogee Dispensary" → "los angeles|apogee" }`

**Usage in MoM Calculation** (lines 8795-8815):
```javascript
const findMatchingDba = (currentDba, targetMonth) => {
  // Try exact match first
  let match = targetMonthData.find(p => p.dba === currentDba);
  if (match) return match.dba;
  
  // Fall back to key-based matching
  const key = dbaToKey[currentDba];
  if (key && dispensaryMap[key]) {
    const targetDba = dispensaryMap[key];
    match = targetMonthData.find(p => p.dba === targetDba);
    if (match) return targetDba;
  }
  
  return null;
};
```

### Constants

**Month References** (lines ~8115-8140):
- `monthLabels`: Human-readable names ("January 2025", "February 2026", etc.)
- `monthKeys`: Machine-readable keys ("2025-01", "2025-02", etc.)

**Color Scheme** — two brand colors, defined once in `css/brand.css`:
- Olive green `#558203` (`--gb-green-500`) with its 50–900 scale
- Desert cream `#FFF8B9` (`--gb-cream-200`) with its 50–900 scale
- KPI / chart accents: six AA-legible steps of those two hues
- MoM colors: green `#476d03` up, rose `#be123c` down, ink `#5f6749` flat

**Two rules the palette cannot enforce on its own:**

1. **A cream fill never carries white text.** White on `cream-400`
   (`#dccf6e`) is 1.6:1. Cream fills take `--gb-on-accent`
   (`text-green-900`); only `cream-700` and deeper can hold white. This
   is checked in markup — `npm run check:colors` fails the build if
   `text-white` lands on a light gold/amber/yellow/violet fill.
2. **Contrast is measured against `#F7F3E2`, the darkest stop of the
   canvas gradient** — not `#FFFDF0`. The lightest stop flatters every
   ratio by ~8%, which is enough to let a color pass in review and fail
   at the bottom of a long page.

Never add a raw hex to a page. Use a `--gb-*` token, or the `emerald-*` /
`gold-*` Tailwind names (they resolve to the brand scales via
`js/tailwind-brand.js`). `npm run check:colors` fails the build on
off-palette values.

---

## Core Functions Reference

### Data Processing Functions

#### `getAggregatedData(monthKey, metric)`
**Location**: Lines 8260-8300  
**Purpose**: Process raw data for a specific month and metric

```javascript
getAggregatedData("2026-03", "revenue") → aggregatedTableData
```

**Parameters**:
- `monthKey`: String like "2026-03"
- `metric`: One of "revenue", "adultUse", "medical"

**Returns**: Object with `byCity` and `cityTotals`

**Usage**: Called whenever month/city/metric changes to rebuild table data

---

#### `getTrendData(monthKey, metric)`
**Location**: Lines 8303-8320  
**Purpose**: Extract time-series data for trend chart

**Returns**: Array of monthly totals for line chart rendering

**Usage**: `renderCharts()` calls this to update trend chart

---

#### `getDispensaryHistoricalData(dba, monthKey)`
**Location**: Lines 8323-8350  
**Purpose**: Get single dispensary's data across multiple months for modal view

**Returns**: Array of objects with month, revenue, growth%, etc.

**Usage**: Called when user clicks on dispensary to open detail modal

---

#### `getTopDispensaries(monthKey, metric, limit)`
**Location**: Lines 8353-8375  
**Purpose**: Get top N dispensaries by sales volume

**Returns**: Sorted array of dispensaries limited to N results

**Usage**: `renderCharts()` for Top 10 Bar chart and Sales Velocity chart

---

### Rendering Functions

#### `renderTable(monthKey, city, metric)`
**Location**: Lines 8595-8750  
**Purpose**: Render main sales data table with MoM calculations

**DOM Elements Updated**:
- `#tableBody` - table rows
- MoM columns with colored indicators
- Hover interactions and drill-down links

**Key Features**:
- Matches DBAs across months using `findMatchingDba()`
- Displays "New ★" for first-time dispensaries (gold color)
- Shows "+X.X%", "0.0%", or "-X.X%" for established dispensaries
- Click to drill into detail modal

---

#### `renderCharts(monthKey, metric)`
**Location**: Lines 8890-9050  
**Purpose**: Render all 5 charts (trend, breakdown, top 10, velocity, heatmap)

**Charts Rendered**:
1. **Trend Chart** - Line chart of monthly totals
2. **Market Breakdown** - Doughnut chart of city distribution
3. **Top 10 Bar** - Horizontal bar chart of top dispensaries
4. **Sales Velocity** - Top 8 with MoM % (uses matching)
5. **City Heatmap** - Grid visualization

**Usage**: Called on month/metric change to rebuild all charts

---

#### `renderSalesVelocityChart()`
**Location**: Lines 9312-9339  
**Purpose**: Render MoM growth chart for top 8 dispensaries

**Key Logic**:
- Gets top 8 dispensaries for current month
- Finds matching dispensaries in previous month
- Calculates MoM percentage
- Uses color coding: Green (+), Red (-), Gold (New ★), Gray (0%)

**Critical**: Uses `findMatchingDba()` to match across months despite naming variations

---

#### `renderSalesVelocityHeatmap()`
**Location**: Lines 9342-9380  
**Purpose**: Render grid heatmap of all cities with color intensity

**Usage**: Visual overview of relative performance across cities

---

### Utility Functions

#### `fmt(value, type)`
**Location**: Lines 8150-8180  
**Purpose**: Format numbers for display

```javascript
fmt(145000, 'currency') → "$145,000"
fmt(0.456, 'percent') → "45.6%"
fmt(4500, 'number') → "4,500"
```

**Types**: 'currency', 'percent', 'number', 'units'

---

#### `fuzzyMatch(search, text)`
**Location**: Lines 8183-8192  
**Purpose**: Case-insensitive substring matching for search

**Usage**: Filter dispensaries by user search input

---

#### `getDispensaryKey(record)`
**Location**: Lines 8195-8200  
**Purpose**: Generate unique key for dispensary (city + normalized name)

```javascript
getDispensaryKey({city: "Los Angeles", dba: "Apogee Dispensary"})
→ "los angeles|apogee"
```

**Usage**: Cross-month matching in dispensaryMap system

---

#### `findMatchingDba(currentDba, targetMonth)`
**Location**: Lines 8202-8220  
**Purpose**: Find same dispensary in different month despite name variations

**Returns**: DBA name in target month, or null if not found

**Usage**: MoM calculations, Sales Velocity chart, historical data

---

### Modal & Details Functions

#### `openDispensaryModal(dba, monthKey)`
**Location**: Lines 9050-9100  
**Purpose**: Open detail modal for clicked dispensary

**Passes to renderModalContent**:
- Dispensary name, city, month
- Historical data (all months)
- Current and previous month comparison

---

#### `renderModalContent(dispensary, data)`
**Location**: Lines 9103-9200  
**Purpose**: Populate modal with dispensary details

**Content Rendered**:
- Dispensary info header
- Chart: Monthly revenue trend
- MoM growth statistics
- Comparison table (prev month vs current)

**DOM**: Updates `#modalContent` and shows overlay

---

## User Interactions & Event Handlers

### Primary Interactive Elements

| Element | Trigger | Handler | Effect |
|---------|---------|---------|--------|
| Month selector dropdown | Change | `handleMonthChange()` | Updates `currentMonth`, re-renders all |
| City filter | Change | `handleCityChange()` | Updates `currentCity`, filters table |
| Metric tabs (Revenue/Adult/Medical) | Click | `handleMetricChange()` | Updates `currentMetric`, refreshes charts |
| Dispensary row | Click | `openDispensaryModal()` | Opens detail modal with historical data |
| Search input | Input | Live filter | Filters visible table rows |
| "Compare" button | Click | `toggleComparisonMode()` | Splits view for side-by-side comparison |
| Modal close button | Click | `closeModal()` | Closes detail overlay |
| Export button | Click | `exportToCSV()` | Downloads current table data as CSV |

### Event Listener Setup

**Location**: Lines 8900-9000

All event handlers are attached in document ready:
```javascript
document.querySelector('#monthSelect').addEventListener('change', handleMonthChange);
document.querySelector('#cityFilter').addEventListener('change', handleCityChange);
document.querySelectorAll('[data-metric]').forEach(btn => {
  btn.addEventListener('click', handleMetricChange);
});
// ... more handlers
```

### Common User Flows

**Flow 1: View March 2026 Data**
1. User selects "March 2026" from dropdown
2. `handleMonthChange()` sets `currentMonth = "2026-03"`
3. `aggregatedTableData` rebuilt via `getAggregatedData()`
4. `renderTable()` shows March data with MoM vs February
5. Charts update via `renderCharts()`

**Flow 2: Drill Into Dispensary**
1. User clicks dispensary row in table
2. `openDispensaryModal(dba, monthKey)` called
3. `getDispensaryHistoricalData()` fetches data across all months
4. Modal renders with trend chart and comparison stats
5. Shows historical MoM percentages

**Flow 3: Comparison Mode**
1. User clicks "Compare" button
2. Dashboard splits into two views
3. Each side independently selects month/metric
4. Both render simultaneously for analysis

---

## State Management

### State Update Propagation

```
User Action
    ↓
Event Listener
    ↓
Update Global Variable (currentMonth, currentCity, etc.)
    ↓
Call getAggregatedData() to rebuild data
    ↓
Call renderTable() and renderCharts()
    ↓
DOM reflects new state
```

### Key Global Variables

**Display State**:
- `currentMonth`: Active month selection
- `currentCity`: City filter (or "all")
- `currentMetric`: Revenue type selection
- `comparisonMode`: Boolean for split-view

**Data Cache**:
- `aggregatedTableData`: Pre-processed data for current filters
- `selectedDispensary`: Modal data

**Mapping**:
- `dispensaryMap`: {key → dba}
- `dbaToKey`: {dba → key}

### localStorage Usage

**Recent Searches** (lines 8870-8880):
```javascript
localStorage.setItem('recentSearches', JSON.stringify(searches));
// Populated when user searches dispensaries
// Recalled on page load for quick access
```

---

## CSS & Styling System

### Key CSS Classes

**KPI Cards** (lines 764-825):
- `.kpi-card` - Base styling with dark background
- `.kpi-card:hover` - Emerald glow effect
- `.kpi-value` - Large number display
- `.kpi-label` - Descriptive text

**Chart Containers** (lines 828-905):
- `.chart-container` - Base grid layout
- `.chart-container:hover` - Color-specific glow
- `.chart-title` - Emerald accent heading

**Table** (lines 1010-1040):
- `.table-row` - Base row styling
- `.table-row:hover` - Emerald highlight
- `.mom-cell` - MoM column styling
- `.mom-new` - Gold badge for new dispensaries

**MoM Indicators**:
- Green (`#34d399`) - Positive growth
- Red (`#f87171`) - Negative growth
- Gold (`#fbbf24`) - New ★ dispensary
- Gray (`#94a3b8`) - No previous data

### Color Hierarchy

- **Primary**: Olive green (#558203) - main accents, fills, hover effects
- **Secondary**: Desert cream (#FFF8B9) - highlights, badges, surface tints
- **Metric Colors**: six steps of the two brand hues (KPI cards), each
  verified at ≥4.5:1 on the light glass because the labels are 10px
- **Text**: warm olive ink on the cream canvas — #22280f body, #4b5233
  secondary, #5f6749 muted (the lightest ink allowed to carry text; it
  is the point where AA still holds at the dark end of the canvas)
- **Text on dark**: cream (#fff8b9) and green-400 (#7fab16) headings,
  #9aa383 muted, #7d8465 separators and meta
- **Background**: cream canvas (#fffdf0 → #f7f3e2) on the main site,
  charcoal (#0a0a0a to #242424) on education/articles
- **Accent CTA** (`.btn-gold`): cream fill, green-900 label — never the
  reverse
- **Status only** (deliberately outside the brand): #be123c decline,
  #dc2626 error

---

## Adding New Features Guide

### Adding a New Filter

**Example: Filter by Licensee Type**

**Step 1**: Add filter dropdown to HTML
```html
<select id="licenseeFilter">
  <option value="">All Licensees</option>
  <option value="retail">Retail</option>
  <option value="distributor">Distributor</option>
</select>
```

**Step 2**: Add global state variable
```javascript
let currentLicenseeType = '';
```

**Step 3**: Create handler
```javascript
const handleLicenseeChange = (e) => {
  currentLicenseeType = e.target.value;
  // Use existing functions, they work with any filter
  aggregatedTableData = getAggregatedData(currentMonth, currentMetric);
  renderTable(currentMonth, currentCity, currentMetric);
  renderCharts(currentMonth, currentMetric);
};
```

**Step 4**: Apply filter in getAggregatedData()
```javascript
let filtered = rawData.filter(r => 
  r.month === monthKey &&
  (!currentCity || r.city === currentCity) &&
  (!currentLicenseeType || r.licenseeType === currentLicenseeType)
);
```

**Step 5**: Attach event listener
```javascript
document.querySelector('#licenseeFilter').addEventListener('change', handleLicenseeChange);
```

---

### Adding a New Chart

**Example: Add Quarterly Comparison Chart**

**Step 1**: Create data function
```javascript
const getQuarterlyComparison = () => {
  // Group months into quarters
  // Sum revenue by quarter
  // Return array for chart
};
```

**Step 2**: Add chart container to HTML
```html
<div class="chart-container">
  <h3 class="chart-title">Quarterly Trend</h3>
  <canvas id="quarterlyChart"></canvas>
</div>
```

**Step 3**: Add chart instance to global state
```javascript
chartInstances.quarterly = null;
```

**Step 4**: Create render function
```javascript
const renderQuarterlyChart = () => {
  const data = getQuarterlyComparison();
  const ctx = document.getElementById('quarterlyChart').getContext('2d');
  
  if (chartInstances.quarterly) {
    chartInstances.quarterly.destroy();
  }
  
  chartInstances.quarterly = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.quarter),
      datasets: [{
        label: 'Revenue',
        data: data.map(d => d.total),
        backgroundColor: '#10b981'
      }]
    },
    options: { /* ... */ }
  });
};
```

**Step 5**: Call in renderCharts()
```javascript
const renderCharts = (monthKey, metric) => {
  // ... existing code ...
  renderQuarterlyChart();
};
```

---

### Adding a New Metric

**Example: Add "Units Per Day" Metric**

**Step 1**: Add tab to HTML
```html
<button data-metric="unitsPerDay" class="metric-tab">Units/Day</button>
```

**Step 2**: Update getAggregatedData() to calculate metric
```javascript
if (metric === 'unitsPerDay') {
  row.metric = row.units / daysInMonth;
}
```

**Step 3**: Update renderTable() column display
```javascript
const displayValue = {
  'revenue': fmt(row.total, 'currency'),
  'unitsPerDay': fmt(row.metric, 'units'),
  // ... other metrics
}[currentMetric];
```

**Step 4**: Update chart data extraction
```javascript
const getValue = (row) => {
  if (currentMetric === 'unitsPerDay') return row.unitsPerDay;
  // ... handle other metrics
};
```

---

### Common Patterns to Reuse

**Pattern 1: Updating on State Change**
```javascript
// When state changes, always do these steps:
aggregatedTableData = getAggregatedData(currentMonth, currentMetric);
renderTable(currentMonth, currentCity, currentMetric);
renderCharts(currentMonth, currentMetric);
```

**Pattern 2: Cross-Month Matching**
```javascript
// Always use findMatchingDba() for month comparisons
const prevDba = findMatchingDba(currentDba, prevMonth);
if (prevDba) {
  const prevRow = getMonthData(prevMonth).find(r => r.dba === prevDba);
}
```

**Pattern 3: Chart Creation**
```javascript
// Always destroy old chart before creating new
if (chartInstances.myChart) {
  chartInstances.myChart.destroy();
}
chartInstances.myChart = new Chart(ctx, options);
```

### Things to Avoid

1. **Don't recalculate aggregatedTableData in renderTable()** - It should already be computed and cached
2. **Don't hardcode colors** - Use the constants defined at top (e.g., `#10b981` instead of inline)
3. **Don't skip the DBA matching system** - Always use `findMatchingDba()` for cross-month calculations
4. **Don't forget to destroy Chart instances** - Causes memory leaks and duplicate charts
5. **Don't add business logic to render functions** - Keep data logic separate from display
6. **Don't modify global arrays directly** - Work with copies to avoid side effects

---

## DBA Cross-Month Matching System

### Why It Was Needed

**Problem**: February 2026 uses full licensee names ("APOGEE THERAPEUTICS LLC") while March 2026 uses shorter DBA names ("Apogee Dispensary"). Without matching, MoM calculations would fail.

**Solution**: Create unique keys based on city + normalized core name to match across months despite variations.

### How It Works

**Step 1: Initialize dispensaryMap**
```javascript
const buildDispensaryMap = () => {
  rawData.forEach(record => {
    const key = getDispensaryKey(record);  // "los angeles|apogee"
    dispensaryMap[key] = record.dba;       // "Apogee Dispensary"
    dbaToKey[record.dba] = key;            // Reverse mapping
  });
};
```

**Step 2: Normalize Names**
```javascript
const getDispensaryKey = (record) => {
  const normalizedDba = record.dba
    .toLowerCase()
    .replace(/[^\w\s]/g, '')              // Remove special chars
    .split(' ')[0]                        // Get first word (core name)
    .trim();
  
  return `${record.city.toLowerCase()}|${normalizedDba}`;
};
```

**Step 3: Match Across Months**
```javascript
const findMatchingDba = (currentDba, targetMonth) => {
  // Try exact match first
  const exactMatch = getMonthData(targetMonth).find(p => p.dba === currentDba);
  if (exactMatch) return exactMatch.dba;
  
  // Fall back to key-based matching
  const key = dbaToKey[currentDba];
  if (key && dispensaryMap[key]) {
    const targetDba = dispensaryMap[key];
    const keyMatch = getMonthData(targetMonth).find(p => p.dba === targetDba);
    if (keyMatch) return targetDba;
  }
  
  return null;  // No match found
};
```

### Where Matching Is Used

1. **renderTable() - MoM Calculation** (lines 8795-8815)
   - Finds previous month's matching DBA
   - Calculates growth percentage or "New ★"

2. **renderSalesVelocityChart()** (lines 9312-9339)
   - Gets top 8 dispensaries
   - Finds matches in previous month for MoM %

3. **getDispensaryHistoricalData()** (lines 8323-8350)
   - Retrieves same dispensary across all months
   - Enables trend chart in modal view

---

## File Structure & Code Organization

### HTML/CSS/JS Sections

| Section | Lines | Content |
|---------|-------|---------|
| Doctype & Head | 1-50 | Meta tags, fonts, Tailwind |
| CSS Variables | 51-100 | Color theme, spacing |
| KPI Cards | 764-825 | Six metric cards with styling |
| Chart Containers | 828-905 | Five chart grid layout |
| Table | 1010-1040 | Dispensary table with headers |
| Modal | 1100-1150 | Detail view overlay |
| Data Parsing | ~8100 | CSV parsing logic |
| Constants | 8115-8140 | monthLabels, monthKeys, colors |
| Matching System | 8195-8250 | dispensaryMap building, key functions |
| Utility Functions | 8260-8400 | fmt, fuzzyMatch, data functions |
| Render Functions | 8500-9400 | renderTable, renderCharts, modals |
| Event Handlers | 8900-9050 | Click, change event listeners |
| Chart.js Code | 9300-9500 | Chart rendering logic |

### Quick Navigation Comments

Look for these markers in the code:
- `// === DATA PARSING ===` (line ~8100)
- `// === CONSTANTS ===` (line ~8115)
- `// === MATCHING SYSTEM ===` (line ~8195)
- `// === UTILITIES ===` (line ~8260)
- `// === RENDER FUNCTIONS ===` (line ~8500)
- `// === EVENT HANDLERS ===` (line ~8900)

---

## Testing & Debugging Tips

### Verify Data Integrity

**Check raw data parsing**:
```javascript
console.log(rawData);  // Should show all records
console.log(rawData.filter(r => r.month === '2026-03').length);  // March count
```

**Verify matching system**:
```javascript
console.log(dispensaryMap);  // Check all keys
console.log(dbaToKey);       // Check reverse mapping
console.log(findMatchingDba('Apogee Dispensary', '2026-02'));  // Test match
```

### Test New Filters

1. **Modify getAggregatedData()** to add console.log before/after filter
2. **Check aggregatedTableData** in console to verify structure
3. **Monitor renderTable()** to ensure rows match filtered data

### Test New Charts

1. **Console.log the data** fed to chart:
```javascript
const data = getTopDispensaries(currentMonth, currentMetric, 10);
console.log('Chart data:', data);
```

2. **Check Chart.js context**:
```javascript
console.log(chartInstances.myChart);  // Should be valid Chart instance
```

3. **Verify DOM element exists**:
```javascript
console.log(document.getElementById('myChartCanvas'));  // Should exist
```

### Common Issues & Solutions

**Issue**: MoM column shows "NaN" or "undefined"
- **Check**: Is findMatchingDba() returning null?
- **Fix**: Verify dbaToKey has entries for all DBAs
- **Debug**: `console.log(findMatchingDba(dba, prevMonth))`

**Issue**: Charts not updating when month changes
- **Check**: Is renderCharts() being called?
- **Fix**: Verify event listener is attached
- **Debug**: Add `console.log('Rendering charts for', monthKey)`

**Issue**: Table shows wrong city data
- **Check**: Is currentCity filter being applied?
- **Fix**: Verify getAggregatedData() filters by city
- **Debug**: `console.log('Filtered to city:', currentCity)`

**Issue**: Modal shows no historical data
- **Check**: Does getDispensaryHistoricalData() find records?
- **Fix**: Ensure findMatchingDba() works across all months
- **Debug**: `console.log(getDispensaryHistoricalData(dba, month))`

---

## Summary Quick Reference

**To add a feature**:
1. Identify data needs (new field? new month?)
2. Create data processing function (getXxxData)
3. Create render function (renderXxx)
4. Add UI element (button, dropdown, modal)
5. Attach event listener and state updater

**To debug**:
1. Log the state variables (currentMonth, currentCity, etc.)
2. Log the aggregated data structure
3. Check Chart.js instances and DOM elements
4. Use browser DevTools to inspect actual vs expected values

**Key files/functions to understand first**:
- `getAggregatedData()` - How data is filtered and processed
- `renderTable()` - How data becomes visible rows
- `findMatchingDba()` - How cross-month matching works
- `renderCharts()` - How all visualizations are created
- Event handlers - How user actions trigger updates

---

## Version History

- **v1.0** (Mar 2026): Initial dashboard with 15+ months data
- **v1.1** (May 2026): DBA cross-month matching system for accurate MoM calculations
- **v1.2** (May 2026): Visual enhancements and comprehensive documentation (this guide)
