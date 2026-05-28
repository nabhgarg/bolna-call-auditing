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

  for (const ids of chunk(staleCallIds)) {
    const { error: deleteQueueError } = await supabase
      .from("call_audit_queue")
      .delete()
      .eq("audit_mode", mode)
      .in("call_id", ids);
    if (deleteQueueError) {
      return NextResponse.json({ error: deleteQueueError.message }, { status: 500 });
    }
  }

  // Remove call rows only when they no longer belong to any queue in any mode.
  for (const ids of chunk(staleCallIds)) {
    const { data: stillQueuedRows, error: stillQueuedError } = await supabase
      .from("call_audit_queue")
      .select("call_id")
      .in("call_id", ids);
    if (stillQueuedError) {
      return NextResponse.json({ error: stillQueuedError.message }, { status: 500 });
    }
    const stillQueued = new Set((stillQueuedRows || []).map((row: any) => String(row.call_id || "")).filter(Boolean));
    const orphanCallIds = ids.filter((id) => !stillQueued.has(id));
    if (!orphanCallIds.length) continue;
    const { error: deleteCallError } = await supabase
      .from("calls")
      .delete()
      .in("execution_id", orphanCallIds);
    if (deleteCallError) {
      return NextResponse.json({ error: deleteCallError.message }, { status: 500 });
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
