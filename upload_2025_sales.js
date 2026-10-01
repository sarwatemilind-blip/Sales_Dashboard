const fs = require('fs');
const XLSX = require('xlsx');

const indexHtml = fs.readFileSync('index.html', 'utf8');
const SUPABASE_URL = indexHtml.match(/const SUPABASE_URL\s*=\s*['"]([^'\"]+)['"]/)[1];
const SUPABASE_ANON_KEY = indexHtml.match(/const SUPABASE_ANON_KEY\s*=\s*['"]([^'\"]+)['"]/)[1];

const HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
  'Content-Type': 'application/json',
  Prefer: 'resolution=merge-duplicates,return=minimal'
};

function getRows(filename) {
  const workbook = XLSX.readFile(filename);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  let headerIdx = rawRows.findIndex(r => r && r.some(c => typeof c === 'string' && c.toLowerCase().includes('distributor code')));
  const header = rawRows[headerIdx];
  return rawRows.slice(headerIdx + 1).map(arr => {
    const obj = {};
    for (let i = 0; i < header.length; i++) if (header[i]) obj[header[i]] = arr[i];
    return obj;
  });
}

function getField(row, names) {
  for (const n of names) {
    if (Object.prototype.hasOwnProperty.call(row, n)) return row[n];
    const key = Object.keys(row).find(k => k && k.toLowerCase() === n.toLowerCase());
    if (key) return row[key];
  }
  return null;
}

async function fetchClubbingMap() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/product_clubbing?select=raw_product_code,canonical_brand,canonical_product_code`, { headers: HEADERS });
  const data = await res.json();
  const map = {};
  data.forEach(d => {
    map[d.raw_product_code] = d;
  });
  return map;
}

async function run() {
  console.log('Fetching product_clubbing map...');
  const clubMap = await fetchClubbingMap();

  console.log('Loading 2026 data to build exact Brand mapping...');
  const rows26 = getRows('SALES EXPORT AUG26 - Copy.XLSX');
  const map26 = {};
  rows26.forEach(r => {
    const rpc = getField(r, ['Product Code', 'SKU Code']);
    const brand = getField(r, ['Brand Name', 'Brand', 'brand']);
    if (rpc && brand && brand !== '-') {
      map26[rpc] = brand;
    }
  });

  console.log('Loading 2025 data...');
  const rows25 = getRows('(Apr to Oct) 202526Sales.XLSX');
  
  const payload = [];
  rows25.forEach(r => {
    const rpc = getField(r, ['Product Code', 'SKU Code']);
    let cpc = getField(r, ['Canonical Product Code', 'Canonical_Product_Code', 'SKU Code']);
    
    // PRIORITY 1: 2026 Excel mapping
    let brand = map26[rpc];
    if (!brand) {
       // PRIORITY 2: product_clubbing mapping
       if (clubMap[rpc]) {
          brand = clubMap[rpc].canonical_brand;
          cpc = clubMap[rpc].canonical_product_code;
       } else {
          // PRIORITY 3: Fallback to whatever is in the 2025 file
          brand = getField(r, ['Brand Name', 'Brand', 'brand']);
          if (!brand) brand = '-';
       }
    }

    const billDate = getField(r, ['Bill Date', 'Bill_Date', 'BillDate']);
    if (!billDate) return;
    let date = typeof billDate === 'number' ? new Date((billDate - (25567 + 2)) * 86400 * 1000) : new Date(billDate);
    if (isNaN(date.getTime())) return;

    const m = date.getMonth();
    const period_month = m >= 3 ? m - 2 : m + 10;
    
    const dist = getField(r, ['Distributor Code', 'Distributor_Code']);
    const stock = getField(r, ['Stockist Code', 'Stockist_Code']);
    if(!dist || !stock) return;

    payload.push({
      period_year: 2025,
      period_month: period_month,
      distributor_code: String(dist).padStart(3, '0'),
      stockist_code: stock,
      brand: brand,
      canonical_product_code: cpc,
      quantity: Number(getField(r, ['Quantity']) || 0),
      amount: Number(getField(r, ['Amount']) || 0),
      raw_product_code: rpc,
      raw_product_name: getField(r, ['Product Name', 'SKU Name'])
    });
  });

  console.log('Deleting 2025 data...');
  const url = `${SUPABASE_URL}/rest/v1/sales?period_year=eq.2025&period_month=in.(1,2,3,4,5,6,7)`;
  const delRes = await fetch(url, { method: 'DELETE', headers: HEADERS });
  if (!delRes.ok) {
    console.error('Failed to delete existing 2025 rows:', await delRes.text());
    process.exit(1);
  }
  
  console.log(`Uploading ${payload.length} 2025 rows...`);
  const BATCH_SIZE = 1000;
  for (let i = 0; i < payload.length; i += BATCH_SIZE) {
    const batch = payload.slice(i, i + BATCH_SIZE);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/sales?on_conflict=id`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(batch)
    });
    if (!res.ok) {
      console.error('Batch upsert failed:', await res.text());
      process.exit(1);
    }
    console.log(`Uploaded batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} rows)`);
  }
  console.log('2025 sales upload complete with COMBINED BRAND MAPPING.');
}
run();
