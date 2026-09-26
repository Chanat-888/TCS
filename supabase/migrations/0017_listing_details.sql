-- Vanguard listing details. `quantity` is the number of cards (1-4 playset for
-- singles) or boxes/decks; `has_extras` is only set for ready-to-play decks
-- (true = comes with spare cards/components). Existing rows default to 1 / null.
alter table public.listings
  add column if not exists quantity smallint not null default 1
  check (quantity between 1 and 99);

alter table public.listings
  add column if not exists has_extras boolean;
