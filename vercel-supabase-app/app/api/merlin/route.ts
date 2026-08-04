import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import items from "../../../lib/merlin-items.json";

export const dynamic = "force-dynamic";

// Public review panel for the Merlin router audit (review.realloop.in/merlin).
// GET serves the blinded pairs — the unblinding key (lib/merlin-key.json) is
// deliberately never imported here, so no route can leak which side is which.
export async function GET() {
  // `db` names the Supabase host this deployment writes to — public info
  // (it's a NEXT_PUBLIC_ var), kept here because "policies exist but writes
  // fail" has once already meant "prod points at a different project".
  let db = "";
  try {
    db = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").host;
  } catch {}
  return NextResponse.json(
    { items, db },
    { headers: { "Cache-Control": "no-store" } }
  );
}

const PREFS = new Set([
  "A much better", "A slightly better", "Tie", "B slightly better", "B much better"
]);
const CONF = new Set(["Certain", "Moderate"]);
const TAGS = new Set([
  "wrong", "incomplete", "ignored-constraint", "truncated",
  "hallucinated", "format", "padding", "refused"
]);

function cleanTags(v: unknown): string {
  if (!Array.isArray(v)) return "";
  return v.filter((t) => typeof t === "string" && TAGS.has(t)).join("|");
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const reviewer = String(body.reviewer || "").trim().slice(0, 60);
  const item_id = String(body.item_id || "");
  const preference = String(body.preference || "");
  const confidence = String(body.confidence || "");
  const reason = String(body.reason || "").trim().slice(0, 500);

  const known = (items as Array<{ item_id: string }>).some((i) => i.item_id === item_id);
  if (!reviewer || !known || !PREFS.has(preference) || !CONF.has(confidence) || !reason) {
    return NextResponse.json({ error: "missing or invalid fields" }, { status: 400 });
  }

  const { error } = await supabaseAdmin()
    .from("merlin_judgments")
    .upsert(
      {
        item_id,
        reviewer,
        preference,
        confidence,
        tags_a: cleanTags(body.tags_a),
        tags_b: cleanTags(body.tags_b),
        reason
      },
      { onConflict: "reviewer,item_id" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
