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

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("reviews")
    .delete()
    .in("call_id", callIds)
    .select("id");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, deleted: (data || []).length });
}
