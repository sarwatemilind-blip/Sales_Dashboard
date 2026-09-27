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

const excelPath = 'SALES EXPORT AUG26 - Copy.XLSX';
if (!fs.existsSync(excelPath)) {
  console.error('August Excel file not found:', excelPath);
  process.exit(1);
}

const workbook = XLSX.readFile(excelPath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
if (rawRows.length === 0) {
  console.error('Excel sheet is empty');
  process.exit(1);
}

let headerIdx = rawRows.findIndex(r => r && r.some(c => typeof c === 'string' && c.toLowerCase().includes('distributor code')));
if (headerIdx === -1) {
  console.error('Could not locate header row with "Distributor Code"');
  process.exit(1);
}
const header = rawRows[headerIdx];
const dataRows = rawRows.slice(headerIdx + 1);

function rowArrayToObj(arr) {
  const obj = {};
  for (let i = 0; i < header.length; i++) {
    const key = header[i];
    if (key) obj[key] = arr[i];
  }
  return obj;
}
const rows = dataRows.map(rowArrayToObj);

function getField(row, names) {
  for (const n of names) {
    if (Object.prototype.hasOwnProperty.call(row, n)) return row[n];
    const key = Object.keys(row).find(k => k && k.toLowerCase() === n.toLowerCase());
    if (key) return row[key];
  }
  return null;
}

async function uploadAugustSales() {
  const clubRes = await fetch(SUPABASE_URL + '/rest/v1/product_clubbing?select=raw_product_code,canonical_brand,canonical_product_code', { headers: HEADERS });
  const clubData = await clubRes.json();
  const clubMap = {};
  for (let c of clubData) clubMap[c.raw_product_code] = c;

  function mapRow(r) {
    let rpc = getField(r, ['Product Code', 'SKU Code']);
    let b = getField(r, ['Brand Name', 'Brand', 'brand']);
    let cpc = getField(r, ['Canonical Product Code', 'Product Code']);
    
    const club = clubMap[rpc];
    if (club) {
      b = club.canonical_brand;
      cpc = club.canonical_product_code;
    } else {
      b = '-';
    }

    return {
      period_year: 2026,
      period_month: 8,
      distributor_code: (() => {
        const v = getField(r, ['Distributor Code', 'Distributor_Code']);
        return v ? String(v).padStart(3, '0') : null;
      })(),
      stockist_code: getField(r, ['Stockist Code', 'Stockist_Code']),
      brand: b,
      canonical_product_code: cpc,
      quantity: Number(getField(r, ['Quantity']) || 0),
      amount: Number(getField(r, ['Amount']) || 0),
      raw_product_code: rpc,
      raw_product_name: getField(r, ['Product Name', 'SKU Name'])
    };
  }

  const payload = rows.map(mapRow).filter(r => r.distributor_code && r.stockist_code);

  const url = `${SUPABASE_URL}/rest/v1/sales?period_year=eq.2026&period_month=eq.8`;
  const res = await fetch(url, { method: 'DELETE', headers: HEADERS });
  if (!res.ok) {
    console.error('Failed to delete existing August rows:', await res.text());
    process.exit(1);
  }
  console.log('Deleted any existing August 2026 rows.');

  console.log(`Found header at row ${headerIdx + 1}. Uploading ${payload.length} August 2026 rows...`);
  const BATCH_SIZE = 1000;
  for (let i = 0; i < payload.length; i += BATCH_SIZE) {
    const batch = payload.slice(i, i + BATCH_SIZE);
    const upRes = await fetch(`${SUPABASE_URL}/rest/v1/sales?on_conflict=id`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(batch)
    });
    if (!upRes.ok) {
      console.error('Batch upsert failed:', await upRes.text());
      process.exit(1);
    }
    console.log(`Uploaded batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} rows)`);
  }
  console.log('August 2026 sales upload complete.');
}

uploadAugustSales();
