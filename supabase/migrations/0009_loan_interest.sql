-- Until a real lender integration exists, "Apply for loan" must not pretend an
-- application was submitted: the previous mock wrote kissth_application_sent =
-- true / status 'processing' / a made-up reference, and the screen said
-- "Kissth typically responds within 2 business days" — though nothing was ever
-- sent to anyone. A vendor could reasonably believe they had applied for credit.
--
-- This records what is actually true instead: the vendor said they're
-- interested. The kissth_* columns are left untouched for the real integration,
-- and only change when a real application is genuinely submitted.
alter table public.loan_records
  add column if not exists loan_interest_at timestamptz;
