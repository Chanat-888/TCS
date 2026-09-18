-- Storage for unboxing videos (dispute evidence) and listing photos.
-- Public read (videos/photos are shown to admins and, for listings, to any
-- buyer browsing) — all writes go through server actions using the
-- service_role key, which bypasses storage RLS, so no client-facing
-- upload policies are needed.
insert into storage.buckets (id, name, public)
values ('unboxing-videos', 'unboxing-videos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;
