#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Parse CSV manually without external dependencies
function parseCSV(csvText) {
  const lines = csvText.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"(.+)"$/, '$1'));

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    // Simple CSV parsing - handles quoted values
    const row = {};
    let col = 0;
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < lines[i].length; j++) {
      const char = lines[i][j];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row[headers[col]] = current.trim().replace(/^"(.+)"$/, '$1');
        current = '';
        col++;
      } else {
        current += char;
      }
    }
    // Add last column
    if (col < headers.length) {
      row[headers[col]] = current.trim().replace(/^"(.+)"$/, '$1');
    }

    rows.push(row);
  }

  return rows;
}

// Convert currency string to number
function parseCurrency(str) {
  if (!str) return 0;
  return parseFloat(str.replace(/[$\s,]/g, ''));
}

// Extract DBA from licensee name
function extractDBA(licensee) {
  // If contains " - " split and use the part before it
  if (licensee.includes(' - ')) {
    return licensee.split(' - ')[0].trim();
  }
  // If contains "/" use the first part
  if (licensee.includes('/')) {
    return licensee.split('/')[0].trim();
  }
  // Otherwise use the full name
  return licensee.trim();
}

// Read and process January 2026
console.log('Processing January 2026...');
const jan2026Path = '/csv/jan_2026.csv';
const jan2026CSV = fs.readFileSync(jan2026Path, 'utf-8');
const jan2026Rows = parseCSV(jan2026CSV);

const jan2026Data = jan2026Rows.map(row => ({
  month: '2026-01',
  licensee: row.Name ? row.Name.trim() : '',
  dba: extractDBA(row.Name || ''),
  total: parseCurrency(row['Total Sales']),
  adultUse: parseCurrency(row['Adult-Use Sales']),
  medical: parseCurrency(row['Medical Sales']),
  city: row.City ? row.City.trim() : '',
  address: row.Address ? row.Address.trim() : ''
})).filter(d => d.licensee); // Filter out empty rows

console.log(`✓ Processed ${jan2026Data.length} January records`);

// Read and process February 2026
console.log('Processing February 2026...');
const feb2026Path = '/csv/feb_2026.csv';
const feb2026CSV = fs.readFileSync(feb2026Path, 'utf-8');
const feb2026Rows = parseCSV(feb2026CSV);

const feb2026Data = feb2026Rows.map(row => ({
  month: '2026-02',
  licensee: row.Licensee ? row.Licensee.trim() : '',
  dba: extractDBA(row.Licensee || ''),
  total: parseCurrency(row['Total Sales']),
  adultUse: parseCurrency(row['Adult-Use Sales']),
  medical: parseCurrency(row['Medical Sales']),
  city: row.City ? row.City.trim() : '',
  address: row.Address ? row.Address.trim() : ''
})).filter(d => d.licensee); // Filter out empty rows

console.log(`✓ Processed ${feb2026Data.length} February records`);

// Combine data
const allNewData = [...jan2026Data, ...feb2026Data];

// Output as JavaScript
const jsCode = 'const newSalesData2026 = ' + JSON.stringify(allNewData, null, 2) + ';';

// Write to output file
const outputPath = '/home/user/greenborder/sales-data-2026.js';
fs.writeFileSync(outputPath, jsCode);
console.log(`\n✓ Output written to ${outputPath}`);

// Also write summary
console.log('\n=== Data Summary ===');
console.log(`Total 2026 records: ${allNewData.length}`);
console.log(`January records: ${jan2026Data.length}`);
console.log(`February records: ${feb2026Data.length}`);
console.log(`Total revenue (Jan + Feb): $${allNewData.reduce((sum, d) => sum + d.total, 0).toFixed(2)}`);
console.log(`Adult-use revenue: $${allNewData.reduce((sum, d) => sum + d.adultUse, 0).toFixed(2)}`);
console.log(`Medical revenue: $${allNewData.reduce((sum, d) => sum + d.medical, 0).toFixed(2)}`);
