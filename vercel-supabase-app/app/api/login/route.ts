import { NextResponse } from "next/server";
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

  // Fallback profile response used while OTP infra (table / email sender) is not ready:
  // behaves like the pre-OTP allowlist login so reviewers are never locked out.
  const directLogin = () => NextResponse.json({
    otp_required: false,
    email: data.email,
    display_name: data.display_name,
    role: data.role || "reviewer"
  });

  // simple resend throttle: refuse if a code was created in the last 60s
  const { data: recent, error: recentError } = await supabase
    .from("login_otps")
    .select("created_at")
    .eq("email", email)
    .gt("created_at", new Date(Date.now() - 60_000).toISOString())
    .limit(1);
  if (recentError) {
    return directLogin(); // table missing — OTP not set up yet
  }
  if (recent && recent.length) {
    return NextResponse.json({ ok: true, otp_required: true, note: "Code already sent — check your inbox." });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  const { error: insertError } = await supabase
    .from("login_otps")
    .insert({ email, code, expires_at: expiresAt });
  if (insertError) {
    return directLogin();
  }

  const sent = await sendOtpEmail(email, code);
  if (!sent.ok) {
    return directLogin(); // Apps Script sendOtp not deployed yet
  }

  return NextResponse.json({ ok: true, otp_required: true });
}
