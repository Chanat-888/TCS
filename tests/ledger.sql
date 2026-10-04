-- Scenarios for the ledger migration. Any failed assert aborts psql (ON_ERROR_STOP).
create function public.bal(s uuid, b text) returns bigint language sql as
  $$ select coalesce(sum(amount), 0)::bigint from public.ledger_entries where seller_id = s and bucket = b $$;

do $$
declare
  s uuid := gen_random_uuid();
  o uuid; o2 uuid; o3 uuid; o4 uuid; w uuid; w2 uuid;
begin
  insert into public.profiles (id) values (s);
  -- Saved the new way: no Omise recipient, number stored encrypted.
  insert into public.seller_payout_accounts (user_id, omise_recipient_id, bank_brand, account_last4, account_name, account_number_enc)
  values (s, null, 'kbank', '1234', 'Seller', 'enc');

  -- 1,000 baht order: pay, then complete. Seller keeps 910, TCS 90 (9%).
  insert into public.orders (seller_id, amount) values (s, 1000) returning id into o;
  update public.orders set status = 'PAID_HELD' where id = o;
  assert public.bal(s, 'pending') = 91000, 'paid order credits seller share as pending';
  assert (select commission_bps from public.orders where id = o) = 900, 'rate is stored on the order';
  update public.orders set status = 'SHIPPED' where id = o;
  update public.orders set status = 'COMPLETED' where id = o;
  assert public.bal(s, 'pending') = 0, 'completed order leaves pending';
  assert public.bal(s, 'available') = 91000, 'completed order is withdrawable';
  assert public.bal(s, 'commission') = 9000, 'commission recorded as ours';

  -- Repeating a status (or a retried trigger) adds nothing.
  update public.orders set status = 'COMPLETED' where id = o;
  assert (select count(*) from public.ledger_entries where order_id = o) = 4, 'no duplicate entries';

  -- Withdrawals: balance check, fee, paid and failed paths.
  begin
    perform public.request_withdrawal(s, 91001);
    assert false, 'over-withdrawal must raise';
  exception when others then
    assert sqlerrm = 'insufficient_balance', 'over-withdrawal raises insufficient_balance, got ' || sqlerrm;
  end;
  w := public.request_withdrawal(s, 50000);
  assert (select fee from public.withdrawals where id = w) = 500, '1% fee';
  assert public.bal(s, 'available') = 41000, 'withdrawal deducts at once';
  perform public.finish_withdrawal(w, true, 'REF1');
  assert public.bal(s, 'commission') = 9500, 'fee becomes ours when paid';
  begin
    perform public.finish_withdrawal(w, true, 'REF1');
    assert false, 'second finish must raise';
  exception when others then
    assert sqlerrm = 'not_requested', 'finish only once, got ' || sqlerrm;
  end;
  w2 := public.request_withdrawal(s, 10000);
  perform public.finish_withdrawal(w2, false, 'bank rejected');
  assert public.bal(s, 'available') = 41000, 'failed withdrawal returns the money';
  assert public.bal(s, 'commission') = 9500, 'no fee on a failed withdrawal';

  -- A seller without a saved account cannot withdraw.
  declare s2 uuid := gen_random_uuid(); o5 uuid;
  begin
    insert into public.profiles (id) values (s2);
    insert into public.orders (seller_id, amount) values (s2, 100) returning id into o5;
    update public.orders set status = 'PAID_HELD' where id = o5;
    update public.orders set status = 'COMPLETED' where id = o5;
    perform public.request_withdrawal(s2, 100);
    assert false, 'no account must raise';
  exception when others then
    assert sqlerrm = 'no_bank_account', 'raises no_bank_account, got ' || sqlerrm;
  end;

  -- Refund after a dispute reverses the pending credit.
  insert into public.orders (seller_id, amount) values (s, 999) returning id into o2;
  update public.orders set status = 'PAID_HELD' where id = o2;
  update public.orders set status = 'DISPUTED' where id = o2;
  update public.orders set status = 'REFUNDED' where id = o2;
  assert public.bal(s, 'pending') = 0, 'refund reverses pending';
  assert public.bal(s, 'available') = 41000, 'refund does not touch available';

  -- Cancelled after payment also reverses.
  insert into public.orders (seller_id, amount) values (s, 500) returning id into o3;
  update public.orders set status = 'PAID_HELD' where id = o3;
  update public.orders set status = 'CANCELLED' where id = o3;
  assert public.bal(s, 'pending') = 0, 'cancel reverses pending';

  -- An order that never went through the ledger moves nothing.
  insert into public.orders (seller_id, amount, status) values (s, 700, 'SHIPPED') returning id into o4;
  update public.orders set status = 'COMPLETED' where id = o4;
  assert not exists (select 1 from public.ledger_entries where order_id = o4), 'legacy order untouched';

  -- Totals: everything the ledger holds equals what was paid in.
  assert (select sum(total) from public.seller_balances where seller_id = s) = 41000 + 9500, 'balances add up';
end $$;

-- Backfill: the in-flight 1,000 order is pending (910), the unpaid completed 2,000 order is withdrawable (1,820).
-- The 3,000 order was already paid out the old way and is left alone.
do $$
declare s uuid := '00000000-0000-0000-0000-00000000000a';
begin
  assert public.bal(s, 'pending') = 91000, 'backfilled in-flight order is pending';
  assert public.bal(s, 'available') = 182000, 'backfilled completed order is available';
  assert public.bal(s, 'commission') = 18000, 'backfilled commission';
  update public.orders set status = 'COMPLETED' where seller_id = s and amount = 1000;
  assert public.bal(s, 'pending') = 0 and public.bal(s, 'available') = 273000, 'backfilled order completes normally';
  assert not exists (select 1 from public.ledger_entries l join public.orders o on o.id = l.order_id where o.amount = 3000), 'already-paid order untouched';
end $$;
