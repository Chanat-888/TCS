-- Lets a user upload their own profile picture, in addition to the LINE/Google
-- photo. Public read (avatars are shown to everyone), all writes go through
-- the uploadAvatar server action using the service_role key, which bypasses
-- storage RLS, so no client-facing upload policies are needed (same pattern
-- as migration 0005's listing-photos and unboxing-videos buckets).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Extend the trusted-avatar-URL rule (migration 0009) to also accept a file in
-- this project's own avatars bucket, alongside the LINE/Google CDN hosts.
-- Keep in sync with TRUSTED_HOSTS in src/lib/avatar.ts.
create or replace function public.is_trusted_avatar_url(url text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select url is not null
    and char_length(url) <= 500
    and (
      url ~ '^https://(lh[3-6][.]googleusercontent[.]com|s?profile[.]line-scdn[.]net)/[^[:space:]]*$'
      or url ~ '^https://upzvnvcseiibxsfsbcnj[.]supabase[.]co/storage/v1/object/public/avatars/[^[:space:]]*$'
    )
$$;
