import { NextResponse } from "next/server";
import { normalizeAuditMode } from "../../../lib/callImport";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Batch 3 is a re-review batch: reviewers re-score calls, including ones they
// already did in earlier batches. A ::b3 assignment is "done" only when there
// is a review submitted at/after the batch was created (2026-07-21 14:06 UTC),
// so prior-batch reviews don't auto-satisfy it. A constant (not imported_at) is
// used so a sheet re-import can't shift the cutoff.
// Each re-review batch pairs a queue-id pattern with the moment it was
// assigned; only reviews submitted after that count as done for those rows.
const REREVIEW_RULES: Array<{ re: RegExp; cutoff: string }> = [
  { re: /::b3/, cutoff: "2026-07-21T14:06:00.000Z" },
  // batch 4 (initially assigned under the s4 prefix — both spellings match)
  { re: /::[sb]4/, cutoff: "2026-07-22T09:00:00.000Z" }
];
function rereviewCutoff(auditMode: string) {
  return REREVIEW_RULES.find((r) => r.re.test(auditMode))?.cutoff || "";
}

function queueModeMatches(mode: string) {
  return `audit_mode.eq.${mode},audit_mode.like.${mode}::%`;
}

function queueIdFromMode(callId: string, queueMode: string) {
  const marker = "::";
  if (!queueMode.includes(marker)) return `${callId}::${queueMode}`;
  return queueMode.slice(queueMode.indexOf(marker) + marker.length);
}

function normalizeReviewerName(value: unknown) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

// Maps reviewer display names -> emails so sheets that still carry names keep working.
async function loadReviewerEmailMap(supabase: ReturnType<typeof supabaseAdmin>) {
  const map = new Map<string, string>();
  const { data } = await supabase.from("reviewers").select("email,display_name");
  for (const row of data || []) {
    const email = normalizeReviewerName(row.email);
    if (!email) continue;
    map.set(email, email);
    const name = normalizeReviewerName(row.display_name);
    if (name) map.set(name, email);
  }
  return map;
}

function resolveReviewerEmail(value: unknown, emailMap: Map<string, string>) {
  const normalized = normalizeReviewerName(value);
  if (!normalized) return "";
  if (normalized.includes("@")) return normalized;
  return emailMap.get(normalized) || normalized;
}

function reviewerMatches(assignedReviewer: unknown, reviewerEmail: string, emailMap: Map<string, string>) {
  return Boolean(reviewerEmail) && resolveReviewerEmail(assignedReviewer, emailMap) === reviewerEmail;
}

export async function GET(request: Request) {
  const supabase = supabaseAdmin();
  const url = new URL(request.url);
  const auditMode = normalizeAuditMode(url.searchParams.get("audit_mode") || url.searchParams.get("mode") || "pronunciation_tone");
  const reviewer = normalizeReviewerName(url.searchParams.get("reviewer") || "");
  const emailMap = reviewer ? await loadReviewerEmailMap(supabase) : new Map<string, string>();

  // Fetch the whole queue for this mode in pages — Supabase caps a single
  // response at 1000 rows, and the queue can exceed that once several batches
  // are assigned, so a single query would silently drop rows (and calls would
  // vanish from reviewers' screens).
  const pageSize = 1000;
  let queueData: any[] = [];
  let queueError: any = null;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("call_audit_queue")
      .select("call_id,assigned_reviewer,audit_mode,source_sheet")
      .or(queueModeMatches(auditMode))
      .order("audit_mode", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) { queueError = error; break; }
    queueData = queueData.concat(data || []);
    if (!data || data.length < pageSize) break;
  }

  if (!queueError) {
    const queueRows = reviewer
      ? queueData.filter((row: any) => reviewerMatches(row.assigned_reviewer, reviewer, emailMap))
      : queueData;
    const callIds = queueRows.map((row: any) => row.call_id).filter(Boolean);
    if (!callIds.length) {
      return NextResponse.json({ calls: [] }, { headers: { "Cache-Control": "no-store" } });
    }

    const reviewsQuery = supabase
      .from("reviews")
      .select("call_id,reviewer_name,reviewer_email,review_mode,submitted_at")
      .in("call_id", callIds)
      .eq("review_mode", auditMode);

    const [{ data: calls, error: callsError }, { data: allReviews, error: reviewsError }] = await Promise.all([
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

    // Reviews count as "yours" if stamped with your email, or with a legacy display name that maps to it.
    const reviews = reviewer
      ? (allReviews || []).filter((review: any) =>
          normalizeReviewerName(review.reviewer_email) === reviewer ||
          resolveReviewerEmail(review.reviewer_name, emailMap) === reviewer)
      : allReviews || [];

    const callsById = new Map((calls || []).map((call: any) => [call.execution_id, call]));
    const reviewsById = new Map((reviews || []).map((review: any) => [review.call_id, review]));
    // Latest review time per call, so re-review batches can require a fresh submission.
    const latestReviewAt = new Map<string, string>();
    for (const r of reviews) {
      const t = String(r.submitted_at || "");
      if (!latestReviewAt.has(r.call_id) || t > (latestReviewAt.get(r.call_id) as string)) {
        latestReviewAt.set(r.call_id, t);
      }
    }
    const response = NextResponse.json({
      calls: queueRows.map((queue: any) => {
        const call = callsById.get(queue.call_id) || {};
        const review = reviewsById.get(queue.call_id) || null;
        const queueId = queueIdFromMode(queue.call_id, queue.audit_mode);
        // Re-review batches (::b3*) count as done only when re-scored AFTER the
        // batch was assigned — so calls a reviewer did in an earlier batch
        // resurface as pending and get reviewed again.
        const cutoff = rereviewCutoff(queue.audit_mode);
        const reviewed = cutoff
          ? (latestReviewAt.get(queue.call_id) || "") >= cutoff
          : Boolean(review);
        return {
          queue_id: queueId,
          execution_id: queue.call_id,
          assigned_reviewer: queue.assigned_reviewer,
          org_name: call.org_name,
          agent_name: call.agent_name,
          duration_sec: call.duration_sec,
          created_at_ist: call.created_at_ist,
          status: call.status,
          language: call.transcriber_language,
          audit_mode: auditMode,
          source_sheet: queue.source_sheet || call.source_sheet,
          reviewed,
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
      "execution_id,assigned_reviewer,org_name,agent_name,duration_sec,created_at_ist,status,transcriber_language,audit_mode,source_sheet,reviews(id,reviewer_name,reviewer_email,review_mode)"
    )
    .eq("audit_mode", auditMode)
    .order("execution_id", { ascending: true });

  let calls = primary.data as any[] | null;
  let error = primary.error;

  if (error?.message?.includes("audit_mode")) {
    const fallback = await supabase
      .from("calls")
      .select(
        "execution_id,assigned_reviewer,org_name,agent_name,duration_sec,created_at_ist,status,transcriber_language,source_sheet,reviews(id,reviewer_name,reviewer_email,review_mode)"
      )
      .order("execution_id", { ascending: true });
    calls = fallback.data;
    error = fallback.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const assignedCalls = reviewer
    ? (calls || []).filter((call: any) => reviewerMatches(call.assigned_reviewer, reviewer, emailMap))
    : calls || [];

  const response = NextResponse.json({
    calls: assignedCalls.map((call: any) => {
      const review = Array.isArray(call.reviews)
        ? call.reviews.find((item: any) => item.review_mode === auditMode &&
            (!reviewer ||
              normalizeReviewerName(item.reviewer_email) === reviewer ||
              resolveReviewerEmail(item.reviewer_name, emailMap) === reviewer)) || null
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
