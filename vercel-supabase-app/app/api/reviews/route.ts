import { NextResponse, after } from "next/server";
import { normalizeReviewMode, ReviewRow } from "../../../lib/audit";
import { syncReviewsToSheets } from "../../../lib/sheetsSync";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { isDemoRequest } from "../../../lib/demo";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.json();
  const callId = String(payload.call_id || "").trim();
  if (!callId) {
    return NextResponse.json({ error: "call_id is required" }, { status: 400 });
  }

  // YC partner demo · the judgment is graded on screen but never stored. A row
  // here would enter the golden dataset, void a real reviewer's prior
  // submission for the same call (see the "cleared" update below) and sync
  // itself out to the ops sheet. None of that should follow from a demo click.
  if (isDemoRequest(request)) return NextResponse.json({ ok: true, demo: true });

  const supabase = supabaseAdmin();
  const reviewerName = payload.reviewer_name || "";
  const reviewerEmail = String(payload.reviewer_email || "").trim().toLowerCase();
  const reviewMode = normalizeReviewMode(payload.review_mode || "");

  // Replace any prior submission by this reviewer for this call+mode. RLS blocks
  // deletes, so prior rows are voided by setting review_mode to "cleared".
  // Both identity variants cleared in parallel — no need to serialize.
  await Promise.all([
    reviewerEmail
      ? supabase
          .from("reviews")
          .update({ review_mode: "cleared" })
          .eq("call_id", callId)
          .eq("reviewer_email", reviewerEmail)
          .eq("review_mode", reviewMode)
      : Promise.resolve(),
    supabase
      .from("reviews")
      .update({ review_mode: "cleared" })
      .eq("call_id", callId)
      .eq("reviewer_name", reviewerName)
      .eq("review_mode", reviewMode)
  ]);

  const { data: inserted, error } = await supabase
    .from("reviews")
    .insert({
      call_id: callId,
      reviewer_name: reviewerName,
      reviewer_email: reviewerEmail,
      review_mode: reviewMode,
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

  // The reviewer's submit must not wait on the Google Apps Script webhook
  // (2-8s, cold starts) — that made every submit feel stuck. Respond as soon
  // as the review is saved; sync to Sheets after the response. Failures are
  // recorded in sheets_sync_error and picked up by the batch /api/sync-sheets.
  after(async () => {
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
  });

  return NextResponse.json({ ok: true, review_id: inserted.id, sheets_sync: { ok: true, queued: true } });
}


// Resume support for per-item workbenches (judge audit). Returns this
// reviewer's live rows whose mode starts with the prefix · the client mines
// issues_json for item-level answers. Scoped narrow on purpose: reviewer AND
// prefix are required, so this can't become a general review-dump endpoint.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const reviewer = String(url.searchParams.get("reviewer") || "").trim().toLowerCase();
  const prefix = String(url.searchParams.get("mode_prefix") || "").trim();
  if (!reviewer || !prefix) {
    return NextResponse.json({ error: "reviewer and mode_prefix are required" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin()
    .from("reviews")
    .select("call_id,review_mode,issues_json,submitted_at")
    .eq("reviewer_email", reviewer)
    .like("review_mode", `${prefix}%`)
    .order("id", { ascending: true })
    .range(0, 999);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reviews: data || [] }, { headers: { "Cache-Control": "no-store" } });
}
