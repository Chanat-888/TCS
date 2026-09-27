-- Notifications ("you were outbid", "your watched auction is ending / ended")
-- and a buyer watchlist to opt an auction into those alerts.
--
-- Unlike orders/disputes/messages, these ARE read straight from the browser
-- (the bell needs a live Realtime subscription, same as bids/listings do for
-- LiveBidding), so real auth.uid()-scoped RLS is used instead of the
-- server-only pattern. Writes still only ever happen through server actions
-- and the timers cron using the service role — there is no insert policy for
-- anon/authenticated, so a user can never create a notification for anyone
-- (including themselves) directly.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('outbid', 'auction_won', 'auction_ended', 'auction_ending_soon')),
  title text not null,
  body text,
  listing_id uuid references public.listings(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications" on public.notifications
  for select using (auth.uid() = user_id);

-- The only edit the app ever makes is marking one's own notification read;
-- letting a user update their own row (id and user_id are still theirs by
-- the same check) is an acceptable trade for not needing a server round trip.
drop policy if exists "users mark own notifications read" on public.notifications;
create policy "users mark own notifications read" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, listing_id)
);

create index if not exists watchlist_user_id_idx on public.watchlist (user_id, created_at desc);
create index if not exists watchlist_listing_id_idx on public.watchlist (listing_id);

alter table public.watchlist enable row level security;

drop policy if exists "users manage own watchlist" on public.watchlist;
create policy "users manage own watchlist" on public.watchlist
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- alter publication ... add table errors if the table is already a member,
-- so guard it (there's no "add table if not exists").
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- Guards the "ending soon" timer step so a watched auction is only pinged
-- once, no matter how many times the step runs before it closes.
alter table public.listings
  add column if not exists ending_soon_notified boolean not null default false;
