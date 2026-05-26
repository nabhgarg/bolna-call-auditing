import { NextResponse } from "next/server";
import { importCallsFromSheets } from "../../../lib/sheetsSync";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

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

  return NextResponse.json({
    ok: true,
    audit_mode: result.audit_mode,
    imported: rows.length,
    sheet_name: result.sheet_name,
    sheet_rows: result.imported_rows
  });
}
