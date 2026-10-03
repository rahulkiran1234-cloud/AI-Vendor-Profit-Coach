-- Ingredient name canonicalization.
--
-- Without this, "pyaz", "onion", and "Onions " only ever match each other in
-- get_item_price_benchmark() if two vendors typed the exact same string after
-- lower(trim(...)) — which in practice they rarely will, across languages and
-- spelling. This maps common variants to one canonical key so the cross-vendor
-- benchmark (and a single vendor's own top-expenses ranking) actually group
-- the same ingredient together regardless of what was typed. It does NOT
-- change what's displayed to a vendor — item_name (what they typed) is still
-- shown as-is; canonical_item_key is purely a matching key.

create table if not exists public.ingredient_synonyms (
  alias text primary key, -- already lower(trim(...))-normalized
  canonical text not null
);

-- Starter dictionary covering common street-food/micro-retail staples across
-- Hindi, Marathi, and English spellings. Not exhaustive — extend this table
-- as real vendor data reveals more variants; existing rows can be
-- re-backfilled later by re-running the UPDATE at the bottom of this file.
insert into public.ingredient_synonyms (alias, canonical) values
  ('onion', 'onion'), ('onions', 'onion'), ('pyaz', 'onion'), ('kanda', 'onion'),
  ('potato', 'potato'), ('potatoes', 'potato'), ('aloo', 'potato'), ('batata', 'potato'),
  ('tomato', 'tomato'), ('tomatoes', 'tomato'), ('tamatar', 'tomato'),
  ('wheat flour', 'wheat_flour'), ('aata', 'wheat_flour'), ('atta', 'wheat_flour'), ('gehu', 'wheat_flour'),
  ('rice', 'rice'), ('chawal', 'rice'), ('tandul', 'rice'),
  ('cooking oil', 'cooking_oil'), ('oil', 'cooking_oil'), ('tel', 'cooking_oil'), ('tael', 'cooking_oil'),
  ('sugar', 'sugar'), ('cheeni', 'sugar'), ('sakhar', 'sugar'),
  ('salt', 'salt'), ('namak', 'salt'), ('meeth', 'salt'),
  ('milk', 'milk'), ('doodh', 'milk'), ('dudh', 'milk'),
  ('gas cylinder', 'gas_cylinder'), ('gas', 'gas_cylinder'), ('cylinder', 'gas_cylinder'),
  ('ginger', 'ginger'), ('adrak', 'ginger'), ('aale', 'ginger'),
  ('garlic', 'garlic'), ('lehsun', 'garlic'), ('lasun', 'garlic'),
  ('green chilli', 'green_chilli'), ('chilli', 'green_chilli'), ('mirchi', 'green_chilli'), ('mirch', 'green_chilli'),
  ('coriander', 'coriander'), ('dhaniya', 'coriander'), ('kothimbir', 'coriander'),
  ('cabbage', 'cabbage'), ('patta gobi', 'cabbage'), ('kobi', 'cabbage'),
  ('cauliflower', 'cauliflower'), ('phool gobi', 'cauliflower'), ('phulkobi', 'cauliflower'),
  ('capsicum', 'capsicum'), ('shimla mirch', 'capsicum'),
  ('egg', 'egg'), ('eggs', 'egg'), ('anda', 'egg'), ('ande', 'egg'),
  ('paneer', 'paneer'),
  ('curd', 'curd'), ('dahi', 'curd'),
  ('tea', 'tea'), ('chai', 'tea'), ('chaha', 'tea'),
  ('bread', 'bread'), ('pao', 'bread'), ('pav', 'bread'),
  ('butter', 'butter'), ('makhan', 'butter'), ('loni', 'butter'),
  ('ghee', 'ghee'), ('tup', 'ghee'),
  ('gram flour', 'gram_flour'), ('besan', 'gram_flour'),
  ('lentils', 'dal'), ('dal', 'dal'), ('daal', 'dal')
on conflict (alias) do nothing;

alter table public.expense_items add column if not exists canonical_item_key text;

create or replace function public.set_expense_item_canonical_key()
returns trigger
language plpgsql
as $$
begin
  new.canonical_item_key := coalesce(
    (select canonical from public.ingredient_synonyms where alias = lower(trim(new.item_name))),
    lower(trim(new.item_name))
  );
  return new;
end;
$$;

drop trigger if exists expense_items_set_canonical on public.expense_items;
create trigger expense_items_set_canonical
  before insert or update of item_name on public.expense_items
  for each row execute function public.set_expense_item_canonical_key();

-- Backfill rows written before this migration (or before a synonym was added).
update public.expense_items
set canonical_item_key = coalesce(
  (select canonical from public.ingredient_synonyms where alias = lower(trim(item_name))),
  lower(trim(item_name))
)
where canonical_item_key is distinct from coalesce(
  (select canonical from public.ingredient_synonyms where alias = lower(trim(item_name))),
  lower(trim(item_name))
);

create index if not exists idx_expense_items_canonical on public.expense_items (canonical_item_key, unit);

-- Resolve through the same synonym table so callers keep passing whatever the
-- vendor typed — the function does the canonicalization on both sides.
create or replace function public.get_item_price_benchmark(p_item_name text, p_unit text)
returns table (avg_unit_price numeric, min_unit_price numeric, vendor_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  with resolved as (
    select coalesce(
      (select canonical from public.ingredient_synonyms where alias = lower(trim(p_item_name))),
      lower(trim(p_item_name))
    ) as canonical_key
  )
  select
    avg(unit_price)::numeric,
    min(unit_price)::numeric,
    count(distinct user_id)
  from public.expense_items, resolved
  where canonical_item_key = resolved.canonical_key
    and unit = p_unit
    and unit_price is not null
  having count(distinct user_id) >= 3;
$$;

revoke all on function public.get_item_price_benchmark(text, text) from public;
grant execute on function public.get_item_price_benchmark(text, text) to authenticated;
