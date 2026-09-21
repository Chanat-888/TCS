-- Saved delivery addresses + meet-up delivery.
--
-- Addresses are PRIVATE. profiles is publicly readable through the Data API,
-- so addresses live in their own table with RLS enabled and NO policies, and
-- every grant to the API roles revoked. Only server code using the service
-- role can read or write them, and it always filters by the session user.
-- Checkout copies the chosen address into the order (orders.shipping_*), so
-- editing or deleting a saved address never changes past orders.

create table public.profile_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 20),
  recipient text not null check (char_length(recipient) between 2 and 60),
  phone text not null check (phone ~ '^[0-9]{9,10}$'),
  address text not null check (char_length(address) between 5 and 300),
  province text not null check (char_length(province) between 2 and 40),
  postcode text not null check (postcode ~ '^[0-9]{5}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profile_addresses_user_id_idx on public.profile_addresses(user_id);
-- At most one default address per person.
create unique index profile_addresses_one_default_idx on public.profile_addresses(user_id) where is_default;

alter table public.profile_addresses enable row level security;
revoke all on public.profile_addresses from anon, authenticated;

-- At most 5 saved addresses per person, enforced here as well as in the app.
create function public.enforce_address_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.profile_addresses where user_id = new.user_id) >= 5 then
    raise exception 'address limit reached' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_address_limit() from public, anon, authenticated;

create trigger profile_addresses_limit
before insert on public.profile_addresses
for each row execute function public.enforce_address_limit();

-- How an order is handed over. 'meetup' orders have no shipping address and no
-- tracking number; the seller confirms the hand-over instead. Existing orders
-- are all 'ship'.
alter table public.orders add column if not exists delivery_method text not null default 'ship';
alter table public.orders drop constraint if exists orders_delivery_method_check;
alter table public.orders add constraint orders_delivery_method_check
  check (delivery_method in ('ship', 'meetup'));
