-- TCS always requires video evidence from both sides: the buyer's unboxing video
-- (already stored on the order) and, from now on, the seller's packing video,
-- recorded before shipping or before a meet-up hand-over.
alter table public.orders
  add column if not exists packing_video_url text,
  add column if not exists packing_video_uploaded_at timestamptz;
