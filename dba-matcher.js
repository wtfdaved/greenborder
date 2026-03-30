#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// ============================================================================
// DBA Matching Algorithm - Match 2025 DBAs to 2026 Records
// ============================================================================

/**
 * Normalize address for fuzzy matching
 * Handles abbreviations: Rd→Road, Dr→Drive, Spc→Space, etc.
 */
function normalizeAddress(address) {
  if (!address) return '';

  return address
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\bRD\b/g, 'ROAD')
    .replace(/\bDR\b/g, 'DRIVE')
    .replace(/\bST\b/g, 'STREET')
    .replace(/\bAVE\b/g, 'AVENUE')
    .replace(/\bblvd\b/g, 'BOULEVARD')
    .replace(/\bSPC\b/g, 'SPACE')
    .replace(/\bSTE\b/g, 'SUITE')
    .replace(/\bBLDG\b/g, 'BUILDING')
    .replace(/,\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy address matching
 */
function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;

  const matrix = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return matrix[len1][len2];
}

/**
 * Check if two addresses are similar enough (fuzzy match)
 */
function fuzzyMatch(addr1, addr2, threshold = 15) {
  const norm1 = normalizeAddress(addr1);
  const norm2 = normalizeAddress(addr2);

  if (norm1 === norm2) return true; // exact match after normalization

  const distance = levenshteinDistance(norm1, norm2);
  return distance <= threshold;
}

/**
 * Extract rawData array from HTML file
 */
function extractRawData(htmlContent) {
  const match = htmlContent.match(/const rawData = \[([\s\S]*?)\];/);
  if (!match) {
    throw new Error('Could not find rawData array in HTML file');
  }

  const arrayContent = '[' + match[1] + ']';
  const rawData = eval(arrayContent); // Safe here since we control the file

  if (!Array.isArray(rawData)) {
    throw new Error('rawData is not an array');
  }

  return rawData;
}

/**
 * Build DBA mapping from 2025 records
 */
function build2025Map(records2025) {
  const exactMap = new Map();
  const licenseeGrouped = new Map();

  for (const record of records2025) {
    const key = `${record.licensee}|${record.address}`;

    // Store exact match
    if (!exactMap.has(key)) {
      exactMap.set(key, record.dba);
    }

    // Group by licensee for fuzzy matching
    if (!licenseeGrouped.has(record.licensee)) {
      licenseeGrouped.set(record.licensee, []);
    }

    // Avoid duplicates in grouped list
    const group = licenseeGrouped.get(record.licensee);
    if (!group.find(r => r.address === record.address)) {
      group.push({
        address: record.address,
        dba: record.dba
      });
    }
  }

  return { exactMap, licenseeGrouped };
}

/**
 * Process 2026 records and match with 2025 DBAs
 */
function matchDBAs(records2026, exactMap, licenseeGrouped) {
  const results = {
    primaryMatches: 0,
    secondaryMatches: 0,
    unmatched: 0,
    records: []
  };

  for (const record of records2026) {
    if (!record.month.startsWith('2026')) continue;

    const key = `${record.licensee}|${record.address}`;
    let newDba = record.dba;
    let matchType = 'unmatched';
    let matchDetails = '';

    // Try exact match first
    if (exactMap.has(key)) {
      newDba = exactMap.get(key);
      matchType = 'primary';
      matchDetails = 'Exact licensee + address match';
    } else {
      // Try fuzzy match with same licensee
      const variants = licenseeGrouped.get(record.licensee);
      if (variants && variants.length > 0) {
        for (const variant of variants) {
          if (fuzzyMatch(record.address, variant.address, 15)) {
            newDba = variant.dba;
            matchType = 'secondary';
            matchDetails = `Fuzzy match with address: ${variant.address}`;
            results.secondaryMatches++;
            break;
          }
        }
      }

      if (matchType === 'unmatched') {
        matchDetails = 'No 2025 match found - keeping licensee name';
        results.unmatched++;
      }
    }

    if (matchType === 'primary') {
      results.primaryMatches++;
    }

    results.records.push({
      ...record,
      dba: newDba,
      originalDba: record.dba,
      matchType,
      matchDetails
    });
  }

  return results;
}

/**
 * Generate matching report
 */
