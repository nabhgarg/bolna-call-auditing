import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = supabaseAdmin();
  const url = new URL(request.url);
  const auditMode = url.searchParams.get("audit_mode") || url.searchParams.get("mode") || "technical_audio";
  const reviewer = String(url.searchParams.get("reviewer") || "").trim();

  const queueResult = await supabase
    .from("call_audit_queue")
    .select("call_id,assigned_reviewer,audit_mode,source_sheet")
    .eq("audit_mode", auditMode)
    .order("call_id", { ascending: true });

  if (!queueResult.error) {
    const queueRows = queueResult.data || [];
    const callIds = queueRows.map((row: any) => row.call_id).filter(Boolean);
    if (!callIds.length) {
      return NextResponse.json({ calls: [] }, { headers: { "Cache-Control": "no-store" } });
    }

    let reviewsQuery = supabase
      .from("reviews")
      .select("call_id,reviewer_name,review_mode")
      .in("call_id", callIds)
      .eq("review_mode", auditMode);

    if (reviewer) {
      reviewsQuery = reviewsQuery.eq("reviewer_name", reviewer);
    }

    const [{ data: calls, error: callsError }, { data: reviews, error: reviewsError }] = await Promise.all([
      supabase
        .from("calls")
        .select(
          "execution_id,org_name,agent_name,duration_sec,created_at_ist,status,transcriber_language,recording_url,source_sheet"
        )
        .in("execution_id", callIds),
      reviewsQuery
    ]);

    const error = callsError || reviewsError;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const callsById = new Map((calls || []).map((call: any) => [call.execution_id, call]));
    const reviewsById = new Map((reviews || []).map((review: any) => [review.call_id, review]));
    const response = NextResponse.json({
      calls: queueRows.map((queue: any) => {
        const call = callsById.get(queue.call_id) || {};
        const review = reviewsById.get(queue.call_id) || null;
        return {
          execution_id: queue.call_id,
          assigned_reviewer: queue.assigned_reviewer,
          org_name: call.org_name,
          agent_name: call.agent_name,
          duration_sec: call.duration_sec,
          created_at_ist: call.created_at_ist,
          status: call.status,
          language: call.transcriber_language,
          audit_mode: queue.audit_mode,
          source_sheet: queue.source_sheet || call.source_sheet,
          reviewed: Boolean(review),
          reviewer_name: review?.reviewer_name || null
        };
      })
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  const primary = await supabase
    .from("calls")
    .select(
      "execution_id,assigned_reviewer,org_name,agent_name,duration_sec,created_at_ist,status,transcriber_language,audit_mode,source_sheet,reviews(id,reviewer_name,review_mode)"
    )
    .eq("audit_mode", auditMode)
    .order("execution_id", { ascending: true });

  let calls = primary.data as any[] | null;
  let error = primary.error;

  if (error?.message?.includes("audit_mode")) {
    const fallback = await supabase
      .from("calls")
      .select(
        "execution_id,assigned_reviewer,org_name,agent_name,duration_sec,created_at_ist,status,transcriber_language,source_sheet,reviews(id,reviewer_name,review_mode)"
      )
      .order("execution_id", { ascending: true });
    calls = fallback.data;
    error = fallback.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const response = NextResponse.json({
    calls: (calls || []).map((call: any) => {
      const review = Array.isArray(call.reviews)
        ? call.reviews.find((item: any) => item.review_mode === auditMode && (!reviewer || item.reviewer_name === reviewer)) || null
        : null;
      return {
        execution_id: call.execution_id,
        assigned_reviewer: call.assigned_reviewer,
        org_name: call.org_name,
        agent_name: call.agent_name,
        duration_sec: call.duration_sec,
        created_at_ist: call.created_at_ist,
        status: call.status,
        language: call.transcriber_language,
        audit_mode: call.audit_mode,
        source_sheet: call.source_sheet,
        reviewed: Boolean(review),
        reviewer_name: review?.reviewer_name || null
      };
    })
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
