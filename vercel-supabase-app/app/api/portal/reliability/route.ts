import { NextResponse } from "next/server";
import reliability from "../../../../lib/portal-reliability.json";

// Reliability tab data (wireframe 22a): per-agent GT agreement, by-issue-type
// with each formula, and human-vs-LLM coverage. Rebuilt offline by
// scratchpad/build_reliability_json.py from real review data · anonymized.
export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(reliability);
}
