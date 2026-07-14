import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Guarded maintenance endpoint: deletes review rows for the given call ids so
// those calls return to pending. Guard: must present the OTP secret.
export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const secret = String(payload.secret || "");
  const expected = process.env.OTP_SECRET || "bolna-call-audit-otp-v1-9f3k2m8x";
  if (secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const callIds = Array.isArray(payload.call_ids) ? payload.call_ids.map(String).slice(0, 2000) : [];
  if (!callIds.length) {
    return NextResponse.json({ error: "call_ids required" }, { status: 400 });
  }

  // RLS permits update but not delete, so "clearing" a review means voiding its
  // review_mode; every reader filters by the active mode and won't see it.
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("reviews")
    .update({ review_mode: "cleared" })
    .in("call_id", callIds)
    .neq("review_mode", "cleared")
    .select("id");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, cleared: (data || []).length });
}
