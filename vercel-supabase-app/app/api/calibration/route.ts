import { NextResponse } from "next/server";
import calibration from "../../../lib/calibration.json";

export const dynamic = "force-dynamic";

// Calibration track data — 10 real GT-graded calls (5 expert-scored vibe +
// 5 real ASR-error transcript checks), with recording URLs for real audio and
// per-call expert reasoning. Regenerated offline from reviews + judge output.
export async function GET() {
  return NextResponse.json(calibration, { headers: { "Cache-Control": "no-store" } });
}
