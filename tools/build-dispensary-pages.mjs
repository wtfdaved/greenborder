#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   Dispensary page builder — `npm run build:dispensaries`

   Why this exists
   ───────────────
   The directory on the home page is rendered in the browser from
   data/dispensaries.js. That is fine for a visitor and invisible to a
   crawler: of the 43 shops in the dataset, exactly three had a URL
   Google could index (astro-buds, mango-cannabis, old-gods). Search
   "Dark Matter Sunland Park" and there was nothing of ours to return.

   So every dispensary gets a real, static, crawlable page here, built
   from the same single source of truth. Nothing is hand-maintained:
   edit data/dispensaries.js and re-run this.

   Output
   ───────
     dispensaries/index.html                 — static directory hub
     dispensaries/<name>-<city>.html         — one page per shop

   The three hand-built pages keep their existing URLs (they have
   inbound links and history). This builder links to them rather than
   generating a competing duplicate.

   Workflow — the chrome and the cache-busting hashes are owned by
   other tools, so always run the full chain:

     npm run build:pages

   ═══════════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ORIGIN = 'https://greenborder.org';
const OUT_DIR = 'dispensaries';

// ── Load the canonical data ────────────────────────────────────────
// data/dispensaries.js is a browser file that assigns window.DISPENSARIES.
global.window = global.window || {};
require('../data/dispensaries.js');
const ALL = global.window.DISPENSARIES;

if (!Array.isArray(ALL) || !ALL.length) {
  console.error('✖ data/dispensaries.js produced no window.DISPENSARIES');
  process.exit(1);
}

// ── Pages that already exist by hand, keyed by dispensary id ───────
const LEGACY = {
  custom_1772668487748: '/astro-buds.html',
  sp2: '/mango-cannabis.html',
  sp6: '/old-gods.html',
};

// ── What each border town is, and how far it actually is ───────────
// Drive times are approximate and written as approximate; they are the
// single most searched thing about these shops ("how far is X from
// El Paso") and the reason this site exists.
const CITIES = {
  'Sunland Park': {
    slug: 'sunland-park',
    geo: { lat: '31.7968', lon: '-106.5797' },
    drive: 'about 15 minutes from downtown El Paso',
    driveShort: '~15 min from downtown El Paso',
    blurb:
      'Sunland Park sits directly against El Paso&rsquo;s west side, which is why it holds more licensed dispensaries than any other town on the border. From I-10 and Sunland Park Drive you are across the state line in a few minutes, and the McNutt Road and Appaloosa Drive corridors hold most of the shops.',
  },
  'Santa Teresa': {
    slug: 'santa-teresa',
    geo: { lat: '31.8479', lon: '-106.6883' },
    drive: 'about 20 minutes from west El Paso',
    driveShort: '~20 min from west El Paso',
    blurb:
      'Santa Teresa is the quieter stretch of the New Mexico line north-west of El Paso, reached by NM-136 or Artcraft Road. Fewer shops, shorter lines, and an easy run from the Upper Valley and the Westside.',
  },
  Chaparral: {
    slug: 'chaparral',
    geo: { lat: '32.0409', lon: '-106.4028' },
    drive: 'about 30 minutes from northeast El Paso',
    driveShort: '~30 min from northeast El Paso',
    blurb:
      'Chaparral is the closest New Mexico cannabis town to northeast El Paso and Fort Bliss, straight up Dyer Street and Highway 213. It has grown into a genuine dispensary cluster with some of the sharpest pricing on the border.',
  },
  Anthony: {
    slug: 'anthony',
    geo: { lat: '32.0034', lon: '-106.6053' },
    drive: 'about 25 minutes north of El Paso on I-10',
    driveShort: '~25 min north on I-10',
    blurb:
      'Anthony, New Mexico sits right on I-10 at the Texas line, which makes it the natural stop for anyone driving up from El Paso toward Las Cruces.',
  },
};

// ── Helpers ────────────────────────────────────────────────────────
const esc = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// JSON-LD is escaped separately: it lives inside a <script> block where
// HTML entities are not decoded, so only the tag-closing sequence and
// the quotes JSON already handles matter.
const jsonld = (obj) =>
  JSON.stringify(obj, null, 2).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// Slugs carry the town as well as the name. Two shops share the name
