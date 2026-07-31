import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { sameWord } from "../../../lib/script-match";
import type {
  OpsPayload, OpsClient, OpsReviewer, OpsAlert, OpsCheck,
  OpsClientDetail, OpsAgreement, OpsCalib, OpsMatrixRow, OpsGtRow
} from "../../../lib/ops-shape";

// GT = the founders' own reviews · the "expert" role in the reviewers table
// plus their pre-migration identities that still stamp old rows.
const EXPERT_IDS = new Set([
  "manavi@realloop.in", "manavi.garg1399@gmail.com",
  "nabh@realloop.in", "nabhgarg@gmail.com", "manavi", "nabh"
]);

export const dynamic = "force-dynamic";

// The ops console's single feed.
//
// This is step 1 of the agreed data architecture · the definitions that will
// become SQL views live here first, in ONE place, so the console and any
// answer given from this data agree by construction. The naming rule is
// enforced throughout: a field called calls_* counts calls, reviews_* counts
// reviews. Anything this route cannot honestly compute is reported as null and
// listed in `problems` rather than being filled with a plausible number.

const PAGE = 1000;
const CHUNK = 300;

async function selectAll(build: () => any): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

async function selectByIds(build: () => any, column: string, ids: string[]): Promise<any[]> {
  const rows: any[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    rows.push(...(await selectAll(() => build().in(column, chunk))));
  }
  return rows;
}

const norm = (v: unknown) => String(v || "").trim().toLowerCase().replace(/\s+/g, " ");
const day = (iso: unknown) => String(iso || "").slice(0, 10);
const baseMode = (m: string) => String(m || "").split("::")[0];
const queueTag = (m: string) => {
  const s = String(m || "");
  return s.includes("::") ? s.slice(s.indexOf("::") + 2) : s;
};
const batchOf = (m: string) => queueTag(m).split("_")[0];
const isActive = (m: string) => !baseMode(m).includes("__");

// Work type is a property, not a slug suffix · this is the mapping the new
// schema makes structural. Until then it is derived here, once.
function workType(auditMode: string): "quality_review" | "transcription" {
  return baseMode(auditMode) === "timing_transcription" ? "transcription" : "quality_review";
}
const WORK_LABEL: Record<string, string> = {
  quality_review: "Quality review",
  transcription: "Transcription"
};

// A client owns deliveries. Everything that arrived on a Calls_* / Batch sheet
// is Bolna's; the Oolka sheets are Oolka's. Unknown provenance is grouped
// rather than guessed at.
function clientOf(sourceSheet: string): { key: string; name: string } {
  const s = String(sourceSheet || "");
  if (/oolka/i.test(s)) return { key: "oolka", name: "Oolka" };
  if (!s || /^[0-9a-f-]{20,}$/i.test(s)) return { key: "other", name: "Unattributed" };
  return { key: "bolna", name: "Bolna" };
}

const ISSUE_LABEL: Record<string, string> = {
  transcription: "Transcription",
  response_appropriateness: "Response appropriateness",
  pronunciation: "Pronunciation",
  latency: "Latency / dead air",
  tone: "Tone & naturalness",
  barge_in: "Barge-in",
  flag_for_review: "Flagged / uncodeable"
};

function issueCategories(issues: any): string[] {
  if (!Array.isArray(issues)) return [];
  return issues
    .map((i) => (i && typeof i === "object" ? String(i.category || i.type || i.label || "") : String(i)))
    .filter(Boolean)
    .filter((c) => c !== "metric_rating");
}

/** Share of words two transcripts of the same audio agree on, script-insensitive.
 *
 *  Whole-transcript equality (sameText) is the right test for a short segment
 *  and useless on a full call · one extra filler word anywhere scores the pair
 *  zero, which is why an exact-match version of this read 0% every day. This
 *  scores position-by-position over the shorter transcript and charges for the
 *  length difference, so a near-identical pair reads near 100. */
function wordAgreement(a: string, b: string): number {
  const A = String(a || "").trim().split(/\s+/).filter(Boolean);
  const B = String(b || "").trim().split(/\s+/).filter(Boolean);
  if (!A.length && !B.length) return 1;
  if (!A.length || !B.length) return 0;
  const n = Math.min(A.length, B.length);
  let hit = 0;
  for (let i = 0; i < n; i++) if (sameWord(A[i], B[i])) hit++;
  return hit / Math.max(A.length, B.length);
}

/** Krippendorff's alpha for ordinal-ish 1..4 scores, interval difference.
 *  Returns null when there are too few multi-rated units to be meaningful. */
function krippendorff(units: number[][]): number | null {
  const usable = units.filter((u) => u.length >= 2);
  if (usable.length < 10) return null;
  let dObs = 0, nPairs = 0;
  const all: number[] = [];
  for (const u of usable) {
    for (let i = 0; i < u.length; i++) {
      all.push(u[i]);
      for (let j = 0; j < u.length; j++) {
        if (i === j) continue;
        dObs += (u[i] - u[j]) ** 2;
        nPairs++;
      }
    }
  }
  if (!nPairs) return null;
  // Expected disagreement across the pooled distribution. Computed from value
  // frequencies rather than every ordered pair · the scale has four values, so
  // this is a 4x4 sum instead of an O(n^2) walk over thousands of ratings.
  const freq = new Map<number, number>();
  for (const v of all) freq.set(v, (freq.get(v) || 0) + 1);
  const n = all.length;
  let dExp = 0;
  for (const [v1, c1] of freq) {
    for (const [v2, c2] of freq) {
      dExp += c1 * (v1 === v2 ? c2 - 1 : c2) * (v1 - v2) ** 2;
    }
  }
  const mPairs = n * (n - 1);
  if (!mPairs || dExp === 0) return null;
  return 1 - (dObs / nPairs) / (dExp / mPairs);
}

