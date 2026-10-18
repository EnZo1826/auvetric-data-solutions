-- Auvetric CRM · Supabase hardening.
-- Supabase publishes the `public` schema through its Data API (PostgREST) to the `anon` and
-- `authenticated` roles, reachable with the project's public anon key. The CRM never uses that API:
-- the Next.js server connects directly as the table owner. So every CRM table gets row-level security
-- with no policies (owner bypasses RLS; the API roles see nothing) and the API roles lose all grants.
-- On plain Postgres (local Docker, CI) those roles don't exist and only the RLS part applies.
-- scripts/crm/migrate.mjs re-checks this after every migration run, so new tables can't slip through.

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;

  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon, authenticated;
    revoke all on all sequences in schema public from anon, authenticated;
    alter default privileges in schema public revoke all on tables from anon, authenticated;
    alter default privileges in schema public revoke all on sequences from anon, authenticated;
    alter default privileges in schema public revoke all on functions from anon, authenticated;
  end if;
end $$;
