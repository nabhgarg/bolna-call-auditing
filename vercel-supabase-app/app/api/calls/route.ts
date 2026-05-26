import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
const REVIEWER_QUEUE_SIZE = 30;

function normalizeName(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function isSharedAssignment(value?: string | null) {
  const assigned = normalizeName(value);
  return !assigned || ["all", "everyone", "any"].includes(assigned);
}

function isAssignedToReviewer(assignedReviewer: string | null | undefined, reviewer: string) {
  const assigned = normalizeName(assignedReviewer);
  const current = normalizeName(reviewer);
  if (!current) return true;
  if (isSharedAssignment(assignedReviewer)) return false;
  return assigned
    .split(/[,;/|]+/)
    .map((name) => normalizeName(name))
    .includes(current);
}

async function claimReviewerQueue(supabase: ReturnType<typeof supabaseAdmin>, rows: any[], auditMode: string, reviewer: string) {
  if (!reviewer) return rows;

  const assignedRows = rows.filter((row) => isAssignedToReviewer(row.assigned_reviewer, reviewer));
  const needed = REVIEWER_QUEUE_SIZE - assignedRows.length;
  if (needed <= 0) return rows;

  const claimRows = rows
    .filter((row) => isSharedAssignment(row.assigned_reviewer))
    .slice(0, needed);
  const claimIds = claimRows.map((row) => row.call_id).filter(Boolean);
  if (!claimIds.length) return rows;

  await Promise.all([
    supabase
      .from("call_audit_queue")
      .update({ assigned_reviewer: reviewer })
      .eq("audit_mode", auditMode)
      .in("call_id", claimIds),
    supabase
      .from("calls")
      .update({ assigned_reviewer: reviewer })
      .in("execution_id", claimIds)
  ]);

  const claimed = new Set(claimIds);
  return rows.map((row) => (
    claimed.has(row.call_id) ? { ...row, assigned_reviewer: reviewer } : row
  ));
}

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
    const queueRows = (await claimReviewerQueue(supabase, queueResult.data || [], auditMode, reviewer))
      .filter((row: any) => isAssignedToReviewer(row.assigned_reviewer, reviewer));
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
    calls: (calls || []).filter((call: any) => isAssignedToReviewer(call.assigned_reviewer, reviewer)).map((call: any) => {
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
