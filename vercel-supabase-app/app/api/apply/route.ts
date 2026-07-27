import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { isDemoRequest } from "../../../lib/demo";

export const dynamic = "force-dynamic";

// Applications from /marketplace/join. POST creates the applicant on Apply;
// PATCH stores the assignment result. Graceful no-op (ok:false) if the
// applicants table hasn't been created yet (supabase/applicants.sql).

export async function POST(request: Request) {
  let body: any = {};
  try { body = await request.json(); } catch {}
  // YC partner demo · the assignment opens exactly as it would for a real
  // applicant, but no row is created. A partner trying the flow is not applying
  // for reviewer work, and their phone number does not belong in our roster.
  if (isDemoRequest(request)) return NextResponse.json({ ok: true, id: "demo" });
  const supabase = supabaseAdmin();
  // Mint the id here instead of reading the row back. There is deliberately no
  // anon select policy on applicants (phone numbers are private), and asking
  // PostgREST to return the inserted row needs one · it fails the whole write
  // with a misleading "violates row-level security policy".
  const id = crypto.randomUUID();
  const { error } = await supabase.from("applicants").insert({
    id,
    role: String(body.role || "Reviewer").slice(0, 40),
    full_name: String(body.full_name || "").slice(0, 120),
    state: String(body.state || "").slice(0, 60),
    languages: Array.isArray(body.languages) ? body.languages.slice(0, 10).map(String) : [],
    education: String(body.education || "").slice(0, 40),
    hours_per_week: String(body.hours || "").slice(0, 20),
    phone: String(body.phone || "").slice(0, 30)
  });
  if (error) return NextResponse.json({ ok: false, error: error.message });
  return NextResponse.json({ ok: true, id });
}

export async function PATCH(request: Request) {
  let body: any = {};
  try { body = await request.json(); } catch {}
  if (!body.id) return NextResponse.json({ ok: false, error: "missing id" });
  if (isDemoRequest(request)) return NextResponse.json({ ok: true });
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("applicants").update({
    status: "assignment_done",
    assignment_score: Number(body.score) || 0,
    assignment_total: Number(body.total) || 0,
    assignment_matched: Number(body.matched) || 0,
    assignment_results: body.results ?? null,
    completed_at: new Date().toISOString()
  }).eq("id", body.id);
  if (error) return NextResponse.json({ ok: false, error: error.message });
  return NextResponse.json({ ok: true });
}
