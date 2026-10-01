-- Seller payouts.
--
-- A seller's bank account lives at Omise as a "recipient"; we keep only its id and
-- the last 4 digits for display. Like profile_addresses this is PRIVATE: RLS on,
-- no policies, every API-role grant revoked, so only server code (service role)
-- touches it, always filtered by the session user.
create table public.seller_payout_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  omise_recipient_id text not null,
  bank_brand text not null,
  account_last4 text not null check (account_last4 ~ '^[0-9]{4}$'),
  account_name text not null,
  updated_at timestamptz not null default now()
);

alter table public.seller_payout_accounts enable row level security;
revoke all on public.seller_payout_accounts from anon, authenticated;

-- Per-order payout state. null = not a payout candidate (everything completed
-- before this migration is left alone); 'pending' = completed, seller not paid yet;
-- 'processing' = a transfer is being created; 'sent' = transfer created at Omise.
alter table public.orders
  add column if not exists payout_status text check (payout_status in ('pending', 'processing', 'sent')),
  add column if not exists commission integer,
  add column if not exists payout_amount integer,
  add column if not exists omise_transfer_id text,
  add column if not exists payout_error text,
  add column if not exists payout_attempted_at timestamptz,
  add column if not exists paid_out_at timestamptz;

-- Orders reach COMPLETED from four code paths (buyer approval, two timers, admin
-- dispute decision). Marking the payout pending here covers all of them.
create function public.mark_payout_pending()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'COMPLETED' and old.status is distinct from 'COMPLETED' and new.payout_status is null then
    new.payout_status := 'pending';
  end if;
  return new;
end;
$$;

revoke all on function public.mark_payout_pending() from public, anon, authenticated;

create trigger orders_mark_payout_pending
before update on public.orders
for each row execute function public.mark_payout_pending();
