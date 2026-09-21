-- New accounts take their display name from the sign-in provider (Google sends
-- full_name) instead of everyone being "นักสะสม". Phone-only accounts keep the
-- placeholder until the owner edits their profile.
-- Names are user-controlled input, so control/zero-width/bidi characters are
-- stripped and length is capped. The function must never raise: an exception
-- here would block account creation entirely.
-- Verified, bank_name_matched and is_admin are never derived from metadata.
create or replace function public.create_auth_profile()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  raw_name text := coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '');
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

  insert into public.profiles (id, display_name, avatar_initial)
  values (
    new.id,
    clean_name,
    upper(case
      when char_length(clean_name) > 1 and left(clean_name, 1) in ('เ', 'แ', 'โ', 'ใ', 'ไ')
        then substr(clean_name, 2, 1)
      else left(clean_name, 1)
    end)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_auth_profile() from public, anon, authenticated;
