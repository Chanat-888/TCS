-- Ship date agreed by both sides. After payment the seller proposes a ship date
-- with a reason and the buyer accepts or declines; either side may later ask to
-- postpone (new date + reason) or to cancel the order, and the other side
-- accepts or declines. `orders.ship_by_at` holds the currently agreed date.
--
-- Like the other order tables, this is reached only through server actions with
-- the service role (RLS on, no anon policies); who may see or answer a proposal
-- is enforced in application code.

alter table public.orders
  add column if not exists ship_by_at timestamptz;

create table if not exists public.order_ship_proposals (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  proposed_by uuid not null references public.profiles(id),
  -- 'ship_date' = propose / postpone the ship date; 'cancel' = ask to cancel the order.
  kind text not null check (kind in ('ship_date', 'cancel')),
  proposed_date timestamptz,
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'withdrawn')),
  response_note text,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (kind <> 'ship_date' or proposed_date is not null)
);

create index if not exists order_ship_proposals_order_idx
  on public.order_ship_proposals (order_id, created_at desc);

-- At most one open question per order at a time.
create unique index if not exists order_ship_proposals_one_pending
  on public.order_ship_proposals (order_id) where status = 'pending';

alter table public.order_ship_proposals enable row level security;
