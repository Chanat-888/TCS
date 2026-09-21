-- hasEverBid() (profile achievements) filters bids by bidder_id, which had no
-- index and would sequentially scan the whole bids table as it grows.
create index if not exists bids_bidder_id_idx on bids(bidder_id);
