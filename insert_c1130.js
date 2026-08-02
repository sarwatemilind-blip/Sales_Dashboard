const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const SUPABASE_URL = content.match(/const SUPABASE_URL = "(.*?)"/)[1];
const SUPABASE_ANON_KEY = content.match(/const SUPABASE_ANON_KEY = "(.*?)"/)[1];

async function run() {
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  const newStockist = {
    distributor_code: '013',
    distributor_name: 'NAV DURGA AGENCY',
    distributor_city: 'RANCHI',
    stockist_code: 'C1130',
    stockist_name: 'NEW STOCKIST C1130',
    hq_code: 'S0320',
    hq_name: 'BARHARWA',
    area: 'BARHARWA',
    region: 'JHARKHAND',
    zone: 'EAST ZONE',
    be_emp_id_1: 'ADLA58',
    be_emp_id_2: '',
    be_emp_id_3: '',
    asm_emp_id: '',
    rsm_emp_id: 'ADLA09',
    zm_emp_id: '',
    vp_emp_id: 'ADLA02'
  };

  // Delete if exists
  await fetch(SUPABASE_URL + '/rest/v1/stockist_mapping?stockist_code=eq.C1130', { method: 'DELETE', headers });
  
  // Insert
  const res = await fetch(SUPABASE_URL + '/rest/v1/stockist_mapping', {
    method: 'POST',
    headers,
    body: JSON.stringify(newStockist)
  });
  
  if(res.ok) {
    console.log('Successfully inserted C1130 into stockist_mapping DB');
  } else {
    console.error('Failed to insert', await res.text());
  }
}
run();
