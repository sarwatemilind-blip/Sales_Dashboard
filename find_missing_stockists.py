import csv
from collections import defaultdict

missing_codes = {'C1120','C1122','C1123','C1121','C0426','C1080','C1097'}
seen = {}
monthly_sales = defaultdict(float)

with open('sales.csv', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        sc = row.get('stockist_code','').strip()
        if sc in missing_codes:
            if sc not in seen:
                seen[sc] = {
                    'stockist_code': sc,
                    'stockist_name': row.get('stockist_name','').strip(),
                    'distributor_code': row.get('distributor_code','').strip(),
                    'hq_code': row.get('hq_code','').strip(),
                    'hq_name': row.get('hq_name','').strip(),
                }
            try:
                monthly_sales[sc] += float(row.get('amount','0') or 0)
            except:
                pass

print("Stockists missing from mapping:")
print(f"{'Code':<8} | {'Name':<45} | {'Dist':<5} | {'HQ':<7} | {'HQ Name':<25} | {'Total Sales (L)'}")
print("-"*130)
for sc in sorted(seen.keys(), key=lambda x: -monthly_sales[x]):
    d = seen[sc]
    print(f"{d['stockist_code']:<8} | {d['stockist_name']:<45} | {d['distributor_code']:<5} | {d['hq_code']:<7} | {d['hq_name']:<25} | {monthly_sales[sc]/100000:.4f}")