// "Astro Buds" across two towns, and "<name>-<city>" is both unique and
// the phrase people actually search.
const slugFor = (d) => `${slugify(d.name)}-${CITIES[d.city].slug}`;

// Where this dispensary lives on the site — legacy URL if it has one.
const urlFor = (d) => LEGACY[d.id] || `/${OUT_DIR}/${slugFor(d)}.html`;

// Tags arrive as "🔥 Favorite" — the emoji is decoration, the words are
// the content.
const tagText = (t) => t.replace(/^[^\p{L}]+/u, '').trim();

const offerings = (d) => {
  const out = [];
  if (d.hasAdultUse) out.push('recreational (21+)');
  if (d.hasMedical) out.push('medical');
  if (d.hasConsumption) out.push('on-site consumption lounge');
  return out;
};

const andList = (items) =>
  items.length < 2 ? items[0] || '' : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

const phoneDigits = (p = '') => p.replace(/[^\d]/g, '');

const cityAddress = (d) =>
  /,\s*NM/i.test(d.address) ? d.address : `${d.address}, ${d.city}, NM${d.zipCode ? ' ' + d.zipCode : ''}`;

// First sentence of the operator's own copy, used for meta descriptions
// where the full paragraph would be truncated mid-word by Google.
const firstSentence = (text, max = 150) => {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  const cut = clean.slice(0, max);
  const stop = cut.lastIndexOf('. ');
  if (stop > 60) return cut.slice(0, stop + 1);
  return (clean.length > max ? cut.replace(/\s+\S*$/, '') + '…' : clean);
};

// ── Shared <head> ──────────────────────────────────────────────────
const head = ({ title, description, path, keywords, structured, place, geo }) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <!-- Brand palette tokens — single source of truth for site color -->
  <link rel="stylesheet" href="/css/brand.css" />
  <title>${esc(title)}</title>

  <!-- SEO Meta Tags -->
  <meta name="description" content="${esc(description)}" />
  <meta name="keywords" content="${esc(keywords)}" />
  <meta name="author" content="The Green Border" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <link rel="canonical" href="${ORIGIN}${path}" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/icons/icon-180.png" />
  <link rel="manifest" href="/site.webmanifest" />

  <!-- Local search signals — this site is about one metro and one border -->
  <meta name="geo.region" content="US-NM" />
  <meta name="geo.placename" content="${esc(place)}" />
  <meta name="geo.position" content="${geo.lat};${geo.lon}" />
  <meta name="ICBM" content="${geo.lat}, ${geo.lon}" />

  <!-- Open Graph / Social -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${ORIGIN}${path}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:image" content="${ORIGIN}/og-image.jpg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="The Green Border — El Paso and Sunland Park cannabis guide" />
  <meta property="og:site_name" content="The Green Border" />
  <meta property="og:locale" content="en_US" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${ORIGIN}/og-image.jpg" />

  <meta http-equiv="content-language" content="en-US" />
  <meta name="theme-color" content="#558203" />

  <!-- JSON-LD Structured Data -->
${structured.map((s) => `  <script type="application/ld+json">\n${jsonld(s)}\n  </script>`).join('\n\n')}

  <!-- Google AdSense -->
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8626644983261966" crossorigin="anonymous"></script>

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,600;0,9..144,700;1,9..144,700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

  <!-- Theme. brand.css holds the tokens; liquid-glass.css paints the cream
       canvas and the shared header/footer chrome; longform.css is the
       reading experience shared with the guides. -->
  <link rel="stylesheet" href="/css/liquid-glass.css" />
  <link rel="stylesheet" href="/css/longform.css" />
  <script src="/js/liquid-glass.js" defer></script>
</head>

<body>

<a class="skip-link" href="#main-content">Skip to content</a>

<!-- BEGIN:header -->
<!-- END:header -->
`;

const tail = `
<!-- BEGIN:footer -->
<!-- END:footer -->

