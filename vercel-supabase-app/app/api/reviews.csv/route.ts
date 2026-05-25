import { NextResponse } from "next/server";
import { exportRowsFromReviews, ReviewRow, toCsv } from "../../../lib/audit";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("reviews")
    .select("*, calls(*)")
    .order("call_id", { ascending: true })
    .order("submitted_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const csv = toCsv(exportRowsFromReviews((data || []) as ReviewRow[]));
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="bolna_call_reviews.csv"'
    }
  });
}
