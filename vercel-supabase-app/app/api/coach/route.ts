import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Calibration coach — grounds a warm, concise answer in one specific call's
// context. Same role the reviewer onboarding prototype uses; wired to the real
// Claude API here (window.claude.complete equivalent).
export async function POST(request: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ text: "Coach is not configured — re-read the expert reasoning above." });
  let body: { context?: string; question?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ text: "Bad request." }, { status: 400 }); }
  const question = String(body.question || "").slice(0, 500);
  const context = String(body.context || "").slice(0, 2000);
  if (!question) return NextResponse.json({ text: "Ask a question about this call." });

  try {
    const r = await fetch((process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com") + "/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 220,
        system: "You are a warm, concise calibration coach for RealLoop, where human reviewers score AI voice-agent calls (vibe 1-4) and fix Hindi/Hinglish ASR transcripts. Answer the trainee in 2-3 short, plain sentences. Ground yourself ONLY in this call context — the expert is always right; help the trainee internalize why. Context: " + context,
        messages: [{ role: "user", content: question }]
      })
    });
    const d = await r.json();
    const text = d?.content?.[0]?.text || "Coach is unavailable right now — re-read the expert reasoning above.";
    return NextResponse.json({ text }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ text: "Coach is unavailable right now — re-read the expert reasoning above." });
  }
}
