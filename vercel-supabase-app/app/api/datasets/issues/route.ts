import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Issue-labeled dataset export: one JSONL row per human issue annotation
// (response appropriateness, pronunciation, tone) with timestamps.
export async function GET() {
  const supabase = supabaseAdmin();
  const pageSize = 1000;
  let reviews: any[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("reviews")
      .select("call_id,review_mode,issues_json,submitted_at")
      .in("review_mode", ["response_vibe", "pronunciation_tone", "technical_audio"])
      .range(from, from + pageSize - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    reviews = reviews.concat(data || []);
    if (!data || data.length < pageSize) break;
  }
  const lines: string[] = [];
  for (const r of reviews) {
    let issues: Array<Record<string, string>> = [];
    try { issues = Array.isArray(r.issues_json) ? r.issues_json : JSON.parse(String(r.issues_json || "[]")); } catch {}
    for (const i of issues) {
      if (i.type === "response_appropriateness") {
        lines.push(JSON.stringify({ call_id: r.call_id, ts: i.timestamp ?? null, l2: "response_appropriateness", subtype: i.response_error_type ?? null, explanation: i.error_explanation ?? null }));
      } else if (i.type === "pronunciation") {
        const tag = String(i.content_tag || "");
        lines.push(JSON.stringify({ call_id: r.call_id, ts: i.timestamp ?? null, l2: tag === "Proper Noun" || tag === "City" ? "proper_noun_city" : "pronunciation", word_heard: i.word_heard ?? null, content_tag: tag || null }));
      } else if (i.type === "metric_rating" && i.metric === "tone" && Number(i.rating) > 0 && Number(i.rating) <= 2) {
        lines.push(JSON.stringify({ call_id: r.call_id, ts: i.timestamp ?? null, l2: "naturalness", rating: Number(i.rating), reason: i.reason ?? null }));
      }
    }
  }
  return new NextResponse(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "application/jsonl; charset=utf-8",
      "Content-Disposition": `attachment; filename="realloop-issue-labels.jsonl"`,
      "Cache-Control": "no-store"
    }
  });
}
