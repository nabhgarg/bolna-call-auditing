import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Golden-transcript dataset export: one CSV row per verified segment from
// timing_transcription submissions. ?sample=1 returns the first 25 rows.
function normText(t: unknown) {
  return String(t || "").toLowerCase().replace(/ँ/g, "ं").replace(/़/g, "").replace(/[^\w\sऀ-ॿ]/g, " ").split(/\s+/).filter(Boolean).join(" ");
}
function csvCell(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: Request) {
  const sample = new URL(request.url).searchParams.get("sample") === "1";
  const supabase = supabaseAdmin();
  const pageSize = 1000;
  let reviews: any[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("reviews")
      .select("call_id,issues_json,submitted_at")
      .eq("review_mode", "timing_transcription")
      .range(from, from + pageSize - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    reviews = reviews.concat(data || []);
    if (!data || data.length < pageSize || (sample && reviews.length > 40)) break;
  }
  const header = ["call_id", "turn", "timestamp", "asr_text", "golden_text", "verdict", "error_type", "audio_unclear"];
  const lines: string[] = [header.join(",")];
  for (const r of reviews) {
    let issues: Array<Record<string, string>> = [];
    try { issues = Array.isArray(r.issues_json) ? r.issues_json : JSON.parse(String(r.issues_json || "[]")); } catch {}
    for (const i of issues) {
      if (i.type !== "transcription") continue;
      const et = String(i.transcription_error_type || "");
      const bad = i.verdict === "wrong" || i.verdict === "missing" || et.startsWith("Wrong Transcription") || et === "Missing";
      const identical = normText(i.audio_said) === normText(i.transcripted) && normText(i.audio_said);
      lines.push([
        r.call_id, i.turn_number ?? "", i.timestamp ?? "",
        i.transcripted ?? "", i.audio_said ?? "",
        bad && !identical ? (et === "Missing" || i.verdict === "missing" ? "missing" : "wrong") : "correct",
        et || i.verdict || "", i.audio_unclear ?? ""
      ].map(csvCell).join(","));
      if (sample && lines.length > 25) break;
    }
    if (sample && lines.length > 25) break;
  }
  return new NextResponse("﻿" + lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="realloop-golden-transcripts${sample ? "-sample" : ""}.csv"`,
      "Cache-Control": "no-store"
    }
  });
}
