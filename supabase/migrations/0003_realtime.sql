-- Enable Realtime postgres_changes for live bidding: new bids and the
-- current_price/ends_at updates on the listing they belong to.
alter publication supabase_realtime add table bids;
alter publication supabase_realtime add table listings;
