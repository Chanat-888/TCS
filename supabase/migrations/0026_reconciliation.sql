-- Phase 2 of the payment plan: bank-statement matching, daily reconciliation, monthly export
-- (docs/payment-plan.md sections 5, 11, 12, 15).
--
-- Private like the ledger tables: RLS on, no API-role grants, server code only.

-- A payment becomes withdrawable only after an admin matched it to a line on account B's
-- bank statement. The reference is the statement line; each line can pay one order.
alter table public.orders
  add column if not exists bank_matched_at timestamptz,
  add column if not exists bank_reference text;
create unique index if not exists orders_bank_reference_key on public.orders(bank_reference) where bank_reference is not null;

-- Orders already in the ledger were paid before matching existed.
update public.orders set bank_matched_at = now() where commission_bps is not null and bank_matched_at is null;

create function public.match_order_payment(p_order uuid, p_ref text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if nullif(trim(p_ref), '') is null then
    raise exception 'reference_required';
  end if;
  update public.orders set bank_matched_at = now(), bank_reference = trim(p_ref)
   where id = p_order and bank_matched_at is null and commission_bps is not null
     and status not in ('PENDING_PAYMENT', 'REFUNDED', 'CANCELLED');
  if not found then
    raise exception 'not_matchable';
  end if;
end;
$$;

-- What a seller can withdraw: the available balance minus completed orders whose payment
-- is not matched to the bank statement yet (their share is in 'available' but held back).
create function public.withdrawable(p_seller uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  select greatest(
    coalesce((select sum(amount) from public.ledger_entries where seller_id = p_seller and bucket = 'available'), 0)
    - coalesce((select sum(g - (g * commission_bps + 5000) / 10000)
                  from (select amount::bigint * 100 as g, commission_bps from public.orders
                         where seller_id = p_seller and status = 'COMPLETED' and bank_matched_at is null
                           and commission_bps is not null) u), 0),
    0)::bigint
$$;

-- Same as 0025 except the balance check uses withdrawable().
create or replace function public.request_withdrawal(p_seller uuid, p_amount bigint)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  acct record;
  w uuid;
begin
  perform 1 from public.profiles where id = p_seller for update;
  if p_amount <= 0 or p_amount > public.withdrawable(p_seller) then
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

-- What TCS owes all sellers: the cash that must be in account B. Requested withdrawals
-- already left the balances but are not transferred yet, so they still count.
create function public.total_owed()
returns bigint
language sql
stable
set search_path = ''
as $$
  select (coalesce((select sum(total) from public.seller_balances where bucket <> 'commission'), 0)
        + coalesce((select sum(amount - fee) from public.withdrawals where status = 'requested'), 0))::bigint
$$;

-- One row per check. The admin types B's bank balance; the owed total comes from the ledger.
-- difference > 0: B holds more than owed (our commission, or an unidentified deposit);
-- difference < 0: shortfall, the alarm.
create table public.reconciliation_log (
  id bigint generated always as identity primary key,
  b_balance bigint not null,
  owed bigint not null,
  difference bigint generated always as (b_balance - owed) stored,
  created_at timestamptz not null default now()
);

create function public.log_reconciliation(p_balance bigint)
returns void
language sql
set search_path = ''
as $$
  insert into public.reconciliation_log (b_balance, owed) values (p_balance, public.total_owed())
$$;

-- Accountant export for one month: ledger totals per kind, then every seller's closing balances.
create function public.monthly_export(p_month date)
returns table (section text, label text, seller_id uuid, amount bigint)
language sql
stable
set search_path = ''
as $$
  select 'month', kind || ' / ' || bucket, null::uuid, sum(amount)::bigint
    from public.ledger_entries
   where created_at >= date_trunc('month', p_month) and created_at < date_trunc('month', p_month) + interval '1 month'
   group by kind, bucket
  union all
  select 'closing', bucket, l.seller_id, sum(amount)::bigint
    from public.ledger_entries l
   where created_at < date_trunc('month', p_month) + interval '1 month'
   group by l.seller_id, bucket
  having sum(amount) <> 0
  order by 1, 2, 3
$$;

alter table public.reconciliation_log enable row level security;
revoke all on public.reconciliation_log from anon, authenticated;
revoke all on function
  public.match_order_payment(uuid, text), public.withdrawable(uuid), public.total_owed(),
  public.log_reconciliation(bigint), public.monthly_export(date)
  from public, anon, authenticated;
