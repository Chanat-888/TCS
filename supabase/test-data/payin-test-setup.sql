-- Test data for trying the PromptPay QR pay-in (migration 0029) by hand. NOT a migration: paste it into
-- the Supabase SQL editor once, test, then run payin-test-cleanup.sql.
--
-- It gives YOUR profile (display name "Chanat" - edit the name below if yours differs) one unpaid order
-- from a fake seller, so /orders and /checkout/<id> have something to pay:
--   TEST-PAYIN-A  300 baht, waiting for payment, deadline in 24 hours
-- Everything it creates is named TEST-PAYIN so the cleanup script finds it. It touches no real orders.
do $$
declare
  me uuid;
  seller uuid := '00000000-0000-4000-8000-00000000c001';
  l uuid;
begin
  if (select count(*) from public.profiles where display_name = 'Chanat') <> 1 then
    raise exception 'expected exactly one profile named Chanat - edit the name in this script';
  end if;
  select id into me from public.profiles where display_name = 'Chanat';
  if exists (select 1 from public.orders where order_code like 'TEST-PAYIN-%') then
    raise exception 'test data already exists - run payin-test-cleanup.sql first';
  end if;

  insert into public.profiles (id, display_name, avatar_initial)
  values (seller, 'TEST-PAYIN seller', 'T')
  on conflict (id) do nothing;

  insert into public.listings (seller_id, name, set_name, category, rarity, condition, start_price, current_price, ends_at, status)
  values (seller, 'TEST-PAYIN card', 'TEST', 'rare', 'RR', 'NM', 100, 300, now() - interval '1 hour', 'sold')
  returning id into l;

  insert into public.orders (order_code, listing_id, buyer_id, seller_id, amount, payment_deadline_at)
  values ('TEST-PAYIN-A', l, me, seller, 300, now() + interval '24 hours');
end $$;

-- Check: expect one row, status PENDING_PAYMENT.
select id, order_code, status, amount from public.orders where order_code = 'TEST-PAYIN-A';
