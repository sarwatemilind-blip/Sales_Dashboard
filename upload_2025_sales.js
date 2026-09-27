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

const excelPath = '(Apr to Oct) 202526Sales.XLSX';
if (!fs.existsSync(excelPath)) {
  console.error('2025 Excel file not found:', excelPath);
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

function mapRow(r) {
  const billDate = getField(r, ['Bill Date', 'Bill_Date', 'BillDate']);
  if (!billDate) return null; // Can't compute month without date

  // billDate in Excel is serial number or string. Let's handle Excel serial dates.
  let date;
  if (typeof billDate === 'number') {
    date = new Date((billDate - (25567 + 2)) * 86400 * 1000);
  } else {
    date = new Date(billDate);
  }
  if (isNaN(date.getTime())) return null;

  const m = date.getMonth(); // 0-11
  const period_month = m >= 3 ? m - 2 : m + 10;
  
  return {
    period_year: 2025,
    period_month: period_month,
    distributor_code: (() => {
      const v = getField(r, ['Distributor Code', 'Distributor_Code']);
      return v ? String(v).padStart(3, '0') : null;
    })(),
    stockist_code: getField(r, ['Stockist Code', 'Stockist_Code']),
    brand: getField(r, ['Brand Name', 'Brand', 'brand']),
    canonical_product_code: getField(r, ['Product Code', 'Canonical Product Code', 'Canonical_Product_Code', 'SKU Code']),
    quantity: Number(getField(r, ['Quantity']) || 0),
    amount: Number(getField(r, ['Amount']) || 0),
    raw_product_code: getField(r, ['SKU Code', 'Product Code']),
    raw_product_name: getField(r, ['Product Name', 'SKU Name', 'Product Name'])
  };
}

const payload = rows.map(mapRow).filter(r => r && r.distributor_code && r.stockist_code);

async function deleteExisting() {
  const url = `${SUPABASE_URL}/rest/v1/sales?period_year=eq.2025&period_month=in.(1,2,3,4,5,6,7)`;
  const res = await fetch(url, { method: 'DELETE', headers: HEADERS });
  if (!res.ok) {
    const txt = await res.text();
    console.error('Failed to delete existing 2025 rows:', txt);
    process.exit(1);
  }
  console.log('Deleted existing 2025 rows for Apr-Oct.');
}

async function upsertBatch(batch) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/sales?on_conflict=id`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(batch)
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error('Batch upsert failed:', txt);
    process.exit(1);
  }
}

(async () => {
  console.log(`Found header at row ${headerIdx + 1}. Uploading ${payload.length} 2025 rows...`);
  await deleteExisting();
  const BATCH_SIZE = 1000;
  for (let i = 0; i < payload.length; i += BATCH_SIZE) {
    const batch = payload.slice(i, i + BATCH_SIZE);
    await upsertBatch(batch);
    console.log(`Uploaded batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} rows)`);
  }
  console.log('2025 sales upload complete.');
})();
