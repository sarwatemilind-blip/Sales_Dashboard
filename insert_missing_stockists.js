const fs = require('fs');

const indexHtml = fs.readFileSync('index.html', 'utf8');
const SUPABASE_URL = indexHtml.match(/const SUPABASE_URL\s*=\s*['"]([^'\"]+)['"]/)[1];
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4d2F6ZHBzbnVwamlvZ214b3puIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjc4NDU1NSwiZXhwIjoyMDk4MzYwNTU1fQ.rAMhoiLOIe6QLla1YEE-BFNL-51cqF1J300_IJ5Yl_A';
const headers = { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY };

async function run() {
    console.log('Reading stockist_mapping.csv...');
    const text = fs.readFileSync('stockist_mapping.csv', 'utf8');
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    const head = lines[0].split(',');
    
    const csvData = lines.slice(1).map(l => {
        // Handle basic commas
        const parts = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < l.length; i++) {
            if (l[i] === '"') inQuotes = !inQuotes;
            else if (l[i] === ',' && !inQuotes) {
                parts.push(cur);
                cur = '';
            } else {
                cur += l[i];
            }
        }
        parts.push(cur);
        return {
            distributor_code: parts[0] || '',
            distributor_name: parts[1] || '',
            distributor_city: parts[2] || '',
            stockist_code: parts[3] || '',
            stockist_name: parts[4] || '',
            hq_code: parts[5] || '',
            hq_name: parts[6] || '',
            area: parts[7] || '',
            region: parts[8] || '',
            zone: parts[9] || '',
            be_emp_id_1: parts[10] || '',
            be_emp_id_2: parts[11] || '',
            be_emp_id_3: parts[12] || '',
            asm_emp_id: parts[13] || '',
            rsm_emp_id: parts[14] || '',
            zm_emp_id: parts[15] || '',
            vp_emp_id: parts[16] || ''
        };
    });

    console.log(`Parsed ${csvData.length} rows from CSV.`);

    console.log('Fetching existing stockists from DB...');
    const r = await fetch(SUPABASE_URL + '/rest/v1/stockist_mapping?select=stockist_code', { headers });
    const dbData = await r.json();
    const dbCodes = new Set(dbData.map(d => d.stockist_code));
    console.log(`Found ${dbCodes.size} stockists in DB.`);

    const toInsert = csvData.filter(d => !dbCodes.has(d.stockist_code) && d.stockist_code);
    console.log(`Found ${toInsert.length} missing stockists to insert.`);

    if (toInsert.length === 0) {
        console.log('Nothing to do!');
        return;
    }

    console.log('Missing stockists:', toInsert.map(x => x.stockist_code).join(', '));

    const ins = await fetch(SUPABASE_URL + '/rest/v1/stockist_mapping', {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=minimal' },
        body: JSON.stringify(toInsert)
    });

    if (ins.ok) {
        console.log('Successfully inserted all missing stockists!');
    } else {
        console.log('Error inserting:', await ins.text());
    }
}
run();
