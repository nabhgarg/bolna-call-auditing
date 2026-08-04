import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { buildPlan, planToQueueRows, poolNeededFor, type Reviewer, type SplitPct } from "../../../../lib/assign-plan";

export const dynamic = "force-dynamic";

// Daily assignment, run from the console instead of from a script.
//
// GET  · who can be assigned, and how much free work there is.
// POST · plan the day (default) or commit an approved plan.
//
// Committing is deliberately awkward to do by accident. It requires
// `commit: true`, it refuses a batch tag that already exists, and it
// re-checks every call against the live queue at write time · a plan built
// ten minutes ago against a pool that has since moved will fail rather than
// double-book a call. That last check is the point: the plan you approve is
// the plan that ships, or nothing ships.

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

const baseMode = (m: string) => String(m || "").split("::")[0];
const isActive = (m: string) => !baseMode(m).includes("__");
const queueTag = (m: string) => { const s = String(m || ""); return s.includes("::") ? s.slice(s.indexOf("::") + 2) : ""; };

const WORK: Record<string, string> = {
  transcription: "timing_transcription",
  quality_review: "response_vibe"
};

const isOolka = (s: unknown) => /oolka/i.test(String(s || ""));

/** The free pool for a work type.
 *
 *  Free means: no ACTIVE queue row for this base mode. A call whose only rows
 *  are __removed / __archived is genuinely free again — that is what
 *  releasing an offboarded reviewer's queue is for — so those come back into
 *  the pool rather than being written off. */
async function loadPool(mode: string, client: string) {
  const supabase = supabaseAdmin();
  const [calls, queue] = await Promise.all([
    selectAll(() => supabase.from("calls").select("execution_id,source_sheet,created_at_ist,duration_sec").order("created_at_ist", { ascending: true })),
    selectAll(() => supabase.from("call_audit_queue").select("call_id,audit_mode"))
  ]);

  const taken = new Set<string>();
  const released = new Set<string>();
  const batches = new Set<string>();
  for (const q of queue) {
    if (baseMode(q.audit_mode) !== mode && baseMode(q.audit_mode).split("__")[0] !== mode) continue;
    if (isActive(q.audit_mode)) { taken.add(q.call_id); batches.add(queueTag(q.audit_mode).split("_")[0]); }
    else released.add(q.call_id);
  }

  const free = calls.filter((c: any) => {
    if (taken.has(c.execution_id)) return false;
    if (client === "bolna" && isOolka(c.source_sheet)) return false;
    if (client === "oolka" && !isOolka(c.source_sheet)) return false;
    return true;
  });

  return {
    free,
    releasedCount: free.filter((c: any) => released.has(c.execution_id)).length,
    batches: [...batches].filter(Boolean).sort()
  };
}

