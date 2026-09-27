-- "Spread" posts: one photo (or a few) of many cards laid out, where each card is a
-- separate item the buyer can pick individually, by tapping its numbered pin on the photo
-- or its row in the list. The post itself is a normal `listings` row (post_kind = 'spread'), so orders,
-- checkout, disputes and browse keep working; the cards live in `listing_items`, and an
-- order's cards are the items whose order_id points at it.

alter table public.listings
  add column if not exists post_kind text not null default 'single'
    check (post_kind in ('single', 'spread')),
  -- Up to a few photos for a spread post; photo_front_url mirrors the first.
  add column if not exists photo_urls text[] not null default '{}';

create table if not exists public.listing_items (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  position smallint not null check (position between 1 and 60), -- the number shown on the pin
  name text not null,
  rarity text not null,
  condition text not null,
  price integer not null check (price > 0),
  status text not null default 'available' check (status in ('available', 'reserved', 'sold')),
  reserved_by uuid references public.profiles(id),
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (listing_id, position)
);

-- Where the seller tapped to pin the card: which photo, and the point as a % of that
-- photo's width (x) and height (y). Added separately so the migration also works if an
-- earlier draft of this table was already applied; the circle-size columns of that
-- draft are dropped.
alter table public.listing_items
  add column if not exists photo_index smallint not null default 0 check (photo_index between 0 and 3),
  add column if not exists x real not null default 50 check (x between 0 and 100),
  add column if not exists y real not null default 50 check (y between 0 and 100),
  drop column if exists aspect,
  drop column if exists r;

create index if not exists listing_items_listing_idx on public.listing_items (listing_id);
create index if not exists listing_items_order_idx on public.listing_items (order_id);

-- Reached only through server code with the service role, like orders: `reserved_by`
-- is private, so there are deliberately no public policies.
alter table public.listing_items enable row level security;

-- Keep a card's state in step with its order, whichever code path moves the order:
-- an order that is cancelled (unpaid after 24h, late shipment, agreed cancellation)
-- gives its cards back; an order that gets paid marks them sold.
create or replace function public.sync_listing_items_with_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'CANCELLED' and old.status is distinct from 'CANCELLED' then
    update public.listing_items
       set status = 'available', order_id = null, reserved_by = null
     where order_id = new.id;
  elsif old.status = 'PENDING_PAYMENT' and new.status <> 'PENDING_PAYMENT' then
    update public.listing_items set status = 'sold' where order_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_listing_items_with_order on public.orders;
create trigger sync_listing_items_with_order
  after update of status on public.orders
  for each row execute function public.sync_listing_items_with_order();
