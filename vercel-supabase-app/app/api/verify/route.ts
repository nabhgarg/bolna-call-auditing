import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const email = String(payload.email || "").trim().toLowerCase();
  const code = String(payload.code || "").trim();
  if (!email || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Enter the 6-digit code from your email." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data: otp, error } = await supabase
    .from("login_otps")
    .select("id,code,expires_at,used")
    .eq("email", email)
    .eq("code", code)
    .eq("used", false)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!otp) {
    return NextResponse.json({ error: "Invalid or expired code. Try again or resend." }, { status: 401 });
  }

  await supabase.from("login_otps").update({ used: true }).eq("id", otp.id);

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
