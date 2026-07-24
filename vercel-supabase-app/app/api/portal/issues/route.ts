import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import machine from "../../../../lib/portal-machine.json";
import { anonAgent } from "../../../../lib/anon";

export const dynamic = "force-dynamic";

// Evidence rows for the portal drill-down (N2). Every row is a real, playable
// moment: call + timestamp + what was found + who found it.
const CANON = "https://api.bolna.ai/recordings/call/";


// spelling-tolerant comparison: a "wrong" verdict only counts as an ASR error
// if the golden text actually differs (blind-arm submissions file everything
// as wrong, including segments the reviewer heard identically)
function normText(t: string) {
  return String(t || "").toLowerCase().replace(/\u0901/g, "\u0902").replace(/\u093c/g, "").replace(/[^\w\s\u0900-\u097f]/g, " ").split(/\s+/).filter(Boolean).join(" ");
}
const BRANDS = ["GoKwik","Unicommerce","BiteSpeed","Alibaba","Visi Cooler","Snapdeal","Giva","dermaco","Derma Co","Zara","pocketly","Pocketly","Skillup","Pronto","Astrotalk","Astro-talk","Vobiz","Paytm","VAMA","Vama","Onida","Creambell","Woxsen","Kohinoor","GreenKart","Diallo","iGolf","Meera"];
function scrubText(t: string) {
  let s = String(t || "");
  for (const b of BRANDS) s = s.replace(new RegExp(b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "[brand]");
  return s.replace(/\[brand\](\s*\[brand\])+/g, "[brand]");
}
function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export async function GET(request: Request) {
  const type = new URL(request.url).searchParams.get("type") || "asr";
  const m = machine as any;

  if (type === "latency") {
    return NextResponse.json({
      type, title: "Slow responses", caught: { machine: m.latency_turns, human: 0 },
      note: `machine-detected from telemetry: response latency > 3s (${m.latency_calls} calls affected)`,
      rows: (m.latency_evidence || []).map((e: any) => ({
        call_id: e.call_id, agent: anonAgent(e.agent), ts: fmt(e.ts), ts_sec: e.ts, source: "telemetry",
        text: `bot took ${(e.latency_ms / 1000).toFixed(1)}s to respond`, recording_url: CANON + e.call_id
      }))
    }, { headers: { "Cache-Control": "no-store" } });
  }
  if (type === "bargein") {
    return NextResponse.json({
      type, title: "Barge-ins", caught: { machine: m.bargein_events, human: 0 },
      note: `machine-detected from telemetry: user interrupted the agent (${m.bargein_calls} calls affected)`,
      rows: (m.bargein_evidence || []).map((e: any) => ({
        call_id: e.call_id, agent: anonAgent(e.agent), ts: fmt(e.ts), ts_sec: e.ts, source: "telemetry",
        text: `user barged in over the agent${e.dur_ms ? ` for ${(e.dur_ms / 1000).toFixed(1)}s` : ""}`, recording_url: CANON + e.call_id
      }))
    }, { headers: { "Cache-Control": "no-store" } });
  }

  const supabase = supabaseAdmin();
  const pageSize = 1000;
  let reviews: any[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("reviews")
      .select("call_id,reviewer_name,review_mode,issues_json,submitted_at")
      .in("review_mode", ["response_vibe", "timing_transcription", "pronunciation_tone", "technical_audio"])
      .range(from, from + pageSize - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    reviews = reviews.concat(data || []);
    if (!data || data.length < pageSize) break;
  }
  const callIds = new Set<string>();
  const rows: any[] = [];
  for (const r of reviews) {
    let issues: Array<Record<string, string>> = [];
    try { issues = Array.isArray(r.issues_json) ? r.issues_json : JSON.parse(String(r.issues_json || "[]")); } catch {}
    for (const i of issues) {
      let hit = false, text = "";
      const et = String(i.transcription_error_type || "");
      const isBadTrans = i.type === "transcription" && (i.verdict === "wrong" || i.verdict === "missing" || et.startsWith("Wrong Transcription") || et === "Missing");
      if (type === "asr" && isBadTrans) {
        if (normText(i.audio_said) === normText(i.transcripted) && normText(i.audio_said)) continue;
        hit = true;
        const missing = i.verdict === "missing" || et === "Missing";
        text = missing
          ? `speech ASR missed entirely · golden: “${(i.audio_said || "").slice(0, 90)}”`
          : `ASR heard “${(i.transcripted || "").slice(0, 70)}” · golden: “${(i.audio_said || "").slice(0, 70)}”`;
      }
      if (type === "response" && i.type === "response_appropriateness") {
        hit = true; text = `${i.response_error_type || "inappropriate response"}${i.error_explanation ? ` · ${String(i.error_explanation).slice(0, 110)}` : ""}`;
      }
      const tag = String(i.content_tag || "");
      const isProper = tag === "Proper Noun" || tag === "City";
      if (type === "pronunciation" && i.type === "pronunciation" && !isProper) {
        hit = true; text = `mispronounced “${i.word_heard || "?"}”${tag ? ` (${tag})` : ""}`;
      }
      if (type === "proper_noun" && i.type === "pronunciation" && isProper) {
        hit = true; text = `missed proper noun “${i.word_heard || "?"}” (${tag})`;
      }
      if (type === "tone" && i.type === "metric_rating" && i.metric === "tone" && Number(i.rating) > 0 && Number(i.rating) <= 2) {
        hit = true; text = `tone rated ${i.rating}/5${i.reason ? ` · ${String(i.reason).slice(0, 110)}` : ""}`;
      }
      if (hit) {
        callIds.add(r.call_id);
        rows.push({ call_id: r.call_id, ts: i.timestamp || "", source: "human", text: scrubText(text), submitted_at: r.submitted_at });
      }
    }
  }
  rows.sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at)));
  const top = rows.slice(0, 150);
  // attach agent + recording for shown rows
  const ids = [...new Set(top.map((r) => r.call_id))];
  const agents = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await supabase.from("calls").select("execution_id,agent_name").in("execution_id", ids.slice(i, i + 100));
    for (const c of data || []) agents.set(c.execution_id, c.agent_name || "");
  }
  const titles: Record<string, string> = { asr: "Wrong / missing transcription", response: "Response appropriateness", pronunciation: "Pronunciation misses", proper_noun: "Proper nouns & city names", tone: "Naturalness of the call" };
  return NextResponse.json({
    type, title: titles[type] || type,
    caught: { machine: 0, human: rows.length }, calls_affected: callIds.size,
    note: "caught by trained human reviewers; every row is a playable moment",
    rows: top.map((r) => ({ ...r, agent: anonAgent(agents.get(r.call_id) || ""), recording_url: CANON + r.call_id }))
  }, { headers: { "Cache-Control": "no-store" } });
}
