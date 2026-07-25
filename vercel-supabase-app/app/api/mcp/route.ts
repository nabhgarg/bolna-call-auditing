import { NextResponse } from "next/server";
import byagent from "../../../lib/portal-byagent.json";
import reliability from "../../../lib/portal-reliability.json";
import { CHECKS, estimate, lineTotal, priceLabel, volumeLine, type Cadence } from "../../../lib/use-case-catalog";
import { resolveUseCase } from "../../../lib/resolve-use-case";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// RealLoop MCP server · streamable-HTTP transport, JSON-RPC 2.0.
//
// An already-onboarded client's engineer points their coding agent at this and
// onboards a use case for one of their own agents without opening the portal:
//
//   claude mcp add --transport http realloop \
//     https://bolna-call-auditing.vercel.app/api/mcp \
//     --header "Authorization: Bearer rl_live_..."
//
// The tools run the SAME resolver and the SAME server-side price catalog the
// portal uses, so a pipeline created from a terminal is identical to one
// created from the screen. The model never sets a price.

const PROTOCOL_VERSION = "2025-06-18";
const SERVER = { name: "realloop", title: "RealLoop", version: "1.0.0" };

/* ------------------------------------------------------------------ auth */
// REALLOOP_MCP_KEYS = "rl_live_abc:Bolna,rl_live_xyz:Acme"
function programForKey(key: string | null): { program: string; demo: boolean } | null {
  if (!key) return null;
  const table = String(process.env.REALLOOP_MCP_KEYS || "").trim();
  if (table) {
    for (const pair of table.split(",")) {
      const [k, program] = pair.split(":").map((x) => x.trim());
      if (k && k === key) return { program: program || "Bolna", demo: false };
    }
    return null;
  }
  // No key table configured · accept clearly-marked demo keys, scoped to Bolna.
  if (key.startsWith("rl_demo_") && key.length >= 16) return { program: "Bolna", demo: true };
  return null;
}
function bearer(request: Request): string | null {
  const h = request.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (m) return m[1].trim();
  // URL-only clients (claude.ai custom connectors, some IDE plugins) cannot send
  // a header, so accept ?key= as a fallback. Weaker: URLs end up in logs and
  // history, so hand these keys out per-connector and rotate them.
  try { return new URL(request.url).searchParams.get("key"); } catch { return null; }
}

/* ----------------------------------------------------------------- tools */
const TOOLS = [
  {
    name: "list_agents",
    title: "List your agents",
    description: "List the AI agents in your RealLoop program, with how many calls have been reviewed, their average human quality score, and their biggest issue. Use this first to find the agent you want to onboard a use case for.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "resolve_use_case",
    title: "Preview what we would check",
    description: "Describe in plain language what an agent must get right. Returns the checks RealLoop would run, who does each one (human panel vs machine judge), the per-unit price and the weekly estimate. This is a PREVIEW only, nothing is created.",
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Plain language: what the agent does and what goes wrong. Three or four sentences." },
        agent: { type: "string", description: "Which of your agents this is for. Optional, use list_agents to find it." },
        calls_per_week: { type: "number", description: "Weekly call volume. Defaults to the agent's observed volume." },
        cadence: { type: "string", enum: ["recurring", "one_time"], description: "Ongoing review, or a single batch. Defaults to recurring." },
      },
      required: ["description"],
      additionalProperties: false,
    },
  },
  {
    name: "create_use_case",
    title: "Onboard the use case into the pipeline",
    description: "Create the use case for real: this puts it in the RealLoop pipeline, starts panel screening on the client's own recordings, and findings begin landing in Agent insights. Call resolve_use_case first and show the human the estimate before calling this.",
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "The same plain-language description you resolved." },
        agent: { type: "string", description: "Which agent this use case is for." },
        check_ids: { type: "array", items: { type: "string" }, description: "Which checks to run. Omit to accept everything resolve_use_case recommended." },
        calls_per_week: { type: "number" },
        cadence: { type: "string", enum: ["recurring", "one_time"] },
      },
      required: ["description", "agent"],
      additionalProperties: false,
    },
  },
  {
    name: "get_reliability",
    title: "Panel reliability",
    description: "How much to trust RealLoop's numbers: how often reviewers agree with each other, and how often they match hidden expert-rated calls seeded unmarked into every batch. Optionally scoped to one agent.",
    inputSchema: {
      type: "object",
      properties: { agent: { type: "string", description: "Optional agent name." } },
      additionalProperties: false,
    },
  },
  {
    name: "get_findings",
    title: "Recent findings",
    description: "What the human panel actually caught on an agent: issue types, how many calls each affects, and playable example timestamps.",
    inputSchema: {
      type: "object",
      properties: {
        agent: { type: "string", description: "Agent name from list_agents." },
        limit: { type: "number", description: "Max issue types to return. Default 5." },
      },
      required: ["agent"],
      additionalProperties: false,
    },
  },
];

