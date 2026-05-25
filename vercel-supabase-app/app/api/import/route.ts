import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const allowedColumns = [
  "execution_id",
  "assigned_reviewer",
  "org_name",
  "agent_id",
  "agent_name",
  "duration_sec",
  "created_at_ist",
  "to_number",
  "status",
  "transcriber_language",
  "transcript",
  "recording_url",
  "agent_interrupted_user_count",
  "source_sheet"
];

export async function POST(request: Request) {
  const payload = await request.json();
  const calls = Array.isArray(payload.calls) ? payload.calls : [];
  if (!calls.length) {
    return NextResponse.json({ error: "calls array is required" }, { status: 400 });
  }

  const rows = calls
    .filter((call: Record<string, unknown>) => call.execution_id)
    .map((call: Record<string, unknown>) => {
      const row: Record<string, unknown> = {};
      for (const column of allowedColumns) row[column] = call[column] ?? "";
      row.imported_at = new Date().toISOString();
      return row;
    });

  const supabase = supabaseAdmin();
  const { error } = await supabase.from("calls").upsert(rows, { onConflict: "execution_id" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, imported: rows.length });
}
