import { NextResponse } from "next/server";
import byagent from "../../../../lib/portal-byagent.json";

export const dynamic = "force-dynamic";

// Per-agent detail for the By-agent page (wireframe 7a): vibe stats, trend,
// daily chart, L2 rows with human/LLM split + evidence. Regenerated offline.
//
// ── The denominator trap ───────────────────────────────────────────────────
// `calls` and `reviewed` are DIFFERENT UNIVERSES. `calls` is distinct calls;
// `reviewed` is review submissions, and most calls are rated by more than one
// person, so `reviewed` runs to roughly twice `calls` on the multi-rater
// agents. Every issue count in this payload · `calls_with_issue`, and
// `human_calls` / `llm_calls` on each L2 row · is denominated in REVIEWS
// despite the name saying calls. That naming has now produced the same bug
// twice: first "295 of 64 calls" (fixed in 0eb4e93 by moving the text onto
// `reviewed`), then a printed client report claiming 106% of calls carried an
// issue and 754 affected calls out of 458.
//
// Renaming the raw fields would break every existing reader, so this route
// publishes correctly-named aliases beside them and refuses to serve a figure
// that cannot be true. New code should read `reviews`, `reviews_with_issue`
// and `reviews_flagged`, and divide by `reviews`.
type L2 = { key?: string; human_calls?: number; llm_calls?: number; [k: string]: unknown };
type Agent = { agent?: string; calls?: number; reviewed?: number; calls_with_issue?: number; l2?: L2[]; [k: string]: unknown };

export async function GET() {
  const src = byagent as unknown as { generated_at?: string; agents: Agent[] };
  const problems: string[] = [];

  const agents = (src.agents || []).map((a) => {
    const calls = Number(a.calls) || 0;
    // A call is always reviewed at least once · a `reviewed` that came back
    // short would make every rate on the page overstate itself.
    const raw = Number(a.reviewed) || 0;
    if (raw < calls) problems.push(`${a.agent}: reviewed ${raw} < calls ${calls}`);
    const reviews = Math.max(raw, calls);

    const cap = (n: number, label: string) => {
      const v = Number(n) || 0;
      if (v > reviews) { problems.push(`${a.agent}: ${label} ${v} > reviews ${reviews}`); return reviews; }
      return v;
    };

    const reviewsWithIssue = cap(Number(a.calls_with_issue) || 0, "calls_with_issue");
    const l2 = (a.l2 || []).map((r) => ({
      ...r,
      reviews_flagged: cap((Number(r.human_calls) || 0) + (Number(r.llm_calls) || 0), `l2.${r.key}`)
    }));

    return {
      ...a,
      l2,
      reviews,
      reviews_with_issue: reviewsWithIssue,
      // Average people per call · the factor between the two universes, so a
      // reader can convert without having to know this comment exists.
      raters: calls ? Number((reviews / calls).toFixed(2)) : 0
    };
  });

  // Loud in the log, never in the response · a client-facing page should not
  // render a diagnostic, but a silently wrong denominator should not survive a
  // regeneration unnoticed either.
  if (problems.length) console.warn("[portal/byagent] impossible figures clamped:", problems);

  return NextResponse.json({ ...src, agents }, { headers: { "Cache-Control": "no-store" } });
}