/* ------------------------------------------------------------- tool impls */
type Agent = { agent: string; calls: number; avg: number; reviewed: number; calls_with_issue: number; l2: { key: string; label: string; human_calls: number; llm_calls: number; occ: number; evidence: { call_id: string; ts: string; note: string }[] }[] };
const AGENTS = (byagent as { agents: Agent[] }).agents;

function findAgent(name?: string): Agent | undefined {
  if (!name) return undefined;
  const n = name.trim().toLowerCase();
  return AGENTS.find((a) => a.agent.toLowerCase() === n)
    || AGENTS.find((a) => a.agent.toLowerCase().includes(n))
    || AGENTS.find((a) => n.includes(a.agent.toLowerCase().split(" · ")[0]));
}

function toolListAgents(program: string) {
  const rows = AGENTS.map((a) => {
    const top = [...(a.l2 || [])].sort((x, y) => (y.human_calls + y.llm_calls) - (x.human_calls + x.llm_calls))[0];
    return { agent: a.agent, calls_reviewed: a.calls, avg_quality: a.avg, calls_with_issue: a.calls_with_issue, top_issue: top?.label || "nothing flagged" };
  });
  const text = [`${rows.length} agents in the ${program} program:`, ""]
    .concat(rows.map((r) => `· ${r.agent}\n    ${r.calls_reviewed} calls reviewed · ${r.avg_quality}/4 avg quality · ${r.calls_with_issue} with at least one issue · biggest issue: ${r.top_issue}`))
    .join("\n");
  return { text, data: { program, agents: rows } };
}

async function toolResolve(args: Record<string, unknown>) {
  const agent = findAgent(args.agent as string);
  const callsPerWeek = Number(args.calls_per_week) || (agent ? Math.max(200, agent.calls * 20) : 1240);
  const out = await resolveUseCase({
    description: String(args.description || ""),
    callsPerWeek,
    cadence: String(args.cadence || "recurring"),
  });
  if (!out) return { text: "The description is too short to resolve. Give me three or four sentences about what the agent does and what goes wrong.", data: null, isError: true };
  const per = out.facts.cadence === "recurring" ? "/ wk" : "once";
  const lines = out.checks.map((c) =>
    `· ${c.name}  [${c.routing === "human" ? "100% human" : c.routing === "judge" ? "machine judge" : "machine judge + human verified"}]  ${c.priceLabel}\n    ${c.because}\n    ${c.volumeLabel}`
  );
  const text = [
    `For "${agent?.agent || args.agent || "your agent"}" at ${out.facts.callsPerWeek.toLocaleString()} calls a week, RealLoop would run ${out.checks.length} checks:`,
    "", ...lines, "",
    `Estimate: ₹${out.estimate.weeklyInr.toLocaleString()} ${per}`,
    out.suggestions.length ? `Not included (you did not mention them): ${out.suggestions.map((s) => `${s.name} ₹${s.priceInr}`).join(", ")}` : "",
    "", "Nothing has been created. Call create_use_case to put this in the pipeline.",
  ].filter(Boolean).join("\n");
  return { text, data: { agent: agent?.agent || args.agent || null, ...out } };
}

