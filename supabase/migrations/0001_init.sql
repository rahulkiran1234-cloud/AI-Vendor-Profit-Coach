-- AI Vendor Profit Coach — Supabase schema
-- Run this in the Supabase SQL editor (or via `supabase db push`) on a fresh project.
-- Auth is handled by Supabase's built-in `auth.users` table; `public.users` below is a
-- profile table keyed 1:1 to auth.users.id.

create extension if not exists "pgcrypto";

-- 1. users (profile) ---------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique not null,
  full_name text not null,
  language varchar(10) not null default 'hindi', -- hindi, marathi, english
  vendor_type varchar(50), -- street_food, retail, multi_location
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "users_select_own" on public.users
  for select using (auth.uid() = id);
create policy "users_update_own" on public.users
  for update using (auth.uid() = id);
create policy "users_insert_own" on public.users
  for insert with check (auth.uid() = id);

-- 2. profit_logs --------------------------------------------------------------
create table if not exists public.profit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  date date not null,
  revenue numeric(10, 2) not null,
  costs numeric(10, 2) not null,
  profit numeric(10, 2) generated always as (revenue - costs) stored,
  waste_loss numeric(10, 2),
  notes text,
  voice_transcription text,
  confidence_score numeric(3, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists idx_profit_logs_user_date on public.profit_logs (user_id, date desc);
create index if not exists idx_profit_logs_created on public.profit_logs (created_at);

alter table public.profit_logs enable row level security;
create policy "profit_logs_all_own" on public.profit_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. insights -------------------------------------------------------------------
create table if not exists public.insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  profit_log_id uuid not null references public.profit_logs (id) on delete cascade,
  insight_type varchar(50) not null, -- trend | cost_anomaly | pattern | recommendation | waste
  insight_text text not null,
  recommendation_type varchar(50), -- cost_optimization | waste_reduction | stock_adjustment | seasonal
  estimated_savings numeric(10, 2),
  viewed_at timestamptz,
  acted_upon boolean not null default false,
  action_date timestamptz,
  action_description text,
  confidence_score numeric(3, 2),
  created_at timestamptz not null default now()
);

create index if not exists idx_insights_user on public.insights (user_id);
create index if not exists idx_insights_profit_log on public.insights (profit_log_id);
create index if not exists idx_insights_viewed on public.insights (viewed_at);

alter table public.insights enable row level security;
create policy "insights_all_own" on public.insights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4. loan_records -----------------------------------------------------------
create table if not exists public.loan_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  avg_daily_profit numeric(10, 2),
  consistency_score numeric(5, 2),
  avg_profit_30_days numeric(10, 2),
  loan_eligibility_amount numeric(12, 2),
  loan_eligibility_confidence numeric(3, 2),

  kissth_application_sent boolean not null default false,
  kissth_application_date timestamptz,
  kissth_status varchar(50), -- pending | approved | rejected | processing
  kissth_approved_amount numeric(12, 2),
  kissth_application_id text unique,
  kissth_response jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_loan_records_user on public.loan_records (user_id);
create index if not exists idx_loan_records_status on public.loan_records (kissth_status);

alter table public.loan_records enable row level security;
create policy "loan_records_all_own" on public.loan_records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Helper: keep updated_at fresh -------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on public.users
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.profit_logs
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.loan_records
  for each row execute function public.set_updated_at();
