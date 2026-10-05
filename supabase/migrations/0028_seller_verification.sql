-- Phase 4 of the payment plan: seller identity and bank-name check (docs/payment-plan.md section 9).
--
-- A seller sends a selfie holding the ID card plus the card front. An admin looks at them,
-- types the legal name from the card and approves or rejects; the images are DELETED on
-- either decision (the server removes the files, this table forgets the paths). Only the
-- name, who decided and when are kept. A second check ties the saved bank account to that
-- name: the admin sees the account holder name in our own bank app and confirms it matches.
-- A seller may withdraw only when both are done; changing the account clears the second one.
--
-- Private like the ledger tables: RLS on, no API-role grants, server code only.

insert into storage.buckets (id, name, public)
values ('id-checks', 'id-checks', false)
on conflict (id) do nothing;

create table public.seller_verifications (
  user_id uuid primary key references public.profiles(id),
  status text not null check (status in ('submitted', 'approved', 'rejected')),
  legal_name text,
  selfie_path text,
  card_path text,
  reject_reason text,
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id)
);
create index seller_verifications_status_idx on public.seller_verifications(status, submitted_at);

alter table public.seller_payout_accounts add column if not exists name_checked_at timestamptz;

-- Changing the bank, number or holder name needs a new name check (an admin's own
-- update of name_checked_at alone is not a change of account).
create function public.clear_name_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.bank_brand, new.account_number_enc, new.account_name) is distinct from (old.bank_brand, old.account_number_enc, old.account_name)
     and new.name_checked_at is not distinct from old.name_checked_at then
    new.name_checked_at := null;
  end if;
  return new;
end;
$$;

create trigger seller_payout_accounts_clear_name_check
before update on public.seller_payout_accounts
for each row execute function public.clear_name_check();

create function public.seller_verified(p_user uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.seller_verifications v
    join public.seller_payout_accounts a on a.user_id = v.user_id
    where v.user_id = p_user and v.status = 'approved' and a.name_checked_at is not null
  )
$$;

-- profiles.verified (the public badge) follows the two checks.
create function public.sync_verified()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  u uuid := coalesce(new.user_id, old.user_id);
begin
  update public.profiles set verified = public.seller_verified(u) where id = u;
  return null;
end;
$$;

create trigger seller_verifications_sync_verified
after insert or update or delete on public.seller_verifications
for each row execute function public.sync_verified();
create trigger seller_payout_accounts_sync_verified
after insert or update or delete on public.seller_payout_accounts
for each row execute function public.sync_verified();

-- Admin decision on a submission. Returns the image paths so the server deletes the files;
-- the table forgets them at once. Only from 'submitted', once. Approving also clears any
-- earlier bank-name check, because the name it was checked against may differ.
create function public.decide_identity(p_user uuid, p_approve boolean, p_name text, p_reason text, p_admin uuid)
returns text[]
language plpgsql
set search_path = ''
as $$
declare
  v record;
begin
  if p_approve and nullif(trim(p_name), '') is null then
    raise exception 'name_required';
  end if;
  select selfie_path, card_path into v
    from public.seller_verifications where user_id = p_user and status = 'submitted' for update;
  if not found then
    raise exception 'not_submitted';
  end if;
  update public.seller_verifications
     set status = case when p_approve then 'approved' else 'rejected' end,
         legal_name = case when p_approve then trim(p_name) else null end,
         reject_reason = case when p_approve then null else nullif(trim(p_reason), '') end,
         selfie_path = null, card_path = null,
         decided_at = now(), decided_by = p_admin
   where user_id = p_user;
  if p_approve then
    update public.seller_payout_accounts set name_checked_at = null where user_id = p_user;
  end if;
  return array_remove(array[v.selfie_path, v.card_path], null);
end;
$$;

-- Admin saw our own bank show the account holder name and it matches the legal name.
create function public.confirm_account_name(p_user uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.seller_payout_accounts set name_checked_at = now()
   where user_id = p_user and account_number_enc is not null
     and exists (select 1 from public.seller_verifications where user_id = p_user and status = 'approved');
  if not found then
    raise exception 'not_ready';
  end if;
end;
$$;

-- Same as 0026 except a seller must be verified first.
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
  if not public.seller_verified(p_seller) then
    raise exception 'not_verified';
  end if;
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

alter table public.seller_verifications enable row level security;
revoke all on public.seller_verifications from anon, authenticated;
revoke all on function
  public.clear_name_check(), public.seller_verified(uuid), public.sync_verified(),
  public.decide_identity(uuid, boolean, text, text, uuid), public.confirm_account_name(uuid)
  from public, anon, authenticated;
