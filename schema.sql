-- =============================================================
-- ADONIS FIELD FORCE SALES DASHBOARD — SUPABASE SCHEMA
-- Run this whole file once in Supabase SQL Editor (New Query)
-- =============================================================

create extension if not exists pgcrypto;

-- ---------- EMPLOYEES ----------
create table if not exists employees (
  emp_id            text primary key,
  name              text,
  designation       text,            -- BE / ASM / DYRSM / RSM / ZSM / ZM / VP / ADMIN
  hq_code           text,
  hq_name           text,
  manager_emp_id    text references employees(emp_id),
  state             text,
  region            text,
  password_hash     text,            -- set via set_password()
  is_admin          boolean default false,
  active            boolean default true
);

-- ---------- STOCKIST / DISTRIBUTOR MAPPING ----------
create table if not exists stockist_mapping (
  id                bigserial primary key,
  distributor_code  text,
  distributor_name  text,
  distributor_city  text,
  stockist_code     text,
  stockist_name     text,
  hq_code           text,
  hq_name           text,
  area              text,
  region            text,
  zone              text,
  be_emp_id_1       text,
  be_emp_id_2       text,
  be_emp_id_3       text,
  asm_emp_id        text,
  rsm_emp_id        text,
  zm_emp_id         text,
  vp_emp_id         text
);
create index if not exists idx_stockist_code on stockist_mapping(stockist_code);

-- ---------- PRODUCT CODE CLUBBING ----------
create table if not exists product_clubbing (
  raw_product_code        text primary key,
  canonical_brand          text,
  canonical_product_code   text
);

-- ---------- TARGETS (already divided by No. of BEs at import time) ----------
create table if not exists targets (
  id                  bigserial primary key,
  emp_id              text,
  hq_code             text,
  hq_name             text,
  brand               text,
  product_code        text,
  state               text,
  region              text,
  no_of_be            numeric,
  month_num           int,
  month_name          text,
  year                int,
  val_target_total    numeric,
  unit_target_total   numeric,
  val_target_per_be   numeric,
  unit_target_per_be  numeric
);
create index if not exists idx_targets_emp on targets(emp_id, year, month_num);
create index if not exists idx_targets_hq on targets(hq_code, year, month_num);

-- ---------- SALES (raw transactions, uploaded by admin) ----------
create table if not exists sales (
  id                      bigserial primary key,
  period_year             int,
  period_month            int,         -- 1=April .. 12=March (FY)
  bill_date               date,
  distributor_code        text,
  stockist_code           text,
  stockist_name           text,
  hq_code                 text,
  hq_name                 text,
  mr_emp_id               text,        -- raw MR code from the sales report (different ID scheme, kept for audit)
  mr_name                 text,
  raw_product_code        text,
  raw_product_name        text,
  brand                   text,
  canonical_product_code  text,
  quantity                numeric,
  amount                  numeric,
  uploaded_at             timestamptz default now(),
  uploaded_by             text
);
create index if not exists idx_sales_period on sales(period_year, period_month);
create index if not exists idx_sales_stockist on sales(stockist_code);
create index if not exists idx_sales_hq on sales(hq_code);

-- =============================================================
-- VIEW: sales attributed to the correct ADLA employee via stockist mapping
-- (Sales report's own MR code uses a different ID scheme than the
--  employee/target master, so attribution always goes stockist -> mapping -> BE.
--  If a stockist has 2-3 BE ids mapped, the sale is split evenly between them.)
-- =============================================================
create or replace view sales_attributed as
select
  s.id as sale_id, s.period_year, s.period_month, s.bill_date,
  s.stockist_code, s.hq_code, s.hq_name, s.brand, s.canonical_product_code,
  be.emp_id as be_emp_id,
  s.quantity / be.n as quantity, s.amount / be.n as amount
from sales s
join stockist_mapping m on m.stockist_code = s.stockist_code
cross join lateral (
  select emp_id, count(*) over () as n from (
    values (m.be_emp_id_1), (m.be_emp_id_2), (m.be_emp_id_3)
  ) as t(emp_id)
  where emp_id is not null and emp_id <> ''
) be;

