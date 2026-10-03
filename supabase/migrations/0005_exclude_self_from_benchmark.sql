-- Bug fix, caught by an end-to-end test with seeded multi-vendor data: the
-- benchmark previously averaged in the CALLING vendor's own rows alongside
-- everyone else's. A vendor who logs the same overpriced item many times
-- pulls the "average" toward their own price, understating (or entirely
-- hiding) how much of an outlier they actually are relative to other
-- vendors — exactly backwards for a feature whose purpose is "am I paying
-- more than OTHER vendors."
--
-- auth.uid() is used instead of an explicit parameter so a caller can't pass
-- someone else's id to see themselves excluded from a benchmark that isn't
-- theirs — it's read straight from the request's JWT, same as any RLS policy.

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
    and user_id <> auth.uid()
  having count(distinct user_id) >= 3;
$$;

revoke all on function public.get_item_price_benchmark(text, text) from public;
grant execute on function public.get_item_price_benchmark(text, text) to authenticated;
