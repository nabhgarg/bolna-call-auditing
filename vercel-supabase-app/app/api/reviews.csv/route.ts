import { NextResponse } from "next/server";
import { exportRowsFromReviews, normalizeReviewMode, REVIEW_EXPORT_COLUMNS_BY_MODE, ReviewRow, toCsv } from "../../../lib/audit";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = supabaseAdmin();
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") || url.searchParams.get("review_mode");
  let query = supabase
    .from("reviews")
    .select("*, calls(*)")
    .order("call_id", { ascending: true })
    .order("submitted_at", { ascending: false });

  if (mode) {
    query = query.eq("review_mode", normalizeReviewMode(mode));
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const exportMode = normalizeReviewMode(mode);
  const suffix = mode ? `_${exportMode}` : "";
  const csv = toCsv(
    exportRowsFromReviews((data || []) as ReviewRow[], exportMode),
    REVIEW_EXPORT_COLUMNS_BY_MODE[exportMode]
  );
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bolna_call_reviews${suffix}.csv"`
    }
  });
}
