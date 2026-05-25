import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = supabaseAdmin();

  const { data: calls, error } = await supabase
    .from("calls")
    .select(
      "execution_id,assigned_reviewer,org_name,agent_name,duration_sec,created_at_ist,status,transcriber_language,source_sheet,reviews(id,reviewer_name)"
    )
    .order("execution_id", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const response = NextResponse.json({
    calls: (calls || []).map((call: any) => {
      const review = Array.isArray(call.reviews) ? call.reviews[0] : null;
      return {
        execution_id: call.execution_id,
        assigned_reviewer: call.assigned_reviewer,
        org_name: call.org_name,
        agent_name: call.agent_name,
        duration_sec: call.duration_sec,
        created_at_ist: call.created_at_ist,
        status: call.status,
        language: call.transcriber_language,
        source_sheet: call.source_sheet,
        reviewed: Boolean(review),
        reviewer_name: review?.reviewer_name || null
      };
    })
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
