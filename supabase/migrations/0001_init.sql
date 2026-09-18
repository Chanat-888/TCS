-- TCS core schema.
-- Stub-auth phase: there is no real Supabase Auth session yet, so RLS only
-- grants public SELECT on browsable data (listings, bids, profiles, reviews).
-- All writes and any access to orders/disputes/messages go through server
-- actions using the service_role key, which enforces "who is allowed to see
-- this" in application code against the stub session user id. Replace with
-- real auth.uid()-scoped policies once phone-OTP auth is implemented.

create extension if not exists "pgcrypto";

create type listing_category as enum ('new', 'deck', 'rare');
create type listing_status as enum ('active', 'sold', 'cancelled', 'expired');
create type order_status as enum (
  'PENDING_PAYMENT', 'PAID_HELD', 'SHIPPED', 'DELIVERED',
  'COMPLETED', 'DISPUTED', 'CANCELLED', 'REFUNDED'
);
create type payment_method as enum ('promptpay', 'card');
create type dispute_reason as enum ('condition', 'wrong', 'authenticity', 'other');
create type dispute_decision as enum ('refund', 'release');

create table profiles (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  avatar_initial text not null,
  bio text not null default '',
  phone text unique,
  verified boolean not null default false,
  bank_name_matched boolean not null default false,
  is_admin boolean not null default false,
  tier text,
  created_at timestamptz not null default now()
);

create table listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references profiles(id),
  name text not null,
  set_name text not null,
  category listing_category not null,
  rarity text not null,
  condition text not null,
  description text not null default '',
  description_edited_at timestamptz,
  photo_front_url text,
  photo_back_url text,
  photos_locked boolean not null default false,
  start_price integer not null check (start_price > 0),
  buy_now_price integer check (buy_now_price is null or buy_now_price > 0),
  current_price integer not null,
  ends_at timestamptz not null,
  status listing_status not null default 'active',
  created_at timestamptz not null default now()
);

create index listings_seller_id_idx on listings(seller_id);
create index listings_status_idx on listings(status);

create table bids (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id),
  bidder_id uuid not null references profiles(id),
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index bids_listing_id_idx on bids(listing_id, created_at desc);

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_code text unique not null,
  listing_id uuid not null references listings(id),
  buyer_id uuid not null references profiles(id),
  seller_id uuid not null references profiles(id),
  amount integer not null,
  status order_status not null default 'PENDING_PAYMENT',
  payment_method payment_method,
  shipping_recipient text,
  shipping_phone text,
  shipping_address text,
  shipping_province text,
  shipping_postcode text,
  payment_deadline_at timestamptz,
  paid_at timestamptz,
  courier text,
  tracking_number text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  unboxing_video_url text,
  video_uploaded_at timestamptz,
  auto_approve_at timestamptz,
  approved_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);

create index orders_buyer_id_idx on orders(buyer_id);
create index orders_seller_id_idx on orders(seller_id);

create table disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid unique not null references orders(id),
  opened_by uuid not null references profiles(id),
  reason dispute_reason not null,
  description text not null default '',
  evidence_photo_urls text[] not null default '{}',
  decision dispute_decision,
  resolution_note text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid unique not null references orders(id),
  rater_id uuid not null references profiles(id),
  ratee_id uuid not null references profiles(id),
  rating smallint not null check (rating between 1 and 5),
  tags text[] not null default '{}',
  comment text,
  created_at timestamptz not null default now()
);

create index reviews_ratee_id_idx on reviews(ratee_id);

create table messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  sender_id uuid not null references profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

create index messages_order_id_idx on messages(order_id, created_at);

-- RLS: enable everywhere, public read on browsable tables only.
alter table profiles enable row level security;
alter table listings enable row level security;
alter table bids enable row level security;
alter table orders enable row level security;
alter table disputes enable row level security;
alter table reviews enable row level security;
alter table messages enable row level security;

create policy "profiles are publicly readable" on profiles for select using (true);
create policy "listings are publicly readable" on listings for select using (true);
create policy "bids are publicly readable" on bids for select using (true);
create policy "reviews are publicly readable" on reviews for select using (true);

-- orders, disputes, messages: no anon policies — accessed only server-side
-- with the service_role key, gated by the stub session user id in code.
