import { NextResponse } from "next/server";
import { importCallsFromSheets } from "../../../lib/sheetsSync";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST() {
  const result = await importCallsFromSheets();
  if (!result.ok) {
    return NextResponse.json(result, { status: result.configured === false ? 400 : 502 });
  }

  const rows = result.calls || [];
  if (!rows.length) {
    return NextResponse.json({ ok: true, imported: 0, sheet_rows: result.imported_rows });
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase.from("calls").upsert(rows, { onConflict: "execution_id" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, imported: rows.length, sheet_rows: result.imported_rows });
}
