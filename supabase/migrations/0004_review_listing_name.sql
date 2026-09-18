-- Denormalize the listing name onto reviews so the public profile page can
-- show "ออเดอร์ · <card name>" without joining through `orders`, which isn't
-- publicly readable (see 0001_init.sql RLS policy comments).
alter table reviews add column listing_name text not null default '';
