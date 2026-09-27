const SUPABASE_URL = 'https://jxwazdpsnupjiogmxozn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4d2F6ZHBzbnVwamlvZ214b3puIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjc4NDU1NSwiZXhwIjoyMDk4MzYwNTU1fQ.rAMhoiLOIe6QLla1YEE-BFNL-51cqF1J300_IJ5Yl_A';
const headers = { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY };

async function forceUpdate2025() {
  const clubRes = await fetch(SUPABASE_URL + '/rest/v1/product_clubbing?select=raw_product_code,canonical_brand,canonical_product_code', { headers });
  const clubData = await clubRes.json();
  const clubMap = {};
  for (let c of clubData) clubMap[c.raw_product_code] = c;

  let offset = 0;
  const limit = 5000;
  let totalUpdates = 0;
  
  while (true) {
    console.log(`Fetching 2025 sales offset ${offset}...`);
    const salesRes = await fetch(`${SUPABASE_URL}/rest/v1/sales?period_year=eq.2025&select=*&order=id.asc&limit=${limit}&offset=${offset}`, { headers });
    const data = await salesRes.json();
    if (data.length === 0) break;
    
    let updates = [];
    for (let s of data) {
      const c = clubMap[s.raw_product_code];
      if (c) {
        if (s.brand !== c.canonical_brand || s.canonical_product_code !== c.canonical_product_code) {
          s.brand = c.canonical_brand;
          s.canonical_product_code = c.canonical_product_code;
          updates.push(s);
        }
      } else {
        // If it doesn't exist in clubbing, set brand to '-' so it doesn't stay as empty string
        if (s.brand !== '-') {
          s.brand = '-';
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
          headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(batch)
        });
        if (!upRes.ok) console.error(await upRes.text());
      }
      totalUpdates += updates.length;
    }
    offset += limit;
  }
  console.log('Total 2025 rows fixed:', totalUpdates);
}
forceUpdate2025();