</body>
</html>
`;

// ── Per-dispensary page ────────────────────────────────────────────
const dispensaryPage = (d, siblings) => {
  const city = CITIES[d.city];
  const path = `/${OUT_DIR}/${slugFor(d)}.html`;
  const offers = offerings(d);
  const address = cityAddress(d);
  const title = `${d.name} — ${d.city}, NM Dispensary Near El Paso`;
  const description = `${d.name} is a licensed ${offers[0] || 'cannabis'} dispensary at ${address}, ${city.drive}. Hours, address, phone, offerings and what to expect.`;
  const keywords = [
    d.name,
    `${d.name} ${d.city}`,
    `${d.name} dispensary`,
    `${d.city} dispensary`,
    'dispensary near El Paso',
    'weed near El Paso',
    'cannabis near El Paso',
    'El Paso cannabis',
    `${d.city} NM cannabis`,
  ].join(', ');

  const faqs = [
    {
      q: `Where is ${d.name} located?`,
      a: `${d.name} is at ${address}${d.phone ? `. You can reach the shop at ${d.phone}` : ''}.`,
    },
    {
      q: `How far is ${d.name} from El Paso?`,
      a: `${d.city}, New Mexico is ${city.drive}, so the drive to ${d.name} is a short one. There is no border crossing and no checkpoint between El Paso and ${d.city} — you are simply crossing the Texas–New Mexico state line.`,
    },
    {
      q: `Can Texas residents buy cannabis at ${d.name}?`,
      a: `Yes. New Mexico's adult-use law lets any adult 21 or older buy recreational cannabis with a valid government ID, including a Texas driver's license. What is not legal is carrying that cannabis back across the state line into Texas — possession is still a criminal offense there, and the products must be consumed in New Mexico.`,
    },
    {
      q: `What does ${d.name} offer?`,
      a: `${d.name} is licensed for ${andList(offers)}${d.hasConsumption ? ', which means you can legally consume on the premises rather than in your car or hotel' : ''}. ${d.rating ? `It carries a ${d.rating}-star average across roughly ${d.reviewCount.toLocaleString()} public reviews.` : ''}`.trim(),
    },
  ];

  const store = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    additionalType: 'https://en.wikipedia.org/wiki/Cannabis_shop',
    '@id': `${ORIGIN}${path}#store`,
    name: d.name,
    description: firstSentence(d.description, 300),
    url: `${ORIGIN}${path}`,
    image: `${ORIGIN}/og-image.jpg`,
    priceRange: '$$',
    address: {
      '@type': 'PostalAddress',
      streetAddress: d.address.replace(/,\s*(Sunland Park|Santa Teresa|Chaparral|Anthony).*$/i, ''),
      addressLocality: d.city,
      addressRegion: 'NM',
      ...(d.zipCode ? { postalCode: d.zipCode } : {}),
      addressCountry: 'US',
    },
    areaServed: [
      { '@type': 'City', name: 'El Paso', address: { '@type': 'PostalAddress', addressRegion: 'TX', addressCountry: 'US' } },
      { '@type': 'City', name: d.city, address: { '@type': 'PostalAddress', addressRegion: 'NM', addressCountry: 'US' } },
    ],
    ...(d.phone ? { telephone: d.phone } : {}),
    ...(d.website ? { sameAs: [d.website.split('?')[0]] } : {}),
    ...(d.rating
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: String(d.rating),
            reviewCount: String(d.reviewCount),
            bestRating: '5',
          },
        }
      : {}),
  };

  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: 'Dispensaries Near El Paso', item: `${ORIGIN}/${OUT_DIR}/` },
      { '@type': 'ListItem', position: 3, name: `${d.city}, NM`, item: `${ORIGIN}/${OUT_DIR}/#${city.slug}` },
      { '@type': 'ListItem', position: 4, name: d.name, item: `${ORIGIN}${path}` },
    ],
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  const others = siblings.filter((s) => s.id !== d.id).slice(0, 6);

  return (
    head({
      title,
      description,
      path,
      keywords,
      structured: [store, breadcrumbs, faqSchema],
      place: `${d.city}, New Mexico`,
      geo: city.geo,
    }) +
    `
<main class="article-container" id="main-content" tabindex="-1">
  <article>
    <nav class="breadcrumb-nav" aria-label="Breadcrumb">
      <a href="/">Home</a>
      <span class="sep">›</span>
      <a href="/${OUT_DIR}/">Dispensaries Near El Paso</a>
      <span class="sep">›</span>
      <a href="/${OUT_DIR}/#${city.slug}">${esc(d.city)}</a>
      <span class="sep">›</span>
      <span>${esc(d.name)}</span>
    </nav>

    <div class="article-header">
      <h1 class="article-title">${esc(d.icon || '')} ${esc(d.name)} — ${esc(d.city)}, NM Dispensary Near El Paso</h1>
      <div class="article-meta">
        <div class="article-meta-item">📍 ${esc(address)}</div>
        ${d.phone ? `<div class="article-meta-item">📞 <a href="tel:+1${phoneDigits(d.phone)}">${esc(d.phone)}</a></div>` : ''}
        ${d.rating ? `<div class="article-meta-item">⭐ ${d.rating} (${d.reviewCount.toLocaleString()} reviews)</div>` : ''}
        <div class="article-meta-item">🚗 ${esc(city.driveShort)}</div>
      </div>
      <div class="article-tags">
        ${(d.tags || []).slice(0, 6).map((t) => `<span class="article-tag">${esc(tagText(t))}</span>`).join('\n        ')}
      </div>
    </div>

    <div class="article-content">
      <p><strong>${esc(d.name)}</strong> is a licensed New Mexico cannabis dispensary in ${esc(d.city)}, ${esc(city.drive)}. It is licensed for ${esc(andList(offers))}${d.hasConsumption ? ' — one of the few shops on the border where you can legally consume on site' : ''}. If you are searching for weed near El Paso, this is one of the closest legal options to the 915.</p>

      <h2 id="quick-facts">${esc(d.name)} at a Glance</h2>
      <table class="measurements-table">
        <tbody>
          <tr><td><strong>Address</strong></td><td>${esc(address)}</td></tr>
          ${d.phone ? `<tr><td><strong>Phone</strong></td><td><a href="tel:+1${phoneDigits(d.phone)}">${esc(d.phone)}</a></td></tr>` : ''}
          <tr><td><strong>Town</strong></td><td>${esc(d.city)}, New Mexico</td></tr>
          <tr><td><strong>Drive from El Paso</strong></td><td>${esc(city.drive)}</td></tr>
          <tr><td><strong>Recreational (21+)</strong></td><td>${d.hasAdultUse ? 'Yes' : 'No'}</td></tr>
          <tr><td><strong>Medical</strong></td><td>${d.hasMedical ? 'Yes' : 'No'}</td></tr>
          <tr><td><strong>Consumption lounge</strong></td><td>${d.hasConsumption ? 'Yes' : 'No'}</td></tr>
          ${d.rating ? `<tr><td><strong>Rating</strong></td><td>${d.rating} ★ across ${d.reviewCount.toLocaleString()} public reviews</td></tr>` : ''}
          ${d.website ? `<tr><td><strong>Website</strong></td><td><a href="${esc(d.website)}" target="_blank" rel="noopener nofollow">Visit ${esc(d.name)} →</a></td></tr>` : ''}
        </tbody>
      </table>

      <h2 id="about">About ${esc(d.name)}</h2>
      <p>${esc(d.description)}</p>

      ${
        (d.tags || []).length
          ? `<h2 id="known-for">What ${esc(d.name)} Is Known For</h2>
      <ul>
        ${(d.tags || []).map((t) => `<li>${esc(tagText(t))}</li>`).join('\n        ')}
      </ul>`
          : ''
      }

      <h2 id="getting-there">Getting There From El Paso</h2>
      <p>${city.blurb}</p>
      <div class="warning-box">
        <h4>Before you drive over</h4>
        <p>Bring a valid government photo ID — a Texas license is fine, and you must be 21 or older. Cannabis bought in New Mexico has to stay in New Mexico: carrying it back across the state line into Texas is still a criminal offense, and driving under the influence is illegal in both states. Most border shops take cash or debit; card acceptance varies.</p>
      </div>

      <h2 id="faq">${esc(d.name)} — Frequently Asked Questions</h2>
      <div class="faq-section">
        ${faqs
          .map(
            (f) => `<div class="faq-item">
          <h3>${esc(f.q)}</h3>
          <p>${esc(f.a)}</p>
        </div>`
          )
          .join('\n        ')}
      </div>

      ${
        others.length
          ? `<h2 id="nearby">Other Dispensaries in ${esc(d.city)}</h2>
      <ul>
        ${others
          .map(
            (o) =>
              `<li><a href="${urlFor(o)}">${esc(o.name)}</a> — ${esc(o.address)}${o.rating ? ` · ${o.rating} ★` : ''}</li>`
          )
          .join('\n        ')}
      </ul>
      <p><a href="/${OUT_DIR}/#${city.slug}">See all ${esc(d.city)} dispensaries →</a></p>`
          : ''
      }

      <h2 id="more">Keep Reading</h2>
      <ul>
        <li><a href="/el-paso-cannabis.html">Cannabis near El Paso: the complete border guide</a></li>
        <li><a href="/${OUT_DIR}/">Every dispensary near El Paso, town by town</a></li>
        <li><a href="/education/new-mexico-vs-texas-cannabis-laws-border-guide.html">New Mexico vs Texas cannabis laws</a></li>
        <li><a href="/education/first-dispensary-visit-checklist-what-to-expect.html">Your first dispensary visit: what to expect</a></li>
      </ul>
    </div>
  </article>
</main>
` +
    tail
  );
};

