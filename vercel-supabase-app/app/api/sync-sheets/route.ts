import { NextResponse } from "next/server";
import { ReviewRow } from "../../../lib/audit";
import { normalizeAuditMode } from "../../../lib/callImport";
import { syncReviewsToSheets } from "../../../lib/sheetsSync";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const mode = payload.audit_mode || payload.review_mode;
  const supabase = supabaseAdmin();
  let query = supabase
    .from("reviews")
    .select("*, calls(*)")
    .is("sheets_synced_at", null)
    .order("submitted_at", { ascending: true });

  if (mode) {
    query = query.eq("review_mode", normalizeAuditMode(mode));
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const reviews = (data || []) as ReviewRow[];
  const result = await syncReviewsToSheets(reviews);
  if (result.ok && reviews.length) {
    const ids = reviews.map((review) => review.id);
    await supabase
      .from("reviews")
      .update({ sheets_synced_at: new Date().toISOString(), sheets_sync_error: null })
      .in("id", ids);
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
