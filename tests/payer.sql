-- Migration 0030: payer fields and the slip reference. Runs after 0029 and the scenarios above.
do $$
declare
  s uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  o uuid; o2 uuid; sl uuid; sl2 uuid; sl3 uuid;
begin
  assert public.normalize_payer_name('  นาย  สมชาย   ใจดี ') = 'สมชาย ใจดี', 'title and spaces removed';
  assert public.normalize_payer_name('MR. John  SMITH') = 'john smith', 'case and english title';
  assert public.normalize_payer_name('   ') is null, 'blank is null';

  insert into public.profiles (id) values (s), (b);
  insert into public.orders (seller_id, amount) values (s, 400) returning id into o;
  insert into public.payment_slips (order_id, buyer_id, image_path, slip_ref, slip_bank) values (o, b, 'p/1.jpg', 'REF-AAA-1111111', 'scb') returning id into sl;

  -- The same slip (same reference) cannot be used for another order while it is in use.
  insert into public.orders (seller_id, amount) values (s, 400) returning id into o2;
  begin
    insert into public.payment_slips (order_id, buyer_id, image_path, slip_ref) values (o2, b, 'p/2.jpg', 'REF-AAA-1111111');
    assert false, 'reused slip reference must fail';
  exception when unique_violation then null;
  end;

  -- Accept stores the payer (and a cleaned name key); blank fields are fine.
  perform public.decide_slip(sl, 'accept', 'STMT-PAYER-1', null, 'นาย สมชาย ใจดี', 'scb', 'xxx-x-x1234-x');
  assert (select payer_name = 'นาย สมชาย ใจดี' and payer_name_key = 'สมชาย ใจดี' and payer_bank = 'scb' and payer_account_hint = 'xxx-x-x1234-x' from public.payment_slips where id = sl), 'payer stored';

  -- A rejected slip frees its reference, so the buyer can upload it again.
  insert into public.payment_slips (order_id, buyer_id, image_path, slip_ref) values (o2, b, 'p/3.jpg', 'REF-BBB-2222222') returning id into sl2;
  perform public.decide_slip(sl2, 'reject', 'amount does not match', null, 'ignored', 'kbank', null);
  assert (select payer_name is null and payer_bank is null from public.payment_slips where id = sl2), 'a rejection stores no payer';
  insert into public.payment_slips (order_id, buyer_id, image_path, slip_ref) values (o2, b, 'p/4.jpg', 'REF-BBB-2222222') returning id into sl3;

  -- A typo found later can be fixed, only on a decided slip.
  perform public.fix_payer(sl, 'Somchai Jaidee', 'kbank', '');
  assert (select payer_name_key = 'somchai jaidee' and payer_bank = 'kbank' and payer_account_hint is null from public.payment_slips where id = sl), 'payer fixed';
  begin
    perform public.fix_payer(sl3, 'x', 'scb', 'x');
    assert false, 'a slip still in review cannot be edited here';
  exception when others then
    assert sqlerrm = 'not_decided', 'got ' || sqlerrm;
  end;
end $$;
