import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { sameWord } from "../../../../lib/script-match";

export const dynamic = "force-dynamic";

// Weekly reviewer report · Monday-Friday.
//
// One row per person: what they did, how fast, and how well it agreed with the
// rest of the panel. Quality figures are only reported where there is enough
// shared work to mean anything · a reviewer whose calls nobody else rated gets
// "—", never a flattering number computed from one sample.

const PAGE = 1000;
const EXPERT_IDS = new Set([
  "manavi@realloop.in", "manavi.garg1399@gmail.com",
  "nabh@realloop.in", "nabhgarg@gmail.com", "manavi", "nabh"
]);

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

/** Tiny counter · Map<string, number> with an increment that doesn't need a
 *  guard at every call site. */
class collections_Counter extends Map<string, number> {
  add(k: string, n = 1) { this.set(k, (this.get(k) || 0) + n); }
  top(n: number): Array<[string, number]> {
    return [...this.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  }
  total(): number { let s = 0; this.forEach((v) => { s += v; }); return s; }
}

const norm = (v: unknown) => String(v || "").trim().toLowerCase().replace(/\s+/g, " ");
const day = (iso: unknown) => String(iso || "").slice(0, 10);
const baseMode = (m: string) => String(m || "").split("::")[0];
const isActive = (m: string) => !baseMode(m).includes("__");

/** Monday of the week containing `d`, as YYYY-MM-DD. */
function mondayOf(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = x.getUTCDay();                 // 0=Sun
  x.setUTCDate(x.getUTCDate() - ((dow + 6) % 7));
  return x.toISOString().slice(0, 10);
}
function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function issueCats(issues: any): string[] {
  if (!Array.isArray(issues)) return [];
  return issues
    .map((i) => (i && typeof i === "object" ? String(i.category || i.type || "") : String(i)))
    .filter((c) => c && c !== "metric_rating" && c !== "transcription");
}

export const ISSUE_LABEL: Record<string, string> = {
  response_appropriateness: "Response appropriateness",
  latency: "Latency / dead air",
  pronunciation: "Pronunciation",
  tone: "Tone & naturalness",
  barge_in: "Barge-in",
  flag_for_review: "Flagged / uncodeable"
};

/** Timestamped segments keyed by their timestamp, for GT comparison. */
function segMap(r: any): Record<string, { heard: string; verdict: string }> {
  const out: Record<string, { heard: string; verdict: string }> = {};
  for (const s of (Array.isArray(r.issues_json) ? r.issues_json : [])) {
    if (!s || typeof s !== "object") continue;
    const ts = String(s.timestamp || "").trim();
    const heard = String(s.audio_said || "").trim();
    if (ts && heard) out[ts] = { heard, verdict: String(s.verdict) };
  }
  return out;
}

/** Rough text similarity · used only to ask "is this the same transcript",
 *  never to score anything a reviewer sees as a percentage on its own. */
function similar(a: string, b: string): number {
  const A = a.toLowerCase().split(/\s+/).filter(Boolean);
  const B = b.toLowerCase().split(/\s+/).filter(Boolean);
  if (!A.length || !B.length) return 0;
  let hit = 0;
  const pool = [...B];
  for (const w of A) {
    const i = pool.indexOf(w);
    if (i >= 0) { hit++; pool.splice(i, 1); }
  }
  return hit / Math.max(A.length, B.length);
}
function segsOf(r: any) {
  return (Array.isArray(r.issues_json) ? r.issues_json : [])
    .map((s: any) => ({ ts: String(s?.timestamp || "").trim(), heard: String(s?.audio_said || "").trim() }))
    .filter((s: any) => s.ts && s.heard && !s.heard.startsWith("("));
}
function wordAgreement(a: string, b: string): number {
  const A = String(a || "").trim().split(/\s+/).filter(Boolean);
  const B = String(b || "").trim().split(/\s+/).filter(Boolean);
  if (!A.length || !B.length) return 0;
  const n = Math.min(A.length, B.length);
  let hit = 0;
  for (let i = 0; i < n; i++) if (sameWord(A[i], B[i])) hit++;
  return hit / Math.max(A.length, B.length);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const now = new Date();
    // Default to the most recently COMPLETED week · on a Monday or Tuesday the
    // current week has almost nothing in it, and a report of nothing is noise.
    const thisMon = mondayOf(now);
    const dow = now.getUTCDay();
    const weekStart = url.searchParams.get("week") || (dow === 0 || dow === 1 ? addDays(thisMon, -7) : thisMon);
    const days = [0, 1, 2, 3, 4].map((i) => addDays(weekStart, i));   // Mon..Fri
    const weekEnd = days[4];
    const inWeek = new Set(days);

    const supabase = supabaseAdmin();
    const [reviews, queue, calls, reviewerRows] = await Promise.all([
      selectAll(() => supabase.from("reviews").select("call_id,reviewer_name,reviewer_email,review_mode,vibe_score,issues_json,submitted_at,duration_taken_sec")),
      selectAll(() => supabase.from("call_audit_queue").select("call_id,audit_mode,assigned_reviewer,imported_at")),
      selectAll(() => supabase.from("calls").select("execution_id,duration_sec")),
      selectAll(() => supabase.from("reviewers").select("email,display_name,role,is_active"))
    ]);

    const alias = new Map<string, string>();
    const nameOf = new Map<string, string>();
    const active = new Map<string, boolean>();
    for (const r of reviewerRows) {
      const e = norm(r.email);
      if (!e) continue;
      alias.set(e, e);
      if (r.display_name) alias.set(norm(r.display_name), e);
      nameOf.set(e, String(r.display_name || e.split("@")[0]));
      active.set(e, r.is_active !== false);
    }
    const who = (email: unknown, name: unknown) => {
      const e = norm(email);
      if (e && e.includes("@") && alias.has(e)) return alias.get(e) as string;
      return alias.get(norm(name)) || e || norm(name);
    };

    const live = reviews.filter((r: any) => r.review_mode !== "cleared");
    const cleared = reviews.filter((r: any) => r.review_mode === "cleared");
    for (const r of [...live, ...cleared]) (r as any)._who = who(r.reviewer_email, r.reviewer_name);

    // A call reviewed twice is two passes of work, so VOLUME counts every
    // submission · superseded ones included. Resubmitting voids the earlier
    // row by overwriting review_mode with "cleared", which loses the work
    // type, so it is inferred back from the row's own shape (a vibe score, or
    // segments carrying audio_said). 94% resolve; the rest count toward the
    // total without landing in a per-type column.
    //
    // QUALITY is not computed from these. Scoring someone twice on the same
    // call would weight it double, and the superseded pass is by definition
    // the one they chose to replace.
    const inferMode = (r: any): "vibe" | "transcription" | "unknown" => {
      const v = String(r.vibe_score || "").trim();
      if (/^[1-4]/.test(v)) return "vibe";
      const segs = Array.isArray(r.issues_json) ? r.issues_json : [];
      if (segs.some((s: any) => s && typeof s === "object" && s.audio_said)) return "transcription";
      if (segs.some((s: any) => s && typeof s === "object" && (s.type || s.category))) return "vibe";
      return "unknown";
    };
    const callDur = new Map(calls.map((c: any) => [c.execution_id, Number(c.duration_sec || 0)]));

    // ---- panel context for quality: consensus and shared segments ----------
    const vibeByCall = new Map<string, Map<string, number>>();
    for (const r of live) {
      if (r.review_mode !== "response_vibe") continue;
      const v = Number(String(r.vibe_score || "").trim());
      if (!(v >= 1 && v <= 4)) continue;
      if (!vibeByCall.has(r.call_id)) vibeByCall.set(r.call_id, new Map());
      (vibeByCall.get(r.call_id) as Map<string, number>).set((r as any)._who, v);
    }
    // transcription segments this week, bucketed by call@timestamp
    const segBucket = new Map<string, { who: string; heard: string }[]>();
    for (const r of live) {
      if (r.review_mode !== "timing_transcription" || !inWeek.has(day(r.submitted_at))) continue;
      for (const s of segsOf(r)) {
        const k = `${r.call_id}@${s.ts}`;
        if (!segBucket.has(k)) segBucket.set(k, []);
        (segBucket.get(k) as any[]).push({ who: (r as any)._who, heard: s.heard });
      }
    }

    // ---- ground truth · the founders' own reviews --------------------------
    // Vibe GT: mean expert score per call. Deliberately all-time, not
    // week-scoped · GT is sparse, and a reviewer with no expert overlap this
    // week would otherwise get no accuracy figure at all.
    const gtVibe = new Map<string, number[]>();
    for (const r of live) {
      if (r.review_mode !== "response_vibe" || !EXPERT_IDS.has((r as any)._who)) continue;
      const v = Number(String(r.vibe_score || "").trim());
      if (v >= 1 && v <= 4) {
        if (!gtVibe.has(r.call_id)) gtVibe.set(r.call_id, []);
        (gtVibe.get(r.call_id) as number[]).push(v);
      }
    }
    const gtMean = new Map<string, number>();
    gtVibe.forEach((v, c) => gtMean.set(c, v.reduce((s, n) => s + n, 0) / v.length));

    // Transcription GT: expert segments keyed call@timestamp
    const gtSeg = new Map<string, Record<string, { heard: string; verdict: string }>>();
    for (const r of live) {
      if (r.review_mode !== "timing_transcription" || !EXPERT_IDS.has((r as any)._who)) continue;
      const cur = gtSeg.get(r.call_id) || {};
      gtSeg.set(r.call_id, { ...cur, ...segMap(r) });
    }

    // Issue-logging peer comparison: what a co-reviewer caught on the same call
    const issueByCall = new Map<string, Map<string, Set<string>>>();
    for (const r of live) {
      if (r.review_mode !== "response_vibe") continue;
      if (!issueByCall.has(r.call_id)) issueByCall.set(r.call_id, new Map());
      (issueByCall.get(r.call_id) as Map<string, Set<string>>).set((r as any)._who, new Set(issueCats(r.issues_json)));
    }

    // ---- assigned this week -----------------------------------------------
    const assigned = new Map<string, number>();
    for (const q of queue) {
      if (!isActive(q.audit_mode)) continue;
      if (!inWeek.has(day(q.imported_at))) continue;
      const w = who(q.assigned_reviewer, q.assigned_reviewer);
      if (w) assigned.set(w, (assigned.get(w) || 0) + 1);
    }
    // still open, any batch
    const openNow = new Map<string, number>();
    const doneKey = new Set(live.map((r: any) => `${r.call_id}|${r._who}|${r.review_mode}`));
    for (const q of queue) {
      if (!isActive(q.audit_mode)) continue;
      const w = who(q.assigned_reviewer, q.assigned_reviewer);
      if (!w) continue;
      if (!doneKey.has(`${q.call_id}|${w}|${baseMode(q.audit_mode)}`)) openNow.set(w, (openNow.get(w) || 0) + 1);
    }

    // ---- per reviewer ------------------------------------------------------
    const people = new Map<string, any>();
    const touch = (w: string) => {
      if (!people.has(w)) people.set(w, {
        email: w, name: nameOf.get(w) || w.split("@")[0],
        byDay: [0, 0, 0, 0, 0], vibe: 0, issue: 0, transcription: 0, total: 0,
        secs: [] as number[], fast: 0,
        agrHit: 0, agrN: 0, devSum: 0, devN: 0, trScore: 0, trN: 0,
        resub: 0, activeDays: new Set<string>(),
        // vs ground truth
        gtHit: 0, gtN: 0, gtHigh: 0, gtLow: 0,
        gtSegN: 0, gtSegMatch: 0, gtVerdict: new collections_Counter(),
        // where transcription actually goes wrong
        noiseForSpeech: 0, speechForNoise: 0,
        shortHit: 0, shortN: 0, longHit: 0, longN: 0,
        wordsDropped: 0, wordsAdded: 0,
        gtDiffSum: 0,   // signed vibe gap · positive = they score higher than the expert
        // issue logging vs peers
        missN: 0, missCalls: new Set<string>(), missCat: new collections_Counter()
      });
      return people.get(w);
    };

    // Ground truth is sparse · an expert-rated call rarely lands in the same
    // week a reviewer worked, so a week-scoped GT figure is empty for almost
    // everyone. GT accuracy is therefore ALL-TIME and labelled that way in the
    // email; volume and peer agreement stay week-scoped.
    for (const r of live) {
      const w = (r as any)._who;
      if (!w || EXPERT_IDS.has(w)) continue;
      const p = touch(w);
      if (r.review_mode === "response_vibe") {
        const v = Number(String(r.vibe_score || "").trim());
        const g = gtMean.get(r.call_id);
        if (v >= 1 && v <= 4 && g !== undefined) {
          p.gtN++;
          const diff = v - g;
          p.gtDiffSum += diff;
          if (Math.abs(diff) <= 1) p.gtHit++;
          else if (diff > 0) p.gtHigh++;
          else p.gtLow++;
        }
      } else if (r.review_mode === "timing_transcription") {
        const g = gtSeg.get(r.call_id);
        if (g) {
          const mine = segMap(r);
          for (const [ts, gs] of Object.entries(g)) {
            const ms = mine[ts];
            if (!ms) continue;
            p.gtSegN++;
            const hit = similar(ms.heard, gs.heard) >= 0.85;
            if (hit) p.gtSegMatch++;
            if (ms.verdict !== gs.verdict) p.gtVerdict.add(`${gs.verdict}→${ms.verdict}`);

            // Short turns are easy and long ones are not · reported apart,
            // because "83%" hides that a 9-word turn is close to a coin flip.
            const gWords = gs.heard.trim().split(/\s+/).filter(Boolean);
            const mWords = ms.heard.trim().split(/\s+/).filter(Boolean);
            if (gWords.length <= 3) { p.shortN++; if (hit) p.shortHit++; }
            else { p.longN++; if (hit) p.longHit++; }

            // The noise boundary, in both directions.
            const isNoise = (t: string) => /^\{?\s*noise\s*\}?$/i.test(t.trim());
            if (isNoise(ms.heard) && !isNoise(gs.heard)) p.noiseForSpeech++;
            else if (!isNoise(ms.heard) && isNoise(gs.heard)) p.speechForNoise++;
            else if (!hit) {
              if (mWords.length < gWords.length) p.wordsDropped += gWords.length - mWords.length;
              else if (mWords.length > gWords.length) p.wordsAdded += mWords.length - gWords.length;
            }
          }
        }
      }
    }

    for (const r of live) {
      const d = day(r.submitted_at);
      if (!inWeek.has(d)) continue;
      const w = (r as any)._who;
      if (!w || EXPERT_IDS.has(w)) continue;             // founders aren't reviewers
      const p = touch(w);
      const di = days.indexOf(d);
      if (di >= 0) p.byDay[di]++;
      p.total++;
      p.activeDays.add(d);
      const took = Number(r.duration_taken_sec || 0);
      if (took > 0) {
        p.secs.push(took);
        const cd = callDur.get(r.call_id) || 0;
        if (cd > 0 && took < cd * 0.5) p.fast++;
      }
      if (r.review_mode === "timing_transcription") {
        p.transcription++;
        for (const s of segsOf(r)) {
          const others = (segBucket.get(`${r.call_id}@${s.ts}`) || []).filter((x) => x.who !== w);
          for (const o of others) { p.trN++; p.trScore += wordAgreement(s.heard, o.heard); }
        }
      } else if (r.review_mode === "response_vibe") {
        const v = Number(String(r.vibe_score || "").trim());
        if (v >= 1 && v <= 4) p.vibe++;
        if (issueCats(r.issues_json).length) p.issue++;
        // agreement + calibration against co-raters on the same call
        const m = vibeByCall.get(r.call_id);
        if (v >= 1 && v <= 4 && m && m.size >= 2) {
          let sum = 0, n = 0;
          m.forEach((ov, ow) => { if (ow !== w) { sum += ov; n++; p.agrN++; if (Math.abs(v - ov) <= 1) p.agrHit++; } });
          if (n) { p.devSum += v - sum / n; p.devN++; }
        }
        // issue logging · categories a co-reviewer logged on this call and
        // they did not. Only counted where somebody else reviewed the same
        // call, so it is a real miss rather than an unreviewed call.
        const im = issueByCall.get(r.call_id);
        if (im && im.size >= 2) {
          const mine = im.get(w) || new Set<string>();
          const others = new Set<string>();
          im.forEach((set, ow) => { if (ow !== w) set.forEach((c) => others.add(c)); });
          if (others.size) {
            p.missCalls.add(r.call_id);
            others.forEach((c) => { if (!mine.has(c)) { p.missN++; p.missCat.add(c); } });
          }
        }
      }
    }
    // Superseded passes · counted as work done, not as quality signal.
    for (const r of cleared) {
      const d = day(r.submitted_at);
      if (!inWeek.has(d)) continue;
      const w = (r as any)._who;
      if (!w || EXPERT_IDS.has(w)) continue;
      const p = touch(w);
      p.resub++;
      p.total++;
      p.activeDays.add(d);
      const di = days.indexOf(d);
      if (di >= 0) p.byDay[di]++;
      const took = Number(r.duration_taken_sec || 0);
      if (took > 0) p.secs.push(took);
      const kind = inferMode(r);
      if (kind === "transcription") p.transcription++;
      else if (kind === "vibe") p.vibe++;
    }

    const rows = [...people.values()].map((p) => {
      const secs = p.secs.slice().sort((a: number, b: number) => a - b);
      const median = secs.length ? secs[Math.floor(secs.length / 2)] : 0;
      const asg = assigned.get(p.email) || 0;
      return {
        email: p.email,
        name: p.name,
        active: active.get(p.email) !== false,
        total: p.total,
        byDay: p.byDay,
        vibe: p.vibe,
        issue: p.issue,
        transcription: p.transcription,
        activeDays: p.activeDays.size,
        assigned: asg,
        openNow: openNow.get(p.email) || 0,
        medianSec: median,
        perHour: median > 0 ? Math.round(3600 / median) : null,
        fasterThanAudio: p.fast,
        resubmissions: p.resub,
        // quality · null when there isn't enough shared work to be honest about
        agreementPct: p.agrN >= 20 ? Math.round((p.agrHit / p.agrN) * 100) : null,
        agreementN: p.agrN,
        deviation: p.devN >= 20 ? Number((p.devSum / p.devN).toFixed(2)) : null,
        transcriptionPct: p.trN >= 20 ? Math.round((p.trScore / p.trN) * 100) : null,
        transcriptionN: p.trN,
        // ---- vs ground truth ----
        gtPct: p.gtN >= 10 ? Math.round((p.gtHit / p.gtN) * 100) : null,
        gtN: p.gtN,
        gtHigh: p.gtHigh,
        gtLow: p.gtLow,
        gtSegPct: p.gtSegN >= 20 ? Math.round((p.gtSegMatch / p.gtSegN) * 100) : null,
        gtSegN: p.gtSegN,
        gtVerdict: p.gtVerdict.top(3).map(([k, n]: [string, number]) => ({ shift: k, n })),
        gtGap: p.gtN >= 10 ? Number((p.gtDiffSum / p.gtN).toFixed(2)) : null,
        noiseForSpeech: p.noiseForSpeech,
        speechForNoise: p.speechForNoise,
        shortPct: p.shortN >= 20 ? Math.round((p.shortHit / p.shortN) * 100) : null,
        shortN: p.shortN,
        longPct: p.longN >= 20 ? Math.round((p.longHit / p.longN) * 100) : null,
        longN: p.longN,
        wordsDropped: p.wordsDropped,
        wordsAdded: p.wordsAdded,
        // ---- issue logging vs peers ----
        missTotal: p.missN,
        missCalls: p.missCalls.size,
        missTop: p.missCat.top(3).map(([k, n]: [string, number]) => ({ key: k, label: ISSUE_LABEL[k] || k, n }))
      };
    }).filter((r) => r.total > 0 || r.assigned > 0)
      .sort((a, b) => b.total - a.total);

    const panel = {
      total: rows.reduce((s, r) => s + r.total, 0),
      vibe: rows.reduce((s, r) => s + r.vibe, 0),
      issue: rows.reduce((s, r) => s + r.issue, 0),
      transcription: rows.reduce((s, r) => s + r.transcription, 0),
      reviewers: rows.length
    };

    return NextResponse.json(
      { weekStart, weekEnd, days, panel, rows },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
