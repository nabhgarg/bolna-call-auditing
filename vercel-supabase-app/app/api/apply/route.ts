import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Applications from /marketplace/join. POST creates the applicant on Apply;
// PATCH stores the assignment result. Graceful no-op (ok:false) if the
// applicants table hasn't been created yet (supabase/applicants.sql).

export async function POST(request: Request) {
  let body: any = {};
  try { body = await request.json(); } catch {}
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from("applicants").insert({
    role: String(body.role || "Reviewer").slice(0, 40),
    languages: Array.isArray(body.languages) ? body.languages.slice(0, 10).map(String) : [],
    education: String(body.education || "").slice(0, 40),
    hours_per_week: String(body.hours || "").slice(0, 20),
    phone: String(body.phone || "").slice(0, 30)
  }).select("id").single();
  if (error) return NextResponse.json({ ok: false, error: error.message });
  return NextResponse.json({ ok: true, id: data.id });
}

export async function PATCH(request: Request) {
  let body: any = {};
  try { body = await request.json(); } catch {}
  if (!body.id) return NextResponse.json({ ok: false, error: "missing id" });
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
