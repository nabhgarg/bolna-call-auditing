import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Written remarks from issue logging, one row per remark, as a CSV download.
// Transcription findings are excluded · that work has its own export
// (/api/ops/golden). Grouped newest-first so "yesterday's remarks" is the top
// of the file.

const PAGE = 1000;

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const dayFilter = String(url.searchParams.get("day") || "");
  const supabase = supabaseAdmin();

  const rows: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("reviews")
      .select("call_id,reviewer_name,reviewer_email,review_mode,vibe_score,issues_json,notes,submitted_at")
      .eq("review_mode", "response_vibe")
      .order("submitted_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) return new Response(`error: ${error.message}`, { status: 500 });
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }

  const out: string[] = ["date,reviewer,call_id,vibe_score,category,timestamp,remark"];
  for (const r of rows) {
    const d = String(r.submitted_at || "").slice(0, 10);
    if (dayFilter && d !== dayFilter) continue;
    const who = String(r.reviewer_name || r.reviewer_email || "");
    const issues = Array.isArray(r.issues_json) ? r.issues_json : [];
    for (const i of issues) {
      if (!i || typeof i !== "object") continue;
      const cat = String(i.category || i.type || "");
      if (!cat || cat === "transcription" || cat === "metric_rating") continue;
      const remark = String(i.note || i.notes || i.remark || i.description || "").trim();
      const ts = String(i.timestamp || "");
      out.push([d, who, r.call_id, r.vibe_score, cat, ts, remark].map(csvCell).join(","));
    }
    // review-level written remarks travel too · they are often where the
    // reviewer actually explains the score
    const note = String(r.notes || "").trim();
    if (note) out.push([d, who, r.call_id, r.vibe_score, "overall_remark", "", note].map(csvCell).join(","));
  }

  return new Response(out.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="realloop-issue-remarks${dayFilter ? "-" + dayFilter : ""}.csv"`,
      "Cache-Control": "no-store"
    }
  });
}
