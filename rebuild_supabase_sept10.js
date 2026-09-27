const fs = require('fs');
const XLSX = require('./xlsx.full.min.js');

const content = fs.readFileSync('index.html', 'utf8');
const SUPABASE_URL = content.match(/const SUPABASE_URL\s*=\s*['"]([^'\"]+)['"]/)[1];
const SUPABASE_ANON_KEY = content.match(/const SUPABASE_ANON_KEY\s*=\s*['"]([^'\"]+)['"]/)[1];

const headers = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
};

async function execute() {
  console.log('=== STEP 1: Clearing existing Supabase tables ===');
  
  // Clear sales
  let res = await fetch(`${SUPABASE_URL}/rest/v1/sales?id=gt.0`, { method: 'DELETE', headers });
  console.log('Cleared sales table:', res.status);
  
  // Clear targets
  res = await fetch(`${SUPABASE_URL}/rest/v1/targets?id=gt.0`, { method: 'DELETE', headers });
  console.log('Cleared targets table:', res.status);

  // Clear stockist_mapping
  res = await fetch(`${SUPABASE_URL}/rest/v1/stockist_mapping?id=gt.0`, { method: 'DELETE', headers });
  console.log('Cleared stockist_mapping table:', res.status);

  console.log('\n=== STEP 2: Re-populating stockist_mapping from CFA-Stockist-HQ_Mapping_Master_Updated.xlsx ===');
  const smBuf = fs.readFileSync('CFA-Stockist-HQ_Mapping_Master_Updated.xlsx');
  const smWb = XLSX.read(smBuf, { type: 'buffer' });
  const smData = XLSX.utils.sheet_to_json(smWb.Sheets[smWb.SheetNames[0]]);
  
  let smMap = {};
  const smBatch = smData.map(r => {
    const sc = String(r['Stockist Code'] || '').trim();
    const obj = {
      distributor_code: String(r['Distributor Code'] || ''),
      distributor_name: String(r['Distributorname'] || ''),
      distributor_city: String(r['Distributorcity'] || ''),
      stockist_code: sc,
      stockist_name: String(r['Stockist Name'] || ''),
      hq_code: String(r['HQ Code'] || ''),
      hq_name: String(r['HQ'] || ''),
      area: String(r['Area Name'] || ''),
      region: String(r['Region Name'] || ''),
      zone: String(r['Zone Name'] || ''),
      be_emp_id_1: String(r['BE Id - 1'] || ''),
      be_emp_id_2: String(r['BE Id - 2'] || ''),
      be_emp_id_3: String(r['BE Id - 3'] || ''),
      asm_emp_id: String(r['ASM EMP id'] || ''),
      rsm_emp_id: String(r['RSM Code'] || ''),
      zm_emp_id: String(r['ZM Code'] || ''),
      vp_emp_id: String(r['VP Code'] || '')
    };
    if (sc) smMap[sc] = obj;
    return obj;
  });

  for (let i = 0; i < smBatch.length; i += 1000) {
    const chunk = smBatch.slice(i, i + 1000);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/stockist_mapping`, { method: 'POST', headers, body: JSON.stringify(chunk) });
    console.log(`Inserted stockist_mapping ${i}..${i + chunk.length} -> Status: ${r.status}`);
  }

  console.log('\n=== STEP 3: Re-populating targets from targets.csv ===');
  const targetsRaw = fs.readFileSync('targets.csv', 'utf8');
  const lines = targetsRaw.split(/\r?\n/);
  const targetHeaders = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  
  const targetRows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 15) continue;
    targetRows.push({
      emp_id: cols[0],
      hq_code: cols[1],
      hq_name: cols[2],
      brand: cols[3],
      product_code: cols[4],
      state: cols[5],
      region: cols[6],
      no_of_be: Number(cols[7]) || 1,
      month_num: Number(cols[8]) || 1,
      month_name: cols[9],
      year: Number(cols[10]) || 2026,
      val_target_total: Number(cols[11]) || 0,
      unit_target_total: Number(cols[12]) || 0,
      val_target_per_be: Number(cols[13]) || 0,
      unit_target_per_be: Number(cols[14]) || 0
    });
  }

  console.log(`Parsed ${targetRows.length} target rows.`);
  for (let i = 0; i < targetRows.length; i += 1000) {
    const chunk = targetRows.slice(i, i + 1000);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/targets`, { method: 'POST', headers, body: JSON.stringify(chunk) });
    if (!r.ok) console.log(`Error inserting targets batch ${i}:`, await r.text());
    else console.log(`Inserted targets ${i}..${i + chunk.length}`);
  }

  console.log('\n=== STEP 4: Re-populating sales from 9 monthly files ===');
  const filesConfig = [
    { file: 'Nov25 Sales.XLSX', year: 2025, month: 8 },
    { file: 'Dec25 Sales.XLSX', year: 2025, month: 9 },
    { file: 'Jan26 Sales.XLSX', year: 2025, month: 10 },
    { file: 'Feb26 Sales.XLSX', year: 2025, month: 11 },
    { file: 'Mar26 Sales.XLSX', year: 2025, month: 12 },
    { file: 'APR26 SALE.XLSX', year: 2026, month: 1 },
    { file: 'May26 Sales Interact.XLSX', year: 2026, month: 2 },
    { file: 'June 2026 Sales.XLSX', year: 2026, month: 3 },
    { file: 'Jul Sale.XLSX', year: 2026, month: 4 }
  ];

  for (let cfg of filesConfig) {
    if (!fs.existsSync(cfg.file)) continue;
    console.log(`\nProcessing ${cfg.file} (Year: ${cfg.year}, Fiscal Month: ${cfg.month})...`);
    
    const buf = fs.readFileSync(cfg.file);
    const wb = XLSX.read(buf, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    
    let headerIdx = rawRows.findIndex(r => r && r.some(c => String(c).toLowerCase().includes('distributor code')));
    if (headerIdx === -1) continue;
    
    const header = rawRows[headerIdx];
    const dataRows = rawRows.slice(headerIdx + 1);
    
    const salesBatch = [];
    for (let rowArr of dataRows) {
      const r = {};
      for (let i = 0; i < header.length; i++) {
        if (header[i]) r[String(header[i]).trim()] = rowArr[i];
      }
      const sc = String(r['Stockist Code'] || r['Stockist code'] || '').trim();
      if (!sc) continue;
      
      let hqName = String(r['HQ Name'] || r['HQ'] || '').trim();
      let hqCode = String(r['HQ Code'] || '').trim();
      let sm = smMap[sc];
      if (sm) {
        if (sm.hq_name) hqName = sm.hq_name;
        if (sm.hq_code) hqCode = sm.hq_code;
      }
      
      let bdRaw = r['Bill Date'];
      let bd = '';
      if (typeof bdRaw === 'number') {
        const dt = new Date(Math.round((bdRaw - 25569) * 86400 * 1000));
        bd = dt.toISOString().split('T')[0];
      } else {
        bd = String(bdRaw);
      }
      
      salesBatch.push({
        period_year: cfg.year,
        period_month: cfg.month,
        bill_date: bd,
        distributor_code: String(r['Distributor Code'] || ''),
        stockist_code: sc,
        stockist_name: String(r['Stockist Name'] || ''),
        hq_code: hqCode,
        hq_name: hqName,
        mr_emp_id: String(r['Mr Emp ID'] || r['MR Code'] || ''),
        mr_name: String(r['Mr Name'] || r['MR Name'] || ''),
        raw_product_code: String(r['Product Code'] || ''),
        raw_product_name: String(r['Product Name'] || ''),
        brand: String(r['Brand Name'] || r['Brand'] || ''),
        canonical_product_code: String(r['Product Code'] || ''),
        quantity: Number(r['Qty'] || r['Quantity']) || 0,
        amount: Number(r['Amount']) || 0,
        uploaded_by: 'SYSTEM_RESTORE'
      });
    }
    
    console.log(`Uploading ${salesBatch.length} sales rows for ${cfg.file}...`);
    for (let i = 0; i < salesBatch.length; i += 1000) {
      const chunk = salesBatch.slice(i, i + 1000);
      const r = await fetch(`${SUPABASE_URL}/rest/v1/sales`, { method: 'POST', headers, body: JSON.stringify(chunk) });
      if (!r.ok) console.log(`Error uploading sales chunk ${i}:`, await r.text());
    }
  }

  console.log('\n=== RESTORATION COMPLETE ===');
}

execute();
