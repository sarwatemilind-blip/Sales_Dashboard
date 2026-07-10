import csv
from collections import defaultdict

# Load current mapping codes
mapping_codes = set()
with open('stockist_mapping.csv', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        mapping_codes.add(row['stockist_code'].strip())

# FY month labels
month_labels = {1:'Apr-25', 2:'May-25', 3:'Jun-25', 4:'Jul-25', 5:'Aug-25', 6:'Sep-25',
                7:'Oct-25', 8:'Nov-25', 9:'Dec-25', 10:'Jan-26', 11:'Feb-26', 12:'Mar-26'}

# Aggregate by year, month
total = defaultdict(float)
matched = defaultdict(float)
missing_by_month = defaultdict(lambda: defaultdict(float))

# Also track old missing (before this fix) vs now
old_missing_codes = {'C1120','C1122','C1123','C1121','C0426','C1080','C1097'}

with open('sales.csv', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        try:
            yr = int(row.get('period_year','0'))
            mo = int(row.get('period_month','0'))
            amt = float(row.get('amount','0') or 0)
        except:
            continue
        if yr != 2026:
            continue
        key = (yr, mo)
        total[key] += amt
        sc = row.get('stockist_code','').strip()
        if sc in mapping_codes:
            matched[key] += amt
        else:
            missing_by_month[key][sc] += amt

print(f"{'Month':<10} {'Total Sales (L)':>16} {'In Dashboard (L)':>17} {'Gap (L)':>10} {'% Gap':>7}")
print("-"*65)
grand_total = grand_matched = 0
for mo in range(1, 13):
    key = (2026, mo)
    if total[key] == 0:
        continue
    t = total[key]
    m = matched[key]
    gap = t - m
    pct = (gap/t*100) if t > 0 else 0
    label = month_labels.get(mo, f"M{mo}")
    print(f"{label:<10} {t/100000:>16.2f} {m/100000:>17.2f} {gap/100000:>10.2f} {pct:>6.1f}%")
    grand_total += t
    grand_matched += m
    
    if missing_by_month[key]:
        for sc, amt in sorted(missing_by_month[key].items(), key=lambda x: -x[1]):
            print(f"           Missing: {sc} = {amt/100000:.2f}L")

print("-"*65)
gap = grand_total - grand_matched
print(f"{'TOTAL':<10} {grand_total/100000:>16.2f} {grand_matched/100000:>17.2f} {gap/100000:>10.2f} {(gap/grand_total*100):>6.1f}%")
