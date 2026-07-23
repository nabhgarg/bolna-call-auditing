import { NextResponse } from "next/server";
import judge from "../../../../lib/portal-judge.json";

export const dynamic = "force-dynamic";

// LLM-judge layer for the portal: aggregates from the full-corpus judge sweep
// (lib/portal-judge.json, regenerated offline from judge_full_results.jsonl).
// Judge reads the ASR transcript + telemetry — it cannot see ASR errors,
// pronunciation or tone; those remain human-only rows.
export async function GET() {
  return NextResponse.json(judge, { headers: { "Cache-Control": "no-store" } });
}