async function toolCreate(args: Record<string, unknown>, program: string, demo: boolean) {
  const agent = findAgent(args.agent as string);
  if (!agent) {
    return { text: `I could not find an agent called "${args.agent}" in the ${program} program. Call list_agents to see the exact names.`, data: null, isError: true };
  }
  const callsPerWeek = Number(args.calls_per_week) || Math.max(200, agent.calls * 20);
  const cadence: Cadence = args.cadence === "one_time" ? "one_time" : "recurring";
  const resolved = await resolveUseCase({ description: String(args.description || ""), callsPerWeek, cadence });
  if (!resolved) return { text: "The description is too short to create a use case.", data: null, isError: true };

  const wanted = Array.isArray(args.check_ids) && (args.check_ids as string[]).length
    ? (args.check_ids as string[]).filter((id) => CHECKS.some((c) => c.id === id))
    : resolved.checks.map((c) => c.id);
  const est = estimate(wanted, callsPerWeek);

  let id: string | null = null;
  let persistNote = "";
  try {
    const supabase = supabaseAdmin();
    // Minted here, not read back · use_cases has no anon select policy by
    // design, and return=representation needs one.
    const newId = crypto.randomUUID();
    const { error } = await supabase.from("use_cases").insert({
      id: newId,
      client_id: program,
      description: String(args.description || "").slice(0, 4000),
      facts: { callsPerWeek, cadence, agent: agent.agent, languages: resolved.facts.languages, via: "mcp" },
      checks: wanted,
      estimate_inr: est.weeklyInr,
      status: "pilot",
    });
    if (error) persistNote = `NOTE: not saved to the pipeline database (${error.message}). Everything above is correct, but an operator has to confirm this one.`;
    else id = newId;
  } catch (e) {
    persistNote = `NOTE: not saved to the pipeline database (${(e as Error).message}).`;
  }

  const per = cadence === "recurring" ? "/ wk" : "once";
  const names = wanted.map((w) => CHECKS.find((c) => c.id === w)!).filter(Boolean);
  const text = [
    id ? `Created. Use case ${id} is in the ${program} pipeline for ${agent.agent}.` : `Prepared for ${agent.agent} in the ${program} pipeline.`,
    "",
    `Checks running: ${names.map((c) => c.name).join(", ")}`,
    `Volume: ${callsPerWeek.toLocaleString()} calls a week · ${cadence === "recurring" ? "ongoing" : "single batch"}`,
    `Estimate: ₹${est.weeklyInr.toLocaleString()} ${per} · billed on calls actually reviewed`,
    "",
    "What happens now:",
    "  today  we build a calibration set from this agent's own recordings and screen reviewers on it",
    "  day 3  only reviewers who match our experts get the work; the panel reliability number goes live",
    cadence === "recurring"
      ? "  day 4  first findings land in Agent insights, each with a timestamp you can play"
      : "  day 5  the batch is reviewed and the findings land in Agent insights",
    "  ongoing  expert-rated calls stay seeded unmarked so reliability keeps being checked",
    demo ? "\n(demo key · scoped to the Bolna program)" : "",
    persistNote ? "\n" + persistNote : "",
  ].filter(Boolean).join("\n");
  return { text, data: { id, program, agent: agent.agent, checks: wanted, cadence, callsPerWeek, estimate: est } };
}

function toolReliability(args: Record<string, unknown>) {
  const r = reliability as { overall: { inter_panel: number; vs_gt: number }; by_agent: { agent: string; raters: number; inter_panel: number; vs_gt: number; trust: string }[]; by_issue: { label: string; inter_panel: number; vs_gt: number }[] };
  const agent = findAgent(args.agent as string);
  if (agent) {
    const row = r.by_agent.find((x) => x.agent === agent.agent);
    if (!row) return { text: `${agent.agent} does not have enough hidden-ground-truth calls yet to publish a reliability number.`, data: { agent: agent.agent, reliability: null } };
    return {
      text: `${row.agent}: reviewers agree with each other ${row.inter_panel}% of the time, and match the hidden expert ${row.vs_gt}% of the time, across ${row.raters} reviewers per call. Trust: ${row.trust}.`,
      data: { ...row },
    };
  }
  const text = [
    `Panel reliability for the whole program:`,
    `  inter-panel   ${r.overall.inter_panel}%  (reviewers agree with each other, within 1 point)`,
    `  vs expert     ${r.overall.vs_gt}%  (reviewers match hidden expert-rated calls, within 1 point)`,
    "",
    "By activity:",
    ...r.by_issue.map((b) => `  ${b.label.padEnd(22)} ${b.inter_panel ?? "-"}% inter-panel · ${b.vs_gt ?? "-"}% vs expert`),
  ].join("\n");
  return { text, data: r };
}

