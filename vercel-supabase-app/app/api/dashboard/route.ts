import { NextResponse } from "next/server";
import { verifyOtp } from "../../../lib/otp";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Server-side gate: the page's localStorage check keeps honest people out of
// the UI, but this endpoint returns reviewer names/performance and client call
// content, so it must not answer anonymous requests. Experts authenticate with
// their email + (long-lived) OTP code in headers; verifyOtp accepts both the
// emailed short-window code and the 30-day hand-out code.
async function authorizeExpert(request: Request) {
  const email = String(request.headers.get("x-reviewer-email") || "").trim().toLowerCase();
  const code = String(request.headers.get("x-reviewer-code") || "").trim();
  if (!email || !/^\d{6}$/.test(code) || !verifyOtp(email, code)) return null;
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from("reviewers")
    .select("email,role,is_active")
    .eq("email", email)
    .maybeSingle();
  if (!data || data.is_active === false || data.role !== "expert") return null;
  return data;
}

// Client-facing analytics: trust metrics, error analytics, golden-transcript
// evidence. Everything is computed live from the current response_vibe batch.

const EXPERT_NAMES = new Set(["nabh", "manavi"]);

type Review = {
  reviewer_name: string;
  call_id: string;
  vibe_score: string;
  submitted_at: string;
  issues_json: unknown;
  review_mode: string;
};

