const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const SUPABASE_URL = content.match(/const SUPABASE_URL\s*=\s*['"]([^'\"]+)['"]/)[1];
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4d2F6ZHBzbnVwamlvZ214b3puIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjc4NDU1NSwiZXhwIjoyMDk4MzYwNTU1fQ.rAMhoiLOIe6QLla1YEE-BFNL-51cqF1J300_IJ5Yl_A';

async function fixBrands() {
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
  };

  console.log('Fetching product_clubbing...');
  const clubRes = await fetch(SUPABASE_URL + '/rest/v1/product_clubbing?select=raw_product_code,canonical_brand,canonical_product_code', { headers });
  const clubData = await clubRes.json();
  
  const clubMap = {};
  for (let c of clubData) {
    clubMap[c.raw_product_code] = c;
  }

  let offset = 0;
  const limit = 5000;
  let totalUpdates = 0;

  while (true) {
    console.log(`Fetching sales offset ${offset}...`);
    let salesRes = await fetch(`${SUPABASE_URL}/rest/v1/sales?select=*&order=id.asc&limit=${limit}&offset=${offset}`, { headers });
    let data = await salesRes.json();
    if (data.length === 0) break;
    
    let updates = [];
    for (let s of data) {
      const c = clubMap[s.raw_product_code];
      if (c) {
        let needsUpdate = false;
        let newBrand = s.brand;
        let newCanonical = s.canonical_product_code;
        
        if (s.brand !== c.canonical_brand) {
          newBrand = c.canonical_brand;
          needsUpdate = true;
        }
        if (s.canonical_product_code !== c.canonical_product_code) {
          newCanonical = c.canonical_product_code;
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          s.brand = newBrand;
          s.canonical_product_code = newCanonical;
          updates.push(s);
        }
      }
    }

    if (updates.length > 0) {
      console.log(`Updating ${updates.length} rows...`);
      for (let i = 0; i < updates.length; i += 1000) {
        const batch = updates.slice(i, i + 1000);
        const upRes = await fetch(`${SUPABASE_URL}/rest/v1/sales?on_conflict=id`, {
          method: 'POST',
          headers: {
            ...headers,
            'Prefer': 'resolution=merge-duplicates,return=minimal'
          },
          body: JSON.stringify(batch)
        });
        if (!upRes.ok) {
          console.error('Update error:', await upRes.text());
        }
      }
      totalUpdates += updates.length;
    }
    
    offset += limit;
  }
  
  console.log(`Total rows updated: ${totalUpdates}`);
}

fixBrands();
