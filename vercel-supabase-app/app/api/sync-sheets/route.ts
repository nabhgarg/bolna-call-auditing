import { NextResponse } from "next/server";
import { ReviewRow } from "../../../lib/audit";
import { syncReviewsToSheets } from "../../../lib/sheetsSync";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("reviews")
    .select("*, calls(*)")
    .is("sheets_synced_at", null)
    .order("submitted_at", { ascending: true });

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