function lastNDays(n: number, endIso: string): string[] {
  const out: string[] = [];
  const end = new Date(endIso + "T00:00:00Z");
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export async function GET() {
  const problems: string[] = [];
  try {
    const supabase = supabaseAdmin();
    const nowIso = new Date().toISOString();
    const today = nowIso.slice(0, 10);

    const [queue, reviews, calls, reviewerRows] = await Promise.all([
      selectAll(() => supabase.from("call_audit_queue").select("call_id,audit_mode,assigned_reviewer,source_sheet,imported_at")),
      selectAll(() => supabase.from("reviews").select("call_id,reviewer_name,reviewer_email,review_mode,vibe_score,issues_json,submitted_at,duration_taken_sec,sheets_sync_error")),
      selectAll(() => supabase.from("calls").select("execution_id,source_sheet,org_name,agent_name,duration_sec")),
      selectAll(() => supabase.from("reviewers").select("email,display_name,role"))
    ]);

    // ---- identity: one person, one id (aliases resolved once, here) --------
    const alias = new Map<string, string>();
    const nameOf = new Map<string, string>();
    for (const r of reviewerRows) {
      const email = norm(r.email);
      if (!email) continue;
      alias.set(email, email);
      if (r.display_name) alias.set(norm(r.display_name), email);
      nameOf.set(email, String(r.display_name || email.split("@")[0]));
    }
    const who = (email: unknown, name: unknown) => {
      const e = norm(email);
      if (e && e.includes("@") && alias.has(e)) return alias.get(e) as string;
      const n = alias.get(norm(name));
      if (n) return n;
      return e || norm(name);
    };

    const callById = new Map(calls.map((c: any) => [c.execution_id, c]));

    // ---- reviews, current only (superseded rows excluded) ------------------
    const live = reviews.filter((r: any) => r.review_mode !== "cleared");
    const cleared = reviews.filter((r: any) => r.review_mode === "cleared");
    for (const r of live) (r as any)._who = who(r.reviewer_email, r.reviewer_name);
    for (const r of cleared) (r as any)._who = who(r.reviewer_email, r.reviewer_name);

    // done set, keyed the way the reviewer app keys it
    const doneKey = new Set(live.map((r: any) => `${r.call_id}|${r._who}|${r.review_mode}`));

    // ---- assignments ------------------------------------------------------
    const active = queue.filter((q: any) => isActive(q.audit_mode));
    const activeByReviewer = new Map<string, any[]>();
    for (const q of active) {
      const w = who(q.assigned_reviewer, q.assigned_reviewer);
      if (!w) continue;
      (q as any)._who = w;
      (q as any)._done = doneKey.has(`${q.call_id}|${w}|${baseMode(q.audit_mode)}`);
      if (!activeByReviewer.has(w)) activeByReviewer.set(w, []);
      (activeByReviewer.get(w) as any[]).push(q);
    }

    // ---- reviewer table ---------------------------------------------------
    const days7 = lastNDays(7, today);
    const days14 = lastNDays(14, today);
    const perDay = new Map<string, Map<string, number>>();
    let lastSub = new Map<string, string>();
    for (const r of live) {
      const w = (r as any)._who;
      const d = day(r.submitted_at);
      if (!perDay.has(w)) perDay.set(w, new Map());
      const m = perDay.get(w) as Map<string, number>;
      m.set(d, (m.get(d) || 0) + 1);
      const t = String(r.submitted_at || "");
      if (t > (lastSub.get(w) || "")) lastSub.set(w, t);
    }

    const reviewersOut: OpsReviewer[] = [];
    for (const [w, rows] of activeByReviewer) {
      const assigned = rows.length;
      const done = rows.filter((q: any) => q._done).length;
      if (!assigned) continue;
      const pending = assigned - done;
      const last = lastSub.get(w) || "";
      const idleDays = last
        ? Math.floor((Date.parse(nowIso) - Date.parse(last)) / 86400000)
        : 99;
      const pacePct = assigned ? Math.round((done / assigned) * 100) : 0;
      const state: OpsReviewer["state"] =
        pending === 0 ? "done" : idleDays >= 3 ? "idle" : pacePct >= 55 ? "on track" : "behind";
      // dominant use case by row count
      const byUse = new Map<string, number>();
      for (const q of rows) {
        const k = workType(q.audit_mode);
        byUse.set(k, (byUse.get(k) || 0) + 1);
      }
      const topUse = [...byUse.entries()].sort((a, b) => b[1] - a[1])[0];
      const m = perDay.get(w) || new Map();
      // Assigned-per-day is derived from imported_at on the queue rows, so the
      // daily history is reconstructible for any past day without a snapshot
      // table · nothing extra has to be stored for this view.
      const asgByDay = new Map<string, number>();
      for (const q of rows) {
        const d0 = day(q.imported_at);
        if (d0) asgByDay.set(d0, (asgByDay.get(d0) || 0) + 1);
      }
      const daily = days14.map((d) => ({
        label: d.slice(8),
        assigned: asgByDay.get(d) || 0,
        done: m.get(d) || 0
      }));
      const days56 = lastNDays(56, today);
      const weekly: { label: string; assigned: number; done: number }[] = [];
      for (let i = 0; i < 56; i += 7) {
        const wk = days56.slice(i, i + 7);
        weekly.push({
          label: wk[0].slice(5),
          assigned: wk.reduce((s, d) => s + (asgByDay.get(d) || 0), 0),
          done: wk.reduce((s, d) => s + (m.get(d) || 0), 0)
        });
      }
      reviewersOut.push({
        email: w,
        name: nameOf.get(w) || w.split("@")[0],
        useCase: byUse.size > 1
          ? `${WORK_LABEL[topUse[0]]} +${byUse.size - 1}`
          : WORK_LABEL[topUse[0]] || "—",
        assigned, done, pendingTotal: pending, pacePct, state,
        spark: days7.map((d) => m.get(d) || 0),
        last: last ? (day(last) === today ? last.slice(11, 16) : day(last).slice(5)) : "never",
        lastIso: last,
        idleDays: last ? idleDays : -1,
        history: days14.map((d) => ({ label: d.slice(8), value: m.get(d) || 0 })),
        daily, weekly
      });
    }
    reviewersOut.sort((a, b) => b.pendingTotal - a.pendingTotal);

    // ---- clients & runway -------------------------------------------------
    const clientAgg = new Map<string, { name: string; uc: Map<string, number>; pending: number; doneAll: number }>();
    for (const q of active) {
      const call = callById.get(q.call_id) || {};
      const c = clientOf(q.source_sheet || call.source_sheet);
      if (!clientAgg.has(c.key)) clientAgg.set(c.key, { name: c.name, uc: new Map(), pending: 0, doneAll: 0 });
      const agg = clientAgg.get(c.key) as any;
      const wt = workType(q.audit_mode);
      if (!(q as any)._done) {
        agg.pending++;
        agg.uc.set(wt, (agg.uc.get(wt) || 0) + 1);
      } else agg.doneAll++;
    }

    // burn rate = mean reviews/day over the last 7 days, per client is not
    // separable from review rows alone, so runway uses the fleet rate applied
    // to that client's remaining pending. Stated plainly rather than implied.
    const fleet7 = days7.map((d) => live.filter((r: any) => day(r.submitted_at) === d).length);
    const burn = Math.max(1, Math.round(fleet7.reduce((s, n) => s + n, 0) / 7));

    const clientsOut: OpsClient[] = [...clientAgg.entries()].map(([key, agg]) => {
      const days = agg.pending / burn;
      return {
        key, name: agg.name, alerts: 0,
        useCases: [...agg.uc.entries()].map(([k, n]) => ({
          key: k, name: WORK_LABEL[k], inFlight: n, ok: n > 0
        })),
        runway: days < 1 ? "Runway under 1 day" : `About ${Math.round(days)} more day${Math.round(days) === 1 ? "" : "s"} of work`,
        runwaySub: `${agg.pending.toLocaleString()} calls pending · fleet pace ${burn}/day`,
        runwayDays: days,
        totalInFlight: agg.pending,
        revenueInr: 0
      };
    }).filter((c) => c.totalInFlight > 0 || c.useCases.length)
      .sort((a, b) => b.totalInFlight - a.totalInFlight);

    // ---- alerts -----------------------------------------------------------
    const alerts: OpsAlert[] = [];
    for (const r of reviewersOut) {
      if (r.idleDays >= 3 && r.pendingTotal > 0) {
        alerts.push({
          sev: "red",
          text: `${r.name} has ${r.pendingTotal} pending calls and has not submitted for ${r.idleDays} days.`,
          short: `${r.name} idle ${r.idleDays}d, ${r.pendingTotal} pending`,
          when: `${r.idleDays} days idle`
        });
      }
    }
    // batch under 50% at 72h
    const batchAgg = new Map<string, { done: number; total: number; oldest: string; mode: string }>();
    for (const q of active) {
      const k = `${baseMode(q.audit_mode)}|${batchOf(q.audit_mode)}`;
      if (!batchAgg.has(k)) batchAgg.set(k, { done: 0, total: 0, oldest: String(q.imported_at || ""), mode: k });
      const b = batchAgg.get(k) as any;
      b.total++;
      if ((q as any)._done) b.done++;
      const t = String(q.imported_at || "");
      if (t && (!b.oldest || t < b.oldest)) b.oldest = t;
    }
    const UUIDISH = /^[0-9a-f]{8}-[0-9a-f]{4}/i;
    for (const [k, b] of batchAgg) {
      const tag = k.split("|")[1];
      // Legacy pronunciation_tone rows carry the call id as their queue tag, so
      // every call would raise its own "stalled batch". Only real batches
      // (a shared, non-id tag covering a meaningful number of calls) qualify.
      if (UUIDISH.test(tag) || tag.length < 2 || b.total < 20) continue;
      const ageH = b.oldest ? (Date.parse(nowIso) - Date.parse(b.oldest)) / 3600000 : 0;
      const pct = b.total ? b.done / b.total : 1;
      if (ageH >= 72 && pct < 0.5) {
        alerts.push({
          sev: "amber",
          text: `Batch ${k.split("|")[1]} is at ${Math.round(pct * 100)}% with ${Math.round(ageH / 24)} days gone.`,
          short: `Batch ${k.split("|")[1]} at ${Math.round(pct * 100)}% after ${Math.round(ageH / 24)}d`,
          when: `${Math.round(ageH / 24)} days old`
        });
      }
    }
    // reviews faster than the audio
    let tooFast = 0;
    for (const r of live) {
      const c = callById.get(r.call_id);
      const took = Number(r.duration_taken_sec || 0);
      if (c && took > 0 && Number(c.duration_sec || 0) > 0 && took < Number(c.duration_sec) * 0.5) tooFast++;
    }
    if (tooFast > 0) {
      alerts.push({
        sev: "amber",
        text: `${tooFast} reviews took less than half the length of their call.`,
        short: `${tooFast} reviews faster than the audio`,
        when: "all time"
      });
    }
    const syncFails = live.filter((r: any) => r.sheets_sync_error).length;
    if (syncFails > 0) {
      alerts.push({
        sev: "amber",
        text: `${syncFails} reviews failed to sync to the ops sheet.`,
        short: `${syncFails} sheet-sync failures`,
        when: "unresolved"
      });
    }
    for (const c of clientsOut) {
      if (c.runwayDays < 1 && c.totalInFlight > 0) {
        alerts.push({
          sev: "amber",
          text: `${c.name} has under a day of work left · ${c.totalInFlight} calls pending.`,
          short: `${c.name} runway under a day`,
          when: "now"
        });
      }
    }
    alerts.sort((a, b) => (a.sev === b.sev ? 0 : a.sev === "red" ? -1 : 1));
    for (const c of clientsOut) {
      c.alerts = alerts.filter((a) => a.text.includes(c.name)).length;
    }

    const checks: OpsCheck[] = [
      { name: "Idle reviewers", value: String(reviewersOut.filter((r) => r.idleDays >= 3 && r.pendingTotal > 0).length), tripped: false },
      { name: "Batches under 50% at 72h", value: String(alerts.filter((a) => a.short.startsWith("Batch")).length), tripped: false },
      { name: "Reviews faster than the audio", value: String(tooFast), tripped: false },
      { name: "Sheet sync failures", value: String(syncFails), tripped: false },
      { name: "Deliveries under 1 day runway", value: String(clientsOut.filter((c) => c.runwayDays < 1 && c.totalInFlight > 0).length), tripped: false },
      { name: "Done-counts moving backwards", value: "not tracked", tripped: false }
    ].map((c) => ({ ...c, tripped: c.value !== "0" && c.value !== "not tracked" }));
    problems.push("Done-count regression needs a daily snapshot table; not computable from current data.");

    // ---- batch options ----------------------------------------------------
    const coveredBy = new Map<string, Set<string>>();
    for (const q of active) {
      const wt = workType(q.audit_mode);
      if (!coveredBy.has(wt)) coveredBy.set(wt, new Set());
      (coveredBy.get(wt) as Set<string>).add(q.call_id);
    }
    const batchOptions = (["quality_review", "transcription"] as const).map((wt) => {
      const covered = coveredBy.get(wt) || new Set();
      const pool = calls.filter((c: any) => clientOf(c.source_sheet).key === "bolna" && !covered.has(c.execution_id)).length;
      return { key: wt, name: `Bolna · ${WORK_LABEL[wt]}`, pool };
    });

    // ---- per client detail ------------------------------------------------
    const details: Record<string, OpsClientDetail> = {};
    for (const c of clientsOut) {
      const callIds = new Set(
        calls.filter((x: any) => clientOf(x.source_sheet).key === c.key).map((x: any) => x.execution_id)
      );
      const mine = live.filter((r: any) => callIds.has(r.call_id));
      const qr = mine.filter((r: any) => r.review_mode === "response_vibe");
      const tr = mine.filter((r: any) => r.review_mode === "timing_transcription");

      // quality trend · volume-weighted daily mean
      const d30 = lastNDays(30, today);
      const trendDaily = d30.map((d) => {
        const xs = qr.filter((r: any) => day(r.submitted_at) === d && Number(r.vibe_score) > 0)
          .map((r: any) => Number(r.vibe_score));
        return { label: d.slice(5), value: xs.length ? xs.reduce((s, n) => s + n, 0) / xs.length : 0 };
      });
      const trendWeekly: { label: string; value: number }[] = [];
      for (let i = 0; i < trendDaily.length; i += 7) {
        const wk = trendDaily.slice(i, i + 7).filter((x) => x.value > 0);
        if (wk.length) trendWeekly.push({ label: wk[0].label, value: wk.reduce((s, x) => s + x.value, 0) / wk.length });
      }

      // low-rated funnel: reviewed → rated 1-2 → of those, issue-logged
      const d14 = lastNDays(14, today);
      const lowByCall = new Map<string, boolean>();
      for (const r of qr) {
        const v = Number(r.vibe_score);
        if (v === 1 || v === 2) lowByCall.set(r.call_id, true);
      }
      const loggedCalls = new Set(
        qr.filter((r: any) => issueCategories(r.issues_json).some((k) => k !== "transcription")).map((r: any) => r.call_id)
      );
      const funnel = d14.map((d) => {
        const dayRows = qr.filter((r: any) => day(r.submitted_at) === d);
        const reviewedCalls = new Set(dayRows.map((r: any) => r.call_id));
        const low = [...reviewedCalls].filter((id) => lowByCall.get(id));
        return {
          label: d.slice(8),
          reviewed: reviewedCalls.size,
          low: low.length,
          logged: low.filter((id) => loggedCalls.has(id)).length
        };
      });
      const backlogCalls = [...lowByCall.keys()].filter((id) => !loggedCalls.has(id));
      // earliest review per call, built once · looking it up per backlog call
      // was a full scan of every review each time
      const firstReviewAt = new Map<string, string>();
      for (const r of qr) {
        const t = String(r.submitted_at || "");
        if (!t) continue;
        const cur = firstReviewAt.get(r.call_id);
        if (!cur || t < cur) firstReviewAt.set(r.call_id, t);
      }
      let oldestDays = 0;
      for (const id of backlogCalls) {
        const t = firstReviewAt.get(id);
        if (t) oldestDays = Math.max(oldestDays, Math.floor((Date.parse(nowIso) - Date.parse(t)) / 86400000));
      }

      // Issue mix at DAY level, transcription excluded · transcription findings
      // are a different process with their own tab, and at 30k findings they
      // flattened every other category into invisibility.
      const weeks: string[][] = [];
      for (let w = 5; w >= 0; w--) {
        weeks.push(lastNDays(7, lastNDays(w * 7 + 1, today)[0]));
      }
      const dayIdx = new Map(d14.map((d, i) => [d, i]));
      const catTotals = new Map<string, number[]>();
      for (const r of mine) {
        const di = dayIdx.get(day(r.submitted_at));
        if (di === undefined) continue;
        for (const cat of issueCategories(r.issues_json)) {
          if (cat === "transcription") continue;
          if (!catTotals.has(cat)) catTotals.set(cat, new Array(d14.length).fill(0));
          (catTotals.get(cat) as number[])[di]++;
        }
      }
      const issueMix = [...catTotals.entries()]
        .map(([k, bars]) => {
          const total = bars.reduce((s, n) => s + n, 0);
          const last7 = bars.slice(7).reduce((s, n) => s + n, 0);
          const prev7 = bars.slice(0, 7).reduce((s, n) => s + n, 0);
          return {
            name: ISSUE_LABEL[k] || k,
            bars, total,
            deltaPct: prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : null
          };
        })
        .sort((a, b) => b.total - a.total);

      // issues captured per day / per week, transcription excluded
      const days56 = lastNDays(56, today);
      const issueDayCount = new Map<string, number>();
      for (const r of mine) {
        const dd = day(r.submitted_at);
        const n = issueCategories(r.issues_json).filter((c) => c !== "transcription").length;
        if (n) issueDayCount.set(dd, (issueDayCount.get(dd) || 0) + n);
      }
      const issueTrend = {
        daily: d14.map((dd) => ({ label: dd.slice(8), value: issueDayCount.get(dd) || 0 })),
        weekly: Array.from({ length: 8 }, (_, i) => {
          const wk = days56.slice(i * 7, i * 7 + 7);
          return { label: wk[0].slice(5), value: wk.reduce((s, dd) => s + (issueDayCount.get(dd) || 0), 0) };
        })
      };

      // ---- vibe · batch × reviewer done matrix ----
      const mxAgg = new Map<string, { latest: string; per: Map<string, { a: number; d: number }> }>();
      for (const q of active) {
        if (workType(q.audit_mode) !== "quality_review" || !callIds.has(q.call_id)) continue;
        const tag = batchOf(q.audit_mode);
        if (/^[0-9a-f]{8}-/i.test(tag) || tag.length < 2) continue;
        const w = (q as any)._who;
        if (!w) continue;
        if (!mxAgg.has(tag)) mxAgg.set(tag, { latest: "", per: new Map() });
        const row = mxAgg.get(tag) as any;
        const t = String(q.imported_at || "");
        if (t > row.latest) row.latest = t;
        if (!row.per.has(w)) row.per.set(w, { a: 0, d: 0 });
        const cell = row.per.get(w);
        cell.a++;
        if ((q as any)._done) cell.d++;
      }
      const vibeMatrix: OpsMatrixRow[] = [...mxAgg.entries()]
        .sort((a, b) => (a[1].latest < b[1].latest ? 1 : -1))
        .map(([tag, row]) => {
          const per = [...row.per.entries()]
            .map(([w, c]: [string, any]) => ({ name: nameOf.get(w) || w.split("@")[0], assigned: c.a, done: c.d }))
            .sort((x, y) => x.name.localeCompare(y.name));
          return {
            batch: tag,
            per,
            assigned: per.reduce((s, p) => s + p.assigned, 0),
            done: per.reduce((s, p) => s + p.done, 0)
          };
        });

      // ---- vibe vs GT · panel scores within ±1 of the expert mean ----
      const expertSum = new Map<string, { sum: number; n: number }>();
      for (const r of qr) {
        const v = Number(r.vibe_score);
        if (!(v >= 1 && v <= 4) || !EXPERT_IDS.has((r as any)._who)) continue;
        const e = expertSum.get(r.call_id) || { sum: 0, n: 0 };
        e.sum += v; e.n++;
        expertSum.set(r.call_id, e);
      }
      const gtHit = new Map<string, { hit: number; n: number }>();
      let gtHitAll = 0, gtNAll = 0;
      for (const r of qr) {
        const v = Number(r.vibe_score);
        const w = (r as any)._who;
        if (!(v >= 1 && v <= 4) || EXPERT_IDS.has(w)) continue;
        const e = expertSum.get(r.call_id);
        if (!e) continue;
        const hit = Math.abs(v - e.sum / e.n) <= 1 ? 1 : 0;
        const g = gtHit.get(w) || { hit: 0, n: 0 };
        g.hit += hit; g.n++;
        gtHit.set(w, g);
        gtHitAll += hit; gtNAll++;
      }
      const vibeVsGT = {
        rows: [...gtHit.entries()]
          .map(([w, g]): OpsGtRow => ({ name: nameOf.get(w) || w.split("@")[0], pct: g.n ? Math.round((g.hit / g.n) * 100) : null, n: g.n }))
          .sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0)),
        overall: gtNAll ? Math.round((gtHitAll / gtNAll) * 100) : null,
        gtCalls: expertSum.size
      };

      // coverage per delivery
      const bySheet = new Map<string, any[]>();
      for (const x of calls) {
        if (clientOf(x.source_sheet).key !== c.key) continue;
        const k = String(x.source_sheet || "—");
        if (!bySheet.has(k)) bySheet.set(k, []);
        (bySheet.get(k) as any[]).push(x);
      }
      const qrCovered = new Set(active.filter((q: any) => workType(q.audit_mode) === "quality_review").map((q: any) => q.call_id));
      const trCovered = new Set(active.filter((q: any) => workType(q.audit_mode) === "transcription").map((q: any) => q.call_id));
      const deliveries = [...bySheet.entries()]
        .map(([name, xs]) => {
          const ids = xs.map((x: any) => x.execution_id);
          const pct = (s: Set<string>) => Math.round((ids.filter((i) => s.has(i)).length / ids.length) * 100);
          const untouched = ids.filter((i) => !qrCovered.has(i) && !trCovered.has(i)).length;
          const firstSeen = xs.map((x: any) => String(x.created_at_ist || "")).filter(Boolean).sort()[0] || "";
          return {
            name,
            date: firstSeen ? day(firstSeen) : "—",
            expected: null,
            actual: ids.length,
            work: [
              { name: "Quality", pct: pct(qrCovered) },
              { name: "Transcript", pct: pct(trCovered) }
            ],
            remainder: untouched
          };
        })
        .sort((a, b) => b.actual - a.actual)
        .slice(0, 6);

      // agents
      const byAgent = new Map<string, { calls: Set<string>; scores: number[]; cats: Map<string, number> }>();
      for (const x of calls) {
        if (clientOf(x.source_sheet).key !== c.key) continue;
        const key = String(x.org_name || x.agent_name || "—") || "—";
        if (!byAgent.has(key)) byAgent.set(key, { calls: new Set(), scores: [], cats: new Map() });
        (byAgent.get(key) as any).calls.add(x.execution_id);
      }
      for (const r of qr) {
        const x = callById.get(r.call_id);
        if (!x) continue;
        const key = String(x.org_name || x.agent_name || "—") || "—";
        const a = byAgent.get(key);
        if (!a) continue;
        if (Number(r.vibe_score) > 0) a.scores.push(Number(r.vibe_score));
        for (const cat of issueCategories(r.issues_json)) a.cats.set(cat, (a.cats.get(cat) || 0) + 1);
      }
      const agents = [...byAgent.entries()]
        .map(([name, a]) => ({
          name,
          calls: a.calls.size,
          score: a.scores.length ? Number((a.scores.reduce((s, n) => s + n, 0) / a.scores.length).toFixed(2)) : null,
          topIssue: [...a.cats.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] || "—"
        }))
        .map((a) => ({ ...a, topIssue: ISSUE_LABEL[a.topIssue] || a.topIssue }))
        .filter((a) => a.calls > 2)
        .sort((a, b) => b.calls - a.calls)
        .slice(0, 8);

      // ---- agreement (vibe) ----
      const byCall = new Map<string, Map<string, number>>();
      for (const r of qr) {
        const v = Number(r.vibe_score);
        if (!(v >= 1 && v <= 4)) continue;
        if (!byCall.has(r.call_id)) byCall.set(r.call_id, new Map());
        (byCall.get(r.call_id) as Map<string, number>).set((r as any)._who, v);
      }
      const units = [...byCall.values()].map((m) => [...m.values()]).filter((u) => u.length >= 2);
      let exact = 0, within = 0, pairs = 0;
      for (const u of units) {
        for (let i = 0; i < u.length; i++) for (let j = i + 1; j < u.length; j++) {
          pairs++;
          if (u[i] === u[j]) exact++;
          if (Math.abs(u[i] - u[j]) <= 1) within++;
        }
      }
      const alpha = krippendorff(units);
      const agreement: OpsAgreement[] = [
        {
          name: "Exact match", value: pairs ? `${Math.round((exact / pairs) * 100)}%` : "—",
          caption: "Two reviewers give the identical score. The honest headline.",
          spark: [], tone: "plain"
        },
        {
          name: "Within ±1", value: pairs ? `${Math.round((within / pairs) * 100)}%` : "—",
          caption: "Client-facing, and generous — it saturates on a four-point scale.",
          spark: [], tone: "plain"
        },
        {
          name: "Krippendorff's α",
          value: alpha === null ? "—" : alpha.toFixed(2),
          caption: alpha === null
            ? "Not enough multi-rated calls yet."
            : "Agreement above chance. Below 0.4, treat single scores as noisy.",
          spark: [], tone: alpha !== null && alpha < 0.4 ? "warn" : "plain"
        }
      ];

      // ---- transcription agreement (script-insensitive) ----
      // Bucketed by (day, call) up front · the previous shape re-scanned every
      // transcription review for each call on each of 14 days.
      // ---- vibe vs peers · within ±1 of each co-rater on shared calls ----
      const peerHit = new Map<string, { hit: number; n: number }>();
      for (const [, m] of byCall) {
        const entries = [...m.entries()].filter(([w]) => !EXPERT_IDS.has(w));
        for (let i = 0; i < entries.length; i++) for (let j = 0; j < entries.length; j++) {
          if (i === j) continue;
          const [w, v] = entries[i];
          const hit = Math.abs(v - entries[j][1]) <= 1 ? 1 : 0;
          const g = peerHit.get(w) || { hit: 0, n: 0 };
          g.hit += hit; g.n++;
          peerHit.set(w, g);
        }
      }
      const vibeVsPeers: OpsGtRow[] = [...peerHit.entries()]
        .map(([w, g]): OpsGtRow => ({ name: nameOf.get(w) || w.split("@")[0], pct: g.n ? Math.round((g.hit / g.n) * 100) : null, n: g.n }))
        .sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0));

      // The transcript is not free text · each transcription review carries a
      // list of timestamped segments in issues_json, and `audio_said` is what
      // the reviewer heard. So agreement is measured segment by segment on the
      // same timestamp of the same call, which is the unit reviewers actually
      // disagree on. (notes only holds a summary line like "6 spikes".)
      const trDays = lastNDays(14, today);
      const trDayIdx = new Map(trDays.map((d, i) => [d, i]));
      // day -> "callId@timestamp" -> heard text per reviewer
      const segBuckets: Map<string, string[]>[] = trDays.map(() => new Map());
      for (const r of tr) {
        const i = trDayIdx.get(day(r.submitted_at));
        if (i === undefined) continue;
        const segs = Array.isArray(r.issues_json) ? r.issues_json : [];
        for (const s of segs) {
          if (!s || typeof s !== "object") continue;
          const heard = String((s as any).audio_said || "").trim();
          const ts = String((s as any).timestamp || "").trim();
          if (!heard || !ts || heard.startsWith("(")) continue;
          const key = `${r.call_id}@${ts}`;
          const b = segBuckets[i];
          if (!b.has(key)) b.set(key, []);
          (b.get(key) as string[]).push(heard);
        }
      }
      const trDaily = trDays.map((d, i) => {
        let score = 0, n = 0;
        for (const texts of segBuckets[i].values()) {
          if (texts.length < 2) continue;
          for (let a = 0; a < texts.length; a++) for (let b = a + 1; b < texts.length; b++) {
            n++;
            score += wordAgreement(texts[a], texts[b]);
          }
        }
        return { label: d.slice(8), value: n ? Math.round((score / n) * 100) : 0 };
      });

      // ---- transcription vs GT · panel segments against expert segments on
      // the same timestamp of the same call, all time (GT is sparse) ----
      const segsOf = (r: any) => (Array.isArray(r.issues_json) ? r.issues_json : [])
        .map((s: any) => ({ ts: String(s?.timestamp || "").trim(), heard: String(s?.audio_said || "").trim() }))
        .filter((s: any) => s.ts && s.heard && !s.heard.startsWith("("));
      const expertSeg = new Map<string, string[]>();
      let lastExpertTr = "";
      for (const r of tr) {
        if (!EXPERT_IDS.has((r as any)._who)) continue;
        const t = String(r.submitted_at || "");
        if (t > lastExpertTr) lastExpertTr = t;
        for (const s of segsOf(r)) {
          const key = `${r.call_id}@${s.ts}`;
          if (!expertSeg.has(key)) expertSeg.set(key, []);
          (expertSeg.get(key) as string[]).push(s.heard);
        }
      }
      let gtScore = 0, gtN = 0;
      const gtCallSet = new Set<string>();
      for (const r of tr) {
        if (EXPERT_IDS.has((r as any)._who)) continue;
        for (const s of segsOf(r)) {
          const gts = expertSeg.get(`${r.call_id}@${s.ts}`);
          if (!gts) continue;
          for (const g of gts) {
            gtN++;
            gtScore += wordAgreement(s.heard, g);
            gtCallSet.add(r.call_id);
          }
        }
      }

      // ---- per-person calibration: deviation from panel consensus ----
      // Leave-one-out consensus · including a reviewer in the average they are
      // measured against pulls it toward them and reports everyone as perfectly
      // calibrated, which is how this first read all zeros.
      const callSum = new Map<string, { sum: number; n: number }>();
      for (const [id, m] of byCall) {
        const vs = [...m.values()];
        if (vs.length >= 2) callSum.set(id, { sum: vs.reduce((s, n) => s + n, 0), n: vs.length });
      }
      const devByWho = new Map<string, Map<string, number[]>>();
      for (const r of qr) {
        const v = Number(r.vibe_score);
        const agg = callSum.get(r.call_id);
        if (!(v >= 1 && v <= 4) || !agg || agg.n < 2) continue;
        const cons = (agg.sum - v) / (agg.n - 1);
        const w = (r as any)._who, d = day(r.submitted_at);
        if (!devByWho.has(w)) devByWho.set(w, new Map());
        const m = devByWho.get(w) as Map<string, number[]>;
        if (!m.has(d)) m.set(d, []);
        (m.get(d) as number[]).push(v - cons);
      }
      const calib: OpsCalib[] = [...devByWho.entries()].map(([w, m]) => {
        const dev = days7.map((d) => {
          const xs = m.get(d) || [];
          return xs.length ? Number((xs.reduce((s, n) => s + n, 0) / xs.length).toFixed(2)) : 0;
        });
        // Headline is the mean over days that actually had multi-rated calls ·
        // reporting only the last day showed 0.00 for anyone idle today, which
        // reads as "perfectly calibrated" rather than "no data".
        const withData = days7.map((d) => m.get(d) || []).filter((xs) => xs.length);
        const flat = withData.flat();
        const mean = flat.length ? flat.reduce((s, n) => s + n, 0) / flat.length : 0;
        const recent = dev.filter((x) => x !== 0).slice(-3);
        return {
          name: nameOf.get(w) || w.split("@")[0],
          value: Number(mean.toFixed(2)),
          dev,
          flag: Math.abs(mean) > 0.5 || (recent.length === 3 && recent.every((x) => Math.abs(x) > 0.5))
        };
      }).filter((p) => p.dev.some((x) => x !== 0))
        .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
        .slice(0, 8);

      // ---- flag rate, weekly ----
      const flagRate = weeks.map((wk, i) => {
        const rows = mine.filter((r: any) => wk.includes(day(r.submitted_at)));
        const flagged = rows.filter((r: any) => issueCategories(r.issues_json).includes("flag_for_review")).length;
        return { label: wk[0].slice(5), pct: rows.length ? Number(((flagged / rows.length) * 100).toFixed(1)) : 0 };
      });

      // ---- resubmissions ----
      const resubBy = new Map<string, number>();
      for (const r of cleared) {
        if (!callIds.has(r.call_id)) continue;
        const w = (r as any)._who;
        resubBy.set(w, (resubBy.get(w) || 0) + 1);
      }
      const liveBy = new Map<string, number>();
      for (const r of mine) liveBy.set((r as any)._who, (liveBy.get((r as any)._who) || 0) + 1);
      const resub = [...resubBy.entries()].map(([w, n]) => {
        const total = liveBy.get(w) || 0;
        return {
          name: nameOf.get(w) || w.split("@")[0],
          pct: total ? Number(((n / total) * 100).toFixed(1)) : 0,
          n: `${n} of ${total}`
        };
      }).sort((a, b) => b.pct - a.pct).slice(0, 6);

      details[c.key] = {
        key: c.key, name: c.name,
        useCases: c.useCases.map((u) => ({ key: u.key, name: u.name })),
        trendDaily, trendWeekly,
        stats: [
          {
            value: trendDaily.filter((x) => x.value > 0).slice(-1)[0]?.value.toFixed(2) || "—",
            delta: "", label: "latest daily average vibe", tone: "plain"
          },
          {
            value: qr.length ? `${Math.round((qr.filter((r: any) => Number(r.vibe_score) <= 2 && Number(r.vibe_score) > 0).length / qr.length) * 100)}%` : "—",
            delta: "", label: "of reviews rated 1–2", tone: "plain"
          },
          { value: String(backlogCalls.length), delta: "", label: "low-rated calls not yet issue-logged", tone: backlogCalls.length ? "warn" : "plain" },
          {
            value: vibeVsGT.overall === null ? "—" : `${vibeVsGT.overall}%`,
            delta: "", label: `of panel scores within ±1 of the expert score · ${vibeVsGT.gtCalls} GT calls`, tone: "plain"
          }
        ],
        funnel,
        funnelBacklog: { count: backlogCalls.length, oldestDays },
        issueMix, issueTrend, vibeMatrix, vibeVsGT, vibeVsPeers,
        deliveries, agents, agreement,
        transcription: {
          panel: trDaily, gt: [],
          lastCalibrated: lastExpertTr ? day(lastExpertTr) : "never",
          gtAgreement: gtN ? Math.round((gtScore / gtN) * 100) : null,
          gtSegments: gtN,
          gtCalls: gtCallSet.size
        },
        calib, flagRate, resub
      };
    }
    problems.push("Transcription GT comes from expert reviews already in the reviews table · a standing weekly calibration batch would keep it fresh.");
    problems.push("Delivery `expected` count is not recorded on import, so completeness cannot be checked.");

    const payload: OpsPayload = {
      asOf: nowIso,
      today,
      clients: clientsOut,
      reviewers: reviewersOut,
      alerts,
      checks,
      batchOptions,
      totals: {
        done: reviewersOut.reduce((s, r) => s + r.done, 0),
        assigned: reviewersOut.reduce((s, r) => s + r.assigned, 0)
      },
      details,
      problems
    };

    const res = NextResponse.json(payload);
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
