import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Returns the current role/display for an already-signed-in email so a cached
// session self-heals its role on load. Does not establish a session (OTP does that).
export async function GET(request: Request) {
  const email = String(new URL(request.url).searchParams.get("email") || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from("reviewers")
    .select("email,display_name,role,is_active")
    .eq("email", email)
    .maybeSingle();
  if (!data || data.is_active === false) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({
    email: data.email,
    display_name: data.display_name,
    role: data.role || "reviewer"
  });
}