function toolFindings(args: Record<string, unknown>) {
  const agent = findAgent(args.agent as string);
  if (!agent) return { text: `I could not find an agent called "${args.agent}". Call list_agents for the exact names.`, data: null, isError: true };
  const limit = Math.max(1, Math.min(10, Number(args.limit) || 5));
  const rows = [...(agent.l2 || [])]
    .filter((l) => l.human_calls + l.llm_calls > 0)
    .sort((a, b) => (b.human_calls + b.llm_calls) - (a.human_calls + a.llm_calls))
    .slice(0, limit);
  const text = [
    `${agent.agent} · ${agent.calls} calls reviewed, ${agent.calls_with_issue} had at least one issue.`,
    "",
    ...rows.map((l) => {
      const ev = (l.evidence || []).slice(0, 2).map((e) => `        ${String(e.call_id).slice(0, 8)} @${e.ts} · ${e.note}`).join("\n");
      return `· ${l.label} — ${l.human_calls + l.llm_calls} of ${agent.reviewed} calls, ${l.occ} findings\n${ev}`;
    }),
  ].join("\n");
  return { text, data: { agent: agent.agent, findings: rows } };
}

/* ------------------------------------------------------------ dispatcher */
async function callTool(name: string, args: Record<string, unknown>, program: string, demo: boolean) {
  switch (name) {
    case "list_agents": return toolListAgents(program);
    case "resolve_use_case": return await toolResolve(args);
    case "create_use_case": return await toolCreate(args, program, demo);
    case "get_reliability": return toolReliability(args);
    case "get_findings": return toolFindings(args);
    default: return null;
  }
}

const rpc = (id: unknown, result: unknown) => NextResponse.json({ jsonrpc: "2.0", id, result }, { headers: { "Cache-Control": "no-store" } });
const rpcErr = (id: unknown, code: number, message: string, status = 200) =>
  NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  let msg: { jsonrpc?: string; id?: unknown; method?: string; params?: Record<string, unknown> };
  try { msg = await request.json(); } catch { return rpcErr(null, -32700, "Parse error"); }
  const { id = null, method, params = {} } = msg || {};
  if (!method) return rpcErr(id, -32600, "Invalid request: no method");

  // handshake + liveness are open; everything else needs a key
  if (method === "initialize") {
    return rpc(id, { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER,
      instructions: "RealLoop puts screened human reviewers on your AI agent's calls. Use list_agents to find an agent, resolve_use_case to see what would be checked and what it costs, then create_use_case to put it in the pipeline. Always show the human the estimate from resolve_use_case before calling create_use_case." });
  }
  if (method === "notifications/initialized") return new NextResponse(null, { status: 202 });
  if (method === "ping") return rpc(id, {});

  const auth = programForKey(bearer(request));
  if (!auth) {
    return rpcErr(id, -32001,
      "Unauthorized. Add your RealLoop key: claude mcp add --transport http realloop <url> --header \"Authorization: Bearer rl_live_...\". Find your key in the portal under Connect.",
      401);
  }

  if (method === "tools/list") return rpc(id, { tools: TOOLS });

  if (method === "tools/call") {
    const name = String(params.name || "");
    const args = (params.arguments || {}) as Record<string, unknown>;
    if (!TOOLS.some((t) => t.name === name)) return rpcErr(id, -32602, `Unknown tool: ${name}`);
    try {
      const out = await callTool(name, args, auth.program, auth.demo);
      if (!out) return rpcErr(id, -32602, `Unknown tool: ${name}`);
      return rpc(id, {
        content: [{ type: "text", text: out.text }],
        ...(out.data ? { structuredContent: out.data as Record<string, unknown> } : {}),
        isError: Boolean((out as { isError?: boolean }).isError),
      });
    } catch (e) {
      return rpc(id, { content: [{ type: "text", text: `That failed: ${(e as Error).message}` }], isError: true });
    }
  }

  return rpcErr(id, -32601, `Method not found: ${method}`);
}

// Discovery convenience · a plain GET tells a human what this endpoint is.
export async function GET() {
  return NextResponse.json({
    server: SERVER,
    transport: "streamable-http (POST JSON-RPC 2.0)",
    protocolVersion: PROTOCOL_VERSION,
    tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
    connect: {
      claude_code: 'claude mcp add --transport http realloop <this-url> --header "Authorization: Bearer rl_live_..."',
      url_only_clients: "<this-url>?key=rl_live_...  (claude.ai custom connectors, and anything that cannot send a header)",
    },
  });
}
