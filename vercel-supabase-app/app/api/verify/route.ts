import { NextResponse } from "next/server";
import { verifyOtp } from "../../../lib/otp";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const email = String(payload.email || "").trim().toLowerCase();
  const code = String(payload.code || "").trim();
  if (!email || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Enter the 6-digit code from your email." }, { status: 400 });
  }

  if (!verifyOtp(email, code)) {
    return NextResponse.json({ error: "Invalid or expired code. Try again or resend." }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const { data: reviewer } = await supabase
    .from("reviewers")
    .select("email,display_name,role,is_active")
    .eq("email", email)
    .maybeSingle();
  if (!reviewer || reviewer.is_active === false) {
    return NextResponse.json({ error: "Email not recognised." }, { status: 401 });
  }

  return NextResponse.json({
    email: reviewer.email,
    display_name: reviewer.display_name,
    role: reviewer.role || "reviewer"
  });
}
