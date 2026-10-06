-- Phase 0 of the payment plan: pay-in by PromptPay QR into account B plus a transfer slip
-- (docs/payment-plan.md sections 5, 11, 14, 19.4).
--
-- The buyer pays the QR and uploads the slip (private bucket). An admin checks the slip against
-- account B's bank statement and confirms with the statement reference: that sets the order to
-- PAID_HELD (the ledger trigger credits the seller) and does the Phase 2 statement match in the
-- same step. A slip that cannot be accepted (order already paid or cancelled, double payment) goes
-- to "refund due" and is refunded by hand to the paying account. A slip reader can replace the
-- admin step later without changing these tables.
--
-- Private like the ledger tables: RLS on, no API-role grants, server code only.

insert into storage.buckets (id, name, public)
values ('payment-slips', 'payment-slips', false)
on conflict (id) do nothing;

create table public.payment_slips (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  buyer_id uuid not null references public.profiles(id),
  image_path text not null,
  status text not null default 'review'
    check (status in ('review', 'accepted', 'rejected', 'refund_due', 'refunded')),
  -- Accepted: the bank-statement reference. Rejected / refund due: the reason. Refunded: the refund reference.
  note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id)
);
create index payment_slips_status_idx on public.payment_slips(status, created_at);
-- A buyer cannot stack slips: one waiting for review per order.
create unique index payment_slips_one_review on public.payment_slips(order_id) where status = 'review';

-- Admin decision on a slip waiting for review.
--   accept: p_note is the statement reference (required, one statement line pays one order)
--   reject: p_note is the reason (the buyer sees it and can upload another slip)
--   refund: p_note is why; the money is refunded by hand to the account that paid
create function public.decide_slip(p_slip uuid, p_decision text, p_note text, p_admin uuid)
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
         note = ref, decided_at = now(), decided_by = p_admin
   where id = p_slip;
end;
$$;

-- The refund was transferred by hand to the paying account.
create function public.finish_refund(p_slip uuid, p_ref text, p_admin uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if nullif(trim(p_ref), '') is null then
    raise exception 'reference_required';
  end if;
  update public.payment_slips
     set status = 'refunded', note = trim(p_ref), decided_at = now(), decided_by = p_admin
   where id = p_slip and status = 'refund_due';
  if not found then
    raise exception 'not_refund_due';
  end if;
end;
$$;

alter table public.payment_slips enable row level security;
revoke all on public.payment_slips from anon, authenticated;
revoke all on function public.decide_slip(uuid, text, text, uuid), public.finish_refund(uuid, text, uuid)
  from public, anon, authenticated;
