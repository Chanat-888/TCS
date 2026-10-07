-- Who really paid (docs/payment-plan.md section 19.3): payer name, bank and the hidden account digits as the
-- slip or bank statement shows them, typed by the admin when confirming (a slip reader can fill them later),
-- linked to the buyer through payment_slips.buyer_id. Plus the transaction reference read from the slip's own
-- QR, which stops the same slip being used twice.
--
-- Hints only: the slip image stays the source of truth, nothing here blocks a payment, and a wrong or blank
-- value never moves money. The name is stored cleaned (lower case, no title) so the same person written two
-- ways matches.

alter table public.payment_slips
  add column if not exists payer_name text,
  add column if not exists payer_name_key text,
  add column if not exists payer_bank text,
  add column if not exists payer_account_hint text,
  -- Read from the slip's QR (a hint from the buyer's browser, re-parsed by the server): transaction
  -- reference and sending bank (a key of BANKS in src/lib/bankAccount.ts).
  add column if not exists slip_ref text,
  add column if not exists slip_bank text;
create index if not exists payment_slips_payer_idx on public.payment_slips(payer_bank, payer_name_key);

-- One transfer slip can only be in use once. A rejected slip may be uploaded again (the admin may have
-- rejected it for a wrong amount, not because it was a copy).
create unique index if not exists payment_slips_slip_ref_key on public.payment_slips(slip_ref)
  where slip_ref is not null and status <> 'rejected';

create function public.normalize_payer_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(btrim(regexp_replace(
    regexp_replace(lower(coalesce(p_name, '')), '^\s*(นางสาว|น\.ส\.|น\.ส|นาย|นาง|ด\.ช\.|ด\.ญ\.|เด็กชาย|เด็กหญิง|mr\.?|mrs\.?|miss|ms\.?)\s*', ''),
    '\s+', ' ', 'g')), '')
$$;

-- Same as 0029 plus the optional payer fields (stored on accept and refund, where the money question is).
drop function public.decide_slip(uuid, text, text, uuid);
create function public.decide_slip(
  p_slip uuid, p_decision text, p_note text, p_admin uuid,
  p_payer_name text default null, p_payer_bank text default null, p_payer_hint text default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  s record;
  ref text := nullif(trim(p_note), '');
begin
  if p_decision not in ('accept', 'reject', 'refund') then
    raise exception 'bad_decision';
  end if;
  select id, order_id into s from public.payment_slips where id = p_slip and status = 'review' for update;
  if not found then
    raise exception 'not_in_review';
  end if;

  if p_decision = 'accept' then
    if ref is null then
      raise exception 'reference_required';
    end if;
    update public.orders
       set status = 'PAID_HELD', paid_at = now(), payment_method = 'promptpay',
           bank_reference = ref, bank_matched_at = now()
     where id = s.order_id and status = 'PENDING_PAYMENT';
    if not found then
      raise exception 'order_not_payable';
    end if;
  end if;

  update public.payment_slips
     set status = case p_decision when 'accept' then 'accepted' when 'reject' then 'rejected' else 'refund_due' end,
         note = ref, decided_at = now(), decided_by = p_admin,
         payer_name = case when p_decision = 'reject' then null else nullif(btrim(p_payer_name), '') end,
         payer_name_key = case when p_decision = 'reject' then null else public.normalize_payer_name(p_payer_name) end,
         payer_bank = case when p_decision = 'reject' then null else nullif(btrim(p_payer_bank), '') end,
         payer_account_hint = case when p_decision = 'reject' then null else nullif(btrim(p_payer_hint), '') end
   where id = p_slip;
end;
$$;

-- The admin corrects the payer fields on a decided slip (a typo found later).
create function public.fix_payer(p_slip uuid, p_name text, p_bank text, p_hint text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.payment_slips
     set payer_name = nullif(btrim(p_name), ''), payer_name_key = public.normalize_payer_name(p_name),
         payer_bank = nullif(btrim(p_bank), ''), payer_account_hint = nullif(btrim(p_hint), '')
   where id = p_slip and status in ('accepted', 'refund_due', 'refunded');
  if not found then
    raise exception 'not_decided';
  end if;
end;
$$;

revoke all on function
  public.normalize_payer_name(text),
  public.decide_slip(uuid, text, text, uuid, text, text, text),
  public.fix_payer(uuid, text, text, text)
  from public, anon, authenticated;
