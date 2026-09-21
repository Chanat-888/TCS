-- Seed profiles stay intact; real accounts use their auth.users UUID.
-- Phone numbers remain in private auth.users, never in public profiles.
begin;

create function public.create_auth_profile()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_initial)
  values (new.id, 'นักสะสม', 'T')
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_auth_profile() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.create_auth_profile();

insert into public.profiles (id, display_name, avatar_initial)
select id, 'นักสะสม', 'T' from auth.users
on conflict (id) do nothing;

-- Public profiles remain read-only; signup metadata never grants verified,
-- bank_name_matched, or is_admin flags.
commit;
