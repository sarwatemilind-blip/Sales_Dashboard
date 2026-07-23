-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- This fixes sales_attributed to include stockists without BEs by cascading to ASM → RSM → ZM → VP

create or replace view sales_attributed as
select
  s.id as sale_id, s.period_year, s.period_month, s.bill_date,
  s.stockist_code, s.hq_code, s.hq_name, s.brand, s.canonical_product_code,
  be.emp_id as be_emp_id,
  s.quantity / coalesce(nullif(be.n, 0), 1) as quantity, s.amount / coalesce(nullif(be.n, 0), 1) as amount
from sales s
left join stockist_mapping m on m.stockist_code = s.stockist_code
left join lateral (
  -- If BEs exist, split among them. Otherwise fall back to ASM → RSM → ZM → VP.
  select emp_id, count(*) over () as n from (
    -- Case 1: at least one BE is assigned — use BE(s)
    select unnest(array_remove(array[m.be_emp_id_1, m.be_emp_id_2, m.be_emp_id_3], null)) as emp_id
    where coalesce(nullif(trim(m.be_emp_id_1),''), nullif(trim(m.be_emp_id_2),''), nullif(trim(m.be_emp_id_3),'')) is not null
    union all
    -- Case 2: no BE — fall back to lowest available level
    select coalesce(
      nullif(trim(m.asm_emp_id),''),
      nullif(trim(m.rsm_emp_id),''),
      nullif(trim(m.zm_emp_id),''),
      nullif(trim(m.vp_emp_id),'')
    ) as emp_id
    where coalesce(nullif(trim(m.be_emp_id_1),''), nullif(trim(m.be_emp_id_2),''), nullif(trim(m.be_emp_id_3),'')) is null
  ) t(emp_id)
  where emp_id is not null and emp_id <> ''
) be on true;
