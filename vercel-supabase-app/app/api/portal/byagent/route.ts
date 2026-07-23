import { NextResponse } from "next/server";
import byagent from "../../../../lib/portal-byagent.json";

export const dynamic = "force-dynamic";

// Per-agent detail for the By-agent page (wireframe 7a): vibe stats, trend,
// daily chart, L2 rows with human/LLM split + evidence. Regenerated offline.
export async function GET() {
  return NextResponse.json(byagent, { headers: { "Cache-Control": "no-store" } });
}
