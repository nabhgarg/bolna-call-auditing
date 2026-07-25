import { NextResponse } from "next/server";
import { CAPABILITIES, buildDesign, designProcess, type Capability, type SubTask } from "../../../lib/engine";

export const dynamic = "force-dynamic";

// The Engine · POST a plain-language task, get back the pipeline design:
// sub-tasks a screened human can do accurately, what screening proves it, and
// the process (routing, redundancy, hidden ground truth, panel size) that turns
// their work into fast accurate output.
//
// The model only MAPS the task onto capabilities we actually run (lib/engine.ts)
// and may propose at most one genuinely new sub-task, returned as novel:true so
// the UI can mark it "new capability" instead of implying we ship it today.
// No key, or any failure -> deterministic keyword decomposition, same shape.

const SYS = `You design human-review pipelines for RealLoop.

RealLoop gives AI companies on-demand access to credible human judgment: a marketplace of screened reviewers in India, plus an engine that breaks a client's task into sub-tasks reviewers can do ACCURATELY, screens for the reviewers who prove they can, and designs the process that turns their work into fast accurate output.

You will be given a client's task in plain language. Map it onto the capability library below. Rules:
- Pick ONLY the capabilities the task genuinely implies. Two to four is typical. Never pick all of them to look thorough.
- A good sub-task is small, decidable, and one judgment. If the task implies work outside the library, you may add AT MOST ONE new sub-task with "novel": true.
- Order them by how central they are to what the client said.
- For each pick, write "why" in ONE short sentence, in the client's own vocabulary, saying what it will catch for THEM. Never restate the capability's definition.
- Never invent rates, scores or lanes; those come from the library.

Capability library (key · what it is):
${CAPABILITIES.map((c) => `- ${c.key} · ${c.label}: ${c.decision}`).join("\n")}

Return ONLY valid JSON, no prose, no markdown fence:
{"picks":[{"key":"<library key>","why":"<one short sentence>"}],"novel":{"label":"<name>","decision":"<the one judgment>","why":"<why it is needed>"}|null}`;

export async function POST(request: Request) {
  let body: { task?: string; callsPerWeek?: number };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  const task = String(body.task || "").slice(0, 2000).trim();
  const callsPerWeek = Math.max(50, Math.min(100000, Number(body.callsPerWeek) || 500));
  if (task.length < 20) return NextResponse.json({ ...buildDesign("", callsPerWeek), subtasks: [], screening: [] });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json(buildDesign(task, callsPerWeek));

  try {
    const r = await fetch((process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com") + "/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 700,
        system: SYS,
        messages: [{ role: "user", content: task }],
      }),
    });
    const d = await r.json();
    const raw = String(d?.content?.[0]?.text || "").replace(/^```(?:json)?|```$/gm, "").trim();
    const parsed = JSON.parse(raw) as { picks?: { key: string; why?: string }[]; novel?: { label: string; decision: string; why: string } | null };

    const byKey = new Map(CAPABILITIES.map((c) => [c.key, c]));
    const subtasks: SubTask[] = [];
    for (const p of parsed.picks || []) {
      const cap = byKey.get(p.key);
      if (cap && !subtasks.some((s) => s.key === cap.key)) subtasks.push({ ...cap, why: String(p.why || "").slice(0, 160) });
    }
    if (parsed.novel && parsed.novel.label) {
      subtasks.push({
        key: "novel", label: String(parsed.novel.label).slice(0, 60), novel: true,
        unitOfWork: "Scoped with you before the first batch",
        decision: String(parsed.novel.decision || "").slice(0, 160),
        why: String(parsed.novel.why || "").slice(0, 160),
        unit: "review", rateInr: 0, lane: "human_only",
        laneReason: "New capability · we design the task and screening with you, then price it once throughput is measured.",
        humanScore: 0, judgeScore: null, perHour: 10,
        screening: "Designed with you during onboarding, from your own examples.",
        redundancy: 3, match: /$^/,
      } as SubTask);
    }
    if (!subtasks.length) return NextResponse.json(buildDesign(task, callsPerWeek));

    const priced = subtasks.filter((s) => !s.novel) as Capability[];
    return NextResponse.json({
      subtasks,
      screening: subtasks.map((s) => ({ capability: s.label, proves: s.screening })),
      process: designProcess(priced.length ? priced : subtasks, callsPerWeek),
      source: "engine",
    });
  } catch {
    return NextResponse.json(buildDesign(task, callsPerWeek));
  }
}
