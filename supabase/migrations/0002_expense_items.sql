-- Itemized expenses (ingredient/supplier-level) + an anonymized cross-vendor
-- price benchmark, so the app can answer "which ingredient costs me the most"
-- and "am I paying more than other vendors for the same supplies" — questions
-- the aggregate revenue/costs columns on profit_logs cannot answer.

create table if not exists public.expense_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  profit_log_id uuid references public.profit_logs (id) on delete cascade,
  date date not null,
  item_name text not null,
  -- Lowercased/trimmed so "Onions", "onions " etc. group together for ranking
  -- and benchmarking, without forcing vendors through a fixed ingredient list.
  item_name_normalized text generated always as (lower(trim(item_name))) stored,
  supplier_name text,
  amount numeric(10, 2) not null check (amount >= 0),
  quantity numeric(10, 3) check (quantity is null or quantity > 0),
  unit varchar(20), -- kg, g, l, ml, piece, dozen, packet, other
  -- Only computable when a quantity was given — an amount alone isn't comparable
  -- across vendors who bought different quantities.
  unit_price numeric(12, 4) generated always as (
    case when quantity is not null and quantity > 0 then amount / quantity else null end
  ) stored,
  created_at timestamptz not null default now()
);

create index if not exists idx_expense_items_user_date on public.expense_items (user_id, date desc);
create index if not exists idx_expense_items_profit_log on public.expense_items (profit_log_id);
create index if not exists idx_expense_items_name on public.expense_items (item_name_normalized);

alter table public.expense_items enable row level security;
create policy "expense_items_all_own" on public.expense_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Cross-vendor price benchmark, computed server-side so no vendor's individual
-- prices are ever exposed to another vendor's client.
--
-- SECURITY DEFINER runs as the function owner (bypassing each caller's RLS),
-- which is required here — the whole point is to aggregate across every
-- vendor's rows, not just the caller's own. The `having count(distinct
-- user_id) >= 3` clause is a k-anonymity floor: with fewer than 3 contributing
-- vendors the function returns zero rows, so a benchmark can never resolve to
-- a single competitor's actual price.
create or replace function public.get_item_price_benchmark(p_item_name text, p_unit text)
returns table (avg_unit_price numeric, min_unit_price numeric, vendor_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select
    avg(unit_price)::numeric,
    min(unit_price)::numeric,
    count(distinct user_id)
  from public.expense_items
  where item_name_normalized = lower(trim(p_item_name))
    and unit = p_unit
    and unit_price is not null
  having count(distinct user_id) >= 3;
$$;

revoke all on function public.get_item_price_benchmark(text, text) from public;
grant execute on function public.get_item_price_benchmark(text, text) to authenticated;
