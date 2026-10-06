-- Scenarios for migration 0029 (runs after 0025, 0026, 0028 and their tests). Any failed assert aborts psql.
do $$
declare
  s uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  o uuid; o2 uuid; o3 uuid; sl uuid; sl2 uuid; sl3 uuid;
begin
  insert into public.profiles (id) values (s), (b);
  insert into public.orders (seller_id, amount) values (s, 1000) returning id into o;
  insert into public.payment_slips (order_id, buyer_id, image_path) values (o, b, 'o/1.jpg') returning id into sl;

  -- A buyer cannot stack slips on one order.
  begin
    insert into public.payment_slips (order_id, buyer_id, image_path) values (o, b, 'o/2.jpg');
    assert false, 'second slip in review must fail';
  exception when unique_violation then null;
  end;

  -- Accepting needs the statement reference.
  begin
    perform public.decide_slip(sl, 'accept', '  ', null);
    assert false, 'accept needs a reference';
  exception when others then
    assert sqlerrm = 'reference_required', 'got ' || sqlerrm;
  end;

  -- Accept: the order is paid, the seller is credited pending, and the statement match is done.
  perform public.decide_slip(sl, 'accept', 'STMT-P1', null);
  assert (select status from public.orders where id = o) = 'PAID_HELD', 'order paid';
  assert (select bank_reference = 'STMT-P1' and bank_matched_at is not null and payment_method = 'promptpay' from public.orders where id = o), 'matched with the slip reference';
  assert (select coalesce(sum(amount), 0) from public.ledger_entries where seller_id = s and bucket = 'pending') = 91000, 'seller credited pending';
  assert (select status from public.payment_slips where id = sl) = 'accepted', 'slip accepted';
  begin
    perform public.decide_slip(sl, 'reject', 'x', null);
    assert false, 'a decided slip cannot be decided again';
  exception when others then
    assert sqlerrm = 'not_in_review', 'got ' || sqlerrm;
  end;

  -- The same statement line cannot pay a second order.
  insert into public.orders (seller_id, amount) values (s, 500) returning id into o2;
  insert into public.payment_slips (order_id, buyer_id, image_path) values (o2, b, 'o/3.jpg') returning id into sl2;
  begin
    perform public.decide_slip(sl2, 'accept', 'STMT-P1', null);
    assert false, 'reused statement reference must fail';
  exception when unique_violation then null;
  end;
  assert (select status from public.orders where id = o2) = 'PENDING_PAYMENT', 'failed accept changed nothing';

  -- Reject: the buyer can upload another slip afterwards.
  perform public.decide_slip(sl2, 'reject', 'amount does not match', null);
  assert (select status = 'rejected' and note = 'amount does not match' from public.payment_slips where id = sl2), 'rejected with reason';
  insert into public.payment_slips (order_id, buyer_id, image_path) values (o2, b, 'o/4.jpg') returning id into sl2;

  -- A slip for an order that was cancelled meanwhile cannot be accepted; it goes to refund and is refunded by hand.
  update public.orders set status = 'CANCELLED' where id = o2;
  begin
    perform public.decide_slip(sl2, 'accept', 'STMT-P2', null);
    assert false, 'cancelled order cannot be paid';
  exception when others then
    assert sqlerrm = 'order_not_payable', 'got ' || sqlerrm;
  end;
  perform public.decide_slip(sl2, 'refund', 'paid after cancel', null);
  assert (select status from public.payment_slips where id = sl2) = 'refund_due', 'refund due';
  begin
    perform public.finish_refund(sl2, '', null);
    assert false, 'refund needs a reference';
  exception when others then
    assert sqlerrm = 'reference_required', 'got ' || sqlerrm;
  end;
  perform public.finish_refund(sl2, 'REFUND-1', null);
  assert (select status = 'refunded' and note = 'REFUND-1' from public.payment_slips where id = sl2), 'refunded';
  begin
    perform public.finish_refund(sl2, 'REFUND-2', null);
    assert false, 'refund once';
  exception when others then
    assert sqlerrm = 'not_refund_due', 'got ' || sqlerrm;
  end;

  -- A double payment (order already paid) is refunded, never credited twice.
  insert into public.payment_slips (order_id, buyer_id, image_path) values (o, b, 'o/5.jpg') returning id into sl3;
  begin
    perform public.decide_slip(sl3, 'accept', 'STMT-P3', null);
    assert false, 'already-paid order cannot be paid again';
  exception when others then
    assert sqlerrm = 'order_not_payable', 'got ' || sqlerrm;
  end;
  assert (select coalesce(sum(amount), 0) from public.ledger_entries where seller_id = s and bucket = 'pending') = 91000, 'no second credit';
end $$;
