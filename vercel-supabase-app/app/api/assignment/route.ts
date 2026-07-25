import { NextResponse } from "next/server";
import assignment from "../../../lib/assignment.json";

export const dynamic = "force-dynamic";

// Reviewer screening assignment: 7 real judgment-heavy questions across the
// reviewer tools — transcription review (2), pronunciation audit (2), and issue
// logging (3, incl. two factual-inaccuracy calls), each from a real production
// call with audio. Real brand/city names kept: this is the reviewer-side
// training content, not client-facing analytics.
export async function GET() {
  return NextResponse.json(assignment, { headers: { "Cache-Control": "no-store" } });
}
