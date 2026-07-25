-- Run this ONCE in the Supabase SQL editor (Dashboard -> SQL Editor -> New query
-- -> paste -> Run). Safe to re-run: every statement is idempotent.
--
-- Why: both tables exist and have row level security ON, but no policy lets the
-- app insert, so every reviewer application and every started pilot is silently
-- rejected with "new row violates row-level security policy".

-- 1 · columns the app writes today (no-ops if they are already there)
alter table public.applicants add column if not exists full_name text;
alter table public.applicants add column if not exists state     text;
alter table public.use_cases  add column if not exists client_id text;

-- 2 · let the app write. It writes only from server routes, and there is
--     deliberately NO select policy, so nobody can read applications or a
--     client's description back through the public key.
drop policy if exists applicants_insert on public.applicants;
create policy applicants_insert on public.applicants
  for insert to anon with check (true);

drop policy if exists applicants_update on public.applicants;
create policy applicants_update on public.applicants
  for update to anon using (true) with check (true);

drop policy if exists use_cases_insert on public.use_cases;
create policy use_cases_insert on public.use_cases
  for insert to anon with check (true);

drop policy if exists use_cases_update on public.use_cases;
create policy use_cases_update on public.use_cases
  for update to anon using (true) with check (true);
