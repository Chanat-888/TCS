-- Seller wallet ledger and manual withdrawals (docs/payment-plan.md sections 4, 13, 14).
--
-- The wallet is only a ledger; real cash sits in the company bank account. Amounts are
-- whole satang. Entries are append-only: a balance is the sum of its entries, never a
-- stored number, and a mistake is fixed by a reversing entry. Every entry has a unique
-- key, so repeated triggers, retries or double clicks add nothing.
--
-- Buckets: 'pending' (order paid, not yet approved), 'available' (withdrawable),
-- 'commission' (TCS's own money: commission and withdrawal fees).
--
-- Private like seller_payout_accounts: RLS on, no policies, no API-role grants, so only
-- server code (service role) touches these, always after checking the session user.

-- The commission rate, in basis points (900 = 9%). Keep equal to COMMISSION_RATE in
-- src/lib/commission.ts (tests/ledger.test.mjs checks they match).
create function public.commission_bps()
returns integer
language sql
immutable
as $$ select 900 $$;

alter table public.orders add column if not exists commission_bps integer;

create table public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id),
  amount bigint not null check (amount > 0),
  fee bigint not null check (fee >= 0 and fee < amount),
  status text not null default 'requested' check (status in ('requested', 'paid', 'failed')),
  -- Where to pay, copied at request time so a later account change cannot redirect it.
  bank_brand text not null,
  account_number_enc text not null,
  account_name text not null,
  bank_reference text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index withdrawals_status_idx on public.withdrawals(status, created_at);

create table public.ledger_entries (
  id bigint generated always as identity primary key,
  seller_id uuid not null references public.profiles(id),
  bucket text not null check (bucket in ('pending', 'available', 'commission')),
  kind text not null check (kind in (
    'order_paid', 'order_completed', 'order_reversed', 'commission',
    'withdrawal', 'withdrawal_failed', 'withdrawal_fee'
  )),
  amount bigint not null check (amount <> 0),
  order_id uuid references public.orders(id),
  withdrawal_id uuid references public.withdrawals(id),
  key text not null unique,
  created_at timestamptz not null default now()
);
create index ledger_entries_seller_idx on public.ledger_entries(seller_id, created_at desc);

create view public.seller_balances as
  select seller_id, bucket, sum(amount)::bigint as total
  from public.ledger_entries
  group by seller_id, bucket;

alter table public.withdrawals enable row level security;
alter table public.ledger_entries enable row level security;
revoke all on public.withdrawals, public.ledger_entries, public.seller_balances from anon, authenticated;

-- Bank accounts are now stored by us (number encrypted by the app), not as an Omise
-- recipient. The Omise columns stay for the fallback route.
alter table public.seller_payout_accounts
  alter column omise_recipient_id drop not null,
  add column if not exists account_number_enc text;

-- Writes ledger entries in the same transaction as the order status change, so the
-- two cannot disagree. Runs for every path to a status (buyer approval, timers, admin
-- dispute decision, payment sync).
create function public.order_ledger()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  gross bigint := new.amount::bigint * 100;
  fee bigint;
  share bigint;
  paid boolean;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'PAID_HELD' then
    new.commission_bps := coalesce(new.commission_bps, public.commission_bps());
  end if;
  if new.commission_bps is null then
    return new; -- an order that never reached PAID_HELD under the ledger: nothing to move
  end if;

  fee := (gross * new.commission_bps + 5000) / 10000; -- round half up
  share := gross - fee;
  select exists (select 1 from public.ledger_entries where key = 'order-' || new.id || '-paid') into paid;

  if new.status = 'PAID_HELD' then
    insert into public.ledger_entries (seller_id, bucket, kind, amount, order_id, key)
    values (new.seller_id, 'pending', 'order_paid', share, new.id, 'order-' || new.id || '-paid')
    on conflict (key) do nothing;
  elsif new.status = 'COMPLETED' and paid then
    insert into public.ledger_entries (seller_id, bucket, kind, amount, order_id, key) values
      (new.seller_id, 'pending', 'order_completed', -share, new.id, 'order-' || new.id || '-pending-out'),
      (new.seller_id, 'available', 'order_completed', share, new.id, 'order-' || new.id || '-available-in'),
      (new.seller_id, 'commission', 'commission', fee, new.id, 'order-' || new.id || '-commission')
    on conflict (key) do nothing;
  elsif new.status in ('REFUNDED', 'CANCELLED') and paid
    and not exists (select 1 from public.ledger_entries where key = 'order-' || new.id || '-pending-out') then
    insert into public.ledger_entries (seller_id, bucket, kind, amount, order_id, key)
    values (new.seller_id, 'pending', 'order_reversed', -share, new.id, 'order-' || new.id || '-reversed')
    on conflict (key) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.order_ledger() from public, anon, authenticated;

