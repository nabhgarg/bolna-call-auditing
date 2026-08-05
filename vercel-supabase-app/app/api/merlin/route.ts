import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import items from "../../../lib/merlin-items.json";

export const dynamic = "force-dynamic";

// Public review panel for the Merlin router audit (review.realloop.in/merlin).
// GET serves the blinded pairs — the unblinding key (lib/merlin-key.json) is
// deliberately never imported here, so no route can leak which side is which.
// With ?reviewer=<name>, also returns the item_ids that reviewer has already
// submitted, so progress resumes from the SERVER on any device or reload —
// localStorage is only a same-session cache.
export async function GET(req: Request) {
  let done: string[] = [];
  const reviewer = new URL(req.url).searchParams.get("reviewer")?.trim();
  if (reviewer) {
    const { data } = await supabaseAdmin()
      .from("merlin_judgments")
      .select("item_id")
      .eq("reviewer", reviewer);
    done = (data || []).map((r) => r.item_id);
  }
  return NextResponse.json(
    { items, done },
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

  // Insert, and on a duplicate fall back to update — NOT upsert. Upsert's
  // ON CONFLICT DO UPDATE has to read the conflicting row, which needs a
  // SELECT policy this table deliberately doesn't have (judgments are not
  // client-readable). Plain INSERT and filtered UPDATE both work under the
  // insert/update-only policies.
  const row = {
    item_id,
    reviewer,
    preference,
    confidence,
    tags_a: cleanTags(body.tags_a),
    tags_b: cleanTags(body.tags_b),
    reason
  };
  const db = supabaseAdmin();
  let { error } = await db.from("merlin_judgments").insert(row);
  if (error && error.code === "23505") {
    ({ error } = await db
      .from("merlin_judgments")
      .update(row)
      .eq("reviewer", reviewer)
      .eq("item_id", item_id));
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