async function activeReviewers(): Promise<Reviewer[]> {
  const { data, error } = await supabaseAdmin()
    .from("reviewers")
    .select("email,display_name,role,is_active")
    .eq("is_active", true);
  if (error) throw new Error(error.message);
  return (data || [])
    .filter((r: any) => r.role === "reviewer" && !/^ycdemo@/i.test(r.email))
    .map((r: any) => ({ email: r.email, name: r.display_name || r.email }))
    .sort((a: Reviewer, b: Reviewer) => a.name.localeCompare(b.name));
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const work = String(url.searchParams.get("work") || "transcription");
    const client = String(url.searchParams.get("client") || "bolna");
    const mode = WORK[work] || WORK.transcription;

    const [reviewers, pool] = await Promise.all([activeReviewers(), loadPool(mode, client)]);

    // Everyone's current open load, so the operator is not piling a hundred
    // calls onto someone who is already forty behind.
    const supabase = supabaseAdmin();
    const [queue, reviews] = await Promise.all([
      selectAll(() => supabase.from("call_audit_queue").select("call_id,audit_mode,assigned_reviewer")),
      selectAll(() => supabase.from("reviews").select("call_id,reviewer_email,review_mode"))
    ]);
    const done = new Set(reviews.map((r: any) => `${r.call_id}|${String(r.reviewer_email || "").toLowerCase()}|${r.review_mode}`));
    const open: Record<string, number> = {};
    for (const q of queue) {
      if (!isActive(q.audit_mode)) continue;
      const who = String(q.assigned_reviewer || "").toLowerCase();
      if (!done.has(`${q.call_id}|${who}|${baseMode(q.audit_mode)}`)) open[who] = (open[who] || 0) + 1;
    }

    return NextResponse.json({
      work, client, mode,
      reviewers: reviewers.map((r) => ({ ...r, open: open[r.email.toLowerCase()] || 0 })),
      pool: { free: pool.free.length, released: pool.releasedCount },
      batches: pool.batches
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const work = String(payload.work || "transcription");
    const client = String(payload.client || "bolna");
    const mode = WORK[work] || WORK.transcription;
    const perDay = Math.max(1, Math.min(500, Number(payload.perDay) || 100));
    const emails: string[] = Array.isArray(payload.reviewers) ? payload.reviewers.map((s: string) => String(s)) : [];
    const batch = String(payload.batch || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const commit = payload.commit === true;

    const split: SplitPct = {
      distinct: Number(payload.split?.distinct ?? 70),
      all: Number(payload.split?.all ?? 15),
      pair: Number(payload.split?.pair ?? 15)
    };

    if (!emails.length) return NextResponse.json({ error: "Pick at least one reviewer." }, { status: 400 });
    if (!batch) return NextResponse.json({ error: "A batch tag is required (letters and numbers, e.g. b11t)." }, { status: 400 });

    const all = await activeReviewers();
    const chosen = emails
      .map((e) => all.find((r) => r.email.toLowerCase() === e.toLowerCase()))
      .filter(Boolean) as Reviewer[];
    if (chosen.length !== emails.length) {
      return NextResponse.json({ error: "One or more selected reviewers are not active." }, { status: 400 });
    }

    const pool = await loadPool(mode, client);
    const sheetOf: Record<string, string> = {};
    for (const c of pool.free) sheetOf[c.execution_id] = c.source_sheet || "";

    const plan = buildPlan(chosen, pool.free.map((c: any) => c.execution_id), perDay, split, batch);
    const rows = planToQueueRows(plan, sheetOf);

    const summary = {
      work, client, batch, commit,
      perDay, split,
      poolFree: pool.free.length,
      poolNeeded: poolNeededFor(perDay, split, chosen.length),
      willWrite: rows.length,
      plan: {
        counts: plan.counts,
        warnings: plan.warnings,
        pairsWith: plan.pairsWith,
        rows: plan.rows.map((r) => ({
          email: r.email, name: r.name, auditMode: r.auditMode,
          distinct: r.distinct.length, anchor: r.anchor.length, pair: r.pair.length, total: r.total
        }))
      },
      // The ids travel with the preview so a commit can send back exactly
      // what was approved · never a freshly drawn set.
      assignments: rows
    };

    if (!commit) return NextResponse.json({ ...summary, dryRun: true }, { headers: { "Cache-Control": "no-store" } });

    // ---- commit path · every guard below is fail-closed ----

    const approved: typeof rows = Array.isArray(payload.assignments) && payload.assignments.length
      ? payload.assignments
      : rows;

    if (pool.batches.includes(batch)) {
      return NextResponse.json({
        error: `Batch "${batch}" already exists in the queue. Use a new tag — reusing one would add a second copy of the day's work.`
      }, { status: 409 });
    }

    // Re-check the pool as it stands right now. If anything in the approved
    // plan has been assigned since the preview was drawn, stop.
    const supabase = supabaseAdmin();
    const live = await selectAll(() => supabase.from("call_audit_queue").select("call_id,audit_mode"));
    const takenNow = new Set(
      live.filter((q: any) => baseMode(q.audit_mode) === mode && isActive(q.audit_mode)).map((q: any) => q.call_id)
    );
    const stolen = [...new Set(approved.filter((r) => takenNow.has(r.call_id)).map((r) => r.call_id))];
    if (stolen.length) {
      return NextResponse.json({
        error: `${stolen.length} call${stolen.length === 1 ? " in this plan was" : "s in this plan were"} assigned by someone else since the preview was built. Nothing was written — reload and plan again.`,
        stolen: stolen.slice(0, 10)
      }, { status: 409 });
    }

    // Insert in chunks. onConflict makes a retry after a partial failure safe:
    // a row that already landed is rewritten identically, not duplicated.
    let written = 0;
    for (let i = 0; i < approved.length; i += CHUNK) {
      const chunk = approved.slice(i, i + CHUNK);
      const { error } = await supabase
        .from("call_audit_queue")
        .upsert(chunk, { onConflict: "call_id,audit_mode" });
      if (error) {
        return NextResponse.json({
          error: `Wrote ${written} rows, then failed: ${error.message}. Re-running with the same batch tag is safe for the rows already written, but the tag guard will block it — clear the partial batch first.`,
          written
        }, { status: 500 });
      }
      written += chunk.length;
    }

    return NextResponse.json({ ...summary, dryRun: false, written, assignments: undefined },
      { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
