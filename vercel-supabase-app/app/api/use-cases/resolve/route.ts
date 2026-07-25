import { NextResponse } from "next/server";
import { CHECKS, DEFAULT_SUGGESTION_IDS, estimate, extractLanguages, lineTotal, matchChecks, priceLabel, volumeLine, type CheckDef } from "../../../../lib/use-case-catalog";

export const dynamic = "force-dynamic";

// Resolve a plain-language description into the checks we would run.
// The model only chooses WHICH catalog checks apply and writes the "because"
// line in the client's own words; every price, sample rate and volume comes
// from the server catalog so nothing billable is model-generated.

const SYS = `You turn a client's plain-language description of their AI agent problem into the checks RealLoop would run.

Rules:
- Choose ONLY from the catalog ids given. Two to four is typical. Never choose all of them to look thorough.
- For each chosen check write "because": ONE sentence that starts by quoting the client's own words back ("Because you said the bot mishears people.", "Because order numbers and addresses come out wrong."). Use their vocabulary, not ours. Do not describe the work itself, we append that.
- Never mention metrics, rubrics, schemas, weights or thresholds.
- Order by how central each is to what they wrote.

Catalog:
${CHECKS.map((c) => `- ${c.id}: ${c.name}`).join("\n")}

Return ONLY valid JSON, no prose, no fence:
{"picks":[{"id":"<catalog id>","because":"<one sentence starting with 'Because'>"}]}`;

function serialize(c: CheckDef, because: string, callsPerWeek: number, selected: boolean) {
  return {
    id: c.id, name: c.name, routing: c.routing,
    because: `${because} ${c.work}${c.laneReason ? " " + c.laneReason : ""}`.replace(/\s+/g, " ").trim(),
    unit: c.unit, priceInr: c.priceInr, verifyInr: c.verifyInr ?? null,
    priceLabel: priceLabel(c), samplePct: c.samplePct,
    volumeLabel: volumeLine(c, callsPerWeek),
    volumePerWeek: Math.round(callsPerWeek * c.samplePct),
    weeklyInr: lineTotal(c, callsPerWeek),
    selected,
  };
}

export async function POST(request: Request) {
  let body: { description?: string; callsPerWeek?: number; docs?: { name: string; pages?: number }[] };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  const description = String(body.description || "").slice(0, 4000).trim();
  const callsPerWeek = Math.max(50, Math.min(200000, Math.round(Number(body.callsPerWeek) || 1240)));
  const docs = Array.isArray(body.docs) ? body.docs.slice(0, 5) : [];
  if (description.length < 25) return NextResponse.json({ error: "too short" }, { status: 400 });

  const facts = { callsPerWeek, languages: extractLanguages(description), docs };
  const docName = docs[0]?.name;

  let picks: { id: string; because: string }[] = [];
  const key = process.env.ANTHROPIC_API_KEY;
  if (key) {
    try {
      const r = await fetch((process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com") + "/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 600, system: SYS, messages: [{ role: "user", content: description }] }),
      });
      const d = await r.json();
      const raw = String(d?.content?.[0]?.text || "").replace(/^```(?:json)?|```$/gm, "").trim();
      const parsed = JSON.parse(raw) as { picks?: { id: string; because?: string }[] };
      picks = (parsed.picks || [])
        .filter((p) => CHECKS.some((c) => c.id === p.id))
        .map((p) => ({ id: p.id, because: String(p.because || "").slice(0, 220) }));
    } catch { /* fall through to deterministic */ }
  }
  if (!picks.length) picks = matchChecks(description).map((c) => ({ id: c.id, because: `Because of what you described.` }));

  const seen = new Set<string>();
  const checks = picks
    .filter((p) => !seen.has(p.id) && seen.add(p.id))
    .map((p) => {
      const c = CHECKS.find((x) => x.id === p.id)!;
      // the factual check names the client's own doc when they attached one
      const because = c.id === "factual" && docName ? p.because : p.because;
      const out = serialize(c, because, callsPerWeek, true);
      if (c.id === "factual" && docName) out.because = out.because.replace("your policy doc", docName);
      return out;
    });

  const chosen = new Set(checks.map((c) => c.id));
  const suggestions = CHECKS
    .filter((c) => !chosen.has(c.id) && DEFAULT_SUGGESTION_IDS.includes(c.id))
    // judge lanes bill twice (read + verify) · show the combined per-call price
    .map((c) => ({ id: c.id, name: c.name, priceInr: c.priceInr + (c.verifyInr ?? 0) }));

  return NextResponse.json({
    facts,
    checks,
    suggestions,
    estimate: estimate(checks.map((c) => c.id), callsPerWeek),
  }, { headers: { "Cache-Control": "no-store" } });
}
