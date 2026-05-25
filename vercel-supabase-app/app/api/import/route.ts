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

  const rows = normalizeCallRows(calls);

  const supabase = supabaseAdmin();
  const { error } = await supabase.from("calls").upsert(rows, { onConflict: "execution_id" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, imported: rows.length });
}