create trigger orders_ledger
before update on public.orders
for each row execute function public.order_ledger();

-- Orders already in flight when this ships join the ledger, so no seller is stranded
-- (the old per-order Omise payout is switched off).
update public.orders set commission_bps = public.commission_bps()
where commission_bps is null
  and (status in ('PAID_HELD', 'SHIPPED', 'DELIVERED', 'DISPUTED') or payout_status = 'pending');

insert into public.ledger_entries (seller_id, bucket, kind, amount, order_id, key)
select seller_id, 'pending', 'order_paid',
       amount::bigint * 100 - (amount::bigint * 100 * commission_bps + 5000) / 10000,
       id, 'order-' || id || '-paid'
from public.orders
where commission_bps is not null
on conflict (key) do nothing;

-- Completed but not yet paid out by the old route: money is already withdrawable.
insert into public.ledger_entries (seller_id, bucket, kind, amount, order_id, key)
select o.seller_id, v.bucket, v.kind,
       case v.part when 'out' then -s.share when 'in' then s.share else s.fee end,
       o.id, 'order-' || o.id || '-' || v.suffix
from public.orders o
cross join lateral (select (o.amount::bigint * 100 * o.commission_bps + 5000) / 10000 as fee,
                           o.amount::bigint * 100 - (o.amount::bigint * 100 * o.commission_bps + 5000) / 10000 as share) s
cross join (values
  ('pending', 'order_completed', 'out', 'pending-out'),
  ('available', 'order_completed', 'in', 'available-in'),
  ('commission', 'commission', 'fee', 'commission')
) as v(bucket, kind, part, suffix)
where o.status = 'COMPLETED' and o.payout_status = 'pending' and o.commission_bps is not null
on conflict (key) do nothing;

-- Atomic withdrawal request. The seller row is locked so two tabs or a double click
-- cannot both pass the balance check. Raises 'insufficient_balance' / 'no_bank_account'.
create function public.request_withdrawal(p_seller uuid, p_amount bigint)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  avail bigint;
  acct record;
  w uuid;
begin
  perform 1 from public.profiles where id = p_seller for update;
  select coalesce(sum(amount), 0) into avail
    from public.ledger_entries where seller_id = p_seller and bucket = 'available';
  if p_amount <= 0 or p_amount > avail then
    raise exception 'insufficient_balance';
  end if;
  select bank_brand, account_number_enc, account_name into acct
    from public.seller_payout_accounts where user_id = p_seller and account_number_enc is not null;
  if not found then
    raise exception 'no_bank_account';
  end if;
  insert into public.withdrawals (seller_id, amount, fee, bank_brand, account_number_enc, account_name)
  values (p_seller, p_amount, (p_amount + 50) / 100, acct.bank_brand, acct.account_number_enc, acct.account_name)
  returning id into w;
  insert into public.ledger_entries (seller_id, bucket, kind, amount, withdrawal_id, key)
  values (p_seller, 'available', 'withdrawal', -p_amount, w, 'withdrawal-' || w);
  return w;
end;
$$;

-- Admin marks a requested withdrawal paid (the 1% fee becomes TCS revenue) or failed
-- (the money returns to the seller's available balance). Only from 'requested', once.
create function public.finish_withdrawal(p_id uuid, p_paid boolean, p_ref text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  w record;
begin
  update public.withdrawals
     set status = case when p_paid then 'paid' else 'failed' end,
         bank_reference = nullif(trim(p_ref), ''),
         decided_at = now()
   where id = p_id and status = 'requested'
  returning * into w;
  if not found then
    raise exception 'not_requested';
  end if;
  if p_paid then
    insert into public.ledger_entries (seller_id, bucket, kind, amount, withdrawal_id, key)
    values (w.seller_id, 'commission', 'withdrawal_fee', w.fee, w.id, 'withdrawal-' || w.id || '-fee');
  else
    insert into public.ledger_entries (seller_id, bucket, kind, amount, withdrawal_id, key)
    values (w.seller_id, 'available', 'withdrawal_failed', w.amount, w.id, 'withdrawal-' || w.id || '-failed');
  end if;
end;
$$;

revoke all on function public.request_withdrawal(uuid, bigint), public.finish_withdrawal(uuid, boolean, text)
  from public, anon, authenticated;
