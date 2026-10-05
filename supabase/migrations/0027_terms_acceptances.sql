-- Proof that a user accepted a version of the terms (docs/payment-plan.md section 16,
-- docs/terms-draft.md). Append-only: a row is never changed or removed, and a user
-- accepts each version once. A new TERMS_VERSION in src/lib/termsConfig.ts means everyone
-- is asked again at their next sell, withdraw or checkout.
--
-- Private like the ledger tables: RLS on, no API-role grants, server code only.
create table public.terms_acceptances (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id),
  version text not null,
  ip text,
  created_at timestamptz not null default now(),
  unique (user_id, version)
);

create function public.terms_acceptances_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'terms_acceptances is append-only';
end;
$$;

create trigger terms_acceptances_append_only
before update or delete on public.terms_acceptances
for each row execute function public.terms_acceptances_append_only();

alter table public.terms_acceptances enable row level security;
revoke all on public.terms_acceptances from anon, authenticated;
