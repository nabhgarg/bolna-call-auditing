-- Reviewer/Expert applications + assignment results.
-- Run once in the Supabase SQL editor (Dashboard -> SQL Editor -> paste -> Run).

create table if not exists public.applicants (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  role text not null default 'Reviewer',          -- Reviewer | Expert
  languages text[] not null default '{}',
  education text,
  hours_per_week text,
  phone text,                                      -- WhatsApp; never shown in any UI
  status text not null default 'applied',          -- applied | assignment_done | onboarding | tiered | rejected
  assignment_score int,                            -- 0-100 agreement with expert
  assignment_total int,
  assignment_matched int,
  assignment_results jsonb,                        -- per-question: [{i, type, verdict, answer}]
  completed_at timestamptz
);

alter table public.applicants enable row level security;

-- the app inserts and updates with the publishable (anon) key; nobody reads via anon
drop policy if exists applicants_insert on public.applicants;
create policy applicants_insert on public.applicants for insert to anon with check (true);

drop policy if exists applicants_update on public.applicants;
create policy applicants_update on public.applicants for update to anon using (true) with check (true);

-- no anon select policy on purpose: applications (incl. phone numbers) are not readable from the client
