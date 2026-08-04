// Daily assignment planning · the overlap design, in one place.
//
// A day's batch is not "N calls each". It is three deliberately different
// kinds of work, because each one answers a different question:
//
//   distinct (70%) · coverage. Only this reviewer sees the call, so every
//                    slot spent here buys a new call reviewed.
//   all      (15%) · the anchor set. EVERY reviewer does these same calls,
//                    which is what makes a group agreement number (and
//                    Krippendorff's alpha) meaningful — alpha needs many
//                    raters on the same unit, not many scattered pairs.
//   pairs    (15%) · pairwise overlap. Each of these is seen by exactly two
//                    reviewers, arranged in a ring so every person overlaps
//                    with two different partners. This is what catches a
//                    single reviewer drifting: the anchor set tells you the
//                    group's spread, the pairs tell you whose spread it is.
//
// The ring matters. If pair overlap were random, one unlucky reviewer could
// end up sharing with nobody twice and their personal agreement number would
// rest on too little data. A ring guarantees every reviewer has exactly two
// partners and an equal share of shared work.

export type Reviewer = { email: string; name: string };

export type SplitPct = { distinct: number; all: number; pair: number };

export type PlanRow = {
  email: string;
  name: string;
  slug: string;
  auditMode: string;
  distinct: string[];
  anchor: string[];
  pair: string[];
  total: number;
};

export type Plan = {
  perDay: number;
  split: SplitPct;
  reviewers: number;
  /** distinct calls the pool must supply */
  poolNeeded: number;
  counts: { distinct: number; anchor: number; pair: number };
  rows: PlanRow[];
  pairsWith: Record<string, string[]>;
  warnings: string[];
};

/** Reviewer tag for the audit_mode suffix.
 *
 *  First name normally · but two people on this panel are both "Muskan", and
 *  call_audit_queue is unique on (call_id, audit_mode). Two reviewers sharing
 *  a slug would silently collapse into one row on every shared call, so any
 *  collision inside the selected set is broken with the surname initial. */
export function slugsFor(reviewers: Reviewer[]): Record<string, string> {
  const local = (e: string) => String(e).split("@")[0].toLowerCase().replace(/[^a-z.]/g, "");
  const first = (e: string) => local(e).split(".")[0] || local(e);
  const seen = new Map<string, number>();
  for (const r of reviewers) seen.set(first(r.email), (seen.get(first(r.email)) || 0) + 1);

  const out: Record<string, string> = {};
  for (const r of reviewers) {
    const f = first(r.email);
    if ((seen.get(f) || 0) < 2) { out[r.email] = f; continue; }
    const rest = local(r.email).split(".").slice(1).join("");
    out[r.email] = rest ? `${f}${rest[0]}` : f;
  }
  return out;
}

/** Spread `total` across `n` buckets as evenly as possible. */
function spread(total: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(total / n);
  const extra = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Ring edges · [i, i+1] around the circle. Two reviewers share one edge
 *  rather than two, otherwise the same pair would be counted twice. */
function ringEdges(n: number): Array<[number, number]> {
  if (n < 2) return [];
  if (n === 2) return [[0, 1]];
  return Array.from({ length: n }, (_, i) => [i, (i + 1) % n] as [number, number]);
}

/** How many distinct calls a plan needs, without touching the pool. Used to
 *  show the operator the cost before anything is drawn. */
export function poolNeededFor(perDay: number, split: SplitPct, n: number): number {
  const anchor = Math.round((perDay * split.all) / 100);
  const pairQ = Math.round((perDay * split.pair) / 100);
  const uniq = Math.max(0, perDay - anchor - pairQ);
  const edges = ringEdges(n);
  const pairCalls = edges.length ? Math.round((n * pairQ) / 2) : 0;
  return (n >= 2 ? anchor : 0) + pairCalls + uniq * n + (n < 2 ? anchor + pairQ : 0);
}

/**
 * Build the day's plan from an ordered pool of free call ids.
 *
 * The pool is consumed in order, so the caller controls priority (oldest
 * first, one client, whatever) and the same pool always yields the same plan.
 * Nothing here writes: the plan is returned for the operator to approve, and
 * the approved plan is what gets committed.
 */
export function buildPlan(
  reviewers: Reviewer[],
  pool: string[],
  perDay: number,
  split: SplitPct,
  batch: string
): Plan {
  const n = reviewers.length;
  const warnings: string[] = [];
  const slugs = slugsFor(reviewers);

  let anchorN = Math.round((perDay * split.all) / 100);
  let pairQ = Math.round((perDay * split.pair) / 100);
  let uniqN = perDay - anchorN - pairQ;

  if (n < 2) {
    warnings.push("Overlap needs at least two reviewers · this batch is all distinct work, so there will be no agreement data from it.");
    uniqN = perDay; anchorN = 0; pairQ = 0;
  }
  if (uniqN < 0) {
    warnings.push("The overlap shares add up to more than 100% · distinct work has been clamped to zero.");
    uniqN = 0;
  }

  const edges = ringEdges(n);
  const pairCalls = edges.length ? Math.round((n * pairQ) / 2) : 0;
  const edgeCounts = spread(pairCalls, edges.length);

  const need = anchorN + pairCalls + uniqN * n;
  if (pool.length < need) {
    warnings.push(`The pool has ${pool.length} free calls but this plan needs ${need}. Everything below is scaled down to fit.`);
  }

  // Draw in the order that protects the measurement: the anchor set first
  // (it is what alpha is computed on), then pairs, then distinct work. If the
  // pool runs short it is coverage that shrinks, never the agreement design.
  let cur = 0;
  const take = (k: number) => pool.slice(cur, (cur += Math.max(0, k)));

  const anchor = take(anchorN);
  const edgeCalls = edgeCounts.map((k) => take(k));

  const rows: PlanRow[] = reviewers.map((r) => ({
    email: r.email, name: r.name, slug: slugs[r.email],
    auditMode: `timing_transcription::${batch}_${slugs[r.email]}`,
    distinct: [], anchor: [...anchor], pair: [], total: 0
  }));

  const pairsWith: Record<string, string[]> = {};
  edges.forEach(([a, b], i) => {
    rows[a].pair.push(...edgeCalls[i]);
    rows[b].pair.push(...edgeCalls[i]);
    (pairsWith[reviewers[a].email] ||= []).push(reviewers[b].name);
    (pairsWith[reviewers[b].email] ||= []).push(reviewers[a].name);
  });

  for (const row of rows) row.distinct = take(uniqN);
  for (const row of rows) row.total = row.distinct.length + row.anchor.length + row.pair.length;

  return {
    perDay, split, reviewers: n,
    poolNeeded: need,
    counts: { distinct: uniqN, anchor: anchorN, pair: pairQ },
    rows, pairsWith, warnings
  };
}

/** Flatten an approved plan into the rows that go into call_audit_queue. */
export function planToQueueRows(plan: Plan, sourceSheetOf: Record<string, string>) {
  const out: Array<{ call_id: string; audit_mode: string; assigned_reviewer: string; source_sheet: string; imported_at: string }> = [];
  const now = new Date().toISOString();
  for (const row of plan.rows) {
    for (const id of [...row.distinct, ...row.anchor, ...row.pair]) {
      out.push({
        call_id: id,
        audit_mode: row.auditMode,
        assigned_reviewer: row.email,
        source_sheet: sourceSheetOf[id] || "",
        imported_at: now
      });
    }
  }
  return out;
}
