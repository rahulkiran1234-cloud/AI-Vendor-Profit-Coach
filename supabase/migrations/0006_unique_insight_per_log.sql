-- Found via end-to-end testing: a single profit log ended up with 5 duplicate
-- trend-insight rows. Nothing prevented concurrent/repeated inserts for the
-- same profit_log_id (e.g. a dev-mode double-render of the result page's
-- Server Component, a quick double-refresh, or a race between the result
-- page and /api/insights/generate both running the "no existing insight yet"
-- check before either had inserted). Each duplicate is also a wasted Claude
-- call. One profit log should have at most one trend insight.

-- Defensive cleanup first: if any duplicates already exist (in this project or
-- any other), keep the earliest row per profit_log_id and drop the rest, so
-- the constraint below doesn't fail to apply.
delete from public.insights a
using public.insights b
where a.profit_log_id = b.profit_log_id
  and a.id <> b.id
  and a.created_at > b.created_at;

alter table public.insights
  add constraint insights_profit_log_id_unique unique (profit_log_id);
