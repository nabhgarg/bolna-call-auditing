import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Issue-labeled dataset export: one CSV row per human issue annotation
// (response appropriateness, pronunciation, tone) with timestamps.
function csvCell(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
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
  const lines: string[] = [["call_id", "timestamp", "category", "label", "detail"].join(",")];
  for (const r of reviews) {
    let issues: Array<Record<string, string>> = [];
    try { issues = Array.isArray(r.issues_json) ? r.issues_json : JSON.parse(String(r.issues_json || "[]")); } catch {}
    for (const i of issues) {
      let row: (string | number | null)[] | null = null;
      if (i.type === "response_appropriateness") {
        row = [r.call_id, i.timestamp ?? "", "response_appropriateness", i.response_error_type ?? "", i.error_explanation ?? ""];
      } else if (i.type === "pronunciation") {
        const tag = String(i.content_tag || "");
        row = [r.call_id, i.timestamp ?? "", tag === "Proper Noun" || tag === "City" ? "proper_noun_city" : "pronunciation", tag, i.word_heard ?? ""];
      } else if (i.type === "metric_rating" && i.metric === "tone" && Number(i.rating) > 0 && Number(i.rating) <= 2) {
        row = [r.call_id, i.timestamp ?? "", "naturalness", `rating ${Number(i.rating)}`, i.reason ?? ""];
      }
      if (row) lines.push(row.map(csvCell).join(","));
    }
  }
  return new NextResponse("﻿" + lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="realloop-issue-labels.csv"`,
      "Cache-Control": "no-store"
    }
  });
}
