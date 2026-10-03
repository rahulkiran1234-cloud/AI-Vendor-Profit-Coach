-- Found via end-to-end testing with a real (non-service-role) logged-in user:
-- `ingredient_synonyms` had Row Level Security enabled with zero policies
-- (this project appears to auto-enable RLS on new tables — a good default in
-- general, but this table was never given a read policy). That made every
-- row invisible to the `authenticated` role — including from *inside* the
-- `set_expense_item_canonical_key` trigger, which was not `security definer`
-- and so ran with the invoking role's own (RLS-filtered) visibility.
--
-- Net effect: seed/service-role inserts canonicalized correctly, but every
-- real app insert (always via the `authenticated` role) silently fell back
-- to the raw, un-mapped item name — so "pyaz" and "onion" logged by an actual
-- user never matched each other at all. The cross-vendor benchmark function
-- was unaffected only because it was already marked `security definer`.

-- Make the lookup table's access model explicit rather than leaving it in
-- whatever "RLS enabled, no policies" state it was auto-given: it's a static
-- shared reference table with no per-user data, safe for any authenticated
-- vendor to read directly.
alter table public.ingredient_synonyms enable row level security;
drop policy if exists "ingredient_synonyms_read_all" on public.ingredient_synonyms;
create policy "ingredient_synonyms_read_all" on public.ingredient_synonyms
  for select using (true);

-- The actual fix: the trigger must not depend on the invoking role's own
-- visibility into ingredient_synonyms.
create or replace function public.set_expense_item_canonical_key()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.canonical_item_key := coalesce(
    (select canonical from public.ingredient_synonyms where alias = lower(trim(new.item_name))),
    lower(trim(new.item_name))
  );
  return new;
end;
$$;

-- Backfill every row using the corrected (RLS-independent) lookup — this
-- corrects any rows written by a real user before this migration, the same
-- way 0003's original backfill corrected rows written before it existed.
update public.expense_items
set canonical_item_key = coalesce(
  (select canonical from public.ingredient_synonyms where alias = lower(trim(item_name))),
  lower(trim(item_name))
)
where canonical_item_key is distinct from coalesce(
  (select canonical from public.ingredient_synonyms where alias = lower(trim(item_name))),
  lower(trim(item_name))
);
