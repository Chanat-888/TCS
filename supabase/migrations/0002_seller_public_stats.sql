-- Completed-sale counts are a public trust signal (seller row on browse /
-- auction pages), but the underlying `orders` table stays locked down (no
-- anon policy — see 0001_init.sql). This view exposes only the narrow
-- aggregate, computed with the view owner's privileges (bypassing orders'
-- RLS internally) rather than opening up order rows themselves.
create view seller_public_stats as
select seller_id, count(*) as completed_sales
from orders
where status = 'COMPLETED'
group by seller_id;

grant select on seller_public_stats to anon, authenticated;
