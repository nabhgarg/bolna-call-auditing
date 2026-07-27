import { NextResponse } from "next/server";
import { parseTurns } from "../../../../lib/audit";
import { extractAnchors } from "../../../../lib/telemetry";
import { isDemoRequest, DEMO_CALL_LABELS } from "../../../../lib/demo";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const supabase = supabaseAdmin();
  const { data: call, error } = await supabase
    .from("calls")
    .select("*")
    .eq("execution_id", params.id)
    .single();

  if (error || !call) {
    return NextResponse.json({ error: error?.message || "Call not found" }, { status: 404 });
  }

  const { data: reviews, error: reviewError } = await supabase
    .from("reviews")
    .select("*")
    .eq("call_id", params.id)
    .order("submitted_at", { ascending: false });

  if (reviewError) {
    return NextResponse.json({ error: reviewError.message }, { status: 500 });
  }

  // Demo · this response is spread wholesale into the workbench, so it carries
  // the client's identity in org_name/agent_name and other reviewers' names and
  // emails in `reviews`. The workbench needs none of that to be usable: the
  // agent line becomes the archetype label, and prior reviews are withheld
  // rather than shown to someone outside the company.
  const demo = isDemoRequest(request);
  return NextResponse.json({
    ...call,
    ...(demo ? { org_name: null, agent_name: DEMO_CALL_LABELS[params.id] || null } : {}),
    telemetry_json: undefined, // raw blob is large; anchors carry what the client needs
    turn_anchors: extractAnchors((call as Record<string, unknown>).telemetry_json),
    turns: parseTurns(call.transcript || ""),
    reviews: demo ? [] : (reviews || [])
  });
}
