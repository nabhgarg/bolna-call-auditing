import { NextResponse } from "next/server";
import judge from "../../../../lib/portal-judge.json";

export const dynamic = "force-dynamic";

// LLM-judge layer for the portal: aggregates from the full-corpus judge sweep
// (lib/portal-judge.json, regenerated offline from judge_full_results.jsonl).
// Judge reads the ASR transcript + telemetry · it cannot see ASR errors,
// pronunciation or tone; those remain human-only rows.
// The raw per-issue `examples` carry verbatim call quotes/descriptions that can
// contain customer PII and un-scrubbed brand names, and no portal surface
// renders them (only golden_dataset + aggregate counts are used). Strip them so
// this public endpoint never returns PII.
export async function GET() {
  const j = judge as Record<string, any>;
  const issue_types = Object.fromEntries(
    Object.entries(j.issue_types || {}).map(([k, v]: [string, any]) => {
      const { examples, ...rest } = v || {};
      return [k, rest];
    })
  );
  const { orgs, flagged_calls_list, ...safe } = j;
  return NextResponse.json({ ...safe, issue_types }, { headers: { "Cache-Control": "no-store" } });
}
