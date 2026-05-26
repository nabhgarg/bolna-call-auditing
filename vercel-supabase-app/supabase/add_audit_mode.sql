alter table public.calls
  add column if not exists audit_mode text not null default 'technical_audio';

create index if not exists calls_audit_mode_idx on public.calls(audit_mode);

update public.calls
set audit_mode = 'technical_audio'
where audit_mode is null or audit_mode = '';

create table if not exists public.call_audit_queue (
  call_id text not null references public.calls(execution_id) on delete cascade,
  audit_mode text not null,
  assigned_reviewer text,
  source_sheet text,
  imported_at timestamptz not null default now(),
  primary key (call_id, audit_mode)
);

create index if not exists call_audit_queue_audit_mode_idx on public.call_audit_queue(audit_mode);
create index if not exists call_audit_queue_assigned_reviewer_idx on public.call_audit_queue(assigned_reviewer);

insert into public.call_audit_queue (call_id, audit_mode, assigned_reviewer, source_sheet, imported_at)
select execution_id, audit_mode, assigned_reviewer, source_sheet, imported_at
from public.calls
on conflict (call_id, audit_mode) do update set
  assigned_reviewer = excluded.assigned_reviewer,
  source_sheet = excluded.source_sheet,
  imported_at = excluded.imported_at;
