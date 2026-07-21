import { NextResponse } from "next/server";
import { importCallsFromSheets, importReviewersFromSheets } from "../../../lib/sheetsSync";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

async function syncReviewersFromSheet(supabase: ReturnType<typeof supabaseAdmin>) {
  try {
    const result = await importReviewersFromSheets();
    if (!result.ok || !result.found || !result.reviewers.length) {
      return { synced: 0, found: result.found ?? false };
    }
    const { error } = await supabase
      .from("reviewers")
      .upsert(result.reviewers, { onConflict: "email" });
    if (error) {
      return { synced: 0, found: true, error: error.message };
    }
    return { synced: result.reviewers.length, found: true };
  } catch (error) {
    return { synced: 0, found: false, error: (error as Error).message };
  }
}

export const dynamic = "force-dynamic";

function dedupeByCallId(rows: any[]) {
  const byCallId = new Map<string, any>();
  for (const row of rows) {
    const callId = String(row.execution_id || "").trim();
    if (!callId) continue;
    byCallId.set(callId, row);
  }
  return [...byCallId.values()];
}

function queueIdForRow(row: any) {
  return String(row.queue_id || row.row_id || row.execution_id || "").trim();
}

function queueModeForRow(row: any, mode: string) {
  const queueId = queueIdForRow(row);
  return queueId ? `${mode}::${queueId}` : mode;
}

function queueModeMatches(mode: string) {
  return `audit_mode.eq.${mode},audit_mode.like.${mode}::%`;
}

function dedupeByQueueKey(rows: any[]) {
  const byQueueKey = new Map<string, any>();
  for (const row of rows) {
    const queueId = queueIdForRow(row);
    const mode = String(row.audit_mode || "").trim();
    if (!queueId || !mode) continue;
    byQueueKey.set(`${queueId}||${mode}`, row);
  }
  return [...byQueueKey.values()];
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const result = await importCallsFromSheets(payload.audit_mode || payload.review_mode || "pronunciation_tone");
  if (!result.ok) {
    return NextResponse.json(result, { status: result.configured === false ? 400 : 502 });
  }

  const supabase = supabaseAdmin();
  const reviewerSync = await syncReviewersFromSheet(supabase);

  const rows = result.calls || [];
  if (!rows.length) {
    return NextResponse.json({ ok: true, imported: 0, sheet_rows: result.imported_rows, reviewers_synced: reviewerSync.synced });
  }
  const mode = String(result.audit_mode || "pronunciation_tone");
  const archivedMode = `${mode}__archived`;
  const callRows = dedupeByCallId(rows).map(({ audit_mode, queue_id, ...row }: any) => row);
  const queueRows = dedupeByQueueKey(rows).map((row: any) => ({
    call_id: row.execution_id,
    audit_mode: queueModeForRow(row, mode),
    assigned_reviewer: row.assigned_reviewer,
    source_sheet: row.source_sheet,
    imported_at: row.imported_at
  }));
  const duplicateRows = rows.length - queueRows.length;
  const importedQueueKeys = new Set(queueRows.map((row: any) => `${row.call_id}||${row.audit_mode}`));

  // Page through existing rows — a single query caps at 1000 and a truncated
  // list here would mark unseen rows as stale and archive live assignments.
  const pageSize = 1000;
  let existingQueueRows: any[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error: pageError } = await supabase
      .from("call_audit_queue")
      .select("call_id,audit_mode")
      .or(queueModeMatches(mode))
      .order("call_id", { ascending: true })
      .order("audit_mode", { ascending: true })
      .range(from, from + pageSize - 1);
    if (pageError) {
      return NextResponse.json({ error: pageError.message }, { status: 500 });
    }
    existingQueueRows = existingQueueRows.concat(data || []);
    if (!data || data.length < pageSize) break;
  }
  // Guard: batch assignments created directly in Supabase (queue ids ::b2*,
  // ::b3*, ...) are not in the sheet — never archive them on import. Once the
  // sheet carries them they match importedQueueKeys and are untouched anyway.
  const staleQueueRows = existingQueueRows.filter((row: any) => (
    !importedQueueKeys.has(`${row.call_id}||${row.audit_mode}`) &&
    !/::b\d/.test(String(row.audit_mode || ""))
  ));

  let { error } = await supabase.from("calls").upsert(callRows, { onConflict: "execution_id" });
  if (error && /telemetry_json/.test(error.message)) {
    // telemetry column not added to the DB yet — import everything else
    const stripped = callRows.map(({ telemetry_json, ...row }: any) => row);
    ({ error } = await supabase.from("calls").upsert(stripped, { onConflict: "execution_id" }));
  }
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { error: queueError } = await supabase
    .from("call_audit_queue")
    .upsert(queueRows, { onConflict: "call_id,audit_mode" });
  if (queueError) {
    return NextResponse.json({ error: queueError.message }, { status: 500 });
  }

  // Archive stale queue rows for this mode so only current sheet rows appear in the UI.
  // We use update instead of delete because RLS may not permit deletes with current key.
  for (const staleRow of staleQueueRows) {
    const { error: archiveQueueError } = await supabase
      .from("call_audit_queue")
      .update({ audit_mode: `${archivedMode}::${staleRow.audit_mode}`, assigned_reviewer: "", source_sheet: "Archived by import" })
      .eq("call_id", staleRow.call_id)
      .eq("audit_mode", staleRow.audit_mode);
    if (archiveQueueError) {
      return NextResponse.json({ error: archiveQueueError.message }, { status: 500 });
    }

    const { data: activeModeRows, error: activeModeError } = await supabase
      .from("call_audit_queue")
      .select("call_id")
      .eq("call_id", staleRow.call_id)
      .eq("audit_mode", staleRow.audit_mode);
    if (activeModeError) {
      return NextResponse.json({ error: activeModeError.message }, { status: 500 });
    }
    if ((activeModeRows || []).length) {
      return NextResponse.json({ error: "Could not clear stale queue rows for this mode." }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    audit_mode: result.audit_mode,
    imported: queueRows.length,
    skipped_duplicate_rows: duplicateRows,
    sheet_name: result.sheet_name,
    sheet_rows: result.imported_rows,
    reviewers_synced: reviewerSync.synced,
    reviewers_sync_error: reviewerSync.error || null
  });
}
