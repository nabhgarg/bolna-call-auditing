import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import machine from "../../../lib/portal-machine.json";

export const dynamic = "force-dynamic";

// Data for the client portal (N1). Split of issues by WHO caught them:
//   machine · deterministic from Bolna telemetry (precomputed in
//   lib/portal-machine.json with method + timestamp; regenerate offline)
//   human   · logged by reviewers (issues_json) and the transcription
//   workbench (segments where the golden text differs from ASR)
const EXPERTS = ["nabh", "manavi"];

function normText(t: unknown) {
  return String(t || "").toLowerCase().replace(/\u0901/g, "\u0902").replace(/\u093c/g, "").replace(/[^\w\s\u0900-\u097f]/g, " ").split(/\s+/).filter(Boolean).join(" ");
}

async function fetchAll<T>(fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: any }>) {
  const pageSize = 1000;
  let rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    rows = rows.concat(data || []);
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

export async function GET() {
  const supabase = supabaseAdmin();
  const reviews = await fetchAll<{ reviewer_name: string; call_id: string; review_mode: string; vibe_score: string; issues_json: unknown }>(
    async (from, to) => await supabase.from("reviews").select("reviewer_name,call_id,review_mode,vibe_score,issues_json").in("review_mode", ["response_vibe", "timing_transcription", "pronunciation_tone", "technical_audio"]).range(from, to)
  );

  const human = { asr_transcription: 0, response_appropriateness: 0, pronunciation: 0, naturalness_tone: 0 };
  const vibesByCall = new Map<string, number[]>();
  const expertByCall = new Map<string, number>();
  const issueLoggedCalls = new Set<string>();

  for (const r of reviews) {
    const isExpert = EXPERTS.some((e) => (r.reviewer_name || "").toLowerCase().includes(e));
    let issues: Array<Record<string, string>> = [];
    try { issues = Array.isArray(r.issues_json) ? (r.issues_json as any) : JSON.parse(String(r.issues_json || "[]")); } catch {}
    for (const i of issues) {
      const t = i.type || "";
      if (r.review_mode === "timing_transcription") {
        // golden workbench: a human found the ASR wrong or missing speech
        if (t === "transcription" && (i.verdict === "wrong" || i.verdict === "missing")) {
          if (!(i.verdict === "wrong" && normText(i.audio_said) === normText(i.transcripted))) human.asr_transcription += 1;
        }
      } else {
        if (t === "response_appropriateness") { human.response_appropriateness += 1; issueLoggedCalls.add(r.call_id); }
        if (t === "pronunciation") { human.pronunciation += 1; issueLoggedCalls.add(r.call_id); }
        // tone flags live in metric ratings across the older modes too
        if (t === "metric_rating" && i.metric === "tone" && Number(i.rating) > 0 && Number(i.rating) <= 2) { human.naturalness_tone += 1; issueLoggedCalls.add(r.call_id); }
      }
    }
    const s = Number(r.vibe_score);
    if (r.review_mode === "response_vibe" && Number.isFinite(s) && s > 0) {
      if (isExpert) expertByCall.set(r.call_id, s);
      else {
        if (!vibesByCall.has(r.call_id)) vibesByCall.set(r.call_id, []);
        (vibesByCall.get(r.call_id) as number[]).push(s);
      }
    }
  }

  let panelScored = 0, lowRated = 0;
  vibesByCall.forEach((scores, callId) => {
    if (scores.length >= 3) {
      panelScored += 1;
      const sorted = [...scores].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const expert = expertByCall.get(callId);
      if (median <= 2 || (expert !== undefined && expert <= 2)) lowRated += 1;
    }
  });

  const { count: totalCalls } = await supabase.from("calls").select("execution_id", { count: "exact", head: true });
  const { count: telemetryCalls } = await supabase.from("calls").select("execution_id", { count: "exact", head: true }).not("telemetry_json", "is", null);

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    corpus: { total_calls: totalCalls || 0, telemetry_calls: telemetryCalls || 0 },
    funnel: { panel_scored: panelScored, low_rated: lowRated, issue_logged_calls: issueLoggedCalls.size },
    human,
    machine: {
      latency_calls: (machine as any).latency_calls, latency_turns: (machine as any).latency_turns,
      bargein_calls: (machine as any).bargein_calls, bargein_events: (machine as any).bargein_events,
      basis_calls: (machine as any).calls, method: (machine as any).method, computed_at: (machine as any).generated_at
    }
  }, { headers: { "Cache-Control": "no-store" } });
}
