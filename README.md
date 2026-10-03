# AI Vendor Profit Coach

Voice-first profit intelligence for Indian street vendors. Log today's revenue and
costs by speaking, and get an AI-generated insight ("↑ 15% higher than your ₹8,650
average") comparing today against your own history — plus a loan eligibility
estimate built from your logged profit consistency.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind v4)
- **Supabase** — Postgres + Auth (Google OAuth + email/password) + Row Level Security
- **Anthropic Claude** (`claude-sonnet-5`) — voice extraction + trend insights
- **Web Speech API** — in-browser voice-to-text (no server transcription cost for the MVP)

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com/dashboard) — pick the
   region closest to your users (e.g. Singapore for India-facing latency).
2. Open the SQL editor and run every file in [`supabase/migrations/`](supabase/migrations)
   **in numeric order** — each one is additive, so if you've already run some
   of them, just run whatever's left:
   - `0001_init.sql` — core tables (`users`, `profit_logs`, `insights`, `loan_records`) with RLS
   - `0002_expense_items.sql` — itemized expenses + the cross-vendor price benchmark function
   - `0003_ingredient_canonicalization.sql` — synonym dictionary so "pyaz"/"onion"/"Onions" match
   - `0004_coach_messages.sql` — "ask your coach" conversation history
   - `0005_exclude_self_from_benchmark.sql` — bug fix: the benchmark was averaging in your own price
   - `0006_unique_insight_per_log.sql` — bug fix: prevents duplicate insight rows per profit log
   - `0007_fix_synonym_trigger_rls.sql` — bug fix: canonicalization silently didn't work for real (non-service-role) users — see the README note below
3. In **Authentication → Providers**, enable **Email** and **Google**. For Google
   you'll need an OAuth Client ID/Secret from the
   [Google Cloud Console](https://console.cloud.google.com/apis/credentials) —
   set the authorized redirect URI to `https://<your-project-ref>.supabase.co/auth/v1/callback`.
4. Copy **Project Settings → API**: the Project URL, `anon` public key, and
   `service_role` secret key.

## 2. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  from Supabase (step 1).
- `ANTHROPIC_API_KEY` from [console.anthropic.com](https://console.anthropic.com/settings/keys).
  `ANTHROPIC_MODEL` defaults to `claude-sonnet-5` (fast + cheap — right fit for
  short extraction/insight calls).
- `KISSTH_API_URL` / `KISSTH_API_KEY` — leave blank. There is no lender
  integration yet: the loan screen only records that a vendor is *interested*
  (`/api/loan/interest`) and sends nothing to anyone.

## 3. Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). New users land on `/login`,
then a short onboarding form (`/onboarding`), then the dashboard.

## 4. Deploy

```bash
vercel deploy --prod
```

Set the same environment variables in the Vercel project settings before
deploying. Add your production URL to Supabase's **Authentication → URL
Configuration → Redirect URLs** (`https://your-domain.vercel.app/auth/callback`).

## What's implemented vs. deferred

Built:
- Auth (Google OAuth + email/password), protected routes via `src/proxy.ts`
- Voice input (Web Speech API, 120s cap, manual-text fallback) → Claude extraction
  (revenue/costs *and* any itemized expenses the vendor mentioned by name) →
  editable confirmation screen, with a quick manual add/edit list for items → save
- RAG trend insight once a vendor has 8+ days of history, shown on the result
  screen with a "did you act on this?" follow-through tracker
- **Cost-saving insight** (`/dashboard/costs`) — ranks a vendor's itemized
  expenses by total spend, and checks the top items against
  `get_item_price_benchmark`, a Postgres function that anonymously averages
  unit prices for the same item *across every vendor* (k-anonymity floor of 3
  contributing vendors, enforced in SQL — see `supabase/migrations/0002_expense_items.sql`).
  If a vendor is paying notably more than that average, Claude phrases the
  finding in their language; it never computes the number itself, only
  narrates numbers this app already calculated (`src/lib/cost-insights.ts`) —
  the same reasoning as the loan formula below.
- Deterministic loan eligibility formula (5× avg daily profit, consistency and
  trend adjustments, ₹10k–₹5L clamp) + a "register interest" button (no lender integration yet — nothing is sent)
- History view with a 30-day sparkline, settings (profile edit, JSON data
  export, logout)

Deliberately deferred:
- **Sentry** error monitoring — add `@sentry/nextjs` and run its wizard once you
  have a DSN; the generic-error-to-user / detailed-error-to-log split this app
  already follows (see `ErrorBoundary.tsx` and every API route's catch block)
  is designed to plug straight into it.
- **Real lender integration (Kissth)** — nothing is submitted to any lender today.
  `/api/loan/interest` stores a timestamp (`loan_records.loan_interest_at`) when a
  vendor taps "I'm interested"; the `kissth_*` columns stay empty until a real
  application route exists and genuinely submits one.
