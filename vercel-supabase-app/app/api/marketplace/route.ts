import { NextResponse } from "next/server";
import marketplace from "../../../lib/marketplace.json";

export const dynamic = "force-dynamic";

// Marketplace supply data: real per-reviewer aggregates, anonymized to RL-xx
// codes (regenerated offline from the reviews table).
export async function GET() {
  return NextResponse.json(marketplace, { headers: { "Cache-Control": "no-store" } });
}
