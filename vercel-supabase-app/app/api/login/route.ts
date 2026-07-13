import { NextResponse } from "next/server";
import { currentOtp } from "../../../lib/otp";
import { sendOtpEmail } from "../../../lib/sheetsSync";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const email = String(payload.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("reviewers")
    .select("email,display_name,role,is_active")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data || data.is_active === false) {
    return NextResponse.json(
      { error: "Email not recognised. Ask Nabh or Manavi to add you as a reviewer." },
      { status: 401 }
    );
  }

  const sent = await sendOtpEmail(email, currentOtp(email));
  if (!sent.ok) {
    // Email delivery unavailable — fall back to direct allowlist login so
    // reviewers are never locked out by an email outage.
    return NextResponse.json({
      otp_required: false,
      email: data.email,
      display_name: data.display_name,
      role: data.role || "reviewer"
    });
  }

  return NextResponse.json({ ok: true, otp_required: true });
}
