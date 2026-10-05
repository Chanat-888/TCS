-- Test data for trying the wallet ledger (migration 0025) by hand. NOT a migration: paste it into
-- the Supabase SQL editor once, test, then run ledger-test-cleanup.sql.
--
-- It gives YOUR profile (display name "Chanat" - edit the name below if yours differs) three sales
-- from a fake buyer, so /earnings has something to show:
--   TEST-LEDGER-A  500 baht, completed  -> 455.00 available, 45.00 commission (9%)
--   TEST-LEDGER-B 1000 baht, paid, held -> 910.00 pending
--   TEST-LEDGER-C  300 baht, refunded   -> shows in history, balance 0
-- Everything it creates is named TEST-LEDGER so the cleanup script finds it. It touches no real orders.
do $$
declare
  me uuid;
  buyer uuid := '00000000-0000-4000-8000-00000000b001';
  l uuid;
  o uuid;
begin
  if (select count(*) from public.profiles where display_name = 'Chanat') <> 1 then
    raise exception 'expected exactly one profile named Chanat - edit the name in this script';
  end if;
  select id into me from public.profiles where display_name = 'Chanat';
  if exists (select 1 from public.orders where order_code like 'TEST-LEDGER-%') then
    raise exception 'test data already exists - run ledger-test-cleanup.sql first';
  end if;

  insert into public.profiles (id, display_name, avatar_initial)
  values (buyer, 'TEST-LEDGER buyer', 'T')
  on conflict (id) do nothing;

  insert into public.listings (seller_id, name, set_name, category, rarity, condition, start_price, current_price, ends_at, status)
  values (me, 'TEST-LEDGER card', 'TEST', 'rare', 'RR', 'NM', 100, 100, now() - interval '1 day', 'sold')
  returning id into l;

  -- Each status change fires the ledger trigger, exactly like the app does.
  insert into public.orders (order_code, listing_id, buyer_id, seller_id, amount)
  values ('TEST-LEDGER-A', l, buyer, me, 500) returning id into o;
  update public.orders set status = 'PAID_HELD' where id = o;
  update public.orders set status = 'SHIPPED' where id = o;
  update public.orders set status = 'COMPLETED' where id = o;

  insert into public.orders (order_code, listing_id, buyer_id, seller_id, amount)
  values ('TEST-LEDGER-B', l, buyer, me, 1000) returning id into o;
  update public.orders set status = 'PAID_HELD' where id = o;

  insert into public.orders (order_code, listing_id, buyer_id, seller_id, amount)
  values ('TEST-LEDGER-C', l, buyer, me, 300) returning id into o;
  update public.orders set status = 'PAID_HELD' where id = o;
  update public.orders set status = 'DISPUTED' where id = o;
  update public.orders set status = 'REFUNDED' where id = o;
end $$;

-- Check: expect available 455.00 and pending 910.00 (commission 45.00 is TCS's, not the seller's).
select bucket, total / 100.0 as baht
from public.seller_balances
where seller_id = (select id from public.profiles where display_name = 'Chanat');

-- OPTIONAL - to open /admin/withdrawals with your own account, uncomment, run, and put it back afterwards:
-- update public.profiles set is_admin = true  where display_name = 'Chanat';
-- update public.profiles set is_admin = false where display_name = 'Chanat';
--
-- Then in the app: save a bank account on /profile, open /earnings, withdraw 100 baht (fee 1.00, you
-- receive 99.00), open /admin/withdrawals and mark it paid (the fee becomes TCS's) or failed (the
-- money returns to available). Run the check query above again after each step.
