import { NextResponse } from "next/server";
import assignment from "../../../lib/assignment.json";

export const dynamic = "force-dynamic";

// Reviewer screening assignment: 5 real judgment-heavy questions across the two
// core reviewer tools — transcription review (3) and pronunciation audit (2),
// each from a real production call with audio. Real brand/city names kept: this
// is the reviewer-side training content, not client-facing analytics.
export async function GET() {
  return NextResponse.json(assignment, { headers: { "Cache-Control": "no-store" } });
}
