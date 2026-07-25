import { NextResponse } from "next/server";
import { CHECKS, estimate, lineTotal, priceLabel, volumeLine } from "../../../../lib/use-case-catalog";

export const dynamic = "force-dynamic";

// Re-price on every toggle. The client sends which checks are selected; the
// server owns the arithmetic, so a tampered or stale client total never sticks.
export async function POST(request: Request) {
  let body: { ids?: string[]; callsPerWeek?: number };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  const callsPerWeek = Math.max(50, Math.min(200000, Math.round(Number(body.callsPerWeek) || 1240)));
  const ids = (Array.isArray(body.ids) ? body.ids : []).filter((id) => CHECKS.some((c) => c.id === id));
  return NextResponse.json({
    estimate: estimate(ids, callsPerWeek),
    // echo the priced shape so a newly added suggestion renders identically
    checks: ids.map((id) => {
      const c = CHECKS.find((x) => x.id === id)!;
      return {
        id: c.id, name: c.name, routing: c.routing, unit: c.unit,
        priceInr: c.priceInr, verifyInr: c.verifyInr ?? null, priceLabel: priceLabel(c),
        samplePct: c.samplePct, volumeLabel: volumeLine(c, callsPerWeek),
        weeklyInr: lineTotal(c, callsPerWeek),
        because: `${c.work}${c.laneReason ? " " + c.laneReason : ""}`,
      };
    }),
  }, { headers: { "Cache-Control": "no-store" } });
}
