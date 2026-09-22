-- Default profile picture from the sign-in provider (LINE / Google).
--
-- avatar_url is a public image URL, so it is safe in the publicly readable
-- profiles table (unlike a home address, which must never go there).
--
-- The URL originates in sign-in metadata, which the client can influence, so
-- only https URLs on the providers' own photo hosts are ever stored. The same
-- rule is enforced three ways: a CHECK constraint (nothing else can be
-- written, by any path), the signup trigger, and the display code. Extend
-- is_trusted_avatar_url() when an upload feature adds Supabase Storage URLs.

create or replace function public.is_trusted_avatar_url(url text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select url is not null
    and char_length(url) <= 500
    and url ~ '^https://(lh[3-6][.]googleusercontent[.]com|s?profile[.]line-scdn[.]net)/[^[:space:]]*$'
$$;

alter table public.profiles add column if not exists avatar_url text;

alter table public.profiles drop constraint if exists profiles_avatar_url_trusted;
alter table public.profiles add constraint profiles_avatar_url_trusted
  check (avatar_url is null or public.is_trusted_avatar_url(avatar_url));

create or replace function public.create_auth_profile()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  raw_name text := coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '');
  raw_photo text := coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture');
  clean_name text;
begin
  -- Whitespace first, so a newline becomes a space instead of joining two words.
  clean_name := btrim(regexp_replace(
    regexp_replace(regexp_replace(left(raw_name, 60), '\s+', ' ', 'g'), '[[:cntrl:]\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]', '', 'g'),
    ' +', ' ', 'g'));
  clean_name := left(clean_name, 30);
  if char_length(clean_name) < 2 then
    clean_name := 'นักสะสม';
  end if;

  insert into public.profiles (id, display_name, avatar_initial, avatar_url)
  values (
    new.id,
    clean_name,
    upper(case
      when char_length(clean_name) > 1 and left(clean_name, 1) in ('เ', 'แ', 'โ', 'ใ', 'ไ')
        then substr(clean_name, 2, 1)
      else left(clean_name, 1)
    end),
    case when public.is_trusted_avatar_url(raw_photo) then raw_photo else null end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_auth_profile() from public, anon, authenticated;

-- Existing accounts: pick up the photo their provider already gave us.
update public.profiles p
set avatar_url = u.photo
from (
  select id, coalesce(raw_user_meta_data ->> 'avatar_url', raw_user_meta_data ->> 'picture') as photo
  from auth.users
) u
where p.id = u.id
  and p.avatar_url is null
  and public.is_trusted_avatar_url(u.photo);
