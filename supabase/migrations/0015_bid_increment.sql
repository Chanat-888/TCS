-- Sellers choose the minimum bid step per auction. Existing rows keep the old
-- fixed step of 100, so nothing changes for listings created before this.
alter table public.listings
  add column if not exists bid_increment integer not null default 100
  check (bid_increment between 5 and 1000);
