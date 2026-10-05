-- Scenarios for migration 0026 (runs after 0025 and ledger.sql). Any failed assert aborts psql.
do $$
declare
  s uuid := gen_random_uuid();
  o uuid; o2 uuid; w uuid;
begin
  insert into public.profiles (id) values (s);
  insert into public.seller_payout_accounts (user_id, omise_recipient_id, bank_brand, account_last4, account_name, account_number_enc)
  values (s, null, 'kbank', '1234', 'Seller', 'enc');

  -- A completed order whose payment is not matched yet is available in the ledger but not withdrawable.
  insert into public.orders (seller_id, amount) values (s, 1000) returning id into o;
  update public.orders set status = 'PAID_HELD' where id = o;
  update public.orders set status = 'COMPLETED' where id = o;
  assert public.withdrawable(s) = 0, 'unmatched payment is held back';
  begin
    perform public.request_withdrawal(s, 100);
    assert false, 'withdrawing unmatched money must raise';
  exception when others then
    assert sqlerrm = 'insufficient_balance', 'raises insufficient_balance, got ' || sqlerrm;
  end;

  -- Matching releases it. A statement line pays one order only.
  begin
    perform public.match_order_payment(o, ' ');
    assert false, 'blank reference must raise';
  exception when others then
    assert sqlerrm = 'reference_required', 'got ' || sqlerrm;
  end;
  perform public.match_order_payment(o, 'STMT-1');
  assert public.withdrawable(s) = 91000, 'matched payment is withdrawable';
  begin
    perform public.match_order_payment(o, 'STMT-2');
    assert false, 'matching twice must raise';
  exception when others then
    assert sqlerrm = 'not_matchable', 'got ' || sqlerrm;
  end;
  insert into public.orders (seller_id, amount) values (s, 500) returning id into o2;
  update public.orders set status = 'PAID_HELD' where id = o2;
  begin
    perform public.match_order_payment(o2, 'STMT-1');
    assert false, 'reused statement line must fail';
  exception when unique_violation then null;
  end;

  -- Held orders still count as owed, and a requested withdrawal still counts until transferred.
  w := public.request_withdrawal(s, 50000);
  assert public.total_owed() >= 0, 'owed computes';
  assert (select sum(total) from public.seller_balances where bucket <> 'commission' and seller_id = s) = 91000 - 50000 + 45500,
    'seller balances: left + pending of the 500 order';

  -- Reconciliation: owed comes from the ledger, difference is balance - owed.
  perform public.log_reconciliation(public.total_owed() - 100);
  assert (select difference from public.reconciliation_log order by id desc limit 1) = -100, 'shortfall shows as negative';

  -- Export: this month's ledger totals and the seller's closing balance.
  assert (select amount from public.monthly_export(current_date) where section = 'month' and label = 'commission / commission') > 0, 'commission in export';
  assert (select amount from public.monthly_export(current_date) where section = 'closing' and seller_id = s and label = 'available') = 41000, 'closing available';
end $$;
