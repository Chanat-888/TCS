-- Removes everything ledger-test-setup.sql created, plus any withdrawals YOUR profile requested since the
-- test data was created (so do not start real withdrawals before running this). Safe to run twice.
-- It does NOT remove a bank account you saved on /profile; see the last line if you want that gone.
do $$
declare
  me uuid;
  t0 timestamptz;
begin
  if (select count(*) from public.profiles where display_name = 'Chanat') <> 1 then
    raise exception 'expected exactly one profile named Chanat - edit the name in this script';
  end if;
  select id into me from public.profiles where display_name = 'Chanat';
  select min(created_at) into t0 from public.orders where order_code like 'TEST-LEDGER-%';

  if t0 is not null then
    delete from public.ledger_entries
    where order_id in (select id from public.orders where order_code like 'TEST-LEDGER-%')
       or withdrawal_id in (select id from public.withdrawals where seller_id = me and created_at >= t0);
    delete from public.withdrawals where seller_id = me and created_at >= t0;
    delete from public.orders where order_code like 'TEST-LEDGER-%';
  end if;
  delete from public.listings where name = 'TEST-LEDGER card';
  delete from public.profiles where display_name = 'TEST-LEDGER buyer';
end $$;

-- Check: should return no rows for the test data, and your real balances (if any) are unchanged.
select count(*) as test_orders_left from public.orders where order_code like 'TEST-LEDGER-%';

-- If you set is_admin for the test, make sure it is back the way you want:
-- update public.profiles set is_admin = false where display_name = 'Chanat';
-- To remove the bank account you saved while testing (this deletes ANY account saved on that profile):
-- delete from public.seller_payout_accounts where user_id = (select id from public.profiles where display_name = 'Chanat');

-- Migration 0028 (seller verification): to undo a hand-test of the identity check, uncomment and run.
-- Deleting the rows also turns the profile's verified badge back off.
-- delete from public.seller_verifications where user_id = (select id from public.profiles where display_name = 'Chanat');
-- delete from public.seller_payout_accounts where user_id = (select id from public.profiles where display_name = 'Chanat');
