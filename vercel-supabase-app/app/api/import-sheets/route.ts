import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// RETIRED (2026-07-23). Sheet -> DB import caused five separate corruption
// incidents (reverted reviewer emails, dead recording links, resurrected
// stale queues, swapped-column rows) because the Google Sheet lagged the
// database. Calls are now loaded directly into Supabase from Bolna's exports;
// the sheet only RECEIVES review syncs (one-way, DB -> sheet, via
// /api/reviews and /api/sync-sheets). If bulk ingestion UI is ever needed
// again, build it against Supabase directly — do not re-enable sheet import.
export async function POST() {
  return NextResponse.json(
    { error: "Sheet import is retired. Calls are loaded directly into Supabase; the sheet only receives review syncs." },
    { status: 410 }
  );
}
