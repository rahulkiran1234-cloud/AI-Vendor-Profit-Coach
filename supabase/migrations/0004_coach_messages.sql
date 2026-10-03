-- "Ask your coach" — a free-form Q&A feature grounded strictly in the
-- vendor's own retrieved data (profit_logs, expense_items, loan eligibility).
-- Storing the exchange both gives a persistent chat history and doubles as a
-- natural place to enforce a daily rate limit (see /api/coach/ask), the same
-- pattern already used for the insights table.

create table if not exists public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  question text not null,
  answer text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_coach_messages_user_created on public.coach_messages (user_id, created_at desc);

alter table public.coach_messages enable row level security;
create policy "coach_messages_all_own" on public.coach_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
