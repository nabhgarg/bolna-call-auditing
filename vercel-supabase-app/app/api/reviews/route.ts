import { NextResponse } from "next/server";
import { ReviewRow } from "../../../lib/audit";
import { syncReviewsToSheets } from "../../../lib/sheetsSync";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.json();
  const callId = String(payload.call_id || "").trim();
  if (!callId) {
    return NextResponse.json({ error: "call_id is required" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data: inserted, error } = await supabase
    .from("reviews")
    .insert({
      call_id: callId,
      reviewer_name: payload.reviewer_name || "",
      review_mode: payload.review_mode || "",
      vibe_score: payload.vibe_score || "",
      flow_score: payload.flow_score || "",
      llm_rating: payload.llm_rating || "",
      llm_error_type: payload.llm_error_type || "",
      notes: payload.notes || "",
      issues_json: payload.issues || [],
      started_at: payload.started_at || "",
      duration_taken_sec: Number(payload.duration_taken_sec || 0)
    })
    .select("*, calls(*)")
    .single();

  if (error || !inserted) {
    return NextResponse.json({ error: error?.message || "Could not save review" }, { status: 500 });
  }

  const syncResult = await syncReviewsToSheets([inserted as ReviewRow]);
  if (syncResult.ok) {
    await supabase
      .from("reviews")
      .update({ sheets_synced_at: new Date().toISOString(), sheets_sync_error: null })
      .eq("id", inserted.id);
  } else {
    await supabase
      .from("reviews")
      .update({ sheets_sync_error: syncResult.error || "Sheets sync failed" })
      .eq("id", inserted.id);
  }

  return NextResponse.json({ ok: true, review_id: inserted.id, sheets_sync: syncResult });
}
