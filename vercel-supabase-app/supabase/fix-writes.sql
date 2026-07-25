-- Unblock writes. Supabase SQL editor -> New query -> paste -> Run.
--
-- IMPORTANT: run this on project  ttgzmttlwscezsucobbj  (the one the app uses).
-- The URL bar in the dashboard shows the project ref; if it does not match,
-- you are on the wrong project and nothing here will take effect.
--
-- Symptom this fixes: every insert returns
--   42501  new row violates row-level security policy
-- because both tables have RLS enabled with no policy that permits INSERT.
--
-- Policies below target `public` (every role) rather than `anon`, so they work
-- whichever role the publishable key resolves to. There is still NO select
-- policy, so applications and client descriptions stay unreadable.

-- ---------------------------------------------------------------- STEP 1
-- Run this block first. If any line errors, fix it before running step 2 ·
-- the editor rolls the whole batch back on error, which is the usual reason
-- a previous run appeared to succeed but changed nothing.

alter table public.applicants add column if not exists full_name text;
alter table public.applicants add column if not exists state     text;
alter table public.use_cases  add column if not exists client_id text;

-- ---------------------------------------------------------------- STEP 2
-- The policies themselves.

drop policy if exists applicants_insert on public.applicants;
create policy applicants_insert on public.applicants
  for insert to public with check (true);

drop policy if exists applicants_update on public.applicants;
create policy applicants_update on public.applicants
  for update to public using (true) with check (true);

drop policy if exists use_cases_insert on public.use_cases;
create policy use_cases_insert on public.use_cases
  for insert to public with check (true);

drop policy if exists use_cases_update on public.use_cases;
create policy use_cases_update on public.use_cases
  for update to public using (true) with check (true);

-- ---------------------------------------------------------------- STEP 3
-- Verify. This must return 4 rows. If it returns 0, the script did not apply
-- (wrong project, or an error rolled step 2 back).

select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('applicants', 'use_cases')
order by tablename, policyname;

-- ---------------------------------------------------------------- STEP 4
-- Housekeeping · delete the probe rows written while diagnosing this. Safe to
-- run more than once; it only matches the synthetic phone range and the two
-- probe descriptions, so real applications and real use cases are untouched.

delete from public.applicants
where phone like '+91900000%' or full_name in ('probe', 'probe delete me', 'Deploy Probe');

delete from public.use_cases
where description in ('probe delete me',
                      'Our appliance support agent mishears the model number customers read out.');

-- ---------------------------------------------------------------- WHY THIS
-- WAS CONFUSING · worth knowing before adding the next table.
--
-- Creating the insert policies above was necessary but not sufficient. The app
-- was also calling .select("id").single() after each insert, which makes
-- PostgREST send `Prefer: return=representation` · and returning the inserted
-- row needs a SELECT policy. Both tables deliberately have none, so PostgREST
-- refused the whole statement and reported it as
--     42501  new row violates row-level security policy
-- which reads like the write was denied when in fact the read-back was.
--
-- The app now mints the uuid itself (crypto.randomUUID()) and sends it in the
-- insert, so it never needs the row back. If you add another write path to a
-- table with no select policy, do the same · do not add a select policy just to
-- get an id back, that would expose phone numbers and client descriptions.
