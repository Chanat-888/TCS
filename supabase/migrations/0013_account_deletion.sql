-- Account deletion never removes the profiles row itself: listings, orders,
-- bids, disputes, reviews and messages all reference profiles(id) with no
-- cascade, so a hard delete would fail (or break) every historical record
-- that names this person. Instead the row is anonymized in place and the
-- Auth login is removed via the admin API, so the person can never sign in
-- again, while past orders and reviews still resolve to a (now blank) name.
alter table public.profiles add column if not exists deleted_at timestamptz;
