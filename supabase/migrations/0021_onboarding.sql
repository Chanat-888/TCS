-- First-login welcome page: null means the account has not seen /welcome yet.
-- Existing accounts are marked as done so only new sign-ups see it.
alter table public.profiles add column if not exists onboarded_at timestamptz;
update public.profiles set onboarded_at = now() where onboarded_at is null;