async function fetchAll<T>(fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: any }>) {
  const pageSize = 1000;
  let rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    rows = rows.concat(data || []);
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

function parseIssues(raw: unknown): Array<Record<string, string>> {
  try {
    const list = Array.isArray(raw) ? raw : JSON.parse(String(raw || "[]"));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const expert = await authorizeExpert(request);
  if (!expert) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }
  // One retry on transient failure; a hard 503 (not a crash page) otherwise so
  // the client can keep showing last-good numbers.
  for (let attempt = 0; ; attempt++) {
    try {
      return await computeDashboard();
    } catch (error) {
      if (attempt >= 1) {
        return NextResponse.json({ error: (error as Error).message || "compute_failed" }, { status: 503 });
      }
      await new Promise((r) => setTimeout(r, 800));
    }
  }
}

async function computeDashboard() {
  const supabase = supabaseAdmin();

  const queue = await fetchAll<{ call_id: string; assigned_reviewer: string; audit_mode: string }>((from, to) =>
    supabase
      .from("call_audit_queue")
      .select("call_id,assigned_reviewer,audit_mode")
      .like("audit_mode", "response_vibe%")
      .not("audit_mode", "like", "%__archived%")
      .order("call_id", { ascending: true })
      .order("audit_mode", { ascending: true })
      .range(from, to) as any
  );
  const currentCalls = new Set(queue.map((q) => q.call_id));

  const reviews = await fetchAll<Review>((from, to) =>
    supabase
      .from("reviews")
      .select("reviewer_name,call_id,vibe_score,submitted_at,issues_json,review_mode")
      .eq("review_mode", "response_vibe")
      .order("id", { ascending: true })
      .range(from, to) as any
  );
  const cur = reviews
    .filter((r) => currentCalls.has(r.call_id))
    .sort((a, b) => (a.submitted_at || "").localeCompare(b.submitted_at || ""));

  // latest numeric score per (reviewer, call)
  const score = new Map<string, number>();
  for (const r of cur) {
    const n = (r.reviewer_name || "").trim().toLowerCase();
    const s = String(r.vibe_score || "").trim();
    if (["1", "2", "3", "4"].includes(s)) score.set(`${n}||${r.call_id}`, Number(s));
  }
  const expertScore = new Map<string, number>();
  const panel = new Map<string, Map<string, number>>();
  score.forEach((s, key) => {
    const [n, callId] = key.split("||");
    if (EXPERT_NAMES.has(n)) expertScore.set(callId, s);
    else {
      if (!panel.has(n)) panel.set(n, new Map());
      panel.get(n)!.set(callId, s);
    }
  });

  // batch membership per reviewer (b2* queue ids vs earlier) for the trend
  const batch2 = new Map<string, Set<string>>();
  for (const q of queue) {
    const qid = q.audit_mode.includes("::") ? q.audit_mode.split("::").pop() || "" : "";
    if (qid.startsWith("b2")) {
      if (!batch2.has(q.assigned_reviewer)) batch2.set(q.assigned_reviewer, new Set());
      batch2.get(q.assigned_reviewer)!.add(q.call_id);
    }
  }
  const emailByName = new Map<string, string>();
  {
    const { data } = await supabase.from("reviewers").select("email,display_name");
    for (const row of data || []) emailByName.set(String(row.display_name || "").trim().toLowerCase(), row.email);
  }

  // per-reviewer calibration vs expert
  const perReviewer: any[] = [];
  let pairsAll: Array<[number, number]> = [];
  panel.forEach((calls, name) => {
    const pairs: Array<[number, number, string]> = [];
    calls.forEach((s, callId) => {
      const e = expertScore.get(callId);
      if (e !== undefined) pairs.push([s, e, callId]);
    });
    if (!pairs.length) return;
    pairsAll = pairsAll.concat(pairs.map(([a, b]) => [a, b] as [number, number]));
    const email = emailByName.get(name) || "";
    const b2set = batch2.get(email) || new Set();
    const split = (predicate: (callId: string) => boolean) => {
      const p = pairs.filter(([, , c]) => predicate(c));
      if (!p.length) return { pct: null, n: 0 };
      return { pct: Math.round((p.filter(([a, b]) => Math.abs(a - b) <= 1).length / p.length) * 100), n: p.length };
    };
    const b1 = split((c) => !b2set.has(c));
    const b2 = split((c) => b2set.has(c));
    perReviewer.push({
      name,
      n: pairs.length,
      exact: Math.round((pairs.filter(([a, b]) => a === b).length / pairs.length) * 100),
      within1: Math.round((pairs.filter(([a, b]) => Math.abs(a - b) <= 1).length / pairs.length) * 100),
      mean_delta: Number((pairs.reduce((acc, [a, b]) => acc + (a - b), 0) / pairs.length).toFixed(2)),
      b1_within1: b1.pct, b1_n: b1.n,
      b2_within1: b2.pct, b2_n: b2.n
    });
  });
  perReviewer.sort((a, b) => b.within1 - a.within1);

  // panel-majority binary detection vs expert
  let majOk = 0, majN = 0, tp = 0, fn = 0, fp = 0;
  expertScore.forEach((e, callId) => {
    const votes: number[] = [];
    panel.forEach((calls) => {
      const v = calls.get(callId);
      if (v !== undefined) votes.push(v);
    });
    if (votes.length < 2) return;
    const panelBad = votes.filter((v) => v <= 2).length * 2 > votes.length;
    majN += 1;
    if (panelBad === (e <= 2)) majOk += 1;
    if (e <= 2 && panelBad) tp += 1;
    if (e <= 2 && !panelBad) fn += 1;
    if (e > 2 && panelBad) fp += 1;
  });

  // Krippendorff alpha (interval, pairwise formulation) on multi-rated calls
  const units = new Map<string, number[]>();
  panel.forEach((calls) => calls.forEach((s, callId) => units.set(callId, [...(units.get(callId) || []), s])));
  const multi = [...units.values()].filter((v) => v.length >= 2);
  const allVals = multi.flat();
  let alpha: number | null = null;
  if (allVals.length > 1) {
    let Do = 0, pairable = 0;
    for (const v of multi) {
      let sum = 0;
      for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) sum += (v[i] - v[j]) ** 2;
      Do += sum / (v.length - 1);
      pairable += v.length;
    }
    let De = 0;
    for (const a of allVals) for (const b of allVals) De += (a - b) ** 2;
    De /= allVals.length * (allVals.length - 1);
    alpha = De ? Number((1 - Do / pairable / (De / 2)).toFixed(2)) : null;
  }

  // throughput + issue analytics
  const todayIst = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const todayStartUtc = new Date(new Date(`${todayIst}T00:00:00+05:30`)).toISOString();
  const issueCounts: Record<string, number> = {};
  let issuesTotal = 0;
  const issuesByCall = new Map<string, Array<Record<string, string>>>();
  for (const r of cur) {
    for (const issue of parseIssues(r.issues_json)) {
      const type = String(issue.type || "");
      if (!["transcription", "pronunciation", "response_appropriateness", "flag_for_review"].includes(type)) continue;
      issueCounts[type] = (issueCounts[type] || 0) + 1;
      issuesTotal += 1;
      issuesByCall.set(r.call_id, [...(issuesByCall.get(r.call_id) || []), { ...issue, reviewer: r.reviewer_name }]);
    }
  }

  // call metadata for expert-bad calls + agent aggregates
  const callIds = [...currentCalls];
  const callMeta = new Map<string, any>();
  for (let i = 0; i < callIds.length; i += 100) {
    const { data } = await supabase
      .from("calls")
      .select("execution_id,agent_name,org_name,duration_sec,transcriber_language")
      .in("execution_id", callIds.slice(i, i + 100));
    for (const c of data || []) callMeta.set(c.execution_id, c);
  }
  const byAgent = new Map<string, { n: number; sum: number; bad: number }>();
  expertScore.forEach((s, callId) => {
    const agent = callMeta.get(callId)?.agent_name || "Unknown";
    const a = byAgent.get(agent) || { n: 0, sum: 0, bad: 0 };
    a.n += 1; a.sum += s; if (s <= 2) a.bad += 1;
    byAgent.set(agent, a);
  });
  const agents = [...byAgent.entries()]
    .map(([agent, a]) => ({ agent, calls: a.n, avg_score: Number((a.sum / a.n).toFixed(2)), pct_bad: Math.round((a.bad / a.n) * 100) }))
    .sort((a, b) => b.pct_bad - a.pct_bad);

  const worstCalls = [...expertScore.entries()]
    .filter(([, s]) => s <= 2)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 12)
    .map(([callId, s]) => ({
      execution_id: callId,
      expert_score: s,
      agent: callMeta.get(callId)?.agent_name || "",
      duration_sec: callMeta.get(callId)?.duration_sec || null,
      issues: (issuesByCall.get(callId) || []).slice(0, 5).map((i) => ({
        type: i.type,
        timestamp: i.timestamp || "",
        detail: i.audio_said || i.pronounced_word || i.response_error_type || i.notes || ""
      })),
      issue_count: (issuesByCall.get(callId) || []).length
    }));

  // golden transcript: call with the most transcription corrections
  let goldenCallId = ""; let goldenMax = 0;
  issuesByCall.forEach((list, callId) => {
    const n = list.filter((i) => i.type === "transcription").length;
    if (n > goldenMax) { goldenMax = n; goldenCallId = callId; }
  });
  const golden = goldenCallId
    ? {
        execution_id: goldenCallId,
        agent: callMeta.get(goldenCallId)?.agent_name || "",
        corrections: (issuesByCall.get(goldenCallId) || [])
          .filter((i) => i.type === "transcription")
          .slice(0, 8)
          .map((i) => ({
            turn: i.turn_number || "",
            timestamp: i.timestamp || "",
            original: i.transcripted || "",
            corrected: i.audio_said || "",
            reviewer: i.reviewer || ""
          }))
      }
    : null;

  const exact = pairsAll.length ? Math.round((pairsAll.filter(([a, b]) => a === b).length / pairsAll.length) * 100) : 0;
  const within1 = pairsAll.length ? Math.round((pairsAll.filter(([a, b]) => Math.abs(a - b) <= 1).length / pairsAll.length) * 100) : 0;
  const binary = pairsAll.length ? Math.round((pairsAll.filter(([a, b]) => (a <= 2) === (b <= 2)).length / pairsAll.length) * 100) : 0;

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    throughput: {
      reviewers_active: panel.size,
      reviews_total: cur.length,
      reviews_today: cur.filter((r) => (r.submitted_at || "") >= todayStartUtc).length,
      calls_in_batch: currentCalls.size,
      expert_scored: expertScore.size,
      issues_logged: issuesTotal
    },
    trust: {
      pairs: pairsAll.length,
      within1, exact, binary_individual: binary,
      panel_majority: { n: majN, accuracy: majN ? Math.round((majOk / majN) * 100) : 0 },
      detection: { caught: tp, expert_bad: tp + fn, false_alarms: fp },
      alpha,
      per_reviewer: perReviewer
    },
    errors: { issue_counts: issueCounts, agents, worst_calls: worstCalls },
    golden
  }, { headers: { "Cache-Control": "no-store" } });
}
