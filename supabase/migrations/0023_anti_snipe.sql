-- Sellers choose how anti-snipe protection behaves for their own auction: a bid
-- landing within this many seconds of closing pushes ends_at out by the same
-- amount, repeating until a bid-free window passes. 0 turns it off entirely
-- (a hard deadline). Existing rows keep the old fixed 120s (2 min) behavior.
alter table public.listings
  add column if not exists anti_snipe_seconds integer not null default 120
  check (anti_snipe_seconds = 0 or anti_snipe_seconds between 30 and 1800);
