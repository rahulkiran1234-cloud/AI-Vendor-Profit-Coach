-- Security hardening found via a dedicated review pass. Context for every
-- fix below: the Supabase anon key is public in the browser bundle, so any
-- authenticated vendor can call PostgREST directly (/rest/v1/...,
-- /rest/v1/rpc/...) with their own token, bypassing every check this app's
-- own API routes make. Postgres RLS is the only real enforcement layer —
-- app-level auth checks are necessary but not sufficient.

-- 1. insights: a FOREIGN KEY does not re-check RLS, so the previous policy's
-- `with check (auth.uid() = user_id)` let an attacker insert a row with
-- their own user_id but someone else's profit_log_id — attaching an insight
-- to a victim's log. Combined with 0006's unique(profit_log_id) constraint,
-- this let an attacker permanently block a victim's own insight generation
-- (every future attempt would hit the unique violation and find a row RLS
-- won't let the victim see). Also drops DELETE: the app never deletes an
-- insight, and allowing it let a user reset their own daily-insight-count
-- rate limit by deleting their history via direct REST.
drop policy if exists "insights_all_own" on public.insights;

drop policy if exists "insights_select_own" on public.insights;
create policy "insights_select_own" on public.insights
  for select using (auth.uid() = user_id);

drop policy if exists "insights_insert_own" on public.insights;
create policy "insights_insert_own" on public.insights
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.profit_logs
      where id = profit_log_id and user_id = auth.uid()
    )
  );

drop policy if exists "insights_update_own" on public.insights;
create policy "insights_update_own" on public.insights
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2. expense_items: same FK-ownership gap as insights (profit_log_id is
-- nullable here, so the check only applies when it's set), and the same
-- DELETE removal — the app never deletes an expense item either.
drop policy if exists "expense_items_all_own" on public.expense_items;

drop policy if exists "expense_items_select_own" on public.expense_items;
create policy "expense_items_select_own" on public.expense_items
  for select using (auth.uid() = user_id);

drop policy if exists "expense_items_insert_own" on public.expense_items;
create policy "expense_items_insert_own" on public.expense_items
  for insert with check (
    auth.uid() = user_id
    and (
      profit_log_id is null
      or exists (
        select 1 from public.profit_logs
        where id = profit_log_id and user_id = auth.uid()
      )
    )
  );

drop policy if exists "expense_items_update_own" on public.expense_items;
create policy "expense_items_update_own" on public.expense_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. coach_messages: the app only ever selects and inserts. Removing UPDATE
-- and DELETE closes the same rate-limit-reset-via-direct-REST path as above
-- (the daily cap counts these rows).
drop policy if exists "coach_messages_all_own" on public.coach_messages;

drop policy if exists "coach_messages_select_own" on public.coach_messages;
create policy "coach_messages_select_own" on public.coach_messages
  for select using (auth.uid() = user_id);

drop policy if exists "coach_messages_insert_own" on public.coach_messages;
create policy "coach_messages_insert_own" on public.coach_messages
  for insert with check (auth.uid() = user_id);

-- 4. loan_records: previously fully user-writable through "your own row"
-- RLS — but the row IS the user's own eligibility and lending-application
-- status, so "your own row" is exactly the wrong scope for write access. A
-- vendor could PATCH their own loan_eligibility_amount or kissth_status
-- directly over REST and self-approve an arbitrary loan. The app itself now
-- writes this table with the service-role key from trusted server code (see
-- /api/loan/eligibility and /api/loan/kissth) — authenticated users get
-- read-only access.
drop policy if exists "loan_records_all_own" on public.loan_records;

drop policy if exists "loan_records_select_own" on public.loan_records;
create policy "loan_records_select_own" on public.loan_records
  for select using (auth.uid() = user_id);

-- 5. get_item_price_benchmark: two issues.
--   a) `min(unit_price)` is always one real vendor's exact price. The app
--      never reads it, but any direct RPC caller could, defeating the
--      k-anonymity floor's whole purpose. Dropped from the return shape.
--   b) `avg(unit_price)` averaged per ROW, not per VENDOR — a vendor who
--      logs an item many times (accidentally, or adversarially with a tiny
--      unit_price) dominated the "average other vendors pay" figure, which
--      is supposed to represent *other vendors*, not *their most frequent
--      logger*. Now averages each contributing vendor's own average first,
--      then averages those.
-- create-or-replace cannot change a function's return columns (min_unit_price is
-- being removed), so it must be dropped first.
drop function if exists public.get_item_price_benchmark(text, text);

create or replace function public.get_item_price_benchmark(p_item_name text, p_unit text)
returns table (avg_unit_price numeric, vendor_count bigint)
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
  ),
  per_vendor as (
    select user_id, avg(unit_price) as vendor_avg_price
    from public.expense_items, resolved
    where canonical_item_key = resolved.canonical_key
      and unit = p_unit
      and unit_price is not null
      and user_id <> auth.uid()
    group by user_id
  )
  select
    avg(vendor_avg_price)::numeric,
    count(*)
  from per_vendor
  having count(*) >= 3;
$$;

revoke all on function public.get_item_price_benchmark(text, text) from public;
revoke all on function public.get_item_price_benchmark(text, text) from anon;
grant execute on function public.get_item_price_benchmark(text, text) to authenticated;

-- 6. ingredient_synonyms: scope the read policy explicitly to `authenticated`
-- (it previously applied to every role, including anon, which contradicts
-- its own "so any authenticated vendor" comment from 0007 even though the
-- table holds no sensitive data).
drop policy if exists "ingredient_synonyms_read_all" on public.ingredient_synonyms;
create policy "ingredient_synonyms_read_all" on public.ingredient_synonyms
  for select to authenticated using (true);

-- 7. users.email: nothing tied this column to the actual auth identity in
-- auth.users, so an attacker could sign up, then PATCH their own
-- public.users.email to a victim's real email address. The unique
-- constraint then permanently blocked that victim from ever completing
-- onboarding (every future signup/profile upsert would hit the uniqueness
-- violation). auth.users already enforces real email uniqueness for
-- actual sign-in identities — this column doesn't need its own.
alter table public.users drop constraint if exists users_email_key;
