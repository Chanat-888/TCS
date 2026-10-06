-- Removes everything payin-test-setup.sql created, plus the slips and ledger entries made while testing it.
-- Safe to run twice. Slip images uploaded in the test stay in the private storage bucket payment-slips
-- (folder named after the order id): delete that folder in the Supabase dashboard (Storage).
do $$
begin
  delete from public.payment_slips where order_id in (select id from public.orders where order_code like 'TEST-PAYIN-%');
  delete from public.ledger_entries where order_id in (select id from public.orders where order_code like 'TEST-PAYIN-%');
  delete from public.orders where order_code like 'TEST-PAYIN-%';
  delete from public.listings where name = 'TEST-PAYIN card';
  delete from public.profiles where display_name = 'TEST-PAYIN seller';
end $$;

-- Check: should return 0.
select count(*) as test_orders_left from public.orders where order_code like 'TEST-PAYIN-%';
