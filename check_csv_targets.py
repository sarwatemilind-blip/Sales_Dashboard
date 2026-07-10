import pandas as pd

df = pd.read_csv("targets.csv")
df_apr = df[(df['year'] == 2026) & (df['month_num'] == 1)]

print("Sum of val_target_total (Lakhs):", df_apr['val_target_total'].sum())
print("Sum of val_target_per_be (Lakhs):", df_apr['val_target_per_be'].sum())
print("Sum of val_target_total * 100,000:", df_apr['val_target_total'].sum() * 100000)
print("Sum of val_target_per_be * 100,000:", df_apr['val_target_per_be'].sum() * 100000)
