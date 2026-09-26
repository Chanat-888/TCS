-- Real (test-mode) payments via Omise: PromptPay QR and TrueMoney Wallet.
-- 'card' stays in the enum for old rows; checkout no longer offers it.
alter type payment_method add value if not exists 'truemoney';

-- The latest Omise charge for the order, so checkout can poll its status.
-- The webhook doesn't need it: it finds the order via the charge's metadata.
alter table orders add column if not exists omise_charge_id text;
