import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { CHECKS, estimate } from "../../../lib/use-case-catalog";
import { isDemoRequest } from "../../../lib/demo";

export const dynamic = "force-dynamic";

// Persist a use case. Nothing is live until this is called with status "pilot"
// (the Start the 2-week pilot button); the estimate is recomputed here rather
// than trusted from the client. Graceful no-op if the table is not created yet
// (supabase/use_cases.sql).
export async function POST(request: Request) {
  let body: { description?: string; facts?: Record<string, unknown>; ids?: string[]; status?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 }); }
  const description = String(body.description || "").slice(0, 4000);
  const ids = (Array.isArray(body.ids) ? body.ids : []).filter((id) => CHECKS.some((c) => c.id === id));
  const facts = (body.facts || {}) as { callsPerWeek?: number };
  const callsPerWeek = Math.max(50, Math.min(200000, Math.round(Number(facts.callsPerWeek) || 1240)));
  const status = body.status === "pilot" ? "pilot" : "draft";
  const est = estimate(ids, callsPerWeek);

  // YC partner demo · they get the full read-back and the price, but the row
  // is never written. A use case that reached the table would be indistinguish-
  // able from a real client's pilot and would pull reviewers onto imaginary
  // work. The estimate below is the honest one · only the persistence is dropped.
  if (isDemoRequest(request)) {
    return NextResponse.json({ ok: true, id: "demo", status: "demo", estimate: est });
  }

  const supabase = supabaseAdmin();
  // Mint the id here rather than reading the row back · there is no anon select
  // policy on use_cases (a client's description is their own business), and
  // return=representation would need one, failing the write outright.
  const id = crypto.randomUUID();
  const { error } = await supabase.from("use_cases").insert({
    id,
    description,
    facts: { ...facts, callsPerWeek },
    checks: ids,
    estimate_inr: est.weeklyInr,
    status,
  });

  if (error) return NextResponse.json({ ok: false, error: error.message, estimate: est });
  return NextResponse.json({ ok: true, id, status, estimate: est });
}
