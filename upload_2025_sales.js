const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const SUPABASE_URL = 'https://jxwazdpsnupjiogmxozn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4d2F6ZHBzbnVwamlvZ214b3puIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjc4NDU1NSwiZXhwIjoyMDk4MzYwNTU1fQ.rAMhoiLOIe6QLla1YEE-BFNL-51cqF1J300_IJ5Yl_A';
const headers = { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` };

// Excel date to JS date
function excelDateToJSDate(serial) {
  const utc_days  = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;                                        
  const date_info = new Date(utc_value * 1000);
  return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate());
}

async function upload2025Sales() {
  const filePath = path.join(__dirname, '(Apr to Oct) 202526Sales.XLSX');
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    return;
  }
  
  // Load product clubbing to resolve brand and canonical product code
  const clubRes = await fetch(`${SUPABASE_URL}/rest/v1/product_clubbing?select=*`, { headers });
  const clubData = await clubRes.json();
  const clubMap = {};
  clubData.forEach(c => clubMap[c.raw_product_code] = c);
  
  console.log('Reading Excel file...');
  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  // Skip the first row which is messed up. Let's find the header row index
  const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  let headerIndex = -1;
  for (let i = 0; i < rawData.length; i++) {
    if (rawData[i].some(v => typeof v === 'string' && v.toLowerCase().includes('stockist code'))) {
      headerIndex = i;
      break;
    }
  }
  
  if (headerIndex === -1) {
    console.error('Could not find header row');
    return;
  }
  
  const headersRow = rawData[headerIndex];
  const rows = [];
  for (let i = headerIndex + 1; i < rawData.length; i++) {
    const rowArray = rawData[i];
    if (!rowArray || rowArray.length === 0) continue;
    
    const row = {};
    headersRow.forEach((h, colIdx) => {
      if (h) row[h] = rowArray[colIdx];
    });
    rows.push(row);
  }
  
  const batch = rows.filter(r => r['Stockist Code']).map(r => {
    let billDateVal = r['Bill Date'];
    let dateObj;
    if (typeof billDateVal === 'number') {
      dateObj = excelDateToJSDate(billDateVal);
    } else if (typeof billDateVal === 'string') {
      dateObj = new Date(billDateVal);
    }
    
    // FY is April to March
    let period_year = dateObj.getFullYear();
    let month = dateObj.getMonth() + 1; // 1-12
    if (month >= 4) {
      // Apr-Dec is same year as FY start
    } else {
      // Jan-Mar is next year, so FY start is previous year
      period_year -= 1;
    }
    
    // Period month: April = 1, March = 12
    let period_month = month >= 4 ? month - 3 : month + 9;
    
    let rawProductCode = r['Product Code'] || '';
    let canonical = clubMap[rawProductCode];
    let brand = canonical ? canonical.brand : '-';
    let canonicalCode = canonical ? canonical.canonical_product_code : rawProductCode;
    
    return {
      period_year: Number(period_year) || 0,
      period_month: Number(period_month) || 0,
      bill_date: dateObj ? String(dateObj.toISOString().split('T')[0]) : '2025-01-01',
      stockist_code: String(r['Stockist Code'] || ''),
      hq_code: String(r['HQ Code'] || ''),
      hq_name: String(r['HQ'] || ''),
      raw_product_code: String(rawProductCode || ''),
      canonical_product_code: String(canonicalCode || ''),
      brand: String(brand || ''),
      quantity: Number(r['Quantity']) || 0,
      amount: Number(r['Netamount']) || 0
    };
  });
  
  console.log(`Parsed ${batch.length} rows.`);
  
  const CHUNK = 5000;
  for (let i = 0; i < batch.length; i += CHUNK) {
    const chunk = batch.slice(i, i + CHUNK);
    console.log(`Inserting ${i} to ${i + CHUNK}...`);
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/sales`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(chunk)
    });
    if (!resp.ok) {
      console.error('Error inserting chunk:', await resp.text());
    }
  }
  console.log('Finished uploading 2025 sales');
}

upload2025Sales().catch(console.error);
