const fs = require('fs');

const indexHtml = fs.readFileSync('index.html', 'utf8');
const SUPABASE_URL = indexHtml.match(/const SUPABASE_URL\s*=\s*['"]([^'\"]+)['"]/)[1];
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4d2F6ZHBzbnVwamlvZ214b3puIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjc4NDU1NSwiZXhwIjoyMDk4MzYwNTU1fQ.rAMhoiLOIe6QLla1YEE-BFNL-51cqF1J300_IJ5Yl_A';

const HEADERS = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY,
  'Content-Type': 'application/json',
  Prefer: 'resolution=merge-duplicates,return=minimal'
};

async function fix2025Brands() {
  console.log('Fetching distinct product codes and brands from 2026...');
  let map26 = {};
  let offset = 0;
  while(true) {
    const r = await fetch(SUPABASE_URL + '/rest/v1/sales?period_year=eq.2026&select=raw_product_code,brand&limit=1000&offset=' + offset, { headers: HEADERS });
    const d = await r.json();
    if (d.length === 0) break;
    d.forEach(row => {
      if (row.raw_product_code && row.brand) {
        map26[row.raw_product_code] = row.brand;
      }
    });
    offset += 1000;
  }

  console.log('Fetching product_clubbing map...');
  const clubRes = await fetch(SUPABASE_URL + '/rest/v1/product_clubbing?select=raw_product_code,canonical_brand', { headers: HEADERS });
  const clubData = await clubRes.json();
  const clubMap = {};
  clubData.forEach(d => {
    clubMap[d.raw_product_code] = d.canonical_brand;
  });

  console.log('Fetching all 2025 sales records...');
  offset = 0;
  let all25 = [];
  while(true) {
    const r = await fetch(SUPABASE_URL + '/rest/v1/sales?period_year=eq.2025&select=id,raw_product_code,brand,raw_product_name&limit=1000&offset=' + offset, { headers: HEADERS });
    const d = await r.json();
    if (d.length === 0) break;
    all25 = all25.concat(d);
    offset += 1000;
  }
  
  let updates = [];
  all25.forEach(row => {
    let newBrand = map26[row.raw_product_code];
    if (!newBrand) {
      newBrand = clubMap[row.raw_product_code];
    }
    if (!newBrand) {
      newBrand = (row.raw_product_name || '').replace(/\s*\([^)]*\)$/, '').trim() || '-';
      if ((row.raw_product_name || '').includes('(FREE)')) newBrand += ' (FREE)';
    }
    
    if (newBrand && newBrand !== row.brand) {
      updates.push({ id: row.id, brand: newBrand });
    }
  });

  console.log('Need to update', updates.length, 'records in 2025.');
  
  const CHUNK_SIZE = 50;
  for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
    const chunk = updates.slice(i, i + CHUNK_SIZE);
    await Promise.all(chunk.map(async (u) => {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/sales?id=eq.${u.id}`, {
        method: 'PATCH',
        headers: HEADERS,
        body: JSON.stringify({ brand: u.brand })
      });
      if (!res.ok) {
        console.error('Update failed for id', u.id, await res.text());
      }
    }));
    console.log(`Updated chunk ${Math.floor(i / CHUNK_SIZE) + 1} (${chunk.length} rows)`);
  }
  
  console.log('Done mapping 2025 brands to match 2026.');
}

fix2025Brands();
