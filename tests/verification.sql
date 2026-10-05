-- Scenarios for migration 0028 (runs after 0025, 0026 and their tests). Any failed assert aborts psql.
do $$
declare
  s uuid := gen_random_uuid();
  o uuid; paths text[];
begin
  insert into public.profiles (id) values (s);
  insert into public.seller_payout_accounts (user_id, omise_recipient_id, bank_brand, account_last4, account_name, account_number_enc)
  values (s, null, 'kbank', '1234', 'Seller One', 'enc');
  insert into public.orders (seller_id, amount) values (s, 1000) returning id into o;
  update public.orders set status = 'PAID_HELD' where id = o;
  update public.orders set status = 'COMPLETED' where id = o;
  perform public.match_order_payment(o, 'STMT-V1');

  -- Money is there but an unverified seller cannot withdraw.
  begin
    perform public.request_withdrawal(s, 10000);
    assert false, 'unverified seller must not withdraw';
  exception when others then
    assert sqlerrm = 'not_verified', 'got ' || sqlerrm;
  end;

  -- Submit, reject (images forgotten, paths returned for deletion), resubmit, approve.
  insert into public.seller_verifications (user_id, status, selfie_path, card_path) values (s, 'submitted', 'a/selfie.jpg', 'a/card.jpg');
  paths := public.decide_identity(s, false, null, 'blurry', null);
  assert paths = array['a/selfie.jpg', 'a/card.jpg'], 'paths returned for deletion';
  assert (select selfie_path is null and card_path is null and status = 'rejected' and reject_reason = 'blurry' from public.seller_verifications where user_id = s), 'rejected row forgets images';
  begin
    perform public.decide_identity(s, true, 'Seller One', null, null);
    assert false, 'only a submitted row can be decided';
  exception when others then
    assert sqlerrm = 'not_submitted', 'got ' || sqlerrm;
  end;
  update public.seller_verifications set status = 'submitted', selfie_path = 'b/selfie.jpg', card_path = 'b/card.jpg' where user_id = s;
  begin
    perform public.decide_identity(s, true, '  ', null, null);
    assert false, 'approving needs a legal name';
  exception when others then
    assert sqlerrm = 'name_required', 'got ' || sqlerrm;
  end;
  perform public.decide_identity(s, true, 'Seller One', null, null);
  assert (select legal_name from public.seller_verifications where user_id = s) = 'Seller One', 'legal name kept';

  -- Identity alone is not enough: the bank account name must be confirmed too.
  assert not public.seller_verified(s), 'not verified before the account name check';
  assert not (select verified from public.profiles where id = s), 'no badge yet';
  begin
    perform public.request_withdrawal(s, 10000);
    assert false, 'identity alone must not withdraw';
  exception when others then
    assert sqlerrm = 'not_verified', 'got ' || sqlerrm;
  end;
  perform public.confirm_account_name(s);
  assert public.seller_verified(s), 'verified after both checks';
  assert (select verified from public.profiles where id = s), 'badge follows';
  perform public.request_withdrawal(s, 10000);

  -- Changing the account clears the name check and the badge; the admin's own confirmation does not.
  update public.seller_payout_accounts set account_number_enc = 'enc2' where user_id = s;
  assert not public.seller_verified(s), 'new account needs a new name check';
  assert not (select verified from public.profiles where id = s), 'badge withdrawn';
  perform public.confirm_account_name(s);
  assert public.seller_verified(s), 'verified again after re-check';

  -- A seller with no approved identity cannot get an account name confirmed.
  declare s2 uuid := gen_random_uuid();
  begin
    insert into public.profiles (id) values (s2);
    insert into public.seller_payout_accounts (user_id, omise_recipient_id, bank_brand, account_last4, account_name, account_number_enc)
    values (s2, null, 'kbank', '9999', 'Other', 'enc');
    perform public.confirm_account_name(s2);
    assert false, 'must need an approved identity';
  exception when others then
    assert sqlerrm = 'not_ready', 'got ' || sqlerrm;
  end;
end $$;
