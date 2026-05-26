import { NextResponse } from "next/server";
import { normalizeCallRows } from "../../../lib/callImport";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.json();
  const calls = Array.isArray(payload.calls) ? payload.calls : [];
  if (!calls.length) {
    return NextResponse.json({ error: "calls array is required" }, { status: 400 });
  }

  const rows = normalizeCallRows(calls, payload.audit_mode || payload.review_mode || "technical_audio");

  const supabase = supabaseAdmin();
  const callRows = rows.map(({ audit_mode, ...row }: any) => row);
  const queueRows = rows.map((row: any) => ({
    call_id: row.execution_id,
    audit_mode: row.audit_mode,
    assigned_reviewer: row.assigned_reviewer,
    source_sheet: row.source_sheet,
    imported_at: row.imported_at
  }));

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

  return NextResponse.json({ ok: true, imported: rows.length });
}
