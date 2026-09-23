-- "ประกาศหา" (wanted post): a buyer posts what card they're looking for,
-- other users browse them like listings, and can open a private chat with
-- the poster. Messages follow the same server-only pattern as `messages`
-- (0001_init.sql) — no anon policies, access gated in application code.

create table wanted_posts (
  id uuid primary key default gen_random_uuid(),
  poster_id uuid not null references profiles(id),
  name text not null,
  set_name text not null,
  category listing_category not null,
  max_price integer not null check (max_price > 0),
  note text not null default '',
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now()
);

create index wanted_posts_poster_id_idx on wanted_posts(poster_id);

create table wanted_post_messages (
  id uuid primary key default gen_random_uuid(),
  wanted_post_id uuid not null references wanted_posts(id),
  -- the non-poster participant; together with wanted_post_id this identifies
  -- one private thread (a post can get replies from many different people).
  responder_id uuid not null references profiles(id),
  sender_id uuid not null references profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

create index wanted_post_messages_thread_idx on wanted_post_messages(wanted_post_id, responder_id, created_at);

alter table wanted_posts enable row level security;
alter table wanted_post_messages enable row level security;

create policy "wanted posts are publicly readable" on wanted_posts for select using (true);

-- wanted_post_messages: no anon policies — accessed only server-side with the
-- service_role key, gated by the session user id in code (same as messages).
