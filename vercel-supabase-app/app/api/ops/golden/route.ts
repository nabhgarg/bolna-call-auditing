import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// The golden transcription dataset, in the format of the file Bolna's side
// (Abhijit) shared back · one row per call:
//   call · ASR words · GOLDEN words · ASR (system) — original · GOLDEN (human)
//   — original · listen
// Transcripts are "[mm:ss] text" lines. GOLDEN prefers the expert's
// transcription of a call; otherwise the most recent panel transcription.

const PAGE = 1000;

const EXPERTS = new Set([
  "manavi@realloop.in", "manavi.garg1399@gmail.com",
  "nabh@realloop.in", "nabhgarg@gmail.com"
]);

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function wordCount(lines: { heard: string }[]): number {
  return lines.reduce((s, l) => s + l.heard.split(/\s+/).filter(Boolean).length, 0);
}

export async function GET() {
  const supabase = supabaseAdmin();

  const all = async (build: () => any) => {
    const rows: any[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await build().range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      rows.push(...(data || []));
      if (!data || data.length < PAGE) break;
    }
    return rows;
  };

  try {
    const [reviews, calls] = await Promise.all([
      all(() => supabase
        .from("reviews")
        .select("call_id,reviewer_email,reviewer_name,review_mode,issues_json,submitted_at")
        .eq("review_mode", "timing_transcription")
        .order("submitted_at", { ascending: true })),
      all(() => supabase.from("calls").select("execution_id,transcript,recording_url"))
    ]);

    const callById = new Map(calls.map((c: any) => [c.execution_id, c]));

    // pick the golden source per call: expert wins, else latest panel
    const golden = new Map<string, { segs: { ts: string; heard: string }[]; source: string; expert: boolean }>();
    for (const r of reviews) {
      const who = String(r.reviewer_email || "").toLowerCase().trim();
      const isExpert = EXPERTS.has(who) || ["manavi", "nabh"].includes(String(r.reviewer_name || "").toLowerCase().trim());
      const segs = (Array.isArray(r.issues_json) ? r.issues_json : [])
        .map((s: any) => ({ ts: String(s?.timestamp || "").trim(), heard: String(s?.audio_said || "").trim() }))
        .filter((s: any) => s.ts && s.heard && !s.heard.startsWith("("));
      if (!segs.length) continue;
      const cur = golden.get(r.call_id);
      // rows arrive oldest→newest, so overwriting keeps the latest — but never
      // let a panel row displace an expert one
      if (cur?.expert && !isExpert) continue;
      golden.set(r.call_id, {
        segs,
        source: String(r.reviewer_name || who || "panel"),
        expert: isExpert
      });
    }

    const out: string[] = [
      "call,ASR words,GOLDEN words,GOLDEN source,ASR (system) — original,GOLDEN (human) — original,listen"
    ];
    for (const [callId, g] of golden) {
      const call = callById.get(callId) || {};
      const asr = String(call.transcript || "").trim();
      const goldenText = g.segs.map((s) => `[${s.ts}] ${s.heard}`).join("\n");
      out.push([
        callId.slice(0, 8),
        asr.split(/\s+/).filter(Boolean).length,
        wordCount(g.segs),
        g.expert ? `${g.source} (expert)` : g.source,
        asr,
        goldenText,
        String(call.recording_url || "")
      ].map(csvCell).join(","));
    }

    return new Response(out.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="realloop-golden-transcriptions.csv"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (e: any) {
    return new Response(`error: ${String(e?.message || e)}`, { status: 500 });
  }
}
