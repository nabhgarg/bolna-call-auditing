-- Client use cases from the New use case screen (/portal/new-use-case).
-- Run once in the Supabase SQL editor (Dashboard -> SQL Editor -> paste -> Run).

create table if not exists public.use_cases (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id text,                                  -- program / client this belongs to
  description text not null,                       -- what the client typed, verbatim
  facts jsonb not null default '{}'::jsonb,        -- {callsPerWeek, languages[], docs[]}
  checks jsonb not null default '[]'::jsonb,       -- selected check ids
  estimate_inr int,                                -- weekly estimate, server-computed
  status text not null default 'draft'             -- draft | pilot | live
);

alter table public.use_cases enable row level security;

-- the app writes with the publishable (anon) key; nobody reads back via anon
drop policy if exists use_cases_insert on public.use_cases;
create policy use_cases_insert on public.use_cases for insert to anon with check (true);

drop policy if exists use_cases_update on public.use_cases;
create policy use_cases_update on public.use_cases for update to anon using (true) with check (true);

-- no anon select on purpose: a client's description is their own business