// ── Directory hub ──────────────────────────────────────────────────
const hubPage = (byCity) => {
  const path = `/${OUT_DIR}/`;
  const total = ALL.length;
  const title = `Dispensaries Near El Paso — All ${total} Border Cannabis Shops (2026)`;
  const description = `Every licensed dispensary near El Paso, TX — ${total} cannabis shops in Sunland Park, Chaparral, Santa Teresa and Anthony, New Mexico, with addresses, phone numbers, ratings and drive times from the 915.`;

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Dispensaries Near El Paso',
    description:
      'Licensed New Mexico cannabis dispensaries within a short drive of El Paso, Texas.',
    numberOfItems: total,
    itemListElement: ALL.map((d, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: d.name,
      url: `${ORIGIN}${urlFor(d)}`,
    })),
  };

  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: 'Dispensaries Near El Paso', item: `${ORIGIN}${path}` },
    ],
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Are there dispensaries in El Paso, Texas?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'No. Recreational and medical cannabis dispensaries are not legal in Texas, so there are none inside El Paso city limits. The closest legal dispensaries are in New Mexico — Sunland Park is about 15 minutes from downtown El Paso.',
        },
      },
      {
        '@type': 'Question',
        name: 'What is the closest dispensary to El Paso?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Sunland Park, New Mexico holds the closest cluster of dispensaries to El Paso — roughly a 15 minute drive from downtown, with most shops on McNutt Road and Appaloosa Drive. Chaparral is closest for northeast El Paso and Fort Bliss, and Santa Teresa is closest for the Upper Valley.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can I buy weed in New Mexico with a Texas ID?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Any adult 21 or older can buy adult-use cannabis in New Mexico with a valid government photo ID, including a Texas driver&rsquo;s license. Bringing it back into Texas remains illegal.',
        },
      },
    ],
  };

  const cityOrder = ['Sunland Park', 'Chaparral', 'Santa Teresa', 'Anthony'];

  const section = (cityName) => {
    const list = byCity[cityName] || [];
    const city = CITIES[cityName];
    return `
      <h2 id="${city.slug}">${esc(cityName)}, NM — ${list.length} dispensaries (${esc(city.driveShort)})</h2>
      <p>${city.blurb}</p>
      <table class="measurements-table">
        <thead>
          <tr><th>Dispensary</th><th>Address</th><th>Offerings</th><th>Rating</th></tr>
        </thead>
        <tbody>
          ${list
            .map(
              (d) => `<tr>
            <td><a href="${urlFor(d)}">${esc(d.name)}</a></td>
            <td>${esc(d.address)}</td>
            <td>${esc(andList(offerings(d)))}</td>
            <td>${d.rating ? `${d.rating} ★` : '—'}</td>
          </tr>`
            )
            .join('\n          ')}
        </tbody>
      </table>`;
  };

  return (
    head({
      title,
      description,
      path,
      keywords:
        'dispensaries near El Paso, weed near El Paso, cannabis near El Paso, El Paso cannabis, dispensary near me El Paso, Sunland Park dispensary, Chaparral dispensary, Santa Teresa dispensary, Anthony NM dispensary',
      structured: [itemList, breadcrumbs, faqSchema],
      place: 'Sunland Park, New Mexico',
      geo: CITIES['Sunland Park'].geo,
    }) +
    `
<main class="hub-container" id="main-content" tabindex="-1">
  <nav class="breadcrumb-nav" aria-label="Breadcrumb">
    <a href="/">Home</a>
    <span class="sep">›</span>
    <span>Dispensaries Near El Paso</span>
  </nav>

  <div class="hub-hero">
    <h1>Dispensaries Near El Paso</h1>
    <p>All ${total} licensed cannabis dispensaries within a short drive of the 915 — Sunland Park, Chaparral, Santa Teresa and Anthony, New Mexico. Addresses, phone numbers, ratings and how long the drive actually takes.</p>
  </div>

  <div class="article-content">
    <p>There are no dispensaries inside El Paso, because Texas has not legalized cannabis sales. Every shop below is in New Mexico, where adult-use cannabis is legal for anyone 21 and older with a valid photo ID — a Texas license included. The nearest of them is closer to downtown El Paso than most of the east side.</p>

    <p>New to this? Start with the <a href="/el-paso-cannabis.html">complete cannabis near El Paso guide</a>, or read <a href="/education/new-mexico-vs-texas-cannabis-laws-border-guide.html">what the law actually says on each side of the line</a>.</p>

    ${cityOrder.map(section).join('\n')}

    <h2 id="faq">Frequently Asked Questions</h2>
    <div class="faq-section">
      <div class="faq-item">
        <h3>Are there dispensaries in El Paso, Texas?</h3>
        <p>No. Cannabis dispensaries are not legal in Texas, so none operate inside El Paso city limits. The closest legal shops are across the New Mexico line in Sunland Park — about 15 minutes from downtown.</p>
      </div>
      <div class="faq-item">
        <h3>What is the closest dispensary to El Paso?</h3>
        <p>Sunland Park holds the closest cluster, concentrated on McNutt Road and Appaloosa Drive. For northeast El Paso and Fort Bliss, Chaparral is the shorter drive; for the Upper Valley and Westside, Santa Teresa.</p>
      </div>
      <div class="faq-item">
        <h3>Can I buy weed in New Mexico with a Texas ID?</h3>
        <p>Yes — any adult 21 or older can buy adult-use cannabis with a valid government photo ID. Bringing it back across the state line into Texas is still a criminal offense, so plan to consume in New Mexico.</p>
      </div>
      <div class="faq-item">
        <h3>How much cannabis can I legally buy in one visit?</h3>
        <p>New Mexico&rsquo;s adult-use limit is 2 ounces of flower, 16 grams of concentrate and 800 milligrams of edibles per transaction for recreational customers. Medical cardholders have higher limits.</p>
      </div>
    </div>
  </div>
</main>
` +
    tail
  );
};

