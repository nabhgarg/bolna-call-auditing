create extension if not exists pgcrypto;

create table if not exists public.calls (
  execution_id text primary key,
  assigned_reviewer text,
  org_name text,
  agent_id text,
  agent_name text,
  duration_sec numeric,
  created_at_ist text,
  to_number text,
  status text,
  transcriber_language text,
  transcript text,
  recording_url text,
  agent_interrupted_user_count numeric,
  audit_mode text not null default 'pronunciation_tone',
  source_sheet text,
  imported_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id bigserial primary key,
  call_id text not null references public.calls(execution_id),
  reviewer_name text,
  review_mode text,
  vibe_score text,
  flow_score text,
  llm_rating text,
  llm_error_type text,
  notes text,
  issues_json jsonb not null default '[]'::jsonb,
  started_at text,
  submitted_at timestamptz not null default now(),
  duration_taken_sec integer,
  sheets_synced_at timestamptz,
  sheets_sync_error text
);

create table if not exists public.call_audit_queue (
  call_id text not null references public.calls(execution_id) on delete cascade,
  audit_mode text not null,
  assigned_reviewer text,
  source_sheet text,
  imported_at timestamptz not null default now(),
  primary key (call_id, audit_mode)
);

create index if not exists calls_assigned_reviewer_idx on public.calls(assigned_reviewer);
create index if not exists calls_audit_mode_idx on public.calls(audit_mode);
create index if not exists calls_org_name_idx on public.calls(org_name);
create index if not exists calls_agent_name_idx on public.calls(agent_name);
create index if not exists call_audit_queue_audit_mode_idx on public.call_audit_queue(audit_mode);
create index if not exists call_audit_queue_assigned_reviewer_idx on public.call_audit_queue(assigned_reviewer);
create index if not exists reviews_call_id_idx on public.reviews(call_id);
create index if not exists reviews_sheets_synced_at_idx on public.reviews(sheets_synced_at);

alter table public.call_audit_queue enable row level security;

drop policy if exists "Allow call audit queue read" on public.call_audit_queue;
drop policy if exists "Allow call audit queue insert" on public.call_audit_queue;
drop policy if exists "Allow call audit queue update" on public.call_audit_queue;

create policy "Allow call audit queue read"
on public.call_audit_queue
for select
using (true);

create policy "Allow call audit queue insert"
on public.call_audit_queue
for insert
with check (true);

create policy "Allow call audit queue update"
on public.call_audit_queue
for update
using (true)
with check (true);

create table if not exists public.reviewers (
  email text primary key,
  display_name text not null,
  role text not null default 'scorer',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.reviews
  add column if not exists reviewer_email text;

create index if not exists reviews_reviewer_email_idx on public.reviews(reviewer_email);

create table if not exists public.login_otps (
  id bigserial primary key,
  email text not null,
  code text not null,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists login_otps_email_idx on public.login_otps(email, created_at desc);

alter table public.calls
  add column if not exists telemetry_json text;
