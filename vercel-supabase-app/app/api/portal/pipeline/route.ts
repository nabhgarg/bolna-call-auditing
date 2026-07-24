import { NextResponse } from "next/server";
import pipeline from "../../../../lib/portal-pipeline.json";

// Evaluation-design data pipeline for the reworked company portal:
// workflow funnel, issue taxonomy (design tree), LLM/human routing,
// agent-level insights, panel + ground-truth reliability.
// Rebuilt offline by scratchpad/build_pipeline_json.py · fully anonymized.
export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(pipeline);
}
