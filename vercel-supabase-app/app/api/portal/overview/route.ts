import { NextResponse } from "next/server";
import overview from "../../../../lib/portal-overview.json";

export const dynamic = "force-dynamic";

// Overview data · rubric-backwards: human-identified L2 counts, VBL spotlight,
// agent vibe table, hidden-GT trust comparison. Regenerated offline.
export async function GET() {
  return NextResponse.json(overview, { headers: { "Cache-Control": "no-store" } });
}
