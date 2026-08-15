-- Run this in Supabase SQL Editor (Dashboard â†’ SQL Editor â†’ New Query)
-- This fixes sales_attributed to include stockists without BEs by cascading to ASM â†’ RSM â†’ ZM â†’ VP
-- and special-cases Sastasundar Healthbuddy Ltd. (C0563) to split 20/20/60 across the requested HQs.

create or replace view sales_attributed as
select
  s.id as sale_id, s.period_year, s.period_month, s.bill_date,
  s.stockist_code, coalesce(nullif(trim(m.hq_code),''), s.hq_code) as hq_code, coalesce(nullif(trim(m.hq_name),''), s.hq_name) as hq_name, s.brand, s.canonical_product_code,
  be.emp_id as be_emp_id,
  s.quantity * be.share as quantity, s.amount * be.share as amount
from sales s
left join stockist_mapping m on m.stockist_code = s.stockist_code
left join lateral (
  select emp_id, share from (
    select 'ADLA102'::text as emp_id, 0.20::numeric as share where s.stockist_code = 'C0563'
    union all
    select 'ADLA105'::text as emp_id, 0.20::numeric as share where s.stockist_code = 'C0563'
    union all
    select 'ADLA_INST'::text as emp_id, 0.60::numeric as share where s.stockist_code = 'C0563'
    union all
    -- If BEs exist, split among them. Otherwise fall back to ASM â†’ RSM â†’ ZM â†’ VP.
    select emp_id, 1.0 / count(*) over () as share from (
      select nullif(trim(emp_id), '') as emp_id from (
        -- Case 1: at least one BE is assigned â€” use BE(s)
        select unnest(array_remove(array[m.be_emp_id_1, m.be_emp_id_2, m.be_emp_id_3], null)) as emp_id
        where s.stockist_code <> 'C0563'
          and coalesce(nullif(trim(m.be_emp_id_1),''), nullif(trim(m.be_emp_id_2),''), nullif(trim(m.be_emp_id_3),'')) is not null
        union all
        -- Case 2: no BE â€” fall back to lowest available level
        select coalesce(
          nullif(trim(m.asm_emp_id),''),
          nullif(trim(m.rsm_emp_id),''),
          nullif(trim(m.zm_emp_id),''),
          nullif(trim(m.vp_emp_id),'')
        ) as emp_id
        where s.stockist_code <> 'C0563'
          and coalesce(nullif(trim(m.be_emp_id_1),''), nullif(trim(m.be_emp_id_2),''), nullif(trim(m.be_emp_id_3),'')) is null
      ) u
      where nullif(trim(emp_id), '') is not null
    ) t
  ) split_rows
) be on true;
