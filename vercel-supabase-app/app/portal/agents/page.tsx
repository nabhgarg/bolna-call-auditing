"use client";

import React, { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Space_Grotesk, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import PortalShell from "../shell";
import { INK, MUT, GREEN, RED, AMBER, card } from "../../../lib/ui";
import TRANSCRIPTS from "../../../lib/portal-transcripts.json";
import RELIABILITY from "../../../lib/portal-reliability.json";
import PATTERNS from "../../../lib/portal-patterns.json";
import INSIGHTS from "../../../lib/portal-insights.json";
import { isPortalUser } from "../../../lib/role";
import DemoReady from "../../../lib/DemoReady";
import ReportPrint from "./report";
import { isDemo } from "../../../lib/demo";

// Agent insights · Overall + By-agent MERGED into one master-detail screen
// (wireframe 19a / 20a + philosophy 21a). Left: agents ranked by how much
// they need attention, each with a plain-words verdict. Right: the selected
// agent, led by "what to fix" (root cause first, playable), then no-nonsense
// metrics, then the issue rows (human review only) with timestamped evidence.
// Philosophy honored: verdict first · every number is playable · root cause
// over volume · green = human, purple = machine.
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"] });

const CANON = "https://api.bolna.ai/recordings/call/";

type L2 = { key: string; label: string; human_calls: number; llm_calls: number; occ: number; evidence: any[]; subtypes: [string, number][] };
type Agent = { agent: string; avg: number; dist: number[]; calls: number; avg_raters: number; reviewed: number; calls_with_issue: number; bad_pct: number; trend: { first: number; last: number }; daily: any[]; l2: L2[]; fixes: { title: string; count: number }[] };

const L2_ISSUE_ROUTE: Record<string, string> = { transcription: "asr", response: "response", naturalness: "tone", proper_noun: "proper_noun", pronunciation: "pronunciation" };

// The four agents carrying 170+ human reviews each · see the `agents` memo.
const DEEP_AGENTS = [
  "Cart Recovery · E-commerce B",
  "Seller Activation · B2B Marketplace",
  "Cart Recovery · E-commerce A",
  "Cart Recovery · Marketplace",
];

// Verdict: the issue the panel flagged on the most of this agent's calls.
//
// This used to rank by lift over the fleet baseline · "what makes THIS agent
// unusual" · which worked when the page listed ten agents with genuinely
// different profiles. Now that it lists the four deep ones, they all break the
// same way, so nothing has lift and a rare issue won the headline by being
// rare: E-commerce B led with "pronunciation misses · 3 findings across 2
// calls" while the chart directly underneath showed transcription at 306
// findings across 69. Volume is the honest ranking here, and it agrees with
// what the client reads next.
function verdictFor(a: Agent, _fleetRate: Record<string, number>) {
  // agents whose calls the panel has re-transcribed word-by-word lead with
  // transcription · that IS their story, and the golden pairs prove it below
  const gt = (TRANSCRIPTS.agents as any[]).find((x) => x.agent === a.agent && x.pairs?.length);
  if (gt) {
    const r = (a.l2 || []).find((x) => x.key === "transcription") || null;
    return { label: "ASR mishears input", key: "transcription", row: r };
  }
  let best: { key: string; lift: number; calls: number; row: L2 } | null = null;
  for (const r of a.l2 || []) {
    const affected = r.human_calls;   // human review only · the machine judge stays internal
    if (affected < 2 || a.calls < 1 || r.occ < 1) continue;
    if (!best || affected > best.calls) best = { key: r.key, lift: 0, calls: affected, row: r };
  }
  if (!best) return { label: "clean", key: "", row: null as L2 | null };
  const r = best.row;
  if (best.key === "transcription") return { label: "ASR mishears input", key: "transcription", row: r };
  if (best.key === "pronunciation") return { label: "pronunciation misses", key: "pronunciation", row: r };
  if (best.key === "proper_noun") return { label: "proper nouns misheard", key: "proper_noun", row: r };
  if (best.key === "naturalness") return { label: "tone drifts", key: "naturalness", row: r };
  // response: name it by the leading subtype
  const top = (r.subtypes && r.subtypes[0] && r.subtypes[0][0] || "").toLowerCase();
  let label = "wrong responses";
  if (/repeat|loop|stuck/.test(top)) label = "repetition loops";
  else if (/input capture/.test(top)) label = "input capture misses";
  else if (/language/.test(top)) label = "language switching";
  else if (/context|rule|instruction|navigation/.test(top)) label = "instruction not followed";
  else if (/irrelevant|wrong|hallucinat|factual/.test(top)) label = "wrong responses";
  return { label, key: "response", row: r };
}

function Inner() {
  const params = useSearchParams();
  const [data, setData] = useState<{ agents: Agent[] } | null>(null);
  const [sel, setSel] = useState(0);
  const [open, setOpen] = useState<string>(params.get("l2") || "");
  const [allowed, setAllowed] = useState<boolean | null>(null);
  // read after mount, never during render · the server has no window and a
  // mismatch here would blow up hydration
  const [demo, setDemo] = useState(false);
  // Only used by the printed report · the screen never shows these figures, so
  // a failed fetch degrades the report's method note rather than the page.
  const [panelRel, setPanelRel] = useState<{ inter_panel: number; vs_gt: number; calls: number } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setAllowed(isPortalUser());
    setDemo(isDemo());
    fetch("/api/portal/reliability").then((r) => r.json()).then((d) => setPanelRel(d?.overall || null)).catch(() => {});
    fetch("/api/portal/byagent").then((r) => r.json()).then((d) => {
      setData(d);
      const want = params.get("agent");
      if (want && d?.agents) {
        const i = d.agents.findIndex((x: Agent) => String(x.agent).toLowerCase().includes(want.toLowerCase()));
        if (i >= 0) setSel(i);
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only the agents with enough human review to stand behind. The other six in
  // the feed rest on 11-18 calls from a single rater, and there are no
  // unreviewed calls left to deepen them · showing a hard score on 14 calls
  // would undercut the reliability this portal is selling. Falls back to the
  // highest-reviewed agents if the archetype labels drift upstream.
  const agents = useMemo(() => {
    const all = data?.agents || [];
    const picked = DEEP_AGENTS.map((n) => all.find((x) => x.agent === n)).filter(Boolean) as Agent[];
    if (picked.length >= 4) return picked;
    const rest = all.filter((a) => !picked.includes(a)).sort((a, b) => (b.reviewed || 0) - (a.reviewed || 0));
    return [...picked, ...rest].slice(0, 4);
  }, [data]);

  // fleet baseline rate per L2 (mean calls-affected / calls across agents)
  const fleetRate = useMemo(() => {
    const acc: Record<string, { s: number; n: number }> = {};
    for (const a of agents) for (const r of a.l2 || []) {
      const k = r.key; if (!acc[k]) acc[k] = { s: 0, n: 0 };
      acc[k].s += r.human_calls / Math.max(1, a.calls); acc[k].n += 1;   // human only
    }
    const out: Record<string, number> = {};
    for (const k in acc) out[k] = acc[k].s / Math.max(1, acc[k].n);
    return out;
  }, [agents]);

  // rank: needs-attention (avg<=2.9) worst-first, then healthy best-first
  const ranked = useMemo(() => {
    const idx = agents.map((a, i) => ({ a, i, v: verdictFor(a, fleetRate) }));
    const needs = idx.filter((x) => x.a.avg <= 2.9).sort((x, y) => x.a.avg - y.a.avg);
    const healthy = idx.filter((x) => x.a.avg > 2.9).sort((x, y) => y.a.avg - x.a.avg);
    return { needs, healthy };
  }, [agents, fleetRate]);

  if (allowed === false) return <main className={instrument.className} style={{ maxWidth: 560, margin: "80px auto", textAlign: "center", color: MUT }}>The portal is available to your team. <a href="/portal/login?next=/portal/agents" style={{ color: GREEN }}>Log in</a> to see this program, or <a href="/portal/new-use-case" style={{ color: GREEN }}>start a use case</a>.</main>;
  if (!data) return <main className={instrument.className} style={{ maxWidth: 560, margin: "80px auto", textAlign: "center", color: MUT }}>Loading agent insights…</main>;

  const a = agents[Math.min(sel, agents.length - 1)] || ({} as Agent);
  const v = verdictFor(a, fleetRate);
  const needsAttention = a.avg <= 2.9;
  const totalCalls = agents.reduce((s, x) => s + (x.calls || 0), 0);
  const scoreColor = (x: number) => x <= 2.5 ? RED : x <= 2.9 ? AMBER : GREEN;

  function play(callId: string, ts: string) {
    const el = audioRef.current; if (!el) return;
    el.src = `/api/audio?url=${encodeURIComponent(CANON + callId)}`;
    const [m2, s2] = String(ts || "0:0").split(":");
    const go = () => { try { el.currentTime = Math.max(0, Number(m2) * 60 + Number(s2 || 0) - 2); } catch {} el.play().catch(() => {}); };
    if (el.readyState >= 1) go(); else el.addEventListener("loadedmetadata", go, { once: true });
  }

  // what-to-fix: root cause first. Item 1 from the distinctive issue + its top
  // subtype; item 2 from the next-biggest response subtype (the fixes list).
  const leadRow = v.row;
  const leadEvidence = (leadRow?.evidence || [])[0];
  const fixes = a.fixes || [];
  const secondFix = fixes.find((f) => !new RegExp((leadRow?.subtypes?.[0]?.[0] || "###").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(f.title)) || fixes[1];
  const leadCount = leadRow?.subtypes?.[0]?.[1] ?? leadRow?.occ ?? 0;
  const leadSub = leadRow?.subtypes?.[0]?.[0] || "";
  const isRootCause = v.key === "transcription";
  const goldenT = (TRANSCRIPTS.agents as any[]).find((x) => x.agent === a.agent && x.pairs?.length);
  const rel = (RELIABILITY.by_agent as any[]).find((x) => x.agent === a.agent) || null;
  // how the leading issue actually goes wrong · clustered from this agent's own
  // panel corrections (lib/portal-patterns.json)
  const patterns = (PATTERNS.agents as Record<string, any>)[a.agent] || null;
  // outcome-level findings · only written for agents we have rules for
  const insights = (INSIGHTS.agents as Record<string, any>)[a.agent] || null;
  // how much of the list traces to the lead issue · human review only
  const leadCalls = leadRow ? leadRow.human_calls : 0;

  const AgentRow = ({ x, i, verd, best }: { x: Agent; i: number; verd: ReturnType<typeof verdictFor>; best?: boolean }) => {
    const active = i === sel;
    return (
      <button onClick={() => { setSel(i); setOpen(""); }} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", background: active ? "#eef4f1" : "transparent", border: active ? `1px solid #cde8db` : "1px solid transparent", borderLeft: active ? `3px solid ${GREEN}` : "3px solid transparent", borderRadius: 10, padding: "9px 11px", cursor: "pointer", color: INK }}>
        <span className={grotesk.className} style={{ fontSize: 17, fontWeight: 600, color: scoreColor(x.avg), width: 30, flex: "none" }}>{x.avg}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.agent}</span>
          <span style={{ display: "block", fontSize: 11, color: verd.key ? (x.avg <= 2.9 ? "#b5555a" : MUT) : GREEN, marginTop: 1 }}>
            {best ? "best · " : ""}{verd.key ? `${verd.label} · ${x.calls} calls` : `clean · ${x.calls} calls`}
          </span>
        </span>
        <span style={{ color: MUT, fontSize: 11, flex: "none" }}>{active ? "▾" : "›"}</span>
      </button>
    );
  };

  return (
    <PortalShell right={
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", borderBottom: "1px solid #e2e8ee", padding: "11px 22px", flexWrap: "wrap" }}>
        <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>Agent insights</span>
        <span style={{ fontSize: 12.5, color: MUT }}>{agents.length} agents · deepest coverage · ranked by how much they need attention · {totalCalls.toLocaleString()} calls</span>
        {/* YC partners are looking at a real program, not a mockup · say whose */}
        {demo && <span style={{ fontSize: 11.5, fontWeight: 600, color: "#b07a15", background: "#faf3e3", borderRadius: 999, padding: "4px 11px" }}>This is based on what we have done for Bolna</span>}
        <span style={{ flex: 1 }} />
        <button onClick={() => window.print()} style={{ fontWeight: 600, fontSize: 13, color: "#fff", background: GREEN, border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>Download report</button>
      </div>
    }>
      <ReportPrint agents={agents as never} reliability={panelRel} program="Bolna" verdictLabel={(x) => verdictFor(x as never, fleetRate).label} />
      <div className={`screen-only ${instrument.className}`} style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, padding: "16px 22px 28px", alignItems: "start" }}>
        <DemoReady ready={agents.length > 0} />
        <audio ref={audioRef} style={{ display: "none" }} />

        {/* LEFT · ranked agent list */}
        <div style={{ ...card, padding: 10, position: "sticky", top: 16, display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: RED, textTransform: "uppercase", letterSpacing: 0.6, padding: "4px 11px 3px" }}>Needs attention · {ranked.needs.length}</div>
          {ranked.needs.map(({ a: x, i, v: verd }) => <AgentRow key={x.agent} x={x} i={i} verd={verd} />)}
          <div style={{ fontSize: 10.5, fontWeight: 700, color: GREEN, textTransform: "uppercase", letterSpacing: 0.6, padding: "10px 11px 3px" }}>Healthy · {ranked.healthy.length}</div>
          {ranked.healthy.map(({ a: x, i, v: verd }, k) => <AgentRow key={x.agent} x={x} i={i} verd={verd} best={k === 0} />)}
        </div>

        {/* RIGHT · selected agent detail */}
        <div style={{ display: "flex", flexDirection: "column", gap: 13, minWidth: 0 }}>

          {/* header */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 11, flexWrap: "wrap" }}>
            <span className={grotesk.className} style={{ fontSize: 22, fontWeight: 600 }}>{a.agent}</span>
            <span style={{ fontSize: 12.5, color: MUT }}>{a.calls} calls · {a.avg_raters} raters each · {a.avg}/4 avg</span>
            <span style={{ flex: 1 }} />
            {needsAttention
              ? <span style={{ borderRadius: 999, background: "#fbeaea", color: RED, fontSize: 12, fontWeight: 600, padding: "4px 11px" }}>needs attention</span>
              : <span style={{ borderRadius: 999, background: "#e7f4ee", color: GREEN, fontSize: 12, fontWeight: 600, padding: "4px 11px" }}>healthy</span>}
          </div>

          {/* Findings · the outcome-level read. The rows below this card name
              issue TYPES ("wrong / missing transcription"); these name what it
              cost the client ("a refusal the transcript lost"). Only exists for
              agents in lib/portal-insights.json · deriving it needs a rule per
              outcome, so it is written per agent rather than generated. */}
          {insights && (
            <div style={{ ...card, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 13 }}>
              <span className={mono.className} style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.7, textTransform: "uppercase", color: MUT }}>
                Findings · {insights.calls} calls
              </span>
              {insights.metrics.map((m: any) => (
                <div key={m.label} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                    <span style={{ flex: 1, fontSize: 14 }}>{m.label}</span>
                    <span className={grotesk.className} style={{ fontSize: 21, fontWeight: 700 }}>{m.value}</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: "#eef2f6", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(m.pct, 100)}%`, background: GREEN }} />
                  </div>
                  <span style={{ fontSize: 11, color: MUT }}>{m.note}</span>
                </div>
              ))}
              {insights.most_common && (
                <div style={{ borderTop: "1px solid #eef2f6", paddingTop: 11, display: "flex", flexDirection: "column", gap: 5 }}>
                  <span className={mono.className} style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.7, textTransform: "uppercase", color: MUT }}>Most common error</span>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 13, lineHeight: 1.6 }}>
                    <button onClick={() => play(insights.most_common.call_id, insights.most_common.ts)}
                      style={{ width: 22, height: 22, borderRadius: 11, background: GREEN, color: "#fff", border: "none", fontSize: 8, cursor: "pointer", flex: "none", marginTop: 3 }}>▶</button>
                    <div>
                      <div><span className={mono.className} style={{ color: MUT }}>Heard</span> <b>&ldquo;{insights.most_common.heard}&rdquo;</b> <span style={{ color: MUT }}>· {insights.most_common.heard_gloss}</span></div>
                      <div><span className={mono.className} style={{ color: GREEN }}>Said</span> <b style={{ color: GREEN }}>&ldquo;{insights.most_common.said}&rdquo;</b> <span style={{ color: GREEN }}>· {insights.most_common.said_gloss}</span></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* metric chips */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ ...card, flex: 1, minWidth: 150, padding: "13px 15px" }}>
              <div className={grotesk.className} style={{ fontSize: 23, fontWeight: 600, color: scoreColor(a.avg) }}>{a.avg} / 4</div>
              <div style={{ fontSize: 11.5, color: MUT }}>avg call quality · human panel</div>
            </div>
            <div style={{ ...card, flex: 1, minWidth: 150, padding: "13px 15px" }}>
              <div className={grotesk.className} style={{ fontSize: 23, fontWeight: 600 }}>{a.calls_with_issue} <span style={{ fontSize: 13, color: MUT, fontWeight: 400 }}>of {a.reviewed}</span></div>
              <div style={{ fontSize: 11.5, color: MUT }}>calls with ≥1 issue</div>
            </div>
            <div style={{ ...card, flex: 1, minWidth: 150, padding: "13px 15px" }}>
              <div className={grotesk.className} style={{ fontSize: 23, fontWeight: 600, color: (a.dist?.[0] ?? 0) >= 25 ? RED : INK }}>{a.dist?.[0] ?? 0}%</div>
              <div style={{ fontSize: 11.5, color: MUT }}>rated 1 · major failure</div>
            </div>
            {/* how much to trust the three numbers above · straight to this
                agent's own reliability, not the program's */}
            {rel && (
              <a href={`/portal/reliability?agent=${encodeURIComponent(a.agent)}`}
                style={{ ...card, flex: 1, minWidth: 168, padding: "13px 15px", textDecoration: "none", color: INK, borderColor: "#cde8db", background: "#fbfdfc", display: "block" }}>
                <div className={grotesk.className} style={{ fontSize: 23, fontWeight: 600, color: GREEN }}>{rel.vs_gt}%</div>
                <div style={{ fontSize: 11.5, color: MUT }}>reliability of these numbers <span style={{ color: GREEN, fontWeight: 600 }}>→</span></div>
              </a>
            )}
          </div>

          {/* issue rows · human review + evidence. Human judgment only · the
              machine judge stays internal, same as the intake. */}
          <div style={{ ...card, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, paddingBottom: 10, flexWrap: "wrap" }}>
              <span className={grotesk.className} style={{ fontSize: 16, fontWeight: 600 }}>What&apos;s breaking, ranked</span>
              <span style={{ fontSize: 12, color: MUT }}>share of this agent&apos;s <b style={{ color: INK }}>{a.calls} calls</b> a human reviewer flagged · click a row for evidence</span>
            </div>

            {/* Where the findings actually land · every issue the panel logged
                for this agent, split by category. The rows below count CALLS
                affected; this counts FINDINGS, which is the honest answer to
                "what is most of the work". */}
            {(() => {
              // Transcription is ~90% of every agent's findings, so a donut of
              // the five categories is one colour and says nothing. It is split
              // into the patterns underneath it instead · same total, real
              // structure. Pattern counts come from lib/portal-patterns.json and
              // sum exactly to the transcription row's `occ`, because both are
              // derived from the same reviews; they are still normalised here so
              // a later regeneration of one file cannot silently skew the arcs.
              const rows = (a.l2 || []).filter((r) => r.occ > 0).sort((x, y) => y.occ - x.occ);
              const tot = rows.reduce((s, r) => s + r.occ, 0);
              if (!tot) return null;
              const TRANS = ["#c0392f", "#d6484f", "#e8827f"];   // one family · these are all transcription
              const OTHER = [AMBER, "#5b8def", "#7c5cbf", GREEN];
              let oi = 0;
              const slices = rows.flatMap((r) => {
                const pats = r.key === "transcription" ? (patterns?.patterns || []).filter((p: any) => p.count > 0) : [];
                if (!pats.length) return [{ label: r.label, value: r.occ, color: OTHER[oi++ % OTHER.length], sub: false }];
                const psum = pats.reduce((s: number, p: any) => s + p.count, 0) || 1;
                return pats.map((p: any, i: number) => ({
                  label: p.title, value: (p.count / psum) * r.occ, color: TRANS[i % TRANS.length], sub: true, raw: p.count,
                }));
              });
              let acc = 0;
              const stops = slices.map((s) => {
                const from = (acc / tot) * 360; acc += s.value;
                return `${s.color} ${from}deg ${(acc / tot) * 360}deg`;
              }).join(", ");
              return (
                <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", padding: "4px 0 14px", borderBottom: "1px solid #eef2f6", marginBottom: 2 }}>
                  <div style={{ width: 108, height: 108, borderRadius: "50%", background: `conic-gradient(${stops})`, flex: "none", position: "relative" }}>
                    <div style={{ position: "absolute", inset: 26, borderRadius: "50%", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                      <span className={grotesk.className} style={{ fontSize: 17, fontWeight: 700, lineHeight: 1 }}>{tot.toLocaleString()}</span>
                      <span style={{ fontSize: 8.5, color: MUT }}>findings</span>
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 230, display: "flex", flexDirection: "column", gap: 5 }}>
                    {slices.map((s, i) => (
                      <div key={s.label + i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                        <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color, flex: "none" }} />
                        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: s.sub ? "#4d5a66" : INK }}>
                          {s.label}{s.sub ? <span style={{ color: MUT, fontSize: 10.5 }}> · transcription</span> : null}
                        </span>
                        <b className={mono.className} style={{ fontSize: 12 }}>{Math.round((s.value / tot) * 100)}%</b>
                        <span style={{ color: MUT, fontSize: 11, width: 62, textAlign: "right", flex: "none" }}>{Math.round(s.raw ?? s.value).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Grouped, not one flat list · transcription is its own section
                with the patterns that explain it, then everything else. The
                donut above splits the same way, so the two agree. */}
            {(() => {
              const rows = (a.l2 || []).slice().sort((r1, r2) => r2.human_calls - r1.human_calls);
              const trans = rows.filter((r) => r.key === "transcription");
              const other = rows.filter((r) => r.key !== "transcription");

              const Row = ({ r }: { r: L2 }) => {
                const isOpen = open === r.key;
                const total = r.human_calls;
                const none = total === 0;
                return (
                  <div style={{ borderTop: "1px solid #eef2f6", background: isOpen ? "#fbfcfd" : "transparent", margin: "0 -18px", padding: "0 18px" }}>
                    <button onClick={() => !none && setOpen(isOpen ? "" : r.key)}
                      style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, padding: "10px 0", width: "100%", background: "transparent", border: "none", cursor: none ? "default" : "pointer", textAlign: "left", color: none ? MUT : INK }}>
                      <span style={{ width: 14, color: isOpen ? GREEN : MUT }}>{none ? "·" : isOpen ? "▾" : "▸"}</span>
                      <span style={{ width: 210, fontWeight: 600, flex: "none" }}>{r.label}</span>
                      <div style={{ flex: 1, display: "flex", height: 12, borderRadius: 6, overflow: "hidden", background: "#eef2f6", minWidth: 90 }}>
                        <div style={{ width: `${(r.human_calls / Math.max(a.reviewed, 1)) * 100}%`, background: GREEN }} />
                      </div>
                      <span style={{ width: 152, textAlign: "right", lineHeight: 1.25, fontSize: 12.5, flex: "none" }}>
                        {none ? <span style={{ color: MUT }}>nothing flagged</span> : <>
                          <b>{total} of {a.reviewed} calls</b><br />
                          <span style={{ fontSize: 11, color: GREEN }}>{r.occ} findings</span>
                        </>}
                      </span>
                    </button>
                    {isOpen && !none && (
                      <div style={{ padding: "2px 0 12px 24px", display: "flex", flexDirection: "column", gap: 7 }}>
                        {r.subtypes?.length > 0 && (
                          <div style={{ display: "flex", gap: 8, fontSize: 12, flexWrap: "wrap" }}>
                            {r.subtypes.map(([st, n], i) => (
                              <span key={st} style={{ borderRadius: 999, padding: "4px 11px", fontSize: 11.5, fontWeight: i === 0 ? 600 : 400, background: i === 0 ? "#fbeaea" : "#eef2f6", color: i === 0 ? RED : "#4d5a66" }}>{st} · {n}</span>
                            ))}
                          </div>
                        )}
                        {(r.evidence || []).map((e2: any, i: number) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, background: "#fff", border: "1px solid #e2e8ee", borderRadius: 8, padding: "8px 10px", fontSize: 12.5 }}>
                            <button onClick={() => play(e2.call_id, e2.ts)} style={{ width: 24, height: 24, borderRadius: 12, background: GREEN, color: "#fff", border: "none", fontSize: 9, cursor: "pointer", flex: "none" }}>▶</button>
                            <span className={mono.className} style={{ fontSize: 11.5, flex: "none" }}>{String(e2.call_id).slice(0, 8)} @{e2.ts}</span>
                            <span style={{ borderRadius: 999, fontSize: 10, background: "#e7f4ee", color: GREEN, padding: "2px 8px", flex: "none" }}>human</span>
                            <span style={{ color: MUT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e2.note}</span>
                          </div>
                        ))}
                        <a href={`/portal/issues?type=${L2_ISSUE_ROUTE[r.key] || "pronunciation"}`} style={{ fontSize: 12, color: GREEN, textDecoration: "none" }}>all {total} calls with evidence →</a>
                      </div>
                    )}
                  </div>
                );
              };

              const GroupHead = ({ t, s2 }: { t: string; s2?: string }) => (
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "13px 0 3px", flexWrap: "wrap" }}>
                  <span className={grotesk.className} style={{ fontSize: 13, fontWeight: 600 }}>{t}</span>
                  {s2 && <span style={{ fontSize: 11.5, color: MUT }}>{s2}</span>}
                </div>
              );

              return (
                <>
                  <GroupHead t="Transcription" s2={patterns?.total ? `${patterns.total.toLocaleString()} corrected segments · the patterns are below` : undefined} />
                  {trans.map((r) => <Row key={r.key} r={r} />)}

                  {/* the patterns sit under transcription, because transcription
                      is what they break down */}
                  {patterns?.patterns?.length ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 7, padding: "10px 0 2px 24px" }}>
                      {patterns.patterns.filter((p: any) => p.pct >= 3).map((p: any) => (
                        <div key={p.title} style={{ background: "#fbfcfd", border: "1px solid #e2e8ee", borderRadius: 9, padding: "9px 11px" }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{p.title}</span>
                            <span className={mono.className} style={{ fontSize: 11, color: RED }}>{p.count} segments · {p.pct}%</span>
                          </div>
                          {p.example && (
                            <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 6, fontSize: 12.5, flexWrap: "wrap" }}>
                              <button onClick={() => play(p.example.call_id, p.example.ts)} style={{ width: 22, height: 22, borderRadius: 11, background: GREEN, color: "#fff", border: "none", fontSize: 8, cursor: "pointer", flex: "none" }}>▶</button>
                              <span style={{ textDecoration: "line-through", color: RED }}>{p.example.asr}</span>
                              <span style={{ color: MUT }}>→</span>
                              <b style={{ color: GREEN }}>{p.example.golden}</b>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <GroupHead t="Everything else" s2="what the panel flagged outside transcription · click a row for evidence" />
                  {other.map((r) => <Row key={r.key} r={r} />)}
                </>
              );
            })()}
          </div>

          {/* the transcript vs the customer · golden output for this agent */}
          {(() => {
            const t = (TRANSCRIPTS.agents as any[]).find((x) => x.agent === a.agent);
            if (!t || !t.pairs?.length) return null;
            return (
              <div style={{ ...card, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                  <span className={grotesk.className} style={{ fontSize: 15, fontWeight: 600 }}>The transcript vs the customer</span>
                  <span style={{ fontSize: 12, color: MUT }}>{t.calls} calls re-transcribed word-by-word by the panel · {t.corrected} of {t.segments.toLocaleString()} segments corrected</span>
                  <span style={{ flex: 1 }} />
                  <a href="/portal/datasets" style={{ fontSize: 12, color: GREEN, textDecoration: "none" }}>full golden set →</a>
                </div>
                {t.pairs.map((p2: any, i: number) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fbfcfd", border: "1px solid #e2e8ee", borderRadius: 8, padding: "8px 11px", fontSize: 13, flexWrap: "wrap" }}>
                    <button onClick={() => play(p2.call_id, p2.ts)} style={{ width: 24, height: 24, borderRadius: 12, background: GREEN, color: "#fff", border: "none", fontSize: 9, cursor: "pointer", flex: "none" }}>▶</button>
                    <span style={{ textDecoration: "line-through", color: RED }}>{p2.asr}</span>
                    <span style={{ color: MUT }}>→</span>
                    <b style={{ color: GREEN }}>{p2.golden}</b>
                    <span style={{ flex: 1 }} />
                    <span style={{ borderRadius: 999, fontSize: 10.5, background: "#eef2f6", color: "#4d5a66", padding: "3px 9px", flex: "none" }}>{p2.tag}</span>
                  </div>
                ))}
                <div style={{ fontSize: 11.5, color: MUT }}>Every row is the ASR&apos;s line against what the customer actually said · press play and hear it. This is what a machine judge scoring the transcript can never catch.</div>
              </div>
            );
          })()}

          {/* closing insight line */}
          <div style={{ fontSize: 12, color: MUT }}>
            {v.key && leadCalls > 0
              ? <>{leadCalls} of this agent&apos;s issues trace back to <b style={{ color: INK, textTransform: "capitalize" }}>{v.label}</b> · one fix, most of the list clears. </>
              : <>Clean across the taxonomy. </>}
            Golden transcripts for this agent are under <a href="/portal/datasets" style={{ color: GREEN }}>Datasets</a>.
          </div>
        </div>
      </div>
    </PortalShell>
  );
}

export default function AgentInsights() {
  return <Suspense fallback={null}><Inner /></Suspense>;
}
