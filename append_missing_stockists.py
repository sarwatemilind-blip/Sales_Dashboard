import csv

# New rows to append
# Format: distributor_code,distributor_name,distributor_city,stockist_code,stockist_name,
#         hq_code,hq_name,area,region,zone,be_emp_id_1,be_emp_id_2,be_emp_id_3,
#         asm_emp_id,rsm_emp_id,zm_emp_id,vp_emp_id

new_rows = [
    # C1120 - MAA SANTOSHIDRUG DISTRIBUTOR, NORTH LAKHIMPUR -> BE1=ADLA46, RSM=ADLA05
    ['021','ADONIS LABORATORIES PVT.LTD.','GUWAHATI','C1120','MAA SANTOSHIDRUG DISTRIBUTOR',
     'S0154','NORTH LAKHIMPUR','NORTH LAKHIMPUR','ASSAM','EAST ZONE',
     'ADLA46','','','','ADLA05','','ADLA02'],
    
    # C1122 - PRASAD DRUG DISTRIBUTORS, PATNA -> BE1=ADLA73, BE2=ADLA72, ASM=ADLA13, RSM=ADLA12
    ['011','SHREE BALAJI ENTERPRISES','PATNA','C1122','PRASAD DRUG DISTRIBUTORS',
     'S0270','PATNA','PATNA','BIHAR','EAST ZONE',
     'ADLA73','ADLA72','','ADLA13','ADLA12','','ADLA02'],
    
    # C1123 - SAI RADHA PHARMA(INDIA)PVT.LTD.-MLR, MANGALORE -> ASM=ADKAASM1, VP=ADLA02 (no BEs in HQ)
    ['014','V.K.CORPORATION','BANGALORE','C1123','SAI RADHA PHARMA(INDIA)PVT.LTD.-MLR',
     'S0142','MANGALORE','MANGALORE','KARNATAKA','SOUTH ZONE',
     '','','','ADKAASM1','','','ADLA02'],
    
    # C1121 - N.S. MEDICAL AGENCY, AURANGABAD (Bihar) -> BE1=ADLA80, ASM=ADLA14, RSM=ADLA12
    ['011','SHREE BALAJI ENTERPRISES','PATNA','C1121','N. S. MEDICAL AGENCY',
     'S0359','AURANGABAD','PATNA','BIHAR','EAST ZONE',
     'ADLA80','','','ADLA14','ADLA12','','ADLA02'],
    
    # C1097 - SANTOSHI MEDICAL STORES, DURG -> BE1=ADCGBE4, ASM=ADLA28, VP=ADLA02
    ['012','SEN MEDICOS DISTRIBUTORS','RAIPUR','C1097','SANTOSHI MEDICAL STORES',
     'S0073','DURG','DURG','CHHATTISGARH','CENTRAL ZONE',
     'ADCGBE4','','','ADLA28','','','ADLA02'],
    
    # C0426 - P.S.MEDICO, SAGAR -> no BEs in master for S0180, only VP known
    # NEED BE CONFIRMATION - adding with blanks for now
    ['016','ADONIS LABORATORIES PVT.LTD.','INDORE','C0426','P.S.MEDICO',
     'S0180','SAGAR','SAGAR','MADHYA PRADESH','CENTRAL ZONE',
     '','','','','','','ADLA02'],
    
    # C1080 - UMGAON MEDICAL & SURGICAL, LAHERIASARAI -> HQ S0227 not in master
    # NEED BE CONFIRMATION - adding with blanks for now
    ['011','SHREE BALAJI ENTERPRISES','PATNA','C1080','UMGAON MEDICAL & SURGICAL',
     'S0227','LAHERIASARAI','LAHERIASARAI','BIHAR','EAST ZONE',
     '','','','','ADLA12','','ADLA02'],
]

headers = ['distributor_code','distributor_name','distributor_city','stockist_code','stockist_name',
           'hq_code','hq_name','area','region','zone',
           'be_emp_id_1','be_emp_id_2','be_emp_id_3',
           'asm_emp_id','rsm_emp_id','zm_emp_id','vp_emp_id']

# Read existing CSV
with open('stockist_mapping.csv', encoding='utf-8', newline='') as f:
    content = f.read()

# Append new rows
with open('stockist_mapping.csv', 'a', encoding='utf-8', newline='') as f:
    writer = csv.writer(f, lineterminator='\n')
    for row in new_rows:
        writer.writerow(row)

print("Done! Added rows:")
for r in new_rows:
    print(f"  {r[3]} | {r[4]} | HQ:{r[5]} | BE1:{r[10]} | BE2:{r[11]} | ASM:{r[13]} | RSM:{r[14]}")

print()
print("NEEDS MANUAL BE ASSIGNMENT:")
print("  C0426 (P.S.MEDICO, SAGAR) - HQ S0180 has no BEs in master")
print("  C1080 (UMGAON MEDICAL, LAHERIASARAI) - HQ S0227 not in master Excel")
