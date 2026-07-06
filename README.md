# Adonis Field Force Sales Dashboard — Setup Guide

## What's in this package
- `schema.sql` — run once in your Supabase project (SQL Editor → New query → paste → Run)
- `employees.csv`, `targets.csv`, `stockist_mapping.csv`, `product_clubbing.csv`, `sales.csv` — data extracted from your 5 source files, ready to import
- `app.html` — the single-file web app (login + dashboard + admin upload). Host it anywhere (a free Netlify/Vercel static site, an internal IIS/Apache folder, or even Supabase Storage) — same idea as Pravesh.

## Step 1 — Create / open your Supabase project
If you don't already have one for this app, create a new Supabase project (free tier is enough to start).

## Step 2 — Run the schema
Open SQL Editor → paste the full contents of `schema.sql` → Run.
This creates: `employees`, `stockist_mapping`, `product_clubbing`, `targets`, `sales` tables, the `sales_attributed` view, the `downline()` and `login()`/`set_password()` functions, and basic RLS.

## Step 3 — Import the CSVs
In Supabase → Table Editor → open each table → "Insert" → "Import data from CSV" → upload the matching file:
- `employees.csv` → `employees`
- `stockist_mapping.csv` → `stockist_mapping`
- `product_clubbing.csv` → `product_clubbing`
- `targets.csv` → `targets`
- `sales.csv` → `sales` (this is your April + May 2026 actuals — first real data in the system)

## Step 4 — Set initial passwords
In SQL Editor, run once:
```sql
select set_password(emp_id, emp_id) from employees;
```
Every employee's password is now their own Employee ID. Tell your field force to log in with their Employee ID for both fields the first time. (There's no "change password" screen yet — see Next steps below if you want one.)

## Step 5 — Make yourself (and any HQ admins) an admin
```sql
update employees set is_admin = true where emp_id = 'ADLA02'; -- your emp id
```
Admins see an "Admin Upload" tab to push daily/monthly sales files straight from the browser.

## Step 6 — Configure the app
Open `app.html` in a text editor and fill in your project's URL and anon/public key near the top:
```js
const SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";
```
Both are in Supabase → Project Settings → API. Then host `app.html` anywhere reachable by your field force (or just open it locally to test first).

## How the data model works
- **Employees & hierarchy**: built from the "HQ wise Targets" file (BE ↔ Manager) plus the CFA-Stockist-HQ mapping file (fills in ASM → RSM → ZM → VP where present). Everyone ultimately rolls up to VP (ADLA02 / Milind Sarwate). A manager automatically sees the combined figures of everyone below them in this chain (via the `downline()` SQL function) — no per-person configuration needed.
- **Targets**: each HQ-wise-target row is split evenly across that HQ's "No. of BEs" and assigned individually to the listed Employee ID(s) for that HQ — exactly as you described. A manager's target is just the sum of their downline's individual targets.
- **Sales attribution**: the raw sales reports use a *different* employee-code scheme (e.g. `M01108`) than your master employee IDs (e.g. `ADLA95`). So sales are **not** attributed by the MR code printed on the sales report — they're attributed by joining `stockist_code` through the CFA-Stockist-HQ mapping to find the BE Employee ID(s) actually linked to that stockist (the `sales_attributed` view does this). If a stockist has more than one BE mapped, the sale is split evenly between them.
- **Product clubbing**: any sale recorded against an "additional" product code is automatically re-labelled with its canonical brand + primary product code, so it merges cleanly with sales recorded under the main code.
- **Growth over last year**: works automatically once FY2025-26 actuals are uploaded (use the Admin Upload screen, just pick the matching month and year 2025). Until then the dashboard shows "—" with a note to upload last year's data.

## Important assumptions to verify with you
1. **Target units**: the value-target numbers in the source file are quite small (e.g. 1.24, 0.21) relative to the unit targets (656, 887…). I've passed these through as-is and simply divided by "No. of BEs" as you asked — I haven't tried to guess whether these represent Lakhs, Crores, or a different scale. Worth double-checking with Finance/your target-setting team before trusting the displayed value figures.
2. **Hierarchy depth**: I built the hierarchy mainly from the Targets file (BE → direct Manager, designation ASM/DYRSM/RSM/ZSM) and used the mapping file only to fill in ASM→RSM→ZM links where present, with everyone ultimately reporting to VP. Some regions may have a flatter/different real-world structure than this — easy to correct directly in the `employees` table (`manager_emp_id` column) once you spot anything off.
3. **Multiple BEs per stockist**: where a stockist has 2–3 BE IDs mapped, I split sales evenly between them. If your business rule is different (e.g. always attribute fully to BE-1), say so and I'll adjust the `sales_attributed` view (one line of SQL).

## Next steps / things not yet built (flagging honestly)
- No "change my password" or "forgot password" screen yet — only an admin SQL command to reset.
- No data validation/duplicate-prevention on upload yet (re-uploading the same file twice will double-count sales for that period — recommend deleting prior rows for a period before re-uploading, e.g. `delete from sales where period_year=2026 and period_month=1;`).
- RLS is currently permissive (anyone with the anon key can read all tables) since login is custom (Employee ID, not Supabase Auth) — fine for an internal tool used only inside your network, but say so if you want it locked down further (it would need a small Edge Function to issue scoped tokens).
- No charts yet — current dashboard is table + progress-bar based; happy to add visual charts next round.
