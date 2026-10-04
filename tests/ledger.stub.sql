-- Just enough of the real schema for supabase/migrations/0025_ledger.sql to run in a scratch database.
drop schema if exists public cascade;
create schema public;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
end $$;
create type public.order_status as enum (
  'PENDING_PAYMENT', 'PAID_HELD', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'DISPUTED', 'CANCELLED', 'REFUNDED'
);
create table public.profiles (id uuid primary key default gen_random_uuid());
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id),
  amount integer not null,
  status public.order_status not null default 'PENDING_PAYMENT',
  payout_status text
);
create table public.seller_payout_accounts (
  user_id uuid primary key references public.profiles(id),
  omise_recipient_id text not null,
  bank_brand text not null,
  account_last4 text not null,
  account_name text not null
);

-- Orders that exist before the migration: one in flight, one completed but not yet paid out.
insert into public.profiles (id) values ('00000000-0000-0000-0000-00000000000a');
insert into public.orders (seller_id, amount, status, payout_status) values
  ('00000000-0000-0000-0000-00000000000a', 1000, 'SHIPPED', null),
  ('00000000-0000-0000-0000-00000000000a', 2000, 'COMPLETED', 'pending'),
  ('00000000-0000-0000-0000-00000000000a', 3000, 'COMPLETED', 'sent');