function generateReport(results) {
  const total = results.records.length;
  const primaryPct = ((results.primaryMatches / total) * 100).toFixed(1);
  const secondaryPct = ((results.secondaryMatches / total) * 100).toFixed(1);
  const unmatchedPct = ((results.unmatched / total) * 100).toFixed(1);

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    DBA MATCHING REPORT                         ║
╚════════════════════════════════════════════════════════════════╝

SUMMARY:
  Total 2026 Records Processed: ${total}

MATCHING RESULTS:
  ✓ Primary Matches (exact):    ${results.primaryMatches.toString().padStart(3)} records (${primaryPct}%)
  ✓ Secondary Matches (fuzzy):  ${results.secondaryMatches.toString().padStart(3)} records (${secondaryPct}%)
  ✗ Unmatched (new entries):    ${results.unmatched.toString().padStart(3)} records (${unmatchedPct}%)

Overall Match Rate: ${((( results.primaryMatches + results.secondaryMatches) / total) * 100).toFixed(1)}%

═════════════════════════════════════════════════════════════════

UNMATCHED RECORDS (for manual review):
${results.records
  .filter(r => r.matchType === 'unmatched')
  .map(r => {
    return `  • ${r.month} | ${r.licensee}
    Address: ${r.address}
    City: ${r.city}`;
  })
  .join('\n')}

═════════════════════════════════════════════════════════════════

SAMPLE MATCHES:

Primary Matches (Exact):
${results.records
  .filter(r => r.matchType === 'primary')
  .slice(0, 3)
  .map(r => `  • ${r.licensee}
    Original DBA: ${r.originalDba}
    New DBA: ${r.dba}`)
  .join('\n')}

Secondary Matches (Fuzzy):
${results.records
  .filter(r => r.matchType === 'secondary')
  .slice(0, 3)
  .map(r => `  • ${r.licensee}
    Address: ${r.address}
    Original DBA: ${r.originalDba}
    New DBA: ${r.dba}
    ${r.matchDetails}`)
  .join('\n') || '  (None)'}

═════════════════════════════════════════════════════════════════
`);

  return {
    total,
    primaryMatches: results.primaryMatches,
    secondaryMatches: results.secondaryMatches,
    unmatched: results.unmatched,
    matchRate: (((results.primaryMatches + results.secondaryMatches) / total) * 100).toFixed(1)
  };
}

/**
 * Replace rawData in HTML with updated records
 */
function updateHTMLWithNewDBA(htmlContent, matchResults) {
  // Build new rawData array with all records (both 2025 and updated 2026)
  const allRecords = matchResults.records.map(r => ({
    month: r.month,
    licensee: r.licensee,
    dba: r.dba,
    total: r.total,
    adultUse: r.adultUse,
    medical: r.medical,
    city: r.city,
    address: r.address
  }));

  // Convert to JavaScript array format
  const arrayString = JSON.stringify(allRecords, null, 8)
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .replace(/"/g, "'");  // Use single quotes for JS object keys

  // Find and replace the rawData array
  const updated = htmlContent.replace(
    /const rawData = \[([\s\S]*?)\];/,
    `const rawData = [\n${arrayString}\n    ];`
  );

  return updated;
}

/**
 * Main execution
 */
function main() {
  try {
    console.log('🔍 Starting DBA matching process...\n');

    // Read HTML file
    console.log('📂 Reading data.html...');
    const htmlPath = '/home/user/greenborder/data.html';
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

    // Extract rawData
    console.log('📊 Extracting rawData array...');
    const rawData = extractRawData(htmlContent);
    console.log(`   Found ${rawData.length} total records`);

    // Separate 2025 and 2026 data
    const records2025 = rawData.filter(r => r.month.startsWith('2025'));
    const records2026 = rawData.filter(r => r.month.startsWith('2026'));

    console.log(`   - 2025 records: ${records2025.length}`);
    console.log(`   - 2026 records: ${records2026.length}`);
    console.log();

    // Build 2025 mapping
    console.log('🗺️  Building 2025 DBA mapping...');
    const { exactMap, licenseeGrouped } = build2025Map(records2025);
    console.log(`   - Exact matches available: ${exactMap.size}`);
    console.log(`   - Unique licensees: ${licenseeGrouped.size}`);
    console.log();

    // Match DBAs
    console.log('🔗 Matching 2026 records to 2025 DBAs...');
    const matchResults = matchDBAs(records2026, exactMap, licenseeGrouped);
    console.log(`   - Processed ${matchResults.records.length} records`);
    console.log();

    // Build combined results (2025 + updated 2026)
    const finalResults = {
      records: [...records2025, ...matchResults.records]
    };
    finalResults.primaryMatches = matchResults.primaryMatches;
    finalResults.secondaryMatches = matchResults.secondaryMatches;
    finalResults.unmatched = matchResults.unmatched;

    // Generate report
    const summary = generateReport(matchResults);

    // Check match rate
    if (summary.matchRate < 85) {
      console.log('⚠️  WARNING: Match rate below 85%. Review results before updating HTML.\n');
      process.exit(1);
    }

    console.log('✅ Match rate acceptable. Updating HTML file...\n');

    // Update HTML
    const updatedHTML = updateHTMLWithNewDBA(htmlContent, finalResults);

    // Verify the HTML is valid
    if (!updatedHTML.includes('const rawData =')) {
      throw new Error('Failed to update HTML - rawData array not found in output');
    }

    // Backup original and write new file
    const backupPath = htmlPath + '.backup';
    fs.copyFileSync(htmlPath, backupPath);
    console.log(`📦 Backup created: ${backupPath}`);

    fs.writeFileSync(htmlPath, updatedHTML);
    console.log(`💾 Updated: ${htmlPath}`);

    // Write match report to file
    const reportPath = '/home/user/greenborder/dba-match-report.txt';
    const reportContent = `DBA MATCHING REPORT
Generated: ${new Date().toISOString()}

${summary.total} records processed
${summary.primaryMatches} primary matches (${(summary.primaryMatches/summary.total*100).toFixed(1)}%)
${summary.secondaryMatches} secondary matches (${(summary.secondaryMatches/summary.total*100).toFixed(1)}%)
${summary.unmatched} unmatched (${(summary.unmatched/summary.total*100).toFixed(1)}%)

Match Rate: ${summary.matchRate}%

${matchResults.records
  .filter(r => r.matchType === 'unmatched')
  .map(r => `UNMATCHED: ${r.month} | ${r.licensee} | ${r.address}`)
  .join('\n')}
`;
    fs.writeFileSync(reportPath, reportContent);
    console.log(`📋 Report written: ${reportPath}`);

    console.log(`\n✨ DBA matching complete! Match rate: ${summary.matchRate}%`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { normalizeAddress, levenshteinDistance, fuzzyMatch };
