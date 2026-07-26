// Shared resolver · one brain for the portal screen and the MCP tools.
// The model only chooses WHICH catalog checks apply and writes the "because"
// line in the client's own words; every price, sample rate and volume comes
// from the server catalog, so nothing billable is model-generated.
import { CHECKS, DEFAULT_SUGGESTION_IDS, estimate, extractLanguages, lineTotal, matchChecks, priceLabel, volumeLine, type Cadence, type CheckDef } from "./use-case-catalog";

const SYS = `You turn a client's plain-language description of their AI agent problem into the checks RealLoop would run.

Rules:
- Choose ONLY from the catalog ids given. At most TWO. Most descriptions need exactly one, and many need both.
- "transcription" covers everything heard-or-captured wrong: misheard speech, and values the bot registered wrongly (numbers, names, addresses, quantity, size, payment method). It is ONE check, do not try to split it.
- For each chosen check write "because": ONE sentence that starts by quoting the client's own words back ("Because you said the bot mishears people.", "Because order numbers and addresses come out wrong."). Use their vocabulary, not ours. Do not describe the work itself, we append that.
- For each chosen check also return "quote": the EXACT substring of the client's message (max ~12 words, copied verbatim, no paraphrase) that made you pick it. If no clean substring exists, use null.
- Never mention metrics, rubrics, schemas, weights or thresholds.
- The agent giving a wrong answer about a policy, refund, price or product is "factual" (checked against their document). "compliance" is only for mandatory script lines that must be read out (disclosures, consent).
- Order by how central each is to what they wrote.

Catalog:
${CHECKS.map((c) => `- ${c.id}: ${c.name}`).join("\n")}

Return ONLY valid JSON, no prose, no fence:
{"picks":[{"id":"<catalog id>","because":"<one sentence starting with 'Because'>","quote":"<exact substring or null>"}]}`;

function serialize(c: CheckDef, because: string, callsPerWeek: number, selected: boolean, cadence: Cadence, quote: string | null) {
  return {
    id: c.id, name: c.name, routing: c.routing,
    // the card shows why we picked it and what the reviewer does · the lane
    // rationale is carried separately so the card stays two sentences
    because: `${because} ${c.work}`.replace(/\s+/g, " ").trim(),
    laneNote: c.laneReason || null,
    quote,
    unit: c.unit, priceInr: c.priceInr, verifyInr: c.verifyInr ?? null,
    priceLabel: priceLabel(c), samplePct: c.samplePct,
    volumeLabel: volumeLine(c, callsPerWeek, cadence),
    volumePerWeek: Math.round(callsPerWeek * c.samplePct),
    weeklyInr: lineTotal(c, callsPerWeek),
    selected,
  };
}

export type ResolveInput = { description: string; callsPerWeek?: number; docs?: { name: string; pages?: number }[]; cadence?: string };

export async function resolveUseCase(input: ResolveInput) {
  const description = String(input.description || "").slice(0, 4000).trim();
  const callsPerWeek = Math.max(50, Math.min(200000, Math.round(Number(input.callsPerWeek) || 1240)));
  const docs = Array.isArray(input.docs) ? input.docs.slice(0, 5) : [];
  const cadence: Cadence = input.cadence === "one_time" ? "one_time" : "recurring";
  if (description.length < 25) return null;

  const facts = { callsPerWeek, languages: extractLanguages(description), docs };
  const docName = docs[0]?.name;

  let picks: { id: string; because: string; quote?: string | null }[] = [];
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
      const parsed = JSON.parse(raw) as { picks?: { id: string; because?: string; quote?: string | null }[] };
      picks = (parsed.picks || [])
        .filter((p) => CHECKS.some((c) => c.id === p.id))
        .map((p) => {
          // a highlight is only honest if it is literally their text
          let quote = String(p.quote || "").trim();
          if (!quote || quote.length < 6 || !description.toLowerCase().includes(quote.toLowerCase())) quote = "";
          return { id: p.id, because: String(p.because || "").slice(0, 220), quote: quote || null };
        });
    } catch { /* fall through to deterministic */ }
  }
  if (!picks.length) picks = matchChecks(description).map((c) => ({ id: c.id, because: `Because of what you described.`, quote: null }));

  // The plan recommends at most these two · everything else is an add-on the
  // client opts into, so the first screen stays a decision rather than a menu.
  const RECOMMENDABLE = ["transcription", "factual"];
  const seen = new Set<string>();
  const checks = picks
    .filter((p) => RECOMMENDABLE.includes(p.id))
    .filter((p) => !seen.has(p.id) && seen.add(p.id))
    .map((p) => {
      const c = CHECKS.find((x) => x.id === p.id)!;
      const out = serialize(c, p.because, callsPerWeek, true, cadence, p.quote ?? null);
      if (c.id === "factual" && docName) out.because = out.because.replace("your policy doc", docName);
      return out;
    });

  const chosen = new Set(checks.map((c) => c.id));
  const suggestions = CHECKS
    .filter((c) => !chosen.has(c.id) && c.id !== "transcription" && c.id !== "factual")
    // judge lanes bill twice (read + verify) · show the combined per-call price
    .map((c) => ({ id: c.id, name: c.name, priceInr: c.priceInr + (c.verifyInr ?? 0) }));

  return {
    facts: { ...facts, cadence },
    checks,
    suggestions,
    estimate: estimate(checks.map((c) => c.id), callsPerWeek),
  };
}
