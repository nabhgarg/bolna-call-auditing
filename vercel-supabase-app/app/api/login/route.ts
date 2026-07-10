import { NextResponse } from "next/server";
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
      { error: "Email not recognized. Ask Smriti or Manavi to add you as a reviewer." },
      { status: 401 }
    );
  }

  return NextResponse.json({
    email: data.email,
    display_name: data.display_name,
    role: data.role || "scorer"
  });
}
