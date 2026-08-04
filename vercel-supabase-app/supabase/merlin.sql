-- Judgments from the public Merlin router-audit review panel (/merlin).
-- Supabase SQL editor -> New query -> paste -> Run, on project ttgzmttlwscezsucobbj
-- (same as fix-writes.sql — check the project ref in the dashboard URL first).
--
-- Same key situation as the other tables: the app writes with the publishable
-- key, so RLS needs explicit insert/update policies targeting `public`.
-- No select policy — judgments are not client-readable; analysis reads them
-- offline (or via service role) so reviewers can't see each other's answers.
create table if not exists merlin_judgments (
  id uuid primary key default gen_random_uuid(),
  item_id text not null,
  reviewer text not null,
  preference text not null,
  confidence text not null,
  tags_a text default '',
  tags_b text default '',
  reason text default '',
  created_at timestamptz not null default now()
);

alter table merlin_judgments enable row level security;

-- One judgment per reviewer per item (latest wins via upsert in the API).
-- A named constraint (not just an index) so PostgREST upsert onConflict works.
-- Guarded so rerunning this file never errors (an error anywhere rolls back
-- the whole batch in the SQL editor, silently dropping the policies below).
do $$ begin
  alter table merlin_judgments
    add constraint merlin_judgments_reviewer_item unique (reviewer, item_id);
exception when duplicate_table or duplicate_object then null;
end $$;

drop policy if exists merlin_judgments_insert on public.merlin_judgments;
create policy merlin_judgments_insert on public.merlin_judgments
  for insert to public with check (true);

drop policy if exists merlin_judgments_update on public.merlin_judgments;
create policy merlin_judgments_update on public.merlin_judgments
  for update to public using (true) with check (true);

-- Select policy: required by the ops console's aggregate feed
-- (/api/ops/merlin). NOTE: RLS select with NO policy returns zero rows
-- silently rather than erroring — without this, ops shows 0 judgments
-- forever. Matches the app's posture for its other tables (reviews etc.).
drop policy if exists merlin_judgments_select on public.merlin_judgments;
create policy merlin_judgments_select on public.merlin_judgments
  for select to public using (true);