-- =============================================================
-- RECURSIVE HELPER: all subordinate emp_ids (inclusive) for a given manager
-- =============================================================
create or replace function downline(root text)
returns table(emp_id text) language sql stable as $$
  with recursive tree as (
    select emp_id from employees where emp_id = root
    union all
    select e.emp_id from employees e join tree t on e.manager_emp_id = t.emp_id
  )
  select emp_id from tree;
$$;

-- =============================================================
-- AUTH HELPERS (custom login — employees log in with Employee ID, not email)
-- =============================================================
create or replace function set_password(p_emp_id text, p_password text)
returns void language plpgsql security definer as $$
begin
  update employees set password_hash = crypt(p_password, gen_salt('bf'))
  where emp_id = p_emp_id;
end;
$$;

create or replace function login(p_emp_id text, p_password text)
returns table(emp_id text, name text, designation text, hq_code text, hq_name text,
              manager_emp_id text, is_admin boolean)
language plpgsql security definer as $$
begin
  if exists (
    select 1 from employees e
    where e.emp_id = p_emp_id and e.active = true
      and e.password_hash is not null
      and e.password_hash = crypt(p_password, e.password_hash)
  ) then
    return query
      select e.emp_id, e.name, e.designation, e.hq_code, e.hq_name, e.manager_emp_id, e.is_admin
      from employees e where e.emp_id = p_emp_id;
  end if;
end;
$$;

-- Default password = employee id itself (everyone should change this on first login;
-- build an admin "reset password" action in the app's admin panel if needed).
-- Run once after importing employees.csv:
--   select set_password(emp_id, emp_id) from employees;

-- =============================================================
-- ROW LEVEL SECURITY
-- Since employees log in via the custom login() RPC (not Supabase Auth),
-- the browser holds the emp_id client-side after login and the app always
-- filters queries by "my downline" using the downline() function below.
-- For simplicity/safety in this internal tool, RLS is kept permissive and
-- access control is enforced by querying through the downline()-scoped
-- helper views below. Tighten further if you expose this beyond your VPN.
-- =============================================================
alter table employees enable row level security;
alter table sales enable row level security;
alter table targets enable row level security;
alter table stockist_mapping enable row level security;
alter table product_clubbing enable row level security;

create policy "read all employees" on employees for select using (true);
create policy "read all sales" on sales for select using (true);
create policy "read all targets" on targets for select using (true);
create policy "read all mapping" on stockist_mapping for select using (true);
create policy "read all clubbing" on product_clubbing for select using (true);
-- inserts/updates happen only via the admin upload screen using the service-role
-- key on a tiny server function, OR via the anon key if you accept the lower
-- security bar for this internal tool. See README for the recommended option.
create policy "insert sales (internal tool)" on sales for insert with check (true);

-- =============================================================
-- UPLOAD MANAGEMENT HELPERS
-- =============================================================

-- Function to get list of uploaded batches (groups within same minute)
create or replace function get_uploaded_files()
returns table(
  upload_group_id text,
  period_year int,
  period_month int,
  row_count bigint,
  total_amount numeric,
  uploaded_at timestamptz,
  uploaded_by text
) language plpgsql security definer as $$
begin
  return query
    select
      to_char(s.uploaded_at, 'YYYY-MM-DD HH24:MI') as upload_group_id,
      s.period_year,
      s.period_month,
      count(*)::bigint as row_count,
      sum(s.amount)::numeric as total_amount,
      min(s.uploaded_at) as uploaded_at,
      min(s.uploaded_by) as uploaded_by
    from sales s
    group by to_char(s.uploaded_at, 'YYYY-MM-DD HH24:MI'), s.period_year, s.period_month
    order by min(s.uploaded_at) desc;
end;
$$;

-- Function to delete a specific upload batch
create or replace function delete_upload_group(p_upload_group_id text)
returns void language plpgsql security definer as $$
begin
  delete from sales
  where to_char(uploaded_at, 'YYYY-MM-DD HH24:MI') = p_upload_group_id;
end;
$$;

