import { NextResponse } from "next/server";
import { importCallsFromSheets } from "../../../lib/sheetsSync";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
const BATCH_SIZE = 200;

function chunk<T>(items: T[], size = BATCH_SIZE) {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const result = await importCallsFromSheets(payload.audit_mode || payload.review_mode || "technical_audio");
  if (!result.ok) {
    return NextResponse.json(result, { status: result.configured === false ? 400 : 502 });
  }

  const rows = result.calls || [];
  if (!rows.length) {
    return NextResponse.json({ ok: true, imported: 0, sheet_rows: result.imported_rows });
  }

  const supabase = supabaseAdmin();
  const callRows = rows.map(({ audit_mode, ...row }: any) => row);
  const queueRows = rows.map((row: any) => ({
    call_id: row.execution_id,
    audit_mode: row.audit_mode,
    assigned_reviewer: row.assigned_reviewer,
    source_sheet: row.source_sheet,
    imported_at: row.imported_at
  }));
  const mode = String(result.audit_mode || "technical_audio");
  const archivedMode = `${mode}__archived`;
  const importedCallIds = [...new Set(rows.map((row: any) => String(row.execution_id || "")).filter(Boolean))];

  const { data: existingQueueRows, error: existingQueueError } = await supabase
    .from("call_audit_queue")
    .select("call_id")
    .eq("audit_mode", mode);
  if (existingQueueError) {
    return NextResponse.json({ error: existingQueueError.message }, { status: 500 });
  }
  const existingCallIds = (existingQueueRows || []).map((row: any) => String(row.call_id || "")).filter(Boolean);
  const importedSet = new Set(importedCallIds);
  const staleCallIds = existingCallIds.filter((id) => !importedSet.has(id));

  const { error } = await supabase.from("calls").upsert(callRows, { onConflict: "execution_id" });
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
  for (const ids of chunk(staleCallIds)) {
    const { error: archiveQueueError } = await supabase
      .from("call_audit_queue")
      .update({ audit_mode: archivedMode, assigned_reviewer: "", source_sheet: "Archived by import" })
      .eq("audit_mode", mode)
      .in("call_id", ids);
    if (archiveQueueError) {
      return NextResponse.json({ error: archiveQueueError.message }, { status: 500 });
    }

    const { data: activeModeRows, error: activeModeError } = await supabase
      .from("call_audit_queue")
      .select("call_id")
      .eq("audit_mode", mode)
      .in("call_id", ids);
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
    imported: rows.length,
    sheet_name: result.sheet_name,
    sheet_rows: result.imported_rows
  });
}