// ── Build ──────────────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true });

for (const d of ALL) {
  if (!CITIES[d.city]) {
    console.error(`✖ ${d.name}: no city profile for "${d.city}" — add one to CITIES in this file`);
    process.exit(1);
  }
}

const byCity = {};
for (const d of ALL) (byCity[d.city] ||= []).push(d);
for (const list of Object.values(byCity)) list.sort((a, b) => (a.rank || 999) - (b.rank || 999));

const written = new Set(['index.html']);
writeFileSync(`${OUT_DIR}/index.html`, hubPage(byCity));

let count = 0;
for (const d of ALL) {
  if (LEGACY[d.id]) continue;
  const file = `${slugFor(d)}.html`;
  if (written.has(file)) {
    console.error(`✖ slug collision: ${file} (${d.name})`);
    process.exit(1);
  }
  written.add(file);
  writeFileSync(`${OUT_DIR}/${file}`, dispensaryPage(d, byCity[d.city]));
  count++;
}

// A dispensary removed from the dataset should not leave an orphan page
// behind, indexed and unlinked.
for (const f of readdirSync(OUT_DIR)) {
  if (f.endsWith('.html') && !written.has(f)) {
    unlinkSync(`${OUT_DIR}/${f}`);
    console.log(`  removed stale page: ${OUT_DIR}/${f}`);
  }
}

console.log(`✔ built ${OUT_DIR}/index.html + ${count} dispensary pages (${Object.keys(byCity).length} towns)`);
console.log('  next: npm run sync:chrome -- --fix && npm run check:assets -- --fix');
