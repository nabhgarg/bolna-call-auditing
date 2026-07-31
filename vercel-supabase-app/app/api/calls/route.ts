import { NextResponse } from "next/server";
import { normalizeAuditMode } from "../../../lib/callImport";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { isDemoRequest, DEMO_CALL_LABELS } from "../../../lib/demo";

export const dynamic = "force-dynamic";

// Re-review batches require a FRESH review (submitted after the batch was
// assigned) before a call counts as done, so prior-batch reviews don't
// auto-satisfy them. Batch 4 no longer re-reviews — any existing review counts
// as done (reviewers keep credit for calls they already scored). Batch 3 was a
// re-review batch; its rows are archived now, but the rule is kept for history.
const REREVIEW_RULES: Array<{ re: RegExp; cutoff: string }> = [
  { re: /::b3/, cutoff: "2026-07-21T14:06:00.000Z" },
  // b9i is issue logging on calls the same panel already vibe-scored, and both
  // run in response_vibe mode — without a cutoff those old scores would mark
  // the whole batch done on arrival (40 of Muskan's 70 showed done at assign).
  { re: /::b9i/, cutoff: "2026-07-30T08:30:00.000Z" },
  // Priority listening sets (::prio_*) are always a fresh listen — two of
  // Manavi's 24 had old reviews under her pre-migration gmail that would have
  // marked them done on arrival.
  { re: /::prio/, cutoff: "2026-07-30T12:00:00.000Z" },
  // b10i is issue logging on calls that were ALREADY vibe-scored (that is how
  // they were picked · every one is rated 1 or 2). Issue logging shares
  // response_vibe mode, so without this every row would arrive done.
  { re: /::b10i/, cutoff: "2026-07-31T06:00:00.000Z" }
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

// A PostgREST `or` filter selecting the review rows that could belong to this
// reviewer — their email, plus every display name that maps to it, because
// older rows carry a name and sometimes a personal address instead. It only has
// to be a SUPERSET: the in-memory filter below stays the authority on ownership.
function reviewerOrFilter(reviewerEmail: string, emailMap: Map<string, string>) {
  if (!reviewerEmail) return "";
  const aliases = new Set<string>([reviewerEmail]);
  emailMap.forEach((email, name) => { if (email === reviewerEmail) aliases.add(name); });
  const quote = (v: string) => `"${v.replace(/["\\]/g, "\\$&")}"`;
  return [
    `reviewer_email.eq.${quote(reviewerEmail)}`,
    ...[...aliases].map((a) => `reviewer_name.ilike.${quote(a)}`)
  ].join(",");
}

// Supabase returns at most 1000 rows per response and a very long `in` list
// makes an unwieldy URL, so read in id-chunks and page within each chunk.
// Without this a single query truncates silently: the reviews lookup below asks
// for every reviewer's rows on a reviewer's own calls, which passed 1000 rows
// once several batches were assigned. The dropped rows were unordered, so a
// reviewer's finished calls flipped back to pending at random and were redone.
const PAGE_SIZE = 1000;
const ID_CHUNK = 300;
async function selectAllByIds(
  build: () => any,
  column: string,
  ids: string[]
): Promise<{ data: any[]; error: any }> {
  const rows: any[] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const chunk = ids.slice(i, i + ID_CHUNK);
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await build().in(column, chunk).range(from, from + PAGE_SIZE - 1);
      if (error) return { data: rows, error };
      rows.push(...(data || []));
      if (!data || data.length < PAGE_SIZE) break;
    }
  }
  return { data: rows, error: null };
}

export async function GET(request: Request) {
  // The YC partner demo is a client-facing surface, and these two fields carry
  // the one thing such a surface must never carry · who the client is. org_name
  // is blanked outright; agent_name becomes an archetype label, because the
  // sidebar renders it and three rows reading "call" tell a partner nothing.
  const demo = isDemoRequest(request);
  const anonOrg = demo ? () => null : (v: string | null) => v;
  const anonAgent = demo
    ? (_v: string | null, id: string) => DEMO_CALL_LABELS[id] || null
    : (v: string | null) => v;
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

    // Narrowed to this reviewer where possible · a reviewer's own rows are a
    // fifth of the rows on their calls, the rest belonging to co-raters and
    // discarded a few lines below.
    const orFilter = reviewerOrFilter(reviewer, emailMap);

    const [{ data: calls, error: callsError }, { data: allReviews, error: reviewsError }] = await Promise.all([
      selectAllByIds(
        () => supabase
          .from("calls")
          .select(
            "execution_id,org_name,agent_name,duration_sec,created_at_ist,status,transcriber_language,recording_url,source_sheet"
          ),
        "execution_id",
        callIds
      ),
      selectAllByIds(
        () => {
          const q = supabase
            .from("reviews")
            .select("call_id,reviewer_name,reviewer_email,review_mode,submitted_at")
            .eq("review_mode", auditMode);
          return orFilter ? q.or(orFilter) : q;
        },
        "call_id",
        callIds
      )
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
          org_name: anonOrg(call.org_name),
          agent_name: anonAgent(call.agent_name, queue.call_id),
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
        org_name: anonOrg(call.org_name),
        agent_name: anonAgent(call.agent_name, call.execution_id),
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
