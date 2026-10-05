-- A "looking for" post can carry a reference photo of the card. The file lives in the existing
-- public listing-photos bucket under wanted/<post id>/, and only its URL is stored here.
-- Posts made before this keep a null photo_url and simply show no picture.
alter table public.wanted_posts
  add column if not exists photo_url text;
